import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import * as babelPlugin from 'prettier/plugins/babel'
import * as estreePlugin from 'prettier/plugins/estree'
import { format } from 'prettier/standalone'
import { z } from 'zod'

const execFileAsync = promisify(execFile)

export const MANUFACTURER_SOURCE_REGISTRY_PATH =
  'data/ip-preference-cards/research/us-status-v1/manufacturer-source-registry.json'
export const MANUFACTURER_SOURCE_OUTPUT_ROOT = 'data/ip-preference-cards/research/us-status'
export const MANUFACTURER_SOURCE_CACHE_ROOT = 'local-data/ip-preference-cards/us-status'

const DEFAULT_CONCURRENCY = 3
const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_TIMEOUT_MS = 30_000
// The current official Erbe U.S. catalog is larger than 64 MiB. Keep the cap bounded while
// allowing that reviewed source to be cached and hashed without truncation.
const DEFAULT_MAX_BODY_BYTES = 128 * 1024 * 1024
const PDFTOTEXT_PATH = '/opt/homebrew/bin/pdftotext'
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])
let pdfTemporarySequence = 0

const registryRowSchema = z
  .object({
    catalog_source_id: z.string().min(1),
    manufacturer: z.string().min(1),
    source_url: z.string().url(),
    publisher: z.string().min(1),
    title: z.string().min(1),
    publication_or_revision_date: z.string().min(1).nullable(),
    us_specific: z.boolean(),
    current_status_signal: z.enum([
      'current_catalog_or_product_page',
      'historical_only',
      'identity_only',
    ]),
    exact_identifier_basis: z.string().min(1),
    expected_identifier_examples: z.array(z.string().min(1)).min(1),
    factual_summary: z.string().min(1),
    limitations: z.string().min(1),
  })
  .strict()

const registrySchema = z.array(registryRowSchema).min(1)

export type ManufacturerSourceRegistryRow = z.infer<typeof registryRowSchema>

export type TextExtractionStatus =
  | 'html_text'
  | 'plain_text'
  | 'pdf_pdftotext'
  | 'pdf_extraction_unavailable'
  | 'pdf_extraction_failed'
  | 'unsupported_content_type'

interface ManufacturerCacheMetadata {
  format_version: 1
  request_url: string
  final_url: string
  retrieved_at: string
  http_status: number
  content_type: string
  attempt_count: number
  body_sha256: string
  body_file: string
  searchable_text_sha256: string
  text_file: string
  text_extraction_status: TextExtractionStatus
  fetch_error: string | null
}

interface ManufacturerCachePointer {
  format_version: 1
  request_url: string
  metadata_file: string
}

interface CachedManufacturerSource {
  metadata: ManufacturerCacheMetadata
  searchableText: string
}

interface FetchedManufacturerResponse {
  status: number
  contentType: string
  finalUrl: string
  body: Buffer
}

export interface ExpectedIdentifierMatch {
  identifier: string
  exact_text_match: boolean
}

export interface ManufacturerSourceManifestRow extends ManufacturerSourceRegistryRow {
  retrieved_at: string
  http_status: number
  http_ok: boolean
  content_type: string
  final_url: string
  attempt_count: number
  body_sha256: string
  searchable_text_sha256: string
  text_extraction_status: TextExtractionStatus
  fetch_error: string | null
  text_cache_reference: string
  expected_identifier_matches: ExpectedIdentifierMatch[]
  all_expected_identifiers_found: boolean
  canonical_change_applied: false
}

export interface ManufacturerSourceManifest {
  format_version: 1
  snapshot: string
  registry_path: string
  registry_sha256: string
  registry_entry_count: number
  unique_url_count: number
  canonical_change_applied: false
  sources: ManufacturerSourceManifestRow[]
}

export interface ManufacturerSourceCliOptions {
  snapshot: string
  outputPath: string
  refresh: boolean
  concurrency: number
  maxAttempts: number
  timeoutMs: number
}

