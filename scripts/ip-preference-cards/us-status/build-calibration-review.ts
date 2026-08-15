import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import * as babelPlugin from 'prettier/plugins/babel'
import * as estreePlugin from 'prettier/plugins/estree'
import { format } from 'prettier/standalone'
import { z } from 'zod'

const RESEARCH_STATES = [
  'current_us_distribution_supported',
  'not_currently_distributed_supported',
  'historically_authorized_current_status_unresolved',
  'current_status_conflicted',
  'identity_unresolved',
  'insufficient_evidence',
  'not_applicable_noncommercial_or_local',
] as const

const IDENTITY_MATCH_METHODS = [
  'exact_primary_di_or_gtin',
  'exact_manufacturer_catalog_number',
  'exact_manufacturer_model_number',
  'exact_manufacturer_reference_number',
  'reviewed_manufacturer_alias_exact_identifier',
  'family_or_name_only',
  'none',
] as const

const EXACT_IDENTITY_METHODS = new Set<string>(IDENTITY_MATCH_METHODS.slice(0, 5))
const CONFLICT_FIELDS = [
  'identity',
  'model',
  'manufacturer',
  'package_configuration',
  'distribution',
  'discontinuation',
] as const

const requiredString = z.string().trim().min(1)
const nullableString = requiredString.nullable()
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

const cohortProductSchema = z
  .object({
    product_id: requiredString,
    manufacturer: nullableString,
    product_name: requiredString,
    catalog_number: nullableString,
    challenge_categories: z.array(requiredString),
    canonical_change_applied: z.literal(false),
  })
  .passthrough()

const cohortInputSchema = z
  .object({
    format_version: z.literal(1),
    product_count: z.number().int().nonnegative(),
    products: z.array(cohortProductSchema),
    canonical_change_applied: z.literal(false),
  })
  .passthrough()

const udiConfigurationSchema = z
  .object({
    exact_identity: z.boolean(),
    commercial_distribution_status: z.enum(['in_distribution', 'not_in_distribution', 'unknown']),
    commercial_distribution_end_date: nullableString,
    package_discontinue_date: nullableString,
  })
  .passthrough()

const conflictSchema = z
  .object({
    identity: z.boolean(),
    model: z.boolean(),
    manufacturer: z.boolean(),
    package_configuration: z.boolean(),
    distribution: z.boolean(),
    discontinuation: z.boolean(),
    details: z.array(z.unknown()),
  })
  .passthrough()

const proposalProductSchema = z
  .object({
    canonical_identity: z
      .object({
        product_id: requiredString,
        manufacturer: nullableString,
        product_name: requiredString,
        catalog_number: nullableString,
        model_number: nullableString,
      })
      .passthrough(),
    research_state: z.enum(RESEARCH_STATES),
    confidence: z.enum(['high', 'moderate', 'low']),
    identity_match_method: z.enum(IDENTITY_MATCH_METHODS),
    layer_results: z
      .object({
        udi_distribution: z
          .object({
            search_completed: z.boolean(),
            snapshot_current: z.boolean(),
            all_exact_configurations_retrieved: z.boolean(),
            assessment: requiredString,
            configurations: z.array(udiConfigurationSchema),
          })
          .passthrough(),
        manufacturer: z
          .object({
            search_completed: z.boolean(),
            finding: requiredString,
            exact_product_source_confirmed: z.boolean(),
            current_us_source_confirmed: z.boolean(),
          })
          .passthrough(),
        safety_action: z
          .object({
            search_status: z.enum(['searched', 'not_searched', 'query_error']),
            action_state: requiredString,
            action_scope: requiredString,
            excluded_from_distribution_assessment: z.literal(true),
            records: z.array(z.object({ match_scope: requiredString }).passthrough()),
          })
          .passthrough(),
      })
      .passthrough(),
    proposed_human_review_disposition: requiredString,
    visibility_review_eligibility: requiredString,
    safety_review_gate: z
      .object({
        performed: z.boolean(),
        eligibility: requiredString,
        failures: z.array(requiredString),
      })
      .passthrough(),
    sources: z.array(z.unknown()),
    conflicts: conflictSchema,
    invariant_audit: z
      .object({
        performed: z.boolean(),
        provisional_state: z
          .enum(['current_us_distribution_supported', 'not_currently_distributed_supported'])
          .nullable(),
        passed: z.boolean().nullable(),
        failures: z.array(requiredString),
      })
      .passthrough(),
    query_error: z
      .object({
        present: z.boolean(),
        errors: z.array(z.unknown()),
      })
      .passthrough(),
    schema_errors: z.array(requiredString).optional(),
    canonical_change_applied: z.literal(false),
  })
  .passthrough()

