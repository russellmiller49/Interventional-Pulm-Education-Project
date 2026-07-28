import {
  catalogPickItemId,
  catalogPickToHospitalItem,
  catalogPickToRoleOption,
  isCatalogPickItemId,
  productIdFromCatalogPickItemId,
  withCatalogPicks,
  type CatalogPick,
} from '../domain/catalog-pick'
import { buildDemoContext, defaultBuildInput } from '../data/demo-context.server'
import { resolveCard } from '../domain/resolve-card'
import {
  getCatalogPick,
  getCatalogStore,
  resolveCatalogPick,
  searchProductsForRole,
} from '../server/catalog'

function pick(overrides: Partial<CatalogPick> = {}): CatalogPick {
  return {
    productId: 'PRD-TESTAAAA',
    roleCode: 'GENERIC_DRAINAGE_UNIT',
    manufacturerDisplay: 'Acme Airway',
    productName: 'Acme Chest Drain',
    catalogNumber: 'ACD-1',
    gtin: null,
    sizeDisplay: 'Dry suction',
    verificationTier: 'verified',
    usStatusPending: false,
    minWorkingChannelMm: null,
    deliverySystemOdMm: null,
    sourceId: null,
    sourceLocation: null,
    ...overrides,
  }
}

const scope = { organizationId: 'org', siteId: 'site', locationId: 'loc' }

describe('catalog pick identity', () => {
  it('namespaces item ids so they cannot collide with seeded hospital items', () => {
    expect(catalogPickItemId('PRD-X')).toBe('catalog:PRD-X')
    expect(isCatalogPickItemId('catalog:PRD-X')).toBe(true)
    expect(isCatalogPickItemId('demo-suction')).toBe(false)
    expect(productIdFromCatalogPickItemId('catalog:PRD-X')).toBe('PRD-X')
    expect(productIdFromCatalogPickItemId('demo-suction')).toBeNull()
  })

  it('treats a verified, currently-available product as prototype visible', () => {
    const item = catalogPickToHospitalItem(pick(), scope)
    expect(item.verificationState).toBe('prototype_visible')
  })

  it('treats an unverified product as unverified rather than hidden', () => {
    const item = catalogPickToHospitalItem(pick({ verificationTier: 'candidate' }), scope)
    // Hidden would block the card; unverified resolves and carries a confirm-before-use flag.
    expect(item.verificationState).toBe('unverified')
  })

  it('treats a verified product with unconfirmed US status as unverified', () => {
    const item = catalogPickToHospitalItem(pick({ usStatusPending: true }), scope)
    expect(item.verificationState).toBe('unverified')
  })

  it('carries dimensional attributes so compatibility rules can use them', () => {
    const item = catalogPickToHospitalItem(
      pick({ minWorkingChannelMm: 2.8, deliverySystemOdMm: 2.6 }),
      scope,
    )
    expect(item.attributes).toMatchObject({
      min_working_channel_mm: 2.8,
      delivery_system_od_mm: 2.6,
    })
  })

  it('builds a role option pointing at the picked item', () => {
    const option = catalogPickToRoleOption(pick())
    expect(option.hospitalItemId).toBe('catalog:PRD-TESTAAAA')
    expect(option.roleCode).toBe('GENERIC_DRAINAGE_UNIT')
    expect(option.active).toBe(true)
  })
})

