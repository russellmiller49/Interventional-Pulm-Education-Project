import type { RoleCodeCanonicalizer } from './role-taxonomy'
import { stableSnapshotHash } from './stable-hash'

/**
 * Two different things have been called a "product family", and a card may only persist one of
 * them.
 *
 * **Discovery families** are a catalog-browsing convenience. `decorateProduct` computes a
 * `familyKey` of `manufacturerGroup | familyName | productKind`, where `familyName` is
 * `brand_family` if the catalog records one, otherwise `subcategory`, otherwise the product name.
 * That is a good grouping for a picker with 105 silicone stents in it. It is a terrible identity,
 * because it is recomputed from mutable labels on every request, and the fallbacks over-merge.
 * Two grouping failures are already in the current catalog and are the reason this module exists:
 *
 * - **BD Safe-T-Centesis.** `PIG1260TSP` and `PIG1280TSP` are two sizes of the same PLUS tray, but
 *   only one of them carries a `subcategory`. With `brand_family` empty, one falls back to its
 *   product name and the other to "Thoracentesis Catheter" — so the two sizes of one tray land in
 *   *different* families, and the one that fell back to the subcategory merges with every other BD
 *   thoracentesis catheter, including the 6 Fr tray.
 * - **Argyle chest tubes.** Eight straight PVC thoracic catheters from 16 Fr to 40 Fr, plus a
 *   right-angle 28 Fr, all share `subcategory: "Surgical Chest Tube"` with no `brand_family`, so
 *   the grouping merges a 16 Fr straight tube with a 40 Fr one and with a right-angle. And because
 *   none of them records `french_size`, the "line stocked across …" wording a family pick prints
 *   would come out empty — a card promising a size range it cannot name.
 *
 * A card that persisted either of those as "the family, size at time of procedure" would be
 * asking the room for something nobody defined.
 *
 * **Reviewed family versions** are the persistable identity. Membership is an explicit list of
 * product ids, pinned to the catalog release it was reviewed against, hashed, and immutable once
 * published. Nothing about a reviewed family is recomputed from a label at save or reopen time; a
 * saved card names a `productFamilyVersionId` and the exact member list comes back, or the card
 * reports that it cannot be reconstructed.
 *
 * Splitting a family that turns out to be wrong produces *new* versions, or new codes. It never
 * rewrites the old version, because the old version is what somebody's card is pinned to.
 */

/** Bumped when the *meaning* of a family definition hash changes. Carried inside every hash. */
export const PRODUCT_FAMILY_HASH_VERSION = 'ip-cards-product-family/1'

export const PRODUCT_FAMILY_FORMAT_VERSION = '1.0'

/**
 * A catalog-explorer grouping and nothing more.
 *
 * Named `discoveryKey` rather than `familyKey` on purpose: the two are the same string today, and
 * the rename is what makes it impossible to pass one where a persistable identity is required
 * without noticing.
 */
export interface DiscoveryProductFamily {
  discoveryKey: string
  displayName: string
  manufacturerDisplay: string
  manufacturerGroupId: string
  variantCount: number
  /**
   * The reviewed family version this grouping corresponds to for a given role, when one exists
   * and is selectable. Null means catalog browsing only — the picker offers the individual
   * products and withholds the whole-line action.
   */
  reviewedFamilyVersionId: string | null
}

export type ProductFamilyGovernanceState = 'draft' | 'approved' | 'retired'

/**
 * The reviewed, versioned, persistable identity of a product line.
 *
 * `roleCodes` is part of the identity rather than a filter applied afterwards. The same brand
 * family legitimately serves more than one requirement — Novatech's GSS line appears under both
 * `AIRWAY_STENT_SILICONE_STRAIGHT` and `AIRWAY_STENT_SILICONE_Y`, and those are different devices
 * with different members — so a family version that did not name its roles would be two families
 * wearing one id.
 */