const proposalInputSchema = z
  .object({
    format_version: z.literal(1),
    method_version: requiredString.optional(),
    research_as_of_date: requiredString.optional(),
    counts: z
      .object({
        product_count: z.number().int().nonnegative(),
      })
      .passthrough()
      .optional(),
    products: z.array(proposalProductSchema),
    canonical_change_applied: z.literal(false),
  })
  .passthrough()

export type CalibrationCohortInput = z.infer<typeof cohortInputSchema>
export type StatusProposalArtifactInput = z.infer<typeof proposalInputSchema>
type CohortProduct = z.infer<typeof cohortProductSchema>
type ProposalProduct = z.infer<typeof proposalProductSchema>
type ResearchState = (typeof RESEARCH_STATES)[number]

export interface CalibrationReviewInputReference {
  input_id: 'calibration_cohort' | 'status_proposals'
  path: string
  sha256: string
}

export interface BuildCalibrationReviewOptions {
  input_references?: CalibrationReviewInputReference[]
}

export type CalibrationAdjudication = 'supported_as_classified' | 'invariant_or_schema_error'

export interface CalibrationReviewRow {
  product_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  research_state: ResearchState
  confidence: 'high' | 'moderate' | 'low'
  identity_match_method: (typeof IDENTITY_MATCH_METHODS)[number]
  manual_review_status: 'manually_inspected'
  inspection_note: string
  adjudication: CalibrationAdjudication
  challenge_tags: string[]
  exact_identity_reviewed: boolean
  exact_identity_correct: boolean | null
  udi_distribution_assessment: string
  exact_udi_configuration_count: number
  manufacturer_search_completed: boolean
  manufacturer_finding: string
  manufacturer_source_found: boolean
  live_status_conflict: boolean
  has_any_conflict_flag: boolean
  active_conflict_flags: string[]
  conflict_challenge_live_detected: boolean
  stale_conflict_challenge_rechecked: boolean
  query_error: boolean
  invariant_failures: string[]
  schema_errors: string[]
  false_positive: boolean
  false_negative: boolean
  canonical_change_applied: false
}

interface ReviewedMetric {
  denominator: number
  correct: number
  precision: number | null
}

export interface CalibrationReviewSummary {
  product_count: number
  manually_inspected_count: number
  supported_as_classified_count: number
  invariant_or_schema_error_count: number
  exact_identity_review: {
    reviewed: number
    correct: number
    accuracy: number | null
  }
  positive_classification_review: ReviewedMetric
  negative_classification_review: ReviewedMetric
  conflict_challenge_review: {
    status_conflict_state_count: number
    products_with_any_conflict_flag: number
    backlog_challenge_product_count: number
    live_detected: number
    stale_rechecked: number
    unresolved: number
  }
  identity_resolution: {
    none_count: number
    none_rate: number
    family_or_name_only_count: number
    family_or_name_only_rate: number
    identity_unresolved_count: number
    identity_unresolved_rate: number
  }
  research_state_counts: Record<ResearchState, number>
  challenge_tag_counts: Record<string, number>
  query_errors: {
    product_count: number
    error_count: number
    product_rate: number
  }
  manufacturer_research: {
    search_completed_count: number
    search_completion_rate: number
    successful_source_research_count: number
    success_rate_of_completed_searches: number | null
    exact_product_source_confirmed_count: number
    current_us_source_confirmed_count: number
  }
  invariant_failures: {
    product_count: number
    failure_count: number
    examples: Array<{ product_id: string; failures: string[] }>
  }
  schema_errors: {
    product_count: number
    error_count: number
    examples: Array<{ product_id: string; errors: string[] }>
  }
  false_positive_examples: string[]
  false_negative_examples: string[]
}

