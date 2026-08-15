import {
  getOpenFdaManufacturerAliasGroup,
  manufacturerMatchesAlias,
} from '../openfda/manufacturer-aliases'
import {
  displayIdentifier,
  exactIdentifierComparison,
  exactOpenFdaSearch,
  normalizeManufacturerName,
  stableUnique,
} from '../openfda/normalize'
import { filterOpenFdaRecordsForQuery } from '../openfda/query-plan'
import type {
  CatalogProductInput,
  OpenFdaQuery,
  OpenFdaRecord,
  VerificationBacklogInput,
} from '../openfda/types'
import type { OpenFdaClient } from '../openfda/client'
import {
  queryOpenFdaPages,
  type FdaQueryExecutionMetrics,
  type FdaResponseProvenance,
} from './fda-evidence'
import type { IdentityMatchMethod, UdiConfigurationEvidence } from './classification'

export interface UdiIdentifierEvidence {
  id: string
  type: string | null
  issuing_agency: string | null
  unit_of_use_id: string | null
  quantity_per_package: string | null
  package_status: string | null
  package_discontinue_date: string | null
  package_type: string | null
}

export interface UdiProductCodeEvidence {
  code: string
  name: string | null
}

export interface UdiSubmissionEvidence {
  submission_number: string
  supplement_number: string | null
}

export interface UdiRecordEvidence {
  record_key: string | null
  public_device_record_key: string | null
  primary_di: string | null
  identifiers: UdiIdentifierEvidence[]
  company_name: string | null
  brand_name: string | null
  catalog_number: string | null
  version_or_model_number: string | null
  commercial_distribution_status: string | null
  commercial_distribution_end_date: string | null
  record_status: string | null
  public_version_date: string | null
  publish_date: string | null
  product_codes: UdiProductCodeEvidence[]
  premarket_submissions: UdiSubmissionEvidence[]
  premarket_exempt: boolean | null
  exact_identity: boolean
  match_basis: string[]
  exact_queries: string[]
  retrieved_at: string[]
  raw_cache_references: string[]
  response_provenance: FdaResponseProvenance[]
}

export interface UdiQueryEvidence {
  kind: OpenFdaQuery['kind']
  search: string
  exact_match_basis: string
  raw_result_count: number
  exact_result_count: number
  result_total: number | null
  dataset_last_updated: string | null
  retrieved_at: string[]
  raw_cache_references: string[]
  response_provenance: FdaResponseProvenance[]
  truncated: boolean
  error: string | null
}

export interface UdiAcquisitionResult {
  identity_match_method: IdentityMatchMethod
  identity_conflict: boolean
  identity_match_basis: string[]
  records: UdiRecordEvidence[]
  configurations: UdiConfigurationEvidence[]
  queries: UdiQueryEvidence[]
  search_completed: boolean
  all_exact_configurations_retrieved: boolean
  dataset_last_updated: string | null
  adjacent_sku_excluded: boolean
  model_conflict: boolean
  manufacturer_conflict: boolean
  metrics: FdaQueryExecutionMetrics
  query_errors: string[]
}

export interface SupplementalSourceEvidence {
  source_id: string
  source_layer: 'registration_listing' | 'marketing_authorization' | 'classification'
  source_url: string
  publisher: 'U.S. Food and Drug Administration'
  title: string
  endpoint: string
  exact_query: string
  match_basis: string
  identity_scope: 'exact_product' | 'family_or_name_only'
  current_or_historical: 'current' | 'historical' | 'classification'
  dataset_as_of: string | null
  retrieved_at: string
  response_sha256: string
  raw_cache_reference: string
}

export interface SupplementalQueryIssue {
  layer: 'registration_listing' | 'authorization'
  endpoint: string
  exact_query: string
  message: string
}

export interface SupplementalProductEvidence {
  registration: {
    search_completed: boolean
    snapshot_current: boolean
    match_scope: 'exact_product' | 'family_or_proprietary_name' | 'none'
    listing_status: 'current' | 'inactive' | 'unknown'
    establishment_registration_current: boolean | null
    conflict: boolean
    registration_numbers: string[]
    proprietary_names: string[]
    submission_numbers: string[]
    records: Array<{
      record_key: string | null
      establishment_name: string | null
      proprietary_name: string | null
      product_code: string | null
      registration_number: string | null
      listing_identifiers: string[]
      linked_submission_numbers: string[]
      listing_status: 'current' | 'inactive' | 'unknown'
      match_scope: 'exact_product' | 'family_or_proprietary_name' | 'none'
      exact_query: string
      match_basis: string
      dataset_as_of_date: string | null
      source_ids: string[]
    }>
  }
  authorization: {
    search_completed: boolean
    finding:
      | 'exact_510k_clearance'
      | 'exact_pma_approval'
      | 'exact_de_novo_grant'
      | 'exact_hde_approval'
      | 'family_level_authorization'
      | 'premarket_exempt'
      | 'unresolved'
      | 'not_found'
      | 'not_searched'
    submission_numbers: string[]
    decision_dates: string[]
    records: Array<{
      pathway: '510k' | 'pma' | 'de_novo' | 'hde' | 'premarket_exempt'
      submission_number: string | null
      decision_or_exemption_status: string | null
      decision_date: string | null
      product_code: string | null
      match_scope:
        | 'exact_product'
        | 'family_or_proprietary_name'
        | 'product_code_or_classification_only'
        | 'none'
      exact_query: string
      match_basis: string
      dataset_as_of_date: string | null
      source_ids: string[]
    }>
  }
  sources: SupplementalSourceEvidence[]
  dataset_snapshots: Record<string, string | null>
  metrics: FdaQueryExecutionMetrics
  query_errors: string[]
  query_issues: SupplementalQueryIssue[]
}

