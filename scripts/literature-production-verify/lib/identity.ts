/**
 * What the dedicated Literature production project is expected to be.
 *
 * Everything that is already stated once in the repository is re-exported rather than restated:
 * the approved project ref and canonical URL come from the runtime contract, and the table,
 * function, trigger, and index inventories come from the foundation catalog expectations. A second
 * hand-written copy of those lists would be a place for drift to hide.
 *
 * What is genuinely new here is the *observed* production identity — the facts that only exist
 * because the foundation migration has actually been applied to `IP_Literature`, and which no file
 * in the repository could have predicted. The migration version is the clearest case: the manifest
 * says in as many words that the recorded version is provider-assigned and that the filename
 * version `20260727032621` must not be assumed, and indeed the applied version is
 * `20260815223259`. That value is owner-reported state, pinned here so a later run can detect that
 * it changed, and marked as such so nobody mistakes it for something this repository derived.
 */

import {
  LITERATURE_FOUNDATION_EXPECTED_POLICY_COUNT,
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_INDEXES,
  LITERATURE_FOUNDATION_RUNTIME_RPCS,
  LITERATURE_FOUNDATION_TABLES,
  LITERATURE_FOUNDATION_TRIGGERS,
  LITERATURE_UNPRIVILEGED_ROLES,
} from '../../../src/features/literature/dedicated-supabase/catalog-expectations'
import { LITERATURE_FOUNDATION_MIGRATION } from '../../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
} from '../../../src/features/literature/server/dedicated-project-contract'

export {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_INDEXES,
  LITERATURE_FOUNDATION_RUNTIME_RPCS,
  LITERATURE_FOUNDATION_TABLES,
  LITERATURE_FOUNDATION_TRIGGERS,
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
  LITERATURE_UNPRIVILEGED_ROLES,
}

/** Where an observed production fact came from. Only `repository` is derivable from this tree. */
export type ProductionFactProvenance = 'repository' | 'owner_reported_observation'

/**
 * The migration identity the live project is expected to present.
 *
 * `name` is repository-derived. `version` is not: it is the value the provider assigned when
 * `apply_migration` ran, reported by the owner on 2026-08-15 after reading the applied history.
 * `LITERATURE_MIGRATION_HISTORY_FIDELITY` in the manifest predicted exactly this divergence.
 */
export const LITERATURE_PRODUCTION_MIGRATION = {
  version: '20260815223259',
  versionProvenance: 'owner_reported_observation' as ProductionFactProvenance,
  name: LITERATURE_FOUNDATION_MIGRATION.name,
  nameProvenance: 'repository' as ProductionFactProvenance,
  expectedCount: 1,
} as const

/**
 * Counts the catalog expectations do not enumerate by name, reported by the owner from the applied
 * project on 2026-08-15. They are a coarse tripwire: an exact catalog comparison still requires a
 * connector-captured catalog attestation, which this tool consumes but never fabricates.
 */
export const LITERATURE_PRODUCTION_CATALOG_TOTALS = {
  tables: LITERATURE_FOUNDATION_TABLES.length,
  columns: 132,
  constraints: 55,
  functions: LITERATURE_FOUNDATION_FUNCTION_NAMES.length,
  enabledTriggers: LITERATURE_FOUNDATION_TRIGGERS.length,
  validIndexes: LITERATURE_FOUNDATION_INDEXES.length,
  policies: LITERATURE_FOUNDATION_EXPECTED_POLICY_COUNT,
  rlsEnabledTables: LITERATURE_FOUNDATION_TABLES.length,
} as const

/** The extension the foundation migration installs, and where. */
export const LITERATURE_PRODUCTION_EXTENSION = {
  name: 'pg_trgm',
  schema: 'extensions',
  version: '1.6',
  versionProvenance: 'owner_reported_observation' as ProductionFactProvenance,
} as const

/**
 * The canary is exactly twenty-five records. "Exactly" is the point: a canary that lands 24 or 26
 * is a failed canary, not a nearly-successful one, and the checks never round toward the target.
 */
export const LITERATURE_CANARY_RECORD_COUNT = 25

/**
 * The state every canary record must hold. These are the foundation defaults — `unreviewed` and
 * `draft` — so a canary import that produced anything else did more than import.
 */
