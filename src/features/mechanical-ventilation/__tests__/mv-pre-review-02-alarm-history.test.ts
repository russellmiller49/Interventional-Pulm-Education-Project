/**
 * MV-PRE-REVIEW-02 — alarm history is a record of model time, not of how the caller batched it.
 *
 * The final gate on `d4d3cef2` found MV-01's pressure limitation (PEEP 5 → 16 at 12 s) in the
 * history at 1× and missing at 5× and 30×: `reconcileAlarms` ran once per outer call, on the state
 * the call published, so an alarm that rose and cleared inside one call was never recorded. It now
 * runs at every fixed step (`advanceSimulation`). Reproduction and before/after in the handoff (§17).
 *
 * The alarm record keeps one entry per code (documented on `reconcileAlarms`); that contract,
 * thresholds, priorities and the clinical alarm policy are unchanged. D1–D5 are unchanged.
 */
import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import { ventilationSimulationReducer } from '../engine/reducer'
import { advanceSimulation, createInitialSimulationState } from '../engine/simulation'
import type {
  AlarmEvent,
  SimulationSpeed,
  VentilationAction,
  VentilationSimulationState,
} from '../engine/types'
import {
  ASSESSMENT_ONLY,
  NO_ACTION,
  PRIORITY_CASE_IDS,
  attemptForBranch,
  caseArms,
  liveCaseIds,
  type InventoryArm,
  type TimedAction,
} from '../test-support/causalInventory'

const SPEEDS = [1, 5, 30] as const satisfies readonly SimulationSpeed[]
const EPSILON = 1e-6

function opened(caseId: string, branch?: string): VentilationSimulationState {
  const attempt = branch ? attemptForBranch(caseId, branch) : 1
  return createInitialSimulationState(caseId, 'practice', attempt, 'hamilton-c6')
}

const control = (
  at: number,
  name: Extract<VentilationAction, { type: 'SET_CONTROL' }>['control'],
  value: number,
): TimedAction => ({
  at,
  label: `${name}=${value}`,
  action: { type: 'SET_CONTROL', control: name, value },
})
const perform = (at: number, interventionId: string): TimedAction => ({
  at,
  label: interventionId,
  action: { type: 'PERFORM_INTERVENTION', interventionId },
})
const acknowledgeAll = (at: number): TimedAction => ({
  at,
  label: 'acknowledge',
  action: { type: 'ACK_ALARM' },
})

/**
 * Plays an action history through the reducer the way the Practice page does — un-paused, one
 * speed, 0.1 s ticks — and returns the state at each sample time.
 *
 * Every action is applied at its own model time at every speed: a tick that would carry the model
 * past an action or a sample is replaced, up to that time, by 1× ticks (MV-14's drainage at 28 s is
 * not on the 30× tick). Only the batching differs between speeds, never an action time.
 */
function replay(
  caseId: string,
  branch: string | undefined,
  actions: readonly TimedAction[],
  speed: SimulationSpeed,
  times: readonly number[],
): VentilationSimulationState[] {
  let state = opened(caseId, branch)
  const pending = [...actions].sort((a, b) => a.at - b.at)
  const samples = [...times].sort((a, b) => a - b)
  const out: VentilationSimulationState[] = []
  const settle = () => {
    while (pending.length && pending[0].at <= state.simulationTime + EPSILON) {
      state = ventilationSimulationReducer(state, pending.shift()!.action)
    }
    while (samples.length && samples[0] <= state.simulationTime + EPSILON) {
      samples.shift()
      out.push(state)
    }
  }
  settle()
  state = ventilationSimulationReducer(state, { type: 'SET_SPEED', speed })
  state = ventilationSimulationReducer(state, { type: 'SET_PAUSED', paused: false })
  const end = Math.max(...times)
  while (state.simulationTime < end - EPSILON) {
    const boundary = Math.min(pending[0]?.at ?? Infinity, samples[0] ?? Infinity)
    if (boundary < state.simulationTime + 0.1 * speed - EPSILON) {
      state = ventilationSimulationReducer(state, { type: 'SET_SPEED', speed: 1 })
      while (state.simulationTime < boundary - EPSILON) {
        state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
      }
      state = ventilationSimulationReducer(state, { type: 'SET_SPEED', speed })
    } else {
      state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
    }
    settle()
  }
  return out
}

/** The whole state with the playback speed — the batching under test — set aside. */
function engineState(state: VentilationSimulationState): VentilationSimulationState {
  return { ...state, speed: 1 }
}

