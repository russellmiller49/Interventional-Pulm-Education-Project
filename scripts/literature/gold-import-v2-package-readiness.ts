import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

import { z } from 'zod'

import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_AMENDED_TWO_ROW_AUTHORIZATION_SHA256_V4,
  GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  GOLD_IMPORT_SIGNED_PROTOCOL_AUTHORIZATION_SHA256_V4,
} from './gold-import-source-authorization-v4'
import {
  GOLD_IMPORT_AMENDED_AUTHORIZATION_EXACT_TEXT_SHA256_V2,
  GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
} from './gold-import-note-disposition-gate-v2'
import {
  GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
} from './gold-import-note-disposition'
import {
  PROTECTED_V2_FINALIZED_RECOVERY_RECEIPT_AUTHORITY_PATH,
  parseCommittedProtectedV2RecoveryReceiptAuthority,
} from './gold-import-compensation-v2-migration-receipt-gate'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH,
  PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
} from './protected-gold-import-contract-v2-receipt-recovery-authority'
import { protectedV2ReceiptRecoverySha256 } from './protected-gold-import-contract-v2-receipt-recovery-amendment'
import { parseImmutableProtectedV2ReceiptRecoveryCommittedAmendment } from './protected-gold-import-contract-v2-receipt-recovery-authority'
import {
  assertProtectedV2FinalizedRecoveryReceiptGate,
  parseProtectedV2ReceiptRecoveryExecutionReceipt,
  parseProtectedV2ReceiptRecoveryResult,
  type ProtectedV2FinalizedRecoveryReceiptAuthority,
} from './protected-gold-import-contract-v2-receipt-recovery-core'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
} from './protected-gold-import-contract-v2-source-identities'
import { LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY } from './literature-gold-v2-schema-only-transition'
import {
  validateProtectedV2DatabaseEvidence,
  collectProtectedV2ReadOnlyTransitionEvidence,
  type ProtectedV2DatabaseEvidence,
} from './protected-gold-import-contract-v2-transition-evidence'
import { collectProtectedV2CompleteCatalogAudit } from './gold-import-contract-v2-catalog-audit'
import {
  collectProtectedV2FixedLocalDockerTargetSnapshot,
  PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS,
  PROTECTED_V2_RECOVERY_DOCKER_COMMAND,
  executeProtectedV2FixedLocalReadOnlyPsql,
} from './protected-gold-import-contract-v2-recovery-evidence-adapter'
import {
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET,
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_SQL,
  buildGoldImportV2FixedLocalTargetObservation,
  fixedLocalTargetIdentityFromObservation,
  goldImportV2FixedLocalTargetIdentitySchema,
  validateGoldImportV2FixedLocalTargetIdentity,
  validateGoldImportV2FixedLocalTargetObservation,
  type GoldImportV2FixedLocalTargetObservation,
  type GoldImportV2RawDatabaseTargetObservation,
} from './gold-import-v2-fixed-local-target'

export const GOLD_IMPORT_V2_PACKAGE_READINESS_SCHEMA_VERSION =
  'literature-gold-v2-package-readiness/1.1.0' as const
export const GOLD_IMPORT_V2_REPOSITORY_EVIDENCE_SCHEMA_VERSION =
  'literature-gold-v2-primary-main-repository-evidence/1.0.0' as const
export const GOLD_IMPORT_V2_FINALIZED_RECEIPT_EVIDENCE_SCHEMA_VERSION =
  'literature-gold-v2-finalized-migration-receipt-evidence/1.0.0' as const

export const GOLD_IMPORT_V2_PRIMARY_CHECKOUT =
  '/Users/russellmiller/Projects/Interventional-Pulm-Education-Project' as const
export const GOLD_IMPORT_V2_FINALIZED_RECEIPT_OUTPUT_DIRECTORY =
  `${GOLD_IMPORT_V2_PRIMARY_CHECKOUT}/local-data/literature/protected-v2-application-receipts/real-local-v2-99ad5991-20260811T040330Z` as const
export const GOLD_IMPORT_V2_FINALIZED_RECEIPT_DIRECTORY =
  `${GOLD_IMPORT_V2_FINALIZED_RECEIPT_OUTPUT_DIRECTORY}/finalized` as const
export const GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256 =
  '555fd036a09fcf908049f2bb55ede63645079a91165e8a1f69c3ea13a0e6cb28' as const
export const GOLD_IMPORT_V2_FINALIZED_RECEIPT_RESULT_SHA256 =
  'b088666e9b038d96f24f4111a29e4e4914477bfa414e7a218c4f43895ce246cc' as const
export const GOLD_IMPORT_V2_FINALIZED_RECEIPT_EXECUTION_SHA256 =
  '67076e8efe04debdd55815aaa05e6a2e7b626009c7e421a39e164a705e79820c' as const
