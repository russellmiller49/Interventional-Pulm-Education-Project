import { normalizePostAuthNextPath } from './auth-next-path'

describe('auth next-path normalization', () => {
  it('localizes fallback destinations for direct localized auth visits', () => {
    expect(normalizePostAuthNextPath(null, 'es')).toBe('/es/dashboard')
    expect(normalizePostAuthNextPath(null, 'zh-CN')).toBe('/zh-CN/dashboard')
  })

  it('localizes unprefixed app destinations', () => {
    expect(normalizePostAuthNextPath('/journal-club-podcasts?tab=latest', 'es')).toBe(
      '/es/journal-club-podcasts?tab=latest',
    )
  })

  it('preserves already localized app destinations', () => {
    expect(normalizePostAuthNextPath('/zh-CN/ebus-training', 'es')).toBe('/zh-CN/ebus-training')
  })

  it('does not redirect back into localized auth pages after sign-in', () => {
    expect(normalizePostAuthNextPath('/es/login?next=/admin', 'es')).toBe('/es/dashboard')
    expect(normalizePostAuthNextPath('/zh-CN/signup', 'zh-CN')).toBe('/zh-CN/dashboard')
  })
})
