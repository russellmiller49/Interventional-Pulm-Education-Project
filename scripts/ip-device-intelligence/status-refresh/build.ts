import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { statusRefreshSchema } from '../../../src/features/device-intelligence/domain/status-refresh-schema'
import { CACHE_ROOT, SNAPSHOT, refreshProducts, type BatchResult, type Receipt } from './acquire'
import { marketFinding, safetyFinding, type Inputs } from './adjudicate'
import { additionalIdentities, matchedUdi, objects, recordsFor, string } from './identity'
import physicianReview from '../../../data/ip-device-intelligence/generated/physician-review-overlay.json'

const ROOT = path.resolve(__dirname, '../../..')
const read = <T>(name: string): T => JSON.parse(readFileSync(path.join(CACHE_ROOT, name), 'utf8'))
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
function receipt(page: Receipt) {
  return {
    url: page.requestUrl,
    response_sha256: page.responseSha256,
    http_status: page.httpStatus,
    dataset_as_of: page.datasetLastUpdated,
    retrieved_at: page.retrievedAt,
    skip: page.requestSkip,
    record_count: page.records.length,
    result_total: page.resultTotal,
  }
}
function emit(relative: string, content: string) {
  const target = path.join(ROOT, relative)
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== content) throw new Error(`Stale artifact: ${relative}`)
  } else {
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
}
export function build() {
  const input: Inputs = {
    udi: read<BatchResult[]>('udi-batches.json'),
    registration: [
      ...read<BatchResult[]>('registrationlisting-firms.json'),
      ...read<BatchResult[]>('registrationlisting-identifiers.json'),
    ],
    recall: [
      ...read<BatchResult[]>('recall-firms.json'),
      ...read<BatchResult[]>('recall-identifiers.json'),
    ],
    enforcement: [
      ...read<BatchResult[]>('enforcement-firms.json'),
      ...read<BatchResult[]>('enforcement-identifiers.json'),
    ],
    snapshots: read<Record<string, Receipt>>('snapshots.json'),
  }
  const rows = [],
    auditRows = []
  for (const p of refreshProducts()) {
    const market = marketFinding(p, input)
    const finding = safetyFinding(p, input)
    const exclusions = new Set(
      physicianReview.products
        .find((r) => r.product_id === p.product_id)
        ?.excluded_recalls.map((r) => r.recall_number) ?? [],
    )
    const ambiguous = finding.ambiguous.filter((r) => !exclusions.has(r.recall_number))
    const safety = {
      ...finding.safety,
      notices: finding.safety.notices.filter((r) => !exclusions.has(r.recall_number)),
    }
    rows.push({
      product_id: p.product_id,
      ...market,
      safety,
      safety_identity_review_required: ambiguous.length > 0,
    })
    auditRows.push({
      product_id: p.product_id,
      catalog_number: p.catalog_number,
      manufacturer: p.manufacturer,
      market_basis: market.market_evidence.basis,
      qualified_udi_records: matchedUdi(p, input.udi).map(({ record, page }) => ({
        company_name: record.company_name,
        catalog_number: record.catalog_number ?? null,
        model: record.version_or_model_number ?? null,
        primary_dis: objects(record.identifiers)
          .filter((id) => id.type === 'Primary')
          .map((id) => string(id.id)),
        distribution_status: record.commercial_distribution_status ?? null,
        response_sha256: page.responseSha256,
      })),
      safety_identity_candidates: [
        ...new Map(ambiguous.map((a) => [`${a.recall_number}:${a.firm}`, a])).values(),
      ].sort((a, b) => a.recall_number.localeCompare(b.recall_number)),
      // Registration contacts and raw recall narratives never leave Local-Data.
      registration_record_count: recordsFor(p, input.registration).length,
      query_keys: [...input.udi, ...input.registration, ...input.recall, ...input.enforcement]
        .filter((b) => b.product_ids.includes(p.product_id))
        .map((b) => b.key)
        .sort(),
    })
  }
  const allBatches = [...input.udi, ...input.registration, ...input.recall, ...input.enforcement]
  const research = {
    format_version: 1,
    method: 'exact-identity-fda-status-refresh-v1',
    checked_on: SNAPSHOT,
    inputs: [
      'data/ip-preference-cards/generated/catalog-products.json',
      'data/ip-device-intelligence/generated/physician-review-overlay.json',
    ].map((file) => ({ path: file, sha256: sha(readFileSync(path.join(ROOT, file), 'utf8')) })),
    company_identity_sources: additionalIdentities,
    endpoint_snapshots: Object.fromEntries(
      Object.entries(input.snapshots).map(([key, page]) => [key, receipt(page)]),
    ),
    queries: allBatches
      .map((b) => ({
        key: b.key,
        endpoint: b.endpoint,
        search: b.search,
        complete: b.complete,
        error: b.error,
        pages: b.pages.map(receipt),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    products: auditRows,
  }
  const researchText = json(research)
  const artifact = statusRefreshSchema.parse({
    format_version: 1,
    method: 'exact-identity-fda-status-refresh-v1',
    checked_on: SNAPSHOT,
    research_sha256: sha(researchText),
    rows,
  })
  emit('data/ip-device-intelligence/research/status-refresh-2026-09-17.json', researchText)
  emit('data/ip-device-intelligence/generated/status-refresh.json', json(artifact))
  const count = (values: string[]) =>
    Object.fromEntries(
      [...new Set(values)].sort().map((s) => [s, values.filter((v) => s === v).length]),
    )
  console.log(
    JSON.stringify(
      {
        products: rows.length,
        queries: allBatches.length,
        query_errors: allBatches.filter((b) => b.error).length,
        market: count(rows.map((r) => r.market_status ?? 'unchanged')),
        basis: count(rows.map((r) => r.market_evidence.basis)),
        new_exact_notices: rows.reduce((n, r) => n + r.safety.notices.length, 0),
        notice_states: count(rows.flatMap((r) => r.safety.notices.map((n) => n.recorded_state))),
        safety_identity_holds: rows.filter((r) => r.safety_identity_review_required).length,
      },
      null,
      2,
    ),
  )
}
if (require.main === module) build()
