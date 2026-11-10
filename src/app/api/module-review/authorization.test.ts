/** @jest-environment node */
import { POST, GET } from './route'
import { GET as mineGET } from './mine/route'
import { GET as imageGET } from '../module-feedback/[id]/image/route'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { modulePrompts } from '@/features/module-beta/reviewServer'

// Exercise the real requireFeedbackUser with synthetic Auth and database adapters.
// This verifies handler composition, not a live Supabase session or database upsert.
jest.mock('@/lib/supabase/server', () => ({ supabaseServer: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: jest.fn(), storage: { from: jest.fn() } },
}))
const server = jest.mocked(supabaseServer)
const from = jest.mocked(supabaseAdmin!.from)
const storageFrom = jest.mocked(supabaseAdmin!.storage.from)
const reviewerA = '00000000-0000-4000-8000-000000000001'
const reviewerB = '00000000-0000-4000-8000-000000000002'
const profile = { professional_role: 'pccm_fellow', training_level: 'fellow_year_2' }
const answers = {
  coverage: 'all',
  experience: 'supervised',
  overall: '4',
  clarity: '4',
  easeOfUse: '3',
  interactive: '5',
  level: 'about-right',
  readiness: 'minor-fixes',
  workedBest: 'Synthetic drill',
  oneFix: 'Synthetic label',
  confidenceBefore: '2',
  confidenceNow: '4',
  wouldUse: 'yes',
}
type Row = Record<string, unknown>
let rows: Row[]

function signIn(id: string, entitlement?: { status: string; expires_at: string | null }) {
  const filters = new Map<string, unknown>()
  const query: Record<string, jest.Mock> = {
    select: jest.fn(() => query),
    eq: jest.fn((key: string, value: unknown) => {
      filters.set(key, value)
      return query
    }),
    or: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({
      data:
        entitlement?.status === 'active' &&
        (!entitlement.expires_at || Date.parse(entitlement.expires_at) > Date.now())
          ? { entitlement: 'site_admin' }
          : null,
      error: null,
    })),
  }
  const client = {
    auth: {
      getUser: jest.fn(async () => ({
        data: {
          user: {
            id,
            email: `${id}@example.invalid`,
            email_confirmed_at: '2026-01-01T00:00:00Z',
            is_anonymous: false,
            // User-editable metadata must not grant access.
            user_metadata: { site_admin: true },
          },
        },
        error: null,
      })),
    },
    from: jest.fn(() => query),
  }
  server.mockResolvedValue(client as never)
  return { client, query, filters }
}

function post(body: Row = {}) {
  return new Request('https://site.test/api/module-review', {
    method: 'POST',
    headers: { origin: 'https://site.test' },
    body: JSON.stringify({ moduleId: 'ebus-guided', track: 'learner', answers, ...body }),
  })
}

beforeEach(() => {
  jest.resetAllMocks()
  rows = []
  from.mockImplementation((table: string) => {
    const filters = new Map<string, unknown>()
    let saved: Row | undefined
    const result = () => ({
      data:
        table === 'site_profiles'
          ? profile
          : table === 'module_beta_feedback'
            ? []
            : rows.filter((row) => [...filters].every(([key, value]) => row[key] === value)),
      error: null,
    })
    const query: Record<string, unknown> = {
      select: jest.fn(() => query),
      eq: jest.fn((key: string, value: unknown) => {
        filters.set(key, value)
        return query
      }),
      upsert: jest.fn((row: Row, options: { onConflict: string }) => {
        // Model only the requested conflict key, so a broken handler creates a second row.
        const keys = options.onConflict.split(',')
        const existing = rows.find((item) => keys.every((key) => item[key] === row[key]))
        saved = {
          id: `review-${rows.length + 1}`,
          created_at: '2026-01-01T00:00:00Z',
          ...existing,
          ...row,
        }
        if (existing) rows[rows.indexOf(existing)] = saved
        else rows.push(saved)
        return query
      }),
      maybeSingle: jest.fn(async () => result()),
      single: jest.fn(async () => ({ data: saved, error: null })),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    }
    return query as never
  })
})

