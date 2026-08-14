/**
 * The exact catalog the foundation migration is expected to produce on an empty Supabase project.
 *
 * This is the shared expectation used by three consumers:
 *   - the disposable rehearsal, which applies the migration to a throwaway PostgreSQL 17 container
 *     and asserts the resulting catalog matches this file exactly;
 *   - the read-only preflight, which asserts none of these objects already exists on the target;
 *   - the read-only postflight, which asserts all of them exist and nothing else does.
 *
 * Because the rehearsal compares the real catalog against this list in both directions, a
 * transcription error here fails the rehearsal rather than silently weakening a later verification.
 */

export const LITERATURE_FOUNDATION_CATALOG_SCHEMA_VERSION = 'literature-foundation-catalog-v1'

export const LITERATURE_FOUNDATION_SCHEMA = 'public'

/** The extension the migration installs, and the schema it must land in. */
export const LITERATURE_FOUNDATION_EXTENSIONS: readonly { name: string; schema: string }[] = [
  { name: 'pg_trgm', schema: 'extensions' },
]

/** All eight tables, each with row-level security enabled and no policy of any kind. */
export const LITERATURE_FOUNDATION_TABLES: readonly string[] = [
  'literature_article_sources',
  'literature_article_topics',
  'literature_articles',
  'literature_curation_events',
  'literature_import_batches',
  'literature_import_errors',
  'literature_journals',
  'literature_topics',
]

/**
 * RLS is enabled on every table and **no policies are created**. That is the fail-closed posture:
 * `anon` and `authenticated` are additionally stripped of table privileges, and `service_role`
 * reaches the data by bypassing RLS rather than by any policy. A policy appearing on any of these
 * tables is drift, not an improvement.
 */
export const LITERATURE_FOUNDATION_EXPECTED_POLICY_COUNT = 0

export interface LiteratureFunctionExpectation {
  name: string
  /** Argument types as PostgreSQL renders them in `pg_get_function_arguments`, comma separated. */
  argumentTypes: string
  returnType: string
  language: 'plpgsql' | 'sql'
  volatility: 'v' | 's' | 'i'
  /** Every function is SECURITY INVOKER; none is SECURITY DEFINER. */
  securityDefiner: false
  /** Every function pins its search path away from a caller-controlled one. */
  searchPath: 'pg_catalog, public'
  /** True for the three RPCs the application calls through PostgREST. */
  serviceRoleExecute: boolean
}

/**
 * Six functions. Three are trigger functions with execute revoked from `public`, `anon`, and
 * `authenticated` (and never granted to `service_role` — PostgreSQL does not check EXECUTE when
 * firing a trigger). Three are the RPCs the runtime calls, granted to `service_role` only.
 */
export const LITERATURE_FOUNDATION_FUNCTIONS: readonly LiteratureFunctionExpectation[] = [
  {
    name: 'curate_literature_article_v1',
    argumentTypes:
      'p_pmid text, p_actor_user_id uuid, p_actor_email text, p_relevance_state text, ' +
      'p_visibility_state text, p_is_landmark boolean, p_topic_decisions jsonb, p_reason text',
    returnType: 'jsonb',
    language: 'plpgsql',
    volatility: 'v',
    securityDefiner: false,
    searchPath: 'pg_catalog, public',
    serviceRoleExecute: true,
  },
  {
    name: 'literature_admin_stats_v1',
    argumentTypes: '',
    returnType: 'jsonb',
    language: 'sql',
    volatility: 's',
    securityDefiner: false,
    searchPath: 'pg_catalog, public',
    serviceRoleExecute: true,
  },
  {
    name: 'literature_articles_search_vector_update',
    argumentTypes: '',
    returnType: 'trigger',
    language: 'plpgsql',
    volatility: 'v',
    securityDefiner: false,
    searchPath: 'pg_catalog, public',
    serviceRoleExecute: false,
  },
  {
    name: 'prevent_literature_curation_event_mutation',
    argumentTypes: '',
    returnType: 'trigger',
    language: 'plpgsql',
    volatility: 'v',
    securityDefiner: false,
    searchPath: 'pg_catalog, public',
    serviceRoleExecute: false,
  },
  {
    name: 'search_literature_v1',
    argumentTypes:
      'p_query text, p_journal_ids text[], p_topic_ids text[], p_year_from integer, ' +
      'p_year_to integer, p_publication_types text[], p_landmark_only boolean, p_sort text, ' +
      'p_page integer, p_page_size integer, p_admin_preview boolean',
    // Bound in full rather than as a bare `TABLE`, because the runtime row mappers in
    // `server/queries.ts` depend on this exact column set and order. A dropped or retyped column
    // would still be a valid function but a broken Explorer.
    returnType:
      'TABLE(pmid text, doi text, title text, authors jsonb, journal_id text, ' +
      'journal_title text, journal_abbreviation text, publication_year integer, volume text, ' +
      'issue text, pages text, abstract_snippet text, publication_types text[], ' +
      'is_landmark boolean, is_retracted boolean, is_correction boolean, ' +
      'is_conference_abstract boolean, relevance_state text, visibility_state text, ' +
      'confirmed_topics jsonb, suggested_topics jsonb, matched_by text[], rank_score real, ' +
      'total_count bigint)',
    language: 'plpgsql',
    volatility: 's',
    securityDefiner: false,
    searchPath: 'pg_catalog, public',
    serviceRoleExecute: true,
  },
  {
    name: 'set_literature_updated_at',
    argumentTypes: '',
    returnType: 'trigger',
    language: 'plpgsql',
    volatility: 'v',
    securityDefiner: false,
    searchPath: 'pg_catalog, public',
    serviceRoleExecute: false,
  },
]

