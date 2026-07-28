/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react'

import { postSiteAnalytics, resolveSiteModuleId } from '@/lib/analytics'

import { SiteUsageTracker } from './SiteUsageTracker'

let mockPathname = '/en/baxter-crrt'

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

jest.mock('@/lib/analytics', () => ({
  postSiteAnalytics: jest.fn(),
  resolveSiteModuleId: jest.fn(),
}))

describe('SiteUsageTracker review-boundary exclusions', () => {
  beforeEach(() => {
    mockPathname = '/en/baxter-crrt'
    jest.mocked(postSiteAnalytics).mockClear()
    jest.mocked(resolveSiteModuleId).mockReset()
  })

  it('does not create generic session or progress telemetry for the CRRT review route', () => {
    jest.mocked(resolveSiteModuleId).mockReturnValue('baxter-crrt')

    const { unmount } = render(<SiteUsageTracker />)

    expect(postSiteAnalytics).not.toHaveBeenCalled()
    unmount()
    expect(postSiteAnalytics).not.toHaveBeenCalled()
  })

  it('does not create generic lifecycle telemetry for the ICU Simulator review route', () => {
    mockPathname = '/en/icu-simulation/practice'
    jest.mocked(resolveSiteModuleId).mockReturnValue('icu-simulation')

    const { unmount } = render(<SiteUsageTracker />)

    expect(postSiteAnalytics).not.toHaveBeenCalled()
    unmount()
    expect(postSiteAnalytics).not.toHaveBeenCalled()
  })

  it('does not bypass the bounded schema with generic critical-care lifecycle telemetry', () => {
    mockPathname = '/en/critical-care'
    jest.mocked(resolveSiteModuleId).mockReturnValue('critical-care')

    const { unmount } = render(<SiteUsageTracker />)

    expect(postSiteAnalytics).not.toHaveBeenCalled()
    unmount()
    expect(postSiteAnalytics).not.toHaveBeenCalled()
  })

  it('preserves generic lifecycle tracking for other modules', () => {
    mockPathname = '/en/cardiohelp-ecmo'
    jest.mocked(resolveSiteModuleId).mockReturnValue('cardiohelp-ecmo')

    const { unmount } = render(<SiteUsageTracker />)

    expect(postSiteAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session_start',
        moduleId: 'cardiohelp-ecmo',
        routePath: '/en/cardiohelp-ecmo',
      }),
      { beacon: false },
    )

    unmount()
  })
})
