import { cleanup, render, screen } from '@testing-library/react'

import { hemodynamicCases } from '../content/cases'
import {
  hemodynamicsCompositionLine,
  hemodynamicsPathwayComposition,
  hemodynamicsPathwayGroups,
  hemodynamicsPathwaySections,
  nextIncompleteHemodynamicsSection,
} from '../content/pathwayResolver'
import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import {
  createEmptyLearnRecord,
  withSectionCompleted,
  writeLearnRecord,
} from '../engine/learnProgress'
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

/**
 * The one door: every entry surface resolves its Continue through `nextIncompleteHemodynamicsSection`,
 * counts are derived, and the grouped map is a presentation of the one order.
 */
describe('the resolver', () => {
  it('sends a fresh learner to section one', () => {
    const next = nextIncompleteHemodynamicsSection(createEmptyLearnRecord())
    expect(next?.section.id).toBe(hemodynamicsSectionIds[0])
    expect(next?.section.id).toBe('why-measure')
    expect(next?.index).toBe(0)
    expect(next?.total).toBe(hemodynamicsSectionIds.length)
  })

  it('offers the first section not worked through, whatever was opened last', () => {
    let record = createEmptyLearnRecord()
    record = withSectionCompleted(record, 'why-measure')
    record = withSectionCompleted(record, 'pressure-system')
    record = withSectionCompleted(record, 'catheter-advancement')
    expect(nextIncompleteHemodynamicsSection(record)?.section.id).toBe('waveform-interpretation')
  })

  it('resolves to nothing once every section is worked through', () => {
    const record = hemodynamicsSectionIds.reduce(
      (current, id) => withSectionCompleted(current, id),
      createEmptyLearnRecord(),
    )
    expect(nextIncompleteHemodynamicsSection(record)).toBeNull()
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
  it('open exactly the group holding the next section', () => {
    let record = createEmptyLearnRecord()
    record = withSectionCompleted(record, 'why-measure')
    record = withSectionCompleted(record, 'pressure-system')
    render(<HemodynamicsPathwayAccordion record={record} />)
    const open = [...document.querySelectorAll('[data-pathway-accordion] details')].filter(
      (details) => (details as HTMLDetailsElement).open,
    )
    expect(open).toHaveLength(1)
    expect(open[0].textContent).toMatch(/Four places, four shapes/)
    expect(open[0].querySelector('[data-recommended="true"]')?.textContent).toMatch(/Up next/)
    expect(document.querySelectorAll('[data-kind="section"][data-complete="true"]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-kind="section"]')).toHaveLength(
      hemodynamicsSectionIds.length,
    )
  })

  it('says Start, Continue or Resume from the same resolver', () => {
    const { unmount } = render(<HemodynamicsContinueCta />)
    expect(screen.getByRole('link').textContent).toMatch(/^Start — Why put a line in at all\?/)
    expect(screen.getByRole('link').getAttribute('data-next-section')).toBe('why-measure')
    unmount()

    writeLearnRecord(withSectionCompleted(createEmptyLearnRecord(), 'why-measure'))
    const second = render(<HemodynamicsContinueCta />)
    expect(screen.getByRole('link').textContent).toMatch(/^Continue — Can this number be trusted\?/)
    second.unmount()

    const every = hemodynamicsSectionIds.reduce(
      (current, id) => withSectionCompleted(current, id),
      createEmptyLearnRecord(),
    )
    writeLearnRecord(every)
    render(<HemodynamicsContinueCta />)
    expect(screen.getByRole('link').getAttribute('data-hemodynamics-continue')).toBe('complete')
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
