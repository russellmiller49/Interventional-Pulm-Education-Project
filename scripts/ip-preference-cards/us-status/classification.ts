/**
 * Pure current-U.S.-status proposal classification.
 *
 * This module deliberately does not read files, call external services, or apply catalog
 * changes. It keeps each evidence layer independent and returns only a research proposal for
 * later human review.
 */

export const US_STATUS_RESEARCH_STATES = [
  'current_us_distribution_supported',
  'not_currently_distributed_supported',
  'historically_authorized_current_status_unresolved',
  'current_status_conflicted',
  'identity_unresolved',
  'insufficient_evidence',
  'not_applicable_noncommercial_or_local',
] as const

export type UsStatusResearchState = (typeof US_STATUS_RESEARCH_STATES)[number]

export const US_STATUS_CONFIDENCE_VALUES = ['high', 'moderate', 'low'] as const

export type UsStatusConfidence = (typeof US_STATUS_CONFIDENCE_VALUES)[number]

export const US_STATUS_REVIEW_DISPOSITIONS = [
  'review_for_prototype_visibility',
  'keep_hidden_conflicting',
  'keep_hidden_identity_unresolved',
  'keep_hidden_insufficient_evidence',
  'keep_hidden_pending_active_safety_action_review',
  'keep_hidden_pending_safety_review',
  'review_as_not_currently_distributed',
  'review_as_noncommercial_or_local',
] as const

export type UsStatusReviewDisposition = (typeof US_STATUS_REVIEW_DISPOSITIONS)[number]

export const EXACT_IDENTITY_MATCH_METHODS = [
  'exact_primary_di_or_gtin',
  'exact_manufacturer_catalog_number',
  'exact_manufacturer_model_number',
  'exact_manufacturer_reference_number',
  'reviewed_manufacturer_alias_exact_identifier',
] as const

export type ExactIdentityMatchMethod = (typeof EXACT_IDENTITY_MATCH_METHODS)[number]
export type IdentityMatchMethod = ExactIdentityMatchMethod | 'family_or_name_only' | 'none'

export interface IdentityEvidence {
  match_method: IdentityMatchMethod
  /** True when competing manufacturer, model, or identifier evidence prevents an exact tie. */
  conflict: boolean
}

export type UdiConfigurationDistributionStatus =
  | 'in_distribution'
  | 'not_in_distribution'
  | 'unknown'

export interface UdiConfigurationEvidence {
  configuration_id: string
  identifier_type: 'primary' | 'package' | 'unit_of_use' | 'other'
  exact_identity: boolean
  distribution_status: UdiConfigurationDistributionStatus
}

export interface UdiDistributionEvidence {
  search_completed: boolean
  snapshot_current: boolean
  all_exact_configurations_retrieved: boolean
  configurations: readonly UdiConfigurationEvidence[]
}

export interface RegistrationListingEvidence {
  search_completed: boolean
  snapshot_current: boolean
  match_scope: 'exact_product' | 'family_or_proprietary_name' | 'none'
  listing_status: 'current' | 'inactive' | 'unknown'
  establishment_registration_current: boolean | null
  conflict: boolean
}

export const AUTHORIZATION_FINDINGS = [
  'exact_510k_clearance',
  'exact_pma_approval',
  'exact_de_novo_grant',
  'exact_hde_approval',
  'family_level_authorization',
  'premarket_exempt',
  'unresolved',
  'not_found',
  'not_searched',
] as const

export type AuthorizationFinding = (typeof AUTHORIZATION_FINDINGS)[number]

export interface AuthorizationEvidence {
  search_completed: boolean
  finding: AuthorizationFinding
}

export const MANUFACTURER_FINDINGS = [
  'current_exact_official_us_product',
  'exact_official_discontinuation',
  'family_only_current',
  'current_non_us',
  'conflicting',
  'no_result',
  'not_searched',
] as const

export type ManufacturerFinding = (typeof MANUFACTURER_FINDINGS)[number]

export interface ManufacturerEvidence {
  search_completed: boolean
  finding: ManufacturerFinding
}

