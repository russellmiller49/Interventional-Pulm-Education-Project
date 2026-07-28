import {
  familyPickToHospitalItem,
  familyPickToRoleOption,
  formatFamilySizeRange,
  withFamilyPicks,
  type FamilyPick,
} from '../domain/family-pick'
import { familyPickId, isFamilyPickId } from '../domain/size-at-procedure'
import { isCatalogPickItemId } from '../domain/catalog-pick'
import { buildDemoContext, defaultBuildInput } from '../data/demo-context.server'
import { resolveCard } from '../domain/resolve-card'
import { getFamilyPick, searchProductFamiliesForRole } from '../server/catalog'

const STENT_ROLE = 'AIRWAY_STENT_SILICONE_STRAIGHT'

function pick(overrides: Partial<FamilyPick> = {}): FamilyPick {
  return {
    familyKey: 'MFR-TEST|dumon td|implant',
    roleCode: STENT_ROLE,
    familyName: 'DUMON TD',
    manufacturerDisplay: 'Novatech',
    variantCount: 43,
    specRanges: [
      { key: 'diameter_mm', min: 11, max: 18 },
      { key: 'length_mm', min: 20, max: 110 },
    ],
    verificationTier: 'verified',
    usStatusPending: false,
    sourceId: 'SRC001',
    sourceLocation: 'p. 4',
    ...overrides,
  }
}

const scope = { organizationId: 'org', siteId: 'site', locationId: 'loc' }

describe('family pick identity', () => {
  it('namespaces item ids apart from product and set ids', () => {
    const item = familyPickToHospitalItem(pick(), scope)
    expect(item.id).toBe('family:MFR-TEST|dumon td|implant')
    expect(isFamilyPickId(item.id)).toBe(true)
    expect(isCatalogPickItemId(item.id)).toBe(false)
  })

  it('names the line and states the size is chosen intraoperatively', () => {
    const item = familyPickToHospitalItem(pick(), scope)
    expect(item.localDescription).toBe('Novatech DUMON TD — size at time of procedure')
    expect(item.notes).toBe(
      'Size chosen at time of procedure. Line stocked across diameter 11–18 mm · length 20–110 mm.',
    )
  })

  it('commits no catalog number, because there is no single product to pull', () => {
    const item = familyPickToHospitalItem(pick(), scope)
    expect(item.catalogProduct?.catalogNumber).toBeNull()
    expect(item.catalogProduct?.gtin).toBeNull()
    expect(item.catalogProduct?.manufacturer).toBe('Novatech')
    expect(item.catalogProduct?.productName).toBe('DUMON TD')
  })

  it('carries no dimensions, so compatibility reports unknown rather than passing', () => {
    // A line spanning 11–18 mm has no single diameter to check against anything.
    const item = familyPickToHospitalItem(pick(), scope)
    expect(item.attributes).toEqual({})
    expect(item.catalogProduct?.deliverySystemOdMm).toBeNull()
    expect(item.catalogProduct?.minWorkingChannelMm).toBeNull()
  })

  it('treats a line with any unverified size as unverified', () => {
    expect(familyPickToHospitalItem(pick(), scope).verificationState).toBe('prototype_visible')
    expect(
      familyPickToHospitalItem(pick({ verificationTier: 'candidate' }), scope).verificationState,
    ).toBe('unverified')
    expect(familyPickToHospitalItem(pick({ usStatusPending: true }), scope).verificationState).toBe(
      'unverified',
    )
  })

  it('builds a role option pointing at the line', () => {
    const option = familyPickToRoleOption(pick())
    expect(option.hospitalItemId).toBe(familyPickId('MFR-TEST|dumon td|implant'))
    expect(option.roleCode).toBe(STENT_ROLE)
    expect(option.active).toBe(true)
  })

  it('formats only the spec keys it knows', () => {
    expect(formatFamilySizeRange([])).toBe('')
    expect(formatFamilySizeRange([{ key: 'french_size', min: 16, max: 22 }])).toBe('16–22 Fr')
    // A single-valued span reads as one number rather than "18–18".
    expect(formatFamilySizeRange([{ key: 'diameter_mm', min: 18, max: 18 }])).toBe('diameter 18 mm')
    expect(formatFamilySizeRange([{ key: 'not_a_spec', min: 1, max: 2 }])).toBe('')
  })
})

