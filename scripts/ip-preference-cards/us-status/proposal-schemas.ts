import { z } from 'zod'

import {
  AUTHORIZATION_FINDINGS,
  EXACT_IDENTITY_MATCH_METHODS,
  HIGH_CONFIDENCE_INVARIANT_FAILURES,
  MANUFACTURER_FINDINGS,
  SAFETY_ACTION_SCOPES,
  SAFETY_ACTION_STATES,
  SAFETY_REVIEW_GATE_FAILURES,
  SAFETY_SEARCH_STATUSES,
  US_STATUS_CONFIDENCE_VALUES,
  US_STATUS_RESEARCH_STATES,
  US_STATUS_REVIEW_DISPOSITIONS,
  VISIBILITY_REVIEW_ELIGIBILITIES,
} from './classification'
import { SAFETY_ACTION_SYSTEMS } from './acquire-fda-safety-actions'
import { COHORT_PARTITIONS, IDENTIFIER_COMPLETENESS_VALUES } from './types'

const requiredString = z.string().min(1)
const nullableString = requiredString.nullable()
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const isoDateTimeSchema = z.string().datetime()
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const US_STATUS_IDENTITY_MATCH_METHODS = [
  ...EXACT_IDENTITY_MATCH_METHODS,
  'family_or_name_only',
  'none',
] as const

export const UDI_CONFIGURATION_MATCH_BASES = [
  'exact_primary_di_or_gtin',
  'exact_package_di',
  'exact_unit_of_use_di',
  'exact_manufacturer_catalog_number',
  'exact_manufacturer_model_number',
  'exact_manufacturer_reference_number',
  'reviewed_manufacturer_alias_exact_identifier',
  'package_configuration_of_exact_device',
] as const

export const UDI_DISTRIBUTION_ASSESSMENTS = [
  'all_exact_configurations_active',
  'all_exact_configurations_ended',
  'conflicting_exact_configuration_statuses',
  'exact_configuration_status_unknown',
  'no_exact_result',
  'search_incomplete',
  'stale_snapshot',
  'exact_configuration_inventory_incomplete',
] as const

export const REGISTRATION_LISTING_ASSESSMENTS = [
  'exact_current_listing',
  'exact_inactive_listing',
  'family_current_listing',
  'no_result',
  'unresolved',
  'conflicting',
  'search_incomplete',
  'stale_snapshot',
] as const

export const SOURCE_LAYERS = [
  'udi_distribution',
  'registration_listing',
  'authorization',
  'manufacturer',
  'safety_action',
] as const

export const SOURCE_TYPES = [
  'official_fda_api',
  'official_fda_page',
  'official_manufacturer_page',
  'official_manufacturer_document',
] as const

export const SOURCE_IDENTITY_SCOPES = [
  'exact_product',
  'family_or_proprietary_name',
  'context_only',
] as const

export const SOURCE_TEMPORAL_SCOPES = ['current', 'historical', 'undated'] as const

/**
 * Whether the source body was actually retrieved.
 *
 * An inaccessible fetch (timeout, transport failure, unsupported body) is recorded so that an
 * empty response can never be presented as retrieved content. The SHA-256 of an empty body is not
 * evidence about the document.
 */
export const SOURCE_RETRIEVAL_STATUSES = ['retrieved', 'inaccessible'] as const

export const CONFLICT_TYPES = [
  'identity',
  'model',
  'manufacturer',
  'package_configuration',
  'distribution',
  'discontinuation',
] as const

const canonicalMappedRoleSchema = z
  .object({
    role_code: requiredString,
    role_fit: nullableString,
  })
  .strict()

export const usStatusCanonicalIdentitySchema = z
  .object({
    product_id: requiredString,
    manufacturer_id: requiredString,
    manufacturer: nullableString,
    product_name: requiredString,
    catalog_number: nullableString,
    model_number: nullableString,
    gtin_di: nullableString,
    global_part_number: nullableString,
    reference_part_number: nullableString,
    alternate_ids: z.array(requiredString),
  })
  .strict()

export const usStatusCanonicalContextSchema = z
  .object({
    verification_grade: z.enum(['verified_source', 'candidate', 'unknown']),
    visibility_state: z.literal('hidden'),
    cohort_partition: z.enum(COHORT_PARTITIONS),
    identifier_completeness: z.enum(IDENTIFIER_COMPLETENESS_VALUES),
    mapped_roles: z.array(canonicalMappedRoleSchema),
    authored_slot_use_count: z.number().int().nonnegative(),
    selectable_slot_use_count: z.number().int().nonnegative(),
    authored_procedure_codes: z.array(requiredString),
    role_mapped_procedure_codes: z.array(requiredString),
    source_count: z.number().int().nonnegative(),
  })
  .strict()

