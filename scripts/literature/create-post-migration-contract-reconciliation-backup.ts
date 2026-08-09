import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { TextDecoder } from 'node:util'

import {
  assertExclusiveOutputPath,
  canonicalJson,
  defaultCommandRunner,
  sealCanonicalArtifacts,
  sha256,
  writeCanonicalPackage,
  type CommandRunner,
} from './gold-import-compensation-migration-operations'
import {
  POST_MIGRATION_RECONCILIATION_BRANCH,
  assertReadOnlyReconciliationRepositoryGuard,
  inspectReadOnlyReconciliationRepositoryState,
} from './gold-import-compensation-read-only-guard'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'

export const POST_MIGRATION_RECONCILIATION_BACKUP_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-backup/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_BACKUP_EXECUTION_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-backup-execution/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_TEST_BUILD_REPORT_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-test-build-report/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_MERGE_READINESS_REPORT_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-merge-readiness-report/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE =
  'CONTRACT STILL BLOCKED — UNRESOLVED DIFFERENCE' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const SAFE_COMPONENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const BACKUP_DIRECTORY_PREFIX = 'post-migration-contract-reconciliation-v1-' as const
const CONTRACT_DIAGNOSTIC_EXECUTION_SCHEMA_VERSION =
  'gold-import-compensation-contract-diagnostic-execution/1.0.0' as const
const COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION =
  'gold-import-existing-head-compatibility-audit-execution/1.0.0' as const
const LOCAL_DATABASE_CONTAINER = 'supabase_db_ip-literature-local' as const
const EXECUTION_COMPATIBILITY_BLOCKER_CODES = [
  'excluded_status_null_not_representable_by_import_contract_v1',
  'source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1',
  'source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1',
] as const
const REQUIRED_TERMINAL_BLOCKERS = [
  ...EXECUTION_COMPATIBILITY_BLOCKER_CODES,
  'incompatible_existing_head_fields',
] as const
const TERMINAL_ACTION_COUNTS = {
  incompatible: 630,
  initial: 0,
  inserts: 0,
  noops: 0,
  revisions: 0,
  total: 630,
  unresolved: 0,
} as const
const TERMINAL_EXECUTION_COUNTS = {
  excluded_status_null_not_representable_by_import_contract_v1: 272,
  source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1: 630,
  source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1: 50,
} as const
const REQUESTED_RECONCILIATION_NAME_DISCREPANCY = {
  aliasCreated: false,
  canonicalName: 'reconcile_literature_gold_review_operation_v1',
  classification: 'audit_expectation_defect',
  requestedName: 'reconcile_literature_gold_import_v1',
} as const
const REQUIRED_TEST_BUILD_CHECKS = [
  'completeRepositorySuite',
  'eslint',
  'focusedPostMigrationReconciliationTests',
  'gitDiffCheck',
  'importCompensationTests',
  'literatureTests',
  'migrationDatabaseContractTests',
  'operationalToolTests',
  'prettier',
  'productionBuild',
  'registryScopeCheck',
  'typeScript',
] as const

const HELP = `
Create the checksum-verified additive delivery backup for the post-migration reconciliation PR.

Usage:
  npm run literature:backup-post-migration-contract-reconciliation -- \
    --contract-diagnostic <directory> \
    --contract-diagnostic-manifest-sha256 <sha256> \
    --compatibility-audit <directory> \
    --compatibility-audit-manifest-sha256 <sha256> \
    --test-build-report <json> --merge-readiness-report <json> \
    --backup-root <existing-backup-root> \
    --output <post-migration-contract-reconciliation-v1-CURRENT_HEAD>

The command is file-only, requires a clean reviewed feature worktree, preserves every source byte,
and creates a new private directory with a sorted checksum manifest. Validation and merge-readiness
reports must bind the same HEAD and audit manifests while recording terminal state
${POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE}. It never contacts a database.
`.trim()

export interface PostMigrationReconciliationBackupDependencies {
  cwd?: string
  now?: () => Date
  runCommand?: CommandRunner
}

interface PreservedFile {
  gitMode?: string
  originalName: string
  sha256: string
  storedName: string
  text: string
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`)
}

function utf8(bytes: Buffer, label: string): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`${label} must be valid UTF-8.`)
  }
  if (!text.endsWith('\n') || text.endsWith('\n\n')) {
    throw new Error(`${label} must have exactly one final newline.`)
  }
  return text
}

function exactRecordKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const record = value as Record<string, unknown>
  const actual = Object.keys(record).sort()
  const wanted = [...expected].sort()
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${label} does not contain the exact allowed fields.`)
  }
  return record
}

async function readRegularFile(path: string, label: string): Promise<Buffer> {
  const absolutePath = resolve(path)
  const [stat, resolvedPath] = await Promise.all([lstat(absolutePath), realpath(absolutePath)])
  if (!stat.isFile() || stat.isSymbolicLink() || resolvedPath !== absolutePath) {
    throw new Error(`${label} must be a regular non-symlink file.`)
  }
  return readFile(absolutePath)
}

