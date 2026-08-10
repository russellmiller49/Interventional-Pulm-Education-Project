import { createHash } from 'node:crypto'

import { GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES } from '../../src/features/literature/gold-set/import-compensation-v2'
import { canonicalJson } from './gold-import-compensation-migration-operations'
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
import {
  buildContractDiagnosticsSql,
  parseContractDiagnosticsOutput,
} from './gold-import-compensation-contract-diagnostics'
import {
  SCHEMA_SECURITY_FUNCTION_NAMES,
  buildSchemaSecurityDefinitionIdentity,
  normalizePostgresDefinition,
  type SchemaSecurityDefinitionIdentity,
  type SchemaSecurityDefinitionRecord,
} from './gold-import-compensation-rehearsal-evidence'
import { SECURITY_INTROSPECTION_SQL } from './rehearse-gold-import-compensation-db'
import { assertDerivedV2ReadinessPolicy } from './audit-gold-import-compensation-v2'

export const PROTECTED_V2_COMPLETE_CATALOG_AUDIT_SCHEMA_VERSION =
  'literature-gold-protected-v2-complete-catalog-audit/1.0.0' as const
export const PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD =
  'complete_read_only_catalog_identity' as const
export const PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL =
  'literature-gold-contract-v2-complete-catalog/1.0.0' as const
export const PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256 =
  '086e88fb63626c83fc64eca2e999558b188de7a79a1174a481693788318402c3' as const

export const PROTECTED_V2_CATALOG_TABLES = [
  'literature_gold_review_operation_actions',
  'literature_gold_review_operations',
  'literature_gold_set_batches',
  'literature_gold_set_events',
  'literature_gold_set_items',
  'literature_gold_set_review_drafts',
  'literature_gold_set_reviews',
] as const

export const V2_CONTRACT_FUNCTION_NAMES = [
  'apply_literature_gold_import_v2',
  'compensate_literature_gold_import_v2',
  'enforce_literature_gold_operation_contract_v2',
  'enforce_literature_gold_review_contract_v2',
  'literature_gold_effective_state_hash_v2',
  'literature_gold_physical_state_hash_v2',
  'literature_gold_review_clinical_projection_v2',
  'literature_gold_review_operation_receipt_v2',
  'literature_gold_review_operation_result_v2',
  'reconcile_literature_gold_review_operation_v2',
  'validate_literature_gold_import_review_payload_v2',
  'validate_literature_gold_operation_authorization_v2',
  'validate_literature_gold_operation_plan_v2',
] as const

export const V2_TRANSITION_FUNCTION_NAMES = [
  'apply_literature_gold_import_v2',
  'compensate_literature_gold_import_v2',
  'reconcile_literature_gold_review_operation_v2',
] as const

export const PROTECTED_V2_AUDIT_COMPONENT_NAMES = [
  'columns',
  'constraints',
  'functionsRpcsDependencies',
  'indexes',
  'rlsPolicies',
  'tableAclEffectivePrivileges',
  'triggers',
] as const

export type ProtectedV2AuditComponentName = (typeof PROTECTED_V2_AUDIT_COMPONENT_NAMES)[number]

export const PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES = [
  ...new Set([...SCHEMA_SECURITY_FUNCTION_NAMES, ...V2_CONTRACT_FUNCTION_NAMES]),
].sort(compareCodeUnits)
const EXPECTED_RECORD_COUNTS = {
  columns: 150,
  constraints: 96,
  functions: 37,
  indexes: 34,
  policies: 2,
  tables: 7,
  triggers: 24,
} as const
const EXPECTED_FULL_ENVIRONMENT_INVENTORY_RECORD_COUNT = 823 as const
const REQUIRED_GENERATED_COLUMN = 'literature_gold_set_reviews.operation_contract_version' as const
const REQUIRED_GENERATED_DISCRIMINATOR_SEMANTICS =
  "case when revision_kind = 'standard' then null when operation_contract_version_code = 1 then 'gold-review-import-compensation/1.0.0' when operation_contract_version_code = 2 then 'gold-review-import-compensation/2.0.0' else null end" as const

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function array(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => record(entry, `${label}[${index}]`))
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a nonempty string.`)
  }
  return value
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`)
  return value
}

function generatedDiscriminatorSemantics(expression: string): string {
  return normalizePostgresDefinition(expression)
    .replaceAll(/::(?:pg_catalog\.)?text/giu, '')
    .replaceAll(/[()]/gu, '')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US')
}

function functionRecord(identity: SchemaSecurityDefinitionIdentity, name: string) {
  const matches = identity.records.filter(
    (entry) => entry.objectType === 'function' && entry.objectName === name,
  )
  if (matches.length !== 1) {
    throw new Error(`V2 schema identity has no unique function record for ${name}.`)
  }
  return matches[0]!
}

