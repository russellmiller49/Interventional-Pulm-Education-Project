import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import taxonomyOverlayJson from '../../../../data/ip-device-intelligence/generated/product-taxonomy-overlay.json'
import productsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'

import {
  buildTaxonomyOverlay,
  loadTaxonomyInputs,
  serializeTaxonomyOverlay,
} from '../../../../scripts/ip-device-intelligence/build-taxonomy-overlay'
import { isAtlasCohortProduct } from '@/features/device-intelligence/domain/atlas-cohort'
import { taxonomyOverlayArtifactSchema } from '@/features/device-intelligence/domain/taxonomy-overlay-schema'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  getProductTaxonomy,
  getTaxonomyOverlayProvenance,
} from '@/features/device-intelligence/server/product-taxonomy.server'

/**
 * D2C coverage and generator contract over the COMMITTED artifact: exactly one taxonomy
 * row per atlas-cohort product, no candidate/unknown identity, byte-deterministic
 * regeneration, and a closed schema that rejects malformed rows.
 */

const REPO_ROOT = join(__dirname, '../../../..')

describe('D2C taxonomy overlay coverage', () => {
  const artifact = taxonomyOverlayArtifactSchema.parse(taxonomyOverlayJson)

  it('holds exactly one row for each of the 1,331 atlas-cohort products', () => {
    const cohortIds = getAtlasCatalogStore()
      .products.map((product) => product.product_id)
      .sort()
    expect(cohortIds.length).toBe(1331)
    expect(artifact.rows.map((row) => row.product_id)).toEqual(cohortIds)
    expect(artifact.counts.rows).toBe(1331)
  })

  it('contains no candidate-grade or unknown-grade identity', () => {
    const gradeById = new Map(
      (productsJson as { product_id: string; verification_grade?: string | null }[]).map(
        (product) => [product.product_id, product.verification_grade],
      ),
    )
    for (const row of artifact.rows) {
      expect(gradeById.get(row.product_id)).toBe('verified_source')
    }
  })

  it('reconciles every count with the rows', () => {
    const classCounts: Record<string, number> = {}
    const confidenceCounts: Record<string, number> = {}
    const basisCounts: Record<string, number> = {}
    let needsReview = 0
    for (const row of artifact.rows) {
      classCounts[row.device_class_code] = (classCounts[row.device_class_code] ?? 0) + 1
      confidenceCounts[row.taxonomy_confidence] =
        (confidenceCounts[row.taxonomy_confidence] ?? 0) + 1
      basisCounts[row.classification_basis] = (basisCounts[row.classification_basis] ?? 0) + 1
      if (row.needs_review) needsReview += 1
    }
    expect(artifact.counts.device_class).toEqual(classCounts)
    expect(artifact.counts.taxonomy_confidence).toEqual(confidenceCounts)
    expect(artifact.counts.classification_basis).toEqual(basisCounts)
    expect(artifact.counts.needs_review).toBe(needsReview)
    const classTotal = Object.values(classCounts).reduce((sum, count) => sum + count, 0)
    expect(classTotal).toBe(1331)
  })

  it('classifies every product from a reviewed rule — the unmatched fallback is unused', () => {
    expect(artifact.counts.classification_basis.unmatched_fallback ?? 0).toBe(0)
    expect(artifact.counts.device_class.other_needs_review ?? 0).toBe(0)
  })

  it('is byte-identical to a fresh generation from the reviewed rules (twice)', () => {
    const committed = readFileSync(
      join(REPO_ROOT, 'data/ip-device-intelligence/generated/product-taxonomy-overlay.json'),
      'utf8',
    )
    const inputs = loadTaxonomyInputs(REPO_ROOT)
    const first = serializeTaxonomyOverlay(buildTaxonomyOverlay(inputs))
    const second = serializeTaxonomyOverlay(buildTaxonomyOverlay(inputs))
    expect(first).toBe(committed)
    expect(second).toBe(first)
  })

  it('pins the exact reviewed rules bytes it was generated from', () => {
    const provenance = getTaxonomyOverlayProvenance()
    expect(provenance.rowCount).toBe(1331)
    expect(artifact.source_rules.sha256).toBe(provenance.sourceRulesSha256)
    const rulesBytes = readFileSync(join(REPO_ROOT, artifact.source_rules.path))
    expect(createHash('sha256').update(rulesBytes).digest('hex')).toBe(artifact.source_rules.sha256)
  })

  it('resolves a taxonomy for every cohort product at runtime, never the fallback today', () => {
    for (const product of getAtlasCatalogStore().products) {
      const taxonomy = getProductTaxonomy(product.product_id)
      expect(taxonomy.deviceClassCode).not.toBe('other_needs_review')
    }
  })

  it('stays an honest total function for an id with no row', () => {
    const taxonomy = getProductTaxonomy('PRD-0000000000')
    expect(taxonomy.deviceClassCode).toBe('other_needs_review')
    expect(taxonomy.needsReview).toBe(true)
  })
})

describe('D2C taxonomy overlay schema walls', () => {
  const base = taxonomyOverlayArtifactSchema.parse(taxonomyOverlayJson)
  const reserialize = (mutate: (artifact: typeof base) => void) => {
    const copy = JSON.parse(JSON.stringify(taxonomyOverlayJson)) as typeof base
    mutate(copy)
    return taxonomyOverlayArtifactSchema.safeParse(copy)
  }

  it('rejects a duplicate product id', () => {
    const result = reserialize((artifact) => {
      artifact.rows[1] = { ...artifact.rows[0] }
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown device class code', () => {
    const result = reserialize((artifact) => {
      artifact.rows[0] = { ...artifact.rows[0], device_class_code: 'Airway stenting' as never }
    })
    expect(result.success).toBe(false)
  })

  it('rejects a subtype that does not belong to its class', () => {
    const result = reserialize((artifact) => {
      artifact.rows[0] = {
        ...artifact.rows[0],
        device_class_code: 'guidewire',
        device_subtype_code: 'airway_sizing_device',
      } as never
    })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed product id', () => {
    const result = reserialize((artifact) => {
      artifact.rows[0] = { ...artifact.rows[0], product_id: 'not-a-product-id' }
    })
    expect(result.success).toBe(false)
  })

  it('rejects unsorted rows', () => {
    const result = reserialize((artifact) => {
      const [first, second] = artifact.rows
      artifact.rows[0] = second
      artifact.rows[1] = first
    })
    expect(result.success).toBe(false)
  })

  it('rejects a free-text field smuggled into a row', () => {
    const result = reserialize((artifact) => {
      artifact.rows[0] = { ...artifact.rows[0], rationale: 'prose' } as never
    })
    expect(result.success).toBe(false)
  })

  it('rejects a needs_review confidence without the needs_review flag', () => {
    const result = reserialize((artifact) => {
      artifact.rows[0] = {
        ...artifact.rows[0],
        taxonomy_confidence: 'needs_review',
        needs_review: false,
      }
    })
    expect(result.success).toBe(false)
  })

  it('excludes a candidate-grade product even if the catalog input drifts', () => {
    // The generator filters through the SAME cohort predicate as the atlas store.
    const inputs = loadTaxonomyInputs(REPO_ROOT)
    const candidateRow = (
      productsJson as { product_id: string; verification_grade?: string | null }[]
    ).find((product) => product.verification_grade === 'candidate')!
    expect(isAtlasCohortProduct(candidateRow)).toBe(false)
    const artifact = buildTaxonomyOverlay(inputs)
    expect(artifact.rows.some((row) => row.product_id === candidateRow.product_id)).toBe(false)
  })
})
