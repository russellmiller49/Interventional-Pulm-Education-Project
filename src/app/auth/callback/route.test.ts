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

  it('exchanges a PKCE code with the request verifier and returns the session cookie', async () => {
    const request = new NextRequest(
      'https://interventionalpulm.org/auth/callback?code=recovery-code&next=%2Fauth%2Fupdate-password',
      {
        headers: {
          cookie: 'sb-project-auth-token-code-verifier=pkce-verifier',
        },
      },
    )

    const response = await GET(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('recovery-code')
    expect(response.headers.get('location')).toBe(
      'https://interventionalpulm.org/auth/update-password',
    )
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('recovery-session')
  })
})
