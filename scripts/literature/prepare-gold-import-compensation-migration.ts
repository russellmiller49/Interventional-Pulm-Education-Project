import { resolve } from 'node:path'

import {
  assertExclusiveOutputPath,
  assertLocalDatabaseHealthy,
  assertMigrationFileIdentity,
  assertRepositoryGuard,
  buildBackupExecutionReceipt,
  buildPreMigrationBackup,
  collectReadOnlyDatabaseSnapshot,
  DEFAULT_BATCH_NAME,
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  defaultCommandRunner,
  inspectRepositoryGuardState,
  resolveLocalDockerTarget,
  type CommandRunner,
  type OperationalEnvironment,
  writeCanonicalPackage,
} from './gold-import-compensation-migration-operations'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'

const HELP = `
Prepare a checksum-bound, development-only backup of the real local gold-set database.

Usage:
  npm run literature:prepare-gold-import-compensation-migration -- \\
    --output <fresh-directory> [--backup-root <existing-directory>] \\
    [--batch-name gold-set-v1] [--dry-run]

The command is always database-read-only and defaults to dry-run semantics. It must run from a
clean primary checkout on main at origin/main. The only accepted database target is the fixed local
Supabase container; --commit, remote URLs, and held-out identity export are unsupported.
`.trim()

export interface PrepareMigrationDependencies {
  cwd?: string
  environment?: OperationalEnvironment
  now?: () => Date
  runCommand?: CommandRunner
}

export async function runPrepareGoldImportCompensationMigration(
  argv: string[],
  dependencies: PrepareMigrationDependencies = {},
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
  ])
  if (hasFlag(arguments_, 'help')) return { help: HELP }
  if (hasFlag(arguments_, 'commit') || arguments_.values.has('commit')) {
    throw new Error('This preparation command has no commit or database-write mode.')
  }
  if (arguments_.values.has('dry-run')) throw new Error('--dry-run does not accept a value.')

  const cwd = resolve(dependencies.cwd ?? process.cwd())
  const runCommand = dependencies.runCommand ?? defaultCommandRunner
  const now = dependencies.now ?? (() => new Date())
  const outputArgument = stringArgument(arguments_, 'output')
  if (!outputArgument) throw new Error('--output <fresh-directory> is required.')
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
  const dockerTarget = await resolveLocalDockerTarget({
    environment: dependencies.environment,
    runCommand,
  })
  await assertLocalDatabaseHealthy(container, runCommand, dockerTarget)
  const snapshot = await collectReadOnlyDatabaseSnapshot({
    batchName,
    container,
    dockerTarget,
    runCommand,
  })
  const backup = buildPreMigrationBackup({
    expectedDevelopmentCount: 630,
    repository: { head: repository.head, originMain: repository.originMain },
    snapshot,
  })
  await writeCanonicalPackage({
    artifacts: backup.artifacts,
    outputDirectory,
    executionReceipt: buildBackupExecutionReceipt({
      canonicalReceipt: backup.canonicalReceipt,
      container,
      executedAt: now().toISOString(),
      manifestSha256: backup.artifacts.manifestSha256,
      outputDirectory,
      repositoryRoot: cwd,
    }),
  })
  return {
    status: 'backup_created' as const,
    outputDirectory,
    manifestSha256: backup.artifacts.manifestSha256,
    effectiveStateSha256: backup.effectiveStateSha256,
    physicalStateSha256: backup.physicalStateSha256,
  }
}

async function main() {
  const result = await runPrepareGoldImportCompensationMigration(process.argv.slice(2))
  if ('help' in result) {
    console.log(result.help)
    return
  }
  console.log(`Pre-migration backup: ${result.status}`)
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
