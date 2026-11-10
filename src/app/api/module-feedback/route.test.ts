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
type ScreenshotReport = { id: string; user_id: string; screenshot_path: string }
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
it('keeps a new screenshot when saving fails and reconciliation finds no report', async () => {
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
  expect(storage.remove).not.toHaveBeenCalled()
})

it('retries after a definite row insert failure without colliding with the retained orphan image', async () => {
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
  expect(storage.remove).not.toHaveBeenCalled()
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

it('preserves the screenshot through a delayed commit after an empty reconciliation lookup', async () => {
  const objects = new Map<string, Uint8Array>()
  const reports = new Map<string, ScreenshotReport>()
  let pending: ScreenshotReport | undefined
  const storage = {
    upload: jest.fn(async (path: string, bytes: Uint8Array) => {
      objects.set(path, bytes)
      return { error: null }
    }),
    remove: jest.fn(async (paths: string[]) => {
      paths.forEach((path) => objects.delete(path))
      return { error: null }
    }),
  }
  const insert = jest.fn(async (row: ScreenshotReport) => {
    // The transport finishes before the database transaction. Commit it explicitly below.
    pending = row
    return { error: { message: 'transport timed out; commit still pending' } }
  })
  storageFrom.mockReturnValue(storage as never)
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce({ insert } as never)
    .mockReturnValueOnce(query({ data: null, error: null }) as never)
  expect((await POST(request({}, screenshot()))).status).toBe(503)
  expect(reports.size).toBe(0)
  expect(pending).toBeDefined()

  // The original transaction commits only after the empty lookup and the HTTP response.
  reports.set(id, pending!)
  expect(objects.get(reports.get(id)!.screenshot_path)).toEqual(new Uint8Array(png))
  expect(storage.remove).not.toHaveBeenCalled()
  from.mockReturnValueOnce(query({ data: reports.get(id) }) as never)
  expect((await POST(request({}, screenshot()))).status).toBe(200)
  expect(reports.size).toBe(1)
  expect(insert).toHaveBeenCalledTimes(1)
  expect(storage.upload).toHaveBeenCalledTimes(1)
})

it('returns a retryable response and preserves the screenshot after an unexpected thrown insert error', async () => {
  const objects = new Set<string>()
  const remove = jest.fn()
  storageFrom.mockReturnValue({
    upload: jest.fn(async (path: string) => {
      objects.add(path)
      return { error: null }
    }),
    remove,
  } as never)
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce({
      insert: jest.fn(async () => {
        throw new Error('transport failure')
      }),
    } as never)
    .mockReturnValueOnce(query({ data: null }) as never)
  const response = await POST(request({}, screenshot()))
  expect(response.status).toBe(503)
  expect(objects.size).toBe(1)
  expect(remove).not.toHaveBeenCalled()
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

it('preserves the image if reconciliation unexpectedly throws', async () => {
  const remove = jest.fn()
  storageFrom.mockReturnValue({ upload: jest.fn(async () => ({ error: null })), remove } as never)
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ error: { message: 'transport failed' } }) as never)
    .mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            throw new Error('lookup transport failed')
          },
        }),
      }),
    } as never)
  expect((await POST(request({}, screenshot()))).status).toBe(503)
  expect(remove).not.toHaveBeenCalled()
})

it('does not acknowledge another user’s report found during reconciliation', async () => {
  const remove = jest.fn()
  storageFrom.mockReturnValue({ upload: jest.fn(async () => ({ error: null })), remove } as never)
  from
    .mockReturnValueOnce(query({ data: null }) as never)
    .mockReturnValueOnce(query({ count: 0 }) as never)
    .mockReturnValueOnce(query({ error: { code: '23505' } }) as never)
    .mockReturnValueOnce(query({ data: { id, user_id: 'other-reviewer' } }) as never)
  expect((await POST(request({}, screenshot()))).status).toBe(409)
  expect(remove).not.toHaveBeenCalled()
})

it('retains the losing attempt’s image when an overlapping retry already saved the report', async () => {
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
  expect(remove).not.toHaveBeenCalled()
  expect(uploaded).not.toBe('winning-attempt.png')
})

it('two overlapping same-user attempts retain both images and commit only one report', async () => {
  const reports = new Map<string, ScreenshotReport>()
  const objects = new Map<string, Uint8Array>()
  let release!: () => void
  const bothInsertsStarted = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = 0
  const insert = jest.fn(async (row: ScreenshotReport) => {
    if (++started === 2) release()
    await bothInsertsStarted
    if (reports.has(row.id)) return { error: { code: '23505' } }
    reports.set(row.id, row)
    return { error: null }
  })
  const storage = {
    upload: jest.fn(async (path: string, bytes: Uint8Array) => {
      objects.set(path, bytes)
      return { error: null }
    }),
    remove: jest.fn(async (paths: string[]) => {
      paths.forEach((path) => objects.delete(path))
      return { error: null }
    }),
  }
  storageFrom.mockReturnValue(storage as never)
  from.mockReturnValue({
    insert,
    select: (_columns: string, options?: { head: boolean }) => {
      if (options?.head) return query({ count: 0 })
      const lookup = query({})
      lookup.maybeSingle = jest.fn(async () => ({ data: reports.get(id) ?? null, error: null }))
      return lookup
    },
  } as never)
  const responses = await Promise.all([
    POST(request({}, screenshot())),
    POST(request({}, screenshot())),
  ])
  expect(responses.map((response) => response.status).sort()).toEqual([200, 201])
  expect(reports.size).toBe(1)
  expect(objects.size).toBe(2)
  expect(objects.get(reports.get(id)!.screenshot_path)).toEqual(new Uint8Array(png))
  expect(storage.remove).not.toHaveBeenCalled()
  expect((await POST(request({}, screenshot()))).status).toBe(200)
  expect(insert).toHaveBeenCalledTimes(2)
  expect(storage.upload).toHaveBeenCalledTimes(2)
  expect(reports.size).toBe(1)
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
