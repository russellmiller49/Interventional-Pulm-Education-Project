import { z } from 'zod'

export const SHADOW_RD_CORPUS_INVENTORY_SCHEMA_VERSION =
  'literature-shadow-rd-corpus-inventory/1.0.0' as const
export const SHADOW_RD_CORPUS_INVENTORY_QUERY_ID =
  'literature-shadow-rd-fixed-local-aggregate-inventory/1.0.0' as const
export const SHADOW_RD_DEVELOPMENT_BATCH_ID = 'fff41ba3-811d-4d28-ba73-9302db3a942a' as const
export const SHADOW_RD_DEVELOPMENT_BATCH_NAME = 'gold-set-v1' as const
export const SHADOW_RD_DEVELOPMENT_EXPECTED_COUNT = 630 as const
export const SHADOW_RD_DEVELOPMENT_MEMBERSHIP_SHA256 =
  '73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c' as const
export const SHADOW_RD_SEALED_EVALUATION_EXPECTED_COUNT = 270 as const
export const SHADOW_RD_MINIMUM_CELL_SIZE = 5 as const
export const SHADOW_RD_QUERY_REGISTRY_VERSION = '1.0.0' as const
export const SHADOW_RD_QUERY_REGISTRY_CONTENT_SHA256 =
  '45c2f0b72deb6dee54cb5b7081fea520bc7b463c12369d972e05e3ff82204a50' as const
export const SHADOW_RD_REGISTERED_SOURCE_IDENTITY_COUNT = 43 as const

const nonNegativeIntegerSchema = z.number().int().nonnegative()
const percentageSchema = z.number().min(0).max(100)

const countCellSchema = z
  .object({
    count: nonNegativeIntegerSchema,
    value: z.string().min(1),
  })
  .strict()

const completenessSchema = z
  .object({
    completeCount: nonNegativeIntegerSchema,
    completionPercent: percentageSchema,
    missingCount: nonNegativeIntegerSchema,
  })
  .strict()

const suppressedDistributionSchema = z
  .object({
    minimumCellSize: z.literal(SHADOW_RD_MINIMUM_CELL_SIZE),
    suppressed: z
      .object({
        cellCount: nonNegativeIntegerSchema,
        recordCount: nonNegativeIntegerSchema,
      })
      .strict(),
    visible: z.array(
      countCellSchema.refine((cell) => cell.count >= SHADOW_RD_MINIMUM_CELL_SIZE, {
        message: `Visible development cells must contain at least ${SHADOW_RD_MINIMUM_CELL_SIZE} records.`,
      }),
    ),
  })
  .strict()

