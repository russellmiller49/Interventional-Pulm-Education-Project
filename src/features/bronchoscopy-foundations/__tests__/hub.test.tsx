import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { BronchoscopyFoundationsHub } from '../components/BronchoscopyFoundationsHub'
import { BronchoscopyFoundationsLearnLanding } from '../components/BronchoscopyFoundationsLearnLanding'
import { BRONCH_SECTION_IDS, bronchPathwaySections } from '../content/pathway'
import { bronchPathwayComposition } from '../content/pathwayResolver'
import { BRONCH_PHASES } from '../content/sectionIds'
import { SOURCES } from '../data/sources'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
  withSectionCompleted,
  type BronchRecord,
} from '../engine/learnProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${
            href.query && Object.keys(href.query).length > 0
              ? `?${new URLSearchParams(href.query).toString()}`
              : ''
          }`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: jest.fn() }),
}))

function store(record: BronchRecord) {
  localStorage.setItem(BRONCH_STORAGE_KEY, JSON.stringify(record))
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const ctas = () => document.querySelectorAll('[data-bronch-continue]')

describe('the hub', () => {
  it('has one primary call to action, and it starts a fresh learner at the first section', async () => {
    const { container } = render(<BronchoscopyFoundationsHub />)
    expect(ctas()).toHaveLength(1)
    const cta = ctas()[0]
    expect(cta.textContent).toMatch(/^Start — /)
    expect(BRONCH_SECTION_IDS[0]).toBe('shared-airway')
    expect(cta).toHaveAttribute('data-next-section', 'shared-airway')
    expect(cta).toHaveAttribute('href', '/bronchoscopy-foundations/learn?section=shared-airway')
    // Every count on the page is the registry's.
    const composition = bronchPathwayComposition()
    const line = document.querySelector('[data-pathway-composition]')!
    expect(line.textContent).toMatch(new RegExp(`^${composition.total} sections`))
    expect(line.textContent).toContain(`${composition.byPhase.length} phases`)
    expect(line.textContent).toMatch(new RegExp(`${composition.minutes} min$`))
    expect(
      document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]'),
    ).toHaveLength(bronchPathwaySections.length)
    expect(document.querySelectorAll('[data-pathway-accordion] details')).toHaveLength(
      BRONCH_PHASES.length,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('draws no hero, and says the nine phases in one sentence between the door and the map', () => {
    render(<BronchoscopyFoundationsHub />)
    expect(document.querySelector('[data-hub-hero]')).toBeNull()
    const lede = screen.getByText(/in the order a procedure runs/)
    for (const phase of BRONCH_PHASES) {
      expect(lede.textContent).toContain(phase.title.toLowerCase())
    }
    expect(lede.textContent).toMatch(/a recommendation, not a gate/)
  })

  it('lists every source once, by id', () => {
    render(<BronchoscopyFoundationsHub />)
    const ids = [...document.querySelectorAll('[data-source-id]')].map((el) =>
      el.getAttribute('data-source-id'),
    )
    expect(ids).toEqual(SOURCES.map((source) => source.id))
  })

  it('continues a learner at the first section not yet worked through and marks worked chips', () => {
    const [first, second] = BRONCH_SECTION_IDS
    store(withSectionCompleted(createEmptyBronchRecord(), first))
    render(<BronchoscopyFoundationsHub />)
    const cta = ctas()[0]
    expect(cta.textContent).toMatch(/^Continue — /)
    expect(cta).toHaveAttribute('data-next-section', second)
    const chips = [...document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]')]
    expect(chips[0]).toHaveAttribute('data-complete', 'true')
    expect(chips[0].textContent).toMatch(/worked through/)
    expect(chips[1]).toHaveAttribute('data-recommended', 'true')
    expect(chips[1].textContent).toMatch(/Up next/)
    // Only the group holding the next section opens on load.
    const open = [...document.querySelectorAll('[data-pathway-accordion] details')].filter((d) =>
      d.hasAttribute('open'),
    )
    expect(open).toHaveLength(1)
    expect(open[0].querySelector('a[data-recommended="true"]')).not.toBeNull()
  })

  it('sends a learner who has finished every section to the capstone', () => {
    let record = createEmptyBronchRecord()
    for (const id of BRONCH_SECTION_IDS) record = withSectionCompleted(record, id)
    store(record)
    render(<BronchoscopyFoundationsHub />)
    const cta = ctas()[0]
    expect(cta).toHaveAttribute('data-bronch-continue', 'complete')
    expect(cta).toHaveAttribute('href', '/bronchoscopy-foundations/assess')
  })

  it('gives the Learn landing the same door and the same map', async () => {
    const { container } = render(<BronchoscopyFoundationsLearnLanding unknownSection="nope" />)
    expect(ctas()).toHaveLength(1)
    expect(ctas()[0]).toHaveAttribute('data-next-section', BRONCH_SECTION_IDS[0])
    expect(document.querySelector('[data-unknown-section="nope"]')).not.toBeNull()
    expect(
      document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]'),
    ).toHaveLength(bronchPathwaySections.length)
    expect(await axe(container)).toHaveNoViolations()
  })
})