interface CandidateRecord {
  record: OpenFdaRecord
  queryKinds: Set<OpenFdaQuery['kind']>
  querySearches: Set<string>
  retrievedAt: Set<string>
  rawCacheReferences: Set<string>
  responseProvenance: Map<string, FdaResponseProvenance>
}

interface SupplementalLookup {
  records: OpenFdaRecord[]
  datasetLastUpdated: string | null
  retrievedAt: string[]
  sourceUrl: string
  search: string
  provenanceByRecord: Map<OpenFdaRecord, FdaResponseProvenance[]>
  error: string | null
  metrics: FdaQueryExecutionMetrics
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

function provenanceKey(value: FdaResponseProvenance): string {
  return [
    value.request_url,
    value.request_search,
    value.request_limit,
    value.request_skip,
    value.retrieved_at,
    value.response_sha256,
    value.raw_cache_reference,
  ].join('\u0000')
}

function stableProvenance(values: Iterable<FdaResponseProvenance>): FdaResponseProvenance[] {
  return [...new Map([...values].map((value) => [provenanceKey(value), value])).values()].sort(
    (left, right) =>
      left.request_url.localeCompare(right.request_url) ||
      left.retrieved_at.localeCompare(right.retrieved_at) ||
      left.raw_cache_reference.localeCompare(right.raw_cache_reference),
  )
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(objectValue).filter((row): row is Record<string, unknown> => Boolean(row))
    : []
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(stringValue).filter((row): row is string => Boolean(row))
}

/**
 * Identity conclusions preserve identifier punctuation. The openFDA query/local-filter layer is
 * intentionally broader so it can surface formatting collisions for review, but a value such as
 * `82520.1041` must never be promoted as the exact SKU `82520-1041`.
 */
function strictIdentifierComparison(value: unknown): string | null {
  const display = displayIdentifier(value)
  return display ? display.normalize('NFKC').toLocaleUpperCase('en-US') : null
}

function strictAlternateIdentifiers(value: unknown): string[] {
  const display = displayIdentifier(value)
  if (!display) return []
  return stableUnique(
    display
      .split(/[;,|\r\n]+/)
      .map((part) => displayIdentifier(part))
      .filter((part): part is string => Boolean(part)),
    (part) => strictIdentifierComparison(part) ?? part,
  )
}

function normalizedStatus(
  value: string | null,
): 'in_distribution' | 'not_in_distribution' | 'unknown' {
  const normalized = value?.toLocaleLowerCase('en-US') ?? ''
  if (/not\s+in\s+commercial\s+distribution|discontinued|inactive|ended/.test(normalized)) {
    return 'not_in_distribution'
  }
  if (/^in\s+commercial\s+distribution$|^active$/.test(normalized)) {
    return 'in_distribution'
  }
  return 'unknown'
}

function primaryDi(record: OpenFdaRecord): string | null {
  return (
    record.identifiers?.find(
      (identifier) => identifier.type?.toLocaleLowerCase('en-US') === 'primary',
    )?.id ?? null
  )
}

function recordIdentity(record: OpenFdaRecord): string {
  return (
    stringValue(record.record_key) ??
    stringValue(record.public_device_record_key) ??
    [
      strictIdentifierComparison(primaryDi(record)) ?? '',
      strictIdentifierComparison(record.catalog_number) ?? '',
      strictIdentifierComparison(record.version_or_model_number) ?? '',
      displayIdentifier(record.company_name)?.toLocaleLowerCase('en-US') ?? '',
    ].join(':')
  )
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (left === right || Math.abs(left.length - right.length) > 1) return false
  if (left.length === right.length) {
    let differences = 0
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences += 1
    }
    return differences === 1
  }
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left]
  let shortIndex = 0
  let longIndex = 0
  let skipped = 0
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1
      longIndex += 1
    } else {
      skipped += 1
      longIndex += 1
      if (skipped > 1) return false
    }
  }
  return true
}

function hasAdjacentSku(rawRecords: OpenFdaRecord[], productCatalog: string | null): boolean {
  const expected = exactIdentifierComparison(productCatalog)
  const expectedStrict = strictIdentifierComparison(productCatalog)
  if (!expected || !expectedStrict) return false
  return rawRecords.some((record) => {
    const candidate = exactIdentifierComparison(record.catalog_number)
    const candidateStrict = strictIdentifierComparison(record.catalog_number)
    return Boolean(
      candidate &&
      candidateStrict &&
      candidateStrict !== expectedStrict &&
      (candidate === expected || editDistanceAtMostOne(expected, candidate)),
    )
  })
}

function exactIdentifiersForProduct(
  product: CatalogProductInput,
  backlog: VerificationBacklogInput | null,
): Set<string> {
  return new Set(
    [
      product.gtin,
      backlog?.existing_gtin,
      backlog?.suggested_primary_di,
      product.catalog_number,
      product.global_part_number,
      product.reference_part_number,
      ...strictAlternateIdentifiers(product.alternate_ids),
    ]
      .map((value) => strictIdentifierComparison(value))
      .filter((value): value is string => Boolean(value)),
  )
}