describe('withFamilyPicks', () => {
  it('returns the original context when nothing was picked', () => {
    const context = buildDemoContext('rigid-bronch')
    expect(withFamilyPicks(context, [])).toBe(context)
  })

  it('adds items and options without mutating the source context', () => {
    const context = buildDemoContext('rigid-bronch')
    const itemCount = context.hospitalItems.length
    const merged = withFamilyPicks(context, [pick()])
    expect(merged.hospitalItems).toHaveLength(itemCount + 1)
    expect(context.hospitalItems).toHaveLength(itemCount)
  })

  it('does not duplicate a line picked twice', () => {
    const context = buildDemoContext('rigid-bronch')
    const merged = withFamilyPicks(context, [pick(), pick()])
    const ids = merged.hospitalItems.map((item) => item.id).filter(isFamilyPickId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('resolving a card with a family pick', () => {
  function stentSlot() {
    const context = buildDemoContext('rigid-bronch')
    const card = resolveCard(defaultBuildInput('rigid-bronch'), context)
    const item = card.items.find((entry) => entry.roleCode === STENT_ROLE)
    expect(item).toBeDefined()
    return { context, slotId: item!.id }
  }

  it('resolves a stent requirement without committing to a size', () => {
    const { context, slotId } = stentSlot()
    const picked = pick()
    const input = defaultBuildInput('rigid-bronch')
    input.selectedHospitalItemIds = { [slotId]: familyPickId(picked.familyKey) }

    const after = resolveCard(input, withFamilyPicks(context, [picked]))
    const item = after.items.find((entry) => entry.id === slotId)

    expect(item?.selectedHospitalItemId).toBe(familyPickId(picked.familyKey))
    expect(item?.selectedItemSnapshot?.localDescription).toContain('size at time of procedure')
    expect(item?.resolutionState).not.toBe('unresolved')
  })

  it('changes the snapshot hash when a different line is picked', () => {
    const { context, slotId } = stentSlot()
    const build = (familyKey: string) => {
      const picked = pick({ familyKey })
      const input = defaultBuildInput('rigid-bronch')
      input.selectedHospitalItemIds = { [slotId]: familyPickId(familyKey) }
      return resolveCard(input, withFamilyPicks(context, [picked])).snapshotHash
    }
    expect(build('MFR-TEST|dumon td|implant')).not.toBe(build('MFR-TEST|dumon tf|implant'))
  })
})

describe('server-side family search and rebuild', () => {
  it('collapses the silicone straight stent role into its product lines', () => {
    const families = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    // 105 individual products are really a handful of Dumon lines.
    expect(families.length).toBeGreaterThan(0)
    expect(families.length).toBeLessThan(10)
    const total = families.reduce((sum, family) => sum + family.variantCount, 0)
    expect(total).toBeGreaterThan(families.length)
    for (const family of families) {
      expect(family.variants).toHaveLength(family.variantCount)
    }
  })

  it('marks a line verified only when every one of its sizes is', () => {
    const families = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    for (const family of families) {
      expect(family.verificationTier === 'verified').toBe(
        family.verifiedCount === family.variantCount,
      )
    }
  })

  it('rebuilds a real product line from its key alone', () => {
    const families = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    const first = families[0]
    const rebuilt = getFamilyPick(first.familyKey, STENT_ROLE)
    expect(rebuilt).not.toBeNull()
    expect(rebuilt!.familyName).toBe(first.familyName)
    expect(rebuilt!.manufacturerDisplay).toBe(first.manufacturerDisplay)
    expect(rebuilt!.variantCount).toBe(first.variantCount)
    expect(rebuilt!.specRanges).toEqual(first.specRanges)
    expect(rebuilt!.verificationTier).toBe(first.verificationTier)
  })

  it('refuses a family that does not serve the requested role', () => {
    const families = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    expect(getFamilyPick(families[0].familyKey, 'CHEST_TUBE_SURGICAL')).toBeNull()
    expect(getFamilyPick('not-a-family', STENT_ROLE)).toBeNull()
  })

  it('narrows the lines by search text', () => {
    const all = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    const narrowed = searchProductFamiliesForRole({ roleCode: STENT_ROLE, q: 'DUMON TD' })
    expect(narrowed.length).toBeGreaterThan(0)
    expect(narrowed.length).toBeLessThanOrEqual(all.length)
    expect(narrowed.some((family) => /dumon td/i.test(family.familyName))).toBe(true)
  })
})
