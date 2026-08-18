import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { CardiohelpHub } from '../components/CardiohelpHub'
import { EcmoContinueCta } from '../components/EcmoContinueCta'
import { orderedCaseScenarioIds } from '../content/curriculum'
import { ecmoPathwayComposition, ecmoPathwaySectionKind } from '../content/pathwayResolver'
import { CARDIOHELP_PROGRESS_STORAGE_KEY, createDefaultProgress } from '../engine/progress'
import type { ProgressV2, SupportMode } from '../engine/types'

/**
 * One door.
 *
 * The module had two entry surfaces resolving "where do I start" through two different registries.
 * The hub walked the seven curriculum units, whose first entry is the console drill, and so sent a
 * brand-new learner to section seven of seventeen; the Learn landing sent the same learner to
 * section one and carried a footnote apologising for the difference. This suite exists to make that
 * disagreement impossible to reintroduce: it renders both surfaces from the same stored progress
 * and asserts they resolve to the same section.
 *
 * Neither side is compared against a hardcoded id. Both are compared against the pathway registry
 * and against each other, so a deliberate change to the canonical order updates this test's
 * expectations automatically while an accidental divergence between the two surfaces fails it. The
 * one place the literal first section is pinned is `redesign-baseline-contracts.test.ts`, which is
 * where a change to the canonical order is supposed to be noticed.
 */

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
}))

const TRACKS: readonly SupportMode[] = ['vv', 'va']

function sections(track: SupportMode) {
  return criticalCareLearningPathway('cardiohelp-ecmo', track).sections
}

