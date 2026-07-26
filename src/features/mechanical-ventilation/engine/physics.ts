import type {
  MechanicalVentilationSettings,
  InterventionEffectId,
  MetricCondition,
  MetricKey,
  PatientModelState,
  VentilationCaseDefinition,
  VentilationSimulationState,
  VentilatorMeasurements,
} from './types'
import { isAdaptivePressureMode, isAdaptiveSupportMode, isSimvMode, isTwoLevelMode } from './modes'

export const WAVEFORM_SAMPLE_HZ = 50
export const WAVEFORM_STEP_SECONDS = 1 / WAVEFORM_SAMPLE_HZ
export const WAVEFORM_WINDOW_SECONDS = 12
export const MAX_WAVEFORM_SAMPLES = WAVEFORM_SAMPLE_HZ * WAVEFORM_WINDOW_SECONDS
export const MAX_TREND_SAMPLES = 180

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function round(value: number, places = 1): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

export function moveTowardExp(
  value: number,
  target: number,
  deltaSeconds: number,
  timeConstantSeconds: number,
): number {
  const fraction = 1 - Math.exp(-deltaSeconds / Math.max(0.01, timeConstantSeconds))
  return value + (target - value) * fraction
}

export function equationOfMotionPressure(args: {
  peepCmH2O: number
  intrinsicPeepCmH2O: number
  resistanceCmH2OPerLps: number
  flowLps: number
  volumeL: number
  complianceLPerCmH2O: number
  inspiratoryEffortCmH2O: number
}): number {
  return (
    args.peepCmH2O +
    args.intrinsicPeepCmH2O +
    args.resistanceCmH2OPerLps * args.flowLps +
    args.volumeL / Math.max(0.005, args.complianceLPerCmH2O) -
    args.inspiratoryEffortCmH2O
  )
}

export function passiveExpiratoryFlowLps(
  volumeL: number,
  resistanceCmH2OPerLps: number,
  complianceLPerCmH2O: number,
): number {
  const timeConstant = Math.max(0.08, resistanceCmH2OPerLps * complianceLPerCmH2O)
  return -volumeL / timeConstant
}

/**
 * Flow-delivery time for a volume-targeted breath, from settings alone. Split out of
 * `deriveMechanicalInspiratoryTime` so device profiles can express a pause in seconds — the unit
 * the Evita, PB980, and AVEA all print — without needing a patient model.
 */
export function deriveVolumeFlowTimeSeconds(settings: MechanicalVentilationSettings): number {
  if (settings.mode !== 'volume-ac') return 0
  const patternFactor =
    settings.flowPattern === 'square'
      ? 1
      : settings.flowPattern === 'sine'
        ? 0.64
        : settings.flowPattern === 'decelerating-100'
          ? 0.55
          : 0.72
  return clamp(settings.vtMl / Math.max(1, settings.peakFlowLMin * patternFactor * 16.67), 0.2, 3)
}

export function deriveMechanicalInspiratoryTime(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
): number {
  if (isTwoLevelMode(settings.deviceMode)) return settings.advanced.tHighSeconds
  if (settings.advanced.intelliSyncEnabled) {
    return clamp(patient.drive.neuralInspiratoryTimeSeconds, 0.2, 3)
  }
  if (settings.mode === 'volume-ac') return deriveVolumeFlowTimeSeconds(settings)
  if (settings.mode === 'pressure-ac') return settings.inspiratoryTimeSeconds
  const tau = Math.max(
    0.08,
    patient.mechanics.resistanceCmH2OPerLps * patient.mechanics.complianceLPerCmH2O,
  )
  const etsFraction = clamp(settings.etsPercent / 100, 0.05, 0.8)
  return clamp(-tau * Math.log(etsFraction) + settings.pRampMs / 2000, 0.2, settings.tiMaxSeconds)
}

