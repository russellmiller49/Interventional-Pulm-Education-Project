import { createHash } from 'node:crypto'
import { TextDecoder } from 'node:util'

import { z } from 'zod'

import { parseCsvRows } from '../../src/features/literature/gold-set/export'
import { parseFinalizedArtifactBooleanValue } from '../../src/features/literature/gold-set/import-artifact-validation'
import {
  canonicalJson,
  goldReviewClinicalProjection,
  goldReviewClinicalProjectionSchema,
  goldReviewPayloadSchema,
  sha256Canonical,
  type GoldReviewPayload,
  type ImportPlan,
} from '../../src/features/literature/gold-set/import-compensation'

export const GOLD_IMPORT_COMPATIBILITY_SCHEMA_VERSION =
  'gold-import-compensation-compatibility/1.0.0' as const
export const GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION =
  'finalized-v3-exact-boolean-lexeme/1.0.0' as const
export const GOLD_IMPORT_EXISTING_HEAD_COHORT_SCHEMA_VERSION =
  'gold-import-compensation-existing-head-cohort/1.0.0' as const
export const GOLD_IMPORT_COMPATIBILITY_SUPPLEMENT_SCHEMA_VERSION =
  'gold-import-compensation-compatibility-supplement/1.0.0' as const
export const GOLD_IMPORT_COMPENSATION_MIGRATION_ID =
  '20260808035633_add_literature_gold_import_compensation_contract' as const
export const GOLD_IMPORT_INITIAL_REVIEW_TIMESTAMP = '2026-08-08T00:00:00.000Z' as const

export const GOLD_IMPORT_EXISTING_HEAD_IDENTITIES = Object.freeze([
  { masterRowId: '1', pmid: '30416813' },
  { masterRowId: '2', pmid: '32250874' },
  { masterRowId: '3', pmid: '16002921' },
  { masterRowId: '4', pmid: '36879724' },
  { masterRowId: '5', pmid: '18617289' },
  { masterRowId: '6', pmid: '35079742' },
  { masterRowId: '7', pmid: '15133344' },
  { masterRowId: '8', pmid: '28610675' },
  { masterRowId: '9', pmid: '39281191' },
] as const)

export const GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES = Object.freeze([
  { masterRowId: '2', pmid: '32250874' },
  { masterRowId: '3', pmid: '16002921' },
  { masterRowId: '7', pmid: '15133344' },
  { masterRowId: '8', pmid: '28610675' },
] as const)

export const GOLD_IMPORT_COMPATIBILITY_MUTABLE_FIELDS = [
  'technologyTagStatus',
  'diseaseTagStatus',
] as const

export const GOLD_IMPORT_COMPATIBILITY_RESOLUTION_CLASSES = [
  'deterministic_lexical_normalization',
  'deterministic_schema_compatibility_mapping',
  'physician_authorized_compatibility_decision',
] as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]*$/u
const PMID_PATTERN = /^[0-9]{1,12}$/u

const sha256Schema = z.string().regex(SHA256_PATTERN)
const uuidSchema = z.string().regex(UUID_PATTERN)
const positiveDecimalSchema = z.string().regex(POSITIVE_DECIMAL_PATTERN)
const pmidSchema = z.string().regex(PMID_PATTERN)
const timestampSchema = z.string().datetime({ offset: true })
const optionalTagStatusSchema = z.enum(['tagged', 'not_applicable', 'not_assessable'])
export const physicianReviewCohortSchema = z.enum([
  'physician_confirmed',
  'physician_modified',
  'qc_accepted',
])
const enrichmentProvenanceSchema = z.enum([
  'physician_confirmed_ai_enrichment',
  'physician_modified_ai_enrichment',
  'ai_generated_enrichment_qc_accepted',
])

const sourceIdentitySchema = z
  .object({
    datasetSplit: z.literal('development'),
    itemId: uuidSchema,
    masterRowId: positiveDecimalSchema,
    pmid: pmidSchema,
  })
  .strict()

export type GoldImportCompatibilitySourceIdentity = z.infer<typeof sourceIdentitySchema>

const booleanColumnSchema = z.enum([
  'categorization_from_full_text',
  'full_text_used',
  'is_blinded',
])

export const finalizedArtifactBooleanNormalizationSchema = z
  .object({
    canonicalLexeme: z.enum(['true', 'false']),
    classification: z.literal('deterministic_lexical_normalization'),
    column: booleanColumnSchema,
    normalizationRuleVersion: z.literal(GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION),
    originalLexeme: z.enum(['true', 'false', 'True', 'False']),
    semanticValue: z.boolean(),
    sourceArtifactSha256: sha256Schema,
    sourceForm: z.enum(['canonical', 'legacy_title_case']),
    sourceIdentity: sourceIdentitySchema,
  })
  .strict()

export type FinalizedArtifactBooleanNormalization = z.infer<
  typeof finalizedArtifactBooleanNormalizationSchema
>

/**
 * Parse the only four boolean spellings present in the finalized V3 contract.
 * The returned record is an audit ledger entry; it never rewrites source bytes.
 */
export function parseFinalizedArtifactBooleanLexeme(input: {
  column: z.input<typeof booleanColumnSchema>
  lexeme: unknown
  sourceArtifactSha256: string
  sourceIdentity: GoldImportCompatibilitySourceIdentity
}): FinalizedArtifactBooleanNormalization {
  const parsedInput = z
    .object({
      column: booleanColumnSchema,
      lexeme: z.string(),
      sourceArtifactSha256: sha256Schema,
      sourceIdentity: sourceIdentitySchema,
    })
    .strict()
    .parse(input)
  let semanticValue: boolean
  try {
    semanticValue = parseFinalizedArtifactBooleanValue(parsedInput.lexeme)
  } catch {
    throw new Error(
      `Finalized V3 artifact column ${parsedInput.column} must use exactly true, false, True, or False.`,
    )
  }
  return finalizedArtifactBooleanNormalizationSchema.parse({
    canonicalLexeme: semanticValue ? 'true' : 'false',
    classification: 'deterministic_lexical_normalization',
    column: parsedInput.column,
    normalizationRuleVersion: GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION,
    originalLexeme: parsedInput.lexeme,
    semanticValue,
    sourceArtifactSha256: parsedInput.sourceArtifactSha256,
    sourceForm:
      parsedInput.lexeme === 'True' || parsedInput.lexeme === 'False'
        ? 'legacy_title_case'
        : 'canonical',
    sourceIdentity: parsedInput.sourceIdentity,
  })
}

