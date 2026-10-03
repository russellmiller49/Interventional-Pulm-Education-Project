/**
 * MV-PRE-REVIEW-03 — the baseline an experiment retains (PR #290, repair after head `f2635a0f`).
 *
 * The re-review of the R1–R6 repair found one remaining evidence defect: Section 8's first
 * application ("Help an effort start a breath … Compare efforts with delivered breaths") retained a
 * baseline with no complete breath, so the comparison its task depends on had no baseline trace.
 * Tracing it found a second: a prediction committed on an explored patient retained that patient —
 * the requested change already made — as the baseline.
 *
 * The numbered tests are the review's required list. Each "reproduces" test states the cause as it
 * was measured on `f2635a0f`; the facts about the 12-second opening window are still true, because
 * the window and the patient were not changed — only what the baseline record keeps.
 */
import { type AnchorHTMLAttributes, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { CapturedResult } from '../components/stage/RecordedBreathComparison'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { cancelTaskHeadingReveal } from '../components/stage/revealTaskHeading'
import { describeModeledEffort, modeledEffortFacts } from '../content/effortDescription'
import { ventilationExperimentStatus } from '../content/experimentStatus'
import {
  ventilationExperimentByUnit,
  ventilationLearningExperiments,
} from '../content/learningExperiments'
import { ventilationLessonAttempt } from '../content/lessonRuntime'
import { ventilationStageLesson } from '../content/stageLessons'
import {
  createLabSession,
  createLabSimulation,
  labGoalAction,
  labGoalMet,
  labReadyToCompare,
  labRecordHoldsCompleteBreath,
  learningLabReducer,
  openLabRound,
  type LabAction,
  type LabOpening,
  type LabSession,
  type LabSnapshot,
} from '../engine/learningLab'
import { measurementInputs } from '../engine/learningMeasurements'
import { MAX_WAVEFORM_SAMPLES, WAVEFORM_STEP_SECONDS } from '../engine/physics'
import { ventilationSimulationReducer } from '../engine/reducer'
import {
  advanceSimulation,
  createInitialSimulationState,
  reopenAlarmEpoch,
  shiftBreathClock,
} from '../engine/simulation'
import { completedBreath } from '../engine/teachingBreath'
import {
  ventilatorDeviceIds,
  type VentilationAction,
  type VentilationSimulationState,
  type VentilatorDeviceId,
  type WaveformSample,
} from '../engine/types'

const mockPush = jest.fn()
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}${href.query ? `?activity=${href.query.activity}` : ''}`
      }
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }),
  usePathname: () => '/mechanical-ventilation/learn',
}))

/* A census test opens a round on four consoles; allow for a loaded machine. */
jest.setTimeout(30_000)

const DEVICE = 'hamilton-c6' as const
const SECTION_1 = 'breathing-with-support'
const SECTION_8 = 'triggering-and-cycling'
const SECTION_11 = 'waveform-reading-sequence'
let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  mockPush.mockReset()
  cancelTaskHeadingReveal()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: jest.fn(),
  })
})
afterEach(() => {
  cleanup()
  cancelTaskHeadingReveal()
  jest.useRealTimers()
})

type RoundIndex = 0 | 1
const allRounds = ventilationLearningExperiments.flatMap((experiment) =>
  ([0, 1] as const).map((round) => [experiment.unitId, round] as const),
)
const roundOf = (unitId: string, round: RoundIndex) =>
  ventilationExperimentByUnit.get(unitId)!.rounds[round]

const engine = (action: VentilationAction): LabAction => ({ type: 'ENGINE', action })
const learnerRun = engine({ type: 'SET_PAUSED', paused: false, origin: 'learner' })
const learnerPause = engine({ type: 'SET_PAUSED', paused: true, origin: 'learner' })
const backgroundPause = engine({ type: 'SET_PAUSED', paused: true, origin: 'background' })
const tick = engine({ type: 'TICK', seconds: 0.1 })
const reduce = (session: LabSession, ...actions: LabAction[]) =>
  actions.reduce(learningLabReducer, session)

/*
 * Openings are deterministic and nothing here mutates a session or a simulation (the reducers
 * return new objects), so each is built once and shared. A round's opening costs a minute of
 * prepared history plus its warm-up; the census below would otherwise build some 1,500 of them.
 */
const openings = new Map<string, LabOpening>()
function openingOf(unitId: string, round: RoundIndex, device: VentilatorDeviceId = DEVICE) {
  const key = `${unitId}#${round}#${device}`
  if (!openings.has(key)) openings.set(key, openLabRound(unitId, round, device))
  return openings.get(key)!
}
const openedSessions = new Map<string, LabSession>()
/** The round as the Learn host opens it: this application, paused, nothing started. */
function opened(unitId: string, round: RoundIndex, device: VentilatorDeviceId = DEVICE) {
  const key = `${unitId}#${round}#${device}`
  if (!openedSessions.has(key)) {
    const session = reduce(createLabSession(unitId, device), { type: 'OPEN_ROUND', round })
    openedSessions.set(key, { ...session, simulation: { ...session.simulation, paused: true } })
  }
  return openedSessions.get(key)!
}
const started = (unitId: string, round: RoundIndex, device: VentilatorDeviceId = DEVICE) =>
  reduce(opened(unitId, round, device), { type: 'START_EXPERIMENT' })
function runFor(session: LabSession, seconds: number): LabSession {
  let next = reduce(session, learnerRun)
  for (let t = 0; t < seconds - 1e-9; t += 0.1) next = reduce(next, tick)
  return next
}
/** Every requested change, maneuver or bedside action of the round, made by the learner. */
function requested(session: LabSession): LabSession {
  let next = session
  for (const goal of roundOf(session.unitId, session.round).goals) {
    const action = labGoalAction(goal)
    if (action) next = reduce(next, engine(action))
  }
  return next
}
function untilReady(session: LabSession): LabSession {
  let next = session
  for (let steps = 0; !labReadyToCompare(next) && steps < 6000; steps += 1)
    next = reduce(next, tick)
  expect(labReadyToCompare(next)).toBe(true)
  return next
}
const baselineOf = (session: LabSession) => session.evidence[session.round].baseline
const responseOf = (session: LabSession) => session.evidence[session.round].response