export interface FetchManufacturerSourcesOptions {
  snapshot: string
  outputPath: string
  registryPath?: string
  registryReference?: string
  cacheDirectory?: string
  cacheReferenceDirectory?: string
  refresh?: boolean
  concurrency?: number
  maxAttempts?: number
  timeoutMs?: number
  maxBodyBytes?: number
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => number
  pdfTextExtractor?: (body: Buffer) => Promise<string>
  preserveFetchFailures?: boolean
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function portablePath(value: string): string {
  return value.split(path.sep).join('/')
}

function jsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function formattedJsonBytes(value: unknown): Promise<string> {
  return format(jsonBytes(value), {
    parser: 'json',
    plugins: [babelPlugin, estreePlugin],
    printWidth: 100,
  })
}

function argumentValue(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`)
  return value
}

function positiveInteger(value: string, option: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${option} must be a positive integer.`)
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer.`)
  }
  return parsed
}

export function validateSnapshot(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('--snapshot must be a calendar date in YYYY-MM-DD format.')
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('--snapshot must be a valid calendar date in YYYY-MM-DD format.')
  }
  return value
}

export function parseManufacturerSourceArgs(args: string[]): ManufacturerSourceCliOptions {
  let snapshot: string | null = null
  let outputPath: string | null = null
  let refresh = false
  let concurrency = DEFAULT_CONCURRENCY
  let maxAttempts = DEFAULT_MAX_ATTEMPTS
  let timeoutMs = DEFAULT_TIMEOUT_MS

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case '--snapshot':
        if (snapshot !== null) throw new Error('--snapshot may be specified only once.')
        snapshot = validateSnapshot(argumentValue(args, index, argument))
        index += 1
        break
      case '--output':
        if (outputPath !== null) throw new Error('--output may be specified only once.')
        outputPath = argumentValue(args, index, argument)
        index += 1
        break
      case '--refresh':
        refresh = true
        break
      case '--concurrency':
        concurrency = positiveInteger(argumentValue(args, index, argument), argument)
        index += 1
        break
      case '--max-attempts':
        maxAttempts = positiveInteger(argumentValue(args, index, argument), argument)
        index += 1
        break
      case '--timeout-ms':
        timeoutMs = positiveInteger(argumentValue(args, index, argument), argument)
        index += 1
        break
      default:
        throw new Error(`Unknown option: ${argument}`)
    }
  }

  if (!snapshot) throw new Error('--snapshot is required.')
  if (!outputPath) throw new Error('--output is required.')
  return {
    snapshot,
    outputPath,
    refresh,
    concurrency: Math.min(concurrency, 8),
    maxAttempts: Math.min(maxAttempts, 8),
    timeoutMs: Math.min(timeoutMs, 120_000),
  }
}

export function validateManufacturerSourceOutputPath(snapshot: string, outputPath: string): string {
  const checkedSnapshot = validateSnapshot(snapshot)
  const requiredDirectory = path.resolve(MANUFACTURER_SOURCE_OUTPUT_ROOT, checkedSnapshot)
  const resolved = path.resolve(outputPath)
  const allowedBasenames = new Set(['manufacturer-source-snapshot.json', 'source-manifest.json'])
  if (
    path.dirname(resolved) !== requiredDirectory ||
    !allowedBasenames.has(path.basename(resolved))
  ) {
    throw new Error(
      `--output must be a source-manifest.json or manufacturer-source-snapshot.json file directly under ${portablePath(
        path.join(MANUFACTURER_SOURCE_OUTPUT_ROOT, checkedSnapshot),
      )}.`,
    )
  }
  return resolved
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([a-f\d]+);/gi, (_, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 16)),
    )
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

export function extractSearchableHtmlText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeExtractedText(value: string): string {
  return value.normalize('NFKC').toLocaleUpperCase('en-US').replace(/\s+/g, ' ').trim()
}

function isLetterOrNumber(value: string | undefined): boolean {
  return Boolean(value && /[\p{L}\p{N}]/u.test(value))
}

function continuesIdentifier(value: string, boundaryIndex: number, direction: -1 | 1): boolean {
  const boundary = value[boundaryIndex]
  if (isLetterOrNumber(boundary)) return true
  if (!boundary || !/[-._/]/.test(boundary)) return false
  return isLetterOrNumber(value[boundaryIndex + direction])
}

/**
 * Exact, punctuation-preserving identifier lookup for any catalog/model identifier. The helper
 * is intentionally independent of registry examples so a full-product runner can evaluate every
 * catalog row against the cached source text.
 */
export function exactIdentifierMatchInExtractedText(
  identifier: string,
  extractedText: string,
): boolean {
  const needle = normalizeExtractedText(identifier)
  if (!needle) return false
  const haystack = normalizeExtractedText(extractedText)
  let index = haystack.indexOf(needle)
  while (index >= 0) {
    const afterIndex = index + needle.length
    const continuesBefore = continuesIdentifier(haystack, index - 1, -1)
    const continuesAfter = continuesIdentifier(haystack, afterIndex, 1)
    if (!continuesBefore && !continuesAfter) return true
    index = haystack.indexOf(needle, index + 1)
  }
  return false
}

async function fileExists(filename: string): Promise<boolean> {
  try {
    await access(filename)
    return true
  } catch {
    return false
  }
}

async function atomicWrite(
  filename: string,
  contents: Buffer | string,
  mode: number,
): Promise<void> {
  await mkdir(path.dirname(filename), { recursive: true })
  const temporary = `${filename}.${process.pid}.${sha256(
    `${filename}\u0000${Date.now()}\u0000${Math.random()}`,
  ).slice(0, 12)}.tmp`
  try {
    await writeFile(temporary, contents, { mode })
    await rename(temporary, filename)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

async function writeImmutableCacheFile(filename: string, contents: Buffer | string): Promise<void> {
  try {
    const existing = await readFile(filename)
    const expected = Buffer.isBuffer(contents) ? contents : Buffer.from(contents)
    if (!existing.equals(expected)) {
      throw new Error(`Content-addressed cache collision at ${filename}.`)
    }
    return
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : null
    if (code !== 'ENOENT') throw error
  }
  await atomicWrite(filename, contents, 0o600)
}

function validatedCacheBasename(value: unknown): string | null {
  if (typeof value !== 'string' || !value || path.basename(value) !== value) return null
  return value
}

function parseCachePointer(value: unknown, requestUrl: string): ManufacturerCachePointer | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ManufacturerCachePointer>
  const metadataFile = validatedCacheBasename(candidate.metadata_file)
  if (candidate.format_version !== 1 || candidate.request_url !== requestUrl || !metadataFile) {
    return null
  }
  return { format_version: 1, request_url: requestUrl, metadata_file: metadataFile }
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{64}$/.test(value)
}

const TEXT_EXTRACTION_STATUSES = new Set<TextExtractionStatus>([
  'html_text',
  'plain_text',
  'pdf_pdftotext',
  'pdf_extraction_unavailable',
  'pdf_extraction_failed',
  'unsupported_content_type',
])

function parseCacheMetadata(value: unknown, requestUrl: string): ManufacturerCacheMetadata | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ManufacturerCacheMetadata>
  const bodyFile = validatedCacheBasename(candidate.body_file)
  const textFile = validatedCacheBasename(candidate.text_file)
  if (
    candidate.format_version !== 1 ||
    candidate.request_url !== requestUrl ||
    typeof candidate.final_url !== 'string' ||
    typeof candidate.retrieved_at !== 'string' ||
    Number.isNaN(Date.parse(candidate.retrieved_at)) ||
    !Number.isInteger(candidate.http_status) ||
    typeof candidate.content_type !== 'string' ||
    !Number.isInteger(candidate.attempt_count) ||
    !isSha256(candidate.body_sha256) ||
    !bodyFile ||
    !isSha256(candidate.searchable_text_sha256) ||
    !textFile ||
    !TEXT_EXTRACTION_STATUSES.has(candidate.text_extraction_status as TextExtractionStatus) ||
    (candidate.fetch_error !== undefined &&
      candidate.fetch_error !== null &&
      typeof candidate.fetch_error !== 'string')
  ) {
    return null
  }
  return { ...candidate, fetch_error: candidate.fetch_error ?? null } as ManufacturerCacheMetadata
}

async function readCachedSource(
  cacheDirectory: string,
  requestUrl: string,
): Promise<CachedManufacturerSource | null> {
  const urlKey = sha256(requestUrl)
  try {
    const pointer = parseCachePointer(
      JSON.parse(
        await readFile(path.join(cacheDirectory, `${urlKey}.cache.json`), 'utf8'),
      ) as unknown,
      requestUrl,
    )
    if (!pointer) return null
    const metadata = parseCacheMetadata(
      JSON.parse(
        await readFile(path.join(cacheDirectory, pointer.metadata_file), 'utf8'),
      ) as unknown,
      requestUrl,
    )
    if (!metadata) return null
    const [body, searchableText] = await Promise.all([
      readFile(path.join(cacheDirectory, metadata.body_file)),
      readFile(path.join(cacheDirectory, metadata.text_file), 'utf8'),
    ])
    if (
      sha256(body) !== metadata.body_sha256 ||
      sha256(searchableText) !== metadata.searchable_text_sha256
    ) {
      return null
    }
    return { metadata, searchableText }
  } catch {
    return null
  }
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchWithRetry({
  url,
  fetchImpl,
  maxAttempts,
  timeoutMs,
  maxBodyBytes,
  sleep,
}: {
  url: string
  fetchImpl: typeof fetch
  maxAttempts: number
  timeoutMs: number
  maxBodyBytes: number
  sleep: (milliseconds: number) => Promise<void>
}): Promise<{ response: FetchedManufacturerResponse; attemptCount: number }> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timeoutFailure = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort()
        reject(new Error(`request timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
    try {
      const response = await Promise.race([
        fetchImpl(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            Accept: 'text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5',
          },
          signal: controller.signal,
        }),
        timeoutFailure,
      ])
      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts) {
        await Promise.race([
          response.body?.cancel().catch(() => undefined) ?? Promise.resolve(),
          timeoutFailure,
        ])
      } else {
        const declaredLength = Number(response.headers.get('content-length'))
        if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
          throw new Error(`response exceeds ${maxBodyBytes} bytes`)
        }
        const body = Buffer.from(await Promise.race([response.arrayBuffer(), timeoutFailure]))
        if (body.byteLength > maxBodyBytes) {
          throw new Error(`response exceeds ${maxBodyBytes} bytes`)
        }
        return {
          response: {
            status: response.status,
            contentType: response.headers.get('content-type')?.trim() || 'application/octet-stream',
            finalUrl: response.url || url,
            body,
          },
          attemptCount: attempt,
        }
      }
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) {
        throw new Error(
          `Manufacturer source request failed after ${attempt} attempts for ${url}: ${
            error instanceof Error ? error.message : 'network failure'
          }`,
        )
      }
    } finally {
      if (timeout) clearTimeout(timeout)
    }
    const delay = Math.min(8_000, 250 * 2 ** (attempt - 1))
    await sleep(delay)
  }
  throw new Error(
    `Manufacturer source request failed for ${url}: ${
      lastError instanceof Error ? lastError.message : 'unknown failure'
    }`,
  )
}

