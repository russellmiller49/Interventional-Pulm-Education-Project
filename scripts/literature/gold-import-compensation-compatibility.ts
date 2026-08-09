import { createHash } from 'node:crypto'
import { TextDecoder } from 'node:util'

import { z } from 'zod'

import { parseCsvRows } from '../../src/features/literature/gold-set/export'
import {
  FINALIZED_ARTIFACT_LIST_COLUMNS,
  FINALIZED_ARTIFACT_LIST_NORMALIZATION_RULE_VERSION,
  deriveFinalizedArtifactListNormalization,
  parseFinalizedArtifactBooleanValue,
} from '../../src/features/literature/gold-set/import-artifact-validation'
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
export const GOLD_IMPORT_LIST_NORMALIZATION_RULE_VERSION =
  FINALIZED_ARTIFACT_LIST_NORMALIZATION_RULE_VERSION
export const GOLD_IMPORT_EXISTING_HEAD_COHORT_SCHEMA_VERSION =
  'gold-import-compensation-existing-head-cohort/1.0.0' as const
export const GOLD_IMPORT_COMPENSATION_MIGRATION_ID =
  '20260808035633_add_literature_gold_import_compensation_contract' as const
export const GOLD_IMPORT_INITIAL_REVIEW_TIMESTAMP = '2026-08-08T00:00:00.000Z' as const
export const GOLD_IMPORT_EXISTING_NOTE_DISPOSITION_RULE_VERSION =
  'gold-import-existing-note-disposition/amended-two-row-preserve-current-v1' as const

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

export const GOLD_IMPORT_PRESERVE_CURRENT_NOTE_IDENTITIES = Object.freeze([
  { masterRowId: '4', pmid: '36879724' },
  { masterRowId: '9', pmid: '39281191' },
] as const)

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

const listColumnSchema = z.enum(FINALIZED_ARTIFACT_LIST_COLUMNS)

const artifactListValuesSchema = () =>
  z
    .array(
      z
        .string()
        .min(1)
        .max(160)
        .refine((value) => value.trim() === value, 'List values cannot contain surrounding space.'),
    )
    .nonempty()
    .refine((values) => new Set(values).size === values.length, 'List values must be unique.')

export const finalizedArtifactListNormalizationSchema = z
  .object({
    canonicalValues: artifactListValuesSchema().refine(
      (values) => values.every((value, index) => index === 0 || values[index - 1] <= value),
      'Canonical list values must use ascending order.',
    ),
    classification: z.literal('deterministic_lexical_normalization'),
    column: listColumnSchema,
    normalizationRuleVersion: z.literal(GOLD_IMPORT_LIST_NORMALIZATION_RULE_VERSION),
    originalLexeme: z.string().min(1),
    originalValues: artifactListValuesSchema(),
    sourceArtifactSha256: sha256Schema,
    sourceIdentity: sourceIdentitySchema,
  })
  .strict()
  .superRefine((entry, context) => {
    const expectedCanonicalValues = [...entry.originalValues].sort()
    if (entry.originalLexeme !== entry.originalValues.join('|')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'List normalization lexeme does not match its original values.',
        path: ['originalLexeme'],
      })
    }
    if (canonicalJson(entry.canonicalValues) !== canonicalJson(expectedCanonicalValues)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'List normalization does not contain the exact ascending set projection.',
        path: ['canonicalValues'],
      })
    }
    if (canonicalJson(entry.originalValues) === canonicalJson(entry.canonicalValues)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'List normalization ledger entries must describe an actual reorder.',
        path: ['originalValues'],
      })
    }
  })

export type FinalizedArtifactListNormalization = z.infer<
  typeof finalizedArtifactListNormalizationSchema
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
  fullTextUsed: boolean
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
}

export interface FinalizedGoldImportArtifactRecord {
  booleanNormalizations: readonly FinalizedArtifactBooleanNormalization[]
  csvRecordNumber: number
  identity: GoldImportCompatibilitySourceIdentity
  listNormalizations: readonly FinalizedArtifactListNormalization[]
  physicianReviewCohort: z.infer<typeof physicianReviewCohortSchema>
  projection: FinalizedGoldImportArtifactProjection
  raw: Readonly<FinalizedGoldImportRawRecord>
}

