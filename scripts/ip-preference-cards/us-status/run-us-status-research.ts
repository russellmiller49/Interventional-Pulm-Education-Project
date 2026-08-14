import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { formatJson } from '../format-json'
import { OpenFdaClient } from '../openfda/client'
import { loadOpenFdaLocalEnvironment } from '../openfda/env'
import { normalizeManufacturerName } from '../openfda/normalize'
import type { CatalogProductInput, VerificationBacklogInput } from '../openfda/types'
import {
  acquireSupplementalEvidence,
  acquireUdiEvidence,
  type SupplementalProductEvidence,
  type UdiAcquisitionResult,
  type UdiRecordEvidence,
} from './acquire-fda-evidence'
import {
  classifyUsStatusProposal,
  type ManufacturerFinding,
  type UsStatusClassificationInput,
} from './classification'
import {
  exactIdentifierMatchInExtractedText,
  type ManufacturerSourceManifest,
  type ManufacturerSourceManifestRow,
} from './fetch-manufacturer-sources'
import {
  isPortableOpenFdaRawCacheReference,
  usStatusEvidenceArtifactSchema,
  usStatusEvidenceProposalSchema,
  usStatusReviewRowSchema,
  usStatusRunSummarySchema,
  usStatusSourceManifestSchema,
  type UsStatusAuthorizationRecord,
  type UsStatusDatasetSnapshot,
  type UsStatusEvidenceArtifact,
  type UsStatusEvidenceProposal,
  type UsStatusEvidenceSource,
  type UsStatusInputHash,
  type UsStatusProposalCounts,
  type UsStatusRegistrationListingRecord,
  type UsStatusReviewRow,
  type UsStatusRunSummary,
  type UsStatusUdiConfiguration,
} from './proposal-schemas'
import { hiddenProductCohortManifestSchema } from './schemas'
import type { HiddenProductCohortRow } from './types'

const CATALOG_PATH = 'data/ip-preference-cards/generated/catalog-products.json'
const BACKLOG_PATH = 'data/ip-preference-cards/generated/verification-backlog.json'
const OUTPUT_ROOT = path.resolve('data/ip-preference-cards/research/us-status')
const CACHE_ROOT = 'local-data/ip-preference-cards/us-status'
const METHOD_VERSION = 'current-us-status-evidence-v1'

const catalogSchema = z
  .object({
    product_id: z.string(),
    manufacturer_id: z.string(),
    manufacturer: z.string().nullable(),
    product_name: z.string(),
    catalog_number: z.string().nullable(),
    alternate_ids: z.string().nullable(),
    gtin: z.string().nullable(),
    global_part_number: z.string().nullable(),
    reference_part_number: z.string().nullable(),
    brand_family: z.string().nullable().optional(),
    verification_status: z.string().nullable(),
    visibility_state: z.string(),
    product_kind: z.string().nullable(),
    primary_source_id: z.string().nullable(),
  })
  .passthrough()

const backlogSchema = z
  .object({
    product_id: z.string(),
    priority: z.string().nullable().optional(),
    procedures: z.string().nullable().optional(),
    roles: z.string().nullable().optional(),
    existing_gtin: z.string().nullable().optional(),
    suggested_primary_di: z.string().nullable().optional(),
    gudid_result: z.string().nullable().optional(),
    match_confidence: z.string().nullable().optional(),
    distribution_status: z.string().nullable().optional(),
    evidence_url: z.string().nullable().optional(),
  })
  .passthrough()

const selectionSchema = z
  .object({
    products: z.array(z.object({ product_id: z.string() }).passthrough()).min(1),
  })
  .passthrough()

interface CatalogRow extends CatalogProductInput {
  product_kind: string | null
  primary_source_id: string | null
}

interface ResearchCliOptions {
  snapshot: string
  cohortPath: string
  manufacturerSourceManifestPath: string
  outputDirectory: string
  selectionPath: string | null
  concurrency: number
  refresh: boolean
}

interface ManufacturerEvaluation {
  searchCompleted: boolean
  finding: ManufacturerFinding
  exactProductSourceConfirmed: boolean
  currentUsSourceConfirmed: boolean
  officialDiscontinuationConfirmed: boolean
  sources: UsStatusEvidenceSource[]
  sourceIds: string[]
}

interface ProductResearchResult {
  proposal: UsStatusEvidenceProposal
  metrics: {
    fdaApiRequests: number
    cacheHits: number
    cacheMisses: number
    retries: number
  }
  datasetSnapshots: Record<string, { asOf: string; retrievedAt: string }>
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function fileHash(filePath: string): Promise<string> {
  return sha256(await readFile(filePath))
}

function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('--snapshot must be a date in YYYY-MM-DD format.')
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('--snapshot must be a valid calendar date.')
  }
  return value
}

