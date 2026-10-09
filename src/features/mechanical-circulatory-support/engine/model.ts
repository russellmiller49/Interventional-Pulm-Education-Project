import {
  advanceWindkesselCompartments,
  createInitialCirculationCompartments,
  HEMODYNAMIC_FIXED_STEP_SECONDS,
  type CirculationCompartmentState,
  type CirculationParameters,
  type HemodynamicMeasurements,
  type MechanicalSupportEffect,
} from '@/features/hemodynamics-core'

import {
  defaultIabpDevice,
  defaultImpellaDevice,
  defaultLvadDevice,
  defaultMcsPatient,
} from '../content/scenarios'
import { MCS_AF_TRIGGER_LIMIT, mcsAfTriggerLimitAppliesTo } from '../content/afTriggerLimit'
import type {
  IabpDeviceState,
  McsLeftPreloadLimiter,
  McsLvadFillingLimiter,
  McsSupportDiagnostics,
  ImpellaDeviceState,
  LvadDeviceState,
  McsAlarm,
  McsDerivedMetrics,
  McsDeviceKind,
  McsDeviceState,
  McsModuleSection,
  McsPatientState,
  McsScenarioDefinition,
  McsSimulationState,
  McsTrendSample,
  McsWaveformSample,
} from './types'

const MAX_WAVEFORM_SECONDS = 8
const MAX_TREND_SECONDS = 120

/**
 * Authored model constants, named where they were previously inline literals.
 *
 * None of these values changed in MCS-PRE-REVIEW-02. They are named so the replay harness, the
 * tests and the owner-decision packet can refer to one definition instead of a line number, and
 * so a future reviewed change has a single place to land. They carry no clinical source.
 */
/** `leftPreloadFactor` below this turns on the modeled left-sided suction state. Authored. */
export const LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD = 0.58
/**
 * Displayed mean arterial pressure above which the durable-support afterload alarm is raised.
 * Continuous-flow LVAD patients are generally kept below 90 mm Hg (Case-Based Device Therapy for
 * Heart Failure, 2021, pp. 99 and 116–117); see `content/teachingNumbers.ts`.
 */
export const LVAD_HIGH_AFTERLOAD_MAP_MMHG = 90
/**
 * Power the rotor draws to overcome thrombus drag. It is real electrical power, so the
 * controller's flow estimate, which is calculated from power and speed, reads falsely high.
 */
export const LVAD_SUSPECTED_THROMBOSIS_POWER_W = 3.6
/** Share of hydraulic flow a thrombus on the rotor leaves the pump able to deliver. */
export const LVAD_THROMBOSIS_FLOW_FRACTION = 0.5
/**
 * Systemic vascular resistance of the durable-support reference patient. Chosen so the reference
 * state shows a mean arterial pressure inside the 70–80 mm Hg goal instead of a hypertensive one.
 */
export const LVAD_REFERENCE_SVR_DYN_SEC_CM5 = 760
/** Watts per L/min in the power relation; the flow estimate inverts the same relation. */
const LVAD_POWER_PER_FLOW_W = 0.66
const LVAD_POWER_AT_REFERENCE_SPEED_W = 2.1
/** Either durable-support filling term below this raises the modeled inflow-suction state. Authored. */
export const LVAD_SUCTION_FILLING_THRESHOLD = 0.42
/** The modeled inflow-suction state needs the pump to be moving at least this much. Authored. */
export const LVAD_SUCTION_MINIMUM_FLOW_LMIN = 2.5

/**
 * Mean flow range at each P-level, P-0 to P-9, in L/min.
 *
 * Impella CP with SmartAssist: instructions for use 0048-9007 rV, Table 5.3, p. 5.25.
 * Impella 5.5 with SmartAssist: instructions for use 10003049 rL, Table 5.3, p. 5.26 (mean flow
 * at a 30–60 mm Hg pressure difference). Read 2026-10-08; see `content/teachingNumbers.ts`.
 */
export const IMPELLA_MEAN_FLOW_BY_P_LEVEL_LMIN: Readonly<
  Record<'cp' | '55', readonly (readonly [number, number])[]>
> = {
  cp: [
    [0, 0],
    [0, 0.9],
    [1.1, 2.1],
    [1.6, 2.3],
    [2.0, 2.5],
    [2.3, 2.7],
    [2.5, 2.9],
    [2.9, 3.3],
    [3.1, 3.4],
    [3.3, 3.7],
  ],
  '55': [
    [0, 0],
    [0, 0],
    [0, 1.9],
    [1.1, 2.7],
    [1.9, 3.3],
    [2.8, 3.7],
    [3.4, 4.1],
    [3.9, 4.5],
    [4.3, 4.9],
    [5.0, 5.5],
  ],
}
/**
 * The reference patient's loading leaves about 0.89 of the target flow. This gain places that
 * patient inside each level's printed range; the final flow is still capped at the range ceiling.
 */
const IMPELLA_FAVORABLE_LOADING_GAIN = 1.04

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function gaussian(value: number, center: number, width: number): number {
  const normalized = (value - center) / width
  return Math.exp(-0.5 * normalized * normalized)
}

function cyclePhase(timeSeconds: number, heartRateBpm: number): number {
  const cycle = 60 / Math.max(25, heartRateBpm)
  return (((timeSeconds % cycle) + cycle) % cycle) / cycle
}

function cycleIndex(timeSeconds: number, heartRateBpm: number): number {
  return Math.floor(timeSeconds / (60 / Math.max(25, heartRateBpm)))
}

export interface IabpCycleState {
  phase: number
  /** The balloon inflates in this beat's diastole. */
  assistedBeat: boolean
  /**
   * The balloon inflated in the previous beat's diastole, so this beat's ejection is the assisted
   * systole and the pressure it opens against is the assisted end-diastolic pressure.
   */
  previousBeatAssisted: boolean
  inflated: boolean
  inflationStart: number
  deflationEnd: number
}

/**
 * A single timing source for the circulation, waveform, and 3D balloon.
 * Positive offsets move the corresponding event later in the cardiac cycle.
 */
export function deriveIabpCycleState(
  timeSeconds: number,
  heartRateBpm: number,
  device: IabpDeviceState,
): IabpCycleState {
  const phase = cyclePhase(timeSeconds, heartRateBpm)
  const beatIndex = cycleIndex(timeSeconds, heartRateBpm)
  const cycleMilliseconds = 60_000 / Math.max(25, heartRateBpm)
  const inflationStart = clamp(0.42 + device.inflationOffsetMs / cycleMilliseconds, 0.16, 0.82)
  const deflationEnd = clamp(0.92 + device.deflationOffsetMs / cycleMilliseconds, 0.5, 1.24)
  const assistedBeat = beatIndex % device.assistRatio === 0
  const previousBeatAssisted = (beatIndex - 1) % device.assistRatio === 0
  const inflatedThisBeat = assistedBeat && phase >= inflationStart
  const stillInflatedFromPreviousBeat =
    deflationEnd > 1 && previousBeatAssisted && phase < deflationEnd - 1
  const beforeDeflation = deflationEnd > 1 || phase < deflationEnd

  return {
    phase,
    assistedBeat,
    previousBeatAssisted,
    inflated:
      device.running && ((inflatedThisBeat && beforeDeflation) || stillInflatedFromPreviousBeat),
    inflationStart,
    deflationEnd,
  }
}

export function nextIabpBalloonMorph(
  currentValue: number,
  inflated: boolean,
  reducedMotion: boolean,
): number {
  const target = inflated ? 1 : 0
  return reducedMotion ? target : clamp(currentValue + (target - currentValue) * 0.18, 0, 1)
}

export function createDefaultMcsDevice(kind: McsDeviceKind): McsDeviceState {
  if (kind === 'iabp') return { ...defaultIabpDevice }
  if (kind === 'impella')
    return {
      ...defaultImpellaDevice,
      left: { ...defaultImpellaDevice.left },
      right: { ...defaultImpellaDevice.right },
    }
  return { ...defaultLvadDevice }
}

function cloneMcsDevice(device: McsDeviceState): McsDeviceState {
  if (device.kind !== 'impella') return { ...device }
  return { ...device, left: { ...device.left }, right: { ...device.right } }
}

