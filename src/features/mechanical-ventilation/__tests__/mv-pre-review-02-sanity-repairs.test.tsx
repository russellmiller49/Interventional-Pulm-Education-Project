/**
 * MV-PRE-REVIEW-02 — the five defects an independent sanity review of PR #271 found at `dea2738a`.
 *
 * 1. The breath clock held a period but not the next onset, so repeated rate changes moved it.
 * 2. A communication board restored a patient report under deep sedation or paralysis.
 * 3. PEEP 13's held lung state also answered "is the case resolved".
 * 4. MV-14's (and MV-13's) action feedback claimed responses the model does not produce.
 * 5. MV-13's alarm note said "no alarm" beside a console sounding one.
 *
 * Each block names the behaviour reproduced on `dea2738a` (the reproduction scripts and their output
 * are recorded in the handoff) and pins the contract that replaced it. Several use symbols the
 * reviewed head does not have, so this file is not itself run against it. Nothing here certifies a
 * modeled response as clinically right.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { BedsidePanel } from '../components/BedsidePanel'
import CaseActivity from '../components/MechanicalVentilationCaseActivityV2'
import { PostActionCoachingPanel } from '../components/PostActionCoachingPanel'
import {
  caseResponseModelNote,
  casePresentationModelNote,
  faultOxygenationBoundary,
} from '../content/caseModelNotes'
import { patientReportAvailability } from '../content/patientReport'
import {
  capturePostActionBaseline,
  coachingReadingSnapshot,
  ventilationPostActionCoaching,
  type PostActionCoaching,
} from '../content/postActionCoaching'
import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import { createLabSimulation } from '../engine/learningLab'
import {
  ardsLungStateForPeep,
  ardsPeepInAuthoredSuccessRange,
  isCaseResolved,
  patientCanCommunicate,
  positiveModulo,
} from '../engine/physics'
import { ventilationSimulationReducer } from '../engine/reducer'
import {
  advanceSimulation,
  applyIntervention,
  createInitialSimulationState,
  selectCaseOutcome,
} from '../engine/simulation'
import { triggerDelayEvidence } from '../engine/triggerEvidence'
import type {
  InterventionEffectId,
  VentilationAction,
  VentilationCaseDefinition,
  VentilationSimulationState,
  VentilatorDeviceId,
  WaveformSample,
} from '../engine/types'
import { attemptForBranch } from '../test-support/causalInventory'

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
/** One waveform sample: an onset is seen on the first sample at or after the scheduled instant. */
const SAMPLE = 0.02
const SLACK = SAMPLE + 1e-6

afterEach(() => cleanup())

function definitionOf(caseId: string): VentilationCaseDefinition {
  return mechanicalVentilationCaseById.get(caseId)!
}

function opened(caseId: string, branch?: string): VentilationSimulationState {
  const attempt = branch ? attemptForBranch(caseId, branch, DEVICE) : 1
  return createInitialSimulationState(caseId, 'practice', attempt, DEVICE)
}

function run(
  state: VentilationSimulationState,
  seconds: number,
  definition?: VentilationCaseDefinition,
): VentilationSimulationState {
  return advanceSimulation({ ...state, paused: false }, seconds, definition)
}

function dispatch(state: VentilationSimulationState, ...actions: VentilationAction[]) {
  return actions.reduce(ventilationSimulationReducer, state)
}

const setRate = (value: number): VentilationAction => ({
  type: 'SET_CONTROL',
  control: 'ratePerMin',
  value,
})

/* ------------------------------------------------------------------------------------------------
 * Replaying a schedule and reading its breaths off the trace
 * ---------------------------------------------------------------------------------------------- */

interface Breath {
  readonly onset: number
  readonly ti: number | null
  readonly vtMl: number | null
}

/**
 * Advance 0.1 s at a time, as 1× playback does, applying each action at its offset (seconds after
 * the start), and keep every sample so breaths longer ago than the display buffer are still seen.
 */
function journey(
  start: VentilationSimulationState,
  seconds: number,
  actions: ReadonlyArray<readonly [number, VentilationAction]> = [],
) {
  let state = start
  const trace: WaveformSample[] = [...state.waveforms]
  const steps = Math.round(seconds * 10)
  for (let n = 0; n < steps; n += 1) {
    for (const [at, action] of actions) {
      if (Math.abs(at - n / 10) < 1e-6) state = ventilationSimulationReducer(state, action)
    }
    const before = state.simulationTime
    state = run(state, 0.1)
    trace.push(...state.waveforms.filter((sample) => sample.time > before + 1e-7))
  }
  return { state, trace, startedAt: start.simulationTime }
}

