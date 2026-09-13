/** @jest-environment node */
import { requireFeedbackUser, hasSameOrigin, readFeedbackForm } from './server'
import { supabaseServer } from '@/lib/supabase/server'
jest.mock('@/lib/supabase/server', () => ({ supabaseServer: jest.fn() }))
const mockServer = jest.mocked(supabaseServer)
const account = { id: 'tester', email: 'tester@example.org', email_confirmed_at: '2026-09-12' }
function setup(user: unknown, entitlement: unknown = null, accessError: unknown = null) {
  const query: Record<string, jest.Mock> = {}
  for (const key of ['select', 'eq', 'or']) query[key] = jest.fn(() => query)
  query.maybeSingle = jest.fn(async () => ({ data: entitlement, error: accessError }))
  mockServer.mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) },
    from: jest.fn(() => query),
  } as never)
  return query
}
describe('feedback account authorization', () => {
  it('rejects signed-out, anonymous, and unverified users', async () => {
    for (const user of [
      null,
      { ...account, is_anonymous: true },
      { ...account, email_confirmed_at: null },
    ]) {
      setup(user)
      expect((await requireFeedbackUser()).ok).toBe(false)
    }
  })
  it('accepts verified main-site accounts for submissions', async () => {
    setup(account)
    expect((await requireFeedbackUser()).ok).toBe(true)
  })
  it('restricts review to current, active, unexpired site-admin entitlements', async () => {
    setup(account)
    expect((await requireFeedbackUser(true)).ok).toBe(false)
    const query = setup(account, { entitlement: 'site_admin' })
    expect((await requireFeedbackUser(true)).ok).toBe(true)
    expect(query.eq).toHaveBeenCalledWith('user_id', 'tester')
    expect(query.eq).toHaveBeenCalledWith('status', 'active')
    expect(query.or).toHaveBeenCalledWith(
      expect.stringMatching(/^expires_at.is.null,expires_at.gt./),
    )
  })
  it('fails closed when entitlement lookup is unavailable', async () => {
    setup(account, null, { message: 'offline' })
    const result = await requireFeedbackUser(true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(503)
  })
  it('rejects cross-site submissions', () => {
    expect(
      hasSameOrigin(
        new Request('https://site.test/api/module-feedback', {
          headers: { origin: 'https://other.test' },
        }),
      ),
    ).toBe(false)
    expect(
      hasSameOrigin(
        new Request('https://site.test/api/module-feedback', {
          headers: { origin: 'https://site.test' },
        }),
      ),
    ).toBe(true)
  })
})

it('caps multipart streams without trusting Content-Length', async () => {
  const body = new FormData()
  body.set('comment', 'a'.repeat(1000))
  await expect(
    readFeedbackForm(new Request('https://site.test', { method: 'POST', body }), 100),
  ).rejects.toThrow(RangeError)
})
it('uses the requested host behind a reverse proxy', () => {
  expect(
    hasSameOrigin(
      new Request('http://localhost:3110/api/module-feedback', {
        headers: { host: 'site.test', origin: 'https://site.test', 'x-forwarded-proto': 'https' },
      }),
    ),
  ).toBe(true)
})
