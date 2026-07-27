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

export type LiteratureImportManifest = z.infer<typeof literatureImportManifestSchema>
export type LiteratureManifestFile = z.infer<typeof literatureManifestFileSchema>
export type LiteratureQueryRegistry = z.infer<typeof literatureQueryRegistrySchema>
export type LiteratureTaxonomy = z.infer<typeof literatureTaxonomySchema>
export type LiteratureTopicRules = z.infer<typeof literatureTopicRulesSchema>
