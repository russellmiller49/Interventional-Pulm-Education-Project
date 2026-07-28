import {
  equipmentSetCoveredRoles,
  equipmentSetHasMember,
  equipmentSetIdFromItemId,
  equipmentSetItemId,
  equipmentSetMemberKey,
  equipmentSetProductIdsForRole,
  equipmentSetSummary,
  equipmentSetToHospitalItem,
  equipmentSetToRoleOptions,
  equipmentSetWithoutMember,
  isEquipmentSetItemId,
  parseStoredEquipmentSets,
  serializeEquipmentSets,
  withEquipmentSets,
  type EquipmentSet,
} from '../domain/equipment-set'
import type { CatalogPick } from '../domain/catalog-pick'
import { buildDemoContext, defaultBuildInput } from '../data/demo-context.server'
import { resolveCard } from '../domain/resolve-card'
import { searchProductsForRole } from '../server/catalog'

function member(roleCode: string, overrides: Partial<CatalogPick> = {}): CatalogPick {
  return {
    productId: `PRD-${roleCode.slice(0, 8)}`,
    roleCode,
    manufacturerDisplay: 'Karl Storz',
    productName: 'Full Lumen Operating Tracheoscope',
    catalogNumber: '10318F',
    gtin: null,
    sizeDisplay: 'Size 12 mm; length 33 cm',
    verificationTier: 'verified',
    usStatusPending: false,
    minWorkingChannelMm: null,
    deliverySystemOdMm: null,
    sourceId: null,
    sourceLocation: null,
    ...overrides,
  }
}

function makeSet(overrides: Partial<EquipmentSet> = {}): EquipmentSet {
  return {
    id: 'set-1',
    name: 'Rigid set 1',
    description: null,
    members: [member('RIGID_BRONCHOSCOPE_BARREL')],
    additionalCoveredRoles: [],
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    ...overrides,
  }
}

const scope = { organizationId: 'org', siteId: 'site', locationId: 'loc' }

describe('equipment set identity and coverage', () => {
  it('namespaces set item ids away from products and seeded items', () => {
    expect(equipmentSetItemId('set-1')).toBe('set:set-1')
    expect(isEquipmentSetItemId('set:set-1')).toBe(true)
    expect(isEquipmentSetItemId('catalog:PRD-X')).toBe(false)
    expect(equipmentSetIdFromItemId('set:set-1')).toBe('set-1')
  })

  it('covers its members roles plus any explicitly declared extras', () => {
    const set = makeSet({
      members: [member('RIGID_BRONCHOSCOPE_BARREL')],
      additionalCoveredRoles: ['RIGID_BRONCHOSCOPE_HEAD'],
    })
    expect(equipmentSetCoveredRoles(set)).toEqual([
      'RIGID_BRONCHOSCOPE_BARREL',
      'RIGID_BRONCHOSCOPE_HEAD',
    ])
  })

  it('retains the same valid product separately for each role it serves', () => {
    const sharedProduct = 'PRD-MULTIROLE'
    const barrel = member('RIGID_BRONCHOSCOPE_BARREL', { productId: sharedProduct })
    const head = member('RIGID_BRONCHOSCOPE_HEAD', { productId: sharedProduct })
    const set = makeSet({ members: [barrel, head] })

    expect(equipmentSetMemberKey(barrel)).not.toBe(equipmentSetMemberKey(head))
    expect(equipmentSetHasMember(set, barrel)).toBe(true)
    expect(equipmentSetHasMember(set, head)).toBe(true)
    expect(equipmentSetProductIdsForRole(set, barrel.roleCode)).toEqual(new Set([sharedProduct]))
    expect(equipmentSetWithoutMember(set, barrel).members).toEqual([head])
    expect(equipmentSetSummary(set)).toBe('Karl Storz Full Lumen Operating Tracheoscope')
  })

  it('builds a procedure kit listing every covered role as an included component', () => {
    const set = makeSet({ additionalCoveredRoles: ['RIGID_BRONCHOSCOPE_HEAD'] })
    const item = equipmentSetToHospitalItem(set, 'RIGID_BRONCHOSCOPE_BARREL', scope)
    expect(item.itemType).toBe('procedure_kit')
    expect(item.roleCode).toBe('RIGID_BRONCHOSCOPE_BARREL')
    expect(item.kitComponents.map((component) => component.roleCode).sort()).toEqual([
      'RIGID_BRONCHOSCOPE_BARREL',
      'RIGID_BRONCHOSCOPE_HEAD',
    ])
    expect(item.kitComponents.every((component) => component.inclusion === 'included')).toBe(true)
  })

  it('is only as verified as its least-confirmed member', () => {
    const verified = equipmentSetToHospitalItem(makeSet(), 'RIGID_BRONCHOSCOPE_BARREL', scope)
    expect(verified.verificationState).toBe('prototype_visible')

    const mixed = makeSet({
      members: [
        member('RIGID_BRONCHOSCOPE_BARREL'),
        member('RIGID_BRONCHOSCOPE_HEAD', { verificationTier: 'candidate' }),
      ],
    })
    expect(
      equipmentSetToHospitalItem(mixed, 'RIGID_BRONCHOSCOPE_BARREL', scope).verificationState,
    ).toBe('unverified')
  })

  it('offers the set from every requirement row it covers', () => {
    const set = makeSet({ additionalCoveredRoles: ['RIGID_BRONCHOSCOPE_HEAD'] })
    const options = equipmentSetToRoleOptions(set)
    expect(options.map((option) => option.roleCode).sort()).toEqual([
      'RIGID_BRONCHOSCOPE_BARREL',
      'RIGID_BRONCHOSCOPE_HEAD',
    ])
    expect(options.every((option) => option.hospitalItemId === 'set:set-1')).toBe(true)
  })
})

