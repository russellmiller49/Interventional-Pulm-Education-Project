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
import type { ProductStatusView } from '@/features/device-intelligence/domain/product-status'
import { getAtlasCatalogStore } from './atlas-store.server'
import { getProductStatus, getProductStatusMap } from './product-status.server'
import {
  getRawStatementsForProduct,
  getTypedRuleConditionsForRoles,
  textReferencesNonCohortIdentity,
  type AtlasCompatibilityStatement,
  type TypedRuleCondition,
} from './compatibility.server'

/**
 * Read-only atlas queries: the existing catalog query layer evaluated over the D2B cohort
 * store. No second search implementation, no second joins — `catalog.ts` functions with the
 * cohort store passed as their store parameter.
 *
 * D2B adds one thing on top: the compact market-status / safety overlay, resolved per
 * returned product. It is attached beside the catalog rows rather than merged into them, so
 * the shared preference-card list types stay exactly as the preserved surfaces expect.
 */

export interface AtlasSearchResponse extends CatalogSearchResponse {
  /** Market/safety status for every product in `items`. Total: an unresearched product
   *  resolves to the honest "not recently verified" default, never to nothing. */
  statusByProductId: Record<string, ProductStatusView>
}

export function searchAtlas(query: CatalogSearchQuery): AtlasSearchResponse {
  const response = searchCatalog(query, getAtlasCatalogStore())
  return {
    ...response,
    statusByProductId: getProductStatusMap(response.items.map((item) => item.productId)),
  }
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
  rawCompatibilityStatements: AtlasCompatibilityStatement[]
  typedRuleConditions: TypedRuleCondition[]
  /**
   * True when the product record's own free-text compatibility note was withheld from this
   * public view because it exactly names a product outside the D2B cohort (Codex C-03). The
   * page renders a generic explanation instead; `product.compatibility_text` is nulled in
   * the returned copy so the identity cannot ride along in the serialized view model.
   */
  compatibilityTextWithheld: boolean
  /** Verbatim procedure status strings for the procedures this product's slots belong to. */
  procedureStatusByCode: Record<string, string>
  /**
   * The product's primary clinical role with its authored description (owner-review F-17):
   * the functional answer to "what is this device for", shown in the page header. Resolved
   * from `getProductDetail`'s own `primaryRoleCode` — the identical role its discovery
   * list is drawn from, never a second selection rule.
   */
  primaryRole: { roleCode: string; roleName: string; description: string | null } | null
  /**
   * D2B market-status and safety overlay for this product. Metadata about the product, never
   * a gate on it: a blocked or review-required product renders the same page with a notice.
   */
  status: ProductStatusView
}

/**
 * The atlas device detail. Returns null — and the route 404s — for any product outside the
 * D2B cohort (candidate-grade, unknown-grade, or explicitly owner-excluded), because the
 * cohort store simply does not contain it. Existing direct-link (public-unlisted) and admin
 * surfaces keep rendering those products through the full store, unchanged.
 */
export function getAtlasProductDetail(productId: string): AtlasProductDetail | null {
  const store = getAtlasCatalogStore()
  // The atlas is the one caller that opts into Primary-fit representative selection
  // (owner-review F-18 as re-scoped by Codex C-06); every other caller keeps the legacy
  // catalog-order default.
  const detail = getProductDetail(productId, store, { representativeSelection: 'primary_fit' })
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

  // C-03: the record's own free-text compatibility note is governed data quoted raw, so it
  // passes the same exact-identifier wall as the raw statements. When it names a non-cohort
  // product (e.g. this GuideSheath kit's "not compatible with BF-MP190F"), the public view
  // model carries a nulled copy plus the withheld flag — never the identifying text.
  const compatibilityTextWithheld = textReferencesNonCohortIdentity(
    detail.product.compatibility_text,
  )

  return {
    ...detail,
    product: compatibilityTextWithheld
      ? { ...detail.product, compatibility_text: null }
      : detail.product,
    sameManufacturerLine,
    rawCompatibilityStatements: getRawStatementsForProduct(productId),
    typedRuleConditions: getTypedRuleConditionsForRoles(detail.roles.map((role) => role.roleCode)),
    compatibilityTextWithheld,
    procedureStatusByCode,
    primaryRole,
    status: getProductStatus(productId),
  }
}

export interface AtlasUseDetail {
  detail: UseDetail
  typedRuleConditions: TypedRuleCondition[]
  /** Market/safety status for every product listed on the role page. */
  statusByProductId: Record<string, ProductStatusView>
}

/**
 * The atlas role view: role identity and taxonomy come from the full role table (roles are
 * public taxonomy), while the product listing runs over the cohort store, so only
 * D2B-cohort products appear.
 */
export function getAtlasUseDetail(roleCode: string): AtlasUseDetail | null {
  const detail = getUseDetail(roleCode, getAtlasCatalogStore())
  if (!detail) return null
  return {
    detail,
    typedRuleConditions: getTypedRuleConditionsForRoles([detail.role.role_code]),
    statusByProductId: getProductStatusMap(
      detail.manufacturerGroups.flatMap((group) => group.items.map((item) => item.productId)),
    ),
  }
}
