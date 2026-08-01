import productFamilyVersionsJson from '../../../../data/ip-preference-cards/generated/product-family-versions.json'

import {
  assertProductFamilySelectableForNewCard,
  resolveReviewedProductFamily,
  type ProductFamilyLedger,
  type ProductFamilyResolutionResult,
  type ReviewedProductFamilyPin,
  type ReviewedProductFamilyVersion,
} from '../domain/product-family'
import { canonicalRoleCode } from '../domain/role-taxonomy'

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
    if (version.governanceState !== 'approved') continue
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

export function resolveProductFamilyPin(
  pin: ReviewedProductFamilyPin,
): ProductFamilyResolutionResult {
  return resolveReviewedProductFamily(
    { ...pin, roleCode: canonicalRoleCode(pin.roleCode) },
    versionById,
  )
}

export { assertProductFamilySelectableForNewCard }
