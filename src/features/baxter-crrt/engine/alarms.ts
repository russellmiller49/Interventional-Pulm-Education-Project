import type { ActiveAlarm, CrrtEngineFaultId, CrrtSimulationState, EngineAlarmCode } from './types'

export const CRRT_MAX_ALARM_HISTORY = 200

interface EngineAlarmDescriptor {
  readonly code: EngineAlarmCode
  readonly cause: CrrtEngineFaultId
}

const alarmByFault: Readonly<Record<CrrtEngineFaultId, EngineAlarmDescriptor>> = Object.freeze({
  'access-obstruction': {
    code: 'ACCESS_OBSTRUCTION',
    cause: 'access-obstruction',
  },
  'access-disconnection': {
    code: 'ACCESS_DISCONNECTION',
    cause: 'access-disconnection',
  },
  'return-obstruction': {
    code: 'RETURN_OBSTRUCTION',
    cause: 'return-obstruction',
  },
  'return-disconnection': {
    code: 'RETURN_DISCONNECTION',
    cause: 'return-disconnection',
  },
  'filter-fouling': {
    code: 'FILTER_FOULING',
    cause: 'filter-fouling',
  },
  'effluent-obstruction': {
    code: 'EFFLUENT_OBSTRUCTION',
    cause: 'effluent-obstruction',
  },
  'air-detected': {
    code: 'AIR_DETECTED',
    cause: 'air-detected',
  },
  'blood-leak-detected': {
    code: 'BLOOD_LEAK_DETECTED',
    cause: 'blood-leak-detected',
  },
  'supply-bag-empty': {
    code: 'SUPPLY_BAG_EMPTY',
    cause: 'supply-bag-empty',
  },
  'effluent-bag-full': {
    code: 'EFFLUENT_BAG_FULL',
    cause: 'effluent-bag-full',
  },
  'scale-open': {
    code: 'SCALE_OPEN',
    cause: 'scale-open',
  },
  'fluid-gain-loss': {
    code: 'FLUID_GAIN_LOSS',
    cause: 'fluid-gain-loss',
  },
  'power-interruption': {
    code: 'POWER_INTERRUPTION',
    cause: 'power-interruption',
  },
})

export function evaluateEngineAlarmDescriptors(
  state: CrrtSimulationState,
): readonly EngineAlarmDescriptor[] {
  const faults = new Set(state.scenario.activeFaults)
  if (state.circuit.airDetected) faults.add('air-detected')
  if (state.circuit.bloodLeakDetected) faults.add('blood-leak-detected')
  if (state.circuit.bags.some((bag) => bag.scaleOpen)) faults.add('scale-open')
  if (
    state.circuit.bags.some(
      (bag) => bag.direction === 'source' && bag.connected && bag.calculatedVolumeMl === 0,
    )
  ) {
    faults.add('supply-bag-empty')
  }
  if (
    state.circuit.bags.some(
      (bag) =>
        bag.direction === 'effluent' && bag.connected && bag.calculatedVolumeMl === bag.capacityMl,
    )
  ) {
    faults.add('effluent-bag-full')
  }

  return [...faults]
    .map((fault) => alarmByFault[fault])
    .sort((left, right) => left.code.localeCompare(right.code))
}

export function reconcileEngineAlarms(state: CrrtSimulationState): CrrtSimulationState {
  const descriptors = evaluateEngineAlarmDescriptors(state)
  const descriptorCodes = new Set(descriptors.map((descriptor) => descriptor.code))
  const existingByCode = new Map(state.alarms.map((alarm) => [alarm.code, alarm]))
  let nextAlarmSequence = state.nextAlarmSequence
  const alarms = descriptors.map((descriptor) => {
    const existing = existingByCode.get(descriptor.code)
    if (existing) return existing
    const alarm: ActiveAlarm = {
      id: `${descriptor.code}:${state.simulationTimeSeconds}:${nextAlarmSequence}`,
      code: descriptor.code,
      cause: descriptor.cause,
      urgency: null,
      startedAtSeconds: state.simulationTimeSeconds,
      active: true,
      deviceMappingStatus: 'pending-device-adapter',
      reviewStatus: 'pending',
    }
    nextAlarmSequence += 1
    return alarm
  })
  const resolved = state.alarms
    .filter((alarm) => !descriptorCodes.has(alarm.code))
    .map((alarm) => ({
      ...alarm,
      active: false,
      resolvedAtSeconds: state.simulationTimeSeconds,
    }))

  return {
    ...state,
    alarms,
    alarmHistory: [...state.alarmHistory, ...resolved].slice(-CRRT_MAX_ALARM_HISTORY),
    nextAlarmSequence,
  }
}

export function acknowledgeEngineAlarm(
  state: CrrtSimulationState,
  alarmId: string,
): CrrtSimulationState {
  if (!state.alarms.some((alarm) => alarm.id === alarmId)) return state
  return {
    ...state,
    alarms: state.alarms.map((alarm) =>
      alarm.id === alarmId && alarm.acknowledgedAtSeconds === undefined
        ? { ...alarm, acknowledgedAtSeconds: state.simulationTimeSeconds }
        : alarm,
    ),
  }
}
