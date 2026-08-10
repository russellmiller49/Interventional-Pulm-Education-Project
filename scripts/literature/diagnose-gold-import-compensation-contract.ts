import { resolve } from 'node:path'

import {
  buildExpectedContractRpcs,
  loadExpectedSchemaSecurityIdentity,
  trustedLocalDeploymentProfileEvidence,
} from './gold-import-compensation-contract-expectations'
import {
  REQUESTED_RECONCILIATION_NAME_DISCREPANCY,
  collectContractDiagnostics,
  type ExecutedContractDiagnostics,
} from './gold-import-compensation-contract-diagnostics'
import {
  reconcileGoldImportCompensationContract,
  type AuditExpectationDefect,
  type GoldImportCompensationContractReconciliation,
} from './gold-import-compensation-contract-reconciliation'
import {
  POST_MIGRATION_RECONCILIATION_BRANCH,
  assertReadOnlyReconciliationRepositoryGuard,
  inspectReadOnlyReconciliationRepositoryState,
} from './gold-import-compensation-read-only-guard'
import { buildReconciledPostMigrationAudit } from './gold-import-compensation-reconciled-audit'
import {
  DEFAULT_BATCH_NAME,
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  assertExclusiveOutputPath,
  assertLocalDatabaseHealthy,
  assertMigrationFileIdentity,
  auditPostMigration,
  buildAuditArtifacts,
  buildSchemaSecurityDefinitionIdentityFromSnapshot,
  canonicalJson,
  collectReadOnlyContractStateHashes,
  collectReadOnlyDatabaseSnapshot,
  defaultCommandRunner,
  loadAndVerifyBackup,
  resolveLocalDockerTarget,
  runLocalSupabaseLint,
  sha256,
  writeCanonicalPackage,
  type CanonicalArtifacts,
  type CommandRunner,
  type ContractStateHashes,
  type OperationalEnvironment,
  type RawDatabaseSnapshot,
} from './gold-import-compensation-migration-operations'
import { type SchemaSecurityDefinitionIdentity } from './gold-import-compensation-rehearsal-evidence'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'

export const CONTRACT_DIAGNOSTIC_ORCHESTRATION_SCHEMA_VERSION =
  'gold-import-compensation-contract-diagnostic-orchestration/1.0.0' as const
export const CONTRACT_DIAGNOSTIC_EXECUTION_SCHEMA_VERSION =
  'gold-import-compensation-contract-diagnostic-execution/1.0.0' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u

const HELP = `
Diagnose the post-migration contract using only read-only local catalog and state snapshots.

Usage:
  npm run literature:diagnose-gold-import-compensation-contract -- \\
    --pre-migration-backup <directory> \\
    --pre-migration-backup-manifest-sha256 <trusted-sha256> \\
    --output <fresh-directory> \\
    --backup-root <existing-directory> [--batch-name gold-set-v1] [--dry-run]

The command is restricted to branch ${POST_MIGRATION_RECONCILIATION_BRANCH}, the exact pinned
local Supabase container, and read-only transactions. It cannot run a migration, import, or
compensation operation. The historical reconcile_literature_gold_import_v1 request is recorded
only as an audit-expectation defect; no alias is queried or created.
`.trim()

export interface ReadOnlyContractDiagnosticBracket {
  schemaVersion: typeof CONTRACT_DIAGNOSTIC_ORCHESTRATION_SCHEMA_VERSION
  preMigrationBackupManifestSha256: string
  snapshotBeforeSha256: string
  snapshotAfterSha256: string
  snapshotsMatch: true
  contractStateHashesBefore: ContractStateHashes
  contractStateHashesAfter: ContractStateHashes
  contractStateHashesMatch: true
  safety: {
    compensationExecuted: false
    databaseMutationCount: 0
    heldOutIdentitiesAccessed: false
    importExecuted: false
    readOnlyDiagnostics: true
    remoteDatabaseAccessed: false
  }
}

