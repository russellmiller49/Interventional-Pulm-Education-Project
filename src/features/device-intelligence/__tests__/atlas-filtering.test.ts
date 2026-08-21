import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { catalogSearchSchema } from '@/features/preference-cards/schemas/catalog-search'
import {
  getCatalogStore,
  getProductDetail,
  searchCatalog,
} from '@/features/preference-cards/server/catalog'
import { isAtlasCohortProduct } from '@/features/device-intelligence/domain/atlas-cohort'
import { getAtlasVisibilityExclusions } from '@/features/device-intelligence/domain/atlas-visibility-exclusions'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  getAtlasFacets,
  getAtlasOverview,
  getAtlasProductDetail,
  getAtlasUseDetail,
  searchAtlas,
} from '@/features/device-intelligence/server/atlas.server'

/**
 * D2B inclusion-first cohort. The D1 predicate (`verified_source` AND `prototype_visible`)
 * is superseded: sourced identity alone decides membership, minus explicit reviewed owner
 * exclusions. Candidate- and unknown-grade products stay outside Device Intelligence.
 */

/** A newly included exemplar: verified-source, canonically hidden, real roles and slots. */
const NEWLY_INCLUDED_PRODUCT_ID = 'PRD-CB1622624D'
const NEWLY_INCLUDED_CATALOG_NUMBER = 'BF-MP190F'

