/**
 * MV-PRE-REVIEW-02 — the three issues the independent re-review of PR #271 found at `1b52c008`.
 *
 * R1. The model trajectory depended on how the caller batched time (1× / 5× / 30×) on MV-05's
 *     combined PS 12 + ETS 40 correction, with and without an expiratory hold.
 * R2. Returning MV-01's PEEP to 5 restored the compliance but not the shunt of the band left.
 * R3. The trigger helper labelled the phenotype's assigned `triggerDelayMs` a measured interval.
 *
 * Reproductions and before/after numbers are in the handoff (§16). Nothing here certifies a
 * modeled response as clinically right; D1–D5 are unchanged.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render } from '@testing-library/react'

import { MechanicalVentilationTeachingPanel } from '../components/MechanicalVentilationTeachingPanel'
import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import {
  deriveEffectivePatient,
  EFFORT_DETECTION_FLOOR_CMH2O,
  isCaseResolved,
} from '../engine/physics'
import { ventilationSimulationReducer } from '../engine/reducer'
import {
  advanceSimulation,
  createInitialSimulationState,
  selectCaseOutcome,
} from '../engine/simulation'
import { triggerDelayEvidence, type TriggerDelayStatus } from '../engine/triggerEvidence'
import type {
  SimulationSpeed,
  VentilationAction,
  VentilationSimulationState,
  VentilatorDeviceId,
} from '../engine/types'
import {
  attemptForBranch,
  caseArms,
  liveCaseIds,
  runInventoryArm,
  type InventoryArm,
  type TimedAction,
} from '../test-support/causalInventory'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

const DEVICE: VentilatorDeviceId = 'hamilton-c6'
const MV05_BRANCHES = ['pressure-support-dominant', 'cycling-dominant', 'trigger-dominant'] as const

afterEach(() => cleanup())

function opened(caseId: string, branch?: string): VentilationSimulationState {
  const attempt = branch ? attemptForBranch(caseId, branch, DEVICE) : 1
  return createInitialSimulationState(caseId, 'practice', attempt, DEVICE)
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
const expiratoryHold = (at: number): TimedAction => ({
  at,
  label: 'expiratory-hold',
  action: { type: 'PERFORM_INTERVENTION', interventionId: 'expiratory-hold' },
})

/** The review's arms: MV-05's combined correction, with and without a hold, and its controls. */
const MV05_ARMS: readonly InventoryArm[] = [
  {
    id: 'ps-ets',
    label: 'PS 12 + ETS 40',
    actions: [control(12, 'pressureSupportCmH2O', 12), control(12, 'etsPercent', 40)],
  },
  {
    id: 'ps-ets-hold',
    label: 'PS 12 + ETS 40 + expiratory hold',
    actions: [
      control(12, 'pressureSupportCmH2O', 12),
      control(12, 'etsPercent', 40),
      expiratoryHold(12),
    ],
  },
  { id: 'ps-only', label: 'PS 12', actions: [control(12, 'pressureSupportCmH2O', 12)] },
  { id: 'ets-only', label: 'ETS 40', actions: [control(12, 'etsPercent', 40)] },
  { id: 'unchanged', label: 'no change', actions: [] },
]

/**
 * Everything the model carries forward, and every published output, at one model time.
 *
 * The alarm record is compared whole — ids, start and acknowledgement stamps, active flags, order
 * and history. It used to be reduced to the active codes because `reconcileAlarms` ran once per
 * outer call, which dated a start by the call's end and could drop an alarm that cleared inside one
 * call; it now runs at every fixed step (`mv-pre-review-02-alarm-history.test.ts`).
 */
function fullState(state: VentilationSimulationState) {
  return {
    t: Math.round(state.simulationTime * 1e6) / 1e6,
    patient: state.patient,
    measurements: state.measurements,
    waveforms: state.waveforms,
    clock: state.ventilator.breathClock,
    hold: [state.ventilator.pendingHold, state.ventilator.holdType, state.ventilator.holdUntil],
    holdRecords: state.holdRecords,
    risk: state.risk,
    trends: state.trends,
    alarms: state.alarms,
    alarmHistory: state.alarmHistory,
    criticalErrors: state.criticalErrors,
  }
}