const shadowRdCorpusInventoryQueryPayloadObjectSchema = z
  .object({
    capturedAt: z.string().datetime(),
    developmentCohort: z
      .object({
        assertedCount: z.literal(SHADOW_RD_DEVELOPMENT_EXPECTED_COUNT),
        batchId: z.literal(SHADOW_RD_DEVELOPMENT_BATCH_ID),
        batchName: z.literal(SHADOW_RD_DEVELOPMENT_BATCH_NAME),
        crossTabs: z
          .object({
            articleRelevanceState: suppressedDistributionSchema,
            publicationYear: suppressedDistributionSchema,
          })
          .strict(),
        datasetSplit: z.literal('development'),
        expectedCount: z.literal(SHADOW_RD_DEVELOPMENT_EXPECTED_COUNT),
        generalCorpusOverlapCount: z.literal(SHADOW_RD_DEVELOPMENT_EXPECTED_COUNT),
        membershipSha256: z.literal(SHADOW_RD_DEVELOPMENT_MEMBERSHIP_SHA256),
        observedCount: z.literal(SHADOW_RD_DEVELOPMENT_EXPECTED_COUNT),
        physicianReviewedCurrentEffectiveCount: nonNegativeIntegerSchema.max(
          SHADOW_RD_DEVELOPMENT_EXPECTED_COUNT,
        ),
      })
      .strict(),
    generalCorpus: z
      .object({
        completeness: z
          .object({
            abstract: completenessSchema,
            authorKeywords: completenessSchema,
            languages: completenessSchema,
            meshTerms: completenessSchema,
            title: completenessSchema,
          })
          .strict(),
        correctionCount: nonNegativeIntegerSchema,
        duplicateAndCollisionIndicators: z
          .object({
            articlesInDuplicateNormalizedTitleGroups: nonNegativeIntegerSchema,
            doiCollisionGroupCount: nonNegativeIntegerSchema,
            metadataHashCollisionGroupCount: nonNegativeIntegerSchema,
            normalizedTitleDuplicateGroupCount: nonNegativeIntegerSchema,
            normalizedTitleHashCollisionGroupCount: nonNegativeIntegerSchema,
            pmidCollisionPreventedByPrimaryKey: z.literal(true),
          })
          .strict(),
        journalCoverage: z
          .object({
            articlesWithRegisteredJournalCount: nonNegativeIntegerSchema,
            articlesWithoutRegisteredJournalCount: nonNegativeIntegerSchema,
            byJournalRegistryId: z.array(countCellSchema),
            distinctRegisteredJournalCount: nonNegativeIntegerSchema,
          })
          .strict(),
        publicBetaEligibleCount: nonNegativeIntegerSchema,
        publicationTypeDistribution: z.array(countCellSchema),
        publicationYearDistribution: z.array(countCellSchema),
        relevanceStateCounts: z
          .object({
            candidate: nonNegativeIntegerSchema,
            excluded: nonNegativeIntegerSchema,
            included: nonNegativeIntegerSchema,
            unreviewed: nonNegativeIntegerSchema,
          })
          .strict(),
        retractionCount: nonNegativeIntegerSchema,
        sourceKindCoverage: z
          .object({
            articlesWithAnySourceCount: nonNegativeIntegerSchema,
            articlesWithoutAnySourceCount: nonNegativeIntegerSchema,
            bySourceKind: z.array(countCellSchema),
          })
          .strict(),
        sourceRegistryCoverage: z
          .object({
            articleCoveragePercent: percentageSchema,
            articlesWithRegisteredSourceCount: nonNegativeIntegerSchema,
            articlesWithoutRegisteredSourceCount: nonNegativeIntegerSchema,
            expectedRegisteredIdentityCount: z.literal(SHADOW_RD_REGISTERED_SOURCE_IDENTITY_COUNT),
            observedRegisteredIdentityCount: nonNegativeIntegerSchema.max(
              SHADOW_RD_REGISTERED_SOURCE_IDENTITY_COUNT,
            ),
            queryRegistryContentSha256: z.literal(SHADOW_RD_QUERY_REGISTRY_CONTENT_SHA256),
            registryVersion: z.literal(SHADOW_RD_QUERY_REGISTRY_VERSION),
          })
          .strict(),
        totalArticleRows: nonNegativeIntegerSchema,
        uniquePmidCount: nonNegativeIntegerSchema,
        visibilityStateCounts: z
          .object({
            draft: nonNegativeIntegerSchema,
            hidden: nonNegativeIntegerSchema,
            published: nonNegativeIntegerSchema,
          })
          .strict(),
        conferenceAbstractCount: nonNegativeIntegerSchema,
      })
      .strict(),
    queryId: z.literal(SHADOW_RD_CORPUS_INVENTORY_QUERY_ID),
    schemaVersion: z.literal(SHADOW_RD_CORPUS_INVENTORY_SCHEMA_VERSION),
  })
  .strict()

export const shadowRdCorpusInventoryQueryPayloadSchema =
  shadowRdCorpusInventoryQueryPayloadObjectSchema.superRefine((inventory, context) => {
    const total = inventory.generalCorpus.totalArticleRows
    const relevanceTotal = Object.values(inventory.generalCorpus.relevanceStateCounts).reduce(
      (sum, count) => sum + count,
      0,
    )
    const visibilityTotal = Object.values(inventory.generalCorpus.visibilityStateCounts).reduce(
      (sum, count) => sum + count,
      0,
    )
    if (inventory.generalCorpus.uniquePmidCount !== total) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The PMID primary-key count must equal the total article row count.',
        path: ['generalCorpus', 'uniquePmidCount'],
      })
    }
    if (relevanceTotal !== total) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'General-corpus relevance states do not partition the article rows.',
        path: ['generalCorpus', 'relevanceStateCounts'],
      })
    }
    if (visibilityTotal !== total) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'General-corpus visibility states do not partition the article rows.',
        path: ['generalCorpus', 'visibilityStateCounts'],
      })
    }
    for (const [field, completeness] of Object.entries(inventory.generalCorpus.completeness)) {
      if (completeness.completeCount + completeness.missingCount !== total) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} completeness does not partition the general corpus.`,
          path: ['generalCorpus', 'completeness', field],
        })
      }
    }
    const sourceCoverage = inventory.generalCorpus.sourceKindCoverage
    if (
      sourceCoverage.articlesWithAnySourceCount + sourceCoverage.articlesWithoutAnySourceCount !==
      total
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source-kind coverage does not partition the general corpus.',
        path: ['generalCorpus', 'sourceKindCoverage'],
      })
    }
    const registryCoverage = inventory.generalCorpus.sourceRegistryCoverage
    if (
      registryCoverage.articlesWithRegisteredSourceCount +
        registryCoverage.articlesWithoutRegisteredSourceCount !==
      total
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source-registry coverage does not partition the general corpus.',
        path: ['generalCorpus', 'sourceRegistryCoverage'],
      })
    }
    const journalCoverage = inventory.generalCorpus.journalCoverage
    if (
      journalCoverage.articlesWithRegisteredJournalCount +
        journalCoverage.articlesWithoutRegisteredJournalCount !==
      total
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Journal coverage does not partition the general corpus.',
        path: ['generalCorpus', 'journalCoverage'],
      })
    }
    if (inventory.generalCorpus.publicBetaEligibleCount > total) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Public-beta eligibility cannot exceed the general corpus.',
        path: ['generalCorpus', 'publicBetaEligibleCount'],
      })
    }
    if (total < inventory.developmentCohort.generalCorpusOverlapCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The general corpus cannot be smaller than its development overlap.',
        path: ['generalCorpus', 'totalArticleRows'],
      })
    }
    for (const [name, distribution] of Object.entries(inventory.developmentCohort.crossTabs)) {
      const represented =
        distribution.visible.reduce((sum, cell) => sum + cell.count, 0) +
        distribution.suppressed.recordCount
      if (represented !== SHADOW_RD_DEVELOPMENT_EXPECTED_COUNT) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${name} development cross-tab does not represent all 630 records.`,
          path: ['developmentCohort', 'crossTabs', name],
        })
      }
    }
  })

