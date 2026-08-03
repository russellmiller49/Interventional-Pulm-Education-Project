import type { CatalogPick } from './catalog-pick'
import type { HospitalItem, HospitalRoleOption } from './types'
import { canonicalRoleCode } from './role-taxonomy'

/**
 * A user-defined equipment set: the tray or cart a physician actually owns, listed once and
 * reused across cards.
 *
 * A set is expressed as a `procedure_kit` hospital item whose `kitComponents` name every
 * role it covers, so the existing kit-suppression pass does the work: choosing the set for
 * one requirement satisfies it and suppresses the other requirements the set already
 * contains. That is how a Karl Storz rigid set — where the scope and head are one piece —
 * stops the separate "head/base" requirement from asking for a second item, while an
 * Efer-style set that genuinely has a separate base still lists both.
 */

export interface EquipmentSet {
  id: string
  name: string
  description: string | null
  /** Catalog products in the set. Their roles determine what the set covers. */
  members: CatalogPick[]
  /**
   * Roles the set satisfies without contributing a distinct product — for a combined
   * scope/head, the head role belongs here rather than duplicating the product.
   */
  additionalCoveredRoles: string[]
  createdAt: string
  updatedAt: string
}

export interface StoredEquipmentSets {
  version: 1
  sets: EquipmentSet[]
}

export const EQUIPMENT_SETS_STORAGE_KEY = 'ip-preference-cards:equipment-sets:v1'
export const MAX_EQUIPMENT_SETS = 50
export const MAX_EQUIPMENT_SET_MEMBERS = 60

/** A physical product may legitimately serve more than one role in the same set. */
export function equipmentSetMemberKey(member: Pick<CatalogPick, 'productId' | 'roleCode'>): string {
  return `${member.productId}:${member.roleCode}`
}

export function equipmentSetHasMember(
  set: EquipmentSet,
  member: Pick<CatalogPick, 'productId' | 'roleCode'>,
): boolean {
  const key = equipmentSetMemberKey(member)
  return set.members.some((candidate) => equipmentSetMemberKey(candidate) === key)
}

export function equipmentSetProductIdsForRole(set: EquipmentSet, roleCode: string): Set<string> {
  return new Set(
    set.members.filter((member) => member.roleCode === roleCode).map((member) => member.productId),
  )
}

export function equipmentSetWithoutMember(
  set: EquipmentSet,
  member: Pick<CatalogPick, 'productId' | 'roleCode'>,
): EquipmentSet {
  const key = equipmentSetMemberKey(member)
  return {
    ...set,
    members: set.members.filter((candidate) => equipmentSetMemberKey(candidate) !== key),
  }
}

export function equipmentSetItemId(setId: string): string {
  return `set:${setId}`
}

export function isEquipmentSetItemId(itemId: string | null | undefined): boolean {
  return typeof itemId === 'string' && itemId.startsWith('set:')
}

export function equipmentSetIdFromItemId(itemId: string): string | null {
  return isEquipmentSetItemId(itemId) ? itemId.slice('set:'.length) : null
}

/** Every role the set satisfies: its members' roles plus any explicitly covered extras. */
export function equipmentSetCoveredRoles(set: EquipmentSet): string[] {
  const roles = new Set<string>()
  for (const member of set.members) roles.add(member.roleCode)
  for (const role of set.additionalCoveredRoles) roles.add(role)
  return [...roles].sort()
}

export function equipmentSetSummary(set: EquipmentSet): string {
  const seenProductIds = new Set<string>()
  const memberNames = set.members.flatMap((member) => {
    if (seenProductIds.has(member.productId)) return []
    seenProductIds.add(member.productId)
    return [`${member.manufacturerDisplay} ${member.productName}`]
  })
  return memberNames.join('; ')
}

/**
 * The set as a kit item. `roleCode` is the requirement it is being selected for; the kit
 * components carry every role it covers so the resolver can suppress the rest.
 */