/** The three RPCs the Literature runtime invokes. Everything else is internal. */
export const LITERATURE_FOUNDATION_RUNTIME_RPCS: readonly string[] = [
  'curate_literature_article_v1',
  'literature_admin_stats_v1',
  'search_literature_v1',
]

export const LITERATURE_FOUNDATION_TRIGGERS: readonly { table: string; trigger: string }[] = [
  { table: 'literature_article_topics', trigger: 'set_literature_article_topics_updated_at' },
  { table: 'literature_articles', trigger: 'set_literature_articles_search_vector' },
  { table: 'literature_articles', trigger: 'set_literature_articles_updated_at' },
  { table: 'literature_curation_events', trigger: 'prevent_literature_curation_event_update' },
  { table: 'literature_journals', trigger: 'set_literature_journals_updated_at' },
  { table: 'literature_topics', trigger: 'set_literature_topics_updated_at' },
]

/**
 * Every index the migration produces, including the eight primary-key indexes PostgreSQL creates
 * implicitly for the table constraints.
 */
export const LITERATURE_FOUNDATION_INDEXES: readonly string[] = [
  'literature_article_sources_batch_id_idx',
  'literature_article_sources_pkey',
  'literature_article_sources_query_id_idx',
  'literature_article_sources_source_id_idx',
  'literature_article_topics_pkey',
  'literature_article_topics_topic_state_idx',
  'literature_articles_author_keywords_idx',
  'literature_articles_doi_idx',
  'literature_articles_journal_id_idx',
  'literature_articles_mesh_terms_idx',
  'literature_articles_normalized_title_trgm_idx',
  'literature_articles_pkey',
  'literature_articles_publication_types_idx',
  'literature_articles_publication_year_idx',
  'literature_articles_review_queue_idx',
  'literature_articles_search_vector_idx',
  'literature_articles_workflow_idx',
  'literature_curation_events_actor_created_idx',
  'literature_curation_events_pkey',
  'literature_curation_events_pmid_created_idx',
  'literature_import_batches_identity_uidx',
  'literature_import_batches_pkey',
  'literature_import_batches_status_started_idx',
  'literature_import_errors_batch_id_idx',
  'literature_import_errors_pkey',
  'literature_journals_pkey',
  'literature_topics_parent_id_idx',
  'literature_topics_pkey',
]

/** Roles that must hold no privilege on any Literature table after the migration. */
export const LITERATURE_UNPRIVILEGED_ROLES: readonly string[] = ['anon', 'authenticated']

/** Table privileges `service_role` is expected to hold on every Literature table. */
export const LITERATURE_SERVICE_ROLE_TABLE_PRIVILEGES: readonly string[] = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
]

/** Privileges probed against `anon` and `authenticated`; all must be false. */
export const LITERATURE_PROBED_TABLE_PRIVILEGES: readonly string[] = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
]

/**
 * A foundation-only rollout imports nothing. Every Literature table must be empty immediately
 * afterwards, and an empty search must be a valid empty result rather than an error.
 */
export const LITERATURE_FOUNDATION_EXPECTED_ROW_COUNT = 0

export interface LiteratureFoundationObjectCounts {
  tables: number
  functions: number
  triggers: number
  indexes: number
  policies: number
}

export const LITERATURE_FOUNDATION_OBJECT_COUNTS: LiteratureFoundationObjectCounts = {
  tables: LITERATURE_FOUNDATION_TABLES.length,
  functions: LITERATURE_FOUNDATION_FUNCTIONS.length,
  triggers: LITERATURE_FOUNDATION_TRIGGERS.length,
  indexes: LITERATURE_FOUNDATION_INDEXES.length,
  policies: LITERATURE_FOUNDATION_EXPECTED_POLICY_COUNT,
}
