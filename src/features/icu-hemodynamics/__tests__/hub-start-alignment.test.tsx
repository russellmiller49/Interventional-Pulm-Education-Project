import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

import { CriticalCareHub } from '@/features/critical-care/components/CriticalCareHub'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import type { CriticalCareProgressReadResult } from '@/features/critical-care/progress/types'

import { IcuHemodynamicsOverviewV2 } from '../components/IcuHemodynamicsOverviewV2'
import { firstPacLearningPathwaySectionId, pacLearningPathwaySections } from '../content'
import { nextIncompleteHemodynamicsSection } from '../content/pathwayResolver'
import { createEmptyLearnRecord } from '../engine/learnProgress'

/**
 * H1.1 — the two surfaces a novice can arrive on must send them to the same place.
 *
 * H0/H1 rebuilt the module entry around signal validity but left the shared Critical Care hub
 * recommending `catheter-advancement`, because the hub's tie-break is the position of a seed in
 * `critical-care/content/activities` and that array had not moved. The module said "start here: can
 * I trust this pressure signal?" and the hub, one click earlier in the same session, said "start
 * here: advance the catheter".
 *
 * The flow rebuild (2026-09-05) replaced the module's hard-coded start link with one door: the
 * Continue call to action, resolved through `nextIncompleteHemodynamicsSection` over the stored
 * Learn record — which, for a fresh learner, is the pathway's first section. The hub still reads
 * catalog seed order. So the two surfaces still validate their agreement rather than deriving it.
 *
 * These render both surfaces and compare them with each other rather than with a literal href, so
 * a future reorder of either one alone fails here rather than shipping as a contradiction.
 */

const mockReadPublicCriticalCareProgress = jest.fn<CriticalCareProgressReadResult, []>()

jest.mock('@/features/critical-care/progress/publicClient', () => ({
  readPublicCriticalCareProgress: () => mockReadPublicCriticalCareProgress(),
}))

jest.mock('@/features/critical-care/publicAnalytics', () => ({
  recordCriticalCareDashboardEvent: jest.fn(),
}))

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    onClick,
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
      <a
        href={resolved}
        onClick={(event) => {
          event.preventDefault()
          onClick?.(event)
        }}
        {...props}
      >
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: jest.fn() }),
}))

const catalog = buildCriticalCarePublicClientCatalog()

beforeEach(() => {
  window.localStorage.clear()
  mockReadPublicCriticalCareProgress.mockReturnValue({
    envelope: { version: 1, activities: [], updatedAt: '1970-01-01T00:00:00.000Z' },
    normalizedSource: {
      moduleId: 'critical-care',
      storageKey: 'critical-care-activity-progress-v1',
      status: 'empty',
    },
    legacySources: [],
    notices: [],
  })
})

async function hubStartHref(): Promise<string | null> {
  const { unmount } = render(<CriticalCareHub catalog={catalog} />)
  const href = (await screen.findByRole('link', { name: 'Start here' })).getAttribute('href')
  unmount()
  return href
}

/** The module's own door: the one Continue call to action on the Overview, with nothing stored. */
function moduleStartHref(): string | null {
  const { container, unmount } = render(<IcuHemodynamicsOverviewV2 />)
  const doors = container.querySelectorAll('[data-hemodynamics-continue]')
  if (doors.length !== 1) {
    throw new Error(`expected exactly one primary call to action, found ${doors.length}`)
  }
  const door = doors[0] as HTMLElement
  // The stored record is read in an effect; with nothing stored it resolves to section one.
  expect(door).toHaveAttribute('data-hemodynamics-continue', 'resolved')
  const href = door.getAttribute('href')
  unmount()
  return href
}

describe('hub and hemodynamics module entry agree on where a novice starts', () => {
  it('sends a new learner to the same activity from either surface', async () => {
    expect(await hubStartHref()).toBe(moduleStartHref())
  })

  it('sends them to the orientation question, which is the pathway’s first section', async () => {
    expect(firstPacLearningPathwaySectionId).toBe('why-measure')
    // The resolver the door uses agrees, for a learner with nothing recorded.
    expect(nextIncompleteHemodynamicsSection(createEmptyLearnRecord())?.section.id).toBe(
      'why-measure',
    )
    expect(await hubStartHref()).toBe('/icu-hemodynamics/learn?activity=why-measure')
    expect(moduleStartHref()).toBe('/icu-hemodynamics/learn?activity=why-measure')
  })

  it('does not send them to the introducer', async () => {
    const href = await hubStartHref()
    expect(href).not.toContain('catheter-advancement')
    expect(pacLearningPathwaySections[0]?.id).not.toBe('catheter-advancement')
  })

  it('leaves the capstone as the last station, not the recommended start', async () => {
    const href = await hubStartHref()
    expect(href).not.toContain('pac-signal-validation')
    expect(pacLearningPathwaySections.at(-1)?.id).toBe('pac-signal-validation')
  })
})
