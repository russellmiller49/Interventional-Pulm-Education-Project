import type { CatalogVerificationTier } from './verification'
import type { HospitalItem, HospitalRoleOption, VerificationState } from './types'
import { familyPickId } from './size-at-procedure'

/**
 * A whole reviewed product line chosen for a requirement, with the size left to the procedure.
 *
 * Airway stents are the reason this exists: the diameter and length are chosen once the
 * stenosis is measured, so a card that says "Novatech DUMON TD, size at time of procedure"
 * is more honest than one naming a size nobody can know in advance. The expectation the
 * card sets is that the line is available in the room.
 *
 * Which makes the identity load-bearing. A card asking for "the line" is asking for a *specific
 * set of products*, and until Phase 4A.1 it named that set with a discovery key — a string built
 * from a manufacturer, a label that falls back to a subcategory, and a product kind, recomputed on
 * every request. A pick now names a reviewed family version, and carries the three fields that
 * make the naming verifiable: the catalog release the membership is true of, the definition hash
 * the membership had when it was chosen, and the role it was chosen for.
 *
 * Like {@link CatalogPick}, the wizard builds one of these from the picker API for immediate
 * preview and the server rebuilds it at save time from identifiers alone, so a client cannot forge
 * product identity into a saved card. Both paths run the same construction below, so preview and
 * saved output agree — including the snapshot hash, which is why the size-range wording is derived
 * here rather than passed in.
 */

export interface FamilySpecRange {
  key: string
  min: number
  max: number
}

export interface FamilyPick {
  /** The reviewed, versioned, immutable identity. Never a discovery key. */
  productFamilyVersionId: string
  productFamilyCode: string
  /** The catalog release this family's membership was reviewed against. */
  catalogReleaseId: string
  /** The membership hash at the moment of selection, re-verified on every reconstruction. */
  definitionHash: string
  roleCode: string
  familyName: string
  manufacturerDisplay: string
  variantCount: number
  /** Numeric spans across the line's variants, formatted for display by this module. */
  specRanges: FamilySpecRange[]
  /** The least-confirmed variant's tier: a line is only as confirmed as its weakest size. */
  verificationTier: CatalogVerificationTier
  usStatusPending: boolean
  sourceId: string | null
  sourceLocation: string | null
}

/**
 * Compact English labels for the size span written onto the card.
 *
 * Catalog product and spec text is English in every locale — see the catalog's
 * `dataLanguageNote` — and this string is part of the immutable snapshot, so it is built
 * once here rather than translated at render time.
 */
const FAMILY_SPEC_FORMATS: Record<string, { label: string; unit: string }> = {
  diameter_mm: { label: 'diameter', unit: 'mm' },
  length_mm: { label: 'length', unit: 'mm' },
  french_size: { label: '', unit: 'Fr' },
  gauge: { label: '', unit: 'G' },
  working_length_cm: { label: 'working length', unit: 'cm' },
  min_working_channel_mm: { label: 'min channel', unit: 'mm' },
  delivery_system_od_mm: { label: 'delivery OD', unit: 'mm' },
}

