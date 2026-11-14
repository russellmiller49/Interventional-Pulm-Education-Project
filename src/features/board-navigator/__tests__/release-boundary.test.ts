import sitemap from '@/app/sitemap'
import { isUnlistedModulePath, isVisibleModulePath } from '@/lib/draft-modules'
import { moduleAccessMode, nonPublicModules } from '@/lib/non-public-modules'
import { searchSite } from '@/lib/site-search'
import { isPublicPath, isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'

import {
  BOARD_NAVIGATOR_ANALYTICS_MODULE_ID,
  BOARD_NAVIGATOR_RELEASE_STAGE,
} from '../content/release'
import {
  BOARD_NAVIGATOR_CURRICULUM_HREF,
  BOARD_NAVIGATOR_LAB_HREF,
  BOARD_NAVIGATOR_MAP_HREF,
  BOARD_NAVIGATOR_NAV_BASE,
  BOARD_NAVIGATOR_PROGRESS_HREF,
  labHref,
  mapHref,
} from '../content/routes'

/**
 * The Navigator is a module in development: reachable by direct link, absent from navigation,
 * search and the sitemap, listed on the admin index of non-public modules.
 */
describe('the in-development boundary', () => {
  const routes = [
    BOARD_NAVIGATOR_NAV_BASE,
    BOARD_NAVIGATOR_MAP_HREF,
    BOARD_NAVIGATOR_LAB_HREF,
    BOARD_NAVIGATOR_PROGRESS_HREF,
    BOARD_NAVIGATOR_CURRICULUM_HREF,
  ]

  it('reaches every route by direct link without an account, and hides them all from navigation', () => {
    expect(BOARD_NAVIGATOR_RELEASE_STAGE).toBe('unlisted-preview')
    for (const route of routes) {
      expect(isPublicPath(route)).toBe(true)
      expect(isPublicUnlistedPath(route)).toBe(true)
      expect(isUnlistedModulePath(route)).toBe(true)
      expect(isVisibleModulePath(route, { isAdmin: true })).toBe(false)
    }
    for (const locale of ['es', 'zh-CN']) {
      expect(isPublicUnlistedPath(`/${locale}${BOARD_NAVIGATOR_LAB_HREF}`)).toBe(true)
      expect(isUnlistedModulePath(`/${locale}${BOARD_NAVIGATOR_NAV_BASE}`)).toBe(true)
    }
  })

  it('is absent from site search and the sitemap while it is in development', () => {
    expect(
      searchSite('Board Navigator').some((result) => result.href === BOARD_NAVIGATOR_NAV_BASE),
    ).toBe(false)
    expect(sitemap().some((entry) => entry.url.includes(BOARD_NAVIGATOR_NAV_BASE))).toBe(false)
  })

  it('is listed on the admin index of non-public modules, as direct-link', () => {
    const entry = nonPublicModules.find((item) => item.path === BOARD_NAVIGATOR_NAV_BASE)
    expect(entry?.title).toBe('IP Board Navigator')
    expect(moduleAccessMode(BOARD_NAVIGATOR_NAV_BASE)).toBe('direct-link')
  })

  it('collapses its screens into one analytics id', () => {
    expect(BOARD_NAVIGATOR_ANALYTICS_MODULE_ID).toBe('board-navigator')
    for (const route of routes) expect(resolveSiteModuleId(route)).toBe('board-navigator')
    expect(resolveSiteModuleId(`/es${BOARD_NAVIGATOR_MAP_HREF}`)).toBe('board-navigator')
  })

  it('builds lab and map links with the objective in the query string', () => {
    expect(labHref('ms-01')).toBe('/board-navigator/lab?objective=ms-01')
    expect(labHref('ms-01', 'review')).toBe('/board-navigator/lab?objective=ms-01&mode=review')
    expect(mapHref('pl-02')).toBe('/board-navigator/map?objective=pl-02')
    expect(mapHref()).toBe(BOARD_NAVIGATOR_MAP_HREF)
  })

  it('leaves the existing board-prep chapters where they are', () => {
    expect(searchSite('board prep').some((result) => result.href === '/board-prep')).toBe(true)
    expect(resolveSiteModuleId('/board-prep')).toBe('board-prep')
  })
})
