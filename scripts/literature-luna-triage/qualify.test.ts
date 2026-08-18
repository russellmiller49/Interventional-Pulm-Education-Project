/** @jest-environment node */
import { checksumBody } from '../literature-production-ingest/canonical'
import type { EvaluationReport, NegativeBucket } from './evaluation'
import { buildFreezeReceipt, type FreezeReceipt } from './freeze'
import {
  buildQualificationEvidence,
  buildQualificationReport,
  evaluationReportSha256,
  lockedRunMarkerSha256,
  lockedSanityCohortIdentitySha256,
  QualificationEvidenceError,
  type LockedRunMarker,
  type QualificationEvidence,
  type QualificationInputs,
} from './qualify'
import { sortedIdentityDigest } from './split'

const CALIBRATION_VERSION = 'cal-v1'
const OPERATION_ID = 'locked-cal-v1'
const SPLIT_MANIFEST_SHA256 = 'a'.repeat(64)

/** A synthetic locked-sanity identity list of exactly 200 fabricated PMIDs. */
function lockedPmids(count = 200): string[] {
  return Array.from({ length: count }, (_unused, index) => String(900_100_000 + index))
}

function freezeReceipt(): FreezeReceipt {
  return buildFreezeReceipt(
    {
      calibrationVersion: CALIBRATION_VERSION,
      model: 'gpt-5.6-luna',
      modelAlias: null,
      reasoningEffort: 'low',
      promptText: 'SYNTHETIC PROMPT',
      splitManifestSha256: SPLIT_MANIFEST_SHA256,
    },
    '2026-08-17T00:00:00.000Z',
  )
}

/** Re-seal a mutated receipt so its own checksum is valid but its contents are wrong. */
function reseal(receipt: FreezeReceipt, overrides: Partial<FreezeReceipt>): FreezeReceipt {
  const body = { ...receipt, ...overrides, receiptSha256: '' }
  return { ...body, receiptSha256: checksumBody(body, 'receiptSha256') }
}

function marker(overrides: Partial<LockedRunMarker> = {}): LockedRunMarker {
  return {
    calibrationVersion: CALIBRATION_VERSION,
    operationId: OPERATION_ID,
    startedAt: '2026-08-17T01:00:00.000Z',
    ...overrides,
  }
}

function passingEvaluation(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
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
    ...overrides,
  }
}

function evidenceFor(
  evaluation: EvaluationReport,
  overrides: Partial<Parameters<typeof buildQualificationEvidence>[0]> = {},
): QualificationEvidence {
  const identity = sortedIdentityDigest(lockedPmids())
  return buildQualificationEvidence({
    calibrationVersion: CALIBRATION_VERSION,
    operationId: OPERATION_ID,
    cohortLabel: 'locked-sanity-200',
    selectedCount: evaluation.denominators.selected,
    cohortIdentitySha256: identity,
    splitLockedSanityIdentitySha256: identity,
    splitManifestSha256: SPLIT_MANIFEST_SHA256,
    freezeReceipt: freezeReceipt(),
    lockedRunMarker: marker(),
    evaluationReportSha256: evaluationReportSha256(evaluation),
    ...overrides,
  })
}

function qualify(
  evaluation: EvaluationReport,
  overrides: Partial<Omit<QualificationInputs, 'evaluation'>> = {},
) {
  return buildQualificationReport({
    evaluation,
    evidence: overrides.evidence ?? evidenceFor(evaluation),
    systematicMissFlagCount: overrides.systematicMissFlagCount ?? 0,
    reviewInterfaceCoversAllHighConfidenceNegatives:
      overrides.reviewInterfaceCoversAllHighConfidenceNegatives ?? true,
    observedRunMarkerSha256s: overrides.observedRunMarkerSha256s ?? [],
  })
}

