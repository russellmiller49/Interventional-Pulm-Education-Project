import catalogProducts from '../../data/ip-preference-cards/generated/catalog-products.json'
import catalogRoles from '../../data/ip-preference-cards/generated/roles.json'
import catalogSources from '../../data/ip-preference-cards/generated/sources.json'
import taxonomyOverlay from '../../data/ip-device-intelligence/generated/product-taxonomy-overlay.json'
import { stableId } from './catalog-utils'
import {
  BROCHURE_INTAKE_REVIEW,
  buildBrochureIntakeAdditions,
} from './catalog-additions-brochure-intake'

function normalizeIdentifier(value: string): string {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

describe('reviewed brochure-intake catalog additions', () => {
  const additions = buildBrochureIntakeAdditions({ existingProducts: catalogProducts })

  test('emits the complete reviewed cohort with deterministic manufacturer-aware identities', () => {
    expect(BROCHURE_INTAKE_REVIEW.products).toHaveLength(397)
    expect(additions).toMatchObject({
      warnings: [],
      manufacturers: expect.any(Array),
      sources: expect.any(Array),
    })
    expect(additions.manufacturers).toHaveLength(1)
    expect(additions.sources).toHaveLength(17)
    expect(additions.products).toHaveLength(397)
    expect(additions.productRoles).toHaveLength(378)
    expect(additions.productSources).toHaveLength(398)

    const identities = new Set<string>()
    for (const definition of BROCHURE_INTAKE_REVIEW.products) {
      const expectedId = stableId('PRD', `${definition.manufacturer}|${definition.catalogNumber}`)
      expect(definition.productId).toBe(expectedId)
      const identity = `${definition.manufacturerId}:${normalizeIdentifier(definition.catalogNumber)}`
      expect(identities.has(identity)).toBe(false)
      identities.add(identity)
    }
  })

  test('keeps every addition hidden and honest about unresearched current status', () => {
    for (const product of additions.products) {
      expect(product).toMatchObject({
        verification_grade: 'verified_source',
        visibility_state: 'hidden',
        live_dropdown_status: 'Hidden - current U.S. status unverified',
        source_as_of: null,
      })
      expect(String(product.verification_status)).toMatch(/current U\.S\. status unverified/u)
      expect(String(product.availability_note)).toMatch(/confirm with the manufacturer/u)
    }
  })

  test('has complete source provenance and no duplicate source or role pairs', () => {
    const knownSources = new Set(catalogSources.map((source) => source.source_id))
    const knownRoles = new Set(catalogRoles.map((role) => role.role_code))
    const sourcePairs = new Set<string>()
    const rolePairs = new Set<string>()

    for (const link of additions.productSources) {
      expect(knownSources.has(String(link.source_id))).toBe(true)
      expect(String(link.source_location).trim()).not.toBe('')
      const pair = `${String(link.product_id)}:${String(link.source_id)}`
      expect(sourcePairs.has(pair)).toBe(false)
      sourcePairs.add(pair)
    }
    for (const link of additions.productRoles) {
      expect(knownRoles.has(String(link.role_code))).toBe(true)
      const pair = `${String(link.product_id)}:${String(link.role_code)}`
      expect(rolePairs.has(pair)).toBe(false)
      rolePairs.add(pair)
    }
    for (const product of additions.products) {
      expect(
        sourcePairs.has(`${String(product.product_id)}:${String(product.primary_source_id)}`),
      ).toBe(true)
    }
  })

  test('does not fill unknown boolean, package, or population fields with defaults', () => {
    for (const product of additions.products) {
      expect(product.implantable).toBeNull()
      expect(product.package_uom).toBeNull()
      expect(product.adult_peds).toBeNull()
    }
  })

  test('classifies cuffed and uncuffed Shiley XLT configurations separately', () => {
    const catalogNumberById = new Map(
      catalogProducts.map((product) => [product.product_id, product.catalog_number]),
    )
    const xltRows = taxonomyOverlay.rows
      .map((row) => ({ ...row, catalogNumber: catalogNumberById.get(row.product_id) }))
      .filter((row) => /^\d+XLT(?:CD|UD)$/u.test(row.catalogNumber ?? ''))

    expect(xltRows).toHaveLength(8)
    for (const row of xltRows) {
      expect(row.device_class_code).toBe('tracheostomy_tube')
      expect(row.device_subtype_code).toBe(
        row.catalogNumber?.endsWith('UD')
          ? 'cuffless_tracheostomy_tube'
          : 'cuffed_tracheostomy_tube',
      )
    }
  })
})