export const FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS = [
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

export type FinalizedGoldImportArtifactColumn =
  (typeof FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS)[number]
type FinalizedGoldImportRawRecord = Record<FinalizedGoldImportArtifactColumn, string>

export interface FinalizedGoldImportArtifactProjection {
  categorizationFromFullText: boolean
  clinicalPurposes: string[]
  diseaseTagStatus: z.infer<typeof optionalTagStatusSchema> | null
  diseaseTags: string[]
  enrichmentProvenance: z.infer<typeof enrichmentProvenanceSchema>
  enrichmentSchemaVersion: string
  isBlinded: boolean
  labelSchemaVersion: string
  metadataSufficiency: string
  notes: string
  publicationStatus: string | null
  relevanceLabel: string
  reviewerConfidence: string
  studyDesign: string | null
  taxonomyVersion: string
  technologyTagStatus: z.infer<typeof optionalTagStatusSchema> | null
  technologyTags: string[]
  topicIds: string[]
  usedSupplementalMetadata: boolean
}

export interface FinalizedGoldImportArtifactRecord {
  booleanNormalizations: readonly FinalizedArtifactBooleanNormalization[]
  csvRecordNumber: number
  identity: GoldImportCompatibilitySourceIdentity
  physicianReviewCohort: z.infer<typeof physicianReviewCohortSchema>
  projection: FinalizedGoldImportArtifactProjection
  raw: Readonly<FinalizedGoldImportRawRecord>
}

export interface ParsedFinalizedGoldImportArtifact {
  artifactSha256: string
  booleanNormalizations: readonly FinalizedArtifactBooleanNormalization[]
  header: readonly string[]
  rows: readonly FinalizedGoldImportArtifactRecord[]
}

const artifactProjectionWithoutOptionalStatusesSchema = goldReviewClinicalProjectionSchema.omit({
  diseaseTagStatus: true,
  technologyTagStatus: true,
})

function validateArtifactProjectionExceptOptionalStatuses(
  projection: FinalizedGoldImportArtifactProjection,
): void {
  const { diseaseTagStatus, technologyTagStatus, ...withoutStatuses } = projection
  artifactProjectionWithoutOptionalStatusesSchema.parse({
    ...withoutStatuses,
    reviewSeconds: 0,
  })
  for (const [values, status, field] of [
    [projection.technologyTags, technologyTagStatus, 'technology_tag_status'],
    [projection.diseaseTags, diseaseTagStatus, 'disease_tag_status'],
  ] as const) {
    if (
      (values.length > 0 && status !== 'tagged') ||
      (values.length === 0 && status === 'tagged')
    ) {
      throw new Error(`Finalized V3 artifact ${field} does not match its taxonomy array.`)
    }
  }
  const included = ['include_core', 'include_adjacent'].includes(projection.relevanceLabel)
  const categorized =
    projection.topicIds.length > 0 ||
    projection.technologyTags.length > 0 ||
    projection.clinicalPurposes.length > 0 ||
    projection.diseaseTags.length > 0 ||
    projection.studyDesign !== null ||
    projection.publicationStatus !== null
  if (
    included &&
    (!projection.topicIds.length ||
      !projection.clinicalPurposes.length ||
      projection.studyDesign === null ||
      projection.publicationStatus === null)
  ) {
    throw new Error('Finalized V3 included row is missing required categorization.')
  }
  if (!included && (categorized || projection.categorizationFromFullText)) {
    throw new Error('Finalized V3 excluded or uncertain row carries categorization.')
  }
}

function artifactBytes(input: Uint8Array | string): Buffer {
  return typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
}

function sha256Bytes(input: Uint8Array): string {
  return createHash('sha256').update(input).digest('hex')
}

function requireArtifactList(value: string, recordNumber: number, column: string): string[] {
  if (value === '') return []
  const entries = value.split('|')
  if (
    entries.some((entry) => entry === '' || entry.trim() !== entry) ||
    new Set(entries).size !== entries.length
  ) {
    throw new Error(
      `Finalized V3 artifact CSV record ${recordNumber}, column ${column}, has a noncanonical list.`,
    )
  }
  return entries
}

function requireNonblankArtifactValue(value: string, recordNumber: number, column: string): string {
  if (value === '' || value.trim() !== value) {
    throw new Error(
      `Finalized V3 artifact CSV record ${recordNumber}, column ${column}, must be nonblank canonical text.`,
    )
  }
  return value
}

function provenanceCohort(
  provenance: z.infer<typeof enrichmentProvenanceSchema>,
): z.infer<typeof physicianReviewCohortSchema> {
  if (provenance === 'physician_confirmed_ai_enrichment') return 'physician_confirmed'
  if (provenance === 'physician_modified_ai_enrichment') return 'physician_modified'
  return 'qc_accepted'
}

/** Parse the finalized CSV in memory and retain its raw SHA and every source lexeme. */
export function parseFinalizedGoldImportArtifact(
  input: Uint8Array | string,
  options: { expectedArtifactSha256?: string } = {},
): ParsedFinalizedGoldImportArtifact {
  const bytes = artifactBytes(input)
  const artifactSha256 = sha256Bytes(bytes)
  if (
    options.expectedArtifactSha256 !== undefined &&
    sha256Schema.parse(options.expectedArtifactSha256) !== artifactSha256
  ) {
    throw new Error('Finalized V3 artifact SHA-256 does not match the expected source binding.')
  }
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const parsed = parseCsvRows(decoded.startsWith('\uFEFF') ? decoded.slice(1) : decoded)
  const header = parsed[0]
  if (!header || header.length === 0 || new Set(header).size !== header.length) {
    throw new Error('Finalized V3 artifact has a missing or duplicate CSV header.')
  }
  const missing = FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS.filter(
    (column) => !header.includes(column),
  )
  if (missing.length > 0) {
    throw new Error(`Finalized V3 artifact is missing columns: ${missing.join(', ')}.`)
  }
  const indexes = Object.fromEntries(
    FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS.map((column) => [column, header.indexOf(column)]),
  ) as Record<FinalizedGoldImportArtifactColumn, number>
  const itemIds = new Set<string>()
  const masterRowIds = new Set<string>()
  const pmids = new Set<string>()
  const normalizations: FinalizedArtifactBooleanNormalization[] = []
  const rows = parsed.slice(1).map((values, index): FinalizedGoldImportArtifactRecord => {
    const csvRecordNumber = index + 2
    if (values.length !== header.length) {
      throw new Error(
        `Finalized V3 artifact CSV record ${csvRecordNumber} has the wrong column count.`,
      )
    }
    const raw = Object.fromEntries(
      FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS.map((column) => [column, values[indexes[column]]]),
    ) as FinalizedGoldImportRawRecord
    const identity = sourceIdentitySchema.parse({
      datasetSplit: raw.dataset_split,
      itemId: raw.gold_set_item_id,
      masterRowId: raw.master_row_id,
      pmid: raw.pmid,
    })
    if (
      itemIds.has(identity.itemId) ||
      masterRowIds.has(identity.masterRowId) ||
      pmids.has(identity.pmid)
    ) {
      throw new Error(
        `Finalized V3 artifact contains a duplicate identity at CSV record ${csvRecordNumber}.`,
      )
    }
    itemIds.add(identity.itemId)
    masterRowIds.add(identity.masterRowId)
    pmids.add(identity.pmid)
    const rowNormalizations = (
      [
        ['categorization_from_full_text', raw.categorization_from_full_text],
        ['full_text_used', raw.full_text_used],
        ['is_blinded', raw.is_blinded],
      ] as const
    ).map(([column, lexeme]) =>
      parseFinalizedArtifactBooleanLexeme({
        column,
        lexeme,
        sourceArtifactSha256: artifactSha256,
        sourceIdentity: identity,
      }),
    )
    normalizations.push(...rowNormalizations)
    const technologyTagStatus =
      raw.technology_tag_status === ''
        ? null
        : optionalTagStatusSchema.parse(raw.technology_tag_status)
    const diseaseTagStatus =
      raw.disease_tag_status === '' ? null : optionalTagStatusSchema.parse(raw.disease_tag_status)
    const enrichmentProvenance = enrichmentProvenanceSchema.parse(
      requireNonblankArtifactValue(
        raw.enrichment_provenance,
        csvRecordNumber,
        'enrichment_provenance',
      ),
    )
    const projection: FinalizedGoldImportArtifactProjection = {
      categorizationFromFullText: rowNormalizations[0].semanticValue,
      clinicalPurposes: requireArtifactList(
        raw.clinical_purposes,
        csvRecordNumber,
        'clinical_purposes',
      ),
      diseaseTagStatus,
      diseaseTags: requireArtifactList(raw.disease_tags, csvRecordNumber, 'disease_tags'),
      enrichmentProvenance,
      enrichmentSchemaVersion: requireNonblankArtifactValue(
        raw.enrichment_schema_version,
        csvRecordNumber,
        'enrichment_schema_version',
      ),
      isBlinded: rowNormalizations[2].semanticValue,
      labelSchemaVersion: requireNonblankArtifactValue(
        raw.label_schema_version,
        csvRecordNumber,
        'label_schema_version',
      ),
      metadataSufficiency: requireNonblankArtifactValue(
        raw.metadata_sufficiency,
        csvRecordNumber,
        'metadata_sufficiency',
      ),
      notes: raw.physician_notes,
      publicationStatus: raw.publication_status || null,
      relevanceLabel: requireNonblankArtifactValue(
        raw.physician_final_label,
        csvRecordNumber,
        'physician_final_label',
      ),
      reviewerConfidence: requireNonblankArtifactValue(
        raw.physician_final_confidence,
        csvRecordNumber,
        'physician_final_confidence',
      ),
      studyDesign: raw.study_design || null,
      taxonomyVersion: requireNonblankArtifactValue(
        raw.taxonomy_version,
        csvRecordNumber,
        'taxonomy_version',
      ),
      technologyTagStatus,
      technologyTags: requireArtifactList(raw.technology_tags, csvRecordNumber, 'technology_tags'),
      topicIds: requireArtifactList(raw.topic_ids, csvRecordNumber, 'topic_ids'),
      usedSupplementalMetadata: rowNormalizations[1].semanticValue,
    }
    validateArtifactProjectionExceptOptionalStatuses(projection)
    return {
      booleanNormalizations: rowNormalizations,
      csvRecordNumber,
      identity,
      physicianReviewCohort: provenanceCohort(enrichmentProvenance),
      projection,
      raw,
    }
  })
  if (rows.length === 0) throw new Error('Finalized V3 artifact contains no development rows.')
  return { artifactSha256, booleanNormalizations: normalizations, header, rows }
}

const preImportItemStateSchema = z
  .object({
    automatedSignalsRevealedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
    reviewStatus: z.enum(['pending', 'in_progress', 'return_later', 'completed']),
    startedAt: timestampSchema.nullable(),
    supplementalMetadataRevealedAt: timestampSchema.nullable(),
  })
  .strict()

export const compatibilityHistoricalEffectiveReviewSchema = z
  .object({
    ...goldReviewClinicalProjectionSchema.shape,
    completedAt: timestampSchema,
    createdAt: timestampSchema,
    diseaseTagStatus: optionalTagStatusSchema.nullable(),
    enrichmentProvenance: enrichmentProvenanceSchema.nullable(),
    enrichmentSchemaVersion: z.string().trim().min(1).nullable(),
    labelSchemaVersion: z.string().trim().min(1).nullable(),
    reviewerEmail: z.string().trim().min(1).max(320).nullable(),
    reviewerUserId: uuidSchema.nullable(),
    startedAt: timestampSchema,
    taxonomyVersion: z.string().trim().min(1).nullable(),
    technologyTagStatus: optionalTagStatusSchema.nullable(),
  })
  .strict()
  .superRefine((review, context) => {
    if (Date.parse(review.completedAt) < Date.parse(review.startedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Historical completedAt cannot precede startedAt.',
      })
    }
  })

