import { calculateEffluentDoseMlPerKgHour } from '@/features/baxter-crrt/engine/clinicalMath'
import { calculateSyntheticBloodCircuitPressures } from '@/features/baxter-crrt/engine/pressureModel'
import { calculateDeliveredSoluteClearanceMlMin } from '@/features/baxter-crrt/engine/soluteModel'

import { clamp, roundTo } from '../math'
import type {
  IcuCommand,
  IcuCrrtState,
  IcuDeviceAlarm,
  IcuPatientSnapshot,
  IcuTherapyAdapter,
  IcuTherapyStepResult,
} from '../types'

export function createInitialIcuCrrtState(): IcuCrrtState {
  return {
    status: 'off',
    modality: 'cvvhd',
    bloodFlowMlMin: 150,
    dialysateMlHour: 1_500,
    replacementMlHour: 0,
    patientFluidRemovalMlHour: 0,
    deliveredDoseMlKgHour: 0,
    accessPressureMmHg: 0,
    filterPressureMmHg: 0,
    returnPressureMmHg: 0,
    filterLifeFraction: 1,
  }
}

export function reduceCrrtCommand(state: IcuCrrtState, command: IcuCommand): IcuCrrtState {
  if (command.type === 'therapy.prepare' && command.therapy === 'crrt') {
    const modality = command.configuration
    return {
      ...state,
      status: 'ready',
      modality:
        modality === 'cvvh' || modality === 'cvvhdf' || modality === 'cvvhd'
          ? modality
          : state.modality,
    }
  }
  if (command.type === 'therapy.start' && command.therapy === 'crrt') {
    return state.status === 'ready' ? { ...state, status: 'running' } : state
  }
  if (command.type === 'therapy.stop' && command.therapy === 'crrt')
    return { ...state, status: 'off', deliveredDoseMlKgHour: 0 }
  if (command.type !== 'therapy.adjust' || command.therapy !== 'crrt') return state
  if (typeof command.value !== 'number' || !Number.isFinite(command.value)) return state
  if (command.control === 'blood-flow-ml-min')
    return { ...state, bloodFlowMlMin: clamp(command.value, 0, 450) }
  if (command.control === 'dialysate-ml-hour')
    return { ...state, dialysateMlHour: clamp(command.value, 0, 8_000) }
  if (command.control === 'replacement-ml-hour')
    return { ...state, replacementMlHour: clamp(command.value, 0, 8_000) }
  if (command.control === 'patient-fluid-removal-ml-hour')
    return { ...state, patientFluidRemovalMlHour: clamp(command.value, 0, 1_000) }
  return state
}

function alarm(
  code: string,
  message: string,
  priority: IcuDeviceAlarm['priority'],
  mappingReviewStatus: IcuDeviceAlarm['mappingReviewStatus'] = 'pending',
): Omit<IcuDeviceAlarm, 'startedAtSeconds' | 'acknowledgedAtSeconds' | 'correctedAtSeconds'> {
  return {
    id: `crrt:${code}`,
    subsystem: 'crrt',
    code,
    message,
    priority,
    mappingReviewStatus,
    active: true,
  }
}

export function stepCrrt(
  state: IcuCrrtState,
  snapshot: IcuPatientSnapshot,
  deltaSeconds: number,
): IcuTherapyStepResult<IcuCrrtState> {
  if (state.status !== 'running') {
    return { state, effects: [], alarms: [], telemetry: { status: state.status } }
  }
  const effluentMlHour =
    state.dialysateMlHour + state.replacementMlHour + state.patientFluidRemovalMlHour
  const deliveredDose = calculateEffluentDoseMlPerKgHour(effluentMlHour, snapshot.patient.weightKg)
  const clearance = calculateDeliveredSoluteClearanceMlMin(effluentMlHour, 0.92, 0.9)
  const pressures = calculateSyntheticBloodCircuitPressures({
    bloodFlowMlPerMinute: state.bloodFlowMlMin,
    accessReferencePressureMmHg: snapshot.patient.hemodynamics.rapMmHg,
    returnReferencePressureMmHg: snapshot.patient.hemodynamics.rapMmHg,
    accessResistanceMmHgPerMlPerMinute: 0.72,
    filterResistanceMmHgPerMlPerMinute: 0.68 + (1 - state.filterLifeFraction) * 0.8,
    returnResistanceMmHgPerMlPerMinute: 0.42,
  })
  const filterWear = (deltaSeconds / 86_400) * (1 + Math.max(0, state.bloodFlowMlMin - 200) / 300)
  const next: IcuCrrtState = {
    ...state,
    deliveredDoseMlKgHour: roundTo(deliveredDose, 1),
    accessPressureMmHg: roundTo(pressures.accessPressureMmHg, 0),
    filterPressureMmHg: roundTo(pressures.filterPressureMmHg, 0),
    returnPressureMmHg: roundTo(pressures.returnPressureMmHg, 0),
    filterLifeFraction: clamp(state.filterLifeFraction - filterWear, 0, 1),
  }
  const alarms: ReturnType<typeof alarm>[] = []
  if (next.accessPressureMmHg < -150)
    // The legacy adapter intentionally leaves exact device priority mapping pending.
    alarms.push(alarm('ACCESS_PRESSURE', 'Access pressure is markedly negative', null))
  if (next.filterPressureMmHg - next.returnPressureMmHg > 180)
    alarms.push(alarm('FILTER_PRESSURE', 'Filter pressure drop is elevated', null))
  if (next.filterLifeFraction <= 0.08)
    alarms.push(alarm('FILTER_LIFE', 'Filter life is nearly exhausted', null))
  if (state.patientFluidRemovalMlHour > 500)
    alarms.push(
      alarm(
        'HIGH_PATIENT_REMOVAL',
        'Patient fluid-removal setting may exceed current tolerance',
        null,
        'pending',
      ),
    )
  return {
    state: next,
    effects: [
      {
        kind: 'volume-removal',
        source: 'crrt',
        rateMlHour: state.patientFluidRemovalMlHour,
      },
      { kind: 'solute-clearance', source: 'crrt', clearanceMlMin: clearance },
      { kind: 'temperature', source: 'crrt', targetTemperatureC: 36, strength: 0.04 },
    ],
    alarms,
    telemetry: {
      deliveredDoseMlKgHour: next.deliveredDoseMlKgHour,
      accessPressureMmHg: next.accessPressureMmHg,
      filterPressureMmHg: next.filterPressureMmHg,
      returnPressureMmHg: next.returnPressureMmHg,
    },
  }
}

export const icuCrrtAdapter: IcuTherapyAdapter<IcuCrrtState, IcuCommand> = {
  id: 'crrt',
  createInitialState: createInitialIcuCrrtState,
  reduce(state, action) {
    return reduceCrrtCommand(state, action)
  },
  step: stepCrrt,
}
