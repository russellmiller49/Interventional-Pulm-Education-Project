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

describe('main-site auth callback', () => {
  let cookieBridge: CookieBridge

  beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    process.env.NEXT_PUBLIC_SITE_URL = 'https://interventionalpulm.org'
    mockCreateServerClient.mockReset()
    mockExchangeCodeForSession.mockReset()
    mockExchangeCodeForSession.mockImplementation(async () => {
      expect(cookieBridge.getAll()).toEqual([
        { name: 'sb-project-auth-token-code-verifier', value: 'pkce-verifier' },
      ])
      cookieBridge.setAll([
        {
          name: 'sb-project-auth-token',
          value: 'recovery-session',
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
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('recovery-session')
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
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('recovery-session')
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

  it('preserves the canonical destination and auth error when session exchange fails', async () => {
    mockExchangeCodeForSession.mockImplementationOnce(async () => ({
      data: { session: null, user: null },
      error: new Error('invalid recovery code'),
    }))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const request = new NextRequest(
      'https://0.0.0.0:8080/auth/callback?code=bad-code&next=%2Fauth%2Fupdate-password',
    )

    const response = await GET(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('bad-code')
    expect(response.headers.get('location')).toBe(
      'https://interventionalpulm.org/auth/update-password?authError=session-exchange-failed',
    )
  })

  it('keeps the shared application callback page independent of the main-site redirect origin', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const request = new NextRequest(
      'https://0.0.0.0:8080/auth/callback?app=socal-ebus-course&type=recovery',
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(await response.text()).toContain('socal-ebus-course')
    expect(mockCreateServerClient).not.toHaveBeenCalled()
  })
})