export const usStatusUdiConfigurationSchema = z
  .object({
    record_key: requiredString,
    configuration_type: z.enum(['primary', 'package', 'unit_of_use', 'other']),
    primary_di: nullableString,
    package_di: nullableString,
    unit_of_use_di: nullableString,
    quantity_per_package: z.number().int().positive().nullable(),
    company_name: nullableString,
    brand_name: nullableString,
    catalog_number: nullableString,
    version_or_model_number: nullableString,
    product_codes: z.array(requiredString),
    premarket_submission_numbers: z.array(requiredString),
    commercial_distribution_status: z.enum(['in_distribution', 'not_in_distribution', 'unknown']),
    commercial_distribution_end_date: isoDateSchema.nullable(),
    package_status: nullableString,
    package_discontinue_date: isoDateSchema.nullable(),
    record_status: nullableString,
    exact_query: requiredString,
    match_basis: z.enum(UDI_CONFIGURATION_MATCH_BASES),
    exact_identity: z.boolean(),
    public_version_date: isoDateSchema.nullable(),
    record_date: isoDateSchema.nullable(),
    source_ids: z.array(requiredString).min(1),
  })
  .strict()

export const usStatusUdiDistributionResultSchema = z
  .object({
    search_completed: z.boolean(),
    snapshot_current: z.boolean(),
    all_exact_configurations_retrieved: z.boolean(),
    assessment: z.enum(UDI_DISTRIBUTION_ASSESSMENTS),
    configurations: z.array(usStatusUdiConfigurationSchema),
  })
  .strict()

export const usStatusRegistrationListingRecordSchema = z
  .object({
    record_key: nullableString,
    establishment_name: nullableString,
    proprietary_name: nullableString,
    product_code: nullableString,
    registration_number: nullableString,
    listing_identifiers: z.array(requiredString),
    linked_submission_numbers: z.array(requiredString),
    listing_status: z.enum(['current', 'inactive', 'unknown']),
    match_scope: z.enum(['exact_product', 'family_or_proprietary_name', 'none']),
    exact_query: requiredString,
    match_basis: requiredString,
    dataset_as_of_date: isoDateSchema,
    source_ids: z.array(requiredString).min(1),
  })
  .strict()

export const usStatusRegistrationListingResultSchema = z
  .object({
    search_completed: z.boolean(),
    snapshot_current: z.boolean(),
    assessment: z.enum(REGISTRATION_LISTING_ASSESSMENTS),
    match_scope: z.enum(['exact_product', 'family_or_proprietary_name', 'none']),
    listing_status: z.enum(['current', 'inactive', 'unknown']),
    establishment_registration_current: z.boolean().nullable(),
    conflict: z.boolean(),
    records: z.array(usStatusRegistrationListingRecordSchema),
  })
  .strict()

export const usStatusAuthorizationRecordSchema = z
  .object({
    pathway: z.enum(['510k', 'pma', 'de_novo', 'hde', 'premarket_exempt']),
    submission_number: nullableString,
    decision_or_exemption_status: nullableString,
    decision_date: isoDateSchema.nullable(),
    product_code: nullableString,
    match_scope: z.enum([
      'exact_product',
      'family_or_proprietary_name',
      'product_code_or_classification_only',
      'none',
    ]),
    exact_query: requiredString,
    match_basis: requiredString,
    dataset_as_of_date: isoDateSchema,
    source_ids: z.array(requiredString).min(1),
  })
  .strict()

export const usStatusAuthorizationResultSchema = z
  .object({
    search_completed: z.boolean(),
    finding: z.enum(AUTHORIZATION_FINDINGS),
    records: z.array(usStatusAuthorizationRecordSchema),
  })
  .strict()

export const usStatusManufacturerResultSchema = z
  .object({
    search_completed: z.boolean(),
    finding: z.enum(MANUFACTURER_FINDINGS),
    exact_product_source_confirmed: z.boolean(),
    current_us_source_confirmed: z.boolean(),
    official_discontinuation_confirmed: z.boolean(),
    source_ids: z.array(requiredString),
  })
  .strict()

export const usStatusSafetyActionRecordSchema = z
  .object({
    system: z.enum(SAFETY_ACTION_SYSTEMS),
    recall_number: requiredString,
    event_id: nullableString,
    recall_status: requiredString,
    status_disposition: z.enum(['active', 'historical', 'unknown']),
    classification: nullableString,
    recalling_firm: nullableString,
    product_description: requiredString,
    reason_for_recall: nullableString,
    initiation_date: isoDateSchema.nullable(),
    posted_date: isoDateSchema.nullable(),
    report_date: isoDateSchema.nullable(),
    termination_date: isoDateSchema.nullable(),
    product_code: nullableString,
    submission_numbers: z.array(requiredString),
    match_scope: z.enum(['exact_product', 'family_or_proprietary_name']),
    matched_identifiers: z.array(requiredString),
    match_basis: requiredString,
    scope: z.enum(SAFETY_ACTION_SCOPES),
    affected_lot_identifier_count: z.number().int().nonnegative(),
    code_info_excerpt: nullableString,
    exact_query: requiredString,
    source_ids: z.array(requiredString).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.match_scope === 'exact_product' && value.matched_identifiers.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matched_identifiers'],
        message: 'An exact-product safety action requires at least one matched exact identifier.',
      })
    }
    if (value.match_scope === 'family_or_proprietary_name' && value.scope !== 'family_level') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scope'],
        message: 'A family or ambiguous safety action must carry family_level scope.',
      })
    }
  })