const alarmRecord = (state: VentilationSimulationState) => ({
  alarms: state.alarms,
  alarmHistory: state.alarmHistory,
})
const entry = (state: VentilationSimulationState, code: string): AlarmEvent | undefined =>
  state.alarmHistory.find((alarm) => alarm.code === code)
const summary = (history: readonly AlarmEvent[]) =>
  history.map(({ id, code, priority, active }) => ({ id, code, priority, active }))

/** Asserts the same alarm record at 1×, 5× and 30× and returns the 1× states. */
function invariantAcrossSpeeds(
  caseId: string,
  branch: string | undefined,
  actions: readonly TimedAction[],
  times: readonly number[],
): VentilationSimulationState[] {
  const runs = SPEEDS.map((speed) => replay(caseId, branch, actions, speed, times))
  for (const run of runs.slice(1)) {
    expect(run.map(alarmRecord)).toEqual(runs[0].map(alarmRecord))
  }
  return runs[0]
}

const MV01_PEEP16 = [control(12, 'peepCmH2O', 16)]

/* ------------------------------------------------------------------------------------------------
 * The gate's reproduction
 * ---------------------------------------------------------------------------------------------- */

describe('MV-01 · PEEP 5 → 16 at exactly 12 s, observed at exactly 30 s', () => {
  it('records pressure limitation, high pressure and SpO₂ low identically at 1×, 5× and 30×', () => {
    // Head `d4d3cef2` at 30 s: 1× HIGH_PRESSURE, SPO2_LOW, PRESSURE_LIMITATION; 5× and 30×
    // HIGH_PRESSURE, SPO2_LOW. High pressure was stamped 13.0 / 13.0 / 15.0 s.
    const runs = SPEEDS.map((speed) => replay('MV-01', undefined, MV01_PEEP16, speed, [30])[0])
    for (const state of runs) {
      expect(state.simulationTime).toBeCloseTo(30, 9)
      expect(summary(state.alarmHistory)).toEqual([
        { id: 'HIGH_PRESSURE-12', code: 'HIGH_PRESSURE', priority: 'high', active: true },
        { id: 'SPO2_LOW-0', code: 'SPO2_LOW', priority: 'high', active: false },
        {
          id: 'PRESSURE_LIMITATION-12',
          code: 'PRESSURE_LIMITATION',
          priority: 'medium',
          active: false,
        },
      ])
      expect(state.alarms.map((alarm) => alarm.code)).toEqual(['HIGH_PRESSURE'])
      expect(entry(state, 'PRESSURE_LIMITATION')!.startedAt).toBeCloseTo(12.86, 9)
      expect(entry(state, 'HIGH_PRESSURE')!.startedAt).toBeCloseTo(12.92, 9)
      expect(entry(state, 'SPO2_LOW')!.startedAt).toBe(0)
      expect(state.alarmHistory.every((alarm) => alarm.acknowledgedAt === undefined)).toBe(true)
    }
    // Identical to the last bit, stamps included: every speed runs the same 0.02 s steps.
    expect(alarmRecord(runs[1])).toEqual(alarmRecord(runs[0]))
    expect(alarmRecord(runs[2])).toEqual(alarmRecord(runs[0]))
  })

  it('dates each transition at the fixed step it happened on, however the time is handed over', () => {
    let atAction = { ...opened('MV-01'), paused: false }
    while (atAction.simulationTime < 12 - EPSILON) atAction = advanceSimulation(atAction, 0.1)
    atAction = ventilationSimulationReducer(atAction, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: 16,
    })

    // Step by step: the active set the model carries at each 20 ms step.
    let stepped = atAction
    const firstActive = new Map<string, number>()
    const lastActive = new Map<string, number>()
    for (let index = 0; index < 900; index += 1) {
      stepped = advanceSimulation(stepped, 0.02)
      for (const alarm of stepped.alarms) {
        if (!firstActive.has(alarm.code)) firstActive.set(alarm.code, stepped.simulationTime)
        lastActive.set(alarm.code, stepped.simulationTime)
      }
    }
    expect(firstActive.get('PRESSURE_LIMITATION')).toBeCloseTo(12.86, 9)
    expect(lastActive.get('PRESSURE_LIMITATION')).toBeCloseTo(12.9, 9)
    expect(firstActive.get('HIGH_PRESSURE')).toBeCloseTo(12.92, 9)
    expect(entry(stepped, 'PRESSURE_LIMITATION')!.startedAt).toBe(
      firstActive.get('PRESSURE_LIMITATION'),
    )
    expect(entry(stepped, 'HIGH_PRESSURE')!.startedAt).toBe(firstActive.get('HIGH_PRESSURE'))

    // One 18 s call, and any split of it, keep the three-step episode.
    for (const chunk of [18, 3, 0.5, 0.1]) {
      let state = atAction
      for (let index = 0; index < Math.round(18 / chunk); index += 1) {
        state = advanceSimulation(state, chunk)
      }
      expect(alarmRecord(state)).toEqual(alarmRecord(stepped))
    }
  })
})

