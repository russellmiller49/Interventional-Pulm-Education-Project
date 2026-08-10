import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import { GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES } from '../../src/features/literature/gold-set/import-compensation-v2'

import {
  developmentPlanningStateSha256,
  type RawDatabaseSnapshot,
} from './gold-import-compensation-migration-operations'
import {
  assertLocalDockerEndpoint,
  buildCanonicalScenarioEvidence,
  extractSqlScenarioEvidence,
  sanitizeRehearsalChildEnvironment,
  validateSqlScenarioEvidence,
} from './gold-import-compensation-rehearsal-evidence'
import {
  CONTRACT_MIGRATIONS,
  GOLD_IMPORT_COMPENSATION_MIGRATION_V2,
  GOLD_IMPORT_COMPENSATION_VERIFICATION_V1,
  GOLD_IMPORT_COMPENSATION_VERIFICATION_V2,
  HISTORICAL_LITERATURE_MIGRATIONS,
  REQUIRED_TRANSITION_RPCS_V1,
  REQUIRED_TRANSITION_RPCS_V2,
  REQUIRED_V2_SEMANTIC_FUNCTIONS,
  assertV2SchemaOnlyUpgradePreserved,
  buildCanonicalV2RehearsalArtifacts,
  extractV2VerifierEvidence,
  validateV2CanonicalAuthorizationBindings,
  validateV2SchemaOnlySnapshot,
  validateV2RpcMetadata,
  type V2CanonicalAuthorizationBindings,
  type V2MigrationPath,
  type V2SchemaOnlySnapshot,
} from './gold-import-compensation-rehearsal-evidence-v2'
import {
  DISPOSABLE_POSTGRES_IMAGE,
  cleanupDisposableContainer,
  developmentDatabaseSeedSchema,
  renderDevelopmentDatabaseSeedSql,
  type CommandResult,
  type DevelopmentDatabaseSeed,
  type DisposableCommandOptions,
  type DisposableContainerCleanupOutcome,
  type DisposableRuntime,
} from './rehearse-exact-gold-import-compensation-package-v1'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PROTECTED_REAL_LOCAL_DATABASE_PORT = '55322'
const DOCKER_CONTEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u
const CONTAINER_LABEL = 'org.interventionalpulm.gold-rehearsal-v2-run-nonce'
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

// The fixed list is a migration ordering contract, not a caller-selected
// migration inventory. Upgrade loads the authenticated pre-V1 snapshot at its
// historical boundary, reaches accepted V1, then brackets V2. Fresh applies
// the complete empty schema first and loads only a validated migration-equivalent
// post-V2 projection of those same authenticated rows.
export const V2_REHEARSAL_MIGRATIONS = [
  ...HISTORICAL_LITERATURE_MIGRATIONS,
  ...CONTRACT_MIGRATIONS,
] as const

const V1_MIGRATION_FILENAME = CONTRACT_MIGRATIONS[0]
const V2_MIGRATION_FILENAME = CONTRACT_MIGRATIONS[1]

export interface V2MigrationPathPlan {
  migrationsBeforeSeed: readonly string[]
  migrationsFromV1ToV2: readonly string[]
  migrationsToReachV1AfterSeed: readonly string[]
  path: V2MigrationPath
  requiresAcceptedV1UpgradeBracket: boolean
  seedMode: 'exact_pre_v1' | 'migration_equivalent_post_v2_projection'
}

export function parseV2MigrationPath(value: unknown): V2MigrationPath {
  if (value !== 'fresh' && value !== 'upgrade') {
    throw new Error('V2 rehearsal requires one explicit migration path: fresh or upgrade.')
  }
  return value
}

export function buildV2MigrationPathPlan(value: unknown): V2MigrationPathPlan {
  const path = parseV2MigrationPath(value)
  return path === 'upgrade'
    ? {
        migrationsBeforeSeed: [...HISTORICAL_LITERATURE_MIGRATIONS],
        migrationsFromV1ToV2: [V2_MIGRATION_FILENAME],
        migrationsToReachV1AfterSeed: [V1_MIGRATION_FILENAME],
        path,
        requiresAcceptedV1UpgradeBracket: true,
        seedMode: 'exact_pre_v1',
      }
    : {
        migrationsBeforeSeed: [...HISTORICAL_LITERATURE_MIGRATIONS, ...CONTRACT_MIGRATIONS],
        migrationsFromV1ToV2: [],
        migrationsToReachV1AfterSeed: [],
        path,
        requiresAcceptedV1UpgradeBracket: false,
        seedMode: 'migration_equivalent_post_v2_projection',
      }
}

export interface V2DisposableDatabaseContext {
  batchId: string
  migrationPath: V2MigrationPath
  migrationSha256: string
  postV2SeedSnapshot: V2SchemaOnlySnapshot
  psql(sql: string): Promise<CommandResult>
  queryJson(sql: string): Promise<unknown>
  schemaOnlyUpgrade: { after: unknown; before: unknown } | null
}

export interface V2ExactPackageDatabaseEvidence {
  operationScenarios: unknown
  productionCohort: unknown
}

/**
 * The package executor is repository code, never a CLI-supplied SQL hook. It
 * receives control only after the owned fixed-image target, migration ledger,
 * schema-only bracket, V1 verifier, V2 verifier, RPC metadata, and seed scope
 * have passed.
 */
export interface V2ExactPackageDatabaseExecutor {
  execute(context: V2DisposableDatabaseContext): Promise<V2ExactPackageDatabaseEvidence>
}

export interface ExecuteV2DisposablePathInput {
  evidenceBindings: V2CanonicalAuthorizationBindings
  exactPackageExecutor: V2ExactPackageDatabaseExecutor
  migrationPath: V2MigrationPath
  seed: DevelopmentDatabaseSeed
}

export type ExecuteV2DisposableCatalogProbeInput = Omit<
  ExecuteV2DisposablePathInput,
  'evidenceBindings'
>

type ExecuteV2DisposablePathRuntimeInput = ExecuteV2DisposableCatalogProbeInput & {
  evidenceBindings?: V2CanonicalAuthorizationBindings
  evidenceMode: 'canonical_delivery' | 'catalog_drift_probe' | 'catalog_expectation_proposal'
}

interface V2DisposablePathResultBase {
  cleanup: DisposableContainerCleanupOutcome
  migrationPath: V2MigrationPath
  migrationSha256: string
  rawReceipt: Record<string, unknown>
}

export interface V2DisposablePathResult extends V2DisposablePathResultBase {
  canonicalArtifacts: ReadonlyMap<string, Buffer>
  evidenceAuthority: 'canonical_delivery_evidence'
}

export interface V2DisposableCatalogProbeResult extends V2DisposablePathResultBase {
  evidenceAuthority: 'transient_catalog_probe_not_delivery_evidence'
}

export interface V2DisposableCatalogExpectationProposalResult {
  cleanup: DisposableContainerCleanupOutcome
  migrationPath: V2MigrationPath
  migrationSha256: string
  status: 'transient_catalog_expectation_proposal_not_delivery_evidence'
}

type V2DisposablePathRuntimeResult = V2DisposablePathResult | V2DisposableCatalogProbeResult
type V2DisposablePathRuntimeResultWithoutCleanup =
  | Omit<V2DisposablePathResult, 'cleanup'>
  | Omit<V2DisposableCatalogProbeResult, 'cleanup'>