export interface DiagnoseContractOperations {
  assertDatabaseHealthy: typeof assertLocalDatabaseHealthy
  assertMigrationIdentity: typeof assertMigrationFileIdentity
  assertOutputPath: typeof assertExclusiveOutputPath
  assertRepositoryState: typeof assertReadOnlyReconciliationRepositoryGuard
  auditLegacyState: typeof auditPostMigration
  buildActualIdentity: typeof buildSchemaSecurityDefinitionIdentityFromSnapshot
  buildAuditArtifactSet: typeof buildAuditArtifacts
  buildExpectedRpcs: typeof buildExpectedContractRpcs
  buildReconciledAudit: typeof buildReconciledPostMigrationAudit
  collectContractEvidence: typeof collectContractDiagnostics
  collectSnapshot: typeof collectReadOnlyDatabaseSnapshot
  collectStateHashes: typeof collectReadOnlyContractStateHashes
  inspectRepositoryState: typeof inspectReadOnlyReconciliationRepositoryState
  loadExpectedIdentity: typeof loadExpectedSchemaSecurityIdentity
  loadPreMigrationBackup: typeof loadAndVerifyBackup
  reconcileContract: typeof reconcileGoldImportCompensationContract
  resolveDockerTarget: typeof resolveLocalDockerTarget
  runLint: typeof runLocalSupabaseLint
  trustedLocalProfile: typeof trustedLocalDeploymentProfileEvidence
  writeArtifactSet: typeof writeCanonicalPackage
}

export interface DiagnoseGoldImportCompensationContractDependencies {
  cwd?: string
  environment?: OperationalEnvironment
  now?: () => Date
  operations?: Partial<DiagnoseContractOperations>
  runCommand?: CommandRunner
}

const PRODUCTION_OPERATIONS: DiagnoseContractOperations = {
  assertDatabaseHealthy: assertLocalDatabaseHealthy,
  assertMigrationIdentity: assertMigrationFileIdentity,
  assertOutputPath: assertExclusiveOutputPath,
  assertRepositoryState: assertReadOnlyReconciliationRepositoryGuard,
  auditLegacyState: auditPostMigration,
  buildActualIdentity: buildSchemaSecurityDefinitionIdentityFromSnapshot,
  buildAuditArtifactSet: buildAuditArtifacts,
  buildExpectedRpcs: buildExpectedContractRpcs,
  buildReconciledAudit: buildReconciledPostMigrationAudit,
  collectContractEvidence: collectContractDiagnostics,
  collectSnapshot: collectReadOnlyDatabaseSnapshot,
  collectStateHashes: collectReadOnlyContractStateHashes,
  inspectRepositoryState: inspectReadOnlyReconciliationRepositoryState,
  loadExpectedIdentity: loadExpectedSchemaSecurityIdentity,
  loadPreMigrationBackup: loadAndVerifyBackup,
  reconcileContract: reconcileGoldImportCompensationContract,
  resolveDockerTarget: resolveLocalDockerTarget,
  runLint: runLocalSupabaseLint,
  trustedLocalProfile: trustedLocalDeploymentProfileEvidence,
  writeArtifactSet: writeCanonicalPackage,
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`)
}

function assertReadOnlySnapshot(snapshot: RawDatabaseSnapshot, label: string): void {
  if (snapshot.database.readOnlyTransaction !== true) {
    throw new Error(`${label} did not attest a read-only transaction.`)
  }
  if (snapshot.scope.datasetSplit !== 'development') {
    throw new Error(`${label} was not restricted to development membership.`)
  }
}

function sealFiles(filesInput: ReadonlyMap<string, string>): CanonicalArtifacts {
  const files = new Map(
    [...filesInput.entries()].sort(([left], [right]) => compareCodeUnits(left, right)),
  )
  const manifest = [...files.entries()]
    .map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`)
    .join('')
  return { files, manifest, manifestSha256: sha256(manifest) }
}