export function patientToCirculationParameters(patient: McsPatientState): CirculationParameters {
  const preloadFraction = clamp(patient.preloadPercent / 100, 0.5, 1.45)
  return {
    heartRateBpm: patient.heartRateBpm,
    respiratoryRateBpm: 18,
    bodySurfaceAreaM2: 1.9,
    referenceCardiacOutputLMin: deriveNativeCardiacOutput(patient),
    circulatingVolumeFraction: preloadFraction,
    stressedVenousVolumeMl: 800 * preloadFraction,
    venousComplianceMlMmHg: 105,
    systemicVascularResistanceDynSecCm5: patient.systemicVascularResistanceDynSecCm5,
    pulmonaryVascularResistanceWU: patient.pulmonaryVascularResistanceWU,
    systemicArterialComplianceMlMmHg: 1.45,
    pulmonaryArterialComplianceMlMmHg: 2.3,
    leftVentricularContractility: patient.leftVentricularContractility,
    rightVentricularContractility: patient.rightVentricularContractility,
    leftVentricularCompliance: 0.72,
    rightVentricularCompliance: 0.82,
    rightAtrialPressureSetPointMmHg: 6,
    leftAtrialPressureSetPointMmHg: 10,
    pericardialPressureMmHg: patient.tamponade ? 14 : 0,
    peepCmH2O: patient.peepCmH2O,
    pleuralPressureSwingMmHg: 2,
    arterialOxygenSaturationPercent: 96,
    mixedVenousOxygenSaturationPercent: 58,
    tricuspidRegurgitationSeverity: 0.15,
    shuntFraction: 0,
    rhythmRegularity: patient.rhythm === 'atrial-fibrillation' ? 0.45 : 1,
    spontaneousBreathingFraction: 0.25,
    fluidResponsiveness: clamp((100 - patient.preloadPercent) / 45 + 0.45, 0, 1),
  }
}

export function deriveNativeCardiacOutput(patient: McsPatientState): number {
  const preload = clamp(patient.preloadPercent / 100, 0.45, 1.45)
  const afterload = clamp(1150 / patient.systemicVascularResistanceDynSecCm5, 0.55, 1.35)
  const rvDelivery = clamp(
    (patient.rightVentricularContractility * 1.2 * preload) /
      (0.82 + patient.pulmonaryVascularResistanceWU * 0.075),
    0.3,
    1.25,
  )
  const rhythm =
    patient.rhythm === 'atrial-fibrillation' ? 0.82 : patient.rhythm === 'paced' ? 0.92 : 1
  const tamponade = patient.tamponade ? 0.58 : 1
  const strokeVolume =
    74 *
    preload ** 0.38 *
    clamp(patient.leftVentricularContractility, 0.2, 1.5) ** 0.78 *
    afterload ** 0.42 *
    rvDelivery ** 0.45 *
    rhythm *
    tamponade
  return clamp((strokeVolume * patient.heartRateBpm) / 1000, 0.7, 10)
}

export function deriveBaselineMeasurements(patient: McsPatientState): HemodynamicMeasurements {
  const cardiacOutput = deriveNativeCardiacOutput(patient)
  const preload = patient.preloadPercent / 100
  const rvFailure = clamp(1 - patient.rightVentricularContractility, 0, 0.8)
  const lvFailure = clamp(1 - patient.leftVentricularContractility, 0, 0.8)
  const peepPressure = patient.peepCmH2O * 0.15
  const tamponadePressure = patient.tamponade ? 8 : 0
  const rap = clamp(
    4 +
      (preload - 1) * 12 +
      rvFailure * 16 +
      patient.pulmonaryVascularResistanceWU * 0.55 +
      peepPressure +
      tamponadePressure,
    1,
    30,
  )
  const pawp = clamp(
    7 +
      (preload - 1) * 15 +
      lvFailure * 22 +
      patient.aorticInsufficiencySeverity * 8 +
      peepPressure +
      tamponadePressure,
    3,
    38,
  )
  const meanPap = clamp(pawp + patient.pulmonaryVascularResistanceWU * cardiacOutput, 10, 70)
  const papPulse = clamp(13 * patient.rightVentricularContractility + 5, 5, 25)
  const papSystolic = meanPap + papPulse * 0.58
  const papDiastolic = meanPap - papPulse * 0.42
  const map = clamp(
    rap + (cardiacOutput * patient.systemicVascularResistanceDynSecCm5) / 80,
    35,
    145,
  )
  const strokeVolume = (cardiacOutput * 1000) / Math.max(35, patient.heartRateBpm)
  const pulsePressure = clamp(strokeVolume / 1.55, 10, 70)
  return {
    heartRateBpm: patient.heartRateBpm,
    spo2Percent: 96,
    artSystolicMmHg: map + pulsePressure * 0.62,
    artDiastolicMmHg: map - pulsePressure * 0.38,
    mapMmHg: map,
    rapMmHg: rap,
    rvSystolicMmHg: papSystolic,
    rvDiastolicMmHg: rap,
    papSystolicMmHg: papSystolic,
    papDiastolicMmHg: papDiastolic,
    meanPapMmHg: meanPap,
    pawpMmHg: pawp,
    cardiacOutputLMin: cardiacOutput,
    cardiacIndexLMinM2: cardiacOutput / 1.9,
    svo2Percent: clamp(48 + cardiacOutput * 3.2, 42, 78),
    pulsePressureMaxMmHg: pulsePressure,
    pulsePressureMinMmHg: pulsePressure * 0.88,
  }
}

/**
 * What a left-sided inflow-limitation alarm is actually reporting, in this model's own terms.
 *
 * The alarm a learner meets said "available LV blood volume is inadequate", and a fellow checked
 * that against the monitor beside it: wedge 20 mm Hg, displayed end-diastolic volume 134 mL — the
 * largest in the module (F25). Both readings were right. The alarm's predicate is not a chamber
 * volume at all: it turns on the smallest of three terms feeding the inlet, and in every state
 * measured for MCS-PRE-REVIEW-02 that smallest term was right-sided delivery. The sentence now
 * names the term the model used, so the two numbers stop contradicting each other.
 */
export function mcsLeftPreloadLimiterPhrase(limiter: McsLeftPreloadLimiter): string {
  if (limiter === 'rv-delivery')
    return 'right-sided delivery to the left heart — so this state can stand beside a left ventricle the monitor still shows as full, and the filling pressure beside it is not the quantity that raised it'
  if (limiter === 'lv-compartment-filling') return 'the modeled volume in the left ventricle itself'
  return 'the modeled circulating volume'
}

export interface SupportComputation {
  effect: MechanicalSupportEffect
  nativeFlowLMin: number
  leftDeviceFlowLMin: number
  rightDeviceFlowLMin: number
  deviceFlowLMin: number
  effectiveSystemicFlowLMin: number
  recirculatingFlowLMin: number
  leftUnloadingMagnitude: number
  rightUnloadingMagnitude: number
  timingQualityPercent: number | null
  pumpPowerW: number | null
  pulsatilityIndex: number | null
  /** The durable pump's displayed flow: an estimate calculated from power at the set speed. */
  estimatedPumpFlowLMin: number | null
  alarms: readonly McsAlarm[]
  diagnostics: McsSupportDiagnostics
}

function alarm(
  id: string,
  label: string,
  priority: McsAlarm['priority'],
  explanation: string,
): McsAlarm {
  return { id, label, priority, explanation, active: true }
}

function emptyEffect(nativeFlowLMin: number): MechanicalSupportEffect {
  return {
    transfers: [],
    nativeFlowLMin,
    deviceFlowLMin: 0,
    recirculatingFlowLMin: 0,
    effectiveSystemicFlowLMin: nativeFlowLMin,
  }
}

