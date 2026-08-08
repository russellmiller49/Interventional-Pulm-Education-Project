import { resolve } from 'node:path'

import {
  assertExclusiveOutputPath,
  assertLocalDatabaseHealthy,
  assertMigrationFileIdentity,
  assertRepositoryGuard,
  auditPostMigration,
  buildAuditArtifacts,
  collectReadOnlyDatabaseSnapshot,
  collectReadOnlyContractStateHashes,
  DEFAULT_BATCH_NAME,
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  defaultCommandRunner,
  inspectRepositoryGuardState,
  loadAndVerifyBackup,
  resolveLocalDockerTarget,
  runLocalSupabaseLint,
  type CommandRunner,
  type OperationalEnvironment,
  writeCanonicalPackage,
} from './gold-import-compensation-migration-operations'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'

const HELP = `
Audit the real local gold-set database against a checksum-bound pre-migration backup.

Usage:
  npm run literature:audit-gold-import-compensation-migration -- \\
    --pre-migration-backup <directory> \\
    --pre-migration-backup-manifest-sha256 <trusted-sha256> \\
    --output <fresh-directory> \\
    [--backup-root <existing-directory>] [--batch-name gold-set-v1] [--dry-run]

Before the migration is present the deterministic report status is not_yet_migrated and no
development planning artifact is emitted. The command never creates fixture reviews and never
executes import, compensation, or any database mutation.
`.trim()

export interface AuditMigrationDependencies {
  cwd?: string
  environment?: OperationalEnvironment
  now?: () => Date
  runCommand?: CommandRunner
}

export async function runAuditGoldImportCompensationMigration(
  argv: string[],
  dependencies: AuditMigrationDependencies = {},
) {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, [
    'backup-root',
    'batch-name',
    'commit',
    'database-container',
    'dry-run',
    'help',
    'output',
    'pre-migration-backup',
    'pre-migration-backup-manifest-sha256',
  ])
  if (hasFlag(arguments_, 'help')) return { help: HELP }
  if (hasFlag(arguments_, 'commit') || arguments_.values.has('commit')) {
    throw new Error('This audit command has no commit or database-write mode.')
  }
  if (arguments_.values.has('dry-run')) throw new Error('--dry-run does not accept a value.')

  const cwd = resolve(dependencies.cwd ?? process.cwd())
  const runCommand = dependencies.runCommand ?? defaultCommandRunner
  const now = dependencies.now ?? (() => new Date())
  const backupArgument = stringArgument(arguments_, 'pre-migration-backup')
  const backupManifestSha256 = stringArgument(arguments_, 'pre-migration-backup-manifest-sha256')
  const outputArgument = stringArgument(arguments_, 'output')
  if (!backupArgument) throw new Error('--pre-migration-backup <directory> is required.')
  if (!backupManifestSha256) {
    throw new Error('--pre-migration-backup-manifest-sha256 <trusted-sha256> is required.')
  }
  if (!outputArgument) throw new Error('--output <fresh-directory> is required.')
  const backupDirectory = resolve(cwd, backupArgument)
  const backupRoot = stringArgument(arguments_, 'backup-root')
  const batchName = stringArgument(arguments_, 'batch-name', DEFAULT_BATCH_NAME)
  const container = stringArgument(
    arguments_,
    'database-container',
    DEFAULT_LOCAL_DATABASE_CONTAINER,
  )

  const repository = await inspectRepositoryGuardState(cwd, runCommand)
  assertRepositoryGuard(repository)
  await assertMigrationFileIdentity(cwd)
  const outputDirectory = await assertExclusiveOutputPath({
    backupRoot,
    cwd,
    output: outputArgument,
  })
  const preMigration = await loadAndVerifyBackup(backupDirectory, backupManifestSha256)
  const dockerTarget = await resolveLocalDockerTarget({
    environment: dependencies.environment,
    runCommand,
  })
  await assertLocalDatabaseHealthy(container, runCommand, dockerTarget)
  const initialSnapshot = await collectReadOnlyDatabaseSnapshot({
    batchName,
    container,
    dockerTarget,
    runCommand,
  })
  const preliminary = auditPostMigration({
    preMigration,
    repositoryCommitSha: repository.head,
    snapshot: initialSnapshot,
  })
  const migration = preliminary.report.migration as { applied?: unknown }
  let audit = preliminary
  let auditedSnapshot = initialSnapshot
  if (migration.applied === true) {
    const contractStateHashesBefore = await collectReadOnlyContractStateHashes({
      batchName,
      container,
      dockerTarget,
      runCommand,
    })
    auditedSnapshot = await collectReadOnlyDatabaseSnapshot({
      batchName,
      container,
      dockerTarget,
      runCommand,
    })
    const contractStateHashes = await collectReadOnlyContractStateHashes({
      batchName,
      container,
      dockerTarget,
      runCommand,
    })
    audit = auditPostMigration({
      contractStateHashes,
      contractStateHashesBefore,
      lint: await runLocalSupabaseLint({ cwd, dockerTarget, runCommand }),
      preMigration,
      repositoryCommitSha: repository.head,
      snapshot: auditedSnapshot,
    })
  }
  const artifacts = buildAuditArtifacts({ audit, snapshot: auditedSnapshot })
  await writeCanonicalPackage({
    artifacts,
    outputDirectory,
    executionReceipt: {
      schemaVersion: 'gold-import-compensation-audit-execution/1.0.0',
      executedAt: now().toISOString(),
      outputDirectory,
      preMigrationBackupDirectory: backupDirectory,
      repositoryRoot: cwd,
      databaseContainer: container,
      mode: 'read_only_dry_run',
      canonicalManifestSha256: artifacts.manifestSha256,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
    },
  })
  return {
    status: String(audit.report.status),
    readinessStatus: String(audit.report.readinessStatus),
    outputDirectory,
    manifestSha256: artifacts.manifestSha256,
  }
}

async function main() {
  const result = await runAuditGoldImportCompensationMigration(process.argv.slice(2))
  if ('help' in result) {
    console.log(result.help)
    return
  }
  console.log(`Post-migration audit status: ${result.status}`)
  console.log(`Readiness: ${result.readinessStatus}`)
  console.log(`Output: ${result.outputDirectory}`)
  console.log(`Canonical manifest SHA-256: ${result.manifestSha256}`)
  console.log('Database mutations: 0; held-out identities accessed: 0; remote databases touched: 0')
}

if (process.env.NODE_ENV !== 'test') {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
