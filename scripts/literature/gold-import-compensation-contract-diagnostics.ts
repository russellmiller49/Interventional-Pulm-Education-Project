import {
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  assertLocalDatabaseContainer,
  assertLocalDatabaseHealthy,
  assertReadOnlySnapshotSql,
  defaultCommandRunner,
  resolveLocalDockerTarget,
  sha256,
  type CommandRunner,
  type LocalDockerTarget,
  type OperationalEnvironment,
} from './gold-import-compensation-migration-operations'
import { normalizePostgresDefinition } from './gold-import-compensation-rehearsal-evidence'

export const CONTRACT_DIAGNOSTICS_SCHEMA_VERSION =
  'gold-import-compensation-contract-diagnostics/1.0.0'
export const CONTRACT_DIAGNOSTICS_MARKER = 'GOLD_IMPORT_COMPENSATION_CONTRACT_DIAGNOSTICS_JSON:'
export const CONTRACT_DIAGNOSTICS_NORMALIZATION_RULE =
  'postgres-function-definition-conservative-whitespace/v1'
export const EXPECTED_CONTRACT_SEARCH_PATH = 'pg_catalog, public, extensions'

export const CONTRACT_DIAGNOSTIC_RPC_NAMES = [
  'apply_literature_gold_import_v1',
  'compensate_literature_gold_import_v1',
  'reconcile_literature_gold_review_operation_v1',
] as const

export type ContractDiagnosticRpcName = (typeof CONTRACT_DIAGNOSTIC_RPC_NAMES)[number]

export const REQUESTED_RECONCILIATION_NAME_DISCREPANCY = {
  aliasCreated: false,
  canonicalName: 'reconcile_literature_gold_review_operation_v1',
  classification: 'audit_expectation_defect',
  requestedName: 'reconcile_literature_gold_import_v1',
} as const

const REQUIRED_RELEVANT_ROLES = [
  'anon',
  'authenticated',
  'postgres',
  'service_role',
  'supabase_admin',
] as const

const CONTRACT_DIAGNOSTICS_MUTATION_PATTERN =
  /\b(?:merge|vacuum|reindex|cluster|refresh|discard|lock)\b/iu
const HELD_OUT_IDENTITY_PATTERN =
  /\b(?:literature_gold_set_(?:items|reviews|review_drafts|events|batches)|pmid|dataset_split|held[_ -]?out|test[_ -]?(?:split|identity|item))\b/iu

interface RoleAttributes {
  bypassRls: boolean
  canLogin: boolean
  connectionLimit: number
  createDb: boolean
  createRole: boolean
  inherit: boolean
  replication: boolean
  superuser: boolean
  validUntil: string | null
}

interface RoleMembership {
  adminOption: boolean
  grantor: string
  inheritOption: boolean
  roleName: string
  setOption: boolean
}

interface RoleMember {
  adminOption: boolean
  grantor: string
  inheritOption: boolean
  memberName: string
  setOption: boolean
}

export interface ContractDiagnosticRole {
  attributes: RoleAttributes | null
  effectiveMemberships: string[]
  exists: boolean
  memberOf: RoleMembership[]
  members: RoleMember[]
  roleName: string
}

export interface ContractFunctionExplicitGrant {
  grantee: string
  grantor: string
  isGrantable: boolean
  privilegeType: string
}

export interface ContractFunctionDependency {
  dependencyType: string
  referencedClass: string
  referencedIdentity: string
}

export interface ContractFunctionDiagnostic {
  argumentsWithDefaults: string
  configuration: string[]
  definitionSha256: string
  dependencies: ContractFunctionDependency[]
  effectiveExecute: {
    PUBLIC: boolean
    anon: boolean
    authenticated: boolean
    service_role: boolean
  }
  explicitGrants: ContractFunctionExplicitGrant[]
  identityArguments: string
  language: string
  name: ContractDiagnosticRpcName
  normalizedDefinition: string
  objectIdentity: string
  overloadCount: number
  owner: string
  parallelSafety: 'restricted' | 'safe' | 'unsafe'
  rawAcl: string | null
  rawDefinition: string
  rawDefinitionSha256: string
  resultType: string
  routineKind: 'aggregate' | 'function' | 'procedure' | 'window'
  schema: 'public'
  searchPath: {
    actual: string | null
    entries: string[]
    expected: typeof EXPECTED_CONTRACT_SEARCH_PATH
    matchesExpected: boolean
  }
  securityDefiner: boolean
  securityMode: 'definer' | 'invoker'
  volatility: 'immutable' | 'stable' | 'volatile'
}