export interface ParsedFinalizedGoldImportArtifact {
  artifactSha256: string
  booleanNormalizations: readonly FinalizedArtifactBooleanNormalization[]
  header: readonly string[]
  listNormalizations: readonly FinalizedArtifactListNormalization[]
  rows: readonly FinalizedGoldImportArtifactRecord[]
}

const artifactProjectionWithoutOptionalStatusesSchema = goldReviewClinicalProjectionSchema.omit({
  diseaseTagStatus: true,
  technologyTagStatus: true,
})

function validateArtifactProjectionExceptOptionalStatuses(
  projection: FinalizedGoldImportArtifactProjection,
): void {
  const { diseaseTagStatus, fullTextUsed, technologyTagStatus, ...withoutStatuses } = projection
  void fullTextUsed
  artifactProjectionWithoutOptionalStatusesSchema.parse({
    ...withoutStatuses,
    reviewSeconds: 0,
    usedSupplementalMetadata: false,
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

function requireArtifactList(input: {
  column: z.input<typeof listColumnSchema>
  recordNumber: number
  sourceArtifactSha256: string
  sourceIdentity: GoldImportCompatibilitySourceIdentity
  value: string
}): { normalization: FinalizedArtifactListNormalization | null; values: string[] } {
  let derived: ReturnType<typeof deriveFinalizedArtifactListNormalization>
  try {
    derived = deriveFinalizedArtifactListNormalization({
      column: input.column,
      sourceArtifactSha256: input.sourceArtifactSha256,
      sourceIdentity: input.sourceIdentity,
      value: input.value,
    })
  } catch {
    throw new Error(
      `Finalized V3 artifact CSV record ${input.recordNumber}, column ${input.column}, has a noncanonical list.`,
    )
  }
  return {
    normalization: derived.normalization
      ? finalizedArtifactListNormalizationSchema.parse(derived.normalization)
      : null,
    values: derived.canonicalValues,
  }
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
  const listNormalizations: FinalizedArtifactListNormalization[] = []
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
    const topicIds = requireArtifactList({
      column: 'topic_ids',
      recordNumber: csvRecordNumber,
      sourceArtifactSha256: artifactSha256,
      sourceIdentity: identity,
      value: raw.topic_ids,
    })
    const technologyTags = requireArtifactList({
      column: 'technology_tags',
      recordNumber: csvRecordNumber,
      sourceArtifactSha256: artifactSha256,
      sourceIdentity: identity,
      value: raw.technology_tags,
    })
    const clinicalPurposes = requireArtifactList({
      column: 'clinical_purposes',
      recordNumber: csvRecordNumber,
      sourceArtifactSha256: artifactSha256,
      sourceIdentity: identity,
      value: raw.clinical_purposes,
    })
    const diseaseTags = requireArtifactList({
      column: 'disease_tags',
      recordNumber: csvRecordNumber,
      sourceArtifactSha256: artifactSha256,
      sourceIdentity: identity,
      value: raw.disease_tags,
    })
    const rowListNormalizations = [topicIds, technologyTags, clinicalPurposes, diseaseTags].flatMap(
      ({ normalization }) => (normalization ? [normalization] : []),
    )
    listNormalizations.push(...rowListNormalizations)
    const projection: FinalizedGoldImportArtifactProjection = {
      categorizationFromFullText: rowNormalizations[0].semanticValue,
      clinicalPurposes: clinicalPurposes.values,
      diseaseTagStatus,
      diseaseTags: diseaseTags.values,
      enrichmentProvenance,
      enrichmentSchemaVersion: requireNonblankArtifactValue(
        raw.enrichment_schema_version,
        csvRecordNumber,
        'enrichment_schema_version',
      ),
      fullTextUsed: rowNormalizations[1].semanticValue,
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
      technologyTags: technologyTags.values,
      topicIds: topicIds.values,
    }
    validateArtifactProjectionExceptOptionalStatuses(projection)
    return {
      booleanNormalizations: rowNormalizations,
      csvRecordNumber,
      identity,
      listNormalizations: rowListNormalizations,
      physicianReviewCohort: provenanceCohort(enrichmentProvenance),
      projection,
      raw,
    }
  })
  if (rows.length === 0) throw new Error('Finalized V3 artifact contains no development rows.')
  return { artifactSha256, booleanNormalizations: normalizations, header, listNormalizations, rows }
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
  | 'existing_physician_note_preserved_by_amended_authorization'
  | 'finalized_v3_authorized_enrichment_change'
  | 'finalized_v3_out_of_scope_null'
  | 'execution_contract_mismatch'
  | 'incompatible'

export const GOLD_IMPORT_EXECUTION_COMPATIBILITY_BLOCKER_CODES = [
  'excluded_status_null_not_representable_by_import_contract_v1',
  'source_review_blinding_provenance_has_no_exact_import_v1_mapping',
  'source_full_text_provenance_has_no_exact_import_v1_mapping',
] as const

export type CompatibilityExecutionBlockerCode =
  (typeof GOLD_IMPORT_EXECUTION_COMPATIBILITY_BLOCKER_CODES)[number]

export interface CompatibilityExecutionValidation {
  blockedRowCount: number
  countsByCode: Readonly<Record<CompatibilityExecutionBlockerCode, number>>
  executableRowCount: number
  identitiesByCode: Readonly<
    Record<CompatibilityExecutionBlockerCode, readonly GoldImportCompatibilitySourceIdentity[]>
  >
  totalRowCount: number
}

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
  resolutionStatus: 'resolved' | 'incompatible'
}

export interface CompatibilityPlanningResolutionRow {
  executionBlockerCodes: readonly CompatibilityExecutionBlockerCode[]
  identity: GoldImportCompatibilitySourceIdentity
  proposedAction: 'import_initial' | 'import_revision' | 'import_noop' | null
  reason: string
  resolutionStatus: 'resolved' | 'incompatible'
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
    unresolved: 0,
  }
}

