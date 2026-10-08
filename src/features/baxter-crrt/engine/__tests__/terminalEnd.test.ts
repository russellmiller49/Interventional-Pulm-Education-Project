import { getBaxterCrrtCase } from '../../content/completeCases'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
} from '../learningSession'
import { createInitialCrrtSimulationState } from '../initialState'
import { crrtSimulationReducer } from '../reducer'
import { createSyntheticFixture } from '../testSupport/syntheticFixture'
import type { CrrtScheduledEventDefinition } from '../types'

function session(id: 'CRRT-12' | 'CRRT-13' = 'CRRT-12') {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(id),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

function end(state: CrrtLearningSessionState) {
  state = crrtLearningSessionReducer(state, {
    type: 'DEVICE_ACTION',
    action: { type: 'OPEN_STOP_DIALOG' },
  })
  return crrtLearningSessionReducer(state, {
    type: 'DEVICE_ACTION',
    action: { type: 'END_TREATMENT' },
  })
}

function event(deliveryState: 'running' | 'paused' | 'idle'): CrrtScheduledEventDefinition {
  return {
    id: 'scheduled-delivery-change',
    atSeconds: 60,
    jitterSeconds: null,
    action: { type: 'SET_DELIVERY_STATE', deliveryState },
    reviewStatus: 'pending',
    sourceIds: ['TEST-TERMINAL-END'],
  }
}

describe('terminal End survives scheduled delivery changes', () => {
  it.each([0, 30, 60, 300])(
    'CRRT-12 ended at %s seconds stays ended across the checkpoint',
    (seconds) => {
      let state = session()
      state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds })
      state = end(state)
      expect(state.interfaceState.treatmentState).toBe('ended')
      expect(state.simulation.device.deliveryState).toBe('ended')
      const delivered = state.simulation.deliveredTherapy

      state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 3600 })
      expect(state.simulation.simulationTimeSeconds).toBe(seconds + 3600)
      expect(state.interfaceState.treatmentState).toBe('ended')
      expect(state.simulation.device).toMatchObject({
        deliveryState: 'ended',
        bloodPumpRunning: false,
      })
      expect(state.simulation.deliveredTherapy.cumulativeActualEffluentMl).toBe(
        delivered.cumulativeActualEffluentMl,
      )
      expect(state.simulation.deliveredTherapy.treatmentTimeSeconds).toBe(
        delivered.treatmentTimeSeconds,
      )
      expect(state.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(
        delivered.cumulativeDowntimeSeconds,
      )
      expect(state.simulation.scenario.appliedEventIds).toEqual([
        'crrt12-event-reassessment-checkpoint',
      ])

      const attemptedStart = crrtLearningSessionReducer(state, {
        type: 'DEVICE_ACTION',
        action: { type: 'START_TREATMENT' },
      })
      expect(attemptedStart.simulation).toBe(state.simulation)
      expect(attemptedStart.timeline.at(-1)?.outcome).toBe('refused')
    },
  )

  it.each(['running', 'paused', 'idle'] as const)(
    'a scheduled %s cannot unlock an ended engine',
    (deliveryState) => {
      let state = createInitialCrrtSimulationState({
        fixture: createSyntheticFixture([event(deliveryState)]),
      })
      state = crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'ended' })
      state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 61 })
      expect(state.device.deliveryState).toBe('ended')
      expect(state.device.bloodPumpRunning).toBe(false)
      expect(state.deliveredTherapy.cumulativeActualEffluentMl).toBe(0)
      expect(state.scenario.appliedEventIds).toEqual(['scheduled-delivery-change'])
    },
  )
})

describe('permitted delivery transitions remain available', () => {
  it('keeps a never-ended CRRT-12 delivering through its normal checkpoint', () => {
    const state = crrtLearningSessionReducer(session(), { type: 'ADVANCE_TIME', seconds: 300 })
    expect(state.interfaceState.treatmentState).toBe('running')
    expect(state.simulation.device.bloodPumpRunning).toBe(true)
    expect(state.simulation.deliveredTherapy.cumulativeActualEffluentMl).toBeGreaterThan(0)
    expect(state.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(0)
    expect(state.simulation.scenario.appliedEventIds).toEqual([
      'crrt12-event-reassessment-checkpoint',
    ])
  })

  it('Reset opens a clean CRRT-12 run after End, with the checkpoint available again', () => {
    const ended = crrtLearningSessionReducer(end(session()), { type: 'ADVANCE_TIME', seconds: 300 })
    const reset = crrtLearningSessionReducer(ended, { type: 'RESET' })
    expect(reset.simulation.simulationTimeSeconds).toBe(0)
    expect(reset.simulation.scenario.appliedEventIds).toEqual([])
    expect(reset.interfaceState.treatmentState).toBe('running')
    const advanced = crrtLearningSessionReducer(reset, { type: 'ADVANCE_TIME', seconds: 300 })
    expect(advanced.simulation.device.deliveryState).toBe('running')
    expect(advanced.simulation.deliveredTherapy.cumulativeActualEffluentMl).toBeGreaterThan(0)
  })

  it.each(['idle', 'paused'] as const)(
    'retains a supported authored start from %s',
    (deliveryState) => {
      let state = createInitialCrrtSimulationState({
        fixture: createSyntheticFixture([event('running')]),
      })
      state = crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState })
      state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 120 })
      expect(state.device.deliveryState).toBe('running')
      expect(state.deliveredTherapy.cumulativeActualEffluentMl).toBeGreaterThan(0)
    },
  )

  it('retains CRRT-13 explicit correction and resume after an elapsed pause', () => {
    let state = session('CRRT-13')
    const perform = (suffix: string) => {
      state = crrtLearningSessionReducer(state, {
        type: 'PERFORM_INTERVENTION',
        interventionId: `crrt13-${suffix}`,
      })
    }
    for (const suffix of [
      'assess-patient-device',
      'advance-to-pattern',
      'inspect-access-path',
      'pause-treatment',
    ])
      perform(suffix)
    expect(state.simulation.device.deliveryState).toBe('paused')
    state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 300 })
    const delivered = state.simulation.deliveredTherapy.cumulativeActualEffluentMl
    perform('reposition-access')
    perform('resume-treatment')
    expect(state.simulation.device.deliveryState).toBe('running')
    expect(state.interfaceState.treatmentState).toBe('running')
    state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 300 })
    expect(state.simulation.deliveredTherapy.cumulativeActualEffluentMl).toBeGreaterThan(delivered)
    expect(state.simulation.deliveredTherapy.downtimeSecondsByReason.paused).toBe(300)
  })
})
