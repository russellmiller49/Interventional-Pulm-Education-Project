import { z } from 'zod'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_V2_PACKAGE_READINESS_SCHEMA_VERSION,
  validateGoldImportV2PackageReadinessState,
} from './gold-import-v2-package-readiness'
import {
  GOLD_IMPORT_V2_PREIMPORT_CAPTURE_SCHEMA_VERSION,
  GOLD_IMPORT_V2_PREIMPORT_PAIR_SCHEMA_VERSION,
  validateGoldImportV2PreimportCapture,
  validateGoldImportV2PreimportCapturePair,
} from './gold-import-v2-preimport-capture'
import {
  GOLD_IMPORT_COMPENSATION_PACKAGE_GENERATOR_SCHEMA_VERSION_V2,
  GOLD_IMPORT_COMPENSATION_PACKAGE_VERSION_V2,
  GOLD_IMPORT_V2_PACKAGE_GENERATION_READINESS_SCHEMA_VERSION,
  validateGoldImportV2PackageGenerationReadiness,
} from './generate-gold-import-compensation-package-v2'
import {
  parseProtectedV2RuntimeBundleBinding,
  validateProtectedV2ExpectedCatalogBinding,
} from './protected-gold-import-contract-v2-bindings'

export const GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION =
  'literature-gold-v2-postmigration-delivery-backup/1.0.0' as const
export const GOLD_IMPORT_V2_CURRENT_REHEARSAL_SCHEMA_VERSION =
  'gold-import-compensation-exact-package-rehearsal/2.1.0' as const
export const GOLD_IMPORT_V2_HISTORICAL_PR95_BACKUP_SCHEMA_VERSION =
  'gold-import-contract-v2-forward-repair-backup/2.0.0' as const
export const GOLD_IMPORT_V2_HISTORICAL_PR95_REHEARSAL_SCHEMA_VERSION =
  'gold-import-compensation-exact-package-rehearsal/2.0.0' as const

export const GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY = Object.freeze({
  backup: GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION,
  capture: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_SCHEMA_VERSION,
  capturePair: GOLD_IMPORT_V2_PREIMPORT_PAIR_SCHEMA_VERSION,
  finalizedReceipt: 'literature-gold-v2-finalized-migration-receipt-evidence/1.0.0',
  generatedPackage: GOLD_IMPORT_COMPENSATION_PACKAGE_GENERATOR_SCHEMA_VERSION_V2,
  package: GOLD_IMPORT_COMPENSATION_PACKAGE_VERSION_V2,
  packageGenerationReadiness: GOLD_IMPORT_V2_PACKAGE_GENERATION_READINESS_SCHEMA_VERSION,
  packageReadiness: GOLD_IMPORT_V2_PACKAGE_READINESS_SCHEMA_VERSION,
  rehearsal: GOLD_IMPORT_V2_CURRENT_REHEARSAL_SCHEMA_VERSION,
} as const)

export const GOLD_IMPORT_V2_HISTORICAL_PR95_COMPATIBILITY = Object.freeze({
  backup: GOLD_IMPORT_V2_HISTORICAL_PR95_BACKUP_SCHEMA_VERSION,
  rehearsal: GOLD_IMPORT_V2_HISTORICAL_PR95_REHEARSAL_SCHEMA_VERSION,
} as const)

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const actionCountsSchema = z
  .object({
    initial: z.number().int().nonnegative(),
    inserts: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
    revisions: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  })
  .strict()

export const goldImportV2ExactPackageRehearsalReport21Schema = z
  .object({
    audit: z
      .object({
        completeCatalogAuditIdentitySha256: sha256Schema,
        completeCatalogAuditModelIdentitySha256: sha256Schema,
        environmentInvariantIdentitySha256: sha256Schema,
        environmentProfileIdentitySha256: sha256Schema,
        sha256: sha256Schema,
        source: z.literal('first_v1_seeded_upgrade_disposable_context'),
      })
      .strict(),
    backup: z
      .object({
        manifestSha256: sha256Schema,
        v1StateAuthenticatedBeforeSourceRead: z.literal(true),
      })
      .strict(),
    catalogDriftMatrix: z
      .object({
        localOwnerProjectionIdentitySha256: sha256Schema,
        probeCount: z.number().int().positive(),
        rejectedCount: z.number().int().positive(),
        sha256: sha256Schema,
      })
      .strict(),
    contractVersion: z.literal('gold-review-import-compensation/2.0.0'),
    expectedCatalog: z.record(z.string(), z.unknown()),
    migration: z
      .object({
        id: z.literal('20260809231651_add_literature_gold_import_compensation_contract_v2'),
        sha256: sha256Schema,
      })
      .strict(),
    package: z
      .object({
        actionCounts: actionCountsSchema,
        completeCatalogAuditIdentitySha256: sha256Schema,
        directory: z.literal('exact-package-v2'),
        expectedCatalogBindingSha256: sha256Schema,
        importPlanSha256: sha256Schema,
        manifestSha256: sha256Schema,
        sourceArtifactSha256: sha256Schema,
        sourceAuthorizationSetSha256: sha256Schema,
      })
      .strict(),
    postV2PreImportReadiness: z
      .object({
        capturePairIdentitySha256: sha256Schema,
        compensationAuthorized: z.literal(false),
        importAuthorized: z.literal(false),
        packageReadinessIdentitySha256: sha256Schema,
      })
      .strict()
      .optional(),
    protectedRuntimeBundle: z.record(z.string(), z.unknown()),
    rehearsals: z
      .object({
        bootstrap: z
          .object({
            evidenceMatchesRepeatedUpgrade: z.literal(true),
            migrationPath: z.literal('upgrade'),
            packageGeneratedInContext: z.literal(true),
          })
          .strict(),
        fresh: z
          .object({
            canonicalEvidenceSha256: sha256Schema,
            completeRuns: z.literal(2),
            deterministic: z.literal(true),
            postV2ProjectedSeedMatchedUpgrade: z.literal(true),
          })
          .strict(),
        upgrade: z
          .object({
            canonicalEvidenceSha256: sha256Schema,
            completeRuns: z.literal(2),
            deterministic: z.literal(true),
            preV1SeedLoadedAtHistoricalBoundary: z.literal(true),
            schemaOnlyV1StateBracketed: z.literal(true),
          })
          .strict(),
      })
      .strict(),
    repository: z
      .object({
        branch: z.string().min(1),
        cleanTrackedAndUntrackedWorktree: z.literal(true),
        headSha: z.string().regex(/^[a-f0-9]{40}$/u),
        originMainIsAncestor: z.literal(true),
      })
      .strict(),
    safety: z
      .object({
        allFourContainersRemovedAndVerifiedAbsent: z.literal(true),
        callerDatabaseTargetAccepted: z.literal(false),
        heldOutIdentitiesAccessed: z.literal(false),
        realLocalDatabaseMutated: z.literal(false),
        realLocalReadOnlyVerified: z.boolean(),
        remoteDatabaseTouched: z.literal(false),
        sourceReadOnlyAfterV2BootstrapProbe: z.literal(true),
      })
      .strict(),
    schemaVersion: z.literal(GOLD_IMPORT_V2_CURRENT_REHEARSAL_SCHEMA_VERSION),
    status: z.literal('passed'),
  })
  .strict()

