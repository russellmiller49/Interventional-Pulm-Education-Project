import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

import { CriticalCareHub } from '@/features/critical-care/components/CriticalCareHub'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import type { CriticalCareProgressReadResult } from '@/features/critical-care/progress/types'

import { IcuHemodynamicsOverviewV2 } from '../components/IcuHemodynamicsOverviewV2'
import { firstPacLearningPathwaySectionId, pacLearningPathwaySections } from '../content'

/**
 * H1.1 — the two surfaces a novice can arrive on must send them to the same place.
 *
 * H0/H1 rebuilt the module entry around signal validity but left the shared Critical Care hub
 * recommending `catheter-advancement`, because the hub's tie-break is the position of a seed in
 * `critical-care/content/activities` and that array had not moved. The module said "start here: can
 * I trust this pressure signal?" and the hub, one click earlier in the same session, said "start
 * here: advance the catheter".
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
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

const catalog = buildCriticalCarePublicClientCatalog()

beforeEach(() => {
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

function moduleStartHref(): string | null {
  const { unmount } = render(<IcuHemodynamicsOverviewV2 />)
  const href = screen
    .getByRole('link', { name: /Start here: can I trust this pressure signal\?/i })
    .getAttribute('href')
  unmount()
  return href
}

describe('hub and hemodynamics module entry agree on where a novice starts', () => {
  it('sends a new learner to the same activity from either surface', async () => {
    expect(await hubStartHref()).toBe(moduleStartHref())
  })

  it('sends them to the pressure system, which is the pathway’s first section', async () => {
    expect(firstPacLearningPathwaySectionId).toBe('pressure-system')
    expect(await hubStartHref()).toBe('/icu-hemodynamics/learn?activity=pressure-system')
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