function asvTargets(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
  predictedBodyWeightKg: number,
): { minuteVentilationLMin: number; ratePerMin: number; vtMl: number } {
  const timeConstant = Math.max(
    0.08,
    (patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps) *
      patient.mechanics.complianceLPerCmH2O,
  )
  let minuteVentilationLMin =
    Math.max(25, predictedBodyWeightKg) * 0.1 * (settings.advanced.minuteVolumePercent / 100)
  if (
    settings.deviceMode === 'intellivent-asv' &&
    settings.advanced.automaticVentilationController
  ) {
    minuteVentilationLMin *= clamp(
      patient.gasExchange.paCO2MmHg / Math.max(25, settings.advanced.targetPetCO2MmHg),
      0.7,
      1.4,
    )
  }
  minuteVentilationLMin = clamp(minuteVentilationLMin, 2, 25)
  const ratePerMin = clamp(60 / (1 + 6 * timeConstant), 8, 30)
  const vtMl = clamp((minuteVentilationLMin * 1000) / ratePerMin, 250, 900)
  return { minuteVentilationLMin, ratePerMin, vtMl }
}

export function deriveEffectiveVentilationRate(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
  predictedBodyWeightKg = 70,
): number {
  if (isTwoLevelMode(settings.deviceMode)) {
    const releaseRate =
      60 / Math.max(0.3, settings.advanced.tHighSeconds + settings.advanced.tLowSeconds)
    return Math.max(releaseRate, patient.drive.neuralRatePerMin)
  }
  if (isAdaptiveSupportMode(settings.deviceMode)) {
    if (
      settings.deviceMode === 'intellivent-asv' &&
      !settings.advanced.automaticVentilationController &&
      settings.mode === 'pressure-ac'
    ) {
      return Math.max(settings.ratePerMin, patient.drive.neuralRatePerMin)
    }
    return Math.max(
      asvTargets(settings, patient, predictedBodyWeightKg).ratePerMin,
      patient.drive.neuralRatePerMin,
    )
  }
  if (settings.mode === 'pressure-support') {
    if (patient.drive.neuralRatePerMin <= 0 && settings.apneaBackupEnabled) {
      return settings.apneaRatePerMin
    }
    return Math.max(1, patient.drive.neuralRatePerMin)
  }
  return Math.max(settings.ratePerMin, patient.drive.neuralRatePerMin)
}

export function effectiveBaselinePressureCmH2O(settings: MechanicalVentilationSettings): number {
  return isTwoLevelMode(settings.deviceMode) ? settings.advanced.pLowCmH2O : settings.peepCmH2O
}

export function targetTidalVolumeMl(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
  predictedBodyWeightKg = 70,
): number {
  if (settings.deviceMode === 'volume-support' || isAdaptivePressureMode(settings.deviceMode)) {
    return settings.advanced.targetVtMl
  }
  if (settings.advanced.autoFlowEnabled && settings.mode === 'volume-ac') return settings.vtMl
  if (isAdaptiveSupportMode(settings.deviceMode)) {
    return asvTargets(settings, patient, predictedBodyWeightKg).vtMl
  }
  if (settings.mode === 'volume-ac') return settings.vtMl
  const pressureAboveBaseline = effectivePressureAboveBaselineCmH2O(
    settings,
    patient,
    predictedBodyWeightKg,
  )
  return clamp(
    pressureAboveBaseline * Math.max(0.005, patient.mechanics.complianceLPerCmH2O) * 1000,
    100,
    1400,
  )
}

export function effectivePressureAboveBaselineCmH2O(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
  predictedBodyWeightKg = 70,
): number {
  const compliance = Math.max(0.005, patient.mechanics.complianceLPerCmH2O)
  const patientContribution = patient.drive.effortAmplitudeCmH2O * 0.35
  if (isTwoLevelMode(settings.deviceMode)) {
    return Math.max(1, settings.advanced.pHighCmH2O - settings.advanced.pLowCmH2O)
  }
  if (settings.deviceMode === 'proportional-assist') {
    const supportFraction = clamp(settings.advanced.proportionalSupportPercent / 100, 0.05, 0.95)
    return clamp(
      (patient.drive.effortAmplitudeCmH2O * supportFraction) / Math.max(0.15, 1 - supportFraction),
      2,
      30,
    )
  }
  if (settings.deviceMode === 'volume-support') {
    return clamp(settings.advanced.targetVtMl / 1000 / compliance - patientContribution, 2, 35)
  }
  if (
    isAdaptivePressureMode(settings.deviceMode) ||
    (settings.advanced.autoFlowEnabled && settings.mode === 'volume-ac')
  ) {
    const target = settings.mode === 'volume-ac' ? settings.vtMl : settings.advanced.targetVtMl
    return clamp(target / 1000 / compliance, 5, 40)
  }
  if (isAdaptiveSupportMode(settings.deviceMode)) {
    const target = asvTargets(settings, patient, predictedBodyWeightKg).vtMl
    return clamp(target / 1000 / compliance - patientContribution, 5, 35)
  }
  if (settings.mode === 'pressure-ac') return settings.deltaPControlCmH2O
  if (settings.mode === 'pressure-support') return settings.pressureSupportCmH2O
  return clamp(settings.vtMl / 1000 / compliance, 5, 40)
}

