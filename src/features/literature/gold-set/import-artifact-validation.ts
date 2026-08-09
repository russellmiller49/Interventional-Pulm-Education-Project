import { createHash } from 'node:crypto'

import { parseCsvRows } from './export'
import {
  canonicalJson,
  goldReviewClinicalProjectionSchema,
  goldReviewPayloadSchema,
  type GoldReviewPayload,
  type ImportAction,
  type ImportPlan,
} from './import-compensation'

const REQUIRED_COLUMNS = [
  'gold_set_item_id',
  'master_row_id',
  'pmid',
  'dataset_split',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency',
  'topic_ids',
  'technology_tags',
  'technology_tag_status',
  'clinical_purposes',
  'disease_tags',
  'disease_tag_status',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'physician_notes',
  'full_text_used',
  'is_blinded',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'enrichment_provenance',
] as const

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number]
type ArtifactRecord = Record<RequiredColumn, string>

const PROJECTION_COLUMNS = {
  relevanceLabel: 'physician_final_label',
  reviewerConfidence: 'physician_final_confidence',
  metadataSufficiency: 'metadata_sufficiency',
  topicIds: 'topic_ids',
  technologyTags: 'technology_tags',
  technologyTagStatus: 'technology_tag_status',
  clinicalPurposes: 'clinical_purposes',
  diseaseTags: 'disease_tags',
  diseaseTagStatus: 'disease_tag_status',
  studyDesign: 'study_design',
  publicationStatus: 'publication_status',
  categorizationFromFullText: 'categorization_from_full_text',
  notes: 'physician_notes',
  usedSupplementalMetadata: 'full_text_used',
  isBlinded: 'is_blinded',
  taxonomyVersion: 'taxonomy_version',
  labelSchemaVersion: 'label_schema_version',
  enrichmentSchemaVersion: 'enrichment_schema_version',
  enrichmentProvenance: 'enrichment_provenance',
} as const satisfies Record<keyof FinalizedReviewProjection, RequiredColumn>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const PMID_PATTERN = /^[0-9]{1,12}$/u
const MASTER_ROW_ID_PATTERN = /^[1-9][0-9]*$/u
const TAG_STATUSES = new Set(['tagged', 'not_applicable', 'not_assessable'])

export const FINALIZED_ARTIFACT_BOOLEAN_LEXEMES = ['true', 'false', 'True', 'False'] as const

export function parseFinalizedArtifactBooleanValue(value: string): boolean {
  if (!(FINALIZED_ARTIFACT_BOOLEAN_LEXEMES as readonly string[]).includes(value)) {
    throw new Error('must use exactly true, false, True, or False.')
  }
  return value === 'true' || value === 'True'
}

interface FinalizedReviewProjection {
  relevanceLabel: GoldReviewPayload['relevanceLabel']
  reviewerConfidence: GoldReviewPayload['reviewerConfidence']
  metadataSufficiency: GoldReviewPayload['metadataSufficiency']
  topicIds: GoldReviewPayload['topicIds']
  technologyTags: GoldReviewPayload['technologyTags']
  technologyTagStatus: GoldReviewPayload['technologyTagStatus']
  clinicalPurposes: GoldReviewPayload['clinicalPurposes']
  diseaseTags: GoldReviewPayload['diseaseTags']
  diseaseTagStatus: GoldReviewPayload['diseaseTagStatus']
  studyDesign: GoldReviewPayload['studyDesign']
  publicationStatus: GoldReviewPayload['publicationStatus']
  categorizationFromFullText: GoldReviewPayload['categorizationFromFullText']
  notes: GoldReviewPayload['notes']
  usedSupplementalMetadata: GoldReviewPayload['usedSupplementalMetadata']
  isBlinded: GoldReviewPayload['isBlinded']
  taxonomyVersion: GoldReviewPayload['taxonomyVersion']
  labelSchemaVersion: GoldReviewPayload['labelSchemaVersion']
  enrichmentSchemaVersion: GoldReviewPayload['enrichmentSchemaVersion']
  enrichmentProvenance: GoldReviewPayload['enrichmentProvenance']
}

export interface GoldImportArtifactValidationSummary {
  artifactSha256: string
  contractVersion: ImportPlan['contractVersion']
  datasetSplit: 'development'
  insertActionCount: number
  kind: 'gold_import_source_artifact_validation'
  noopActionCount: number
  planSha256: string
  rowCount: number
  valid: true
}

