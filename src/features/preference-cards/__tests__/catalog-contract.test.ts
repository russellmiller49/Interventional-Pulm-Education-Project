import manufacturersJson from '../../../../data/ip-preference-cards/generated/manufacturers.json'

import { manufacturerAliasGroups } from '../server/manufacturer-aliases'
import {
  getCatalogFacets,
  getCatalogOverview,
  getCatalogStore,
  getProductDetail,
  getUseDetail,
  getUseIndex,
  searchCatalog,
} from '../server/catalog'
import { catalogSearchSchema } from '../schemas/catalog-search'

/**
 * Smoke tests against the real generated catalog. These are the tripwires for a
 * re-import that changes shape: broken foreign keys, an alias pointing at a
 * manufacturer that no longer exists, or products dropping out of the index.
 */
describe('generated catalog contract', () => {
  const store = getCatalogStore()

  it('indexes every generated product', () => {
    const overview = getCatalogOverview()
    expect(overview.productCount).toBeGreaterThan(1000)
    expect(store.products).toHaveLength(overview.productCount)
    expect(store.productById.size).toBe(overview.productCount)
  })

  it('resolves every product-role link to an indexed product', () => {
    for (const [productId] of store.rolesByProduct) {
      expect(store.productById.has(productId)).toBe(true)
    }
  })

  it('exposes the unverified tier instead of hiding it', () => {
    const all = searchCatalog(catalogSearchSchema.parse({}), store)
    const verified = searchCatalog(catalogSearchSchema.parse({ tier: 'verified' }), store)
    const unverified = searchCatalog(catalogSearchSchema.parse({ tier: 'unverified' }), store)
    expect(verified.total + unverified.total).toBe(all.total)
    expect(unverified.total).toBeGreaterThan(0)
  })

  it('surfaces products the workbook holds out of dropdowns', () => {
    const hidden = store.products.filter((product) => product.visibility_state === 'hidden')
    expect(hidden.length).toBeGreaterThan(0)
    const result = searchCatalog(
      catalogSearchSchema.parse({ q: hidden[0].product_name, pageSize: 100 }),
      store,
    )
    expect(result.items.some((item) => item.productId === hidden[0].product_id)).toBe(true)
  })

  it('reports roles with no catalogued products rather than omitting them', () => {
    const entries = getUseIndex({}, store).flatMap((group) => group.entries)
    expect(entries).toHaveLength(store.roles.length)
    expect(entries.some((entry) => entry.productCount === 0)).toBe(true)
  })

  it('builds a cross-manufacturer comparison for a multi-vendor use', () => {
    const detail = getUseDetail('BIOPSY_FORCEPS_FLEX', store)
    expect(detail).not.toBeNull()
    expect(detail!.manufacturerGroups.length).toBeGreaterThan(1)
    expect(detail!.specColumns.length).toBeGreaterThan(0)
  })

  it('resolves a product detail with its sources', () => {
    const withSource = store.products.find((product) =>
      store.sourcesByProduct.has(product.product_id),
    )
    expect(withSource).toBeDefined()
    const detail = getProductDetail(withSource!.product_id, store)
    expect(detail!.sources.length).toBeGreaterThan(0)
    expect(detail!.sources[0].title).toBeTruthy()
  })

  it('C-06: every product page gets the exact legacy representative ids by default', () => {
    // The pre-D1 algorithm, re-implemented independently: walk the role's catalog order,
    // one representative per manufacturer group — the FIRST candidate seen — capped at six
    // groups. `getProductDetail` with no options must reproduce it id-for-id across the
    // whole real catalog, which is precisely the 114-page collateral change being pinned
    // away (Primary-fit preference now lives behind the atlas-only opt-in).
    for (const product of store.products) {
      const roleLinks = store.rolesByProduct.get(product.product_id) ?? []
      const primaryRole = roleLinks.find((link) => link.role_fit === 'Primary') ?? roleLinks[0]
      const expected: string[] = []
      if (primaryRole) {
        const seenGroups = new Set<string>([product.manufacturerGroupId])
        for (const candidateId of store.productIdsByRole.get(primaryRole.role_code) ?? []) {
          if (expected.length >= 6) break
          const candidate = store.productById.get(candidateId)
          if (!candidate || seenGroups.has(candidate.manufacturerGroupId)) continue
          seenGroups.add(candidate.manufacturerGroupId)
          expected.push(candidate.product_id)
        }
      }
      const detail = getProductDetail(product.product_id, store)!
      const actual = detail.otherManufacturers.map((item) => item.productId)
      if (actual.join('|') !== expected.join('|')) {
        throw new Error(
          `legacy representative regression for ${product.product_id}: got ${actual.join(', ')} expected ${expected.join(', ')}`,
        )
      }
    }
  })

  it('offers every facet value the search form renders', () => {
    const facets = getCatalogFacets(store)
    expect(facets.manufacturers.length).toBeGreaterThan(0)
    expect(facets.categories.length).toBeGreaterThan(0)
    expect(facets.procedures.length).toBeGreaterThan(0)
    expect(facets.roles).toHaveLength(store.roles.length)
  })
})

describe('manufacturer alias groups', () => {
  const knownIds = new Set(
    (manufacturersJson as { manufacturer_id: string }[]).map((row) => row.manufacturer_id),
  )

  it('references only manufacturers that exist in the generated data', () => {
    for (const group of manufacturerAliasGroups) {
      for (const memberId of group.memberManufacturerIds) {
        expect(knownIds.has(memberId)).toBe(true)
      }
    }
  })

  it('never assigns a manufacturer to two groups', () => {
    const seen = new Set<string>()
    for (const group of manufacturerAliasGroups) {
      for (const memberId of group.memberManufacturerIds) {
        expect(seen.has(memberId)).toBe(false)
        seen.add(memberId)
      }
    }
  })

  it('collapses aliased manufacturers into a single display group', () => {
    const store = getCatalogStore()
    const groupIds = new Set(store.products.map((product) => product.manufacturerGroupId))
    const mergedAway = manufacturerAliasGroups.flatMap((group) =>
      group.memberManufacturerIds.filter((id) => id !== group.canonicalId),
    )
    for (const id of mergedAway) {
      expect(groupIds.has(id)).toBe(false)
    }
  })
})
