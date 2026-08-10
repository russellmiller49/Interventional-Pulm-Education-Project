import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import { CONTRACT_DIAGNOSTICS_MARKER } from './gold-import-compensation-contract-diagnostics'
import { trustedLocalRoleInventoryProjection } from './gold-import-compensation-contract-expectations'
import { createExactPackageDatabaseExecutorV2 } from './execute-exact-gold-import-compensation-package-v2'
import type { GeneratedGoldImportCompensationPackageV2 } from './generate-gold-import-compensation-package-v2'
import {
  PROTECTED_V2_CATALOG_TABLES,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
  PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES,
  validateProtectedV2CompleteCatalogAuditIdentity,
  collectProtectedV2CompleteCatalogAudit,
  type ProtectedV2CatalogAuditQueryContext,
  type ProtectedV2CompleteCatalogAuditIdentity,
} from './gold-import-contract-v2-catalog-audit'
import { ProtectedV2CatalogExpectationMismatchError } from './gold-import-contract-v2-catalog-expectations'
import { reconciliationIdentitySha256 } from './gold-import-compensation-contract-reconciliation'
import {
  executeV2DisposableCatalogProbePath,
  type ExecuteV2DisposableCatalogProbeInput,
} from './rehearse-gold-import-compensation-db-v2'
import type { DevelopmentDatabaseSeed } from './rehearse-exact-gold-import-compensation-package-v1'
import {
  PROTECTED_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION,
  PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS,
} from './protected-gold-import-contract-v2-catalog-drift-identities'

export { PROTECTED_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION }

export interface ProtectedV2CatalogDriftProbe {
  category:
    | 'column'
    | 'constraint'
    | 'function'
    | 'index'
    | 'identity'
    | 'owner'
    | 'rls_policy'
    | 'table_privilege'
    | 'trigger'
  id: string
  sql: string | null
}

