import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import {
  parseFinalizedArtifactBooleanValue,
  parseFinalizedArtifactPipeList,
  validateGoldImportSourceArtifact,
} from '../../src/features/literature/gold-set/import-artifact-validation'
import { parseCsvRows } from '../../src/features/literature/gold-set/export'
import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
  bindImportPlan,
  canonicalJson,
  compensationActionSchema,
  goldReviewClinicalProjection,
  goldReviewClinicalProjectionSchema,
  goldReviewPayloadSchema,
  importActionSchema,
  rejectLegacyPointerRewindRollback,
  sha256Canonical,
  type CompensationAction,
  type ImportAction,
  type ImportPlan,
} from '../../src/features/literature/gold-set/import-compensation'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  assertSafeOutputPathArgument,
  assertExclusiveOutputDirectoryIdentity,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'
import {
  POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
  schemaSecurityDefinitionIdentitySha256,
} from './gold-import-compensation-rehearsal-evidence'
import { OWNER_ACL_AUDIT_READY_TERMINAL_STATE } from './gold-import-compensation-contract-reconciliation'
import {
  resolveGoldImportCompensationCompatibility,
  resolveFinalizedArtifactNoteForImport,
  validateGoldImportSourceAuthorizationSet,
  type CompatibilityAuditBindingContext,
  type GoldImportCompensationCompatibilityResolution,
} from './gold-import-compensation-compatibility'
import { validateReadyLocalPostMigrationContractReconciliation } from './gold-import-compensation-reconciled-audit'

export const PACKAGE_GENERATOR_SCHEMA_VERSION =
  'gold-import-compensation-package-generator/v1' as const
export const PACKAGE_VERSION = 'gold-set-v1-atomic-import-compensation/v3' as const
export const MIGRATION_ID =
  '20260808035633_add_literature_gold_import_compensation_contract' as const
export const MIGRATION_FILENAME = `${MIGRATION_ID}.sql` as const
export const MIGRATION_SHA256 =
  'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528' as const
export const FINAL_V3_ARTIFACT_SHA256 =
  '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59' as const
export const SIGNED_PROTOCOL_AUTHORIZATION_SHA256 =
  '784d13736ff0fbf69bd8ad55c8bf55b293c4cc2051b980a3488a980f120c5dd3' as const
export const AMENDED_TWO_ROW_AUTHORIZATION_SHA256 =
  'b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a' as const

export interface ImportActionCounts {
  initial: number
  inserts: number
  noops: number
  revisions: number
  total: number
}

export interface CompensationActionCounts {
  noops: number
  restored: number
  total: number
  voided: number
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const PMID_PATTERN = /^[0-9]{1,12}$/u

const sha256Schema = z.string().regex(SHA256_PATTERN)
const uuidSchema = z.string().regex(UUID_PATTERN)
const pmidSchema = z.string().regex(PMID_PATTERN)
const timestampSchema = z.string().datetime({ offset: true })
const PACKAGE_REVIEW_TIMESTAMP = '2026-08-08T00:00:00.000Z'
const LEGACY_READY_AUDIT_CANONICAL_FILES = [
  'development-planning-state.json',
  'migration-audit.json',
  'migration-audit.md',
  'schema-security-definition-identity.json',
] as const
const RECONCILED_AUDIT_EVIDENCE_FILES = [
  'contract-diagnostics.json',
  'contract-reconciliation.json',
  'read-only-state-bracket.json',
] as const
const RECONCILED_READY_AUDIT_CANONICAL_FILES = [
  ...LEGACY_READY_AUDIT_CANONICAL_FILES,
  ...RECONCILED_AUDIT_EVIDENCE_FILES,
].sort((left, right) => left.localeCompare(right, 'en'))

const preImportItemStateSchema = z
  .object({
    automatedSignalsRevealedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
    reviewStatus: z.enum(['pending', 'in_progress', 'return_later', 'completed']),
    startedAt: timestampSchema.nullable(),
    supplementalMetadataRevealedAt: timestampSchema.nullable(),
  })
  .strict()

const planningRowCommon = {
  datasetSplit: z.literal('development'),
  expectedCurrentReviewId: uuidSchema.nullable(),
  expectedEffectiveReviewId: uuidSchema.nullable(),
  itemId: uuidSchema,
  pmid: pmidSchema,
  preImportItemState: preImportItemStateSchema,
  sequence: z.number().int().positive(),
  targetReview: goldReviewPayloadSchema,
}

const initialPlanningRowSchema = z
  .object({
    ...planningRowCommon,
    action: z.literal('import_initial'),
    expectedCurrentReviewId: z.null(),
    expectedEffectiveReviewId: z.null(),
    expectedRevision: z.literal(1),
    expectedSupersedesReviewId: z.null(),
  })
  .strict()

const revisionPlanningRowSchema = z
  .object({
    ...planningRowCommon,
    action: z.literal('import_revision'),
    expectedCurrentReviewId: uuidSchema,
    expectedEffectiveReviewId: uuidSchema,
    expectedRevision: z.number().int().min(2),
    expectedSupersedesReviewId: uuidSchema,
  })
  .strict()

const noopPlanningRowSchema = z
  .object({
    ...planningRowCommon,
    action: z.literal('import_noop'),
    expectedRevision: z.null(),
    expectedSupersedesReviewId: z.null(),
  })
  .strict()

export const packagePlanningRowSchema = z.discriminatedUnion('action', [
  initialPlanningRowSchema,
  revisionPlanningRowSchema,
  noopPlanningRowSchema,
])
export type PackagePlanningRow = z.infer<typeof packagePlanningRowSchema>

const historicalEffectiveReviewSchema = z
  .object({
    ...goldReviewClinicalProjectionSchema.shape,
    completedAt: timestampSchema,
    createdAt: timestampSchema,
    diseaseTagStatus: goldReviewClinicalProjectionSchema.shape.diseaseTagStatus.nullable(),
    enrichmentProvenance: goldReviewClinicalProjectionSchema.shape.enrichmentProvenance.nullable(),
    enrichmentSchemaVersion:
      goldReviewClinicalProjectionSchema.shape.enrichmentSchemaVersion.nullable(),
    labelSchemaVersion: goldReviewClinicalProjectionSchema.shape.labelSchemaVersion.nullable(),
    reviewerEmail: z.string().trim().min(1).max(320).nullable(),
    reviewerUserId: uuidSchema.nullable(),
    startedAt: timestampSchema,
    taxonomyVersion: goldReviewClinicalProjectionSchema.shape.taxonomyVersion.nullable(),
    technologyTagStatus: goldReviewClinicalProjectionSchema.shape.technologyTagStatus.nullable(),
  })
  .strict()
  .superRefine((review, context) => {
    if (Date.parse(review.completedAt) < Date.parse(review.startedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Historical completedAt cannot precede startedAt.',
      })
    }
  })

const developmentPlanningStateRowSchema = z
  .object({
    currentEffectiveReview: historicalEffectiveReviewSchema.nullable(),
    currentReviewId: uuidSchema.nullable(),
    currentRevision: z.number().int().positive().nullable(),
    datasetSplit: z.literal('development'),
    displayOrder: z.number().int().nonnegative(),
    effectiveReviewId: uuidSchema.nullable(),
    itemId: uuidSchema,
    itemState: preImportItemStateSchema,
    pmid: pmidSchema,
    sequence: z.number().int().positive(),
  })
  .strict()

const developmentPlanningStateSchema = z
  .object({
    datasetSplit: z.literal('development'),
    rows: z.array(developmentPlanningStateRowSchema),
    schemaVersion: z.literal('gold-import-compensation-development-planning-state/1.0.0'),
  })
  .strict()

const FINALIZED_ARTIFACT_COLUMNS = [
  'gold_set_item_id',
  'master_row_id',
  'pmid',
  'dataset_split',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency',
  'topic_ids',
  'technology_tags',
  'technology_tag_status',
  'clinical_purposes',
  'disease_tags',
  'disease_tag_status',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'physician_notes',
  'full_text_used',
  'is_blinded',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'enrichment_provenance',
] as const

type FinalizedArtifactColumn = (typeof FINALIZED_ARTIFACT_COLUMNS)[number]
type FinalizedArtifactRecord = Record<FinalizedArtifactColumn, string>

const auditDatabaseSchema = z
  .object({
    batchId: uuidSchema,
    currentEffectiveStateSha256: sha256Schema,
    currentPhysicalStateSha256: sha256Schema,
    currentPointersAreLatestHeads: z.boolean(),
    developmentPlanningStateSha256: sha256Schema.nullable(),
    developmentMembershipSha256: sha256Schema,
    heldOutIdentitiesAccessed: z.literal(false),
    preMigrationBackupManifestSha256: sha256Schema.nullable(),
    readOnlyAudit: z.literal(true),
    remoteWritesAllowed: z.literal(false),
    repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
    revisionChainsLinear: z.boolean(),
    schemaSecurityIdentitySha256: sha256Schema,
    stateFresh: z.boolean(),
    targetDatabase: z.literal('local'),
    testSplitLocked: z.boolean(),
  })
  .strict()

const auditMigrationSchema = z
  .object({
    applied: z.boolean(),
    id: z.string(),
    ledgerOccurrences: z.number().int().nonnegative(),
    sha256: sha256Schema,
  })
  .strict()

const auditComparisonsSchema = z
  .object({
    aggregateTestLockStateUnchanged: z.boolean(),
    effectiveStatePreserved: z.boolean(),
    pointerMutationCount: z.number().int().nonnegative(),
    postContractPhysicalStateSha256: sha256Schema,
    postEffectiveStateSha256: sha256Schema,
    postSchemaSecurityIdentitySha256: sha256Schema,
    preEffectiveStateSha256: sha256Schema,
    preSchemaSecurityIdentitySha256: sha256Schema,
    preexistingPhysicalStateAfterSha256: sha256Schema,
    preexistingPhysicalStateBeforeSha256: sha256Schema,
    priorMigrationLedgerRowsUnchanged: z.boolean(),
    priorPhysicalStatePreserved: z.boolean(),
    reviewMutationCount: z.number().int().nonnegative(),
    schemaChangedAsExpected: z.boolean(),
  })
  .strict()

const auditChecksSchema = z
  .object({
    behavioralProbe: z.literal('none_on_real_batch_static_contract_and_snapshot_only'),
    compensationExecuted: z.literal(false),
    databaseMutationCount: z.literal(0),
    failures: z.array(z.string()),
    importExecuted: z.literal(false),
    expectedSchemaSecurityIdentitySha256: sha256Schema.nullable(),
    lint: z.unknown(),
    schemaSecurityDefinitionIdentity: z.unknown().nullable(),
    security: z.unknown(),
  })
  .strict()

const legacyPackageGenerationAuditSchema = z
  .object({
    checks: auditChecksSchema,
    comparisons: auditComparisonsSchema,
    database: auditDatabaseSchema,
    migration: auditMigrationSchema,
    readinessStatus: z.enum(['ready', 'blocked', 'not_yet_migrated']),
    schemaVersion: z.literal('gold-import-compensation-migration-audit/1.0.0'),
    status: z.enum(['ready', 'blocked', 'not_yet_migrated']),
  })
  .strict()