export interface ValidateGoldImportArtifactInput {
  compatibility?: {
    optionalTagStatusResolutions: readonly {
      diseaseTagStatus: 'not_applicable' | 'not_assessable'
      itemId: string
      pmid: string
      technologyTagStatus: 'not_applicable' | 'not_assessable'
    }[]
  }
  csvText: string
  plan: ImportPlan
}

function artifactSha256(csvText: string): string {
  return createHash('sha256').update(csvText, 'utf8').digest('hex')
}

function recordError(recordNumber: number, column: string, message: string): never {
  throw new Error(`Finalized V3 CSV record ${recordNumber}, column ${column}: ${message}`)
}

function strictToken(record: ArtifactRecord, recordNumber: number, column: RequiredColumn) {
  const value = record[column]
  if (!value) return recordError(recordNumber, column, 'is required.')
  if (value.trim() !== value) {
    return recordError(recordNumber, column, 'must not contain surrounding whitespace.')
  }
  return value
}

function nullableToken(record: ArtifactRecord, recordNumber: number, column: RequiredColumn) {
  const value = record[column]
  if (!value) return null
  if (value.trim() !== value) {
    return recordError(recordNumber, column, 'must not contain surrounding whitespace.')
  }
  return value
}

function strictBoolean(record: ArtifactRecord, recordNumber: number, column: RequiredColumn) {
  const value = record[column]
  try {
    return parseFinalizedArtifactBooleanValue(value)
  } catch (error) {
    return recordError(recordNumber, column, error instanceof Error ? error.message : String(error))
  }
}

function strictPipeList(record: ArtifactRecord, recordNumber: number, column: RequiredColumn) {
  const value = record[column]
  if (!value) return []
  const values = value.split('|')
  if (values.some((item) => !item)) {
    return recordError(recordNumber, column, 'contains a blank list item.')
  }
  if (values.some((item) => item.trim() !== item)) {
    return recordError(
      recordNumber,
      column,
      'must use canonical pipe-delimited values without surrounding spaces.',
    )
  }
  if (new Set(values).size !== values.length) {
    return recordError(recordNumber, column, 'contains a duplicate value.')
  }
  if (values.some((item, index) => index > 0 && values[index - 1] > item)) {
    return recordError(recordNumber, column, 'must use canonical ascending order.')
  }
  return values
}

function finalizedProjection(
  record: ArtifactRecord,
  recordNumber: number,
  compatibilityResolution?: {
    diseaseTagStatus: 'not_applicable' | 'not_assessable'
    technologyTagStatus: 'not_applicable' | 'not_assessable'
  },
): FinalizedReviewProjection {
  const technologyTagStatus =
    record.technology_tag_status || compatibilityResolution?.technologyTagStatus
  const diseaseTagStatus = record.disease_tag_status || compatibilityResolution?.diseaseTagStatus
  if (!technologyTagStatus || !diseaseTagStatus) {
    return recordError(
      recordNumber,
      !technologyTagStatus ? 'technology_tag_status' : 'disease_tag_status',
      'is blank and requires a checksum-bound physician compatibility decision.',
    )
  }
  if (
    compatibilityResolution &&
    (record.technology_tag_status !== '' || record.disease_tag_status !== '')
  ) {
    return recordError(
      recordNumber,
      'technology_tag_status',
      'has an unauthorized compatibility resolution for nonblank source statuses.',
    )
  }
  if (!TAG_STATUSES.has(technologyTagStatus)) {
    return recordError(recordNumber, 'technology_tag_status', 'is not a supported tag status.')
  }
  if (!TAG_STATUSES.has(diseaseTagStatus)) {
    return recordError(recordNumber, 'disease_tag_status', 'is not a supported tag status.')
  }
  return {
    relevanceLabel: strictToken(
      record,
      recordNumber,
      'physician_final_label',
    ) as FinalizedReviewProjection['relevanceLabel'],
    reviewerConfidence: strictToken(
      record,
      recordNumber,
      'physician_final_confidence',
    ) as FinalizedReviewProjection['reviewerConfidence'],
    metadataSufficiency: strictToken(
      record,
      recordNumber,
      'metadata_sufficiency',
    ) as FinalizedReviewProjection['metadataSufficiency'],
    topicIds: strictPipeList(record, recordNumber, 'topic_ids'),
    technologyTags: strictPipeList(record, recordNumber, 'technology_tags'),
    technologyTagStatus: technologyTagStatus as FinalizedReviewProjection['technologyTagStatus'],
    clinicalPurposes: strictPipeList(record, recordNumber, 'clinical_purposes'),
    diseaseTags: strictPipeList(record, recordNumber, 'disease_tags'),
    diseaseTagStatus: diseaseTagStatus as FinalizedReviewProjection['diseaseTagStatus'],
    studyDesign: nullableToken(
      record,
      recordNumber,
      'study_design',
    ) as FinalizedReviewProjection['studyDesign'],
    publicationStatus: nullableToken(
      record,
      recordNumber,
      'publication_status',
    ) as FinalizedReviewProjection['publicationStatus'],
    categorizationFromFullText: strictBoolean(
      record,
      recordNumber,
      'categorization_from_full_text',
    ),
    notes: record.physician_notes,
    usedSupplementalMetadata: strictBoolean(record, recordNumber, 'full_text_used'),
    isBlinded: strictBoolean(record, recordNumber, 'is_blinded'),
    taxonomyVersion: strictToken(record, recordNumber, 'taxonomy_version'),
    labelSchemaVersion: strictToken(record, recordNumber, 'label_schema_version'),
    enrichmentSchemaVersion: strictToken(record, recordNumber, 'enrichment_schema_version'),
    enrichmentProvenance: strictToken(record, recordNumber, 'enrichment_provenance'),
  }
}

