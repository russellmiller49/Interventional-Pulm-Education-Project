import productFamilyVersionsJson from '../../../../data/ip-preference-cards/generated/product-family-versions.json'

import {
  assertProductFamilySelectableForNewCard,
  resolveReviewedProductFamily,
  type ProductFamilyLedger,
  type ProductFamilyResolutionResult,
  type ReviewedProductFamilyPin,
  type ReviewedProductFamilyVersion,
} from '../domain/product-family'
import { canonicalRoleCode, type RoleCodeCanonicalizer } from '../domain/role-taxonomy'

/**
 * The retained reviewed product families, and the only route by which one becomes a card selection.
 *
 * Two lookups, deliberately asymmetric:
 *
 * - **By pin**, for reconstruction. Every part of the pin is verified and nothing falls back —
 *   a family whose membership has moved does not resolve to the new membership and does not
 *   resolve to a similar family; it does not resolve.
 * - **By role**, for the picker. Only *approved* versions are offered, so a draft membership under
 *   review and a retired one that has been split can both exist in the file without either
 *   becoming a new card's identity.
 *
 * There is no lookup by name, by manufacturer, or by discovery key. That absence is the point: the
 * discovery grouping is a browsing convenience computed from mutable labels, and any function that
 * turned one into a reviewed family would be a guess with a lookup's signature.
 */

const ledger = productFamilyVersionsJson as unknown as ProductFamilyLedger

const versionById = (() => {
  const index = new Map<string, ReviewedProductFamilyVersion>()
  for (const version of ledger.versions) {
    if (index.has(version.productFamilyVersionId)) {
      throw new Error(
        `Product family version ${version.productFamilyVersionId} is retained more than once. A family version id must identify exactly one frozen membership.`,
      )
    }
    index.set(version.productFamilyVersionId, version)
  }
  return index
})()

/**
 * Approved family versions by role, and asserted unique per (role, family code).
 *
 * Two approved versions of one family code serving one role would make "which family does this
 * picker offer" a question with two answers, and answering it by taking the higher version string
 * is the "latest" inference this feature refuses everywhere else. Superseding a family means
 * retiring the old version in the same act.
 */
const approvedByRole = (() => {
  const index = new Map<string, ReviewedProductFamilyVersion[]>()
  const seen = new Map<string, string>()
  for (const version of ledger.versions) {
    // Through the shared predicate rather than an inline state comparison, so "which families may
    // a new card select" has exactly one answer in the codebase. An inline check here would be a
    // second definition of selectable that could drift from the first without anything noticing.
    if (!assertProductFamilySelectableForNewCard(version).ok) continue
    for (const roleCode of version.roleCodes) {
      const key = `${roleCode}::${version.productFamilyCode}`
      const existing = seen.get(key)
      if (existing) {
        throw new Error(
          `Product family ${version.productFamilyCode} has two approved versions serving ${roleCode}: ${existing} and ${version.productFamilyVersionId}.`,
        )
      }
      seen.set(key, version.productFamilyVersionId)
      const forRole = index.get(roleCode)
      if (forRole) forRole.push(version)
      else index.set(roleCode, [version])
    }
  }
  for (const versions of index.values()) {
    versions.sort((left, right) => left.displayName.localeCompare(right.displayName))
  }
  return index
})()

/** Every retained version by role, regardless of state. See `getReviewedProductFamiliesForRole`. */
const allByRole = (() => {
  const index = new Map<string, ReviewedProductFamilyVersion[]>()
  for (const version of ledger.versions) {
    for (const roleCode of version.roleCodes) {
      const forRole = index.get(roleCode)
      if (forRole) forRole.push(version)
      else index.set(roleCode, [version])
    }
  }
  for (const versions of index.values()) {
    versions.sort(
      (left, right) =>
        left.displayName.localeCompare(right.displayName) ||
        left.productFamilyVersionId.localeCompare(right.productFamilyVersionId),
    )
  }
  return index
})()

export function getReviewedProductFamilyVersions(): ReviewedProductFamilyVersion[] {
  return ledger.versions.map((version) => ({
    ...version,
    roleCodes: [...version.roleCodes],
    memberProductIds: [...version.memberProductIds],
  }))
}

export function getReviewedProductFamilyVersion(
  productFamilyVersionId: string,
): ReviewedProductFamilyVersion | null {
  return versionById.get(productFamilyVersionId) ?? null
}

/** Approved families a *new* card may select for this requirement. Empty is a normal answer. */
export function getApprovedProductFamiliesForRole(
  requestedRoleCode: string,
): ReviewedProductFamilyVersion[] {
  // Canonicalized on the way in for the same reason every other role lookup is: the picker is
  // reachable by URL and by API, and a pre-rename code must not silently return nothing.
  return approvedByRole.get(canonicalRoleCode(requestedRoleCode)) ?? []
}

/**
 * Every retained family version serving a role, whatever its governance state.
 *
 * Separate from the approved index and never used to decide what a card may select. It exists so a
 * reviewer can *see* that a family has been identified and is waiting on clinical review — which is
 * a different situation from "no reviewed family exists for this grouping at all", and one the
 * catalog surfaces would otherwise present identically. Reporting them the same way would make an
 * 18-member line awaiting sign-off indistinguishable from a grouping nobody has looked at.
 *
 * No uniqueness assertion here, deliberately: a retired version and its approved successor both
 * serve the role and both belong in a review listing.
 */
export function getReviewedProductFamiliesForRole(
  requestedRoleCode: string,
): ReviewedProductFamilyVersion[] {
  return allByRole.get(canonicalRoleCode(requestedRoleCode)) ?? []
}

export function resolveProductFamilyPin(
  pin: ReviewedProductFamilyPin,
  /**
   * The alias table of the release the pin is reconstructed under. The pin's stored role is
   * pre-canonicalized with the same table the domain check uses, so both hops speak the pinned
   * release's vocabulary — never the live table's (P92-C1).
   */
  canonicalize: RoleCodeCanonicalizer,
): ProductFamilyResolutionResult {
  return resolveReviewedProductFamily(
    { ...pin, roleCode: canonicalize(pin.roleCode) },
    versionById,
    canonicalize,
  )
}

export { assertProductFamilySelectableForNewCard }
