import { act, cleanup } from '@testing-library/react'

import { peripheralImagingSectionIds } from '../content/pathway'
import { imagingSectionSpec } from '../content/sectionSpecs'
import { imagingStageLesson } from '../content/stageLessons'
import {
  attributesText,
  clickPrimary,
  currentStepId,
  installDom,
  leakMatches,
  mountSection,
  scannableText,
  setRange,
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

/**
 * The composed document, at the two moments that matter: the first step on mount, and the
 * prediction step reached the way a learner reaches it. Hidden nodes and attributes count; the
 * two answer fieldsets are the one excused surface. The deny set is the section's own, from its
 * spec, so an author who moves an answer into a step title, a teaching card, the context strip
 * or the suite's own labels is told which section and which phrase.
 */
describe('nothing answers a section before its prediction is committed (rendered)', () => {
  const findings: string[] = []

  it.each(peripheralImagingSectionIds)('%s', (sectionId) => {
    const lesson = imagingStageLesson(sectionId)
    const deny = imagingSectionSpec(sectionId).precommitDenyPatterns
    mountSection(sectionId)
    const atFirstStep = `${scannableText()} ${attributesText()}`
    for (const match of leakMatches(atFirstStep, deny))
      findings.push(`${sectionId} · first step: /${match}/`)

    // Reach the prediction the way a learner does.
    const first = lesson.steps[0]
    if (first.interaction.kind === 'walk') {
      // The walk asks for one control moved at the beam stop before it counts as done.
      setRange('orbit', 20)
      for (let stop = 0; stop < first.interaction.stops.length; stop += 1) clickPrimary()
      clickPrimary()
    } else if (first.interaction.kind === 'read') {
      clickPrimary()
    }
    act(() => {
      jest.advanceTimersByTime(10)
    })
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
    const atPrediction = `${scannableText()} ${attributesText()}`
    for (const match of leakMatches(atPrediction, deny))
      findings.push(`${sectionId} · prediction step: /${match}/`)
    expect(document.querySelector('[data-answer-verdict][data-verdict-outcome]')).toBeNull()
    expect(document.querySelector('[data-verdict-outcome]')).toBeNull()
    expect(document.querySelector('[data-chain-outcome]')).toBeNull()
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('false')
    // The controls are locked while the learner decides.
    const controls = document.querySelector<HTMLFieldSetElement>('[data-suite-controls]')
    if (controls) expect(controls.disabled).toBe(true)
    // A section answered on the chain lights nothing while it is the question; every other
    // section keeps its "you are here".
    const prediction = lesson.steps[lesson.predictionStepIndex].interaction
    const lit = document.querySelector('[data-suite-scene]')?.getAttribute('data-lit') ?? ''
    if (prediction.kind === 'prediction' && prediction.chainTargets) {
      expect(lit).toBe('')
      expect(document.querySelector('[data-chain-answer]')).not.toBeNull()
    } else {
      expect(lit).not.toBe('')
    }
    // Locked rows show their ordinal and phase, never a title.
    for (const row of document.querySelectorAll('[data-step-list] li[data-step-state="locked"]')) {
      expect(row.textContent).toMatch(/Step \d+$/)
    }
  })

  it('found nothing', () => {
    expect(findings).toEqual([])
  })
})
