import { cleanup, fireEvent } from '@testing-library/react'

import { imagingStageLesson } from '../content/stageLessons'
import {
  clickPrimary,
  clickSkip,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowSecondary,
  setRange,
  storedProgress,
} from '../test-support/stageHarness'

jest.mock(
  '../components/suite/ImagingSuitePane',
  () =>
    jest.requireActual<typeof import('../test-support/SuiteTestDouble')>(
      '../test-support/SuiteTestDouble',
    ).suitePaneDouble,
)
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/*
 * PI-FELLOW-01, report 2.1 (AI-assisted fellow walkthrough, PDF p.16, screenshot p.22).
 *
 * "This example stays fixed so the question and the image match" was true of the controls, which
 * were disabled, and false of the image, which was still the learner's. This walks the section the
 * way the report did — through the component walk, changing the C-arm on the way — and holds the
 * fixed example's rendered state equal across prior histories that differ from each other.
 *
 * Every assertion here fails against the pre-repair host, which handed `session.lab.values` to the
 * check's pane whenever the section had no authored example state.
 */

const WALK_SECTION = 'chain-walk'

/**
 * The value the suite pane is drawing at. A fixed example shows no control for it (owner feedback,
 * 2026-10-11: no slider that does nothing), so it is read from what the pane was handed.
 */
function controlValue(key: string): string {
  const values = document.querySelector('[data-suite-values]')?.getAttribute('data-suite-values')
  if (!values) throw new Error(`No suite pane on step ${currentStepId()}`)
  return String((JSON.parse(values) as Record<string, unknown>)[key])
}

function exampleIdentity(): string | null {
  return (
    document.querySelector('[data-authored-example]')?.getAttribute('data-authored-example') ?? null
  )
}

/** The whole rendered check, reduced to what a learner can see of its acquisition state. */
function exampleState() {
  return {
    identity: exampleIdentity(),
    orbit: controlValue('orbit'),
    tilt: controlValue('tilt'),
    // Nothing on a fixed example can be moved: it offers no control at all.
    controlsOffered: document.querySelector('[data-suite-controls]') !== null,
  }
}

/**
 * Walk `chain-walk` to its check, optionally setting the C-arm on the way, the way a learner does.
 * `null` leaves the walk's own controls untouched.
 */
function reachCheckAfterWalk(priorObliquity: number | null) {
  const lesson = imagingStageLesson(WALK_SECTION)
  const checkId = lesson.steps[lesson.predictionStepIndex].id
  mountSection(WALK_SECTION)
  for (let guard = 0; currentStepId() !== checkId; guard++) {
    if (guard > 40) throw new Error(`Never reached ${checkId}; stuck on ${currentStepId()}`)
    const step = lesson.steps.find((candidate) => candidate.id === currentStepId())!
    if (step.interaction.kind === 'walk' && priorObliquity !== null) {
      setRange('orbit', priorObliquity)
    }
    const primary = nowPrimary()
    if (primary && !primary.disabled) fireEvent.click(primary)
    else clickSkip()
  }
  return lesson
}

describe('a fixed example is the same image whatever the learner did before reaching it', () => {
  // A history that leaves the lab untouched, the report's own 47 degrees, an allowed negative
  // value, and a value at the far end of the control's range.
  const HISTORIES: readonly (number | null)[] = [null, 47, -28, 75]

  it('shows one authored acquisition state across every prior history', () => {
    const states = HISTORIES.map((history) => {
      const state = reachCheckAfterWalk(history)
      const read = exampleState()
      cleanup()
      localStorage.clear()
      return { history, read, lesson: state }
    })
    const [first, ...rest] = states
    expect(first.read.identity).toBe(`${WALK_SECTION}:example:0`)
    expect(first.read.orbit).toBe('0')
    expect(first.read.tilt).toBe('0')
    expect(first.read.controlsOffered).toBe(false)
    for (const other of rest) {
      expect({ history: other.history, ...other.read }).toEqual({
        history: other.history,
        ...first.read,
      })
    }
  })

  it('a control moved on the check writes nothing back to the walk the learner performed', () => {
    const lesson = reachCheckAfterWalk(47)
    expect(exampleState().orbit).toBe('0')
    // Look back at the walk: its own state is where the learner left it, not the example's.
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-back]')!)
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-back]')!)
    expect(currentStepId()).toBe(lesson.steps[1].id)
    expect(controlValue('orbit')).toBe('47')
  })
})

describe('entering, revealing and retrying a fixed example performs no work', () => {
  it('records no answer and no performed step, and stores nothing but the section visit', () => {
    const lesson = reachCheckAfterWalk(null)
    const checkId = lesson.steps[lesson.predictionStepIndex].id
    expect(currentStepId()).toBe(checkId)

    // Reveal the explanation without answering.
    fireEvent.click(nowSecondary()!)
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()

    // Answer, then take it back.
    const choice = document.querySelector<HTMLInputElement>('[data-prediction-choices] input')!
    fireEvent.click(choice)
    clickPrimary()
    expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
    fireEvent.click(nowSecondary()!)
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()

    // The example is still its authored state after the retry.
    expect(exampleState().orbit).toBe('0')
    expect(exampleIdentity()).toBe(`${WALK_SECTION}:example:0`)

    const progress = storedProgress()
    expect(progress.visitedSectionIds).toEqual([WALK_SECTION])
    expect(progress.reviewedSectionIds).toEqual([])
    expect(JSON.stringify(progress)).not.toMatch(/choice|answer|score|attempt/i)
  })
})