export const GOLD_IMPORT_V2_FINALIZED_RECEIPT_MANIFEST_SHA256 =
  '65891a09d61493e03405a3ca9c2b7608eebd2a337f6c03260438bc0b42d59060' as const
export const GOLD_IMPORT_V2_EXPECTED_CATALOG_BINDING_SHA256 =
  'cd2295c1c69fbefa5920c82c429f0ce10bcc6ac6d0b4714c479f108bf7b2f900' as const
export const GOLD_IMPORT_V2_COMPLETE_LOCAL_CATALOG_AUDIT_SHA256 =
  'd0a5d56bcc88b1cf7fa642d25d16c75031dc4a14b349229959389b0dbf0c5783' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u
const ABSOLUTE_PATH_PATTERN = /^\//u
const sha256Schema = z.string().regex(SHA256_PATTERN)
const commitSchema = z.string().regex(COMMIT_PATTERN)
const absolutePathSchema = z.string().regex(ABSOLUTE_PATH_PATTERN)
const uuidSchema = z.string().uuid()
const execFileAsync = promisify(execFile)

export const GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES = Object.freeze({
  developmentMembershipSha256:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.developmentMembershipSha256,
  effectiveStateSha256V1:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.effectiveStateSha256V1,
  effectiveStateSha256V2:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.effectiveStateSha256V2,
  eventStateSha256: LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.eventStateSha256,
  physicalStateSha256V1:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.physicalStateSha256V1,
  physicalStateSha256V2:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.physicalStateSha256V2,
  planningStateSha256: LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.planningStateSha256,
  pointerStateSha256: LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.pointerStateSha256,
  revealStateSha256: LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.revealStateSha256,
  reviewStateSha256: LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.reviewStateSha256,
  schemaNeutralHistorySha256:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.schemaNeutralHistorySha256,
} as const)

export const GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES = Object.freeze({
  amendedAuthorizationExactTextSha256: GOLD_IMPORT_AMENDED_AUTHORIZATION_EXACT_TEXT_SHA256_V2,
  amendedTwoRowAuthorizationSha256: GOLD_IMPORT_AMENDED_TWO_ROW_AUTHORIZATION_SHA256_V4,
  authorizationManifestSha256: GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
  authorizationMappingCorrectionManifestSha256:
    GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
  authorizationMappingCorrectionSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
  authorizationMappingSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
  finalV3ArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  noteDispositionAuditSha256: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
  signedProtocolAuthorizationSha256: GOLD_IMPORT_SIGNED_PROTOCOL_AUTHORIZATION_SHA256_V4,
} as const)

export const goldImportV2RepositoryEvidenceSchema = z
  .object({
    branch: z.literal('main'),
    cleanNonIgnoredUntracked: z.literal(true),
    cleanTracked: z.literal(true),
    gitCommonDirectory: absolutePathSchema,
    gitDirectory: absolutePathSchema,
    headSha: commitSchema,
    originMainSha: commitSchema,
    primaryCheckout: z.literal(true),
    repositoryRoot: z.literal(GOLD_IMPORT_V2_PRIMARY_CHECKOUT),
    schemaVersion: z.literal(GOLD_IMPORT_V2_REPOSITORY_EVIDENCE_SCHEMA_VERSION),
  })
  .strict()

export type GoldImportV2RepositoryEvidence = z.infer<typeof goldImportV2RepositoryEvidenceSchema>

export function validateGoldImportV2RepositoryEvidence(
  input: unknown,
): GoldImportV2RepositoryEvidence {
  const repository = goldImportV2RepositoryEvidenceSchema.parse(input)
  if (
    repository.headSha !== repository.originMainSha ||
    repository.gitDirectory !== repository.gitCommonDirectory
  ) {
    throw new Error('Package readiness requires clean primary main at exact origin/main.')
  }
  return Object.freeze({ ...repository })
}

export type GoldImportV2GitCommandRunner = (
  arguments_: readonly string[],
  cwd: string,
) => Promise<string>

const defaultGitCommandRunner: GoldImportV2GitCommandRunner = async (arguments_, cwd) => {
  const result = await execFileAsync('git', [...arguments_], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })
  return result.stdout.trim()
}