const reconciliationIdentityBindingSchema = z
  .object({
    identity: z.unknown(),
    sha256: sha256Schema,
  })
  .strict()

const reconciliationIdentitySetSchema = z
  .object({
    contractInvariant: reconciliationIdentityBindingSchema,
    deploymentProfile: reconciliationIdentityBindingSchema,
    fullEnvironmentInventory: reconciliationIdentityBindingSchema,
  })
  .strict()

const reconciliationClassificationCountsSchema = z
  .object({
    audit_expectation_defect: z.number().int().nonnegative(),
    environment_representation_only: z.number().int().nonnegative(),
    explicitly_supported_local_profile: z.number().int().nonnegative(),
    identical: z.number().int().nonnegative(),
    missing_expected_object: z.number().int().nonnegative(),
    security_contract_difference: z.number().int().nonnegative(),
    semantic_contract_difference: z.number().int().nonnegative(),
    unexpected_object: z.number().int().nonnegative(),
  })
  .strict()

function reconciliationClassificationPartitionSchema<const Total extends number>(total: Total) {
  return z
    .object({
      classificationCounts: reconciliationClassificationCountsSchema,
      total: z.literal(total),
    })
    .strict()
}

const reconciliationClassificationPartitionsSchema = z
  .object({
    combined: reconciliationClassificationPartitionSchema(772),
    deploymentProfile: reconciliationClassificationPartitionSchema(6),
    rpcs: reconciliationClassificationPartitionSchema(3),
    schemaSecurityRecords: reconciliationClassificationPartitionSchema(763),
  })
  .strict()

const readyContractReconciliationSchema = z
  .object({
    classificationCounts: reconciliationClassificationCountsSchema,
    classificationPartitions: reconciliationClassificationPartitionsSchema,
    combinedClassificationCounts: reconciliationClassificationCountsSchema,
    completeness: z
      .object({
        actualRecordCount: z.number().int().positive(),
        actualRecordsAccountedFor: z.number().int().positive(),
        complete: z.literal(true),
        expectedRecordCount: z.number().int().positive(),
        expectedRecordsAccountedFor: z.number().int().positive(),
      })
      .strict(),
    deploymentProfile: z
      .object({
        actualIdentity: reconciliationIdentityBindingSchema,
        expectedIdentity: reconciliationIdentityBindingSchema,
        passed: z.literal(true),
        violations: z.tuple([]),
      })
      .strict(),
    deploymentProfileClassificationCounts: reconciliationClassificationCountsSchema,
    fullEnvironmentInventoryMatches: z.boolean(),
    identities: z
      .object({
        actual: reconciliationIdentitySetSchema,
        expected: reconciliationIdentitySetSchema,
      })
      .strict(),
    invariantIdentityMatches: z.literal(true),
    ownerAclTerminalState: z.literal(OWNER_ACL_AUDIT_READY_TERMINAL_STATE),
    ownerRepresentation: z
      .object({
        actualRecordCount: z.literal(683),
        collapsedByObjectType: z.record(z.string(), z.number().int().nonnegative()),
        collapsedExpectedRecordCount: z.literal(80),
        expectedRecordCount: z.literal(763),
        explanation: z.string().min(1),
        isExact763To683OwnerRepresentation: z.literal(true),
        projectedExpectedRecordCount: z.literal(683),
        projectionExactlyMatchesActual: z.literal(true),
        recordCountDelta: z.literal(80),
      })
      .strict(),
    readinessBlockers: z.tuple([]),
    ready: z.literal(true),
    profileDiffs: z.array(z.unknown()).length(6),
    recordDiffs: z.array(z.unknown()).length(763),
    rpcClassificationCounts: reconciliationClassificationCountsSchema,
    requestedNameDiscrepancies: z.tuple([
      z
        .object({
          aliasCreated: z.literal(false),
          canonicalName: z.literal('reconcile_literature_gold_review_operation_v1'),
          classification: z.literal('audit_expectation_defect'),
          requestedName: z.literal('reconcile_literature_gold_import_v1'),
        })
        .strict(),
    ]),
    rpcDiffs: z.array(z.unknown()).length(3),
    schemaSecurityRecordClassificationCounts: reconciliationClassificationCountsSchema,
    schemaVersion: z.literal('gold-import-compensation-contract-reconciliation/1.0.0'),
  })
  .strict()

const reconciledAuditDatabaseSchema = auditDatabaseSchema
  .extend({
    contractInvariantIdentitySha256: sha256Schema,
    deploymentProfileId: z.literal('local_supabase_postgres_owner_v1'),
    environmentProfileIdentitySha256: sha256Schema,
    fullEnvironmentInventoryIdentitySha256: sha256Schema,
  })
  .strict()

const reconciledAuditChecksSchema = auditChecksSchema
  .extend({
    contractReconciliation: readyContractReconciliationSchema,
    forwardMigrationRequired: z.literal(false),
    legacyOwnerSpecificFailures: z.tuple([
      z.literal(
        'apply_literature_gold_import_v1 has unexpected owner postgres; expected supabase_admin.',
      ),
      z.literal('RPC execution contract mismatch for apply_literature_gold_import_v1.'),
      z.literal('RPC execution contract mismatch for compensate_literature_gold_import_v1.'),
      z.literal(
        'RPC execution contract mismatch for reconcile_literature_gold_review_operation_v1.',
      ),
    ]),
    ownerAclTerminalState: z.literal(OWNER_ACL_AUDIT_READY_TERMINAL_STATE),
  })
  .strict()

const reconciledPackageGenerationAuditSchema = z
  .object({
    checks: reconciledAuditChecksSchema,
    comparisons: auditComparisonsSchema,
    database: reconciledAuditDatabaseSchema,
    migration: auditMigrationSchema,
    readinessStatus: z.literal('ready'),
    result: z.literal('audit_ready_contract_compatibility_audit_required'),
    schemaVersion: z.literal('gold-import-compensation-reconciled-migration-audit/1.0.0'),
    status: z.literal('ready'),
  })
  .strict()

export const packageGenerationAuditSchema = z.union([
  legacyPackageGenerationAuditSchema,
  reconciledPackageGenerationAuditSchema,
])
export type PackageGenerationAudit = z.infer<typeof packageGenerationAuditSchema>

export interface VerifiedPostMigrationAuditPackage {
  audit: PackageGenerationAudit
  auditBytes: Buffer
  developmentPlanningState: z.infer<typeof developmentPlanningStateSchema>
  developmentPlanningStateBytes: Buffer
  expectedSchemaSecurityIdentitySha256: string
  manifestBytes: Buffer
  manifestSha256: string
  markdownBytes: Buffer
  reconciledEvidence: VerifiedReconciledAuditEvidence | null
  schemaSecurityDefinitionIdentity: Record<string, unknown>
  schemaSecurityDefinitionIdentityBytes: Buffer
}

export interface ReconciledAuditEvidenceBytes {
  contractDiagnosticsBytes: Buffer
  contractReconciliationBytes: Buffer
  readOnlyStateBracketBytes: Buffer
}

export interface VerifiedReconciledAuditEvidence extends ReconciledAuditEvidenceBytes {
  contractDiagnostics: Record<string, unknown>
  contractReconciliation: Record<string, unknown>
  readOnlyStateBracket: Record<string, unknown>
}

export interface PackageSourceIdentityPolicy {
  amendedAuthorizationSha256: string
  finalArtifactSha256: string
  migrationId: typeof MIGRATION_ID
  migrationSha256: string
  protocolAuthorizationSha256: string
}

export const PRODUCTION_SOURCE_IDENTITIES: PackageSourceIdentityPolicy = {
  amendedAuthorizationSha256: AMENDED_TWO_ROW_AUTHORIZATION_SHA256,
  finalArtifactSha256: FINAL_V3_ARTIFACT_SHA256,
  migrationId: MIGRATION_ID,
  migrationSha256: MIGRATION_SHA256,
  protocolAuthorizationSha256: SIGNED_PROTOCOL_AUTHORIZATION_SHA256,
}

export interface PackageSourceBytes {
  amendedAuthorization: Buffer
  finalArtifact: Buffer
  migration: Buffer
  protocolAuthorization: Buffer
}

export interface GeneratePackageInput {
  auditPackage: VerifiedPostMigrationAuditPackage
  identityPolicy?: PackageSourceIdentityPolicy
  sources: PackageSourceBytes
}

export interface GeneratedPackage {
  files: ReadonlyMap<string, Buffer>
  importPlan: ImportPlan
  manifestSha256: string
  packageDescriptor: Record<string, unknown>
}

interface CompensationPlanTemplate {
  actions: CompensationAction[]
  batchId: string
  binding: { contentSha256: string }
  contractVersion: typeof GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION
  counts: CompensationActionCounts
  executionContext: ImportPlan['executionContext']
  expectedEffectiveStateSha256: string
  expectedPhysicalState: {
    hash: null
    rule: 'database_observed_at_execution'
    source: 'committed_import_receipt.afterPhysicalStateSha256'
  }
  expectedPostEffectiveStateSha256: string
  expectedPostPhysicalState: {
    hash: null
    mustDifferFromPostImport: true
    mustDifferFromPreImport: true
    rule: 'database_observed_at_execution'
    source: 'committed_compensation_receipt.afterPhysicalStateSha256'
  }
  importPlanSha256: string
  importReceiptSha256: null
  idempotency: {
    derivationContextSha256: string
    key: null
    rule: 'derive_after_import_receipt_and_fresh_physical_state_are_bound'
  }
  kind: 'compensation_plan_template'
  operationId: string
  readiness: 'awaiting_committed_import_receipt_and_separate_authorization'
  scope: ImportPlan['scope']
  sourceArtifactSha256: string
  targetImportOperationId: string
}

function sha256Bytes(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalPretty(value: unknown): Buffer {
  const normalized = JSON.parse(canonicalJson(value)) as unknown
  return Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
}

function assertSha256(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} checksum mismatch: expected ${expected}, received ${actual}.`)
  }
}

/** A deterministic RFC-4122-shaped UUID derived only from canonical package inputs. */
export function deterministicPackageUuid(...parts: readonly unknown[]): string {
  const bytes = Buffer.from(sha256Canonical(parts).slice(0, 32), 'hex')
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function developmentPlanningStateSha256(value: unknown): string {
  return sha256Canonical(value)
}

function parseReadyAuditManifest(
  bytes: Buffer,
  expectedFiles: readonly string[],
): ReadonlyMap<string, string> {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (!text.endsWith('\n') || text.endsWith('\n\n')) {
    throw new Error('Post-migration audit manifest must have exactly one final newline.')
  }
  const entries = new Map<string, string>()
  let previous = ''
  for (const line of text.slice(0, -1).split('\n')) {
    const match = /^([a-f0-9]{64})  ([a-z0-9-]+\.(?:json|md))$/u.exec(line)
    if (!match) throw new Error('Post-migration audit manifest contains a malformed entry.')
    const [, checksum, name] = match
    if (name <= previous || entries.has(name)) {
      throw new Error('Post-migration audit manifest is not uniquely and strictly sorted.')
    }
    entries.set(name, checksum)
    previous = name
  }
  if (entries.size !== expectedFiles.length || expectedFiles.some((name) => !entries.has(name))) {
    throw new Error('Ready post-migration audit manifest does not bind the exact file inventory.')
  }
  return entries
}

function parseCanonicalAuditJson(bytes: Buffer, label: string): unknown {
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch (error) {
    throw new Error(
      `${label} is not valid UTF-8 canonical JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!bytes.equals(canonicalPretty(value))) {
    throw new Error(`${label} is not in the auditor's canonical sorted JSON representation.`)
  }
  return value
}

