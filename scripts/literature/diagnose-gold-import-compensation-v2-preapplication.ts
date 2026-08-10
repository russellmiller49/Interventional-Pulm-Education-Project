import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2 } from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  assertExclusiveOutputPath,
  assertLocalDatabaseHealthy,
  assertReadOnlySnapshotSql,
  buildDevelopmentDatabaseSeed,
  canonicalJson,
  collectReadOnlyContractStateHashes,
  collectReadOnlyDatabaseSnapshot,
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  defaultCommandRunner,
  developmentPlanningStateSha256,
  IMPORT_COMPENSATION_MIGRATION_FILE,
  IMPORT_COMPENSATION_MIGRATION_SHA256,
  resolveLocalDockerTarget,
  sha256,
  writeCanonicalPackage,
  type CanonicalArtifacts,
  type RawDatabaseSnapshot,
} from './gold-import-compensation-migration-operations'
import { GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 } from './gold-import-note-disposition-gate-v2'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  buildDefaultLocalStartPlan,
  classifyProtectedV2Ledger,
  type ProtectedMigrationLedgerEntry,
} from './protected-gold-import-contract-v2'

export const GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-report/1.0.0' as const
export const GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-execution/1.0.0' as const
export const GOLD_IMPORT_V2_TASK_BRANCH =
  'codex/ip-literature-import-contract-v2-forward-repair-v1' as const

const execFileAsync = promisify(execFile)
const V2_MIGRATION_FILE = `${GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2}.sql`
const V1_MIGRATION_VERSION = '20260808035633'
const V1_MIGRATION_NAME = 'add_literature_gold_import_compensation_contract'
const BATCH_NAME = 'gold-set-v1'
const MARKER = 'GOLD_IMPORT_V2_PREAPPLICATION_COUNTS:'

const HELP = `
Create the final read-only real-local pre-application report for the V2 repair.

Usage:
  npm run literature:diagnose-gold-import-compensation-v2-preapplication -- \\
    --backup-root <existing-directory> --output <fresh-directory>

The command is pinned to the exact task branch, local Supabase container, and development batch.
Every database query opens a repeatable-read/read-only transaction. It never reads finalized source
artifacts, constructs an application database client, or exposes held-out identities.
`.trim()

