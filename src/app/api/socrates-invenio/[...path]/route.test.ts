/** @jest-environment node */
import { GET } from './route'

describe('Invenio asset relay', () => {
  const originalFetch = global.fetch
  const request = (path: string) =>
    GET(new Request('http://localhost/api/socrates-invenio/' + path), {
      params: Promise.resolve({ path: path.split('/') }),
    })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('streams approved assets from the fixed host without forwarding credentials', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('jpeg-bytes', { headers: { 'content-type': 'image/jpeg' } }))
    const response = await request(
      'tiles/nio-006-series-4-barcode-ax00631/analysis_files/14/0_2.jpeg',
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('jpeg-bytes')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/ucsd-slide-viewer-1080580899927.us-central1.run.app\/generated\/tiles\//,
      ),
      expect.objectContaining({ credentials: 'omit', redirect: 'error', cache: 'no-store' }),
    )
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('rejects unknown paths before fetching', async () => {
    global.fetch = jest.fn()
    expect((await request('../secret')).status).toBe(404)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not return an HTML fallback as a tile or catalog', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('<html/>', { headers: { 'content-type': 'text/html' } }))
    expect((await request('catalog.json')).status).toBe(502)
  })

  it('returns a recoverable error for upstream failures', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'))
    expect((await request('catalog.json')).status).toBe(502)
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 404 }))
    expect((await request('catalog.json')).status).toBe(404)
  })
})
