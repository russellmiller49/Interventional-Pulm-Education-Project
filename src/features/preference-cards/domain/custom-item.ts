import type { HospitalItem, HospitalRoleOption } from './types'

/**
 * A free-text line the user writes themselves.
 *
 * Six roles the procedure templates ask for have nothing catalogued at all — PPE, suction,
 * specimen handling, collateral-ventilation assessment, the energy platform, and whole-lung
 * lavage fluid — because they are room resources and locally-stocked consumables rather than
 * ordered devices. Without this the card simply cannot say "wall suction" and those
 * requirements stay permanently unresolved.
 *
 * Unlike a catalog pick, there is no product identity to rebuild server-side: the text is
 * the whole record. It is therefore always marked unverified, never claims a manufacturer or
 * catalog number, and is length-bounded on the way in.
 */

export const MAX_CUSTOM_ITEMS = 60
export const MAX_CUSTOM_DESCRIPTION = 200
export const MAX_CUSTOM_NOTE = 300

export interface CustomItem {
  /** Stable within a card, so a re-save keeps the same hospital-item id. */
  id: string
  roleCode: string
  description: string
  itemNumber: string | null
  notes: string | null
}

/** Hospital-item id for a custom line. Namespaced apart from catalog/set/family ids. */
export function customItemId(id: string): string {
  return `custom:${id}`
}

export function isCustomItemId(itemId: string | null | undefined): boolean {
  return typeof itemId === 'string' && itemId.startsWith('custom:')
}

export function customIdFromItemId(itemId: string): string | null {
  return isCustomItemId(itemId) ? itemId.slice('custom:'.length) : null
}

export function customItemToHospitalItem(
  item: CustomItem,
  scope: { organizationId: string; siteId: string; locationId: string },
): HospitalItem {
  return {
    id: customItemId(item.id),
    organizationId: scope.organizationId,
    siteId: scope.siteId,
    locationId: scope.locationId,
    itemType: 'hospital_local_disposable',
    roleCode: item.roleCode,
    // No catalog product: nothing here traces to a manufacturer document, and claiming one
    // would put an unsourced product name on a card.
    catalogProduct: null,
    localItemNumber: item.itemNumber,
    localDescription: item.description,
    localUom: null,
    storageLocation: null,
    // Always unverified. The text is whatever the author typed; the card should say so.
    verificationState: 'unverified',
    active: true,
    notes: item.notes,
    attributes: {},
    kitComponents: [],
  }
}

export function customItemToRoleOption(item: CustomItem): HospitalRoleOption {
  return {
    id: `custom-option-${item.id}`,
    roleCode: item.roleCode,
    hospitalItemId: customItemId(item.id),
    preferenceRank: 50,
    substitutionClass: 'acceptable',
    noSubstitute: false,
    active: true,
    rationale: 'Written for this card; not from the product catalog.',
  }
}

/** Merge custom lines into a build context without mutating the original. */
export function withCustomItems<
  T extends {
    hospitalItems: HospitalItem[]
    hospitalRoleOptions: HospitalRoleOption[]
  },
>(context: T, items: CustomItem[]): T {
  if (items.length === 0) return context
  const scope = {
    organizationId: context.hospitalItems[0]?.organizationId ?? 'personal',
    siteId: context.hospitalItems[0]?.siteId ?? 'personal',
    locationId: context.hospitalItems[0]?.locationId ?? 'personal',
  }

  const seenItemIds = new Set(context.hospitalItems.map((entry) => entry.id))
  const extraItems: HospitalItem[] = []
  for (const item of items) {
    const itemId = customItemId(item.id)
    if (seenItemIds.has(itemId)) continue
    seenItemIds.add(itemId)
    extraItems.push(customItemToHospitalItem(item, scope))
  }

  const seenOptionIds = new Set(context.hospitalRoleOptions.map((option) => option.id))
  const extraOptions: HospitalRoleOption[] = []
  for (const item of items) {
    const option = customItemToRoleOption(item)
    if (seenOptionIds.has(option.id)) continue
    seenOptionIds.add(option.id)
    extraOptions.push(option)
  }

  if (extraItems.length === 0 && extraOptions.length === 0) return context

  return {
    ...context,
    hospitalItems: [...context.hospitalItems, ...extraItems],
    hospitalRoleOptions: [...context.hospitalRoleOptions, ...extraOptions],
  }
}
