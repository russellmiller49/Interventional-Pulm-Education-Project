import type { CatalogVerificationTier } from './verification'
import type { HospitalItem, HospitalRoleOption, VerificationState } from './types'

/**
 * A product chosen straight from the catalog rather than from the hospital-local list.
 *
 * The wizard builds these from the picker API so it can preview the resolved card
 * immediately; the server rebuilds them from the catalog at save time using only the
 * product id, so a client cannot forge product identity into a saved card. Both paths run
 * the same construction below, so preview and saved output agree.
 */
export interface CatalogPick {
  productId: string
  roleCode: string
  manufacturerDisplay: string
  productName: string
  catalogNumber: string | null
  gtin: string | null
  sizeDisplay: string | null
  verificationTier: CatalogVerificationTier
  usStatusPending: boolean
  minWorkingChannelMm: number | null
  deliverySystemOdMm: number | null
  sourceId: string | null
  sourceLocation: string | null
}

/** Hospital-item id for a catalog pick. Namespaced so it can never collide with a seeded id. */
export function catalogPickItemId(productId: string): string {
  return `catalog:${productId}`
}

export function isCatalogPickItemId(itemId: string | null | undefined): boolean {
  return typeof itemId === 'string' && itemId.startsWith('catalog:')
}

export function productIdFromCatalogPickItemId(itemId: string): string | null {
  return isCatalogPickItemId(itemId) ? itemId.slice('catalog:'.length) : null
}

function verificationStateFor(pick: CatalogPick): VerificationState {
  // Unverified catalog products are usable and flagged, never withheld. A verified product
  // whose current US status is still unconfirmed is treated the same way, so the card
  // carries the confirm-before-use flag rather than implying local approval.
  return pick.verificationTier === 'verified' && !pick.usStatusPending
    ? 'prototype_visible'
    : 'unverified'
}

export function catalogPickToHospitalItem(
  pick: CatalogPick,
  scope: { organizationId: string; siteId: string; locationId: string },
): HospitalItem {
  return {
    id: catalogPickItemId(pick.productId),
    organizationId: scope.organizationId,
    siteId: scope.siteId,
    locationId: scope.locationId,
    itemType: 'commercial_product',
    roleCode: pick.roleCode,
    catalogProduct: {
      productId: pick.productId,
      manufacturer: pick.manufacturerDisplay,
      productName: pick.productName,
      catalogNumber: pick.catalogNumber,
      gtin: pick.gtin,
      verificationStatus: null,
      visibilityState: pick.verificationTier === 'verified' ? 'prototype_visible' : 'hidden',
      minWorkingChannelMm: pick.minWorkingChannelMm,
      deliverySystemOdMm: pick.deliverySystemOdMm,
      sourceId: pick.sourceId,
      sourceLocation: pick.sourceLocation,
    },
    localItemNumber: null,
    localDescription: [pick.manufacturerDisplay, pick.productName].filter(Boolean).join(' '),
    localUom: null,
    storageLocation: null,
    verificationState: verificationStateFor(pick),
    active: true,
    notes: pick.sizeDisplay,
    // Dimensional attributes feed the typed compatibility rules.
    attributes: {
      delivery_system_od_mm: pick.deliverySystemOdMm,
      min_working_channel_mm: pick.minWorkingChannelMm,
    },
    kitComponents: [],
  }
}

export function catalogPickToRoleOption(pick: CatalogPick): HospitalRoleOption {
  return {
    // One product may legitimately carry several Product_Roles. The hospital item remains
    // one physical catalog product, while each exact product-role pair needs its own option.
    id: `catalog-option-${pick.productId}-${pick.roleCode}`,
    roleCode: pick.roleCode,
    hospitalItemId: catalogPickItemId(pick.productId),
    preferenceRank: 99,
    substitutionClass: 'acceptable',
    noSubstitute: false,
    active: true,
    rationale: 'Chosen from the product catalog for this card.',
  }
}

/** Merge catalog picks into a build context without mutating the original. */
export function withCatalogPicks<
  T extends {
    hospitalItems: HospitalItem[]
    hospitalRoleOptions: HospitalRoleOption[]
  },
>(context: T, picks: CatalogPick[]): T {
  if (picks.length === 0) return context
  const scope = {
    organizationId: context.hospitalItems[0]?.organizationId ?? 'personal',
    siteId: context.hospitalItems[0]?.siteId ?? 'personal',
    locationId: context.hospitalItems[0]?.locationId ?? 'personal',
  }
  // Dedupe physical items by product. The same product can legitimately be picked for two
  // roles, so the role-option loop below dedupes exact product-role pairs independently.
  const seenProductIds = new Set(
    context.hospitalItems.map((item) => item.id).filter(isCatalogPickItemId),
  )
  const extraItems: HospitalItem[] = []
  for (const pick of picks) {
    const itemId = catalogPickItemId(pick.productId)
    if (seenProductIds.has(itemId)) continue
    seenProductIds.add(itemId)
    extraItems.push(catalogPickToHospitalItem(pick, scope))
  }
  const seenOptionIds = new Set(context.hospitalRoleOptions.map((option) => option.id))
  const extraOptions: HospitalRoleOption[] = []
  for (const pick of picks) {
    const option = catalogPickToRoleOption(pick)
    if (seenOptionIds.has(option.id)) continue
    seenOptionIds.add(option.id)
    extraOptions.push(option)
  }

  return {
    ...context,
    hospitalItems: [...context.hospitalItems, ...extraItems],
    hospitalRoleOptions: [...context.hospitalRoleOptions, ...extraOptions],
  }
}
