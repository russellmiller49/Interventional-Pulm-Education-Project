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
  ventricularPressureShape,
  wedgeAmplitudesFor,
  wedgeDeviationMmHg,
} from './waveformMorphology'
import {
  advanceWindkesselCompartments,
  createInitialCirculationCompartments,
  HEMODYNAMIC_FIXED_STEP_SECONDS,
} from '@/features/hemodynamics-core'
import { PAC_ROUTE_PROGRESS } from '@/features/cardiac-anatomy/content/paths'
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
  HemodynamicLearningMode,
  HemodynamicMeasurements,
  HemodynamicSimulationState,
  HemodynamicWaveformSample,
  FastFlushLineType,
  MeasurementSystemState,
  ParameterEffect,
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
const INSPIRATORY_FRACTION = 0.4

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

function effectScale(effect: ParameterEffect, timeSeconds: number): number {
  const elapsed = Math.max(0, timeSeconds - effect.startedAt)
  const onset = 1 - Math.exp(-elapsed / Math.max(0.1, effect.onsetSeconds))
  if (effect.recoverySeconds === null) return onset
  const recoveryElapsed = Math.max(0, elapsed - Math.max(20, effect.onsetSeconds * 3))
  return onset * Math.exp(-recoveryElapsed / Math.max(0.1, effect.recoverySeconds))
}

export function deriveEffectiveCirculationParameters(
  baseline: CirculationParameters,
  effects: readonly ParameterEffect[],
  timeSeconds: number,
): CirculationParameters {
  const next = { ...baseline }
  for (const effect of effects) {
    const scale = effectScale(effect, timeSeconds)
    for (const [key, delta] of Object.entries(effect.deltas) as [
      keyof CirculationParameters,
      number,
    ][]) {
      next[key] += delta * scale
    }
  }
  next.heartRateBpm = clamp(next.heartRateBpm, 25, 190)
  next.respiratoryRateBpm = clamp(next.respiratoryRateBpm, 4, 45)
  next.circulatingVolumeFraction = clamp(next.circulatingVolumeFraction, 0.45, 1.4)
  next.systemicVascularResistanceDynSecCm5 = clamp(
    next.systemicVascularResistanceDynSecCm5,
    250,
    3200,
  )
  next.pulmonaryVascularResistanceWU = clamp(next.pulmonaryVascularResistanceWU, 0.4, 18)
  next.leftVentricularContractility = clamp(next.leftVentricularContractility, 0.25, 2)
  next.rightVentricularContractility = clamp(next.rightVentricularContractility, 0.2, 2)
  next.leftVentricularCompliance = clamp(next.leftVentricularCompliance, 0.25, 2)
  next.rightVentricularCompliance = clamp(next.rightVentricularCompliance, 0.25, 2)
  next.pericardialPressureMmHg = clamp(next.pericardialPressureMmHg, 0, 28)
  next.peepCmH2O = clamp(next.peepCmH2O, 0, 22)
  return next
}