export type ShadowRdCorpusInventoryQueryPayload = z.infer<
  typeof shadowRdCorpusInventoryQueryPayloadSchema
>

export const shadowRdCorpusInventoryArtifactSchema = z
  .object({
    authorization: z
      .object({
        autonomousProductionLevel: z.literal(0),
        databaseMutationAuthorized: z.literal(false),
        developmentOnly: z.literal(true),
        productionClassifierExecutionAuthorized: z.literal(false),
        productionVisibilityChangeAuthorized: z.literal(false),
      })
      .strict(),
    capturedAt: z.string().datetime(),
    developmentCohort: shadowRdCorpusInventoryQueryPayloadObjectSchema.shape.developmentCohort,
    generalCorpus: shadowRdCorpusInventoryQueryPayloadObjectSchema.shape.generalCorpus,
    queryAudit: z
      .object({
        databaseMutationCount: z.literal(0),
        heldOutIdentitiesAccessed: z.literal(false),
        localDockerContext: z.literal('default'),
        localSupabaseContainer: z.literal('supabase_db_ip-literature-local'),
        remoteDatabaseAccessed: z.literal(false),
        repeatableRead: z.literal(true),
        rolledBack: z.literal(true),
        statementTimeout: z.literal('120s'),
        transactionReadOnly: z.literal(true),
      })
      .strict(),
    queryId: z.literal(SHADOW_RD_CORPUS_INVENTORY_QUERY_ID),
    schemaVersion: z.literal(SHADOW_RD_CORPUS_INVENTORY_SCHEMA_VERSION),
    sealedEvaluation: z
      .object({
        expectedCount: z.literal(SHADOW_RD_SEALED_EVALUATION_EXPECTED_COUNT),
        identityAccessed: z.literal(false),
        queried: z.literal(false),
      })
      .strict(),
  })
  .strict()

export type ShadowRdCorpusInventoryArtifact = z.infer<typeof shadowRdCorpusInventoryArtifactSchema>

/**
 * The sole committed database query for the inventory command. It returns aggregate values only.
 * The fixed development predicate appears exactly once; there is no alternate split, queue,
 * identity-list, complement, remote target, or article-level projection.
 */
