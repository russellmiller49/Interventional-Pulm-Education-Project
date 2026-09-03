import { z } from 'zod'

import { immutableShadowValue, sha256ShadowValue } from './canonical'
import {
  developmentFoldPmids,
  verifyRepeatedStratifiedDevelopmentFolds,
  type ShadowDevelopmentFoldRow,
  type ShadowDevelopmentFoldManifest,
} from './development-folds'
import {
  assertDevelopmentArticleAuthorized,
  developmentShadowScopeDescriptor,
  type AuthorizedDevelopmentShadowScope,
} from './held-out-guard'
import type { AuthorizedShadowDevelopmentTruth } from './development-truth-authority'

export const SHADOW_CALIBRATION_SCHEMA_VERSION =
  'literature-shadow-development-calibration/1.0.0' as const
export const SHADOW_RELEVANCE_LABELS = [
  'include_core',
  'include_adjacent',
  'exclude',
  'uncertain',
] as const
export const SHADOW_DEFAULT_CALIBRATION_BINS = 10 as const
export const SHADOW_DEFAULT_TEMPERATURE_CANDIDATES = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4,
] as const

export type ShadowRelevanceLabel = (typeof SHADOW_RELEVANCE_LABELS)[number]

export interface ShadowProbabilityEvaluationRow {
  pmid: string
  truthLabel: ShadowRelevanceLabel
  predictedLabel: ShadowRelevanceLabel
  probabilities: unknown | null
}

export interface ShadowCalibrationCohortRow {
  pmid: string
  truthLabel: ShadowRelevanceLabel
  outcomeStatus: 'prediction' | 'abstention' | 'refusal' | 'invalid' | 'missing'
  predictedLabel: ShadowRelevanceLabel | null
  probabilities: unknown | null
}

export interface ValidShadowProbabilityVector {
  vocabulary: readonly ShadowRelevanceLabel[]
  values: Readonly<Record<ShadowRelevanceLabel, number>>
}

export interface ShadowCalibrationBin {
  binIndex: number
  lowerInclusive: number
  upperInclusive: number
  upperBoundIncluded: boolean
  count: number
  meanConfidence: number | null
  accuracy: number | null
  absoluteGap: number | null
}

export interface ShadowProbabilityCalibrationMetrics {
  scope: 'caller_supplied_rows'
  selection: 'explicit_input_rows'
  selectionSha256: string
  status:
    | 'available_complete_for_supplied_rows'
    | 'available_partial_for_supplied_rows'
    | 'unavailable_for_supplied_rows'
  probabilityCoverageCompleteForSuppliedRows: boolean
  attemptedRowCount: number
  validProbabilityRowCount: number
  missingProbabilityRowCount: number
  invalidProbabilityRowCount: number
  invalidRows: readonly { pmid: string; reason: string }[]
  multiclassBrierScore: number | null
  binaryIncludeBrierScore: number | null
  multiclassExpectedCalibrationError: number | null
  binaryIncludeExpectedCalibrationError: number | null
  multiclassBins: readonly ShadowCalibrationBin[]
  binaryIncludeBins: readonly ShadowCalibrationBin[]
}

const probabilityPayloadSchema = z
  .object({
    vocabulary: z.array(z.string()).length(SHADOW_RELEVANCE_LABELS.length),
    values: z.record(z.string(), z.number().finite().min(0).max(1)),
    source: z.literal('model_supplied'),
    calibrated: z.literal(false),
    calibrationArtifactSha256: z.null(),
  })
  .strict()