interface OperationCounts {
  actionCount: number
  compensationCount: number
  importCount: number
  readOnlyTransaction: true
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function rows(snapshot: RawDatabaseSnapshot) {
  return snapshot.developmentItems.map((entry, index) => {
    const row = record(entry, `developmentItems[${index}]`)
    return {
      events: Array.isArray(row.events) ? row.events : [],
      item: record(row.item, `developmentItems[${index}].item`),
      reviews: Array.isArray(row.reviews) ? row.reviews : [],
    }
  })
}

function protectedState(snapshot: RawDatabaseSnapshot) {
  return rows(snapshot).map(({ events, item, reviews }) => ({
    events,
    item: {
      automatedSignalsRevealedAt: item.automated_signals_revealed_at ?? null,
      currentReviewId: item.current_review_id ?? null,
      id: item.id,
      supplementalMetadataRevealedAt: item.supplemental_metadata_revealed_at ?? null,
    },
    reviews,
  }))
}

function countChangedRows(before: unknown[], after: unknown[]): number {
  const indexed = (values: unknown[], label: string) => {
    const result = new Map<string, string>()
    values.forEach((value, index) => {
      const row = record(value, `${label}[${index}]`)
      const id = String(row.id ?? '')
      if (!id || result.has(id)) throw new Error(`${label} has a missing or duplicate row ID.`)
      result.set(id, canonicalJson(row))
    })
    return result
  }
  const left = indexed(before, 'before rows')
  const right = indexed(after, 'after rows')
  return [...new Set([...left.keys(), ...right.keys()])].filter(
    (id) => left.get(id) !== right.get(id),
  ).length
}

function mutationCounts(before: RawDatabaseSnapshot, after: RawDatabaseSnapshot) {
  const beforeRows = rows(before)
  const afterRows = rows(after)
  const beforeItems = beforeRows.map(({ item }) => item)
  const afterItems = afterRows.map(({ item }) => item)
  const beforeReviews = beforeRows.flatMap(({ reviews }) => reviews)
  const afterReviews = afterRows.flatMap(({ reviews }) => reviews)
  const itemProjection = (items: Record<string, unknown>[], key: string) =>
    items.map((item) => ({ id: item.id, value: item[key] ?? null }))
  return {
    pointerMutationCount: countChangedRows(
      itemProjection(beforeItems, 'current_review_id'),
      itemProjection(afterItems, 'current_review_id'),
    ),
    revealTimestampMutationCount: countChangedRows(
      beforeItems.map((item) => ({
        id: item.id,
        automated: item.automated_signals_revealed_at ?? null,
        supplemental: item.supplemental_metadata_revealed_at ?? null,
      })),
      afterItems.map((item) => ({
        id: item.id,
        automated: item.automated_signals_revealed_at ?? null,
        supplemental: item.supplemental_metadata_revealed_at ?? null,
      })),
    ),
    reviewRowMutationCount: countChangedRows(beforeReviews, afterReviews),
  }
}

function migrationOccurrences(snapshot: RawDatabaseSnapshot, version: string, name: string) {
  return snapshot.migrationLedger.filter((entry, index) => {
    const row = record(entry, `migrationLedger[${index}]`)
    return row.version === version && row.name === name
  }).length
}

async function git(cwd: string, arguments_: string[]) {
  const result = await execFileAsync('git', arguments_, { cwd, encoding: 'utf8' })
  return result.stdout.trim()
}

async function inspectRepository(cwd: string) {
  const [branch, head, originMain, mergeBase, status] = await Promise.all([
    git(cwd, ['branch', '--show-current']),
    git(cwd, ['rev-parse', 'HEAD']),
    git(cwd, ['rev-parse', 'origin/main']),
    git(cwd, ['merge-base', 'HEAD', 'origin/main']),
    git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']),
  ])
  if (branch !== GOLD_IMPORT_V2_TASK_BRANCH && branch !== 'main') {
    throw new Error('Pre-application reporting requires the task branch or primary main.')
  }
  if (branch === 'main' && head !== originMain) {
    throw new Error('Primary-main pre-application reporting requires HEAD exactly at origin/main.')
  }
  if (mergeBase !== originMain) throw new Error('origin/main is not an ancestor of task HEAD.')
  if (status !== '') throw new Error('Pre-application reporting requires a clean worktree.')
  return { branch, head, originMain }
}

async function collectOperationCounts(
  dockerArguments: string[],
  environment: NodeJS.ProcessEnv,
): Promise<OperationCounts> {
  const sql = buildGoldImportV2PreapplicationCountSql()
  assertReadOnlySnapshotSql(sql)
  const result = await defaultCommandRunner(
    'docker',
    [
      ...dockerArguments,
      'exec',
      '--interactive',
      DEFAULT_LOCAL_DATABASE_CONTAINER,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--tuples-only',
      '--no-align',
      '--quiet',
    ],
    { env: environment, stdin: sql },
  )
  const lines = result.stdout.split(/\r?\n/u).filter((line) => line.startsWith(MARKER))
  if (lines.length !== 1)
    throw new Error('Read-only operation-count marker was absent or duplicated.')
  const parsed = record(JSON.parse(lines[0]!.slice(MARKER.length)) as unknown, 'operation counts')
  if (
    parsed.readOnlyTransaction !== true ||
    !Number.isInteger(parsed.importCount) ||
    !Number.isInteger(parsed.compensationCount) ||
    !Number.isInteger(parsed.actionCount)
  ) {
    throw new Error('Read-only operation counts were malformed.')
  }
  return parsed as unknown as OperationCounts
}

export function buildGoldImportV2PreapplicationCountSql(): string {
  return `
begin transaction isolation level repeatable read read only;
set local statement_timeout = '120s';
select '${MARKER}' || jsonb_build_object(
  'readOnlyTransaction', current_setting('transaction_read_only')::boolean,
  'importCount', count(*) filter (where operation_kind = 'import'),
  'compensationCount', count(*) filter (where operation_kind = 'compensation'),
  'actionCount', (
    select count(*)
    from public.literature_gold_review_operation_actions action
    join public.literature_gold_review_operations operation on operation.id = action.operation_id
    join public.literature_gold_set_batches batch on batch.id = operation.batch_id
    where batch.name = '${BATCH_NAME}'
  )
)::text
from (
  select operation.id as operation_id, operation.operation_kind
  from public.literature_gold_review_operations operation
  join public.literature_gold_set_batches batch on batch.id = operation.batch_id
  where batch.name = '${BATCH_NAME}'
) selected_operations;
rollback;
`.trim()
}

function seal(files: ReadonlyMap<string, string>): CanonicalArtifacts {
  const sorted = new Map([...files].sort(([left], [right]) => left.localeCompare(right, 'en')))
  const manifest = [...sorted].map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`).join('')
  return { files: sorted, manifest, manifestSha256: sha256(manifest) }
}

export async function runGoldImportV2PreapplicationDiagnostic(argv: string[]) {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, ['backup-root', 'help', 'output'])
  if (arguments_.flags.has('help')) return { help: HELP }
  const outputArgument = stringArgument(arguments_, 'output')
  const backupRoot = stringArgument(arguments_, 'backup-root')
  if (!outputArgument || !backupRoot) throw new Error(HELP)
  const cwd = process.cwd()
  const repository = await inspectRepository(cwd)
  const outputDirectory = await assertExclusiveOutputPath({
    backupRoot,
    cwd,
    output: outputArgument,
  })
  const [v1Bytes, v2Bytes] = await Promise.all([
    readFile(resolve(cwd, 'supabase/migrations', IMPORT_COMPENSATION_MIGRATION_FILE)),
    readFile(resolve(cwd, 'supabase/migrations', V2_MIGRATION_FILE)),
  ])
  if (sha256(v1Bytes) !== IMPORT_COMPENSATION_MIGRATION_SHA256) {
    throw new Error('Historical V1 migration byte identity drifted.')
  }
  if (sha256(v2Bytes) !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256) {
    throw new Error('Protected V2 migration byte identity drifted.')
  }
  const dockerTarget = await resolveLocalDockerTarget()
  await assertLocalDatabaseHealthy(
    DEFAULT_LOCAL_DATABASE_CONTAINER,
    defaultCommandRunner,
    dockerTarget,
  )
  const operationCountsBefore = await collectOperationCounts(
    dockerTarget.dockerArguments,
    dockerTarget.environment,
  )
  const stateHashesBefore = await collectReadOnlyContractStateHashes({ dockerTarget })
  const snapshotBefore = await collectReadOnlyDatabaseSnapshot({ dockerTarget })
  const snapshotAfter = await collectReadOnlyDatabaseSnapshot({ dockerTarget })
  const stateHashesAfter = await collectReadOnlyContractStateHashes({ dockerTarget })
  const operationCountsAfter = await collectOperationCounts(
    dockerTarget.dockerArguments,
    dockerTarget.environment,
  )
  const planningBefore = developmentPlanningStateSha256(snapshotBefore)
  const planningAfter = developmentPlanningStateSha256(snapshotAfter)
  const mutations = mutationCounts(snapshotBefore, snapshotAfter)
  const v1Occurrence = migrationOccurrences(snapshotAfter, V1_MIGRATION_VERSION, V1_MIGRATION_NAME)
  const protectedLedgerEntries = snapshotAfter.migrationLedger.map((entry, index) => {
    const row = record(entry, `migrationLedger[${index}]`)
    return { name: String(row.name ?? ''), version: String(row.version ?? '') }
  }) satisfies ProtectedMigrationLedgerEntry[]
  const protectedLedgerState = classifyProtectedV2Ledger(protectedLedgerEntries)
  const v1RelevantEntries = protectedLedgerEntries.filter(
    ({ name, version }) => name === V1_MIGRATION_NAME || version === V1_MIGRATION_VERSION,
  )
  const v2Occurrence = protectedLedgerState.relevantEntries.length
  const batch = record(record(snapshotAfter.scope, 'scope').batch, 'scope.batch')
  const expected = GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2
  if (
    v1Occurrence !== 1 ||
    v1RelevantEntries.length !== 1 ||
    protectedLedgerState.kind !== 'v2_absent' ||
    stateHashesBefore.developmentMembershipSha256 !== expected.developmentMembershipSha256 ||
    stateHashesAfter.developmentMembershipSha256 !== expected.developmentMembershipSha256 ||
    stateHashesBefore.effectiveStateSha256 !== expected.effectiveStateSha256 ||
    stateHashesAfter.effectiveStateSha256 !== expected.effectiveStateSha256 ||
    stateHashesBefore.physicalStateSha256 !== expected.physicalStateSha256 ||
    stateHashesAfter.physicalStateSha256 !== expected.physicalStateSha256 ||
    planningBefore !== expected.developmentPlanningStateSha256 ||
    planningAfter !== expected.developmentPlanningStateSha256 ||
    canonicalJson(protectedState(snapshotBefore)) !==
      canonicalJson(protectedState(snapshotAfter)) ||
    canonicalJson(operationCountsBefore) !== canonicalJson(operationCountsAfter) ||
    Object.values(mutations).some((count) => count !== 0) ||
    operationCountsAfter.importCount !== 0 ||
    operationCountsAfter.compensationCount !== 0
  ) {
    throw new Error('Real-local state drifted or contains a forbidden operation; report aborted.')
  }
  const developmentSeed = buildDevelopmentDatabaseSeed(snapshotAfter)
  const migrationLedgerBackup = {
    schemaVersion: 'literature-gold-protected-v2-ledger-backup/1.0.0',
    entries: snapshotAfter.migrationLedger,
    protectedV2: {
      classification: protectedLedgerState.kind,
      expected: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
      occurrence: v2Occurrence,
    },
  }
  const stateHashBackup = {
    schemaVersion: 'literature-gold-protected-v2-state-backup/1.0.0',
    batchId: String(batch.id ?? ''),
    batchName: BATCH_NAME,
    datasetSplit: 'development',
    developmentMembershipSha256: stateHashesAfter.developmentMembershipSha256,
    developmentPlanningStateSha256: planningAfter,
    effectiveStateSha256: stateHashesAfter.effectiveStateSha256,
    physicalStateSha256: stateHashesAfter.physicalStateSha256,
  }
  const backupFiles = {
    'development-database-seed.json': canonicalJson(developmentSeed),
    'protected-migration-ledger.json': canonicalJson(migrationLedgerBackup),
    'state-hashes.json': canonicalJson(stateHashBackup),
  } as const
  const report = {
    schemaVersion: GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION,
    status: 'implementation_ready_real_local_migration_required',
    repository,
    migration: {
      v1: {
        byteIdentical: true,
        id: IMPORT_COMPENSATION_MIGRATION_FILE.replace(/\.sql$/u, ''),
        occurrence: v1Occurrence,
        sha256: IMPORT_COMPENSATION_MIGRATION_SHA256,
      },
      v2: {
        appliedToRealLocal: false,
        id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
        occurrence: v2Occurrence,
        sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256,
      },
    },
    database: {
      batchId: String(batch.id ?? ''),
      batchName: BATCH_NAME,
      current: {
        developmentMembershipSha256: stateHashesAfter.developmentMembershipSha256,
        developmentPlanningStateSha256: planningAfter,
        effectiveStateSha256: stateHashesAfter.effectiveStateSha256,
        physicalStateSha256: stateHashesAfter.physicalStateSha256,
      },
      readOnlyBracket: {
        before: { ...stateHashesBefore, developmentPlanningStateSha256: planningBefore },
        after: { ...stateHashesAfter, developmentPlanningStateSha256: planningAfter },
        matches: true,
      },
      operations: operationCountsAfter,
      mutations,
    },
    readiness: {
      implementationAndDisposableRehearsalMayBeReady: true,
      realLocalMigrationApplicationSeparatelyAuthorized: false,
      realLocalPackageExecutionAuthorized: false,
      requiredNextStep: 'separately_authorized_real_local_v2_migration_application',
    },
    ordinaryLocalStartPlan: buildDefaultLocalStartPlan(protectedLedgerEntries),
    backup: {
      completeDevelopmentSnapshot: true,
      heldOutIdentitiesIncluded: false,
      files: Object.fromEntries(
        Object.entries(backupFiles).map(([name, bytes]) => [name, sha256(bytes)]),
      ),
    },
    safety: {
      compensationExecuted: false,
      finalizedSourceArtifactRead: false,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      realLocalDatabaseMutationCount: 0,
      remoteDatabaseAccessed: false,
      repeatableReadReadOnly: true,
      writeCapableApplicationClientConstructed: false,
    },
  }
  const markdown = `# Gold import contract V2 real-local pre-application report

- Status: \`implementation_ready_real_local_migration_required\`
- V1 migration occurrence: \`${v1Occurrence}\`
- V2 migration occurrence: \`${v2Occurrence}\`
- Membership: \`${stateHashesAfter.developmentMembershipSha256}\`
- Effective state: \`${stateHashesAfter.effectiveStateSha256}\`
- Physical state: \`${stateHashesAfter.physicalStateSha256}\`
- Planning state: \`${planningAfter}\`
- Review-row mutations: \`${mutations.reviewRowMutationCount}\`
- Pointer mutations: \`${mutations.pointerMutationCount}\`
- Reveal-timestamp mutations: \`${mutations.revealTimestampMutationCount}\`
- Imports: \`${operationCountsAfter.importCount}\`
- Compensations: \`${operationCountsAfter.compensationCount}\`
- Held-out identities accessed: \`false\`
- Remote database accessed: \`false\`
- Ordinary local-start protected state: \`v2_absent_unarmed\`
- Protected V2 visible to first-start initialization: \`false\`
- Protected V2 visible to ordinary migration-up: \`false\`

The V2 migration remains unapplied to the real local database. Package execution therefore remains
blocked until a separately authorized migration-application session completes and re-audits it.
`
  const artifacts = seal(
    new Map([
      ['pre-application-report.json', canonicalJson(report)],
      ['pre-application-report.md', markdown],
      ...Object.entries(backupFiles),
    ]),
  )
  const executionReceipt = {
    schemaVersion: GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION,
    executedAt: new Date().toISOString(),
    outputDirectory,
    canonicalManifestSha256: artifacts.manifestSha256,
    repositoryCommitSha: repository.head,
    databaseMutationCount: 0,
    heldOutIdentitiesAccessed: false,
    remoteDatabaseAccessed: false,
  }
  await writeCanonicalPackage({
    artifacts,
    executionReceipt,
    outputDirectory,
    outputRoot: resolve(cwd, backupRoot),
  })
  return { outputDirectory, manifestSha256: artifacts.manifestSha256, report }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runGoldImportV2PreapplicationDiagnostic(process.argv.slice(2))
    .then((result) => {
      if ('help' in result) console.log(result.help)
      else
        console.log(
          JSON.stringify(
            {
              outputDirectory: result.outputDirectory,
              manifestSha256: result.manifestSha256,
              status: result.report.status,
            },
            null,
            2,
          ),
        )
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