export const goldImportExistingNoteDispositionSchema = z
  .object({
    action: z.literal('preserve_current_authorized_physician_rationale'),
    pmids: z.tuple([z.literal('36879724'), z.literal('39281191')]),
    ruleVersion: z.literal(GOLD_IMPORT_EXISTING_NOTE_DISPOSITION_RULE_VERSION),
    sourceArtifactNotesApplied: z.literal(false),
    status: z.literal('already_authorized'),
  })
  .strict()

export type GoldImportExistingNoteDisposition = z.infer<
  typeof goldImportExistingNoteDispositionSchema
>

export interface GoldImportCompensationCompatibilityResolution {
  actionCounts: CompatibilityActionCounts
  artifact: ParsedFinalizedGoldImportArtifact
  existingHeadCohortSha256: string
  existingHeads: readonly ExistingHeadCompatibilityRow[]
  executionCompatibility: CompatibilityExecutionValidation
  noteDisposition: GoldImportExistingNoteDisposition
  planningRows: readonly CompatibilityPlanningResolutionRow[]
  readyForPackage: boolean
  schemaVersion: typeof GOLD_IMPORT_COMPATIBILITY_SCHEMA_VERSION
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

function resolvedTargetReview(
  record: FinalizedGoldImportArtifactRecord,
  current: CompatibilityHistoricalReview | null,
  itemState: CompatibilityPlanningStateRow['itemState'],
): GoldReviewPayload | null {
  const technologyTagStatus = record.projection.technologyTagStatus
  const diseaseTagStatus = record.projection.diseaseTagStatus
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
  const { fullTextUsed, ...sourceProjection } = record.projection
  void fullTextUsed
  return goldReviewPayloadSchema.parse({
    ...sourceProjection,
    ...operational,
    diseaseTagStatus,
    notes: resolveFinalizedArtifactNoteForImport({
      currentNote: current?.notes ?? null,
      identity: record.identity,
      sourceNote: record.projection.notes,
    }),
    technologyTagStatus,
    usedSupplementalMetadata: itemState.supplementalMetadataRevealedAt !== null,
  })
}

function isPreserveCurrentNoteIdentity(identity: { masterRowId: string; pmid: string }): boolean {
  return GOLD_IMPORT_PRESERVE_CURRENT_NOTE_IDENTITIES.some(
    (expected) => expected.masterRowId === identity.masterRowId && expected.pmid === identity.pmid,
  )
}

/**
 * Apply the exact amended two-row note disposition without treating finalized V3 prose as an
 * executable replacement for an already-authored physician rationale.
 */
export function resolveFinalizedArtifactNoteForImport(input: {
  currentNote: string | null
  identity: { masterRowId: string; pmid: string }
  sourceNote: string
}): string {
  if (!isPreserveCurrentNoteIdentity(input.identity)) return input.sourceNote
  if (input.currentNote === null) {
    throw new Error(
      `NOTE DISPOSITION ALREADY AUTHORIZED identity ${input.identity.masterRowId}:${input.identity.pmid} is missing its current physician note.`,
    )
  }
  return input.currentNote
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
    usedSupplementalMetadata: null,
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
  ['isBlinded', 'is_blinded'],
])
const LIST_FIELDS = new Map<CompatibilityProjectionField, z.infer<typeof listColumnSchema>>([
  ['topicIds', 'topic_ids'],
  ['technologyTags', 'technology_tags'],
  ['clinicalPurposes', 'clinical_purposes'],
  ['diseaseTags', 'disease_tags'],
])
const FINALIZED_V3_ENRICHMENT_FIELDS = new Set<CompatibilityProjectionField>([
  'categorizationFromFullText',
  'clinicalPurposes',
  'diseaseTagStatus',
  'diseaseTags',
  'enrichmentProvenance',
  'enrichmentSchemaVersion',
  'labelSchemaVersion',
  'metadataSufficiency',
  'publicationStatus',
  'studyDesign',
  'taxonomyVersion',
  'technologyTagStatus',
  'technologyTags',
  'topicIds',
])

