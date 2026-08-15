/**
 * Turning `GET` responses into `Observation`s.
 *
 * This module is the only place that interprets an HTTP status, and it is deliberately dull: it
 * decides *whether* a read succeeded, never *whether the answer is acceptable*. Judgement lives in
 * `checks.ts`, which sees only plain data and can therefore be tested exhaustively without a
 * network.
 *
 * The interpretation rules that matter:
 *
 *   - A `Content-Range` without an exact total is a `failed` count, not zero. PostgREST puts a
 *     number after the slash when it counted and a literal asterisk when it did not, and an
 *     uncounted response must never be confused with an empty table.
 *   - `PGRST202` (no such function) is `unavailable`, not `failed` — it is the target truthfully
 *     reporting that a capability is absent, which for the gold workflow is the expected answer.
 *   - `401` and `403` from an *anonymous* probe are `observed` denials, because being refused is
 *     the observation. The same statuses from an authenticated read are `failed`.
 */

import {
  LITERATURE_CANARY_RELEVANCE_STATE,
  LITERATURE_CANARY_VISIBILITY_STATE,
  LITERATURE_FOUNDATION_TABLES,
  LITERATURE_GOLD_PROBE_RPC,
  LITERATURE_PUBLICLY_VISIBLE_STATE,
  LITERATURE_RELEVANCE_STATES,
  LITERATURE_VISIBILITY_STATES,
} from './identity'
import { failed, observed, skipped, unavailable, type Observation } from './observation'
import {
  createReadOnlyTransport,
  parseExactCount,
  type ReadOnlyTransport,
  type TransportResult,
} from './read-only-transport'

