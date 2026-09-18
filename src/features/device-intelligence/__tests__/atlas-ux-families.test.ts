import {
  catalogSearchSchema,
  type CatalogSearchQuery,
} from '@/features/preference-cards/schemas/catalog-search'
import { parseGaugeValues } from '@/features/preference-cards/server/catalog'
import {
  groupAtlasFamilies,
  type AtlasFamilyMember,
} from '@/features/device-intelligence/domain/atlas-families'
import {
  safetyDisplayIsMaterialOnCards,
  statusNeedsAttention,
  UNRESEARCHED_PRODUCT_STATUS,
  type ProductStatusView,
} from '@/features/device-intelligence/domain/product-status'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  getAtlasProductDetail,
  searchAtlas,
} from '@/features/device-intelligence/server/atlas.server'
import { getProductStatus } from '@/features/device-intelligence/server/product-status.server'
import { getProductTaxonomy } from '@/features/device-intelligence/server/product-taxonomy.server'

/**
 * Family-first discovery. A "family" is a manufacturer product line used for display only;
 * these tests pin the two rules that keep it honest — filters run on models BEFORE grouping,
 * and model-level facts (safety, status) are never generalized to the line.
 */

const parse = (input: Record<string, unknown> = {}): CatalogSearchQuery =>
  catalogSearchSchema.parse(input)

const EXACT_CATALOG_NUMBER = 'NA-U401SX-4022-A'
const EXACT_PRODUCT_ID = 'PRD-1BCD8D38BC'

describe('filters operate on models before family grouping', () => {
  it('lists only the matching models inside a filtered family', () => {
    const store = getAtlasCatalogStore()
    const all = searchAtlas(parse({ deviceClass: 'needle', view: 'families', pageSize: 100 }))
    const filtered = searchAtlas(
      parse({ deviceClass: 'needle', gauge: 21, view: 'families', pageSize: 100 }),
    )
    expect(filtered.families.length).toBeGreaterThan(0)
    let narrowedFamilies = 0
    for (const family of filtered.families) {
      // Every model shown in a filtered family satisfies the filter itself...
      for (const model of family.models) {
        expect(parseGaugeValues(store.productById.get(model.productId)!.gauge)).toContain(21)
      }
      // ...and a family's siblings that did not match are simply absent from it.
      const unfiltered = all.families.find((candidate) => candidate.groupKey === family.groupKey)!
      expect(unfiltered).toBeDefined()
      expect(family.models.length).toBeLessThanOrEqual(unfiltered.models.length)
      if (family.models.length < unfiltered.models.length) narrowedFamilies += 1
    }
    // The cohort really exercises the rule: some line has both matching and non-matching models.
    expect(narrowedFamilies).toBeGreaterThan(0)
    // Family totals count matching MODELS, identically to the model view.
    const asModels = searchAtlas(parse({ deviceClass: 'needle', gauge: 21, pageSize: 100 }))
    expect(filtered.total).toBe(asModels.total)
    expect(filtered.families.flatMap((family) => family.modelIds).sort()).toEqual(
      asModels.items.map((item) => item.productId).sort(),
    )
  })

  it('keeps individual-model mode working with its own pagination', () => {
    const models = searchAtlas(parse({ deviceClass: 'airway_stent', view: 'models', pageSize: 25 }))
    expect(models.items).toHaveLength(25)
    expect(models.pageCount).toBe(Math.ceil(models.total / 25))
    const families = searchAtlas(
      parse({ deviceClass: 'airway_stent', view: 'families', pageSize: 25 }),
    )
    expect(families.total).toBe(models.total)
    expect(families.familyTotal).toBeLessThan(models.total)
    expect(families.pageCount).toBe(Math.ceil(families.familyTotal! / 25))
    // Side maps are total over everything the family page renders.
    for (const family of families.families) {
      for (const id of family.modelIds) {
        expect(families.statusByProductId[id]).toBeDefined()
        expect(families.taxonomyByProductId[id]).toBeDefined()
      }
    }
  })
})

