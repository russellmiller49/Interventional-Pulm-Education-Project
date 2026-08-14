/**
 * Disposable rehearsal for the dedicated Literature foundation migration.
 *
 * Creates a throwaway PostgreSQL 17 container that stands in for a brand-new Supabase project,
 * applies exactly the immutable foundation migration to it in a single transaction, proves the
 * resulting catalog matches the committed expectations artifact byte for byte, exercises the
 * failure modes a real rollout could hit, and then destroys only what it created.
 *
 * ## What this does and does not prove
 *
 *   - **Proven in the Supabase Postgres image:** the SQL applies transactionally; the exact catalog
 *     it produces; RLS/grant/ACL posture; `anon` denial; empty-search validity; rejection of a
 *     second application; rollback behaviour on a late collision.
 *   - **Modeled locally:** migration-history recording. The rehearsal inserts the history row
 *     itself, so the recorded *version* here is a local model, not evidence of what Supabase's
 *     managed `apply_migration` records. See `LITERATURE_MIGRATION_HISTORY_FIDELITY`.
 *   - **Not proven here at all:** anything about the managed hosted project. That requires
 *     provider-bound execution-time verification.
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
  compareLiteratureCatalog,
  summarizeCatalogPresence,
  type LiteratureCatalogExpectationArtifact,
  type LiteratureCatalogSnapshot,
} from './lib/foundation-catalog'
import { evaluateEvidenceContentPreflight } from './lib/preflight-rules'
import { classifyLiteratureRollout, resolveLostAcknowledgement } from './lib/reconciliation'
import type { LiteratureEvidenceDocument } from './lib/evidence-schema'

const ROOT = process.cwd()
const ARTIFACT_PATH =
  'src/features/literature/dedicated-supabase/foundation-catalog-expectations.json'
const PROBE_DATABASE = 'literature_rollback_probe'
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

async function extensionInstalled(container: string, database: string, name: string) {
  const result = await psqlReadOnly(
    container,
    `select count(*) from pg_catalog.pg_extension where extname = '${name}';`,
    { database },
  )
  return result.stdout.trim() !== '0'
}

/** Build an evidence document from a snapshot, as the query bundle would. */
function evidenceFrom(
  snapshot: LiteratureCatalogSnapshot,
  migrationVersions: string[],
  totalRowCount: number,
): LiteratureEvidenceDocument {
  return {
    schemaVersion: 'literature-dedicated-observation/2.0.0',
    queryBundleSha256: 'f'.repeat(64),
    migrationVersions,
    catalog: snapshot as unknown as LiteratureEvidenceDocument['catalog'],
    prerequisites: {
      availableExtensions: ['pg_trgm'],
      roles: ['anon', 'authenticated', 'service_role'],
      schemas: ['extensions', 'public'],
    },
    totalRowCount,
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

    // ---- 2. Disposable baseline ---------------------------------------------------------------
    await startContainer(container)
    await startContainer(sentinel)
    const baseline = await establishBaseline(container, REHEARSAL_DATABASE)
    record(
      'R03-baseline',
      'a clean disposable target with the Supabase roles and extensions schema exists',
      true,
      `rolesAlreadyPresent=[${baseline.rolesAlreadyPresent.join(', ')}] rolesCreated=[${baseline.rolesCreated.join(', ')}]`,
    )

    const trgmBefore = await extensionInstalled(container, REHEARSAL_DATABASE, 'pg_trgm')
    const beforeCatalog = await readCatalog(container)
    const beforeLiteratureRelations = beforeCatalog.relations.filter((relation) =>
      relation.name.startsWith('literature'),
    )
    record(
      'R04-pre-migration-inventory',
      'no Literature object exists before the migration',
      beforeLiteratureRelations.length === 0 && beforeCatalog.functions.length === 0,
      `relations=${beforeLiteratureRelations.length} functions=${beforeCatalog.functions.length} pg_trgm=${trgmBefore}`,
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
      'R06-applied',
      'the migration applied as a single transaction and exactly one version is recorded (version string is modeled locally)',
      history.split(',').filter(Boolean).length === 1,
      `history=[${history}]`,
    )

    // ---- 5. Exact canonical catalog -------------------------------------------------------------
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
      'R07-exact-canonical-catalog',
      'every relation, column, constraint, function definition, trigger, index, ACL row, and role attribute matches the committed artifact',
      comparison.matches,
      comparison.failures.join('; ') || 'exact match',
    )

    const literatureTables = afterCatalog.relations.filter(
      (relation) => relation.relkind === 'r' && relation.name.startsWith('literature'),
    )
    record(
      'R08-object-counts',
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
      'R09-rls-no-policies',
      'row-level security is enabled on every Literature table and no policy grants access',
      literatureTables.every((relation) => relation.rowLevelSecurity) &&
        afterCatalog.policies.length === 0,
      `policies=${afterCatalog.policies.length}`,
    )

    const leaked = afterCatalog.tablePrivileges.filter(
      (entry) => entry.granted && ['public', 'anon', 'authenticated'].includes(entry.role),
    )
    record(
      'R10-unprivileged-roles',
      'PUBLIC, anon, and authenticated hold no privilege on any Literature table',
      leaked.length === 0 && afterCatalog.tablePrivileges.length > 0,
      leaked.map((entry) => `${entry.role}:${entry.privilege}:${entry.table}`).join(', ') ||
        `probes=${afterCatalog.tablePrivileges.length}, none granted`,
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
    record(
      'R12-function-security',
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
      'R13-anon-denied',
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
      'R14-empty-search-valid',
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
      'R15-runtime-works-after',
      'list, detail, and stats all succeed as service_role after the migration',
      serviceDetail.code === 0 &&
        serviceDetail.stdout.trim() === '0' &&
        serviceStats.code === 0 &&
        serviceStats.stdout.trim() === 't',
      `detailExit=${serviceDetail.code} statsExit=${serviceStats.code}`,
    )

    const rowCount = (await psqlReadOnly(container, LITERATURE_ROW_COUNT_SQL)).stdout.trim()
    record(
      'R16-empty-corpus',
      'every Literature table is empty immediately after a foundation-only rollout',
      rowCount === '0',
      `totalRows=${rowCount}`,
    )

    // ---- 7. Semantic drift detection ------------------------------------------------------------
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
      'R17-function-body-tampering-detected',
      'a same-signature function with a tampered body fails the canonical comparison',
      !tamperedComparison.matches &&
        tamperedComparison.failures.some((failure) => failure.includes('functions')),
      tamperedComparison.failures.join('; ') || 'NOT DETECTED',
    )

    const missingAcl = JSON.parse(JSON.stringify(afterCatalog)) as LiteratureCatalogSnapshot
    missingAcl.tablePrivileges = []
    record(
      'R18-missing-privilege-evidence-detected',
      'an empty privilege array fails rather than reading as "nothing granted"',
      !compareLiteratureCatalog(missingAcl, artifact).matches,
      compareLiteratureCatalog(missingAcl, artifact).failures.join('; ') || 'NOT DETECTED',
    )

    // ---- 8. Nothing unrelated changed -----------------------------------------------------------
    const unrelated = afterCatalog.relations.filter(
      (relation) => !relation.name.startsWith('literature'),
    )
    record(
      'R19-no-unrelated-drift',
      'no unrelated application object was created',
      unrelated.length === 0,
      unrelated.map((relation) => relation.name).join(', ') || 'none',
    )

    // ---- 9. Second application ------------------------------------------------------------------
    const second = await psql(container, migrationSql, {
      singleTransaction: true,
      allowFailure: true,
    })
    const afterSecond = compareLiteratureCatalog(await readCatalog(container), artifact)
    record(
      'R20-second-application-rejected',
      'reapplying the migration is rejected and leaves the catalog unchanged',
      second.code !== 0 && afterSecond.matches,
      `exit=${second.code} ${afterSecond.failures.join('; ') || 'catalog unchanged'}`,
    )

    // ---- 10. Partial state is detected -----------------------------------------------------------
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
      targetAttestation: {
        status: 'attested',
        attestation: {
          mechanism: 'supabase_project_scoped_read_only_mcp_v1',
          providerProjectRef: 'itcttmkxdxvwmwcmzmey',
          providerProjectUrl: 'https://itcttmkxdxvwmwcmzmey.supabase.co',
          queryBundleSha256: 'f'.repeat(64),
          repositoryCommit: '0'.repeat(40),
          migrationPath: LITERATURE_FOUNDATION_MIGRATION.path,
          migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
          capturedAt: new Date().toISOString(),
          contentSha256: 'f'.repeat(64),
          completeness: 'complete',
        },
      },
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
      'R21-partial-state-detected',
      'a missing table is detected as a partial-state incident, not a clean result',
      partialVerdict.classification === 'partial_incident',
      `classification=${partialVerdict.classification}`,
    )
    record(
      'R22-partial-probe-rolled-back',
      'the partial-state probe rolled back and left the catalog intact',
      compareLiteratureCatalog(await readCatalog(container), artifact).matches,
      'catalog intact',
    )

    // ---- 11. Late-collision rollback probe on a second disposable database -----------------------
    await establishBaseline(container, PROBE_DATABASE)
    const probeTrgmBefore = await extensionInstalled(container, PROBE_DATABASE, 'pg_trgm')
    // A pre-existing VIEW occupying a table name the migration creates. This is the exact H-2
    // reproduction: the old preflight did not observe views and approved a migration that then
    // failed here.
    await psql(container, 'create view public.literature_journals as select 1 as sentinel;', {
      database: PROBE_DATABASE,
    })

    const collisionCatalog = await readCatalog(container, PROBE_DATABASE)
    const collisionChecks = evaluateEvidenceContentPreflight(evidenceFrom(collisionCatalog, [], 0))
    const collisionCheck = collisionChecks.find((entry) => entry.id === 'E05-no-name-collision')
    record(
      'R23-view-collision-observed',
      'a view occupying a Literature table name is observed as a collision by the preflight',
      collisionCheck?.passed === false,
      collisionCheck?.detail ?? 'collision check not produced',
    )

    const collidingApply = await psql(container, migrationSql, {
      database: PROBE_DATABASE,
      singleTransaction: true,
      allowFailure: true,
    })
    const afterCollision = await readCatalog(container, PROBE_DATABASE)
    const probeTrgmAfter = await extensionInstalled(container, PROBE_DATABASE, 'pg_trgm')
    const probeHistory = (
      await psqlReadOnly(container, 'select count(*) from supabase_migrations.schema_migrations;', {
        database: PROBE_DATABASE,
      })
    ).stdout.trim()
    const survivingView = afterCollision.relations.filter(
      (relation) => relation.name === 'literature_journals' && relation.relkind === 'v',
    )
    const leftoverLiterature = afterCollision.relations.filter(
      (relation) => relation.name.startsWith('literature') && relation.relkind !== 'v',
    )
    record(
      'R24-collision-rollback-complete',
      'the failed apply rolled back fully: no foundation objects, no new pg_trgm, no history row, and the pre-existing view survives',
      collidingApply.code !== 0 &&
        leftoverLiterature.length === 0 &&
        afterCollision.functions.length === 0 &&
        probeTrgmAfter === probeTrgmBefore &&
        probeHistory === '0' &&
        survivingView.length === 1,
      `applyExit=${collidingApply.code} leftoverRelations=${leftoverLiterature.length} ` +
        `functions=${afterCollision.functions.length} trgmBefore=${probeTrgmBefore} ` +
        `trgmAfter=${probeTrgmAfter} history=${probeHistory} viewSurvived=${survivingView.length === 1}`,
    )

    const probeVerdict = classifyLiteratureRollout({
      targetAttestation: {
        status: 'rejected',
        reason: 'provider_attestation_required',
        detail: 'rehearsal target is not the production project',
      },
      observationComplete: true,
      recordedMigrationVersions: [],
      presentTables: [],
      presentFunctions: [],
      expectedTables: [...LITERATURE_FOUNDATION_TABLES],
      expectedFunctions: [],
      unexpectedLiteratureObjects: [],
      totalRowCount: 0,
      securityChecksPassed: true,
    })
    record(
      'R25-postflight-classifies-safely',
      'the postflight refuses to classify the rolled-back probe without provider attestation',
      probeVerdict.classification === 'provider_attestation_required' &&
        probeVerdict.nextAction === 'stop_read_only_reconciliation',
      `classification=${probeVerdict.classification}`,
    )

    // ---- 12. Lost acknowledgement never retries --------------------------------------------------
    const lostAck = resolveLostAcknowledgement()
    record(
      'R26-lost-ack-no-retry',
      'an ambiguous acknowledgement transitions to read-only reconciliation and never retries',
      lostAck.automaticRetryPermitted === false &&
        lostAck.nextAction === 'stop_read_only_reconciliation',
      `nextAction=${lostAck.nextAction}`,
    )

    // ---- 13. Cleanup ownership ---------------------------------------------------------------------
    await removeContainerByExactName(container)
    const targetGone = !(await containerExists(container))
    const sentinelSurvived = await containerExists(sentinel)
    record(
      'R27-cleanup-is-operation-owned',
      'cleanup removed the rehearsal target and left an unrelated same-prefix sentinel running',
      targetGone && sentinelSurvived,
      `targetRemoved=${targetGone} sentinelSurvived=${sentinelSurvived}`,
    )
    cleanupVerified = true

    record(
      'R28-protected-database-untouched',
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
    'R29-no-leftovers',
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