export const PROTECTED_V2_CATALOG_DRIFT_PROBES: readonly ProtectedV2CatalogDriftProbe[] = [
  {
    category: 'identity',
    id: 'arbitrary_component_hash_with_recomputed_full_audit',
    sql: null,
  },
  {
    category: 'identity',
    id: 'arbitrary_profile_identity_with_recomputed_full_audit',
    sql: null,
  },
  {
    category: 'identity',
    id: 'arbitrary_full_inventory_identity_with_recomputed_full_audit',
    sql: null,
  },
  {
    category: 'identity',
    id: 'local_expectation_profile_on_disposable_observation',
    sql: null,
  },
  {
    category: 'identity',
    id: 'disposable_expectation_profile_on_local_observation',
    sql: null,
  },
  {
    category: 'owner',
    id: 'change_single_table_owner_preserving_count',
    sql: 'alter table public.literature_gold_review_operations owner to postgres;',
  },
  {
    category: 'owner',
    id: 'change_multiple_table_owners_preserving_count',
    sql: `alter table public.literature_gold_review_operations owner to postgres;
      alter table public.literature_gold_review_operation_actions owner to postgres;`,
  },
  {
    category: 'rls_policy',
    id: 'disable_row_level_security',
    sql: 'alter table public.literature_gold_review_operations disable row level security;',
  },
  {
    category: 'rls_policy',
    id: 'change_force_row_level_security_state',
    sql: 'alter table public.literature_gold_review_operations force row level security;',
  },
  {
    category: 'rls_policy',
    id: 'alter_policy_role',
    sql: `alter policy literature_gold_review_operations_service_policy
      on public.literature_gold_review_operations
      to authenticated;`,
  },
  {
    category: 'rls_policy',
    id: 'alter_policy_using_expression',
    sql: `alter policy literature_gold_review_operations_service_policy
      on public.literature_gold_review_operations
      using (true);`,
  },
  {
    category: 'rls_policy',
    id: 'alter_policy_with_check_expression',
    sql: `alter policy literature_gold_review_operations_service_policy
      on public.literature_gold_review_operations
      with check (true);`,
  },
  {
    category: 'rls_policy',
    id: 'same_name_policy_definition_replacement',
    sql: `alter policy literature_gold_review_operations_service_policy
      on public.literature_gold_review_operations
      using (operation_kind = 'import');`,
  },
  {
    category: 'rls_policy',
    id: 'drop_required_policy',
    sql: `drop policy literature_gold_review_operations_service_policy
      on public.literature_gold_review_operations;`,
  },
  {
    category: 'table_privilege',
    id: 'grant_service_role_forbidden_update',
    sql: 'grant update on table public.literature_gold_review_operations to service_role;',
  },
  {
    category: 'table_privilege',
    id: 'grant_service_role_forbidden_insert',
    sql: 'grant insert on table public.literature_gold_review_operations to service_role;',
  },
  {
    category: 'table_privilege',
    id: 'grant_public_forbidden_insert',
    sql: 'grant insert on table public.literature_gold_review_operations to public;',
  },
  {
    category: 'table_privilege',
    id: 'grant_anon_forbidden_insert',
    sql: 'grant insert on table public.literature_gold_review_operations to anon;',
  },
  {
    category: 'table_privilege',
    id: 'grant_authenticated_forbidden_insert',
    sql: 'grant insert on table public.literature_gold_review_operations to authenticated;',
  },
  {
    category: 'table_privilege',
    id: 'change_acl_grantor_preserving_count',
    sql: `grant select on table public.literature_gold_review_operations to postgres with grant option;
      revoke select on table public.literature_gold_review_operations from service_role;
      set role postgres;
      grant select on table public.literature_gold_review_operations to service_role;
      reset role;`,
  },
  {
    category: 'table_privilege',
    id: 'replace_privilege_preserving_acl_count',
    sql: `revoke select on table public.literature_gold_review_operations from service_role;
      grant insert on table public.literature_gold_review_operations to service_role;`,
  },
  {
    category: 'table_privilege',
    id: 'substitute_acl_record_preserving_count',
    sql: `revoke select on table public.literature_gold_review_operations from service_role;
      grant select on table public.literature_gold_review_operations to authenticated;`,
  },
  {
    category: 'column',
    id: 'change_column_default',
    sql: `alter table public.literature_gold_review_operations
      alter column contract_version set default 'gold-review-import-compensation/2.0.0';`,
  },
  {
    category: 'column',
    id: 'change_column_nullability',
    sql: `alter table public.literature_gold_review_operations
      alter column contract_version drop not null;`,
  },
  {
    category: 'column',
    id: 'remove_generated_expression',
    sql: `alter table public.literature_gold_set_reviews
      alter column operation_contract_version drop expression;`,
  },
  {
    category: 'constraint',
    id: 'drop_required_check_constraint',
    sql: `alter table public.literature_gold_set_reviews
      drop constraint literature_gold_reviews_v2_source_shape_check;`,
  },
  {
    category: 'constraint',
    id: 'replace_check_constraint_with_weaker_definition',
    sql: `alter table public.literature_gold_set_reviews
      drop constraint literature_gold_reviews_v2_source_shape_check,
      add constraint literature_gold_reviews_v2_source_shape_check check (true);`,
  },
  {
    category: 'constraint',
    id: 'introduce_unvalidated_constraint_state',
    sql: `alter table public.literature_gold_set_reviews
      add constraint protected_v2_drift_unvalidated check (true) not valid;`,
  },
  {
    category: 'constraint',
    id: 'drop_required_foreign_key',
    sql: `alter table public.literature_gold_set_reviews
      drop constraint literature_gold_set_reviews_operation_action_fk;`,
  },
  {
    category: 'index',
    id: 'drop_required_unique_index',
    sql: 'drop index public.literature_gold_review_operations_one_live_compensation_idx;',
  },
  {
    category: 'index',
    id: 'change_required_partial_unique_index',
    sql: `drop index public.literature_gold_review_operations_one_live_compensation_idx;
      create unique index literature_gold_review_operations_one_live_compensation_idx
      on public.literature_gold_review_operations (target_import_operation_id)
      where operation_kind = 'compensation';`,
  },
  {
    category: 'index',
    id: 'equal_count_index_object_substitution',
    sql: `drop index public.literature_gold_review_operations_one_live_compensation_idx;
      create unique index protected_v2_equal_count_substitute_idx
      on public.literature_gold_review_operations (target_import_operation_id)
      where operation_kind = 'compensation' and status in ('started', 'applying');`,
  },
  {
    category: 'index',
    id: 'mark_required_index_invalid',
    sql: `update pg_catalog.pg_index
      set indisvalid = false
      where indexrelid = 'public.literature_gold_review_operations_one_live_compensation_idx'::pg_catalog.regclass;`,
  },
  {
    category: 'trigger',
    id: 'disable_required_trigger',
    sql: `alter table public.literature_gold_review_operations
      disable trigger enforce_literature_gold_operation_contract_v2;`,
  },
  {
    category: 'trigger',
    id: 'redirect_required_trigger_function',
    sql: `drop trigger enforce_literature_gold_operation_contract_v2
      on public.literature_gold_review_operations;
      create trigger enforce_literature_gold_operation_contract_v2
      before insert or update on public.literature_gold_review_operations
      for each row execute function public.enforce_literature_gold_review_contract_v2();`,
  },
  {
    category: 'function',
    id: 'change_function_body',
    sql: `create or replace function public.literature_gold_effective_state_hash_v2(
        p_batch_id uuid, p_split text default 'development')
      returns text language sql stable security invoker
      set search_path = pg_catalog, public, extensions
      as $protected_v2_drift$select repeat('0', 64)::text$protected_v2_drift$;`,
  },
  {
    category: 'function',
    id: 'change_function_volatility',
    sql: `alter function public.literature_gold_effective_state_hash_v2(uuid, text) volatile;`,
  },
  {
    category: 'function',
    id: 'change_function_search_path',
    sql: `alter function public.apply_literature_gold_import_v2(
      uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text)
      set search_path = public;`,
  },
  {
    category: 'function',
    id: 'change_function_owner',
    sql: `alter function public.apply_literature_gold_import_v2(
      uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text)
      owner to postgres;`,
  },
  {
    category: 'function',
    id: 'broaden_function_execute_acl',
    sql: `grant execute on function public.apply_literature_gold_import_v2(
      uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text) to anon;`,
  },
  {
    category: 'function',
    id: 'add_undeclared_function_overload',
    sql: `create function public.apply_literature_gold_import_v2()
      returns jsonb language sql as $protected_v2_drift$select '{}'::jsonb$protected_v2_drift$;`,
  },
  {
    category: 'function',
    id: 'change_function_dependency',
    sql: `alter function public.apply_literature_gold_import_v2(
      uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text)
      depends on extension plpgsql;`,
  },
] as const

