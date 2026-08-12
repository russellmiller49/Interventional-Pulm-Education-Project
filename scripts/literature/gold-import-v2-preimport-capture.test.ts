/** @jest-environment node */

import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
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
  validateGoldImportV2PackageReadinessState,
  validateGoldImportV2RepositoryEvidence,
  type GoldImportV2PackageReadinessState,
  type GoldImportV2RepositoryEvidence,
} from './gold-import-v2-package-readiness'
import {
  GOLD_IMPORT_V2_PREIMPORT_CAPTURE_FRESHNESS_MS,
  GOLD_IMPORT_V2_PREIMPORT_CAPTURE_SCHEMA_VERSION,
  GOLD_IMPORT_V2_PREIMPORT_CAPTURE_TRUST_MODEL,
  GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_DIRECTORY,
  buildGoldImportV2PreimportCapture,
  buildGoldImportV2PreimportCapturePair,
  buildGoldImportV2PreimportDuplicateMarker,
  buildGoldImportV2PreimportExecutionReceipt,
  buildGoldImportV2PreimportRuntimeBundle,
  validateGoldImportV2PreimportCapture,
  validateGoldImportV2PreimportCapturePair,
  verifyGoldImportV2PreimportCaptureDirectory,
  type GoldImportV2PreimportCapture,
  type GoldImportV2PreimportRuntimeBundle,
  type GoldImportV2VerifiedPreimportCapture,
} from './gold-import-v2-preimport-capture'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
} from './protected-gold-import-contract-v2-source-identities'

