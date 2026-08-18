import { LUNA_MINIMUM_EXCLUDE_YIELD, LUNA_QUALIFICATION_VERSION } from './constants'
import type { EvaluationReport } from './evaluation'

/**
 * The Stage-A qualification gate: shadow-routing authorization, not clinical validation.
 *
 * All eight criteria are evaluated over the locked 200-record run; every one must pass before
 * Stage A may shadow-route anything. The criteria are asymmetric on purpose: perfection is
 * demanded on the relevant side (zero core, zero adjacent, zero relevant routing errors, 100%
 * bucket precision) while the negative side needs only a minimum useful yield.
 */

export interface QualificationCriterion {
  readonly id: string
  readonly description: string
  readonly pass: boolean
  readonly detail: string
}

export interface QualificationReport {
  readonly version: string
  readonly cohortLabel: string
  readonly qualified: boolean
  readonly criteria: readonly QualificationCriterion[]
}

export interface QualificationInputs {
  readonly evaluation: EvaluationReport
  /** Count of physician systematic-miss flags recorded against this cohort so far. */
  readonly systematicMissFlagCount: number
  /** True when every locked-cohort high-confidence negative is present in the review queue. */
  readonly reviewInterfaceCoversAllHighConfidenceNegatives: boolean
}

export function buildQualificationReport(inputs: QualificationInputs): QualificationReport {
  const { evaluation } = inputs
  if (!evaluation.truthAvailable || !evaluation.negativeBucket || !evaluation.falseExclusions) {
    throw new Error('Qualification requires a truth-scored evaluation of the locked cohort.')
  }
  const bucket = evaluation.negativeBucket
  const falseExclusions = evaluation.falseExclusions
  const byProfile = falseExclusions.routingFalseExclusionsByEvidenceProfile
  const yieldRate = evaluation.routedExcludeYieldAllExcludes

  const criteria: QualificationCriterion[] = [
    {
      id: 'no_include_core_in_bucket',
      description: 'Zero include_core records in high-confidence obvious_irrelevant.',
      pass: bucket.includeCoreCount === 0,
      detail: `include_core in bucket: ${bucket.includeCoreCount}`,
    },
    {
      id: 'no_include_adjacent_in_bucket',
      description: 'Zero include_adjacent records in high-confidence obvious_irrelevant.',
      pass: bucket.includeAdjacentCount === 0,
      detail: `include_adjacent in bucket: ${bucket.includeAdjacentCount}`,
    },
    {
      id: 'no_relevant_routing_errors_either_profile',
      description:
        'Zero physician-relevant false-negative routing errors in both evidence profiles.',
      pass: byProfile.metadata_with_abstract === 0 && byProfile.metadata_without_abstract === 0,
      detail:
        `with_abstract: ${byProfile.metadata_with_abstract}, ` +
        `without_abstract: ${byProfile.metadata_without_abstract}`,
    },
    {
      id: 'bucket_precision_100',
      description: '100% observed precision of the high-confidence obvious-negative bucket.',
      pass: bucket.count === 0 || bucket.observedPrecisionBucket === 1,
      detail:
        bucket.count === 0
          ? 'bucket empty (vacuously precise; yield criterion will fail)'
          : `observed precision: ${bucket.observedPrecisionBucket}`,
    },
    {
      id: 'exclude_yield_minimum',
      description:
        `At least ${LUNA_MINIMUM_EXCLUDE_YIELD * 100}% of physician-reviewed excludes enter ` +
        'the deprioritization pool.',
      pass: yieldRate !== null && yieldRate >= LUNA_MINIMUM_EXCLUDE_YIELD,
      detail: `routed exclude yield: ${yieldRate ?? 'null'}`,
    },
    {
      id: 'no_systematic_category_miss',
      description:
        'No systematic category miss: no relevant record in the pool within any subgroup and ' +
        'no physician systematic-miss flag.',
      pass:
        inputs.systematicMissFlagCount === 0 &&
        falseExclusions.routingFalseExclusions === 0 &&
        bucket.lowRiskIncludeCoreCount === 0 &&
        bucket.lowRiskIncludeAdjacentCount === 0,
      detail:
        `systematic-miss flags: ${inputs.systematicMissFlagCount}; relevant records in ` +
        `pool: ${falseExclusions.routingFalseExclusions}`,
    },
    {
      id: 'complete_denominator_accounting',
      description: 'Complete denominator accounting over the locked cohort.',
      pass:
        evaluation.reconciliation.attemptedPlusNoAttemptEqualsSelected &&
        evaluation.reconciliation.terminalStatesSumToSelected &&
        evaluation.reconciliation.attemptedStatesSumToAttempted,
      detail: `reconciliation: ${JSON.stringify(evaluation.reconciliation)}`,
    },
    {
      id: 'review_interface_coverage',
      description:
        'Every high-confidence negative in the locked cohort is available in the ' +
        'physician-review interface.',
      pass: inputs.reviewInterfaceCoversAllHighConfidenceNegatives,
      detail: inputs.reviewInterfaceCoversAllHighConfidenceNegatives
        ? 'review queue covers the bucket'
        : 'review queue is missing bucket records',
    },
  ]
  return {
    version: LUNA_QUALIFICATION_VERSION,
    cohortLabel: evaluation.cohortLabel,
    qualified: criteria.every((criterion) => criterion.pass),
    criteria,
  }
}
