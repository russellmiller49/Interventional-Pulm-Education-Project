import { createHash, randomBytes } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  assertExclusiveOutputPath,
  assertLocalDatabaseHealthy,
  assertRepositoryGuard,
  canonicalJson,
  collectReadOnlyContractStateHashes,
  collectReadOnlyDatabaseSnapshot,
  defaultCommandRunner,
  developmentPlanningStateSha256,
  inspectRepositoryGuardState,
  resolveLocalDockerTarget,
  type CommandRunner,
  type LocalDockerTarget,
  type RawDatabaseSnapshot,
} from './gold-import-compensation-migration-operations'
import { GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 } from './gold-import-note-disposition-gate-v2'
import {
  ORDINARY_LITERATURE_MIGRATIONS,
  createSupabaseRunner,
  defaultLocalSupabasePaths,
  stageAuthorizedProtectedV2Migration,
} from './local-supabase'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import {
  PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION as PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION_V2,
  PROTECTED_V2_APPLICATION_RESULT_SCHEMA_VERSION,
  PROTECTED_V2_BACKUP_DUPLICATE_MARKER_DIRECTORY,
  buildProtectedV2ApplicationExecutionReceipt,
  buildProtectedV2ApplicationIntent,
  buildProtectedV2ApplicationResult,
  buildProtectedV2PostApplicationAudit,
  parseProtectedV2ApplicationExecutionReceipt,
  parseProtectedV2ApplicationIntent,
  parseProtectedV2ApplicationResult,
  parseProtectedV2BackupExecutionReceipt,
  parseProtectedV2BackupDuplicateMarker,
  type ProtectedV2ApplicationExecutionReceipt,
  type ProtectedV2ApplicationIntent,
  type ProtectedV2ApplicationResult,
  type ProtectedV2PostApplicationAudit,
} from './protected-gold-import-contract-v2-evidence'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
  PROTECTED_V2_BACKUP_TRUST_MODEL,
  PROTECTED_V2_CONFIRMATION,
  PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
  buildProtectedV2Authorization,
  classifyProtectedV2Ledger,
  classifyProtectedV2State,
  validateProtectedV2Authorization,
  type ProtectedMigrationLedgerEntry,
  type ProtectedV2AuthorizationContext,
  type ProtectedV2BackupBinding,
} from './protected-gold-import-contract-v2'
import {
  assertProtectedV2OperatorBundleUnchanged,
  buildProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'
import {
  PROTECTED_V2_AUDIT_COMPONENT_NAMES,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256,
  PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256,
  collectProtectedV2CompleteCatalogAudit,
} from './gold-import-contract-v2-catalog-audit'
import { GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION } from './diagnose-gold-import-compensation-v2-preapplication'

export const PROTECTED_V2_APPLICATION_REPORT_SCHEMA_VERSION =
  PROTECTED_V2_APPLICATION_RESULT_SCHEMA_VERSION
export const PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION =
  PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION_V2
export const PROTECTED_V2_BACKUP_MAX_AGE_MILLISECONDS = 2 * 60 * 60 * 1000

const REQUIRED_BACKUP_CANONICAL_FILES = [
  'development-database-seed.json',
  'pre-application-report.json',
  'pre-application-report.md',
  'protected-migration-ledger.json',
  'state-hashes.json',
] as const
const REQUIRED_BACKUP_DIRECTORY_FILES = [
  ...REQUIRED_BACKUP_CANONICAL_FILES,
  'checksum-manifest.sha256',
  'execution-receipt.json',
] as const
const APPLICATION_INTENT_FILES = [
  'application-intent.json',
  'application-intent.md',
  'intent-checksum-manifest.sha256',
] as const
const FINALIZED_APPLICATION_DIRECTORY = 'finalized' as const
const FINALIZED_APPLICATION_FILES = [
  'application-result.json',
  'application-result.md',
  'checksum-manifest.sha256',
  'execution-receipt.json',
] as const
const HELP = `
Dry-run, intentionally apply, or reconcile the protected Literature gold import contract V2 migration receipt.

Usage (read-only dry-run; default):
  npm run literature:apply-protected-gold-import-contract-v2 -- \\
    --target local --operator <IDENTITY> \\
    --backup <FRESH_BACKUP_ONE> --backup <FRESH_BACKUP_TWO>

Mutation-capable mode (future separately authorized primary-main session only):
  npm run literature:apply-protected-gold-import-contract-v2 -- \\
    --target local --operator <IDENTITY> \\
    --backup <FRESH_BACKUP_ONE> --backup <FRESH_BACKUP_TWO> \\
    --confirmation "${PROTECTED_V2_CONFIRMATION}" \\
    --separate-capture-attestation "${PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION}" \\
    --output <LOCAL_DATA_RECEIPT_DIRECTORY> --commit

Lost-ack receipt reconciliation (strictly non-replaying):
  npm run literature:apply-protected-gold-import-contract-v2 -- \\
    --target local --operator <IDENTITY> \\
    --output <EXISTING_INCOMPLETE_APPLICATION_INTENT_DIRECTORY> \\
    --reconciliation-reason <NONEMPTY_REASON> --reconcile-applied-receipt

Without --commit this command is repeatable-read/read-only and never stages V2. --commit requires
primary main at exact clean origin/main, the pinned local project/container/port, V1 exactly once,
V2 absent, accepted state hashes, two separately executed checksum-verified backups less than
two hours old, and the exact confirmation. It seals immutable intent before staging. Reconciliation
requires an exact applied ledger and sealed intent, never stages V2, and never invokes migration-up.
Neither mode can authorize import or compensation.
`.trim()

interface ProtectedV2OperatorArgumentsBase {
  operator: string
  target: 'local'
}

export type ProtectedV2OperatorArguments =
  | (ProtectedV2OperatorArgumentsBase & {
      backups: readonly [string, string]
      mode: 'dry_run_read_only'
    })
  | (ProtectedV2OperatorArgumentsBase & {
      backups: readonly [string, string]
      confirmation: typeof PROTECTED_V2_CONFIRMATION
      mode: 'commit'
      output: string
      separateCaptureAttestation: typeof PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION
    })
  | (ProtectedV2OperatorArgumentsBase & {
      mode: 'reconcile_applied_receipt'
      output: string
      reconciliationReason: string
    })

export type ProtectedV2RepositoryEvidence =
  import('./protected-gold-import-contract-v2-evidence').ProtectedV2RepositoryEvidence
export type ProtectedV2DatabaseEvidence =
  import('./protected-gold-import-contract-v2-evidence').ProtectedV2DatabaseEvidence

export interface ProtectedV2SealedIntentPackage {
  intent: ProtectedV2ApplicationIntent
  intentManifestSha256: string
  intentSha256: string
  outputDirectory: string
}

export interface ProtectedV2LoadedIntentPackage extends ProtectedV2SealedIntentPackage {
  completed?: {
    executionReceipt: ProtectedV2ApplicationExecutionReceipt
    result: ProtectedV2ApplicationResult
  }
}

export interface ProtectedV2OperatorDependencies {
  applyMigration: () => Promise<void>
  beforeMigrationApplication: () => Promise<void>
  finalizeReceipt: (input: {
    after: ProtectedV2DatabaseEvidence
    intentCommitIsAncestor: true
    intentPackage: ProtectedV2SealedIntentPackage
    migrationApplicationCallCount: 0 | 1
    postApplicationAudit: ProtectedV2PostApplicationAudit
    receiptReconciled: boolean
    reconciliationReason: string | null
    repository: ProtectedV2RepositoryEvidence
  }) => Promise<{ manifestSha256: string; outputDirectory: string; receiptSha256: string }>
  inspectDatabase: (
    expected: 'v2_absent' | 'v2_applied_exactly_once',
  ) => Promise<ProtectedV2DatabaseEvidence>
  inspectRepository: () => Promise<ProtectedV2RepositoryEvidence>
  isRepositoryCommitAncestor: (ancestor: string, descendant: string) => Promise<boolean>
  loadIntentPackage: (output: string) => Promise<ProtectedV2LoadedIntentPackage>
  now: () => Date
  sealIntent: (input: {
    authorization: ReturnType<typeof buildProtectedV2Authorization>
    before: ProtectedV2DatabaseEvidence
    output: string
    repository: ProtectedV2RepositoryEvidence
  }) => Promise<ProtectedV2SealedIntentPackage>
  stageProtectedMigration: (input: {
    authorization: ReturnType<typeof buildProtectedV2Authorization>
    authorizationContext: ProtectedV2AuthorizationContext
    ledgerEntries: readonly ProtectedMigrationLedgerEntry[]
  }) => Promise<void>
  verifyBackup: (input: {
    database: ProtectedV2DatabaseEvidence
    directory: string
    now: Date
    repository: ProtectedV2RepositoryEvidence
  }) => Promise<ProtectedV2BackupBinding>
  verifyPostApplication: (input: {
    after: ProtectedV2DatabaseEvidence
    repository: ProtectedV2RepositoryEvidence
  }) => Promise<ProtectedV2PostApplicationAudit>
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex')
}

function parseJson(bytes: string, label: string) {
  try {
    return JSON.parse(bytes) as unknown
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : error}`)
  }
}

function isWithin(parent: string, child: string) {
  const path = relative(parent, child)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`)
}