function valueAfter(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`)
  return value
}

export function parseResearchArgs(args: string[]): ResearchCliOptions {
  let snapshot: string | null = null
  let cohortPath: string | null = null
  let manufacturerSourceManifestPath: string | null = null
  let outputDirectory: string | null = null
  let selectionPath: string | null = null
  let concurrency = 3
  let refresh = false
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case '--snapshot':
        snapshot = validateDate(valueAfter(args, index, argument))
        index += 1
        break
      case '--cohort':
        cohortPath = valueAfter(args, index, argument)
        index += 1
        break
      case '--manufacturer-source-manifest':
        manufacturerSourceManifestPath = valueAfter(args, index, argument)
        index += 1
        break
      case '--output-dir':
        outputDirectory = valueAfter(args, index, argument)
        index += 1
        break
      case '--selection':
        selectionPath = valueAfter(args, index, argument)
        index += 1
        break
      case '--concurrency': {
        const parsed = Number(valueAfter(args, index, argument))
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
          throw new Error('--concurrency must be a positive integer.')
        }
        concurrency = Math.min(parsed, 8)
        index += 1
        break
      }
      case '--refresh':
        refresh = true
        break
      default:
        throw new Error(`Unknown option: ${argument}`)
    }
  }
  if (!snapshot) throw new Error('--snapshot is required.')
  if (!cohortPath) throw new Error('--cohort is required.')
  if (!manufacturerSourceManifestPath) {
    throw new Error('--manufacturer-source-manifest is required.')
  }
  if (!outputDirectory) throw new Error('--output-dir is required.')
  const resolvedOutput = path.resolve(outputDirectory)
  const datedRoot = path.resolve(OUTPUT_ROOT, snapshot)
  if (resolvedOutput !== datedRoot && !resolvedOutput.startsWith(`${datedRoot}${path.sep}`)) {
    throw new Error(
      `--output-dir must remain under data/ip-preference-cards/research/us-status/${snapshot}/.`,
    )
  }
  return {
    snapshot,
    cohortPath,
    manufacturerSourceManifestPath,
    outputDirectory: resolvedOutput,
    selectionPath,
    concurrency,
    refresh,
  }
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (direct) return direct[1]
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  const month = value.match(/^(\d{4}-\d{2})$/)
  if (month) return `${month[1]}-01`
  const year = value.match(/^(\d{4})$/)
  if (year) return `${year[1]}-01-01`
  return null
}

function safeDate(value: string | null | undefined, fallback: string): string {
  return dateOnly(value) ?? fallback
}

function sourceIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100)
}

function formulaSafe(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

function csvValue(value: unknown): string {
  const text = formulaSafe(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  return `${[
    columns.map(csvValue).join(','),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(',')),
  ].join('\n')}\n`
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporary = `${filePath}.${process.pid}.tmp`
  await writeFile(temporary, contents, { encoding: 'utf8', mode: 0o644 })
  await rename(temporary, filePath)
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

function exactManufacturerIdentifiers(product: HiddenProductCohortRow): string[] {
  return [
    ...new Set(
      [
        product.catalog_number,
        product.model_number,
        product.gtin_di,
        product.global_part_number,
        product.reference_part_number,
        ...product.alternate_ids,
      ].filter((value): value is string => Boolean(value?.trim())),
    ),
  ].sort()
}

async function evaluateManufacturerSources(
  product: HiddenProductCohortRow,
  manifest: ManufacturerSourceManifest,
  textCache: Map<string, Promise<string>>,
): Promise<ManufacturerEvaluation> {
  const canonicalManufacturer = normalizeManufacturerName(product.manufacturer)
  const rows = manifest.sources.filter(
    (row) =>
      product.source_ids.includes(row.catalog_source_id) &&
      canonicalManufacturer !== null &&
      normalizeManufacturerName(row.manufacturer) === canonicalManufacturer,
  )
  if (rows.length === 0) {
    return {
      searchCompleted: false,
      finding: 'not_searched',
      exactProductSourceConfirmed: false,
      currentUsSourceConfirmed: false,
      officialDiscontinuationConfirmed: false,
      sources: [],
      sourceIds: [],
    }
  }
  const identifiers = exactManufacturerIdentifiers(product)
  const sources: UsStatusEvidenceSource[] = []
  const evaluated: Array<{ row: ManufacturerSourceManifestRow; matches: string[] }> = []
  for (const [index, row] of rows.entries()) {
    let promise = textCache.get(row.text_cache_reference)
    if (!promise) {
      promise = readFile(row.text_cache_reference, 'utf8').catch(() => '')
      textCache.set(row.text_cache_reference, promise)
    }
    const searchableText = await promise
    const matches = identifiers.filter((identifier) =>
      exactIdentifierMatchInExtractedText(identifier, searchableText),
    )
    evaluated.push({ row, matches })
    const sourceId = `manufacturer:${product.product_id}:${sourceIdPart(row.catalog_source_id)}:${index + 1}`
    sources.push({
      source_id: sourceId,
      layer: 'manufacturer',
      source_type:
        /pdf/i.test(row.content_type) || /\.pdf(?:$|\?)/i.test(row.source_url)
          ? 'official_manufacturer_document'
          : 'official_manufacturer_page',
      endpoint: new URL(row.source_url).hostname,
      url: row.source_url,
      publisher: row.publisher,
      title: row.title,
      as_of_date: dateOnly(row.publication_or_revision_date),
      retrieved_at: row.retrieved_at,
      content_sha256: row.body_sha256,
      request_search: null,
      raw_cache_reference: null,
      identity_scope: matches.length > 0 ? 'exact_product' : 'family_or_proprietary_name',
      temporal_scope:
        row.current_status_signal === 'historical_only'
          ? 'historical'
          : row.current_status_signal === 'current_catalog_or_product_page'
            ? 'current'
            : 'undated',
      us_specific: row.us_specific,
      exact_identifier_text: matches,
      factual_summary: `${row.factual_summary} Limitation: ${row.limitations}`,
    })
  }
  const currentExactUs = evaluated.some(
    ({ row, matches }) =>
      row.http_ok &&
      row.current_status_signal === 'current_catalog_or_product_page' &&
      row.us_specific &&
      matches.length > 0,
  )
  const currentExactNonUs = evaluated.some(
    ({ row, matches }) =>
      row.http_ok &&
      row.current_status_signal === 'current_catalog_or_product_page' &&
      !row.us_specific &&
      matches.length > 0,
  )
  const familyCurrent = evaluated.some(
    ({ row }) => row.http_ok && row.current_status_signal !== 'historical_only',
  )
  const searchCompleted = rows.every((row) => row.retrieved_at && row.http_status > 0)
  const finding: ManufacturerFinding = currentExactUs
    ? 'current_exact_official_us_product'
    : currentExactNonUs
      ? 'current_non_us'
      : familyCurrent
        ? 'family_only_current'
        : searchCompleted
          ? 'no_result'
          : 'not_searched'
  return {
    searchCompleted,
    finding,
    exactProductSourceConfirmed: currentExactUs || currentExactNonUs,
    currentUsSourceConfirmed: currentExactUs,
    officialDiscontinuationConfirmed: false,
    sources: sources.sort((left, right) => left.source_id.localeCompare(right.source_id)),
    sourceIds: sources.map((source) => source.source_id).sort(),
  }
}

function recordKey(record: UdiRecordEvidence): string {
  return (
    record.record_key ?? record.public_device_record_key ?? record.primary_di ?? 'unknown-record'
  )
}

function cacheReferenceToken(reference: string): string {
  return sourceIdPart(reference.split('/').at(-1)?.split(':').at(-1) ?? reference)
}

function udiSourceId(
  productId: string,
  record: UdiRecordEvidence,
  rawCacheReference: string,
): string {
  return `openfda-udi:${productId}:${sourceIdPart(recordKey(record))}:response-${cacheReferenceToken(rawCacheReference)}`
}

export function buildUdiSources(
  productId: string,
  record: UdiRecordEvidence,
  datasetAsOf: string,
): UsStatusEvidenceSource[] {
  const key = recordKey(record)
  return record.response_provenance.map((provenance) => ({
    source_id: udiSourceId(productId, record, provenance.raw_cache_reference),
    layer: 'udi_distribution',
    source_type: 'official_fda_api',
    endpoint: 'device/udi',
    url: provenance.request_url,
    publisher: 'U.S. Food and Drug Administration',
    title: `GUDID device-identification record ${key}`,
    as_of_date: datasetAsOf,
    retrieved_at: provenance.retrieved_at,
    content_sha256: provenance.response_sha256,
    request_search: provenance.request_search,
    raw_cache_reference: provenance.raw_cache_reference,
    identity_scope: record.exact_identity ? 'exact_product' : 'family_or_proprietary_name',
    temporal_scope: 'current',
    us_specific: true,
    exact_identifier_text: [
      record.primary_di,
      record.catalog_number,
      record.version_or_model_number,
    ].filter((value): value is string => Boolean(value)),
    factual_summary: `Manufacturer-submitted UDI identity record; distribution status: ${record.commercial_distribution_status ?? 'unknown'}.`,
  }))
}

function distribution(value: string | null): 'in_distribution' | 'not_in_distribution' | 'unknown' {
  const normalized = value?.toLocaleLowerCase('en-US') ?? ''
  if (/not\s+in\s+commercial\s+distribution|discontinued|inactive|ended/.test(normalized)) {
    return 'not_in_distribution'
  }
  if (/^in\s+commercial\s+distribution$|^active$/.test(normalized)) {
    return 'in_distribution'
  }
  return 'unknown'
}

function quantity(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function matchBasis(
  record: UdiRecordEvidence,
  identityMethod: UdiAcquisitionResult['identity_match_method'],
  configurationType: 'primary' | 'package' | 'unit_of_use' | 'other',
): UsStatusUdiConfiguration['match_basis'] {
  if (configurationType !== 'primary') return 'package_configuration_of_exact_device'
  if (identityMethod === 'exact_primary_di_or_gtin') return 'exact_primary_di_or_gtin'
  if (identityMethod === 'exact_manufacturer_catalog_number') {
    return 'exact_manufacturer_catalog_number'
  }
  if (identityMethod === 'exact_manufacturer_model_number') {
    return 'exact_manufacturer_model_number'
  }
  if (identityMethod === 'exact_manufacturer_reference_number') {
    return 'exact_manufacturer_reference_number'
  }
  if (identityMethod === 'reviewed_manufacturer_alias_exact_identifier') {
    return 'reviewed_manufacturer_alias_exact_identifier'
  }
  if (record.catalog_number) return 'exact_manufacturer_catalog_number'
  return 'exact_manufacturer_model_number'
}

function udiConfigurations(
  productId: string,
  udi: UdiAcquisitionResult,
): UsStatusUdiConfiguration[] {
  const configurations: UsStatusUdiConfiguration[] = []
  for (const record of udi.records) {
    const key = recordKey(record)
    const sourceIds = record.response_provenance
      .map((provenance) => udiSourceId(productId, record, provenance.raw_cache_reference))
      .sort()
    const exactQuery = record.response_provenance[0]?.request_search ?? 'exact query unavailable'
    const base: Omit<
      UsStatusUdiConfiguration,
      | 'configuration_type'
      | 'package_di'
      | 'unit_of_use_di'
      | 'quantity_per_package'
      | 'package_status'
      | 'package_discontinue_date'
      | 'match_basis'
    > = {
      record_key: key,
      primary_di: record.primary_di,
      company_name: record.company_name,
      brand_name: record.brand_name,
      catalog_number: record.catalog_number,
      version_or_model_number: record.version_or_model_number,
      product_codes: record.product_codes.map((row) => row.code).sort(),
      premarket_submission_numbers: record.premarket_submissions
        .map((row) => row.submission_number)
        .sort(),
      commercial_distribution_status: distribution(record.commercial_distribution_status),
      commercial_distribution_end_date: dateOnly(record.commercial_distribution_end_date),
      record_status: record.record_status,
      exact_query: exactQuery,
      exact_identity: record.exact_identity,
      public_version_date: dateOnly(record.public_version_date),
      record_date: dateOnly(record.publish_date),
      source_ids: sourceIds,
    }
    configurations.push({
      ...base,
      configuration_type: 'primary',
      package_di: null,
      unit_of_use_di: null,
      quantity_per_package: null,
      package_status: null,
      package_discontinue_date: null,
      match_basis: matchBasis(record, udi.identity_match_method, 'primary'),
    })
    if (!record.exact_identity) continue
    for (const identifier of record.identifiers) {
      const normalizedType = identifier.type?.toLocaleLowerCase('en-US')
      if (normalizedType !== 'package' && !normalizedType?.includes('unit')) continue
      const configurationType = normalizedType === 'package' ? 'package' : 'unit_of_use'
      configurations.push({
        ...base,
        record_key: `${key}:${identifier.id}`,
        configuration_type: configurationType,
        package_di: configurationType === 'package' ? identifier.id : null,
        unit_of_use_di:
          configurationType === 'unit_of_use' ? identifier.id : identifier.unit_of_use_id,
        quantity_per_package: quantity(identifier.quantity_per_package),
        commercial_distribution_status: distribution(
          identifier.package_status ?? record.commercial_distribution_status,
        ),
        package_status: identifier.package_status,
        package_discontinue_date: dateOnly(identifier.package_discontinue_date),
        match_basis: matchBasis(record, udi.identity_match_method, configurationType),
      })
    }
  }
  return configurations.sort((left, right) => left.record_key.localeCompare(right.record_key))
}

function supplementalSources(
  productId: string,
  supplemental: SupplementalProductEvidence,
): UsStatusEvidenceSource[] {
  return supplemental.sources.map((source) => ({
    source_id: `${productId}:${source.source_id}`,
    layer:
      source.source_layer === 'registration_listing' ? 'registration_listing' : 'authorization',
    source_type: 'official_fda_api',
    endpoint: source.endpoint,
    url: source.source_url,
    publisher: source.publisher,
    title: source.title,
    as_of_date: dateOnly(source.dataset_as_of),
    retrieved_at: source.retrieved_at,
    content_sha256: source.response_sha256,
    request_search: source.exact_query,
    raw_cache_reference: source.raw_cache_reference,
    identity_scope:
      source.identity_scope === 'exact_product' ? 'exact_product' : 'family_or_proprietary_name',
    temporal_scope:
      source.current_or_historical === 'historical'
        ? 'historical'
        : source.current_or_historical === 'current'
          ? 'current'
          : 'undated',
    us_specific: true,
    exact_identifier_text: source.exact_query ? [source.exact_query] : [],
    factual_summary: `${source.match_basis}; authorization and listing are assessed separately from distribution.`,
  }))
}

function registrationRecords(
  productId: string,
  supplemental: SupplementalProductEvidence,
  fallbackDate: string,
): UsStatusRegistrationListingRecord[] {
  return supplemental.registration.records.map((record) => ({
    record_key: record.record_key,
    establishment_name: record.establishment_name,
    proprietary_name: record.proprietary_name,
    product_code: record.product_code,
    registration_number: record.registration_number,
    listing_identifiers: record.listing_identifiers,
    linked_submission_numbers: record.linked_submission_numbers,
    listing_status: record.listing_status,
    match_scope: record.match_scope,
    exact_query: record.exact_query,
    match_basis: record.match_basis,
    dataset_as_of_date: safeDate(record.dataset_as_of_date, fallbackDate),
    source_ids: record.source_ids.map((sourceId) => `${productId}:${sourceId}`).sort(),
  }))
}

function authorizationRecords(
  productId: string,
  supplemental: SupplementalProductEvidence,
  fallbackDate: string,
  udiSourceIds: string[],
): UsStatusAuthorizationRecord[] {
  return supplemental.authorization.records.map((record) => ({
    pathway: record.pathway,
    submission_number: record.submission_number,
    decision_or_exemption_status: record.decision_or_exemption_status,
    decision_date: dateOnly(record.decision_date),
    product_code: record.product_code,
    match_scope: record.match_scope,
    exact_query: record.exact_query,
    match_basis: record.match_basis,
    dataset_as_of_date: safeDate(record.dataset_as_of_date, fallbackDate),
    source_ids:
      record.source_ids.length > 0
        ? record.source_ids.map((sourceId) => `${productId}:${sourceId}`).sort()
        : record.pathway === 'premarket_exempt'
          ? [...udiSourceIds].sort()
          : [],
  }))
}

export function allSourcesTraceable(sources: UsStatusEvidenceSource[]): boolean {
  if (sources.length === 0) return false
  return sources.every((source) => {
    if (!source.url || !source.retrieved_at || source.content_sha256 === null) return false
    if (source.source_type !== 'official_fda_api') return true
    if (
      !source.request_search ||
      !source.raw_cache_reference ||
      !isPortableOpenFdaRawCacheReference(source.raw_cache_reference)
    ) {
      return false
    }
    try {
      return new URL(source.url).searchParams.get('search') === source.request_search
    } catch {
      return false
    }
  })
}

function mixedDistribution(configurations: UsStatusUdiConfiguration[]): boolean {
  return (
    new Set(
      configurations
        .filter((row) => row.exact_identity)
        .map((row) => row.commercial_distribution_status),
    ).size > 1
  )
}

function allExactConfigurationsEnded(configurations: UsStatusUdiConfiguration[]): boolean {
  const exactConfigurations = configurations.filter((row) => row.exact_identity)
  return (
    exactConfigurations.length > 0 &&
    exactConfigurations.every((row) => row.commercial_distribution_status === 'not_in_distribution')
  )
}

function rationale(
  state: UsStatusEvidenceProposal['research_state'],
  identityMethod: UsStatusEvidenceProposal['identity_match_method'],
  manufacturerFinding: ManufacturerFinding,
  udiAssessment: UsStatusEvidenceProposal['layer_results']['udi_distribution']['assessment'],
): string {
  const prefix = `Identity method: ${identityMethod}. UDI assessment: ${udiAssessment}. Manufacturer finding: ${manufacturerFinding}.`
  switch (state) {
    case 'current_us_distribution_supported':
      return `${prefix} Exact current FDA evidence and an exact current official manufacturer U.S. source passed the independent invariants; this is a review proposal only.`
    case 'not_currently_distributed_supported':
      return `${prefix} Every retrieved exact UDI configuration is ended and the completed manufacturer search found no conflicting current U.S. source; this remains a review proposal.`
    case 'historically_authorized_current_status_unresolved':
      return `${prefix} Marketing authorization is documented separately, but current U.S. distribution is unresolved.`
    case 'current_status_conflicted':
      if (
        manufacturerFinding === 'current_non_us' &&
        udiAssessment === 'all_exact_configurations_ended'
      ) {
        return `${prefix} An exact current non-U.S. manufacturer source has unresolved U.S. applicability against the ended exact UDI evidence, so a high-confidence negative is not supported.`
      }
      return `${prefix} Conflicting package, distribution, identity, or source evidence prevents a current-status conclusion.`
    case 'identity_unresolved':
      return `${prefix} Plausible records could not be tied conservatively to the exact catalog product.`
    case 'not_applicable_noncommercial_or_local':
      return `${prefix} The catalog row is explicitly a service or local/noncommercial concept rather than a national commercial SKU.`
    case 'insufficient_evidence':
      return `${prefix} Completed or permitted searches did not establish enough exact current-status evidence; no result is not a discontinuation finding.`
  }
}

function unresolvedQuestions(
  state: UsStatusEvidenceProposal['research_state'],
  manufacturerFinding: ManufacturerFinding,
): string[] {
  const questions: string[] = []
  if (state === 'identity_unresolved')
    questions.push('Can the manufacturer confirm the exact U.S. catalog/model identity?')
  if (state === 'current_status_conflicted')
    questions.push('Which exact package/configuration status is current in the United States?')
  if (state === 'historically_authorized_current_status_unresolved') {
    questions.push(
      'Is the historically authorized exact product currently distributed in the United States?',
    )
  }
  if (state === 'insufficient_evidence')
    questions.push(
      'Is there a current official U.S. product page, labeling document, or discontinuation notice for this exact identifier?',
    )
  if (manufacturerFinding === 'current_non_us') {
    questions.push(
      'Does the exact current global manufacturer listing apply to the United States despite the ended UDI evidence?',
    )
  }
  return [...new Set(questions)].sort()
}

async function researchProduct({
  cohortProduct,
  catalog,
  backlog,
  udiClient,
  supplementalClients,
  manufacturerManifest,
  textCache,
  snapshot,
  refresh,
}: {
  cohortProduct: HiddenProductCohortRow
  catalog: CatalogRow
  backlog: VerificationBacklogInput | null
  udiClient: OpenFdaClient
  supplementalClients: {
    registration: OpenFdaClient
    clearance: OpenFdaClient
    pma: OpenFdaClient
    classification: OpenFdaClient
  }
  manufacturerManifest: ManufacturerSourceManifest
  textCache: Map<string, Promise<string>>
  snapshot: string
  refresh: boolean
}): Promise<ProductResearchResult> {
  const udi = await acquireUdiEvidence({ product: catalog, backlog, client: udiClient, refresh })
  const supplemental = await acquireSupplementalEvidence({
    udi,
    clients: supplementalClients,
    refresh,
  })
  const manufacturer = await evaluateManufacturerSources(
    cohortProduct,
    manufacturerManifest,
    textCache,
  )
  const udiAsOf = udi.dataset_last_updated ?? snapshot
  const configs = udiConfigurations(cohortProduct.product_id, udi)
  const udiSources = udi.records.flatMap((record) =>
    buildUdiSources(cohortProduct.product_id, record, udiAsOf),
  )
  const otherFdaSources = supplementalSources(cohortProduct.product_id, supplemental)
  const sources = [...udiSources, ...otherFdaSources, ...manufacturer.sources].sort((left, right) =>
    left.source_id.localeCompare(right.source_id),
  )
  const packageConflict = mixedDistribution(configs)
  const officialDistributionConflict = packageConflict || supplemental.registration.conflict
  const currentNonUsApplicabilityConflict =
    manufacturer.finding === 'current_non_us' && allExactConfigurationsEnded(configs)
  const distributionConflict = officialDistributionConflict || currentNonUsApplicabilityConflict
  const conflicts = {
    identity: udi.identity_conflict,
    model: udi.model_conflict,
    manufacturer: udi.manufacturer_conflict,
    package_configuration: packageConflict,
    distribution: distributionConflict,
    discontinuation: false,
    details: [
      ...(udi.identity_conflict
        ? [
            {
              conflict_type: 'identity' as const,
              summary: 'Exact product identity remains ambiguous.',
              source_ids: udiSources.map((source) => source.source_id),
            },
          ]
        : []),
      ...(udi.model_conflict
        ? [
            {
              conflict_type: 'model' as const,
              summary: 'A candidate record has a different model or configuration.',
              source_ids: udiSources.map((source) => source.source_id),
            },
          ]
        : []),
      ...(udi.manufacturer_conflict
        ? [
            {
              conflict_type: 'manufacturer' as const,
              summary: 'The candidate company is outside the reviewed manufacturer alias group.',
              source_ids: udiSources.map((source) => source.source_id),
            },
          ]
        : []),
      ...(packageConflict
        ? [
            {
              conflict_type: 'package_configuration' as const,
              summary: 'Exact base/package configurations carry mixed distribution states.',
              source_ids: udiSources.map((source) => source.source_id),
            },
          ]
        : []),
      ...(officialDistributionConflict
        ? [
            {
              conflict_type: 'distribution' as const,
              summary: 'Official distribution or listing states conflict.',
              source_ids: sources
                .filter(
                  (source) =>
                    source.layer === 'udi_distribution' || source.layer === 'registration_listing',
                )
                .map((source) => source.source_id),
            },
          ]
        : []),
      ...(currentNonUsApplicabilityConflict
        ? [
            {
              conflict_type: 'distribution' as const,
              summary:
                'An exact current non-U.S. manufacturer source has unresolved U.S. applicability against ended exact UDI distribution evidence.',
              source_ids: [...udiSources, ...manufacturer.sources].map(
                (source) => source.source_id,
              ),
            },
          ]
        : []),
    ],
  }
  const classificationInput: UsStatusClassificationInput = {
    identity: { match_method: udi.identity_match_method, conflict: udi.identity_conflict },
    udi_distribution: {
      search_completed: udi.search_completed,
      snapshot_current: Boolean(udi.dataset_last_updated) || udi.search_completed,
      all_exact_configurations_retrieved: udi.all_exact_configurations_retrieved,
      configurations: udi.configurations,
    },
    registration_listing: supplemental.registration,
    authorization: supplemental.authorization,
    manufacturer: {
      search_completed: manufacturer.searchCompleted,
      finding: manufacturer.finding,
    },
    recall: { search_completed: false, finding: 'not_searched' },
    conflicts: {
      model: conflicts.model,
      manufacturer: conflicts.manufacturer,
      distribution: conflicts.distribution,
      discontinuation: conflicts.discontinuation,
    },
    independent_invariants: {
      adjacent_sku_excluded: udi.adjacent_sku_excluded,
      exact_configuration_inventory_complete: udi.all_exact_configurations_retrieved,
      package_levels_distinguished: true,
      evidence_packet_complete:
        udi.search_completed &&
        supplemental.registration.search_completed &&
        supplemental.authorization.search_completed &&
        manufacturer.searchCompleted,
      all_sources_traceable: allSourcesTraceable(sources),
      registration_authorization_separated: true,
      recall_excluded_from_distribution: true,
    },
    explicitly_noncommercial_or_local:
      catalog.product_kind === 'Service' ||
      /^custom[\s_-]*service$/i.test(catalog.catalog_number ?? ''),
  }
  const classified = classifyUsStatusProposal(classificationInput)
  const queryIssues = [
    ...udi.queries.flatMap((query) =>
      query.error
        ? [
            {
              layer: 'udi_distribution' as const,
              endpoint: 'device/udi',
              exact_query: query.search,
              message: query.error,
            },
          ]
        : [],
    ),
    ...supplemental.query_issues,
  ]
  const queryErrors = queryIssues.map((issue, index) => ({
    layer: issue.layer,
    endpoint: issue.endpoint,
    exact_query: issue.exact_query,
    error_code:
      issue.message === 'result_set_truncated'
        ? 'result_set_truncated'
        : `external_query_error_${index + 1}`,
    message: issue.message,
    retryable: false,
    attempt_count: 1,
    occurred_at: `${snapshot}T00:00:00.000Z`,
  }))
  const proposal: UsStatusEvidenceProposal = {
    canonical_identity: {
      product_id: cohortProduct.product_id,
      manufacturer_id: cohortProduct.manufacturer_id,
      manufacturer: cohortProduct.manufacturer,
      product_name: cohortProduct.product_name,
      catalog_number: cohortProduct.catalog_number,
      model_number: cohortProduct.model_number,
      gtin_di: cohortProduct.gtin_di,
      global_part_number: cohortProduct.global_part_number,
      reference_part_number: cohortProduct.reference_part_number,
      alternate_ids: cohortProduct.alternate_ids,
    },
    canonical_context: {
      verification_grade: cohortProduct.verification_grade,
      visibility_state: 'hidden',
      cohort_partition: cohortProduct.cohort_partition,
      identifier_completeness: cohortProduct.identifier_completeness,
      mapped_roles: cohortProduct.mapped_roles,
      authored_slot_use_count: cohortProduct.authored_slot_use_count,
      selectable_slot_use_count: cohortProduct.selectable_slot_use_count,
      authored_procedure_codes: cohortProduct.authored_procedure_codes,
      role_mapped_procedure_codes: cohortProduct.role_mapped_procedure_codes,
      source_count: cohortProduct.source_count,
    },
    research_state: classified.research_state,
    confidence: classified.confidence,
    identity_match_method: udi.identity_match_method,
    layer_results: {
      udi_distribution: {
        search_completed: udi.search_completed,
        snapshot_current: classificationInput.udi_distribution.snapshot_current,
        all_exact_configurations_retrieved: udi.all_exact_configurations_retrieved,
        assessment: classified.layer_assessments.udi_distribution,
        configurations: configs,
      },
      registration_listing: {
        search_completed: supplemental.registration.search_completed,
        snapshot_current: supplemental.registration.snapshot_current,
        assessment: classified.layer_assessments.registration_listing,
        match_scope: supplemental.registration.match_scope,
        listing_status: supplemental.registration.listing_status,
        establishment_registration_current:
          supplemental.registration.establishment_registration_current,
        conflict: supplemental.registration.conflict,
        records: registrationRecords(cohortProduct.product_id, supplemental, snapshot),
      },
      authorization: {
        search_completed: supplemental.authorization.search_completed,
        finding: classified.layer_assessments.authorization,
        records: authorizationRecords(
          cohortProduct.product_id,
          supplemental,
          snapshot,
          udiSources.map((source) => source.source_id),
        ),
      },
      manufacturer: {
        search_completed: manufacturer.searchCompleted,
        finding: manufacturer.finding,
        exact_product_source_confirmed: manufacturer.exactProductSourceConfirmed,
        current_us_source_confirmed: manufacturer.currentUsSourceConfirmed,
        official_discontinuation_confirmed: manufacturer.officialDiscontinuationConfirmed,
        source_ids: manufacturer.sourceIds,
      },
      recall: {
        search_completed: false,
        finding: 'not_searched',
        excluded_from_distribution_assessment: true,
        records: [],
      },
    },
    sources,
    conflicts,
    reason_codes: classified.reason_codes,
    rationale: rationale(
      classified.research_state,
      udi.identity_match_method,
      manufacturer.finding,
      classified.layer_assessments.udi_distribution,
    ),
    unresolved_questions: unresolvedQuestions(classified.research_state, manufacturer.finding),
    proposed_human_review_disposition: classified.proposed_human_review_disposition,
    invariant_audit: classified.invariant_audit,
    query_error: { present: queryErrors.length > 0, errors: queryErrors },
    canonical_change_applied: false,
  }
  const parsed = usStatusEvidenceProposalSchema.parse(proposal)
  const datasetSnapshots: ProductResearchResult['datasetSnapshots'] = {}
  if (udi.dataset_last_updated) {
    datasetSnapshots.udi = {
      asOf: udi.dataset_last_updated,
      retrievedAt:
        udi.records.flatMap((record) => record.retrieved_at).sort()[0] ??
        `${snapshot}T00:00:00.000Z`,
    }
  }
  for (const [dataset, asOf] of Object.entries(supplemental.dataset_snapshots)) {
    if (!asOf) continue
    datasetSnapshots[dataset] = {
      asOf,
      retrievedAt:
        otherFdaSources.find((source) => source.endpoint.includes(dataset))?.retrieved_at ??
        `${snapshot}T00:00:00.000Z`,
    }
  }
  return {
    proposal: parsed,
    metrics: {
      fdaApiRequests: udi.metrics.apiRequests + supplemental.metrics.apiRequests,
      cacheHits: udi.metrics.cacheHits + supplemental.metrics.cacheHits,
      cacheMisses: udi.metrics.cacheMisses + supplemental.metrics.cacheMisses,
      retries: udi.metrics.retries + supplemental.metrics.retries,
    },
    datasetSnapshots,
  }
}

function proposalCounts(products: UsStatusEvidenceProposal[]): UsStatusProposalCounts {
  const state = (value: UsStatusEvidenceProposal['research_state']) =>
    products.filter((product) => product.research_state === value).length
  const confidence = (value: UsStatusEvidenceProposal['confidence']) =>
    products.filter((product) => product.confidence === value).length
  return {
    product_count: products.length,
    research_state_counts: {
      current_us_distribution_supported: state('current_us_distribution_supported'),
      not_currently_distributed_supported: state('not_currently_distributed_supported'),
      historically_authorized_current_status_unresolved: state(
        'historically_authorized_current_status_unresolved',
      ),
      current_status_conflicted: state('current_status_conflicted'),
      identity_unresolved: state('identity_unresolved'),
      insufficient_evidence: state('insufficient_evidence'),
      not_applicable_noncommercial_or_local: state('not_applicable_noncommercial_or_local'),
    },
    confidence_counts: {
      high: confidence('high'),
      moderate: confidence('moderate'),
      low: confidence('low'),
    },
    query_error_product_count: products.filter((product) => product.query_error.present).length,
    source_record_count: products.reduce((total, product) => total + product.sources.length, 0),
    udi_configuration_count: products.reduce(
      (total, product) => total + product.layer_results.udi_distribution.configurations.length,
      0,
    ),
    conflicted_product_count: products.filter((product) =>
      Object.entries(product.conflicts).some(([key, value]) => key !== 'details' && value === true),
    ).length,
  }
}

function inputHashes(entries: Array<[string, string, string]>): UsStatusInputHash[] {
  return entries
    .map(([input_id, inputPath, hash]) => ({ input_id, path: inputPath, sha256: hash }))
    .sort((left, right) => left.input_id.localeCompare(right.input_id))
}

function datasetSnapshots(
  results: ProductResearchResult[],
  manufacturerManifest: ManufacturerSourceManifest,
  snapshot: string,
): UsStatusDatasetSnapshot[] {
  const fda = new Map<string, { asOf: string; retrievedAt: string }>()
  for (const result of results) {
    for (const [id, value] of Object.entries(result.datasetSnapshots)) {
      const current = fda.get(id)
      if (!current || value.asOf > current.asOf) fda.set(id, value)
    }
  }
  const rows: UsStatusDatasetSnapshot[] = [...fda.entries()].map(([id, value]) => ({
    dataset_id: `openfda-${id}`,
    layer:
      id === 'udi'
        ? 'udi_distribution'
        : id === 'registrationlisting'
          ? 'registration_listing'
          : id === 'classification'
            ? 'authorization'
            : 'authorization',
    endpoint: `https://api.fda.gov/device/${id}.json`,
    as_of_date: safeDate(value.asOf, snapshot),
    last_updated_at: null,
    retrieved_at: value.retrievedAt,
    content_sha256: null,
    record_count: null,
  }))
  for (const row of manufacturerManifest.sources) {
    rows.push({
      dataset_id: `manufacturer-${sha256(row.source_url).slice(0, 16)}-${sourceIdPart(row.catalog_source_id)}`,
      layer: 'manufacturer',
      endpoint: row.source_url,
      as_of_date: dateOnly(row.publication_or_revision_date) ?? snapshot,
      last_updated_at: null,
      retrieved_at: row.retrieved_at,
      content_sha256: row.body_sha256,
      record_count: 1,
    })
  }
  return rows.sort((left, right) => left.dataset_id.localeCompare(right.dataset_id))
}