function breaths(trace: readonly WaveformSample[]): Breath[] {
  const found: Breath[] = []
  for (let index = 1; index < trace.length; index += 1) {
    if (trace[index].phase !== 'inspiration' || trace[index - 1].phase !== 'expiration') continue
    let end = index
    while (end < trace.length && trace[end].phase === 'inspiration') end += 1
    const closed = end < trace.length
    found.push({
      onset: trace[index].time,
      ti: closed ? trace[end].time - trace[index].time : null,
      vtMl: closed ? trace[end - 1].volumeMl - trace[index - 1].volumeMl : null,
    })
  }
  return found
}

function intervals(found: readonly Breath[]): number[] {
  return found.slice(1).map((breath, index) => breath.onset - found[index].onset)
}

/** The MV-LAB passive patient, 30 s in, on its authored 16/min volume-control schedule. */
function lab(): VentilationSimulationState {
  return run(createInitialSimulationState('MV-LAB', 'learn'), 30)
}

/** The onset the schedule is holding, read off the trace: the last one before `at`, plus a cycle. */
function lastOnsetBefore(found: readonly Breath[], at: number): number {
  return found.filter((breath) => breath.onset <= at).at(-1)!.onset
}

/* ------------------------------------------------------------------------------------------------
 * 1 · BreathClock — the next onset is a fact the clock holds
 * ---------------------------------------------------------------------------------------------- */

