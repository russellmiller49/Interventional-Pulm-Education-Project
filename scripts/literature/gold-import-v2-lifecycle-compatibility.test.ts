/** @jest-environment node */

import {
  GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION,
  GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY,
  GOLD_IMPORT_V2_CURRENT_REHEARSAL_SCHEMA_VERSION,
  GOLD_IMPORT_V2_HISTORICAL_PR95_BACKUP_SCHEMA_VERSION,
  GOLD_IMPORT_V2_HISTORICAL_PR95_REHEARSAL_SCHEMA_VERSION,
  validateGoldImportV2CurrentLifecycleCompatibility,
  validateGoldImportV2ExactPackageRehearsalReport21,
  validateHistoricalPr95BackupCompatibility,
} from './gold-import-v2-lifecycle-compatibility'
import {
  buildTestGoldImportV2CapturePair,
  buildTestGoldImportV2PackageReadinessState,
} from './gold-import-v2-lifecycle-test-fixture'
import { validateGoldImportV2PackageReadinessState } from './gold-import-v2-package-readiness'
import { buildGoldImportV2PackageGenerationReadiness } from './generate-gold-import-compensation-package-v2'
import {
  buildProtectedV2ExpectedCatalogBinding,
  buildProtectedV2RuntimeBundleBinding,
  type ProtectedV2RuntimeBundleBinding,
} from './protected-gold-import-contract-v2-bindings'
import { buildProtectedV2OperatorBundle } from './protected-gold-import-contract-v2-recovery-bundle'

let runtimeBundleBinding: ProtectedV2RuntimeBundleBinding

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function rehearsal21(input: { withReadiness?: boolean } = {}) {
  const withReadiness = input.withReadiness ?? true
  return {
    audit: {
      completeCatalogAuditIdentitySha256: '1'.repeat(64),
      completeCatalogAuditModelIdentitySha256: '2'.repeat(64),
      environmentInvariantIdentitySha256: '3'.repeat(64),
      environmentProfileIdentitySha256: '4'.repeat(64),
      sha256: '5'.repeat(64),
      source: 'first_v1_seeded_upgrade_disposable_context',
    },
    backup: {
      manifestSha256: '6'.repeat(64),
      v1StateAuthenticatedBeforeSourceRead: true,
    },
    catalogDriftMatrix: {
      localOwnerProjectionIdentitySha256: '7'.repeat(64),
      probeCount: 3,
      rejectedCount: 3,
      sha256: '8'.repeat(64),
    },
    contractVersion: 'gold-review-import-compensation/2.0.0',
    expectedCatalog: buildProtectedV2ExpectedCatalogBinding(
      'supabase_admin_owner_v1',
      'disposable',
    ),
    migration: {
      id: '20260809231651_add_literature_gold_import_compensation_contract_v2',
      sha256: 'a'.repeat(64),
    },
    package: {
      actionCounts: { initial: 1, inserts: 1, noops: 0, revisions: 0, total: 1 },
      completeCatalogAuditIdentitySha256: 'b'.repeat(64),
      directory: 'exact-package-v2',
      expectedCatalogBindingSha256: 'c'.repeat(64),
      importPlanSha256: 'd'.repeat(64),
      manifestSha256: 'e'.repeat(64),
      sourceArtifactSha256: 'f'.repeat(64),
      sourceAuthorizationSetSha256: '0'.repeat(64),
    },
    ...(withReadiness
      ? {
          postV2PreImportReadiness: {
            capturePairIdentitySha256: '1'.repeat(64),
            compensationAuthorized: false,
            importAuthorized: false,
            packageReadinessIdentitySha256: '2'.repeat(64),
          },
        }
      : {}),
    protectedRuntimeBundle: runtimeBundleBinding,
    rehearsals: {
      bootstrap: {
        evidenceMatchesRepeatedUpgrade: true,
        migrationPath: 'upgrade',
        packageGeneratedInContext: true,
      },
      fresh: {
        canonicalEvidenceSha256: '4'.repeat(64),
        completeRuns: 2,
        deterministic: true,
        postV2ProjectedSeedMatchedUpgrade: true,
      },
      upgrade: {
        canonicalEvidenceSha256: '5'.repeat(64),
        completeRuns: 2,
        deterministic: true,
        preV1SeedLoadedAtHistoricalBoundary: true,
        schemaOnlyV1StateBracketed: true,
      },
    },
    repository: {
      branch: 'codex/ip-literature-post-v2-preimport-capture-v1',
      cleanTrackedAndUntrackedWorktree: true,
      headSha: '6'.repeat(40),
      originMainIsAncestor: true,
    },
    safety: {
      allFourContainersRemovedAndVerifiedAbsent: true,
      callerDatabaseTargetAccepted: false,
      heldOutIdentitiesAccessed: false,
      realLocalDatabaseMutated: false,
      realLocalReadOnlyVerified: withReadiness,
      remoteDatabaseTouched: false,
      sourceReadOnlyAfterV2BootstrapProbe: true,
    },
    schemaVersion: GOLD_IMPORT_V2_CURRENT_REHEARSAL_SCHEMA_VERSION,
    status: 'passed',
  }
}