export interface V2DeterminismResult {
  canonicalArtifacts: ReadonlyMap<string, Buffer>
  first: V2DisposablePathResult
  migrationPath: V2MigrationPath
  second: V2DisposablePathResult
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function sqlLiteral(value: string): string {
  if (value.includes('$v2_rehearsal$')) throw new Error('Unsafe V2 rehearsal SQL delimiter.')
  return `$v2_rehearsal$${value}$v2_rehearsal$`
}

function migrationLedgerSql(filename: string, sql: string): string {
  const match = /^(\d{14})_(.+)\.sql$/u.exec(filename)
  if (!match) throw new Error(`Invalid fixed V2 rehearsal migration filename: ${filename}.`)
  return `begin;
${sql}
insert into supabase_migrations.schema_migrations(version, name, statements)
values (${sqlLiteral(match[1])}, ${sqlLiteral(match[2])}, array[]::text[]);
commit;`
}

const V2_SEED_TABLES = [
  'literature_articles',
  'literature_gold_set_batches',
  'literature_gold_set_items',
  'literature_gold_set_reviews',
  'literature_gold_set_review_drafts',
  'literature_gold_set_events',
] as const
type V2SeedTable = (typeof V2_SEED_TABLES)[number]

const V2_SEED_REQUIRED_IDENTITY_COLUMNS: Record<V2SeedTable, readonly string[]> = {
  literature_articles: ['pmid'],
  literature_gold_set_batches: ['id'],
  literature_gold_set_events: ['batch_id', 'event_type', 'id', 'item_id'],
  literature_gold_set_items: ['batch_id', 'current_review_id', 'dataset_split', 'id', 'pmid'],
  literature_gold_set_review_drafts: ['item_id'],
  literature_gold_set_reviews: ['id', 'item_id', 'revision', 'supersedes_review_id'],
}

interface V2SeedMigrationColumn {
  expression: string
  name: string
}

const V2_SEED_MIGRATION_COLUMNS: Partial<Record<V2SeedTable, readonly V2SeedMigrationColumn[]>> = {
  literature_gold_set_events: [
    { expression: 'null::uuid', name: 'operation_id' },
    { expression: 'null::uuid', name: 'operation_action_id' },
    { expression: 'null::integer', name: 'operation_event_sequence' },
  ],
  literature_gold_set_reviews: [
    { expression: "'standard'::text", name: 'revision_kind' },
    { expression: "'effective'::text", name: 'lifecycle_state' },
    { expression: 'null::uuid', name: 'operation_action_id' },
    { expression: 'null::uuid', name: 'compensates_review_id' },
    { expression: 'null::uuid', name: 'effective_source_review_id' },
    { expression: 'null::text', name: 'technology_tag_status' },
    { expression: 'null::text', name: 'disease_tag_status' },
    { expression: 'null::text', name: 'taxonomy_version' },
    { expression: 'null::text', name: 'label_schema_version' },
    { expression: 'null::text', name: 'enrichment_schema_version' },
    { expression: 'null::text', name: 'enrichment_provenance' },
    { expression: 'null::boolean', name: 'full_text_used' },
    { expression: '1::smallint', name: 'operation_contract_version_code' },
  ],
}

const V2_SEED_GENERATED_COLUMNS: Partial<Record<V2SeedTable, readonly string[]>> = {
  literature_gold_set_reviews: ['operation_contract_version'],
}

function quoteV2SeedIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/u.test(value)) {
    throw new Error(`Unsafe V2 seed projection identifier ${value}.`)
  }
  return `"${value}"`
}

function v2SeedJsonLiteral(value: unknown): string {
  const json = canonicalJson(value)
  const tag = `$v2_seed_${sha256(json).slice(0, 16)}$`
  if (json.includes(tag)) throw new Error('V2 seed projection JSON delimiter collision.')
  return `${tag}${json}${tag}`
}

function validatedV2SeedBaseColumns(
  table: V2SeedTable,
  rows: readonly Record<string, unknown>[],
): string[] {
  if (rows.length === 0) return []
  const columns = Object.keys(rows[0] ?? {}).sort()
  if (columns.length === 0 || columns.some((column) => !/^[a-z][a-z0-9_]*$/u.test(column))) {
    throw new Error(`V2 fresh seed table ${table} has an invalid historical column set.`)
  }
  const canonicalColumns = canonicalJson(columns)
  if (rows.some((row) => canonicalJson(Object.keys(row).sort()) !== canonicalColumns)) {
    throw new Error(`V2 fresh seed table ${table} rows do not share one exact column set.`)
  }
  const migrationColumns = new Set([
    ...(V2_SEED_MIGRATION_COLUMNS[table] ?? []).map(({ name }) => name),
    ...(V2_SEED_GENERATED_COLUMNS[table] ?? []),
  ])
  if (columns.some((column) => migrationColumns.has(column))) {
    throw new Error(
      `V2 fresh seed table ${table} supplied a migration-derived column instead of the authenticated pre-V1 value set.`,
    )
  }
  const missingIdentity = V2_SEED_REQUIRED_IDENTITY_COLUMNS[table].filter(
    (column) => !columns.includes(column),
  )
  if (missingIdentity.length > 0) {
    throw new Error(
      `V2 fresh seed table ${table} is missing identity columns: ${missingIdentity.join(', ')}.`,
    )
  }
  return columns
}

function v2SeedCatalogColumnAssertion(table: V2SeedTable, expectedColumns: string[]): string {
  const expected = [...expectedColumns].sort()
  const expectedSql = expected.map((column) => `'${column}'`).join(', ')
  return `do $v2_seed_columns$
declare
  actual_columns text[];
begin
  select coalesce(
    array_agg(attribute.attname::text order by attribute.attname::text collate "C"),
    array[]::text[]
  ) into actual_columns
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.${table}'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped
    and attribute.attgenerated = '';
  if actual_columns is distinct from array[${expectedSql}]::text[] then
    raise exception 'V2 fresh seed projection column inventory mismatch for ${table}';
  end if;
end;
$v2_seed_columns$;`
}

/**
 * Load the authenticated pre-V1 rows into a schema that already contains V1
 * and V2. Every insert names its columns. The only synthesized values are the
 * exact defaults/nulls that the two forward migrations derive for existing
 * reviews and events; the generated discriminator is never inserted.
 */
export function renderPostV2CompatibleDevelopmentSeedSqlV2(input: DevelopmentDatabaseSeed): string {
  const seed = developmentDatabaseSeedSchema.parse(input)
  const statements: string[] = ['begin;', "set local session_replication_role = 'replica';"]
  for (const table of V2_SEED_TABLES) {
    const rows = seed.tables[table]
    const baseColumns = validatedV2SeedBaseColumns(table, rows)
    if (baseColumns.length === 0) continue
    const migrationColumns = [...(V2_SEED_MIGRATION_COLUMNS[table] ?? [])]
    const insertColumns = [...baseColumns, ...migrationColumns.map(({ name }) => name)]
    statements.push(v2SeedCatalogColumnAssertion(table, insertColumns))
    statements.push(
      `insert into public.${table} (${insertColumns.map(quoteV2SeedIdentifier).join(', ')})\n` +
        `select ${[
          ...baseColumns.map((column) => `projected.${quoteV2SeedIdentifier(column)}`),
          ...migrationColumns.map(({ expression }) => expression),
        ].join(', ')}\n` +
        `from pg_catalog.jsonb_populate_recordset(null::public.${table}, ${v2SeedJsonLiteral(rows)}::jsonb) as projected;`,
    )
  }
  statements.push("set local session_replication_role = 'origin';", 'commit;', '')
  return statements.join('\n')
}

