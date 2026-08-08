import { literatureGoldSetLabels, literatureTaxonomy } from '@/features/literature/config'
import { literatureGoldCompleteReviewSchema } from '@/features/literature/schemas/gold-set'
import { z } from 'zod'

import {
  LITERATURE_GOLD_HIGH_SCORE_THRESHOLD,
  LITERATURE_GOLD_LOW_SCORE_THRESHOLD,
  LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION,
} from './constants'
import { classifyLiteratureGoldDeterministicBand } from './sampling'
import type { LiteratureGoldDeterministicBand, LiteratureGoldSetRelevanceLabel } from './types'
import type { LiteratureGoldCsvRow, LiteratureGoldExportReview } from './export'

type CountMap = Record<string, number>

export interface LiteratureGoldBandOutcome {
  total: number
  included: number
  excluded: number
  uncertain: number
  inclusionRate: number
}

export interface LiteratureGoldPilotAnalysis {
  reportVersion: '2.0.0'
  generatedAt: string
  source: {
    batchId: string
    batchName: string
    currentStateCsvSha256: string | null
    fullHistoryJsonSha256: string | null
    fullHistoryExportedAt: string
    batchContract: {
      kind: 'pilot'
      status: 'active' | 'frozen'
      taxonomyVersion: string
      labelSchemaVersion: string
      relevanceDefinitionVersion: string
      samplingAlgorithmVersion: string
      samplingSeed: number
      requestedSize: number
      frozenAt: string | null
    }
  }
  reviewSemantics: {
    firstPassBlinding: 'immutable_revision_1'
    finalDecision: 'current_revision'
  }
  analysisContracts: {
    taxonomyVersion: string
    labelSchemaVersion: string
    relevanceDefinitionVersion: string
    samplingAlgorithmVersion: string
    lowScoreThreshold: number
    highScoreThreshold: number
  }
  readiness: {
    status: 'ready' | 'ready_with_follow_up' | 'not_ready'
    gates: Array<{ id: string; passed: boolean; detail: string }>
  }
  totals: {
    records: number
    included: number
    excluded: number
    uncertain: number
    blindedFirstPass: number
    blindedCurrentRevision: number
    revised: number
    supplementalMetadata: number
    fullTextCategorization: number
  }
  counts: {
    relevance: CountMap
    metadataSufficiency: CountMap
    reviewerConfidence: CountMap
    sampleStratum: CountMap
    sourceTier: CountMap
    originalRuleBand: CountMap
    calibratedRuleBand: CountMap
  }
  outcomes: {
    bySampleStratum: Record<string, LiteratureGoldBandOutcome>
    byOriginalRuleBand: Record<string, LiteratureGoldBandOutcome>
    byCalibratedRuleBand: Record<string, LiteratureGoldBandOutcome>
  }
  coverage: {
    broadTopics: { used: string[]; missing: string[]; counts: CountMap }
    technologyTags: { used: string[]; missing: string[]; counts: CountMap }
    clinicalPurposes: { used: string[]; missing: string[]; counts: CountMap }
    diseaseTags: { used: string[]; missing: string[]; counts: CountMap }
    studyDesigns: { used: string[]; missing: string[]; counts: CountMap }
    publicationStatuses: { used: string[]; missing: string[]; counts: CountMap }
  }
  reviewTiming: {
    totalSeconds: number
    meanSeconds: number
    medianSeconds: number
    maximumSeconds: number
  }
  followUp: {
    lowConfidencePmids: string[]
    revisedPmids: string[]
    noAbstractIncludedPmids: string[]
    originalHighBandExcludedPmids: string[]
    calibratedLowBandIncludedPmids: string[]
    calibratedHighBandExcludedPmids: string[]
  }
  warnings: string[]
  limitations: string[]
}