/**
 * Safety-action layer result.
 *
 * `excluded_from_distribution_assessment` stays a literal `true`: a recall never establishes that
 * a product is discontinued, and it never establishes that a product is currently distributed.
 */
export const usStatusSafetyActionResultSchema = z
  .object({
    search_status: z.enum(SAFETY_SEARCH_STATUSES),
    action_state: z.enum(SAFETY_ACTION_STATES),
    action_scope: z.enum(SAFETY_ACTION_SCOPES),
    excluded_from_distribution_assessment: z.literal(true),
    exact_action_sources_traceable: z.boolean(),
    searched_identifiers: z.array(requiredString),
    skipped_short_identifiers: z.array(requiredString),
    records: z.array(usStatusSafetyActionRecordSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const exact = value.records.filter((record) => record.match_scope === 'exact_product')
    if (value.search_status !== 'searched' && value.action_state !== 'unknown') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action_state'],
        message: 'An incomplete or failed safety search cannot report a resolved action state.',
      })
    }
    if (value.action_state === 'no_exact_action_found' && value.search_status !== 'searched') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action_state'],
        message: 'Absence of a safety search is not the same as no exact action found.',
      })
    }
    if (value.action_state === 'no_exact_action_found' && exact.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action_state'],
        message: 'An exact safety record contradicts no_exact_action_found.',
      })
    }
    if (
      (value.action_state === 'active_exact_product_action' ||
        value.action_state === 'historical_exact_product_action') &&
      exact.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action_state'],
        message: 'An exact-product safety action state requires at least one exact safety record.',
      })
    }
    if (
      value.action_state === 'active_exact_product_action' &&
      !value.exact_action_sources_traceable
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exact_action_sources_traceable'],
        message: 'An active exact safety action must be fully source-traceable.',
      })
    }
  })

export const usStatusSafetyReviewGateSchema = z
  .object({
    performed: z.boolean(),
    eligibility: z.enum(VISIBILITY_REVIEW_ELIGIBILITIES),
    failures: z.array(z.enum(SAFETY_REVIEW_GATE_FAILURES)),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.performed && (value.eligibility !== 'not_applicable' || value.failures.length > 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An unperformed safety gate must be not_applicable with no failures.',
      })
    }
    if (value.performed && value.eligibility === 'not_applicable') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eligibility'],
        message: 'A performed safety gate must resolve to an eligibility or a hold.',
      })
    }
    if (value.eligibility === 'eligible_for_owner_review' && value.failures.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failures'],
        message: 'An eligible safety gate cannot carry failures.',
      })
    }
    if (value.eligibility.startsWith('hold_') && value.failures.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failures'],
        message: 'A safety hold requires at least one recorded failure.',
      })
    }
  })

export function isPortableOpenFdaRawCacheReference(value: string): boolean {
  return /^local-data\/ip-preference-cards\/us-status\/\d{4}-\d{2}-\d{2}\/openfda\/(?:udi|registrationlisting|510k|pma|classification|enforcement|recall)\/[a-f0-9]{64}\.json$/.test(
    value,
  )
}

