import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  buildContractInvariantIdentity,
  buildDeploymentProfileIdentity,
} from './gold-import-compensation-contract-reconciliation'
import { validateSchemaSecurityDefinitionIdentity } from './gold-import-compensation-rehearsal-evidence'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import { GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4 } from './gold-import-source-authorization-v4'
import {
  validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile,
  type ProtectedV2CompleteCatalogAuditIdentity,
} from './gold-import-contract-v2-catalog-audit'
import {
  validateProtectedV2ExpectedCatalogBinding,
  type ProtectedV2ExpectedCatalogBinding,
} from './protected-gold-import-contract-v2-bindings'
import {
  loadGoldImportCompensationV2LocalMigrationReceiptGate,
  migrationReceiptGateArtifactSha256,
  requireIssuedGoldImportCompensationV2MigrationReceiptGateForAudit,
  type GoldImportCompensationV2MigrationReceiptGate,
} from './gold-import-compensation-v2-migration-receipt-gate'
import { LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY } from './literature-gold-v2-schema-only-transition'
import { assertDerivedV2ReadinessPolicy } from './gold-import-contract-v2-readiness-policy'

export { assertDerivedV2ReadinessPolicy } from './gold-import-contract-v2-readiness-policy'

export const GOLD_IMPORT_COMPENSATION_V2_AUDIT_SCHEMA_VERSION =
  'gold-import-compensation-v2-package-audit/1.0.0' as const
export const V2_MIGRATION_REQUIRED_BEFORE_SOURCE_OR_CLIENT =
  'V2 migration is absent; stop before reading source artifacts or constructing a database client.' as const

/** Post-migration/pre-import identities. The older note-disposition constant remains pre-V2. */
export const GOLD_IMPORT_V2_READY_STATE_IDENTITIES = Object.freeze({
  developmentMembershipSha256:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.developmentMembershipSha256,
  developmentPlanningStateSha256:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.planningStateSha256,
  effectiveStateSha256:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.effectiveStateSha256V1,
  physicalStateSha256: LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.physicalStateSha256V1,
  v2EffectiveStateSha256:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.effectiveStateSha256V2,
  v2PhysicalStateSha256:
    LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.physicalStateSha256V2,
} as const)

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const uuidSchema = z.string().uuid()

export const goldImportCompensationV2MigrationProbeSchema = z
  .object({
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    database: z
      .object({
        batchId: uuidSchema,
        developmentMembershipSha256: z.literal(
          GOLD_IMPORT_V2_READY_STATE_IDENTITIES.developmentMembershipSha256,
        ),
        developmentPlanningStateSha256: z.literal(
          GOLD_IMPORT_V2_READY_STATE_IDENTITIES.developmentPlanningStateSha256,
        ),
        effectiveStateSha256: z.literal(GOLD_IMPORT_V2_READY_STATE_IDENTITIES.effectiveStateSha256),
        physicalStateSha256: z.literal(GOLD_IMPORT_V2_READY_STATE_IDENTITIES.physicalStateSha256),
      })
      .strict(),
    migration: z
      .object({
        id: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
        sha256: sha256Schema,
        v1Occurrence: z.number().int().nonnegative(),
        v2Occurrence: z.number().int().nonnegative(),
      })
      .strict(),
    safety: z
      .object({
        heldOutIdentitiesAccessed: z.literal(false),
        readOnly: z.literal(true),
        remoteAccess: z.literal(false),
        remoteWritesAllowed: z.literal(false),
        repeatableRead: z.literal(true),
      })
      .strict(),
    schemaVersion: z.literal(GOLD_IMPORT_COMPENSATION_V2_AUDIT_SCHEMA_VERSION),
    target: z.enum(['local', 'disposable_clone']),
  })
  .passthrough()

export type GoldImportCompensationV2MigrationProbe = z.infer<
  typeof goldImportCompensationV2MigrationProbeSchema
>

export const goldImportCompensationV2ReadyAuditSchema = goldImportCompensationV2MigrationProbeSchema
  .extend({
    completeCatalogAudit: z.unknown(),
    contractAudit: z
      .object({
        appendOnlyProtectionsReady: z.literal(true),
        deploymentProfileEvidence: z.unknown(),
        environmentInvariantIdentity: z.record(z.string(), z.unknown()),
        environmentInvariantIdentitySha256: sha256Schema,
        environmentProfileIdentity: z.record(z.string(), z.unknown()),
        environmentProfileIdentitySha256: sha256Schema,
        ownerAclReady: z.literal(true),
        rpcMetadata: z.array(z.unknown()).nonempty(),
        rpcBoundaryReady: z.literal(true),
        safeSearchPathsReady: z.literal(true),
        schemaSecurityDefinitionIdentity: z.unknown(),
      })
      .strict(),
    exactExistingHeadCohort: z
      .object({
        cohortSha256: z.literal(GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4),
        headCount: z.literal(9),
      })
      .strict(),
    expectedPostImportEffectiveStateSha256: sha256Schema,
    expectedCatalog: z.unknown(),
    repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
    stateMutationEvidence: z
      .object({
        effectiveStateChanged: z.literal(false),
        itemRevealTimestampMutationCount: z.literal(0),
        pointerMutationCount: z.literal(0),
        reviewRowMutationCount: z.literal(0),
      })
      .strict(),
    stateIntegrity: z
      .object({
        currentPointersAreLatestHeads: z.literal(true),
        revisionChainsLinear: z.literal(true),
      })
      .strict(),
    testSplitLocked: z.literal(true),
    v2PreImportState: z
      .object({
        effectiveStateSha256: z.literal(
          GOLD_IMPORT_V2_READY_STATE_IDENTITIES.v2EffectiveStateSha256,
        ),
        physicalStateSha256: z.literal(GOLD_IMPORT_V2_READY_STATE_IDENTITIES.v2PhysicalStateSha256),
      })
      .strict(),
  })
  .strict()