function responseLooksLikePdf(contentType: string, finalUrl: string): boolean {
  if (/\bapplication\/pdf\b/i.test(contentType)) return true
  try {
    return new URL(finalUrl).pathname.toLocaleLowerCase('en-US').endsWith('.pdf')
  } catch {
    return false
  }
}

async function defaultPdfTextExtraction(
  body: Buffer,
  cacheDirectory: string,
  timeoutMs: number,
): Promise<{ text: string; status: TextExtractionStatus }> {
  if (!existsSync(PDFTOTEXT_PATH)) {
    return { text: '', status: 'pdf_extraction_unavailable' }
  }
  await mkdir(cacheDirectory, { recursive: true })
  const temporaryPdf = path.join(
    cacheDirectory,
    `.pdftotext-${process.pid}-${pdfTemporarySequence++}-${sha256(body).slice(0, 16)}.pdf.tmp`,
  )
  try {
    await writeFile(temporaryPdf, body, { mode: 0o600 })
    const { stdout } = await execFileAsync(PDFTOTEXT_PATH, [temporaryPdf, '-'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: timeoutMs,
    })
    return { text: stdout, status: 'pdf_pdftotext' }
  } catch {
    return { text: '', status: 'pdf_extraction_failed' }
  } finally {
    await rm(temporaryPdf, { force: true })
  }
}

