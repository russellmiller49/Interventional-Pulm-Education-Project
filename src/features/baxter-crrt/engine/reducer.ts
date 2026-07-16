import { acknowledgeEngineAlarm } from './alarms'
import { getCrrtDeviceCalculationAdapter } from './deviceAdapters/calculations'
import { totalExternalInputRateMlHour, totalExternalOutputRateMlHour } from './fluidModel'
import { createInitialCrrtSimulationState } from './initialState'
import { canEnterRunningState } from './readiness'
import {
  advanceCrrtSimulation,
  applyScheduledEventAction,
  appendIntervention,
  deviceStateForDeliveryState,
  recomputeCrrtDerivedState,
} from './simulation'
import type { CrrtEngineAction, CrrtSimulationState } from './types'

function updatePrescription(
  state: CrrtSimulationState,
  action: Extract<CrrtEngineAction, { type: 'SET_PRESCRIPTION' }>,
): CrrtSimulationState {
  const calculations = getCrrtDeviceCalculationAdapter(state.deviceId)
  if (action.prescription.citrateRequestedButDisabled) {
    throw new Error('Regional citrate remains disabled until a reviewed local protocol is loaded.')
  }
  const flows = action.prescription.flows
  const prescribedEffluentRateMlHour = calculations.calculateEffluentPumpTargetMlPerHour(flows)
  const prescribedEffluentDoseMlKgHour =
    state.patient.status === 'configured'
      ? calculations.calculateEffluentDoseMlPerKgHour(
          prescribedEffluentRateMlHour,
          state.patient.bodyWeightKg,
        )
      : null

  return recomputeCrrtDerivedState({
    ...state,
    prescription: {
      ...action.prescription,
      flows: { ...action.prescription.flows },
      sourceIds: [...action.prescription.sourceIds],
    },
    circuit: {
      ...state.circuit,
      modality: action.prescription.modality,
      flows: { ...action.prescription.flows },
      anticoagulation: action.prescription.anticoagulation,
    },
    deliveredTherapy: {
      ...state.deliveredTherapy,
      prescribedEffluentRateMlHour,
      prescribedEffluentDoseMlKgHour,
    },
  })
}

export function crrtSimulationReducer(
  state: CrrtSimulationState,
  action: CrrtEngineAction,
): CrrtSimulationState {
  switch (action.type) {
    case 'RESET':
      return createInitialCrrtSimulationState(action.options)
    case 'LOAD_FIXTURE':
      return createInitialCrrtSimulationState({
        fixture: action.fixture,
        experience: action.experience,
        roleLens: action.roleLens,
        attempt: action.attempt,
        deviceId: action.deviceId ?? state.deviceId,
      })
    case 'SET_DELIVERY_STATE': {
      if (action.deliveryState === 'running' && !canEnterRunningState(state)) {
        return state
      }
      return recomputeCrrtDerivedState({
        ...state,
        device: deviceStateForDeliveryState(state.device, action.deliveryState),
      })
    }
    case 'SET_PRESCRIPTION':
      return updatePrescription(state, action)
    case 'SET_EXTERNAL_FLUID_RATES':
      totalExternalInputRateMlHour(action.rates)
      totalExternalOutputRateMlHour(action.rates)
      return {
        ...state,
        scenario: {
          ...state.scenario,
          externalFluidRates: { ...action.rates },
        },
      }
    case 'SET_FAULT':
      return recomputeCrrtDerivedState(
        applyScheduledEventAction(state, {
          type: 'SET_FAULT',
          fault: action.fault,
          active: action.active,
        }),
      )
    case 'CORRECT_FAULT':
      return recomputeCrrtDerivedState(
        applyScheduledEventAction(state, {
          type: 'SET_FAULT',
          fault: action.fault,
          active: false,
        }),
      )
    case 'ACKNOWLEDGE_ALARM':
      if (
        !state.alarms.some(
          (alarm) => alarm.id === action.alarmId && alarm.acknowledgedAtSeconds === undefined,
        )
      ) {
        return state
      }
      return appendIntervention(
        acknowledgeEngineAlarm(state, action.alarmId),
        'ACKNOWLEDGE_ALARM',
        'engine-action',
      )
    case 'ADVANCE_TIME':
      return advanceCrrtSimulation(state, action.seconds)
    default:
      return assertNever(action)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled CRRT action: ${JSON.stringify(value)}`)
}
