import { z } from 'zod'

import {
  loadLiteratureEnrichmentLabels,
  loadLiteratureTaxonomy,
  type LiteratureEnrichmentLabelLookup,
} from '@/features/literature/config'
import type {
  LiteratureEnrichmentField,
  LiteratureEnrichmentTaxonomyAdoptionV2,
} from '@/features/literature/schemas/config'

export const literatureEnrichmentSchemaVersions = ['2.0.0'] as const
export const literatureOptionalTagStatusesV2 = [
  'tagged',
  'not_applicable',
  'not_assessable',
] as const
export const literatureOptionalTagStatusesWithLegacy = [
  ...literatureOptionalTagStatusesV2,
  'legacy_unspecified',
] as const

export type LiteratureEnrichmentSchemaVersion = (typeof literatureEnrichmentSchemaVersions)[number]
export type LiteratureOptionalTagStatusV2 = (typeof literatureOptionalTagStatusesV2)[number]
export type LiteratureOptionalTagStatusWithLegacy =
  (typeof literatureOptionalTagStatusesWithLegacy)[number]

const positiveDecimalIdentitySchema = z
  .string()
  .regex(/^[1-9][0-9]*$/u, 'Expected a positive decimal identifier.')
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u, 'Expected a lowercase SHA-256 digest.')

const labelsV2 = loadLiteratureEnrichmentLabels('2.0.0')
const taxonomyV2 = loadLiteratureTaxonomy('2.0.0')

const controlledIds = Object.fromEntries(
  Object.entries(labelsV2.fields).map(([field, terms]) => [
    field,
    new Set(terms.map((term) => term.id)),
  ]),
) as Record<LiteratureEnrichmentField, Set<string>>

// Artifact topic assignments intentionally remain broad/root-only. Child
// topic labels exist for display and taxonomy completeness, not row tagging.
controlledIds.topic_ids = new Set(taxonomyV2.topics.map((topic) => topic.id))

function controlledValueSchema(field: LiteratureEnrichmentField) {
  return z
    .string()
    .trim()
    .min(1)
    .superRefine((value, context) => {
      if (!controlledIds[field].has(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported ${field} value: ${JSON.stringify(value)}`,
        })
      }
    })
}

function uniqueControlledArraySchema(field: LiteratureEnrichmentField, requireValue: boolean) {
  const schema = z.array(controlledValueSchema(field)).superRefine((values, context) => {
    const seen = new Set<string>()
    values.forEach((value, index) => {
      if (seen.has(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate ${field} value: ${JSON.stringify(value)}`,
          path: [index],
        })
      }
      seen.add(value)
    })
  })
  return requireValue ? schema.pipe(z.array(z.string()).min(1)) : schema
}

const optionalTagStatusV2Schema = z.enum(literatureOptionalTagStatusesV2)

export const literatureEnrichmentRecordV2Schema = z
  .object({
    master_row_id: positiveDecimalIdentitySchema,
    pmid: positiveDecimalIdentitySchema,
    topic_ids: uniqueControlledArraySchema('topic_ids', true),
    technology_tags: uniqueControlledArraySchema('technology_tags', false),
    technology_tag_status: optionalTagStatusV2Schema,
    clinical_purposes: uniqueControlledArraySchema('clinical_purposes', true),
    disease_tags: uniqueControlledArraySchema('disease_tags', false),
    disease_tag_status: optionalTagStatusV2Schema,
    study_design: controlledValueSchema('study_design'),
    publication_status: controlledValueSchema('publication_status'),
  })
  .strict()
  .superRefine((record, context) => {
    for (const { tagsField, statusField } of [
      { tagsField: 'technology_tags', statusField: 'technology_tag_status' },
      { tagsField: 'disease_tags', statusField: 'disease_tag_status' },
    ] as const) {
      const tags = record[tagsField]
      const status = record[statusField]
      if (tags.length > 0 && status !== 'tagged') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${statusField} must be "tagged" when ${tagsField} is nonempty.`,
          path: [statusField],
        })
      }
      if (tags.length === 0 && status === 'tagged') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${statusField} must be "not_applicable" or "not_assessable" when ${tagsField} is empty.`,
          path: [statusField],
        })
      }
    }
  })

export const literatureEnrichmentArtifactV2Schema = z
  .object({
    enrichment_schema_version: z.literal('2.0.0'),
    taxonomy_version: z.literal('2.0.0'),
    record_scope: z.literal('physician-included-records'),
    source_physician_fields_sha256: sha256Schema,
    records: z.array(literatureEnrichmentRecordV2Schema),
  })
  .strict()
  .superRefine((artifact, context) => {
    const masterRowIds = new Set<string>()
    const pmids = new Set<string>()
    artifact.records.forEach((record, index) => {
      if (masterRowIds.has(record.master_row_id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate master_row_id: ${record.master_row_id}`,
          path: ['records', index, 'master_row_id'],
        })
      }
      masterRowIds.add(record.master_row_id)
      if (pmids.has(record.pmid)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate pmid: ${record.pmid}`,
          path: ['records', index, 'pmid'],
        })
      }
      pmids.add(record.pmid)
    })
  })

