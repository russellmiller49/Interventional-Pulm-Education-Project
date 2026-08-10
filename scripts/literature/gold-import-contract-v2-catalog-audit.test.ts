/** @jest-environment node */

import {
  PROTECTED_V2_CATALOG_TABLES,
  PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL,
  PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES,
  validateProtectedV2CompleteCatalogDetails,
  v2SecurityIntrospectionSql,
} from './gold-import-contract-v2-catalog-audit'
import { CONTRACT_DIAGNOSTICS_MARKER } from './gold-import-compensation-contract-diagnostics'
import {
  TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256,
  reconciliationIdentitySha256,
} from './gold-import-compensation-contract-reconciliation'
import {
  PROTECTED_V2_CATALOG_DRIFT_PROBES,
  withTrustedLocalRoleInventoryProjection,
} from './rehearse-gold-import-contract-v2-catalog-drift-matrix'

interface CompleteCatalogFixture {
  columns: Array<{
    column_name: string
    default_expression: null
    explicit_collation: null
    generated_behavior: string
    generated_expression: string | null
    identity_behavior: string
    not_null: boolean
    ordinal_position: number
    postgres_type: string
    table_name: string
  }>
  constraints: Array<{ constraint_name: string; validated: boolean }>
  currentUser: string
  functionDependencies: Array<{
    dependency_type: string
    function_name: string
    identity_arguments: string
    referenced_class: string
    referenced_identity: string
  }>
  functions: Array<{
    arguments_with_defaults: string
    configuration: never[]
    definition: string
    function_name: string
    identity_arguments: string
    language: string
    owner: string
    parallel_safety: string
    raw_acl: string
    result_type: string
    routine_kind: string
    security_definer: boolean
    volatility: string
  }>
  indexes: Array<{ index_name: string; live: boolean; ready: boolean; valid: boolean }>
  isolation: string
  policies: Array<{ policy_name: string }>
  readOnly: boolean
  serverVersionNum: string
  tablePrivileges: Array<{ granted: boolean; privilege_name: string; role_name: string }>
  tables: Array<{
    force_rls: boolean
    owner: string
    raw_acl: string
    rls_enabled: boolean
    table_name: string
  }>
  triggers: Array<{
    definition: string
    enabled_state: string
    function_identity: string
    trigger_name: string
    trigger_type_mask: number
  }>
}

function completeDetails(): CompleteCatalogFixture {
  const functions = PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES.map((functionName) => ({
    arguments_with_defaults: '',
    configuration: [],
    definition: `create function public.${functionName}() returns void language plpgsql as 'begin end'`,
    function_name: functionName,
    identity_arguments: '',
    language: 'plpgsql',
    owner: 'supabase_admin',
    parallel_safety: 'u',
    raw_acl: '{supabase_admin=X/supabase_admin}',
    result_type: 'void',
    routine_kind: 'f',
    security_definer: false,
    volatility: 'v',
  }))
  const functionDependencies = functions.flatMap((function_) => [
    {
      dependency_type: 'n',
      function_name: function_.function_name,
      identity_arguments: function_.identity_arguments,
      referenced_class: 'pg_language',
      referenced_identity: 'language plpgsql',
    },
    {
      dependency_type: 'n',
      function_name: function_.function_name,
      identity_arguments: function_.identity_arguments,
      referenced_class: 'pg_namespace',
      referenced_identity: 'schema public',
    },
  ])
  const columns = Array.from({ length: 150 }, (_, index) => ({
    column_name: index === 0 ? 'operation_contract_version' : `column_${index}`,
    default_expression: null,
    explicit_collation: null,
    generated_behavior: index === 0 ? 's' : '',
    generated_expression:
      index === 0
        ? `case when revision_kind = 'standard' then null when operation_contract_version_code = 1
          then 'gold-review-import-compensation/1.0.0' when operation_contract_version_code = 2
          then 'gold-review-import-compensation/2.0.0' else null end`
        : null,
    identity_behavior: '',
    not_null: index === 0,
    ordinal_position: index + 1,
    postgres_type: 'text',
    table_name: index === 0 ? 'literature_gold_set_reviews' : PROTECTED_V2_CATALOG_TABLES[0],
  }))
  return {
    columns,
    constraints: Array.from({ length: 96 }, (_, index) => ({
      constraint_name: `constraint_${index}`,
      validated: true,
    })),
    currentUser: 'supabase_admin',
    functionDependencies,
    functions,
    indexes: Array.from({ length: 34 }, (_, index) => ({
      index_name: `index_${index}`,
      live: true,
      ready: true,
      valid: true,
    })),
    isolation: 'repeatable read',
    policies: Array.from({ length: 2 }, (_, index) => ({ policy_name: `policy_${index}` })),
    readOnly: true,
    serverVersionNum: '170000',
    tablePrivileges: [{ granted: false, privilege_name: 'INSERT', role_name: 'anon' }],
    tables: PROTECTED_V2_CATALOG_TABLES.map((tableName) => ({
      force_rls: false,
      owner: 'supabase_admin',
      raw_acl: '{supabase_admin=arwdDxt/supabase_admin}',
      rls_enabled: true,
      table_name: tableName,
    })),
    triggers: Array.from({ length: 24 }, (_, index) => ({
      definition: `create trigger trigger_${index} before insert on public.table_${index}`,
      enabled_state: 'O',
      function_identity: `public.trigger_function_${index}()`,
      trigger_name: `trigger_${index}`,
      trigger_type_mask: 7,
    })),
  }
}