/** Index of every verified inspiratory onset: an inspiratory sample after an expiratory one. */
function onsetIndexes(record: readonly WaveformSample[]): number[] {
  const indexes: number[] = []
  for (let i = 1; i < record.length; i += 1)
    if (record[i].phase === 'inspiration' && record[i - 1].phase === 'expiration') indexes.push(i)
  return indexes
}
/** Two decimals, with the float noise of a re-based clock (and its −0) removed. */
const fixed = (value: number) => Number(value.toFixed(2)) + 0

/**
 * What a baseline has to be, read off the snapshot alone: one inspiratory onset and the next, both
 * verified by the expiratory sample before them, every drawn row a real number, and all of it from
 * before the experiment — prepared history, at the round's own opening conditions.
 */
function expectCompleteUnchangedBaseline(
  baseline: LabSnapshot,
  opening: VentilationSimulationState,
) {
  const record = baseline.waveforms
  const breath = completedBreath(record)
  expect(breath.length).toBeGreaterThanOrEqual(4)
  const first = record.indexOf(breath[0])
  const last = first + breath.length - 1
  // Two verified onsets, each a real expiration-to-inspiration pair in the record.
  expect(first).toBeGreaterThanOrEqual(1)
  expect([record[first - 1].phase, record[first].phase]).toEqual(['expiration', 'inspiration'])
  expect([record[last - 1].phase, record[last].phase]).toEqual(['expiration', 'inspiration'])
  // A whole breath between them: it inspires, then expires, and nothing else starts inside it.
  expect(onsetIndexes(breath)).toEqual([breath.length - 1])
  expect(breath.some((sample) => sample.phase === 'expiration')).toBe(true)
  // Every row a figure can draw from it.
  for (const sample of breath)
    for (const row of ['pawCmH2O', 'flowLMin', 'volumeMl', 'pmusCmH2O'] as const)
      expect(Number.isFinite(sample[row])).toBe(true)
  // Before the experiment: taken at model time zero, every sample from before it (the lab's
  // re-based clock leaves a last sample within 1e-12 s of zero), in order, with no gap.
  expect(baseline.at).toBe(0)
  expect(record.every((sample) => sample.time < 1e-9)).toBe(true)
  for (let i = 1; i < record.length; i += 1) {
    const gap = record[i].time - record[i - 1].time
    expect(gap).toBeGreaterThan(0.0195)
    expect(gap).toBeLessThan(0.0205)
  }
  // The round's own opening conditions, and its own opening readings.
  expect(baseline.inputs).toEqual(measurementInputs(opening))
  expect(baseline.values.rate).toBe(opening.measurements.totalRatePerMin)
}

/* ------------------------------------------------------------------------------------------------
 * The cause, as measured on f2635a0f
 * ---------------------------------------------------------------------------------------------- */

describe('the cause: an opening window that is exactly two cycles, taken on a breath boundary', () => {
  it.each(ventilatorDeviceIds)(
    '%s: Section 8’s first application opens on a window that verifies one onset',
    (device) => {
      const { simulation } = openingOf(SECTION_8, 0, device)
      const window = simulation.waveforms
      expect(simulation.simulationTime).toBe(0)
      expect(simulation.measurements.totalRatePerMin).toBe(10)
      // The warm-up is four breaths, so the next onset is due exactly at model time zero.
      expect(simulation.ventilator.breathClock).toEqual({
        periodSeconds: 6,
        anchorSeconds: -24,
        nextOnsetSeconds: 0,
      })
      // 600 samples at 20 ms: −11.98 s to 0.00 s, which is two 6-second cycles and nothing more.
      expect(window).toHaveLength(MAX_WAVEFORM_SAMPLES)
      expect(fixed(window[0].time)).toBe(-11.98)
      expect(fixed(window.at(-1)!.time)).toBe(0)
      // It starts on a breath's first inspiratory sample — the expiratory sample that would verify
      // that onset (−12.00 s) is the one the 600-sample cap dropped...
      expect(window[0].phase).toBe('inspiration')
      // ...and ends on the last expiratory sample before an onset that has not been produced.
      expect(window.at(-1)!.phase).toBe('expiration')
      expect(onsetIndexes(window).map((index) => fixed(window[index].time))).toEqual([-5.98])
      expect(completedBreath(window)).toHaveLength(0)
    },
  )

  it('is the alignment, not the rate: the same unchanged patient one step later holds a breath', () => {
    const { simulation } = openingOf(SECTION_8, 0)
    let current = advanceSimulation(simulation, WAVEFORM_STEP_SECONDS)
    expect(current.measurements.totalRatePerMin).toBe(10)
    expect(current.waveforms).toHaveLength(MAX_WAVEFORM_SAMPLES)
    const breath = completedBreath(current.waveforms)
    expect(breath).toHaveLength(301)
    expect(fixed(breath.at(-1)!.time - breath[0].time)).toBe(6)
    // Over one whole 6-second cycle at 10/min, the 12-second window lacks a breath at exactly one
    // of 300 instants: the next breath boundary.
    const without: number[] = []
    for (let step = 2; step <= 300; step += 1) {
      current = advanceSimulation(current, WAVEFORM_STEP_SECONDS)
      if (completedBreath(current.waveforms).length < 4) without.push(step)
    }
    expect(without).toEqual([300])
  })
})

/* ------------------------------------------------------------------------------------------------
 * The acquisition: what the record keeps, and that nothing else moved
 * ---------------------------------------------------------------------------------------------- */

describe('the trace tap: the warm-up can keep what the display window drops', () => {
  it('returns the same state with or without it, and receives every sample in order', () => {
    const start = createInitialSimulationState('MV-07', 'learn', 1, DEVICE)
    const produced: WaveformSample[] = []
    const tapped = advanceSimulation(start, 24, undefined, produced)
    expect(tapped).toEqual(advanceSimulation(start, 24))
    expect(produced).toHaveLength(1200)
    // The same objects the buffer holds, not copies of them.
    tapped.waveforms.forEach((sample, index) => expect(produced[600 + index]).toBe(sample))
    for (let i = 1; i < produced.length; i += 1)
      expect(produced[i].time - produced[i - 1].time).toBeCloseTo(WAVEFORM_STEP_SECONDS, 9)
  })

  it('receives nothing while the display is frozen, as the buffer does', () => {
    const start = createInitialSimulationState('MV-07', 'learn', 1, DEVICE)
    const frozen = { ...start, ventilator: { ...start.ventilator, frozen: true } }
    const produced: WaveformSample[] = []
    const after = advanceSimulation(frozen, 2, undefined, produced)
    expect(produced).toHaveLength(0)
    expect(after.waveforms).toEqual(frozen.waveforms)
  })
})