describe('D2B atlas cohort inclusion', () => {
  it('contains exactly the verified_source products, hidden ones included', () => {
    const full = getCatalogStore()
    const expected = full.products.filter(isAtlasCohortProduct).map((p) => p.product_id)
    const atlas = getAtlasCatalogStore()
    expect(atlas.products.map((p) => p.product_id).sort()).toEqual([...expected].sort())
    // 753 prototype-visible + 1,019 hidden verified-source products.
    expect(atlas.products.length).toBe(1772)
    for (const product of atlas.products) {
      expect(product.verification_grade).toBe('verified_source')
    }
    // The inclusion-first change is not cosmetic: the newly admitted population is exactly
    // the hidden verified-source products, and it is large.
    const newlyIncluded = atlas.products.filter(
      (product) => product.visibility_state !== 'prototype_visible',
    )
    expect(newlyIncluded.length).toBe(1019)
    for (const product of newlyIncluded) expect(product.visibility_state).toBe('hidden')
  })

  it('does NOT read visibility_state as a gate', () => {
    // The predicate must not merely have moved the old conjunct behind another name.
    expect(isAtlasCohortProduct({ verification_grade: 'verified_source' })).toBe(true)
    expect(
      isAtlasCohortProduct({ verification_grade: 'verified_source', visibility_state: 'hidden' }),
    ).toBe(true)
    expect(
      isAtlasCohortProduct({
        verification_grade: 'verified_source',
        visibility_state: 'prototype_visible',
      }),
    ).toBe(true)
  })

  it('still excludes every candidate-grade and unknown-grade product, including by direct id', () => {
    const full = getCatalogStore()
    const excluded = full.products.filter((product) => !isAtlasCohortProduct(product))
    // 200 candidate + 1 unknown; no owner exclusion is populated today.
    expect(excluded.length).toBe(201)
    expect(getAtlasVisibilityExclusions().size).toBe(0)
    expect(excluded.filter((p) => p.verification_grade === 'candidate').length).toBe(200)
    expect(excluded.filter((p) => p.verification_grade === 'unknown').length).toBe(1)
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
        // Every returned row resolves a status — the map is total, never partial.
        expect(response.statusByProductId[item.productId]).toBeDefined()
      }
      page += 1
    } while (page <= pageCount)
    expect(seen.size).toBe(1772)
    expect(searchAtlas(query).total).toBe(1772)
  })

  it('counts facets over the expanded cohort', () => {
    const facets = getAtlasFacets()
    const total = facets.manufacturers.reduce((sum, entry) => sum + entry.productCount, 0)
    expect(total).toBe(1772)
    expect(getAtlasOverview()).toEqual({
      productCount: 1772,
      manufacturerCount: facets.manufacturers.length,
      roleCount: 135,
      procedureCount: 15,
      verifiedCount: 1772,
    })
  })

  it('makes a newly included hidden verified-source product fully reachable', () => {
    const full = getCatalogStore()
    const canonical = full.productById.get(NEWLY_INCLUDED_PRODUCT_ID)!
    // The canonical record is untouched: still verified_source, still hidden.
    expect(canonical.verification_grade).toBe('verified_source')
    expect(canonical.visibility_state).toBe('hidden')

    // Direct route resolves.
    const detail = getAtlasProductDetail(NEWLY_INCLUDED_PRODUCT_ID)
    expect(detail).not.toBeNull()
    expect(detail!.product.catalog_number).toBe(NEWLY_INCLUDED_CATALOG_NUMBER)

    // Exact identifier search finds it.
    const hits = searchAtlas(catalogSearchSchema.parse({ q: NEWLY_INCLUDED_CATALOG_NUMBER }))
    expect(hits.items.map((item) => item.productId)).toContain(NEWLY_INCLUDED_PRODUCT_ID)

    // Manufacturer and category facets include it.
    const facets = getAtlasFacets()
    expect(facets.manufacturers.map((entry) => entry.displayName)).toContain(
      detail!.product.manufacturerDisplay,
    )
    if (detail!.product.primary_category) {
      expect(facets.categories.map((entry) => entry.name)).toContain(
        detail!.product.primary_category,
      )
    }

    // Its governed role listings include it.
    expect(detail!.roles.length).toBeGreaterThan(0)
    for (const role of detail!.roles) {
      const use = getAtlasUseDetail(role.roleCode)!
      const listed = use.detail.manufacturerGroups.flatMap((group) =>
        group.items.map((item) => item.productId),
      )
      expect({ role: role.roleCode, listed: listed.includes(NEWLY_INCLUDED_PRODUCT_ID) }).toEqual({
        role: role.roleCode,
        listed: true,
      })
    }
  })

  it('lists only cohort products on role pages and in related-product lists', () => {
    const atlas = getAtlasCatalogStore()
    const use = getAtlasUseDetail('EBUS_SCOPE')
    expect(use).not.toBeNull()
    for (const group of use!.detail.manufacturerGroups) {
      for (const item of group.items) {
        expect(atlas.productById.has(item.productId)).toBe(true)
        expect(use!.statusByProductId[item.productId]).toBeDefined()
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

  it('orients every role-mapped device page and preserves the reviewed brochure role gaps', () => {
    const atlas = getAtlasCatalogStore()
    let productsWithoutRole = 0
    for (const product of atlas.products) {
      const detail = getAtlasProductDetail(product.product_id)!
      if (detail.primaryRole === null) productsWithoutRole += 1
      else expect(detail.primaryRole.roleName.length).toBeGreaterThan(0)
      // The capped discovery list never exceeds its stated denominators.
      expect(detail.otherManufacturers.length).toBeLessThanOrEqual(6)
      expect(detail.otherManufacturers.length).toBeLessThanOrEqual(
        detail.otherManufacturersTotalManufacturers,
      )
      expect(detail.otherManufacturersTotalProducts).toBeGreaterThanOrEqual(
        detail.otherManufacturersTotalManufacturers,
      )
    }
    // Exact brochure identities without a defensible canonical role remain visible but
    // unassigned rather than receiving an inferred clinical use.
    expect(productsWithoutRole).toBe(25)
  })

  it('is the ONLY path that opts into Primary-fit representatives (C-06)', () => {
    // The atlas call site passes { representativeSelection: 'primary_fit' }; every atlas
    // detail must therefore match that mode evaluated over the cohort store, id for id.
    const atlas = getAtlasCatalogStore()
    for (const product of atlas.products) {
      const detail = getAtlasProductDetail(product.product_id)!
      const primaryFit = getProductDetail(product.product_id, atlas, {
        representativeSelection: 'primary_fit',
      })!
      expect(detail.otherManufacturers.map((entry) => entry.productId)).toEqual(
        primaryFit.otherManufacturers.map((entry) => entry.productId),
      )
    }
    // And the opt-in is a real behavior, not a no-op: over the FULL store (the preserved
    // preference-card surface), the two modes disagree for at least one product — the very
    // divergence C-06 confines to the atlas.
    const full = getCatalogStore()
    const divergent = full.products.filter((product) => {
      const legacy = getProductDetail(product.product_id, full)!
      const primaryFit = getProductDetail(product.product_id, full, {
        representativeSelection: 'primary_fit',
      })!
      return (
        legacy.otherManufacturers.map((entry) => entry.productId).join('|') !==
        primaryFit.otherManufacturers.map((entry) => entry.productId).join('|')
      )
    })
    expect(divergent.length).toBeGreaterThan(0)
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
    // Adversarial finding 7, extended by Codex C-03: non-cohort references — resolved OR
    // textual — surface only as withheld entries whose shape carries no identifying text.
    const atlas = getAtlasCatalogStore()
    for (const product of atlas.products) {
      const detail = getAtlasProductDetail(product.product_id)
      for (const statement of detail?.rawCompatibilityStatements ?? []) {
        if (statement.withheld) {
          // Fail-closed shape: provenance only, no participant or rule text of any kind.
          expect(Object.keys(statement).sort()).toEqual([
            'ruleId',
            'sourceId',
            'verificationGrade',
            'verificationStatus',
            'withheld',
            'withheldReason',
          ])
          continue
        }
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

  it('keeps the complete effective catalog available to preserved surfaces', () => {
    const full = getCatalogStore()
    expect(full.products.length).toBe(1973)
    // The two stores answer fuzzy search independently (regression for the Fuse cache fix).
    const atlasHits = searchAtlas(catalogSearchSchema.parse({ q: 'aScope' })).total
    const fullHits = searchCatalog(catalogSearchSchema.parse({ q: 'aScope' })).total
    expect(fullHits).toBeGreaterThanOrEqual(atlasHits)
  })
})