export function v2SecurityIntrospectionSql(): string {
  const startMarker = 'contract_functions(name) as (\n'
  const endMarker = '\n),\nfunctions as ('
  const start = SECURITY_INTROSPECTION_SQL.indexOf(startMarker)
  const end = SECURITY_INTROSPECTION_SQL.indexOf(endMarker, start + startMarker.length)
  if (start < 0 || end < 0) {
    throw new Error('V1 security introspection no longer has the expected function inventory CTE.')
  }
  const replacement = `contract_functions(name) as (\n  values ${PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES.map(
    (name) => `('${name}')`,
  ).join(',\n    ')}`
  return `${SECURITY_INTROSPECTION_SQL.slice(0, start)}${replacement}${SECURITY_INTROSPECTION_SQL.slice(end)}`
}

export function renderOwnerFirstFunctionRawAclV2(
  owner: string,
  grants: readonly RpcAclEntry[],
): string {
  const ordered = [...grants].sort((left, right) => {
    const leftOwnerRank = left.grantee === owner ? 0 : 1
    const rightOwnerRank = right.grantee === owner ? 0 : 1
    if (leftOwnerRank !== rightOwnerRank) return leftOwnerRank - rightOwnerRank
    return compareCodeUnits(canonicalJson(left), canonicalJson(right))
  })
  return `{${ordered.map(({ grantee, grantor }) => `${grantee}=X/${grantor}`).join(',')}}`
}

export function enrichedV2TransitionMetadata(
  identity: SchemaSecurityDefinitionIdentity,
  dependenciesByFunction?: ReadonlyMap<string, EnrichedRpcMetadata['dependencies']>,
): EnrichedRpcMetadata[] {
  return V2_TRANSITION_FUNCTION_NAMES.map((name): EnrichedRpcMetadata => {
    const function_ = functionRecord(identity, name)
    const state = record(function_.state, `${name} function state`)
    const identityArguments = requiredString(state.identityArguments, `${name} identity arguments`)
    const owner = requiredString(state.owner, `${name} owner`)
    const searchPath = requiredString(state.searchPath, `${name} search path`)
    const securityDefiner = boolean(state.securityDefiner, `${name} security definer`)
    const grants = identity.records
      .filter(
        (entry) =>
          entry.objectType === 'function_acl' &&
          entry.objectName === name &&
          record(entry.state, `${name} ACL state`).identityArguments === identityArguments,
      )
      .map((entry) => {
        const grant = record(entry.state, `${name} ACL state`)
        return {
          grantee: requiredString(grant.grantee, `${name} ACL grantee`),
          grantor: requiredString(grant.grantor, `${name} ACL grantor`),
          isGrantable: boolean(grant.isGrantable, `${name} ACL grantable`),
          privilegeType: requiredString(grant.privilegeType, `${name} ACL privilege`),
        }
      })
    const canExecute = (role: string) =>
      grants.some(({ grantee, privilegeType }) => grantee === role && privilegeType === 'EXECUTE')
    const volatility = requiredString(state.volatility, `${name} volatility`)
    const normalizedDefinition = function_.normalizedDefinition
    const dependencies = dependenciesByFunction?.get(name) ?? [
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
    ]
    return {
      argumentsWithDefaults: identityArguments,
      configuration: [`search_path=${searchPath}`],
      definitionSha256: function_.definitionSha256,
      dependencies,
      effectiveExecute: {
        PUBLIC: canExecute('PUBLIC'),
        anon: canExecute('anon'),
        authenticated: canExecute('authenticated'),
        service_role: canExecute('service_role'),
      },
      explicitGrants: grants,
      identityArguments,
      language: 'plpgsql',
      name,
      normalizedDefinition,
      objectIdentity: `public.${name}(${identityArguments})`,
      overloadCount: 1,
      owner,
      parallelSafety: 'unsafe',
      rawAcl: renderOwnerFirstFunctionRawAclV2(owner, grants),
      rawDefinition: normalizedDefinition,
      rawDefinitionSha256: sha256(normalizedDefinition),
      resultType: requiredString(state.resultType, `${name} result type`),
      routineKind: 'function',
      schema: 'public',
      searchPath: {
        actual: searchPath,
        entries: [`search_path=${searchPath}`],
        expected: 'pg_catalog, public, extensions',
        matchesExpected: searchPath === 'pg_catalog, public, extensions',
      },
      securityDefiner,
      securityMode: securityDefiner ? 'definer' : 'invoker',
      volatility: volatility === 'i' ? 'immutable' : volatility === 's' ? 'stable' : 'volatile',
    }
  })
}