/** A PostgREST error body, as far as this tool cares. */
interface PostgrestError {
  code?: string
  message?: string
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

function postgrestErrorCode(body: string): string | null {
  const parsed = parseJsonBody(body)
  if (parsed !== null && typeof parsed === 'object') {
    const code = (parsed as PostgrestError).code
    if (typeof code === 'string') return code
  }
  return null
}

/**
 * The shared status interpreter for an authenticated read.
 *
 * Returns `null` when the response is a success the caller should parse; otherwise a non-observed
 * observation with the reason preserved.
 */
function interpretFailure<T>(result: TransportResult): Observation<T> | null {
  if (result.outcome === 'refused') {
    return failed(`transport_refused_${result.reason}`, result.message)
  }
  if (result.outcome === 'failed') {
    return failed(result.code, result.detail)
  }
  if (result.status >= 200 && result.status < 300) {
    return null
  }
  const code = postgrestErrorCode(result.body)
  // PGRST205: no such table. PGRST202: no such function. 42P01: the relation does not exist.
  // All three are the target reporting genuine absence, which is a different fact from a read
  // that broke — and the missing-schema versus empty-schema distinction depends on the difference.
  if (code === 'PGRST202' || code === 'PGRST205' || code === '42P01') {
    return unavailable(`the target reports no such database object (PostgREST ${code})`)
  }
  return failed(
    code ? `postgrest_${code}` : `http_${result.status}`,
    `HTTP ${result.status}${code ? ` (${code})` : ''}`,
  )
}

/**
 * An exact row count.
 *
 * `GET` with `limit=0` rather than `HEAD`, on purpose: the count itself arrives in `Content-Range`
 * either way, but a `HEAD` response carries no body, and the body is where PostgREST puts the
 * `PGRST205` that distinguishes "this table does not exist" from "this read failed". Losing that
 * code would collapse the missing-schema and broken-read cases into one. The body a successful
 * `limit=0` read returns is the two bytes `[]`.
 */
async function countRows(
  transport: ReadOnlyTransport,
  table: string,
  filters: Readonly<Record<string, string>> = {},
): Promise<Observation<number>> {
  const result = await transport.request({
    method: 'GET',
    path: `/rest/v1/${table}`,
    query: { select: '*', limit: '0', ...filters },
    headers: { Prefer: 'count=exact' },
  })
  const failure = interpretFailure<number>(result)
  if (failure) return failure
  if (result.outcome !== 'responded') {
    return failed('unreachable_branch', 'A successful transport result was not a response.')
  }
  const total = parseExactCount(result.headers['content-range'])
  if (total === null) {
    // The server did not return an exact count. That is missing evidence, and missing evidence is
    // never zero — this is the single most important `null` branch in the package.
    return failed(
      'count_absent',
      `The response for ${table} carried no exact Content-Range total, so the row count is ` +
        'unknown. It is reported as unknown rather than as zero.',
    )
  }
  return observed(total)
}

/**
 * A complete row set, or nothing.
 *
 * The subtle failure this guards against: a corpus with more provenance rows than the request
 * limit — or more than PostgREST's own `max-rows` ceiling, which the client does not set and
 * cannot see — comes back silently truncated. Downstream, `checkSourceProvenance` would compare a
 * truncated distinct-PMID count against the full corpus total and report a coverage gap that does
 * not exist. A verification tool reporting a fabricated failure is only marginally better than one
 * reporting a fabricated pass.
 *
 * So the read asks for an exact count and compares it against what arrived. A short set is
 * `failed`, not a smaller set: partial evidence is missing evidence, exactly as an uncounted
 * response is.
 */
async function selectRows<T>(
  transport: ReadOnlyTransport,
  table: string,
  query: Readonly<Record<string, string>>,
): Promise<Observation<T[]>> {
  const result = await transport.request({
    method: 'GET',
    path: `/rest/v1/${table}`,
    query,
    headers: { Prefer: 'count=exact' },
  })
  const failure = interpretFailure<T[]>(result)
  if (failure) return failure
  if (result.outcome !== 'responded') {
    return failed('unreachable_branch', 'A successful transport result was not a response.')
  }
  const parsed = parseJsonBody(result.body)
  if (!Array.isArray(parsed)) {
    return failed('unparseable_body', `The response for ${table} was not a JSON array.`)
  }
  const total = parseExactCount(result.headers['content-range'])
  if (total === null) {
    return failed(
      'count_absent',
      `The response for ${table} carried no exact Content-Range total, so there is no way to ` +
        'tell whether the returned rows are all of them.',
    )
  }
  if (parsed.length < total) {
    return failed(
      'read_truncated',
      `${table} holds ${total} row(s) but only ${parsed.length} were returned. The row set is ` +
        'incomplete, so every figure derived from it would be wrong.',
    )
  }
  return observed(parsed as T[])
}

/**
 * Page size for the row sets that feed derived counts.
 *
 * PostgREST enforces its own `max-rows` ceiling, which this client does not set and cannot read,
 * so asking for everything in one request is not something the server has to honour. The reads
 * page instead, and `PAGE_LIMIT` bounds the loop: a table larger than the page cap yields a
 * `read_truncated` failure rather than a quietly partial answer.
 */
const PAGE_SIZE = 1000
const PAGE_LIMIT = 200

/**
 * Every row of a table, by paging until the exact total is reached.
 *
 * An ordered read is required for stable paging, so the caller supplies `order`. A table that
 * grows mid-read produces a short final page and therefore a `read_truncated` failure, which is
 * the right answer: a corpus being written while it is verified has not been verified.
 */
async function selectAllRows<T>(
  transport: ReadOnlyTransport,
  table: string,
  query: Readonly<Record<string, string>>,
): Promise<Observation<T[]>> {
  const collected: T[] = []
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const result = await transport.request({
      method: 'GET',
      path: `/rest/v1/${table}`,
      query: { ...query, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) },
      headers: { Prefer: 'count=exact' },
    })
    const failure = interpretFailure<T[]>(result)
    if (failure) return failure
    if (result.outcome !== 'responded') {
      return failed('unreachable_branch', 'A successful transport result was not a response.')
    }
    const parsed = parseJsonBody(result.body)
    if (!Array.isArray(parsed)) {
      return failed('unparseable_body', `The response for ${table} was not a JSON array.`)
    }
    const total = parseExactCount(result.headers['content-range'])
    if (total === null) {
      return failed(
        'count_absent',
        `The response for ${table} carried no exact Content-Range total, so there is no way to ` +
          'tell whether the returned rows are all of them.',
      )
    }
    collected.push(...(parsed as T[]))
    if (collected.length >= total) return observed(collected)
    if (parsed.length === 0) {
      return failed(
        'read_truncated',
        `${table} reports ${total} row(s) but paging stopped after ${collected.length}. The row ` +
          'set is incomplete, so every figure derived from it would be wrong.',
      )
    }
  }
  return failed(
    'read_truncated',
    `${table} did not finish paging within ${PAGE_LIMIT} pages of ${PAGE_SIZE}. The row set is ` +
      'incomplete; nothing derived from it is reported.',
  )
}