describe('post-V2 lifecycle compatibility matrix', () => {
  beforeAll(async () => {
    const bundle = await buildProtectedV2OperatorBundle({ cwd: process.cwd() })
    runtimeBundleBinding = buildProtectedV2RuntimeBundleBinding(bundle)
  })

  it('accepts the exact reviewed rehearsal 2.1 shape', () => {
    expect(validateGoldImportV2ExactPackageRehearsalReport21(rehearsal21())).toMatchObject({
      schemaVersion: 'gold-import-compensation-exact-package-rehearsal/2.1.0',
      safety: { realLocalDatabaseMutated: false, realLocalReadOnlyVerified: true },
    })
    expect(
      validateGoldImportV2ExactPackageRehearsalReport21(rehearsal21({ withReadiness: false })),
    ).toMatchObject({ safety: { realLocalReadOnlyVerified: false } })
  })

  it('accepts the exact current package-readiness artifact', () => {
    expect(
      validateGoldImportV2PackageReadinessState(buildTestGoldImportV2PackageReadinessState()),
    ).toMatchObject({
      database: { expectedConfiguration: { profileDirectlyObserved: false } },
      operationCounts: { actionCount: 0, compensationCount: 0, importCount: 0, operationCount: 0 },
    })
  })

  it('makes capture, pair, readiness, rehearsal, generation, and backup consumers agree', () => {
    const lifecycle = buildTestGoldImportV2CapturePair()
    const generationReadiness = buildGoldImportV2PackageGenerationReadiness({
      captures: lifecycle.captures,
      currentFinalizedReceipt: lifecycle.captures[0].capture.packageReadiness.receipt,
      currentRepository: lifecycle.repository,
      currentRuntimeBundle: lifecycle.runtimeBundle,
      now: new Date('2026-08-11T05:30:00.000Z'),
    })
    const rehearsal = rehearsal21()
    rehearsal.postV2PreImportReadiness!.capturePairIdentitySha256 =
      lifecycle.pair.pairIdentitySha256
    rehearsal.postV2PreImportReadiness!.packageReadinessIdentitySha256 =
      generationReadiness.readinessIdentitySha256
    expect(
      validateGoldImportV2CurrentLifecycleCompatibility({
        backupSchemaVersion: GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION,
        capture: lifecycle.captures[0].capture,
        capturePair: lifecycle.pair,
        packageGenerationReadiness: generationReadiness,
        packageReadiness: lifecycle.captures[0].capture.packageReadiness,
        rehearsal,
      }),
    ).toEqual(GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY)
  })

  it('does not let disposable-only 2.1 evidence satisfy the current production lifecycle', () => {
    const lifecycle = buildTestGoldImportV2CapturePair()
    const generationReadiness = buildGoldImportV2PackageGenerationReadiness({
      captures: lifecycle.captures,
      currentFinalizedReceipt: lifecycle.captures[0].capture.packageReadiness.receipt,
      currentRepository: lifecycle.repository,
      currentRuntimeBundle: lifecycle.runtimeBundle,
      now: new Date('2026-08-11T05:30:00.000Z'),
    })
    expect(() =>
      validateGoldImportV2CurrentLifecycleCompatibility({
        backupSchemaVersion: GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION,
        capture: lifecycle.captures[0].capture,
        capturePair: lifecycle.pair,
        packageGenerationReadiness: generationReadiness,
        packageReadiness: lifecycle.captures[0].capture.packageReadiness,
        rehearsal: rehearsal21({ withReadiness: false }),
      }),
    ).toThrow('lacks its exact production readiness binding')
  })

  it('keeps PR #95 verification valid only through the explicit historical tuple', () => {
    expect(
      validateHistoricalPr95BackupCompatibility({
        backupSchemaVersion: GOLD_IMPORT_V2_HISTORICAL_PR95_BACKUP_SCHEMA_VERSION,
        rehearsalSchemaVersion: GOLD_IMPORT_V2_HISTORICAL_PR95_REHEARSAL_SCHEMA_VERSION,
      }),
    ).toEqual({
      backup: 'gold-import-contract-v2-forward-repair-backup/2.0.0',
      rehearsal: 'gold-import-compensation-exact-package-rehearsal/2.0.0',
    })
    expect(() =>
      validateHistoricalPr95BackupCompatibility({
        backupSchemaVersion: GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION,
        rehearsalSchemaVersion: GOLD_IMPORT_V2_CURRENT_REHEARSAL_SCHEMA_VERSION,
      }),
    ).toThrow('Historical PR #95')
  })

  it.each([
    ['obsolete 2.0', 'gold-import-compensation-exact-package-rehearsal/2.0.0'],
    ['arbitrary 2.x', 'gold-import-compensation-exact-package-rehearsal/2.9.0'],
    ['future version', 'gold-import-compensation-exact-package-rehearsal/3.0.0'],
    ['missing version', undefined],
  ])('rejects %s rehearsal evidence', (_label, schemaVersion) => {
    const value = clone(rehearsal21()) as Record<string, unknown>
    if (schemaVersion === undefined) delete value.schemaVersion
    else value.schemaVersion = schemaVersion
    expect(() => validateGoldImportV2ExactPackageRehearsalReport21(value)).toThrow()
  })

  it('rejects relabeled old evidence, changed fields, and unknown fields under 2.1', () => {
    const relabeled = clone(rehearsal21()) as Record<string, unknown>
    const relabeledSafety = relabeled.safety as Record<string, unknown>
    delete relabeledSafety.realLocalDatabaseMutated
    delete relabeledSafety.realLocalReadOnlyVerified
    relabeledSafety.realLocalDatabaseTouched = false
    expect(() => validateGoldImportV2ExactPackageRehearsalReport21(relabeled)).toThrow()

    const changed = clone(rehearsal21()) as Record<string, unknown>
    ;(changed.safety as Record<string, unknown>).realLocalDatabaseMutated = true
    expect(() => validateGoldImportV2ExactPackageRehearsalReport21(changed)).toThrow()

    const unknown = clone(rehearsal21()) as Record<string, unknown>
    unknown.unreviewedForwardField = true
    expect(() => validateGoldImportV2ExactPackageRehearsalReport21(unknown)).toThrow()
  })
})
