import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { OpenFdaClient, OpenFdaClientError } from '../client'
import { jsonResponse, openFdaApiResponse } from './fixtures'

const API_KEY = 'TEST-OPENFDA-SECRET'

async function temporaryCacheDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'openfda-client-'))
}

function client(
  cacheDir: string,
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof OpenFdaClient>[0]> = {},
) {
  return new OpenFdaClient({
    apiKey: API_KEY,
    cacheDir,
    fetchImpl,
    requestsPerSecond: 1_000_000,
    maxAttempts: 5,
    timeoutMs: 50,
    sleep: async () => undefined,
    random: () => 0,
    ...overrides,
  })
}

describe('openFDA API client', () => {
  const directories: string[] = []

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    )
  })

  it('treats a 404 as an ordinary empty result', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => jsonResponse({ error: { code: 'NOT_FOUND' } }, 404))
    const result = await client(cacheDir, fetchImpl as typeof fetch, {
      cacheReferencePrefix: 'local-data/ip-preference-cards/us-status/2026-08-13/openfda/udi',
    }).request({
      search: 'catalog_number:"NONE"',
      limit: 1,
    })
    expect(result.records).toEqual([])
    expect(result.httpStatus).toBe(404)
    expect(result).toMatchObject({
      requestSearch: 'catalog_number:"NONE"',
      requestLimit: 1,
      requestSkip: 0,
      responseSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      rawCacheReference: expect.stringMatching(
        /^local-data\/ip-preference-cards\/us-status\/2026-08-13\/openfda\/udi\/[a-f0-9]{64}\.json$/,
      ),
    })
    expect(result.requestUrl).not.toContain(API_KEY)
    expect(new URL(result.requestUrl).searchParams.get('search')).toBe(result.requestSearch)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries 429 and retryable 5xx responses', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const responses = [
      jsonResponse({}, 429),
      jsonResponse({}, 503),
      jsonResponse(openFdaApiResponse()),
    ]
    const fetchImpl = jest.fn(async () => responses.shift()!)
    const result = await client(cacheDir, fetchImpl as typeof fetch).request({
      search: 'catalog_number:"CAT-001"',
      limit: 1,
    })
    expect(result.records).toHaveLength(1)
    expect(result.retryCount).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('aborts a timed-out request and retries it', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    let call = 0
    const fetchImpl = jest.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      call += 1
      if (call === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        })
      }
      return jsonResponse(openFdaApiResponse())
    })
    const result = await client(cacheDir, fetchImpl as typeof fetch, {
      timeoutMs: 5,
    }).request({
      search: 'catalog_number:"CAT-001"',
      limit: 1,
    })
    expect(result.retryCount).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('uses a valid cache entry instead of duplicating a request', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => jsonResponse(openFdaApiResponse()))
    const api = client(cacheDir, fetchImpl as typeof fetch, {
      cacheReferencePrefix: 'local-data/ip-preference-cards/us-status/2026-08-13/openfda/udi',
    })
    const request = { search: 'catalog_number:"CAT-001"', limit: 1 }
    const first = await api.request(request)
    const second = await api.request(request)
    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    expect(second).toMatchObject({
      requestUrl: first.requestUrl,
      requestSearch: first.requestSearch,
      requestLimit: first.requestLimit,
      requestSkip: first.requestSkip,
      responseSha256: first.responseSha256,
      rawCacheReference: first.rawCacheReference,
    })
    expect(first.responseSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(first.rawCacheReference).toMatch(
      /^local-data\/ip-preference-cards\/us-status\/2026-08-13\/openfda\/udi\/[a-f0-9]{64}\.json$/,
    )
    expect(first.requestUrl).not.toContain(API_KEY)
    expect(new URL(first.requestUrl).searchParams.get('search')).toBe(first.requestSearch)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('preserves dataset metadata and isolates paginated cache entries by skip', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async (request: URL | RequestInfo) => {
      const url = new URL(String(request))
      const skip = Number(url.searchParams.get('skip') ?? '0')
      return jsonResponse({
        meta: {
          last_updated: '2026-08-03',
          results: { skip, limit: 1, total: 2 },
        },
        results: [
          {
            public_device_record_key: `record-${skip}`,
            brand_name: 'Acme Biopsy',
          },
        ],
      })
    })
    const api = client(cacheDir, fetchImpl as typeof fetch)
    const first = await api.request({ search: 'catalog_number:"CAT-001"', limit: 1 })
    const second = await api.request({
      search: 'catalog_number:"CAT-001"',
      limit: 1,
      skip: 1,
    })
    const secondReplay = await api.request({
      search: 'catalog_number:"CAT-001"',
      limit: 1,
      skip: 1,
    })

    expect(first).toMatchObject({ datasetLastUpdated: '2026-08-03', resultTotal: 2 })
    expect(second.records[0].public_device_record_key).toBe('record-1')
    expect(secondReplay.fromCache).toBe(true)
    expect(await readdir(cacheDir)).toHaveLength(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('serializes request pacing across concurrent cache misses', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const sleep = jest.fn(async () => undefined)
    const fetchImpl = jest.fn(async () => jsonResponse(openFdaApiResponse()))
    const api = client(cacheDir, fetchImpl as typeof fetch, {
      requestsPerSecond: 1,
      now: () => 0,
      sleep,
    })

    await Promise.all([
      api.request({ search: 'catalog_number:"CAT-001"', limit: 1 }),
      api.request({ search: 'catalog_number:"CAT-002"', limit: 1 }),
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(1_000)
  })

  it('rejects a cache entry whose response hash no longer matches', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => jsonResponse(openFdaApiResponse()))
    const api = client(cacheDir, fetchImpl as typeof fetch)
    const request = { search: 'catalog_number:"CAT-001"', limit: 1 }
    await api.request(request)
    const cachePath = path.join(cacheDir, (await readdir(cacheDir))[0])
    const cached = JSON.parse(await readFile(cachePath, 'utf8')) as {
      response: { results: unknown[] }
    }
    cached.response.results = []
    await writeFile(cachePath, `${JSON.stringify(cached)}\n`, 'utf8')
    const result = await api.request(request)
    expect(result.fromCache).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('bypasses cache reads with --refresh semantics', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => jsonResponse(openFdaApiResponse()))
    const api = client(cacheDir, fetchImpl as typeof fetch)
    const request = { search: 'catalog_number:"CAT-001"', limit: 1 }
    await api.request(request)
    await api.request({ ...request, refresh: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('never stores the API key in cache metadata or surfaced errors', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => jsonResponse(openFdaApiResponse()))
    await client(cacheDir, fetchImpl as typeof fetch).request({
      search: 'catalog_number:"CAT-001"',
      limit: 1,
    })
    const cacheFiles = await readdir(cacheDir)
    const cacheText = await readFile(path.join(cacheDir, cacheFiles[0]), 'utf8')
    expect(cacheText).not.toContain(API_KEY)

    const failing = client(cacheDir, jest.fn(async () => jsonResponse({}, 400)) as typeof fetch)
    try {
      await failing.request({ search: 'catalog_number:"BAD"', limit: 1, refresh: true })
      throw new Error('Expected the openFDA request to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(OpenFdaClientError)
      expect((error as Error).message).not.toContain(API_KEY)
    }
  })

  it('fails closed without retrying a malformed successful response', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => jsonResponse({ results: 'not-an-array' }))

    await expect(
      client(cacheDir, fetchImpl as typeof fetch).request({
        search: 'catalog_number:"MALFORMED"',
        limit: 1,
      }),
    ).rejects.toThrow(OpenFdaClientError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(await readdir(cacheDir)).toEqual([])
  })
})
