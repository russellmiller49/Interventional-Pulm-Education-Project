import { clamp, roundTo } from './calculations'
import {
  applyFastFlushEvent,
  applyPressureArtifact,
  isOverdamped,
  isUnderdamped,
  pulsatileGainFor,
} from './waveformArtifacts'
import {
  ecgShapeMv,
  PULMONARY_ARTERY_MEAN_FRACTION,
  pulsatilePressureShape,
  PULMONARY_ARTERY_SHAPE,
  rightAtrialAmplitudesFor,
  rightAtrialDeviationMmHg,
  SYSTEMIC_ARTERIAL_MEAN_FRACTION,
  SYSTEMIC_ARTERIAL_SHAPE,
  MMHG_PER_CM_H2O,
  ventricularPressureShape,
  wedgeAmplitudesFor,
  wedgeDeviationMmHg,
} from './waveformMorphology'
import {
  advanceWindkesselCompartments,
  createInitialCirculationCompartments,
  HEMODYNAMIC_FIXED_STEP_SECONDS,
} from '@/features/hemodynamics-core'
import { SHARED_CRITICAL_CARE_THRESHOLDS } from '@/features/critical-care/content/sharedClinicalThresholds'
import { PAC_ROUTE_PROGRESS } from '@/features/cardiac-anatomy/content/paths'
import { HEMODYNAMIC_CLINICAL_THRESHOLDS } from '../content/clinicalThresholds'
import { arterialMeasurementSystem } from './measurementLines'
export {
  advanceWindkesselCompartments,
  createInitialCirculationCompartments,
  HEMODYNAMIC_ENGINE_HZ,
  HEMODYNAMIC_FIXED_STEP_SECONDS,
  timeVaryingVentricularElastance,
  totalCirculatingVolumeMl,
} from '@/features/hemodynamics-core'
import type {
  CatheterPosition,
  CirculationParameters,
  HemodynamicAlarm,
  HemodynamicCaseDefinition,
  HemodynamicInterventionDefinition,
  HemodynamicLearningMode,
  HemodynamicMeasurements,
  HemodynamicSimulationState,
  HemodynamicWaveformSample,
  FastFlushLineType,
  MeasurementSystemState,
  ParameterEffect,
  PhysiologicalEpisode,
} from './types'

const MAX_WAVEFORM_SECONDS = 12
export const WEDGE_AUTO_DEFLATION_SECONDS = 10
const WEDGE_CAPTURE_SAFETY_MARGIN_SECONDS = 2

export const defaultMeasurementSystem: MeasurementSystemState = {
  zeroed: false,
  transducerLevelCm: 0,
  dampingRatio: 0.65,
  naturalFrequencyHz: 18,
  noiseAmplitudeMmHg: 0.12,
  artifact: 'none',
  fastFlushStartedAt: null,
  fastFlushActiveUntil: null,
  fastFlushLineType: null,
  lastFastFlushFinding: null,
}

const catheterDepth: Record<CatheterPosition, number> = {
  introducer: 12,
  ra: 25,
  rv: 35,
  pa: 45,
  wedge: 45,
}

/** Matches the full-route duration used by the R3F spline playback. */
export const PAC_CATHETER_FULL_ROUTE_DURATION_SECONDS = 7.5

export function catheterTransitionDurationSeconds(
  from: CatheterPosition,
  to: CatheterPosition,
): number {
  const fromKey = from === 'wedge' ? 'pa' : from
  const toKey = to === 'wedge' ? 'pa' : to
  return Math.max(
    0.24,
    PAC_CATHETER_FULL_ROUTE_DURATION_SECONDS *
      Math.abs(PAC_ROUTE_PROGRESS[toKey] - PAC_ROUTE_PROGRESS[fromKey]),
  )
}

export function wedgeCaptureDelaySeconds(respiratoryRateBpm: number): number {
  const respiratoryCycleSeconds = 60 / clamp(respiratoryRateBpm, 4, 45)
  return Math.min(
    WEDGE_AUTO_DEFLATION_SECONDS - WEDGE_CAPTURE_SAFETY_MARGIN_SECONDS,
    respiratoryCycleSeconds,
  )
}

/** Fraction of the respiratory cycle spent in inspiration, an I:E ratio of roughly 1:1.5. */
export const INSPIRATORY_FRACTION = 0.4

/**
 * Respiratory phase at which intrathoracic pressure most closely approximates atmospheric
 * pressure. Intravascular pressures are read here, and nowhere else, because this is the only
 * point in the cycle where the displayed pressure approximates the transmural pressure.
 */
export const END_EXPIRATION_PHASE = 0

/** Tolerance around end expiration within which a wedge sample counts as end-expiratory. */
export const END_EXPIRATION_TOLERANCE_PHASE = 0.12

export function respiratoryPhaseAt(timeSeconds: number, respiratoryRateBpm: number): number {
  const cycleSeconds = 60 / clamp(respiratoryRateBpm, 4, 45)
  return (((timeSeconds % cycleSeconds) + cycleSeconds) % cycleSeconds) / cycleSeconds
}

export function isEndExpiration(respiratoryPhase: number): boolean {
  return (
    respiratoryPhase <= END_EXPIRATION_TOLERANCE_PHASE ||
    respiratoryPhase >= 1 - END_EXPIRATION_TOLERANCE_PHASE
  )
}

/**
 * Normalized respiratory excursion: zero at end expiration, rising through inspiration, and
 * returning smoothly to zero through expiration. The excursion does not reverse direction:
 * positive-pressure ventilation stays above its end-expiratory reference, while spontaneous
 * inspiration stays below it.
 */
