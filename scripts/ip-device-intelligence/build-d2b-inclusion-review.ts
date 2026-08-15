import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { isAtlasCohortProduct } from '../../src/features/device-intelligence/domain/atlas-cohort'
import { getAtlasVisibilityExclusions } from '../../src/features/device-intelligence/domain/atlas-visibility-exclusions'
import {
  UNRESEARCHED_PRODUCT_STATUS,
  type ProductStatusView,
} from '../../src/features/device-intelligence/domain/product-status'
import { statusOverlayArtifactSchema } from '../../src/features/device-intelligence/domain/status-overlay-schema'

/**
 * The D2B accounting artifact: every product the inclusion-first policy newly admits to the
 * Device Atlas, with the facts a reviewer needs to spot a wrong admission.
 *
 *   npm run ip-intel:d2b-review           # write
 *   npm run ip-intel:d2b-review -- --check    # fail if the committed files are stale
 *
 * This is a REVIEW artifact, not a gate. The runtime inclusion has already happened when this
 * runs; nothing here can withhold a product. A reviewer who finds a wrong admission removes it
 * through the reviewed owner-exclusion overlay
 * (`data/ip-device-intelligence/reviewed/atlas-visibility-exclusions.json`), one row at a time.
 *
 * Deterministic: rows sorted by product id, counts derived from the rows, no clock input.
 */

const REPO_ROOT = path.resolve(__dirname, '../..')
const OUTPUT_DIR = 'docs/ip-device-intelligence/d2b-review'
export const REVIEW_CSV_RELATIVE_PATH = `${OUTPUT_DIR}/newly-included-products.csv`
export const REVIEW_SUMMARY_RELATIVE_PATH = `${OUTPUT_DIR}/newly-included-summary.json`

interface CatalogRow {
  product_id: string
  manufacturer?: string | null
  product_name: string
  catalog_number?: string | null
  verification_grade?: string | null
  visibility_state?: string | null
}

const COLUMNS = [
  'product_id',
  'manufacturer',
  'product_name',
  'catalog_number',
  'prior_visibility_state',
  'verification_grade',
  'market_status',
  'market_confidence',
  'safety_display',
  'safety_action_scope',
  'safety_reference_codes',
  'status_recommendation_gate',
  'role_count',
  'authored_option_count',
] as const