export function parseProtectedV2OperatorArguments(argv: string[]): ProtectedV2OperatorArguments {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, [
    'backup',
    'commit',
    'confirmation',
    'help',
    'operator',
    'output',
    'reconcile-applied-receipt',
    'reconciliation-reason',
    'separate-capture-attestation',
    'target',
  ])
  if (hasFlag(arguments_, 'help')) throw new Error(HELP)
  const backups = arguments_.values.get('backup') ?? []
  const target = stringArgument(arguments_, 'target')
  const operator = stringArgument(arguments_, 'operator')
  const confirmation = stringArgument(arguments_, 'confirmation')
  const output = stringArgument(arguments_, 'output')
  const commit = hasFlag(arguments_, 'commit')
  const reconcile = hasFlag(arguments_, 'reconcile-applied-receipt')
  const reconciliationReason = stringArgument(arguments_, 'reconciliation-reason')
  const separateCaptureAttestation = stringArgument(arguments_, 'separate-capture-attestation')
  if (target !== 'local') throw new Error('Protected V2 operator target must be exactly local.')
  if (!operator?.trim() || operator.trim() !== operator) {
    throw new Error('Protected V2 operator identity is required and must be trimmed.')
  }
  if (reconcile) {
    if (commit || confirmation || backups.length > 0 || separateCaptureAttestation) {
      throw new Error(
        'Receipt reconciliation forbids --commit, --confirmation, --backup, and --separate-capture-attestation; it trusts only the sealed intent.',
      )
    }
    if (!output) throw new Error('Receipt reconciliation requires the existing --output package.')
    if (!reconciliationReason?.trim() || reconciliationReason.trim() !== reconciliationReason) {
      throw new Error('Receipt reconciliation requires a trimmed nonempty --reconciliation-reason.')
    }
    return {
      mode: 'reconcile_applied_receipt',
      operator,
      output,
      reconciliationReason,
      target,
    }
  }
  if (reconciliationReason) {
    throw new Error('--reconciliation-reason requires --reconcile-applied-receipt.')
  }
  if (backups.length !== 2 || backups[0] === backups[1]) {
    throw new Error('Exactly two distinct --backup directories are required.')
  }
  if (commit && confirmation !== PROTECTED_V2_CONFIRMATION) {
    throw new Error(`--commit requires --confirmation "${PROTECTED_V2_CONFIRMATION}".`)
  }
  if (commit && separateCaptureAttestation !== PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION) {
    throw new Error(
      `--commit requires --separate-capture-attestation "${PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION}".`,
    )
  }
  if (!commit && separateCaptureAttestation) {
    throw new Error('--separate-capture-attestation is accepted only with --commit.')
  }
  if (commit && !output) throw new Error('--commit requires a fresh local-only --output directory.')
  if (!commit && output) throw new Error('Dry-run refuses --output because it performs no writes.')
  if (commit) {
    return {
      backups: [backups[0]!, backups[1]!],
      confirmation: PROTECTED_V2_CONFIRMATION,
      mode: 'commit',
      operator,
      output: output!,
      separateCaptureAttestation: PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
      target,
    }
  }
  return {
    backups: [backups[0]!, backups[1]!],
    mode: 'dry_run_read_only',
    operator,
    target,
  }
}

