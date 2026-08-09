import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { catalogSearchSchema } from '@/features/preference-cards/schemas/catalog-search'
import { getCatalogStore, searchCatalog } from '@/features/preference-cards/server/catalog'
import { isAtlasCohortProduct } from '@/features/device-intelligence/domain/atlas-cohort'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  getAtlasFacets,
  getAtlasOverview,
  getAtlasProductDetail,
  getAtlasUseDetail,
  searchAtlas,
} from '@/features/device-intelligence/server/atlas.server'

describe('D1 atlas cohort filtering', () => {
  it('contains exactly the verified_source AND prototype_visible products', () => {
    const full = getCatalogStore()
    const expected = full.products.filter(isAtlasCohortProduct).map((p) => p.product_id)
    const atlas = getAtlasCatalogStore()
    expect(atlas.products.map((p) => p.product_id).sort()).toEqual([...expected].sort())
    // The audit-pinned intersection: 753 prototype_visible products, all verified_source.
    expect(atlas.products.length).toBe(753)
    for (const product of atlas.products) {
      expect(product.verification_grade).toBe('verified_source')
      expect(product.visibility_state).toBe('prototype_visible')
    }
  })

  it('excludes every candidate-grade and every hidden product, including direct id requests', () => {
    const full = getCatalogStore()
    const excluded = full.products.filter((product) => !isAtlasCohortProduct(product))
    expect(excluded.length).toBeGreaterThan(0)
    const atlas = getAtlasCatalogStore()
    for (const product of excluded) {
      expect(atlas.productById.has(product.product_id)).toBe(false)
      expect(getAtlasProductDetail(product.product_id)).toBeNull()
    }
  })

  it('never returns a non-cohort product from search, on any page', () => {
    const query = catalogSearchSchema.parse({ pageSize: 100 })
    let page = 1
    let pageCount = 1
    const seen = new Set<string>()
    do {
      const response = searchAtlas(catalogSearchSchema.parse({ pageSize: 100, page }))
      pageCount = response.pageCount
      for (const item of response.items) {
        expect(item.verificationTier).toBe('verified')
        seen.add(item.productId)
      }
      page += 1
    } while (page <= pageCount)
    expect(seen.size).toBe(753)
    expect(searchAtlas(query).total).toBe(753)
  })

  it('counts facets over the cohort only', () => {
    const facets = getAtlasFacets()
    const total = facets.manufacturers.reduce((sum, entry) => sum + entry.productCount, 0)
    expect(total).toBe(753)
    expect(getAtlasOverview()).toEqual({
      productCount: 753,
      manufacturerCount: facets.manufacturers.length,
      roleCount: 135,
      procedureCount: 15,
      verifiedCount: 753,
    })
  })

  it('lists only cohort products on role pages and in related-product lists', () => {
    const atlas = getAtlasCatalogStore()
    const use = getAtlasUseDetail('EBUS_SCOPE')
    expect(use).not.toBeNull()
    for (const group of use!.detail.manufacturerGroups) {
      for (const item of group.items) {
        expect(atlas.productById.has(item.productId)).toBe(true)
      }
    }
    const anyProduct = atlas.products[0]
    const detail = getAtlasProductDetail(anyProduct.product_id)
    expect(detail).not.toBeNull()
    for (const other of detail!.otherManufacturers) {
      expect(atlas.productById.has(other.productId)).toBe(true)
    }
    for (const sibling of detail!.sameManufacturerLine) {
      expect(atlas.productById.has(sibling.productId)).toBe(true)
    }
  })

  it('exposes no proposal rows through any atlas surface', () => {
    // The atlas store is built without the proposals artifact entirely; assert the module
    // graph of the atlas server layer never imports it.
    const featureDir = join(__dirname, '..')
    for (const file of ['server/atlas-store.server.ts', 'server/atlas.server.ts']) {
      const source = readFileSync(join(featureDir, file), 'utf8')
      expect(source).not.toContain('slot-product-option-proposals')
    }
  })

  it('withholds raw compatibility statements whose counterpart resolves outside the cohort', () => {
    // Adversarial finding 7: the guard exists so this stays true when data regenerates.
    const atlas = getAtlasCatalogStore()
    for (const product of atlas.products) {
      const detail = getAtlasProductDetail(product.product_id)
      for (const statement of detail?.rawCompatibilityStatements ?? []) {
        for (const resolvedId of [statement.resolvedSourceId, statement.resolvedTargetId]) {
          if (resolvedId !== null && resolvedId.startsWith('PRD-')) {
            expect({
              product: product.product_id,
              resolvedId,
              inCohort: atlas.productById.has(resolvedId),
            }).toEqual({
              product: product.product_id,
              resolvedId,
              inCohort: true,
            })
          }
        }
      }
    }
  })

  it('leaves the full catalog store untouched for the preserved surfaces', () => {
    const full = getCatalogStore()
    expect(full.products.length).toBe(1532)
    // The two stores answer fuzzy search independently (regression for the Fuse cache fix).
    const atlasHits = searchAtlas(catalogSearchSchema.parse({ q: 'aScope' })).total
    const fullHits = searchCatalog(catalogSearchSchema.parse({ q: 'aScope' })).total
    expect(fullHits).toBeGreaterThanOrEqual(atlasHits)
  })
})
