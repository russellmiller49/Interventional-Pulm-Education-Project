/** @jest-environment node */
import { pbkdf2Sync, randomBytes } from 'node:crypto'

import { issueSession, viewerConfig } from '@/features/literature-atlas-viewer/server/access'

import { resetDownloads } from './downloads'
import { GET, HEAD } from './route'

const ORIGIN = 'http://literature-atlas.railway.internal:8920'
const salt = randomBytes(16)
const HASH = `pbkdf2_sha256$100000$${salt.toString('hex')}$${pbkdf2Sync('INVENTED-pass', salt, 100_000, 32, 'sha256').toString('hex')}`
const ENV = {
  LITERATURE_ATLAS_ORIGIN: ORIGIN,
  LITERATURE_ATLAS_GATE_ALL: '1',
  LITERATURE_ATLAS_VIEWER_HASH: HASH,
  LITERATURE_ATLAS_VIEWER_SECRET: 'INVENTED-session-secret-for-tests-0123456789',
  LITERATURE_ATLAS_RELAY_SECRET: 'INVENTED-relay-secret-for-tests-0123456789',
}

function request(path: string, headers: Record<string, string> = {}, method = 'GET') {
  return new Request(`https://www.interventionalpulm.com${path}`, { method, headers })
}
function upstream() {
  return new Response('<html></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

describe('Literature Atlas relay with LITERATURE_ATLAS_GATE_ALL', () => {
  const saved = { ...process.env }
  const originalFetch = global.fetch
  let fetchMock: jest.Mock
  beforeEach(() => {
    Object.assign(process.env, ENV)
    resetDownloads()
    fetchMock = jest.fn().mockImplementation(async () => upstream())
    global.fetch = fetchMock
  })
  afterEach(() => {
    for (const key of Object.keys(ENV)) delete process.env[key]
    delete process.env.LITERATURE_ATLAS_VIEWER_HASH_2
    Object.assign(process.env, saved)
    global.fetch = originalFetch
  })

  const HTML = { accept: 'text/html,application/xhtml+xml' }

  it('sends signed-out HTML to the main page in the referer locale, default otherwise', async () => {
    const plain = await GET(request('/api/literature-atlas/map', HTML))
    expect(plain.status).toBe(303)
    expect(plain.headers.get('location')).toBe('/en/literature-atlas')
    expect(plain.headers.get('cache-control')).toBe('no-store')
    const es = await GET(
      request('/api/literature-atlas/list', {
        ...HTML,
        referer: 'https://www.interventionalpulm.com/es/literature-atlas',
      }),
    )
    expect(es.headers.get('location')).toBe('/es/literature-atlas')
    const odd = await GET(
      request('/api/literature-atlas/list', { ...HTML, referer: 'https://x.test/xx/atlas' }),
    )
    expect(odd.headers.get('location')).toBe('/en/literature-atlas')
    const head = await HEAD(request('/api/literature-atlas/map', HTML, 'HEAD'))
    expect(head.status).toBe(303)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 401 for signed-out JSON and assets', async () => {
    for (const [path, accept] of [
      ['/api/literature-atlas/api/articles', 'application/json'],
      ['/api/literature-atlas/static/app.js', '*/*'],
      ['/api/literature-atlas/map', undefined],
    ] as const) {
      const response = await GET(request(path, accept ? { accept } : {}))
      expect(response.status).toBe(401)
      expect(await response.text()).toBe('Sign in required')
      expect(response.headers.get('content-type')).toContain('text/plain')
      expect(response.headers.get('cache-control')).toBe('no-store')
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps health open', async () => {
    const response = await GET(request('/api/literature-atlas/health', { accept: '*/*' }))
    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${ORIGIN}/health`)
  })

  it('proxies for a signed-in viewer with the relay note', async () => {
    const session = issueSession(viewerConfig()!).value
    const response = await GET(
      request('/api/literature-atlas/map', {
        ...HTML,
        cookie: `literature-atlas-viewer=${session}`,
      }),
    )
    expect(response.status).toBe(200)
    const sent = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers)
    expect(sent.get('x-atlas-evidence-viewer')).toMatch(/^v1\.\d+\./)
    expect(sent.get('cookie')).toBeNull()
  })

  it('rejects a forged session as signed out', async () => {
    const response = await GET(
      request('/api/literature-atlas/map', {
        ...HTML,
        cookie: 'literature-atlas-viewer=v1.1.2.3.4',
      }),
    )
    expect(response.status).toBe(303)
  })

  it('fails closed with 503 when the viewer is not configured, except health', async () => {
    delete process.env.LITERATURE_ATLAS_VIEWER_HASH
    for (const headers of [HTML, { accept: 'application/json' }]) {
      const response = await GET(request('/api/literature-atlas/map', headers))
      expect(response.status).toBe(503)
      expect(await response.text()).toBe('Not available')
      expect(response.headers.get('cache-control')).toBe('no-store')
    }
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await GET(request('/api/literature-atlas/health'))).status).toBe(200)
  })

  it('is off unless the switch is exactly 1', async () => {
    for (const value of ['0', 'true', ' 1', '']) {
      process.env.LITERATURE_ATLAS_GATE_ALL = value
      const response = await GET(request('/api/literature-atlas/map', HTML))
      expect(response.status).toBe(200)
    }
  })

  it('accepts a session issued under an extra password configuration', async () => {
    const extraSalt = randomBytes(16)
    process.env.LITERATURE_ATLAS_VIEWER_HASH_2 = `pbkdf2_sha256$100000$${extraSalt.toString('hex')}$${pbkdf2Sync('INVENTED-two', extraSalt, 100_000, 32, 'sha256').toString('hex')}`
    const session = issueSession(viewerConfig()!).value
    const response = await GET(
      request('/api/literature-atlas/map', { cookie: `literature-atlas-viewer=${session}` }),
    )
    expect(response.status).toBe(200)
  })
})