interface LiteratureGoldPilotReviewHistory {
  firstReviewByItemId: ReadonlyMap<string, LiteratureGoldExportReview>
  exportedAt: string
  batchContract: LiteratureGoldPilotAnalysis['source']['batchContract']
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const PMID_PATTERN = /^[0-9]{1,12}$/u
const ISO_TIMESTAMP_SCHEMA = z.string().datetime({ offset: true })
const FULL_HISTORY_EXPORT_FIELDS = [
  'exportVersion',
  'exportedAt',
  'batch',
  'split',
  'includesHistory',
  'records',
] as const
const FULL_HISTORY_BATCH_FIELDS = [
  'id',
  'name',
  'kind',
  'status',
  'taxonomyVersion',
  'labelSchemaVersion',
  'relevanceDefinitionVersion',
  'samplingAlgorithmVersion',
  'samplingSeed',
  'requestedSize',
  'frozenAt',
] as const
const FULL_HISTORY_RECORD_FIELDS = [
  'itemId',
  'pmid',
  'title',
  'abstract',
  'authors',
  'journalTitle',
  'journalAbbreviation',
  'publicationYear',
  'publicationTypes',
  'sampleStratum',
  'samplingReason',
  'datasetSplit',
  'displayOrder',
  'reviewStatus',
  'reviewSource',
  'review',
  'reviewHistory',
] as const
const FULL_HISTORY_REVIEW_FIELDS = [
  'id',
  'revision',
  'relevanceLabel',
  'metadataSufficiency',
  'reviewerConfidence',
  'topicIds',
  'technologyTags',
  'clinicalPurposes',
  'diseaseTags',
  'studyDesign',
  'publicationStatus',
  'categorizationFromFullText',
  'notes',
  'usedSupplementalMetadata',
  'reviewSeconds',
  'isBlinded',
  'reviewerEmail',
  'completedAt',
] as const

function expectedObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`)
  }
  return value as Record<string, unknown>
}

function expectedString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string.`)
  }
  return value
}

function expectedIsoTimestamp(value: unknown, field: string) {
  const parsed = ISO_TIMESTAMP_SCHEMA.safeParse(value)
  if (!parsed.success) throw new Error(`${field} must be an ISO 8601 timestamp with an offset.`)
  return parsed.data
}

function expectedNullableString(value: unknown, field: string) {
  if (value === null || typeof value === 'string') return value
  throw new Error(`${field} must be a string or null.`)
}

function expectedPositiveInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error(`${field} must be a positive integer.`)
  }
  return Number(value)
}

function expectedStringArray(value: unknown, field: string) {
  const values = expectedArray(value, field)
  if (values.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${field} must contain only strings.`)
  }
  return values as string[]
}

function assertExactFields(
  value: Record<string, unknown>,
  expectedFields: readonly string[],
  field: string,
) {
  const missing = expectedFields.filter(
    (key) => !Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined,
  )
  if (missing.length > 0) {
    throw new Error(`${field} is missing required field(s): ${missing.join(', ')}.`)
  }
  const expected = new Set(expectedFields)
  const unexpected = Object.keys(value).filter((key) => !expected.has(key))
  if (unexpected.length > 0) {
    throw new Error(`${field} contains unexpected field(s): ${unexpected.join(', ')}.`)
  }
}

function expectedArray(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`)
  return value
}

function parseCompletedHistoryReview(value: unknown, field: string): LiteratureGoldExportReview {
  const review = expectedObject(value, field)
  assertExactFields(review, FULL_HISTORY_REVIEW_FIELDS, field)
  const id = expectedString(review.id, `${field}.id`)
  if (!UUID_PATTERN.test(id)) throw new Error(`${field}.id must be a UUID.`)
  if (!Number.isInteger(review.revision) || Number(review.revision) < 1) {
    throw new Error(`${field}.revision must be a positive integer.`)
  }
  if (typeof review.isBlinded !== 'boolean') {
    throw new Error(`${field}.isBlinded must be a boolean.`)
  }
  if (review.reviewerEmail !== null && typeof review.reviewerEmail !== 'string') {
    throw new Error(`${field}.reviewerEmail must be a string or null.`)
  }
  const completedAt = expectedIsoTimestamp(review.completedAt, `${field}.completedAt`)
  const payload = literatureGoldCompleteReviewSchema.safeParse(review)
  if (!payload.success) {
    const issue = payload.error.issues[0]
    const path = issue?.path.length ? `.${issue.path.join('.')}` : ''
    throw new Error(`${field}${path}: ${issue?.message ?? 'invalid completed review.'}`)
  }
  return {
    id,
    revision: Number(review.revision),
    ...payload.data,
    isBlinded: review.isBlinded,
    reviewerEmail: review.reviewerEmail as string | null,
    completedAt,
  }
}

function comparableReview(review: LiteratureGoldExportReview) {
  return JSON.stringify({
    id: review.id,
    revision: review.revision,
    relevanceLabel: review.relevanceLabel,
    metadataSufficiency: review.metadataSufficiency,
    reviewerConfidence: review.reviewerConfidence,
    topicIds: review.topicIds,
    technologyTags: review.technologyTags,
    clinicalPurposes: review.clinicalPurposes,
    diseaseTags: review.diseaseTags,
    studyDesign: review.studyDesign,
    publicationStatus: review.publicationStatus,
    categorizationFromFullText: review.categorizationFromFullText,
    notes: review.notes,
    usedSupplementalMetadata: review.usedSupplementalMetadata,
    reviewSeconds: review.reviewSeconds,
    isBlinded: review.isBlinded,
    reviewerEmail: review.reviewerEmail,
    completedAt: review.completedAt,
  })
}