function respiratoryExcursion(respiratoryPhase: number): number {
  if (respiratoryPhase < INSPIRATORY_FRACTION) {
    return Math.sin((respiratoryPhase / INSPIRATORY_FRACTION) * (Math.PI / 2))
  }
  const expiratoryProgress = (respiratoryPhase - INSPIRATORY_FRACTION) / (1 - INSPIRATORY_FRACTION)
  return Math.cos(expiratoryProgress * (Math.PI / 2))
}

/**
 * Sign of the respiratory pressure swing. Spontaneous inspiration lowers intrathoracic pressure
 * and pulls displayed intravascular pressures down; positive-pressure inspiration pushes them up.
 * Either way the pressures converge at end expiration, which is why that is the phase to read.
 */
function respiratoryDirection(parameters: CirculationParameters): number {
  return 1 - 2 * clamp(parameters.spontaneousBreathingFraction, 0, 1)
}

function deterministicNoise(seed: number, index: number, salt: number): number {
  const value = Math.sin((seed + 1) * 12.9898 + (index + salt) * 78.233) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

/**
 * When a transient effect stops building and starts to wane, in model seconds, or `null` for an
 * effect that does not recover. The same boundary `effectScale` uses, so an episode boundary and
 * the model's own behaviour cannot drift apart.
 */
export function effectWaningStartsAt(effect: ParameterEffect): number | null {
  if (effect.recoverySeconds === null) return null
  return effect.startedAt + Math.max(20, effect.onsetSeconds * 3)
}

function effectScale(effect: ParameterEffect, timeSeconds: number): number {
  const elapsed = Math.max(0, timeSeconds - effect.startedAt)
  const onset = 1 - Math.exp(-elapsed / Math.max(0.1, effect.onsetSeconds))
  if (effect.recoverySeconds === null) return onset
  const recoveryElapsed = Math.max(0, elapsed - Math.max(20, effect.onsetSeconds * 3))
  return onset * Math.exp(-recoveryElapsed / Math.max(0.1, effect.recoverySeconds))
}

/**
 * The range the model holds each effective parameter to, after every active effect is summed.
 * Parameters not listed are not bounded. One table, read by the derivation below and by
 * `effectCanChangeEffectiveParameters`, so the two cannot disagree about where a parameter stops.
 */
const EFFECTIVE_PARAMETER_BOUNDS: Readonly<
  Partial<Record<keyof CirculationParameters, readonly [number, number]>>
> = {
  heartRateBpm: [25, 190],
  respiratoryRateBpm: [4, 45],
  circulatingVolumeFraction: [0.45, 1.4],
  systemicVascularResistanceDynSecCm5: [250, 3200],
  pulmonaryVascularResistanceWU: [0.4, 18],
  leftVentricularContractility: [0.25, 2],
  rightVentricularContractility: [0.2, 2],
  leftVentricularCompliance: [0.25, 2],
  rightVentricularCompliance: [0.25, 2],
  pericardialPressureMmHg: [0, 28],
  peepCmH2O: [0, 22],
}

function effectDeltas(effect: ParameterEffect): [keyof CirculationParameters, number][] {
  return Object.entries(effect.deltas) as [keyof CirculationParameters, number][]
}

export function deriveEffectiveCirculationParameters(
  baseline: CirculationParameters,
  effects: readonly ParameterEffect[],
  timeSeconds: number,
): CirculationParameters {
  const next = { ...baseline }
  for (const effect of effects) {
    const scale = effectScale(effect, timeSeconds)
    for (const [key, delta] of effectDeltas(effect)) {
      next[key] += delta * scale
    }
  }
  for (const [key, bounds] of Object.entries(EFFECTIVE_PARAMETER_BOUNDS) as [
    keyof CirculationParameters,
    readonly [number, number],
  ][]) {
    next[key] = clamp(next[key], bounds[0], bounds[1])
  }
  return next
}

/**
 * The lowest and highest scale an effect can have at any model time from `fromSeconds` on.
 *
 * Read from the shape of `effectScale`: the onset term only rises, towards 1; a transient's recovery
 * term then only falls, towards 0. So a sustained effect never drops below its scale now and never
 * exceeds 1, and a transient can reach anything between 0 and 1. The bounds are sound rather than
 * tight: where they are loose, the check below errs towards "can change".
 */
function effectScaleBounds(
  effect: ParameterEffect,
  fromSeconds: number,
): { readonly lowest: number; readonly highest: number } {
  if (effect.recoverySeconds !== null) return { lowest: 0, highest: 1 }
  return { lowest: effectScale(effect, fromSeconds), highest: 1 }
}

/**
 * Whether `effect` can change the model's effective parameters at any model time from `fromSeconds`
 * on, given the other effects and the model's bounds (HD-PRE-REVIEW-02 sanity repair, blocker 2).
 *
 * This compares the same model with and without the effect, over the whole of its course rather
 * than at the instant it starts (when its scale is zero). Parameters are summed independently and
 * then bounded, so for each parameter the effect moves, adding it changes nothing at a given time
 * exactly when the sum without it is already at or beyond the bound the effect pushes towards —
 * both then read the bound itself. The effect is inert only if that holds for every parameter it
 * moves at every time from `fromSeconds` on; the range of the sum without it comes from
 * `effectScaleBounds`. An unbounded parameter it moves, or a range that reaches inside the bound,
 * means it can change the conditions.
 *
 * No tolerance is involved: an inert effect leaves the effective parameters bit-for-bit equal.
 */
export function effectCanChangeEffectiveParameters(
  baseline: CirculationParameters,
  otherEffects: readonly ParameterEffect[],
  effect: ParameterEffect,
  fromSeconds: number,
): boolean {
  for (const [key, delta] of effectDeltas(effect)) {
    if (delta === 0) continue
    const bounds = EFFECTIVE_PARAMETER_BOUNDS[key]
    if (!bounds) return true
    let lowestWithout = baseline[key]
    let highestWithout = baseline[key]
    for (const other of otherEffects) {
      const otherDelta = other.deltas[key]
      if (!otherDelta) continue
      const scale = effectScaleBounds(other, fromSeconds)
      lowestWithout += otherDelta * (otherDelta > 0 ? scale.lowest : scale.highest)
      highestWithout += otherDelta * (otherDelta > 0 ? scale.highest : scale.lowest)
    }
    const masked = delta > 0 ? lowestWithout >= bounds[1] : highestWithout <= bounds[0]
    if (!masked) return true
  }
  return false
}

/** Whether an intervention is written to change the model at all (any non-zero parameter delta). */
export function interventionHasModeledEffect(
  intervention: HemodynamicInterventionDefinition,
): boolean {
  return Object.values(intervention.parameterDeltas).some((delta) => delta !== 0)
}

/**
 * What an accepted intervention did when the model's bounds absorb its whole effect. Its authored
 * response ("tone rises over several seconds") describes a change that, in this state, the model
 * cannot make, so it is not what the learner is told happened.
 */
export function absorbedInterventionNarration(
  intervention: HemodynamicInterventionDefinition,
): string {
  return `${intervention.shortLabel}: accepted, with no further modeled effect. Every quantity this step acts on is already at the limit this simulation allows, so the modeled physiology — and the conditions measurements are acquired under — did not change.`
}

/**
 * Whether accepting `intervention` now would change the physiology later measurements are acquired
 * under. An intervention with no modeled effect, or one whose every effect the model's bounds
 * already absorb (the thirtieth dose of a vasopressor at its ceiling), does not — and so it starts
 * no new physiological episode and leaves compatible measurements current.
 */
export function interventionChangesPhysiology(
  state: HemodynamicSimulationState,
  intervention: HemodynamicInterventionDefinition,
): boolean {
  return effectCanChangeEffectiveParameters(
    state.baselineParameters,
    state.activeEffects,
    {
      id: `${intervention.id}-candidate`,
      interventionId: intervention.id,
      startedAt: state.timeSeconds,
      onsetSeconds: intervention.onsetSeconds,
      recoverySeconds: intervention.recoverySeconds ?? null,
      deltas: intervention.parameterDeltas,
    },
    state.timeSeconds,
  )
}

/**
 * The model's own estimates, before any rounding (HD-PRE-REVIEW-02, reports L2-02 and L2-14).
 *
 * `deriveHemodynamicMeasurements` rounds each estimate to the precision the model reports. A
 * comparison built from those rounded integers can make a pure hydrostatic offset look like
 * different shifts (22 → 27 and 13 → 19 for one 5.9 mmHg move) and a pulse pressure that changed.
 * Anything that compares or subtracts model estimates reads these instead and rounds only for
 * display. The values are the same quantities; only the rounding is deferred.
 */
export function deriveUnroundedHemodynamicMeasurements(
  parameters: CirculationParameters,
  measurementSystem: MeasurementSystemState,
): HemodynamicMeasurements {
  const volumeEffect = clamp(
    1 + (parameters.circulatingVolumeFraction - 1) * (0.8 + parameters.fluidResponsiveness * 0.45),
    0.38,
    1.35,
  )
  const peepEffect = clamp(1 - Math.max(0, parameters.peepCmH2O - 5) * 0.014, 0.72, 1.05)
  const tamponadeEffect = clamp(1 - parameters.pericardialPressureMmHg * 0.025, 0.42, 1)
  const rvAfterloadEffect = clamp(
    1 - Math.max(0, parameters.pulmonaryVascularResistanceWU - 2) * 0.025,
    0.55,
    1.05,
  )
  const contractilityEffect = Math.sqrt(
    parameters.leftVentricularContractility * parameters.rightVentricularContractility,
  )
  const flow = clamp(
    parameters.referenceCardiacOutputLMin *
      volumeEffect *
      peepEffect *
      tamponadeEffect *
      rvAfterloadEffect *
      contractilityEffect,
    0.8,
    13,
  )
  const strokeVolume = (flow * 1000) / parameters.heartRateBpm
  const volumePressure = (parameters.circulatingVolumeFraction - 1) * 14
  const pericardialConstraintFraction = clamp(parameters.pericardialPressureMmHg / 14, 0, 1)
  const sharedConstrainedFillingPressure = parameters.pericardialPressureMmHg + 4
  const unconstrainedRap =
    parameters.rightAtrialPressureSetPointMmHg +
    volumePressure / parameters.rightVentricularCompliance +
    Math.max(0, parameters.pulmonaryVascularResistanceWU - 2) * 0.48 +
    parameters.peepCmH2O * 0.16
  const unconstrainedPawp =
    parameters.leftAtrialPressureSetPointMmHg +
    volumePressure / parameters.leftVentricularCompliance +
    Math.max(0, parameters.peepCmH2O - 5) * 0.28
  const rapTrue = clamp(
    unconstrainedRap * (1 - pericardialConstraintFraction) +
      sharedConstrainedFillingPressure * pericardialConstraintFraction,
    0,
    35,
  )
  const pawpTrue = clamp(
    unconstrainedPawp * (1 - pericardialConstraintFraction) +
      sharedConstrainedFillingPressure * pericardialConstraintFraction,
    1,
    40,
  )
  const mapTrue = clamp(
    rapTrue + (flow * parameters.systemicVascularResistanceDynSecCm5) / 80,
    25,
    180,
  )
  const meanPapTrue = clamp(pawpTrue + flow * parameters.pulmonaryVascularResistanceWU, 8, 80)
  const artPulsePressure = clamp(
    strokeVolume / parameters.systemicArterialComplianceMlMmHg,
    12,
    100,
  )
  const paPulsePressure = clamp(strokeVolume / parameters.pulmonaryArterialComplianceMlMmHg, 5, 65)
  let artSystolic = mapTrue + artPulsePressure * (1 - SYSTEMIC_ARTERIAL_MEAN_FRACTION)
  let artDiastolic = mapTrue - artPulsePressure * SYSTEMIC_ARTERIAL_MEAN_FRACTION
  let papSystolic = meanPapTrue + paPulsePressure * (1 - PULMONARY_ARTERY_MEAN_FRACTION)
  let papDiastolic = meanPapTrue - paPulsePressure * PULMONARY_ARTERY_MEAN_FRACTION

  // Dynamic-response artifacts widen or narrow pulse pressure around the preserved mean.
  // The live trace receives the same gain exactly once; see pressureTransfer below. The arterial
  // line reads its own response when it has one (L9-05); otherwise both share it, as before.
  const pulsatileGain = pulsatileGainFor(measurementSystem)
  const arterialGain = pulsatileGainFor(arterialMeasurementSystem(measurementSystem))
  artSystolic = mapTrue + (artSystolic - mapTrue) * arterialGain
  artDiastolic = mapTrue + (artDiastolic - mapTrue) * arterialGain
  papSystolic = meanPapTrue + (papSystolic - meanPapTrue) * pulsatileGain
  papDiastolic = meanPapTrue + (papDiastolic - meanPapTrue) * pulsatileGain

  const hydrostaticOffset = -measurementSystem.transducerLevelCm * MMHG_PER_CM_H2O
  const zeroOffset = measurementSystem.zeroed ? 0 : 5
  const offset = hydrostaticOffset + zeroOffset
  const displayedPawp =
    measurementSystem.artifact === 'false-wedge' ? meanPapTrue + 2 + offset : pawpTrue + offset
  const rvMediatedVariation =
    Math.max(0, 0.75 - parameters.rightVentricularContractility) * 18 +
    Math.max(0, parameters.pulmonaryVascularResistanceWU - 4) * 1.2
  const pulseVariation = clamp(
    3 +
      parameters.fluidResponsiveness * 11 +
      Math.abs(parameters.pleuralPressureSwingMmHg) * 0.65 +
      rvMediatedVariation,
    2,
    32,
  )

  return {
    heartRateBpm: parameters.heartRateBpm,
    spo2Percent: parameters.arterialOxygenSaturationPercent,
    artSystolicMmHg: artSystolic + offset,
    artDiastolicMmHg: artDiastolic + offset,
    mapMmHg: mapTrue + offset,
    rapMmHg: rapTrue + offset,
    // No systolic pressure difference exists between the right ventricle and the pulmonary
    // artery unless there is pulmonic valvular or pulmonary artery stenosis.
    rvSystolicMmHg: papSystolic + offset,
    // Right ventricular end-diastolic pressure sits within a few mmHg of right atrial pressure.
    rvDiastolicMmHg: Math.max(0, rapTrue - 1) + offset,
    papSystolicMmHg: papSystolic + offset,
    papDiastolicMmHg: papDiastolic + offset,
    meanPapMmHg: meanPapTrue + offset,
    pawpMmHg: displayedPawp,
    cardiacOutputLMin: flow,
    cardiacIndexLMinM2: flow / parameters.bodySurfaceAreaM2,
    svo2Percent: clamp(parameters.mixedVenousOxygenSaturationPercent + (flow - 5) * 2.4, 35, 85),
    pulsePressureMaxMmHg: artPulsePressure * (1 + pulseVariation / 200),
    pulsePressureMinMmHg: artPulsePressure * (1 - pulseVariation / 200),
  }
}

/** The model's estimates at the precision it reports them. Same quantities as the unrounded set. */
export function deriveHemodynamicMeasurements(
  parameters: CirculationParameters,
  measurementSystem: MeasurementSystemState,
): HemodynamicMeasurements {
  const raw = deriveUnroundedHemodynamicMeasurements(parameters, measurementSystem)
  return {
    heartRateBpm: roundTo(raw.heartRateBpm, 0),
    spo2Percent: roundTo(raw.spo2Percent, 0),
    artSystolicMmHg: roundTo(raw.artSystolicMmHg, 0),
    artDiastolicMmHg: roundTo(raw.artDiastolicMmHg, 0),
    mapMmHg: roundTo(raw.mapMmHg, 0),
    rapMmHg: roundTo(raw.rapMmHg, 0),
    rvSystolicMmHg: roundTo(raw.rvSystolicMmHg, 0),
    rvDiastolicMmHg: roundTo(raw.rvDiastolicMmHg, 0),
    papSystolicMmHg: roundTo(raw.papSystolicMmHg, 0),
    papDiastolicMmHg: roundTo(raw.papDiastolicMmHg, 0),
    meanPapMmHg: roundTo(raw.meanPapMmHg, 0),
    pawpMmHg: roundTo(raw.pawpMmHg as number, 0),
    cardiacOutputLMin: roundTo(raw.cardiacOutputLMin, 1),
    cardiacIndexLMinM2: roundTo(raw.cardiacIndexLMinM2, 1),
    svo2Percent: roundTo(raw.svo2Percent, 0),
    pulsePressureMaxMmHg: roundTo(raw.pulsePressureMaxMmHg, 1),
    pulsePressureMinMmHg: roundTo(raw.pulsePressureMinMmHg, 1),
  }
}

/** The current state's model estimates, unrounded. */
export function unroundedModelEstimates(
  state: HemodynamicSimulationState,
): HemodynamicMeasurements {
  return deriveUnroundedHemodynamicMeasurements(state.parameters, state.measurementSystem)
}

/** A levelled, zeroed, well-damped measurement system, for reading the physiology itself. */
const IDEAL_MEASUREMENT_SYSTEM: MeasurementSystemState = {
  ...defaultMeasurementSystem,
  zeroed: true,
  transducerLevelCm: 0,
  dampingRatio: 0.65,
  artifact: 'none',
  arterialLine: null,
}

/**
 * The model's physiological values with no measurement-system error applied: what the circulation
 * in the model is doing, before any transducer height, missing zero or damping distorts it. Latent
 * model state — never something the monitor displayed or the learner acquired — and used only by
 * surfaces that label it that way.
 */
export function latentPhysiologicalEstimates(
  state: HemodynamicSimulationState,
): HemodynamicMeasurements {
  return deriveUnroundedHemodynamicMeasurements(state.parameters, IDEAL_MEASUREMENT_SYSTEM)
}

function arterialShape(phase: number): number {
  return pulsatilePressureShape(phase, SYSTEMIC_ARTERIAL_SHAPE)
}

function pressureTransfer(
  value: number,
  mean: number,
  measurementSystem: MeasurementSystemState,
  time: number,
  channelSalt: number,
  seed: number,
  options: {
    readonly cardiacPhase: number
    readonly pulsePressureMmHg: number
    readonly gainAlreadyApplied?: boolean
    readonly catheterSpecificArtifacts?: boolean
    readonly fastFlushLineType?: FastFlushLineType
  },
): number {
  const hydrostaticOffset = -measurementSystem.transducerLevelCm * MMHG_PER_CM_H2O
  const zeroOffset = measurementSystem.zeroed ? 0 : 5
  const catheterOnlyArtifact =
    measurementSystem.artifact === 'catheter-whip' ||
    measurementSystem.artifact === 'wall-contact' ||
    measurementSystem.artifact === 'false-wedge'
  const transferSystem =
    catheterOnlyArtifact && !options.catheterSpecificArtifacts
      ? { ...measurementSystem, artifact: 'none' as const }
      : measurementSystem
  const distorted = applyPressureArtifact({
    value,
    mean,
    state: transferSystem,
    timeSeconds: time,
    cardiacPhase: options.cardiacPhase,
    pulsePressureMmHg: options.pulsePressureMmHg,
    gainAlreadyApplied: options.gainAlreadyApplied,
  })
  const index = Math.round(time / HEMODYNAMIC_FIXED_STEP_SECONDS)
  const displayedBaseline =
    distorted +
    hydrostaticOffset +
    zeroOffset +
    deterministicNoise(seed, index, channelSalt) * measurementSystem.noiseAmplitudeMmHg
  const fastFlushMatchesChannel =
    measurementSystem.fastFlushStartedAt !== null &&
    measurementSystem.fastFlushActiveUntil !== null &&
    time <= measurementSystem.fastFlushActiveUntil &&
    measurementSystem.fastFlushLineType === options.fastFlushLineType

  if (!fastFlushMatchesChannel || !options.fastFlushLineType) return displayedBaseline

  const response = isOverdamped(measurementSystem)
    ? 'overdamped'
    : isUnderdamped(measurementSystem)
      ? 'underdamped'
      : 'acceptable'
  return applyFastFlushEvent({
    baselinePressureMmHg: displayedBaseline,
    lineType: options.fastFlushLineType,
    response,
    elapsedSeconds: time - measurementSystem.fastFlushStartedAt!,
  })
}

function generateWaveformSample(
  time: number,
  measurements: HemodynamicMeasurements,
  parameters: CirculationParameters,
  measurementSystem: MeasurementSystemState,
  seed: number,
): HemodynamicWaveformSample {
  const cycleSeconds = 60 / parameters.heartRateBpm
  const cardiacPhase = (((time % cycleSeconds) + cycleSeconds) % cycleSeconds) / cycleSeconds
  const respiratoryPhase = respiratoryPhaseAt(time, parameters.respiratoryRateBpm)
  const pulseShape = arterialShape(cardiacPhase)
  const respiratorySwing = respiratoryExcursion(respiratoryPhase) * respiratoryDirection(parameters)
  const displayedOffset =
    -measurementSystem.transducerLevelCm * MMHG_PER_CM_H2O + (measurementSystem.zeroed ? 0 : 5)
  const artMean = measurements.mapMmHg - displayedOffset
  const artDiastolic = measurements.artDiastolicMmHg - displayedOffset
  const artPulsePressure = measurements.artSystolicMmHg - measurements.artDiastolicMmHg
  const roundedArtShapeMean = artDiastolic + artPulsePressure * SYSTEMIC_ARTERIAL_MEAN_FRACTION
  const analyticArt = artDiastolic + artPulsePressure * pulseShape + (artMean - roundedArtShapeMean)
  const artTrue = analyticArt + respiratorySwing * parameters.pleuralPressureSwingMmHg * 0.5

  // Right atrium: a, c, and v waves with x and y descents, timed to the ECG.
  const rapTrue = measurements.rapMmHg - displayedOffset
  const cvpTrue =
    rapTrue +
    rightAtrialDeviationMmHg(
      cardiacPhase,
      rightAtrialAmplitudesFor({
        ventricularCompliance: parameters.rightVentricularCompliance,
        pericardialPressureMmHg: parameters.pericardialPressureMmHg,
        tricuspidRegurgitationSeverity: parameters.tricuspidRegurgitationSeverity,
      }),
    ) +
    respiratorySwing * parameters.pleuralPressureSwingMmHg

  // Right ventricle: rapid rise, rapid relaxation, and a diastolic phase that starts low and
  // gradually rises. That up-sloping diastole is what separates RV from the PA tracing.
  const rvSystolic = measurements.rvSystolicMmHg - displayedOffset
  const rvEndDiastolic = measurements.rvDiastolicMmHg - displayedOffset
  const rvShapeOptions = {
    aWaveFraction: Math.min(
      0.18,
      Math.max(0, 1 / Math.max(0.25, parameters.rightVentricularCompliance) - 1) * 0.14,
    ),
    endDiastolicFraction: 0.16,
  }
  const rvNadir =
    (rvEndDiastolic - rvSystolic * rvShapeOptions.endDiastolicFraction) /
    (1 - rvShapeOptions.endDiastolicFraction)
  const rvTrue =
    rvNadir +
    (rvSystolic - rvNadir) * ventricularPressureShape(cardiacPhase, rvShapeOptions) +
    respiratorySwing * parameters.pleuralPressureSwingMmHg * 0.8

  // Pulmonary artery: same anatomy as the arterial trace but a later, rounder peak, a later
  // dicrotic notch from pulmonic valve closure, and a diastole that continues to fall.
  const papMean = measurements.meanPapMmHg - displayedOffset
  const papDiastolic = measurements.papDiastolicMmHg - displayedOffset
  const papPulsePressure = measurements.papSystolicMmHg - measurements.papDiastolicMmHg
  const roundedPapShapeMean = papDiastolic + papPulsePressure * PULMONARY_ARTERY_MEAN_FRACTION
  const analyticPap =
    papDiastolic +
    papPulsePressure * pulsatilePressureShape(cardiacPhase, PULMONARY_ARTERY_SHAPE) +
    (papMean - roundedPapShapeMean)
  const papTrue = analyticPap + respiratorySwing * parameters.pleuralPressureSwingMmHg

  // Wedge: the same wave family as the atrial trace, delayed by transmission back through the
  // pulmonary bed and damped enough that no c wave survives.
  const wedgeMean = (measurements.pawpMmHg ?? measurements.papDiastolicMmHg) - displayedOffset
  const wedgeTrue =
    wedgeMean +
    wedgeDeviationMmHg(
      cardiacPhase,
      wedgeAmplitudesFor({
        leftVentricularCompliance: parameters.leftVentricularCompliance,
        pericardialPressureMmHg: parameters.pericardialPressureMmHg,
      }),
    ) +
    respiratorySwing * parameters.pleuralPressureSwingMmHg

  const ecg = ecgShapeMv(cardiacPhase)
  const respiration = respiratorySwing * parameters.pleuralPressureSwingMmHg * 2
  const pleth = clamp(pulseShape * 0.88 + respiratorySwing * 0.06, 0, 1.2)
  const cvpPulsePressure = Math.max(2, 5 / Math.max(0.4, parameters.rightVentricularCompliance))
  const rvPulsePressure = measurements.rvSystolicMmHg - measurements.rvDiastolicMmHg
  const wedgePulsePressure = Math.max(2, 5 / Math.max(0.4, parameters.leftVentricularCompliance))
  const falseWedgeMean = (measurements.pawpMmHg ?? measurements.meanPapMmHg) - displayedOffset
  const falseWedgeTrue = papTrue + (falseWedgeMean - papMean)

  return {
    time,
    ecgMv: ecg,
    artMmHg: pressureTransfer(
      artTrue,
      artMean,
      arterialMeasurementSystem(measurementSystem),
      time,
      3,
      seed,
      {
        cardiacPhase,
        pulsePressureMmHg: artPulsePressure,
        gainAlreadyApplied: true,
        fastFlushLineType: 'systemic-arterial',
      },
    ),
    cvpMmHg: pressureTransfer(cvpTrue, rapTrue, measurementSystem, time, 7, seed, {
      cardiacPhase,
      pulsePressureMmHg: cvpPulsePressure,
    }),
    rvMmHg: pressureTransfer(
      rvTrue,
      (measurements.rvSystolicMmHg + measurements.rvDiastolicMmHg) / 2 - displayedOffset,
      measurementSystem,
      time,
      11,
      seed,
      {
        cardiacPhase,
        pulsePressureMmHg: rvPulsePressure,
        gainAlreadyApplied: true,
        catheterSpecificArtifacts: true,
      },
    ),
    papMmHg: pressureTransfer(
      papTrue,
      measurements.meanPapMmHg - displayedOffset,
      measurementSystem,
      time,
      13,
      seed,
      {
        cardiacPhase,
        pulsePressureMmHg: papPulsePressure,
        gainAlreadyApplied: true,
        catheterSpecificArtifacts: true,
        fastFlushLineType: 'pulmonary-artery',
      },
    ),
    pcwpMmHg:
      measurementSystem.artifact === 'false-wedge'
        ? pressureTransfer(falseWedgeTrue, falseWedgeMean, measurementSystem, time, 17, seed, {
            cardiacPhase,
            pulsePressureMmHg: papPulsePressure,
            gainAlreadyApplied: true,
            catheterSpecificArtifacts: true,
          })
        : pressureTransfer(wedgeTrue, wedgeMean, measurementSystem, time, 17, seed, {
            cardiacPhase,
            pulsePressureMmHg: wedgePulsePressure,
            catheterSpecificArtifacts: true,
          }),
    pleth,
    respiration,
  }
}

function alarmsFor(
  measurements: HemodynamicMeasurements,
  balloonInflated: boolean,
  forcedSafetyRecovery: boolean,
): HemodynamicAlarm[] {
  const sharedMap = SHARED_CRITICAL_CARE_THRESHOLDS.meanArterialPressure
  const cardiacIndex = HEMODYNAMIC_CLINICAL_THRESHOLDS.cardiacIndexAlarm
  return [
    {
      id: 'low-map',
      label: 'ART MAP LOW',
      priority: measurements.mapMmHg < sharedMap.criticalLowMmHg ? 'critical' : 'warning',
      active: measurements.mapMmHg < sharedMap.lowMmHg,
      acknowledged: false,
    },
    {
      id: 'low-ci',
      label: 'CARDIAC INDEX LOW',
      priority:
        measurements.cardiacIndexLMinM2 < cardiacIndex.criticalLowLMinM2 ? 'critical' : 'warning',
      active: measurements.cardiacIndexLMinM2 < cardiacIndex.lowLMinM2,
      acknowledged: false,
    },
    {
      id: 'high-pap',
      label: 'PAP HIGH',
      priority: 'warning',
      active:
        measurements.meanPapMmHg >
        HEMODYNAMIC_CLINICAL_THRESHOLDS.pulmonaryHypertension.meanPapMmHg,
      acknowledged: false,
    },
    {
      id: 'wedge-safety',
      label: forcedSafetyRecovery ? 'BALLOON AUTO-DEFLATED' : 'WEDGE ACTIVE',
      priority: forcedSafetyRecovery ? 'critical' : 'advisory',
      active: balloonInflated || forcedSafetyRecovery,
      acknowledged: false,
    },
  ]
}

/**
 * Which run of a case a state belongs to. Deterministic, so identical inputs give identical states;
 * a reset through the reducer increments the ordinal so a new run is never the old one.
 */
export function hemodynamicSessionId(
  caseId: string,
  mode: HemodynamicLearningMode,
  seed: number,
  ordinal: number,
): string {
  return `${caseId}/${mode}/${seed}/run-${ordinal}`
}

export function sessionOrdinalOf(state: Pick<HemodynamicSimulationState, 'sessionId'>): number {
  const match = /\/run-(\d+)$/.exec(state.sessionId ?? '')
  return match ? Number(match[1]) : 1
}

export function createInitialHemodynamicState(
  definition: HemodynamicCaseDefinition,
  mode: HemodynamicLearningMode = 'learn',
  seed = 417,
  sessionOrdinal = 1,
): HemodynamicSimulationState {
  const measurementSystem: MeasurementSystemState = {
    ...defaultMeasurementSystem,
    ...definition.initialMeasurementSystem,
  }
  const parameters = { ...definition.initialParameters }
  const measurements = deriveHemodynamicMeasurements(parameters, measurementSystem)
  let compartments = createInitialCirculationCompartments(parameters, measurements)
  const initialTime = MAX_WAVEFORM_SECONDS
  const waveforms: HemodynamicWaveformSample[] = []
  for (let time = 0; time <= initialTime; time += HEMODYNAMIC_FIXED_STEP_SECONDS) {
    compartments = advanceWindkesselCompartments(compartments, parameters, measurements, time)
    waveforms.push(generateWaveformSample(time, measurements, parameters, measurementSystem, seed))
  }
  const position = definition.initialCatheterPosition ?? 'pa'
  const openingEpisode: PhysiologicalEpisode = {
    index: 0,
    startedAtSeconds: initialTime,
    cause: { kind: 'case-opened' },
  }
  return {
    schemaVersion: 1,
    caseDefinition: definition,
    caseId: definition.id,
    sessionId: hemodynamicSessionId(definition.id, mode, seed, sessionOrdinal),
    physiologicalEpisode: openingEpisode,
    physiologicalEpisodes: [openingEpisode],
    mode,
    workspace: 'pac-skills',
    phase: 'observe',
    seed,
    timeSeconds: initialTime,
    paused: false,
    frozen: false,
    sweepSeconds: 6,
    pressureScaleMmHg: 160,
    showPressureVolumeLoops: false,
    baselineParameters: { ...parameters },
    parameters,
    compartments,
    measurementSystem,
    catheter: {
      position,
      targetPosition: null,
      movementStartedAt: null,
      movementCompletesAt: null,
      insertionDepthCm: catheterDepth[position],
      floatBalloonInflated: false,
      balloonInflated: false,
      wedgeStartedAt: null,
      wedgeCaptureReady: false,
      wedgeCursorTime: null,
      storedWedgeMmHg: null,
      storedAtEndExpiration: false,
      forcedSafetyRecovery: false,
      wedgeCursor: null,
      storedWedge: null,
      wedgeEpisodeCount: 0,
    },
    measurements,
    waveforms,
    activeEffects: [],
    completedInterventionIds: [],
    selectedMechanismId: mode === 'learn' ? definition.correctMechanismId : '',
    selectedPriorityId: mode === 'learn' ? definition.correctPriorityId : '',
    predictionCommitted: mode === 'learn',
    reassessed: false,
    thermodilutionTrials: [],
    alarms: alarmsFor(measurements, false, false),
    criticalErrors: [],
    signalValidationChecks: [],
    responseMessage: null,
    score: null,
    completed: false,
  }
}

/**
 * Start a new physiological episode. Measurements acquired from here on belong to it; nothing
 * acquired before it is relabelled.
 */
export function withNewPhysiologicalEpisode(
  state: HemodynamicSimulationState,
  startedAtSeconds: number,
  cause: PhysiologicalEpisode['cause'],
): HemodynamicSimulationState {
  const episode: PhysiologicalEpisode = {
    index: state.physiologicalEpisode.index + 1,
    startedAtSeconds,
    cause,
  }
  return {
    ...state,
    physiologicalEpisode: episode,
    physiologicalEpisodes: [...state.physiologicalEpisodes, episode],
  }
}

/** A transient effect the model itself begins to withdraw inside this step. */
function waningEffectsBetween(
  state: HemodynamicSimulationState,
  from: number,
  to: number,
): readonly ParameterEffect[] {
  return state.activeEffects.filter((effect) => {
    const waning = effectWaningStartsAt(effect)
    return waning !== null && waning > from && waning <= to
  })
}

function interventionLabel(state: HemodynamicSimulationState, interventionId: string): string {
  return (
    state.caseDefinition.interventions.find((item) => item.id === interventionId)?.shortLabel ??
    interventionId
  )
}

function advanceOneStep(state: HemodynamicSimulationState): HemodynamicSimulationState {
  const nextTime = roundTo(state.timeSeconds + HEMODYNAMIC_FIXED_STEP_SECONDS, 4)
  const parameters = deriveEffectiveCirculationParameters(
    state.baselineParameters,
    state.activeEffects,
    nextTime,
  )
  const measurements = deriveHemodynamicMeasurements(parameters, state.measurementSystem)
  const currentCompartments =
    state.compartments ?? createInitialCirculationCompartments(state.parameters, state.measurements)
  const compartments = advanceWindkesselCompartments(
    currentCompartments,
    parameters,
    measurements,
    nextTime,
  )
  let catheter = state.catheter
  let criticalErrors = state.criticalErrors
  let responseMessage = state.responseMessage
  if (
    catheter.targetPosition !== null &&
    catheter.movementCompletesAt !== null &&
    nextTime >= catheter.movementCompletesAt
  ) {
    const arrived = catheter.targetPosition
    catheter = {
      ...catheter,
      position: arrived,
      targetPosition: null,
      movementStartedAt: null,
      movementCompletesAt: null,
      insertionDepthCm: catheterDepth[arrived],
      floatBalloonInflated: arrived === 'pa' ? false : catheter.floatBalloonInflated,
    }
    responseMessage = `Catheter reached ${arrived.toUpperCase()}. Confirm the destination waveform before advancing again.`
  }
  if (catheter.balloonInflated && catheter.wedgeStartedAt !== null) {
    const wedgeElapsed = nextTime - catheter.wedgeStartedAt
    if (wedgeElapsed >= WEDGE_AUTO_DEFLATION_SECONDS) {
      catheter = {
        ...catheter,
        position: 'pa',
        targetPosition: null,
        movementStartedAt: null,
        movementCompletesAt: null,
        insertionDepthCm: catheterDepth.pa,
        floatBalloonInflated: false,
        balloonInflated: false,
        wedgeStartedAt: null,
        wedgeCaptureReady: false,
        wedgeCursorTime: null,
        wedgeCursor: null,
        storedAtEndExpiration: catheter.storedWedgeMmHg !== null && catheter.storedAtEndExpiration,
        forcedSafetyRecovery: true,
      }
      criticalErrors = [...new Set([...criticalErrors, 'wedge-prolonged-inflation'])]
      // The cutoff itself is unchanged; only how it is described to the learner is. Naming it a
      // "10-second inflation limit" asserted a clinical rule that no source in this module supplies
      // and that the advancement prebrief explicitly lists as not covered here. It is a simulator
      // rail, and the message no longer claims the pulmonary-artery waveform came back either —
      // that is the learner's observation to make.
      responseMessage =
        'Safety recovery: this simulation ended the occlusion at its own fixed cutoff and recorded a safety event. That cutoff belongs to the simulation, not to any catheter — inflation time and volume come from the manufacturer’s instructions for the catheter in use and your local protocol. Confirm for yourself whether the pulmonary-artery waveform has returned.'
    } else if (
      wedgeElapsed >= wedgeCaptureDelaySeconds(parameters.respiratoryRateBpm) &&
      !catheter.wedgeCaptureReady
    ) {
      catheter = { ...catheter, wedgeCaptureReady: true }
    }
  }
  const nextSample = generateWaveformSample(
    nextTime,
    measurements,
    parameters,
    state.measurementSystem,
    state.seed,
  )
  const minimumTime = nextTime - MAX_WAVEFORM_SECONDS
  const waveforms = state.frozen
    ? state.waveforms
    : [...state.waveforms, nextSample].filter((sample) => sample.time >= minimumTime)
  // A scheduled change of the model's own: a transient effect starts to wane. Measurements taken
  // after it describe different physiology from those taken while the effect was building — unless
  // the model's bounds already absorb the effect from here on, in which case its waning changes
  // nothing and is not a boundary (HD-PRE-REVIEW-02 sanity repair, blocker 2).
  let episodeState: HemodynamicSimulationState = state
  for (const effect of waningEffectsBetween(state, state.timeSeconds, nextTime)) {
    const waning = effectWaningStartsAt(effect) ?? nextTime
    const others = state.activeEffects.filter((candidate) => candidate !== effect)
    if (!effectCanChangeEffectiveParameters(state.baselineParameters, others, effect, waning)) {
      continue
    }
    episodeState = withNewPhysiologicalEpisode(episodeState, roundTo(waning, 4), {
      kind: 'effect-waning',
      interventionId: effect.interventionId,
      label: interventionLabel(state, effect.interventionId),
    })
  }
  return {
    ...episodeState,
    timeSeconds: nextTime,
    parameters,
    compartments,
    measurements,
    catheter,
    criticalErrors,
    waveforms,
    alarms: alarmsFor(measurements, catheter.balloonInflated, catheter.forcedSafetyRecovery),
    responseMessage,
  }
}

export function advanceHemodynamicSimulation(
  state: HemodynamicSimulationState,
  elapsedSeconds: number,
): HemodynamicSimulationState {
  if (state.paused || elapsedSeconds <= 0) return state
  const stepCount = Math.max(0, Math.round(elapsedSeconds / HEMODYNAMIC_FIXED_STEP_SECONDS))
  let next = state
  for (let step = 0; step < stepCount; step += 1) next = advanceOneStep(next)
  return next
}

export function catheterPositionDepth(position: CatheterPosition): number {
  return catheterDepth[position]
}
