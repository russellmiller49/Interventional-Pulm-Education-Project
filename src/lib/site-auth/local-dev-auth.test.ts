import {
  canIssueLocalDevAuth,
  hasValidLocalDevAuthCookie,
  isLocalDevAuthConfigured,
  isLocalDevHost,
  resolveLocalDevAuthNextPath,
} from './local-dev-auth'

const enabledEnv = {
  NODE_ENV: 'development',
  LOCAL_DEV_AUTH_ENABLED: '1',
  LOCAL_DEV_AUTH_TOKEN: 'local-secret-token',
}

describe('local development auth helpers', () => {
  it('requires explicit non-production configuration', () => {
    expect(isLocalDevAuthConfigured(enabledEnv)).toBe(true)
    expect(isLocalDevAuthConfigured({ ...enabledEnv, NODE_ENV: 'production' })).toBe(false)
    expect(isLocalDevAuthConfigured({ ...enabledEnv, LOCAL_DEV_AUTH_ENABLED: '0' })).toBe(false)
    expect(isLocalDevAuthConfigured({ ...enabledEnv, LOCAL_DEV_AUTH_TOKEN: '' })).toBe(false)
  })

  it('limits issuing and accepting local auth to localhost-style hosts', () => {
    expect(isLocalDevHost('localhost')).toBe(true)
    expect(isLocalDevHost('127.0.0.1')).toBe(true)
    expect(isLocalDevHost('[::1]')).toBe(true)
    expect(isLocalDevHost('interventionalpulm.org')).toBe(false)
  })

  it('issues local auth only for the configured token', () => {
    expect(
      canIssueLocalDevAuth(
        new URL('http://localhost:3001/api/local-dev-auth'),
        'local-secret-token',
        enabledEnv,
      ),
    ).toBe(true)
    expect(
      canIssueLocalDevAuth(
        new URL('http://localhost:3001/api/local-dev-auth'),
        'wrong-token',
        enabledEnv,
      ),
    ).toBe(false)
    expect(
      canIssueLocalDevAuth(
        new URL('https://interventionalpulm.org/api/local-dev-auth'),
        'local-secret-token',
        enabledEnv,
      ),
    ).toBe(false)
  })

  it('accepts the local auth cookie across protected local routes', () => {
    expect(
      hasValidLocalDevAuthCookie(
        new URL('http://localhost:3001/pleural-procedures/pleural-ultrasound/learn'),
        'local-secret-token',
        enabledEnv,
      ),
    ).toBe(true)
    expect(
      hasValidLocalDevAuthCookie(new URL('http://localhost:3001/admin'), 'wrong-token', enabledEnv),
    ).toBe(false)
  })

  it('normalizes the post-unlock redirect path', () => {
    expect(resolveLocalDevAuthNextPath('/pleural-procedures?tab=learn')).toBe(
      '/pleural-procedures?tab=learn',
    )
    expect(resolveLocalDevAuthNextPath('https://evil.example/path')).toBe('/')
    expect(resolveLocalDevAuthNextPath('//evil.example/path')).toBe('/')
    expect(resolveLocalDevAuthNextPath('/login?next=%2Fadmin')).toBe('/')
    expect(resolveLocalDevAuthNextPath('/api/local-dev-auth?token=x')).toBe('/')
  })
})