export interface ReviewedProductFamilyVersion {
  productFamilyVersionId: string
  productFamilyCode: string
  version: string
  /** The catalog release the membership below was reviewed against, and is only true of. */
  catalogReleaseId: string
  roleCodes: string[]
  displayName: string
  manufacturerGroupId: string
  manufacturerDisplay: string
  /** Explicit and complete. Never a predicate, never a label match, never inferred at read time. */
  memberProductIds: string[]
  governanceState: ProductFamilyGovernanceState
  supersedesProductFamilyVersionId: string | null
  /**
   * What a reviewer looked at. Free text, always present, and deliberately not a controlled
   * vocabulary — the point is that a human can read it and judge whether the membership below was
   * actually reviewed or merely computed.
   */
  reviewBasis: string
  approvedAt: string | null
  retiredAt: string | null
  definitionHash: string
}

export interface ProductFamilyLedger {
  formatVersion: string
  hashVersion: string
  versions: ReviewedProductFamilyVersion[]
}

export function emptyProductFamilyLedger(): ProductFamilyLedger {
  return {
    formatVersion: PRODUCT_FAMILY_FORMAT_VERSION,
    hashVersion: PRODUCT_FAMILY_HASH_VERSION,
    versions: [],
  }
}

/**
 * What the definition hash covers.
 *
 * Everything that decides *which products a card is asking for*: the identity, the catalog
 * release the membership is true of, the roles, and the members themselves. Lifecycle metadata is
 * excluded for the same reason a release bundle excludes `releaseState` — approving or retiring a
 * family must not be indistinguishable from editing it.
 */
export function productFamilyDefinitionHash(
  version: Omit<ReviewedProductFamilyVersion, 'definitionHash'>,
): string {
  return stableSnapshotHash({
    v: PRODUCT_FAMILY_HASH_VERSION,
    kind: 'product-family-version',
    payload: {
      productFamilyVersionId: version.productFamilyVersionId,
      productFamilyCode: version.productFamilyCode,
      version: version.version,
      catalogReleaseId: version.catalogReleaseId,
      roleCodes: [...version.roleCodes].sort(),
      displayName: version.displayName,
      manufacturerGroupId: version.manufacturerGroupId,
      manufacturerDisplay: version.manufacturerDisplay,
      memberProductIds: [...version.memberProductIds].sort(),
      supersedesProductFamilyVersionId: version.supersedesProductFamilyVersionId,
    },
  })
}

/** The lifecycle fields deliberately outside the definition hash, recorded as reviewable data. */
export const PRODUCT_FAMILY_HASH_EXCLUSIONS: Readonly<Record<string, string>> = {
  governanceState:
    'Approving and retiring are lifecycle acts, not membership edits. A retired family must keep the hash it was approved with, or retiring it would be indistinguishable from changing who is in it.',
  approvedAt: 'Lifecycle metadata. Same reason as governanceState.',
  retiredAt: 'Lifecycle metadata. Same reason as governanceState.',
  reviewBasis:
    'Prose describing what a reviewer read. Recording better provenance for the same membership must not read as a membership change.',
}

export function computeReviewedProductFamilyVersion(
  version: Omit<ReviewedProductFamilyVersion, 'definitionHash'>,
): ReviewedProductFamilyVersion {
  const normalized = {
    ...version,
    roleCodes: [...version.roleCodes].sort(),
    memberProductIds: [...version.memberProductIds].sort(),
  }
  return { ...normalized, definitionHash: productFamilyDefinitionHash(normalized) }
}

export type ProductFamilyValidationCode =
  | 'product_family_duplicate_version'
  | 'product_family_definition_mutated'
  | 'product_family_empty_membership'
  | 'product_family_member_not_in_catalog_release'
  | 'product_family_member_role_mismatch'
  | 'product_family_supersedes_missing'
  | 'product_family_supersedes_code_mismatch'
  | 'product_family_approved_without_review_basis'
  | 'product_family_membership_diverged'
  | 'product_family_retired_without_timestamp'

export interface ProductFamilyValidationMessage {
  code: ProductFamilyValidationCode
  severity: 'blocking' | 'warning'
  productFamilyVersionId: string
  message: string
}

