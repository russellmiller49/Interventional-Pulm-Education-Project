import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { formatJson } from '../format-json'
import { mergeOpenFdaCandidates } from './classify-match'
import { OpenFdaClient, OpenFdaClientError } from './client'
import { writeOpenFdaCsvReports } from './csv'
import { loadOpenFdaLocalEnvironment } from './env'
import { getOpenFdaManufacturerAliasGroup } from './manufacturer-aliases'
import { normalizeManufacturerName } from './normalize'
import { buildOpenFdaEnrichmentProposal, stableSortOpenFdaProposals } from './proposals'
import { buildOpenFdaQueryPlan, filterOpenFdaRecordsForQuery } from './query-plan'
import { openFdaEnrichmentProposalsSchema, openFdaRunSummarySchema } from './schemas'
import {
  OPENFDA_ENDPOINT,
  type CatalogProductInput,
  type OpenFdaEnrichmentProposal,
  type OpenFdaMatchedCandidate,
  type OpenFdaQueryAttemptSummary,
  type OpenFdaRunSummary,
  type VerificationBacklogInput,
} from './types'

const DEFAULT_CATALOG_PATH = 'data/ip-preference-cards/generated/catalog-products.json'
const DEFAULT_MANUFACTURERS_PATH = 'data/ip-preference-cards/generated/manufacturers.json'
const DEFAULT_BACKLOG_PATH = 'data/ip-preference-cards/generated/verification-backlog.json'
const DEFAULT_OUTPUT_DIRECTORY = 'data/ip-preference-cards/generated/openfda'
const DEFAULT_CACHE_DIRECTORY = 'local-data/ip-preference-cards/openfda/cache'
const ALLOWED_OUTPUT_ROOT = path.resolve(DEFAULT_OUTPUT_DIRECTORY)

const nullableString = z.string().nullable()

const catalogProductSchema = z
  .object({
    product_id: z.string().min(1),
    manufacturer_id: z.string().min(1),
    manufacturer: nullableString,
    product_name: z.string().min(1),
    catalog_number: nullableString,
    alternate_ids: nullableString,
    gtin: nullableString,
    global_part_number: nullableString,
    reference_part_number: nullableString,
    brand_family: nullableString.optional(),
    verification_status: nullableString,
    visibility_state: z.string(),
  })
  .passthrough()

const backlogSchema = z
  .object({
    product_id: z.string().min(1),
    priority: nullableString.optional(),
    procedures: nullableString.optional(),
    roles: nullableString.optional(),
    existing_gtin: nullableString.optional(),
    suggested_primary_di: nullableString.optional(),
    gudid_result: nullableString.optional(),
    match_confidence: nullableString.optional(),
    distribution_status: nullableString.optional(),
    evidence_url: nullableString.optional(),
  })
  .passthrough()

const manufacturersSchema = z.array(
  z
    .object({
      manufacturer_id: z.string().min(1),
      manufacturer: z.string().min(1),
    })
    .passthrough(),
)

