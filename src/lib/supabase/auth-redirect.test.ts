import {
  buildSignInRedirectUrl,
  resolvePostAuthRedirectPath,
  resolveSharedAuthCallbackRedirect,
} from './auth-redirect'

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

describe('resolveSharedAuthCallbackRedirect', () => {
  it('routes the SoCal EBUS recovery hash to the embedded app and infers reset mode', () => {
    expect(
      resolveSharedAuthCallbackRedirect(
        '?app=socal-ebus-course',
        '#access_token=token.value&refresh_token=refresh.value&type=recovery',
      ),
    ).toEqual({
      status: 'ok',
      app: 'socal-ebus-course',
      destination:
        '/socal-ebus-course/app/#/auth?mode=reset-password&authMode=reset-password&access_token=token.value&refresh_token=refresh.value&type=recovery',
    })
  })

  it('preserves query token segments without forwarding the central app parameter', () => {
    expect(
      resolveSharedAuthCallbackRedirect(
        '?app=socal-ebus-course&access_token=abc%2F123&refresh_token=def%2B456&type=recovery',
        '',
      ),
    ).toEqual({
      status: 'ok',
      app: 'socal-ebus-course',
      destination:
        '/socal-ebus-course/app/#/auth?mode=reset-password&authMode=reset-password&access_token=abc%2F123&refresh_token=def%2B456&type=recovery',
    })
  })

  it('preserves an explicit authMode parameter', () => {
    expect(
      resolveSharedAuthCallbackRedirect(
        '?authMode=reset-password&app=socal-ebus-course',
        '#type=recovery&access_token=token',
      ),
    ).toEqual({
      status: 'ok',
      app: 'socal-ebus-course',
      destination:
        '/socal-ebus-course/app/#/auth?mode=reset-password&authMode=reset-password&type=recovery&access_token=token',
    })
  })

  it('rejects missing or unknown application targets', () => {
    expect(resolveSharedAuthCallbackRedirect('', '#type=recovery')).toEqual({
      status: 'error',
      reason: 'missing-app',
    })
    expect(resolveSharedAuthCallbackRedirect('?app=unknown', '#type=recovery')).toEqual({
      status: 'error',
      reason: 'unknown-app',
    })
  })
})
