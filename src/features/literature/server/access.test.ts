import { supabaseServer } from '@/lib/supabase/server'

import { requireLiteratureSiteAdminApi } from './access'

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))

const mockedSupabaseServer = jest.mocked(supabaseServer)

function entitlementQuery(result: {
  data: { entitlement: string } | null
  error: { code: string } | null
}) {
  const chain = {
    select: jest.fn(),
    eq: jest.fn(),
    or: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.or.mockReturnValue(chain)
  return chain
}

function mockClient(options: {
  entitlement?: { entitlement: string } | null
  entitlementError?: { code: string } | null
  user: {
    id: string
    email: string
    email_confirmed_at: string | null
  } | null
}) {
  const query = entitlementQuery({
    data: options.entitlement ?? null,
    error: options.entitlementError ?? null,
  })
  mockedSupabaseServer.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: options.user },
        error: null,
      }),
    },
    from: jest.fn().mockReturnValue(query),
  } as never)
}

describe('literature API authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects an unauthenticated request', async () => {
    mockClient({ user: null })

    const result = await requireLiteratureSiteAdminApi()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it('rejects a signed-in user without site_admin', async () => {
    mockClient({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'reader@example.com',
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
      },
      entitlement: null,
    })

    const result = await requireLiteratureSiteAdminApi()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it('allows a verified user with an active site_admin entitlement', async () => {
    mockClient({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
      },
      entitlement: { entitlement: 'site_admin' },
    })

    const result = await requireLiteratureSiteAdminApi()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.email).toBe('admin@example.com')
    }
  })

  it('returns a service error when entitlement lookup is unavailable', async () => {
    mockClient({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
      },
      entitlementError: { code: 'XX000' },
    })

    const result = await requireLiteratureSiteAdminApi()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(503)
    }
  })
})
