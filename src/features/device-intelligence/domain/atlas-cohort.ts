/**
 * The Phase D2B atlas cohort predicate — inclusion-first, decided by the physician owner on
 * 2026-08-15 and SUPERSEDING the Phase D1 predicate recorded under decision D-07 as
 * modified (2026-08-08).
 *
 * D1 required `verification_grade = verified_source` AND `visibility_state =
 * prototype_visible`. That second conjunct kept 578 adequately sourced products out of the
 * atlas because their CURRENT U.S. availability had not been conclusively established. The
 * owner's D2B decision is that for an educational catalog, false exclusion is the greater
 * harm:
 *
 *   "It is acceptable for a small number of legacy or no-longer-orderable products to appear
 *    and be corrected later. It is not acceptable for hundreds of adequately sourced products
 *    to remain absent merely because current availability has not been conclusively
 *    established."
 *
 * So sourced identity — and nothing else — decides atlas membership:
 *
 *   include ⟺ verification_grade = verified_source AND not explicitly excluded by the owner
 *
 * Current market status, discontinuation evidence, recall evidence, present orderability, a
 * live manufacturer page, a current FDA listing, and `visibility_state` are all OVERLAYS
 * (see `product-status.ts`): they change what a product's page SAYS, never whether it exists.
 * The one thing that can remove an otherwise-verified product is an explicit reviewed owner
 * exclusion for a data-quality defect (see `atlas-visibility-exclusions.ts`).
 *
 * `candidate` and `unknown` grade products remain outside Device Intelligence entirely: they
 * are absent from the atlas store (see `server/atlas-store.server.ts`), so no atlas query,
 * facet, related-product list, or direct product URL can reach them.
 *
 * `visibility_state` remains governed canonical data driving the preserved preference-card
 * dropdown/admin surfaces; D2B changes the Device Intelligence cohort policy only, and
 * writes nothing back to the catalog.
 */

import { isOwnerExcludedFromAtlas } from './atlas-visibility-exclusions'

/** Re-exported so existing callers keep one import site for the atlas id contract. */
export { PRODUCT_ID_PATTERN, isWellFormedProductId } from './product-id'

/** The one verification grade the D2B atlas admits. */
export const ATLAS_INCLUDED_VERIFICATION_GRADE = 'verified_source'

export interface AtlasCohortInput {
  product_id?: string | null
  verification_grade?: string | null
  /**
   * Read only so callers can keep passing whole catalog rows. D2B does NOT consult it: it is
   * governed preference-card data, not an atlas gate.
   */
  visibility_state?: string | null
}

export function isAtlasCohortProduct(product: AtlasCohortInput): boolean {
  if (product.verification_grade !== ATLAS_INCLUDED_VERIFICATION_GRADE) return false
  return !isOwnerExcludedFromAtlas(product.product_id)
}
