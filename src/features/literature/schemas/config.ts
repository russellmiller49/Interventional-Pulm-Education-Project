import { z } from 'zod'

import { literatureManifestStatuses, literatureSourceKinds } from '@/features/literature/constants'

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date in YYYY-MM-DD format.')

const nullableTextSchema = z.string().trim().min(1).nullable()

export const literatureManifestFileSchema = z
  .object({
    path: z.string().trim().min(1).max(4_096),
    source_kind: z.enum(literatureSourceKinds),
    source_id: nullableTextSchema,
    query_id: nullableTextSchema,
    date_from: isoDateSchema.nullable(),
    date_to: isoDateSchema.nullable(),
    status: z.enum(literatureManifestStatuses),
    notes: z.string().max(2_000).nullable(),
  })
  .superRefine((entry, context) => {
    if (entry.date_from && entry.date_to && entry.date_from > entry.date_to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`date_from` must not be later than `date_to`.',
        path: ['date_to'],
      })
    }

    if (entry.status === 'needs_mapping') {
      if (entry.source_kind !== 'unmapped') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A needs-mapping entry must use source_kind "unmapped".',
          path: ['source_kind'],
        })
      }
      if (entry.source_id !== null || entry.query_id !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A needs-mapping entry cannot claim a source or query ID.',
          path: ['status'],
        })
      }
    }

    if (
      entry.status === 'mapped' &&
      (entry.source_kind === 'unmapped' || (!entry.source_id && !entry.query_id))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A mapped entry needs a known source kind and a source or query ID.',
        path: ['status'],
      })
    }
  })

export const literatureImportManifestSchema = z
  .object({
    manifest_version: z.string().trim().min(1).max(40),
    query_registry_version: z.string().trim().min(1).max(40),
    notes: z.string().max(4_000).optional(),
    files: z.array(literatureManifestFileSchema).min(1),
  })
  .superRefine((manifest, context) => {
    const paths = new Set<string>()
    manifest.files.forEach((entry, index) => {
      if (paths.has(entry.path)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Manifest paths must be unique.',
          path: ['files', index, 'path'],
        })
      }
      paths.add(entry.path)
    })
  })

const journalRegistryEntrySchema = z.object({
  id: z.string().trim().min(1),
  display_name: z.string().trim().min(1),
  pubmed_abbreviation: z.string().trim().min(1),
  query_term: z.string().trim().min(1),
  nlm_id: z.string().trim().min(1),
  issn_print: nullableTextSchema,
  issn_online: nullableTextSchema,
  tier: z.string().trim().min(1),
  notes: z.string().optional(),
})

const nonPubmedSourceSchema = z.object({
  id: z.string().trim().min(1),
  display_name: z.string().trim().min(1),
  source_type: z.string().trim().min(1),
  pubmed_query_term: z.string().nullable(),
  nlm_id: z.string().optional(),
  issn_print: nullableTextSchema.optional(),
  issn_online: nullableTextSchema.optional(),
  tier: z.string().trim().min(1),
  start_year: z.number().int().optional(),
  end_year: z.number().int().optional(),
  project_start_year: z.number().int().optional(),
  notes: z.string().optional(),
})

export const literatureQueryRegistrySchema = z.object({
  registry_version: z.string().trim().min(1),
  prepared_date: isoDateSchema,
  date_filter: z.string().trim().min(1),
  field_tags: z.record(z.string(), z.string()),
  core_journals: z.array(journalRegistryEntrySchema),
  optional_continuity_journals: z.array(journalRegistryEntrySchema),
  expanded_journals: z.array(journalRegistryEntrySchema),
  non_pubmed_sources: z.array(nonPubmedSourceSchema),
  blocks: z.record(z.string(), z.string()),
  queries: z.record(z.string(), z.string()),
  discovery_queries: z.array(
    z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      seed_topics: z.array(z.string().trim().min(1)),
      cadence: z.string().trim().min(1),
      precision_profile: z.string().trim().min(1),
      query_body: z.string().trim().min(1),
      backfill_query: z.string().trim().min(1),
    }),
  ),
  implementation_rules: z.array(z.string().trim().min(1)),
})