function parseCanonicalManifest(text: string): ReadonlyMap<string, string> {
  const entries = new Map<string, string>()
  let previousName = ''
  for (const line of text.trimEnd().split('\n')) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(line)
    if (!match) throw new Error('Source checksum manifest contains a malformed entry.')
    const [, checksum, name] = match
    if (!checksum || !name || entries.has(name) || name <= previousName) {
      throw new Error('Source checksum manifest contains a missing, duplicate, or unsorted entry.')
    }
    entries.set(name, checksum)
    previousName = name
  }
  if (entries.size === 0) throw new Error('Source checksum manifest is empty.')
  return entries
}

function assertTerminalSupplement(value: unknown, label: string): void {
  const supplement = exactRecordKeys(
    value,
    ['acceptedContentSha256', 'required', 'supplied', 'templateContentSha256'],
    `${label} supplement`,
  )
  if (
    supplement.required !== false ||
    supplement.supplied !== false ||
    supplement.acceptedContentSha256 !== null ||
    supplement.templateContentSha256 !== null
  ) {
    throw new Error(`${label} contradicts the terminal-4 no-supplement contract.`)
  }
}

function assertTerminalUnresolved(value: unknown, label: string): void {
  const unresolved = exactRecordKeys(value, ['count', 'pmids'], `${label} unresolved`)
  if (unresolved.count !== 0 || !Array.isArray(unresolved.pmids) || unresolved.pmids.length !== 0) {
    throw new Error(`${label} contradicts the terminal-4 zero-unresolved contract.`)
  }
}

function assertTerminalActionCounts(value: unknown, label: string): void {
  const counts = exactRecordKeys(
    value,
    ['incompatible', 'initial', 'inserts', 'noops', 'revisions', 'total', 'unresolved'],
    `${label} actionCounts`,
  )
  if (canonicalJson(counts) !== canonicalJson(TERMINAL_ACTION_COUNTS)) {
    throw new Error(`${label} does not contain the exact terminal-4 action counts.`)
  }
}

function assertExecutionIdentityList(
  value: unknown,
  expectedCount: number,
  label: string,
): ReadonlySet<string> {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error(`${label} does not contain the exact expected identity count.`)
  }
  const itemIds = new Set<string>()
  value.forEach((rawIdentity, index) => {
    const identity = exactRecordKeys(
      rawIdentity,
      ['datasetSplit', 'itemId', 'masterRowId', 'pmid'],
      `${label} identity ${index + 1}`,
    )
    if (
      identity.datasetSplit !== 'development' ||
      typeof identity.itemId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        identity.itemId,
      ) ||
      typeof identity.masterRowId !== 'string' ||
      !/^[1-9][0-9]*$/u.test(identity.masterRowId) ||
      typeof identity.pmid !== 'string' ||
      !/^[0-9]{1,12}$/u.test(identity.pmid) ||
      itemIds.has(identity.itemId)
    ) {
      throw new Error(`${label} contains a malformed or duplicate development identity.`)
    }
    itemIds.add(identity.itemId)
  })
  return itemIds
}

function assertTerminalExecutionCompatibility(value: unknown, label: string): void {
  const execution = exactRecordKeys(
    value,
    ['blockedRowCount', 'countsByCode', 'executableRowCount', 'identitiesByCode', 'totalRowCount'],
    `${label} executionCompatibility`,
  )
  const counts = exactRecordKeys(
    execution.countsByCode,
    EXECUTION_COMPATIBILITY_BLOCKER_CODES,
    `${label} executionCompatibility countsByCode`,
  )
  const identities = exactRecordKeys(
    execution.identitiesByCode,
    EXECUTION_COMPATIBILITY_BLOCKER_CODES,
    `${label} executionCompatibility identitiesByCode`,
  )
  if (
    execution.totalRowCount !== 630 ||
    execution.blockedRowCount !== 630 ||
    execution.executableRowCount !== 0 ||
    canonicalJson(counts) !== canonicalJson(TERMINAL_EXECUTION_COUNTS)
  ) {
    throw new Error(`${label} does not contain the exact terminal-4 execution counts.`)
  }
  const blindedIdentities = assertExecutionIdentityList(
    identities.source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1,
    TERMINAL_EXECUTION_COUNTS.source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1,
    `${label} blinding blockers`,
  )
  const excludedIdentities = assertExecutionIdentityList(
    identities.excluded_status_null_not_representable_by_import_contract_v1,
    TERMINAL_EXECUTION_COUNTS.excluded_status_null_not_representable_by_import_contract_v1,
    `${label} excluded-status blockers`,
  )
  const supplementalIdentities = assertExecutionIdentityList(
    identities.source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1,
    TERMINAL_EXECUTION_COUNTS.source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1,
    `${label} supplemental-metadata blockers`,
  )
  if (
    [...excludedIdentities].some((itemId) => !blindedIdentities.has(itemId)) ||
    [...supplementalIdentities].some((itemId) => !blindedIdentities.has(itemId))
  ) {
    throw new Error(`${label} execution blocker identity sets are internally inconsistent.`)
  }
}

