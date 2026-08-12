import catalogReleaseManifestsJson from '../../../../data/ip-preference-cards/generated/catalog-release-manifests.json'
import catalogRowsJson from '../../../../data/ip-preference-cards/generated/catalog-rows.json'

import type { CatalogPick } from '../domain/catalog-pick'
import { familySpecRanges, type FamilyPick } from '../domain/family-pick'
import type { ReviewedProductFamilyVersion } from '../domain/product-family'
import {
  resolveHistoricalCatalog,
  validateHistoricalCatalog,
  type HistoricalCatalog,
  type HistoricalCatalogReleaseFile,
  type HistoricalCatalogResult,
  type HistoricalCatalogRowStore,
  type HistoricalCatalogValidationMessage,
  type HistoricalProductRow,
} from '../domain/historical-catalog'
import type { RoleCodeCanonicalizer } from '../domain/role-taxonomy'
import { catalogVerificationTier, isUsStatusPending } from '../domain/verification'
import { canonicalManufacturer } from '../server/manufacturer-aliases'

/**
 * Reading a card's *pinned* catalog release rather than today's catalog.
 *
 * This is the half of reconstruction the release bundle could previously only detect. A bundle
 * records which catalog release it was published against; until now that was a receipt, and the
 * products behind a saved selection were looked up in whatever the catalog says now. A product
 * discontinued and dropped from the workbook took the identity of every card that named it, and a
 * product re-mapped to different roles quietly changed which requirement a stored pick satisfied.
 *
 * So identity comes from here, and nothing falls back to the current catalog. A missing manifest,
 * a missing row, or a row that no longer hashes to what the manifest named is a typed failure the
 * caller turns into a view-only card. Substituting current content would be worse than refusing:
 * a card that will not reopen is visible, and a card silently resolved against a product its author
 * never saw is not.
 *
 * What deliberately still comes from *current* data: whether reviewed governance now holds the
 * product out of preference-card selection. That is the `not_applicable` wall — the
 * breakthrough-designated cohort — and it answers a question about today. A device withdrawn to
 * investigational status should stop being selectable, not keep being selectable because it once
 * was.
 */

const rowStore = catalogRowsJson as unknown as HistoricalCatalogRowStore
const releaseFile = catalogReleaseManifestsJson as unknown as HistoricalCatalogReleaseFile

const resolvedByReleaseId = new Map<string, HistoricalCatalogResult>()

/** The retained catalog for one release, verified once per process and then reused. */
export function getHistoricalCatalog(catalogReleaseId: string): HistoricalCatalogResult {
  const cached = resolvedByReleaseId.get(catalogReleaseId)
  if (cached) return cached
  const resolved = resolveHistoricalCatalog(catalogReleaseId, rowStore, releaseFile)
  resolvedByReleaseId.set(catalogReleaseId, resolved)
  return resolved
}

export function getRetainedCatalogReleaseIds(): string[] {
  return releaseFile.releases.map((release) => release.catalogReleaseId)
}

/**
 * The standing check that the retained catalog is intact.
 *
 * Exported so `historical-catalog-integrity.test.ts` runs it against the real committed data on
 * every CI run: a commit that edits a retained row, drops one a manifest names, or rewrites a
 * manifest fails the suite rather than shipping and being discovered by a card that will not
 * reopen.
 */
export function validateRetainedCatalog(
  pinnedCatalogReleaseIds?: ReadonlySet<string>,
): HistoricalCatalogValidationMessage[] {
  return validateHistoricalCatalog({
    store: rowStore,
    releases: releaseFile,
    pinnedCatalogReleaseIds,
  })
}

export type HistoricalPickErrorCode =
  | 'unknown_product'
  | 'unknown_role'
  | 'product_role_mismatch'
  | 'product_not_slottable'

export type HistoricalPickResult =
  | { ok: true; pick: CatalogPick }
  | { ok: false; code: HistoricalPickErrorCode; productId: string; roleCode: string }

/** A retained product row, presented the way the rest of the module presents a catalog product. */
export function historicalProductToPick(row: HistoricalProductRow, roleCode: string): CatalogPick {
  // Manufacturer grouping is applied here rather than retained, because alias groups live in code
  // outside the three files the catalog release id is computed over — see the closure rule in
  // `historical-catalog.ts`.
  const identity = canonicalManufacturer(row.manufacturerId, row.manufacturerName)
  const verificationInput = {
    verification_grade: row.verificationGrade,
    visibility_state: row.visibilityState,
  }
  return {
    productId: row.productId,
    roleCode,
    manufacturerDisplay: identity.manufacturerDisplay,
    productName: row.productName,
    catalogNumber: row.catalogNumber,
    gtin: row.gtin,
    sizeDisplay: row.sizeDisplay,
    verificationTier: catalogVerificationTier(verificationInput),
    usStatusPending: isUsStatusPending(verificationInput),
    minWorkingChannelMm: row.minWorkingChannelMm,
    deliverySystemOdMm: row.deliverySystemOdMm,
    sourceId: row.primarySourceId,
    sourceLocation: row.primarySourceLocation,
  }
}

