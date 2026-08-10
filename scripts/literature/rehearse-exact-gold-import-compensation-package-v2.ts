import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  type V2ExactPackageBootstrapSources,
  createBootstrappedExactPackageDatabaseExecutorV2,
} from './execute-exact-gold-import-compensation-package-v2'
import type { GeneratedGoldImportCompensationPackageV2 } from './generate-gold-import-compensation-package-v2'
import {
  loadAndVerifyBackup,
  type LoadedPreMigrationBackup,
} from './gold-import-compensation-migration-operations'
import { GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 } from './gold-import-note-disposition-gate-v2'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  assertExclusiveOutputDirectoryIdentity,
  assertSafeOutputPathArgument,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'
import {
  assertDeterministicV2RehearsalRuns,
  executeV2DisposablePath,
  type ExecuteV2DisposablePathInput,
  type V2DisposablePathResult,
  type V2ExactPackageDatabaseExecutor,
} from './rehearse-gold-import-compensation-db-v2'
import { developmentDatabaseSeedSchema } from './rehearse-exact-gold-import-compensation-package-v1'

const execFileAsync = promisify(execFile)
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const MIGRATION_FILENAME = `${GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2}.sql`
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const PACKAGE_OUTPUT_DIRECTORY = 'exact-package-v2'
export const V2_REHEARSAL_TASK_BRANCH =
  'codex/ip-literature-import-contract-v2-forward-repair-v1' as const
export const GOLD_IMPORT_PRE_V1_BACKUP_PHYSICAL_STATE_SHA256_V2 =
  'b509e876f48112957eda42e8ec04e92a10bc40c3217b0011d1c0d708d519ce4f' as const
const CANONICAL_OUTPUT_NAMES = [
  'disposable-v2-ready-audit.json',
  'exact-package-rehearsal-report-v2.json',
  'fresh-v2-rehearsal-evidence.json',
  'upgrade-v2-rehearsal-evidence.json',
] as const

const CLI_ARGUMENTS = [
  'amended-authorization',
  'amended-authorization-exact-text',
  'artifact',
  'authorization-manifest',
  'authorization-mapping',
  'authorization-mapping-correction',
  'authorization-mapping-correction-manifest',
  'help',
  'migration',
  'note-disposition-audit',
  'output',
  'output-root',
  'planning-state',
  'pre-migration-backup',
  'pre-migration-backup-manifest-sha256',
  'protocol-authorization',
] as const

const HELP = `
Bootstrap, execute, and compensate the exact V2 package in owned disposable databases.

The first upgraded V1-seeded container authenticates V2, collects the ready audit,
derives the post-import hash, and generates the package in context. The command
then regenerates and byte-compares the package while running upgrade twice and
fresh historical+V1+V2 twice. Upgrade loads the authenticated pre-V1 seed at
its historical boundary, applies V1, and brackets only V2. Fresh applies the
complete schema while empty, then loads a validated migration-equivalent V2
projection of the same seed. Their post-V2 schema and clinical identities must
match before package generation or RPC execution. Every run uses the pinned
local Docker image and must prove cleanup. No database URL, host, SQL, remote
target, or held-out input is accepted. Canonical generation additionally
requires the exact ${V2_REHEARSAL_TASK_BRANCH} branch, a completely clean
tracked/untracked worktree, and origin/main ancestry, so run it only after the
reviewed repair is committed.

Usage:
  npm run literature:rehearse-exact-gold-import-compensation-package-v2 -- \\
    --pre-migration-backup <checksum-bound-v1-backup-directory> \\
    --pre-migration-backup-manifest-sha256 <reviewed-sha256> \\
    --planning-state <development-planning-state.json> \\
    --artifact <gold-set-v1-enrichment-v3-final-development-630.csv> \\
    --migration <${MIGRATION_FILENAME}> \\
    --protocol-authorization <signed-protocol-authorization> \\
    --amended-authorization <amended-two-row-authorization> \\
    --amended-authorization-exact-text <exact-text> \\
    --authorization-manifest <manifest> \\
    --authorization-mapping <mapping> \\
    --authorization-mapping-correction <mapping-correction> \\
    --authorization-mapping-correction-manifest <correction-manifest> \\
    --note-disposition-audit <accepted-note-audit.json> \\
    --output-root <existing-local-root> --output <new-evidence-directory>
`.trim()

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

