import { canonicalJson, sha256 } from './gold-import-compensation-migration-operations'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
  PROTECTED_V2_AUTHORIZED_CAPABILITY,
  PROTECTED_V2_CONFIRMATION,
  type ProtectedMigrationLedgerEntry,
  type ProtectedV2BackupBinding,
  type ProtectedV2OperatorAuthorization,
} from './protected-gold-import-contract-v2'

export const PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-execution/2.0.0' as const
export const PROTECTED_V2_BACKUP_INSTANCE_IDENTITY_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-instance/1.0.0' as const
export const PROTECTED_V2_BACKUP_INSTANCE_WITNESS_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-instance-witness/1.0.0' as const
export const PROTECTED_V2_BACKUP_INSTANCE_WITNESS_DIRECTORY =
  '.protected-v2-backup-instance-witnesses' as const
export const PROTECTED_V2_APPLICATION_INTENT_SCHEMA_VERSION =
  'literature-gold-protected-v2-application-intent/1.0.0' as const
export const PROTECTED_V2_POST_APPLICATION_AUDIT_SCHEMA_VERSION =
  'literature-gold-protected-v2-post-application-audit/1.0.0' as const
export const PROTECTED_V2_APPLICATION_RESULT_SCHEMA_VERSION =
  'literature-gold-protected-v2-application-result/1.0.0' as const
export const PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION =
  'literature-gold-protected-v2-migration-application-execution/2.0.0' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const NONCE_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  const actual = Object.keys(value).sort()
  const normalizedExpected = [...expected].sort()
  if (canonicalJson(actual) !== canonicalJson(normalizedExpected)) {
    throw new Error(`${label} has unexpected or missing keys.`)
  }
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a nonempty string.`)
  return value
}

function requiredSha256(value: unknown, label: string) {
  const result = requiredString(value, label)
  if (!SHA256_PATTERN.test(result)) throw new Error(`${label} must be a lowercase SHA-256.`)
  return result
}

function requiredTimestamp(value: unknown, label: string) {
  const result = requiredString(value, label)
  if (Number.isNaN(Date.parse(result))) throw new Error(`${label} must be an ISO timestamp.`)
  return result
}

function parseCanonicalJson(bytes: string, label: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes) as unknown
  } catch (error) {
    throw new Error(
      `${label} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
  if (canonicalJson(parsed) !== bytes) throw new Error(`${label} bytes are not canonical JSON.`)
  return record(parsed, label)
}

export interface ProtectedV2RepositoryEvidence {
  branch: 'main'
  head: string
  originMain: string
  statusCleanIncludingUntracked: true
}

export interface ProtectedV2DatabaseEvidence {
  actionCount: number
  batchId: string
  compensationCount: number
  developmentMembershipSha256: string
  developmentPlanningStateSha256: string
  effectiveStateSha256: string
  importCount: number
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[]
  physicalStateSha256: string
  pointerStateSha256: string
  readOnlyBracketMatches: true
  revealStateSha256: string
  reviewStateSha256: string
  v1Occurrence: number
  v2Occurrence: number
}

export interface ProtectedV2BackupInstanceProjection {
  backupRoot: string
  canonicalManifestSha256: string
  database: {
    batchId: string
    datasetSplit: 'development'
    developmentMembershipSha256: string
    developmentPlanningStateSha256: string
    effectiveStateSha256: string
    physicalStateSha256: string
  }
  executedAt: string
  executionNonce: string
  migrationLedger: {
    sha256: string
    v1: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V1 & { occurrence: 1 }
    v2: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2 & { occurrence: 0 }
  }
  outputDirectory: string
  repositoryCommitSha: string
  safety: {
    databaseMutationCount: 0
    heldOutIdentitiesAccessed: false
    remoteDatabaseAccessed: false
  }
  schemaVersion: typeof PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION
}

export interface ProtectedV2BackupExecutionReceipt extends ProtectedV2BackupInstanceProjection {
  backupInstanceId: string
  contentSha256: string
}

