import { mechanicalVentilationCaseById, mechanicalVentilationCases } from '../content/runtimeCases'
import {
  adaptInitialSettingsForDevice,
  createDefaultMechanicalVentilationSettings,
  defaultVentilatorDeviceId,
} from '../content/deviceProfiles'
import { cloneMechanicalVentilationSettings, isSimvMode, isTwoLevelMode } from './modes'
import {
  clamp,
  effectiveBaselinePressureCmH2O,
  effectivePressureAboveBaselineCmH2O,
  deriveEffectivePatient,
  deriveMeasurements,
  equationOfMotionPressure,
  hasPerformedEffect,
  isCaseResolved,
  MAX_TREND_SAMPLES,
  MAX_WAVEFORM_SAMPLES,
  moveTowardExp,
  passiveExpiratoryFlowLps,
  round,
  targetTidalVolumeMl,
  usesPressureTargetedDelivery,
  WAVEFORM_STEP_SECONDS,
} from './physics'
import type {
  AlarmEvent,
  CaseOutcome,
  MechanicalVentilationSettings,
  InterventionDefinition,
  LearningExperience,
  PatientModelState,
  RiskState,
  VentilationCaseDefinition,
  VentilationSimulationState,
  VentilatorDeviceId,
  VentilatorMeasurements,
  WaveformSample,
} from './types'

export const SIMULATION_VERSION = 1 as const
export const DEFAULT_CASE_ID = 'MV-01'

const emptyMeasurements: VentilatorMeasurements = {
  peakPressureCmH2O: 0,
  plateauPressureCmH2O: 0,
  meanAirwayPressureCmH2O: 0,
  exhaledVtMl: 0,
  minuteVentilationLMin: 0,
  totalRatePerMin: 0,
  observedPatientRatePerMin: 0,
  staticComplianceMlCmH2O: 0,
  intrinsicPeepCmH2O: 0,
  expiratoryFlowAtNextBreathLMin: 0,
  triggerDelayMs: 0,
  mechanicalInspiratoryTimeSeconds: 0,
  stackedVolumeMl: 0,
  ineffectiveEffortFraction: 0,
  autotriggerFraction: 0,
  pressureOvershootCmH2O: 0,
}

