/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  projectRpcMetadataForDeploymentProfile,
  projectSchemaSecurityIdentityForDeploymentProfile,
  reconcileGoldImportCompensationContract,
  REQUIRED_RECONCILIATION_RPCS,
  reconciliationIdentitySha256,
  TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256,
  type DeploymentProfileEvidence,
  type DeploymentProfileId,
  type EnrichedRpcMetadata,
  type GoldImportCompensationContractReconciliationInput,
  type RoleSecurityAttributes,
} from './gold-import-compensation-contract-reconciliation'
import {
  normalizePostgresDefinition,
  type SchemaSecurityDefinitionIdentity,
  type SchemaSecurityDefinitionRecord,
} from './gold-import-compensation-rehearsal-evidence'

const FIXTURE_PATH = resolve(
  process.cwd(),
  'scripts/literature/fixtures/post-migration-schema-security-definition-identity.json',
)

const RPC_ARGUMENTS: Record<(typeof REQUIRED_RECONCILIATION_RPCS)[number], string> = {
  apply_literature_gold_import_v1:
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  compensate_literature_gold_import_v1:
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  reconcile_literature_gold_review_operation_v1:
    'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function expectedIdentity(): Promise<SchemaSecurityDefinitionIdentity> {
  return JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as SchemaSecurityDefinitionIdentity
}

type RoleAttributes = NonNullable<RoleSecurityAttributes['attributes']>

const ORDINARY_ROLE_ATTRIBUTES: RoleAttributes = {
  bypassRls: false,
  canLogin: false,
  connectionLimit: -1,
  createDb: false,
  createRole: false,
  inherit: true,
  replication: false,
  superuser: false,
  validUntil: null,
}

const PRIVILEGED_ROLE_ATTRIBUTES: RoleAttributes = {
  bypassRls: true,
  canLogin: true,
  connectionLimit: -1,
  createDb: true,
  createRole: true,
  inherit: true,
  replication: true,
  superuser: true,
  validUntil: null,
}

function apiRoleMembers(): RoleSecurityAttributes['members'] {
  return [
    {
      adminOption: false,
      grantor: 'supabase_admin',
      inheritOption: false,
      memberName: 'authenticator',
      setOption: true,
    },
    {
      adminOption: true,
      grantor: 'supabase_admin',
      inheritOption: true,
      memberName: 'postgres',
      setOption: true,
    },
  ]
}

function postgresMembership(
  roleName: string,
  adminOption = true,
): RoleSecurityAttributes['memberOf'][number] {
  return {
    adminOption,
    grantor: 'supabase_admin',
    inheritOption: true,
    roleName,
    setOption: true,
  }
}

const ROLE_INVENTORY: RoleSecurityAttributes[] = [
  {
    attributes: ORDINARY_ROLE_ATTRIBUTES,
    effectiveMemberships: ['anon'],
    exists: true,
    memberOf: [],
    members: apiRoleMembers(),
    roleName: 'anon',
  },
  {
    attributes: ORDINARY_ROLE_ATTRIBUTES,
    effectiveMemberships: ['authenticated'],
    exists: true,
    memberOf: [],
    members: apiRoleMembers(),
    roleName: 'authenticated',
  },
  {
    attributes: { ...PRIVILEGED_ROLE_ATTRIBUTES, superuser: false },
    effectiveMemberships: [
      'anon',
      'authenticated',
      'authenticator',
      'pg_create_subscription',
      'pg_database_owner',
      'pg_monitor',
      'pg_read_all_data',
      'pg_read_all_settings',
      'pg_read_all_stats',
      'pg_signal_backend',
      'pg_stat_scan_tables',
      'postgres',
      'service_role',
      'supabase_functions_admin',
      'supabase_privileged_role',
      'supabase_realtime_admin',
    ],
    exists: true,
    memberOf: [
      postgresMembership('anon'),
      postgresMembership('authenticated'),
      postgresMembership('authenticator'),
      postgresMembership('pg_create_subscription'),
      postgresMembership('pg_monitor'),
      postgresMembership('pg_read_all_data'),
      postgresMembership('pg_signal_backend'),
      postgresMembership('service_role'),
      postgresMembership('supabase_functions_admin', false),
      postgresMembership('supabase_privileged_role', false),
      postgresMembership('supabase_realtime_admin', false),
    ],
    members: [],
    roleName: 'postgres',
  },
  {
    attributes: { ...ORDINARY_ROLE_ATTRIBUTES, bypassRls: true },
    effectiveMemberships: ['service_role'],
    exists: true,
    memberOf: [],
    members: apiRoleMembers(),
    roleName: 'service_role',
  },
  {
    attributes: PRIVILEGED_ROLE_ATTRIBUTES,
    effectiveMemberships: [
      'anon',
      'authenticated',
      'authenticator',
      'dashboard_user',
      'pg_checkpoint',
      'pg_create_subscription',
      'pg_database_owner',
      'pg_execute_server_program',
      'pg_maintain',
      'pg_monitor',
      'pg_read_all_data',
      'pg_read_all_settings',
      'pg_read_all_stats',
      'pg_read_server_files',
      'pg_signal_backend',
      'pg_stat_scan_tables',
      'pg_use_reserved_connections',
      'pg_write_all_data',
      'pg_write_server_files',
      'pgbouncer',
      'postgres',
      'service_role',
      'supabase_admin',
      'supabase_auth_admin',
      'supabase_etl_admin',
      'supabase_functions_admin',
      'supabase_privileged_role',
      'supabase_read_only_user',
      'supabase_realtime_admin',
      'supabase_replication_admin',
      'supabase_storage_admin',
    ],
    exists: true,
    memberOf: [],
    members: [],
    roleName: 'supabase_admin',
  },
]