export const compatibilityDevelopmentPlanningStateSchema = z
  .object({
    datasetSplit: z.literal('development'),
    rows: z.array(
      z
        .object({
          currentEffectiveReview: compatibilityHistoricalEffectiveReviewSchema.nullable(),
          currentReviewId: uuidSchema.nullable(),
          currentRevision: z.number().int().positive().nullable(),
          datasetSplit: z.literal('development'),
          displayOrder: z.number().int().nonnegative(),
          effectiveReviewId: uuidSchema.nullable(),
          itemId: uuidSchema,
          itemState: preImportItemStateSchema,
          pmid: pmidSchema,
          sequence: z.number().int().positive(),
        })
        .strict(),
    ),
    schemaVersion: z.literal('gold-import-compensation-development-planning-state/1.0.0'),
  })
  .strict()

export type CompatibilityDevelopmentPlanningState = z.infer<
  typeof compatibilityDevelopmentPlanningStateSchema
>
type CompatibilityPlanningStateRow = CompatibilityDevelopmentPlanningState['rows'][number]
type CompatibilityHistoricalReview = z.infer<typeof compatibilityHistoricalEffectiveReviewSchema>

export const compatibilityAuditBindingContextSchema = z
  .object({
    contract: z
      .object({
        environmentInvariantIdentitySha256: sha256Schema,
        environmentProfileIdentitySha256: sha256Schema,
      })
      .strict(),
    currentDatabase: z
      .object({
        batchId: uuidSchema,
        developmentMembershipSha256: sha256Schema,
        developmentPlanningStateSha256: sha256Schema,
        effectiveStateSha256: sha256Schema,
        physicalStateSha256: sha256Schema,
      })
      .strict(),
    finalV3ArtifactSha256: sha256Schema,
    migration: z
      .object({
        id: z.literal(GOLD_IMPORT_COMPENSATION_MIGRATION_ID),
        sha256: sha256Schema,
      })
      .strict(),
  })
  .strict()

export type CompatibilityAuditBindingContext = z.infer<
  typeof compatibilityAuditBindingContextSchema
>

const supplementBindingsSchema = compatibilityAuditBindingContextSchema
  .extend({ existingHeadCohortSha256: sha256Schema })
  .strict()

const supplementScopeSchema = z
  .object({
    datasetSplit: z.literal('development'),
    heldOutIdentitiesAccessed: z.literal(false),
    purpose: z.literal('import_contract_compatibility_only'),
    remoteWritesAllowed: z.literal(false),
    targetDatabase: z.literal('local'),
  })
  .strict()

const supplementDecisionFieldTemplateSchema = z
  .object({
    allowedValues: z.tuple([z.literal('not_applicable'), z.literal('not_assessable')]),
    currentValue: z.null(),
    physicianFinalValue: z.null(),
    proposedValue: z.null(),
    sourceValue: z.literal(''),
  })
  .strict()

const supplementDecisionFieldCompletedSchema = supplementDecisionFieldTemplateSchema
  .omit({ physicianFinalValue: true })
  .extend({ physicianFinalValue: z.enum(['not_applicable', 'not_assessable']) })
  .strict()

const supplementFixedFields = {
  categorizationFromFullText: z.literal(false),
  clinicalPurposes: z.tuple([]),
  diseaseTags: z.tuple([]),
  enrichmentProvenance: enrichmentProvenanceSchema,
  itemId: uuidSchema,
  masterRowId: positiveDecimalSchema,
  pmid: pmidSchema,
  publicationStatus: z.null(),
  relevanceLabel: z.literal('exclude'),
  reviewerConfidence: z.enum(['high', 'moderate', 'low']),
  studyDesign: z.null(),
  technologyTags: z.tuple([]),
  topicIds: z.tuple([]),
}

export const compatibilitySupplementTemplateRowSchema = z
  .object({
    ...supplementFixedFields,
    completionStatus: z.literal('pending'),
    diseaseTagStatus: supplementDecisionFieldTemplateSchema,
    physicianRationale: z.literal(''),
    reviewed: z.literal(false),
    technologyTagStatus: supplementDecisionFieldTemplateSchema,
  })
  .strict()

export const compatibilitySupplementCompletedRowSchema = z
  .object({
    ...supplementFixedFields,
    completionStatus: z.literal('completed'),
    diseaseTagStatus: supplementDecisionFieldCompletedSchema,
    physicianRationale: z.string().trim().min(1).max(2000),
    reviewed: z.literal(true),
    technologyTagStatus: supplementDecisionFieldCompletedSchema,
  })
  .strict()

const supplementAuthorizationSchema = z
  .object({
    authorizationId: uuidSchema,
    authorizationKind: z.literal('physician_compatibility_decision'),
    authorizationNote: z.string().trim().min(5).max(2000),
    authorized: z.literal(true),
    authorizedAt: timestampSchema,
    authorizedBy: z.string().trim().min(1).max(320),
    authorizedRole: z.literal('physician'),
  })
  .strict()

const supplementCommon = {
  allowedMutableFields: z.tuple([z.literal('technologyTagStatus'), z.literal('diseaseTagStatus')]),
  bindings: supplementBindingsSchema,
  kind: z.literal('physician_compatibility_supplement'),
  resolutionClasses: z.tuple([
    z.literal('deterministic_lexical_normalization'),
    z.literal('deterministic_schema_compatibility_mapping'),
    z.literal('physician_authorized_compatibility_decision'),
  ]),
  schemaVersion: z.literal(GOLD_IMPORT_COMPATIBILITY_SUPPLEMENT_SCHEMA_VERSION),
  scope: supplementScopeSchema,
}

const compatibilitySupplementTemplateContentSchema = z
  .object({
    ...supplementCommon,
    authorization: z.null(),
    documentState: z.literal('template'),
    rows: z.array(compatibilitySupplementTemplateRowSchema).length(4),
  })
  .strict()

export const compatibilitySupplementCompletedContentSchema = z
  .object({
    ...supplementCommon,
    authorization: supplementAuthorizationSchema,
    documentState: z.literal('completed'),
    rows: z.array(compatibilitySupplementCompletedRowSchema).length(4),
    sourceTemplateSha256: sha256Schema,
  })
  .strict()

const supplementBindingSchema = z
  .object({
    canonicalization: z.literal('recursive_sorted_key_json_v1'),
    contentSha256: sha256Schema,
  })
  .strict()

export const boundCompatibilitySupplementTemplateSchema =
  compatibilitySupplementTemplateContentSchema.extend({ binding: supplementBindingSchema }).strict()

export const boundCompatibilitySupplementCompletedSchema =
  compatibilitySupplementCompletedContentSchema
    .extend({ binding: supplementBindingSchema })
    .strict()

export type BoundCompatibilitySupplementTemplate = z.infer<
  typeof boundCompatibilitySupplementTemplateSchema
