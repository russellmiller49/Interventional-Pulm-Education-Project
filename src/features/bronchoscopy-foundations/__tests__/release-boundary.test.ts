import sitemap from '@/app/sitemap'
import { isUnlistedModulePath, isVisibleModulePath } from '@/lib/draft-modules'
import { moduleAccessMode, nonPublicModules } from '@/lib/non-public-modules'
import { searchSite } from '@/lib/site-search'
import { isPublicPath, isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'
import { pathShouldBypassLocaleRedirect } from '@/i18n/path'

import {
  BRONCHOSCOPY_FOUNDATIONS_ANALYTICS_MODULE_ID,
  BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE,
} from '../content/release'
import {
  BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF,
  BRONCHOSCOPY_FOUNDATIONS_ATLAS_HREF,
  BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF,
  BRONCHOSCOPY_FOUNDATIONS_NAV_BASE,
  BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF,
  BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF,
} from '../content/routes'

/**
 * The course is a module in development: reachable by direct link, absent from navigation,
 * search and the sitemap, and separate from the earlier Intro Bronchoscopy course, which keeps
 * `/intro-bronchoscopy` until the owner decides on a cutover.
 */
describe('the in-development boundary', () => {
  const routes = [
    BRONCHOSCOPY_FOUNDATIONS_NAV_BASE,
    BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF,
    BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF,
    BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF,
    BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF,
    BRONCHOSCOPY_FOUNDATIONS_ATLAS_HREF,
  ]

  it('reaches every route by direct link without an account, and hides them all from navigation', () => {
    expect(BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE).toBe('unlisted-preview')
    for (const route of routes) {
      expect(isPublicPath(route)).toBe(true)
      expect(isPublicUnlistedPath(route)).toBe(true)
      expect(isUnlistedModulePath(route)).toBe(true)
      expect(isVisibleModulePath(route, { isAdmin: true })).toBe(false)
    }
    // Localized addresses get the same treatment, in every active locale.
    for (const locale of ['es', 'zh-CN']) {
      expect(isPublicUnlistedPath(`/${locale}${BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF}`)).toBe(true)
      expect(isPublicUnlistedPath(`/${locale}${BRONCHOSCOPY_FOUNDATIONS_ATLAS_HREF}`)).toBe(true)
      expect(isUnlistedModulePath(`/${locale}${BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}`)).toBe(true)
    }
  })

  it('is absent from site search and the sitemap while it is in development', () => {
    expect(
      searchSite('Bronchoscopy Foundations').some(
        (result) => result.href === BRONCHOSCOPY_FOUNDATIONS_NAV_BASE,
      ),
    ).toBe(false)
    expect(sitemap().some((entry) => entry.url.includes(BRONCHOSCOPY_FOUNDATIONS_NAV_BASE))).toBe(
      false,
    )
  })

  it('is listed on the admin index of non-public modules, as direct-link', () => {
    const entry = nonPublicModules.find((item) => item.path === BRONCHOSCOPY_FOUNDATIONS_NAV_BASE)
    expect(entry?.title).toBe('Bronchoscopy Foundations')
    expect(moduleAccessMode(BRONCHOSCOPY_FOUNDATIONS_NAV_BASE)).toBe('direct-link')
  })

  it('collapses its subroutes into one analytics id', () => {
    expect(BRONCHOSCOPY_FOUNDATIONS_ANALYTICS_MODULE_ID).toBe('bronchoscopy-foundations')
    for (const route of routes) {
      expect(resolveSiteModuleId(route)).toBe('bronchoscopy-foundations')
    }
    expect(resolveSiteModuleId(`/es${BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF}`)).toBe(
      'bronchoscopy-foundations',
    )
  })

  it('leaves the earlier Intro Bronchoscopy course alone', () => {
    // The earlier course keeps its address and its search entry; this course did not take it over.
    expect(
      searchSite('Intro Bronchoscopy').some((result) => result.href === '/intro-bronchoscopy'),
    ).toBe(true)
    expect(resolveSiteModuleId('/intro-bronchoscopy')).not.toBe('bronchoscopy-foundations')
  })

  it('lets its assets through the locale redirect by extension, and its pages not at all', () => {
    // The asset root shares the module prefix. An asset carries an extension, which is what the
    // redirect keys on, so page addresses and asset addresses never collide.
    expect(pathShouldBypassLocaleRedirect('/bronchoscopy-foundations/anatomy/manifest.json')).toBe(
      true,
    )
    expect(pathShouldBypassLocaleRedirect(BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF)).toBe(false)
    expect(pathShouldBypassLocaleRedirect(BRONCHOSCOPY_FOUNDATIONS_ATLAS_HREF)).toBe(false)
  })
})
