/** @jest-environment node */
import { POST, GET } from './route'
import { PATCH } from './[id]/route'
import { GET as imageGET } from './[id]/image/route'
import { requireFeedbackUser, feedbackJson } from '@/features/module-beta/server'
jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: null }))
jest.mock('@/features/module-beta/server', () => ({
  ...jest.requireActual('@/features/module-beta/server'),
  requireFeedbackUser: jest.fn(),
}))
const originalMode = process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE
const auth = jest.mocked(requireFeedbackUser)
afterEach(() => {
  if (originalMode === undefined) delete process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE
  else process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE = originalMode
})
it.each(['server', 'owner-local'])(
  'retains API auth and explicit missing-storage failures in %s',
  async (mode) => {
    process.env.NEXT_PUBLIC_MODULE_FEEDBACK_MODE = mode
    const request = () =>
      new Request('https://site.test/api/module-feedback', {
        method: 'POST',
        headers: { origin: 'https://site.test' },
      })
    const context = { params: Promise.resolve({ id: 'b8b3da51-5068-4c58-9ebd-3f846a27b337' }) }
    auth.mockResolvedValue({ ok: false, response: feedbackJson({ error: 'Sign in' }, 401) })
    expect((await POST(request())).status).toBe(401)
    auth.mockResolvedValue({ ok: true, user: { id: 'tester' } } as never)
    for (const response of [
      await POST(request()),
      await GET(request()),
      await PATCH(request(), context),
      await imageGET(request(), context),
    ]) {
      expect(response.status).toBe(503)
      expect((await response.json()).error).toContain('storage is not available')
    }
  },
)