export interface ProductFamilyValidationInput {
  ledger: ProductFamilyLedger
  /**
   * Membership as the current catalog release re-derives it, keyed by family version id. A
   * version absent here is one whose catalog release is no longer current, which is normal and
   * expected for a historical family; a version present here whose membership disagrees is a
   * published family the catalog has moved underneath, which is reported rather than absorbed.
   */
  rederivedMembership?: ReadonlyMap<string, string[]>
  /** Product ids and role mappings the family's own catalog release retained, for membership checks. */
  catalogReleaseMembership?: ReadonlyMap<
    string,
    { productIds: ReadonlySet<string>; rolesByProductId: ReadonlyMap<string, ReadonlySet<string>> }
  >
}

/**
 * Every way the reviewed family set can be wrong.
 *
 * The membership checks run against the family's *own* catalog release rather than the current
 * one. That is the whole point: a family approved against catalog release C names products that
 * existed in C, and checking it against today's catalog would fail a perfectly valid historical
 * family the moment a product was discontinued.
 */
export function validateProductFamilyLedger(
  input: ProductFamilyValidationInput,
): ProductFamilyValidationMessage[] {
  const messages: ProductFamilyValidationMessage[] = []
  const byId = new Map<string, ReviewedProductFamilyVersion>()

  for (const version of input.ledger.versions) {
    if (byId.has(version.productFamilyVersionId)) {
      messages.push({
        code: 'product_family_duplicate_version',
        severity: 'blocking',
        productFamilyVersionId: version.productFamilyVersionId,
        message: `Product family version ${version.productFamilyVersionId} is recorded more than once. A family version id must identify exactly one frozen membership.`,
      })
      continue
    }
    byId.set(version.productFamilyVersionId, version)

    const recomputed = productFamilyDefinitionHash(version)
    if (recomputed !== version.definitionHash) {
      messages.push({
        code: 'product_family_definition_mutated',
        severity: 'blocking',
        productFamilyVersionId: version.productFamilyVersionId,
        message: `Product family version ${version.productFamilyVersionId} no longer hashes to what it recorded (${version.definitionHash} → ${recomputed}). A published family version is immutable: split it into a new version rather than editing this one.`,
      })
    }

    if (version.memberProductIds.length === 0) {
      messages.push({
        code: 'product_family_empty_membership',
        severity: 'blocking',
        productFamilyVersionId: version.productFamilyVersionId,
        message: `Product family version ${version.productFamilyVersionId} has no members. A family with no members cannot be what a card is asking the room for.`,
      })
    }

    if (version.governanceState === 'approved' && version.reviewBasis.trim().length === 0) {
      messages.push({
        code: 'product_family_approved_without_review_basis',
        severity: 'blocking',
        productFamilyVersionId: version.productFamilyVersionId,
        message: `Product family version ${version.productFamilyVersionId} is approved but records no review basis. Approval is a claim that somebody looked at the membership; the file has to say what they looked at.`,
      })
    }

    if (version.governanceState === 'retired' && !version.retiredAt) {
      messages.push({
        code: 'product_family_retired_without_timestamp',
        severity: 'blocking',
        productFamilyVersionId: version.productFamilyVersionId,
        message: `Product family version ${version.productFamilyVersionId} is retired but records no retirement timestamp.`,
      })
    }

    const release = input.catalogReleaseMembership?.get(version.catalogReleaseId)
    if (release) {
      const absent = version.memberProductIds.filter(
        (productId) => !release.productIds.has(productId),
      )
      if (absent.length > 0) {
        messages.push({
          code: 'product_family_member_not_in_catalog_release',
          severity: 'blocking',
          productFamilyVersionId: version.productFamilyVersionId,
          message: `Product family version ${version.productFamilyVersionId} names ${absent.length} member(s) that catalog release ${version.catalogReleaseId} does not retain: ${absent.slice(0, 5).join(', ')}.`,
        })
      }
      const roleCodes = new Set(version.roleCodes)
      const mismatched = version.memberProductIds.filter((productId) => {
        const roles = release.rolesByProductId.get(productId)
        return roles ? ![...roleCodes].some((roleCode) => roles.has(roleCode)) : false
      })
      if (mismatched.length > 0) {
        messages.push({
          code: 'product_family_member_role_mismatch',
          severity: 'blocking',
          productFamilyVersionId: version.productFamilyVersionId,
          message: `Product family version ${version.productFamilyVersionId} names ${mismatched.length} member(s) that catalog release ${version.catalogReleaseId} does not map to any of its roles: ${mismatched.slice(0, 5).join(', ')}.`,
        })
      }
    }

    const rederived = input.rederivedMembership?.get(version.productFamilyVersionId)
    if (rederived) {
      const before = [...version.memberProductIds].sort().join(',')
      const after = [...rederived].sort().join(',')
      if (before !== after) {
        messages.push({
          code: 'product_family_membership_diverged',
          severity: 'blocking',
          productFamilyVersionId: version.productFamilyVersionId,
          message: `Product family version ${version.productFamilyVersionId} was published with ${version.memberProductIds.length} member(s) and the current catalog now derives ${rederived.length}. Publish a new family version rather than changing a published one.`,
        })
      }
    }
  }

  for (const version of byId.values()) {
    if (!version.supersedesProductFamilyVersionId) continue
    const superseded = byId.get(version.supersedesProductFamilyVersionId)
    if (!superseded) {
      messages.push({
        code: 'product_family_supersedes_missing',
        severity: 'blocking',
        productFamilyVersionId: version.productFamilyVersionId,
        message: `Product family version ${version.productFamilyVersionId} supersedes ${version.supersedesProductFamilyVersionId}, which is not retained. A superseded family version stays available so the cards pinned to it can still be reconstructed.`,
      })
      continue
    }
    if (superseded.productFamilyCode !== version.productFamilyCode) {
      messages.push({
        code: 'product_family_supersedes_code_mismatch',
        severity: 'blocking',
        productFamilyVersionId: version.productFamilyVersionId,
        message: `Product family version ${version.productFamilyVersionId} (${version.productFamilyCode}) supersedes ${superseded.productFamilyVersionId}, which belongs to ${superseded.productFamilyCode}. Splitting a family creates a new code; it does not re-point an existing one.`,
      })
    }
  }

  return messages
}