function computeIabpSupport(
  patient: McsPatientState,
  device: IabpDeviceState,
  timeSeconds: number,
  baselineNativeFlow: number,
): SupportComputation {
  const rhythmTriggerQuality =
    patient.rhythm === 'atrial-fibrillation'
      ? device.triggerSource === 'pressure'
        ? 0.74
        : device.triggerSource === 'ecg'
          ? 0.5
          : 0.4
      : device.triggerSource === 'ecg'
        ? 1
        : device.triggerSource === 'pressure'
          ? 0.9
          : 0.62
  const inflationQuality = clamp(1 - Math.abs(device.inflationOffsetMs) / 180, 0, 1)
  const deflationQuality = clamp(1 - Math.abs(device.deflationOffsetMs) / 180, 0, 1)
  const timingQuality = device.running
    ? rhythmTriggerQuality * (inflationQuality * 0.48 + deflationQuality * 0.52)
    : 0
  const assistFraction = device.running ? 1 / device.assistRatio : 0
  const lateDeflationHarm = clamp(device.deflationOffsetMs / 180, 0, 1) * 0.22
  const earlyInflationHarm = clamp(-device.inflationOffsetMs / 180, 0, 1) * 0.12
  const tachycardiaPenalty = clamp((patient.heartRateBpm - 120) / 100, 0, 0.22)
  const efficacy = timingQuality * assistFraction * (1 - tachycardiaPenalty)
  const nativeFlow = clamp(
    baselineNativeFlow * (1 + efficacy * 0.11 - lateDeflationHarm - earlyInflationHarm),
    0.5,
    10,
  )
  const iabpCycle = deriveIabpCycleState(timeSeconds, patient.heartRateBpm, device)
  const diastolicInflation = iabpCycle.inflated
  const effect: MechanicalSupportEffect = {
    transfers: [],
    leftOutflowResistanceMultiplier: clamp(
      1 - efficacy * 0.16 + lateDeflationHarm * 0.8 + earlyInflationHarm * 0.4,
      0.65,
      1.35,
    ),
    systemicArterialComplianceMultiplier: diastolicInflation
      ? clamp(1 - timingQuality * 0.34, 0.55, 1)
      : 1,
    nativeAfterloadDeltaMmHg: (lateDeflationHarm + earlyInflationHarm) * 18 - efficacy * 3,
    deviceFlowLMin: 0,
    recirculatingFlowLMin: 0,
    effectiveSystemicFlowLMin: nativeFlow,
  }
  const alarms: McsAlarm[] = []
  if (device.running && device.inflationOffsetMs < -55)
    alarms.push(
      alarm(
        'iabp-early-inflation',
        'Inflation before aortic-valve closure',
        'warning',
        'Early inflation increases impedance to LV ejection.',
      ),
    )
  if (device.running && device.inflationOffsetMs > 75)
    alarms.push(
      alarm(
        'iabp-late-inflation',
        'Late inflation',
        'advisory',
        'Late inflation loses diastolic augmentation.',
      ),
    )
  if (device.running && device.deflationOffsetMs > 65)
    alarms.push(
      alarm(
        'iabp-late-deflation',
        'Late deflation',
        'critical',
        'The next ejection begins against an inflated balloon.',
      ),
    )
  if (device.running && device.deflationOffsetMs < -85)
    alarms.push(
      alarm(
        'iabp-early-deflation',
        'Early deflation',
        'advisory',
        'Diastolic augmentation ends prematurely.',
      ),
    )
  if (device.running && rhythmTriggerQuality < 0.6)
    alarms.push(
      alarm(
        'iabp-trigger-unreliable',
        'Trigger reliability reduced',
        'warning',
        'Irregular rhythm and the selected trigger produce inconsistent assisted beats.',
      ),
    )
  if (device.running && baselineNativeFlow < 1.8)
    alarms.push(
      alarm(
        'iabp-low-efficacy',
        'Limited native output for counterpulsation',
        'warning',
        'IABP cannot replace profoundly limited native ejection.',
      ),
    )
  return {
    effect: {
      ...effect,
      nativeFlowLMin: nativeFlow,
      displaySignals: {
        assistRatio: `1:${device.assistRatio}`,
        triggerSource: device.triggerSource,
        timingQualityPercent: roundTo(timingQuality * 100, 0),
        balloonInflated: diastolicInflation,
      },
      alarms: alarms.map(({ id, active, priority }) => ({ id, active, priority })),
    },
    nativeFlowLMin: nativeFlow,
    leftDeviceFlowLMin: 0,
    rightDeviceFlowLMin: 0,
    deviceFlowLMin: 0,
    effectiveSystemicFlowLMin: nativeFlow,
    recirculatingFlowLMin: 0,
    leftUnloadingMagnitude: efficacy * 0.65,
    rightUnloadingMagnitude: 0,
    timingQualityPercent: roundTo(timingQuality * 100, 0),
    pumpPowerW: null,
    pulsatilityIndex: null,
    estimatedPumpFlowLMin: null,
    alarms,
    diagnostics: {
      kind: 'iabp',
      rhythmTriggerQuality,
      inflationQuality,
      deflationQuality,
      timingQuality,
      assistFraction,
      efficacy,
      earlyInflationHarm,
      lateDeflationHarm,
      inflationStartPhase: iabpCycle.inflationStart,
      deflationEndPhase: iabpCycle.deflationEnd,
      assistedBeat: iabpCycle.assistedBeat,
      balloonInflated: diastolicInflation,
    },
  }
}

