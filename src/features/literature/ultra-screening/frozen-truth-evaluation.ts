import { randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  compareNumericPmids,
  sha256Text,
  stableJson,
  ultraScreeningResultSchema,
  ULTRA_RELEVANCE_LABELS,
  type UltraRelevanceLabel,
  type UltraScreeningResult,
} from './core'

export const ULTRA_FROZEN_TRUTH_EVALUATION_SCHEMA_VERSION = '2.0.0' as const
export const ULTRA_FROZEN_TRUTH_EVALUATION_DIRECTORY = 'frozen-truth-v2' as const
export const ULTRA_FROZEN_TRUTH_BUNDLE_RECEIPT_VERSION = '1.0.0' as const
export const ULTRA_ENRICHED_DEVELOPMENT_WARNING =
  'pilot-v1 is enriched development data. These metrics are workflow diagnostics and must not be interpreted as corpus prevalence, held-out performance, or evidence that automatic exclusion is safe.' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const GIT_COMMIT_PATTERN = /^[a-f0-9]{40,64}$/u
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u

export interface UltraFrozenTruthEvaluationProvenance {
  predictionRunId: string
  predictionPhase: string
  predictionAggregateSha256: string
  predictionAttemptProvenanceStatus: 'fully_recorded' | 'unavailable_legacy'
  screeningPolicyRecordPath: string
  screeningPolicyVersion: string
  screeningPolicySha256: string
  workerPromptTemplateRecordPath: string
  workerPromptTemplateVersion: string
  workerPromptTemplateSha256: string
  repositoryCommit: string
  truthBatchName: string
  truthBatchStatus: 'frozen'
  truthBatchFrozenAt: string
  truthFullHistoryJsonSha256: string
  truthExportedAt: string
  selectionAudits: readonly {
    path: string
    sha256: string
  }[]
}

export interface UltraFrozenTruthRow {
  pmid: string
  relevanceLabel: UltraRelevanceLabel
}

export interface UltraEvaluationSubsetInput {
  noAbstractPmids?: readonly string[]
  animalPreclinicalPmids?: readonly string[]
}

export interface UltraEvaluationComparisonInput {
  comparisonId: string
  predictionRunId: string
  predictionPhase: string
  predictionAggregateSha256: string
  predictions: readonly UltraScreeningResult[]
}

export interface UltraFrozenTruthEvaluationInput {
  evaluationId: string
  evaluationTimestamp: string
  provenance: UltraFrozenTruthEvaluationProvenance
  truth: readonly UltraFrozenTruthRow[]
  predictions: readonly UltraScreeningResult[]
  subsets?: UltraEvaluationSubsetInput
  comparisons?: readonly UltraEvaluationComparisonInput[]
}

export interface UltraLabelMetrics {
  support: number
  predictedCount: number
  truePositive: number
  falsePositive: number
  falseNegative: number
  precision: number | null
  recall: number | null
  f1: number | null
}

export interface UltraEvaluationPerformanceMetrics {
  articleCount: number
  exactMatches: number
  exactAccuracy: number | null
  confusionMatrix: {
    rows: 'truth'
    columns: 'prediction'
    labels: readonly UltraRelevanceLabel[]
    counts: Record<UltraRelevanceLabel, Record<UltraRelevanceLabel, number>>
  }
  binaryInclude: {
    truePositive: number
    trueNegative: number
    falsePositive: number
    falseNegative: number
    sensitivity: number | null
    specificity: number | null
    precision: number | null
    negativePredictiveValue: number | null
  }
  perLabel: Record<UltraRelevanceLabel, UltraLabelMetrics>
  reviewSignals: {
    uncertain: number
    lowConfidence: number
    requiresHumanReview: number
  }
}

export interface UltraFalseExclusionRow {
  pmid: string
  truthLabel: 'include_core' | 'include_adjacent'
  predictedLabel: 'exclude'
  decisionConfidence: UltraScreeningResult['decisionConfidence']
  requiresHumanReview: boolean
  reasonCodes: UltraScreeningResult['reasonCodes']
  conciseRationale: string
}

