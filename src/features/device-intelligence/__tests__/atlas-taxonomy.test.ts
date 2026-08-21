import { catalogSearchSchema } from '@/features/preference-cards/schemas/catalog-search'
import { sourceCompletenessCount } from '../../../../scripts/ip-preference-cards/source-completeness-intake'
import { searchCatalog } from '@/features/preference-cards/server/catalog'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  getAtlasFacets,
  searchAtlas,
  validateAtlasFilters,
} from '@/features/device-intelligence/server/atlas.server'
import {
  getProductTaxonomy,
  getTaxonomyLabels,
  matchTaxonomyCodesForQuery,
} from '@/features/device-intelligence/server/product-taxonomy.server'

/**
 * D2C atlas behavior: the Device-class facet filters by the normalized overlay (never by
 * canonical primary_category), taxonomy labels are searchable in every locale, exact
 * catalog-number search is untouched, and taxonomy state never gates visibility.
 */

const store = getAtlasCatalogStore()
const parse = (input: Record<string, unknown>) => catalogSearchSchema.parse(input)

const idsForClass = (deviceClass: string) =>
  store.products
    .filter((product) => getProductTaxonomy(product.product_id).deviceClassCode === deviceClass)
    .map((product) => product.product_id)
    .sort()

const allResults = (input: Record<string, unknown>) => {
  const items: string[] = []
  let page = 1
  let pageCount = 1
  do {
    const response = searchAtlas(parse({ ...input, page, pageSize: 100 }))
    pageCount = response.pageCount
    items.push(...response.items.map((item) => item.productId))
    page += 1
  } while (page <= pageCount)
  return items
}

