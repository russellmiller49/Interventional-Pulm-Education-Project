import { clamp, roundTo } from './calculations'
import {
  advanceWindkesselCompartments,
  createInitialCirculationCompartments,
  HEMODYNAMIC_FIXED_STEP_SECONDS,
} from '@/features/hemodynamics-core'
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
  CirculationCompartmentState,
  CirculationParameters,
  HemodynamicAlarm,
  HemodynamicCaseDefinition,
  HemodynamicLearningMode,
  HemodynamicMeasurements,
  HemodynamicSimulationState,
  HemodynamicWaveformSample,
  MeasurementSystemState,
  ParameterEffect,
} from './types'

const MAX_WAVEFORM_SECONDS = 12

export const defaultMeasurementSystem: MeasurementSystemState = {
  zeroed: false,
  transducerLevelCm: 0,
  dampingRatio: 0.65,
  naturalFrequencyHz: 18,
  noiseAmplitudeMmHg: 0.12,
  artifact: 'none',
  fastFlushActiveUntil: null,
  lastFastFlushFinding: null,
}

const catheterDepth: Record<CatheterPosition, number> = {
  introducer: 12,
  ra: 25,
  rv: 35,
  pa: 45,
  wedge: 50,
}

function gaussian(value: number, center: number, width: number): number {
  const normalized = (value - center) / width
  return Math.exp(-0.5 * normalized * normalized)
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
  let artSystolic = mapTrue + artPulsePressure * 0.67
  let artDiastolic = mapTrue - artPulsePressure * 0.33
  let papSystolic = meanPapTrue + paPulsePressure * 0.67
  let papDiastolic = meanPapTrue - paPulsePressure * 0.33

  if (measurementSystem.artifact === 'overdamped' || measurementSystem.dampingRatio > 0.95) {
    artSystolic = mapTrue + (artSystolic - mapTrue) * 0.55
    artDiastolic = mapTrue + (artDiastolic - mapTrue) * 0.55
    papSystolic = meanPapTrue + (papSystolic - meanPapTrue) * 0.6
    papDiastolic = meanPapTrue + (papDiastolic - meanPapTrue) * 0.6
  } else if (measurementSystem.artifact === 'underdamped' || measurementSystem.dampingRatio < 0.4) {
    artSystolic = mapTrue + (artSystolic - mapTrue) * 1.35
    artDiastolic = mapTrue + (artDiastolic - mapTrue) * 1.2
    papSystolic = meanPapTrue + (papSystolic - meanPapTrue) * 1.25
    papDiastolic = meanPapTrue + (papDiastolic - meanPapTrue) * 1.15
  }

  const hydrostaticOffset = -measurementSystem.transducerLevelCm * 0.74
  const zeroOffset = measurementSystem.zeroed ? 0 : 5
  const offset = hydrostaticOffset + zeroOffset
  const displayedPawp =
    measurementSystem.artifact === 'false-wedge' ? meanPapTrue + 2 : pawpTrue + offset
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
    rvSystolicMmHg: roundTo(papSystolic + 3 + offset, 0),
    rvDiastolicMmHg: roundTo(Math.max(0, rapTrue - 2) + offset, 0),
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
  if (phase < 0.16) return Math.sin((phase / 0.16) * (Math.PI / 2))
  if (phase < 0.4) return 1 - ((phase - 0.16) / 0.24) * 0.34
  const tail = 0.66 * Math.exp(-3.1 * (phase - 0.4))
  const notch = gaussian(phase, 0.46, 0.018) * 0.11
  return Math.max(0.06, tail - notch)
}

function pressureTransfer(
  value: number,
  mean: number,
  measurementSystem: MeasurementSystemState,
  time: number,
  channelSalt: number,
  seed: number,
): number {
  if (
    measurementSystem.fastFlushActiveUntil !== null &&
    time <= measurementSystem.fastFlushActiveUntil
  ) {
    return 280
  }
  const hydrostaticOffset = -measurementSystem.transducerLevelCm * 0.74
  const zeroOffset = measurementSystem.zeroed ? 0 : 5
  let gain = 1
  if (measurementSystem.artifact === 'overdamped' || measurementSystem.dampingRatio > 0.95)
    gain = 0.55
  if (measurementSystem.artifact === 'underdamped' || measurementSystem.dampingRatio < 0.4)
    gain = 1.35
  let result = mean + (value - mean) * gain + hydrostaticOffset + zeroOffset
  if (measurementSystem.artifact === 'underdamped' || measurementSystem.dampingRatio < 0.4) {
    result += Math.sin(time * Math.PI * 2 * measurementSystem.naturalFrequencyHz) * 2.4
  }
  if (measurementSystem.artifact === 'catheter-whip') {
    result += gaussian((time * 1.7) % 1, 0.18, 0.025) * 12
  }
  if (measurementSystem.artifact === 'wall-contact') result = mean + hydrostaticOffset + zeroOffset
  const index = Math.round(time / HEMODYNAMIC_FIXED_STEP_SECONDS)
  result += deterministicNoise(seed, index, channelSalt) * measurementSystem.noiseAmplitudeMmHg
  return result
}