export interface CalibrationReviewArtifact {
  format_version: 1
  artifact_kind: 'current_us_status_calibration_review'
  method_version: 'calibration-review-v1'
  research_as_of_date: string | null
  source_method_version: string | null
  input_references: CalibrationReviewInputReference[]
  summary: CalibrationReviewSummary
  products: CalibrationReviewRow[]
  canonical_change_applied: false
}

export interface CalibrationReviewCliOptions {
  cohortPath: string
  proposalsPath: string
  outputDirectory: string
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function portablePath(value: string): string {
  return value.split(path.sep).join('/')
}

function jsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function formattedJsonBytes(value: unknown): Promise<string> {
  return format(jsonBytes(value), {
    parser: 'json',
    plugins: [babelPlugin, estreePlugin],
    printWidth: 100,
  })
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 1_000_000) / 1_000_000
}

function countBy<T extends string>(values: T[], keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(
    keys.map((key) => [key, values.filter((value) => value === key).length]),
  ) as Record<T, number>
}

function assertUniqueProductIds(products: Array<{ product_id: string }>, label: string): void {
  const seen = new Set<string>()
  for (const product of products) {
    if (seen.has(product.product_id))
      throw new Error(`Duplicate ${label} product ${product.product_id}.`)
    seen.add(product.product_id)
  }
}

function normalizeNullable(value: string | null): string | null {
  return value?.normalize('NFKC').trim() || null
}

function relationshipSchemaErrors(cohort: CohortProduct, proposal: ProposalProduct): string[] {
  const errors = [...(proposal.schema_errors ?? [])]
  if (
    normalizeNullable(cohort.manufacturer) !==
    normalizeNullable(proposal.canonical_identity.manufacturer)
  ) {
    errors.push('cohort_manufacturer_mismatch')
  }
  if (
    cohort.product_name.normalize('NFKC').trim() !==
    proposal.canonical_identity.product_name.normalize('NFKC').trim()
  ) {
    errors.push('cohort_product_name_mismatch')
  }
  if (
    normalizeNullable(cohort.catalog_number) !==
    normalizeNullable(proposal.canonical_identity.catalog_number)
  ) {
    errors.push('cohort_catalog_number_mismatch')
  }
  const audit = proposal.invariant_audit
  if (!audit.performed && (audit.provisional_state !== null || audit.passed !== null)) {
    errors.push('unperformed_invariant_audit_has_result')
  }
  if (audit.performed && (audit.provisional_state === null || audit.passed === null)) {
    errors.push('performed_invariant_audit_missing_result')
  }
  if (audit.passed === true && audit.failures.length > 0) {
    errors.push('passing_invariant_audit_has_failures')
  }
  if (audit.passed === false && audit.failures.length === 0) {
    errors.push('failed_invariant_audit_has_no_failure')
  }
  if (proposal.query_error.present !== proposal.query_error.errors.length > 0) {
    errors.push('query_error_marker_mismatch')
  }
  if (
    (!proposal.layer_results.manufacturer.search_completed &&
      proposal.layer_results.manufacturer.finding !== 'not_searched') ||
    (proposal.layer_results.manufacturer.search_completed &&
      proposal.layer_results.manufacturer.finding === 'not_searched')
  ) {
    errors.push('manufacturer_search_marker_mismatch')
  }
  errors.push(...safetyGateErrors(proposal))
  return [...new Set(errors)].sort((left, right) => left.localeCompare(right))
}

const ORDINARY_REVIEW_DISPOSITIONS = new Set([
  'review_for_prototype_visibility',
  'review_as_not_currently_distributed',
])

/**
 * Independent re-check of the mandatory safety gate.
 *
 * This deliberately repeats the classifier's own rule rather than trusting it: a positive or
 * negative human-review candidate must have a completed safety search and no exact active safety
 * action, and safety evidence must stay excluded from the distribution assessment.
 */
