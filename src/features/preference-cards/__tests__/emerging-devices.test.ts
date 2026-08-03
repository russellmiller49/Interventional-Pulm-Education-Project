import {
  getCatalogStore,
  getEmergingDevices,
  getUseDetail,
  resolveCatalogPick,
  searchProductFamiliesForRole,
  searchProductsForRole,
} from '../server/catalog'
import { isBreakthroughRegulatoryStatus } from '../server/catalog-store'
import { getReviewedProductFamiliesForRole } from '../data/product-families.server'

/**
 * The breakthrough-designated cohort, and the wall around it.
 *
 * FDA Breakthrough Device designation is an agreement to review on an expedited path. It is
 * not clearance, not approval, and not permission to market. A preference card is a pull
 * list — everything on one is meant to be in the room — so a designated device must be
 * findable, badged, and impossible to attach to a card. This test exists because "impossible"
 * has to hold at every entry point, not just the picker.
 */

const store = getCatalogStore()

const EMERGING_PRODUCT_NAMES = [
  'dNerva Lung Denervation System',
  'RejuvenAir System',
  'RheOx System',
  'Monarch-enabled NeuWave Microwave Ablation Technology',
  'Emprint Ablation Catheter Kit',
  'NIO Lung Cancer Reveal',
]

function productByName(name: string) {
  const product = store.products.find((candidate) => candidate.product_name === name)
  if (!product) throw new Error(`Fixture product "${name}" is missing from the catalog.`)
  return product
}

describe('breakthrough-designated cohort', () => {
  it('records all six devices with a designation date and a reviewed regulatory note', () => {
    for (const name of EMERGING_PRODUCT_NAMES) {
      const product = productByName(name)
      expect(isBreakthroughRegulatoryStatus(product.regulatoryStatus)).toBe(true)
      expect(product.breakthroughDesignatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(product.regulatoryNote).toEqual(expect.stringContaining('not clearance'))
      expect(product.slottingScope).toBe('not_applicable')
    }
  })

  it('surfaces every one of them on the emerging view, grouped by theme', () => {
    const groups = getEmergingDevices()
    const listed = groups.flatMap((group) => group.devices.map((device) => device.productName))
    expect(listed.sort()).toEqual([...EMERGING_PRODUCT_NAMES].sort())
    for (const group of groups) {
      expect(group.theme).not.toHaveLength(0)
      for (const device of group.devices) {
        expect(device.sources.length).toBeGreaterThan(0)
        // Every entry names its own Tier-4 evidence rather than implying a manufacturer record.
        expect(device.sources.some((source) => source.reliabilityTier?.startsWith('Tier 4'))).toBe(
          true,
        )
      }
    }
  })

  it('lists nothing on the emerging view that is not breakthrough-designated', () => {
    const listedIds = new Set(
      getEmergingDevices().flatMap((group) => group.devices.map((device) => device.productId)),
    )
    for (const product of store.products) {
      expect(listedIds.has(product.product_id)).toBe(
        isBreakthroughRegulatoryStatus(product.regulatoryStatus),
      )
    }
  })

  it('excludes them from every role query, even the roles they legitimately carry', () => {
    for (const name of EMERGING_PRODUCT_NAMES) {
      const product = productByName(name)
      const roleCodes = (store.rolesByProduct.get(product.product_id) ?? []).map(
        (link) => link.role_code,
      )
      for (const roleCode of roleCodes) {
        expect(
          searchProductsForRole({ roleCode, limit: 500 }).map((option) => option.productId),
        ).not.toContain(product.product_id)
        expect(
          searchProductFamiliesForRole({ roleCode, limit: 500 }).flatMap((family) =>
            family.variants.map((variant) => variant.productId),
          ),
        ).not.toContain(product.product_id)
        expect(
          getUseDetail(roleCode)?.manufacturerGroups.flatMap((group) =>
            group.items.map((item) => item.productId),
          ) ?? [],
        ).not.toContain(product.product_id)
        // A reviewed family can never contain it either: family membership is derived only from
        // products the reviewed governance still permits on a card.
        for (const version of getReviewedProductFamiliesForRole(roleCode)) {
          expect(version.memberProductIds).not.toContain(product.product_id)
        }
      }
    }
  })

  it('refuses to rebuild one as a saved card pick, which is the wall that actually matters', () => {
    for (const name of EMERGING_PRODUCT_NAMES) {
      const product = productByName(name)
      for (const link of store.rolesByProduct.get(product.product_id) ?? []) {
        const result = resolveCatalogPick(product.product_id, link.role_code)
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.code).toBe('product_not_slottable')
      }
    }
  })

  it('carries a role only where a real requirement names the modality', () => {
    // Microwave and pulsed electric field are named as conditional slots on the ablation card,
    // so those three devices carry roles. The other three answer no requirement the module has,
    // and inventing one for them would be worse than leaving them role-less.
    const rolesFor = (name: string) =>
      (store.rolesByProduct.get(productByName(name).product_id) ?? []).map((link) => link.role_code)
    expect(rolesFor('Emprint Ablation Catheter Kit')).toEqual(['MICROWAVE_ABLATION_CATHETER'])
    expect(rolesFor('Monarch-enabled NeuWave Microwave Ablation Technology')).toEqual([
      'MICROWAVE_ABLATION_CATHETER',
    ])
    expect(rolesFor('RheOx System')).toEqual(['PULSED_FIELD_ABLATION_SYSTEM'])
    expect(rolesFor('dNerva Lung Denervation System')).toEqual([])
    expect(rolesFor('RejuvenAir System')).toEqual([])
    expect(rolesFor('NIO Lung Cancer Reveal')).toEqual([])
  })
})