export function buildReadOnlyContractDiagnosticBracket(input: {
  contractStateHashesAfter: ContractStateHashes
  contractStateHashesBefore: ContractStateHashes
  preMigrationBackupManifestSha256: string
  snapshotAfter: RawDatabaseSnapshot
  snapshotBefore: RawDatabaseSnapshot
}): ReadOnlyContractDiagnosticBracket {
  assertSha256(input.preMigrationBackupManifestSha256, 'Pre-migration backup manifest SHA-256')
  assertReadOnlySnapshot(input.snapshotBefore, 'Pre-diagnostic snapshot')
  assertReadOnlySnapshot(input.snapshotAfter, 'Post-diagnostic snapshot')
  if (
    input.contractStateHashesBefore.readOnlyTransaction !== true ||
    input.contractStateHashesAfter.readOnlyTransaction !== true
  ) {
    throw new Error('Contract-state hash brackets must both attest read-only transactions.')
  }
  const snapshotBeforeCanonical = canonicalJson(input.snapshotBefore)
  const snapshotAfterCanonical = canonicalJson(input.snapshotAfter)
  if (snapshotBeforeCanonical !== snapshotAfterCanonical) {
    throw new Error('Database snapshot changed during the read-only contract diagnostic.')
  }
  if (
    canonicalJson(input.contractStateHashesBefore) !== canonicalJson(input.contractStateHashesAfter)
  ) {
    throw new Error(
      'Contract membership/effective/physical hashes changed during the read-only diagnostic.',
    )
  }
  return {
    schemaVersion: CONTRACT_DIAGNOSTIC_ORCHESTRATION_SCHEMA_VERSION,
    preMigrationBackupManifestSha256: input.preMigrationBackupManifestSha256,
    snapshotBeforeSha256: sha256(snapshotBeforeCanonical),
    snapshotAfterSha256: sha256(snapshotAfterCanonical),
    snapshotsMatch: true,
    contractStateHashesBefore: input.contractStateHashesBefore,
    contractStateHashesAfter: input.contractStateHashesAfter,
    contractStateHashesMatch: true,
    safety: {
      compensationExecuted: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      readOnlyDiagnostics: true,
      remoteDatabaseAccessed: false,
    },
  }
}

export function requestedRpcNameAuditExpectationDefects(
  expectedIdentity: SchemaSecurityDefinitionIdentity,
  diagnostics: ExecutedContractDiagnostics,
): AuditExpectationDefect[] {
  if (
    canonicalJson(diagnostics.requestedNameDiscrepancies) !==
    canonicalJson([REQUESTED_RECONCILIATION_NAME_DISCREPANCY])
  ) {
    throw new Error('Contract diagnostics did not preserve the exact requested-name discrepancy.')
  }
  const discrepancy = diagnostics.requestedNameDiscrepancies[0]
  if (
    discrepancy.aliasCreated ||
    diagnostics.functions.some(({ name }) => String(name) === discrepancy.requestedName)
  ) {
    throw new Error(
      'The historical reconciliation name must not be queried or created as an alias.',
    )
  }
  const expectedFunctions = expectedIdentity.records.filter(
    ({ objectName, objectType }) =>
      objectType === 'function' && objectName === discrepancy.canonicalName,
  )
  if (expectedFunctions.length !== 1) {
    throw new Error('Expected identity must contain one canonical reconciliation function record.')
  }
  return [
    {
      objectIdentity: expectedFunctions[0]?.objectIdentity ?? '',
      reason: `Historical audit requested ${discrepancy.requestedName}; the canonical RPC is ${discrepancy.canonicalName}. No compatibility alias is permitted.`,
    },
  ]
}