describe('qualification gate', () => {
  it('qualifies only when all eight criteria pass over bound locked-sanity-200 evidence', () => {
    const report = qualify(passingEvaluation())
    expect(report.criteria).toHaveLength(8)
    expect(report.criteria.every((criterion) => criterion.pass)).toBe(true)
    expect(report.qualified).toBe(true)
    expect(report.calibrationVersion).toBe(CALIBRATION_VERSION)
    expect(report.evidenceSha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(report.lockedRunMarkerSha256).toBe(lockedRunMarkerSha256(marker()))
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

/**
 * LUNA-QUALIFY-001. Qualification may run only from the exact frozen locked-sanity-200
 * evaluation, bound by checksum to its calibration surface, its consumed pristine run, and its
 * own artifact. The original reproduction — a one-record `development-430` evaluation reporting
 * qualified — must refuse, and so must every other undersized, wrong-cohort, unbound, or stale
 * evaluation.
 */
describe('locked-sanity-200 evidence binding (LUNA-QUALIFY-001)', () => {
  it('refuses the original development-430 reproduction', () => {
    const evaluation = passingEvaluation({
      cohortLabel: 'development-430',
      denominators: { ...passingEvaluation().denominators, selected: 1, attempted: 1 },
    })
    expect(() =>
      qualify(evaluation, {
        evidence: evidenceFor(evaluation, { cohortLabel: 'development-430', selectedCount: 1 }),
      }),
    ).toThrow(/defined only for the frozen locked-sanity-200 cohort/u)
  })

  it.each([1, 199, 201, 0])('refuses a cohort of %i selected records', (selected) => {
    const evaluation = passingEvaluation({
      denominators: { ...passingEvaluation().denominators, selected },
    })
    expect(() =>
      qualify(evaluation, { evidence: evidenceFor(evaluation, { selectedCount: selected }) }),
    ).toThrow(/exactly 200 selected records/u)
  })

  it('refuses a wrong cohort label on either side of the binding', () => {
    const evaluation = passingEvaluation({ cohortLabel: 'pilot-1000' })
    expect(() => qualify(evaluation)).toThrow(/defined only for the frozen/u)
    const mislabelled = passingEvaluation()
    expect(() =>
      qualify(mislabelled, { evidence: evidenceFor(mislabelled, { cohortLabel: 'smoke-30' }) }),
    ).toThrow(/defined only for the frozen/u)
  })

  it('refuses when the evaluated identities are not exactly the frozen locked-sanity set', () => {
    const evaluation = passingEvaluation()
    const other = sortedIdentityDigest(lockedPmids().map((pmid) => `9${pmid}`))
    expect(() =>
      qualify(evaluation, { evidence: evidenceFor(evaluation, { cohortIdentitySha256: other }) }),
    ).toThrow(/not exactly the frozen locked-sanity identities/u)
  })

  it('refuses a duplicated, missing, or extra locked identity before a digest exists', () => {
    const duplicated = lockedPmids()
    duplicated[199] = duplicated[0]
    expect(() => lockedSanityCohortIdentitySha256(duplicated)).toThrow(/duplicate identity/u)
    expect(() => lockedSanityCohortIdentitySha256(lockedPmids(199))).toThrow(/not exactly 200/u)
    expect(() => lockedSanityCohortIdentitySha256(lockedPmids(201))).toThrow(/not exactly 200/u)
    expect(lockedSanityCohortIdentitySha256(lockedPmids())).toBe(
      sortedIdentityDigest(lockedPmids()),
    )
  })

  it('refuses a wrong or mutated freeze receipt', () => {
    const evaluation = passingEvaluation()
    const tampered = { ...freezeReceipt(), model: 'gpt-other' }
    expect(() =>
      qualify(evaluation, { evidence: evidenceFor(evaluation, { freezeReceipt: tampered }) }),
    ).toThrow(/checksum does not bind/u)
    const promptDrift = { ...freezeReceipt(), promptSha256: 'b'.repeat(64) }
    expect(() =>
      qualify(evaluation, { evidence: evidenceFor(evaluation, { freezeReceipt: promptDrift }) }),
    ).toThrow(/checksum does not bind/u)
  })

  it('refuses a re-sealed receipt whose frozen surfaces no longer match what would run', () => {
    const evaluation = passingEvaluation()
    const drifts: readonly [Partial<FreezeReceipt>, RegExp][] = [
      [{ outputSchemaSha256: 'c'.repeat(64) }, /output-schema hash/u],
      [{ reasonVocabularySha256: 'c'.repeat(64) }, /reason-vocabulary hash/u],
      [{ stageAContractVersion: 'literature-luna-stage-a/9.9.9' }, /stage-a contract version/u],
      [{ packetSchemaVersion: 'literature-luna-packet/9.9.9' }, /packet-schema version/u],
      [{ riskLexiconVersion: 'literature-luna-risk-lexicon/9.9.9' }, /risk-lexicon version/u],
      [{ evaluationVersion: 'literature-luna-evaluation/9.9.9' }, /evaluation version/u],
      [{ costEstimatorVersion: 'literature-luna-cost-estimator/9.9.9' }, /cost-estimator version/u],
    ]
    for (const [override, pattern] of drifts) {
      expect(() =>
        qualify(evaluation, {
          evidence: evidenceFor(evaluation, { freezeReceipt: reseal(freezeReceipt(), override) }),
        }),
      ).toThrow(pattern)
    }
  })

  it('refuses a wrong calibration version or a wrong split manifest', () => {
    const evaluation = passingEvaluation()
    expect(() =>
      qualify(evaluation, {
        evidence: evidenceFor(evaluation, { calibrationVersion: 'cal-v2' }),
      }),
    ).toThrow(/different calibration version/u)
    expect(() =>
      qualify(evaluation, {
        evidence: evidenceFor(evaluation, { splitManifestSha256: 'd'.repeat(64) }),
      }),
    ).toThrow(/different split manifest/u)
    expect(() =>
      qualify(evaluation, {
        evidence: evidenceFor(evaluation, {
          freezeReceipt: reseal(freezeReceipt(), { splitManifestSha256: 'e'.repeat(64) }),
        }),
      }),
    ).toThrow(/different split manifest/u)
  })

  it('refuses a wrong, foreign, or mutated locked-run marker', () => {
    const evaluation = passingEvaluation()
    expect(() =>
      qualify(evaluation, {
        evidence: evidenceFor(evaluation, {
          lockedRunMarker: marker({ calibrationVersion: 'cal-v2' }),
        }),
      }),
    ).toThrow(/another calibration version/u)
    expect(() =>
      qualify(evaluation, {
        evidence: evidenceFor(evaluation, { lockedRunMarker: marker({ operationId: 'op-other' }) }),
      }),
    ).toThrow(/another operation/u)
    const bound = evidenceFor(evaluation)
    const mutated: QualificationEvidence = {
      ...bound,
      lockedRunMarker: marker({ startedAt: '2026-08-18T00:00:00.000Z' }),
    }
    expect(() => qualify(evaluation, { evidence: mutated })).toThrow(/checksum does not bind/u)
  })

  it('refuses an evaluation artifact changed after the run', () => {
    const evaluation = passingEvaluation()
    const evidence = evidenceFor(evaluation)
    const edited = passingEvaluation()
    ;(edited.negativeBucket as { lowRiskExcludeCount: number }).lowRiskExcludeCount = 61
    expect(() => qualify(edited, { evidence })).toThrow(/changed after the run/u)
  })

  it('refuses an evaluation produced by another evaluation version', () => {
    const evaluation = passingEvaluation({ version: 'literature-luna-evaluation/0.9.0' })
    expect(() => qualify(evaluation)).toThrow(/another evaluation version/u)
  })

  it('refuses evidence whose own checksum does not bind it', () => {
    const evaluation = passingEvaluation()
    const forged: QualificationEvidence = { ...evidenceFor(evaluation), selectedCount: 200 }
    const broken: QualificationEvidence = { ...forged, evidenceSha256: 'f'.repeat(64) }
    expect(() => qualify(evaluation, { evidence: broken })).toThrow(QualificationEvidenceError)
  })

  it('refuses a repeat qualification from an already-consumed pristine run', () => {
    const evaluation = passingEvaluation()
    const evidence = evidenceFor(evaluation)
    expect(qualify(evaluation, { evidence }).qualified).toBe(true)
    expect(() =>
      qualify(evaluation, {
        evidence,
        observedRunMarkerSha256s: [evidence.lockedRunMarkerSha256],
      }),
    ).toThrow(/already observed/u)
  })
})