export function v2SchemaOnlySnapshotSql(batchId: string): string {
  if (!UUID_PATTERN.test(batchId)) throw new Error('Invalid development batch ID for snapshot.')
  const escapedBatchId = sqlLiteral(batchId)
  return String.raw`
with selected_items as (
  select item.*
  from public.literature_gold_set_items item
  where item.batch_id = ${escapedBatchId}::uuid
    and item.dataset_split = 'development'
), selected_reviews as (
  select review.*
  from public.literature_gold_set_reviews review
  join selected_items item on item.id = review.item_id
), selected_events as (
  select event.*
  from public.literature_gold_set_events event
  where event.batch_id = ${escapedBatchId}::uuid
), selected_operations as (
  select operation.*
  from public.literature_gold_review_operations operation
  where operation.batch_id = ${escapedBatchId}::uuid
), selected_actions as (
  select action.*
  from public.literature_gold_review_operation_actions action
  join selected_operations operation on operation.id = action.operation_id
), projections as (
  select
    coalesce((select jsonb_agg(to_jsonb(batch) order by batch.id)
      from public.literature_gold_set_batches batch
      where batch.id = ${escapedBatchId}::uuid), '[]'::jsonb) as batch_rows,
    coalesce((select jsonb_agg(to_jsonb(item) order by item.display_order, item.id)
      from selected_items item), '[]'::jsonb) as item_rows,
    coalesce((select jsonb_agg(
      to_jsonb(review) - 'full_text_used' - 'operation_contract_version'
        - 'operation_contract_version_code'
      order by review.item_id, review.revision, review.id
    ) from selected_reviews review), '[]'::jsonb) as review_rows,
    coalesce((select jsonb_agg(to_jsonb(draft) order by draft.item_id)
      from public.literature_gold_set_review_drafts draft
      join selected_items item on item.id = draft.item_id), '[]'::jsonb) as draft_rows,
    coalesce((select jsonb_agg(to_jsonb(event) order by event.created_at, event.id)
      from selected_events event), '[]'::jsonb) as event_rows,
    coalesce((select jsonb_agg(to_jsonb(operation) - 'contract_version'
      order by operation.started_at, operation.id)
      from selected_operations operation), '[]'::jsonb) as operation_rows,
    coalesce((select jsonb_agg(to_jsonb(action)
      order by action.operation_id, action.action_sequence, action.id)
      from selected_actions action), '[]'::jsonb) as action_rows,
    coalesce((select jsonb_agg(jsonb_build_object(
      'itemId', item.id,
      'currentReviewId', item.current_review_id
    ) order by item.display_order, item.id) from selected_items item), '[]'::jsonb) as pointers,
    coalesce((select jsonb_agg(jsonb_build_object(
      'itemId', item.id,
      'automatedSignalsRevealedAt', item.automated_signals_revealed_at
    ) order by item.display_order, item.id) from selected_items item), '[]'::jsonb) as automated_reveals,
    coalesce((select jsonb_agg(jsonb_build_object(
      'itemId', item.id,
      'supplementalMetadataRevealedAt', item.supplemental_metadata_revealed_at
    ) order by item.display_order, item.id) from selected_items item), '[]'::jsonb) as supplemental_reveals
)
select pg_catalog.jsonb_build_object(
  'actionCount', (select count(*)::integer from selected_actions),
  'actionRowsSha256', public.literature_gold_jsonb_sha256_v1(projections.action_rows),
  'automatedRevealStateSha256', public.literature_gold_jsonb_sha256_v1(projections.automated_reveals),
  'batchCount', (select count(*)::integer from public.literature_gold_set_batches
    where id = ${escapedBatchId}::uuid),
  'batchRowsSha256', public.literature_gold_jsonb_sha256_v1(projections.batch_rows),
  'draftCount', (select count(*)::integer
    from public.literature_gold_set_review_drafts draft
    join selected_items item on item.id = draft.item_id),
  'draftRowsSha256', public.literature_gold_jsonb_sha256_v1(projections.draft_rows),
  'effectiveStateSha256V1', public.literature_gold_effective_state_hash_v1(
    ${escapedBatchId}::uuid, 'development'),
  'eventCount', (select count(*)::integer from selected_events),
  'eventRowsSha256', public.literature_gold_jsonb_sha256_v1(projections.event_rows),
  'itemCount', (select count(*)::integer from selected_items),
  'itemRowsSha256', public.literature_gold_jsonb_sha256_v1(projections.item_rows),
  'membershipSha256', public.literature_gold_development_membership_hash_v1(${escapedBatchId}::uuid),
  'operationCount', (select count(*)::integer from selected_operations),
  'operationRowsSha256', public.literature_gold_jsonb_sha256_v1(projections.operation_rows),
  'physicalStateSha256V1', public.literature_gold_physical_state_hash_v1(
    ${escapedBatchId}::uuid, 'development'),
  'pointerStateSha256', public.literature_gold_jsonb_sha256_v1(projections.pointers),
  'reviewCount', (select count(*)::integer from selected_reviews),
  'reviewRowsSha256', public.literature_gold_jsonb_sha256_v1(projections.review_rows),
  'supplementalRevealStateSha256', public.literature_gold_jsonb_sha256_v1(
    projections.supplemental_reveals)
)
from projections;`
}

export function v2DevelopmentPlanningSnapshotSql(batchId: string): string {
  if (!UUID_PATTERN.test(batchId)) {
    throw new Error('Invalid development batch ID for planning snapshot.')
  }
  const escapedBatchId = sqlLiteral(batchId)
  return String.raw`
with selected_items as (
  select item.*
  from public.literature_gold_set_items item
  where item.batch_id = ${escapedBatchId}::uuid
    and item.dataset_split = 'development'
)
select pg_catalog.jsonb_build_object(
  'developmentItems', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'item', to_jsonb(item),
    'reviews', coalesce((
      select pg_catalog.jsonb_agg(to_jsonb(review) order by review.revision, review.id)
      from public.literature_gold_set_reviews review
      where review.item_id = item.id
    ), '[]'::jsonb),
    'events', coalesce((
      select pg_catalog.jsonb_agg(to_jsonb(event) order by event.created_at, event.id)
      from public.literature_gold_set_events event
      where event.item_id = item.id
    ), '[]'::jsonb)
  ) order by item.display_order, item.id), '[]'::jsonb)
)
from selected_items item;`
}

const planningSnapshotSchema = z
  .object({
    developmentItems: z.array(
      z
        .object({
          events: z.array(z.record(z.string(), z.unknown())),
          item: z.record(z.string(), z.unknown()),
          reviews: z.array(z.record(z.string(), z.unknown())),
        })
        .strict(),
    ),
  })
  .strict()

