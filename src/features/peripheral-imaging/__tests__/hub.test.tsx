import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { PeripheralImagingHub } from '../components/PeripheralImagingHub'
import { PeripheralImagingLearnLanding } from '../components/PeripheralImagingLearnLanding'
import { IMAGING_HUB_HERO } from '../content/hubHero'
import { CHAIN_STOPS } from '../content/imagingChain'
import { peripheralImagingPathwaySections, peripheralImagingSectionIds } from '../content/pathway'
import { imagingPathwayComposition } from '../content/pathwayResolver'
import { LEGACY_IMAGING_RECORD_KEY_V2 } from '../engine/learnProgress'
import {
  createEmptyImagingProgress,
  IMAGING_PROGRESS_STORAGE_KEY,
  withLocation,
  withReviewLater,
  withSectionReviewed,
  type ImagingProgress,
} from '../engine/selfPacedProgress'

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

function store(progress: ImagingProgress) {
  localStorage.setItem(IMAGING_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const ctas = () => document.querySelectorAll('[data-imaging-continue]')
const chips = () => [
  ...document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]'),
]

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
    expect(chips()).toHaveLength(peripheralImagingPathwaySections.length)
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

  it('offers back a section left unfinished, and marks what this device knows in words', () => {
    const [first, second, third] = peripheralImagingSectionIds
    let progress = withLocation(createEmptyImagingProgress(), { kind: 'section', id: first })
    progress = withSectionReviewed(progress, first)
    progress = withLocation(progress, { kind: 'section', id: third })
    progress = withReviewLater(progress, second, true)
    store(progress)
    render(<PeripheralImagingHub />)

    const cta = ctas()[0]
    expect(cta.textContent).toMatch(/^Resume — /)
    expect(cta).toHaveAttribute('data-next-section', third)
    expect(cta).toHaveAttribute('data-resumed', 'true')

    const [firstChip, secondChip, thirdChip] = chips()
    expect(firstChip).toHaveAttribute('data-reviewed', 'true')
    expect(firstChip.textContent).toMatch(/reviewed/)
    expect(secondChip).toHaveAttribute('data-review-later', 'true')
    expect(secondChip).toHaveAttribute('data-visited', 'false')
    expect(secondChip.textContent).toMatch(/saved for review/)
    expect(thirdChip).toHaveAttribute('data-visited', 'true')
    expect(thirdChip).toHaveAttribute('data-recommended', 'true')
    expect(thirdChip.textContent).toMatch(/Up next/)
    expect(document.querySelector('[data-review-later-list]')?.textContent).toContain(
      peripheralImagingPathwaySections[1].title,
    )
    // Only the group holding the recommended section opens on load.
    const open = [...document.querySelectorAll('[data-pathway-accordion] details')].filter((d) =>
      d.hasAttribute('open'),
    )
    expect(open).toHaveLength(1)
    expect(open[0].querySelector('a[data-recommended="true"]')).not.toBeNull()
  })

  it('continues at the first section not marked reviewed once the last one opened is reviewed', () => {
    const [first, second] = peripheralImagingSectionIds
    store(
      withSectionReviewed(
        withLocation(createEmptyImagingProgress(), { kind: 'section', id: first }),
        first,
      ),
    )
    render(<PeripheralImagingHub />)
    const cta = ctas()[0]
    expect(cta.textContent).toMatch(/^Continue — /)
    expect(cta).toHaveAttribute('data-next-section', second)
    expect(cta).toHaveAttribute('data-resumed', 'false')
  })

  it('sends a learner who has marked every section reviewed to the integrated cases', () => {
    let progress = createEmptyImagingProgress()
    for (const id of peripheralImagingSectionIds) progress = withSectionReviewed(progress, id)
    store(progress)
    render(<PeripheralImagingHub />)
    const cta = ctas()[0]
    expect(cta).toHaveAttribute('data-imaging-continue', 'complete')
    expect(cta).toHaveAttribute('href', '/peripheral-imaging/assess')
  })

  it('does not turn a legacy record of completed sections into progress, and leaves it untouched', () => {
    const legacy = JSON.stringify({
      version: 2,
      completedSectionIds: [...peripheralImagingSectionIds],
      lastSectionId: peripheralImagingSectionIds[3],
      firstAttempts: {},
      capstoneDebriefViewedAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
    })
    localStorage.setItem(LEGACY_IMAGING_RECORD_KEY_V2, legacy)
    render(<PeripheralImagingHub />)
    const cta = ctas()[0]
    expect(cta.textContent).toMatch(/^Start — /)
    expect(cta).toHaveAttribute('data-next-section', peripheralImagingSectionIds[0])
    expect(chips().filter((chip) => chip.getAttribute('data-reviewed') === 'true')).toHaveLength(0)
    expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBe(legacy)
  })

  it('says so when saved places cannot be read, and keeps every section open', () => {
    localStorage.setItem(IMAGING_PROGRESS_STORAGE_KEY, 'not a record')
    render(<PeripheralImagingHub />)
    expect(document.querySelector('[data-progress-status="unreadable"]')).not.toBeNull()
    expect(ctas()[0].textContent).toMatch(/^Start — /)
    expect(chips()).toHaveLength(peripheralImagingPathwaySections.length)
    expect(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY)).toBe('not a record')
  })

  it('gives the Learn landing the same door and the same map', async () => {
    const { container } = render(<PeripheralImagingLearnLanding unknownSection="nope" />)
    expect(ctas()).toHaveLength(1)
    expect(ctas()[0]).toHaveAttribute('data-next-section', peripheralImagingSectionIds[0])
    expect(document.querySelector('[data-unknown-section="nope"]')).not.toBeNull()
    expect(chips()).toHaveLength(peripheralImagingPathwaySections.length)
    expect(await axe(container)).toHaveNoViolations()
  })
})