async function assertRegularNonSymlink(path: string, label: string) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file.`)
}

function migrationOccurrence(
  entries: readonly ProtectedMigrationLedgerEntry[],
  version: string,
  name: string,
) {
  return entries.filter((entry) => entry.version === version && entry.name === name).length
}

function assertDatabaseBoundary(
  evidence: ProtectedV2DatabaseEvidence,
  expected: 'v2_absent' | 'v2_applied_exactly_once',
) {
  const protectedState = classifyProtectedV2Ledger(evidence.ledgerEntries)
  const expectedV2Occurrence = expected === 'v2_absent' ? 0 : 1
  if (
    evidence.readOnlyBracketMatches !== true ||
    evidence.v1Occurrence !== 1 ||
    evidence.v2Occurrence !== expectedV2Occurrence ||
    protectedState.kind !== expected ||
    evidence.developmentMembershipSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256 ||
    evidence.developmentPlanningStateSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256 ||
    evidence.effectiveStateSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256 ||
    evidence.physicalStateSha256 !== GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256 ||
    evidence.actionCount !== 0 ||
    evidence.importCount !== 0 ||
    evidence.compensationCount !== 0 ||
    !/^[a-f0-9]{64}$/u.test(evidence.pointerStateSha256) ||
    !/^[a-f0-9]{64}$/u.test(evidence.revealStateSha256) ||
    !/^[a-f0-9]{64}$/u.test(evidence.reviewStateSha256)
  ) {
    throw new Error(`Protected V2 ${expected} database boundary did not match accepted state.`)
  }
}

function assertSchemaOnlyProtectedV2Transition(
  before: ProtectedV2DatabaseEvidence,
  after: ProtectedV2DatabaseEvidence,
) {
  if (
    before.batchId !== after.batchId ||
    before.v1Occurrence !== 1 ||
    before.v2Occurrence !== 0 ||
    after.v1Occurrence !== 1 ||
    after.v2Occurrence !== 1 ||
    before.developmentMembershipSha256 !== after.developmentMembershipSha256 ||
    before.developmentPlanningStateSha256 !== after.developmentPlanningStateSha256 ||
    before.effectiveStateSha256 !== after.effectiveStateSha256 ||
    before.physicalStateSha256 !== after.physicalStateSha256 ||
    before.pointerStateSha256 !== after.pointerStateSha256 ||
    before.revealStateSha256 !== after.revealStateSha256 ||
    before.reviewStateSha256 !== after.reviewStateSha256 ||
    before.actionCount !== after.actionCount ||
    before.importCount !== after.importCount ||
    before.compensationCount !== after.compensationCount
  ) {
    throw new Error('Protected V2 post-application state is not the exact schema-only transition.')
  }
}

function assertRedundantBackupCaptureBindings(
  bindings: readonly [ProtectedV2BackupBinding, ProtectedV2BackupBinding],
) {
  if (
    bindings[0].directory === bindings[1].directory ||
    bindings[0].backupInstanceId === bindings[1].backupInstanceId ||
    bindings[0].executionNonce === bindings[1].executionNonce ||
    bindings[0].executionReceiptSha256 === bindings[1].executionReceiptSha256
  ) {
    throw new Error(
      'Protected V2 operator requires two separately executed redundant backup captures.',
    )
  }
}

function authorizationContext(input: {
  backups: readonly [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  database: ProtectedV2DatabaseEvidence
  repository: ProtectedV2RepositoryEvidence
}): ProtectedV2AuthorizationContext {
  return {
    backupTrustModel: PROTECTED_V2_BACKUP_TRUST_MODEL,
    backups: input.backups,
    database: {
      container: DEFAULT_LOCAL_DATABASE_CONTAINER,
      developmentMembershipSha256: input.database.developmentMembershipSha256,
      developmentPlanningStateSha256: input.database.developmentPlanningStateSha256,
      effectiveStateSha256: input.database.effectiveStateSha256,
      physicalStateSha256: input.database.physicalStateSha256,
      port: LOCAL_DATABASE_PORT,
      projectId: LOCAL_SUPABASE_PROJECT_ID,
      target: 'local',
      v1Occurrence: 1,
      v2Occurrence: 0,
    },
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    expectedPostApplicationAudit: {
      auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
      auditModel: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL,
      auditModelIdentitySha256: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256,
      environmentInvariantIdentitySha256: PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256,
      verifier: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
      verifierExecuted: false,
    },
    repository: input.repository,
    separateCaptureAttestation: PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
    safety: { heldOutIdentitiesAccessed: false, remoteDatabaseAccessed: false },
  }
}

export async function verifyProtectedV2PreapplicationBackup(input: {
  database: ProtectedV2DatabaseEvidence
  directory: string
  now: Date
  repository: ProtectedV2RepositoryEvidence
}): Promise<ProtectedV2BackupBinding> {
  const directoryStat = await lstat(input.directory)
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error('Protected V2 backup must be a real directory.')
  }
  const directory = await realpath(input.directory)
  const actualNames = (await readdir(directory)).sort()
  const expectedNames = [...REQUIRED_BACKUP_DIRECTORY_FILES].sort()
  if (canonicalJson(actualNames) !== canonicalJson(expectedNames)) {
    throw new Error('Protected V2 backup file inventory is incomplete or unexpected.')
  }
  for (const name of expectedNames) {
    await assertRegularNonSymlink(resolve(directory, name), `Backup file ${name}`)
  }
  const manifestBytes = await readFile(resolve(directory, 'checksum-manifest.sha256'), 'utf8')
  const manifestEntries = manifestBytes
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(
        /^([a-f0-9]{64})  ([a-z0-9][a-z0-9.-]*\.json|pre-application-report\.md)$/u,
      )
      if (!match) throw new Error(`Malformed protected V2 backup manifest line: ${line}`)
      return { name: match[2]!, sha256: match[1]! }
    })
  if (
    canonicalJson(manifestEntries.map(({ name }) => name)) !==
    canonicalJson([...REQUIRED_BACKUP_CANONICAL_FILES].sort())
  ) {
    throw new Error('Protected V2 backup canonical manifest inventory drifted.')
  }
  const canonicalBytes = new Map<string, string>()
  for (const entry of manifestEntries) {
    const bytes = await readFile(resolve(directory, entry.name), 'utf8')
    if (sha256(bytes) !== entry.sha256) {
      throw new Error(`Protected V2 backup checksum mismatch for ${entry.name}.`)
    }
    canonicalBytes.set(entry.name, bytes)
  }
  const manifestSha256 = sha256(manifestBytes)
  const executionBytes = await readFile(resolve(directory, 'execution-receipt.json'), 'utf8')
  const execution = parseProtectedV2BackupExecutionReceipt(executionBytes)
  const executionReceiptSha256 = sha256(executionBytes)
  const backupRootStat = await lstat(execution.backupRoot)
  if (!backupRootStat.isDirectory() || backupRootStat.isSymbolicLink()) {
    throw new Error('Protected V2 backup receipt binds an unsafe backup root.')
  }
  const backupRoot = await realpath(execution.backupRoot)
  if (
    execution.backupRoot !== backupRoot ||
    execution.outputDirectory !== directory ||
    !isWithin(backupRoot, directory)
  ) {
    throw new Error('Protected V2 backup receipt outputDirectory does not match its realpath.')
  }
  const duplicateMarkerPath = resolve(
    backupRoot,
    PROTECTED_V2_BACKUP_DUPLICATE_MARKER_DIRECTORY,
    `${execution.backupInstanceId}.json`,
  )
  await assertRegularNonSymlink(duplicateMarkerPath, 'Backup local duplicate marker')
  const duplicateMarkerBytes = await readFile(duplicateMarkerPath, 'utf8')
  const duplicateMarker = parseProtectedV2BackupDuplicateMarker(duplicateMarkerBytes)
  if (
    duplicateMarker.backupInstanceId !== execution.backupInstanceId ||
    duplicateMarker.backupRoot !== backupRoot ||
    duplicateMarker.outputDirectory !== directory ||
    duplicateMarker.executionReceiptSha256 !== executionReceiptSha256 ||
    duplicateMarker.repositoryCommitSha !== execution.repositoryCommitSha ||
    duplicateMarker.executedAt !== execution.executedAt
  ) {
    throw new Error('Protected V2 backup local duplicate marker does not match this capture.')
  }
  const report = record(
    parseJson(canonicalBytes.get('pre-application-report.json')!, 'pre-application report'),
    'pre-application report',
  )
  const migration = record(report.migration, 'report.migration')
  const v1 = record(migration.v1, 'report.migration.v1')
  const v2 = record(migration.v2, 'report.migration.v2')
  const database = record(report.database, 'report.database')
  const current = record(database.current, 'report.database.current')
  const safety = record(report.safety, 'report.safety')
  const ordinaryPlan = record(report.ordinaryLocalStartPlan, 'report.ordinaryLocalStartPlan')
  const reportRepository = record(report.repository, 'report.repository')
  const executedAt = execution.executedAt
  const executedAtMilliseconds = Date.parse(executedAt)
  const age = input.now.getTime() - executedAtMilliseconds
  if (
    execution.canonicalManifestSha256 !== manifestSha256 ||
    execution.repositoryCommitSha !== input.repository.head ||
    execution.safety.databaseMutationCount !== 0 ||
    execution.safety.heldOutIdentitiesAccessed !== false ||
    execution.safety.remoteDatabaseAccessed !== false ||
    Number.isNaN(executedAtMilliseconds) ||
    age < -5 * 60 * 1000 ||
    age > PROTECTED_V2_BACKUP_MAX_AGE_MILLISECONDS
  ) {
    throw new Error('Protected V2 backup execution receipt is stale or unsafe.')
  }
  if (
    report.schemaVersion !== GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION ||
    reportRepository.head !== input.repository.head ||
    v1.occurrence !== 1 ||
    v1.sha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256 ||
    v2.occurrence !== 0 ||
    v2.sha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256 ||
    current.developmentMembershipSha256 !== input.database.developmentMembershipSha256 ||
    current.developmentPlanningStateSha256 !== input.database.developmentPlanningStateSha256 ||
    current.effectiveStateSha256 !== input.database.effectiveStateSha256 ||
    current.physicalStateSha256 !== input.database.physicalStateSha256 ||
    safety.heldOutIdentitiesAccessed !== false ||
    safety.remoteDatabaseAccessed !== false ||
    safety.realLocalDatabaseMutationCount !== 0 ||
    ordinaryPlan.protectedMigrationState !== 'v2_absent_unarmed' ||
    ordinaryPlan.firstStartProtectedV2Visible !== false ||
    ordinaryPlan.migrationUpProtectedV2Visible !== false ||
    ordinaryPlan.protectedMigrationApplicationPlanned !== false ||
    ordinaryPlan.protectedV2AuthorizationPresent !== false
  ) {
    throw new Error(
      'Protected V2 backup is not bound to the current accepted pre-application state.',
    )
  }
  const seed = record(
    parseJson(canonicalBytes.get('development-database-seed.json')!, 'development seed'),
    'development seed',
  )
  if (seed.datasetSplit !== 'development' || seed.heldOutIdentitiesIncluded !== false) {
    throw new Error('Protected V2 backup seed is not development-only.')
  }
  const stateHashes = record(
    parseJson(canonicalBytes.get('state-hashes.json')!, 'state hashes'),
    'state hashes',
  )
  if (
    stateHashes.developmentMembershipSha256 !== input.database.developmentMembershipSha256 ||
    stateHashes.developmentPlanningStateSha256 !== input.database.developmentPlanningStateSha256 ||
    stateHashes.effectiveStateSha256 !== input.database.effectiveStateSha256 ||
    stateHashes.physicalStateSha256 !== input.database.physicalStateSha256
  ) {
    throw new Error('Protected V2 backup state-hash artifact drifted.')
  }
  const ledger = record(
    parseJson(canonicalBytes.get('protected-migration-ledger.json')!, 'migration ledger'),
    'migration ledger',
  )
  const protectedV2 = record(ledger.protectedV2, 'migration ledger protectedV2')
  const ledgerBytes = canonicalBytes.get('protected-migration-ledger.json')!
  if (
    protectedV2.classification !== 'v2_absent' ||
    protectedV2.occurrence !== 0 ||
    execution.migrationLedger.sha256 !== sha256(ledgerBytes) ||
    execution.migrationLedger.v1.occurrence !== 1 ||
    execution.migrationLedger.v2.occurrence !== 0 ||
    execution.database.batchId !== input.database.batchId ||
    execution.database.datasetSplit !== 'development' ||
    execution.database.developmentMembershipSha256 !== input.database.developmentMembershipSha256 ||
    execution.database.developmentPlanningStateSha256 !==
      input.database.developmentPlanningStateSha256 ||
    execution.database.effectiveStateSha256 !== input.database.effectiveStateSha256 ||
    execution.database.physicalStateSha256 !== input.database.physicalStateSha256
  ) {
    throw new Error('Protected V2 backup ledger is not at the absent boundary.')
  }
  return {
    backupInstanceId: execution.backupInstanceId,
    backupRoot,
    canonicalManifestSha256: manifestSha256,
    directory,
    executedAt,
    executionNonce: execution.executionNonce,
    executionReceiptSha256,
  }
}

export async function runProtectedV2Operator(
  arguments_: ProtectedV2OperatorArguments,
  dependencies: ProtectedV2OperatorDependencies,
) {
  if (arguments_.mode === 'reconcile_applied_receipt') {
    const repository = await dependencies.inspectRepository()
    const intentPackage = await dependencies.loadIntentPackage(arguments_.output)
    const { intent } = intentPackage
    const intentCommitIsAncestor = await dependencies.isRepositoryCommitAncestor(
      intent.repository.head,
      repository.head,
    )
    assertProtectedV2OperatorBundleUnchanged({
      current: repository.operatorBundle,
      intent: intent.repository.operatorBundle,
    })
    if (
      intent.outputDirectory !== intentPackage.outputDirectory ||
      intent.operator !== arguments_.operator ||
      intent.createdAt !== intent.authorization.requestedAt ||
      !intentCommitIsAncestor ||
      intent.authorizationSha256 !== intent.authorization.contentSha256 ||
      canonicalJson(intent.backupInstances) !== canonicalJson(intent.authorization.context.backups)
    ) {
      throw new Error('Protected V2 reconciliation intent or repository recovery rule failed.')
    }
    assertDatabaseBoundary(intent.before, 'v2_absent')
    // Backup freshness is authenticated at the immutable authorization/intent time. Recovery can
    // occur later because a new pre-application backup cannot be created after V2 has committed.
    const backupVerificationNow = new Date(intent.createdAt)
    const bindings = (await Promise.all(
      intent.backupInstances.map((backup) =>
        dependencies.verifyBackup({
          database: intent.before,
          directory: backup.directory,
          now: backupVerificationNow,
          repository: intent.repository,
        }),
      ),
    )) as [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
    assertRedundantBackupCaptureBindings(bindings)
    if (canonicalJson(bindings) !== canonicalJson(intent.backupInstances)) {
      throw new Error('Protected V2 reconciliation backup bindings drifted from sealed intent.')
    }
    const context = authorizationContext({
      backups: bindings,
      database: intent.before,
      repository: intent.repository,
    })
    validateProtectedV2Authorization(intent.authorization, context)

    // This is intentionally the first and only ledger branch in reconciliation. Absence or
    // ambiguity throws here; reconciliation never stages a file or invokes migration-up.
    const after = await dependencies.inspectDatabase('v2_applied_exactly_once')
    assertDatabaseBoundary(after, 'v2_applied_exactly_once')
    assertSchemaOnlyProtectedV2Transition(intent.before, after)
    const postApplicationAudit = await dependencies.verifyPostApplication({ after, repository })
    if (intentPackage.completed) {
      if (
        canonicalJson(intentPackage.completed.result.after) !== canonicalJson(after) ||
        intentPackage.completed.result.intentRepositoryHead !== intent.repository.head ||
        intentPackage.completed.result.operatorBundleSha256 !==
          repository.operatorBundle.aggregateSha256 ||
        intentPackage.completed.result.postApplicationAudit.catalogAudit.fullAuditIdentitySha256 !==
          postApplicationAudit.catalogAudit.fullAuditIdentitySha256 ||
        canonicalJson(
          intentPackage.completed.result.postApplicationAudit.catalogAudit.componentIdentities,
        ) !== canonicalJson(postApplicationAudit.catalogAudit.componentIdentities)
      ) {
        throw new Error('Completed protected V2 receipt no longer matches current applied state.')
      }
      return {
        authorizationSha256: intent.authorizationSha256,
        databaseMutationCount: 0,
        migrationApplicationCallCount: 0,
        migrationReexecuted: false,
        mode: 'already_complete_verified' as const,
        protectedState: 'v2_applied_exactly_once' as const,
        receipt: intentPackage.completed.executionReceipt,
        repository,
      }
    }
    const receipt = await dependencies.finalizeReceipt({
      after,
      intentCommitIsAncestor: true,
      intentPackage,
      migrationApplicationCallCount: 0,
      postApplicationAudit,
      receiptReconciled: true,
      reconciliationReason: arguments_.reconciliationReason,
      repository,
    })
    return {
      authorizationSha256: intent.authorizationSha256,
      databaseMutationCount: 0,
      migrationApplicationCallCount: 0,
      migrationReexecuted: false,
      mode: 'reconciled_applied_receipt' as const,
      protectedState: 'v2_applied_exactly_once' as const,
      receipt,
      repository,
    }
  }

  const repository = await dependencies.inspectRepository()
  const before = await dependencies.inspectDatabase('v2_absent')
  assertDatabaseBoundary(before, 'v2_absent')
  const now = dependencies.now()
  const bindings = (await Promise.all(
    arguments_.backups.map((directory) =>
      dependencies.verifyBackup({ database: before, directory, now, repository }),
    ),
  )) as [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  assertRedundantBackupCaptureBindings(bindings)
  const context = authorizationContext({ backups: bindings, database: before, repository })

  if (arguments_.mode === 'dry_run_read_only') {
    return {
      databaseMutationCount: 0,
      mode: 'dry_run_read_only' as const,
      protectedState: classifyProtectedV2State({ ledgerEntries: before.ledgerEntries }).kind,
      readiness: 'explicit_commit_and_confirmation_required' as const,
      repository,
      verifiedBackups: bindings,
    }
  }
  const authorization = buildProtectedV2Authorization({
    confirmation: arguments_.confirmation!,
    context,
    operator: arguments_.operator,
    requestedAt: now.toISOString(),
  })

  // Re-read every authorization input immediately before the first mutation. Any repository,
  // database, or backup drift invalidates the in-memory, checksum-bound authorization.
  const currentRepository = await dependencies.inspectRepository()
  const currentDatabase = await dependencies.inspectDatabase('v2_absent')
  assertDatabaseBoundary(currentDatabase, 'v2_absent')
  const currentNow = dependencies.now()
  const currentBindings = (await Promise.all(
    arguments_.backups.map((directory) =>
      dependencies.verifyBackup({
        database: currentDatabase,
        directory,
        now: currentNow,
        repository: currentRepository,
      }),
    ),
  )) as [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  assertRedundantBackupCaptureBindings(currentBindings)
  const currentContext = authorizationContext({
    backups: currentBindings,
    database: currentDatabase,
    repository: currentRepository,
  })
  validateProtectedV2Authorization(authorization, currentContext)
  const armedState = classifyProtectedV2State({
    authorization,
    authorizationContext: currentContext,
    ledgerEntries: currentDatabase.ledgerEntries,
  })
  if (armedState.kind !== 'v2_absent_explicitly_armed') {
    throw new Error('Protected V2 operator failed to enter the explicitly armed state.')
  }

  const intentPackage = await dependencies.sealIntent({
    authorization,
    before: currentDatabase,
    output: arguments_.output,
    repository: currentRepository,
  })
  await dependencies.stageProtectedMigration({
    authorization,
    authorizationContext: currentContext,
    ledgerEntries: currentDatabase.ledgerEntries,
  })
  await dependencies.beforeMigrationApplication()
  await dependencies.applyMigration()
  const after = await dependencies.inspectDatabase('v2_applied_exactly_once')
  assertDatabaseBoundary(after, 'v2_applied_exactly_once')
  assertSchemaOnlyProtectedV2Transition(currentDatabase, after)
  const postApplicationAudit = await dependencies.verifyPostApplication({
    after,
    repository: currentRepository,
  })
  const receipt = await dependencies.finalizeReceipt({
    after,
    intentCommitIsAncestor: true,
    intentPackage,
    migrationApplicationCallCount: 1,
    postApplicationAudit,
    receiptReconciled: false,
    reconciliationReason: null,
    repository: currentRepository,
  })
  return {
    authorizationSha256: authorization.contentSha256,
    databaseMutationCount: 1,
    mode: 'committed_protected_v2_migration' as const,
    migrationApplicationCallCount: 1,
    migrationReexecuted: false,
    protectedState: 'v2_applied_exactly_once' as const,
    receipt,
    repository: currentRepository,
  }
}

async function gitStatusIncludingUntracked(cwd: string, runCommand: CommandRunner) {
  return (
    await runCommand('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd })
  ).stdout.trim()
}

export async function inspectProtectedV2OperatorRepository(input: {
  cwd: string
  runCommand?: CommandRunner
}): Promise<ProtectedV2RepositoryEvidence> {
  const runCommand = input.runCommand ?? defaultCommandRunner
  const guard = await inspectRepositoryGuardState(input.cwd, runCommand)
  assertRepositoryGuard(guard)
  if ((await gitStatusIncludingUntracked(input.cwd, runCommand)) !== '') {
    throw new Error('Protected V2 operator requires clean tracked and untracked primary main.')
  }
  return {
    branch: 'main',
    head: guard.head,
    operatorBundle: await buildProtectedV2OperatorBundle({ cwd: input.cwd }),
    originMain: guard.originMain,
    statusCleanIncludingUntracked: true,
  }
}

function normalizedLedger(snapshot: RawDatabaseSnapshot): ProtectedMigrationLedgerEntry[] {
  return snapshot.migrationLedger.map((value, index) => {
    const row = record(value, `migrationLedger[${index}]`)
    if (typeof row.version !== 'string' || typeof row.name !== 'string') {
      throw new Error(`migrationLedger[${index}] identity is malformed.`)
    }
    return { name: row.name, version: row.version }
  })
}

function ordinaryMigrationIdentity(filename: string) {
  const match = filename.match(/^(\d+)_([^/]+)\.sql$/u)
  if (!match) throw new Error(`Ordinary migration filename is malformed: ${filename}`)
  return { name: match[2]!, version: match[1]! }
}

function developmentSnapshotRows(snapshot: RawDatabaseSnapshot) {
  return snapshot.developmentItems.map((value, index) => {
    const row = record(value, `developmentItems[${index}]`)
    const item = record(row.item, `developmentItems[${index}].item`)
    if (!Array.isArray(row.reviews)) {
      throw new Error(`developmentItems[${index}].reviews must be an array.`)
    }
    return {
      item,
      reviews: row.reviews.map((review, reviewIndex) =>
        record(review, `developmentItems[${index}].reviews[${reviewIndex}]`),
      ),
    }
  })
}

function protectedDatabaseRowIdentities(snapshot: RawDatabaseSnapshot) {
  const rows = developmentSnapshotRows(snapshot)
  const reviewState = rows.flatMap(({ reviews }) =>
    reviews.map((review) => {
      const projection = { ...review }
      delete projection.full_text_used
      delete projection.operation_contract_version
      delete projection.operation_contract_version_code
      return projection
    }),
  )
  return {
    pointerStateSha256: sha256(
      canonicalJson(
        rows.map(({ item }) => ({ id: item.id, currentReviewId: item.current_review_id ?? null })),
      ),
    ),
    revealStateSha256: sha256(
      canonicalJson(
        rows.map(({ item }) => ({
          automatedSignalsRevealedAt: item.automated_signals_revealed_at ?? null,
          id: item.id,
          supplementalMetadataRevealedAt: item.supplemental_metadata_revealed_at ?? null,
        })),
      ),
    ),
    reviewStateSha256: sha256(canonicalJson(reviewState)),
  }
}

interface ProtectedV2OperationCounts {
  actionCount: number
  compensationCount: number
  importCount: number
  readOnlyTransaction: true
}

const PROTECTED_V2_OPERATION_COUNTS_MARKER = 'PROTECTED_V2_OPERATION_COUNTS:'

async function collectProtectedV2OperationCounts(input: {
  batchId: string
  dockerTarget: LocalDockerTarget
  runCommand: CommandRunner
}): Promise<ProtectedV2OperationCounts> {
  if (!/^[a-f0-9-]{36}$/u.test(input.batchId)) {
    throw new Error('Protected V2 operation-count batch identity is malformed.')
  }
  const sql = `begin transaction isolation level repeatable read read only;