export function equipmentSetToHospitalItem(
  set: EquipmentSet,
  roleCode: string,
  scope: { organizationId: string; siteId: string; locationId: string },
): HospitalItem {
  const coveredRoles = equipmentSetCoveredRoles(set)
  // An unverified member makes the whole set unverified: the set is only as confirmed as
  // its least-confirmed part.
  const anyUnverified = set.members.some(
    (member) => member.verificationTier !== 'verified' || member.usStatusPending,
  )
  return {
    id: equipmentSetItemId(set.id),
    organizationId: scope.organizationId,
    siteId: scope.siteId,
    locationId: scope.locationId,
    itemType: 'procedure_kit',
    roleCode,
    catalogProduct: null,
    localItemNumber: null,
    localDescription: set.name,
    localUom: null,
    storageLocation: null,
    verificationState: anyUnverified ? 'unverified' : 'prototype_visible',
    active: true,
    notes: set.description ?? equipmentSetSummary(set),
    attributes: {},
    kitComponents: coveredRoles.map((role) => ({
      roleCode: role,
      inclusion: 'included' as const,
      quantity: 1,
    })),
  }
}

/** One selectable option per role the set covers, so it can be chosen from any of those rows. */
export function equipmentSetToRoleOptions(set: EquipmentSet): HospitalRoleOption[] {
  return equipmentSetCoveredRoles(set).map((roleCode) => ({
    id: `set-option-${set.id}-${roleCode}`,
    roleCode,
    hospitalItemId: equipmentSetItemId(set.id),
    preferenceRank: 1,
    substitutionClass: 'preferred' as const,
    noSubstitute: false,
    active: true,
    rationale: `Included in the "${set.name}" equipment set.`,
  }))
}

/**
 * Merge selected equipment sets into a build context without mutating the original.
 * `selectedRoleBySetId` records which requirement each set was chosen for, which becomes
 * the kit item's own role.
 */
export function withEquipmentSets<
  T extends {
    hospitalItems: HospitalItem[]
    hospitalRoleOptions: HospitalRoleOption[]
  },
>(context: T, sets: EquipmentSet[], selectedRoleBySetId: Record<string, string> = {}): T {
  if (sets.length === 0) return context
  const scope = {
    organizationId: context.hospitalItems[0]?.organizationId ?? 'personal',
    siteId: context.hospitalItems[0]?.siteId ?? 'personal',
    locationId: context.hospitalItems[0]?.locationId ?? 'personal',
  }

  const seenItemIds = new Set(context.hospitalItems.map((item) => item.id))
  const seenOptionIds = new Set(context.hospitalRoleOptions.map((option) => option.id))
  const extraItems: HospitalItem[] = []
  const extraOptions: HospitalRoleOption[] = []

  for (const set of sets) {
    const covered = equipmentSetCoveredRoles(set)
    if (covered.length === 0) continue
    const roleCode = selectedRoleBySetId[set.id] ?? covered[0]
    const itemId = equipmentSetItemId(set.id)
    if (!seenItemIds.has(itemId)) {
      seenItemIds.add(itemId)
      extraItems.push(equipmentSetToHospitalItem(set, roleCode, scope))
    }
    for (const option of equipmentSetToRoleOptions(set)) {
      if (seenOptionIds.has(option.id)) continue
      seenOptionIds.add(option.id)
      extraOptions.push(option)
    }
  }

  if (extraItems.length === 0 && extraOptions.length === 0) return context

  return {
    ...context,
    hospitalItems: [...context.hospitalItems, ...extraItems],
    hospitalRoleOptions: [...context.hospitalRoleOptions, ...extraOptions],
  }
}

export function parseStoredEquipmentSets(raw: string | null): EquipmentSet[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as StoredEquipmentSets
    if (parsed?.version !== 1 || !Array.isArray(parsed.sets)) return []
    return parsed.sets
      .filter(
        (set) =>
          typeof set?.id === 'string' &&
          typeof set?.name === 'string' &&
          Array.isArray(set?.members),
      )
      .slice(0, MAX_EQUIPMENT_SETS)
      .map((set) => ({
        ...set,
        // Sets live in localStorage and long outlive a role rename, so canonicalize on read.
        // The save path resolves aliases anyway; without this the *preview* would quietly
        // stop matching the slot and the set would look like it covered nothing.
        members: set.members
          .slice(0, MAX_EQUIPMENT_SET_MEMBERS)
          .map((member) => ({ ...member, roleCode: canonicalRoleCode(member.roleCode) })),
        additionalCoveredRoles: Array.isArray(set.additionalCoveredRoles)
          ? [...new Set(set.additionalCoveredRoles.map(canonicalRoleCode))]
          : [],
      }))
  } catch {
    return []
  }
}

export function serializeEquipmentSets(sets: EquipmentSet[]): string {
  return JSON.stringify({ version: 1, sets } satisfies StoredEquipmentSets)
}