it('a verified non-admin saves a complete review, then edits and reloads the same record', async () => {
  const { client } = signIn(reviewerA)
  const first = await POST(
    post({
      user_id: reviewerB,
      tester_email: 'forged@example.invalid',
      profile_snapshot: { professional_role: 'attending' },
      id: 'forged',
    }),
  )
  expect(first.status).toBe(200)
  const original = rows[0]
  expect(original).toMatchObject({
    user_id: reviewerA,
    tester_email: `${reviewerA}@example.invalid`,
    profile_snapshot: profile,
    answers,
    module_id: 'ebus-guided',
    form_version: 1,
  })
  const changed = { ...answers, overall: '5', oneFix: 'Updated synthetic label' }
  expect((await POST(post({ answers: changed }))).status).toBe(200)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    id: original.id,
    created_at: original.created_at,
    answers: changed,
  })
  expect(await (await mineGET()).json()).toMatchObject({
    reviewsOpen: true,
    reviews: [{ id: original.id, answers: changed }],
  })
  expect(client.from).not.toHaveBeenCalled() // No site_admin required to review a module.
})

it('a second reviewer cannot read or overwrite the first reviewer’s record, even with forged IDs', async () => {
  signIn(reviewerA)
  await POST(post())
  const first = structuredClone(rows[0])
  signIn(reviewerB)
  expect(await (await mineGET()).json()).toMatchObject({ reviews: [] })
  expect((await GET(new Request('https://site.test/api/module-review'))).status).toBe(403)
  await POST(post({ id: first.id, user_id: reviewerA, answers: { ...answers, overall: '1' } }))
  expect(rows).toHaveLength(2)
  expect(rows[0]).toEqual(first)
  expect(await (await mineGET()).json()).toMatchObject({ reviews: [{ user_id: reviewerB }] })
})

it('accepts a complete educator review with the current module prompts', async () => {
  signIn(reviewerB)
  const { confidenceBefore: _before, confidenceNow: _now, wouldUse: _use, ...common } = answers
  void [_before, _now, _use]
  const response = await POST(
    post({
      track: 'educator',
      answers: {
        ...common,
        accuracy: '4',
        consistent: 'mostly',
        wouldAssign: 'probably',
        prompts: modulePrompts('ebus-guided').map((prompt) => ({ prompt, verdict: 'looks-right' })),
      },
    }),
  )
  expect(response.status).toBe(200)
  expect(rows[0]).toMatchObject({ user_id: reviewerB, track: 'educator' })
})

it.each([
  undefined,
  { status: 'inactive', expires_at: null },
  { status: 'active', expires_at: '2000-01-01T00:00:00Z' },
])(
  'denies private screenshots without an active, unexpired site_admin grant: %j',
  async (grant) => {
    const { query } = signIn(reviewerA, grant)
    const response = await imageGET(
      new Request('https://site.test/api/module-feedback/test/image'),
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000003' }) },
    )
    expect(response.status).toBe(403)
    expect(query.eq).toHaveBeenCalledWith('entitlement', 'site_admin')
    expect(query.eq).toHaveBeenCalledWith('status', 'active')
    expect(query.or).toHaveBeenCalledWith(
      expect.stringMatching(/^expires_at.is.null,expires_at.gt./),
    )
    expect(from).not.toHaveBeenCalled()
    expect(storageFrom).not.toHaveBeenCalled()
  },
)

it('serves a private uncached PNG only while the admin grant remains current', async () => {
  signIn(reviewerA, { status: 'active', expires_at: null })
  from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { screenshot_path: 'synthetic/report.png' },
          error: null,
        }),
      }),
    }),
  } as never)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=',
    'base64',
  )
  const download = jest.fn(async () => ({ data: new Blob([png]), error: null }))
  storageFrom.mockReturnValue({ download } as never)
  const call = () =>
    imageGET(new Request('https://site.test'), {
      params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000003' }),
    })
  const response = await call()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('content-type')).toBe('image/png')
  expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
  expect(download).toHaveBeenCalledWith('synthetic/report.png')
  signIn(reviewerA, { status: 'revoked', expires_at: null })
  expect((await call()).status).toBe(403)
  expect(download).toHaveBeenCalledTimes(1)
})
