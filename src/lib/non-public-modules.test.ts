import {
  getNonPublicModuleStatuses,
  moduleAccessMode,
  nonPublicModuleGroups,
  nonPublicModules,
} from './non-public-modules'
import { isPublicPath, isPublicUnlistedPath, getRequiredEntitlement } from './site-auth/access'

describe('non-public module index', () => {
  it('never lists a module as non-public that is publicly indexable', () => {
    // The whole point of the page is "not part of the public site yet". A module that has
    // become fully public and indexable does not belong on it.
    const indexable = getNonPublicModuleStatuses().filter((entry) => entry.accessMode === 'public')
    expect(indexable.map((entry) => entry.path)).toEqual([])
  })

  it('keeps every listed module out of site navigation', () => {
    const visible = getNonPublicModuleStatuses().filter((entry) => !entry.hiddenFromNavigation)
    expect(visible.map((entry) => entry.path)).toEqual([])
  })

  it('uses only declared groups, and every group has at least one module', () => {
    for (const entry of nonPublicModules) {
      expect(nonPublicModuleGroups).toContain(entry.group)
    }
    for (const group of nonPublicModuleGroups) {
      expect(nonPublicModules.some((entry) => entry.group === group)).toBe(true)
    }
  })

  it('has no duplicate paths', () => {
    const paths = nonPublicModules.map((entry) => entry.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('reads access from the site gate rather than recording it', () => {
    // Derived, not stored — so the page cannot claim a level the proxy does not enforce.
    expect(moduleAccessMode('/critical-care')).toBe('direct-link')
    expect(moduleAccessMode('/login')).toBe('public')
    expect(moduleAccessMode('/dashboard')).toBe('sign-in')
  })
})

describe('beta direct-link access', () => {
  const betaLinkModules = [
    '/preference-cards',
    '/critical-care',
    '/pleural-procedures/pleural-ultrasound-simulator',
  ]

  it.each(betaLinkModules)('lets a signed-out beta tester open %s', (path) => {
    expect(isPublicPath(path)).toBe(true)
    // Public alone is not enough — it must also be unlisted, which is what applies
    // noindex/nofollow/noarchive in the proxy.
    expect(isPublicUnlistedPath(path)).toBe(true)
  })

  it('extends the preference-card bypass to its subroutes', () => {
    for (const path of [
      '/preference-cards/catalog',
      '/preference-cards/catalog/uses/AIRWAY_STENT_SILICONE_STRAIGHT',
      '/preference-cards/new',
      '/preference-cards/sets',
    ]) {
      expect(isPublicUnlistedPath(path)).toBe(true)
    }
  })

  it('still requires site_admin for the admin surfaces', () => {
    // Opening the module to beta testers must not open its admin pages.
    for (const path of [
      '/admin',
      '/admin/modules',
      '/admin/preference-cards/formulary',
      '/admin/preference-cards/catalog-qa',
    ]) {
      expect(getRequiredEntitlement(path, new URLSearchParams())).toBe('site_admin')
    }
  })

  it('leaves modules that were not opened up still requiring sign-in', () => {
    for (const path of [
      '/literature',
      '/rapid-onsite-cytology',
      '/pleural-procedures/pleuroscopy',
    ]) {
      expect(isPublicPath(path)).toBe(false)
    }
  })
})