export interface UltraEvaluationDisagreementRow {
  pmid: string
  truthLabel: UltraRelevanceLabel
  predictedLabel: UltraRelevanceLabel
  decisionConfidence: UltraScreeningResult['decisionConfidence']
  requiresHumanReview: boolean
  disagreementKind: 'false_exclusion' | 'false_inclusion' | 'exact_class_mismatch'
  reasonCodes: UltraScreeningResult['reasonCodes']
  conciseRationale: string
}

export interface UltraEvaluationSlice {
  metrics: UltraEvaluationPerformanceMetrics
  falseExclusions: {
    all: UltraFalseExclusionRow[]
    highConfidence: UltraFalseExclusionRow[]
  }
  disagreements: UltraEvaluationDisagreementRow[]
}

export interface UltraPassComparison {
  comparisonId: string
  predictionRunId: string
  predictionPhase: string
  predictionAggregateSha256: string
  primaryCount: number
  comparisonCount: number
  overlapCount: number
  agreementCount: number
  agreementRate: number | null
  primaryOnlyPmids: string[]
  comparisonOnlyPmids: string[]
  transitionMatrix: Record<UltraRelevanceLabel, Record<UltraRelevanceLabel, number>>
  disagreements: Array<{
    pmid: string
    truthLabel: UltraRelevanceLabel
    primaryLabel: UltraRelevanceLabel
    comparisonLabel: UltraRelevanceLabel
  }>
  performanceAgainstFrozenTruth: UltraEvaluationSlice
}

export interface UltraFrozenTruthEvaluationReport {
  evaluationSchemaVersion: typeof ULTRA_FROZEN_TRUTH_EVALUATION_SCHEMA_VERSION
  evaluationId: string
  evaluationTimestamp: string
  provenance: UltraFrozenTruthEvaluationProvenance
  warning: typeof ULTRA_ENRICHED_DEVELOPMENT_WARNING
  performance: UltraEvaluationSlice
  subsets: {
    noAbstract: UltraEvaluationSlice | null
    animalPreclinical: UltraEvaluationSlice | null
  }
  unavailableAnalyses: {
    directProcedureFalseExclusions: UltraUnavailableAnalysis
    publicationTypeBreakdown: UltraUnavailableAnalysis
    majorTopicBreakdown: UltraUnavailableAnalysis
  }
  comparisons: UltraPassComparison[]
}

export interface UltraUnavailableAnalysis {
  status: 'unavailable'
  reason: string
}

const UNAVAILABLE_ANALYSES: UltraFrozenTruthEvaluationReport['unavailableAnalyses'] = {
  directProcedureFalseExclusions: {
    status: 'unavailable',
    reason:
      'The checksum-bound frozen evaluation inputs do not contain a versioned direct-procedure annotation; no classification was inferred.',
  },
  publicationTypeBreakdown: {
    status: 'unavailable',
    reason:
      'The checksum-bound evaluation rows do not contain normalized publication-type values; no breakdown was fabricated.',
  },
  majorTopicBreakdown: {
    status: 'unavailable',
    reason:
      'The checksum-bound evaluation rows do not contain a versioned major-topic taxonomy; no breakdown was fabricated.',
  },
}

function safeRatio(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator
}

function isIncluded(label: UltraRelevanceLabel) {
  return label === 'include_core' || label === 'include_adjacent'
}

function emptyMatrix() {
  return Object.fromEntries(
    ULTRA_RELEVANCE_LABELS.map((actual) => [
      actual,
      Object.fromEntries(ULTRA_RELEVANCE_LABELS.map((predicted) => [predicted, 0])),
    ]),
  ) as Record<UltraRelevanceLabel, Record<UltraRelevanceLabel, number>>
}

function assertIdentifier(value: string, field: string) {
  if (!SAFE_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${field} must be a safe lowercase identifier.`)
  }
}

function assertSha256(value: string, field: string) {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${field} must be a lowercase SHA-256 digest.`)
}

function assertTimestamp(value: string, field: string) {
  if (!value.includes('T') || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-8601 timestamp.`)
  }
}

function assertNonempty(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} must not be empty.`)
}