function profileEvidence(
  profileId: DeploymentProfileId,
  target: DeploymentProfileEvidence['target'],
): DeploymentProfileEvidence {
  return { profileId, target, roleInventory: structuredClone(ROLE_INVENTORY) }
}

function expectedRpcs(): EnrichedRpcMetadata[] {
  return REQUIRED_RECONCILIATION_RPCS.map((name) => {
    const identityArguments = RPC_ARGUMENTS[name]
    const normalizedDefinition = normalizePostgresDefinition(
      `CREATE OR REPLACE FUNCTION public.${name}(${identityArguments}) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'extensions' AS $function$ BEGIN RETURN '{}'::jsonb; END; $function$`,
    )
    return {
      argumentsWithDefaults: identityArguments,
      configuration: ['search_path=pg_catalog, public, extensions'],
      definitionSha256: digest(normalizedDefinition),
      dependencies: [
        {
          dependencyType: 'n',
          referencedClass: 'pg_proc',
          referencedIdentity: 'public.literature_gold_set_items',
        },
      ],
      effectiveExecute: {
        PUBLIC: false,
        anon: false,
        authenticated: false,
        service_role: true,
      },
      explicitGrants: [
        {
          grantee: 'supabase_admin',
          grantor: 'supabase_admin',
          privilegeType: 'EXECUTE',
          isGrantable: false,
        },
        {
          grantee: 'postgres',
          grantor: 'supabase_admin',
          privilegeType: 'EXECUTE',
          isGrantable: false,
        },
        {
          grantee: 'service_role',
          grantor: 'supabase_admin',
          privilegeType: 'EXECUTE',
          isGrantable: false,
        },
      ],
      identityArguments,
      language: 'plpgsql',
      name,
      normalizedDefinition,
      objectIdentity: `public.${name}(${identityArguments})`,
      overloadCount: 1,
      owner: 'supabase_admin',
      parallelSafety: 'unsafe',
      rawAcl:
        '{supabase_admin=X/supabase_admin,postgres=X/supabase_admin,service_role=X/supabase_admin}',
      rawDefinition: normalizedDefinition,
      rawDefinitionSha256: digest(normalizedDefinition),
      resultType: 'jsonb',
      routineKind: 'function',
      schema: 'public',
      searchPath: {
        actual: 'pg_catalog, public, extensions',
        entries: ['search_path=pg_catalog, public, extensions'],
        expected: 'pg_catalog, public, extensions',
        matchesExpected: true,
      },
      securityDefiner: true,
      securityMode: 'definer',
      volatility: name.startsWith('reconcile_') ? 'stable' : 'volatile',
    }
  })
}

