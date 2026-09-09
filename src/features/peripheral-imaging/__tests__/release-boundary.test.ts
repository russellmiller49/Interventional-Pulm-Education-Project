import sitemap from '@/app/sitemap'
import { isUnlistedModulePath, isVisibleModulePath } from '@/lib/draft-modules'
import { moduleAccessMode, nonPublicModules } from '@/lib/non-public-modules'
import { searchSite } from '@/lib/site-search'
import { isPublicPath, isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'
import { pathShouldBypassLocaleRedirect } from '@/i18n/path'

import {
  PERIPHERAL_IMAGING_ANALYTICS_MODULE_ID,
  PERIPHERAL_IMAGING_RELEASE_STAGE,
} from '../content/release'
import {
  PERIPHERAL_IMAGING_ASSESS_HREF,
  PERIPHERAL_IMAGING_LEARN_HREF,
  PERIPHERAL_IMAGING_NAV_BASE,
  PERIPHERAL_IMAGING_PRACTICE_HREF,
} from '../content/routes'

/**
 * The course is a module in development: reachable by direct link, absent from navigation,
 * search and the sitemap, and separate from the original FluoroView simulator, which keeps
 * `/fluoroview` until the owner decides otherwise.
 */
describe('the in-development boundary', () => {
  const routes = [
    PERIPHERAL_IMAGING_NAV_BASE,
    PERIPHERAL_IMAGING_LEARN_HREF,
    PERIPHERAL_IMAGING_PRACTICE_HREF,
    PERIPHERAL_IMAGING_ASSESS_HREF,
  ]

  it('reaches every route by direct link without an account, and hides them all from navigation', () => {
    expect(PERIPHERAL_IMAGING_RELEASE_STAGE).toBe('unlisted-preview')
    for (const route of routes) {
      expect(isPublicPath(route)).toBe(true)
      expect(isPublicUnlistedPath(route)).toBe(true)
      expect(isUnlistedModulePath(route)).toBe(true)
      expect(isVisibleModulePath(route, { isAdmin: true })).toBe(false)
    }
    // Localized addresses get the same treatment, in every active locale.
    for (const locale of ['es', 'zh-CN']) {
      expect(isPublicUnlistedPath(`/${locale}${PERIPHERAL_IMAGING_LEARN_HREF}`)).toBe(true)
      expect(isUnlistedModulePath(`/${locale}${PERIPHERAL_IMAGING_NAV_BASE}`)).toBe(true)
    }
  })

  it('is absent from site search and the sitemap while it is in development', () => {
    expect(
      searchSite('Peripheral Bronchoscopy Imaging').some(
        (result) => result.href === PERIPHERAL_IMAGING_NAV_BASE,
      ),
    ).toBe(false)
    expect(sitemap().some((entry) => entry.url.endsWith(PERIPHERAL_IMAGING_NAV_BASE))).toBe(false)
  })

  it('is listed on the admin index of non-public modules, as direct-link', () => {
    const entry = nonPublicModules.find((item) => item.path === PERIPHERAL_IMAGING_NAV_BASE)
    expect(entry?.title).toBe('Peripheral Bronchoscopy Imaging')
    expect(moduleAccessMode(PERIPHERAL_IMAGING_NAV_BASE)).toBe('direct-link')
  })

  it('collapses its subroutes into one analytics id', () => {
    expect(PERIPHERAL_IMAGING_ANALYTICS_MODULE_ID).toBe('peripheral-imaging')
    for (const route of routes) {
      expect(resolveSiteModuleId(route)).toBe('peripheral-imaging')
    }
    expect(resolveSiteModuleId(`/es${PERIPHERAL_IMAGING_LEARN_HREF}`)).toBe('peripheral-imaging')
  })

  it('leaves the original FluoroView simulator alone', () => {
    // FluoroView keeps its route, its search entry and its own gate; this course did not take
    // it over. `/fluoroview/` is both a route and an asset root, which is why the whole prefix
    // skips the locale redirect — the course deliberately does not share that prefix.
    expect(searchSite('FluoroView').some((result) => result.href === '/fluoroview')).toBe(true)
    expect(pathShouldBypassLocaleRedirect('/fluoroview/draco/draco_decoder.js')).toBe(true)
    expect(pathShouldBypassLocaleRedirect(PERIPHERAL_IMAGING_LEARN_HREF)).toBe(false)
  })
})