describe('1 · the breath clock keeps the onset it has established', () => {
  it('reproduction: alternating 16 ↔ 20 once a second stays within the longer period', () => {
    // Head `dea2738a`: a 12.02 s gap between onsets (base: 3.76 s).
    const actions = Array.from(
      { length: 60 },
      (_, second) => [second, setRate(second % 2 ? 16 : 20)] as const,
    )
    const { trace, startedAt } = journey(lab(), 60, actions)
    const found = breaths(trace).filter((breath) => breath.onset >= startedAt)
    const gaps = intervals(found)
    expect(found.length).toBeGreaterThanOrEqual(16)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(3.75 + SLACK)
    // Every cycle is a whole cycle of one of the two rates — no truncated or duplicated onset.
    for (const gap of gaps) {
      expect(Math.min(Math.abs(gap - 3.75), Math.abs(gap - 3))).toBeLessThanOrEqual(SLACK)
    }
    expect(Math.min(...found.map((breath) => breath.ti ?? Infinity))).toBeGreaterThan(0.6)
  })

  it('a single late-expiratory change does not defer the breath that was due', () => {
    // Head `dea2738a`: 16 → 20 at 3.6 s into a 3.75 s cycle gave a 5.98 s interval.
    const start = lab()
    const { trace } = journey(start, 20, [[3.6, setRate(20)]])
    const found = breaths(trace)
    const due = lastOnsetBefore(found, start.simulationTime + 3.6) + 3.75
    const next = found.find((breath) => breath.onset > start.simulationTime + 3.6)!
    expect(Math.abs(next.onset - due)).toBeLessThanOrEqual(SLACK)
    const after = intervals(found.filter((breath) => breath.onset >= next.onset))
    for (const gap of after) expect(gap).toBeCloseTo(3, 1)
  })

  it.each([
    { label: 'during inspiration', at: 0.1 },
    { label: 'early in expiration', at: 0.8 },
  ])('a change $label neither cuts the breath short nor moves the next onset', ({ at }) => {
    for (const rate of [8, 20, 40]) {
      const start = lab()
      const { trace } = journey(start, 25, [[at, setRate(rate)]])
      const found = breaths(trace)
      const current = found.filter((breath) => breath.onset <= start.simulationTime + at).at(-1)!
      // The breath in progress keeps its whole inspiration.
      expect(current.ti).toBeGreaterThanOrEqual(0.6)
      const next = found.find((breath) => breath.onset > start.simulationTime + at)!
      expect(Math.abs(next.onset - (current.onset + 3.75))).toBeLessThanOrEqual(SLACK)
      // The requested rate is authoritative from that onset.
      const later = intervals(found.filter((breath) => breath.onset >= next.onset))
      for (const gap of later) expect(Math.abs(gap - 60 / rate)).toBeLessThanOrEqual(SLACK)
    }
  })

  it('several changes before the next breath are read once, at that breath', () => {
    const start = lab()
    const changes = [
      [0.5, setRate(30)],
      [1.2, setRate(8)],
      [2.0, setRate(12)],
      [3.0, setRate(40)],
      [3.6, setRate(20)],
    ] as const
    const { trace } = journey(start, 20, changes)
    const found = breaths(trace)
    const current = lastOnsetBefore(found, start.simulationTime + 0.5)
    const next = found.find((breath) => breath.onset > start.simulationTime + 3.6)!
    expect(Math.abs(next.onset - (current + 3.75))).toBeLessThanOrEqual(SLACK)
    const following = found.find((breath) => breath.onset > next.onset + 0.1)!
    expect(Math.abs(following.onset - next.onset - 3)).toBeLessThanOrEqual(SLACK)
  })

  it('a constant rate is the absolute grid it always was, including one set as the case opens', () => {
    const constant = breaths(journey(lab(), 60).trace)
    for (const breath of constant) {
      const phase = positiveModulo(breath.onset, 3.75)
      expect(Math.min(phase, 3.75 - phase)).toBeLessThanOrEqual(SLACK)
    }
    // Codex's constant-schedule comparison: mode and rate chosen at t = 0, read after 120 s.
    for (const mode of ['volume-ac', 'pressure-ac', 'volume-simv', 'pressure-simv'] as const) {
      for (const rate of [8, 12, 20, 30, 40]) {
        let state = createInitialSimulationState('MV-LAB', 'learn')
        state = dispatch(state, { type: 'SELECT_MODE', mode }, { type: 'CONFIRM_MODE' })
        state = dispatch(state, setRate(rate))
        state = run(state, 120)
        const period = 60 / rate
        for (const breath of breaths(journey(state, 30).trace)) {
          const phase = positiveModulo(breath.onset, period)
          expect(Math.min(phase, period - phase)).toBeLessThanOrEqual(SLACK)
        }
      }
    }
  })

  it('MV-05 PS 12 + ETS 40 still delivers whole breaths, never the 1–2 mL flicker', () => {
    const start = run(opened('MV-05', 'pressure-support-dominant'), 12)
    const { trace, state } = journey(start, 168, [
      [0, { type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 12 }],
      [0, { type: 'SET_CONTROL', control: 'etsPercent', value: 40 }],
    ])
    const found = breaths(trace).filter((breath) => breath.ti !== null)
    expect(found.length).toBeGreaterThan(30)
    for (const breath of found) {
      expect(breath.ti).toBeGreaterThan(1)
      expect(breath.vtMl).toBeGreaterThan(150)
    }
    expect(state.measurements.exhaledVtMl).toBeGreaterThan(150)
  })

  it.each([
    { caseId: 'MV-07', branch: 'weak-effort', control: 'triggerThreshold', value: 1.5 },
    { caseId: 'MV-08', branch: 'cardiogenic-oscillation', control: 'triggerThreshold', value: 2 },
  ] as const)(
    '$caseId: rejoins the effort grid at the first effort it can capture, then stays on it',
    ({ caseId, branch, control, value }) => {
      const start = run(opened(caseId, branch), 12)
      const { trace, state } = journey(start, 60, [[0, { type: 'SET_CONTROL', control, value }]])
      const effortCycle = 60 / state.patient.drive.neuralRatePerMin
      const ti = state.measurements.mechanicalInspiratoryTimeSeconds
      const found = breaths(trace).filter((breath) => breath.onset > start.simulationTime)
      const onGrid = (onset: number) => {
        const phase = positiveModulo(onset, effortCycle)
        return Math.min(phase, effortCycle - phase) <= SLACK
      }
      const firstOnGrid = found.findIndex((breath) => onGrid(breath.onset))
      expect(firstOnGrid).toBeGreaterThanOrEqual(0)
      // At most one transition cycle, longer than an inspiration and no longer than one plus an
      // effort cycle — never the 9.7 s the first rejoin rule left on MV-08.
      const transition = found[firstOnGrid].onset - found[firstOnGrid - 1].onset
      expect(transition).toBeGreaterThan(ti)
      expect(transition).toBeLessThanOrEqual(ti + effortCycle + SLACK)
      for (const breath of found.slice(firstOnGrid)) expect(onGrid(breath.onset)).toBe(true)
      for (const gap of intervals(found.slice(firstOnGrid))) {
        expect(Math.abs(gap - effortCycle)).toBeLessThanOrEqual(SLACK)
      }
    },
  )

  it('MV-07 still delivers the breath the trigger correction should give', () => {
    const state = run(
      dispatch(run(opened('MV-07'), 12), {
        type: 'SET_CONTROL',
        control: 'triggerThreshold',
        value: 1.5,
      }),
      60,
    )
    expect(state.measurements.totalRatePerMin).toBe(26)
    expect(state.measurements.exhaledVtMl).toBeGreaterThan(240)
  })

  /*
   * Rate changes and effort-grid rejoins. Not a claim that `measured` is unreachable everywhere:
   * MV-05's pressure-support and cycling arms reach it at grid coincidences on the reviewed head as
   * well as here (see the handoff, D5); this pins only that the clock's own transitions add none.
   */
  it('creates no measured trigger interval at the transitions the clock now makes', () => {
    const arms: Array<
      [VentilationSimulationState, ReadonlyArray<readonly [number, VentilationAction]>]
    > = [
      [
        run(opened('MV-07'), 12),
        [[0, { type: 'SET_CONTROL', control: 'triggerThreshold', value: 1.5 }]],
      ],
      [
        run(opened('MV-08', 'cardiogenic-oscillation'), 12),
        [[0, { type: 'SET_CONTROL', control: 'triggerThreshold', value: 2 }]],
      ],
      [
        run(opened('MV-02'), 12),
        [
          [0, setRate(40)],
          [7.3, setRate(12)],
        ],
      ],
      [
        lab(),
        Array.from({ length: 60 }, (_, second) => [second, setRate(second % 2 ? 16 : 20)] as const),
      ],
    ]
    for (const [start, actions] of arms) {
      let state = start
      for (let n = 0; n < 600; n += 1) {
        for (const [at, action] of actions) {
          if (Math.abs(at - n / 10) < 1e-6) state = ventilationSimulationReducer(state, action)
        }
        state = run(state, 0.1)
        expect(triggerDelayEvidence(state).status).not.toBe('measured')
      }
    }
  })

  it('arms a hold at the real boundary when the cycle in progress is longer than the new rate', () => {
    let state = run(dispatch(lab(), setRate(8)), 12)
    const found = breaths(journey(state, 8).trace)
    state = journey(state, 8).state
    const last = found.at(-1)!.onset
    // One second into a 7.5 s cycle, ask for 30/min and an expiratory hold at once.
    state = run(state, last + 1 - state.simulationTime)
    state = dispatch(state, setRate(30), { type: 'PERFORM_HOLD', hold: 'expiratory' })
    expect(state.ventilator.holdType).toBe('expiratory')
    expect(state.lastResponse).toMatch(/hold active at end-expiration/)
  })

  it('re-bases the Learn lab clock with its warm-up instead of waiting for a stale onset', () => {
    const state = createLabSimulation('breathing-with-support', 0, DEVICE)
    expect(state.simulationTime).toBe(0)
    const clock = state.ventilator.breathClock
    // The warm-up is a whole number of cycles, so the onset it was holding is now at zero; without
    // the shift it would still be `warmup` seconds away and the round would open without a breath.
    expect(clock.nextOnsetSeconds).not.toBeNull()
    expect(clock.nextOnsetSeconds!).toBeGreaterThanOrEqual(-SLACK)
    expect(clock.nextOnsetSeconds!).toBeLessThanOrEqual((clock.periodSeconds ?? 0) + SLACK)
    const found = breaths(journey(state, (clock.periodSeconds ?? 0) + 1).trace)
    expect(found.filter((breath) => breath.onset > -SLACK).length).toBeGreaterThanOrEqual(1)
    expect(found.find((breath) => breath.onset > -SLACK)!.onset).toBeLessThanOrEqual(
      (clock.periodSeconds ?? 0) + SLACK,
    )
  })
})

