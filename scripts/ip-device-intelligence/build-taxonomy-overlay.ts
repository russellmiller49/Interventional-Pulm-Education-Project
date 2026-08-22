import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { isAtlasCohortProduct } from '../../src/features/device-intelligence/domain/atlas-cohort'
import { isOwnerExcludedFromAtlas } from '../../src/features/device-intelligence/domain/atlas-visibility-exclusions'
import {
  FALLBACK_DEVICE_CLASS,
  FALLBACK_DEVICE_SUBTYPE,
  type ClassificationBasis,
} from '../../src/features/device-intelligence/domain/product-taxonomy'
import {
  taxonomyOverlayArtifactSchema,
  taxonomyRulesArtifactSchema,
  type TaxonomyOverlayArtifact,
  type TaxonomyOverlayRow,
  type TaxonomyRulesArtifact,
} from '../../src/features/device-intelligence/domain/taxonomy-overlay-schema'

/**
 * Build the compact D2C taxonomy overlay from the reviewed classification rules.
 *
 *   npm run ip-intel:taxonomy-overlay             # write
 *   npm run ip-intel:taxonomy-overlay -- --check  # fail if the committed file is stale
 *
 * Classification is fully deterministic and reviewable: for each atlas-cohort product,
 * the FIRST applicable source wins in this fixed precedence —
 *
 *   1. a reviewed per-product override (`product_overrides`),
 *   2. the first reviewed name rule whose exact (primary_category, subcategory) pair
 *      matches and whose pattern tests true against `product_name` (file order),
 *   3. the reviewed pair rule for the exact (primary_category, subcategory) pair,
 *   4. the explicit `other_needs_review` fallback — the product STAYS in the overlay and
 *      stays visible; taxonomy must never become an atlas-visibility gate. The CLR Irrigator
 *      intentionally takes this branch pending review of a precise pleural-irrigation subtype.
 *
 * Row scope is the D2B inclusion-first cohort (`verified_source` minus explicit owner
 * exclusions), evaluated against the canonical catalog at build time: candidate- and
 * unknown-grade identities can never enter this committed artifact. Reviewer notes in the
 * rules file are dropped here — runtime rows carry controlled codes only.
 *
 * Determinism: rows sorted by product id, counts derived from rows, the reviewed rules
 * artifact pinned by sha-256, no clock or environment input. Running it twice produces
 * byte-identical output.
 */

const REPO_ROOT = path.resolve(__dirname, '../..')
export const RULES_RELATIVE_PATH =
  'data/ip-device-intelligence/reviewed/product-taxonomy-rules.json'
const CATALOG_RELATIVE_PATH = 'data/ip-preference-cards/generated/catalog-products.json'
export const OVERLAY_RELATIVE_PATH =
  'data/ip-device-intelligence/generated/product-taxonomy-overlay.json'

export interface TaxonomyCatalogRow {
  product_id: string
  product_name: string
  primary_category?: string | null
  subcategory?: string | null
  verification_grade?: string | null
}

export interface ClassifiedProduct {
  productId: string
  deviceClassCode: string
  deviceSubtypeCode: string
  confidence: 'high' | 'moderate' | 'needs_review'
  needsReview: boolean
  basis: ClassificationBasis
}

/** The one classification implementation, shared by the overlay and review generators. */
export function classifyProduct(
  product: TaxonomyCatalogRow,
  rules: TaxonomyRulesArtifact,
): ClassifiedProduct {
  const assignmentOf = (
    rule: {
      device_class_code: string
      device_subtype_code: string
      confidence: 'high' | 'moderate' | 'needs_review'
      needs_review?: boolean
    },
    basis: ClassificationBasis,
  ): ClassifiedProduct => ({
    productId: product.product_id,
    deviceClassCode: rule.device_class_code,
    deviceSubtypeCode: rule.device_subtype_code,
    confidence: rule.confidence,
    needsReview: rule.confidence === 'needs_review' || rule.needs_review === true,
    basis,
  })

  const override = rules.product_overrides.find(
    (candidate) => candidate.product_id === product.product_id,
  )
  if (override) return assignmentOf(override, 'product_override')

  const nameRule = rules.name_rules.find(
    (candidate) =>
      candidate.primary_category === product.primary_category &&
      candidate.subcategory === product.subcategory &&
      new RegExp(candidate.pattern).test(product.product_name),
  )
  if (nameRule) return assignmentOf(nameRule, 'name_rule')

  const pairRule = rules.pair_rules.find(
    (candidate) =>
      candidate.primary_category === product.primary_category &&
      candidate.subcategory === product.subcategory,
  )
  if (pairRule) return assignmentOf(pairRule, 'pair_rule')

  return {
    productId: product.product_id,
    deviceClassCode: FALLBACK_DEVICE_CLASS,
    deviceSubtypeCode: FALLBACK_DEVICE_SUBTYPE,
    confidence: 'needs_review',
    needsReview: true,
    basis: 'unmatched_fallback',
  }
}

