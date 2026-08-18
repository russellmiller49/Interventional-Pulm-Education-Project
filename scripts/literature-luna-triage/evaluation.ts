import type { EvidenceProfile } from '../../src/features/literature/classifier/packet-contract'
import {
  isNegativeOnlyReasonCode,
  type StageAConfidenceBand,
  type StageATerminalState,
} from '../../src/features/literature/classifier/stage-a-contract'
import type { OverlayRelevance } from '../literature-reviewed-overlay/constants'
import { LUNA_EVALUATION_VERSION, LUNA_SUBGROUP_SUPPRESSION_MINIMUM } from './constants'
import type { RoutedRecord } from './routing'
import type { TerminalAssignment } from './results'

/**
 * Evaluation with denominator discipline.
 *
 * Every cohort record lands in exactly one terminal state, every metric name carries its
 * denominator, ratios over zero denominators are null (never NaN), subgroup rates below the
 * suppression minimum report support only, and the reconciliation identities are asserted
 * arithmetically — not merely by construction. A relevant article predicted
 * `insufficient_evidence` is an abstention, not a false exclusion; a relevant article routed
 * into the deprioritization pool is the failure the gate exists to catch.
 */

export interface EvaluationDenominators {
  readonly selected: number
  readonly attempted: number
  readonly validPredictions: number
  readonly validAbstentions: number
  readonly refusals: number
  readonly invalidQuarantined: number
  readonly missing: number
  readonly duplicate: number
  readonly noAttempt: number
}

export interface DenominatorReconciliation {
  readonly attemptedPlusNoAttemptEqualsSelected: boolean
  readonly terminalStatesSumToSelected: boolean
  readonly attemptedStatesSumToAttempted: boolean
}

export interface TruthBreakdown {
  readonly includeCore: number
  readonly includeAdjacent: number
  readonly exclude: number
}

export interface NegativeBucket {
  /** Valid high-confidence obvious_irrelevant with negative-only reasons (pre-risk). */
  readonly count: number
  readonly includeCoreCount: number
  readonly includeAdjacentCount: number
  readonly excludeCount: number
  /** Physician-exclude share of the bucket; null when the bucket is empty. */
  readonly observedPrecisionBucket: number | null
  /** Same bucket after the coordinator risk gate: the actual deprioritization pool. */
  readonly lowRiskCount: number
  readonly lowRiskIncludeCoreCount: number
  readonly lowRiskIncludeAdjacentCount: number
  readonly lowRiskExcludeCount: number
  readonly lowRiskObservedPrecisionBucket: number | null
}

export interface ClassifiedMetrics {
  readonly accuracyClassified: number | null
  readonly includeSensitivityClassifiedIncludes: number | null
  readonly excludePrecisionPredictedNegative: number | null
  readonly excludeSpecificityClassifiedExcludes: number | null
  readonly coreRecallClassifiedCore: number | null
  readonly adjacentRecallClassifiedAdjacent: number | null
}

export interface FalseExclusionMetrics {
  /** Any valid obvious_irrelevant prediction on a physician-relevant record. */
  readonly predictionFalseExclusions: number
  readonly predictionFalseExclusionRateAllRelevantSelected: number | null
  /** Physician-relevant records routed into the deprioritization pool. */
  readonly routingFalseExclusions: number
  readonly routingFalseExclusionRateAllRelevantSelected: number | null
  readonly routingFalseExclusionsByEvidenceProfile: Readonly<Record<EvidenceProfile, number>>
}

export interface SubgroupMetrics {
  readonly support: number
  readonly suppressed: boolean
  readonly accuracyClassified: number | null
  readonly predictionFalseExclusions: number | null
  readonly routingFalseExclusions: number | null
  readonly deprioritizedExcludeYieldAllExcludes: number | null
}