export const SHADOW_RD_CORPUS_INVENTORY_SQL = String.raw`BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '120s';
WITH
registered_source_ids(source_id) AS (
  VALUES
    ('ajrccm'),
    ('annals_ats'),
    ('annals_thoracic_surgery'),
    ('ats_scholar'),
    ('bmj_open_respiratory_research'),
    ('chest'),
    ('erj'),
    ('jbip'),
    ('journal_of_bronchology_predecessor'),
    ('journal_thoracic_disease'),
    ('jtcvs'),
    ('jto'),
    ('lancet_respiratory_medicine'),
    ('lung_cancer'),
    ('proceedings_ats'),
    ('respiration'),
    ('respiratory_endoscopy'),
    ('respiratory_medicine'),
    ('respiratory_research'),
    ('respirology'),
    ('thorax')
),
registered_query_ids(query_id) AS (
  VALUES
    ('ai_imaging_technology'),
    ('airway_stents'),
    ('all_pubmed_master_backfill'),
    ('bronchoscopic_lung_volume_reduction'),
    ('bronchoscopic_tumor_ablation'),
    ('central_airway_obstruction'),
    ('core_backfill'),
    ('core_plus_optional_continuity_backfill'),
    ('ebus_mediastinal_staging'),
    ('education_simulation_quality'),
    ('expanded_all_records_audit'),
    ('expanded_topic_filtered_backfill'),
    ('hemoptysis_airway_bleeding'),
    ('ip_broad_catchall'),
    ('other_advanced_bronchoscopy'),
    ('percutaneous_tracheostomy'),
    ('peripheral_biopsy_localization'),
    ('peripheral_navigation'),
    ('persistent_air_leak_fistula'),
    ('pleural_interventions'),
    ('procedural_safety_anesthesia'),
    ('transbronchial_cryobiopsy')
),
development_batch AS (
  SELECT batch.id
  FROM public.literature_gold_set_batches AS batch
  WHERE batch.id = 'fff41ba3-811d-4d28-ba73-9302db3a942a'::uuid
    AND batch.name = 'gold-set-v1'
),
development_membership AS (
  SELECT item.id, item.pmid, item.review_status, item.current_review_id
  FROM public.literature_gold_set_items AS item
  INNER JOIN development_batch AS batch ON batch.id = item.batch_id
  WHERE item.dataset_split = 'development'
),
development_summary AS (
  SELECT
    count(item.id)::integer AS observed_count,
    CASE WHEN count(item.id) = 630 THEN 630 ELSE NULL END::integer AS asserted_count,
    count(article.pmid)::integer AS corpus_overlap_count,
    count(*) FILTER (
      WHERE item.review_status = 'completed'
        AND review.id IS NOT NULL
        AND review.lifecycle_state = 'effective'
    )::integer AS physician_reviewed_count,
    public.literature_gold_development_membership_hash_v1(batch.id) AS membership_sha256
  FROM development_batch AS batch
  LEFT JOIN development_membership AS item ON true
  LEFT JOIN public.literature_articles AS article ON article.pmid = item.pmid
  LEFT JOIN public.literature_gold_set_reviews AS review
    ON review.id = item.current_review_id
   AND review.item_id = item.id
  GROUP BY batch.id
),
article_summary AS (
  SELECT
    count(*)::integer AS total_rows,
    count(DISTINCT article.pmid)::integer AS unique_pmids,
    count(*) FILTER (WHERE article.relevance_state = 'included')::integer AS included_count,
    count(*) FILTER (WHERE article.relevance_state = 'excluded')::integer AS excluded_count,
    count(*) FILTER (WHERE article.relevance_state = 'candidate')::integer AS candidate_count,
    count(*) FILTER (WHERE article.relevance_state = 'unreviewed')::integer AS unreviewed_count,
    count(*) FILTER (WHERE article.visibility_state = 'published')::integer AS published_count,
    count(*) FILTER (WHERE article.visibility_state = 'draft')::integer AS draft_count,
    count(*) FILTER (WHERE article.visibility_state = 'hidden')::integer AS hidden_count,
    count(*) FILTER (
      WHERE article.relevance_state = 'included'
        AND article.visibility_state = 'published'
    )::integer AS public_beta_eligible_count,
    count(*) FILTER (WHERE article.is_retracted)::integer AS retraction_count,
    count(*) FILTER (WHERE article.is_correction)::integer AS correction_count,
    count(*) FILTER (WHERE article.is_conference_abstract)::integer AS conference_abstract_count,
    count(*) FILTER (WHERE nullif(trim(article.title), '') IS NOT NULL)::integer AS title_complete,
    count(*) FILTER (WHERE nullif(trim(coalesce(article.abstract, '')), '') IS NOT NULL)::integer AS abstract_complete,
    count(*) FILTER (WHERE cardinality(article.mesh_terms) > 0)::integer AS mesh_complete,
    count(*) FILTER (WHERE cardinality(article.author_keywords) > 0)::integer AS keyword_complete,
    count(*) FILTER (WHERE cardinality(article.languages) > 0)::integer AS language_complete
  FROM public.literature_articles AS article
),
article_source_presence AS (
  SELECT DISTINCT source.pmid
  FROM public.literature_article_sources AS source
),
registered_source_article_presence AS (
  SELECT DISTINCT source.pmid
  FROM public.literature_article_sources AS source
  INNER JOIN public.literature_import_batches AS import_batch ON import_batch.id = source.batch_id
  LEFT JOIN registered_source_ids AS registry_source ON registry_source.source_id = source.source_id
  LEFT JOIN registered_query_ids AS registry_query ON registry_query.query_id = source.query_id
  WHERE import_batch.query_registry_version = '1.0.0'
    AND (registry_source.source_id IS NOT NULL OR registry_query.query_id IS NOT NULL)
),
observed_registered_identities(identity) AS (
  SELECT DISTINCT 'source:' || registry_source.source_id
  FROM public.literature_article_sources AS source
  INNER JOIN public.literature_import_batches AS import_batch ON import_batch.id = source.batch_id
  INNER JOIN registered_source_ids AS registry_source ON registry_source.source_id = source.source_id
  WHERE import_batch.query_registry_version = '1.0.0'
  UNION
  SELECT DISTINCT 'query:' || registry_query.query_id
  FROM public.literature_article_sources AS source
  INNER JOIN public.literature_import_batches AS import_batch ON import_batch.id = source.batch_id
  INNER JOIN registered_query_ids AS registry_query ON registry_query.query_id = source.query_id
  WHERE import_batch.query_registry_version = '1.0.0'
),
registered_journal_article_presence AS (
  SELECT article.pmid
  FROM public.literature_articles AS article
  INNER JOIN public.literature_journals AS journal ON journal.id = article.journal_id
),
source_kind_distribution AS (
  SELECT source.source_kind AS value, count(DISTINCT source.pmid)::integer AS count
  FROM public.literature_article_sources AS source
  GROUP BY source.source_kind
),
journal_distribution AS (
  SELECT coalesce(article.journal_id, 'unregistered-or-missing') AS value, count(*)::integer AS count
  FROM public.literature_articles AS article
  GROUP BY coalesce(article.journal_id, 'unregistered-or-missing')
),
publication_year_distribution AS (
  SELECT coalesce(article.publication_year::text, 'missing') AS value, count(*)::integer AS count
  FROM public.literature_articles AS article
  GROUP BY coalesce(article.publication_year::text, 'missing')
),
publication_type_distribution AS (
  SELECT publication_type AS value, count(*)::integer AS count
  FROM public.literature_articles AS article
  CROSS JOIN LATERAL unnest(article.publication_types) AS publication_type
  GROUP BY publication_type
),
duplicate_title_groups AS (
  SELECT count(*)::integer AS row_count
  FROM public.literature_articles AS article
  GROUP BY article.normalized_title
  HAVING count(*) > 1
),
doi_collision_groups AS (
  SELECT count(*)::integer AS row_count
  FROM public.literature_articles AS article
  WHERE nullif(lower(trim(coalesce(article.doi, ''))), '') IS NOT NULL
  GROUP BY lower(trim(article.doi))
  HAVING count(*) > 1
),
metadata_hash_collision_groups AS (
  SELECT count(*)::integer AS row_count
  FROM public.literature_articles AS article
  GROUP BY article.metadata_hash
  HAVING count(*) > 1
),
normalized_title_hash_collision_groups AS (
  SELECT count(*)::integer AS row_count
  FROM public.literature_articles AS article
  GROUP BY article.normalized_title_hash
  HAVING count(DISTINCT article.normalized_title) > 1
),
development_year_cells AS (
  SELECT coalesce(article.publication_year::text, 'missing') AS value, count(*)::integer AS count
  FROM development_membership AS item
  INNER JOIN public.literature_articles AS article ON article.pmid = item.pmid
  GROUP BY coalesce(article.publication_year::text, 'missing')
),
development_relevance_cells AS (
  SELECT article.relevance_state AS value, count(*)::integer AS count
  FROM development_membership AS item
  INNER JOIN public.literature_articles AS article ON article.pmid = item.pmid
  GROUP BY article.relevance_state
)
SELECT jsonb_build_object(
  'schemaVersion', 'literature-shadow-rd-corpus-inventory/1.0.0',
  'queryId', 'literature-shadow-rd-fixed-local-aggregate-inventory/1.0.0',
  'capturedAt', to_char(transaction_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'generalCorpus', jsonb_build_object(
    'totalArticleRows', article_summary.total_rows,
    'uniquePmidCount', article_summary.unique_pmids,
    'relevanceStateCounts', jsonb_build_object(
      'included', article_summary.included_count,
      'excluded', article_summary.excluded_count,
      'candidate', article_summary.candidate_count,
      'unreviewed', article_summary.unreviewed_count
    ),
    'visibilityStateCounts', jsonb_build_object(
      'published', article_summary.published_count,
      'draft', article_summary.draft_count,
      'hidden', article_summary.hidden_count
    ),
    'sourceKindCoverage', jsonb_build_object(
      'articlesWithAnySourceCount', (SELECT count(*)::integer FROM article_source_presence),
      'articlesWithoutAnySourceCount', article_summary.total_rows - (SELECT count(*)::integer FROM article_source_presence),
      'bySourceKind', coalesce((
        SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count) ORDER BY value)
        FROM source_kind_distribution
      ), '[]'::jsonb)
    ),
    'sourceRegistryCoverage', jsonb_build_object(
      'registryVersion', '1.0.0',
      'queryRegistryContentSha256', '45c2f0b72deb6dee54cb5b7081fea520bc7b463c12369d972e05e3ff82204a50',
      'expectedRegisteredIdentityCount', 43,
      'observedRegisteredIdentityCount', (SELECT count(*)::integer FROM observed_registered_identities),
      'articlesWithRegisteredSourceCount', (SELECT count(*)::integer FROM registered_source_article_presence),
      'articlesWithoutRegisteredSourceCount', article_summary.total_rows - (SELECT count(*)::integer FROM registered_source_article_presence),
      'articleCoveragePercent', coalesce(round(100.0 * (SELECT count(*) FROM registered_source_article_presence) / nullif(article_summary.total_rows, 0), 2), 0)
    ),
    'journalCoverage', jsonb_build_object(
      'articlesWithRegisteredJournalCount', (SELECT count(*)::integer FROM registered_journal_article_presence),
      'articlesWithoutRegisteredJournalCount', article_summary.total_rows - (SELECT count(*)::integer FROM registered_journal_article_presence),
      'distinctRegisteredJournalCount', (SELECT count(DISTINCT article.journal_id)::integer FROM public.literature_articles AS article WHERE article.journal_id IS NOT NULL),
      'byJournalRegistryId', coalesce((
        SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count) ORDER BY value)
        FROM journal_distribution
      ), '[]'::jsonb)
    ),
    'publicationYearDistribution', coalesce((
      SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count) ORDER BY value)
      FROM publication_year_distribution
    ), '[]'::jsonb),
    'publicationTypeDistribution', coalesce((
      SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count) ORDER BY value)
      FROM publication_type_distribution
    ), '[]'::jsonb),
    'completeness', jsonb_build_object(
      'title', jsonb_build_object(
        'completeCount', article_summary.title_complete,
        'missingCount', article_summary.total_rows - article_summary.title_complete,
        'completionPercent', coalesce(round(100.0 * article_summary.title_complete / nullif(article_summary.total_rows, 0), 2), 0)
      ),
      'abstract', jsonb_build_object(
        'completeCount', article_summary.abstract_complete,
        'missingCount', article_summary.total_rows - article_summary.abstract_complete,
        'completionPercent', coalesce(round(100.0 * article_summary.abstract_complete / nullif(article_summary.total_rows, 0), 2), 0)
      ),
      'meshTerms', jsonb_build_object(
        'completeCount', article_summary.mesh_complete,
        'missingCount', article_summary.total_rows - article_summary.mesh_complete,
        'completionPercent', coalesce(round(100.0 * article_summary.mesh_complete / nullif(article_summary.total_rows, 0), 2), 0)
      ),
      'authorKeywords', jsonb_build_object(
        'completeCount', article_summary.keyword_complete,
        'missingCount', article_summary.total_rows - article_summary.keyword_complete,
        'completionPercent', coalesce(round(100.0 * article_summary.keyword_complete / nullif(article_summary.total_rows, 0), 2), 0)
      ),
      'languages', jsonb_build_object(
        'completeCount', article_summary.language_complete,
        'missingCount', article_summary.total_rows - article_summary.language_complete,
        'completionPercent', coalesce(round(100.0 * article_summary.language_complete / nullif(article_summary.total_rows, 0), 2), 0)
      )
    ),
    'duplicateAndCollisionIndicators', jsonb_build_object(
      'normalizedTitleDuplicateGroupCount', (SELECT count(*)::integer FROM duplicate_title_groups),
      'articlesInDuplicateNormalizedTitleGroups', coalesce((SELECT sum(row_count)::integer FROM duplicate_title_groups), 0),
      'doiCollisionGroupCount', (SELECT count(*)::integer FROM doi_collision_groups),
      'metadataHashCollisionGroupCount', (SELECT count(*)::integer FROM metadata_hash_collision_groups),
      'normalizedTitleHashCollisionGroupCount', (SELECT count(*)::integer FROM normalized_title_hash_collision_groups),
      'pmidCollisionPreventedByPrimaryKey', true
    ),
    'retractionCount', article_summary.retraction_count,
    'correctionCount', article_summary.correction_count,
    'conferenceAbstractCount', article_summary.conference_abstract_count,
    'publicBetaEligibleCount', article_summary.public_beta_eligible_count
  ),
  'developmentCohort', jsonb_build_object(
    'batchId', 'fff41ba3-811d-4d28-ba73-9302db3a942a',
    'batchName', 'gold-set-v1',
    'datasetSplit', 'development',
    'expectedCount', 630,
    'observedCount', development_summary.observed_count,
    'assertedCount', development_summary.asserted_count,
    'generalCorpusOverlapCount', development_summary.corpus_overlap_count,
    'membershipSha256', development_summary.membership_sha256,
    'physicianReviewedCurrentEffectiveCount', development_summary.physician_reviewed_count,
    'crossTabs', jsonb_build_object(
      'publicationYear', jsonb_build_object(
        'minimumCellSize', 5,
        'visible', coalesce((
          SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count) ORDER BY value)
          FROM development_year_cells WHERE count >= 5
        ), '[]'::jsonb),
        'suppressed', jsonb_build_object(
          'cellCount', (SELECT count(*)::integer FROM development_year_cells WHERE count < 5),
          'recordCount', coalesce((SELECT sum(count)::integer FROM development_year_cells WHERE count < 5), 0)
        )
      ),
      'articleRelevanceState', jsonb_build_object(
        'minimumCellSize', 5,
        'visible', coalesce((
          SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count) ORDER BY value)
          FROM development_relevance_cells WHERE count >= 5
        ), '[]'::jsonb),
        'suppressed', jsonb_build_object(
          'cellCount', (SELECT count(*)::integer FROM development_relevance_cells WHERE count < 5),
          'recordCount', coalesce((SELECT sum(count)::integer FROM development_relevance_cells WHERE count < 5), 0)
        )
      )
    )
  )
)
FROM article_summary
CROSS JOIN development_summary;
ROLLBACK;`