function seedProgress(worked: readonly string[]): void {
  const drills = worked.filter((id) => ecmoPathwaySectionKind(id) === 'drill')
  const foundations = worked.filter((id) => ecmoPathwaySectionKind(id) === 'foundation-workspace')
  const progress: ProgressV2 = {
    ...createDefaultProgress(),
    completedLearnLessonIds: drills,
    ...(foundations.length > 0 ? { completedFoundationSectionIds: foundations } : {}),
  }
  window.localStorage.setItem(CARDIOHELP_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

/** The `?lesson=` a surface's primary call to action points at. */
function targetOf(cta: HTMLElement): string | null {
  const href = cta.getAttribute('href')
  if (!href) return null
  return new URLSearchParams(href.split('?')[1] ?? '').get('lesson')
}

/**
 * The primary "continue" control of whichever surface was just rendered.
 *
 * Both surfaces mark it with the same attribute, which is the point: the test asks each of them
 * the same question in the same way, and cannot accidentally compare a call to action on one with
 * a navigation link on the other.
 */
function primaryCta(container: HTMLElement): HTMLElement {
  const found = container.querySelectorAll('[data-ecmo-continue]')
  if (found.length !== 1) {
    throw new Error(`expected exactly one primary call to action, found ${found.length}`)
  }
  return found[0] as HTMLElement
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})

describe('the hub and the Learn landing resolve the same next section', () => {
  it.each(TRACKS)('sends a fresh %s learner to the first section of that track', (track) => {
    const { container } = render(<EcmoContinueCta supportMode={track} />)
    expect(targetOf(primaryCta(container))).toBe(sections(track)[0]!.id)
  })

  it('agrees with the landing for a fresh learner', () => {
    const hub = render(<CardiohelpHub />)
    const landing = render(<EcmoContinueCta supportMode="vv" />)

    // The hub opens on VV, which is the default the route and the landing also resolve to.
    expect(targetOf(primaryCta(hub.container))).toBe(targetOf(primaryCta(landing.container)))
    expect(targetOf(primaryCta(hub.container))).toBe(sections('vv')[0]!.id)
  })

  it('agrees with the landing after part of the runway has been worked', () => {
    const vv = sections('vv')
    // Sections one to four worked, plus a drill the learner jumped ahead to.
    seedProgress([vv[0]!.id, vv[1]!.id, vv[2]!.id, vv[3]!.id, 'startup-sensor-orientation'])

    const hub = render(<CardiohelpHub />)
    const landing = render(<EcmoContinueCta supportMode="vv" />)

    expect(targetOf(primaryCta(hub.container))).toBe(vv[4]!.id)
    expect(targetOf(primaryCta(landing.container))).toBe(targetOf(primaryCta(hub.container)))
  })

  it('agrees with the landing for a learner part-way through the drills', () => {
    const vv = sections('vv')
    seedProgress(vv.slice(0, 8).map((section) => section.id))

    const hub = render(<CardiohelpHub />)
    const landing = render(<EcmoContinueCta supportMode="vv" />)

    expect(targetOf(primaryCta(hub.container))).toBe(vv[8]!.id)
    expect(targetOf(primaryCta(landing.container))).toBe(targetOf(primaryCta(hub.container)))
  })

  it('names the section it is about to open', () => {
    const { container } = render(<CardiohelpHub />)
    const cta = primaryCta(container)

    expect(cta.textContent).toContain('Continue')
    expect(cta.textContent).toContain(sections('vv')[0]!.title)
  })

  it('shows a terminal state on both surfaces once the track is finished', () => {
    seedProgress(sections('vv').map((section) => section.id))

    const hub = render(<CardiohelpHub />)
    const landing = render(<EcmoContinueCta supportMode="vv" />)

    for (const container of [hub.container, landing.container]) {
      const cta = primaryCta(container)
      expect(cta.tagName).toBe('P')
      expect(cta.textContent).toMatch(/worked through/i)
    }
  })
})

describe('the hub no longer opens on the console drill', () => {
  it('does not send a fresh learner to the console tour', () => {
    const { container } = render(<CardiohelpHub />)
    expect(targetOf(primaryCta(container))).not.toBe('startup-sensor-orientation')
  })

  it('has retired the copy that promised the curriculum and delivered a drill', () => {
    const { container } = render(<CardiohelpHub />)

    expect(container.textContent).not.toContain('Start the curriculum')
    expect(container.textContent).not.toContain('Continue where you left off')
  })
})

describe('the hub counts what the registry actually holds', () => {
  it('states no count as a written-down number', () => {
    const { container } = render(<CardiohelpHub />)

    expect(container.textContent).not.toContain('Ten lessons per track')
    expect(container.textContent).not.toContain('Seven cases per track')
  })

  it.each(TRACKS)('renders a %s composition line that matches the pathway', (track) => {
    const { total, foundations, consoleOrientation, drills, capstone } =
      ecmoPathwayComposition(track)
    // The hub opens on VV; the VA numbers are identical, which this also confirms.
    render(<CardiohelpHub />)

    const composition = screen.getByText(/sections ·/)
    expect(composition.textContent).toBe(
      `${total} sections · ${foundations} foundations · console orientation · ${drills} drills · integration capstone`,
    )
    expect(foundations + consoleOrientation + drills + capstone).toBe(total)
  })

  it('derives the case count from the curriculum registry', () => {
    render(<CardiohelpHub />)
    expect(screen.getByText(/cases per track/).textContent).toContain(
      `${orderedCaseScenarioIds('vv').length} cases per track`,
    )
  })

  it('offers a browse affordance carrying the derived total', () => {
    render(<CardiohelpHub />)
    const browse = screen.getByRole('link', {
      name: `Browse all ${ecmoPathwayComposition('vv').total} sections`,
    })
    expect(browse).toHaveAttribute('href', '/cardiohelp-ecmo/learn?track=vv')
  })

  it('keeps both entry actions on the same track when the learner switches track', () => {
    // The browse link originally carried no track at all, and the landing falls back to VV, so
    // choosing VA and then browsing showed the VV pathway — one screen disagreeing with itself
    // about which pathway the learner had just entered.
    const { container } = render(<CardiohelpHub />)
    const browseHref = () =>
      screen.getByRole('link', { name: /^Browse all \d+ sections$/ }).getAttribute('href')

    expect(browseHref()).toContain('track=vv')

    fireEvent.click(screen.getByRole('radio', { name: /Peripheral VA ECMO/ }))

    expect(browseHref()).toContain('track=va')
    // And the primary action agrees with it.
    const primaryHref = primaryCta(container).getAttribute('href')
    expect(primaryHref).toContain('track=va')
  })
})

describe('the grouped view presents the whole pathway', () => {
  it('links every one of the seventeen sections, exactly once, in canonical order', () => {
    // The physiology sections were absent from this list entirely, which is how a learner could
    // read the hub and never learn they existed.
    const { container } = render(<CardiohelpHub />)
    const grouped = container.querySelector('ol[class*="hubUnitList"]')
    expect(grouped).not.toBeNull()

    const sectionLinks = Array.from(within(grouped as HTMLElement).getAllByRole('link')).filter(
      (link) => link.getAttribute('data-kind') === 'section',
    )

    expect(sectionLinks.map((link) => targetOf(link))).toEqual(
      sections('vv').map((section) => section.id),
    )
  })

  it('marks the resolved next section as the one to take up', () => {
    const vv = sections('vv')
    seedProgress([vv[0]!.id, vv[1]!.id])

    const { container } = render(<CardiohelpHub />)
    const flagged = container.querySelectorAll('[data-recommended="true"]')

    expect(flagged).toHaveLength(1)
    expect(targetOf(flagged[0] as HTMLElement)).toBe(vv[2]!.id)
  })

  it('marks worked sections in text as well as in state', () => {
    // Not colour alone: the chip carries the words, so the state survives a screen reader and a
    // monochrome display.
    const vv = sections('vv')
    seedProgress([vv[0]!.id])

    const { container } = render(<CardiohelpHub />)
    const worked = container.querySelector('[data-kind="section"][data-complete="true"]')

    expect(worked).not.toBeNull()
    expect(worked?.textContent).toContain('worked through')
  })
})
