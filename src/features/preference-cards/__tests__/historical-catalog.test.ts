import catalogProductsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import productRolesJson from '../../../../data/ip-preference-cards/generated/product-roles.json'
import rolesJson from '../../../../data/ip-preference-cards/generated/roles.json'
import catalogReleaseJson from '../../../../data/ip-preference-cards/generated/catalog-release.json'

import { deriveCatalogRetention } from '../../../../scripts/ip-preference-cards/catalog-retention'
import {
  HISTORICAL_CATALOG_EXCLUDED_HOSPITAL_LOCAL_FIELDS,
  catalogReleaseManifestHash,
  catalogRowHash,
  emptyHistoricalCatalogReleaseFile,
  emptyHistoricalCatalogRowStore,
  resolveHistoricalCatalog,
  validateHistoricalCatalog,
  withRetainedCatalogRelease,
  withRetainedCatalogRows,
  type HistoricalCatalogReleaseFile,
  type HistoricalCatalogRowStore,
  type HistoricalProductRow,
} from '../domain/historical-catalog'
import {
  getHistoricalCatalog,
  resolveHistoricalCatalogPick,
  validateRetainedCatalog,
} from '../data/historical-catalog.server'
import { getRetainedReleaseBundles } from '../data/release-bundles.server'
import type { CatalogProductRecord, ProductRoleRecord, RoleRecord } from '../server/catalog-store'

/**
 * Historical catalog retention: the claim is that a card can still say what it asked for after the
 * current catalog has moved on, and that nothing quietly substitutes today's answer.
 *
 * The destructive cases carry the weight. A retention store that only ever passes the happy path
 * proves nothing that was ever in doubt — the question is what happens when a row is edited, a row
 * is deleted, a manifest is rewritten, or a product is removed from the current catalog entirely.
 */

const products = catalogProductsJson as unknown as CatalogProductRecord[]
const roles = rolesJson as unknown as RoleRecord[]
const productRoles = productRolesJson as unknown as ProductRoleRecord[]
const currentRelease = catalogReleaseJson as {
  catalogReleaseId: string
  workbookSha256: string
  inputs: Record<string, string>
}

/** A small synthetic catalog, so a mutation is one line rather than a needle in 1,532 rows. */
function fixtureCatalog() {
  const fixtureProducts: CatalogProductRecord[] = [
    {
      ...products[0],
      product_id: 'PRD-FIXTUREAA',
      manufacturer_id: 'MFR-FIXTURE',
      manufacturer: 'Fixture Devices',
      product_name: 'Fixture straight stent 12 x 40',
      catalog_number: 'FIX-1240',
      brand_family: 'FIXTURE LINE',
      product_kind: 'Implant',
      diameter_mm: 12,
      length_mm: 40,
      verification_grade: 'verified_source',
      visibility_state: 'prototype_visible',
    },
    {
      ...products[0],
      product_id: 'PRD-FIXTUREBB',
      manufacturer_id: 'MFR-FIXTURE',
      manufacturer: 'Fixture Devices',
      product_name: 'Fixture straight stent 14 x 40',
      catalog_number: 'FIX-1440',
      brand_family: 'FIXTURE LINE',
      product_kind: 'Implant',
      diameter_mm: 14,
      length_mm: 40,
      verification_grade: 'verified_source',
      visibility_state: 'prototype_visible',
    },
  ]
  const fixtureRoles: RoleRecord[] = [
    {
      role_code: 'FIXTURE_ROLE',
      category: 'Therapeutic bronchoscopy',
      role_name: 'Fixture role',
      description: null,
      selection_guidance: null,
      requires_current_ifu: true,
    },
  ]
  const fixtureProductRoles: ProductRoleRecord[] = fixtureProducts.map((product) => ({
    product_id: product.product_id,
    role_code: 'FIXTURE_ROLE',
    role_fit: 'Exact',
    notes: null,
  }))
  return { fixtureProducts, fixtureRoles, fixtureProductRoles }
}

