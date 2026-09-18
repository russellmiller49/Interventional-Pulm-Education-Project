/** Bounded public FDA acquisition. Raw responses stay in Local-Data; no runtime writes. */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { OpenFdaClient, type OpenFdaClientResult } from '../../ip-preference-cards/openfda/client'
import {
  exactOpenFdaSearch,
  splitAlternateIdentifiers,
} from '../../ip-preference-cards/openfda/normalize'
import { isAtlasCohortProduct } from '../../../src/features/device-intelligence/domain/atlas-cohort'
// @ts-expect-error Shared JavaScript authoring resolver has no TypeScript declaration.
import { localDataPath } from '../../local-data-root.mjs'
import type { CatalogProductRecord } from '../../../src/features/preference-cards/server/catalog-store'
import type { PhysicianReviewOverlay } from '../../../src/features/device-intelligence/domain/physician-review-schema'

export const SNAPSHOT = '2026-09-17'
export const CACHE_ROOT = localDataPath('renders', 'device-status-refresh', SNAPSHOT)
const ROOT = path.resolve(__dirname, '../../..')
const read = (file: string) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'))
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export type Receipt = Omit<OpenFdaClientResult, 'records'> & { records: Record<string, unknown>[] }
export interface BatchResult {
  key: string
  product_ids: string[]
  endpoint: string
  search: string
  complete: boolean
  error: string | null
  pages: Receipt[]
}

export function refreshProducts() {
  const products = read(
    'data/ip-preference-cards/generated/catalog-products.json',
  ) as CatalogProductRecord[]
  const physician = read(
    'data/ip-device-intelligence/generated/physician-review-overlay.json',
  ) as PhysicianReviewOverlay
  const statusRows = read('data/ip-device-intelligence/generated/product-status-overlay.json')
    .rows as { product_id: string; market_status: string; safety_display: string }[]
  const status = new Map(statusRows.map((r) => [r.product_id, r]))
  const corrections = new Map(physician.products.map((r) => [r.product_id, r]))
  return products
    .filter(isAtlasCohortProduct)
    .filter((p) => {
      const row = status.get(p.product_id)
      return (
        !row ||
        row.market_status === 'current_status_unverified' ||
        ['safety_status_unverified', 'safety_identity_review_required'].includes(row.safety_display)
      )
    })
    .map((p) => {
      const corrected = { ...p }
      for (const c of corrections.get(p.product_id)?.catalog_corrections ?? [])
        Object.assign(corrected, { [c.field]: c.after })
      return corrected
    })
    .sort((a, b) => a.product_id.localeCompare(b.product_id))
}

export function identifiers(product: CatalogProductRecord): string[] {
  return [
    ...new Set(
      [
        product.catalog_number,
        product.gtin,
        product.global_part_number,
        product.reference_part_number,
        ...splitAlternateIdentifiers(product.alternate_ids),
      ]
        .filter(
          (id): id is string => typeof id === 'string' && /^[\p{L}\p{N} ._()/+-]{2,80}$/u.test(id),
        )
        .map((id) => id.trim()),
    ),
  ]
}

const clients = new Map<string, OpenFdaClient>()
export async function acquireBatch(
  endpoint: string,
  search: string,
  productIds: string[],
): Promise<BatchResult> {
  let client = clients.get(endpoint)
  if (!client) {
    client = new OpenFdaClient({
      apiKey: '',
      endpoint: `https://api.fda.gov/device/${endpoint}.json`,
      cacheDir: path.join(CACHE_ROOT, endpoint),
      requestsPerSecond: 2,
      maxAttempts: 3,
      timeoutMs: 30000,
    })
    clients.set(endpoint, client)
  }
  const result: BatchResult = {
    key: hash(`${endpoint}\n${search}`),
    product_ids: productIds,
    endpoint,
    search,
    complete: false,
    error: null,
    pages: [],
  }
  try {
    for (let skip = 0; skip < 25000; skip += 100) {
      const page = await client.request({ search, limit: 100, skip })
      result.pages.push(page as Receipt)
      if (page.resultTotal !== null && skip + page.records.length >= page.resultTotal) {
        result.complete = true
        break
      }
      if (page.httpStatus === 404 && page.records.length === 0) {
        result.complete = true
        break
      }
      if (page.records.length < 100) break
    }
    if (!result.complete) result.error = 'Incomplete or bounded result set'
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Acquisition failed'
  }
  return result
}

export async function acquireGroups(
  endpoint: string,
  groups: { search: string; ids: string[] }[],
  filename: string,
) {
  mkdirSync(CACHE_ROOT, { recursive: true })
  const results: BatchResult[] = []
  // Shared endpoint clients pace their queues; four workers overlap network latency only.
  let next = 0
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < groups.length) {
        const group = groups[next++]
        const result = await acquireBatch(endpoint, group.search, group.ids)
        results.push(result)
        writeFileSync(path.join(CACHE_ROOT, filename), JSON.stringify(results, null, 2) + '\n')
        if (results.length % 10 === 0 || results.length === groups.length)
          process.stdout.write(
            `${endpoint}: ${results.length}/${groups.length} batches, ${results.filter((r) => r.error).length} errors\n`,
          )
      }
    }),
  )
  return results
}

export async function acquireSnapshots() {
  const snapshots: Record<string, Receipt> = {}
  for (const [endpoint, field] of [
    ['udi', 'company_name'],
    ['registrationlisting', 'registration.name'],
    ['recall', 'recalling_firm'],
    ['enforcement', 'recalling_firm'],
  ]) {
    const client = new OpenFdaClient({
      apiKey: '',
      endpoint: `https://api.fda.gov/device/${endpoint}.json`,
      cacheDir: path.join(CACHE_ROOT, endpoint),
      requestsPerSecond: 2,
    })
    snapshots[endpoint] = (await client.request({ search: `${field}:*`, limit: 1 })) as Receipt
  }
  writeFileSync(path.join(CACHE_ROOT, 'snapshots.json'), JSON.stringify(snapshots, null, 2) + '\n')
}

async function main() {
  const products = refreshProducts()
  mkdirSync(CACHE_ROOT, { recursive: true })
  writeFileSync(path.join(CACHE_ROOT, 'products.json'), JSON.stringify(products, null, 2) + '\n')
  const groups = []
  for (let start = 0; start < products.length; start += 15) {
    const batch = products.slice(start, start + 15)
    const clauses = [
      ...new Set(
        batch.flatMap((p) =>
          identifiers(p).flatMap((id) => [
            exactOpenFdaSearch('catalog_number.exact', id),
            exactOpenFdaSearch('version_or_model_number.exact', id),
            ...(/^\d{12,14}$/.test(id) ? [exactOpenFdaSearch('identifiers.id', id)] : []),
          ]),
        ),
      ),
    ]
    if (clauses.length)
      groups.push({ search: clauses.join(' OR '), ids: batch.map((p) => p.product_id) })
  }
  console.log(
    `Acquiring exact UDI evidence for ${products.length} products in ${groups.length} batches`,
  )
  await acquireGroups('udi', groups, 'udi-batches.json')
}
if (require.main === module)
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