>
export type BoundCompatibilitySupplementCompleted = z.infer<
  typeof boundCompatibilitySupplementCompletedSchema
>
export type CompatibilitySupplementCompletedContent = z.infer<
  typeof compatibilitySupplementCompletedContentSchema
>

function bindSupplementContent<T extends Record<string, unknown>>(content: T) {
  return {
    ...content,
    binding: {
      canonicalization: 'recursive_sorted_key_json_v1' as const,
      contentSha256: sha256Canonical(content),
    },
  }
}

function verifySupplementBinding(value: {
  binding: { contentSha256: string }
  [key: string]: unknown
}): void {
  const { binding, ...content } = value
  if (binding.contentSha256 !== sha256Canonical(content)) {
    throw new Error('Compatibility supplement canonical checksum does not match its content.')
  }
}

/** Strictly parse and checksum-bind a completed physician supplement. */
export function bindCompletedCompatibilitySupplement(
  input: unknown,
): BoundCompatibilitySupplementCompleted {
  const content = compatibilitySupplementCompletedContentSchema.parse(input)
  return boundCompatibilitySupplementCompletedSchema.parse(bindSupplementContent(content))
}

function decisionIdentityKey(identity: { masterRowId: string; pmid: string }): string {
  return `${identity.masterRowId}:${identity.pmid}`
}

function compareMasterRows(left: { masterRowId: string }, right: { masterRowId: string }): number {
  const leftId = BigInt(left.masterRowId)
  const rightId = BigInt(right.masterRowId)
  if (leftId < rightId) return -1
  if (leftId > rightId) return 1
  return 0
}

function exactIdentitySet(
  actual: readonly { masterRowId: string; pmid: string }[],
  expected: readonly { masterRowId: string; pmid: string }[],
): boolean {
  const identityProjection = (rows: readonly { masterRowId: string; pmid: string }[]) =>
    rows.map(({ masterRowId, pmid }) => ({ masterRowId, pmid })).sort(compareMasterRows)
  return canonicalJson(identityProjection(actual)) === canonicalJson(identityProjection(expected))
}

function immutableSupplementRow(row: {
  categorizationFromFullText: false
  clinicalPurposes: readonly []
  diseaseTags: readonly []
  enrichmentProvenance: string
  itemId: string
  masterRowId: string
  pmid: string
  publicationStatus: null
  relevanceLabel: 'exclude'
  reviewerConfidence: string
  studyDesign: null
  technologyTags: readonly []
  topicIds: readonly []
}) {
  return {
    categorizationFromFullText: row.categorizationFromFullText,
    clinicalPurposes: row.clinicalPurposes,
    diseaseTags: row.diseaseTags,
    enrichmentProvenance: row.enrichmentProvenance,
    itemId: row.itemId,
    masterRowId: row.masterRowId,
    pmid: row.pmid,
    publicationStatus: row.publicationStatus,
    relevanceLabel: row.relevanceLabel,
    reviewerConfidence: row.reviewerConfidence,
    studyDesign: row.studyDesign,
    technologyTags: row.technologyTags,
    topicIds: row.topicIds,
  }
}

/**
 * Verify checksum, freshness, immutable physician fields, exact row membership, and template
 * ancestry. A self-consistent but stale/rebound supplement is rejected against the template.
 */
export function validateCompletedCompatibilitySupplement(
  input: unknown,
  expectedTemplateInput: unknown,
): BoundCompatibilitySupplementCompleted {
  const template = boundCompatibilitySupplementTemplateSchema.parse(expectedTemplateInput)
  verifySupplementBinding(template)
  const completed = boundCompatibilitySupplementCompletedSchema.parse(input)
  verifySupplementBinding(completed)
  if (completed.sourceTemplateSha256 !== template.binding.contentSha256) {
    throw new Error('Compatibility supplement is stale or does not descend from this template.')
  }
  for (const key of [
    'allowedMutableFields',
    'bindings',
    'kind',
    'resolutionClasses',
    'schemaVersion',
    'scope',
  ] as const) {
    if (canonicalJson(completed[key]) !== canonicalJson(template[key])) {
      throw new Error(`Compatibility supplement ${key} does not match the current template.`)
    }
  }
  if (
    !exactIdentitySet(completed.rows, GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES) ||
    !exactIdentitySet(template.rows, GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES)
  ) {
    throw new Error('Compatibility supplement must contain the exact four decision rows.')
  }
  template.rows.forEach((templateRow, index) => {
    const completedRow = completed.rows[index]
    if (
      !completedRow ||
      canonicalJson(immutableSupplementRow(completedRow)) !==
        canonicalJson(immutableSupplementRow(templateRow)) ||
      canonicalJson({
        allowedValues: completedRow.technologyTagStatus.allowedValues,
        currentValue: completedRow.technologyTagStatus.currentValue,
        proposedValue: completedRow.technologyTagStatus.proposedValue,
        sourceValue: completedRow.technologyTagStatus.sourceValue,
      }) !==
        canonicalJson({
          allowedValues: templateRow.technologyTagStatus.allowedValues,
          currentValue: templateRow.technologyTagStatus.currentValue,
          proposedValue: templateRow.technologyTagStatus.proposedValue,
          sourceValue: templateRow.technologyTagStatus.sourceValue,
        }) ||
      canonicalJson({
        allowedValues: completedRow.diseaseTagStatus.allowedValues,
        currentValue: completedRow.diseaseTagStatus.currentValue,
        proposedValue: completedRow.diseaseTagStatus.proposedValue,
        sourceValue: completedRow.diseaseTagStatus.sourceValue,
      }) !==
        canonicalJson({
          allowedValues: templateRow.diseaseTagStatus.allowedValues,
          currentValue: templateRow.diseaseTagStatus.currentValue,
          proposedValue: templateRow.diseaseTagStatus.proposedValue,
          sourceValue: templateRow.diseaseTagStatus.sourceValue,
        })
    ) {
      throw new Error('Compatibility supplement changed a fixed physician or source field.')
    }
  })
  return completed
}

export const COMPATIBILITY_PROJECTION_FIELDS = [
  'relevanceLabel',
  'metadataSufficiency',
  'reviewerConfidence',
  'topicIds',
  'technologyTags',
  'technologyTagStatus',
  'clinicalPurposes',
  'diseaseTags',
  'diseaseTagStatus',
  'studyDesign',
  'publicationStatus',
  'categorizationFromFullText',
  'notes',
  'usedSupplementalMetadata',
  'reviewSeconds',
  'taxonomyVersion',
  'labelSchemaVersion',
  'enrichmentSchemaVersion',
  'enrichmentProvenance',
  'isBlinded',
] as const

export type CompatibilityProjectionField = (typeof COMPATIBILITY_PROJECTION_FIELDS)[number]
export type CompatibilityFieldClassification =
  | 'identical'
  | 'deterministic_lexical_normalization'
  | 'deterministic_schema_compatibility_mapping'
  | 'physician_authorized_compatibility_decision'
  | 'physician_decision_required'
  | 'incompatible'

export interface ExistingHeadFieldClassification {
  classification: CompatibilityFieldClassification
  currentValue: unknown
  field: CompatibilityProjectionField
  reason: string
  resolvedValue: unknown
  sourceValue: unknown
}

export interface ExistingHeadCompatibilityRow {
  currentReviewId: string
  currentRevision: number
  effectiveReviewId: string
  fields: readonly ExistingHeadFieldClassification[]
  identity: GoldImportCompatibilitySourceIdentity
  physicianReviewCohort: z.infer<typeof physicianReviewCohortSchema>
  proposedAction: 'import_revision' | 'import_noop' | null
  reason: string
  resolutionStatus: 'resolved' | 'pending_physician_decision' | 'incompatible'
}

export interface CompatibilityPlanningResolutionRow {
  identity: GoldImportCompatibilitySourceIdentity
  proposedAction: 'import_initial' | 'import_revision' | 'import_noop' | null
  reason: string
  resolutionStatus: 'resolved' | 'pending_physician_decision' | 'incompatible'
  sequence: number
  targetReview: GoldReviewPayload | null
}

export interface CompatibilityActionCounts {
  incompatible: number
  initial: number
  inserts: number
  noops: number
  revisions: number
  total: number
  unresolved: number
}