export async function inspectGoldImportV2PrimaryMainRepository(
  input: {
    cwd?: string
    runGit?: GoldImportV2GitCommandRunner
  } = {},
): Promise<GoldImportV2RepositoryEvidence> {
  const cwd = await realpath(resolve(input.cwd ?? process.cwd()))
  if (cwd !== GOLD_IMPORT_V2_PRIMARY_CHECKOUT) {
    throw new Error('Package readiness capture requires the exact primary checkout.')
  }
  const runGit = input.runGit ?? defaultGitCommandRunner
  const [repositoryRoot, branch, headSha, originMainSha, gitDirectory, gitCommonDirectory, status] =
    await Promise.all([
      runGit(['rev-parse', '--show-toplevel'], cwd),
      runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd),
      runGit(['rev-parse', 'HEAD'], cwd),
      runGit(['rev-parse', 'refs/remotes/origin/main'], cwd),
      runGit(['rev-parse', '--path-format=absolute', '--git-dir'], cwd),
      runGit(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd),
      runGit(['status', '--porcelain=v1', '--untracked-files=all'], cwd),
    ])
  if (repositoryRoot !== cwd || branch !== 'main' || status !== '') {
    throw new Error('Package readiness capture requires clean primary main.')
  }
  return validateGoldImportV2RepositoryEvidence({
    branch,
    cleanNonIgnoredUntracked: true,
    cleanTracked: true,
    gitCommonDirectory,
    gitDirectory,
    headSha,
    originMainSha,
    primaryCheckout: true,
    repositoryRoot,
    schemaVersion: GOLD_IMPORT_V2_REPOSITORY_EVIDENCE_SCHEMA_VERSION,
  })
}

const migrationIdentitySchema = z
  .object({
    filename: z.string().min(1),
    migrationName: z.string().min(1),
    occurrence: z.literal(1),
    sha256: sha256Schema,
    version: z.string().regex(/^[0-9]{14}$/u),
  })
  .strict()

const finalizedReceiptSchema = z
  .object({
    amendmentIdentitySha256: sha256Schema,
    authorityIdentitySha256: z.literal(GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256),
    complete: z.literal(true),
    compensationAuthorized: z.literal(false),
    executionReceiptSha256: z.literal(GOLD_IMPORT_V2_FINALIZED_RECEIPT_EXECUTION_SHA256),
    finalManifestSha256: z.literal(GOLD_IMPORT_V2_FINALIZED_RECEIPT_MANIFEST_SHA256),
    finalizedDirectory: z.literal(GOLD_IMPORT_V2_FINALIZED_RECEIPT_DIRECTORY),
    finalizedLatestMtimeMs: z.number().int().positive(),
    importAuthorized: z.literal(false),
    migrationApplicationCallCount: z.literal(0),
    migrationReexecuted: z.literal(false),
    migrationStagingCallCount: z.literal(0),
    originalIntentSha256: sha256Schema,
    outputDirectory: z.literal(GOLD_IMPORT_V2_FINALIZED_RECEIPT_OUTPUT_DIRECTORY),
    receiptReconciled: z.literal(true),
    recoveryToolBundleSha256: sha256Schema,
    resultSha256: z.literal(GOLD_IMPORT_V2_FINALIZED_RECEIPT_RESULT_SHA256),
    schemaVersion: z.literal(GOLD_IMPORT_V2_FINALIZED_RECEIPT_EVIDENCE_SCHEMA_VERSION),
  })
  .strict()

export type GoldImportV2FinalizedReceiptEvidence = z.infer<typeof finalizedReceiptSchema>

const stateIdentitiesSchema = z
  .object({
    completeLocalProfileCatalogAuditSha256: z.literal(
      GOLD_IMPORT_V2_COMPLETE_LOCAL_CATALOG_AUDIT_SHA256,
    ),
    developmentMembershipSha256: z.literal(
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.developmentMembershipSha256,
    ),
    effectiveStateSha256V1: z.literal(
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.effectiveStateSha256V1,
    ),
    effectiveStateSha256V2: z.literal(
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.effectiveStateSha256V2,
    ),
    eventStateSha256: z.literal(GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.eventStateSha256),
    physicalStateSha256V1: z.literal(
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.physicalStateSha256V1,
    ),
    physicalStateSha256V2: z.literal(
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.physicalStateSha256V2,
    ),
    planningStateSha256: z.literal(GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.planningStateSha256),
    pointerStateSha256: z.literal(GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.pointerStateSha256),
    revealStateSha256: z.literal(GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.revealStateSha256),
    reviewStateSha256: z.literal(GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.reviewStateSha256),
    schemaNeutralHistorySha256: z.literal(
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.schemaNeutralHistorySha256,
    ),
  })
  .strict()