const cohortSelectionSchema = z
  .object({
    products: z
      .array(
        z
          .object({
            product_id: z.string().min(1),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough()

export interface OpenFdaQueryCliOptions {
  productId: string | null
  manufacturer: string | null
  productLimit: number | null
  priority: string | null
  refresh: boolean
  exhaustive: boolean
  dryRun: boolean
  concurrency: number
  cohortPath: string | null
  outputDirectory: string
  anonymous: boolean
}

function argumentValue(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`)
  }
  return value
}

function positiveInteger(value: string, option: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${option} must be a positive integer.`)
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer.`)
  }
  return parsed
}

export function parseOpenFdaQueryArgs(args: string[]): OpenFdaQueryCliOptions {
  const options: OpenFdaQueryCliOptions = {
    productId: null,
    manufacturer: null,
    productLimit: null,
    priority: null,
    refresh: false,
    exhaustive: false,
    dryRun: false,
    concurrency: 3,
    cohortPath: null,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
    anonymous: false,
  }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case '--product-id':
        options.productId = argumentValue(args, index, argument)
        index += 1
        break
      case '--manufacturer':
        options.manufacturer = argumentValue(args, index, argument)
        index += 1
        break
      case '--limit':
        options.productLimit = positiveInteger(argumentValue(args, index, argument), argument)
        index += 1
        break
      case '--priority':
        options.priority = argumentValue(args, index, argument)
        index += 1
        break
      case '--concurrency':
        options.concurrency = Math.min(
          10,
          positiveInteger(argumentValue(args, index, argument), argument),
        )
        index += 1
        break
      case '--cohort':
        options.cohortPath = argumentValue(args, index, argument)
        index += 1
        break
      case '--output-dir':
        options.outputDirectory = argumentValue(args, index, argument)
        index += 1
        break
      case '--refresh':
        options.refresh = true
        break
      case '--exhaustive':
        options.exhaustive = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--anonymous':
        options.anonymous = true
        break
      default:
        throw new Error(`Unknown option: ${argument}`)
    }
  }
  return options
}

function environmentNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`)
  }
  return value
}

async function fileSha256(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex')
}

async function loadInputs() {
  const [catalogText, manufacturersText, backlogText] = await Promise.all([
    readFile(DEFAULT_CATALOG_PATH, 'utf8'),
    readFile(DEFAULT_MANUFACTURERS_PATH, 'utf8'),
    readFile(DEFAULT_BACKLOG_PATH, 'utf8'),
  ])
  return {
    products: z.array(catalogProductSchema).parse(JSON.parse(catalogText)) as CatalogProductInput[],
    manufacturers: manufacturersSchema.parse(JSON.parse(manufacturersText)),
    backlog: z.array(backlogSchema).parse(JSON.parse(backlogText)) as VerificationBacklogInput[],
  }
}

async function loadCohortProductIds(cohortPath: string | null): Promise<string[] | null> {
  if (!cohortPath) return null
  const cohort = cohortSelectionSchema.parse(
    JSON.parse(await readFile(cohortPath, 'utf8')) as unknown,
  )
  const productIds = cohort.products.map((row) => row.product_id)
  if (new Set(productIds).size !== productIds.length) {
    throw new Error(`Calibration cohort ${cohortPath} contains duplicate product IDs.`)
  }
  return productIds
}

function validatedOutputDirectory(outputDirectory: string): string {
  const resolved = path.resolve(outputDirectory)
  if (
    resolved !== ALLOWED_OUTPUT_ROOT &&
    !resolved.startsWith(`${ALLOWED_OUTPUT_ROOT}${path.sep}`)
  ) {
    throw new Error(
      `openFDA output must remain under ${DEFAULT_OUTPUT_DIRECTORY}; received ${outputDirectory}.`,
    )
  }
  return resolved
}

function selectProducts(
  products: CatalogProductInput[],
  backlogByProduct: Map<string, VerificationBacklogInput>,
  options: OpenFdaQueryCliOptions,
  cohortProductIds: string[] | null,
): CatalogProductInput[] {
  const manufacturerFilter = normalizeManufacturerName(options.manufacturer)
  const productsById = new Map(products.map((product) => [product.product_id, product]))
  let selected = (
    cohortProductIds
      ? cohortProductIds.map((productId) => {
          const product = productsById.get(productId)
          if (!product) {
            throw new Error(`Calibration cohort references unknown product ${productId}.`)
          }
          return product
        })
      : [...products].sort((left, right) => left.product_id.localeCompare(right.product_id))
  )
    .filter((product) => !options.productId || product.product_id === options.productId)
    .filter((product) => {
      if (!manufacturerFilter) return true
      return normalizeManufacturerName(product.manufacturer)?.includes(manufacturerFilter) ?? false
    })
    .filter((product) => {
      if (!options.priority) return true
      return (
        backlogByProduct.get(product.product_id)?.priority?.toLocaleLowerCase('en-US') ===
        options.priority.toLocaleLowerCase('en-US')
      )
    })
  if (options.productLimit !== null) selected = selected.slice(0, options.productLimit)
  if (selected.length === 0) {
    throw new Error('No catalog products match the requested filters.')
  }
  return selected
}

interface ProductEnrichmentResult {
  proposal: OpenFdaEnrichmentProposal
  allRequestsFromCache: boolean
  apiRequestsMade: number
  retryCount: number
}

async function enrichProduct({
  product,
  backlog,
  client,
  refresh,
  exhaustive,
}: {
  product: CatalogProductInput
  backlog: VerificationBacklogInput | null
  client: OpenFdaClient
  refresh: boolean
  exhaustive: boolean
}): Promise<ProductEnrichmentResult> {
  const aliasGroup = getOpenFdaManufacturerAliasGroup(product.manufacturer_id, product.manufacturer)
  const plan = buildOpenFdaQueryPlan(product, aliasGroup, { backlog })
  const identityQueries = plan.filter((query) => query.phase < 5)
  if (identityQueries.length === 0) {
    return {
      proposal: buildOpenFdaEnrichmentProposal({
        product,
        aliasGroup,
        backlog,
        candidates: [],
        queryAttempts: [],
        forcedClassification: 'insufficient_identifiers',
        forcedReasonCodes: ['no_usable_identifier'],
      }),
      allRequestsFromCache: false,
      apiRequestsMade: 0,
      retryCount: 0,
    }
  }

  let candidates: OpenFdaMatchedCandidate[] = []
  const queryAttempts: OpenFdaQueryAttemptSummary[] = []
  const retrievedAt: string[] = []
  const rawCacheReferences: string[] = []
  let apiRequestsMade = 0
  let retryCount = 0
  let actualRequestCount = 0
  let cacheHitCount = 0
  let failed = false
  const phases = [1, 2, 3, 4, 5] as const

  for (const phase of phases) {
    if (!exhaustive) {
      // A DI hit is not enough to prove that the catalog/model has no package-level sibling.
      // Always run the exact catalog query and, when that field is absent from openFDA,
      // the exact model query before stopping normal (non-exhaustive) discovery.
      const hasCatalogQueryCandidate = candidates.some((candidate) =>
        candidate.queryKinds.some(
          (kind) => kind === 'catalog_number' || kind === 'catalog_number_company',
        ),
      )
      if (candidates.length > 0 && hasCatalogQueryCandidate && phase >= 3) break
      if (candidates.length > 0 && !hasCatalogQueryCandidate && phase === 3) continue
      if (candidates.length > 0 && phase >= 5) break
    }
    const phaseQueries = plan.filter((query) => query.phase === phase)
    for (const query of phaseQueries) {
      actualRequestCount += 1
      try {
        const response = await client.request({
          search: query.search,
          limit: query.limit,
          refresh,
        })
        apiRequestsMade += response.apiRequestsMade
        retryCount += response.retryCount
        if (response.fromCache) cacheHitCount += 1
        retrievedAt.push(response.retrievedAt)
        rawCacheReferences.push(response.rawCacheReference)
        const eligibleRecords = filterOpenFdaRecordsForQuery(response.records, query)
        queryAttempts.push({
          kind: query.kind,
          search: query.search,
          limit: query.limit,
          result_count: eligibleRecords.length,
          raw_result_count: response.records.length,
          cache_hit: response.fromCache,
          http_status: response.httpStatus,
          attempt_count: response.attemptCount,
          error: null,
        })
        candidates = mergeOpenFdaCandidates(
          candidates,
          eligibleRecords,
          query,
          response.retrievedAt,
          response.rawCacheReference,
        )
      } catch (error) {
        const clientError =
          error instanceof OpenFdaClientError
            ? error
            : new OpenFdaClientError(
                error instanceof Error ? error.message : 'Unknown openFDA query failure.',
                { httpStatus: null, attemptCount: 1 },
              )
        apiRequestsMade += clientError.apiRequestsMade
        retryCount += clientError.retryCount
        queryAttempts.push({
          kind: query.kind,
          search: query.search,
          limit: query.limit,
          result_count: 0,
          cache_hit: false,
          http_status: clientError.httpStatus,
          attempt_count: clientError.attemptCount,
          error: clientError.message,
        })
        failed = true
        break
      }
    }
    if (failed) break
    if (!exhaustive && candidates.length > 0 && phase >= 3) break
  }

  return {
    proposal: buildOpenFdaEnrichmentProposal({
      product,
      aliasGroup,
      backlog,
      candidates,
      queryAttempts,
      ...(failed
        ? {
            forcedClassification: 'query_error' as const,
            forcedReasonCodes: [
              candidates.length > 0 ? 'partial_query_failure' : 'query_failed_after_retries',
            ],
          }
        : {}),
      retrievedAt,
      rawCacheReferences,
    }),
    allRequestsFromCache: actualRequestCount > 0 && actualRequestCount === cacheHitCount,
    apiRequestsMade,
    retryCount,
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

function dryRunSummary(
  selected: CatalogProductInput[],
  backlogByProduct: Map<string, VerificationBacklogInput>,
) {
  return {
    dry_run: true,
    products_selected: selected.length,
    products: selected.slice(0, 25).map((product) => {
      const aliases = getOpenFdaManufacturerAliasGroup(
        product.manufacturer_id,
        product.manufacturer,
      )
      const plan = buildOpenFdaQueryPlan(product, aliases, {
        backlog: backlogByProduct.get(product.product_id),
      })
      return {
        product_id: product.product_id,
        manufacturer: product.manufacturer,
        catalog_number: product.catalog_number,
        query_count: plan.length,
        queries: plan.map(({ kind, phase, search }) => ({ kind, phase, search })),
      }
    }),
    preview_truncated: selected.length > 25,
  }
}

export async function runOpenFdaQueryEnrichment(
  options: OpenFdaQueryCliOptions,
): Promise<OpenFdaRunSummary | null> {
  const startedAt = new Date().toISOString()
  const catalogHashBefore = await fileSha256(DEFAULT_CATALOG_PATH)
  const { products, manufacturers, backlog } = await loadInputs()
  const manufacturerIds = new Set(manufacturers.map((row) => row.manufacturer_id))
  for (const product of products) {
    if (!manufacturerIds.has(product.manufacturer_id)) {
      throw new Error(
        `Catalog product ${product.product_id} references unknown manufacturer ${product.manufacturer_id}.`,
      )
    }
  }
  const backlogByProduct = new Map(backlog.map((row) => [row.product_id, row]))
  const cohortProductIds = await loadCohortProductIds(options.cohortPath)
  const selected = selectProducts(products, backlogByProduct, options, cohortProductIds)

  if (options.dryRun) {
    console.log(await formatJson(dryRunSummary(selected, backlogByProduct)))
    return null
  }

  if (!options.anonymous) loadOpenFdaLocalEnvironment()
  const apiKey = options.anonymous ? '' : (process.env.OPENFDA_API_KEY?.trim() ?? '')
  if (!options.anonymous && !apiKey) {
    throw new Error(
      'OPENFDA_API_KEY is required for batch enrichment. Store it in your local environment; never use a NEXT_PUBLIC_ variable.',
    )
  }

  const client = new OpenFdaClient({
    apiKey,
    cacheDir: process.env.OPENFDA_CACHE_DIR ?? DEFAULT_CACHE_DIRECTORY,
    requestsPerSecond: environmentNumber('OPENFDA_REQUESTS_PER_SECOND', 3),
    // The environment variable describes retries after the initial attempt.
    maxAttempts: Math.trunc(environmentNumber('OPENFDA_MAX_RETRIES', 5)) + 1,
    timeoutMs: Math.trunc(environmentNumber('OPENFDA_TIMEOUT_MS', 30_000)),
  })
  const enriched = await mapWithConcurrency(selected, options.concurrency, (product) =>
    enrichProduct({
      product,
      backlog: backlogByProduct.get(product.product_id) ?? null,
      client,
      refresh: options.refresh,
      exhaustive: options.exhaustive,
    }),
  )
  const proposals = stableSortOpenFdaProposals(enriched.map((result) => result.proposal))
  openFdaEnrichmentProposalsSchema.parse(proposals)

  const count = (classification: OpenFdaEnrichmentProposal['classification']) =>
    proposals.filter((proposal) => proposal.classification === classification).length
  const summary: OpenFdaRunSummary = {
    format_version: 1,
    catalog_input_sha256: catalogHashBefore,
    catalog_product_count: products.length,
    products_requested: selected.length,
    products_processed: proposals.length,
    products_served_from_cache: enriched.filter((result) => result.allRequestsFromCache).length,
    api_requests_made: enriched.reduce((total, result) => total + result.apiRequestsMade, 0),
    retry_count: enriched.reduce((total, result) => total + result.retryCount, 0),
    high_confidence_count: count('high_confidence_candidate'),
    review_required_count: count('review_required'),
    unmatched_count: count('unmatched'),
    insufficient_identifier_count: count('insufficient_identifiers'),
    query_error_count: count('query_error'),
    existing_backlog_conflicts: proposals.filter((proposal) =>
      proposal.backlog_comparison.startsWith('conflicts_'),
    ).length,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    openfda_endpoint: OPENFDA_ENDPOINT,
    api_key_used: Boolean(apiKey),
  }
  const classifiedCount =
    summary.high_confidence_count +
    summary.review_required_count +
    summary.unmatched_count +
    summary.insufficient_identifier_count +
    summary.query_error_count
  if (classifiedCount !== selected.length || proposals.length !== selected.length) {
    throw new Error(
      `Classification invariant failed: ${classifiedCount} classifications for ${selected.length} products.`,
    )
  }
  openFdaRunSummarySchema.parse(summary)

  const catalogHashAfter = await fileSha256(DEFAULT_CATALOG_PATH)
  if (catalogHashAfter !== catalogHashBefore) {
    throw new Error('Canonical catalog changed during enrichment; refusing to write proposals.')
  }

  const outputDirectory = validatedOutputDirectory(options.outputDirectory)
  await mkdir(outputDirectory, { recursive: true })
  const proposalsJson = await formatJson(proposals)
  const summaryJson = await formatJson(summary)
  if (apiKey && (proposalsJson.includes(apiKey) || summaryJson.includes(apiKey))) {
    throw new Error('Secret-safety assertion failed; refusing to write openFDA output.')
  }
  await Promise.all([
    writeFile(path.join(outputDirectory, 'enrichment-proposals.json'), proposalsJson, 'utf8'),
    writeFile(path.join(outputDirectory, 'run-summary.json'), summaryJson, 'utf8'),
    writeOpenFdaCsvReports(proposals, outputDirectory),
  ])
  console.log(await formatJson(summary))
  const invariantFailures = proposals.filter((proposal) =>
    proposal.reason_codes.includes('high_confidence_invariant_failed'),
  )
  if (options.cohortPath && invariantFailures.length > 0) {
    throw new Error(
      `High-confidence calibration invariant failed for ${invariantFailures
        .map((proposal) => proposal.product_id)
        .join(', ')}. Review-required proposals were written with explicit reason codes.`,
    )
  }
  return summary
}

async function main() {
  await runOpenFdaQueryEnrichment(parseOpenFdaQueryArgs(process.argv.slice(2)))
}

if (process.argv[1]?.endsWith('run-query-enrichment.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