export function deriveHemodynamicMeasurements(
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
  const rapTrue = clamp(
    parameters.rightAtrialPressureSetPointMmHg +
      volumePressure / parameters.rightVentricularCompliance +
      parameters.pericardialPressureMmHg * 0.72 +
      Math.max(0, parameters.pulmonaryVascularResistanceWU - 2) * 0.48 +
      parameters.peepCmH2O * 0.16,
    0,
    35,
  )
  const pawpTrue = clamp(
    parameters.leftAtrialPressureSetPointMmHg +
      volumePressure / parameters.leftVentricularCompliance +
      parameters.pericardialPressureMmHg * 0.62 +
      Math.max(0, parameters.peepCmH2O - 5) * 0.28,
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
  // The live trace receives the same gain exactly once; see pressureTransfer below.
  const pulsatileGain = pulsatileGainFor(measurementSystem)
  artSystolic = mapTrue + (artSystolic - mapTrue) * pulsatileGain
  artDiastolic = mapTrue + (artDiastolic - mapTrue) * pulsatileGain
  papSystolic = meanPapTrue + (papSystolic - meanPapTrue) * pulsatileGain
  papDiastolic = meanPapTrue + (papDiastolic - meanPapTrue) * pulsatileGain

  const hydrostaticOffset = -measurementSystem.transducerLevelCm * 0.74
  const zeroOffset = measurementSystem.zeroed ? 0 : 5
  const offset = hydrostaticOffset + zeroOffset
  const displayedPawp =
    measurementSystem.artifact === 'false-wedge' ? meanPapTrue + 2 + offset : pawpTrue + offset
  const pulseVariation = clamp(
    4 + parameters.fluidResponsiveness * 13 + Math.abs(parameters.pleuralPressureSwingMmHg) * 0.7,
    2,
    28,
  )

  return {
    heartRateBpm: roundTo(parameters.heartRateBpm, 0),
    spo2Percent: roundTo(parameters.arterialOxygenSaturationPercent, 0),
    artSystolicMmHg: roundTo(artSystolic + offset, 0),
    artDiastolicMmHg: roundTo(artDiastolic + offset, 0),
    mapMmHg: roundTo(mapTrue + offset, 0),
    rapMmHg: roundTo(rapTrue + offset, 0),
    // No systolic pressure difference exists between the right ventricle and the pulmonary
    // artery unless there is pulmonic valvular or pulmonary artery stenosis.
    rvSystolicMmHg: roundTo(papSystolic + offset, 0),
    // Right ventricular end-diastolic pressure sits within a few mmHg of right atrial pressure.
    rvDiastolicMmHg: roundTo(Math.max(0, rapTrue - 1) + offset, 0),
    papSystolicMmHg: roundTo(papSystolic + offset, 0),
    papDiastolicMmHg: roundTo(papDiastolic + offset, 0),
    meanPapMmHg: roundTo(meanPapTrue + offset, 0),
    pawpMmHg: roundTo(displayedPawp, 0),
    cardiacOutputLMin: roundTo(flow, 1),
    cardiacIndexLMinM2: roundTo(flow / parameters.bodySurfaceAreaM2, 1),
    svo2Percent: roundTo(
      clamp(parameters.mixedVenousOxygenSaturationPercent + (flow - 5) * 2.4, 35, 85),
      0,
    ),
    pulsePressureMaxMmHg: roundTo(artPulsePressure * (1 + pulseVariation / 200), 1),
    pulsePressureMinMmHg: roundTo(artPulsePressure * (1 - pulseVariation / 200), 1),
  }
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
  const hydrostaticOffset = -measurementSystem.transducerLevelCm * 0.74
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
    -measurementSystem.transducerLevelCm * 0.74 + (measurementSystem.zeroed ? 0 : 5)
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
    artMmHg: pressureTransfer(artTrue, artMean, measurementSystem, time, 3, seed, {
      cardiacPhase,
      pulsePressureMmHg: artPulsePressure,
      gainAlreadyApplied: true,
      fastFlushLineType: 'systemic-arterial',
    }),
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
  return [
    {
      id: 'low-map',
      label: 'ART MAP LOW',
      priority: measurements.mapMmHg < 55 ? 'critical' : 'warning',
      active: measurements.mapMmHg < 65,
      acknowledged: false,
    },
    {
      id: 'low-ci',
      label: 'CARDIAC INDEX LOW',
      priority: measurements.cardiacIndexLMinM2 < 1.8 ? 'critical' : 'warning',
      active: measurements.cardiacIndexLMinM2 < 2.2,
      acknowledged: false,
    },
    {
      id: 'high-pap',
      label: 'PAP HIGH',
      priority: 'warning',
      active: measurements.meanPapMmHg > 25,
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

export function createInitialHemodynamicState(
  definition: HemodynamicCaseDefinition,
  mode: HemodynamicLearningMode = 'learn',
  seed = 417,
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
  return {
    schemaVersion: 1,
    caseDefinition: definition,
    caseId: definition.id,
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
        storedAtEndExpiration: catheter.storedWedgeMmHg !== null,
        forcedSafetyRecovery: true,
      }
      criticalErrors = [...new Set([...criticalErrors, 'wedge-prolonged-inflation'])]
      responseMessage =
        'Safety recovery: the 10-second inflation limit was reached, so the balloon was auto-deflated and the PA waveform was restored.'
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
  return {
    ...state,
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