/**
 * Rebuild one saved catalog pick from the release it was saved against.
 *
 * The role check runs over canonicalized codes on both sides. A card saved before a role was
 * renamed carries the old code and the retained mapping carries the old code; a card saved after
 * carries the new one. Aliases are permanent so that both keep matching, and comparing raw strings
 * would make a rename look like a product that no longer serves the requirement.
 *
 * The canonicalizer is a required argument, not a module import: this function reconstructs a
 * pick inside one release's semantics, so the alias table must be the one that release resolved
 * by its pin. Reaching for the live table here is exactly how a live alias added later would
 * reinterpret a historical role (P92-C1).
 */
export function resolveHistoricalCatalogPick(
  historical: HistoricalCatalog,
  requestedProductId: string,
  requestedRoleCode: string,
  isCurrentlyUnselectable: (productId: string) => boolean,
  canonicalRoleCode: RoleCodeCanonicalizer,
): HistoricalPickResult {
  const roleCode = canonicalRoleCode(requestedRoleCode)
  const row = historical.productById.get(requestedProductId)
  if (!row) {
    return { ok: false, code: 'unknown_product', productId: requestedProductId, roleCode }
  }
  const knownRole = [...historical.roleByCode.keys()].some(
    (candidate) => canonicalRoleCode(candidate) === roleCode,
  )
  if (!knownRole) {
    return { ok: false, code: 'unknown_role', productId: requestedProductId, roleCode }
  }
  const carriesRole = (historical.rolesByProductId.get(requestedProductId) ?? []).some(
    (link) => canonicalRoleCode(link.roleCode) === roleCode,
  )
  if (!carriesRole) {
    return { ok: false, code: 'product_role_mismatch', productId: requestedProductId, roleCode }
  }
  // Current governance, on purpose. Everything above reconstructs what was; this asks whether the
  // programme still permits it on a card today.
  if (isCurrentlyUnselectable(requestedProductId)) {
    return { ok: false, code: 'product_not_slottable', productId: requestedProductId, roleCode }
  }
  return { ok: true, pick: historicalProductToPick(row, roleCode) }
}

export type HistoricalFamilyPickErrorCode = 'family_members_unavailable'

export type HistoricalFamilyPickResult =
  | { ok: true; pick: FamilyPick }
  | { ok: false; code: HistoricalFamilyPickErrorCode; message: string }

/**
 * Rebuild a family pick from a frozen membership and the catalog release it was reviewed against.
 *
 * Deliberately *not* filtered by current governance, unlike a single product pick. The membership
 * is frozen and the card is asking the room for that line; silently dropping a member because the
 * programme later withdrew it would shrink the variant count and the printed size span, changing
 * what the card says without anything on the card having moved. Whether a withdrawn member should
 * change a saved card is a reconciliation question with its own review, and reconciliation is
 * explicitly not part of this phase.
 */
export function historicalFamilyPick(
  historical: HistoricalCatalog,
  version: ReviewedProductFamilyVersion,
  requestedRoleCode: string,
  canonicalRoleCode: RoleCodeCanonicalizer,
): HistoricalFamilyPickResult {
  const roleCode = canonicalRoleCode(requestedRoleCode)
  const rows = version.memberProductIds.map((productId) => historical.productById.get(productId))
  const missing = version.memberProductIds.filter((_, index) => !rows[index])
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'family_members_unavailable',
      message: `Product family ${version.productFamilyVersionId} names ${missing.length} member(s) that catalog release ${historical.catalogReleaseId} does not retain: ${missing.slice(0, 5).join(', ')}.`,
    }
  }
  const members = rows.filter((row): row is HistoricalProductRow => Boolean(row))

  const verificationInputs = members.map((row) => ({
    verification_grade: row.verificationGrade,
    visibility_state: row.visibilityState,
  }))
  const first = members[0]
  return {
    ok: true,
    pick: {
      productFamilyVersionId: version.productFamilyVersionId,
      productFamilyCode: version.productFamilyCode,
      catalogReleaseId: version.catalogReleaseId,
      definitionHash: version.definitionHash,
      roleCode,
      familyName: version.displayName,
      manufacturerDisplay: version.manufacturerDisplay,
      variantCount: members.length,
      specRanges: familySpecRanges(
        members.map((row) => ({
          diameterMm: row.diameterMm,
          lengthMm: row.lengthMm,
          frenchSize: row.frenchSize,
          gauge: row.gauge,
          workingLengthCm: row.workingLengthCm,
          minWorkingChannelMm: row.minWorkingChannelMm,
          deliverySystemOdMm: row.deliverySystemOdMm,
        })),
      ),
      // A line is only as confirmed as its least-confirmed size, exactly as the picker computes it.
      verificationTier: verificationInputs.every(
        (input) => catalogVerificationTier(input) === 'verified',
      )
        ? 'verified'
        : 'candidate',
      usStatusPending: verificationInputs.some(isUsStatusPending),
      sourceId: first.primarySourceId,
      sourceLocation: first.primarySourceLocation,
    },
  }
}
