import { cleanup, fireEvent } from '@testing-library/react'

import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { hemodynamicsStageItems } from '../content/stageItems'
import { hemodynamicsStageSources } from '../content/stageSources'
import { hemodynamicsSourceById } from '../content/sources'
import { clickPrimary, commitChoice, installDom, mountSection } from '../test-support/stageHarness'

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
 * One source set per lesson, cited once, in the footer, folded; what each source is cited for
 * waits for the commitment.
 */
describe('the sources a lesson cites', () => {
  it.each(hemodynamicsSectionIds)(
    '%s resolves, cites nothing twice, and covers both items',
    (sectionId) => {
      const sources = hemodynamicsStageSources(sectionId)
      expect(sources.evidenceIds.length).toBeGreaterThan(0)
      expect(new Set(sources.evidenceIds).size).toBe(sources.evidenceIds.length)
      for (const id of sources.evidenceIds) expect(hemodynamicsSourceById.has(id)).toBe(true)
      const items = hemodynamicsStageItems[sectionId]
      for (const id of [...items.prediction.evidenceIds, ...items.transfer.evidenceIds]) {
        expect(sources.evidenceIds).toContain(id)
      }
    },
  )

  it('are cited once, in the footer, shut, and say what they are cited for only after the commitment', () => {
    const { lesson } = mountSection('pressure-system')
    const sources = hemodynamicsStageSources('pressure-system')
    const footer = document.querySelector<HTMLDetailsElement>('[data-stage-sources]')
    expect(footer).not.toBeNull()
    expect(footer?.open).toBe(false)
    expect(footer?.textContent).toMatch(
      new RegExp(`Sources for this section\\s*${sources.evidenceIds.length}`),
    )
    expect(document.querySelectorAll('[data-evidence-id]')).toHaveLength(sources.evidenceIds.length)
    expect(document.querySelectorAll('[data-pane="teaching"] [data-evidence-id]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-source-claims]')).toHaveLength(0)
    expect(document.querySelector('[data-stage-sources-note]')).not.toBeNull()

    clickPrimary()
    clickPrimary()
    expect(document.querySelector('[data-stage]')?.getAttribute('data-stage')).toBe(
      lesson.steps[lesson.predictionStepIndex].id,
    )
    expect(document.querySelectorAll('[data-source-claims]')).toHaveLength(0)
    commitChoice(/off level, not zeroed, and underdamped/)
    expect(document.querySelectorAll('[data-source-claims]').length).toBe(
      sources.evidenceIds.length,
    )
    expect(document.querySelector('[data-stage-sources-note]')).toBeNull()
    fireEvent.click(footer!.querySelector('summary')!)
  })
})
