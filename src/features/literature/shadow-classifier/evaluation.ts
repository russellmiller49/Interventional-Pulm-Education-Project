import { z } from 'zod'

import { immutableShadowValue, sha256ShadowValue } from './canonical'
import {
  evaluateShadowProbabilityCalibration,
  SHADOW_RELEVANCE_LABELS,
  type ShadowProbabilityCalibrationMetrics,
  type ShadowProbabilityEvaluationRow,
  type ShadowRelevanceLabel,
} from './calibration'
import {
  assertDevelopmentArticleAuthorized,
  developmentShadowScopeDescriptor,
  LITERATURE_DEVELOPMENT_COHORT_SIZE,
  type AuthorizedDevelopmentShadowScope,
} from './held-out-guard'
import {
  verifyShadowRunArtifact,
  type ShadowRunArtifact,
  type ShadowRunAttempt,
} from './shadow-run'
import {
  assertAuthorizedShadowDevelopmentTruth,
  type AuthorizedShadowDevelopmentTruth,
  type ShadowDevelopmentTruthRow,
} from './development-truth-authority'

export const SHADOW_DEVELOPMENT_EVALUATION_SCHEMA_VERSION =
  'literature-shadow-development-evaluation/1.0.0' as const
export const SHADOW_MINIMUM_SUBGROUP_SIZE = 20 as const
export const SHADOW_MINIMUM_METRIC_DENOMINATOR = 5 as const

export type ShadowEvaluationTruthRow = ShadowDevelopmentTruthRow

export interface ShadowAttemptDenominators {
  selected: number
  attempted: number
  acceptedPrediction: number
  acceptedAbstention: number
  acceptedRefusal: number
  rejectedInvalid: number
  rejectedMissing: number
  noAttempt: number
}

export interface ShadowSubgroupMetric {
  dimension: string
  value: string
  support: number
  suppressed: boolean
  predictionCoverageRate: number | null
  falseExclusionCount: number | null
  falseExclusionRateAmongGoldIncluded: number | null
}

interface EvaluatedRow {
  truth: ShadowEvaluationTruthRow
  attempt: ShadowRunAttempt | null
  status: 'prediction' | 'abstention' | 'refusal' | 'invalid' | 'missing_result' | 'no_attempt'
  prediction: ShadowRelevanceLabel | null
  modelEvidenceMode: 'metadata_only' | 'full_text_available_not_cited' | 'full_text_cited'
}

function strictTruthArtifact(
  artifact: AuthorizedShadowDevelopmentTruth,
  scope: AuthorizedDevelopmentShadowScope,
): ShadowEvaluationTruthRow[] {
  assertAuthorizedShadowDevelopmentTruth(artifact)
  const descriptor = developmentShadowScopeDescriptor(scope)
  if (
    descriptor.authorityClass !== 'real_development_membership' ||
    !descriptor.experimentEligible ||
    artifact.developmentMembershipSha256 !== descriptor.developmentMembershipSha256 ||
    artifact.rowCount !== LITERATURE_DEVELOPMENT_COHORT_SIZE
  ) {
    throw new Error(
      'Evaluation requires exact real 630 development membership and truth authority.',
    )
  }
  const rows = artifact.rows.map((row) => {
    assertDevelopmentArticleAuthorized(scope, row.pmid)
    return row
  })
  if (
    rows.length !== LITERATURE_DEVELOPMENT_COHORT_SIZE ||
    new Set(rows.map((row) => row.pmid)).size !== rows.length
  ) {
    throw new Error('Coordinator truth must cover exactly 630 unique authorized PMIDs.')
  }
  return rows.sort(
    (left, right) => left.pmid.length - right.pmid.length || left.pmid.localeCompare(right.pmid),
  )
}