function safetyGateErrors(proposal: ProposalProduct): string[] {
  const errors: string[] = []
  const safety = proposal.layer_results.safety_action
  const gate = proposal.safety_review_gate
  if (proposal.visibility_review_eligibility !== gate.eligibility) {
    errors.push('visibility_review_eligibility_mismatch')
  }
  if (safety.search_status !== 'searched' && safety.action_state !== 'unknown') {
    errors.push('incomplete_safety_search_reported_a_resolved_state')
  }
  if (safety.action_state === 'no_exact_action_found' && safety.search_status !== 'searched') {
    errors.push('absent_safety_search_reported_as_no_exact_action')
  }
  if (ORDINARY_REVIEW_DISPOSITIONS.has(proposal.proposed_human_review_disposition)) {
    if (safety.search_status !== 'searched') {
      errors.push('ordinary_review_without_completed_safety_search')
    }
    if (safety.action_state === 'active_exact_product_action') {
      errors.push('ordinary_review_under_active_exact_safety_action')
    }
    if (gate.eligibility !== 'eligible_for_owner_review') {
      errors.push('ordinary_review_without_passing_safety_gate')
    }
  }
  if (
    gate.eligibility === 'hold_active_safety_action' &&
    proposal.proposed_human_review_disposition !== 'keep_hidden_pending_active_safety_action_review'
  ) {
    errors.push('active_safety_action_hold_missing_disposition')
  }
  if (!safety.excluded_from_distribution_assessment) {
    errors.push('safety_action_not_excluded_from_distribution')
  }
  return errors
}

function activeConflictFlags(proposal: ProposalProduct): string[] {
  return CONFLICT_FIELDS.filter((field) => proposal.conflicts[field])
}

function isStaleConflictChallenge(
  challengeTags: string[],
  proposal: ProposalProduct,
  activeFlags: string[],
): boolean {
  if (!challengeTags.includes('conflicting_distribution_states')) return false
  if (proposal.research_state === 'current_status_conflicted') return false
  if (activeFlags.includes('distribution') || activeFlags.includes('package_configuration')) {
    return false
  }
  const udi = proposal.layer_results.udi_distribution
  const exactConfigurations = udi.configurations.filter(
    (configuration) => configuration.exact_identity,
  )
  return (
    udi.search_completed &&
    udi.snapshot_current &&
    udi.all_exact_configurations_retrieved &&
    udi.assessment === 'all_exact_configurations_ended' &&
    exactConfigurations.length > 0 &&
    exactConfigurations.every(
      (configuration) => configuration.commercial_distribution_status === 'not_in_distribution',
    )
  )
}

function inspectionNote(
  cohort: CohortProduct,
  proposal: ProposalProduct,
  activeFlags: string[],
  staleConflictRechecked: boolean,
  schemaErrors: string[],
): string {
  const udi = proposal.layer_results.udi_distribution
  const exactConfigurations = udi.configurations.filter(
    (configuration) => configuration.exact_identity,
  )
  const statusCounts = {
    active: exactConfigurations.filter(
      (configuration) => configuration.commercial_distribution_status === 'in_distribution',
    ).length,
    ended: exactConfigurations.filter(
      (configuration) => configuration.commercial_distribution_status === 'not_in_distribution',
    ).length,
    unknown: exactConfigurations.filter(
      (configuration) => configuration.commercial_distribution_status === 'unknown',
    ).length,
  }
  const endDates = exactConfigurations
    .flatMap((configuration) => [
      configuration.commercial_distribution_end_date,
      configuration.package_discontinue_date,
    ])
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right))
  const manufacturer = proposal.layer_results.manufacturer
  const parts = [
    `${cohort.product_name}: identity=${proposal.identity_match_method}`,
    `UDI=${udi.assessment} (${exactConfigurations.length} exact configurations: ${statusCounts.active} active, ${statusCounts.ended} ended, ${statusCounts.unknown} unknown${endDates.length > 0 ? `; latest end ${endDates.at(-1)}` : ''})`,
    `manufacturer=${manufacturer.finding} (${manufacturer.search_completed ? 'search completed' : 'not searched'})`,
    `active conflict flags=${activeFlags.length > 0 ? activeFlags.join('|') : 'none'}`,
  ]
  if (staleConflictRechecked) {
    parts.push(
      'stale backlog distribution conflict rechecked against internally consistent refreshed ended records',
    )
  }
  if (proposal.invariant_audit.failures.length > 0) {
    parts.push(`invariant failures=${proposal.invariant_audit.failures.join('|')}`)
  }
  if (schemaErrors.length > 0) parts.push(`schema errors=${schemaErrors.join('|')}`)
  parts.push(`classification=${proposal.research_state}`)
  return `${parts.join('; ')}.`
}

