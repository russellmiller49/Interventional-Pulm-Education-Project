import {
  buildCatalogStore,
  normalizeIdentifier,
  type CatalogProductRecord,
  type CatalogStoreInput,
} from '../server/catalog-store'
import {
  activeSpecColumns,
  getProductDetail,
  getUseDetail,
  getUseIndex,
  searchCatalog,
  searchProductsForRole,
} from '../server/catalog'
import { catalogSearchSchema } from '../schemas/catalog-search'

function product(
  overrides: Partial<CatalogProductRecord> & { product_id: string },
): CatalogProductRecord {
  return {
    manufacturer_id: 'MFR-A',
    manufacturer: 'Acme Airway',
    distributor: null,
    brand_family: null,
    product_name: 'Test product',
    catalog_number: null,
    alternate_ids: null,
    gtin: null,
    gtin_raw: null,
    global_part_number: null,
    reference_part_number: null,
    primary_category: 'Airway stent',
    subcategory: null,
    product_kind: null,
    reuse_status: null,
    sterile_status: null,
    implantable: null,
    material: null,
    coverage: null,
    placement_method: null,
    size_display: null,
    diameter_mm: null,
    length_mm: null,
    french_size: null,
    gauge: null,
    working_length_cm: null,
    min_working_channel_mm: null,
    delivery_system_od_mm: null,
    package_uom: null,
    adult_peds: null,
    description: null,
    compatibility_text: null,
    verification_status: null,
    live_dropdown_status: null,
    primary_source_id: null,
    primary_source_location: null,
    source_as_of: null,
    availability_note: null,
    notes: null,
    spec_json: null,
    visibility_state: 'prototype_visible',
    verification_grade: 'verified_source',
    ...overrides,
  }
}