export const goldImportV2PackageReadinessStateSchema = z
  .object({
    authorities: z
      .object({
        expectedCatalogBindingSha256: z.literal(GOLD_IMPORT_V2_EXPECTED_CATALOG_BINDING_SHA256),
        packageSources: z
          .object({
            amendedAuthorizationExactTextSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.amendedAuthorizationExactTextSha256,
            ),
            amendedTwoRowAuthorizationSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.amendedTwoRowAuthorizationSha256,
            ),
            authorizationManifestSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.authorizationManifestSha256,
            ),
            authorizationMappingCorrectionManifestSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.authorizationMappingCorrectionManifestSha256,
            ),
            authorizationMappingCorrectionSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.authorizationMappingCorrectionSha256,
            ),
            authorizationMappingSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.authorizationMappingSha256,
            ),
            finalV3ArtifactSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.finalV3ArtifactSha256,
            ),
            noteDispositionAuditSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.noteDispositionAuditSha256,
            ),
            signedProtocolAuthorizationSha256: z.literal(
              GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES.signedProtocolAuthorizationSha256,
            ),
          })
          .strict(),
      })
      .strict(),
    batch: z
      .object({
        id: uuidSchema,
        name: z.literal('gold-set-v1'),
        scope: z.literal('development'),
      })
      .strict(),
    database: z
      .object({
        expectedConfiguration: z
          .object({
            database: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.database),
            profile: z.literal(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.expectedProfile),
            profileDirectlyObserved: z.literal(false),
          })
          .strict(),
        observedTarget: goldImportV2FixedLocalTargetIdentitySchema,
      })
      .strict(),
    migrationLedger: z
      .object({
        v1: migrationIdentitySchema.extend({
          filename: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V1.filename),
          migrationName: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName),
          sha256: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256),
          version: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V1.version),
        }),
        v2: migrationIdentitySchema.extend({
          filename: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename),
          migrationName: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName),
          sha256: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256),
          version: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V2.version),
        }),
        verifier: z
          .object({
            filename: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.filename),
            sha256: z.literal(PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256),
          })
          .strict(),
      })
      .strict(),
    mutationAssertions: z
      .object({
        actionMutationCount: z.literal(0),
        eventMutationCount: z.literal(0),
        noteMutationCount: z.literal(0),
        pointerMutationCount: z.literal(0),
        protectedStateMutationCount: z.literal(0),
        revealMutationCount: z.literal(0),
        reviewMutationCount: z.literal(0),
        sourceAuthorizationMutationCount: z.literal(0),
        statusMutationCount: z.literal(0),
      })
      .strict(),
    operationCounts: z
      .object({
        actionCount: z.literal(0),
        compensationCount: z.literal(0),
        importCount: z.literal(0),
        operationCount: z.literal(0),
      })
      .strict(),
    receipt: finalizedReceiptSchema,
    safety: z
      .object({
        compensationAuthorized: z.literal(false),
        databaseMutationCount: z.literal(0),
        heldOutIdentitiesAccessed: z.literal(false),
        importAuthorized: z.literal(false),
        originalMigrationCapturesChanged: z.literal(false),
        originalMigrationIntentChanged: z.literal(false),
        remoteDatabaseAccessed: z.literal(false),
        repeatableRead: z.literal(true),
        sourceAuthorizationsChanged: z.literal(false),
        transactionReadOnly: z.literal(true),
        writeCapableDatabaseClientConstructed: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal(GOLD_IMPORT_V2_PACKAGE_READINESS_SCHEMA_VERSION),
    stateIdentities: stateIdentitiesSchema,
  })
  .strict()

export type GoldImportV2PackageReadinessState = z.infer<
  typeof goldImportV2PackageReadinessStateSchema
>

export function packageReadinessCanonicalContent(
  input: GoldImportV2PackageReadinessState,
): GoldImportV2PackageReadinessState {
  return JSON.parse(canonicalJson(input)) as GoldImportV2PackageReadinessState
}

export function validateGoldImportV2PackageReadinessState(
  input: unknown,
): GoldImportV2PackageReadinessState {
  const state = goldImportV2PackageReadinessStateSchema.parse(input)
  const observedTarget = validateGoldImportV2FixedLocalTargetIdentity(state.database.observedTarget)
  if (state.receipt.finalizedLatestMtimeMs <= 0) {
    throw new Error('Finalized migration receipt observation time is invalid.')
  }
  return Object.freeze(
    packageReadinessCanonicalContent({
      ...state,
      database: { ...state.database, observedTarget },
    }),
  )
}

