/**
 * The adapter is the only place a live pressure value may come from, and it may
 * only pass through what the engine already computed. These tests pin both
 * halves: equality with the engine observer, and the semantics a surface needs
 * so it never has to work anything out for itself.
 */
import {
  crrtPressureSignalDetails,
  crrtCircuitNode,
  type CrrtPressureSignalId,
} from '../../content/circuitModel'
import {
  createInitialPrismaxPilotInterfaceState,
  selectPrismaxPilotCaseOperationsDisplay,
  selectPrismaxPilotOperationsDisplay,
  type CrrtDevicePressureSignalView,
} from '../deviceAdapters/prismax'
import { createInitialCrrtSimulationState } from '../initialState'
import { CRRT_TREND_INTERVAL_SECONDS } from '../simulation'
import {
  advance,
  crrtLivePressureReviewStates,
  loadFixture,
  runningState,
  start,
  steadyFixture,
  withBloodFlow,
} from '../testSupport/livePressureStates'
import type { CrrtSimulationState } from '../types'

const ui = createInitialPrismaxPilotInterfaceState()

function view(state: CrrtSimulationState) {
  return selectPrismaxPilotCaseOperationsDisplay(ui, state)
}

function signal(
  state: CrrtSimulationState,
  id: CrrtPressureSignalId,
): CrrtDevicePressureSignalView {
  const found = view(state).pressureSignals.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No pressure signal view for ${id}`)
  return found
}

describe('live pressure adapter — engine equality', () => {
  it('publishes exactly the engine pressures, never a recomputed one', () => {
    for (const { id, state } of crrtLivePressureReviewStates()) {
      const engine = state.circuit.pressures
      const signals = view(state).pressureSignals
      const byId = new Map(signals.map((entry) => [entry.id, entry.valueMmHg]))

      expect([id, byId.get('access')]).toEqual([id, engine.accessPressureMmHg])
      expect([id, byId.get('filter')]).toEqual([id, engine.filterPressureMmHg])
      expect([id, byId.get('return')]).toEqual([id, engine.returnPressureMmHg])
      expect([id, byId.get('effluent')]).toEqual([id, engine.effluentPressureMmHg])
      expect([id, byId.get('tmp')]).toEqual([id, engine.prismaxTransmembranePressureMmHg])
      expect([id, byId.get('filter-drop')]).toEqual([id, engine.prismaxFilterPressureDropMmHg])
    }
  })

  it('agrees with the pressures block it sits beside', () => {
    for (const { id, state } of crrtLivePressureReviewStates()) {
      const display = view(state)
      const byId = new Map(display.pressureSignals.map((entry) => [entry.id, entry.valueMmHg]))
      expect([id, byId.get('tmp')]).toEqual([id, display.pressures.transmembranePressureMmHg])
      expect([id, byId.get('filter-drop')]).toEqual([id, display.pressures.filterPressureDropMmHg])
    }
  })

  it('never emits a nonfinite pressure', () => {
    for (const { id, state } of crrtLivePressureReviewStates()) {
      for (const entry of view(state).pressureSignals) {
        if (entry.valueMmHg !== null) {
          expect([id, entry.id, Number.isFinite(entry.valueMmHg)]).toEqual([id, entry.id, true])
        }
        for (const sample of entry.history) {
          if (sample.valueMmHg !== null) {
            expect(Number.isFinite(sample.valueMmHg)).toBe(true)
          }
        }
      }
    }
  })

  it('leaves the pinned case-free pressures block untouched', () => {
    const display = selectPrismaxPilotOperationsDisplay(ui)
    expect(Object.values(display.pressures).every((value) => value === null)).toBe(true)
    expect(display.pressureSignals).toHaveLength(6)
    for (const entry of display.pressureSignals) {
      expect(entry.valueMmHg).toBeNull()
      expect(entry.availability).toBe('no-case-attached')
      expect(entry.unavailableReason).not.toBeNull()
    }
  })
})

describe('live pressure adapter — direct sites versus calculated relationships', () => {
  it('classifies four sites and two relationships, in the circuit model order', () => {
    const signals = view(runningState()).pressureSignals
    expect(signals.map((entry) => entry.id)).toEqual([
      'access',
      'filter',
      'return',
      'effluent',
      'tmp',
      'filter-drop',
    ])
    expect(
      signals.filter((entry) => entry.kind === 'directly-modelled-site').map((entry) => entry.id),
    ).toEqual(['access', 'filter', 'return', 'effluent'])
    expect(
      signals.filter((entry) => entry.kind === 'calculated-relationship').map((entry) => entry.id),
    ).toEqual(['tmp', 'filter-drop'])
  })

  it('gives every direct site its frozen circuit node and no derivation', () => {
    const expected: Readonly<Record<string, string>> = {
      access: 'access-pressure',
      filter: 'filter-pressure',
      return: 'return-pressure',
      effluent: 'effluent-pressure',
    }
    for (const entry of view(runningState()).pressureSignals) {
      if (entry.kind !== 'directly-modelled-site') continue
      expect(entry.nodeId).toBe(expected[entry.id])
      expect(entry.derivedFromNodeIds).toEqual([])
      expect(entry.derivedFromSignalIds).toEqual([])
      expect(entry.contributingSiteLabels).toEqual([])
    }
  })

  it('gives neither relationship a node, and names the sites each is built from', () => {
    const tmp = signal(runningState(), 'tmp')
    expect(tmp.nodeId).toBeNull()
    expect(tmp.derivedFromNodeIds).toEqual([
      'filter-pressure',
      'return-pressure',
      'effluent-pressure',
    ])
    expect(tmp.derivedFromSignalIds).toEqual(['filter', 'return', 'effluent'])
    expect(tmp.contributingSiteLabels).toEqual([
      crrtCircuitNode('filter-pressure').label,
      crrtCircuitNode('return-pressure').label,
      crrtCircuitNode('effluent-pressure').label,
    ])

    const drop = signal(runningState(), 'filter-drop')
    expect(drop.nodeId).toBeNull()
    expect(drop.derivedFromNodeIds).toEqual(['filter-pressure', 'return-pressure'])
    expect(drop.derivedFromSignalIds).toEqual(['filter', 'return'])
    expect(drop.contributingSiteLabels).toHaveLength(2)
  })

  it('carries the circuit model’s own source ids rather than inventing any', () => {
    for (const entry of view(runningState()).pressureSignals) {
      const detail = crrtPressureSignalDetails.find((candidate) => candidate.id === entry.id)
      expect(entry.sourceIds).toEqual(detail?.sourceIds)
    }
  })
})

describe('live pressure adapter — history is reported honestly', () => {
  it('records a sampled series for the four channels the engine writes', () => {
    const state = runningState()
    for (const id of ['access', 'filter', 'return', 'tmp'] as const) {
      const entry = signal(state, id)
      expect(entry.historyAvailability).toBe('sampled')
      expect(entry.historyUnavailableReason).toBeNull()
      expect(entry.history.length).toBe(state.trends.length)
      expect(entry.history.length).toBeGreaterThan(1)
    }
  })

  it('reports no series for the two channels the engine never sampled', () => {
    const state = runningState()
    for (const id of ['effluent', 'filter-drop'] as const) {
      const entry = signal(state, id)
      expect(entry.historyAvailability).toBe('not-recorded')
      expect(entry.history).toEqual([])
      expect(entry.historyUnavailableReason).toMatch(/current value only/i)
    }
  })

  it('takes every historical point from the engine trend record verbatim', () => {
    const state = runningState()
    const access = signal(state, 'access')
    expect(access.history.map((sample) => sample.timeSeconds)).toEqual(
      state.trends.map((sample) => sample.timeSeconds),
    )
    expect(access.history.map((sample) => sample.valueMmHg)).toEqual(
      state.trends.map((sample) => sample.accessPressureMmHg),
    )
  })

  it('publishes one shared time basis and a per-channel value domain', () => {
    const display = view(runningState())
    const domain = display.treatmentContext.historyTimeDomainSeconds
    expect(domain).not.toBeNull()
    expect(domain!.startSeconds).toBeLessThan(domain!.endSeconds)
    expect(display.treatmentContext.historyIntervalSeconds).toBe(CRRT_TREND_INTERVAL_SECONDS)

    const access = display.pressureSignals.find((entry) => entry.id === 'access')!
    expect(access.historyValueDomainMmHg).not.toBeNull()
    expect(access.historyValueDomainMmHg!.minMmHg).toBeLessThanOrEqual(
      access.historyValueDomainMmHg!.maxMmHg,
    )
    const effluent = display.pressureSignals.find((entry) => entry.id === 'effluent')!
    expect(effluent.historyValueDomainMmHg).toBeNull()
  })
})

describe('live pressure adapter — live behaviour', () => {
  it('moves pressures when blood flow changes, with no new obstruction', () => {
    const base = runningState()
    const faster = advance(withBloodFlow(base, 180), 1_800)

    expect(base.scenario.activeFaults).toEqual([])
    expect(faster.scenario.activeFaults).toEqual([])

    expect(signal(faster, 'access').valueMmHg).toBeLessThan(signal(base, 'access').valueMmHg!)
    expect(signal(faster, 'filter').valueMmHg).toBeGreaterThan(signal(base, 'filter').valueMmHg!)
    expect(signal(faster, 'return').valueMmHg).toBeGreaterThan(signal(base, 'return').valueMmHg!)
    expect(signal(faster, 'tmp').valueMmHg).toBeGreaterThan(signal(base, 'tmp').valueMmHg!)
    expect(signal(faster, 'filter-drop').valueMmHg).toBeGreaterThan(
      signal(base, 'filter-drop').valueMmHg!,
    )
  })

  it('leaves effluent pressure alone when blood flow changes, as the model states', () => {
    const base = runningState()
    const faster = advance(withBloodFlow(base, 180), 1_800)
    expect(signal(faster, 'effluent').valueMmHg).toBe(signal(base, 'effluent').valueMmHg)
  })

  it('reports a stopped pump instead of letting reference values read as live', () => {
    const stopped = crrtLivePressureReviewStates().find(
      (entry) => entry.id === 'stopped-therapy',
    )!.state
    const context = view(stopped).treatmentContext
    expect(context.deliveryState).toBe('paused')
    expect(context.bloodPumpRunning).toBe(false)
    expect(context.bloodFlowContributesToPressures).toBe(false)
    // The engine still publishes numbers here; that is exactly why the flag matters.
    expect(signal(stopped, 'access').valueMmHg).not.toBeNull()
  })

  it('marks the whole model unavailable rather than reporting zero', () => {
    const empty = createInitialCrrtSimulationState()
    for (const entry of view(empty).pressureSignals) {
      expect(entry.valueMmHg).toBeNull()
      expect(entry.valueMmHg).not.toBe(0)
      expect(entry.availability).toBe('no-pressure-model')
      expect(entry.unavailableReason).toMatch(/not a reading of zero/i)
    }
  })

  it('flags blood flow as contributing only while the pump runs and both lumens are connected', () => {
    const loaded = loadFixture(steadyFixture)
    expect(view(loaded).treatmentContext.bloodFlowContributesToPressures).toBe(false)
    expect(view(start(loaded)).treatmentContext.bloodFlowContributesToPressures).toBe(true)
  })
})

describe('live pressure adapter — withheld quantities stay withheld', () => {
  it('publishes no fluid-conservation quantity through the pressure profile', () => {
    const display = view(runningState())
    const serialised = JSON.stringify({
      pressureSignals: display.pressureSignals,
      treatmentContext: display.treatmentContext,
    })
    expect(serialised).not.toMatch(/machinePatientFluidRemoval/i)
    expect(serialised).not.toMatch(/wholePatientBalance/i)
    expect(serialised).not.toMatch(/fluidLedger/i)
  })
})