describe('a product line is a validated, display-only grouping', () => {
  it('never spans device subtypes, even when a brand range covers many device classes', () => {
    const everything = searchAtlas(parse({ view: 'families', pageSize: 100, page: 1 }))
    expect(everything.familyTotal).toBeGreaterThan(200)
    const store = getAtlasCatalogStore()
    let page = 1
    let seen = 0
    while (page <= everything.pageCount) {
      const results = searchAtlas(parse({ view: 'families', pageSize: 100, page }))
      for (const family of results.families) {
        seen += family.models.length
        const subtypes = new Set(
          family.modelIds.map((id) => getProductTaxonomy(id).deviceSubtypeCode),
        )
        const lines = new Set(family.modelIds.map((id) => store.productById.get(id)!.familyKey))
        const manufacturers = new Set(family.models.map((model) => model.manufacturerGroupId))
        expect(subtypes.size).toBe(1)
        expect(lines.size).toBe(1)
        expect(manufacturers.size).toBe(1)
      }
      page += 1
    }
    // Grouping neither drops nor duplicates a model.
    expect(seen).toBe(everything.total)
  })

  it('flags lines named from a catalog category because no brand family is recorded', () => {
    const store = getAtlasCatalogStore()
    const results = searchAtlas(
      parse({ deviceClass: 'pleural_drainage', view: 'families', pageSize: 100 }),
    )
    const fallback = results.families.filter((family) => family.nameBasis === 'catalog_grouping')
    expect(fallback.length).toBeGreaterThan(0)
    for (const family of fallback) {
      for (const id of family.modelIds) {
        expect(store.productById.get(id)!.brand_family?.trim() ?? '').toBe('')
      }
    }
  })

  it('offers same-line navigation only to siblings of the same line AND subtype', () => {
    const store = getAtlasCatalogStore()
    let checked = 0
    for (const product of store.products.slice(0, 400)) {
      const detail = getAtlasProductDetail(product.product_id)!
      for (const sibling of detail.sameManufacturerLine) {
        const record = store.productById.get(sibling.productId)!
        expect(record.familyKey).toBe(product.familyKey)
        expect(getProductTaxonomy(sibling.productId).deviceSubtypeCode).toBe(
          detail.taxonomy.deviceSubtypeCode,
        )
        expect(sibling.productId).not.toBe(product.product_id)
        // A sibling carries ITS OWN status, never the viewed product's.
        expect(sibling.status).toEqual(getProductStatus(sibling.productId))
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
})

describe('family grouping never changes exact-identifier behavior', () => {
  it('pins the exact model above the families and keeps its family complete', () => {
    const results = searchAtlas(parse({ q: EXACT_CATALOG_NUMBER, view: 'families' }))
    expect(results.exactMatches.map((item) => item.productId)).toEqual([EXACT_PRODUCT_ID])
    expect(results.items[0].productId).toBe(EXACT_PRODUCT_ID)
    // The exact model is ALSO still counted inside its own line: pinning is additive.
    const home = results.families.find((family) => family.modelIds.includes(EXACT_PRODUCT_ID))
    expect(home).toBeDefined()
    const modelView = searchAtlas(parse({ q: EXACT_CATALOG_NUMBER, view: 'models' }))
    expect(results.total).toBe(modelView.total)
    expect(modelView.items[0].productId).toBe(EXACT_PRODUCT_ID)
  })
})

describe('model-level safety is never generalized to the line', () => {
  it('counts exactly the affected models and leaves unaffected siblings unmarked', () => {
    const results = searchAtlas(parse({ view: 'families', pageSize: 100, q: 'ViziShot' }))
    const mixed = results.families.filter(
      (family) =>
        family.safetyNoticeModelIds.length > 0 &&
        family.safetyNoticeModelIds.length < family.modelIds.length,
    )
    // The cohort contains a line where only SOME models carry a recorded notice.
    expect(mixed.length).toBeGreaterThan(0)
    for (const family of results.families) {
      for (const id of family.modelIds) {
        const material = safetyDisplayIsMaterialOnCards(getProductStatus(id).safetyDisplay)
        expect(family.safetyNoticeModelIds.includes(id)).toBe(material)
      }
    }
  })

  it('shows a line-level market status only when every listed model agrees', () => {
    const status = (overrides: Partial<ProductStatusView>): ProductStatusView => ({
      ...UNRESEARCHED_PRODUCT_STATUS,
      ...overrides,
    })
    const member = (id: string, memberStatus: ProductStatusView): AtlasFamilyMember<string> => ({
      item: id,
      productId: id,
      productName: id,
      familyKey: 'mfr|line|kind',
      familyName: 'Line',
      hasBrandFamily: true,
      manufacturerGroupId: 'mfr',
      manufacturerDisplay: 'Manufacturer',
      deviceClassCode: 'needle',
      deviceSubtypeCode: 'ebus_tbna_needle',
      status: memberStatus,
      diameterMm: null,
      frenchSize: null,
    })
    const [agreeing] = groupAtlasFamilies([
      member('a', status({ marketStatus: 'likely_current_us' })),
      member('b', status({ marketStatus: 'likely_current_us' })),
    ])
    expect(agreeing.unanimousMarketStatus).toBe('likely_current_us')
    const [split] = groupAtlasFamilies([
      member('a', status({ marketStatus: 'likely_current_us' })),
      member('b', status({ marketStatus: 'historical_or_discontinued' })),
      member('c', status({ safetyDisplay: 'active_safety_notice' })),
    ])
    expect(split.unanimousMarketStatus).toBeNull()
    expect(split.safetyNoticeModelIds).toEqual(['c'])
    // A different subtype under the same brand range is a different line.
    const groups = groupAtlasFamilies([
      member('a', status({})),
      { ...member('b', status({})), deviceSubtypeCode: 'ebus_fnb_needle' },
    ])
    expect(groups).toHaveLength(2)
  })

  it('never treats "not researched" as an alert or as reassurance', () => {
    expect(statusNeedsAttention(UNRESEARCHED_PRODUCT_STATUS)).toBe(false)
    expect(
      statusNeedsAttention({
        ...UNRESEARCHED_PRODUCT_STATUS,
        safetyDisplay: 'active_safety_notice',
      }),
    ).toBe(true)
    expect(
      statusNeedsAttention({
        ...UNRESEARCHED_PRODUCT_STATUS,
        safetyDisplay: 'historical_safety_notice',
      }),
    ).toBe(true)
    expect(
      statusNeedsAttention({
        ...UNRESEARCHED_PRODUCT_STATUS,
        marketStatus: 'historical_or_discontinued',
      }),
    ).toBe(true)
  })
})
