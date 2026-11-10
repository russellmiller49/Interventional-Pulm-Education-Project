/** @jest-environment node */
import { POST, GET } from './route'
import { PATCH } from './[id]/route'
import { GET as imageGET } from './[id]/image/route'
import { requireFeedbackUser, feedbackJson } from '@/features/module-beta/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

jest.mock('@/features/module-beta/server', () => ({
  ...jest.requireActual('@/features/module-beta/server'),
  requireFeedbackUser: jest.fn(),
}))
jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: jest.fn(), storage: { from: jest.fn() } },
}))
const auth = jest.mocked(requireFeedbackUser)
const from = jest.mocked(supabaseAdmin!.from)
const storageFrom = jest.mocked(supabaseAdmin!.storage.from)
const id = 'b8b3da51-5068-4c58-9ebd-3f846a27b337'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=',
  'base64',
)
const screenshot = () => new Blob([png], { type: 'image/png' })
function request(extra: Record<string, string> = {}, screenshot?: Blob) {
  const body = new FormData()
  for (const [key, value] of Object.entries({
    id,
    moduleId: 'devices',
    pagePath: '/en/devices',
    comment: 'Improve label contrast.',
    ...extra,
  }))
    body.set(key, value)
  if (screenshot) body.set('screenshot', screenshot, 'screenshot.png')
  return new Request('https://site.test/api/module-feedback', {
    method: 'POST',
    headers: { origin: 'https://site.test' },
    body,
  })
}
function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'order', 'range', 'insert', 'update'])
    chain[method] = jest.fn(() => chain)
  chain.maybeSingle = jest.fn(async () => result)
  chain.then = (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve)
  return chain
}
beforeEach(() => {
  jest.resetAllMocks()
  auth.mockResolvedValue({ ok: true, user: { id: 'tester', email: 'tester@example.org' } } as never)
})

it('does not write or expose reports/screenshots to unauthenticated requests', async () => {
  auth.mockResolvedValue({ ok: false, response: feedbackJson({ error: 'Sign in' }, 401) })
  expect((await POST(request())).status).toBe(401)
  expect((await GET(new Request('https://site.test/api/module-feedback'))).status).toBe(401)
  expect(
    (
      await PATCH(new Request('https://site.test', { headers: { origin: 'https://site.test' } }), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(401)
  expect(
    (await imageGET(new Request('https://site.test'), { params: Promise.resolve({ id }) })).status,
  ).toBe(401)
  expect(from).not.toHaveBeenCalled()
  expect(storageFrom).not.toHaveBeenCalled()
})
it('saves account identity and server-owned new status, ignoring forged fields', async () => {
  const insert = query({ error: null })
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(insert as never)
  expect((await POST(request({ user_id: 'someone-else', status: 'resolved' }))).status).toBe(201)
  expect(insert.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      user_id: 'tester',
      tester_email: 'tester@example.org',
      comment: 'Improve label contrast.',
    }),
  )
  expect(insert.insert).toHaveBeenCalledWith(expect.not.objectContaining({ status: 'resolved' }))
})
it('stores the live anatomy tab with the page, and only the audited parameters', async () => {
  const insert = query({ error: null })
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(insert as never)
  const pagePath = '/en/development-beta/live-anatomy/lesson?tab=survey'
  expect((await POST(request({ moduleId: 'live-anatomy', pagePath }))).status).toBe(201)
  expect(insert.insert).toHaveBeenCalledWith(
    expect.objectContaining({ module_id: 'live-anatomy', page_path: pagePath }),
  )
  expect(
    (await POST(request({ moduleId: 'live-anatomy', pagePath: `${pagePath}&token=secret` })))
      .status,
  ).toBe(400)
})
it('returns an existing own report on retry without a duplicate upload', async () => {
  from.mockReturnValueOnce(query({ data: { id, user_id: 'tester' } }) as never)
  expect((await POST(request())).status).toBe(200)
  expect(from).toHaveBeenCalledTimes(1)
  expect(storageFrom).not.toHaveBeenCalled()
})
it('does not claim success when the migration has not been applied', async () => {
  from.mockReturnValueOnce(query({ data: null, error: { code: '42P01' } }) as never)
  expect((await POST(request())).status).toBe(503)
})
it('rejects spoofed images and invalid module/page pairs', async () => {
  expect((await POST(request({}, new Blob(['<svg/>'], { type: 'image/png' })))).status).toBe(400)
  expect((await POST(request({ pagePath: '/en/admin' }))).status).toBe(400)
  expect(from).not.toHaveBeenCalled()
})
it('removes a new screenshot when saving the report fails', async () => {
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ error: { message: 'offline' } }) as never)
    .mockReturnValueOnce(query({ data: null, error: null }) as never)
  const storage = {
    upload: jest.fn(async () => ({ error: null })),
    remove: jest.fn(async () => ({ error: null })),
  }
  storageFrom.mockReturnValue(storage as never)
  expect((await POST(request({}, new Blob([png], { type: 'image/png' })))).status).toBe(503)
  expect(storage.remove).toHaveBeenCalledWith([
    expect.stringMatching(new RegExp(`^tester/${id}/.+\\.png$`)),
  ])
})