function evaluatedRows(
  truthRows: readonly ShadowEvaluationTruthRow[],
  artifact: ShadowRunArtifact,
): EvaluatedRow[] {
  const relevanceAttempts = artifact.attempts.filter(
    (attempt) => attempt.componentId === 'ip_relevance',
  )
  const byPmid = new Map<string, ShadowRunAttempt>()
  for (const attempt of relevanceAttempts) {
    const pmid = attempt.packetEnvelope.packet.modelInput.article.pmid
    if (byPmid.has(pmid)) throw new Error(`Duplicate ip_relevance attempt for PMID ${pmid}.`)
    byPmid.set(pmid, attempt)
  }
  const truthPmids = new Set(truthRows.map((row) => row.pmid))
  if ([...byPmid].some(([pmid]) => !truthPmids.has(pmid))) {
    throw new Error('Evaluation run contains an ip_relevance attempt outside exact truth.')
  }
  return truthRows.map((truth) => {
    const attempt = byPmid.get(truth.pmid) ?? null
    if (!attempt)
      return {
        truth,
        attempt,
        status: 'no_attempt',
        prediction: null,
        modelEvidenceMode: 'metadata_only',
      }
    const article = attempt.packetEnvelope.packet.modelInput.article
    const citedFullText =
      attempt.validation.valid &&
      attempt.validation.result.response.evidenceUsed.some(
        (evidence) => evidence.field === 'full_text',
      )
    const modelEvidenceMode = citedFullText
      ? ('full_text_cited' as const)
      : article.fullText.availability === 'available'
        ? ('full_text_available_not_cited' as const)
        : ('metadata_only' as const)
    if (!attempt.validation.valid) {
      return {
        truth,
        attempt,
        status: attempt.validation.status === 'rejected_missing' ? 'missing_result' : 'invalid',
        prediction: null,
        modelEvidenceMode,
      }
    }
    const response = attempt.validation.result.response
    if (response.state !== 'prediction') {
      return { truth, attempt, status: response.state, prediction: null, modelEvidenceMode }
    }
    const prediction = z.enum(SHADOW_RELEVANCE_LABELS).parse(response.outputValues[0])
    return { truth, attempt, status: 'prediction', prediction, modelEvidenceMode }
  })
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

function subgroupRows(rows: readonly EvaluatedRow[]): ShadowSubgroupMetric[] {
  const memberships: Array<{ dimension: string; value: string; row: EvaluatedRow }> = []
  for (const row of rows) {
    const singleton: Array<[string, string]> = [
      ['metadata_sufficiency', row.truth.metadataSufficiency],
      ['study_design', row.truth.studyDesign || 'missing'],
      ['publication_status', row.truth.publicationStatus || 'missing'],
      ['journal', row.truth.journal || 'missing'],
      ['publication_year', String(row.truth.publicationYear)],
      ['model_evidence_mode', row.modelEvidenceMode],
      [
        'reference_standard_evidence_mode',
        row.truth.fullTextUsed ? 'full_text_used' : 'metadata_only',
      ],
    ]
    for (const [dimension, value] of singleton) memberships.push({ dimension, value, row })
    for (const [dimension, values] of [
      ['topic', row.truth.topicIds],
      ['technology', row.truth.technologyTags],
      ['clinical_purpose', row.truth.clinicalPurposes],
      ['disease', row.truth.diseaseTags],
    ] as const) {
      for (const value of values) memberships.push({ dimension, value, row })
    }
  }
  const grouped = new Map<string, { dimension: string; value: string; rows: EvaluatedRow[] }>()
  for (const membership of memberships) {
    const key = `${membership.dimension}\0${membership.value}`
    const group = grouped.get(key) ?? {
      dimension: membership.dimension,
      value: membership.value,
      rows: [],
    }
    group.rows.push(membership.row)
    grouped.set(key, group)
  }
  return [...grouped.values()]
    .sort(
      (left, right) =>
        left.dimension.localeCompare(right.dimension) || left.value.localeCompare(right.value),
    )
    .map((group) => {
      const suppressed = group.rows.length < SHADOW_MINIMUM_SUBGROUP_SIZE
      const included = group.rows.filter((row) => row.truth.relevanceLabel !== 'exclude')
      const falseExclusions = included.filter((row) => row.prediction === 'exclude').length
      return {
        dimension: group.dimension,
        value: group.value,
        support: group.rows.length,
        suppressed,
        predictionCoverageRate: suppressed
          ? null
          : ratio(
              group.rows.filter((row) => row.status === 'prediction').length,
              group.rows.length,
            ),
        falseExclusionCount: suppressed ? null : falseExclusions,
        falseExclusionRateAmongGoldIncluded: suppressed
          ? null
          : ratio(falseExclusions, included.length),
      }
    })
}

export interface ShadowDevelopmentEvaluationArtifact {
  schemaVersion: typeof SHADOW_DEVELOPMENT_EVALUATION_SCHEMA_VERSION
  developmentOnly: true
  heldOutValidation: false
  truthArtifactSha256: string
  runArtifactSha256: string
  fullCohortAccounting: { authorized: boolean; reasons: readonly string[] }
  allValidClassifications: { authorized: boolean; reasons: readonly string[] }
  denominators: ShadowAttemptDenominators
  falseExclusionPrimary: {
    definition: 'gold include_core/include_adjacent predicted exclude'
    count: number
    denominatorGoldIncludedAllSelected: number
    rate: number | null
  }
  highConfidenceFalseExclusions: {
    candidateThreshold: 0.9
    operationalThresholdSelected: false
    count: number
  }
  endToEnd: {
    exactLabelAccuracyAllSelected: number | null
    binaryIncludeSensitivityAllSelected: number | null
    binaryExcludeSpecificityAllSelected: number | null
    includePrecisionAcceptedPredictions: number | null
    excludePrecisionAcceptedPredictions: number | null
    coreRecallAllSelected: number | null
    adjacentRecallAllSelected: number | null
  }
  perClass: readonly {
    label: ShadowRelevanceLabel
    supportAllSelected: number
    truePositive: number
    falsePositive: number
    falseNegative: number
    precisionAcceptedPredictions: number | null
    recallAllSelected: number | null
    f1: number | null
  }[]
  confusionMatrixAcceptedPredictions: Readonly<
    Record<ShadowRelevanceLabel, Readonly<Record<ShadowRelevanceLabel, number>>>
  >
  outcomeRatesAllSelected: {
    predictionCoverage: number
    abstentionRate: number
    refusalRate: number
    invalidRate: number
    missingRate: number
  }
  selective: {
    exactLabelAccuracyAcceptedPredictions: number | null
    predictionCoverageRate: number | null
  }
  rawProbabilityMetrics: ShadowProbabilityCalibrationMetrics
  candidateThresholdCurve: readonly {
    candidateThreshold: number
    operationalThresholdSelected: false
    coverageCount: number
    coverageRateAllSelected: number
    falseExclusionCount: number
    falseExclusionRateAllGoldIncluded: number | null
    binaryIncludeSensitivityAllGoldIncluded: number | null
    binaryExcludeSpecificityAllGoldExcluded: number | null
  }[]
  subgroups: readonly ShadowSubgroupMetric[]
  artifactSha256: string
}

export function evaluateExactShadowDevelopmentRun(input: {
  scope: AuthorizedDevelopmentShadowScope
  truth: AuthorizedShadowDevelopmentTruth
  run: ShadowRunArtifact
}): Readonly<ShadowDevelopmentEvaluationArtifact> {
  verifyShadowRunArtifact(input.run, input.scope)
  const truthRows = strictTruthArtifact(input.truth, input.scope)
  const rows = evaluatedRows(truthRows, input.run)
  const denominators: ShadowAttemptDenominators = {
    selected: rows.length,
    attempted: rows.filter((row) => row.attempt !== null).length,
    acceptedPrediction: rows.filter((row) => row.status === 'prediction').length,
    acceptedAbstention: rows.filter((row) => row.status === 'abstention').length,
    acceptedRefusal: rows.filter((row) => row.status === 'refusal').length,
    rejectedInvalid: rows.filter((row) => row.status === 'invalid').length,
    rejectedMissing: rows.filter((row) => row.status === 'missing_result').length,
    noAttempt: rows.filter((row) => row.status === 'no_attempt').length,
  }
  const goldIncluded = rows.filter((row) => row.truth.relevanceLabel !== 'exclude')
  const goldExcluded = rows.filter((row) => row.truth.relevanceLabel === 'exclude')
  const falseExclusions = goldIncluded.filter((row) => row.prediction === 'exclude')
  const predictions = rows.filter(
    (row): row is EvaluatedRow & { prediction: ShadowRelevanceLabel; attempt: ShadowRunAttempt } =>
      row.status === 'prediction' && row.prediction !== null && row.attempt !== null,
  )
  const probabilityRows: ShadowProbabilityEvaluationRow[] = predictions.map((row) => ({
    pmid: row.truth.pmid,
    truthLabel: row.truth.relevanceLabel,
    predictedLabel: row.prediction,
    probabilities: row.attempt.validation.valid
      ? row.attempt.validation.result.response.probabilities
      : null,
  }))
  const rawProbabilityMetrics = evaluateShadowProbabilityCalibration({ rows: probabilityRows })
  const validProbabilityByPmid = new Map(
    predictions.flatMap((row) => {
      const probabilities = row.attempt.validation.valid
        ? row.attempt.validation.result.response.probabilities
        : null
      if (
        !probabilities ||
        probabilities.source !== 'model_supplied' ||
        probabilities.calibrated !== false
      )
        return []
      const confidence = Math.max(...Object.values(probabilities.values))
      return [[row.truth.pmid, confidence] as const]
    }),
  )
  const highConfidenceFalseExclusions = falseExclusions.filter(
    (row) => (validProbabilityByPmid.get(row.truth.pmid) ?? -1) >= 0.9,
  ).length
  const classMetrics = SHADOW_RELEVANCE_LABELS.map((label) => {
    const support = rows.filter((row) => row.truth.relevanceLabel === label).length
    const truePositive = rows.filter(
      (row) => row.truth.relevanceLabel === label && row.prediction === label,
    ).length
    const falsePositive = rows.filter(
      (row) => row.truth.relevanceLabel !== label && row.prediction === label,
    ).length
    const falseNegative = support - truePositive
    const precision = ratio(truePositive, truePositive + falsePositive)
    const recall = ratio(truePositive, support)
    return {
      label,
      supportAllSelected: support,
      truePositive,
      falsePositive,
      falseNegative,
      precisionAcceptedPredictions: precision,
      recallAllSelected: recall,
      f1:
        precision === null || recall === null || precision + recall === 0
          ? null
          : (2 * precision * recall) / (precision + recall),
    }
  })
  const confusionMatrixAcceptedPredictions = Object.fromEntries(
    SHADOW_RELEVANCE_LABELS.map((truthLabel) => [
      truthLabel,
      Object.fromEntries(
        SHADOW_RELEVANCE_LABELS.map((predictionLabel) => [
          predictionLabel,
          predictions.filter(
            (row) => row.truth.relevanceLabel === truthLabel && row.prediction === predictionLabel,
          ).length,
        ]),
      ),
    ]),
  ) as Record<ShadowRelevanceLabel, Record<ShadowRelevanceLabel, number>>
  const accountingReasons: string[] = []
  if (rows.length !== 630) accountingReasons.push('truth_not_exact_630')
  if (denominators.attempted !== 630 || denominators.noAttempt > 0)
    accountingReasons.push('attempt_accounting_not_exact_630')
  if (input.run.scope.authorityClass !== 'real_development_membership')
    accountingReasons.push('not_real_development_authority')
  const validClassificationReasons = [...accountingReasons]
  if (
    denominators.acceptedPrediction !== 630 ||
    denominators.acceptedAbstention > 0 ||
    denominators.rejectedMissing > 0 ||
    denominators.rejectedInvalid > 0 ||
    denominators.acceptedRefusal > 0
  )
    validClassificationReasons.push('not_all_valid_predictions')
  const candidateThresholdCurve = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((candidateThreshold) => {
    const covered = rows.filter(
      (row) => (validProbabilityByPmid.get(row.truth.pmid) ?? -1) >= candidateThreshold,
    )
    return {
      candidateThreshold,
      operationalThresholdSelected: false as const,
      coverageCount: covered.length,
      coverageRateAllSelected: covered.length / rows.length,
      falseExclusionCount: covered.filter(
        (row) => row.truth.relevanceLabel !== 'exclude' && row.prediction === 'exclude',
      ).length,
      falseExclusionRateAllGoldIncluded: ratio(
        covered.filter(
          (row) => row.truth.relevanceLabel !== 'exclude' && row.prediction === 'exclude',
        ).length,
        goldIncluded.length,
      ),
      binaryIncludeSensitivityAllGoldIncluded: ratio(
        covered.filter(
          (row) =>
            row.truth.relevanceLabel !== 'exclude' &&
            (row.prediction === 'include_core' || row.prediction === 'include_adjacent'),
        ).length,
        goldIncluded.length,
      ),
      binaryExcludeSpecificityAllGoldExcluded: ratio(
        covered.filter(
          (row) => row.truth.relevanceLabel === 'exclude' && row.prediction === 'exclude',
        ).length,
        goldExcluded.length,
      ),
    }
  })
  const withoutHash = {
    schemaVersion: SHADOW_DEVELOPMENT_EVALUATION_SCHEMA_VERSION,
    developmentOnly: true as const,
    heldOutValidation: false as const,
    truthArtifactSha256: input.truth.truthArtifactSha256,
    runArtifactSha256: input.run.artifactSha256,
    fullCohortAccounting: {
      authorized: accountingReasons.length === 0,
      reasons: accountingReasons,
    },
    allValidClassifications: {
      authorized: validClassificationReasons.length === 0,
      reasons: validClassificationReasons,
    },
    denominators,
    falseExclusionPrimary: {
      definition: 'gold include_core/include_adjacent predicted exclude' as const,
      count: falseExclusions.length,
      denominatorGoldIncludedAllSelected: goldIncluded.length,
      rate: ratio(falseExclusions.length, goldIncluded.length),
    },
    highConfidenceFalseExclusions: {
      candidateThreshold: 0.9 as const,
      operationalThresholdSelected: false as const,
      count: highConfidenceFalseExclusions,
    },
    endToEnd: {
      exactLabelAccuracyAllSelected: ratio(
        rows.filter((row) => row.prediction === row.truth.relevanceLabel).length,
        rows.length,
      ),
      binaryIncludeSensitivityAllSelected: ratio(
        goldIncluded.filter(
          (row) => row.prediction === 'include_core' || row.prediction === 'include_adjacent',
        ).length,
        goldIncluded.length,
      ),
      binaryExcludeSpecificityAllSelected: ratio(
        goldExcluded.filter((row) => row.prediction === 'exclude').length,
        goldExcluded.length,
      ),
      includePrecisionAcceptedPredictions: ratio(
        predictions.filter(
          (row) =>
            row.truth.relevanceLabel !== 'exclude' &&
            (row.prediction === 'include_core' || row.prediction === 'include_adjacent'),
        ).length,
        predictions.filter(
          (row) => row.prediction === 'include_core' || row.prediction === 'include_adjacent',
        ).length,
      ),
      excludePrecisionAcceptedPredictions: ratio(
        goldExcluded.filter((row) => row.prediction === 'exclude').length,
        predictions.filter((row) => row.prediction === 'exclude').length,
      ),
      coreRecallAllSelected:
        classMetrics.find((metric) => metric.label === 'include_core')?.recallAllSelected ?? null,
      adjacentRecallAllSelected:
        classMetrics.find((metric) => metric.label === 'include_adjacent')?.recallAllSelected ??
        null,
    },
    perClass: classMetrics,
    confusionMatrixAcceptedPredictions,
    outcomeRatesAllSelected: {
      predictionCoverage: predictions.length / rows.length,
      abstentionRate: denominators.acceptedAbstention / rows.length,
      refusalRate: denominators.acceptedRefusal / rows.length,
      invalidRate: denominators.rejectedInvalid / rows.length,
      missingRate: (denominators.rejectedMissing + denominators.noAttempt) / rows.length,
    },
    selective: {
      exactLabelAccuracyAcceptedPredictions: ratio(
        predictions.filter((row) => row.prediction === row.truth.relevanceLabel).length,
        predictions.length,
      ),
      predictionCoverageRate: ratio(predictions.length, rows.length),
    },
    rawProbabilityMetrics,
    candidateThresholdCurve,
    subgroups: subgroupRows(rows),
  }
  return immutableShadowValue({ ...withoutHash, artifactSha256: sha256ShadowValue(withoutHash) })
}

export function compareFirstAndAdjudicationShadowRuns(input: {
  first: ShadowDevelopmentEvaluationArtifact
  adjudication: ShadowDevelopmentEvaluationArtifact
}): Readonly<{
  comparison: 'first_vs_adjudication'
  truthArtifactSha256: string
  firstRunArtifactSha256: string
  adjudicationRunArtifactSha256: string
  falseExclusionCountDelta: number
  predictionCoverageRateDelta: number | null
}> {
  if (input.first.truthArtifactSha256 !== input.adjudication.truthArtifactSha256) {
    throw new Error('First/adjudication comparison requires identical authenticated truth.')
  }
  if (input.first.runArtifactSha256 === input.adjudication.runArtifactSha256) {
    throw new Error('First/adjudication comparison requires distinct run artifacts.')
  }
  const left = input.first.selective.predictionCoverageRate
  const right = input.adjudication.selective.predictionCoverageRate
  return immutableShadowValue({
    comparison: 'first_vs_adjudication',
    truthArtifactSha256: input.first.truthArtifactSha256,
    firstRunArtifactSha256: input.first.runArtifactSha256,
    adjudicationRunArtifactSha256: input.adjudication.runArtifactSha256,
    falseExclusionCountDelta:
      input.adjudication.falseExclusionPrimary.count - input.first.falseExclusionPrimary.count,
    predictionCoverageRateDelta: left === null || right === null ? null : right - left,
  })
}