export const usStatusEvidenceSourceSchema = z
  .object({
    source_id: requiredString,
    layer: z.enum(SOURCE_LAYERS),
    source_type: z.enum(SOURCE_TYPES),
    endpoint: requiredString,
    url: z.string().url(),
    publisher: requiredString,
    title: requiredString,
    as_of_date: isoDateSchema.nullable(),
    retrieved_at: isoDateTimeSchema,
    content_sha256: sha256Schema.nullable(),
    request_search: nullableString,
    raw_cache_reference: nullableString,
    identity_scope: z.enum(SOURCE_IDENTITY_SCOPES),
    temporal_scope: z.enum(SOURCE_TEMPORAL_SCOPES),
    retrieval_status: z.enum(SOURCE_RETRIEVAL_STATUSES),
    us_specific: z.boolean().nullable(),
    exact_identifier_text: z.array(requiredString),
    factual_summary: requiredString,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.retrieval_status === 'inaccessible') {
      if (value.content_sha256 !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['content_sha256'],
          message:
            'An inaccessible source must not record a content hash; the hash of an empty body is not evidence.',
        })
      }
      if (value.identity_scope !== 'context_only') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['identity_scope'],
          message: 'An inaccessible source cannot establish exact or family identity.',
        })
      }
      if (value.exact_identifier_text.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exact_identifier_text'],
          message: 'An inaccessible source cannot report matched exact identifiers.',
        })
      }
    }
    if (value.source_type !== 'official_fda_api') return
    if (value.retrieval_status !== 'retrieved') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['retrieval_status'],
        message: 'An official FDA API source is only recorded when its response was retrieved.',
      })
    }
    if (value.content_sha256 === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content_sha256'],
        message: 'An official FDA API source requires the exact cached response SHA-256.',
      })
    }
    if (value.request_search === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['request_search'],
        message: 'An official FDA API source requires its exact request search.',
      })
    }
    if (value.raw_cache_reference === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['raw_cache_reference'],
        message: 'An official FDA API source requires a portable raw-cache reference.',
      })
    } else if (!isPortableOpenFdaRawCacheReference(value.raw_cache_reference)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['raw_cache_reference'],
        message: 'An official FDA API raw-cache reference must be portable and relative.',
      })
    }
    if (
      value.request_search !== null &&
      new URL(value.url).searchParams.get('search') !== value.request_search
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'The FDA source URL search must match request_search exactly.',
      })
    }
  })

const conflictDetailSchema = z
  .object({
    conflict_type: z.enum(CONFLICT_TYPES),
    summary: requiredString,
    source_ids: z.array(requiredString),
  })
  .strict()

export const usStatusConflictSchema = z
  .object({
    identity: z.boolean(),
    model: z.boolean(),
    manufacturer: z.boolean(),
    package_configuration: z.boolean(),
    distribution: z.boolean(),
    discontinuation: z.boolean(),
    details: z.array(conflictDetailSchema),
  })
  .strict()

export const usStatusInvariantAuditSchema = z
  .object({
    performed: z.boolean(),
    provisional_state: z
      .enum(['current_us_distribution_supported', 'not_currently_distributed_supported'])
      .nullable(),
    passed: z.boolean().nullable(),
    failures: z.array(z.enum(HIGH_CONFIDENCE_INVARIANT_FAILURES)),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.performed && (value.provisional_state !== null || value.passed !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An unperformed invariant audit must have null provisional_state and passed.',
      })
    }
    if (value.performed && (value.provisional_state === null || value.passed === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A performed invariant audit requires provisional_state and passed.',
      })
    }
    if (value.passed === true && value.failures.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failures'],
        message: 'A passing invariant audit cannot contain failures.',
      })
    }
    if (value.passed === false && value.failures.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failures'],
        message: 'A failed invariant audit requires at least one failure.',
      })
    }
  })

export const usStatusQueryErrorEntrySchema = z
  .object({
    layer: z.enum(['identity', ...SOURCE_LAYERS]),
    endpoint: nullableString,
    exact_query: nullableString,
    error_code: requiredString,
    message: requiredString,
    retryable: z.boolean(),
    attempt_count: z.number().int().positive(),
    occurred_at: isoDateTimeSchema,
  })
  .strict()

export const usStatusQueryErrorSchema = z
  .object({
    present: z.boolean(),
    errors: z.array(usStatusQueryErrorEntrySchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.present !== value.errors.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['present'],
        message: 'query_error.present must equal whether errors are recorded.',
      })
    }
  })

/**
 * The two dispositions that hand a product to a human reviewer as an ordinary distribution
 * decision. Both are gated on the mandatory safety search.
 */
const ORDINARY_REVIEW_DISPOSITIONS = new Set<(typeof US_STATUS_REVIEW_DISPOSITIONS)[number]>([
  'review_for_prototype_visibility',
  'review_as_not_currently_distributed',
])