type ParsedGoldImportCompensationV2ReadyAudit = z.infer<
  typeof goldImportCompensationV2ReadyAuditSchema
>
export type GoldImportCompensationV2ReadyAudit = Omit<
  ParsedGoldImportCompensationV2ReadyAudit,
  'completeCatalogAudit' | 'expectedCatalog'
> & {
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
}

/** The only gate allowed to run before finalized-source reads or client creation. */
export function assertGoldImportCompensationV2MigrationPresent(
  input: unknown,
): GoldImportCompensationV2MigrationProbe {
  const probe = goldImportCompensationV2MigrationProbeSchema.parse(input)
  if (probe.migration.v2Occurrence !== 1) {
    throw new Error(V2_MIGRATION_REQUIRED_BEFORE_SOURCE_OR_CLIENT)
  }
  if (probe.migration.v1Occurrence !== 1) {
    throw new Error('V1 migration occurrence drifted; V2 audit cannot continue.')
  }
  return probe
}

export function validateReadyGoldImportCompensationV2Audit(
  input: unknown,
): GoldImportCompensationV2ReadyAudit {
  assertGoldImportCompensationV2MigrationPresent(input)
  const audit = goldImportCompensationV2ReadyAuditSchema.parse(input)
  const expectedContext =
    audit.target === 'disposable_clone'
      ? ({ profileId: 'supabase_admin_owner_v1', target: 'disposable' } as const)
      : ({ profileId: 'local_supabase_postgres_owner_v1', target: 'local' } as const)
  const expectedCatalog = validateProtectedV2ExpectedCatalogBinding(
    audit.expectedCatalog,
    expectedContext.profileId,
    expectedContext.target,
  )
  const completeCatalogAudit = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    audit.completeCatalogAudit,
    expectedContext.profileId,
    expectedContext.target,
  )
  const schemaIdentity = validateSchemaSecurityDefinitionIdentity(
    audit.contractAudit.schemaSecurityDefinitionIdentity,
  )
  assertDerivedV2ReadinessPolicy({
    auditTarget: audit.target,
    deploymentProfileEvidence: audit.contractAudit.deploymentProfileEvidence,
    rpcMetadata: audit.contractAudit.rpcMetadata,
    schemaSecurityDefinitionIdentity: schemaIdentity,
  })
  const derivedInvariantIdentity = buildContractInvariantIdentity(
    schemaIdentity,
    audit.contractAudit.rpcMetadata as never,
  )
  const derivedProfileIdentity = buildDeploymentProfileIdentity(
    schemaIdentity,
    audit.contractAudit.rpcMetadata as never,
    audit.contractAudit.deploymentProfileEvidence as never,
  )
  if (
    canonicalJson(derivedInvariantIdentity) !==
      canonicalJson(audit.contractAudit.environmentInvariantIdentity) ||
    canonicalJson(derivedProfileIdentity) !==
      canonicalJson(audit.contractAudit.environmentProfileIdentity) ||
    audit.contractAudit.environmentInvariantIdentitySha256 !==
      sha256Canonical(audit.contractAudit.environmentInvariantIdentity) ||
    audit.contractAudit.environmentProfileIdentitySha256 !==
      sha256Canonical(audit.contractAudit.environmentProfileIdentity) ||
    audit.contractAudit.environmentInvariantIdentitySha256 !==
      expectedCatalog.environmentInvariantIdentitySha256 ||
    audit.contractAudit.environmentProfileIdentitySha256 !==
      expectedCatalog.expectedDeploymentProfileIdentitySha256 ||
    completeCatalogAudit.fullAuditIdentitySha256 !== expectedCatalog.fullAuditIdentitySha256 ||
    completeCatalogAudit.fullEnvironmentInventoryIdentitySha256 !==
      expectedCatalog.fullEnvironmentInventoryIdentitySha256 ||
    completeCatalogAudit.fullEnvironmentInventoryRecordCount !==
      expectedCatalog.fullEnvironmentInventoryRecordCount ||
    completeCatalogAudit.localPostgresOwnerProfileIdentitySha256 !==
      expectedCatalog.expectedDeploymentProfileIdentitySha256 ||
    canonicalJson(completeCatalogAudit.componentIdentities) !==
      canonicalJson(expectedCatalog.componentIdentities)
  ) {
    throw new Error('V2 invariant/profile identities do not match their schema-audit artifacts.')
  }
  return { ...audit, completeCatalogAudit, expectedCatalog }
}

