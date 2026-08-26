import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { OpenFdaClient } from '../../ip-preference-cards/openfda/client'
import { loadOpenFdaLocalEnvironment } from '../../ip-preference-cards/openfda/env'
import type { OpenFdaRecord } from '../../ip-preference-cards/openfda/types'
import { queryOpenFdaPages } from '../../ip-preference-cards/us-status/fda-evidence'

import { canonicalJson, readJsonWithBytes, sha256, writeOrCheckFile } from './io'
import { D2D_PATHS, D2D_REPO_ROOT, D2D_SNAPSHOT_DATE, d2dAbsolutePath } from './paths'
import {
  acquisitionManifestSchema,
  pilotCohortArtifactSchema,
  type AcquisitionManifest,
  type PilotCohortArtifact,
} from './schemas'

const ENDPOINTS = {
  udi: 'https://api.fda.gov/device/udi.json',
  '510k': 'https://api.fda.gov/device/510k.json',
  pma: 'https://api.fda.gov/device/pma.json',
  classification: 'https://api.fda.gov/device/classification.json',
  registrationlisting: 'https://api.fda.gov/device/registrationlisting.json',
} as const

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const parsed = stringValue(candidate)
      if (parsed) return parsed
    }
  }
  return null
}

function nestedValue(record: OpenFdaRecord, pathParts: string[]): unknown {
  let current: unknown = record
  for (const part of pathParts) {
    if (!current || typeof current !== 'object' || !(part in current)) return null
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function primaryDi(record: OpenFdaRecord): string | null {
  const direct = stringValue((record as Record<string, unknown>).primary_di)
  if (direct) return direct
  const identifiers = Array.isArray(record.identifiers) ? record.identifiers : []
  const primary = identifiers.find((identifier) =>
    /primary/i.test(stringValue(identifier.type) ?? ''),
  )
  return stringValue(primary?.id) ?? stringValue(identifiers[0]?.id)
}

function packageDis(record: OpenFdaRecord): string[] {
  const primary = primaryDi(record)
  return [
    ...new Set(
      (record.identifiers ?? [])
        .map((identifier) => stringValue(identifier.id))
        .filter((value): value is string => Boolean(value) && value !== primary),
    ),
  ].sort()
}

/** Compact candidate projection: no raw FDA prose or response object is committed here. */
export function normalizeAcquisitionCandidate(record: OpenFdaRecord) {
  const genericName =
    stringValue((record as Record<string, unknown>).device_name) ??
    stringValue(record.device_description) ??
    stringValue((record as Record<string, unknown>).classification_name)
  return {
    record_key:
      stringValue(record.record_key) ??
      stringValue(record.public_device_record_key) ??
      stringValue((record as Record<string, unknown>).registration_number),
    primary_di: primaryDi(record),
    package_dis: packageDis(record),
    company_name:
      stringValue(record.company_name) ??
      stringValue((record as Record<string, unknown>).applicant) ??
      stringValue(nestedValue(record, ['registration', 'name'])),
    brand_name: stringValue(record.brand_name),
    catalog_number: stringValue(record.catalog_number),
    model_number: stringValue(record.version_or_model_number),
    device_name: genericName,
    k_number: stringValue((record as Record<string, unknown>).k_number),
    pma_number: stringValue((record as Record<string, unknown>).pma_number),
    decision_code:
      stringValue((record as Record<string, unknown>).decision_code) ??
      stringValue((record as Record<string, unknown>).decision_description),
    decision_date: stringValue((record as Record<string, unknown>).decision_date),
    product_code:
      stringValue((record as Record<string, unknown>).product_code) ??
      stringValue(nestedValue(record, ['openfda', 'product_code'])),
    regulation_number:
      stringValue((record as Record<string, unknown>).regulation_number) ??
      stringValue(nestedValue(record, ['openfda', 'regulation_number'])),
    commercial_distribution_status: stringValue(record.commercial_distribution_status),
    publish_date: stringValue(record.publish_date) ?? stringValue(record.public_version_date),
  }
}

function uniqueSortedCandidates(records: OpenFdaRecord[]) {
  const byValue = new Map<string, ReturnType<typeof normalizeAcquisitionCandidate>>()
  for (const record of records) {
    const candidate = normalizeAcquisitionCandidate(record)
    const serialized = JSON.stringify(candidate)
    byValue.set(serialized, candidate)
  }
  return [...byValue.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([, candidate]) => candidate)
}

export async function acquireD2DEvidence(options: {
  cohort: PilotCohortArtifact
  cohortBytes: Buffer
  repoRoot?: string
  apiKey?: string
  clientFactory?: (dataset: keyof typeof ENDPOINTS) => OpenFdaClient
}): Promise<AcquisitionManifest> {
  const repoRoot = options.repoRoot ?? D2D_REPO_ROOT
  const apiKey = options.apiKey ?? ''
  const factory =
    options.clientFactory ??
    ((dataset: keyof typeof ENDPOINTS) =>
      new OpenFdaClient({
        apiKey,
        cacheDir: path.join(repoRoot, D2D_PATHS.localCacheRoot, 'openfda', dataset),
        cacheReferencePrefix: `${D2D_PATHS.localCacheRoot}/openfda/${dataset}`,
        endpoint: ENDPOINTS[dataset],
        apiSchemaVersion: `device-${dataset}-d2d-v1`,
        requestsPerSecond: apiKey ? 3 : 0.5,
        maxAttempts: 5,
        timeoutMs: 30_000,
      }))

  const clients = new Map<keyof typeof ENDPOINTS, OpenFdaClient>()
  const results: AcquisitionManifest['results'] = []
  for (const product of options.cohort.products) {
    for (const query of product.acquisition_queries) {
      const client = clients.get(query.dataset) ?? factory(query.dataset)
      clients.set(query.dataset, client)
      const response = await queryOpenFdaPages(client, {
        search: query.search,
        limit: 100,
        maxPages: 10,
      })
      results.push({
        query_id: query.query_id,
        product_id: product.product_id,
        dataset: query.dataset,
        endpoint: ENDPOINTS[query.dataset],
        api_schema_version: `device-${query.dataset}-d2d-v1`,
        normalization_method_version: 'd2d-acquisition-candidate-normalization-v1',
        response_content_type: 'application/json',
        query: query.search,
        purpose: query.purpose,
        expected_scope: query.expected_scope,
        dataset_last_updated: response.datasetLastUpdated,
        retrieved_at: response.retrievedAt,
        response_sha256s: response.pages.map((page) => page.response_sha256).sort(),
        raw_cache_references: response.rawCacheReferences,
        result_total: response.resultTotal,
        result_count: response.records.length,
        complete: !response.truncated,
        http_statuses: [
          ...new Set(response.pages.map((page) => (page.records.length ? 200 : 404))),
        ].sort(),
        pages: response.pages.map((page) => ({
          request_url: page.request_url,
          request_limit: page.request_limit,
          request_skip: page.request_skip,
          retrieved_at: page.retrieved_at,
          http_status: page.records.length ? 200 : 404,
          response_sha256: page.response_sha256,
          raw_cache_reference: page.raw_cache_reference,
        })),
        candidates: uniqueSortedCandidates(response.records),
      })
    }
  }

  return acquisitionManifestSchema.parse({
    format_version: 1,
    artifact_kind: 'd2d_acquisition_manifest',
    method_version: 'd2d-evidence-acquisition-v1',
    snapshot_date: options.cohort.snapshot_date,
    source_organization: 'U.S. Food and Drug Administration / NLM',
    pilot_cohort: { path: D2D_PATHS.pilotCohort, sha256: sha256(options.cohortBytes) },
    results: results.sort((left, right) => left.query_id.localeCompare(right.query_id)),
  })
}

function parseSnapshot(argv: string[]): string {
  const index = argv.indexOf('--snapshot')
  if (index < 0 || !argv[index + 1]) throw new Error('--snapshot YYYY-MM-DD is required.')
  const snapshot = argv[index + 1]
  if (snapshot !== D2D_SNAPSHOT_DATE) {
    throw new Error(
      `This bounded package is frozen to ${D2D_SNAPSHOT_DATE}; use a new package for another snapshot.`,
    )
  }
  return snapshot
}

async function main(argv: string[]): Promise<void> {
  parseSnapshot(argv)
  const target = d2dAbsolutePath(D2D_PATHS.acquisitionManifest)
  if (existsSync(target)) {
    const existing = acquisitionManifestSchema.parse(JSON.parse(readFileSync(target, 'utf8')))
    process.stdout.write(
      `${D2D_PATHS.acquisitionManifest} is immutable and already contains ${existing.results.length} queries.\n`,
    )
    return
  }

  loadOpenFdaLocalEnvironment(path.join(D2D_REPO_ROOT, '.env.local'))
  const cohortInput = readJsonWithBytes<unknown>(d2dAbsolutePath(D2D_PATHS.pilotCohort))
  const cohort = pilotCohortArtifactSchema.parse(cohortInput.value)
  const artifact = await acquireD2DEvidence({
    cohort,
    cohortBytes: cohortInput.bytes,
    apiKey: process.env.OPENFDA_API_KEY?.trim() ?? '',
  })
  const contents = canonicalJson(artifact)
  writeOrCheckFile({
    absolutePath: target,
    relativePath: D2D_PATHS.acquisitionManifest,
    contents,
    check: false,
  })
  process.stdout.write(
    `Wrote ${D2D_PATHS.acquisitionManifest}: ${artifact.results.length} bounded queries.\n`,
  )
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  })
}