export const literatureTaxonomyTopicSchema: z.ZodType<{
  id: string
  label_en: string
  description_en?: string
  label_es?: string
  label_zh_cn?: string
  synonyms?: string[]
  children?: Array<{
    id: string
    label_en: string
    description_en?: string
    label_es?: string
    label_zh_cn?: string
    synonyms?: string[]
  }>
}> = z.object({
  id: z.string().trim().min(1),
  label_en: z.string().trim().min(1),
  description_en: z.string().optional(),
  label_es: z.string().optional(),
  label_zh_cn: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
  children: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label_en: z.string().trim().min(1),
        description_en: z.string().optional(),
        label_es: z.string().optional(),
        label_zh_cn: z.string().optional(),
        synonyms: z.array(z.string()).optional(),
      }),
    )
    .optional(),
})

export const literatureTaxonomySchema = z
  .object({
    taxonomy_version: z.string().trim().min(1),
    prepared_date: isoDateSchema,
    principles: z.object({
      multi_label: z.boolean(),
      stable_ids: z.boolean(),
      query_matches_are_suggestions_only: z.boolean(),
      human_decisions_override_automation: z.boolean(),
    }),
    topics: z.array(literatureTaxonomyTopicSchema).min(1),
    facets: z.object({
      study_design: z.array(z.string()),
      clinical_purpose: z.array(z.string()),
      disease: z.array(z.string()),
      population: z.array(z.string()),
      publication_class: z.array(z.string()),
    }),
  })
  .superRefine((taxonomy, context) => {
    const ids = new Set<string>()
    const nodes = taxonomy.topics.flatMap((topic) => [topic, ...(topic.children ?? [])])
    nodes.forEach((node, index) => {
      if (ids.has(node.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate taxonomy ID: ${node.id}`,
          path: ['topics', index, 'id'],
        })
      }
      ids.add(node.id)
    })
  })

export const literatureTopicRulesSchema = z.object({
  rule_version: z.string().trim().min(1),
  normalization: z.literal('unicode_nfkd_lowercase_whitespace_v1'),
  query_topic_aliases: z.record(z.string(), z.string().trim().min(1)),
  rules: z.array(
    z.object({
      id: z.string().trim().min(1),
      topic_id: z.string().trim().min(1),
      confidence: z.number().min(0).max(1),
      any_terms: z.array(z.string().trim().min(1)).min(1),
      all_term_groups: z.array(z.array(z.string().trim().min(1)).min(1)),
      none_terms: z.array(z.string().trim().min(1)),
    }),
  ),
})

const goldSetLabelOptionSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9_-]*$/u),
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2_000).optional(),
})

export const literatureGoldSetLabelsSchema = z
  .object({
    label_schema_version: z.string().trim().min(1).max(40),
    relevance_definition_version: z.string().trim().min(1).max(40),
    relevance_labels: z.array(goldSetLabelOptionSchema).length(4),
    metadata_sufficiency_labels: z.array(goldSetLabelOptionSchema).length(4),
    reviewer_confidence_labels: z.array(goldSetLabelOptionSchema).length(3),
    technology_tags: z.array(goldSetLabelOptionSchema).min(1),
  })
  .superRefine((config, context) => {
    const expected = {
      relevance_labels: ['include_core', 'include_adjacent', 'exclude', 'uncertain'],
      metadata_sufficiency_labels: [
        'adequate_abstract',
        'limited_abstract',
        'no_abstract',
        'conflicting_metadata',
      ],
      reviewer_confidence_labels: ['high', 'moderate', 'low'],
    } as const

    for (const [field, expectedIds] of Object.entries(expected)) {
      const actualIds = new Set(config[field as keyof typeof expected].map((option) => option.id))
      expectedIds.forEach((id) => {
        if (!actualIds.has(id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Missing required gold-set label: ${id}`,
            path: [field],
          })
        }
      })
    }

    const technologyIds = config.technology_tags.map((option) => option.id)
    if (new Set(technologyIds).size !== technologyIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gold-set technology tag IDs must be unique.',
        path: ['technology_tags'],
      })
    }
  })

export const literatureTaxonomyVersionSchema = z.union([z.literal('1.1.0'), z.literal('2.0.0')])

export const literatureEnrichmentLabelSchemaVersionSchema = z.literal('2.0.0')

export const literatureEnrichmentFieldSchema = z.enum([
  'topic_ids',
  'technology_tags',
  'clinical_purposes',
  'disease_tags',
  'study_design',
  'publication_status',
])

const kebabCaseControlledIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, 'Controlled IDs must use stable lowercase kebab-case.')

const v2TaxonomyChildIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)?$/u,
    'Taxonomy child IDs must use lowercase kebab-case segments.',
  )

