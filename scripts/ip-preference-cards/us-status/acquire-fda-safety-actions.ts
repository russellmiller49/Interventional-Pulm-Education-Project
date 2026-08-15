/**
 * Official FDA safety-action (recall) acquisition for the current-U.S.-status research package.
 *
 * This layer is deliberately separate from the distribution layers. It answers only "does an
 * official FDA safety action apply to this exact product right now?" and never contributes to the
 * distribution conclusion. A safety action is not discontinuation evidence, and the absence of a
 * safety action is not evidence of current distribution.
 *
 * Two official FDA systems are read so that a status disagreement between them is visible rather
 * than silently resolved:
 *   - `device/enforcement` (Enforcement Report: classification, ongoing/terminated, lot codes)
 *   - `device/recall` (Recall Enterprise System: recall status, posted date, linked submissions)
 *
 * No manufacturer page, press release, or general web result is admitted here.
 */

import type { OpenFdaClient } from '../openfda/client'
import { exactIdentifierComparison, exactOpenFdaSearch, stableUnique } from '../openfda/normalize'
import type { OpenFdaRecord } from '../openfda/types'
import {
  queryOpenFdaPages,
  type FdaQueryExecutionMetrics,
  type FdaResponseProvenance,
} from './fda-evidence'
import type { SafetyActionScope, SafetyActionState, SafetySearchStatus } from './classification'

export const SAFETY_ACTION_SYSTEMS = ['device_enforcement', 'device_recall'] as const

export type SafetyActionSystem = (typeof SAFETY_ACTION_SYSTEMS)[number]

export const SAFETY_ACTION_ENDPOINTS: Record<SafetyActionSystem, string> = {
  device_enforcement: 'https://api.fda.gov/device/enforcement.json',
  device_recall: 'https://api.fda.gov/device/recall.json',
}

/**
 * A short identifier is not a safe basis for a free-text safety tie: `10` would match unrelated
 * recall descriptions. Identifiers below this normalized length are recorded but never used to
 * claim an exact safety match.
 */
const MINIMUM_TEXT_MATCH_LENGTH = 5

/** Bounded excerpt so an enumerated lot-code list never becomes an unbounded committed dump. */
const CODE_INFO_EXCERPT_LIMIT = 240

export interface SafetyActionSourceEvidence {
  source_id: string
  system: SafetyActionSystem
  endpoint: string
  source_url: string
  /** The client's own public request URL, so the committed source URL matches the cached call. */
  request_url: string
  exact_query: string
  dataset_as_of: string | null
  retrieved_at: string
  response_sha256: string
  raw_cache_reference: string
  identity_scope: 'exact_product' | 'family_or_proprietary_name' | 'context_only'
  temporal_scope: 'current' | 'historical' | 'undated'
  exact_identifier_text: string[]
  factual_summary: string
}

export interface SafetyActionRecordEvidence {
  system: SafetyActionSystem
  recall_number: string
  event_id: string | null
  recall_status: string
  status_disposition: 'active' | 'historical' | 'unknown'
  classification: string | null
  recalling_firm: string | null
  product_description: string
  reason_for_recall: string | null
  initiation_date: string | null
  posted_date: string | null
  report_date: string | null
  termination_date: string | null
  product_code: string | null
  submission_numbers: string[]
  match_scope: 'exact_product' | 'family_or_proprietary_name'
  matched_identifiers: string[]
  match_basis: string
  scope: SafetyActionScope
  affected_lot_identifier_count: number
  code_info_excerpt: string | null
  exact_query: string
  source_ids: string[]
}

export interface SafetyActionQueryIssue {
  endpoint: string
  exact_query: string
  message: string
}

export interface SafetyActionAcquisitionResult {
  search_status: SafetySearchStatus
  action_state: SafetyActionState
  action_scope: SafetyActionScope
  exact_action_sources_traceable: boolean
  searched_identifiers: string[]
  skipped_short_identifiers: string[]
  records: SafetyActionRecordEvidence[]
  sources: SafetyActionSourceEvidence[]
  dataset_snapshots: Record<string, string | null>
  metrics: FdaQueryExecutionMetrics
  query_issues: SafetyActionQueryIssue[]
}

const EMPTY_METRICS: FdaQueryExecutionMetrics = {
  pages: 0,
  apiRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  retries: 0,
}

