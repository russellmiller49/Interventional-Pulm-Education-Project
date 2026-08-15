/**
 * Phase D2B market-status and safety overlay: controlled vocabularies, the conservative
 * mapping from the merged PR #105 research states, and the recommendation gate.
 *
 * Everything here is pure. The generator (`scripts/ip-device-intelligence/build-status-overlay.ts`)
 * and the runtime reader (`server/product-status.server.ts`) share these functions, so a
 * research state can never be mapped one way when the artifact is built and another way when
 * it is read.
 *
 * The owner policy this implements (decision D-07 as SUPERSEDED by D2B, 2026-08-15): market
 * status and safety actions are OVERLAYS on an atlas whose membership is decided by sourced
 * identity alone. Nothing in this file can remove a product from the atlas — the worst a
 * status can do is set the recommendation gate to `blocked_active_safety_action`, which
 * governs defaults and recommendations, never visibility.
 */

/** Controlled public market-status vocabulary. Never widened by free text. */
export const MARKET_STATUSES = [
  'confirmed_current_us',
  'likely_current_us',
  'current_status_unverified',
  'current_status_conflicted',
  'historical_or_discontinued',
  'not_applicable_noncommercial_or_local',
] as const
export type MarketStatus = (typeof MARKET_STATUSES)[number]

/** The research package's own confidence vocabulary, carried through verbatim. */
export const MARKET_CONFIDENCES = ['high', 'moderate', 'low'] as const
export type MarketConfidence = (typeof MARKET_CONFIDENCES)[number]

/** Controlled public safety-display vocabulary. */
export const SAFETY_DISPLAYS = [
  'active_safety_notice',
  'historical_safety_notice',
  'safety_identity_review_required',
  'safety_status_unverified',
  'no_exact_action_found_as_of_snapshot',
] as const
export type SafetyDisplay = (typeof SAFETY_DISPLAYS)[number]

/** Scope of a matched FDA safety action, verbatim from the research package. */
export const SAFETY_ACTION_SCOPES = [
  'lot_specific',
  'product_wide',
  'family_level',
  'unknown',
] as const
export type SafetyActionScope = (typeof SAFETY_ACTION_SCOPES)[number]

/**
 * The view-level status gate. It is ONLY a market/safety recommendation gate: it is not
 * proof of clinical compatibility, suitability, or availability, and it never affects
 * whether a product appears in the atlas.
 */
export const STATUS_RECOMMENDATION_GATES = [
  'clear',
  'review_required',
  'blocked_active_safety_action',
] as const
export type StatusRecommendationGate = (typeof STATUS_RECOMMENDATION_GATES)[number]

/**
 * Research states emitted by the merged PR #105 package
 * (`current-us-status-evidence-v1`). Listed so the mapping below is auditable against the
 * source vocabulary; unrecognized future states fall through to the conservative default.
 */
export const RESEARCH_STATES = [
  'current_us_distribution_supported',
  'not_currently_distributed_supported',
  'historically_authorized_current_status_unresolved',
  'current_status_conflicted',
  'identity_unresolved',
  'insufficient_evidence',
  'not_applicable_noncommercial_or_local',
] as const
export type ResearchState = (typeof RESEARCH_STATES)[number]

export const RESEARCH_SAFETY_ACTION_STATES = [
  'active_exact_product_action',
  'historical_exact_product_action',
  'family_or_ambiguous_action',
  'no_exact_action_found',
  'unknown',
] as const
export type ResearchSafetyActionState = (typeof RESEARCH_SAFETY_ACTION_STATES)[number]

export const RESEARCH_SAFETY_SEARCH_STATUSES = ['searched', 'not_searched', 'query_error'] as const
export type ResearchSafetySearchStatus = (typeof RESEARCH_SAFETY_SEARCH_STATUSES)[number]

/**
 * Conservative market-status mapping — conservative about what is CLAIMED, never about
 * whether the product appears.
 *
 * `identity_unresolved` deliberately maps to "not recently verified", not to any negative
 * statement: it means the research method could not tie an exact regulatory identity to the
 * catalog product, which says nothing about whether the catalog product has sourced
 * identity. It must never override the canonical `verified_source` inclusion decision.
 *
 * `current_us_distribution_supported` at LOW confidence is not asserted as current: the two
 * affirmative labels are reserved for high (confirmed) and moderate (likely).
 */
export function toMarketStatus(
  researchState: string,
  confidence: string | null | undefined,
): MarketStatus {
  switch (researchState) {
    case 'current_us_distribution_supported':
      if (confidence === 'high') return 'confirmed_current_us'
      if (confidence === 'moderate') return 'likely_current_us'
      return 'current_status_unverified'
    case 'current_status_conflicted':
      return 'current_status_conflicted'
    case 'not_currently_distributed_supported':
      return 'historical_or_discontinued'
    case 'not_applicable_noncommercial_or_local':
      return 'not_applicable_noncommercial_or_local'
    // historically_authorized_current_status_unresolved, identity_unresolved,
    // insufficient_evidence, and any state this method version does not know.
    default:
      return 'current_status_unverified'
  }
}

