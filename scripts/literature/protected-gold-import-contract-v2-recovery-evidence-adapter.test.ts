/** @jest-environment node */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import localCatalogExpectation from './contracts/protected-v2-complete-catalog/local_supabase_postgres_owner_v1.json'
import {
  buildContractDiagnosticsSql as buildContractDiagnosticsSqlOriginal,
  parseContractDiagnosticsOutput as parseContractDiagnosticsOutputOriginal,
} from './gold-import-compensation-contract-diagnostics'
import {
  buildContractDiagnosticsSql,
  parseContractDiagnosticsOutput,
} from './gold-import-compensation-contract-diagnostics-core'
import { SECURITY_INTROSPECTION_SQL } from './gold-import-compensation-security-introspection-sql'
import {
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_SCHEMA_VERSION,
  PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL,
  type ProtectedV2CatalogAuditQueryContext,
  type ProtectedV2CompleteCatalogAuditIdentity,
  v2SecurityIntrospectionSql,
} from './gold-import-contract-v2-catalog-audit'
import { buildLiteratureGoldV2SchemaNeutralHistoryEvidence } from './literature-gold-v2-schema-neutral-history'
import { LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY } from './literature-gold-v2-schema-only-transition'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
} from './protected-gold-import-contract-v2-source-identities'
import {
  PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS,
  PROTECTED_V2_RECOVERY_DOCKER_COMMAND,
  PROTECTED_V2_RECOVERY_EVIDENCE_SQL,
  PROTECTED_V2_RECOVERY_READ_ONLY_QUERY_AUDIT,
  assertProtectedV2RecoveryEvidenceSqlReadOnly,
  collectProtectedV2FixedLocalRecoveryEvidence,
  executeProtectedV2FixedLocalReadOnlyPsql,
  type ProtectedV2FixedLocalPsqlExecutor,
} from './protected-gold-import-contract-v2-recovery-evidence-adapter'
import {
  PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION,
  buildProtectedV2DatabaseEvidenceFromSnapshot,
  buildProtectedV2TransitionSnapshotSql,
  type ProtectedV2DatabaseEvidence,
  type ProtectedV2TransitionSnapshot,
} from './protected-gold-import-contract-v2-transition-evidence'

const mockCollectProtectedV2CompleteCatalogAudit = jest.fn<
  Promise<ProtectedV2CompleteCatalogAuditIdentity>,
  [{ context: ProtectedV2CatalogAuditQueryContext; profile: 'local' | 'disposable_clone' }]
>()

jest.mock('./gold-import-contract-v2-catalog-audit', () => {
  const actual = jest.requireActual(
    './gold-import-contract-v2-catalog-audit',
  ) as typeof import('./gold-import-contract-v2-catalog-audit')
  return {
    ...actual,
    collectProtectedV2CompleteCatalogAudit: (
      input: Parameters<typeof actual.collectProtectedV2CompleteCatalogAudit>[0],
    ) => mockCollectProtectedV2CompleteCatalogAudit(input),
  }
})

function localCatalogIdentity(): ProtectedV2CompleteCatalogAuditIdentity {
  return {
    auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
    auditModel: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL,
    auditModelIdentitySha256: localCatalogExpectation.auditModelIdentitySha256,
    componentIdentities: { ...localCatalogExpectation.componentIdentities },
    environmentInvariantIdentitySha256: localCatalogExpectation.environmentInvariantIdentitySha256,
    fullAuditIdentitySha256: localCatalogExpectation.fullAuditIdentitySha256,
    fullEnvironmentInventoryIdentitySha256:
      localCatalogExpectation.fullEnvironmentInventoryIdentitySha256,
    fullEnvironmentInventoryRecordCount:
      localCatalogExpectation.fullEnvironmentInventoryRecordCount,
    localPostgresOwnerProfileIdentitySha256:
      localCatalogExpectation.expectedDeploymentProfileIdentitySha256,
    schemaVersion: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_SCHEMA_VERSION,
    verifierExecuted: false,
  }
}

function historyRows(phase: 'before_v2' | 'after_v2') {
  const batchId = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.batchId
  const itemId = '00000000-0000-4000-8000-000000000002'
  const reviewId = '00000000-0000-4000-8000-000000000003'
  const review = {
    effective_source_review_id: null,
    id: reviewId,
    item_id: itemId,
    lifecycle_state: 'effective',
    revision: 1,
    revision_kind: 'standard',
    ...(phase === 'after_v2'
      ? {
          full_text_used: null,
          operation_contract_version: null,
          operation_contract_version_code: 1,
        }
      : {}),
  }
  return {
    actions: [],
    batchId,
    batches: [{ id: batchId, name: 'gold-set-v1' }],
    datasetSplit: 'development' as const,
    drafts: [],
    events: [],
    items: [
      {
        automated_signals_revealed_at: null,
        batch_id: batchId,
        completed_at: null,
        current_review_id: reviewId,
        dataset_split: 'development',
        display_order: 1,
        id: itemId,
        pmid: '1',
        review_status: 'completed',
        started_at: null,
        supplemental_metadata_revealed_at: null,
      },
    ],
    operations: [],
    reviews: [review],
  }
}