const HEAD = '1234567890abcdef1234567890abcdef12345678'
const CAPTURED_AT = '2026-08-11T05:00:00.000Z'
const NOW = new Date('2026-08-11T05:30:00.000Z')

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function repository(head = HEAD): GoldImportV2RepositoryEvidence {
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

function readiness(): GoldImportV2PackageReadinessState {
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
      container: 'supabase_db_ip-literature-local',
      database: 'postgres',
      host: '127.0.0.1',
      port: 55322,
      profile: 'local_supabase_postgres_owner_v1',
      project: 'ip-literature-local',
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

function runtime(suffix = 'current'): GoldImportV2PreimportRuntimeBundle {
  return buildGoldImportV2PreimportRuntimeBundle([
    { bytes: `capture runtime ${suffix}`, path: 'scripts/literature/capture.ts' },
    { bytes: `package ${suffix}`, path: 'package.json' },
  ])
}

function capture(input: {
  id: string
  nonce: string
  outputDirectory: string
  packageReadiness?: GoldImportV2PackageReadinessState
  repository?: GoldImportV2RepositoryEvidence
  runtimeBundle?: GoldImportV2PreimportRuntimeBundle
  capturedAt?: string
}): GoldImportV2PreimportCapture {
  return buildGoldImportV2PreimportCapture({
    captureId: input.id,
    captureRuntimeBundle: input.runtimeBundle ?? runtime(),
    capturedAt: input.capturedAt ?? CAPTURED_AT,
    executionNonce: input.nonce,
    outputDirectory: input.outputDirectory,
    packageReadiness: input.packageReadiness ?? readiness(),
    repository: input.repository ?? repository(),
  })
}

function verifiedCapture(input: {
  id: string
  nonce: string
  outputDirectory: string
  packageReadiness?: GoldImportV2PackageReadinessState
  repository?: GoldImportV2RepositoryEvidence
  runtimeBundle?: GoldImportV2PreimportRuntimeBundle
  capturedAt?: string
}): GoldImportV2VerifiedPreimportCapture {
  const built = capture(input)
  const executionReceipt = buildGoldImportV2PreimportExecutionReceipt({
    canonicalManifestSha256: 'd'.repeat(64),
    capture: built,
    captureFileSha256: 'e'.repeat(64),
  })
  return {
    capture: built,
    directoryRealpath: built.outputDirectory,
    executionReceipt,
    executionReceiptSha256: sha(canonicalJson(executionReceipt)),
  }
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function pair(
  first = verifiedCapture({
    id: '10000000-0000-4000-8000-000000000001',
    nonce: '1'.repeat(64),
    outputDirectory: '/backup/capture-one',
  }),
  second = verifiedCapture({
    id: '20000000-0000-4000-8000-000000000002',
    nonce: '2'.repeat(64),
    outputDirectory: '/backup/capture-two',
  }),
) {
  return buildGoldImportV2PreimportCapturePair({
    captures: [first, second],
    currentRepository: repository(),
    currentRuntimeBundle: runtime(),
    now: NOW,
  })
}

describe('post-V2 pre-import capture contract', () => {
  it('requires exact V1/V2 ledger identities, finalized receipt, and zero-operation safety', () => {
    expect(validateGoldImportV2PackageReadinessState(readiness())).toMatchObject({
      migrationLedger: {
        v1: { occurrence: 1, sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256 },
        v2: { occurrence: 1, sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256 },
      },
      operationCounts: {
        actionCount: 0,
        compensationCount: 0,
        importCount: 0,
        operationCount: 0,
      },
      receipt: {
        complete: true,
        importAuthorized: false,
        receiptReconciled: true,
      },
    })

    const absent = clone(readiness()) as unknown as Record<string, unknown>
    ;(absent.migrationLedger as Record<string, unknown>).v2 = {
      ...(readiness().migrationLedger.v2 as object),
      occurrence: 0,
    }
    expect(() => validateGoldImportV2PackageReadinessState(absent)).toThrow()

    const duplicated = clone(readiness()) as unknown as Record<string, unknown>
    ;(
      (duplicated.migrationLedger as Record<string, unknown>).v2 as Record<string, unknown>
    ).occurrence = 2
    expect(() => validateGoldImportV2PackageReadinessState(duplicated)).toThrow()

    const wrongPair = clone(readiness()) as unknown as Record<string, unknown>
    ;(
      (wrongPair.migrationLedger as Record<string, unknown>).v2 as Record<string, unknown>
    ).migrationName = PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName
    expect(() => validateGoldImportV2PackageReadinessState(wrongPair)).toThrow()
  })

  it('fails closed for incomplete or wrong receipt and protected/local-target drift', () => {
    for (const mutate of [
      (state: Record<string, unknown>) =>
        delete (state.receipt as Record<string, unknown>).complete,
      (state: Record<string, unknown>) =>
        ((state.receipt as Record<string, unknown>).authorityIdentitySha256 = 'f'.repeat(64)),
      (state: Record<string, unknown>) =>
        ((state.database as Record<string, unknown>).host = '192.0.2.10'),
      (state: Record<string, unknown>) =>
        ((state.database as Record<string, unknown>).profile = 'remote'),
      (state: Record<string, unknown>) =>
        ((state.operationCounts as Record<string, unknown>).importCount = 1),
      (state: Record<string, unknown>) =>
        ((state.mutationAssertions as Record<string, unknown>).reviewMutationCount = 1),
      (state: Record<string, unknown>) =>
        ((state.safety as Record<string, unknown>).heldOutIdentitiesAccessed = true),
      (state: Record<string, unknown>) =>
        ((state.safety as Record<string, unknown>).remoteDatabaseAccessed = true),
    ]) {
      const changed = clone(readiness()) as unknown as Record<string, unknown>
      mutate(changed)
      expect(() => validateGoldImportV2PackageReadinessState(changed)).toThrow()
    }
  })

  it('binds deterministic canonical database content to distinct execution identities', () => {
    const first = capture({
      id: '10000000-0000-4000-8000-000000000001',
      nonce: '1'.repeat(64),
      outputDirectory: '/backup/capture-one',
    })
    const second = capture({
      id: '20000000-0000-4000-8000-000000000002',
      nonce: '2'.repeat(64),
      outputDirectory: '/backup/capture-two',
    })
    expect(first.schemaVersion).toBe(GOLD_IMPORT_V2_PREIMPORT_CAPTURE_SCHEMA_VERSION)
    expect(first.canonicalDatabaseState).toEqual(second.canonicalDatabaseState)
    expect(first.canonicalDatabaseStateSha256).toBe(second.canonicalDatabaseStateSha256)
    expect(first.captureIdentitySha256).not.toBe(second.captureIdentitySha256)
    expect(first.safetyBoundary).toEqual({
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      packageExecutionAuthorized: false,
      remoteDatabaseAccessed: false,
      writeCapableDatabaseClientConstructed: false,
    })
    expect(validateGoldImportV2PreimportCapture(clone(first))).toEqual(first)
  })

  it('rejects a capture taken before receipt finalization', () => {
    expect(() =>
      capture({
        capturedAt: '2026-08-11T04:00:00.000Z',
        id: '10000000-0000-4000-8000-000000000001',
        nonce: '1'.repeat(64),
        outputDirectory: '/backup/capture-one',
      }),
    ).toThrow('predates finalized migration receipt')
  })

  it('accepts exactly two fresh, agreeing, separately executed trusted-operator captures', () => {
    const built = pair()
    expect(built.trustModel).toBe(GOLD_IMPORT_V2_PREIMPORT_CAPTURE_TRUST_MODEL)
    expect(built.captures).toHaveLength(2)
    expect(built.captures[0].captureId).not.toBe(built.captures[1].captureId)
    expect(built.captures[0].executionNonce).not.toBe(built.captures[1].executionNonce)
    expect(validateGoldImportV2PreimportCapturePair(clone(built))).toEqual(built)

    const repeated = buildGoldImportV2PreimportCapturePair({
      captures: [
        verifiedCapture({
          id: '10000000-0000-4000-8000-000000000001',
          nonce: '1'.repeat(64),
          outputDirectory: '/backup/capture-one',
        }),
        verifiedCapture({
          id: '20000000-0000-4000-8000-000000000002',
          nonce: '2'.repeat(64),
          outputDirectory: '/backup/capture-two',
        }),
      ],
      currentRepository: repository(),
      currentRuntimeBundle: runtime(),
      now: new Date('2026-08-11T05:45:00.000Z'),
    })
    expect(repeated).toEqual(built)
  })

  it('rejects one capture, a repeated capture, and a realpath alias', () => {
    const first = verifiedCapture({
      id: '10000000-0000-4000-8000-000000000001',
      nonce: '1'.repeat(64),
      outputDirectory: '/backup/capture-one',
    })
    expect(() =>
      buildGoldImportV2PreimportCapturePair({
        captures: [first],
        currentRepository: repository(),
        currentRuntimeBundle: runtime(),
        now: NOW,
      }),
    ).toThrow('exactly two')
    expect(() => pair(first, first)).toThrow('distinct')

    const second = verifiedCapture({
      id: '20000000-0000-4000-8000-000000000002',
      nonce: '2'.repeat(64),
      outputDirectory: '/backup/capture-two',
    })
    expect(() => pair(first, { ...second, directoryRealpath: first.directoryRealpath })).toThrow(
      'distinct',
    )
  })

  it('accepts exact capture bytes but rejects filesystem symlink aliases and copied captures', async () => {
    const root = await realpath(await mkdtemp(resolve(tmpdir(), 'gold-v2-preimport-capture-')))
    try {
      const directory = resolve(root, 'capture-one')
      await mkdir(directory)
      const built = capture({
        id: '10000000-0000-4000-8000-000000000001',
        nonce: '1'.repeat(64),
        outputDirectory: directory,
      })
      const captureBytes = canonicalJson(built)
      const captureFileSha256 = sha(captureBytes)
      const manifestBytes = `${captureFileSha256}  preimport-state.json\n`
      const executionReceipt = buildGoldImportV2PreimportExecutionReceipt({
        canonicalManifestSha256: sha(manifestBytes),
        capture: built,
        captureFileSha256,
      })
      const executionBytes = canonicalJson(executionReceipt)
      const markerDirectory = resolve(root, GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_DIRECTORY)
      await mkdir(markerDirectory)
      const marker = buildGoldImportV2PreimportDuplicateMarker({
        capture: built,
        executionReceiptSha256: sha(executionBytes),
      })
      await Promise.all([
        writeFile(resolve(directory, 'preimport-state.json'), captureBytes),
        writeFile(resolve(directory, 'checksum-manifest.sha256'), manifestBytes),
        writeFile(resolve(directory, 'execution-receipt.json'), executionBytes),
        writeFile(resolve(markerDirectory, `${built.captureId}.json`), canonicalJson(marker)),
      ])
      await expect(
        verifyGoldImportV2PreimportCaptureDirectory({ backupRoot: root, directory }),
      ).resolves.toMatchObject({ directoryRealpath: directory })

      const alias = resolve(root, 'capture-alias')
      await symlink(directory, alias)
      await expect(
        verifyGoldImportV2PreimportCaptureDirectory({ backupRoot: root, directory: alias }),
      ).rejects.toThrow('aliases and symlinks')

      const copied = resolve(root, 'capture-copy')
      await cp(directory, copied, { recursive: true })
      await expect(
        verifyGoldImportV2PreimportCaptureDirectory({ backupRoot: root, directory: copied }),
      ).rejects.toThrow('exact realpath')
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('rejects state disagreement, stale HEAD, stale runtime, and stale captures', () => {
    const changedState = readiness()
    changedState.batch.id = '30000000-0000-4000-8000-000000000003'
    const disagreeing = verifiedCapture({
      id: '20000000-0000-4000-8000-000000000002',
      nonce: '2'.repeat(64),
      outputDirectory: '/backup/capture-two',
      packageReadiness: changedState,
    })
    expect(() => pair(undefined, disagreeing)).toThrow('disagree')

    const staleHead = verifiedCapture({
      id: '20000000-0000-4000-8000-000000000002',
      nonce: '2'.repeat(64),
      outputDirectory: '/backup/capture-two',
      repository: repository('abcdef1234567890abcdef1234567890abcdef12'),
    })
    expect(() => pair(undefined, staleHead)).toThrow('stale')

    const staleRuntime = verifiedCapture({
      id: '20000000-0000-4000-8000-000000000002',
      nonce: '2'.repeat(64),
      outputDirectory: '/backup/capture-two',
      runtimeBundle: runtime('old'),
    })
    expect(() => pair(undefined, staleRuntime)).toThrow('stale')

    const oldTimestamp = new Date(
      NOW.getTime() - GOLD_IMPORT_V2_PREIMPORT_CAPTURE_FRESHNESS_MS - 1,
    ).toISOString()
    const staleReadiness = readiness()
    staleReadiness.receipt.finalizedLatestMtimeMs = Date.parse('2026-08-11T02:00:00.000Z')
    const firstStaleCapture = verifiedCapture({
      capturedAt: oldTimestamp,
      id: '10000000-0000-4000-8000-000000000001',
      nonce: '1'.repeat(64),
      outputDirectory: '/backup/capture-one',
      packageReadiness: staleReadiness,
    })
    const secondStaleCapture = verifiedCapture({
      capturedAt: oldTimestamp,
      id: '20000000-0000-4000-8000-000000000002',
      nonce: '2'.repeat(64),
      outputDirectory: '/backup/capture-two',
      packageReadiness: staleReadiness,
    })
    expect(() => pair(firstStaleCapture, secondStaleCapture)).toThrow('stale')
  })

  it('requires clean primary main exactly at origin/main', () => {
    expect(validateGoldImportV2RepositoryEvidence(repository())).toEqual(repository())
    for (const update of [
      { branch: 'codex/feature' },
      { branch: 'HEAD' },
      { cleanTracked: false },
      { cleanNonIgnoredUntracked: false },
      { originMainSha: 'f'.repeat(40) },
      { primaryCheckout: false },
    ]) {
      expect(() => validateGoldImportV2RepositoryEvidence({ ...repository(), ...update })).toThrow()
    }
  })
})