set local statement_timeout = '120s';
select '${PROTECTED_V2_OPERATION_COUNTS_MARKER}' || pg_catalog.jsonb_build_object(
  'readOnlyTransaction', current_setting('transaction_read_only')::boolean,
  'importCount', count(*) filter (where operation.operation_kind = 'import')::integer,
  'compensationCount', count(*) filter (where operation.operation_kind = 'compensation')::integer,
  'actionCount', (select count(*)::integer
    from public.literature_gold_review_operation_actions action
    join public.literature_gold_review_operations action_operation
      on action_operation.id = action.operation_id
    where action_operation.batch_id = '${input.batchId}'::uuid)
)::text
from public.literature_gold_review_operations operation
where operation.batch_id = '${input.batchId}'::uuid;
rollback;`
  const result = await input.runCommand(
    'docker',
    [
      ...input.dockerTarget.dockerArguments,
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
    { env: input.dockerTarget.environment, stdin: sql },
  )
  const lines = result.stdout
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(PROTECTED_V2_OPERATION_COUNTS_MARKER))
  if (lines.length !== 1) {
    throw new Error('Protected V2 operation-count marker was absent or duplicated.')
  }
  const parsed = record(
    parseJson(lines[0]!.slice(PROTECTED_V2_OPERATION_COUNTS_MARKER.length), 'operation counts'),
    'operation counts',
  )
  if (
    parsed.readOnlyTransaction !== true ||
    !Number.isSafeInteger(parsed.actionCount) ||
    !Number.isSafeInteger(parsed.importCount) ||
    !Number.isSafeInteger(parsed.compensationCount)
  ) {
    throw new Error('Protected V2 operation counts are malformed.')
  }
  return parsed as unknown as ProtectedV2OperationCounts
}

export async function collectProtectedV2OperatorDatabase(input: {
  dockerTarget: LocalDockerTarget
  expected: 'v2_absent' | 'v2_applied_exactly_once'
  runCommand?: CommandRunner
}): Promise<ProtectedV2DatabaseEvidence> {
  const runCommand = input.runCommand ?? defaultCommandRunner
  await assertLocalDatabaseHealthy(DEFAULT_LOCAL_DATABASE_CONTAINER, runCommand, input.dockerTarget)
  const hashesBefore = await collectReadOnlyContractStateHashes({
    dockerTarget: input.dockerTarget,
    runCommand,
  })
  const snapshotBefore = await collectReadOnlyDatabaseSnapshot({
    dockerTarget: input.dockerTarget,
    runCommand,
  })
  const beforeScope = record(snapshotBefore.scope, 'snapshotBefore.scope')
  const beforeBatch = record(beforeScope.batch, 'snapshotBefore.scope.batch')
  const batchId = String(beforeBatch.id ?? '')
  const operationCountsBefore = await collectProtectedV2OperationCounts({
    batchId,
    dockerTarget: input.dockerTarget,
    runCommand,
  })
  const snapshotAfter = await collectReadOnlyDatabaseSnapshot({
    dockerTarget: input.dockerTarget,
    runCommand,
  })
  const hashesAfter = await collectReadOnlyContractStateHashes({
    dockerTarget: input.dockerTarget,
    runCommand,
  })
  const operationCountsAfter = await collectProtectedV2OperationCounts({
    batchId,
    dockerTarget: input.dockerTarget,
    runCommand,
  })
  const planningBefore = developmentPlanningStateSha256(snapshotBefore)
  const planningAfter = developmentPlanningStateSha256(snapshotAfter)
  const ledgerEntries = normalizedLedger(snapshotAfter)
  for (const filename of ORDINARY_LITERATURE_MIGRATIONS) {
    const identity = ordinaryMigrationIdentity(filename)
    if (migrationOccurrence(ledgerEntries, identity.version, identity.name) !== 1) {
      throw new Error(`Ordinary migration ledger identity is not exact: ${filename}.`)
    }
  }
  const v1Occurrence = migrationOccurrence(
    ledgerEntries,
    PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
    PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
  )
  const v1RelevantEntries = ledgerEntries.filter(
    ({ name, version }) =>
      name === PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName ||
      version === PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
  )
  if (v1RelevantEntries.length !== 1 || v1Occurrence !== 1) {
    throw new Error('Historical V1 ledger identity is duplicated, drifted, or ambiguous.')
  }
  const protectedState = classifyProtectedV2Ledger(ledgerEntries)
  const v2Occurrence = protectedState.relevantEntries.length
  const rowIdentitiesBefore = protectedDatabaseRowIdentities(snapshotBefore)
  const rowIdentitiesAfter = protectedDatabaseRowIdentities(snapshotAfter)
  const bracketMatches =
    canonicalJson(snapshotBefore.developmentItems) ===
      canonicalJson(snapshotAfter.developmentItems) &&
    canonicalJson(hashesBefore) === canonicalJson(hashesAfter) &&
    planningBefore === planningAfter &&
    canonicalJson(operationCountsBefore) === canonicalJson(operationCountsAfter) &&
    canonicalJson(rowIdentitiesBefore) === canonicalJson(rowIdentitiesAfter)
  const scope = record(snapshotAfter.scope, 'snapshot.scope')
  const batch = record(scope.batch, 'snapshot.scope.batch')
  const evidence: ProtectedV2DatabaseEvidence = {
    actionCount: operationCountsAfter.actionCount,
    batchId: String(batch.id ?? ''),
    compensationCount: operationCountsAfter.compensationCount,
    developmentMembershipSha256: hashesAfter.developmentMembershipSha256,
    developmentPlanningStateSha256: planningAfter,
    effectiveStateSha256: hashesAfter.effectiveStateSha256,
    importCount: operationCountsAfter.importCount,
    ledgerEntries,
    physicalStateSha256: hashesAfter.physicalStateSha256,
    pointerStateSha256: rowIdentitiesAfter.pointerStateSha256,
    readOnlyBracketMatches: bracketMatches as true,
    revealStateSha256: rowIdentitiesAfter.revealStateSha256,
    reviewStateSha256: rowIdentitiesAfter.reviewStateSha256,
    v1Occurrence,
    v2Occurrence,
  }
  assertDatabaseBoundary(evidence, input.expected)
  return evidence
}

async function assertMigrationFileIdentities(cwd: string) {
  for (const migration of [PROTECTED_GOLD_IMPORT_CONTRACT_V1, PROTECTED_GOLD_IMPORT_CONTRACT_V2]) {
    const bytes = await readFile(resolve(cwd, 'supabase/migrations', migration.filename))
    if (sha256(bytes) !== migration.sha256) {
      throw new Error(`Protected operator migration checksum drifted: ${migration.filename}.`)
    }
  }
  const verifierBytes = await readFile(
    resolve(cwd, 'supabase/verification', PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.filename),
  )
  if (sha256(verifierBytes) !== PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256) {
    throw new Error('Protected operator V2 verifier checksum drifted.')
  }
}

function protectedV2ApplicationOutputRoot(cwd: string) {
  return resolve(cwd, 'local-data/literature/protected-v2-application-receipts')
}

function checksumManifest(files: ReadonlyMap<string, string>) {
  return [...files]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`)
    .join('')
}