const compatibilityActionCountsSchema = z
  .object({
    incompatible: z.number().int().nonnegative(),
    initial: z.number().int().nonnegative(),
    inserts: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
    revisions: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    unresolved: z.number().int().nonnegative(),
  })
  .strict()

export function deriveCompatibilityActionCounts(
  rows: readonly CompatibilityPlanningResolutionRow[],
): CompatibilityActionCounts {
  const initial = rows.filter((row) => row.proposedAction === 'import_initial').length
  const revisions = rows.filter((row) => row.proposedAction === 'import_revision').length
  const noops = rows.filter((row) => row.proposedAction === 'import_noop').length
  return {
    incompatible: rows.filter((row) => row.resolutionStatus === 'incompatible').length,
    initial,
    inserts: initial + revisions,
    noops,
    revisions,
    total: rows.length,
    unresolved: rows.filter((row) => row.resolutionStatus === 'pending_physician_decision').length,
  }
}

export interface GoldImportCompensationCompatibilityResolution {
  acceptedSupplementSha256: string | null
  actionCounts: CompatibilityActionCounts
  artifact: ParsedFinalizedGoldImportArtifact
  existingHeadCohortSha256: string
  existingHeads: readonly ExistingHeadCompatibilityRow[]
  planningRows: readonly CompatibilityPlanningResolutionRow[]
  readyForPackage: boolean
  schemaVersion: typeof GOLD_IMPORT_COMPATIBILITY_SCHEMA_VERSION
  supplementRequired: boolean
  supplementTemplate: BoundCompatibilitySupplementTemplate | null
}

function historicalProjection(review: CompatibilityHistoricalReview) {
  return {
    categorizationFromFullText: review.categorizationFromFullText,
    clinicalPurposes: [...review.clinicalPurposes].sort(),
    diseaseTagStatus: review.diseaseTagStatus,
    diseaseTags: [...review.diseaseTags].sort(),
    enrichmentProvenance: review.enrichmentProvenance,
    enrichmentSchemaVersion: review.enrichmentSchemaVersion,
    isBlinded: review.isBlinded,
    labelSchemaVersion: review.labelSchemaVersion,
    metadataSufficiency: review.metadataSufficiency,
    notes: review.notes,
    publicationStatus: review.publicationStatus,
    relevanceLabel: review.relevanceLabel,
    reviewerConfidence: review.reviewerConfidence,
    reviewSeconds: review.reviewSeconds,
    studyDesign: review.studyDesign,
    taxonomyVersion: review.taxonomyVersion,
    technologyTagStatus: review.technologyTagStatus,
    technologyTags: [...review.technologyTags].sort(),
    topicIds: [...review.topicIds].sort(),
    usedSupplementalMetadata: review.usedSupplementalMetadata,
  }
}

function cohortProjection(
  row: CompatibilityPlanningStateRow,
  record: FinalizedGoldImportArtifactRecord,
) {
  if (
    row.currentReviewId === null ||
    row.effectiveReviewId === null ||
    row.currentRevision === null ||
    row.currentEffectiveReview === null
  ) {
    throw new Error('Existing-head cohort row is missing its current effective review state.')
  }
  return {
    currentClinicalProjectionSha256: sha256Canonical(
      historicalProjection(row.currentEffectiveReview),
    ),
    currentReviewId: row.currentReviewId,
    currentRevision: row.currentRevision,
    effectiveReviewId: row.effectiveReviewId,
    itemId: row.itemId,
    masterRowId: record.identity.masterRowId,
    pmid: row.pmid,
  }
}

export function existingHeadCohortSha256(
  rows: readonly CompatibilityPlanningStateRow[],
  recordsByItem: ReadonlyMap<string, FinalizedGoldImportArtifactRecord>,
): string {
  const projection = rows
    .map((row) => {
      const record = recordsByItem.get(row.itemId)
      if (!record || record.identity.pmid !== row.pmid) {
        throw new Error('Existing-head cohort does not match finalized artifact identities.')
      }
      return cohortProjection(row, record)
    })
    .sort(compareMasterRows)
  return sha256Canonical({
    datasetSplit: 'development',
    rows: projection,
    schemaVersion: GOLD_IMPORT_EXISTING_HEAD_COHORT_SCHEMA_VERSION,
  })
}

type SupplementDecisionMap = ReadonlyMap<
  string,
  {
    diseaseTagStatus: z.infer<typeof optionalTagStatusSchema>
    technologyTagStatus: z.infer<typeof optionalTagStatusSchema>
  }
>

function resolvedTargetReview(
  record: FinalizedGoldImportArtifactRecord,
  current: CompatibilityHistoricalReview | null,
  decisions: SupplementDecisionMap,
): GoldReviewPayload | null {
  const decision = decisions.get(decisionIdentityKey(record.identity))
  const technologyTagStatus = record.projection.technologyTagStatus ?? decision?.technologyTagStatus
  const diseaseTagStatus = record.projection.diseaseTagStatus ?? decision?.diseaseTagStatus
  if (!technologyTagStatus || !diseaseTagStatus) return null
  const operational = current
    ? {
        completedAt: current.completedAt,
        createdAt: current.createdAt,
        reviewerEmail: current.reviewerEmail,
        reviewerUserId: current.reviewerUserId,
        reviewSeconds: current.reviewSeconds,
        startedAt: current.startedAt,
      }
    : {
        completedAt: GOLD_IMPORT_INITIAL_REVIEW_TIMESTAMP,
        createdAt: GOLD_IMPORT_INITIAL_REVIEW_TIMESTAMP,
        reviewerEmail: null,
        reviewerUserId: null,
        reviewSeconds: 0,
        startedAt: GOLD_IMPORT_INITIAL_REVIEW_TIMESTAMP,
      }
  return goldReviewPayloadSchema.parse({
    ...record.projection,
    ...operational,
    diseaseTagStatus,
    technologyTagStatus,
  })
}

function sourceValueForField(
  record: FinalizedGoldImportArtifactRecord,
  field: CompatibilityProjectionField,
): unknown {
  const map: Record<CompatibilityProjectionField, FinalizedGoldImportArtifactColumn | null> = {
    categorizationFromFullText: 'categorization_from_full_text',
    clinicalPurposes: 'clinical_purposes',
    diseaseTagStatus: 'disease_tag_status',
    diseaseTags: 'disease_tags',
    enrichmentProvenance: 'enrichment_provenance',
    enrichmentSchemaVersion: 'enrichment_schema_version',
    isBlinded: 'is_blinded',
    labelSchemaVersion: 'label_schema_version',
    metadataSufficiency: 'metadata_sufficiency',
    notes: 'physician_notes',
    publicationStatus: 'publication_status',
    relevanceLabel: 'physician_final_label',
    reviewerConfidence: 'physician_final_confidence',
    reviewSeconds: null,
    studyDesign: 'study_design',
    taxonomyVersion: 'taxonomy_version',
    technologyTagStatus: 'technology_tag_status',
    technologyTags: 'technology_tags',
    topicIds: 'topic_ids',
    usedSupplementalMetadata: 'full_text_used',
  }
  const column = map[field]
  return column === null ? null : record.raw[column]
}

const NEW_CONTRACT_FIELDS = new Set<CompatibilityProjectionField>([
  'technologyTagStatus',
  'diseaseTagStatus',
  'taxonomyVersion',
  'labelSchemaVersion',
  'enrichmentSchemaVersion',
  'enrichmentProvenance',
])
const BOOLEAN_FIELDS = new Map<CompatibilityProjectionField, z.infer<typeof booleanColumnSchema>>([
  ['categorizationFromFullText', 'categorization_from_full_text'],
  ['usedSupplementalMetadata', 'full_text_used'],
  ['isBlinded', 'is_blinded'],
])