/**
 * `createLabSimulation` exactly as it stood on `f2635a0f`, kept here as the reference the repaired
 * opening is held to: the patient a round opens on must not have moved by one sample.
 */
function openingBeforeThisRepair(
  unitId: string,
  roundIndex: RoundIndex,
  device: VentilatorDeviceId,
): VentilationSimulationState {
  const round = roundOf(unitId, roundIndex)
  const attempt =
    round.caseId === 'MV-08'
      ? ventilationLessonAttempt(
          {
            caseId: 'MV-08',
            branch: 'condensate',
            goal: '',
            actions: [],
            requiredEvidence: [],
            responseSeconds: 0,
          },
          1,
        )
      : 1
  let simulation = createInitialSimulationState(round.caseId, 'learn', attempt, device)
  for (const command of round.setup ?? [])
    simulation = ventilationSimulationReducer(simulation, command)
  const warmup = (4 * 60) / simulation.measurements.totalRatePerMin
  simulation = advanceSimulation({ ...simulation, paused: false }, warmup)
  return reopenAlarmEpoch({
    ...simulation,
    simulationTime: 0,
    ventilator: {
      ...simulation.ventilator,
      breathClock: shiftBreathClock(simulation.ventilator.breathClock, -warmup),
    },
    prediction: { ...simulation.prediction, committed: false },
    waveforms: simulation.waveforms.map((sample) => ({ ...sample, time: sample.time - warmup })),
    trends: [],
    risk: {
      highPlateau: 0,
      stackedVolume: 0,
      dynamicHyperinflation: 0,
      hypoxemia: 0,
      hypotension: 0,
      excessiveSedation: 0,
    },
    criticalErrors: [],
    paused: false,
  })
}

describe('the opening: the patient is the one it was; only the record keeps more', () => {
  it.each(allRounds)(
    '%s application %i: the same patient, sample for sample, on every console',
    (unitId, round) => {
      for (const device of ventilatorDeviceIds) {
        const opening = openingOf(unitId, round, device)
        expect(opening.simulation).toEqual(openingBeforeThisRepair(unitId, round, device))
        // The record ends in that patient's own 12-second window — the same sample objects.
        const window = opening.simulation.waveforms
        const record = opening.baselineRecord
        const tail = record.slice(-window.length)
        expect(tail).toHaveLength(window.length)
        tail.forEach((sample, index) => expect(sample).toBe(window[index]))
        // Where the window already verifies a breath the record is the window, untouched.
        if (completedBreath(window).length >= 4) expect(record).toBe(window)
      }
    },
  )

  it('extends exactly one authored round, and that record stays inside the saved-record bound', () => {
    const extended = allRounds.filter(([unitId, round]) => {
      const opening = openingOf(unitId, round)
      return opening.baselineRecord !== opening.simulation.waveforms
    })
    expect(extended).toEqual([[SECTION_8, 0]])
    expect(openingOf(SECTION_8, 0).baselineRecord).toHaveLength(800)
    // `createLabSimulation` is that opening's patient and nothing else.
    expect(createLabSimulation(SECTION_8, 0, DEVICE)).toEqual(openingOf(SECTION_8, 0).simulation)
  })

  it.each(ventilatorDeviceIds)(
    '%s: the samples Section 8 keeps are the engine’s own, at their own times',
    (device) => {
      /*
       * Independently of the lab: the same case run for the same 24 seconds in two 12-second calls,
       * so each call's buffer still holds everything it produced. No interpolation could reproduce
       * this exactly; equality is the claim.
       */
      const start = createInitialSimulationState('MV-07', 'learn', 1, device)
      const firstHalf = advanceSimulation({ ...start, paused: false }, 12)
      const secondHalf = advanceSimulation(firstHalf, 12)
      const everySample = [...firstHalf.waveforms, ...secondHalf.waveforms].map((sample) => ({
        ...sample,
        time: sample.time - 24,
      }))
      expect(everySample).toHaveLength(1200)
      const record = openingOf(SECTION_8, 0, device).baselineRecord
      expect(record).toEqual(everySample.slice(-800))
      expect(fixed(record[0].time)).toBe(-15.98)
      expect(fixed(record.at(-1)!.time)).toBe(0)
      // The one sample the window was missing, as the engine produced it: expiratory, at −12.00 s.
      const verifying = record[record.length - MAX_WAVEFORM_SAMPLES - 1]
      expect(fixed(verifying.time)).toBe(-12)
      expect(verifying.phase).toBe('expiration')
    },
  )
})

/* ------------------------------------------------------------------------------------------------
 * 1–3 · Section 8, first application
 * ---------------------------------------------------------------------------------------------- */

