/** @jest-environment node */

import {
  CONTRACT_DIAGNOSTICS_MARKER,
  CONTRACT_DIAGNOSTIC_RPC_NAMES,
  EXPECTED_CONTRACT_SEARCH_PATH,
  REQUESTED_RECONCILIATION_NAME_DISCREPANCY,
  assertContractDiagnosticsSql,
  buildContractDiagnosticsSql,
  collectContractDiagnostics,
  parseContractDiagnosticsOutput,
} from './gold-import-compensation-contract-diagnostics'
import {
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  type CommandRunner,
} from './gold-import-compensation-migration-operations'

const IDENTITY_ARGUMENTS = {
  apply_literature_gold_import_v1:
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  compensate_literature_gold_import_v1:
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  reconcile_literature_gold_review_operation_v1:
    'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
} as const

interface RawRoleFixture {
  attributes: Record<string, unknown> | null
  effectiveMemberships: string[]
  exists: boolean
  memberOf: Array<Record<string, unknown>>
  members: Array<Record<string, unknown>>
  roleName: string
}

function role(roleName: string, overrides: Partial<RawRoleFixture> = {}): RawRoleFixture {
  return {
    attributes: {
      bypassRls: roleName === 'postgres' || roleName === 'service_role',
      canLogin: roleName === 'postgres',
      connectionLimit: -1,
      createDb: roleName === 'postgres',
      createRole: roleName === 'postgres',
      inherit: true,
      replication: roleName === 'postgres',
      superuser: roleName === 'postgres',
      validUntil: null,
    },
    effectiveMemberships: [roleName],
    exists: true,
    memberOf: [],
    members: [],
    roleName,
    ...overrides,
  }
}

function functionRecord(name: (typeof CONTRACT_DIAGNOSTIC_RPC_NAMES)[number]) {
  const identityArguments = IDENTITY_ARGUMENTS[name]
  const argumentsWithDefaults =
    name === 'reconcile_literature_gold_review_operation_v1'
      ? identityArguments
      : `${identityArguments.slice(0, identityArguments.lastIndexOf(', p_actor_user_id'))}, p_actor_user_id uuid DEFAULT NULL::uuid, p_actor_email text DEFAULT NULL::text`
  return {
    argumentsWithDefaults,
    configuration: [`search_path=${EXPECTED_CONTRACT_SEARCH_PATH}`],
    dependencies: [
      {
        dependencyType: 'n',
        referencedClass: 'pg_language',
        referencedIdentity: 'language plpgsql',
      },
      {
        dependencyType: 'n',
        referencedClass: 'pg_namespace',
        referencedIdentity: 'schema public',
      },
    ],
    effectiveExecute: {
      PUBLIC: false,
      anon: false,
      authenticated: false,
      service_role: true,
    },
    exists: true,
    explicitGrants: [
      {
        grantee: 'postgres',
        grantor: 'postgres',
        isGrantable: false,
        privilegeType: 'EXECUTE',
      },
      {
        grantee: 'service_role',
        grantor: 'postgres',
        isGrantable: false,
        privilegeType: 'EXECUTE',
      },
    ],
    identityArguments,
    language: 'plpgsql',
    name,
    objectIdentity: `public.${name}(${identityArguments})`,
    overloadCount: 1,
    owner: 'postgres',
    parallelSafety: 'unsafe',
    rawAcl: '{postgres=X/postgres,service_role=X/postgres}',
    rawDefinition: `CREATE OR REPLACE FUNCTION public.${name}(${identityArguments})
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$ begin return '{}'::jsonb; end; $function$`,
    resultType: 'jsonb',
    routineKind: 'function',
    schema: 'public',
    searchPathEntries: [`search_path=${EXPECTED_CONTRACT_SEARCH_PATH}`],
    securityDefiner: true,
    securityMode: 'definer',
    volatility: name === 'reconcile_literature_gold_review_operation_v1' ? 'stable' : 'volatile',
  }
}

function rawResult() {
  return {
    functions: CONTRACT_DIAGNOSTIC_RPC_NAMES.map(functionRecord),
    readOnlyTransaction: true,
    roles: ['anon', 'authenticated', 'postgres', 'service_role', 'supabase_admin'].map((name) =>
      role(name),
    ),
    transactionIsolation: 'repeatable read',
  }
}