export type LiteratureEnrichmentRecordV2 = z.infer<typeof literatureEnrichmentRecordV2Schema>
export type LiteratureEnrichmentArtifactV2 = z.infer<typeof literatureEnrichmentArtifactV2Schema>

export interface LiteratureEnrichmentRecordV1Compatible {
  master_row_id: string
  pmid: string
  topic_ids: string[]
  technology_tags: string[]
  technology_tag_status: 'tagged' | 'legacy_unspecified'
  clinical_purposes: string[]
  disease_tags: string[]
  disease_tag_status: 'tagged' | 'legacy_unspecified'
  study_design: string
  publication_status: string
}

type LiteratureEnrichmentRecordV1Input = Omit<
  LiteratureEnrichmentRecordV1Compatible,
  'technology_tag_status' | 'disease_tag_status'
>

/**
 * Adds compatibility-only statuses without claiming that an old blank array
 * was not applicable or not assessable.
 */
export function adaptLiteratureEnrichmentRecordV1(
  record: LiteratureEnrichmentRecordV1Input,
): LiteratureEnrichmentRecordV1Compatible {
  return {
    ...record,
    technology_tag_status: record.technology_tags.length > 0 ? 'tagged' : 'legacy_unspecified',
    disease_tag_status: record.disease_tags.length > 0 ? 'tagged' : 'legacy_unspecified',
  }
}

function compareDecimalIdentity(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length
  if (left === right) return 0
  return left < right ? -1 : 1
}

function compareControlledId(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

/** Serializes validated v2 data with canonical record, key, and array ordering. */
export function serializeLiteratureEnrichmentArtifactV2(input: unknown): string {
  const artifact = literatureEnrichmentArtifactV2Schema.parse(input)
  const records = artifact.records
    .map((record) => ({
      master_row_id: record.master_row_id,
      pmid: record.pmid,
      topic_ids: [...record.topic_ids].sort(compareControlledId),
      technology_tags: [...record.technology_tags].sort(compareControlledId),
      technology_tag_status: record.technology_tag_status,
      clinical_purposes: [...record.clinical_purposes].sort(compareControlledId),
      disease_tags: [...record.disease_tags].sort(compareControlledId),
      disease_tag_status: record.disease_tag_status,
      study_design: record.study_design,
      publication_status: record.publication_status,
    }))
    .sort(
      (left, right) =>
        compareDecimalIdentity(left.master_row_id, right.master_row_id) ||
        compareDecimalIdentity(left.pmid, right.pmid),
    )

  return `${JSON.stringify(
    {
      enrichment_schema_version: '2.0.0',
      taxonomy_version: '2.0.0',
      record_scope: 'physician-included-records',
      source_physician_fields_sha256: artifact.source_physician_fields_sha256,
      records,
    },
    null,
    2,
  )}\n`
}

export interface LiteratureEnrichmentMigrationResolution {
  field: LiteratureEnrichmentField
  sourceId: string
  replacementIds: string[]
  mappingType: 'alias' | 'merge' | 'split'
  automatic: false
  rationale: string
}

/** Resolves only mappings explicitly recorded in a caller-supplied adoption report. */
export function resolveLiteratureEnrichmentMigration(
  report: LiteratureEnrichmentTaxonomyAdoptionV2,
  field: LiteratureEnrichmentField,
  sourceId: string,
): LiteratureEnrichmentMigrationResolution {
  const mapping = report.migration_mappings.find(
    (candidate) => candidate.field === field && candidate.source_id === sourceId,
  )
  if (!mapping) {
    throw new Error(`No explicit migration mapping for ${field} value: ${sourceId}`)
  }
  if (mapping.mapping_type === 'deferred') {
    throw new Error(`Migration mapping for ${field} value ${sourceId} is deferred.`)
  }
  return {
    field,
    sourceId,
    replacementIds: [...mapping.replacement_ids],
    mappingType: mapping.mapping_type,
    automatic: mapping.automatic,
    rationale: mapping.rationale,
  }
}

export function resolveLiteratureEnrichmentAlias(
  report: LiteratureEnrichmentTaxonomyAdoptionV2,
  field: LiteratureEnrichmentField,
  sourceId: string,
): string[] {
  const resolution = resolveLiteratureEnrichmentMigration(report, field, sourceId)
  if (resolution.mappingType !== 'alias') {
    throw new Error(`Migration mapping for ${field} value ${sourceId} is not an alias.`)
  }
  return resolution.replacementIds
}

// Re-export the lookup return type alongside the artifact contract for callers
// that keep all enrichment-specific imports in this module.
export type { LiteratureEnrichmentLabelLookup }