function computeImpellaSupport(
  patient: McsPatientState,
  device: ImpellaDeviceState,
  compartments: CirculationCompartmentState,
  baseline: HemodynamicMeasurements,
): SupportComputation {
  const left = device.left
  const right = device.right
  const leftRunning = left.enabled && left.running && left.performanceLevel > 0
  const rightRunning = right.enabled && right.running && right.performanceLevel > 0
  const nativeRvDelivery = clamp(
    (patient.rightVentricularContractility * (patient.preloadPercent / 100)) /
      (0.7 + patient.pulmonaryVascularResistanceWU * 0.07),
    0.25,
    1.15,
  )
  const rightVenousFilling = Math.min(
    clamp(patient.preloadPercent / 90, 0.25, 1.15),
    clamp((compartments.systemicVenousVolumeMl - 700) / 1800, 0.2, 1.15),
    clamp((compartments.systemicVenousPressureMmHg + 2) / 10, 0.22, 1.15),
  )
  const rightPressureGradientMmHg = clamp(
    compartments.pulmonaryArterialPressureMmHg - compartments.systemicVenousPressureMmHg,
    4,
    90,
  )
  const rightAfterloadFactor = Math.min(
    clamp(1 - Math.max(0, rightPressureGradientMmHg - 18) * 0.013, 0.34, 1.08),
    clamp(1 - Math.max(0, patient.pulmonaryVascularResistanceWU - 2) * 0.075, 0.35, 1.08),
  )
  const rightPositionFactor =
    right.position === 'correct'
      ? 1
      : right.position === 'inlet-too-high'
        ? 0.42
        : right.position === 'outlet-too-proximal'
          ? 0.5
          : 0.55
  const rightTargetFlow = rightRunning ? 4 * (clamp(right.performanceLevel, 0, 9) / 9) ** 0.86 : 0
  const rightSuction = rightRunning && right.performanceLevel >= 5 && rightVenousFilling < 0.54
  const rightSuctionFactor = rightSuction ? clamp(rightVenousFilling / 0.54, 0.2, 0.9) : 1
  const rightDeviceFlow = clamp(
    rightTargetFlow *
      rightVenousFilling *
      rightAfterloadFactor *
      rightPositionFactor *
      rightSuctionFactor,
    0,
    4,
  )

  // RP flow bypasses the RV and can restore pulmonary delivery to the LV, but it is not
  // additional systemic pump flow. The serial coupling is also carried by the compartment
  // transfer below, so subsequent fixed steps respond to the changed PA/PV/LV volumes.
  const rpDeliveryGain = (rightDeviceFlow / 4) * clamp(1 - nativeRvDelivery, 0, 0.75) * 0.78
  const rvDeliveryToLeftHeart = clamp(nativeRvDelivery + rpDeliveryGain, 0.25, 1.2)
  const lvFilling = clamp((compartments.leftVentricularVolumeMl - 25) / 85, 0.18, 1.2)
  const circulatingVolumeFactor = clamp(patient.preloadPercent / 90, 0.25, 1.15)
  const leftPreloadFactor = Math.min(rvDeliveryToLeftHeart, lvFilling, circulatingVolumeFactor)
  /*
   * Which of the three terms is the smallest, in the order the minimum is written.
   *
   * The suction predicate below turns on `leftPreloadFactor`, so "the left ventricle is empty" is
   * not what this alarm always means: right-sided delivery can be the smallest term while the
   * displayed LV end-diastolic volume — a separate educational surrogate derived in
   * `deriveMcsMetrics` — stays high (F25). Naming the limiter is inspection only; it changes no
   * flow, no alarm and no displayed number.
   */
  const leftPreloadLimiter: McsLeftPreloadLimiter =
    leftPreloadFactor === rvDeliveryToLeftHeart
      ? 'rv-delivery'
      : leftPreloadFactor === lvFilling
        ? 'lv-compartment-filling'
        : 'circulating-volume'
  const leftPressureGradientMmHg = clamp(
    compartments.systemicArterialPressureMmHg - compartments.pulmonaryVenousPressureMmHg,
    20,
    180,
  )
  const leftPressureGradientFactor = clamp(
    1 - Math.max(0, leftPressureGradientMmHg - 65) * 0.0045,
    0.46,
    1.08,
  )
  const leftAfterloadFactor = Math.min(
    clamp(1 - Math.max(0, baseline.mapMmHg - 75) * 0.005, 0.46, 1.08),
    leftPressureGradientFactor,
  )
  const leftPositionFactor =
    left.position === 'correct' ? 1 : left.position === 'too-deep' ? 0.48 : 0.36
  const leftLevel = Math.round(clamp(left.performanceLevel, 0, 9))
  const leftLevelRange = IMPELLA_MEAN_FLOW_BY_P_LEVEL_LMIN[left.variant === '55' ? '55' : 'cp'][
    leftLevel
  ] ?? [0, 0]
  // The manual gives a mean-flow range for each P-level; where a patient sits in it depends on
  // the pressure the pump works against. The level's ceiling is the flow at favorable loading.
  const leftMaximumFlow = leftLevelRange[1]
  const leftTargetFlow = leftRunning ? leftMaximumFlow * IMPELLA_FAVORABLE_LOADING_GAIN : 0
  const leftSuction =
    leftRunning &&
    left.performanceLevel >= 5 &&
    leftPreloadFactor < LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD
  const leftSuctionFactor = leftSuction
    ? clamp(leftPreloadFactor / LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD, 0.2, 0.9)
    : 1
  const leftDeviceFlow = clamp(
    leftTargetFlow *
      leftPreloadFactor *
      leftAfterloadFactor *
      leftPositionFactor *
      leftSuctionFactor,
    0,
    leftMaximumFlow,
  )
  const recirculatingFlow = leftDeviceFlow * clamp(patient.aorticInsufficiencySeverity, 0, 1) * 0.42
  const rightBridgeGain = rightDeviceFlow * clamp(1 - nativeRvDelivery, 0, 0.75) * 0.1
  const nativeFlow = clamp(
    baseline.cardiacOutputLMin *
      (1 + rightBridgeGain) *
      (1 - Math.min(0.48, leftDeviceFlow * 0.075)),
    0.25,
    10,
  )
  const effectiveFlow = clamp(nativeFlow + leftDeviceFlow - recirculatingFlow, 0.25, 12)
  const effect: MechanicalSupportEffect = {
    transfers: [
      ...(leftRunning
        ? [
            {
              from: 'left-ventricular' as const,
              to: 'systemic-arterial' as const,
              flowLMin: leftDeviceFlow,
            },
          ]
        : []),
      ...(rightRunning
        ? [
            {
              from: 'systemic-venous' as const,
              to: 'pulmonary-arterial' as const,
              flowLMin: rightDeviceFlow,
            },
          ]
        : []),
    ],
    leftOutflowResistanceMultiplier: 1 + Math.min(0.35, leftDeviceFlow * 0.05),
    deviceFlowLMin: leftDeviceFlow,
    recirculatingFlowLMin: recirculatingFlow,
    effectiveSystemicFlowLMin: effectiveFlow,
  }
  const alarms: McsAlarm[] = []
  if (leftSuction)
    alarms.push(
      alarm(
        'impella-left-suction',
        'Left Impella suction detected',
        'critical',
        `With the left pump running at P5 or above, this model raises suction when its left-preload minimum is below ${LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD}. Here a minimum term is ${mcsLeftPreloadLimiterPhrase(leftPreloadLimiter)}. This is an authored modeled state, not a device's own suction logic.`,
      ),
    )
  if (left.enabled && left.position !== 'correct')
    alarms.push(
      alarm(
        'impella-left-position',
        'Left Impella position signal abnormal',
        'critical',
        'The educational placement state reduces effective flow and raises blood-trauma risk.',
      ),
    )
  if (left.enabled && left.purgeState === 'high-pressure')
    alarms.push(
      alarm(
        'impella-left-purge-high',
        'Left Impella purge pressure high',
        'warning',
        'Evaluate for a purge-path obstruction or other current-IFU cause.',
      ),
    )
  if (left.enabled && left.purgeState === 'low-pressure')
    alarms.push(
      alarm(
        'impella-left-purge-low',
        'Left Impella purge pressure low',
        'warning',
        'Evaluate for a leak or purge-system failure using current instructions.',
      ),
    )
  if (leftRunning && leftDeviceFlow < 1.5)
    alarms.push(
      alarm(
        'impella-left-low-flow',
        'Left Impella flow below expectation',
        'warning',
        'Reconcile preload, RV function, position, and afterload before escalating support.',
      ),
    )
  if (left.enabled && (leftSuction || left.position !== 'correct'))
    alarms.push(
      alarm(
        'impella-left-hemolysis-risk',
        'Left Impella hemolysis-risk pattern',
        'warning',
        'Suction or malposition increases the modeled blood-trauma risk.',
      ),
    )
  if (rightSuction)
    alarms.push(
      alarm(
        'impella-right-suction',
        'RP inflow suction detected',
        'critical',
        'Available caval/atrial blood volume is inadequate for the selected right-sided support.',
      ),
    )
  if (right.enabled && right.position !== 'correct')
    alarms.push(
      alarm(
        'impella-right-position',
        'RP position signal abnormal',
        'critical',
        'The modeled IVC inflow or pulmonary-artery outflow relationship is not in its teaching target.',
      ),
    )
  if (right.enabled && right.purgeState === 'high-pressure')
    alarms.push(
      alarm(
        'impella-right-purge-high',
        'RP purge pressure high',
        'warning',
        'Evaluate the RP purge path using the current device instructions.',
      ),
    )
  if (right.enabled && right.purgeState === 'low-pressure')
    alarms.push(
      alarm(
        'impella-right-purge-low',
        'RP purge pressure low',
        'warning',
        'Evaluate for a leak or purge-system failure using current instructions.',
      ),
    )
  if (rightRunning && rightDeviceFlow < 1.2)
    alarms.push(
      alarm(
        'impella-right-low-flow',
        'RP flow below expectation',
        'warning',
        'Reconcile venous filling, PVR, pulmonary pressure, and position before escalating support.',
      ),
    )
  const pumpBalance = rightDeviceFlow - leftDeviceFlow
  if (
    rightRunning &&
    pumpBalance > 1.2 &&
    (patient.leftVentricularContractility < 0.65 || (baseline.pawpMmHg ?? 10) >= 16)
  )
    alarms.push(
      alarm(
        'impella-right-flow-imbalance',
        'Right-to-left pump imbalance',
        'warning',
        'Modeled RP delivery exceeds left-heart handling; reconcile PA pressure, PCWP, LV filling, and both pump flows.',
      ),
    )
  return {
    effect: {
      ...effect,
      nativeFlowLMin: nativeFlow,
      displaySignals: {
        leftVariant: left.variant,
        leftPerformanceLevel: left.performanceLevel,
        leftPlacementState: left.position,
        leftPurgeState: left.purgeState,
        leftPressureGradientMmHg: roundTo(leftPressureGradientMmHg, 0),
        pressureGradientMmHg: roundTo(leftPressureGradientMmHg, 0),
        leftSuction,
        rightPerformanceLevel: right.performanceLevel,
        rightPlacementState: right.position,
        rightPurgeState: right.purgeState,
        rightPressureGradientMmHg: roundTo(rightPressureGradientMmHg, 0),
        rightSuction,
        rightDeviceFlowLMin: roundTo(rightDeviceFlow, 2),
      },
      alarms: alarms.map(({ id, active, priority }) => ({ id, active, priority })),
    },
    nativeFlowLMin: nativeFlow,
    leftDeviceFlowLMin: leftDeviceFlow,
    rightDeviceFlowLMin: rightDeviceFlow,
    deviceFlowLMin: leftDeviceFlow,
    effectiveSystemicFlowLMin: effectiveFlow,
    recirculatingFlowLMin: recirculatingFlow,
    leftUnloadingMagnitude: leftDeviceFlow * 0.72,
    rightUnloadingMagnitude: rightDeviceFlow * 0.66,
    timingQualityPercent: null,
    pumpPowerW: null,
    pulsatilityIndex: null,
    estimatedPumpFlowLMin: null,
    alarms,
    diagnostics: {
      kind: 'impella',
      nativeRvDelivery,
      rpDeliveryGain,
      rvDeliveryToLeftHeart,
      lvCompartmentFilling: lvFilling,
      circulatingVolumeFactor,
      leftPreloadFactor,
      leftPreloadLimiter,
      leftAfterloadFactor,
      leftPositionFactor,
      leftTargetFlow,
      leftDeviceFlow,
      leftSuction,
      leftSuctionThreshold: LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD,
      rightVenousFilling,
      rightAfterloadFactor,
      rightPositionFactor,
      rightTargetFlow,
      rightDeviceFlow,
      rightSuction,
      leftVentricularCompartmentVolumeMl: compartments.leftVentricularVolumeMl,
    },
  }
}

