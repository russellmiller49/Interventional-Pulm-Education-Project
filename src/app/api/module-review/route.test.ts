/** @jest-environment node */
import { GET, POST } from './route'
import { GET as mineGET } from './mine/route'
import { feedbackJson, requireFeedbackUser } from '@/features/module-beta/server'
import { betaRollout } from '@/features/module-beta/rollout'
import { supabaseAdmin } from '@/lib/supabase/admin'

jest.mock('@/features/module-beta/server', () => ({
  ...jest.requireActual('@/features/module-beta/server'),
  requireFeedbackUser: jest.fn(),
}))
jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { from: jest.fn() } }))
const auth = jest.mocked(requireFeedbackUser)
const from = jest.mocked(supabaseAdmin!.from)

function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'order', 'range', 'upsert'])
    chain[method] = jest.fn(() => chain)
  chain.maybeSingle = jest.fn(async () => result)
  chain.single = jest.fn(async () => result)
  chain.then = (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve)
  return chain
}

const common = {
  coverage: 'most',
  experience: 'supervised',
  overall: '4',
  clarity: '4',
  easeOfUse: '3',
  interactive: '5',
  level: 'about-right',
  readiness: 'minor-fixes',
  workedBest: 'The station drills.',
  oneFix: '',
}
const learner = { ...common, confidenceBefore: '2', confidenceNow: '4', wouldUse: 'yes' }
const prompts = betaRollout['ebus-guided'].note!.lookFor
const educator = {
  ...common,
  accuracy: 'cant-judge',
  consistent: 'mostly',
  wouldAssign: 'probably',
  prompts: prompts.map((prompt) => ({ prompt, verdict: 'looks-right' })),
}
function post(body: unknown, origin = 'https://site.test') {
  return new Request('https://site.test/api/module-review', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
const profile = {
  professional_role: 'pccm_fellow',
  role_other: null,
  resident_specialty: null,
  training_level: 'fellow_year_2',
  years_in_practice: 'in_training',
}

beforeEach(() => {
  jest.resetAllMocks()
  auth.mockResolvedValue({ ok: true, user: { id: 'tester', email: 'tester@example.org' } } as never)
})

it('reads and writes nothing for a request without a verified account', async () => {
  auth.mockResolvedValue({ ok: false, response: feedbackJson({ error: 'Sign in' }, 401) })
  expect(
    (await POST(post({ moduleId: 'ebus-guided', track: 'learner', answers: learner }))).status,
  ).toBe(401)
  expect((await GET(new Request('https://site.test/api/module-review'))).status).toBe(401)
  expect((await mineGET()).status).toBe(401)
  expect(from).not.toHaveBeenCalled()
})

it('refuses a review sent from another site', async () => {
  const response = await POST(
    post({ moduleId: 'ebus-guided', track: 'learner', answers: learner }, 'https://evil.test'),
  )
  expect(response.status).toBe(403)
  expect(auth).not.toHaveBeenCalled()
})

it('saves one review per reviewer and module, under the account, with their profile', async () => {
  const upsert = query({ data: { id: 'r1', module_id: 'ebus-guided' }, error: null })
  from
    .mockReturnValueOnce(query({ data: profile, error: null }) as never)
    .mockReturnValueOnce(upsert as never)
  const response = await POST(
    post({
      moduleId: 'ebus-guided',
      track: 'learner',
      answers: learner,
      user_id: 'someone-else',
      tester_email: 'forged@example.org',
    }),
  )
  expect(response.status).toBe(200)
  expect(from).toHaveBeenLastCalledWith('module_beta_reviews')
  expect(upsert.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      user_id: 'tester',
      tester_email: 'tester@example.org',
      module_id: 'ebus-guided',
      track: 'learner',
      profile_snapshot: profile,
      answers: learner,
      form_version: 1,
    }),
    { onConflict: 'user_id,module_id' },
  )
})

