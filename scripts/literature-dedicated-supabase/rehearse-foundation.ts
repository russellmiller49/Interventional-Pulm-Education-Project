/**
 * Disposable rehearsal for the dedicated Literature foundation migration.
 *
 * Creates a throwaway PostgreSQL 17 container that stands in for a brand-new Supabase project,
 * applies exactly the immutable foundation migration to it in a single transaction, proves the
 * resulting foundation-owned catalog matches the committed expectations artifact byte for byte,
 * exercises the failure modes a real rollout could hit, and then destroys only what it created.
 *
 * ## What this does and does not prove
 *
 *   - **Proven in the Supabase Postgres image:** the SQL applies transactionally; the exact
 *     foundation-owned catalog it produces; RLS/grant/ACL posture; `anon` denial; empty-search
 *     validity; rejection of a second application; full rollback on late collisions (view,
 *     index-name, wrong-schema `pg_trgm`); that unrelated managed-baseline state (extra installed
 *     extensions, pre-existing `pg_default_acl` rows) does **not** read as drift; that the
 *     migration leaves default and schema privileges unchanged (empty pre/post delta); and that
 *     every preflight-plan statement is existence-safe on a database with no migration-history
 *     table and no Literature relation.
 *   - **Modeled locally:** migration-history recording. The rehearsal inserts the history row
 *     itself, so the recorded *version* here is a local model, not evidence of what Supabase's
 *     managed `apply_migration` records. See `LITERATURE_MIGRATION_HISTORY_FIDELITY`.
 *   - **Not proven here at all:** anything about the managed hosted project. The managed baseline
 *     is only ever *scoped* through read-only observation requirements, and the pre/post
 *     global-state delta on the managed project is an execution-time, provider-bound requirement.
 *     While the Layer-3 adapter is unimplemented, nothing in this rehearsal — or anywhere else in
 *     this repository — can produce a production success verdict.
 *
 * Never call the modeled parts "proved production behavior".
 *
 * It never touches the protected real-local Literature database. The rehearsal container publishes
 * no port, so there is no TCP surface at all; every statement travels through `docker exec … psql`
 * over the container's own unix socket.
 *
 *   npx tsx scripts/literature-dedicated-supabase/rehearse-foundation.ts
 *   npx tsx scripts/literature-dedicated-supabase/rehearse-foundation.ts --emit-expectations
 */

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_FOUNDATION_MIGRATION,
  evaluateLiteratureFoundationSelection,
  LITERATURE_APPROVED_APPLICATION_MECHANISM,
} from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  LITERATURE_FOUNDATION_OBJECT_COUNTS,
  LITERATURE_FOUNDATION_RUNTIME_RPCS,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import {
  MIGRATION_HISTORY_BOOTSTRAP_SQL,
  REHEARSAL_DATABASE,
  REHEARSAL_POSTGRES_IMAGE,
  REHEARSAL_SUPERUSER,
  assertLocalDockerEndpoint,
  assertNotProtectedResource,
  rehearsalResourceName,
  runCommand,
} from './lib/disposable-target'
import {
  LITERATURE_CATALOG_INSPECTION_SQL,
  LITERATURE_ROW_COUNT_SQL,
  buildCatalogExpectationArtifact,
  canonicalJson,
  classifyPgTrgmState,
  compareGlobalStateDelta,
  compareLiteratureCatalog,
  evaluateManagedPrerequisiteState,
  summarizeCatalogPresence,
  type LiteratureCatalogExpectationArtifact,
  type LiteratureCatalogSnapshot,
} from './lib/foundation-catalog'
import { evaluateEvidenceContentPreflight, allChecksPassed } from './lib/preflight-rules'
import { classifyLiteratureRollout, resolveLostAcknowledgement } from './lib/reconciliation'
import {
  LITERATURE_FOUNDATION_TABLE_EXISTENCE_STATEMENT,
  LITERATURE_HISTORY_TABLE_EXISTENCE_STATEMENT,
  LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256,
  LITERATURE_PREFLIGHT_QUERY_PLAN,
  LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
  LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT,
} from './lib/target-observation'
import { parseLiteraturePostflightEvidence } from './lib/evidence-schema'
import type { LiteraturePreflightEvidenceDocument } from './lib/evidence-schema'

const ROOT = process.cwd()
const ARTIFACT_PATH =
  'src/features/literature/dedicated-supabase/foundation-catalog-expectations.json'
const VIEW_PROBE_DATABASE = 'literature_rollback_probe'
const INDEX_PROBE_DATABASE = 'literature_index_collision_probe'
const TRGM_PROBE_DATABASE = 'literature_trgm_schema_probe'
const BARE_PROBE_DATABASE = 'literature_bare_probe'
const UNRELATED_PROBE_DATABASE = 'literature_unrelated_object_probe'
const CONTAINER_READY_TIMEOUT_MS = 90_000
const CONTAINER_READY_POLL_MS = 500

const EMIT_EXPECTATIONS = process.argv.includes('--emit-expectations')

interface Scenario {
  id: string
  description: string
  passed: boolean
  detail: string
}

const scenarios: Scenario[] = []