function reviewRow(product: UsStatusEvidenceProposal): UsStatusReviewRow {
  const conflicts = product.conflicts.details.map((detail) => detail.summary).sort()
  return usStatusReviewRowSchema.parse({
    product_id: product.canonical_identity.product_id,
    manufacturer: product.canonical_identity.manufacturer,
    product_name: product.canonical_identity.product_name,
    catalog_number: product.canonical_identity.catalog_number,
    model_number: product.canonical_identity.model_number,
    research_state: product.research_state,
    confidence: product.confidence,
    identity_match_method: product.identity_match_method,
    rationale: product.rationale,
    official_fda_evidence_summary: `UDI: ${product.layer_results.udi_distribution.assessment}; listing: ${product.layer_results.registration_listing.assessment}; authorization: ${product.layer_results.authorization.finding}.`,
    official_manufacturer_evidence_summary: `Manufacturer finding: ${product.layer_results.manufacturer.finding}; exact source: ${product.layer_results.manufacturer.exact_product_source_confirmed}.`,
    conflicts,
    source_links: product.sources.map((source) => ({
      source_id: source.source_id,
      layer: source.layer,
      url: source.url,
      as_of_date: source.as_of_date,
      retrieved_at: source.retrieved_at,
    })),
    proposed_human_review_disposition: product.proposed_human_review_disposition,
    reviewer_decision: 'pending',
    reviewer_rationale: null,
    second_review: { required: product.confidence === 'high', decision: null, rationale: null },
    canonical_change_applied: false,
  })
}

