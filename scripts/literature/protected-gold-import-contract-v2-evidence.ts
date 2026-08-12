import { canonicalJson, sha256 } from './gold-import-compensation-migration-operations'
import {
  PROTECTED_V2_AUDIT_COMPONENT_NAMES,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256,
  PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256,
  validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile,
  type ProtectedV2CompleteCatalogAuditIdentity,
} from './gold-import-contract-v2-catalog-audit'
import {
  assertProtectedV2ExpectedCatalogArtifactSealed,
  parseProtectedV2RuntimeBundleBinding,
  validateProtectedV2ExpectedCatalogBinding,
  validateProtectedV2RuntimeBundleBinding,
  type ProtectedV2ExpectedCatalogBinding,
  type ProtectedV2RuntimeBundleBinding,
} from './protected-gold-import-contract-v2-bindings'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
  PROTECTED_V2_AUTHORIZED_CAPABILITY,
  PROTECTED_V2_BACKUP_TRUST_MODEL,
  PROTECTED_V2_CONFIRMATION,
  PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
  type ProtectedV2BackupBinding,
  type ProtectedV2OperatorAuthorization,
} from './protected-gold-import-contract-v2'
import type { ProtectedV2OperatorBundle } from './protected-gold-import-contract-v2-recovery-bundle'
import {
  validateProtectedV2DatabaseEvidence,
  validateProtectedV2SchemaOnlyDatabaseTransition,
  type ProtectedV2DatabaseEvidence,
} from './protected-gold-import-contract-v2-transition-evidence'
import type { LiteratureGoldV2SchemaOnlyTransitionProof } from './literature-gold-v2-schema-only-transition'

export type { ProtectedV2DatabaseEvidence } from './protected-gold-import-contract-v2-transition-evidence'

export const PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-execution/2.0.0' as const
export const PROTECTED_V2_BACKUP_INSTANCE_IDENTITY_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-instance/2.0.0' as const
export const PROTECTED_V2_BACKUP_DUPLICATE_MARKER_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-local-duplicate-marker/2.0.0' as const
export const PROTECTED_V2_BACKUP_DUPLICATE_MARKER_DIRECTORY =
  '.protected-v2-backup-duplicate-markers' as const
export const PROTECTED_V2_APPLICATION_INTENT_SCHEMA_VERSION =
  'literature-gold-protected-v2-application-intent/3.0.0' as const
export const PROTECTED_V2_POST_APPLICATION_AUDIT_SCHEMA_VERSION =
  'literature-gold-protected-v2-post-application-audit/2.0.0' as const
export const PROTECTED_V2_APPLICATION_RESULT_SCHEMA_VERSION =
  'literature-gold-protected-v2-application-result/3.0.0' as const
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
  operatorBundle: ProtectedV2OperatorBundle
  operatorBundleBinding: ProtectedV2RuntimeBundleBinding
  originMain: string
  statusCleanIncludingUntracked: true
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
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  migrationLedger: {
    sha256: string
    v1: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V1 & { occurrence: 1 }
    v2: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2 & { occurrence: 0 }
  }
  outputDirectory: string
  operatorBundleBinding: ProtectedV2RuntimeBundleBinding
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

