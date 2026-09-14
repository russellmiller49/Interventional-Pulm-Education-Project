import { reachCourseStep } from '../test-support/courseHarness'
import { cleanup } from '@testing-library/react'

import { BRONCH_SECTION_IDS } from '../content/pathway'
import {
  attributesText,
  installDom,
  leakMatches,
  mountSection,
  scannableText,
} from '../test-support/stageHarness'

jest.mock(
  '../components/scope/ScopePane',
  () =>
    jest.requireActual<typeof import('../test-support/ScopeTestDouble')>(
      '../test-support/ScopeTestDouble',
    ).scopePaneDouble,
)
jest.mock('../components/stage/scopeCaseLoader', () => ({
  loadStageScopeCase: () =>
    Promise.resolve(
      jest
        .requireActual<
          typeof import('../test-support/teachingCase')
        >('../test-support/teachingCase')
        .teachingCase(),
    ),
}))
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

/** Worked instruction is intentionally visible. Pending checks replace it, including the DOM and accessibility attributes. */
describe('pending independent checks withhold worked solutions (rendered)', () => {
  it.each(BRONCH_SECTION_IDS.filter((id) => id !== 'five-controls'))('%s', async (sectionId) => {
    const { lesson } = await mountSection(sectionId)
    expect(document.querySelector('[data-course-teaching]')).not.toBeNull()
    for (const check of lesson.steps.filter((step) => step.activity === 'independent-check')) {
      await reachCourseStep(lesson, check)
      expect(document.querySelector('[data-course-teaching]')).toBeNull()
      expect(document.querySelector('[data-normal-airway-tour]')).toBeNull()
      expect(document.querySelector('[data-worked-example]')).toBeNull()
      expect(document.querySelector('[data-answer-verdict]')).toBeNull()
      expect(document.querySelector('[data-new-concept]')).toBeNull()
      expect(document.querySelector('[data-lit="true"]')).toBeNull()
      const pending = `${scannableText()} ${attributesText()}`
      // The section's deny patterns guard its first question; changed checks additionally inspect all rationale surfaces.
      if (check.interaction.kind === 'prediction' && check.interaction.round === 0)
        expect(leakMatches(pending, lesson.section.precommitDenyPatterns)).toEqual([])
      if (check.interaction.kind === 'prediction')
        for (const choice of check.interaction.stage.item.choices) {
          if (choice.rationale) expect(pending).not.toContain(choice.rationale)
        }
    }
  })
})