async function callStableRpc<T>(
  transport: ReadOnlyTransport,
  name: string,
  query: Readonly<Record<string, string>> = {},
): Promise<Observation<T>> {
  // GET, so PostgREST will only ever execute a STABLE or IMMUTABLE function.
  const result = await transport.request({ method: 'GET', path: `/rest/v1/rpc/${name}`, query })
  const failure = interpretFailure<T>(result)
  if (failure) return failure
  if (result.outcome !== 'responded') {
    return failed('unreachable_branch', 'A successful transport result was not a response.')
  }
  const parsed = parseJsonBody(result.body)
  if (parsed === null) {
    return failed('unparseable_body', `The response for ${name} was not JSON.`)
  }
  return observed(parsed as T)
}

/* ------------------------------------------------------------------------------------------- *
 * Database observations
 * ------------------------------------------------------------------------------------------- */

export interface BatchReceipt {
  id: string
  status: string
  source_filename: string
  source_file_sha256: string
  source_kind: string
  records_read: number
  unique_pmids: number
  inserted_count: number
  updated_count: number
  duplicate_count: number
  error_count: number
  started_at: string
  completed_at: string | null
}

export interface ArticleSummary {
  pmid: string
  relevance_state: string
  visibility_state: string
}

export interface SourceRow {
  pmid: string
  batch_id: string
  source_kind: string
  source_filename: string
}

export interface SearchResponse {
  total_count?: number | string
}

export interface DatabaseObservations {
  /** Every table answered a counted read: proves the relation exists and is reachable. */
  readonly tableReachability: Readonly<Record<string, Observation<number>>>
  readonly totalArticles: Observation<number>
  readonly relevanceDistribution: Readonly<Record<string, Observation<number>>>
  readonly visibilityDistribution: Readonly<Record<string, Observation<number>>>
  readonly searchVectorPopulated: Observation<number>
  /** Rows in `literature_article_sources`. The primary key is (pmid, batch_id), so this counts
   *  provenance edges, not distinct articles — the distinct-PMID figure is derived in `checks`. */
  readonly sourceRowCount: Observation<number>
  readonly canaryStateCount: Observation<number>
  readonly publiclyVisibleCount: Observation<number>
  readonly batches: Observation<BatchReceipt[]>
  readonly sources: Observation<SourceRow[]>
  readonly importErrors: Observation<number>
  readonly adminStats: Observation<Record<string, unknown>>
  readonly blankAdminPreview: Observation<unknown[]>
  readonly keywordSearch: Observation<unknown[]>
  readonly publicSearch: Observation<unknown[]>
  readonly articleDetail: Observation<ArticleSummary[]>
  readonly goldWorkflow: Observation<unknown>
  readonly anonymousTableRead: Observation<AnonymousProbe>
  readonly anonymousRpcRead: Observation<AnonymousProbe>
}

/** What an unauthenticated caller got. `denied` is the observation we want; rows are the alarm. */
export interface AnonymousProbe {
  readonly status: number
  readonly denied: boolean
  readonly rowsReturned: number | null
}

export interface CollectDatabaseOptions {
  readonly transport: ReadOnlyTransport
  /** A separate, credential-free (or publishable-key) transport for the anonymous probes. */
  readonly anonymousTransport: ReadOnlyTransport | null
  /** A PMID to fetch as an article-detail spot check, when the corpus is populated. */
  readonly detailPmid: string | null
  /** The keyword the keyword-search check uses. */
  readonly keyword: string
}

