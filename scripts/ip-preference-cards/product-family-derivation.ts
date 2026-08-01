import {
  computeReviewedProductFamilyVersion,
  type ProductFamilyGovernanceState,
  type ReviewedProductFamilyVersion,
} from '../../src/features/preference-cards/domain/product-family'
import type {
  CatalogProductRecord,
  ProductRoleRecord,
} from '../../src/features/preference-cards/server/catalog-store'
import { canonicalManufacturer } from '../../src/features/preference-cards/server/manufacturer-aliases'

/**
 * Materializing a reviewed family's membership from the catalog, once, at build time.
 *
 * The distinction that makes this legitimate rather than a rebranded `familyKey`: a discovery
 * grouping is recomputed from labels on *every request*, so what a saved card means changes when a
 * subcategory is edited. This runs once, writes an explicit member list, and freezes it under a
 * definition hash. After that the list is data — nothing re-derives it to answer a card, and a
 * later re-derivation that disagrees is a build failure rather than a silent correction.
 *
 * The seed says *which* families are reviewed and what the reviewer looked at. It does not carry
 * three hundred product ids by hand, because a hand-copied membership list is a claim nothing
 * checks; it carries the identity, the authoritative basis, and the member count the reviewer
 * counted, and this derives the ids and refuses to proceed when the count disagrees.
 */

export interface SeedProductFamilyMembership {
  /** Canonical manufacturer group, matching `canonicalManufacturer`. */
  manufacturerGroupId: string
  /**
   * The manufacturer's own product-line name, as authored in the catalog's `brand_family` column.
   * Matched exactly after trimming — never by prefix, similarity, or normalization, because every
   * loosening of this match is a way for an unrelated product to join a clinical family.
   */
  brandFamily: string
  roleCodes: string[]
  /**
   * How many products the reviewer counted. A mismatch fails the build: a line that gains a size
   * is a real event, and the right response is a reviewed new family version, not a member list
   * that quietly grew.
   */
  expectedMemberCount: number
}

export interface SeedProductFamily {
  productFamilyCode: string
  version: string
  displayName: string
  manufacturerDisplay: string
  governanceState: ProductFamilyGovernanceState
  approvedAt: string | null
  retiredAt: string | null
  supersedesProductFamilyVersionId: string | null
  reviewBasis: string
  membership: SeedProductFamilyMembership
  /** The catalog release the membership is true of. Required once approved or retired. */
  catalogReleaseId?: string
  /** Frozen at approval, exactly as a release bundle's hash is. Forbidden while a draft. */
  definitionHash?: string
}

export interface SeedProductFamilyFile {
  formatVersion: string
  families: SeedProductFamily[]
}

/** `NOVATECH_DUMON_TD__AIRWAY_STENT_SILICONE_STRAIGHT` + `1.0` → a stable, readable version id. */
export function productFamilyVersionIdFor(productFamilyCode: string, version: string): string {
  const code = productFamilyCode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `family-${code}-v${version.replace(/\./g, '-')}`
}

export interface ProductFamilyDerivationInput {
  seed: SeedProductFamily
  catalogReleaseId: string
  products: CatalogProductRecord[]
  productRoles: ProductRoleRecord[]
  /** Products reviewed governance holds out of preference-card selection, by id. */
  unselectableProductIds: ReadonlySet<string>
}

export type ProductFamilyDerivationResult =
  | { ok: true; version: ReviewedProductFamilyVersion }
  | { ok: false; message: string }

export function deriveReviewedProductFamilyVersion(
  input: ProductFamilyDerivationInput,
): ProductFamilyDerivationResult {
  const { seed } = input
  const productFamilyVersionId = productFamilyVersionIdFor(seed.productFamilyCode, seed.version)
  const roleCodes = new Set(seed.membership.roleCodes)

  const productIdsInRole = new Set(
    input.productRoles
      .filter((link) => roleCodes.has(link.role_code))
      .map((link) => link.product_id),
  )

  const members = input.products.filter((product) => {
    if (!productIdsInRole.has(product.product_id)) return false
    if (input.unselectableProductIds.has(product.product_id)) return false
    if ((product.brand_family ?? '').trim() !== seed.membership.brandFamily) return false
    const identity = canonicalManufacturer(product.manufacturer_id, product.manufacturer)
    return identity.manufacturerGroupId === seed.membership.manufacturerGroupId
  })

  if (members.length !== seed.membership.expectedMemberCount) {
    return {
      ok: false,
      message: `Product family ${productFamilyVersionId} was reviewed with ${seed.membership.expectedMemberCount} member(s) and the catalog now yields ${members.length}. Publish a new family version rather than letting a reviewed membership drift.`,
    }
  }

  return {
    ok: true,
    version: computeReviewedProductFamilyVersion({
      productFamilyVersionId,
      productFamilyCode: seed.productFamilyCode,
      version: seed.version,
      catalogReleaseId: input.catalogReleaseId,
      roleCodes: [...roleCodes],
      displayName: seed.displayName,
      manufacturerGroupId: seed.membership.manufacturerGroupId,
      manufacturerDisplay: seed.manufacturerDisplay,
      memberProductIds: members.map((product) => product.product_id),
      governanceState: seed.governanceState,
      supersedesProductFamilyVersionId: seed.supersedesProductFamilyVersionId,
      reviewBasis: seed.reviewBasis,
      approvedAt: seed.approvedAt,
      retiredAt: seed.retiredAt,
    }),
  }
}