function snapshot(phase: 'before_v2' | 'after_v2'): ProtectedV2TransitionSnapshot {
  const rows = historyRows(phase)
  const history = buildLiteratureGoldV2SchemaNeutralHistoryEvidence({ phase, rows })
  return {
    actionCount: 0,
    batchId: rows.batchId,
    compensationCount: 0,
    developmentMembershipSha256: '1'.repeat(64),
    effectiveStateSha256V1: '2'.repeat(64),
    effectiveStateSha256V2: phase === 'after_v2' ? '3'.repeat(64) : null,
    historyRows: rows,
    importCount: 0,
    ledgerEntries: [
      {
        name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
      },
      ...(phase === 'after_v2'
        ? [
            {
              name: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
              version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
            },
          ]
        : []),
    ],
    operationCount: 0,
    phase,
    physicalStateSha256V1: history.physicalStateSha256V1,
    physicalStateSha256V2: phase === 'after_v2' ? '4'.repeat(64) : null,
    readOnlyTransaction: true,
    schemaVersion: PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION,
  }
}

function beforeEvidence(): ProtectedV2DatabaseEvidence {
  return buildProtectedV2DatabaseEvidenceFromSnapshot({
    completeCatalogAudit: null,
    phase: 'before_v2',
    readOnlyBracketMatches: true,
    snapshot: snapshot('before_v2'),
  })
}

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(fromFile), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate) && /\.tsx?$/u.test(candidate)) return candidate
  }
  return null
}

function staticTypeScriptImportClosure(entry: string): string[] {
  const pending = [entry]
  const visited = new Set<string>()
  const localImport = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s*)?['"](\.[^'"]+)['"]/gu
  while (pending.length > 0) {
    const file = pending.pop()!
    if (visited.has(file)) continue
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(localImport)) {
      const dependency = resolveLocalImport(file, match[1]!)
      if (dependency && !visited.has(dependency)) pending.push(dependency)
    }
  }
  return [...visited]
    .map((file) => path.relative(process.cwd(), file))
    .sort((left, right) => left.localeCompare(right))
}