/**
 * The persisted pin: everything a saved card records about a family selection.
 *
 * Four fields rather than one, because each of them can independently be wrong in a way the
 * others would not catch. The version id says which family; the catalog release says which
 * catalog its membership is true of; the definition hash says the membership has not moved since;
 * and the role code says which requirement it was chosen for.
 */
export interface ReviewedProductFamilyPin {
  productFamilyVersionId: string
  catalogReleaseId: string
  definitionHash: string
  roleCode: string
}

export type ProductFamilyResolutionErrorCode =
  | 'product_family_unknown'
  | 'product_family_unpublished'
  | 'product_family_definition_mutated'
  | 'product_family_catalog_release_mismatch'
  | 'product_family_role_not_covered'
  | 'product_family_not_selectable'

export type ProductFamilyResolutionResult =
  | { ok: true; version: ReviewedProductFamilyVersion }
  | { ok: false; code: ProductFamilyResolutionErrorCode; message: string }

/**
 * Resolve a pinned family for reconstruction, verifying every part of the pin.
 *
 * Draft and retired are treated asymmetrically, and the asymmetry is the whole rule:
 *
 * - **Retired resolves.** Retirement governs what a *new* card may select. A card already pinned to
 *   a retired family must still reconstruct, or "retired but retained" would mean nothing. What a
 *   new card may select is decided one step earlier, by which families the picker is offered at
 *   all — `getApprovedProductFamiliesForRole`, which filters through
 *   `assertProductFamilySelectableForNewCard`.
 * - **Draft does not.** A draft family has never been selectable, so no stored card can contain
 *   one. A pin naming a draft is therefore not a historical card being reconstructed — it is a
 *   request naming a membership no reviewer has approved, and accepting it would put an
 *   unreviewed clinical grouping on a card through the one door that bypasses the picker.
 *
 * That door matters: the picker withholding a control has never been a security boundary here, and
 * a save-time caller is untrusted.
 */