const TABLE_VALUES_SQL = PROTECTED_V2_CATALOG_TABLES.map((name) => `('${name}')`).join(',\n    ')
const FUNCTION_VALUES_SQL = PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES.map(
  (name) => `('${name}')`,
).join(',\n    ')

/** PostgreSQL 17-compatible, read-only detail projection supplementing the reviewed identity. */
export const PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL = String.raw`
with contract_tables(table_name) as (
  values ${TABLE_VALUES_SQL}
), contract_functions(function_name) as (
  values ${FUNCTION_VALUES_SQL}
), scoped_tables as (
  select class.oid, class.relname as table_name, owner.rolname as owner,
    class.relrowsecurity as rls_enabled, class.relforcerowsecurity as force_rls,
    coalesce(class.relacl::text, pg_catalog.acldefault('r', class.relowner)::text) as raw_acl
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  join pg_catalog.pg_roles as owner on owner.oid = class.relowner
  where namespace.nspname = 'public'
    and class.relname in (select table_name from contract_tables)
), columns as (
  select table_record.table_name, attribute.attname as column_name,
    attribute.attnum::integer as ordinal_position,
    pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) as postgres_type,
    attribute.attnotnull as not_null,
    case when attribute.attgenerated = '' then pg_catalog.pg_get_expr(default_record.adbin, default_record.adrelid) else null end as default_expression,
    case when attribute.attgenerated <> '' then pg_catalog.pg_get_expr(default_record.adbin, default_record.adrelid) else null end as generated_expression,
    attribute.attgenerated::text as generated_behavior,
    attribute.attidentity::text as identity_behavior,
    case when attribute.attcollation = 0 or attribute.attcollation = type_record.typcollation then null
      else pg_catalog.format('%I.%I', collation_namespace.nspname, collation_record.collname) end as explicit_collation
  from scoped_tables as table_record
  join pg_catalog.pg_attribute as attribute on attribute.attrelid = table_record.oid
  join pg_catalog.pg_type as type_record on type_record.oid = attribute.atttypid
  left join pg_catalog.pg_attrdef as default_record
    on default_record.adrelid = attribute.attrelid and default_record.adnum = attribute.attnum
  left join pg_catalog.pg_collation as collation_record on collation_record.oid = attribute.attcollation
  left join pg_catalog.pg_namespace as collation_namespace on collation_namespace.oid = collation_record.collnamespace
  where attribute.attnum > 0 and not attribute.attisdropped
), constraints as (
  select table_record.table_name, constraint_record.conname as constraint_name,
    constraint_record.contype::text as constraint_type,
    constraint_record.condeferrable as deferrable,
    constraint_record.condeferred as initially_deferred,
    constraint_record.convalidated as validated,
    constraint_record.conkey::text as constrained_attribute_numbers,
    constraint_record.confkey::text as referenced_attribute_numbers,
    case when constraint_record.confrelid = 0 then null else constraint_record.confrelid::pg_catalog.regclass::text end as referenced_relation,
    case when constraint_record.conindid = 0 then null else constraint_record.conindid::pg_catalog.regclass::text end as backing_index,
    pg_catalog.pg_get_constraintdef(constraint_record.oid, true) as definition
  from scoped_tables as table_record
  join pg_catalog.pg_constraint as constraint_record on constraint_record.conrelid = table_record.oid
  where constraint_record.contype <> 't'
), indexes as (
  select table_record.table_name, index_class.relname as index_name,
    index_record.indisunique as unique, index_record.indisprimary as primary,
    index_record.indisvalid as valid, index_record.indisready as ready,
    index_record.indislive as live, access_method.amname as access_method,
    pg_catalog.pg_get_expr(index_record.indpred, index_record.indrelid, true) as predicate,
    pg_catalog.pg_get_indexdef(index_record.indexrelid, 0, true) as definition
  from scoped_tables as table_record
  join pg_catalog.pg_index as index_record on index_record.indrelid = table_record.oid
  join pg_catalog.pg_class as index_class on index_class.oid = index_record.indexrelid
  join pg_catalog.pg_am as access_method on access_method.oid = index_class.relam
), triggers as (
  select table_record.table_name, trigger_record.tgname as trigger_name,
    trigger_record.tgenabled::text as enabled_state,
    trigger_record.tgtype::integer as trigger_type_mask,
    pg_catalog.format('%I.%I(%s)', function_namespace.nspname, function_record.proname,
      pg_catalog.pg_get_function_identity_arguments(function_record.oid)) as function_identity,
    pg_catalog.pg_get_triggerdef(trigger_record.oid, true) as definition
  from scoped_tables as table_record
  join pg_catalog.pg_trigger as trigger_record on trigger_record.tgrelid = table_record.oid
  join pg_catalog.pg_proc as function_record on function_record.oid = trigger_record.tgfoid
  join pg_catalog.pg_namespace as function_namespace on function_namespace.oid = function_record.pronamespace
  where not trigger_record.tgisinternal
), policies as (
  select table_record.table_name, policy_record.polname as policy_name,
    policy_record.polpermissive as permissive, policy_record.polcmd::text as command,
    array(select case when role_oid = 0 then 'PUBLIC' else role_record.rolname end
      from unnest(policy_record.polroles) as role_oid
      left join pg_catalog.pg_roles as role_record on role_record.oid = role_oid
      order by case when role_oid = 0 then 'PUBLIC' else role_record.rolname end collate "C") as roles,
    pg_catalog.pg_get_expr(policy_record.polqual, policy_record.polrelid, true) as using_expression,
    pg_catalog.pg_get_expr(policy_record.polwithcheck, policy_record.polrelid, true) as with_check_expression
  from scoped_tables as table_record
  join pg_catalog.pg_policy as policy_record on policy_record.polrelid = table_record.oid
), privilege_roles(role_name) as (
  select role_name from (values ('PUBLIC'), ('anon'), ('authenticated'), ('service_role'),
    ('postgres'), ('supabase_admin'), ('authenticator'), ('supabase_auth_admin'),
    ('supabase_storage_admin')) as roles(role_name)
  where role_name = 'PUBLIC' or exists (select 1 from pg_catalog.pg_roles where rolname = role_name)
), privilege_names(privilege_name) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
), table_privileges as (
  select table_record.table_name, role_record.role_name, privilege_record.privilege_name,
    case when role_record.role_name = 'PUBLIC' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(class_record.relacl,
        pg_catalog.acldefault('r', class_record.relowner))) as acl
      where acl.grantee = 0 and acl.privilege_type = privilege_record.privilege_name
    ) else pg_catalog.has_table_privilege(role_record.role_name, class_record.oid,
      privilege_record.privilege_name) end as granted
  from scoped_tables as table_record
  join pg_catalog.pg_class as class_record on class_record.oid = table_record.oid
  cross join privilege_roles as role_record
  cross join privilege_names as privilege_record
), functions as (
  select function_record.oid, function_record.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(function_record.oid) as identity_arguments,
    pg_catalog.pg_get_function_arguments(function_record.oid) as arguments_with_defaults,
    pg_catalog.pg_get_function_result(function_record.oid) as result_type,
    owner.rolname as owner, language_record.lanname as language,
    function_record.prokind::text as routine_kind,
    function_record.provolatile::text as volatility,
    function_record.proparallel::text as parallel_safety,
    function_record.prosecdef as security_definer,
    coalesce(function_record.proconfig, array[]::text[]) as configuration,
    coalesce(function_record.proacl::text,
      pg_catalog.acldefault('f', function_record.proowner)::text) as raw_acl,
    pg_catalog.pg_get_functiondef(function_record.oid) as definition
  from pg_catalog.pg_proc as function_record
  join pg_catalog.pg_namespace as namespace on namespace.oid = function_record.pronamespace
  join pg_catalog.pg_roles as owner on owner.oid = function_record.proowner
  join pg_catalog.pg_language as language_record on language_record.oid = function_record.prolang
  where namespace.nspname = 'public'
    and function_record.proname in (select function_name from contract_functions)
), function_dependencies as (
  select function_record.function_name, function_record.identity_arguments,
    dependency_record.refclassid::pg_catalog.regclass::text as referenced_class,
    pg_catalog.pg_describe_object(dependency_record.refclassid,
      dependency_record.refobjid, dependency_record.refobjsubid) as referenced_identity,
    dependency_record.deptype::text as dependency_type
  from functions as function_record
  join pg_catalog.pg_depend as dependency_record
    on dependency_record.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
   and dependency_record.objid = function_record.oid
)
select pg_catalog.jsonb_build_object(
  'readOnly', current_setting('transaction_read_only')::boolean,
  'isolation', current_setting('transaction_isolation'),
  'currentUser', current_user,
  'serverVersionNum', current_setting('server_version_num'),
  'tables', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row) - 'oid'
    order by row.table_name collate "C") from scoped_tables as row), '[]'::jsonb),
  'columns', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row)
    order by row.table_name collate "C", row.ordinal_position) from columns as row), '[]'::jsonb),
  'constraints', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row)
    order by row.table_name collate "C", row.constraint_name collate "C") from constraints as row), '[]'::jsonb),
  'indexes', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row)
    order by row.table_name collate "C", row.index_name collate "C") from indexes as row), '[]'::jsonb),
  'triggers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row)
    order by row.table_name collate "C", row.trigger_name collate "C") from triggers as row), '[]'::jsonb),
  'policies', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row)
    order by row.table_name collate "C", row.policy_name collate "C") from policies as row), '[]'::jsonb),
  'tablePrivileges', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row)
    order by row.table_name collate "C", row.role_name collate "C", row.privilege_name collate "C")
    from table_privileges as row), '[]'::jsonb),
  'functions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row) - 'oid'
    order by row.function_name collate "C", row.identity_arguments collate "C") from functions as row), '[]'::jsonb),
  'functionDependencies', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row)
    order by row.function_name collate "C", row.identity_arguments collate "C",
      row.referenced_class collate "C", row.referenced_identity collate "C", row.dependency_type collate "C")
    from function_dependencies as row), '[]'::jsonb)
);`

