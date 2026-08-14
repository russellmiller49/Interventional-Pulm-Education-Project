import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { openFdaCacheEntrySchema, openFdaResponseSchema } from './schemas'
import { normalizeSearchExpression, redactApiKey } from './normalize'
import { OPENFDA_API_SCHEMA_VERSION, OPENFDA_ENDPOINT, type OpenFdaRecord } from './types'

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

export interface OpenFdaClientOptions {
  apiKey: string
  cacheDir: string
  cacheReferencePrefix?: string
  endpoint?: string
  apiSchemaVersion?: string
  requestsPerSecond?: number
  maxAttempts?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => number
  random?: () => number
}

export interface OpenFdaClientRequest {
  search: string
  limit: number
  skip?: number
  refresh?: boolean
}

export interface OpenFdaClientResult {
  records: OpenFdaRecord[]
  datasetLastUpdated: string | null
  resultTotal: number | null
  retrievedAt: string
  fromCache: boolean
  httpStatus: number
  attemptCount: number
  apiRequestsMade: number
  retryCount: number
  requestUrl: string
  requestSearch: string
  requestLimit: number
  requestSkip: number
  responseSha256: string
  rawCacheReference: string
}

function responseMetadata(response: { meta?: Record<string, unknown> }): {
  datasetLastUpdated: string | null
  resultTotal: number | null
} {
  const lastUpdated = response.meta?.last_updated
  const results = response.meta?.results
  const total =
    results && typeof results === 'object' && 'total' in results
      ? (results as { total?: unknown }).total
      : null
  return {
    datasetLastUpdated: typeof lastUpdated === 'string' ? lastUpdated : null,
    resultTotal: typeof total === 'number' && Number.isFinite(total) ? total : null,
  }
}

export class OpenFdaClientError extends Error {
  readonly httpStatus: number | null
  readonly attemptCount: number
  readonly apiRequestsMade: number
  readonly retryCount: number

  constructor(
    message: string,
    { httpStatus, attemptCount }: { httpStatus: number | null; attemptCount: number },
  ) {
    super(message)
    this.name = 'OpenFdaClientError'
    this.httpStatus = httpStatus
    this.attemptCount = attemptCount
    this.apiRequestsMade = attemptCount
    this.retryCount = Math.max(0, attemptCount - 1)
  }
}

export function buildOpenFdaRequestUrl({
  endpoint = OPENFDA_ENDPOINT,
  apiKey,
  search,
  limit,
  skip = 0,
}: {
  endpoint?: string
  apiKey: string
  search: string
  limit: number
  skip?: number
}): URL {
  const url = new URL(endpoint)
  if (apiKey) url.searchParams.set('api_key', apiKey)
  url.searchParams.set('search', normalizeSearchExpression(search))
  url.searchParams.set('limit', String(limit))
  if (skip > 0) url.searchParams.set('skip', String(skip))
  return url
}

export function computeOpenFdaCacheKey({
  endpoint = OPENFDA_ENDPOINT,
  search,
  limit,
  skip = 0,
  apiSchemaVersion = OPENFDA_API_SCHEMA_VERSION,
}: {
  endpoint?: string
  search: string
  limit: number
  skip?: number
  apiSchemaVersion?: string
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        endpoint,
        search: normalizeSearchExpression(search),
        limit,
        api_schema_version: apiSchemaVersion,
        skip,
      }),
    )
    .digest('hex')
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

class InvalidOpenFdaResponseError extends Error {}

export class OpenFdaClient {
  private readonly apiKey: string
  private readonly cacheDir: string
  private readonly cacheReferencePrefix: string
  private readonly endpoint: string
  private readonly apiSchemaVersion: string
  private readonly intervalMs: number
  private readonly maxAttempts: number
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (milliseconds: number) => Promise<void>
  private readonly now: () => number
  private readonly random: () => number
  private nextRequestAt = 0
  private paceQueue: Promise<void> = Promise.resolve()
  private cacheWriteSequence = 0

  constructor({
    apiKey,
    cacheDir,
    cacheReferencePrefix = 'openfda-cache:',
    endpoint = OPENFDA_ENDPOINT,
    apiSchemaVersion = OPENFDA_API_SCHEMA_VERSION,
    requestsPerSecond = 3,
    maxAttempts = 5,
    timeoutMs = 30_000,
    fetchImpl = fetch,
    sleep = defaultSleep,
    now = Date.now,
    random = Math.random,
  }: OpenFdaClientOptions) {
    this.apiKey = apiKey
    this.cacheDir = cacheDir
    this.cacheReferencePrefix = cacheReferencePrefix
    this.endpoint = endpoint
    this.apiSchemaVersion = apiSchemaVersion
    this.intervalMs = 1_000 / Math.max(0.1, requestsPerSecond)
    this.maxAttempts = Math.max(1, Math.trunc(maxAttempts))
    this.timeoutMs = Math.max(1, Math.trunc(timeoutMs))
    this.fetchImpl = fetchImpl
    this.sleep = sleep
    this.now = now
    this.random = random
  }

  private async paceRequest(): Promise<void> {
    const previous = this.paceQueue
    let release: () => void = () => undefined
    this.paceQueue = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      const waitMs = Math.max(0, this.nextRequestAt - this.now())
      if (waitMs > 0) await this.sleep(waitMs)
      this.nextRequestAt = Math.max(this.nextRequestAt, this.now()) + this.intervalMs
    } finally {
      release()
    }
  }

  private cacheReference(cachePath: string): string {
    const filename = path.basename(cachePath)
    return this.cacheReferencePrefix.endsWith(':')
      ? `${this.cacheReferencePrefix}${filename}`
      : `${this.cacheReferencePrefix.replace(/[\\/]+$/, '')}/${filename}`.split(path.sep).join('/')
  }

  private publicRequestUrl(search: string, limit: number, skip: number): string {
    return buildOpenFdaRequestUrl({
      endpoint: this.endpoint,
      apiKey: '',
      search,
      limit,
      skip,
    }).toString()
  }

  private async readCache(
    cachePath: string,
    search: string,
    limit: number,
    skip: number,
  ): Promise<OpenFdaClientResult | null> {
    try {
      const parsed = openFdaCacheEntrySchema.safeParse(
        JSON.parse(await readFile(cachePath, 'utf8')) as unknown,
      )
      if (
        !parsed.success ||
        parsed.data.api_schema_version !== this.apiSchemaVersion ||
        parsed.data.request_search !== search ||
        parsed.data.limit !== limit ||
        (parsed.data.request_skip ?? 0) !== skip ||
        sha256(JSON.stringify(parsed.data.response)) !== parsed.data.response_sha256
      ) {
        return null
      }
      return {
        records: parsed.data.response.results,
        ...responseMetadata(parsed.data.response),
        retrievedAt: parsed.data.retrieved_at,
        fromCache: true,
        httpStatus: parsed.data.http_status,
        attemptCount: parsed.data.attempt_count,
        apiRequestsMade: 0,
        retryCount: 0,
        requestUrl: this.publicRequestUrl(search, limit, skip),
        requestSearch: search,
        requestLimit: limit,
        requestSkip: skip,
        responseSha256: parsed.data.response_sha256,
        rawCacheReference: this.cacheReference(cachePath),
      }
    } catch {
      return null
    }
  }

  private async writeCache(
    cachePath: string,
    value: Parameters<typeof openFdaCacheEntrySchema.parse>[0],
  ): Promise<void> {
    await mkdir(path.dirname(cachePath), { recursive: true })
    const validated = openFdaCacheEntrySchema.parse(value)
    this.cacheWriteSequence += 1
    const temporaryPath = `${cachePath}.${process.pid}.${this.now()}.${this.cacheWriteSequence}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    })
    await rename(temporaryPath, cachePath)
  }

  async request({
    search: rawSearch,
    limit: rawLimit,
    skip: rawSkip = 0,
    refresh = false,
  }: OpenFdaClientRequest): Promise<OpenFdaClientResult> {
    const search = normalizeSearchExpression(rawSearch)
    const limit = Math.max(1, Math.min(100, Math.trunc(rawLimit)))
    const skip = Math.max(0, Math.min(25_000, Math.trunc(rawSkip)))
    const cacheKey = computeOpenFdaCacheKey({
      endpoint: this.endpoint,
      search,
      limit,
      skip,
      apiSchemaVersion: this.apiSchemaVersion,
    })
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`)
    if (!refresh) {
      const cached = await this.readCache(cachePath, search, limit, skip)
      if (cached) return cached
    }

    const url = buildOpenFdaRequestUrl({
      endpoint: this.endpoint,
      apiKey: this.apiKey,
      search,
      limit,
      skip,
    })
    let lastStatus: number | null = null
    let lastError: unknown = null

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.paceRequest()
      const controller = new AbortController()
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, this.timeoutMs)

      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        lastStatus = response.status

        if (response.status === 404) {
          const normalizedResponse = { results: [] }
          const responseSha256 = sha256(JSON.stringify(normalizedResponse))
          const retrievedAt = new Date(this.now()).toISOString()
          await this.writeCache(cachePath, {
            format_version: 1,
            api_schema_version: this.apiSchemaVersion,
            retrieved_at: retrievedAt,
            request_search: search,
            limit,
            request_skip: skip,
            http_status: 404,
            attempt_count: attempt,
            response_sha256: responseSha256,
            response: normalizedResponse,
          })
          return {
            records: [],
            datasetLastUpdated: null,
            resultTotal: 0,
            retrievedAt,
            fromCache: false,
            httpStatus: 404,
            attemptCount: attempt,
            apiRequestsMade: attempt,
            retryCount: attempt - 1,
            requestUrl: this.publicRequestUrl(search, limit, skip),
            requestSearch: search,
            requestLimit: limit,
            requestSkip: skip,
            responseSha256,
            rawCacheReference: this.cacheReference(cachePath),
          }
        }

        if (!response.ok) {
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxAttempts) {
            lastError = new Error(`Retryable openFDA HTTP status ${response.status}.`)
          } else {
            throw new OpenFdaClientError(
              `openFDA request failed with HTTP ${response.status} for ${redactApiKey(
                url.toString(),
              )}`,
              { httpStatus: response.status, attemptCount: attempt },
            )
          }
        } else {
          const candidate = await response.json()
          const parsed = openFdaResponseSchema.safeParse(candidate)
          if (!parsed.success) {
            throw new InvalidOpenFdaResponseError(
              `openFDA returned an invalid UDI response: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`,
            )
          }
          const retrievedAt = new Date(this.now()).toISOString()
          const normalizedBody = JSON.stringify(parsed.data)
          const responseSha256 = sha256(normalizedBody)
          await this.writeCache(cachePath, {
            format_version: 1,
            api_schema_version: this.apiSchemaVersion,
            retrieved_at: retrievedAt,
            request_search: search,
            limit,
            request_skip: skip,
            http_status: response.status,
            attempt_count: attempt,
            response_sha256: responseSha256,
            response: parsed.data,
          })
          return {
            records: parsed.data.results,
            ...responseMetadata(parsed.data),
            retrievedAt,
            fromCache: false,
            httpStatus: response.status,
            attemptCount: attempt,
            apiRequestsMade: attempt,
            retryCount: attempt - 1,
            requestUrl: this.publicRequestUrl(search, limit, skip),
            requestSearch: search,
            requestLimit: limit,
            requestSkip: skip,
            responseSha256,
            rawCacheReference: this.cacheReference(cachePath),
          }
        }
      } catch (error) {
        if (error instanceof OpenFdaClientError) throw error
        if (error instanceof InvalidOpenFdaResponseError) {
          throw new OpenFdaClientError(error.message, {
            httpStatus: lastStatus,
            attemptCount: attempt,
          })
        }
        lastError = error
        if (attempt >= this.maxAttempts) {
          const reason = timedOut
            ? `timed out after ${this.timeoutMs} ms`
            : error instanceof Error
              ? redactApiKey(error.message)
              : 'transient network failure'
          throw new OpenFdaClientError(
            `openFDA request ${reason} for ${redactApiKey(url.toString())}`,
            { httpStatus: lastStatus, attemptCount: attempt },
          )
        }
      } finally {
        clearTimeout(timeout)
      }

      const exponentialMs = Math.min(30_000, 1_000 * 2 ** (attempt - 1))
      const jitteredMs = exponentialMs * (0.75 + this.random() * 0.5)
      await this.sleep(jitteredMs)
    }

    throw new OpenFdaClientError(
      `openFDA request failed for ${redactApiKey(url.toString())}: ${
        lastError instanceof Error ? redactApiKey(lastError.message) : 'unknown error'
      }`,
      { httpStatus: lastStatus, attemptCount: this.maxAttempts },
    )
  }
}
