import { computeMechanicalSupport } from '@/features/mechanical-circulatory-support/engine/model'
import type {
  IabpDeviceState,
  ImpellaDeviceState,
  McsPatientState,
} from '@/features/mechanical-circulatory-support/engine/types'

import { clamp, roundTo } from '../math'
import type {
  IcuCommand,
  IcuDeviceAlarm,
  IcuMcsDevice,
  IcuMcsState,
  IcuPatientSnapshot,
  IcuTherapyAdapter,
  IcuTherapyStepResult,
} from '../types'

export function createInitialIcuMcsState(): IcuMcsState {
  return {
    status: 'off',
    device: 'none',
    assistRatio: 1,
    performanceLevel: 4,
    inflationOffsetMs: 0,
    deflationOffsetMs: 0,
    position: 'correct',
    purgeState: 'normal',
    deviceFlowLMin: 0,
  }
}

function isMcsDevice(value: string | undefined): value is Exclude<IcuMcsDevice, 'none'> {
  return value === 'iabp' || value === 'left-impella' || value === 'rp-impella'
}

export function reduceMcsCommand(state: IcuMcsState, command: IcuCommand): IcuMcsState {
  if (command.type === 'therapy.prepare' && command.therapy === 'mcs') {
    return isMcsDevice(command.configuration)
      ? { ...state, status: 'ready', device: command.configuration }
      : state
  }
  if (command.type === 'therapy.start' && command.therapy === 'mcs') {
    return state.status === 'ready' && state.device !== 'none'
      ? { ...state, status: 'running' }
      : state
  }
  if (command.type === 'therapy.stop' && command.therapy === 'mcs') {
    return { ...state, status: 'off', deviceFlowLMin: 0 }
  }
  if (command.type !== 'therapy.adjust' || command.therapy !== 'mcs') return state
  const number = typeof command.value === 'number' ? command.value : null
  if (command.control === 'assist-ratio' && number !== null) {
    const ratio = Math.round(clamp(number, 1, 3)) as 1 | 2 | 3
    return { ...state, assistRatio: ratio }
  }
  if (command.control === 'performance-level' && number !== null)
    return { ...state, performanceLevel: Math.round(clamp(number, 0, 9)) }
  if (command.control === 'inflation-offset-ms' && number !== null)
    return { ...state, inflationOffsetMs: clamp(number, -200, 200) }
  if (command.control === 'deflation-offset-ms' && number !== null)
    return { ...state, deflationOffsetMs: clamp(number, -200, 200) }
  if (
    command.control === 'position' &&
    (command.value === 'correct' || command.value === 'too-deep' || command.value === 'too-shallow')
  )
    return { ...state, position: command.value }
  if (
    command.control === 'purge-state' &&
    (command.value === 'normal' ||
      command.value === 'high-pressure' ||
      command.value === 'low-pressure')
  )
    return { ...state, purgeState: command.value }
  return state
}

function toLegacyPatient(snapshot: IcuPatientSnapshot): McsPatientState {
  const patient = snapshot.patient
  return {
    heartRateBpm: patient.hemodynamics.heartRateBpm,
    rhythm: 'sinus',
    preloadPercent: clamp((patient.hemodynamics.circulatingVolumeMl / 4_360) * 100, 45, 145),
    systemicVascularResistanceDynSecCm5: patient.hemodynamics.systemicVascularResistanceDynSecCm5,
    leftVentricularContractility: patient.hemodynamics.leftVentricularContractility,
    rightVentricularContractility: patient.hemodynamics.rightVentricularContractility,
    pulmonaryVascularResistanceWU: patient.hemodynamics.pulmonaryVascularResistanceWU,
    peepCmH2O:
      snapshot.devices.ventilator.status === 'running' ? snapshot.devices.ventilator.peepCmH2O : 3,
    aorticInsufficiencySeverity: 0,
    tamponade: patient.drivers.tamponadePressureMmHg >= 10 && !patient.tamponadeDrained,
  }
}

