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
import type {
  IabpDeviceState,
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
  assistedBeat: boolean
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

interface SupportComputation {
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
  alarms: readonly McsAlarm[]
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
    alarms,
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
  const leftPreloadFactor = Math.min(
    rvDeliveryToLeftHeart,
    lvFilling,
    clamp(patient.preloadPercent / 90, 0.25, 1.15),
  )
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
  const leftMaximumFlow = left.variant === '55' ? 5.5 : 4.3
  const leftTargetFlow = leftRunning
    ? leftMaximumFlow * (clamp(left.performanceLevel, 0, 9) / 9) ** 0.86
    : 0
  const leftSuction = leftRunning && left.performanceLevel >= 5 && leftPreloadFactor < 0.58
  const leftSuctionFactor = leftSuction ? clamp(leftPreloadFactor / 0.58, 0.2, 0.9) : 1
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
        'Available LV blood volume is inadequate or restricted for the selected support.',
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
    alarms,
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
  const deviceFlow = clamp(
    targetFlow * Math.min(rvDelivery, lvFilling) * afterloadFactor * tamponadeFactor,
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
  const suction = running && deviceFlow > 2.5 && (lvFilling < 0.42 || rvDelivery < 0.42)
  const pumpPower = running
    ? 2.1 +
      deviceFlow * 0.66 +
      (device.speedRpm - 4600) / 1700 +
      (device.suspectedPumpThrombosis ? 2.8 : 0)
    : 0
  const pi = running
    ? clamp((nativeFlow / Math.max(0.5, deviceFlow)) * 3.4 + patient.preloadPercent / 70, 0.7, 8)
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
        'Modeled pump support is unavailable until an approved power path is restored.',
      ),
    )
  if (device.controllerFault)
    alarms.push(
      alarm(
        'lvad-controller-fault',
        'Controller fault',
        'critical',
        'Use current emergency procedures and contact the LVAD team.',
      ),
    )
  if (running && deviceFlow < 2.5)
    alarms.push(
      alarm(
        'lvad-low-flow',
        'Low-flow alarm',
        'warning',
        'Differentiate preload, RV failure, tamponade, afterload, obstruction, and recirculation.',
      ),
    )
  if (running && baseline.mapMmHg > 100)
    alarms.push(
      alarm(
        'lvad-high-afterload',
        'Afterload-limited flow',
        'warning',
        'Elevated aortic pressure reduces continuous-flow pump output.',
      ),
    )
  if (suction)
    alarms.push(
      alarm(
        'lvad-suction',
        'Inflow suction pattern',
        'critical',
        'The LV is underfilled relative to the selected speed and available RV delivery.',
      ),
    )
  if (device.suspectedPumpThrombosis)
    alarms.push(
      alarm(
        'lvad-high-power',
        'High-power pattern',
        'critical',
        'High power with suspected thrombosis requires urgent MCS-team evaluation.',
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
    alarms,
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
  }
}

function assistedIabpBeat(device: McsDeviceState, patient: McsPatientState, time: number): boolean {
  return (
    device.kind === 'iabp' &&
    device.running &&
    cycleIndex(time, patient.heartRateBpm) % device.assistRatio === 0
  )
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
  const ecg = p(0.08, 0.012) - 0.22 * p(0.105, 0.014) + 0.42 * p(0.3, 0.045)
  const systolicPulse = p(0.24, 0.1) + 0.22 * p(0.39, 0.13)
  let iabpAugmentation = 0
  if (device.kind === 'iabp' && device.running && assistedBeat) {
    const inflationPhase = deriveIabpCycleState(time, patient.heartRateBpm, device).inflationStart
    const deflationPenalty = clamp(device.deflationOffsetMs / 160, 0, 1)
    iabpAugmentation =
      metrics.timingQualityPercent !== null
        ? p(clamp(inflationPhase + 0.12, 0.45, 0.82), 0.1) *
            (metrics.timingQualityPercent / 100) *
            22 -
          p(0.05, 0.05) * deflationPenalty * 12
        : 0
  }
  const arterialDiastolic = metrics.mapMmHg - metrics.pulsePressureMmHg * 0.38
  const arterial = arterialDiastolic + metrics.pulsePressureMmHg * systolicPulse + iabpAugmentation
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

function explainState(
  patient: McsPatientState,
  device: McsDeviceState,
  metrics: McsDerivedMetrics,
  alarms: readonly McsAlarm[],
): string {
  const critical = alarms.find((candidate) => candidate.priority === 'critical')
  if (critical) return `${critical.label}: ${critical.explanation}`
  if (device.kind === 'iabp') {
    return `Counterpulsation is ${metrics.timingQualityPercent ?? 0}% synchronized. It changes diastolic augmentation and effective LV afterload but adds no continuous pump flow.`
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
    : 'speed changes locked to the authorized-personnel gate'
  return `Continuous LV-to-aorta support is ${metrics.deviceFlowLMin.toFixed(1)} L/min with ${authorization}. Flow remains preload-, RV-, and afterload-dependent.`
}

function trendFromMetrics(time: number, metrics: McsDerivedMetrics): McsTrendSample {
  return {
    time,
    mapMmHg: metrics.mapMmHg,
    effectiveFlowLMin: metrics.effectiveSystemicFlowLMin,
    deviceFlowLMin: metrics.deviceFlowLMin,
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
  const patient = scenario ? { ...scenario.initialPatient } : { ...defaultMcsPatient }
  const device = scenario
    ? cloneMcsDevice(scenario.initialDevice)
    : createDefaultMcsDevice(deviceKind)
  const parameters = patientToCirculationParameters(patient)
  const baseline = deriveBaselineMeasurements(patient)
  const compartments = createInitialCirculationCompartments(parameters, baseline)
  const support = computeMechanicalSupport(patient, device, compartments, baseline, 0)
  const metrics = deriveMcsMetrics(patient, compartments, baseline, support)
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
    const support = computeMechanicalSupport(
      state.patient,
      state.device,
      compartments,
      baseline,
      timeSeconds,
    )
    metrics = deriveMcsMetrics(state.patient, compartments, baseline, support)
    alarms = support.alarms
    supportEffect = support.effect
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
