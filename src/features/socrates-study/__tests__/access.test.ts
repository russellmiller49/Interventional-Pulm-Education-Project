/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ supabaseServer: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createSupabaseAdmin: jest.fn() }))
import { supabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { requireSocratesUser, allRows } from '../server/service'

const user = {
  id: '10000000-0000-4000-8000-000000000001',
  email_confirmed_at: '2026-09-22T00:00:00Z',
  is_anonymous: false,
}
const getUser = jest.fn()
const query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), or: jest.fn() }
const from = jest.fn()
beforeEach(() => {
  jest.resetAllMocks()
  for (const method of [query.select, query.eq, query.in]) method.mockReturnValue(query)
  from.mockReturnValue(query)
  getUser.mockResolvedValue({ data: { user }, error: null })
  query.or.mockResolvedValue({ data: [{ entitlement: 'socrates_participant' }], error: null })
  jest
    .mocked(supabaseServer)
    .mockResolvedValue({ auth: { getUser }, from } as unknown as Awaited<
      ReturnType<typeof supabaseServer>
    >)
})
test.each([null, { ...user, is_anonymous: true }, { ...user, email_confirmed_at: null }])(
  'unverified/anonymous identity is denied before privileged reads: %j',
  async (identity) => {
    getUser.mockResolvedValue({ data: { user: identity }, error: null })
    await expect(requireSocratesUser()).rejects.toMatchObject({ status: 401 })
    expect(createSupabaseAdmin).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  },
)
test('participant authorization checks own active entitlement and expiry, then denies admin use', async () => {
  await expect(requireSocratesUser()).resolves.toMatchObject({ user, isAdmin: false })
  expect(query.eq).toHaveBeenCalledWith('user_id', user.id)
  expect(query.eq).toHaveBeenCalledWith('status', 'active')
  expect(query.or).toHaveBeenCalledWith(
    expect.stringContaining('expires_at.is.null,expires_at.gt.'),
  )
  await expect(requireSocratesUser(true)).rejects.toMatchObject({ status: 403 })
})
test('missing entitlement and entitlement lookup failure fail closed; site admin is allowed', async () => {
  query.or.mockResolvedValueOnce({ data: [], error: null })
  await expect(requireSocratesUser()).rejects.toMatchObject({ status: 403 })
  query.or.mockResolvedValueOnce({ data: null, error: { message: 'failure' } })
  await expect(requireSocratesUser()).rejects.toMatchObject({ status: 503 })
  query.or.mockResolvedValueOnce({ data: [{ entitlement: 'site_admin' }], error: null })
  await expect(requireSocratesUser(true)).resolves.toMatchObject({ isAdmin: true })
})
test('admin pagination retains records beyond the API cap with stable composite ordering', async () => {
  const pages = { select: jest.fn(), order: jest.fn(), range: jest.fn() }
  pages.select.mockReturnValue(pages)
  pages.order.mockReturnValue(pages)
  pages.range
    .mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
      error: null,
    })
    .mockResolvedValueOnce({ data: [{ id: 1000 }], error: null })
  jest
    .mocked(createSupabaseAdmin)
    .mockReturnValue({ from: jest.fn().mockReturnValue(pages) } as unknown as ReturnType<
      typeof createSupabaseAdmin
    >)
  expect(await allRows('socrates_test_attempts', ['study_id', 'id'])).toHaveLength(1001)
  expect(pages.range).toHaveBeenNthCalledWith(1, 0, 999)
  expect(pages.range).toHaveBeenNthCalledWith(2, 1000, 1999)
  expect(pages.order).toHaveBeenCalledWith('study_id')
  expect(pages.order).toHaveBeenCalledWith('id')
})