function fieldClassifications(
  record: FinalizedGoldImportArtifactRecord,
  currentReview: CompatibilityHistoricalReview,
  targetReview: GoldReviewPayload | null,
  decisions: SupplementDecisionMap,
): ExistingHeadFieldClassification[] {
  const current = historicalProjection(currentReview) as Record<
    CompatibilityProjectionField,
    unknown
  >
  const decision = decisions.get(decisionIdentityKey(record.identity))
  const partialTarget: Record<CompatibilityProjectionField, unknown> = {
    ...record.projection,
    clinicalPurposes: [...record.projection.clinicalPurposes].sort(),
    diseaseTagStatus: record.projection.diseaseTagStatus ?? decision?.diseaseTagStatus ?? null,
    diseaseTags: [...record.projection.diseaseTags].sort(),
    reviewSeconds: currentReview.reviewSeconds,
    technologyTagStatus:
      record.projection.technologyTagStatus ?? decision?.technologyTagStatus ?? null,
    technologyTags: [...record.projection.technologyTags].sort(),
    topicIds: [...record.projection.topicIds].sort(),
  }
  const resolvedTarget = targetReview
    ? (goldReviewClinicalProjection(targetReview) as Record<CompatibilityProjectionField, unknown>)
    : partialTarget
  return COMPATIBILITY_PROJECTION_FIELDS.map((field) => {
    const currentValue = current[field]
    const resolvedValue = resolvedTarget[field]
    const sourceValue = sourceValueForField(record, field)
    const rawStatusBlank =
      (field === 'technologyTagStatus' && record.raw.technology_tag_status === '') ||
      (field === 'diseaseTagStatus' && record.raw.disease_tag_status === '')
    if (rawStatusBlank) {
      if (resolvedValue === null) {
        return {
          classification: 'physician_decision_required' as const,
          currentValue,
          field,
          reason:
            'The finalized excluded-row status is blank and both allowed empty-tag statuses remain semantically valid.',
          resolvedValue,
          sourceValue,
        }
      }
      return {
        classification: 'physician_authorized_compatibility_decision' as const,
        currentValue,
        field,
        reason: 'A checksum-bound physician supplement supplies this otherwise ambiguous status.',
        resolvedValue,
        sourceValue,
      }
    }
    const booleanColumn = BOOLEAN_FIELDS.get(field)
    if (booleanColumn) {
      const normalization = record.booleanNormalizations.find(
        (entry) => entry.column === booleanColumn,
      )
      if (canonicalJson(currentValue) !== canonicalJson(resolvedValue)) {
        return {
          classification: 'incompatible' as const,
          currentValue,
          field,
          reason: 'Lexical normalization cannot authorize a semantic boolean change.',
          resolvedValue,
          sourceValue,
        }
      }
      if (normalization?.sourceForm === 'legacy_title_case') {
        return {
          classification: 'deterministic_lexical_normalization' as const,
          currentValue,
          field,
          reason: `The exact ${String(normalization.originalLexeme)} lexeme normalizes without changing its semantic value.`,
          resolvedValue,
          sourceValue,
        }
      }
    }
    if (canonicalJson(currentValue) === canonicalJson(resolvedValue)) {
      return {
        classification: 'identical' as const,
        currentValue,
        field,
        reason: 'Current and finalized semantic values are identical.',
        resolvedValue,
        sourceValue,
      }
    }
    if (NEW_CONTRACT_FIELDS.has(field) && currentValue === null && resolvedValue !== null) {
      return {
        classification: 'deterministic_schema_compatibility_mapping' as const,
        currentValue,
        field,
        reason:
          'The finalized artifact deterministically supplies a newly persisted contract field.',
        resolvedValue,
        sourceValue,
      }
    }
    return {
      classification: 'incompatible' as const,
      currentValue,
      field,
      reason: 'The finalized value differs from an existing physician or clinical value.',
      resolvedValue,
      sourceValue,
    }
  })
}

function expectedDecisionRows(
  existingRows: readonly CompatibilityPlanningStateRow[],
  recordsByItem: ReadonlyMap<string, FinalizedGoldImportArtifactRecord>,
) {
  const byIdentity = new Map(
    existingRows.map((row) => {
      const record = recordsByItem.get(row.itemId)
      if (!record) throw new Error('Decision row is absent from the finalized artifact.')
      return [decisionIdentityKey(record.identity), { record, row }] as const
    }),
  )
  return GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES.map((identity) => {
    const matched = byIdentity.get(decisionIdentityKey(identity))
    if (!matched || matched.row.currentEffectiveReview === null) {
      throw new Error('The exact physician-decision cohort is absent from current planning state.')
    }
    const { record, row } = matched
    const current = row.currentEffectiveReview
    if (!current) {
      throw new Error('The physician-decision row lost its current effective review.')
    }
    if (
      record.projection.relevanceLabel !== 'exclude' ||
      record.projection.topicIds.length !== 0 ||
      record.projection.technologyTags.length !== 0 ||
      record.projection.clinicalPurposes.length !== 0 ||
      record.projection.diseaseTags.length !== 0 ||
      record.projection.studyDesign !== null ||
      record.projection.publicationStatus !== null ||
      record.projection.categorizationFromFullText ||
      record.raw.technology_tag_status !== '' ||
      record.raw.disease_tag_status !== '' ||
      current.technologyTagStatus !== null ||
      current.diseaseTagStatus !== null
    ) {
      throw new Error(
        `Physician-decision row ${identity.masterRowId}:${identity.pmid} no longer has the fixed excluded-row contract shape.`,
      )
    }
    return compatibilitySupplementTemplateRowSchema.parse({
      categorizationFromFullText: false,
      clinicalPurposes: [],
      completionStatus: 'pending',
      diseaseTags: [],
      diseaseTagStatus: {
        allowedValues: ['not_applicable', 'not_assessable'],
        currentValue: null,
        physicianFinalValue: null,
        proposedValue: null,
        sourceValue: '',
      },
      enrichmentProvenance: record.projection.enrichmentProvenance,
      itemId: record.identity.itemId,
      masterRowId: record.identity.masterRowId,
      physicianRationale: '',
      pmid: record.identity.pmid,
      publicationStatus: null,
      relevanceLabel: 'exclude',
      reviewed: false,
      reviewerConfidence: record.projection.reviewerConfidence,
      studyDesign: null,
      technologyTags: [],
      technologyTagStatus: {
        allowedValues: ['not_applicable', 'not_assessable'],
        currentValue: null,
        physicianFinalValue: null,
        proposedValue: null,
        sourceValue: '',
      },
      topicIds: [],
    })
  })
}

function buildSupplementTemplate(
  bindingContext: CompatibilityAuditBindingContext,
  existingHeadCohortDigest: string,
  rows: ReturnType<typeof expectedDecisionRows>,
): BoundCompatibilitySupplementTemplate {
  const content = compatibilitySupplementTemplateContentSchema.parse({
    allowedMutableFields: GOLD_IMPORT_COMPATIBILITY_MUTABLE_FIELDS,
    authorization: null,
    bindings: {
      ...bindingContext,
      existingHeadCohortSha256: existingHeadCohortDigest,
    },
    documentState: 'template',
    kind: 'physician_compatibility_supplement',
    resolutionClasses: GOLD_IMPORT_COMPATIBILITY_RESOLUTION_CLASSES,
    rows,
    schemaVersion: GOLD_IMPORT_COMPATIBILITY_SUPPLEMENT_SCHEMA_VERSION,
    scope: {
      datasetSplit: 'development',
      heldOutIdentitiesAccessed: false,
      purpose: 'import_contract_compatibility_only',
      remoteWritesAllowed: false,
      targetDatabase: 'local',
    },
  })
  return boundCompatibilitySupplementTemplateSchema.parse(bindSupplementContent(content))
}

function decisionMapFromSupplement(
  supplement: BoundCompatibilitySupplementCompleted | null,
): SupplementDecisionMap {
  if (!supplement) return new Map()
  return new Map(
    supplement.rows.map((row) => [
      decisionIdentityKey(row),
      {
        diseaseTagStatus: row.diseaseTagStatus.physicianFinalValue,
        technologyTagStatus: row.technologyTagStatus.physicianFinalValue,
      },
    ]),
  )
}

function validatePlanningStateCoverage(
  state: CompatibilityDevelopmentPlanningState,
  artifact: ParsedFinalizedGoldImportArtifact,
) {
  if (state.rows.length !== artifact.rows.length) {
    throw new Error('Development planning state and finalized artifact row counts differ.')
  }
  const recordsByItem = new Map(artifact.rows.map((row) => [row.identity.itemId, row]))
  if (recordsByItem.size !== artifact.rows.length) {
    throw new Error('Finalized artifact item identities are not unique.')
  }
  const itemIds = new Set<string>()
  const pmids = new Set<string>()
  state.rows.forEach((row, index) => {
    if (row.sequence !== index + 1) {
      throw new Error('Development planning state sequence must be contiguous.')
    }
    if (itemIds.has(row.itemId) || pmids.has(row.pmid)) {
      throw new Error('Development planning state identities must be unique.')
    }
    itemIds.add(row.itemId)
    pmids.add(row.pmid)
    const record = recordsByItem.get(row.itemId)
    if (!record || record.identity.pmid !== row.pmid) {
      throw new Error('Development planning state identities do not match the finalized artifact.')
    }
    const hasAnyHeadState =
      row.currentReviewId !== null ||
      row.effectiveReviewId !== null ||
      row.currentRevision !== null ||
      row.currentEffectiveReview !== null
    const hasAllHeadState =
      row.currentReviewId !== null &&
      row.effectiveReviewId !== null &&
      row.currentRevision !== null &&
      row.currentEffectiveReview !== null
    if (hasAnyHeadState !== hasAllHeadState) {
      throw new Error('A planning row contains contradictory current-head state.')
    }
  })
  return recordsByItem
}