export async function collectDatabaseObservations(
  options: CollectDatabaseOptions,
): Promise<DatabaseObservations> {
  const { transport } = options

  const tableEntries = await Promise.all(
    LITERATURE_FOUNDATION_TABLES.map(
      async (table) => [table, await countRows(transport, table)] as const,
    ),
  )
  const relevanceEntries = await Promise.all(
    LITERATURE_RELEVANCE_STATES.map(
      async (state) =>
        [
          state,
          await countRows(transport, 'literature_articles', {
            relevance_state: `eq.${state}`,
          }),
        ] as const,
    ),
  )
  const visibilityEntries = await Promise.all(
    LITERATURE_VISIBILITY_STATES.map(
      async (state) =>
        [
          state,
          await countRows(transport, 'literature_articles', {
            visibility_state: `eq.${state}`,
          }),
        ] as const,
    ),
  )

  const [
    totalArticles,
    searchVectorPopulated,
    canaryStateCount,
    publiclyVisibleCount,
    batches,
    sources,
    importErrors,
    adminStats,
    blankAdminPreview,
    keywordSearch,
    publicSearch,
    goldWorkflow,
  ] = await Promise.all([
    countRows(transport, 'literature_articles'),
    countRows(transport, 'literature_articles', { search_vector: 'not.is.null' }),
    countRows(transport, 'literature_articles', {
      relevance_state: `eq.${LITERATURE_CANARY_RELEVANCE_STATE}`,
      visibility_state: `eq.${LITERATURE_CANARY_VISIBILITY_STATE}`,
    }),
    countRows(transport, 'literature_articles', {
      relevance_state: `eq.${LITERATURE_PUBLICLY_VISIBLE_STATE.relevanceState}`,
      visibility_state: `eq.${LITERATURE_PUBLICLY_VISIBLE_STATE.visibilityState}`,
    }),
    // Both are read in full and paged: `reconcileBatches` sums over every receipt and the
    // provenance coverage check counts distinct PMIDs across every source row, so a partial read
    // of either would produce a confidently wrong number.
    selectAllRows<BatchReceipt>(transport, 'literature_import_batches', {
      select:
        'id,status,source_filename,source_file_sha256,source_kind,records_read,unique_pmids,' +
        'inserted_count,updated_count,duplicate_count,error_count,started_at,completed_at',
      order: 'started_at.asc,id.asc',
    }),
    selectAllRows<SourceRow>(transport, 'literature_article_sources', {
      select: 'pmid,batch_id,source_kind,source_filename',
      order: 'pmid.asc,batch_id.asc',
    }),
    countRows(transport, 'literature_import_errors'),
    callStableRpc<Record<string, unknown>>(transport, 'literature_admin_stats_v1'),
    callStableRpc<unknown[]>(transport, 'search_literature_v1', {
      p_admin_preview: 'true',
      p_page_size: '20',
    }),
    callStableRpc<unknown[]>(transport, 'search_literature_v1', {
      p_query: options.keyword,
      p_admin_preview: 'true',
      p_page_size: '20',
    }),
    callStableRpc<unknown[]>(transport, 'search_literature_v1', {
      p_admin_preview: 'false',
      p_page_size: '20',
    }),
    callStableRpc<unknown>(transport, LITERATURE_GOLD_PROBE_RPC),
  ])

  const sourceRowCount = await countRows(transport, 'literature_article_sources')

  const articleDetail = options.detailPmid
    ? await selectRows<ArticleSummary>(transport, 'literature_articles', {
        select: 'pmid,relevance_state,visibility_state',
        pmid: `eq.${options.detailPmid}`,
        limit: '1',
      })
    : skipped<ArticleSummary[]>('no PMID was supplied for the article-detail spot check')

  const anonymousTableRead = options.anonymousTransport
    ? await probeAnonymously(options.anonymousTransport, '/rest/v1/literature_articles', {
        select: 'pmid',
        limit: '1',
      })
    : skipped<AnonymousProbe>('no anonymous transport was configured')
  const anonymousRpcRead = options.anonymousTransport
    ? await probeAnonymously(options.anonymousTransport, '/rest/v1/rpc/search_literature_v1', {
        p_page_size: '1',
      })
    : skipped<AnonymousProbe>('no anonymous transport was configured')

  return {
    tableReachability: Object.fromEntries(tableEntries),
    totalArticles,
    relevanceDistribution: Object.fromEntries(relevanceEntries),
    visibilityDistribution: Object.fromEntries(visibilityEntries),
    searchVectorPopulated,
    sourceRowCount,
    canaryStateCount,
    publiclyVisibleCount,
    batches,
    sources,
    importErrors,
    adminStats,
    blankAdminPreview,
    keywordSearch,
    publicSearch,
    articleDetail,
    goldWorkflow,
    anonymousTableRead,
    anonymousRpcRead,
  }
}