export const usStatusEvidenceProposalSchema = z
  .object({
    canonical_identity: usStatusCanonicalIdentitySchema,
    canonical_context: usStatusCanonicalContextSchema,
    research_state: z.enum(US_STATUS_RESEARCH_STATES),
    confidence: z.enum(US_STATUS_CONFIDENCE_VALUES),
    identity_match_method: z.enum(US_STATUS_IDENTITY_MATCH_METHODS),
    layer_results: z
      .object({
        udi_distribution: usStatusUdiDistributionResultSchema,
        registration_listing: usStatusRegistrationListingResultSchema,
        authorization: usStatusAuthorizationResultSchema,
        manufacturer: usStatusManufacturerResultSchema,
        safety_action: usStatusSafetyActionResultSchema,
      })
      .strict(),
    sources: z.array(usStatusEvidenceSourceSchema),
    conflicts: usStatusConflictSchema,
    reason_codes: z.array(requiredString),
    rationale: requiredString,
    unresolved_questions: z.array(requiredString),
    proposed_human_review_disposition: z.enum(US_STATUS_REVIEW_DISPOSITIONS),
    visibility_review_eligibility: z.enum(VISIBILITY_REVIEW_ELIGIBILITIES),
    invariant_audit: usStatusInvariantAuditSchema,
    safety_review_gate: usStatusSafetyReviewGateSchema,
    query_error: usStatusQueryErrorSchema,
    canonical_change_applied: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    const safety = value.layer_results.safety_action
    const gate = value.safety_review_gate
    if (value.visibility_review_eligibility !== gate.eligibility) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['visibility_review_eligibility'],
        message: 'visibility_review_eligibility must equal the safety gate eligibility.',
      })
    }
    if (gate.performed) {
      const required: Array<[boolean, (typeof SAFETY_REVIEW_GATE_FAILURES)[number]]> = [
        [
          safety.action_state === 'active_exact_product_action',
          'active_exact_safety_action_present',
        ],
        [safety.search_status === 'not_searched', 'safety_search_not_performed'],
        [safety.search_status === 'query_error', 'safety_search_query_error'],
        [
          safety.action_state === 'family_or_ambiguous_action' || safety.action_state === 'unknown',
          'safety_action_identity_ambiguous',
        ],
        [!safety.exact_action_sources_traceable, 'safety_action_source_traceability_incomplete'],
      ]
      for (const [applies, failure] of required) {
        if (applies !== gate.failures.includes(failure)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['safety_review_gate', 'failures'],
            message: `The safety gate must record ${failure} exactly when the safety-action layer implies it.`,
          })
        }
      }
    }
    // The central correction: an ordinary positive or negative visibility review may only be
    // proposed once the safety search completed and left no exact active action outstanding.
    if (ORDINARY_REVIEW_DISPOSITIONS.has(value.proposed_human_review_disposition)) {
      if (gate.eligibility !== 'eligible_for_owner_review') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposed_human_review_disposition'],
          message:
            'An ordinary visibility-review disposition requires a passing mandatory safety gate.',
        })
      }
      if (safety.search_status !== 'searched') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposed_human_review_disposition'],
          message:
            'An ordinary visibility-review disposition requires a completed safety-action search.',
        })
      }
      if (safety.action_state === 'active_exact_product_action') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposed_human_review_disposition'],
          message:
            'A product under an active exact FDA safety action cannot be an ordinary visibility-review candidate.',
        })
      }
    }
    if (
      gate.eligibility === 'hold_active_safety_action' &&
      value.proposed_human_review_disposition !== 'keep_hidden_pending_active_safety_action_review'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['proposed_human_review_disposition'],
        message:
          'An active safety-action hold requires the active-safety-action review disposition.',
      })
    }
    // Owner-approved evidence policy, re-enforced at the artifact boundary so a classifier
    // regression cannot quietly widen the supported state or overstate its confidence.
    if (value.research_state === 'current_us_distribution_supported') {
      if (value.layer_results.udi_distribution.assessment !== 'all_exact_configurations_active') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['research_state'],
          message:
            'current_us_distribution_supported requires current exact GUDID commercial-distribution evidence.',
        })
      }
      const secondExactCurrentSource =
        value.layer_results.registration_listing.assessment === 'exact_current_listing' ||
        value.layer_results.manufacturer.finding === 'current_exact_official_us_product'
      const expected = secondExactCurrentSource ? 'high' : 'moderate'
      if (value.confidence !== expected) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confidence'],
          message: secondExactCurrentSource
            ? 'A supported current-distribution state with a second exact current source is high confidence.'
            : 'Without a second exact current source, a supported current-distribution state is capped at moderate confidence.',
        })
      }
    }
    // A safety action is never a distribution conclusion in either direction.
    if (
      safety.action_state === 'active_exact_product_action' &&
      value.research_state === 'not_currently_distributed_supported' &&
      value.layer_results.udi_distribution.assessment !== 'all_exact_configurations_ended' &&
      value.layer_results.manufacturer.finding !== 'exact_official_discontinuation'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['research_state'],
        message:
          'A safety action alone cannot establish that a product is not currently distributed.',
      })
    }
  })

const researchStateCountsSchema = z
  .object({
    current_us_distribution_supported: z.number().int().nonnegative(),
    not_currently_distributed_supported: z.number().int().nonnegative(),
    historically_authorized_current_status_unresolved: z.number().int().nonnegative(),
    current_status_conflicted: z.number().int().nonnegative(),
    identity_unresolved: z.number().int().nonnegative(),
    insufficient_evidence: z.number().int().nonnegative(),
    not_applicable_noncommercial_or_local: z.number().int().nonnegative(),
  })
  .strict()