if (
  canonicalJson(PROTECTED_V2_CATALOG_DRIFT_PROBES.map(({ id }) => id)) !==
  canonicalJson(PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS)
) {
  throw new Error('Protected V2 live catalog drift probes differ from their sealed identity tuple.')
}

export interface ProtectedV2CatalogDriftMatrixEvidence {
  auditMethod: typeof PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD
  exactReadyDisposable: ProtectedV2CompleteCatalogAuditIdentity
  exactReadyDisposablePassed: true
  localOwnerProjection: ProtectedV2CompleteCatalogAuditIdentity
  probeCount: number
  probes: Array<{
    auditRejected: true
    category: ProtectedV2CatalogDriftProbe['category']
    cleanupVerified: true
    differences: Array<{
      component: string
      firstDifferingField: string | null
      kind: string
      recordKey: string
      source: string
    }>
    id: string
    recordDiagnosticFound: boolean
    rejectionMessage: string
  }>
  schemaVersion: typeof PROTECTED_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION
}

type DisposablePathRunner = (
  input: ExecuteV2DisposableCatalogProbeInput,
) => ReturnType<typeof executeV2DisposableCatalogProbePath>

function sqlValues(values: readonly string[]): string {
  return values.map((value) => `('${value.replaceAll("'", "''")}')`).join(', ')
}

function rehashedCatalogIdentity(
  identity: ProtectedV2CompleteCatalogAuditIdentity,
  mutate: (value: ProtectedV2CompleteCatalogAuditIdentity) => void,
): ProtectedV2CompleteCatalogAuditIdentity {
  const value = JSON.parse(canonicalJson(identity)) as ProtectedV2CompleteCatalogAuditIdentity
  mutate(value)
  const content = { ...value }
  delete (content as { fullAuditIdentitySha256?: string }).fullAuditIdentitySha256
  value.fullAuditIdentitySha256 = reconciliationIdentitySha256(content)
  return value
}

function rejectionDiagnostics(error: unknown): {
  differences: ProtectedV2CatalogDriftMatrixEvidence['probes'][number]['differences']
  recordDiagnosticFound: boolean
  rejectionMessage: string
} {
  if (error instanceof ProtectedV2CatalogExpectationMismatchError) {
    const differences = error.comparison.differences.map(
      ({ component, firstDifferingField, kind, recordKey, source }) => ({
        component,
        firstDifferingField,
        kind,
        recordKey,
        source,
      }),
    )
    const record = differences.find(({ component }) => component !== 'auditIdentity')
    return {
      differences,
      recordDiagnosticFound: Boolean(record),
      rejectionMessage: record
        ? `Protected V2 exact catalog record mismatch: ${record.component}/${record.source}/${record.recordKey} ${record.kind}${record.firstDifferingField ? ` at ${record.firstDifferingField}` : ''}.`
        : error.message,
    }
  }
  return {
    differences: [],
    recordDiagnosticFound: false,
    rejectionMessage: error instanceof Error ? error.message : String(error),
  }
}

