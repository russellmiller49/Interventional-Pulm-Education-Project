import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { lstat, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
  GOLD_REVIEW_IMPORT_V2_RPC_NAMES,
  bindImportPlanV2,
  compensationActionV2Schema,
  goldReviewClinicalProjectionV2,
  goldReviewPayloadV2Schema,
  parseImportPlanV2,
  type CompensationActionV2,
  type GoldReviewPayloadV2,
  type ImportActionV2,
  type ImportPlanV2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  assertSafeOutputPathArgument,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'
import {
  compatibilityDevelopmentPlanningStateSchema,
  compatibilityHistoricalEffectiveReviewSchema,
  existingHeadCohortSha256,
  parseFinalizedGoldImportArtifact,
  type FinalizedGoldImportArtifactRecord,
} from './gold-import-compensation-compatibility'
import {
  validateReadyGoldImportCompensationV2Audit,
  type GoldImportCompensationV2ReadyAudit,
} from './audit-gold-import-compensation-v2'
import {
  GOLD_IMPORT_AMENDED_TWO_ROW_AUTHORIZATION_SHA256_V4,
  GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  GOLD_IMPORT_SIGNED_PROTOCOL_AUTHORIZATION_SHA256_V4,
  buildGoldImportSourceAuthorizationSetV4,
  canonicalGoldImportSourceAuthorizationSetV4Bytes,
  parseCanonicalGoldImportSourceAuthorizationSetV4Bytes,
  type GoldImportSourceAuthorizationSetV4,
} from './gold-import-source-authorization-v4'
import {
  GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
  GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
  resolveV2ImportedNote,
  validateGoldImportNoteDispositionGateV2,
  type GoldImportNoteDispositionAuditGateV2,
  type NoteDispositionEvidenceBytesV2,
} from './gold-import-note-disposition-gate-v2'
import {
  validateProtectedV2ExpectedCatalogBinding,
  type ProtectedV2ExpectedCatalogBinding,
} from './protected-gold-import-contract-v2-bindings'
import {
  validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile,
  type ProtectedV2CompleteCatalogAuditIdentity,
} from './gold-import-contract-v2-catalog-audit'
import {
  migrationReceiptGateArtifactBytes,
  migrationReceiptGateArtifactSha256,
  requireIssuedGoldImportCompensationV2MigrationReceiptGateForAudit,
  validateGoldImportCompensationV2MigrationReceiptGateForAudit,
  validateGoldImportCompensationV2MigrationReceiptGateForBinding,
  type GoldImportCompensationV2MigrationReceiptGate,
  type GoldImportCompensationV2LocalMigrationReceiptGate,
} from './gold-import-compensation-v2-migration-receipt-gate'
import {
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  assertGoldImportV2CurrentDatabaseMatchesPackageReadiness,
  collectGoldImportV2PreimportFixedLocalState,
  goldImportV2PackageReadinessStateSchema,
  goldImportV2RepositoryEvidenceSchema,
  inspectGoldImportV2PrimaryMainRepository,
  loadGoldImportV2FinalizedReceiptEvidence,
  packageReadinessStateIdentitySha256,
  validateGoldImportV2PackageReadinessState,
  validateGoldImportV2RepositoryEvidence,
  type GoldImportV2FinalizedReceiptEvidence,
  type GoldImportV2RepositoryEvidence,
} from './gold-import-v2-package-readiness'
import {
  GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
  buildGoldImportV2PreimportCapturePair,
  buildGoldImportV2PreimportDatabaseContent,
  goldImportV2PreimportCapturePairSchema,
  goldImportV2PreimportRuntimeBundleSchema,
  loadGoldImportV2PreimportRuntimeBundle,
  validateGoldImportV2PreimportCapturePair,
  validateGoldImportV2PreimportRuntimeBundle,
  verifyGoldImportV2PreimportCaptureDirectory,
  type GoldImportV2PreimportRuntimeBundle,
  type GoldImportV2VerifiedPreimportCapture,
} from './gold-import-v2-preimport-capture'

const EXECUTING_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTING_MODULE_PATH = realpathSync(fileURLToPath(import.meta.url))
const EXPECTED_PRODUCTION_MODULE_PATH = resolve(
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  'scripts/literature/generate-gold-import-compensation-package-v2.ts',
)
import type { ProtectedV2DatabaseEvidence } from './protected-gold-import-contract-v2-transition-evidence'

export const GOLD_IMPORT_COMPENSATION_PACKAGE_GENERATOR_SCHEMA_VERSION_V2 =
  'gold-import-compensation-package-generator/2.0.0' as const
export const GOLD_IMPORT_COMPENSATION_PACKAGE_VERSION_V2 =
  'gold-set-v2-atomic-import-compensation/1.0.0' as const
export const GOLD_IMPORT_COMPENSATION_INITIAL_REVIEW_TIMESTAMP_V2 =
  '2026-08-08T00:00:00.000Z' as const
export const GOLD_IMPORT_V2_PACKAGE_GENERATION_READINESS_SCHEMA_VERSION =
  'literature-gold-v2-package-generation-readiness/1.0.0' as const
export const GOLD_IMPORT_V2_PACKAGE_CAPTURE_ROOT = GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const uuidSchema = z.string().uuid()
const timestampSchema = z.string().datetime({ offset: true })

const packageGenerationReadinessBodySchema = z
  .object({
    artifactClass: z.literal('unsigned_non_executable_package_generation_evidence'),
    capturePair: goldImportV2PreimportCapturePairSchema,
    currentRepository: goldImportV2RepositoryEvidenceSchema,
    currentRuntimeBundle: goldImportV2PreimportRuntimeBundleSchema,
    finalizedReceipt: goldImportV2PackageReadinessStateSchema.shape.receipt,
    notExecutable: z.literal(true),
    packageReadiness: goldImportV2PackageReadinessStateSchema,
    safetyBoundary: z
      .object({
        compensationAuthorized: z.literal(false),
        heldOutIdentitiesAccessed: z.literal(false),
        importAuthorized: z.literal(false),
        packageExecutionAuthorized: z.literal(false),
        remoteDatabaseAccessed: z.literal(false),
        writeCapableDatabaseClientConstructed: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal(GOLD_IMPORT_V2_PACKAGE_GENERATION_READINESS_SCHEMA_VERSION),
  })
  .strict()

export const goldImportV2PackageGenerationReadinessSchema = packageGenerationReadinessBodySchema
  .extend({ readinessIdentitySha256: sha256Schema })
  .strict()

export type GoldImportV2PackageGenerationReadiness = z.infer<
  typeof goldImportV2PackageGenerationReadinessSchema
>

const historicalEffectiveReviewV2Schema = compatibilityHistoricalEffectiveReviewSchema
  .innerType()
  .extend({
    fullTextUsed: z.boolean().nullable().default(null),
    operationContractVersion: z
      .enum([
        'gold-review-import-compensation/1.0.0',
        GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
      ])
      .nullable()
      .default(null),
  })
  .strict()

export const developmentPlanningStateV2Schema = z
  .object({
    datasetSplit: z.literal('development'),
    rows: z.array(
      z
        .object({
          currentEffectiveReview: historicalEffectiveReviewV2Schema.nullable(),
          currentReviewId: uuidSchema.nullable(),
          currentRevision: z.number().int().positive().nullable(),
          datasetSplit: z.literal('development'),
          displayOrder: z.number().int().nonnegative(),
          effectiveReviewId: uuidSchema.nullable(),
          itemId: uuidSchema,
          itemState: z
            .object({
              automatedSignalsRevealedAt: timestampSchema.nullable(),
              completedAt: timestampSchema.nullable(),
              reviewStatus: z.enum(['pending', 'in_progress', 'return_later', 'completed']),
              startedAt: timestampSchema.nullable(),
              supplementalMetadataRevealedAt: timestampSchema.nullable(),
            })
            .strict(),
          pmid: z.string().regex(/^[0-9]{1,12}$/u),
          sequence: z.number().int().positive(),
        })
        .strict(),
    ),
    schemaVersion: z.literal('gold-import-compensation-development-planning-state/1.0.0'),
  })
  .strict()
export type DevelopmentPlanningStateV2 = z.infer<typeof developmentPlanningStateV2Schema>
type DevelopmentPlanningRowV2 = DevelopmentPlanningStateV2['rows'][number]

export interface ImportActionCountsV2 {
  initial: number
  inserts: number
  noops: number
  revisions: number
  total: number
}

export const unsignedImportAuthorizationTemplateV2Schema = z
  .object({
    authorizationId: z.null(),
    authorizationNote: z.null(),
    authorized: z.literal(false),
    authorizedAt: z.null(),
    authorizedBy: z.null(),
    batchId: uuidSchema,
    binding: z.null(),
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    expectedEffectiveStateSha256: sha256Schema,
    expectedPhysicalStateSha256: sha256Schema,
    expectedPostEffectiveStateSha256: sha256Schema,
    idempotencyKey: sha256Schema,
    importAuthorized: z.literal(false).optional(),
    kind: z.literal('unsigned_import_authorization_template'),
    migrationId: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
    notExecutable: z.literal(true),
    operationId: uuidSchema,
    planSha256: sha256Schema,
    readiness: z.literal('separate_operator_authorization_required'),
    remoteWritesAllowed: z.literal(false),
    repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
    compensationAuthorized: z.literal(false).optional(),
    sourceArtifactSha256: sha256Schema,
    booleanNormalizationLedgerSha256: sha256Schema,
    noteDispositionAuditSha256: sha256Schema,
    orderedSetNormalizationLedgerSha256: sha256Schema,
    sourceAuthorizationSetSha256: sha256Schema,
    targetDatabase: z.literal('local'),
  })
  .strict()

export const compensationPlanTemplateV2Schema = z
  .object({
    actions: z.array(compensationActionV2Schema).min(1),
    batchId: uuidSchema,
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    counts: z
      .object({
        noops: z.number().int().nonnegative(),
        restored: z.number().int().nonnegative(),
        total: z.number().int().positive(),
        voided: z.number().int().nonnegative(),
      })
      .strict(),
    evidence: z
      .object({
        booleanNormalizationLedgerSha256: sha256Schema,
        noteDispositionAuditSha256: sha256Schema,
        orderedSetNormalizationLedgerSha256: sha256Schema,
        sourceAuthorizationSetSha256: sha256Schema,
      })
      .strict(),
    expectedEffectiveStateSha256: sha256Schema,
    expectedPhysicalStateSha256: z.null(),
    expectedPostEffectiveStateSha256: sha256Schema,
    importPlanSha256: sha256Schema,
    importReceiptSha256: z.null(),
    kind: z.literal('append_only_compensation_plan_template'),
    operationId: uuidSchema,
    readiness: z.literal('committed_import_receipt_and_separate_authorization_required'),
    targetImportOperationId: uuidSchema,
  })
  .strict()

export type CompensationPlanTemplateV2 = z.infer<typeof compensationPlanTemplateV2Schema>

export const unsignedCompensationAuthorizationTemplateV2Schema = z
  .object({
    authorizationId: z.null(),
    authorizationNote: z.null(),
    authorized: z.literal(false),
    authorizedAt: z.null(),
    authorizedBy: z.null(),
    batchId: uuidSchema,
    binding: z.null(),
    booleanNormalizationLedgerSha256: sha256Schema,
    compensationAuthorized: z.literal(false).optional(),
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    expectedEffectiveStateSha256: sha256Schema,
    expectedPhysicalStateSha256: z.null(),
    expectedPostEffectiveStateSha256: sha256Schema,
    idempotencyKey: z.null(),
    importAuthorized: z.literal(false).optional(),
    importReceiptSha256: z.null(),
    kind: z.literal('unsigned_compensation_authorization_template'),
    migrationId: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
    noteDispositionAuditSha256: sha256Schema,
    notExecutable: z.literal(true),
    operationId: uuidSchema,
    orderedSetNormalizationLedgerSha256: sha256Schema,
    planSha256: z.null(),
    readiness: z.literal('committed_import_receipt_and_separate_authorization_required'),
    remoteWritesAllowed: z.literal(false),
    repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
    sourceArtifactSha256: sha256Schema,
    sourceAuthorizationSetSha256: sha256Schema,
    targetDatabase: z.literal('local'),
    targetImportOperationId: uuidSchema,
  })
  .strict()

export const packageDescriptorV2Schema = z
  .object({
    actionCounts: z
      .object({
        initial: z.number().int().nonnegative(),
        inserts: z.number().int().nonnegative(),
        noops: z.number().int().nonnegative(),
        revisions: z.number().int().nonnegative(),
        total: z.number().int().positive(),
      })
      .strict(),
    artifacts: z.record(z.string().min(1), sha256Schema),
    auditTarget: z.enum(['disposable_clone', 'local']),
    completeCatalogAuditIdentitySha256: sha256Schema,
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    databaseAccess: z.literal('none_file_only_authenticated_audit'),
    heldOutIdentitiesAccessed: z.literal(false),
    importOperationId: uuidSchema,
    importPlanSha256: sha256Schema,
    kind: z.literal('gold_import_compensation_package'),
    migration: z
      .object({
        id: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
        sha256: sha256Schema,
      })
      .strict(),
    migrationReceiptGateSha256: sha256Schema,
    migrationReceiptKind: z.enum([
      'normal_application',
      'historical_recovery',
      'disposable_rehearsal',
    ]),
    packageReadinessIdentitySha256: sha256Schema.optional(),
    preimportCapturePairIdentitySha256: sha256Schema.optional(),
    expectedCatalogArtifactContentSha256: sha256Schema,
    expectedCatalogArtifactFileSha256: sha256Schema,
    expectedCatalogBindingSha256: sha256Schema,
    noteDispositionAuditSha256: z.literal(GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2),
    packageVersion: z.literal(GOLD_IMPORT_COMPENSATION_PACKAGE_VERSION_V2),
    remoteAccess: z.literal(false),
    schemaVersion: z.literal(GOLD_IMPORT_COMPENSATION_PACKAGE_GENERATOR_SCHEMA_VERSION_V2),
    sourceAuthorizationSetSha256: sha256Schema,
    sourceAuthorizationVersion: z.literal(4),
  })
  .strict()
export type PackageDescriptorV2 = z.infer<typeof packageDescriptorV2Schema>

export interface GenerateGoldImportCompensationPackageV2Sources extends NoteDispositionEvidenceBytesV2 {
  finalArtifactBytes: Uint8Array
  migrationBytes: Uint8Array
  noteDispositionAudit: unknown
  signedProtocolAuthorizationBytes: Uint8Array
}

interface GenerateGoldImportCompensationPackageV2Input {
  audit: GoldImportCompensationV2ReadyAudit | unknown
  developmentPlanningState: unknown
  migrationReceiptGate: unknown
  productionReadiness?: GoldImportV2PackageGenerationReadiness | unknown
  sources: GenerateGoldImportCompensationPackageV2Sources
}

export type GenerateDisposableGoldImportCompensationPackageV2Input = Omit<
  GenerateGoldImportCompensationPackageV2Input,
  'productionReadiness'
>

export interface GeneratedGoldImportCompensationPackageV2 {
  compensationTemplate: CompensationPlanTemplateV2
  developmentPlanningState: z.input<typeof developmentPlanningStateV2Schema>
  files: ReadonlyMap<string, Buffer>
  importPlan: ImportPlanV2
  manifestSha256: string
  migrationReceiptGate: GoldImportCompensationV2MigrationReceiptGate
  packageDescriptor: Record<string, unknown>
  productionReadiness: GoldImportV2PackageGenerationReadiness | null
  sourceArtifactBytes: Buffer
  sourceAuthorizationSet: GoldImportSourceAuthorizationSetV4
  verifiedBindings: {
    completeCatalogAuditIdentitySha256: string
    developmentPlanningStateSha256: string
    expectedCatalogBindingSha256: string
    migrationSha256: string
    migrationReceiptGateSha256: string
    packageReadinessIdentitySha256: string | null
    sourceArtifactSha256: string
    sourceAuthorizationSetSha256: string
  }
}

interface ExactCatalogBindingArtifactV2 {
  auditTarget: 'disposable_clone' | 'local'
  authorization: 'exact_committed_expected_state'
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  schemaVersion: 'gold-import-compensation-v2-exact-catalog-binding/1.0.0'
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function deepFreezeCanonicalValue<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreezeCanonicalValue(child)
    }
    Object.freeze(value)
  }
  return value
}

function canonicalFrozenClone<T>(value: T): T {
  return deepFreezeCanonicalValue(JSON.parse(canonicalJson(value)) as T)
}

export function validateGoldImportV2PackageGenerationReadiness(
  input: unknown,
): GoldImportV2PackageGenerationReadiness {
  const readiness = goldImportV2PackageGenerationReadinessSchema.parse(input)
  const { readinessIdentitySha256, ...body } = readiness
  if (sha256Canonical(body) !== readinessIdentitySha256) {
    throw new Error('V2 package-generation readiness identity is invalid.')
  }
  const capturePair = validateGoldImportV2PreimportCapturePair(readiness.capturePair)
  const currentRepository = validateGoldImportV2RepositoryEvidence(readiness.currentRepository)
  const currentRuntimeBundle = validateGoldImportV2PreimportRuntimeBundle(
    readiness.currentRuntimeBundle,
  )
  const packageReadiness = validateGoldImportV2PackageReadinessState(readiness.packageReadiness)
  const databaseStateSha256 = sha256Canonical(
    buildGoldImportV2PreimportDatabaseContent(packageReadiness),
  )
  const captureIdentityFields = [
    'captureId',
    'captureIdentitySha256',
    'directoryRealpath',
    'executionNonce',
    'executionReceiptIdentitySha256',
    'executionReceiptSha256',
  ] as const
  if (
    canonicalJson(readiness.finalizedReceipt) !== canonicalJson(packageReadiness.receipt) ||
    capturePair.currentRepositoryHeadSha !== currentRepository.headSha ||
    capturePair.currentRuntimeBundleSha256 !== currentRuntimeBundle.aggregateSha256 ||
    capturePair.finalizedReceiptAuthorityIdentitySha256 !==
      readiness.finalizedReceipt.authorityIdentitySha256 ||
    capturePair.packageReadinessIdentitySha256 !==
      packageReadinessStateIdentitySha256(packageReadiness) ||
    capturePair.canonicalDatabaseStateSha256 !== databaseStateSha256 ||
    capturePair.captures.some(
      (capture) => capture.canonicalDatabaseStateSha256 !== databaseStateSha256,
    ) ||
    captureIdentityFields.some(
      (field) => capturePair.captures[0][field] === capturePair.captures[1][field],
    )
  ) {
    throw new Error(
      'V2 package-generation readiness does not bind one exact current capture pair and state.',
    )
  }
  return canonicalFrozenClone(readiness)
}

export function buildGoldImportV2PackageGenerationReadiness(input: {
  captures: readonly GoldImportV2VerifiedPreimportCapture[]
  currentFinalizedReceipt: GoldImportV2FinalizedReceiptEvidence
  currentRepository: GoldImportV2RepositoryEvidence
  currentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  now: Date
}): GoldImportV2PackageGenerationReadiness {
  const currentRepository = validateGoldImportV2RepositoryEvidence(input.currentRepository)
  const currentRuntimeBundle = validateGoldImportV2PreimportRuntimeBundle(
    input.currentRuntimeBundle,
  )
  const capturePair = buildGoldImportV2PreimportCapturePair({
    captures: input.captures,
    currentRepository,
    currentRuntimeBundle,
    now: input.now,
  })
  const packageReadiness = validateGoldImportV2PackageReadinessState(
    input.captures[0]?.capture.packageReadiness,
  )
  const readinessWithCurrentReceipt = validateGoldImportV2PackageReadinessState({
    ...packageReadiness,
    receipt: input.currentFinalizedReceipt,
  })
  if (
    canonicalJson(readinessWithCurrentReceipt.receipt) !== canonicalJson(packageReadiness.receipt)
  ) {
    throw new Error('Post-V2 captures do not bind the current finalized migration receipt.')
  }
  const body = packageGenerationReadinessBodySchema.parse({
    artifactClass: 'unsigned_non_executable_package_generation_evidence',
    capturePair,
    currentRepository,
    currentRuntimeBundle,
    finalizedReceipt: readinessWithCurrentReceipt.receipt,
    notExecutable: true,
    packageReadiness,
    safetyBoundary: {
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      packageExecutionAuthorized: false,
      remoteDatabaseAccessed: false,
      writeCapableDatabaseClientConstructed: false,
    },
    schemaVersion: GOLD_IMPORT_V2_PACKAGE_GENERATION_READINESS_SCHEMA_VERSION,
  })
  return validateGoldImportV2PackageGenerationReadiness({
    ...body,
    readinessIdentitySha256: sha256Canonical(body),
  })
}

function validateGoldImportV2LocalPackageReadinessForAudit(
  readinessInput: unknown,
  auditInput: GoldImportCompensationV2ReadyAudit | unknown,
): GoldImportV2PackageGenerationReadiness {
  const readiness = validateGoldImportV2PackageGenerationReadiness(readinessInput)
  const audit = validateReadyGoldImportCompensationV2Audit(auditInput)
  const state = readiness.packageReadiness
  if (
    audit.target !== 'local' ||
    audit.repositoryCommitSha !== readiness.currentRepository.headSha ||
    audit.database.batchId !== state.batch.id ||
    audit.database.developmentMembershipSha256 !==
      state.stateIdentities.developmentMembershipSha256 ||
    audit.database.developmentPlanningStateSha256 !== state.stateIdentities.planningStateSha256 ||
    audit.database.effectiveStateSha256 !== state.stateIdentities.effectiveStateSha256V1 ||
    audit.database.physicalStateSha256 !== state.stateIdentities.physicalStateSha256V1 ||
    audit.v2PreImportState.effectiveStateSha256 !== state.stateIdentities.effectiveStateSha256V2 ||
    audit.v2PreImportState.physicalStateSha256 !== state.stateIdentities.physicalStateSha256V2 ||
    audit.migration.v1Occurrence !== state.migrationLedger.v1.occurrence ||
    audit.migration.v2Occurrence !== state.migrationLedger.v2.occurrence ||
    audit.migration.sha256 !== state.migrationLedger.v2.sha256 ||
    audit.expectedCatalog.bindingSha256 !== state.authorities.expectedCatalogBindingSha256 ||
    audit.completeCatalogAudit.fullAuditIdentitySha256 !==
      state.stateIdentities.completeLocalProfileCatalogAuditSha256
  ) {
    throw new Error(
      'V2 local package audit differs from the current post-V2 pre-import capture state.',
    )
  }
  return readiness
}

function buildGoldImportV2LocalMigrationReceiptGateFromReadiness(
  auditInput: GoldImportCompensationV2ReadyAudit | unknown,
  readinessInput: unknown,
): GoldImportCompensationV2LocalMigrationReceiptGate {
  const audit = validateReadyGoldImportCompensationV2Audit(auditInput)
  const readiness = validateGoldImportV2LocalPackageReadinessForAudit(readinessInput, audit)
  const receipt = readiness.finalizedReceipt
  const content = {
    auditTarget: 'local' as const,
    batchId: audit.database.batchId,
    catalog: {
      completeCatalogAuditIdentitySha256: audit.completeCatalogAudit.fullAuditIdentitySha256,
      expectedCatalogBindingSha256: audit.expectedCatalog.bindingSha256,
    },
    compensationAuthorized: false as const,
    importAuthorized: false as const,
    kind: 'finalized_migration_receipt' as const,
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: audit.migration.sha256,
      v1Occurrence: 1 as const,
      v2Occurrence: 1 as const,
    },
    migrationReceiptComplete: true as const,
    preImportState: {
      developmentMembershipSha256: audit.database.developmentMembershipSha256,
      developmentPlanningStateSha256: audit.database.developmentPlanningStateSha256,
      effectiveStateSha256: audit.v2PreImportState.effectiveStateSha256,
      physicalStateSha256: audit.v2PreImportState.physicalStateSha256,
    },
    productionUseAllowed: true as const,
    schemaVersion: 'gold-import-compensation-v2-finalized-migration-receipt-gate/1.0.0' as const,
    source: {
      executionReceiptSha256: receipt.executionReceiptSha256,
      finalManifestSha256: receipt.finalManifestSha256,
      originalIntentSha256: receipt.originalIntentSha256,
      outputDirectory: receipt.outputDirectory,
      receiptKind: 'historical_recovery' as const,
      recoveryAmendmentIdentitySha256: receipt.amendmentIdentitySha256,
      recoveryToolBundleSha256: receipt.recoveryToolBundleSha256,
      resultSha256: receipt.resultSha256,
    },
  }
  return validateGoldImportCompensationV2MigrationReceiptGateForAudit(
    { ...content, gateIdentitySha256: sha256Canonical(content) },
    audit,
  ) as GoldImportCompensationV2LocalMigrationReceiptGate
}

