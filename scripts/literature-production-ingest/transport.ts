import { canonicalJson } from './canonical'
import { resolveDestinationBinding as resolveConfiguredDestinationBinding } from './config'
import type {
  ArticleSourceRow,
  Checkpoint,
  DestinationArticleRow,
  DestinationBinding,
  SourceJournalRow,
} from './types'

type FetchImplementation = typeof fetch

export type LiteratureTable =
  | 'literature_journals'
  | 'literature_articles'
  | 'literature_import_batches'
  | 'literature_article_sources'

export type QueryParameters = Readonly<Record<string, string | number | boolean | null | undefined>>

export interface ReadRowsOptions {
  query?: QueryParameters
  range?: { from: number; to: number }
}

export interface ExactMutationRequest<T extends object> {
  operation: string
  method: 'POST' | 'PATCH'
  table: LiteratureTable
  query?: QueryParameters
  body: unknown
  expectedRows: readonly T[]
  identityColumns: readonly string[]
  prefer?: string
}

export interface PostgrestTransportOptions {
  fetchImpl?: FetchImplementation
  requestTimeoutMs?: number
}

export interface ImportBatchLookupRow {
  id: string
  status: string
  source_file_sha256?: string
  manifest_version?: string
  query_registry_version?: string | null
  source_kind?: string
  source_id?: string | null
  query_id?: string | null
  record_limit?: number | null
  report?: unknown
  [key: string]: unknown
}

export interface ArticleObservation {
  pmid: string
  metadata_hash: string
  relevance_state: string
  visibility_state: string
  manual_override: boolean
  is_landmark: boolean
  curation_reason: string | null
  classifier_version: string | null
  classifier_payload: unknown
  search_vector: string | null
}

export type MutationAmbiguityCode =
  | 'transport_exception'
  | 'request_timeout'
  | 'server_error'
  | 'unexpected_status'
  | 'malformed_acknowledgement'
  | 'acknowledgement_mismatch'

export type MutationConfirmedFailureCode = 'postgrest_rejected'

export class PostgrestReadError extends Error {
  readonly code: string
  readonly status: number | null

  constructor(code: string, status: number | null, message: string) {
    super(message)
    this.name = 'PostgrestReadError'
    this.code = code
    this.status = status
  }
}

export class MutationAmbiguousError extends Error {
  readonly outcome = 'ambiguous' as const
  readonly code: MutationAmbiguityCode
  readonly operation: string
  readonly status: number | null

  constructor(
    operation: string,
    code: MutationAmbiguityCode,
    status: number | null,
    message?: string,
  ) {
    super(
      message ??
        `Mutation acknowledgement is ambiguous for ${safeOperationName(operation)}. Stop and reconcile read-only.`,
    )
    this.name = 'MutationAmbiguousError'
    this.operation = safeOperationName(operation)
    this.code = code
    this.status = status
  }
}

export class MutationConfirmedFailureError extends Error {
  readonly outcome = 'confirmed_failure' as const
  readonly code: MutationConfirmedFailureCode = 'postgrest_rejected'
  readonly operation: string
  readonly status: number

  constructor(operation: string, status: number) {
    super(
      `Mutation ${safeOperationName(operation)} received a confirmed PostgREST rejection (HTTP ${status}).`,
    )
    this.name = 'MutationConfirmedFailureError'
    this.operation = safeOperationName(operation)
    this.status = status
  }
}

const LITERATURE_TABLES: ReadonlySet<string> = new Set<LiteratureTable>([
  'literature_journals',
  'literature_articles',
  'literature_import_batches',
  'literature_article_sources',
])
const MUTATION_PREFER_VALUES = new Set([
  'return=representation',
  'resolution=merge-duplicates,return=representation',
])

export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000

function safeOperationName(value: string): string {
  return /^[a-z][a-z0-9_.:-]{0,63}$/u.test(value) ? value : 'mutation'
}