describe('protected V2 fixed-local recovery evidence adapter', () => {
  beforeEach(() => {
    mockCollectProtectedV2CompleteCatalogAudit.mockReset()
  })

  test('has an exact capability-free static import closure', () => {
    const entry = path.resolve(
      process.cwd(),
      'scripts/literature/protected-gold-import-contract-v2-recovery-evidence-adapter.ts',
    )
    expect(staticTypeScriptImportClosure(entry)).toEqual(
      [
        'scripts/literature/gold-import-compensation-contract-diagnostics-core.ts',
        'scripts/literature/gold-import-compensation-contract-reconciliation.ts',
        'scripts/literature/gold-import-compensation-rehearsal-evidence.ts',
        'scripts/literature/gold-import-compensation-security-introspection-sql.ts',
        'scripts/literature/gold-import-contract-v2-catalog-audit.ts',
        'scripts/literature/gold-import-contract-v2-catalog-expectations.ts',
        'scripts/literature/gold-import-contract-v2-readiness-policy.ts',
        'scripts/literature/gold-import-v2-fixed-local-target.ts',
        'scripts/literature/lib/cli.ts',
        'scripts/literature/literature-gold-v2-schema-neutral-history.ts',
        'scripts/literature/literature-gold-v2-schema-only-transition.ts',
        'scripts/literature/protected-gold-import-contract-v2-capability-free-canonical.ts',
        'scripts/literature/protected-gold-import-contract-v2-recovery-evidence-adapter.ts',
        'scripts/literature/protected-gold-import-contract-v2-source-identities.ts',
        'scripts/literature/protected-gold-import-contract-v2-transition-evidence.ts',
        'src/features/literature/gold-set/import-compensation-v2-identities.ts',
        'src/features/literature/gold-set/import-compensation.ts',
      ].sort((left, right) => left.localeCompare(right)),
    )
  })

  test('keeps extracted read-only SQL/parser primitives byte-compatible', () => {
    expect(buildContractDiagnosticsSql()).toBe(buildContractDiagnosticsSqlOriginal())
    expect(parseContractDiagnosticsOutput.toString()).toBe(
      parseContractDiagnosticsOutputOriginal.toString(),
    )
    const reexportedSecuritySql = (
      jest.requireActual(
        './rehearse-gold-import-compensation-db',
      ) as typeof import('./rehearse-gold-import-compensation-db')
    ).SECURITY_INTROSPECTION_SQL
    expect(SECURITY_INTROSPECTION_SQL).toBe(reexportedSecuritySql)
  })

  test('accepts every production query and rejects mutation or commit capabilities', () => {
    expect(PROTECTED_V2_RECOVERY_EVIDENCE_SQL).toEqual({
      catalogDetails: `begin transaction isolation level repeatable read read only;\nset local statement_timeout = '120s';\n${PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL}\nrollback;`,
      catalogDiagnostics: buildContractDiagnosticsSql(),
      catalogSecurity: `begin transaction isolation level repeatable read read only;\nset local statement_timeout = '120s';\n${v2SecurityIntrospectionSql()}\nrollback;`,
      transitionAfterV2: buildProtectedV2TransitionSnapshotSql('after_v2'),
    })
    const readOnlyQueries = Object.values(PROTECTED_V2_RECOVERY_EVIDENCE_SQL)
    for (const sql of readOnlyQueries) {
      expect(() => assertProtectedV2RecoveryEvidenceSqlReadOnly(sql)).not.toThrow()
      expect(sql.match(/\brollback\s*;/giu)).toHaveLength(1)
    }
    for (const statement of [
      'commit;',
      'delete from public.literature_gold_set_items;',
      'select 1; rollback; rollback;',
      '\\copy public.literature_gold_set_items to stdout;',
    ]) {
      expect(() =>
        assertProtectedV2RecoveryEvidenceSqlReadOnly(
          `begin transaction isolation level repeatable read read only;\n${statement}\nrollback;`,
        ),
      ).toThrow()
    }
  })

  test('executes the byte-exact reported sequence of two snapshots and three catalog queries', async () => {
    mockCollectProtectedV2CompleteCatalogAudit.mockImplementation(async ({ context, profile }) => {
      expect(profile).toBe('local')
      await Promise.all([
        context.psql(PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogDiagnostics),
        context.queryJson(PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogSecurity),
        context.queryJson(PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogDetails),
      ])
      return localCatalogIdentity()
    })
    const postSnapshot = snapshot('after_v2')
    const executor = jest.fn<
      ReturnType<ProtectedV2FixedLocalPsqlExecutor>,
      Parameters<ProtectedV2FixedLocalPsqlExecutor>
    >(async (request) => {
      expect(request.command).toBe(PROTECTED_V2_RECOVERY_DOCKER_COMMAND)
      expect(request.arguments).toBe(PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS)
      expect(() => assertProtectedV2RecoveryEvidenceSqlReadOnly(request.sql)).not.toThrow()
      return {
        stdout: request.sql.includes(PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION)
          ? `${JSON.stringify(postSnapshot)}\n`
          : '{}\n',
      }
    })
    const firstBefore = beforeEvidence()
    const secondBefore = beforeEvidence()

    const collected = await collectProtectedV2FixedLocalRecoveryEvidence({
      beforeCaptures: [firstBefore, secondBefore],
      executor,
      expectedCatalogBindingSha256:
        LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.catalog.expectedCatalogBindingSha256,
      sourceAuthorizationSha256: '5'.repeat(64),
    })

    expect(mockCollectProtectedV2CompleteCatalogAudit).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledTimes(5)
    expect(executor.mock.calls.map(([request]) => request.sql)).toEqual(
      PROTECTED_V2_RECOVERY_READ_ONLY_QUERY_AUDIT.transactionBatches,
    )
    expect(
      executor.mock.calls.filter(([request]) =>
        request.sql.includes(PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION),
      ),
    ).toHaveLength(2)
    expect(collected.postEvidence.completeCatalogAudit).toEqual(localCatalogIdentity())
    expect(collected.transitionInput).toEqual({
      after: collected.postEvidence,
      beforeCaptures: [firstBefore, secondBefore],
      expectedCatalogBindingSha256:
        LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.catalog.expectedCatalogBindingSha256,
      sourceAuthorizationSha256: '5'.repeat(64),
    })
  })

  test('does not execute even an otherwise read-only caller-supplied query', async () => {
    await expect(
      executeProtectedV2FixedLocalReadOnlyPsql({
        arguments: PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS,
        command: PROTECTED_V2_RECOVERY_DOCKER_COMMAND,
        sql: "begin transaction isolation level repeatable read read only;\nselect '{}'::jsonb;\nrollback;",
      }),
    ).rejects.toThrow('not one of the four fixed queries')
  })
})
