import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import { getProductTaxonomy } from '@/features/device-intelligence/server/product-taxonomy.server'
import type { CatalogProduct } from '@/features/preference-cards/server/catalog-store'

/**
 * The production examples the physician owner reported on the live D2B atlas, pinned as
 * MANDATORY regressions for the D2C normalization:
 *
 *  1. "Guidewire" and "Airway stenting" both held guidewires — all four named wires must
 *     share deviceClass `guidewire` regardless of their source category.
 *  2. "Airway stenting" also held the AEROSIZER sizing device — a workflow grouping must
 *     never make a sizing device a guidewire's neighbor by class.
 *  3. Physically identical bronchoscopes were split across "Flexible bronchoscopy",
 *     "Bronchoscopy platform", and "EBUS platform" by manufacturer — all physical
 *     bronchoscopes must share deviceClass `bronchoscope`, with subtype carrying the
 *     real physical differences.
 */

const store = getAtlasCatalogStore()

function productNamed(name: string, filter?: (product: CatalogProduct) => boolean): CatalogProduct {
  const matches = store.products.filter(
    (product) => product.product_name === name && (filter?.(product) ?? true),
  )
  expect(matches.length).toBeGreaterThan(0)
  return matches[0]
}

describe('D2C mandatory production examples', () => {
  it('classifies all four named guidewires as deviceClass=guidewire across their old categories', () => {
    const amplatz = productNamed('Amplatz Super Stiff Guidewire')
    const jagwire = productNamed('Jagwire Single-Use Pulmonary Guidewire')
    const maxxwires = store.products.filter(
      (product) => product.product_name === 'MAXXwire Guide Wire',
    )
    // The two MAXXwire lengths (180 cm and 260 cm) are separate catalog products.
    expect(maxxwires.length).toBe(2)
    expect(new Set(maxxwires.map((product) => product.size_display)).size).toBe(2)

    for (const wire of [amplatz, jagwire, ...maxxwires]) {
      expect(getProductTaxonomy(wire.product_id).deviceClassCode).toBe('guidewire')
    }
    // Subtype preserves the meaningful physical differences.
    expect(getProductTaxonomy(amplatz.product_id).deviceSubtypeCode).toBe('super_stiff_guidewire')
    expect(getProductTaxonomy(jagwire.product_id).deviceSubtypeCode).toBe('pulmonary_guidewire')
    for (const wire of maxxwires) {
      expect(getProductTaxonomy(wire.product_id).deviceSubtypeCode).toBe('pulmonary_guidewire')
    }
    // The source-category split this fixes: the MAXXwires came from "Airway stenting",
    // the Boston Scientific wires from "Guidewire" — canonical fields are untouched.
    for (const wire of maxxwires) expect(wire.primary_category).toBe('Airway stenting')
    expect(amplatz.primary_category).toBe('Guidewire')
  })

  it('classifies the AEROSIZER as a sizing device, never a guidewire', () => {
    const aerosizer = productNamed('AEROSIZER Airway Sizing Device')
    const taxonomy = getProductTaxonomy(aerosizer.product_id)
    expect(taxonomy.deviceClassCode).toBe('sizing_measuring')
    expect(taxonomy.deviceSubtypeCode).toBe('airway_sizing_device')
    // Its role/procedure links may still say airway stenting; its class must not.
    expect(aerosizer.primary_category).toBe('Airway stenting')
    expect(taxonomy.deviceClassCode).not.toBe('guidewire')
  })

  it('gives every physical bronchoscope deviceClass=bronchoscope across manufacturers and source categories', () => {
    const olympusReusable = productNamed('BF-Q190 Video Bronchoscope')
    const fujifilmReusable = productNamed('FUJIFILM EB-530S Video Bronchoscope')
    const olympusEbus = productNamed('BF-UC190F Ultrasound Bronchofibervideoscope')
    const fujifilmEbus = productNamed('FUJIFILM EB-530US Ultrasonic Bronchoscope')
    const singleUse = productNamed('Ambu aScope 5 Broncho HD 5.0/2.2')
    const robotic = productNamed('Galaxy Bronchoscope')

    for (const scope of [
      olympusReusable,
      fujifilmReusable,
      olympusEbus,
      fujifilmEbus,
      singleUse,
      robotic,
    ]) {
      expect({
        name: scope.product_name,
        deviceClass: getProductTaxonomy(scope.product_id).deviceClassCode,
      }).toEqual({ name: scope.product_name, deviceClass: 'bronchoscope' })
    }

    // The split this fixes: Olympus reusable scopes lived under "Flexible bronchoscopy",
    // Fujifilm's under "Bronchoscopy platform", EBUS scopes under two more categories.
    expect(olympusReusable.primary_category).toBe('Flexible bronchoscopy')
    expect(fujifilmReusable.primary_category).toBe('Bronchoscopy platform')
    expect(olympusEbus.primary_category).toBe('EBUS platform')
    expect(fujifilmEbus.primary_category).toBe('Bronchoscopy platform')

    // EBUS and conventional scopes share the class but keep distinct subtypes.
    expect(getProductTaxonomy(olympusEbus.product_id).deviceSubtypeCode).toBe('ebus_bronchoscope')
    expect(getProductTaxonomy(fujifilmEbus.product_id).deviceSubtypeCode).toBe('ebus_bronchoscope')
    expect(getProductTaxonomy(olympusReusable.product_id).deviceSubtypeCode).toBe(
      'reusable_video_bronchoscope',
    )
    expect(getProductTaxonomy(fujifilmReusable.product_id).deviceSubtypeCode).toBe(
      'reusable_video_bronchoscope',
    )
    expect(getProductTaxonomy(singleUse.product_id).deviceSubtypeCode).toBe(
      'single_use_video_bronchoscope',
    )
    expect(getProductTaxonomy(robotic.product_id).deviceSubtypeCode).toBe('robotic_bronchoscope')

    // Manufacturer differences never create different classes: every manufacturer whose
    // products carry the bronchoscope class shares the one class code by construction,
    // and the class spans at least four manufacturers.
    const bronchoscopeManufacturers = new Set(
      store.products
        .filter(
          (product) => getProductTaxonomy(product.product_id).deviceClassCode === 'bronchoscope',
        )
        .map((product) => product.manufacturerDisplay),
    )
    expect(bronchoscopeManufacturers.size).toBeGreaterThanOrEqual(4)
  })

  it('keeps name-detected physical subtypes: ultrathin, fiberscope, therapeutic', () => {
    expect(
      getProductTaxonomy(productNamed('BF-XP190 Ultrathin Video Bronchoscope').product_id),
    ).toMatchObject({
      deviceClassCode: 'bronchoscope',
      deviceSubtypeCode: 'ultrathin_video_bronchoscope',
    })
    expect(getProductTaxonomy(productNamed('BF-PE2 Bronchofiberscope').product_id)).toMatchObject({
      deviceClassCode: 'bronchoscope',
      deviceSubtypeCode: 'bronchofiberscope',
    })
    expect(
      getProductTaxonomy(productNamed('BF-1TH190 Video Bronchoscope').product_id),
    ).toMatchObject({
      deviceClassCode: 'bronchoscope',
      deviceSubtypeCode: 'therapeutic_video_bronchoscope',
    })
  })
})