function targetProjection(review: FinalizedReviewProjection): FinalizedReviewProjection {
  return {
    relevanceLabel: review.relevanceLabel,
    reviewerConfidence: review.reviewerConfidence,
    metadataSufficiency: review.metadataSufficiency,
    topicIds: review.topicIds,
    technologyTags: review.technologyTags,
    technologyTagStatus: review.technologyTagStatus,
    clinicalPurposes: review.clinicalPurposes,
    diseaseTags: review.diseaseTags,
    diseaseTagStatus: review.diseaseTagStatus,
    studyDesign: review.studyDesign,
    publicationStatus: review.publicationStatus,
    categorizationFromFullText: review.categorizationFromFullText,
    notes: review.notes,
    usedSupplementalMetadata: review.usedSupplementalMetadata,
    isBlinded: review.isBlinded,
    taxonomyVersion: review.taxonomyVersion,
    labelSchemaVersion: review.labelSchemaVersion,
    enrichmentSchemaVersion: review.enrichmentSchemaVersion,
    enrichmentProvenance: review.enrichmentProvenance,
  }
}

function actionProjection(action: ImportAction): FinalizedReviewProjection {
  if (action.action !== 'import_noop') {
    return targetProjection(goldReviewPayloadSchema.parse(action.review))
  }
  if (!action.candidateReview) {
    throw new Error('Import no-op action is missing its checksum-bound candidateReview.')
  }
  return targetProjection(goldReviewClinicalProjectionSchema.parse(action.candidateReview))
}

function assertProjectionMatches(
  actual: FinalizedReviewProjection,
  expected: FinalizedReviewProjection,
  recordNumber: number,
) {
  for (const key of Object.keys(PROJECTION_COLUMNS) as Array<keyof FinalizedReviewProjection>) {
    if (canonicalJson(actual[key]) !== canonicalJson(expected[key])) {
      return recordError(
        recordNumber,
        PROJECTION_COLUMNS[key],
        'does not match the checksum-bound import plan action.',
      )
    }
  }
}

function parseArtifactRecords(csvText: string): ArtifactRecord[] {
  const withoutBom = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText
  const parsed = parseCsvRows(withoutBom)
  const header = parsed[0]
  if (!header || header.length === 0) throw new Error('Finalized V3 CSV is empty.')
  if (header.some((column) => !column)) throw new Error('Finalized V3 CSV has a blank header.')
  if (new Set(header).size !== header.length) {
    throw new Error('Finalized V3 CSV contains duplicate headers.')
  }
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column))
  if (missing.length > 0) {
    throw new Error(`Finalized V3 CSV is missing required headers: ${missing.join(', ')}.`)
  }
  const indexes = Object.fromEntries(
    REQUIRED_COLUMNS.map((column) => [column, header.indexOf(column)]),
  ) as Record<RequiredColumn, number>
  const records: ArtifactRecord[] = []
  for (const [index, values] of parsed.slice(1).entries()) {
    const recordNumber = index + 2
    if (values.length !== header.length) {
      throw new Error(`Finalized V3 CSV record ${recordNumber} has the wrong column count.`)
    }
    // Fail before touching identity cells when a non-development row is encountered.
    if (values[indexes.dataset_split] !== 'development') {
      return recordError(recordNumber, 'dataset_split', 'must be development.')
    }
    records.push(
      Object.fromEntries(
        REQUIRED_COLUMNS.map((column) => [column, values[indexes[column]]]),
      ) as ArtifactRecord,
    )
  }
  if (records.length === 0) throw new Error('Finalized V3 CSV has no development rows.')
  return records
}