/** RFC4180 field: quote always, so a comma or quote in a product name can never shift a column. */
function csvField(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function tally(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values.slice().sort()) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

export function buildD2bInclusionReview(repoRoot = REPO_ROOT): {
  csv: string
  summary: string
  rowCount: number
} {
  const read = (relative: string) =>
    JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8')) as unknown

  const products = read('data/ip-preference-cards/generated/catalog-products.json') as CatalogRow[]
  const productRoles = read('data/ip-preference-cards/generated/product-roles.json') as {
    product_id: string
  }[]
  const slotOptions = read('data/ip-preference-cards/generated/slot-product-options.json') as {
    product_id: string
  }[]
  const overlay = statusOverlayArtifactSchema.parse(
    read('data/ip-device-intelligence/generated/product-status-overlay.json'),
  )

  const statusByProductId = new Map<string, ProductStatusView>(
    overlay.rows.map((row) => [
      row.product_id,
      {
        researched: true,
        researchSnapshotDate: row.research_snapshot_date,
        marketStatus: row.market_status,
        marketConfidence: row.market_confidence,
        safetyDisplay: row.safety_display,
        safetyActionScope: row.safety_action_scope,
        safetyReferenceCodes: row.safety_reference_codes,
        statusRecommendationGate: row.status_recommendation_gate,
      },
    ]),
  )

  const roleCounts = new Map<string, number>()
  for (const link of productRoles) {
    roleCounts.set(link.product_id, (roleCounts.get(link.product_id) ?? 0) + 1)
  }
  const optionCounts = new Map<string, number>()
  for (const option of slotOptions) {
    optionCounts.set(option.product_id, (optionCounts.get(option.product_id) ?? 0) + 1)
  }

  // "Newly included" = admitted by the D2B predicate but excluded by the D1 predicate, which
  // additionally required `visibility_state = prototype_visible`.
  const newlyIncluded = products
    .filter(
      (product) =>
        isAtlasCohortProduct(product) && product.visibility_state !== 'prototype_visible',
    )
    .sort((left, right) => left.product_id.localeCompare(right.product_id))

  const lines = [COLUMNS.join(',')]
  for (const product of newlyIncluded) {
    const status = statusByProductId.get(product.product_id) ?? UNRESEARCHED_PRODUCT_STATUS
    lines.push(
      [
        product.product_id,
        product.manufacturer,
        product.product_name,
        product.catalog_number,
        product.visibility_state,
        product.verification_grade,
        status.marketStatus,
        status.marketConfidence,
        status.safetyDisplay,
        status.safetyActionScope,
        status.safetyReferenceCodes.join(' '),
        status.statusRecommendationGate,
        roleCounts.get(product.product_id) ?? 0,
        optionCounts.get(product.product_id) ?? 0,
      ]
        .map(csvField)
        .join(','),
    )
  }

  const statuses = newlyIncluded.map(
    (product) => statusByProductId.get(product.product_id) ?? UNRESEARCHED_PRODUCT_STATUS,
  )
  const summary = {
    artifact_kind: 'device_intelligence_d2b_inclusion_review_summary',
    format_version: 1,
    research_as_of_date: overlay.research_as_of_date,
    source_artifact: overlay.source_artifact,
    counts: {
      catalog_products: products.length,
      atlas_cohort_products: products.filter(isAtlasCohortProduct).length,
      previously_included: products.filter(
        (product) =>
          product.verification_grade === 'verified_source' &&
          product.visibility_state === 'prototype_visible',
      ).length,
      newly_included: newlyIncluded.length,
      excluded_candidate_grade: products.filter(
        (product) => product.verification_grade === 'candidate',
      ).length,
      excluded_unknown_grade: products.filter((product) => product.verification_grade === 'unknown')
        .length,
      owner_excluded: getAtlasVisibilityExclusions().size,
      newly_included_market_status: tally(statuses.map((status) => status.marketStatus)),
      newly_included_safety_display: tally(statuses.map((status) => status.safetyDisplay)),
      newly_included_recommendation_gate: tally(
        statuses.map((status) => status.statusRecommendationGate),
      ),
      newly_included_with_authored_options: newlyIncluded.filter(
        (product) => (optionCounts.get(product.product_id) ?? 0) > 0,
      ).length,
    },
  }

  return {
    csv: `${lines.join('\n')}\n`,
    summary: `${JSON.stringify(summary, null, 2)}\n`,
    rowCount: newlyIncluded.length,
  }
}

function main(argv: string[]): void {
  const check = argv.includes('--check')
  const { csv, summary, rowCount } = buildD2bInclusionReview()
  const csvPath = path.join(REPO_ROOT, REVIEW_CSV_RELATIVE_PATH)
  const summaryPath = path.join(REPO_ROOT, REVIEW_SUMMARY_RELATIVE_PATH)
  if (check) {
    const stale = [
      readFileSync(csvPath, 'utf8') === csv ? null : REVIEW_CSV_RELATIVE_PATH,
      readFileSync(summaryPath, 'utf8') === summary ? null : REVIEW_SUMMARY_RELATIVE_PATH,
    ].filter(Boolean)
    if (stale.length > 0) {
      throw new Error(`Stale: ${stale.join(', ')}. Run "npm run ip-intel:d2b-review".`)
    }
    process.stdout.write('D2B inclusion review artifacts are up to date.\n')
    return
  }
  mkdirSync(path.join(REPO_ROOT, OUTPUT_DIR), { recursive: true })
  writeFileSync(csvPath, csv)
  writeFileSync(summaryPath, summary)
  process.stdout.write(
    `Wrote ${REVIEW_CSV_RELATIVE_PATH} (${rowCount} newly included products) and ${REVIEW_SUMMARY_RELATIVE_PATH}.\n`,
  )
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  }
}
