import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { GudidIndexEntry } from './build-gudid-index'
import { normalizeCatalogKey } from './build-gudid-index'

/**
 * Matches catalog products against the AccessGUDID index and writes a review queue.
 *
 * This never mutates product records. AccessGUDID's own use policy (SRC046) says a GUDID
 * record is not by itself evidence of current orderability or clinical configuration, and
 * the workbook owner approves verification changes by hand — so the output is a queue of
 * proposals, each carrying the evidence that supports it.
 *
 *   npx tsx scripts/ip-preference-cards/gudid-confirm.ts
 */

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'

/** Manufacturer names in the catalog mapped to the GUDID company keys they may appear under. */
const MANUFACTURER_TO_COMPANY_KEYS: Record<string, string[]> = {
  Ambu: ['Ambu'],
  'Boston Scientific': ['Boston Scientific'],
  'Butterfly Network': ['Butterfly Network'],
  'Cardinal Health': ['Cardinal Health'],
  'Cook Medical': ['Cook Medical'],
  ERBE: ['ERBE'],
  Ethicon: ['Ethicon'],
  'FUJIFILM SonoSite': ['FUJIFILM SonoSite'],
  'Intuitive Surgical': ['Intuitive Surgical'],
  'Karl Storz': ['Karl Storz'],
  Medtronic: ['Medtronic'],
  'Merit Medical': ['Merit Medical'],
  'Micro-Tech Endoscopy': ['Micro-Tech'],
  'Micro-Tech / Thoracent': ['Micro-Tech'],
  Novatech: ['Novatech'],
  Olympus: ['Olympus'],
  Pulmonx: ['Pulmonx'],
  'Richard Wolf': ['Richard Wolf'],
  'Rocket Medical': ['Rocket Medical'],
  Teleflex: ['Teleflex'],
  'Thoracent / M.I.Tech': ['Micro-Tech'],
  TRACOE: ['TRACOE'],
  Verathon: ['Verathon'],
  BD: ['BD'],
}

interface CatalogProduct {
  product_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  global_part_number: string | null
  gtin: string | null
  verification_status: string | null
  visibility_state: string
  verification_grade: string
}

type MatchStrength = 'manufacturer_and_catalog_number' | 'catalog_number_only'

interface Confirmation {
  product_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  match_strength: MatchStrength
  gudid_primary_di: string
  gudid_company: string
  gudid_brand: string
  gudid_description: string
  gudid_distribution_status: string
  gudid_gtin: string | null
  current_gtin: string | null
  /** What a reviewer could change, given this evidence. */
  proposals: string[]
}

function proposalsFor(product: CatalogProduct, entry: GudidIndexEntry): string[] {
  const proposals: string[] = []
  const gudidGtin = entry.gtins[0] ?? null
  if (gudidGtin && !product.gtin) {
    proposals.push(`Add GTIN ${gudidGtin} from GUDID DI ${entry.primaryDi}.`)
  } else if (gudidGtin && product.gtin && product.gtin !== gudidGtin) {
    proposals.push(`GTIN mismatch: catalog has ${product.gtin}, GUDID publishes ${gudidGtin}.`)
  }
  if (/^Not in Commercial Distribution$/i.test(entry.distributionStatus)) {
    proposals.push(
      'GUDID reports this device is NOT in commercial distribution; confirm before listing it as available.',
    )
  }
  if (
    /^In Commercial Distribution$/i.test(entry.distributionStatus) &&
    product.visibility_state === 'hidden'
  ) {
    proposals.push(
      'GUDID reports in commercial distribution; candidate for release from hidden once U.S. status is accepted.',
    )
  }
  return proposals
}

