import { act, cleanup, fireEvent } from '@testing-library/react'

import { hemodynamicsSectionIds, hemodynamicsSectionSpec } from '../content/sectionSpecs'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import {
  attributesText,
  clickPrimary,
  currentStepId,
  installDom,
  leakMatches,
  mountSection,
  scannableText,
} from '../test-support/stageHarness'

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
 * spec, so an author who moves an answer into a step title, a teaching card, the context strip or
 * the monitor's own labels is told which section and which phrase.
 */
describe('nothing answers a section before its prediction is committed (rendered)', () => {
  const findings: string[] = []

  it.each(hemodynamicsSectionIds)('%s', (sectionId) => {
    const lesson = hemodynamicsStageLesson(sectionId)
    const deny = hemodynamicsSectionSpec(sectionId).precommitDenyPatterns
    mountSection(sectionId)
    const atFirstStep = `${scannableText()} ${attributesText()}`
    for (const match of leakMatches(atFirstStep, deny))
      findings.push(`${sectionId} · first step: /${match}/`)

    // Reach the prediction the way a learner does.
    const first = lesson.steps[0]
    if (first.interaction.kind === 'walk') {
      for (let stop = 0; stop < first.interaction.stops.length; stop += 1) clickPrimary()
      clickPrimary()
    } else if (first.interaction.kind === 'read') {
      clickPrimary()
    } else if (first.interaction.kind === 'provenance-drill') {
      // The drill is the Recognize work; the scan reaches the prediction through it.
      const selects = document.querySelectorAll<HTMLSelectElement>(
        '[data-surface="provenance-drill"] select',
      )
      const answers: Record<string, string> = {
        'provenance-mean-pap': 'measured',
        'provenance-svr-flowsheet': 'calculated',
        'provenance-bsa-header': 'calculated',
        'provenance-assumed-vo2': 'assumed',
        'provenance-injectate-volume': 'entered',
        'provenance-svo2-slip': 'sampled',
      }
      for (const select of selects)
        fireEvent.change(select, { target: { value: answers[select.id] } })
      const commit = [
        ...document.querySelectorAll<HTMLButtonElement>('[data-surface="provenance-drill"] button'),
      ].find((button) => /Commit these/.test(button.textContent ?? ''))!
      fireEvent.click(commit)
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
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('false')
    // A section that asks where the tip is lights nothing on the map while it is the question;
    // every other section keeps its "you are here".
    const prediction = lesson.steps[lesson.predictionStepIndex].interaction
    if (prediction.kind === 'prediction' && prediction.mapTargets) {
      expect(document.querySelector('[data-map-emphasis-target]')).toBeNull()
      expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe(
        'withheld',
      )
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