function stripSqlCommentsAndLiterals(sql: string): string {
  return sql
    .replace(/--[^\n]*/gu, ' ')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/'(?:''|[^'])*'/gu, "''")
}

export function assertShadowRdCorpusInventorySqlBoundary(sql: string): void {
  if (sql !== SHADOW_RD_CORPUS_INVENTORY_SQL) {
    throw new Error('Corpus inventory execution requires the exact committed aggregate SQL.')
  }
  const inspected = stripSqlCommentsAndLiterals(sql)
  if (
    !/^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/u.test(sql) ||
    !/\nSET LOCAL statement_timeout = '120s';/u.test(sql) ||
    !/ROLLBACK;$/u.test(sql) ||
    (inspected.match(/\bROLLBACK\s*;/gu) ?? []).length !== 1
  ) {
    throw new Error('Corpus inventory SQL requires the exact read-only transaction bracket.')
  }
  if (
    /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO|COPY|COMMIT|VACUUM|REINDEX|CLUSTER|REFRESH|DISCARD|LOCK)\b/iu.test(
      inspected,
    ) ||
    /^\s*\\/mu.test(inspected)
  ) {
    throw new Error('Corpus inventory SQL contains a database mutation capability.')
  }
  if ((sql.match(/item\.dataset_split = 'development'/gu) ?? []).length !== 1) {
    throw new Error('Corpus inventory SQL must contain one exact development membership predicate.')
  }
  if (/dataset_split\s*(?:<>|!=|=\s*'(?:test|all)')/iu.test(sql)) {
    throw new Error('Corpus inventory SQL contains a forbidden alternate or complement split.')
  }
}