export interface ProtectedV2CompleteCatalogAuditIdentity {
  auditMethod: typeof PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD
  auditModel: typeof PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL
  auditModelIdentitySha256: string
  componentIdentities: Record<ProtectedV2AuditComponentName, string>
  environmentInvariantIdentitySha256: string
  fullAuditIdentitySha256: string
  fullEnvironmentInventoryIdentitySha256: string
  fullEnvironmentInventoryRecordCount: number
  localPostgresOwnerProfileIdentitySha256: string
  schemaVersion: typeof PROTECTED_V2_COMPLETE_CATALOG_AUDIT_SCHEMA_VERSION
  verifierExecuted: false
}

export function validateProtectedV2CompleteCatalogAuditIdentity(
  input: unknown,
): ProtectedV2CompleteCatalogAuditIdentity {
  const identity = record(input, 'Protected V2 complete catalog audit identity')
  const expectedKeys = [
    'auditMethod',
    'auditModel',
    'auditModelIdentitySha256',
    'componentIdentities',
    'environmentInvariantIdentitySha256',
    'fullAuditIdentitySha256',
    'fullEnvironmentInventoryIdentitySha256',
    'fullEnvironmentInventoryRecordCount',
    'localPostgresOwnerProfileIdentitySha256',
    'schemaVersion',
    'verifierExecuted',
  ].sort(compareCodeUnits)
  if (canonicalJson(Object.keys(identity).sort(compareCodeUnits)) !== canonicalJson(expectedKeys)) {
    throw new Error('Protected V2 complete catalog audit identity keys drifted.')
  }
  const components = record(identity.componentIdentities, 'catalog audit component identities')
  if (
    canonicalJson(Object.keys(components).sort(compareCodeUnits)) !==
    canonicalJson([...PROTECTED_V2_AUDIT_COMPONENT_NAMES].sort(compareCodeUnits))
  ) {
    throw new Error('Protected V2 complete catalog component identity inventory drifted.')
  }
  const hashes = {
    ...components,
    auditModelIdentitySha256: identity.auditModelIdentitySha256,
    environmentInvariantIdentitySha256: identity.environmentInvariantIdentitySha256,
    fullAuditIdentitySha256: identity.fullAuditIdentitySha256,
    fullEnvironmentInventoryIdentitySha256: identity.fullEnvironmentInventoryIdentitySha256,
    localPostgresOwnerProfileIdentitySha256: identity.localPostgresOwnerProfileIdentitySha256,
  }
  if (
    Object.values(hashes).some(
      (value) => typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value),
    )
  ) {
    throw new Error('Protected V2 complete catalog audit contains a malformed identity hash.')
  }
  const { fullAuditIdentitySha256, ...content } = identity
  if (
    identity.schemaVersion !== PROTECTED_V2_COMPLETE_CATALOG_AUDIT_SCHEMA_VERSION ||
    identity.auditMethod !== PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD ||
    identity.auditModel !== PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL ||
    identity.auditModelIdentitySha256 !==
      PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256 ||
    identity.environmentInvariantIdentitySha256 !==
      PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256 ||
    identity.fullEnvironmentInventoryRecordCount !==
      EXPECTED_FULL_ENVIRONMENT_INVENTORY_RECORD_COUNT ||
    identity.verifierExecuted !== false ||
    reconciliationIdentitySha256(content) !== fullAuditIdentitySha256
  ) {
    throw new Error('Protected V2 complete catalog audit identity is inconsistent or drifted.')
  }
  return identity as unknown as ProtectedV2CompleteCatalogAuditIdentity
}