/**
 * D2C-REV-006: the rules file corrects the CURRENT atlas cohort, so every committed
 * override must land on exactly one generated row. An override whose id is unknown,
 * candidate-grade, unknown-grade, or owner-excluded would be a silent no-op riding in a
 * reviewed artifact — rejected before any generation. (Duplicate overrides are already
 * rejected by the rules schema.)
 */
export function validateProductOverrides(
  rules: TaxonomyRulesArtifact,
  catalog: TaxonomyCatalogRow[],
): void {
  const catalogById = new Map(catalog.map((product) => [product.product_id, product]))
  for (const override of rules.product_overrides) {
    const product = catalogById.get(override.product_id)
    if (!product) {
      throw new Error(
        `product override ${override.product_id}: unknown canonical product ID — overrides may only correct current atlas-cohort products`,
      )
    }
    if (!isAtlasCohortProduct(product)) {
      const reason = isOwnerExcludedFromAtlas(product.product_id)
        ? 'owner-excluded from the atlas'
        : `${product.verification_grade ?? 'unknown'}-grade, outside the atlas cohort`
      throw new Error(
        `product override ${override.product_id}: ${reason} — overrides may only correct current atlas-cohort products`,
      )
    }
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values.slice().sort()) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

export function buildTaxonomyOverlay(options: {
  rules: TaxonomyRulesArtifact
  rulesBytes: Buffer
  catalog: TaxonomyCatalogRow[]
}): TaxonomyOverlayArtifact {
  const { rules, rulesBytes, catalog } = options

  validateProductOverrides(rules, catalog)

  const rows: TaxonomyOverlayRow[] = catalog
    .filter(isAtlasCohortProduct)
    .map((product) => {
      const classified = classifyProduct(product, rules)
      return {
        product_id: classified.productId,
        device_class_code: classified.deviceClassCode,
        device_subtype_code: classified.deviceSubtypeCode,
        taxonomy_confidence: classified.confidence,
        needs_review: classified.needsReview,
        classification_basis: classified.basis,
      } as TaxonomyOverlayRow
    })
    .sort((left, right) => left.product_id.localeCompare(right.product_id))

  const artifact = {
    format_version: 1 as const,
    artifact_kind: 'device_intelligence_product_taxonomy_overlay' as const,
    method_version: 'd2c-taxonomy-v1' as const,
    source_rules: {
      path: RULES_RELATIVE_PATH,
      sha256: sha256(rulesBytes),
    },
    row_scope: 'atlas_cohort_verified_source_minus_owner_exclusions' as const,
    counts: {
      rows: rows.length,
      device_class: countBy(rows.map((row) => row.device_class_code)),
      taxonomy_confidence: countBy(rows.map((row) => row.taxonomy_confidence)),
      needs_review: rows.filter((row) => row.needs_review).length,
      classification_basis: countBy(rows.map((row) => row.classification_basis)),
    },
    rows,
  }

  // Validate BEFORE writing: a schema failure must never produce a committed artifact.
  return taxonomyOverlayArtifactSchema.parse(artifact)
}

export function serializeTaxonomyOverlay(artifact: TaxonomyOverlayArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`
}

export function loadTaxonomyInputs(repoRoot = REPO_ROOT): {
  rules: TaxonomyRulesArtifact
  rulesBytes: Buffer
  catalog: TaxonomyCatalogRow[]
} {
  const rulesBytes = readFileSync(path.join(repoRoot, RULES_RELATIVE_PATH))
  const rules = taxonomyRulesArtifactSchema.parse(JSON.parse(rulesBytes.toString('utf8')))
  const catalog = JSON.parse(
    readFileSync(path.join(repoRoot, CATALOG_RELATIVE_PATH), 'utf8'),
  ) as TaxonomyCatalogRow[]
  return { rules, rulesBytes, catalog }
}

export function generateTaxonomyOverlayFile(repoRoot = REPO_ROOT): string {
  return serializeTaxonomyOverlay(buildTaxonomyOverlay(loadTaxonomyInputs(repoRoot)))
}

function main(argv: string[]): void {
  const check = argv.includes('--check')
  const target = path.join(REPO_ROOT, OVERLAY_RELATIVE_PATH)
  const next = generateTaxonomyOverlayFile()
  if (check) {
    const current = readFileSync(target, 'utf8')
    if (current !== next) {
      throw new Error(
        `${OVERLAY_RELATIVE_PATH} is stale. Run "npm run ip-intel:taxonomy-overlay" and commit the result.`,
      )
    }
    process.stdout.write(`${OVERLAY_RELATIVE_PATH} is up to date.\n`)
    return
  }
  writeFileSync(target, next)
  const parsed = JSON.parse(next) as TaxonomyOverlayArtifact
  process.stdout.write(
    `Wrote ${OVERLAY_RELATIVE_PATH}: ${parsed.rows.length} rows, ${Buffer.byteLength(next)} bytes.\n`,
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