async function writeImmutableFile(path: string, bytes: string) {
  await writeFile(path, bytes, { encoding: 'utf8', flag: 'wx', mode: 0o400 })
}

async function assertSafeApplicationOutputRoot(cwd: string, create: boolean) {
  const outputRoot = protectedV2ApplicationOutputRoot(cwd)
  if (create) await mkdir(outputRoot, { mode: 0o700, recursive: true })
  const stat = await lstat(outputRoot)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Protected V2 application output root is unsafe.')
  }
  return realpath(outputRoot)
}

export async function sealProtectedV2ApplicationIntent(input: {
  authorization: ReturnType<typeof buildProtectedV2Authorization>
  before: ProtectedV2DatabaseEvidence
  cwd: string
  output: string
  repository: ProtectedV2RepositoryEvidence
}): Promise<ProtectedV2SealedIntentPackage> {
  const outputRoot = await assertSafeApplicationOutputRoot(input.cwd, true)
  const requestedOutput = resolve(input.cwd, input.output)
  if (!isWithin(outputRoot, requestedOutput)) {
    throw new Error('Protected V2 application intent must stay under the ignored local-only root.')
  }
  const outputDirectory = await assertExclusiveOutputPath({
    backupRoot: outputRoot,
    cwd: input.cwd,
    output: requestedOutput,
  })
  const intent = buildProtectedV2ApplicationIntent({
    authorization: input.authorization,
    before: input.before,
    outputDirectory,
    repository: input.repository,
  })
  const intentBytes = canonicalJson(intent)
  const markdown = `# Protected Literature gold import contract V2 sealed application intent

- State: \`application_intent_sealed\`
- Migration: \`${PROTECTED_GOLD_IMPORT_CONTRACT_V2.id}\`
- Migration SHA-256: \`${PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256}\`
- Authorization SHA-256: \`${intent.authorizationSha256}\`
- Backup trust model: \`${intent.backupTrustModel}\`
- Separate-capture attestation: \`${intent.separateCaptureAttestation}\`
- Backup instance one: \`${intent.backupInstances[0].backupInstanceId}\`
- Backup instance two: \`${intent.backupInstances[1].backupInstanceId}\`
- Intent repository commit: \`${intent.repository.head}\`
- Protected operator bundle SHA-256: \`${intent.operatorBundle.aggregateSha256}\`
- Expected post-application audit method: \`${intent.authorization.context.expectedPostApplicationAudit.auditMethod}\`
- Expected audit-model SHA-256: \`${intent.authorization.context.expectedPostApplicationAudit.auditModelIdentitySha256}\`
- Expected environment-invariant SHA-256: \`${intent.authorization.context.expectedPostApplicationAudit.environmentInvariantIdentitySha256}\`
- Verifier source SHA-256: \`${intent.authorization.context.expectedPostApplicationAudit.verifier.sha256}\`
- Verifier will be executed real-locally: \`false\`
- Migration applied: \`false\`
- Final receipt complete: \`false\`
- Import authorized: \`false\`
- Compensation authorized: \`false\`
`
  const manifest = checksumManifest(
    new Map([
      ['application-intent.json', intentBytes],
      ['application-intent.md', markdown],
    ]),
  )
  await mkdir(outputDirectory, { mode: 0o700 })
  if ((await realpath(outputDirectory)) !== outputDirectory) {
    throw new Error('Protected V2 application intent output realpath changed during creation.')
  }
  await writeImmutableFile(resolve(outputDirectory, 'application-intent.json'), intentBytes)
  await writeImmutableFile(resolve(outputDirectory, 'application-intent.md'), markdown)
  await writeImmutableFile(resolve(outputDirectory, 'intent-checksum-manifest.sha256'), manifest)
  return {
    intent,
    intentManifestSha256: sha256(manifest),
    intentSha256: sha256(intentBytes),
    outputDirectory,
  }
}

