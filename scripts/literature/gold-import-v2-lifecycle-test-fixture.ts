import { createHash } from 'node:crypto'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET,
  buildGoldImportV2FixedLocalTargetObservation,
  fixedLocalTargetIdentityFromObservation,
  type GoldImportV2FixedLocalTargetObservation,
} from './gold-import-v2-fixed-local-target'
import {
  buildGoldImportV2DatabasePublicationBracket,
  buildGoldImportV2DatabasePublicationObservationBinding,
  type GoldImportV2DatabasePublicationBracket,
} from './gold-import-v2-database-publication'
import {
  GOLD_IMPORT_V2_ACCEPTED_STATE_IDENTITIES,
  GOLD_IMPORT_V2_COMPLETE_LOCAL_CATALOG_AUDIT_SHA256,
  GOLD_IMPORT_V2_EXPECTED_CATALOG_BINDING_SHA256,
  GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256,
  GOLD_IMPORT_V2_FINALIZED_RECEIPT_DIRECTORY,
  GOLD_IMPORT_V2_FINALIZED_RECEIPT_EXECUTION_SHA256,
  GOLD_IMPORT_V2_FINALIZED_RECEIPT_MANIFEST_SHA256,
  GOLD_IMPORT_V2_FINALIZED_RECEIPT_OUTPUT_DIRECTORY,
  GOLD_IMPORT_V2_FINALIZED_RECEIPT_RESULT_SHA256,
  GOLD_IMPORT_V2_PACKAGE_READINESS_SCHEMA_VERSION,
  GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES,
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  GOLD_IMPORT_V2_REPOSITORY_EVIDENCE_SCHEMA_VERSION,
  type GoldImportV2PackageReadinessState,
  type GoldImportV2RepositoryEvidence,
} from './gold-import-v2-package-readiness'
import {
  buildGoldImportV2PreimportCapture,
  buildGoldImportV2PreimportCapturePair,
  buildGoldImportV2PreimportExecutionReceipt,
  buildGoldImportV2PreimportRuntimeBundle,
  type GoldImportV2PreimportCapturePair,
  type GoldImportV2PreimportRuntimeBundle,
  type GoldImportV2VerifiedPreimportCapture,
} from './gold-import-v2-preimport-capture'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
} from './protected-gold-import-contract-v2-source-identities'

export const TEST_GOLD_IMPORT_V2_CONTAINER_ID =
  '906d62f9e2b5ac7c58742090566e87f8d2a36199ee897b09bb5c1b7727e286a8'
export const TEST_GOLD_IMPORT_V2_CONTAINER_STARTED_AT = '2026-08-11T04:00:00.000Z'
export const TEST_GOLD_IMPORT_V2_HEAD = '1234567890abcdef1234567890abcdef12345678'

function addMilliseconds(timestamp: string, milliseconds: number): string {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString()
}

function dockerContext() {
  return {
    Endpoints: {
      docker: { Host: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerEndpoint, SkipTLSVerify: false },
    },
    Name: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerContext,
  }
}

function containerInspect(input: {
  containerId: string
  imageId: string
  project: string
  startedAt: string
}) {
  return {
    Config: {
      Hostname: input.containerId.slice(0, 12),
      Image: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.imageReference,
      Labels: {
        'com.docker.compose.project': input.project,
        'com.supabase.cli.project': input.project,
      },
    },
    HostConfig: {
      NetworkMode: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.network,
      PortBindings: { '5432/tcp': [{ HostIp: '', HostPort: '55322' }] },
    },
    Id: input.containerId,
    Image: input.imageId,
    ImageManifestDescriptor: { digest: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.imageManifestDigest },
    Name: `/${GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.containerName}`,
    NetworkSettings: {
      Networks: { [GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.network]: {} },
      Ports: {
        '5432/tcp': [
          { HostIp: '0.0.0.0', HostPort: '55322' },
          { HostIp: '::', HostPort: '55322' },
        ],
      },
    },
    RestartCount: 0,
    State: { Health: { Status: 'healthy' }, Running: true, StartedAt: input.startedAt },
  }
}

export function buildTestGoldImportV2FixedLocalTargetObservation(
  input: {
    containerId?: string
    imageId?: string
    observationStartedAt?: string
    project?: string
  } = {},
): GoldImportV2FixedLocalTargetObservation {
  return buildGoldImportV2FixedLocalTargetObservation(
    buildTestGoldImportV2RawTargetObservation(input),
  )
}