function assertTerminalCompatibilityDetails(record: Record<string, unknown>, label: string): void {
  assertTerminalSupplement(record.supplement, label)
  assertTerminalUnresolved(record.unresolved, label)
  assertTerminalActionCounts(record.actionCounts, label)
  assertTerminalExecutionCompatibility(record.executionCompatibility, label)
}

export async function preserveAuditDirectory(input: {
  directory: string
  expectedManifestSha256: string
  expectedPostMigrationAuditManifestSha256?: string
  expectedRepositoryCommitSha: string
  prefix: 'compatibility-audit' | 'contract-diagnostic'
}): Promise<PreservedFile[]> {
  assertSha256(input.expectedManifestSha256, `${input.prefix} manifest SHA-256`)
  if (!/^[a-f0-9]{40}$/u.test(input.expectedRepositoryCommitSha)) {
    throw new Error(`${input.prefix} expected repository commit must be a 40-character SHA.`)
  }
  const directory = resolve(input.directory)
  const [stat, resolvedDirectory] = await Promise.all([lstat(directory), realpath(directory)])
  if (!stat.isDirectory() || stat.isSymbolicLink() || resolvedDirectory !== directory) {
    throw new Error(`${input.prefix} source must be a real non-symlink directory.`)
  }
  const names = (await readdir(directory)).sort((left, right) => left.localeCompare(right, 'en'))
  if (names.some((name) => !SAFE_COMPONENT_PATTERN.test(name))) {
    throw new Error(`${input.prefix} contains an unsafe filename.`)
  }
  const sourceFiles = await Promise.all(
    names.map(async (name) => {
      const bytes = await readRegularFile(resolve(directory, name), `${input.prefix}/${name}`)
      return { bytes, name, text: utf8(bytes, `${input.prefix}/${name}`) }
    }),
  )
  const manifestFile = sourceFiles.find(({ name }) => name === 'checksum-manifest.sha256')
  if (!manifestFile || sha256(manifestFile.bytes) !== input.expectedManifestSha256) {
    throw new Error(`${input.prefix} does not match its reviewed canonical manifest SHA-256.`)
  }
  const manifestEntries = parseCanonicalManifest(manifestFile.text)
  for (const [name, checksum] of manifestEntries) {
    const source = sourceFiles.find((file) => file.name === name)
    if (!source || sha256(source.bytes) !== checksum) {
      throw new Error(`${input.prefix} checksum mismatch for ${name}.`)
    }
  }
  const expectedNames = new Set([
    ...manifestEntries.keys(),
    'checksum-manifest.sha256',
    'execution-receipt.json',
  ])
  if (
    expectedNames.size !== sourceFiles.length ||
    sourceFiles.some(({ name }) => !expectedNames.has(name))
  ) {
    throw new Error(
      `${input.prefix} contains an unmanifested, missing, or unexpected source artifact.`,
    )
  }
  const receiptFile = sourceFiles.find(({ name }) => name === 'execution-receipt.json')
  let receipt: unknown
  try {
    receipt = JSON.parse(receiptFile?.text ?? '') as unknown
  } catch {
    throw new Error(`${input.prefix} execution receipt must be valid JSON.`)
  }
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    (receipt as Record<string, unknown>).canonicalManifestSha256 !== input.expectedManifestSha256 ||
    (receipt as Record<string, unknown>).repositoryCommitSha !==
      input.expectedRepositoryCommitSha ||
    canonicalJson(receipt) !== receiptFile?.text
  ) {
    throw new Error(
      `${input.prefix} execution receipt is not canonical or does not bind the reviewed manifest and repository commit.`,
    )
  }
  const receiptRecord = receipt as Record<string, unknown>
  if (input.prefix === 'contract-diagnostic') {
    exactRecordKeys(
      receiptRecord,
      [
        'canonicalManifestSha256',
        'compensationExecuted',
        'databaseContainer',
        'databaseMutationCount',
        'executedAt',
        'heldOutIdentitiesAccessed',
        'importExecuted',
        'mode',
        'outputDirectory',
        'preMigrationBackupDirectory',
        'preMigrationBackupManifestSha256',
        'remoteDatabaseAccessed',
        'repositoryCommitSha',
        'repositoryRoot',
        'requestedNameDiscrepancies',
        'schemaVersion',
      ],
      'contract-diagnostic execution receipt',
    )
    const auditFile = sourceFiles.find(({ name }) => name === 'migration-audit.json')
    const bracketFile = sourceFiles.find(({ name }) => name === 'read-only-state-bracket.json')
    let audit: unknown
    let bracket: unknown
    try {
      audit = JSON.parse(auditFile?.text ?? '') as unknown
      bracket = JSON.parse(bracketFile?.text ?? '') as unknown
    } catch {
      throw new Error('contract-diagnostic migration audit and state bracket must be valid JSON.')
    }
    const auditRecord =
      audit && typeof audit === 'object' && !Array.isArray(audit)
        ? (audit as Record<string, unknown>)
        : null
    const auditDatabase = auditRecord?.database
    const auditMigration = auditRecord?.migration
    const bracketRecord =
      bracket && typeof bracket === 'object' && !Array.isArray(bracket)
        ? (bracket as Record<string, unknown>)
        : null
    if (
      !auditFile ||
      !bracketFile ||
      canonicalJson(audit) !== auditFile.text ||
      canonicalJson(bracket) !== bracketFile.text ||
      auditRecord?.status !== 'ready' ||
      auditRecord.readinessStatus !== 'ready' ||
      auditRecord.result !== 'audit_ready_contract_compatibility_audit_required' ||
      !auditDatabase ||
      typeof auditDatabase !== 'object' ||
      Array.isArray(auditDatabase) ||
      (auditDatabase as Record<string, unknown>).repositoryCommitSha !==
        input.expectedRepositoryCommitSha ||
      !auditMigration ||
      typeof auditMigration !== 'object' ||
      Array.isArray(auditMigration) ||
      (auditMigration as Record<string, unknown>).ledgerOccurrences !== 1 ||
      !bracketRecord ||
      bracketRecord.preMigrationBackupManifestSha256 !==
        receiptRecord.preMigrationBackupManifestSha256 ||
      bracketRecord.snapshotsMatch !== true ||
      bracketRecord.contractStateHashesMatch !== true ||
      receiptRecord.schemaVersion !== CONTRACT_DIAGNOSTIC_EXECUTION_SCHEMA_VERSION ||
      receiptRecord.databaseContainer !== LOCAL_DATABASE_CONTAINER ||
      canonicalJson(receiptRecord.requestedNameDiscrepancies) !==
        canonicalJson([REQUESTED_RECONCILIATION_NAME_DISCREPANCY]) ||
      receiptRecord.mode !== 'read_only_diagnostic' ||
      receiptRecord.databaseMutationCount !== 0 ||
      receiptRecord.heldOutIdentitiesAccessed !== false ||
      receiptRecord.importExecuted !== false ||
      receiptRecord.compensationExecuted !== false ||
      receiptRecord.remoteDatabaseAccessed !== false
    ) {
      throw new Error(
        'contract-diagnostic canonical audit/receipt does not bind the exact commit and zero-mutation safety contract.',
      )
    }
  } else {
    exactRecordKeys(
      receiptRecord,
      [
        'canonicalArtifactCount',
        'canonicalManifestSha256',
        'executedAt',
        'kind',
        'mode',
        'outputDirectory',
        'packageReady',
        'repositoryCommitSha',
        'safety',
        'schemaVersion',
        'sources',
        'terminalState',
      ],
      'compatibility-audit execution receipt',
    )
    const upstreamManifest = input.expectedPostMigrationAuditManifestSha256
    if (!upstreamManifest) {
      throw new Error('compatibility-audit requires its source diagnostic manifest binding.')
    }
    assertSha256(upstreamManifest, 'compatibility-audit source diagnostic manifest SHA-256')
    const compatibilityFile = sourceFiles.find(
      ({ name }) => name === 'existing-head-compatibility-audit.json',
    )
    const readinessFile = sourceFiles.find(({ name }) => name === 'package-readiness.json')
    let compatibility: unknown
    let readiness: unknown
    try {
      compatibility = JSON.parse(compatibilityFile?.text ?? '') as unknown
      readiness = JSON.parse(readinessFile?.text ?? '') as unknown
    } catch {
      throw new Error('compatibility-audit canonical report and readiness must be valid JSON.')
    }
    const compatibilityRecord =
      compatibility && typeof compatibility === 'object' && !Array.isArray(compatibility)
        ? (compatibility as Record<string, unknown>)
        : null
    const readinessRecord =
      readiness && typeof readiness === 'object' && !Array.isArray(readiness)
        ? (readiness as Record<string, unknown>)
        : null
    if (!compatibilityRecord || !readinessRecord) {
      throw new Error('compatibility-audit canonical report and readiness must be JSON objects.')
    }
    assertTerminalCompatibilityDetails(compatibilityRecord, 'compatibility-audit report')
    assertTerminalCompatibilityDetails(readinessRecord, 'compatibility-audit readiness')
    for (const field of ['actionCounts', 'executionCompatibility', 'supplement', 'unresolved']) {
      if (canonicalJson(compatibilityRecord[field]) !== canonicalJson(readinessRecord[field])) {
        throw new Error(`compatibility-audit report/readiness ${field} values disagree.`)
      }
    }
    if (canonicalJson(readinessRecord.blockers) !== canonicalJson(REQUIRED_TERMINAL_BLOCKERS)) {
      throw new Error(
        'compatibility-audit readiness does not contain the exact four terminal-4 blockers.',
      )
    }
    const sourceBindings = compatibilityRecord?.sourceBindings
    const canonicalSafety = compatibilityRecord?.safety
    const receiptSources = receiptRecord.sources
    const receiptSafety = receiptRecord.safety
    exactRecordKeys(
      receiptSources,
      [
        'artifactPath',
        'auditPath',
        'compatibilitySupplementContentSha256',
        'compatibilitySupplementFileSha256',
        'finalV3ArtifactSha256',
        'postMigrationAuditManifestSha256',
      ],
      'compatibility-audit receipt sources',
    )
    exactRecordKeys(
      receiptSafety,
      [
        'compensationExecuted',
        'databaseMutationCount',
        'databaseQueriesExecuted',
        'heldOutIdentitiesAccessed',
        'importExecuted',
        'remoteDatabaseAccessed',
        'sourceArtifactBytesPreserved',
        'sourceArtifactWritten',
      ],
      'compatibility-audit receipt safety',
    )
    if (
      !compatibilityFile ||
      !readinessFile ||
      canonicalJson(compatibility) !== compatibilityFile.text ||
      canonicalJson(readiness) !== readinessFile.text ||
      compatibilityRecord?.contractAuditReady !== true ||
      compatibilityRecord.status !== 'blocked' ||
      compatibilityRecord.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE ||
      compatibilityRecord.packageGenerationAllowed !== false ||
      !readinessRecord ||
      readinessRecord.readiness !== 'blocked' ||
      readinessRecord.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE ||
      readinessRecord.packageGenerationAllowed !== false ||
      !sourceBindings ||
      typeof sourceBindings !== 'object' ||
      Array.isArray(sourceBindings) ||
      (sourceBindings as Record<string, unknown>).postMigrationAuditManifestSha256 !==
        upstreamManifest ||
      !canonicalSafety ||
      typeof canonicalSafety !== 'object' ||
      Array.isArray(canonicalSafety) ||
      (canonicalSafety as Record<string, unknown>).databaseMutationCount !== 0 ||
      (canonicalSafety as Record<string, unknown>).databaseQueriesExecuted !== 0 ||
      (canonicalSafety as Record<string, unknown>).heldOutIdentitiesAccessed !== false ||
      (canonicalSafety as Record<string, unknown>).importExecuted !== false ||
      (canonicalSafety as Record<string, unknown>).compensationExecuted !== false ||
      (canonicalSafety as Record<string, unknown>).remoteDatabaseAccessed !== false ||
      receiptRecord.schemaVersion !== COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION ||
      receiptRecord.kind !== 'existing_head_compatibility_file_only_audit' ||
      receiptRecord.mode !== 'file_only_read_only' ||
      receiptRecord.canonicalArtifactCount !== manifestEntries.size ||
      receiptRecord.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE ||
      receiptRecord.packageReady !== false ||
      !receiptSources ||
      typeof receiptSources !== 'object' ||
      Array.isArray(receiptSources) ||
      (receiptSources as Record<string, unknown>).postMigrationAuditManifestSha256 !==
        upstreamManifest ||
      (receiptSources as Record<string, unknown>).compatibilitySupplementFileSha256 !== null ||
      (receiptSources as Record<string, unknown>).compatibilitySupplementContentSha256 !== null ||
      !receiptSafety ||
      typeof receiptSafety !== 'object' ||
      Array.isArray(receiptSafety) ||
      (receiptSafety as Record<string, unknown>).databaseMutationCount !== 0 ||
      (receiptSafety as Record<string, unknown>).databaseQueriesExecuted !== 0 ||
      (receiptSafety as Record<string, unknown>).heldOutIdentitiesAccessed !== false ||
      (receiptSafety as Record<string, unknown>).importExecuted !== false ||
      (receiptSafety as Record<string, unknown>).compensationExecuted !== false ||
      (receiptSafety as Record<string, unknown>).remoteDatabaseAccessed !== false
    ) {
      throw new Error(
        'compatibility-audit does not bind the exact diagnostic manifest or zero-mutation safety contract.',
      )
    }
  }
  return sourceFiles.map(({ bytes, name, text }) => ({
    originalName: name,
    sha256: sha256(bytes),
    storedName: `${input.prefix}--${name}`,
    text,
  }))
}