function addMetrics(
  left: FdaQueryExecutionMetrics,
  right: FdaQueryExecutionMetrics,
): FdaQueryExecutionMetrics {
  return {
    pages: left.pages + right.pages,
    apiRequests: left.apiRequests + right.apiRequests,
    cacheHits: left.cacheHits + right.cacheHits,
    cacheMisses: left.cacheMisses + right.cacheMisses,
    retries: left.retries + right.retries,
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(stringValue).filter((entry): entry is string => Boolean(entry))
}

/** Normalizes both `YYYYMMDD` (enforcement) and `YYYY-MM-DD` (RES) to an ISO calendar date. */
export function normalizeSafetyDate(value: unknown): string | null {
  const raw = stringValue(value)
  if (!raw) return null
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(raw)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  const dashed = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  return dashed ? `${dashed[1]}-${dashed[2]}-${dashed[3]}` : null
}

/**
 * Classifies an FDA recall status string as currently active or historical.
 *
 * A completed or terminated action is never treated as "safe"; it is retained as historical
 * safety context. An unrecognized status stays `unknown` rather than being guessed.
 */
export function safetyStatusDisposition(
  status: string | null,
  terminationDate: string | null,
): 'active' | 'historical' | 'unknown' {
  const normalized = status?.toLocaleLowerCase('en-US').trim() ?? ''
  if (terminationDate) return 'historical'
  if (/^terminated|^completed/.test(normalized)) return 'historical'
  if (/^ongoing|^open|^pending/.test(normalized)) return 'active'
  return 'unknown'
}

/**
 * Splits free-text FDA recall fields into identifier-shaped tokens.
 *
 * Punctuation that separates identifiers (`:` `;` `/` `,` whitespace) is a boundary; punctuation
 * that appears inside identifiers (`-` `.`) is preserved for the shared exact comparison.
 */
export function safetyTextTokens(text: string): string[] {
  // `/` separates fields in FDA code_info, and the separator is not always followed by a space
  // ("UDI: 04050147021822/Expanded Lots: ..."). It can also appear inside an identifier, so the
  // text is tokenized both ways and every candidate is offered to the exact comparison.
  const tokens = [
    ...text.split(/[\s:;,|()[\]{}<>"'\\]+/u),
    ...text.split(/[\s:;,|()[\]{}<>"'\\/]+/u),
  ]
  return [
    ...new Set(
      tokens
        .map((token) => token.replace(/^[-./]+|[-./]+$/g, ''))
        .filter((token) => token.length > 0),
    ),
  ]
}

export function textContainsExactIdentifier(text: string, identifier: string): boolean {
  const expected = exactIdentifierComparison(identifier)
  if (!expected || expected.length < MINIMUM_TEXT_MATCH_LENGTH) return false
  return safetyTextTokens(text).some((token) => exactIdentifierComparison(token) === expected)
}

function usableTextIdentifier(identifier: string): boolean {
  const normalized = exactIdentifierComparison(identifier)
  return Boolean(normalized && normalized.length >= MINIMUM_TEXT_MATCH_LENGTH)
}

function deviceIdentifierShaped(identifier: string): boolean {
  return /^\d{12,14}$/.test(exactIdentifierComparison(identifier) ?? '')
}

function countLotIdentifiers(codeInfo: string): number {
  return safetyTextTokens(codeInfo).filter((token) => /^[A-Z]{1,2}\d{5,}$/i.test(token)).length
}

/**
 * Derives the scope of a safety action from its own code information.
 *
 * Enumerated lot codes mean the action is lot-limited: it does not establish that every unit of
 * the product is affected, and it never establishes that the product left the market.
 */
export function safetyActionScopeFor(codeInfo: string | null, lotCount: number): SafetyActionScope {
  const normalized = codeInfo?.toLocaleLowerCase('en-US') ?? ''
  if (/\ball\s+(?:lots|units|serial numbers|product|devices)\b/.test(normalized)) {
    return 'product_wide'
  }
  if (lotCount > 0 || /\blots?\b|\bbatch\b|\bserial\b/.test(normalized)) return 'lot_specific'
  return 'unknown'
}

function cacheReferenceToken(reference: string): string {
  const filename = reference.split('/').at(-1)?.split(':').at(-1) ?? reference
  return filename.replace(/\.json$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown-cache'
}

function sourceId(system: SafetyActionSystem, provenance: FdaResponseProvenance): string {
  return `safety-${system}:response-${cacheReferenceToken(provenance.raw_cache_reference)}`
}

interface SafetyLookup {
  system: SafetyActionSystem
  endpoint: string
  search: string
  sourceUrl: string
  records: Array<{ record: OpenFdaRecord; provenance: FdaResponseProvenance }>
  /**
   * Provenance for every response page, including pages with no results. A searched absence has
   * to be as traceable as a positive finding, otherwise `no_exact_action_found` would rest on an
   * unverifiable claim that a query was run.
   */
  pages: FdaResponseProvenance[]
  datasetLastUpdated: string | null
  error: string | null
  metrics: FdaQueryExecutionMetrics
}

async function safetyLookup(
  client: OpenFdaClient,
  system: SafetyActionSystem,
  field: string,
  value: string,
  refresh: boolean,
): Promise<SafetyLookup> {
  const endpoint = SAFETY_ACTION_ENDPOINTS[system]
  const search = exactOpenFdaSearch(field, value)
  const sourceUrl = `${endpoint}?search=${encodeURIComponent(search)}`
  try {
    const response = await queryOpenFdaPages(client, { search, limit: 100, maxPages: 5, refresh })
    const records: SafetyLookup['records'] = []
    const pages: FdaResponseProvenance[] = []
    for (const page of response.pages) {
      const { records: pageRecords, ...provenance } = page
      pages.push(provenance)
      for (const record of pageRecords) records.push({ record, provenance })
    }
    return {
      system,
      endpoint,
      search,
      sourceUrl,
      records,
      pages,
      datasetLastUpdated: response.datasetLastUpdated,
      error: response.truncated ? 'result_set_truncated' : null,
      metrics: response.metrics,
    }
  } catch (error) {
    return {
      system,
      endpoint,
      search,
      sourceUrl,
      records: [],
      pages: [],
      datasetLastUpdated: null,
      error: error instanceof Error ? error.message : 'Unknown openFDA safety query error.',
      metrics: { ...EMPTY_METRICS },
    }
  }
}

function recallNumberOf(record: OpenFdaRecord, system: SafetyActionSystem): string | null {
  return system === 'device_enforcement'
    ? stringValue(record.recall_number)
    : stringValue(record.product_res_number)
}

function eventIdOf(record: OpenFdaRecord, system: SafetyActionSystem): string | null {
  return system === 'device_enforcement'
    ? stringValue(record.event_id)
    : stringValue(record.res_event_number)
}

function recallStatusOf(record: OpenFdaRecord, system: SafetyActionSystem): string {
  return (
    (system === 'device_enforcement'
      ? stringValue(record.status)
      : stringValue(record.recall_status)) ?? 'unknown'
  )
}

function buildRecord(
  record: OpenFdaRecord,
  lookup: SafetyLookup,
  provenance: FdaResponseProvenance,
  identifiers: string[],
): SafetyActionRecordEvidence | null {
  const recallNumber = recallNumberOf(record, lookup.system)
  if (!recallNumber) return null
  const productDescription = stringValue(record.product_description) ?? ''
  const codeInfo = stringValue(record.code_info)
  const searchable = `${productDescription}\n${codeInfo ?? ''}`
  const matched = identifiers.filter((identifier) =>
    textContainsExactIdentifier(searchable, identifier),
  )
  const submissionNumbers = stableUnique(stringArrayValue(record.k_numbers), (value) =>
    value.toLocaleUpperCase('en-US'),
  ).sort()
  const terminationDate = normalizeSafetyDate(record.termination_date)
  const status = recallStatusOf(record, lookup.system)
  const lotCount = codeInfo ? countLotIdentifiers(codeInfo) : 0
  const exact = matched.length > 0
  return {
    system: lookup.system,
    recall_number: recallNumber,
    event_id: eventIdOf(record, lookup.system),
    recall_status: status,
    status_disposition: safetyStatusDisposition(status, terminationDate),
    classification: stringValue(record.classification),
    recalling_firm: stringValue(record.recalling_firm),
    product_description: productDescription,
    reason_for_recall: stringValue(record.reason_for_recall),
    initiation_date: normalizeSafetyDate(
      record.recall_initiation_date ?? record.event_date_initiated,
    ),
    posted_date: normalizeSafetyDate(record.event_date_posted ?? record.center_classification_date),
    report_date: normalizeSafetyDate(record.report_date),
    termination_date: terminationDate,
    product_code: stringValue(record.product_code),
    submission_numbers: submissionNumbers,
    match_scope: exact ? 'exact_product' : 'family_or_proprietary_name',
    matched_identifiers: matched.sort(),
    match_basis: exact
      ? `exact_identifier_in_official_fda_${lookup.system}_record`
      : `linked_submission_or_family_only_in_official_fda_${lookup.system}_record`,
    scope: exact ? safetyActionScopeFor(codeInfo, lotCount) : 'family_level',
    affected_lot_identifier_count: lotCount,
    code_info_excerpt: codeInfo ? codeInfo.slice(0, CODE_INFO_EXCERPT_LIMIT) : null,
    exact_query: lookup.search,
    source_ids: [sourceId(lookup.system, provenance)],
  }
}

function mergeRecords(records: SafetyActionRecordEvidence[]): SafetyActionRecordEvidence[] {
  const merged = new Map<string, SafetyActionRecordEvidence>()
  for (const record of records) {
    const key = `${record.system}\u0000${record.recall_number}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...record, source_ids: [...new Set(record.source_ids)].sort() })
      continue
    }
    const matchedIdentifiers = [
      ...new Set([...existing.matched_identifiers, ...record.matched_identifiers]),
    ].sort()
    const exact = matchedIdentifiers.length > 0
    merged.set(key, {
      ...existing,
      matched_identifiers: matchedIdentifiers,
      match_scope: exact ? 'exact_product' : existing.match_scope,
      match_basis: exact ? record.match_basis : existing.match_basis,
      scope: exact && existing.match_scope !== 'exact_product' ? record.scope : existing.scope,
      source_ids: [...new Set([...existing.source_ids, ...record.source_ids])].sort(),
    })
  }
  return [...merged.values()].sort(
    (left, right) =>
      left.recall_number.localeCompare(right.recall_number) ||
      left.system.localeCompare(right.system),
  )
}

/**
 * Reduces per-record findings to one safety-action state.
 *
 * The exact-identity records govern. A disagreement between the two official FDA systems about
 * whether the same recall is still active resolves to `unknown` rather than to either side.
 */
export function reduceSafetyActionState(
  records: SafetyActionRecordEvidence[],
  searchStatus: SafetySearchStatus,
): { action_state: SafetyActionState; action_scope: SafetyActionScope } {
  if (searchStatus !== 'searched') return { action_state: 'unknown', action_scope: 'unknown' }
  const exact = records.filter((record) => record.match_scope === 'exact_product')
  if (exact.length === 0) {
    const family = records.filter((record) => record.match_scope === 'family_or_proprietary_name')
    return family.length > 0
      ? { action_state: 'family_or_ambiguous_action', action_scope: 'family_level' }
      : { action_state: 'no_exact_action_found', action_scope: 'unknown' }
  }

  const dispositionsByRecall = new Map<string, Set<string>>()
  for (const record of exact) {
    const key = record.recall_number.toLocaleUpperCase('en-US')
    const set = dispositionsByRecall.get(key) ?? new Set<string>()
    set.add(record.status_disposition)
    dispositionsByRecall.set(key, set)
  }
  const conflicted = [...dispositionsByRecall.values()].some((set) => set.size > 1)
  const scopes = new Set(exact.map((record) => record.scope))
  const action_scope: SafetyActionScope = scopes.has('product_wide')
    ? 'product_wide'
    : scopes.size === 1
      ? [...scopes][0]
      : scopes.has('lot_specific') && scopes.has('unknown')
        ? 'unknown'
        : 'unknown'

  if (conflicted) return { action_state: 'unknown', action_scope }
  if (exact.some((record) => record.status_disposition === 'unknown')) {
    return { action_state: 'unknown', action_scope }
  }
  if (exact.some((record) => record.status_disposition === 'active')) {
    return { action_state: 'active_exact_product_action', action_scope }
  }
  return { action_state: 'historical_exact_product_action', action_scope }
}

function factualSummary(lookup: SafetyLookup, records: SafetyActionRecordEvidence[]): string {
  const exact = records.filter((record) => record.match_scope === 'exact_product')
  if (exact.length > 0) {
    return exact
      .map(
        (record) =>
          `FDA ${record.system} record ${record.recall_number} (event ${record.event_id ?? 'unknown'}), ${
            record.classification ?? 'unclassified'
          }, status ${record.recall_status}, initiated ${record.initiation_date ?? 'unknown'}: exact identifier match ${record.matched_identifiers.join(', ')}; scope ${record.scope}.`,
      )
      .join(' ')
  }
  if (records.length > 0) {
    return `Official FDA ${lookup.system} query returned ${records.length} record(s) linked only by submission or family identifiers; no exact product identifier matched.`
  }
  return `Official FDA ${lookup.system} query returned no record for this exact identifier search.`
}

export async function acquireSafetyActionEvidence({
  exactIdentifiers,
  submissionNumbers,
  clients,
  refresh = false,
}: {
  exactIdentifiers: string[]
  submissionNumbers: string[]
  clients: { enforcement: OpenFdaClient; recall: OpenFdaClient }
  refresh?: boolean
}): Promise<SafetyActionAcquisitionResult> {
  const identifiers = stableUnique(
    exactIdentifiers.filter((value) => value.trim().length > 0),
    (value) => exactIdentifierComparison(value) ?? value,
  ).sort()
  const searchable = identifiers.filter(usableTextIdentifier)
  const skipped = identifiers.filter((value) => !usableTextIdentifier(value))
  const submissions = stableUnique(submissionNumbers, (value) =>
    value.toLocaleUpperCase('en-US'),
  ).sort()

  if (searchable.length === 0) {
    return {
      search_status: 'not_searched',
      action_state: 'unknown',
      action_scope: 'unknown',
      exact_action_sources_traceable: false,
      searched_identifiers: [],
      skipped_short_identifiers: skipped,
      records: [],
      sources: [],
      dataset_snapshots: {},
      metrics: { ...EMPTY_METRICS },
      query_issues: [],
    }
  }

  const lookups: SafetyLookup[] = []
  for (const identifier of searchable) {
    const field = deviceIdentifierShaped(identifier) ? 'code_info' : 'product_description'
    lookups.push(
      await safetyLookup(clients.enforcement, 'device_enforcement', field, identifier, refresh),
    )
    lookups.push(await safetyLookup(clients.recall, 'device_recall', field, identifier, refresh))
  }
  for (const submission of submissions) {
    lookups.push(
      await safetyLookup(clients.recall, 'device_recall', 'k_numbers', submission, refresh),
    )
  }

  let metrics: FdaQueryExecutionMetrics = { ...EMPTY_METRICS }
  const queryIssues: SafetyActionQueryIssue[] = []
  const datasetSnapshots: Record<string, string | null> = {}
  const rawRecords: SafetyActionRecordEvidence[] = []
  const sources: SafetyActionSourceEvidence[] = []

  for (const lookup of lookups) {
    metrics = addMetrics(metrics, lookup.metrics)
    if (lookup.error) {
      queryIssues.push({
        endpoint: lookup.endpoint,
        exact_query: lookup.search,
        message: lookup.error,
      })
      continue
    }
    if (lookup.datasetLastUpdated) {
      const key = lookup.system === 'device_enforcement' ? 'enforcement' : 'recall'
      const existing = datasetSnapshots[key]
      if (!existing || lookup.datasetLastUpdated > existing) {
        datasetSnapshots[key] = lookup.datasetLastUpdated
      }
    }
    const lookupRecords: SafetyActionRecordEvidence[] = []
    for (const { record, provenance } of lookup.records) {
      const built = buildRecord(record, lookup, provenance, searchable)
      if (!built) continue
      lookupRecords.push(built)
    }
    rawRecords.push(...lookupRecords)
    const provenanceById = new Map<string, FdaResponseProvenance>(
      lookup.pages.map((provenance) => [sourceId(lookup.system, provenance), provenance]),
    )

    const exactHere = lookupRecords.filter((record) => record.match_scope === 'exact_product')
    const historicalOnly =
      exactHere.length > 0 &&
      exactHere.every((record) => record.status_disposition === 'historical')
    for (const [id, provenance] of provenanceById) {
      sources.push({
        source_id: id,
        system: lookup.system,
        endpoint: lookup.endpoint,
        source_url: lookup.sourceUrl,
        request_url: provenance.request_url,
        exact_query: lookup.search,
        dataset_as_of: lookup.datasetLastUpdated,
        retrieved_at: provenance.retrieved_at,
        response_sha256: provenance.response_sha256,
        raw_cache_reference: provenance.raw_cache_reference,
        identity_scope:
          exactHere.length > 0
            ? 'exact_product'
            : lookupRecords.length > 0
              ? 'family_or_proprietary_name'
              : 'context_only',
        temporal_scope: historicalOnly ? 'historical' : 'current',
        exact_identifier_text: [
          ...new Set(lookupRecords.flatMap((record) => record.matched_identifiers)),
        ].sort(),
        factual_summary: factualSummary(lookup, lookupRecords),
      })
    }
  }

  const searchStatus: SafetySearchStatus = queryIssues.length > 0 ? 'query_error' : 'searched'
  const records = mergeRecords(rawRecords)
  const reduced = reduceSafetyActionState(records, searchStatus)
  const exactRecords = records.filter((record) => record.match_scope === 'exact_product')
  return {
    search_status: searchStatus,
    action_state: reduced.action_state,
    action_scope: reduced.action_scope,
    exact_action_sources_traceable: exactRecords.every((record) => record.source_ids.length > 0),
    searched_identifiers: searchable,
    skipped_short_identifiers: skipped,
    records,
    sources: stableUnique(sources, (source) => source.source_id).sort((left, right) =>
      left.source_id.localeCompare(right.source_id),
    ),
    dataset_snapshots: datasetSnapshots,
    metrics,
    query_issues: queryIssues,
  }
}