function validateProvenance(
  evaluationTimestamp: string,
  provenance: UltraFrozenTruthEvaluationProvenance,
) {
  assertIdentifier(provenance.predictionRunId, 'predictionRunId')
  assertIdentifier(provenance.predictionPhase, 'predictionPhase')
  assertSha256(provenance.predictionAggregateSha256, 'predictionAggregateSha256')
  if (
    provenance.predictionAttemptProvenanceStatus !== 'fully_recorded' &&
    provenance.predictionAttemptProvenanceStatus !== 'unavailable_legacy'
  ) {
    throw new Error('predictionAttemptProvenanceStatus is invalid.')
  }
  assertNonempty(provenance.screeningPolicyRecordPath, 'screeningPolicyRecordPath')
  assertNonempty(provenance.screeningPolicyVersion, 'screeningPolicyVersion')
  assertSha256(provenance.screeningPolicySha256, 'screeningPolicySha256')
  assertNonempty(provenance.workerPromptTemplateRecordPath, 'workerPromptTemplateRecordPath')
  assertNonempty(provenance.workerPromptTemplateVersion, 'workerPromptTemplateVersion')
  assertSha256(provenance.workerPromptTemplateSha256, 'workerPromptTemplateSha256')
  if (!GIT_COMMIT_PATTERN.test(provenance.repositoryCommit)) {
    throw new Error('repositoryCommit must be a full hexadecimal Git object ID.')
  }
  assertIdentifier(provenance.truthBatchName, 'truthBatchName')
  if (provenance.truthBatchStatus !== 'frozen') {
    throw new Error('Frozen-truth evaluation requires truthBatchStatus=frozen.')
  }
  assertTimestamp(provenance.truthBatchFrozenAt, 'truthBatchFrozenAt')
  assertSha256(provenance.truthFullHistoryJsonSha256, 'truthFullHistoryJsonSha256')
  assertTimestamp(provenance.truthExportedAt, 'truthExportedAt')
  assertTimestamp(evaluationTimestamp, 'evaluationTimestamp')
  if (Date.parse(provenance.truthExportedAt) < Date.parse(provenance.truthBatchFrozenAt)) {
    throw new Error('truthExportedAt must not precede truthBatchFrozenAt.')
  }
  if (Date.parse(evaluationTimestamp) < Date.parse(provenance.truthExportedAt)) {
    throw new Error('evaluationTimestamp must not precede truthExportedAt.')
  }
  if (!Array.isArray(provenance.selectionAudits)) {
    throw new Error('selectionAudits must be an array.')
  }
  const auditPaths = new Set<string>()
  for (const [index, audit] of provenance.selectionAudits.entries()) {
    if (!audit || typeof audit !== 'object') {
      throw new Error(`selectionAudits[${index}] must be an object.`)
    }
    assertNonempty(audit.path, `selectionAudits[${index}].path`)
    assertSha256(audit.sha256, `selectionAudits[${index}].sha256`)
    if (auditPaths.has(audit.path)) {
      throw new Error(`selectionAudits contains duplicate path ${audit.path}.`)
    }
    auditPaths.add(audit.path)
  }
}