/**
 * Safety-action evidence is a separate axis from market distribution.
 *
 * An FDA safety action never establishes that a product is discontinued, and it never
 * establishes that a product is currently distributed. It is therefore excluded from the
 * distribution classification (`recall_excluded_from_distribution`) while still being able to
 * hold ordinary prototype-visibility review until a physician/governance safety review occurs.
 */
export const SAFETY_SEARCH_STATUSES = ['searched', 'not_searched', 'query_error'] as const

export type SafetySearchStatus = (typeof SAFETY_SEARCH_STATUSES)[number]

export const SAFETY_ACTION_STATES = [
  'active_exact_product_action',
  'historical_exact_product_action',
  'family_or_ambiguous_action',
  'no_exact_action_found',
  'unknown',
] as const

export type SafetyActionState = (typeof SAFETY_ACTION_STATES)[number]

export const SAFETY_ACTION_SCOPES = [
  'lot_specific',
  'product_wide',
  'family_level',
  'unknown',
] as const

export type SafetyActionScope = (typeof SAFETY_ACTION_SCOPES)[number]

export const VISIBILITY_REVIEW_ELIGIBILITIES = [
  'eligible_for_owner_review',
  'hold_active_safety_action',
  'hold_safety_search_incomplete',
  'hold_safety_identity_ambiguous',
  'not_applicable',
] as const

export type VisibilityReviewEligibility = (typeof VISIBILITY_REVIEW_ELIGIBILITIES)[number]

export interface SafetyActionEvidence {
  search_status: SafetySearchStatus
  action_state: SafetyActionState
  action_scope: SafetyActionScope
  /** Every exact-identity safety record carries the source IDs needed to re-verify it. */
  exact_action_sources_traceable: boolean
}

export const SAFETY_REVIEW_GATE_FAILURES = [
  'active_exact_safety_action_present',
  'safety_action_identity_ambiguous',
  'safety_action_source_traceability_incomplete',
  'safety_search_not_performed',
  'safety_search_query_error',
] as const

export type SafetyReviewGateFailure = (typeof SAFETY_REVIEW_GATE_FAILURES)[number]

/**
 * The mandatory safety gate for a positive or negative owner-review disposition.
 *
 * It is deliberately separate from {@link HighConfidenceInvariantAudit}: the distribution audit
 * must stay blind to safety evidence, otherwise a recall would drive the distribution
 * classification, which `recall_excluded_from_distribution` forbids. Both gates must pass before
 * a product is offered to a human reviewer as an ordinary visibility candidate.
 */
export interface SafetyReviewGate {
  performed: boolean
  eligibility: VisibilityReviewEligibility
  failures: SafetyReviewGateFailure[]
}

export interface ExplicitConflictEvidence {
  model: boolean
  manufacturer: boolean
  distribution: boolean
  discontinuation: boolean
}

/**
 * Inputs to the independent high-confidence audit. These checks intentionally overlap the
 * primary classifier: a provisional positive or negative must survive a second, explicit gate.
 */
export interface IndependentInvariantEvidence {
  adjacent_sku_excluded: boolean
  exact_configuration_inventory_complete: boolean
  package_levels_distinguished: boolean
  evidence_packet_complete: boolean
  all_sources_traceable: boolean
  registration_authorization_separated: boolean
  recall_excluded_from_distribution: boolean
}

export interface UsStatusClassificationInput {
  identity: IdentityEvidence
  udi_distribution: UdiDistributionEvidence
  registration_listing: RegistrationListingEvidence
  authorization: AuthorizationEvidence
  manufacturer: ManufacturerEvidence
  safety_action: SafetyActionEvidence
  conflicts: ExplicitConflictEvidence
  independent_invariants: IndependentInvariantEvidence
  explicitly_noncommercial_or_local: boolean
}

export type UdiDistributionAssessment =
  | 'all_exact_configurations_active'
  | 'all_exact_configurations_ended'
  | 'conflicting_exact_configuration_statuses'
  | 'exact_configuration_status_unknown'
  | 'no_exact_result'
  | 'search_incomplete'
  | 'stale_snapshot'
  | 'exact_configuration_inventory_incomplete'