export function buildGoldImportV2PackageReadinessState(input: {
  fixedLocalState: GoldImportV2FixedLocalState
  receipt: GoldImportV2FinalizedReceiptEvidence
  repository?: GoldImportV2RepositoryEvidence
}): GoldImportV2PackageReadinessState {
  const fixedLocalState = validateGoldImportV2FixedLocalState(input.fixedLocalState)
  const databaseEvidence = fixedLocalState.databaseEvidence
  const receipt = finalizedReceiptSchema.parse(input.receipt)
  const catalog = databaseEvidence.completeCatalogAudit
  if (input.repository) validateGoldImportV2RepositoryEvidence(input.repository)
  if (
    databaseEvidence.batchId !== LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.batchId ||
    databaseEvidence.v1Occurrence !== 1 ||
    databaseEvidence.v2Occurrence !== 1 ||
    databaseEvidence.operationCount !== 0 ||
    databaseEvidence.actionCount !== 0 ||
    databaseEvidence.importCount !== 0 ||
    databaseEvidence.compensationCount !== 0 ||
    databaseEvidence.developmentMembershipSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.developmentMembershipSha256 ||
    databaseEvidence.effectiveStateSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.effectiveStateSha256V1 ||
    databaseEvidence.effectiveStateSha256V2 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.effectiveStateSha256V2 ||
    databaseEvidence.physicalStateSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.physicalStateSha256V1 ||
    databaseEvidence.physicalStateSha256V2 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.physicalStateSha256V2 ||
    databaseEvidence.developmentPlanningStateSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.planningStateSha256 ||
    databaseEvidence.eventStateSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.eventStateSha256 ||
    databaseEvidence.pointerStateSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.pointerStateSha256 ||
    databaseEvidence.revealStateSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.revealStateSha256 ||
    databaseEvidence.reviewStateSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.reviewStateSha256 ||
    databaseEvidence.history.schemaNeutralHistorySha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.schemaNeutralHistorySha256 ||
    catalog?.fullAuditIdentitySha256 !== GOLD_IMPORT_V2_COMPLETE_LOCAL_CATALOG_AUDIT_SHA256
  ) {
    throw new Error(
      'Current fixed-local database is not the exact accepted post-V2 pre-import state.',
    )
  }
  return validateGoldImportV2PackageReadinessState({
    authorities: {
      expectedCatalogBindingSha256: GOLD_IMPORT_V2_EXPECTED_CATALOG_BINDING_SHA256,
      packageSources: GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES,
    },
    batch: {
      id: databaseEvidence.batchId,
      name: 'gold-set-v1',
      scope: 'development',
    },
    database: {
      expectedConfiguration: {
        database: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.database,
        profile: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.expectedProfile,
        profileDirectlyObserved: false,
      },
      observedTarget: fixedLocalTargetIdentityFromObservation(fixedLocalState.targetObservation),
    },
    migrationLedger: {
      v1: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V1, occurrence: 1 },
      v2: {
        filename: PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
        migrationName: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
        occurrence: 1,
        sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
      },
      verifier: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
    },
    mutationAssertions: {
      actionMutationCount: 0,
      eventMutationCount: 0,
      noteMutationCount: 0,
      pointerMutationCount: 0,
      protectedStateMutationCount: 0,
      revealMutationCount: 0,
      reviewMutationCount: 0,
      sourceAuthorizationMutationCount: 0,
      statusMutationCount: 0,
    },
    operationCounts: {
      actionCount: 0,
      compensationCount: 0,
      importCount: 0,
      operationCount: 0,
    },
    receipt,
    safety: {
      compensationAuthorized: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      originalMigrationCapturesChanged: false,
      originalMigrationIntentChanged: false,
      remoteDatabaseAccessed: false,
      repeatableRead: true,
      sourceAuthorizationsChanged: false,
      transactionReadOnly: true,
      writeCapableDatabaseClientConstructed: false,
    },
    schemaVersion: GOLD_IMPORT_V2_PACKAGE_READINESS_SCHEMA_VERSION,
    stateIdentities: {
      completeLocalProfileCatalogAuditSha256: GOLD_IMPORT_V2_COMPLETE_LOCAL_CATALOG_AUDIT_SHA256,
      ...GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES,
    },
  })
}