/**
 * Resolve the unchanged artifact against current development state. Unresolved physician fields
 * always produce a null action and therefore cannot be consumed by the package generator.
 */
export function resolveGoldImportCompensationCompatibility(input: {
  bindingContext: CompatibilityAuditBindingContext
  compatibilitySupplement?: unknown
  developmentPlanningState: unknown
  finalizedArtifact: Uint8Array | string
}): GoldImportCompensationCompatibilityResolution {
  const bindingContext = compatibilityAuditBindingContextSchema.parse(input.bindingContext)
  const state = compatibilityDevelopmentPlanningStateSchema.parse(input.developmentPlanningState)
  if (sha256Canonical(state) !== bindingContext.currentDatabase.developmentPlanningStateSha256) {
    throw new Error('Development planning state is stale relative to its database-state binding.')
  }
  const artifact = parseFinalizedGoldImportArtifact(input.finalizedArtifact, {
    expectedArtifactSha256: bindingContext.finalV3ArtifactSha256,
  })
  const recordsByItem = validatePlanningStateCoverage(state, artifact)
  const existingRows = state.rows.filter((row) => row.currentReviewId !== null)
  const existingIdentities = existingRows.map((row) => {
    const record = recordsByItem.get(row.itemId)
    if (!record) throw new Error('Existing head is absent from the finalized artifact.')
    return { masterRowId: record.identity.masterRowId, pmid: record.identity.pmid }
  })
  if (!exactIdentitySet(existingIdentities, GOLD_IMPORT_EXISTING_HEAD_IDENTITIES)) {
    throw new Error('Current planning state does not contain the exact nine-head cohort.')
  }
  existingRows.forEach((row) => {
    const record = recordsByItem.get(row.itemId)
    if (!record) throw new Error('Existing head is absent from the finalized artifact.')
    if (record.raw.is_blinded !== 'False') {
      throw new Error(
        `Existing-head row ${record.identity.masterRowId}:${record.identity.pmid} no longer carries the approved legacy False lexeme.`,
      )
    }
  })
  const cohortDigest = existingHeadCohortSha256(existingRows, recordsByItem)
  const decisionRows = expectedDecisionRows(existingRows, recordsByItem)
  const supplementTemplate = buildSupplementTemplate(bindingContext, cohortDigest, decisionRows)
  const completedSupplement =
    input.compatibilitySupplement === undefined
      ? null
      : validateCompletedCompatibilitySupplement(input.compatibilitySupplement, supplementTemplate)
  const decisions = decisionMapFromSupplement(completedSupplement)
  const existingHeadAuditByItem = new Map<string, ExistingHeadCompatibilityRow>()
  existingRows.forEach((row) => {
    const record = recordsByItem.get(row.itemId)
    if (
      !record ||
      row.currentReviewId === null ||
      row.effectiveReviewId === null ||
      row.currentRevision === null ||
      row.currentEffectiveReview === null
    ) {
      throw new Error('Existing-head audit row is incomplete.')
    }
    const targetReview = resolvedTargetReview(record, row.currentEffectiveReview, decisions)
    const fields = fieldClassifications(record, row.currentEffectiveReview, targetReview, decisions)
    const hasPending = fields.some(
      (field) => field.classification === 'physician_decision_required',
    )
    const hasIncompatible = fields.some((field) => field.classification === 'incompatible')
    let resolutionStatus: ExistingHeadCompatibilityRow['resolutionStatus'] = 'resolved'
    let proposedAction: ExistingHeadCompatibilityRow['proposedAction'] = null
    let reason = 'All fields are classified and compatible.'
    if (hasPending) {
      resolutionStatus = 'pending_physician_decision'
      reason = 'Action is deferred until every ambiguous optional-tag status is authorized.'
    } else if (hasIncompatible || targetReview === null) {
      resolutionStatus = 'incompatible'
      reason = 'At least one finalized value would change an existing physician or clinical value.'
    } else {
      proposedAction =
        canonicalJson(goldReviewClinicalProjection(targetReview)) ===
        canonicalJson(historicalProjection(row.currentEffectiveReview))
          ? 'import_noop'
          : 'import_revision'
    }
    existingHeadAuditByItem.set(row.itemId, {
      currentReviewId: row.currentReviewId,
      currentRevision: row.currentRevision,
      effectiveReviewId: row.effectiveReviewId,
      fields,
      identity: record.identity,
      physicianReviewCohort: record.physicianReviewCohort,
      proposedAction,
      reason,
      resolutionStatus,
    })
  })
  const planningRows = state.rows.map((row): CompatibilityPlanningResolutionRow => {
    const record = recordsByItem.get(row.itemId)
    if (!record) throw new Error('Planning row is absent from finalized artifact.')
    const existing = existingHeadAuditByItem.get(row.itemId)
    if (existing) {
      return {
        identity: record.identity,
        proposedAction: existing.proposedAction,
        reason: existing.reason,
        resolutionStatus: existing.resolutionStatus,
        sequence: row.sequence,
        targetReview:
          existing.proposedAction === null
            ? null
            : resolvedTargetReview(record, row.currentEffectiveReview, decisions),
      }
    }
    const targetReview = resolvedTargetReview(record, null, decisions)
    if (targetReview === null) {
      return {
        identity: record.identity,
        proposedAction: null,
        reason: 'An initial import row contains an unresolved contract field.',
        resolutionStatus: 'incompatible',
        sequence: row.sequence,
        targetReview: null,
      }
    }
    return {
      identity: record.identity,
      proposedAction: 'import_initial',
      reason: 'No current review exists and every target field is classified.',
      resolutionStatus: 'resolved',
      sequence: row.sequence,
      targetReview,
    }
  })
  const actionCounts = deriveCompatibilityActionCounts(planningRows)
  return {
    acceptedSupplementSha256: completedSupplement?.binding.contentSha256 ?? null,
    actionCounts,
    artifact,
    existingHeadCohortSha256: cohortDigest,
    existingHeads: [...existingHeadAuditByItem.values()].sort((left, right) =>
      compareMasterRows(left.identity, right.identity),
    ),
    planningRows,
    readyForPackage: actionCounts.unresolved === 0 && actionCounts.incompatible === 0,
    schemaVersion: GOLD_IMPORT_COMPATIBILITY_SCHEMA_VERSION,
    supplementRequired: decisionRows.length > 0,
    supplementTemplate,
  }
}

const authorizedOptionalStatusResolutionSchema = z
  .object({
    diseaseTagStatus: z.enum(['not_applicable', 'not_assessable']),
    itemId: uuidSchema,
    pmid: pmidSchema,
    technologyTagStatus: z.enum(['not_applicable', 'not_assessable']),
  })
  .strict()

export const goldImportSourceAuthorizationSetV1Schema = z
  .object({
    amendedTwoRowAuthorizationSha256: sha256Schema,
    finalArtifactSha256: sha256Schema,
    kind: z.literal('gold_import_source_authorization_set'),
    signedProtocolAuthorizationSha256: sha256Schema,
    sourceDecisionsChanged: z.literal(false),
    version: z.literal(1),
  })
  .strict()

export const goldImportSourceAuthorizationSetV2Schema = z
  .object({
    amendedTwoRowAuthorizationSha256: sha256Schema,
    compatibility: z
      .object({
        acceptedSupplementSha256: sha256Schema,
        actionCounts: compatibilityActionCountsSchema.extend({
          incompatible: z.literal(0),
          unresolved: z.literal(0),
        }),
        booleanNormalizationLedger: z.array(finalizedArtifactBooleanNormalizationSchema).nonempty(),
        booleanNormalizationLedgerSha256: sha256Schema,
        existingHeadCohortSha256: sha256Schema,
        optionalTagStatusResolutions: z.array(authorizedOptionalStatusResolutionSchema).length(4),
        resolutionSchemaVersion: z.literal(GOLD_IMPORT_COMPATIBILITY_SCHEMA_VERSION),
        supplement: boundCompatibilitySupplementCompletedSchema,
      })
      .strict(),
    finalArtifactSha256: sha256Schema,
    kind: z.literal('gold_import_source_authorization_set'),
    signedProtocolAuthorizationSha256: sha256Schema,
    sourceDecisionsChanged: z.literal(false),
    version: z.literal(2),
  })
  .strict()