function drift(mutate: (details: CompleteCatalogFixture) => void): CompleteCatalogFixture {
  const details = structuredClone(completeDetails())
  mutate(details)
  return details
}

const DETAIL_DRIFT_CASES: Array<[string, (value: CompleteCatalogFixture) => void]> = [
  ['read-only bracket', (value) => void (value.readOnly = false)],
  ['table count', (value) => void value.tables.pop()],
  ['table owner', (value) => void (value.tables[0]!.owner = 'postgres')],
  ['RLS state', (value) => void (value.tables[0]!.rls_enabled = false)],
  ['generated expression', (value) => void (value.columns[0]!.generated_expression = 'true')],
  ['identity behavior', (value) => void (value.columns[1]!.identity_behavior = 'a')],
  ['constraint validation', (value) => void (value.constraints[0]!.validated = false)],
  ['index validity', (value) => void (value.indexes[0]!.valid = false)],
  ['trigger enabled state', (value) => void (value.triggers[0]!.enabled_state = 'D')],
  ['function owner', (value) => void (value.functions[0]!.owner = 'postgres')],
  [
    'function overload inventory',
    (value) => void (value.functions[0]!.function_name = 'undeclared_overload'),
  ],
  [
    'function dependency addition',
    (value) =>
      void value.functionDependencies.push({
        ...value.functionDependencies[0]!,
        referenced_class: 'pg_extension',
        referenced_identity: 'extension plpgsql',
      }),
  ],
  ['function dependency removal', (value) => void value.functionDependencies.pop()],
]

describe('protected V2 complete production catalog audit', () => {
  it('accepts the exact complete-detail shape for the disposable owner profile', () => {
    expect(() =>
      validateProtectedV2CompleteCatalogDetails(completeDetails(), 'disposable_clone'),
    ).not.toThrow()
  })

  it.each(DETAIL_DRIFT_CASES)('rejects %s drift before identity issuance', (_label, mutate) => {
    expect(() =>
      validateProtectedV2CompleteCatalogDetails(drift(mutate), 'disposable_clone'),
    ).toThrow()
  })

  it('collects every required catalog dimension through fixed read-only SQL', () => {
    for (const token of [
      'generated_expression',
      'identity_behavior',
      'explicit_collation',
      'convalidated',
      'indisvalid',
      'indisready',
      'indislive',
      'tgtype',
      'tgenabled',
      'polpermissive',
      'relrowsecurity',
      'relforcerowsecurity',
      'has_table_privilege',
      'proparallel',
      'proconfig',
      'pg_depend',
    ]) {
      expect(PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL).toContain(token)
    }
    expect(v2SecurityIntrospectionSql()).toContain("'tablePrivileges'")
  })

  it('defines the exhaustive disposable matrix consumed by the production collector', () => {
    const ids = PROTECTED_V2_CATALOG_DRIFT_PROBES.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(
      expect.arrayContaining([
        'disable_row_level_security',
        'change_force_row_level_security_state',
        'alter_policy_role',
        'alter_policy_using_expression',
        'alter_policy_with_check_expression',
        'drop_required_policy',
        'grant_service_role_forbidden_update',
        'grant_service_role_forbidden_insert',
        'grant_public_forbidden_insert',
        'change_column_default',
        'change_column_nullability',
        'remove_generated_expression',
        'drop_required_check_constraint',
        'replace_check_constraint_with_weaker_definition',
        'introduce_unvalidated_constraint_state',
        'drop_required_foreign_key',
        'drop_required_unique_index',
        'change_required_partial_unique_index',
        'mark_required_index_invalid',
        'disable_required_trigger',
        'redirect_required_trigger_function',
        'change_function_body',
        'change_function_volatility',
        'change_function_search_path',
        'change_function_owner',
        'broaden_function_execute_acl',
        'add_undeclared_function_overload',
        'change_function_dependency',
      ]),
    )
  })

  it('projects only the pinned local role inventory for the disposable owner-profile proof', async () => {
    const context = withTrustedLocalRoleInventoryProjection({
      psql: async () => ({
        stdout: `${CONTRACT_DIAGNOSTICS_MARKER}${JSON.stringify({
          functions: [{ name: 'unchanged' }],
          readOnlyTransaction: true,
          roles: [],
          transactionIsolation: 'repeatable read',
        })}\n`,
      }),
      queryJson: async () => ({ untouched: true }),
    })
    const projected = await context.psql('read-only diagnostics')
    const payload = JSON.parse(
      projected.stdout.slice(CONTRACT_DIAGNOSTICS_MARKER.length),
    ) as Record<string, unknown>

    expect(reconciliationIdentitySha256(payload.roles)).toBe(
      TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256,
    )
    expect(payload.functions).toEqual([{ name: 'unchanged' }])
    await expect(context.queryJson('read-only catalog')).resolves.toEqual({ untouched: true })
  })
})