const AUDIT_MODEL_CONTENT = {
  auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
  auditModel: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL,
  componentNames: PROTECTED_V2_AUDIT_COMPONENT_NAMES,
  contractDiagnosticsSqlSha256: sha256(buildContractDiagnosticsSql()),
  detailSqlSha256: sha256(PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL),
  expectedInvariantIdentitySha256: PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256,
  expectedFullEnvironmentInventoryRecordCount: EXPECTED_FULL_ENVIRONMENT_INVENTORY_RECORD_COUNT,
  expectedRecordCounts: EXPECTED_RECORD_COUNTS,
  functionNames: PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES,
  localProfileId: 'local_supabase_postgres_owner_v1',
  requiredGeneratedDiscriminatorSemantics: REQUIRED_GENERATED_DISCRIMINATOR_SEMANTICS,
  securityIntrospectionSqlSha256: sha256(v2SecurityIntrospectionSql()),
  tableNames: PROTECTED_V2_CATALOG_TABLES,
  verifierExecuted: false,
} as const

export const PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256 =
  reconciliationIdentitySha256(AUDIT_MODEL_CONTENT)

function recordsOfTypes(
  identity: SchemaSecurityDefinitionIdentity,
  objectTypes: readonly string[],
): SchemaSecurityDefinitionRecord[] {
  const types = new Set(objectTypes)
  return identity.records.filter(({ objectType }) => types.has(objectType))
}