describe('Section 8, first application: the baseline its comparison needs', () => {
  it.each(ventilatorDeviceIds)(
    '1–2 · %s: a fresh baseline holds one complete breath, wholly at the unchanged baseline',
    (device) => {
      const session = started(SECTION_8, 0, device)
      const baseline = baselineOf(session)!
      expectCompleteUnchangedBaseline(baseline, openingOf(SECTION_8, 0, device).simulation)
      const breath = completedBreath(baseline.waveforms)
      expect(breath).toHaveLength(301)
      expect([fixed(breath[0].time), fixed(breath.at(-1)!.time)]).toEqual([-11.98, -5.98])
      // The requested variable is where the case put it, in the record and in the patient.
      expect(baseline.inputs!.trigger).toBe(JSON.stringify({ type: 'flow', thresholdLMin: 4 }))
      expect(session.simulation.ventilator.settings.trigger).toEqual({
        type: 'flow',
        thresholdLMin: 4,
      })
      expect(roundOf(SECTION_8, 0).goals).toEqual([
        { type: 'control', key: 'triggerThreshold', value: 1.5 },
      ])
      // Nothing has run and nothing has been asked of the patient.
      expect(session.simulation.simulationTime).toBe(0)
      expect(session.simulation.paused).toBe(true)
      expect(session.events).toHaveLength(0)
      expect(session.readySince).toBeNull()
    },
  )

  it('3 · the effort row is in that breath: three modeled efforts, one machine inflation', () => {
    const record = baselineOf(started(SECTION_8, 0))!.waveforms
    const facts = modeledEffortFacts(record)!
    expect(facts).not.toBeNull()
    expect(fixed(facts.durationSeconds)).toBe(6)
    expect(facts.intervals).toHaveLength(3)
    // The first was already under way at the breath's first sample, and the record still holds
    // where it began — the warm-up samples before the breath are part of the record.
    expect(facts.intervals[0].fromSeconds).toBeLessThan(0)
    expect(facts.intervals[0].openAtRecordStart).toBe(false)
    // The other two begin after the machine has cycled off, with no machine inflation after them.
    const breath = completedBreath(record)
    expect(onsetIndexes(breath)).toEqual([breath.length - 1])
    for (const interval of facts.intervals.slice(1)) {
      expect(interval.fromSeconds).toBeGreaterThan(facts.firstExpiratorySeconds!)
      expect(interval.openAtBreathEnd).toBe(false)
    }
    const text = describeModeledEffort('Baseline', record)
    expect(text).not.toMatch(/no complete breath/)
    expect(text).toMatch(/^Baseline breath: modeled effort is first at or above/)
    expect(text.match(/A further modeled effort/g)).toHaveLength(2)
    // A peak before the origin is said in words, never as a negative time.
    expect(text).not.toMatch(/at -\d/)
  })

  it('1, 3, 9 · rendered: baseline and result are both drawn, with effort, in every view', () => {
    const captured = reduce(untilReady(requested(reduce(started(SECTION_8, 0), learnerRun))), {
      type: 'COMPARE',
    })
    render(<CapturedResult round={roundOf(SECTION_8, 0)} evidence={captured.evidence[0]} effort />)
    const comparison = document.querySelector<HTMLElement>('[data-recorded-breath-comparison]')!
    // Side by side: two figures, each with its four rows, and no "holds no complete breath" note.
    expect(document.querySelector('[data-no-complete-breath]')).toBeNull()
    const figures = [...document.querySelectorAll<HTMLElement>('[data-captured-breath]')]
    expect(figures).toHaveLength(2)
    expect(figures[0].textContent).toMatch(/Captured baseline/)
    expect(figures[1].textContent).toMatch(/Captured result/)
    for (const figure of figures) {
      expect(
        [...figure.querySelectorAll('[data-row-label]')].map((label) =>
          label.getAttribute('data-row-label'),
        ),
      ).toEqual(['pawCmH2O', 'flowLMin', 'volumeMl', 'pmusCmH2O'])
      expect(figure.querySelectorAll('path').length).toBe(4)
    }
    expect(
      figures[0].querySelector('[data-breath-duration]')!.getAttribute('data-breath-duration'),
    ).toBe('6.00')
    // Overlay: both traces on all four rows, nothing reported missing.
    fireEvent.click(screen.getByRole('button', { name: 'Overlay' }))
    expect(comparison.getAttribute('data-comparison-view')).toBe('overlay')
    expect(document.querySelector('[data-overlay-missing-breath]')).toBeNull()
    for (const name of ['baseline', 'result']) {
      const traces = [...document.querySelectorAll(`[data-overlay-trace="${name}"]`)]
      expect(traces).toHaveLength(4)
      for (const trace of traces) expect(trace.getAttribute('d')!.length).toBeGreaterThan(100)
    }
    // Inspiration zoom is offered and crops both to the same seconds.
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to inspiration' }))
    expect(comparison.getAttribute('data-zoomed')).toBe('true')
    expect(document.querySelector('[data-zoom-bounds]')!.textContent).toMatch(
      /out of breaths up to 6\.00 s long/,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole breath' }))
    expect(comparison.getAttribute('data-zoomed')).toBe('false')
    // The words: both breaths described, the effort row for both, and the Batch-02 / R6 limits.
    const description = document.querySelector('[data-comparison-description]')!.textContent!
    expect(description).toMatch(/Baseline breath drawn above: .* of a 6\.00-s breath/)
    expect(description).toMatch(/Result breath drawn above:/)
    const effort = document.querySelector('[data-effort-description]')!.textContent!
    expect(effort).toMatch(/Baseline breath: modeled effort is/)
    expect(effort).toMatch(/Result breath: modeled effort is/)
    expect(effort).toMatch(/this simulator’s modeled signal, not a\s+measurement from a patient/)
    expect(effort).toMatch(/they do not show that an effort started a breath/)
    expect(effort).toMatch(/no interval here is a\s+measured delay/)
    expect(document.body.textContent).not.toMatch(/then capture again/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 4 · The result still needs its own complete breath
 * ---------------------------------------------------------------------------------------------- */

describe('4 · result capture still waits for a complete breath of its own', () => {
  it('a complete baseline does not open the gate: Section 11’s first application', () => {
    let current = requested(reduce(started(SECTION_11, 0), learnerRun))
    expect(completedBreath(baselineOf(current)!.waveforms).length).toBeGreaterThanOrEqual(4)
    current = untilReady(current)
    let gap: LabSession | null = null
    for (let later = 0; later < 200 && !gap; later += 1) {
      current = reduce(current, tick)
      if (!labRecordHoldsCompleteBreath(current)) gap = current
    }
    expect(gap).not.toBeNull()
    const round = roundOf(SECTION_11, 0)
    expect(round.goals.every((goal) => labGoalMet(goal, gap!))).toBe(true)
    expect(gap!.simulation.simulationTime - gap!.readySince!).toBeGreaterThan(round.seconds)
    expect(labReadyToCompare(gap!)).toBe(false)
    expect(ventilationExperimentStatus(gap!).headline).toMatch(
      /Waiting for one complete breath on the record before the result can be captured/,
    )
    expect(responseOf(reduce(gap!, { type: 'COMPARE' }))).toBeUndefined()
  })

  it('Section 8: the retained baseline’s breath is never lent to a result that has none', () => {
    const ready = untilReady(requested(reduce(started(SECTION_8, 0), learnerRun)))
    // The same session, everything in place and the interval over, with a live record cut to a
    // tail that holds a single onset.
    const withoutBreath: LabSession = {
      ...ready,
      simulation: { ...ready.simulation, waveforms: ready.simulation.waveforms.slice(-100) },
    }
    expect(completedBreath(baselineOf(withoutBreath)!.waveforms).length).toBeGreaterThanOrEqual(4)
    expect(labRecordHoldsCompleteBreath(withoutBreath)).toBe(false)
    expect(labReadyToCompare(withoutBreath)).toBe(false)
    expect(ventilationExperimentStatus(withoutBreath).canCapture).toBe(false)
    expect(responseOf(reduce(withoutBreath, { type: 'COMPARE' }))).toBeUndefined()
    // And with its own breath it captures, as before.
    expect(responseOf(reduce(ready, { type: 'COMPARE' }))).toBeDefined()
  })
})

/* ------------------------------------------------------------------------------------------------
 * 5 · A changed patient is never retained as the baseline
 * ---------------------------------------------------------------------------------------------- */

describe('5 · the requested change cannot be made first and then retained as the baseline', () => {
  const trigger = (value: number) => JSON.stringify({ type: 'flow', thresholdLMin: value })
  const commit: LabAction = { type: 'COMMIT', choice: 0 }

  it('reproduces the path: on the prediction step, change the trigger, run, then answer', () => {
    // The prediction step shows the same live patient, with its controls and Run.
    const explored = runFor(requested(opened(SECTION_8, 0)), 30)
    expect(explored.phase).toBe('explore')
    expect(explored.simulation.ventilator.settings.trigger).toEqual({
      type: 'flow',
      thresholdLMin: 1.5,
    })
    const committed = reduce(explored, commit)
    // The prediction is recorded...
    expect(committed.evidence[0].prediction).toBe(0)
    // ...and the explored patient is not retained as anything. On f2635a0f this was phase
    // 'experiment' with a "baseline" at 30 s of model time whose trigger was already 1.5 L/min.
    expect(baselineOf(committed)).toBeUndefined()
    expect(committed.phase).toBe('explore')
    expect(ventilationExperimentStatus(committed).stage).toBe('not-started')
    expect(responseOf(reduce(runFor(committed, 25), { type: 'COMPARE' }))).toBeUndefined()
    // Arriving on the experiment step starts it from a fresh patient: baseline before the change.
    const experiment = reduce(committed, { type: 'START_EXPERIMENT' })
    expect(experiment.phase).toBe('experiment')
    expect(experiment.evidence[0].prediction).toBe(0)
    expect(baselineOf(experiment)!.inputs!.trigger).toBe(trigger(4))
    expect(experiment.simulation.ventilator.settings.trigger).toEqual({
      type: 'flow',
      thresholdLMin: 4,
    })
    expect(experiment.simulation.simulationTime).toBe(0)
    expect(experiment.events).toHaveLength(0)
    expect(labGoalMet(roundOf(SECTION_8, 0).goals[0], experiment)).toBe(false)
  })

  it('a patient that has only been changed, or only been run, gives no baseline either', () => {
    const changed = requested(opened(SECTION_8, 0))
    expect(changed.simulation.simulationTime).toBe(0)
    expect(baselineOf(reduce(changed, commit))).toBeUndefined()
    const ran = runFor(opened(SECTION_8, 0), 3)
    expect(ran.events).toHaveLength(0)
    expect(baselineOf(reduce(ran, commit))).toBeUndefined()
    // Changed and changed back is still a patient something was done to.
    const restored = reduce(
      changed,
      engine({ type: 'SET_CONTROL', control: 'triggerThreshold', value: 4 }),
    )
    expect(baselineOf(reduce(restored, commit))).toBeUndefined()
  })

  it.each(allRounds)(
    '%s application %i: whatever is done before the prediction, no baseline carries it',
    (unitId, round) => {
      const explored = runFor(requested(opened(unitId, round)), 5)
      const committed = reduce(explored, commit)
      expect(committed.evidence[round].prediction).toBe(0)
      expect(baselineOf(committed)).toBeUndefined()
      const experiment = reduce(committed, { type: 'START_EXPERIMENT' })
      expectCompleteUnchangedBaseline(baselineOf(experiment)!, openingOf(unitId, round).simulation)
    },
  )

  it('an untouched patient’s prediction opens the experiment on its own opening', () => {
    const untouched = opened(SECTION_8, 0)
    const committed = reduce(untouched, commit)
    expect(committed.phase).toBe('experiment')
    expect(baselineOf(committed)).toEqual(baselineOf(started(SECTION_8, 0)))
    // The patient is the one that was on screen: not replaced, not restarted.
    expect(committed.simulation).toBe(untouched.simulation)
    expect(committed.simulation.simulationTime).toBe(0)
  })

  it('PREDICT then a change then COMMIT keeps the opening, or nothing — never the changed patient', () => {
    // A foundation section retains its baseline at PREDICT; the later change does not replace it.
    const foundation = reduce(opened('waveform-anatomy', 0), { type: 'PREDICT' })
    const retained = baselineOf(foundation)!
    const after = reduce(runFor(requested(foundation), 5), commit)
    expect(after.phase).toBe('experiment')
    expect(baselineOf(after)).toBe(retained)
    expect(retained.inputs).toEqual(measurementInputs(openingOf('waveform-anatomy', 0).simulation))
    // Any other section has none yet, and does not take one from the changed patient.
    const other = reduce(opened(SECTION_8, 0), { type: 'PREDICT' })
    expect(baselineOf(other)).toBeUndefined()
    const changed = reduce(runFor(requested(other), 5), commit)
    expect(baselineOf(changed)).toBeUndefined()
    expect(changed.phase).toBe('predict')
    expect(baselineOf(reduce(other, commit))!.inputs!.trigger).toBe(trigger(4))
  })

  it('once the experiment has started, nothing replaces its baseline', () => {
    const begun = started(SECTION_8, 0)
    const baseline = baselineOf(begun)!
    let current = runFor(requested(reduce(begun, learnerRun)), 10)
    // Starting again mid-experiment is refused; a second prediction keeps the same record.
    expect(reduce(current, { type: 'START_EXPERIMENT' })).toBe(current)
    expect(baselineOf(reduce(current, commit))).toBe(baseline)
    current = reduce(untilReady(current), { type: 'COMPARE' })
    expect(baselineOf(current)).toBe(baseline)
    expect(baseline.inputs!.trigger).toBe(trigger(4))
    expect(responseOf(current)!.inputs!.trigger).toBe(trigger(1.5))
    // Every baseline sample precedes the change; every result sample follows the experiment start.
    expect(baseline.waveforms.every((sample) => sample.time <= 0)).toBe(true)
    expect(completedBreath(responseOf(current)!.waveforms)[0].time).toBeGreaterThan(0)
  })

  it('rendered: a change made on the prediction step does not reach the experiment step', () => {
    render(<VentilationStageHost unitId={SECTION_8} />)
    act(() => jest.advanceTimersByTime(10))
    const lesson = ventilationStageLesson(SECTION_8)
    expect(lesson.steps[1].interaction.kind).toBe('prediction')
    expect(lesson.steps[2].interaction.kind).toBe('simulator-task')
    const chooseStep = (index: number) =>
      fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
        target: { value: index },
      })
    const control = () => document.getElementById('mv-quick-triggerThreshold') as HTMLInputElement
    chooseStep(1)
    expect(Number(control().value)).toBe(4)
    fireEvent.change(control(), { target: { value: '1.5' } })
    expect(Number(control().value)).toBe(1.5)
    act(() => jest.advanceTimersByTime(3000))
    // Answer the optional prediction with the changed patient on screen.
    const question = lesson.steps[1].interaction
    if (question.kind !== 'prediction') throw new Error('expected the prediction step')
    fireEvent.click(screen.getByRole('radio', { name: question.item.choices[0].label }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
    chooseStep(2)
    const panel = document.querySelector<HTMLElement>('[data-experiment-panel]')!
    // A fresh patient at its baseline: the change is still to do and no model time has passed.
    expect(panel.getAttribute('data-experiment-stage')).toBe('awaiting-action')
    expect(panel.querySelector('[data-goal-state]')!.getAttribute('data-goal-state')).toBe('to-do')
    expect(panel.querySelector('[data-model-time]')!.textContent).toMatch(/Model time 0\.0 s/)
    expect(Number(control().value)).toBe(4)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 6–7 · Reset, restart and a change of console
 * ---------------------------------------------------------------------------------------------- */

describe('6–7 · reset, restart and a device change each start from a fresh, valid baseline', () => {
  const captured = () =>
    reduce(untilReady(requested(reduce(started(SECTION_8, 0), learnerRun))), { type: 'COMPARE' })

  it('6 · Reset patient: a new baseline from a new opening; the old result is archived', () => {
    const before = captured()
    const reset = reduce(before, { type: 'RESET' }, { type: 'START_EXPERIMENT' })
    expect(reset.phase).toBe('experiment')
    expect(responseOf(reset)).toBeUndefined()
    expect(baselineOf(reset)).not.toBe(baselineOf(before))
    expect(baselineOf(reset)).toEqual(baselineOf(before))
    expectCompleteUnchangedBaseline(baselineOf(reset)!, openingOf(SECTION_8, 0).simulation)
    expect(reset.simulation.simulationTime).toBe(0)
    expect(reset.simulation.ventilator.settings.trigger).toEqual({ type: 'flow', thresholdLMin: 4 })
    expect(reset.events).toHaveLength(0)
    expect(reset.readySince).toBeNull()
    expect(reset.history!.at(-1)!.reason).toMatch(/Patient reset/)
  })

  it('6 · a reset in the middle of a changed run does not keep the changed patient', () => {
    const midRun = runFor(requested(reduce(started(SECTION_8, 0), learnerRun)), 8)
    expect(midRun.simulation.measurements.totalRatePerMin).not.toBe(10)
    const reset = reduce(midRun, { type: 'RESET' }, { type: 'START_EXPERIMENT' })
    expectCompleteUnchangedBaseline(baselineOf(reset)!, openingOf(SECTION_8, 0).simulation)
    expect(reset.simulation.measurements.totalRatePerMin).toBe(10)
  })

  it('6 · Restart section: no baseline until the experiment starts again, then a complete one', () => {
    const restarted = reduce(captured(), { type: 'RESTART' })
    expect(restarted.evidence).toEqual([{}, {}])
    expect(restarted.phase).toBe('explore')
    const again = reduce(restarted, { type: 'START_EXPERIMENT' })
    expectCompleteUnchangedBaseline(baselineOf(again)!, openingOf(SECTION_8, 0).simulation)
  })

  it.each(ventilatorDeviceIds.filter((device) => device !== DEVICE))(
    '7 · changing the console to %s drops the retained baseline and acquires that console’s own',
    (device) => {
      const before = captured()
      const changed = reduce(before, { type: 'DEVICE', device })
      // Nothing of the other console's run is current evidence; it is history, under its own name.
      expect(changed.device).toBe(device)
      expect(changed.evidence).toEqual([{}, {}])
      expect(changed.simulation.deviceId).toBe(device)
      expect(changed.history!.at(-1)).toMatchObject({ device: DEVICE, reason: 'Device changed' })
      expect(changed.history!.at(-1)!.evidence[0].baseline).toBe(baselineOf(before))
      expect(responseOf(reduce(changed, { type: 'COMPARE' }))).toBeUndefined()
      const again = reduce(changed, { type: 'START_EXPERIMENT' })
      expect(again.simulation.deviceId).toBe(device)
      expect(baselineOf(again)).not.toBe(baselineOf(before))
      // Acquired from this console's opening: its record is that opening's record.
      const opening = openingOf(SECTION_8, 0, device)
      expect(baselineOf(again)!.waveforms).toEqual(opening.baselineRecord)
      expectCompleteUnchangedBaseline(baselineOf(again)!, opening.simulation)
    },
  )

  it('6 · rendered: Reset patient on the experiment step returns to a baseline still to change', () => {
    render(<VentilationStageHost unitId={SECTION_8} />)
    act(() => jest.advanceTimersByTime(10))
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: 2 },
    })
    const panel = () => document.querySelector<HTMLElement>('[data-experiment-panel]')!
    const control = () => document.getElementById('mv-quick-triggerThreshold') as HTMLInputElement
    fireEvent.change(control(), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    act(() => jest.advanceTimersByTime(25_000))
    expect(panel().getAttribute('data-experiment-stage')).toBe('ready')
    fireEvent.click(document.querySelector<HTMLElement>('[data-capture-result]')!)
    expect(document.querySelector('[data-captured-result]')).not.toBeNull()
    expect(document.querySelector('[data-no-complete-breath]')).toBeNull()
    expect(document.querySelectorAll('[data-captured-result] [data-captured-breath]')).toHaveLength(
      2,
    )
    fireEvent.click(document.querySelector<HTMLElement>('[data-reset-patient]')!)
    expect(document.querySelector('[data-captured-result]')).toBeNull()
    expect(panel().getAttribute('data-experiment-stage')).toBe('awaiting-action')
    expect(panel().querySelector('[data-model-time]')!.textContent).toMatch(/Model time 0\.0 s/)
    expect(Number(control().value)).toBe(4)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 8 · Census
 * ---------------------------------------------------------------------------------------------- */

describe('8 · census: every authored round retains a complete, drawable baseline', () => {
  it('every authored round is a waveform comparison: none is numeric-only', () => {
    /*
     * `CapturedResult` draws `RecordedBreathComparison` for every round, with no per-round switch,
     * and every round the Learn stage reaches has an experiment step that shows it. The one
     * authored round the stage does not reach (Section 9's second, behind the PEEP comparison) is
     * held to the same contract below.
     */
    const reached = new Set<string>()
    for (const experiment of ventilationLearningExperiments)
      for (const step of ventilationStageLesson(experiment.unitId).steps)
        if (step.interaction.kind === 'simulator-task')
          reached.add(`${experiment.unitId}#${step.interaction.round}`)
    const unreached = allRounds
      .map(([unitId, round]) => `${unitId}#${round}`)
      .filter((key) => !reached.has(key))
    expect(unreached).toEqual(['oxygenation-response#1'])
    expect(allRounds).toHaveLength(28)
  })

  /* Whether this round's experiment steps draw the effort row (presentation metadata). */
  const drawsEffort = (unitId: string, round: RoundIndex) =>
    ventilationStageLesson(unitId).steps.some(
      (step) =>
        (step.interaction.kind === 'simulator-task' || step.interaction.kind === 'observe') &&
        step.interaction.round === round &&
        step.presentation.effort,
    )
  function expectDrawable(unitId: string, round: RoundIndex, baseline: LabSnapshot | undefined) {
    if (!baseline) throw new Error('no baseline was retained')
    if (!drawsEffort(unitId, round)) return
    expect(modeledEffortFacts(baseline.waveforms)).not.toBeNull()
    expect(describeModeledEffort('Baseline', baseline.waveforms)).not.toMatch(/no complete breath/)
  }

  it.each(allRounds)(
    '%s application %i: Start the experiment retains a complete baseline on every console',
    (unitId, round) => {
      for (const device of ventilatorDeviceIds) {
        const baseline = baselineOf(started(unitId, round, device))
        expectDrawable(unitId, round, baseline)
        expectCompleteUnchangedBaseline(baseline!, openingOf(unitId, round, device).simulation)
      }
    },
  )

  it.each(allRounds)(
    '%s application %i: the same baseline by every other way one is acquired',
    (unitId, round) => {
      const fresh = started(unitId, round)
      const acquired: Record<string, LabSnapshot | undefined> = {
        'the prediction, on an untouched patient': baselineOf(
          reduce(opened(unitId, round), { type: 'COMMIT', choice: 0 }),
        ),
        'PREDICT then COMMIT': baselineOf(
          reduce(opened(unitId, round), { type: 'PREDICT' }, { type: 'COMMIT', choice: 1 }),
        ),
        'Reset patient': baselineOf(
          reduce(runFor(requested(fresh), 3), { type: 'RESET' }, { type: 'START_EXPERIMENT' }),
        ),
      }
      for (const baseline of Object.values(acquired)) {
        expectDrawable(unitId, round, baseline)
        expectCompleteUnchangedBaseline(baseline!, openingOf(unitId, round).simulation)
        expect(baseline).toEqual(baselineOf(fresh))
      }
    },
  )
})

/* ------------------------------------------------------------------------------------------------
 * 9 · Section 8's comparison says what its records hold
 * ---------------------------------------------------------------------------------------------- */

describe('9 · Section 8’s result comparison stays truthful', () => {
  it('the result is a breath delivered after the change; the baseline is one from before it', () => {
    const ready = untilReady(requested(reduce(started(SECTION_8, 0), learnerRun)))
    const captured = reduce(ready, { type: 'COMPARE' })
    const baseline = baselineOf(captured)!
    const response = responseOf(captured)!
    const before = completedBreath(baseline.waveforms)
    const after = completedBreath(response.waveforms)
    expect(before.at(-1)!.time).toBeLessThanOrEqual(0)
    expect(after[0].time).toBeGreaterThanOrEqual(ready.readySince! - 1e-9)
    expect(response.at - ready.readySince!).toBeGreaterThanOrEqual(roundOf(SECTION_8, 0).seconds)
    expect(response.issues).toEqual([])
    // The watched readings are each record's own, as the ventilator published them at capture.
    expect(roundOf(SECTION_8, 0).watch).toEqual(['missed', 'rate', 'effort'])
    expect(baseline.values.rate).toBe(10)
    expect(response.values.rate).toBeGreaterThan(baseline.values.rate)
    expect(response.values.missed).toBeLessThan(baseline.values.missed)
    // And the traces show the same thing as sample facts: three modeled efforts in one 6-second
    // baseline breath, one in each shorter result breath.
    const baselineEffort = modeledEffortFacts(baseline.waveforms)!
    const resultEffort = modeledEffortFacts(response.waveforms)!
    expect(baselineEffort.intervals).toHaveLength(3)
    expect(resultEffort.intervals).toHaveLength(1)
    expect(resultEffort.durationSeconds).toBeLessThan(baselineEffort.durationSeconds / 2)
    // Nothing in either description claims an effort started a breath, or a measured delay.
    for (const text of [
      describeModeledEffort('Baseline', baseline.waveforms),
      describeModeledEffort('Result', response.waveforms),
    ])
      expect(text).not.toMatch(/trigger(ed)?|delay|caused|started the breath|measured/i)
  })
})

describe('9 · Section 8: the requested change is not reported as an additional input', () => {
  const additional = 'Additional input changed: trigger'
  const set = (
    control: 'triggerThreshold' | 'triggerType' | 'etsPercent',
    value: number | string,
  ) => engine({ type: 'SET_CONTROL', control, value })

  it('reproduces the label: the only change made is the one the task asks for', () => {
    // On f2635a0f (and on main) this clean run carried "Additional input changed: trigger".
    const changed = requested(reduce(started(SECTION_8, 0), learnerRun))
    expect(changed.events.map((event) => event.action)).toEqual([
      { type: 'SET_CONTROL', control: 'triggerThreshold', value: 1.5 },
    ])
    expect(changed.confounds).toEqual([])
    const captured = reduce(untilReady(changed), { type: 'COMPARE' })
    expect(captured.confounds).toEqual([])
    expect(responseOf(captured)!.issues).toEqual([])
  })

  it('still reports what was not asked for', () => {
    const begun = reduce(started(SECTION_8, 0), learnerRun)
    // The trigger type, under a request for its threshold.
    expect(reduce(begun, set('triggerType', 'pressure')).confounds).toEqual([additional])
    // Another setting altogether.
    expect(reduce(requested(begun), set('etsPercent', 40)).confounds).toEqual([
      'Additional input changed: etsPercent',
    ])
    // The threshold itself, in a round that asks for something else (the second application).
    const other = reduce(started(SECTION_8, 1), learnerRun)
    expect(roundOf(SECTION_8, 1).goals).toEqual([{ type: 'control', key: 'etsPercent', value: 15 }])
    expect(reduce(other, set('triggerThreshold', 1.5)).confounds).toEqual([additional])
    expect(requested(other).confounds).toEqual([])
  })

  it('rendered: a clean run is captured automatically when asked, and prints no such line', () => {
    render(<VentilationStageHost unitId={SECTION_8} />)
    act(() => jest.advanceTimersByTime(10))
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: 2 },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /Capture automatically/ }))
    fireEvent.change(document.getElementById('mv-quick-triggerThreshold')!, {
      target: { value: '1.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    act(() => jest.advanceTimersByTime(25_000))
    // It was held here, with "this comparison no longer isolates one change".
    expect(document.querySelector('[data-auto-capture-held]')).toBeNull()
    expect(
      document.querySelector('[data-experiment-panel]')!.getAttribute('data-experiment-stage'),
    ).toBe('captured')
    const result = document.querySelector('[data-captured-result]')!
    expect(result.textContent).not.toMatch(/Additional input changed/)
    expect(result.querySelectorAll('[data-captured-breath]')).toHaveLength(2)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 10 · R1 still holds
 * ---------------------------------------------------------------------------------------------- */

describe('10 · R1: a background suspension still fabricates no inspection and no capture', () => {
  it('Section 1: hidden at the instant a learner’s pause would count — nothing is recorded', () => {
    const running = runFor(started(SECTION_1, 0), 4.6)
    const last = running.simulation.waveforms.at(-1)!
    expect(last.phase === 'expiration' && last.flowLMin < -0.1).toBe(true)
    const hidden = reduce(running, backgroundPause)
    expect(hidden.pauseOrigin).toBe('background')
    expect(hidden.evidence[0].inspection).toBeUndefined()
    expect(hidden.readySince).toBeNull()
    expect(labReadyToCompare(hidden)).toBe(false)
    expect(responseOf(reduce(hidden, { type: 'COMPARE' }))).toBeUndefined()
    // Back in the foreground, stepped one breath, paused again by the program: still nothing.
    const later = reduce(
      hidden,
      engine({ type: 'STEP_BREATH' }),
      engine({ type: 'SET_PAUSED', paused: true }),
      backgroundPause,
    )
    expect(later.evidence[0].inspection).toBeUndefined()
    expect(responseOf(reduce(later, { type: 'COMPARE' }))).toBeUndefined()
    // The baseline it was offered is complete, and is not what was missing.
    expect(completedBreath(baselineOf(hidden)!.waveforms).length).toBeGreaterThanOrEqual(4)
    // The learner's own pause, at the same instant, is the one that counts.
    const theirs = reduce(running, learnerPause)
    expect(theirs.evidence[0].inspection?.sample.phase).toBe('expiration')
    expect(labReadyToCompare(theirs)).toBe(true)
  })

  it('Section 8: a suspension neither opens the gate nor alters the retained baseline', () => {
    const midInterval = runFor(requested(reduce(started(SECTION_8, 0), learnerRun)), 10)
    expect(labReadyToCompare(midInterval)).toBe(false)
    const baseline = baselineOf(midInterval)!
    const hidden = reduce(midInterval, backgroundPause)
    expect(hidden.simulation.paused).toBe(true)
    expect(hidden.pauseOrigin).toBe('background')
    expect(labReadyToCompare(hidden)).toBe(false)
    expect(responseOf(reduce(hidden, { type: 'COMPARE' }))).toBeUndefined()
    expect(hidden.evidence[0].inspection).toBeUndefined()
    expect(baselineOf(hidden)).toBe(baseline)
    expect(hidden.readySince).toBe(midInterval.readySince)
  })

  it('rendered: hidden with automatic capture on, on the Section 1 experiment step — no capture', () => {
    render(<VentilationStageHost unitId={SECTION_1} />)
    act(() => jest.advanceTimersByTime(10))
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: 2 },
    })
    const panel = () => document.querySelector<HTMLElement>('[data-experiment-panel]')!
    fireEvent.click(screen.getByRole('checkbox', { name: /Capture automatically/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    act(() => jest.advanceTimersByTime(4600))
    visibility = 'hidden'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => jest.advanceTimersByTime(3000))
    expect(panel().getAttribute('data-experiment-stage')).toBe('awaiting-action')
    expect(document.querySelector('[data-captured-result]')).toBeNull()
    expect(document.querySelector('[data-background-pause]')).not.toBeNull()
    visibility = 'visible'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => jest.advanceTimersByTime(3000))
    expect(panel().getAttribute('data-experiment-stage')).toBe('awaiting-action')
    expect(document.querySelector('[data-captured-result]')).toBeNull()
  })
})