export interface EvaluationReport {
  readonly version: string
  readonly cohortLabel: string
  readonly truthAvailable: boolean
  readonly denominators: EvaluationDenominators
  readonly reconciliation: DenominatorReconciliation
  readonly classifiedCoverageAllSelected: number | null
  readonly abstentionCoverageAllSelected: number | null
  readonly truthBreakdownAllSelected: TruthBreakdown | null
  readonly classified: ClassifiedMetrics | null
  readonly falseExclusions: FalseExclusionMetrics | null
  readonly negativeBucket: NegativeBucket | null
  /** Deprioritized physician-excludes over all physician-excludes selected. */
  readonly routedExcludeYieldAllExcludes: number | null
  readonly confusionMatrix: Readonly<
    Record<OverlayRelevance, Readonly<Record<string, number>>>
  > | null
  readonly byEvidenceProfile: Readonly<Record<EvidenceProfile, SubgroupMetrics>> | null
  readonly byConfidenceBand: Readonly<Record<StageAConfidenceBand, SubgroupMetrics>> | null
  readonly reasonCodeDistribution: Readonly<Record<string, number>>
  readonly riskFlagDistribution: Readonly<Record<string, number>>
}

export function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

export class EvaluationSetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvaluationSetError'
  }
}

export interface EvaluationInputs {
  readonly cohortLabel: string
  /**
   * The one authoritative selected-record identity set. Every denominator derives from this,
   * never from whichever table an iteration happened to walk.
   */
  readonly selectedRecordIds: readonly string[]
  readonly routed: readonly RoutedRecord[]
  readonly assignments: readonly TerminalAssignment[]
  /** Physician class per record id; empty for non-calibration cohorts. */
  readonly truthByRecordId: ReadonlyMap<string, OverlayRelevance>
}

interface EvaluatedRow {
  readonly recordId: string
  readonly state: StageATerminalState
  readonly decision: string | null
  readonly confidence: StageAConfidenceBand | null
  readonly reasonCodes: readonly string[]
  readonly negativeOnlyReasons: boolean
  readonly route: RoutedRecord['route']
  readonly evidenceProfile: EvidenceProfile
  readonly riskFlags: readonly string[]
  readonly truth: OverlayRelevance | null
}

/**
 * Index one table by record id, refusing duplicates by name. A duplicate is a disagreement
 * between authorities, not something to collapse quietly into the last writer.
 */
function indexExactly<T extends { readonly recordId: string }>(
  rows: readonly T[],
  label: string,
): Map<string, T> {
  const byId = new Map<string, T>()
  for (const row of rows) {
    if (typeof row?.recordId !== 'string' || row.recordId.length === 0) {
      throw new EvaluationSetError(`A ${label} row has no record id; refusing to evaluate.`)
    }
    if (byId.has(row.recordId)) {
      throw new EvaluationSetError(`A record has more than one ${label} row; refusing to evaluate.`)
    }
    byId.set(row.recordId, row)
  }
  return byId
}

/**
 * Prove exact set equality between the authoritative selection and every table the report
 * reads. Missing, extra, duplicated, and wrong identities each refuse by name; iterating one
 * table and trusting the rest is precisely how a mismatched run reports itself as clean.
 */
function assertExactSetEquality(
  selected: ReadonlySet<string>,
  observed: ReadonlyMap<string, unknown>,
  label: string,
): void {
  for (const recordId of selected) {
    if (!observed.has(recordId)) {
      throw new EvaluationSetError(
        `A selected record has no ${label} row; refusing to evaluate an incomplete run.`,
      )
    }
  }
  for (const recordId of observed.keys()) {
    if (!selected.has(recordId)) {
      throw new EvaluationSetError(
        `A ${label} row names a record outside the selected cohort; refusing to evaluate.`,
      )
    }
  }
  if (observed.size !== selected.size) {
    throw new EvaluationSetError(
      `The ${label} table holds ${observed.size} records for ${selected.size} selected; ` +
        'refusing to evaluate.',
    )
  }
}