export async function canonicalReport(
  path: string,
  label: string,
): Promise<{
  parsed: unknown
  sha256: string
  text: string
}> {
  const bytes = await readRegularFile(path, label)
  let parsed: unknown
  try {
    parsed = JSON.parse(utf8(bytes, label)) as unknown
  } catch (error) {
    throw new Error(
      `${label} must be JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const canonical = canonicalJson(parsed)
  if (canonical !== bytes.toString('utf8')) {
    throw new Error(`${label} must already use the canonical JSON byte representation.`)
  }
  return { parsed, sha256: sha256(bytes), text: canonical }
}

interface FinalReportBindings {
  compatibilityAuditManifestSha256: string
  contractDiagnosticManifestSha256: string
  repositoryCommitSha: string
}

function assertZeroMutationSafety(value: unknown, label: string): void {
  const safety = exactRecordKeys(
    value,
    [
      'compensationExecuted',
      'databaseMutationCount',
      'heldOutIdentitiesAccessed',
      'importExecuted',
      'remoteDatabaseAccessed',
    ],
    label,
  )
  if (
    safety.compensationExecuted !== false ||
    safety.databaseMutationCount !== 0 ||
    safety.heldOutIdentitiesAccessed !== false ||
    safety.importExecuted !== false ||
    safety.remoteDatabaseAccessed !== false
  ) {
    throw new Error(`${label} does not attest the exact zero-mutation safety state.`)
  }
}

function assertFinalReportBindings(
  value: unknown,
  expected: FinalReportBindings,
  label: string,
): void {
  const bindings = exactRecordKeys(
    value,
    ['compatibilityAuditManifestSha256', 'contractDiagnosticManifestSha256', 'repositoryCommitSha'],
    `${label} bindings`,
  )
  if (
    bindings.repositoryCommitSha !== expected.repositoryCommitSha ||
    bindings.contractDiagnosticManifestSha256 !== expected.contractDiagnosticManifestSha256 ||
    bindings.compatibilityAuditManifestSha256 !== expected.compatibilityAuditManifestSha256
  ) {
    throw new Error(`${label} does not bind the exact HEAD and reviewed audit manifests.`)
  }
}

export async function strictTestBuildReport(
  path: string,
  expected: FinalReportBindings,
): Promise<{ sha256: string; text: string }> {
  const report = await canonicalReport(path, 'test/build report')
  const record = exactRecordKeys(
    report.parsed,
    ['bindings', 'checks', 'safety', 'schemaVersion', 'status', 'terminalState'],
    'test/build report',
  )
  if (
    record.schemaVersion !== POST_MIGRATION_RECONCILIATION_TEST_BUILD_REPORT_SCHEMA_VERSION ||
    record.status !== 'passed' ||
    record.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE
  ) {
    throw new Error('Test/build report does not attest a passing terminal-4 validation run.')
  }
  assertFinalReportBindings(record.bindings, expected, 'Test/build report')
  if (!Array.isArray(record.checks) || record.checks.length !== REQUIRED_TEST_BUILD_CHECKS.length) {
    throw new Error('Test/build report must contain the exact ordered validation check set.')
  }
  record.checks.forEach((rawCheck, index) => {
    const check = exactRecordKeys(
      rawCheck,
      ['command', 'exitCode', 'id', 'result'],
      `test/build report check ${index + 1}`,
    )
    if (
      check.id !== REQUIRED_TEST_BUILD_CHECKS[index] ||
      typeof check.command !== 'string' ||
      check.command.trim() !== check.command ||
      check.command.length === 0 ||
      check.command.includes('\n') ||
      check.exitCode !== 0 ||
      check.result !== 'passed'
    ) {
      throw new Error(
        `Test/build report check ${index + 1} must preserve its exact command and passing result.`,
      )
    }
  })
  assertZeroMutationSafety(record.safety, 'test/build report safety')
  return { sha256: report.sha256, text: report.text }
}

export async function strictMergeReadinessReport(
  path: string,
  expected: FinalReportBindings,
): Promise<{ sha256: string; text: string }> {
  const report = await canonicalReport(path, 'merge-readiness report')
  const record = exactRecordKeys(
    report.parsed,
    [
      'bindings',
      'blockers',
      'codeReview',
      'importExecution',
      'safety',
      'schemaVersion',
      'terminalState',
    ],
    'merge-readiness report',
  )
  const codeReview = exactRecordKeys(
    record.codeReview,
    [
      'mergeAuthorized',
      'originMainIsAncestor',
      'pullRequestDraft',
      'readiness',
      'trackedWorktreeClean',
    ],
    'merge-readiness report codeReview',
  )
  const importExecution = exactRecordKeys(
    record.importExecution,
    [
      'compensationExecuted',
      'importExecuted',
      'packageGenerated',
      'packageGenerationAllowed',
      'readiness',
    ],
    'merge-readiness report importExecution',
  )
  if (
    record.schemaVersion !== POST_MIGRATION_RECONCILIATION_MERGE_READINESS_REPORT_SCHEMA_VERSION ||
    record.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE ||
    codeReview.readiness !== 'ready_for_draft_review' ||
    codeReview.pullRequestDraft !== true ||
    codeReview.trackedWorktreeClean !== true ||
    codeReview.originMainIsAncestor !== true ||
    codeReview.mergeAuthorized !== false ||
    importExecution.readiness !== 'blocked_unresolved_contract' ||
    importExecution.packageGenerationAllowed !== false ||
    importExecution.packageGenerated !== false ||
    importExecution.importExecuted !== false ||
    importExecution.compensationExecuted !== false
  ) {
    throw new Error(
      'Merge-readiness report must separate ready draft code review from blocked import execution.',
    )
  }
  if (canonicalJson(record.blockers) !== canonicalJson(REQUIRED_TERMINAL_BLOCKERS)) {
    throw new Error('Merge-readiness report does not contain the exact terminal-4 blockers.')
  }
  assertFinalReportBindings(record.bindings, expected, 'Merge-readiness report')
  assertZeroMutationSafety(record.safety, 'merge-readiness report safety')
  return { sha256: report.sha256, text: report.text }
}

export async function preserveChangedTrackedFiles(input: {
  cwd: string
  head: string
  originMain: string
  runCommand: CommandRunner
}): Promise<PreservedFile[]> {
  const changed = await input.runCommand(
    'git',
    ['diff', '--name-only', '--diff-filter=AM', `${input.originMain}...${input.head}`, '--'],
    { cwd: input.cwd },
  )
  const removed = await input.runCommand(
    'git',
    ['diff', '--name-only', '--diff-filter=DR', `${input.originMain}...${input.head}`, '--'],
    { cwd: input.cwd },
  )
  if (removed.stdout.trim()) {
    throw new Error('Backup requires explicit handling for deleted or renamed tracked files.')
  }
  const paths = changed.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'))
  if (paths.length === 0 || new Set(paths).size !== paths.length) {
    throw new Error('No unique changed tracked files were found for the reconciliation commit.')
  }
  const preserved = await Promise.all(
    paths.map(async (path) => {
      if (path.startsWith('/') || path.split('/').some((component) => component === '..')) {
        throw new Error(`Changed tracked path is unsafe: ${path}.`)
      }
      const bytes = await readRegularFile(resolve(input.cwd, path), `changed tracked file ${path}`)
      const modeResult = await input.runCommand('git', ['ls-tree', input.head, '--', path], {
        cwd: input.cwd,
      })
      const gitObject = /^(100644|100755) blob ([a-f0-9]{40})\t/u.exec(modeResult.stdout)
      const mode = gitObject?.[1]
      const blobOid = gitObject?.[2]
      if (!mode || !blobOid) {
        throw new Error(`Changed tracked file has an unsupported Git object: ${path}.`)
      }
      const workingTreeBlobOid = createHash('sha1')
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest('hex')
      if (workingTreeBlobOid !== blobOid) {
        throw new Error(`Changed tracked file does not match exact commit ${input.head}: ${path}.`)
      }
      const storedName = `tracked--${sha256(path).slice(0, 16)}--${basename(path)}`
      if (!SAFE_COMPONENT_PATTERN.test(storedName)) {
        throw new Error(`Changed tracked backup name is unsafe: ${storedName}.`)
      }
      return {
        gitMode: mode,
        originalName: path,
        sha256: sha256(bytes),
        storedName,
        text: utf8(bytes, `changed tracked file ${path}`),
      }
    }),
  )
  if (new Set(preserved.map(({ storedName }) => storedName)).size !== preserved.length) {
    throw new Error('Changed tracked backup filenames collided.')
  }
  return preserved
}

export async function runCreatePostMigrationContractReconciliationBackup(
  argv: readonly string[],
  dependencies: PostMigrationReconciliationBackupDependencies = {},
) {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, [
    'backup-root',
    'commit',
    'compatibility-audit',
    'compatibility-audit-manifest-sha256',
    'contract-diagnostic',
    'contract-diagnostic-manifest-sha256',
    'help',
    'merge-readiness-report',
    'output',
    'test-build-report',
  ])
  if (hasFlag(arguments_, 'help')) return { help: HELP }
  if (hasFlag(arguments_, 'commit') || arguments_.values.has('commit')) {
    throw new Error('The additive backup command has no commit or database-write mode.')
  }

  const cwd = resolve(dependencies.cwd ?? process.cwd())
  const runCommand = dependencies.runCommand ?? defaultCommandRunner
  const repository = await inspectReadOnlyReconciliationRepositoryState(cwd, runCommand)
  assertReadOnlyReconciliationRepositoryGuard(repository)
  if (repository.branch !== POST_MIGRATION_RECONCILIATION_BRANCH) {
    throw new Error('Backup branch does not match the reconciliation branch.')
  }
  const contractDiagnosticManifestSha256 = requiredArgument(
    arguments_,
    'contract-diagnostic-manifest-sha256',
  )
  const compatibilityAuditManifestSha256 = requiredArgument(
    arguments_,
    'compatibility-audit-manifest-sha256',
  )
  assertSha256(contractDiagnosticManifestSha256, 'contract-diagnostic manifest SHA-256')
  assertSha256(compatibilityAuditManifestSha256, 'compatibility-audit manifest SHA-256')
  const finalReportBindings: FinalReportBindings = {
    compatibilityAuditManifestSha256,
    contractDiagnosticManifestSha256,
    repositoryCommitSha: repository.head,
  }
  const rawBackupRoot = requiredArgument(arguments_, 'backup-root')
  const rawOutput = requiredArgument(arguments_, 'output')
  const outputDirectory = await assertExclusiveOutputPath({
    backupRoot: rawBackupRoot,
    cwd,
    output: rawOutput,
  })
  if (basename(outputDirectory) !== `${BACKUP_DIRECTORY_PREFIX}${repository.head}`) {
    throw new Error('Backup output directory must end with the exact current 40-character HEAD.')
  }

  const [diagnosticFiles, compatibilityFiles, trackedFiles, validation, mergeReadiness] =
    await Promise.all([
      preserveAuditDirectory({
        directory: requiredArgument(arguments_, 'contract-diagnostic'),
        expectedManifestSha256: contractDiagnosticManifestSha256,
        expectedRepositoryCommitSha: repository.head,
        prefix: 'contract-diagnostic',
      }),
      preserveAuditDirectory({
        directory: requiredArgument(arguments_, 'compatibility-audit'),
        expectedManifestSha256: compatibilityAuditManifestSha256,
        expectedPostMigrationAuditManifestSha256: contractDiagnosticManifestSha256,
        expectedRepositoryCommitSha: repository.head,
        prefix: 'compatibility-audit',
      }),
      preserveChangedTrackedFiles({
        cwd,
        head: repository.head,
        originMain: repository.originMain,
        runCommand,
      }),
      strictTestBuildReport(requiredArgument(arguments_, 'test-build-report'), finalReportBindings),
      strictMergeReadinessReport(
        requiredArgument(arguments_, 'merge-readiness-report'),
        finalReportBindings,
      ),
    ])
  const repositoryAfterRead = await inspectReadOnlyReconciliationRepositoryState(cwd, runCommand)
  assertReadOnlyReconciliationRepositoryGuard(repositoryAfterRead)
  if (
    repositoryAfterRead.head !== repository.head ||
    repositoryAfterRead.originMain !== repository.originMain
  ) {
    throw new Error('Repository identity changed while the additive backup inputs were read.')
  }
  const allPreserved = [...trackedFiles, ...diagnosticFiles, ...compatibilityFiles]
  if (new Set(allPreserved.map(({ storedName }) => storedName)).size !== allPreserved.length) {
    throw new Error('Backup artifact names collided.')
  }
  const index = {
    schemaVersion: POST_MIGRATION_RECONCILIATION_BACKUP_SCHEMA_VERSION,
    repository: {
      branch: repository.branch,
      commitSha: repository.head,
      originMainSha: repository.originMain,
    },
    sources: {
      changedTrackedFiles: trackedFiles.map(({ gitMode, originalName, sha256, storedName }) => ({
        gitMode,
        originalName,
        sha256,
        storedName,
      })),
      compatibilityAudit: compatibilityFiles.map(({ originalName, sha256, storedName }) => ({
        originalName,
        sha256,
        storedName,
      })),
      contractDiagnostic: diagnosticFiles.map(({ originalName, sha256, storedName }) => ({
        originalName,
        sha256,
        storedName,
      })),
      mergeReadinessSourceSha256: mergeReadiness.sha256,
      testBuildSourceSha256: validation.sha256,
      contractDiagnosticManifestSha256,
      compatibilityAuditManifestSha256,
    },
    terminalState: POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE,
    safety: {
      additiveBackup: true,
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  }
  const files = new Map<string, string>(
    allPreserved.map(({ storedName, text }) => [storedName, text]),
  )
  files.set('backup-index.json', canonicalJson(index))
  files.set('merge-readiness-report.json', mergeReadiness.text)
  files.set('test-build-report.json', validation.text)
  const artifacts = sealCanonicalArtifacts(files)
  await writeCanonicalPackage({
    artifacts,
    outputDirectory,
    outputRoot: resolve(cwd, rawBackupRoot),
    executionReceipt: {
      schemaVersion: POST_MIGRATION_RECONCILIATION_BACKUP_EXECUTION_SCHEMA_VERSION,
      executedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      repositoryRoot: cwd,
      repositoryCommitSha: repository.head,
      outputDirectory,
      canonicalManifestSha256: artifacts.manifestSha256,
      preservedFileCount: files.size,
      mode: 'file_only_additive_backup',
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  })
  return {
    outputDirectory,
    manifestSha256: artifacts.manifestSha256,
    repositoryCommitSha: repository.head,
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runCreatePostMigrationContractReconciliationBackup(process.argv.slice(2))
    .then((result) => {
      if ('help' in result) {
        console.log(result.help)
        return
      }
      console.log(`${JSON.stringify(result, null, 2)}\n`)
      console.log('Database access: 0; mutations: 0; held-out identities: 0; remote access: 0')
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