export interface ParsedContractDiagnostics {
  canonicalRpcNames: readonly ContractDiagnosticRpcName[]
  functions: ContractFunctionDiagnostic[]
  normalizationRule: typeof CONTRACT_DIAGNOSTICS_NORMALIZATION_RULE
  readOnlyTransaction: true
  requestedNameDiscrepancies: readonly [typeof REQUESTED_RECONCILIATION_NAME_DISCREPANCY]
  roles: ContractDiagnosticRole[]
  schemaVersion: typeof CONTRACT_DIAGNOSTICS_SCHEMA_VERSION
  transactionIsolation: 'repeatable read'
}

export interface ExecutedContractDiagnostics extends ParsedContractDiagnostics {
  target: {
    container: typeof DEFAULT_LOCAL_DATABASE_CONTAINER
    database: 'postgres'
    local: true
    port: typeof LOCAL_DATABASE_PORT
    projectId: typeof LOCAL_SUPABASE_PROJECT_ID
  }
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  const actual = Object.keys(value).sort(compareCodeUnits)
  const wanted = [...expected].sort(compareCodeUnits)
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} must contain exactly: ${wanted.join(', ')}.`)
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a nonempty string.`)
  }
  return value
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`)
  return value
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an integer.`)
  return value as number
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label)
}