function buildRows(inputs: EvaluationInputs): EvaluatedRow[] {
  const selectedIds = inputs.selectedRecordIds
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    throw new EvaluationSetError('Evaluation requires the authoritative selected-record set.')
  }
  const selected = new Set(selectedIds)
  if (selected.size !== selectedIds.length) {
    throw new EvaluationSetError('The selected cohort contains a duplicate record id.')
  }
  const assignmentById = indexExactly(inputs.assignments, 'terminal assignment')
  const routedById = indexExactly(inputs.routed, 'routing')
  assertExactSetEquality(selected, assignmentById, 'terminal assignment')
  assertExactSetEquality(selected, routedById, 'routing')
  if (inputs.truthByRecordId.size > 0) {
    assertExactSetEquality(selected, inputs.truthByRecordId, 'physician truth')
  }
  // Rows are built from the authoritative selection, so every denominator counts the cohort.
  return selectedIds.map((recordId) => {
    const assignment = assignmentById.get(recordId) as TerminalAssignment
    const record = routedById.get(recordId) as RoutedRecord
    const output = assignment.output
    return {
      recordId,
      state: assignment.state,
      decision: output?.triage_decision ?? null,
      confidence: output?.confidence_band ?? null,
      reasonCodes: output?.reason_codes ?? [],
      negativeOnlyReasons:
        output !== null && output.reason_codes.every((code) => isNegativeOnlyReasonCode(code)),
      route: record.route,
      evidenceProfile: record.evidenceProfile,
      riskFlags: record.riskFlags,
      truth: inputs.truthByRecordId.get(record.recordId) ?? null,
    }
  })
}

function denominatorsOf(rows: readonly EvaluatedRow[]): EvaluationDenominators {
  const count = (state: StageATerminalState) => rows.filter((row) => row.state === state).length
  return {
    selected: rows.length,
    attempted: rows.length - count('no_attempt'),
    validPredictions: count('valid_prediction'),
    validAbstentions: count('valid_abstention'),
    refusals: count('refusal'),
    invalidQuarantined: count('invalid_quarantined'),
    missing: count('missing'),
    duplicate: count('duplicate'),
    noAttempt: count('no_attempt'),
  }
}

function reconcile(denominators: EvaluationDenominators): DenominatorReconciliation {
  const attemptedStates =
    denominators.validPredictions +
    denominators.validAbstentions +
    denominators.refusals +
    denominators.invalidQuarantined +
    denominators.missing +
    denominators.duplicate
  return {
    attemptedPlusNoAttemptEqualsSelected:
      denominators.attempted + denominators.noAttempt === denominators.selected,
    terminalStatesSumToSelected: attemptedStates + denominators.noAttempt === denominators.selected,
    attemptedStatesSumToAttempted: attemptedStates === denominators.attempted,
  }
}

const RELEVANT: readonly OverlayRelevance[] = ['include_core', 'include_adjacent']

function isCorrect(row: EvaluatedRow): boolean {
  if (row.truth === null || row.decision === null) return false
  if (row.decision === 'obvious_irrelevant') return row.truth === 'exclude'
  if (row.decision === 'potentially_relevant') return RELEVANT.includes(row.truth)
  return false
}

function inNegativeBucket(row: EvaluatedRow): boolean {
  return (
    row.state === 'valid_prediction' &&
    row.decision === 'obvious_irrelevant' &&
    row.confidence === 'high' &&
    row.negativeOnlyReasons
  )
}

function subgroupMetrics(rows: readonly EvaluatedRow[], truthAvailable: boolean): SubgroupMetrics {
  const support = rows.length
  const suppressed = support < LUNA_SUBGROUP_SUPPRESSION_MINIMUM
  if (suppressed || !truthAvailable) {
    return {
      support,
      suppressed,
      accuracyClassified: null,
      predictionFalseExclusions: null,
      routingFalseExclusions: null,
      deprioritizedExcludeYieldAllExcludes: null,
    }
  }
  const classified = rows.filter((row) => row.state === 'valid_prediction' && row.truth !== null)
  const relevant = rows.filter((row) => row.truth !== null && RELEVANT.includes(row.truth))
  const excludes = rows.filter((row) => row.truth === 'exclude')
  return {
    support,
    suppressed,
    accuracyClassified: ratio(classified.filter(isCorrect).length, classified.length),
    predictionFalseExclusions: relevant.filter(
      (row) => row.state === 'valid_prediction' && row.decision === 'obvious_irrelevant',
    ).length,
    routingFalseExclusions: relevant.filter((row) => row.route === 'deprioritization_candidate')
      .length,
    deprioritizedExcludeYieldAllExcludes: ratio(
      excludes.filter((row) => row.route === 'deprioritization_candidate').length,
      excludes.length,
    ),
  }
}