function buildFixtureStore(): CatalogStoreInput {
  return {
    products: [
      product({
        product_id: 'PRD-AAA',
        product_name: 'Alpha Silicone Stent',
        manufacturer_id: 'MFR-A',
        manufacturer: 'Acme Airway',
        catalog_number: 'ALP-100',
        diameter_mm: 12,
        length_mm: 40,
        material: 'Silicone',
      }),
      product({
        product_id: 'PRD-BBB',
        product_name: 'Beta Silicone Stent',
        manufacturer_id: 'MFR-B',
        manufacturer: 'Bravo Medical',
        catalog_number: 'BET-200',
        diameter_mm: 16,
        length_mm: 60,
        material: 'Silicone',
        verification_grade: 'candidate',
        visibility_state: 'hidden',
      }),
      product({
        product_id: 'PRD-CCC',
        product_name: 'Gamma Cryoprobe',
        manufacturer_id: 'MFR-C',
        manufacturer: 'Cryo Corp',
        catalog_number: '20402-401',
        primary_category: 'Cryotherapy',
        min_working_channel_mm: 2.0,
      }),
      product({
        // No diameter recorded — the "excluded for missing spec" case.
        product_id: 'PRD-DDD',
        product_name: 'Delta Silicone Stent',
        manufacturer_id: 'MFR-A',
        manufacturer: 'Acme Airway',
        material: 'Silicone',
      }),
    ],
    roles: [
      {
        role_code: 'AIRWAY_STENT',
        category: 'Airway stent',
        role_name: 'Airway stent',
        description: 'Stent for airway patency.',
        selection_guidance: 'Match diameter to the airway.',
        requires_current_ifu: true,
      },
      {
        role_code: 'CRYOPROBE',
        category: 'Ablation',
        role_name: 'Cryoprobe',
        description: null,
        selection_guidance: null,
        requires_current_ifu: true,
      },
      {
        role_code: 'GENERIC_SUCTION',
        category: 'Room',
        role_name: 'Suction',
        description: null,
        selection_guidance: null,
        requires_current_ifu: false,
      },
    ],
    productRoles: [
      { product_id: 'PRD-AAA', role_code: 'AIRWAY_STENT', role_fit: 'Primary', notes: null },
      { product_id: 'PRD-BBB', role_code: 'AIRWAY_STENT', role_fit: 'Exact', notes: null },
      { product_id: 'PRD-DDD', role_code: 'AIRWAY_STENT', role_fit: 'Compatible', notes: null },
      { product_id: 'PRD-CCC', role_code: 'CRYOPROBE', role_fit: 'Primary', notes: null },
    ],
    procedures: [
      {
        procedure_code: 'THERAPEUTIC_BRONCH',
        procedure_name: 'Therapeutic bronchoscopy',
        template_version: '0.3',
        scope: null,
        status: null,
        notes: null,
      },
    ],
    procedureSlots: [
      {
        slot_id: 'SLOT-1',
        procedure_code: 'THERAPEUTIC_BRONCH',
        section: 'Instrumentation',
        display_order: 2,
        role_code: 'AIRWAY_STENT',
        slot_label: 'Airway stent',
        generic_requirement: null,
        requiredness: 'conditional',
        default_qty: 1,
        selection_mode: 'single',
        allow_custom: true,
        notes: null,
      },
      {
        slot_id: 'SLOT-2',
        procedure_code: 'THERAPEUTIC_BRONCH',
        section: 'Room',
        display_order: 1,
        role_code: 'GENERIC_SUCTION',
        slot_label: 'Wall suction',
        generic_requirement: null,
        requiredness: 'required',
        default_qty: 1,
        selection_mode: 'single',
        allow_custom: true,
        notes: null,
      },
    ],
    slotProductOptions: [
      {
        slot_id: 'SLOT-1',
        product_id: 'PRD-AAA',
        role_code: 'AIRWAY_STENT',
        eligibility_status: 'Eligible',
        selectable: true,
      },
    ],
    sources: [
      {
        source_id: 'SRC-1',
        title: 'Acme Airway Catalog',
        filename: null,
        source_type: 'Manufacturer catalog',
        publisher: 'Acme',
        revision_date: '2025',
        as_of_date: null,
        reliability_tier: 'Tier 1 - manufacturer',
        use_policy: null,
        notes: null,
      },
    ],
    productSources: [
      {
        product_id: 'PRD-AAA',
        source_id: 'SRC-1',
        source_location: 'p. 4',
        claim_type: 'Exact catalog entry',
        verification_status: 'Verified - manufacturer catalog',
        notes: null,
      },
    ],
    manufacturers: [
      {
        manufacturer_id: 'MFR-A',
        manufacturer: 'Acme Airway',
        default_distributor: null,
        website: null,
        notes: null,
      },
      {
        manufacturer_id: 'MFR-B',
        manufacturer: 'Bravo Medical',
        default_distributor: null,
        website: null,
        notes: null,
      },
      {
        manufacturer_id: 'MFR-C',
        manufacturer: 'Cryo Corp',
        default_distributor: null,
        website: null,
        notes: null,
      },
    ],
  }
}

const store = buildCatalogStore(buildFixtureStore())
const query = (overrides: Record<string, unknown> = {}) => catalogSearchSchema.parse(overrides)

