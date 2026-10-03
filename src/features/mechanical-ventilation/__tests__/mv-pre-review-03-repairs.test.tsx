/**
 * MV-PRE-REVIEW-03 — repairs after the independent sanity review of PR #290 (reviewed head
 * `02eb66e4`). One describe per finding, R1–R6, and one for the capture gate the review asked to be
 * verified while R1 was repaired. Each "reproduces" test states the defect as the review found it;
 * the handoff records which assertions fail on the reviewed head.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { WaveformStrip } from '../components/WaveformStrip'
import { CapturedBreath } from '../components/stage/CapturedBreath'
import { RecordedBreathComparison } from '../components/stage/RecordedBreathComparison'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { breathRowLayout } from '../components/stage/breathFigureLayout'
import {
  activatesThisTab,
  cancelTaskHeadingReveal,
  consumeTaskHeadingReveal,
  pinnedTopInset,
  requestTaskHeadingReveal,
} from '../components/stage/revealTaskHeading'
import {
  BREATH_ROW_LABELS,
  BREATH_TIME_AXIS_LABEL,
  breathOriginFacts,
} from '../content/breathOrigin'
import { inspiratoryTimeStepNote } from '../content/deliveredVolume'
import { describeModeledEffort, modeledEffortFacts } from '../content/effortDescription'
import {
  inspectionFigureState,
  markedIntervalLook,
  ventilationExperimentStatus,
} from '../content/experimentStatus'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import {
  ventilationExperimentByUnit,
  ventilationLearningExperiments,
} from '../content/learningExperiments'
import {
  markerEvidence,
  markerEvidenceSentence,
  ventilationReferenceMarker,
  ventilationReferenceMarkers,
} from '../content/referenceEvidence'
import { ventilationStageLesson } from '../content/stageLessons'
import {
  createLabSession,
  createLabSimulation,
  labCheckpoint,
  labGoalAction,
  labGoalMet,
  labReadyToCompare,
  labRecordHoldsCompleteBreath,
  learningLabReducer,
  type LabAction,
  type LabSession,
} from '../engine/learningLab'
import { observationFor } from '../engine/learningObservation'
import { EFFORT_DETECTION_FLOOR_CMH2O } from '../engine/physics'
import { ventilationSimulationReducer } from '../engine/reducer'
import { completedBreath } from '../engine/teachingBreath'
import type { VentilationAction, WaveformSample } from '../engine/types'

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

const DEVICE = 'hamilton-c6' as const
const SECTION_1 = 'breathing-with-support'
const SECTION_2 = 'waveform-anatomy'
const SECTION_7 = 'expiration-and-air-trapping'
const scrollIntoView = jest.fn()
let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  scrollIntoView.mockClear()
  mockPush.mockReset()
  cancelTaskHeadingReveal()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })
})
afterEach(() => {
  cleanup()
  cancelTaskHeadingReveal()
  jest.useRealTimers()
})

const boot = () => act(() => jest.advanceTimersByTime(10))
function mount(unitId: string) {
  render(<VentilationStageHost unitId={unitId} />)
  boot()
  return ventilationStageLesson(unitId)
}
function chooseStep(index: number) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
    target: { value: index },
  })
}
const heading = () => document.querySelector<HTMLElement>('[data-step-heading]')!
const card = () => document.querySelector<HTMLElement>('[data-current-step]')!
const panel = () => document.querySelector<HTMLElement>('[data-experiment-panel]')!
const stage = () => panel().getAttribute('data-experiment-stage')
const runSeconds = (seconds: number) => act(() => jest.advanceTimersByTime(seconds * 1000))
/** The page going to the background or coming back, as the browser reports it. */
function setVisibility(next: DocumentVisibilityState) {
  visibility = next
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const engine = (action: VentilationAction): LabAction => ({ type: 'ENGINE', action })
function session(unitId: string, round: 0 | 1, ...actions: LabAction[]): LabSession {
  let current = learningLabReducer(createLabSession(unitId, DEVICE), { type: 'OPEN_ROUND', round })
  current = learningLabReducer(current, { type: 'START_EXPERIMENT' })
  for (const action of actions) current = learningLabReducer(current, action)
  return current
}
const learnerRun = engine({ type: 'SET_PAUSED', paused: false, origin: 'learner' })
const learnerPause = engine({ type: 'SET_PAUSED', paused: true, origin: 'learner' })
const backgroundPause = engine({ type: 'SET_PAUSED', paused: true, origin: 'background' })
const tick = engine({ type: 'TICK', seconds: 0.1 })
function runFor(current: LabSession, seconds: number): LabSession {
  let next = learningLabReducer(current, learnerRun)
  for (let t = 0; t < seconds - 1e-9; t += 0.1) next = learningLabReducer(next, tick)
  return next
}
const lastSample = (current: LabSession) => current.simulation.waveforms.at(-1)!
const outwardFlow = (sample: WaveformSample) =>
  sample.phase === 'expiration' && sample.flowLMin < -0.1
const inspection = (current: LabSession) => current.evidence[current.round].inspection

/*
 * The instant the review used: about 4.6 s of model time, in expiration, with gas still leaving —
 * exactly where a learner's Pause earns the Section 1 goal. Asserted, not assumed.
 */
const EXPIRATORY_SECONDS = 4.6
const expiratoryInstant = () => {
  const running = runFor(session(SECTION_1, 0), EXPIRATORY_SECONDS)
  expect(running.simulation.simulationTime).toBeGreaterThanOrEqual(4)
  expect(outwardFlow(lastSample(running))).toBe(true)
  return running
}

/* ------------------------------------------------------------------------------------------------
 * R1 — a background or system suspension is not the learner's pause
 * ---------------------------------------------------------------------------------------------- */

describe('R1: who paused decides what a pause can count for', () => {
  it('1 · the learner’s own Pause during outward flow satisfies the Section 1 goal', () => {
    const paused = learningLabReducer(expiratoryInstant(), learnerPause)
    expect(inspection(paused)?.sample.phase).toBe('expiration')
    expect(paused.pauseOrigin).toBe('learner')
    expect(labReadyToCompare(paused)).toBe(true)
    expect(ventilationExperimentStatus(paused).stage).toBe('ready')
  })

  it('2–3 · a background suspension records nothing, then or after the page is back', () => {
    const suspended = learningLabReducer(expiratoryInstant(), backgroundPause)
    // The model did stop — at the very instant a learner's pause would have counted.
    expect(suspended.simulation.paused).toBe(true)
    expect(outwardFlow(lastSample(suspended))).toBe(true)
    expect(suspended.pauseOrigin).toBe('background')
    expect(inspection(suspended)).toBeUndefined()
    expect(suspended.readySince).toBeNull()
    const goal = ventilationExperimentByUnit.get(SECTION_1)!.rounds[0].goals[0]
    expect(labGoalMet(goal, suspended)).toBe(false)
    expect(labReadyToCompare(suspended)).toBe(false)
    expect(ventilationExperimentStatus(suspended).stage).toBe('awaiting-action')
    expect(ventilationExperimentStatus(suspended).backgroundPaused).toBe(true)
    // Nothing the page can do while paused turns the suspension into credit afterwards.
    for (const later of [
      engine({ type: 'SET_SPEED', speed: 5 }),
      engine({ type: 'SET_SPEED', speed: 1 }),
      tick,
      engine({ type: 'SET_PAUSED', paused: true }),
      backgroundPause,
      learnerPause, // a "pause" of a model that was already stopped stopped nothing
    ] as const) {
      const after = learningLabReducer(suspended, later)
      expect(inspection(after)).toBeUndefined()
      expect(labReadyToCompare(after)).toBe(false)
    }
    // A capture request is refused: the gate is closed.
    const refused = learningLabReducer(suspended, { type: 'COMPARE' })
    expect(refused.evidence[0].response).toBeUndefined()
    expect(refused.phase).toBe('experiment')
  })

  it('a pause that names no origin is the program’s own and earns nothing either', () => {
    const paused = learningLabReducer(
      expiratoryInstant(),
      engine({ type: 'SET_PAUSED', paused: true }),
    )
    expect(paused.simulation.paused).toBe(true)
    expect(inspection(paused)).toBeUndefined()
    expect(paused.pauseOrigin ?? null).toBeNull()
    expect(labReadyToCompare(paused)).toBe(false)
  })

  it('the origin never reaches the physiology: the engine state is the same pause', () => {
    const running = expiratoryInstant().simulation
    const plain = ventilationSimulationReducer(running, { type: 'SET_PAUSED', paused: true })
    for (const origin of ['learner', 'background'] as const)
      expect(
        ventilationSimulationReducer(running, { type: 'SET_PAUSED', paused: true, origin }),
      ).toEqual(plain)
    // And it is never part of a checkpoint.
    const suspended = learningLabReducer(expiratoryInstant(), backgroundPause)
    expect('pauseOrigin' in labCheckpoint(suspended)).toBe(false)
  })

  it('2–5 · rendered: hidden with automatic capture on captures nothing; the learner’s own pause then does', () => {
    mount(SECTION_1)
    chooseStep(2)
    fireEvent.click(screen.getByRole('checkbox', { name: /Capture automatically/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    runSeconds(EXPIRATORY_SECONDS)
    expect(panel().getAttribute('data-running')).toBe('true')

    // The review's reproduction: the page is hidden; the app pauses the model for it.
    setVisibility('hidden')
    expect(panel().getAttribute('data-running')).toBe('false')
    expect(stage()).toBe('awaiting-action')
    expect(document.querySelector('[data-captured-result]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Capture result' })).toBeDisabled()
    expect(document.querySelector('[data-background-pause]')?.textContent).toMatch(
      /was not your pause/,
    )
    // Hidden time passes; nothing advances and nothing is recorded.
    runSeconds(5)
    expect(stage()).toBe('awaiting-action')

    // Visible again: still no inspection, no readiness, no capture.
    setVisibility('visible')
    runSeconds(2)
    expect(stage()).toBe('awaiting-action')
    expect(panel().querySelector('[data-goal-state]')?.getAttribute('data-goal-state')).toBe(
      'to-do',
    )
    expect(document.querySelector('[data-captured-result]')).toBeNull()
    expect(panel().getAttribute('data-running')).toBe('false')

    // The learner carries on: one more breath, then their own Pause during outward flow.
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    expect(document.querySelector('[data-background-pause]')).toBeNull()
    runSeconds(3.8)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    // Automatic capture was left on, and now the gate it reads is really open.
    expect(stage()).toBe('captured')
    expect(document.querySelector('[data-captured-result]')).not.toBeNull()
  })

  it('rendered: the same instant, paused by the learner, is ready — and waits for them without the option', () => {
    mount(SECTION_1)
    chooseStep(2)
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    runSeconds(EXPIRATORY_SECONDS)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(stage()).toBe('ready')
    expect(document.querySelector('[data-background-pause]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Capture result' })).toBeEnabled()
    expect(document.querySelector('[data-captured-result]')).toBeNull()
  })

  it('6 · a pause on an unrelated step or round fabricates no inspection', () => {
    // A round with no pause goal: Section 2's flow change.
    const flow = learningLabReducer(runFor(session(SECTION_2, 0), EXPIRATORY_SECONDS), learnerPause)
    expect(inspection(flow)).toBeUndefined()
    // Section 1's second application asks for a chosen interval, not a pause.
    const second = learningLabReducer(runFor(session(SECTION_1, 1), 6), learnerPause)
    expect(inspection(second)).toBeUndefined()
    expect(labReadyToCompare(second)).toBe(false)
    // Section 1 before its experiment has started (the reading step's playback row).
    let reading = learningLabReducer(createLabSession(SECTION_1, DEVICE), learnerRun)
    for (let t = 0; t < EXPIRATORY_SECONDS - 1e-9; t += 0.1)
      reading = learningLabReducer(reading, tick)
    expect(outwardFlow(lastSample(reading))).toBe(true)
    reading = learningLabReducer(reading, learnerPause)
    expect(reading.phase).toBe('explore')
    expect(inspection(reading)).toBeUndefined()
  })

  it('6 · rendered: Run and Pause on the reading step leave the experiment step with nothing done', () => {
    mount(SECTION_1)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    runSeconds(EXPIRATORY_SECONDS)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    chooseStep(2)
    expect(stage()).toBe('awaiting-action')
    expect(screen.getByRole('button', { name: 'Capture result' })).toBeDisabled()
  })

  it('7 · advancing one breath is not a pause, wherever it leaves the breath', () => {
    // Paused by the learner too early to count (under four seconds), then stepped one breath on:
    // the model is paused, past four seconds, in expiration with gas leaving — and nobody paused.
    const early = learningLabReducer(runFor(session(SECTION_1, 0), 2), learnerPause)
    expect(inspection(early)).toBeUndefined()
    const stepped = learningLabReducer(early, engine({ type: 'STEP_BREATH' }))
    expect(stepped.simulation.paused).toBe(true)
    expect(stepped.simulation.simulationTime).toBeGreaterThanOrEqual(4)
    expect(outwardFlow(lastSample(stepped))).toBe(true)
    expect(inspection(stepped)).toBeUndefined()
    expect(labReadyToCompare(stepped)).toBe(false)
    expect(stepped.pauseOrigin ?? null).toBeNull()
  })

  it('7 · rendered: one-breath stepping with automatic capture on captures nothing', () => {
    mount(SECTION_1)
    chooseStep(2)
    fireEvent.click(screen.getByRole('checkbox', { name: /Capture automatically/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    runSeconds(2)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Advance one breath' }))
    fireEvent.click(screen.getByRole('button', { name: 'Advance one breath' }))
    expect(stage()).toBe('awaiting-action')
    expect(document.querySelector('[data-captured-result]')).toBeNull()
  })

  it('8 · a reset, a restart or a new round clears the pause origin and the inspection', () => {
    const suspended = learningLabReducer(expiratoryInstant(), backgroundPause)
    const inspected = learningLabReducer(expiratoryInstant(), learnerPause)
    expect(inspection(inspected)).toBeDefined()
    for (const before of [suspended, inspected])
      for (const action of [
        { type: 'RESET' },
        { type: 'RESTART' },
        { type: 'OPEN_ROUND', round: 1 },
        { type: 'DEVICE', device: 'puritan-bennett-980' },
      ] as const) {
        const after = learningLabReducer(before, action)
        expect(after.pauseOrigin ?? null).toBeNull()
        expect(inspection(after)).toBeUndefined()
        expect(after.readySince).toBeNull()
        expect(labReadyToCompare(after)).toBe(false)
      }
    // Running again ends a background pause's note without granting anything.
    const resumed = learningLabReducer(suspended, learnerRun)
    expect(resumed.pauseOrigin ?? null).toBeNull()
    expect(inspection(resumed)).toBeUndefined()
  })

  it('8 · rendered: Reset patient removes the background-pause note and the automatic-capture choice', () => {
    mount(SECTION_1)
    chooseStep(2)
    fireEvent.click(screen.getByRole('checkbox', { name: /Capture automatically/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    runSeconds(EXPIRATORY_SECONDS)
    setVisibility('hidden')
    setVisibility('visible')
    expect(document.querySelector('[data-background-pause]')).not.toBeNull()
    fireEvent.click(document.querySelector<HTMLElement>('[data-reset-patient]')!)
    expect(document.querySelector('[data-background-pause]')).toBeNull()
    expect(screen.getByRole('checkbox', { name: /Capture automatically/ })).not.toBeChecked()
    expect(stage()).toBe('awaiting-action')
    expect(panel().querySelector('[data-model-time]')?.textContent).toMatch(/0\.0 s/)
  })

  it('reads page visibility in one place, and not in the evidence layer', () => {
    const source = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8')
    for (const file of [
      'engine/learningLab.ts',
      'content/experimentStatus.ts',
      'components/stage/VentilationExperimentPanel.tsx',
    ])
      expect(source(file)).not.toMatch(/visibilityState|document\.hidden/)
    expect(source('components/stage/useVentilationLabSession.ts')).toMatch(/origin: 'background'/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * The capture gate: what evidence a captured result is guaranteed to have
 * ---------------------------------------------------------------------------------------------- */

describe('capture gate: a result is captured only with a complete breath delivered under the change', () => {
  const changeRounds = ventilationLearningExperiments.flatMap((experiment) =>
    ([0, 1] as const)
      .filter(
        (round) =>
          !experiment.rounds[round].goals.some(
            (goal) => goal.type === 'pause-expiration' || goal.type === 'inspect-inspiration',
          ),
      )
      .map((round) => [experiment.unitId, round] as const),
  )

  it.each(changeRounds)(
    '%s application %i: whenever capture is open, the drawn breath began after everything was in place',
    (unitId, round) => {
      const goals = ventilationExperimentByUnit.get(unitId)!.rounds[round].goals
      for (const offset of [0, 1.9]) {
        let current = runFor(session(unitId, round), offset)
        if (offset === 0) current = learningLabReducer(current, learnerRun)
        for (const goal of goals) {
          const action = labGoalAction(goal)
          if (action) current = learningLabReducer(current, engine(action))
        }
        let steps = 0
        while (!labReadyToCompare(current) && steps < 6000) {
          current = learningLabReducer(current, tick)
          steps += 1
        }
        expect(labReadyToCompare(current)).toBe(true)
        // At first readiness and for the next eight model seconds.
        for (let later = 0; later < 80; later += 1) {
          if (labReadyToCompare(current)) {
            const breath = completedBreath(current.simulation.waveforms)
            expect(breath.length).toBeGreaterThanOrEqual(4)
            expect(breath[0].time).toBeGreaterThanOrEqual(current.readySince! - 1e-9)
          }
          current = learningLabReducer(current, tick)
        }
      }
    },
  )

  it('reproduces the gap: Section 11’s first application breathes too slowly for a 12-second record to always hold a breath', () => {
    const unitId = 'waveform-reading-sequence'
    const round = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    let current = learningLabReducer(session(unitId, 0), learnerRun)
    for (const goal of round.goals)
      current = learningLabReducer(current, engine(labGoalAction(goal)!))
    while (!labReadyToCompare(current)) current = learningLabReducer(current, tick)
    let withoutBreath: LabSession | null = null
    for (let later = 0; later < 200 && !withoutBreath; later += 1) {
      current = learningLabReducer(current, tick)
      if (!labRecordHoldsCompleteBreath(current)) withoutBreath = current
    }
    // Everything requested is in place and the interval is long over...
    expect(withoutBreath).not.toBeNull()
    const gap = withoutBreath!
    expect(round.goals.every((goal) => labGoalMet(goal, gap))).toBe(true)
    expect(gap.simulation.simulationTime - gap.readySince!).toBeGreaterThan(round.seconds)
    // ...and the gate stays closed, says why, and refuses a capture with nothing to draw.
    expect(labReadyToCompare(gap)).toBe(false)
    const status = ventilationExperimentStatus(gap)
    expect(status.stage).toBe('awaiting-measurement')
    expect(status.headline).toMatch(/one complete breath on the record/)
    expect(learningLabReducer(gap, { type: 'COMPARE' }).evidence[0].response).toBeUndefined()
  })

  it('says so when a retained record holds no complete breath, instead of asking for a re-capture', () => {
    /*
     * Section 8's first application. Its 12-second opening window is exactly two 6-second cycles
     * and verifies one onset, so it holds no complete breath. The round's baseline is no longer
     * that window alone (`mv-pre-review-03-baseline-evidence.test.tsx`); it is used here as what
     * it is — a real retained record with no breath to draw — so the wording stays covered.
     */
    const unitId = 'triggering-and-cycling'
    const round = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    let current = learningLabReducer(session(unitId, 0), learnerRun)
    for (const goal of round.goals)
      current = learningLabReducer(current, engine(labGoalAction(goal)!))
    while (!labReadyToCompare(current)) current = learningLabReducer(current, tick)
    const captured = learningLabReducer(current, { type: 'COMPARE' })
    expect(completedBreath(captured.evidence[0].response!.waveforms).length).toBeGreaterThan(3)
    const windowOnly = createLabSimulation(unitId, 0, DEVICE).waveforms
    expect(completedBreath(windowOnly)).toHaveLength(0)
    const evidence = {
      ...captured.evidence[0],
      baseline: { ...captured.evidence[0].baseline!, waveforms: windowOnly },
    }
    render(<RecordedBreathComparison evidence={evidence} effort />)
    const note = document.querySelector('[data-no-complete-breath]')!
    expect(note.textContent).toMatch(/Captured baseline: this retained record does not hold/)
    expect(document.body.textContent).not.toMatch(/then capture again/)
    fireEvent.click(screen.getByRole('button', { name: 'Overlay' }))
    expect(document.querySelector('[data-overlay-missing-breath]')?.textContent).toMatch(
      /retained baseline holds no complete breath/,
    )
    expect(document.querySelector('[data-effort-description]')?.textContent).toMatch(
      /Baseline: no complete breath in the record, so its effort row is not described/,
    )
  })
})

/* ------------------------------------------------------------------------------------------------
 * R2 — the instruction names a marker that is on the figure beside it
 * ---------------------------------------------------------------------------------------------- */

describe('R2: Section 1’s experiment step shows the interval its instruction names', () => {
  const marked = /interval ([AB]), marked on the captured breath/
  const markerLines = (root: ParentNode, letter: string) =>
    [...root.querySelectorAll(`[data-breath-marker="${letter}"] line`)].map((line) =>
      line.getAttribute('x1'),
    )

  it('reproduces the report: step 3 says "interval A, marked on the captured breath" — and now it is', () => {
    mount(SECTION_1)
    chooseStep(2)
    expect(card().textContent).toMatch(/Step 3 of 10/)
    const look = card().querySelector('[data-step-look]')!.textContent!
    expect(look).toMatch(marked)
    expect(look).toMatch(/in the Experiment panel/)
    // The line no longer promises the phase-label toggle of the question's worked figure.
    expect(look).not.toMatch(/phase label/)
    const figure = panel().querySelector('[data-captured-breath]')!
    expect(figure.getAttribute('data-marker')).toBe('A')
    expect(figure.getAttribute('data-marker-resolved')).toBe('true')
    // On every row of the figure, and named in its caption.
    expect(markerLines(figure, 'A')).toHaveLength(3)
    expect(figure.querySelectorAll('[data-marker-letter="A"]')).toHaveLength(3)
    expect(figure.querySelector('figcaption')?.textContent).toMatch(/interval A marked/)
    // The lesson's "What to look at" says the same sentence, not a second version.
    expect(document.querySelector('[data-teaching-block="guide"]')?.textContent).toContain(look)
  })

  it('takes the marker’s identity and phase from the Batch-01 evidence contract', () => {
    const marker = ventilationReferenceMarker(SECTION_1, 0)!
    expect(marker).toEqual(ventilationReferenceMarkers[0])
    expect(marker).toMatchObject({ markerId: 'A', stop: 'expiration', phase: 'expiration' })
    const baseline = session(SECTION_1, 0).evidence[0].baseline!
    const evidence = markerEvidence(completedBreath(baseline.waveforms), marker)!
    expect(evidence.sample.phase).toBe('expiration')
    expect(evidence.flowLMin).toBeLessThan(0)
    expect(evidence.volumeChangeMl).toBeLessThan(0)

    mount(SECTION_1)
    chooseStep(2)
    // The figure prints the sentence the contract builds from these samples...
    expect(panel().querySelector('[data-marker-note="A"]')?.textContent).toBe(
      markerEvidenceSentence(evidence),
    )
    // ...and it is the same interval, on the same breath, as the question's worked reference.
    chooseStep(1)
    expect(card().querySelector('[data-marker-note="A"]')?.textContent).toBe(
      markerEvidenceSentence(evidence),
    )
  })

  it('keeps the exploration cursor independent of the marker', () => {
    mount(SECTION_1)
    chooseStep(2)
    const figure = panel().querySelector('[data-captured-breath]')!
    const before = markerLines(figure, 'A')
    const cursor = () =>
      figure.querySelector('[data-time-cursor]')!.getAttribute('data-time-cursor')
    const cursorBefore = cursor()
    const slider = within(figure as HTMLElement).getByRole('slider', {
      name: 'Exploration cursor, separate from interval A',
    })
    fireEvent.change(slider, { target: { value: '40' } })
    expect(cursor()).not.toBe(cursorBefore)
    expect(markerLines(figure, 'A')).toEqual(before)
    // Using the chosen interval is still the learner's own inspection, wherever the marker is.
    fireEvent.change(slider, { target: { value: '120' } })
    fireEvent.click(
      within(figure as HTMLElement).getByRole('button', { name: /Use this captured/ }),
    )
    expect(stage()).toBe('ready')
  })

  it('never prints "marked on the captured breath" on a card that shows no marker', () => {
    const lesson = mount(SECTION_1)
    const check = () => {
      const named = card().textContent?.match(marked)
      if (named)
        expect(
          card().querySelectorAll(`[data-breath-marker="${named[1]}"]`).length,
        ).toBeGreaterThan(0)
      return Boolean(named)
    }
    // Every step as first reached, then the experiment steps again after a capture.
    const seen = lesson.steps.map((_, index) => {
      chooseStep(index)
      return check()
    })
    expect(seen.filter(Boolean).length).toBeGreaterThanOrEqual(4)
    chooseStep(2)
    const figure = panel().querySelector('[data-captured-breath]') as HTMLElement
    fireEvent.change(within(figure).getByRole('slider'), { target: { value: '120' } })
    fireEvent.click(within(figure).getByRole('button', { name: /Use this captured/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Capture result' }))
    for (const index of [2, 3, 4]) {
      chooseStep(index)
      expect(check()).toBe(false)
      expect(card().querySelector('[data-step-look]')?.textContent).toBe(
        markedIntervalLook('A', 'captured'),
      )
    }
  })

  it('names the figure by what is on screen: not started, open, captured', () => {
    mount(SECTION_1)
    // Straight to the observe step: this application's baseline has not been captured yet.
    chooseStep(3)
    expect(panel().querySelector('[data-captured-breath]')).toBeNull()
    expect(card().querySelector('[data-step-look]')?.textContent).toBe(
      markedIntervalLook('A', 'not-started'),
    )
    fireEvent.click(screen.getByRole('button', { name: /Start the experiment/ }))
    expect(card().querySelector('[data-step-look]')?.textContent).toBe(
      markedIntervalLook('A', 'open'),
    )
    expect(panel().querySelectorAll('[data-breath-marker="A"]')).toHaveLength(3)
    expect(inspectionFigureState(session(SECTION_1, 0))).toBe('open')
    expect(inspectionFigureState(session(SECTION_2, 0))).toBeNull()
  })

  it('does the same for interval B on the second application', () => {
    const lesson = mount(SECTION_1)
    const index = lesson.steps.findIndex(
      (step) => step.interaction.kind === 'simulator-task' && step.interaction.round === 1,
    )
    chooseStep(index)
    expect(card().querySelector('[data-step-look]')?.textContent).toMatch(
      /interval B, marked on the captured breath in the Experiment panel/,
    )
    const figure = panel().querySelector('[data-captured-breath]')!
    expect(figure.getAttribute('data-marker')).toBe('B')
    expect(figure.querySelectorAll('[data-breath-marker="B"]')).toHaveLength(3)
    const marker = ventilationReferenceMarker(SECTION_1, 1)!
    const evidence = markerEvidence(
      completedBreath(session(SECTION_1, 1).evidence[1].baseline!.waveforms),
      marker,
    )!
    expect(evidence.sample.phase).toBe('inspiration')
  })

  it('changes no answer key, option or authored look line', () => {
    const [first, second] = ventilationExperimentByUnit.get(SECTION_1)!.rounds
    expect(first.choices).toEqual(['Expiration', 'Inspiration', 'A no-flow occlusion'])
    expect(first.correct).toBe(0)
    expect(second.choices).toEqual(['A no-flow occlusion', 'Expiration', 'Inspiration'])
    expect(second.correct).toBe(2)
    expect(first.look).toMatch(/^Read all three traces at interval A, marked on the captured/)
    expect(first.goals).toEqual([{ type: 'pause-expiration' }])
    expect(second.goals).toEqual([{ type: 'inspect-inspiration' }])
    // The question step still reads the authored line beside its own marked, guided reference.
    mount(SECTION_1)
    chooseStep(1)
    expect(card().querySelector('[data-step-look]')?.textContent).toBe(first.look)
    expect(card().querySelector('[data-captured-breath]')?.getAttribute('data-marker')).toBe('A')
    expect(card().querySelector('[data-phase-label]')).not.toBeNull()
  })
})

/* ------------------------------------------------------------------------------------------------
 * R3 — the origin is the first recorded inspiratory sample, and is called that
 * ---------------------------------------------------------------------------------------------- */

describe('R3: the figures name their origin as what was sampled', () => {
  const captured = () => {
    const ready = runFor(
      session(SECTION_2, 0, engine({ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 60 })),
      12.2,
    )
    return learningLabReducer(ready, { type: 'COMPARE' })
  }
  const BREATH_START = /breath(’|')?s? start|from breath start/i

  it('measures the origin the review measured: 0.7 mL before, about 14 mL at it, one 13-mL step', () => {
    const record = createLabSimulation(SECTION_2, 0, DEVICE).waveforms
    const breath = completedBreath(record)
    const origin = breathOriginFacts(record, breath)!
    expect(origin.precedingMl).toBeCloseTo(0.7, 0)
    expect(origin.originMl).toBeGreaterThan(13.9)
    expect(origin.originMl).toBeLessThan(14.2)
    expect(origin.firstStepMl).toBeCloseTo(13.3, 0)
    // The first sample is already inspiratory flow at the set rate: one 20-ms step of 40 L/min.
    expect(breath[0].phase).toBe('inspiration')
    expect(breath[0].flowLMin).toBeCloseTo(40, 0)
    expect((40 / 60) * 0.02 * 1000).toBeCloseTo(13.3, 1)
  })

  it('labels the row, the time axis and the captions with that origin, in both views, zoomed or not', () => {
    const { evidence } = captured()
    render(<RecordedBreathComparison evidence={evidence[0]} />)
    const text = () => document.querySelector('[data-recorded-breath-comparison]')!.textContent!
    const rowLabels = () =>
      [...document.querySelectorAll('[data-row-label="volumeMl"]')].map((node) => node.textContent)
    const axisTitles = () =>
      [...document.querySelectorAll('[data-time-axis]')].map((node) => node.textContent)

    expect(rowLabels()).toEqual([BREATH_ROW_LABELS.volumeMl, BREATH_ROW_LABELS.volumeMl])
    expect(BREATH_ROW_LABELS.volumeMl).toBe('Volume from first inspiratory sample (mL)')
    expect(axisTitles()).toEqual([BREATH_TIME_AXIS_LABEL, BREATH_TIME_AXIS_LABEL])
    expect(BREATH_TIME_AXIS_LABEL).toBe('Time from first recorded inspiratory sample (s)')
    expect(text()).not.toMatch(BREATH_START)
    expect(text()).toMatch(/a convention of the sampled trace, not the instant inspiration began/)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom to inspiration' }))
    expect(axisTitles()).toEqual([
      `${BREATH_TIME_AXIS_LABEL} · zoomed`,
      `${BREATH_TIME_AXIS_LABEL} · zoomed`,
    ])
    expect(document.querySelector('[data-zoom-bounds]')?.textContent).toMatch(
      /from each breath’s first recorded inspiratory sample/,
    )
    expect(text()).not.toMatch(BREATH_START)

    fireEvent.click(screen.getByRole('button', { name: 'Overlay' }))
    expect(rowLabels()).toEqual([BREATH_ROW_LABELS.volumeMl])
    expect(axisTitles()).toEqual([`${BREATH_TIME_AXIS_LABEL} · zoomed`])
    expect(document.querySelector('[data-breath-overlay] figcaption')?.textContent).toMatch(
      /each from its own first recorded inspiratory sample/,
    )
    expect(text()).not.toMatch(BREATH_START)
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole breath' }))
    expect(axisTitles()).toEqual([BREATH_TIME_AXIS_LABEL])
    expect(text()).not.toMatch(BREATH_START)
  })

  it('states the step the first sample holds, and both the received volume and the drawn rise', () => {
    const { evidence } = captured()
    render(<RecordedBreathComparison evidence={evidence[0]} />)
    const anchors = [...document.querySelectorAll('[data-volume-anchor]')]
    expect(anchors).toHaveLength(2)
    expect(anchors[0].getAttribute('data-first-step-ml')).toMatch(/^13\.[34]$/)
    expect(anchors[0].textContent).toMatch(
      /raw lung volume was 0\.\d mL above the trace baseline in the sample before it and 14\.\d mL in it\. The drawn rise is therefore about 13 mL less than the volume this breath received/,
    )
    const description = document.querySelector('[data-comparison-description]')!.textContent!
    expect(description).toMatch(/counted from each breath’s first recorded inspiratory sample/)
    // 413 or 427 mL received, drawn rising 400 or 413: the real alternation, not forced equal.
    const baseline = description.match(
      /Baseline breath drawn above:.*?it received (\d+) mL.*?its drawn volume rises (\d+) mL, because the first inspiratory sample it is drawn from already holds (\d+) mL/,
    )!
    expect([413, 427]).toContain(Number(baseline[1]))
    expect([400, 413]).toContain(Number(baseline[2]))
    expect(Number(baseline[1]) - Number(baseline[2])).toBeGreaterThanOrEqual(13)
    expect(Number(baseline[1]) - Number(baseline[2])).toBeLessThanOrEqual(14)
    expect(Number(baseline[3])).toBe(13)
  })

  it('changes nothing that was sampled: no added sample, no moved time, no altered volume', () => {
    const { evidence } = captured()
    const before = JSON.stringify(evidence)
    const record = evidence[0].baseline!.waveforms
    const breath = completedBreath(record)
    render(<CapturedBreath label="Captured baseline" samples={record} />)
    // One drawn vertex per sample of the breath, the first at the left edge of the plot.
    const path = document.querySelector('[data-captured-breath] path')!.getAttribute('d')!
    expect(path.match(/[ML]/g)).toHaveLength(breath.length)
    expect(path.startsWith('M50.00 ')).toBe(true)
    expect(JSON.stringify(evidence)).toBe(before)
    expect(record[record.indexOf(breath[0])].volumeMl).toBeGreaterThan(13.9)
  })

  it('S2-1: says the 0.63-s reading is calculated and the 0.62 / 0.64 s are sampled', () => {
    const baseline = createLabSimulation(SECTION_2, 0, DEVICE)
    expect(baseline.measurements.mechanicalInspiratoryTimeSeconds).toBe(0.63)
    expect(inspiratoryTimeStepNote(baseline)).toBe(
      'Calculated from the settings, not timed on the trace: 420 mL at 40 L/min is 0.63 s of inspiratory flow. The trace is sampled every 20 ms, so a drawn breath shows flow for 31 or 32 samples: 0.62 or 0.64 s.',
    )
    const { evidence, simulation } = captured()
    // At 60 L/min the flow time is a whole number of steps: provenance only, no second figure.
    expect(inspiratoryTimeStepNote(simulation)).toBe(
      'Calculated from the settings, not timed on the trace: 420 mL at 60 L/min is 0.42 s of inspiratory flow.',
    )
    render(<RecordedBreathComparison evidence={evidence[0]} />)
    expect(document.querySelector('[data-comparison-description]')!.textContent).toMatch(
      /Baseline breath drawn above: inspiratory flow over 3[12] samples \(0\.6[24] s as sampled\)/,
    )
    expect(document.querySelector('[data-inspiratory-time-note]')!.textContent).toBe(
      'The Inspiratory time reading (0.63 s before, 0.42 s after) is calculated from the selected volume and flow; it is not timed on the trace. The sampled flow times above are what the drawn breaths show, to the nearest 20-ms sample.',
    )
  })

  it('S2-1: the observation feedback names the reading as calculated, with the same question and key', () => {
    const item = observationFor(captured())
    expect(item.prompt).toBe(
      'Compared with the captured baseline, what happened to inspiratory time in this controlled experiment?',
    )
    expect(item.correct).toBe('fell')
    expect(item.choices.map((choice) => choice.id)).toEqual([
      'rose',
      'fell',
      'similar',
      'indeterminate',
    ])
    expect(item.feedback).toMatch(
      /^Recorded inspiratory time \(the reading calculated from the settings\): 0\.63 → 0\.42 s\. The recorded value fell\./,
    )
  })

  it('S2-1: labels the reading "calculated" in the live readings and the captured table', () => {
    mount(SECTION_2)
    chooseStep(2)
    const reading = document.querySelector('[data-live-readings] [data-metric="ti"]')!
    expect(reading.querySelector('dt')?.textContent).toBe('Inspiratory time · calculated')
    expect(reading.querySelector('[data-inspiratory-time-step-note]')?.textContent).toMatch(
      /0\.62 or 0\.64 s/,
    )
    fireEvent.change(document.getElementById('mv-quick-peakFlowLMin')!, { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    runSeconds(14)
    fireEvent.click(screen.getByRole('button', { name: 'Capture result' }))
    const headers = [...document.querySelectorAll('[data-captured-result] tbody th')].map((th) =>
      th.textContent?.replace(/\s+/g, ' '),
    )
    expect(headers).toContain('Inspiratory time · calculated (s)')
  })

  it('wraps the longer row label on a narrow figure instead of letting it spill', () => {
    const labels = [
      BREATH_ROW_LABELS.pawCmH2O,
      BREATH_ROW_LABELS.flowLMin,
      BREATH_ROW_LABELS.volumeMl,
    ]
    const wide = breathRowLayout(labels, 360)
    expect(wide.labels.map((lines) => lines.length)).toEqual([1, 1, 1])
    expect([wide.pitch, wide.plotTop, wide.rowsHeight]).toEqual([85, 15, 255])
    const narrow = breathRowLayout(labels, 230)
    expect(narrow.labels[2]).toEqual(['Volume from first', 'inspiratory sample (mL)'])
    expect(narrow.labels[0]).toEqual([BREATH_ROW_LABELS.pawCmH2O])
    expect([narrow.pitch, narrow.plotTop]).toEqual([100, 30])
  })
})

/* ------------------------------------------------------------------------------------------------
 * R4 — the reveal request belongs to one same-tab navigation and its destination
 * ---------------------------------------------------------------------------------------------- */

describe('R4: a section’s heading is revealed only for the navigation that asked for it', () => {
  const next = (unitId: string) =>
    ventilationLearningUnits[ventilationLearningUnits.findIndex((u) => u.id === unitId) + 1]
  const page: { show: (unitId: string) => void } = { show: () => {} }
  const navigate = (unitId: string) => page.show(unitId)
  /* The Learn page as the router sees it: a new activity is a new, keyed host. */
  function Page({ initial }: { initial: string }) {
    const [unitId, setUnitId] = useState(initial)
    useEffect(() => {
      page.show = setUnitId
    }, [])
    return <VentilationStageHost key={unitId} unitId={unitId} />
  }
  const open = (unitId: string) => {
    render(<Page initial={unitId} />)
    boot()
  }
  /** A router that navigates: the push re-renders the page at the new activity. */
  const routerNavigates = () =>
    mockPush.mockImplementation((target: { query: { activity: string } }) =>
      navigate(target.query.activity),
    )
  const arriveBy = (unitId: string) => {
    act(() => navigate(unitId))
    boot()
  }
  const lastStepLink = (unitId: string) => {
    chooseStep(ventilationStageLesson(unitId).steps.length - 1)
    return screen.getByRole('link', { name: `Continue to ${next(unitId).title}` })
  }
  const focused = () => document.activeElement === heading()

  it('is taken once, by the section it names, and by no other', () => {
    requestTaskHeadingReveal(SECTION_2)
    expect(consumeTaskHeadingReveal(SECTION_1)).toBe(false)
    // An arrival somewhere else does not use it up either: it was not that arrival's request.
    expect(consumeTaskHeadingReveal(SECTION_2)).toBe(true)
    expect(consumeTaskHeadingReveal(SECTION_2)).toBe(false)
  })

  it('is withdrawn by its own navigation failing, by back or forward, and by age', () => {
    requestTaskHeadingReveal(SECTION_2)
    cancelTaskHeadingReveal(SECTION_1) // another handler's cancel does not reach it
    cancelTaskHeadingReveal(SECTION_2)
    expect(consumeTaskHeadingReveal(SECTION_2)).toBe(false)

    requestTaskHeadingReveal(SECTION_2)
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(consumeTaskHeadingReveal(SECTION_2)).toBe(false)

    requestTaskHeadingReveal(SECTION_2)
    jest.advanceTimersByTime(15_001)
    expect(consumeTaskHeadingReveal(SECTION_2)).toBe(false)
  })

  it('counts only an activation that navigates this tab', () => {
    const link = document.createElement('a')
    expect(activatesThisTab({ button: 0, currentTarget: link })).toBe(true)
    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)
      expect(activatesThisTab({ button: 0, [modifier]: true, currentTarget: link })).toBe(false)
    expect(activatesThisTab({ button: 1, currentTarget: link })).toBe(false)
    link.target = '_blank'
    expect(activatesThisTab({ button: 0, currentTarget: link })).toBe(false)
    link.target = '_self'
    expect(activatesThisTab({ button: 0, currentTarget: link })).toBe(true)
  })

  it('ordinary same-tab Continue to the next section lands on its heading', () => {
    routerNavigates()
    open(SECTION_1)
    const link = lastStepLink(SECTION_1)
    // A plain click is handled here, through the router; the browser does not also follow the href.
    expect(fireEvent.click(link)).toBe(false)
    boot()
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/mechanical-ventilation/learn',
      query: { activity: SECTION_2 },
    })
    expect(heading()).toHaveTextContent(ventilationStageLesson(SECTION_2).steps[0].title)
    expect(focused()).toBe(true)
  })

  it('the same-tab section chooser lands on the chosen section’s heading', () => {
    routerNavigates()
    open(SECTION_1)
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose section' }), {
      target: { value: SECTION_7 },
    })
    boot()
    expect(heading()).toHaveTextContent(ventilationStageLesson(SECTION_7).steps[0].title)
    expect(focused()).toBe(true)
  })

  it.each([
    ['Command-click', { metaKey: true }],
    ['Ctrl-click', { ctrlKey: true }],
    ['Shift-click', { shiftKey: true }],
    ['Alt-click', { altKey: true }],
    ['middle click', { button: 1 }],
  ])('reproduces the report: %s leaves no request in this tab', (_name, init) => {
    routerNavigates()
    open(SECTION_1)
    const link = lastStepLink(SECTION_1)
    link.focus()
    // Left to the browser, which opens the destination elsewhere: not prevented, not pushed.
    expect(fireEvent.click(link, init)).toBe(true)
    boot()
    expect(mockPush).not.toHaveBeenCalled()
    expect(heading()).toHaveTextContent(ventilationStageLesson(SECTION_1).steps.at(-1)!.title)
    // Then this tab goes somewhere by other means, within the old 15-second window: the very
    // section the link pointed at, and an unrelated one. Neither takes focus.
    runSeconds(3)
    arriveBy(SECTION_2)
    expect(heading()).toHaveTextContent(ventilationStageLesson(SECTION_2).steps[0].title)
    expect(focused()).toBe(false)
    arriveBy(SECTION_7)
    expect(focused()).toBe(false)
    expect(scrollIntoView).toHaveBeenCalledTimes(1) // the step chooser, before the click
  })

  it('a link that opens its own context is left alone as well', () => {
    routerNavigates()
    open(SECTION_1)
    const link = lastStepLink(SECTION_1)
    link.setAttribute('target', '_blank')
    expect(fireEvent.click(link)).toBe(true)
    boot()
    expect(mockPush).not.toHaveBeenCalled()
    arriveBy(SECTION_2)
    expect(focused()).toBe(false)
  })

  it('a navigation that does not happen leaves nothing for a later arrival', () => {
    // The router accepts the push and goes nowhere: the origin section is still on screen.
    open(SECTION_1)
    fireEvent.click(lastStepLink(SECTION_1))
    boot()
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(heading()).toHaveTextContent(ventilationStageLesson(SECTION_1).steps.at(-1)!.title)
    // Seconds later the learner reaches that section another way. It is an ordinary arrival.
    runSeconds(2)
    arriveBy(SECTION_2)
    expect(focused()).toBe(false)
  })

  it('an unrelated arrival inside the request’s lifetime is not focused', () => {
    requestTaskHeadingReveal(SECTION_2)
    open(SECTION_7)
    expect(focused()).toBe(false)
    runSeconds(5)
    arriveBy(SECTION_1)
    expect(focused()).toBe(false)
  })

  it('back and forward after an arrival do not focus again', () => {
    routerNavigates()
    open(SECTION_1)
    fireEvent.click(lastStepLink(SECTION_1))
    boot()
    expect(focused()).toBe(true)
    // Back to the section it came from, then forward again: plain arrivals, both.
    arriveBy(SECTION_1)
    expect(focused()).toBe(false)
    arriveBy(SECTION_2)
    expect(focused()).toBe(false)
  })

  it('rapid same-tab choices reveal the section that is finally shown', () => {
    // The first push is overtaken before it lands; only the second navigates.
    mockPush
      .mockImplementationOnce(() => {})
      .mockImplementation((target: { query: { activity: string } }) =>
        navigate(target.query.activity),
      )
    open(SECTION_1)
    const chooser = screen.getByRole('combobox', { name: 'Choose section' })
    act(() => {
      fireEvent.change(chooser, { target: { value: SECTION_2 } })
      fireEvent.change(chooser, { target: { value: SECTION_7 } })
    })
    boot()
    expect(heading()).toHaveTextContent(ventilationStageLesson(SECTION_7).steps[0].title)
    expect(focused()).toBe(true)
    // And the overtaken destination, reached later, is an ordinary arrival.
    arriveBy(SECTION_2)
    expect(focused()).toBe(false)
  })

  it('still moves nothing on Run, Pause, capture, ticks, overlay or zoom', () => {
    mount(SECTION_2)
    chooseStep(2)
    const calls = scrollIntoView.mock.calls.length
    const run = screen.getByRole('button', { name: 'Run experiment' })
    run.focus()
    fireEvent.change(document.getElementById('mv-quick-peakFlowLMin')!, { target: { value: '60' } })
    fireEvent.click(run)
    runSeconds(14)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Capture result' }))
    fireEvent.click(screen.getByRole('button', { name: 'Overlay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to inspiration' }))
    runSeconds(2)
    expect(scrollIntoView.mock.calls.length).toBe(calls)
    expect(focused()).toBe(false)
  })

  describe('the pinned-chrome measurement ignores what is not painted', () => {
    type Box = { top: number; bottom: number; width: number }
    type Style = { position: string; top?: string; visibility?: string; opacity?: string }
    const boxes = new Map<Element, Box>()
    const styles = new Map<Element, Style>()
    const originalRect = Element.prototype.getBoundingClientRect
    let computed: jest.SpyInstance
    /* jsdom lays nothing out and does not know `position: sticky`, so both are stated here. */
    function pinned(style: Style, box: Box) {
      const element = document.createElement('div')
      document.body.appendChild(element)
      boxes.set(element, box)
      styles.set(element, style)
      return element
    }
    beforeEach(() => {
      boxes.clear()
      styles.clear()
      Element.prototype.getBoundingClientRect = function (this: Element) {
        const box = boxes.get(this) ?? { top: 0, bottom: 0, width: 0 }
        return {
          ...box,
          left: 0,
          right: box.width,
          height: box.bottom - box.top,
          x: 0,
          y: box.top,
          toJSON: () => box,
        } as DOMRect
      }
      const real = window.getComputedStyle.bind(window)
      computed = jest.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
        const style = styles.get(element)
        if (!style) return real(element)
        return {
          display: 'block',
          visibility: 'visible',
          opacity: '1',
          top: 'auto',
          ...style,
        } as unknown as CSSStyleDeclaration
      })
    })
    afterEach(() => {
      computed.mockRestore()
      Element.prototype.getBoundingClientRect = originalRect
      document.body.innerHTML = ''
    })

    it('uses the visible site header and not a hidden fixed or unstuck sticky element', () => {
      const across = window.innerWidth
      pinned({ position: 'sticky', top: '0px' }, { top: 0, bottom: 81, width: across })
      expect(pinnedTopInset()).toBe(81)
      // What the review injected: taller boxes across the top that paint nothing.
      const tall = { top: 0, bottom: 300, width: across }
      pinned({ position: 'fixed', top: '0px', visibility: 'hidden' }, tall)
      pinned({ position: 'fixed', top: '0px', opacity: '0' }, tall)
      // A sticky element with no top offset is not held at the top edge; it is content passing.
      pinned({ position: 'sticky' }, tall)
      expect(pinnedTopInset()).toBe(81)
      // The exclusions that were already there still hold: a corner badge, a tall panel.
      pinned({ position: 'fixed', top: '0px' }, { top: 0, bottom: 200, width: across * 0.2 })
      pinned(
        { position: 'fixed', top: '0px' },
        { top: 0, bottom: window.innerHeight, width: across },
      )
      expect(pinnedTopInset()).toBe(81)
      // A second painted bar pinned under the header does count.
      pinned({ position: 'fixed', top: '0px' }, { top: 0, bottom: 120, width: across })
      expect(pinnedTopInset()).toBe(120)
    })
  })
})

/* ------------------------------------------------------------------------------------------------
 * R5 — the console's value column grows with the reader's text and cannot cover the labels
 * ---------------------------------------------------------------------------------------------- */

describe('R5: the console’s monitored-value column at enlarged text (module-local)', () => {
  const css = readFileSync(
    path.join(__dirname, '../components/mechanical-ventilation.module.css'),
    'utf8',
  )
  const rule = (selector: string) => {
    const start = css.indexOf(`${selector} {`)
    expect(start).toBeGreaterThanOrEqual(0)
    return css.slice(start, css.indexOf('}', start))
  }

  it('reproduces the cause: the column floors were pixels; they are rem now, same size at 16 px', () => {
    const columns = [
      ['.monitoringScreen', 'minmax(0, 1fr) minmax(6.5625rem, 0.19fr)', 105],
      [".monitoringScreen[data-layout='left-column']", 'minmax(7rem, 0.2fr) minmax(0, 1fr)', 112],
      [
        ".monitoringScreen[data-layout='right-column']",
        'minmax(0, 1fr) minmax(8.25rem, 0.24fr)',
        132,
      ],
    ] as const
    for (const [selector, value, pixelsAtDefault] of columns) {
      expect(rule(selector)).toContain(`grid-template-columns: ${value};`)
      expect(Number(value.match(/([\d.]+)rem/)![1]) * 16).toBe(pixelsAtDefault)
    }
    // No monitoring-screen column is sized in px anywhere, the phone rule included.
    for (const match of css.matchAll(
      /\.monitoringScreen[^{]*\{[^}]*grid-template-columns:([^;]+);/g,
    ))
      expect(match[1]).not.toMatch(/\dpx/)
  })

  it('reflows by the screen’s own width, last in the file so viewport rules cannot undo it', () => {
    expect(rule('.consoleScreen')).toContain('container: mv-console-screen / inline-size;')
    const start = css.lastIndexOf('@container mv-console-screen (max-width: 16rem)')
    expect(start).toBeGreaterThan(0)
    const block = css.slice(start)
    expect(block).toMatch(
      /\.monitoringScreen\[data-layout='left-column'\],[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    )
    // Nothing follows it, and it changes layout only: no font size is reduced to make room.
    expect(block.trimEnd().endsWith('}')).toBe(true)
    expect(css.slice(start).match(/@media|@container/g)).toHaveLength(1)
    expect(block).not.toMatch(/font-size/)
    // The site header is not this module's to restyle.
    expect(css).not.toMatch(/(^|\n)\s*(body > )?header\b/)
  })

  it('lets a slash-joined readout label wrap after the slash without changing its text', () => {
    const samples = createLabSimulation(SECTION_2, 0, DEVICE).waveforms
    const { container } = render(
      <WaveformStrip
        label="Paw"
        unit="cmH₂O"
        field="pawCmH2O"
        samples={samples}
        minimum={0}
        maximum={60}
        readouts={[
          { label: 'PEEP/CPAP', value: 12 },
          { label: 'Ppeak', value: 58 },
        ]}
      />,
    )
    const [peep, peak] = [...container.querySelectorAll('dt')]
    expect(peep.textContent).toBe('PEEP/CPAP')
    expect(peep.querySelectorAll('wbr')).toHaveLength(1)
    expect(peak.querySelector('wbr')).toBeNull()
    // The value still cannot break between its digits (V4).
    expect(rule('.waveformReadouts dd')).toContain('white-space: nowrap;')
  })
})

/* ------------------------------------------------------------------------------------------------
 * R6 — the effort row has a text equivalent, and the time-axis title cannot hit a tick
 * ---------------------------------------------------------------------------------------------- */

describe('R6: the effort row in words, and the time axis on a narrow figure', () => {
  /* Section 7's second application: the cycle-off change, captured as the Learn host captures it. */
  const captured = () => {
    const round = ventilationExperimentByUnit.get(SECTION_7)!.rounds[1]
    let current = learningLabReducer(session(SECTION_7, 1), learnerRun)
    for (const goal of round.goals)
      current = learningLabReducer(current, engine(labGoalAction(goal)!))
    while (!labReadyToCompare(current)) current = learningLabReducer(current, tick)
    return learningLabReducer(current, { type: 'COMPARE' }).evidence[1]
  }
  /* The same facts, read off the record independently of the module under test. */
  function independent(record: readonly WaveformSample[]) {
    const breath = completedBreath(record)
    const origin = breath[0].time
    const active = breath.filter((s) => -s.pmusCmH2O >= EFFORT_DETECTION_FLOOR_CMH2O)
    const peak = active.reduce((a, b) => (-b.pmusCmH2O > -a.pmusCmH2O ? b : a))
    return {
      from: active[0].time - origin,
      to: active.at(-1)!.time - origin,
      peak: -peak.pmusCmH2O,
      peakAt: peak.time - origin,
      firstExpiratory: breath.find((s) => s.phase === 'expiration')!.time - origin,
    }
  }

  it('reproduces the report: the description had pressure, flow and volume and no effort', () => {
    const evidence = captured()
    render(<RecordedBreathComparison evidence={evidence} effort />)
    fireEvent.click(screen.getByRole('button', { name: 'Overlay' }))
    // The row is drawn...
    expect(document.querySelectorAll('[data-row-label="pmusCmH2O"]')).toHaveLength(1)
    // ...the first description still covers the other three...
    expect(document.querySelector('[data-comparison-description]')!.textContent).not.toMatch(
      /effort/i,
    )
    // ...and the effort row now has its own.
    expect(document.querySelector('[data-effort-description]')).not.toBeNull()
  })

  it('describes baseline and result effort timing from the retained samples', () => {
    const evidence = captured()
    for (const [name, record] of [
      ['Baseline', evidence.baseline!.waveforms],
      ['Result', evidence.response!.waveforms],
    ] as const) {
      const expected = independent(record)
      const facts = modeledEffortFacts(record)!
      expect(facts.intervals).toHaveLength(1)
      expect(facts.intervals[0].fromSeconds).toBeCloseTo(expected.from, 6)
      expect(facts.intervals[0].toSeconds).toBeCloseTo(expected.to, 6)
      expect(facts.intervals[0].peakCmH2O).toBeCloseTo(expected.peak, 6)
      expect(facts.firstExpiratorySeconds).toBeCloseTo(expected.firstExpiratory, 6)
      const text = describeModeledEffort(name, record)
      const gap = expected.firstExpiratory - expected.to
      expect(text).toBe(
        `${name} breath: modeled effort is first at or above ${EFFORT_DETECTION_FLOOR_CMH2O} cmH₂O ${expected.from.toFixed(2)} s after the first recorded inspiratory sample, last at or above it at ${expected.to.toFixed(2)} s (largest ${expected.peak.toFixed(1)} cmH₂O at ${expected.peakAt.toFixed(2)} s); that is ${gap.toFixed(2)} s before the machine’s first expiratory sample. Machine inspiration, on the same axis, runs from 0.00 s to its first expiratory sample at ${expected.firstExpiratory.toFixed(2)} s.`,
      )
    }
    // The change this application makes is in the text: machine inspiration ends sooner in the
    // result while the modeled effort is where it was.
    const before = modeledEffortFacts(evidence.baseline!.waveforms)!
    const after = modeledEffortFacts(evidence.response!.waveforms)!
    expect(after.firstExpiratorySeconds!).toBeLessThan(before.firstExpiratorySeconds!)
    expect(after.intervals[0].toSeconds).toBeCloseTo(before.intervals[0].toSeconds, 6)
  })

  it('calls it a modeled signal, claims no cause and no measured delay, in both views', () => {
    const evidence = captured()
    render(<RecordedBreathComparison evidence={evidence} effort />)
    for (const view of ['Side by side', 'Overlay'] as const) {
      fireEvent.click(screen.getByRole('button', { name: view }))
      const text = document.querySelector('[data-effort-description]')!.textContent!
      expect(text).toMatch(/modeled signal, not a measurement from a patient/)
      expect(text).toMatch(/Baseline breath: modeled effort is/)
      expect(text).toMatch(/Result breath: modeled effort is/)
      expect(text).toMatch(/do not show that an effort started a breath/)
      expect(text).toMatch(/no interval here is a measured delay/)
      expect(text).not.toMatch(/trigger|patient effort|measured effort|caused|because/i)
    }
  })

  it('says only what a quiet or empty record shows, and nothing where no effort row is drawn', () => {
    const passive = createLabSimulation(SECTION_2, 0, DEVICE).waveforms
    expect(describeModeledEffort('Baseline', passive)).toBe(
      `Baseline breath: the modeled effort stays below ${EFFORT_DETECTION_FLOOR_CMH2O} cmH₂O for the whole drawn breath.`,
    )
    expect(describeModeledEffort('Result', passive.slice(0, 20))).toBe(
      'Result: no complete breath in the record, so its effort row is not described.',
    )
    render(<RecordedBreathComparison evidence={captured()} />)
    expect(document.querySelector('[data-effort-description]')).toBeNull()
  })

  it('draws only the two ends of the time axis; its title is page text under the figure', () => {
    const evidence = captured()
    render(<RecordedBreathComparison evidence={evidence} effort />)
    const check = (figures: number) => {
      const svgs = [...document.querySelectorAll('[data-recorded-breath-comparison] svg')]
      expect(svgs).toHaveLength(figures)
      for (const svg of svgs) {
        expect(svg.querySelectorAll('[data-time-tick]')).toHaveLength(2)
        expect(svg.querySelector('[text-anchor="middle"]')).toBeNull()
        expect(svg.textContent).not.toMatch(/Time/)
        const title = svg.parentElement!.querySelector('[data-time-axis]')!
        expect(title.tagName).toBe('P')
        expect(svg.contains(title)).toBe(false)
      }
    }
    check(2)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to inspiration' }))
    check(2)
    fireEvent.click(screen.getByRole('button', { name: 'Overlay' }))
    check(1)
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole breath' }))
    check(1)
  })

  it('leaves the samples, the crop and the axes alone', () => {
    const evidence = captured()
    const before = JSON.stringify(evidence)
    render(<RecordedBreathComparison evidence={evidence} effort />)
    const ends = () =>
      [...document.querySelectorAll('[data-time-tick]')].map((node) => node.textContent)
    const whole = ends()
    expect(new Set([whole[1], whole[3]]).size).toBe(1) // one shared time range
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to inspiration' }))
    const zoomed = ends()
    expect(zoomed[0]).toBe('0.00')
    expect(zoomed[1]).toBe(zoomed[3])
    expect(Number(zoomed[1])).toBeLessThan(Number(whole[1]))
    expect(JSON.stringify(evidence)).toBe(before)
  })
})