export interface V2MigrationFirstRuntimeDependencies<TSources, TValidated, TClient> {
  createDatabaseClient: () => Promise<TClient> | TClient
  expectedMigrationReceiptGateSha256: string
  loadDisposableMigrationReceiptGate?: (
    audit: GoldImportCompensationV2ReadyAudit,
  ) => Promise<unknown> | unknown
  migrationReceiptOutputDirectory?: string
  readMigrationProbe: () => Promise<unknown> | unknown
  readSourceArtifacts: () => Promise<TSources> | TSources
  validateSourceAuthorization: (
    sources: TSources,
    audit: GoldImportCompensationV2ReadyAudit,
  ) => Promise<TValidated> | TValidated
  validateReadyAuditForTest?: (input: unknown) => GoldImportCompensationV2ReadyAudit
}

/**
 * Enforce observable ordering: migration probe, complete audit, source reads, then client.
 * A real-local probe with V2 occurrence zero never reaches either callback.
 */
export async function prepareGoldImportCompensationV2Runtime<TSources, TValidated, TClient>(
  dependencies: V2MigrationFirstRuntimeDependencies<TSources, TValidated, TClient>,
): Promise<{
  audit: GoldImportCompensationV2ReadyAudit
  client: TClient
  migrationReceiptGate: GoldImportCompensationV2MigrationReceiptGate
  sources: TSources
  validatedSourceAuthorization: TValidated
}> {
  const probe = await dependencies.readMigrationProbe()
  assertGoldImportCompensationV2MigrationPresent(probe)
  if (dependencies.validateReadyAuditForTest && process.env.NODE_ENV !== 'test') {
    throw new Error('V2 ready-audit verifier overrides are restricted to tests.')
  }
  const audit = (
    dependencies.validateReadyAuditForTest ?? validateReadyGoldImportCompensationV2Audit
  )(probe)
  let loadedMigrationReceiptGate: unknown
  if (audit.target === 'local') {
    if (
      dependencies.loadDisposableMigrationReceiptGate ||
      !dependencies.migrationReceiptOutputDirectory
    ) {
      throw new Error(
        'Local V2 execution requires the fixed live finalized-receipt filesystem loader.',
      )
    }
    loadedMigrationReceiptGate = await loadGoldImportCompensationV2LocalMigrationReceiptGate({
      audit,
      outputDirectory: dependencies.migrationReceiptOutputDirectory,
    })
  } else {
    if (
      dependencies.migrationReceiptOutputDirectory ||
      !dependencies.loadDisposableMigrationReceiptGate
    ) {
      throw new Error('Disposable V2 execution requires its internal non-production proof loader.')
    }
    loadedMigrationReceiptGate = await dependencies.loadDisposableMigrationReceiptGate(audit)
  }
  const migrationReceiptGate = requireIssuedGoldImportCompensationV2MigrationReceiptGateForAudit(
    loadedMigrationReceiptGate,
    audit,
  )
  if (
    migrationReceiptGateArtifactSha256(migrationReceiptGate) !==
    dependencies.expectedMigrationReceiptGateSha256
  ) {
    throw new Error('Live finalized V2 migration receipt differs from the packaged receipt gate.')
  }
  const sources = await dependencies.readSourceArtifacts()
  const validatedSourceAuthorization = await dependencies.validateSourceAuthorization(
    sources,
    audit,
  )
  const client = await dependencies.createDatabaseClient()
  return { audit, client, migrationReceiptGate, sources, validatedSourceAuthorization }
}

const HELP = `Audit the file-only V2 package-readiness probe.

Usage:
  npm run literature:audit-gold-import-compensation-v2 -- --migration-audit <json>

The input must come from a repeatable-read/read-only diagnostic. If V2 is absent, this command
stops before any finalized source-artifact path or database-client option is accepted.`

export async function runAuditGoldImportCompensationV2(argv: string[]) {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, ['help', 'migration-audit'])
  if (arguments_.flags.has('help')) return { help: HELP }
  const auditPath = stringArgument(arguments_, 'migration-audit')
  if (!auditPath) throw new Error('--migration-audit is required.')
  const bytes = await readFile(resolve(auditPath))
  let input: unknown
  try {
    input = JSON.parse(bytes.toString('utf8')) as unknown
  } catch {
    throw new Error('V2 migration audit must be valid JSON.')
  }
  const audit = validateReadyGoldImportCompensationV2Audit(input)
  return {
    contractVersion: audit.contractVersion,
    migrationId: audit.migration.id,
    migrationSha256: audit.migration.sha256,
    readiness: 'ready' as const,
    target: audit.target,
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runAuditGoldImportCompensationV2(process.argv.slice(2))
    .then((result) => console.log(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