async function collectV2SchemaOnlySnapshot(
  queryJson: (sql: string) => Promise<unknown>,
  batchId: string,
  label: string,
): Promise<V2SchemaOnlySnapshot> {
  const base = z
    .record(z.string(), z.unknown())
    .parse(await queryJson(v2SchemaOnlySnapshotSql(batchId)))
  const planning = planningSnapshotSchema.parse(
    await queryJson(v2DevelopmentPlanningSnapshotSql(batchId)),
  )
  const planningSnapshot: RawDatabaseSnapshot = {
    database: {},
    developmentItems: planning.developmentItems,
    developmentSeed: {},
    migrationLedger: [],
    schema: {},
    scope: {},
    testAggregate: {},
  }
  return validateV2SchemaOnlySnapshot(
    {
      ...base,
      planningStateSha256: developmentPlanningStateSha256(planningSnapshot),
    },
    label,
  )
}

export const V2_RPC_METADATA_SQL = String.raw`
with required(name) as (
  values
    ('apply_literature_gold_import_v1'),
    ('compensate_literature_gold_import_v1'),
    ('reconcile_literature_gold_review_operation_v1'),
    ('apply_literature_gold_import_v2'),
    ('compensate_literature_gold_import_v2'),
    ('reconcile_literature_gold_review_operation_v2')
)
select pg_catalog.jsonb_build_object(
  'functions', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name', proc.proname,
    'identityArguments', pg_catalog.pg_get_function_identity_arguments(proc.oid),
    'resultType', pg_catalog.pg_get_function_result(proc.oid),
    'volatility', proc.provolatile,
    'owner', owner.rolname,
    'securityDefiner', proc.prosecdef,
    'searchPath', coalesce((
      select pg_catalog.regexp_replace(setting, '^search_path=', '')
      from unnest(coalesce(proc.proconfig, array[]::text[])) setting
      where setting like 'search_path=%'
      limit 1
    ), ''),
    'publicExecute', exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        proc.proacl, pg_catalog.acldefault('f', proc.proowner)
      )) acl where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    ),
    'anonExecute', pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE'),
    'authenticatedExecute', pg_catalog.has_function_privilege(
      'authenticated', proc.oid, 'EXECUTE'),
    'serviceRoleExecute', pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE')
  ) order by proc.proname), '[]'::jsonb)
)
from required
join pg_catalog.pg_namespace namespace on namespace.nspname = 'public'
join pg_catalog.pg_proc proc
  on proc.proname = required.name and proc.pronamespace = namespace.oid
join pg_catalog.pg_roles owner on owner.oid = proc.proowner;`