export function validateProtectedV2CompleteCatalogDetails(
  detailsInput: unknown,
  profile: 'local' | 'disposable_clone',
): Record<string, unknown> {
  const details = record(detailsInput, 'Protected V2 complete catalog details')
  if (details.readOnly !== true || details.isolation !== 'repeatable read') {
    throw new Error('Protected V2 complete catalog details escaped REPEATABLE READ READ ONLY.')
  }
  const tables = array(details.tables, 'catalog details.tables')
  const columns = array(details.columns, 'catalog details.columns')
  const constraints = array(details.constraints, 'catalog details.constraints')
  const indexes = array(details.indexes, 'catalog details.indexes')
  const triggers = array(details.triggers, 'catalog details.triggers')
  const policies = array(details.policies, 'catalog details.policies')
  const functions = array(details.functions, 'catalog details.functions')
  const dependencies = array(details.functionDependencies, 'catalog details.functionDependencies')
  const tablePrivileges = array(details.tablePrivileges, 'catalog details.tablePrivileges')
  if (
    tables.length !== EXPECTED_RECORD_COUNTS.tables ||
    columns.length !== EXPECTED_RECORD_COUNTS.columns ||
    constraints.length !== EXPECTED_RECORD_COUNTS.constraints ||
    indexes.length !== EXPECTED_RECORD_COUNTS.indexes ||
    triggers.length !== EXPECTED_RECORD_COUNTS.triggers ||
    policies.length !== EXPECTED_RECORD_COUNTS.policies ||
    functions.length !== EXPECTED_RECORD_COUNTS.functions ||
    tablePrivileges.length === 0
  ) {
    throw new Error('Protected V2 complete catalog inventory count drifted.')
  }
  const expectedOwner = profile === 'local' ? 'postgres' : 'supabase_admin'
  if (
    tables.some(
      (table) =>
        table.owner !== expectedOwner ||
        table.rls_enabled !== true ||
        typeof table.force_rls !== 'boolean' ||
        typeof table.raw_acl !== 'string',
    )
  ) {
    throw new Error('Protected V2 table owner, RLS, FORCE RLS, or raw ACL state drifted.')
  }
  const generated = columns.filter((column) => column.generated_behavior !== '')
  const generatedColumn = generated[0]
  const normalizedGeneratedExpression =
    typeof generatedColumn?.generated_expression === 'string'
      ? normalizePostgresDefinition(generatedColumn.generated_expression)
      : ''
  if (
    generated.length !== 1 ||
    `${generatedColumn?.table_name}.${generatedColumn?.column_name}` !==
      REQUIRED_GENERATED_COLUMN ||
    generatedColumn.generated_behavior !== 's' ||
    generatedDiscriminatorSemantics(normalizedGeneratedExpression) !==
      REQUIRED_GENERATED_DISCRIMINATOR_SEMANTICS ||
    columns.some(
      (column) =>
        column.identity_behavior !== '' ||
        column.explicit_collation !== null ||
        typeof column.postgres_type !== 'string' ||
        typeof column.not_null !== 'boolean',
    )
  ) {
    throw new Error('Protected V2 column generated/identity/collation contract drifted.')
  }
  if (constraints.some((constraint) => constraint.validated !== true)) {
    throw new Error('Protected V2 contains an unvalidated required constraint.')
  }
  if (
    indexes.some((index) => index.valid !== true || index.ready !== true || index.live !== true)
  ) {
    throw new Error('Protected V2 contains an invalid, unready, or non-live required index.')
  }
  if (
    triggers.some(
      (trigger) =>
        trigger.enabled_state !== 'O' ||
        typeof trigger.trigger_type_mask !== 'number' ||
        typeof trigger.function_identity !== 'string' ||
        typeof trigger.definition !== 'string',
    )
  ) {
    throw new Error('Protected V2 required trigger inventory is disabled or malformed.')
  }
  if (functions.some((function_) => function_.owner !== expectedOwner)) {
    throw new Error('Protected V2 function owner profile drifted.')
  }
  if (
    functions.some(
      (function_) =>
        !['plpgsql', 'sql'].includes(String(function_.language)) ||
        function_.parallel_safety !== 'u' ||
        function_.routine_kind !== 'f' ||
        typeof function_.definition !== 'string' ||
        typeof function_.raw_acl !== 'string',
    )
  ) {
    throw new Error('Protected V2 function language, parallel safety, kind, body, or ACL drifted.')
  }
  const observedFunctionNames = functions.map(({ function_name }) => String(function_name)).sort()
  if (
    canonicalJson(observedFunctionNames) !==
    canonicalJson(PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES)
  ) {
    throw new Error('Protected V2 complete function inventory or overload set drifted.')
  }
  const functionsByIdentity = new Map(
    functions.map((function_) => [
      `${String(function_.function_name)}\0${String(function_.identity_arguments)}`,
      function_,
    ]),
  )
  if (functionsByIdentity.size !== functions.length) {
    throw new Error('Protected V2 complete function inventory contains a duplicate identity.')
  }
  const dependencyIdentities = new Map<string, string[]>()
  for (const dependency of dependencies) {
    const key = `${String(dependency.function_name)}\0${String(dependency.identity_arguments)}`
    if (!functionsByIdentity.has(key)) {
      throw new Error('Protected V2 function dependency references an undeclared overload.')
    }
    const values = dependencyIdentities.get(key) ?? []
    values.push(
      canonicalJson({
        dependencyType: dependency.dependency_type,
        referencedClass: dependency.referenced_class,
        referencedIdentity: dependency.referenced_identity,
      }),
    )
    dependencyIdentities.set(key, values)
  }
  const expectedDependenciesByIdentity = new Map(
    [...functionsByIdentity].map(([key, function_]) => {
      const expected = [
        ...(function_.language === 'sql'
          ? []
          : [
              canonicalJson({
                dependencyType: 'n',
                referencedClass: 'pg_language',
                referencedIdentity: `language ${String(function_.language)}`,
              }),
            ]),
        canonicalJson({
          dependencyType: 'n',
          referencedClass: 'pg_namespace',
          referencedIdentity: 'schema public',
        }),
      ].sort(compareCodeUnits)
      return [key, expected] as const
    }),
  )
  const dependenciesExact = [...expectedDependenciesByIdentity].every(([key, expected]) => {
    return (
      canonicalJson((dependencyIdentities.get(key) ?? []).sort(compareCodeUnits)) ===
      canonicalJson(expected)
    )
  })
  const expectedDependencyCount = [...expectedDependenciesByIdentity.values()].reduce(
    (count, expected) => count + expected.length,
    0,
  )
  if (!dependenciesExact || dependencies.length !== expectedDependencyCount) {
    throw new Error('Protected V2 function dependency inventory is not the exact declared set.')
  }
  return details
}