describe('resolving rigid bronchoscopy with an equipment set', () => {
  function rigidSlots() {
    const context = buildDemoContext('rigid-bronch')
    const card = resolveCard(defaultBuildInput('rigid-bronch'), context)
    const head = card.items.find((item) => item.roleCode === 'RIGID_BRONCHOSCOPE_HEAD')
    const barrel = card.items.find((item) => item.roleCode === 'RIGID_BRONCHOSCOPE_BARREL')
    expect(head).toBeDefined()
    expect(barrel).toBeDefined()
    return { context, headId: head!.id, barrelId: barrel!.id }
  }

  it('lists head and barrel as separate requirements by default', () => {
    const { headId, barrelId } = rigidSlots()
    expect(headId).not.toBe(barrelId)
  })

  it('suppresses the separate head/base requirement for a combined scope set', () => {
    // Karl Storz builds the scope and head as one piece, so a Storz set covers both roles.
    const { context, headId, barrelId } = rigidSlots()
    const storzSet = makeSet({
      id: 'storz-rigid',
      name: 'Storz rigid set',
      members: [member('RIGID_BRONCHOSCOPE_BARREL')],
      additionalCoveredRoles: ['RIGID_BRONCHOSCOPE_HEAD'],
    })

    const input = defaultBuildInput('rigid-bronch')
    input.selectedHospitalItemIds = { [barrelId]: equipmentSetItemId(storzSet.id) }
    const card = resolveCard(
      input,
      withEquipmentSets(context, [storzSet], { [storzSet.id]: 'RIGID_BRONCHOSCOPE_BARREL' }),
    )

    // The barrel row is satisfied by the set...
    const barrelItem = card.items.find((item) => item.id === barrelId)
    expect(barrelItem?.selectedHospitalItemId).toBe('set:storz-rigid')
    // ...and the head row is no longer asked for separately.
    expect(card.items.some((item) => item.id === headId)).toBe(false)
    const suppressedHead = card.suppressedItems.find((item) => item.id === headId)
    expect(suppressedHead?.resolutionState).toBe('suppressed_by_kit')
    expect(suppressedHead?.whyIncluded.join(' ')).toContain('Storz rigid set')
  })

  it('keeps the head/base requirement for a set that does not include it', () => {
    // An Efer-style platform has a genuinely separate universal base, so a set covering only
    // the barrel must leave the head requirement standing.
    const { context, headId, barrelId } = rigidSlots()
    const barrelOnly = makeSet({ id: 'efer-barrels', name: 'Efer barrels' })

    const input = defaultBuildInput('rigid-bronch')
    input.selectedHospitalItemIds = { [barrelId]: equipmentSetItemId(barrelOnly.id) }
    const card = resolveCard(
      input,
      withEquipmentSets(context, [barrelOnly], {
        [barrelOnly.id]: 'RIGID_BRONCHOSCOPE_BARREL',
      }),
    )

    expect(card.items.some((item) => item.id === headId)).toBe(true)
    expect(card.suppressedItems.some((item) => item.id === headId)).toBe(false)
  })

  it('satisfies several requirement blocks at once from a single selection', () => {
    const { context, barrelId } = rigidSlots()
    const fullSet = makeSet({
      id: 'rigid-set-1',
      name: 'Rigid set 1',
      members: [member('RIGID_BRONCHOSCOPE_BARREL')],
      additionalCoveredRoles: ['RIGID_BRONCHOSCOPE_HEAD', 'RIGID_BRONCHOSCOPE_ACCESSORY'],
    })
    const input = defaultBuildInput('rigid-bronch')
    input.selectedHospitalItemIds = { [barrelId]: equipmentSetItemId(fullSet.id) }
    const card = resolveCard(
      input,
      withEquipmentSets(context, [fullSet], { [fullSet.id]: 'RIGID_BRONCHOSCOPE_BARREL' }),
    )

    const suppressedRoles = card.suppressedItems.map((item) => item.roleCode)
    expect(suppressedRoles).toEqual(
      expect.arrayContaining(['RIGID_BRONCHOSCOPE_HEAD', 'RIGID_BRONCHOSCOPE_ACCESSORY']),
    )
  })

  it('can be built from real catalogued rigid products', () => {
    const barrels = searchProductsForRole({ roleCode: 'RIGID_BRONCHOSCOPE_BARREL', limit: 1 })
    expect(barrels.length).toBeGreaterThan(0)
    const set = makeSet({
      members: [member('RIGID_BRONCHOSCOPE_BARREL', { productId: barrels[0].productId })],
    })
    expect(equipmentSetCoveredRoles(set)).toContain('RIGID_BRONCHOSCOPE_BARREL')
  })
})

describe('equipment set storage', () => {
  it('round-trips through storage', () => {
    const sets = [makeSet()]
    expect(parseStoredEquipmentSets(serializeEquipmentSets(sets))).toEqual(sets)
  })

  it('ignores absent, malformed, or wrong-version storage', () => {
    expect(parseStoredEquipmentSets(null)).toEqual([])
    expect(parseStoredEquipmentSets('not json')).toEqual([])
    expect(parseStoredEquipmentSets(JSON.stringify({ version: 99, sets: [makeSet()] }))).toEqual([])
  })

  it('backfills a missing additionalCoveredRoles array from older records', () => {
    const legacy = JSON.stringify({
      version: 1,
      sets: [{ ...makeSet(), additionalCoveredRoles: undefined }],
    })
    expect(parseStoredEquipmentSets(legacy)[0].additionalCoveredRoles).toEqual([])
  })
})