export function buildSealedContractDiagnosticArtifacts(input: {
  auditArtifacts: CanonicalArtifacts
  bracket: ReadOnlyContractDiagnosticBracket
  diagnostics: ExecutedContractDiagnostics
  reconciliation: GoldImportCompensationContractReconciliation
}): CanonicalArtifacts {
  const verifiedBase = sealFiles(input.auditArtifacts.files)
  if (
    verifiedBase.manifest !== input.auditArtifacts.manifest ||
    verifiedBase.manifestSha256 !== input.auditArtifacts.manifestSha256
  ) {
    throw new Error('Reconciled audit artifact set is not canonically sealed.')
  }
  if (
    canonicalJson(input.diagnostics.requestedNameDiscrepancies) !==
    canonicalJson([REQUESTED_RECONCILIATION_NAME_DISCREPANCY])
  ) {
    throw new Error('Requested RPC-name discrepancy is missing from contract diagnostics.')
  }
  const files = new Map(input.auditArtifacts.files)
  for (const [name, value] of [
    ['contract-diagnostics.json', input.diagnostics],
    ['contract-reconciliation.json', input.reconciliation],
    ['read-only-state-bracket.json', input.bracket],
  ] as const) {
    if (files.has(name)) throw new Error(`Diagnostic artifact collision: ${name}.`)
    files.set(name, canonicalJson(value))
  }
  return sealFiles(files)
}

function operationsWithDefaults(
  overrides: Partial<DiagnoseContractOperations> | undefined,
): DiagnoseContractOperations {
  return { ...PRODUCTION_OPERATIONS, ...overrides }
}

