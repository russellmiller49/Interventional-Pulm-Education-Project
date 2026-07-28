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
    const result = await client(cacheDir, fetchImpl as typeof fetch).request({
      search: 'catalog_number:"NONE"',
      limit: 1,
    })
    expect(result.records).toEqual([])
    expect(result.httpStatus).toBe(404)
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
    const api = client(cacheDir, fetchImpl as typeof fetch)
    const request = { search: 'catalog_number:"CAT-001"', limit: 1 }
    const first = await api.request(request)
    const second = await api.request(request)
    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
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
})