export function buildProtectedV2BackupExecutionReceipt(
  input: ProtectedV2BackupInstanceProjection,
): ProtectedV2BackupExecutionReceipt {
  if (
    input.schemaVersion !== PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION ||
    input.database.datasetSplit !== 'development' ||
    input.migrationLedger.v1.occurrence !== 1 ||
    input.migrationLedger.v2.occurrence !== 0
  ) {
    throw new Error('Protected V2 backup instance projection is malformed.')
  }
  if (
    canonicalJson({
      filename: input.migrationLedger.v1.filename,
      migrationName: input.migrationLedger.v1.migrationName,
      sha256: input.migrationLedger.v1.sha256,
      version: input.migrationLedger.v1.version,
    }) !== canonicalJson(PROTECTED_GOLD_IMPORT_CONTRACT_V1) ||
    canonicalJson({
      filename: input.migrationLedger.v2.filename,
      id: input.migrationLedger.v2.id,
      migrationName: input.migrationLedger.v2.migrationName,
      sha256: input.migrationLedger.v2.sha256,
      version: input.migrationLedger.v2.version,
    }) !== canonicalJson(PROTECTED_GOLD_IMPORT_CONTRACT_V2)
  ) {
    throw new Error('Protected V2 backup migration identity drifted.')
  }
  requiredTimestamp(input.executedAt, 'backup executedAt')
  if (!NONCE_PATTERN.test(input.executionNonce)) {
    throw new Error('Protected V2 backup execution nonce must be 32 random bytes in hex.')
  }
  if (!COMMIT_PATTERN.test(input.repositoryCommitSha)) {
    throw new Error('Protected V2 backup repository commit is malformed.')
  }
  for (const [label, value] of Object.entries({
    canonicalManifestSha256: input.canonicalManifestSha256,
    developmentMembershipSha256: input.database.developmentMembershipSha256,
    developmentPlanningStateSha256: input.database.developmentPlanningStateSha256,
    effectiveStateSha256: input.database.effectiveStateSha256,
    migrationLedgerSha256: input.migrationLedger.sha256,
    physicalStateSha256: input.database.physicalStateSha256,
  })) {
    requiredSha256(value, label)
  }
  if (
    !input.backupRoot ||
    !input.outputDirectory ||
    input.safety.databaseMutationCount !== 0 ||
    input.safety.heldOutIdentitiesAccessed !== false ||
    input.safety.remoteDatabaseAccessed !== false
  ) {
    throw new Error('Protected V2 backup instance projection is unsafe.')
  }
  const identityProjection = {
    identitySchemaVersion: PROTECTED_V2_BACKUP_INSTANCE_IDENTITY_SCHEMA_VERSION,
    ...input,
  }
  const backupInstanceId = sha256(canonicalJson(identityProjection))
  const content = { ...input, backupInstanceId }
  return { ...content, contentSha256: sha256(canonicalJson(content)) }
}

export function parseProtectedV2BackupExecutionReceipt(
  bytes: string,
): ProtectedV2BackupExecutionReceipt {
  const parsed = parseCanonicalJson(bytes, 'Protected V2 backup execution receipt')
  exactKeys(
    parsed,
    [
      'backupInstanceId',
      'backupRoot',
      'canonicalManifestSha256',
      'contentSha256',
      'database',
      'executedAt',
      'executionNonce',
      'migrationLedger',
      'outputDirectory',
      'repositoryCommitSha',
      'safety',
      'schemaVersion',
    ],
    'Protected V2 backup execution receipt',
  )
  const database = record(parsed.database, 'backup receipt database')
  const migrationLedger = record(parsed.migrationLedger, 'backup receipt migrationLedger')
  const v1 = record(migrationLedger.v1, 'backup receipt migrationLedger.v1')
  const v2 = record(migrationLedger.v2, 'backup receipt migrationLedger.v2')
  const safety = record(parsed.safety, 'backup receipt safety')
  exactKeys(
    database,
    [
      'batchId',
      'datasetSplit',
      'developmentMembershipSha256',
      'developmentPlanningStateSha256',
      'effectiveStateSha256',
      'physicalStateSha256',
    ],
    'backup receipt database',
  )
  exactKeys(migrationLedger, ['sha256', 'v1', 'v2'], 'backup receipt migrationLedger')
  exactKeys(
    v1,
    [...Object.keys(PROTECTED_GOLD_IMPORT_CONTRACT_V1), 'occurrence'],
    'backup receipt V1',
  )
  exactKeys(
    v2,
    [...Object.keys(PROTECTED_GOLD_IMPORT_CONTRACT_V2), 'occurrence'],
    'backup receipt V2',
  )
  exactKeys(
    safety,
    ['databaseMutationCount', 'heldOutIdentitiesAccessed', 'remoteDatabaseAccessed'],
    'backup receipt safety',
  )
  const { backupInstanceId, contentSha256, ...projection } = parsed
  const rebuilt = buildProtectedV2BackupExecutionReceipt(
    projection as unknown as ProtectedV2BackupInstanceProjection,
  )
  if (
    rebuilt.backupInstanceId !== backupInstanceId ||
    rebuilt.contentSha256 !== contentSha256 ||
    canonicalJson(rebuilt) !== bytes
  ) {
    throw new Error('Protected V2 backup instance identity or receipt checksum is invalid.')
  }
  return rebuilt
}

