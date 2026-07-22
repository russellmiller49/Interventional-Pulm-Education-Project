import { equationOfMotionPressure } from '@/features/mechanical-ventilation/engine/physics'

import { clamp, roundTo } from '../math'
import type {
  IcuCommand,
  IcuDeviceAlarm,
  IcuPatientSnapshot,
  IcuTherapyAdapter,
  IcuTherapyStepResult,
  IcuVentilatorMode,
  IcuVentilatorState,
} from '../types'

export function createInitialIcuVentilatorState(): IcuVentilatorState {
  return {
    status: 'off',
    mode: 'volume-control',
    tidalVolumeMl: 420,
    ratePerMin: 18,
    peepCmH2O: 5,
    fio2: 0.4,
    inspiratoryPressureCmH2O: 16,
    pressureSupportCmH2O: 10,
    peakPressureCmH2O: 0,
    plateauPressureCmH2O: 0,
    minuteVentilationLMin: 0,
  }
}

function numericValue(command: Extract<IcuCommand, { type: 'therapy.adjust' }>): number | null {
  return typeof command.value === 'number' && Number.isFinite(command.value) ? command.value : null
}

export function reduceVentilatorCommand(
  state: IcuVentilatorState,
  command: IcuCommand,
): IcuVentilatorState {
  if (command.type === 'therapy.prepare' && command.therapy === 'ventilator') {
    const mode = command.configuration
    return {
      ...state,
      status: 'ready',
      mode:
        mode === 'pressure-control' || mode === 'pressure-support' || mode === 'volume-control'
          ? mode
          : state.mode,
    }
  }
  if (command.type === 'therapy.start' && command.therapy === 'ventilator') {
    return state.status === 'ready' ? { ...state, status: 'running' } : state
  }
  if (command.type === 'therapy.stop' && command.therapy === 'ventilator') {
    return { ...state, status: 'off', peakPressureCmH2O: 0, plateauPressureCmH2O: 0 }
  }
  if (command.type !== 'therapy.adjust' || command.therapy !== 'ventilator') return state

  if (command.control === 'mode' && typeof command.value === 'string') {
    const mode = command.value as IcuVentilatorMode
    return mode === 'volume-control' || mode === 'pressure-control' || mode === 'pressure-support'
      ? { ...state, mode }
      : state
  }
  const value = numericValue(command)
  if (value === null) return state
  if (command.control === 'tidal-volume-ml')
    return { ...state, tidalVolumeMl: clamp(value, 200, 900) }
  if (command.control === 'rate-per-min') return { ...state, ratePerMin: clamp(value, 4, 40) }
  if (command.control === 'peep-cmh2o') return { ...state, peepCmH2O: clamp(value, 0, 24) }
  if (command.control === 'fio2') return { ...state, fio2: clamp(value, 0.21, 1) }
  if (command.control === 'inspiratory-pressure-cmh2o')
    return { ...state, inspiratoryPressureCmH2O: clamp(value, 4, 40) }
  if (command.control === 'pressure-support-cmh2o')
    return { ...state, pressureSupportCmH2O: clamp(value, 0, 30) }
  return state
}

function alarm(
  code: string,
  message: string,
  priority: IcuDeviceAlarm['priority'] = null,
): Omit<IcuDeviceAlarm, 'startedAtSeconds' | 'acknowledgedAtSeconds' | 'correctedAtSeconds'> {
  return {
    id: `ventilator:${code}`,
    subsystem: 'ventilator',
    code,
    message,
    priority,
    mappingReviewStatus: 'pending',
    active: true,
  }
}