function computeLvadSupport(
  patient: McsPatientState,
  device: LvadDeviceState,
  compartments: CirculationCompartmentState,
  baseline: HemodynamicMeasurements,
): SupportComputation {
  const running = device.running && device.powerConnected && !device.controllerFault
  const targetFlow = running ? 3.45 + (device.speedRpm - 4600) * 0.00105 : 0
  const rvDelivery = clamp(
    (patient.rightVentricularContractility * (patient.preloadPercent / 100)) /
      (0.68 + patient.pulmonaryVascularResistanceWU * 0.075),
    0.22,
    1.18,
  )
  const lvFilling = clamp((compartments.leftVentricularVolumeMl - 25) / 82, 0.15, 1.18)
  const pressureGradientMmHg = clamp(
    compartments.systemicArterialPressureMmHg - compartments.pulmonaryVenousPressureMmHg,
    20,
    180,
  )
  const pressureGradientFactor = clamp(
    1 - Math.max(0, pressureGradientMmHg - 68) * 0.0042,
    0.42,
    1.08,
  )
  const afterloadFactor = Math.min(
    clamp(1 - Math.max(0, baseline.mapMmHg - 78) * 0.0046, 0.42, 1.08),
    pressureGradientFactor,
  )
  const tamponadeFactor = patient.tamponade ? 0.52 : 1
  const fillingLimiter: McsLvadFillingLimiter =
    Math.min(rvDelivery, lvFilling) === rvDelivery ? 'rv-delivery' : 'lv-compartment-filling'
  const thrombosisFlowFraction =
    running && device.suspectedPumpThrombosis ? LVAD_THROMBOSIS_FLOW_FRACTION : 1
  const deviceFlow = clamp(
    targetFlow *
      Math.min(rvDelivery, lvFilling) *
      afterloadFactor *
      tamponadeFactor *
      thrombosisFlowFraction,
    0,
    7.5,
  )
  const recirculatingFlow = deviceFlow * clamp(patient.aorticInsufficiencySeverity, 0, 1) * 0.5
  const nativeFlow = clamp(
    baseline.cardiacOutputLMin * (1 - Math.min(0.68, deviceFlow * 0.1)),
    0.12,
    10,
  )
  const effectiveFlow = clamp(nativeFlow + deviceFlow - recirculatingFlow, 0.12, 12)
  const suction =
    running &&
    deviceFlow > LVAD_SUCTION_MINIMUM_FLOW_LMIN &&
    (lvFilling < LVAD_SUCTION_FILLING_THRESHOLD || rvDelivery < LVAD_SUCTION_FILLING_THRESHOLD)
  // Power is what the controller measures: the work of moving the blood plus, with thrombus on
  // the rotor, the work of turning against it.
  const speedPowerW = (device.speedRpm - 4600) / 1700
  const pumpPower = running
    ? LVAD_POWER_AT_REFERENCE_SPEED_W +
      deviceFlow * LVAD_POWER_PER_FLOW_W +
      speedPowerW +
      (device.suspectedPumpThrombosis ? LVAD_SUSPECTED_THROMBOSIS_POWER_W : 0)
    : 0
  // Flow is what the controller estimates, from power at the set speed. With no fault the
  // estimate equals the hydraulic flow. With thrombus the extra power reads as extra flow.
  const estimatedFlow = running
    ? clamp(
        (pumpPower - LVAD_POWER_AT_REFERENCE_SPEED_W - speedPowerW) / LVAD_POWER_PER_FLOW_W,
        0,
        10,
      )
    : 0
  // Pulsatility index follows the flow pulse the filled, contracting ventricle pushes through
  // the pump each beat. It falls when the ventricle is underfilled (hypovolemia, tamponade, right
  // heart failure), when speed is high, and with thrombus; it rises with afterload and recovery.
  const fillingForPulse = clamp(Math.min(rvDelivery, lvFilling) * tamponadeFactor, 0.15, 1.18)
  const flowAtFullFilling = Math.max(0.5, targetFlow * afterloadFactor)
  const pi = running
    ? clamp(
        ((nativeFlow / flowAtFullFilling) * 3.4 + patient.preloadPercent / 70) *
          fillingForPulse *
          (device.suspectedPumpThrombosis ? 0.6 : 1),
        0.7,
        8,
      )
    : 0
  const effect: MechanicalSupportEffect = {
    transfers: running
      ? [{ from: 'left-ventricular', to: 'systemic-arterial', flowLMin: deviceFlow }]
      : [],
    leftOutflowResistanceMultiplier: 1 + Math.min(0.5, deviceFlow * 0.07),
    deviceFlowLMin: deviceFlow,
    recirculatingFlowLMin: recirculatingFlow,
    effectiveSystemicFlowLMin: effectiveFlow,
  }
  const alarms: McsAlarm[] = []
  if (!device.powerConnected)
    alarms.push(
      alarm(
        'lvad-power-disconnected',
        'External power disconnected',
        'critical',
        'The pump has stopped. Reconnect a power source now: a charged battery or the power module.',
      ),
    )
  if (device.controllerFault)
    alarms.push(
      alarm(
        'lvad-controller-fault',
        'Controller fault',
        'critical',
        'Check the driveline connection and power, then change to the backup controller. Call the LVAD team while you do it.',
      ),
    )
  // The controller alarms on the flow it displays, which is the estimate.
  if (running && estimatedFlow < 2.5)
    alarms.push(
      alarm(
        'lvad-low-flow',
        'Low-flow alarm',
        'warning',
        'Low flow with low pulsatility: think underfilling, right heart failure or tamponade. Low flow with high pulsatility: think high afterload or an obstructed graft.',
      ),
    )
  if (suction)
    alarms.push(
      alarm(
        'lvad-suction',
        'Inflow suction pattern',
        'critical',
        `The left ventricle is too empty for the set speed, and the inflow cannula is drawing against the wall. Here the cause is ${[
          rvDelivery < LVAD_SUCTION_FILLING_THRESHOLD ? 'poor right-sided delivery' : null,
          lvFilling < LVAD_SUCTION_FILLING_THRESHOLD ? 'low left-ventricular filling' : null,
        ]
          .filter(Boolean)
          .join(
            ' and ',
          )}. Give volume or treat the right heart; lowering speed relieves it meanwhile.`,
      ),
    )
  if (device.suspectedPumpThrombosis)
    alarms.push(
      alarm(
        'lvad-high-power',
        'High-power pattern',
        'critical',
        'Power is up and the flow estimate has risen with it, while pulsatility and the patient have fallen. That combination is pump thrombosis until proven otherwise: the estimate is calculated from power, so it reads falsely high.',
      ),
    )
  if (patient.aorticInsufficiencySeverity >= 0.5)
    alarms.push(
      alarm(
        'lvad-recirculation',
        'Aortic regurgitant recirculation',
        'warning',
        'Part of pump flow returns to the LV and does not become effective systemic flow.',
      ),
    )
  return {
    effect: {
      ...effect,
      nativeFlowLMin: nativeFlow,
      displaySignals: {
        speedRpm: device.speedRpm,
        pumpPowerW: roundTo(pumpPower, 1),
        pulsatilityIndex: roundTo(pi, 1),
        pressureGradientMmHg: roundTo(pressureGradientMmHg, 0),
        powerConnected: device.powerConnected,
      },
      alarms: alarms.map(({ id, active, priority }) => ({ id, active, priority })),
    },
    nativeFlowLMin: nativeFlow,
    leftDeviceFlowLMin: deviceFlow,
    rightDeviceFlowLMin: 0,
    deviceFlowLMin: deviceFlow,
    effectiveSystemicFlowLMin: effectiveFlow,
    recirculatingFlowLMin: recirculatingFlow,
    leftUnloadingMagnitude: deviceFlow * 0.62,
    rightUnloadingMagnitude: 0,
    timingQualityPercent: null,
    pumpPowerW: roundTo(pumpPower, 1),
    pulsatilityIndex: roundTo(pi, 1),
    estimatedPumpFlowLMin: roundTo(estimatedFlow, 2),
    alarms,
    diagnostics: {
      kind: 'lvad',
      targetFlow,
      rvDelivery,
      lvCompartmentFilling: lvFilling,
      fillingLimiter,
      afterloadFactor,
      pressureGradientFactor,
      baselineMapMmHg: baseline.mapMmHg,
      // Filled in by `resolveMcsSupport`, which knows the displayed mean arterial pressure.
      highAfterloadPredicateInput: 0,
      highAfterloadPredicateMet: false,
      deviceFlow,
      estimatedFlow,
      pumpPower,
      thrombosisPowerAdditionW: device.suspectedPumpThrombosis
        ? LVAD_SUSPECTED_THROMBOSIS_POWER_W
        : 0,
      pulsatilityIndex: pi,
      suction,
      leftVentricularCompartmentVolumeMl: compartments.leftVentricularVolumeMl,
    },
  }
}

export function computeMechanicalSupport(
  patient: McsPatientState,
  device: McsDeviceState,
  compartments: CirculationCompartmentState,
  baseline: HemodynamicMeasurements,
  timeSeconds: number,
): SupportComputation {
  if (device.kind === 'iabp')
    return computeIabpSupport(patient, device, timeSeconds, baseline.cardiacOutputLMin)
  if (device.kind === 'impella')
    return computeImpellaSupport(patient, device, compartments, baseline)
  return computeLvadSupport(patient, device, compartments, baseline)
}