async function extractSearchableText({
  body,
  contentType,
  finalUrl,
  cacheDirectory,
  timeoutMs,
  pdfTextExtractor,
}: {
  body: Buffer
  contentType: string
  finalUrl: string
  cacheDirectory: string
  timeoutMs: number
  pdfTextExtractor?: (body: Buffer) => Promise<string>
}): Promise<{ text: string; status: TextExtractionStatus }> {
  if (responseLooksLikePdf(contentType, finalUrl)) {
    if (pdfTextExtractor) {
      try {
        return { text: await pdfTextExtractor(body), status: 'pdf_pdftotext' }
      } catch {
        return { text: '', status: 'pdf_extraction_failed' }
      }
    }
    return defaultPdfTextExtraction(body, cacheDirectory, timeoutMs)
  }
  if (/\btext\/html\b|\bapplication\/xhtml\+xml\b/i.test(contentType)) {
    return { text: extractSearchableHtmlText(body.toString('utf8')), status: 'html_text' }
  }
  if (/\btext\/plain\b/i.test(contentType)) {
    return {
      text: body.toString('utf8').normalize('NFKC').replace(/\s+/g, ' ').trim(),
      status: 'plain_text',
    }
  }
  return { text: '', status: 'unsupported_content_type' }
}

async function cacheFetchedResponse({
  requestUrl,
  response,
  attemptCount,
  cacheDirectory,
  timeoutMs,
  now,
  pdfTextExtractor,
  fetchError = null,
}: {
  requestUrl: string
  response: FetchedManufacturerResponse
  attemptCount: number
  cacheDirectory: string
  timeoutMs: number
  now: () => number
  pdfTextExtractor?: (body: Buffer) => Promise<string>
  fetchError?: string | null
}): Promise<CachedManufacturerSource> {
  const { body, contentType, finalUrl } = response
  const extracted = await extractSearchableText({
    body,
    contentType,
    finalUrl,
    cacheDirectory,
    timeoutMs,
    pdfTextExtractor,
  })
  const searchableText = extracted.text.normalize('NFKC').replace(/\s+/g, ' ').trim()
  const bodySha = sha256(body)
  const textSha = sha256(searchableText)
  const urlKey = sha256(requestUrl)
  const bodyFile = `${urlKey}-${bodySha}.body`
  const textFile = `${urlKey}-${bodySha}-${textSha}.txt`
  const retrievedAt = new Date(now()).toISOString()
  const retrievalKey = retrievedAt.replace(/[^\d]/g, '')
  const metadataFile = `${urlKey}-${retrievalKey}-${bodySha.slice(0, 12)}.json`
  const metadata: ManufacturerCacheMetadata = {
    format_version: 1,
    request_url: requestUrl,
    final_url: finalUrl,
    retrieved_at: retrievedAt,
    http_status: response.status,
    content_type: contentType,
    attempt_count: attemptCount,
    body_sha256: bodySha,
    body_file: bodyFile,
    searchable_text_sha256: textSha,
    text_file: textFile,
    text_extraction_status: extracted.status,
    fetch_error: fetchError,
  }
  const pointer: ManufacturerCachePointer = {
    format_version: 1,
    request_url: requestUrl,
    metadata_file: metadataFile,
  }

  await mkdir(cacheDirectory, { recursive: true })
  await Promise.all([
    writeImmutableCacheFile(path.join(cacheDirectory, bodyFile), body),
    writeImmutableCacheFile(path.join(cacheDirectory, textFile), searchableText),
    writeImmutableCacheFile(path.join(cacheDirectory, metadataFile), jsonBytes(metadata)),
  ])
  await atomicWrite(path.join(cacheDirectory, `${urlKey}.cache.json`), jsonBytes(pointer), 0o600)
  return { metadata, searchableText }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, () => worker()),
  )
  return results
}