export function stepVentilator(
  state: IcuVentilatorState,
  snapshot: IcuPatientSnapshot,
  _deltaSeconds: number,
): IcuTherapyStepResult<IcuVentilatorState> {
  if (state.status !== 'running') {
    return { state, effects: [], alarms: [], telemetry: { status: state.status } }
  }

  const patient = snapshot.patient
  const complianceLPerCmH2O = patient.respiratory.complianceMlCmH2O / 1000
  const resistance = patient.respiratory.resistanceCmH2OPerLps
  const desiredTidalVolumeMl =
    state.mode === 'volume-control'
      ? state.tidalVolumeMl
      : clamp(
          (state.mode === 'pressure-control'
            ? state.inspiratoryPressureCmH2O
            : state.pressureSupportCmH2O) * patient.respiratory.complianceMlCmH2O,
          120,
          1_100,
        )
  const deliveredTidalVolumeMl = desiredTidalVolumeMl
  const inspiratoryTimeSeconds = clamp(0.8, 0.35, 1.4)
  const flowLps = deliveredTidalVolumeMl / 1000 / inspiratoryTimeSeconds
  const peakPressure = equationOfMotionPressure({
    peepCmH2O: state.peepCmH2O,
    intrinsicPeepCmH2O: 0,
    resistanceCmH2OPerLps: resistance,
    flowLps,
    volumeL: deliveredTidalVolumeMl / 1000,
    complianceLPerCmH2O,
    inspiratoryEffortCmH2O: 0,
  })
  const plateauPressure =
    state.peepCmH2O + deliveredTidalVolumeMl / 1000 / Math.max(0.005, complianceLPerCmH2O)
  const rate = Math.max(state.ratePerMin, patient.respiratory.spontaneousRatePerMin * 0.25)
  const minuteVentilation = (deliveredTidalVolumeMl * rate) / 1000
  const next: IcuVentilatorState = {
    ...state,
    tidalVolumeMl: roundTo(deliveredTidalVolumeMl, 0),
    peakPressureCmH2O: roundTo(peakPressure, 1),
    plateauPressureCmH2O: roundTo(plateauPressure, 1),
    minuteVentilationLMin: roundTo(minuteVentilation, 1),
  }
  const alarms: ReturnType<typeof alarm>[] = []
  if (peakPressure > 40) alarms.push(alarm('HIGH_PRESSURE', 'Airway pressure above limit'))
  else if (plateauPressure > 30) alarms.push(alarm('HIGH_PLATEAU', 'Plateau pressure is elevated'))
  if (minuteVentilation < 3.5) alarms.push(alarm('LOW_MINUTE_VOLUME', 'Minute ventilation is low'))

  const meanAirwayPressure = state.peepCmH2O + Math.max(0, plateauPressure - state.peepCmH2O) * 0.36
  return {
    state: next,
    effects: [
      {
        kind: 'airway-pressure',
        source: 'ventilator',
        peepCmH2O: state.peepCmH2O,
        meanAirwayPressureCmH2O: roundTo(meanAirwayPressure, 1),
        plateauPressureCmH2O: roundTo(plateauPressure, 1),
        minuteVentilationLMin: roundTo(minuteVentilation, 1),
        fio2: state.fio2,
      },
      {
        kind: 'gas-exchange',
        source: 'ventilator',
        oxygenationCapacity: clamp(
          state.fio2 * (1 - patient.respiratory.shuntFraction) + state.peepCmH2O * 0.012,
          0,
          1,
        ),
        co2RemovalMlMin: clamp(
          minuteVentilation * 28 * (1 - patient.respiratory.deadSpaceFraction),
          0,
          500,
        ),
      },
    ],
    alarms,
    telemetry: {
      deliveredTidalVolumeMl: next.tidalVolumeMl,
      peakPressureCmH2O: next.peakPressureCmH2O,
      plateauPressureCmH2O: next.plateauPressureCmH2O,
      minuteVentilationLMin: next.minuteVentilationLMin,
    },
  }
}

export const icuVentilatorAdapter: IcuTherapyAdapter<IcuVentilatorState, IcuCommand> = {
  id: 'ventilator',
  createInitialState: createInitialIcuVentilatorState,
  reduce(state, action) {
    return reduceVentilatorCommand(state, action)
  },
  step: stepVentilator,
}
