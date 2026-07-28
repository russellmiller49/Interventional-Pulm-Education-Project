import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { z } from 'zod'

import { formatJson } from '../format-json'
import { computeOpenFdaCacheKey } from './client'
import { escapeCsvValue } from './csv'
import { loadOpenFdaLocalEnvironment } from './env'
import { getOpenFdaManufacturerAliasGroup, manufacturerMatchesAlias } from './manufacturer-aliases'
import { exactIdentifierComparison } from './normalize'
import {
  openFdaCacheEntrySchema,
  openFdaEnrichmentProposalsSchema,
  openFdaRunSummarySchema,
} from './schemas'
import type {
  CatalogProductInput,
  OpenFdaEnrichmentProposal,
  OpenFdaRecord,
  OpenFdaRunSummary,
  VerificationBacklogInput,
} from './types'

const execFileAsync = promisify(execFile)

const COHORT_PATH = 'data/ip-preference-cards/seed/openfda-calibration-cohort.json'
const CATALOG_PATH = 'data/ip-preference-cards/generated/catalog-products.json'
const BACKLOG_PATH = 'data/ip-preference-cards/generated/verification-backlog.json'
const FORMULARY_PATH = 'data/ip-preference-cards/generated/hospital-formulary-staging.json'
const WORKBOOK_PATH =
  'Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx'
const CALIBRATION_DIRECTORY = 'data/ip-preference-cards/generated/openfda/calibration'
const CACHE_DIRECTORY = 'local-data/ip-preference-cards/openfda/cache'

const BASELINE_HASHES: Record<string, string> = {
  [CATALOG_PATH]: '1948f00c20f673dfbe2092bde6315c78ca02b8cb5f3f1e308e33c223175861fe',
  [BACKLOG_PATH]: '25ab658850a5df620986d4596d5043f40e46d17132493dd62d7adaffc36c1b38',
  [FORMULARY_PATH]: 'f8ceb2433694f7ef1d5f65a6e4533fa6c2b1f83659d6ba017abda5fda4908e73',
  [WORKBOOK_PATH]: 'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
}

const CHALLENGE_CATEGORIES = [
  'existing_exact_di_or_gtin',
  'catalog_with_suggested_gudid',
  'catalog_without_existing_di',
  'package_level_ambiguity',
  'legacy_or_distribution_question',
  'manufacturer_alias_complexity',
  'insufficient_identifiers',
] as const

const EXPECTED_CATEGORY_COUNTS: Record<(typeof CHALLENGE_CATEGORIES)[number], number> = {
  existing_exact_di_or_gtin: 5,
  catalog_with_suggested_gudid: 5,
  catalog_without_existing_di: 5,
  package_level_ambiguity: 4,
  legacy_or_distribution_question: 3,
  manufacturer_alias_complexity: 2,
  insufficient_identifiers: 1,
}

const cohortEntrySchema = z
  .object({
    product_id: z.string().min(1),
    reason_selected: z.string().min(1),
    expected_challenge_category: z.enum(CHALLENGE_CATEGORIES),
    current_catalog_number: z.string().min(1),
    current_manufacturer: z.string().min(1),
    existing_di_candidate: z.boolean(),
  })
  .strict()

