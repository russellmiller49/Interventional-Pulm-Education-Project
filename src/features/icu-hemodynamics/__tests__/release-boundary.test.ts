import sitemap from '@/app/sitemap'
import { isUnlistedModulePath } from '@/lib/draft-modules'
import { searchSite } from '@/lib/site-search'
import { isPublicPath, isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'
import { ICU_HEMODYNAMICS_ANALYTICS_MODULE_ID, ICU_HEMODYNAMICS_RELEASE_STAGE } from '../content'

describe('public-unlisted preview boundary', () => {
  it('is directly public, unlisted, and mapped to one stable analytics id', () => {
    expect(ICU_HEMODYNAMICS_RELEASE_STAGE).toBe('unlisted-preview')
    expect(ICU_HEMODYNAMICS_ANALYTICS_MODULE_ID).toBe('icu-hemodynamics')
    expect(isPublicPath('/icu-hemodynamics')).toBe(true)
    expect(isPublicUnlistedPath('/es/icu-hemodynamics')).toBe(true)
    expect(isUnlistedModulePath('/zh-CN/icu-hemodynamics')).toBe(true)
    expect(resolveSiteModuleId('/zh-CN/icu-hemodynamics')).toBe('icu-hemodynamics')
  })

  it('is absent from site search and sitemap while unlisted', () => {
    expect(
      searchSite('ICU Hemodynamics Lab').some((result) => result.href === '/icu-hemodynamics'),
    ).toBe(false)
    expect(sitemap().some((entry) => entry.url.endsWith('/icu-hemodynamics'))).toBe(false)
  })
})