/** Build the full evaluation report. Aggregates only; no identity ever appears. */
export function buildEvaluationReport(inputs: EvaluationInputs): EvaluationReport {
  const rows = buildRows(inputs)
  const denominators = denominatorsOf(rows)
  const reconciliation = reconcile(denominators)
  if (
    !reconciliation.attemptedPlusNoAttemptEqualsSelected ||
    !reconciliation.terminalStatesSumToSelected ||
    !reconciliation.attemptedStatesSumToAttempted
  ) {
    throw new Error('Denominator reconciliation failed; the accounting is incomplete.')
  }

  const reasonCodeDistribution: Record<string, number> = {}
  const riskFlagDistribution: Record<string, number> = {}
  for (const row of rows) {
    for (const code of row.reasonCodes) {
      reasonCodeDistribution[code] = (reasonCodeDistribution[code] ?? 0) + 1
    }
    for (const flag of row.riskFlags) {
      riskFlagDistribution[flag] = (riskFlagDistribution[flag] ?? 0) + 1
    }
  }

  const truthAvailable = inputs.truthByRecordId.size > 0
  const base = {
    version: LUNA_EVALUATION_VERSION,
    cohortLabel: inputs.cohortLabel,
    truthAvailable,
    denominators,
    reconciliation,
    classifiedCoverageAllSelected: ratio(denominators.validPredictions, denominators.selected),
    abstentionCoverageAllSelected: ratio(denominators.validAbstentions, denominators.selected),
    reasonCodeDistribution,
    riskFlagDistribution,
  }
  if (!truthAvailable) {
    return {
      ...base,
      truthBreakdownAllSelected: null,
      classified: null,
      falseExclusions: null,
      negativeBucket: null,
      routedExcludeYieldAllExcludes: null,
      confusionMatrix: null,
      byEvidenceProfile: null,
      byConfidenceBand: null,
    }
  }

  for (const row of rows) {
    if (row.truth === null) {
      throw new Error(
        'A calibration cohort record has no physician truth; the cohort and truth ' +
          'authorities disagree.',
      )
    }
  }

  const classifiedRows = rows.filter((row) => row.state === 'valid_prediction')
  const includes = rows.filter((row) => RELEVANT.includes(row.truth as OverlayRelevance))
  const excludes = rows.filter((row) => row.truth === 'exclude')
  const classifiedIncludes = classifiedRows.filter((row) =>
    RELEVANT.includes(row.truth as OverlayRelevance),
  )
  const classifiedExcludes = classifiedRows.filter((row) => row.truth === 'exclude')
  const predictedNegative = classifiedRows.filter((row) => row.decision === 'obvious_irrelevant')
  const classifiedCore = classifiedRows.filter((row) => row.truth === 'include_core')
  const classifiedAdjacent = classifiedRows.filter((row) => row.truth === 'include_adjacent')

  const bucketRows = rows.filter(inNegativeBucket)
  const lowRiskBucketRows = bucketRows.filter((row) => row.riskFlags.length === 0)
  const bucketCounts = (subset: readonly EvaluatedRow[]) => ({
    core: subset.filter((row) => row.truth === 'include_core').length,
    adjacent: subset.filter((row) => row.truth === 'include_adjacent').length,
    exclude: subset.filter((row) => row.truth === 'exclude').length,
  })
  const bucket = bucketCounts(bucketRows)
  const lowRisk = bucketCounts(lowRiskBucketRows)

  const predictionFalseExclusions = includes.filter(
    (row) => row.state === 'valid_prediction' && row.decision === 'obvious_irrelevant',
  ).length
  const routingFalseExclusionRows = includes.filter(
    (row) => row.route === 'deprioritization_candidate',
  )
  const routingByProfile: Record<EvidenceProfile, number> = {
    metadata_with_abstract: 0,
    metadata_without_abstract: 0,
  }
  for (const row of routingFalseExclusionRows) {
    routingByProfile[row.evidenceProfile] += 1
  }

  const confusionMatrix = {} as Record<OverlayRelevance, Record<string, number>>
  for (const truthValue of ['include_core', 'include_adjacent', 'exclude'] as const) {
    confusionMatrix[truthValue] = {}
  }
  for (const row of rows) {
    const outcome =
      row.state === 'valid_prediction' || row.state === 'valid_abstention'
        ? (row.decision as string)
        : row.state
    const matrixRow = confusionMatrix[row.truth as OverlayRelevance]
    matrixRow[outcome] = (matrixRow[outcome] ?? 0) + 1
  }

  const byEvidenceProfile = {
    metadata_with_abstract: subgroupMetrics(
      rows.filter((row) => row.evidenceProfile === 'metadata_with_abstract'),
      true,
    ),
    metadata_without_abstract: subgroupMetrics(
      rows.filter((row) => row.evidenceProfile === 'metadata_without_abstract'),
      true,
    ),
  }
  const byConfidenceBand = {
    high: subgroupMetrics(
      rows.filter((row) => row.confidence === 'high'),
      true,
    ),
    medium: subgroupMetrics(
      rows.filter((row) => row.confidence === 'medium'),
      true,
    ),
    low: subgroupMetrics(
      rows.filter((row) => row.confidence === 'low'),
      true,
    ),
  }

  return {
    ...base,
    truthBreakdownAllSelected: {
      includeCore: rows.filter((row) => row.truth === 'include_core').length,
      includeAdjacent: rows.filter((row) => row.truth === 'include_adjacent').length,
      exclude: excludes.length,
    },
    classified: {
      accuracyClassified: ratio(classifiedRows.filter(isCorrect).length, classifiedRows.length),
      includeSensitivityClassifiedIncludes: ratio(
        classifiedIncludes.filter((row) => row.decision === 'potentially_relevant').length,
        classifiedIncludes.length,
      ),
      excludePrecisionPredictedNegative: ratio(
        predictedNegative.filter((row) => row.truth === 'exclude').length,
        predictedNegative.length,
      ),
      excludeSpecificityClassifiedExcludes: ratio(
        classifiedExcludes.filter((row) => row.decision === 'obvious_irrelevant').length,
        classifiedExcludes.length,
      ),
      coreRecallClassifiedCore: ratio(
        classifiedCore.filter((row) => row.decision === 'potentially_relevant').length,
        classifiedCore.length,
      ),
      adjacentRecallClassifiedAdjacent: ratio(
        classifiedAdjacent.filter((row) => row.decision === 'potentially_relevant').length,
        classifiedAdjacent.length,
      ),
    },
    falseExclusions: {
      predictionFalseExclusions,
      predictionFalseExclusionRateAllRelevantSelected: ratio(
        predictionFalseExclusions,
        includes.length,
      ),
      routingFalseExclusions: routingFalseExclusionRows.length,
      routingFalseExclusionRateAllRelevantSelected: ratio(
        routingFalseExclusionRows.length,
        includes.length,
      ),
      routingFalseExclusionsByEvidenceProfile: routingByProfile,
    },
    negativeBucket: {
      count: bucketRows.length,
      includeCoreCount: bucket.core,
      includeAdjacentCount: bucket.adjacent,
      excludeCount: bucket.exclude,
      observedPrecisionBucket: ratio(bucket.exclude, bucketRows.length),
      lowRiskCount: lowRiskBucketRows.length,
      lowRiskIncludeCoreCount: lowRisk.core,
      lowRiskIncludeAdjacentCount: lowRisk.adjacent,
      lowRiskExcludeCount: lowRisk.exclude,
      lowRiskObservedPrecisionBucket: ratio(lowRisk.exclude, lowRiskBucketRows.length),
    },
    routedExcludeYieldAllExcludes: ratio(
      excludes.filter((row) => row.route === 'deprioritization_candidate').length,
      excludes.length,
    ),
    confusionMatrix,
    byEvidenceProfile,
    byConfidenceBand,
  }
}
