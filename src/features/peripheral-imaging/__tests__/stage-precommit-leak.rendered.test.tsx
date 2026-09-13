import { cleanup } from '@testing-library/react'
import { peripheralImagingSectionIds } from '../content/pathway'
import { imagingStageLesson } from '../content/stageLessons'
import { hasIndependentImagePanel } from '../components/stage/TeachingPanels'
import {
  installDom,
  mountSection,
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

describe('teaching and independent disclosure have separate boundaries', () => {
  it.each(peripheralImagingSectionIds)(
    '%s teaches before asking and protects its pending item',
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
      expect(document.querySelector('[data-prediction-choices]')).not.toBeNull()
      expect(document.querySelector('[data-chain-answer]')).toBeNull()
      expect(document.querySelector('[data-answer-verdict], [data-chain-outcome]')).toBeNull()
      expect(document.querySelector('[data-independent-foundations]')).not.toBeNull()
      expect(
        document.querySelector(
          '[data-teaching-block="control-strip"], [data-teaching-block="grammar"], [data-recall-answer]',
        ),
      ).toBeNull()
      expect(document.querySelector('[data-stage-sources]')).toHaveAttribute(
        'data-stage-sources-claims',
        'false',
      )
      if (hasIndependentImagePanel(sectionId)) {
        expect(document.querySelector('[data-independent-image-panels]')).not.toBeNull()
        expect(document.querySelector('[data-suite-scene]')).toBeNull()
      } else expect(document.querySelector('[data-suite-scene]')).toHaveAttribute('data-lit', '')
      expect(
        document.querySelector('[data-readout="depthMm"], [data-readout="windowLabel"]'),
      ).toBeNull()
      const prediction = lesson.steps[lesson.predictionStepIndex].interaction
      if (prediction.kind !== 'prediction') throw new Error('Missing interpretation')
      const outsideChoices = document.body.cloneNode(true) as HTMLElement
      outsideChoices.querySelector('[data-prediction-choices]')?.remove()
      expect(outsideChoices.textContent).not.toContain(prediction.item.explanation)
      for (const choice of prediction.item.choices)
        expect(outsideChoices.textContent).not.toContain(choice.rationale)
    },
  )
})
