import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import {
  GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES,
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
  buildFullEnvironmentInventoryIdentity,
  reconciliationIdentitySha256,
  SUPPORTED_DEPLOYMENT_PROFILES,
  type DeploymentProfileEvidence,
  type EnrichedRpcMetadata,
  type RpcAclEntry,
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

const REQUIRED_TRANSITION_RPC_ARGUMENTS_V2 = Object.freeze({
  apply_literature_gold_import_v1:
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  apply_literature_gold_import_v2:
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  compensate_literature_gold_import_v1:
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  compensate_literature_gold_import_v2:
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  reconcile_literature_gold_review_operation_v1:
    'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
  reconcile_literature_gold_review_operation_v2:
    'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
} as const)

const REQUIRED_APPEND_ONLY_TRIGGERS_V2 = [
  'enforce_literature_gold_operation_contract_v2',
  'enforce_literature_gold_review_contract_v2',
  'guard_literature_gold_review_chain_insert',
  'guard_literature_gold_review_operation_actions',
  'guard_literature_gold_review_operations',
  'validate_literature_gold_operation_event',
] as const

function canonicalAclIdentity(entries: readonly RpcAclEntry[]): string {
  return canonicalJson(
    entries
      .map((entry) => ({ ...entry }))
      .sort((left, right) => {
        const leftIdentity = canonicalJson(left)
        const rightIdentity = canonicalJson(right)
        return leftIdentity < rightIdentity ? -1 : leftIdentity > rightIdentity ? 1 : 0
      }),
  )
}

function aclEntriesFromSchemaRecords(
  inventory: ReturnType<typeof buildFullEnvironmentInventoryIdentity>,
  function_: { identityArguments: string; name: string },
): RpcAclEntry[] {
  return inventory.schemaSecurityDefinitionIdentity.records
    .filter(
      (record) =>
        record.objectType === 'function_acl' &&
        record.objectName === function_.name &&
        record.state.identityArguments === function_.identityArguments,
    )
    .map((record) => {
      const { grantee, grantor, isGrantable, privilegeType } = record.state
      if (
        typeof grantee !== 'string' ||
        typeof grantor !== 'string' ||
        typeof isGrantable !== 'boolean' ||
        typeof privilegeType !== 'string'
      ) {
        throw new Error(`V2 schema ACL record is malformed for ${function_.name}.`)
      }
      return { grantee, grantor, isGrantable, privilegeType }
    })
}

function expectedFunctionAclEntries(
  profile: (typeof SUPPORTED_DEPLOYMENT_PROFILES)[keyof typeof SUPPORTED_DEPLOYMENT_PROFILES],
  serviceRoleExecute: boolean,
): RpcAclEntry[] {
  return [
    profile.owner,
    ...(profile.profileId === 'supabase_admin_owner_v1' ? ['postgres'] : []),
    ...(serviceRoleExecute ? ['service_role'] : []),
  ].map((grantee) => ({
    grantee,
    grantor: profile.owner,
    isGrantable: false,
    privilegeType: 'EXECUTE',
  }))
}

function assertTrustedDeploymentProfile(
  evidence: DeploymentProfileEvidence,
  profile: (typeof SUPPORTED_DEPLOYMENT_PROFILES)[keyof typeof SUPPORTED_DEPLOYMENT_PROFILES],
): void {
  const roleInventorySha256 = reconciliationIdentitySha256(evidence.roleInventory)
  const ownerRole = evidence.roleInventory.find(({ roleName }) => roleName === profile.owner)
  if (
    roleInventorySha256 !== profile.roleInventorySha256 ||
    !ownerRole ||
    ownerRole.exists !== true ||
    ownerRole.attributes === null ||
    canonicalJson({ ...ownerRole.attributes, roleName: ownerRole.roleName }) !==
      canonicalJson(profile.ownerRoleAttributes)
  ) {
    throw new Error('V2 deployment profile role inventory or owner attributes are not trusted.')
  }
}

export function assertDerivedV2ReadinessPolicy(input: {
  auditTarget: GoldImportCompensationV2ReadyAudit['target']
  deploymentProfileEvidence: unknown
  rpcMetadata: unknown[]
  schemaSecurityDefinitionIdentity: unknown
}): void {
  const inventory = buildFullEnvironmentInventoryIdentity(
    input.schemaSecurityDefinitionIdentity as never,
    input.rpcMetadata as EnrichedRpcMetadata[],
    input.deploymentProfileEvidence as never,
  )
  const profile = SUPPORTED_DEPLOYMENT_PROFILES[inventory.deploymentProfile.profileId]
  const expectedProfile =
    input.auditTarget === 'disposable_clone'
      ? SUPPORTED_DEPLOYMENT_PROFILES.supabase_admin_owner_v1
      : SUPPORTED_DEPLOYMENT_PROFILES.local_supabase_postgres_owner_v1
  if (
    profile.profileId !== expectedProfile.profileId ||
    inventory.deploymentProfile.target !== expectedProfile.target
  ) {
    throw new Error('V2 deployment profile is not valid for the audited target.')
  }
  assertTrustedDeploymentProfile(inventory.deploymentProfile, profile)

  for (const [name, expected] of Object.entries(
    GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES,
  )) {
    const namedFunctions = inventory.schemaSecurityDefinitionIdentity.records.filter(
      (record) => record.objectType === 'function' && record.objectName === name,
    )
    const matches = namedFunctions.filter(
      (record) => record.state.identityArguments === expected.identityArguments,
    )
    const serviceRoleExecute = ![
      'enforce_literature_gold_operation_contract_v2',
      'enforce_literature_gold_review_contract_v2',
    ].includes(name)
    const expectedAclEntries = expectedFunctionAclEntries(profile, serviceRoleExecute)
    const schemaAclEntries = aclEntriesFromSchemaRecords(inventory, {
      identityArguments: expected.identityArguments,
      name,
    })
    if (
      namedFunctions.length !== 1 ||
      matches.length !== 1 ||
      matches[0]?.definitionSha256 !== expected.definitionSha256 ||
      matches[0]?.owner !== profile.owner ||
      canonicalAclIdentity(schemaAclEntries) !== canonicalAclIdentity(expectedAclEntries)
    ) {
      throw new Error(`V2 semantic function definition identity drifted for ${name}.`)
    }
  }

  const expectedNames = Object.keys(REQUIRED_TRANSITION_RPC_ARGUMENTS_V2).sort()
  const actualNames = inventory.rpcs.map(({ name }) => name).sort()
  if (canonicalJson(actualNames) !== canonicalJson(expectedNames)) {
    throw new Error('V2 RPC boundary does not contain exactly the V1/V2 transition functions.')
  }
  for (const rpc of inventory.rpcs) {
    const expectedArguments =
      REQUIRED_TRANSITION_RPC_ARGUMENTS_V2[
        rpc.name as keyof typeof REQUIRED_TRANSITION_RPC_ARGUMENTS_V2
      ]
    const functionRecords = inventory.schemaSecurityDefinitionIdentity.records.filter(
      (record) => record.objectType === 'function' && record.objectName === rpc.name,
    )
    const functionRecord = functionRecords.find(
      (record) => record.state.identityArguments === rpc.identityArguments,
    )
    const schemaAclEntries = aclEntriesFromSchemaRecords(inventory, rpc)
    const expectedAclEntries = expectedFunctionAclEntries(profile, true)
    // pg_proc.proacl preserves the owner-first catalog order. The schema ACL records are
    // independently canonicalized as a set above, so reconstruct raw ACL bytes from the exact
    // profile grant order rather than their normalized record order.
    const expectedRawAcl = `{${expectedAclEntries
      .map(({ grantee, grantor }) => `${grantee}=X/${grantor}`)
      .join(',')}}`
    if (
      !expectedArguments ||
      rpc.identityArguments !== expectedArguments ||
      rpc.resultType !== 'jsonb' ||
      rpc.routineKind !== 'function' ||
      rpc.language !== 'plpgsql' ||
      rpc.overloadCount !== 1 ||
      rpc.securityDefiner !== true ||
      rpc.owner !== profile.owner ||
      rpc.searchPath.actual !== 'pg_catalog, public, extensions' ||
      rpc.searchPath.matchesExpected !== true ||
      rpc.effectiveExecute.PUBLIC ||
      rpc.effectiveExecute.anon ||
      rpc.effectiveExecute.authenticated ||
      !rpc.effectiveExecute.service_role ||
      canonicalAclIdentity(rpc.explicitGrants) !== canonicalAclIdentity(expectedAclEntries) ||
      canonicalAclIdentity(schemaAclEntries) !== canonicalAclIdentity(expectedAclEntries) ||
      rpc.rawAcl !== expectedRawAcl ||
      functionRecords.length !== 1 ||
      !functionRecord ||
      functionRecord.owner !== rpc.owner ||
      functionRecord.definitionSha256 !== rpc.definitionSha256 ||
      functionRecord.normalizedDefinition !== rpc.normalizedDefinition ||
      functionRecord.state.resultType !== rpc.resultType ||
      functionRecord.state.securityDefiner !== true ||
      functionRecord.state.searchPath !== rpc.searchPath.actual
    ) {
      throw new Error(`V2 transition RPC policy or schema binding drifted for ${rpc.name}.`)
    }
  }

  for (const triggerName of REQUIRED_APPEND_ONLY_TRIGGERS_V2) {
    const matches = inventory.schemaSecurityDefinitionIdentity.records.filter(
      (record) => record.objectType === 'trigger' && record.objectName === triggerName,
    )
    if (
      matches.length !== 1 ||
      matches[0]?.state.enabled !== true ||
      matches[0]?.state.enableMode !== 'O'
    ) {
      throw new Error(`V2 append-only trigger boundary drifted for ${triggerName}.`)
    }
  }
  const journalTables = new Set([
    'literature_gold_review_operation_actions',
    'literature_gold_review_operations',
  ])
  const prohibitedJournalPrivileges = new Set(['DELETE', 'INSERT', 'TRUNCATE', 'UPDATE'])
  const excessiveJournalPrivilege = inventory.schemaSecurityDefinitionIdentity.records.find(
    (record) =>
      record.objectType === 'effective_table_privilege' &&
      journalTables.has(record.parentObjectName ?? '') &&
      record.state.roleName === 'service_role' &&
      prohibitedJournalPrivileges.has(String(record.state.privilegeName)) &&
      record.state.granted === true,
  )
  if (excessiveJournalPrivilege) {
    throw new Error('V2 service_role has a prohibited direct journal-mutation privilege.')
  }
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