function parseExactManifest(input: {
  bytes: string
  expectedNames: readonly string[]
  label: string
}) {
  const entries = input.bytes
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})  ([a-z0-9][a-z0-9.-]*)$/u)
      if (!match) throw new Error(`${input.label} has a malformed line: ${line}`)
      return { name: match[2]!, sha256: match[1]! }
    })
  if (
    canonicalJson(entries.map(({ name }) => name)) !==
    canonicalJson([...input.expectedNames].sort())
  ) {
    throw new Error(`${input.label} inventory drifted.`)
  }
  return entries
}

export async function loadProtectedV2ApplicationIntentPackage(input: {
  cwd: string
  output: string
}): Promise<ProtectedV2LoadedIntentPackage> {
  const outputRoot = await assertSafeApplicationOutputRoot(input.cwd, false)
  const requested = resolve(input.cwd, input.output)
  const outputStat = await lstat(requested)
  if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) {
    throw new Error('Protected V2 reconciliation output must be a real directory.')
  }
  const outputDirectory = await realpath(requested)
  if (requested !== outputDirectory || !isWithin(outputRoot, outputDirectory)) {
    throw new Error('Protected V2 reconciliation output escaped the local-only root.')
  }
  const names = (await readdir(outputDirectory)).sort()
  const incompleteNames = [...APPLICATION_INTENT_FILES].sort()
  const completeNames = [...APPLICATION_INTENT_FILES, FINALIZED_APPLICATION_DIRECTORY].sort()
  const completed = canonicalJson(names) === canonicalJson(completeNames)
  if (!completed && canonicalJson(names) !== canonicalJson(incompleteNames)) {
    throw new Error('Protected V2 application package has contradictory or unexpected artifacts.')
  }
  for (const name of APPLICATION_INTENT_FILES) {
    await assertRegularNonSymlink(resolve(outputDirectory, name), `Application intent file ${name}`)
  }
  const intentBytes = await readFile(resolve(outputDirectory, 'application-intent.json'), 'utf8')
  const intentMarkdown = await readFile(resolve(outputDirectory, 'application-intent.md'), 'utf8')
  const intentManifest = await readFile(
    resolve(outputDirectory, 'intent-checksum-manifest.sha256'),
    'utf8',
  )
  const intentEntries = parseExactManifest({
    bytes: intentManifest,
    expectedNames: ['application-intent.json', 'application-intent.md'],
    label: 'Protected V2 intent checksum manifest',
  })
  for (const entry of intentEntries) {
    const bytes = entry.name === 'application-intent.json' ? intentBytes : intentMarkdown
    if (sha256(bytes) !== entry.sha256) {
      throw new Error(`Protected V2 intent checksum mismatch for ${entry.name}.`)
    }
  }
  const intent = parseProtectedV2ApplicationIntent(intentBytes)
  if (intent.outputDirectory !== outputDirectory) {
    throw new Error('Protected V2 application intent output binding drifted.')
  }
  const loaded: ProtectedV2LoadedIntentPackage = {
    intent,
    intentManifestSha256: sha256(intentManifest),
    intentSha256: sha256(intentBytes),
    outputDirectory,
  }
  if (!completed) return loaded

  const finalizedDirectory = resolve(outputDirectory, FINALIZED_APPLICATION_DIRECTORY)
  const finalizedStat = await lstat(finalizedDirectory)
  if (!finalizedStat.isDirectory() || finalizedStat.isSymbolicLink()) {
    throw new Error('Protected V2 finalized receipt directory is unsafe.')
  }
  const finalizedNames = (await readdir(finalizedDirectory)).sort()
  if (canonicalJson(finalizedNames) !== canonicalJson([...FINALIZED_APPLICATION_FILES].sort())) {
    throw new Error('Protected V2 finalized receipt inventory drifted.')
  }
  for (const name of FINALIZED_APPLICATION_FILES) {
    await assertRegularNonSymlink(resolve(finalizedDirectory, name), `Final receipt file ${name}`)
  }
  const resultBytes = await readFile(resolve(finalizedDirectory, 'application-result.json'), 'utf8')
  const resultMarkdown = await readFile(
    resolve(finalizedDirectory, 'application-result.md'),
    'utf8',
  )
  const finalManifest = await readFile(
    resolve(finalizedDirectory, 'checksum-manifest.sha256'),
    'utf8',
  )
  const finalEntries = parseExactManifest({
    bytes: finalManifest,
    expectedNames: ['application-result.json', 'application-result.md'],
    label: 'Protected V2 final checksum manifest',
  })
  for (const entry of finalEntries) {
    const bytes = entry.name === 'application-result.json' ? resultBytes : resultMarkdown
    if (sha256(bytes) !== entry.sha256) {
      throw new Error(`Protected V2 final checksum mismatch for ${entry.name}.`)
    }
  }
  const result = parseProtectedV2ApplicationResult(resultBytes)
  const executionBytes = await readFile(
    resolve(finalizedDirectory, 'execution-receipt.json'),
    'utf8',
  )
  const executionReceipt = parseProtectedV2ApplicationExecutionReceipt(executionBytes)
  if (
    result.originalIntentSha256 !== loaded.intentSha256 ||
    result.operatorAuthorizationSha256 !== intent.authorizationSha256 ||
    canonicalJson(result.before) !== canonicalJson(intent.before) ||
    canonicalJson(result.backupInstances) !== canonicalJson(intent.backupInstances) ||
    result.intentRepositoryHead !== intent.repository.head ||
    result.operatorBundleSha256 !== intent.operatorBundle.aggregateSha256 ||
    result.recoveryRepositoryHead !== result.repository.head ||
    executionReceipt.canonicalManifestSha256 !== sha256(finalManifest) ||
    executionReceipt.resultSha256 !== sha256(resultBytes) ||
    executionReceipt.originalIntentSha256 !== loaded.intentSha256 ||
    executionReceipt.operatorAuthorizationSha256 !== intent.authorizationSha256 ||
    executionReceipt.postApplicationAuditSha256 !==
      result.postApplicationAudit.auditIdentitySha256 ||
    executionReceipt.outputDirectory !== outputDirectory ||
    executionReceipt.intentRepositoryHead !== intent.repository.head ||
    executionReceipt.intentCommitIsAncestor !== true ||
    executionReceipt.operatorBundleSha256 !== intent.operatorBundle.aggregateSha256 ||
    executionReceipt.operatorBundleUnchanged !== true ||
    executionReceipt.recoveryRepositoryHead !== result.repository.head ||
    executionReceipt.repositoryCommitSha !== result.repository.head ||
    canonicalJson(executionReceipt.backupCaptureIds) !==
      canonicalJson(intent.backupInstances.map(({ backupInstanceId }) => backupInstanceId)) ||
    executionReceipt.postApplicationCatalogAuditIdentitySha256 !==
      result.postApplicationAudit.catalogAudit.fullAuditIdentitySha256 ||
    canonicalJson(executionReceipt.postApplicationComponentIdentities) !==
      canonicalJson(result.postApplicationAudit.catalogAudit.componentIdentities) ||
    executionReceipt.receiptReconciled !== result.receiptReconciled ||
    executionReceipt.migrationApplicationCallCount !== result.migrationApplicationCallCount ||
    executionReceipt.reconciliationReason !== result.reconciliationReason
  ) {
    throw new Error('Protected V2 completed receipt does not cross-bind its sealed intent.')
  }
  return { ...loaded, completed: { executionReceipt, result } }
}