function validateOfficialUrl(value: string): void {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`Manufacturer source URLs must be credential-free HTTPS URLs: ${value}`)
  }
}

function manifestRow(
  registry: ManufacturerSourceRegistryRow,
  cached: CachedManufacturerSource,
  cacheReferenceDirectory: string,
): ManufacturerSourceManifestRow {
  const expectedIdentifierExamples = [...new Set(registry.expected_identifier_examples)].sort(
    (left, right) => left.localeCompare(right),
  )
  const httpOk = cached.metadata.http_status >= 200 && cached.metadata.http_status < 300
  const matches = expectedIdentifierExamples.map((identifier) => ({
    identifier,
    exact_text_match:
      httpOk && exactIdentifierMatchInExtractedText(identifier, cached.searchableText),
  }))
  return {
    ...registry,
    expected_identifier_examples: expectedIdentifierExamples,
    retrieved_at: cached.metadata.retrieved_at,
    http_status: cached.metadata.http_status,
    http_ok: httpOk,
    content_type: cached.metadata.content_type,
    final_url: cached.metadata.final_url,
    attempt_count: cached.metadata.attempt_count,
    body_sha256: cached.metadata.body_sha256,
    searchable_text_sha256: cached.metadata.searchable_text_sha256,
    text_extraction_status: cached.metadata.text_extraction_status,
    fetch_error: cached.metadata.fetch_error,
    text_cache_reference: portablePath(
      path.posix.join(portablePath(cacheReferenceDirectory), cached.metadata.text_file),
    ),
    expected_identifier_matches: matches,
    all_expected_identifiers_found: matches.every((entry) => entry.exact_text_match),
    canonical_change_applied: false,
  }
}

