/**
 * High-level expectations for the catalog the foundation migration produces.
 *
 * These are the *reviewable* invariants — the names and counts a human can check by eye. The
 * byte-exact semantic contract (function definitions, owners, column defaults, constraint and
 * trigger and index definitions, complete ACL grids, role attributes) lives in the generated
 * artifact `foundation-catalog-expectations.json`, which the disposable rehearsal produces and the
 * comparator in `scripts/literature-dedicated-supabase/lib/foundation-catalog.ts` enforces.
 *
 * Keeping both matters: the artifact catches drift a human would never spot, and these hand-written
 * counts catch a bad artifact regeneration that silently "expects" the drift.
 */

export const LITERATURE_FOUNDATION_CATALOG_SCHEMA_VERSION = 'literature-foundation-catalog-v2'

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

/** The six functions the migration creates, by name. */
export const LITERATURE_FOUNDATION_FUNCTION_NAMES: readonly string[] = [
  'curate_literature_article_v1',
  'literature_admin_stats_v1',
  'literature_articles_search_vector_update',
  'prevent_literature_curation_event_mutation',
  'search_literature_v1',
  'set_literature_updated_at',
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
export const LITERATURE_UNPRIVILEGED_ROLES: readonly string[] = ['public', 'anon', 'authenticated']

/** Every role the privilege grid probes. `service_role` is expected to hold everything. */
export const LITERATURE_PROBED_ROLES: readonly string[] = [
  'public',
  'anon',
  'authenticated',
  'service_role',
]

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

/**
 * Privileges probed for every (table, role) pair. The grid always emits a row with an explicit
 * `granted` boolean, so an empty or truncated privilege array is detectable as missing evidence
 * rather than being misread as proof that nothing is granted.
 */
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
  functions: LITERATURE_FOUNDATION_FUNCTION_NAMES.length,
  triggers: LITERATURE_FOUNDATION_TRIGGERS.length,
  indexes: LITERATURE_FOUNDATION_INDEXES.length,
  policies: LITERATURE_FOUNDATION_EXPECTED_POLICY_COUNT,
}

/**
 * Object classes that can collide with something the foundation migration creates. A collision of
 * *any* of these classes blocks or alters the migration, so preflight observes them all — a view
 * named `public.literature_journals` is as fatal as a table of that name.
 */
export const LITERATURE_COLLIDING_RELKINDS: readonly { relkind: string; label: string }[] = [
  { relkind: 'r', label: 'table' },
  { relkind: 'p', label: 'partitioned table' },
  { relkind: 'f', label: 'foreign table' },
  { relkind: 'v', label: 'view' },
  { relkind: 'm', label: 'materialized view' },
  { relkind: 'S', label: 'sequence' },
]