/* ------------------------------------------------------------------------------------------------
 * Batching regressions on supported cases
 * ---------------------------------------------------------------------------------------------- */

describe('alarm transitions are the same at 1×, 5× and 30×', () => {
  it('an alarm that appears after a ventilator change and stays active keeps one entry', () => {
    const states = invariantAcrossSpeeds('MV-01', undefined, MV01_PEEP16, [30, 60, 150, 180])
    for (const state of states) {
      const highPressure = state.alarmHistory.filter((alarm) => alarm.code === 'HIGH_PRESSURE')
      expect(highPressure).toHaveLength(1)
      expect(highPressure[0]).toMatchObject({ id: 'HIGH_PRESSURE-12', active: true })
      expect(highPressure[0].startedAt).toBeCloseTo(12.92, 9)
      expect(new Set(state.alarmHistory.map((alarm) => alarm.code)).size).toBe(
        state.alarmHistory.length,
      )
    }
  })

  it('a limitation that is replaced by the high alarm inside one coarse call is still recorded', () => {
    // At 30× the whole 0.06 s episode sits inside the 12 → 15 s call.
    const [at15] = invariantAcrossSpeeds('MV-01', undefined, MV01_PEEP16, [15])
    expect(entry(at15, 'PRESSURE_LIMITATION')).toMatchObject({ priority: 'medium', active: false })
    expect(entry(at15, 'HIGH_PRESSURE')).toMatchObject({ priority: 'high', active: true })
    expect(at15.alarms.map((alarm) => alarm.code)).not.toContain('PRESSURE_LIMITATION')
  })

  it('an alarm present at case opening that clears stays in the history, inactive, and stays clear', () => {
    const states = invariantAcrossSpeeds('MV-01', undefined, MV01_PEEP16, [0, 24, 27, 60, 180])
    const [open, before, after, ...later] = states
    expect(open.alarms.map((alarm) => alarm.code)).toEqual(['SPO2_LOW'])
    expect(entry(open, 'SPO2_LOW')).toMatchObject({ id: 'SPO2_LOW-0', startedAt: 0, active: true })
    expect(entry(before, 'SPO2_LOW')).toMatchObject({ startedAt: 0, active: true })
    for (const state of [after, ...later]) {
      expect(entry(state, 'SPO2_LOW')).toMatchObject({
        id: 'SPO2_LOW-0',
        startedAt: 0,
        active: false,
      })
      expect(state.alarms.map((alarm) => alarm.code)).not.toContain('SPO2_LOW')
    }
  })

  it('an acknowledgement is carried with its alarm at every speed', () => {
    const states = invariantAcrossSpeeds(
      'MV-01',
      undefined,
      [...MV01_PEEP16, acknowledgeAll(15)],
      [15, 30, 180],
    )
    const acknowledgedAt = states[0].simulationTime
    expect(acknowledgedAt).toBeCloseTo(15, 9)
    for (const state of states) {
      expect(entry(state, 'HIGH_PRESSURE')!.acknowledgedAt).toBe(acknowledgedAt)
      expect(entry(state, 'SPO2_LOW')!.acknowledgedAt).toBe(acknowledgedAt)
      // Cleared before the acknowledgement, so never acknowledged.
      expect(entry(state, 'PRESSURE_LIMITATION')!.acknowledgedAt).toBeUndefined()
    }
    expect(states[1].alarms[0]).toMatchObject({ code: 'HIGH_PRESSURE', acknowledgedAt })
    expect(entry(states[2], 'SPO2_LOW')).toMatchObject({ active: false, acknowledgedAt })
  })

  it('a blood-pressure alarm that appears with untreated physiologic evolution (MV-14 stable)', () => {
    // Head `d4d3cef2`: stamped 11.8 s at 1×, 12.0 s at 5× and 30×.
    const states = invariantAcrossSpeeds('MV-14', 'stable', [], [0, 30, 180])
    expect(entry(states[0], 'MAP_LOW')).toBeUndefined()
    for (const state of states.slice(1)) {
      expect(entry(state, 'MAP_LOW')).toMatchObject({
        id: 'MAP_LOW-11',
        priority: 'high',
        active: true,
      })
      expect(entry(state, 'MAP_LOW')!.startedAt).toBeCloseTo(11.78, 9)
    }
  })

  it('a low-VT alarm that appears after an intervention (MV-15 deepen sedation)', () => {
    // Head `d4d3cef2`: VT_LOW-58 at 58.7 s, VT_LOW-59 at 59.0 s, VT_LOW-60 at 60.0 s.
    const states = invariantAcrossSpeeds(
      'MV-15',
      'pain-bladder-delirium',
      [perform(12, 'deepen-sedation')],
      [60, 180],
    )
    for (const state of states) {
      expect(entry(state, 'VT_LOW')).toMatchObject({ id: 'VT_LOW-58', priority: 'medium' })
      expect(entry(state, 'VT_LOW')!.startedAt).toBeCloseTo(58.68, 9)
    }
  })

  it('a code that clears and returns reuses its entry (one entry per code), identically at every speed', () => {
    // MV-05 PS 12 only: low VT clears and returns five times in 180 s.
    const states = invariantAcrossSpeeds(
      'MV-05',
      'pressure-support-dominant',
      [control(12, 'pressureSupportCmH2O', 12), acknowledgeAll(3)],
      [3, 30, 60, 180],
    )
    const first = entry(states[0], 'VT_LOW')!
    expect(first).toMatchObject({ startedAt: 0, active: true })
    expect(first.acknowledgedAt).toBeCloseTo(3, 9)
    for (const state of states) {
      expect(state.alarmHistory.filter((alarm) => alarm.code === 'VT_LOW')).toHaveLength(1)
      expect(entry(state, 'VT_LOW')).toMatchObject({ id: first.id, startedAt: first.startedAt })
    }
  })

  it('keeps the history cap and order deterministic', () => {
    const stale: AlarmEvent[] = Array.from({ length: 24 }, (_, index) => ({
      id: `STALE_${index}-0`,
      code: `STALE_${index}`,
      message: 'Earlier alarm',
      priority: 'low',
      startedAt: 0,
      active: false,
    }))
    const start = { ...opened('MV-01'), paused: false }
    const seeded: VentilationSimulationState = {
      ...start,
      alarmHistory: [...start.alarmHistory, ...stale],
    }
    const once = advanceSimulation(seeded, 3)
    let split = seeded
    for (let index = 0; index < 150; index += 1) split = advanceSimulation(split, 0.02)
    expect(alarmRecord(split)).toEqual(alarmRecord(once))
    expect(once.alarmHistory).toHaveLength(20)
    expect(once.alarmHistory.map((alarm) => alarm.code)).toEqual([
      'SPO2_LOW',
      ...stale.slice(0, 19).map((alarm) => alarm.code),
    ])
  })
})

