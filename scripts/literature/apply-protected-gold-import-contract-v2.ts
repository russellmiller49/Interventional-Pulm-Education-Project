import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, realpath } from 'node:fs/promises'
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
  sealCanonicalArtifacts,
  writeCanonicalPackage,
  type CanonicalArtifacts,
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
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_V2_CONFIRMATION,
  buildProtectedV2Authorization,
  classifyProtectedV2Ledger,
  classifyProtectedV2State,
  validateProtectedV2Authorization,
  type ProtectedMigrationLedgerEntry,
  type ProtectedV2AuthorizationContext,
  type ProtectedV2BackupBinding,
} from './protected-gold-import-contract-v2'
import {
  GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION,
  GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION,
} from './diagnose-gold-import-compensation-v2-preapplication'

export const PROTECTED_V2_APPLICATION_REPORT_SCHEMA_VERSION =
  'literature-gold-protected-v2-migration-application/1.0.0' as const
export const PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION =
  'literature-gold-protected-v2-migration-application-execution/1.0.0' as const
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
const HELP = `
Dry-run or intentionally apply the protected Literature gold import contract V2 migration.

Usage (read-only dry-run; default):
  npm run literature:apply-protected-gold-import-contract-v2 -- \\
    --target local --operator <IDENTITY> \\
    --backup <FRESH_BACKUP_ONE> --backup <FRESH_BACKUP_TWO>

Mutation-capable mode (future separately authorized primary-main session only):
  npm run literature:apply-protected-gold-import-contract-v2 -- \\
    --target local --operator <IDENTITY> \\
    --backup <FRESH_BACKUP_ONE> --backup <FRESH_BACKUP_TWO> \\
    --confirmation "${PROTECTED_V2_CONFIRMATION}" \\
    --output <LOCAL_DATA_RECEIPT_DIRECTORY> --commit

Without --commit this command is repeatable-read/read-only and never stages V2. --commit requires
primary main at exact clean origin/main, the pinned local project/container/port, V1 exactly once,
V2 absent, accepted state hashes, two distinct checksum-verified backups less than two hours old,
and the exact confirmation. Its authorization scope can apply only the V2 schema migration; it
cannot authorize import or compensation.
`.trim()

export interface ProtectedV2OperatorArguments {
  backups: readonly [string, string]
  commit: boolean
  confirmation?: string
  operator: string
  output?: string
  target: 'local'
}

export interface ProtectedV2RepositoryEvidence {
  branch: 'main'
  head: string
  originMain: string
  statusCleanIncludingUntracked: true
}

export interface ProtectedV2DatabaseEvidence {
  batchId: string
  developmentMembershipSha256: string
  developmentPlanningStateSha256: string
  effectiveStateSha256: string
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[]
  physicalStateSha256: string
  readOnlyBracketMatches: true
  v1Occurrence: number
  v2Occurrence: number
}

export interface ProtectedV2OperatorDependencies {
  applyMigration: () => Promise<void>
  inspectDatabase: (
    expected: 'v2_absent' | 'v2_applied_exactly_once',
  ) => Promise<ProtectedV2DatabaseEvidence>
  inspectRepository: () => Promise<ProtectedV2RepositoryEvidence>
  now: () => Date
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
  writeReceipt: (input: {
    after: ProtectedV2DatabaseEvidence
    authorization: ReturnType<typeof buildProtectedV2Authorization>
    before: ProtectedV2DatabaseEvidence
    output: string
    repository: ProtectedV2RepositoryEvidence
  }) => Promise<{ manifestSha256: string; outputDirectory: string }>
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
    'target',
  ])
  if (hasFlag(arguments_, 'help')) throw new Error(HELP)
  const backups = arguments_.values.get('backup') ?? []
  const target = stringArgument(arguments_, 'target')
  const operator = stringArgument(arguments_, 'operator')
  const confirmation = stringArgument(arguments_, 'confirmation')
  const output = stringArgument(arguments_, 'output')
  const commit = hasFlag(arguments_, 'commit')
  if (target !== 'local') throw new Error('Protected V2 operator target must be exactly local.')
  if (!operator?.trim() || operator.trim() !== operator) {
    throw new Error('Protected V2 operator identity is required and must be trimmed.')
  }
  if (backups.length !== 2 || backups[0] === backups[1]) {
    throw new Error('Exactly two distinct --backup directories are required.')
  }
  if (commit && confirmation !== PROTECTED_V2_CONFIRMATION) {
    throw new Error(`--commit requires --confirmation "${PROTECTED_V2_CONFIRMATION}".`)
  }
  if (commit && !output) throw new Error('--commit requires a fresh local-only --output directory.')
  if (!commit && output) throw new Error('Dry-run refuses --output because it performs no writes.')
  return {
    backups: [backups[0]!, backups[1]!],
    commit,
    confirmation,
    operator,
    output,
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
    evidence.physicalStateSha256 !== GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256
  ) {
    throw new Error(`Protected V2 ${expected} database boundary did not match accepted state.`)
  }
}