function record(id: string, description: string, passed: boolean, detail: string) {
  scenarios.push({ id, description, passed, detail })
  process.stdout.write(`  [${passed ? 'PASS' : 'FAIL'}] ${id} — ${description}\n`)
  if (!passed) process.stdout.write(`         ${detail}\n`)
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function dockerEndpoint() {
  const context = (await runCommand('docker', ['context', 'show'])).stdout.trim()
  const endpoint = (
    await runCommand('docker', [
      'context',
      'inspect',
      context,
      '--format',
      '{{.Endpoints.docker.Host}}',
    ])
  ).stdout.trim()
  assertLocalDockerEndpoint(endpoint)
  return { context, endpoint }
}

interface PsqlOptions {
  database?: string
  role?: string
  singleTransaction?: boolean
  allowFailure?: boolean
}

async function psql(container: string, sql: string, options: PsqlOptions = {}) {
  assertNotProtectedResource(container)
  const argumentList = [
    'exec',
    '--interactive',
    container,
    'psql',
    '--no-psqlrc',
    '--username',
    REHEARSAL_SUPERUSER,
    '--dbname',
    options.database ?? REHEARSAL_DATABASE,
    '--tuples-only',
    '--no-align',
    '--quiet',
  ]
  if (options.singleTransaction) argumentList.push('--single-transaction')
  argumentList.push('--set', 'ON_ERROR_STOP=1')

  const body = options.role ? `set role ${options.role};\n${sql}` : sql
  return runCommand('docker', argumentList, {
    stdin: body,
    allowFailure: options.allowFailure,
    timeoutMs: 120_000,
  })
}

async function psqlReadOnly(container: string, sql: string, options: PsqlOptions = {}) {
  return psql(
    container,
    ['begin read only;', 'set transaction read only;', sql, 'rollback;'].join('\n'),
    options,
  )
}

async function startContainer(container: string) {
  assertNotProtectedResource(container)
  // No published port: the rehearsal is unreachable over TCP and therefore cannot collide with the
  // protected stack on 55322.
  await runCommand('docker', [
    'run',
    '--detach',
    '--name',
    container,
    '--env',
    'POSTGRES_PASSWORD=rehearsal-only-not-a-real-credential',
    '--env',
    `POSTGRES_USER=${REHEARSAL_SUPERUSER}`,
    REHEARSAL_POSTGRES_IMAGE,
  ])

  const deadline = Date.now() + CONTAINER_READY_TIMEOUT_MS
  for (;;) {
    const ready = await runCommand(
      'docker',
      ['exec', container, 'pg_isready', '--username', REHEARSAL_SUPERUSER, '--dbname', 'postgres'],
      { allowFailure: true },
    )
    if (ready.code === 0) return
    if (Date.now() > deadline) {
      throw new Error(`Rehearsal container ${container} did not become ready in time.`)
    }
    await new Promise((sleep) => setTimeout(sleep, CONTAINER_READY_POLL_MS))
  }
}

async function removeContainerByExactName(container: string) {
  assertNotProtectedResource(container)
  await runCommand('docker', ['rm', '--force', '--volumes', container], { allowFailure: true })
}

async function containerExists(container: string) {
  const result = await runCommand(
    'docker',
    ['ps', '--all', '--filter', `name=^${container}$`, '--format', '{{.Names}}'],
    { allowFailure: true },
  )
  return result.stdout.trim() === container
}

/** Make a database representative of a new Supabase project. */
async function establishBaseline(container: string, database: string) {
  await psql(container, `create database ${database};`, { database: 'postgres' })
  const rolesBefore = (
    await psql(
      container,
      `select coalesce(string_agg(rolname, ',' order by rolname), '') from pg_catalog.pg_roles
       where rolname in ('anon', 'authenticated', 'service_role');`,
      { database },
    )
  ).stdout.trim()
  const present = new Set(rolesBefore ? rolesBefore.split(',') : [])
  const created: string[] = []
  for (const role of ['anon', 'authenticated', 'service_role']) {
    if (present.has(role)) continue
    await psql(container, `create role ${role} nologin noinherit;`, { database })
    created.push(role)
  }
  await psql(container, `alter role service_role bypassrls;`, { database, allowFailure: true })
  await psql(container, `create schema if not exists extensions;`, { database })
  await psql(container, MIGRATION_HISTORY_BOOTSTRAP_SQL, { database })
  return { rolesAlreadyPresent: [...present].sort(), rolesCreated: created.sort() }
}

async function readCatalog(container: string, database = REHEARSAL_DATABASE) {
  const result = await psqlReadOnly(container, LITERATURE_CATALOG_INSPECTION_SQL, { database })
  const raw = result.stdout.trim()
  if (!raw) throw new Error('Catalog inspection returned no rows.')
  return JSON.parse(raw) as LiteratureCatalogSnapshot
}

async function historyRowCount(container: string, database: string) {
  return (
    await psqlReadOnly(container, 'select count(*) from supabase_migrations.schema_migrations;', {
      database,
    })
  ).stdout.trim()
}

/**
 * Build a preflight evidence document from a snapshot, exactly as the preflight query plan would:
 * existence probe first, versions only when the history table exists.
 */
function preflightEvidenceFrom(
  snapshot: LiteratureCatalogSnapshot,
  history: { tableExists: boolean; versions: string[] | null },
): LiteraturePreflightEvidenceDocument {
  return {
    schemaVersion: 'literature-dedicated-preflight-observation/3.0.0',
    queryPlanSha256: LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
    migrationHistory: history,
    catalog: snapshot as unknown as LiteraturePreflightEvidenceDocument['catalog'],
    prerequisites: {
      availableExtensions: ['pg_trgm'],
      roles: ['anon', 'authenticated', 'service_role'],
      schemas: ['extensions', 'public'],
    },
  }
}

async function main() {
  process.stdout.write('Literature dedicated-project foundation rehearsal\n')
  const { context, endpoint } = await dockerEndpoint()
  process.stdout.write(`  docker context ${context} (${endpoint})\n\n`)

  const migrationPath = resolve(ROOT, LITERATURE_FOUNDATION_MIGRATION.path)
  const migrationBytes = await readFile(migrationPath)
  const migrationSha256 = sha256(migrationBytes)
  const migrationSql = migrationBytes.toString('utf8')

  const container = rehearsalResourceName('target')
  const sentinel = rehearsalResourceName('sentinel')
  let cleanupVerified = false

  try {
    // ---- 1. Immutability of the selected migration -------------------------------------------
    record(
      'R01-migration-identity',
      'the foundation migration on disk matches the manifest SHA-256 and byte length',
      migrationSha256 === LITERATURE_FOUNDATION_MIGRATION.sha256 &&
        migrationBytes.byteLength === LITERATURE_FOUNDATION_MIGRATION.byteLength,
      `sha256=${migrationSha256} bytes=${migrationBytes.byteLength}`,
    )

    const drifted = Buffer.concat([migrationBytes, Buffer.from(' ')])
    const driftVerdict = evaluateLiteratureFoundationSelection({
      migrationPaths: [LITERATURE_FOUNDATION_MIGRATION.path],
      migrationSha256ByPath: { [LITERATURE_FOUNDATION_MIGRATION.path]: sha256(drifted) },
      migrationByteLengthByPath: { [LITERATURE_FOUNDATION_MIGRATION.path]: drifted.byteLength },
      targetProjectRef: 'itcttmkxdxvwmwcmzmey',
      appliedMigrationVersions: [],
      applicationMechanism: LITERATURE_APPROVED_APPLICATION_MECHANISM,
    })
    record(
      'R02-migration-drift-rejected',
      'a one-byte change to the migration is rejected by the manifest',
      !driftVerdict.approved &&
        driftVerdict.rejections.some((entry) => entry.reason === 'migration_checksum_mismatch'),
      driftVerdict.rejections.map((entry) => entry.reason).join(', ') || 'no rejection produced',
    )

    // ---- 2. Disposable baseline, with managed-style noise (H-1) --------------------------------
    await startContainer(container)
    await startContainer(sentinel)
    const baseline = await establishBaseline(container, REHEARSAL_DATABASE)
    record(
      'R03-baseline',
      'a clean disposable target with the Supabase roles and extensions schema exists',
      true,
      `rolesAlreadyPresent=[${baseline.rolesAlreadyPresent.join(', ')}] rolesCreated=[${baseline.rolesCreated.join(', ')}]`,
    )

    // Simulate the managed baseline the real project actually has: an unrelated installed
    // extension and pre-existing default-privilege rows. Neither belongs to the foundation
    // migration, so neither may read as drift (H-1).
    await psql(container, 'create extension if not exists pgcrypto with schema extensions;')
    await psql(
      container,
      'alter default privileges in schema public grant select on tables to service_role;',
    )
    const preCatalog = await readCatalog(container)
    record(
      'R04-managed-style-noise-installed',
      'an unrelated installed extension and a pre-existing pg_default_acl row are present ' +
        'before the migration',
      preCatalog.defaultPrivileges.length > 0 && classifyPgTrgmState(preCatalog).state === 'absent',
      `defaultPrivileges=${preCatalog.defaultPrivileges.length} ` +
        `pgTrgm=${classifyPgTrgmState(preCatalog).state}`,
    )

    const preLiteratureRelations = preCatalog.relations.filter((relation) =>
      relation.name.startsWith('literature'),
    )
    record(
      'R05-pre-migration-inventory',
      'no Literature object exists before the migration',
      preLiteratureRelations.length === 0 && preCatalog.functions.length === 0,
      `relations=${preLiteratureRelations.length} functions=${preCatalog.functions.length}`,
    )

    // The full preflight content evaluation must PASS on this noisy-but-clean baseline: unrelated
    // extensions and default-ACL rows are managed state, not collisions and not drift.
    const cleanPreflightChecks = evaluateEvidenceContentPreflight(
      preflightEvidenceFrom(preCatalog, { tableExists: true, versions: [] }),
    )
    record(
      'R06-preflight-passes-noisy-baseline',
      'every preflight content check passes on the noisy managed-style baseline',
      allChecksPassed(cleanPreflightChecks),
      cleanPreflightChecks
        .filter((entry) => !entry.passed)
        .map((entry) => `${entry.id}: ${entry.detail}`)
        .join('; ') || 'all passed',
    )

    // ---- 3. Preflight plan is existence-safe on a bare database (L-1) --------------------------
    // No roles bootstrap, no extensions schema, no history table, no Literature relation: every
    // unconditional preflight-plan statement must still succeed and return absence evidence.
    await psql(container, `create database ${BARE_PROBE_DATABASE};`, { database: 'postgres' })
    const bareHistory = await psqlReadOnly(
      container,
      'select exists (select 1 from pg_catalog.pg_class as c ' +
        'join pg_catalog.pg_namespace as n on n.oid = c.relnamespace ' +
        "where n.nspname = 'supabase_migrations' and c.relname = 'schema_migrations' " +
        "and c.relkind = 'r') as history_table_exists;",
      { database: BARE_PROBE_DATABASE },
    )
    const bareCatalogRun = await psqlReadOnly(container, LITERATURE_CATALOG_INSPECTION_SQL, {
      database: BARE_PROBE_DATABASE,
      allowFailure: true,
    })
    const barePrerequisites = await psql(container, LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT, {
      database: BARE_PROBE_DATABASE,
      allowFailure: true,
    })
    const bareTableProbe = await psql(container, LITERATURE_FOUNDATION_TABLE_EXISTENCE_STATEMENT, {
      database: BARE_PROBE_DATABASE,
      allowFailure: true,
    })
    const bareHistoryProbe = await psql(container, LITERATURE_HISTORY_TABLE_EXISTENCE_STATEMENT, {
      database: BARE_PROBE_DATABASE,
      allowFailure: true,
    })
    const conditionalSteps = LITERATURE_PREFLIGHT_QUERY_PLAN.steps.filter(
      (step) => step.conditionalOnProbe !== undefined,
    )
    record(
      'R07-preflight-plan-existence-safe',
      'every unconditional preflight-plan statement succeeds on a database with no history ' +
        'table and no Literature relation, and the versions statement is conditional',
      bareHistory.stdout.trim() === 'f' &&
        bareCatalogRun.code === 0 &&
        barePrerequisites.code === 0 &&
        bareTableProbe.code === 0 &&
        bareHistoryProbe.code === 0 &&
        conditionalSteps.length === 1 &&
        conditionalSteps[0].id === 'historyVersions',
      `historyExists=${bareHistory.stdout.trim()} catalogExit=${bareCatalogRun.code} ` +
        `prerequisitesExit=${barePrerequisites.code} tableProbeExit=${bareTableProbe.code} ` +
        `historyProbeExit=${bareHistoryProbe.code} conditional=[${conditionalSteps
          .map((step) => step.id)
          .join(', ')}]`,
    )

    // ---- 4. Runtime surfaces must fail before the migration ------------------------------------
    const searchBefore = await psql(container, 'select * from public.search_literature_v1();', {
      allowFailure: true,
    })
    const listBefore = await psql(container, 'select count(*) from public.literature_articles;', {
      allowFailure: true,
    })
    record(
      'R08-runtime-fails-before',
      'search and list fail before the migration rather than returning an empty corpus',
      searchBefore.code !== 0 && listBefore.code !== 0,
      `searchExit=${searchBefore.code} listExit=${listBefore.code}`,
    )

    // ---- 5. Apply exactly the foundation migration, in one transaction --------------------------
    await psql(container, migrationSql, { singleTransaction: true })
    // MODELED, not proven: a real managed apply assigns its own version. See the module header.
    await psql(
      container,
      `insert into supabase_migrations.schema_migrations (version, name)
       values ('${LITERATURE_FOUNDATION_MIGRATION.version}', '${LITERATURE_FOUNDATION_MIGRATION.name}');`,
    )
    const history = (
      await psqlReadOnly(
        container,
        `select coalesce(string_agg(version, ',' order by version), '')
         from supabase_migrations.schema_migrations;`,
      )
    ).stdout.trim()
    record(
      'R09-applied',
      'the migration applied as a single transaction and exactly one version is recorded (version string is modeled locally)',
      history.split(',').filter(Boolean).length === 1,
      `history=[${history}]`,
    )

    // ---- 6. Exact foundation-owned catalog ------------------------------------------------------
    const afterCatalog = await readCatalog(container)

    if (EMIT_EXPECTATIONS) {
      const generated = buildCatalogExpectationArtifact(afterCatalog)
      await writeFile(resolve(ROOT, ARTIFACT_PATH), canonicalJson(generated), 'utf8')
      process.stdout.write(`\n  Wrote expectations artifact to ${ARTIFACT_PATH}\n\n`)
    }

    const artifact = JSON.parse(
      await readFile(resolve(ROOT, ARTIFACT_PATH), 'utf8'),
    ) as LiteratureCatalogExpectationArtifact
    const comparison = compareLiteratureCatalog(afterCatalog, artifact)
    record(
      'R10-exact-foundation-catalog',
      'every foundation-owned relation, column, constraint, function definition, trigger, ' +
        'index, and ACL row matches the committed artifact despite the managed-style noise',
      comparison.matches,
      comparison.failures.join('; ') || 'exact match',
    )

    // H-1: the pre-existing unrelated extension and default-ACL rows are still there, and still
    // do not read as drift, because the exact scope is foundation-owned only.
    record(
      'R11-unrelated-baseline-not-drift',
      'unrelated installed extensions and pre-existing pg_default_acl rows do not fail the ' +
        'exact comparison',
      comparison.matches && afterCatalog.defaultPrivileges.length > 0,
      `defaultPrivileges=${afterCatalog.defaultPrivileges.length} (still present, not drift)`,
    )

    // H-1: the migration must leave the global-state sections untouched: empty pre/post delta.
    const delta = compareGlobalStateDelta(preCatalog, afterCatalog)
    record(
      'R12-global-state-delta-empty',
      'default privileges and schema privileges are unchanged across the apply (empty delta)',
      delta.matches,
      delta.failures.join('; ') || 'no delta',
    )

    // H-1: scoped prerequisite semantics after the apply.
    const postPrerequisites = evaluateManagedPrerequisiteState(afterCatalog, 'post_application')
    record(
      'R13-managed-prerequisites-post',
      'pg_trgm is installed in exactly the extensions schema and the API roles have the ' +
        'expected scoped attributes',
      postPrerequisites.every((entry) => entry.passed),
      postPrerequisites
        .map((entry) => `${entry.id}=${entry.passed ? 'pass' : entry.detail}`)
        .join('; '),
    )

    // H-1: the scoped checks must still detect material changes to the relevant roles.
    const tamperedRoleRun = await psql(
      container,
      [
        'begin;',
        'alter role service_role nobypassrls;',
        LITERATURE_CATALOG_INSPECTION_SQL,
        'rollback;',
      ].join('\n'),
    )
    const tamperedRoleSnapshot = JSON.parse(
      tamperedRoleRun.stdout.trim(),
    ) as LiteratureCatalogSnapshot
    const tamperedRoleChecks = evaluateManagedPrerequisiteState(
      tamperedRoleSnapshot,
      'post_application',
    )
    record(
      'R14-scoped-role-change-detected',
      'removing service_role RLS bypass is detected by the scoped prerequisite checks',
      tamperedRoleChecks.some((entry) => entry.id === 'Q04-rls-bypass-shape' && !entry.passed),
      tamperedRoleChecks.map((entry) => `${entry.id}=${entry.passed}`).join('; '),
    )

    // H-1: the delta comparison must still detect a material default-privilege change.
    const tamperedAclRun = await psql(
      container,
      [
        'begin;',
        'alter default privileges in schema public grant select on tables to anon;',
        LITERATURE_CATALOG_INSPECTION_SQL,
        'rollback;',
      ].join('\n'),
    )
    const tamperedAclSnapshot = JSON.parse(
      tamperedAclRun.stdout.trim(),
    ) as LiteratureCatalogSnapshot
    const tamperedDelta = compareGlobalStateDelta(preCatalog, tamperedAclSnapshot)
    record(
      'R15-material-delta-detected',
      'a new default-privilege grant is detected by the pre/post delta comparison',
      !tamperedDelta.matches &&
        tamperedDelta.failures.some((failure) => failure.includes('defaultPrivileges')),
      tamperedDelta.failures.join('; ') || 'NOT DETECTED',
    )

    const literatureTables = afterCatalog.relations.filter(
      (relation) => relation.relkind === 'r' && relation.name.startsWith('literature'),
    )
    record(
      'R16-object-counts',
      'object counts match the reviewable expectations',
      literatureTables.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.tables &&
        afterCatalog.functions.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.functions &&
        afterCatalog.triggers.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.triggers &&
        afterCatalog.indexes.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.indexes &&
        afterCatalog.policies.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.policies,
      `tables=${literatureTables.length} functions=${afterCatalog.functions.length} ` +
        `triggers=${afterCatalog.triggers.length} indexes=${afterCatalog.indexes.length} ` +
        `policies=${afterCatalog.policies.length}`,
    )
    record(
      'R17-rls-no-policies',
      'row-level security is enabled on every Literature table and no policy grants access',
      literatureTables.every((relation) => relation.rowLevelSecurity) &&
        afterCatalog.policies.length === 0,
      `policies=${afterCatalog.policies.length}`,
    )

    const leaked = afterCatalog.tablePrivileges.filter(
      (entry) => entry.granted && ['public', 'anon', 'authenticated'].includes(entry.role),
    )
    record(
      'R18-unprivileged-roles',
      'PUBLIC, anon, and authenticated hold no privilege on any Literature table',
      leaked.length === 0 && afterCatalog.tablePrivileges.length > 0,
      leaked.map((entry) => `${entry.role}:${entry.privilege}:${entry.table}`).join(', ') ||
        `probes=${afterCatalog.tablePrivileges.length}, none granted`,
    )

    const rpcGrants = afterCatalog.functions.filter((entry) =>
      LITERATURE_FOUNDATION_RUNTIME_RPCS.includes(entry.name),
    )
    record(
      'R19-service-role-access',
      'the three runtime RPCs are executable by service_role and by nobody else',
      rpcGrants.length === LITERATURE_FOUNDATION_RUNTIME_RPCS.length &&
        rpcGrants.every(
          (entry) =>
            entry.serviceRoleExecute &&
            !entry.publicExecute &&
            !entry.anonExecute &&
            !entry.authenticatedExecute,
        ),
      rpcGrants.map((entry) => `${entry.name}:${entry.serviceRoleExecute}`).join(', '),
    )
    record(
      'R20-function-security',
      'every Literature function is SECURITY INVOKER with a pinned search_path',
      afterCatalog.functions.every(
        (entry) =>
          !entry.securityDefiner &&
          (entry.config ?? []).some((setting) => setting.startsWith('search_path=')),
      ),
      afterCatalog.functions
        .map((entry) => `${entry.name}:${String(entry.securityDefiner)}`)
        .join(', '),
    )

    // ---- 7. Behaviour as the real roles ---------------------------------------------------------
    const anonSelect = await psql(container, 'select count(*) from public.literature_articles;', {
      role: 'anon',
      allowFailure: true,
    })
    const anonRpc = await psql(container, 'select * from public.search_literature_v1();', {
      role: 'anon',
      allowFailure: true,
    })
    record(
      'R21-anon-denied',
      'anon can neither read a Literature table nor execute the search RPC',
      anonSelect.code !== 0 && anonRpc.code !== 0,
      `tableExit=${anonSelect.code} rpcExit=${anonRpc.code}`,
    )

    const serviceSearch = await psql(
      container,
      'select count(*) from public.search_literature_v1();',
      { role: 'service_role', allowFailure: true },
    )
    record(
      'R22-empty-search-valid',
      'a blank search as service_role succeeds and returns an empty result',
      serviceSearch.code === 0 && serviceSearch.stdout.trim() === '0',
      `exit=${serviceSearch.code} rows=${serviceSearch.stdout.trim()}`,
    )

    const serviceDetail = await psql(
      container,
      "select count(*) from public.literature_articles where pmid = '1';",
      { role: 'service_role', allowFailure: true },
    )
    const serviceStats = await psql(
      container,
      'select public.literature_admin_stats_v1() is not null;',
      { role: 'service_role', allowFailure: true },
    )
    record(
      'R23-runtime-works-after',
      'list, detail, and stats all succeed as service_role after the migration',
      serviceDetail.code === 0 &&
        serviceDetail.stdout.trim() === '0' &&
        serviceStats.code === 0 &&
        serviceStats.stdout.trim() === 't',
      `detailExit=${serviceDetail.code} statsExit=${serviceStats.code}`,
    )

    const rowCount = (await psqlReadOnly(container, LITERATURE_ROW_COUNT_SQL)).stdout.trim()
    record(
      'R24-empty-corpus',
      'every Literature table is empty immediately after a foundation-only rollout',
      rowCount === '0',
      `totalRows=${rowCount}`,
    )

    // ---- 8. Semantic drift detection ------------------------------------------------------------
    const tamperedBody = await psql(
      container,
      [
        'begin;',
        `create or replace function public.literature_admin_stats_v1()
         returns jsonb language sql stable security invoker
         set search_path = pg_catalog, public
         as $tamper$ select jsonb_build_object('total_articles', 999999) $tamper$;`,
        LITERATURE_CATALOG_INSPECTION_SQL,
        'rollback;',
      ].join('\n'),
    )
    const tamperedSnapshot = JSON.parse(tamperedBody.stdout.trim()) as LiteratureCatalogSnapshot
    const tamperedComparison = compareLiteratureCatalog(tamperedSnapshot, artifact)
    record(
      'R25-function-body-tampering-detected',
      'a same-signature function with a tampered body fails the canonical comparison',
      !tamperedComparison.matches &&
        tamperedComparison.failures.some((failure) => failure.includes('functions')),
      tamperedComparison.failures.join('; ') || 'NOT DETECTED',
    )

    const missingAcl = JSON.parse(JSON.stringify(afterCatalog)) as LiteratureCatalogSnapshot
    missingAcl.tablePrivileges = []
    record(
      'R26-missing-privilege-evidence-detected',
      'an empty privilege array fails rather than reading as "nothing granted"',
      !compareLiteratureCatalog(missingAcl, artifact).matches,
      compareLiteratureCatalog(missingAcl, artifact).failures.join('; ') || 'NOT DETECTED',
    )

    // ---- 9. Nothing unrelated changed -----------------------------------------------------------
    const unrelated = afterCatalog.relations.filter(
      (relation) => !relation.name.startsWith('literature'),
    )
    record(
      'R27-no-unrelated-drift',
      'no unrelated application object was created in public',
      unrelated.length === 0,
      unrelated.map((relation) => relation.name).join(', ') || 'none',
    )

    // ---- 10. Second application -----------------------------------------------------------------
    const second = await psql(container, migrationSql, {
      singleTransaction: true,
      allowFailure: true,
    })
    const afterSecond = compareLiteratureCatalog(await readCatalog(container), artifact)
    record(
      'R28-second-application-rejected',
      'reapplying the migration is rejected and leaves the catalog unchanged',
      second.code !== 0 && afterSecond.matches,
      `exit=${second.code} ${afterSecond.failures.join('; ') || 'catalog unchanged'}`,
    )

    // ---- 11. Partial state is assessed as an incident, never as success -------------------------
    const partialProbe = await psql(
      container,
      [
        'begin;',
        'drop table public.literature_import_errors cascade;',
        LITERATURE_CATALOG_INSPECTION_SQL,
        'rollback;',
      ].join('\n'),
    )
    const partialSnapshot = JSON.parse(partialProbe.stdout.trim()) as LiteratureCatalogSnapshot
    const partialPresence = summarizeCatalogPresence(partialSnapshot)
    const partialVerdict = classifyLiteratureRollout({
      observationComplete: true,
      recordedMigrationVersions: [LITERATURE_FOUNDATION_MIGRATION.version],
      presentTables: partialPresence.presentTables,
      presentFunctions: partialPresence.presentFunctions,
      expectedTables: [...LITERATURE_FOUNDATION_TABLES],
      expectedFunctions: [...new Set(afterCatalog.functions.map((entry) => entry.name))],
      unexpectedLiteratureObjects: partialPresence.unexpectedLiteratureObjects,
      totalRowCount: 0,
      securityChecksPassed: compareLiteratureCatalog(partialSnapshot, artifact).matches,
    })
    record(
      'R29-partial-state-detected',
      'a missing table is assessed as a partial-incident content state, and the classification ' +
        'stays provider_attestation_required / stop',
      partialVerdict.contentAssessment === 'content_partial_incident_nonauthoritative' &&
        partialVerdict.classification === 'provider_attestation_required' &&
        partialVerdict.nextAction === 'stop_read_only_reconciliation',
      `contentAssessment=${partialVerdict.contentAssessment} ` +
        `classification=${partialVerdict.classification}`,
    )
    record(
      'R30-partial-probe-rolled-back',
      'the partial-state probe rolled back and left the catalog intact',
      compareLiteratureCatalog(await readCatalog(container), artifact).matches,
      'catalog intact',
    )

    // Even the fully correct catalog can never read as success while Layer 3 is absent.
    const perfectVerdict = classifyLiteratureRollout({
      observationComplete: true,
      recordedMigrationVersions: [LITERATURE_FOUNDATION_MIGRATION.version],
      presentTables: summarizeCatalogPresence(afterCatalog).presentTables,
      presentFunctions: summarizeCatalogPresence(afterCatalog).presentFunctions,
      expectedTables: [...LITERATURE_FOUNDATION_TABLES],
      expectedFunctions: [...new Set(afterCatalog.functions.map((entry) => entry.name))],
      unexpectedLiteratureObjects:
        summarizeCatalogPresence(afterCatalog).unexpectedLiteratureObjects,
      totalRowCount: 0,
      securityChecksPassed: comparison.matches,
    })
    record(
      'R31-perfect-catalog-still-blocked',
      'a byte-exact catalog match is assessed catalog_matches_expected_nonauthoritative and ' +
        'still classified provider_attestation_required / stop',
      perfectVerdict.contentAssessment === 'catalog_matches_expected_nonauthoritative' &&
        perfectVerdict.classification === 'provider_attestation_required' &&
        perfectVerdict.nextAction === 'stop_read_only_reconciliation',
      `contentAssessment=${perfectVerdict.contentAssessment} ` +
        `classification=${perfectVerdict.classification} nextAction=${perfectVerdict.nextAction}`,
    )

    // ---- 12. Late-collision rollback probes -----------------------------------------------------
    // 12a. A pre-existing VIEW occupying a table name the migration creates.
    await establishBaseline(container, VIEW_PROBE_DATABASE)
    const viewTrgmBefore = classifyPgTrgmState(await readCatalog(container, VIEW_PROBE_DATABASE))
    await psql(container, 'create view public.literature_journals as select 1 as sentinel;', {
      database: VIEW_PROBE_DATABASE,
    })

    const viewCollisionCatalog = await readCatalog(container, VIEW_PROBE_DATABASE)
    const viewCollisionChecks = evaluateEvidenceContentPreflight(
      preflightEvidenceFrom(viewCollisionCatalog, { tableExists: true, versions: [] }),
    )
    const viewCollisionCheck = viewCollisionChecks.find(
      (entry) => entry.id === 'E05-no-name-collision',
    )
    record(
      'R32-view-collision-observed',
      'a view occupying a Literature table name is observed as a collision by the preflight',
      viewCollisionCheck?.passed === false,
      viewCollisionCheck?.detail ?? 'collision check not produced',
    )

    const viewCollidingApply = await psql(container, migrationSql, {
      database: VIEW_PROBE_DATABASE,
      singleTransaction: true,
      allowFailure: true,
    })
    const afterViewCollision = await readCatalog(container, VIEW_PROBE_DATABASE)
    const viewTrgmAfter = classifyPgTrgmState(afterViewCollision)
    const viewProbeHistory = await historyRowCount(container, VIEW_PROBE_DATABASE)
    const survivingView = afterViewCollision.relations.filter(
      (relation) => relation.name === 'literature_journals' && relation.relkind === 'v',
    )
    const viewLeftoverLiterature = afterViewCollision.relations.filter(
      (relation) => relation.name.startsWith('literature') && relation.relkind !== 'v',
    )
    record(
      'R33-view-collision-rollback-complete',
      'the failed apply rolled back fully: no foundation objects, no new pg_trgm, no history ' +
        'row, and the pre-existing view survives',
      viewCollidingApply.code !== 0 &&
        viewLeftoverLiterature.length === 0 &&
        afterViewCollision.functions.length === 0 &&
        viewTrgmAfter.state === viewTrgmBefore.state &&
        viewProbeHistory === '0' &&
        survivingView.length === 1,
      `applyExit=${viewCollidingApply.code} leftoverRelations=${viewLeftoverLiterature.length} ` +
        `functions=${afterViewCollision.functions.length} trgmBefore=${viewTrgmBefore.state} ` +
        `trgmAfter=${viewTrgmAfter.state} history=${viewProbeHistory} ` +
        `viewSurvived=${survivingView.length === 1}`,
    )

    // 12b. H-2: an index named literature_articles_search_vector_idx on an UNRELATED table. The
    // old preflight scoped index observation through Literature tables and missed exactly this.
    await establishBaseline(container, INDEX_PROBE_DATABASE)
    await psql(
      container,
      [
        'create table public.unrelated_notes (body text);',
        'create index literature_articles_search_vector_idx on public.unrelated_notes (body);',
      ].join('\n'),
      { database: INDEX_PROBE_DATABASE },
    )
    const indexCollisionCatalog = await readCatalog(container, INDEX_PROBE_DATABASE)
    const indexCollisionChecks = evaluateEvidenceContentPreflight(
      preflightEvidenceFrom(indexCollisionCatalog, { tableExists: true, versions: [] }),
    )
    const indexCollisionCheck = indexCollisionChecks.find(
      (entry) => entry.id === 'E05-no-name-collision',
    )
    record(
      'R34-unrelated-index-collision-observed',
      'an expected foundation index name occupied by an index on an unrelated table is observed ' +
        'as a collision, independent of its owning table',
      indexCollisionCheck?.passed === false &&
        (indexCollisionCheck?.detail ?? '').includes('literature_articles_search_vector_idx'),
      indexCollisionCheck?.detail ?? 'collision check not produced',
    )

    const indexCollidingApply = await psql(container, migrationSql, {
      database: INDEX_PROBE_DATABASE,
      singleTransaction: true,
      allowFailure: true,
    })
    const afterIndexCollision = await readCatalog(container, INDEX_PROBE_DATABASE)
    const indexProbeHistory = await historyRowCount(container, INDEX_PROBE_DATABASE)
    const survivingUnrelatedIndex = afterIndexCollision.indexNames.filter(
      (entry) => entry.name === 'literature_articles_search_vector_idx',
    )
    const indexLeftoverLiterature = afterIndexCollision.relations.filter((relation) =>
      relation.name.startsWith('literature'),
    )
    record(
      'R35-index-collision-rollback-complete',
      'the failed apply rolled back fully: no foundation objects, no new pg_trgm, no history ' +
        'row, and the unrelated index survives on its unrelated table',
      indexCollidingApply.code !== 0 &&
        indexLeftoverLiterature.length === 0 &&
        afterIndexCollision.functions.length === 0 &&
        classifyPgTrgmState(afterIndexCollision).state === 'absent' &&
        indexProbeHistory === '0' &&
        survivingUnrelatedIndex.length === 1,
      `applyExit=${indexCollidingApply.code} ` +
        `leftoverRelations=${indexLeftoverLiterature.length} ` +
        `functions=${afterIndexCollision.functions.length} ` +
        `trgm=${classifyPgTrgmState(afterIndexCollision).state} history=${indexProbeHistory} ` +
        `indexSurvived=${survivingUnrelatedIndex.length === 1}`,
    )

    // 12c. H-2: pg_trgm already installed in `public`. CREATE EXTENSION IF NOT EXISTS does not
    // relocate it, so the later extensions.gin_trgm_ops reference must fail and roll back.
    await establishBaseline(container, TRGM_PROBE_DATABASE)
    await psql(container, 'create extension pg_trgm with schema public;', {
      database: TRGM_PROBE_DATABASE,
    })
    const trgmProbeCatalog = await readCatalog(container, TRGM_PROBE_DATABASE)
    const trgmProbeChecks = evaluateEvidenceContentPreflight(
      preflightEvidenceFrom(trgmProbeCatalog, { tableExists: true, versions: [] }),
    )
    const trgmLocationCheck = trgmProbeChecks.find((entry) =>
      entry.id.includes('Q01-pg-trgm-location'),
    )
    record(
      'R36-wrong-schema-trgm-rejected-preflight',
      'pg_trgm installed in public (not extensions) is rejected by the preflight, while absent ' +
        'and extensions-installed are both permitted',
      trgmLocationCheck?.passed === false &&
        classifyPgTrgmState(trgmProbeCatalog).state === 'installed_elsewhere' &&
        classifyPgTrgmState(preCatalog).state === 'absent' &&
        classifyPgTrgmState(afterCatalog).state === 'installed_in_extensions',
      `probe=${classifyPgTrgmState(trgmProbeCatalog).state} ` +
        `cleanBaseline=absent afterApply=installed_in_extensions ` +
        `check=${trgmLocationCheck?.passed === false ? 'rejected' : 'NOT REJECTED'}`,
    )

    const trgmCollidingApply = await psql(container, migrationSql, {
      database: TRGM_PROBE_DATABASE,
      singleTransaction: true,
      allowFailure: true,
    })
    const afterTrgmCollision = await readCatalog(container, TRGM_PROBE_DATABASE)
    const trgmProbeHistory = await historyRowCount(container, TRGM_PROBE_DATABASE)
    const trgmStateAfter = classifyPgTrgmState(afterTrgmCollision)
    const trgmLeftoverLiterature = afterTrgmCollision.relations.filter((relation) =>
      relation.name.startsWith('literature'),
    )
    record(
      'R37-wrong-schema-trgm-rollback-complete',
      'the failed apply (extensions.gin_trgm_ops unresolvable) rolled back fully and left the ' +
        'pre-existing public-schema pg_trgm untouched',
      trgmCollidingApply.code !== 0 &&
        trgmLeftoverLiterature.length === 0 &&
        afterTrgmCollision.functions.length === 0 &&
        trgmStateAfter.state === 'installed_elsewhere' &&
        (trgmStateAfter.state === 'installed_elsewhere' ? trgmStateAfter.schema : '') ===
          'public' &&
        trgmProbeHistory === '0',
      `applyExit=${trgmCollidingApply.code} leftover=${trgmLeftoverLiterature.length} ` +
        `functions=${afterTrgmCollision.functions.length} trgm=${JSON.stringify(trgmStateAfter)} ` +
        `history=${trgmProbeHistory}`,
    )

    // ---- 12d. Third review, finding 3: unrelated public objects are not foundation drift --------
    // An unrelated table (with its implicit sequence), an unrelated standalone enum, and an
    // unrelated view are planted BEFORE the apply. Preflight must pass, the apply must succeed,
    // and the exact foundation-owned comparison must match the committed artifact even though the
    // observed `public` namespace now holds more relations and more types than the foundation
    // creates. Before the correction this reported drift.
    await establishBaseline(container, UNRELATED_PROBE_DATABASE)
    await psql(
      container,
      [
        'create table public.unrelated_reference_notes (id bigserial primary key, body text);',
        "create type public.unrelated_workflow_state as enum ('draft', 'final');",
        'create view public.unrelated_summary_view as select 1 as sentinel;',
      ].join('\n'),
      { database: UNRELATED_PROBE_DATABASE },
    )
    const unrelatedPreCatalog = await readCatalog(container, UNRELATED_PROBE_DATABASE)
    const unrelatedPreChecks = evaluateEvidenceContentPreflight(
      preflightEvidenceFrom(unrelatedPreCatalog, { tableExists: true, versions: [] }),
    )
    record(
      'R38-unrelated-objects-preflight-passes',
      'unrelated public relations, a sequence, a view, and a standalone enum all pass every ' +
        'preflight content check',
      allChecksPassed(unrelatedPreChecks) &&
        unrelatedPreCatalog.relations.length >= 3 &&
        unrelatedPreCatalog.types.length === 1,
      `relations=${unrelatedPreCatalog.relations.length} types=${unrelatedPreCatalog.types.length} ` +
        (unrelatedPreChecks
          .filter((entry) => !entry.passed)
          .map((entry) => `${entry.id}: ${entry.detail}`)
          .join('; ') || 'all checks passed'),
    )

    const unrelatedApply = await psql(container, migrationSql, {
      database: UNRELATED_PROBE_DATABASE,
      singleTransaction: true,
      allowFailure: true,
    })
    const unrelatedAfterCatalog = await readCatalog(container, UNRELATED_PROBE_DATABASE)
    const unrelatedComparison = compareLiteratureCatalog(unrelatedAfterCatalog, artifact)
    const survivingUnrelated = unrelatedAfterCatalog.relations.filter((relation) =>
      relation.name.startsWith('unrelated_'),
    )
    const survivingUnrelatedType = unrelatedAfterCatalog.types.filter(
      (entry) => entry.name === 'unrelated_workflow_state',
    )
    record(
      'R39-unrelated-objects-are-not-drift',
      'the exact foundation-owned catalog matches the committed artifact even though public ' +
        'holds unrelated relations and an unrelated standalone type, which all survive the apply',
      unrelatedApply.code === 0 &&
        unrelatedComparison.matches &&
        unrelatedAfterCatalog.relations.length > LITERATURE_FOUNDATION_TABLES.length &&
        survivingUnrelated.length >= 3 &&
        survivingUnrelatedType.length === 1,
      `applyExit=${unrelatedApply.code} observedRelations=${unrelatedAfterCatalog.relations.length} ` +
        `foundationTables=${LITERATURE_FOUNDATION_TABLES.length} ` +
        `unrelatedSurvived=${survivingUnrelated.length} ` +
        `unrelatedTypeSurvived=${survivingUnrelatedType.length} ` +
        (unrelatedComparison.failures.join('; ') || 'exact match'),
    )

    // ...and the narrowed scope must still stop a prohibited extra inside the reserved Literature
    // namespace. (A *colliding* Literature name is proven separately by R32–R37.)
    const reservedExtraRun = await psql(
      container,
      [
        'begin;',
        'create table public.literature_extra_notes (id bigint);',
        LITERATURE_CATALOG_INSPECTION_SQL,
        'rollback;',
      ].join('\n'),
      { database: UNRELATED_PROBE_DATABASE },
    )
    const reservedExtraSnapshot = JSON.parse(
      reservedExtraRun.stdout.trim(),
    ) as LiteratureCatalogSnapshot
    const reservedExtraComparison = compareLiteratureCatalog(reservedExtraSnapshot, artifact)
    const reservedExtraPresence = summarizeCatalogPresence(reservedExtraSnapshot)
    record(
      'R40-reserved-namespace-extra-still-stops',
      'an extra Literature-named table is still reported as drift and as an unexpected ' +
        'Literature object, while unrelated names are not',
      !reservedExtraComparison.matches &&
        reservedExtraPresence.unexpectedLiteratureObjects.includes('r:literature_extra_notes'),
      `unexpected=[${reservedExtraPresence.unexpectedLiteratureObjects.join(', ')}] ` +
        (reservedExtraComparison.failures.join('; ') || 'NOT DETECTED'),
    )

    // ---- 12e. Third review, finding 2: path-aware screening admits real catalog content ---------
    // The parser is the surface the preflight and postflight actually use, so the genuine
    // post-apply catalog — real function ACL arrays, real service_role privilege rows — must round
    // trip through it. This is the false-positive half of the position-specific allowance; the
    // rejection half lives in evidence-schema.test.ts.
    const realPostflightDocument = JSON.stringify({
      schemaVersion: 'literature-dedicated-postflight-observation/3.0.0',
      queryPlanSha256: LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256,
      existenceProbe: {
        migrationHistoryTableExists: true,
        presentLiteratureTables: [...LITERATURE_FOUNDATION_TABLES],
      },
      migrationVersions: [LITERATURE_FOUNDATION_MIGRATION.version],
      catalog: afterCatalog,
      prerequisites: {
        availableExtensions: ['pg_trgm'],
        roles: ['anon', 'authenticated', 'service_role'],
        schemas: ['extensions', 'public'],
      },
      totalRowCount: 0,
    })
    let parsedRealDocument: ReturnType<typeof parseLiteraturePostflightEvidence> | null = null
    let parseFailure = ''
    try {
      parsedRealDocument = parseLiteraturePostflightEvidence(realPostflightDocument)
    } catch (error) {
      parseFailure = error instanceof Error ? error.message : String(error)
    }
    const realAclEntries = (parsedRealDocument?.catalog.functions ?? []).flatMap(
      (entry) => entry.acl ?? [],
    )
    const realServiceRoleRows = (parsedRealDocument?.catalog.tablePrivileges ?? []).filter(
      (entry) => entry.role === 'service_role',
    )
    record(
      'R41-real-catalog-parses-under-path-aware-screening',
      'the genuine post-apply catalog — real function ACL arrays and real service_role privilege ' +
        'rows — parses cleanly under position-specific secret screening',
      parsedRealDocument !== null && realAclEntries.length > 0 && realServiceRoleRows.length > 0,
      parseFailure ||
        `aclEntries=${realAclEntries.length} serviceRolePrivilegeRows=${realServiceRoleRows.length}`,
    )

    // ---- 13. Lost acknowledgement never retries -------------------------------------------------
    const lostAck = resolveLostAcknowledgement()
    record(
      'R42-lost-ack-no-retry',
      'an ambiguous acknowledgement transitions to read-only reconciliation and never retries',
      lostAck.automaticRetryPermitted === false &&
        lostAck.nextAction === 'stop_read_only_reconciliation',
      `nextAction=${lostAck.nextAction}`,
    )

    // ---- 14. Cleanup ownership ------------------------------------------------------------------
    await removeContainerByExactName(container)
    const targetGone = !(await containerExists(container))
    const sentinelSurvived = await containerExists(sentinel)
    record(
      'R43-cleanup-is-operation-owned',
      'cleanup removed the rehearsal target and left an unrelated same-prefix sentinel running',
      targetGone && sentinelSurvived,
      `targetRemoved=${targetGone} sentinelSurvived=${sentinelSurvived}`,
    )
    cleanupVerified = true

    record(
      'R44-protected-database-untouched',
      'the protected real-local Literature database is still present and was never contacted',
      await containerExists('supabase_db_ip-literature-local'),
      'present',
    )
  } finally {
    if (!cleanupVerified) await removeContainerByExactName(container)
    await removeContainerByExactName(sentinel)
  }

  const leftoverTarget = await containerExists(container)
  const leftoverSentinel = await containerExists(sentinel)
  record(
    'R45-no-leftovers',
    'no rehearsal container remains after the run',
    !leftoverTarget && !leftoverSentinel,
    `target=${leftoverTarget} sentinel=${leftoverSentinel}`,
  )

  const failed = scenarios.filter((scenario) => !scenario.passed)
  process.stdout.write(
    `\n${scenarios.length - failed.length}/${scenarios.length} scenarios passed.\n`,
  )
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