export const PROTECTED_V2_LOCAL_OWNER_PROJECTION_SQL = `do $protected_v2_owner_projection$
declare target record;
begin
  for target in
    select table_name from (values ${sqlValues(PROTECTED_V2_CATALOG_TABLES)}) as tables(table_name)
  loop
    execute pg_catalog.format('alter table public.%I owner to postgres', target.table_name);
  end loop;
  for target in
    select proc.oid::pg_catalog.regprocedure as function_identity
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        select function_name from (values ${sqlValues(
          PROTECTED_V2_COMPLETE_CATALOG_FUNCTION_NAMES,
        )}) as functions(function_name)
      )
  loop
    execute pg_catalog.format('alter function %s owner to postgres', target.function_identity);
  end loop;
end;
$protected_v2_owner_projection$;`

/**
 * The standalone disposable image intentionally has a smaller role-membership inventory than the
 * supported local Supabase runtime. This wrapper changes only that deployment-profile evidence;
 * catalog/function bytes still come from the disposable database after its SQL owner projection.
 */
export function withTrustedLocalRoleInventoryProjection(
  context: ProtectedV2CatalogAuditQueryContext,
): ProtectedV2CatalogAuditQueryContext {
  return {
    psql: async (sql) => {
      const result = await context.psql(sql)
      const lines = result.stdout.split(/\r?\n/u)
      const markerLines = lines.filter((line) => line.startsWith(CONTRACT_DIAGNOSTICS_MARKER))
      if (markerLines.length !== 1) {
        throw new Error('Disposable local-role projection requires one diagnostics marker.')
      }
      const payload = JSON.parse(
        markerLines[0]!.slice(CONTRACT_DIAGNOSTICS_MARKER.length),
      ) as Record<string, unknown>
      payload.roles = trustedLocalRoleInventoryProjection()
      return {
        ...result,
        stdout: `${CONTRACT_DIAGNOSTICS_MARKER}${JSON.stringify(payload)}\n`,
      }
    },
    queryJson: context.queryJson,
  }
}