function assertTable(table: string): asserts table is LiteratureTable {
  if (!LITERATURE_TABLES.has(table)) {
    throw new Error('Only foundation Literature tables may be accessed by this transport.')
  }
}

function validateBinding(binding: DestinationBinding): DestinationBinding {
  const resolved = resolveConfiguredDestinationBinding(
    {
      LITERATURE_SUPABASE_URL: binding.url,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: binding.projectRef,
      LITERATURE_SUPABASE_SECRET_KEY: binding.secret,
    },
    true,
  )
  if (!resolved) throw new Error('The dedicated Literature destination is required.')
  return resolved
}

export { resolveDestinationBinding } from './config'

function queryUrl(binding: DestinationBinding, table: LiteratureTable, query?: QueryParameters) {
  assertTable(table)
  const url = new URL(`rest/v1/${table}`, binding.url)
  if (query) {
    for (const key of Object.keys(query).sort()) {
      const value = query[key]
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    }
  }
  return url
}

function asRows(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every((row) => Boolean(row) && typeof row === 'object' && !Array.isArray(row))) {
    return null
  }
  return value as Record<string, unknown>[]
}

function identity(row: Record<string, unknown>, columns: readonly string[]): string | null {
  const values: unknown[] = []
  for (const column of columns) {
    if (!(column in row)) return null
    values.push(row[column])
  }
  return canonicalJson(values)
}

function sortedExactRows(
  value: unknown,
  identityColumns: readonly string[],
): Record<string, unknown>[] | null {
  const rows = asRows(value)
  if (!rows || identityColumns.length === 0) return null
  const keyed = rows.map((row) => ({ key: identity(row, identityColumns), row }))
  if (keyed.some((entry) => entry.key === null)) return null
  keyed.sort((left, right) => (left.key as string).localeCompare(right.key as string))
  for (let index = 1; index < keyed.length; index += 1) {
    if (keyed[index - 1].key === keyed[index].key) return null
  }
  return keyed.map((entry) => entry.row)
}

function acknowledgementMatches(
  actual: unknown,
  expected: readonly object[],
  identityColumns: readonly string[],
) {
  const sortedActual = sortedExactRows(actual, identityColumns)
  const sortedExpected = sortedExactRows(expected, identityColumns)
  return (
    sortedActual !== null &&
    sortedExpected !== null &&
    canonicalJson(sortedActual) === canonicalJson(sortedExpected)
  )
}

function objectRecord(value: object, label: string): Record<string, unknown> {
  if (Array.isArray(value)) throw new Error(`${label} must be a row object.`)
  return value as Record<string, unknown>
}

function selectKeys(rows: readonly object[]): string[] {
  const keys = new Set<string>()
  rows.forEach((row) =>
    Object.keys(objectRecord(row, 'PostgREST row')).forEach((key) => keys.add(key)),
  )
  if (keys.size === 0) throw new Error('A mutating row must have at least one field.')
  return [...keys].sort()
}

function importBatchAcknowledgementKeys(rows: readonly object[]): string[] {
  // PostgreSQL renders timestamptz values canonically, which need not preserve the
  // caller's equivalent ISO spelling (for example, `Z` versus `+00:00`). Keep the
  // acknowledgement exact over every stable import-batch field while the original
  // request body still carries both timestamp mutations.
  const keys = selectKeys(rows).filter((key) => key !== 'started_at' && key !== 'completed_at')
  if (!keys.includes('id')) {
    throw new Error('Import batch acknowledgements require the client-generated id.')
  }
  return keys
}

function projectRows<T extends object>(rows: readonly T[], keys: readonly string[]) {
  return rows.map((row) => {
    const source = objectRecord(row, 'PostgREST row')
    return Object.fromEntries(keys.map((key) => [key, source[key]]))
  })
}

function filterValue(value: string | number | null): string {
  return value === null ? 'is.null' : `eq.${String(value)}`
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'name' in error && error.name === 'AbortError',
  )
}