export type RegistrationListingAssessment =
  | 'exact_current_listing'
  | 'exact_inactive_listing'
  | 'family_current_listing'
  | 'no_result'
  | 'unresolved'
  | 'conflicting'
  | 'search_incomplete'
  | 'stale_snapshot'

export interface UsStatusLayerAssessments {
  identity: 'exact' | 'family_or_name_only' | 'none'
  udi_distribution: UdiDistributionAssessment
  registration_listing: RegistrationListingAssessment
  authorization: AuthorizationFinding
  manufacturer: ManufacturerFinding
  safety_action: SafetyActionState
}

export const HIGH_CONFIDENCE_INVARIANT_FAILURES = [
  'identity_match_not_exact',
  'identity_conflict_present',
  'adjacent_sku_risk_not_excluded',
  'exact_configuration_inventory_incomplete',
  'package_levels_not_distinguished',
  'package_status_conflict',
  'model_conflict_present',
  'manufacturer_conflict_present',
  'distribution_conflict_present',
  'discontinuation_conflict_present',
  'official_distribution_evidence_incomplete',
  'manufacturer_corroboration_incomplete',
  'manufacturer_search_incomplete',
  'current_non_us_manufacturer_applicability_unresolved',
  'active_distribution_evidence_present_for_negative',
  'ended_distribution_evidence_present_for_positive',
  'evidence_packet_incomplete',
  'source_traceability_incomplete',
  'registration_authorization_not_separated',
  'recall_not_separated_from_distribution',
] as const

export type HighConfidenceInvariantFailure = (typeof HIGH_CONFIDENCE_INVARIANT_FAILURES)[number]

export interface HighConfidenceInvariantAudit {
  performed: boolean
  provisional_state:
    | 'current_us_distribution_supported'
    | 'not_currently_distributed_supported'
    | null
  passed: boolean | null
  failures: HighConfidenceInvariantFailure[]
}

export interface UsStatusClassificationResult {
  research_state: UsStatusResearchState
  confidence: UsStatusConfidence
  proposed_human_review_disposition: UsStatusReviewDisposition
  visibility_review_eligibility: VisibilityReviewEligibility
  reason_codes: string[]
  layer_assessments: UsStatusLayerAssessments
  invariant_audit: HighConfidenceInvariantAudit
  safety_review_gate: SafetyReviewGate
  canonical_change_applied: false
}

const EXACT_IDENTITY_METHOD_SET = new Set<string>(EXACT_IDENTITY_MATCH_METHODS)

function hasExactIdentity(identity: IdentityEvidence): boolean {
  return EXACT_IDENTITY_METHOD_SET.has(identity.match_method)
}

function exactConfigurations(input: UsStatusClassificationInput): UdiConfigurationEvidence[] {
  return input.udi_distribution.configurations.filter((row) => row.exact_identity)
}

function exactConfigurationStatuses(
  input: UsStatusClassificationInput,
): Set<UdiConfigurationDistributionStatus> {
  return new Set(exactConfigurations(input).map((row) => row.distribution_status))
}

function assessUdiDistribution(input: UsStatusClassificationInput): UdiDistributionAssessment {
  const configurations = exactConfigurations(input)
  const statuses = exactConfigurationStatuses(input)
  if (statuses.size > 1) return 'conflicting_exact_configuration_statuses'
  if (!input.udi_distribution.search_completed) return 'search_incomplete'
  if (!input.udi_distribution.snapshot_current) return 'stale_snapshot'
  if (!input.udi_distribution.all_exact_configurations_retrieved) {
    return 'exact_configuration_inventory_incomplete'
  }
  if (configurations.length === 0) return 'no_exact_result'
  const status = statuses.values().next().value
  if (status === 'in_distribution') return 'all_exact_configurations_active'
  if (status === 'not_in_distribution') return 'all_exact_configurations_ended'
  return 'exact_configuration_status_unknown'
}

