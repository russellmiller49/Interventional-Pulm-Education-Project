import { getCatalogStore, getProductDetail, getUseDetail } from '../server/catalog'

/**
 * The energy platform and collateral-ventilation cohorts — external-review findings F-03 and
 * F-02.
 *
 * The catalog carried eleven FiAPC probes, four cryoprobes, fourteen ERBECRYO accessories, and
 * sixty-nine connecting cables with no console for any of them to attach to, and an
 * endobronchial-valve workflow with no way to record the collateral-ventilation assessment
 * that decides whether valves are placed at all. Both roles resolved to zero products.
 *
 * The archetype is olympus-bronchoscopes.test.ts: presence by catalog number, role exactness,
 * explicit null-pins wherever no manufacturer document backs a dimension, family-name
 * uniqueness, and the governance triple read through all three paths.
 */

const store = getCatalogStore()

function bySku(catalogNumber: string) {
  const product = store.products.find((candidate) => candidate.catalog_number === catalogNumber)
  if (!product) throw new Error(`Catalog number ${catalogNumber} is missing.`)
  return product
}

function rolesOf(productId: string): string[] {
  return (store.rolesByProduct.get(productId) ?? []).map((link) => link.role_code).sort()
}

describe('ERBE VIO 3 and APC 3 (F-03)', () => {
  it('gives the accessories already in the catalog a console to attach to', () => {
    const detail = getUseDetail('ENERGY_PLATFORM')
    expect(detail).not.toBeNull()
    expect(detail!.totalProducts).toBeGreaterThan(0)
    expect(
      detail!.manufacturerGroups.flatMap((group) => group.items.map((i) => i.catalogNumber)),
    ).toEqual(expect.arrayContaining(['10160-000', '10135-000']))
  })

  it('carries the generator by its FDA-recorded name, not the brochure’s generic row', () => {
    const vio3 = bySku('10160-000')
    // The brochure prints 10160-000 as "VIO Electrosurgical unit"; the UDI record names the
    // generation, and the generation is what a clinician says out loud.
    expect(vio3.product_name).toBe('ERBE VIO 3 Electrosurgical Unit')
    expect(vio3.manufacturerDisplay).toBe('ERBE')
    expect(rolesOf(vio3.product_id)).toEqual(['ENERGY_PLATFORM'])
    expect(vio3.verificationTier).toBe('verified')
    expect(vio3.spec_json).toMatchObject({ max_cut_output_w: 400, display_size_in: 10.4 })
  })

  it('takes the APC 3 catalog number from the UDI record, because the brochure prints none', () => {
    const apc3 = bySku('10135-000')
    expect(apc3.product_name).toBe('ERBE APC 3 Argon Plasma Coagulation Unit')
    expect(rolesOf(apc3.product_id)).toEqual(['ENERGY_PLATFORM'])
    // No technical data is claimed for it: the VIO 3 brochure gives the module no specs.
    expect(apc3.spec_json).not.toHaveProperty('max_cut_output_w')
    expect(apc3.diameter_mm).toBeNull()
    expect(apc3.working_length_cm).toBeNull()
    expect(apc3.notes).toEqual(expect.stringContaining('prints no order number'))
  })

  it('separates the footswitches from the generator rather than folding them in', () => {
    for (const sku of ['20189-353', '20188-350']) {
      expect(rolesOf(bySku(sku).product_id)).toEqual(['ENERGY_PLATFORM_ACCESSORY'])
    }
    const detail = getUseDetail('ENERGY_PLATFORM_ACCESSORY')
    expect(detail!.totalProducts).toBe(2)
  })

  it('omits the cart and fastening sets the brochure prints but the UDI database does not', () => {
    // The in-commercial-distribution rule applies to accessories too. The VIO 3 row records
    // where they went, so the gap is documented rather than silent.
    for (const sku of ['20180-000', '20180-140', '20180-143', '20180-144']) {
      expect(store.products.some((product) => product.catalog_number === sku)).toBe(false)
    }
    expect(bySku('10160-000').notes).toEqual(expect.stringContaining('20180-000'))
  })

  it('leaves the sixty-nine connecting cables where the workbook already had them', () => {
    // The plan expected the nine VIO 3 instrument cables to be new. They were already in the
    // workbook; the generator was the row nobody had added.
    for (const sku of ['20192-133', '20196-064', '21196-119']) {
      expect(rolesOf(bySku(sku).product_id)).toEqual(['ENERGY_CABLE_ADAPTER'])
    }
  })

  it('makes the reviewed hot-biopsy compatibility rule resolvable at last', () => {
    // CMP-58DE7D49C4 was authored by the external review pointing at a role with no products.
    expect(store.productIdsByRole.get('ENERGY_PLATFORM')?.length ?? 0).toBeGreaterThan(0)
  })
})