/** Plays an arm through the reducer as the Practice page does, at one speed, snapshotting fully. */
function playFull(branch: string, arm: InventoryArm, speed: SimulationSpeed, times: number[]) {
  let state = opened('MV-05', branch)
  const pending = [...arm.actions]
  const out: ReturnType<typeof fullState>[] = []
  const settle = () => {
    while (pending.length && pending[0].at <= state.simulationTime + 1e-6) {
      state = ventilationSimulationReducer(state, pending.shift()!.action)
    }
  }
  settle()
  state = ventilationSimulationReducer(state, { type: 'SET_SPEED', speed })
  state = ventilationSimulationReducer(state, { type: 'SET_PAUSED', paused: false })
  const remaining = [...times]
  while (remaining.length) {
    state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
    settle()
    if (state.simulationTime >= remaining[0] - 1e-6) {
      out.push(fullState(state))
      remaining.shift()
    }
  }
  return out
}

/* ------------------------------------------------------------------------------------------------
 * R1 — the trajectory does not depend on how time is handed to the engine
 * ---------------------------------------------------------------------------------------------- */

describe('R1 · batching invariance', () => {
  // Head `1b52c008`, PS 12 + ETS 40 + hold, VTE at 30 / 60 / 180 s: 438/397/318, 344/252/300,
  // 386/406/409 at 1×/5×/30×. The same arm on `dea2738a` and on the base was invariant.
  it.each(MV05_BRANCHES.flatMap((branch) => MV05_ARMS.map((arm) => ({ branch, arm }))))(
    'MV-05 $branch · $arm.label: complete state identical at 1×, 5× and 30× at 30, 60 and 180 s',
    ({ branch, arm }) => {
      const runs = ([1, 5, 30] as const).map((speed) => playFull(branch, arm, speed, [30, 60, 180]))
      expect(runs[1]).toEqual(runs[0])
      expect(runs[2]).toEqual(runs[0])
    },
  )

  it('direct engine calls: one long advance equals any split of the same model time', () => {
    const start = ventilationSimulationReducer(
      ventilationSimulationReducer(
        advanceSimulation({ ...opened('MV-05', 'pressure-support-dominant'), paused: false }, 12),
        { type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 12 },
      ),
      { type: 'SET_CONTROL', control: 'etsPercent', value: 40 },
    )
    const held = ventilationSimulationReducer(start, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'expiratory-hold',
    })
    for (const origin of [start, held]) {
      const outcomes = [0.02, 0.1, 0.5, 3].map((chunk) => {
        let state = origin
        for (let index = 0; index < Math.round(48 / chunk); index += 1) {
          state = advanceSimulation(state, chunk)
        }
        return fullState(state)
      })
      for (const other of outcomes.slice(1)) {
        expect(other.patient).toEqual(outcomes[0].patient)
        expect(other.measurements).toEqual(outcomes[0].measurements)
        expect(other.waveforms).toEqual(outcomes[0].waveforms)
        expect(other.clock).toEqual(outcomes[0].clock)
        expect(other.holdRecords).toEqual(outcomes[0].holdRecords)
        expect(other.alarms).toEqual(outcomes[0].alarms)
        expect(other.alarmHistory).toEqual(outcomes[0].alarmHistory)
      }
    }
  })

  it('the published measurement does not flicker step to step on the combined correction', () => {
    // Head `1b52c008` with only the call-entry refresh removed: rate 16 ↔ 19 and PEEPi 6 ↔ 4.2 on
    // alternate 20 ms steps (89 changes in 48 s; 333 with the hold) — the expiratory-time fallback
    // read the rate this function had itself reported one step earlier.
    for (const withHold of [false, true]) {
      let state = ventilationSimulationReducer(
        ventilationSimulationReducer(
          advanceSimulation({ ...opened('MV-05', 'pressure-support-dominant'), paused: false }, 12),
          { type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 12 },
        ),
        { type: 'SET_CONTROL', control: 'etsPercent', value: 40 },
      )
      if (withHold) {
        state = ventilationSimulationReducer(state, {
          type: 'PERFORM_INTERVENTION',
          interventionId: 'expiratory-hold',
        })
      }
      const values: string[] = []
      for (let index = 0; index < 2400; index += 1) {
        state = advanceSimulation(state, 0.02)
        values.push(
          `${state.measurements.totalRatePerMin}/${state.measurements.intrinsicPeepCmH2O}`,
        )
      }
      const blips = values.filter(
        (value, index) =>
          index > 0 &&
          index < values.length - 1 &&
          values[index - 1] === values[index + 1] &&
          values[index - 1] !== value,
      )
      expect(blips).toEqual([])
    }
  })

  it('the inventory harness agrees: every MV-05 arm identical at 1×, 5× and 30×', () => {
    for (const branch of MV05_BRANCHES) {
      for (const arm of [...caseArms('MV-05', branch), ...MV05_ARMS]) {
        const runs = ([1, 5, 30] as const).map(
          (speed) =>
            runInventoryArm({ caseId: 'MV-05', branch, speed, sampleTimes: [30, 60, 180], arm })
              .snapshots,
        )
        expect(runs[1]).toEqual(runs[0])
        expect(runs[2]).toEqual(runs[0])
      }
    }
  })
})