describe('withCatalogPicks', () => {
  it('returns the original context when nothing was picked', () => {
    const context = buildDemoContext('chest-tube')
    expect(withCatalogPicks(context, [])).toBe(context)
  })

  it('adds items and options without mutating the source context', () => {
    const context = buildDemoContext('chest-tube')
    const itemCount = context.hospitalItems.length
    const merged = withCatalogPicks(context, [pick()])
    expect(merged.hospitalItems).toHaveLength(itemCount + 1)
    expect(context.hospitalItems).toHaveLength(itemCount)
  })

  it('does not duplicate a product picked twice', () => {
    const context = buildDemoContext('chest-tube')
    const merged = withCatalogPicks(context, [pick(), pick()])
    const ids = merged.hospitalItems
      .map((item) => item.id)
      .filter((id) => id.startsWith('catalog:'))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps one physical item but adds an option for every valid role pair', () => {
    const context = buildDemoContext('chest-tube')
    const productId = 'PRD-TESTMULTI'
    const merged = withCatalogPicks(context, [
      pick({ productId, roleCode: 'ROLE_A' }),
      pick({ productId, roleCode: 'ROLE_B' }),
    ])

    expect(
      merged.hospitalItems.filter((item) => item.id === catalogPickItemId(productId)),
    ).toHaveLength(1)
    expect(
      merged.hospitalRoleOptions
        .filter((option) => option.hospitalItemId === catalogPickItemId(productId))
        .map((option) => option.roleCode)
        .sort(),
    ).toEqual(['ROLE_A', 'ROLE_B'])
  })
})

describe('resolving a card with a catalog pick', () => {
  // PLEURAL_DRAINAGE_ACCESSORY has no seeded hospital-local option, so it is the honest
  // stand-in for the requirement rows the wizard shows as "Unresolved".
  const UNRESOLVED_ROLE = 'PLEURAL_DRAINAGE_ACCESSORY'

  function unresolvedSlot() {
    const context = buildDemoContext('chest-tube')
    const card = resolveCard(defaultBuildInput('chest-tube'), context)
    const item = card.items.find((entry) => entry.roleCode === UNRESOLVED_ROLE)
    expect(item?.selectedHospitalItemId).toBeNull()
    return { context, slotId: item!.id }
  }

  it('resolves a requirement that has no hospital-local option', () => {
    const { context, slotId } = unresolvedSlot()
    const picked = pick({ roleCode: UNRESOLVED_ROLE })
    const input = defaultBuildInput('chest-tube')
    input.selectedHospitalItemIds = { [slotId]: catalogPickItemId(picked.productId) }

    const after = resolveCard(input, withCatalogPicks(context, [picked]))
    const afterItem = after.items.find((item) => item.id === slotId)

    expect(afterItem?.selectedHospitalItemId).toBe('catalog:PRD-TESTAAAA')
    expect(afterItem?.selectedItemSnapshot?.catalogProduct?.productName).toBe('Acme Chest Drain')
    expect(afterItem?.resolutionState).not.toBe('unresolved')
  })

  it('resolves the row for an unverified product, badging it rather than emptying it', () => {
    // Unverified products are usable and flagged. The row must not read "Unresolved" while
    // holding a selection — 158 catalog products are candidate-tier, and every custom line
    // is unverified too.
    const { context, slotId } = unresolvedSlot()
    const picked = pick({ roleCode: UNRESOLVED_ROLE, verificationTier: 'candidate' })
    const input = defaultBuildInput('chest-tube')
    input.selectedHospitalItemIds = { [slotId]: catalogPickItemId(picked.productId) }

    const item = resolveCard(input, withCatalogPicks(context, [picked])).items.find(
      (entry) => entry.id === slotId,
    )

    expect(item?.selectedHospitalItemId).toBe('catalog:PRD-TESTAAAA')
    expect(item?.verificationState).toBe('unverified')
    expect(item?.resolutionState).toBe('resolved')
  })

  it('changes the snapshot hash when a different product is picked', () => {
    const { context, slotId } = unresolvedSlot()
    const build = (productId: string) => {
      const picked = pick({ productId, roleCode: UNRESOLVED_ROLE })
      const input = defaultBuildInput('chest-tube')
      input.selectedHospitalItemIds = { [slotId]: catalogPickItemId(productId) }
      return resolveCard(input, withCatalogPicks(context, [picked])).snapshotHash
    }
    expect(build('PRD-TESTAAAA')).not.toBe(build('PRD-TESTBBBB'))
  })

  it('matches picks against the post-modifier role, not the base recipe role', () => {
    // DIGITAL_DRAINAGE rewrites GENERIC_DRAINAGE_UNIT to DIGITAL_DRAINAGE_SYSTEM, so a pick
    // made for the base role must not satisfy the rewritten slot. The wizard avoids this by
    // passing the resolved item's roleCode to the picker.
    const context = buildDemoContext('chest-tube')
    const card = resolveCard(defaultBuildInput('chest-tube'), context)
    const rewritten = card.items.find((item) => item.roleCode === 'DIGITAL_DRAINAGE_SYSTEM')
    expect(rewritten).toBeDefined()

    const staleRolePick = pick({ roleCode: 'GENERIC_DRAINAGE_UNIT' })
    const input = defaultBuildInput('chest-tube')
    input.selectedHospitalItemIds = { [rewritten!.id]: catalogPickItemId(staleRolePick.productId) }
    const after = resolveCard(input, withCatalogPicks(context, [staleRolePick]))
    expect(after.items.find((item) => item.id === rewritten!.id)?.selectedHospitalItemId).toBeNull()

    const effectiveRolePick = pick({ roleCode: 'DIGITAL_DRAINAGE_SYSTEM' })
    const okInput = defaultBuildInput('chest-tube')
    okInput.selectedHospitalItemIds = {
      [rewritten!.id]: catalogPickItemId(effectiveRolePick.productId),
    }
    const resolved = resolveCard(okInput, withCatalogPicks(context, [effectiveRolePick]))
    expect(resolved.items.find((item) => item.id === rewritten!.id)?.selectedHospitalItemId).toBe(
      'catalog:PRD-TESTAAAA',
    )
  })
})