function generateWaveformSample(
  time: number,
  measurements: HemodynamicMeasurements,
  parameters: CirculationParameters,
  compartments: CirculationCompartmentState,
  measurementSystem: MeasurementSystemState,
  seed: number,
): HemodynamicWaveformSample {
  const cycleSeconds = 60 / parameters.heartRateBpm
  const cardiacPhase = (((time % cycleSeconds) + cycleSeconds) % cycleSeconds) / cycleSeconds
  const respiratoryCycle = 60 / parameters.respiratoryRateBpm
  const respiratoryPhase =
    (((time % respiratoryCycle) + respiratoryCycle) % respiratoryCycle) / respiratoryCycle
  const pulseShape = arterialShape(cardiacPhase)
  const displayedOffset =
    -measurementSystem.transducerLevelCm * 0.74 + (measurementSystem.zeroed ? 0 : 5)
  const artMean = measurements.mapMmHg - displayedOffset
  const analyticArt =
    measurements.artDiastolicMmHg -
    displayedOffset +
    (measurements.artSystolicMmHg - measurements.artDiastolicMmHg) * pulseShape
  const artTrue =
    analyticArt * 0.78 + (compartments.systemicArterialPressureMmHg - displayedOffset) * 0.22
  const rapTrue = measurements.rapMmHg - displayedOffset
  const cvpTrue =
    rapTrue +
    gaussian(cardiacPhase, 0.06, 0.045) * 2.1 -
    gaussian(cardiacPhase, 0.25, 0.08) * 1.5 +
    gaussian(cardiacPhase, 0.72, 0.11) * 2.5 -
    gaussian(cardiacPhase, 0.9, 0.07) * 1.7 +
    Math.sin(respiratoryPhase * Math.PI * 2) * parameters.pleuralPressureSwingMmHg * 0.35
  const rvPulse =
    cardiacPhase > 0.05 && cardiacPhase < 0.48
      ? Math.sin(((cardiacPhase - 0.05) / 0.43) * Math.PI)
      : 0
  const rvTrue =
    (measurements.rvDiastolicMmHg -
      displayedOffset +
      (measurements.rvSystolicMmHg - measurements.rvDiastolicMmHg) * rvPulse ** 1.3) *
      0.72 +
    compartments.rightVentricularPressureMmHg * 0.28
  const analyticPap =
    measurements.papDiastolicMmHg -
    displayedOffset +
    (measurements.papSystolicMmHg - measurements.papDiastolicMmHg) *
      Math.max(0.08, pulseShape - gaussian(cardiacPhase, 0.48, 0.02) * 0.08)
  const papTrue =
    analyticPap * 0.78 + (compartments.pulmonaryArterialPressureMmHg - displayedOffset) * 0.22
  const wedgeMean = (measurements.pawpMmHg ?? measurements.papDiastolicMmHg) - displayedOffset
  const wedgeTrue =
    wedgeMean +
    gaussian(cardiacPhase, 0.1, 0.075) * 1.3 +
    gaussian(cardiacPhase, 0.77, 0.13) * 2.3 -
    gaussian(cardiacPhase, 0.92, 0.06) * 1.2 +
    Math.sin(respiratoryPhase * Math.PI * 2) * parameters.pleuralPressureSwingMmHg * 0.45
  const qrs = gaussian(cardiacPhase, 0.04, 0.012) * 1.25
  const pWave = gaussian(cardiacPhase, 0.86, 0.035) * 0.18
  const tWave = gaussian(cardiacPhase, 0.34, 0.075) * 0.34
  const ecg = qrs + pWave + tWave - gaussian(cardiacPhase, 0.02, 0.008) * 0.35
  const respiration =
    Math.sin(respiratoryPhase * Math.PI * 2) * parameters.pleuralPressureSwingMmHg -
    parameters.peepCmH2O * 0.08
  const pleth = clamp(pulseShape * 0.88 + Math.sin(respiratoryPhase * Math.PI * 2) * 0.06, 0, 1.2)

  return {
    time,
    ecgMv: ecg,
    artMmHg: pressureTransfer(artTrue, artMean, measurementSystem, time, 3, seed),
    cvpMmHg: pressureTransfer(cvpTrue, rapTrue, measurementSystem, time, 7, seed),
    rvMmHg: pressureTransfer(
      rvTrue,
      (measurements.rvSystolicMmHg + measurements.rvDiastolicMmHg) / 2 - displayedOffset,
      measurementSystem,
      time,
      11,
      seed,
    ),
    papMmHg: pressureTransfer(
      papTrue,
      measurements.meanPapMmHg - displayedOffset,
      measurementSystem,
      time,
      13,
      seed,
    ),
    pcwpMmHg:
      measurementSystem.artifact === 'false-wedge'
        ? pressureTransfer(
            papTrue,
            measurements.meanPapMmHg - displayedOffset,
            measurementSystem,
            time,
            17,
            seed,
          )
        : pressureTransfer(wedgeTrue, wedgeMean, measurementSystem, time, 17, seed),
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
    waveforms.push(
      generateWaveformSample(time, measurements, parameters, compartments, measurementSystem, seed),
    )
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
      insertionDepthCm: catheterDepth[position],
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
  if (catheter.balloonInflated && catheter.wedgeStartedAt !== null) {
    const wedgeElapsed = nextTime - catheter.wedgeStartedAt
    if (wedgeElapsed >= 15) {
      catheter = {
        ...catheter,
        position: 'pa',
        insertionDepthCm: catheterDepth.pa,
        balloonInflated: false,
        wedgeStartedAt: null,
        wedgeCaptureReady: false,
        forcedSafetyRecovery: true,
      }
      criticalErrors = [...new Set([...criticalErrors, 'wedge-prolonged-inflation'])]
    } else if (wedgeElapsed >= 12 && !catheter.wedgeCaptureReady) {
      catheter = { ...catheter, wedgeCaptureReady: true }
    }
  }
  const nextSample = generateWaveformSample(
    nextTime,
    measurements,
    parameters,
    compartments,
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