/* ------------------------------------------------------------------------------------------------
 * R2 — leaving a PEEP band restores the state the band wrote
 * ---------------------------------------------------------------------------------------------- */

describe('R2 · PEEP reversal restores the baseline lung state', () => {
  const mv01 = mechanicalVentilationCaseById.get('MV-01')!
  const setPeep = (state: VentilationSimulationState, value: number) =>
    ventilationSimulationReducer(state, { type: 'SET_CONTROL', control: 'peepCmH2O', value })

  it.each([6, 7, 8, 12, 13, 14, 16])(
    'PEEP 5 → %i → 5 returns compliance, shunt and oxygenation to the opening state',
    (peep) => {
      // Head `1b52c008`, after 360 s back at 5: 8/12/13 kept shunt 0.20 (PaO₂ 72, SpO₂ 90.6);
      // 14/16 kept 0.24 (PaO₂ 64.8, SpO₂ 88.7). Compliance had already returned.
      const open = opened('MV-01')
      const visited = advanceSimulation({ ...setPeep(open, peep), paused: false }, 180)
      const back = advanceSimulation(setPeep(visited, 5), 360)
      expect(back.patient.mechanics.complianceLPerCmH2O).toBe(
        open.patient.mechanics.complianceLPerCmH2O,
      )
      expect(back.patient.gasExchange.shuntFraction).toBe(open.patient.gasExchange.shuntFraction)
      expect(back.patient.gasExchange.paO2MmHg).toBeCloseTo(open.patient.gasExchange.paO2MmHg, 0)
      expect(back.patient.gasExchange.spo2Percent).toBeCloseTo(
        open.patient.gasExchange.spo2Percent,
        0,
      )
      expect(isCaseResolved(back, mv01)).toBe(false)
      expect(selectCaseOutcome(back).domains.correctiveActions).toBe(0)
      expect(back.patient.human.dyspneaScore).toBeCloseTo(open.patient.human.dyspneaScore, 1)
      // Oxygenation falls back along the way rather than stepping, and never below the opening.
      const halfway = advanceSimulation(setPeep(visited, 5), 30)
      if (visited.patient.gasExchange.paO2MmHg > open.patient.gasExchange.paO2MmHg + 1) {
        expect(halfway.patient.gasExchange.paO2MmHg).toBeLessThan(
          visited.patient.gasExchange.paO2MmHg,
        )
        expect(halfway.patient.gasExchange.paO2MmHg).toBeGreaterThan(
          open.patient.gasExchange.paO2MmHg,
        )
      }
    },
  )

  it('keeps PEEP 13 as containment only while it is set', () => {
    const at13 = advanceSimulation({ ...setPeep(opened('MV-01'), 13), paused: false }, 180)
    expect(at13.patient.mechanics.complianceLPerCmH2O).toBe(0.032)
    expect(at13.patient.gasExchange.shuntFraction).toBe(0.2)
    expect(isCaseResolved(at13, mv01)).toBe(false)
    expect(selectCaseOutcome(at13).domains.correctiveActions).toBe(0)
    expect(at13.patient.human.dyspneaScore).toBeCloseTo(3, 1)
  })

  it('derives the shunt from the case, not from whatever the running patient carries', () => {
    const open = opened('MV-01')
    const carried: VentilationSimulationState = {
      ...open,
      patient: {
        ...open.patient,
        gasExchange: { ...open.patient.gasExchange, shuntFraction: 0.2 },
      },
    }
    expect(deriveEffectivePatient(carried, mv01).gasExchange.shuntFraction).toBe(
      mv01.initialPatient.gasExchange.shuntFraction,
    )
    // The slow gases themselves are still the running values.
    expect(deriveEffectivePatient(carried, mv01).gasExchange.paO2MmHg).toBe(
      open.patient.gasExchange.paO2MmHg,
    )
  })
})

/* ------------------------------------------------------------------------------------------------
 * R3 — no live trigger delay is called measured
 * ---------------------------------------------------------------------------------------------- */