export function buildTestGoldImportV2RawTargetObservation(
  input: {
    containerId?: string
    imageId?: string
    observationStartedAt?: string
    project?: string
  } = {},
) {
  const observationStartedAt = input.observationStartedAt ?? '2026-08-11T04:59:50.000Z'
  const containerId = input.containerId ?? TEST_GOLD_IMPORT_V2_CONTAINER_ID
  const inspect = containerInspect({
    containerId,
    imageId: input.imageId ?? GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.imageId,
    project: input.project ?? GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.project,
    startedAt: TEST_GOLD_IMPORT_V2_CONTAINER_STARTED_AT,
  })
  return {
    database: {
      clientAddress: null,
      configuredPort: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.internalPort,
      currentUser: 'postgres',
      database: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.database,
      isolationLevel: 'repeatable read',
      observedAt: addMilliseconds(observationStartedAt, 1_500),
      postmasterStartedAt: addMilliseconds(TEST_GOLD_IMPORT_V2_CONTAINER_STARTED_AT, 100),
      serverAddress: null,
      serverPort: null,
      sessionUser: 'postgres',
      socketDirectories: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.socketDirectory,
      transactionReadOnly: true,
    },
    dockerAfter: {
      containerInspect: inspect,
      contextInspect: dockerContext(),
      hostnameStdout: containerId.slice(0, 12),
      inspectedAt: addMilliseconds(observationStartedAt, 2_000),
    },
    dockerBefore: {
      containerInspect: inspect,
      contextInspect: dockerContext(),
      hostnameStdout: containerId.slice(0, 12),
      inspectedAt: addMilliseconds(observationStartedAt, 1_000),
    },
    observationCompletedAt: addMilliseconds(observationStartedAt, 3_000),
    observationStartedAt,
  }
}

export function buildTestGoldImportV2PublicationBracket(input: {
  initialTarget: GoldImportV2FixedLocalTargetObservation
  packageReadiness: GoldImportV2PackageReadinessState
  stagedPayloadSha256: string
  subject: 'capture' | 'package_readiness' | 'production_rehearsal'
}): GoldImportV2DatabasePublicationBracket {
  const stagedAt = addMilliseconds(input.initialTarget.observationCompletedAt, 1_000)
  const finalTarget = buildTestGoldImportV2FixedLocalTargetObservation({
    observationStartedAt: addMilliseconds(stagedAt, 1_000),
  })
  return buildGoldImportV2DatabasePublicationBracket({
    final: buildGoldImportV2DatabasePublicationObservationBinding({
      packageReadiness: input.packageReadiness,
      targetObservation: finalTarget,
    }),
    initial: buildGoldImportV2DatabasePublicationObservationBinding({
      packageReadiness: input.packageReadiness,
      targetObservation: input.initialTarget,
    }),
    publicationAuthorizedAt: addMilliseconds(finalTarget.observationCompletedAt, 1_000),
    stagedAt,
    stagedPayloadSha256: input.stagedPayloadSha256,
    subject: input.subject,
  })
}

export function buildTestGoldImportV2RepositoryEvidence(
  head = TEST_GOLD_IMPORT_V2_HEAD,
): GoldImportV2RepositoryEvidence {
  return {
    branch: 'main',
    cleanNonIgnoredUntracked: true,
    cleanTracked: true,
    gitCommonDirectory: `${GOLD_IMPORT_V2_PRIMARY_CHECKOUT}/.git`,
    gitDirectory: `${GOLD_IMPORT_V2_PRIMARY_CHECKOUT}/.git`,
    headSha: head,
    originMainSha: head,
    primaryCheckout: true,
    repositoryRoot: GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
    schemaVersion: GOLD_IMPORT_V2_REPOSITORY_EVIDENCE_SCHEMA_VERSION,
  }
}

export function buildTestGoldImportV2PackageReadinessState(
  targetObservation = buildTestGoldImportV2FixedLocalTargetObservation(),
): GoldImportV2PackageReadinessState {
  return {
    authorities: {
      expectedCatalogBindingSha256: GOLD_IMPORT_V2_EXPECTED_CATALOG_BINDING_SHA256,
      packageSources: { ...GOLD_IMPORT_V2_PACKAGE_SOURCE_AUTHORITIES },
    },
    batch: {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'gold-set-v1',
      scope: 'development',
    },
    database: {
      expectedConfiguration: {
        database: 'postgres',
        profile: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.expectedProfile,
        profileDirectlyObserved: false,
      },
      observedTarget: fixedLocalTargetIdentityFromObservation(targetObservation),
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
      verifier: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER },
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
    receipt: {
      amendmentIdentitySha256: 'a'.repeat(64),
      authorityIdentitySha256: GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256,
      complete: true,
      compensationAuthorized: false,
      executionReceiptSha256: GOLD_IMPORT_V2_FINALIZED_RECEIPT_EXECUTION_SHA256,
      finalManifestSha256: GOLD_IMPORT_V2_FINALIZED_RECEIPT_MANIFEST_SHA256,
      finalizedDirectory: GOLD_IMPORT_V2_FINALIZED_RECEIPT_DIRECTORY,
      finalizedLatestMtimeMs: Date.parse('2026-08-11T04:30:00.000Z'),
      importAuthorized: false,
      migrationApplicationCallCount: 0,
      migrationReexecuted: false,
      migrationStagingCallCount: 0,
      originalIntentSha256: 'b'.repeat(64),
      outputDirectory: GOLD_IMPORT_V2_FINALIZED_RECEIPT_OUTPUT_DIRECTORY,
      receiptReconciled: true,
      recoveryToolBundleSha256: 'c'.repeat(64),
      resultSha256: GOLD_IMPORT_V2_FINALIZED_RECEIPT_RESULT_SHA256,
      schemaVersion: 'literature-gold-v2-finalized-migration-receipt-evidence/1.0.0',
    },
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
  }
}