export function usesPressureTargetedDelivery(settings: MechanicalVentilationSettings): boolean {
  return (
    settings.mode !== 'volume-ac' ||
    settings.advanced.autoFlowEnabled ||
    isAdaptivePressureMode(settings.deviceMode) ||
    isTwoLevelMode(settings.deviceMode) ||
    isAdaptiveSupportMode(settings.deviceMode)
  )
}

function performedEffectIds(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): Set<InterventionEffectId> {
  const interventionById = new Map(definition.interventions.map((item) => [item.id, item]))
  return new Set(
    state.interventions
      .filter((record) => record.effectiveAt <= state.simulationTime)
      .map((record) => interventionById.get(record.interventionId)?.effectId)
      .filter((effectId): effectId is InterventionEffectId => effectId !== undefined),
  )
}

export function hasPerformedEffect(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  effectId: InterventionEffectId,
): boolean {
  return performedEffectIds(state, definition).has(effectId)
}

function branchCorrected(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): boolean {
  const effects = performedEffectIds(state, definition)
  if (definition.phenotype === 'autotriggering') {
    if (state.branch === 'condensate') return effects.has('drain-condensate')
    if (state.branch === 'leak') return effects.has('correct-leak')
    return (
      state.ventilator.settings.trigger.type === 'flow' &&
      state.ventilator.settings.trigger.thresholdLMin >= 1.5
    )
  }
  if (definition.phenotype === 'high-resistance') {
    if (state.branch === 'secretions') return effects.has('suction-airway')
    if (state.branch === 'hme-or-ett') {
      return effects.has('remove-hme') || effects.has('reposition-ett')
    }
    return effects.has('bronchodilator')
  }
  return true
}

