import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { PeripheralImagingHub } from '../components/PeripheralImagingHub'
import { PeripheralImagingLearnLanding } from '../components/PeripheralImagingLearnLanding'
import { IMAGING_HUB_HERO } from '../content/hubHero'
import { CHAIN_STOPS } from '../content/imagingChain'
import { peripheralImagingPathwaySections, peripheralImagingSectionIds } from '../content/pathway'
import { imagingPathwayComposition } from '../content/pathwayResolver'
import {
  createEmptyImagingRecord,
  PERIPHERAL_IMAGING_STORAGE_KEY,
  withSectionCompleted,
  type ImagingRecord,
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

function store(record: ImagingRecord) {
  localStorage.setItem(PERIPHERAL_IMAGING_STORAGE_KEY, JSON.stringify(record))
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const ctas = () => document.querySelectorAll('[data-imaging-continue]')

describe('the hub', () => {
  it('has one primary call to action, and it starts a fresh learner at the first section', async () => {
    const { container } = render(<PeripheralImagingHub />)
    expect(ctas()).toHaveLength(1)
    const cta = ctas()[0]
    expect(cta.textContent).toMatch(/^Start — /)
    expect(cta).toHaveAttribute('data-next-section', peripheralImagingSectionIds[0])
    expect(cta).toHaveAttribute(
      'href',
      `/peripheral-imaging/learn?section=${peripheralImagingSectionIds[0]}`,
    )
    // Every count on the page is the registry's.
    const composition = imagingPathwayComposition()
    expect(screen.getByText(new RegExp(`^${composition.total} sections`))).toBeInTheDocument()
    expect(
      document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]'),
    ).toHaveLength(peripheralImagingPathwaySections.length)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('draws the suite once, between the door and the map, and says where each stop is', () => {
    render(<PeripheralImagingHub />)
    const figures = document.querySelectorAll('[data-hub-hero]')
    expect(figures).toHaveLength(1)
    const figure = figures[0]

    const picture = figure.querySelector('img')!
    expect(decodeURIComponent(picture.getAttribute('src') ?? '')).toContain(IMAGING_HUB_HERO.src)
    expect(picture).toHaveAttribute('alt', IMAGING_HUB_HERO.alt)

    // The chain in the registry's order, under the registry's titles.
    const stops = [...figure.querySelectorAll('[data-hub-hero-stop]')]
    expect(stops.map((stop) => stop.getAttribute('data-hub-hero-stop'))).toEqual(
      CHAIN_STOPS.map((stop) => stop.id),
    )
    stops.forEach((item, index) => {
      expect(item.textContent).toContain(CHAIN_STOPS[index].title)
      expect(item.textContent).toContain(IMAGING_HUB_HERO.where[CHAIN_STOPS[index].id])
    })
    // Stop numbers belong to the chain caption alone.
    expect(figure.querySelector('figcaption')!.textContent).not.toMatch(/\d/)

    // After the one door, before the map.
    const door = ctas()[0]
    const map = document.getElementById('imaging-map-heading')!
    expect(door.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(figure.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('continues a learner at the first section not yet worked through and marks worked chips', () => {
    const [first, second] = peripheralImagingSectionIds
    store(withSectionCompleted(createEmptyImagingRecord(), first))
    render(<PeripheralImagingHub />)
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
    let record = createEmptyImagingRecord()
    for (const id of peripheralImagingSectionIds) record = withSectionCompleted(record, id)
    store(record)
    render(<PeripheralImagingHub />)
    const cta = ctas()[0]
    expect(cta).toHaveAttribute('data-imaging-continue', 'complete')
    expect(cta).toHaveAttribute('href', '/peripheral-imaging/assess')
  })

  it('gives the Learn landing the same door and the same map', async () => {
    const { container } = render(<PeripheralImagingLearnLanding unknownSection="nope" />)
    expect(ctas()).toHaveLength(1)
    expect(ctas()[0]).toHaveAttribute('data-next-section', peripheralImagingSectionIds[0])
    expect(document.querySelector('[data-unknown-section="nope"]')).not.toBeNull()
    expect(
      document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]'),
    ).toHaveLength(peripheralImagingPathwaySections.length)
    expect(await axe(container)).toHaveNoViolations()
  })
})