async function main() {
  const [products, gudid] = await Promise.all([
    readFile(path.join(GENERATED_DIRECTORY, 'catalog-products.json'), 'utf8').then(
      (raw) => JSON.parse(raw) as CatalogProduct[],
    ),
    readFile(path.join(GENERATED_DIRECTORY, 'gudid-index.json'), 'utf8').then(
      (raw) => JSON.parse(raw) as GudidIndexEntry[],
    ),
  ])

  const byCatalogKey = new Map<string, GudidIndexEntry[]>()
  for (const entry of gudid) {
    if (!entry.catalogKey) continue
    const existing = byCatalogKey.get(entry.catalogKey)
    if (existing) existing.push(entry)
    else byCatalogKey.set(entry.catalogKey, [entry])
  }

  const confirmations: Confirmation[] = []
  let productsWithAnyMatch = 0

  for (const product of products) {
    const keys = [product.catalog_number, product.global_part_number]
      .filter((value): value is string => Boolean(value))
      .map(normalizeCatalogKey)
      .filter((key) => key.length >= 3)
    if (keys.length === 0) continue

    const allowedCompanies = new Set(MANUFACTURER_TO_COMPANY_KEYS[product.manufacturer ?? ''] ?? [])

    const seenDis = new Set<string>()
    let matched = false
    for (const key of keys) {
      for (const entry of byCatalogKey.get(key) ?? []) {
        if (seenDis.has(entry.primaryDi)) continue
        seenDis.add(entry.primaryDi)
        const sameCompany = allowedCompanies.has(entry.companyKey)
        // A catalog-number-only hit across different manufacturers is weak evidence, so it
        // is reported at lower strength rather than dropped or treated as confirmation.
        const proposals = proposalsFor(product, entry)
        confirmations.push({
          product_id: product.product_id,
          manufacturer: product.manufacturer,
          product_name: product.product_name,
          catalog_number: product.catalog_number,
          match_strength: sameCompany ? 'manufacturer_and_catalog_number' : 'catalog_number_only',
          gudid_primary_di: entry.primaryDi,
          gudid_company: entry.companyName,
          gudid_brand: entry.brandName,
          gudid_description: entry.description,
          gudid_distribution_status: entry.distributionStatus,
          gudid_gtin: entry.gtins[0] ?? null,
          current_gtin: product.gtin,
          proposals,
        })
        matched = true
      }
    }
    if (matched) productsWithAnyMatch += 1
  }

  confirmations.sort(
    (left, right) =>
      left.match_strength.localeCompare(right.match_strength) ||
      (left.manufacturer ?? '').localeCompare(right.manufacturer ?? '') ||
      left.product_id.localeCompare(right.product_id),
  )

  const strong = confirmations.filter(
    (row) => row.match_strength === 'manufacturer_and_catalog_number',
  )
  const summary = {
    format_version: '1.0',
    generated_from: 'gudid-index.json + catalog-products.json',
    catalog_products: products.length,
    products_with_any_match: productsWithAnyMatch,
    strong_matches: strong.length,
    weak_matches: confirmations.length - strong.length,
    gtin_backfill_candidates: strong.filter((row) =>
      row.proposals.some((proposal) => proposal.startsWith('Add GTIN')),
    ).length,
    gtin_mismatches: strong.filter((row) =>
      row.proposals.some((proposal) => proposal.startsWith('GTIN mismatch')),
    ).length,
    not_in_distribution: strong.filter((row) =>
      /^Not in Commercial Distribution$/i.test(row.gudid_distribution_status),
    ).length,
    release_candidates: strong.filter((row) =>
      row.proposals.some((proposal) => proposal.startsWith('GUDID reports in commercial')),
    ).length,
    confirmations,
  }

  await writeFile(
    path.join(GENERATED_DIRECTORY, 'gudid-confirmations.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  )

  console.log(`Catalog products:            ${summary.catalog_products}`)
  console.log(`Products with a GUDID match: ${summary.products_with_any_match}`)
  console.log(`  strong (manufacturer+cat#): ${summary.strong_matches}`)
  console.log(`  weak (cat# only):           ${summary.weak_matches}`)
  console.log(`GTIN backfill candidates:    ${summary.gtin_backfill_candidates}`)
  console.log(`GTIN mismatches to review:   ${summary.gtin_mismatches}`)
  console.log(`Flagged not in distribution: ${summary.not_in_distribution}`)
  console.log(`Candidates to unhide:        ${summary.release_candidates}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