function assessRegistrationListing(
  evidence: RegistrationListingEvidence,
): RegistrationListingAssessment {
  if (evidence.conflict) return 'conflicting'
  if (!evidence.search_completed) return 'search_incomplete'
  if (!evidence.snapshot_current) return 'stale_snapshot'
  if (
    evidence.match_scope === 'exact_product' &&
    evidence.listing_status === 'current' &&
    evidence.establishment_registration_current === true
  ) {
    return 'exact_current_listing'
  }
  if (evidence.match_scope === 'exact_product' && evidence.listing_status === 'inactive') {
    return 'exact_inactive_listing'
  }
  if (
    evidence.match_scope === 'family_or_proprietary_name' &&
    evidence.listing_status === 'current'
  ) {
    return 'family_current_listing'
  }
  if (evidence.match_scope === 'none') return 'no_result'
  return 'unresolved'
}

function normalizedAuthorization(evidence: AuthorizationEvidence): AuthorizationFinding {
  return evidence.search_completed ? evidence.finding : 'not_searched'
}

function normalizedManufacturer(evidence: ManufacturerEvidence): ManufacturerFinding {
  return evidence.search_completed ? evidence.finding : 'not_searched'
}

/**
 * An incomplete or failed safety search can never be reported as a searched absence. Only a
 * completed search may claim `no_exact_action_found`.
 */
function normalizedSafetyAction(evidence: SafetyActionEvidence): SafetyActionState {
  if (evidence.search_status !== 'searched') return 'unknown'
  return evidence.action_state === 'unknown' ? 'unknown' : evidence.action_state
}

function layerAssessments(input: UsStatusClassificationInput): UsStatusLayerAssessments {
  return {
    identity: hasExactIdentity(input.identity)
      ? 'exact'
      : input.identity.match_method === 'family_or_name_only'
        ? 'family_or_name_only'
        : 'none',
    udi_distribution: assessUdiDistribution(input),
    registration_listing: assessRegistrationListing(input.registration_listing),
    authorization: normalizedAuthorization(input.authorization),
    manufacturer: normalizedManufacturer(input.manufacturer),
    safety_action: normalizedSafetyAction(input.safety_action),
  }
}

/**
 * Evaluates the mandatory safety gate for a product that the distribution layers would otherwise
 * offer to a human reviewer as a positive or negative candidate.
 *
 * A historical (terminated) exact action is retained as safety context but does not block ordinary
 * review; only a currently active exact action, an unresolved safety identity, or an incomplete
 * safety search holds the candidate.
 */
function safetyReviewGate(evidence: SafetyActionEvidence): SafetyReviewGate {
  const state = normalizedSafetyAction(evidence)
  const failures = new Set<SafetyReviewGateFailure>()
  if (evidence.search_status === 'not_searched') failures.add('safety_search_not_performed')
  if (evidence.search_status === 'query_error') failures.add('safety_search_query_error')
  if (state === 'active_exact_product_action') failures.add('active_exact_safety_action_present')
  if (state === 'family_or_ambiguous_action' || state === 'unknown') {
    failures.add('safety_action_identity_ambiguous')
  }
  if (!evidence.exact_action_sources_traceable) {
    failures.add('safety_action_source_traceability_incomplete')
  }

  const searchIncomplete =
    failures.has('safety_search_not_performed') ||
    failures.has('safety_search_query_error') ||
    failures.has('safety_action_source_traceability_incomplete')
  const eligibility: VisibilityReviewEligibility = failures.has(
    'active_exact_safety_action_present',
  )
    ? 'hold_active_safety_action'
    : searchIncomplete
      ? 'hold_safety_search_incomplete'
      : failures.has('safety_action_identity_ambiguous')
        ? 'hold_safety_identity_ambiguous'
        : 'eligible_for_owner_review'

  return { performed: true, eligibility, failures: [...failures].sort() }
}

function notApplicableSafetyGate(): SafetyReviewGate {
  return { performed: false, eligibility: 'not_applicable', failures: [] }
}

function officialDistributionSearchComplete(input: UsStatusClassificationInput): boolean {
  return (
    input.udi_distribution.search_completed &&
    input.udi_distribution.snapshot_current &&
    input.udi_distribution.all_exact_configurations_retrieved &&
    input.registration_listing.search_completed &&
    input.registration_listing.snapshot_current
  )
}