export async function finalizeProtectedV2ApplicationReceipt(input: {
  after: ProtectedV2DatabaseEvidence
  cwd: string
  intentCommitIsAncestor: true
  intentPackage: ProtectedV2SealedIntentPackage
  migrationApplicationCallCount: 0 | 1
  now: Date
  postApplicationAudit: ProtectedV2PostApplicationAudit
  receiptReconciled: boolean
  reconciliationReason: string | null
  repository: ProtectedV2RepositoryEvidence
}) {
  const outputRoot = await assertSafeApplicationOutputRoot(input.cwd, false)
  const outputDirectory = input.intentPackage.outputDirectory
  const loaded = await loadProtectedV2ApplicationIntentPackage({
    cwd: input.cwd,
    output: outputDirectory,
  })
  if (loaded.completed) throw new Error('Protected V2 final receipt is already complete.')
  assertProtectedV2OperatorBundleUnchanged({
    current: input.repository.operatorBundle,
    intent: loaded.intent.operatorBundle,
  })
  if (
    loaded.intentSha256 !== input.intentPackage.intentSha256 ||
    canonicalJson(loaded.intent) !== canonicalJson(input.intentPackage.intent) ||
    input.intentCommitIsAncestor !== true ||
    input.repository.branch !== 'main' ||
    input.repository.head !== input.repository.originMain ||
    input.repository.statusCleanIncludingUntracked !== true
  ) {
    throw new Error('Protected V2 intent changed before finalization.')
  }
  const result = buildProtectedV2ApplicationResult({
    after: input.after,
    backupInstances: loaded.intent.backupInstances,
    before: loaded.intent.before,
    intentCommitIsAncestor: input.intentCommitIsAncestor,
    intentRepositoryHead: loaded.intent.repository.head,
    migrationApplicationCallCount: input.migrationApplicationCallCount,
    operatorAuthorizationSha256: loaded.intent.authorizationSha256,
    originalIntentSha256: loaded.intentSha256,
    operatorBundleSha256: loaded.intent.operatorBundle.aggregateSha256,
    postApplicationAudit: input.postApplicationAudit,
    receiptReconciled: input.receiptReconciled,
    reconciliationReason: input.reconciliationReason,
    repository: input.repository,
  })
  const resultBytes = canonicalJson(result)
  const auditComponentMarkdown = PROTECTED_V2_AUDIT_COMPONENT_NAMES.map(
    (name) =>
      `- Audit component ${name}: \`${input.postApplicationAudit.catalogAudit.componentIdentities[name]}\``,
  ).join('\n')
  const markdown = `# Protected Literature gold import contract V2 application result

- Status: \`protected_v2_migration_applied_exactly_once\`
- Original intent SHA-256: \`${loaded.intentSha256}\`
- Authorization SHA-256: \`${loaded.intent.authorizationSha256}\`
- Intent repository commit: \`${loaded.intent.repository.head}\`
- Recovery repository commit: \`${input.repository.head}\`
- Intent commit is an ancestor: \`true\`
- Recovery operator bundle unchanged: \`true\`
- Protected operator bundle SHA-256: \`${loaded.intent.operatorBundle.aggregateSha256}\`
- Backup trust model: \`${PROTECTED_V2_BACKUP_TRUST_MODEL}\`
- Separate-capture attestation: \`${PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION}\`
- Redundant capture one: \`${loaded.intent.backupInstances[0].backupInstanceId}\`
- Redundant capture two: \`${loaded.intent.backupInstances[1].backupInstanceId}\`
- V1 occurrence before/after: \`1 / 1\`
- V2 occurrence before/after: \`0 / 1\`
- Receipt reconciled: \`${input.receiptReconciled}\`
- Migration application calls in this finalization: \`${input.migrationApplicationCallCount}\`
- Migration reexecuted: \`false\`
- Post-application audit method: \`${input.postApplicationAudit.auditMethod}\`
- Post-application audit: \`${input.postApplicationAudit.auditIdentitySha256}\`
- Complete catalog audit: \`${input.postApplicationAudit.catalogAudit.fullAuditIdentitySha256}\`
${auditComponentMarkdown}
- Verifier source SHA-256: \`${input.postApplicationAudit.verifier.sha256}\`
- Verifier executed: \`false\`
- Import authorized: \`false\`
- Compensation authorized: \`false\`
`
  const manifest = checksumManifest(
    new Map([
      ['application-result.json', resultBytes],
      ['application-result.md', markdown],
    ]),
  )
  const executionReceipt = buildProtectedV2ApplicationExecutionReceipt({
    auditMethod: input.postApplicationAudit.auditMethod,
    backupCaptureIds: loaded.intent.backupInstances.map(
      ({ backupInstanceId }) => backupInstanceId,
    ) as [string, string],
    backupTrustModel: PROTECTED_V2_BACKUP_TRUST_MODEL,
    canonicalManifestSha256: sha256(manifest),
    compensationAuthorized: false,
    executedAt: input.now.toISOString(),
    heldOutIdentitiesAccessed: false,
    importAuthorized: false,
    intentCommitIsAncestor: input.intentCommitIsAncestor,
    intentRepositoryHead: loaded.intent.repository.head,
    migrationApplied: true,
    migrationApplicationCallCount: input.migrationApplicationCallCount,
    migrationId: PROTECTED_GOLD_IMPORT_CONTRACT_V2.id,
    migrationReexecuted: false,
    migrationSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256,
    operatorAuthorizationSha256: loaded.intent.authorizationSha256,
    operatorBundleSha256: loaded.intent.operatorBundle.aggregateSha256,
    operatorBundleUnchanged: true,
    originalIntentSha256: loaded.intentSha256,
    outputDirectory,
    postApplicationAuditSha256: input.postApplicationAudit.auditIdentitySha256,
    postApplicationCatalogAuditIdentitySha256:
      input.postApplicationAudit.catalogAudit.fullAuditIdentitySha256,
    postApplicationComponentIdentities: input.postApplicationAudit.catalogAudit.componentIdentities,
    receiptReconciled: input.receiptReconciled,
    reconciliationReason: input.reconciliationReason,
    remoteDatabaseAccessed: false,
    recoveryRepositoryHead: input.repository.head,
    repositoryCommitSha: input.repository.head,
    resultSha256: sha256(resultBytes),
    separateCaptureAttestation: PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
    verifierExecuted: false,
    verifierSourceSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256,
  })
  const temporaryDirectory = resolve(
    outputRoot,
    `.protected-v2-finalization-${randomBytes(16).toString('hex')}`,
  )
  const finalDirectory = resolve(outputDirectory, FINALIZED_APPLICATION_DIRECTORY)
  await mkdir(temporaryDirectory, { mode: 0o700 })
  try {
    await writeImmutableFile(resolve(temporaryDirectory, 'application-result.json'), resultBytes)
    await writeImmutableFile(resolve(temporaryDirectory, 'application-result.md'), markdown)
    await writeImmutableFile(resolve(temporaryDirectory, 'checksum-manifest.sha256'), manifest)
    await writeImmutableFile(
      resolve(temporaryDirectory, 'execution-receipt.json'),
      canonicalJson(executionReceipt),
    )
    await rename(temporaryDirectory, finalDirectory)
  } catch (error) {
    await rm(temporaryDirectory, { force: true, recursive: true })
    throw error
  }
  return {
    manifestSha256: sha256(manifest),
    outputDirectory,
    receiptSha256: sha256(canonicalJson(executionReceipt)),
  }
}

