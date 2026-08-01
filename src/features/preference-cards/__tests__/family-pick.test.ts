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
import { getApprovedProductFamiliesForRole } from '../data/product-families.server'
import { getFamilyPickForVersion, searchProductFamiliesForRole } from '../server/catalog'

const STENT_ROLE = 'AIRWAY_STENT_SILICONE_STRAIGHT'

const FIXTURE_VERSION_ID = 'family-fixture-dumon-td-v1-0'
const FIXTURE_CATALOG_RELEASE = 'a'.repeat(64)
const FIXTURE_DEFINITION_HASH = 'b'.repeat(64)

function pick(overrides: Partial<FamilyPick> = {}): FamilyPick {
  return {
    productFamilyVersionId: FIXTURE_VERSION_ID,
    productFamilyCode: 'FIXTURE_DUMON_TD',
    catalogReleaseId: FIXTURE_CATALOG_RELEASE,
    definitionHash: FIXTURE_DEFINITION_HASH,
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
  it('is addressed by reviewed family version, not by a catalog-browsing key', () => {
    const item = familyPickToHospitalItem(pick(), scope)
    expect(item.id).toBe(`family-version:${FIXTURE_VERSION_ID}`)
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
    expect(option.hospitalItemId).toBe(familyPickId(FIXTURE_VERSION_ID))
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

  it('retains a distinct role option when the same family version serves two roles', () => {
    const context = buildDemoContext('rigid-bronch')
    const straight = pick()
    const yStent = pick({
      roleCode: 'AIRWAY_STENT_SILICONE_Y',
      specRanges: [
        { key: 'diameter_mm', min: 15, max: 18 },
        { key: 'length_mm', min: 40, max: 70 },
      ],
    })
    const merged = withFamilyPicks(context, [straight, yStent])
    const familyItems = merged.hospitalItems.filter((item) =>
      [straight, yStent].some(
        (candidate) =>
          item.id === familyPickId(candidate.productFamilyVersionId, candidate.roleCode),
      ),
    )
    const familyOptions = merged.hospitalRoleOptions.filter((option) =>
      option.hospitalItemId.endsWith(FIXTURE_VERSION_ID),
    )

    expect(familyItems).toHaveLength(2)
    expect(familyOptions.map((option) => option.roleCode).sort()).toEqual([
      'AIRWAY_STENT_SILICONE_STRAIGHT',
      'AIRWAY_STENT_SILICONE_Y',
    ])
    expect(new Set(familyOptions.map((option) => option.id)).size).toBe(2)
    expect(familyItems.find((item) => item.roleCode === STENT_ROLE)?.notes).toContain(
      'length 20–110 mm',
    )
    expect(
      familyItems.find((item) => item.roleCode === 'AIRWAY_STENT_SILICONE_Y')?.notes,
    ).toContain('length 40–70 mm')
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
    input.selectedHospitalItemIds = { [slotId]: familyPickId(picked.productFamilyVersionId) }

    const after = resolveCard(input, withFamilyPicks(context, [picked]))
    const item = after.items.find((entry) => entry.id === slotId)

    expect(item?.selectedHospitalItemId).toBe(familyPickId(picked.productFamilyVersionId))
    expect(item?.selectedItemSnapshot?.localDescription).toContain('size at time of procedure')
    expect(item?.resolutionState).not.toBe('unresolved')
  })

  it('changes the snapshot hash when a different line is picked', () => {
    const { context, slotId } = stentSlot()
    const build = (productFamilyVersionId: string) => {
      const picked = pick({ productFamilyVersionId })
      const input = defaultBuildInput('rigid-bronch')
      input.selectedHospitalItemIds = { [slotId]: familyPickId(productFamilyVersionId) }
      return resolveCard(input, withFamilyPicks(context, [picked])).snapshotHash
    }
    expect(build('family-fixture-dumon-td-v1-0')).not.toBe(build('family-fixture-dumon-tf-v1-0'))
  })

  it('scopes the item id by role when one family version serves two requirements', () => {
    const context = buildDemoContext('rigid-bronch')
    const straight = pick()
    const yStent = pick({ roleCode: 'AIRWAY_STENT_SILICONE_Y' })
    const card = resolveCard(defaultBuildInput('rigid-bronch'), context)
    const straightSlot = card.items.find((item) => item.roleCode === straight.roleCode)
    const ySlot = card.items.find((item) => item.roleCode === yStent.roleCode)
    expect(straightSlot).toBeDefined()
    expect(ySlot).toBeDefined()
    const input = defaultBuildInput('rigid-bronch')
    input.selectedHospitalItemIds = {
      [straightSlot!.id]: familyPickId(straight.productFamilyVersionId, straight.roleCode),
      [ySlot!.id]: familyPickId(yStent.productFamilyVersionId, yStent.roleCode),
    }

    const resolved = resolveCard(input, withFamilyPicks(context, [straight, yStent]))

    expect(
      resolved.items.find((item) => item.id === straightSlot!.id)?.selectedHospitalItemId,
    ).toBe(familyPickId(straight.productFamilyVersionId, straight.roleCode))
    expect(resolved.items.find((item) => item.id === ySlot!.id)?.selectedHospitalItemId).toBe(
      familyPickId(yStent.productFamilyVersionId, yStent.roleCode),
    )
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

  it('rebuilds a real product line from an approved reviewed family version', () => {
    const approved = getApprovedProductFamiliesForRole(STENT_ROLE)
    expect(approved.length).toBeGreaterThan(0)
    const version = approved[0]
    const rebuilt = getFamilyPickForVersion(version, STENT_ROLE)

    expect(rebuilt).not.toBeNull()
    expect(rebuilt!.productFamilyVersionId).toBe(version.productFamilyVersionId)
    expect(rebuilt!.definitionHash).toBe(version.definitionHash)
    expect(rebuilt!.catalogReleaseId).toBe(version.catalogReleaseId)
    expect(rebuilt!.familyName).toBe(version.displayName)
    expect(rebuilt!.variantCount).toBe(version.memberProductIds.length)
  })

  it('reports which discovery groupings correspond to a reviewed family and which do not', () => {
    const families = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    const approvedIds = new Set(
      getApprovedProductFamiliesForRole(STENT_ROLE).map(
        (version) => version.productFamilyVersionId,
      ),
    )
    for (const family of families) {
      if (family.reviewedFamilyVersionId === null) {
        expect(family.reviewedFamilyDefinitionHash).toBeNull()
        continue
      }
      expect(approvedIds.has(family.reviewedFamilyVersionId)).toBe(true)
      expect(family.reviewedFamilyDefinitionHash).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('narrows the lines by search text', () => {
    const all = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    const narrowed = searchProductFamiliesForRole({ roleCode: STENT_ROLE, q: 'DUMON TD' })
    expect(narrowed.length).toBeGreaterThan(0)
    expect(narrowed.length).toBeLessThanOrEqual(all.length)
    expect(narrowed.some((family) => /dumon td/i.test(family.familyName))).toBe(true)
  })

  it('still names the reviewed family when a text query matches only some of its sizes', () => {
    // The grouping is matched against the *complete* role-scoped family, so a query that narrows
    // eighteen sizes to three must not make the line look like a smaller, different family.
    const narrowed = searchProductFamiliesForRole({ roleCode: STENT_ROLE, q: 'DUMON TD' })
    const line = narrowed.find((family) => /dumon td/i.test(family.familyName))
    expect(line).toBeDefined()
    expect(line!.reviewedFamilyVersionId).not.toBeNull()
  })
})
