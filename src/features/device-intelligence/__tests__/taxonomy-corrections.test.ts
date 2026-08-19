import enMessages from '../../../../messages/en.json'
import esMessages from '../../../../messages/es.json'
import zhCnMessages from '../../../../messages/zh-CN.json'

import {
  deviceClassOfSubtype,
  isDeviceClassCode,
  isDeviceSubtypeCode,
} from '@/features/device-intelligence/domain/product-taxonomy'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import { getProductTaxonomy } from '@/features/device-intelligence/server/product-taxonomy.server'

/**
 * The independent-review semantic corrections (D2C-REV-001/002/003/008), pinned as
 * regressions over the committed overlay: physical identity decides the class, clinical
 * retrieval/pleurodesis use stays in the governed role and procedure facets, and no
 * mixed-physical-type class remains in the vocabulary.
 */

const store = getAtlasCatalogStore()

const taxonomyOf = (productId: string) => getProductTaxonomy(productId)

const cohortProductsNamed = (pattern: RegExp) =>
  store.products.filter((product) => pattern.test(product.product_name))

describe('D2C-REV-001 — retrieval forceps are forceps, baskets are baskets', () => {
  const RETRIEVAL_FORCEPS = [
    'PRD-2677F0C69F', // Rubber-Tip Grasping Forceps
    'PRD-9844E2B578', // Rescue Pulmonary Grasping Forceps
    'PRD-9C633556C2', // Mini Three-Prong Grasping Forceps
    'PRD-BEB189750B', // W-Shape Grasping Forceps
    'PRD-C88B1CD284', // Shark-Tooth Grasping Forceps
    'PRD-D5A6823E45', // Rat-Tooth Grasping Forceps
    'PRD-D630438171', // Rat-Tooth Grasping Forceps
  ]
  const BASKETS = [
    'PRD-4E9069C30F', // Zero Tip Single-Use Airway Retrieval Basket
    'PRD-B1203FF71F', // Zero Tip Single-Use Airway Retrieval Basket
    'PRD-C2CB78AC4C', // Mini Grasping Basket
    'PRD-212BC58910', // Foreign Body Basket, 35 cm
    'PRD-A2FCA81CFA', // Foreign Body Basket, 50 cm
  ]

  it('classes every flexible foreign-body grasping forceps as forceps_instrument', () => {
    for (const productId of RETRIEVAL_FORCEPS) {
      expect({ productId, ...taxonomyOf(productId) }).toMatchObject({
        productId,
        deviceClassCode: 'forceps_instrument',
        deviceSubtypeCode: 'foreign_body_grasping_forceps',
      })
    }
  })

  it('keeps every cohort foreign-body forceps — rigid and flexible — inside forceps_instrument', () => {
    // The materially analogous rigid foreign-body forceps stay in forceps_instrument
    // with their physically accurate rigid/optical subtypes.
    const foreignBodyForceps = cohortProductsNamed(
      /Foreign Bod(y|ies).*Forceps|Forceps.*Foreign Bod(y|ies)/,
    )
    expect(foreignBodyForceps.length).toBeGreaterThanOrEqual(5)
    for (const product of foreignBodyForceps) {
      expect({
        name: product.product_name,
        deviceClass: taxonomyOf(product.product_id).deviceClassCode,
      }).toEqual({ name: product.product_name, deviceClass: 'forceps_instrument' })
    }
  })

  it('classes every physical retrieval basket as retrieval_basket / foreign_body_retrieval_basket', () => {
    for (const productId of BASKETS) {
      expect({ productId, ...taxonomyOf(productId) }).toMatchObject({
        productId,
        deviceClassCode: 'retrieval_basket',
        deviceSubtypeCode: 'foreign_body_retrieval_basket',
      })
    }
  })

  it('never types the Mini Grasping Basket as forceps', () => {
    const taxonomy = taxonomyOf('PRD-C2CB78AC4C')
    expect(taxonomy.deviceSubtypeCode).not.toBe('foreign_body_grasping_forceps')
    expect(taxonomy.deviceClassCode).not.toBe('forceps_instrument')
  })

  it('never leaves the two rigid Foreign Body Baskets as generic accessories', () => {
    for (const productId of ['PRD-212BC58910', 'PRD-A2FCA81CFA']) {
      expect(taxonomyOf(productId).deviceClassCode).not.toBe('accessory')
    }
  })

  it('accounts for every basket-name product in the cohort — placed or documented', () => {
    for (const product of cohortProductsNamed(/basket/i)) {
      const taxonomy = taxonomyOf(product.product_id)
      if (product.product_id === 'PRD-913352C891') {
        // Documented exception: the Wire Basket for the ERBECRYO 2 Cart is a storage
        // basket on capital equipment, not a patient-facing retrieval instrument.
        expect(taxonomy.deviceClassCode).toBe('cryotherapy')
        expect(taxonomy.deviceSubtypeCode).toBe('cryotherapy_accessory')
        continue
      }
      expect({ name: product.product_name, class: taxonomy.deviceClassCode }).toEqual({
        name: product.product_name,
        class: 'retrieval_basket',
      })
    }
  })

  it('retires the mixed retrieval_device class entirely', () => {
    expect(isDeviceClassCode('retrieval_device')).toBe(false)
    for (const product of store.products) {
      expect(taxonomyOf(product.product_id).deviceClassCode).not.toBe('retrieval_device')
    }
  })
})