function parseSingleFixedLocalPsqlJson(stdout: string): unknown {
  const candidates = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') || line.startsWith('['))
  if (candidates.length !== 1) {
    throw new Error('Post-V2 pre-import fixed-local query JSON was absent or duplicated.')
  }
  try {
    return JSON.parse(candidates[0]!) as unknown
  } catch {
    throw new Error('Post-V2 pre-import fixed-local query returned invalid JSON.')
  }
}

export interface GoldImportV2FixedLocalState {
  databaseEvidence: ProtectedV2DatabaseEvidence
  targetObservation: GoldImportV2FixedLocalTargetObservation
}

export function validateGoldImportV2FixedLocalState(
  input: GoldImportV2FixedLocalState,
): GoldImportV2FixedLocalState {
  return Object.freeze({
    databaseEvidence: validateProtectedV2DatabaseEvidence(input.databaseEvidence, 'after_v2'),
    targetObservation: validateGoldImportV2FixedLocalTargetObservation(input.targetObservation),
  })
}

/**
 * Capability-free fixed-target collector. The module owns every Docker/psql
 * target argument; no URL, target fact, or write-capable database client is accepted.
 */
export async function collectGoldImportV2PreimportFixedLocalState(): Promise<GoldImportV2FixedLocalState> {
  const psql = async (sql: string) =>
    executeProtectedV2FixedLocalReadOnlyPsql({
      arguments: PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS,
      command: PROTECTED_V2_RECOVERY_DOCKER_COMMAND,
      sql,
    })
  const queryJson = async (sql: string) => parseSingleFixedLocalPsqlJson((await psql(sql)).stdout)
  const observationStartedAt = new Date().toISOString()
  const dockerBefore = await collectProtectedV2FixedLocalDockerTargetSnapshot()
  const rawDatabaseTarget = (await queryJson(
    GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_SQL,
  )) as GoldImportV2RawDatabaseTargetObservation
  const databaseEvidence = await collectProtectedV2ReadOnlyTransitionEvidence({
    dependencies: {
      collectCompleteCatalogAudit: () =>
        collectProtectedV2CompleteCatalogAudit({
          context: { psql, queryJson },
          profile: 'local',
        }),
      queryJson,
    },
    phase: 'after_v2',
  })
  const dockerAfter = await collectProtectedV2FixedLocalDockerTargetSnapshot()
  const observationCompletedAt = new Date().toISOString()
  return validateGoldImportV2FixedLocalState({
    databaseEvidence,
    targetObservation: buildGoldImportV2FixedLocalTargetObservation({
      database: rawDatabaseTarget,
      dockerAfter,
      dockerBefore,
      observationCompletedAt,
      observationStartedAt,
    }),
  })
}

export function assertGoldImportV2CurrentDatabaseMatchesPackageReadiness(input: {
  fixedLocalState: GoldImportV2FixedLocalState
  expected: GoldImportV2PackageReadinessState
  receipt: GoldImportV2FinalizedReceiptEvidence
  repository: GoldImportV2RepositoryEvidence
}): GoldImportV2PackageReadinessState {
  const expected = validateGoldImportV2PackageReadinessState(input.expected)
  const current = buildGoldImportV2PackageReadinessState({
    fixedLocalState: input.fixedLocalState,
    receipt: input.receipt,
    repository: input.repository,
  })
  if (canonicalJson(current) !== canonicalJson(expected)) {
    throw new Error('Current fixed-local database differs from captured package readiness.')
  }
  return current
}

export function packageReadinessStateIdentitySha256(
  input: GoldImportV2PackageReadinessState,
): string {
  return sha256Canonical(validateGoldImportV2PackageReadinessState(input))
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`))
}

async function assertCanonicalRegularFile(
  path: string,
  root: string,
  label: string,
): Promise<void> {
  if (!isWithin(root, path)) throw new Error(`${label} escaped its reviewed root.`)
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
    throw new Error(`${label} must be a canonical regular file.`)
  }
}

export function validateGoldImportV2FinalizedReceiptEvidence(input: {
  amendmentBytes: string
  authorityBytes: string
  executionReceiptBytes: string
  finalManifestBytes: string
  finalizedDirectory: string
  finalizedLatestMtimeMs: number
  incidentAuthorityBytes: string
  markdownBytes: string
  outputDirectory: string
  resultBytes: string
}): GoldImportV2FinalizedReceiptEvidence {
  const committed = parseCommittedProtectedV2RecoveryReceiptAuthority(input.authorityBytes)
  if (
    committed.authorityIdentitySha256 !== GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256
  ) {
    throw new Error('Finalized migration-receipt authority identity drifted.')
  }
  const amendment = parseImmutableProtectedV2ReceiptRecoveryCommittedAmendment({
    amendmentBytes: input.amendmentBytes,
    authorityBytes: input.incidentAuthorityBytes,
  })
  const authority: ProtectedV2FinalizedRecoveryReceiptAuthority = {
    ...committed.authority,
    amendment,
  }
  if (
    authority.amendmentIdentitySha256 !== amendment.amendmentIdentitySha256 ||
    authority.originalIntentSha256 !== amendment.historicalIncident.intentSha256 ||
    authority.recoveryToolBundleSha256 !== amendment.correctedRecoveryToolBundle.aggregateSha256
  ) {
    throw new Error(
      'Finalized receipt authority does not match the immutable historical amendment.',
    )
  }

  const resultSha256 = protectedV2ReceiptRecoverySha256(input.resultBytes)
  const markdownSha256 = protectedV2ReceiptRecoverySha256(input.markdownBytes)
  const finalManifestSha256 = protectedV2ReceiptRecoverySha256(input.finalManifestBytes)
  const executionReceiptSha256 = protectedV2ReceiptRecoverySha256(input.executionReceiptBytes)
  if (
    resultSha256 !== GOLD_IMPORT_V2_FINALIZED_RECEIPT_RESULT_SHA256 ||
    executionReceiptSha256 !== GOLD_IMPORT_V2_FINALIZED_RECEIPT_EXECUTION_SHA256 ||
    finalManifestSha256 !== GOLD_IMPORT_V2_FINALIZED_RECEIPT_MANIFEST_SHA256 ||
    input.finalManifestBytes !==
      `${resultSha256}  application-result.json\n${markdownSha256}  application-result.md\n`
  ) {
    throw new Error('Finalized migration-receipt bytes or checksum manifest drifted.')
  }
  const result = parseProtectedV2ReceiptRecoveryResult(input.resultBytes)
  const execution = parseProtectedV2ReceiptRecoveryExecutionReceipt(input.executionReceiptBytes)
  assertProtectedV2FinalizedRecoveryReceiptGate(result, authority)
  if (
    execution.resultSha256 !== resultSha256 ||
    execution.canonicalManifestSha256 !== finalManifestSha256 ||
    execution.outputDirectory !== input.outputDirectory ||
    execution.recoveryAmendmentIdentitySha256 !== amendment.amendmentIdentitySha256 ||
    execution.currentRecoveryToolBundleSha256 !== authority.recoveryToolBundleSha256 ||
    execution.originalIntentSha256 !== authority.originalIntentSha256 ||
    result.originalIntent.outputDirectory !== input.outputDirectory ||
    input.outputDirectory !== GOLD_IMPORT_V2_FINALIZED_RECEIPT_OUTPUT_DIRECTORY ||
    input.finalizedDirectory !== GOLD_IMPORT_V2_FINALIZED_RECEIPT_DIRECTORY ||
    result.migration.v1Occurrence !== 1 ||
    result.migration.v2Occurrence !== 1 ||
    result.migration.v1MigrationSha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256 ||
    result.migration.v2MigrationSha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256 ||
    result.migration.v2VerifierSha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256 ||
    result.stateIdentities.post.developmentMembershipSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.developmentMembershipSha256 ||
    result.stateIdentities.post.effectiveV1Sha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.effectiveStateSha256V1 ||
    result.stateIdentities.post.effectiveV2Sha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.effectiveStateSha256V2 ||
    result.stateIdentities.post.physicalV1Sha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.physicalStateSha256V1 ||
    result.stateIdentities.post.physicalV2Sha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.physicalStateSha256V2 ||
    result.stateIdentities.post.planningSha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.planningStateSha256 ||
    result.stateIdentities.post.schemaNeutralHistorySha256 !==
      GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES.schemaNeutralHistorySha256 ||
    result.expectedCatalog.bindingSha256 !== GOLD_IMPORT_V2_EXPECTED_CATALOG_BINDING_SHA256 ||
    result.expectedCatalog.fullAuditIdentitySha256 !==
      GOLD_IMPORT_V2_COMPLETE_LOCAL_CATALOG_AUDIT_SHA256 ||
    result.receiptReconciled !== true ||
    result.migration.migrationReexecuted !== false ||
    result.migration.migrationStagingCallCount !== 0 ||
    result.migration.migrationApplicationCallCount !== 0 ||
    result.mutationEvidence.operationMutationCount !== 0 ||
    result.mutationEvidence.actionMutationCount !== 0 ||
    result.mutationEvidence.importMutationCount !== 0 ||
    result.mutationEvidence.compensationMutationCount !== 0 ||
    result.safety.heldOutIdentitiesAccessed !== false ||
    result.safety.remoteDatabaseAccessed !== false ||
    execution.receiptReconciled !== true ||
    execution.migrationReexecuted !== false ||
    execution.migrationStagingCallCount !== 0 ||
    execution.migrationApplicationCallCount !== 0 ||
    execution.importAuthorized !== false ||
    execution.compensationAuthorized !== false
  ) {
    throw new Error(
      'Finalized migration receipt is incomplete, stale, or authorizes a later operation.',
    )
  }
  return finalizedReceiptSchema.parse({
    amendmentIdentitySha256: amendment.amendmentIdentitySha256,
    authorityIdentitySha256: committed.authorityIdentitySha256,
    complete: true,
    compensationAuthorized: false,
    executionReceiptSha256,
    finalManifestSha256,
    finalizedDirectory: input.finalizedDirectory,
    finalizedLatestMtimeMs: input.finalizedLatestMtimeMs,
    importAuthorized: false,
    migrationApplicationCallCount: 0,
    migrationReexecuted: false,
    migrationStagingCallCount: 0,
    originalIntentSha256: amendment.historicalIncident.intentSha256,
    outputDirectory: input.outputDirectory,
    receiptReconciled: true,
    recoveryToolBundleSha256: amendment.correctedRecoveryToolBundle.aggregateSha256,
    resultSha256,
    schemaVersion: GOLD_IMPORT_V2_FINALIZED_RECEIPT_EVIDENCE_SCHEMA_VERSION,
  })
}

export async function loadGoldImportV2FinalizedReceiptEvidence(
  input: {
    outputDirectory?: string
    repositoryRoot?: string
  } = {},
): Promise<GoldImportV2FinalizedReceiptEvidence> {
  const repositoryRoot = await realpath(
    resolve(input.repositoryRoot ?? GOLD_IMPORT_V2_PRIMARY_CHECKOUT),
  )
  if (repositoryRoot !== GOLD_IMPORT_V2_PRIMARY_CHECKOUT) {
    throw new Error('Finalized receipt evidence may be loaded only from the primary checkout.')
  }
  const outputDirectory = await realpath(
    resolve(input.outputDirectory ?? GOLD_IMPORT_V2_FINALIZED_RECEIPT_OUTPUT_DIRECTORY),
  )
  const finalizedDirectory = await realpath(resolve(outputDirectory, 'finalized'))
  if (
    outputDirectory !== GOLD_IMPORT_V2_FINALIZED_RECEIPT_OUTPUT_DIRECTORY ||
    finalizedDirectory !== GOLD_IMPORT_V2_FINALIZED_RECEIPT_DIRECTORY ||
    dirname(finalizedDirectory) !== outputDirectory
  ) {
    throw new Error(
      'Finalized migration receipt path differs from the reviewed real-local receipt.',
    )
  }
  const finalizedStat = await lstat(finalizedDirectory)
  if (!finalizedStat.isDirectory() || finalizedStat.isSymbolicLink()) {
    throw new Error('Finalized migration receipt directory is unsafe.')
  }
  const finalNames = (await readdir(finalizedDirectory)).sort()
  const expectedFinalNames = [
    'application-result.json',
    'application-result.md',
    'checksum-manifest.sha256',
    'execution-receipt.json',
  ].sort()
  if (canonicalJson(finalNames) !== canonicalJson(expectedFinalNames)) {
    throw new Error('Finalized migration receipt inventory is partial or contradictory.')
  }
  const filePaths = Object.fromEntries(
    expectedFinalNames.map((name) => [name, resolve(finalizedDirectory, name)]),
  ) as Record<(typeof expectedFinalNames)[number], string>
  for (const [name, path] of Object.entries(filePaths)) {
    await assertCanonicalRegularFile(path, finalizedDirectory, `Finalized receipt ${name}`)
  }
  const authorityPath = resolve(
    repositoryRoot,
    PROTECTED_V2_FINALIZED_RECOVERY_RECEIPT_AUTHORITY_PATH,
  )
  const amendmentPath = resolve(
    repositoryRoot,
    PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH,
  )
  const incidentAuthorityPath = resolve(
    repositoryRoot,
    PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
  )
  await Promise.all([
    assertCanonicalRegularFile(authorityPath, repositoryRoot, 'Finalized receipt authority'),
    assertCanonicalRegularFile(amendmentPath, repositoryRoot, 'Historical recovery amendment'),
    assertCanonicalRegularFile(
      incidentAuthorityPath,
      repositoryRoot,
      'Historical incident authority',
    ),
  ])
  const latestMtimeMs = Math.max(
    ...(await Promise.all(
      Object.values(filePaths).map(async (path) => (await lstat(path)).mtimeMs),
    )),
  )
  const [
    amendmentBytes,
    authorityBytes,
    executionReceiptBytes,
    finalManifestBytes,
    incidentAuthorityBytes,
    markdownBytes,
    resultBytes,
  ] = await Promise.all([
    readFile(amendmentPath, 'utf8'),
    readFile(authorityPath, 'utf8'),
    readFile(filePaths['execution-receipt.json'], 'utf8'),
    readFile(filePaths['checksum-manifest.sha256'], 'utf8'),
    readFile(incidentAuthorityPath, 'utf8'),
    readFile(filePaths['application-result.md'], 'utf8'),
    readFile(filePaths['application-result.json'], 'utf8'),
  ])
  return validateGoldImportV2FinalizedReceiptEvidence({
    amendmentBytes,
    authorityBytes,
    executionReceiptBytes,
    finalManifestBytes,
    finalizedDirectory,
    finalizedLatestMtimeMs: Math.ceil(latestMtimeMs),
    incidentAuthorityBytes,
    markdownBytes,
    outputDirectory,
    resultBytes,
  })
}

export function sha256Bytes(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}