describe('Pulmonx Chartis (F-02)', () => {
  it('fills the collateral-ventilation role with the catheters and both consoles', () => {
    const detail = getUseDetail('COLLATERAL_VENTILATION_SYSTEM')
    expect(detail).not.toBeNull()
    const numbers = detail!.manufacturerGroups.flatMap((group) =>
      group.items.map((item) => item.catalogNumber),
    )
    expect(numbers).toEqual(
      expect.arrayContaining(['CHR-CA-12.0', 'CHR-CA-15.0', 'CHR-CO-100', 'CHR-CO-300']),
    )
  })

  it('records the working-channel requirement, which is the compatibility question that matters', () => {
    const catheter = bySku('CHR-CA-12.0')
    expect(catheter.min_working_channel_mm).toBe(2.8)
    expect(catheter.working_length_cm).toBe(72)
    expect(catheter.diameter_mm).toBe(2.7)
    expect(catheter.spec_json).toMatchObject({
      total_length_cm: 169,
      airway_diameter_range_mm: '5-12',
    })
    expect(rolesOf(catheter.product_id)).toEqual(['COLLATERAL_VENTILATION_SYSTEM'])
  })

  it('claims no dimensions for the products the supplied IFU does not cover', () => {
    for (const sku of ['CHR-CA-15.0', 'CHR-CO-100', 'CHR-CO-300']) {
      const product = bySku(sku)
      expect(product.working_length_cm).toBeNull()
      expect(product.diameter_mm).toBeNull()
      expect(product.min_working_channel_mm).toBeNull()
    }
  })

  it('retains the brochure-verified XL identity while keeping current status unverified', () => {
    const xl = bySku('CHR-CA-12.0-XL')
    expect(xl).toMatchObject({
      verification_grade: 'verified_source',
      visibility_state: 'hidden',
      working_length_cm: 76,
      diameter_mm: 2.7,
      min_working_channel_mm: 2.8,
    })
    expect(rolesOf(xl.product_id)).toEqual(['COLLATERAL_VENTILATION_SYSTEM'])
    expect(bySku('CHR-CA-12.0').notes).toEqual(expect.stringContaining('CHR-CA-12.0-XL'))
  })

  it('cites both the UDI record and the IFU on the catheter', () => {
    const detail = getProductDetail(bySku('CHR-CA-12.0').product_id)
    const sourceIds = detail!.sources.map((source) => source.sourceId).sort()
    expect(sourceIds).toEqual(['SRC046', 'SRC054'])
  })
})

describe('medical thoracoscopy energy', () => {
  it('gives the procedure an energy instrument for the first time', () => {
    const detail = getUseDetail('THORACOSCOPY_ELECTRODE')
    expect(detail!.totalProducts).toBe(3)
    const numbers = detail!.manufacturerGroups
      .flatMap((group) => group.items.map((item) => item.catalogNumber))
      .sort()
    expect(numbers).toEqual(['26072UF', '8379.452', '8379.462'])
  })

  it('keeps the electrodes hidden and candidate-grade, because no UDI record backs them', () => {
    for (const sku of ['8379.452', '8379.462', '26072UF']) {
      const product = bySku(sku)
      expect(product.visibility_state).toBe('hidden')
      expect(product.verificationTier).not.toBe('verified')
      expect(product.availability_note).toEqual(expect.stringContaining('No FDA UDI record'))
    }
  })

  it('distinguishes the four-digit Wolf trocar from the UDI-listed sleeve it resembles', () => {
    // 8919.3311 and 8919.331 are different instruments. Collapsing them would put the wrong
    // one on a card.
    const trocar = bySku('8919.3311')
    expect(rolesOf(trocar.product_id)).toEqual(['THORACOSCOPY_TROCAR'])
    expect(trocar.notes).toEqual(expect.stringContaining('8919.331 is a different'))
    expect(store.products.some((product) => product.catalog_number === '8919.331')).toBe(true)
  })

  it('claims no electrosurgical settings from a sell sheet that states none', () => {
    const forceps = bySku('83912167')
    expect(forceps.notes).toEqual(expect.stringContaining('names no generator'))
    expect(forceps.spec_json).not.toHaveProperty('power_w')
  })
})

describe('procedural imaging', () => {
  it('records the three C-arms by identity alone, with no orderable number invented', () => {
    const detail = getUseDetail('FLUOROSCOPY_C_ARM')
    expect(detail!.totalProducts).toBe(3)
    for (const group of detail!.manufacturerGroups) {
      for (const item of group.items) {
        expect(item.catalogNumber).toBeNull()
        expect(item.diameterMm).toBeNull()
        expect(item.lengthMm).toBeNull()
      }
    }
    expect(detail!.manufacturerGroups.map((group) => group.manufacturerDisplay).sort()).toEqual([
      'GE HealthCare',
      'Siemens Healthineers',
      'Ziehm Imaging',
    ])
  })

  it('does not let a GE document-tracking code become a catalog number', () => {
    expect(store.products.some((product) => product.catalog_number === 'JB02978XX(3)')).toBe(false)
  })

  it('keeps radiation protection custom-resolved, with no product pretending to be stock', () => {
    const detail = getUseDetail('RADIATION_PROTECTION')
    expect(detail).not.toBeNull()
    expect(detail!.totalProducts).toBe(0)
    // The role still has to reach the requirements that need it.
    expect(detail!.procedures.length).toBeGreaterThan(0)
  })
})

describe('family naming across the new cohorts', () => {
  it('keeps every new product line self-describing rather than colliding on brand alone', () => {
    // familyKey splits on product_kind, so one brand across capital equipment and single-use
    // items renders as several identical-looking rows unless the names distinguish them.
    const roleCodes = [
      'ENERGY_PLATFORM',
      'ENERGY_PLATFORM_ACCESSORY',
      'COLLATERAL_VENTILATION_SYSTEM',
      'THORACOSCOPY_ELECTRODE',
      'FLUOROSCOPY_C_ARM',
      'TOMOSYNTHESIS_NAVIGATION_SYSTEM',
      'LASER_CONSOLE',
      'LASER_FIBER',
      'PHOTODYNAMIC_DIFFUSER',
    ]
    for (const roleCode of roleCodes) {
      const families = getUseDetail(roleCode)!.families
      const labels = families.map((family) => `${family.manufacturerDisplay} ${family.familyName}`)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })
})