async function localInput(): Promise<GoldImportCompensationContractReconciliationInput> {
  const expected = await expectedIdentity()
  const rpcs = expectedRpcs()
  return {
    expectedIdentity: expected,
    actualIdentity: projectSchemaSecurityIdentityForDeploymentProfile(
      expected,
      'local_supabase_postgres_owner_v1',
    ),
    expectedRpcs: rpcs,
    actualRpcs: rpcs.map((rpc) =>
      projectRpcMetadataForDeploymentProfile(rpc, 'local_supabase_postgres_owner_v1'),
    ),
    expectedProfile: profileEvidence('local_supabase_postgres_owner_v1', 'local'),
    actualProfile: profileEvidence('local_supabase_postgres_owner_v1', 'local'),
  }
}

async function disposableInput(): Promise<GoldImportCompensationContractReconciliationInput> {
  const identity = await expectedIdentity()
  const rpcs = expectedRpcs()
  const profile = profileEvidence('supabase_admin_owner_v1', 'disposable')
  return {
    expectedIdentity: identity,
    actualIdentity: identity,
    expectedRpcs: rpcs,
    actualRpcs: rpcs,
    expectedProfile: profile,
    actualProfile: structuredClone(profile),
  }
}

function withRecords(
  identity: SchemaSecurityDefinitionIdentity,
  transform: (record: SchemaSecurityDefinitionRecord) => SchemaSecurityDefinitionRecord,
): SchemaSecurityDefinitionIdentity {
  return { ...identity, records: identity.records.map(transform) }
}

function changedDefinition(
  record: SchemaSecurityDefinitionRecord,
  normalizedDefinition: string,
  state: Record<string, unknown>,
): SchemaSecurityDefinitionRecord {
  return {
    ...record,
    normalizedDefinition,
    definitionSha256: digest(normalizedDefinition),
    state,
  }
}