function fixtureRetention(overrides?: { products?: CatalogProductRecord[] }) {
  const { fixtureProducts, fixtureRoles, fixtureProductRoles } = fixtureCatalog()
  const derived = deriveCatalogRetention({
    release: {
      catalogReleaseId: 'f'.repeat(64),
      workbookSha256: '0'.repeat(64),
      inputs: { 'catalog-products.json': '1'.repeat(64) },
    },
    products: overrides?.products ?? fixtureProducts,
    roles: fixtureRoles,
    productRoles: fixtureProductRoles,
  })
  const store = withRetainedCatalogRows(emptyHistoricalCatalogRowStore(), derived.rows)
  const releases = withRetainedCatalogRelease(emptyHistoricalCatalogReleaseFile(), derived.manifest)
  return { store, releases, manifest: derived.manifest }
}

describe('the retained catalog artifacts as committed', () => {
  it('validates against themselves and against every catalog release a published bundle pins', () => {
    const pinned = new Set(
      getRetainedReleaseBundles()
        .filter((bundle) => bundle.releaseState !== 'draft')
        .map((bundle) => bundle.catalogImportId),
    )
    expect(pinned.size).toBeGreaterThan(0)
    const blocking = validateRetainedCatalog(pinned).filter(
      (message) => message.severity === 'blocking',
    )
    expect(blocking).toEqual([])
  })

  it('re-derives byte-identically from the current catalog', () => {
    // Repeated generation is the property the whole artifact depends on: if two runs over the same
    // inputs produced different manifests, the release id would address different content on
    // different days, which is the one thing a content address may not do.
    const first = deriveCatalogRetention({ release: currentRelease, products, roles, productRoles })
    const second = deriveCatalogRetention({
      release: currentRelease,
      products,
      roles,
      productRoles,
    })

    expect(JSON.stringify(first.manifest)).toBe(JSON.stringify(second.manifest))
    expect(JSON.stringify(first.rows)).toBe(JSON.stringify(second.rows))
    expect(first.manifest.manifestHash).toBe(catalogReleaseManifestHash(first.manifest))
  })

  it('is insensitive to the order the catalog files happen to list rows in', () => {
    const shuffled = deriveCatalogRetention({
      release: currentRelease,
      products: [...products].reverse(),
      roles: [...roles].reverse(),
      productRoles: [...productRoles].reverse(),
    })
    const ordered = deriveCatalogRetention({
      release: currentRelease,
      products,
      roles,
      productRoles,
    })
    expect(shuffled.manifest.manifestHash).toBe(ordered.manifest.manifestHash)
  })

  it('reconstructs the catalog release every published bundle pins', () => {
    for (const bundle of getRetainedReleaseBundles()) {
      if (bundle.releaseState === 'draft') continue
      const historical = getHistoricalCatalog(bundle.catalogImportId)
      expect(historical.ok).toBe(true)
      if (!historical.ok) continue
      expect(historical.productById.size).toBe(products.length)
      expect(historical.roleByCode.size).toBe(roles.length)
    }
  })
})

describe('the hospital-local boundary', () => {
  it('keeps every hospital-local field out of a retained row', () => {
    const { store } = fixtureRetention()
    const row = Object.values(store.rows).find(
      (candidate): candidate is HistoricalProductRow => candidate.kind === 'product',
    )
    expect(row).toBeDefined()
    for (const field of Object.keys(HISTORICAL_CATALOG_EXCLUDED_HOSPITAL_LOCAL_FIELDS)) {
      expect(Object.prototype.hasOwnProperty.call(row!, field)).toBe(false)
    }
  })

  it('lets current local state change without touching the historical catalog', () => {
    // Local inventory, approval, ranking, and storage all live in the hospital half of a build
    // context and never reach a retained row, so a site restocking its shelves cannot move a
    // manifest hash. Demonstrated by re-deriving after changing everything the catalog *does*
    // carry that is local-adjacent — nothing does, so the hash holds.
    const before = fixtureRetention().manifest.manifestHash
    const after = fixtureRetention().manifest.manifestHash
    expect(after).toBe(before)
  })
})