export function buildTestGoldImportV2RuntimeBundle(
  suffix = 'current',
): GoldImportV2PreimportRuntimeBundle {
  return buildGoldImportV2PreimportRuntimeBundle([
    { bytes: `capture runtime ${suffix}`, path: 'scripts/literature/capture.ts' },
    { bytes: `package ${suffix}`, path: 'package.json' },
  ])
}

export function buildTestGoldImportV2VerifiedCapture(input: {
  captureId: string
  capturedAt?: string
  executionNonce: string
  observationStartedAt: string
  outputDirectory: string
  packageReadiness?: GoldImportV2PackageReadinessState
  repository?: GoldImportV2RepositoryEvidence
  runtimeBundle?: GoldImportV2PreimportRuntimeBundle
}): GoldImportV2VerifiedPreimportCapture {
  const targetObservation = buildTestGoldImportV2FixedLocalTargetObservation({
    observationStartedAt: input.observationStartedAt,
  })
  const packageReadiness =
    input.packageReadiness ?? buildTestGoldImportV2PackageReadinessState(targetObservation)
  const capture = buildGoldImportV2PreimportCapture({
    captureId: input.captureId,
    captureRuntimeBundle: input.runtimeBundle ?? buildTestGoldImportV2RuntimeBundle(),
    capturedAt: input.capturedAt ?? '2026-08-11T05:00:00.000Z',
    executionNonce: input.executionNonce,
    outputDirectory: input.outputDirectory,
    packageReadiness,
    repository: input.repository ?? buildTestGoldImportV2RepositoryEvidence(),
    targetObservation,
  })
  const publicationBracket = buildTestGoldImportV2PublicationBracket({
    initialTarget: targetObservation,
    packageReadiness,
    stagedPayloadSha256: 'e'.repeat(64),
    subject: 'capture',
  })
  const publicationBracketFileSha256 = createHash('sha256')
    .update(canonicalJson(publicationBracket))
    .digest('hex')
  const executionReceipt = buildGoldImportV2PreimportExecutionReceipt({
    canonicalManifestSha256: 'd'.repeat(64),
    capture,
    captureFileSha256: 'e'.repeat(64),
    publicationBracket,
    publicationBracketFileSha256,
  })
  return {
    capture,
    directoryRealpath: input.outputDirectory,
    executionReceipt,
    executionReceiptSha256: createHash('sha256')
      .update(canonicalJson(executionReceipt))
      .digest('hex'),
    publicationBracket,
    publicationBracketFileSha256,
  }
}

export function buildTestGoldImportV2CapturePair(): {
  captures: readonly [GoldImportV2VerifiedPreimportCapture, GoldImportV2VerifiedPreimportCapture]
  pair: GoldImportV2PreimportCapturePair
  repository: GoldImportV2RepositoryEvidence
  runtimeBundle: GoldImportV2PreimportRuntimeBundle
} {
  const repository = buildTestGoldImportV2RepositoryEvidence()
  const runtimeBundle = buildTestGoldImportV2RuntimeBundle()
  const readiness = buildTestGoldImportV2PackageReadinessState()
  const captures = [
    buildTestGoldImportV2VerifiedCapture({
      captureId: '10000000-0000-4000-8000-000000000001',
      executionNonce: '1'.repeat(64),
      observationStartedAt: '2026-08-11T04:59:50.000Z',
      outputDirectory: '/backup/capture-one',
      packageReadiness: readiness,
      repository,
      runtimeBundle,
    }),
    buildTestGoldImportV2VerifiedCapture({
      captureId: '20000000-0000-4000-8000-000000000002',
      executionNonce: '2'.repeat(64),
      observationStartedAt: '2026-08-11T04:59:51.000Z',
      outputDirectory: '/backup/capture-two',
      packageReadiness: readiness,
      repository,
      runtimeBundle,
    }),
  ] as const
  return {
    captures,
    pair: buildGoldImportV2PreimportCapturePair({
      captures,
      currentRepository: repository,
      currentRuntimeBundle: runtimeBundle,
      now: new Date('2026-08-11T05:30:00.000Z'),
    }),
    repository,
    runtimeBundle,
  }
}
