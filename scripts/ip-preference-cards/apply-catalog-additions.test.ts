import additionsJson from '../../data/ip-preference-cards/seed/catalog-additions.json'
import catalogProductsJson from '../../data/ip-preference-cards/generated/catalog-products.json'
import manufacturersJson from '../../data/ip-preference-cards/generated/manufacturers.json'
import rolesJson from '../../data/ip-preference-cards/generated/roles.json'
import sourcesJson from '../../data/ip-preference-cards/generated/sources.json'
import {
  mergeCatalogAdditions,
  validateCatalogAdditions,
  type CatalogAdditionsFile,
} from './apply-catalog-additions'

function cloneAdditions(): CatalogAdditionsFile {
  return JSON.parse(JSON.stringify(additionsJson)) as CatalogAdditionsFile
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizedFixture() {
  const addedProductIds = new Set(additionsJson.products.map((product) => product.product_id))
  const referencedExistingProductIds = new Set(
    additionsJson.product_sources
      .map((relationship) => relationship.product_id)
      .filter((productId) => !addedProductIds.has(productId)),
  )
  return {
    Products: clone(
      catalogProductsJson.filter((product) => referencedExistingProductIds.has(product.product_id)),
    ) as Record<string, unknown>[],
    Product_Roles: [] as Record<string, unknown>[],
    Product_Sources: [] as Record<string, unknown>[],
    Manufacturers: clone(manufacturersJson) as Record<string, unknown>[],
    Sources: clone(sourcesJson) as Record<string, unknown>[],
    Roles: rolesJson as Record<string, unknown>[],
  }
}

describe('reviewed catalog-addition validation', () => {
  test('accepts the complete governed seed and applies it atomically', () => {
    const normalized = normalizedFixture()
    const additions = cloneAdditions()

    expect(validateCatalogAdditions(normalized, additions)).toEqual([])
    const report = mergeCatalogAdditions(normalized, additions)
    expect(report).toMatchObject({
      applied: true,
      products_added: additions.products.length,
      product_roles_added: additions.product_roles.length,
      product_sources_added: additions.product_sources.length,
      errors: [],
    })
  })

  test('rejects malformed and unexpected fields before mutation', () => {
    const normalized = normalizedFixture()
    const additions = cloneAdditions()
    additions.products[0].catalog_number = 3600100
    additions.products[0].unexpected = 'not governed'

    const before = clone(normalized)
    const report = mergeCatalogAdditions(normalized, additions)
    expect(report.applied).toBe(false)
    expect(report.errors).toEqual(
      expect.arrayContaining([
        'products[0] has unexpected field unexpected.',
        'products[0].catalog_number must be string or null.',
      ]),
    )
    expect(normalized).toEqual(before)
  })

  test('rejects internal IDs and relationship-pair collisions', () => {
    const additions = cloneAdditions()
    additions.products.push(clone(additions.products[0]))
    additions.product_roles.push(clone(additions.product_roles[0]))
    additions.product_sources.push(clone(additions.product_sources[0]))

    const errors = validateCatalogAdditions(normalizedFixture(), additions)
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('duplicate product ID'),
        expect.stringContaining('duplicate product-role pair'),
        expect.stringContaining('duplicate product-source pair'),
      ]),
    )
  })

  test('uses manufacturer-scoped identifiers for duplicate detection', () => {
    const additions = cloneAdditions()
    const product = additions.products[0]
    const normalized = normalizedFixture()
    const workbookProductIndex = normalized.Products.length
    normalized.Products.push({
      product_id: 'PRD-WORKBOOK',
      manufacturer_id: product.manufacturer_id,
      catalog_number: '3600 100',
    })

    expect(validateCatalogAdditions(normalized, additions)).toContain(
      `Addition product ${String(product.product_id)} duplicates manufacturer-scoped catalog identity held by PRD-WORKBOOK.`,
    )

    normalized.Products[workbookProductIndex].manufacturer_id = 'MFR-DIFFERENT'
    expect(validateCatalogAdditions(normalized, additions)).not.toEqual(
      expect.arrayContaining([expect.stringContaining('manufacturer-scoped catalog identity')]),
    )
  })

  test('rejects product-ID collisions and dangling manufacturer, source, product, and role references', () => {
    const additions = cloneAdditions()
    const product = additions.products[0]
    const normalized = normalizedFixture()
    normalized.Products.push({
      product_id: product.product_id,
      manufacturer_id: 'MFR-OTHER',
      catalog_number: 'OTHER',
    })
    product.manufacturer_id = 'MFR-MISSING'
    product.primary_source_id = 'SRC-MISSING'
    additions.product_roles[0].role_code = 'ROLE-MISSING'
    additions.product_sources[0].product_id = 'PRD-MISSING'
    additions.product_sources[0].source_id = 'SRC-MISSING'

    const errors = validateCatalogAdditions(normalized, additions)
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('collides with a workbook product'),
        expect.stringContaining('references unknown manufacturer MFR-MISSING'),
        expect.stringContaining('references unknown primary source SRC-MISSING'),
        expect.stringContaining('references unknown role ROLE-MISSING'),
        expect.stringContaining('references unknown product PRD-MISSING'),
        expect.stringContaining('references unknown source SRC-MISSING'),
        expect.stringContaining('has no product-source relationship for its primary source'),
      ]),
    )
  })
})