async function executeProtectedV2ReadOnlyPsql(input: {
  dockerTarget: LocalDockerTarget
  runCommand: CommandRunner
  sql: string
}) {
  const sql = input.sql.trim()
  if (
    !/^begin transaction isolation level repeatable read read only;/iu.test(sql) ||
    !/rollback;$/iu.test(sql)
  ) {
    throw new Error('Protected V2 verifier requires a fixed read-only transaction bracket.')
  }
  return input.runCommand(
    'docker',
    [
      ...input.dockerTarget.dockerArguments,
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
    {
      env: input.dockerTarget.environment,
      stdin: sql,
    },
  )
}

async function queryProtectedV2ReadOnlyJson(input: {
  dockerTarget: LocalDockerTarget
  runCommand: CommandRunner
  sql: string
}) {
  const result = await executeProtectedV2ReadOnlyPsql(input)
  const candidates = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
  if (candidates.length !== 1) {
    throw new Error('Protected V2 read-only verifier JSON output was absent or duplicated.')
  }
  return parseJson(candidates[0]!, 'Protected V2 read-only verifier output')
}

export async function collectProtectedV2PostApplicationAudit(input: {
  after: ProtectedV2DatabaseEvidence
  dockerTarget: LocalDockerTarget
  now: Date
  repository: ProtectedV2RepositoryEvidence
  runCommand?: CommandRunner
}): Promise<ProtectedV2PostApplicationAudit> {
  const runCommand = input.runCommand ?? defaultCommandRunner
  const context = {
    psql: (sql: string) =>
      executeProtectedV2ReadOnlyPsql({
        dockerTarget: input.dockerTarget,
        runCommand,
        sql,
      }),
    queryJson: (sql: string) =>
      queryProtectedV2ReadOnlyJson({
        dockerTarget: input.dockerTarget,
        runCommand,
        sql,
      }),
  }
  const catalogAudit = await collectProtectedV2CompleteCatalogAudit({
    context,
    profile: 'local',
  })
  return buildProtectedV2PostApplicationAudit({
    auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
    auditedAt: input.now.toISOString(),
    catalogAudit,
    databaseEvidenceSha256: sha256(canonicalJson(input.after)),
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    readOnly: true,
    repeatableRead: true,
    repositoryCommitSha: input.repository.head,
    verifier: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
    verifierExecuted: false,
  })
}

export async function createDefaultProtectedV2OperatorDependencies(input: {
  cwd?: string
  runCommand?: CommandRunner
}): Promise<ProtectedV2OperatorDependencies> {
  const cwd = input.cwd ?? process.cwd()
  const runCommand = input.runCommand ?? defaultCommandRunner
  await assertMigrationFileIdentities(cwd)
  const dockerTarget = await resolveLocalDockerTarget({ runCommand })
  await assertLocalDatabaseHealthy(DEFAULT_LOCAL_DATABASE_CONTAINER, runCommand, dockerTarget)
  const paths = defaultLocalSupabasePaths(cwd)
  const runSupabase = createSupabaseRunner(paths)
  return {
    applyMigration: async () => {
      await runSupabase(['migration', 'up', '--local'])
    },
    beforeMigrationApplication: async () => undefined,
    finalizeReceipt: (finalization) =>
      finalizeProtectedV2ApplicationReceipt({ ...finalization, cwd, now: new Date() }),
    inspectDatabase: (expected) =>
      collectProtectedV2OperatorDatabase({ dockerTarget, expected, runCommand }),
    inspectRepository: () => inspectProtectedV2OperatorRepository({ cwd, runCommand }),
    isRepositoryCommitAncestor: async (ancestor, descendant) => {
      if (!/^[a-f0-9]{40}$/u.test(ancestor) || !/^[a-f0-9]{40}$/u.test(descendant)) {
        throw new Error('Protected V2 recovery commit identity is malformed.')
      }
      try {
        await runCommand('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd })
        return true
      } catch {
        return false
      }
    },
    loadIntentPackage: (output) => loadProtectedV2ApplicationIntentPackage({ cwd, output }),
    now: () => new Date(),
    sealIntent: (intent) => sealProtectedV2ApplicationIntent({ ...intent, cwd }),
    stageProtectedMigration: async ({ authorization, authorizationContext, ledgerEntries }) => {
      await stageAuthorizedProtectedV2Migration({
        authorization,
        authorizationContext,
        ledgerEntries,
        paths,
      })
    },
    verifyBackup: verifyProtectedV2PreapplicationBackup,
    verifyPostApplication: ({ after, repository }) =>
      collectProtectedV2PostApplicationAudit({
        after,
        dockerTarget,
        now: new Date(),
        repository,
        runCommand,
      }),
  }
}

async function main() {
  const arguments_ = parseProtectedV2OperatorArguments(process.argv.slice(2))
  const dependencies = await createDefaultProtectedV2OperatorDependencies({})
  const result = await runProtectedV2Operator(arguments_, dependencies)
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