function parseModelProbabilityVector(
  raw: unknown,
  predictedLabel: ShadowRelevanceLabel,
): { vector: ValidShadowProbabilityVector | null; reason: string | null } {
  const parsed = probabilityPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      vector: null,
      reason: parsed.error.issues.map((issue) => issue.message).join('; '),
    }
  }
  const expected = [...SHADOW_RELEVANCE_LABELS]
  if (
    parsed.data.vocabulary.some((label, index) => label !== expected[index]) ||
    Object.keys(parsed.data.values).sort().join('\0') !== expected.sort().join('\0')
  ) {
    return { vector: null, reason: 'Probability vocabulary and keys are not exact.' }
  }
  const values = parsed.data.values as Record<ShadowRelevanceLabel, number>
  const sum = SHADOW_RELEVANCE_LABELS.reduce((total, label) => total + values[label], 0)
  if (Math.abs(sum - 1) > 1e-9) {
    return { vector: null, reason: 'Probabilities do not sum to one within 1e-9.' }
  }
  const ordered = SHADOW_RELEVANCE_LABELS.map((label) => [label, values[label]] as const).sort(
    ([leftLabel, left], [rightLabel, right]) => right - left || leftLabel.localeCompare(rightLabel),
  )
  if (ordered[0]?.[1] === ordered[1]?.[1]) {
    return { vector: null, reason: 'Probability argmax is not unique.' }
  }
  if (ordered[0]?.[0] !== predictedLabel) {
    return { vector: null, reason: 'Predicted label is not the probability argmax.' }
  }
  return {
    vector: immutableShadowValue({
      vocabulary: [...SHADOW_RELEVANCE_LABELS],
      values: Object.fromEntries(
        SHADOW_RELEVANCE_LABELS.map((label) => [label, values[label]]),
      ) as Record<ShadowRelevanceLabel, number>,
    }),
    reason: null,
  }
}

function eceBins(
  rows: readonly { confidence: number; correct: boolean }[],
  count: number,
): { ece: number | null; bins: ShadowCalibrationBin[] } {
  const bins: ShadowCalibrationBin[] = []
  let weightedGap = 0
  for (let binIndex = 0; binIndex < count; binIndex += 1) {
    const lower = binIndex / count
    const upper = (binIndex + 1) / count
    const selected = rows.filter(
      (row) =>
        row.confidence >= lower &&
        (binIndex === count - 1 ? row.confidence <= upper : row.confidence < upper),
    )
    const meanConfidence =
      selected.length === 0
        ? null
        : selected.reduce((sum, row) => sum + row.confidence, 0) / selected.length
    const accuracy =
      selected.length === 0 ? null : selected.filter((row) => row.correct).length / selected.length
    const absoluteGap =
      meanConfidence === null || accuracy === null ? null : Math.abs(meanConfidence - accuracy)
    if (absoluteGap !== null) weightedGap += absoluteGap * selected.length
    bins.push({
      binIndex,
      lowerInclusive: lower,
      upperInclusive: upper,
      upperBoundIncluded: binIndex === count - 1,
      count: selected.length,
      meanConfidence,
      accuracy,
      absoluteGap,
    })
  }
  return { ece: rows.length === 0 ? null : weightedGap / rows.length, bins }
}