describe('gold import-compensation contract reconciliation', () => {
  test('completely explains 763 versus 683 as the exact local postgres-owner representation', async () => {
    expect(reconciliationIdentitySha256(ROLE_INVENTORY)).toBe(
      TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256,
    )
    const result = reconcileGoldImportCompensationContract(await localInput())

    expect(result.ready).toBe(true)
    expect(result.invariantIdentityMatches).toBe(true)
    expect(result.deploymentProfile.passed).toBe(true)
    expect(result.fullEnvironmentInventoryMatches).toBe(false)
    expect(result.completeness).toEqual({
      expectedRecordCount: 763,
      actualRecordCount: 683,
      expectedRecordsAccountedFor: 763,
      actualRecordsAccountedFor: 683,
      complete: true,
    })
    expect(result.recordDiffs).toHaveLength(763)
    expect(result.ownerRepresentation).toMatchObject({
      expectedRecordCount: 763,
      actualRecordCount: 683,
      recordCountDelta: 80,
      projectedExpectedRecordCount: 683,
      collapsedExpectedRecordCount: 80,
      collapsedByObjectType: { function_acl: 24, table_acl: 56 },
      projectionExactlyMatchesActual: true,
      isExact763To683OwnerRepresentation: true,
    })
    expect(result.classificationCounts.missing_expected_object).toBe(0)
    expect(result.classificationCounts.unexpected_object).toBe(0)
    expect(result.classificationCounts.semantic_contract_difference).toBe(0)
    expect(result.classificationCounts.security_contract_difference).toBe(0)
    expect(result.classificationCounts.environment_representation_only).toBeGreaterThan(0)
    expect(result.classificationCounts.explicitly_supported_local_profile).toBeGreaterThan(0)
    expect(result.identities.expected.contractInvariant.sha256).toBe(
      result.identities.actual.contractInvariant.sha256,
    )
    expect(result.identities.expected.deploymentProfile.sha256).toBe(
      result.identities.actual.deploymentProfile.sha256,
    )
    expect(result.identities.expected.fullEnvironmentInventory.sha256).not.toBe(
      result.identities.actual.fullEnvironmentInventory.sha256,
    )
  })

  test('accepts the exact disposable supabase_admin profile without representation differences', async () => {
    const result = reconcileGoldImportCompensationContract(await disposableInput())

    expect(result.ready).toBe(true)
    expect(result.deploymentProfile.passed).toBe(true)
    expect(result.fullEnvironmentInventoryMatches).toBe(true)
    expect(result.recordDiffs.every(({ classification }) => classification === 'identical')).toBe(
      true,
    )
    expect(result.rpcDiffs.every(({ classification }) => classification === 'identical')).toBe(true)
  })

  test('rejects equal expected/actual non-owner membership tampering for both profiles', async () => {
    for (const input of [await localInput(), await disposableInput()]) {
      const tamperedRoleInventory = input.expectedProfile.roleInventory.map((role_) =>
        role_.roleName === 'anon'
          ? {
              ...role_,
              members: [
                ...role_.members,
                {
                  adminOption: false,
                  grantor: 'supabase_admin',
                  inheritOption: false,
                  memberName: 'unexpected_member',
                  setOption: true,
                },
              ],
            }
          : role_,
      )
      input.expectedProfile = {
        ...input.expectedProfile,
        roleInventory: tamperedRoleInventory,
      }
      input.actualProfile = {
        ...input.actualProfile,
        roleInventory: structuredClone(tamperedRoleInventory),
      }

      const result = reconcileGoldImportCompensationContract(input)

      expect(result.ready).toBe(false)
      expect(result.deploymentProfile.passed).toBe(false)
      expect(result.deploymentProfile.violations.join('\n')).toContain(
        'requires the exact checksum-pinned Supabase role inventory',
      )
    }
  })

  test('fails closed for an arbitrary owner', async () => {
    const input = await localInput()
    let changed = false
    input.actualIdentity = withRecords(input.actualIdentity, (record) => {
      if (changed || record.objectType !== 'function') return record
      changed = true
      return {
        ...record,
        owner: 'arbitrary_owner',
        state: { ...record.state, owner: 'arbitrary_owner' },
      }
    })

    const result = reconcileGoldImportCompensationContract(input)

    expect(result.ready).toBe(false)
    expect(result.deploymentProfile.passed).toBe(false)
    expect(result.classificationCounts.security_contract_difference).toBeGreaterThan(0)
  })

  test('fails PUBLIC, anon, or authenticated effective execution', async () => {
    const input = await localInput()
    input.actualRpcs = input.actualRpcs.map((rpc, index) =>
      index === 0
        ? {
            ...rpc,
            explicitGrants: [
              ...rpc.explicitGrants,
              {
                grantee: 'PUBLIC',
                grantor: 'postgres',
                privilegeType: 'EXECUTE',
                isGrantable: false,
              },
            ],
            effectiveExecute: { ...rpc.effectiveExecute, PUBLIC: true },
          }
        : rpc,
    )

    const result = reconcileGoldImportCompensationContract(input)

    expect(result.ready).toBe(false)
    expect(result.deploymentProfile.violations.join('\n')).toContain(
      'grants effective execution to PUBLIC',
    )
    expect(result.rpcDiffs[0]?.classification).toBe('security_contract_difference')
  })

  test('fails broader service_role table privileges', async () => {
    const input = await localInput()
    let changed = false
    input.actualIdentity = withRecords(input.actualIdentity, (record) => {
      if (
        changed ||
        record.objectType !== 'effective_table_privilege' ||
        record.state.roleName !== 'service_role' ||
        record.state.granted !== false
      ) {
        return record
      }
      changed = true
      const normalizedDefinition = `role=service_role;privilege=${String(
        record.state.privilegeName,
      )};granted=true`
      return changedDefinition(record, normalizedDefinition, { ...record.state, granted: true })
    })

    const result = reconcileGoldImportCompensationContract(input)

    expect(changed).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.invariantIdentityMatches).toBe(false)
    expect(result.classificationCounts.security_contract_difference).toBeGreaterThan(0)
  })

  test('classifies changed search_path as a security contract difference', async () => {
    const input = await localInput()
    input.actualRpcs = input.actualRpcs.map((rpc, index) =>
      index === 0
        ? {
            ...rpc,
            searchPath: {
              ...rpc.searchPath,
              actual: 'public, pg_catalog',
              matchesExpected: false,
            },
          }
        : rpc,
    )

    const result = reconcileGoldImportCompensationContract(input)

    expect(result.ready).toBe(false)
    expect(result.invariantIdentityMatches).toBe(false)
    expect(result.rpcDiffs[0]?.classification).toBe('security_contract_difference')
    expect(result.deploymentProfile.violations.join('\n')).toContain('exact safe search_path')
  })

  test('classifies a changed function body as a semantic contract difference', async () => {
    const input = await localInput()
    input.actualRpcs = input.actualRpcs.map((rpc, index) => {
      if (index !== 0) return rpc
      const normalizedDefinition = `${rpc.normalizedDefinition} changed_body_token`
      return {
        ...rpc,
        normalizedDefinition,
        rawDefinition: normalizedDefinition,
        definitionSha256: digest(normalizedDefinition),
        rawDefinitionSha256: digest(normalizedDefinition),
      }
    })

    const result = reconcileGoldImportCompensationContract(input)

    expect(result.ready).toBe(false)
    expect(result.rpcDiffs[0]?.classification).toBe('semantic_contract_difference')
  })

  test('classifies a changed RPC signature/default contract as semantic', async () => {
    const input = await localInput()
    input.actualRpcs = input.actualRpcs.map((rpc, index) =>
      index === 0
        ? {
            ...rpc,
            identityArguments: 'p_changed text',
            objectIdentity: `${rpc.schema}.${rpc.name}(p_changed text)`,
            argumentsWithDefaults: "p_changed text DEFAULT 'x'::text",
          }
        : rpc,
    )

    const result = reconcileGoldImportCompensationContract(input)

    expect(result.ready).toBe(false)
    expect(result.rpcDiffs[0]?.classification).toBe('semantic_contract_difference')
  })

  test('fails undeclared role-dependent ACL differences', async () => {
    const input = await localInput()
    input.actualRpcs = input.actualRpcs.map((rpc, index) =>
      index === 0
        ? {
            ...rpc,
            explicitGrants: [
              ...rpc.explicitGrants,
              {
                grantee: 'undeclared_role',
                grantor: 'postgres',
                privilegeType: 'EXECUTE',
                isGrantable: false,
              },
            ],
          }
        : rpc,
    )

    const result = reconcileGoldImportCompensationContract(input)

    expect(result.ready).toBe(false)
    expect(result.deploymentProfile.violations.join('\n')).toContain(
      'ACL references undeclared role undeclared_role',
    )
    expect(result.rpcDiffs[0]?.classification).toBe('security_contract_difference')
  })

  test('binds owner memberships exactly and rejects cross-target profile selection', async () => {
    const input = await localInput()
    input.actualProfile = {
      ...input.actualProfile,
      target: 'remote',
      roleInventory: input.actualProfile.roleInventory.map((role_) =>
        role_.roleName === 'postgres'
          ? {
              ...role_,
              effectiveMemberships: ['pg_database_owner', 'postgres'],
              memberOf: [
                {
                  adminOption: false,
                  grantor: 'supabase_admin',
                  inheritOption: true,
                  roleName: 'pg_database_owner',
                  setOption: true,
                },
              ],
            }
          : role_,
      ),
    }

    const result = reconcileGoldImportCompensationContract(input)

    expect(result.ready).toBe(false)
    expect(result.deploymentProfile.passed).toBe(false)
    expect(result.deploymentProfile.violations.join('\n')).toContain(
      'permitted only for target=local',
    )
    expect(result.deploymentProfile.violations.join('\n')).toContain(
      'role inventory or role attributes differ',
    )
  })

  test('records a declared audit-expectation defect without weakening readiness', async () => {
    const input = await localInput()
    const affected = input.expectedIdentity.records.find(
      (record) => record.objectType === 'table' && record.owner === 'supabase_admin',
    )
    expect(affected).toBeDefined()
    input.auditExpectationDefects = [
      {
        objectIdentity: affected?.objectIdentity ?? '',
        reason: 'Historical full-inventory expectation embedded the disposable owner.',
      },
    ]

    const result = reconcileGoldImportCompensationContract(input)

    expect(result.ready).toBe(true)
    expect(result.classificationCounts.audit_expectation_defect).toBe(1)
    expect(
      result.recordDiffs.find(
        ({ expectedObjectIdentity }) => expectedObjectIdentity === affected?.objectIdentity,
      )?.classification,
    ).toBe('audit_expectation_defect')
  })
})
