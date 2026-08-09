/**
 * @jest-environment node
 */

import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

import { GET } from './route'

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

const mockCreateServerClient = jest.mocked(createServerClient)
const mockExchangeCodeForSession = jest.fn()
const mockVerifyOtp = jest.fn()
const originalNodeEnv = process.env.NODE_ENV
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

type CookieBridge = {
  getAll: () => Array<{ name: string; value: string }>
  setAll: (
    cookies: Array<{
      name: string
      value: string
      options?: {
        httpOnly?: boolean
        path?: string
        sameSite?: boolean | 'lax' | 'strict' | 'none'
      }
    }>,
  ) => void
}

function createRecoveryRequest(
  tokenHash: string,
  options: {
    next?: string
    type?: string
  } = {},
) {
  const url = new URL('https://0.0.0.0:8080/auth/callback')
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', options.type ?? 'recovery')
  url.searchParams.set('next', options.next ?? '/auth/update-password')
  return new NextRequest(url)
}

describe('main-site auth callback', () => {
  let cookieBridge: CookieBridge

  beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    process.env.NEXT_PUBLIC_SITE_URL = 'https://interventionalpulm.org'
    mockCreateServerClient.mockReset()
    mockExchangeCodeForSession.mockReset()
    mockVerifyOtp.mockReset()
    mockExchangeCodeForSession.mockImplementation(async () => {
      expect(cookieBridge.getAll()).toEqual([
        { name: 'sb-project-auth-token-code-verifier', value: 'pkce-verifier' },
      ])
      cookieBridge.setAll([
        {
          name: 'sb-project-auth-token',
          value: 'pkce-session',
          options: { httpOnly: false, path: '/', sameSite: 'lax' },
        },
      ])
      return { data: { session: { user: { id: 'user-1' } } }, error: null }
    })
    mockVerifyOtp.mockImplementation(async () => {
      cookieBridge.setAll([
        {
          name: 'sb-project-auth-token',
          value: 'verified-recovery-session',
          options: { httpOnly: false, path: '/', sameSite: 'lax' },
        },
      ])
      return { data: { session: { user: { id: 'user-1' } } }, error: null }
    })
    mockCreateServerClient.mockImplementation((_url, _key, options) => {
      cookieBridge = options.cookies as CookieBridge
      return {
        auth: {
          exchangeCodeForSession: mockExchangeCodeForSession,
          verifyOtp: mockVerifyOtp,
        },
      } as ReturnType<typeof createServerClient>
    })
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV')
    } else {
      Object.assign(process.env, { NODE_ENV: originalNodeEnv })
    }

    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    }

    jest.restoreAllMocks()
  })

  describe('PKCE handoff', () => {
    it('uses the canonical production origin while exchanging PKCE and returning the session cookie', async () => {
      const request = new NextRequest(
        'https://0.0.0.0:8080/auth/callback?code=recovery-code&next=%2Fauth%2Fupdate-password',
        {
          headers: {
            cookie: 'sb-project-auth-token-code-verifier=pkce-verifier',
          },
        },
      )

      const response = await GET(request)
      const location = response.headers.get('location')

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('recovery-code')
      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(response.cookies.get('sb-project-auth-token')?.value).toBe('pkce-session')
      expect(location).toBe('https://interventionalpulm.org/auth/update-password')
      expect(location).not.toMatch(/0\.0\.0\.0|localhost|:8080/i)
    })

    it('fails closed without consuming the PKCE code when the production site URL is missing', async () => {
      delete process.env.NEXT_PUBLIC_SITE_URL
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const request = new NextRequest(
        'https://0.0.0.0:8080/auth/callback?code=recovery-code&next=%2Fauth%2Fupdate-password',
      )

      const response = await GET(request)

      expect(response.status).toBe(500)
      expect(response.headers.get('location')).toBeNull()
      expect(mockCreateServerClient).not.toHaveBeenCalled()
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalledWith(
        'Authentication callback requires NEXT_PUBLIC_SITE_URL to be a valid public HTTPS URL in production',
      )
    })

    it.each(['not-a-url', 'javascript:alert(1)', 'http://localhost:3110'])(
      'fails closed for an invalid production site URL: %s',
      async (siteUrl) => {
        process.env.NEXT_PUBLIC_SITE_URL = siteUrl
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const request = new NextRequest(
          'https://0.0.0.0:8080/auth/callback?code=recovery-code&next=%2Fauth%2Fupdate-password',
        )

        const response = await GET(request)

        expect(response.status).toBe(500)
        expect(response.headers.get('location')).toBeNull()
        expect(mockCreateServerClient).not.toHaveBeenCalled()
        expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
        expect(mockVerifyOtp).not.toHaveBeenCalled()
      },
    )

    it('falls back to the request origin only outside production', async () => {
      Object.assign(process.env, { NODE_ENV: 'development' })
      delete process.env.NEXT_PUBLIC_SITE_URL
      const request = new NextRequest(
        'http://localhost:3110/auth/callback?code=recovery-code&next=%2Fauth%2Fupdate-password',
        {
          headers: {
            cookie: 'sb-project-auth-token-code-verifier=pkce-verifier',
          },
        },
      )

      const response = await GET(request)

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('recovery-code')
      expect(response.cookies.get('sb-project-auth-token')?.value).toBe('pkce-session')
      expect(response.headers.get('location')).toBe('http://localhost:3110/auth/update-password')
    })

    it.each([
      'https://evil.example/steal-session',
      '//evil.example/steal-session',
      'javascript:alert(1)',
    ])('falls back safely when next is an absolute or malicious destination: %s', async (next) => {
      const request = new NextRequest(
        `https://0.0.0.0:8080/auth/callback?code=recovery-code&next=${encodeURIComponent(next)}`,
        {
          headers: {
            cookie: 'sb-project-auth-token-code-verifier=pkce-verifier',
          },
        },
      )

      const response = await GET(request)

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('recovery-code')
      expect(response.headers.get('location')).toBe('https://interventionalpulm.org/dashboard')
      expect(response.headers.get('location')).not.toContain('evil.example')
      expect(response.headers.get('location')).not.toContain('0.0.0.0')
    })

    it('preserves the canonical destination and safe auth error when session exchange fails', async () => {
      mockExchangeCodeForSession.mockImplementationOnce(async () => ({
        data: { session: null, user: null },
        error: new Error('invalid recovery code'),
      }))
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const request = new NextRequest(
        'https://0.0.0.0:8080/auth/callback?code=bad-code&next=%2Fauth%2Fupdate-password',
      )

      const response = await GET(request)

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('bad-code')
      expect(response.headers.get('location')).toBe(
        'https://interventionalpulm.org/auth/update-password?authError=session-exchange-failed',
      )
      expect(consoleError).toHaveBeenCalledWith('Supabase session exchange failed')
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('bad-code')
    })
  })

  describe('recovery token-hash handoff', () => {
    it('verifies only recovery tokens, returns session cookies, and redirects to the password form', async () => {
      const tokenHash = 'fixture-recovery-token-hash'
      const response = await GET(createRecoveryRequest(tokenHash))
      const location = response.headers.get('location')
      const body = await response.text()

      expect(mockVerifyOtp).toHaveBeenCalledTimes(1)
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: tokenHash,
        type: 'recovery',
      })
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
      expect(response.cookies.get('sb-project-auth-token')?.value).toBe('verified-recovery-session')
      expect(location).toBe('https://interventionalpulm.org/auth/update-password')
      expect(`${location}${body}`).not.toContain(tokenHash)
    })

    it.each([
      ['missing', undefined],
      ['malformed', 'not-a-url'],
      ['non-HTTPS', 'http://interventionalpulm.org'],
      ['loopback', 'https://127.0.0.1'],
    ] as const)(
      'returns 500 before verifying the token when production site configuration is %s',
      async (_description, siteUrl) => {
        if (siteUrl === undefined) {
          delete process.env.NEXT_PUBLIC_SITE_URL
        } else {
          process.env.NEXT_PUBLIC_SITE_URL = siteUrl
        }
        jest.spyOn(console, 'error').mockImplementation(() => undefined)

        const response = await GET(createRecoveryRequest('unconsumed-token-hash'))

        expect(response.status).toBe(500)
        expect(response.headers.get('location')).toBeNull()
        expect(mockCreateServerClient).not.toHaveBeenCalled()
        expect(mockVerifyOtp).not.toHaveBeenCalled()
        expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
      },
    )

    it('returns an invalid or expired token to the safe destination without exposing it', async () => {
      const tokenHash = 'expired-secret-token-hash'
      mockVerifyOtp.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: new Error('Token has expired or is invalid'),
      })
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      const response = await GET(createRecoveryRequest(tokenHash))
      const location = response.headers.get('location')
      const body = await response.text()

      expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: tokenHash, type: 'recovery' })
      expect(location).toBe(
        'https://interventionalpulm.org/auth/update-password?authError=session-exchange-failed',
      )
      expect(`${location}${body}`).not.toContain(tokenHash)
      expect(consoleError).toHaveBeenCalledWith('Supabase recovery token verification failed')
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(tokenHash)
    })

    it.each([
      'https://evil.example/steal-session',
      '//evil.example/steal-session',
      'javascript:alert(1)',
    ])('sanitizes a malicious recovery next destination: %s', async (next) => {
      const tokenHash = 'fixture-recovery-token-hash'
      const response = await GET(createRecoveryRequest(tokenHash, { next }))
      const location = response.headers.get('location')

      expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: tokenHash, type: 'recovery' })
      expect(location).toBe('https://interventionalpulm.org/dashboard')
      expect(location).not.toContain('evil.example')
      expect(location).not.toContain(tokenHash)
    })
  })

  describe('strict main-site input contract', () => {
    it.each(['signup', 'invite', 'magiclink', 'email_change', 'email', 'arbitrary'])(
      'does not verify a token hash with unsupported type %s',
      async (type) => {
        const tokenHash = `secret-${type}-token`
        const response = await GET(createRecoveryRequest(tokenHash, { type }))
        const body = await response.text()

        expect(response.status).toBe(400)
        expect(response.headers.get('location')).toBeNull()
        expect(mockCreateServerClient).not.toHaveBeenCalled()
        expect(mockVerifyOtp).not.toHaveBeenCalled()
        expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
        expect(body).toBe('Authentication callback link is invalid or incomplete.')
        expect(body).not.toContain(tokenHash)
      },
    )

    it('does not verify a token hash without type=recovery', async () => {
      const tokenHash = 'secret-token-without-type'
      const url = new URL('https://0.0.0.0:8080/auth/callback')
      url.searchParams.set('token_hash', tokenHash)
      url.searchParams.set('next', '/auth/update-password')

      const response = await GET(new NextRequest(url))
      const body = await response.text()

      expect(response.status).toBe(400)
      expect(mockCreateServerClient).not.toHaveBeenCalled()
      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(body).not.toContain(tokenHash)
    })

    it('does not invoke token verification when type=recovery has no token hash', async () => {
      const response = await GET(
        new NextRequest(
          'https://0.0.0.0:8080/auth/callback?type=recovery&next=%2Fauth%2Fupdate-password',
        ),
      )

      expect(response.status).toBe(400)
      expect(mockCreateServerClient).not.toHaveBeenCalled()
      expect(mockVerifyOtp).not.toHaveBeenCalled()
    })

    it('rejects duplicate OTP types rather than casting through the caller input', async () => {
      const response = await GET(
        new NextRequest(
          'https://0.0.0.0:8080/auth/callback?token_hash=secret-token&type=recovery&type=signup&next=%2Fauth%2Fupdate-password',
        ),
      )

      expect(response.status).toBe(400)
      expect(mockCreateServerClient).not.toHaveBeenCalled()
      expect(mockVerifyOtp).not.toHaveBeenCalled()
    })

    it('fails closed without consuming either credential when code and token hash are combined', async () => {
      const tokenHash = 'secret-combined-token'
      const url = new URL('https://0.0.0.0:8080/auth/callback')
      url.searchParams.set('code', 'combined-pkce-code')
      url.searchParams.set('token_hash', tokenHash)
      url.searchParams.set('type', 'recovery')
      url.searchParams.set('next', '/auth/update-password')

      const response = await GET(new NextRequest(url))
      const body = await response.text()

      expect(response.status).toBe(400)
      expect(response.headers.get('location')).toBeNull()
      expect(mockCreateServerClient).not.toHaveBeenCalled()
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(body).not.toContain(tokenHash)
      expect(body).not.toContain('combined-pkce-code')
    })

    it('renders a main-site error instead of the shared-app page when no handoff is present', async () => {
      const response = await GET(new NextRequest('https://0.0.0.0:8080/auth/callback'))
      const body = await response.text()

      expect(response.status).toBe(400)
      expect(body).toBe('Authentication callback link is invalid or incomplete.')
      expect(body).not.toContain('missing an application target')
      expect(mockCreateServerClient).not.toHaveBeenCalled()
    })
  })

  it('keeps the shared application callback independent of main-site token verification', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const request = new NextRequest(
      'https://0.0.0.0:8080/auth/callback?app=socal-ebus-course&token_hash=shared-token&type=recovery',
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(await response.text()).toContain('socal-ebus-course')
    expect(mockCreateServerClient).not.toHaveBeenCalled()
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })
})