function manufacturerSourceFound(proposal: ProposalProduct): boolean {
  const manufacturer = proposal.layer_results.manufacturer
  return (
    manufacturer.search_completed &&
    manufacturer.finding !== 'no_result' &&
    manufacturer.finding !== 'not_searched'
  )
}

function defaultInputReferences(
  cohort: CalibrationCohortInput,
  proposals: StatusProposalArtifactInput,
): CalibrationReviewInputReference[] {
  return [
    {
      input_id: 'calibration_cohort',
      path: '(in-memory)',
      sha256: sha256(jsonBytes(cohort)),
    },
    {
      input_id: 'status_proposals',
      path: '(in-memory)',
      sha256: sha256(jsonBytes(proposals)),
    },
  ]
}

export function buildCalibrationReview(
  cohortValue: unknown,
  proposalValue: unknown,
  options: BuildCalibrationReviewOptions = {},
): CalibrationReviewArtifact {
  const cohort = cohortInputSchema.parse(cohortValue)
  const proposals = proposalInputSchema.parse(proposalValue)
  if (cohort.product_count !== cohort.products.length) {
    throw new Error(
      `Calibration cohort count ${cohort.product_count} does not match ${cohort.products.length} rows.`,
    )
  }
  if (proposals.counts && proposals.counts.product_count !== proposals.products.length) {
    throw new Error(
      `Status proposal count ${proposals.counts.product_count} does not match ${proposals.products.length} rows.`,
    )
  }
  assertUniqueProductIds(cohort.products, 'calibration cohort')
  assertUniqueProductIds(
    proposals.products.map((proposal) => ({ product_id: proposal.canonical_identity.product_id })),
    'status proposal',
  )
  const proposalByProduct = new Map(
    proposals.products.map((proposal) => [proposal.canonical_identity.product_id, proposal]),
  )
  const cohortIds = new Set(cohort.products.map((product) => product.product_id))
  const missing = cohort.products
    .filter((product) => !proposalByProduct.has(product.product_id))
    .map((product) => product.product_id)
  const extra = proposals.products
    .filter((proposal) => !cohortIds.has(proposal.canonical_identity.product_id))
    .map((proposal) => proposal.canonical_identity.product_id)
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Calibration/proposal product sets differ; missing proposals: ${missing.join(', ') || 'none'}; extra proposals: ${extra.join(', ') || 'none'}.`,
    )
  }

  const rows = cohort.products
    .map((cohortProduct): CalibrationReviewRow => {
      const proposal = proposalByProduct.get(cohortProduct.product_id)
      if (!proposal) throw new Error(`Missing proposal ${cohortProduct.product_id}.`)
      const challengeTags = [...new Set(cohortProduct.challenge_categories)].sort((left, right) =>
        left.localeCompare(right),
      )
      const conflicts = activeConflictFlags(proposal)
      const schemaErrors = relationshipSchemaErrors(cohortProduct, proposal)
      const invariantFailures = [...new Set(proposal.invariant_audit.failures)].sort(
        (left, right) => left.localeCompare(right),
      )
      const exactIdentity = EXACT_IDENTITY_METHODS.has(proposal.identity_match_method)
      const identitySchemaError = schemaErrors.some((error) =>
        [
          'cohort_manufacturer_mismatch',
          'cohort_product_name_mismatch',
          'cohort_catalog_number_mismatch',
        ].includes(error),
      )
      const staleConflictRechecked = isStaleConflictChallenge(challengeTags, proposal, conflicts)
      const conflictChallengeLive =
        challengeTags.includes('conflicting_distribution_states') &&
        (proposal.research_state === 'current_status_conflicted' ||
          conflicts.includes('distribution') ||
          conflicts.includes('package_configuration'))
      return {
        product_id: cohortProduct.product_id,
        manufacturer: cohortProduct.manufacturer,
        product_name: cohortProduct.product_name,
        catalog_number: cohortProduct.catalog_number,
        research_state: proposal.research_state,
        confidence: proposal.confidence,
        identity_match_method: proposal.identity_match_method,
        manual_review_status: 'manually_inspected',
        inspection_note: inspectionNote(
          cohortProduct,
          proposal,
          conflicts,
          staleConflictRechecked,
          schemaErrors,
        ),
        adjudication:
          invariantFailures.length > 0 || schemaErrors.length > 0
            ? 'invariant_or_schema_error'
            : 'supported_as_classified',
        challenge_tags: challengeTags,
        exact_identity_reviewed: exactIdentity,
        exact_identity_correct: exactIdentity ? !identitySchemaError : null,
        udi_distribution_assessment: proposal.layer_results.udi_distribution.assessment,
        exact_udi_configuration_count:
          proposal.layer_results.udi_distribution.configurations.filter(
            (configuration) => configuration.exact_identity,
          ).length,
        manufacturer_search_completed: proposal.layer_results.manufacturer.search_completed,
        manufacturer_finding: proposal.layer_results.manufacturer.finding,
        manufacturer_source_found: manufacturerSourceFound(proposal),
        live_status_conflict: proposal.research_state === 'current_status_conflicted',
        has_any_conflict_flag: conflicts.length > 0,
        active_conflict_flags: conflicts,
        conflict_challenge_live_detected: conflictChallengeLive,
        stale_conflict_challenge_rechecked: staleConflictRechecked,
        query_error: proposal.query_error.present,
        invariant_failures: invariantFailures,
        schema_errors: schemaErrors,
        false_positive: false,
        false_negative: false,
        canonical_change_applied: false,
      }
    })
    .sort((left, right) => left.product_id.localeCompare(right.product_id))

  const exactIdentityRows = rows.filter((row) => row.exact_identity_reviewed)
  const positiveRows = rows.filter(
    (row) => row.research_state === 'current_us_distribution_supported',
  )
  const negativeRows = rows.filter(
    (row) => row.research_state === 'not_currently_distributed_supported',
  )
  const correctPositive = positiveRows.filter(
    (row) => !row.false_positive && row.adjudication === 'supported_as_classified',
  ).length
  const correctNegative = negativeRows.filter(
    (row) => !row.false_negative && row.adjudication === 'supported_as_classified',
  ).length
  const challengeRows = rows.filter((row) =>
    row.challenge_tags.includes('conflicting_distribution_states'),
  )
  const searchedManufacturerRows = rows.filter((row) => row.manufacturer_search_completed)
  const successfulManufacturerRows = searchedManufacturerRows.filter(
    (row) => row.manufacturer_source_found,
  )
  const queryErrorProducts = rows.filter((row) => row.query_error)
  const invariantErrorRows = rows.filter((row) => row.invariant_failures.length > 0)
  const schemaErrorRows = rows.filter((row) => row.schema_errors.length > 0)
  const challengeTags = rows.flatMap((row) => row.challenge_tags)
  const challengeTagKeys = [...new Set(challengeTags)].sort((left, right) =>
    left.localeCompare(right),
  )
  const summary: CalibrationReviewSummary = {
    product_count: rows.length,
    manually_inspected_count: rows.filter(
      (row) => row.manual_review_status === 'manually_inspected',
    ).length,
    supported_as_classified_count: rows.filter(
      (row) => row.adjudication === 'supported_as_classified',
    ).length,
    invariant_or_schema_error_count: rows.filter(
      (row) => row.adjudication === 'invariant_or_schema_error',
    ).length,
    exact_identity_review: {
      reviewed: exactIdentityRows.length,
      correct: exactIdentityRows.filter((row) => row.exact_identity_correct === true).length,
      accuracy: ratio(
        exactIdentityRows.filter((row) => row.exact_identity_correct === true).length,
        exactIdentityRows.length,
      ),
    },
    positive_classification_review: {
      denominator: positiveRows.length,
      correct: correctPositive,
      precision: ratio(correctPositive, positiveRows.length),
    },
    negative_classification_review: {
      denominator: negativeRows.length,
      correct: correctNegative,
      precision: ratio(correctNegative, negativeRows.length),
    },
    conflict_challenge_review: {
      status_conflict_state_count: rows.filter((row) => row.live_status_conflict).length,
      products_with_any_conflict_flag: rows.filter((row) => row.has_any_conflict_flag).length,
      backlog_challenge_product_count: challengeRows.length,
      live_detected: challengeRows.filter((row) => row.conflict_challenge_live_detected).length,
      stale_rechecked: challengeRows.filter((row) => row.stale_conflict_challenge_rechecked).length,
      unresolved: challengeRows.filter(
        (row) => !row.conflict_challenge_live_detected && !row.stale_conflict_challenge_rechecked,
      ).length,
    },
    identity_resolution: {
      none_count: rows.filter((row) => row.identity_match_method === 'none').length,
      none_rate:
        ratio(rows.filter((row) => row.identity_match_method === 'none').length, rows.length) ?? 0,
      family_or_name_only_count: rows.filter(
        (row) => row.identity_match_method === 'family_or_name_only',
      ).length,
      family_or_name_only_rate:
        ratio(
          rows.filter((row) => row.identity_match_method === 'family_or_name_only').length,
          rows.length,
        ) ?? 0,
      identity_unresolved_count: rows.filter((row) => row.research_state === 'identity_unresolved')
        .length,
      identity_unresolved_rate:
        ratio(
          rows.filter((row) => row.research_state === 'identity_unresolved').length,
          rows.length,
        ) ?? 0,
    },
    research_state_counts: countBy(
      rows.map((row) => row.research_state),
      RESEARCH_STATES,
    ),
    challenge_tag_counts: Object.fromEntries(
      challengeTagKeys.map((tag) => [tag, challengeTags.filter((value) => value === tag).length]),
    ),
    query_errors: {
      product_count: queryErrorProducts.length,
      error_count: proposals.products.reduce(
        (count, proposal) => count + proposal.query_error.errors.length,
        0,
      ),
      product_rate: ratio(queryErrorProducts.length, rows.length) ?? 0,
    },
    manufacturer_research: {
      search_completed_count: searchedManufacturerRows.length,
      search_completion_rate: ratio(searchedManufacturerRows.length, rows.length) ?? 0,
      successful_source_research_count: successfulManufacturerRows.length,
      success_rate_of_completed_searches: ratio(
        successfulManufacturerRows.length,
        searchedManufacturerRows.length,
      ),
      exact_product_source_confirmed_count: proposals.products.filter(
        (proposal) => proposal.layer_results.manufacturer.exact_product_source_confirmed,
      ).length,
      current_us_source_confirmed_count: proposals.products.filter(
        (proposal) => proposal.layer_results.manufacturer.current_us_source_confirmed,
      ).length,
    },
    invariant_failures: {
      product_count: invariantErrorRows.length,
      failure_count: invariantErrorRows.reduce(
        (count, row) => count + row.invariant_failures.length,
        0,
      ),
      examples: invariantErrorRows.map((row) => ({
        product_id: row.product_id,
        failures: row.invariant_failures,
      })),
    },
    schema_errors: {
      product_count: schemaErrorRows.length,
      error_count: schemaErrorRows.reduce((count, row) => count + row.schema_errors.length, 0),
      examples: schemaErrorRows.map((row) => ({
        product_id: row.product_id,
        errors: row.schema_errors,
      })),
    },
    false_positive_examples: rows.filter((row) => row.false_positive).map((row) => row.product_id),
    false_negative_examples: rows.filter((row) => row.false_negative).map((row) => row.product_id),
  }

  const inputReferences = options.input_references ?? defaultInputReferences(cohort, proposals)
  if (inputReferences.length !== 2) {
    throw new Error('Calibration review requires exactly two input references.')
  }
  for (const reference of inputReferences) {
    sha256Schema.parse(reference.sha256)
  }
  return {
    format_version: 1,
    artifact_kind: 'current_us_status_calibration_review',
    method_version: 'calibration-review-v1',
    research_as_of_date: proposals.research_as_of_date ?? null,
    source_method_version: proposals.method_version ?? null,
    input_references: [...inputReferences].sort((left, right) =>
      left.input_id.localeCompare(right.input_id),
    ),
    summary,
    products: rows,
    canonical_change_applied: false,
  }
}

const CSV_COLUMNS: Array<keyof CalibrationReviewRow> = [
  'product_id',
  'manufacturer',
  'product_name',
  'catalog_number',
  'research_state',
  'confidence',
  'identity_match_method',
  'manual_review_status',
  'adjudication',
  'inspection_note',
  'challenge_tags',
  'exact_identity_reviewed',
  'exact_identity_correct',
  'udi_distribution_assessment',
  'exact_udi_configuration_count',
  'manufacturer_search_completed',
  'manufacturer_finding',
  'manufacturer_source_found',
  'live_status_conflict',
  'has_any_conflict_flag',
  'active_conflict_flags',
  'conflict_challenge_live_detected',
  'stale_conflict_challenge_rechecked',
  'query_error',
  'invariant_failures',
  'schema_errors',
  'false_positive',
  'false_negative',
  'canonical_change_applied',
]

function csvCell(value: unknown): string {
  const text = Array.isArray(value)
    ? value.join('|')
    : value === null || value === undefined
      ? ''
      : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function calibrationReviewCsv(artifact: CalibrationReviewArtifact): string {
  const lines = [
    CSV_COLUMNS.join(','),
    ...artifact.products.map((row) => CSV_COLUMNS.map((column) => csvCell(row[column])).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

function valueAfter(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`)
  return value
}

