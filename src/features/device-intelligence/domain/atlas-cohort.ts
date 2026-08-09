/**
 * The Phase D1 atlas cohort predicate, decided by the physician owner on 2026-08-08
 * (decision D-07 as modified): the device-intelligence atlas presents only products
 * satisfying `verification_grade = verified_source` AND `visibility_state =
 * prototype_visible`.
 *
 * Candidate-grade and hidden products are not filtered out cosmetically — they are absent
 * from the atlas store entirely (see `server/atlas-store.server.ts`), so no atlas query,
 * facet, related-product list, or direct product URL can reach them. The preserved
 * direct-link (public-unlisted) catalog and admin legacy surfaces are unchanged and may
 * still show them.
 */

export interface AtlasCohortInput {
  verification_grade?: string | null
  visibility_state?: string | null
}

export function isAtlasCohortProduct(product: AtlasCohortInput): boolean {
  return (
    product.verification_grade === 'verified_source' &&
    product.visibility_state === 'prototype_visible'
  )
}

/** The same permanent product-id shape the existing catalog product route enforces. */
export const PRODUCT_ID_PATTERN = /^PRD-[A-Z0-9]{6,20}$/

export function isWellFormedProductId(productId: string): boolean {
  return PRODUCT_ID_PATTERN.test(productId)
}