export function deriveMcsMetrics(
  patient: McsPatientState,
  compartments: CirculationCompartmentState,
  baseline: HemodynamicMeasurements,
  support: SupportComputation,
): McsDerivedMetrics {
  // The six-compartment solver tracks conserved reservoir volume continuously,
  // whereas LVEDV is an end-diastolic educational surrogate.  Derive that
  // surrogate from loading, contractility, valve recirculation, and unloading,
  // retaining a deliberately small signal from the conserved LV compartment.
  // This prevents phase accumulation in the fixed-step reservoir from being
  // misrepresented to learners as progressive chamber dilation.
  const modeledLvedv = clamp(
    102 +
      (patient.preloadPercent - 100) * 0.55 +
      (1 - patient.leftVentricularContractility) * 45 +
      patient.aorticInsufficiencySeverity * 28 -
      support.leftUnloadingMagnitude * 11 +
      Math.max(0, support.rightDeviceFlowLMin - support.leftDeviceFlowLMin) * 2.4 -
      (patient.tamponade ? 15 : 0) -
      Math.max(0, patient.peepCmH2O - 5) * 0.7 +
      clamp((compartments.leftVentricularVolumeMl - 120) * 0.1, -10, 14),
    35,
    220,
  )
  const volumeRapDelta = (compartments.rightVentricularVolumeMl - 140) * 0.018
  const volumePcwpDelta = (modeledLvedv - 120) * 0.055
  const rap = clamp(
    baseline.rapMmHg + volumeRapDelta - support.rightUnloadingMagnitude * 1.25,
    1,
    35,
  )
  const pcwp = clamp(
    (baseline.pawpMmHg ?? 10) +
      volumePcwpDelta -
      support.leftUnloadingMagnitude * 1.1 +
      Math.max(0, support.rightDeviceFlowLMin - support.leftDeviceFlowLMin) * 0.72 +
      support.recirculatingFlowLMin * 1.2,
    2,
    42,
  )
  const mapFromFlow =
    rap + (support.effectiveSystemicFlowLMin * patient.systemicVascularResistanceDynSecCm5) / 80
  const map = clamp(mapFromFlow * 0.74 + compartments.systemicArterialPressureMmHg * 0.26, 30, 155)
  const nativeFraction = support.nativeFlowLMin / Math.max(0.5, baseline.cardiacOutputLMin)
  const pulsePressure = clamp(
    (baseline.artSystolicMmHg - baseline.artDiastolicMmHg) * nativeFraction,
    3,
    80,
  )
  const modeledPulmonaryThroughput = Math.max(
    support.nativeFlowLMin,
    support.nativeFlowLMin * 0.72 + support.rightDeviceFlowLMin,
  )
  const papMean = clamp(
    pcwp + patient.pulmonaryVascularResistanceWU * modeledPulmonaryThroughput,
    8,
    75,
  )
  const papPulse = clamp(5 + patient.rightVentricularContractility * 14, 4, 24)
  const papSystolic = papMean + papPulse * 0.58
  const papDiastolic = papMean - papPulse * 0.42
  const papi = clamp((papSystolic - papDiastolic) / Math.max(1, rap), 0.1, 8)
  const svo2 = clamp(43 + support.effectiveSystemicFlowLMin * 4.1, 38, 82)
  return {
    nativeFlowLMin: roundTo(support.nativeFlowLMin, 2),
    leftDeviceFlowLMin: roundTo(support.leftDeviceFlowLMin, 2),
    rightDeviceFlowLMin: roundTo(support.rightDeviceFlowLMin, 2),
    pumpBalanceLMin: roundTo(support.rightDeviceFlowLMin - support.leftDeviceFlowLMin, 2),
    deviceFlowLMin: roundTo(support.deviceFlowLMin, 2),
    effectiveSystemicFlowLMin: roundTo(support.effectiveSystemicFlowLMin, 2),
    recirculatingFlowLMin: roundTo(support.recirculatingFlowLMin, 2),
    mapMmHg: roundTo(map, 0),
    pulsePressureMmHg: roundTo(pulsePressure, 0),
    rapMmHg: roundTo(rap, 0),
    pcwpMmHg: roundTo(pcwp, 0),
    lvedpMmHg: roundTo(pcwp + clamp((modeledLvedv - 105) * 0.025, -2, 6), 0),
    lvedvMl: roundTo(modeledLvedv, 0),
    papSystolicMmHg: roundTo(papSystolic, 0),
    papDiastolicMmHg: roundTo(papDiastolic, 0),
    papi: roundTo(papi, 1),
    cardiacPowerOutputW: roundTo((map * support.effectiveSystemicFlowLMin) / 451, 2),
    svo2Percent: roundTo(svo2, 0),
    aorticValveOpening: support.nativeFlowLMin >= 0.85 && pulsePressure >= 7,
    timingQualityPercent: support.timingQualityPercent,
    pumpPowerW: support.pumpPowerW,
    pulsatilityIndex: support.pulsatilityIndex,
    estimatedPumpFlowLMin: support.estimatedPumpFlowLMin,
  }
}

/**
 * Support and metrics for one instant, with the alarms that depend on a displayed value.
 *
 * The durable pump's afterload alarm reads the mean arterial pressure on the monitor. That value
 * exists only once the metrics are derived, so the alarm is added here.
 */
export function resolveMcsSupport(
  patient: McsPatientState,
  device: McsDeviceState,
  compartments: CirculationCompartmentState,
  baseline: HemodynamicMeasurements,
  timeSeconds: number,
): { support: SupportComputation; metrics: McsDerivedMetrics } {
  const support = computeMechanicalSupport(patient, device, compartments, baseline, timeSeconds)
  const metrics = deriveMcsMetrics(patient, compartments, baseline, support)
  if (device.kind !== 'lvad' || support.diagnostics.kind !== 'lvad') return { support, metrics }
  const running = device.running && device.powerConnected && !device.controllerFault
  const met = running && metrics.mapMmHg > LVAD_HIGH_AFTERLOAD_MAP_MMHG
  const alarms = met
    ? [
        ...support.alarms,
        alarm(
          'lvad-high-afterload',
          'High afterload',
          'warning',
          `Mean arterial pressure is above ${LVAD_HIGH_AFTERLOAD_MAP_MMHG} mm Hg. A continuous-flow pump is afterload-sensitive: the higher the pressure it pumps against, the lower its flow. Lower the blood pressure; do not raise the speed.`,
        ),
      ]
    : support.alarms
  return {
    support: {
      ...support,
      alarms,
      effect: {
        ...support.effect,
        alarms: alarms.map(({ id, active, priority }) => ({ id, active, priority })),
      },
      diagnostics: {
        ...support.diagnostics,
        highAfterloadPredicateInput: metrics.mapMmHg,
        highAfterloadPredicateMet: met,
      },
    },
    metrics,
  }
}

function assistedIabpBeat(device: McsDeviceState, patient: McsPatientState, time: number): boolean {
  return (
    device.kind === 'iabp' &&
    device.running &&
    cycleIndex(time, patient.heartRateBpm) % device.assistRatio === 0
  )
}

/**
 * The modeled ECG, in millivolts, at any instant: three fixed-amplitude Gaussian deflections per
 * cycle, placed by the cycle phase alone. Nothing in it varies QRS amplitude from beat to beat.
 *
 * It is exported, unchanged, so the monitor can draw the trace between the 50 Hz samples. The QRS
 * deflection is 0.012 of a cycle wide — about 9 ms at 80 per minute — so a 20 ms sample lands at a
 * different point on each spike, and straight lines between samples drew a different peak height
 * on every beat, which a learner read as possible electrical alternans (F04). The samples
 * themselves are generated from this same expression and are not changed.
 */
export function mcsEcgMillivolts(time: number, heartRateBpm: number): number {
  const phase = cyclePhase(time, heartRateBpm)
  const p = (center: number, width: number) => gaussian(phase, center, width)
  return p(0.08, 0.012) - 0.22 * p(0.105, 0.014) + 0.42 * p(0.3, 0.045)
}

/** The phases, as fractions of a cycle, at which the three ECG deflections peak. */
export const MCS_ECG_DEFLECTION_PHASES = [0.08, 0.105, 0.3] as const

/** Cycle fraction from the inflation point to the augmented peak. */
const IABP_AUGMENTATION_PEAK_DELAY = 0.09
/**
 * Augmented diastolic peak above the diastolic floor, in pulse pressures, at full timing quality.
 * The unassisted systolic peak sits about 1.1 pulse pressures above the same floor, so at aligned
 * timing the augmented peak clears systole, and it falls below systole as timing quality drops.
 * The Getinge teaching booklet's console example reads augmentation 116 against systole 102.
 */
