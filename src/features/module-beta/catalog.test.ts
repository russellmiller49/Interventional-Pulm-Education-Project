/** @jest-environment node */
import { betaModules, betaModuleById, betaModuleForPath, feedbackPagePath } from './catalog'
import { nonPublicModules } from '@/lib/non-public-modules'
import { feedbackSchema, isPngScreenshot } from './schema'
import { isPublicPath, isPublicUnlistedPath, getRequiredEntitlement } from '@/lib/site-auth/access'
import { isVisibleModulePath } from '@/lib/draft-modules'

const report = {
  id: 'b8b3da51-5068-4c58-9ebd-3f846a27b337',
  moduleId: 'devices',
  pagePath: '/en/devices',
  comment: 'The label is hard to read.',
}

describe('beta module boundaries', () => {
  it('keeps Therapeutic Bronchoscopy in development, outside the beta catalog', () => {
    const path = '/admin/therapeutic-bronchoscopy'
    expect(nonPublicModules.some((entry) => entry.path === path)).toBe(true)
    expect(betaModuleById('therapeutic-bronchoscopy')).toBeUndefined()
    expect(betaModuleForPath(path)).toBeUndefined()
    expect(isPublicPath(path)).toBe(false)
    expect(getRequiredEntitlement(path, new URLSearchParams())).toBe('site_admin')
    expect(
      feedbackSchema.safeParse({ ...report, moduleId: 'therapeutic-bronchoscopy', pagePath: path })
        .success,
    ).toBe(false)
  })
  it.each(betaModules)('$id has a normal unlisted link and a protected beta version', (entry) => {
    expect(isPublicPath(`/en${entry.path}`)).toBe(true)
    expect(isPublicUnlistedPath(`/en${entry.path}`)).toBe(true)
    expect(getRequiredEntitlement(entry.path, new URLSearchParams())).toBeNull()
    expect(isVisibleModulePath(entry.path, { isAdmin: true })).toBe(false)
    expect(isPublicPath(`/en/development-beta/${entry.id}`)).toBe(false)
    expect(isVisibleModulePath(`/development-beta/${entry.id}`, { isAdmin: true })).toBe(false)
  })
  it('identifies related atlas and branch pages and rejects unrelated routes', () => {
    expect(betaModuleForPath('/es/clinical-roles/EBUS_SCOPE')?.id).toBe('devices')
    expect(betaModuleForPath('/branch-tracing/case-001')?.id).toBe('branch-tracing')
    expect(betaModuleForPath('/admin/users')).toBeUndefined()
    expect(betaModuleForPath('/devices-extra')).toBeUndefined()
  })
  it('keeps only lesson context from URLs, never tokens or arbitrary query values', () => {
    expect(
      feedbackPagePath(
        new URL('https://example.org/en/devices?token=secret&view=list&email=private#equipment'),
      ),
    ).toBe('/en/devices?view=list#equipment')
  })
  it('accepts a bounded comment and rejects a forged module or unsafe page', () => {
    expect(feedbackSchema.safeParse(report).success).toBe(true)
    for (const patch of [
      { comment: ' ' },
      { comment: 'a'.repeat(10001) },
      { pagePath: '//external.com' },
      { pagePath: '//[' },
      { pagePath: '/en/admin' },
      { moduleId: 'icu-hemodynamics' },
      { pagePath: '/en/devices?token=secret' },
      { pagePath: '/en/devices/../admin' },
      { pagePath: '/en/devices\\..\\admin' },
    ]) {
      expect(feedbackSchema.safeParse({ ...report, ...patch }).success).toBe(false)
    }
  })
  it('rejects non-PNG or oversized-dimension attachments', () => {
    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0,
      0, 0, 0, 0, 0, 0,
    ])
    expect(isPngScreenshot(png)).toBe(true)
    png[16] = 1
    expect(isPngScreenshot(png)).toBe(false)
    expect(isPngScreenshot(new TextEncoder().encode('<svg>unsafe</svg>'))).toBe(false)
  })
})

it.each([
  ['peripheral-imaging', 'field'],
  ['ebus-guided', 'acoustic-contact'],
])('preserves exact %s lesson section without auth parameters', (moduleId, section) => {
  const path = `/en/${moduleId}/learn?section=${section}`
  expect(
    feedbackPagePath(
      new URL(
        `https://site.test${path}&access_token=secret&redirect=private&email=owner@example.org`,
      ),
    ),
  ).toBe(path)
  expect(feedbackSchema.safeParse({ ...report, moduleId, pagePath: path }).success).toBe(true)
})
it('retains audited navigation selectors but rejects non-scalar values', () => {
  const path =
    '/en/mechanical-ventilation/practice?mode=guided&case=mv-1&device=hamilton&phase=apply&activity=oxygenation&track=vv&entry=check&focus=unit-1&seed=demo&start=1&nextLearn=pressure-system&scopeProfile=standard&output=reference'
  expect(feedbackPagePath(new URL(`https://site.test${path}`))).toBe(path)
  expect(
    feedbackPagePath(
      new URL(
        'https://site.test/en/ebus-guided/learn?section=owner%40example.org&redirect=foo&token=abc#access_token=secret',
      ),
    ),
  ).toBe('/en/ebus-guided/learn')
})