const confidenceCountsSchema = z
  .object({
    high: z.number().int().nonnegative(),
    moderate: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
  })
  .strict()

function countsByEnum<T extends readonly [string, ...string[]]>(
  values: T,
): z.ZodObject<Record<T[number], z.ZodNumber>> {
  return z
    .object(
      Object.fromEntries(values.map((value) => [value, z.number().int().nonnegative()])) as Record<
        T[number],
        z.ZodNumber
      >,
    )
    .strict() as z.ZodObject<Record<T[number], z.ZodNumber>>
}

const safetySearchStatusCountsSchema = countsByEnum(SAFETY_SEARCH_STATUSES)
const safetyActionStateCountsSchema = countsByEnum(SAFETY_ACTION_STATES)
const visibilityReviewEligibilityCountsSchema = countsByEnum(VISIBILITY_REVIEW_ELIGIBILITIES)
const reviewDispositionCountsSchema = countsByEnum(US_STATUS_REVIEW_DISPOSITIONS)

export const usStatusProposalCountsSchema = z
  .object({
    product_count: z.number().int().nonnegative(),
    research_state_counts: researchStateCountsSchema,
    confidence_counts: confidenceCountsSchema,
    safety_search_status_counts: safetySearchStatusCountsSchema,
    safety_action_state_counts: safetyActionStateCountsSchema,
    visibility_review_eligibility_counts: visibilityReviewEligibilityCountsSchema,
    review_disposition_counts: reviewDispositionCountsSchema,
    exact_safety_action_product_count: z.number().int().nonnegative(),
    query_error_product_count: z.number().int().nonnegative(),
    source_record_count: z.number().int().nonnegative(),
    udi_configuration_count: z.number().int().nonnegative(),
    safety_action_record_count: z.number().int().nonnegative(),
    conflicted_product_count: z.number().int().nonnegative(),
  })
  .strict()

export const usStatusInputHashSchema = z
  .object({
    input_id: requiredString,
    path: requiredString,
    sha256: sha256Schema,
  })
  .strict()

export const usStatusDatasetSnapshotSchema = z
  .object({
    dataset_id: requiredString,
    layer: z.enum(SOURCE_LAYERS),
    endpoint: requiredString,
    as_of_date: isoDateSchema,
    last_updated_at: isoDateTimeSchema.nullable(),
    retrieved_at: isoDateTimeSchema,
    content_sha256: sha256Schema.nullable(),
    record_count: z.number().int().nonnegative().nullable(),
  })
  .strict()

function addSortedUniqueIssues(
  values: string[],
  context: z.RefinementCtx,
  path: Array<string | number>,
  label: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    const comparison = values[index - 1].localeCompare(values[index])
    if (comparison === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index],
        message: `${label} values must be unique.`,
      })
    } else if (comparison > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index],
        message: `${label} values must be sorted.`,
      })
    }
  }
}

function addCountIssue(
  context: z.RefinementCtx,
  path: Array<string | number>,
  actual: number,
  expected: number,
): void {
  if (actual === expected) return
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message: `Recorded count ${actual} does not match derived count ${expected}.`,
  })
}

const CONFLICT_FLAG_FIELDS = [
  'identity',
  'model',
  'manufacturer',
  'package_configuration',
  'distribution',
  'discontinuation',
] as const