function formatSpan(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`
}

/** e.g. "diameter 11–18 mm · length 20–110 mm". Empty when the line has no numeric specs. */
export function formatFamilySizeRange(specRanges: FamilySpecRange[]): string {
  return specRanges
    .map((range) => {
      const format = FAMILY_SPEC_FORMATS[range.key]
      if (!format) return null
      return [format.label, formatSpan(range.min, range.max), format.unit].filter(Boolean).join(' ')
    })
    .filter((entry): entry is string => Boolean(entry))
    .join(' · ')
}

/** The numeric spec fields a family's size span is summarized over, in display order. */
export interface FamilySpecSource {
  diameterMm: number | null
  lengthMm: number | null
  frenchSize: number | null
  gauge: number | null
  workingLengthCm: number | null
  minWorkingChannelMm: number | null
  deliverySystemOdMm: number | null
}

const FAMILY_SPEC_ACCESSORS: Array<{
  key: string
  read: (source: FamilySpecSource) => number | null
}> = [
  { key: 'diameter_mm', read: (source) => source.diameterMm },
  { key: 'length_mm', read: (source) => source.lengthMm },
  { key: 'french_size', read: (source) => source.frenchSize },
  { key: 'gauge', read: (source) => source.gauge },
  { key: 'working_length_cm', read: (source) => source.workingLengthCm },
  { key: 'min_working_channel_mm', read: (source) => source.minWorkingChannelMm },
  { key: 'delivery_system_od_mm', read: (source) => source.deliverySystemOdMm },
]

/**
 * The size span across a line's variants.
 *
 * Lives here rather than in the catalog query layer because two callers must agree on it exactly:
 * the picker, which computes it from the current catalog, and reconstruction, which computes it
 * from the retained rows of the pinned catalog release. The wording it produces is inside the
 * snapshot hash, so two implementations would be two cards.
 */
export function familySpecRanges(sources: FamilySpecSource[]): FamilySpecRange[] {
  const ranges: FamilySpecRange[] = []
  for (const accessor of FAMILY_SPEC_ACCESSORS) {
    const values = sources
      .map(accessor.read)
      .filter((value): value is number => typeof value === 'number')
    if (values.length === 0) continue
    ranges.push({ key: accessor.key, min: Math.min(...values), max: Math.max(...values) })
  }
  return ranges
}

export function familyPickDescription(pick: FamilyPick): string {
  return `${pick.manufacturerDisplay} ${pick.familyName} — size at time of procedure`
}

export function familyPickNotes(pick: FamilyPick): string {
  const span = formatFamilySizeRange(pick.specRanges)
  return span
    ? `Size chosen at time of procedure. Line stocked across ${span}.`
    : 'Size chosen at time of procedure.'
}

function verificationStateFor(pick: FamilyPick): VerificationState {
  return pick.verificationTier === 'verified' && !pick.usStatusPending
    ? 'prototype_visible'
    : 'unverified'
}

export function familyPickToHospitalItem(
  pick: FamilyPick,
  scope: { organizationId: string; siteId: string; locationId: string },
  roleScopedIdentity = false,
): HospitalItem {
  const itemId = familyPickId(
    pick.productFamilyVersionId,
    roleScopedIdentity ? pick.roleCode : undefined,
  )
  return {
    id: itemId,
    organizationId: scope.organizationId,
    siteId: scope.siteId,
    locationId: scope.locationId,
    itemType: 'commercial_product',
    roleCode: pick.roleCode,
    catalogProduct: {
      // Namespaced, so the snapshot can never present a product line as a single ordered
      // product. There is no catalog number to pull until a size is chosen.
      productId: itemId,
      manufacturer: pick.manufacturerDisplay,
      productName: pick.familyName,
      catalogNumber: null,
      gtin: null,
      verificationStatus: null,
      visibilityState: pick.verificationTier === 'verified' ? 'prototype_visible' : 'hidden',
      minWorkingChannelMm: null,
      deliverySystemOdMm: null,
      sourceId: pick.sourceId,
      sourceLocation: pick.sourceLocation,
    },
    localItemNumber: null,
    localDescription: familyPickDescription(pick),
    localUom: null,
    storageLocation: null,
    verificationState: verificationStateFor(pick),
    active: true,
    notes: familyPickNotes(pick),
    // Deliberately empty. A line spanning 7–11 mm delivery OD has no single dimension to
    // check, and the compatibility rules report "unknown" on a missing attribute rather than
    // passing — which is the honest answer until a size is picked.
    attributes: {},
    kitComponents: [],
  }
}

export function familyPickToRoleOption(
  pick: FamilyPick,
  roleScopedIdentity = false,
): HospitalRoleOption {
  const itemId = familyPickId(
    pick.productFamilyVersionId,
    roleScopedIdentity ? pick.roleCode : undefined,
  )
  return {
    id: roleScopedIdentity
      ? `family-option-${pick.roleCode}-${pick.productFamilyVersionId}`
      : `family-option-${pick.productFamilyVersionId}`,
    roleCode: pick.roleCode,
    hospitalItemId: itemId,
    preferenceRank: 99,
    substitutionClass: 'acceptable',
    noSubstitute: false,
    active: true,
    rationale:
      'Whole product line chosen from the catalog; the size is selected during the procedure.',
  }
}

/** Merge family picks into a build context without mutating the original. */
export function withFamilyPicks<
  T extends {
    hospitalItems: HospitalItem[]
    hospitalRoleOptions: HospitalRoleOption[]
  },
>(context: T, picks: FamilyPick[]): T {
  if (picks.length === 0) return context
  const scope = {
    organizationId: context.hospitalItems[0]?.organizationId ?? 'personal',
    siteId: context.hospitalItems[0]?.siteId ?? 'personal',
    locationId: context.hospitalItems[0]?.locationId ?? 'personal',
  }

  const seenItemIds = new Set(context.hospitalItems.map((item) => item.id))
  const extraItems: HospitalItem[] = []
  const rolesByFamily = new Map<string, Set<string>>()
  for (const pick of picks) {
    const roles = rolesByFamily.get(pick.productFamilyVersionId) ?? new Set<string>()
    roles.add(pick.roleCode)
    rolesByFamily.set(pick.productFamilyVersionId, roles)
  }
  for (const pick of picks) {
    const roleScopedIdentity = (rolesByFamily.get(pick.productFamilyVersionId)?.size ?? 0) > 1
    const itemId = familyPickId(
      pick.productFamilyVersionId,
      roleScopedIdentity ? pick.roleCode : undefined,
    )
    if (seenItemIds.has(itemId)) continue
    seenItemIds.add(itemId)
    extraItems.push(familyPickToHospitalItem(pick, scope, roleScopedIdentity))
  }

  const seenOptionIds = new Set(context.hospitalRoleOptions.map((option) => option.id))
  const extraOptions: HospitalRoleOption[] = []
  for (const pick of picks) {
    const roleScopedIdentity = (rolesByFamily.get(pick.productFamilyVersionId)?.size ?? 0) > 1
    const option = familyPickToRoleOption(pick, roleScopedIdentity)
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
