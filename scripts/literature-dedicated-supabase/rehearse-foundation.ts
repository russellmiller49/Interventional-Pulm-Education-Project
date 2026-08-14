/**
 * Disposable rehearsal for the dedicated Literature foundation migration.
 *
 * Creates a throwaway PostgreSQL 17 container that stands in for a brand-new Supabase project,
 * applies exactly the immutable foundation migration to it in a single transaction, proves the
 * resulting catalog matches the checked-in expectations object for object and privilege for
 * privilege, exercises the failure modes a real rollout could hit, and then destroys only what it
 * created.
 *
 * It never touches the protected real-local Literature database. The rehearsal container publishes
 * no port, so there is no TCP surface at all; every statement travels through `docker exec … psql`
 * over the container's own unix socket.
 *
 *   npx tsx scripts/literature-dedicated-supabase/rehearse-foundation.ts
 *   npx tsx scripts/literature-dedicated-supabase/rehearse-foundation.ts --evidence <path.json>
 */

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_FOUNDATION_MIGRATION,
  evaluateLiteratureFoundationSelection,
} from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  LITERATURE_FOUNDATION_OBJECT_COUNTS,
  LITERATURE_FOUNDATION_RUNTIME_RPCS,
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
  compareLiteratureCatalog,
  summarizeCatalogPresence,
  type LiteratureCatalogSnapshot,
} from './lib/foundation-catalog'
import { classifyLiteratureRollout, resolveLostAcknowledgement } from './lib/reconciliation'

const ROOT = process.cwd()
const CONTAINER_READY_TIMEOUT_MS = 90_000
const CONTAINER_READY_POLL_MS = 500

interface Scenario {
  id: string
  description: string
  passed: boolean
  detail: string
}

const scenarios: Scenario[] = []