function toLegacyDevice(state: IcuMcsState): IabpDeviceState | ImpellaDeviceState {
  if (state.device === 'iabp') {
    return {
      kind: 'iabp',
      running: state.status === 'running',
      assistRatio: state.assistRatio,
      triggerSource: 'ecg',
      inflationOffsetMs: state.inflationOffsetMs,
      deflationOffsetMs: state.deflationOffsetMs,
    }
  }
  const leftEnabled = state.device === 'left-impella'
  const rightEnabled = state.device === 'rp-impella'
  return {
    kind: 'impella',
    left: {
      enabled: leftEnabled,
      variant: 'cp',
      running: leftEnabled && state.status === 'running',
      performanceLevel: state.performanceLevel,
      position: state.position,
      purgeState: state.purgeState,
    },
    right: {
      enabled: rightEnabled,
      variant: 'rp',
      running: rightEnabled && state.status === 'running',
      performanceLevel: state.performanceLevel,
      position: state.position === 'correct' ? 'correct' : 'inlet-too-high',
      purgeState: state.purgeState,
    },
  }
}

function alarmFromLegacy(
  item: ReturnType<typeof computeMechanicalSupport>['alarms'][number],
): Omit<IcuDeviceAlarm, 'startedAtSeconds' | 'acknowledgedAtSeconds' | 'correctedAtSeconds'> {
  return {
    id: `mcs:${item.id}`,
    subsystem: 'mcs',
    code: item.id,
    message: item.label,
    priority: item.priority,
    mappingReviewStatus: 'reviewed',
    active: item.active,
  }
}

export function stepMcs(
  state: IcuMcsState,
  snapshot: IcuPatientSnapshot,
  _deltaSeconds: number,
): IcuTherapyStepResult<IcuMcsState> {
  if (state.status !== 'running' || state.device === 'none') {
    return { state, effects: [], alarms: [], telemetry: { status: state.status } }
  }
  const patient = toLegacyPatient(snapshot)
  const baseline = {
    heartRateBpm: patient.heartRateBpm,
    spo2Percent: snapshot.patient.respiratory.spo2Percent,
    artSystolicMmHg: snapshot.patient.hemodynamics.systolicMmHg,
    artDiastolicMmHg: snapshot.patient.hemodynamics.diastolicMmHg,
    mapMmHg: snapshot.patient.hemodynamics.mapMmHg,
    rapMmHg: snapshot.patient.hemodynamics.rapMmHg,
    rvSystolicMmHg: snapshot.patient.hemodynamics.meanPapMmHg + 8,
    rvDiastolicMmHg: snapshot.patient.hemodynamics.rapMmHg,
    papSystolicMmHg: snapshot.patient.hemodynamics.meanPapMmHg + 8,
    papDiastolicMmHg: Math.max(3, snapshot.patient.hemodynamics.meanPapMmHg - 6),
    meanPapMmHg: snapshot.patient.hemodynamics.meanPapMmHg,
    pawpMmHg: snapshot.patient.hemodynamics.pawpMmHg,
    cardiacOutputLMin: snapshot.patient.hemodynamics.nativeCardiacOutputLMin,
    cardiacIndexLMinM2:
      snapshot.patient.hemodynamics.nativeCardiacOutputLMin / snapshot.patient.bodySurfaceAreaM2,
    svo2Percent: clamp(45 + snapshot.patient.hemodynamics.effectiveSystemicFlowLMin * 4, 35, 80),
    pulsePressureMaxMmHg:
      snapshot.patient.hemodynamics.systolicMmHg - snapshot.patient.hemodynamics.diastolicMmHg,
    pulsePressureMinMmHg:
      (snapshot.patient.hemodynamics.systolicMmHg - snapshot.patient.hemodynamics.diastolicMmHg) *
      0.9,
  }
  const support = computeMechanicalSupport(
    patient,
    toLegacyDevice(state),
    snapshot.compartments,
    baseline,
    snapshot.elapsedSeconds,
  )
  const deviceFlow =
    state.device === 'rp-impella' ? support.rightDeviceFlowLMin : support.deviceFlowLMin
  const next = { ...state, deviceFlowLMin: roundTo(deviceFlow, 2) }
  return {
    state: next,
    effects: [{ kind: 'mechanical-support', source: 'mcs', effect: support.effect }],
    alarms: support.alarms.map(alarmFromLegacy),
    telemetry: {
      device: state.device,
      deviceFlowLMin: next.deviceFlowLMin,
      effectiveSystemicFlowLMin: roundTo(support.effectiveSystemicFlowLMin, 2),
      nativeFlowLMin: roundTo(support.nativeFlowLMin, 2),
    },
  }
}

export const icuMcsAdapter: IcuTherapyAdapter<IcuMcsState, IcuCommand> = {
  id: 'mcs',
  createInitialState: createInitialIcuMcsState,
  reduce(state, action) {
    return reduceMcsCommand(state, action)
  },
  step: stepMcs,
}