export const IABP_AUGMENTATION_PULSE_PRESSURES = 1.5
/** Fall in end-diastolic pressure after a well-timed deflation, in pulse pressures. */
export const IABP_END_DIASTOLIC_REDUCTION_PULSE_PRESSURES = 0.3
/** Fall in the systolic peak of the beat after a well-timed deflation, as a fraction. */
export const IABP_ASSISTED_SYSTOLE_REDUCTION = 0.14

interface IabpPressureEffect {
  /** Augmented peak above the diastolic floor, in pulse pressures. */
  augmentation: number
  /** End-diastolic change in pulse pressures: negative lowers it, positive raises it. */
  endDiastolic: number
  /** Cycle phase at which the end-diastolic change is centered. */
  deflationCenter: number
  /** Fractional change in the next beat's systolic pulse: negative lowers it. */
  assistedSystole: number
}

/**
 * How balloon timing shapes the arterial trace.
 *
 * Deflation just before ejection lowers the end-diastolic pressure and the next systolic peak.
 * Early deflation drops the pressure too soon: it recovers before the valve opens, so neither
 * reduction is kept. Late deflation leaves the balloon inflated into ejection: end-diastolic
 * pressure is at or above the unassisted value and the next systole is not reduced. The same
 * late-deflation harm already raises afterload in `computeIabpSupport`.
 */
function iabpPressureEffect(device: IabpDeviceState, timingQuality: number): IabpPressureEffect {
  const late = clamp(device.deflationOffsetMs / 160, 0, 1)
  const early = clamp(-device.deflationOffsetMs / 160, 0, 1)
  const deflationQuality = clamp(1 - Math.abs(device.deflationOffsetMs) / 180, 0, 1)
  // The trigger term of timing quality, recovered so that an unreliable trigger weakens every
  // balloon effect and not only the augmentation.
  const inflationQuality = clamp(1 - Math.abs(device.inflationOffsetMs) / 180, 0, 1)
  const blended = inflationQuality * 0.48 + deflationQuality * 0.52
  const triggerQuality = blended > 0 ? clamp(timingQuality / blended, 0, 1) : 0
  const unloading = triggerQuality * (1 - early) * (1 - 2 * late)
  return {
    augmentation: IABP_AUGMENTATION_PULSE_PRESSURES * timingQuality,
    endDiastolic: -IABP_END_DIASTOLIC_REDUCTION_PULSE_PRESSURES * unloading,
    deflationCenter: 0.985 - early * 0.12,
    assistedSystole: -IABP_ASSISTED_SYSTOLE_REDUCTION * Math.max(0, unloading),
  }
}

export function generateMcsWaveformSample(
  time: number,
  patient: McsPatientState,
  device: McsDeviceState,
  metrics: McsDerivedMetrics,
): McsWaveformSample {
  const phase = cyclePhase(time, patient.heartRateBpm)
  const assistedBeat = assistedIabpBeat(device, patient, time)
  const p = (center: number, width: number) => gaussian(phase, center, width)
  const ecg = mcsEcgMillivolts(time, patient.heartRateBpm)
  const pulse = metrics.pulsePressureMmHg
  let systolicScale = 1
  let iabpPressure = 0
  if (device.kind === 'iabp' && device.running && metrics.timingQualityPercent !== null) {
    const cycle = deriveIabpCycleState(time, patient.heartRateBpm, device)
    const effect = iabpPressureEffect(device, metrics.timingQualityPercent / 100)
    if (cycle.assistedBeat) {
      // Inflation: a sharp rise from the inflation point to a peak that clears systole when the
      // timing is right. It scales with pulse pressure, as the displaced volume acts on the same
      // aorta that the stroke volume does.
      iabpPressure +=
        pulse * effect.augmentation * p(cycle.inflationStart + IABP_AUGMENTATION_PEAK_DELAY, 0.07)
      // Deflation: the pressure change just before the next ejection, read at end-diastole.
      iabpPressure += pulse * effect.endDiastolic * p(effect.deflationCenter, 0.045)
    }
    if (cycle.previousBeatAssisted) {
      // The same deflation, seen from the start of the beat that follows it.
      iabpPressure += pulse * effect.endDiastolic * p(effect.deflationCenter - 1, 0.045)
      systolicScale = 1 + effect.assistedSystole
    }
  }
  const systolicPulse = (p(0.24, 0.1) + 0.22 * p(0.39, 0.13)) * systolicScale
  const arterialDiastolic = metrics.mapMmHg - pulse * 0.38
  const arterial = arterialDiastolic + pulse * systolicPulse + iabpPressure
  const lvPressure =
    metrics.lvedpMmHg + Math.max(0, metrics.mapMmHg + 18 - metrics.lvedpMmHg) * p(0.24, 0.11)
  const papMean = (metrics.papSystolicMmHg + 2 * metrics.papDiastolicMmHg) / 3
  const pap =
    metrics.papDiastolicMmHg + (metrics.papSystolicMmHg - metrics.papDiastolicMmHg) * p(0.27, 0.12)
  const cvp = metrics.rapMmHg + 1.8 * p(0.02, 0.055) + 1.3 * p(0.72, 0.07) - 1.1 * p(0.25, 0.1)
  const pcwp = metrics.pcwpMmHg + 1.2 * p(0.04, 0.06) + 2.1 * p(0.53, 0.1) - 0.8 * p(0.28, 0.08)
  const filling = 14 * p(0.72, 0.22)
  const ejection = 24 * p(0.28, 0.16)
  const lvVolume = clamp(metrics.lvedvMl + filling - ejection, 24, 260)
  return {
    time,
    ecgMv: roundTo(ecg, 3),
    arterialMmHg: roundTo(arterial, 2),
    lvMmHg: roundTo(lvPressure, 2),
    papMmHg: roundTo(Number.isFinite(pap) ? pap : papMean, 2),
    cvpMmHg: roundTo(cvp, 2),
    pcwpMmHg: roundTo(pcwp, 2),
    lvVolumeMl: roundTo(lvVolume, 2),
    deviceFlowLMin: metrics.deviceFlowLMin,
    assistedBeat,
  }
}

export interface IabpLandmarkPressures {
  /** Systolic peak of a beat that follows an unassisted diastole. Null at 1:1. */
  unassistedSystolicMmHg: number | null
  /** Peak of the balloon's diastolic augmentation. */
  augmentedDiastolicMmHg: number
  /** Systolic peak of the beat that follows balloon deflation. */
  assistedSystolicMmHg: number
  /** Lowest pressure before a beat that follows an unassisted diastole. Null at 1:1. */
  unassistedEndDiastolicMmHg: number | null
  /** Lowest pressure before the beat that follows balloon deflation. */
  assistedEndDiastolicMmHg: number
}

/**
 * The five pressures a balloon-pump arterial trace is read by, measured from the same expression
 * that draws the strip. At 1:1 every beat is assisted, so the two unassisted values are null:
 * compare them at 1:2, which is how timing is checked at the bedside.
 */
export function measureIabpLandmarkPressures(
  patient: McsPatientState,
  device: McsDeviceState,
  metrics: McsDerivedMetrics,
): IabpLandmarkPressures | null {
  if (device.kind !== 'iabp' || !device.running || metrics.timingQualityPercent === null) {
    return null
  }
  const cycle = 60 / Math.max(25, patient.heartRateBpm)
  const ratio = device.assistRatio
  const pressureAt = (beat: number, phase: number) =>
    generateMcsWaveformSample((beat + phase) * cycle, patient, device, metrics).arterialMmHg
  const extreme = (
    beat: number,
    from: number,
    to: number,
    pick: (a: number, b: number) => number,
  ) => {
    let value = pressureAt(beat, from)
    for (let phase = from; phase <= to; phase += 0.004) value = pick(value, pressureAt(beat, phase))
    return roundTo(value, 0)
  }
  // Beat 0 is inflated in its diastole; beat 1 is ejected against the deflated balloon.
  const assistedBeat = ratio
  const followingBeat = ratio + 1
  // The beat's own systolic peak, read before the balloon inflates in that beat.
  const systolicEnd = (beat: number) =>
    Math.min(
      0.4,
      deriveIabpCycleState(beat * cycle, patient.heartRateBpm, device).inflationStart - 0.03,
    )
  const endDiastolic = (beat: number) =>
    Math.min(extreme(beat - 1, 0.9, 0.999, Math.min), extreme(beat, 0, 0.07, Math.min))
  return {
    unassistedSystolicMmHg:
      ratio > 1 ? extreme(assistedBeat, 0.1, systolicEnd(assistedBeat), Math.max) : null,
    augmentedDiastolicMmHg: extreme(
      assistedBeat,
      deriveIabpCycleState(assistedBeat * cycle, patient.heartRateBpm, device).inflationStart,
      0.95,
      Math.max,
    ),
    assistedSystolicMmHg: extreme(followingBeat, 0.1, systolicEnd(followingBeat), Math.max),
    unassistedEndDiastolicMmHg: ratio > 1 ? endDiastolic(assistedBeat) : null,
    assistedEndDiastolicMmHg: endDiastolic(followingBeat),
  }
}