export function validateGoldImportSourceArtifact(
  input: ValidateGoldImportArtifactInput,
): GoldImportArtifactValidationSummary {
  const { plan, csvText } = input
  const sha256 = artifactSha256(csvText)
  if (sha256 !== plan.sourceArtifactSha256) {
    throw new Error(
      `Finalized V3 CSV checksum mismatch: expected ${plan.sourceArtifactSha256}, got ${sha256}.`,
    )
  }
  if (
    plan.kind !== 'import' ||
    plan.scope.datasetSplit !== 'development' ||
    plan.scope.heldOutIdentitiesAccessed !== false ||
    plan.actions.some((action) => action.datasetSplit !== 'development')
  ) {
    throw new Error('Import plan and actions must be development-only.')
  }

  const records = parseArtifactRecords(csvText)
  const itemIds = records.map((record) => record.gold_set_item_id)
  const masterRowIds = records.map((record) => record.master_row_id)
  const pmids = records.map((record) => record.pmid)
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error('Finalized V3 CSV contains duplicate gold-set item rows.')
  }
  if (new Set(pmids).size !== pmids.length) {
    throw new Error('Finalized V3 CSV contains duplicate PMID rows.')
  }
  if (new Set(masterRowIds).size !== masterRowIds.length) {
    throw new Error('Finalized V3 CSV contains duplicate master-row identities.')
  }
  records.forEach((record, index) => {
    if (!UUID_PATTERN.test(record.gold_set_item_id)) {
      return recordError(index + 2, 'gold_set_item_id', 'must be a UUID.')
    }
    if (!PMID_PATTERN.test(record.pmid)) {
      return recordError(index + 2, 'pmid', 'must contain 1-12 decimal digits.')
    }
    if (!MASTER_ROW_ID_PATTERN.test(record.master_row_id)) {
      return recordError(index + 2, 'master_row_id', 'must be a positive decimal integer.')
    }
  })

  const compatibilityResolutions = new Map(
    (input.compatibility?.optionalTagStatusResolutions ?? []).map((resolution) => [
      resolution.itemId,
      resolution,
    ]),
  )
  if (
    compatibilityResolutions.size !==
    (input.compatibility?.optionalTagStatusResolutions.length ?? 0)
  ) {
    throw new Error('Compatibility status resolutions contain duplicate item identities.')
  }

  const planItemIds = plan.actions.map((action) => action.itemId)
  const planPmids = plan.actions.map((action) => action.pmid)
  if (
    new Set(planItemIds).size !== planItemIds.length ||
    new Set(planPmids).size !== planPmids.length
  ) {
    throw new Error('Import plan actions must contain unique item and PMID identities.')
  }
  if (records.length !== plan.actions.length) {
    throw new Error('Finalized V3 CSV does not provide exact one-to-one action coverage.')
  }

  const recordsByItemId = new Map(
    records.map((record, index) => [record.gold_set_item_id, { record, recordNumber: index + 2 }]),
  )
  for (const action of plan.actions) {
    const matched = recordsByItemId.get(action.itemId)
    if (!matched || matched.record.pmid !== action.pmid) {
      throw new Error('Finalized V3 CSV identity coverage does not match the import plan.')
    }
    assertProjectionMatches(
      finalizedProjection(
        matched.record,
        matched.recordNumber,
        compatibilityResolutions.get(action.itemId),
      ),
      actionProjection(action),
      matched.recordNumber,
    )
  }
  for (const resolution of compatibilityResolutions.values()) {
    const record = recordsByItemId.get(resolution.itemId)?.record
    if (!record || record.pmid !== resolution.pmid) {
      throw new Error(
        'Compatibility status resolution identity is absent from the source artifact.',
      )
    }
  }

  const insertActionCount = plan.actions.filter((action) => action.action !== 'import_noop').length
  return {
    artifactSha256: sha256,
    contractVersion: plan.contractVersion,
    datasetSplit: 'development',
    insertActionCount,
    kind: 'gold_import_source_artifact_validation',
    noopActionCount: plan.actions.length - insertActionCount,
    planSha256: plan.binding.contentSha256,
    rowCount: records.length,
    valid: true,
  }
}
