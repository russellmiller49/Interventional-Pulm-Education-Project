import { cleanup } from '@testing-library/react'

import { BRONCH_SECTION_IDS } from '../content/pathway'
import { bronchStageLesson } from '../content/stageLessons'
import {
  attributesText,
  clickPrimary,
  currentStepId,
  installDom,
  leakMatches,
  mountSection,
  scannableText,
  settle,
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

/**
 * The composed document, at the two moments that matter: the first step on mount, and the
 * prediction step reached the way a learner reaches it. Hidden nodes and attributes count; the
 * answer fieldsets are the one excused surface. The deny set is the section's own, so an author
 * who moves an answer into a step title, a teaching card, the context strip or the pane's own
 * labels is told which section and which phrase.
 */
describe('nothing answers a section before its prediction is committed (rendered)', () => {
  it.each(BRONCH_SECTION_IDS)('%s', async (sectionId) => {
    const lesson = bronchStageLesson(sectionId)
    const deny = lesson.section.precommitDenyPatterns
    await mountSection(sectionId)
    const findings: string[] = []
    const atFirstStep = `${scannableText()} ${attributesText()}`
    for (const match of leakMatches(atFirstStep, deny))
      findings.push(`${sectionId} · first step: /${match}/`)

    clickPrimary()
    await settle()
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
    const atPrediction = `${scannableText()} ${attributesText()}`
    for (const match of leakMatches(atPrediction, deny))
      findings.push(`${sectionId} · prediction step: /${match}/`)
    expect(findings).toEqual([])
  })
})