export function validateAndSnapshotDevelopmentPlanningStateV2(input: unknown): Readonly<{
  authenticatedSource: z.input<typeof developmentPlanningStateV2Schema>
  projection: DevelopmentPlanningStateV2
}> {
  const authenticatedSource = canonicalFrozenClone(input) as z.input<
    typeof developmentPlanningStateV2Schema
  >
  const projection = developmentPlanningStateV2Schema.parse(authenticatedSource)
  return Object.freeze({
    authenticatedSource,
    projection: deepFreezeCanonicalValue(projection),
  })
}

class DetachedReadonlyBufferMap implements ReadonlyMap<string, Buffer> {
  readonly #snapshot: Map<string, Buffer>

  constructor(input: ReadonlyMap<string, Buffer>) {
    this.#snapshot = new Map([...input].map(([name, bytes]) => [name, Buffer.from(bytes)]))
    Object.freeze(this)
  }

  get size(): number {
    return this.#snapshot.size
  }

  get(key: string): Buffer | undefined {
    const value = this.#snapshot.get(key)
    return value ? Buffer.from(value) : undefined
  }

  has(key: string): boolean {
    return this.#snapshot.has(key)
  }

  *entries(): MapIterator<[string, Buffer]> {
    for (const [name, bytes] of this.#snapshot) yield [name, Buffer.from(bytes)]
  }

  *keys(): MapIterator<string> {
    yield* this.#snapshot.keys()
  }

  *values(): MapIterator<Buffer> {
    for (const bytes of this.#snapshot.values()) yield Buffer.from(bytes)
  }

  forEach(
    callback: (value: Buffer, key: string, map: ReadonlyMap<string, Buffer>) => void,
    thisArg?: unknown,
  ): void {
    for (const [name, bytes] of this.#snapshot) {
      callback.call(thisArg, Buffer.from(bytes), name, this)
    }
  }

  [Symbol.iterator](): MapIterator<[string, Buffer]> {
    return this.entries()
  }
}

function canonicalPretty(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`, 'utf8')
}

export function deterministicPackageUuidV2(...parts: readonly unknown[]): string {
  const bytes = Buffer.from(sha256Canonical(parts).slice(0, 32), 'hex')
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function assertExactSha(actual: string, expected: string, label: string): void {
  if (actual !== expected) throw new Error(`${label} SHA-256 drifted.`)
}

function currentClinicalProjection(row: DevelopmentPlanningRowV2): Record<string, unknown> | null {
  const review = row.currentEffectiveReview
  if (!review) return null
  return {
    categorizationFromFullText: review.categorizationFromFullText,
    clinicalPurposes: [...review.clinicalPurposes].sort(),
    diseaseTagStatus: review.diseaseTagStatus,
    diseaseTags: [...review.diseaseTags].sort(),
    enrichmentProvenance: review.enrichmentProvenance,
    enrichmentSchemaVersion: review.enrichmentSchemaVersion,
    fullTextUsed: review.fullTextUsed,
    isBlinded: review.isBlinded,
    labelSchemaVersion: review.labelSchemaVersion,
    metadataSufficiency: review.metadataSufficiency,
    notes: review.notes,
    operationContractVersion: review.operationContractVersion,
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

function targetReviewFromSource(input: {
  noteAudit: GoldImportNoteDispositionAuditGateV2
  record: FinalizedGoldImportArtifactRecord
  row: DevelopmentPlanningRowV2
}): GoldReviewPayloadV2 {
  const current = input.row.currentEffectiveReview
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
        completedAt: GOLD_IMPORT_COMPENSATION_INITIAL_REVIEW_TIMESTAMP_V2,
        createdAt: GOLD_IMPORT_COMPENSATION_INITIAL_REVIEW_TIMESTAMP_V2,
        reviewerEmail: null,
        reviewerUserId: null,
        reviewSeconds: 0,
        startedAt: GOLD_IMPORT_COMPENSATION_INITIAL_REVIEW_TIMESTAMP_V2,
      }
  return goldReviewPayloadV2Schema.parse({
    ...input.record.projection,
    ...operational,
    notes: resolveV2ImportedNote({
      audit: input.noteAudit,
      finalizedV3Note: input.record.projection.notes,
      itemId: input.record.identity.itemId,
      masterRowId: input.record.identity.masterRowId,
      pmid: input.record.identity.pmid,
    }),
    usedSupplementalMetadata: input.row.itemState.supplementalMetadataRevealedAt !== null,
  })
}

export interface PackagePlanningRowV2 {
  action: 'import_initial' | 'import_revision' | 'import_noop'
  expectedCurrentReviewId: string | null
  expectedEffectiveReviewId: string | null
  expectedRevision: number | null
  expectedSupersedesReviewId: string | null
  itemId: string
  pmid: string
  preImportItemState: DevelopmentPlanningRowV2['itemState']
  sequence: number
  targetReview: GoldReviewPayloadV2
}

/** Derive the action partition solely from the fresh planning snapshot and source payloads. */
export function derivePackagePlanningRowsV2(input: {
  artifactRows: readonly FinalizedGoldImportArtifactRecord[]
  noteAudit: GoldImportNoteDispositionAuditGateV2
  planningState: DevelopmentPlanningStateV2
}): PackagePlanningRowV2[] {
  const records = new Map(input.artifactRows.map((record) => [record.identity.itemId, record]))
  if (input.planningState.rows.length === 0 || input.planningState.rows.length !== records.size) {
    throw new Error('V2 planning state and artifact membership differ.')
  }
  const rows = input.planningState.rows.map((row, index): PackagePlanningRowV2 => {
    if (row.sequence !== index + 1) throw new Error('V2 planning sequence is not contiguous.')
    const record = records.get(row.itemId)
    if (!record || record.identity.pmid !== row.pmid) {
      throw new Error('V2 planning identity differs from the finalized artifact.')
    }
    const targetReview = targetReviewFromSource({ noteAudit: input.noteAudit, record, row })
    const common = {
      expectedCurrentReviewId: row.currentReviewId,
      expectedEffectiveReviewId: row.effectiveReviewId,
      itemId: row.itemId,
      pmid: row.pmid,
      preImportItemState: row.itemState,
      sequence: row.sequence,
      targetReview,
    }
    if (row.currentReviewId === null) {
      if (
        row.currentRevision !== null ||
        row.effectiveReviewId !== null ||
        row.currentEffectiveReview !== null
      ) {
        throw new Error('V2 initial action has contradictory review state.')
      }
      return {
        ...common,
        action: 'import_initial',
        expectedRevision: 1,
        expectedSupersedesReviewId: null,
      }
    }
    if (
      row.currentRevision === null ||
      row.effectiveReviewId === null ||
      row.currentEffectiveReview === null
    ) {
      throw new Error('V2 reviewed item is missing its current effective source.')
    }
    if (
      canonicalJson(currentClinicalProjection(row)) ===
      canonicalJson(goldReviewClinicalProjectionV2(targetReview))
    ) {
      return {
        ...common,
        action: 'import_noop',
        expectedRevision: null,
        expectedSupersedesReviewId: null,
      }
    }
    return {
      ...common,
      action: 'import_revision',
      expectedRevision: row.currentRevision + 1,
      expectedSupersedesReviewId: row.currentReviewId,
    }
  })
  deriveImportActionCountsV2(rows)
  return rows
}

export function deriveImportActionCountsV2(
  rows: readonly PackagePlanningRowV2[],
): ImportActionCountsV2 {
  const initial = rows.filter((row) => row.action === 'import_initial').length
  const revisions = rows.filter((row) => row.action === 'import_revision').length
  const noops = rows.filter((row) => row.action === 'import_noop').length
  const counts = { initial, inserts: initial + revisions, noops, revisions, total: rows.length }
  if (counts.total === 0 || initial + revisions + noops !== counts.total) {
    throw new Error('V2 planning actions are not a complete dynamic partition.')
  }
  if (
    new Set(rows.map((row) => row.itemId)).size !== rows.length ||
    new Set(rows.map((row) => row.pmid)).size !== rows.length
  ) {
    throw new Error('V2 planning actions contain duplicate source identities.')
  }
  return counts
}

function comparePostImportRowsV2(
  left: Pick<PackagePlanningRowV2, 'itemId' | 'pmid'>,
  right: Pick<PackagePlanningRowV2, 'itemId' | 'pmid'>,
): number {
  const leftPmid = BigInt(left.pmid)
  const rightPmid = BigInt(right.pmid)
  if (leftPmid < rightPmid) return -1
  if (leftPmid > rightPmid) return 1
  return left.itemId.localeCompare(right.itemId, 'en')
}

/**
 * Reproduce the exact JSON projection hashed by
 * literature_gold_effective_state_hash_v2 after a successful import. This is
 * deliberately source/planning-derived; an audit cannot choose the target.
 */
export function buildExpectedPostImportEffectiveStateProjectionV2(
  rows: readonly PackagePlanningRowV2[],
) {
  deriveImportActionCountsV2(rows)
  return {
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    datasetSplit: 'development' as const,
    items: [...rows].sort(comparePostImportRowsV2).map((row) => ({
      pmid: row.pmid,
      review: goldReviewClinicalProjectionV2(row.targetReview),
      reviewStatus:
        row.action === 'import_noop' ? row.preImportItemState.reviewStatus : ('completed' as const),
    })),
    projectionVersion: 'literature-gold-effective-state-v2' as const,
  }
}

/** Candidate-derived V2 target hash for audit bootstrap and package sealing. */
export function deriveExpectedPostImportEffectiveStateSha256V2(
  rows: readonly PackagePlanningRowV2[],
): string {
  return sha256Canonical(buildExpectedPostImportEffectiveStateProjectionV2(rows))
}

function buildImportActionsV2(
  rows: readonly PackagePlanningRowV2[],
  operationId: string,
): ImportActionV2[] {
  return rows.map((row) => {
    const actionId = deterministicPackageUuidV2(operationId, row.itemId, row.sequence, row.action)
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
      const candidateReview = goldReviewClinicalProjectionV2(row.targetReview)
      return {
        ...common,
        action: 'import_noop',
        candidateReview,
        candidateReviewSha256: sha256Canonical(candidateReview),
        compensationAction: 'compensate_noop',
        expectedEffectiveReviewIdAfter: row.expectedEffectiveReviewId,
        expectedEventSequence: [] as [],
        expectedHeadReviewIdAfter: row.expectedCurrentReviewId,
        expectedRevision: null,
        expectedSupersedesReviewId: null,
        importedReviewId: null,
      }
    }
    const importedReviewId = deterministicPackageUuidV2(actionId, 'imported-review')
    return {
      ...common,
      action: row.action,
      compensationAction:
        row.action === 'import_initial' || row.expectedEffectiveReviewId === null
          ? 'compensate_void'
          : 'compensate_restore',
      expectedEffectiveReviewIdAfter: importedReviewId,
      expectedEventSequence: ['review_imported'] as ['review_imported'],
      expectedHeadReviewIdAfter: importedReviewId,
      expectedRevision: row.expectedRevision as number,
      expectedSupersedesReviewId: row.expectedSupersedesReviewId,
      importedReviewId,
      review: row.targetReview,
      reviewSha256: sha256Canonical(row.targetReview),
    } as ImportActionV2
  })
}

export function buildCompensationTemplateV2(importPlan: ImportPlanV2): CompensationPlanTemplateV2 {
  const operationId = deterministicPackageUuidV2(
    importPlan.operationId,
    importPlan.binding.contentSha256,
    'compensation-operation',
  )
  const actions: CompensationActionV2[] = importPlan.actions.map((action) => {
    const actionId = deterministicPackageUuidV2(operationId, action.actionId, 'compensation')
    const common = {
      actionId,
      datasetSplit: 'development' as const,
      itemId: action.itemId,
      pmid: action.pmid,
      sequence: action.sequence,
      sourceActionId: action.actionId,
    }
    if (action.action === 'import_noop') {
      return {
        ...common,
        action: 'compensate_noop',
        compensationReviewId: null,
        effectiveSourceReviewId: action.expectedEffectiveReviewId,
        expectedCurrentReviewId: action.expectedCurrentReviewId,
        expectedEffectiveReviewId: action.expectedEffectiveReviewId,
        expectedEffectiveReviewIdAfter: action.expectedEffectiveReviewId,
        expectedEventSequence: [],
        expectedHeadReviewIdAfter: action.expectedCurrentReviewId,
        expectedRevision: null,
        expectedSupersedesReviewId: null,
        importedReviewId: null,
      }
    }
    const compensationReviewId = deterministicPackageUuidV2(actionId, 'compensation-review')
    const base = {
      ...common,
      compensationReviewId,
      expectedCurrentReviewId: action.importedReviewId,
      expectedEffectiveReviewId: action.importedReviewId,
      expectedHeadReviewIdAfter: compensationReviewId,
      expectedRevision: action.expectedRevision + 1,
      expectedSupersedesReviewId: action.importedReviewId,
      importedReviewId: action.importedReviewId,
    }
    if (action.compensationAction === 'compensate_restore') {
      if (action.expectedEffectiveReviewId === null) {
        throw new Error('V2 restore action lacks a prior effective source.')
      }
      return {
        ...base,
        action: 'compensate_restore',
        effectiveSourceReviewId: action.expectedEffectiveReviewId,
        expectedEffectiveReviewIdAfter: action.expectedEffectiveReviewId,
        expectedEventSequence: ['review_compensated'],
      }
    }
    return {
      ...base,
      action: 'compensate_void',
      effectiveSourceReviewId: null,
      expectedEffectiveReviewIdAfter: null,
      expectedEventSequence: ['review_voided'],
    }
  })
  const restored = actions.filter((action) => action.action === 'compensate_restore').length
  const voided = actions.filter((action) => action.action === 'compensate_void').length
  const noops = actions.filter((action) => action.action === 'compensate_noop').length
  return compensationPlanTemplateV2Schema.parse({
    actions,
    batchId: importPlan.batchId,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    counts: { noops, restored, total: actions.length, voided },
    evidence: {
      booleanNormalizationLedgerSha256: importPlan.booleanNormalizationLedgerSha256,
      noteDispositionAuditSha256: importPlan.noteDispositionAuditSha256,
      orderedSetNormalizationLedgerSha256: importPlan.orderedSetNormalizationLedgerSha256,
      sourceAuthorizationSetSha256: importPlan.sourceAuthorizationSetSha256,
    },
    expectedEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
    expectedPhysicalStateSha256: null,
    expectedPostEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
    importPlanSha256: importPlan.binding.contentSha256,
    importReceiptSha256: null,
    kind: 'append_only_compensation_plan_template',
    operationId,
    readiness: 'committed_import_receipt_and_separate_authorization_required',
    targetImportOperationId: importPlan.operationId,
  })
}

function assertProductionArtifactCohort(rows: readonly FinalizedGoldImportArtifactRecord[]): void {
  const fullTextTrue = rows.filter((row) => row.projection.fullTextUsed).length
  const technologyNull = rows.filter((row) => row.projection.technologyTagStatus === null).length
  const diseaseNull = rows.filter((row) => row.projection.diseaseTagStatus === null).length
  const sourceBlinded = rows.filter((row) => row.projection.isBlinded).length
  if (
    rows.length !== 630 ||
    fullTextTrue !== 50 ||
    rows.length - fullTextTrue !== 580 ||
    technologyNull !== 272 ||
    diseaseNull !== 272 ||
    sourceBlinded !== 0
  ) {
    throw new Error('Finalized artifact does not match the exact V2 source-provenance cohort.')
  }
}

function buildManifest(files: ReadonlyMap<string, Buffer>): Buffer {
  return Buffer.from(
    `${[...files.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256Bytes(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
}

function generateGoldImportCompensationPackageV2Internal(
  input: GenerateGoldImportCompensationPackageV2Input,
): GeneratedGoldImportCompensationPackageV2 {
  const audit = validateReadyGoldImportCompensationV2Audit(input.audit)
  let productionReadiness: GoldImportV2PackageGenerationReadiness | null = null
  let migrationReceiptGate: GoldImportCompensationV2MigrationReceiptGate
  if (audit.target === 'local') {
    if (input.productionReadiness === undefined) {
      throw new Error(
        'Local V2 package generation requires two verified post-V2 pre-import captures.',
      )
    }
    productionReadiness = validateGoldImportV2LocalPackageReadinessForAudit(
      input.productionReadiness,
      audit,
    )
    const expectedGate = buildGoldImportV2LocalMigrationReceiptGateFromReadiness(
      audit,
      productionReadiness,
    )
    migrationReceiptGate = validateGoldImportCompensationV2MigrationReceiptGateForAudit(
      input.migrationReceiptGate,
      audit,
    )
    if (canonicalJson(migrationReceiptGate) !== canonicalJson(expectedGate)) {
      throw new Error(
        'Local V2 package migration gate differs from the exact current finalized receipt.',
      )
    }
  } else {
    if (input.productionReadiness !== undefined) {
      throw new Error('Disposable V2 rehearsal cannot claim production package readiness.')
    }
    migrationReceiptGate = requireIssuedGoldImportCompensationV2MigrationReceiptGateForAudit(
      input.migrationReceiptGate,
      audit,
    )
  }
  const { authenticatedSource: authenticatedDevelopmentPlanningState, projection: planningState } =
    validateAndSnapshotDevelopmentPlanningStateV2(input.developmentPlanningState)
  const rawPlanningStateSha256 = sha256Canonical(authenticatedDevelopmentPlanningState)
  if (rawPlanningStateSha256 !== audit.database.developmentPlanningStateSha256) {
    throw new Error('V2 planning-state identity does not match the authenticated audit.')
  }
  const sourceIdentities = {
    amendedAuthorizationExactTextSha256: sha256Bytes(
      input.sources.amendedAuthorizationExactTextBytes,
    ),
    amendedTwoRowAuthorizationSha256: sha256Bytes(input.sources.amendedAuthorizationBytes),
    authorizationManifestSha256: sha256Bytes(input.sources.authorizationManifestBytes),
    authorizationMappingCorrectionManifestSha256: sha256Bytes(
      input.sources.authorizationMappingCorrectionManifestBytes,
    ),
    authorizationMappingCorrectionSha256: sha256Bytes(
      input.sources.authorizationMappingCorrectionBytes,
    ),
    authorizationMappingSha256: sha256Bytes(input.sources.authorizationMappingBytes),
    finalArtifactSha256: sha256Bytes(input.sources.finalArtifactBytes),
    migrationSha256: sha256Bytes(input.sources.migrationBytes),
    noteDispositionAuditSha256: sha256Canonical(input.sources.noteDispositionAudit),
    signedProtocolAuthorizationSha256: sha256Bytes(input.sources.signedProtocolAuthorizationBytes),
  }
  if (
    productionReadiness &&
    canonicalJson(productionReadiness.packageReadiness.authorities.packageSources) !==
      canonicalJson({
        amendedAuthorizationExactTextSha256: sourceIdentities.amendedAuthorizationExactTextSha256,
        amendedTwoRowAuthorizationSha256: sourceIdentities.amendedTwoRowAuthorizationSha256,
        authorizationManifestSha256: sourceIdentities.authorizationManifestSha256,
        authorizationMappingCorrectionManifestSha256:
          sourceIdentities.authorizationMappingCorrectionManifestSha256,
        authorizationMappingCorrectionSha256: sourceIdentities.authorizationMappingCorrectionSha256,
        authorizationMappingSha256: sourceIdentities.authorizationMappingSha256,
        finalV3ArtifactSha256: sourceIdentities.finalArtifactSha256,
        noteDispositionAuditSha256: sourceIdentities.noteDispositionAuditSha256,
        signedProtocolAuthorizationSha256: sourceIdentities.signedProtocolAuthorizationSha256,
      })
  ) {
    throw new Error('Local V2 package sources differ from captured package-source authorities.')
  }
  assertExactSha(
    sourceIdentities.finalArtifactSha256,
    GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
    'Finalized V3 artifact',
  )
  assertExactSha(
    sourceIdentities.signedProtocolAuthorizationSha256,
    GOLD_IMPORT_SIGNED_PROTOCOL_AUTHORIZATION_SHA256_V4,
    'Signed protocol authorization',
  )
  assertExactSha(
    sourceIdentities.amendedTwoRowAuthorizationSha256,
    GOLD_IMPORT_AMENDED_TWO_ROW_AUTHORIZATION_SHA256_V4,
    'Amended two-row authorization',
  )
  assertExactSha(sourceIdentities.migrationSha256, audit.migration.sha256, 'V2 migration')
  const artifact = parseFinalizedGoldImportArtifact(input.sources.finalArtifactBytes, {
    expectedArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  })
  assertProductionArtifactCohort(artifact.rows)

  const recordsByItem = new Map(artifact.rows.map((record) => [record.identity.itemId, record]))
  const legacyPlanningState = compatibilityDevelopmentPlanningStateSchema.parse(
    authenticatedDevelopmentPlanningState,
  )
  const existingHeadRows = legacyPlanningState.rows.filter((row) => row.currentReviewId !== null)
  if (existingHeadRows.length !== 9) {
    throw new Error('V2 planning state does not contain the exact nine-head cohort.')
  }
  const cohortSha256 = existingHeadCohortSha256(existingHeadRows, recordsByItem)
  if (cohortSha256 !== audit.exactExistingHeadCohort.cohortSha256) {
    throw new Error('V2 exact nine-head cohort identity drifted.')
  }
  const planningRowsByItem = new Map(planningState.rows.map((row) => [row.itemId, row]))
  const noteCurrentRows = artifact.rows
    .filter((record) => record.identity.pmid === '36879724' || record.identity.pmid === '39281191')
    .map((record) => {
      const row = planningRowsByItem.get(record.identity.itemId)
      if (
        !row?.currentEffectiveReview ||
        row.currentReviewId === null ||
        row.currentRevision === null
      ) {
        throw new Error(`V2 note PMID ${record.identity.pmid} lacks its exact current head.`)
      }
      return {
        currentNote: row.currentEffectiveReview.notes,
        currentReviewId: row.currentReviewId,
        currentRevision: row.currentRevision,
        itemId: row.itemId,
        masterRowId: record.identity.masterRowId,
        pmid: row.pmid,
      }
    })
  const noteAudit = validateGoldImportNoteDispositionGateV2({
    audit: input.sources.noteDispositionAudit,
    currentState: {
      currentEffectiveStateSha256: audit.database.effectiveStateSha256,
      currentPhysicalStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256,
      currentPointersAreLatestHeads: audit.stateIntegrity.currentPointersAreLatestHeads,
      developmentPlanningStateSha256: rawPlanningStateSha256,
      revisionChainsLinear: audit.stateIntegrity.revisionChainsLinear,
      rows: noteCurrentRows,
    },
    evidence: input.sources,
  })
  const planningRows = derivePackagePlanningRowsV2({
    artifactRows: artifact.rows,
    noteAudit,
    planningState,
  })
  const counts = deriveImportActionCountsV2(planningRows)
  const expectedPostImportEffectiveStateSha256 =
    deriveExpectedPostImportEffectiveStateSha256V2(planningRows)
  if (audit.expectedPostImportEffectiveStateSha256 !== expectedPostImportEffectiveStateSha256) {
    throw new Error(
      'V2 audited post-import effective-state identity differs from the independently derived candidate projection.',
    )
  }
  const sourceAuthorizationSet = buildGoldImportSourceAuthorizationSetV4({
    actionCounts: counts,
    auditTarget: audit.target,
    batchId: audit.database.batchId,
    booleanNormalizationLedger: [...artifact.booleanNormalizations],
    completeCatalogAudit: audit.completeCatalogAudit,
    environmentInvariantIdentitySha256: audit.contractAudit.environmentInvariantIdentitySha256,
    environmentProfileIdentitySha256: audit.contractAudit.environmentProfileIdentitySha256,
    existingHeadCohortSha256: cohortSha256,
    expectedCatalog: audit.expectedCatalog,
    migrationSha256: sourceIdentities.migrationSha256,
    orderedSetNormalizationLedger: [...artifact.listNormalizations],
    v2PreImportEffectiveStateSha256: audit.v2PreImportState.effectiveStateSha256,
    v2PreImportPhysicalStateSha256: audit.v2PreImportState.physicalStateSha256,
  })
  const sourceAuthorizationSetBytes =
    canonicalGoldImportSourceAuthorizationSetV4Bytes(sourceAuthorizationSet)
  const sourceAuthorizationSetSha256 = sha256Bytes(sourceAuthorizationSetBytes)
  const operationId = deterministicPackageUuidV2(
    GOLD_IMPORT_COMPENSATION_PACKAGE_VERSION_V2,
    audit.database.batchId,
    audit.v2PreImportState,
    sourceAuthorizationSetSha256,
    'import-operation',
  )
  const importPlan = bindImportPlanV2({
    actions: buildImportActionsV2(planningRows, operationId),
    batchId: audit.database.batchId,
    booleanNormalizationLedgerSha256: sourceAuthorizationSet.booleanNormalizationLedgerSha256,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    counts,
    executionContext: {
      compensationRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.compensation,
      developmentMembershipHash: 'literature_gold_development_membership_hash_v1',
      effectiveStateHash: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.effectiveStateHash,
      importRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.import,
      migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      physicalStateHash: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.physicalStateHash,
      reconciliationRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.reconciliation,
      remoteWritesAllowed: false,
      repositoryCommitSha: audit.repositoryCommitSha,
      targetDatabase: 'local',
    },
    expectedEffectiveStateSha256: audit.v2PreImportState.effectiveStateSha256,
    expectedPhysicalStateSha256: audit.v2PreImportState.physicalStateSha256,
    expectedPostEffectiveStateSha256: expectedPostImportEffectiveStateSha256,
    kind: 'import',
    noteDispositionAuditSha256: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
    operationId,
    orderedSetNormalizationLedgerSha256: sourceAuthorizationSet.orderedSetNormalizationLedgerSha256,
    scope: {
      datasetSplit: 'development',
      developmentMembershipSha256: audit.database.developmentMembershipSha256,
      heldOutIdentitiesAccessed: false,
    },
    sourceArtifactSha256: artifact.artifactSha256,
    sourceAuthorizationSetSha256,
  })
  const compensationTemplate = buildCompensationTemplateV2(importPlan)
  const unsignedAuthorization = unsignedImportAuthorizationTemplateV2Schema.parse({
    authorizationId: null,
    authorizationNote: null,
    authorized: false,
    authorizedAt: null,
    authorizedBy: null,
    batchId: importPlan.batchId,
    binding: null,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    expectedEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
    expectedPostEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
    idempotencyKey: importPlan.binding.idempotencyKey,
    ...(productionReadiness
      ? { compensationAuthorized: false as const, importAuthorized: false as const }
      : {}),
    kind: 'unsigned_import_authorization_template',
    migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
    notExecutable: true,
    operationId: importPlan.operationId,
    planSha256: importPlan.binding.contentSha256,
    readiness: 'separate_operator_authorization_required',
    remoteWritesAllowed: false,
    repositoryCommitSha: audit.repositoryCommitSha,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    booleanNormalizationLedgerSha256: importPlan.booleanNormalizationLedgerSha256,
    noteDispositionAuditSha256: importPlan.noteDispositionAuditSha256,
    orderedSetNormalizationLedgerSha256: importPlan.orderedSetNormalizationLedgerSha256,
    sourceAuthorizationSetSha256,
    targetDatabase: 'local',
  })
  const unsignedCompensationAuthorization = unsignedCompensationAuthorizationTemplateV2Schema.parse(
    {
      authorizationId: null,
      authorizationNote: null,
      authorized: false,
      authorizedAt: null,
      authorizedBy: null,
      batchId: compensationTemplate.batchId,
      binding: null,
      booleanNormalizationLedgerSha256: importPlan.booleanNormalizationLedgerSha256,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
      expectedEffectiveStateSha256: compensationTemplate.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: null,
      expectedPostEffectiveStateSha256: compensationTemplate.expectedPostEffectiveStateSha256,
      idempotencyKey: null,
      ...(productionReadiness
        ? { compensationAuthorized: false as const, importAuthorized: false as const }
        : {}),
      importReceiptSha256: null,
      kind: 'unsigned_compensation_authorization_template',
      migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      noteDispositionAuditSha256: importPlan.noteDispositionAuditSha256,
      notExecutable: true,
      operationId: compensationTemplate.operationId,
      orderedSetNormalizationLedgerSha256: importPlan.orderedSetNormalizationLedgerSha256,
      planSha256: null,
      readiness: 'committed_import_receipt_and_separate_authorization_required',
      remoteWritesAllowed: false,
      repositoryCommitSha: audit.repositoryCommitSha,
      sourceArtifactSha256: importPlan.sourceArtifactSha256,
      sourceAuthorizationSetSha256: importPlan.sourceAuthorizationSetSha256,
      targetDatabase: 'local',
      targetImportOperationId: importPlan.operationId,
    },
  )
  const files = new Map<string, Buffer>()
  files.set(
    'ambiguous-outcome-reconciliation-v2.json',
    canonicalPretty({
      automaticRetryAllowed: false,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
      importOperationId: importPlan.operationId,
      importPlanSha256: importPlan.binding.contentSha256,
      kind: 'ambiguous_outcome_reconciliation',
      reconciliationRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.reconciliation,
      recoveryMutationsAllowed: false,
    }),
  )
  files.set('append-only-compensation-plan-template-v2.json', canonicalPretty(compensationTemplate))
  files.set(
    'exact-catalog-binding-v2.json',
    canonicalPretty({
      auditTarget: audit.target,
      authorization: 'exact_committed_expected_state',
      completeCatalogAudit: audit.completeCatalogAudit,
      expectedCatalog: audit.expectedCatalog,
      schemaVersion: 'gold-import-compensation-v2-exact-catalog-binding/1.0.0',
    }),
  )
  files.set(
    'finalized-migration-receipt-gate-v2.json',
    migrationReceiptGateArtifactBytes(migrationReceiptGate),
  )
  if (productionReadiness) {
    files.set('post-v2-preimport-package-readiness-v2.json', canonicalPretty(productionReadiness))
  }
  files.set(
    'boolean-normalization-ledger-v2.json',
    canonicalPretty({
      artifactSha256: artifact.artifactSha256,
      ledger: artifact.booleanNormalizations,
      ledgerSha256: sourceAuthorizationSet.booleanNormalizationLedgerSha256,
      schemaVersion: 'gold-import-boolean-normalization-ledger/2.0.0',
    }),
  )
  files.set('immutable-atomic-import-plan-v2.json', canonicalPretty(importPlan))
  files.set(
    'journal-template-v2.json',
    canonicalPretty({
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
      importActionCount: counts.total,
      importOperationId: importPlan.operationId,
      notExecuted: true,
      outcome: null,
      receipt: null,
    }),
  )
  files.set(
    'note-disposition-proof-v2.json',
    canonicalPretty({
      audit: noteAudit,
      auditSha256: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
      exactTwoRowGatePassed: true,
      schemaVersion: 'gold-import-note-disposition-proof/2.0.0',
    }),
  )
  files.set(
    'ordered-set-normalization-ledger-v2.json',
    canonicalPretty({
      artifactSha256: artifact.artifactSha256,
      ledger: artifact.listNormalizations,
      ledgerSha256: sourceAuthorizationSet.orderedSetNormalizationLedgerSha256,
      schemaVersion: 'gold-import-ordered-set-normalization-ledger/2.0.0',
    }),
  )
  files.set(
    'proposed-commands-v2.txt',
    Buffer.from(
      'Generate only after the V2 migration audit is ready. Execute only with a separately completed operator authorization; never retry an ambiguous operation.\n',
      'utf8',
    ),
  )
  files.set(
    'receipt-template-v2.json',
    canonicalPretty({
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
      evidence: {
        booleanNormalizationLedgerSha256: importPlan.booleanNormalizationLedgerSha256,
        noteDispositionAuditSha256: importPlan.noteDispositionAuditSha256,
        orderedSetNormalizationLedgerSha256: importPlan.orderedSetNormalizationLedgerSha256,
        sourceAuthorizationSetSha256: importPlan.sourceAuthorizationSetSha256,
      },
      migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      notExecuted: true,
      operationId: importPlan.operationId,
      physicalHashes: 'database_observed_at_execution',
    }),
  )
  files.set('source-authorization-set-v4.json', sourceAuthorizationSetBytes)
  files.set(
    'state-hash-proof-v2.json',
    canonicalPretty({
      compensationRestoresPreImportEffectiveState: true,
      postCompensationEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
      postImportEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
      preImportEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
      preImportPhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
      physicalHistoryAppendOnly: true,
      schemaVersion: 'gold-import-compensation-state-hash-proof/2.0.0',
    }),
  )
  files.set(
    'unsigned-compensation-operation-authorization-template-v2.json',
    canonicalPretty(unsignedCompensationAuthorization),
  )
  files.set(
    'unsigned-import-operation-authorization-template-v2.json',
    canonicalPretty(unsignedAuthorization),
  )
  const artifactChecksums = Object.fromEntries(
    [...files.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => [name, sha256Bytes(bytes)]),
  )
  const packageDescriptor = packageDescriptorV2Schema.parse({
    actionCounts: counts,
    artifacts: artifactChecksums,
    auditTarget: audit.target,
    completeCatalogAuditIdentitySha256: audit.completeCatalogAudit.fullAuditIdentitySha256,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    databaseAccess: 'none_file_only_authenticated_audit',
    heldOutIdentitiesAccessed: false,
    importOperationId: importPlan.operationId,
    importPlanSha256: importPlan.binding.contentSha256,
    kind: 'gold_import_compensation_package',
    expectedCatalogArtifactContentSha256: audit.expectedCatalog.artifact.contentSha256,
    expectedCatalogArtifactFileSha256: audit.expectedCatalog.artifact.fileSha256,
    expectedCatalogBindingSha256: audit.expectedCatalog.bindingSha256,
    migration: { id: audit.migration.id, sha256: audit.migration.sha256 },
    migrationReceiptGateSha256: migrationReceiptGateArtifactSha256(migrationReceiptGate),
    migrationReceiptKind: migrationReceiptGate.source.receiptKind,
    ...(productionReadiness
      ? {
          packageReadinessIdentitySha256: productionReadiness.readinessIdentitySha256,
          preimportCapturePairIdentitySha256: productionReadiness.capturePair.pairIdentitySha256,
        }
      : {}),
    noteDispositionAuditSha256: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
    packageVersion: GOLD_IMPORT_COMPENSATION_PACKAGE_VERSION_V2,
    remoteAccess: false,
    schemaVersion: GOLD_IMPORT_COMPENSATION_PACKAGE_GENERATOR_SCHEMA_VERSION_V2,
    sourceAuthorizationSetSha256,
    sourceAuthorizationVersion: 4,
  })
  files.set('package-descriptor-v2.json', canonicalPretty(packageDescriptor))
  const manifest = buildManifest(files)
  files.set('checksum-manifest-v2.sha256', manifest)
  return {
    compensationTemplate,
    developmentPlanningState: authenticatedDevelopmentPlanningState,
    files,
    importPlan,
    manifestSha256: sha256Bytes(manifest),
    migrationReceiptGate,
    packageDescriptor,
    productionReadiness,
    sourceArtifactBytes: Buffer.from(input.sources.finalArtifactBytes),
    sourceAuthorizationSet,
    verifiedBindings: {
      completeCatalogAuditIdentitySha256: audit.completeCatalogAudit.fullAuditIdentitySha256,
      developmentPlanningStateSha256: rawPlanningStateSha256,
      expectedCatalogBindingSha256: audit.expectedCatalog.bindingSha256,
      migrationSha256: sourceIdentities.migrationSha256,
      migrationReceiptGateSha256: migrationReceiptGateArtifactSha256(migrationReceiptGate),
      packageReadinessIdentitySha256: productionReadiness?.readinessIdentitySha256 ?? null,
      sourceArtifactSha256: artifact.artifactSha256,
      sourceAuthorizationSetSha256,
    },
  }
}

/**
 * Public branch-agnostic generator for disposable-clone rehearsal only.
 * Local package readiness is accepted exclusively by the private production
 * orchestration path after live fixed-local authentication.
 */
export function generateGoldImportCompensationPackageV2(
  disposableInput: GenerateDisposableGoldImportCompensationPackageV2Input,
): GeneratedGoldImportCompensationPackageV2 {
  if ('productionReadiness' in disposableInput) {
    throw new Error('Exported V2 package generation cannot accept production readiness.')
  }
  const rawAudit = disposableInput.audit
  if (
    !rawAudit ||
    typeof rawAudit !== 'object' ||
    Array.isArray(rawAudit) ||
    (rawAudit as { target?: unknown }).target !== 'disposable_clone'
  ) {
    throw new Error('Exported V2 package generation is restricted to disposable rehearsal.')
  }
  const audit = validateReadyGoldImportCompensationV2Audit(rawAudit)
  return generateGoldImportCompensationPackageV2Internal({
    audit,
    developmentPlanningState: disposableInput.developmentPlanningState,
    migrationReceiptGate: disposableInput.migrationReceiptGate,
    productionReadiness: undefined,
    sources: disposableInput.sources,
  })
}

const BASE_REQUIRED_PACKAGE_FILES_V2 = [
  'ambiguous-outcome-reconciliation-v2.json',
  'append-only-compensation-plan-template-v2.json',
  'boolean-normalization-ledger-v2.json',
  'checksum-manifest-v2.sha256',
  'exact-catalog-binding-v2.json',
  'finalized-migration-receipt-gate-v2.json',
  'immutable-atomic-import-plan-v2.json',
  'journal-template-v2.json',
  'note-disposition-proof-v2.json',
  'ordered-set-normalization-ledger-v2.json',
  'package-descriptor-v2.json',
  'proposed-commands-v2.txt',
  'receipt-template-v2.json',
  'source-authorization-set-v4.json',
  'state-hash-proof-v2.json',
  'unsigned-compensation-operation-authorization-template-v2.json',
  'unsigned-import-operation-authorization-template-v2.json',
] as const

const PRODUCTION_PACKAGE_READINESS_FILE_V2 = 'post-v2-preimport-package-readiness-v2.json' as const

export interface VerifiedGoldImportCompensationPackageV2IntrinsicFiles {
  compensationTemplate: CompensationPlanTemplateV2
  files: ReadonlyMap<string, Buffer>
  importPlan: ImportPlanV2
  manifestSha256: string
  migrationReceiptGate: GoldImportCompensationV2MigrationReceiptGate
  packageDescriptor: PackageDescriptorV2
  productionReadiness: GoldImportV2PackageGenerationReadiness | null
  sourceAuthorizationSet: GoldImportSourceAuthorizationSetV4
}

export function verifyGoldImportCompensationPackageV2IntrinsicFiles(
  inputFiles: ReadonlyMap<string, Buffer>,
): VerifiedGoldImportCompensationPackageV2IntrinsicFiles {
  const files = new DetachedReadonlyBufferMap(inputFiles)
  const actualFiles = [...files.keys()].sort((left, right) => left.localeCompare(right, 'en'))
  const hasProductionReadiness = files.has(PRODUCTION_PACKAGE_READINESS_FILE_V2)
  const expectedFiles = [
    ...BASE_REQUIRED_PACKAGE_FILES_V2,
    ...(hasProductionReadiness ? [PRODUCTION_PACKAGE_READINESS_FILE_V2] : []),
  ].sort((left, right) => left.localeCompare(right, 'en'))
  if (canonicalJson(actualFiles) !== canonicalJson(expectedFiles)) {
    throw new Error('V2 generated package has a missing or unexpected artifact.')
  }
  for (const [name, bytes] of files) {
    if (!name.endsWith('.json')) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(bytes.toString('utf8')) as unknown
    } catch {
      throw new Error(`V2 package JSON artifact is invalid: ${name}.`)
    }
    if (!bytes.equals(canonicalPretty(parsed))) {
      throw new Error(`V2 package JSON artifact is not canonical: ${name}.`)
    }
  }
  const planBytes = files.get('immutable-atomic-import-plan-v2.json')!
  const plan = parseImportPlanV2(JSON.parse(planBytes.toString('utf8')) as unknown)
  const sourceAuthorizationBytes = files.get('source-authorization-set-v4.json')!
  const sourceAuthorization =
    parseCanonicalGoldImportSourceAuthorizationSetV4Bytes(sourceAuthorizationBytes)
  const migrationReceiptGate = validateGoldImportCompensationV2MigrationReceiptGateForBinding(
    JSON.parse(files.get('finalized-migration-receipt-gate-v2.json')!.toString('utf8')) as unknown,
    {
      auditTarget: sourceAuthorization.auditTarget,
      batchId: sourceAuthorization.currentDatabase.batchId,
      completeCatalogAuditIdentitySha256:
        sourceAuthorization.completeCatalogAudit.fullAuditIdentitySha256,
      developmentMembershipSha256: sourceAuthorization.currentDatabase.developmentMembershipSha256,
      developmentPlanningStateSha256:
        sourceAuthorization.currentDatabase.developmentPlanningStateSha256,
      expectedCatalogBindingSha256: sourceAuthorization.expectedCatalog.bindingSha256,
      migrationId: sourceAuthorization.migration.id,
      migrationSha256: sourceAuthorization.migration.sha256,
      preImportEffectiveStateSha256: sourceAuthorization.v2PreImportState.effectiveStateSha256,
      preImportPhysicalStateSha256: sourceAuthorization.v2PreImportState.physicalStateSha256,
      v1Occurrence: 1,
      v2Occurrence: 1,
    },
  )
  const rawExactCatalogBinding = z
    .object({
      auditTarget: z.enum(['disposable_clone', 'local']),
      authorization: z.literal('exact_committed_expected_state'),
      completeCatalogAudit: z.unknown(),
      expectedCatalog: z.unknown(),
      schemaVersion: z.literal('gold-import-compensation-v2-exact-catalog-binding/1.0.0'),
    })
    .strict()
    .parse(JSON.parse(files.get('exact-catalog-binding-v2.json')!.toString('utf8')) as unknown)
  const exactCatalogContext =
    rawExactCatalogBinding.auditTarget === 'disposable_clone'
      ? ({ profileId: 'supabase_admin_owner_v1', target: 'disposable' } as const)
      : ({ profileId: 'local_supabase_postgres_owner_v1', target: 'local' } as const)
  const exactCatalogBinding: ExactCatalogBindingArtifactV2 = {
    ...rawExactCatalogBinding,
    completeCatalogAudit: validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
      rawExactCatalogBinding.completeCatalogAudit,
      exactCatalogContext.profileId,
      exactCatalogContext.target,
    ),
    expectedCatalog: validateProtectedV2ExpectedCatalogBinding(
      rawExactCatalogBinding.expectedCatalog,
      exactCatalogContext.profileId,
      exactCatalogContext.target,
    ),
  }
  const packageDescriptor = packageDescriptorV2Schema.parse(
    JSON.parse(files.get('package-descriptor-v2.json')!.toString('utf8')) as unknown,
  )
  const productionReadiness = hasProductionReadiness
    ? validateGoldImportV2PackageGenerationReadiness(
        JSON.parse(files.get(PRODUCTION_PACKAGE_READINESS_FILE_V2)!.toString('utf8')) as unknown,
      )
    : null
  if (productionReadiness) {
    const state = productionReadiness.packageReadiness
    const receipt = productionReadiness.finalizedReceipt
    if (
      migrationReceiptGate.auditTarget !== 'local' ||
      migrationReceiptGate.kind !== 'finalized_migration_receipt' ||
      migrationReceiptGate.productionUseAllowed !== true ||
      migrationReceiptGate.importAuthorized !== false ||
      migrationReceiptGate.compensationAuthorized !== false ||
      migrationReceiptGate.batchId !== state.batch.id ||
      migrationReceiptGate.migration.v1Occurrence !== state.migrationLedger.v1.occurrence ||
      migrationReceiptGate.migration.v2Occurrence !== state.migrationLedger.v2.occurrence ||
      migrationReceiptGate.migration.sha256 !== state.migrationLedger.v2.sha256 ||
      migrationReceiptGate.catalog.expectedCatalogBindingSha256 !==
        state.authorities.expectedCatalogBindingSha256 ||
      migrationReceiptGate.catalog.completeCatalogAuditIdentitySha256 !==
        state.stateIdentities.completeLocalProfileCatalogAuditSha256 ||
      migrationReceiptGate.preImportState.developmentMembershipSha256 !==
        state.stateIdentities.developmentMembershipSha256 ||
      migrationReceiptGate.preImportState.developmentPlanningStateSha256 !==
        state.stateIdentities.planningStateSha256 ||
      migrationReceiptGate.preImportState.effectiveStateSha256 !==
        state.stateIdentities.effectiveStateSha256V2 ||
      migrationReceiptGate.preImportState.physicalStateSha256 !==
        state.stateIdentities.physicalStateSha256V2 ||
      migrationReceiptGate.source.receiptKind !== 'historical_recovery' ||
      migrationReceiptGate.source.executionReceiptSha256 !== receipt.executionReceiptSha256 ||
      migrationReceiptGate.source.finalManifestSha256 !== receipt.finalManifestSha256 ||
      migrationReceiptGate.source.originalIntentSha256 !== receipt.originalIntentSha256 ||
      migrationReceiptGate.source.outputDirectory !== receipt.outputDirectory ||
      migrationReceiptGate.source.recoveryAmendmentIdentitySha256 !==
        receipt.amendmentIdentitySha256 ||
      migrationReceiptGate.source.recoveryToolBundleSha256 !== receipt.recoveryToolBundleSha256 ||
      migrationReceiptGate.source.resultSha256 !== receipt.resultSha256
    ) {
      throw new Error(
        'V2 package migration gate is not bound to its exact post-V2 readiness artifact.',
      )
    }
  }
  const unsignedAuthorization = unsignedImportAuthorizationTemplateV2Schema.parse(
    JSON.parse(
      files.get('unsigned-import-operation-authorization-template-v2.json')!.toString('utf8'),
    ) as unknown,
  )
  const unsignedCompensationAuthorization = unsignedCompensationAuthorizationTemplateV2Schema.parse(
    JSON.parse(
      files.get('unsigned-compensation-operation-authorization-template-v2.json')!.toString('utf8'),
    ) as unknown,
  )
  const compensationTemplate = compensationPlanTemplateV2Schema.parse(
    JSON.parse(
      files.get('append-only-compensation-plan-template-v2.json')!.toString('utf8'),
    ) as unknown,
  )
  if (
    canonicalJson(exactCatalogBinding.completeCatalogAudit) !==
      canonicalJson(sourceAuthorization.completeCatalogAudit) ||
    canonicalJson(exactCatalogBinding.expectedCatalog) !==
      canonicalJson(sourceAuthorization.expectedCatalog) ||
    exactCatalogBinding.auditTarget !== sourceAuthorization.auditTarget ||
    sourceAuthorization.migration.id !== exactCatalogBinding.expectedCatalog.migration.id ||
    sourceAuthorization.migration.sha256 !== exactCatalogBinding.expectedCatalog.migration.sha256 ||
    packageDescriptor.migration.id !== exactCatalogBinding.expectedCatalog.migration.id ||
    packageDescriptor.migration.sha256 !== exactCatalogBinding.expectedCatalog.migration.sha256
  ) {
    throw new Error(
      'V2 package exact catalog artifact, source authorization, descriptor, or returned bindings differ.',
    )
  }
  if (
    plan.sourceAuthorizationSetSha256 !== sha256Bytes(sourceAuthorizationBytes) ||
    plan.sourceArtifactSha256 !== sourceAuthorization.finalArtifactSha256 ||
    plan.batchId !== sourceAuthorization.currentDatabase.batchId ||
    plan.scope.datasetSplit !== 'development' ||
    plan.scope.heldOutIdentitiesAccessed !== false ||
    plan.scope.developmentMembershipSha256 !==
      sourceAuthorization.currentDatabase.developmentMembershipSha256 ||
    plan.expectedEffectiveStateSha256 !==
      sourceAuthorization.v2PreImportState.effectiveStateSha256 ||
    plan.expectedPhysicalStateSha256 !== sourceAuthorization.v2PreImportState.physicalStateSha256 ||
    canonicalJson(plan.counts) !== canonicalJson(sourceAuthorization.actionCounts) ||
    plan.noteDispositionAuditSha256 !== sourceAuthorization.noteDispositionAuditSha256 ||
    plan.booleanNormalizationLedgerSha256 !==
      sourceAuthorization.booleanNormalizationLedgerSha256 ||
    plan.orderedSetNormalizationLedgerSha256 !==
      sourceAuthorization.orderedSetNormalizationLedgerSha256
  ) {
    throw new Error('V2 package plan and source authorization evidence bindings differ.')
  }
  const expectedDescriptorArtifacts = Object.fromEntries(
    [...files.entries()]
      .filter(
        ([name]) => name !== 'checksum-manifest-v2.sha256' && name !== 'package-descriptor-v2.json',
      )
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => [name, sha256Bytes(bytes)]),
  )
  if (
    canonicalJson(packageDescriptor.artifacts) !== canonicalJson(expectedDescriptorArtifacts) ||
    canonicalJson(packageDescriptor.actionCounts) !== canonicalJson(plan.counts) ||
    packageDescriptor.importOperationId !== plan.operationId ||
    packageDescriptor.importPlanSha256 !== plan.binding.contentSha256 ||
    packageDescriptor.auditTarget !== exactCatalogBinding.auditTarget ||
    packageDescriptor.completeCatalogAuditIdentitySha256 !==
      exactCatalogBinding.completeCatalogAudit.fullAuditIdentitySha256 ||
    packageDescriptor.expectedCatalogArtifactContentSha256 !==
      exactCatalogBinding.expectedCatalog.artifact.contentSha256 ||
    packageDescriptor.expectedCatalogArtifactFileSha256 !==
      exactCatalogBinding.expectedCatalog.artifact.fileSha256 ||
    packageDescriptor.expectedCatalogBindingSha256 !==
      exactCatalogBinding.expectedCatalog.bindingSha256 ||
    packageDescriptor.sourceAuthorizationSetSha256 !== sha256Bytes(sourceAuthorizationBytes) ||
    packageDescriptor.migration.sha256 !== sourceAuthorization.migration.sha256 ||
    packageDescriptor.migrationReceiptGateSha256 !==
      migrationReceiptGateArtifactSha256(migrationReceiptGate) ||
    packageDescriptor.migrationReceiptKind !== migrationReceiptGate.source.receiptKind ||
    packageDescriptor.packageReadinessIdentitySha256 !==
      productionReadiness?.readinessIdentitySha256 ||
    packageDescriptor.preimportCapturePairIdentitySha256 !==
      productionReadiness?.capturePair.pairIdentitySha256 ||
    (packageDescriptor.auditTarget === 'local') !== (productionReadiness !== null)
  ) {
    throw new Error('V2 package descriptor is stale or does not cover every canonical artifact.')
  }
  if (
    unsignedAuthorization.operationId !== plan.operationId ||
    unsignedAuthorization.planSha256 !== plan.binding.contentSha256 ||
    unsignedAuthorization.idempotencyKey !== plan.binding.idempotencyKey ||
    unsignedAuthorization.sourceAuthorizationSetSha256 !== plan.sourceAuthorizationSetSha256 ||
    unsignedAuthorization.noteDispositionAuditSha256 !== plan.noteDispositionAuditSha256 ||
    unsignedAuthorization.booleanNormalizationLedgerSha256 !==
      plan.booleanNormalizationLedgerSha256 ||
    unsignedAuthorization.orderedSetNormalizationLedgerSha256 !==
      plan.orderedSetNormalizationLedgerSha256 ||
    (productionReadiness !== null &&
      (plan.executionContext.repositoryCommitSha !==
        productionReadiness.currentRepository.headSha ||
        unsignedAuthorization.importAuthorized !== false ||
        unsignedAuthorization.compensationAuthorized !== false ||
        unsignedAuthorization.authorized !== false ||
        unsignedAuthorization.notExecutable !== true))
  ) {
    throw new Error('V2 unsigned authorization template is not bound to the import plan.')
  }
  const restored = compensationTemplate.actions.filter(
    (action) => action.action === 'compensate_restore',
  ).length
  const voided = compensationTemplate.actions.filter(
    (action) => action.action === 'compensate_void',
  ).length
  const noops = compensationTemplate.actions.filter(
    (action) => action.action === 'compensate_noop',
  ).length
  if (
    canonicalJson(compensationTemplate.counts) !==
      canonicalJson({ noops, restored, total: compensationTemplate.actions.length, voided }) ||
    compensationTemplate.actions.length !== plan.actions.length ||
    compensationTemplate.actions.some(
      (action, index) => action.sourceActionId !== plan.actions[index]?.actionId,
    ) ||
    compensationTemplate.evidence.sourceAuthorizationSetSha256 !==
      plan.sourceAuthorizationSetSha256 ||
    compensationTemplate.evidence.noteDispositionAuditSha256 !== plan.noteDispositionAuditSha256 ||
    compensationTemplate.evidence.booleanNormalizationLedgerSha256 !==
      plan.booleanNormalizationLedgerSha256 ||
    compensationTemplate.evidence.orderedSetNormalizationLedgerSha256 !==
      plan.orderedSetNormalizationLedgerSha256
  ) {
    throw new Error('V2 compensation template is incomplete or stale relative to the import plan.')
  }
  if (
    unsignedCompensationAuthorization.operationId !== compensationTemplate.operationId ||
    unsignedCompensationAuthorization.targetImportOperationId !== plan.operationId ||
    unsignedCompensationAuthorization.sourceAuthorizationSetSha256 !==
      plan.sourceAuthorizationSetSha256 ||
    unsignedCompensationAuthorization.noteDispositionAuditSha256 !==
      plan.noteDispositionAuditSha256 ||
    unsignedCompensationAuthorization.booleanNormalizationLedgerSha256 !==
      plan.booleanNormalizationLedgerSha256 ||
    unsignedCompensationAuthorization.orderedSetNormalizationLedgerSha256 !==
      plan.orderedSetNormalizationLedgerSha256 ||
    (productionReadiness !== null &&
      (unsignedCompensationAuthorization.importAuthorized !== false ||
        unsignedCompensationAuthorization.compensationAuthorized !== false ||
        unsignedCompensationAuthorization.authorized !== false ||
        unsignedCompensationAuthorization.notExecutable !== true))
  ) {
    throw new Error('V2 unsigned compensation authorization template is stale.')
  }
  const noteProof = z
    .object({
      audit: z.unknown(),
      auditSha256: z.literal(GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2),
      exactTwoRowGatePassed: z.literal(true),
      schemaVersion: z.literal('gold-import-note-disposition-proof/2.0.0'),
    })
    .strict()
    .parse(JSON.parse(files.get('note-disposition-proof-v2.json')!.toString('utf8')) as unknown)
  if (sha256Canonical(noteProof.audit) !== noteProof.auditSha256) {
    throw new Error('V2 note-disposition proof does not carry the exact accepted audit.')
  }
  for (const [name, expectedLedger, expectedSha256, expectedSchemaVersion] of [
    [
      'boolean-normalization-ledger-v2.json',
      sourceAuthorization.booleanNormalizationLedger,
      sourceAuthorization.booleanNormalizationLedgerSha256,
      'gold-import-boolean-normalization-ledger/2.0.0',
    ],
    [
      'ordered-set-normalization-ledger-v2.json',
      sourceAuthorization.orderedSetNormalizationLedger,
      sourceAuthorization.orderedSetNormalizationLedgerSha256,
      'gold-import-ordered-set-normalization-ledger/2.0.0',
    ],
  ] as const) {
    const artifact = z
      .object({
        artifactSha256: z.literal(sourceAuthorization.finalArtifactSha256),
        ledger: z.unknown(),
        ledgerSha256: z.literal(expectedSha256),
        schemaVersion: z.literal(expectedSchemaVersion),
      })
      .strict()
      .parse(JSON.parse(files.get(name)!.toString('utf8')) as unknown)
    if (
      canonicalJson(artifact.ledger) !== canonicalJson(expectedLedger) ||
      sha256Canonical(artifact.ledger) !== expectedSha256
    ) {
      throw new Error(`V2 normalization artifact is stale: ${name}.`)
    }
  }
  const expectedUnsignedImportAuthorization = unsignedImportAuthorizationTemplateV2Schema.parse({
    authorizationId: null,
    authorizationNote: null,
    authorized: false,
    authorizedAt: null,
    authorizedBy: null,
    batchId: plan.batchId,
    binding: null,
    booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
    expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    ...(productionReadiness
      ? { compensationAuthorized: false as const, importAuthorized: false as const }
      : {}),
    kind: 'unsigned_import_authorization_template',
    migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
    noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
    notExecutable: true,
    operationId: plan.operationId,
    orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
    planSha256: plan.binding.contentSha256,
    readiness: 'separate_operator_authorization_required',
    remoteWritesAllowed: false,
    repositoryCommitSha: plan.executionContext.repositoryCommitSha,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
    targetDatabase: 'local',
  })
  const expectedUnsignedCompensationAuthorization =
    unsignedCompensationAuthorizationTemplateV2Schema.parse({
      authorizationId: null,
      authorizationNote: null,
      authorized: false,
      authorizedAt: null,
      authorizedBy: null,
      batchId: compensationTemplate.batchId,
      binding: null,
      booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
      expectedEffectiveStateSha256: compensationTemplate.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: null,
      expectedPostEffectiveStateSha256: compensationTemplate.expectedPostEffectiveStateSha256,
      idempotencyKey: null,
      ...(productionReadiness
        ? { compensationAuthorized: false as const, importAuthorized: false as const }
        : {}),
      importReceiptSha256: null,
      kind: 'unsigned_compensation_authorization_template',
      migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
      notExecutable: true,
      operationId: compensationTemplate.operationId,
      orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
      planSha256: null,
      readiness: 'committed_import_receipt_and_separate_authorization_required',
      remoteWritesAllowed: false,
      repositoryCommitSha: plan.executionContext.repositoryCommitSha,
      sourceArtifactSha256: plan.sourceArtifactSha256,
      sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
      targetDatabase: 'local',
      targetImportOperationId: plan.operationId,
    })
  const deterministicFiles = new Map<string, Buffer>([
    [
      'ambiguous-outcome-reconciliation-v2.json',
      canonicalPretty({
        automaticRetryAllowed: false,
        contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
        importOperationId: plan.operationId,
        importPlanSha256: plan.binding.contentSha256,
        kind: 'ambiguous_outcome_reconciliation',
        reconciliationRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.reconciliation,
        recoveryMutationsAllowed: false,
      }),
    ],
    [
      'append-only-compensation-plan-template-v2.json',
      canonicalPretty(buildCompensationTemplateV2(plan)),
    ],
    [
      'journal-template-v2.json',
      canonicalPretty({
        contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
        importActionCount: plan.counts.total,
        importOperationId: plan.operationId,
        notExecuted: true,
        outcome: null,
        receipt: null,
      }),
    ],
    [
      'proposed-commands-v2.txt',
      Buffer.from(
        'Generate only after the V2 migration audit is ready. Execute only with a separately completed operator authorization; never retry an ambiguous operation.\n',
        'utf8',
      ),
    ],
    [
      'receipt-template-v2.json',
      canonicalPretty({
        contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
        evidence: {
          booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
          noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
          orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
          sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
        },
        migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
        notExecuted: true,
        operationId: plan.operationId,
        physicalHashes: 'database_observed_at_execution',
      }),
    ],
    [
      'state-hash-proof-v2.json',
      canonicalPretty({
        compensationRestoresPreImportEffectiveState: true,
        physicalHistoryAppendOnly: true,
        postCompensationEffectiveStateSha256: plan.expectedEffectiveStateSha256,
        postImportEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
        preImportEffectiveStateSha256: plan.expectedEffectiveStateSha256,
        preImportPhysicalStateSha256: plan.expectedPhysicalStateSha256,
        schemaVersion: 'gold-import-compensation-state-hash-proof/2.0.0',
      }),
    ],
    [
      'unsigned-compensation-operation-authorization-template-v2.json',
      canonicalPretty(expectedUnsignedCompensationAuthorization),
    ],
    [
      'unsigned-import-operation-authorization-template-v2.json',
      canonicalPretty(expectedUnsignedImportAuthorization),
    ],
  ])
  for (const [name, expectedBytes] of deterministicFiles) {
    if (!files.get(name)?.equals(expectedBytes)) {
      throw new Error(`V2 deterministic package artifact is stale or unsafe: ${name}.`)
    }
  }
  const filesWithoutManifest = new Map(files)
  const manifest = filesWithoutManifest.get('checksum-manifest-v2.sha256')!
  filesWithoutManifest.delete('checksum-manifest-v2.sha256')
  if (!manifest.equals(buildManifest(filesWithoutManifest))) {
    throw new Error('V2 package checksum manifest is noncanonical or stale.')
  }
  return {
    compensationTemplate: canonicalFrozenClone(compensationTemplate),
    files,
    importPlan: canonicalFrozenClone(plan),
    manifestSha256: sha256Bytes(manifest),
    migrationReceiptGate: canonicalFrozenClone(migrationReceiptGate),
    packageDescriptor: canonicalFrozenClone(packageDescriptor),
    productionReadiness: productionReadiness ? canonicalFrozenClone(productionReadiness) : null,
    sourceAuthorizationSet: canonicalFrozenClone(sourceAuthorization),
  }
}

export function verifyGeneratedGoldImportCompensationPackageV2(
  input: GeneratedGoldImportCompensationPackageV2,
): GeneratedGoldImportCompensationPackageV2 {
  const intrinsic = verifyGoldImportCompensationPackageV2IntrinsicFiles(input.files)
  const { authenticatedSource: authenticatedDevelopmentPlanningState } =
    validateAndSnapshotDevelopmentPlanningStateV2(input.developmentPlanningState)
  const sourceArtifactBytes = Buffer.from(input.sourceArtifactBytes)
  const expectedVerifiedBindings = {
    completeCatalogAuditIdentitySha256:
      intrinsic.sourceAuthorizationSet.completeCatalogAudit.fullAuditIdentitySha256,
    developmentPlanningStateSha256: sha256Canonical(authenticatedDevelopmentPlanningState),
    expectedCatalogBindingSha256: intrinsic.sourceAuthorizationSet.expectedCatalog.bindingSha256,
    migrationSha256: intrinsic.sourceAuthorizationSet.migration.sha256,
    migrationReceiptGateSha256: migrationReceiptGateArtifactSha256(intrinsic.migrationReceiptGate),
    packageReadinessIdentitySha256: intrinsic.productionReadiness?.readinessIdentitySha256 ?? null,
    sourceArtifactSha256: intrinsic.sourceAuthorizationSet.finalArtifactSha256,
    sourceAuthorizationSetSha256: sha256Bytes(
      intrinsic.files.get('source-authorization-set-v4.json')!,
    ),
  }
  if (
    intrinsic.manifestSha256 !== input.manifestSha256 ||
    canonicalJson(intrinsic.compensationTemplate) !== canonicalJson(input.compensationTemplate) ||
    canonicalJson(intrinsic.importPlan) !== canonicalJson(input.importPlan) ||
    canonicalJson(intrinsic.migrationReceiptGate) !== canonicalJson(input.migrationReceiptGate) ||
    canonicalJson(intrinsic.packageDescriptor) !== canonicalJson(input.packageDescriptor) ||
    canonicalJson(intrinsic.productionReadiness) !== canonicalJson(input.productionReadiness) ||
    canonicalJson(intrinsic.sourceAuthorizationSet) !==
      canonicalJson(input.sourceAuthorizationSet) ||
    canonicalJson(expectedVerifiedBindings) !== canonicalJson(input.verifiedBindings) ||
    sha256Bytes(sourceArtifactBytes) !== intrinsic.sourceAuthorizationSet.finalArtifactSha256 ||
    intrinsic.importPlan.sourceArtifactSha256 !==
      intrinsic.sourceAuthorizationSet.finalArtifactSha256 ||
    intrinsic.importPlan.sourceAuthorizationSetSha256 !==
      expectedVerifiedBindings.sourceAuthorizationSetSha256 ||
    expectedVerifiedBindings.developmentPlanningStateSha256 !==
      intrinsic.sourceAuthorizationSet.currentDatabase.developmentPlanningStateSha256
  ) {
    throw new Error('V2 generated package return values differ from its intrinsic file evidence.')
  }
  return Object.freeze({
    compensationTemplate: intrinsic.compensationTemplate,
    developmentPlanningState: authenticatedDevelopmentPlanningState,
    files: intrinsic.files,
    importPlan: intrinsic.importPlan,
    manifestSha256: intrinsic.manifestSha256,
    migrationReceiptGate: intrinsic.migrationReceiptGate,
    packageDescriptor: intrinsic.packageDescriptor,
    productionReadiness: intrinsic.productionReadiness,
    sourceArtifactBytes,
    sourceAuthorizationSet: intrinsic.sourceAuthorizationSet,
    verifiedBindings: canonicalFrozenClone(expectedVerifiedBindings),
  })
}

async function readRegularNonSymlinkFile(path: string, label: string): Promise<Buffer> {
  const absolute = resolve(path)
  const stat = await lstat(absolute)
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular non-symlink file.`)
  }
  return readFile(absolute)
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

const CLI_ARGUMENTS = [
  'amended-authorization',
  'amended-authorization-exact-text',
  'artifact',
  'authorization-manifest',
  'authorization-mapping',
  'authorization-mapping-correction',
  'authorization-mapping-correction-manifest',
  'audit',
  'help',
  'migration',
  'note-disposition-audit',
  'output',
  'output-root',
  'planning-state',
  'preimport-capture-one',
  'preimport-capture-two',
  'protocol-authorization',
] as const

function parseGoldImportCompensationPackageV2CliArguments(argv: string[]) {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, CLI_ARGUMENTS)
  return arguments_
}

/** Pure argument boundary exposed for negative CLI tests. */
export function validateGoldImportCompensationPackageV2CliArguments(argv: string[]): {
  help: boolean
} {
  const arguments_ = parseGoldImportCompensationPackageV2CliArguments(argv)
  return { help: arguments_.flags.has('help') }
}

interface GenerateGoldImportCompensationPackageV2ProductionDependencies {
  collectDatabaseEvidence(): Promise<ProtectedV2DatabaseEvidence>
  inspectRepository(): Promise<GoldImportV2RepositoryEvidence>
  loadFinalizedReceipt(): Promise<GoldImportV2FinalizedReceiptEvidence>
  loadRuntimeBundle(): Promise<GoldImportV2PreimportRuntimeBundle>
  now(): Date
  verifyCapture(directory: string): Promise<GoldImportV2VerifiedPreimportCapture>
}

function productionGeneratorDependencies(): GenerateGoldImportCompensationPackageV2ProductionDependencies {
  if (
    EXECUTING_REPOSITORY_ROOT !== GOLD_IMPORT_V2_PRIMARY_CHECKOUT ||
    EXECUTING_MODULE_PATH !== EXPECTED_PRODUCTION_MODULE_PATH ||
    realpathSync(process.cwd()) !== EXECUTING_REPOSITORY_ROOT ||
    !process.argv[1] ||
    realpathSync(resolve(process.argv[1])) !== EXECUTING_MODULE_PATH
  ) {
    throw new Error(
      'V2 package generator must execute directly from its exact primary-checkout entrypoint.',
    )
  }
  return {
    collectDatabaseEvidence: collectGoldImportV2PreimportFixedLocalState,
    inspectRepository: () =>
      inspectGoldImportV2PrimaryMainRepository({ cwd: EXECUTING_REPOSITORY_ROOT }),
    loadFinalizedReceipt: () => loadGoldImportV2FinalizedReceiptEvidence(),
    loadRuntimeBundle: () =>
      loadGoldImportV2PreimportRuntimeBundle(GOLD_IMPORT_V2_PRIMARY_CHECKOUT),
    now: () => new Date(),
    verifyCapture: (directory) =>
      verifyGoldImportV2PreimportCaptureDirectory({
        backupRoot: GOLD_IMPORT_V2_PACKAGE_CAPTURE_ROOT,
        directory,
      }),
  }
}

/** Private capability-taking orchestration used by the fixed production wrapper. */
async function runGenerateGoldImportCompensationPackageV2WithDependencies(
  argv: string[],
  dependencies: GenerateGoldImportCompensationPackageV2ProductionDependencies,
) {
  const arguments_ = parseGoldImportCompensationPackageV2CliArguments(argv)
  if (arguments_.flags.has('help')) {
    return {
      help: 'Generate a canonical unsigned V2 package only after loading a complete finalized local migration receipt.',
    }
  }
  const captureDirectories = [
    requiredArgument(arguments_, 'preimport-capture-one'),
    requiredArgument(arguments_, 'preimport-capture-two'),
  ] as const
  // Current repository, runtime, receipt, and exact capture bytes precede audit/source reads.
  const repository = await dependencies.inspectRepository()
  const [finalizedReceipt, runtimeBundle, firstCapture, secondCapture] = await Promise.all([
    dependencies.loadFinalizedReceipt(),
    dependencies.loadRuntimeBundle(),
    dependencies.verifyCapture(captureDirectories[0]),
    dependencies.verifyCapture(captureDirectories[1]),
  ])
  const productionReadiness = buildGoldImportV2PackageGenerationReadiness({
    captures: [firstCapture, secondCapture],
    currentFinalizedReceipt: finalizedReceipt,
    currentRepository: repository,
    currentRuntimeBundle: runtimeBundle,
    now: dependencies.now(),
  })
  const currentDatabaseEvidence = await dependencies.collectDatabaseEvidence()
  assertGoldImportV2CurrentDatabaseMatchesPackageReadiness({
    databaseEvidence: currentDatabaseEvidence,
    expected: productionReadiness.packageReadiness,
    receipt: finalizedReceipt,
    repository,
  })
  const [
    verifiedRepository,
    verifiedReceipt,
    verifiedRuntime,
    verifiedFirstCapture,
    verifiedSecondCapture,
  ] = await Promise.all([
    dependencies.inspectRepository(),
    dependencies.loadFinalizedReceipt(),
    dependencies.loadRuntimeBundle(),
    dependencies.verifyCapture(captureDirectories[0]),
    dependencies.verifyCapture(captureDirectories[1]),
  ])
  const verifiedReadiness = buildGoldImportV2PackageGenerationReadiness({
    captures: [verifiedFirstCapture, verifiedSecondCapture],
    currentFinalizedReceipt: verifiedReceipt,
    currentRepository: verifiedRepository,
    currentRuntimeBundle: verifiedRuntime,
    now: dependencies.now(),
  })
  if (canonicalJson(verifiedReadiness) !== canonicalJson(productionReadiness)) {
    throw new Error(
      'V2 package repository, runtime, receipt, or capture evidence changed during fixed-local verification.',
    )
  }
  const auditBytes = await readRegularNonSymlinkFile(
    requiredArgument(arguments_, 'audit'),
    'V2 audit',
  )
  const audit = validateReadyGoldImportCompensationV2Audit(
    JSON.parse(auditBytes.toString('utf8')) as unknown,
  )
  validateGoldImportV2LocalPackageReadinessForAudit(productionReadiness, audit)
  const migrationReceiptGate = buildGoldImportV2LocalMigrationReceiptGateFromReadiness(
    audit,
    productionReadiness,
  )
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
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'amended-authorization'),
      'Amended authorization',
    ),
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'amended-authorization-exact-text'),
      'Exact authorization text',
    ),
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'authorization-manifest'),
      'Authorization manifest',
    ),
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'authorization-mapping'),
      'Authorization mapping',
    ),
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'authorization-mapping-correction'),
      'Authorization mapping correction',
    ),
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'authorization-mapping-correction-manifest'),
      'Mapping correction manifest',
    ),
    readRegularNonSymlinkFile(requiredArgument(arguments_, 'artifact'), 'Finalized artifact'),
    readRegularNonSymlinkFile(requiredArgument(arguments_, 'migration'), 'V2 migration'),
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'note-disposition-audit'),
      'Note disposition audit',
    ),
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'planning-state'),
      'Development planning state',
    ),
    readRegularNonSymlinkFile(
      requiredArgument(arguments_, 'protocol-authorization'),
      'Signed protocol authorization',
    ),
  ])
  const generated = verifyGeneratedGoldImportCompensationPackageV2(
    generateGoldImportCompensationPackageV2Internal({
      audit,
      developmentPlanningState: JSON.parse(planningStateBytes.toString('utf8')) as unknown,
      migrationReceiptGate,
      productionReadiness,
      sources: {
        amendedAuthorizationBytes,
        amendedAuthorizationExactTextBytes,
        authorizationManifestBytes,
        authorizationMappingBytes,
        authorizationMappingCorrectionBytes,
        authorizationMappingCorrectionManifestBytes,
        finalArtifactBytes,
        migrationBytes,
        noteDispositionAudit: JSON.parse(noteDispositionAuditBytes.toString('utf8')) as unknown,
        signedProtocolAuthorizationBytes,
      },
    }),
  )
  // Recollect the slower live database evidence first. Repository, receipt,
  // runtime, and capture bytes are then inspected after that read completes so
  // none of their final snapshots can go stale while the collector is running.
  const finalDatabaseEvidence = await dependencies.collectDatabaseEvidence()
  const [finalRepository, finalReceipt, finalRuntime, finalFirstCapture, finalSecondCapture] =
    await Promise.all([
      dependencies.inspectRepository(),
      dependencies.loadFinalizedReceipt(),
      dependencies.loadRuntimeBundle(),
      dependencies.verifyCapture(captureDirectories[0]),
      dependencies.verifyCapture(captureDirectories[1]),
    ])
  const finalReadiness = buildGoldImportV2PackageGenerationReadiness({
    captures: [finalFirstCapture, finalSecondCapture],
    currentFinalizedReceipt: finalReceipt,
    currentRepository: finalRepository,
    currentRuntimeBundle: finalRuntime,
    now: dependencies.now(),
  })
  if (canonicalJson(finalReadiness) !== canonicalJson(productionReadiness)) {
    throw new Error('V2 package repository, runtime, receipt, or capture evidence changed.')
  }
  assertGoldImportV2CurrentDatabaseMatchesPackageReadiness({
    databaseEvidence: finalDatabaseEvidence,
    expected: finalReadiness.packageReadiness,
    receipt: finalReceipt,
    repository: finalRepository,
  })
  const outputRoot = resolve(requiredArgument(arguments_, 'output-root'))
  const outputDirectory = resolve(requiredArgument(arguments_, 'output'))
  assertSafeOutputPathArgument(outputRoot, 'Output root')
  assertSafeOutputPathArgument(outputDirectory, 'Output directory')
  const output = await createExclusiveOutputDirectory({ outputDirectory, outputRoot })
  writeExclusiveOutputFiles(
    output,
    [...generated.files.entries()].map(([name, bytes]) => ({ bytes, name })),
  )
  return {
    actionCounts: generated.importPlan.counts,
    manifestSha256: generated.manifestSha256,
    migrationReceiptGateSha256: generated.verifiedBindings.migrationReceiptGateSha256,
    outputDirectory,
    packageReadinessIdentitySha256: productionReadiness.readinessIdentitySha256,
    preimportCapturePairIdentitySha256: productionReadiness.capturePair.pairIdentitySha256,
    importAuthorized: false,
    compensationAuthorized: false,
    sourceAuthorizationVersion: 4,
  }
}

/** Production wrapper: no repository, runtime, receipt, capture-root, or target override. */
async function runGenerateGoldImportCompensationPackageV2(argv: string[]) {
  return runGenerateGoldImportCompensationPackageV2WithDependencies(
    argv,
    productionGeneratorDependencies(),
  )
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runGenerateGoldImportCompensationPackageV2(process.argv.slice(2))
    .then((result) => console.log(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