function authorizationContext(input: {
  backups: readonly [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  database: ProtectedV2DatabaseEvidence
  repository: ProtectedV2RepositoryEvidence
}): ProtectedV2AuthorizationContext {
  return {
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
    repository: input.repository,
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
  const execution = record(
    parseJson(executionBytes, 'backup execution receipt'),
    'execution receipt',
  )
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
  const executedAt = String(execution.executedAt ?? '')
  const executedAtMilliseconds = Date.parse(executedAt)
  const age = input.now.getTime() - executedAtMilliseconds
  if (
    execution.schemaVersion !== GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION ||
    execution.canonicalManifestSha256 !== manifestSha256 ||
    execution.repositoryCommitSha !== input.repository.head ||
    execution.databaseMutationCount !== 0 ||
    execution.heldOutIdentitiesAccessed !== false ||
    execution.remoteDatabaseAccessed !== false ||
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
  if (protectedV2.classification !== 'v2_absent' || protectedV2.occurrence !== 0) {
    throw new Error('Protected V2 backup ledger is not at the absent boundary.')
  }
  return {
    canonicalManifestSha256: manifestSha256,
    directory,
    executedAt,
    executionReceiptSha256: sha256(executionBytes),
  }
}

export async function runProtectedV2Operator(
  arguments_: ProtectedV2OperatorArguments,
  dependencies: ProtectedV2OperatorDependencies,
) {
  const repository = await dependencies.inspectRepository()
  const before = await dependencies.inspectDatabase('v2_absent')
  assertDatabaseBoundary(before, 'v2_absent')
  const now = dependencies.now()
  const bindings = (await Promise.all(
    arguments_.backups.map((directory) =>
      dependencies.verifyBackup({ database: before, directory, now, repository }),
    ),
  )) as [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  const context = authorizationContext({ backups: bindings, database: before, repository })

  if (!arguments_.commit) {
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

  await dependencies.stageProtectedMigration({
    authorization,
    authorizationContext: currentContext,
    ledgerEntries: currentDatabase.ledgerEntries,
  })
  await dependencies.applyMigration()
  const after = await dependencies.inspectDatabase('v2_applied_exactly_once')
  assertDatabaseBoundary(after, 'v2_applied_exactly_once')
  const receipt = await dependencies.writeReceipt({
    after,
    authorization,
    before,
    output: arguments_.output!,
    repository,
  })
  return {
    authorizationSha256: authorization.contentSha256,
    databaseMutationCount: 1,
    mode: 'committed_protected_v2_migration' as const,
    protectedState: 'v2_applied_exactly_once' as const,
    receipt,
    repository,
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
  const snapshotAfter = await collectReadOnlyDatabaseSnapshot({
    dockerTarget: input.dockerTarget,
    runCommand,
  })
  const hashesAfter = await collectReadOnlyContractStateHashes({
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
  const bracketMatches =
    canonicalJson(snapshotBefore.developmentItems) ===
      canonicalJson(snapshotAfter.developmentItems) &&
    canonicalJson(hashesBefore) === canonicalJson(hashesAfter) &&
    planningBefore === planningAfter
  const scope = record(snapshotAfter.scope, 'snapshot.scope')
  const batch = record(scope.batch, 'snapshot.scope.batch')
  const evidence: ProtectedV2DatabaseEvidence = {
    batchId: String(batch.id ?? ''),
    developmentMembershipSha256: hashesAfter.developmentMembershipSha256,
    developmentPlanningStateSha256: planningAfter,
    effectiveStateSha256: hashesAfter.effectiveStateSha256,
    ledgerEntries,
    physicalStateSha256: hashesAfter.physicalStateSha256,
    readOnlyBracketMatches: bracketMatches as true,
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
}

async function writeApplicationReceipt(input: {
  after: ProtectedV2DatabaseEvidence
  authorization: ReturnType<typeof buildProtectedV2Authorization>
  before: ProtectedV2DatabaseEvidence
  cwd: string
  output: string
  repository: ProtectedV2RepositoryEvidence
}) {
  const outputRoot = resolve(input.cwd, 'local-data/literature/protected-v2-application-receipts')
  await mkdir(outputRoot, { mode: 0o700, recursive: true })
  const requestedOutput = resolve(input.output)
  if (!isWithin(outputRoot, requestedOutput)) {
    throw new Error('Protected V2 application receipt must stay under the ignored local-only root.')
  }
  const outputDirectory = await assertExclusiveOutputPath({
    backupRoot: outputRoot,
    cwd: input.cwd,
    output: requestedOutput,
  })
  const report = {
    schemaVersion: PROTECTED_V2_APPLICATION_REPORT_SCHEMA_VERSION,
    status: 'protected_v2_migration_applied_exactly_once',
    repository: input.repository,
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    authorization: input.authorization,
    before: input.before,
    after: input.after,
    safety: {
      authorizedCapability: input.authorization.authorizedCapability,
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      remoteDatabaseAccessed: false,
    },
  }
  const markdown = `# Protected Literature gold import contract V2 application receipt

- Status: \`protected_v2_migration_applied_exactly_once\`
- Migration: \`${PROTECTED_GOLD_IMPORT_CONTRACT_V2.id}\`
- Migration SHA-256: \`${PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256}\`
- V1 occurrence before/after: \`1 / 1\`
- V2 occurrence before/after: \`0 / 1\`
- Import authorized: \`false\`
- Compensation authorized: \`false\`
- Held-out access: \`false\`
- Remote access: \`false\`
`
  const artifacts: CanonicalArtifacts = sealCanonicalArtifacts(
    new Map([
      ['application-report.json', canonicalJson(report)],
      ['application-report.md', markdown],
    ]),
  )
  const executionReceipt = {
    schemaVersion: PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION,
    executedAt: new Date().toISOString(),
    canonicalManifestSha256: artifacts.manifestSha256,
    repositoryCommitSha: input.repository.head,
    migrationId: PROTECTED_GOLD_IMPORT_CONTRACT_V2.id,
    migrationSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256,
    databaseMigrationMutationCount: 1,
    importAuthorized: false,
    compensationAuthorized: false,
    heldOutIdentitiesAccessed: false,
    remoteDatabaseAccessed: false,
  }
  await writeCanonicalPackage({ artifacts, executionReceipt, outputDirectory, outputRoot })
  return { manifestSha256: artifacts.manifestSha256, outputDirectory }
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
    inspectDatabase: (expected) =>
      collectProtectedV2OperatorDatabase({ dockerTarget, expected, runCommand }),
    inspectRepository: () => inspectProtectedV2OperatorRepository({ cwd, runCommand }),
    now: () => new Date(),
    stageProtectedMigration: async ({ authorization, authorizationContext, ledgerEntries }) => {
      await stageAuthorizedProtectedV2Migration({
        authorization,
        authorizationContext,
        ledgerEntries,
        paths,
      })
    },
    verifyBackup: verifyProtectedV2PreapplicationBackup,
    writeReceipt: ({ after, authorization, before, output, repository }) =>
      writeApplicationReceipt({ after, authorization, before, cwd, output, repository }),
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