/**
 * An unauthenticated (or publishable-key) read.
 *
 * A denial is the successful observation here, so `401`/`403` are `observed`, not `failed`. A
 * `200` is observed too — with the row count, because "anonymous got a 200 and zero rows" and
 * "anonymous got a 200 and eleven rows" are very different findings and the check needs to tell
 * them apart.
 */
async function probeAnonymously(
  transport: ReadOnlyTransport,
  path: string,
  query: Readonly<Record<string, string>>,
): Promise<Observation<AnonymousProbe>> {
  const result = await transport.request({ method: 'GET', path, query })
  if (result.outcome === 'refused') {
    return failed(`transport_refused_${result.reason}`, result.message)
  }
  if (result.outcome === 'failed') {
    return failed(result.code, result.detail)
  }
  if (result.status === 401 || result.status === 403) {
    return observed({ status: result.status, denied: true, rowsReturned: null })
  }
  if (result.status >= 200 && result.status < 300) {
    const parsed = parseJsonBody(result.body)
    return observed({
      status: result.status,
      denied: false,
      rowsReturned: Array.isArray(parsed) ? parsed.length : null,
    })
  }
  const code = postgrestErrorCode(result.body)
  // Every way PostgREST says "not for you": the object is not in this role's schema cache
  // (PGRST205 for a relation, PGRST202 for a function — which is what a revoked grant looks like,
  // because an object the role cannot touch is not exposed to it), a bare permission denial
  // (42501), or a rejected credential (PGRST301). All are denials, and a denial is the
  // observation this probe wants.
  if (code === 'PGRST205' || code === 'PGRST202' || code === '42501' || code === 'PGRST301') {
    return observed({ status: result.status, denied: true, rowsReturned: null })
  }
  return failed(
    code ? `postgrest_${code}` : `http_${result.status}`,
    `Anonymous probe of ${path} returned HTTP ${result.status}, which is neither a clear denial ` +
      'nor a successful read.',
  )
}

/* ------------------------------------------------------------------------------------------- *
 * Application observations
 * ------------------------------------------------------------------------------------------- */

export interface ApplicationProbe {
  readonly status: number
  readonly errorCode: string | null
  readonly body: unknown
}

export interface ApplicationObservations {
  readonly anonymousAdminPage: Observation<ApplicationProbe>
  readonly anonymousSearchApi: Observation<ApplicationProbe>
  readonly adminSearchApi: Observation<ApplicationProbe>
  readonly adminBlankPreviewApi: Observation<ApplicationProbe>
  readonly adminKeywordApi: Observation<ApplicationProbe>
  readonly adminArticleApi: Observation<ApplicationProbe>
  readonly goldSetExportApi: Observation<ApplicationProbe>
  readonly sitemap: Observation<string>
}

export interface CollectApplicationOptions {
  readonly baseUrl: string | null
  readonly adminCookie: string | null
  readonly detailPmid: string | null
  readonly keyword: string
  readonly fetchImplementation?: typeof fetch
  readonly timeoutMs?: number
}

/**
 * Application-layer probes over plain HTTP `GET`.
 *
 * Every Literature API route — including the ones named "public" — is behind
 * `requireLiteratureSiteAdminApi`, so an unauthenticated probe expects `401`, and the authenticated
 * probes need a site-admin session cookie supplied through the environment.
 */
