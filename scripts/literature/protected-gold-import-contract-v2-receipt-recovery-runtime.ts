import { execFile } from 'node:child_process'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { promisify } from 'node:util'

import {
  LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
  validateLiteratureGoldV2SchemaOnlyTransition,
  type LiteratureGoldV2SchemaOnlyTransitionInput,
} from './literature-gold-v2-schema-only-transition'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH,
  PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
  parseProtectedV2ReceiptRecoveryCommittedAmendment,
  type ProtectedV2ReceiptRecoveryIncidentAuthority,
} from './protected-gold-import-contract-v2-receipt-recovery-authority'
import {
  canonicalProtectedV2ReceiptRecoveryJson,
  protectedV2ReceiptRecoverySha256,
  type ProtectedV2ReceiptRecoveryAmendment,
} from './protected-gold-import-contract-v2-receipt-recovery-amendment'
import {
  recoverProtectedV2HistoricalReceipt,
  type ProtectedV2ReceiptRecoveryCapturePackage,
  type ProtectedV2ReceiptRecoveryOutcome,
  type ProtectedV2ReceiptRecoveryPostEvidence,
  type ProtectedV2ReceiptRecoveryRepositoryEvidence,
} from './protected-gold-import-contract-v2-receipt-recovery-core'
import { buildCurrentProtectedV2ReceiptRecoveryToolBundle } from './protected-gold-import-contract-v2-receipt-recovery-tool-bundle'

export const PROTECTED_V2_RECEIPT_RECOVERY_PRIMARY_CHECKOUT =
  '/Users/russellmiller/Projects/Interventional-Pulm-Education-Project' as const

export const PROTECTED_V2_RECEIPT_RECOVERY_TARGET = {
  container: 'supabase_db_ip-literature-local',
  database: 'postgres',
  localDockerEndpointRequired: true,
  port: 55322,
  profile: 'local_supabase_postgres_owner_v1',
  project: 'ip-literature-local',
  remoteDatabaseAccessAllowed: false,
} as const

export const PROTECTED_V2_RECEIPT_RECOVERY_USAGE = `Usage:
  npm run literature:recover-protected-gold-import-contract-v2-receipt -- \\
    --expected-amendment-sha256 <exact-reviewed-sha256>

This incident-specific command can only finalize the existing sealed receipt. It cannot stage or
apply a migration, import, compensate, or mutate clinical state. --help is the only other argument.
` as const

const CAPTURE_FILES = [
  'checksum-manifest.sha256',
  'development-database-seed.json',
  'execution-receipt.json',
  'pre-application-report.json',
  'pre-application-report.md',
  'protected-migration-ledger.json',
  'state-hashes.json',
] as const

const INTENT_FILES = [
  'application-intent.json',
  'application-intent.md',
  'intent-checksum-manifest.sha256',
] as const

const PINNED_SOURCE_PATHS = {
  v1MigrationSha256:
    'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
  v2MigrationSha256:
    'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
  v2VerifierSha256:
    'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
} as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u
const execFileAsync = promisify(execFile)

export interface ProtectedV2ReceiptRecoveryArguments {
  expectedAmendmentIdentitySha256: string
}

export interface ProtectedV2ReceiptRecoveryReadOnlyQueryAudit {
  databaseMutationCount: 0
  heldOutIdentitiesAccessed: false
  localDockerEndpoint: true
  remoteDatabaseAccessed: false
  transactionBatches: readonly string[]
}

export interface ProtectedV2ReceiptRecoveryCapabilityCallCounts {
  compensation: 0
  import: 0
  migrationApplication: 0
  migrationStaging: 0
}

export interface ProtectedV2ReceiptRecoveryCollectedEvidence {
  capabilityCallCounts: ProtectedV2ReceiptRecoveryCapabilityCallCounts
  postEvidence: ProtectedV2ReceiptRecoveryPostEvidence
  queryAudit: ProtectedV2ReceiptRecoveryReadOnlyQueryAudit
  transitionInput: LiteratureGoldV2SchemaOnlyTransitionInput
}

export interface ProtectedV2ReceiptRecoveryReadOnlyEvidenceRequest {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  applicationOutputDirectory: string
  captures: readonly [
    ProtectedV2ReceiptRecoveryCapturePackage,
    ProtectedV2ReceiptRecoveryCapturePackage,
  ]
  finalizedPresent: boolean
  target: typeof PROTECTED_V2_RECEIPT_RECOVERY_TARGET
}