describe('D2C device-class facet', () => {
  it('reconciles facet counts with the contract-governed cohort', () => {
    const facets = getAtlasFacets()
    const total = facets.deviceClasses.reduce((sum, facet) => sum + facet.productCount, 0)
    expect(total).toBe(sourceCompletenessCount('verified_source_products_after'))
    for (const facet of facets.deviceClasses) {
      expect(facet.productCount).toBe(idsForClass(facet.code).length)
      expect(facet.productCount).toBeGreaterThan(0)
    }
    // The reviewed intake intentionally holds six products in the owner-review class.
    expect(
      facets.deviceClasses.find((facet) => facet.code === 'other_needs_review')?.productCount,
    ).toBe(6)
    // Every class label resolves in every locale.
    for (const locale of ['en', 'es', 'zh-CN']) {
      const labels = getTaxonomyLabels(locale)
      for (const facet of facets.deviceClasses) {
        expect(labels.classes[facet.code]?.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('returns every guidewire across the old source categories for deviceClass=guidewire', () => {
    const results = allResults({ deviceClass: 'guidewire' })
    expect(results.sort()).toEqual(idsForClass('guidewire'))
    expect(results.length).toBe(6)
    const names = results.map((id) => store.productById.get(id)!.product_name).sort()
    expect(names).toEqual([
      'Amplatz Super Stiff Guidewire',
      'Hydro-Slide Pulmonary Guidewire, 0.035 in x 180 cm',
      'Hydro-Slide Pulmonary Guidewire, 0.035 in x 260 cm',
      'Jagwire Single-Use Pulmonary Guidewire',
      'MAXXwire Guide Wire',
      'MAXXwire Guide Wire',
    ])
    // Products from BOTH old categories are present.
    const sourceCategories = new Set(
      results.map((id) => store.productById.get(id)!.primary_category),
    )
    expect(sourceCategories).toEqual(new Set(['Guidewire', 'Airway stenting']))
    // The AEROSIZER never appears in the Guidewire class.
    const aerosizer = store.products.find(
      (product) => product.product_name === 'AEROSIZER Airway Sizing Device',
    )!
    expect(results).not.toContain(aerosizer.product_id)
  })

  it('returns bronchoscopes from every manufacturer for deviceClass=bronchoscope', () => {
    const results = allResults({ deviceClass: 'bronchoscope' })
    expect(results.sort()).toEqual(idsForClass('bronchoscope'))
    const manufacturers = new Set(
      results.map((id) => store.productById.get(id)!.manufacturerDisplay),
    )
    expect(manufacturers.has('Olympus')).toBe(true)
    expect(manufacturers.has('FUJIFILM')).toBe(true)
    expect(manufacturers.size).toBeGreaterThanOrEqual(4)
  })

  it('composes the device-class facet with role, procedure, and manufacturer filters', () => {
    const roleScoped = allResults({ deviceClass: 'bronchoscope', role: 'EBUS_SCOPE' })
    expect(roleScoped.length).toBeGreaterThan(0)
    for (const id of roleScoped) {
      expect(getProductTaxonomy(id).deviceClassCode).toBe('bronchoscope')
    }
    // Role and procedure filters still work on their own, unchanged by D2C.
    const roleOnly = allResults({ role: 'EBUS_SCOPE' })
    expect(roleOnly.length).toBeGreaterThanOrEqual(roleScoped.length)
    const procedureScoped = allResults({ deviceClass: 'needle', procedure: 'EBUS_TBNA' })
    for (const id of procedureScoped) {
      expect(getProductTaxonomy(id).deviceClassCode).toBe('needle')
    }
  })

  it('rejects an unknown device-class value as a friendly notice, not a crash', () => {
    expect(validateAtlasFilters(parse({ deviceClass: 'not_a_class' }))).toBe('device class')
    expect(validateAtlasFilters(parse({ deviceClass: 'guidewire' }))).toBeNull()
  })

  it('never applies the retired legacy category filter on the atlas', () => {
    // A stale bookmark carrying ?category=Airway stenting gets the full unfiltered
    // results (the page shows the honest replacement notice alongside).
    const withLegacy = searchAtlas(parse({ category: 'Airway stenting' }))
    const without = searchAtlas(parse({}))
    expect(withLegacy.total).toBe(without.total)
    expect(withLegacy.total).toBe(sourceCompletenessCount('verified_source_products_after'))
    // The preserved preference-card catalog keeps exact category filtering.
    const catalogScoped = searchCatalog(parse({ category: 'Airway stenting' }), store)
    expect(catalogScoped.total).toBe(3)
  })

  it('never applies the retired legacy subcategory filter on the atlas (D2C-REV-005)', () => {
    const withLegacy = searchAtlas(parse({ subcategory: 'Pulmonary guidewire' }))
    expect(withLegacy.total).toBe(sourceCompletenessCount('verified_source_products_after'))
    // The preserved preference-card catalog keeps exact subcategory filtering.
    const catalogScoped = searchCatalog(parse({ subcategory: 'Pulmonary guidewire' }), store)
    expect(catalogScoped.total).toBeGreaterThan(0)
    expect(catalogScoped.total).toBeLessThan(
      sourceCompletenessCount('verified_source_products_after'),
    )
  })

  it('offers the corrected Retrieval basket class as a facet with its full basket cohort', () => {
    const facets = getAtlasFacets()
    const basketFacet = facets.deviceClasses.find((facet) => facet.code === 'retrieval_basket')
    expect(basketFacet?.productCount).toBe(5)
    const results = allResults({ deviceClass: 'retrieval_basket' })
    expect(results.slice().sort()).toEqual(idsForClass('retrieval_basket'))
    // The retired mixed class is not a facet and not a valid filter value.
    expect(facets.deviceClasses.map((facet) => facet.code)).not.toContain('retrieval_device')
    expect(validateAtlasFilters(parse({ deviceClass: 'retrieval_device' }))).toBe('device class')
  })
})

describe('D2C taxonomy search', () => {
  it('matches class and subtype labels deterministically', () => {
    expect([...matchTaxonomyCodesForQuery('guidewire').classCodes]).toContain('guidewire')
    expect([...matchTaxonomyCodesForQuery('EBUS bronchoscope').subtypeCodes]).toContain(
      'ebus_bronchoscope',
    )
    expect([...matchTaxonomyCodesForQuery('sizing device').classCodes]).toContain(
      'sizing_measuring',
    )
    // Too-short and unrelated queries match nothing.
    expect(matchTaxonomyCodesForQuery('gu').classCodes.size).toBe(0)
    expect(matchTaxonomyCodesForQuery('BF-MP190F').classCodes.size).toBe(0)
    expect(matchTaxonomyCodesForQuery('BF-MP190F').subtypeCodes.size).toBe(0)
  })

  it('returns the normalized guidewire cohort for the query "guidewire"', () => {
    const results = allResults({ q: 'guidewire' })
    for (const id of idsForClass('guidewire')) {
      expect(results).toContain(id)
    }
  })

  it('returns the normalized cohorts for "bronchoscope", "EBUS bronchoscope", and "sizing device"', () => {
    const bronchoscopes = allResults({ q: 'bronchoscope' })
    for (const id of idsForClass('bronchoscope')) {
      expect(bronchoscopes).toContain(id)
    }
    const ebusScopes = allResults({ q: 'EBUS bronchoscope' })
    for (const product of store.products) {
      if (getProductTaxonomy(product.product_id).deviceSubtypeCode === 'ebus_bronchoscope') {
        expect(ebusScopes).toContain(product.product_id)
      }
    }
    const sizing = allResults({ q: 'sizing device' })
    const aerosizer = store.products.find(
      (product) => product.product_name === 'AEROSIZER Airway Sizing Device',
    )!
    expect(sizing).toContain(aerosizer.product_id)
  })

  it('finds the normalized cohort by Spanish and Chinese labels too', () => {
    const spanish = allResults({ q: 'Alambre guía' })
    for (const id of idsForClass('guidewire')) expect(spanish).toContain(id)
    const chinese = allResults({ q: '支气管镜' })
    for (const id of idsForClass('bronchoscope')) expect(chinese).toContain(id)
  })

  it('expands an exact Chinese class label to exactly the Bronchoscope class (D2C-REV-004)', () => {
    // 支气管镜 IS the controlled zh-CN class label: taxonomy expansion adds that class
    // only, never the accessory/forceps/telescope/needle cohorts whose subtype labels
    // merely contain the phrase. Product names are Latin, so no fuzzy name noise here:
    // the result is exactly the Bronchoscope-class cohort.
    const match = matchTaxonomyCodesForQuery('支气管镜')
    expect([...match.classCodes]).toEqual(['bronchoscope'])
    expect(match.subtypeCodes.size).toBe(0)
    const results = allResults({ q: '支气管镜' })
    const bronchoscopes = idsForClass('bronchoscope')
    expect(bronchoscopes.length).toBe(165)
    expect(results.slice().sort()).toEqual(bronchoscopes)
  })

  it('gives exact English and Spanish class labels the same class-only precedence', () => {
    for (const query of ['Bronchoscope', 'bronchoscope', 'Broncoscopio']) {
      const match = matchTaxonomyCodesForQuery(query)
      expect([...match.classCodes]).toEqual(['bronchoscope'])
      expect(match.subtypeCodes.size).toBe(0)
    }
    const guidewire = matchTaxonomyCodesForQuery('Guidewire')
    expect([...guidewire.classCodes]).toEqual(['guidewire'])
    expect(guidewire.subtypeCodes.size).toBe(0)
  })

  it('keeps additive class+subtype expansion for non-exact class phrases', () => {
    // A phrase that is NOT a controlled class label keeps the pre-correction additive
    // behavior: subtype labels still match ("EBUS bronchoscope"), token matching still
    // works ("sizing device").
    const ebus = matchTaxonomyCodesForQuery('EBUS bronchoscope')
    expect([...ebus.subtypeCodes]).toContain('ebus_bronchoscope')
    const sizing = matchTaxonomyCodesForQuery('sizing device')
    expect([...sizing.classCodes]).toContain('sizing_measuring')
  })

  it('leaves exact catalog-number search untouched, exact matches first', () => {
    const response = searchAtlas(parse({ q: 'BF-MP190F' }))
    expect(response.items[0].catalogNumber).toBe('BF-MP190F')
    // Identical leading results to the pre-taxonomy pipeline for an exact identifier.
    const baseline = searchCatalog(parse({ q: 'BF-MP190F' }), store)
    expect(response.items[0].productId).toBe(baseline.items[0].productId)
  })

  it('exposes no candidate or unknown identity through taxonomy search paths', () => {
    for (const query of ['guidewire', 'bronchoscope', 'EBUS bronchoscope', 'sizing device']) {
      for (const id of allResults({ q: query })) {
        expect(store.productById.has(id)).toBe(true)
      }
    }
  })

  it('attaches a total taxonomy map to every results page', () => {
    const response = searchAtlas(parse({ q: 'bronchoscope', pageSize: 100 }))
    for (const item of response.items) {
      const taxonomy = response.taxonomyByProductId[item.productId]
      expect(taxonomy).toBeDefined()
      expect(taxonomy.deviceClassCode.length).toBeGreaterThan(0)
      expect(taxonomy.deviceSubtypeCode.length).toBeGreaterThan(0)
    }
  })
})

describe('D2C taxonomy is never a gate', () => {
  it('keeps needs-review and moderate-confidence products fully visible and searchable', () => {
    const flagged = store.products.filter(
      (product) => getProductTaxonomy(product.product_id).needsReview,
    )
    expect(flagged.length).toBeGreaterThan(0)
    for (const product of flagged) {
      const hits = searchAtlas(parse({ q: product.product_name.slice(0, 40) }))
      expect(hits.items.map((item) => item.productId)).toContain(product.product_id)
    }
    // The unfiltered index still lists every cohort product, with no taxonomy wall.
    expect(searchAtlas(parse({})).total).toBe(
      sourceCompletenessCount('verified_source_products_after'),
    )
  })
})