function buildProtectedV2BackupExecutionReceiptContent(
  input: ProtectedV2BackupInstanceProjection,
  operatorBundle?: ProtectedV2OperatorBundle,
): ProtectedV2BackupExecutionReceipt {
  if (
    input.schemaVersion !== PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION ||
    input.database.datasetSplit !== 'development' ||
    input.migrationLedger.v1.occurrence !== 1 ||
    input.migrationLedger.v2.occurrence !== 0
  ) {
    throw new Error('Protected V2 backup instance projection is malformed.')
  }
  validateProtectedV2ExpectedCatalogBinding(
    input.expectedCatalog,
    'local_supabase_postgres_owner_v1',
    'local',
  )
  if (operatorBundle) {
    validateProtectedV2RuntimeBundleBinding(input.operatorBundleBinding, operatorBundle)
    assertProtectedV2ExpectedCatalogArtifactSealed({
      binding: input.expectedCatalog,
      bundle: operatorBundle,
      profileId: 'local_supabase_postgres_owner_v1',
      target: 'local',
    })
  } else {
    parseProtectedV2RuntimeBundleBinding(input.operatorBundleBinding)
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

export function buildProtectedV2BackupExecutionReceipt(
  input: ProtectedV2BackupInstanceProjection,
  authorization: { operatorBundle: ProtectedV2OperatorBundle },
): ProtectedV2BackupExecutionReceipt {
  return buildProtectedV2BackupExecutionReceiptContent(input, authorization.operatorBundle)
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
      'expectedCatalog',
      'migrationLedger',
      'operatorBundleBinding',
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
  const rebuilt = buildProtectedV2BackupExecutionReceiptContent(
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

export interface ProtectedV2BackupDuplicateMarker {
  backupInstanceId: string
  backupRoot: string
  contentSha256: string
  executedAt: string
  executionReceiptSha256: string
  outputDirectory: string
  repositoryCommitSha: string
  schemaVersion: typeof PROTECTED_V2_BACKUP_DUPLICATE_MARKER_SCHEMA_VERSION
}

export function buildProtectedV2BackupDuplicateMarker(
  receipt: ProtectedV2BackupExecutionReceipt,
  executionReceiptSha256: string,
): ProtectedV2BackupDuplicateMarker {
  requiredSha256(executionReceiptSha256, 'backup duplicate marker execution receipt')
  const content = {
    backupInstanceId: receipt.backupInstanceId,
    backupRoot: receipt.backupRoot,
    executedAt: receipt.executedAt,
    executionReceiptSha256,
    outputDirectory: receipt.outputDirectory,
    repositoryCommitSha: receipt.repositoryCommitSha,
    schemaVersion: PROTECTED_V2_BACKUP_DUPLICATE_MARKER_SCHEMA_VERSION,
  } as const
  return { ...content, contentSha256: sha256(canonicalJson(content)) }
}

export function parseProtectedV2BackupDuplicateMarker(
  bytes: string,
): ProtectedV2BackupDuplicateMarker {
  const parsed = parseCanonicalJson(bytes, 'Protected V2 backup local duplicate marker')
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
    'Protected V2 backup local duplicate marker',
  )
  const { contentSha256, ...content } = parsed
  if (
    parsed.schemaVersion !== PROTECTED_V2_BACKUP_DUPLICATE_MARKER_SCHEMA_VERSION ||
    requiredSha256(parsed.backupInstanceId, 'duplicate marker backupInstanceId') !==
      parsed.backupInstanceId ||
    requiredSha256(parsed.executionReceiptSha256, 'duplicate marker executionReceiptSha256') !==
      parsed.executionReceiptSha256 ||
    sha256(canonicalJson(content)) !== contentSha256
  ) {
    throw new Error('Protected V2 backup local duplicate marker is invalid.')
  }
  return parsed as unknown as ProtectedV2BackupDuplicateMarker
}

export interface ProtectedV2ApplicationIntent {
  authorization: ProtectedV2OperatorAuthorization
  authorizationSha256: string
  authorizedCapability: typeof PROTECTED_V2_AUTHORIZED_CAPABILITY
  backupInstances: readonly [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  backupTrustModel: typeof PROTECTED_V2_BACKUP_TRUST_MODEL
  before: ProtectedV2DatabaseEvidence
  beforeCaptures: readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  confirmation: typeof PROTECTED_V2_CONFIRMATION
  createdAt: string
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  migration: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2
  operator: string
  operatorBundle: ProtectedV2OperatorBundle
  operatorBundleBinding: ProtectedV2RuntimeBundleBinding
  outputDirectory: string
  repository: ProtectedV2RepositoryEvidence
  separateCaptureAttestation: typeof PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION
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
  beforeCaptures: readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  outputDirectory: string
  repository: ProtectedV2RepositoryEvidence
}): ProtectedV2ApplicationIntent {
  const before = validateProtectedV2DatabaseEvidence(input.before, 'before_v2')
  const beforeCaptures = input.beforeCaptures.map((capture) =>
    validateProtectedV2DatabaseEvidence(capture, 'before_v2'),
  ) as unknown as readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  if (
    canonicalJson(before) !== canonicalJson(beforeCaptures[0]) ||
    canonicalJson(beforeCaptures[0]) !== canonicalJson(beforeCaptures[1])
  ) {
    throw new Error('Protected V2 intent requires two exact pre-application database captures.')
  }
  return {
    authorization: input.authorization,
    authorizationSha256: input.authorization.contentSha256,
    authorizedCapability: PROTECTED_V2_AUTHORIZED_CAPABILITY,
    backupInstances: input.authorization.context.backups,
    backupTrustModel: PROTECTED_V2_BACKUP_TRUST_MODEL,
    before,
    beforeCaptures,
    confirmation: PROTECTED_V2_CONFIRMATION,
    createdAt: input.authorization.requestedAt,
    expectedCatalog: input.authorization.context.expectedPostApplicationAudit.expectedCatalog,
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    operator: input.authorization.operator,
    operatorBundle: input.repository.operatorBundle,
    operatorBundleBinding: input.repository.operatorBundleBinding,
    outputDirectory: input.outputDirectory,
    repository: input.repository,
    separateCaptureAttestation: PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
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
      'backupTrustModel',
      'before',
      'beforeCaptures',
      'confirmation',
      'createdAt',
      'expectedCatalog',
      'migration',
      'operator',
      'operatorBundle',
      'operatorBundleBinding',
      'outputDirectory',
      'repository',
      'separateCaptureAttestation',
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
    parsed.backupTrustModel !== PROTECTED_V2_BACKUP_TRUST_MODEL ||
    parsed.confirmation !== PROTECTED_V2_CONFIRMATION ||
    parsed.separateCaptureAttestation !== PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION ||
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
  const expectedCatalog = validateProtectedV2ExpectedCatalogBinding(
    parsed.expectedCatalog,
    'local_supabase_postgres_owner_v1',
    'local',
  )
  validateProtectedV2RuntimeBundleBinding(
    parsed.operatorBundleBinding,
    parsed.operatorBundle as ProtectedV2OperatorBundle,
  )
  assertProtectedV2ExpectedCatalogArtifactSealed({
    binding: expectedCatalog,
    bundle: parsed.operatorBundle as ProtectedV2OperatorBundle,
    profileId: 'local_supabase_postgres_owner_v1',
    target: 'local',
  })
  const authorization = record(parsed.authorization, 'application intent authorization')
  const context = record(authorization.context, 'application intent authorization context')
  const expectedPostApplicationAudit = record(
    context.expectedPostApplicationAudit,
    'application intent expected post-application audit',
  )
  const repository = record(parsed.repository, 'application intent repository')
  const before = validateProtectedV2DatabaseEvidence(parsed.before, 'before_v2')
  if (!Array.isArray(parsed.beforeCaptures) || parsed.beforeCaptures.length !== 2) {
    throw new Error('Protected V2 application intent requires exactly two database captures.')
  }
  const beforeCaptures = parsed.beforeCaptures.map((capture) =>
    validateProtectedV2DatabaseEvidence(capture, 'before_v2'),
  )
  if (
    canonicalJson(expectedPostApplicationAudit.expectedCatalog) !==
      canonicalJson(expectedCatalog) ||
    canonicalJson(repository.operatorBundle) !== canonicalJson(parsed.operatorBundle) ||
    canonicalJson(repository.operatorBundleBinding) !==
      canonicalJson(parsed.operatorBundleBinding) ||
    canonicalJson(before) !== canonicalJson(beforeCaptures[0]) ||
    canonicalJson(beforeCaptures[0]) !== canonicalJson(beforeCaptures[1])
  ) {
    throw new Error('Protected V2 application intent catalog or bundle bindings disagree.')
  }
  requiredTimestamp(parsed.createdAt, 'application intent createdAt')
  requiredSha256(parsed.authorizationSha256, 'application intent authorizationSha256')
  return parsed as unknown as ProtectedV2ApplicationIntent
}

export interface ProtectedV2PostApplicationAudit {
  auditMethod: typeof PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD
  auditIdentitySha256: string
  auditedAt: string
  catalogAudit: ProtectedV2CompleteCatalogAuditIdentity
  databaseEvidenceSha256: string
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  migration: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2
  readOnly: true
  repeatableRead: true
  repositoryCommitSha: string
  schemaVersion: typeof PROTECTED_V2_POST_APPLICATION_AUDIT_SCHEMA_VERSION
  verifier: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER
  verifierExecuted: false
}

export function buildProtectedV2PostApplicationAudit(
  input: Omit<ProtectedV2PostApplicationAudit, 'auditIdentitySha256' | 'schemaVersion'>,
): ProtectedV2PostApplicationAudit {
  const content = {
    ...input,
    catalogAudit: validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
      input.catalogAudit,
      'local_supabase_postgres_owner_v1',
      'local',
    ),
    expectedCatalog: validateProtectedV2ExpectedCatalogBinding(
      input.expectedCatalog,
      'local_supabase_postgres_owner_v1',
      'local',
    ),
    schemaVersion: PROTECTED_V2_POST_APPLICATION_AUDIT_SCHEMA_VERSION,
  }
  for (const [label, value] of Object.entries({
    databaseEvidenceSha256: content.databaseEvidenceSha256,
    fullAuditIdentitySha256: content.catalogAudit.fullAuditIdentitySha256,
    auditModelIdentitySha256: content.catalogAudit.auditModelIdentitySha256,
    environmentInvariantIdentitySha256: content.catalogAudit.environmentInvariantIdentitySha256,
  })) {
    requiredSha256(value, `post-application audit ${label}`)
  }
  requiredTimestamp(content.auditedAt, 'post-application audit auditedAt')
  if (
    content.readOnly !== true ||
    content.repeatableRead !== true ||
    content.auditMethod !== PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD ||
    content.verifierExecuted !== false ||
    content.catalogAudit.auditMethod !== PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD ||
    content.catalogAudit.auditModelIdentitySha256 !==
      PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256 ||
    content.catalogAudit.environmentInvariantIdentitySha256 !==
      PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256 ||
    content.catalogAudit.fullAuditIdentitySha256 !==
      content.expectedCatalog.fullAuditIdentitySha256 ||
    content.catalogAudit.fullEnvironmentInventoryIdentitySha256 !==
      content.expectedCatalog.fullEnvironmentInventoryIdentitySha256 ||
    content.catalogAudit.fullEnvironmentInventoryRecordCount !==
      content.expectedCatalog.fullEnvironmentInventoryRecordCount ||
    content.catalogAudit.localPostgresOwnerProfileIdentitySha256 !==
      content.expectedCatalog.expectedDeploymentProfileIdentitySha256 ||
    canonicalJson(content.catalogAudit.componentIdentities) !==
      canonicalJson(content.expectedCatalog.componentIdentities) ||
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
      'auditMethod',
      'auditedAt',
      'catalogAudit',
      'databaseEvidenceSha256',
      'expectedCatalog',
      'migration',
      'readOnly',
      'repeatableRead',
      'repositoryCommitSha',
      'schemaVersion',
      'verifier',
      'verifierExecuted',
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
  backupInstances: readonly [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  backupTrustModel: typeof PROTECTED_V2_BACKUP_TRUST_MODEL
  before: ProtectedV2DatabaseEvidence
  beforeCaptures: readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  intentCommitIsAncestor: true
  intentRepositoryHead: string
  migration: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2
  migrationApplicationCallCount: 0 | 1
  migrationApplied: true
  migrationReexecuted: false
  operatorAuthorizationSha256: string
  originalIntentSha256: string
  operatorBundleSha256: string
  operatorBundleBinding: ProtectedV2RuntimeBundleBinding
  operatorBundleUnchanged: true
  postApplicationAudit: ProtectedV2PostApplicationAudit
  receiptReconciled: boolean
  reconciliationReason: string | null
  recoveryRepositoryHead: string
  repository: ProtectedV2RepositoryEvidence
  separateCaptureAttestation: typeof PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION
  safety: {
    compensationAuthorized: false
    heldOutIdentitiesAccessed: false
    importAuthorized: false
    remoteDatabaseAccessed: false
  }
  schemaOnlyTransition: LiteratureGoldV2SchemaOnlyTransitionProof
  schemaVersion: typeof PROTECTED_V2_APPLICATION_RESULT_SCHEMA_VERSION
  state: 'application_receipt_finalized'
  status: 'protected_v2_migration_applied_exactly_once'
}

export function buildProtectedV2ApplicationResult(input: {
  after: ProtectedV2DatabaseEvidence
  backupInstances: readonly [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  before: ProtectedV2DatabaseEvidence
  beforeCaptures: readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  intentCommitIsAncestor: true
  intentRepositoryHead: string
  migrationApplicationCallCount: 0 | 1
  operatorAuthorizationSha256: string
  originalIntentSha256: string
  operatorBundleSha256: string
  postApplicationAudit: ProtectedV2PostApplicationAudit
  receiptReconciled: boolean
  reconciliationReason: string | null
  repository: ProtectedV2RepositoryEvidence
}): ProtectedV2ApplicationResult {
  const expectedCatalog = validateProtectedV2ExpectedCatalogBinding(
    input.postApplicationAudit.expectedCatalog,
    'local_supabase_postgres_owner_v1',
    'local',
  )
  const operatorBundleBinding = validateProtectedV2RuntimeBundleBinding(
    input.repository.operatorBundleBinding,
    input.repository.operatorBundle,
  )
  assertProtectedV2ExpectedCatalogArtifactSealed({
    binding: expectedCatalog,
    bundle: input.repository.operatorBundle,
    profileId: 'local_supabase_postgres_owner_v1',
    target: 'local',
  })
  if (
    input.receiptReconciled !== (input.migrationApplicationCallCount === 0) ||
    (input.receiptReconciled && !input.reconciliationReason?.trim()) ||
    (!input.receiptReconciled && input.reconciliationReason !== null)
  ) {
    throw new Error('Protected V2 finalization mode and reconciliation reason disagree.')
  }
  const before = validateProtectedV2DatabaseEvidence(input.before, 'before_v2')
  const after = validateProtectedV2DatabaseEvidence(input.after, 'after_v2')
  const beforeCaptures = input.beforeCaptures.map((capture) =>
    validateProtectedV2DatabaseEvidence(capture, 'before_v2'),
  ) as unknown as readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  const schemaOnlyTransition = validateProtectedV2SchemaOnlyDatabaseTransition({
    after,
    beforeCaptures,
    expectedCatalogBindingSha256: expectedCatalog.bindingSha256,
    sourceAuthorizationSha256: input.operatorAuthorizationSha256,
  })
  if (
    canonicalJson(before) !== canonicalJson(beforeCaptures[0]) ||
    canonicalJson(beforeCaptures[0]) !== canonicalJson(beforeCaptures[1]) ||
    input.postApplicationAudit.databaseEvidenceSha256 !== sha256(canonicalJson(after)) ||
    input.postApplicationAudit.repositoryCommitSha !== input.repository.head ||
    input.intentCommitIsAncestor !== true ||
    !COMMIT_PATTERN.test(input.intentRepositoryHead) ||
    input.repository.head !== input.repository.originMain ||
    input.operatorBundleSha256 !== input.repository.operatorBundle.aggregateSha256 ||
    operatorBundleBinding.aggregateSha256 !== input.operatorBundleSha256
  ) {
    throw new Error('Protected V2 finalization database transition is not schema-only exact-once.')
  }
  requiredSha256(input.operatorAuthorizationSha256, 'result authorization')
  requiredSha256(input.originalIntentSha256, 'result intent')
  requiredSha256(input.operatorBundleSha256, 'result operator bundle')
  return {
    after,
    backupInstances: input.backupInstances,
    backupTrustModel: PROTECTED_V2_BACKUP_TRUST_MODEL,
    before,
    beforeCaptures,
    expectedCatalog,
    intentCommitIsAncestor: true,
    intentRepositoryHead: input.intentRepositoryHead,
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    migrationApplicationCallCount: input.migrationApplicationCallCount,
    migrationApplied: true,
    migrationReexecuted: false,
    operatorAuthorizationSha256: input.operatorAuthorizationSha256,
    originalIntentSha256: input.originalIntentSha256,
    operatorBundleSha256: input.operatorBundleSha256,
    operatorBundleBinding,
    operatorBundleUnchanged: true,
    postApplicationAudit: input.postApplicationAudit,
    receiptReconciled: input.receiptReconciled,
    reconciliationReason: input.reconciliationReason,
    recoveryRepositoryHead: input.repository.head,
    repository: input.repository,
    separateCaptureAttestation: PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
    safety: {
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      remoteDatabaseAccessed: false,
    },
    schemaOnlyTransition,
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
      'backupInstances',
      'backupTrustModel',
      'before',
      'beforeCaptures',
      'expectedCatalog',
      'intentCommitIsAncestor',
      'intentRepositoryHead',
      'migration',
      'migrationApplicationCallCount',
      'migrationApplied',
      'migrationReexecuted',
      'operatorAuthorizationSha256',
      'originalIntentSha256',
      'operatorBundleSha256',
      'operatorBundleBinding',
      'operatorBundleUnchanged',
      'postApplicationAudit',
      'receiptReconciled',
      'reconciliationReason',
      'recoveryRepositoryHead',
      'repository',
      'separateCaptureAttestation',
      'safety',
      'schemaOnlyTransition',
      'schemaVersion',
      'state',
      'status',
    ],
    'Protected V2 application result',
  )
  const rebuilt = buildProtectedV2ApplicationResult({
    after: parsed.after as ProtectedV2DatabaseEvidence,
    backupInstances: parsed.backupInstances as unknown as readonly [
      ProtectedV2BackupBinding,
      ProtectedV2BackupBinding,
    ],
    before: parsed.before as ProtectedV2DatabaseEvidence,
    beforeCaptures: parsed.beforeCaptures as unknown as readonly [
      ProtectedV2DatabaseEvidence,
      ProtectedV2DatabaseEvidence,
    ],
    intentCommitIsAncestor: parsed.intentCommitIsAncestor as true,
    intentRepositoryHead: String(parsed.intentRepositoryHead ?? ''),
    migrationApplicationCallCount: parsed.migrationApplicationCallCount as 0 | 1,
    operatorAuthorizationSha256: String(parsed.operatorAuthorizationSha256 ?? ''),
    originalIntentSha256: String(parsed.originalIntentSha256 ?? ''),
    operatorBundleSha256: String(parsed.operatorBundleSha256 ?? ''),
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
  auditMethod: typeof PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD
  backupCaptureIds: readonly [string, string]
  backupTrustModel: typeof PROTECTED_V2_BACKUP_TRUST_MODEL
  canonicalManifestSha256: string
  compensationAuthorized: false
  contentSha256: string
  executedAt: string
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  heldOutIdentitiesAccessed: false
  importAuthorized: false
  intentCommitIsAncestor: true
  intentRepositoryHead: string
  migrationApplied: true
  migrationApplicationCallCount: 0 | 1
  migrationId: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2.id
  migrationReexecuted: false
  migrationSha256: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256
  operatorAuthorizationSha256: string
  operatorBundleSha256: string
  operatorBundleBinding: ProtectedV2RuntimeBundleBinding
  operatorBundleUnchanged: true
  originalIntentSha256: string
  outputDirectory: string
  postApplicationAuditSha256: string
  postApplicationCatalogAuditIdentitySha256: string
  postApplicationComponentIdentities: Record<string, string>
  receiptReconciled: boolean
  reconciliationReason: string | null
  remoteDatabaseAccessed: false
  recoveryRepositoryHead: string
  repositoryCommitSha: string
  resultSha256: string
  schemaVersion: typeof PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION
  separateCaptureAttestation: typeof PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION
  verifierExecuted: false
  verifierSourceSha256: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256
}

function buildProtectedV2ApplicationExecutionReceiptContent(
  input: Omit<ProtectedV2ApplicationExecutionReceipt, 'contentSha256' | 'schemaVersion'>,
  operatorBundle?: ProtectedV2OperatorBundle,
): ProtectedV2ApplicationExecutionReceipt {
  const content = { ...input, schemaVersion: PROTECTED_V2_APPLICATION_EXECUTION_SCHEMA_VERSION }
  const expectedCatalog = validateProtectedV2ExpectedCatalogBinding(
    content.expectedCatalog,
    'local_supabase_postgres_owner_v1',
    'local',
  )
  const operatorBundleBinding = operatorBundle
    ? validateProtectedV2RuntimeBundleBinding(content.operatorBundleBinding, operatorBundle)
    : parseProtectedV2RuntimeBundleBinding(content.operatorBundleBinding)
  if (operatorBundle) {
    assertProtectedV2ExpectedCatalogArtifactSealed({
      binding: expectedCatalog,
      bundle: operatorBundle,
      profileId: 'local_supabase_postgres_owner_v1',
      target: 'local',
    })
  }
  for (const [label, value] of Object.entries({
    canonicalManifestSha256: content.canonicalManifestSha256,
    operatorAuthorizationSha256: content.operatorAuthorizationSha256,
    operatorBundleSha256: content.operatorBundleSha256,
    originalIntentSha256: content.originalIntentSha256,
    postApplicationAuditSha256: content.postApplicationAuditSha256,
    postApplicationCatalogAuditIdentitySha256: content.postApplicationCatalogAuditIdentitySha256,
    resultSha256: content.resultSha256,
  })) {
    requiredSha256(value, `application receipt ${label}`)
  }
  if (
    content.migrationId !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.id ||
    content.auditMethod !== PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD ||
    content.backupTrustModel !== PROTECTED_V2_BACKUP_TRUST_MODEL ||
    content.separateCaptureAttestation !== PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION ||
    content.verifierExecuted !== false ||
    content.verifierSourceSha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256 ||
    content.intentCommitIsAncestor !== true ||
    content.operatorBundleUnchanged !== true ||
    operatorBundleBinding.aggregateSha256 !== content.operatorBundleSha256 ||
    content.postApplicationCatalogAuditIdentitySha256 !== expectedCatalog.fullAuditIdentitySha256 ||
    canonicalJson(content.postApplicationComponentIdentities) !==
      canonicalJson(expectedCatalog.componentIdentities) ||
    !COMMIT_PATTERN.test(content.intentRepositoryHead) ||
    !COMMIT_PATTERN.test(content.recoveryRepositoryHead) ||
    content.recoveryRepositoryHead !== content.repositoryCommitSha ||
    content.backupCaptureIds.length !== 2 ||
    content.backupCaptureIds.some((identity) => !SHA256_PATTERN.test(identity)) ||
    content.backupCaptureIds[0] === content.backupCaptureIds[1] ||
    canonicalJson(Object.keys(content.postApplicationComponentIdentities).sort()) !==
      canonicalJson([...PROTECTED_V2_AUDIT_COMPONENT_NAMES].sort()) ||
    Object.values(content.postApplicationComponentIdentities).some(
      (identity) => !SHA256_PATTERN.test(identity),
    ) ||
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

export function buildProtectedV2ApplicationExecutionReceipt(
  input: Omit<ProtectedV2ApplicationExecutionReceipt, 'contentSha256' | 'schemaVersion'>,
  authorization: { operatorBundle: ProtectedV2OperatorBundle },
): ProtectedV2ApplicationExecutionReceipt {
  return buildProtectedV2ApplicationExecutionReceiptContent(input, authorization.operatorBundle)
}

export function parseProtectedV2ApplicationExecutionReceipt(
  bytes: string,
): ProtectedV2ApplicationExecutionReceipt {
  const parsed = parseCanonicalJson(bytes, 'Protected V2 application execution receipt')
  exactKeys(
    parsed,
    [
      'canonicalManifestSha256',
      'auditMethod',
      'backupCaptureIds',
      'backupTrustModel',
      'compensationAuthorized',
      'contentSha256',
      'executedAt',
      'expectedCatalog',
      'heldOutIdentitiesAccessed',
      'importAuthorized',
      'intentCommitIsAncestor',
      'intentRepositoryHead',
      'migrationApplied',
      'migrationApplicationCallCount',
      'migrationId',
      'migrationReexecuted',
      'migrationSha256',
      'operatorAuthorizationSha256',
      'operatorBundleSha256',
      'operatorBundleBinding',
      'operatorBundleUnchanged',
      'originalIntentSha256',
      'outputDirectory',
      'postApplicationAuditSha256',
      'postApplicationCatalogAuditIdentitySha256',
      'postApplicationComponentIdentities',
      'receiptReconciled',
      'reconciliationReason',
      'remoteDatabaseAccessed',
      'recoveryRepositoryHead',
      'repositoryCommitSha',
      'resultSha256',
      'schemaVersion',
      'separateCaptureAttestation',
      'verifierExecuted',
      'verifierSourceSha256',
    ],
    'Protected V2 application execution receipt',
  )
  const contentSha256 = parsed.contentSha256
  const input = { ...parsed }
  delete input.contentSha256
  delete input.schemaVersion
  const rebuilt = buildProtectedV2ApplicationExecutionReceiptContent(
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