describe('D2C-REV-002 — the aspiration/irrigation source pair splits by physical type', () => {
  const PAIR = {
    category: 'Rigid bronchoscopy',
    subcategory: 'Bronchoscopy aspiration/irrigation accessory',
  }
  const pairProducts = () =>
    store.products.filter(
      (product) =>
        product.primary_category === PAIR.category && product.subcategory === PAIR.subcategory,
    )

  it('classes the two aspiration biopsy needles as needles', () => {
    for (const productId of ['PRD-2F1A67DE53', 'PRD-DF989CBDCB']) {
      expect({ productId, ...taxonomyOf(productId) }).toMatchObject({
        productId,
        deviceClassCode: 'needle',
        deviceSubtypeCode: 'aspiration_biopsy_needle',
      })
    }
  })

  it('classes the Single-Use Plastic Collection Device as a specimen trap', () => {
    expect(taxonomyOf('PRD-129E6C270A')).toMatchObject({
      deviceClassCode: 'specimen_collection',
      deviceSubtypeCode: 'specimen_trap',
    })
  })

  it('keeps the true aspirators and suction tubes under suction_irrigation', () => {
    for (const productId of [
      'PRD-019030A1C7', // Aspirator for Collecting Secretions with Cut-Off Hole
      'PRD-0A2ABE77F9', // Aspirator for Collecting Secretions without Cut-Off Hole
      'PRD-06811F5515', // HUZLY Suction Tube 3 mm x 35 cm
      'PRD-8A19FB9627', // HUZLY Suction Tube 4 mm x 50 cm
      'PRD-5902F1C231', // HUZLY Aspirator and Bronchus Irrigator
    ]) {
      expect(taxonomyOf(productId)).toMatchObject({
        deviceClassCode: 'suction_irrigation',
        deviceSubtypeCode: 'rigid_suction_catheter',
      })
    }
  })

  it('covers the whole eight-product source pair with exactly these three physical types', () => {
    const products = pairProducts()
    expect(products.length).toBe(8)
    const classes = new Set(
      products.map((product) => taxonomyOf(product.product_id).deviceClassCode),
    )
    expect([...classes].sort()).toEqual(['needle', 'specimen_collection', 'suction_irrigation'])
  })
})

