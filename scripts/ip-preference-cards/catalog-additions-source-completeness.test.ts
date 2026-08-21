import catalogProducts from '../../data/ip-preference-cards/generated/catalog-products.json'
import catalogRoles from '../../data/ip-preference-cards/generated/roles.json'
import catalogSources from '../../data/ip-preference-cards/generated/sources.json'
import manufacturers from '../../data/ip-preference-cards/generated/manufacturers.json'
import releaseBundles from '../../data/ip-preference-cards/seed/release-bundles.json'
import slotOptions from '../../data/ip-preference-cards/generated/slot-product-options.json'
import { stableId } from './catalog-utils'
import { buildSourceCompletenessAdditions } from './catalog-additions-source-completeness'

describe('source-completeness catalog additions', () => {
  const additions = buildSourceCompletenessAdditions({
    existingProducts: catalogProducts,
    existingManufacturers: manufacturers,
    existingSources: catalogSources,
  })
  const byCatalog = new Map(additions.products.map((product) => [product.catalog_number, product]))
  const productIds = new Set(additions.products.map((product) => String(product.product_id)))

  test('emits the reviewed exact cohort, new manufacturers, sources, roles, and provenance', () => {
    expect(additions.warnings).toEqual([])
    expect(additions.manufacturers).toHaveLength(6)
    expect(additions.sources).toHaveLength(16)
    expect(additions.products).toHaveLength(44)
    expect(additions.productRoles).toHaveLength(38)
    expect(additions.productSources).toHaveLength(119)
  })

  test('uses deterministic manufacturer-aware product identities and rejects no exact configuration', () => {
    for (const product of additions.products) {
      expect(product.product_id).toBe(
        stableId('PRD', `${String(product.manufacturer)}|${String(product.catalog_number)}`),
      )
    }
    expect(productIds.size).toBe(44)
    expect(new Set(additions.products.map((product) => product.gtin).filter(Boolean)).size).toBe(19)
  })

  test('keeps every new product hidden, verified-source, and honest about orderability', () => {
    for (const product of additions.products) {
      expect(product).toMatchObject({
        verification_grade: 'verified_source',
        visibility_state: 'hidden',
        source_as_of: '2026-08-20',
      })
      expect(String(product.live_dropdown_status)).toMatch(/^Hidden/u)
      expect(String(product.availability_note)).toMatch(/local orderability were not established/u)
    }
  })

  test('preserves exact alternate identifiers and legal manufacturer/distributor relationships', () => {
    expect(byCatalog.get('G34281')).toBeUndefined()
    expect(byCatalog.get('10040001')).toMatchObject({
      manufacturer: 'Axess Vision Technology S.A.S.',
      distributor: 'TSC Life US',
    })
    expect(byCatalog.get('MCB-1000-Kit')).toMatchObject({
      manufacturer: 'Serpex Medical',
      distributor: 'Thoracent',
      alternate_ids: 'MCB-1000',
    })
    expect(byCatalog.get('BR-M50')).toMatchObject({
      manufacturer: 'Shenzhen HugeMed Medical Technical Development Co., Ltd.',
      distributor: 'EndoTherapeutics',
      gtin: '06970462546085',
    })
    expect(byCatalog.get('ENDO-FR-22G-Kit-O')).toMatchObject({
      alternate_ids: 'ENDO-FR-22G-O; Primary DI 00850081350040',
      gtin: '10850081350047',
      gauge: 22,
      min_working_channel_mm: 2,
    })
    expect(byCatalog.get('30030000')?.gtin).toBeNull()
    expect(byCatalog.get('30030001')?.gtin).toBe('03664977030032')
  })

  test('uses only gate-available role vocabulary and keeps six exact products intentionally roleless', () => {
    const knownRoles = new Set(catalogRoles.map((role) => role.role_code))
    for (const role of additions.productRoles) {
      expect(knownRoles.has(String(role.role_code))).toBe(true)
    }
    const roleIds = new Set(additions.productRoles.map((role) => String(role.product_id)))
    const rolelessCatalogNumbers = additions.products
      .filter((product) => !roleIds.has(String(product.product_id)))
      .map((product) => product.catalog_number)
      .sort()
    expect(rolelessCatalogNumbers).toEqual(
      ['1899076', '30030010', '30030303', '31010008', '41010000', 'CC-1000-4'].sort(),
    )
  })

  test('creates complete valid source links, including provenance-only links for existing Cook rows', () => {
    const knownSources = new Set([
      ...catalogSources.map((source) => source.source_id),
      ...additions.sources.map((source) => String(source.source_id)),
    ])
    const pairs = new Set<string>()
    for (const link of additions.productSources) {
      expect(knownSources.has(String(link.source_id))).toBe(true)
      expect(String(link.source_location).trim()).not.toBe('')
      const pair = `${String(link.product_id)}:${String(link.source_id)}`
      expect(pairs.has(pair)).toBe(false)
      pairs.add(pair)
    }
    expect(
      additions.productSources
        .filter((link) => link.source_id === 'SRC089' && !productIds.has(String(link.product_id)))
        .map((link) => link.product_id)
        .sort(),
    ).toEqual(['PRD-5CC8131FDE', 'PRD-2D0C9B936A', 'PRD-2DA93F54B9', 'PRD-3F51C7D66F'].sort())
  })

  test('does not promote slot options or mutate published release definitions', () => {
    expect(slotOptions).toHaveLength(2035)
    expect(slotOptions.some((option) => productIds.has(option.product_id))).toBe(false)
    const releaseBytes = JSON.stringify(releaseBundles)
    for (const productId of productIds) expect(releaseBytes).not.toContain(productId)
  })
})