export type GoldImportSourceAuthorizationSetV2 = z.infer<
  typeof goldImportSourceAuthorizationSetV2Schema
>

/** Validate the semantic content of the checksum-bound authorization set before any RPC client exists. */
export function validateGoldImportSourceAuthorizationSetV2(
  input: unknown,
): GoldImportSourceAuthorizationSetV2 {
  const authorizationSet = goldImportSourceAuthorizationSetV2Schema.parse(input)
  const compatibility = authorizationSet.compatibility
  verifySupplementBinding(compatibility.supplement)
  if (
    compatibility.acceptedSupplementSha256 !== compatibility.supplement.binding.contentSha256 ||
    compatibility.booleanNormalizationLedgerSha256 !==
      sha256Canonical(compatibility.booleanNormalizationLedger) ||
    compatibility.supplement.bindings.finalV3ArtifactSha256 !==
      authorizationSet.finalArtifactSha256 ||
    compatibility.supplement.bindings.existingHeadCohortSha256 !==
      compatibility.existingHeadCohortSha256
  ) {
    throw new Error('Source authorization compatibility checksum bindings are inconsistent.')
  }
  if (
    compatibility.actionCounts.initial +
      compatibility.actionCounts.revisions +
      compatibility.actionCounts.noops !==
      compatibility.actionCounts.total ||
    compatibility.actionCounts.initial + compatibility.actionCounts.revisions !==
      compatibility.actionCounts.inserts
  ) {
    throw new Error('Source authorization compatibility action counts are inconsistent.')
  }
  const ledgerKeys = new Set<string>()
  for (const entry of compatibility.booleanNormalizationLedger) {
    if (entry.sourceArtifactSha256 !== authorizationSet.finalArtifactSha256) {
      throw new Error('Boolean normalization ledger is bound to a different source artifact.')
    }
    const key = `${entry.sourceIdentity.itemId}:${entry.column}`
    if (ledgerKeys.has(key)) throw new Error('Boolean normalization ledger contains a duplicate.')
    ledgerKeys.add(key)
  }
  if (
    !exactIdentitySet(
      compatibility.optionalTagStatusResolutions.map(({ pmid }) => ({
        masterRowId:
          compatibility.supplement.rows.find((row) => row.pmid === pmid)?.masterRowId ?? '',
        pmid,
      })),
      GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES,
    )
  ) {
    throw new Error('Source authorization set does not contain the exact four decision rows.')
  }
  const supplementRowsByPmid = new Map(compatibility.supplement.rows.map((row) => [row.pmid, row]))
  for (const resolution of compatibility.optionalTagStatusResolutions) {
    const supplementRow = supplementRowsByPmid.get(resolution.pmid)
    if (
      !supplementRow ||
      supplementRow.itemId !== resolution.itemId ||
      supplementRow.technologyTagStatus.physicianFinalValue !== resolution.technologyTagStatus ||
      supplementRow.diseaseTagStatus.physicianFinalValue !== resolution.diseaseTagStatus
    ) {
      throw new Error('Authorized optional-tag status differs from the physician supplement.')
    }
  }
  return authorizationSet
}

export type GoldImportSourceAuthorizationSet =
  | z.infer<typeof goldImportSourceAuthorizationSetV1Schema>
  | GoldImportSourceAuthorizationSetV2

export function validateGoldImportSourceAuthorizationSet(
  input: unknown,
  expectedArtifactSha256: string,
): GoldImportSourceAuthorizationSet {
  const container = z
    .object({ version: z.union([z.literal(1), z.literal(2)]) })
    .passthrough()
    .parse(input)
  const authorizationSet =
    container.version === 2
      ? validateGoldImportSourceAuthorizationSetV2(input)
      : goldImportSourceAuthorizationSetV1Schema.parse(input)
  if (authorizationSet.finalArtifactSha256 !== sha256Schema.parse(expectedArtifactSha256)) {
    throw new Error('Source authorization set is bound to a different finalized artifact.')
  }
  return authorizationSet
}

type GoldImportRuntimePlanBinding = Pick<
  ImportPlan,
  | 'batchId'
  | 'counts'
  | 'executionContext'
  | 'expectedEffectiveStateSha256'
  | 'expectedPhysicalStateSha256'
  | 'scope'
  | 'sourceArtifactSha256'
>

/**
 * Revalidate every V2 compatibility claim against the parsed import plan and unchanged artifact.
 * This is the final file-only trust boundary before the executor may construct a database client.
 */
export function validateGoldImportSourceAuthorizationSetForImport(input: {
  finalizedArtifact: Uint8Array | string
  plan: GoldImportRuntimePlanBinding
  sourceAuthorizationSet: unknown
}): GoldImportSourceAuthorizationSet {
  const authorizationSet = validateGoldImportSourceAuthorizationSet(
    input.sourceAuthorizationSet,
    input.plan.sourceArtifactSha256,
  )
  if (authorizationSet.version === 1) return authorizationSet

  const compatibility = authorizationSet.compatibility
  const expectedActionCounts = {
    initial: input.plan.counts.initial,
    inserts: input.plan.counts.inserts,
    noops: input.plan.counts.noops,
    revisions: input.plan.counts.revisions,
    total: input.plan.counts.total,
  }
  const authorizedActionCounts = {
    initial: compatibility.actionCounts.initial,
    inserts: compatibility.actionCounts.inserts,
    noops: compatibility.actionCounts.noops,
    revisions: compatibility.actionCounts.revisions,
    total: compatibility.actionCounts.total,
  }
  if (canonicalJson(authorizedActionCounts) !== canonicalJson(expectedActionCounts)) {
    throw new Error(
      'Source authorization compatibility action counts do not match the import plan.',
    )
  }

  const artifact = parseFinalizedGoldImportArtifact(input.finalizedArtifact, {
    expectedArtifactSha256: input.plan.sourceArtifactSha256,
  })
  if (
    canonicalJson(compatibility.booleanNormalizationLedger) !==
    canonicalJson(artifact.booleanNormalizations)
  ) {
    throw new Error(
      'Source authorization boolean normalization ledger does not exactly match the finalized artifact.',
    )
  }

  const supplement = compatibility.supplement
  const expectedCurrentDatabaseBinding = {
    batchId: input.plan.batchId,
    developmentMembershipSha256: input.plan.scope.developmentMembershipSha256,
    effectiveStateSha256: input.plan.expectedEffectiveStateSha256,
    physicalStateSha256: input.plan.expectedPhysicalStateSha256,
  }
  const supplementCurrentDatabaseBinding = {
    batchId: supplement.bindings.currentDatabase.batchId,
    developmentMembershipSha256: supplement.bindings.currentDatabase.developmentMembershipSha256,
    effectiveStateSha256: supplement.bindings.currentDatabase.effectiveStateSha256,
    physicalStateSha256: supplement.bindings.currentDatabase.physicalStateSha256,
  }
  if (
    canonicalJson(supplementCurrentDatabaseBinding) !==
    canonicalJson(expectedCurrentDatabaseBinding)
  ) {
    throw new Error(
      'Source authorization compatibility supplement is stale relative to the import plan current-state bindings.',
    )
  }
  if (
    supplement.bindings.finalV3ArtifactSha256 !== artifact.artifactSha256 ||
    supplement.bindings.migration.id !== input.plan.executionContext.migrationId ||
    supplement.scope.datasetSplit !== input.plan.scope.datasetSplit ||
    supplement.scope.heldOutIdentitiesAccessed !== input.plan.scope.heldOutIdentitiesAccessed ||
    supplement.scope.remoteWritesAllowed !== input.plan.executionContext.remoteWritesAllowed ||
    supplement.scope.targetDatabase !== input.plan.executionContext.targetDatabase
  ) {
    throw new Error(
      'Source authorization compatibility supplement scope does not match the import plan and artifact.',
    )
  }
  return authorizationSet
}