function record(id: string, description: string, passed: boolean, detail: string) {
  scenarios.push({ id, description, passed, detail })
  const mark = passed ? 'PASS' : 'FAIL'
  process.stdout.write(`  [${mark}] ${id} — ${description}\n`)
  if (!passed) process.stdout.write(`         ${detail}\n`)
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex')
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

/** Run a statement inside an explicitly read-only transaction, exactly as the postflight will. */
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

/** Make the baseline representative of a new Supabase project. */
async function establishBaseline(container: string) {
  await psql(container, `create database ${REHEARSAL_DATABASE};`, { database: 'postgres' })

  const rolesBefore = (
    await psql(
      container,
      `select coalesce(string_agg(rolname, ',' order by rolname), '') from pg_catalog.pg_roles
       where rolname in ('anon', 'authenticated', 'service_role');`,
    )
  ).stdout.trim()

  const present = new Set(rolesBefore ? rolesBefore.split(',') : [])
  const created: string[] = []
  for (const role of ['anon', 'authenticated', 'service_role']) {
    if (present.has(role)) continue
    await psql(container, `create role ${role} nologin noinherit;`)
    created.push(role)
  }
  // service_role bypasses RLS on a real Supabase project; the foundation schema relies on that
  // rather than on any policy, so the baseline must reproduce it.
  await psql(container, `alter role service_role bypassrls;`, { allowFailure: true })
  await psql(container, `create schema if not exists extensions;`)
  await psql(container, MIGRATION_HISTORY_BOOTSTRAP_SQL)

  return { rolesAlreadyPresent: [...present].sort(), rolesCreated: created.sort() }
}

async function readCatalog(container: string): Promise<LiteratureCatalogSnapshot> {
  const result = await psqlReadOnly(container, LITERATURE_CATALOG_INSPECTION_SQL)
  const raw = result.stdout.trim()
  if (!raw) throw new Error('Catalog inspection returned no rows.')
  return JSON.parse(raw) as LiteratureCatalogSnapshot
}

async function nonLiteraturePublicObjects(container: string) {
  const result = await psqlReadOnly(
    container,
    `select coalesce(string_agg(name, ',' order by name), '')
     from (
       select c.relname as name
       from pg_catalog.pg_class as c
       join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
         and c.relname not like 'literature%'
     ) as objects;`,
  )
  const value = result.stdout.trim()
  return value ? value.split(',').sort() : []
}

async function main() {
  const evidenceIndex = process.argv.indexOf('--evidence')
  const evidencePath = evidenceIndex >= 0 ? process.argv[evidenceIndex + 1] : null

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
    })
    record(
      'R02-migration-drift-rejected',
      'a one-byte change to the migration is rejected by the manifest',
      !driftVerdict.approved &&
        driftVerdict.rejections.some((entry) => entry.reason === 'migration_checksum_mismatch'),
      driftVerdict.rejections.map((entry) => entry.reason).join(', ') || 'no rejection produced',
    )

    // ---- 2. Disposable baseline ---------------------------------------------------------------
    await startContainer(container)
    await startContainer(sentinel)
    const baseline = await establishBaseline(container)
    record(
      'R03-baseline',
      'a clean disposable target with the Supabase roles and extensions schema exists',
      true,
      `rolesAlreadyPresent=[${baseline.rolesAlreadyPresent.join(', ')}] rolesCreated=[${baseline.rolesCreated.join(', ')}]`,
    )

    const beforeCatalog = await readCatalog(container)
    const beforeUnrelated = await nonLiteraturePublicObjects(container)
    record(
      'R04-pre-migration-inventory',
      'no Literature object exists before the migration',
      beforeCatalog.tables.length === 0 &&
        beforeCatalog.functions.length === 0 &&
        beforeCatalog.indexes.length === 0,
      `tables=${beforeCatalog.tables.length} functions=${beforeCatalog.functions.length} indexes=${beforeCatalog.indexes.length}`,
    )

    // ---- 3. Runtime surfaces must fail before the migration ------------------------------------
    const searchBefore = await psql(container, 'select * from public.search_literature_v1();', {
      allowFailure: true,
    })
    const listBefore = await psql(container, 'select count(*) from public.literature_articles;', {
      allowFailure: true,
    })
    record(
      'R05-runtime-fails-before',
      'search and list fail before the migration rather than returning an empty corpus',
      searchBefore.code !== 0 && listBefore.code !== 0,
      `searchExit=${searchBefore.code} listExit=${listBefore.code}`,
    )

    // ---- 4. Apply exactly the foundation migration, in one transaction --------------------------
    await psql(container, migrationSql, { singleTransaction: true })
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
      'R06-applied',
      'the migration applied as a single transaction and history records exactly one version',
      history === LITERATURE_FOUNDATION_MIGRATION.version,
      `history=[${history}]`,
    )

    // ---- 5. Exact catalog ----------------------------------------------------------------------
    const afterCatalog = await readCatalog(container)
    const comparison = compareLiteratureCatalog(afterCatalog)
    record(
      'R07-exact-catalog',
      'every table, function, trigger, index, RLS flag, and privilege matches the expectations',
      comparison.matches,
      comparison.failures.join('; ') || 'exact match',
    )
    record(
      'R08-object-counts',
      'object counts match the manifest',
      afterCatalog.tables.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.tables &&
        afterCatalog.functions.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.functions &&
        afterCatalog.triggers.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.triggers &&
        afterCatalog.indexes.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.indexes &&
        afterCatalog.policies.length === LITERATURE_FOUNDATION_OBJECT_COUNTS.policies,
      `tables=${afterCatalog.tables.length} functions=${afterCatalog.functions.length} ` +
        `triggers=${afterCatalog.triggers.length} indexes=${afterCatalog.indexes.length} ` +
        `policies=${afterCatalog.policies.length}`,
    )
    record(
      'R09-rls-no-policies',
      'row-level security is enabled on every table and no policy grants access',
      afterCatalog.tables.every((table) => table.rowLevelSecurity) &&
        afterCatalog.policies.length === 0,
      `policies=${afterCatalog.policies.length}`,
    )

    const leakedPrivileges = afterCatalog.tablePrivileges.filter(
      (entry) => entry.granted && ['public', 'anon', 'authenticated'].includes(entry.role),
    )
    record(
      'R10-unprivileged-roles',
      'PUBLIC, anon, and authenticated hold no privilege on any Literature table',
      leakedPrivileges.length === 0,
      leakedPrivileges
        .map((entry) => `${entry.role}:${entry.privilege}:${entry.table}`)
        .join(', ') || 'no privileges held',
    )

    const rpcGrants = afterCatalog.functions.filter((entry) =>
      LITERATURE_FOUNDATION_RUNTIME_RPCS.includes(entry.name),
    )
    record(
      'R11-service-role-access',
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

    // ---- 6. Behaviour as the real roles ---------------------------------------------------------
    const anonSelect = await psql(container, 'select count(*) from public.literature_articles;', {
      role: 'anon',
      allowFailure: true,
    })
    const anonRpc = await psql(container, 'select * from public.search_literature_v1();', {
      role: 'anon',
      allowFailure: true,
    })
    record(
      'R12-anon-denied',
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
      'R13-empty-search-valid',
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
      'R14-runtime-works-after',
      'list, detail, and stats all succeed as service_role after the migration',
      serviceDetail.code === 0 &&
        serviceDetail.stdout.trim() === '0' &&
        serviceStats.code === 0 &&
        serviceStats.stdout.trim() === 't',
      `detailExit=${serviceDetail.code} statsExit=${serviceStats.code}`,
    )

    const rowCount = (await psqlReadOnly(container, LITERATURE_ROW_COUNT_SQL)).stdout.trim()
    record(
      'R15-empty-corpus',
      'every Literature table is empty immediately after a foundation-only rollout',
      rowCount === '0',
      `totalRows=${rowCount}`,
    )

    // ---- 7. Nothing unrelated changed -----------------------------------------------------------
    const afterUnrelated = await nonLiteraturePublicObjects(container)
    record(
      'R16-no-unrelated-drift',
      'no unrelated application object was created or modified',
      JSON.stringify(beforeUnrelated) === JSON.stringify(afterUnrelated),
      `before=[${beforeUnrelated.join(', ')}] after=[${afterUnrelated.join(', ')}]`,
    )

    // ---- 8. Second application ------------------------------------------------------------------
    const second = await psql(container, migrationSql, {
      singleTransaction: true,
      allowFailure: true,
    })
    const afterSecond = await readCatalog(container)
    const afterSecondComparison = compareLiteratureCatalog(afterSecond)
    record(
      'R17-second-application-rejected',
      'reapplying the migration is rejected and leaves the catalog unchanged',
      second.code !== 0 && afterSecondComparison.matches,
      `exit=${second.code} ${afterSecondComparison.failures.join('; ') || 'catalog unchanged'}`,
    )

    // ---- 9. Partial state is detected -----------------------------------------------------------
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
    const partialComparison = compareLiteratureCatalog(partialSnapshot)
    const partialPresence = summarizeCatalogPresence(partialSnapshot)
    const partialVerdict = classifyLiteratureRollout({
      observationComplete: true,
      recordedMigrationVersions: [LITERATURE_FOUNDATION_MIGRATION.version],
      presentTables: partialPresence.presentTables,
      presentFunctions: partialPresence.presentFunctions,
      expectedTables: [...new Set(afterCatalog.tables.map((table) => table.name))],
      expectedFunctions: [...new Set(afterCatalog.functions.map((entry) => entry.name))],
      unexpectedLiteratureObjects: partialPresence.unexpectedLiteratureObjects,
      totalRowCount: 0,
      securityChecksPassed: partialComparison.matches,
    })
    record(
      'R18-partial-state-detected',
      'a missing table is detected as a partial-state incident, not a clean result',
      !partialComparison.matches && partialVerdict.classification === 'partial_incident',
      `classification=${partialVerdict.classification}`,
    )

    const restored = await readCatalog(container)
    record(
      'R19-partial-probe-rolled-back',
      'the partial-state probe rolled back and left the catalog intact',
      compareLiteratureCatalog(restored).matches,
      compareLiteratureCatalog(restored).failures.join('; ') || 'catalog intact',
    )

    // ---- 10. Lost acknowledgement never retries --------------------------------------------------
    const lostAck = resolveLostAcknowledgement()
    record(
      'R20-lost-ack-no-retry',
      'an ambiguous acknowledgement transitions to read-only reconciliation and never retries',
      lostAck.automaticRetryPermitted === false &&
        lostAck.nextAction === 'stop_read_only_reconciliation',
      `nextAction=${lostAck.nextAction}`,
    )

    // ---- 11. Cleanup ownership --------------------------------------------------------------------
    await removeContainerByExactName(container)
    const targetGone = !(await containerExists(container))
    const sentinelSurvived = await containerExists(sentinel)
    record(
      'R21-cleanup-is-operation-owned',
      'cleanup removed the rehearsal target and left an unrelated same-prefix sentinel running',
      targetGone && sentinelSurvived,
      `targetRemoved=${targetGone} sentinelSurvived=${sentinelSurvived}`,
    )
    cleanupVerified = true

    const protectedStillRunning = await containerExists('supabase_db_ip-literature-local')
    record(
      'R22-protected-database-untouched',
      'the protected real-local Literature database is still present and was never contacted',
      protectedStillRunning,
      `present=${protectedStillRunning}`,
    )
  } finally {
    if (!cleanupVerified) await removeContainerByExactName(container)
    await removeContainerByExactName(sentinel)
  }

  const leftoverTarget = await containerExists(container)
  const leftoverSentinel = await containerExists(sentinel)
  record(
    'R23-no-leftovers',
    'no rehearsal container remains after the run',
    !leftoverTarget && !leftoverSentinel,
    `target=${leftoverTarget} sentinel=${leftoverSentinel}`,
  )

  const failed = scenarios.filter((scenario) => !scenario.passed)
  const evidence = {
    schemaVersion: 'literature-dedicated-foundation-rehearsal/1.0.0',
    migration: {
      path: LITERATURE_FOUNDATION_MIGRATION.path,
      sha256: migrationSha256,
      byteLength: migrationBytes.byteLength,
    },
    image: REHEARSAL_POSTGRES_IMAGE,
    scenarios,
    passed: failed.length === 0,
  }

  if (evidencePath) {
    await writeFile(resolve(ROOT, evidencePath), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    process.stdout.write(`\nEvidence written to ${evidencePath}\n`)
  }

  process.stdout.write(
    `\n${scenarios.length - failed.length}/${scenarios.length} scenarios passed.\n`,
  )
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