/* ------------------------------------------------------------------------------------------------
 * Complete-state census: every live case, all 22 branches, all 82 scripted arms
 * ---------------------------------------------------------------------------------------------- */

const CENSUS_TIMES = [0, 30, 60, 150, 180] as const

function censusArms(caseId: string): { branch: string; arm: InventoryArm }[] {
  const definition = mechanicalVentilationCaseById.get(caseId)!
  const priority = (PRIORITY_CASE_IDS as readonly string[]).includes(caseId)
  return definition.branchOptions.flatMap((branch) =>
    (priority ? caseArms(caseId, branch) : [NO_ACTION, ASSESSMENT_ONLY]).map((arm) => ({
      branch,
      arm,
    })),
  )
}

describe('complete engine state, alarm history included, at 1×, 5× and 30×', () => {
  it('covers 14 live cases, 22 branches and 82 scripted arms', () => {
    const cases = liveCaseIds()
    const arms = cases.flatMap((caseId) => censusArms(caseId).map((item) => ({ caseId, ...item })))
    expect(cases).toHaveLength(14)
    expect(new Set(arms.map((item) => `${item.caseId}/${item.branch}`)).size).toBe(22)
    expect(arms).toHaveLength(82)
  })

  // Head `d4d3cef2`: 76 of 82 — MV-01 PEEP 16 (a missing event), the four MV-14 stable arms and
  // MV-15 deepen sedation (alarm stamps and the ids derived from them). No other field differed.
  it.each(liveCaseIds())(
    '%s: every arm identical at 0, 30, 60, 150 and 180 s',
    (caseId) => {
      for (const { branch, arm } of censusArms(caseId)) {
        const runs = SPEEDS.map((speed) =>
          replay(caseId, branch, arm.actions, speed, CENSUS_TIMES).map(engineState),
        )
        expect({ branch, arm: arm.id, state: runs[1] }).toEqual({
          branch,
          arm: arm.id,
          state: runs[0],
        })
        expect({ branch, arm: arm.id, state: runs[2] }).toEqual({
          branch,
          arm: arm.id,
          state: runs[0],
        })
      }
    },
    120_000,
  )
})