it('rejects an incomplete review, an unknown module and a learner answer on the educator form', async () => {
  const { readiness: _omit, ...missing } = learner
  void _omit
  for (const body of [
    { moduleId: 'ebus-guided', track: 'learner', answers: missing },
    { moduleId: 'ebus-guided', track: 'learner', answers: { ...learner, overall: '6' } },
    { moduleId: 'ebus-guided', track: 'educator', answers: learner },
    { moduleId: 'ebus-guided', track: 'learner', answers: { ...learner, accuracy: '5' } },
  ])
    expect((await POST(post(body))).status).toBe(400)
  expect(
    (await POST(post({ moduleId: 'not-a-module', track: 'learner', answers: learner }))).status,
  ).toBe(400)
  expect(from).not.toHaveBeenCalled()
})

it('takes the educator form only against the module’s current questions', async () => {
  const stale = { ...educator, prompts: [{ prompt: 'An old question', verdict: 'looks-right' }] }
  expect(
    (await POST(post({ moduleId: 'ebus-guided', track: 'educator', answers: stale }))).status,
  ).toBe(409)
  expect(from).not.toHaveBeenCalled()
  from
    .mockReturnValueOnce(query({ data: profile, error: null }) as never)
    .mockReturnValueOnce(query({ data: { id: 'r2' }, error: null }) as never)
  expect(
    (await POST(post({ moduleId: 'ebus-guided', track: 'educator', answers: educator }))).status,
  ).toBe(200)
})

it('says reviews are not open, and keeps nothing, when the table is missing', async () => {
  from
    .mockReturnValueOnce(query({ data: profile, error: null }) as never)
    .mockReturnValueOnce(
      query({ data: null, error: { message: 'relation does not exist' } }) as never,
    )
  const response = await POST(post({ moduleId: 'ebus-guided', track: 'learner', answers: learner }))
  expect(response.status).toBe(503)
  expect((await response.json()).error).toMatch(/not open yet/)
})

it('lists every review only for a site admin, with each reviewer’s report counts', async () => {
  const list = query({
    data: [
      { id: 'r1', user_id: 'u1', module_id: 'ebus-guided' },
      { id: 'r2', user_id: 'u2', module_id: 'baxter-crrt' },
    ],
    error: null,
  })
  const reports = query({
    data: [
      { user_id: 'u1', module_id: 'ebus-guided' },
      { user_id: 'u1', module_id: 'ebus-guided' },
      { user_id: 'u2', module_id: 'ebus-guided' },
    ],
    error: null,
  })
  from.mockReturnValueOnce(list as never).mockReturnValueOnce(reports as never)
  const response = await GET(
    new Request('https://site.test/api/module-review?module=ebus-guided&track=educator'),
  )
  expect(auth).toHaveBeenCalledWith(true)
  expect(list.eq).toHaveBeenCalledWith('module_id', 'ebus-guided')
  expect(list.eq).toHaveBeenCalledWith('track', 'educator')
  expect(reports.in).toHaveBeenCalledWith('user_id', ['u1', 'u2'])
  expect(await response.json()).toMatchObject({
    reportCounts: { 'u1:ebus-guided': 2, 'u2:ebus-guided': 1 },
  })
})

it('gives a reviewer their own reviews, their profile line and default track', async () => {
  const reviews = query({ data: [{ id: 'r1', module_id: 'ebus-guided' }], error: null })
  from
    .mockReturnValueOnce(query({ data: profile, error: null }) as never)
    .mockReturnValueOnce(reviews as never)
    .mockReturnValueOnce(
      query({
        data: [{ module_id: 'ebus-guided' }, { module_id: 'ebus-guided' }],
        error: null,
      }) as never,
    )
  const body = await (await mineGET()).json()
  expect(reviews.eq).toHaveBeenCalledWith('user_id', 'tester')
  expect(body).toEqual({
    profile: { label: 'PCCM Fellow · Fellow Year 2', defaultTrack: 'learner' },
    reviewsOpen: true,
    reviews: [{ id: 'r1', module_id: 'ebus-guided' }],
    reportCounts: { 'ebus-guided': 2 },
  })
})

it('reports reviews as not open, rather than failing, before the table exists', async () => {
  from
    .mockReturnValueOnce(query({ data: profile, error: null }) as never)
    .mockReturnValueOnce(query({ data: null, error: { message: 'missing' } }) as never)
    .mockReturnValueOnce(query({ data: [], error: null }) as never)
  const response = await mineGET()
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ reviewsOpen: false, reviews: [] })
})