const emptyRisk: RiskState = {
  highPlateau: 0,
  stackedVolume: 0,
  dynamicHyperinflation: 0,
  hypoxemia: 0,
  hypotension: 0,
  excessiveSedation: 0,
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function clonePatient(patient: PatientModelState): PatientModelState {
  return {
    mechanics: { ...patient.mechanics },
    drive: { ...patient.drive },
    gasExchange: { ...patient.gasExchange },
    hemodynamics: { ...patient.hemodynamics },
    human: { ...patient.human },
    airway: { ...patient.airway },
  }
}

function configureBranch(
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  branch: string,
): PatientModelState {
  const next = clonePatient(patient)
  if (definition.phenotype === 'autotriggering') {
    next.airway.condensate = branch === 'condensate'
    next.airway.circuitLeak = branch === 'leak'
    next.mechanics.airwayLeakFraction = branch === 'leak' ? 0.12 : 0
  }
  if (definition.phenotype === 'high-resistance') {
    next.airway.secretions = branch === 'secretions'
    next.airway.hmeObstructed = branch === 'hme-or-ett'
    next.airway.ettObstructed = branch === 'hme-or-ett'
    next.airway.bronchospasm = branch === 'bronchospasm'
    next.mechanics.resistanceCmH2OPerLps = branch === 'bronchospasm' ? 30 : 26
  }
  if (definition.phenotype === 'tension-pneumothorax' && branch === 'stable') {
    next.hemodynamics.systolicMmHg = 92
    next.hemodynamics.diastolicMmHg = 54
    next.hemodynamics.mapMmHg = 67
  }
  return next
}

function baseState(
  definition: VentilationCaseDefinition,
  experience: LearningExperience,
  attempt: number,
  deviceId: VentilatorDeviceId,
): VentilationSimulationState {
  const seed = hashSeed(`${definition.id}:${experience}:${attempt}`)
  const branch = definition.branchOptions[seed % definition.branchOptions.length]
  const patient = configureBranch(definition, definition.initialPatient, branch)
  const state: VentilationSimulationState = {
    version: SIMULATION_VERSION,
    deviceId,
    caseId: definition.id,
    experience,
    challengeMode: 'untimed',
    phase: experience === 'learn' ? 'act' : 'observe',
    simulationTime: 0,
    speed: 1,
    paused: true,
    seed,
    branch,
    showEducatorOverlay: experience === 'learn',
    ventilator: {
      screen: 'main',
      settings: cloneMechanicalVentilationSettings(
        adaptInitialSettingsForDevice(definition.initialSettings, deviceId),
      ),
      pendingMode: null,
      locked: false,
      frozen: false,
      alarmAudioEnabled: false,
      audioPausedUntil: null,
      oxygenEnrichmentUntil: null,
      holdType: null,
      holdUntil: null,
      manualBreathUntil: null,
    },
    patient,
    measurements: emptyMeasurements,
    waveforms: [],
    trends: [],
    alarms: [],
    alarmHistory: [],
    interventions: [],
    prediction: {
      committed: experience === 'learn',
      mechanismId: null,
      priorityId: null,
      responseId: null,
    },
    reassessment: { committed: false, actionIds: [] },
    hintsUsed: 0,
    risk: { ...emptyRisk },
    criticalErrors: [],
    lastResponse: null,
    lastAbgAt: null,
  }
  return { ...state, measurements: deriveMeasurements(state, definition, patient) }
}

export function createInitialSimulationState(
  caseId = DEFAULT_CASE_ID,
  experience: LearningExperience = 'learn',
  attempt = 1,
  deviceId: VentilatorDeviceId = defaultVentilatorDeviceId,
): VentilationSimulationState {
  const definition = mechanicalVentilationCaseById.get(caseId) ?? mechanicalVentilationCases[0]
  const initial = baseState(definition, experience, attempt, deviceId)
  const primed = advanceSimulation({ ...initial, paused: false }, 4, definition)
  return {
    ...primed,
    simulationTime: 0,
    paused: true,
    patient: { ...initial.patient, mechanics: { ...primed.patient.mechanics } },
    trends: [],
    risk: { ...emptyRisk },
    criticalErrors: [],
    waveforms: primed.waveforms.map((sample) => ({ ...sample, time: sample.time - 4 })),
  }
}

function flowProfile(
  settings: Extract<MechanicalVentilationSettings, { mode: 'volume-ac' }>,
  phase: number,
  ti: number,
) {
  const normalized = clamp(phase / Math.max(0.01, ti), 0, 1)
  const peak = settings.peakFlowLMin / 60
  if (settings.flowPattern === 'sine') return peak * Math.sin(Math.PI * normalized)
  if (settings.flowPattern === 'decelerating-100') return peak * (1 - normalized)
  if (settings.flowPattern === 'decelerating-50') return peak * (1 - normalized * 0.5)
  return peak
}

function effortAt(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  time: number,
): number {
  const neuralPeriod = 60 / Math.max(1, patient.drive.neuralRatePerMin)
  let phase = time % neuralPeriod
  if (definition.phenotype === 'reverse-triggering') {
    const machineRate =
      state.ventilator.settings.mode === 'pressure-support'
        ? patient.drive.neuralRatePerMin
        : state.ventilator.settings.ratePerMin
    const machinePeriod = 60 / Math.max(1, machineRate)
    phase =
      ((time % machinePeriod) -
        (patient.drive.reverseTriggerDelaySeconds ?? 0.35) +
        machinePeriod) %
      machinePeriod
  }
  if (definition.phenotype === 'autotriggering' && state.measurements.autotriggerFraction > 0.2) {
    return 0
  }
  if (phase > patient.drive.neuralInspiratoryTimeSeconds) return 0
  const normalized = phase / Math.max(0.1, patient.drive.neuralInspiratoryTimeSeconds)
  return patient.drive.effortAmplitudeCmH2O * Math.sin(Math.PI * normalized)
}

function machineTiming(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
  time: number,
): { inspiration: boolean; phase: number; triggered: boolean; spontaneous: boolean } {
  if (isTwoLevelMode(state.ventilator.settings.deviceMode)) {
    const settings = state.ventilator.settings
    const period = Math.max(0.3, settings.advanced.tHighSeconds + settings.advanced.tLowSeconds)
    const phase = time % period
    return {
      inspiration: phase < settings.advanced.tHighSeconds,
      phase,
      triggered: phase < WAVEFORM_STEP_SECONDS * 1.5,
      spontaneous: false,
    }
  }
  let rate = Math.max(1, measurements.totalRatePerMin)
  if (definition.phenotype === 'double-triggering') rate = patient.drive.neuralRatePerMin
  const period = 60 / rate
  const phase = time % period
  const settings = state.ventilator.settings
  let spontaneous = false
  if (
    isSimvMode(settings.deviceMode) &&
    settings.mode !== 'pressure-support' &&
    rate > settings.ratePerMin + 0.5
  ) {
    const breathIndex = Math.floor(time / period)
    const mandatoryFraction = clamp(settings.ratePerMin / rate, 0, 1)
    const mandatoryBefore = Math.floor((breathIndex + 1) * mandatoryFraction)
    const mandatoryAfter = Math.floor((breathIndex + 2) * mandatoryFraction)
    spontaneous = mandatoryAfter === mandatoryBefore
  }
  const spontaneousTi = spontaneous
    ? clamp(
        -Math.max(
          0.08,
          (patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps) *
            patient.mechanics.complianceLPerCmH2O,
        ) *
          Math.log(clamp(settings.advanced.spontaneousCyclePercent / 100, 0.05, 0.8)) +
          settings.advanced.spontaneousRampMs / 2000,
        0.2,
        3,
      )
    : measurements.mechanicalInspiratoryTimeSeconds
  let inspiration = phase < spontaneousTi
  if (definition.phenotype === 'double-triggering') {
    const gap = 0.12
    const secondStart = measurements.mechanicalInspiratoryTimeSeconds + gap
    const mismatch =
      patient.drive.neuralInspiratoryTimeSeconds - measurements.mechanicalInspiratoryTimeSeconds
    inspiration =
      phase < measurements.mechanicalInspiratoryTimeSeconds ||
      (mismatch > 0.15 &&
        phase >= secondStart &&
        phase < secondStart + measurements.mechanicalInspiratoryTimeSeconds)
  }
  if (state.ventilator.manualBreathUntil && state.ventilator.manualBreathUntil > time) {
    inspiration = true
    spontaneous = false
  }
  return {
    inspiration,
    phase,
    triggered: phase < WAVEFORM_STEP_SECONDS * 1.5,
    spontaneous,
  }
}

function nextWaveformSample(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
  time: number,
  volumeL: number,
): { sample: WaveformSample; volumeL: number } {
  const settings = state.ventilator.settings
  const timing = machineTiming(state, definition, patient, measurements, time)
  const effort = effortAt(state, definition, patient, time)
  const holdActive = state.ventilator.holdUntil !== null && state.ventilator.holdUntil > time
  const pressureTargeted = usesPressureTargetedDelivery(settings)
  const baselinePressure = effectiveBaselinePressureCmH2O(settings)
  const pressureAboveBaseline = effectivePressureAboveBaselineCmH2O(
    settings,
    patient,
    definition.predictedBodyWeightKg,
  )
  const breathPressureAboveBaseline = timing.spontaneous
    ? settings.advanced.spontaneousPressureSupportCmH2O
    : pressureAboveBaseline
  const pressureTargetedBreath = pressureTargeted || timing.spontaneous
  let flowLps = 0
  if (!holdActive && timing.inspiration) {
    if (settings.mode === 'volume-ac' && !pressureTargetedBreath) {
      flowLps = flowProfile(settings, timing.phase, measurements.mechanicalInspiratoryTimeSeconds)
      const targetVolume =
        targetTidalVolumeMl(settings, patient, definition.predictedBodyWeightKg) / 1000 +
        patient.mechanics.endExpiratoryVolumeL
      if (volumeL >= targetVolume) flowLps = 0
    } else {
      const pRampMs = Math.max(
        10,
        isTwoLevelMode(settings.deviceMode)
          ? 50
          : timing.spontaneous
            ? settings.advanced.spontaneousRampMs
            : settings.mode === 'volume-ac'
              ? 70
              : settings.pRampMs,
      )
      const targetPressure =
        baselinePressure +
        breathPressureAboveBaseline * (1 - Math.exp(-timing.phase / (pRampMs / 1000)))
      const resistance =
        patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps
      flowLps =
        (targetPressure +
          effort -
          baselinePressure -
          volumeL / Math.max(0.005, patient.mechanics.complianceLPerCmH2O)) /
        Math.max(2, resistance)
      flowLps = clamp(flowLps, 0, 3)
    }
  } else if (!holdActive) {
    flowLps = passiveExpiratoryFlowLps(
      volumeL,
      patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps,
      patient.mechanics.complianceLPerCmH2O,
    )
  }

  if (
    definition.phenotype === 'autotriggering' &&
    state.branch === 'cardiogenic-oscillation' &&
    !timing.inspiration
  ) {
    flowLps += Math.sin(time * Math.PI * 3) * 0.012
  }
  let nextVolume = clamp(volumeL + flowLps * WAVEFORM_STEP_SECONDS, 0, 2)
  if (holdActive && state.ventilator.holdType === 'expiratory')
    nextVolume = Math.min(nextVolume, 0.03)
  let paw = equationOfMotionPressure({
    peepCmH2O: baselinePressure,
    intrinsicPeepCmH2O: measurements.intrinsicPeepCmH2O,
    resistanceCmH2OPerLps:
      patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps,
    flowLps,
    volumeL: nextVolume,
    complianceLPerCmH2O: patient.mechanics.complianceLPerCmH2O,
    inspiratoryEffortCmH2O: effort,
  })
  if (pressureTargetedBreath && timing.inspiration) {
    paw = Math.min(
      paw,
      baselinePressure + breathPressureAboveBaseline + measurements.pressureOvershootCmH2O,
    )
  }
  if (
    definition.phenotype === 'high-resistance' &&
    state.branch === 'secretions' &&
    patient.airway.secretions
  ) {
    paw += Math.sin(time * 40) * 1.8
  }
  return {
    sample: {
      time,
      pawCmH2O: round(clamp(paw, -5, 80), 2),
      flowLMin: round(flowLps * 60, 2),
      volumeMl: round(nextVolume * 1000, 1),
      pmusCmH2O: round(-effort, 2),
      phase: timing.inspiration ? 'inspiration' : 'expiration',
      triggered: timing.triggered,
    },
    volumeL: nextVolume,
  }
}

function baselineMinuteVentilation(definition: VentilationCaseDefinition): number {
  const settings = definition.initialSettings
  if (settings.mode === 'volume-ac') {
    return (
      (settings.vtMl / 1000) *
      Math.max(settings.ratePerMin, definition.initialPatient.drive.neuralRatePerMin)
    )
  }
  const drivingPressure =
    settings.mode === 'pressure-ac'
      ? settings.deltaPControlCmH2O
      : settings.pressureSupportCmH2O + definition.initialPatient.drive.effortAmplitudeCmH2O * 0.35
  const vt = drivingPressure * definition.initialPatient.mechanics.complianceLPerCmH2O
  const rate =
    settings.mode === 'pressure-ac'
      ? Math.max(settings.ratePerMin, definition.initialPatient.drive.neuralRatePerMin)
      : definition.initialPatient.drive.neuralRatePerMin
  return Math.max(1, vt * rate)
}

function spo2FromPaO2(paO2: number): number {
  const exponent = 2.7
  const numerator = paO2 ** exponent
  return clamp((100 * numerator) / (numerator + 26.8 ** exponent), 50, 100)
}

function updateSlowPhysiology(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
  deltaSeconds: number,
): PatientModelState {
  const next = clonePatient(patient)
  const settings = state.ventilator.settings
  const baselineMv = baselineMinuteVentilation(definition)
  const targetPaCO2 = clamp(
    definition.initialPatient.gasExchange.paCO2MmHg *
      (baselineMv / Math.max(0.8, measurements.minuteVentilationLMin)),
    20,
    110,
  )
  next.gasExchange.paCO2MmHg = moveTowardExp(
    state.patient.gasExchange.paCO2MmHg,
    targetPaCO2,
    deltaSeconds,
    180,
  )
  next.gasExchange.pH = clamp(
    6.1 +
      Math.log10(
        next.gasExchange.bicarbonateMmolL / (0.03 * Math.max(10, next.gasExchange.paCO2MmHg)),
      ),
    6.7,
    7.75,
  )

  let oxygenPercent =
    state.ventilator.oxygenEnrichmentUntil &&
    state.ventilator.oxygenEnrichmentUntil > state.simulationTime
      ? 100
      : settings.oxygenPercent
  let effectivePeepCmH2O = settings.peepCmH2O
  if (
    settings.deviceMode === 'intellivent-asv' &&
    settings.advanced.automaticOxygenationController &&
    oxygenPercent < 100
  ) {
    const lowTarget = settings.advanced.targetSpO2LowPercent
    const oxygenationGap =
      next.gasExchange.spo2Percent < lowTarget
        ? lowTarget - next.gasExchange.spo2Percent
        : Math.min(0, lowTarget + 3 - next.gasExchange.spo2Percent)
    oxygenPercent = clamp(oxygenPercent + oxygenationGap * 3, 21, 100)
    effectivePeepCmH2O = clamp(settings.peepCmH2O + oxygenationGap * 0.5, 0, 18)
  }
  const recruitmentBonus = effectivePeepCmH2O <= 12 ? effectivePeepCmH2O * 2 : 20
  const targetPaO2 = clamp(
    35 + (oxygenPercent - 21) * 2.2 + recruitmentBonus - next.gasExchange.shuntFraction * 180,
    35,
    500,
  )
  next.gasExchange.paO2MmHg = moveTowardExp(
    state.patient.gasExchange.paO2MmHg,
    targetPaO2,
    deltaSeconds,
    45,
  )
  next.gasExchange.spo2Percent = moveTowardExp(
    state.patient.gasExchange.spo2Percent,
    spo2FromPaO2(next.gasExchange.paO2MmHg),
    deltaSeconds,
    15,
  )

  let targetMap = definition.initialPatient.hemodynamics.mapMmHg
  targetMap -=
    Math.max(0, measurements.intrinsicPeepCmH2O - 5) *
    (definition.phenotype === 'asthma-obstructive-shock' ? 2.4 : 1.1)
  targetMap -= Math.max(0, measurements.meanAirwayPressureCmH2O - 18) * 0.8
  if (definition.phenotype === 'ards-recruitment' && settings.peepCmH2O >= 14) targetMap -= 15
  if (
    definition.phenotype === 'asthma-obstructive-shock' &&
    hasPerformedEffect(state, definition, 'disconnect-bag')
  ) {
    targetMap = Math.max(targetMap, 72)
  }
  if (next.hemodynamics.obstructiveShock) targetMap = Math.min(targetMap, 42)
  if (isCaseResolved({ ...state, patient: next, measurements }, definition)) {
    targetMap = Math.max(targetMap, 68)
  }
  next.hemodynamics.mapMmHg = moveTowardExp(
    state.patient.hemodynamics.mapMmHg,
    clamp(targetMap, 25, 110),
    deltaSeconds,
    18,
  )
  next.hemodynamics.systolicMmHg = round(next.hemodynamics.mapMmHg * 1.5, 0)
  next.hemodynamics.diastolicMmHg = round(next.hemodynamics.mapMmHg * 0.75, 0)

  const triggerBurden =
    measurements.ineffectiveEffortFraction * 4 + measurements.autotriggerFraction * 2
  const cyclingBurden = Math.min(
    4,
    Math.abs(
      measurements.mechanicalInspiratoryTimeSeconds - next.drive.neuralInspiratoryTimeSeconds,
    ) * 4,
  )
  const assistBurden =
    settings.mode === 'pressure-support' ? Math.abs(settings.pressureSupportCmH2O - 11) * 0.22 : 0
  let targetDyspnea = clamp(
    next.human.painScore * 0.35 +
      next.human.anxietyScore * 0.25 +
      triggerBurden +
      cyclingBurden +
      assistBurden,
    0,
    10,
  )
  if (isCaseResolved({ ...state, patient: next, measurements }, definition)) targetDyspnea -= 2
  if (next.human.sedationScore <= -4) targetDyspnea = Math.min(targetDyspnea, 2)
  next.human.dyspneaScore = moveTowardExp(
    state.patient.human.dyspneaScore,
    clamp(targetDyspnea, 0, 10),
    deltaSeconds,
    30,
  )
  next.hemodynamics.heartRatePerMin = moveTowardExp(
    state.patient.hemodynamics.heartRatePerMin,
    definition.initialPatient.hemodynamics.heartRatePerMin +
      Math.max(0, 65 - next.hemodynamics.mapMmHg) * 0.8 +
      next.human.dyspneaScore,
    deltaSeconds,
    45,
  )
  next.mechanics.intrinsicPeepCmH2O = measurements.intrinsicPeepCmH2O
  return next
}

function updateRisk(
  risk: RiskState,
  state: VentilationSimulationState,
  measurements: VentilatorMeasurements,
  deltaSeconds: number,
): RiskState {
  return {
    highPlateau:
      risk.highPlateau +
      (measurements.plateauPressureCmH2O > 30 ? deltaSeconds : -deltaSeconds * 0.25),
    stackedVolume:
      risk.stackedVolume +
      (measurements.stackedVolumeMl > measurements.exhaledVtMl * 1.4
        ? deltaSeconds
        : -deltaSeconds * 0.25),
    dynamicHyperinflation:
      risk.dynamicHyperinflation +
      (measurements.intrinsicPeepCmH2O > 10 ? deltaSeconds : -deltaSeconds * 0.25),
    hypoxemia:
      risk.hypoxemia +
      (state.patient.gasExchange.spo2Percent < 85 ? deltaSeconds : -deltaSeconds * 0.25),
    hypotension:
      risk.hypotension +
      (state.patient.hemodynamics.mapMmHg < 55 ? deltaSeconds : -deltaSeconds * 0.25),
    excessiveSedation:
      risk.excessiveSedation +
      (state.patient.human.sedationScore <= -4 ? deltaSeconds : -deltaSeconds * 0.25),
  }
}

function boundedRisk(risk: RiskState): RiskState {
  return Object.fromEntries(
    Object.entries(risk).map(([key, value]) => [key, clamp(value, 0, 999)]),
  ) as unknown as RiskState
}

interface AlarmDescriptor {
  code: string
  message: string
  priority: AlarmEvent['priority']
}

function alarmDescriptors(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): AlarmDescriptor[] {
  const descriptors: AlarmDescriptor[] = []
  const m = state.measurements
  if (m.peakPressureCmH2O >= state.ventilator.settings.highPressureLimitCmH2O) {
    descriptors.push({ code: 'HIGH_PRESSURE', message: 'High pressure', priority: 'high' })
  } else if (m.peakPressureCmH2O >= state.ventilator.settings.highPressureLimitCmH2O - 3) {
    descriptors.push({
      code: 'PRESSURE_LIMITATION',
      message: 'Pressure limitation',
      priority: 'medium',
    })
  }
  if (state.patient.gasExchange.spo2Percent < 85) {
    descriptors.push({ code: 'SPO2_LOW', message: 'SpO₂ low', priority: 'high' })
  }
  if (state.patient.hemodynamics.mapMmHg < 55) {
    descriptors.push({ code: 'MAP_LOW', message: 'Patient blood pressure low', priority: 'high' })
  }
  if (m.exhaledVtMl < 250 && m.totalRatePerMin > 0) {
    descriptors.push({ code: 'VT_LOW', message: 'Vt low', priority: 'medium' })
  }
  if (m.totalRatePerMin < 2) {
    descriptors.push({ code: 'APNEA', message: 'Apnea', priority: 'high' })
  }
  if (state.patient.mechanics.airwayLeakFraction > 0.35) {
    descriptors.push({ code: 'DISCONNECTION', message: 'Disconnection', priority: 'high' })
  }
  if (
    definition.phenotype === 'autotriggering' &&
    state.branch === 'condensate' &&
    state.patient.airway.condensate
  ) {
    descriptors.push({
      code: 'FLOW_SENSOR_WATER',
      message: 'Check flow sensor for water',
      priority: 'high',
    })
  }
  return descriptors
}

function reconcileAlarms(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): Pick<VentilationSimulationState, 'alarms' | 'alarmHistory'> {
  const descriptors = alarmDescriptors(state, definition)
  const existingByCode = new Map(state.alarmHistory.map((alarm) => [alarm.code, alarm]))
  const active = descriptors.map((descriptor) => {
    const existing = existingByCode.get(descriptor.code)
    return {
      id: existing?.id ?? `${descriptor.code}-${Math.floor(state.simulationTime)}`,
      ...descriptor,
      startedAt: existing?.startedAt ?? state.simulationTime,
      acknowledgedAt: existing?.acknowledgedAt,
      active: true,
    }
  })
  const activeCodes = new Set(active.map((alarm) => alarm.code))
  const inactive = state.alarmHistory
    .filter((alarm) => !activeCodes.has(alarm.code))
    .map((alarm) => ({ ...alarm, active: false }))
  const rank = { high: 3, medium: 2, low: 1 }
  return {
    alarms: active.sort((a, b) => rank[b.priority] - rank[a.priority]),
    alarmHistory: [...active, ...inactive].slice(0, 20),
  }
}

function withCriticalErrors(state: VentilationSimulationState): VentilationSimulationState {
  const errors = new Set(state.criticalErrors)
  const timelyHemodynamicRescue = state.interventions.some(
    (record) =>
      (record.interventionId === 'disconnect-bag' ||
        record.interventionId === 'decompress-pneumothorax') &&
      record.time <= 15,
  )
  if (state.risk.highPlateau >= 15) errors.add('Sustained excessive plateau pressure')
  if (state.risk.dynamicHyperinflation >= 15) errors.add('Sustained severe dynamic hyperinflation')
  if (state.risk.hypotension >= 45 && !timelyHemodynamicRescue) {
    errors.add('Prolonged severe hypotension')
  }
  if (state.risk.stackedVolume >= 20) errors.add('Repeated stacked inflation')
  return { ...state, criticalErrors: [...errors] }
}

export function advanceSimulation(
  state: VentilationSimulationState,
  seconds: number,
  suppliedDefinition?: VentilationCaseDefinition,
): VentilationSimulationState {
  const definition =
    suppliedDefinition ??
    mechanicalVentilationCaseById.get(state.caseId) ??
    mechanicalVentilationCases[0]
  const steps = Math.max(1, Math.ceil(seconds / WAVEFORM_STEP_SECONDS))
  const actualStep = seconds / steps
  let time = state.simulationTime
  let volumeL = state.patient.mechanics.endExpiratoryVolumeL
  let waveforms = [...state.waveforms]
  let trends = [...state.trends]
  let patient = deriveEffectivePatient(state, definition)
  let measurements = deriveMeasurements(state, definition, patient)
  let risk = { ...state.risk }
  let working = state
  let lastTrendSecond = Math.floor(state.simulationTime)

  for (let index = 0; index < steps; index += 1) {
    time += actualStep
    working = { ...working, simulationTime: time, patient, measurements }
    patient = deriveEffectivePatient(working, definition)
    const frame = nextWaveformSample(working, definition, patient, measurements, time, volumeL)
    volumeL = frame.volumeL
    if (!state.ventilator.frozen) {
      waveforms.push(frame.sample)
      if (waveforms.length > MAX_WAVEFORM_SAMPLES)
        waveforms = waveforms.slice(-MAX_WAVEFORM_SAMPLES)
    }
    patient = { ...patient, mechanics: { ...patient.mechanics, endExpiratoryVolumeL: volumeL } }
    measurements = deriveMeasurements({ ...working, patient }, definition, patient)
    patient = updateSlowPhysiology(
      { ...working, patient, measurements },
      definition,
      patient,
      measurements,
      actualStep,
    )
    risk = boundedRisk(updateRisk(risk, { ...working, patient }, measurements, actualStep))
    const currentSecond = Math.floor(time)
    if (currentSecond > lastTrendSecond) {
      trends.push({
        time,
        spo2Percent: round(patient.gasExchange.spo2Percent),
        paCO2MmHg: round(patient.gasExchange.paCO2MmHg),
        mapMmHg: round(patient.hemodynamics.mapMmHg),
        peakPressureCmH2O: measurements.peakPressureCmH2O,
        plateauPressureCmH2O: measurements.plateauPressureCmH2O,
        intrinsicPeepCmH2O: measurements.intrinsicPeepCmH2O,
        dyspneaScore: round(patient.human.dyspneaScore),
      })
      if (trends.length > MAX_TREND_SAMPLES) trends = trends.slice(-MAX_TREND_SAMPLES)
      lastTrendSecond = currentSecond
    }
  }

  let next: VentilationSimulationState = {
    ...state,
    simulationTime: time,
    patient,
    measurements,
    waveforms,
    trends,
    risk,
    ventilator: {
      ...state.ventilator,
      holdType:
        state.ventilator.holdUntil !== null && state.ventilator.holdUntil <= time
          ? null
          : state.ventilator.holdType,
      holdUntil:
        state.ventilator.holdUntil !== null && state.ventilator.holdUntil <= time
          ? null
          : state.ventilator.holdUntil,
      manualBreathUntil:
        state.ventilator.manualBreathUntil !== null && state.ventilator.manualBreathUntil <= time
          ? null
          : state.ventilator.manualBreathUntil,
    },
  }
  next = { ...next, ...reconcileAlarms(next, definition) }
  return withCriticalErrors(next)
}

function interventionDefinition(
  definition: VentilationCaseDefinition,
  interventionId: string,
): InterventionDefinition | undefined {
  return definition.interventions.find((item) => item.id === interventionId)
}

export function applyIntervention(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  interventionId: string,
): VentilationSimulationState {
  const intervention = interventionDefinition(definition, interventionId)
  if (!intervention) return { ...state, lastResponse: 'That action is not available in this case.' }
  const performedIds = new Set(state.interventions.map((record) => record.interventionId))
  if (!intervention.repeatable && performedIds.has(intervention.id)) return state
  if (intervention.prerequisites?.some((id) => !performedIds.has(id))) {
    return {
      ...state,
      lastResponse: `Complete ${intervention.prerequisites.join(', ')} before this action.`,
    }
  }
  const record = {
    id: `${intervention.id}-${state.simulationTime}-${state.interventions.length}`,
    interventionId: intervention.id,
    label: intervention.label,
    response: intervention.response,
    time: state.simulationTime,
    effectiveAt:
      intervention.category === 'assessment' || intervention.category === 'ventilator'
        ? state.simulationTime
        : state.simulationTime + intervention.latencySeconds,
  }
  let ventilator = { ...state.ventilator }
  let lastAbgAt = state.lastAbgAt
  const errors = new Set(state.criticalErrors)
  if (intervention.effectId === 'inspiratory-hold' || intervention.effectId === 'expiratory-hold') {
    ventilator = {
      ...ventilator,
      holdType: intervention.effectId === 'inspiratory-hold' ? 'inspiratory' : 'expiratory',
      holdUntil: state.simulationTime + 10,
    }
  }
  if (intervention.effectId === 'order-abg') lastAbgAt = state.simulationTime + 60
  if (intervention.effectId === 'deepen-sedation') {
    if (definition.id === 'MV-15')
      errors.add('Deep sedation before assessing pain, dyspnea, and delirium')
  }
  if (intervention.unsafe && intervention.critical) errors.add(intervention.label)
  const next: VentilationSimulationState = {
    ...state,
    ventilator,
    interventions: [...state.interventions, record],
    phase: 'reassess',
    lastResponse: intervention.response,
    lastAbgAt,
    criticalErrors: [...errors],
  }
  const effectivePatient = deriveEffectivePatient(next, definition)
  return {
    ...next,
    patient: effectivePatient,
    measurements: deriveMeasurements(next, definition, effectivePatient),
  }
}

export function selectCaseOutcome(
  state: VentilationSimulationState,
  suppliedDefinition?: VentilationCaseDefinition,
): CaseOutcome {
  const definition =
    suppliedDefinition ??
    mechanicalVentilationCaseById.get(state.caseId) ??
    mechanicalVentilationCases[0]
  const performed = new Set(state.interventions.map((record) => record.interventionId))
  const resolved = isCaseResolved(state, definition)
  const requiredActionsComplete = definition.requiredInterventionIds.every((id) =>
    performed.has(id),
  )
  const requiredReassessmentComplete = definition.requiredReassessmentIds.every((id) =>
    performed.has(id),
  )
  const safety =
    state.criticalErrors.length === 0 &&
    (definition.requiredInterventionIds.length === 0 ||
      performed.has(definition.requiredInterventionIds[0]))
      ? 20
      : 0
  const mechanism =
    state.prediction.committed &&
    state.prediction.mechanismId === definition.correctMechanismId &&
    state.prediction.priorityId === definition.correctPriorityId &&
    state.prediction.responseId === definition.correctResponseId
      ? 20
      : state.prediction.mechanismId === definition.correctMechanismId
        ? 10
        : 0
  const correctiveActions = resolved ? 30 : requiredActionsComplete ? 15 : 0
  const reassessment = state.reassessment.committed && requiredReassessmentComplete ? 20 : 0
  const communicationComfort = performed.has('communicate-plan') ? 10 : 0
  const raw = safety + mechanism + correctiveActions + reassessment + communicationComfort
  const hintPenalty = state.experience === 'practice' ? state.hintsUsed * 5 : 0
  const score = clamp(raw - hintPenalty, 0, 100)
  return {
    score,
    mastery: score >= 80 && state.criticalErrors.length === 0,
    domains: { safety, mechanism, correctiveActions, reassessment, communicationComfort },
    criticalErrors: state.criticalErrors,
    resolved,
  }
}

export function defaultSettingsForMode(mode: MechanicalVentilationSettings['mode']) {
  return createDefaultMechanicalVentilationSettings(mode)
}