/** Brier and ECE are calculated only from validated probability vectors. */
export function evaluateShadowProbabilityCalibration(input: {
  rows: readonly ShadowProbabilityEvaluationRow[]
  bins?: number
}): Readonly<ShadowProbabilityCalibrationMetrics> {
  const bins = z
    .number()
    .int()
    .min(2)
    .max(100)
    .parse(input.bins ?? SHADOW_DEFAULT_CALIBRATION_BINS)
  const rowSchema = z
    .object({
      pmid: z.string().regex(/^[0-9]{1,12}$/u),
      truthLabel: z.enum(SHADOW_RELEVANCE_LABELS),
      predictedLabel: z.enum(SHADOW_RELEVANCE_LABELS),
      probabilities: z.unknown().nullable(),
    })
    .strict()
  const strictRows = input.rows.map((row, index) => {
    const parsed = rowSchema.safeParse(row)
    if (!parsed.success) {
      throw new Error(
        `Probability metric row ${index + 1} is invalid: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'row'} ${issue.message}`)
          .join('; ')}.`,
      )
    }
    return {
      pmid: parsed.data.pmid,
      truthLabel: parsed.data.truthLabel,
      predictedLabel: parsed.data.predictedLabel,
      probabilities: row.probabilities,
    }
  })
  if (new Set(strictRows.map((row) => row.pmid)).size !== strictRows.length) {
    throw new Error('Probability metric rows contain duplicate PMIDs.')
  }
  strictRows.sort((left, right) =>
    left.pmid.length === right.pmid.length
      ? left.pmid.localeCompare(right.pmid)
      : left.pmid.length - right.pmid.length,
  )
  const valid: Array<ShadowProbabilityEvaluationRow & { vector: ValidShadowProbabilityVector }> = []
  const invalidRows: Array<{ pmid: string; reason: string }> = []
  let missingProbabilityRowCount = 0
  for (const row of strictRows) {
    if (row.probabilities === null || row.probabilities === undefined) {
      missingProbabilityRowCount += 1
      continue
    }
    const parsed = parseModelProbabilityVector(row.probabilities, row.predictedLabel)
    if (!parsed.vector) {
      invalidRows.push({ pmid: row.pmid, reason: parsed.reason ?? 'Invalid probability payload.' })
      continue
    }
    valid.push({ ...row, vector: parsed.vector })
  }

  let multiclassBrier = 0
  let binaryBrier = 0
  const multiclassConfidence: Array<{ confidence: number; correct: boolean }> = []
  const binaryConfidence: Array<{ confidence: number; correct: boolean }> = []
  for (const row of valid) {
    multiclassBrier += SHADOW_RELEVANCE_LABELS.reduce((sum, label) => {
      const observed = row.truthLabel === label ? 1 : 0
      return sum + (row.vector.values[label] - observed) ** 2
    }, 0)
    const includeProbability = row.vector.values.include_core + row.vector.values.include_adjacent
    const truthIncluded = row.truthLabel === 'include_core' || row.truthLabel === 'include_adjacent'
    binaryBrier += (includeProbability - (truthIncluded ? 1 : 0)) ** 2
    const maximum = Math.max(...SHADOW_RELEVANCE_LABELS.map((label) => row.vector.values[label]))
    multiclassConfidence.push({
      confidence: maximum,
      correct: row.predictedLabel === row.truthLabel,
    })
    const predictedIncluded = includeProbability >= 0.5
    binaryConfidence.push({
      confidence: predictedIncluded ? includeProbability : 1 - includeProbability,
      correct: predictedIncluded === truthIncluded,
    })
  }
  const multiclassEce = eceBins(multiclassConfidence, bins)
  const binaryEce = eceBins(binaryConfidence, bins)
  const validCount = valid.length
  return immutableShadowValue({
    scope: 'caller_supplied_rows',
    selection: 'explicit_input_rows',
    selectionSha256: sha256ShadowValue(strictRows.map((row) => row.pmid)),
    status:
      validCount === 0
        ? 'unavailable_for_supplied_rows'
        : validCount === strictRows.length
          ? 'available_complete_for_supplied_rows'
          : 'available_partial_for_supplied_rows',
    probabilityCoverageCompleteForSuppliedRows:
      strictRows.length > 0 && validCount === strictRows.length,
    attemptedRowCount: strictRows.length,
    validProbabilityRowCount: validCount,
    missingProbabilityRowCount,
    invalidProbabilityRowCount: invalidRows.length,
    invalidRows,
    // Multiclass Brier is the mean sum across classes; it is intentionally not divided by K.
    multiclassBrierScore: validCount === 0 ? null : multiclassBrier / validCount,
    binaryIncludeBrierScore: validCount === 0 ? null : binaryBrier / validCount,
    multiclassExpectedCalibrationError: multiclassEce.ece,
    binaryIncludeExpectedCalibrationError: binaryEce.ece,
    multiclassBins: multiclassEce.bins,
    binaryIncludeBins: binaryEce.bins,
  })
}

function temperatureScale(
  vector: ValidShadowProbabilityVector,
  temperature: number,
): ValidShadowProbabilityVector {
  const logits = Object.fromEntries(
    SHADOW_RELEVANCE_LABELS.map((label) => [
      label,
      Math.log(Math.max(vector.values[label], 1e-15)) / temperature,
    ]),
  ) as Record<ShadowRelevanceLabel, number>
  const maximumLogit = Math.max(...Object.values(logits))
  const unnormalized = Object.fromEntries(
    SHADOW_RELEVANCE_LABELS.map((label) => [label, Math.exp(logits[label] - maximumLogit)]),
  ) as Record<ShadowRelevanceLabel, number>
  const sum = Object.values(unnormalized).reduce((total, value) => total + value, 0)
  return immutableShadowValue({
    vocabulary: [...SHADOW_RELEVANCE_LABELS],
    values: Object.fromEntries(
      SHADOW_RELEVANCE_LABELS.map((label) => [label, unnormalized[label] / sum]),
    ) as Record<ShadowRelevanceLabel, number>,
  })
}

function meanNegativeLogLikelihood(
  rows: readonly (ShadowProbabilityEvaluationRow & { vector: ValidShadowProbabilityVector })[],
  temperature: number,
): number {
  return (
    rows.reduce((sum, row) => {
      const transformed = temperatureScale(row.vector, temperature)
      return sum - Math.log(Math.max(transformed.values[row.truthLabel], 1e-15))
    }, 0) / rows.length
  )
}

export interface ShadowCrossFittedCalibrationFold {
  repeatIndex: number
  validationFoldIndex: number
  status: 'fitted' | 'unavailable'
  reason: string | null
  trainingRowCount: number
  validationRowCount: number
  temperature: number | null
  trainingNegativeLogLikelihood: number | null
}

export interface ShadowCrossFittedCalibratedRow {
  pmid: string
  truthLabel: ShadowRelevanceLabel
  predictedLabel: ShadowRelevanceLabel
  repeatPredictionCount: number
  probabilities: {
    vocabulary: readonly ShadowRelevanceLabel[]
    values: Readonly<Record<ShadowRelevanceLabel, number>>
    source: 'cross_fitted_calibrator'
    calibrated: true
    calibrationArtifactSha256: string
  }
}

export interface ShadowCrossFittedCalibrationArtifact {
  schemaVersion: typeof SHADOW_CALIBRATION_SCHEMA_VERSION
  developmentOnly: true
  authorityClass: 'real_development_membership' | 'synthetic_fixture'
  experimentEligible: boolean
  developmentMembershipSha256: string
  heldOutValidation: false
  operationalThresholdSelected: false
  selectedRowCount: number
  validRawProbabilityRowCount: number
  crossFittedRowCount: number
  unavailableFoldCount: number
  expectedOutOfFoldPredictionsPerValidRow: number
  full630CalibrationClaim: {
    authorized: boolean
    reasons: readonly string[]
  }
  method: 'repeated_cross_fitted_temperature_scaling'
  candidateTemperatures: readonly number[]
  foldManifestSha256: string
  inputSha256: string
  fits: readonly ShadowCrossFittedCalibrationFold[]
  calibrationArtifactSha256: string
  rows: readonly ShadowCrossFittedCalibratedRow[]
  rawMetrics: ShadowProbabilityCalibrationMetrics
  calibratedMetrics: ShadowProbabilityCalibrationMetrics
  artifactSha256: string
}

export function crossFitShadowTemperatureCalibration(input: {
  scope: AuthorizedDevelopmentShadowScope
  rows: readonly ShadowCalibrationCohortRow[]
  foldRows: readonly ShadowDevelopmentFoldRow[]
  foldManifest: ShadowDevelopmentFoldManifest
  truth?: AuthorizedShadowDevelopmentTruth
  candidateTemperatures?: readonly number[]
  minimumTrainingRows?: number
}): Readonly<ShadowCrossFittedCalibrationArtifact> {
  if (input.foldManifest.heldOutValidation !== false) {
    throw new Error('Calibration folds must remain internal development folds.')
  }
  verifyRepeatedStratifiedDevelopmentFolds({
    scope: input.scope,
    rows: input.foldRows,
    manifest: input.foldManifest,
    truth: input.truth,
  })
  const scopeDescriptor = developmentShadowScopeDescriptor(input.scope)
  if (
    scopeDescriptor.authorityClass === 'real_development_membership' &&
    (!scopeDescriptor.experimentEligible || !input.truth)
  ) {
    throw new Error('Real development calibration requires exact opaque truth authority.')
  }
  const rowSchema = z
    .object({
      pmid: z.string().regex(/^[0-9]{1,12}$/u),
      truthLabel: z.enum(SHADOW_RELEVANCE_LABELS),
      outcomeStatus: z.enum(['prediction', 'abstention', 'refusal', 'invalid', 'missing']),
      predictedLabel: z.enum(SHADOW_RELEVANCE_LABELS).nullable(),
      probabilities: z.unknown().nullable(),
    })
    .strict()
  const strictRows = input.rows.map((row, index) => {
    const parsed = rowSchema.safeParse(row)
    if (!parsed.success) {
      throw new Error(`Calibration row ${index + 1} is not strict.`)
    }
    assertDevelopmentArticleAuthorized(input.scope, parsed.data.pmid)
    if (
      (parsed.data.outcomeStatus === 'prediction' && parsed.data.predictedLabel === null) ||
      (parsed.data.outcomeStatus !== 'prediction' &&
        (parsed.data.predictedLabel !== null || row.probabilities !== null))
    ) {
      throw new Error('Calibration terminal outcome and prediction/probability fields disagree.')
    }
    return {
      pmid: parsed.data.pmid,
      truthLabel: parsed.data.truthLabel,
      outcomeStatus: parsed.data.outcomeStatus,
      predictedLabel: parsed.data.predictedLabel,
      probabilities: row.probabilities,
    }
  })
  if (new Set(strictRows.map((row) => row.pmid)).size !== strictRows.length) {
    throw new Error('Calibration rows contain duplicate PMIDs.')
  }
  const expectedPmids = [...new Set(input.foldRows.map((row) => row.pmid))].sort()
  const actualPmids = strictRows.map((row) => row.pmid).sort()
  if (
    expectedPmids.length !== actualPmids.length ||
    expectedPmids.some((pmid, index) => pmid !== actualPmids[index])
  ) {
    throw new Error('Cross-fitted calibration requires exact fold-cohort prediction coverage.')
  }
  const expectedTruthByPmid = new Map(
    input.foldRows.map((row) => [row.pmid, row.relevanceLabel] as const),
  )
  for (const row of strictRows) {
    if (expectedTruthByPmid.get(row.pmid) !== row.truthLabel) {
      throw new Error('Calibration truth labels do not match the authenticated fold cohort.')
    }
  }
  strictRows.sort((left, right) =>
    left.pmid.length === right.pmid.length
      ? left.pmid.localeCompare(right.pmid)
      : left.pmid.length - right.pmid.length,
  )
  const candidateTemperatures = [
    ...(input.candidateTemperatures ?? SHADOW_DEFAULT_TEMPERATURE_CANDIDATES),
  ]
  if (
    candidateTemperatures.length === 0 ||
    candidateTemperatures.length > 100 ||
    candidateTemperatures.some((value) => !Number.isFinite(value) || value < 0.05 || value > 20) ||
    new Set(candidateTemperatures).size !== candidateTemperatures.length
  ) {
    throw new Error('Calibration temperature candidates must be unique positive finite values.')
  }
  candidateTemperatures.sort((left, right) => left - right)
  const minimumTrainingRows = z
    .number()
    .int()
    .min(2)
    .parse(input.minimumTrainingRows ?? 20)
  const predictionRows = strictRows.filter(
    (row): row is typeof row & { predictedLabel: ShadowRelevanceLabel } =>
      row.outcomeStatus === 'prediction' && row.predictedLabel !== null,
  )
  const parsedRows = predictionRows.map((row) => {
    const parsed = parseModelProbabilityVector(row.probabilities, row.predictedLabel)
    return parsed.vector ? { ...row, vector: parsed.vector } : null
  })
  const validRows = parsedRows.filter(
    (row): row is NonNullable<(typeof parsedRows)[number]> => row !== null,
  )
  const rowByPmid = new Map(validRows.map((row) => [row.pmid, row]))
  if (rowByPmid.size !== validRows.length) {
    throw new Error('Calibration input contains duplicate valid-probability PMIDs.')
  }
  const cohortTruthLabels = new Set(strictRows.map((row) => row.truthLabel))
  const fits: ShadowCrossFittedCalibrationFold[] = []
  const calibratedByPmid = new Map<string, ValidShadowProbabilityVector[]>()

  for (let repeatIndex = 0; repeatIndex < input.foldManifest.repeats; repeatIndex += 1) {
    for (
      let validationFoldIndex = 0;
      validationFoldIndex < input.foldManifest.folds;
      validationFoldIndex += 1
    ) {
      const split = developmentFoldPmids({
        scope: input.scope,
        rows: input.foldRows,
        manifest: input.foldManifest,
        truth: input.truth,
        repeatIndex,
        validationFoldIndex,
      })
      const training = split.trainingPmids.flatMap((pmid) => {
        const row = rowByPmid.get(pmid)
        return row ? [row] : []
      })
      const validation = split.validationPmids.flatMap((pmid) => {
        const row = rowByPmid.get(pmid)
        return row ? [row] : []
      })
      const missingObservedTruthClass = [...cohortTruthLabels].find(
        (label) => !training.some((row) => row.truthLabel === label),
      )
      if (
        training.length < minimumTrainingRows ||
        validation.length === 0 ||
        missingObservedTruthClass
      ) {
        fits.push({
          repeatIndex,
          validationFoldIndex,
          status: 'unavailable',
          reason:
            training.length < minimumTrainingRows
              ? 'insufficient_training_probability_rows'
              : validation.length === 0
                ? 'no_validation_probability_rows'
                : `training_missing_observed_truth_class:${String(missingObservedTruthClass)}`,
          trainingRowCount: training.length,
          validationRowCount: validation.length,
          temperature: null,
          trainingNegativeLogLikelihood: null,
        })
        continue
      }
      const scored = candidateTemperatures.map((temperature) => ({
        temperature,
        nll: meanNegativeLogLikelihood(training, temperature),
      }))
      scored.sort((left, right) => left.nll - right.nll || left.temperature - right.temperature)
      const selected = scored[0]
      if (!selected) throw new Error('Calibration produced no temperature candidate.')
      fits.push({
        repeatIndex,
        validationFoldIndex,
        status: 'fitted',
        reason: null,
        trainingRowCount: training.length,
        validationRowCount: validation.length,
        temperature: selected.temperature,
        trainingNegativeLogLikelihood: selected.nll,
      })
      for (const row of validation) {
        calibratedByPmid.set(row.pmid, [
          ...(calibratedByPmid.get(row.pmid) ?? []),
          temperatureScale(row.vector, selected.temperature),
        ])
      }
    }
  }

  const pendingRows: Array<
    Omit<ShadowCrossFittedCalibratedRow, 'probabilities'> & {
      values: Readonly<Record<ShadowRelevanceLabel, number>>
    }
  > = []
  for (const row of validRows) {
    const predictions = calibratedByPmid.get(row.pmid) ?? []
    if (predictions.length === 0) continue
    const values = Object.fromEntries(
      SHADOW_RELEVANCE_LABELS.map((label) => [
        label,
        predictions.reduce((sum, vector) => sum + vector.values[label], 0) / predictions.length,
      ]),
    ) as Record<ShadowRelevanceLabel, number>
    pendingRows.push({
      pmid: row.pmid,
      truthLabel: row.truthLabel,
      predictedLabel: row.predictedLabel,
      repeatPredictionCount: predictions.length,
      values,
    })
  }
  pendingRows.sort((left, right) =>
    left.pmid.length === right.pmid.length
      ? left.pmid.localeCompare(right.pmid)
      : left.pmid.length - right.pmid.length,
  )
  const unavailableFoldCount = fits.filter((fit) => fit.status === 'unavailable').length
  const fullClaimReasons: string[] = []
  if (strictRows.length !== 630) fullClaimReasons.push('selected_rows_not_exact_630')
  if (validRows.length !== strictRows.length)
    fullClaimReasons.push('raw_probability_vectors_incomplete')
  if (unavailableFoldCount > 0) fullClaimReasons.push('one_or_more_folds_unavailable')
  if (
    pendingRows.length !== strictRows.length ||
    pendingRows.some((row) => row.repeatPredictionCount !== input.foldManifest.repeats)
  ) {
    fullClaimReasons.push('out_of_fold_predictions_incomplete')
  }
  const identity = {
    schemaVersion: SHADOW_CALIBRATION_SCHEMA_VERSION,
    method: 'repeated_cross_fitted_temperature_scaling' as const,
    developmentMembershipSha256: scopeDescriptor.developmentMembershipSha256,
    candidateTemperatures,
    foldManifestSha256: input.foldManifest.manifestSha256,
    inputSha256: sha256ShadowValue(strictRows),
    fits,
    selectedRowCount: strictRows.length,
    validRawProbabilityRowCount: validRows.length,
    crossFittedRowCount: pendingRows.length,
    unavailableFoldCount,
    full630CalibrationClaim: {
      authorized:
        scopeDescriptor.authorityClass === 'real_development_membership' &&
        fullClaimReasons.length === 0,
      reasons: fullClaimReasons,
    },
  }
  const calibrationArtifactSha256 = sha256ShadowValue(identity)
  const rows: ShadowCrossFittedCalibratedRow[] = pendingRows.map(({ values, ...row }) => ({
    ...row,
    probabilities: {
      vocabulary: [...SHADOW_RELEVANCE_LABELS],
      values,
      source: 'cross_fitted_calibrator',
      calibrated: true,
      calibrationArtifactSha256,
    },
  }))
  const artifactWithoutHash = {
    schemaVersion: SHADOW_CALIBRATION_SCHEMA_VERSION,
    developmentOnly: true as const,
    authorityClass: scopeDescriptor.authorityClass,
    experimentEligible: scopeDescriptor.experimentEligible,
    developmentMembershipSha256: scopeDescriptor.developmentMembershipSha256,
    heldOutValidation: false as const,
    operationalThresholdSelected: false as const,
    selectedRowCount: strictRows.length,
    validRawProbabilityRowCount: validRows.length,
    crossFittedRowCount: rows.length,
    unavailableFoldCount,
    expectedOutOfFoldPredictionsPerValidRow: input.foldManifest.repeats,
    full630CalibrationClaim: {
      authorized:
        scopeDescriptor.authorityClass === 'real_development_membership' &&
        fullClaimReasons.length === 0,
      reasons:
        scopeDescriptor.authorityClass === 'real_development_membership'
          ? fullClaimReasons
          : ['synthetic_fixture_not_experiment_eligible', ...fullClaimReasons],
    },
    method: 'repeated_cross_fitted_temperature_scaling' as const,
    candidateTemperatures,
    foldManifestSha256: input.foldManifest.manifestSha256,
    inputSha256: identity.inputSha256,
    fits,
    calibrationArtifactSha256,
    rows,
    rawMetrics: evaluateShadowProbabilityCalibration({
      rows: predictionRows.map((row) => ({
        pmid: row.pmid,
        truthLabel: row.truthLabel,
        predictedLabel: row.predictedLabel,
        probabilities: row.probabilities,
      })),
    }),
    calibratedMetrics: evaluateValidatedProbabilityVectors(
      rows.map((row) => ({
        pmid: row.pmid,
        truthLabel: row.truthLabel,
        predictedLabel: row.predictedLabel,
        vector: row.probabilities,
      })),
    ),
  }
  return immutableShadowValue({
    ...artifactWithoutHash,
    artifactSha256: sha256ShadowValue(artifactWithoutHash),
  })
}

function evaluateValidatedProbabilityVectors(
  rows: readonly {
    pmid: string
    truthLabel: ShadowRelevanceLabel
    predictedLabel: ShadowRelevanceLabel
    vector: ValidShadowProbabilityVector
  }[],
): ShadowProbabilityCalibrationMetrics {
  const modelRows = rows.map((row) => ({
    pmid: row.pmid,
    truthLabel: row.truthLabel,
    predictedLabel: row.predictedLabel,
    probabilities: {
      vocabulary: row.vector.vocabulary,
      values: row.vector.values,
      source: 'model_supplied' as const,
      calibrated: false as const,
      calibrationArtifactSha256: null,
    },
  }))
  return evaluateShadowProbabilityCalibration({ rows: modelRows })
}

/** Recompute the entire cross-fitted artifact; a serialized calibrated claim is never trusted. */
export function verifyCrossFittedShadowTemperatureCalibration(input: {
  scope: AuthorizedDevelopmentShadowScope
  rows: readonly ShadowCalibrationCohortRow[]
  foldRows: readonly ShadowDevelopmentFoldRow[]
  foldManifest: ShadowDevelopmentFoldManifest
  truth?: AuthorizedShadowDevelopmentTruth
  artifact: ShadowCrossFittedCalibrationArtifact
  minimumTrainingRows?: number
}): void {
  const expected = crossFitShadowTemperatureCalibration({
    scope: input.scope,
    rows: input.rows,
    foldRows: input.foldRows,
    foldManifest: input.foldManifest,
    truth: input.truth,
    candidateTemperatures: input.artifact.candidateTemperatures,
    minimumTrainingRows: input.minimumTrainingRows,
  })
  if (sha256ShadowValue(expected) !== sha256ShadowValue(input.artifact)) {
    throw new Error(
      'Cross-fitted calibration artifact does not recompute from its authorized development inputs.',
    )
  }
}