export interface ProtectedV2ReceiptRecoveryRuntimeDependencies {
  collectReadOnlyEvidence: (
    request: ProtectedV2ReceiptRecoveryReadOnlyEvidenceRequest,
  ) => Promise<ProtectedV2ReceiptRecoveryCollectedEvidence>
}

export type ProtectedV2ReceiptRecoveryCommandResult =
  | { help: typeof PROTECTED_V2_RECEIPT_RECOVERY_USAGE }
  | {
      amendmentIdentitySha256: string
      currentRecoveryToolBundleSha256: string
      migrationApplicationCallCount: 0
      migrationStagingCallCount: 0
      outcome: ProtectedV2ReceiptRecoveryOutcome
      target: typeof PROTECTED_V2_RECEIPT_RECOVERY_TARGET
    }

interface CommandResult {
  stderr: string
  stdout: string
}

type CommandRunner = (
  command: string,
  arguments_: readonly string[],
  options: { cwd: string },
) => Promise<CommandResult>

const defaultCommandRunner: CommandRunner = async (command, arguments_, options) => {
  const result = await execFileAsync(command, [...arguments_], {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  return { stderr: result.stderr, stdout: result.stdout }
}

export function parseProtectedV2ReceiptRecoveryArguments(
  arguments_: readonly string[],
): ProtectedV2ReceiptRecoveryArguments | { help: true } {
  if (arguments_.length === 1 && arguments_[0] === '--help') return { help: true }
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== '--expected-amendment-sha256' ||
    !SHA256_PATTERN.test(arguments_[1] ?? '')
  ) {
    throw new Error(
      'Recovery requires exactly --expected-amendment-sha256 followed by the reviewed lowercase SHA-256.',
    )
  }
  return { expectedAmendmentIdentitySha256: arguments_[1]! }
}

function isWithin(root: string, path: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`)
}

async function assertCanonicalDirectory(path: string, label: string): Promise<void> {
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
    throw new Error(`${label} must be a canonical non-symlink directory: ${path}`)
  }
}

async function readCanonicalRegularFile(input: {
  allowedRoot: string
  path: string
  label: string
}): Promise<string> {
  if (!isWithin(input.allowedRoot, input.path)) {
    throw new Error(`${input.label} escapes its reviewed root.`)
  }
  const stat = await lstat(input.path)
  if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(input.path)) !== input.path) {
    throw new Error(`${input.label} must be a canonical regular file.`)
  }
  return readFile(input.path, 'utf8')
}

async function readRepositoryContractFile(cwd: string, path: string): Promise<string> {
  return readCanonicalRegularFile({
    allowedRoot: cwd,
    label: `Recovery contract ${path}`,
    path: resolve(cwd, path),
  })
}

async function loadCapture(
  authority: ProtectedV2ReceiptRecoveryIncidentAuthority['historicalIncident']['backupCaptures'][number],
): Promise<ProtectedV2ReceiptRecoveryCapturePackage> {
  await assertCanonicalDirectory(authority.directory, 'Historical pre-application capture')
  const names = (await readdir(authority.directory)).sort()
  if (
    canonicalProtectedV2ReceiptRecoveryJson(names) !==
    canonicalProtectedV2ReceiptRecoveryJson([...CAPTURE_FILES].sort())
  ) {
    throw new Error(`Historical capture inventory drifted: ${authority.directory}`)
  }
  const entries = await Promise.all(
    CAPTURE_FILES.map(
      async (name) =>
        [
          name,
          await readCanonicalRegularFile({
            allowedRoot: authority.directory,
            label: `Historical capture file ${name}`,
            path: resolve(authority.directory, name),
          }),
        ] as const,
    ),
  )
  return {
    declaredDirectory: authority.directory,
    files: Object.fromEntries(
      entries,
    ) as unknown as ProtectedV2ReceiptRecoveryCapturePackage['files'],
  }
}

async function loadIncidentEvidence(
  authority: ProtectedV2ReceiptRecoveryIncidentAuthority,
): Promise<Readonly<Record<string, string>>> {
  const root = authority.historicalIncident.incidentEvidenceRoot
  await assertCanonicalDirectory(root, 'Protected V2 incident evidence root')
  const entries = await Promise.all(
    Object.keys(authority.historicalIncident.incidentEvidenceSha256)
      .sort()
      .map(
        async (path) =>
          [
            path,
            await readCanonicalRegularFile({
              allowedRoot: root,
              label: `Protected V2 incident evidence ${path}`,
              path: resolve(root, path),
            }),
          ] as const,
      ),
  )
  return Object.fromEntries(entries)
}

function parseHistoricalOperatorBundle(intentBytes: string): unknown {
  let parsed: unknown
  try {
    parsed = JSON.parse(intentBytes) as unknown
  } catch {
    throw new Error('Historical application intent is not JSON.')
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !('operatorBundle' in parsed)
  ) {
    throw new Error('Historical application intent has no operator bundle.')
  }
  return (parsed as { operatorBundle: unknown }).operatorBundle
}

async function inspectRecoveryRepository(input: {
  cwd: string
  intentCommit: string
  runCommand: CommandRunner
}): Promise<ProtectedV2ReceiptRecoveryRepositoryEvidence> {
  const cwd = await realpath(resolve(input.cwd))
  if (cwd !== PROTECTED_V2_RECEIPT_RECOVERY_PRIMARY_CHECKOUT) {
    throw new Error('Receipt recovery may execute only from the exact primary checkout.')
  }
  const git = async (arguments_: readonly string[]): Promise<string> =>
    (await input.runCommand('git', arguments_, { cwd })).stdout.trim()
  const [root, branch, head, originMain, status] = await Promise.all([
    git(['rev-parse', '--show-toplevel']),
    git(['branch', '--show-current']),
    git(['rev-parse', 'HEAD']),
    git(['rev-parse', 'origin/main']),
    git(['status', '--porcelain=v1', '--untracked-files=all']),
  ])
  if (
    (await realpath(root)) !== cwd ||
    branch !== 'main' ||
    head !== originMain ||
    !COMMIT_PATTERN.test(head) ||
    status !== ''
  ) {
    throw new Error('Receipt recovery requires clean primary main at exact origin/main.')
  }
  for (const path of [
    PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
    PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH,
  ]) {
    await git(['ls-files', '--error-unmatch', '--', path])
  }
  let intentCommitIsAncestor = true
  try {
    await input.runCommand('git', ['merge-base', '--is-ancestor', input.intentCommit, head], {
      cwd,
    })
  } catch {
    intentCommitIsAncestor = false
  }
  if (!intentCommitIsAncestor) {
    throw new Error('Historical intent repository HEAD is not an ancestor of current main.')
  }
  return {
    branch: 'main',
    head,
    intentCommitIsAncestor: true,
    originMain,
    primaryCheckout: true,
    statusCleanIncludingUntracked: true,
  }
}

async function verifyPinnedSourceBytes(input: {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  cwd: string
}): Promise<void> {
  for (const [identity, path] of Object.entries(PINNED_SOURCE_PATHS) as Array<
    [keyof typeof PINNED_SOURCE_PATHS, string]
  >) {
    const bytes = await readRepositoryContractFile(input.cwd, path)
    if (protectedV2ReceiptRecoverySha256(bytes) !== input.amendment.pinnedSources[identity]) {
      throw new Error(`Protected V2 recovery pinned source bytes changed: ${path}`)
    }
  }
}

function statements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

export function assertProtectedV2ReceiptRecoveryReadOnlyQueryAudit(
  audit: ProtectedV2ReceiptRecoveryReadOnlyQueryAudit,
): void {
  if (
    canonicalProtectedV2ReceiptRecoveryJson(Object.keys(audit).sort()) !==
      canonicalProtectedV2ReceiptRecoveryJson(
        [
          'databaseMutationCount',
          'heldOutIdentitiesAccessed',
          'localDockerEndpoint',
          'remoteDatabaseAccessed',
          'transactionBatches',
        ].sort(),
      ) ||
    audit.databaseMutationCount !== 0 ||
    audit.heldOutIdentitiesAccessed !== false ||
    audit.localDockerEndpoint !== true ||
    audit.remoteDatabaseAccessed !== false ||
    !Array.isArray(audit.transactionBatches) ||
    audit.transactionBatches.length === 0
  ) {
    throw new Error('Receipt recovery database evidence is not exact local read-only evidence.')
  }
  const forbidden =
    /\b(?:alter|call|commit|copy|create|delete|do|drop|grant|insert|lock|merge|refresh|reindex|revoke|setval|truncate|update|vacuum)\b|\bfor\s+(?:no\s+key\s+)?update\b|\bfor\s+(?:key\s+)?share\b|pg_advisory|nextval\s*\(/iu
  for (const batch of audit.transactionBatches) {
    if (typeof batch !== 'string' || batch.includes('--') || batch.includes('/*')) {
      throw new Error('Receipt recovery SQL must be literal, comment-free read-only SQL.')
    }
    const parsed = statements(batch)
    if (
      parsed.length < 3 ||
      !/^begin(?:\s+transaction)?\s+isolation\s+level\s+repeatable\s+read\s+read\s+only$/iu.test(
        parsed[0]!,
      ) ||
      !/^rollback$/iu.test(parsed.at(-1)!) ||
      parsed
        .slice(1, -1)
        .some(
          (statement) =>
            (!/^(?:select|with)\b/iu.test(statement) &&
              !/^set\s+local\s+statement_timeout\s*=\s*'120s'$/iu.test(statement)) ||
            forbidden.test(statement),
        )
    ) {
      throw new Error(
        'Receipt recovery SQL must be bracketed by repeatable-read/read-only BEGIN and ROLLBACK and contain only nonlocking SELECT/CTE statements.',
      )
    }
  }
}

function assertZeroCapabilityCalls(calls: ProtectedV2ReceiptRecoveryCapabilityCallCounts): void {
  if (
    canonicalProtectedV2ReceiptRecoveryJson(calls) !==
    canonicalProtectedV2ReceiptRecoveryJson({
      compensation: 0,
      import: 0,
      migrationApplication: 0,
      migrationStaging: 0,
    })
  ) {
    throw new Error('Receipt recovery evidence exposed or invoked a prohibited capability.')
  }
}

async function immutableSourceSnapshot(input: {
  authority: ProtectedV2ReceiptRecoveryIncidentAuthority
  captures: readonly [
    ProtectedV2ReceiptRecoveryCapturePackage,
    ProtectedV2ReceiptRecoveryCapturePackage,
  ]
  incidentEvidenceFiles: Readonly<Record<string, string>>
}): Promise<string> {
  const output = input.authority.historicalIncident.intentOutputDirectory
  const intentEntries = await Promise.all(
    INTENT_FILES.map(
      async (name) =>
        [
          `intent/${name}`,
          protectedV2ReceiptRecoverySha256(
            await readCanonicalRegularFile({
              allowedRoot: output,
              label: `Historical intent file ${name}`,
              path: resolve(output, name),
            }),
          ),
        ] as const,
    ),
  )
  const values = {
    captures: input.captures.map((capture) =>
      Object.fromEntries(
        Object.entries(capture.files)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([name, bytes]) => [name, protectedV2ReceiptRecoverySha256(bytes)]),
      ),
    ),
    incident: Object.fromEntries(
      Object.entries(input.incidentEvidenceFiles)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([name, bytes]) => [name, protectedV2ReceiptRecoverySha256(bytes)]),
    ),
    intent: Object.fromEntries(intentEntries),
  }
  return protectedV2ReceiptRecoverySha256(canonicalProtectedV2ReceiptRecoveryJson(values))
}

async function finalizedPresent(outputDirectory: string): Promise<boolean> {
  try {
    await lstat(resolve(outputDirectory, 'finalized'))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function runProtectedV2ReceiptRecoveryCommand(
  arguments_: readonly string[],
  dependencies: ProtectedV2ReceiptRecoveryRuntimeDependencies,
  options: { cwd?: string; runCommand?: CommandRunner } = {},
): Promise<ProtectedV2ReceiptRecoveryCommandResult> {
  const parsedArguments = parseProtectedV2ReceiptRecoveryArguments(arguments_)
  if ('help' in parsedArguments) return { help: PROTECTED_V2_RECEIPT_RECOVERY_USAGE }
  if (Object.keys(dependencies).sort().join(',') !== 'collectReadOnlyEvidence') {
    throw new Error('Recovery runtime dependencies may expose only collectReadOnlyEvidence.')
  }

  const cwd = await realpath(resolve(options.cwd ?? process.cwd()))
  if (cwd !== PROTECTED_V2_RECEIPT_RECOVERY_PRIMARY_CHECKOUT) {
    throw new Error('Receipt recovery may execute only from the exact primary checkout.')
  }
  const runCommand = options.runCommand ?? defaultCommandRunner
  const authorityBytes = await readRepositoryContractFile(
    cwd,
    PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
  )
  const amendmentBytes = await readRepositoryContractFile(
    cwd,
    PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH,
  )
  const currentRecoveryToolBundle = await buildCurrentProtectedV2ReceiptRecoveryToolBundle({ cwd })
  const amendment = parseProtectedV2ReceiptRecoveryCommittedAmendment({
    amendmentBytes,
    authorityBytes,
    correctedRecoveryToolBundle: currentRecoveryToolBundle,
    correctedTransitionPolicyIdentitySha256:
      LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
  })
  if (amendment.amendmentIdentitySha256 !== parsedArguments.expectedAmendmentIdentitySha256) {
    throw new Error('Externally confirmed recovery amendment identity does not match.')
  }
  const authority = JSON.parse(authorityBytes) as ProtectedV2ReceiptRecoveryIncidentAuthority
  const recoveryRepository = await inspectRecoveryRepository({
    cwd,
    intentCommit: authority.historicalIncident.repositoryHead,
    runCommand,
  })
  await verifyPinnedSourceBytes({ amendment, cwd })

  const captures = (await Promise.all(
    authority.historicalIncident.backupCaptures.map(loadCapture),
  )) as unknown as readonly [
    ProtectedV2ReceiptRecoveryCapturePackage,
    ProtectedV2ReceiptRecoveryCapturePackage,
  ]
  const incidentEvidenceFiles = await loadIncidentEvidence(authority)
  const authorizationBytes = incidentEvidenceFiles['evidence/original-authorization.json']!
  const intentBytes = await readCanonicalRegularFile({
    allowedRoot: authority.historicalIncident.intentOutputDirectory,
    label: 'Historical application intent',
    path: resolve(authority.historicalIncident.intentOutputDirectory, 'application-intent.json'),
  })
  const historicalOperatorBundle = parseHistoricalOperatorBundle(intentBytes)
  const beforeSnapshot = await immutableSourceSnapshot({
    authority,
    captures,
    incidentEvidenceFiles,
  })
  const isFinalized = await finalizedPresent(authority.historicalIncident.intentOutputDirectory)

  let outcome: ProtectedV2ReceiptRecoveryOutcome
  try {
    const collected = await dependencies.collectReadOnlyEvidence({
      amendment,
      applicationOutputDirectory: authority.historicalIncident.intentOutputDirectory,
      captures,
      finalizedPresent: isFinalized,
      target: PROTECTED_V2_RECEIPT_RECOVERY_TARGET,
    })
    assertZeroCapabilityCalls(collected.capabilityCallCounts)
    assertProtectedV2ReceiptRecoveryReadOnlyQueryAudit(collected.queryAudit)
    outcome = await recoverProtectedV2HistoricalReceipt(
      {
        amendment,
        applicationOutputDirectory: authority.historicalIncident.intentOutputDirectory,
        authorizationBytes,
        captures,
        currentRecoveryToolBundle,
        expectedAmendmentIdentitySha256: parsedArguments.expectedAmendmentIdentitySha256,
        historicalOperatorBundle,
        incidentEvidenceFiles,
        postEvidence: collected.postEvidence,
        recoveryRepository,
        transitionInput: collected.transitionInput,
      },
      {
        validateSchemaOnlyTransition: (input) =>
          validateLiteratureGoldV2SchemaOnlyTransition(
            input as LiteratureGoldV2SchemaOnlyTransitionInput,
          ),
      },
    )
  } finally {
    const afterSnapshot = await immutableSourceSnapshot({
      authority,
      captures: (await Promise.all(
        authority.historicalIncident.backupCaptures.map(loadCapture),
      )) as unknown as readonly [
        ProtectedV2ReceiptRecoveryCapturePackage,
        ProtectedV2ReceiptRecoveryCapturePackage,
      ],
      incidentEvidenceFiles: await loadIncidentEvidence(authority),
    })
    if (afterSnapshot !== beforeSnapshot) {
      throw new Error('Recovery changed the original intent, captures, or incident evidence.')
    }
  }

  return {
    amendmentIdentitySha256: amendment.amendmentIdentitySha256,
    currentRecoveryToolBundleSha256: currentRecoveryToolBundle.aggregateSha256,
    migrationApplicationCallCount: 0,
    migrationStagingCallCount: 0,
    outcome,
    target: PROTECTED_V2_RECEIPT_RECOVERY_TARGET,
  }
}