function explainState(
  patient: McsPatientState,
  device: McsDeviceState,
  metrics: McsDerivedMetrics,
  alarms: readonly McsAlarm[],
): string {
  const critical = alarms.find((candidate) => candidate.priority === 'critical')
  if (critical) return `${critical.label}: ${critical.explanation}`
  if (device.kind === 'iabp') {
    /*
     * The caption says whose number this is, and stops short of causation where the rating is held.
     *
     * "Counterpulsation is 74% synchronized" read as a statement about the balloon, so a learner
     * who moved the trigger to arterial pressure in atrial fibrillation was answered by the
     * display with a higher figure, a cleared alarm and a sentence that sounded like a result
     * (F04, F19). The figure is this model's index; in atrial fibrillation it is a held one, and
     * the caption is not the place to imply it was improved.
     */
    const synchrony = `This model rates counterpulsation ${metrics.timingQualityPercent ?? 0}% synchronized — its own timing index, not a console reading.`
    const mechanism =
      'Counterpulsation changes diastolic augmentation and effective LV afterload and adds no continuous pump flow.'
    if (mcsAfTriggerLimitAppliesTo(patient, device)) {
      return `${synchrony} ${MCS_AF_TRIGGER_LIMIT.heldLead}: in this rhythm the rating disagrees with the supplied Cardiosave material, so it is not a verdict on the trigger in front of you. ${MCS_AF_TRIGGER_LIMIT.besideTheFigure} ${mechanism}`
    }
    return `${synchrony} ${mechanism}`
  }
  if (device.kind === 'impella') {
    const leftLabel = device.left.enabled
      ? `${device.left.variant === '55' ? 'Impella 5.5' : 'Impella CP'} moves ${metrics.leftDeviceFlowLMin.toFixed(1)} L/min from LV to aorta`
      : 'left-sided Impella support is off'
    const rightLabel = device.right.enabled
      ? `RP moves ${metrics.rightDeviceFlowLMin.toFixed(1)} L/min from systemic venous blood to the pulmonary artery`
      : 'right-sided Impella support is off'
    return `${leftLabel}; ${rightLabel}. RP flow is not added directly to systemic output; ventricular filling, afterload, and pump balance constrain the result.`
  }
  const authorization = device.speedChangeAuthorized
    ? 'authorized simulation enabled'
    : 'speed changes require the authorized-personnel simulation control'
  return `Continuous LV-to-aorta support shows ${(metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin).toFixed(1)} L/min with ${authorization}. Flow depends on filling, the right ventricle and afterload.`
}

function trendFromMetrics(time: number, metrics: McsDerivedMetrics): McsTrendSample {
  return {
    time,
    mapMmHg: metrics.mapMmHg,
    effectiveFlowLMin: metrics.effectiveSystemicFlowLMin,
    deviceFlowLMin: metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin,
    leftDeviceFlowLMin: metrics.leftDeviceFlowLMin,
    rightDeviceFlowLMin: metrics.rightDeviceFlowLMin,
    pcwpMmHg: metrics.pcwpMmHg,
    rapMmHg: metrics.rapMmHg,
  }
}

export function createInitialMcsState(
  section: McsModuleSection = 'learn',
  deviceKind: McsDeviceKind = 'iabp',
  scenario: McsScenarioDefinition | null = null,
  seed = 417,
): McsSimulationState {
  const patient = scenario
    ? { ...scenario.initialPatient }
    : deviceKind === 'lvad'
      ? {
          ...defaultMcsPatient,
          systemicVascularResistanceDynSecCm5: LVAD_REFERENCE_SVR_DYN_SEC_CM5,
        }
      : { ...defaultMcsPatient }
  const device = scenario
    ? cloneMcsDevice(scenario.initialDevice)
    : createDefaultMcsDevice(deviceKind)
  const parameters = patientToCirculationParameters(patient)
  const baseline = deriveBaselineMeasurements(patient)
  const compartments = createInitialCirculationCompartments(parameters, baseline)
  const { support, metrics } = resolveMcsSupport(patient, device, compartments, baseline, 0)
  const waveforms = [generateMcsWaveformSample(0, patient, device, metrics)]
  return {
    section,
    deviceKind: device.kind,
    scenario,
    scenarioPhase: scenario ? 'inspect' : 'observe',
    patient,
    device,
    parameters,
    compartments,
    supportEffect: support.effect,
    supportDiagnostics: support.diagnostics,
    metrics,
    alarms: support.alarms,
    waveforms,
    trends: [trendFromMetrics(0, metrics)],
    timeSeconds: 0,
    seed,
    inspectedIds: [],
    actionIds: [],
    selectedPredictionId: null,
    predictionCommitted: false,
    reassessed: false,
    escalated: false,
    criticalErrors: [],
    responseMessage: scenario
      ? 'Inspect the patient, signals, and device before committing to a mechanism.'
      : 'Mechanism Studio is open. Change one variable at a time and watch the synchronized response.',
    causalExplanation: explainState(patient, device, metrics, support.alarms),
    score: null,
    completed: false,
  }
}

export function advanceMcsSimulation(
  state: McsSimulationState,
  seconds: number,
): McsSimulationState {
  const steps = Math.max(1, Math.ceil(Math.max(0, seconds) / HEMODYNAMIC_FIXED_STEP_SECONDS))
  const stepSeconds = seconds <= 0 ? HEMODYNAMIC_FIXED_STEP_SECONDS : seconds / steps
  let timeSeconds = state.timeSeconds
  let compartments = state.compartments
  let parameters = state.parameters
  let supportEffect = state.supportEffect
  let supportDiagnostics = state.supportDiagnostics
  let metrics = state.metrics
  let alarms = state.alarms
  let waveforms = [...state.waveforms]
  let trends = [...state.trends]

  for (let index = 0; index < steps; index += 1) {
    timeSeconds += stepSeconds
    parameters = patientToCirculationParameters(state.patient)
    const baseline = deriveBaselineMeasurements(state.patient)
    const supportBefore = computeMechanicalSupport(
      state.patient,
      state.device,
      compartments,
      baseline,
      timeSeconds,
    )
    compartments = advanceWindkesselCompartments(
      compartments,
      parameters,
      baseline,
      timeSeconds,
      stepSeconds,
      supportBefore.effect,
    )
    const resolved = resolveMcsSupport(
      state.patient,
      state.device,
      compartments,
      baseline,
      timeSeconds,
    )
    const support = resolved.support
    metrics = resolved.metrics
    alarms = support.alarms
    supportEffect = support.effect
    supportDiagnostics = support.diagnostics
    waveforms.push(generateMcsWaveformSample(timeSeconds, state.patient, state.device, metrics))

    const previousTrendBucket = Math.floor((timeSeconds - stepSeconds) * 4)
    const nextTrendBucket = Math.floor(timeSeconds * 4)
    if (nextTrendBucket > previousTrendBucket) trends.push(trendFromMetrics(timeSeconds, metrics))
  }

  const waveformCutoff = timeSeconds - MAX_WAVEFORM_SECONDS
  const trendCutoff = timeSeconds - MAX_TREND_SECONDS
  waveforms = waveforms.filter((sample) => sample.time >= waveformCutoff)
  trends = trends.filter((sample) => sample.time >= trendCutoff)

  return {
    ...state,
    parameters,
    compartments,
    supportEffect,
    supportDiagnostics,
    metrics,
    alarms,
    waveforms,
    trends,
    timeSeconds,
    causalExplanation: explainState(state.patient, state.device, metrics, alarms),
  }
}

export function totalMcsCirculatingVolume(state: McsSimulationState): number {
  const c = state.compartments
  return (
    c.systemicArterialVolumeMl +
    c.systemicVenousVolumeMl +
    c.pulmonaryArterialVolumeMl +
    c.pulmonaryVenousVolumeMl +
    c.leftVentricularVolumeMl +
    c.rightVentricularVolumeMl
  )
}

export function noActiveAlarm(state: McsSimulationState, alarmId: string): boolean {
  return !state.alarms.some((candidate) => candidate.id === alarmId && candidate.active)
}

export function emptyMechanicalSupportEffect(nativeFlowLMin: number): MechanicalSupportEffect {
  return emptyEffect(nativeFlowLMin)
}
