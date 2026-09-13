import { cleanup, fireEvent, screen } from '@testing-library/react'
import { imagingStageLesson } from '../content/stageLessons'
import { parseImagingRecord, PERIPHERAL_IMAGING_STORAGE_KEY } from '../engine/learnProgress'
import {
  clickPrimary,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowStatus,
  setRange,
  reachIndependent,
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

const record = () => parseImagingRecord(localStorage.getItem(PERIPHERAL_IMAGING_STORAGE_KEY))!
function choose(id: string) {
  const radio = document.querySelector<HTMLInputElement>(
    `[data-prediction-choices] input[value="${id}"]`,
  )
  if (!radio) throw new Error('Choice missing')
  fireEvent.click(radio)
  clickPrimary()
}

it('replay and model reset never submit an answer or satisfy the guided learner goal', () => {
  const { lesson } = mountSection('projection')
  fireEvent.click(screen.getByRole('button', { name: 'Change projection only' }))
  setRange('orbit', 50)
  fireEvent.click(screen.getByRole('button', { name: 'Replay demonstration' }))
  expect(record().firstAttempts).toEqual({})
  expect(record().completedSectionIds).not.toContain('projection')
  clickPrimary()
  expect(currentStepId()).toBe(lesson.steps[1].id)
  expect(nowPrimary()).toBeNull()
  expect(nowStatus()).toContain('Compare the image')
  expect(document.getElementById('peripheral-imaging-control-orbit')).toHaveValue('0')
})

it('a wrong interpretation gives feedback and retry, keeps the first answer, and finishes after transfer', () => {
  const { lesson } = mountSection('projection')
  reachIndependent(lesson)
  expect(nowPrimary()).toBeDisabled()
  choose('a')
  expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'not-correct',
  )
  const key = 'projection:projection-interpretation-v2'
  expect(record().firstAttempts[key].choiceId).toBe('a')
  fireEvent.click(screen.getByRole('button', { name: 'Try this question again' }))
  expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  choose('b')
  expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'correct',
  )
  expect(record().firstAttempts[key].choiceId).toBe('a')
  clickPrimary()
  expect(document.querySelector('[data-before-after]')).not.toBeNull()
  clickPrimary()
  expect(document.querySelector('[data-stage-sources]')).toHaveAttribute(
    'data-stage-sources-claims',
    'false',
  )
  const transfer = lesson.steps[lesson.transferStepIndex].interaction
  if (transfer.kind !== 'prediction') throw new Error('Missing transfer')
  choose(transfer.item.correctChoiceIds[0])
  clickPrimary()
  expect(record().completedSectionIds).toContain('projection')
})

it('back, restart and reload preserve immutable records and restart an incomplete section', () => {
  const { lesson } = mountSection('projection')
  reachIndependent(lesson)
  choose('a')
  clickPrimary()
  fireEvent.click(screen.getByRole('button', { name: /Back to/ }))
  expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
  expect(nowStatus()).toContain('looking back')
  fireEvent.click(screen.getByRole('button', { name: 'Restart section' }))
  expect(currentStepId()).toBe('projection-1-recognize')
  expect(record().firstAttempts['projection:projection-interpretation-v2'].choiceId).toBe('a')
  cleanup()
  mountSection('projection')
  expect(currentStepId()).toBe('projection-1-recognize')
  expect(record().firstAttempts['projection:projection-interpretation-v2'].choiceId).toBe('a')
})

it('the image-formation walk teaches depth collapse before the direct answer check', () => {
  const lesson = imagingStageLesson('chain-walk')
  mountSection('chain-walk')
  expect(document.querySelector('[data-teaching-panel]')?.textContent).toContain('collapses')
  reachIndependent(lesson)
  expect(document.querySelector('[data-prediction-choices]')).not.toBeNull()
  expect(document.querySelector('[data-chain-answer]')).toBeNull()
})