export const LITERATURE_CANARY_RELEVANCE_STATE = 'unreviewed'
export const LITERATURE_CANARY_VISIBILITY_STATE = 'draft'

/** Every value `literature_articles.relevance_state` may hold, per the migration's check constraint. */
export const LITERATURE_RELEVANCE_STATES: readonly string[] = [
  'unreviewed',
  'candidate',
  'included',
  'excluded',
]

/** Every value `literature_articles.visibility_state` may hold. */
export const LITERATURE_VISIBILITY_STATES: readonly string[] = ['draft', 'published', 'hidden']

/**
 * The pair the public (non-admin-preview) search path requires, taken from `search_literature_v1`:
 *
 *   (p_admin_preview or (article.relevance_state = 'included'
 *                        and article.visibility_state = 'published'))
 *
 * So a record is publicly reachable only when it is *both* included and published. A canary
 * record — `unreviewed` / `draft` — fails both halves, which is why the public search of a
 * canary-populated corpus must return zero.
 */
export const LITERATURE_PUBLICLY_VISIBLE_STATE = {
  relevanceState: 'included',
  visibilityState: 'published',
} as const

/** Batch statuses, per `literature_import_batches_status_check`. */
export const LITERATURE_BATCH_STATUSES: readonly string[] = [
  'started',
  'completed',
  'failed',
  'skipped',
]

/**
 * A batch in this status with no `completed_at` has no receipt: it may have written rows, may have
 * written none, and the destination cannot tell the difference. Reconciliation stops rather than
 * guessing.
 */
export const LITERATURE_AMBIGUOUS_BATCH_STATUS = 'started'

/**
 * Gold-workflow RPCs. None of them exists in `IP_Literature`: every one belongs to a deferred
 * migration that the foundation-only rollout deliberately did not apply.
 *
 * Only `list_literature_gold_batches_v2` is ever probed. The rest are named here so the absence
 * claim is specific, and so the transport can refuse them by name — several are mutating, and a
 * verification tool must not be one keystroke away from calling them.
 */
export const LITERATURE_GOLD_WORKFLOW_RPCS: readonly string[] = [
  'freeze_literature_gold_batch_v1',
  'get_literature_gold_review_item_v2',
  'list_literature_gold_batches_v2',
  'save_literature_gold_review_v1',
  'unlock_literature_gold_test_split_v1',
  'update_literature_gold_item_v1',
]

/** The single gold RPC this tool is permitted to probe, because it neither exists nor mutates. */
export const LITERATURE_GOLD_PROBE_RPC = 'list_literature_gold_batches_v2'

/** The dedicated Railway variables. Exactly three; no fallback name is ever consulted. */
export const LITERATURE_RAILWAY_VARIABLES: readonly string[] = [
  'LITERATURE_SUPABASE_URL',
  'LITERATURE_SUPABASE_SECRET_KEY',
  'LITERATURE_SUPABASE_EXPECTED_PROJECT_REF',
]

/**
 * Literature variables that must NOT be added at cutover, stated by name so "no fallback
 * variables" is checkable rather than merely intended.
 *
 * `LITERATURE_SUPABASE_RUNTIME_MODE` set to `local` would relax the strict contract; anything else
 * in it is inert but pointless. `LITERATURE_SUPABASE_SERVICE_ROLE_KEY` is the legacy alias — the
 * strict contract refuses it outright, and setting it alongside the secret key to a different
 * value resolves to `ambiguous_credentials` rather than to either credential.
 */
export const LITERATURE_FORBIDDEN_RAILWAY_VARIABLES: readonly string[] = [
  'LITERATURE_SUPABASE_RUNTIME_MODE',
  'LITERATURE_SUPABASE_SERVICE_ROLE_KEY',
]

/**
 * Main-application variables that stay exactly as they are. They are not Literature fallbacks and
 * never were — the Literature contract reads none of them — but site authentication and site-admin
 * identity depend on them, so the cutover must leave them untouched rather than "tidy" them.
 */
export const LITERATURE_UNRELATED_MAIN_APPLICATION_VARIABLES: readonly string[] = [
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
]
