import { cleanup, render, screen } from '@testing-library/react'

import { hemodynamicCases } from '../content/cases'
import {
  hemodynamicsCompositionLine,
  hemodynamicsPathwayComposition,
  hemodynamicsPathwayGroups,
  hemodynamicsPathwaySections,
  suggestedHemodynamicsSection,
} from '../content/pathwayResolver'
import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { ICU_HEMODYNAMICS_LEARN_STORAGE_KEY } from '../engine/learnProgress'
import {
  createEmptySelfPacedRecord,
  withSectionReviewed,
  withSectionVisited,
  writeSelfPacedRecord,
} from '../engine/selfPacedProgress'
import {
  HemodynamicsContinueCta,
  HemodynamicsPathwayAccordion,
} from '../components/HemodynamicsPathwayAccordion'
import { IcuHemodynamicsLearnLandingV2 } from '../components/IcuHemodynamicsLearnLandingV2'
import { IcuHemodynamicsOverviewV2 } from '../components/IcuHemodynamicsOverviewV2'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string; query?: Record<string, string> }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ''}`
      }
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

function reviewed(...sectionIds: readonly string[]) {
  return sectionIds.reduce(
    (record, sectionId) => withSectionReviewed(record, sectionId, true),
    createEmptySelfPacedRecord(),
  )
}

/**
 * The one door: every entry surface resolves its call to action through
 * `suggestedHemodynamicsSection`, counts are derived, and the grouped map is a presentation of the
 * one order. HD-01: the suggestion comes from where the learner was and what they marked reviewed —
 * never from answers, old completions or scores — and it never gates a section.
 */
describe('the resolver', () => {
  it('sends a fresh learner to section one', () => {
    const next = suggestedHemodynamicsSection(createEmptySelfPacedRecord())
    expect(next?.section.id).toBe(hemodynamicsSectionIds[0])
    expect(next?.section.id).toBe('why-measure')
    expect(next?.index).toBe(0)
    expect(next?.total).toBe(hemodynamicsSectionIds.length)
    expect(next?.resumed).toBe(false)
  })

  it('offers the section the learner left, unless they marked it reviewed', () => {
    let record = withSectionVisited(createEmptySelfPacedRecord(), 'why-measure')
    record = withSectionVisited(record, 'pawp-capture')
    expect(suggestedHemodynamicsSection(record)?.section.id).toBe('pawp-capture')
    expect(suggestedHemodynamicsSection(record)?.resumed).toBe(true)
    record = withSectionReviewed(record, 'pawp-capture', true)
    expect(suggestedHemodynamicsSection(record)?.section.id).toBe('why-measure')
    expect(suggestedHemodynamicsSection(record)?.resumed).toBe(false)
  })

  it('otherwise offers the first section not marked reviewed', () => {
    const record = reviewed('why-measure', 'pressure-system', 'catheter-advancement')
    expect(suggestedHemodynamicsSection(record)?.section.id).toBe('waveform-interpretation')
  })

  it('resolves to nothing once every section is marked reviewed', () => {
    expect(suggestedHemodynamicsSection(reviewed(...hemodynamicsSectionIds))).toBeNull()
  })

  it('derives every count', () => {
    const composition = hemodynamicsPathwayComposition()
    expect(composition.total).toBe(hemodynamicsPathwaySections.length)
    expect(composition.minutes).toBe(hemodynamicsPathwaySections.reduce((s, x) => s + x.minutes, 0))
    expect(composition.byStage.reduce((s, x) => s + x.count, 0)).toBe(composition.total)
    expect(hemodynamicsCompositionLine()).toBe(
      `${composition.total} sections · 1 orientation · 2 foundations · 4 mechanisms · 1 application · 1 capstone · ${composition.minutes} min`,
    )
  })

  it('groups the one order into contiguous runs that flatten back to it', () => {
    const groups = hemodynamicsPathwayGroups()
    expect(groups.flatMap((group) => group.sections.map((s) => s.id))).toEqual([
      ...hemodynamicsSectionIds,
    ])
    for (const group of groups)
      expect(group.sections.every((s) => s.stage === group.stage)).toBe(true)
  })

  it('names every case by its presentation, never its diagnosis', () => {
    const shortTitles = hemodynamicCases.map((definition) => definition.shortTitle)
    for (const group of hemodynamicsPathwayGroups()) {
      for (const entry of group.cases) {
        expect(shortTitles).not.toContain(entry.title)
        expect(hemodynamicCases.map((d) => d.title)).toContain(entry.title)
      }
    }
  })
})

describe('the surfaces', () => {
  it('open exactly the group holding the suggested section, and say reviewed and opened in words', () => {
    let record = reviewed('why-measure', 'pressure-system')
    record = withSectionVisited(record, 'derived-hemodynamics')
    record = withSectionReviewed(record, 'derived-hemodynamics', true)
    render(<HemodynamicsPathwayAccordion record={record} />)
    const open = [...document.querySelectorAll('[data-pathway-accordion] details')].filter(
      (details) => (details as HTMLDetailsElement).open,
    )
    expect(open).toHaveLength(1)
    expect(open[0].textContent).toMatch(/Identify the chamber from the waveform/)
    expect(open[0].querySelector('[data-recommended="true"]')?.textContent).toMatch(/Up next/)
    expect(document.querySelectorAll('[data-kind="section"][data-reviewed="true"]')).toHaveLength(3)
    expect(document.body.textContent).toMatch(/✓ reviewed/)
    expect(document.body.textContent).not.toMatch(/worked through/)
    expect(document.querySelectorAll('[data-kind="section"]')).toHaveLength(
      hemodynamicsSectionIds.length,
    )
  })

  it('says Start, Continue or Resume from the same resolver', () => {
    const { unmount } = render(<HemodynamicsContinueCta />)
    expect(screen.getByRole('link').textContent).toMatch(/^Start — Why put a line in at all\?/)
    expect(screen.getByRole('link').getAttribute('data-next-section')).toBe('why-measure')
    unmount()

    writeSelfPacedRecord(reviewed('why-measure'))
    const second = render(<HemodynamicsContinueCta />)
    expect(screen.getByRole('link').textContent).toMatch(/^Continue — Can this number be trusted\?/)
    second.unmount()

    writeSelfPacedRecord(withSectionVisited(reviewed('why-measure'), 'pressure-system'))
    const third = render(<HemodynamicsContinueCta />)
    expect(screen.getByRole('link').textContent).toMatch(/^Resume — Can this number be trusted\?/)
    third.unmount()

    writeSelfPacedRecord(reviewed(...hemodynamicsSectionIds))
    render(<HemodynamicsContinueCta />)
    expect(screen.getByRole('link').getAttribute('data-hemodynamics-continue')).toBe('complete')
  })

  it('does not turn a legacy completion into a current suggestion', () => {
    localStorage.setItem(
      ICU_HEMODYNAMICS_LEARN_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        completedSectionIds: [...hemodynamicsSectionIds],
        lastSectionId: 'pac-signal-validation',
        updatedAt: '2026-09-01T00:00:00.000Z',
      }),
    )
    render(<HemodynamicsContinueCta />)
    expect(screen.getByRole('link').textContent).toMatch(/^Start — Why put a line in at all\?/)
  })

  it('renders the Overview and the Learn landing on the same door and map', () => {
    const overview = render(<IcuHemodynamicsOverviewV2 />)
    expect(
      document.querySelector('[data-hemodynamics-continue]')?.getAttribute('data-next-section'),
    ).toBe('why-measure')
    expect(document.querySelector('[data-pathway-composition]')?.textContent).toBe(
      hemodynamicsCompositionLine(),
    )
    expect(
      document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]'),
    ).toHaveLength(hemodynamicsSectionIds.length)
    overview.unmount()
    render(<IcuHemodynamicsLearnLandingV2 />)
    expect(
      document.querySelector('[data-hemodynamics-continue]')?.getAttribute('data-next-section'),
    ).toBe('why-measure')
    expect(
      document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]'),
    ).toHaveLength(hemodynamicsSectionIds.length)
  })
})