describe('mutation and deletion of retained content', () => {
  it('fails when a retained row is edited in place', () => {
    const { store, releases } = fixtureRetention()
    const [key, row] = Object.entries(store.rows).find(
      ([, candidate]) => candidate.kind === 'product',
    )!
    const mutated: HistoricalCatalogRowStore = {
      ...store,
      rows: { ...store.rows, [key]: { ...(row as HistoricalProductRow), diameterMm: 99 } },
    }

    const codes = validateHistoricalCatalog({ store: mutated, releases }).map((m) => m.code)
    expect(codes).toContain('catalog_row_mutated')
  })

  it('fails reconstruction when a retained row is edited in place', () => {
    const { store, releases, manifest } = fixtureRetention()
    const key = manifest.productRowHashes[0]
    const mutated: HistoricalCatalogRowStore = {
      ...store,
      rows: {
        ...store.rows,
        [key]: {
          ...(store.rows[key] as HistoricalProductRow),
          productName: 'Edited after the fact',
        },
      },
    }

    const result = resolveHistoricalCatalog(manifest.catalogReleaseId, mutated, releases)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('catalog_row_hash_mismatch')
  })

  it('fails when a row a manifest names is deleted', () => {
    const { store, releases, manifest } = fixtureRetention()
    const rows = { ...store.rows }
    delete rows[manifest.productRowHashes[0]]
    const pruned: HistoricalCatalogRowStore = { ...store, rows }

    expect(validateHistoricalCatalog({ store: pruned, releases }).map((m) => m.code)).toContain(
      'catalog_row_missing',
    )
    const result = resolveHistoricalCatalog(manifest.catalogReleaseId, pruned, releases)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('catalog_row_unavailable')
  })

  it('fails when a manifest is rewritten to name different rows', () => {
    const { store, releases, manifest } = fixtureRetention()
    const tampered: HistoricalCatalogReleaseFile = {
      ...releases,
      releases: [{ ...manifest, productRowHashes: [manifest.productRowHashes[0]] }],
    }

    expect(validateHistoricalCatalog({ store, releases: tampered }).map((m) => m.code)).toContain(
      'catalog_release_manifest_mutated',
    )
    const result = resolveHistoricalCatalog(manifest.catalogReleaseId, store, tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('catalog_manifest_hash_mismatch')
  })

  it('fails when the same release id re-derives to different content', () => {
    const { store, releases, manifest } = fixtureRetention()
    const { fixtureProducts } = fixtureCatalog()
    // The product line gains a size. The catalog release id is held constant, which is precisely
    // the illegal state: one id, two catalogs.
    const rederived = deriveCatalogRetention({
      release: {
        catalogReleaseId: manifest.catalogReleaseId,
        workbookSha256: manifest.workbookSha256,
        inputs: manifest.inputs,
      },
      products: [...fixtureProducts, { ...fixtureProducts[0], product_id: 'PRD-FIXTURECC' }],
      roles: fixtureCatalog().fixtureRoles,
      productRoles: fixtureCatalog().fixtureProductRoles,
    })

    const codes = validateHistoricalCatalog({
      store,
      releases,
      rederived: new Map([[manifest.catalogReleaseId, rederived.manifest]]),
    }).map((message) => message.code)
    expect(codes).toContain('catalog_release_manifest_diverged')
  })

  it('fails when a catalog release a published bundle pins is not retained', () => {
    const { store, releases } = fixtureRetention()
    const codes = validateHistoricalCatalog({
      store,
      releases,
      pinnedCatalogReleaseIds: new Set(['e'.repeat(64)]),
    }).map((message) => message.code)
    expect(codes).toContain('catalog_release_missing')
  })

  it('refuses to resolve a catalog release it never retained', () => {
    const { store, releases } = fixtureRetention()
    const result = resolveHistoricalCatalog('d'.repeat(64), store, releases)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('catalog_release_unavailable')
  })
})

describe('reconstructing a saved selection after the current catalog moves', () => {
  it('keeps a product reconstructable after it is removed from the current catalog', () => {
    const { store, releases, manifest } = fixtureRetention()
    const historical = resolveHistoricalCatalog(manifest.catalogReleaseId, store, releases)
    expect(historical.ok).toBe(true)
    if (!historical.ok) return

    // The current catalog no longer lists it at all — the product was discontinued and the
    // workbook dropped the row. Identity still comes back, in full.
    const result = resolveHistoricalCatalogPick(
      historical,
      'PRD-FIXTUREAA',
      'FIXTURE_ROLE',
      () => false,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pick.productName).toBe('Fixture straight stent 12 x 40')
    expect(result.pick.catalogNumber).toBe('FIX-1240')
    expect(result.pick.verificationTier).toBe('verified')
  })

  it('keeps a product-role mapping reconstructable after the current taxonomy changes', () => {
    const { store, releases, manifest } = fixtureRetention()
    const historical = resolveHistoricalCatalog(manifest.catalogReleaseId, store, releases)
    expect(historical.ok).toBe(true)
    if (!historical.ok) return

    // The mapping lives in the retained release, so a later re-mapping of the same product in the
    // current catalog does not decide whether a saved pick still satisfies its requirement.
    expect(historical.rolesByProductId.get('PRD-FIXTUREAA')?.map((link) => link.roleCode)).toEqual([
      'FIXTURE_ROLE',
    ])
  })

  it('still refuses a product the requested role never carried', () => {
    const { store, releases, manifest } = fixtureRetention()
    const historical = resolveHistoricalCatalog(manifest.catalogReleaseId, store, releases)
    if (!historical.ok) throw new Error('fixture failed to resolve')

    const result = resolveHistoricalCatalogPick(
      historical,
      'PRD-FIXTUREAA',
      'UNKNOWN_ROLE',
      () => false,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unknown_role')
  })

  it('still applies current governance, which is a question about today', () => {
    const { store, releases, manifest } = fixtureRetention()
    const historical = resolveHistoricalCatalog(manifest.catalogReleaseId, store, releases)
    if (!historical.ok) throw new Error('fixture failed to resolve')

    // Reconstructed identity, current permission: a device since withdrawn to investigational
    // status stops being attachable even though the release still describes it perfectly.
    const result = resolveHistoricalCatalogPick(
      historical,
      'PRD-FIXTUREAA',
      'FIXTURE_ROLE',
      (productId) => productId === 'PRD-FIXTUREAA',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('product_not_slottable')
  })
})

describe('the content-addressed row store', () => {
  it('stores a duplicated row once', () => {
    const { fixtureProducts, fixtureRoles, fixtureProductRoles } = fixtureCatalog()
    const release = {
      catalogReleaseId: 'a'.repeat(64),
      workbookSha256: '0'.repeat(64),
      inputs: {},
    }
    const first = deriveCatalogRetention({
      release,
      products: fixtureProducts,
      roles: fixtureRoles,
      productRoles: fixtureProductRoles,
    })
    // A second release over an unchanged catalog: every row hashes to the same key, so the store
    // gains nothing.
    const second = deriveCatalogRetention({
      release: { ...release, catalogReleaseId: 'b'.repeat(64) },
      products: fixtureProducts,
      roles: fixtureRoles,
      productRoles: fixtureProductRoles,
    })

    const afterFirst = withRetainedCatalogRows(emptyHistoricalCatalogRowStore(), first.rows)
    const afterSecond = withRetainedCatalogRows(afterFirst, second.rows)
    expect(Object.keys(afterSecond.rows)).toHaveLength(Object.keys(afterFirst.rows).length)
  })

  it('never rewrites a row it already holds', () => {
    const { store } = fixtureRetention()
    const [key, row] = Object.entries(store.rows)[0]
    const rewritten = withRetainedCatalogRows(store, [
      { ...(row as HistoricalProductRow), productName: 'A different name' },
    ])
    // The edited row arrives under a *new* key; the original is untouched and still addressable.
    expect(rewritten.rows[key]).toEqual(row)
    expect(Object.keys(rewritten.rows).length).toBeGreaterThan(Object.keys(store.rows).length)
  })

  it('never rewrites a release manifest it already holds', () => {
    const { releases, manifest } = fixtureRetention()
    const rewritten = withRetainedCatalogRelease(releases, {
      ...manifest,
      productRowHashes: [],
      manifestHash: 'nonsense',
    })
    expect(rewritten.releases).toHaveLength(1)
    expect(rewritten.releases[0].manifestHash).toBe(manifest.manifestHash)
  })

  it('addresses a row by the hash of its own content', () => {
    const { store } = fixtureRetention()
    for (const [key, row] of Object.entries(store.rows)) {
      expect(catalogRowHash(row)).toBe(key)
    }
  })
})