export async function collectApplicationObservations(
  options: CollectApplicationOptions,
): Promise<ApplicationObservations> {
  const { baseUrl } = options
  if (!baseUrl) {
    const reason = 'no application base URL was configured (LITERATURE_VERIFY_APP_BASE_URL)'
    return {
      anonymousAdminPage: skipped(reason),
      anonymousSearchApi: skipped(reason),
      adminSearchApi: skipped(reason),
      adminBlankPreviewApi: skipped(reason),
      adminKeywordApi: skipped(reason),
      adminArticleApi: skipped(reason),
      goldSetExportApi: skipped(reason),
      sitemap: skipped(reason),
    }
  }

  // Re-bound after the guard so its inferred type is `string`: the hoisted helpers below cannot
  // see the narrowing applied to `baseUrl` itself.
  const origin: string = baseUrl
  const performFetch = options.fetchImplementation ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 15_000

  async function get(path: string, withCookie: boolean): Promise<Observation<ApplicationProbe>> {
    if (withCookie && !options.adminCookie) {
      return skipped('no site-admin cookie was configured (LITERATURE_VERIFY_ADMIN_COOKIE)')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
    }, timeoutMs)
    try {
      const response = await performFetch(new URL(path, origin), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(withCookie && options.adminCookie ? { Cookie: options.adminCookie } : {}),
        },
        redirect: 'manual',
        signal: controller.signal,
      })
      const text = await response.text()
      const parsed = parseJsonBody(text)
      const errorEnvelope =
        parsed !== null && typeof parsed === 'object'
          ? ((parsed as { error?: { code?: unknown } }).error?.code ?? null)
          : null
      return observed({
        status: response.status,
        errorCode: typeof errorEnvelope === 'string' ? errorEnvelope : null,
        body: parsed ?? text.slice(0, 2000),
      })
    } catch (error) {
      return failed(
        error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
        error instanceof Error ? error.message : String(error),
      )
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * The sitemap is fetched as raw text, not through `get`.
   *
   * `get` truncates a non-JSON body for reporting, and a truncated sitemap would make "no draft
   * article URL appears here" true for the wrong reason — the URL could have been in the part that
   * was cut off. The whole document is kept so the absence claim is about the whole document.
   */
  async function getText(path: string): Promise<Observation<string>> {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
    }, timeoutMs)
    try {
      const response = await performFetch(new URL(path, origin), {
        method: 'GET',
        headers: { Accept: 'application/xml, text/xml, text/plain, */*' },
        redirect: 'manual',
        signal: controller.signal,
      })
      const text = await response.text()
      if (response.status < 200 || response.status >= 300) {
        return failed(`http_${response.status}`, `${path} returned HTTP ${response.status}.`)
      }
      return observed(text)
    } catch (error) {
      return failed(
        error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
        error instanceof Error ? error.message : String(error),
      )
    } finally {
      clearTimeout(timer)
    }
  }

  const sitemap = await getText('/sitemap.xml')

  const [
    anonymousAdminPage,
    anonymousSearchApi,
    adminSearchApi,
    adminBlankPreviewApi,
    adminKeywordApi,
    goldSetExportApi,
  ] = await Promise.all([
    get('/en/admin/literature', false),
    get('/api/literature/search', false),
    get('/api/literature/search', true),
    get('/api/literature/search?adminPreview=1', true),
    get(`/api/literature/search?adminPreview=1&q=${encodeURIComponent(options.keyword)}`, true),
    // The only read-shaped gold endpoint. A missing batch is expected; the point of the probe is
    // the *shape* of the failure, not the batch.
    get('/api/admin/literature/gold-set/export?batchId=00000000-0000-4000-8000-000000000000', true),
  ])

  const adminArticleApi = options.detailPmid
    ? await get(`/api/literature/article/${encodeURIComponent(options.detailPmid)}`, true)
    : skipped<ApplicationProbe>('no PMID was supplied for the article-detail spot check')

  return {
    anonymousAdminPage,
    anonymousSearchApi,
    adminSearchApi,
    adminBlankPreviewApi,
    adminKeywordApi,
    adminArticleApi,
    goldSetExportApi,
    sitemap,
  }
}

/** Build the anonymous transport, if the operator asked for one. */
export function createAnonymousTransport(
  origin: string,
  anonymousKey: string | null,
  fetchImplementation?: typeof fetch,
): ReadOnlyTransport {
  return createReadOnlyTransport({ origin, credential: anonymousKey, fetchImplementation })
}