function compactRecord(
  candidate: CandidateRecord,
  exactIdentity: boolean,
  matchBasis: string[],
): UdiRecordEvidence {
  const record = candidate.record
  const identifiers = [...(record.identifiers ?? [])]
    .map((identifier) => ({
      id: identifier.id,
      type: stringValue(identifier.type),
      issuing_agency: stringValue(identifier.issuing_agency),
      unit_of_use_id: stringValue(identifier.unit_of_use_id),
      quantity_per_package: stringValue(identifier.quantity_per_package),
      package_status: stringValue(identifier.package_status),
      package_discontinue_date: stringValue(identifier.package_discontinue_date),
      package_type: stringValue(identifier.package_type),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
  const productCodes = objectArray(record.product_codes)
    .map((row) => ({ code: stringValue(row.code), name: stringValue(row.name) }))
    .filter((row): row is { code: string; name: string | null } => Boolean(row.code))
    .sort((left, right) => left.code.localeCompare(right.code))
  const submissions = objectArray(record.premarket_submissions)
    .map((row) => ({
      submission_number: stringValue(row.submission_number),
      supplement_number: stringValue(row.supplement_number),
    }))
    .filter((row): row is { submission_number: string; supplement_number: string | null } =>
      Boolean(row.submission_number),
    )
    .sort((left, right) => left.submission_number.localeCompare(right.submission_number))
  return {
    record_key: stringValue(record.record_key),
    public_device_record_key: stringValue(record.public_device_record_key),
    primary_di: primaryDi(record),
    identifiers,
    company_name: stringValue(record.company_name),
    brand_name: stringValue(record.brand_name),
    catalog_number: stringValue(record.catalog_number),
    version_or_model_number: stringValue(record.version_or_model_number),
    commercial_distribution_status: stringValue(record.commercial_distribution_status),
    commercial_distribution_end_date: stringValue(record.commercial_distribution_end_date),
    record_status: stringValue(record.record_status),
    public_version_date: stringValue(record.public_version_date),
    publish_date: stringValue(record.publish_date),
    product_codes: productCodes,
    premarket_submissions: submissions,
    premarket_exempt: booleanValue(record.is_pm_exempt),
    exact_identity: exactIdentity,
    match_basis: [...matchBasis].sort(),
    exact_queries: [...candidate.querySearches].sort(),
    retrieved_at: [...candidate.retrievedAt].sort(),
    raw_cache_references: [...candidate.rawCacheReferences].sort(),
    response_provenance: stableProvenance(candidate.responseProvenance.values()),
  }
}

function configurationRows(records: UdiRecordEvidence[]): UdiConfigurationEvidence[] {
  const rows: UdiConfigurationEvidence[] = []
  for (const record of records.filter((row) => row.exact_identity)) {
    const baseId = record.primary_di ?? record.record_key ?? record.public_device_record_key
    if (baseId) {
      rows.push({
        configuration_id: baseId,
        identifier_type: 'primary',
        exact_identity: true,
        distribution_status: normalizedStatus(record.commercial_distribution_status),
      })
    }
    for (const identifier of record.identifiers) {
      const type = identifier.type?.toLocaleLowerCase('en-US')
      if (type !== 'package' && type !== 'unit of use' && type !== 'unit_of_use') continue
      rows.push({
        configuration_id: identifier.id,
        identifier_type:
          type === 'package' ? 'package' : type?.includes('unit') ? 'unit_of_use' : 'other',
        exact_identity: true,
        distribution_status: normalizedStatus(
          identifier.package_status ?? record.commercial_distribution_status,
        ),
      })
    }
  }
  return stableUnique(rows, (row) => `${row.identifier_type}:${row.configuration_id}`).sort(
    (left, right) =>
      left.configuration_id.localeCompare(right.configuration_id) ||
      left.identifier_type.localeCompare(right.identifier_type),
  )
}

function identityForCandidates(
  candidates: CandidateRecord[],
  product: CatalogProductInput,
  backlog: VerificationBacklogInput | null,
): {
  method: IdentityMatchMethod
  conflict: boolean
  basis: string[]
  exactByIdentity: Map<string, { exact: boolean; basis: string[] }>
  modelConflict: boolean
  manufacturerConflict: boolean
} {
  const aliases = getOpenFdaManufacturerAliasGroup(product.manufacturer_id, product.manufacturer)
  const canonicalDi = strictIdentifierComparison(product.gtin)
  const candidateDis = new Set(
    [backlog?.existing_gtin, backlog?.suggested_primary_di]
      .map((value) => strictIdentifierComparison(value))
      .filter((value): value is string => Boolean(value)),
  )
  const catalog = strictIdentifierComparison(product.catalog_number)
  const globalPart = strictIdentifierComparison(product.global_part_number)
  const referencePart = strictIdentifierComparison(product.reference_part_number)
  const alternateParts = new Set(
    strictAlternateIdentifiers(product.alternate_ids)
      .map((value) => strictIdentifierComparison(value))
      .filter((value): value is string => Boolean(value)),
  )
  const exactByIdentity = new Map<string, { exact: boolean; basis: string[] }>()
  const methods = new Set<IdentityMatchMethod>()
  const basis = new Set<string>()
  let manufacturerConflict = false
  let modelConflict = false

  for (const candidate of candidates) {
    const record = candidate.record
    const candidatePrimary = strictIdentifierComparison(primaryDi(record))
    const recordCatalog = strictIdentifierComparison(record.catalog_number)
    const recordModel = strictIdentifierComparison(record.version_or_model_number)
    const manufacturerAlias = manufacturerMatchesAlias(record.company_name, aliases)
    const recordBasis = new Set<string>()
    let exact = false
    if (canonicalDi && candidatePrimary === canonicalDi) {
      exact = true
      methods.add('exact_primary_di_or_gtin')
      recordBasis.add('exact_canonical_primary_di')
    }
    if (catalog && recordCatalog === catalog) {
      if (manufacturerAlias) {
        exact = true
        methods.add('exact_manufacturer_catalog_number')
        recordBasis.add('exact_catalog_and_reviewed_manufacturer_alias')
      } else {
        manufacturerConflict = true
        recordBasis.add('exact_catalog_manufacturer_not_in_reviewed_alias_group')
      }
    }
    if (recordModel && [catalog, globalPart].filter(Boolean).includes(recordModel)) {
      if (manufacturerAlias) {
        exact = true
        methods.add('exact_manufacturer_model_number')
        recordBasis.add('exact_model_and_reviewed_manufacturer_alias')
      } else {
        manufacturerConflict = true
      }
    }
    if (recordModel && referencePart && recordModel === referencePart) {
      if (manufacturerAlias) {
        exact = true
        methods.add('exact_manufacturer_reference_number')
        recordBasis.add('exact_reference_and_reviewed_manufacturer_alias')
      } else {
        manufacturerConflict = true
      }
    }
    if (recordModel && alternateParts.has(recordModel)) {
      if (manufacturerAlias) {
        exact = true
        methods.add('reviewed_manufacturer_alias_exact_identifier')
        recordBasis.add('exact_documented_alternate_and_reviewed_manufacturer_alias')
      } else {
        manufacturerConflict = true
      }
    }
    if (candidatePrimary && candidateDis.has(candidatePrimary)) {
      recordBasis.add('exact_stale_backlog_di_candidate_not_independently_canonical')
    }
    if (
      manufacturerAlias &&
      recordModel &&
      [catalog, globalPart, referencePart].some(Boolean) &&
      ![catalog, globalPart, referencePart].filter(Boolean).includes(recordModel) &&
      !alternateParts.has(recordModel)
    ) {
      modelConflict = true
      recordBasis.add('model_or_configuration_conflict')
    }
    for (const value of recordBasis) basis.add(value)
    exactByIdentity.set(recordIdentity(record), { exact, basis: [...recordBasis].sort() })
  }

  const priority: IdentityMatchMethod[] = [
    'exact_primary_di_or_gtin',
    'exact_manufacturer_catalog_number',
    'exact_manufacturer_model_number',
    'exact_manufacturer_reference_number',
    'reviewed_manufacturer_alias_exact_identifier',
  ]
  const method =
    priority.find((value) => methods.has(value)) ??
    (candidates.length ? 'family_or_name_only' : 'none')
  return {
    method,
    conflict: manufacturerConflict || modelConflict,
    basis: [...basis].sort(),
    exactByIdentity,
    modelConflict,
    manufacturerConflict,
  }
}

function buildExactQueries(
  product: CatalogProductInput,
  backlog: VerificationBacklogInput | null,
): OpenFdaQuery[] {
  const plan: OpenFdaQuery[] = []
  const dis = stableUnique(
    [product.gtin, backlog?.existing_gtin, backlog?.suggested_primary_di]
      .map(displayIdentifier)
      .filter((value): value is string => Boolean(value)),
    (value) => strictIdentifierComparison(value) ?? value,
  )
  for (const value of dis) {
    plan.push({
      kind: 'primary_di',
      phase: 1,
      search: exactOpenFdaSearch('identifiers.id', value),
      limit: 100,
      sourceValue: value,
      reviewOnly: value !== product.gtin,
    })
  }
  const catalog = displayIdentifier(product.catalog_number)
  if (catalog && !/^custom[\s_-]*service$/i.test(catalog)) {
    plan.push({
      kind: 'catalog_number',
      phase: 2,
      search: exactOpenFdaSearch('catalog_number', catalog),
      limit: 100,
      sourceValue: catalog,
      reviewOnly: false,
    })
  }
  for (const value of stableUnique(
    [product.catalog_number, product.global_part_number, product.reference_part_number]
      .map(displayIdentifier)
      .filter((candidate): candidate is string => Boolean(candidate)),
    (candidate) => strictIdentifierComparison(candidate) ?? candidate,
  )) {
    if (/^custom[\s_-]*service$/i.test(value)) continue
    plan.push({
      kind: 'model_number',
      phase: 4,
      search: exactOpenFdaSearch('version_or_model_number', value),
      limit: 100,
      sourceValue: value,
      reviewOnly: true,
    })
  }
  for (const value of strictAlternateIdentifiers(product.alternate_ids)) {
    if (/^custom[\s_-]*service$/i.test(value)) continue
    plan.push({
      kind: 'alternate_identifier',
      phase: 4,
      search: exactOpenFdaSearch('version_or_model_number', value),
      limit: 100,
      sourceValue: value,
      reviewOnly: true,
    })
  }
  return stableUnique(plan, (query) => query.search)
}

export async function acquireUdiEvidence({
  product,
  backlog,
  client,
  refresh = false,
}: {
  product: CatalogProductInput
  backlog: VerificationBacklogInput | null
  client: OpenFdaClient
  refresh?: boolean
}): Promise<UdiAcquisitionResult> {
  const queries = buildExactQueries(product, backlog)
  const candidates = new Map<string, CandidateRecord>()
  const queryEvidence: UdiQueryEvidence[] = []
  const queryErrors: string[] = []
  const rawRecords: OpenFdaRecord[] = []
  let metrics = { ...EMPTY_METRICS }
  let allRetrieved = true

  for (const query of queries) {
    try {
      const response = await queryOpenFdaPages(client, {
        search: query.search,
        limit: query.limit,
        maxPages: 10,
        refresh,
      })
      metrics = addMetrics(metrics, response.metrics)
      rawRecords.push(...response.records)
      const exactRecords = filterOpenFdaRecordsForQuery(response.records, query)
      for (const page of response.pages) {
        const { records: pageRecords, ...provenance } = page
        for (const record of filterOpenFdaRecordsForQuery(pageRecords, query)) {
          const identity = recordIdentity(record)
          const current = candidates.get(identity) ?? {
            record,
            queryKinds: new Set<OpenFdaQuery['kind']>(),
            querySearches: new Set<string>(),
            retrievedAt: new Set<string>(),
            rawCacheReferences: new Set<string>(),
            responseProvenance: new Map<string, FdaResponseProvenance>(),
          }
          current.queryKinds.add(query.kind)
          current.querySearches.add(provenance.request_search)
          current.retrievedAt.add(provenance.retrieved_at)
          current.rawCacheReferences.add(provenance.raw_cache_reference)
          current.responseProvenance.set(provenanceKey(provenance), provenance)
          candidates.set(identity, current)
        }
      }
      if (response.truncated) allRetrieved = false
      queryEvidence.push({
        kind: query.kind,
        search: query.search,
        exact_match_basis: `${query.kind}:${query.sourceValue}`,
        raw_result_count: response.records.length,
        exact_result_count: exactRecords.length,
        result_total: response.resultTotal,
        dataset_last_updated: response.datasetLastUpdated,
        retrieved_at: response.retrievedAt,
        raw_cache_references: response.rawCacheReferences,
        response_provenance: response.pages.map((page) => ({
          request_url: page.request_url,
          request_search: page.request_search,
          request_limit: page.request_limit,
          request_skip: page.request_skip,
          retrieved_at: page.retrieved_at,
          response_sha256: page.response_sha256,
          raw_cache_reference: page.raw_cache_reference,
        })),
        truncated: response.truncated,
        error: null,
      })
    } catch (error) {
      allRetrieved = false
      const message = error instanceof Error ? error.message : 'Unknown openFDA UDI query error.'
      queryErrors.push(message)
      queryEvidence.push({
        kind: query.kind,
        search: query.search,
        exact_match_basis: `${query.kind}:${query.sourceValue}`,
        raw_result_count: 0,
        exact_result_count: 0,
        result_total: null,
        dataset_last_updated: null,
        retrieved_at: [],
        raw_cache_references: [],
        response_provenance: [],
        truncated: false,
        error: message,
      })
    }
  }

  const candidateRows = [...candidates.values()].sort((left, right) =>
    recordIdentity(left.record).localeCompare(recordIdentity(right.record)),
  )
  const identity = identityForCandidates(candidateRows, product, backlog)
  const records = candidateRows.map((candidate) => {
    const details = identity.exactByIdentity.get(recordIdentity(candidate.record)) ?? {
      exact: false,
      basis: [],
    }
    return compactRecord(candidate, details.exact, details.basis)
  })
  const snapshots = queryEvidence
    .map((query) => query.dataset_last_updated)
    .filter((value): value is string => Boolean(value))
  return {
    identity_match_method: identity.method,
    identity_conflict: identity.conflict,
    identity_match_basis: identity.basis,
    records,
    configurations: configurationRows(records),
    queries: queryEvidence.sort(
      (left, right) =>
        left.search.localeCompare(right.search) || left.kind.localeCompare(right.kind),
    ),
    search_completed: queryErrors.length === 0,
    all_exact_configurations_retrieved: allRetrieved,
    dataset_last_updated: snapshots.sort().at(-1) ?? null,
    adjacent_sku_excluded: !hasAdjacentSku(rawRecords, product.catalog_number),
    model_conflict: identity.modelConflict,
    manufacturer_conflict: identity.manufacturerConflict,
    metrics,
    query_errors: queryErrors,
  }
}

function endpointForSubmission(submission: string): {
  endpoint: string
  field: string
  layer: 'marketing_authorization'
} | null {
  if (/^(?:K|DEN)\d+$/i.test(submission)) {
    return {
      endpoint: 'https://api.fda.gov/device/510k.json',
      field: 'k_number',
      layer: 'marketing_authorization',
    }
  }
  if (/^P\d+/i.test(submission)) {
    return {
      endpoint: 'https://api.fda.gov/device/pma.json',
      field: 'pma_number',
      layer: 'marketing_authorization',
    }
  }
  return null
}

async function lookup(
  client: OpenFdaClient,
  endpoint: string,
  field: string,
  value: string,
  refresh: boolean,
  { maxPages = 10 }: { maxPages?: number } = {},
): Promise<SupplementalLookup> {
  const search = exactOpenFdaSearch(field, value)
  try {
    const response = await queryOpenFdaPages(client, {
      search,
      limit: 100,
      maxPages,
      refresh,
    })
    const expected = exactIdentifierComparison(value)
    const valuesAtPath = (value: unknown, segments: string[]): unknown[] => {
      if (segments.length === 0) return Array.isArray(value) ? value : [value]
      if (Array.isArray(value)) return value.flatMap((entry) => valuesAtPath(entry, segments))
      const object = objectValue(value)
      if (!object) return []
      return valuesAtPath(object[segments[0]], segments.slice(1))
    }
    const exactRecord = (record: OpenFdaRecord): boolean =>
      valuesAtPath(record, field.split('.')).some(
        (candidate) => exactIdentifierComparison(candidate as string | null) === expected,
      )
    const records: OpenFdaRecord[] = []
    const provenanceByRecord = new Map<OpenFdaRecord, FdaResponseProvenance[]>()
    for (const page of response.pages) {
      const { records: pageRecords, ...provenance } = page
      for (const record of pageRecords.filter(exactRecord)) {
        records.push(record)
        provenanceByRecord.set(record, [provenance])
      }
    }
    return {
      records,
      datasetLastUpdated: response.datasetLastUpdated,
      retrievedAt: response.retrievedAt,
      sourceUrl: `${endpoint}?search=${encodeURIComponent(search)}`,
      search,
      provenanceByRecord,
      error: response.truncated ? 'result_set_truncated' : null,
      metrics: response.metrics,
    }
  } catch (error) {
    return {
      records: [],
      datasetLastUpdated: null,
      retrievedAt: [],
      sourceUrl: `${endpoint}?search=${encodeURIComponent(search)}`,
      search,
      provenanceByRecord: new Map(),
      error: error instanceof Error ? error.message : 'Unknown supplemental openFDA query error.',
      metrics: { ...EMPTY_METRICS },
    }
  }
}

function activeRegistration(record: OpenFdaRecord): boolean | null {
  const registration = objectValue(record.registration)
  if (!registration) return null
  const status = stringValue(registration.status_code)
  if (status === '1' || status === '5') return true
  return status ? false : null
}

function registrationNumber(record: OpenFdaRecord): string | null {
  return stringValue(objectValue(record.registration)?.registration_number)
}

function establishmentName(record: OpenFdaRecord): string | null {
  const registration = objectValue(record.registration)
  return (
    stringValue(registration?.name) ??
    stringValue(objectValue(registration?.owner_operator)?.firm_name)
  )
}

function recordProductCodes(record: OpenFdaRecord): string[] {
  return stableUnique(
    objectArray(record.products)
      .map((product) => stringValue(product.product_code))
      .filter((value): value is string => Boolean(value)),
    (value) => value,
  ).sort()
}

function decisionDate(record: OpenFdaRecord): string | null {
  return (
    stringValue(record.decision_date) ??
    stringValue(record.date_received) ??
    stringValue(record.decision_date_original)
  )
}

function cacheReferenceToken(reference: string): string {
  const filename = reference.split('/').at(-1)?.split(':').at(-1) ?? reference
  const token = filename.replace(/\.json$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-')
  return token || 'unknown-cache'
}

function provenanceSourceId(base: string, provenance: FdaResponseProvenance): string {
  return `${base}:response-${cacheReferenceToken(provenance.raw_cache_reference)}`
}

function lookupProvenance(
  lookup: SupplementalLookup,
  records: OpenFdaRecord[] = lookup.records,
): FdaResponseProvenance[] {
  return stableProvenance(records.flatMap((record) => lookup.provenanceByRecord.get(record) ?? []))
}

function lookupSourceIds(
  base: string,
  lookup: SupplementalLookup,
  records: OpenFdaRecord[] = lookup.records,
): string[] {
  return lookupProvenance(lookup, records).map((provenance) => provenanceSourceId(base, provenance))
}

export async function acquireSupplementalEvidence({
  udi,
  clients,
  refresh = false,
}: {
  udi: UdiAcquisitionResult
  clients: {
    registration: OpenFdaClient
    clearance: OpenFdaClient
    pma: OpenFdaClient
    classification: OpenFdaClient
  }
  refresh?: boolean
}): Promise<SupplementalProductEvidence> {
  const exactRecords = udi.records.filter((record) => record.exact_identity)
  const submissions = stableUnique(
    exactRecords.flatMap((record) =>
      record.premarket_submissions.map((submission) => submission.submission_number),
    ),
    (value) => value.toLocaleUpperCase('en-US'),
  ).sort()
  const productCodes = stableUnique(
    exactRecords.flatMap((record) => record.product_codes.map((code) => code.code)),
    (value) => value.toLocaleUpperCase('en-US'),
  ).sort()
  const authorizationLookups: Array<{ submission: string; lookup: SupplementalLookup }> = []
  const registrationLookups: Array<{ basis: string; lookup: SupplementalLookup }> = []
  const classificationLookups: Array<{ code: string; lookup: SupplementalLookup }> = []

  for (const submission of submissions) {
    const endpoint = endpointForSubmission(submission)
    if (endpoint) {
      authorizationLookups.push({
        submission,
        lookup: await lookup(
          endpoint.endpoint.includes('/510k') ? clients.clearance : clients.pma,
          endpoint.endpoint,
          endpoint.field,
          submission,
          refresh,
        ),
      })
    }
    const listingField = /^P|^H/i.test(submission) ? 'pma_number' : 'k_number'
    registrationLookups.push({
      basis: submission,
      lookup: await lookup(
        clients.registration,
        'https://api.fda.gov/device/registrationlisting.json',
        listingField,
        submission,
        refresh,
      ),
    })
  }
  if (submissions.length === 0) {
    for (const code of productCodes) {
      registrationLookups.push({
        basis: code,
        lookup: await lookup(
          clients.registration,
          'https://api.fda.gov/device/registrationlisting.json',
          'products.product_code',
          code,
          refresh,
          { maxPages: 1 },
        ),
      })
    }
  }
  for (const code of productCodes) {
    classificationLookups.push({
      code,
      lookup: await lookup(
        clients.classification,
        'https://api.fda.gov/device/classification.json',
        'product_code',
        code,
        refresh,
      ),
    })
  }

  const allLookups = [
    ...authorizationLookups.map((row) => row.lookup),
    ...registrationLookups.map((row) => row.lookup),
    ...classificationLookups.map((row) => row.lookup),
  ]
  const registrationErrors = registrationLookups
    .map((row) => row.lookup.error)
    .filter((value): value is string => Boolean(value))
  const authorizationErrors = [...authorizationLookups, ...classificationLookups]
    .map((row) => row.lookup.error)
    .filter((value): value is string => Boolean(value))
  const errors = allLookups
    .map((row) => row.error)
    .filter((value): value is string => Boolean(value))
  const queryIssues: SupplementalQueryIssue[] = [
    ...registrationLookups.flatMap((row) =>
      row.lookup.error
        ? [
            {
              layer: 'registration_listing' as const,
              endpoint: 'device/registrationlisting',
              exact_query: row.lookup.search,
              message: row.lookup.error,
            },
          ]
        : [],
    ),
    ...authorizationLookups.flatMap((row) =>
      row.lookup.error
        ? [
            {
              layer: 'authorization' as const,
              endpoint: row.lookup.sourceUrl.includes('/510k') ? 'device/510k' : 'device/pma',
              exact_query: row.lookup.search,
              message: row.lookup.error,
            },
          ]
        : [],
    ),
    ...classificationLookups.flatMap((row) =>
      row.lookup.error
        ? [
            {
              layer: 'authorization' as const,
              endpoint: 'device/classification',
              exact_query: row.lookup.search,
              message: row.lookup.error,
            },
          ]
        : [],
    ),
  ].sort(
    (left, right) =>
      left.layer.localeCompare(right.layer) ||
      left.endpoint.localeCompare(right.endpoint) ||
      left.exact_query.localeCompare(right.exact_query) ||
      left.message.localeCompare(right.message),
  )
  const exactUdiLabelers = new Set(
    exactRecords
      .map((record) => normalizeManufacturerName(record.company_name))
      .filter((value): value is string => Boolean(value)),
  )
  const scopedRegistrationLookups = registrationLookups.map((row) => ({
    ...row,
    lookup: {
      ...row.lookup,
      records: submissions.includes(row.basis)
        ? row.lookup.records
        : row.lookup.records.filter((record) => {
            const establishment = normalizeManufacturerName(establishmentName(record))
            return establishment !== null && exactUdiLabelers.has(establishment)
          }),
    },
  }))
  const listingRecords = scopedRegistrationLookups.flatMap((row) => row.lookup.records)
  const registrationStates = listingRecords
    .map(activeRegistration)
    .filter((value) => value !== null)
  const anyActive = registrationStates.includes(true)
  const anyInactive = registrationStates.includes(false)
  const exactListing = scopedRegistrationLookups.some(
    (row) => submissions.includes(row.basis) && row.lookup.records.length > 0,
  )
  const authorizationRecords = authorizationLookups.flatMap((row) => row.lookup.records)
  const exactNumbers = authorizationLookups
    .filter((row) => row.lookup.records.length > 0)
    .map((row) => row.submission)
    .sort()
  const classificationRecords = classificationLookups.flatMap((row) => row.lookup.records)
  const exempt =
    exactRecords.some((record) => record.premarket_exempt === true) ||
    classificationRecords.some((record) => stringValue(record.submission_type_id) === '4')
  let finding: SupplementalProductEvidence['authorization']['finding'] = 'not_found'
  if (exactNumbers.some((number) => /^DEN/i.test(number))) finding = 'exact_de_novo_grant'
  else if (exactNumbers.some((number) => /^K/i.test(number))) finding = 'exact_510k_clearance'
  else if (exactNumbers.some((number) => /^P/i.test(number))) finding = 'exact_pma_approval'
  else if (submissions.some((number) => /^H/i.test(number))) finding = 'unresolved'
  else if (exempt) finding = 'premarket_exempt'

  const registrationRecords: SupplementalProductEvidence['registration']['records'] =
    scopedRegistrationLookups.flatMap((row) =>
      row.lookup.records.map((record) => {
        const active = activeRegistration(record)
        const linkedSubmission = stringValue(record.k_number) ?? stringValue(record.pma_number)
        const productCode = recordProductCodes(record)[0] ?? null
        const sourceBase = `openfda-registration:${row.basis}`
        return {
          record_key:
            stringValue(record.record_key) ??
            registrationNumber(record) ??
            `${row.basis}:${productCode ?? 'unidentified'}`,
          establishment_name: establishmentName(record),
          proprietary_name: stringArray(record.proprietary_name)[0] ?? null,
          product_code: productCode,
          registration_number: registrationNumber(record),
          listing_identifiers: stableUnique(
            [registrationNumber(record), productCode].filter((value): value is string =>
              Boolean(value),
            ),
            (value) => value,
          ).sort(),
          linked_submission_numbers: linkedSubmission ? [linkedSubmission] : [],
          listing_status: active === true ? 'current' : active === false ? 'inactive' : 'unknown',
          match_scope: submissions.includes(row.basis)
            ? ('exact_product' as const)
            : ('family_or_proprietary_name' as const),
          exact_query: row.lookup.search,
          match_basis: submissions.includes(row.basis)
            ? 'exact submission number linked from exact UDI record'
            : 'family-level product code only',
          dataset_as_of_date: row.lookup.datasetLastUpdated,
          source_ids: lookupSourceIds(sourceBase, row.lookup, [record]),
        }
      }),
    )
  const authorizationRecordsCompact: SupplementalProductEvidence['authorization']['records'] =
    authorizationLookups.flatMap((row) =>
      row.lookup.records.map((record) => {
        const pathway = /^DEN/i.test(row.submission)
          ? ('de_novo' as const)
          : /^K/i.test(row.submission)
            ? ('510k' as const)
            : ('pma' as const)
        return {
          pathway,
          submission_number: row.submission,
          decision_or_exemption_status:
            stringValue(record.decision_code) ??
            stringValue(record.decision_description) ??
            stringValue(record.decision),
          decision_date: decisionDate(record),
          product_code: stringValue(record.product_code),
          match_scope: 'exact_product' as const,
          exact_query: row.lookup.search,
          match_basis: 'exact submission number linked from exact UDI record',
          dataset_as_of_date: row.lookup.datasetLastUpdated,
          source_ids: lookupSourceIds(`openfda-authorization:${row.submission}`, row.lookup, [
            record,
          ]),
        }
      }),
    )
  if (finding === 'premarket_exempt') {
    const code = productCodes[0] ?? null
    const classification = classificationLookups.find((row) => row.code === code)?.lookup
    authorizationRecordsCompact.push({
      pathway: 'premarket_exempt',
      submission_number: null,
      decision_or_exemption_status: 'premarket exempt classification evidence',
      decision_date: null,
      product_code: code,
      match_scope: 'product_code_or_classification_only',
      exact_query: classification?.search ?? 'UDI is_pm_exempt=true',
      match_basis: 'product-code classification or manufacturer-submitted UDI exemption flag',
      dataset_as_of_date: classification?.datasetLastUpdated ?? udi.dataset_last_updated,
      source_ids:
        code && classification
          ? lookupSourceIds(`openfda-classification:${code}`, classification)
          : [],
    })
  }

  const sources: SupplementalSourceEvidence[] = []
  for (const row of scopedRegistrationLookups) {
    if (row.lookup.records.length === 0) continue
    const sourceBase = `openfda-registration:${row.basis}`
    for (const provenance of lookupProvenance(row.lookup)) {
      sources.push({
        source_id: provenanceSourceId(sourceBase, provenance),
        source_layer: 'registration_listing',
        source_url: provenance.request_url,
        publisher: 'U.S. Food and Drug Administration',
        title: `Device registration/listing evidence for ${row.basis}`,
        endpoint: 'device/registrationlisting',
        exact_query: provenance.request_search,
        match_basis: submissions.includes(row.basis)
          ? 'exact submission number linked from exact UDI record'
          : 'family-level product code only',
        identity_scope: submissions.includes(row.basis) ? 'exact_product' : 'family_or_name_only',
        current_or_historical: anyActive ? 'current' : 'historical',
        dataset_as_of: row.lookup.datasetLastUpdated,
        retrieved_at: provenance.retrieved_at,
        response_sha256: provenance.response_sha256,
        raw_cache_reference: provenance.raw_cache_reference,
      })
    }
  }
  for (const row of authorizationLookups) {
    if (row.lookup.records.length === 0) continue
    const sourceBase = `openfda-authorization:${row.submission}`
    for (const provenance of lookupProvenance(row.lookup)) {
      sources.push({
        source_id: provenanceSourceId(sourceBase, provenance),
        source_layer: 'marketing_authorization',
        source_url: provenance.request_url,
        publisher: 'U.S. Food and Drug Administration',
        title: `Marketing authorization record ${row.submission}`,
        endpoint: provenance.request_url.includes('/510k') ? 'device/510k' : 'device/pma',
        exact_query: provenance.request_search,
        match_basis: 'exact submission number linked from exact UDI record',
        identity_scope: 'exact_product',
        current_or_historical: 'historical',
        dataset_as_of: row.lookup.datasetLastUpdated,
        retrieved_at: provenance.retrieved_at,
        response_sha256: provenance.response_sha256,
        raw_cache_reference: provenance.raw_cache_reference,
      })
    }
  }
  for (const row of classificationLookups) {
    if (row.lookup.records.length === 0) continue
    const sourceBase = `openfda-classification:${row.code}`
    for (const provenance of lookupProvenance(row.lookup)) {
      sources.push({
        source_id: provenanceSourceId(sourceBase, provenance),
        source_layer: 'classification',
        source_url: provenance.request_url,
        publisher: 'U.S. Food and Drug Administration',
        title: `Device classification ${row.code}`,
        endpoint: 'device/classification',
        exact_query: provenance.request_search,
        match_basis: 'family-level product code linked from exact UDI record',
        identity_scope: 'family_or_name_only',
        current_or_historical: 'classification',
        dataset_as_of: row.lookup.datasetLastUpdated,
        retrieved_at: provenance.retrieved_at,
        response_sha256: provenance.response_sha256,
        raw_cache_reference: provenance.raw_cache_reference,
      })
    }
  }

  return {
    registration: {
      search_completed: registrationErrors.length === 0,
      snapshot_current: registrationLookups.every(
        (row) => row.lookup.datasetLastUpdated !== null || row.lookup.records.length === 0,
      ),
      match_scope: exactListing
        ? 'exact_product'
        : listingRecords.length
          ? 'family_or_proprietary_name'
          : 'none',
      listing_status: anyActive ? 'current' : anyInactive ? 'inactive' : 'unknown',
      establishment_registration_current: anyActive ? true : anyInactive ? false : null,
      conflict: anyActive && anyInactive,
      registration_numbers: stableUnique(
        listingRecords.map(registrationNumber).filter((value): value is string => Boolean(value)),
        (value) => value,
      ).sort(),
      proprietary_names: stableUnique(
        listingRecords.flatMap((record) => stringArray(record.proprietary_name)),
        (value) => value,
      ).sort(),
      submission_numbers: submissions,
      records: registrationRecords.sort((left, right) =>
        (left.record_key ?? '').localeCompare(right.record_key ?? ''),
      ),
    },
    authorization: {
      search_completed: authorizationErrors.length === 0,
      finding,
      submission_numbers: exactNumbers,
      decision_dates: stableUnique(
        authorizationRecords.map(decisionDate).filter((value): value is string => Boolean(value)),
        (value) => value,
      ).sort(),
      records: authorizationRecordsCompact.sort((left, right) =>
        (left.submission_number ?? left.product_code ?? '').localeCompare(
          right.submission_number ?? right.product_code ?? '',
        ),
      ),
    },
    sources: sources.sort((left, right) => left.source_id.localeCompare(right.source_id)),
    dataset_snapshots: Object.fromEntries(
      [
        ...registrationLookups.map((row) => ['registrationlisting', row.lookup.datasetLastUpdated]),
        ...authorizationLookups.map((row) => [
          row.lookup.sourceUrl.includes('/510k') ? '510k' : 'pma',
          row.lookup.datasetLastUpdated,
        ]),
        ...classificationLookups.map((row) => ['classification', row.lookup.datasetLastUpdated]),
      ].sort(([left], [right]) => String(left).localeCompare(String(right))),
    ),
    metrics: allLookups.reduce((total, row) => addMetrics(total, row.metrics), {
      ...EMPTY_METRICS,
    }),
    query_errors: errors,
    query_issues: queryIssues,
  }
}

export function allKnownIdentifiers(
  product: CatalogProductInput,
  backlog: VerificationBacklogInput | null,
): string[] {
  return [...exactIdentifiersForProduct(product, backlog)].sort()
}
