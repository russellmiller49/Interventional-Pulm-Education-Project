import { buildSignInRedirectUrl, resolvePostAuthRedirectPath } from './auth-redirect'

describe('resolvePostAuthRedirectPath', () => {
  it('returns the provided internal path when it is safe', () => {
    expect(resolvePostAuthRedirectPath('/socal-ebus-course?tab=prep')).toBe(
      '/socal-ebus-course?tab=prep',
    )
  })

  it('falls back for external or malformed values', () => {
    expect(resolvePostAuthRedirectPath('https://evil.example')).toBe('/dashboard')
    expect(resolvePostAuthRedirectPath('//evil.example')).toBe('/dashboard')
    expect(resolvePostAuthRedirectPath('dashboard')).toBe('/dashboard')
  })
})

describe('buildSignInRedirectUrl', () => {
  it('includes the safe next path on the callback URL', () => {
    expect(
      buildSignInRedirectUrl('https://interventionalpulm.org', '/socal-ebus-course?mode=sync'),
    ).toBe('https://interventionalpulm.org/auth/callback?next=%2Fsocal-ebus-course%3Fmode%3Dsync')
  })
})