describe('regulatory status as an independent axis', () => {
  it('keeps Zephyr a normal selectable product that simply gains its PMA notation', () => {
    // The four valve sizes only; the delivery catheters share the brand family but are a
    // separate device and carry no reviewed regulatory record of their own.
    const zephyr = store.products.filter(
      (product) => product.product_name === 'Zephyr Endobronchial Valve',
    )
    expect(zephyr).toHaveLength(4)
    for (const valve of zephyr) {
      expect(valve.regulatoryStatus).toBe('us_approved_pma')
      expect(valve.regulatoryNote).toEqual(expect.stringContaining('P180002'))
      expect(valve.slottingScope).not.toBe('not_applicable')
      const roleCode = (store.rolesByProduct.get(valve.product_id) ?? [])[0]?.role_code
      if (roleCode) expect(resolveCatalogPick(valve.product_id, roleCode).ok).toBe(true)
    }
  })

  it('records the Aliya line as cleared, and records what it is cleared for', () => {
    for (const name of ['Aliya EX Generator', 'Aliya PEF System', 'INUMI Flex Needle']) {
      const product = productByName(name)
      expect(product.regulatoryStatus).toBe('us_cleared_510k')
      expect(product.regulatoryNote).toEqual(expect.stringContaining('soft tissue'))
      // Cleared, but not for the airway — the distinction the module has to preserve.
      expect(product.regulatoryNote).toEqual(
        expect.stringContaining('does not promote a bronchoscopic airway indication'),
      )
      expect(product.slottingScope).not.toBe('not_applicable')
    }
  })

  it('never infers a regulatory status from distribution evidence or verification grade', () => {
    // The overwhelming majority of the catalog has no reviewed regulatory decision, and the
    // absence of one must read as unknown rather than as an implied clearance.
    const decided = store.products.filter((product) => product.regulatoryStatus !== 'unknown')
    expect(decided).toHaveLength(15)
    for (const product of store.products) {
      if (product.regulatoryStatus !== 'unknown') continue
      expect(product.regulatoryNote).toBeNull()
      expect(product.breakthroughDesignatedOn).toBeNull()
    }
  })
})