function parseSingleJsonLine(stdout: string): unknown {
  const candidates = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
  if (candidates.length !== 1) {
    throw new Error('Corpus inventory query must return exactly one aggregate JSON document.')
  }
  try {
    return JSON.parse(candidates[0]!) as unknown
  } catch (error) {
    throw new Error(
      `Corpus inventory query returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

export function parseShadowRdCorpusInventoryQueryOutput(
  stdout: string,
): ShadowRdCorpusInventoryArtifact {
  const payload = shadowRdCorpusInventoryQueryPayloadSchema.parse(parseSingleJsonLine(stdout))
  return shadowRdCorpusInventoryArtifactSchema.parse({
    authorization: {
      autonomousProductionLevel: 0,
      databaseMutationAuthorized: false,
      developmentOnly: true,
      productionClassifierExecutionAuthorized: false,
      productionVisibilityChangeAuthorized: false,
    },
    capturedAt: payload.capturedAt,
    developmentCohort: payload.developmentCohort,
    generalCorpus: payload.generalCorpus,
    queryAudit: {
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      localDockerContext: 'default',
      localSupabaseContainer: 'supabase_db_ip-literature-local',
      remoteDatabaseAccessed: false,
      repeatableRead: true,
      rolledBack: true,
      statementTimeout: '120s',
      transactionReadOnly: true,
    },
    queryId: payload.queryId,
    schemaVersion: payload.schemaVersion,
    sealedEvaluation: {
      expectedCount: SHADOW_RD_SEALED_EVALUATION_EXPECTED_COUNT,
      identityAccessed: false,
      queried: false,
    },
  })
}

function markdownCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll(/\r?\n/gu, ' ')
}

function countRows(cells: readonly { count: number; value: string }[]): string {
  if (cells.length === 0) return '_No populated values._\n'
  return [
    '| Value | Articles |',
    '| --- | ---: |',
    ...cells.map((cell) => `| ${markdownCell(cell.value)} | ${cell.count} |`),
    '',
  ].join('\n')
}

function completenessRows(
  completeness: ShadowRdCorpusInventoryArtifact['generalCorpus']['completeness'],
): string {
  const labels: Record<keyof typeof completeness, string> = {
    abstract: 'Abstract',
    authorKeywords: 'Author keywords',
    languages: 'Language',
    meshTerms: 'MeSH',
    title: 'Title',
  }
  return (Object.keys(labels) as (keyof typeof completeness)[])
    .map((field) => {
      const value = completeness[field]
      return `| ${labels[field]} | ${value.completeCount} | ${value.missingCount} | ${value.completionPercent.toFixed(2)}% |`
    })
    .join('\n')
}

function suppressedRows(distribution: z.infer<typeof suppressedDistributionSchema>): string {
  const visible = distribution.visible.map(
    (cell) => `| ${markdownCell(cell.value)} | ${cell.count} |`,
  )
  return [
    '| Visible value | Records |',
    '| --- | ---: |',
    ...visible,
    `| _Suppressed (${distribution.suppressed.cellCount} cells)_ | ${distribution.suppressed.recordCount} |`,
    '',
  ].join('\n')
}

export function renderShadowRdCorpusInventoryMarkdown(
  input: ShadowRdCorpusInventoryArtifact,
): string {
  const inventory = shadowRdCorpusInventoryArtifactSchema.parse(input)
  const general = inventory.generalCorpus
  const development = inventory.developmentCohort
  const duplicate = general.duplicateAndCollisionIndicators

  return `# Literature Explorer corpus inventory

Captured: ${inventory.capturedAt}

## Safety boundary

This is an aggregate, development-only shadow-R&D inventory. It performed one repeatable-read,
read-only transaction against the fixed local Literature Supabase container and ended with an
explicit rollback. It did not mutate the database, contact a remote database, enumerate article
identities, or access the sealed evaluation membership. Autonomous production level remains 0.

| Collection | Contract | Observed / accessed |
| --- | --- | ---: |
| General Literature Explorer corpus | Aggregate inventory | ${general.totalArticleRows} rows |
| Physician-reviewed development collection | Fixed ${development.batchName} development membership | ${development.observedCount} rows |
| Sealed evaluation set | Contract metadata only; identities remain sealed | Not queried (expected ${inventory.sealedEvaluation.expectedCount}) |

## General corpus

| Measure | Count |
| --- | ---: |
| Total article rows | ${general.totalArticleRows} |
| Unique PMID count | ${general.uniquePmidCount} |
| Included | ${general.relevanceStateCounts.included} |
| Excluded | ${general.relevanceStateCounts.excluded} |
| Candidate | ${general.relevanceStateCounts.candidate} |
| Unreviewed | ${general.relevanceStateCounts.unreviewed} |
| Published | ${general.visibilityStateCounts.published} |
| Draft | ${general.visibilityStateCounts.draft} |
| Hidden | ${general.visibilityStateCounts.hidden} |
| Retractions | ${general.retractionCount} |
| Corrections | ${general.correctionCount} |
| Conference abstracts | ${general.conferenceAbstractCount} |
| Public-beta eligible under current public-mode rules | ${general.publicBetaEligibleCount} |

Current public mode requires both \`relevance_state = included\` and
\`visibility_state = published\`.

## Metadata completeness

| Field | Complete | Missing | Complete percent |
| --- | ---: | ---: | ---: |
${completenessRows(general.completeness)}

## Source coverage

| Measure | Count |
| --- | ---: |
| Articles with any recorded source | ${general.sourceKindCoverage.articlesWithAnySourceCount} |
| Articles without a recorded source | ${general.sourceKindCoverage.articlesWithoutAnySourceCount} |
| Articles covered by committed source registry ${general.sourceRegistryCoverage.registryVersion} | ${general.sourceRegistryCoverage.articlesWithRegisteredSourceCount} |
| Articles outside that registered-source coverage | ${general.sourceRegistryCoverage.articlesWithoutRegisteredSourceCount} |
| Registered source/query identities observed | ${general.sourceRegistryCoverage.observedRegisteredIdentityCount} / ${general.sourceRegistryCoverage.expectedRegisteredIdentityCount} |
| Registry article coverage | ${general.sourceRegistryCoverage.articleCoveragePercent.toFixed(2)}% |

Committed query-registry SHA-256:
\`${general.sourceRegistryCoverage.queryRegistryContentSha256}\`.

### Source-kind distribution

${countRows(general.sourceKindCoverage.bySourceKind)}
## Journal coverage

| Measure | Count |
| --- | ---: |
| Articles linked to a registered journal | ${general.journalCoverage.articlesWithRegisteredJournalCount} |
| Articles without a registered journal link | ${general.journalCoverage.articlesWithoutRegisteredJournalCount} |
| Distinct registered journals represented | ${general.journalCoverage.distinctRegisteredJournalCount} |

### Articles by journal registry ID

${countRows(general.journalCoverage.byJournalRegistryId)}
## Publication-year distribution

${countRows(general.publicationYearDistribution)}
## Publication-type distribution

${countRows(general.publicationTypeDistribution)}
## Duplicate and collision indicators

| Indicator | Count |
| --- | ---: |
| Duplicate normalized-title groups | ${duplicate.normalizedTitleDuplicateGroupCount} |
| Articles in duplicate normalized-title groups | ${duplicate.articlesInDuplicateNormalizedTitleGroups} |
| DOI collision groups | ${duplicate.doiCollisionGroupCount} |
| Metadata-hash collision groups | ${duplicate.metadataHashCollisionGroupCount} |
| Normalized-title-hash collision groups | ${duplicate.normalizedTitleHashCollisionGroupCount} |

PMID collisions are structurally prevented by the \`literature_articles\` primary key.

## Development collection

| Measure | Count |
| --- | ---: |
| Expected fixed development membership | ${development.expectedCount} |
| Observed fixed development membership | ${development.observedCount} |
| Aggregate overlap with the general corpus | ${development.generalCorpusOverlapCount} |
| Current effective physician-reviewed records | ${development.physicianReviewedCurrentEffectiveCount} |

Canonical development-membership SHA-256: \`${development.membershipSha256}\`.

Development cross-tabs suppress cells smaller than ${SHADOW_RD_MINIMUM_CELL_SIZE}. Suppressed cell
values are not emitted.

### Development publication year

${suppressedRows(development.crossTabs.publicationYear)}
### Development article relevance state

${suppressedRows(development.crossTabs.articleRelevanceState)}
## Authorization

- No database mutation, import, compensation, release-pointer change, visibility change, or
  production classifier execution was authorized.
- No sealed-evaluation query, complement inference, identity lookup, or queue access occurred.
- Results describe the local development state at capture time and are not held-out validation.
`
}

export function serializeShadowRdCorpusInventoryJson(
  input: ShadowRdCorpusInventoryArtifact,
): string {
  return `${JSON.stringify(shadowRdCorpusInventoryArtifactSchema.parse(input), null, 2)}\n`
}