function validatePilotReviewHistory(
  value: unknown,
  rows: LiteratureGoldCsvRow[],
): LiteratureGoldPilotReviewHistory {
  const exported = expectedObject(value, 'Full-history export')
  assertExactFields(exported, FULL_HISTORY_EXPORT_FIELDS, 'Full-history export')
  if (exported.exportVersion !== '1.0.0') {
    throw new Error(
      `Full-history export must use exportVersion 1.0.0; received ${String(exported.exportVersion)}.`,
    )
  }
  if (exported.split !== 'all') throw new Error('Full-history export must use split=all.')
  if (exported.includesHistory !== true) {
    throw new Error('Full-history export must include immutable review history.')
  }
  const exportedAt = expectedIsoTimestamp(exported.exportedAt, 'Full-history export.exportedAt')
  const batch = expectedObject(exported.batch, 'Full-history export.batch')
  assertExactFields(batch, FULL_HISTORY_BATCH_FIELDS, 'Full-history export.batch')
  const batchId = expectedString(batch.id, 'Full-history export.batch.id')
  const batchName = expectedString(batch.name, 'Full-history export.batch.name')
  if (batch.kind !== 'pilot') {
    throw new Error(`Full-history batch kind must be pilot; received ${String(batch.kind)}.`)
  }
  if (batch.status !== 'active' && batch.status !== 'frozen') {
    throw new Error(
      `Full-history pilot status must be active or frozen; received ${String(batch.status)}.`,
    )
  }
  const status = batch.status
  const taxonomyVersion = expectedString(
    batch.taxonomyVersion,
    'Full-history export.batch.taxonomyVersion',
  )
  const labelSchemaVersion = expectedString(
    batch.labelSchemaVersion,
    'Full-history export.batch.labelSchemaVersion',
  )
  const relevanceDefinitionVersion = expectedString(
    batch.relevanceDefinitionVersion,
    'Full-history export.batch.relevanceDefinitionVersion',
  )
  const samplingAlgorithmVersion = expectedString(
    batch.samplingAlgorithmVersion,
    'Full-history export.batch.samplingAlgorithmVersion',
  )
  const samplingSeed = expectedPositiveInteger(
    batch.samplingSeed,
    'Full-history export.batch.samplingSeed',
  )
  const requestedSize = expectedPositiveInteger(
    batch.requestedSize,
    'Full-history export.batch.requestedSize',
  )
  let frozenAt: string | null
  if (status === 'frozen') {
    frozenAt = expectedIsoTimestamp(batch.frozenAt, 'Full-history export.batch.frozenAt')
  } else {
    if (batch.frozenAt !== null) {
      throw new Error('An active full-history pilot must have batch.frozenAt=null.')
    }
    frozenAt = null
  }
  const expectedBatchId = rows[0]?.batchId ?? ''
  const expectedBatchName = rows[0]?.batchName ?? ''
  if (batchId !== expectedBatchId || batchName !== expectedBatchName) {
    throw new Error(
      `Full-history batch ${batchName} (${batchId}) does not match current-state CSV batch ${expectedBatchName} (${expectedBatchId}).`,
    )
  }

  const records = expectedArray(exported.records, 'Full-history export.records')
  if (requestedSize !== rows.length || requestedSize !== records.length) {
    throw new Error(
      `Full-history batch requestedSize ${requestedSize} must equal the ${rows.length} current-state rows and ${records.length} history records.`,
    )
  }
  if (records.length !== rows.length) {
    throw new Error(
      `Full-history export contains ${records.length} records; current-state CSV contains ${rows.length}.`,
    )
  }
  const currentRowsByItemId = new Map(rows.map((row) => [row.itemId, row]))
  const seenPmids = new Set<string>()
  const firstReviewByItemId = new Map<string, LiteratureGoldExportReview>()

  records.forEach((rawRecord, recordIndex) => {
    const field = `Full-history export.records[${recordIndex}]`
    const record = expectedObject(rawRecord, field)
    assertExactFields(record, FULL_HISTORY_RECORD_FIELDS, field)
    const itemId = expectedString(record.itemId, `${field}.itemId`)
    const pmid = expectedString(record.pmid, `${field}.pmid`)
    if (!UUID_PATTERN.test(itemId)) throw new Error(`${field}.itemId must be a UUID.`)
    if (!PMID_PATTERN.test(pmid)) throw new Error(`${field}.pmid must be numeric.`)
    if (firstReviewByItemId.has(itemId)) {
      throw new Error(`Full-history export contains duplicate item ID ${itemId}.`)
    }
    if (seenPmids.has(pmid)) throw new Error(`Full-history export contains duplicate PMID ${pmid}.`)
    seenPmids.add(pmid)

    const currentRow = currentRowsByItemId.get(itemId)
    if (!currentRow || currentRow.pmid !== pmid) {
      throw new Error(
        `Full-history item ${itemId} / PMID ${pmid} is absent from the current-state CSV.`,
      )
    }
    expectedString(record.title, `${field}.title`)
    expectedNullableString(record.abstract, `${field}.abstract`)
    expectedArray(record.authors, `${field}.authors`)
    expectedNullableString(record.journalTitle, `${field}.journalTitle`)
    expectedNullableString(record.journalAbbreviation, `${field}.journalAbbreviation`)
    if (
      record.publicationYear !== null &&
      (!Number.isInteger(record.publicationYear) ||
        Number(record.publicationYear) < 1000 ||
        Number(record.publicationYear) > 9999)
    ) {
      throw new Error(`${field}.publicationYear must be a four-digit integer or null.`)
    }
    expectedStringArray(record.publicationTypes, `${field}.publicationTypes`)
    expectedString(record.sampleStratum, `${field}.sampleStratum`)
    expectedString(record.samplingReason, `${field}.samplingReason`)
    expectedPositiveInteger(record.displayOrder, `${field}.displayOrder`)
    if (record.datasetSplit !== currentRow.datasetSplit) {
      throw new Error(
        `Full-history PMID ${pmid} datasetSplit ${String(record.datasetSplit)} does not match current-state CSV ${currentRow.datasetSplit}.`,
      )
    }
    if (record.datasetSplit !== 'development') {
      throw new Error(`Full-history PMID ${pmid} must remain in the development split.`)
    }
    if (record.reviewStatus !== 'completed' || record.reviewSource !== 'completed') {
      throw new Error(`Full-history PMID ${pmid} must have a completed current decision.`)
    }
    const currentReview = parseCompletedHistoryReview(
      record.review,
      `Full-history PMID ${pmid} current review`,
    )
    const history = expectedArray(
      record.reviewHistory,
      `Full-history PMID ${pmid} reviewHistory`,
    ).map((review, reviewIndex) =>
      parseCompletedHistoryReview(
        review,
        `Full-history PMID ${pmid} reviewHistory[${reviewIndex}]`,
      ),
    )
    if (history.length === 0) {
      throw new Error(`Full-history PMID ${pmid} has no immutable review revisions.`)
    }
    const orderedHistory = [...history].sort(
      (left, right) => (left.revision ?? 0) - (right.revision ?? 0),
    )
    orderedHistory.forEach((review, reviewIndex) => {
      if (review.revision !== reviewIndex + 1) {
        throw new Error(`Full-history PMID ${pmid} must contain contiguous revisions from 1.`)
      }
    })
    const historyIds = orderedHistory.map((review) => review.id)
    if (new Set(historyIds).size !== historyIds.length) {
      throw new Error(`Full-history PMID ${pmid} contains duplicate review IDs.`)
    }
    const latestReview = orderedHistory.at(-1)
    if (!latestReview || comparableReview(currentReview) !== comparableReview(latestReview)) {
      throw new Error(
        `Full-history PMID ${pmid} current review does not match its latest immutable revision.`,
      )
    }
    if (comparableReview(currentRow.review) !== comparableReview(currentReview)) {
      throw new Error(
        `Full-history PMID ${pmid} current review does not match the current-state CSV.`,
      )
    }
    firstReviewByItemId.set(itemId, orderedHistory[0] as LiteratureGoldExportReview)
  })

  for (const row of rows) {
    if (!firstReviewByItemId.has(row.itemId)) {
      throw new Error(`Current-state CSV PMID ${row.pmid} is absent from the full-history export.`)
    }
  }
  return {
    firstReviewByItemId,
    exportedAt,
    batchContract: {
      kind: 'pilot',
      status,
      taxonomyVersion,
      labelSchemaVersion,
      relevanceDefinitionVersion,
      samplingAlgorithmVersion,
      samplingSeed,
      requestedSize,
      frozenAt,
    },
  }
}

