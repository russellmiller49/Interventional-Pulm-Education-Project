import { calculateNominalCardiohelpBloodFlowLMin } from '@/features/cardiohelp-ecmo/engine/simulation'

import { clamp, roundTo } from '../math'
import type {
  IcuCommand,
  IcuDeviceAlarm,
  IcuEcmoMode,
  IcuEcmoState,
  IcuPatientSnapshot,
  IcuTherapyAdapter,
  IcuTherapyStepResult,
} from '../types'

export function createInitialIcuEcmoState(): IcuEcmoState {
  return {
    status: 'off',
    mode: 'vv',
    rpm: 0,
    targetBloodFlowLMin: 0,
    bloodFlowLMin: 0,
    sweepLMin: 0,
    gasFio2: 1,
    drainagePressureMmHg: 0,
    oxygenatorPressureDropMmHg: 0,
    recirculationFraction: 0.12,
    gasConnected: true,
    drainageLimited: false,
  }
}

function asNumber(command: Extract<IcuCommand, { type: 'therapy.adjust' }>): number | null {
  return typeof command.value === 'number' && Number.isFinite(command.value) ? command.value : null
}

export function reduceEcmoCommand(state: IcuEcmoState, command: IcuCommand): IcuEcmoState {
  if (command.type === 'therapy.prepare' && command.therapy === 'ecmo') {
    const mode: IcuEcmoMode = command.configuration === 'va' ? 'va' : 'vv'
    return {
      ...state,
      status: 'ready',
      mode,
      rpm: state.rpm || 3_000,
      sweepLMin: state.sweepLMin || 3,
    }
  }
  if (command.type === 'therapy.start' && command.therapy === 'ecmo') {
    return state.status === 'ready' ? { ...state, status: 'running' } : state
  }
  if (command.type === 'therapy.stop' && command.therapy === 'ecmo') {
    return { ...state, status: 'off', bloodFlowLMin: 0 }
  }
  if (command.type !== 'therapy.adjust' || command.therapy !== 'ecmo') return state
  const value = asNumber(command)
  if (command.control === 'mode' && (command.value === 'vv' || command.value === 'va')) {
    return state.status === 'running' ? state : { ...state, mode: command.value }
  }
  if (value === null) return state
  if (command.control === 'rpm') return { ...state, rpm: clamp(value, 0, 5_000) }
  if (command.control === 'blood-flow-l-min')
    return { ...state, targetBloodFlowLMin: clamp(value, 0, 7) }
  if (command.control === 'sweep-l-min') return { ...state, sweepLMin: clamp(value, 0, 12) }
  if (command.control === 'gas-fio2') return { ...state, gasFio2: clamp(value, 0.21, 1) }
  return state
}

function alarm(
  code: string,
  message: string,
  priority: IcuDeviceAlarm['priority'] = null,
): Omit<IcuDeviceAlarm, 'startedAtSeconds' | 'acknowledgedAtSeconds' | 'correctedAtSeconds'> {
  return {
    id: `ecmo:${code}`,
    subsystem: 'ecmo',
    code,
    message,
    priority,
    mappingReviewStatus: 'pending',
    active: true,
  }
}