function fieldClassifications(
  record: FinalizedGoldImportArtifactRecord,
  currentReview: CompatibilityHistoricalReview,
  targetReview: GoldReviewPayload | null,
  itemState: CompatibilityPlanningStateRow['itemState'],
): ExistingHeadFieldClassification[] {
  const current = historicalProjection(currentReview) as Record<
    CompatibilityProjectionField,
    unknown
  >
  const { fullTextUsed, ...sourceProjection } = record.projection
  void fullTextUsed
  const partialTarget: Record<CompatibilityProjectionField, unknown> = {
    ...sourceProjection,
    clinicalPurposes: [...record.projection.clinicalPurposes].sort(),
    diseaseTagStatus: record.projection.diseaseTagStatus,
    diseaseTags: [...record.projection.diseaseTags].sort(),
    reviewSeconds: currentReview.reviewSeconds,
    notes: resolveFinalizedArtifactNoteForImport({
      currentNote: currentReview.notes,
      identity: record.identity,
      sourceNote: record.projection.notes,
    }),
    technologyTagStatus: record.projection.technologyTagStatus,
    technologyTags: [...record.projection.technologyTags].sort(),
    topicIds: [...record.projection.topicIds].sort(),
    usedSupplementalMetadata: itemState.supplementalMetadataRevealedAt !== null,
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
      return {
        classification: 'finalized_v3_out_of_scope_null' as const,
        currentValue,
        field,
        reason:
          'The finalized V3 excluded-or-uncertain out-of-scope contract intentionally leaves this included-record-only status blank; no physician decision or compatibility mapping is authorized.',
        resolvedValue,
        sourceValue,
      }
    }
    if (
      field === 'notes' &&
      isPreserveCurrentNoteIdentity(record.identity) &&
      canonicalJson(currentValue) !== canonicalJson(sourceValue)
    ) {
      return {
        classification: 'existing_physician_note_preserved_by_amended_authorization' as const,
        currentValue,
        field,
        reason:
          'NOTE DISPOSITION ALREADY AUTHORIZED: the exact amended two-row authorization preserves the current physician rationale instead of applying finalized V3 prose.',
        resolvedValue: currentValue,
        sourceValue,
      }
    }
    const booleanColumn = BOOLEAN_FIELDS.get(field)
    if (booleanColumn) {
      const normalization = record.booleanNormalizations.find(
        (entry) => entry.column === booleanColumn,
      )
      if (canonicalJson(currentValue) !== canonicalJson(resolvedValue)) {
        if (field === 'isBlinded') {
          return {
            classification: 'execution_contract_mismatch' as const,
            currentValue,
            field,
            reason:
              'Finalized V3 review-level blinding provenance and local item-level reveal history are distinct facts; import v1 has no exact persistence mapping for both.',
            resolvedValue,
            sourceValue,
          }
        }
        if (FINALIZED_V3_ENRICHMENT_FIELDS.has(field)) {
          return {
            classification: 'finalized_v3_authorized_enrichment_change' as const,
            currentValue,
            field,
            reason:
              'The pinned finalized V3 enrichment projection authorizes this source-field change; execution compatibility is evaluated independently.',
            resolvedValue,
            sourceValue,
          }
        }
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
    const listColumn = LIST_FIELDS.get(field)
    if (listColumn) {
      const normalization = record.listNormalizations.find((entry) => entry.column === listColumn)
      if (canonicalJson(currentValue) !== canonicalJson(resolvedValue)) {
        if (FINALIZED_V3_ENRICHMENT_FIELDS.has(field)) {
          return {
            classification: 'finalized_v3_authorized_enrichment_change' as const,
            currentValue,
            field,
            reason:
              'The pinned finalized V3 enrichment projection authorizes this set-valued source-field change; execution compatibility is evaluated independently.',
            resolvedValue,
            sourceValue,
          }
        }
        return {
          classification: 'incompatible' as const,
          currentValue,
          field,
          reason: 'List-order normalization cannot authorize a semantic set change.',
          resolvedValue,
          sourceValue,
        }
      }
      if (normalization) {
        return {
          classification: 'deterministic_lexical_normalization' as const,
          currentValue,
          field,
          reason:
            'The ordered unique source list normalizes to ascending import-contract set order without changing its values.',
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
    if (FINALIZED_V3_ENRICHMENT_FIELDS.has(field)) {
      return {
        classification: 'finalized_v3_authorized_enrichment_change' as const,
        currentValue,
        field,
        reason:
          'The pinned finalized V3 enrichment projection authorizes this source-field change; execution compatibility is evaluated independently.',
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

function deriveExecutionCompatibility(
  state: CompatibilityDevelopmentPlanningState,
  recordsByItem: ReadonlyMap<string, FinalizedGoldImportArtifactRecord>,
): {
  blockerCodesByItem: ReadonlyMap<string, readonly CompatibilityExecutionBlockerCode[]>
  validation: CompatibilityExecutionValidation
} {
  const identitiesByCode = Object.fromEntries(
    GOLD_IMPORT_EXECUTION_COMPATIBILITY_BLOCKER_CODES.map((code) => [
      code,
      [] as GoldImportCompatibilitySourceIdentity[],
    ]),
  ) as Record<CompatibilityExecutionBlockerCode, GoldImportCompatibilitySourceIdentity[]>
  const blockerCodesByItem = new Map<string, readonly CompatibilityExecutionBlockerCode[]>()
  const blockedItemIds = new Set<string>()

  state.rows.forEach((row) => {
    const record = recordsByItem.get(row.itemId)
    if (!record) throw new Error('Execution validation row is absent from finalized artifact.')
    const codes: CompatibilityExecutionBlockerCode[] = []
    if (
      !['include_core', 'include_adjacent'].includes(record.projection.relevanceLabel) &&
      (record.projection.technologyTagStatus === null ||
        record.projection.diseaseTagStatus === null)
    ) {
      codes.push('excluded_status_null_not_representable_by_import_contract_v1')
    }
    const requiredIsBlinded = row.itemState.automatedSignalsRevealedAt === null
    if (record.projection.isBlinded !== requiredIsBlinded) {
      codes.push('source_review_blinding_provenance_has_no_exact_import_v1_mapping')
    }
    if (record.projection.fullTextUsed) {
      codes.push('source_full_text_provenance_has_no_exact_import_v1_mapping')
    }
    codes.forEach((code) => identitiesByCode[code].push(record.identity))
    if (codes.length > 0) blockedItemIds.add(row.itemId)
    blockerCodesByItem.set(row.itemId, codes)
  })

  const countsByCode = Object.fromEntries(
    GOLD_IMPORT_EXECUTION_COMPATIBILITY_BLOCKER_CODES.map((code) => [
      code,
      identitiesByCode[code].length,
    ]),
  ) as Record<CompatibilityExecutionBlockerCode, number>
  return {
    blockerCodesByItem,
    validation: {
      blockedRowCount: blockedItemIds.size,
      countsByCode,
      executableRowCount: state.rows.length - blockedItemIds.size,
      identitiesByCode,
      totalRowCount: state.rows.length,
    },
  }
}

/**
 * Resolve the unchanged artifact against current development state. Every row is checked against
 * the import contract's pre-state invariants before any action is assigned. A formal V3 excluded
 * status null is source-authoritative, not a physician ambiguity, and cannot be filled by a
 * compatibility supplement.
 */
export function resolveGoldImportCompensationCompatibility(input: {
  bindingContext: CompatibilityAuditBindingContext
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
  const executionCompatibility = deriveExecutionCompatibility(state, recordsByItem)
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
    const targetReview = resolvedTargetReview(record, row.currentEffectiveReview, row.itemState)
    const fields = fieldClassifications(
      record,
      row.currentEffectiveReview,
      targetReview,
      row.itemState,
    )
    const executionBlockerCodes = executionCompatibility.blockerCodesByItem.get(row.itemId) ?? []
    const hasIncompatible = fields.some(
      (field) =>
        field.classification === 'incompatible' ||
        field.classification === 'execution_contract_mismatch',
    )
    let resolutionStatus: ExistingHeadCompatibilityRow['resolutionStatus'] = 'resolved'
    let proposedAction: ExistingHeadCompatibilityRow['proposedAction'] = null
    let reason = 'All fields are classified and compatible.'
    if (executionBlockerCodes.length > 0) {
      resolutionStatus = 'incompatible'
      reason = `Execution compatibility pre-validation blocked this row: ${executionBlockerCodes.join(', ')}.`
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
    const executionBlockerCodes = executionCompatibility.blockerCodesByItem.get(row.itemId) ?? []
    if (existing) {
      return {
        executionBlockerCodes,
        identity: record.identity,
        proposedAction: existing.proposedAction,
        reason: existing.reason,
        resolutionStatus: existing.resolutionStatus,
        sequence: row.sequence,
        targetReview:
          existing.proposedAction === null
            ? null
            : resolvedTargetReview(record, row.currentEffectiveReview, row.itemState),
      }
    }
    if (executionBlockerCodes.length > 0) {
      return {
        executionBlockerCodes,
        identity: record.identity,
        proposedAction: null,
        reason: `Execution compatibility pre-validation blocked this row: ${executionBlockerCodes.join(', ')}.`,
        resolutionStatus: 'incompatible',
        sequence: row.sequence,
        targetReview: null,
      }
    }
    const targetReview = resolvedTargetReview(record, null, row.itemState)
    if (targetReview === null) {
      return {
        executionBlockerCodes,
        identity: record.identity,
        proposedAction: null,
        reason: 'An initial import row contains an unresolved contract field.',
        resolutionStatus: 'incompatible',
        sequence: row.sequence,
        targetReview: null,
      }
    }
    return {
      executionBlockerCodes,
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
    actionCounts,
    artifact,
    existingHeadCohortSha256: cohortDigest,
    existingHeads: [...existingHeadAuditByItem.values()].sort((left, right) =>
      compareMasterRows(left.identity, right.identity),
    ),
    executionCompatibility: executionCompatibility.validation,
    noteDisposition: {
      action: 'preserve_current_authorized_physician_rationale',
      pmids: ['36879724', '39281191'],
      ruleVersion: GOLD_IMPORT_EXISTING_NOTE_DISPOSITION_RULE_VERSION,
      sourceArtifactNotesApplied: false,
      status: 'already_authorized',
    },
    planningRows,
    readyForPackage: actionCounts.unresolved === 0 && actionCounts.incompatible === 0,
    schemaVersion: GOLD_IMPORT_COMPATIBILITY_SCHEMA_VERSION,
  }
}

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

const goldImportSourceAuthorizationScopeSchema = z
  .object({
    datasetSplit: z.literal('development'),
    heldOutIdentitiesAccessed: z.literal(false),
    remoteWritesAllowed: z.literal(false),
    targetDatabase: z.literal('local'),
  })
  .strict()

const goldImportSourceAuthorizationBindingsSchema = compatibilityAuditBindingContextSchema
  .extend({ existingHeadCohortSha256: sha256Schema })
  .strict()

export const goldImportSourceAuthorizationSetV3Schema = z
  .object({
    amendedTwoRowAuthorizationSha256: sha256Schema,
    compatibility: z
      .object({
        actionCounts: compatibilityActionCountsSchema.extend({
          incompatible: z.literal(0),
          unresolved: z.literal(0),
        }),
        bindings: goldImportSourceAuthorizationBindingsSchema,
        booleanNormalizationLedger: z.array(finalizedArtifactBooleanNormalizationSchema).nonempty(),
        booleanNormalizationLedgerSha256: sha256Schema,
        listNormalizationLedger: z.array(finalizedArtifactListNormalizationSchema),
        listNormalizationLedgerSha256: sha256Schema,
        noteDisposition: goldImportExistingNoteDispositionSchema,
        resolutionSchemaVersion: z.literal(GOLD_IMPORT_COMPATIBILITY_SCHEMA_VERSION),
        scope: goldImportSourceAuthorizationScopeSchema,
      })
      .strict(),
    finalArtifactSha256: sha256Schema,
    kind: z.literal('gold_import_source_authorization_set'),
    signedProtocolAuthorizationSha256: sha256Schema,
    sourceDecisionsChanged: z.literal(false),
    version: z.literal(3),
  })
  .strict()

export type GoldImportSourceAuthorizationSetV3 = z.infer<
  typeof goldImportSourceAuthorizationSetV3Schema
>

/** Validate the supplement-free, checksum-bound authorization set before any RPC client exists. */
export function validateGoldImportSourceAuthorizationSetV3(
  input: unknown,
): GoldImportSourceAuthorizationSetV3 {
  const authorizationSet = goldImportSourceAuthorizationSetV3Schema.parse(input)
  const compatibility = authorizationSet.compatibility
  if (
    compatibility.booleanNormalizationLedgerSha256 !==
      sha256Canonical(compatibility.booleanNormalizationLedger) ||
    compatibility.listNormalizationLedgerSha256 !==
      sha256Canonical(compatibility.listNormalizationLedger) ||
    compatibility.bindings.finalV3ArtifactSha256 !== authorizationSet.finalArtifactSha256
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
  const booleanLedgerKeys = new Set<string>()
  for (const entry of compatibility.booleanNormalizationLedger) {
    if (entry.sourceArtifactSha256 !== authorizationSet.finalArtifactSha256) {
      throw new Error('Boolean normalization ledger is bound to a different source artifact.')
    }
    const key = `${entry.sourceIdentity.itemId}:${entry.column}`
    if (booleanLedgerKeys.has(key)) {
      throw new Error('Boolean normalization ledger contains a duplicate.')
    }
    booleanLedgerKeys.add(key)
  }
  const listLedgerKeys = new Set<string>()
  for (const entry of compatibility.listNormalizationLedger) {
    if (entry.sourceArtifactSha256 !== authorizationSet.finalArtifactSha256) {
      throw new Error('List normalization ledger is bound to a different source artifact.')
    }
    const key = `${entry.sourceIdentity.itemId}:${entry.column}`
    if (listLedgerKeys.has(key)) throw new Error('List normalization ledger contains a duplicate.')
    listLedgerKeys.add(key)
  }
  return authorizationSet
}

export type GoldImportSourceAuthorizationSet =
  | z.infer<typeof goldImportSourceAuthorizationSetV1Schema>
  | GoldImportSourceAuthorizationSetV3

export function validateGoldImportSourceAuthorizationSet(
  input: unknown,
  expectedArtifactSha256: string,
): GoldImportSourceAuthorizationSet {
  const container = z
    .object({ version: z.union([z.literal(1), z.literal(2), z.literal(3)]) })
    .passthrough()
    .parse(input)
  if (container.version === 2) {
    throw new Error(
      'Source authorization V2 physician status supplements are retired and cannot authorize import.',
    )
  }
  const authorizationSet =
    container.version === 3
      ? validateGoldImportSourceAuthorizationSetV3(input)
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
 * Revalidate every V3 normalization and state-binding claim against the parsed import plan and
 * unchanged artifact.
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
  const artifact = parseFinalizedGoldImportArtifact(input.finalizedArtifact, {
    expectedArtifactSha256: input.plan.sourceArtifactSha256,
  })
  if (authorizationSet.version === 1) {
    if (
      artifact.listNormalizations.length > 0 ||
      artifact.booleanNormalizations.some((entry) => entry.sourceForm === 'legacy_title_case')
    ) {
      throw new Error(
        'Source authorization V1 cannot authorize finalized-artifact lexical normalization.',
      )
    }
    return authorizationSet
  }

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

  if (
    canonicalJson(compatibility.booleanNormalizationLedger) !==
    canonicalJson(artifact.booleanNormalizations)
  ) {
    throw new Error(
      'Source authorization boolean normalization ledger does not exactly match the finalized artifact.',
    )
  }
  if (
    canonicalJson(compatibility.listNormalizationLedger) !==
    canonicalJson(artifact.listNormalizations)
  ) {
    throw new Error(
      'Source authorization list normalization ledger does not exactly match the finalized artifact.',
    )
  }

  const expectedCurrentDatabaseBinding = {
    batchId: input.plan.batchId,
    developmentMembershipSha256: input.plan.scope.developmentMembershipSha256,
    effectiveStateSha256: input.plan.expectedEffectiveStateSha256,
    physicalStateSha256: input.plan.expectedPhysicalStateSha256,
  }
  const authorizedCurrentDatabaseBinding = {
    batchId: compatibility.bindings.currentDatabase.batchId,
    developmentMembershipSha256: compatibility.bindings.currentDatabase.developmentMembershipSha256,
    effectiveStateSha256: compatibility.bindings.currentDatabase.effectiveStateSha256,
    physicalStateSha256: compatibility.bindings.currentDatabase.physicalStateSha256,
  }
  if (
    canonicalJson(authorizedCurrentDatabaseBinding) !==
    canonicalJson(expectedCurrentDatabaseBinding)
  ) {
    throw new Error(
      'Source authorization compatibility state is stale relative to the import plan current-state bindings.',
    )
  }
  if (
    compatibility.bindings.finalV3ArtifactSha256 !== artifact.artifactSha256 ||
    compatibility.bindings.migration.id !== input.plan.executionContext.migrationId ||
    compatibility.scope.datasetSplit !== input.plan.scope.datasetSplit ||
    compatibility.scope.heldOutIdentitiesAccessed !== input.plan.scope.heldOutIdentitiesAccessed ||
    compatibility.scope.remoteWritesAllowed !== input.plan.executionContext.remoteWritesAllowed ||
    compatibility.scope.targetDatabase !== input.plan.executionContext.targetDatabase
  ) {
    throw new Error(
      'Source authorization compatibility scope does not match the import plan and artifact.',
    )
  }
  return authorizationSet
}
