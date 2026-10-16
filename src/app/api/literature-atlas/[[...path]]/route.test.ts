/** @jest-environment node */
import { GET, HEAD, POST } from './route'

const ORIGIN = 'http://literature-atlas.railway.internal:8920'
const ATLAS_CSP = "default-src 'self'; script-src 'self'; frame-ancestors 'self'"

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://www.interventionalpulm.com${path}`, init)
}

function upstream(body: string | null, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': ATLAS_CSP,
      ...(init.headers as Record<string, string>),
    },
  })
}

function mockFetch(response: Response) {
  const fetchMock = jest.fn().mockResolvedValue(response)
  global.fetch = fetchMock
  return fetchMock
}

describe('Literature Atlas relay', () => {
  const originalFetch = global.fetch
  const originalOrigin = process.env.LITERATURE_ATLAS_ORIGIN

  beforeEach(() => {
    process.env.LITERATURE_ATLAS_ORIGIN = ORIGIN
  })
  afterEach(() => {
    global.fetch = originalFetch
    if (originalOrigin === undefined) delete process.env.LITERATURE_ATLAS_ORIGIN
    else process.env.LITERATURE_ATLAS_ORIGIN = originalOrigin
  })

  it('accepts only GET and HEAD', async () => {
    global.fetch = jest.fn()
    const response = POST()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fails closed with 404 when the Atlas origin is not configured', async () => {
    global.fetch = jest.fn()
    for (const value of [undefined, '', '   ', 'not a url', 'ftp://atlas.internal']) {
      if (value === undefined) delete process.env.LITERATURE_ATLAS_ORIGIN
      else process.env.LITERATURE_ATLAS_ORIGIN = value
      const response = await GET(request('/api/literature-atlas/map'))
      expect(response.status).toBe(404)
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    }
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('strips the prefix and forwards the path and query unchanged', async () => {
    const fetchMock = mockFetch(upstream('<html></html>'))
    const response = await GET(
      request('/api/literature-atlas/list?topic=airway%20stents&design=rct&design=cohort&page=2'),
    )
    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${ORIGIN}/list?topic=airway%20stents&design=rct&design=cohort&page=2`,
    )
    expect(await response.text()).toBe('<html></html>')
  })

  it('maps the bare prefix to the Atlas root', async () => {
    const fetchMock = mockFetch(upstream('<html></html>'))
    await GET(request('/api/literature-atlas'))
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${ORIGIN}/`)
  })

  it('keeps a protocol-relative-looking path on the configured origin', async () => {
    const fetchMock = mockFetch(upstream('<html></html>'))
    await GET(request('/api/literature-atlas//evil.example/x'))
    const target = new URL(String(fetchMock.mock.calls[0][0]))
    expect(target.origin).toBe(ORIGIN)
    expect(target.pathname).toBe('//evil.example/x')
  })

  it('never forwards cookies or authorization, and omits credentials', async () => {
    const fetchMock = mockFetch(upstream('<html></html>'))
    await GET(
      request('/api/literature-atlas/map', {
        headers: {
          accept: 'text/html',
          cookie: 'sb-access-token=secret; ip_local_dev_auth=secret',
          authorization: 'Bearer secret',
        },
      }),
    )
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const sent = new Headers(init.headers)
    expect([...sent.keys()]).toEqual(['accept'])
    expect(sent.get('accept')).toBe('text/html')
    expect(init).toEqual(
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'manual',
        cache: 'no-store',
      }),
    )
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('drops upstream Set-Cookie and every header it does not set itself', async () => {
    mockFetch(
      upstream('<html></html>', {
        headers: {
          'set-cookie': 'tracker=1; Path=/',
          'access-control-allow-origin': '*',
          'content-encoding': 'gzip',
          server: 'uvicorn',
        },
      }),
    )
    const response = await GET(request('/api/literature-atlas/map'))
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(response.headers.get('server')).toBeNull()
  })

  it('passes the Atlas CSP through and marks every response noindex, nosniff and same-origin-framable', async () => {
    mockFetch(upstream('<html></html>'))
    const response = await GET(request('/api/literature-atlas/map'))
    expect(response.headers.get('content-security-policy')).toBe(ATLAS_CSP)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('caches static assets for an hour and the packed map coordinates briefly', async () => {
    mockFetch(upstream('body{}', { headers: { 'content-type': 'text/css' } }))
    const css = await GET(request('/api/literature-atlas/static/atlas.css'))
    expect(css.headers.get('cache-control')).toBe('public, max-age=3600')

    mockFetch(upstream('bytes', { headers: { 'content-type': 'application/octet-stream' } }))
    const points = await GET(request('/api/literature-atlas/api/layout/points.bin'))
    expect(points.status).toBe(200)
    expect(points.headers.get('cache-control')).toBe('public, max-age=300')

    mockFetch(upstream('{}', { headers: { 'content-type': 'application/json' } }))
    const json = await GET(request('/api/literature-atlas/api/briefs?page=1'))
    expect(json.headers.get('cache-control')).toBe('no-store')
  })

  it.each(['image/svg+xml', 'text/xml', 'application/xhtml+xml', 'text/htmlx', ''])(
    'rejects an upstream %p response with 502',
    async (contentType) => {
      mockFetch(upstream('<svg onload="alert(1)"/>', { headers: { 'content-type': contentType } }))
      const response = await GET(request('/api/literature-atlas/map'))
      expect(response.status).toBe(502)
      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    },
  )

  it('passes a redirect that stays under the prefix', async () => {
    mockFetch(
      new Response(null, { status: 307, headers: { location: '/api/literature-atlas/map' } }),
    )
    const response = await GET(request('/api/literature-atlas'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/api/literature-atlas/map')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
  })

  it.each([
    'https://evil.example/api/literature-atlas/map',
    '//evil.example/api/literature-atlas/map',
    '/map',
    '/api/literature-atlas',
    `${ORIGIN}/map`,
  ])('rejects a redirect to %p with 502', async (location) => {
    mockFetch(new Response(null, { status: 302, headers: { location } }))
    const response = await GET(request('/api/literature-atlas/'))
    expect(response.status).toBe(502)
    expect(response.headers.get('location')).toBeNull()
  })

  it('rejects a 3xx without a Location or with an unusual status', async () => {
    mockFetch(new Response(null, { status: 302 }))
    expect((await GET(request('/api/literature-atlas/map'))).status).toBe(502)
    mockFetch(new Response(null, { status: 300, headers: { location: '/api/literature-atlas/x' } }))
    expect((await GET(request('/api/literature-atlas/map'))).status).toBe(502)
  })

  it('passes Atlas error statuses with their text', async () => {
    mockFetch(
      upstream('No such brief.', { status: 404, headers: { 'content-type': 'text/plain' } }),
    )
    const response = await GET(request('/api/literature-atlas/article/999'))
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('No such brief.')
  })

  it('returns a retryable 502 when the Atlas cannot be reached', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'))
    const response = await GET(request('/api/literature-atlas/map'))
    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('relays HEAD as HEAD with headers and no body', async () => {
    const fetchMock = mockFetch(upstream(null))
    const response = await HEAD(request('/api/literature-atlas/map', { method: 'HEAD' }))
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('HEAD')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    expect(response.body).toBeNull()
  })
})