export function deriveEffectivePatient(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): PatientModelState {
  const base = definition.initialPatient
  const effects = performedEffectIds(state, definition)
  const settings = state.ventilator.settings
  const patient: PatientModelState = {
    mechanics: { ...base.mechanics },
    drive: { ...base.drive },
    gasExchange: { ...state.patient.gasExchange },
    hemodynamics: { ...state.patient.hemodynamics },
    human: { ...state.patient.human },
    airway: { ...state.patient.airway },
  }

  if (state.branch === 'leak' && patient.airway.circuitLeak) {
    patient.mechanics.airwayLeakFraction = Math.max(patient.mechanics.airwayLeakFraction, 0.12)
  }
  if (definition.phenotype === 'high-resistance') {
    patient.mechanics.resistanceCmH2OPerLps =
      state.branch === 'bronchospasm' ? 30 : Math.max(26, patient.mechanics.resistanceCmH2OPerLps)
  }

  if (effects.has('bronchodilator')) {
    patient.mechanics.resistanceCmH2OPerLps *=
      definition.phenotype === 'high-resistance' ? 0.4 : 0.62
    patient.airway.bronchospasm = false
  }
  if (effects.has('suction-airway')) {
    patient.mechanics.resistanceCmH2OPerLps *= state.branch === 'secretions' ? 0.4 : 0.86
    patient.airway.secretions = false
  }
  if (effects.has('remove-hme') || effects.has('reposition-ett')) {
    patient.mechanics.resistanceCmH2OPerLps = Math.min(patient.mechanics.resistanceCmH2OPerLps, 12)
    patient.airway.hmeObstructed = false
    patient.airway.ettObstructed = false
  }
  if (effects.has('drain-condensate')) patient.airway.condensate = false
  if (effects.has('correct-leak')) {
    patient.airway.circuitLeak = false
    patient.mechanics.airwayLeakFraction = 0
  }
  if (effects.has('decompress-pneumothorax')) {
    patient.airway.pneumothorax = false
    patient.mechanics.complianceLPerCmH2O = Math.max(patient.mechanics.complianceLPerCmH2O, 0.028)
    patient.hemodynamics.obstructiveShock = false
  }
  if (effects.has('pleural-drainage')) {
    patient.mechanics.complianceLPerCmH2O = Math.max(patient.mechanics.complianceLPerCmH2O, 0.035)
  }
  if (effects.has('disconnect-bag')) {
    patient.mechanics.endExpiratoryVolumeL *= 0.1
    patient.mechanics.intrinsicPeepCmH2O *= 0.2
  }
  if (effects.has('treat-drive')) {
    patient.drive.neuralRatePerMin = Math.max(18, patient.drive.neuralRatePerMin - 5)
    patient.drive.effortAmplitudeCmH2O *= 0.78
  }
  if (effects.has('reduce-sedation')) {
    patient.human.sedationScore = Math.min(-1, patient.human.sedationScore + 2)
    patient.drive.variability = Math.max(0.12, patient.drive.variability)
    if (definition.phenotype === 'over-assistance') {
      patient.drive.neuralRatePerMin += 4
    }
  }
  if (effects.has('deepen-sedation')) {
    patient.human.sedationScore = -5
    patient.drive.effortAmplitudeCmH2O *= 0.2
    patient.drive.neuralRatePerMin *= 0.65
  }
  if (effects.has('neuromuscular-blockade')) {
    patient.drive.effortAmplitudeCmH2O = 0
  }
  if (effects.has('communication-board')) patient.human.canCommunicate = true
  if (effects.has('treat-pain')) patient.human.painScore = Math.max(1, patient.human.painScore - 5)
  if (effects.has('relieve-bladder'))
    patient.human.painScore = Math.max(0, patient.human.painScore - 2)
  if (effects.has('reorient'))
    patient.human.deliriumScore = Math.max(1, patient.human.deliriumScore - 3)
  if (effects.has('reduce-noise'))
    patient.human.deliriumScore = Math.max(0, patient.human.deliriumScore - 1)

  if (settings.trcEnabled) {
    patient.mechanics.tubeResistanceCmH2OPerLps *= 1 - settings.trcPercent / 125
  }

  if (definition.phenotype === 'ards-recruitment') {
    if (settings.peepCmH2O >= 8 && settings.peepCmH2O <= 12) {
      patient.mechanics.complianceLPerCmH2O = 0.032
      patient.gasExchange.shuntFraction = 0.2
    } else if (settings.peepCmH2O >= 14) {
      patient.mechanics.complianceLPerCmH2O = 0.018
      patient.gasExchange.shuntFraction = 0.24
    }
  }
  if (definition.phenotype === 'rise-time-mismatch' && settings.mode === 'pressure-support') {
    patient.human.dyspneaScore = settings.pRampMs > 120 ? 8 : settings.pRampMs < 30 ? 6 : 3
  }
  if (definition.phenotype === 'over-assistance' && settings.mode === 'pressure-support') {
    if (settings.pressureSupportCmH2O >= 18) patient.drive.neuralRatePerMin = 8
    if (settings.pressureSupportCmH2O >= 18) patient.drive.effortAmplitudeCmH2O *= 0.25
  }
  return patient
}

