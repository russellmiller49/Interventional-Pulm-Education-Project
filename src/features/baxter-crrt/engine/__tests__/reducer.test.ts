import { createInitialCrrtSimulationState } from '../initialState'
import { crrtSimulationReducer } from '../reducer'
import {
  selectEngineReadiness,
  selectNextScheduledEvent,
  selectSecondsUntilNextScheduledEvent,
} from '../selectors'
import type { CrrtScheduledEventDefinition } from '../types'
import { createSyntheticFixture } from '../testSupport/syntheticFixture'

describe('CRRT shared reducer and initial state', () => {
  it('starts unconfigured, idle, direction-only for citrate, and without clinical values', () => {
    const state = createInitialCrrtSimulationState()
    expect(state).toMatchObject({
      simulationTimeSeconds: 0,
      experience: 'orientation',
      deviceId: 'prismax-aw8035-2xx',
      roleLens: 'integrated',
      protocolProfileVersion: null,
      patient: { status: 'unconfigured', synthetic: true },
      access: { status: 'unconfigured' },
      prescription: { status: 'unconfigured', modality: null },
      device: { deliveryState: 'idle', adapterStatus: 'operational-v1' },
      circuit: { citrate: { status: 'conceptual-direction-only' } },
    })
    expect(state.trends).toEqual([])
    expect(state.alarms).toEqual([])
    expect(selectEngineReadiness(state).readyForDraftSimulation).toBe(false)
  })

  it('fails closed when running is requested before a fixture is configured', () => {
    const state = createInitialCrrtSimulationState()
    const result = crrtSimulationReducer(state, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: 'running',
    })
    expect(result).toBe(state)
  })

  it('derives the clinical seed independently of device and reloads a clean fixture', () => {
    const fixture = createSyntheticFixture()
    const prismax = createInitialCrrtSimulationState({
      experience: 'practice',
      attempt: 2,
      deviceId: 'prismax-aw8035-2xx',
    })
    const prismaflex = createInitialCrrtSimulationState({
      experience: 'practice',
      attempt: 2,
      deviceId: 'prismaflex-g5036003-6xx',
    })
    expect(prismax.seed).toBe(prismaflex.seed)
    expect(prismax.deviceProfileVersion).not.toBe(prismaflex.deviceProfileVersion)
    expect(
      createInitialCrrtSimulationState({
        fixture,
        deviceId: 'prismaflex-g5036003-6xx',
      }).device.adapterStatus,
    ).toBe('operational-v1')

    let progressed = createInitialCrrtSimulationState({
      fixture,
      experience: 'practice',
      attempt: 2,
    })
    progressed = crrtSimulationReducer(progressed, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: 'running',
    })
    progressed = crrtSimulationReducer(progressed, { type: 'ADVANCE_TIME', seconds: 600 })
    const reloaded = crrtSimulationReducer(progressed, {
      type: 'LOAD_FIXTURE',
      fixture,
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 2,
    })
    expect(reloaded.simulationTimeSeconds).toBe(0)
    expect(reloaded.deliveredTherapy.cumulativeActualEffluentMl).toBe(0)
    expect(reloaded.alarms).toEqual([])
    expect(reloaded.trends).toEqual([])
  })

  it('processes authored deterministic events at their exact simulated time', () => {
    const event: CrrtScheduledEventDefinition = {
      id: 'synthetic-access-event',
      atSeconds: 350,
      jitterSeconds: null,
      action: { type: 'SET_FAULT', fault: 'access-obstruction', active: true },
      reviewStatus: 'pending',
      sourceIds: ['TEST-P2-001'],
    }
    let state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture([event]) })
    expect(selectNextScheduledEvent(state)?.scheduledAtSeconds).toBe(350)
    expect(selectSecondsUntilNextScheduledEvent(state)).toBe(350)
    state = crrtSimulationReducer(state, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: 'running',
    })
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 349 })
    expect(state.scenario.activeFaults).not.toContain('access-obstruction')
    expect(selectSecondsUntilNextScheduledEvent(state)).toBe(1)
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 1 })
    expect(state.simulationTimeSeconds).toBe(350)
    expect(state.scenario.activeFaults).toContain('access-obstruction')
    expect(state.alarms[0].code).toBe('ACCESS_OBSTRUCTION')
    expect(state.scenario.appliedEventIds).toEqual(['synthetic-access-event'])
    expect(selectSecondsUntilNextScheduledEvent(state)).toBeNull()
  })

  it('keeps conceptual citrate state separate from prescription updates', () => {
    const state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    const updated = crrtSimulationReducer(state, {
      type: 'SET_PRESCRIPTION',
      prescription: createSyntheticFixture().prescription,
    })
    expect(updated.circuit.citrate).toEqual(state.circuit.citrate)
    expect(Object.keys(updated.prescription)).not.toEqual(
      expect.arrayContaining(['citrateDose', 'calciumTarget', 'adjustmentInstruction']),
    )
  })

  it('rejects invalid time and fluid-rate inputs instead of creating NaN', () => {
    const state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    expect(() =>
      crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: Number.NaN }),
    ).toThrow(/finite/i)
    expect(() =>
      crrtSimulationReducer(state, {
        type: 'SET_EXTERNAL_FLUID_RATES',
        rates: { ...state.scenario.externalFluidRates, maintenanceInputMlHour: -1 },
      }),
    ).toThrow(/nonnegative/i)
  })
})