export function buildProtectedV2CompleteCatalogAuditIdentity(input: {
  details: unknown
  diagnostics: {
    functions: EnrichedRpcMetadata[]
    roles: DeploymentProfileEvidence['roleInventory']
  }
  profile: 'local' | 'disposable_clone'
  securityIntrospection: unknown
}): ProtectedV2CompleteCatalogAuditIdentity {
  const details = validateProtectedV2CompleteCatalogDetails(input.details, input.profile)
  const schemaIdentity = buildSchemaSecurityDefinitionIdentity(input.securityIntrospection)
  const rpcMetadata = [
    ...input.diagnostics.functions,
    // Keep this deployment-invariant projection byte-compatible with the independently pinned
    // rehearsal identity. The complete pg_depend inventory remains validation- and hash-bound in
    // the functions/RPCs/dependencies component below.
    ...enrichedV2TransitionMetadata(schemaIdentity),
  ]
  const deploymentProfileEvidence: DeploymentProfileEvidence = {
    profileId:
      input.profile === 'local' ? 'local_supabase_postgres_owner_v1' : 'supabase_admin_owner_v1',
    roleInventory: input.diagnostics.roles,
    target: input.profile === 'local' ? 'local' : 'disposable',
  }
  const supportedProfile = SUPPORTED_DEPLOYMENT_PROFILES[deploymentProfileEvidence.profileId]
  if (
    reconciliationIdentitySha256(deploymentProfileEvidence.roleInventory) !==
    supportedProfile.roleInventorySha256
  ) {
    throw new Error('Protected V2 complete catalog audit deployment-role inventory drifted.')
  }
  assertDerivedV2ReadinessPolicy({
    auditTarget: input.profile,
    deploymentProfileEvidence,
    rpcMetadata,
    schemaSecurityDefinitionIdentity: schemaIdentity,
  })
  const invariantIdentity = buildContractInvariantIdentity(schemaIdentity, rpcMetadata)
  const environmentInvariantIdentitySha256 = reconciliationIdentitySha256(invariantIdentity)
  if (environmentInvariantIdentitySha256 !== PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256) {
    throw new Error(
      `Protected V2 environment-invariant catalog identity drifted: ${environmentInvariantIdentitySha256}.`,
    )
  }
  const profileIdentity = buildDeploymentProfileIdentity(
    schemaIdentity,
    rpcMetadata,
    deploymentProfileEvidence,
  )
  const fullInventory = buildFullEnvironmentInventoryIdentity(
    schemaIdentity,
    rpcMetadata,
    deploymentProfileEvidence,
  )
  const componentInputs: Record<ProtectedV2AuditComponentName, unknown> = {
    columns: {
      details: details.columns,
      records: recordsOfTypes(schemaIdentity, ['column', 'column_acl']),
    },
    constraints: {
      details: details.constraints,
      records: recordsOfTypes(schemaIdentity, ['constraint']),
    },
    functionsRpcsDependencies: {
      dependencies: details.functionDependencies,
      details: details.functions,
      records: recordsOfTypes(schemaIdentity, ['function', 'function_acl']),
      rpcMetadata,
    },
    indexes: { details: details.indexes, records: recordsOfTypes(schemaIdentity, ['index']) },
    rlsPolicies: {
      details: { policies: details.policies, tables: details.tables },
      records: recordsOfTypes(schemaIdentity, ['policy', 'table']),
    },
    tableAclEffectivePrivileges: {
      details: { tablePrivileges: details.tablePrivileges, tables: details.tables },
      records: recordsOfTypes(schemaIdentity, [
        'column_acl',
        'effective_schema_create_privilege',
        'effective_table_privilege',
        'schema_acl',
        'table_acl',
      ]),
    },
    triggers: { details: details.triggers, records: recordsOfTypes(schemaIdentity, ['trigger']) },
  }
  const componentIdentities = Object.fromEntries(
    PROTECTED_V2_AUDIT_COMPONENT_NAMES.map((name) => [
      name,
      reconciliationIdentitySha256(componentInputs[name]),
    ]),
  ) as Record<ProtectedV2AuditComponentName, string>
  const identityContent = {
    auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
    auditModel: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL,
    auditModelIdentitySha256: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256,
    componentIdentities,
    environmentInvariantIdentitySha256,
    fullEnvironmentInventoryIdentitySha256: reconciliationIdentitySha256(fullInventory),
    fullEnvironmentInventoryRecordCount: schemaIdentity.records.length,
    localPostgresOwnerProfileIdentitySha256: reconciliationIdentitySha256(profileIdentity),
    schemaVersion: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_SCHEMA_VERSION,
    verifierExecuted: false as const,
  }
  return validateProtectedV2CompleteCatalogAuditIdentity({
    ...identityContent,
    fullAuditIdentitySha256: reconciliationIdentitySha256(identityContent),
  })
}