async function assertNoSymlinkAncestors(path: string): Promise<void> {
  let cursor = resolve(path)
  while (true) {
    try {
      const stat = await lstat(cursor)
      if (stat.isSymbolicLink()) throw new Error(`Symlink traversal refused at ${cursor}.`)
    } catch (error) {
      if (!isMissing(error)) throw error
    }
    const parent = dirname(cursor)
    if (parent === cursor) return
    cursor = parent
  }
}

async function readRegularNonSymlinkFile(path: string, label: string): Promise<Buffer> {
  const absolute = resolve(path)
  await assertNoSymlinkAncestors(absolute)
  const stat = await lstat(absolute)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`)
  }
  return readFile(absolute)
}

function parseJson(bytes: Buffer, label: string): unknown {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error(
      `${label} is not JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
}

export interface V2RehearsalRepositoryGit {
  run(arguments_: readonly string[]): Promise<{ stdout: string }>
}

const PRODUCTION_REPOSITORY_GIT: V2RehearsalRepositoryGit = {
  run: async (arguments_) =>
    execFileAsync('git', [...arguments_], {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
    }),
}

export async function authenticateV2RehearsalRepositoryHead(
  git: V2RehearsalRepositoryGit = PRODUCTION_REPOSITORY_GIT,
): Promise<string> {
  const branch = (await git.run(['symbolic-ref', '--short', 'HEAD'])).stdout.trim()
  if (branch !== V2_REHEARSAL_TASK_BRANCH) {
    throw new Error(`V2 rehearsal requires exact task branch ${V2_REHEARSAL_TASK_BRANCH}.`)
  }
  const statusArguments = ['status', '--porcelain=v1', '--untracked-files=all'] as const
  const firstStatus = (await git.run(statusArguments)).stdout
  if (firstStatus.trim().length > 0) {
    throw new Error('V2 rehearsal requires a completely clean tracked and untracked worktree.')
  }
  try {
    await git.run(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'])
  } catch {
    throw new Error('V2 rehearsal requires origin/main to be an ancestor of task-branch HEAD.')
  }
  const head = (await git.run(['rev-parse', 'HEAD'])).stdout.trim()
  if (!/^[a-f0-9]{40}$/u.test(head)) throw new Error('Repository HEAD is not a full commit SHA.')
  const finalBranch = (await git.run(['symbolic-ref', '--short', 'HEAD'])).stdout.trim()
  const finalHead = (await git.run(['rev-parse', 'HEAD'])).stdout.trim()
  const finalStatus = (await git.run(statusArguments)).stdout
  if (
    finalBranch !== V2_REHEARSAL_TASK_BRANCH ||
    finalHead !== head ||
    finalStatus.trim().length > 0
  ) {
    throw new Error('Repository branch, HEAD, or worktree changed during V2 authentication.')
  }
  return head
}

export async function assertV2RehearsalRepositoryUnchanged(
  expectedHead: string,
  readAuthenticatedHead: () => Promise<string>,
): Promise<void> {
  const finalHead = await readAuthenticatedHead()
  if (finalHead !== expectedHead) {
    throw new Error('Repository HEAD changed during the four-run V2 rehearsal.')
  }
}

export function assertAuthenticatedPreV1BackupIdentityV2(input: {
  batchId: unknown
  developmentMembershipSha256: unknown
  effectiveStateSha256: unknown
  physicalStateSha256: unknown
  planningStateSha256: unknown
  seedBatchId: unknown
}): void {
  if (
    input.effectiveStateSha256 !== GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256 ||
    input.physicalStateSha256 !== GOLD_IMPORT_PRE_V1_BACKUP_PHYSICAL_STATE_SHA256_V2 ||
    input.developmentMembershipSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256 ||
    input.planningStateSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256 ||
    input.batchId !== input.seedBatchId
  ) {
    throw new Error(
      'Checksum-bound backup is not the accepted pre-V1 effective/physical/membership/planning state.',
    )
  }
}

function authenticatedSeedFromBackup(
  backup: LoadedPreMigrationBackup,
  trustedManifestSha256: string,
) {
  if (
    !SHA256_PATTERN.test(trustedManifestSha256) ||
    backup.manifestSha256 !== trustedManifestSha256
  ) {
    throw new Error('Loaded pre-migration backup does not match the reviewed manifest identity.')
  }
  const seed = developmentDatabaseSeedSchema.parse(backup.developmentSeed)
  const stateAudits = record(backup.stateAudits, 'pre-migration backup state audits')
  const receipt = record(backup.receipt, 'pre-migration backup receipt')
  const databaseIdentity = record(
    receipt.databaseIdentity,
    'pre-migration backup database identity',
  )
  assertAuthenticatedPreV1BackupIdentityV2({
    batchId: databaseIdentity.batchId,
    developmentMembershipSha256: databaseIdentity.developmentMembershipSha256,
    effectiveStateSha256: stateAudits.effectiveStateSha256,
    physicalStateSha256: stateAudits.physicalStateSha256,
    planningStateSha256: sha256Canonical(backup.planningState),
    seedBatchId: seed.batchId,
  })
  return seed
}

export interface CompleteV2RehearsalResults {
  bootstrapUpgrade: V2DisposablePathResult
  fresh: readonly [V2DisposablePathResult, V2DisposablePathResult]
  upgrade: readonly [V2DisposablePathResult, V2DisposablePathResult]
}

export interface CompleteV2RehearsalDependencies {
  executePath(input: ExecuteV2DisposablePathInput): Promise<V2DisposablePathResult>
}

const PRODUCTION_COMPLETE_REHEARSAL_DEPENDENCIES: CompleteV2RehearsalDependencies = {
  executePath: executeV2DisposablePath,
}

/** Bootstrap in upgrade run one, then require a second upgrade and two fresh runs. */
export async function executeCompleteV2Rehearsal(input: {
  dependencies?: CompleteV2RehearsalDependencies
  exactPackageExecutor: V2ExactPackageDatabaseExecutor
  seed: ReturnType<typeof developmentDatabaseSeedSchema.parse>
}): Promise<CompleteV2RehearsalResults> {
  const dependencies = input.dependencies ?? PRODUCTION_COMPLETE_REHEARSAL_DEPENDENCIES
  const run = (migrationPath: 'fresh' | 'upgrade') =>
    dependencies.executePath({
      exactPackageExecutor: input.exactPackageExecutor,
      migrationPath,
      seed: input.seed,
    })
  const bootstrapUpgrade = await run('upgrade')
  const upgradeSecond = await run('upgrade')
  const freshFirst = await run('fresh')
  const freshSecond = await run('fresh')
  assertDeterministicV2RehearsalRuns(bootstrapUpgrade, upgradeSecond)
  assertDeterministicV2RehearsalRuns(freshFirst, freshSecond)
  if (
    new Set([
      bootstrapUpgrade.migrationSha256,
      upgradeSecond.migrationSha256,
      freshFirst.migrationSha256,
      freshSecond.migrationSha256,
    ]).size !== 1
  ) {
    throw new Error('Complete V2 rehearsal paths used different migration bytes.')
  }
  return {
    bootstrapUpgrade,
    fresh: [freshFirst, freshSecond],
    upgrade: [bootstrapUpgrade, upgradeSecond],
  }
}

function canonicalPathEvidence(result: V2DisposablePathResult): Buffer {
  const expectedNames = ['canonical-manifest.sha256', 'v2-rehearsal-evidence.json']
  const actualNames = [...result.canonicalArtifacts.keys()].sort((left, right) =>
    left.localeCompare(right, 'en'),
  )
  if (canonicalJson(actualNames) !== canonicalJson(expectedNames)) {
    throw new Error(`${result.migrationPath} canonical artifact inventory drifted.`)
  }
  const evidence = result.canonicalArtifacts.get('v2-rehearsal-evidence.json')!
  const manifest = result.canonicalArtifacts.get('canonical-manifest.sha256')!
  if (!manifest.equals(Buffer.from(`${sha256(evidence)}  v2-rehearsal-evidence.json\n`))) {
    throw new Error(`${result.migrationPath} canonical artifact manifest is stale.`)
  }
  return evidence
}

function prettyCanonical(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`, 'utf8')
}

function canonicalManifest(files: ReadonlyMap<string, Buffer>): Buffer {
  return Buffer.from(
    `${[...files.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
}

function buildCanonicalOutputs(input: {
  audit: unknown
  backupManifestSha256: string
  package: GeneratedGoldImportCompensationPackageV2
  results: CompleteV2RehearsalResults
}) {
  const freshEvidence = canonicalPathEvidence(input.results.fresh[0])
  const upgradeEvidence = canonicalPathEvidence(input.results.upgrade[0])
  const auditBytes = prettyCanonical(input.audit)
  const report = {
    audit: {
      environmentInvariantIdentitySha256: record(
        record(input.audit, 'ready audit').contractAudit,
        'ready audit contractAudit',
      ).environmentInvariantIdentitySha256,
      environmentProfileIdentitySha256: record(
        record(input.audit, 'ready audit').contractAudit,
        'ready audit contractAudit',
      ).environmentProfileIdentitySha256,
      sha256: sha256(auditBytes),
      source: 'first_v1_seeded_upgrade_disposable_context',
    },
    backup: {
      manifestSha256: input.backupManifestSha256,
      v1StateAuthenticatedBeforeSourceRead: true,
    },
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: input.results.bootstrapUpgrade.migrationSha256,
    },
    package: {
      actionCounts: input.package.importPlan.counts,
      directory: PACKAGE_OUTPUT_DIRECTORY,
      importPlanSha256: input.package.importPlan.binding.contentSha256,
      manifestSha256: input.package.manifestSha256,
      sourceArtifactSha256: input.package.verifiedBindings.sourceArtifactSha256,
      sourceAuthorizationSetSha256: input.package.verifiedBindings.sourceAuthorizationSetSha256,
    },
    repository: {
      branch: V2_REHEARSAL_TASK_BRANCH,
      cleanTrackedAndUntrackedWorktree: true,
      headSha: input.package.importPlan.executionContext.repositoryCommitSha,
      originMainIsAncestor: true,
    },
    rehearsals: {
      bootstrap: {
        evidenceMatchesRepeatedUpgrade: true,
        migrationPath: 'upgrade',
        packageGeneratedInContext: true,
      },
      fresh: {
        canonicalEvidenceSha256: sha256(freshEvidence),
        completeRuns: 2,
        deterministic: true,
        postV2ProjectedSeedMatchedUpgrade: true,
      },
      upgrade: {
        canonicalEvidenceSha256: sha256(upgradeEvidence),
        completeRuns: 2,
        deterministic: true,
        preV1SeedLoadedAtHistoricalBoundary: true,
        schemaOnlyV1StateBracketed: true,
      },
    },
    safety: {
      allFourContainersRemovedAndVerifiedAbsent: true,
      callerDatabaseTargetAccepted: false,
      heldOutIdentitiesAccessed: false,
      realLocalDatabaseTouched: false,
      remoteDatabaseTouched: false,
      sourceReadOnlyAfterV2BootstrapProbe: true,
    },
    schemaVersion: 'gold-import-compensation-exact-package-rehearsal/2.0.0',
    status: 'passed',
  }
  const files = new Map<string, Buffer>([
    ['disposable-v2-ready-audit.json', auditBytes],
    ['exact-package-rehearsal-report-v2.json', prettyCanonical(report)],
    ['fresh-v2-rehearsal-evidence.json', freshEvidence],
    ['upgrade-v2-rehearsal-evidence.json', upgradeEvidence],
  ])
  if (
    canonicalJson([...files.keys()].sort((left, right) => left.localeCompare(right, 'en'))) !==
    canonicalJson([...CANONICAL_OUTPUT_NAMES])
  ) {
    throw new Error('Canonical V2 rehearsal output inventory drifted.')
  }
  return { files, manifest: canonicalManifest(files), report }
}

export interface ExactV2PackageRehearsalCliDependencies {
  completeRehearsal?: CompleteV2RehearsalDependencies
  loadPreMigrationBackup(
    directory: string,
    trustedManifestSha256: string,
  ): Promise<LoadedPreMigrationBackup>
  readRepositoryHead(): Promise<string>
}

const PRODUCTION_CLI_DEPENDENCIES: ExactV2PackageRehearsalCliDependencies = {
  loadPreMigrationBackup: loadAndVerifyBackup,
  readRepositoryHead: authenticateV2RehearsalRepositoryHead,
}

export async function runExactPackageRehearsalV2Cli(
  argv: readonly string[],
  dependencies: ExactV2PackageRehearsalCliDependencies = PRODUCTION_CLI_DEPENDENCIES,
): Promise<{
  freshEvidenceSha256: string
  migrationSha256: string
  outputDirectory: string
  packageDirectory: string
  packageManifestSha256: string
  upgradeEvidenceSha256: string
}> {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, CLI_ARGUMENTS)
  if (arguments_.flags.has('help')) {
    console.log(HELP)
    return {
      freshEvidenceSha256: '',
      migrationSha256: '',
      outputDirectory: '',
      packageDirectory: '',
      packageManifestSha256: '',
      upgradeEvidenceSha256: '',
    }
  }
  const rawOutputRoot = requiredArgument(arguments_, 'output-root')
  const rawOutputDirectory = requiredArgument(arguments_, 'output')
  assertSafeOutputPathArgument(rawOutputRoot, '--output-root')
  assertSafeOutputPathArgument(rawOutputDirectory, '--output')
  const outputRoot = resolve(rawOutputRoot)
  const outputDirectory = resolve(rawOutputDirectory)
  const migrationPath = resolve(requiredArgument(arguments_, 'migration'))
  if (basename(migrationPath) !== MIGRATION_FILENAME) {
    throw new Error(`--migration must name the exact ${MIGRATION_FILENAME} file.`)
  }

  const trustedBackupManifestSha256 = requiredArgument(
    arguments_,
    'pre-migration-backup-manifest-sha256',
  )
  const backup = await dependencies.loadPreMigrationBackup(
    resolve(requiredArgument(arguments_, 'pre-migration-backup')),
    trustedBackupManifestSha256,
  )
  const seed = authenticatedSeedFromBackup(backup, trustedBackupManifestSha256)
  const commitSha = await dependencies.readRepositoryHead()
  const sourcePaths = {
    amendedAuthorization: resolve(requiredArgument(arguments_, 'amended-authorization')),
    amendedAuthorizationExactText: resolve(
      requiredArgument(arguments_, 'amended-authorization-exact-text'),
    ),
    artifact: resolve(requiredArgument(arguments_, 'artifact')),
    authorizationManifest: resolve(requiredArgument(arguments_, 'authorization-manifest')),
    authorizationMapping: resolve(requiredArgument(arguments_, 'authorization-mapping')),
    authorizationMappingCorrection: resolve(
      requiredArgument(arguments_, 'authorization-mapping-correction'),
    ),
    authorizationMappingCorrectionManifest: resolve(
      requiredArgument(arguments_, 'authorization-mapping-correction-manifest'),
    ),
    migration: migrationPath,
    noteDispositionAudit: resolve(requiredArgument(arguments_, 'note-disposition-audit')),
    planningState: resolve(requiredArgument(arguments_, 'planning-state')),
    protocolAuthorization: resolve(requiredArgument(arguments_, 'protocol-authorization')),
  }
  let sourceReadCount = 0
  const controller = createBootstrappedExactPackageDatabaseExecutorV2({
    readSources: async (): Promise<V2ExactPackageBootstrapSources> => {
      sourceReadCount += 1
      const [
        amendedAuthorizationBytes,
        amendedAuthorizationExactTextBytes,
        authorizationManifestBytes,
        authorizationMappingBytes,
        authorizationMappingCorrectionBytes,
        authorizationMappingCorrectionManifestBytes,
        finalArtifactBytes,
        migrationBytes,
        noteDispositionAuditBytes,
        planningStateBytes,
        signedProtocolAuthorizationBytes,
      ] = await Promise.all([
        readRegularNonSymlinkFile(sourcePaths.amendedAuthorization, 'Amended authorization'),
        readRegularNonSymlinkFile(
          sourcePaths.amendedAuthorizationExactText,
          'Exact amended authorization text',
        ),
        readRegularNonSymlinkFile(sourcePaths.authorizationManifest, 'Authorization manifest'),
        readRegularNonSymlinkFile(sourcePaths.authorizationMapping, 'Authorization mapping'),
        readRegularNonSymlinkFile(
          sourcePaths.authorizationMappingCorrection,
          'Authorization mapping correction',
        ),
        readRegularNonSymlinkFile(
          sourcePaths.authorizationMappingCorrectionManifest,
          'Authorization mapping correction manifest',
        ),
        readRegularNonSymlinkFile(sourcePaths.artifact, 'Finalized V3 artifact'),
        readRegularNonSymlinkFile(sourcePaths.migration, 'V2 migration'),
        readRegularNonSymlinkFile(sourcePaths.noteDispositionAudit, 'Note disposition audit'),
        readRegularNonSymlinkFile(sourcePaths.planningState, 'Development planning state'),
        readRegularNonSymlinkFile(
          sourcePaths.protocolAuthorization,
          'Signed protocol authorization',
        ),
      ])
      return {
        developmentPlanningState: parseJson(planningStateBytes, 'Development planning state'),
        repositoryCommitSha: commitSha,
        sources: {
          amendedAuthorizationBytes,
          amendedAuthorizationExactTextBytes,
          authorizationManifestBytes,
          authorizationMappingBytes,
          authorizationMappingCorrectionBytes,
          authorizationMappingCorrectionManifestBytes,
          finalArtifactBytes,
          migrationBytes,
          noteDispositionAudit: parseJson(noteDispositionAuditBytes, 'Note disposition audit'),
          signedProtocolAuthorizationBytes,
        },
      }
    },
  })
  const results = await executeCompleteV2Rehearsal({
    dependencies: dependencies.completeRehearsal,
    exactPackageExecutor: controller.executor,
    seed,
  })
  if (controller.generatedPackageCount() !== 4 || sourceReadCount !== 4) {
    throw new Error('Every bootstrap/repetition did not independently regenerate the V2 package.')
  }
  await assertV2RehearsalRepositoryUnchanged(commitSha, dependencies.readRepositoryHead)
  const package_ = controller.referencePackage()
  const audit = controller.referenceAudit()
  const canonical = buildCanonicalOutputs({
    audit,
    backupManifestSha256: trustedBackupManifestSha256,
    package: package_,
    results,
  })
  const executionPathReceipt = (result: V2DisposablePathResult) => ({
    cleanup: result.cleanup,
    migrationPath: result.migrationPath,
    migrationSha256: result.migrationSha256,
    rawReceipt: result.rawReceipt,
  })
  const rawReceipt = prettyCanonical({
    bootstrapUpgradeRunIndex: 1,
    canonicalManifestExcludedVolatileReceipt: true,
    fresh: results.fresh.map(executionPathReceipt),
    packageGenerationCount: controller.generatedPackageCount(),
    schemaVersion: 'gold-import-compensation-exact-package-rehearsal-execution/2.0.0',
    sourceReadCount,
    upgrade: results.upgrade.map(executionPathReceipt),
  })

  // Nothing is published until all four owned containers have been removed and
  // their independent exact-name/ID absence checks have passed.
  const output = await createExclusiveOutputDirectory({ outputDirectory, outputRoot })
  const packageDirectory = resolve(output.outputDirectory, PACKAGE_OUTPUT_DIRECTORY)
  const packageOutput = await createExclusiveOutputDirectory({
    outputDirectory: packageDirectory,
    outputRoot: output.outputDirectory,
  })
  writeExclusiveOutputFiles(
    packageOutput,
    [...package_.files.entries()].map(([name, bytes]) => ({ bytes, name })),
  )
  await assertExclusiveOutputDirectoryIdentity(packageOutput)
  writeExclusiveOutputFiles(output, [
    ...[...canonical.files.entries()].map(([name, bytes]) => ({ bytes, name })),
    { bytes: canonical.manifest, name: 'canonical-manifest-v2.sha256' },
    { bytes: rawReceipt, name: 'execution-receipt-v2.json' },
  ])
  await assertExclusiveOutputDirectoryIdentity(output)

  const freshEvidence = canonical.files.get('fresh-v2-rehearsal-evidence.json')!
  const upgradeEvidence = canonical.files.get('upgrade-v2-rehearsal-evidence.json')!
  return {
    freshEvidenceSha256: sha256(freshEvidence),
    migrationSha256: results.bootstrapUpgrade.migrationSha256,
    outputDirectory,
    packageDirectory,
    packageManifestSha256: package_.manifestSha256,
    upgradeEvidenceSha256: sha256(upgradeEvidence),
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runExactPackageRehearsalV2Cli(process.argv.slice(2))
    .then((result) => {
      if (result.outputDirectory) console.log(`${JSON.stringify(result, null, 2)}\n`)
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