function output(value: unknown = rawResult()) {
  return `${CONTRACT_DIAGNOSTICS_MARKER}${JSON.stringify(value)}\n`
}

describe('gold import-compensation contract diagnostics', () => {
  it('builds only a repeatable-read, read-only, rollback-terminated catalog query', () => {
    const sql = buildContractDiagnosticsSql()

    expect(() => assertContractDiagnosticsSql(sql)).not.toThrow()
    expect(sql).toMatch(/^begin transaction isolation level repeatable read read only;/iu)
    expect(sql).toMatch(/rollback;$/iu)
    expect(sql).toContain('pg_catalog.pg_proc')
    expect(sql).toContain('pg_catalog.pg_roles')
    expect(sql).toContain('pg_catalog.pg_auth_members')
    expect(sql).toContain('pg_catalog.pg_depend')
    expect(sql).not.toMatch(
      /\b(?:insert|update|delete|truncate|alter|create|drop|grant|revoke|merge|copy)\b/iu,
    )
    expect(sql).not.toMatch(/literature_gold_set_(?:items|reviews|events)|\bpmid\b/iu)
    expect(() => assertContractDiagnosticsSql(`${sql}\nupdate public.example set x = 1;`)).toThrow(
      /mutation/iu,
    )
  })

  it('pins deterministic aggregate ordering and only the three canonical RPC names', () => {
    const sql = buildContractDiagnosticsSql()

    for (const name of CONTRACT_DIAGNOSTIC_RPC_NAMES) {
      expect(sql.match(new RegExp(name, 'gu'))).toHaveLength(1)
    }
    expect(sql).not.toContain(REQUESTED_RECONCILIATION_NAME_DISCREPANCY.requestedName)
    expect(sql.match(/jsonb_agg\([\s\S]*?order by/giu)?.length).toBeGreaterThanOrEqual(6)

    const parsed = parseContractDiagnosticsOutput(output())
    expect(parsed.functions.map(({ name }) => name)).toEqual(CONTRACT_DIAGNOSTIC_RPC_NAMES)
    expect(parsed.requestedNameDiscrepancies).toEqual([
      {
        aliasCreated: false,
        canonicalName: 'reconcile_literature_gold_review_operation_v1',
        classification: 'audit_expectation_defect',
        requestedName: 'reconcile_literature_gold_import_v1',
      },
    ])
  })

  it('validates exact owner attributes, memberships, ACLs, definitions, and dependencies', () => {
    const value = rawResult()
    const postgres = value.roles.find((entry) => entry.roleName === 'postgres')
    if (!postgres) throw new Error('fixture owner role is missing')
    postgres.memberOf = [
      {
        adminOption: false,
        grantor: 'postgres',
        inheritOption: true,
        roleName: 'pg_database_owner',
        setOption: true,
      },
    ]
    postgres.effectiveMemberships = ['pg_database_owner', 'postgres']

    const parsed = parseContractDiagnosticsOutput(output(value))
    const apply = parsed.functions[0]
    expect(apply?.owner).toBe('postgres')
    expect(apply?.definitionSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(apply?.rawDefinitionSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(apply?.searchPath).toEqual({
      actual: EXPECTED_CONTRACT_SEARCH_PATH,
      entries: [`search_path=${EXPECTED_CONTRACT_SEARCH_PATH}`],
      expected: EXPECTED_CONTRACT_SEARCH_PATH,
      matchesExpected: true,
    })
    expect(apply?.dependencies.map(({ referencedClass }) => referencedClass)).toEqual([
      'pg_language',
      'pg_namespace',
    ])
    expect(parsed.roles.find(({ roleName }) => roleName === 'postgres')).toMatchObject({
      attributes: {
        bypassRls: true,
        superuser: true,
      },
      effectiveMemberships: ['pg_database_owner', 'postgres'],
      memberOf: [{ roleName: 'pg_database_owner' }],
    })
  })

  it('rejects unsorted or malformed role, membership, grant, and dependency state', () => {
    const malformedAttributes = rawResult()
    const postgres = malformedAttributes.roles.find((entry) => entry.roleName === 'postgres')
    if (!postgres || !postgres.attributes) throw new Error('fixture owner role is missing')
    Reflect.deleteProperty(postgres.attributes, 'bypassRls')
    expect(() => parseContractDiagnosticsOutput(output(malformedAttributes))).toThrow(
      /attributes must contain exactly/iu,
    )

    const unsortedDependencies = rawResult()
    unsortedDependencies.functions[0].dependencies.reverse()
    expect(() => parseContractDiagnosticsOutput(output(unsortedDependencies))).toThrow(
      /dependencies must be deterministically sorted/iu,
    )

    const unsortedRoles = rawResult()
    unsortedRoles.roles.reverse()
    expect(() => parseContractDiagnosticsOutput(output(unsortedRoles))).toThrow(
      /roles must be deterministically sorted/iu,
    )
  })

  it('rejects missing, duplicate, malformed, and incomplete database results', () => {
    expect(() => parseContractDiagnosticsOutput('')).toThrow(/marker was missing/iu)
    expect(() => parseContractDiagnosticsOutput(`${output()}${output()}`)).toThrow(
      /marker was missing or duplicated/iu,
    )
    expect(() => parseContractDiagnosticsOutput(`${CONTRACT_DIAGNOSTICS_MARKER}{bad}\n`)).toThrow(
      /invalid JSON/iu,
    )

    const missingFunction = rawResult()
    missingFunction.functions.pop()
    expect(() => parseContractDiagnosticsOutput(output(missingFunction))).toThrow(
      /exact canonical RPC set/iu,
    )

    const missingOwner = rawResult()
    const missingOwnerRole = missingOwner.roles.find((entry) => entry.roleName === 'postgres')
    if (!missingOwnerRole) throw new Error('fixture owner role is missing')
    missingOwnerRole.exists = false
    missingOwnerRole.attributes = null
    missingOwnerRole.effectiveMemberships = []
    expect(() => parseContractDiagnosticsOutput(output(missingOwner))).toThrow(
      /missing exact owner-role state/iu,
    )
  })

  it('executes only against the exact healthy local container with guarded Docker state', async () => {
    const runCommand = jest.fn<ReturnType<CommandRunner>, Parameters<CommandRunner>>(
      async (_command, arguments_, options) => {
        if (arguments_.includes('inspect')) {
          return {
            stderr: '',
            stdout: `/${DEFAULT_LOCAL_DATABASE_CONTAINER}|true|${LOCAL_DATABASE_PORT}|${LOCAL_SUPABASE_PROJECT_ID}\n`,
          }
        }
        if (arguments_.includes('exec')) {
          expect(arguments_).toContain(DEFAULT_LOCAL_DATABASE_CONTAINER)
          expect(arguments_).not.toContain('supabase_db_other')
          expect(options?.stdin).toMatch(
            /^begin transaction isolation level repeatable read read only;/iu,
          )
          expect(options?.stdin).toMatch(/rollback;$/iu)
          return { stderr: '', stdout: output() }
        }
        throw new Error(`unexpected command: ${arguments_.join(' ')}`)
      },
    )

    const result = await collectContractDiagnostics({
      environment: { DOCKER_HOST: 'unix:///var/run/docker.sock' },
      runCommand,
    })

    expect(result.target).toEqual({
      container: DEFAULT_LOCAL_DATABASE_CONTAINER,
      database: 'postgres',
      local: true,
      port: LOCAL_DATABASE_PORT,
      projectId: LOCAL_SUPABASE_PROJECT_ID,
    })
    expect(runCommand).toHaveBeenCalledTimes(2)

    await expect(
      collectContractDiagnostics({ container: 'supabase_db_other', runCommand }),
    ).rejects.toThrow(/Local-only target guard/iu)
    await expect(
      collectContractDiagnostics({
        environment: { DOCKER_HOST: 'tcp://remote.example:2376' },
        runCommand,
      }),
    ).rejects.toThrow(/non-local endpoint/iu)
    expect(runCommand).toHaveBeenCalledTimes(2)
  })
})
