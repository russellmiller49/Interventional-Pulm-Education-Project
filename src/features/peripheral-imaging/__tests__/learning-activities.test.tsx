import { cleanup } from '@testing-library/react'
import {
  imagingLearningActivities,
  validateImagingLearningActivities,
} from '../content/learningActivities'
import { peripheralImagingSectionIds } from '../content/pathway'
import { imagingStageLesson } from '../content/stageLessons'
import {
  currentStepId,
  installDom,
  mountSection,
  performGuidedStep,
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

it('preserves every essential block exactly once and uses different task arrangements', () => {
  expect(validateImagingLearningActivities()).toEqual([])
  const activities = peripheralImagingSectionIds.flatMap(imagingLearningActivities)
  expect(new Set(activities.map((a) => a.id)).size).toBe(activities.length)
  expect(new Set(activities.map((a) => a.presentation)).size).toBe(5)
  expect(
    new Set(peripheralImagingSectionIds.map((id) => imagingLearningActivities(id).length)).size,
  ).toBeGreaterThan(2)
})

it.each(peripheralImagingSectionIds)(
  '%s actually renders all assigned teaching before its independent check',
  (id) => {
    const lesson = imagingStageLesson(id)
    mountSection(id)
    const seen = new Set<string>()
    for (let count = 0; currentStepId() !== lesson.steps[lesson.predictionStepIndex].id; count++) {
      if (count > lesson.steps.length) throw new Error('Task did not progress')
      const step = lesson.steps.find((s) => s.id === currentStepId())!
      if (step.interaction.kind === 'read') {
        for (const block of lesson.lesson.blocks.filter((block) =>
          step.activity.content.includes(block.title),
        )) {
          const nodes = [...document.querySelectorAll('[data-content-ref]')].filter(
            (node) => node.getAttribute('data-content-ref') === block.title,
          )
          expect(nodes).toHaveLength(1)
          expect(nodes[0]).toHaveTextContent(block.body)
          for (const point of block.points ?? []) expect(nodes[0]).toHaveTextContent(point)
          if (block.detail) expect(nodes[0]).toHaveTextContent(block.detail.body)
          seen.add(block.title)
        }
      }
      performGuidedStep(lesson)
    }
    expect([...seen].sort()).toEqual(lesson.lesson.blocks.map((b) => b.title).sort())
    expect(document.querySelector('[data-learning-activity]')).toHaveAttribute(
      'data-task-kind',
      'check',
    )
    expect(document.querySelector('[data-content-ref]')).toBeNull()
    expect(document.querySelector('[data-teaching-block="boundary"]')).not.toBeNull()
  },
)