describe('server-side pick rebuild', () => {
  it('accepts a real product only for a role it carries', () => {
    const options = searchProductsForRole({ roleCode: 'GENERIC_DRAINAGE_UNIT', limit: 1 })
    expect(options.length).toBeGreaterThan(0)
    const result = resolveCatalogPick(options[0].productId, 'GENERIC_DRAINAGE_UNIT')
    expect(result.ok).toBe(true)
    const rebuilt = getCatalogPick(options[0].productId, 'GENERIC_DRAINAGE_UNIT')
    expect(rebuilt).not.toBeNull()
    expect(rebuilt!.productName).toBe(options[0].productName)
    expect(rebuilt!.manufacturerDisplay).toBe(options[0].manufacturerDisplay)
    expect(rebuilt!.roleCode).toBe('GENERIC_DRAINAGE_UNIT')
  })

  it('distinguishes an unknown product id', () => {
    expect(resolveCatalogPick('PRD-DOESNOTEXIST', 'GENERIC_DRAINAGE_UNIT')).toMatchObject({
      ok: false,
      code: 'unknown_product',
    })
    expect(getCatalogPick('PRD-DOESNOTEXIST', 'GENERIC_DRAINAGE_UNIT')).toBeNull()
  })

  it('distinguishes an unknown role code', () => {
    const options = searchProductsForRole({ roleCode: 'GENERIC_DRAINAGE_UNIT', limit: 1 })
    expect(resolveCatalogPick(options[0].productId, 'NOT_A_REAL_ROLE')).toMatchObject({
      ok: false,
      code: 'unknown_role',
    })
    expect(getCatalogPick(options[0].productId, 'NOT_A_REAL_ROLE')).toBeNull()
  })

  it('rejects a known product submitted with an unrelated known role', () => {
    const store = getCatalogStore()
    const options = searchProductsForRole({ roleCode: 'GENERIC_DRAINAGE_UNIT', limit: 1 }, store)
    const productId = options[0].productId
    const mappedRoles = new Set(
      (store.rolesByProduct.get(productId) ?? []).map((relationship) => relationship.role_code),
    )
    const unrelatedRole = store.roles.find((role) => !mappedRoles.has(role.role_code))
    expect(unrelatedRole).toBeDefined()

    expect(resolveCatalogPick(productId, unrelatedRole!.role_code, store)).toMatchObject({
      ok: false,
      code: 'product_role_mismatch',
    })
    expect(getCatalogPick(productId, unrelatedRole!.role_code, store)).toBeNull()
  })
})