export function deriveMeasurements(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient = deriveEffectivePatient(state, definition),
): VentilatorMeasurements {
  const settings = state.ventilator.settings
  const mechanicalTi = deriveMechanicalInspiratoryTime(settings, patient)
  const rate = deriveEffectiveVentilationRate(settings, patient, definition.predictedBodyWeightKg)
  const compliance = Math.max(0.005, patient.mechanics.complianceLPerCmH2O)
  const resistance =
    patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps
  const baselinePressure = effectiveBaselinePressureCmH2O(settings)
  const pressureAboveBaseline = effectivePressureAboveBaselineCmH2O(
    settings,
    patient,
    definition.predictedBodyWeightKg,
  )
  const pressureTargeted = usesPressureTargetedDelivery(settings)
  let vtMl: number
  let peakFlowLMin: number
  if (settings.mode === 'volume-ac' && !pressureTargeted) {
    vtMl = settings.vtMl * (1 - patient.mechanics.airwayLeakFraction)
    peakFlowLMin = settings.peakFlowLMin
  } else if (
    isAdaptivePressureMode(settings.deviceMode) ||
    settings.deviceMode === 'volume-support' ||
    isAdaptiveSupportMode(settings.deviceMode) ||
    (settings.advanced.autoFlowEnabled && settings.mode === 'volume-ac')
  ) {
    const targetVtMl = targetTidalVolumeMl(settings, patient, definition.predictedBodyWeightKg)
    const effortContribution =
      settings.deviceMode === 'volume-support' || isAdaptiveSupportMode(settings.deviceMode)
        ? patient.drive.effortAmplitudeCmH2O * 0.35
        : 0
    const achievableVtMl = (pressureAboveBaseline + effortContribution) * compliance * 1000
    vtMl = Math.min(targetVtMl, achievableVtMl) * (1 - patient.mechanics.airwayLeakFraction)
    peakFlowLMin = clamp((pressureAboveBaseline / resistance) * 60, 10, 180)
  } else if (settings.mode === 'pressure-ac') {
    vtMl = clamp(pressureAboveBaseline * compliance * 1000, 100, 1200)
    peakFlowLMin = clamp((pressureAboveBaseline / resistance) * 60, 10, 180)
  } else {
    const unloadingPressure = pressureAboveBaseline + patient.drive.effortAmplitudeCmH2O * 0.35
    vtMl = clamp(unloadingPressure * compliance * 1000, 100, 1400)
    peakFlowLMin = clamp((unloadingPressure / resistance) * 60, 10, 180)
  }

  if (isSimvMode(settings.deviceMode) && settings.mode !== 'pressure-support') {
    const spontaneousFraction = clamp((rate - settings.ratePerMin) / Math.max(1, rate), 0, 0.75)
    const spontaneousPressure =
      settings.advanced.spontaneousPressureSupportCmH2O + patient.drive.effortAmplitudeCmH2O * 0.35
    const spontaneousVtMl = clamp(spontaneousPressure * compliance * 1000, 100, 1400)
    vtMl = vtMl * (1 - spontaneousFraction) + spontaneousVtMl * spontaneousFraction
    peakFlowLMin = Math.max(peakFlowLMin, clamp((spontaneousPressure / resistance) * 60, 10, 180))
  }

  // Dynamic PEEPi is recomputed from the case baseline and the current expiratory
  // time on every fixed step. Feeding the prior derived value back into this
  // calculation would falsely compound trapped pressure at 50 Hz.
  let intrinsicPeep = definition.initialPatient.mechanics.intrinsicPeepCmH2O
  if (definition.phenotype === 'copd-ineffective-efforts' && settings.mode === 'pressure-support') {
    const initialSettings = definition.initialSettings
    if (initialSettings.mode === 'pressure-support') {
      intrinsicPeep -=
        Math.max(0, initialSettings.pressureSupportCmH2O - settings.pressureSupportCmH2O) * 0.6
      intrinsicPeep -= Math.max(0, settings.etsPercent - initialSettings.etsPercent) * 0.15
      intrinsicPeep = Math.max(0, intrinsicPeep)
    }
  }
  const cycleTime = isTwoLevelMode(settings.deviceMode)
    ? settings.advanced.tHighSeconds + settings.advanced.tLowSeconds
    : 60 / Math.max(1, rate)
  const expiratoryTime = isTwoLevelMode(settings.deviceMode)
    ? settings.advanced.tLowSeconds
    : Math.max(0.08, cycleTime - mechanicalTi)
  const timeConstant = resistance * compliance
  if (timeConstant > expiratoryTime) {
    intrinsicPeep += clamp((timeConstant - expiratoryTime) * 7, 0, 24)
  }
  if (definition.phenotype === 'copd-ineffective-efforts' && settings.mode === 'pressure-support') {
    intrinsicPeep += Math.max(0, (settings.pressureSupportCmH2O - 12) * 0.45)
    intrinsicPeep += Math.max(0, (35 - settings.etsPercent) * 0.08)
  }
  if (definition.phenotype === 'asthma-obstructive-shock' && settings.mode === 'volume-ac') {
    intrinsicPeep += Math.max(0, (settings.ratePerMin - 12) * 0.8)
    intrinsicPeep += Math.max(0, (80 - settings.peakFlowLMin) * 0.05)
  }
  if (definition.phenotype === 'delayed-cycling' && settings.mode === 'pressure-support') {
    intrinsicPeep += Math.max(0, (40 - settings.etsPercent) * 0.12)
  }
  if (hasPerformedEffect(state, definition, 'disconnect-bag')) intrinsicPeep *= 0.35

  const plateau = baselinePressure + intrinsicPeep + vtMl / 1000 / compliance
  const riseTimeMs =
    settings.mode === 'pressure-ac'
      ? settings.pRampMs
      : settings.mode === 'pressure-support'
        ? settings.pRampMs
        : 70
  const pressureOvershoot =
    pressureTargeted && riseTimeMs < 30 ? clamp((30 - riseTimeMs) / 5, 0, 6) : 0
  const peak = !pressureTargeted
    ? plateau + resistance * (peakFlowLMin / 60)
    : baselinePressure + pressureAboveBaseline + pressureOvershoot

  let ineffectiveFraction = 0
  let autotriggerFraction = 0
  let triggerDelayMs = 80
  if (definition.phenotype === 'weak-trigger' && settings.trigger.type === 'flow') {
    ineffectiveFraction = clamp((settings.trigger.thresholdLMin - 1.5) / 4, 0, 0.65)
    autotriggerFraction = clamp((0.7 - settings.trigger.thresholdLMin) / 0.7, 0, 0.55)
    triggerDelayMs = 80 + ineffectiveFraction * 400
  }
  if (definition.phenotype === 'copd-ineffective-efforts') {
    ineffectiveFraction = clamp(
      intrinsicPeep / 22 +
        (settings.trigger.type === 'flow' ? settings.trigger.thresholdLMin / 20 : 0),
      0,
      0.7,
    )
    triggerDelayMs = 100 + ineffectiveFraction * 450
  }
  if (definition.phenotype === 'autotriggering') {
    const triggerSensitive =
      settings.trigger.type === 'flow' && settings.trigger.thresholdLMin < 1.5
    autotriggerFraction = branchCorrected(state, definition) || !triggerSensitive ? 0.04 : 0.68
  }
  if (settings.advanced.intelliSyncEnabled) {
    ineffectiveFraction *= 0.25
    autotriggerFraction *= 0.25
    triggerDelayMs = Math.min(triggerDelayMs, 55)
  }

  let stackedVolumeMl = 0
  if (definition.phenotype === 'double-triggering') {
    const mismatch = patient.drive.neuralInspiratoryTimeSeconds - mechanicalTi
    stackedVolumeMl = mismatch > 0.15 ? vtMl * 1.85 : vtMl
  }
  if (definition.phenotype === 'reverse-triggering') {
    const rateChanged = settings.mode === 'pressure-ac' && Math.abs(settings.ratePerMin - 18) >= 3
    const variabilityRestored = hasPerformedEffect(state, definition, 'reduce-sedation')
    stackedVolumeMl = rateChanged || variabilityRestored ? vtMl : vtMl * 1.55
  }

  const expFlowNext = -Math.max(0, (intrinsicPeep * compliance) / Math.max(0.08, timeConstant)) * 60
  const observedRate =
    definition.phenotype === 'autotriggering' && autotriggerFraction > 0.2
      ? Math.max(28, rate)
      : rate * (1 - ineffectiveFraction)
  return {
    peakPressureCmH2O: round(peak),
    plateauPressureCmH2O: round(plateau),
    meanAirwayPressureCmH2O: round(
      baselinePressure + ((peak - baselinePressure) * mechanicalTi) / Math.max(0.1, cycleTime),
    ),
    exhaledVtMl: round(vtMl, 0),
    minuteVentilationLMin: round((vtMl / 1000) * observedRate),
    totalRatePerMin: round(observedRate, 0),
    observedPatientRatePerMin: round(patient.drive.neuralRatePerMin, 0),
    staticComplianceMlCmH2O: round(compliance * 1000, 0),
    intrinsicPeepCmH2O: round(intrinsicPeep),
    expiratoryFlowAtNextBreathLMin: round(expFlowNext),
    triggerDelayMs: round(triggerDelayMs, 0),
    mechanicalInspiratoryTimeSeconds: round(mechanicalTi, 2),
    stackedVolumeMl: round(stackedVolumeMl, 0),
    ineffectiveEffortFraction: round(ineffectiveFraction, 2),
    autotriggerFraction: round(autotriggerFraction, 2),
    pressureOvershootCmH2O: round(pressureOvershoot),
  }
}

