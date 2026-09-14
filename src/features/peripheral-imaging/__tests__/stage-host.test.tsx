import { cleanup, fireEvent, screen } from '@testing-library/react'
import { imagingStageLesson } from '../content/stageLessons'
import { LEGACY_IMAGING_RECORD_KEY_V1, LEGACY_IMAGING_RECORD_KEY_V2 } from '../engine/learnProgress'
import {
  clickPrimary,
  clickSkip,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowSecondary,
  nowSkip,
  nowStatus,
  reachIndependent,
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

/** Anything shaped like a stored response. The self-paced record must never hold one. */
const RESPONSE_SHAPED = /choice|correct|attempt|answer/i

function choose(id: string) {
  const radio = document.querySelector<HTMLInputElement>(
    `[data-prediction-choices] input[value="${id}"]`,
  )
  if (!radio) throw new Error('Choice missing')
  fireEvent.click(radio)
  clickPrimary()
}

it('replay and model reset never answer anything or satisfy the guided goal', () => {
  const { lesson } = mountSection('projection')
  fireEvent.click(screen.getByRole('button', { name: 'Change projection only' }))
  setRange('orbit', 50)
  fireEvent.click(screen.getByRole('button', { name: 'Replay demonstration' }))
  clickPrimary()
  clickPrimary()
  expect(currentStepId()).toBe(lesson.steps.find((s) => s.interaction.kind === 'lab-task')!.id)
  // The demonstration did not do the learner's work, so Continue is not offered; moving on is.
  expect(nowPrimary()).toBeNull()
  expect(nowSkip()).toHaveTextContent('Skip this step')
  expect(nowStatus()).toContain('Compare the image')
  expect(document.getElementById('peripheral-imaging-control-orbit')).toHaveValue('0')
  expect(JSON.stringify(storedProgress())).not.toMatch(RESPONSE_SHAPED)
})

it('moves through every step of a section without an answer or the work, and records none of it', () => {
  const { lesson } = mountSection('projection')
  const seen: string[] = []
  while (!document.querySelector('[data-section-completion]')) {
    if (seen.length > lesson.steps.length) throw new Error('The section did not end')
    const stepId = currentStepId()!
    seen.push(stepId)
    const step = lesson.steps.find((candidate) => candidate.id === stepId)!
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    if (step.interaction.kind === 'read') clickPrimary()
    else if (step.interaction.kind === 'explain') {
      // The debrief says the check was not answered, and shows no "what changed" for work not done.
      expect(document.querySelector('[data-explain-unanswered]')).not.toBeNull()
      expect(document.querySelector('[data-before-after]')).toBeNull()
      clickPrimary()
    } else clickSkip()
  }
  expect(seen).toEqual(lesson.steps.map((step) => step.id))

  const performed = Object.fromEntries(
    [...document.querySelectorAll('[data-review-step]')].map((node) => [
      node.getAttribute('data-review-step'),
      node.getAttribute('data-performed'),
    ]),
  )
  for (const step of lesson.steps.slice(0, -1)) {
    const readOnly = step.interaction.kind === 'read' || step.interaction.kind === 'explain'
    expect([step.id, performed[step.id]]).toEqual([step.id, readOnly ? 'true' : 'false'])
  }
  expect(document.querySelectorAll('[data-prediction-choices] input:checked')).toHaveLength(0)

  const stored = storedProgress()
  expect(stored).toMatchObject({
    lastLocation: { kind: 'section', id: 'projection' },
    visitedSectionIds: ['projection'],
    reviewedSectionIds: ['projection'],
  })
  expect(JSON.stringify(stored)).not.toMatch(RESPONSE_SHAPED)
  expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBeNull()
  expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V1)).toBeNull()
})

it('opens a check’s explanation before any answer, and opening it chooses and saves nothing', () => {
  const { lesson } = mountSection('projection')
  reachIndependent(lesson)
  const check = lesson.steps[lesson.predictionStepIndex].interaction
  if (check.kind !== 'prediction') throw new Error('Missing check')
  expect(nowPrimary()).toBeDisabled()
  expect(document.querySelector('[data-explanation-reveal]')).toBeNull()
  expect(nowSecondary()).toHaveTextContent('Show the explanation')

  fireEvent.click(nowSecondary()!)
  expect(nowSecondary()).toHaveAttribute('aria-expanded', 'true')
  const panel = document.querySelector('[data-explanation-reveal]')!
  expect(panel).toHaveTextContent(check.item.explanation)
  expect(
    panel.querySelector(`[data-explanation-best="${check.item.correctChoiceIds[0]}"]`),
  ).not.toBeNull()
  expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  expect(document.querySelectorAll('[data-prediction-choices] input:checked')).toHaveLength(0)
  expect(nowPrimary()).toBeDisabled()

  clickSkip()
  expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex + 1].id)
  expect(
    document.querySelector('[data-explain-unanswered] [data-explanation-reveal]'),
  ).not.toBeNull()
  expect(document.querySelector('[data-explain-recap] [data-answer-verdict]')).toBeNull()
  // The guided work before the check was really done, so its readouts are real.
  expect(document.querySelector('[data-before-after]')).not.toBeNull()
  expect(JSON.stringify(storedProgress())).not.toMatch(RESPONSE_SHAPED)
})