export class PostgrestTransport {
  readonly projectRef: string
  private readonly binding: DestinationBinding
  private readonly fetchImpl: FetchImplementation
  private readonly requestTimeoutMs: number

  constructor(binding: DestinationBinding, options: PostgrestTransportOptions = {}) {
    this.binding = validateBinding(binding)
    this.projectRef = this.binding.projectRef
    this.fetchImpl = options.fetchImpl ?? fetch
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    if (!Number.isInteger(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error('PostgREST request timeout must be a positive integer.')
    }
  }

  async readRows<T extends object>(
    table: LiteratureTable,
    options: ReadRowsOptions = {},
  ): Promise<T[]> {
    const url = queryUrl(this.binding, table, options.query)
    const headers = this.headers()
    if (options.range) {
      if (
        !Number.isInteger(options.range.from) ||
        !Number.isInteger(options.range.to) ||
        options.range.from < 0 ||
        options.range.to < options.range.from
      ) {
        throw new Error('Read range must be a non-negative inclusive interval.')
      }
      headers.set('Range-Unit', 'items')
      headers.set('Range', `${options.range.from}-${options.range.to}`)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    try {
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method: 'GET',
          headers,
          redirect: 'error',
          signal: controller.signal,
        })
      } catch (error) {
        throw new PostgrestReadError(
          controller.signal.aborted || isAbortError(error)
            ? 'read_timeout'
            : 'read_transport_error',
          null,
          controller.signal.aborted || isAbortError(error)
            ? 'The read-only PostgREST request timed out.'
            : 'The read-only PostgREST request did not complete.',
        )
      }
      if (!response.ok) {
        throw new PostgrestReadError(
          'read_rejected',
          response.status,
          `The read-only PostgREST request failed with HTTP ${response.status}.`,
        )
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(await response.text()) as unknown
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          throw new PostgrestReadError(
            'read_timeout',
            response.status,
            'The read-only PostgREST response timed out.',
          )
        }
        throw new PostgrestReadError(
          'read_malformed_response',
          response.status,
          'The read-only PostgREST response was not valid JSON.',
        )
      }
      const rows = asRows(parsed)
      if (!rows) {
        throw new PostgrestReadError(
          'read_malformed_response',
          response.status,
          'The read-only PostgREST response was not a row array.',
        )
      }
      return rows as T[]
    } finally {
      clearTimeout(timeout)
    }
  }

  async countRows(table: LiteratureTable, query?: QueryParameters): Promise<number> {
    const url = queryUrl(this.binding, table, query)
    const headers = this.headers()
    headers.set('Prefer', 'count=exact')
    headers.set('Range-Unit', 'items')
    headers.set('Range', '0-0')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    try {
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method: 'HEAD',
          headers,
          redirect: 'error',
          signal: controller.signal,
        })
      } catch (error) {
        throw new PostgrestReadError(
          controller.signal.aborted || isAbortError(error)
            ? 'count_timeout'
            : 'count_transport_error',
          null,
          controller.signal.aborted || isAbortError(error)
            ? 'The read-only PostgREST count timed out.'
            : 'The read-only PostgREST count did not complete.',
        )
      }
      if (!response.ok) {
        throw new PostgrestReadError(
          'count_rejected',
          response.status,
          `The read-only PostgREST count failed with HTTP ${response.status}.`,
        )
      }
      const contentRange = response.headers.get('content-range')
      const match = contentRange?.match(/\/(\d+)$/u)
      if (!match) {
        throw new PostgrestReadError(
          'count_malformed_response',
          response.status,
          'The read-only PostgREST count omitted an exact Content-Range total.',
        )
      }
      return Number.parseInt(match[1], 10)
    } finally {
      clearTimeout(timeout)
    }
  }

  countArticles(): Promise<number> {
    return this.countRows('literature_articles')
  }

  async findCompletedImportBatch(
    identityInput: Checkpoint['batchIdentity'],
  ): Promise<ImportBatchLookupRow | null> {
    const rows = await this.readRows<ImportBatchLookupRow>('literature_import_batches', {
      query: {
        select:
          'id,status,source_file_sha256,manifest_version,query_registry_version,source_kind,source_id,query_id,record_limit,report',
        source_file_sha256: filterValue(identityInput.sourceFileSha256),
        manifest_version: filterValue(identityInput.manifestVersion),
        query_registry_version: filterValue(identityInput.queryRegistryVersion),
        source_kind: filterValue(identityInput.sourceKind),
        source_id: filterValue(identityInput.sourceId),
        query_id: filterValue(identityInput.queryId),
        record_limit: filterValue(identityInput.recordLimit),
        status: 'eq.completed',
        limit: 2,
      },
    })
    if (rows.length > 1) {
      throw new PostgrestReadError(
        'completed_batch_not_unique',
        200,
        'More than one completed import batch matched the operation identity.',
      )
    }
    return rows[0] ?? null
  }

  async getImportBatch(id: string): Promise<ImportBatchLookupRow | null> {
    const rows = await this.readRows<ImportBatchLookupRow>('literature_import_batches', {
      query: { select: '*', id: filterValue(id), limit: 2 },
    })
    if (rows.length > 1) {
      throw new PostgrestReadError(
        'import_batch_not_unique',
        200,
        'The import batch lookup returned more than one row.',
      )
    }
    return rows[0] ?? null
  }

  observeArticles(pmids: readonly string[]): Promise<ArticleObservation[]> {
    if (pmids.length === 0) return Promise.resolve([])
    if (!pmids.every((pmid) => /^\d{1,12}$/u.test(pmid))) {
      throw new Error('Article observation requires numeric PMID values.')
    }
    return this.readRows<ArticleObservation>('literature_articles', {
      query: {
        select:
          'pmid,metadata_hash,relevance_state,visibility_state,manual_override,is_landmark,curation_reason,classifier_version,classifier_payload,search_vector',
        pmid: `in.(${pmids.join(',')})`,
        order: 'pmid.asc',
      },
    })
  }

  async mutateExact<T extends object>(request: ExactMutationRequest<T>): Promise<T[]> {
    if (request.method !== 'POST' && request.method !== 'PATCH') {
      throw new Error('The ingestion transport permits only POST and PATCH mutations.')
    }
    if (request.expectedRows.length === 0 || request.identityColumns.length === 0) {
      throw new Error('A mutation requires a non-empty exact acknowledgement contract.')
    }
    const operation = safeOperationName(request.operation)
    const url = queryUrl(this.binding, request.table, request.query)
    const headers = this.headers()
    headers.set('Content-Type', 'application/json')
    const prefer = request.prefer ?? 'return=representation'
    if (!MUTATION_PREFER_VALUES.has(prefer)) {
      throw new Error('The mutation Prefer header is outside the approved contract.')
    }
    headers.set('Prefer', prefer)
    const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
    if (typeof body !== 'string' || body.length === 0) {
      throw new Error('A mutation requires a non-empty JSON request body.')
    }
    try {
      JSON.parse(body)
    } catch {
      throw new Error('A mutation request body must be valid JSON.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    try {
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method: request.method,
          headers,
          body,
          redirect: 'error',
          signal: controller.signal,
        })
      } catch (error) {
        throw new MutationAmbiguousError(
          operation,
          controller.signal.aborted || isAbortError(error)
            ? 'request_timeout'
            : 'transport_exception',
          null,
        )
      }

      if (response.status === 408) {
        throw new MutationAmbiguousError(operation, 'request_timeout', response.status)
      }
      if (response.status >= 500) {
        throw new MutationAmbiguousError(operation, 'server_error', response.status)
      }
      if (response.status >= 400 && response.status <= 499) {
        throw new MutationConfirmedFailureError(operation, response.status)
      }
      if (response.status < 200 || response.status >= 300) {
        throw new MutationAmbiguousError(operation, 'unexpected_status', response.status)
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(await response.text()) as unknown
      } catch (error) {
        throw new MutationAmbiguousError(
          operation,
          controller.signal.aborted || isAbortError(error)
            ? 'request_timeout'
            : 'malformed_acknowledgement',
          response.status,
        )
      }
      if (!acknowledgementMatches(parsed, request.expectedRows, request.identityColumns)) {
        throw new MutationAmbiguousError(operation, 'acknowledgement_mismatch', response.status)
      }
      return parsed as T[]
    } finally {
      clearTimeout(timeout)
    }
  }

  async createImportBatch<T extends object>(row: T): Promise<Record<string, unknown>> {
    const record = objectRecord(row, 'Import batch')
    if (typeof record.id !== 'string' || record.id.length === 0) {
      throw new Error('Import batches require a client-generated id.')
    }
    const keys = importBatchAcknowledgementKeys([row])
    const expectedRows = projectRows([row], keys)
    const rows = await this.mutateExact({
      operation: 'create_import_batch',
      method: 'POST',
      table: 'literature_import_batches',
      query: { select: keys.join(',') },
      body: [row],
      expectedRows,
      identityColumns: ['id'],
      prefer: 'return=representation',
    })
    return rows[0]
  }

  upsertJournals(rows: readonly SourceJournalRow[]): Promise<SourceJournalRow[]> {
    if (rows.length === 0) return Promise.resolve([])
    const keys = selectKeys(rows)
    return this.mutateExact({
      operation: 'upsert_journals',
      method: 'POST',
      table: 'literature_journals',
      query: { on_conflict: 'id', select: keys.join(',') },
      body: rows,
      expectedRows: rows,
      identityColumns: ['id'],
      prefer: 'resolution=merge-duplicates,return=representation',
    })
  }

  upsertArticles(rows: readonly DestinationArticleRow[]): Promise<Record<string, unknown>[]> {
    if (rows.length === 0) return Promise.resolve([])
    const acknowledgementKeys = [
      'pmid',
      'metadata_hash',
      'relevance_state',
      'visibility_state',
      'manual_override',
      'is_landmark',
      'curation_reason',
      'classifier_version',
      'classifier_payload',
    ] as const
    const expectedRows = projectRows(rows, acknowledgementKeys)
    return this.mutateExact({
      operation: 'upsert_articles',
      method: 'POST',
      table: 'literature_articles',
      query: { on_conflict: 'pmid', select: acknowledgementKeys.join(',') },
      body: rows,
      expectedRows,
      identityColumns: ['pmid'],
      prefer: 'resolution=merge-duplicates,return=representation',
    })
  }

  upsertArticleSources(rows: readonly ArticleSourceRow[]): Promise<ArticleSourceRow[]> {
    if (rows.length === 0) return Promise.resolve([])
    const keys = selectKeys(rows)
    return this.mutateExact({
      operation: 'upsert_article_sources',
      method: 'POST',
      table: 'literature_article_sources',
      query: { on_conflict: 'pmid,batch_id', select: keys.join(',') },
      body: rows,
      expectedRows: rows,
      identityColumns: ['pmid', 'batch_id'],
      prefer: 'resolution=merge-duplicates,return=representation',
    })
  }

  async completeImportBatch<T extends object>(
    id: string,
    patch: T,
  ): Promise<Record<string, unknown>> {
    const expected = { id, ...objectRecord(patch, 'Import batch completion') }
    const keys = importBatchAcknowledgementKeys([expected])
    const expectedRows = projectRows([expected], keys)
    const rows = await this.mutateExact({
      operation: 'complete_import_batch',
      method: 'PATCH',
      table: 'literature_import_batches',
      query: { id: filterValue(id), select: keys.join(',') },
      body: patch,
      expectedRows,
      identityColumns: ['id'],
      prefer: 'return=representation',
    })
    return rows[0]
  }

  private headers(): Headers {
    return new Headers({
      Accept: 'application/json',
      apikey: this.binding.secret,
    })
  }
}
