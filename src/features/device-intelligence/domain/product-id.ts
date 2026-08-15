/**
 * The permanent catalog product-id shape, in its own dependency-free module.
 *
 * Both the cohort predicate and the reviewed owner-exclusion overlay need it, and the
 * exclusion overlay validates itself at module load — so keeping the pattern here is what
 * stops an import cycle from evaluating the regex inside its temporal dead zone.
 */

export const PRODUCT_ID_PATTERN = /^PRD-[A-Z0-9]{6,20}$/

export function isWellFormedProductId(productId: string): boolean {
  return PRODUCT_ID_PATTERN.test(productId)
}
