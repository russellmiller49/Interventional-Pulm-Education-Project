import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { isAtlasCohortProduct } from '../../src/features/device-intelligence/domain/atlas-cohort'
import {
  classifyProduct,
  loadTaxonomyInputs,
  validateProductOverrides,
} from './build-taxonomy-overlay'

import enMessages from '../../messages/en.json'

/**
 * Build the D2C taxonomy review package: owner-facing CSVs pairing every normalized
 * classification with its source-category provenance.
 *
 *   npm run ip-intel:d2c-review             # write
 *   npm run ip-intel:d2c-review -- --check  # fail if the committed files are stale
 *
 * These artifacts exist so the physician owner can audit the normalization without
 * reading rules JSON. They deliberately carry what the runtime overlay must NOT:
 * source `primary_category` / `subcategory` copy, English labels, manufacturer and
 * product names, and role/procedure context. They live under docs/, are never imported
 * by application code, and are never sent to a client.
 *
 * Subsets, per the D2C review contract:
 *  - `taxonomy-review-full.csv` — every atlas-cohort product.
 *  - `taxonomy-review-needs-review.csv` — rows flagged for owner review.
 *  - `taxonomy-review-class-changed.csv` — rows whose normalized class is not the
 *    majority class of their source primary_category (the products the normalization
 *    actually MOVED, e.g. the guidewires and the AEROSIZER out of "Airway stenting").
 *  - `taxonomy-review-source-categories-split.csv` — source categories that fan out
 *    into more than one normalized class.
 *  - `taxonomy-review-classes-merged.csv` — normalized classes assembled from more
 *    than one source category.
 *
 * Deterministic: stable ordering everywhere, no clock input; running twice writes
 * byte-identical files.
 */

const REPO_ROOT = path.resolve(__dirname, '../..')
const REVIEW_DIR_RELATIVE = 'docs/ip-device-intelligence/d2c-review'

interface CatalogReviewRow {
  product_id: string
  manufacturer: string
  product_name: string
  catalog_number: string | null
  primary_category: string | null
  subcategory: string | null
  verification_grade?: string | null
}

const taxonomyMessages = (
  enMessages as unknown as {
    deviceIntelligence: {
      taxonomy: { classes: Record<string, string>; subtypes: Record<string, string> }
    }
  }
).deviceIntelligence.taxonomy

