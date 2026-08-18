/** @jest-environment node */
import type { EvaluationReport, NegativeBucket } from './evaluation'
import { buildQualificationReport } from './qualify'

function passingEvaluation(): EvaluationReport {
  const bucket: NegativeBucket = {
    count: 90,
    includeCoreCount: 0,
    includeAdjacentCount: 0,
    excludeCount: 90,
    observedPrecisionBucket: 1,
    lowRiskCount: 60,
    lowRiskIncludeCoreCount: 0,
    lowRiskIncludeAdjacentCount: 0,
    lowRiskExcludeCount: 60,
    lowRiskObservedPrecisionBucket: 1,
  }
  return {
    version: 'literature-luna-evaluation/1.0.0',
    cohortLabel: 'locked-sanity-200',
    truthAvailable: true,
    denominators: {
      selected: 200,
      attempted: 200,
      validPredictions: 180,
      validAbstentions: 12,
      refusals: 2,
      invalidQuarantined: 3,
      missing: 2,
      duplicate: 1,
      noAttempt: 0,
    },
    reconciliation: {
      attemptedPlusNoAttemptEqualsSelected: true,
      terminalStatesSumToSelected: true,
      attemptedStatesSumToAttempted: true,
    },
    classifiedCoverageAllSelected: 0.9,
    abstentionCoverageAllSelected: 0.06,
    truthBreakdownAllSelected: { includeCore: 90, includeAdjacent: 24, exclude: 86 },
    classified: {
      accuracyClassified: 0.95,
      includeSensitivityClassifiedIncludes: 0.99,
      excludePrecisionPredictedNegative: 1,
      excludeSpecificityClassifiedExcludes: 0.8,
      coreRecallClassifiedCore: 0.99,
      adjacentRecallClassifiedAdjacent: 0.97,
    },
    falseExclusions: {
      predictionFalseExclusions: 0,
      predictionFalseExclusionRateAllRelevantSelected: 0,
      routingFalseExclusions: 0,
      routingFalseExclusionRateAllRelevantSelected: 0,
      routingFalseExclusionsByEvidenceProfile: {
        metadata_with_abstract: 0,
        metadata_without_abstract: 0,
      },
    },
    negativeBucket: bucket,
    routedExcludeYieldAllExcludes: 60 / 86,
    confusionMatrix: { include_core: {}, include_adjacent: {}, exclude: {} },
    byEvidenceProfile: null,
    byConfidenceBand: null,
    reasonCodeDistribution: {},
    riskFlagDistribution: {},
  }
}

function qualify(
  evaluation: EvaluationReport,
  overrides: Partial<{
    systematicMissFlagCount: number
    reviewInterfaceCoversAllHighConfidenceNegatives: boolean
  }> = {},
) {
  return buildQualificationReport({
    evaluation,
    systematicMissFlagCount: overrides.systematicMissFlagCount ?? 0,
    reviewInterfaceCoversAllHighConfidenceNegatives:
      overrides.reviewInterfaceCoversAllHighConfidenceNegatives ?? true,
  })
}

describe('qualification gate', () => {
  it('qualifies only when all eight criteria pass', () => {
    const report = qualify(passingEvaluation())
    expect(report.criteria).toHaveLength(8)
    expect(report.criteria.every((criterion) => criterion.pass)).toBe(true)
    expect(report.qualified).toBe(true)
  })

  it('fails on any include_core or include_adjacent in the bucket', () => {
    const core = passingEvaluation()
    ;(core.negativeBucket as { includeCoreCount: number }).includeCoreCount = 1
    expect(qualify(core).qualified).toBe(false)
    const adjacent = passingEvaluation()
    ;(adjacent.negativeBucket as { includeAdjacentCount: number }).includeAdjacentCount = 1
    expect(qualify(adjacent).qualified).toBe(false)
  })

  it('fails on a routing false negative in either evidence profile', () => {
    const evaluation = passingEvaluation()
    ;(
      evaluation.falseExclusions as {
        routingFalseExclusionsByEvidenceProfile: Record<string, number>
      }
    ).routingFalseExclusionsByEvidenceProfile.metadata_without_abstract = 1
    expect(qualify(evaluation).qualified).toBe(false)
  })

  it('fails below 100% bucket precision', () => {
    const evaluation = passingEvaluation()
    ;(evaluation.negativeBucket as { observedPrecisionBucket: number }).observedPrecisionBucket =
      0.99
    ;(evaluation.negativeBucket as { excludeCount: number }).excludeCount = 89
    ;(evaluation.negativeBucket as { includeAdjacentCount: number }).includeAdjacentCount = 1
    expect(qualify(evaluation).qualified).toBe(false)
  })

  it('fails below the 40% exclude-yield minimum', () => {
    const evaluation = passingEvaluation()
    ;(evaluation as { routedExcludeYieldAllExcludes: number }).routedExcludeYieldAllExcludes = 0.39
    expect(qualify(evaluation).qualified).toBe(false)
  })

  it('fails when a physician systematic-miss flag exists', () => {
    expect(qualify(passingEvaluation(), { systematicMissFlagCount: 1 }).qualified).toBe(false)
  })

  it('fails on incomplete denominator accounting', () => {
    const evaluation = passingEvaluation()
    ;(
      evaluation.reconciliation as { terminalStatesSumToSelected: boolean }
    ).terminalStatesSumToSelected = false
    expect(qualify(evaluation).qualified).toBe(false)
  })

  it('fails when the review interface does not cover every high-confidence negative', () => {
    expect(
      qualify(passingEvaluation(), {
        reviewInterfaceCoversAllHighConfidenceNegatives: false,
      }).qualified,
    ).toBe(false)
  })

  it('treats an empty bucket as vacuously precise but failing on yield', () => {
    const evaluation = passingEvaluation()
    const bucket = evaluation.negativeBucket as unknown as Record<string, number | null>
    bucket.count = 0
    bucket.excludeCount = 0
    bucket.observedPrecisionBucket = null
    bucket.lowRiskCount = 0
    bucket.lowRiskExcludeCount = 0
    bucket.lowRiskObservedPrecisionBucket = null
    ;(evaluation as { routedExcludeYieldAllExcludes: number }).routedExcludeYieldAllExcludes = 0
    const report = qualify(evaluation)
    expect(report.criteria.find((c) => c.id === 'bucket_precision_100')?.pass).toBe(true)
    expect(report.criteria.find((c) => c.id === 'exclude_yield_minimum')?.pass).toBe(false)
    expect(report.qualified).toBe(false)
  })

  it('refuses truth-free evaluations outright', () => {
    const evaluation = passingEvaluation()
    ;(evaluation as { truthAvailable: boolean }).truthAvailable = false
    expect(() => qualify(evaluation)).toThrow(/truth-scored/u)
  })
})