it('retries after a failed row insert and failed cleanup without colliding with the orphan image', async () => {
  const objects = new Set<string>()
  const storage = {
    upload: jest.fn(async (path: string) => {
      if (objects.has(path)) return { error: { message: 'already exists' } }
      objects.add(path)
      return { error: null }
    }),
    remove: jest.fn(async () => ({ error: { message: 'cleanup offline' } })),
  }
  storageFrom.mockReturnValue(storage as never)
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ error: { message: 'insert offline' } }) as never)
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ error: null }) as never)
  expect((await POST(request({}, screenshot()))).status).toBe(503)
  expect((await POST(request({}, screenshot()))).status).toBe(201)
  expect(storage.upload).toHaveBeenCalledTimes(2)
  expect(objects.size).toBe(2)
})

it('preserves the referenced screenshot when an insert commits but its response is lost', async () => {
  let path = ''
  storageFrom.mockReturnValue({
    upload: jest.fn(async (value: string) => {
      path = value
      return { error: null }
    }),
    remove: jest.fn(),
  } as never)
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ error: { message: 'response lost' } }) as never)
    .mockImplementationOnce(
      () => query({ data: { id, user_id: 'tester', screenshot_path: path } }) as never,
    )
  expect((await POST(request({}, screenshot()))).status).toBe(200)
  expect(storageFrom).toHaveBeenCalledTimes(1) // upload only; never remove the persisted image
})

it('does not insert a report when screenshot upload fails, and retry uses the same report ID', async () => {
  const upload = jest
    .fn()
    .mockResolvedValueOnce({ error: { message: 'offline' } })
    .mockResolvedValueOnce({ error: null })
  storageFrom.mockReturnValue({ upload } as never)
  const insert = query({ error: null })
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(insert as never)
  expect((await POST(request({}, screenshot()))).status).toBe(503)
  expect(insert.insert).not.toHaveBeenCalled()
  expect((await POST(request({}, screenshot()))).status).toBe(201)
  expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ id }))
  expect(upload.mock.calls[1][1]).toEqual(new Uint8Array(png))
})

it('refuses a retry ID owned by someone else without accessing storage', async () => {
  from.mockReturnValueOnce(query({ data: { id, user_id: 'other-reviewer' } }) as never)
  expect((await POST(request({}, screenshot()))).status).toBe(409)
  expect(storageFrom).not.toHaveBeenCalled()
})

it('keeps a possibly committed image when the reconciliation lookup is unavailable', async () => {
  const remove = jest.fn()
  storageFrom.mockReturnValue({ upload: jest.fn(async () => ({ error: null })), remove } as never)
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ error: { message: 'response lost' } }) as never)
    .mockReturnValueOnce(query({ data: null, error: { message: 'lookup offline' } }) as never)
  expect((await POST(request({}, screenshot()))).status).toBe(503)
  expect(remove).not.toHaveBeenCalled()
})

it('cleans only the losing attempt’s image when an overlapping retry already saved the report', async () => {
  let uploaded = ''
  const remove = jest.fn(async () => ({ error: null }))
  storageFrom.mockReturnValue({
    upload: jest.fn(async (path: string) => {
      uploaded = path
      return { error: null }
    }),
    remove,
  } as never)
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ error: { code: '23505' } }) as never)
    .mockReturnValueOnce(
      query({ data: { id, user_id: 'tester', screenshot_path: 'winning-attempt.png' } }) as never,
    )
  expect((await POST(request({}, screenshot()))).status).toBe(200)
  expect(remove).toHaveBeenCalledWith([uploaded])
  expect(uploaded).not.toBe('winning-attempt.png')
})
it('requires admin authorization for every read and review operation', async () => {
  auth.mockResolvedValue({ ok: false, response: feedbackJson({ error: 'Admin required' }, 403) })
  expect((await GET(new Request('https://site.test/api/module-feedback'))).status).toBe(403)
  expect(
    (await imageGET(new Request('https://site.test'), { params: Promise.resolve({ id }) })).status,
  ).toBe(403)
  expect(auth).toHaveBeenCalledWith(true)
  expect(from).not.toHaveBeenCalled()
})
it('persists review status and private notes for an authorized admin', async () => {
  const update = query({ data: { id }, error: null })
  from.mockReturnValue(update as never)
  const response = await PATCH(
    new Request('https://site.test/api/module-feedback', {
      method: 'PATCH',
      headers: { origin: 'https://site.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', reviewerNotes: 'Fixed contrast.' }),
    }),
    { params: Promise.resolve({ id }) },
  )
  expect(response.status).toBe(200)
  expect(update.update).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'resolved',
      reviewer_notes: 'Fixed contrast.',
      reviewed_by: 'tester',
    }),
  )
})
