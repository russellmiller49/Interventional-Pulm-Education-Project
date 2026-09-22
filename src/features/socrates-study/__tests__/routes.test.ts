/** @jest-environment node */
import { GET, POST } from '@/app/api/socrates/[...path]/route'
import { GET as imageGET } from '@/app/api/socrates/images/[...path]/route'
import * as service from '../server/service'
import { caseFixture } from '../testing/fixtures'

jest.mock('../server/service', () => ({
  SocratesAccessError: class extends Error {
    constructor(
      message: string,
      public status = 403,
    ) {
      super(message)
    }
  },
  requireSocratesUser: jest.fn(),
  trainingCatalog: jest.fn(),
  loadTraining: jest.fn(),
  loadAttempt: jest.fn(),
  trainingReveal: jest.fn(),
  trainingDocument: jest.fn(),
  studyDatabase: jest.fn(),
  dashboardData: jest.fn(),
}))
const access = jest.mocked(service.requireSocratesUser)
const rpc = jest.fn()
const id = '10000000-0000-4000-8000-000000000001'
const params = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) })
const request = (path: string, body?: unknown, origin = 'https://study.example') =>
  new Request(`https://study.example/api/socrates/${path}`, {
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
    headers: { origin },
  })
const originalFetch = global.fetch
beforeEach(() => {
  jest.resetAllMocks()
  access.mockResolvedValue({
    supabase: { rpc },
    user: { id },
    isAdmin: false,
  } as unknown as Awaited<ReturnType<typeof service.requireSocratesUser>>)
  global.fetch = jest.fn()
})
afterAll(() => {
  global.fetch = originalFetch
})

test.each(['admin/dashboard', 'admin/export'])(
  'admin endpoint %s authorizes before any database read',
  async (path) => {
    access.mockRejectedValue(new service.SocratesAccessError('Administrator access required.'))
    const response = await GET(request(path), params(path))
    expect(response.status).toBe(403)
    expect(access).toHaveBeenCalledWith(true)
    expect(service.dashboardData).not.toHaveBeenCalled()
  },
)
test('unauthenticated attempt and image requests disclose no data', async () => {
  access.mockRejectedValue(new service.SocratesAccessError('Sign in.', 401))
  expect((await GET(request(`attempt/${id}`), params(`attempt/${id}`))).status).toBe(401)
  expect(
    (await imageGET(request('image'), params(`testing/${id}/0/tissue/slide.dzi`))).status,
  ).toBe(401)
  expect(service.loadAttempt).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
})
test('cross-origin writes fail before auth or persistence', async () => {
  expect(
    (await POST(request('submit', {}, 'https://elsewhere.example'), params('submit'))).status,
  ).toBe(403)
  expect(access).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})
test('private database errors are not reflected in participant responses', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'PRIVATE_UNSAFE_DATABASE_VALUE' } })
  const response = await POST(request('submit', { attemptId: id, responses: {} }), params('submit'))
  expect(response.status).toBe(409)
  expect(await response.text()).not.toContain('PRIVATE_')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})
test('inspection records progress without fetching teaching; reveal is a separate request', async () => {
  rpc.mockResolvedValue({ data: { opened_at: '2026-09-22T00:00:00Z' }, error: null })
  const response = await POST(
    request('training', { caseId: id, revision: 1, stage: 'opened' }),
    params('training'),
  )
  expect((await response.json()).reveal).toBeNull()
  expect(service.trainingReveal).not.toHaveBeenCalled()
  await POST(
    request('training', { caseId: id, revision: 1, stage: 'revealed' }),
    params('training'),
  )
  expect(service.trainingReveal).toHaveBeenCalledWith(id, 1)
})
test('opaque image relay strips source metadata and forbids upstream redirects/credentials', async () => {
  jest.mocked(service.trainingDocument).mockResolvedValue(caseFixture())
  jest
    .mocked(global.fetch)
    .mockResolvedValue(
      new Response(
        '<Image TileSize="256" Overlap="1" Format="jpeg" Url="https://private.example/PRIVATE_MARKER"><Size Width="9000" Height="9900"/></Image>',
        { headers: { 'Content-Type': 'application/xml' } },
      ),
    )
  const response = await imageGET(request('image'), params(`training/${id}/1/tissue/slide.dzi`))
  expect(response.status).toBe(200)
  expect(await response.text()).not.toMatch(/PRIVATE_|private.example|Url=/)
  expect(global.fetch).toHaveBeenCalledWith(
    caseFixture().slide.descriptorUrl,
    expect.objectContaining({ credentials: 'omit', redirect: 'error', cache: 'no-store' }),
  )
})
test('direct color requests are rejected when a test round hides the color image', async () => {
  jest
    .mocked(service.loadAttempt)
    .mockResolvedValue({ config: { showColorImage: false } } as Awaited<
      ReturnType<typeof service.loadAttempt>
    >)
  expect((await imageGET(request('image'), params(`testing/${id}/0/color/slide.dzi`))).status).toBe(
    404,
  )
  expect(global.fetch).not.toHaveBeenCalled()
})
test('malformed image paths and unapproved source hosts cannot reach upstream fetch', async () => {
  expect(
    (await imageGET(request('image'), params(`testing/${id}/0/tissue/../secret`))).status,
  ).toBe(404)
  const document = caseFixture()
  document.slide.descriptorUrl = 'https://unapproved.example/private.dzi'
  jest.mocked(service.trainingDocument).mockResolvedValue(document)
  expect(
    (await imageGET(request('image'), params(`training/${id}/1/tissue/slide.dzi`))).status,
  ).toBe(502)
  expect(global.fetch).not.toHaveBeenCalled()
})