export const usStatusEvidenceArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('current_us_status_evidence_proposals'),
    method_version: requiredString,
    research_as_of_date: isoDateSchema,
    input_hashes: z.array(usStatusInputHashSchema).min(1),
    dataset_snapshots: z.array(usStatusDatasetSnapshotSchema).min(1),
    counts: usStatusProposalCountsSchema,
    products: z.array(usStatusEvidenceProposalSchema),
    canonical_change_applied: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    addSortedUniqueIssues(
      value.products.map((product) => product.canonical_identity.product_id),
      context,
      ['products'],
      'Product ID',
    )
    addSortedUniqueIssues(
      value.input_hashes.map((input) => input.input_id),
      context,
      ['input_hashes'],
      'Input hash ID',
    )
    addSortedUniqueIssues(
      value.dataset_snapshots.map((snapshot) => snapshot.dataset_id),
      context,
      ['dataset_snapshots'],
      'Dataset snapshot ID',
    )

    addCountIssue(
      context,
      ['counts', 'product_count'],
      value.counts.product_count,
      value.products.length,
    )
    for (const state of US_STATUS_RESEARCH_STATES) {
      addCountIssue(
        context,
        ['counts', 'research_state_counts', state],
        value.counts.research_state_counts[state],
        value.products.filter((product) => product.research_state === state).length,
      )
    }
    for (const confidence of US_STATUS_CONFIDENCE_VALUES) {
      addCountIssue(
        context,
        ['counts', 'confidence_counts', confidence],
        value.counts.confidence_counts[confidence],
        value.products.filter((product) => product.confidence === confidence).length,
      )
    }
    addCountIssue(
      context,
      ['counts', 'query_error_product_count'],
      value.counts.query_error_product_count,
      value.products.filter((product) => product.query_error.present).length,
    )
    addCountIssue(
      context,
      ['counts', 'source_record_count'],
      value.counts.source_record_count,
      value.products.reduce((count, product) => count + product.sources.length, 0),
    )
    addCountIssue(
      context,
      ['counts', 'udi_configuration_count'],
      value.counts.udi_configuration_count,
      value.products.reduce(
        (count, product) => count + product.layer_results.udi_distribution.configurations.length,
        0,
      ),
    )
    for (const status of SAFETY_SEARCH_STATUSES) {
      addCountIssue(
        context,
        ['counts', 'safety_search_status_counts', status],
        value.counts.safety_search_status_counts[status],
        value.products.filter(
          (product) => product.layer_results.safety_action.search_status === status,
        ).length,
      )
    }
    for (const state of SAFETY_ACTION_STATES) {
      addCountIssue(
        context,
        ['counts', 'safety_action_state_counts', state],
        value.counts.safety_action_state_counts[state],
        value.products.filter(
          (product) => product.layer_results.safety_action.action_state === state,
        ).length,
      )
    }
    for (const eligibility of VISIBILITY_REVIEW_ELIGIBILITIES) {
      addCountIssue(
        context,
        ['counts', 'visibility_review_eligibility_counts', eligibility],
        value.counts.visibility_review_eligibility_counts[eligibility],
        value.products.filter((product) => product.visibility_review_eligibility === eligibility)
          .length,
      )
    }
    for (const disposition of US_STATUS_REVIEW_DISPOSITIONS) {
      addCountIssue(
        context,
        ['counts', 'review_disposition_counts', disposition],
        value.counts.review_disposition_counts[disposition],
        value.products.filter(
          (product) => product.proposed_human_review_disposition === disposition,
        ).length,
      )
    }
    addCountIssue(
      context,
      ['counts', 'exact_safety_action_product_count'],
      value.counts.exact_safety_action_product_count,
      value.products.filter((product) =>
        product.layer_results.safety_action.records.some(
          (record) => record.match_scope === 'exact_product',
        ),
      ).length,
    )
    addCountIssue(
      context,
      ['counts', 'safety_action_record_count'],
      value.counts.safety_action_record_count,
      value.products.reduce(
        (count, product) => count + product.layer_results.safety_action.records.length,
        0,
      ),
    )
    addCountIssue(
      context,
      ['counts', 'conflicted_product_count'],
      value.counts.conflicted_product_count,
      value.products.filter((product) =>
        CONFLICT_FLAG_FIELDS.some((field) => product.conflicts[field]),
      ).length,
    )
  })

export const usStatusSourceManifestSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('current_us_status_source_manifest'),
    method_version: requiredString,
    research_as_of_date: isoDateSchema,
    input_hashes: z.array(usStatusInputHashSchema).min(1),
    dataset_snapshots: z.array(usStatusDatasetSnapshotSchema).min(1),
    source_count: z.number().int().nonnegative(),
    sources: z.array(usStatusEvidenceSourceSchema),
    canonical_change_applied: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    addSortedUniqueIssues(
      value.sources.map((source) => source.source_id),
      context,
      ['sources'],
      'Source ID',
    )
    addSortedUniqueIssues(
      value.input_hashes.map((input) => input.input_id),
      context,
      ['input_hashes'],
      'Input hash ID',
    )
    addSortedUniqueIssues(
      value.dataset_snapshots.map((snapshot) => snapshot.dataset_id),
      context,
      ['dataset_snapshots'],
      'Dataset snapshot ID',
    )
    addCountIssue(context, ['source_count'], value.source_count, value.sources.length)
  })

export const usStatusRunSummarySchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('current_us_status_run_summary'),
    method_version: requiredString,
    research_as_of_date: isoDateSchema,
    proposal_artifact_sha256: sha256Schema,
    source_manifest_sha256: sha256Schema,
    input_hashes: z.array(usStatusInputHashSchema).min(1),
    dataset_snapshots: z.array(usStatusDatasetSnapshotSchema).min(1),
    counts: usStatusProposalCountsSchema,
    execution: z
      .object({
        products_requested: z.number().int().nonnegative(),
        products_processed: z.number().int().nonnegative(),
        fda_api_requests: z.number().int().nonnegative(),
        manufacturer_requests: z.number().int().nonnegative(),
        cache_hits: z.number().int().nonnegative(),
        cache_misses: z.number().int().nonnegative(),
        retry_count: z.number().int().nonnegative(),
        query_error_count: z.number().int().nonnegative(),
        started_at: isoDateTimeSchema,
        completed_at: isoDateTimeSchema,
        raw_cache_committed: z.literal(false),
      })
      .strict(),
    canonical_change_applied: z.literal(false),
  })
  .strict()