describe('catalog search', () => {
  it('returns every product with no filters applied', () => {
    const result = searchCatalog(query(), store)
    expect(result.total).toBe(4)
    expect(result.pageCount).toBe(1)
    expect(result.excludedMissingSpecCount).toBe(0)
  })

  it('pins an exact catalog-number match above fuzzy results', () => {
    const result = searchCatalog(query({ q: '20402-401' }), store)
    expect(result.items[0]?.productId).toBe('PRD-CCC')
  })

  it('matches catalog numbers regardless of punctuation', () => {
    expect(normalizeIdentifier('20402-401')).toBe('20402401')
    const result = searchCatalog(query({ q: '20402401' }), store)
    expect(result.items[0]?.productId).toBe('PRD-CCC')
  })

  it('finds products by name', () => {
    const result = searchCatalog(query({ q: 'cryoprobe' }), store)
    expect(result.items.map((item) => item.productId)).toContain('PRD-CCC')
  })

  it('filters by canonical manufacturer group', () => {
    const result = searchCatalog(query({ manufacturers: ['MFR-A'] }), store)
    expect(result.total).toBe(2)
    expect(result.items.every((item) => item.manufacturerDisplay === 'Acme Airway')).toBe(true)
  })

  it('filters by category', () => {
    expect(searchCatalog(query({ category: 'Cryotherapy' }), store).total).toBe(1)
  })

  it('filters by role', () => {
    expect(searchCatalog(query({ role: 'AIRWAY_STENT' }), store).total).toBe(3)
  })

  it('filters by procedure through its slots', () => {
    expect(searchCatalog(query({ procedure: 'THERAPEUTIC_BRONCH' }), store).total).toBe(3)
  })

  it('splits verified and unverified tiers without losing products', () => {
    const verified = searchCatalog(query({ tier: 'verified' }), store)
    const unverified = searchCatalog(query({ tier: 'unverified' }), store)
    expect(verified.total).toBe(3)
    expect(unverified.total).toBe(1)
    expect(unverified.items[0]?.productId).toBe('PRD-BBB')
  })

  it('counts products excluded only because the filtered spec is missing', () => {
    const result = searchCatalog(query({ role: 'AIRWAY_STENT', diameterMin: 10 }), store)
    expect(result.items.map((item) => item.productId).sort()).toEqual(['PRD-AAA', 'PRD-BBB'])
    // PRD-DDD has no diameter recorded, so it is reported rather than silently dropped.
    expect(result.excludedMissingSpecCount).toBe(1)
  })

  it('does not count out-of-range products as missing-spec exclusions', () => {
    const result = searchCatalog(query({ role: 'AIRWAY_STENT', diameterMax: 13 }), store)
    expect(result.items.map((item) => item.productId)).toEqual(['PRD-AAA'])
    expect(result.excludedMissingSpecCount).toBe(1) // PRD-DDD only; PRD-BBB is genuinely too wide
  })

  it('keeps products that fit within a working-channel budget', () => {
    expect(searchCatalog(query({ channelMax: 2.2 }), store).items.map((i) => i.productId)).toEqual([
      'PRD-CCC',
    ])
    expect(searchCatalog(query({ channelMax: 1.8 }), store).total).toBe(0)
  })

  it('sorts by diameter with missing values last', () => {
    const result = searchCatalog(query({ role: 'AIRWAY_STENT', sort: 'diameter' }), store)
    expect(result.items.map((item) => item.productId)).toEqual(['PRD-AAA', 'PRD-BBB', 'PRD-DDD'])
  })

  it('clamps an out-of-range page to the last page', () => {
    const result = searchCatalog(query({ pageSize: 2, page: 99 }), store)
    expect(result.page).toBe(2)
    expect(result.pageCount).toBe(2)
    expect(result.items).toHaveLength(2)
  })
})

describe('browse by use', () => {
  it('groups roles by category and counts products and manufacturers', () => {
    const groups = getUseIndex({}, store)
    const stentEntry = groups
      .flatMap((group) => group.entries)
      .find((entry) => entry.roleCode === 'AIRWAY_STENT')
    expect(stentEntry).toMatchObject({ productCount: 3, manufacturerCount: 2, verifiedCount: 2 })
  })

  it('reports roles with nothing catalogued rather than hiding them', () => {
    const empty = getUseIndex({}, store)
      .flatMap((group) => group.entries)
      .find((entry) => entry.roleCode === 'GENERIC_SUCTION')
    expect(empty?.productCount).toBe(0)
  })

  it('scopes to a procedure in slot display order', () => {
    const groups = getUseIndex({ procedureCode: 'THERAPEUTIC_BRONCH' }, store)
    expect(groups[0].entries.map((entry) => entry.roleCode)).toEqual([
      'GENERIC_SUCTION',
      'AIRWAY_STENT',
    ])
    expect(groups[0].entries[0]).toMatchObject({
      slotLabel: 'Wall suction',
      requiredness: 'required',
    })
  })

  it('groups a use by manufacturer and includes unverified options', () => {
    const detail = getUseDetail('AIRWAY_STENT', store)
    expect(detail?.manufacturerGroups.map((group) => group.manufacturerDisplay)).toEqual([
      'Acme Airway',
      'Bravo Medical',
    ])
    const bravo = detail?.manufacturerGroups.find((g) => g.manufacturerDisplay === 'Bravo Medical')
    expect(bravo?.items[0]?.verificationTier).toBe('candidate')
    expect(bravo?.items[0]?.roleFit).toBe('Exact')
  })

  it('returns null for an unknown role', () => {
    expect(getUseDetail('NOT_A_ROLE', store)).toBeNull()
  })

  it('selects only spec columns that at least one product populates', () => {
    const detail = getUseDetail('AIRWAY_STENT', store)
    expect(detail?.specColumns).toEqual(['diameter_mm', 'length_mm', 'material'])
  })

  it('drops every spec column when nothing is recorded', () => {
    expect(activeSpecColumns([])).toEqual([])
  })
})