export interface ProtectedV2CatalogAuditQueryContext {
  psql(sql: string): Promise<{ stdout: string }>
  queryJson(sql: string): Promise<unknown>
}

/**
 * The single production collector used by disposable rehearsal, drift probes,
 * and the protected real-local post-application audit. All three catalog
 * snapshots are independently forced through REPEATABLE READ READ ONLY.
 */
export async function collectProtectedV2CompleteCatalogAudit(input: {
  context: ProtectedV2CatalogAuditQueryContext
  profile: 'local' | 'disposable_clone'
}): Promise<ProtectedV2CompleteCatalogAuditIdentity> {
  const [diagnosticsResult, securityIntrospection, details] = await Promise.all([
    input.context.psql(buildContractDiagnosticsSql()),
    input.context.queryJson(
      `begin transaction isolation level repeatable read read only;\nset local statement_timeout = '120s';\n${v2SecurityIntrospectionSql()}\nrollback;`,
    ),
    input.context.queryJson(
      `begin transaction isolation level repeatable read read only;\nset local statement_timeout = '120s';\n${PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL}\nrollback;`,
    ),
  ])
  const diagnostics = parseContractDiagnosticsOutput(diagnosticsResult.stdout)
  return buildProtectedV2CompleteCatalogAuditIdentity({
    details,
    diagnostics,
    profile: input.profile,
    securityIntrospection,
  })
}

// Keeps the exact expected V2 function bodies in this audit module's sealed import closure.
void GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES
