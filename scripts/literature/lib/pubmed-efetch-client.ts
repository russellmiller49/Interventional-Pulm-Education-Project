import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { TextDecoder } from 'node:util'

import { z } from 'zod'

import {
  defaultPubmedMetadataParserLimits,
  parsePubmedMetadataXml,
  type PubmedMetadataRecord,
} from '@/features/literature/domain/pubmed-metadata'

export const PUBMED_EFETCH_ENDPOINT = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi'
export const PUBMED_EFETCH_MAX_BATCH_SIZE = 200
export const PUBMED_EFETCH_CACHE_SCHEMA_VERSION = 'pubmed-efetch-xml-v1'

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

const cacheMetadataSchema = z
  .object({
    format_version: z.literal(1),
    response_schema_version: z.literal(PUBMED_EFETCH_CACHE_SCHEMA_VERSION),
    requested_pmids: z
      .array(z.string().regex(/^\d{1,12}$/u))
      .min(1)
      .max(200),
    retrieved_at: z.string().datetime(),
    http_status: z.number().int().min(200).max(299),
    attempt_count: z.number().int().positive(),
    response_sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    raw_xml_filename: z.string().regex(/^[a-f0-9]{64}\.xml$/u),
  })
  .strict()

export interface PubmedEfetchClientOptions {
  apiKey?: string
  batchSize?: number
  cacheDir: string
  email: string
  endpoint?: string
  fetchImpl?: typeof fetch
  maxAttempts?: number
  maxResponseBytes?: number
  now?: () => number
  random?: () => number
  requestsPerSecond?: number
  sleep?: (milliseconds: number) => Promise<void>
  timeoutMs?: number
  tool: string
}

export interface PubmedEfetchRequestOptions {
  refresh?: boolean
}

export interface PubmedEfetchBatchResult {
  apiRequestsMade: number
  attemptCount: number
  fromCache: boolean
  rawCacheReference: string
  records: PubmedMetadataRecord[]
  requestedPmids: string[]
  retrievedAt: string
  sourceSha256: string
  unavailablePmids: string[]
}

export interface PubmedEfetchResult {
  batches: PubmedEfetchBatchResult[]
  records: PubmedMetadataRecord[]
  unavailablePmids: string[]
}

export class PubmedEfetchClientError extends Error {
  readonly attemptCount: number
  readonly httpStatus: number | null

  constructor(
    message: string,
    { attemptCount, httpStatus }: { attemptCount: number; httpStatus: number | null },
  ) {
    super(message)
    this.name = 'PubmedEfetchClientError'
    this.attemptCount = attemptCount
    this.httpStatus = httpStatus
  }
}

class InvalidPubmedResponseError extends Error {}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function canonicalizePubmedPmids(pmids: Iterable<string>): string[] {
  const normalized = [...pmids].map((value) => String(value).trim())
  for (const pmid of normalized) {
    if (!/^\d{1,12}$/u.test(pmid)) throw new Error(`Invalid PMID "${pmid}".`)
  }
  return [...new Set(normalized)].sort((left, right) => Number(left) - Number(right))
}

export function buildPubmedEfetchUrl({
  apiKey,
  email,
  endpoint = PUBMED_EFETCH_ENDPOINT,
  pmids,
  tool,
}: {
  apiKey?: string
  email: string
  endpoint?: string
  pmids: string[]
  tool: string
}): URL {
  const requestedPmids = canonicalizePubmedPmids(pmids)
  if (requestedPmids.length === 0 || requestedPmids.length > PUBMED_EFETCH_MAX_BATCH_SIZE) {
    throw new Error(`PubMed EFetch requests must contain 1-${PUBMED_EFETCH_MAX_BATCH_SIZE} PMIDs.`)
  }
  const url = new URL(endpoint)
  url.searchParams.set('db', 'pubmed')
  url.searchParams.set('retmode', 'xml')
  url.searchParams.set('id', requestedPmids.join(','))
  url.searchParams.set('tool', tool)
  url.searchParams.set('email', email)
  if (apiKey) url.searchParams.set('api_key', apiKey)
  return url
}

export function redactNcbiApiKey(value: string): string {
  try {
    const url = new URL(value)
    if (url.searchParams.has('api_key')) url.searchParams.set('api_key', '[REDACTED]')
    return url.toString()
  } catch {
    return value.replace(/([?&]api_key=)[^&\s]+/giu, '$1[REDACTED]')
  }
}

export function computePubmedEfetchCacheKey({
  endpoint = PUBMED_EFETCH_ENDPOINT,
  pmids,
}: {
  endpoint?: string
  pmids: string[]
}): string {
  return sha256(
    JSON.stringify({
      endpoint,
      db: 'pubmed',
      retmode: 'xml',
      requested_pmids: canonicalizePubmedPmids(pmids),
      response_schema_version: PUBMED_EFETCH_CACHE_SCHEMA_VERSION,
    }),
  )
}

export function retryAfterMilliseconds(value: string | null, now: number): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d+$/u.test(trimmed)) return Number(trimmed) * 1_000
  const date = Date.parse(trimmed)
  if (!Number.isFinite(date)) return null
  return Math.max(0, date - now)
}

async function readResponseBytesBounded(response: Response, maximumBytes: number): Promise<Buffer> {
  const declaredLength = response.headers.get('content-length')
  if (declaredLength && Number(declaredLength) > maximumBytes) {
    throw new InvalidPubmedResponseError(
      `PubMed EFetch response exceeds the ${maximumBytes}-byte limit.`,
    )
  }

  if (!response.body) {
    const value = Buffer.from(await response.arrayBuffer())
    if (value.length > maximumBytes) {
      throw new InvalidPubmedResponseError(
        `PubMed EFetch response exceeds the ${maximumBytes}-byte limit.`,
      )
    }
    return value
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let byteCount = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = Buffer.from(value)
    byteCount += chunk.length
    if (byteCount > maximumBytes) {
      await reader.cancel()
      throw new InvalidPubmedResponseError(
        `PubMed EFetch response exceeds the ${maximumBytes}-byte limit.`,
      )
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function decodePubmedXmlBytes(value: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value)
  } catch {
    throw new InvalidPubmedResponseError('PubMed EFetch response is not valid UTF-8.')
  }
}

function reconcileResponse(requestedPmids: string[], xml: string, maximumBytes: number) {
  const records = parsePubmedMetadataXml(xml, {
    ...defaultPubmedMetadataParserLimits,
    maxResponseBytes: maximumBytes,
  })
  const requested = new Set(requestedPmids)
  for (const record of records) {
    if (!requested.has(record.pmid)) {
      throw new InvalidPubmedResponseError(
        `PubMed EFetch returned unrequested PMID ${record.pmid}.`,
      )
    }
  }
  const returned = new Set(records.map((record) => record.pmid))
  return {
    records,
    unavailablePmids: requestedPmids.filter((pmid) => !returned.has(pmid)),
  }
}

export class PubmedEfetchClient {
  private readonly apiKey: string
  private readonly batchSize: number
  private readonly cacheDir: string
  private readonly email: string
  private readonly endpoint: string
  private readonly fetchImpl: typeof fetch
  private readonly intervalMs: number
  private readonly maxAttempts: number
  private readonly maxResponseBytes: number
  private readonly now: () => number
  private readonly random: () => number
  private readonly sleep: (milliseconds: number) => Promise<void>
  private readonly timeoutMs: number
  private readonly tool: string
  private cacheWriteSequence = 0
  private nextRequestAt = 0
  private paceQueue: Promise<void> = Promise.resolve()

  constructor({
    apiKey = '',
    batchSize = PUBMED_EFETCH_MAX_BATCH_SIZE,
    cacheDir,
    email,
    endpoint = PUBMED_EFETCH_ENDPOINT,
    fetchImpl = fetch,
    maxAttempts = 5,
    maxResponseBytes = defaultPubmedMetadataParserLimits.maxResponseBytes,
    now = Date.now,
    random = Math.random,
    requestsPerSecond = 3,
    sleep = defaultSleep,
    timeoutMs = 30_000,
    tool,
  }: PubmedEfetchClientOptions) {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) {
      throw new Error('PubMed EFetch batch size must be an integer from 1 through 200.')
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/u.test(email.trim())) {
      throw new Error('NCBI EFetch requires a valid contact email.')
    }
    if (!tool.trim() || !/^[a-z0-9._-]+$/iu.test(tool.trim())) {
      throw new Error('NCBI EFetch requires a simple nonblank tool identifier.')
    }
    if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0) {
      throw new Error('PubMed EFetch requests per second must be positive.')
    }
    this.apiKey = apiKey.trim()
    this.batchSize = batchSize
    this.cacheDir = cacheDir
    this.email = email.trim()
    this.endpoint = endpoint
    this.fetchImpl = fetchImpl
    this.intervalMs = 1_000 / requestsPerSecond
    this.maxAttempts = Math.max(1, Math.trunc(maxAttempts))
    this.maxResponseBytes = Math.max(1, Math.trunc(maxResponseBytes))
    this.now = now
    this.random = random
    this.sleep = sleep
    this.timeoutMs = Math.max(1, Math.trunc(timeoutMs))
    this.tool = tool.trim()
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

  private async atomicWrite(filePath: string, value: string | Buffer): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true })
    this.cacheWriteSequence += 1
    const temporaryPath = `${filePath}.${process.pid}.${this.now()}.${this.cacheWriteSequence}.tmp`
    await writeFile(temporaryPath, value, { flag: 'wx', mode: 0o600 })
    await rename(temporaryPath, filePath)
  }

  private async readCache(
    cacheKey: string,
    requestedPmids: string[],
  ): Promise<PubmedEfetchBatchResult | null> {
    const metadataPath = path.join(this.cacheDir, `${cacheKey}.json`)
    const xmlPath = path.join(this.cacheDir, `${cacheKey}.xml`)
    try {
      const metadata = cacheMetadataSchema.parse(
        JSON.parse(await readFile(metadataPath, 'utf8')) as unknown,
      )
      if (
        metadata.raw_xml_filename !== `${cacheKey}.xml` ||
        JSON.stringify(metadata.requested_pmids) !== JSON.stringify(requestedPmids)
      ) {
        return null
      }
      const xmlBytes = await readFile(xmlPath)
      if (sha256(xmlBytes) !== metadata.response_sha256) return null
      const xml = decodePubmedXmlBytes(xmlBytes)
      const reconciled = reconcileResponse(requestedPmids, xml, this.maxResponseBytes)
      return {
        ...reconciled,
        requestedPmids,
        retrievedAt: metadata.retrieved_at,
        sourceSha256: metadata.response_sha256,
        rawCacheReference: `pubmed-efetch-cache:${cacheKey}.xml`,
        fromCache: true,
        attemptCount: metadata.attempt_count,
        apiRequestsMade: 0,
      }
    } catch {
      return null
    }
  }

  private async writeCache({
    attemptCount,
    cacheKey,
    requestedPmids,
    retrievedAt,
    sourceSha256,
    xmlBytes,
  }: {
    attemptCount: number
    cacheKey: string
    requestedPmids: string[]
    retrievedAt: string
    sourceSha256: string
    xmlBytes: Buffer
  }): Promise<void> {
    const xmlFilename = `${cacheKey}.xml`
    const metadata = cacheMetadataSchema.parse({
      format_version: 1,
      response_schema_version: PUBMED_EFETCH_CACHE_SCHEMA_VERSION,
      requested_pmids: requestedPmids,
      retrieved_at: retrievedAt,
      http_status: 200,
      attempt_count: attemptCount,
      response_sha256: sourceSha256,
      raw_xml_filename: xmlFilename,
    })
    await this.atomicWrite(path.join(this.cacheDir, xmlFilename), xmlBytes)
    await this.atomicWrite(
      path.join(this.cacheDir, `${cacheKey}.json`),
      `${JSON.stringify(metadata, null, 2)}\n`,
    )
  }

  async requestBatch(
    pmids: string[],
    { refresh = false }: PubmedEfetchRequestOptions = {},
  ): Promise<PubmedEfetchBatchResult> {
    const requestedPmids = canonicalizePubmedPmids(pmids)
    if (requestedPmids.length === 0 || requestedPmids.length > PUBMED_EFETCH_MAX_BATCH_SIZE) {
      throw new Error(
        `PubMed EFetch requests must contain 1-${PUBMED_EFETCH_MAX_BATCH_SIZE} PMIDs.`,
      )
    }
    const cacheKey = computePubmedEfetchCacheKey({ endpoint: this.endpoint, pmids: requestedPmids })
    if (!refresh) {
      const cached = await this.readCache(cacheKey, requestedPmids)
      if (cached) return cached
    }

    const url = buildPubmedEfetchUrl({
      endpoint: this.endpoint,
      pmids: requestedPmids,
      tool: this.tool,
      email: this.email,
      apiKey: this.apiKey,
    })
    let lastStatus: number | null = null

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.paceRequest()
      const controller = new AbortController()
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, this.timeoutMs)
      let retryDelayMs: number | null = null

      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers: { Accept: 'application/xml, text/xml' },
          signal: controller.signal,
        })
        lastStatus = response.status
        if (!response.ok) {
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxAttempts) {
            retryDelayMs = retryAfterMilliseconds(response.headers.get('retry-after'), this.now())
          } else {
            throw new PubmedEfetchClientError(
              `PubMed EFetch failed with HTTP ${response.status} for ${redactNcbiApiKey(url.toString())}`,
              { attemptCount: attempt, httpStatus: response.status },
            )
          }
        } else {
          const xmlBytes = await readResponseBytesBounded(response, this.maxResponseBytes)
          const xml = decodePubmedXmlBytes(xmlBytes)
          const reconciled = reconcileResponse(requestedPmids, xml, this.maxResponseBytes)
          const retrievedAt = new Date(this.now()).toISOString()
          const sourceSha256 = sha256(xmlBytes)
          await this.writeCache({
            attemptCount: attempt,
            cacheKey,
            requestedPmids,
            retrievedAt,
            sourceSha256,
            xmlBytes,
          })
          return {
            ...reconciled,
            requestedPmids,
            retrievedAt,
            sourceSha256,
            rawCacheReference: `pubmed-efetch-cache:${cacheKey}.xml`,
            fromCache: false,
            attemptCount: attempt,
            apiRequestsMade: attempt,
          }
        }
      } catch (error) {
        if (error instanceof PubmedEfetchClientError) throw error
        if (error instanceof InvalidPubmedResponseError) {
          throw new PubmedEfetchClientError(error.message, {
            attemptCount: attempt,
            httpStatus: lastStatus,
          })
        }
        if (attempt >= this.maxAttempts) {
          const reason = timedOut
            ? `timed out after ${this.timeoutMs} ms`
            : error instanceof Error
              ? redactNcbiApiKey(error.message)
              : 'transient network failure'
          throw new PubmedEfetchClientError(
            `PubMed EFetch ${reason} for ${redactNcbiApiKey(url.toString())}`,
            { attemptCount: attempt, httpStatus: lastStatus },
          )
        }
      } finally {
        clearTimeout(timeout)
      }

      const exponentialMs = Math.min(30_000, 1_000 * 2 ** (attempt - 1))
      const jitteredMs = exponentialMs * (0.75 + this.random() * 0.5)
      await this.sleep(Math.max(jitteredMs, retryDelayMs ?? 0))
    }

    throw new PubmedEfetchClientError('PubMed EFetch exhausted its attempts.', {
      attemptCount: this.maxAttempts,
      httpStatus: lastStatus,
    })
  }

  async fetchPmids(
    pmids: string[],
    options: PubmedEfetchRequestOptions = {},
  ): Promise<PubmedEfetchResult> {
    const requestedPmids = canonicalizePubmedPmids(pmids)
    const batches: PubmedEfetchBatchResult[] = []
    for (let start = 0; start < requestedPmids.length; start += this.batchSize) {
      batches.push(
        await this.requestBatch(requestedPmids.slice(start, start + this.batchSize), options),
      )
    }
    return {
      batches,
      records: batches.flatMap((batch) => batch.records),
      unavailablePmids: batches.flatMap((batch) => batch.unavailablePmids),
    }
  }
}