const literatureTaxonomyTopicV2Schema = z
  .object({
    id: kebabCaseControlledIdSchema,
    label_en: z.string().trim().min(1),
    description_en: z.string().trim().min(1).optional(),
    label_es: z.string().trim().min(1).optional(),
    label_zh_cn: z.string().trim().min(1).optional(),
    synonyms: z.array(z.string().trim().min(1)).optional(),
    children: z
      .array(
        z
          .object({
            id: v2TaxonomyChildIdSchema,
            label_en: z.string().trim().min(1),
            description_en: z.string().trim().min(1).optional(),
            label_es: z.string().trim().min(1).optional(),
            label_zh_cn: z.string().trim().min(1).optional(),
            synonyms: z.array(z.string().trim().min(1)).optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()

const v2FacetValuesSchema = z.array(kebabCaseControlledIdSchema)

/**
 * The v2 schema is intentionally separate and strict. The historical
 * `literatureTaxonomySchema` above remains the permissive v1 contract.
 */
export const literatureTaxonomyV2Schema = z
  .object({
    taxonomy_version: z.literal('2.0.0'),
    prepared_date: isoDateSchema,
    principles: z
      .object({
        multi_label: z.boolean(),
        stable_ids: z.boolean(),
        query_matches_are_suggestions_only: z.boolean(),
        human_decisions_override_automation: z.boolean(),
      })
      .strict(),
    topics: z.array(literatureTaxonomyTopicV2Schema).min(1),
    facets: z
      .object({
        study_design: v2FacetValuesSchema,
        clinical_purpose: v2FacetValuesSchema,
        disease: v2FacetValuesSchema,
        population: v2FacetValuesSchema,
        publication_class: v2FacetValuesSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((taxonomy, context) => {
    const ids = new Set<string>()
    taxonomy.topics.forEach((topic, topicIndex) => {
      if (ids.has(topic.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate taxonomy ID: ${topic.id}`,
          path: ['topics', topicIndex, 'id'],
        })
      }
      ids.add(topic.id)

      topic.children?.forEach((child, childIndex) => {
        if (!child.id.startsWith(`${topic.id}.`)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Taxonomy child ID ${child.id} must be namespaced under ${topic.id}.`,
            path: ['topics', topicIndex, 'children', childIndex, 'id'],
          })
        }
        if (ids.has(child.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate taxonomy ID: ${child.id}`,
            path: ['topics', topicIndex, 'children', childIndex, 'id'],
          })
        }
        ids.add(child.id)
      })
    })

    for (const [field, values] of Object.entries(taxonomy.facets)) {
      const seen = new Set<string>()
      values.forEach((value, index) => {
        if (seen.has(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate ${field} ID: ${value}`,
            path: ['facets', field, index],
          })
        }
        seen.add(value)
      })
    }
  })

function createLiteratureEnrichmentTermSchema(idSchema: z.ZodType<string>) {
  return z
    .object({
      id: idSchema,
      label_en: z.string().trim().min(1).max(160),
      description_en: z.string().trim().min(1).max(2_000),
      introduced_in: literatureTaxonomyVersionSchema,
      inclusion_boundary_en: z.string().trim().min(1).max(2_000).optional(),
      exclusion_boundary_en: z.string().trim().min(1).max(2_000).optional(),
      examples_en: z.array(z.string().trim().min(1).max(500)).min(1).optional(),
      label_es: z.string().trim().min(1).max(160).optional(),
      description_es: z.string().trim().min(1).max(2_000).optional(),
      label_zh_cn: z.string().trim().min(1).max(160).optional(),
      description_zh_cn: z.string().trim().min(1).max(2_000).optional(),
      label_ar: z.string().trim().min(1).max(160).optional(),
      description_ar: z.string().trim().min(1).max(2_000).optional(),
      label_ko: z.string().trim().min(1).max(160).optional(),
      description_ko: z.string().trim().min(1).max(2_000).optional(),
    })
    .strict()
    .superRefine((term, context) => {
      if (term.introduced_in !== '2.0.0') {
        return
      }
      for (const field of [
        'inclusion_boundary_en',
        'exclusion_boundary_en',
        'examples_en',
      ] as const) {
        if (term[field] === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `V2 term ${term.id} requires ${field}.`,
            path: [field],
          })
        }
      }
    })
}

const literatureEnrichmentTermSchema = createLiteratureEnrichmentTermSchema(
  kebabCaseControlledIdSchema,
)

const optionalTagStatusLabelSchema = z
  .object({
    id: z.enum(['tagged', 'not_applicable', 'not_assessable', 'legacy_unspecified']),
    label_en: z.string().trim().min(1).max(160),
    description_en: z.string().trim().min(1).max(2_000),
    compatibility_only: z.boolean(),
  })
  .strict()

const enrichmentFieldsSchema = z
  .object({
    topic_ids: z.array(literatureEnrichmentTermSchema).min(1),
    technology_tags: z.array(literatureEnrichmentTermSchema).min(1),
    clinical_purposes: z.array(literatureEnrichmentTermSchema).min(1),
    disease_tags: z.array(literatureEnrichmentTermSchema).min(1),
    study_design: z.array(literatureEnrichmentTermSchema).min(1),
    publication_status: z.array(literatureEnrichmentTermSchema).min(1),
  })
  .strict()

export const literatureEnrichmentLabelsV2Schema = z
  .object({
    label_schema_version: z.literal('2.0.0'),
    taxonomy_version: z.literal('2.0.0'),
    default_locale: z.literal('en'),
    fallback_locale: z.literal('en'),
    localization_status: z
      .object({
        english: z.literal('complete'),
        translations: z.literal('pending_human_review'),
        fallback_behavior: z.string().trim().min(1),
      })
      .strict(),
    fields: enrichmentFieldsSchema,
    optional_tag_statuses: z.array(optionalTagStatusLabelSchema).length(4),
  })
  .strict()
  .superRefine((labels, context) => {
    for (const [field, terms] of Object.entries(labels.fields)) {
      const seen = new Set<string>()
      terms.forEach((term, index) => {
        if (seen.has(term.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate ${field} ID: ${term.id}`,
            path: ['fields', field, index, 'id'],
          })
        }
        seen.add(term.id)
      })
    }

    const expectedStatuses = new Set([
      'tagged',
      'not_applicable',
      'not_assessable',
      'legacy_unspecified',
    ])
    const seenStatuses = new Set<string>()
    labels.optional_tag_statuses.forEach((status, index) => {
      if (seenStatuses.has(status.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate optional tag status ID: ${status.id}`,
          path: ['optional_tag_statuses', index, 'id'],
        })
      }
      seenStatuses.add(status.id)
      expectedStatuses.delete(status.id)
      const expectedCompatibilityOnly = status.id === 'legacy_unspecified'
      if (status.compatibility_only !== expectedCompatibilityOnly) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${status.id} compatibility_only must be ${expectedCompatibilityOnly}.`,
          path: ['optional_tag_statuses', index, 'compatibility_only'],
        })
      }
    })
    for (const missing of expectedStatuses) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Missing optional tag status ID: ${missing}`,
        path: ['optional_tag_statuses'],
      })
    }
  })

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u, 'Expected a lowercase SHA-256 digest.')

const adoptionStringArraySchema = z.array(z.string().trim().min(1))

export const literatureEnrichmentTaxonomyAdoptionV2Schema = z
  .object({
    report_version: z.literal('2.0.0'),
    taxonomy_version: z.literal('2.0.0'),
    label_schema_version: z.literal('2.0.0'),
    source_artifacts: z
      .array(
        z
          .object({
            artifact: z.string().trim().min(1),
            location: z.string().trim().min(1),
            sha256: sha256Schema,
          })
          .strict(),
      )
      .min(1),
    proposals: z.array(
      z
        .object({
          proposal_id: z.string().trim().min(1),
          sources: z
            .array(
              z
                .object({
                  artifact: z.string().trim().min(1),
                  location: z.string().trim().min(1),
                  source_term: z.string().trim().min(1),
                })
                .strict(),
            )
            .min(1),
          field: literatureEnrichmentFieldSchema,
          proposed_id: kebabCaseControlledIdSchema,
          label: z.string().trim().min(1),
          count: z.number().int().nonnegative(),
          example_pmids: adoptionStringArraySchema,
          example_master_row_ids: adoptionStringArraySchema,
          exact_equivalents: adoptionStringArraySchema,
          near_equivalents: adoptionStringArraySchema,
          decision: z.enum(['adopt', 'map_to_existing', 'merge_with_another_proposal', 'defer']),
          rationale: z.string().trim().min(1),
          replacement_ids: adoptionStringArraySchema,
          definition: z.string().trim().min(1),
          inclusion_boundary: z.string().trim().min(1),
          exclusion_boundary: z.string().trim().min(1),
          examples: z.array(z.string().trim().min(1)).min(1),
        })
        .strict(),
    ),
    migration_mappings: z.array(
      z
        .object({
          field: literatureEnrichmentFieldSchema,
          source_id: z.string().trim().min(1),
          replacement_ids: adoptionStringArraySchema,
          mapping_type: z.enum(['alias', 'merge', 'split', 'deferred']),
          automatic: z.literal(false),
          rationale: z.string().trim().min(1),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((report, context) => {
    const sourceArtifacts = new Set<string>()
    report.source_artifacts.forEach((artifact, index) => {
      if (sourceArtifacts.has(artifact.artifact)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate source artifact: ${artifact.artifact}`,
          path: ['source_artifacts', index, 'artifact'],
        })
      }
      sourceArtifacts.add(artifact.artifact)
    })

    const proposals = new Set<string>()
    report.proposals.forEach((proposal, index) => {
      if (proposals.has(proposal.proposal_id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate proposal ID: ${proposal.proposal_id}`,
          path: ['proposals', index, 'proposal_id'],
        })
      }
      proposals.add(proposal.proposal_id)

      proposal.sources.forEach((source, sourceIndex) => {
        if (!sourceArtifacts.has(source.artifact)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Proposal ${proposal.proposal_id} references unknown source artifact: ${source.artifact}`,
            path: ['proposals', index, 'sources', sourceIndex, 'artifact'],
          })
        }
      })

      if (
        (proposal.decision === 'map_to_existing' ||
          proposal.decision === 'merge_with_another_proposal') &&
        proposal.replacement_ids.length === 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Proposal ${proposal.proposal_id} requires at least one replacement ID.`,
          path: ['proposals', index, 'replacement_ids'],
        })
      }
    })

    const mappings = new Set<string>()
    report.migration_mappings.forEach((mapping, index) => {
      const key = `${mapping.field}:${mapping.source_id}`
      if (mappings.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate migration mapping: ${key}`,
          path: ['migration_mappings', index, 'source_id'],
        })
      }
      mappings.add(key)
      if (mapping.mapping_type !== 'deferred' && mapping.replacement_ids.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Migration ${key} requires at least one replacement ID.`,
          path: ['migration_mappings', index, 'replacement_ids'],
        })
      }
    })

    report.proposals.forEach((proposal, index) => {
      if (proposal.decision === 'adopt') return
      const mapping = report.migration_mappings.find(
        (candidate) =>
          candidate.field === proposal.field && candidate.source_id === proposal.proposed_id,
      )
      if (!mapping) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Proposal ${proposal.proposal_id} requires an explicit migration mapping.`,
          path: ['proposals', index, 'proposed_id'],
        })
        return
      }
      const validMapping =
        (proposal.decision === 'map_to_existing' && mapping.mapping_type === 'alias') ||
        (proposal.decision === 'merge_with_another_proposal' &&
          (mapping.mapping_type === 'merge' || mapping.mapping_type === 'split')) ||
        (proposal.decision === 'defer' && mapping.mapping_type === 'deferred')
      if (!validMapping) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Proposal ${proposal.proposal_id} has incompatible migration type: ${mapping.mapping_type}`,
          path: ['proposals', index, 'decision'],
        })
      }
    })
  })