export function resolveReviewedProductFamily(
  pin: ReviewedProductFamilyPin,
  versionsById: ReadonlyMap<string, ReviewedProductFamilyVersion>,
  /**
   * The alias table of the release this pin is being reconstructed under — required so a live
   * alias added after the family was reviewed cannot re-aim which requirement it serves (P92-C1).
   */
  canonicalRoleCode: RoleCodeCanonicalizer,
): ProductFamilyResolutionResult {
  const version = versionsById.get(pin.productFamilyVersionId)
  if (!version) {
    return {
      ok: false,
      code: 'product_family_unknown',
      message: `This card selects product family ${pin.productFamilyVersionId}, which is no longer retained.`,
    }
  }
  if (version.governanceState === 'draft') {
    return {
      ok: false,
      code: 'product_family_unpublished',
      message: `Product family ${version.productFamilyVersionId} is a draft awaiting clinical review and cannot back a card selection. Its identity and membership are retained; only approval is missing.`,
    }
  }
  if (version.definitionHash !== pin.definitionHash) {
    return {
      ok: false,
      code: 'product_family_definition_mutated',
      message: `Product family ${pin.productFamilyVersionId} no longer has the membership this card selected (${pin.definitionHash} → ${version.definitionHash}).`,
    }
  }
  if (version.catalogReleaseId !== pin.catalogReleaseId) {
    return {
      ok: false,
      code: 'product_family_catalog_release_mismatch',
      message: `Product family ${pin.productFamilyVersionId} was reviewed against catalog release ${version.catalogReleaseId}; this card records ${pin.catalogReleaseId}.`,
    }
  }
  // Canonicalized on both sides: a family approved before a role rename records the old code, and
  // aliases are permanent precisely so a saved card that names either one still matches.
  const wantedRoleCode = canonicalRoleCode(pin.roleCode)
  if (!version.roleCodes.some((roleCode) => canonicalRoleCode(roleCode) === wantedRoleCode)) {
    return {
      ok: false,
      code: 'product_family_role_not_covered',
      message: `Product family ${pin.productFamilyVersionId} does not serve role ${pin.roleCode}.`,
    }
  }
  return { ok: true, version }
}

/** Whether a family version may back a *new* card selection. Only approved ones may. */
export function assertProductFamilySelectableForNewCard(
  version: ReviewedProductFamilyVersion,
): { ok: true } | { ok: false; code: 'product_family_not_selectable'; message: string } {
  if (version.governanceState === 'approved') return { ok: true }
  return {
    ok: false,
    code: 'product_family_not_selectable',
    message:
      version.governanceState === 'retired'
        ? `Product family ${version.productFamilyVersionId} is retired. It remains available for the cards already pinned to it and cannot be used for a new one.`
        : `Product family ${version.productFamilyVersionId} is a draft. Only an approved family may be selected as "size at time of procedure".`,
  }
}

/**
 * Why a legacy family selection cannot be carried forward, as a first-class outcome.
 *
 * A version-3 card records `{ familyKey, roleCode }` and nothing else. `familyKey` is the
 * discovery grouping — a string built from mutable labels — so mapping one onto a reviewed family
 * would be a guess dressed up as a lookup, and it would be a guess about which products a
 * physician is asking the room for. There is no manufacturer-plus-role match here, no label
 * similarity, and no "closest family": the card stays viewable and printable from its snapshot,
 * and the builder says why it will not reopen it.
 */
export const LEGACY_FAMILY_IDENTITY_MESSAGE =
  'This card records a product line by a catalog-browsing key rather than a reviewed family. ' +
  'Reopening it would mean guessing which products that key stands for today, so the card is ' +
  'shown exactly as it was saved instead.'