export interface ProtectedV2BackupInstanceWitness {
  backupInstanceId: string
  backupRoot: string
  contentSha256: string
  executedAt: string
  executionReceiptSha256: string
  outputDirectory: string
  repositoryCommitSha: string
  schemaVersion: typeof PROTECTED_V2_BACKUP_INSTANCE_WITNESS_SCHEMA_VERSION
}

export function buildProtectedV2BackupInstanceWitness(
  receipt: ProtectedV2BackupExecutionReceipt,
  executionReceiptSha256: string,
): ProtectedV2BackupInstanceWitness {
  requiredSha256(executionReceiptSha256, 'backup witness execution receipt')
  const content = {
    backupInstanceId: receipt.backupInstanceId,
    backupRoot: receipt.backupRoot,
    executedAt: receipt.executedAt,
    executionReceiptSha256,
    outputDirectory: receipt.outputDirectory,
    repositoryCommitSha: receipt.repositoryCommitSha,
    schemaVersion: PROTECTED_V2_BACKUP_INSTANCE_WITNESS_SCHEMA_VERSION,
  } as const
  return { ...content, contentSha256: sha256(canonicalJson(content)) }
}

export function parseProtectedV2BackupInstanceWitness(
  bytes: string,
): ProtectedV2BackupInstanceWitness {
  const parsed = parseCanonicalJson(bytes, 'Protected V2 backup instance witness')
  exactKeys(
    parsed,
    [
      'backupInstanceId',
      'backupRoot',
      'contentSha256',
      'executedAt',
      'executionReceiptSha256',
      'outputDirectory',
      'repositoryCommitSha',
      'schemaVersion',
    ],
    'Protected V2 backup instance witness',
  )
  const { contentSha256, ...content } = parsed
  if (
    parsed.schemaVersion !== PROTECTED_V2_BACKUP_INSTANCE_WITNESS_SCHEMA_VERSION ||
    requiredSha256(parsed.backupInstanceId, 'witness backupInstanceId') !==
      parsed.backupInstanceId ||
    requiredSha256(parsed.executionReceiptSha256, 'witness executionReceiptSha256') !==
      parsed.executionReceiptSha256 ||
    sha256(canonicalJson(content)) !== contentSha256
  ) {
    throw new Error('Protected V2 backup instance witness is invalid.')
  }
  return parsed as unknown as ProtectedV2BackupInstanceWitness
}