/* ------------------------------------------------------------------------------------------------
 * 2 · Reportability — a board cannot give a report to a patient who cannot answer
 * ---------------------------------------------------------------------------------------------- */

describe('2 · deep sedation and paralysis take precedence over a communication aid', () => {
  const mv15 = definitionOf('MV-15')
  const blockade = definitionOf('MV-04').interventions.find(
    (intervention) => intervention.effectId === 'neuromuscular-blockade',
  )!
  // NMB is authored only on other cases; the generic effect combination is exercised on MV-15.
  const fixture: VentilationCaseDefinition = {
    ...mv15,
    interventions: [...mv15.interventions, blockade],
  }

  function after(sequence: readonly string[]) {
    let state = run(opened('MV-15'), 5, fixture)
    for (const id of ['assess-patient', ...sequence]) {
      state = run(applyIntervention(state, fixture, id), 100, fixture)
    }
    return state
  }

  it('decides the flag from the whole effect set, whatever the order', () => {
    const set = (...ids: InterventionEffectId[]) => new Set(ids)
    expect(patientCanCommunicate(true, set())).toBe(true)
    expect(patientCanCommunicate(false, set())).toBe(false)
    expect(patientCanCommunicate(false, set('communication-board'))).toBe(true)
    expect(patientCanCommunicate(true, set('deepen-sedation', 'communication-board'))).toBe(false)
    expect(patientCanCommunicate(false, set('neuromuscular-blockade', 'communication-board'))).toBe(
      false,
    )
  })

  it.each([
    { sequence: ['communication-board'], reportable: true },
    { sequence: ['deepen-sedation'], reportable: false },
    { sequence: ['neuromuscular-blockade'], reportable: false },
    { sequence: ['communication-board', 'deepen-sedation'], reportable: false },
    { sequence: ['deepen-sedation', 'communication-board'], reportable: false },
    { sequence: ['communication-board', 'neuromuscular-blockade'], reportable: false },
    { sequence: ['neuromuscular-blockade', 'communication-board'], reportable: false },
  ])('$sequence → reportable $reportable', ({ sequence, reportable }) => {
    // Head `dea2738a`: every board combination read canCommunicate true and "Patient report · modeled".
    const state = after(sequence)
    expect(state.patient.human.canCommunicate).toBe(reportable)
    expect(patientReportAvailability(state).availability).toBe(
      reportable ? 'reported' : 'index-only',
    )
    if (sequence.includes('deepen-sedation')) expect(state.patient.human.sedationScore).toBe(-5)
    const readings = coachingReadingSnapshot(state)
    expect(readings.dyspnea === null).toBe(!reportable)
    expect(readings.pain === null).toBe(!reportable)

    const { container } = render(
      <BedsidePanel state={state} definition={fixture} compact requireAssessment />,
    )
    const dyspnea = container.querySelector('[data-report-availability]')!
    expect(dyspnea.getAttribute('data-report-availability')).toBe(
      reportable ? 'reported' : 'index-only',
    )
    expect(dyspnea.textContent).toMatch(
      reportable ? /Patient report · modeled/ : /Internal index · not a patient report/,
    )
    expect(container.textContent).not.toMatch(
      reportable ? /Internal index · not a patient report/ : /Patient report · modeled/,
    )
    cleanup()
  })

  it('the real MV-15 reducer path agrees, in both orders', () => {
    for (const order of [
      ['communication-board', 'deepen-sedation'],
      ['deepen-sedation', 'communication-board'],
    ]) {
      let state = run(opened('MV-15'), 5)
      for (const id of order) {
        state = run(dispatch(state, { type: 'PERFORM_INTERVENTION', interventionId: id }), 100)
      }
      expect(state.patient.human.sedationScore).toBe(-5)
      expect(patientReportAvailability(state).availability).toBe('index-only')
    }
  })

  it('the coaching card after the board prints no symptom reading as reported', () => {
    let state = run(applyIntervention(run(opened('MV-15'), 5), mv15, 'deepen-sedation'), 100)
    state = dispatch(state, { type: 'PERFORM_INTERVENTION', interventionId: 'communication-board' })
    const baseline = capturePostActionBaseline(state, mv15, state.interventions.at(-1)!)
    let coaching: PostActionCoaching | null = null
    for (let tick = 0; tick < 600 && !coaching; tick += 1) {
      state = run(state, 0.1)
      coaching = ventilationPostActionCoaching(state, mv15, baseline)
    }
    expect(coaching).not.toBeNull()
    const ids = coaching!.observed.map((reading) => reading.id)
    expect(ids).not.toContain('dyspnea')
    expect(ids).not.toContain('pain')
    const { container } = render(<PostActionCoachingPanel coaching={coaching!} />)
    expect(container.textContent).not.toMatch(/Reported breathing discomfort|Reported pain/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 3 · PEEP 13 — mechanical containment is not the authored success range
 * ---------------------------------------------------------------------------------------------- */

describe('3 · PEEP 13 keeps the held lung state and does not resolve the case', () => {
  const mv01 = definitionOf('MV-01')
  const at = (peep: number) =>
    run(dispatch(opened('MV-01'), { type: 'SET_CONTROL', control: 'peepCmH2O', value: peep }), 180)
  const arms = new Map([6, 7, 8, 12, 13, 14].map((peep) => [peep, at(peep)] as const))
  const arm = (peep: number) => arms.get(peep)!

  it('answers the two questions separately', () => {
    expect([6, 7, 8, 12, 13, 14].map(ardsLungStateForPeep)).toEqual([
      'baseline',
      'baseline',
      'recruited',
      'recruited',
      'recruited',
      'overdistended',
    ])
    expect([6, 7, 8, 12, 12.5, 13, 14].map(ardsPeepInAuthoredSuccessRange)).toEqual([
      false,
      false,
      true,
      true,
      false,
      false,
      false,
    ])
  })

  it('keeps 13 on the recruited mechanics as containment', () => {
    expect(arm(13).patient.mechanics.complianceLPerCmH2O).toBe(
      arm(12).patient.mechanics.complianceLPerCmH2O,
    )
    expect(arm(13).patient.gasExchange.shuntFraction).toBe(
      arm(12).patient.gasExchange.shuntFraction,
    )
    expect(arm(14).patient.mechanics.complianceLPerCmH2O).toBeLessThan(
      arm(13).patient.mechanics.complianceLPerCmH2O,
    )
    expect(arm(7).patient.mechanics.complianceLPerCmH2O).toBeLessThan(
      arm(8).patient.mechanics.complianceLPerCmH2O,
    )
  })

  it('resolves only inside the authored range, and scores and relieves accordingly', () => {
    // Head `dea2738a`: PEEP 13 resolved, scored 30 corrective points and took the comfort relief.
    const resolved = (peep: number) => isCaseResolved(arm(peep), mv01)
    expect([6, 7, 8, 12, 13, 14].map(resolved)).toEqual([false, false, true, true, false, false])
    const corrective = (peep: number) => selectCaseOutcome(arm(peep)).domains.correctiveActions
    expect(corrective(12)).toBe(30)
    expect(corrective(13)).toBe(corrective(7))
    expect(corrective(13)).toBeLessThan(corrective(12))
    // The resolution-linked relief: 12 has it, 13 does not — 13's index is 7's.
    const dyspnea = (peep: number) => arm(peep).patient.human.dyspneaScore
    expect(dyspnea(13)).toBeCloseTo(dyspnea(7), 5)
    expect(dyspnea(13)).toBeGreaterThan(dyspnea(12) + 1)
  })

  it('keeps overdistension at 14', () => {
    expect(arm(14).patient.hemodynamics.mapMmHg).toBeLessThan(arm(13).patient.hemodynamics.mapMmHg)
    expect(arm(14).measurements.relaxedPlateauPressureCmH2O).toBeGreaterThan(
      arm(13).measurements.relaxedPlateauPressureCmH2O,
    )
  })
})

/* ------------------------------------------------------------------------------------------------
 * 4 · Unsupported response claims, where the learner meets them
 * ---------------------------------------------------------------------------------------------- */

function observe(
  start: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  interventionId: string,
  during: VentilationAction[] = [],
) {
  let state = dispatch(start, { type: 'PERFORM_INTERVENTION', interventionId })
  const feedback = state.lastResponse
  const baseline = capturePostActionBaseline(state, definition, state.interventions.at(-1)!)
  state = dispatch(state, ...during)
  let coaching: PostActionCoaching | null = null
  for (let tick = 0; tick < 1200 && !coaching; tick += 1) {
    state = run(state, 0.1)
    coaching = ventilationPostActionCoaching(state, definition, baseline)
  }
  return { state, feedback, coaching: coaching! }
}

const coachingText = (coaching: PostActionCoaching) =>
  [
    coaching.observedSummary,
    coaching.interpretation,
    coaching.notDemonstrated,
    coaching.reassess,
    coaching.modelBoundary ?? '',
  ].join(' ')

describe('4 · MV-14 and MV-13 say what the simulation shows where the response is read', () => {
  const mv14 = definitionOf('MV-14')
  const mv13 = definitionOf('MV-13')

  it.each(['unstable', 'stable'])(
    'MV-14 %s: decompression feedback keeps the expectation and states the model',
    (branch) => {
      const start = run(opened('MV-14', branch), 12)
      const { state, feedback, coaching } = observe(start, mv14, 'decompress-pneumothorax')
      // The model is unchanged: SpO₂ stays where it opened, MAP recovers.
      expect(state.patient.gasExchange.spo2Percent).toBe(start.patient.gasExchange.spo2Percent)
      expect(state.patient.hemodynamics.mapMmHg).toBeGreaterThan(start.patient.hemodynamics.mapMmHg)
      // Head `dea2738a`: "Compliance, oxygenation, and blood pressure improve abruptly but temporarily."
      expect(feedback).toMatch(/^Clinically expected: Compliance, oxygenation, and blood pressure/)
      expect(feedback).toMatch(/In this simulation compliance and blood pressure improve/)
      expect(feedback).toMatch(/does not fade — the model has no decay for it/)
      expect(feedback).toMatch(/SpO₂ is not linked to the pneumothorax here, so it does not change/)
      expect(state.interventions.at(-1)!.response).toBe(feedback)

      const text = coachingText(coaching)
      expect(coaching.observed.find((reading) => reading.id === 'spo2')?.direction).toBe('held')
      expect(coaching.modelBoundary).toMatch(
        /moved toward better over this interval; SpO₂ did not change/,
      )
      expect(coaching.modelBoundary).toMatch(/not linked to the pneumothorax/)
      // No claim that a modeled response will fade, and none that oxygenation improved.
      expect(text).not.toMatch(/a response that fades is the expected course/)
      expect(text).not.toMatch(/need securing rather than to hold on its own/)
      expect(text).not.toMatch(/oxygenation (improved|recovered|rose)/i)
      expect(coaching.notDemonstrated).toMatch(/does not model that loss/)
    },
  )

  it('MV-14: a saturation moved by FiO₂ during the interval is not credited to the decompression', () => {
    const start = run(opened('MV-14', 'unstable'), 12)
    const { coaching } = observe(start, mv14, 'decompress-pneumothorax', [
      { type: 'SET_CONTROL', control: 'oxygenPercent', value: 100 },
    ])
    expect(coaching.observed.find((reading) => reading.id === 'spo2')?.direction).toBe('rose')
    expect(coaching.modelBoundary).toMatch(/SpO₂ rose, but not because of this action/)
  })

  it('MV-14: drainage feedback does not imply the improvement would otherwise fade', () => {
    let state = run(opened('MV-14', 'unstable'), 12)
    state = observe(state, mv14, 'decompress-pneumothorax').state
    const { feedback, coaching } = observe(state, mv14, 'pleural-drainage')
    expect(feedback).toMatch(/^Clinically expected: The compliance and hemodynamic improvement/)
    expect(feedback).toMatch(/does not fade whether or not drainage is placed/)
    expect(coaching.modelBoundary).toMatch(/SpO₂ did not change/)
  })

  it('MV-14: the explanation beside the authored expected response states both limits', () => {
    const note = caseResponseModelNote('MV-14')!
    expect(note).toMatch(/saturation is not linked to the pneumothorax/)
    expect(note).toMatch(/does not fade/)
  })

  it('MV-14: the Practice page prints the qualified feedback when the action is taken', () => {
    jest.useFakeTimers()
    render(<CaseActivity caseId="MV-14" deviceId={DEVICE} mode="challenge" section="practice" />)
    act(() => jest.advanceTimersByTime(10))
    fireEvent.click(screen.getByRole('button', { name: 'Perform emergency decompression' }))
    const status = screen.getByText(/^Clinically expected: Compliance, oxygenation/)
    expect(status.textContent).toMatch(/SpO₂ is not linked to the pneumothorax here/)
    jest.useRealTimers()
  })

  it.each([
    { branch: 'secretions', treatments: ['suction-airway'] },
    { branch: 'hme-or-ett', treatments: ['inspect-circuit', 'remove-hme'] },
  ])(
    'MV-13 $branch: the correct treatment is read against an unlinked saturation',
    ({ branch, treatments }) => {
      let state = run(opened('MV-13', branch), 12)
      let result = observe(state, mv13, treatments[0])
      for (const id of treatments.slice(1)) {
        state = result.state
        result = observe(state, mv13, id)
      }
      const { coaching, state: after } = result
      expect(after.patient.gasExchange.spo2Percent).toBe(88)
      expect(coaching.observed.find((reading) => reading.id === 'peak-pressure')?.direction).toBe(
        'fell',
      )
      expect(coaching.modelBoundary).toMatch(
        /^Peak airway pressure[^;]* moved toward better over this interval; SpO₂ did not change/,
      )
      expect(coaching.modelBoundary).toMatch(/not linked to the airway obstruction/)
      expect(coachingText(coaching)).not.toMatch(/oxygenation (improved|recovered|rose)/i)
    },
  )

  it('MV-13: a treatment that misses the cause gets the same model statement, so it leaks no branch', () => {
    const state = run(opened('MV-13', 'secretions'), 12)
    const inspected = observe(state, mv13, 'inspect-circuit').state
    const missed = observe(inspected, mv13, 'remove-hme').coaching
    expect(missed.modelBoundary).toMatch(/SpO₂ did not change. In this simulation oxygenation/)
    expect(missed.modelBoundary).not.toMatch(/secretion|tube|bronchospasm/i)
  })

  it('MV-13: the explanation states the oxygenation limit beside the authored response', () => {
    expect(caseResponseModelNote('MV-13')).toMatch(/not linked to the airway obstruction/)
    expect(caseResponseModelNote('MV-13')).toMatch(/held for faculty review/)
  })

  it('names no boundary where the model does represent the response', () => {
    expect(faultOxygenationBoundary('MV-01', 'decompress-pneumothorax', [])).toBeNull()
    expect(faultOxygenationBoundary('MV-14', 'assess-patient', [])).toBeNull()
    const other = observe(run(opened('MV-06'), 12), definitionOf('MV-06'), 'disconnect-bag')
    expect(other.coaching.modelBoundary).toBeNull()
    expect(other.feedback).not.toMatch(/^Clinically expected/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 5 · MV-13's alarm note is read from the console it sits beside
 * ---------------------------------------------------------------------------------------------- */

describe('5 · the MV-13 alarm note cannot contradict the live console', () => {
  const mv13 = definitionOf('MV-13')
  const limit = (value: number): VentilationAction => ({
    type: 'SET_CONTROL',
    control: 'highPressureLimitCmH2O',
    value,
  })
  const note = (state: VentilationSimulationState) => casePresentationModelNote(state, mv13)!
  const alarmCodes = (state: VentilationSimulationState) => state.alarms.map((alarm) => alarm.code)

  it('at case entry: the opening mismatch, and nothing about a change', () => {
    const state = opened('MV-13')
    expect(state.ventilator.settings.highPressureLimitCmH2O).toBe(60)
    expect(alarmCodes(state)).not.toContain('HIGH_PRESSURE')
    expect(note(state)).toMatch(/opens after that event, with the high-pressure limit at 60 cmH₂O/)
    expect(note(state)).toMatch(/held for RT and device review/)
    expect(note(state)).not.toMatch(/Now the limit/)
  })

  it('limit lowered below the peak: says the alarm is coming, then that it is active', () => {
    // Head `dea2738a`: "…limit at 40 cmH₂O — above the peak … no active high-pressure alarm",
    // beside a console sounding "High pressure".
    let state = dispatch(run(opened('MV-13'), 10), limit(40))
    expect(alarmCodes(state)).not.toContain('HIGH_PRESSURE') // paused: not yet re-evaluated
    expect(note(state)).toMatch(/limit is now 40 cmH₂O, at or below the peak/)
    expect(note(state)).toMatch(/raises its high-pressure alarm when the simulation next runs/)
    state = run(state, 20)
    expect(alarmCodes(state)).toContain('HIGH_PRESSURE')
    expect(note(state)).toMatch(
      /Now the limit is 40 cmH₂O and the peak, 4\d\.\d cmH₂O, has reached it/,
    )
    expect(note(state)).toMatch(/high-pressure alarm is active/)
    expect(note(state)).not.toMatch(/no high-pressure alarm is active|above the peak of/)
    // Still the opening context, labelled as the opening.
    expect(note(state)).toMatch(/opens after that event, with the high-pressure limit at 60 cmH₂O/)
  })

  it('limit raised again while the alarm is still showing: says it is stale, not absent', () => {
    let state = run(dispatch(run(opened('MV-13'), 10), limit(40)), 20)
    state = dispatch(state, limit(60))
    expect(alarmCodes(state)).toContain('HIGH_PRESSURE')
    expect(note(state)).toMatch(/still showing from the last breath the simulation evaluated/)
    state = run(state, 20)
    expect(alarmCodes(state)).not.toContain('HIGH_PRESSURE')
    expect(note(state)).not.toMatch(/still showing|is active\./)
  })

  it('limit just above the peak: names the pressure-limitation alert the console shows', () => {
    const state = run(dispatch(run(opened('MV-13'), 10), limit(45)), 20)
    expect(alarmCodes(state)).toContain('PRESSURE_LIMITATION')
    expect(alarmCodes(state)).not.toContain('HIGH_PRESSURE')
    expect(note(state)).toMatch(/still above the peak of 4\d\.\d cmH₂O, so no high-pressure alarm/)
    expect(note(state)).toMatch(/pressure-limitation alert/)
  })

  it('leaves the limit, the alarm predicate and the delivered breath alone', () => {
    const open = run(opened('MV-13'), 20)
    const lowered = run(dispatch(run(opened('MV-13'), 10), limit(40)), 10)
    expect(lowered.measurements.exhaledVtMl).toBe(open.measurements.exhaledVtMl)
    expect(lowered.measurements.peakPressureCmH2O).toBeCloseTo(
      open.measurements.peakPressureCmH2O,
      0,
    )
  })
})