export const US_STATUS_REVIEW_DECISIONS = [
  'pending',
  'concur_with_proposal',
  'do_not_concur',
  'needs_more_research',
] as const

const reviewSourceLinkSchema = z
  .object({
    source_id: requiredString,
    layer: z.enum(SOURCE_LAYERS),
    url: z.string().url(),
    as_of_date: isoDateSchema.nullable(),
    retrieved_at: isoDateTimeSchema,
  })
  .strict()

export const usStatusReviewRowSchema = z
  .object({
    product_id: requiredString,
    manufacturer: nullableString,
    product_name: requiredString,
    catalog_number: nullableString,
    model_number: nullableString,
    research_state: z.enum(US_STATUS_RESEARCH_STATES),
    confidence: z.enum(US_STATUS_CONFIDENCE_VALUES),
    identity_match_method: z.enum(US_STATUS_IDENTITY_MATCH_METHODS),
    rationale: requiredString,
    official_fda_evidence_summary: requiredString,
    official_manufacturer_evidence_summary: requiredString,
    official_fda_safety_action_summary: requiredString,
    safety_search_status: z.enum(SAFETY_SEARCH_STATUSES),
    safety_action_state: z.enum(SAFETY_ACTION_STATES),
    safety_action_scope: z.enum(SAFETY_ACTION_SCOPES),
    safety_action_references: z.array(requiredString),
    visibility_review_eligibility: z.enum(VISIBILITY_REVIEW_ELIGIBILITIES),
    conflicts: z.array(requiredString),
    source_links: z.array(reviewSourceLinkSchema),
    proposed_human_review_disposition: z.enum(US_STATUS_REVIEW_DISPOSITIONS),
    reviewer_decision: z.enum(US_STATUS_REVIEW_DECISIONS),
    reviewer_rationale: nullableString,
    second_review: z
      .object({
        required: z.boolean(),
        decision: z.enum(US_STATUS_REVIEW_DECISIONS).nullable(),
        rationale: nullableString,
      })
      .strict(),
    canonical_change_applied: z.literal(false),
  })
  .strict()

export type UsStatusCanonicalIdentity = z.infer<typeof usStatusCanonicalIdentitySchema>
export type UsStatusCanonicalContext = z.infer<typeof usStatusCanonicalContextSchema>
export type UsStatusUdiConfiguration = z.infer<typeof usStatusUdiConfigurationSchema>
export type UsStatusUdiDistributionResult = z.infer<typeof usStatusUdiDistributionResultSchema>
export type UsStatusRegistrationListingRecord = z.infer<
  typeof usStatusRegistrationListingRecordSchema
>
export type UsStatusRegistrationListingResult = z.infer<
  typeof usStatusRegistrationListingResultSchema
>
export type UsStatusAuthorizationRecord = z.infer<typeof usStatusAuthorizationRecordSchema>
export type UsStatusAuthorizationResult = z.infer<typeof usStatusAuthorizationResultSchema>
export type UsStatusManufacturerResult = z.infer<typeof usStatusManufacturerResultSchema>
export type UsStatusSafetyActionRecord = z.infer<typeof usStatusSafetyActionRecordSchema>
export type UsStatusSafetyActionResult = z.infer<typeof usStatusSafetyActionResultSchema>
export type UsStatusSafetyReviewGate = z.infer<typeof usStatusSafetyReviewGateSchema>
export type UsStatusEvidenceSource = z.infer<typeof usStatusEvidenceSourceSchema>
export type UsStatusConflict = z.infer<typeof usStatusConflictSchema>
export type UsStatusInvariantAudit = z.infer<typeof usStatusInvariantAuditSchema>
export type UsStatusQueryErrorEntry = z.infer<typeof usStatusQueryErrorEntrySchema>
export type UsStatusQueryError = z.infer<typeof usStatusQueryErrorSchema>
export type UsStatusEvidenceProposal = z.infer<typeof usStatusEvidenceProposalSchema>
export type UsStatusProposalCounts = z.infer<typeof usStatusProposalCountsSchema>
export type UsStatusInputHash = z.infer<typeof usStatusInputHashSchema>
export type UsStatusDatasetSnapshot = z.infer<typeof usStatusDatasetSnapshotSchema>
export type UsStatusEvidenceArtifact = z.infer<typeof usStatusEvidenceArtifactSchema>
export type UsStatusSourceManifest = z.infer<typeof usStatusSourceManifestSchema>
export type UsStatusRunSummary = z.infer<typeof usStatusRunSummarySchema>
export type UsStatusReviewRow = z.infer<typeof usStatusReviewRowSchema>