function isAuthorizationSupported(finding: AuthorizationFinding): boolean {
  return [
    'exact_510k_clearance',
    'exact_pma_approval',
    'exact_de_novo_grant',
    'exact_hde_approval',
    'family_level_authorization',
  ].includes(finding)
}

function hasMixedExactConfigurationStatuses(input: UsStatusClassificationInput): boolean {
  return exactConfigurationStatuses(input).size > 1
}

function hasStatusConflict(
  input: UsStatusClassificationInput,
  layers: UsStatusLayerAssessments,
): boolean {
  const udiActive = layers.udi_distribution === 'all_exact_configurations_active'
  const udiEnded = layers.udi_distribution === 'all_exact_configurations_ended'
  const listingCurrent = layers.registration_listing === 'exact_current_listing'
  const listingInactive = layers.registration_listing === 'exact_inactive_listing'
  const manufacturerCurrent = layers.manufacturer === 'current_exact_official_us_product'
  const manufacturerCurrentNonUs = layers.manufacturer === 'current_non_us'
  const manufacturerEnded = layers.manufacturer === 'exact_official_discontinuation'
  return Boolean(
    hasMixedExactConfigurationStatuses(input) ||
    input.registration_listing.conflict ||
    layers.manufacturer === 'conflicting' ||
    input.conflicts.model ||
    input.conflicts.manufacturer ||
    input.conflicts.distribution ||
    input.conflicts.discontinuation ||
    (udiActive && manufacturerEnded) ||
    (udiEnded && manufacturerCurrent) ||
    (udiEnded && manufacturerCurrentNonUs) ||
    (listingCurrent && manufacturerEnded) ||
    (listingCurrent && udiEnded) ||
    (listingInactive && udiActive),
  )
}

function invariantAudit(
  input: UsStatusClassificationInput,
  layers: UsStatusLayerAssessments,
  provisionalState: 'current_us_distribution_supported' | 'not_currently_distributed_supported',
): HighConfidenceInvariantAudit {
  const failures = new Set<HighConfidenceInvariantFailure>()
  const positive = provisionalState === 'current_us_distribution_supported'
  const udiActive = layers.udi_distribution === 'all_exact_configurations_active'
  const udiEnded = layers.udi_distribution === 'all_exact_configurations_ended'
  const listingCurrent = layers.registration_listing === 'exact_current_listing'
  const manufacturerCurrent = layers.manufacturer === 'current_exact_official_us_product'
  const manufacturerCurrentNonUs = layers.manufacturer === 'current_non_us'

  if (!hasExactIdentity(input.identity)) failures.add('identity_match_not_exact')
  if (input.identity.conflict) failures.add('identity_conflict_present')
  if (!input.independent_invariants.adjacent_sku_excluded) {
    failures.add('adjacent_sku_risk_not_excluded')
  }
  if (
    !input.udi_distribution.all_exact_configurations_retrieved ||
    !input.independent_invariants.exact_configuration_inventory_complete
  ) {
    failures.add('exact_configuration_inventory_incomplete')
  }
  if (!input.independent_invariants.package_levels_distinguished) {
    failures.add('package_levels_not_distinguished')
  }
  if (hasMixedExactConfigurationStatuses(input)) failures.add('package_status_conflict')
  if (input.conflicts.model) failures.add('model_conflict_present')
  if (input.conflicts.manufacturer) failures.add('manufacturer_conflict_present')
  if (input.conflicts.distribution || input.registration_listing.conflict) {
    failures.add('distribution_conflict_present')
  }
  if (input.conflicts.discontinuation || layers.manufacturer === 'conflicting') {
    failures.add('discontinuation_conflict_present')
  }
  if (!officialDistributionSearchComplete(input)) {
    failures.add('official_distribution_evidence_incomplete')
  }
  if (positive && !manufacturerCurrent) {
    failures.add('manufacturer_corroboration_incomplete')
  }
  if (!positive && !input.manufacturer.search_completed) {
    failures.add('manufacturer_search_incomplete')
  }
  if (!positive && udiEnded && manufacturerCurrentNonUs) {
    failures.add('current_non_us_manufacturer_applicability_unresolved')
  }
  if (positive && udiEnded) failures.add('ended_distribution_evidence_present_for_positive')
  if (!positive && (udiActive || listingCurrent || manufacturerCurrent)) {
    failures.add('active_distribution_evidence_present_for_negative')
  }
  if (!input.independent_invariants.evidence_packet_complete) {
    failures.add('evidence_packet_incomplete')
  }
  if (!input.independent_invariants.all_sources_traceable) {
    failures.add('source_traceability_incomplete')
  }
  if (!input.independent_invariants.registration_authorization_separated) {
    failures.add('registration_authorization_not_separated')
  }
  if (!input.independent_invariants.recall_excluded_from_distribution) {
    failures.add('recall_not_separated_from_distribution')
  }

  const sortedFailures = [...failures].sort()
  return {
    performed: true,
    provisional_state: provisionalState,
    passed: sortedFailures.length === 0,
    failures: sortedFailures,
  }
}

