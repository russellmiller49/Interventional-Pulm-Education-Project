import fs from 'node:fs'
import path from 'node:path'

import sitemap from '@/app/sitemap'
import { betaModules } from '@/features/module-beta/catalog'
import { betaRollout } from '@/features/module-beta/rollout'
import { isUnlistedModulePath, isVisibleModulePath } from '@/lib/draft-modules'
import { moduleAccessMode, nonPublicModules } from '@/lib/non-public-modules'
import { searchSite } from '@/lib/site-search'
import { isPublicPath, isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'

import {
  DOLPHIN_BRONCHOSCOPY_MODULE_ID,
  DOLPHIN_BRONCHOSCOPY_RELEASE_STAGE,
} from '../content/release'
import {
  DOLPHIN_ANATOMY_HREF,
  DOLPHIN_ASSESS_HREF,
  DOLPHIN_BRONCHOSCOPY_NAV_BASE,
  DOLPHIN_LEARN_HREF,
  DOLPHIN_PRACTICE_HREF,
  DOLPHIN_REFERENCE_HREF,
  DOLPHIN_SIMULATOR_HREF,
} from '../content/routes'

/**
 * The module is in development: reachable by direct link without an account, noindex, absent from
 * navigation, search and the sitemap. The two dolphin pages it was built on keep their own
 * addresses and link to it; nothing redirects.
 */
describe('the in-development boundary', () => {
  const routes = [
    DOLPHIN_BRONCHOSCOPY_NAV_BASE,
    DOLPHIN_LEARN_HREF,
    DOLPHIN_PRACTICE_HREF,
    DOLPHIN_ASSESS_HREF,
    DOLPHIN_REFERENCE_HREF,
  ]

  it('reaches every route by direct link and hides them all from navigation', () => {
    expect(DOLPHIN_BRONCHOSCOPY_RELEASE_STAGE).toBe('unlisted-preview')
    for (const route of routes) {
      expect(isPublicPath(route)).toBe(true)
      expect(isPublicUnlistedPath(route)).toBe(true)
      expect(isUnlistedModulePath(route)).toBe(true)
      expect(isVisibleModulePath(route, { isAdmin: true })).toBe(false)
    }
    for (const locale of ['es', 'zh-CN']) {
      expect(isPublicUnlistedPath(`/${locale}${DOLPHIN_LEARN_HREF}`)).toBe(true)
      expect(isUnlistedModulePath(`/${locale}${DOLPHIN_BRONCHOSCOPY_NAV_BASE}`)).toBe(true)
    }
  })

  it('is absent from site search and the sitemap', () => {
    expect(
      searchSite('Dolphin Bronchoscopy').some((r) => r.href === DOLPHIN_BRONCHOSCOPY_NAV_BASE),
    ).toBe(false)
    expect(sitemap().some((entry) => entry.url.endsWith(DOLPHIN_BRONCHOSCOPY_NAV_BASE))).toBe(false)
  })

  it('is listed on the admin index as direct-link, with the two sandboxes marked as its own', () => {
    const entry = nonPublicModules.find((item) => item.path === DOLPHIN_BRONCHOSCOPY_NAV_BASE)
    expect(entry?.title).toBe('Dolphin Bronchoscopy')
    expect(moduleAccessMode(DOLPHIN_BRONCHOSCOPY_NAV_BASE)).toBe('direct-link')
    for (const sandbox of [DOLPHIN_SIMULATOR_HREF, DOLPHIN_ANATOMY_HREF]) {
      const listed = nonPublicModules.find((item) => item.path === sandbox)
      expect(listed?.summary).toMatch(/Sandbox used by the Dolphin Bronchoscopy module/)
      expect(isPublicUnlistedPath(sandbox)).toBe(true)
    }
  })

  it('collapses its subroutes into one analytics id', () => {
    expect(DOLPHIN_BRONCHOSCOPY_MODULE_ID).toBe('dolphin-bronchoscopy')
    for (const route of routes) expect(resolveSiteModuleId(route)).toBe('dolphin-bronchoscopy')
    expect(resolveSiteModuleId(`/es${DOLPHIN_LEARN_HREF}`)).toBe('dolphin-bronchoscopy')
  })

  it('joins the development beta hub with a framing rule and a feedback migration', () => {
    expect(
      betaModules.some(
        (m) => m.id === 'dolphin-bronchoscopy' && m.path === DOLPHIN_BRONCHOSCOPY_NAV_BASE,
      ),
    ).toBe(true)
    expect(betaRollout['dolphin-bronchoscopy']).toEqual({ stage: 'preview' })
    const config = fs.readFileSync(path.join(process.cwd(), 'next.config.mjs'), 'utf8')
    expect(config).toContain("'/dolphin-bronchoscopy/:path*'")
    const migrations = fs
      .readdirSync(path.join(process.cwd(), 'supabase/migrations'))
      .filter((file) => file.includes('module_beta_feedback'))
      .sort()
    const newest = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations', migrations.at(-1)!),
      'utf8',
    )
    for (const entry of betaModules) expect(newest).toContain(`'${entry.id}'`)
  })

  it('links the two sandbox pages to the module, without redirecting them', () => {
    for (const page of [
      'learn/anatomy/dolphin-airway/page.tsx',
      'learn/anatomy/dolphin/page.tsx',
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), 'src/app/[locale]', page), 'utf8')
      expect(source).toContain('Part of the Dolphin Bronchoscopy module')
      expect(source).not.toMatch(/\bredirect\(/)
    }
  })
})
