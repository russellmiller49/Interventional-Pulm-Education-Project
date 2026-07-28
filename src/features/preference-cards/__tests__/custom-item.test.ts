import {
  customIdFromItemId,
  customItemId,
  customItemToHospitalItem,
  customItemToRoleOption,
  isCustomItemId,
  withCustomItems,
  type CustomItem,
} from '../domain/custom-item'
import { isCatalogPickItemId } from '../domain/catalog-pick'
import { isFamilyPickId } from '../domain/size-at-procedure'
import { isEquipmentSetItemId } from '../domain/equipment-set'
import { buildDemoContext, defaultBuildInput } from '../data/demo-context.server'
import { resolveCard } from '../domain/resolve-card'
import { customItemSchema } from '../schemas/saved-card'

/** One of the six roles the templates ask for that has nothing catalogued. */
const EMPTY_ROLE = 'GENERIC_SUCTION'

function custom(overrides: Partial<CustomItem> = {}): CustomItem {
  return {
    id: 'c1',
    roleCode: EMPTY_ROLE,
    description: 'Wall suction with Yankauer',
    itemNumber: null,
    notes: null,
    ...overrides,
  }
}

const scope = { organizationId: 'org', siteId: 'site', locationId: 'loc' }

describe('custom item identity', () => {
  it('namespaces ids apart from catalog, family, and set ids', () => {
    expect(customItemId('c1')).toBe('custom:c1')
    expect(isCustomItemId('custom:c1')).toBe(true)
    expect(isCatalogPickItemId('custom:c1')).toBe(false)
    expect(isFamilyPickId('custom:c1')).toBe(false)
    expect(isEquipmentSetItemId('custom:c1')).toBe(false)
    expect(customIdFromItemId('custom:c1')).toBe('c1')
    expect(customIdFromItemId('catalog:PRD-X')).toBeNull()
  })

  it('claims no manufacturer or catalog number', () => {
    // Free text has no source; presenting it as a catalogued product would be a fabrication.
    const item = customItemToHospitalItem(custom(), scope)
    expect(item.catalogProduct).toBeNull()
    expect(item.itemType).toBe('hospital_local_disposable')
    expect(item.localDescription).toBe('Wall suction with Yankauer')
  })

  it('is always unverified, whatever the author typed', () => {
    expect(customItemToHospitalItem(custom(), scope).verificationState).toBe('unverified')
    expect(
      customItemToHospitalItem(custom({ description: 'Verified suction' }), scope)
        .verificationState,
    ).toBe('unverified')
  })

  it('carries a local item number when one is given', () => {
    const item = customItemToHospitalItem(custom({ itemNumber: 'LOC-4412' }), scope)
    expect(item.localItemNumber).toBe('LOC-4412')
  })

  it('builds a role option pointing at the custom line', () => {
    const option = customItemToRoleOption(custom())
    expect(option.hospitalItemId).toBe('custom:c1')
    expect(option.roleCode).toBe(EMPTY_ROLE)
    expect(option.active).toBe(true)
  })
})

describe('withCustomItems', () => {
  it('returns the original context when nothing was added', () => {
    const context = buildDemoContext('chest-tube')
    expect(withCustomItems(context, [])).toBe(context)
  })

  it('adds items without mutating the source context', () => {
    const context = buildDemoContext('chest-tube')
    const before = context.hospitalItems.length
    const merged = withCustomItems(context, [custom()])
    expect(merged.hospitalItems).toHaveLength(before + 1)
    expect(context.hospitalItems).toHaveLength(before)
  })

  it('does not duplicate the same line twice', () => {
    const context = buildDemoContext('chest-tube')
    const merged = withCustomItems(context, [custom(), custom()])
    const ids = merged.hospitalItems.map((item) => item.id).filter(isCustomItemId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('resolving a card with a custom item', () => {
  // Nothing seeded and nothing catalogued: the honest stand-in for a row the wizard shows as
  // "Unresolved" with an empty dropdown.
  const UNRESOLVED_ROLE = 'PLEURAL_DRAINAGE_ACCESSORY'

  it('resolves a requirement with no option of any kind', () => {
    const context = buildDemoContext('chest-tube')
    const before = resolveCard(defaultBuildInput('chest-tube'), context)
    const slot = before.items.find((item) => item.roleCode === UNRESOLVED_ROLE)
    expect(slot).toBeDefined()
    expect(slot!.selectedHospitalItemId).toBeNull()

    const item = custom({ roleCode: UNRESOLVED_ROLE, description: 'Sterile drainage tubing' })
    const input = defaultBuildInput('chest-tube')
    input.selectedHospitalItemIds = { [slot!.id]: customItemId(item.id) }
    const after = resolveCard(input, withCustomItems(context, [item]))
    const resolved = after.items.find((entry) => entry.id === slot!.id)

    expect(resolved?.selectedHospitalItemId).toBe('custom:c1')
    expect(resolved?.selectedItemSnapshot?.localDescription).toBe('Sterile drainage tubing')
    expect(resolved?.resolutionState).not.toBe('unresolved')
  })

  it('can replace a seeded option on a role with nothing catalogued', () => {
    // GENERIC_SUCTION has a seeded demo item but zero catalogued products, so writing your
    // own line is the only way to say what is actually in your room.
    const context = buildDemoContext('chest-tube')
    const slot = resolveCard(defaultBuildInput('chest-tube'), context).items.find(
      (item) => item.roleCode === EMPTY_ROLE,
    )
    expect(slot).toBeDefined()

    const input = defaultBuildInput('chest-tube')
    input.selectedHospitalItemIds = { [slot!.id]: customItemId('c1') }
    const after = resolveCard(input, withCustomItems(context, [custom()]))
    expect(
      after.items.find((entry) => entry.id === slot!.id)?.selectedItemSnapshot?.localDescription,
    ).toBe('Wall suction with Yankauer')
  })

  it('changes the snapshot hash when the text changes', () => {
    const context = buildDemoContext('chest-tube')
    const slotId = resolveCard(defaultBuildInput('chest-tube'), context).items.find(
      (item) => item.roleCode === EMPTY_ROLE,
    )!.id
    const build = (description: string) => {
      const input = defaultBuildInput('chest-tube')
      input.selectedHospitalItemIds = { [slotId]: customItemId('c1') }
      return resolveCard(input, withCustomItems(context, [custom({ description })])).snapshotHash
    }
    expect(build('Wall suction')).not.toBe(build('Portable suction'))
  })
})

describe('custom item schema', () => {
  it('trims and bounds what a client can send', () => {
    const parsed = customItemSchema.parse({
      id: 'c1',
      roleCode: EMPTY_ROLE,
      description: '  Wall suction  ',
    })
    expect(parsed.description).toBe('Wall suction')
    expect(parsed.itemNumber).toBeNull()
    expect(parsed.notes).toBeNull()
  })

  it('rejects an empty description and an over-long one', () => {
    expect(
      customItemSchema.safeParse({ id: 'c1', roleCode: EMPTY_ROLE, description: '   ' }).success,
    ).toBe(false)
    expect(
      customItemSchema.safeParse({
        id: 'c1',
        roleCode: EMPTY_ROLE,
        description: 'x'.repeat(201),
      }).success,
    ).toBe(false)
  })
})