export type LiteratureImportManifest = z.infer<typeof literatureImportManifestSchema>
export type LiteratureManifestFile = z.infer<typeof literatureManifestFileSchema>
export type LiteratureQueryRegistry = z.infer<typeof literatureQueryRegistrySchema>
export type LiteratureTaxonomy = z.infer<typeof literatureTaxonomySchema>
export type LiteratureTaxonomyV1 = Omit<LiteratureTaxonomy, 'taxonomy_version'> & {
  taxonomy_version: '1.1.0'
}
export type LiteratureTopicRules = z.infer<typeof literatureTopicRulesSchema>
export type LiteratureGoldSetLabels = z.infer<typeof literatureGoldSetLabelsSchema>
export type LiteratureTaxonomyVersion = z.infer<typeof literatureTaxonomyVersionSchema>
export type LiteratureTaxonomyV2 = z.infer<typeof literatureTaxonomyV2Schema>
export type LiteratureEnrichmentField = z.infer<typeof literatureEnrichmentFieldSchema>
export type LiteratureEnrichmentLabelsV2 = z.infer<typeof literatureEnrichmentLabelsV2Schema>
export type LiteratureEnrichmentTaxonomyAdoptionV2 = z.infer<
  typeof literatureEnrichmentTaxonomyAdoptionV2Schema
>
