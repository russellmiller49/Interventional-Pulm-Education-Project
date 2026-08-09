import 'server-only'

import {
  getCatalogFacets,
  getCatalogOverview,
  getProductDetail,
  getUseDetail,
  searchCatalog,
  validateKnownCatalogFilters,
  type CatalogFacets,
  type CatalogOverview,
  type CatalogSearchResponse,
  type ProductDetail,
  type UseDetail,
} from '@/features/preference-cards/server/catalog'
import type { CatalogSearchQuery } from '@/features/preference-cards/schemas/catalog-search'
import { getAtlasCatalogStore } from './atlas-store.server'
import {
  getRawStatementsForProduct,
  getTypedRuleConditionsForRoles,
  type RawCompatibilityStatement,
  type TypedRuleCondition,
} from './compatibility.server'

/**
 * Read-only atlas queries: the existing catalog query layer evaluated over the D1 cohort
 * store. No second search implementation, no second joins — `catalog.ts` functions with the
 * cohort store passed as their store parameter.
 */

export function searchAtlas(query: CatalogSearchQuery): CatalogSearchResponse {
  return searchCatalog(query, getAtlasCatalogStore())
}

export function getAtlasFacets(): CatalogFacets {
  return getCatalogFacets(getAtlasCatalogStore())
}

export function getAtlasOverview(): CatalogOverview {
  return getCatalogOverview(getAtlasCatalogStore())
}

export function validateAtlasFilters(query: CatalogSearchQuery): string | null {
  return validateKnownCatalogFilters(query, getAtlasCatalogStore())
}

export interface AtlasProductDetail extends ProductDetail {
  /** Same-line siblings inside the atlas cohort — a display-only manufacturer grouping. */
  sameManufacturerLine: {
    productId: string
    productName: string
    sizeDisplay: string | null
    catalogNumber: string | null
  }[]
  rawCompatibilityStatements: RawCompatibilityStatement[]
  typedRuleConditions: TypedRuleCondition[]
  /** Verbatim procedure status strings for the procedures this product's slots belong to. */
  procedureStatusByCode: Record<string, string>
  /**
   * The product's primary clinical role with its authored description (owner-review F-17):
   * the functional answer to "what is this device for", shown in the page header. Resolved
   * from `getProductDetail`'s own `primaryRoleCode` — the identical role its discovery
   * list is drawn from, never a second selection rule.
   */
  primaryRole: { roleCode: string; roleName: string; description: string | null } | null
}

/**
 * The atlas device detail. Returns null — and the route 404s — for any product outside the
 * D1 cohort, because the cohort store simply does not contain it. Existing authenticated
 * and admin surfaces keep rendering those products through the full store, unchanged.
 */
export function getAtlasProductDetail(productId: string): AtlasProductDetail | null {
  const store = getAtlasCatalogStore()
  const detail = getProductDetail(productId, store)
  if (!detail) return null

  const sameManufacturerLine = (store.products ?? [])
    .filter(
      (candidate) =>
        candidate.familyKey === detail.product.familyKey &&
        candidate.product_id !== detail.product.product_id,
    )
    .sort(
      (left, right) =>
        (left.diameter_mm ?? 0) - (right.diameter_mm ?? 0) ||
        (left.french_size ?? 0) - (right.french_size ?? 0) ||
        left.product_name.localeCompare(right.product_name),
    )
    .map((candidate) => ({
      productId: candidate.product_id,
      productName: candidate.product_name,
      sizeDisplay: candidate.size_display,
      catalogNumber: candidate.catalog_number,
    }))

  const procedureStatusByCode: Record<string, string> = {}
  for (const slot of detail.slots) {
    const procedure = store.procedureByCode.get(slot.procedureCode)
    if (procedure?.status) procedureStatusByCode[slot.procedureCode] = procedure.status
  }

  const primaryRoleLink = detail.primaryRoleCode
    ? (detail.roles.find((role) => role.roleCode === detail.primaryRoleCode) ?? null)
    : null
  const primaryRole = primaryRoleLink
    ? {
        roleCode: primaryRoleLink.roleCode,
        roleName: primaryRoleLink.roleName,
        description: store.roleByCode.get(primaryRoleLink.roleCode)?.description ?? null,
      }
    : null

  return {
    ...detail,
    sameManufacturerLine,
    rawCompatibilityStatements: getRawStatementsForProduct(productId),
    typedRuleConditions: getTypedRuleConditionsForRoles(detail.roles.map((role) => role.roleCode)),
    procedureStatusByCode,
    primaryRole,
  }
}

export interface AtlasUseDetail {
  detail: UseDetail
  typedRuleConditions: TypedRuleCondition[]
}

/**
 * The atlas role view: role identity and taxonomy come from the full role table (roles are
 * public taxonomy), while the product listing runs over the cohort store, so only D1-visible
 * products appear.
 */
export function getAtlasUseDetail(roleCode: string): AtlasUseDetail | null {
  const detail = getUseDetail(roleCode, getAtlasCatalogStore())
  if (!detail) return null
  return {
    detail,
    typedRuleConditions: getTypedRuleConditionsForRoles([detail.role.role_code]),
  }
}
