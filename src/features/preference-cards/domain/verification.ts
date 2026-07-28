/**
 * Verification tiers for catalog products.
 *
 * The catalog carries two independent signals: `verification_grade` says whether a
 * primary source backs the specs, and `visibility_state` says whether the workbook
 * owner cleared the product for prototype dropdowns. A product can be sourced from a
 * manufacturer catalog yet still be hidden because its current U.S. market status has
 * not been confirmed — that combination gets its own flag rather than being collapsed
 * into "unverified".
 */

export type CatalogVerificationGrade = 'verified_source' | 'candidate' | 'unknown'
export type CatalogVisibilityState = 'prototype_visible' | 'hidden'
export type CatalogVerificationTier = 'verified' | 'candidate' | 'unknown'

export interface VerificationInput {
  verification_grade?: string | null
  visibility_state?: string | null
}

export function catalogVerificationTier(product: VerificationInput): CatalogVerificationTier {
  switch (product.verification_grade) {
    case 'verified_source':
      return 'verified'
    case 'candidate':
      return 'candidate'
    default:
      return 'unknown'
  }
}

/**
 * True when the specs trace to a manufacturer document but the product is still held
 * out of dropdowns pending confirmation of current U.S. availability.
 */
export function isUsStatusPending(product: VerificationInput): boolean {
  return product.visibility_state === 'hidden' && product.verification_grade === 'verified_source'
}

export function isCatalogVerified(product: VerificationInput): boolean {
  return catalogVerificationTier(product) === 'verified'
}