function assertSorted<T>(values: readonly T[], key: (value: T) => string, label: string) {
  const keys = values.map(key)
  const sorted = [...keys].sort(compareCodeUnits)
  if (JSON.stringify(keys) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must be deterministically sorted.`)
  }
  if (new Set(keys).size !== keys.length) throw new Error(`${label} contains a duplicate.`)
}

function dockerEnvironment(target: LocalDockerTarget): NodeJS.ProcessEnv {
  const environment = { ...target.environment }
  if (target.context) environment.DOCKER_CONTEXT = target.context
  else environment.DOCKER_HOST = target.endpoint
  return environment
}

export function buildContractDiagnosticsSql(): string {
  const requestedFunctions = CONTRACT_DIAGNOSTIC_RPC_NAMES.map(
    (name, index) => `(${index + 1}, ${sqlLiteral(name)})`,
  ).join(',\n      ')
  const requestedRoles = REQUIRED_RELEVANT_ROLES.map((name) => `(${sqlLiteral(name)})`).join(
    ',\n      ',
  )

  const sql = String.raw`
begin transaction isolation level repeatable read read only;
set local statement_timeout = '120s';
with
requested_functions(requested_ordinal, function_name) as (
  values ${requestedFunctions}
),
requested_roles(role_name) as (
  values ${requestedRoles}
),
public_namespace as (
  select namespace.oid
  from pg_catalog.pg_namespace as namespace
  where namespace.nspname = 'public'
),
function_catalog as (
  select requested.requested_ordinal,
    requested.function_name as requested_name,
    proc.oid,
    proc.proowner,
    count(proc.oid) over (partition by requested.function_name)::integer as overload_count,
    namespace.nspname as schema_name,
    proc.proname as function_name,
    case proc.prokind
      when 'f' then 'function'
      when 'p' then 'procedure'
      when 'a' then 'aggregate'
      when 'w' then 'window'
      else null
    end as routine_kind,
    pg_catalog.pg_get_function_identity_arguments(proc.oid) as identity_arguments,
    pg_catalog.pg_get_function_arguments(proc.oid) as arguments_with_defaults,
    pg_catalog.pg_get_function_result(proc.oid) as result_type,
    owner.rolname as owner,
    language.lanname as language,
    case proc.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      when 'v' then 'volatile'
      else null
    end as volatility,
    case proc.proparallel
      when 's' then 'safe'
      when 'r' then 'restricted'
      when 'u' then 'unsafe'
      else null
    end as parallel_safety,
    proc.prosecdef as security_definer,
    case when proc.prosecdef then 'definer' else 'invoker' end as security_mode,
    proc.proacl::text as raw_acl,
    coalesce((
      select pg_catalog.jsonb_agg(setting order by setting collate "C")
      from unnest(coalesce(proc.proconfig, array[]::text[])) as setting
    ), '[]'::jsonb) as configuration,
    pg_catalog.pg_get_functiondef(proc.oid) as raw_definition
  from requested_functions as requested
  cross join public_namespace
  left join pg_catalog.pg_proc as proc
    on proc.pronamespace = public_namespace.oid
   and proc.proname = requested.function_name
  left join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
  left join pg_catalog.pg_roles as owner on owner.oid = proc.proowner
  left join pg_catalog.pg_language as language on language.oid = proc.prolang
),
function_owners(role_name) as (
  select distinct catalog.owner
  from function_catalog as catalog
  where catalog.owner is not null
),
role_scope(role_name) as (
  select role_name from requested_roles
  union
  select role_name from function_owners
)
select ${sqlLiteral(CONTRACT_DIAGNOSTICS_MARKER)} || pg_catalog.jsonb_build_object(
  'readOnlyTransaction', current_setting('transaction_read_only')::boolean,
  'transactionIsolation', current_setting('transaction_isolation'),
  'roles', (
    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'roleName', scope.role_name,
        'exists', role_record.oid is not null,
        'attributes', case when role_record.oid is null then null else pg_catalog.jsonb_build_object(
          'superuser', role_record.rolsuper,
          'inherit', role_record.rolinherit,
          'createRole', role_record.rolcreaterole,
          'createDb', role_record.rolcreatedb,
          'canLogin', role_record.rolcanlogin,
          'replication', role_record.rolreplication,
          'bypassRls', role_record.rolbypassrls,
          'connectionLimit', role_record.rolconnlimit,
          'validUntil', role_record.rolvaliduntil::text
        ) end,
        'memberOf', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'roleName', parent.rolname,
            'grantor', coalesce(grantor.rolname, '<unknown>'),
            'adminOption', membership.admin_option,
            'inheritOption', membership.inherit_option,
            'setOption', membership.set_option
          ) order by parent.rolname collate "C", coalesce(grantor.rolname, '<unknown>') collate "C")
          from pg_catalog.pg_auth_members as membership
          join pg_catalog.pg_roles as parent on parent.oid = membership.roleid
          left join pg_catalog.pg_roles as grantor on grantor.oid = membership.grantor
          where membership.member = role_record.oid
        ), '[]'::jsonb),
        'members', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'memberName', member.rolname,
            'grantor', coalesce(grantor.rolname, '<unknown>'),
            'adminOption', membership.admin_option,
            'inheritOption', membership.inherit_option,
            'setOption', membership.set_option
          ) order by member.rolname collate "C", coalesce(grantor.rolname, '<unknown>') collate "C")
          from pg_catalog.pg_auth_members as membership
          join pg_catalog.pg_roles as member on member.oid = membership.member
          left join pg_catalog.pg_roles as grantor on grantor.oid = membership.grantor
          where membership.roleid = role_record.oid
        ), '[]'::jsonb),
        'effectiveMemberships', coalesce((
          select pg_catalog.jsonb_agg(candidate.rolname order by candidate.rolname collate "C")
          from pg_catalog.pg_roles as candidate
          where role_record.oid is not null
            and pg_catalog.pg_has_role(role_record.oid, candidate.oid, 'MEMBER')
        ), '[]'::jsonb)
      ) order by scope.role_name collate "C"), '[]'::jsonb)
    from role_scope as scope
    left join pg_catalog.pg_roles as role_record on role_record.rolname = scope.role_name
  ),
  'functions', (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'exists', catalog.oid is not null,
      'schema', catalog.schema_name,
      'name', catalog.requested_name,
      'objectIdentity', case when catalog.oid is null then null else
        pg_catalog.format('%I.%I(%s)', catalog.schema_name, catalog.function_name,
          catalog.identity_arguments)
        end,
      'overloadCount', catalog.overload_count,
      'routineKind', catalog.routine_kind,
      'owner', catalog.owner,
      'language', catalog.language,
      'volatility', catalog.volatility,
      'parallelSafety', catalog.parallel_safety,
      'securityDefiner', catalog.security_definer,
      'securityMode', catalog.security_mode,
      'identityArguments', catalog.identity_arguments,
      'argumentsWithDefaults', catalog.arguments_with_defaults,
      'resultType', catalog.result_type,
      'rawAcl', catalog.raw_acl,
      'configuration', catalog.configuration,
      'searchPathEntries', coalesce((
        select pg_catalog.jsonb_agg(setting order by setting collate "C")
        from unnest(coalesce((select proc.proconfig from pg_catalog.pg_proc as proc
          where proc.oid = catalog.oid), array[]::text[])) as setting
        where setting like 'search_path=%'
      ), '[]'::jsonb),
      'explicitGrants', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantee', coalesce(grantee.rolname, 'PUBLIC'),
          'grantor', coalesce(grantor.rolname, '<unknown>'),
          'privilegeType', acl.privilege_type,
          'isGrantable', acl.is_grantable
        ) order by coalesce(grantee.rolname, 'PUBLIC') collate "C",
          acl.privilege_type collate "C", coalesce(grantor.rolname, '<unknown>') collate "C")
        from pg_catalog.pg_proc as proc
        cross join lateral pg_catalog.aclexplode(proc.proacl) as acl
        left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
        left join pg_catalog.pg_roles as grantor on grantor.oid = acl.grantor
        where proc.oid = catalog.oid
      ), '[]'::jsonb),
      'effectiveExecute', pg_catalog.jsonb_build_object(
        'PUBLIC', coalesce((
          select exists(
            select 1 from pg_catalog.aclexplode(coalesce(
              proc.proacl, pg_catalog.acldefault('f', proc.proowner)
            )) as acl
            where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
          ) from pg_catalog.pg_proc as proc where proc.oid = catalog.oid
        ), false),
        'anon', coalesce((select pg_catalog.has_function_privilege(
          role_record.oid, catalog.oid, 'EXECUTE')
          from pg_catalog.pg_roles as role_record where role_record.rolname = 'anon'), false),
        'authenticated', coalesce((select pg_catalog.has_function_privilege(
          role_record.oid, catalog.oid, 'EXECUTE')
          from pg_catalog.pg_roles as role_record where role_record.rolname = 'authenticated'), false),
        'service_role', coalesce((select pg_catalog.has_function_privilege(
          role_record.oid, catalog.oid, 'EXECUTE')
          from pg_catalog.pg_roles as role_record where role_record.rolname = 'service_role'), false)
      ),
      'dependencies', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'referencedClass', dependency.refclassid::pg_catalog.regclass::text,
          'referencedIdentity', pg_catalog.pg_describe_object(
            dependency.refclassid, dependency.refobjid, dependency.refobjsubid),
          'dependencyType', dependency.deptype
        ) order by dependency.refclassid::pg_catalog.regclass::text collate "C",
          pg_catalog.pg_describe_object(
            dependency.refclassid, dependency.refobjid, dependency.refobjsubid) collate "C",
          dependency.deptype)
        from pg_catalog.pg_depend as dependency
        where dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          and dependency.objid = catalog.oid
      ), '[]'::jsonb),
      'rawDefinition', catalog.raw_definition
    ) order by catalog.requested_ordinal,
      coalesce(catalog.identity_arguments, '') collate "C"), '[]'::jsonb)
    from function_catalog as catalog
  )
)::text;
rollback;
`.trim()

  assertContractDiagnosticsSql(sql)
  return sql
}

export function assertContractDiagnosticsSql(sql: string): void {
  assertReadOnlySnapshotSql(sql)
  if (!/^begin transaction isolation level repeatable read read only;/iu.test(sql.trimStart())) {
    throw new Error('Contract diagnostics must use REPEATABLE READ READ ONLY explicitly.')
  }
  if (!/rollback;\s*$/iu.test(sql) || (sql.match(/\brollback\s*;/giu) ?? []).length !== 1) {
    throw new Error('Contract diagnostics must terminate with exactly one ROLLBACK.')
  }
  if (CONTRACT_DIAGNOSTICS_MUTATION_PATTERN.test(sql)) {
    throw new Error('Contract diagnostics SQL contains a forbidden state-changing command.')
  }
  if (HELD_OUT_IDENTITY_PATTERN.test(sql)) {
    throw new Error('Contract diagnostics SQL must not reference literature rows or identities.')
  }
  const requestedNames = CONTRACT_DIAGNOSTIC_RPC_NAMES.filter((name) => sql.includes(name))
  if (requestedNames.length !== CONTRACT_DIAGNOSTIC_RPC_NAMES.length) {
    throw new Error('Contract diagnostics SQL is missing a canonical RPC name.')
  }
  if (sql.includes(REQUESTED_RECONCILIATION_NAME_DISCREPANCY.requestedName)) {
    throw new Error('The audit-expectation-defect name must never be queried as an alias.')
  }
}

function parseRoleMembership(value: unknown, label: string): RoleMembership {
  const parsed = record(value, label)
  exactKeys(parsed, ['adminOption', 'grantor', 'inheritOption', 'roleName', 'setOption'], label)
  return {
    adminOption: boolean(parsed.adminOption, `${label}.adminOption`),
    grantor: string(parsed.grantor, `${label}.grantor`),
    inheritOption: boolean(parsed.inheritOption, `${label}.inheritOption`),
    roleName: string(parsed.roleName, `${label}.roleName`),
    setOption: boolean(parsed.setOption, `${label}.setOption`),
  }
}

function parseRoleMember(value: unknown, label: string): RoleMember {
  const parsed = record(value, label)
  exactKeys(parsed, ['adminOption', 'grantor', 'inheritOption', 'memberName', 'setOption'], label)
  return {
    adminOption: boolean(parsed.adminOption, `${label}.adminOption`),
    grantor: string(parsed.grantor, `${label}.grantor`),
    inheritOption: boolean(parsed.inheritOption, `${label}.inheritOption`),
    memberName: string(parsed.memberName, `${label}.memberName`),
    setOption: boolean(parsed.setOption, `${label}.setOption`),
  }
}

function parseRole(value: unknown, index: number): ContractDiagnosticRole {
  const label = `contract diagnostics.roles[${index}]`
  const parsed = record(value, label)
  exactKeys(
    parsed,
    ['attributes', 'effectiveMemberships', 'exists', 'memberOf', 'members', 'roleName'],
    label,
  )
  const exists = boolean(parsed.exists, `${label}.exists`)
  let attributes: RoleAttributes | null = null
  if (exists) {
    const rawAttributes = record(parsed.attributes, `${label}.attributes`)
    exactKeys(
      rawAttributes,
      [
        'bypassRls',
        'canLogin',
        'connectionLimit',
        'createDb',
        'createRole',
        'inherit',
        'replication',
        'superuser',
        'validUntil',
      ],
      `${label}.attributes`,
    )
    attributes = {
      bypassRls: boolean(rawAttributes.bypassRls, `${label}.attributes.bypassRls`),
      canLogin: boolean(rawAttributes.canLogin, `${label}.attributes.canLogin`),
      connectionLimit: integer(
        rawAttributes.connectionLimit,
        `${label}.attributes.connectionLimit`,
      ),
      createDb: boolean(rawAttributes.createDb, `${label}.attributes.createDb`),
      createRole: boolean(rawAttributes.createRole, `${label}.attributes.createRole`),
      inherit: boolean(rawAttributes.inherit, `${label}.attributes.inherit`),
      replication: boolean(rawAttributes.replication, `${label}.attributes.replication`),
      superuser: boolean(rawAttributes.superuser, `${label}.attributes.superuser`),
      validUntil: nullableString(rawAttributes.validUntil, `${label}.attributes.validUntil`),
    }
  } else if (parsed.attributes !== null) {
    throw new Error(`${label}.attributes must be null when the role is absent.`)
  }
  const memberOf = array(parsed.memberOf, `${label}.memberOf`).map((entry, memberIndex) =>
    parseRoleMembership(entry, `${label}.memberOf[${memberIndex}]`),
  )
  const members = array(parsed.members, `${label}.members`).map((entry, memberIndex) =>
    parseRoleMember(entry, `${label}.members[${memberIndex}]`),
  )
  const effectiveMemberships = array(
    parsed.effectiveMemberships,
    `${label}.effectiveMemberships`,
  ).map((entry, membershipIndex) =>
    string(entry, `${label}.effectiveMemberships[${membershipIndex}]`),
  )
  assertSorted(memberOf, (entry) => `${entry.roleName}\0${entry.grantor}`, `${label}.memberOf`)
  assertSorted(members, (entry) => `${entry.memberName}\0${entry.grantor}`, `${label}.members`)
  assertSorted(effectiveMemberships, (entry) => entry, `${label}.effectiveMemberships`)
  if (!exists && (memberOf.length > 0 || members.length > 0 || effectiveMemberships.length > 0)) {
    throw new Error(`${label} cannot have memberships when the role is absent.`)
  }
  return {
    attributes,
    effectiveMemberships,
    exists,
    memberOf,
    members,
    roleName: string(parsed.roleName, `${label}.roleName`),
  }
}

function parseGrant(value: unknown, label: string): ContractFunctionExplicitGrant {
  const parsed = record(value, label)
  exactKeys(parsed, ['grantee', 'grantor', 'isGrantable', 'privilegeType'], label)
  return {
    grantee: string(parsed.grantee, `${label}.grantee`),
    grantor: string(parsed.grantor, `${label}.grantor`),
    isGrantable: boolean(parsed.isGrantable, `${label}.isGrantable`),
    privilegeType: string(parsed.privilegeType, `${label}.privilegeType`),
  }
}

function parseDependency(value: unknown, label: string): ContractFunctionDependency {
  const parsed = record(value, label)
  exactKeys(parsed, ['dependencyType', 'referencedClass', 'referencedIdentity'], label)
  return {
    dependencyType: string(parsed.dependencyType, `${label}.dependencyType`),
    referencedClass: string(parsed.referencedClass, `${label}.referencedClass`),
    referencedIdentity: string(parsed.referencedIdentity, `${label}.referencedIdentity`),
  }
}

function parseFunction(value: unknown, index: number): ContractFunctionDiagnostic {
  const label = `contract diagnostics.functions[${index}]`
  const parsed = record(value, label)
  exactKeys(
    parsed,
    [
      'argumentsWithDefaults',
      'configuration',
      'dependencies',
      'effectiveExecute',
      'exists',
      'explicitGrants',
      'identityArguments',
      'language',
      'name',
      'objectIdentity',
      'overloadCount',
      'owner',
      'parallelSafety',
      'rawAcl',
      'rawDefinition',
      'resultType',
      'routineKind',
      'schema',
      'searchPathEntries',
      'securityDefiner',
      'securityMode',
      'volatility',
    ],
    label,
  )
  const name = string(parsed.name, `${label}.name`)
  if (!CONTRACT_DIAGNOSTIC_RPC_NAMES.includes(name as ContractDiagnosticRpcName)) {
    throw new Error(`${label}.name is not a canonical contract RPC.`)
  }
  if (!boolean(parsed.exists, `${label}.exists`)) {
    throw new Error(`Canonical contract RPC ${name} is missing.`)
  }
  const identityArguments = string(parsed.identityArguments, `${label}.identityArguments`)
  const objectIdentity = string(parsed.objectIdentity, `${label}.objectIdentity`)
  if (objectIdentity !== `public.${name}(${identityArguments})`) {
    throw new Error(`${label}.objectIdentity does not match its schema, name, and overload.`)
  }
  const rawDefinition = string(parsed.rawDefinition, `${label}.rawDefinition`)
  const normalizedDefinition = normalizePostgresDefinition(rawDefinition)
  if (!normalizedDefinition) throw new Error(`${label}.rawDefinition normalizes to empty.`)
  const configuration = array(parsed.configuration, `${label}.configuration`).map(
    (entry, configurationIndex) => string(entry, `${label}.configuration[${configurationIndex}]`),
  )
  assertSorted(configuration, (entry) => entry, `${label}.configuration`)
  const searchPathEntries = array(parsed.searchPathEntries, `${label}.searchPathEntries`).map(
    (entry, searchPathIndex) => string(entry, `${label}.searchPathEntries[${searchPathIndex}]`),
  )
  assertSorted(searchPathEntries, (entry) => entry, `${label}.searchPathEntries`)
  if (searchPathEntries.some((entry) => !entry.startsWith('search_path='))) {
    throw new Error(`${label}.searchPathEntries contains a non-search_path setting.`)
  }
  const actualSearchPath =
    searchPathEntries.length === 1 ? searchPathEntries[0].slice('search_path='.length) : null
  const explicitGrants = array(parsed.explicitGrants, `${label}.explicitGrants`).map(
    (entry, grantIndex) => parseGrant(entry, `${label}.explicitGrants[${grantIndex}]`),
  )
  assertSorted(
    explicitGrants,
    (entry) => `${entry.grantee}\0${entry.privilegeType}\0${entry.grantor}`,
    `${label}.explicitGrants`,
  )
  const dependencies = array(parsed.dependencies, `${label}.dependencies`).map(
    (entry, dependencyIndex) => parseDependency(entry, `${label}.dependencies[${dependencyIndex}]`),
  )
  assertSorted(
    dependencies,
    (entry) => `${entry.referencedClass}\0${entry.referencedIdentity}\0${entry.dependencyType}`,
    `${label}.dependencies`,
  )
  const effectiveExecuteRecord = record(parsed.effectiveExecute, `${label}.effectiveExecute`)
  exactKeys(
    effectiveExecuteRecord,
    ['PUBLIC', 'anon', 'authenticated', 'service_role'],
    `${label}.effectiveExecute`,
  )
  const volatility = string(parsed.volatility, `${label}.volatility`)
  if (!['immutable', 'stable', 'volatile'].includes(volatility)) {
    throw new Error(`${label}.volatility is invalid.`)
  }
  const parallelSafety = string(parsed.parallelSafety, `${label}.parallelSafety`)
  if (!['restricted', 'safe', 'unsafe'].includes(parallelSafety)) {
    throw new Error(`${label}.parallelSafety is invalid.`)
  }
  const routineKind = string(parsed.routineKind, `${label}.routineKind`)
  if (!['aggregate', 'function', 'procedure', 'window'].includes(routineKind)) {
    throw new Error(`${label}.routineKind is invalid.`)
  }
  const securityDefiner = boolean(parsed.securityDefiner, `${label}.securityDefiner`)
  const securityMode = string(parsed.securityMode, `${label}.securityMode`)
  if (
    !['definer', 'invoker'].includes(securityMode) ||
    (securityMode === 'definer') !== securityDefiner
  ) {
    throw new Error(`${label}.securityMode does not match securityDefiner.`)
  }
  if (parsed.schema !== 'public') throw new Error(`${label}.schema must be public.`)

  return {
    argumentsWithDefaults: string(parsed.argumentsWithDefaults, `${label}.argumentsWithDefaults`),
    configuration,
    definitionSha256: sha256(normalizedDefinition),
    dependencies,
    effectiveExecute: {
      PUBLIC: boolean(effectiveExecuteRecord.PUBLIC, `${label}.effectiveExecute.PUBLIC`),
      anon: boolean(effectiveExecuteRecord.anon, `${label}.effectiveExecute.anon`),
      authenticated: boolean(
        effectiveExecuteRecord.authenticated,
        `${label}.effectiveExecute.authenticated`,
      ),
      service_role: boolean(
        effectiveExecuteRecord.service_role,
        `${label}.effectiveExecute.service_role`,
      ),
    },
    explicitGrants,
    identityArguments,
    language: string(parsed.language, `${label}.language`),
    name: name as ContractDiagnosticRpcName,
    normalizedDefinition,
    objectIdentity,
    overloadCount: integer(parsed.overloadCount, `${label}.overloadCount`),
    owner: string(parsed.owner, `${label}.owner`),
    parallelSafety: parallelSafety as ContractFunctionDiagnostic['parallelSafety'],
    rawAcl: nullableString(parsed.rawAcl, `${label}.rawAcl`),
    rawDefinition,
    rawDefinitionSha256: sha256(rawDefinition),
    resultType: string(parsed.resultType, `${label}.resultType`),
    routineKind: routineKind as ContractFunctionDiagnostic['routineKind'],
    schema: 'public',
    searchPath: {
      actual: actualSearchPath,
      entries: searchPathEntries,
      expected: EXPECTED_CONTRACT_SEARCH_PATH,
      matchesExpected: actualSearchPath === EXPECTED_CONTRACT_SEARCH_PATH,
    },
    securityDefiner,
    securityMode: securityMode as ContractFunctionDiagnostic['securityMode'],
    volatility: volatility as ContractFunctionDiagnostic['volatility'],
  }
}

export function parseContractDiagnosticsOutput(output: string): ParsedContractDiagnostics {
  const lines = output
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(CONTRACT_DIAGNOSTICS_MARKER))
  if (lines.length !== 1) {
    throw new Error('Contract diagnostics result marker was missing or duplicated.')
  }
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(lines[0].slice(CONTRACT_DIAGNOSTICS_MARKER.length)) as unknown
  } catch (error) {
    throw new Error(
      `Contract diagnostics result was invalid JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
  const parsed = record(parsedJson, 'contract diagnostics result')
  exactKeys(
    parsed,
    ['functions', 'readOnlyTransaction', 'roles', 'transactionIsolation'],
    'contract diagnostics result',
  )
  if (parsed.readOnlyTransaction !== true) {
    throw new Error('Contract diagnostics did not attest a read-only transaction.')
  }
  if (parsed.transactionIsolation !== 'repeatable read') {
    throw new Error('Contract diagnostics did not attest REPEATABLE READ isolation.')
  }
  const roles = array(parsed.roles, 'contract diagnostics.roles').map(parseRole)
  assertSorted(roles, (entry) => entry.roleName, 'contract diagnostics.roles')
  const roleNames = new Set(roles.map(({ roleName }) => roleName))
  for (const roleName of REQUIRED_RELEVANT_ROLES) {
    if (!roleNames.has(roleName)) {
      throw new Error(`Contract diagnostics is missing relevant role ${roleName}.`)
    }
  }
  const functions = array(parsed.functions, 'contract diagnostics.functions').map(parseFunction)
  const rpcOrdinal = new Map(CONTRACT_DIAGNOSTIC_RPC_NAMES.map((name, index) => [name, index]))
  const sortedFunctions = [...functions].sort(
    (left, right) =>
      (rpcOrdinal.get(left.name) ?? Number.MAX_SAFE_INTEGER) -
        (rpcOrdinal.get(right.name) ?? Number.MAX_SAFE_INTEGER) ||
      compareCodeUnits(left.identityArguments, right.identityArguments),
  )
  if (
    JSON.stringify(functions.map(({ objectIdentity }) => objectIdentity)) !==
    JSON.stringify(sortedFunctions.map(({ objectIdentity }) => objectIdentity))
  ) {
    throw new Error('Contract diagnostics.functions must be deterministically sorted.')
  }
  const observedNames = [...new Set(functions.map(({ name }) => name))]
  if (JSON.stringify(observedNames) !== JSON.stringify(CONTRACT_DIAGNOSTIC_RPC_NAMES)) {
    throw new Error('Contract diagnostics does not contain the exact canonical RPC set.')
  }
  for (const name of CONTRACT_DIAGNOSTIC_RPC_NAMES) {
    const overloads = functions.filter((entry) => entry.name === name)
    if (overloads.some(({ overloadCount }) => overloadCount !== overloads.length)) {
      throw new Error(`Contract diagnostics overload count is inconsistent for ${name}.`)
    }
  }
  const rolesByName = new Map(roles.map((role) => [role.roleName, role]))
  for (const function_ of functions) {
    const owner = rolesByName.get(function_.owner)
    if (!owner?.exists || !owner.attributes) {
      throw new Error(
        `Contract diagnostics is missing exact owner-role state for ${function_.owner}.`,
      )
    }
  }
  return {
    canonicalRpcNames: CONTRACT_DIAGNOSTIC_RPC_NAMES,
    functions,
    normalizationRule: CONTRACT_DIAGNOSTICS_NORMALIZATION_RULE,
    readOnlyTransaction: true,
    requestedNameDiscrepancies: [REQUESTED_RECONCILIATION_NAME_DISCREPANCY],
    roles,
    schemaVersion: CONTRACT_DIAGNOSTICS_SCHEMA_VERSION,
    transactionIsolation: 'repeatable read',
  }
}