function countValues(values: Array<string | null>) {
  return values.reduce<CountMap>((counts, value) => {
    if (value) counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function included(label: string | null): label is 'include_core' | 'include_adjacent' {
  return label === 'include_core' || label === 'include_adjacent'
}

function outcome(rows: LiteratureGoldCsvRow[]): LiteratureGoldBandOutcome {
  const includedCount = rows.filter((row) => included(row.review.relevanceLabel)).length
  const excluded = rows.filter((row) => row.review.relevanceLabel === 'exclude').length
  const uncertain = rows.filter((row) => row.review.relevanceLabel === 'uncertain').length
  return {
    total: rows.length,
    included: includedCount,
    excluded,
    uncertain,
    inclusionRate: rows.length === 0 ? 0 : Number((includedCount / rows.length).toFixed(4)),
  }
}

function groupedOutcomes(rows: LiteratureGoldCsvRow[], key: (row: LiteratureGoldCsvRow) => string) {
  const values = new Map<string, LiteratureGoldCsvRow[]>()
  for (const row of rows) {
    const group = key(row)
    values.set(group, [...(values.get(group) ?? []), row])
  }
  return Object.fromEntries(
    [...values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([group, groupedRows]) => [group, outcome(groupedRows)]),
  )
}

interface SamplingSignals {
  ruleBand: LiteratureGoldDeterministicBand | null
  score: number | null
  sourceTier: string | null
}

function samplingSignals(reason: string | null): SamplingSignals {
  if (!reason) return { ruleBand: null, score: null, sourceTier: null }
  const entries = reason.split(';').flatMap((part): Array<[string, string]> => {
    const normalized = part.trim()
    const separator = normalized.indexOf('=')
    return separator > 0 ? [[normalized.slice(0, separator), normalized.slice(separator + 1)]] : []
  })
  const values = new Map(entries)
  const ruleBand = values.get('rule_band')
  const rawScore = values.get('score')
  const score = rawScore && /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/u.test(rawScore) ? Number(rawScore) : null
  return {
    ruleBand:
      ruleBand === 'high' || ruleBand === 'intermediate' || ruleBand === 'low' ? ruleBand : null,
    score,
    sourceTier: values.get('source') || null,
  }
}

function controlledCoverage(values: string[], allowed: string[]) {
  const counts = countValues(values)
  return {
    used: allowed.filter((value) => (counts[value] ?? 0) > 0),
    missing: allowed.filter((value) => (counts[value] ?? 0) === 0),
    counts,
  }
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? 0)
}

export function analyzeLiteratureGoldPilot(
  rows: LiteratureGoldCsvRow[],
  fullHistoryExport: unknown,
  options: {
    generatedAt?: string
    currentStateCsvSha256?: string | null
    fullHistoryJsonSha256?: string | null
  } = {},
): LiteratureGoldPilotAnalysis {
  if (rows.length === 0) throw new Error('Pilot analysis requires at least one completed row.')
  const incompleteRow = rows.find(
    (row) => row.reviewSource !== 'completed' || row.reviewStatus !== 'completed',
  )
  if (incompleteRow) {
    throw new Error(
      `Pilot readiness analysis requires a completed row for PMID ${incompleteRow.pmid}.`,
    )
  }
  const nonDevelopmentRow = rows.find((row) => row.datasetSplit !== 'development')
  if (nonDevelopmentRow) {
    throw new Error(
      `Pilot readiness analysis is development-only; PMID ${nonDevelopmentRow.pmid} is in ${nonDevelopmentRow.datasetSplit}.`,
    )
  }
  const history = validatePilotReviewHistory(fullHistoryExport, rows)
  const firstReview = (row: LiteratureGoldCsvRow) => {
    const review = history.firstReviewByItemId.get(row.itemId)
    if (!review) throw new Error(`Missing validated first review for PMID ${row.pmid}.`)
    return review
  }

  const warnings: string[] = []
  const signals = new Map(rows.map((row) => [row.itemId, samplingSignals(row.samplingReason)]))
  const rowsWithoutScore = rows.filter((row) => signals.get(row.itemId)?.score === null)
  if (rowsWithoutScore.length > 0) {
    warnings.push(
      `${rowsWithoutScore.length} rows lacked a parseable deterministic score in sampling_reason.`,
    )
  }

  const rowsWithScore = rows.filter(
    (row) => signals.get(row.itemId)?.score !== null,
  ) as LiteratureGoldCsvRow[]
  const calibratedBand = (row: LiteratureGoldCsvRow) => {
    const score = signals.get(row.itemId)?.score
    return score === null || score === undefined
      ? 'unknown'
      : classifyLiteratureGoldDeterministicBand(score)
  }
  const originalBand = (row: LiteratureGoldCsvRow) => signals.get(row.itemId)?.ruleBand ?? 'unknown'
  const relevance = (row: LiteratureGoldCsvRow) =>
    row.review.relevanceLabel as LiteratureGoldSetRelevanceLabel | null
  const revisedRows = rows.filter((row) => (row.review.revision ?? 0) > 1)
  const reviewSeconds = rows.map((row) => row.review.reviewSeconds)
  const includedRows = rows.filter((row) => included(relevance(row)))
  const allCompleted = rows.every(
    (row) => row.reviewSource === 'completed' && row.reviewStatus === 'completed',
  )
  const allDevelopment = rows.every((row) => row.datasetSplit === 'development')
  const allFirstPassBlinded = rows.every((row) => firstReview(row).isBlinded === true)
  const noUncertain = rows.every((row) => relevance(row) !== 'uncertain')

  const calibratedOutcomes = groupedOutcomes(rowsWithScore, calibratedBand)
  const calibratedIntermediate = calibratedOutcomes.intermediate
  const mixedIntermediate = Boolean(
    calibratedIntermediate &&
    calibratedIntermediate.included > 0 &&
    calibratedIntermediate.excluded > 0,
  )
  const broadTopicIds = literatureTaxonomy.topics.map((topic) => topic.id)
  const broadTopicCoverage = controlledCoverage(
    includedRows.flatMap((row) => row.review.topicIds),
    broadTopicIds,
  )
  const calibratedHighBandExcludedPmids = rows
    .filter((row) => calibratedBand(row) === 'high' && relevance(row) === 'exclude')
    .map((row) => row.pmid)

  const gates = [
    {
      id: 'all-completed',
      passed: allCompleted,
      detail: `${rows.filter((row) => row.reviewSource === 'completed').length}/${rows.length} rows have completed decisions.`,
    },
    {
      id: 'development-only',
      passed: allDevelopment,
      detail: allDevelopment
        ? 'Every pilot row remains in the development split.'
        : 'A pilot row was assigned to a held-out split.',
    },
    {
      id: 'blinded-first-pass',
      passed: allFirstPassBlinded,
      detail: `${rows.filter((row) => firstReview(row).isBlinded === true).length}/${rows.length} immutable first review revisions are marked blinded.`,
    },
    {
      id: 'resolved-relevance',
      passed: noUncertain,
      detail: `${rows.filter((row) => relevance(row) === 'uncertain').length} uncertain decisions remain.`,
    },
    {
      id: 'broad-topic-coverage',
      passed: broadTopicCoverage.missing.length === 0,
      detail: `${broadTopicCoverage.used.length}/${broadTopicIds.length} broad topics are represented.`,
    },
    {
      id: 'usable-boundary-band',
      passed: mixedIntermediate,
      detail: mixedIntermediate
        ? 'The calibrated intermediate band contains both included and excluded articles.'
        : 'The calibrated intermediate band does not contain both sides of the relevance boundary.',
    },
    {
      id: 'high-band-audit',
      passed: calibratedHighBandExcludedPmids.length === 0,
      detail: `${calibratedHighBandExcludedPmids.length} calibrated high-band articles were excluded.`,
    },
  ]
  const hardGatesPass = gates.every((gate) => gate.passed)
  const followUpRecommended =
    revisedRows.length > 0 ||
    rows.some((row) => row.review.reviewerConfidence === 'low') ||
    rowsWithoutScore.length > 0

  return {
    reportVersion: '2.0.0',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: {
      batchId: rows[0]?.batchId ?? '',
      batchName: rows[0]?.batchName ?? '',
      currentStateCsvSha256: options.currentStateCsvSha256 ?? null,
      fullHistoryJsonSha256: options.fullHistoryJsonSha256 ?? null,
      fullHistoryExportedAt: history.exportedAt,
      batchContract: history.batchContract,
    },
    reviewSemantics: {
      firstPassBlinding: 'immutable_revision_1',
      finalDecision: 'current_revision',
    },
    analysisContracts: {
      taxonomyVersion: literatureTaxonomy.taxonomy_version,
      labelSchemaVersion: literatureGoldSetLabels.label_schema_version,
      relevanceDefinitionVersion: literatureGoldSetLabels.relevance_definition_version,
      samplingAlgorithmVersion: LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION,
      lowScoreThreshold: LITERATURE_GOLD_LOW_SCORE_THRESHOLD,
      highScoreThreshold: LITERATURE_GOLD_HIGH_SCORE_THRESHOLD,
    },
    readiness: {
      status: hardGatesPass
        ? followUpRecommended
          ? 'ready_with_follow_up'
          : 'ready'
        : 'not_ready',
      gates,
    },
    totals: {
      records: rows.length,
      included: includedRows.length,
      excluded: rows.filter((row) => relevance(row) === 'exclude').length,
      uncertain: rows.filter((row) => relevance(row) === 'uncertain').length,
      blindedFirstPass: rows.filter((row) => firstReview(row).isBlinded === true).length,
      blindedCurrentRevision: rows.filter((row) => row.review.isBlinded === true).length,
      revised: revisedRows.length,
      supplementalMetadata: rows.filter((row) => row.review.usedSupplementalMetadata).length,
      fullTextCategorization: rows.filter((row) => row.review.categorizationFromFullText).length,
    },
    counts: {
      relevance: countValues(rows.map((row) => relevance(row))),
      metadataSufficiency: countValues(rows.map((row) => row.review.metadataSufficiency)),
      reviewerConfidence: countValues(rows.map((row) => row.review.reviewerConfidence)),
      sampleStratum: countValues(rows.map((row) => row.sampleStratum)),
      sourceTier: countValues(rows.map((row) => signals.get(row.itemId)?.sourceTier ?? null)),
      originalRuleBand: countValues(rows.map(originalBand)),
      calibratedRuleBand: countValues(rows.map(calibratedBand)),
    },
    outcomes: {
      bySampleStratum: groupedOutcomes(rows, (row) => row.sampleStratum ?? 'unknown'),
      byOriginalRuleBand: groupedOutcomes(rows, originalBand),
      byCalibratedRuleBand: calibratedOutcomes,
    },
    coverage: {
      broadTopics: broadTopicCoverage,
      technologyTags: controlledCoverage(
        includedRows.flatMap((row) => row.review.technologyTags),
        literatureGoldSetLabels.technology_tags.map((tag) => tag.id),
      ),
      clinicalPurposes: controlledCoverage(
        includedRows.flatMap((row) => row.review.clinicalPurposes),
        literatureTaxonomy.facets.clinical_purpose,
      ),
      diseaseTags: controlledCoverage(
        includedRows.flatMap((row) => row.review.diseaseTags),
        literatureTaxonomy.facets.disease,
      ),
      studyDesigns: controlledCoverage(
        includedRows.flatMap((row) => (row.review.studyDesign ? [row.review.studyDesign] : [])),
        literatureTaxonomy.facets.study_design,
      ),
      publicationStatuses: controlledCoverage(
        includedRows.flatMap((row) =>
          row.review.publicationStatus ? [row.review.publicationStatus] : [],
        ),
        literatureTaxonomy.facets.publication_class,
      ),
    },
    reviewTiming: {
      totalSeconds: reviewSeconds.reduce((total, value) => total + value, 0),
      meanSeconds: Number(
        (reviewSeconds.reduce((total, value) => total + value, 0) / rows.length).toFixed(2),
      ),
      medianSeconds: median(reviewSeconds),
      maximumSeconds: Math.max(...reviewSeconds),
    },
    followUp: {
      lowConfidencePmids: rows
        .filter((row) => row.review.reviewerConfidence === 'low')
        .map((row) => row.pmid),
      revisedPmids: revisedRows.map((row) => row.pmid),
      noAbstractIncludedPmids: includedRows
        .filter((row) => row.review.metadataSufficiency === 'no_abstract')
        .map((row) => row.pmid),
      originalHighBandExcludedPmids: rows
        .filter((row) => originalBand(row) === 'high' && relevance(row) === 'exclude')
        .map((row) => row.pmid),
      calibratedLowBandIncludedPmids: includedRows
        .filter((row) => calibratedBand(row) === 'low')
        .map((row) => row.pmid),
      calibratedHighBandExcludedPmids,
    },
    warnings,
    limitations: [
      'This pilot was deliberately stratified and cannot estimate prevalence or population-level classifier performance.',
      'Band outcomes evaluate deterministic sampling signals, not a deployed relevance classifier.',
      'First-pass blinding is read from immutable revision 1; final labels, confidence, categorization, and timing are read from the current revision.',
      'Review seconds can include idle time, supplemental review, or revision time and are not a pure first-pass effort measure.',
    ],
  }
}

function markdownTable(
  outcomes: Record<string, LiteratureGoldBandOutcome>,
  heading: string,
): string[] {
  return [
    `### ${heading}`,
    '',
    '| Group | Total | Included | Excluded | Uncertain | Inclusion yield |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(outcomes).map(
      ([group, value]) =>
        `| ${group.replaceAll('_', '\\_')} | ${value.total} | ${value.included} | ${value.excluded} | ${value.uncertain} | ${(value.inclusionRate * 100).toFixed(1)}% |`,
    ),
    '',
  ]
}

function pmidList(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None'
}

export function serializeLiteratureGoldPilotAnalysisMarkdown(report: LiteratureGoldPilotAnalysis) {
  const lines = [
    `# ${report.source.batchName} readiness analysis`,
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Current-state CSV SHA-256: ${report.source.currentStateCsvSha256 ?? 'Not recorded'}`,
    '',
    `Full-history JSON SHA-256: ${report.source.fullHistoryJsonSha256 ?? 'Not recorded'}`,
    '',
    `Full-history exported: ${report.source.fullHistoryExportedAt}`,
    '',
    `Source batch contract: ${report.source.batchContract.kind}; status ${report.source.batchContract.status}; taxonomy ${report.source.batchContract.taxonomyVersion}; labels ${report.source.batchContract.labelSchemaVersion}; relevance ${report.source.batchContract.relevanceDefinitionVersion}; sampling ${report.source.batchContract.samplingAlgorithmVersion}; requested size ${report.source.batchContract.requestedSize}.`,
    '',
    'Review semantics: first-pass blinding comes from immutable revision 1; final labels, confidence, and categorization come from the current revision.',
    '',
    `Analysis contracts: taxonomy ${report.analysisContracts.taxonomyVersion}; labels ${report.analysisContracts.labelSchemaVersion}; relevance ${report.analysisContracts.relevanceDefinitionVersion}; sampling ${report.analysisContracts.samplingAlgorithmVersion}.`,
    '',
    `Sampling bands: low below ${report.analysisContracts.lowScoreThreshold.toFixed(2)}; intermediate from ${report.analysisContracts.lowScoreThreshold.toFixed(2)} to below ${report.analysisContracts.highScoreThreshold.toFixed(2)}; high at least ${report.analysisContracts.highScoreThreshold.toFixed(2)}.`,
    '',
    `Status: **${report.readiness.status.replaceAll('_', ' ')}**`,
    '',
    'This is a development-only sampling and workflow diagnostic. It is not a population performance estimate.',
    '',
    '## Readiness gates',
    '',
    ...report.readiness.gates.map(
      (gate) => `- ${gate.passed ? 'PASS' : 'FAIL'} — ${gate.id}: ${gate.detail}`,
    ),
    '',
    '## Pilot summary',
    '',
    `- Records: ${report.totals.records}`,
    `- Included: ${report.totals.included}`,
    `- Excluded: ${report.totals.excluded}`,
    `- Uncertain: ${report.totals.uncertain}`,
    `- Blinded first decisions: ${report.totals.blindedFirstPass}`,
    `- Blinded current revisions: ${report.totals.blindedCurrentRevision}`,
    `- Revised current decisions: ${report.totals.revised}`,
    `- Supplemental metadata used: ${report.totals.supplementalMetadata}`,
    `- Full-text categorization: ${report.totals.fullTextCategorization}`,
    '',
    ...markdownTable(report.outcomes.bySampleStratum, 'Sample-stratum outcomes'),
    ...markdownTable(report.outcomes.byOriginalRuleBand, 'Original band outcomes'),
    ...markdownTable(report.outcomes.byCalibratedRuleBand, 'Stratified-v2 band outcomes'),
    '## Controlled-vocabulary coverage',
    '',
    `- Broad topics: ${report.coverage.broadTopics.used.length} used; ${report.coverage.broadTopics.missing.length} missing`,
    `- Technology tags: ${report.coverage.technologyTags.used.length} used; ${report.coverage.technologyTags.missing.length} missing`,
    `- Clinical purposes: ${report.coverage.clinicalPurposes.used.length} used; ${report.coverage.clinicalPurposes.missing.length} missing`,
    `- Disease tags: ${report.coverage.diseaseTags.used.length} used; ${report.coverage.diseaseTags.missing.length} missing`,
    `- Study designs: ${report.coverage.studyDesigns.used.length} used; ${report.coverage.studyDesigns.missing.length} missing`,
    `- Publication statuses: ${report.coverage.publicationStatuses.used.length} used; ${report.coverage.publicationStatuses.missing.length} missing`,
    '',
    '## Follow-up and regression candidates',
    '',
    `- Low-confidence decisions: ${pmidList(report.followUp.lowConfidencePmids)}`,
    `- Revised current decisions: ${pmidList(report.followUp.revisedPmids)}`,
    `- Included without abstracts: ${pmidList(report.followUp.noAbstractIncludedPmids)}`,
    `- Original high-band exclusions: ${pmidList(report.followUp.originalHighBandExcludedPmids)}`,
    `- Stratified-v2 low-band inclusions: ${pmidList(report.followUp.calibratedLowBandIncludedPmids)}`,
    `- Stratified-v2 high-band exclusions: ${pmidList(report.followUp.calibratedHighBandExcludedPmids)}`,
    '',
    '## Limitations',
    '',
    ...report.limitations.map((limitation) => `- ${limitation}`),
    '',
  ]
  if (report.warnings.length > 0) {
    lines.push('## Warnings', '', ...report.warnings.map((warning) => `- ${warning}`), '')
  }
  return `${lines.join('\n')}\n`
}
