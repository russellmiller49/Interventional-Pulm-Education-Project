import { CRRT_MAX_ALARM_HISTORY } from '../alarms'
import { createInitialCrrtSimulationState } from '../initialState'
import { crrtSimulationReducer } from '../reducer'
import { selectEngineReadiness } from '../selectors'
import type { BagState, CrrtScheduledEventDefinition } from '../types'
import { createSyntheticFixture } from '../testSupport/syntheticFixture'

const TEST_SOURCE_ID = 'TEST-P2-001'

function withBagChanges(changes: (bags: readonly BagState[]) => readonly BagState[]) {
  const fixture = createSyntheticFixture()
  return { ...fixture, bags: changes(fixture.bags ?? []) }
}

describe('CRRT Phase 2 fail-closed safety invariants', () => {
  it('keeps direction-only citrate education separate from scheduled treatment controls', () => {
    const startEvent: CrrtScheduledEventDefinition = {
      id: 'scheduled-start',
      atSeconds: 0,
      jitterSeconds: null,
      action: { type: 'SET_DELIVERY_STATE', deliveryState: 'running' },
      reviewStatus: 'pending',
      sourceIds: [TEST_SOURCE_ID],
    }
    const fixture = createSyntheticFixture([startEvent])
    let state = createInitialCrrtSimulationState({ fixture })
    expect(selectEngineReadiness(state).readyForDraftSimulation).toBe(true)
    expect(state.circuit.citrate.status).toBe('conceptual-direction-only')
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 0 })
    expect(state.device.deliveryState).toBe('running')
    expect(state.deliveredTherapy.cumulativeActualEffluentMl).toBe(0)
  })

  it('recomputes derived pressure immediately after a scheduled resistance event', () => {
    const resistanceEvent: CrrtScheduledEventDefinition = {
      id: 'resistance-change',
      atSeconds: 60,
      jitterSeconds: null,
      action: { type: 'SET_ACCESS_RESISTANCE', resistanceMmHgPerMlMin: 1 },
      reviewStatus: 'pending',
      sourceIds: [TEST_SOURCE_ID],
    }
    let state = createInitialCrrtSimulationState({
      fixture: createSyntheticFixture([resistanceEvent]),
    })
    state = crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'running' })
    const before = state.circuit.pressures.accessPressureMmHg
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    expect(state.circuit.pressures.accessPressureMmHg).toBeLessThan(before ?? 0)
    expect(state.circuit.pressures.accessPressureMmHg).toBe(-195)
  })

  it('uses zero actual blood flow for pressure derivation while paused', () => {
    let state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    state = crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'running' })
    expect(state.circuit.pressures.accessPressureMmHg).toBe(-35)
    state = crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'paused' })
    expect(state.circuit.pressures.accessPressureMmHg).toBe(5)
    expect(state.circuit.pressures.filterPressureMmHg).toBe(5)
    expect(state.circuit.pressures.returnPressureMmHg).toBe(5)
  })

  it.each([
    ['access-disconnection', 'accessConnected'],
    ['return-disconnection', 'returnConnected'],
  ] as const)(
    'models and corrects an active %s without inventing a device reaction',
    (fault, connectionField) => {
      let state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
      state = crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'running' })
      state = crrtSimulationReducer(state, { type: 'SET_FAULT', fault, active: true })
      expect(state.access.status === 'configured' && state.access[connectionField]).toBe(false)
      expect(state.scenario.activeFaults).toContain(fault)
      expect(state.alarms).toEqual([
        expect.objectContaining({ cause: fault, urgency: null, active: true }),
      ])

      state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
      expect(state.deliveredTherapy.downtimeSecondsByReason.access).toBe(60)

      state = crrtSimulationReducer(state, { type: 'CORRECT_FAULT', fault })
      expect(state.access.status === 'configured' && state.access[connectionField]).toBe(true)
      expect(state.scenario.activeFaults).not.toContain(fault)
      expect(state.alarms).toEqual([])
    },
  )

  it.each([
    ['access-disconnection', 'accessConnected'],
    ['return-disconnection', 'returnConnected'],
  ] as const)(
    'does not reconnect %s when correcting a fault that was never active',
    (fault, connectionField) => {
      const fixture = createSyntheticFixture()
      const disconnected = {
        ...fixture,
        access: { ...fixture.access, [connectionField]: false },
      }
      const state = createInitialCrrtSimulationState({ fixture: disconnected })
      const corrected = crrtSimulationReducer(state, { type: 'CORRECT_FAULT', fault })
      expect(corrected.access.status === 'configured' && corrected.access[connectionField]).toBe(
        false,
      )
    },
  )

  it('uses unique deterministic alarm occurrence IDs and caps immediate history', () => {
    let state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    const occurrenceIds: string[] = []
    for (let index = 0; index < CRRT_MAX_ALARM_HISTORY + 5; index += 1) {
      state = crrtSimulationReducer(state, {
        type: 'SET_FAULT',
        fault: 'air-detected',
        active: true,
      })
      occurrenceIds.push(state.alarms[0].id)
      state = crrtSimulationReducer(state, {
        type: 'CORRECT_FAULT',
        fault: 'air-detected',
      })
    }
    expect(new Set(occurrenceIds).size).toBe(CRRT_MAX_ALARM_HISTORY + 5)
    expect(state.alarmHistory).toHaveLength(CRRT_MAX_ALARM_HISTORY)
  })

  it('keeps pending device alarm mappings informational to the shared engine', () => {
    let state = createInitialCrrtSimulationState({ fixture: createSyntheticFixture() })
    state = crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'running' })
    state = crrtSimulationReducer(state, {
      type: 'SET_FAULT',
      fault: 'air-detected',
      active: true,
    })
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    expect(state.alarms[0]).toMatchObject({ code: 'AIR_DETECTED', urgency: null })
    expect(state.deliveredTherapy.cumulativeActualEffluentMl).toBeGreaterThan(0)
    expect(state.deliveredTherapy.cumulativeDowntimeSeconds).toBe(0)
  })

  it('couples every active source and effluent bag to one feasible delivery fraction', () => {
    const fixture = withBagChanges((bags) =>
      bags.map((bag) =>
        bag.flowTerm === 'dialysate' ? { ...bag, calculatedVolumeMl: 5, measuredVolumeMl: 5 } : bag,
      ),
    )
    let state = createInitialCrrtSimulationState({ fixture })
    state = crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'running' })
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    const dialysate = state.circuit.bags.find((bag) => bag.flowTerm === 'dialysate')
    const effluent = state.circuit.bags.find((bag) => bag.flowTerm === 'effluent')
    expect(dialysate?.cumulativePumpVolumeMl).toBeCloseTo(5, 12)
    expect(effluent?.cumulativePumpVolumeMl).toBeCloseTo(5.5, 12)
    expect(state.deliveredTherapy.cumulativeActualEffluentMl).toBeCloseTo(5.5, 12)
    expect(state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl).toBeCloseTo(0.5, 12)
    expect(state.deliveredTherapy.downtimeSecondsByReason['bag-scale']).toBeCloseTo(42, 12)
  })

  it('blocks missing, duplicate, disconnected, or open-scale bag topology', () => {
    const missing = createInitialCrrtSimulationState({
      fixture: { ...createSyntheticFixture(), bags: [] },
    })
    expect(selectEngineReadiness(missing).readyForDraftSimulation).toBe(false)

    const duplicateFixture = withBagChanges((bags) => [
      ...bags,
      { ...bags.find((bag) => bag.flowTerm === 'effluent')!, id: 'duplicate-effluent' },
    ])
    const duplicate = createInitialCrrtSimulationState({ fixture: duplicateFixture })
    expect(selectEngineReadiness(duplicate).readyForDraftSimulation).toBe(false)

    const openScaleFixture = withBagChanges((bags) =>
      bags.map((bag) => (bag.flowTerm === 'dialysate' ? { ...bag, scaleOpen: true } : bag)),
    )
    const openScale = createInitialCrrtSimulationState({ fixture: openScaleFixture })
    const afterStart = crrtSimulationReducer(openScale, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: 'running',
    })
    expect(afterStart.device.deliveryState).toBe('idle')
  })

  it('deep-clones nested model calibration from its caller fixture', () => {
    const fixture = createSyntheticFixture()
    const state = createInitialCrrtSimulationState({ fixture })
    const mutableFixture = fixture as unknown as {
      modelConfiguration: {
        pressure: { accessReferencePressureMmHg: number }
        filter: { anticoagulationProtectionFraction: { none: number } }
      }
    }
    mutableFixture.modelConfiguration.pressure.accessReferencePressureMmHg = 999
    mutableFixture.modelConfiguration.filter.anticoagulationProtectionFraction.none = 1
    expect(state.scenario.modelConfiguration.pressure?.accessReferencePressureMmHg).toBe(5)
    expect(state.scenario.modelConfiguration.filter?.anticoagulationProtectionFraction.none).toBe(0)
  })
})
