import { cleanup, fireEvent } from '@testing-library/react'
import { peripheralImagingSectionIds } from '../content/pathway'
import { imagingStageLesson } from '../content/stageLessons'
import { hasIndependentImagePanel } from '../components/stage/TeachingPanels'
import {
  installDom,
  mountSection,
  nowSecondary,
  nowSkip,
  reachIndependent,
  currentStepId,
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
 * Contract change (PI-01, owner decision 2026-09-14). This file used to hold blanket pre-answer
 * secrecy: at a pending check the teaching column was replaced by one sentence, source claims
 * were withheld, and no explanation could be reached without committing an answer. The self-paced
 * contract keeps two things from it — teaching comes first, and a check's example image stays fixed
 * while it is read — and replaces the rest: everything the section taught stays one disclosure away,
 * sources say what they are cited for, and the check's own explanation is the one thing that waits,
 * for the learner to open it before or instead of answering. Opening it answers nothing.
 */
describe('a check keeps its explanation for the learner to open, and hides no teaching', () => {
  it.each(peripheralImagingSectionIds)(
    '%s teaches first, keeps its teaching reachable at the check, and explains on request',
    (sectionId) => {
      const lesson = imagingStageLesson(sectionId)
      mountSection(sectionId)
      expect(document.querySelector('[data-lesson-demonstration]')).not.toBeNull()
      expect(
        document.querySelector('[data-teaching-block="mechanism"], [data-teaching-block="adds"]'),
      ).not.toBeNull()
      expect(document.querySelector('[data-teaching-block="boundary"]')).not.toBeNull()
      expect(document.querySelector('[data-answer-verdict]')).toBeNull()

      reachIndependent(lesson)
      expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
      const check = lesson.steps[lesson.predictionStepIndex].interaction
      if (check.kind !== 'prediction') throw new Error('Missing interpretation')
      expect(document.querySelector('[data-prediction-choices]')).not.toBeNull()
      expect(document.querySelector('[data-chain-answer]')).toBeNull()
      expect(document.querySelector('[data-answer-verdict], [data-chain-outcome]')).toBeNull()

      // Nothing the section taught is withheld: every block is one disclosure away.
      expect(document.querySelector('[data-check-teaching] [data-teaching-review]')).not.toBeNull()
      for (const block of lesson.lesson.blocks) {
        const nodes = [...document.querySelectorAll('[data-review-ref]')].filter(
          (node) => node.getAttribute('data-review-ref') === block.title,
        )
        expect(nodes).toHaveLength(1)
        expect(nodes[0]).toHaveTextContent(block.body)
      }
      expect(document.querySelector('[data-stage-sources]')).toHaveAttribute(
        'data-stage-sources-claims',
        'true',
      )

      // The check's own explanation waits for the learner, not for an answer.
      expect(document.querySelector('[data-explanation-reveal]')).toBeNull()
      expect(nowSkip()).not.toBeNull()
      const show = nowSecondary()!
      expect(show).toHaveTextContent('Show the explanation')
      fireEvent.click(show)
      const panel = document.querySelector('[data-explanation-reveal]')!
      expect(panel).toHaveTextContent(check.item.explanation)
      for (const choice of check.item.choices) expect(panel).toHaveTextContent(choice.rationale)
      expect(document.querySelector('[data-answer-verdict]')).toBeNull()
      expect(document.querySelectorAll('[data-prediction-choices] input:checked')).toHaveLength(0)

      // The example image stays fixed while it is read.
      if (hasIndependentImagePanel(sectionId)) {
        expect(document.querySelector('[data-independent-image-panels]')).not.toBeNull()
        expect(document.querySelector('[data-suite-scene]')).toBeNull()
      } else if (lesson.steps[lesson.predictionStepIndex].activity.visual !== 'case')
        expect(document.querySelector('[data-suite-scene]')).toHaveAttribute('data-lit', '')
      else expect(document.querySelector('[data-suite-scene]')).toBeNull()
      expect(
        document.querySelector('[data-readout="depthMm"], [data-readout="windowLabel"]'),
      ).toBeNull()
    },
  )
})