export function stepEcmo(
  state: IcuEcmoState,
  snapshot: IcuPatientSnapshot,
  _deltaSeconds: number,
): IcuTherapyStepResult<IcuEcmoState> {
  void _deltaSeconds
  if (state.status !== 'running') {
    return { state, effects: [], alarms: [], telemetry: { status: state.status } }
  }
  const patient = snapshot.patient
  const volumeFraction = patient.hemodynamics.circulatingVolumeMl / 4_360
  const preloadFactor = clamp((volumeFraction - 0.55) / 0.45, 0.1, 1.08)
  const rpmTargetFlow = clamp(calculateNominalCardiohelpBloodFlowLMin(state.rpm), 0, 7)
  // The target is distinct from delivered telemetry so a drainage limitation
  // is never re-applied to an already-limited value on the next step.
  const requestedFlow = state.targetBloodFlowLMin > 0 ? state.targetBloodFlowLMin : rpmTargetFlow
  const drainageLimited = requestedFlow > rpmTargetFlow * preloadFactor + 0.35
  const bloodFlow = clamp(Math.min(requestedFlow, rpmTargetFlow) * preloadFactor, 0, 7)
  const drainagePressure = -15 - (bloodFlow * 23) / Math.max(0.25, preloadFactor)
  const pressureDrop = 22 + bloodFlow ** 2 * 7.5
  const recirculation =
    state.mode === 'vv'
      ? clamp(state.recirculationFraction + Math.max(0, bloodFlow - 5) * 0.035, 0.05, 0.55)
      : 0
  const effectiveGasFlow = bloodFlow * (1 - recirculation)
  const nativeFlow = patient.hemodynamics.nativeCardiacOutputLMin
  const mechanicalEffect =
    state.mode === 'va'
      ? {
          transfers: [
            {
              from: 'systemic-venous' as const,
              to: 'systemic-arterial' as const,
              flowLMin: bloodFlow,
            },
          ],
          nativeFlowLMin: nativeFlow,
          deviceFlowLMin: bloodFlow,
          recirculatingFlowLMin: 0,
          effectiveSystemicFlowLMin: clamp(nativeFlow + bloodFlow, 0, 12),
        }
      : {
          transfers: [],
          nativeFlowLMin: nativeFlow,
          deviceFlowLMin: bloodFlow,
          recirculatingFlowLMin: bloodFlow * recirculation,
          // VV ECMO performs gas exchange but does not directly replace systemic flow.
          effectiveSystemicFlowLMin: nativeFlow,
        }
  const next: IcuEcmoState = {
    ...state,
    bloodFlowLMin: roundTo(bloodFlow, 2),
    drainagePressureMmHg: roundTo(drainagePressure, 0),
    oxygenatorPressureDropMmHg: roundTo(pressureDrop, 0),
    recirculationFraction: roundTo(recirculation, 3),
    drainageLimited,
  }
  const alarms: ReturnType<typeof alarm>[] = []
  if (drainagePressure < -150 || drainageLimited)
    alarms.push(alarm('DRAINAGE_LIMITED', 'ECMO drainage is preload limited'))
  if (!state.gasConnected && (state.sweepLMin > 0 || state.gasFio2 > 0.21))
    alarms.push(alarm('GAS_SOURCE', 'Sweep-gas source is disconnected'))
  if (state.mode === 'vv' && recirculation > 0.35)
    alarms.push(alarm('RECIRCULATION', 'VV recirculation is reducing effective support'))
  const gasAvailable = state.gasConnected ? 1 : 0
  return {
    state: next,
    effects: [
      { kind: 'mechanical-support', source: 'ecmo', effect: mechanicalEffect },
      {
        kind: 'gas-exchange',
        source: 'ecmo',
        oxygenationCapacity: clamp((effectiveGasFlow / 5) * state.gasFio2 * gasAvailable, 0, 1),
        co2RemovalMlMin: clamp(
          state.sweepLMin * 45 * (effectiveGasFlow / Math.max(1, bloodFlow)) * gasAvailable,
          0,
          500,
        ),
      },
      { kind: 'temperature', source: 'ecmo', targetTemperatureC: 37, strength: 0.12 },
    ],
    alarms,
    telemetry: {
      mode: state.mode,
      bloodFlowLMin: next.bloodFlowLMin,
      drainagePressureMmHg: next.drainagePressureMmHg,
      oxygenatorPressureDropMmHg: next.oxygenatorPressureDropMmHg,
      recirculationFraction: next.recirculationFraction,
    },
  }
}

export const icuEcmoAdapter: IcuTherapyAdapter<IcuEcmoState, IcuCommand> = {
  id: 'ecmo',
  createInitialState: createInitialIcuEcmoState,
  reduce(state, action) {
    return reduceEcmoCommand(state, action)
  },
  step: stepEcmo,
}
