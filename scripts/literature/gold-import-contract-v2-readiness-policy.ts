import { GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES } from '../../src/features/literature/gold-set/import-compensation-v2-identities'
import { protectedV2CapabilityFreeCanonicalJson as canonicalJson } from './protected-gold-import-contract-v2-capability-free-canonical'
import {
  buildFullEnvironmentInventoryIdentity,
  reconciliationIdentitySha256,
  SUPPORTED_DEPLOYMENT_PROFILES,
  type DeploymentProfileEvidence,
  type EnrichedRpcMetadata,
  type RpcAclEntry,
} from './gold-import-compensation-contract-reconciliation'

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
  auditTarget: 'local' | 'disposable_clone'
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
