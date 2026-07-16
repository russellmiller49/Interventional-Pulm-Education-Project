import { createInitialCrrtSimulationState } from '../initialState'
import { crrtSimulationReducer } from '../reducer'
import { selectFirstAlarmPendingDeviceMapping } from '../selectors'
import { createSyntheticFixture } from '../testSupport/syntheticFixture'

describe('CRRT derived alarm lifecycle', () => {
  it('keeps acknowledgement separate from correction of the cause', () => {
    let state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    state = crrtSimulationReducer(state, {
      type: 'SET_FAULT',
      fault: 'access-obstruction',
      active: true,
    })
    expect(state.alarms).toHaveLength(1)
    const alarm = state.alarms[0]

    state = crrtSimulationReducer(state, { type: 'ACKNOWLEDGE_ALARM', alarmId: alarm.id })
    expect(state.alarms[0].acknowledgedAtSeconds).toBe(0)
    expect(state.interventions.at(-1)).toMatchObject({
      type: 'ACKNOWLEDGE_ALARM',
      source: 'engine-action',
    })
    expect(state.scenario.activeFaults).toContain('access-obstruction')
    expect(state.alarms[0].active).toBe(true)

    state = crrtSimulationReducer(state, {
      type: 'CORRECT_FAULT',
      fault: 'access-obstruction',
    })
    expect(state.alarms).toHaveLength(0)
    expect(state.alarmHistory.at(-1)).toMatchObject({
      id: alarm.id,
      active: false,
      resolvedAtSeconds: 0,
    })
  })

  it('keeps engine alarms priority-free until a device adapter maps them', () => {
    let state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    state = crrtSimulationReducer(state, {
      type: 'SET_FAULT',
      fault: 'access-obstruction',
      active: true,
    })
    state = crrtSimulationReducer(state, {
      type: 'SET_FAULT',
      fault: 'blood-leak-detected',
      active: true,
    })
    state = crrtSimulationReducer(state, {
      type: 'SET_FAULT',
      fault: 'air-detected',
      active: true,
    })
    expect(state.alarms.map((alarm) => alarm.code)).toEqual([
      'ACCESS_OBSTRUCTION',
      'AIR_DETECTED',
      'BLOOD_LEAK_DETECTED',
    ])
    expect(selectFirstAlarmPendingDeviceMapping(state)?.code).toBe('ACCESS_OBSTRUCTION')
    expect(state.alarms.every((alarm) => alarm.urgency === null)).toBe(true)
    expect(
      state.alarms.every((alarm) => alarm.deviceMappingStatus === 'pending-device-adapter'),
    ).toBe(true)
  })

  it('does nothing when asked to acknowledge an alarm that is not active', () => {
    const state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    expect(crrtSimulationReducer(state, { type: 'ACKNOWLEDGE_ALARM', alarmId: 'missing' })).toBe(
      state,
    )
  })

  it('records only the first acknowledgement of one alarm occurrence', () => {
    let state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    state = crrtSimulationReducer(state, {
      type: 'SET_FAULT',
      fault: 'filter-fouling',
      active: true,
    })
    const alarmId = state.alarms[0].id
    state = crrtSimulationReducer(state, { type: 'ACKNOWLEDGE_ALARM', alarmId })
    const once = state
    state = crrtSimulationReducer(state, { type: 'ACKNOWLEDGE_ALARM', alarmId })
    expect(state).toBe(once)
    expect(
      state.interventions.filter((record) => record.type === 'ACKNOWLEDGE_ALARM'),
    ).toHaveLength(1)
  })
})