const reconciledContractStateHashesSchema = z
  .object({
    developmentMembershipSha256: sha256Schema,
    effectiveStateSha256: sha256Schema,
    physicalStateSha256: sha256Schema,
    readOnlyTransaction: z.literal(true),
  })
  .strict()

const reconciledReadOnlyStateBracketSchema = z
  .object({
    contractStateHashesAfter: reconciledContractStateHashesSchema,
    contractStateHashesBefore: reconciledContractStateHashesSchema,
    contractStateHashesMatch: z.literal(true),
    preMigrationBackupManifestSha256: sha256Schema,
    safety: z
      .object({
        compensationExecuted: z.literal(false),
        databaseMutationCount: z.literal(0),
        heldOutIdentitiesAccessed: z.literal(false),
        importExecuted: z.literal(false),
        readOnlyDiagnostics: z.literal(true),
        remoteDatabaseAccessed: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal('gold-import-compensation-contract-diagnostic-orchestration/1.0.0'),
    snapshotAfterSha256: sha256Schema,
    snapshotBeforeSha256: sha256Schema,
    snapshotsMatch: z.literal(true),
  })
  .strict()

function verifyReconciledAuditEvidence(
  audit: Extract<
    PackageGenerationAudit,
    { schemaVersion: 'gold-import-compensation-reconciled-migration-audit/1.0.0' }
  >,
  bytes: ReconciledAuditEvidenceBytes,
): VerifiedReconciledAuditEvidence {
  const contractDiagnostics = z
    .object({
      canonicalRpcNames: z.tuple([
        z.literal('apply_literature_gold_import_v1'),
        z.literal('compensate_literature_gold_import_v1'),
        z.literal('reconcile_literature_gold_review_operation_v1'),
      ]),
      functions: z.array(z.unknown()).length(3),
      normalizationRule: z.literal('postgres-function-definition-conservative-whitespace/v1'),
      readOnlyTransaction: z.literal(true),
      requestedNameDiscrepancies: z.tuple([
        z
          .object({
            aliasCreated: z.literal(false),
            canonicalName: z.literal('reconcile_literature_gold_review_operation_v1'),
            classification: z.literal('audit_expectation_defect'),
            requestedName: z.literal('reconcile_literature_gold_import_v1'),
          })
          .strict(),
      ]),
      roles: z.array(z.unknown()).nonempty(),
      schemaVersion: z.literal('gold-import-compensation-contract-diagnostics/1.0.0'),
      target: z
        .object({
          container: z.literal('supabase_db_ip-literature-local'),
          database: z.literal('postgres'),
          local: z.literal(true),
          port: z.literal('55322'),
          projectId: z.literal('ip-literature-local'),
        })
        .strict(),
      transactionIsolation: z.literal('repeatable read'),
    })
    .strict()
    .parse(parseCanonicalAuditJson(bytes.contractDiagnosticsBytes, 'contract-diagnostics.json'))
  const contractReconciliation = validateReadyLocalPostMigrationContractReconciliation(
    parseCanonicalAuditJson(bytes.contractReconciliationBytes, 'contract-reconciliation.json'),
  )
  const readOnlyStateBracket = reconciledReadOnlyStateBracketSchema.parse(
    parseCanonicalAuditJson(bytes.readOnlyStateBracketBytes, 'read-only-state-bracket.json'),
  )
  const { requestedNameDiscrepancies, ...auditReconciliation } = audit.checks.contractReconciliation
  if (
    canonicalJson(contractReconciliation) !== canonicalJson(auditReconciliation) ||
    canonicalJson(contractDiagnostics.requestedNameDiscrepancies) !==
      canonicalJson(requestedNameDiscrepancies) ||
    canonicalJson(contractDiagnostics.functions) !==
      canonicalJson(
        contractReconciliation.identities.actual.fullEnvironmentInventory.identity.rpcs,
      ) ||
    canonicalJson(contractDiagnostics.roles) !==
      canonicalJson(
        contractReconciliation.identities.actual.fullEnvironmentInventory.identity.deploymentProfile
          .roleInventory,
      )
  ) {
    throw new Error(
      'Reconciled diagnostic evidence does not match the migration-audit reconciliation binding.',
    )
  }
  const before = readOnlyStateBracket.contractStateHashesBefore
  const after = readOnlyStateBracket.contractStateHashesAfter
  if (
    canonicalJson(before) !== canonicalJson(after) ||
    readOnlyStateBracket.snapshotBeforeSha256 !== readOnlyStateBracket.snapshotAfterSha256 ||
    readOnlyStateBracket.preMigrationBackupManifestSha256 !==
      audit.database.preMigrationBackupManifestSha256 ||
    after.developmentMembershipSha256 !== audit.database.developmentMembershipSha256 ||
    after.effectiveStateSha256 !== audit.database.currentEffectiveStateSha256 ||
    after.physicalStateSha256 !== audit.database.currentPhysicalStateSha256
  ) {
    throw new Error(
      'Reconciled read-only state bracket does not match the ready migration audit state.',
    )
  }
  return {
    ...bytes,
    contractDiagnostics,
    contractReconciliation: contractReconciliation as unknown as Record<string, unknown>,
    readOnlyStateBracket,
  }
}

/**
 * Verify the complete canonical output of the read-only post-migration audit
 * against an independently reviewed manifest digest. This is the only ready
 * audit shape accepted by package generation.
 */
export function verifyReadyPostMigrationAuditPackage(input: {
  auditBytes: Buffer
  developmentPlanningStateBytes: Buffer
  manifestBytes: Buffer
  markdownBytes: Buffer
  reconciledEvidence?: ReconciledAuditEvidenceBytes
  schemaSecurityDefinitionIdentityBytes: Buffer
  expectedSchemaSecurityIdentitySha256ForTest?: string
  trustedManifestSha256: string
}): VerifiedPostMigrationAuditPackage {
  if (!SHA256_PATTERN.test(input.trustedManifestSha256)) {
    throw new Error('Reviewed post-migration audit manifest SHA-256 is invalid.')
  }
  if (sha256Bytes(input.manifestBytes) !== input.trustedManifestSha256) {
    throw new Error('Post-migration audit manifest does not match the reviewed SHA-256.')
  }
  const expectedSchemaSecurityIdentitySha256 =
    input.expectedSchemaSecurityIdentitySha256ForTest ??
    POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256
  if (
    input.expectedSchemaSecurityIdentitySha256ForTest !== undefined &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error('Schema/security identity override is restricted to tests.')
  }
  if (!SHA256_PATTERN.test(expectedSchemaSecurityIdentitySha256)) {
    throw new Error('Expected schema/security identity SHA-256 is invalid.')
  }
  const audit = assertPackageAuditReady(
    parseCanonicalAuditJson(input.auditBytes, 'migration-audit.json'),
    expectedSchemaSecurityIdentitySha256,
  )
  const isReconciled =
    audit.schemaVersion === 'gold-import-compensation-reconciled-migration-audit/1.0.0'
  if (isReconciled !== (input.reconciledEvidence !== undefined)) {
    throw new Error(
      isReconciled
        ? 'Reconciled post-migration audit is missing its exact diagnostic evidence files.'
        : 'Legacy post-migration audit must not supply reconciled diagnostic evidence files.',
    )
  }
  const entries = parseReadyAuditManifest(
    input.manifestBytes,
    isReconciled ? RECONCILED_READY_AUDIT_CANONICAL_FILES : LEGACY_READY_AUDIT_CANONICAL_FILES,
  )
  const fileBytes = new Map<string, Buffer>([
    ['development-planning-state.json', input.developmentPlanningStateBytes],
    ['migration-audit.json', input.auditBytes],
    ['migration-audit.md', input.markdownBytes],
    ['schema-security-definition-identity.json', input.schemaSecurityDefinitionIdentityBytes],
  ])
  if (input.reconciledEvidence) {
    fileBytes.set('contract-diagnostics.json', input.reconciledEvidence.contractDiagnosticsBytes)
    fileBytes.set(
      'contract-reconciliation.json',
      input.reconciledEvidence.contractReconciliationBytes,
    )
    fileBytes.set(
      'read-only-state-bracket.json',
      input.reconciledEvidence.readOnlyStateBracketBytes,
    )
  }
  for (const [name, expected] of entries) {
    const bytes = fileBytes.get(name)
    if (!bytes || sha256Bytes(bytes) !== expected) {
      throw new Error(`Post-migration audit checksum mismatch for ${name}.`)
    }
  }
  const developmentPlanningState = developmentPlanningStateSchema.parse(
    parseCanonicalAuditJson(input.developmentPlanningStateBytes, 'development-planning-state.json'),
  )
  const schemaSecurityDefinitionIdentity = z
    .object({
      records: z.array(z.unknown()).nonempty(),
      schemaVersion: z.literal(
        'gold-import-compensation-schema-security-definition-identity/1.0.0',
      ),
    })
    .passthrough()
    .parse(
      parseCanonicalAuditJson(
        input.schemaSecurityDefinitionIdentityBytes,
        'schema-security-definition-identity.json',
      ),
    )
  const actualSchemaSecurityIdentitySha256 = schemaSecurityDefinitionIdentitySha256(
    schemaSecurityDefinitionIdentity,
  )
  if (
    canonicalPretty(schemaSecurityDefinitionIdentity).equals(
      canonicalPretty(audit.checks.schemaSecurityDefinitionIdentity),
    ) === false ||
    actualSchemaSecurityIdentitySha256 !== audit.database.schemaSecurityIdentitySha256 ||
    (audit.schemaVersion === 'gold-import-compensation-migration-audit/1.0.0' &&
      audit.database.schemaSecurityIdentitySha256 !== expectedSchemaSecurityIdentitySha256)
  ) {
    throw new Error(
      'Post-migration schema/security definition identity does not match the ready audit binding.',
    )
  }
  if (
    developmentPlanningStateSha256(developmentPlanningState) !==
    audit.database.developmentPlanningStateSha256
  ) {
    throw new Error('Post-migration planning state does not match the ready audit binding.')
  }
  const markdown = new TextDecoder('utf-8', { fatal: true }).decode(input.markdownBytes)
  if (!markdown || !markdown.endsWith('\n') || markdown.endsWith('\n\n')) {
    throw new Error('Post-migration audit Markdown must have exactly one final newline.')
  }
  const reconciledEvidence =
    audit.schemaVersion === 'gold-import-compensation-reconciled-migration-audit/1.0.0'
      ? verifyReconciledAuditEvidence(
          audit,
          input.reconciledEvidence as ReconciledAuditEvidenceBytes,
        )
      : null
  return {
    audit,
    auditBytes: input.auditBytes,
    developmentPlanningState,
    developmentPlanningStateBytes: input.developmentPlanningStateBytes,
    expectedSchemaSecurityIdentitySha256:
      audit.schemaVersion === 'gold-import-compensation-migration-audit/1.0.0'
        ? expectedSchemaSecurityIdentitySha256
        : actualSchemaSecurityIdentitySha256,
    manifestBytes: input.manifestBytes,
    manifestSha256: input.trustedManifestSha256,
    markdownBytes: input.markdownBytes,
    reconciledEvidence,
    schemaSecurityDefinitionIdentity,
    schemaSecurityDefinitionIdentityBytes: input.schemaSecurityDefinitionIdentityBytes,
  }
}

function comparePmids(
  left: Pick<PackagePlanningRow, 'itemId' | 'pmid'>,
  right: Pick<PackagePlanningRow, 'itemId' | 'pmid'>,
): number {
  const leftNumber = BigInt(left.pmid)
  const rightNumber = BigInt(right.pmid)
  if (leftNumber < rightNumber) return -1
  if (leftNumber > rightNumber) return 1
  return left.itemId.localeCompare(right.itemId, 'en')
}

function strictArtifactBoolean(value: string, column: string): boolean {
  try {
    return parseFinalizedArtifactBooleanValue(value)
  } catch {
    throw new Error(
      `Finalized V3 artifact column ${column} must use exactly true, false, True, or False.`,
    )
  }
}

function artifactList(value: string): string[] {
  try {
    const parsed = parseFinalizedArtifactPipeList(value)
    if (parsed.reordered) {
      throw new Error('checksum-bound V3 list normalization is required')
    }
    return parsed.canonicalValues
  } catch {
    throw new Error('Finalized V3 artifact contains a noncanonical pipe-delimited list.')
  }
}

function parseFinalizedArtifactRecords(bytes: Buffer): FinalizedArtifactRecord[] {
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const parsed = parseCsvRows(decoded.startsWith('\uFEFF') ? decoded.slice(1) : decoded)
  const header = parsed[0]
  if (!header || new Set(header).size !== header.length) {
    throw new Error('Finalized V3 artifact has a missing or duplicate CSV header.')
  }
  const missing = FINALIZED_ARTIFACT_COLUMNS.filter((column) => !header.includes(column))
  if (missing.length > 0) {
    throw new Error(`Finalized V3 artifact is missing columns: ${missing.join(', ')}.`)
  }
  const indexes = Object.fromEntries(
    FINALIZED_ARTIFACT_COLUMNS.map((column) => [column, header.indexOf(column)]),
  ) as Record<FinalizedArtifactColumn, number>
  return parsed.slice(1).map((values, index) => {
    if (values.length !== header.length) {
      throw new Error(`Finalized V3 artifact record ${index + 2} has the wrong column count.`)
    }
    if (values[indexes.dataset_split] !== 'development') {
      throw new Error(
        `Finalized V3 artifact record ${index + 2} is not explicitly development-only.`,
      )
    }
    return Object.fromEntries(
      FINALIZED_ARTIFACT_COLUMNS.map((column) => [column, values[indexes[column]]]),
    ) as FinalizedArtifactRecord
  })
}

function targetReviewFromArtifact(
  record: FinalizedArtifactRecord,
  current: z.infer<typeof historicalEffectiveReviewSchema> | null,
  itemState: z.infer<typeof preImportItemStateSchema>,
): z.infer<typeof goldReviewPayloadSchema> {
  if (!record.technology_tag_status || !record.disease_tag_status) {
    throw new Error(
      'real_contract_incompatibility: finalized V3 artifact has a blank enrichment status required by contract 1.0.0; no executable package was generated.',
    )
  }
  const operational = current
    ? {
        completedAt: current.completedAt,
        createdAt: current.createdAt,
        reviewerEmail: current.reviewerEmail,
        reviewerUserId: current.reviewerUserId,
        reviewSeconds: current.reviewSeconds,
        startedAt: current.startedAt,
      }
    : {
        completedAt: PACKAGE_REVIEW_TIMESTAMP,
        createdAt: PACKAGE_REVIEW_TIMESTAMP,
        reviewerEmail: null,
        reviewerUserId: null,
        reviewSeconds: 0,
        startedAt: PACKAGE_REVIEW_TIMESTAMP,
      }
  const fullTextUsed = strictArtifactBoolean(record.full_text_used, 'full_text_used')
  if (fullTextUsed) {
    throw new Error(
      'real_contract_incompatibility: finalized V3 full_text_used provenance has no exact import v1 persistence mapping; no executable package was generated.',
    )
  }
  return goldReviewPayloadSchema.parse({
    ...operational,
    categorizationFromFullText: strictArtifactBoolean(
      record.categorization_from_full_text,
      'categorization_from_full_text',
    ),
    clinicalPurposes: artifactList(record.clinical_purposes),
    diseaseTagStatus: record.disease_tag_status,
    diseaseTags: artifactList(record.disease_tags),
    enrichmentProvenance: record.enrichment_provenance,
    enrichmentSchemaVersion: record.enrichment_schema_version,
    isBlinded: strictArtifactBoolean(record.is_blinded, 'is_blinded'),
    labelSchemaVersion: record.label_schema_version,
    metadataSufficiency: record.metadata_sufficiency,
    notes: resolveFinalizedArtifactNoteForImport({
      currentNote: current?.notes ?? null,
      identity: { masterRowId: record.master_row_id, pmid: record.pmid },
      sourceNote: record.physician_notes,
    }),
    publicationStatus: record.publication_status || null,
    relevanceLabel: record.physician_final_label,
    reviewerConfidence: record.physician_final_confidence,
    studyDesign: record.study_design || null,
    taxonomyVersion: record.taxonomy_version,
    technologyTagStatus: record.technology_tag_status,
    technologyTags: artifactList(record.technology_tags),
    topicIds: artifactList(record.topic_ids),
    usedSupplementalMetadata: itemState.supplementalMetadataRevealedAt !== null,
  })
}

function historicalClinicalProjection(
  review: z.infer<typeof historicalEffectiveReviewSchema>,
): Record<string, unknown> {
  return {
    categorizationFromFullText: review.categorizationFromFullText,
    clinicalPurposes: [...review.clinicalPurposes].sort(),
    diseaseTagStatus: review.diseaseTagStatus,
    diseaseTags: [...review.diseaseTags].sort(),
    enrichmentProvenance: review.enrichmentProvenance,
    enrichmentSchemaVersion: review.enrichmentSchemaVersion,
    isBlinded: review.isBlinded,
    labelSchemaVersion: review.labelSchemaVersion,
    metadataSufficiency: review.metadataSufficiency,
    notes: review.notes,
    publicationStatus: review.publicationStatus,
    relevanceLabel: review.relevanceLabel,
    reviewerConfidence: review.reviewerConfidence,
    reviewSeconds: review.reviewSeconds,
    studyDesign: review.studyDesign,
    taxonomyVersion: review.taxonomyVersion,
    technologyTagStatus: review.technologyTagStatus,
    technologyTags: [...review.technologyTags].sort(),
    topicIds: [...review.topicIds].sort(),
    usedSupplementalMetadata: review.usedSupplementalMetadata,
  }
}

/** Derive actions from the current read-only database state and finalized artifact. */
export function derivePackagePlanningRows(
  input: unknown,
  finalizedArtifact: Buffer,
): PackagePlanningRow[] {
  const state = developmentPlanningStateSchema.parse(input)
  const records = parseFinalizedArtifactRecords(finalizedArtifact)
  const recordsByItem = new Map(records.map((record) => [record.gold_set_item_id, record]))
  if (
    state.rows.length === 0 ||
    state.rows.length !== records.length ||
    recordsByItem.size !== records.length
  ) {
    throw new Error(
      'Development planning state and finalized V3 artifact must have identical nonempty membership.',
    )
  }
  const rows = state.rows.map((current, index): PackagePlanningRow => {
    if (current.sequence !== index + 1) {
      throw new Error('Development planning state sequence must be contiguous.')
    }
    const record = recordsByItem.get(current.itemId)
    if (!record || record.pmid !== current.pmid) {
      throw new Error(
        'Development planning state identities do not match the finalized V3 artifact.',
      )
    }
    const targetReview = targetReviewFromArtifact(
      record,
      current.currentEffectiveReview,
      current.itemState,
    )
    const common = {
      datasetSplit: 'development' as const,
      expectedCurrentReviewId: current.currentReviewId,
      expectedEffectiveReviewId: current.effectiveReviewId,
      itemId: current.itemId,
      pmid: current.pmid,
      preImportItemState: current.itemState,
      sequence: current.sequence,
      targetReview,
    }
    if (current.currentReviewId === null) {
      if (
        current.effectiveReviewId !== null ||
        current.currentRevision !== null ||
        current.currentEffectiveReview !== null
      ) {
        throw new Error('An initial import item has contradictory pre-existing review state.')
      }
      return initialPlanningRowSchema.parse({
        ...common,
        action: 'import_initial',
        expectedRevision: 1,
        expectedSupersedesReviewId: null,
      })
    }
    if (
      current.effectiveReviewId === null ||
      current.currentRevision === null ||
      current.currentEffectiveReview === null
    ) {
      throw new Error('A pre-reviewed import item is missing its effective review state.')
    }
    if (
      canonicalJson(goldReviewClinicalProjection(targetReview)) ===
      canonicalJson(historicalClinicalProjection(current.currentEffectiveReview))
    ) {
      return noopPlanningRowSchema.parse({
        ...common,
        action: 'import_noop',
        expectedRevision: null,
        expectedSupersedesReviewId: null,
      })
    }
    return revisionPlanningRowSchema.parse({
      ...common,
      action: 'import_revision',
      expectedRevision: current.currentRevision + 1,
      expectedSupersedesReviewId: current.currentReviewId,
    })
  })
  deriveImportActionCounts(rows)
  return rows
}

export function deriveImportActionCounts(rows: readonly PackagePlanningRow[]): ImportActionCounts {
  const counts = {
    initial: rows.filter((row) => row.action === 'import_initial').length,
    inserts: rows.filter((row) => row.action !== 'import_noop').length,
    noops: rows.filter((row) => row.action === 'import_noop').length,
    revisions: rows.filter((row) => row.action === 'import_revision').length,
    total: rows.length,
  }
  if (counts.total === 0 || counts.initial + counts.revisions + counts.noops !== counts.total) {
    throw new Error('Planning rows do not form a complete dynamic action partition.')
  }
  const itemIds = rows.map((row) => row.itemId)
  const pmids = rows.map((row) => row.pmid)
  if (new Set(itemIds).size !== rows.length || new Set(pmids).size !== rows.length) {
    throw new Error('Planning rows must contain exactly one development item and PMID each.')
  }
  rows.forEach((row, index) => {
    if (row.sequence !== index + 1) throw new Error('Planning row sequence must be contiguous.')
    if (
      row.action === 'import_revision' &&
      row.expectedSupersedesReviewId !== row.expectedCurrentReviewId
    ) {
      throw new Error('Every additive revision must supersede its current physical head.')
    }
    if (row.action === 'import_noop') {
      if (
        row.expectedCurrentReviewId !== row.expectedEffectiveReviewId ||
        row.preImportItemState.reviewStatus !== 'completed'
      ) {
        throw new Error('An identical-content no-op must preserve one completed effective head.')
      }
    }
  })
  return counts
}

function usesProductionSourceIdentityPolicy(policy: PackageSourceIdentityPolicy): boolean {
  return (
    policy.amendedAuthorizationSha256 === PRODUCTION_SOURCE_IDENTITIES.amendedAuthorizationSha256 &&
    policy.finalArtifactSha256 === PRODUCTION_SOURCE_IDENTITIES.finalArtifactSha256 &&
    policy.migrationId === PRODUCTION_SOURCE_IDENTITIES.migrationId &&
    policy.migrationSha256 === PRODUCTION_SOURCE_IDENTITIES.migrationSha256 &&
    policy.protocolAuthorizationSha256 === PRODUCTION_SOURCE_IDENTITIES.protocolAuthorizationSha256
  )
}

function compatibilityExecutionBlockerSummary(
  resolution: GoldImportCompensationCompatibilityResolution,
): string {
  const counts = Object.entries(resolution.executionCompatibility.countsByCode)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => `${code}=${count}`)
    .join(', ')
  return `${resolution.executionCompatibility.blockedRowCount} of ${resolution.executionCompatibility.totalRowCount} rows are blocked${counts.length > 0 ? ` (${counts})` : ''}`
}

function packagePlanningRowsFromCompatibility(
  planningStateInput: unknown,
  resolution: GoldImportCompensationCompatibilityResolution,
): PackagePlanningRow[] {
  const state = developmentPlanningStateSchema.parse(planningStateInput)
  if (!resolution.readyForPackage || resolution.actionCounts.unresolved !== 0) {
    throw new Error(
      `Package generation blocked: finalized source is not executable under the current import contract; ${compatibilityExecutionBlockerSummary(resolution)}.`,
    )
  }
  const resolutionsByItem = new Map(
    resolution.planningRows.map((row) => [row.identity.itemId, row]),
  )
  if (resolutionsByItem.size !== state.rows.length) {
    throw new Error('Compatibility resolution does not cover every development planning row.')
  }
  return state.rows.map((current): PackagePlanningRow => {
    const resolved = resolutionsByItem.get(current.itemId)
    if (
      !resolved ||
      resolved.identity.pmid !== current.pmid ||
      resolved.sequence !== current.sequence ||
      resolved.proposedAction === null ||
      resolved.targetReview === null ||
      resolved.resolutionStatus !== 'resolved'
    ) {
      throw new Error('Compatibility resolution contains an unresolved or mismatched row.')
    }
    const common = {
      expectedCurrentReviewId: current.currentReviewId,
      expectedEffectiveReviewId: current.effectiveReviewId,
      itemId: current.itemId,
      pmid: current.pmid,
      preImportItemState: current.itemState,
      sequence: current.sequence,
      targetReview: resolved.targetReview,
    }
    if (resolved.proposedAction === 'import_initial') {
      if (
        current.currentReviewId !== null ||
        current.effectiveReviewId !== null ||
        current.currentRevision !== null ||
        current.currentEffectiveReview !== null
      ) {
        throw new Error('Compatibility initial action contradicts existing review state.')
      }
      return initialPlanningRowSchema.parse({
        ...common,
        action: 'import_initial',
        expectedRevision: 1,
        expectedSupersedesReviewId: null,
      })
    }
    if (
      current.currentReviewId === null ||
      current.effectiveReviewId === null ||
      current.currentRevision === null ||
      current.currentEffectiveReview === null
    ) {
      throw new Error('Compatibility existing-head action is missing current review state.')
    }
    if (resolved.proposedAction === 'import_noop') {
      return noopPlanningRowSchema.parse({
        ...common,
        action: 'import_noop',
        expectedRevision: null,
        expectedSupersedesReviewId: null,
      })
    }
    return revisionPlanningRowSchema.parse({
      ...common,
      action: 'import_revision',
      expectedRevision: current.currentRevision + 1,
      expectedSupersedesReviewId: current.currentReviewId,
    })
  })
}

/**
 * This gate is intentionally usable before any source file is opened. The CLI
 * invokes it immediately after parsing --audit so pre-migration runs stop with
 * a stable not_yet_migrated result and cannot generate an executable package.
 */
export function assertPackageAuditReady(
  input: unknown,
  expectedSchemaSecurityIdentitySha256 = POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
): PackageGenerationAudit {
  const audit = packageGenerationAuditSchema.parse(input)
  if (
    audit.status === 'not_yet_migrated' ||
    audit.readinessStatus === 'not_yet_migrated' ||
    !audit.migration.applied
  ) {
    throw new Error(
      'Package generation blocked: not_yet_migrated; source artifacts were not inspected.',
    )
  }
  if (audit.status !== 'ready' || audit.readinessStatus !== 'ready') {
    throw new Error('Package generation blocked: post-migration audit is not ready.')
  }
  if (
    audit.migration.id !== MIGRATION_ID ||
    audit.migration.sha256 !== MIGRATION_SHA256 ||
    audit.migration.ledgerOccurrences !== 1
  ) {
    throw new Error('Package generation blocked: exact migration identity is not present once.')
  }
  const database = audit.database
  if (
    database.targetDatabase !== 'local' ||
    database.remoteWritesAllowed ||
    !database.readOnlyAudit
  ) {
    throw new Error('Package generation accepts only a read-only local post-migration audit.')
  }
  if (database.heldOutIdentitiesAccessed) {
    throw new Error('Package generation refuses any audit that accessed held-out identities.')
  }
  if (database.preMigrationBackupManifestSha256 === null) {
    throw new Error('Package generation blocked: pre-migration backup manifest is not bound.')
  }
  if (database.developmentPlanningStateSha256 === null) {
    throw new Error('Package generation blocked: audited development planning state is not bound.')
  }
  if (audit.checks.schemaSecurityDefinitionIdentity === null) {
    throw new Error(
      'Package generation blocked: exact post-migration schema/security definition identity is not bound.',
    )
  }
  if (audit.schemaVersion === 'gold-import-compensation-migration-audit/1.0.0') {
    if (
      audit.checks.expectedSchemaSecurityIdentitySha256 !== database.schemaSecurityIdentitySha256 ||
      database.schemaSecurityIdentitySha256 !== expectedSchemaSecurityIdentitySha256
    ) {
      throw new Error(
        'Package generation blocked: legacy exact schema/security definition identity is not bound.',
      )
    }
  } else {
    const reconciliation = audit.checks.contractReconciliation
    if (
      audit.checks.forwardMigrationRequired ||
      audit.checks.expectedSchemaSecurityIdentitySha256 !== database.schemaSecurityIdentitySha256 ||
      reconciliation.identities.actual.contractInvariant.sha256 !==
        audit.database.contractInvariantIdentitySha256 ||
      reconciliation.identities.expected.contractInvariant.sha256 !==
        audit.database.contractInvariantIdentitySha256 ||
      reconciliation.identities.actual.deploymentProfile.sha256 !==
        audit.database.environmentProfileIdentitySha256 ||
      reconciliation.identities.actual.fullEnvironmentInventory.sha256 !==
        audit.database.fullEnvironmentInventoryIdentitySha256 ||
      reconciliation.deploymentProfile.actualIdentity.sha256 !==
        audit.database.environmentProfileIdentitySha256 ||
      reconciliation.deploymentProfile.expectedIdentity.sha256 !==
        audit.database.environmentProfileIdentitySha256
    ) {
      throw new Error(
        'Package generation blocked: reconciled invariant/profile/full identities are inconsistent.',
      )
    }
  }
  if (
    audit.checks.failures.length > 0 ||
    audit.comparisons.reviewMutationCount !== 0 ||
    audit.comparisons.pointerMutationCount !== 0 ||
    !audit.comparisons.effectiveStatePreserved ||
    !audit.comparisons.priorMigrationLedgerRowsUnchanged ||
    !audit.comparisons.priorPhysicalStatePreserved ||
    !audit.comparisons.aggregateTestLockStateUnchanged ||
    !audit.comparisons.schemaChangedAsExpected ||
    audit.comparisons.preEffectiveStateSha256 !== audit.comparisons.postEffectiveStateSha256 ||
    audit.comparisons.postEffectiveStateSha256 !== database.currentEffectiveStateSha256 ||
    audit.comparisons.preexistingPhysicalStateBeforeSha256 !==
      audit.comparisons.preexistingPhysicalStateAfterSha256 ||
    audit.comparisons.postContractPhysicalStateSha256 !== database.currentPhysicalStateSha256 ||
    audit.comparisons.postSchemaSecurityIdentitySha256 !== database.schemaSecurityIdentitySha256
  ) {
    throw new Error('Package generation blocked: post-migration audit comparisons did not pass.')
  }
  const failedGates = [
    ['stateFresh', database.stateFresh],
    ['testSplitLocked', database.testSplitLocked],
    ['revisionChainsLinear', database.revisionChainsLinear],
    ['currentPointersAreLatestHeads', database.currentPointersAreLatestHeads],
  ].filter(([, passed]) => !passed)
  if (failedGates.length > 0) {
    throw new Error(
      `Package generation blocked by audit gate(s): ${failedGates.map(([name]) => name).join(', ')}.`,
    )
  }
  return audit
}

function executionContext(audit: PackageGenerationAudit): ImportPlan['executionContext'] {
  return {
    compensationRpc: 'compensate_literature_gold_import_v1',
    developmentMembershipHash: 'literature_gold_development_membership_hash_v1',
    effectiveStateHash: 'literature_gold_effective_state_hash_v1',
    importRpc: 'apply_literature_gold_import_v1',
    migrationId: MIGRATION_ID,
    physicalStateHash: 'literature_gold_physical_state_hash_v1',
    reconciliationRpc: 'reconcile_literature_gold_review_operation_v1',
    remoteWritesAllowed: false,
    repositoryCommitSha: audit.database.repositoryCommitSha,
    targetDatabase: 'local',
  }
}

function buildImportActions(
  rows: readonly PackagePlanningRow[],
  operationId: string,
): ImportAction[] {
  return rows.map((row) => {
    const actionId = deterministicPackageUuid(
      PACKAGE_VERSION,
      operationId,
      'import-action',
      row.itemId,
    )
    const common = {
      actionId,
      datasetSplit: 'development' as const,
      expectedCurrentReviewId: row.expectedCurrentReviewId,
      expectedEffectiveReviewId: row.expectedEffectiveReviewId,
      itemId: row.itemId,
      pmid: row.pmid,
      preImportItemState: row.preImportItemState,
      sequence: row.sequence,
    }
    if (row.action === 'import_noop') {
      const candidateReview = goldReviewClinicalProjection(row.targetReview)
      return importActionSchema.parse({
        ...common,
        action: 'import_noop',
        candidateReview,
        candidateReviewSha256: sha256Canonical(candidateReview),
        compensationAction: 'compensate_noop',
        expectedEventSequence: [],
        expectedHeadReviewIdAfter: row.expectedCurrentReviewId,
        expectedEffectiveReviewIdAfter: row.expectedEffectiveReviewId,
        expectedRevision: null,
        expectedSupersedesReviewId: null,
        importedReviewId: null,
      })
    }
    const importedReviewId = deterministicPackageUuid(
      PACKAGE_VERSION,
      operationId,
      'import-review',
      row.itemId,
    )
    return importActionSchema.parse({
      ...common,
      action: row.action,
      compensationAction:
        row.action === 'import_initial' ? 'compensate_void' : 'compensate_restore',
      expectedEventSequence: ['review_imported'],
      expectedHeadReviewIdAfter: importedReviewId,
      expectedEffectiveReviewIdAfter: importedReviewId,
      expectedRevision: row.expectedRevision,
      expectedSupersedesReviewId: row.expectedSupersedesReviewId,
      importedReviewId,
      review: row.targetReview,
      reviewSha256: sha256Canonical(row.targetReview),
    })
  })
}

function expectedPostImportEffectiveStateSha256(rows: readonly PackagePlanningRow[]): string {
  return sha256Canonical({
    datasetSplit: 'development',
    items: [...rows].sort(comparePmids).map((row) => ({
      pmid: row.pmid,
      review: goldReviewClinicalProjection(row.targetReview),
      reviewStatus:
        row.action === 'import_noop' ? row.preImportItemState.reviewStatus : 'completed',
    })),
    projectionVersion: 'literature-gold-effective-state-v1',
  })
}

function buildCompensationTemplate(
  audit: PackageGenerationAudit,
  importPlan: ImportPlan,
): CompensationPlanTemplate {
  const operationId = deterministicPackageUuid(
    PACKAGE_VERSION,
    importPlan.binding.contentSha256,
    'compensation-operation',
  )
  const actions = importPlan.actions.map((source): CompensationAction => {
    const actionId = deterministicPackageUuid(
      PACKAGE_VERSION,
      operationId,
      'compensation-action',
      source.itemId,
    )
    const common = {
      actionId,
      datasetSplit: 'development' as const,
      itemId: source.itemId,
      pmid: source.pmid,
      sequence: source.sequence,
      sourceActionId: source.actionId,
    }
    if (source.action === 'import_noop') {
      return compensationActionSchema.parse({
        ...common,
        action: 'compensate_noop',
        compensationReviewId: null,
        effectiveSourceReviewId: source.expectedEffectiveReviewId,
        expectedCurrentReviewId: source.expectedCurrentReviewId,
        expectedEffectiveReviewId: source.expectedEffectiveReviewId,
        expectedEffectiveReviewIdAfter: source.expectedEffectiveReviewId,
        expectedEventSequence: [],
        expectedHeadReviewIdAfter: source.expectedCurrentReviewId,
        expectedRevision: null,
        expectedSupersedesReviewId: null,
        importedReviewId: null,
      })
    }
    const compensationReviewId = deterministicPackageUuid(
      PACKAGE_VERSION,
      operationId,
      'compensation-review',
      source.itemId,
    )
    if (source.action === 'import_initial') {
      return compensationActionSchema.parse({
        ...common,
        action: 'compensate_void',
        compensationReviewId,
        effectiveSourceReviewId: null,
        expectedCurrentReviewId: source.importedReviewId,
        expectedEffectiveReviewId: source.importedReviewId,
        expectedEffectiveReviewIdAfter: null,
        expectedEventSequence: ['review_voided'],
        expectedHeadReviewIdAfter: compensationReviewId,
        expectedRevision: source.expectedRevision + 1,
        expectedSupersedesReviewId: source.importedReviewId,
        importedReviewId: source.importedReviewId,
      })
    }
    return compensationActionSchema.parse({
      ...common,
      action: 'compensate_restore',
      compensationReviewId,
      effectiveSourceReviewId: source.expectedEffectiveReviewId,
      expectedCurrentReviewId: source.importedReviewId,
      expectedEffectiveReviewId: source.importedReviewId,
      expectedEffectiveReviewIdAfter: source.expectedEffectiveReviewId,
      expectedEventSequence: ['review_compensated'],
      expectedHeadReviewIdAfter: compensationReviewId,
      expectedRevision: source.expectedRevision + 1,
      expectedSupersedesReviewId: source.importedReviewId,
      importedReviewId: source.importedReviewId,
    })
  })

  const counts = {
    noops: actions.filter((action) => action.action === 'compensate_noop').length,
    restored: actions.filter((action) => action.action === 'compensate_restore').length,
    total: actions.length,
    voided: actions.filter((action) => action.action === 'compensate_void').length,
  }
  if (
    counts.total === 0 ||
    counts.noops + counts.restored + counts.voided !== counts.total ||
    counts.total !== importPlan.actions.length
  ) {
    throw new Error(
      'Compensation actions do not form a complete dynamic mapping of the import plan.',
    )
  }
  const content = {
    actions,
    batchId: audit.database.batchId,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    counts,
    executionContext: importPlan.executionContext,
    expectedEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
    expectedPhysicalState: {
      hash: null,
      rule: 'database_observed_at_execution' as const,
      source: 'committed_import_receipt.afterPhysicalStateSha256' as const,
    },
    expectedPostEffectiveStateSha256: audit.database.currentEffectiveStateSha256,
    expectedPostPhysicalState: {
      hash: null,
      mustDifferFromPostImport: true as const,
      mustDifferFromPreImport: true as const,
      rule: 'database_observed_at_execution' as const,
      source: 'committed_compensation_receipt.afterPhysicalStateSha256' as const,
    },
    importPlanSha256: importPlan.binding.contentSha256,
    importReceiptSha256: null,
    idempotency: {
      derivationContextSha256: sha256Canonical({
        contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
        importPlanSha256: importPlan.binding.contentSha256,
        kind: 'compensation',
        operationId,
        targetImportOperationId: importPlan.operationId,
      }),
      key: null,
      rule: 'derive_after_import_receipt_and_fresh_physical_state_are_bound' as const,
    },
    kind: 'compensation_plan_template' as const,
    operationId,
    readiness: 'awaiting_committed_import_receipt_and_separate_authorization' as const,
    scope: importPlan.scope,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    targetImportOperationId: importPlan.operationId,
  }
  return { ...content, binding: { contentSha256: sha256Canonical(content) } }
}

function assertNoPointerRewind(compensation: CompensationPlanTemplate): void {
  rejectLegacyPointerRewindRollback(compensation)
  for (const action of compensation.actions) {
    if (action.action === 'compensate_noop') continue
    if (
      action.expectedHeadReviewIdAfter !== action.compensationReviewId ||
      action.expectedHeadReviewIdAfter === action.expectedSupersedesReviewId ||
      action.expectedHeadReviewIdAfter === action.effectiveSourceReviewId
    ) {
      throw new Error('Compensation must append and point to a new latest physical chain head.')
    }
  }
}

function buildManifest(files: ReadonlyMap<string, Buffer>): Buffer {
  const lines = [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([path, bytes]) => `${sha256Bytes(bytes)}  ${path}`)
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

export function generateGoldImportCompensationPackage(
  input: GeneratePackageInput,
): GeneratedPackage {
  const auditPackage = verifyReadyPostMigrationAuditPackage({
    auditBytes: input.auditPackage.auditBytes,
    developmentPlanningStateBytes: input.auditPackage.developmentPlanningStateBytes,
    manifestBytes: input.auditPackage.manifestBytes,
    markdownBytes: input.auditPackage.markdownBytes,
    reconciledEvidence: input.auditPackage.reconciledEvidence
      ? {
          contractDiagnosticsBytes: input.auditPackage.reconciledEvidence.contractDiagnosticsBytes,
          contractReconciliationBytes:
            input.auditPackage.reconciledEvidence.contractReconciliationBytes,
          readOnlyStateBracketBytes:
            input.auditPackage.reconciledEvidence.readOnlyStateBracketBytes,
        }
      : undefined,
    schemaSecurityDefinitionIdentityBytes: input.auditPackage.schemaSecurityDefinitionIdentityBytes,
    expectedSchemaSecurityIdentitySha256ForTest:
      input.auditPackage.audit.schemaVersion === 'gold-import-compensation-migration-audit/1.0.0' &&
      input.auditPackage.expectedSchemaSecurityIdentitySha256 !==
        POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256
        ? input.auditPackage.expectedSchemaSecurityIdentitySha256
        : undefined,
    trustedManifestSha256: input.auditPackage.manifestSha256,
  })
  const audit = auditPackage.audit
  const policy = input.identityPolicy ?? PRODUCTION_SOURCE_IDENTITIES
  if (
    input.identityPolicy !== undefined &&
    !usesProductionSourceIdentityPolicy(input.identityPolicy) &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error('Non-production source identity policies are restricted to tests.')
  }
  if (policy.migrationId !== MIGRATION_ID) throw new Error('Unsupported migration identity policy.')
  const sourceIdentities = {
    amendedAuthorizationSha256: sha256Bytes(input.sources.amendedAuthorization),
    finalArtifactSha256: sha256Bytes(input.sources.finalArtifact),
    migrationSha256: sha256Bytes(input.sources.migration),
    protocolAuthorizationSha256: sha256Bytes(input.sources.protocolAuthorization),
  }
  assertSha256(
    sourceIdentities.finalArtifactSha256,
    policy.finalArtifactSha256,
    'Finalized V3 development artifact',
  )
  assertSha256(
    sourceIdentities.protocolAuthorizationSha256,
    policy.protocolAuthorizationSha256,
    'Signed 305-row protocol authorization',
  )
  assertSha256(
    sourceIdentities.amendedAuthorizationSha256,
    policy.amendedAuthorizationSha256,
    'Amended two-row authorization',
  )
  assertSha256(sourceIdentities.migrationSha256, policy.migrationSha256, 'Exact merged migration')

  const planningRowsContainer = auditPackage.developmentPlanningState
  if (
    developmentPlanningStateSha256(planningRowsContainer) !==
    audit.database.developmentPlanningStateSha256
  ) {
    throw new Error(
      'Package generation blocked: development planning state does not match the ready audit.',
    )
  }
  let compatibilityBindingContext: CompatibilityAuditBindingContext | null = null
  let compatibilityResolution: GoldImportCompensationCompatibilityResolution | null = null
  if (usesProductionSourceIdentityPolicy(policy)) {
    if (audit.schemaVersion !== 'gold-import-compensation-reconciled-migration-audit/1.0.0') {
      throw new Error(
        'Package generation blocked: production sources require the reconciled post-migration audit.',
      )
    }
    compatibilityBindingContext = {
      contract: {
        environmentInvariantIdentitySha256: audit.database.contractInvariantIdentitySha256,
        environmentProfileIdentitySha256: audit.database.environmentProfileIdentitySha256,
      },
      currentDatabase: {
        batchId: audit.database.batchId,
        developmentMembershipSha256: audit.database.developmentMembershipSha256,
        developmentPlanningStateSha256: audit.database.developmentPlanningStateSha256,
        effectiveStateSha256: audit.database.currentEffectiveStateSha256,
        physicalStateSha256: audit.database.currentPhysicalStateSha256,
      },
      finalV3ArtifactSha256: sourceIdentities.finalArtifactSha256,
      migration: { id: MIGRATION_ID, sha256: sourceIdentities.migrationSha256 },
    }
    compatibilityResolution = resolveGoldImportCompensationCompatibility({
      bindingContext: compatibilityBindingContext,
      developmentPlanningState: planningRowsContainer,
      finalizedArtifact: input.sources.finalArtifact,
    })
    if (!compatibilityResolution.readyForPackage) {
      throw new Error(
        `Package generation blocked: finalized source is not executable under the current import contract; ${compatibilityExecutionBlockerSummary(compatibilityResolution)}.`,
      )
    }
  }
  const rows = compatibilityResolution
    ? packagePlanningRowsFromCompatibility(planningRowsContainer, compatibilityResolution)
    : derivePackagePlanningRows(planningRowsContainer, input.sources.finalArtifact)
  const importCounts = deriveImportActionCounts(rows)
  if (compatibilityResolution && !compatibilityBindingContext) {
    throw new Error('Package compatibility resolution is missing its exact audit binding context.')
  }
  const compatibilityAuthorization = compatibilityResolution
    ? {
        actionCounts: compatibilityResolution.actionCounts,
        bindings: {
          ...compatibilityBindingContext!,
          existingHeadCohortSha256: compatibilityResolution.existingHeadCohortSha256,
        },
        booleanNormalizationLedger: compatibilityResolution.artifact.booleanNormalizations,
        booleanNormalizationLedgerSha256: sha256Canonical(
          compatibilityResolution.artifact.booleanNormalizations,
        ),
        listNormalizationLedger: compatibilityResolution.artifact.listNormalizations,
        listNormalizationLedgerSha256: sha256Canonical(
          compatibilityResolution.artifact.listNormalizations,
        ),
        noteDisposition: compatibilityResolution.noteDisposition,
        resolutionSchemaVersion: compatibilityResolution.schemaVersion,
        scope: {
          datasetSplit: 'development' as const,
          heldOutIdentitiesAccessed: false as const,
          remoteWritesAllowed: false as const,
          targetDatabase: 'local' as const,
        },
      }
    : null
  const authorizationSet = compatibilityAuthorization
    ? {
        amendedTwoRowAuthorizationSha256: sourceIdentities.amendedAuthorizationSha256,
        compatibility: compatibilityAuthorization,
        finalArtifactSha256: sourceIdentities.finalArtifactSha256,
        kind: 'gold_import_source_authorization_set',
        signedProtocolAuthorizationSha256: sourceIdentities.protocolAuthorizationSha256,
        sourceDecisionsChanged: false,
        version: 3,
      }
    : {
        amendedTwoRowAuthorizationSha256: sourceIdentities.amendedAuthorizationSha256,
        finalArtifactSha256: sourceIdentities.finalArtifactSha256,
        kind: 'gold_import_source_authorization_set',
        signedProtocolAuthorizationSha256: sourceIdentities.protocolAuthorizationSha256,
        sourceDecisionsChanged: false,
        version: 1,
      }
  const validatedAuthorizationSet = validateGoldImportSourceAuthorizationSet(
    authorizationSet,
    sourceIdentities.finalArtifactSha256,
  )
  const authorizationSetBytes = canonicalPretty(validatedAuthorizationSet)
  const sourceAuthorizationSetSha256 = sha256Bytes(authorizationSetBytes)
  const operationId = deterministicPackageUuid(
    PACKAGE_VERSION,
    audit.database.batchId,
    audit.database.currentPhysicalStateSha256,
    audit.database.currentEffectiveStateSha256,
    sourceIdentities,
    'import-operation',
  )
  const actions = buildImportActions(rows, operationId)
  const importPlan = bindImportPlan({
    actions,
    batchId: audit.database.batchId,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    counts: importCounts,
    executionContext: executionContext(audit),
    expectedEffectiveStateSha256: audit.database.currentEffectiveStateSha256,
    expectedPhysicalStateSha256: audit.database.currentPhysicalStateSha256,
    expectedPostEffectiveStateSha256: expectedPostImportEffectiveStateSha256(rows),
    kind: 'import',
    operationId,
    scope: {
      datasetSplit: 'development',
      developmentMembershipSha256: audit.database.developmentMembershipSha256,
      heldOutIdentitiesAccessed: false,
    },
    sourceArtifactSha256: sourceIdentities.finalArtifactSha256,
    sourceAuthorizationSetSha256,
  })
  validateGoldImportSourceArtifact({
    compatibility: compatibilityResolution
      ? {
          booleanNormalizationLedger: compatibilityResolution.artifact.booleanNormalizations,
          listNormalizationLedger: compatibilityResolution.artifact.listNormalizations,
          noteDisposition: compatibilityResolution.noteDisposition,
        }
      : undefined,
    csvText: new TextDecoder('utf-8', { fatal: true }).decode(input.sources.finalArtifact),
    plan: importPlan,
  })

  const compensation = buildCompensationTemplate(audit, importPlan)
  assertNoPointerRewind(compensation)
  const importAuthorizationTemplate = {
    authorized: null,
    authorizedAt: null,
    authorizedBy: null,
    authorizationId: null,
    authorizationNote: null,
    binding: null,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    expectedEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
    expectedPostEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
    idempotencyKey: importPlan.binding.idempotencyKey,
    kind: 'import_authorization',
    migrationId: MIGRATION_ID,
    operationId: importPlan.operationId,
    planSha256: importPlan.binding.contentSha256,
    readiness: 'unsigned_separate_import_authorization_required',
    remoteWritesAllowed: false,
    repositoryCommitSha: audit.database.repositoryCommitSha,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    targetDatabase: 'local',
  }
  const compensationAuthorizationTemplate = {
    authorized: null,
    authorizedAt: null,
    authorizedBy: null,
    authorizationId: null,
    authorizationNote: null,
    binding: null,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    expectedEffectiveStateSha256: compensation.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: null,
    expectedPostEffectiveStateSha256: compensation.expectedPostEffectiveStateSha256,
    idempotencyKey: null,
    idempotencyKeyDerivation: compensation.idempotency,
    importReceiptSha256: null,
    kind: 'compensation_authorization',
    migrationId: MIGRATION_ID,
    operationId: compensation.operationId,
    planSha256: null,
    readiness: 'requires_committed_import_receipt_fresh_state_and_separate_authorization',
    remoteWritesAllowed: false,
    repositoryCommitSha: audit.database.repositoryCommitSha,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    targetDatabase: 'local',
    targetImportOperationId: importPlan.operationId,
  }
  const stateHashProof = {
    compensation: {
      expectedEffectiveStateSha256: compensation.expectedEffectiveStateSha256,
      expectedPhysicalState: compensation.expectedPhysicalState,
      expectedPostEffectiveStateSha256: compensation.expectedPostEffectiveStateSha256,
      expectedPostPhysicalState: compensation.expectedPostPhysicalState,
    },
    import: {
      expectedEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
      expectedPostEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
      expectedPostPhysicalState: {
        hash: null,
        mustDifferFromPreImport: true,
        rule: 'database_observed_at_execution',
        source: 'committed_import_receipt.afterPhysicalStateSha256',
      },
    },
    invariant:
      'Append-only compensation restores effective state but never claims physical database equality.',
    schemaVersion: 'gold-import-compensation-state-hash-proof/v1',
  }
  const compensationReadiness = {
    actionCounts: compensation.counts,
    appendOnly: true,
    currentPointerAlwaysLatestPhysicalHead: true,
    importExecuted: false,
    noDeleteOrUpdateOfImportedReview: true,
    noPointerNullingWithImportedHistory: true,
    noPointerRewind: true,
    readyToExecute: false,
    reason:
      'A committed import receipt, fresh database-observed physical state, finalized compensation plan, and separate compensation authorization do not yet exist.',
    schemaSecurityIdentitySha256: audit.database.schemaSecurityIdentitySha256,
    sourceMappingComplete: true,
  }
  const reconciliation = {
    automaticRetryAllowed: false,
    import: {
      nextStep:
        'Use a separately authorized read-only reconcile command for the exact operation ID, plan hash, and idempotency key.',
      operationId: importPlan.operationId,
      planSha256: importPlan.binding.contentSha256,
    },
    compensation: {
      nextStep:
        'Do not create or retry compensation until the import receipt is reconciled and a fresh compensation plan is separately authorized.',
      operationId: compensation.operationId,
      targetImportOperationId: importPlan.operationId,
    },
    kind: 'ambiguous_outcome_reconciliation_instructions',
    recoveryMutationsAllowed: false,
  }
  const rowBindings = importPlan.actions.map((importAction, index) => {
    const compensationAction = compensation.actions[index]
    if (!compensationAction || compensationAction.sourceActionId !== importAction.actionId) {
      throw new Error('Compensation action order is not exactly aligned with import action order.')
    }
    return {
      compensationActionId: compensationAction.actionId,
      compensationOperation: {
        derivationContextSha256: compensation.idempotency.derivationContextSha256,
        idempotencyKey: null,
        operationId: compensation.operationId,
        rule: compensation.idempotency.rule,
      },
      idempotencyScope: 'operation_not_per_action',
      importActionId: importAction.actionId,
      importOperation: {
        idempotencyKey: importPlan.binding.idempotencyKey,
        operationId: importPlan.operationId,
      },
      itemId: importAction.itemId,
      perActionIdempotencyKey: null,
      pmid: importAction.pmid,
      sequence: importAction.sequence,
    }
  })
  const packageDescriptor: Record<string, unknown> = {
    audit: {
      canonicalManifestSha256: auditPackage.manifestSha256,
      contentSha256: sha256Bytes(auditPackage.auditBytes),
      developmentPlanningStateFileSha256: sha256Bytes(auditPackage.developmentPlanningStateBytes),
      developmentPlanningStateSha256: audit.database.developmentPlanningStateSha256,
      markdownSha256: sha256Bytes(auditPackage.markdownBytes),
      preMigrationBackupManifestSha256: audit.database.preMigrationBackupManifestSha256,
      preMigrationPhysicalStateSha256: audit.comparisons.preexistingPhysicalStateBeforeSha256,
      schemaSecurityDefinitionIdentityFileSha256: sha256Bytes(
        auditPackage.schemaSecurityDefinitionIdentityBytes,
      ),
      schemaSecurityIdentitySha256: audit.database.schemaSecurityIdentitySha256,
      stateFresh: audit.database.stateFresh,
    },
    compensation: {
      counts: compensation.counts,
      operationId: compensation.operationId,
      planTemplateSha256: compensation.binding.contentSha256,
      readyToExecute: false,
    },
    ...(compatibilityResolution
      ? {
          compatibility: {
            actionCounts: compatibilityResolution.actionCounts,
            authorizationBindingsSha256: compatibilityAuthorization
              ? sha256Canonical(compatibilityAuthorization.bindings)
              : null,
            booleanNormalizationLedgerSha256:
              compatibilityAuthorization?.booleanNormalizationLedgerSha256,
            existingHeadCohortSha256: compatibilityResolution.existingHeadCohortSha256,
            listNormalizationLedgerSha256:
              compatibilityAuthorization?.listNormalizationLedgerSha256,
            noteDispositionSha256: sha256Canonical(compatibilityResolution.noteDisposition),
            sourceAuthorizationSetVersion: 3,
          },
        }
      : {}),
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    databaseAccess: 'none_package_uses_read_only_post_migration_audit',
    databaseMutation: false,
    heldOutIdentitiesAccessed: false,
    import: {
      counts: importCounts,
      idempotencyKey: importPlan.binding.idempotencyKey,
      operationId: importPlan.operationId,
      planSha256: importPlan.binding.contentSha256,
    },
    kind: 'gold_import_compensation_package',
    migration: { id: MIGRATION_ID, sha256: sourceIdentities.migrationSha256 },
    packageVersion: PACKAGE_VERSION,
    schemaVersion: PACKAGE_GENERATOR_SCHEMA_VERSION,
    sources: sourceIdentities,
  }

  const files = new Map<string, Buffer>()
  files.set('append-only-compensation-plan-template.json', canonicalPretty(compensation))
  files.set('ambiguous-outcome-reconciliation.json', canonicalPretty(reconciliation))
  files.set(
    'compensation-authorization-template.json',
    canonicalPretty(compensationAuthorizationTemplate),
  )
  files.set('compensation-readiness.json', canonicalPretty(compensationReadiness))
  files.set('immutable-atomic-import-plan.json', canonicalPretty(importPlan))
  files.set('import-authorization-template.json', canonicalPretty(importAuthorizationTemplate))
  files.set(
    'import-journal-template.json',
    canonicalPretty({
      actionCount: importCounts.total,
      idempotencyKey: importPlan.binding.idempotencyKey,
      operationId: importPlan.operationId,
      outcome: null,
      planSha256: importPlan.binding.contentSha256,
      status: 'not_executed',
    }),
  )
  files.set(
    'import-receipt-template.json',
    canonicalPretty({
      afterEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
      afterPhysicalStateSha256: null,
      beforeEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
      beforePhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
      operationId: importPlan.operationId,
      outcome: null,
      physicalHashRule: 'database_observed_at_execution',
      status: 'not_executed',
    }),
  )
  files.set('package-descriptor.json', canonicalPretty(packageDescriptor))
  files.set('post-migration-audit.json', auditPackage.auditBytes)
  files.set('post-migration-audit.md', auditPackage.markdownBytes)
  files.set('post-migration-audit-manifest.sha256', auditPackage.manifestBytes)
  files.set(
    'post-migration-development-planning-state.json',
    auditPackage.developmentPlanningStateBytes,
  )
  files.set(
    'post-migration-schema-security-definition-identity.json',
    auditPackage.schemaSecurityDefinitionIdentityBytes,
  )
  if (auditPackage.reconciledEvidence) {
    files.set(
      'post-migration-contract-diagnostics.json',
      auditPackage.reconciledEvidence.contractDiagnosticsBytes,
    )
    files.set(
      'post-migration-contract-reconciliation.json',
      auditPackage.reconciledEvidence.contractReconciliationBytes,
    )
    files.set(
      'post-migration-read-only-state-bracket.json',
      auditPackage.reconciledEvidence.readOnlyStateBracketBytes,
    )
  }
  files.set(
    'proposed-compensation-command.txt',
    Buffer.from(
      'npm run literature:gold-import-compensation -- execute-compensation --plan <FINALIZED_COMPENSATION_PLAN> --authorization <SEPARATELY_SIGNED_COMPENSATION_AUTHORIZATION> --artifact <FINAL_V3_ARTIFACT> --receipt <EXCLUSIVE_RECEIPT_PATH> --target local\n',
      'utf8',
    ),
  )
  files.set(
    'proposed-import-command.txt',
    Buffer.from(
      'npm run literature:gold-import-compensation -- execute-import --plan immutable-atomic-import-plan.json --authorization <SEPARATELY_SIGNED_IMPORT_AUTHORIZATION> --artifact <FINAL_V3_ARTIFACT> --source-authorization-set source-authorization-set.json --receipt <EXCLUSIVE_RECEIPT_PATH> --target local\n',
      'utf8',
    ),
  )
  files.set(
    'row-level-action-plan.json',
    canonicalPretty({
      compensationActions: compensation.actions,
      importActions: importPlan.actions,
      rowBindings,
      schemaVersion: 'gold-import-compensation-row-actions/v1',
    }),
  )
  files.set('source-authorization-set.json', authorizationSetBytes)
  files.set('state-hash-proof.json', canonicalPretty(stateHashProof))
  const manifest = buildManifest(files)
  files.set('checksum-manifest.sha256', manifest)
  return {
    files,
    importPlan,
    manifestSha256: sha256Bytes(manifest),
    packageDescriptor,
  }
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

export async function writeGeneratedPackageExclusive(input: {
  beforeAnchoredWriteForTest?: (outputDirectory: string) => Promise<void> | void
  outputDirectory: string
  outputRoot: string
  package: GeneratedPackage
}): Promise<void> {
  const output = await createExclusiveOutputDirectory(input)
  await input.beforeAnchoredWriteForTest?.(output.outputDirectory)
  writeExclusiveOutputFiles(
    output,
    [...input.package.files.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => ({ bytes, name })),
  )
  await assertExclusiveOutputDirectoryIdentity(output)
}

async function readJson(path: string): Promise<unknown> {
  const bytes = await readFile(path)
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

async function readConfinedAuditArtifact(directory: string, name: string): Promise<Buffer> {
  await assertNoSymlinkAncestors(directory)
  const directoryStat = await lstat(directory)
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error('Post-migration audit parent must be a regular non-symlink directory.')
  }
  const canonicalDirectory = await realpath(directory)
  const path = resolve(directory, name)
  const stat = await lstat(path)
  const canonicalPath = await realpath(path)
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    relative(canonicalDirectory, canonicalPath) !== name
  ) {
    throw new Error(`Post-migration audit artifact ${name} is not a confined regular file.`)
  }
  return readFile(path)
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

const HELP = `
Generate the deterministic V3 atomic import and append-only compensation package.

The post-migration --audit is parsed and gated before any source artifact is opened.
The database is never contacted or mutated by this command.

Usage:
  npm run literature:generate-gold-import-compensation-package -- \\
    --audit <post-migration-audit.json> \\
    --audit-manifest-sha256 <reviewed-canonical-manifest-sha256> \\
    --development-state <development-planning-state.json> \\
    --artifact <gold-set-v1-enrichment-v3-final-development-630.csv> \\
    --protocol-authorization <protocol-authorization-signed.json> \\
    --amended-authorization <amended-authorization.json> \\
    --migration <20260808035633_add_literature_gold_import_compensation_contract.sql> \\
    --output-root <approved-local-output-root> --output <new-package-directory>
`.trim()

export async function runPackageGeneratorCli(argv: readonly string[]): Promise<{
  manifestSha256: string
  outputDirectory: string
}> {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, [
    'amended-authorization',
    'artifact',
    'audit',
    'audit-manifest-sha256',
    'development-state',
    'help',
    'migration',
    'output',
    'output-root',
    'protocol-authorization',
  ])
  if (arguments_.flags.has('help')) {
    console.log(HELP)
    return { manifestSha256: '', outputDirectory: '' }
  }
  const suppliedOutputRoot = stringArgument(arguments_, 'output-root')
  const suppliedOutputDirectory = stringArgument(arguments_, 'output')
  if (suppliedOutputRoot !== undefined) {
    assertSafeOutputPathArgument(suppliedOutputRoot, '--output-root')
  }
  if (suppliedOutputDirectory !== undefined) {
    assertSafeOutputPathArgument(suppliedOutputDirectory, '--output')
  }

  const auditPath = resolve(requiredArgument(arguments_, 'audit'))
  await assertNoSymlinkAncestors(auditPath)
  const auditStat = await lstat(auditPath)
  if (!auditStat.isFile() || auditStat.isSymbolicLink()) {
    throw new Error('--audit must be a regular non-symlink file.')
  }
  const initialAudit = assertPackageAuditReady(await readJson(auditPath))
  if (initialAudit.schemaVersion !== 'gold-import-compensation-reconciled-migration-audit/1.0.0') {
    throw new Error(
      'Package generation blocked: production sources require the reconciled post-migration audit; source artifacts were not inspected.',
    )
  }
  // The stable readiness gate above intentionally runs before any other input
  // is required or opened. A ready report must then be authenticated by the
  // complete canonical audit package and its separately reviewed manifest SHA.
  if (basename(auditPath) !== 'migration-audit.json') {
    throw new Error('--audit must name the canonical migration-audit.json artifact.')
  }
  const auditDirectory = dirname(auditPath)
  const developmentStatePath = resolve(requiredArgument(arguments_, 'development-state'))
  if (developmentStatePath !== resolve(auditDirectory, 'development-planning-state.json')) {
    throw new Error(
      '--development-state must be the canonical planning artifact beside migration-audit.json.',
    )
  }
  const [
    auditBytes,
    developmentPlanningStateBytes,
    manifestBytes,
    markdownBytes,
    schemaSecurityDefinitionIdentityBytes,
    contractDiagnosticsBytes,
    contractReconciliationBytes,
    readOnlyStateBracketBytes,
  ] = await Promise.all([
    readConfinedAuditArtifact(auditDirectory, 'migration-audit.json'),
    readConfinedAuditArtifact(auditDirectory, 'development-planning-state.json'),
    readConfinedAuditArtifact(auditDirectory, 'checksum-manifest.sha256'),
    readConfinedAuditArtifact(auditDirectory, 'migration-audit.md'),
    readConfinedAuditArtifact(auditDirectory, 'schema-security-definition-identity.json'),
    readConfinedAuditArtifact(auditDirectory, 'contract-diagnostics.json'),
    readConfinedAuditArtifact(auditDirectory, 'contract-reconciliation.json'),
    readConfinedAuditArtifact(auditDirectory, 'read-only-state-bracket.json'),
  ])
  const auditPackage = verifyReadyPostMigrationAuditPackage({
    auditBytes,
    developmentPlanningStateBytes,
    manifestBytes,
    markdownBytes,
    reconciledEvidence: {
      contractDiagnosticsBytes,
      contractReconciliationBytes,
      readOnlyStateBracketBytes,
    },
    schemaSecurityDefinitionIdentityBytes,
    trustedManifestSha256: requiredArgument(arguments_, 'audit-manifest-sha256'),
  })
  // Source paths are resolved and opened only after both audit gates pass.
  const [finalArtifact, protocolAuthorization, amendedAuthorization, migration] = await Promise.all(
    [
      readFile(resolve(requiredArgument(arguments_, 'artifact'))),
      readFile(resolve(requiredArgument(arguments_, 'protocol-authorization'))),
      readFile(resolve(requiredArgument(arguments_, 'amended-authorization'))),
      readFile(resolve(requiredArgument(arguments_, 'migration'))),
    ],
  )
  const generated = generateGoldImportCompensationPackage({
    auditPackage,
    sources: { amendedAuthorization, finalArtifact, migration, protocolAuthorization },
  })
  const rawOutputRoot = requiredArgument(arguments_, 'output-root')
  const rawOutputDirectory = requiredArgument(arguments_, 'output')
  const outputRoot = resolve(rawOutputRoot)
  const outputDirectory = resolve(rawOutputDirectory)
  await writeGeneratedPackageExclusive({ outputDirectory, outputRoot, package: generated })
  return { manifestSha256: generated.manifestSha256, outputDirectory }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runPackageGeneratorCli(process.argv.slice(2))
    .then((result) => {
      if (result.outputDirectory) console.log(`${JSON.stringify(result, null, 2)}\n`)
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