describe('D2C-REV-003 — pleurodesis agent and delivery instrument never share a class', () => {
  it('classes the three sterile talc vials as therapeutic_agent / sterile_talc', () => {
    for (const productId of ['PRD-8C6A6B2ACE', 'PRD-AF1D02BED5', 'PRD-EB27F8D657']) {
      expect(taxonomyOf(productId)).toMatchObject({
        deviceClassCode: 'therapeutic_agent',
        deviceSubtypeCode: 'sterile_talc',
      })
    }
  })

  it('classes the reusable Optical Powder Blower as a delivery instrument, never an agent', () => {
    const blower = taxonomyOf('PRD-D14312CC6A')
    expect(blower).toMatchObject({
      deviceClassCode: 'delivery_applicator',
      deviceSubtypeCode: 'powder_blower',
    })
    expect(blower.deviceClassCode).not.toBe('therapeutic_agent')
  })

  it('follows the documented dominant-identity rule for the disposable poudrage kit', () => {
    // The STERITALC PF3 kit is named and dosed by its 3 g talc content (family of the
    // F2/F4 vials; refilled by the PF3 Supplement Vial), so its dominant catalog
    // identity is the agent — recorded in the reviewed rules note and the D2C write-up.
    expect(taxonomyOf('PRD-D1DCE936D2')).toMatchObject({
      deviceClassCode: 'therapeutic_agent',
      deviceSubtypeCode: 'talc_poudrage_kit',
    })
  })

  it('keeps agent and delivery instrument in disjoint top-level classes', () => {
    const agentClass = taxonomyOf('PRD-8C6A6B2ACE').deviceClassCode
    const instrumentClass = taxonomyOf('PRD-D14312CC6A').deviceClassCode
    expect(agentClass).not.toBe(instrumentClass)
    expect(deviceClassOfSubtype('sterile_talc')).not.toBe(deviceClassOfSubtype('powder_blower'))
  })

  it('retires the mixed pleurodesis class and renders no "agent or applicator" label', () => {
    expect(isDeviceClassCode('pleurodesis_agent')).toBe(false)
    expect(isDeviceSubtypeCode('talc_vial')).toBe(false)
    expect(isDeviceSubtypeCode('talc_applicator')).toBe(false)
    for (const messages of [enMessages, esMessages, zhCnMessages]) {
      const taxonomy = (
        messages as unknown as {
          deviceIntelligence: { taxonomy: { classes: Record<string, string> } }
        }
      ).deviceIntelligence.taxonomy
      for (const label of Object.values(taxonomy.classes)) {
        expect(label).not.toMatch(/agent or applicator/i)
        expect(label).not.toMatch(/agente o aplicador/i)
      }
    }
  })
})

describe('D2C-REV-008 — packaged suction catheters share the catheter subtype', () => {
  it('classes the 5 Fr pack with the analogous 5/6/7 Fr suction catheters', () => {
    const analogous = ['PRD-28C10C5EE9', 'PRD-C0C6302286', 'PRD-9188CC0F47'] // 5/6/7 Fr with Adapter
    const packOfSix = taxonomyOf('PRD-D7A7620198')
    for (const productId of analogous) {
      expect(taxonomyOf(productId)).toEqual(
        expect.objectContaining({
          deviceClassCode: packOfSix.deviceClassCode,
          deviceSubtypeCode: packOfSix.deviceSubtypeCode,
        }),
      )
    }
    expect(packOfSix.deviceSubtypeCode).toBe('rigid_suction_catheter')
  })

  it('keeps the actual adapters in the accessory subtype', () => {
    for (const productId of ['PRD-9E7BDDB1CC', 'PRD-57C0ED84C2', 'PRD-526F08F11A']) {
      expect(taxonomyOf(productId)).toMatchObject({
        deviceClassCode: 'suction_irrigation',
        deviceSubtypeCode: 'suction_accessory',
      })
    }
  })
})

describe('D2C corrections preserve the governed relationship facets', () => {
  it('changed no role or procedure link — corrections moved taxonomy metadata only', () => {
    // The corrected products keep whatever role/procedure links the governed catalog
    // carries; taxonomy correction reads nothing from and writes nothing to them.
    // (Byte-identity of the canonical relationship artifacts is asserted by the
    // protected-boundary checks; here we pin that every corrected product still
    // resolves through the same store row.)
    for (const productId of [
      'PRD-C2CB78AC4C',
      'PRD-212BC58910',
      'PRD-A2FCA81CFA',
      'PRD-2F1A67DE53',
      'PRD-DF989CBDCB',
      'PRD-129E6C270A',
      'PRD-D14312CC6A',
      'PRD-D1DCE936D2',
      'PRD-D7A7620198',
    ]) {
      expect(store.productById.has(productId)).toBe(true)
    }
  })
})