function flatCsvRow(product: UsStatusEvidenceProposal): Record<string, unknown> {
  return {
    product_id: product.canonical_identity.product_id,
    manufacturer: product.canonical_identity.manufacturer,
    product_name: product.canonical_identity.product_name,
    catalog_number: product.canonical_identity.catalog_number,
    model_number: product.canonical_identity.model_number,
    research_state: product.research_state,
    confidence: product.confidence,
    identity_match_method: product.identity_match_method,
    udi_assessment: product.layer_results.udi_distribution.assessment,
    listing_assessment: product.layer_results.registration_listing.assessment,
    authorization_finding: product.layer_results.authorization.finding,
    manufacturer_finding: product.layer_results.manufacturer.finding,
    conflict_flags: product.conflicts.details.map((detail) => detail.conflict_type).join('|'),
    rationale: product.rationale,
    unresolved_questions: product.unresolved_questions.join('|'),
    proposed_human_review_disposition: product.proposed_human_review_disposition,
    source_urls: product.sources.map((source) => source.url).join('|'),
    canonical_change_applied: false,
  }
}

const CSV_COLUMNS = [
  'product_id',
  'manufacturer',
  'product_name',
  'catalog_number',
  'model_number',
  'research_state',
  'confidence',
  'identity_match_method',
  'udi_assessment',
  'listing_assessment',
  'authorization_finding',
  'manufacturer_finding',
  'conflict_flags',
  'rationale',
  'unresolved_questions',
  'proposed_human_review_disposition',
  'source_urls',
  'canonical_change_applied',
]

