import catalogProducts from '../../data/ip-preference-cards/generated/catalog-products.json'
import catalogRoles from '../../data/ip-preference-cards/generated/roles.json'
import catalogSources from '../../data/ip-preference-cards/generated/sources.json'
import manufacturers from '../../data/ip-preference-cards/generated/manufacturers.json'
import releaseBundles from '../../data/ip-preference-cards/seed/release-bundles.json'
import slotOptions from '../../data/ip-preference-cards/generated/slot-product-options.json'
import { stableId } from './catalog-utils'
import {
  buildSourceCompletenessAdditions,
  validateSourceCompletenessIdentities,
} from './catalog-additions-source-completeness'
import { sourceCompletenessCount } from './source-completeness-intake'

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
    expect(additions.sources).toHaveLength(18)
    expect(additions.products).toHaveLength(sourceCompletenessCount('new_exact_products'))
    expect(additions.productRoles).toHaveLength(sourceCompletenessCount('product_roles'))
    expect(additions.productSources).toHaveLength(
      sourceCompletenessCount('product_source_relationships'),
    )
  })

  test('uses deterministic manufacturer-aware product identities and rejects no exact configuration', () => {
    for (const product of additions.products) {
      expect(product.product_id).toBe(
        stableId('PRD', `${String(product.manufacturer)}|${String(product.catalog_number)}`),
      )
    }
    expect(productIds.size).toBe(sourceCompletenessCount('new_exact_products'))
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
      alternate_ids: null,
    })
    expect(byCatalog.get('MCB-1000-4')).toMatchObject({
      alternate_ids: 'MCB-1000',
      sterile_status: 'Sterile',
    })
    expect(byCatalog.get('MCB-1000-Kit')?.sterile_status).toBeNull()
    expect(byCatalog.get('CC-1000-4')?.sterile_status).toBe('Nonsterile')
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

describe('source-completeness cross-product identity guards', () => {
  type Candidate = Parameters<typeof validateSourceCompletenessIdentities>[0][number]
  const candidate = (catalogNumber: string, overrides: Partial<Candidate> = {}): Candidate => ({
    manufacturer: 'Example Medical',
    manufacturerId: 'MFR-EXAMPLE',
    catalogNumber,
    alternateIds: null,
    gtin: null,
    ...overrides,
  })

  test('rejects two new products sharing one manufacturer-scoped alias', () => {
    expect(() =>
      validateSourceCompletenessIdentities(
        [
          candidate('ONE', { alternateIds: 'SHARED' }),
          candidate('TWO', { alternateIds: 'SHARED' }),
        ],
        [],
      ),
    ).toThrow(/alternate identifier .* shared/iu)
  })

  test('rejects a new alternate identifier colliding with another new exact catalog', () => {
    expect(() =>
      validateSourceCompletenessIdentities(
        [candidate('ONE', { alternateIds: 'TWO' }), candidate('TWO')],
        [],
      ),
    ).toThrow(/alternate identifier .* collides with catalog number/iu)
  })

  test('rejects new aliases colliding with existing exact catalogs or aliases', () => {
    const existing = [
      {
        product_id: 'PRD-EXISTING',
        manufacturer_id: 'MFR-EXAMPLE',
        manufacturer: 'Example Medical',
        catalog_number: 'BASE',
        alternate_ids: 'LEGACY',
        gtin: null,
      },
    ]
    expect(() =>
      validateSourceCompletenessIdentities([candidate('ONE', { alternateIds: 'BASE' })], existing),
    ).toThrow(/existing catalog number/iu)
    expect(() =>
      validateSourceCompletenessIdentities(
        [candidate('ONE', { alternateIds: 'LEGACY' })],
        existing,
      ),
    ).toThrow(/already an alias/iu)
  })

  test('rejects duplicate new GTINs and an existing GTIN collision', () => {
    expect(() =>
      validateSourceCompletenessIdentities(
        [candidate('ONE', { gtin: '000123' }), candidate('TWO', { gtin: '000123' })],
        [],
      ),
    ).toThrow(/duplicate reviewed GTIN/iu)
    expect(() =>
      validateSourceCompletenessIdentities(
        [candidate('ONE', { gtin: '000123' })],
        [
          {
            product_id: 'PRD-EXISTING',
            manufacturer_id: 'MFR-OTHER',
            catalog_number: 'OTHER',
            alternate_ids: null,
            gtin: '000123',
          },
        ],
      ),
    ).toThrow(/already belongs/iu)
  })
})