const IDENTITY_INVARIANT_FAILURES = new Set<HighConfidenceInvariantFailure>([
  'identity_match_not_exact',
  'identity_conflict_present',
  'adjacent_sku_risk_not_excluded',
  'model_conflict_present',
  'manufacturer_conflict_present',
])

/**
 * Maps a research state to the disposition a human reviewer receives.
 *
 * The two distribution-review dispositions are gated on the mandatory safety search: an ordinary
 * positive or negative visibility review is only offered once the safety axis has been resolved
 * for the exact identity. Holding review never changes the distribution state itself.
 */
function dispositionFor(
  state: UsStatusResearchState,
  safetyGate: SafetyReviewGate,
): UsStatusReviewDisposition {
  switch (state) {
    case 'current_us_distribution_supported':
    case 'not_currently_distributed_supported':
      if (safetyGate.eligibility === 'hold_active_safety_action') {
        return 'keep_hidden_pending_active_safety_action_review'
      }
      if (safetyGate.eligibility !== 'eligible_for_owner_review') {
        return 'keep_hidden_pending_safety_review'
      }
      return state === 'current_us_distribution_supported'
        ? 'review_for_prototype_visibility'
        : 'review_as_not_currently_distributed'
    case 'current_status_conflicted':
      return 'keep_hidden_conflicting'
    case 'identity_unresolved':
      return 'keep_hidden_identity_unresolved'
    case 'historically_authorized_current_status_unresolved':
    case 'insufficient_evidence':
      return 'keep_hidden_insufficient_evidence'
    case 'not_applicable_noncommercial_or_local':
      return 'review_as_noncommercial_or_local'
  }
}

function confidenceFor(
  state: UsStatusResearchState,
  authorization: AuthorizationFinding,
): UsStatusConfidence {
  switch (state) {
    case 'current_us_distribution_supported':
    case 'not_currently_distributed_supported':
    case 'not_applicable_noncommercial_or_local':
      return 'high'
    case 'current_status_conflicted':
      return 'moderate'
    case 'historically_authorized_current_status_unresolved':
      return authorization === 'family_level_authorization' ? 'low' : 'moderate'
    case 'identity_unresolved':
    case 'insufficient_evidence':
      return 'low'
  }
}

function emptyInvariantAudit(): HighConfidenceInvariantAudit {
  return {
    performed: false,
    provisional_state: null,
    passed: null,
    failures: [],
  }
}

const SAFETY_REASON_CODES: Record<SafetyActionState, string | null> = {
  active_exact_product_action: 'active_exact_safety_action_recorded_as_separate_safety_context',
  historical_exact_product_action:
    'historical_exact_safety_action_recorded_as_separate_safety_context',
  family_or_ambiguous_action: 'family_or_ambiguous_safety_action_is_not_an_exact_product_action',
  no_exact_action_found: null,
  unknown: null,
}