describe('R3 · trigger delay is a model estimate, not a measurement', () => {
  const LIVE_STATUSES: readonly TriggerDelayStatus[] = [
    'model-estimate',
    'not-applicable',
    'unavailable',
  ]

  it('classifies every sampled breath on every live case and every MV-05 arm as one of three', () => {
    const counts: Record<string, number> = {}
    const tally = (state: VentilationSimulationState) => {
      const status = triggerDelayEvidence(state).status
      counts[status] = (counts[status] ?? 0) + 1
      expect(LIVE_STATUSES).toContain(status)
    }
    for (const caseId of liveCaseIds()) {
      let state = { ...opened(caseId), paused: false }
      for (let index = 0; index < 60; index += 1) {
        state = advanceSimulation(state, 1)
        tally(state)
      }
    }
    for (const arm of caseArms('MV-05', 'pressure-support-dominant')) {
      let state = opened('MV-05', 'pressure-support-dominant')
      const pending = [...arm.actions]
      state = { ...state, paused: false }
      while (state.simulationTime < 180 - 1e-6) {
        while (pending.length && pending[0].at <= state.simulationTime + 1e-6) {
          state = ventilationSimulationReducer(state, pending.shift()!.action)
        }
        state = advanceSimulation(state, 0.1)
        tally(state)
      }
    }
    expect(counts.measured).toBeUndefined()
    expect(counts['model-estimate']).toBeGreaterThan(0)
    expect(counts['not-applicable']).toBeGreaterThan(0)
  })

  it('MV-05 corrected arm: an effort building into the onset shows the phenotype value as an estimate', () => {
    // Head `1b52c008` printed "267 ms" as measured on this shape (its first, at 55.92 s); the
    // effort had crossed the engine's detection floor 140 ms before that onset. Neither number is
    // a trigger interval (D5), and the number printed is the phenotype's assigned one.
    const arm = caseArms('MV-05', 'pressure-support-dominant').find((item) => item.id === 'ps-ets')!
    let state = { ...opened('MV-05', 'pressure-support-dominant'), paused: false }
    const pending = [...arm.actions]
    let building: ReturnType<typeof triggerDelayEvidence> | null = null
    while (state.simulationTime < 180 - 1e-6 && !building) {
      while (pending.length && pending[0].at <= state.simulationTime + 1e-6) {
        state = ventilationSimulationReducer(state, pending.shift()!.action)
      }
      state = advanceSimulation(state, 0.1)
      const evidence = triggerDelayEvidence(state)
      if (/already under way/.test(evidence.detail)) building = evidence
    }
    expect(building).not.toBeNull()
    expect(building!.precedingEffortCmH2O).toBeGreaterThanOrEqual(EFFORT_DETECTION_FLOOR_CMH2O)
    expect(building!.status).toBe('model-estimate')
    expect(building!.delayMs).toBe(state.measurements.triggerDelayMs)
    expect(building!.display).toMatch(/^\d+ ms · model estimate$/)
    expect(building!.detail).toMatch(/does not time the interval/)
    expect(building!.detail).toMatch(/not a delay measured on this trace/)
  })

  it('keeps absent, unknown and zero apart', () => {
    const empty = triggerDelayEvidence({ ...opened('MV-01'), waveforms: [] })
    expect(empty.status).toBe('unavailable')
    expect(empty.delayMs).toBeNull()
    for (const caseId of liveCaseIds()) {
      const evidence = triggerDelayEvidence(
        advanceSimulation({ ...opened(caseId), paused: false }, 16),
      )
      if (evidence.status === 'not-applicable') {
        expect(evidence.delayMs).toBeNull()
        expect(evidence.display).toBe('—')
      }
      if (evidence.status === 'model-estimate') {
        expect(evidence.delayMs).toBeGreaterThan(0)
        expect(evidence.display).toMatch(/model estimate/)
      }
    }
  })

  it('the Timing and dyssynchrony views never print a measured trigger delay', () => {
    const corrected = runInventoryArm({
      caseId: 'MV-05',
      branch: 'pressure-support-dominant',
      sampleTimes: [60],
      arm: MV05_ARMS[0],
    })
    expect(LIVE_STATUSES).toContain(corrected.snapshots[0].breath.triggerEvidence)
    let state = { ...opened('MV-05', 'pressure-support-dominant'), paused: false }
    state = advanceSimulation(state, 12)
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: 'pressureSupportCmH2O',
      value: 12,
    })
    state = advanceSimulation(
      ventilationSimulationReducer(state, {
        type: 'SET_CONTROL',
        control: 'etsPercent',
        value: 40,
      }),
      48,
    )
    for (const lessonId of ['triggering-and-cycling', 'dyssynchrony-mechanisms']) {
      const { container } = render(
        <MechanicalVentilationTeachingPanel lessonId={lessonId} state={state} />,
      )
      expect(container.textContent ?? '').not.toMatch(/Measured trigger delay/)
      cleanup()
    }
  })
})