function csvField(value: string | null | undefined): string {
  const text = value ?? ''
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csv(rows: string[][]): string {
  return `${rows.map((row) => row.map(csvField).join(',')).join('\n')}\n`
}

export function buildReviewFiles(repoRoot = REPO_ROOT): Record<string, string> {
  const { rules } = loadTaxonomyInputs(repoRoot)
  const catalog = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'data/ip-preference-cards/generated/catalog-products.json'),
      'utf8',
    ),
  ) as CatalogReviewRow[]
  const productRoles = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'data/ip-preference-cards/generated/product-roles.json'),
      'utf8',
    ),
  ) as { product_id: string; role_code: string }[]
  const procedureSlots = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'data/ip-preference-cards/generated/procedure-slots.json'),
      'utf8',
    ),
  ) as { slot_id: string; procedure_code: string }[]
  const slotOptions = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'data/ip-preference-cards/generated/slot-product-options.json'),
      'utf8',
    ),
  ) as { slot_id: string; product_id: string }[]

  const rolesByProduct = new Map<string, string[]>()
  for (const link of productRoles) {
    const existing = rolesByProduct.get(link.product_id) ?? []
    if (!existing.includes(link.role_code)) existing.push(link.role_code)
    rolesByProduct.set(link.product_id, existing)
  }
  const procedureBySlot = new Map(procedureSlots.map((slot) => [slot.slot_id, slot.procedure_code]))
  const proceduresByProduct = new Map<string, string[]>()
  for (const option of slotOptions) {
    const procedure = procedureBySlot.get(option.slot_id)
    if (!procedure) continue
    const existing = proceduresByProduct.get(option.product_id) ?? []
    if (!existing.includes(procedure)) existing.push(procedure)
    proceduresByProduct.set(option.product_id, existing)
  }

  // Same wall as the overlay generator (D2C-REV-006): a committed override must land on
  // exactly one current atlas-cohort row, never ride along as a silent no-op.
  validateProductOverrides(rules, catalog)

  const cohort = catalog
    .filter(isAtlasCohortProduct)
    .slice()
    .sort((left, right) => left.product_id.localeCompare(right.product_id))
  const classified = cohort.map((product) => ({
    product,
    taxonomy: classifyProduct({ ...product, product_name: product.product_name }, rules),
  }))

  // Majority normalized class per source category — deterministic (count desc, code asc).
  const classCountsBySource = new Map<string, Map<string, number>>()
  for (const { product, taxonomy } of classified) {
    const source = product.primary_category ?? ''
    const counts = classCountsBySource.get(source) ?? new Map<string, number>()
    counts.set(taxonomy.deviceClassCode, (counts.get(taxonomy.deviceClassCode) ?? 0) + 1)
    classCountsBySource.set(source, counts)
  }
  const majorityClassBySource = new Map<string, string>()
  for (const [source, counts] of classCountsBySource) {
    const winner = [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )[0]
    majorityClassBySource.set(source, winner[0])
  }

  const header = [
    'product_id',
    'manufacturer',
    'product_name',
    'catalog_number',
    'source_primary_category',
    'source_subcategory',
    'device_class_code',
    'device_class_label_en',
    'device_subtype_code',
    'device_subtype_label_en',
    'taxonomy_confidence',
    'needs_review',
    'classification_basis',
    'role_codes',
    'procedure_codes',
  ]
  const fullRow = ({ product, taxonomy }: (typeof classified)[number]): string[] => [
    product.product_id,
    product.manufacturer,
    product.product_name,
    product.catalog_number ?? '',
    product.primary_category ?? '',
    product.subcategory ?? '',
    taxonomy.deviceClassCode,
    taxonomyMessages.classes[taxonomy.deviceClassCode] ?? '',
    taxonomy.deviceSubtypeCode,
    taxonomyMessages.subtypes[taxonomy.deviceSubtypeCode] ?? '',
    taxonomy.confidence,
    String(taxonomy.needsReview),
    taxonomy.basis,
    (rolesByProduct.get(product.product_id) ?? []).slice().sort().join('|'),
    (proceduresByProduct.get(product.product_id) ?? []).slice().sort().join('|'),
  ]

  const needsReview = classified.filter(({ taxonomy }) => taxonomy.needsReview)
  const classChanged = classified.filter(
    ({ product, taxonomy }) =>
      majorityClassBySource.get(product.primary_category ?? '') !== taxonomy.deviceClassCode,
  )

  const splitRows: string[][] = [
    ['source_primary_category', 'normalized_class_count', 'device_class_code', 'product_count'],
  ]
  for (const [source, counts] of [...classCountsBySource.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    if (counts.size < 2) continue
    for (const [classCode, count] of [...counts.entries()].sort((left, right) =>
      left[0].localeCompare(right[0]),
    )) {
      splitRows.push([source, String(counts.size), classCode, String(count)])
    }
  }

  const sourcesByClass = new Map<string, Map<string, number>>()
  for (const { product, taxonomy } of classified) {
    const sources = sourcesByClass.get(taxonomy.deviceClassCode) ?? new Map<string, number>()
    const source = product.primary_category ?? ''
    sources.set(source, (sources.get(source) ?? 0) + 1)
    sourcesByClass.set(taxonomy.deviceClassCode, sources)
  }
  const mergedRows: string[][] = [
    ['device_class_code', 'source_category_count', 'source_primary_category', 'product_count'],
  ]
  for (const [classCode, sources] of [...sourcesByClass.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    if (sources.size < 2) continue
    for (const [source, count] of [...sources.entries()].sort((left, right) =>
      left[0].localeCompare(right[0]),
    )) {
      mergedRows.push([classCode, String(sources.size), source, String(count)])
    }
  }

  return {
    'taxonomy-review-full.csv': csv([header, ...classified.map(fullRow)]),
    'taxonomy-review-needs-review.csv': csv([header, ...needsReview.map(fullRow)]),
    'taxonomy-review-class-changed.csv': csv([header, ...classChanged.map(fullRow)]),
    'taxonomy-review-source-categories-split.csv': csv(splitRows),
    'taxonomy-review-classes-merged.csv': csv(mergedRows),
  }
}

function main(argv: string[]): void {
  const check = argv.includes('--check')
  const files = buildReviewFiles()
  const directory = path.join(REPO_ROOT, REVIEW_DIR_RELATIVE)
  if (check) {
    for (const [name, next] of Object.entries(files)) {
      const current = readFileSync(path.join(directory, name), 'utf8')
      if (current !== next) {
        throw new Error(
          `${REVIEW_DIR_RELATIVE}/${name} is stale. Run "npm run ip-intel:d2c-review" and commit the result.`,
        )
      }
    }
    process.stdout.write(
      `${REVIEW_DIR_RELATIVE} is up to date (${Object.keys(files).length} files).\n`,
    )
    return
  }
  mkdirSync(directory, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(directory, name), content)
    process.stdout.write(
      `Wrote ${REVIEW_DIR_RELATIVE}/${name}: ${content.split('\n').length - 2} data rows, ${Buffer.byteLength(content)} bytes.\n`,
    )
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  }
}