function result(
  state: UsStatusResearchState,
  layers: UsStatusLayerAssessments,
  reasons: string[],
  audit: HighConfidenceInvariantAudit = emptyInvariantAudit(),
  safetyGate: SafetyReviewGate = notApplicableSafetyGate(),
): UsStatusClassificationResult {
  const reasonCodes = new Set(reasons)
  if (layers.authorization === 'premarket_exempt') {
    reasonCodes.add('premarket_exempt_pathway_is_not_a_negative_finding')
  }
  const safetyReason = SAFETY_REASON_CODES[layers.safety_action]
  if (safetyReason) reasonCodes.add(safetyReason)
  if (safetyGate.performed) {
    reasonCodes.add('safety_action_search_is_not_distribution_evidence')
    for (const failure of safetyGate.failures) reasonCodes.add(failure)
  }
  return {
    research_state: state,
    confidence: confidenceFor(state, layers.authorization),
    proposed_human_review_disposition: dispositionFor(state, safetyGate),
    visibility_review_eligibility: safetyGate.eligibility,
    reason_codes: [...reasonCodes].sort(),
    layer_assessments: layers,
    invariant_audit: audit,
    safety_review_gate: safetyGate,
    canonical_change_applied: false,
  }
}

export function classifyUsStatusProposal(
  input: UsStatusClassificationInput,
): UsStatusClassificationResult {
  const layers = layerAssessments(input)

  if (input.explicitly_noncommercial_or_local) {
    return result('not_applicable_noncommercial_or_local', layers, [
      'explicit_noncommercial_or_local_definition',
    ])
  }

  const exactIdentity = hasExactIdentity(input.identity)
  const officialSearchComplete = officialDistributionSearchComplete(input)
  const currentOfficialEvidence =
    layers.udi_distribution === 'all_exact_configurations_active' ||
    layers.registration_listing === 'exact_current_listing'
  const negativeEvidence =
    layers.udi_distribution === 'all_exact_configurations_ended' ||
    layers.manufacturer === 'exact_official_discontinuation'
  const provisionalPositive = Boolean(
    exactIdentity &&
    officialSearchComplete &&
    currentOfficialEvidence &&
    layers.manufacturer === 'current_exact_official_us_product',
  )
  const provisionalNegative = Boolean(
    exactIdentity &&
    officialSearchComplete &&
    negativeEvidence &&
    input.manufacturer.search_completed,
  )

  if (provisionalPositive || provisionalNegative) {
    const provisionalState = provisionalPositive
      ? 'current_us_distribution_supported'
      : 'not_currently_distributed_supported'
    const audit = invariantAudit(input, layers, provisionalState)
    if (!audit.passed) {
      const identityFailure = audit.failures.some((failure) =>
        IDENTITY_INVARIANT_FAILURES.has(failure),
      )
      return result(
        identityFailure ? 'identity_unresolved' : 'current_status_conflicted',
        layers,
        ['high_confidence_invariant_failed', ...audit.failures],
        audit,
      )
    }
    // The safety gate runs only after the distribution audit has already resolved the state, so
    // safety evidence can hold review without ever moving the distribution conclusion.
    return result(
      provisionalState,
      layers,
      provisionalPositive
        ? [
            'exact_identity_confirmed',
            'current_official_distribution_or_listing_supported',
            'current_exact_official_us_manufacturer_source',
          ]
        : [
            'exact_identity_confirmed',
            layers.udi_distribution === 'all_exact_configurations_ended'
              ? 'all_exact_udi_configurations_ended'
              : 'exact_official_manufacturer_discontinuation',
            'manufacturer_search_completed',
          ],
      audit,
      safetyReviewGate(input.safety_action),
    )
  }

  if (input.identity.conflict || input.identity.match_method === 'family_or_name_only') {
    return result('identity_unresolved', layers, ['exact_identity_unresolved'])
  }
  if (!exactIdentity) {
    return result('insufficient_evidence', layers, ['no_exact_identity_evidence'])
  }
  if (hasStatusConflict(input, layers)) {
    return result('current_status_conflicted', layers, ['current_status_evidence_conflict'])
  }
  if (isAuthorizationSupported(layers.authorization)) {
    return result('historically_authorized_current_status_unresolved', layers, [
      'authorization_supported_but_current_distribution_unresolved',
    ])
  }
  return result('insufficient_evidence', layers, [
    'no_result_is_not_discontinuation_evidence',
    'searches_did_not_establish_current_status',
  ])
}
