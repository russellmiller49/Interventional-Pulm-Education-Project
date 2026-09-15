// MCS-01 replaces answer-security assertions. Historical assertions remain at the baseline commit.
import { fireEvent, screen, within } from '@testing-library/react'
jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)
import { buildMcsStageLesson, mcsStageLessonIds } from '../content/stageLessons'
import {
  mountSection,
  nowCard,
  nowPrimary,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'
import { readMcsLearningProgress } from '../engine/learningProgress'

beforeEach(setupMcsStage)
afterEach(teardownMcsStage)
it.each(mcsStageLessonIds)(
  '%s exposes the explanation without answering or performing work',
  (id) => {
    mountSection(id, 'predict')
    expect(nowPrimary()).toBeEnabled()
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Show explanation' }))
    expect(document.querySelector('[data-provided-explanation]')).toBeInTheDocument()
    expect(document.querySelector('[data-verdict]')).toBeNull()
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
    expect(document.querySelector('[data-phase-lock-note]')).toBeNull()
    expect(document.querySelector('[data-source-claims]')).toBeInTheDocument()
    expect(readMcsLearningProgress().visitedLessonIds).toEqual([id])
  },
)
it.each(mcsStageLessonIds)('%s offers all supported controls before answering', (id) => {
  mountSection(id, 'predict')
  fireEvent.click(screen.getByRole('button', { name: 'Explore all supported controls' }))
  expect(screen.getByRole('slider', { name: 'Preload' })).toBeEnabled()
  expect(
    screen.getByRole('button', { name: 'Observe and capture 8 simulated seconds' }),
  ).toBeEnabled()
  expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
})
it.each(mcsStageLessonIds)('%s never calls a skipped experiment a captured observation', (id) => {
  mountSection(id, 'observe')
  expect(document.querySelector('[data-no-observation]')).toBeInTheDocument()
  expect(document.querySelector('[data-captured-results]')).toBeNull()
  expect(nowPrimary()).toBeEnabled()
})

it('opens an unvisited earlier task as fresh exploration from a transfer deep link', () => {
  const id = 'iabp-timing-triggering'
  mountSection(id, 'transfer')
  const lesson = buildMcsStageLesson(id)
  const step = lesson.steps.find((step) => step.interaction.kind === 'action')!
  const map = screen.getByRole('list', { name: 'All lesson tasks' })
  fireEvent.click(within(map).getByRole('button', { name: new RegExp(step.title) }))
  expect(document.querySelector('[data-session-identity]')).not.toHaveTextContent('Captured review')
  expect(screen.getByRole('slider', { name: 'Inflation vs notch' })).toBeEnabled()
  expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
  fireEvent.change(screen.getByRole('slider', { name: 'Inflation vs notch' }), {
    target: { value: '0' },
  })
  expect(screen.getByRole('slider', { name: 'Inflation vs notch' })).toHaveValue('0')
})