export type GoldImportV2ExactPackageRehearsalReport21 = z.infer<
  typeof goldImportV2ExactPackageRehearsalReport21Schema
>

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

/** Strict version-specific parser; it never relabels a 2.0 artifact as 2.1. */
export function validateGoldImportV2ExactPackageRehearsalReport21(
  input: unknown,
): GoldImportV2ExactPackageRehearsalReport21 {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Exact package rehearsal 2.1 report must be an object.')
  }
  if (!hasOwn(input, 'expectedCatalog') || !hasOwn(input, 'protectedRuntimeBundle')) {
    throw new Error('Exact package rehearsal 2.1 report is missing an authority binding.')
  }
  const report = goldImportV2ExactPackageRehearsalReport21Schema.parse(input)
  validateProtectedV2ExpectedCatalogBinding(
    report.expectedCatalog,
    'supabase_admin_owner_v1',
    'disposable',
  )
  parseProtectedV2RuntimeBundleBinding(report.protectedRuntimeBundle)
  const hasReadiness = report.postV2PreImportReadiness !== undefined
  if (report.safety.realLocalReadOnlyVerified !== hasReadiness) {
    throw new Error('Exact package rehearsal 2.1 real-local readiness fields disagree.')
  }
  return Object.freeze(report)
}

export function validateGoldImportV2CurrentLifecycleCompatibility(input: {
  backupSchemaVersion: unknown
  capture: unknown
  capturePair: unknown
  packageGenerationReadiness: unknown
  packageReadiness: unknown
  rehearsal: unknown
}): typeof GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY {
  if (input.backupSchemaVersion !== GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION) {
    throw new Error('Current lifecycle backup schema is not the reviewed PR #97 authority.')
  }
  const capture = validateGoldImportV2PreimportCapture(input.capture)
  const capturePair = validateGoldImportV2PreimportCapturePair(input.capturePair)
  const packageReadiness = validateGoldImportV2PackageReadinessState(input.packageReadiness)
  const generationReadiness = validateGoldImportV2PackageGenerationReadiness(
    input.packageGenerationReadiness,
  )
  const rehearsal = validateGoldImportV2ExactPackageRehearsalReport21(input.rehearsal)
  if (!rehearsal.postV2PreImportReadiness) {
    throw new Error(
      'Current post-V2 lifecycle rehearsal lacks its exact production readiness binding.',
    )
  }
  if (
    canonicalJson(capture.packageReadiness) !== canonicalJson(packageReadiness) ||
    capturePair.packageReadinessIdentitySha256 !==
      generationReadiness.capturePair.packageReadinessIdentitySha256 ||
    canonicalJson(capturePair) !== canonicalJson(generationReadiness.capturePair) ||
    canonicalJson(packageReadiness) !== canonicalJson(generationReadiness.packageReadiness) ||
    rehearsal.postV2PreImportReadiness.capturePairIdentitySha256 !==
      capturePair.pairIdentitySha256 ||
    rehearsal.postV2PreImportReadiness.packageReadinessIdentitySha256 !==
      generationReadiness.readinessIdentitySha256
  ) {
    throw new Error('Current lifecycle artifacts are valid individually but not cross-bound.')
  }
  return GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY
}

export function validateHistoricalPr95BackupCompatibility(input: {
  backupSchemaVersion: unknown
  rehearsalSchemaVersion: unknown
}): typeof GOLD_IMPORT_V2_HISTORICAL_PR95_COMPATIBILITY {
  if (
    input.backupSchemaVersion !== GOLD_IMPORT_V2_HISTORICAL_PR95_BACKUP_SCHEMA_VERSION ||
    input.rehearsalSchemaVersion !== GOLD_IMPORT_V2_HISTORICAL_PR95_REHEARSAL_SCHEMA_VERSION
  ) {
    throw new Error('Historical PR #95 backup accepts only its exact 2.0 rehearsal contract.')
  }
  return GOLD_IMPORT_V2_HISTORICAL_PR95_COMPATIBILITY
}