export async function fetchManufacturerSources(
  options: FetchManufacturerSourcesOptions,
): Promise<ManufacturerSourceManifest> {
  const snapshot = validateSnapshot(options.snapshot)
  const registryPath = options.registryPath ?? MANUFACTURER_SOURCE_REGISTRY_PATH
  const registryReference =
    options.registryReference ?? portablePath(path.relative(process.cwd(), registryPath))
  const cacheDirectory =
    options.cacheDirectory ?? path.join(MANUFACTURER_SOURCE_CACHE_ROOT, snapshot, 'manufacturer')
  const cacheReferenceDirectory =
    options.cacheReferenceDirectory ??
    path.posix.join(MANUFACTURER_SOURCE_CACHE_ROOT, snapshot, 'manufacturer')
  const refresh = options.refresh ?? false
  const concurrency = Math.min(Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY), 8)
  const maxAttempts = Math.min(Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS), 8)
  const timeoutMs = Math.min(Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS), 120_000)
  const maxBodyBytes = Math.min(
    Math.max(1, options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES),
    256 * 1024 * 1024,
  )
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? defaultSleep
  const now = options.now ?? Date.now
  const preserveFetchFailures = options.preserveFetchFailures ?? false
  const outputAlreadyExists = await fileExists(options.outputPath)
  if (refresh && outputAlreadyExists) {
    throw new Error(
      `Refusing to refresh existing dated source manifest ${options.outputPath}; choose a different snapshot and output path.`,
    )
  }

  const registryBytes = await readFile(registryPath)
  const registry = registrySchema.parse(JSON.parse(registryBytes.toString('utf8')) as unknown)
  for (const row of registry) validateOfficialUrl(row.source_url)
  const uniqueUrls = [...new Set(registry.map((row) => row.source_url))].sort((left, right) =>
    left.localeCompare(right),
  )

  const cachedByUrl = new Map<string, CachedManufacturerSource>()
  const fetched = await mapWithConcurrency(uniqueUrls, concurrency, async (url) => {
    if (!refresh) {
      const cached = await readCachedSource(cacheDirectory, url)
      if (cached) return [url, cached] as const
      if (outputAlreadyExists) {
        throw new Error(
          `Existing dated source manifest cannot be reproduced from cache for ${url}; choose a new snapshot/output instead of refetching.`,
        )
      }
    }
    let cached: CachedManufacturerSource
    try {
      const { response, attemptCount } = await fetchWithRetry({
        url,
        fetchImpl,
        maxAttempts,
        timeoutMs,
        maxBodyBytes,
        sleep,
      })
      cached = await cacheFetchedResponse({
        requestUrl: url,
        response,
        attemptCount,
        cacheDirectory,
        timeoutMs,
        now,
        pdfTextExtractor: options.pdfTextExtractor,
      })
    } catch (error) {
      if (!preserveFetchFailures) throw error
      const message = error instanceof Error ? error.message : 'manufacturer source fetch failed'
      cached = await cacheFetchedResponse({
        requestUrl: url,
        response: {
          status: 0,
          contentType: 'application/octet-stream',
          finalUrl: url,
          body: Buffer.alloc(0),
        },
        attemptCount: maxAttempts,
        cacheDirectory,
        timeoutMs,
        now,
        pdfTextExtractor: options.pdfTextExtractor,
        fetchError: message,
      })
    }
    return [url, cached] as const
  })
  for (const [url, cached] of fetched) cachedByUrl.set(url, cached)

  const sources = registry
    .map((row) => {
      const cached = cachedByUrl.get(row.source_url)
      if (!cached) throw new Error(`Missing fetched manufacturer source ${row.source_url}.`)
      return manifestRow(row, cached, cacheReferenceDirectory)
    })
    .sort(
      (left, right) =>
        left.source_url.localeCompare(right.source_url) ||
        left.catalog_source_id.localeCompare(right.catalog_source_id) ||
        left.title.localeCompare(right.title),
    )

  const manifest: ManufacturerSourceManifest = {
    format_version: 1,
    snapshot,
    registry_path: registryReference,
    registry_sha256: sha256(registryBytes),
    registry_entry_count: registry.length,
    unique_url_count: uniqueUrls.length,
    canonical_change_applied: false,
    sources,
  }
  const manifestBytes = await formattedJsonBytes(manifest)
  if (outputAlreadyExists) {
    const existingBytes = await readFile(options.outputPath)
    if (!existingBytes.equals(Buffer.from(manifestBytes))) {
      throw new Error(
        `Refusing to rewrite existing dated source manifest ${options.outputPath} with different content; choose a new snapshot/output.`,
      )
    }
    return manifest
  }
  await mkdir(path.dirname(options.outputPath), { recursive: true })
  await atomicWrite(options.outputPath, manifestBytes, 0o644)
  return manifest
}

async function main(): Promise<void> {
  const cli = parseManufacturerSourceArgs(process.argv.slice(2))
  const outputPath = validateManufacturerSourceOutputPath(cli.snapshot, cli.outputPath)
  const manifest = await fetchManufacturerSources({
    snapshot: cli.snapshot,
    outputPath,
    refresh: cli.refresh,
    concurrency: cli.concurrency,
    maxAttempts: cli.maxAttempts,
    timeoutMs: cli.timeoutMs,
    preserveFetchFailures: true,
  })
  console.log(
    `Wrote ${manifest.registry_entry_count} manufacturer-source rows from ${manifest.unique_url_count} unique URLs to ${outputPath}.`,
  )
}

if (process.argv[1]?.endsWith('fetch-manufacturer-sources.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