export const V2_SEMANTIC_FUNCTION_CONTRACTS = {
  apply_literature_gold_import_v2: {
    identityArguments:
      'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: true,
    serviceRoleExecute: true,
    volatility: 'v',
  },
  compensate_literature_gold_import_v2: {
    identityArguments:
      'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: true,
    serviceRoleExecute: true,
    volatility: 'v',
  },
  enforce_literature_gold_operation_contract_v2: {
    identityArguments: '',
    resultType: 'trigger',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: false,
    volatility: 'v',
  },
  enforce_literature_gold_review_contract_v2: {
    identityArguments: '',
    resultType: 'trigger',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: false,
    volatility: 'v',
  },
  literature_gold_review_clinical_projection_v2: {
    identityArguments: 'p_review_id uuid',
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  literature_gold_effective_state_hash_v2: {
    identityArguments: 'p_batch_id uuid, p_split text',
    resultType: 'text',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  literature_gold_physical_state_hash_v2: {
    identityArguments: 'p_batch_id uuid, p_split text',
    resultType: 'text',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  literature_gold_review_operation_receipt_v2: {
    identityArguments: 'p_operation_id uuid, p_idempotent boolean',
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  literature_gold_review_operation_result_v2: {
    identityArguments: 'p_operation_id uuid, p_idempotent boolean',
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  reconcile_literature_gold_review_operation_v2: {
    identityArguments:
      'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: true,
    serviceRoleExecute: true,
    volatility: 's',
  },
  validate_literature_gold_import_review_payload_v2: {
    identityArguments: 'p_item_id uuid, p_review jsonb, p_expected_first_effective boolean',
    resultType: 'void',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  validate_literature_gold_operation_authorization_v2: {
    identityArguments:
      'p_authorization jsonb, p_authorization_sha256 text, p_kind text, p_operation_id uuid, p_target_import_operation_id uuid, p_batch_id uuid, p_plan_sha256 text, p_idempotency_key text, p_artifact_sha256 text, p_plan jsonb',
    resultType: 'void',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  validate_literature_gold_operation_plan_v2: {
    identityArguments:
      'p_plan jsonb, p_kind text, p_operation_id uuid, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_idempotency_key text',
    resultType: 'void',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
} as const

export const V2_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256 = {
  apply_literature_gold_import_v2:
    '6764e15d5da086c96538e3932e3e6120e8009ca4592e45c8e58f55593fe405f4',
  compensate_literature_gold_import_v2:
    '11472e21305ec393d3125dc421543558d0cd3a6eadbfc9508e3f9eea232f78b6',
  enforce_literature_gold_operation_contract_v2:
    '27bddc601764b399554ef009355150cee93ced571a8c88e3875982399541611d',
  enforce_literature_gold_review_contract_v2:
    'fddfc09ee4387d4231066f1d008bc82858927b5bec3f6f2552640bd6469aa50d',
  literature_gold_effective_state_hash_v2:
    '48c8f9575366e83f1e8a3c5f48ab39a596c5814de719aee364bdc6c41893200d',
  literature_gold_physical_state_hash_v2:
    'bd127eab048d92e3af9d194003da0bb2a093dcfbd11adfa361d10c6a3445c562',
  literature_gold_review_clinical_projection_v2:
    '5c51c2974b71cff7c33bc1f75d1ae5d36b2d8defbc7473da14256391c3be7040',
  literature_gold_review_operation_receipt_v2:
    '2ff61c33ca186183dc3e924f9c4108fbcb89aa7f5a393ca7bd805dd2f579145b',
  literature_gold_review_operation_result_v2:
    '626b999666945ea7fb892bc83cd08d48d3a30655535e03884279c3ca4bdde598',
  reconcile_literature_gold_review_operation_v2:
    'f5b7a30fd1db8ccf23e6f3a6b38ab723b6491d949c2f8d58c3e1003de054d101',
  validate_literature_gold_import_review_payload_v2:
    '1f8f0d7520107eeb34822291be6cfebcc3c5c48534e997f3f9a3ae4a90c839a7',
  validate_literature_gold_operation_authorization_v2:
    '3413b9c9ddbd3ff5eae74f5a3a24e0692f928693acf8423152d37a234be3eeb7',
  validate_literature_gold_operation_plan_v2:
    '1280125d16d699d439c87b65fceec63be567d1c5f5185a62066645287624bb93',
} as const

export const V2_SEMANTIC_FUNCTION_METADATA_SQL = String.raw`
with required(name) as (
  values
    ('apply_literature_gold_import_v2'),
    ('compensate_literature_gold_import_v2'),
    ('enforce_literature_gold_operation_contract_v2'),
    ('enforce_literature_gold_review_contract_v2'),
    ('reconcile_literature_gold_review_operation_v2'),
    ('validate_literature_gold_import_review_payload_v2'),
    ('validate_literature_gold_operation_authorization_v2'),
    ('validate_literature_gold_operation_plan_v2'),
    ('literature_gold_review_clinical_projection_v2'),
    ('literature_gold_effective_state_hash_v2'),
    ('literature_gold_physical_state_hash_v2'),
    ('literature_gold_review_operation_receipt_v2'),
    ('literature_gold_review_operation_result_v2')
)
select pg_catalog.jsonb_build_object(
  'functions', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name', proc.proname,
    'rawDefinitionSha256', pg_catalog.encode(extensions.digest(
      pg_catalog.convert_to(pg_catalog.pg_get_functiondef(proc.oid), 'UTF8'), 'sha256'
    ), 'hex'),
    'identityArguments', pg_catalog.pg_get_function_identity_arguments(proc.oid),
    'resultType', pg_catalog.pg_get_function_result(proc.oid),
    'volatility', proc.provolatile,
    'owner', owner.rolname,
    'securityDefiner', proc.prosecdef,
    'searchPath', coalesce((
      select pg_catalog.regexp_replace(setting, '^search_path=', '')
      from unnest(coalesce(proc.proconfig, array[]::text[])) setting
      where setting like 'search_path=%'
      limit 1
    ), ''),
    'publicExecute', exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        proc.proacl, pg_catalog.acldefault('f', proc.proowner)
      )) acl where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    ),
    'anonExecute', pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE'),
    'authenticatedExecute', pg_catalog.has_function_privilege(
      'authenticated', proc.oid, 'EXECUTE'),
    'serviceRoleExecute', pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE')
  ) order by proc.proname), '[]'::jsonb)
)
from required
join pg_catalog.pg_namespace namespace on namespace.nspname = 'public'
join pg_catalog.pg_proc proc
  on proc.proname = required.name and proc.pronamespace = namespace.oid
join pg_catalog.pg_roles owner on owner.oid = proc.proowner;`

const POSTGRES_OWNER_PROJECTION_ALTERS = [
  'alter function public.apply_literature_gold_import_v1(uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text) owner to postgres;',
  'alter function public.compensate_literature_gold_import_v1(uuid, uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text) owner to postgres;',
  'alter function public.reconcile_literature_gold_review_operation_v1(uuid, text, jsonb) owner to postgres;',
  'alter function public.apply_literature_gold_import_v2(uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text) owner to postgres;',
  'alter function public.compensate_literature_gold_import_v2(uuid, uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text) owner to postgres;',
  'alter function public.enforce_literature_gold_operation_contract_v2() owner to postgres;',
  'alter function public.enforce_literature_gold_review_contract_v2() owner to postgres;',
  'alter function public.literature_gold_review_operation_receipt_v2(uuid, boolean) owner to postgres;',
  'alter function public.literature_gold_review_operation_result_v2(uuid, boolean) owner to postgres;',
  'alter function public.reconcile_literature_gold_review_operation_v2(uuid, text, jsonb) owner to postgres;',
  'alter function public.validate_literature_gold_operation_authorization_v2(jsonb, text, text, uuid, uuid, uuid, text, text, text, jsonb) owner to postgres;',
  'alter function public.validate_literature_gold_operation_plan_v2(jsonb, text, uuid, uuid, text, text, text) owner to postgres;',
  'alter function public.validate_literature_gold_import_review_payload_v2(uuid, jsonb, boolean) owner to postgres;',
  'alter function public.literature_gold_review_clinical_projection_v2(uuid) owner to postgres;',
  'alter function public.literature_gold_effective_state_hash_v2(uuid, text) owner to postgres;',
  'alter function public.literature_gold_physical_state_hash_v2(uuid, text) owner to postgres;',
] as const

/**
 * Authenticate the supported local owner representation against the same
 * catalog objects. The owner changes and introspection share one transaction;
 * ROLLBACK guarantees the disposable supabase_admin profile is restored.
 */
export function postgresOwnerProjectionSql(introspectionSql: string): string {
  const trimmed = introspectionSql.trim().replace(/;$/u, '')
  if (!trimmed.startsWith('with ') || trimmed.includes('alter function')) {
    throw new Error('Postgres owner projection accepts only fixed read-only introspection SQL.')
  }
  return `begin;\n${POSTGRES_OWNER_PROJECTION_ALTERS.join('\n')}\n${trimmed};\nrollback;`
}

export function validateV2SemanticFunctionMetadata(
  value: unknown,
  ownerProfile: 'postgres' | 'supabase_admin',
) {
  const parsed = z
    .object({
      functions: z.array(
        z
          .object({
            anonExecute: z.boolean(),
            authenticatedExecute: z.boolean(),
            identityArguments: z.string(),
            name: z.string(),
            owner: z.string(),
            publicExecute: z.boolean(),
            rawDefinitionSha256: z.string().regex(SHA256_PATTERN),
            resultType: z.string(),
            searchPath: z.string(),
            securityDefiner: z.boolean(),
            serviceRoleExecute: z.boolean(),
            volatility: z.string(),
          })
          .strict(),
      ),
    })
    .strict()
    .parse(value)
  const expected = [...REQUIRED_V2_SEMANTIC_FUNCTIONS].sort()
  const actual = parsed.functions.map(({ name }) => name).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Required V2 semantic function set changed unexpectedly.')
  }
  const validated = parsed.functions.map((function_) => {
    const contract =
      V2_SEMANTIC_FUNCTION_CONTRACTS[function_.name as keyof typeof V2_SEMANTIC_FUNCTION_CONTRACTS]
    const exactIdentity =
      GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES[
        function_.name as keyof typeof GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES
      ]
    const rawDefinitionSha256 =
      V2_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256[
        function_.name as keyof typeof V2_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256
      ]
    if (
      !contract ||
      !exactIdentity ||
      !rawDefinitionSha256 ||
      function_.identityArguments !== exactIdentity.identityArguments ||
      function_.rawDefinitionSha256 !== rawDefinitionSha256 ||
      function_.owner !== ownerProfile ||
      function_.identityArguments !== contract.identityArguments ||
      function_.resultType !== contract.resultType ||
      function_.volatility !== contract.volatility ||
      function_.searchPath !== contract.searchPath ||
      function_.securityDefiner !== contract.securityDefiner ||
      function_.publicExecute ||
      function_.anonExecute ||
      function_.authenticatedExecute ||
      function_.serviceRoleExecute !== contract.serviceRoleExecute
    ) {
      throw new Error(`Unsafe or changed metadata for V2 function ${function_.name}.`)
    }
    return function_
  })
  return validated.sort((left, right) => left.name.localeCompare(right.name, 'en'))
}

function canonicalArtifactsEqual(
  left: ReadonlyMap<string, Buffer>,
  right: ReadonlyMap<string, Buffer>,
): boolean {
  if (left.size !== right.size) return false
  return [...left.entries()].every(([name, bytes]) =>
    bytes.equals(right.get(name) ?? Buffer.alloc(0)),
  )
}

export function assertDeterministicV2RehearsalRuns(
  first: V2DisposablePathResult,
  second: V2DisposablePathResult,
): V2DeterminismResult {
  if (first.migrationPath !== second.migrationPath) {
    throw new Error('Cannot compare V2 rehearsal determinism across different migration paths.')
  }
  if (!canonicalArtifactsEqual(first.canonicalArtifacts, second.canonicalArtifacts)) {
    throw new Error('Repeated V2 rehearsal runs produced different canonical artifacts.')
  }
  return {
    canonicalArtifacts: first.canonicalArtifacts,
    first,
    migrationPath: first.migrationPath,
    second,
  }
}

const ACTIVE_CHILDREN = new Set<ReturnType<typeof spawn>>()

function productionCommand(
  commandName: string,
  arguments_: string[],
  options: DisposableCommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(commandName, arguments_, {
      cwd: REPOSITORY_ROOT,
      env: sanitizeRehearsalChildEnvironment(process.env, options.env ?? {}),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    ACTIVE_CHILDREN.add(child)
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      ACTIVE_CHILDREN.delete(child)
      rejectPromise(error)
    })
    child.on('close', (code) => {
      ACTIVE_CHILDREN.delete(child)
      if (code === 0) {
        resolvePromise({ stderr, stdout })
        return
      }
      const safeArguments = arguments_.map((argument) =>
        /^(?:PGPASSWORD|POSTGRES_PASSWORD)=/u.test(argument)
          ? `${argument.slice(0, argument.indexOf('='))}=[redacted]`
          : argument,
      )
      rejectPromise(
        new Error(
          `${commandName} ${safeArguments.join(' ')} exited with ${code ?? 'unknown'}:\n${stderr || stdout}`,
        ),
      )
    })
    child.stdin.end(options.stdin)
  })
}

const PRODUCTION_RUNTIME: DisposableRuntime = {
  cancelActiveCommand: (signal) => {
    for (const child of ACTIVE_CHILDREN) child.kill(signal)
  },
  command: productionCommand,
  environment: process.env,
  now: () => new Date().toISOString(),
}

export async function resolveV2LocalDockerEndpoint(
  runtime: DisposableRuntime,
): Promise<{ context: string; endpoint: string }> {
  const environment = runtime.environment ?? {}
  const host = environment.DOCKER_HOST?.trim() ?? ''
  const contextOverride = environment.DOCKER_CONTEXT?.trim() ?? ''
  if (host && contextOverride)
    throw new Error('Ambiguous Docker host/context overrides are forbidden.')
  if (host) {
    assertLocalDockerEndpoint(host)
    return { context: '(explicit-local-endpoint)', endpoint: host }
  }
  const context =
    contextOverride ||
    (await runtime.command('docker', ['context', 'show'], { env: {} })).stdout.trim()
  if (!DOCKER_CONTEXT_PATTERN.test(context)) throw new Error('Invalid Docker context name.')
  const rawEndpoint = (
    await runtime.command(
      'docker',
      ['context', 'inspect', context, '--format', '{{json .Endpoints.docker.Host}}'],
      { env: {} },
    )
  ).stdout.trim()
  let endpoint: unknown
  try {
    endpoint = JSON.parse(rawEndpoint) as unknown
  } catch {
    throw new Error('Docker context endpoint was not valid JSON.')
  }
  if (typeof endpoint !== 'string') throw new Error('Docker context endpoint was not a string.')
  assertLocalDockerEndpoint(endpoint)
  return { context, endpoint }
}

async function executeV2DisposablePathWithRuntime(
  input: ExecuteV2DisposablePathRuntimeInput,
  runtime: DisposableRuntime,
): Promise<V2DisposablePathRuntimeResult> {
  if (
    (input.evidenceMode === 'canonical_delivery') !== Boolean(input.evidenceBindings) ||
    (input.evidenceMode !== 'canonical_delivery' && input.evidenceBindings)
  ) {
    throw new Error('V2 disposable evidence mode and exact A/B bindings disagree.')
  }
  const seed = developmentDatabaseSeedSchema.parse(input.seed)
  const pathPlan = buildV2MigrationPathPlan(input.migrationPath)
  const preV1SeedSql = renderDevelopmentDatabaseSeedSql(seed)
  const postV2SeedSql =
    pathPlan.seedMode === 'migration_equivalent_post_v2_projection'
      ? renderPostV2CompatibleDevelopmentSeedSqlV2(seed)
      : null
  const startedAt = runtime.now()
  const containerName = `ip-gold-v2-${input.migrationPath}-${process.pid}-${randomBytes(5).toString('hex')}`
  const database = `gold_compensation_v2_${input.migrationPath}_${process.pid}_${randomBytes(3).toString('hex')}`
  const databaseUser = 'supabase_admin'
  const password = randomBytes(24).toString('hex')
  const nonce = randomBytes(16).toString('hex')
  let dockerEndpoint = ''
  let dockerContext = ''
  let containerId = ''
  let hostPort = ''
  let creationAttempted = false
  let primaryError: unknown
  let result: V2DisposablePathRuntimeResultWithoutCleanup | undefined

  const docker = (arguments_: string[], options: DisposableCommandOptions = {}) =>
    runtime.command('docker', arguments_, {
      ...options,
      env: { ...(options.env ?? {}), ...(dockerEndpoint ? { DOCKER_HOST: dockerEndpoint } : {}) },
    })
  const psql = (sql: string, json = false) => {
    const arguments_ = [
      'exec',
      '--env',
      `PGPASSWORD=${password}`,
      '-i',
      containerName,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--host',
      '127.0.0.1',
      '--username',
      databaseUser,
      '--dbname',
      database,
    ]
    if (json) arguments_.push('--tuples-only', '--no-align', '--quiet')
    return docker(arguments_, { stdin: sql })
  }
  const queryJson = async (sql: string): Promise<unknown> => {
    const text = (await psql(sql, true)).stdout.trim()
    try {
      return JSON.parse(text) as unknown
    } catch (error) {
      throw new Error(
        `Disposable V2 query did not return JSON: ${error instanceof Error ? error.message : String(error)}.`,
      )
    }
  }

  try {
    const localDocker = await resolveV2LocalDockerEndpoint(runtime)
    dockerEndpoint = localDocker.endpoint
    dockerContext = localDocker.context
    creationAttempted = true
    containerId = (
      await docker([
        'run',
        '--detach',
        '--rm',
        '--name',
        containerName,
        '--label',
        `${CONTAINER_LABEL}=${nonce}`,
        '--publish',
        '127.0.0.1::5432',
        '--env',
        `POSTGRES_PASSWORD=${password}`,
        '--env',
        `POSTGRES_DB=${database}`,
        DISPOSABLE_POSTGRES_IMAGE,
      ])
    ).stdout.trim()
    if (!/^[a-f0-9]{12,64}$/u.test(containerId)) {
      throw new Error('Docker did not return an owned disposable V2 container ID.')
    }
    const ownership = z
      .object({
        Config: z.object({ Labels: z.record(z.string(), z.string()).nullable() }).passthrough(),
        Id: z.string().regex(/^[a-f0-9]{64}$/u),
        Name: z.string(),
        NetworkSettings: z
          .object({
            Ports: z.record(
              z.string(),
              z.array(z.object({ HostIp: z.string(), HostPort: z.string() }).strict()).nullable(),
            ),
          })
          .passthrough(),
      })
      .passthrough()
      .parse(
        JSON.parse((await docker(['inspect', '--format', '{{json .}}', containerName])).stdout),
      )
    const binding = ownership.NetworkSettings.Ports['5432/tcp']?.[0]
    hostPort = binding?.HostPort ?? ''
    if (
      ownership.Id !== containerId ||
      ownership.Name !== `/${containerName}` ||
      ownership.Config.Labels?.[CONTAINER_LABEL] !== nonce ||
      binding?.HostIp !== '127.0.0.1' ||
      !/^\d{1,5}$/u.test(hostPort) ||
      hostPort === PROTECTED_REAL_LOCAL_DATABASE_PORT
    ) {
      throw new Error('Disposable V2 container ownership or loopback-port attestation failed.')
    }

    let ready = false
    let lastError = ''
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        if ((await psql('select 1;', true)).stdout.trim() === '1') {
          ready = true
          break
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 250))
    }
    if (!ready) throw new Error(`Disposable V2 PostgreSQL did not become ready. ${lastError}`)

    await psql(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  name text,
  statements text[]
);`)

    const migrationBytes = new Map<string, Buffer>()
    for (const filename of V2_REHEARSAL_MIGRATIONS) {
      migrationBytes.set(
        filename,
        await readFile(resolve(REPOSITORY_ROOT, 'supabase/migrations', filename)),
      )
    }
    const v2Bytes = migrationBytes.get(V2_MIGRATION_FILENAME)
    if (!v2Bytes) throw new Error('Fixed V2 migration bytes are missing.')
    const migrationSha256 = sha256(v2Bytes)

    const applyFixedMigration = async (filename: string) => {
      const bytes = migrationBytes.get(filename)
      if (!bytes) throw new Error(`Fixed migration bytes missing for ${filename}.`)
      await psql(migrationLedgerSql(filename, bytes.toString('utf8')))
    }
    for (const filename of pathPlan.migrationsBeforeSeed) {
      await applyFixedMigration(filename)
    }
    let schemaOnlyUpgrade: { after: unknown; before: unknown } | null = null
    let postV2SeedSnapshot: V2SchemaOnlySnapshot
    if (input.migrationPath === 'upgrade') {
      if (
        canonicalJson(pathPlan.migrationsBeforeSeed) !==
          canonicalJson(HISTORICAL_LITERATURE_MIGRATIONS) ||
        canonicalJson(pathPlan.migrationsToReachV1AfterSeed) !==
          canonicalJson([V1_MIGRATION_FILENAME]) ||
        canonicalJson(pathPlan.migrationsFromV1ToV2) !== canonicalJson([V2_MIGRATION_FILENAME]) ||
        !pathPlan.requiresAcceptedV1UpgradeBracket ||
        pathPlan.seedMode !== 'exact_pre_v1' ||
        postV2SeedSql !== null
      ) {
        throw new Error('Upgrade path lost its exact pre-V1 seed and V1-to-V2 bracket.')
      }
      await psql(preV1SeedSql)
      await applyFixedMigration(V1_MIGRATION_FILENAME)
      const before = await collectV2SchemaOnlySnapshot(
        queryJson,
        seed.batchId,
        'upgrade pre-V2 seed snapshot',
      )
      await applyFixedMigration(V2_MIGRATION_FILENAME)
      const after = await collectV2SchemaOnlySnapshot(
        queryJson,
        seed.batchId,
        'upgrade post-V2 seed snapshot',
      )
      const proof = assertV2SchemaOnlyUpgradePreserved({ after, before })
      schemaOnlyUpgrade = { after: proof.after, before: proof.before }
      postV2SeedSnapshot = proof.after
    } else {
      if (
        canonicalJson(pathPlan.migrationsBeforeSeed) !== canonicalJson(V2_REHEARSAL_MIGRATIONS) ||
        pathPlan.migrationsToReachV1AfterSeed.length !== 0 ||
        pathPlan.migrationsFromV1ToV2.length !== 0 ||
        pathPlan.requiresAcceptedV1UpgradeBracket ||
        pathPlan.seedMode !== 'migration_equivalent_post_v2_projection' ||
        postV2SeedSql === null
      ) {
        throw new Error('Fresh path lost its empty full-schema then projected-seed boundary.')
      }
      await psql(postV2SeedSql)
      postV2SeedSnapshot = await collectV2SchemaOnlySnapshot(
        queryJson,
        seed.batchId,
        'fresh post-V2 projected seed snapshot',
      )
    }

    const ledger = z
      .object({ v1: z.literal(1), v2: z.literal(1) })
      .strict()
      .parse(
        await queryJson(`select pg_catalog.jsonb_build_object(
          'v1', count(*) filter (where version = '20260808035633')::integer,
          'v2', count(*) filter (where version = '20260809231651')::integer
        ) from supabase_migrations.schema_migrations;`),
      )

    const v1VerifierBytes = await readFile(
      resolve(REPOSITORY_ROOT, 'supabase/verification', GOLD_IMPORT_COMPENSATION_VERIFICATION_V1),
    )
    const v1Verification = await psql(v1VerifierBytes.toString('utf8'))
    const rawV1Evidence = validateSqlScenarioEvidence(
      extractSqlScenarioEvidence(`${v1Verification.stdout}\n${v1Verification.stderr}`),
    )
    const v1Evidence = buildCanonicalScenarioEvidence(
      rawV1Evidence,
      sha256(migrationBytes.get(V1_MIGRATION_FILENAME) as Buffer),
      sha256(v1VerifierBytes),
    )

    const v2VerifierBytes = await readFile(
      resolve(REPOSITORY_ROOT, 'supabase/verification', GOLD_IMPORT_COMPENSATION_VERIFICATION_V2),
    )
    const v2Verification = await psql(v2VerifierBytes.toString('utf8'))
    const v2Evidence = extractV2VerifierEvidence(
      `${v2Verification.stdout}\n${v2Verification.stderr}`,
    )

    const disposableRpcMetadata = validateV2RpcMetadata(
      await queryJson(V2_RPC_METADATA_SQL),
      'supabase_admin',
    )
    const disposableSemanticFunctions = validateV2SemanticFunctionMetadata(
      await queryJson(V2_SEMANTIC_FUNCTION_METADATA_SQL),
      'supabase_admin',
    )
    const supportedLocalPostgresRpcProjection = validateV2RpcMetadata(
      await queryJson(postgresOwnerProjectionSql(V2_RPC_METADATA_SQL)),
      'postgres',
    )
    const supportedLocalPostgresSemanticProjection = validateV2SemanticFunctionMetadata(
      await queryJson(postgresOwnerProjectionSql(V2_SEMANTIC_FUNCTION_METADATA_SQL)),
      'postgres',
    )
    const restoredDisposableRpcMetadata = validateV2RpcMetadata(
      await queryJson(V2_RPC_METADATA_SQL),
      'supabase_admin',
    )
    const restoredDisposableSemanticFunctions = validateV2SemanticFunctionMetadata(
      await queryJson(V2_SEMANTIC_FUNCTION_METADATA_SQL),
      'supabase_admin',
    )
    if (
      canonicalJson(disposableRpcMetadata) !== canonicalJson(restoredDisposableRpcMetadata) ||
      canonicalJson(disposableSemanticFunctions) !==
        canonicalJson(restoredDisposableSemanticFunctions)
    ) {
      throw new Error('Transactional postgres-owner projection did not restore catalog owners.')
    }
    const packageEvidence = await input.exactPackageExecutor.execute({
      batchId: seed.batchId,
      migrationPath: input.migrationPath,
      migrationSha256,
      postV2SeedSnapshot,
      // The shared production catalog collector parses a checksum-bound marker line. Keep the
      // disposable transport byte-compatible with the local operator's tuples-only/no-align mode.
      psql: (sql) => psql(sql, true),
      queryJson,
      schemaOnlyUpgrade,
    })
    const canonicalArtifactInput = {
      migrationPath: input.migrationPath,
      migrationSha256,
      operationScenarios: packageEvidence.operationScenarios,
      productionCohort: packageEvidence.productionCohort,
      schemaOnlyUpgrade,
      verifierEvidence: {
        postV2SeedProjection: {
          migrationEquivalentToUpgrade: true,
          seedMode: pathPlan.seedMode,
          snapshot: postV2SeedSnapshot,
        },
        ownerProfiles: {
          disposableSupabaseAdmin: {
            rpcMetadata: disposableRpcMetadata,
            semanticFunctions: disposableSemanticFunctions,
          },
          supportedLocalPostgresProjection: {
            authenticatedByTransactionalCatalogProjection: true,
            rpcMetadata: supportedLocalPostgresRpcProjection,
            semanticFunctions: supportedLocalPostgresSemanticProjection,
          },
          transactionalProjectionRollbackRestored: true,
        },
        v1: v1Evidence,
        v2: v2Evidence,
      },
    }
    const resultBase = {
      migrationPath: input.migrationPath,
      migrationSha256,
      rawReceipt: {
        authorizationBindings: input.evidenceBindings
          ? {
              authority: 'exact_committed_disposable_catalog_and_protected_runtime_bundle',
              completeCatalogAudit: input.evidenceBindings.completeCatalogAudit,
              expectedCatalog: input.evidenceBindings.expectedCatalog,
              operatorBundleBinding: input.evidenceBindings.operatorBundleBinding,
            }
          : {
              authority: 'transient_catalog_probe_not_delivery_evidence',
              completeCatalogAudit: null,
              expectedCatalog: null,
              operatorBundleBinding: null,
            },
        completedAt: runtime.now(),
        databaseMutationOutsideDisposableTarget: false,
        disposableRuntime: {
          automaticallyAssignedPort: hostPort,
          containerId,
          containerName,
          dockerContext,
          dockerEndpoint,
          host: '127.0.0.1',
          image: DISPOSABLE_POSTGRES_IMAGE,
        },
        heldOutIdentitiesAccessed: false,
        migrationLedger: ledger,
        migrationPath: input.migrationPath,
        seedMode: pathPlan.seedMode,
        realLocalDatabaseTouched: false,
        remoteDatabaseTouched: false,
        startedAt,
      },
    }
    result = input.evidenceBindings
      ? {
          ...resultBase,
          canonicalArtifacts: buildCanonicalV2RehearsalArtifacts({
            ...canonicalArtifactInput,
            authorizationBindings: input.evidenceBindings,
          }),
          evidenceAuthority: 'canonical_delivery_evidence',
        }
      : {
          ...resultBase,
          evidenceAuthority: 'transient_catalog_probe_not_delivery_evidence',
        }
  } catch (error) {
    primaryError = error
  }

  const cleanup = await cleanupDisposableContainer({
    armed: creationAttempted,
    containerId,
    containerName,
    dockerCommand: (arguments_) => docker(arguments_),
  })
  if (primaryError || cleanup.outcome !== 'removed_and_verified_absent') {
    const errors = [
      primaryError,
      ...(cleanup.outcome === 'removed_and_verified_absent'
        ? []
        : [new Error(`Disposable V2 cleanup failed: ${JSON.stringify(cleanup)}`)]),
    ].filter(Boolean)
    throw errors.length === 1
      ? errors[0]
      : new AggregateError(errors, 'V2 disposable rehearsal and cleanup did not both pass.')
  }
  if (!result) throw new Error('V2 disposable rehearsal produced no result.')
  return result.evidenceAuthority === 'canonical_delivery_evidence'
    ? { ...result, cleanup }
    : { ...result, cleanup }
}

export async function executeV2DisposablePath(
  input: ExecuteV2DisposablePathInput,
): Promise<V2DisposablePathResult> {
  validateV2CanonicalAuthorizationBindings(input.evidenceBindings)
  const result = await executeV2DisposablePathWithRuntime(
    { ...input, evidenceMode: 'canonical_delivery' },
    PRODUCTION_RUNTIME,
  )
  if (result.evidenceAuthority !== 'canonical_delivery_evidence') {
    throw new Error('V2 production rehearsal returned non-delivery evidence.')
  }
  return result
}

/** Production-only transient path for the catalog drift matrix; never delivery evidence. */
export async function executeV2DisposableCatalogProbePath(
  input: ExecuteV2DisposableCatalogProbeInput,
): Promise<V2DisposableCatalogProbeResult> {
  const result = await executeV2DisposablePathWithRuntime(
    { ...input, evidenceMode: 'catalog_drift_probe' },
    PRODUCTION_RUNTIME,
  )
  if (result.evidenceAuthority !== 'transient_catalog_probe_not_delivery_evidence') {
    throw new Error('V2 catalog probe unexpectedly produced delivery evidence.')
  }
  return result
}

/** Maintainer-only disposable expectation proposal capture; never delivery evidence. */
export async function executeV2DisposableCatalogExpectationProposalPath(
  input: ExecuteV2DisposableCatalogProbeInput,
): Promise<V2DisposableCatalogExpectationProposalResult> {
  const result = await executeV2DisposablePathWithRuntime(
    { ...input, evidenceMode: 'catalog_expectation_proposal' },
    PRODUCTION_RUNTIME,
  )
  return {
    cleanup: result.cleanup,
    migrationPath: result.migrationPath,
    migrationSha256: result.migrationSha256,
    status: 'transient_catalog_expectation_proposal_not_delivery_evidence',
  }
}

export async function executeV2DisposablePathForTest(
  input: Omit<ExecuteV2DisposablePathRuntimeInput, 'evidenceMode'> & {
    evidenceMode?: ExecuteV2DisposablePathRuntimeInput['evidenceMode']
  },
  runtime: DisposableRuntime,
): Promise<V2DisposablePathRuntimeResult> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('V2 disposable runtime injection is restricted to tests.')
  }
  if (input.evidenceBindings) validateV2CanonicalAuthorizationBindings(input.evidenceBindings)
  return executeV2DisposablePathWithRuntime(
    { ...input, evidenceMode: input.evidenceMode ?? 'catalog_drift_probe' },
    runtime,
  )
}

export async function executeV2DisposablePathTwice(
  input: ExecuteV2DisposablePathInput,
): Promise<V2DeterminismResult> {
  const first = await executeV2DisposablePath(input)
  const second = await executeV2DisposablePath(input)
  return assertDeterministicV2RehearsalRuns(first, second)
}

// Compile-time and source-level sentinels keep the operational target fixed.
void GOLD_IMPORT_COMPENSATION_MIGRATION_V2
void REQUIRED_TRANSITION_RPCS_V1
void REQUIRED_TRANSITION_RPCS_V2
void SHA256_PATTERN