it('gives a wrong interpretation its feedback and a retry, and saves no answer', () => {
  const { lesson } = mountSection('projection')
  reachIndependent(lesson)
  expect(nowPrimary()).toBeDisabled()
  choose('a')
  expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'not-correct',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Try this question again' }))
  expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  choose('b')
  expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'correct',
  )
  clickPrimary()
  expect(document.querySelector('[data-before-after]')).not.toBeNull()
  clickPrimary()
  expect(document.querySelector('[data-stage-sources]')).toHaveAttribute(
    'data-stage-sources-claims',
    'true',
  )
  const transfer = lesson.steps[lesson.transferStepIndex].interaction
  if (transfer.kind !== 'prediction') throw new Error('Missing transfer')
  choose(transfer.item.correctChoiceIds[0])
  clickPrimary()
  expect(document.querySelector('[data-section-completion]')).not.toBeNull()
  expect(storedProgress().reviewedSectionIds).toEqual(['projection'])
  expect(JSON.stringify(storedProgress())).not.toMatch(RESPONSE_SHAPED)
  expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBeNull()
})

it('back, restart and reload start the section again and restore no answer', () => {
  const { lesson } = mountSection('projection')
  reachIndependent(lesson)
  choose('a')
  clickPrimary()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
  expect(nowStatus()).toContain('looking back')
  fireEvent.click(screen.getByRole('button', { name: 'Restart section' }))
  expect(currentStepId()).toBe('projection:parallax')
  expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  cleanup()
  mountSection('projection')
  expect(currentStepId()).toBe('projection:parallax')
  expect(storedProgress()).toMatchObject({
    lastLocation: { kind: 'section', id: 'projection' },
    visitedSectionIds: ['projection'],
    reviewedSectionIds: [],
  })
})

it('looking back at a skipped step says it was not done and keeps the controls paused', () => {
  const { lesson } = mountSection('projection')
  clickPrimary()
  clickPrimary()
  const act = lesson.steps.find((step) => step.interaction.kind === 'lab-task')!
  expect(currentStepId()).toBe(act.id)
  clickSkip()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(currentStepId()).toBe(act.id)
  expect(nowStatus()).toContain('without completing it')
  expect(document.querySelector('[data-step-skipped]')).not.toBeNull()
  expect(nowPrimary()).toHaveTextContent(/Return to step/)
  expect(document.getElementById('peripheral-imaging-control-orbit')).toBeDisabled()
})

it('shows the evidence matches without placing any, and moves on without matching', () => {
  const { lesson } = mountSection('imaging-questions')
  clickPrimary()
  clickPrimary()
  const step = lesson.steps.find((candidate) => candidate.interaction.kind === 'sort')!
  if (step.interaction.kind !== 'sort') throw new Error('Missing sort')
  expect(currentStepId()).toBe(step.id)
  expect(nowPrimary()).toBeDisabled()
  fireEvent.click(nowSecondary()!)
  expect(document.querySelectorAll('[data-sort-reveal]')).toHaveLength(
    step.interaction.sort.rows.length,
  )
  expect(document.querySelectorAll('[data-sort-verdict]')).toHaveLength(0)
  for (const select of document.querySelectorAll<HTMLSelectElement>('[data-imaging-sort] select'))
    expect(select.value).toBe('')
  clickSkip()
  expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
})

it('saves a section for later review without marking it reviewed, and can unsave it', () => {
  mountSection('projection')
  const toggle = document.querySelector('[data-review-later-toggle]')!
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(storedProgress()).toMatchObject({
    reviewLaterSectionIds: ['projection'],
    reviewedSectionIds: [],
  })
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(storedProgress().reviewLaterSectionIds).toEqual([])
})

it('the image-formation walk teaches depth collapse before the direct answer check', () => {
  const lesson = imagingStageLesson('chain-walk')
  mountSection('chain-walk')
  expect(document.querySelector('[data-teaching-panel]')?.textContent).toContain('X-ray tube')
  reachIndependent(lesson)
  expect(document.querySelector('[data-prediction-choices]')).not.toBeNull()
  expect(document.querySelector('[data-chain-answer]')).toBeNull()
})