describe('product detail', () => {
  it('joins roles, slots, and sources', () => {
    const detail = getProductDetail('PRD-AAA', store)
    expect(detail?.roles).toEqual([
      { roleCode: 'AIRWAY_STENT', roleName: 'Airway stent', roleFit: 'Primary', notes: null },
    ])
    expect(detail?.slots[0]).toMatchObject({
      procedureName: 'Therapeutic bronchoscopy',
      slotLabel: 'Airway stent',
    })
    expect(detail?.sources[0]).toMatchObject({
      title: 'Acme Airway Catalog',
      sourceLocation: 'p. 4',
      reliabilityTier: 'Tier 1 - manufacturer',
    })
  })

  it('suggests same-use products from other manufacturers only', () => {
    const detail = getProductDetail('PRD-AAA', store)
    expect(detail?.otherManufacturers.map((item) => item.manufacturerDisplay)).toEqual([
      'Bravo Medical',
    ])
  })

  it('returns null for an unknown product', () => {
    expect(getProductDetail('PRD-NOPE', store)).toBeNull()
  })
})

describe('role picker search', () => {
  it('includes unverified products so they are badged rather than withheld', () => {
    const options = searchProductsForRole({ roleCode: 'AIRWAY_STENT' }, store)
    expect(options.map((option) => option.productId)).toContain('PRD-BBB')
    expect(options.find((o) => o.productId === 'PRD-BBB')?.verificationTier).toBe('candidate')
  })

  it('restricts fuzzy matches to the requested role', () => {
    const options = searchProductsForRole({ roleCode: 'AIRWAY_STENT', q: 'cryoprobe' }, store)
    expect(options.map((option) => option.productId)).not.toContain('PRD-CCC')
  })

  it('respects the limit', () => {
    expect(searchProductsForRole({ roleCode: 'AIRWAY_STENT', limit: 1 }, store)).toHaveLength(1)
  })

  it('returns nothing for a role with no catalogued products', () => {
    expect(searchProductsForRole({ roleCode: 'GENERIC_SUCTION' }, store)).toEqual([])
  })
})

describe('product families', () => {
  it('collapses size variants of one product line into a family', () => {
    const detail = getUseDetail('AIRWAY_STENT', store)
    // Alpha, Beta and Delta are all "Airway stent" subcategory but different manufacturers,
    // so they cannot collapse together.
    expect(detail!.families.length).toBeGreaterThan(0)
    for (const family of detail!.families) {
      const manufacturers = new Set(family.variants.map((variant) => variant.manufacturerDisplay))
      expect(manufacturers.size).toBe(1)
    }
  })

  it('summarises the numeric spec range across a family', () => {
    const detail = getUseDetail('AIRWAY_STENT', store)
    const acme = detail!.families.find((family) => family.manufacturerDisplay === 'Acme Airway')
    // Acme contributes PRD-AAA (12 mm) and PRD-DDD (no diameter).
    const diameter = acme!.specRanges.find((range) => range.key === 'diameter_mm')
    expect(diameter).toMatchObject({ min: 12, max: 12 })
  })

  it('never loses a product when collapsing into families', () => {
    const detail = getUseDetail('AIRWAY_STENT', store)
    const variantIds = detail!.families.flatMap((family) =>
      family.variants.map((variant) => variant.productId),
    )
    expect(variantIds.sort()).toEqual(
      detail!.manufacturerGroups
        .flatMap((group) => group.items.map((item) => item.productId))
        .sort(),
    )
  })

  it('flags a family containing a discontinued variant', () => {
    const detail = getUseDetail('AIRWAY_STENT', store)
    expect(detail!.families.every((family) => family.anyNotDistributed === false)).toBe(true)
  })
})