function validatedPredictions(
  predictions: readonly UltraScreeningResult[],
  field: string,
): UltraScreeningResult[] {
  const records = predictions.map((prediction, index) => {
    const parsed = ultraScreeningResultSchema.safeParse(prediction)
    if (!parsed.success) {
      throw new Error(
        `${field}[${index}] is invalid: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'record'} ${issue.message}`)
          .join('; ')}`,
      )
    }
    return parsed.data
  })
  const pmids = new Set(records.map((record) => record.pmid))
  if (pmids.size !== records.length) throw new Error(`${field} contains duplicate PMIDs.`)
  return records
}

function validatedTruth(truth: readonly UltraFrozenTruthRow[]) {
  const labelSet = new Set<string>(ULTRA_RELEVANCE_LABELS)
  const rows = truth.map((row, index) => {
    if (!/^[0-9]{1,12}$/u.test(row.pmid)) throw new Error(`truth[${index}].pmid is invalid.`)
    if (!labelSet.has(row.relevanceLabel)) {
      throw new Error(`truth[${index}].relevanceLabel is invalid.`)
    }
    return { pmid: row.pmid, relevanceLabel: row.relevanceLabel }
  })
  const pmids = new Set(rows.map((row) => row.pmid))
  if (pmids.size !== rows.length) throw new Error('truth contains duplicate PMIDs.')
  return rows
}

function assertExactPmidSet(
  truth: readonly UltraFrozenTruthRow[],
  predictions: readonly UltraScreeningResult[],
) {
  const truthPmids = new Set(truth.map((row) => row.pmid))
  const predictionPmids = new Set(predictions.map((row) => row.pmid))
  const missing = [...truthPmids]
    .filter((pmid) => !predictionPmids.has(pmid))
    .sort(compareNumericPmids)
  const extra = [...predictionPmids]
    .filter((pmid) => !truthPmids.has(pmid))
    .sort(compareNumericPmids)
  if (missing.length || extra.length) {
    throw new Error(
      `Prediction/truth PMID mismatch. Missing: ${missing.join(', ') || 'none'}; extra: ${
        extra.join(', ') || 'none'
      }.`,
    )
  }
}

function evaluateSlice(
  truth: readonly UltraFrozenTruthRow[],
  predictions: readonly UltraScreeningResult[],
): UltraEvaluationSlice {
  assertExactPmidSet(truth, predictions)
  const predictionByPmid = new Map(predictions.map((prediction) => [prediction.pmid, prediction]))
  const confusion = emptyMatrix()
  let exactMatches = 0
  let truePositive = 0
  let trueNegative = 0
  let falsePositive = 0
  let falseNegative = 0
  const falseExclusions: UltraFalseExclusionRow[] = []
  const disagreements: UltraEvaluationDisagreementRow[] = []

  for (const truthRow of truth) {
    const prediction = predictionByPmid.get(truthRow.pmid)
    if (!prediction) throw new Error(`Missing prediction for PMID ${truthRow.pmid}.`)
    confusion[truthRow.relevanceLabel][prediction.relevanceLabel] += 1
    if (truthRow.relevanceLabel === prediction.relevanceLabel) exactMatches += 1

    const truthIncluded = isIncluded(truthRow.relevanceLabel)
    const predictionIncluded = isIncluded(prediction.relevanceLabel)
    if (truthIncluded && predictionIncluded) truePositive += 1
    else if (!truthIncluded && !predictionIncluded) trueNegative += 1
    else if (!truthIncluded && predictionIncluded) falsePositive += 1
    else falseNegative += 1

    if (truthIncluded && prediction.relevanceLabel === 'exclude') {
      falseExclusions.push({
        pmid: truthRow.pmid,
        truthLabel: truthRow.relevanceLabel as 'include_core' | 'include_adjacent',
        predictedLabel: 'exclude',
        decisionConfidence: prediction.decisionConfidence,
        requiresHumanReview: prediction.requiresHumanReview,
        reasonCodes: prediction.reasonCodes,
        conciseRationale: prediction.conciseRationale,
      })
    }

    if (truthRow.relevanceLabel !== prediction.relevanceLabel) {
      disagreements.push({
        pmid: truthRow.pmid,
        truthLabel: truthRow.relevanceLabel,
        predictedLabel: prediction.relevanceLabel,
        decisionConfidence: prediction.decisionConfidence,
        requiresHumanReview: prediction.requiresHumanReview,
        disagreementKind:
          truthIncluded && prediction.relevanceLabel === 'exclude'
            ? 'false_exclusion'
            : !truthIncluded && predictionIncluded
              ? 'false_inclusion'
              : 'exact_class_mismatch',
        reasonCodes: prediction.reasonCodes,
        conciseRationale: prediction.conciseRationale,
      })
    }
  }

  falseExclusions.sort((left, right) => compareNumericPmids(left.pmid, right.pmid))
  disagreements.sort((left, right) => compareNumericPmids(left.pmid, right.pmid))
  const perLabel = Object.fromEntries(
    ULTRA_RELEVANCE_LABELS.map((label) => {
      const support = ULTRA_RELEVANCE_LABELS.reduce(
        (sum, predicted) => sum + confusion[label][predicted],
        0,
      )
      const predictedCount = ULTRA_RELEVANCE_LABELS.reduce(
        (sum, actual) => sum + confusion[actual][label],
        0,
      )
      const truePositiveForLabel = confusion[label][label]
      const falsePositiveForLabel = predictedCount - truePositiveForLabel
      const falseNegativeForLabel = support - truePositiveForLabel
      const precision = safeRatio(truePositiveForLabel, predictedCount)
      const recall = safeRatio(truePositiveForLabel, support)
      const f1 =
        precision === null || recall === null || precision + recall === 0
          ? null
          : (2 * precision * recall) / (precision + recall)
      return [
        label,
        {
          support,
          predictedCount,
          truePositive: truePositiveForLabel,
          falsePositive: falsePositiveForLabel,
          falseNegative: falseNegativeForLabel,
          precision,
          recall,
          f1,
        },
      ]
    }),
  ) as Record<UltraRelevanceLabel, UltraLabelMetrics>

  return {
    metrics: {
      articleCount: truth.length,
      exactMatches,
      exactAccuracy: safeRatio(exactMatches, truth.length),
      confusionMatrix: {
        rows: 'truth',
        columns: 'prediction',
        labels: ULTRA_RELEVANCE_LABELS,
        counts: confusion,
      },
      binaryInclude: {
        truePositive,
        trueNegative,
        falsePositive,
        falseNegative,
        sensitivity: safeRatio(truePositive, truePositive + falseNegative),
        specificity: safeRatio(trueNegative, trueNegative + falsePositive),
        precision: safeRatio(truePositive, truePositive + falsePositive),
        negativePredictiveValue: safeRatio(trueNegative, trueNegative + falseNegative),
      },
      perLabel,
      reviewSignals: {
        uncertain: predictions.filter((prediction) => prediction.relevanceLabel === 'uncertain')
          .length,
        lowConfidence: predictions.filter((prediction) => prediction.decisionConfidence === 'low')
          .length,
        requiresHumanReview: predictions.filter((prediction) => prediction.requiresHumanReview)
          .length,
      },
    },
    falseExclusions: {
      all: falseExclusions,
      highConfidence: falseExclusions.filter((row) => row.decisionConfidence === 'high'),
    },
    disagreements,
  }
}

function selectedSubset(
  name: string,
  pmids: readonly string[] | undefined,
  truth: readonly UltraFrozenTruthRow[],
  predictions: readonly UltraScreeningResult[],
) {
  if (pmids === undefined) return null
  const truthByPmid = new Map(truth.map((row) => [row.pmid, row]))
  const predictionByPmid = new Map(predictions.map((row) => [row.pmid, row]))
  if (new Set(pmids).size !== pmids.length) throw new Error(`${name} contains duplicate PMIDs.`)
  const unknown = pmids.filter((pmid) => !truthByPmid.has(pmid)).sort(compareNumericPmids)
  if (unknown.length)
    throw new Error(`${name} contains PMIDs outside truth: ${unknown.join(', ')}.`)
  const ordered = [...pmids].sort(compareNumericPmids)
  return evaluateSlice(
    ordered.map((pmid) => truthByPmid.get(pmid) as UltraFrozenTruthRow),
    ordered.map((pmid) => predictionByPmid.get(pmid) as UltraScreeningResult),
  )
}

function comparePasses(
  input: UltraEvaluationComparisonInput,
  truth: readonly UltraFrozenTruthRow[],
  primary: readonly UltraScreeningResult[],
): UltraPassComparison {
  assertIdentifier(input.comparisonId, 'comparisonId')
  assertIdentifier(input.predictionRunId, 'comparison predictionRunId')
  assertIdentifier(input.predictionPhase, 'comparison predictionPhase')
  assertSha256(input.predictionAggregateSha256, 'comparison predictionAggregateSha256')
  const comparison = validatedPredictions(input.predictions, `comparisons.${input.comparisonId}`)
  const truthByPmid = new Map(truth.map((row) => [row.pmid, row]))
  const primaryByPmid = new Map(primary.map((row) => [row.pmid, row]))
  const comparisonByPmid = new Map(comparison.map((row) => [row.pmid, row]))
  const outsideTruth = comparison
    .filter((row) => !truthByPmid.has(row.pmid))
    .map((row) => row.pmid)
    .sort(compareNumericPmids)
  if (outsideTruth.length) {
    throw new Error(
      `Comparison ${input.comparisonId} contains PMIDs outside truth: ${outsideTruth.join(', ')}.`,
    )
  }
  const overlapPmids = comparison
    .map((row) => row.pmid)
    .filter((pmid) => primaryByPmid.has(pmid))
    .sort(compareNumericPmids)
  const agreementCount = overlapPmids.filter(
    (pmid) =>
      primaryByPmid.get(pmid)?.relevanceLabel === comparisonByPmid.get(pmid)?.relevanceLabel,
  ).length
  const transitionMatrix = emptyMatrix()
  for (const pmid of overlapPmids) {
    const primaryRow = primaryByPmid.get(pmid)
    const comparisonRow = comparisonByPmid.get(pmid)
    if (primaryRow && comparisonRow) {
      transitionMatrix[primaryRow.relevanceLabel][comparisonRow.relevanceLabel] += 1
    }
  }
  const primaryOnlyPmids = primary
    .filter((row) => !comparisonByPmid.has(row.pmid))
    .map((row) => row.pmid)
    .sort(compareNumericPmids)
  const comparisonOnlyPmids = comparison
    .filter((row) => !primaryByPmid.has(row.pmid))
    .map((row) => row.pmid)
    .sort(compareNumericPmids)
  const comparisonTruth = comparison
    .map((row) => truthByPmid.get(row.pmid) as UltraFrozenTruthRow)
    .sort((left, right) => compareNumericPmids(left.pmid, right.pmid))
  const orderedComparison = [...comparison].sort((left, right) =>
    compareNumericPmids(left.pmid, right.pmid),
  )

  return {
    comparisonId: input.comparisonId,
    predictionRunId: input.predictionRunId,
    predictionPhase: input.predictionPhase,
    predictionAggregateSha256: input.predictionAggregateSha256,
    primaryCount: primary.length,
    comparisonCount: comparison.length,
    overlapCount: overlapPmids.length,
    agreementCount,
    agreementRate: safeRatio(agreementCount, overlapPmids.length),
    primaryOnlyPmids,
    comparisonOnlyPmids,
    transitionMatrix,
    disagreements: overlapPmids.flatMap((pmid) => {
      const primaryRow = primaryByPmid.get(pmid)
      const comparisonRow = comparisonByPmid.get(pmid)
      const truthRow = truthByPmid.get(pmid)
      return primaryRow &&
        comparisonRow &&
        truthRow &&
        primaryRow.relevanceLabel !== comparisonRow.relevanceLabel
        ? [
            {
              pmid,
              truthLabel: truthRow.relevanceLabel,
              primaryLabel: primaryRow.relevanceLabel,
              comparisonLabel: comparisonRow.relevanceLabel,
            },
          ]
        : []
    }),
    performanceAgainstFrozenTruth: evaluateSlice(comparisonTruth, orderedComparison),
  }
}

export function buildUltraFrozenTruthEvaluation(
  input: UltraFrozenTruthEvaluationInput,
): UltraFrozenTruthEvaluationReport {
  assertIdentifier(input.evaluationId, 'evaluationId')
  validateProvenance(input.evaluationTimestamp, input.provenance)
  const truth = validatedTruth(input.truth)
  const predictions = validatedPredictions(input.predictions, 'predictions')
  assertExactPmidSet(truth, predictions)
  const comparisonIds = (input.comparisons ?? []).map((comparison) => comparison.comparisonId)
  if (new Set(comparisonIds).size !== comparisonIds.length) {
    throw new Error('comparisons contains duplicate comparison IDs.')
  }

  return {
    evaluationSchemaVersion: ULTRA_FROZEN_TRUTH_EVALUATION_SCHEMA_VERSION,
    evaluationId: input.evaluationId,
    evaluationTimestamp: input.evaluationTimestamp,
    provenance: {
      ...input.provenance,
      selectionAudits: [...input.provenance.selectionAudits]
        .map((audit) => ({ ...audit }))
        .sort((left, right) => left.path.localeCompare(right.path)),
    },
    warning: ULTRA_ENRICHED_DEVELOPMENT_WARNING,
    performance: evaluateSlice(truth, predictions),
    subsets: {
      noAbstract: selectedSubset(
        'noAbstractPmids',
        input.subsets?.noAbstractPmids,
        truth,
        predictions,
      ),
      animalPreclinical: selectedSubset(
        'animalPreclinicalPmids',
        input.subsets?.animalPreclinicalPmids,
        truth,
        predictions,
      ),
    },
    unavailableAnalyses: {
      directProcedureFalseExclusions: {
        ...UNAVAILABLE_ANALYSES.directProcedureFalseExclusions,
      },
      publicationTypeBreakdown: { ...UNAVAILABLE_ANALYSES.publicationTypeBreakdown },
      majorTopicBreakdown: { ...UNAVAILABLE_ANALYSES.majorTopicBreakdown },
    },
    comparisons: (input.comparisons ?? [])
      .map((comparison) => comparePasses(comparison, truth, predictions))
      .sort((left, right) => left.comparisonId.localeCompare(right.comparisonId)),
  }
}

export function ultraFrozenTruthEvaluationPaths(rootPath: string, evaluationId: string) {
  assertIdentifier(evaluationId, 'evaluationId')
  const directoryPath = resolve(
    rootPath,
    'evaluations',
    ULTRA_FROZEN_TRUTH_EVALUATION_DIRECTORY,
    evaluationId,
  )
  return {
    directoryPath,
    reportPath: resolve(directoryPath, 'evaluation.json'),
    disagreementsPath: resolve(directoryPath, 'disagreements.jsonl'),
    disagreementsCsvPath: resolve(directoryPath, 'disagreements.csv'),
    bundleReceiptPath: resolve(directoryPath, 'bundle-complete.json'),
  }
}

function csvCell(value: string | boolean) {
  const raw = String(value)
  const spreadsheetSafe = /^[=+\-@]/u.test(raw) ? `'${raw}` : raw
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`
}

function serializeDisagreementsCsv(rows: readonly UltraEvaluationDisagreementRow[]) {
  const header = [
    'pmid',
    'truth_label',
    'predicted_label',
    'decision_confidence',
    'requires_human_review',
    'disagreement_kind',
    'reason_codes',
    'concise_rationale',
  ]
  const body = rows.map((row) =>
    [
      row.pmid,
      row.truthLabel,
      row.predictedLabel,
      row.decisionConfidence,
      row.requiresHumanReview,
      row.disagreementKind,
      row.reasonCodes.join(';'),
      row.conciseRationale,
    ]
      .map(csvCell)
      .join(','),
  )
  return `${header.map(csvCell).join(',')}\n${body.length ? `${body.join('\n')}\n` : ''}`
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : null
}

async function readIfPresent(path: string) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return null
    throw error
  }
}

export async function writeExactOrVerifyEvaluationArtifact(path: string, content: string) {
  const existing = await readIfPresent(path)
  if (existing !== null) {
    if (existing !== content) {
      throw new Error(`Refusing to overwrite nonmatching evaluation artifact: ${path}`)
    }
    return 'verified_existing' as const
  }
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = resolve(dirname(path), `.evaluation-artifact-${randomUUID()}.tmp`)
  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    handle = await open(temporaryPath, 'wx', 0o444)
    await handle.writeFile(content, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    try {
      await link(temporaryPath, path)
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') throw error
      const raced = await readFile(path, 'utf8')
      if (raced !== content) {
        throw new Error(`Refusing to overwrite nonmatching evaluation artifact: ${path}`)
      }
      return 'verified_existing' as const
    }
    return 'written' as const
  } finally {
    if (handle) await handle.close()
    await rm(temporaryPath, { force: true })
  }
}

export async function writeUltraFrozenTruthEvaluationArtifacts(
  rootPath: string,
  report: UltraFrozenTruthEvaluationReport,
) {
  if (report.evaluationSchemaVersion !== ULTRA_FROZEN_TRUTH_EVALUATION_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported evaluation schema version: ${String(report.evaluationSchemaVersion)}.`,
    )
  }
  const paths = ultraFrozenTruthEvaluationPaths(rootPath, report.evaluationId)
  const reportContent = `${stableJson(report)}\n`
  const disagreementsContent =
    report.performance.disagreements.map((row) => stableJson(row)).join('\n') +
    (report.performance.disagreements.length ? '\n' : '')
  const disagreementsCsvContent = serializeDisagreementsCsv(report.performance.disagreements)
  const bundleReceipt = {
    receiptVersion: ULTRA_FROZEN_TRUTH_BUNDLE_RECEIPT_VERSION,
    evaluationSchemaVersion: report.evaluationSchemaVersion,
    evaluationId: report.evaluationId,
    evaluationTimestamp: report.evaluationTimestamp,
    complete: true,
    artifacts: [
      {
        filename: 'evaluation.json',
        bytes: Buffer.byteLength(reportContent),
        sha256: sha256Text(reportContent),
      },
      {
        filename: 'disagreements.jsonl',
        bytes: Buffer.byteLength(disagreementsContent),
        sha256: sha256Text(disagreementsContent),
      },
      {
        filename: 'disagreements.csv',
        bytes: Buffer.byteLength(disagreementsCsvContent),
        sha256: sha256Text(disagreementsCsvContent),
      },
    ],
  }
  const bundleReceiptContent = `${stableJson(bundleReceipt)}\n`
  await mkdir(paths.directoryPath, { recursive: true })

  // Preflight both artifacts before creating either so a stale, nonmatching artifact fails closed.
  const existingReport = await readIfPresent(paths.reportPath)
  const existingDisagreements = await readIfPresent(paths.disagreementsPath)
  const existingDisagreementsCsv = await readIfPresent(paths.disagreementsCsvPath)
  const existingBundleReceipt = await readIfPresent(paths.bundleReceiptPath)
  if (existingBundleReceipt !== null) {
    if (existingBundleReceipt !== bundleReceiptContent) {
      throw new Error(
        `Refusing to overwrite nonmatching evaluation artifact: ${paths.bundleReceiptPath}`,
      )
    }
    const incomplete = [
      [paths.reportPath, existingReport, reportContent],
      [paths.disagreementsPath, existingDisagreements, disagreementsContent],
      [paths.disagreementsCsvPath, existingDisagreementsCsv, disagreementsCsvContent],
    ].find(([, existing, expected]) => existing === null || existing !== expected)
    if (incomplete) {
      throw new Error(
        `Evaluation bundle receipt exists but member is missing or changed: ${String(incomplete[0])}`,
      )
    }
    return {
      ...paths,
      reportStatus: 'verified_existing' as const,
      disagreementsStatus: 'verified_existing' as const,
      disagreementsCsvStatus: 'verified_existing' as const,
      bundleReceiptStatus: 'verified_existing' as const,
      bundleComplete: true as const,
    }
  }
  if (existingReport !== null && existingReport !== reportContent) {
    throw new Error(`Refusing to overwrite nonmatching evaluation artifact: ${paths.reportPath}`)
  }
  if (existingDisagreements !== null && existingDisagreements !== disagreementsContent) {
    throw new Error(
      `Refusing to overwrite nonmatching evaluation artifact: ${paths.disagreementsPath}`,
    )
  }
  if (existingDisagreementsCsv !== null && existingDisagreementsCsv !== disagreementsCsvContent) {
    throw new Error(
      `Refusing to overwrite nonmatching evaluation artifact: ${paths.disagreementsCsvPath}`,
    )
  }

  const reportStatus = await writeExactOrVerifyEvaluationArtifact(paths.reportPath, reportContent)
  const disagreementsStatus = await writeExactOrVerifyEvaluationArtifact(
    paths.disagreementsPath,
    disagreementsContent,
  )
  const disagreementsCsvStatus = await writeExactOrVerifyEvaluationArtifact(
    paths.disagreementsCsvPath,
    disagreementsCsvContent,
  )
  const bundleReceiptStatus = await writeExactOrVerifyEvaluationArtifact(
    paths.bundleReceiptPath,
    bundleReceiptContent,
  )
  return {
    ...paths,
    reportStatus,
    disagreementsStatus,
    disagreementsCsvStatus,
    bundleReceiptStatus,
    bundleComplete: true as const,
  }
}