export function isCaseResolved(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): boolean {
  const settings = state.ventilator.settings
  const m = state.measurements
  const effects = performedEffectIds(state, definition)
  switch (definition.phenotype) {
    case 'ards-recruitment':
      return settings.peepCmH2O >= 8 && settings.peepCmH2O <= 12 && m.plateauPressureCmH2O <= 30
    case 'flow-starvation':
      return (
        settings.mode !== 'volume-ac' ||
        settings.peakFlowLMin >= 60 ||
        settings.flowPattern !== 'square'
      )
    case 'double-triggering':
      return m.mechanicalInspiratoryTimeSeconds >= 0.7 && m.stackedVolumeMl <= m.exhaledVtMl * 1.2
    case 'reverse-triggering':
      return (
        (settings.mode === 'pressure-ac' && Math.abs(settings.ratePerMin - 18) >= 3) ||
        effects.has('reduce-sedation')
      )
    case 'copd-ineffective-efforts':
      return m.intrinsicPeepCmH2O <= 7 && m.ineffectiveEffortFraction <= 0.15
    case 'asthma-obstructive-shock':
      return (
        settings.mode === 'volume-ac' &&
        settings.ratePerMin <= 12 &&
        settings.peakFlowLMin >= 80 &&
        effects.has('disconnect-bag') &&
        effects.has('bronchodilator')
      )
    case 'weak-trigger':
      return m.ineffectiveEffortFraction <= 0.15 && m.autotriggerFraction <= 0.1
    case 'autotriggering':
      return branchCorrected(state, definition) && m.autotriggerFraction <= 0.1
    case 'premature-cycling':
      return (
        settings.mode === 'pressure-support' &&
        settings.etsPercent >= 15 &&
        settings.etsPercent <= 25
      )
    case 'delayed-cycling':
      return (
        settings.mode === 'pressure-support' &&
        settings.etsPercent >= 40 &&
        settings.etsPercent <= 60 &&
        settings.pressureSupportCmH2O <= 14
      )
    case 'rise-time-mismatch':
      return (
        settings.mode === 'pressure-support' && settings.pRampMs >= 70 && settings.pRampMs <= 120
      )
    case 'over-assistance':
      return (
        settings.mode === 'pressure-support' &&
        settings.pressureSupportCmH2O >= 10 &&
        settings.pressureSupportCmH2O <= 12
      )
    case 'high-resistance':
      return (
        branchCorrected(state, definition) && m.peakPressureCmH2O - m.plateauPressureCmH2O <= 15
      )
    case 'tension-pneumothorax':
      return effects.has('decompress-pneumothorax') && !state.patient.airway.pneumothorax
    case 'dyspnea-human-factors':
      return (
        settings.mode === 'pressure-support' &&
        settings.pressureSupportCmH2O >= 11 &&
        settings.pressureSupportCmH2O <= 12 &&
        settings.pRampMs >= 70 &&
        settings.pRampMs <= 120 &&
        effects.has('communication-board') &&
        effects.has('treat-pain') &&
        effects.has('relieve-bladder')
      )
  }
}

export function resolveMetric(state: VentilationSimulationState, metric: MetricKey): number {
  const path = metric.split('.')
  let value: unknown = state
  for (const segment of path) {
    if (!value || typeof value !== 'object') return Number.NaN
    value = (value as Record<string, unknown>)[segment]
  }
  return typeof value === 'number' ? value : Number.NaN
}

export function conditionMatches(
  state: VentilationSimulationState,
  condition: MetricCondition,
): boolean {
  const actual = resolveMetric(state, condition.metric)
  if (!Number.isFinite(actual)) return false
  if (condition.comparator === 'between') {
    if (!Array.isArray(condition.value)) return false
    return actual >= condition.value[0] && actual <= condition.value[1]
  }
  if (typeof condition.value !== 'number') return false
  if (condition.comparator === 'lt') return actual < condition.value
  if (condition.comparator === 'lte') return actual <= condition.value
  if (condition.comparator === 'gt') return actual > condition.value
  return actual >= condition.value
}