/**
 * Safety mapping. An incomplete search is never rendered as an absence of findings, and
 * "no exact action found" keeps its as-of-snapshot qualifier in its own name so no caller
 * can shorten it to "recall-free".
 */
export function toSafetyDisplay(
  searchStatus: string | null | undefined,
  actionState: string | null | undefined,
): SafetyDisplay {
  if (searchStatus !== 'searched') return 'safety_status_unverified'
  switch (actionState) {
    case 'active_exact_product_action':
      return 'active_safety_notice'
    case 'historical_exact_product_action':
      return 'historical_safety_notice'
    case 'family_or_ambiguous_action':
      return 'safety_identity_review_required'
    case 'no_exact_action_found':
      return 'no_exact_action_found_as_of_snapshot'
    default:
      return 'safety_status_unverified'
  }
}

export function toSafetyActionScope(scope: string | null | undefined): SafetyActionScope {
  return (SAFETY_ACTION_SCOPES as readonly string[]).includes(scope ?? '')
    ? (scope as SafetyActionScope)
    : 'unknown'
}

/**
 * The recommendation gate. Blocked and review-required products stay fully visible,
 * searchable, and role-listed; the gate exists so that no such product can become an
 * automatic default or a recommendation.
 */
export function toStatusRecommendationGate(
  marketStatus: MarketStatus,
  safetyDisplay: SafetyDisplay,
): StatusRecommendationGate {
  if (safetyDisplay === 'active_safety_notice') return 'blocked_active_safety_action'
  if (
    safetyDisplay === 'safety_identity_review_required' ||
    safetyDisplay === 'safety_status_unverified'
  ) {
    return 'review_required'
  }
  if (marketStatus === 'current_status_conflicted') return 'review_required'
  return 'clear'
}

/**
 * Recall numbers are carried only for EXACT product matches. A family-level or ambiguous
 * match is reported as `safety_identity_review_required` with no reference codes, because
 * printing a recall number beside a product whose identity did not match exactly would
 * assert something the research package explicitly did not establish.
 */
export function safetyDisplayCarriesReferenceCodes(safetyDisplay: SafetyDisplay): boolean {
  return safetyDisplay === 'active_safety_notice' || safetyDisplay === 'historical_safety_notice'
}

/**
 * True when the research package matched an FDA safety action of some kind — exactly, or at
 * family level. Only then does an action SCOPE exist to report; "no exact action found" and
 * "not verified" carry no scope at all, and must not be given one.
 */
export function safetyDisplayMatchedAnAction(safetyDisplay: SafetyDisplay): boolean {
  return (
    safetyDisplay === 'active_safety_notice' ||
    safetyDisplay === 'historical_safety_notice' ||
    safetyDisplay === 'safety_identity_review_required'
  )
}

/** The public status of one product, as read by every D2B surface. */
export interface ProductStatusView {
  /** True when the product has a row in the generated status overlay. */
  researched: boolean
  /** The research snapshot the row came from; null when the product has no row. */
  researchSnapshotDate: string | null
  marketStatus: MarketStatus
  marketConfidence: MarketConfidence | null
  safetyDisplay: SafetyDisplay
  safetyActionScope: SafetyActionScope | null
  /** FDA recall numbers for exact-product actions only. Sorted, deduplicated. */
  safetyReferenceCodes: string[]
  statusRecommendationGate: StatusRecommendationGate
}

/**
 * The honest default for a product with no status-overlay row — including every product the
 * 2026-08-13 research snapshot did not cover. It claims nothing: availability is not
 * verified, safety is not verified (never "safe"), and the gate follows the same mapping
 * every researched row uses.
 */
export const UNRESEARCHED_PRODUCT_STATUS: ProductStatusView = Object.freeze({
  researched: false,
  researchSnapshotDate: null,
  marketStatus: 'current_status_unverified',
  marketConfidence: null,
  safetyDisplay: 'safety_status_unverified',
  safetyActionScope: null,
  safetyReferenceCodes: Object.freeze([]) as unknown as string[],
  statusRecommendationGate: toStatusRecommendationGate(
    'current_status_unverified',
    'safety_status_unverified',
  ),
})

/**
 * Market statuses that may never be worded as "currently orderable". Only
 * `confirmed_current_us` carries an affirmative current-distribution statement, and even
 * that one is a distribution finding, not a statement about local stock or procurement.
 */
export function marketStatusAssertsCurrentDistribution(marketStatus: MarketStatus): boolean {
  return marketStatus === 'confirmed_current_us'
}

/**
 * Whether the card surfaces should show a safety badge at all (owner requirement: compact
 * cards, "safety badge only when material"). Unverified and no-exact-action-found states are
 * stated on the product-detail panel instead of badging every card in the atlas.
 */
export function safetyDisplayIsMaterialOnCards(safetyDisplay: SafetyDisplay): boolean {
  return (
    safetyDisplay === 'active_safety_notice' ||
    safetyDisplay === 'historical_safety_notice' ||
    safetyDisplay === 'safety_identity_review_required'
  )
}