function methodology(artifact: UsStatusEvidenceArtifact): string {
  const counts = artifact.counts.research_state_counts
  return `# Current U.S. status evidence methodology\n\nThis dated research package is proposal-only. It changes no canonical product, visibility, verification, selectability, role, compatibility, formulary, release, or feature-flag data.\n\n## Cohort\n\nThe package evaluates ${artifact.counts.product_count} products selected from the deterministic hidden-product manifest. Hidden verified-source products are current-U.S.-status pending; hidden candidate and unknown products remain identity/specification pending.\n\n## Evidence hierarchy\n\nExact identity is required before a current-status conclusion. UDI/GUDID distribution, registration/listing, marketing authorization or exemption, official manufacturer U.S. evidence, and recall context remain separate layers. A registration/listing is not approval, historical authorization is not current distribution, and a recall is not discontinuation evidence. Website absence is never a negative finding.\n\nPotential positive proposals require exact identity, current official FDA distribution or exact listing evidence, an exact current official manufacturer U.S. source, no unresolved conflict, and a passing independent invariant audit. Potential negatives require affirmative exact evidence, completed manufacturer research, no current conflict, and the same independent audit.\n\n## Results\n\n- current U.S. distribution supported: ${counts.current_us_distribution_supported}\n- not currently distributed supported: ${counts.not_currently_distributed_supported}\n- historically authorized, current status unresolved: ${counts.historically_authorized_current_status_unresolved}\n- current status conflicted: ${counts.current_status_conflicted}\n- identity unresolved: ${counts.identity_unresolved}\n- insufficient evidence: ${counts.insufficient_evidence}\n- not applicable noncommercial/local: ${counts.not_applicable_noncommercial_or_local}\n- products with query errors: ${artifact.counts.query_error_product_count}\n\nEvery output row has \`canonical_change_applied: false\`. The clinician-review CSV contains blank reviewer and second-review fields and has no applying importer or endpoint.\n`
}