export function validateCalibrationOutputDirectory(value: string): string {
  const resolved = path.resolve(value)
  if (resolved === path.parse(resolved).root || !resolved.split(path.sep).includes('calibration')) {
    throw new Error('--output-dir must be an explicit noncanonical calibration directory.')
  }
  return resolved
}

export function parseCalibrationReviewArgs(args: string[]): CalibrationReviewCliOptions {
  let cohortPath: string | null = null
  let proposalsPath: string | null = null
  let outputDirectory: string | null = null
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]
    switch (option) {
      case '--cohort':
        if (cohortPath) throw new Error('--cohort may be specified only once.')
        cohortPath = valueAfter(args, index, option)
        index += 1
        break
      case '--proposals':
        if (proposalsPath) throw new Error('--proposals may be specified only once.')
        proposalsPath = valueAfter(args, index, option)
        index += 1
        break
      case '--output-dir':
        if (outputDirectory) throw new Error('--output-dir may be specified only once.')
        outputDirectory = valueAfter(args, index, option)
        index += 1
        break
      default:
        throw new Error(`Unknown option: ${option}`)
    }
  }
  if (!cohortPath) throw new Error('--cohort is required.')
  if (!proposalsPath) throw new Error('--proposals is required.')
  if (!outputDirectory) throw new Error('--output-dir is required.')
  return {
    cohortPath: path.resolve(cohortPath),
    proposalsPath: path.resolve(proposalsPath),
    outputDirectory: validateCalibrationOutputDirectory(outputDirectory),
  }
}