export interface ProtectedV2ApplicationIntent {
  authorization: ProtectedV2OperatorAuthorization
  authorizationSha256: string
  authorizedCapability: typeof PROTECTED_V2_AUTHORIZED_CAPABILITY
  backupInstances: readonly [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  before: ProtectedV2DatabaseEvidence
  confirmation: typeof PROTECTED_V2_CONFIRMATION
  createdAt: string
  migration: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2
  operator: string
  outputDirectory: string
  repository: ProtectedV2RepositoryEvidence
  safety: {
    compensationAuthorized: false
    finalReceiptComplete: false
    heldOutIdentitiesAccessed: false
    importAuthorized: false
    migrationApplied: false
    remoteDatabaseAccessed: false
  }
  schemaVersion: typeof PROTECTED_V2_APPLICATION_INTENT_SCHEMA_VERSION
  state: 'application_intent_sealed'
}

export function buildProtectedV2ApplicationIntent(input: {
  authorization: ProtectedV2OperatorAuthorization
  before: ProtectedV2DatabaseEvidence
  outputDirectory: string
  repository: ProtectedV2RepositoryEvidence
}): ProtectedV2ApplicationIntent {
  return {
    authorization: input.authorization,
    authorizationSha256: input.authorization.contentSha256,
    authorizedCapability: PROTECTED_V2_AUTHORIZED_CAPABILITY,
    backupInstances: input.authorization.context.backups,
    before: input.before,
    confirmation: PROTECTED_V2_CONFIRMATION,
    createdAt: input.authorization.requestedAt,
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    operator: input.authorization.operator,
    outputDirectory: input.outputDirectory,
    repository: input.repository,
    safety: {
      compensationAuthorized: false,
      finalReceiptComplete: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      migrationApplied: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: PROTECTED_V2_APPLICATION_INTENT_SCHEMA_VERSION,
    state: 'application_intent_sealed',
  }
}

export function parseProtectedV2ApplicationIntent(bytes: string): ProtectedV2ApplicationIntent {
  const parsed = parseCanonicalJson(bytes, 'Protected V2 application intent')
  exactKeys(
    parsed,
    [
      'authorization',
      'authorizationSha256',
      'authorizedCapability',
      'backupInstances',
      'before',
      'confirmation',
      'createdAt',
      'migration',
      'operator',
      'outputDirectory',
      'repository',
      'safety',
      'schemaVersion',
      'state',
    ],
    'Protected V2 application intent',
  )
  const safety = record(parsed.safety, 'application intent safety')
  exactKeys(
    safety,
    [
      'compensationAuthorized',
      'finalReceiptComplete',
      'heldOutIdentitiesAccessed',
      'importAuthorized',
      'migrationApplied',
      'remoteDatabaseAccessed',
    ],
    'application intent safety',
  )
  if (
    parsed.schemaVersion !== PROTECTED_V2_APPLICATION_INTENT_SCHEMA_VERSION ||
    parsed.state !== 'application_intent_sealed' ||
    parsed.authorizedCapability !== PROTECTED_V2_AUTHORIZED_CAPABILITY ||
    parsed.confirmation !== PROTECTED_V2_CONFIRMATION ||
    canonicalJson(parsed.migration) !== canonicalJson(PROTECTED_GOLD_IMPORT_CONTRACT_V2) ||
    safety.compensationAuthorized !== false ||
    safety.finalReceiptComplete !== false ||
    safety.heldOutIdentitiesAccessed !== false ||
    safety.importAuthorized !== false ||
    safety.migrationApplied !== false ||
    safety.remoteDatabaseAccessed !== false
  ) {
    throw new Error('Protected V2 application intent is malformed or overbroad.')
  }
  requiredTimestamp(parsed.createdAt, 'application intent createdAt')
  requiredSha256(parsed.authorizationSha256, 'application intent authorizationSha256')
  return parsed as unknown as ProtectedV2ApplicationIntent
}

export interface ProtectedV2PostApplicationAudit {
  auditIdentitySha256: string
  auditedAt: string
  databaseEvidenceSha256: string
  migration: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2
  readOnly: true
  repeatableRead: true
  repositoryCommitSha: string
  rpcMetadataSha256: string
  schemaVersion: typeof PROTECTED_V2_POST_APPLICATION_AUDIT_SCHEMA_VERSION
  semanticFunctionMetadataSha256: string
  triggerMetadataSha256: string
  verifier: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER
}

export function buildProtectedV2PostApplicationAudit(
  input: Omit<ProtectedV2PostApplicationAudit, 'auditIdentitySha256' | 'schemaVersion'>,
): ProtectedV2PostApplicationAudit {
  const content = { ...input, schemaVersion: PROTECTED_V2_POST_APPLICATION_AUDIT_SCHEMA_VERSION }
  for (const [label, value] of Object.entries({
    databaseEvidenceSha256: content.databaseEvidenceSha256,
    rpcMetadataSha256: content.rpcMetadataSha256,
    semanticFunctionMetadataSha256: content.semanticFunctionMetadataSha256,
    triggerMetadataSha256: content.triggerMetadataSha256,
  })) {
    requiredSha256(value, `post-application audit ${label}`)
  }
  requiredTimestamp(content.auditedAt, 'post-application audit auditedAt')
  if (
    content.readOnly !== true ||
    content.repeatableRead !== true ||
    !COMMIT_PATTERN.test(content.repositoryCommitSha) ||
    canonicalJson(content.migration) !== canonicalJson(PROTECTED_GOLD_IMPORT_CONTRACT_V2) ||
    canonicalJson(content.verifier) !== canonicalJson(PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER)
  ) {
    throw new Error('Protected V2 post-application audit is malformed.')
  }
  return { ...content, auditIdentitySha256: sha256(canonicalJson(content)) }
}

export function parseProtectedV2PostApplicationAudit(
  value: unknown,
): ProtectedV2PostApplicationAudit {
  const parsed = record(value, 'Protected V2 post-application audit')
  exactKeys(
    parsed,
    [
      'auditIdentitySha256',
      'auditedAt',
      'databaseEvidenceSha256',
      'migration',
      'readOnly',
      'repeatableRead',
      'repositoryCommitSha',
      'rpcMetadataSha256',
      'schemaVersion',
      'semanticFunctionMetadataSha256',
      'triggerMetadataSha256',
      'verifier',
    ],
    'Protected V2 post-application audit',
  )
  const auditIdentitySha256 = parsed.auditIdentitySha256
  const input = { ...parsed }
  delete input.auditIdentitySha256
  delete input.schemaVersion
  const rebuilt = buildProtectedV2PostApplicationAudit(
    input as unknown as Omit<
      ProtectedV2PostApplicationAudit,
      'auditIdentitySha256' | 'schemaVersion'
    >,
  )
  if (
    requiredSha256(auditIdentitySha256, 'post-application audit identity') !==
      rebuilt.auditIdentitySha256 ||
    canonicalJson(rebuilt) !== canonicalJson(parsed)
  ) {
    throw new Error('Protected V2 post-application audit identity is invalid.')
  }
  return rebuilt
}

export interface ProtectedV2ApplicationResult {
  after: ProtectedV2DatabaseEvidence
  before: ProtectedV2DatabaseEvidence
  migration: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2
  migrationApplicationCallCount: 0 | 1
  migrationApplied: true
  migrationReexecuted: false
  operatorAuthorizationSha256: string
  originalIntentSha256: string
  postApplicationAudit: ProtectedV2PostApplicationAudit
  receiptReconciled: boolean
  reconciliationReason: string | null
  repository: ProtectedV2RepositoryEvidence
  safety: {
    compensationAuthorized: false
    heldOutIdentitiesAccessed: false
    importAuthorized: false
    remoteDatabaseAccessed: false
  }
  schemaVersion: typeof PROTECTED_V2_APPLICATION_RESULT_SCHEMA_VERSION
  state: 'application_receipt_finalized'
  status: 'protected_v2_migration_applied_exactly_once'
}

export function buildProtectedV2ApplicationResult(input: {
  after: ProtectedV2DatabaseEvidence
  before: ProtectedV2DatabaseEvidence
  migrationApplicationCallCount: 0 | 1
  operatorAuthorizationSha256: string
  originalIntentSha256: string
  postApplicationAudit: ProtectedV2PostApplicationAudit
  receiptReconciled: boolean
  reconciliationReason: string | null
  repository: ProtectedV2RepositoryEvidence
}): ProtectedV2ApplicationResult {
  if (
    input.receiptReconciled !== (input.migrationApplicationCallCount === 0) ||
    (input.receiptReconciled && !input.reconciliationReason?.trim()) ||
    (!input.receiptReconciled && input.reconciliationReason !== null)
  ) {
    throw new Error('Protected V2 finalization mode and reconciliation reason disagree.')
  }
  if (
    input.before.v1Occurrence !== 1 ||
    input.before.v2Occurrence !== 0 ||
    input.after.v1Occurrence !== 1 ||
    input.after.v2Occurrence !== 1 ||
    input.before.actionCount !== 0 ||
    input.before.importCount !== 0 ||
    input.before.compensationCount !== 0 ||
    input.after.actionCount !== 0 ||
    input.after.importCount !== 0 ||
    input.after.compensationCount !== 0 ||
    input.before.developmentMembershipSha256 !== input.after.developmentMembershipSha256 ||
    input.before.developmentPlanningStateSha256 !== input.after.developmentPlanningStateSha256 ||
    input.before.effectiveStateSha256 !== input.after.effectiveStateSha256 ||
    input.before.physicalStateSha256 !== input.after.physicalStateSha256 ||
    input.before.pointerStateSha256 !== input.after.pointerStateSha256 ||
    input.before.revealStateSha256 !== input.after.revealStateSha256 ||
    input.before.reviewStateSha256 !== input.after.reviewStateSha256 ||
    input.postApplicationAudit.databaseEvidenceSha256 !== sha256(canonicalJson(input.after)) ||
    input.postApplicationAudit.repositoryCommitSha !== input.repository.head
  ) {
    throw new Error('Protected V2 finalization database transition is not schema-only exact-once.')
  }
  requiredSha256(input.operatorAuthorizationSha256, 'result authorization')
  requiredSha256(input.originalIntentSha256, 'result intent')
  return {
    after: input.after,
    before: input.before,
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    migrationApplicationCallCount: input.migrationApplicationCallCount,
    migrationApplied: true,
    migrationReexecuted: false,
    operatorAuthorizationSha256: input.operatorAuthorizationSha256,
    originalIntentSha256: input.originalIntentSha256,
    postApplicationAudit: input.postApplicationAudit,
    receiptReconciled: input.receiptReconciled,
    reconciliationReason: input.reconciliationReason,
    repository: input.repository,
    safety: {
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: PROTECTED_V2_APPLICATION_RESULT_SCHEMA_VERSION,
    state: 'application_receipt_finalized',
    status: 'protected_v2_migration_applied_exactly_once',
  }
}

export function parseProtectedV2ApplicationResult(bytes: string): ProtectedV2ApplicationResult {
  const parsed = parseCanonicalJson(bytes, 'Protected V2 application result')
  exactKeys(
    parsed,
    [
      'after',
      'before',
      'migration',
      'migrationApplicationCallCount',
      'migrationApplied',
      'migrationReexecuted',
      'operatorAuthorizationSha256',
      'originalIntentSha256',
      'postApplicationAudit',
      'receiptReconciled',
      'reconciliationReason',
      'repository',
      'safety',
      'schemaVersion',
      'state',
      'status',
    ],
    'Protected V2 application result',
  )
  const rebuilt = buildProtectedV2ApplicationResult({
    after: parsed.after as ProtectedV2DatabaseEvidence,
    before: parsed.before as ProtectedV2DatabaseEvidence,
    migrationApplicationCallCount: parsed.migrationApplicationCallCount as 0 | 1,
    operatorAuthorizationSha256: String(parsed.operatorAuthorizationSha256 ?? ''),
    originalIntentSha256: String(parsed.originalIntentSha256 ?? ''),
    postApplicationAudit: parseProtectedV2PostApplicationAudit(parsed.postApplicationAudit),
    receiptReconciled: parsed.receiptReconciled === true,
    reconciliationReason:
      parsed.reconciliationReason === null ? null : String(parsed.reconciliationReason ?? ''),
    repository: parsed.repository as unknown as ProtectedV2RepositoryEvidence,
  })
  if (canonicalJson(rebuilt) !== bytes) {
    throw new Error('Protected V2 application result bytes are inconsistent.')
  }
  return rebuilt
}

export interface ProtectedV2ApplicationExecutionReceipt {
  canonicalManifestSha256: string
  compensationAuthorized: false
  contentSha256: string
  executedAt: string
  heldOutIdentitiesAccessed: false
  importAuthorized: false
  migrationApplied: true
  migrationApplicationCallCount: 0 | 1
  migrationId: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2.id
  migrationReexecuted: false
  migrationSha256: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256
  operatorAuthorizationSha256: string
  originalIntentSha256: string
  outputDirectory: string
  postApplicationAuditSha256: string
  receiptReconciled: boolean
  reconciliationReason: string | null
  remoteDatabaseAccessed: false
  repositoryCommitSha: string
  resultSha256: string
  schemaVersion: typeof PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION
}

export function buildProtectedV2ApplicationExecutionReceipt(
  input: Omit<ProtectedV2ApplicationExecutionReceipt, 'contentSha256' | 'schemaVersion'>,
): ProtectedV2ApplicationExecutionReceipt {
  const content = { ...input, schemaVersion: PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION }
  for (const [label, value] of Object.entries({
    canonicalManifestSha256: content.canonicalManifestSha256,
    operatorAuthorizationSha256: content.operatorAuthorizationSha256,
    originalIntentSha256: content.originalIntentSha256,
    postApplicationAuditSha256: content.postApplicationAuditSha256,
    resultSha256: content.resultSha256,
  })) {
    requiredSha256(value, `application receipt ${label}`)
  }
  if (
    content.migrationId !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.id ||
    content.migrationSha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256 ||
    content.migrationApplied !== true ||
    content.migrationReexecuted !== false ||
    content.importAuthorized !== false ||
    content.compensationAuthorized !== false ||
    content.heldOutIdentitiesAccessed !== false ||
    content.remoteDatabaseAccessed !== false ||
    content.receiptReconciled !== (content.migrationApplicationCallCount === 0) ||
    !COMMIT_PATTERN.test(content.repositoryCommitSha) ||
    !content.outputDirectory ||
    (content.receiptReconciled && !content.reconciliationReason?.trim()) ||
    (!content.receiptReconciled && content.reconciliationReason !== null)
  ) {
    throw new Error('Protected V2 application execution receipt is malformed or overbroad.')
  }
  requiredTimestamp(content.executedAt, 'application receipt executedAt')
  return { ...content, contentSha256: sha256(canonicalJson(content)) }
}

export function parseProtectedV2ApplicationExecutionReceipt(
  bytes: string,
): ProtectedV2ApplicationExecutionReceipt {
  const parsed = parseCanonicalJson(bytes, 'Protected V2 application execution receipt')
  exactKeys(
    parsed,
    [
      'canonicalManifestSha256',
      'compensationAuthorized',
      'contentSha256',
      'executedAt',
      'heldOutIdentitiesAccessed',
      'importAuthorized',
      'migrationApplied',
      'migrationApplicationCallCount',
      'migrationId',
      'migrationReexecuted',
      'migrationSha256',
      'operatorAuthorizationSha256',
      'originalIntentSha256',
      'outputDirectory',
      'postApplicationAuditSha256',
      'receiptReconciled',
      'reconciliationReason',
      'remoteDatabaseAccessed',
      'repositoryCommitSha',
      'resultSha256',
      'schemaVersion',
    ],
    'Protected V2 application execution receipt',
  )
  const contentSha256 = parsed.contentSha256
  const input = { ...parsed }
  delete input.contentSha256
  delete input.schemaVersion
  const rebuilt = buildProtectedV2ApplicationExecutionReceipt(
    input as unknown as Omit<
      ProtectedV2ApplicationExecutionReceipt,
      'contentSha256' | 'schemaVersion'
    >,
  )
  if (
    requiredSha256(contentSha256, 'application receipt contentSha256') !== rebuilt.contentSha256 ||
    canonicalJson(rebuilt) !== bytes
  ) {
    throw new Error('Protected V2 application execution receipt checksum is invalid.')
  }
  return rebuilt
}