export async function runProtectedV2DisposableCatalogDriftMatrix(input: {
  package: GeneratedGoldImportCompensationPackageV2
  runDisposablePath?: DisposablePathRunner
  seed: DevelopmentDatabaseSeed
}): Promise<ProtectedV2CatalogDriftMatrixEvidence> {
  const runDisposablePath = input.runDisposablePath ?? executeV2DisposableCatalogProbePath
  const baselineExecutor = createExactPackageDatabaseExecutorV2(input.package)
  const probeEvidence: ProtectedV2CatalogDriftMatrixEvidence['probes'] = []

  let exactReadyDisposable: ProtectedV2CompleteCatalogAuditIdentity | undefined
  const exactReadyResult = await runDisposablePath({
    exactPackageExecutor: {
      async execute(context) {
        const evidence = await baselineExecutor.execute(context)
        exactReadyDisposable = await collectProtectedV2CompleteCatalogAudit({
          context,
          profile: 'disposable_clone',
        })
        return evidence
      },
    },
    migrationPath: 'fresh',
    seed: input.seed,
  })
  if (!exactReadyDisposable || exactReadyResult.cleanup.outcome !== 'removed_and_verified_absent') {
    throw new Error(
      'Exact ready disposable catalog did not pass production collection and cleanup.',
    )
  }

  let localOwnerProjection: ProtectedV2CompleteCatalogAuditIdentity | undefined
  const localProjectionResult = await runDisposablePath({
    exactPackageExecutor: {
      async execute(context) {
        const evidence = await baselineExecutor.execute(context)
        await context.psql(PROTECTED_V2_LOCAL_OWNER_PROJECTION_SQL)
        localOwnerProjection = await collectProtectedV2CompleteCatalogAudit({
          context: withTrustedLocalRoleInventoryProjection(context),
          profile: 'local',
        })
        return evidence
      },
    },
    migrationPath: 'fresh',
    seed: input.seed,
  })
  if (
    !localOwnerProjection ||
    localProjectionResult.cleanup.outcome !== 'removed_and_verified_absent'
  ) {
    throw new Error('Supported local postgres-owner catalog projection did not pass and clean up.')
  }

  const rejectedIdentityProbe = (
    probe: ProtectedV2CatalogDriftProbe,
  ): ReturnType<typeof rejectionDiagnostics> => {
    let candidate: ProtectedV2CompleteCatalogAuditIdentity
    switch (probe.id) {
      case 'arbitrary_component_hash_with_recomputed_full_audit':
        candidate = rehashedCatalogIdentity(exactReadyDisposable!, (identity) => {
          identity.componentIdentities.columns = '0'.repeat(64)
        })
        break
      case 'arbitrary_profile_identity_with_recomputed_full_audit':
        candidate = rehashedCatalogIdentity(exactReadyDisposable!, (identity) => {
          identity.localPostgresOwnerProfileIdentitySha256 = '1'.repeat(64)
        })
        break
      case 'arbitrary_full_inventory_identity_with_recomputed_full_audit':
        candidate = rehashedCatalogIdentity(exactReadyDisposable!, (identity) => {
          identity.fullEnvironmentInventoryIdentitySha256 = '2'.repeat(64)
        })
        break
      case 'local_expectation_profile_on_disposable_observation':
        candidate = rehashedCatalogIdentity(exactReadyDisposable!, (identity) => {
          identity.localPostgresOwnerProfileIdentitySha256 =
            localOwnerProjection!.localPostgresOwnerProfileIdentitySha256
        })
        break
      case 'disposable_expectation_profile_on_local_observation':
        candidate = rehashedCatalogIdentity(localOwnerProjection!, (identity) => {
          identity.localPostgresOwnerProfileIdentitySha256 =
            exactReadyDisposable!.localPostgresOwnerProfileIdentitySha256
        })
        break
      default:
        throw new Error(`Unknown protected V2 identity drift probe ${probe.id}.`)
    }
    try {
      validateProtectedV2CompleteCatalogAuditIdentity(candidate)
    } catch (error) {
      return rejectionDiagnostics(error)
    }
    throw new Error(`Production complete catalog validator accepted identity probe ${probe.id}.`)
  }

  for (const probe of PROTECTED_V2_CATALOG_DRIFT_PROBES) {
    if (probe.sql === null) {
      const rejection = rejectedIdentityProbe(probe)
      probeEvidence.push({
        auditRejected: true,
        category: probe.category,
        cleanupVerified: true,
        differences: rejection.differences,
        id: probe.id,
        recordDiagnosticFound: rejection.recordDiagnosticFound,
        rejectionMessage: rejection.rejectionMessage,
      })
      continue
    }

    let rejection: ReturnType<typeof rejectionDiagnostics> | undefined
    const result = await runDisposablePath({
      exactPackageExecutor: {
        async execute(context) {
          const evidence = await baselineExecutor.execute(context)
          await context.psql(probe.sql!)
          try {
            await collectProtectedV2CompleteCatalogAudit({
              context,
              profile: 'disposable_clone',
            })
          } catch (error) {
            rejection = rejectionDiagnostics(error)
          }
          if (!rejection) {
            throw new Error(`Production complete catalog audit accepted drift probe ${probe.id}.`)
          }
          return evidence
        },
      },
      migrationPath: 'fresh',
      seed: input.seed,
    })
    if (result.cleanup.outcome !== 'removed_and_verified_absent' || !rejection) {
      throw new Error(
        `Disposable catalog drift probe ${probe.id} did not fail closed and clean up.`,
      )
    }
    probeEvidence.push({
      auditRejected: true,
      category: probe.category,
      cleanupVerified: true,
      differences: rejection.differences,
      id: probe.id,
      recordDiagnosticFound: rejection.recordDiagnosticFound,
      rejectionMessage: rejection.rejectionMessage,
    })
  }
  if (
    canonicalJson(probeEvidence.map(({ id }) => id)) !==
    canonicalJson(PROTECTED_V2_CATALOG_DRIFT_PROBES.map(({ id }) => id))
  ) {
    throw new Error('Disposable catalog drift evidence inventory is incomplete or reordered.')
  }
  return {
    auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
    exactReadyDisposable,
    exactReadyDisposablePassed: true,
    localOwnerProjection,
    probeCount: probeEvidence.length,
    probes: probeEvidence,
    schemaVersion: PROTECTED_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION,
  }
}