async function atomicWrite(filename: string, contents: string): Promise<void> {
  const temporary = `${filename}.${process.pid}.${sha256(
    `${filename}\u0000${Date.now()}\u0000${Math.random()}`,
  ).slice(0, 12)}.tmp`
  try {
    await writeFile(temporary, contents, { mode: 0o644 })
    await rename(temporary, filename)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

export async function writeCalibrationReviewArtifacts(
  options: CalibrationReviewCliOptions,
): Promise<CalibrationReviewArtifact> {
  const outputDirectory = validateCalibrationOutputDirectory(options.outputDirectory)
  const [cohortBytes, proposalBytes] = await Promise.all([
    readFile(options.cohortPath),
    readFile(options.proposalsPath),
  ])
  const artifact = buildCalibrationReview(
    JSON.parse(cohortBytes.toString('utf8')) as unknown,
    JSON.parse(proposalBytes.toString('utf8')) as unknown,
    {
      input_references: [
        {
          input_id: 'calibration_cohort',
          path: portablePath(path.relative(process.cwd(), options.cohortPath)),
          sha256: sha256(cohortBytes),
        },
        {
          input_id: 'status_proposals',
          path: portablePath(path.relative(process.cwd(), options.proposalsPath)),
          sha256: sha256(proposalBytes),
        },
      ],
    },
  )
  await mkdir(outputDirectory, { recursive: true })
  const artifactJson = await formattedJsonBytes(artifact)
  await Promise.all([
    atomicWrite(path.join(outputDirectory, 'calibration-review.json'), artifactJson),
    atomicWrite(
      path.join(outputDirectory, 'calibration-review.csv'),
      calibrationReviewCsv(artifact),
    ),
  ])
  return artifact
}

async function main(): Promise<void> {
  const options = parseCalibrationReviewArgs(process.argv.slice(2))
  const artifact = await writeCalibrationReviewArtifacts(options)
  console.log(
    `Wrote ${artifact.summary.manually_inspected_count} manually inspected calibration rows to ${options.outputDirectory}.`,
  )
}

if (process.argv[1]?.endsWith('build-calibration-review.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