export async function runDiagnoseGoldImportCompensationContract(
  argv: string[],
  dependencies: DiagnoseGoldImportCompensationContractDependencies = {},
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
    throw new Error('This diagnostic command has no commit or database-write mode.')
  }
  if (arguments_.values.has('dry-run')) throw new Error('--dry-run does not accept a value.')

  const backupArgument = stringArgument(arguments_, 'pre-migration-backup')
  const backupManifestSha256 = stringArgument(arguments_, 'pre-migration-backup-manifest-sha256')
  const outputArgument = stringArgument(arguments_, 'output')
  const backupRoot = stringArgument(arguments_, 'backup-root')
  if (!backupArgument) throw new Error('--pre-migration-backup <directory> is required.')
  if (!backupManifestSha256) {
    throw new Error('--pre-migration-backup-manifest-sha256 <trusted-sha256> is required.')
  }
  assertSha256(backupManifestSha256, 'Pre-migration backup manifest SHA-256 argument')
  if (!outputArgument) throw new Error('--output <fresh-directory> is required.')
  if (!backupRoot) throw new Error('--backup-root <existing-directory> is required.')

  const cwd = resolve(dependencies.cwd ?? process.cwd())
  const runCommand = dependencies.runCommand ?? defaultCommandRunner
  const now = dependencies.now ?? (() => new Date())
  const operations = operationsWithDefaults(dependencies.operations)
  const batchName = stringArgument(arguments_, 'batch-name', DEFAULT_BATCH_NAME)
  const container = stringArgument(
    arguments_,
    'database-container',
    DEFAULT_LOCAL_DATABASE_CONTAINER,
  )
  const backupDirectory = resolve(cwd, backupArgument)

  const repository = await operations.inspectRepositoryState(cwd, runCommand)
  operations.assertRepositoryState(repository)
  await operations.assertMigrationIdentity(cwd)
  const outputDirectory = await operations.assertOutputPath({
    backupRoot,
    cwd,
    output: outputArgument,
  })
  const preMigration = await operations.loadPreMigrationBackup(
    backupDirectory,
    backupManifestSha256,
  )
  if (preMigration.manifestSha256 !== backupManifestSha256) {
    throw new Error('Loaded pre-migration backup is not bound to the trusted manifest argument.')
  }

  const dockerTarget = await operations.resolveDockerTarget({
    environment: dependencies.environment,
    runCommand,
  })
  await operations.assertDatabaseHealthy(container, runCommand, dockerTarget)
  const snapshotBefore = await operations.collectSnapshot({
    batchName,
    container,
    dockerTarget,
    runCommand,
  })
  const contractStateHashesBefore = await operations.collectStateHashes({
    batchName,
    container,
    dockerTarget,
    runCommand,
  })
  const diagnostics = await operations.collectContractEvidence({
    container,
    dockerTarget,
    environment: dependencies.environment,
    runCommand,
  })
  const lint = await operations.runLint({ cwd, dockerTarget, runCommand })
  const contractStateHashesAfter = await operations.collectStateHashes({
    batchName,
    container,
    dockerTarget,
    runCommand,
  })
  const snapshotAfter = await operations.collectSnapshot({
    batchName,
    container,
    dockerTarget,
    runCommand,
  })
  const bracket = buildReadOnlyContractDiagnosticBracket({
    contractStateHashesAfter,
    contractStateHashesBefore,
    preMigrationBackupManifestSha256: preMigration.manifestSha256,
    snapshotAfter,
    snapshotBefore,
  })

  const legacyAudit = operations.auditLegacyState({
    contractStateHashes: contractStateHashesAfter,
    contractStateHashesBefore,
    lint,
    preMigration,
    repositoryCommitSha: repository.head,
    snapshot: snapshotAfter,
  })
  const expectedIdentity = await operations.loadExpectedIdentity(cwd)
  const actualIdentity = operations.buildActualIdentity(snapshotAfter)
  const expectedRpcs = operations.buildExpectedRpcs(expectedIdentity)
  const profile = operations.trustedLocalProfile(diagnostics.roles)
  const reconciliation = operations.reconcileContract({
    actualIdentity,
    actualProfile: profile,
    actualRpcs: diagnostics.functions,
    auditExpectationDefects: requestedRpcNameAuditExpectationDefects(expectedIdentity, diagnostics),
    expectedIdentity,
    expectedProfile: profile,
    expectedRpcs,
  })
  const audit = operations.buildReconciledAudit({
    legacyAudit,
    reconciliation,
    requestedNameDiscrepancies: diagnostics.requestedNameDiscrepancies,
    snapshot: snapshotAfter,
  })
  const artifacts = buildSealedContractDiagnosticArtifacts({
    auditArtifacts: operations.buildAuditArtifactSet({ audit, snapshot: snapshotAfter }),
    bracket,
    diagnostics,
    reconciliation,
  })
  await operations.writeArtifactSet({
    artifacts,
    outputDirectory,
    outputRoot: resolve(cwd, backupRoot),
    executionReceipt: {
      schemaVersion: CONTRACT_DIAGNOSTIC_EXECUTION_SCHEMA_VERSION,
      executedAt: now().toISOString(),
      outputDirectory,
      repositoryRoot: cwd,
      repositoryCommitSha: repository.head,
      preMigrationBackupDirectory: backupDirectory,
      preMigrationBackupManifestSha256: preMigration.manifestSha256,
      databaseContainer: container,
      mode: 'read_only_diagnostic',
      canonicalManifestSha256: artifacts.manifestSha256,
      requestedNameDiscrepancies: diagnostics.requestedNameDiscrepancies,
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
    requestedNameDiscrepancies: diagnostics.requestedNameDiscrepancies,
    identities: reconciliation.identities.actual,
  }
}

async function main() {
  const result = await runDiagnoseGoldImportCompensationContract(process.argv.slice(2))
  if ('help' in result) {
    console.log(result.help)
    return
  }
  const discrepancy = result.requestedNameDiscrepancies[0]
  console.log(`Post-migration contract diagnostic status: ${result.status}`)
  console.log(`Readiness: ${result.readinessStatus}`)
  console.log(`Output: ${result.outputDirectory}`)
  console.log(`Canonical manifest SHA-256: ${result.manifestSha256}`)
  console.log(
    `Audit expectation defect: ${discrepancy.requestedName} -> ${discrepancy.canonicalName}; alias created: false`,
  )
  console.log('Database mutations: 0; held-out identities accessed: 0; remote databases touched: 0')
}

if (process.env.NODE_ENV !== 'test') {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
