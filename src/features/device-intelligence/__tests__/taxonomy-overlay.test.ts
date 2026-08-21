import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import taxonomyOverlayJson from '../../../../data/ip-device-intelligence/generated/product-taxonomy-overlay.json'
import productsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'

import {
  buildTaxonomyOverlay,
  loadTaxonomyInputs,
  serializeTaxonomyOverlay,
  validateProductOverrides,
} from '../../../../scripts/ip-device-intelligence/build-taxonomy-overlay'
import { stableId } from '../../../../scripts/ip-preference-cards/catalog-utils'
import {
  expandSourceCompletenessProducts,
  sourceCompletenessCount,
} from '../../../../scripts/ip-preference-cards/source-completeness-intake'
import { isAtlasCohortProduct } from '@/features/device-intelligence/domain/atlas-cohort'
import {
  taxonomyOverlayArtifactSchema,
  taxonomyRulesArtifactSchema,
} from '@/features/device-intelligence/domain/taxonomy-overlay-schema'
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

  it('holds exactly one row for each contract-governed atlas-cohort product', () => {
    const cohortIds = getAtlasCatalogStore()
      .products.map((product) => product.product_id)
      .sort()
    expect(cohortIds.length).toBe(sourceCompletenessCount('taxonomy_rows_after'))
    expect(artifact.rows.map((row) => row.product_id)).toEqual(cohortIds)
    expect(artifact.counts.rows).toBe(sourceCompletenessCount('taxonomy_rows_after'))
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
    expect(classTotal).toBe(sourceCompletenessCount('taxonomy_rows_after'))
  })

  it('classifies every product while preserving the intentional CLR fallback and review holds', () => {
    expect(artifact.counts.classification_basis.unmatched_fallback ?? 0).toBe(1)
    expect(artifact.counts.device_class.other_needs_review ?? 0).toBe(6)
    expect(artifact.counts.needs_review).toBe(
      sourceCompletenessCount('taxonomy_needs_review_after'),
    )
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
    expect(provenance.rowCount).toBe(sourceCompletenessCount('taxonomy_rows_after'))
    expect(artifact.source_rules.sha256).toBe(provenance.sourceRulesSha256)
    const rulesBytes = readFileSync(join(REPO_ROOT, artifact.source_rules.path))
    expect(createHash('sha256').update(rulesBytes).digest('hex')).toBe(artifact.source_rules.sha256)
  })

  it('resolves every cohort product and exposes only the six other-class review holds', () => {
    const explicitReviewHolds: string[] = []
    for (const product of getAtlasCatalogStore().products) {
      const taxonomy = getProductTaxonomy(product.product_id)
      if (taxonomy.deviceClassCode === 'other_needs_review') {
        explicitReviewHolds.push(product.product_id)
        expect(taxonomy.needsReview).toBe(true)
      }
    }
    expect(explicitReviewHolds).toHaveLength(6)
  })

  it('applies the one narrow new pair rule only to the Narwhal cartridge and leaves CLR honest', () => {
    const catalog = productsJson as {
      product_id: string
      catalog_number: string | null
      primary_category: string | null
      subcategory: string | null
    }[]
    const cryotherapyConsumables = catalog.filter(
      (product) =>
        product.primary_category === 'Therapeutic bronchoscopy' &&
        product.subcategory === 'Cryotherapy consumable',
    )
    expect(cryotherapyConsumables.map((product) => product.catalog_number)).toEqual(['CC-1000-4'])
    expect(getProductTaxonomy(cryotherapyConsumables[0].product_id)).toMatchObject({
      deviceClassCode: 'cryotherapy',
      deviceSubtypeCode: 'cryotherapy_accessory',
      taxonomyConfidence: 'high',
      needsReview: false,
    })

    const clrIrrigatorId = stableId('PRD', 'CLR Medical|S012-01-019')
    expect(getProductTaxonomy(clrIrrigatorId)).toMatchObject({
      deviceClassCode: 'other_needs_review',
      deviceSubtypeCode: 'unclassified_device',
      taxonomyConfidence: 'needs_review',
      needsReview: true,
    })
    const additionIds = new Set(
      expandSourceCompletenessProducts().map((product) =>
        stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`),
      ),
    )
    expect(artifact.rows.filter((row) => additionIds.has(row.product_id))).toHaveLength(
      sourceCompletenessCount('new_exact_products'),
    )
    for (const product of expandSourceCompletenessProducts()) {
      expect(
        getProductTaxonomy(stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`)),
      ).toMatchObject({
        deviceClassCode: product.taxonomyClass,
        deviceSubtypeCode: product.taxonomySubtype,
        taxonomyConfidence: product.taxonomyConfidence,
      })
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

  it('rejects a committed override for an unknown canonical product ID (D2C-REV-006)', () => {
    const inputs = loadTaxonomyInputs(REPO_ROOT)
    const rules = {
      ...inputs.rules,
      product_overrides: [
        {
          product_id: 'PRD-0000000000',
          device_class_code: 'accessory',
          device_subtype_code: 'bite_block',
          confidence: 'high',
        } as never,
      ],
    }
    expect(() => buildTaxonomyOverlay({ ...inputs, rules })).toThrow(
      /PRD-0000000000: unknown canonical product ID/,
    )
  })

  it('rejects a committed override for a candidate-grade (non-cohort) product ID', () => {
    const inputs = loadTaxonomyInputs(REPO_ROOT)
    const candidateRow = (
      productsJson as { product_id: string; verification_grade?: string | null }[]
    ).find((product) => product.verification_grade === 'candidate')!
    const rules = {
      ...inputs.rules,
      product_overrides: [
        {
          product_id: candidateRow.product_id,
          device_class_code: 'accessory',
          device_subtype_code: 'bite_block',
          confidence: 'high',
        } as never,
      ],
    }
    expect(() => buildTaxonomyOverlay({ ...inputs, rules })).toThrow(
      /candidate-grade, outside the atlas cohort/,
    )
    expect(() => validateProductOverrides(rules as never, inputs.catalog)).toThrow(
      new RegExp(candidateRow.product_id),
    )
  })

  it('rejects a duplicate committed override at the rules schema', () => {
    const inputs = loadTaxonomyInputs(REPO_ROOT)
    const override = {
      product_id: base.rows[0].product_id,
      device_class_code: 'accessory',
      device_subtype_code: 'bite_block',
      confidence: 'high',
    }
    const result = taxonomyRulesArtifactSchema.safeParse({
      ...JSON.parse(JSON.stringify(inputs.rules)),
      product_overrides: [override, { ...override }],
    })
    expect(result.success).toBe(false)
  })

  it('applies a valid cohort override to exactly one generated row, never zero', () => {
    const inputs = loadTaxonomyInputs(REPO_ROOT)
    const target = base.rows[0].product_id
    const rules = {
      ...inputs.rules,
      product_overrides: [
        {
          product_id: target,
          device_class_code: 'accessory',
          device_subtype_code: 'bite_block',
          confidence: 'moderate',
        } as never,
      ],
    }
    const rebuilt = buildTaxonomyOverlay({ ...inputs, rules })
    const overridden = rebuilt.rows.filter((row) => row.classification_basis === 'product_override')
    expect(overridden.length).toBe(1)
    expect(overridden[0]).toMatchObject({
      product_id: target,
      device_class_code: 'accessory',
      device_subtype_code: 'bite_block',
      taxonomy_confidence: 'moderate',
    })
    // Exactly one row changed relative to the committed artifact.
    const changed = rebuilt.rows.filter(
      (row, index) => JSON.stringify(row) !== JSON.stringify(base.rows[index]),
    )
    expect(changed.map((row) => row.product_id)).toEqual([target])
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

describe('D2C rules schema source and pair-key delimiter (D2C-REV-007)', () => {
  it('contains no literal NUL byte — the delimiter is the reviewable \\u0000 escape', () => {
    const source = readFileSync(
      join(REPO_ROOT, 'src/features/device-intelligence/domain/taxonomy-overlay-schema.ts'),
    )
    expect(source.includes(0)).toBe(false)
    expect(source.toString('utf8')).toContain('\\u0000')
  })

  it('keeps NUL-delimiter semantics: split pair names never collide, true duplicates do', () => {
    const inputs = loadTaxonomyInputs(REPO_ROOT)
    const assignment = {
      device_class_code: 'accessory',
      device_subtype_code: 'bite_block',
      confidence: 'high',
    }
    // ("A B", "C") vs ("A", "B C") — a space-delimited key would falsely collide.
    const distinct = taxonomyRulesArtifactSchema.safeParse({
      ...JSON.parse(JSON.stringify(inputs.rules)),
      pair_rules: [
        ...inputs.rules.pair_rules,
        { primary_category: 'A B', subcategory: 'C', ...assignment },
        { primary_category: 'A', subcategory: 'B C', ...assignment },
      ],
    })
    expect(distinct.success).toBe(true)
    const duplicate = taxonomyRulesArtifactSchema.safeParse({
      ...JSON.parse(JSON.stringify(inputs.rules)),
      pair_rules: [
        ...inputs.rules.pair_rules,
        { primary_category: 'A B', subcategory: 'C', ...assignment },
        { primary_category: 'A B', subcategory: 'C', ...assignment },
      ],
    })
    expect(duplicate.success).toBe(false)
  })
})