async function preserveInitialExecutionOnCacheReplay(
  runSummaryPath: string,
  candidate: UsStatusRunSummary,
): Promise<UsStatusRunSummary> {
  try {
    const existing = usStatusRunSummarySchema.parse(
      JSON.parse(await readFile(runSummaryPath, 'utf8')),
    )
    const stableIdentityMatches =
      existing.method_version === candidate.method_version &&
      existing.research_as_of_date === candidate.research_as_of_date &&
      existing.proposal_artifact_sha256 === candidate.proposal_artifact_sha256 &&
      existing.source_manifest_sha256 === candidate.source_manifest_sha256 &&
      JSON.stringify(existing.input_hashes) === JSON.stringify(candidate.input_hashes) &&
      JSON.stringify(existing.dataset_snapshots) === JSON.stringify(candidate.dataset_snapshots) &&
      JSON.stringify(existing.counts) === JSON.stringify(candidate.counts)
    return stableIdentityMatches ? { ...candidate, execution: existing.execution } : candidate
  } catch {
    return candidate
  }
}

export async function runUsStatusResearch(options: ResearchCliOptions): Promise<void> {
  const startedAt = new Date().toISOString()
  const outputProposalPath = path.join(options.outputDirectory, 'us-status-evidence-proposals.json')
  if (options.refresh) {
    try {
      await readFile(outputProposalPath)
      throw new Error(
        'Refusing to refresh an existing dated proposal snapshot; choose a new snapshot/output directory.',
      )
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Refusing')) throw error
    }
  }
  const [cohortText, catalogText, backlogText, manufacturerText] = await Promise.all([
    readFile(options.cohortPath, 'utf8'),
    readFile(CATALOG_PATH, 'utf8'),
    readFile(BACKLOG_PATH, 'utf8'),
    readFile(options.manufacturerSourceManifestPath, 'utf8'),
  ])
  const cohort = hiddenProductCohortManifestSchema.parse(JSON.parse(cohortText))
  const catalogRows = z.array(catalogSchema).parse(JSON.parse(catalogText)) as CatalogRow[]
  const backlogRows = z
    .array(backlogSchema)
    .parse(JSON.parse(backlogText)) as VerificationBacklogInput[]
  const manufacturerManifest = JSON.parse(manufacturerText) as ManufacturerSourceManifest
  const selectionIds = options.selectionPath
    ? new Set(
        selectionSchema
          .parse(JSON.parse(await readFile(options.selectionPath, 'utf8')))
          .products.map((row) => row.product_id),
      )
    : null
  const selected = cohort.products.filter(
    (product) => !selectionIds || selectionIds.has(product.product_id),
  )
  if (selectionIds && selected.length !== selectionIds.size) {
    throw new Error('Selection references a product outside the deterministic hidden cohort.')
  }
  const catalogById = new Map(catalogRows.map((row) => [row.product_id, row]))
  const backlogById = new Map(backlogRows.map((row) => [row.product_id, row]))
  loadOpenFdaLocalEnvironment()
  const apiKey = process.env.OPENFDA_API_KEY?.trim() ?? ''
  if (!apiKey)
    throw new Error('OPENFDA_API_KEY is required and must remain in ignored local configuration.')
  const cacheRoot = path.join(CACHE_ROOT, options.snapshot, 'openfda')
  const cacheReferenceRoot = `${CACHE_ROOT}/${options.snapshot}/openfda`
  const clientOptions = {
    apiKey,
    // Five endpoint-specific clients share the process. Capping each at 0.5 RPS keeps the
    // aggregate worst-case rate below the existing three-request-per-second safety target.
    requestsPerSecond: 0.5,
    maxAttempts: 5,
    timeoutMs: 30_000,
  }
  const udiClient = new OpenFdaClient({
    ...clientOptions,
    cacheDir: path.join(cacheRoot, 'udi'),
    cacheReferencePrefix: `${cacheReferenceRoot}/udi`,
  })
  const supplementalClients = {
    registration: new OpenFdaClient({
      ...clientOptions,
      cacheDir: path.join(cacheRoot, 'registrationlisting'),
      cacheReferencePrefix: `${cacheReferenceRoot}/registrationlisting`,
      endpoint: 'https://api.fda.gov/device/registrationlisting.json',
      apiSchemaVersion: 'device-registrationlisting-v1',
    }),
    clearance: new OpenFdaClient({
      ...clientOptions,
      cacheDir: path.join(cacheRoot, '510k'),
      cacheReferencePrefix: `${cacheReferenceRoot}/510k`,
      endpoint: 'https://api.fda.gov/device/510k.json',
      apiSchemaVersion: 'device-510k-v1',
    }),
    pma: new OpenFdaClient({
      ...clientOptions,
      cacheDir: path.join(cacheRoot, 'pma'),
      cacheReferencePrefix: `${cacheReferenceRoot}/pma`,
      endpoint: 'https://api.fda.gov/device/pma.json',
      apiSchemaVersion: 'device-pma-v1',
    }),
    classification: new OpenFdaClient({
      ...clientOptions,
      cacheDir: path.join(cacheRoot, 'classification'),
      cacheReferencePrefix: `${cacheReferenceRoot}/classification`,
      endpoint: 'https://api.fda.gov/device/classification.json',
      apiSchemaVersion: 'device-classification-v1',
    }),
  }
  const textCache = new Map<string, Promise<string>>()
  const results = await mapWithConcurrency(
    selected,
    options.concurrency,
    async (cohortProduct, index) => {
      const catalog = catalogById.get(cohortProduct.product_id)
      if (!catalog) throw new Error(`Missing catalog row ${cohortProduct.product_id}.`)
      const result = await researchProduct({
        cohortProduct,
        catalog,
        backlog: backlogById.get(cohortProduct.product_id) ?? null,
        udiClient,
        supplementalClients,
        manufacturerManifest,
        textCache,
        snapshot: options.snapshot,
        refresh: options.refresh,
      })
      if ((index + 1) % 50 === 0 || index + 1 === selected.length) {
        console.log(`Processed ${index + 1}/${selected.length} current-status research products.`)
      }
      return result
    },
  )
  const products = results
    .map((result) => result.proposal)
    .sort((left, right) =>
      left.canonical_identity.product_id.localeCompare(right.canonical_identity.product_id),
    )
  const hashes = inputHashes([
    ['catalog-products', CATALOG_PATH, sha256(catalogText)],
    ['cohort-manifest', options.cohortPath, sha256(cohortText)],
    [
      'manufacturer-source-manifest',
      options.manufacturerSourceManifestPath,
      sha256(manufacturerText),
    ],
    ['verification-backlog-stale-context', BACKLOG_PATH, sha256(backlogText)],
  ])
  const snapshots = datasetSnapshots(results, manufacturerManifest, options.snapshot)
  const counts = proposalCounts(products)
  const artifact = usStatusEvidenceArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'current_us_status_evidence_proposals',
    method_version: METHOD_VERSION,
    research_as_of_date: options.snapshot,
    input_hashes: hashes,
    dataset_snapshots: snapshots,
    counts,
    products,
    canonical_change_applied: false,
  })
  const proposalJson = await formatJson(artifact)
  if (proposalJson.includes(apiKey)) throw new Error('Secret-safety assertion failed.')

  const uniqueSources = new Map<string, UsStatusEvidenceSource>()
  for (const product of products) {
    for (const source of product.sources) uniqueSources.set(source.source_id, source)
  }
  const sourceManifest = usStatusSourceManifestSchema.parse({
    format_version: 1,
    artifact_kind: 'current_us_status_source_manifest',
    method_version: METHOD_VERSION,
    research_as_of_date: options.snapshot,
    input_hashes: hashes,
    dataset_snapshots: snapshots,
    source_count: uniqueSources.size,
    sources: [...uniqueSources.values()].sort((left, right) =>
      left.source_id.localeCompare(right.source_id),
    ),
    canonical_change_applied: false,
  })
  const sourceJson = await formatJson(sourceManifest)
  const completedAt = new Date().toISOString()
  const candidateRunSummary = usStatusRunSummarySchema.parse({
    format_version: 1,
    artifact_kind: 'current_us_status_run_summary',
    method_version: METHOD_VERSION,
    research_as_of_date: options.snapshot,
    proposal_artifact_sha256: sha256(proposalJson),
    source_manifest_sha256: sha256(sourceJson),
    input_hashes: hashes,
    dataset_snapshots: snapshots,
    counts,
    execution: {
      products_requested: selected.length,
      products_processed: products.length,
      fda_api_requests: results.reduce((total, result) => total + result.metrics.fdaApiRequests, 0),
      manufacturer_requests: manufacturerManifest.unique_url_count,
      cache_hits: results.reduce((total, result) => total + result.metrics.cacheHits, 0),
      cache_misses: results.reduce((total, result) => total + result.metrics.cacheMisses, 0),
      retry_count: results.reduce((total, result) => total + result.metrics.retries, 0),
      query_error_count: products.reduce(
        (total, product) => total + product.query_error.errors.length,
        0,
      ),
      started_at: startedAt,
      completed_at: completedAt,
      raw_cache_committed: false,
    },
    canonical_change_applied: false,
  })
  const runSummaryPath = path.join(options.outputDirectory, 'run-summary.json')
  const runSummary = await preserveInitialExecutionOnCacheReplay(
    runSummaryPath,
    candidateRunSummary,
  )
  const reviews = products.map(reviewRow)
  const reviewColumns = [
    'product_id',
    'manufacturer',
    'product_name',
    'catalog_number',
    'model_number',
    'research_state',
    'confidence',
    'identity_match_method',
    'rationale',
    'official_fda_evidence_summary',
    'official_manufacturer_evidence_summary',
    'conflicts',
    'source_links',
    'proposed_human_review_disposition',
    'reviewer_decision',
    'reviewer_rationale',
    'second_review_required',
    'second_review_decision',
    'second_review_rationale',
    'canonical_change_applied',
  ]
  const reviewCsv = csv(
    reviews.map((review) => ({
      ...review,
      conflicts: review.conflicts.join('|'),
      source_links: review.source_links.map((source) => source.url).join('|'),
      second_review_required: review.second_review.required,
      second_review_decision: review.second_review.decision,
      second_review_rationale: review.second_review.rationale,
    })),
    reviewColumns,
  )
  const csvOutputs: Array<[string, UsStatusEvidenceProposal['research_state'] | 'query_error']> = [
    ['current-us-supported.csv', 'current_us_distribution_supported'],
    ['not-current-supported.csv', 'not_currently_distributed_supported'],
    ['historical-authorization-only.csv', 'historically_authorized_current_status_unresolved'],
    ['conflicts.csv', 'current_status_conflicted'],
    ['identity-unresolved.csv', 'identity_unresolved'],
    ['insufficient-evidence.csv', 'insufficient_evidence'],
    ['noncommercial-or-local.csv', 'not_applicable_noncommercial_or_local'],
    ['query-errors.csv', 'query_error'],
  ]
  await mkdir(options.outputDirectory, { recursive: true })
  await Promise.all([
    atomicWrite(outputProposalPath, proposalJson),
    atomicWrite(path.join(options.outputDirectory, 'source-manifest.json'), sourceJson),
    atomicWrite(runSummaryPath, await formatJson(runSummary)),
    atomicWrite(path.join(options.outputDirectory, 'methodology.md'), methodology(artifact)),
    atomicWrite(path.join(options.outputDirectory, 'clinician-review.csv'), reviewCsv),
    ...csvOutputs.map(([filename, state]) =>
      atomicWrite(
        path.join(options.outputDirectory, filename),
        csv(
          products
            .filter((product) =>
              state === 'query_error'
                ? product.query_error.present
                : product.research_state === state,
            )
            .map(flatCsvRow),
          CSV_COLUMNS,
        ),
      ),
    ),
  ])
  const catalogHashAfter = await fileHash(CATALOG_PATH)
  if (catalogHashAfter !== hashes.find((entry) => entry.input_id === 'catalog-products')?.sha256) {
    throw new Error('Canonical catalog changed during research; outputs must not be used.')
  }
  console.log(await formatJson(runSummary))
}

async function main(): Promise<void> {
  await runUsStatusResearch(parseResearchArgs(process.argv.slice(2)))
}

if (process.argv[1]?.endsWith('run-us-status-research.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