const cohortSchema = z
  .object({
    format_version: z.literal(1),
    selection_method: z.string().min(1),
    products: z.array(cohortEntrySchema).length(25),
  })
  .strict()
  .superRefine((cohort, context) => {
    const ids = cohort.products.map((entry) => entry.product_id)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Calibration cohort product IDs must be unique.',
      })
    }
    for (const category of CHALLENGE_CATEGORIES) {
      const actual = cohort.products.filter(
        (entry) => entry.expected_challenge_category === category,
      ).length
      if (actual !== EXPECTED_CATEGORY_COUNTS[category]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${category} must contain ${EXPECTED_CATEGORY_COUNTS[category]} products; received ${actual}.`,
        })
      }
    }
  })

type CalibrationCohort = z.infer<typeof cohortSchema>
const catalogProductSchema = z
  .object({
    product_id: z.string().min(1),
    manufacturer_id: z.string().min(1),
    manufacturer: z.string().nullable(),
    product_name: z.string().min(1),
    catalog_number: z.string().nullable(),
    alternate_ids: z.string().nullable(),
    gtin: z.string().nullable(),
    global_part_number: z.string().nullable(),
    reference_part_number: z.string().nullable(),
    verification_status: z.string().nullable(),
    visibility_state: z.string(),
  })
  .passthrough()

const backlogSchema = z
  .object({
    product_id: z.string().min(1),
    existing_gtin: z.string().nullable().optional(),
    suggested_primary_di: z.string().nullable().optional(),
    distribution_status: z.string().nullable().optional(),
    evidence_url: z.string().nullable().optional(),
  })
  .passthrough()

const AUDIT_COLUMNS = [
  'product_id',
  'canonical_manufacturer',
  'canonical_product_name',
  'canonical_catalog_number',
  'existing_or_suggested_di',
  'classification',
  'selected_candidate_company',
  'selected_candidate_brand',
  'candidate_catalog_number',
  'candidate_model',
  'proposed_primary_di',
  'candidate_count',
  'commercial_distribution_status',
  'public_version_date',
  'query_stage',
  'reason_codes',
  'backlog_comparison',
  'evidence_link_or_record_key',
  'human_review_decision',
  'reviewer_notes',
] as const

type AuditColumn = (typeof AUDIT_COLUMNS)[number]
type AuditRow = Record<AuditColumn, string | number | null>

const RETAINED_RECORD_FIELDS = new Set([
  'record_key',
  'public_device_record_key',
  'brand_name',
  'company_name',
  'catalog_number',
  'version_or_model_number',
  'device_description',
  'device_count_in_base_package',
  'device_sizes',
  'identifiers',
  'commercial_distribution_status',
  'commercial_distribution_end_date',
  'is_kit',
  'is_single_use',
  'sterilization',
  'storage',
  'has_expiration_date',
  'has_lot_or_batch_number',
  'has_manufacturing_date',
  'has_serial_number',
  'mri_safety',
  'product_codes',
  'premarket_submissions',
  'gmdn_terms',
  'publish_date',
  'public_version_date',
  'public_version_number',
  'public_version_status',
  'record_status',
])

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown
}

function valueShape(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function tally(values: string[]): Record<string, number> {
  return Object.fromEntries(
    [
      ...values.reduce((counts, value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1)
        return counts
      }, new Map<string, number>()),
    ].sort(
      ([leftName, leftCount], [rightName, rightCount]) =>
        rightCount - leftCount || leftName.localeCompare(rightName),
    ),
  )
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Number(((numerator / denominator) * 100).toFixed(1))
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function evidenceReference(
  proposal: OpenFdaEnrichmentProposal,
  backlog: VerificationBacklogInput | null,
): string | null {
  if (proposal.proposed_fields.primary_di) {
    return `https://accessgudid.nlm.nih.gov/devices/${encodeURIComponent(
      proposal.proposed_fields.primary_di,
    )}`
  }
  return (
    backlog?.evidence_url ??
    proposal.selected_candidate?.public_device_record_key ??
    proposal.selected_candidate?.record_key ??
    null
  )
}

function buildAuditRows(
  cohort: CalibrationCohort,
  productsById: Map<string, CatalogProductInput>,
  backlogById: Map<string, VerificationBacklogInput>,
  proposalsById: Map<string, OpenFdaEnrichmentProposal>,
): AuditRow[] {
  return cohort.products.map((entry) => {
    const product = productsById.get(entry.product_id)
    const proposal = proposalsById.get(entry.product_id)
    const backlog = backlogById.get(entry.product_id) ?? null
    if (!product || !proposal) {
      throw new Error(`Missing calibration input or proposal for ${entry.product_id}.`)
    }
    return {
      product_id: product.product_id,
      canonical_manufacturer: product.manufacturer,
      canonical_product_name: product.product_name,
      canonical_catalog_number: product.catalog_number,
      existing_or_suggested_di:
        product.gtin ?? backlog?.existing_gtin ?? backlog?.suggested_primary_di ?? null,
      classification: proposal.classification,
      selected_candidate_company: proposal.selected_candidate?.company_name ?? null,
      selected_candidate_brand: proposal.selected_candidate?.brand_name ?? null,
      candidate_catalog_number: proposal.selected_candidate?.catalog_number ?? null,
      candidate_model: proposal.selected_candidate?.version_or_model_number ?? null,
      proposed_primary_di: proposal.proposed_fields.primary_di,
      candidate_count: proposal.candidate_count,
      commercial_distribution_status: proposal.proposed_fields.commercial_distribution_status,
      public_version_date: proposal.proposed_fields.public_version_date,
      query_stage: proposal.selected_candidate?.query_kinds.join('|') ?? null,
      reason_codes: proposal.reason_codes.join('|'),
      backlog_comparison: proposal.backlog_comparison,
      evidence_link_or_record_key: evidenceReference(proposal, backlog),
      human_review_decision: '',
      reviewer_notes: '',
    }
  })
}

function auditRowsToCsv(rows: AuditRow[]): string {
  return `${[
    AUDIT_COLUMNS.map(escapeCsvValue).join(','),
    ...rows.map((row) => AUDIT_COLUMNS.map((column) => escapeCsvValue(row[column])).join(',')),
  ].join('\n')}\n`
}

function markdownValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function auditRowsToMarkdown(rows: AuditRow[]): string {
  const header = `| ${AUDIT_COLUMNS.join(' | ')} |`
  const divider = `| ${AUDIT_COLUMNS.map(() => '---').join(' | ')} |`
  const body = rows.map(
    (row) => `| ${AUDIT_COLUMNS.map((column) => markdownValue(row[column])).join(' | ')} |`,
  )
  return `${[
    '# openFDA 25-product calibration audit',
    '',
    'The last two columns are intentionally blank for external human review. This file is not an acceptance or catalog-write mechanism.',
    '',
    header,
    divider,
    ...body,
    '',
  ].join('\n')}`
}

function requestsForProposal(proposal: OpenFdaEnrichmentProposal): number {
  return proposal.query_attempts.reduce(
    (total, attempt) => total + (attempt.cache_hit ? 0 : attempt.attempt_count),
    0,
  )
}

function queryAttemptMetrics(proposals: OpenFdaEnrichmentProposal[]) {
  const requestsPerProduct = proposals.map(requestsForProposal)
  const attempts = proposals.flatMap((proposal) => proposal.query_attempts)
  return {
    query_attempts: attempts.length,
    api_requests: requestsPerProduct.reduce((total, requests) => total + requests, 0),
    cache_hits: attempts.filter((attempt) => attempt.cache_hit).length,
    retries: attempts.reduce(
      (total, attempt) => total + (attempt.cache_hit ? 0 : Math.max(0, attempt.attempt_count - 1)),
      0,
    ),
    timeouts: attempts.filter((attempt) =>
      attempt.error?.toLocaleLowerCase('en-US').includes('timed out'),
    ).length,
    query_errors: attempts.filter((attempt) => attempt.error).length,
    median_api_requests_per_product: median(requestsPerProduct),
    maximum_api_requests_per_product: Math.max(0, ...requestsPerProduct),
  }
}

function exactCatalogMatch(
  product: CatalogProductInput,
  proposal: OpenFdaEnrichmentProposal,
): boolean {
  const canonical = exactIdentifierComparison(product.catalog_number)
  const candidate = exactIdentifierComparison(proposal.selected_candidate?.catalog_number)
  return Boolean(canonical && candidate && canonical === candidate)
}

function manufacturerAliasMatch(
  product: CatalogProductInput,
  proposal: OpenFdaEnrichmentProposal,
): boolean {
  return manufacturerMatchesAlias(
    proposal.selected_candidate?.company_name,
    getOpenFdaManufacturerAliasGroup(product.manufacturer_id, product.manufacturer),
  )
}

function classificationCounts(proposals: OpenFdaEnrichmentProposal[]) {
  return {
    high_confidence: proposals.filter(
      (proposal) => proposal.classification === 'high_confidence_candidate',
    ).length,
    review_required: proposals.filter((proposal) => proposal.classification === 'review_required')
      .length,
    unmatched: proposals.filter((proposal) => proposal.classification === 'unmatched').length,
    insufficient_identifiers: proposals.filter(
      (proposal) => proposal.classification === 'insufficient_identifiers',
    ).length,
    query_error: proposals.filter((proposal) => proposal.classification === 'query_error').length,
  }
}

function buildCalibrationMetrics({
  cohort,
  productsById,
  initialProposals,
  remediationProposals,
  postfilterProposals,
  finalProposals,
  cachedProposals,
  initialSummary,
  remediationSummary,
  postfilterSummary,
  finalSummary,
  cachedSummary,
  refreshSummary,
  deterministicBytesEqual,
  deterministicSha256,
}: {
  cohort: CalibrationCohort
  productsById: Map<string, CatalogProductInput>
  initialProposals: OpenFdaEnrichmentProposal[]
  remediationProposals: OpenFdaEnrichmentProposal[]
  postfilterProposals: OpenFdaEnrichmentProposal[]
  finalProposals: OpenFdaEnrichmentProposal[]
  cachedProposals: OpenFdaEnrichmentProposal[]
  initialSummary: OpenFdaRunSummary
  remediationSummary: OpenFdaRunSummary
  postfilterSummary: OpenFdaRunSummary
  finalSummary: OpenFdaRunSummary
  cachedSummary: OpenFdaRunSummary
  refreshSummary: OpenFdaRunSummary
  deterministicBytesEqual: boolean
  deterministicSha256: string
}) {
  const proposalById = new Map(finalProposals.map((proposal) => [proposal.product_id, proposal]))
  const selected = finalProposals.filter((proposal) => proposal.selected_candidate)
  const exactCatalogMatches = selected.filter((proposal) =>
    exactCatalogMatch(productsById.get(proposal.product_id)!, proposal),
  ).length
  const aliasMatches = selected.filter((proposal) =>
    manufacturerAliasMatch(productsById.get(proposal.product_id)!, proposal),
  ).length
  const cacheableQueryProducts = cachedProposals.filter(
    (proposal) => proposal.query_attempts.length > 0,
  )
  const cachedAttempts = cachedProposals.flatMap((proposal) => proposal.query_attempts)
  const byChallenge = Object.fromEntries(
    CHALLENGE_CATEGORIES.map((category) => {
      const proposals = cohort.products
        .filter((entry) => entry.expected_challenge_category === category)
        .map((entry) => proposalById.get(entry.product_id)!)
      return [
        category,
        {
          products: proposals.length,
          ...classificationCounts(proposals),
          multiple_candidate_records: proposals.filter((proposal) => proposal.candidate_count > 1)
            .length,
          backlog_agreements: proposals.filter(
            (proposal) => proposal.backlog_comparison === 'agrees_with_existing_backlog',
          ).length,
        },
      ]
    }),
  )

  return {
    format_version: 1,
    cohort_product_count: cohort.products.length,
    final_classifications: classificationCounts(finalProposals),
    backlog_agreement_count: finalProposals.filter(
      (proposal) => proposal.backlog_comparison === 'agrees_with_existing_backlog',
    ).length,
    di_conflict_count: finalProposals.filter(
      (proposal) => proposal.backlog_comparison === 'conflicts_with_existing_di',
    ).length,
    distribution_status_conflict_count: finalProposals.filter(
      (proposal) => proposal.backlog_comparison === 'conflicts_with_distribution_status',
    ).length,
    exact_catalog_number_match: {
      matches: exactCatalogMatches,
      selected_candidate_denominator: selected.length,
      rate_percent: rate(exactCatalogMatches, selected.length),
    },
    manufacturer_alias_match: {
      matches: aliasMatches,
      selected_candidate_denominator: selected.length,
      rate_percent: rate(aliasMatches, selected.length),
    },
    products_with_multiple_candidate_records: finalProposals.filter(
      (proposal) => proposal.candidate_count > 1,
    ).length,
    products_requiring_package_level_resolution: cohort.products.filter(
      (entry) =>
        entry.expected_challenge_category === 'package_level_ambiguity' &&
        proposalById.get(entry.product_id)!.candidate_count > 1,
    ).length,
    high_confidence_invariant_demotions: finalProposals
      .filter((proposal) => proposal.reason_codes.includes('high_confidence_invariant_failed'))
      .map((proposal) => proposal.product_id),
    runs: {
      initial_live: {
        summary: initialSummary,
        request_metrics: queryAttemptMetrics(initialProposals),
      },
      remediation_live: {
        summary: remediationSummary,
        request_metrics: queryAttemptMetrics(remediationProposals),
      },
      exact_filter_remediation_live: {
        summary: postfilterSummary,
        request_metrics: queryAttemptMetrics(postfilterProposals),
      },
      final_from_populated_cache: {
        summary: finalSummary,
        request_metrics: queryAttemptMetrics(finalProposals),
      },
      immediate_cached_rerun: {
        summary: cachedSummary,
        request_metrics: queryAttemptMetrics(cachedProposals),
        queryable_products: cacheableQueryProducts.length,
        cache_reuse_rate_percent: rate(
          cachedAttempts.filter((attempt) => attempt.cache_hit).length,
          cachedAttempts.length,
        ),
      },
      targeted_refresh: {
        summary: refreshSummary,
        refresh_product_limit: 3,
      },
      total_live_api_requests_before_cached_proof:
        initialSummary.api_requests_made +
        remediationSummary.api_requests_made +
        postfilterSummary.api_requests_made,
    },
    deterministic_proposal_output: {
      byte_for_byte_equal: deterministicBytesEqual,
      sha256: deterministicSha256,
      excluded_runtime_metadata: [],
    },
    by_expected_challenge_category: byChallenge,
  }
}

function recordIdentity(record: OpenFdaRecord): string {
  return record.public_device_record_key ?? record.record_key ?? sha256(JSON.stringify(record))
}

async function loadFinalCacheRecords(proposals: OpenFdaEnrichmentProposal[]): Promise<{
  cacheEntries: number
  records: OpenFdaRecord[]
}> {
  const cacheFiles = new Set<string>()
  for (const proposal of proposals) {
    for (const attempt of proposal.query_attempts) {
      const key = computeOpenFdaCacheKey({
        search: attempt.search,
        limit: attempt.limit,
      })
      cacheFiles.add(path.join(CACHE_DIRECTORY, `${key}.json`))
    }
  }
  const records = new Map<string, OpenFdaRecord>()
  let cacheEntries = 0
  for (const cacheFile of [...cacheFiles].sort()) {
    const parsed = openFdaCacheEntrySchema.parse(await readJson(cacheFile))
    cacheEntries += 1
    for (const record of parsed.response.results) {
      records.set(recordIdentity(record), record)
    }
  }
  return { cacheEntries, records: [...records.values()] }
}

function fieldAudit(records: OpenFdaRecord[]) {
  const fields = new Set(records.flatMap((record) => Object.keys(record)))
  return Object.fromEntries(
    [...fields].sort().map((field) => {
      const values = records
        .filter((record) => Object.hasOwn(record, field))
        .map((record) => record[field])
      return [
        field,
        {
          present: values.length,
          missing: records.length - values.length,
          shapes: tally(values.map(valueShape)),
        },
      ]
    }),
  )
}

function identifierAudit(records: OpenFdaRecord[]) {
  const identifiers = records.flatMap((record) => record.identifiers ?? [])
  const fields = new Set(identifiers.flatMap((identifier) => Object.keys(identifier)))
  return {
    identifier_count: identifiers.length,
    fields: Object.fromEntries(
      [...fields].sort().map((field) => {
        const values = identifiers
          .filter((identifier) => Object.hasOwn(identifier, field))
          .map((identifier) => identifier[field])
        return [
          field,
          {
            present: values.length,
            missing: identifiers.length - values.length,
            shapes: tally(values.map(valueShape)),
          },
        ]
      }),
    ),
    identifier_types: tally(identifiers.map((identifier) => identifier.type ?? '(missing)')),
    package_types: tally(
      identifiers
        .filter((identifier) => identifier.type?.toLocaleLowerCase('en-US') === 'package')
        .map((identifier) => identifier.package_type ?? '(missing)'),
    ),
    package_statuses: tally(
      identifiers
        .filter((identifier) => identifier.type?.toLocaleLowerCase('en-US') === 'package')
        .map((identifier) => identifier.package_status ?? '(missing)'),
    ),
  }
}

function buildSchemaAudit(cacheEntries: number, records: OpenFdaRecord[]) {
  const fields = fieldAudit(records)
  const consistentlyPresent = Object.entries(fields)
    .filter(([, value]) => value.missing === 0)
    .map(([field]) => field)
  const commonlyMissing = Object.entries(fields)
    .filter(([, value]) => value.missing > 0)
    .sort(
      ([leftName, left], [rightName, right]) =>
        right.missing - left.missing || leftName.localeCompare(rightName),
    )
    .map(([field, value]) => ({
      field,
      missing: value.missing,
      present: value.present,
    }))
  return {
    format_version: 1,
    validated_cache_entries: cacheEntries,
    deduplicated_record_count: records.length,
    schema_parse_failures: 0,
    malformed_records: 0,
    consistently_present_fields: consistentlyPresent,
    commonly_missing_fields: commonlyMissing,
    field_shapes: fields,
    additional_passthrough_fields: [...new Set(records.flatMap(Object.keys))]
      .filter((field) => !RETAINED_RECORD_FIELDS.has(field))
      .sort(),
    retained_field_shape_anomalies: [],
    identifiers: identifierAudit(records),
    company_name_variations: tally(records.map((record) => record.company_name ?? '(missing)')),
    model_number_behavior: {
      present: records.filter((record) => Object.hasOwn(record, 'version_or_model_number')).length,
      missing: records.filter((record) => !Object.hasOwn(record, 'version_or_model_number')).length,
      blank: records.filter((record) => record.version_or_model_number?.trim() === '').length,
      distinct_non_blank: new Set(
        records
          .map((record) => record.version_or_model_number?.trim())
          .filter((value): value is string => Boolean(value)),
      ).size,
    },
    distribution_status_values: tally(
      records.map((record) => record.commercial_distribution_status ?? '(missing)'),
    ),
    package_level_observations: {
      records_with_package_identifier: records.filter((record) =>
        record.identifiers?.some(
          (identifier) => identifier.type?.toLocaleLowerCase('en-US') === 'package',
        ),
      ).length,
      records_with_multiple_identifiers: records.filter(
        (record) => (record.identifiers?.length ?? 0) > 1,
      ).length,
    },
  }
}

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.csv',
  '.env.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.scss',
  '.sh',
  '.sql',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])

async function secretScan(): Promise<{
  text_files_scanned: number
  matches: number
}> {
  const apiKey = process.env.OPENFDA_API_KEY?.trim() ?? ''
  if (!apiKey) {
    throw new Error('OPENFDA_API_KEY must already be present for the calibration secret scan.')
  }
  const { stdout } = await execFileAsync('git', [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
  ])
  const candidates = stdout
    .split('\n')
    .filter(Boolean)
    .filter((file) => {
      const extension = path.extname(file)
      return (
        TEXT_EXTENSIONS.has(extension) ||
        path.basename(file) === '.env.example' ||
        path.basename(file) === '.gitignore'
      )
    })
  let matches = 0
  for (const file of candidates) {
    try {
      if ((await readFile(file, 'utf8')).includes(apiKey)) matches += 1
    } catch {
      // A concurrently removed untracked file cannot contain a committed secret.
    }
  }
  return { text_files_scanned: candidates.length, matches }
}

async function findZipFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) return findZipFiles(entryPath)
        return entry.name.toLocaleLowerCase('en-US').endsWith('.zip') ? [entryPath] : []
      }),
    )
    return nested.flat()
  } catch {
    return []
  }
}

async function buildSafetyVerification() {
  const protectedFiles = await Promise.all(
    Object.entries(BASELINE_HASHES).map(async ([file, before]) => {
      const after = sha256(await readFile(file))
      return { file, before, after, unchanged: before === after }
    }),
  )
  const secret = await secretScan()
  if (protectedFiles.some((entry) => !entry.unchanged) || secret.matches > 0) {
    throw new Error('Calibration safety verification failed.')
  }
  const { stdout: trackedCache } = await execFileAsync('git', [
    'ls-files',
    'local-data/ip-preference-cards/openfda',
  ])
  const bulkZipFiles = [
    ...(await findZipFiles('data/ip-preference-cards/openfda-bulk')),
    ...(await findZipFiles('local-data/ip-preference-cards/openfda/bulk')),
  ]
  return {
    format_version: 1,
    protected_files: protectedFiles,
    api_key_secret_scan: secret,
    tracked_raw_cache_files: trackedCache.split('\n').filter(Boolean),
    bulk_zip_files: bulkZipFiles,
    canonical_fields_applied: false,
    source_workbook_modified: false,
  }
}

async function loadRun(directory: string) {
  const [summary, proposals, proposalBytes] = await Promise.all([
    openFdaRunSummarySchema.parseAsync(await readJson(path.join(directory, 'run-summary.json'))),
    openFdaEnrichmentProposalsSchema.parseAsync(
      await readJson(path.join(directory, 'enrichment-proposals.json')),
    ),
    readFile(path.join(directory, 'enrichment-proposals.json'), 'utf8'),
  ])
  return { summary, proposals, proposalBytes }
}

export async function generateCalibrationAudit(): Promise<void> {
  loadOpenFdaLocalEnvironment()
  const [cohort, products, backlog, initial, remediation, postfilter, finalRun, cached, refresh] =
    await Promise.all([
      cohortSchema.parseAsync(await readJson(COHORT_PATH)),
      z.array(catalogProductSchema).parseAsync(await readJson(CATALOG_PATH)) as Promise<
        CatalogProductInput[]
      >,
      z.array(backlogSchema).parseAsync(await readJson(BACKLOG_PATH)) as Promise<
        VerificationBacklogInput[]
      >,
      loadRun(path.join(CALIBRATION_DIRECTORY, 'initial')),
      loadRun(path.join(CALIBRATION_DIRECTORY, 'live')),
      loadRun(path.join(CALIBRATION_DIRECTORY, 'postfilter')),
      loadRun(path.join(CALIBRATION_DIRECTORY, 'final')),
      loadRun(path.join(CALIBRATION_DIRECTORY, 'cached')),
      loadRun(path.join(CALIBRATION_DIRECTORY, 'refresh')),
    ])
  const productsById = new Map(products.map((product) => [product.product_id, product]))
  const backlogById = new Map(backlog.map((entry) => [entry.product_id, entry]))
  const finalProposalsById = new Map(
    finalRun.proposals.map((proposal) => [proposal.product_id, proposal]),
  )
  for (const entry of cohort.products) {
    const product = productsById.get(entry.product_id)
    const backlogEntry = backlogById.get(entry.product_id)
    if (
      !product ||
      product.catalog_number !== entry.current_catalog_number ||
      product.manufacturer !== entry.current_manufacturer
    ) {
      throw new Error(`Calibration cohort drift detected for ${entry.product_id}.`)
    }
    const hasExistingDi = Boolean(
      product.gtin || backlogEntry?.existing_gtin || backlogEntry?.suggested_primary_di,
    )
    if (hasExistingDi !== entry.existing_di_candidate) {
      throw new Error(`Calibration cohort DI evidence drift detected for ${entry.product_id}.`)
    }
  }
  if (refresh.summary.products_processed > 3) {
    throw new Error('Targeted refresh exceeded the three-product safety limit.')
  }

  const auditRows = buildAuditRows(cohort, productsById, backlogById, finalProposalsById)
  const deterministicBytesEqual = finalRun.proposalBytes === cached.proposalBytes
  if (!deterministicBytesEqual) {
    throw new Error('Final and cached calibration proposal outputs are not byte-for-byte equal.')
  }
  const deterministicSha256 = sha256(finalRun.proposalBytes)
  const metrics = buildCalibrationMetrics({
    cohort,
    productsById,
    initialProposals: initial.proposals,
    remediationProposals: remediation.proposals,
    postfilterProposals: postfilter.proposals,
    finalProposals: finalRun.proposals,
    cachedProposals: cached.proposals,
    initialSummary: initial.summary,
    remediationSummary: remediation.summary,
    postfilterSummary: postfilter.summary,
    finalSummary: finalRun.summary,
    cachedSummary: cached.summary,
    refreshSummary: refresh.summary,
    deterministicBytesEqual,
    deterministicSha256,
  })
  const { cacheEntries, records } = await loadFinalCacheRecords(finalRun.proposals)
  const schemaAudit = buildSchemaAudit(cacheEntries, records)
  const safetyVerification = await buildSafetyVerification()
  await mkdir(CALIBRATION_DIRECTORY, { recursive: true })
  await Promise.all([
    writeFile(path.join(CALIBRATION_DIRECTORY, 'audit.csv'), auditRowsToCsv(auditRows), 'utf8'),
    writeFile(path.join(CALIBRATION_DIRECTORY, 'audit.md'), auditRowsToMarkdown(auditRows), 'utf8'),
    writeFile(path.join(CALIBRATION_DIRECTORY, 'metrics.json'), await formatJson(metrics), 'utf8'),
    writeFile(
      path.join(CALIBRATION_DIRECTORY, 'schema-audit.json'),
      await formatJson(schemaAudit),
      'utf8',
    ),
    writeFile(
      path.join(CALIBRATION_DIRECTORY, 'safety-verification.json'),
      await formatJson(safetyVerification),
      'utf8',
    ),
  ])
  console.log(
    await formatJson({
      cohort_products: cohort.products.length,
      audit_rows: auditRows.length,
      deterministic_proposals_sha256: deterministicSha256,
      schema_records_audited: records.length,
      protected_files_unchanged: safetyVerification.protected_files.every(
        (entry) => entry.unchanged,
      ),
      secret_matches: safetyVerification.api_key_secret_scan.matches,
    }),
  )
}

async function main() {
  await generateCalibrationAudit()
}

if (process.argv[1]?.endsWith('generate-calibration-audit.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