export async function collectContractDiagnostics(
  input: {
    container?: string
    dockerTarget?: LocalDockerTarget
    environment?: OperationalEnvironment
    runCommand?: CommandRunner
  } = {},
): Promise<ExecutedContractDiagnostics> {
  const container = input.container ?? DEFAULT_LOCAL_DATABASE_CONTAINER
  assertLocalDatabaseContainer(container)
  const runCommand = input.runCommand ?? defaultCommandRunner
  const dockerTarget =
    input.dockerTarget ??
    (await resolveLocalDockerTarget({
      environment: input.environment,
      runCommand,
    }))
  await assertLocalDatabaseHealthy(container, runCommand, dockerTarget)
  const sql = buildContractDiagnosticsSql()
  assertContractDiagnosticsSql(sql)
  const result = await runCommand(
    'docker',
    [
      ...dockerTarget.dockerArguments,
      'exec',
      '--interactive',
      container,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--tuples-only',
      '--no-align',
      '--quiet',
    ],
    { env: dockerEnvironment(dockerTarget), stdin: sql },
  )
  return {
    ...parseContractDiagnosticsOutput(result.stdout),
    target: {
      container: DEFAULT_LOCAL_DATABASE_CONTAINER,
      database: 'postgres',
      local: true,
      port: LOCAL_DATABASE_PORT,
      projectId: LOCAL_SUPABASE_PROJECT_ID,
    },
  }
}
