/** @jest-environment node */

import { createHash } from 'node:crypto'

import {
  CONTRACT_DIAGNOSTICS_NORMALIZATION_RULE,
  CONTRACT_DIAGNOSTICS_SCHEMA_VERSION,
  CONTRACT_DIAGNOSTIC_RPC_NAMES,
  EXPECTED_CONTRACT_SEARCH_PATH,
  REQUESTED_RECONCILIATION_NAME_DISCREPANCY,
  type ExecutedContractDiagnostics,
} from './gold-import-compensation-contract-diagnostics'
import {
  GOLD_IMPORT_COMPENSATION_RECONCILIATION_SCHEMA_VERSION,
  type DeploymentProfileEvidence,
  type GoldImportCompensationContractReconciliation,
} from './gold-import-compensation-contract-reconciliation'
import { POST_MIGRATION_RECONCILIATION_BRANCH } from './gold-import-compensation-read-only-guard'
import {
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  canonicalJson,
  type AuditResult,
  type CanonicalArtifacts,
  type ContractStateHashes,
  type LoadedPreMigrationBackup,
  type RawDatabaseSnapshot,
} from './gold-import-compensation-migration-operations'
import {
  SCHEMA_SECURITY_DEFINITION_IDENTITY_SCHEMA_VERSION,
  type SchemaSecurityDefinitionIdentity,
} from './gold-import-compensation-rehearsal-evidence'
import {
  CONTRACT_DIAGNOSTIC_EXECUTION_SCHEMA_VERSION,
  buildReadOnlyContractDiagnosticBracket,
  buildSealedContractDiagnosticArtifacts,
  requestedRpcNameAuditExpectationDefects,
  runDiagnoseGoldImportCompensationContract,
  type DiagnoseContractOperations,
} from './diagnose-gold-import-compensation-contract'

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function seal(filesInput: ReadonlyMap<string, string>): CanonicalArtifacts {
  const files = new Map(
    [...filesInput.entries()].sort(([left], [right]) => left.localeCompare(right)),
  )
  const manifest = [...files.entries()]
    .map(([name, bytes]) => `${digest(bytes)}  ${name}\n`)
    .join('')
  return { files, manifest, manifestSha256: digest(manifest) }
}

function snapshot(): RawDatabaseSnapshot {
  return {
    database: { readOnlyTransaction: true },
    developmentItems: [],
    developmentSeed: {},
    migrationLedger: [],
    schema: {},
    scope: { batch: { id: '00000000-0000-0000-0000-000000000001' }, datasetSplit: 'development' },
    testAggregate: { locked: true },
  }
}

function stateHashes(seed = 'stable'): ContractStateHashes {
  return {
    developmentMembershipSha256: digest(`${seed}-membership`),
    effectiveStateSha256: digest(`${seed}-effective`),
    physicalStateSha256: digest(`${seed}-physical`),
    readOnlyTransaction: true,
  }
}

function expectedIdentity(): SchemaSecurityDefinitionIdentity {
  const normalizedDefinition = 'canonical reconciliation function'
  return {
    schemaVersion: SCHEMA_SECURITY_DEFINITION_IDENTITY_SCHEMA_VERSION,
    records: [
      {
        definitionSha256: digest(normalizedDefinition),
        normalizedDefinition,
        objectIdentity:
          'public.reconcile_literature_gold_review_operation_v1(p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb)',
        objectName: 'reconcile_literature_gold_review_operation_v1',
        objectType: 'function',
        owner: 'supabase_admin',
        parentObjectName: null,
        relevantRoles: ['service_role'],
        schemaName: 'public',
        state: {},
      },
    ],
  }
}

function diagnostics(): ExecutedContractDiagnostics {
  const functions: ExecutedContractDiagnostics['functions'] = CONTRACT_DIAGNOSTIC_RPC_NAMES.map(
    (name) => {
      const identityArguments = 'p_operation_id uuid'
      const rawDefinition = `CREATE OR REPLACE FUNCTION public.${name}(p_operation_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $function$ BEGIN RETURN '{}'::jsonb; END; $function$`
      return {
        argumentsWithDefaults: identityArguments,
        configuration: [`search_path=${EXPECTED_CONTRACT_SEARCH_PATH}`],
        definitionSha256: digest(rawDefinition),
        dependencies: [],
        effectiveExecute: {
          PUBLIC: false,
          anon: false,
          authenticated: false,
          service_role: true,
        },
        explicitGrants: [],
        identityArguments,
        language: 'plpgsql',
        name,
        normalizedDefinition: rawDefinition,
        objectIdentity: `public.${name}(${identityArguments})`,
        overloadCount: 1,
        owner: 'postgres',
        parallelSafety: 'unsafe' as const,
        rawAcl: null,
        rawDefinition,
        rawDefinitionSha256: digest(rawDefinition),
        resultType: 'jsonb',
        routineKind: 'function' as const,
        schema: 'public' as const,
        searchPath: {
          actual: EXPECTED_CONTRACT_SEARCH_PATH,
          entries: [`search_path=${EXPECTED_CONTRACT_SEARCH_PATH}`],
          expected: EXPECTED_CONTRACT_SEARCH_PATH,
          matchesExpected: true,
        },
        securityDefiner: true,
        securityMode: 'definer' as const,
        volatility: name.startsWith('reconcile_') ? ('stable' as const) : ('volatile' as const),
      }
    },
  )
  return {
    canonicalRpcNames: CONTRACT_DIAGNOSTIC_RPC_NAMES,
    functions,
    normalizationRule: CONTRACT_DIAGNOSTICS_NORMALIZATION_RULE,
    readOnlyTransaction: true,
    requestedNameDiscrepancies: [REQUESTED_RECONCILIATION_NAME_DISCREPANCY],
    roles: [],
    schemaVersion: CONTRACT_DIAGNOSTICS_SCHEMA_VERSION,
    target: {
      container: DEFAULT_LOCAL_DATABASE_CONTAINER,
      database: 'postgres',
      local: true,
      port: LOCAL_DATABASE_PORT,
      projectId: LOCAL_SUPABASE_PROJECT_ID,
    },
    transactionIsolation: 'repeatable read',
  }
}

function reconciliation(): GoldImportCompensationContractReconciliation {
  const identity = { identity: { marker: 'identity' }, sha256: digest('identity') }
  return {
    classificationCounts: {
      audit_expectation_defect: 1,
      environment_representation_only: 0,
      explicitly_supported_local_profile: 1,
      identical: 0,
      missing_expected_object: 0,
      security_contract_difference: 0,
      semantic_contract_difference: 0,
      unexpected_object: 0,
    },
    completeness: {
      actualRecordCount: 683,
      actualRecordsAccountedFor: 683,
      complete: true,
      expectedRecordCount: 763,
      expectedRecordsAccountedFor: 763,
    },
    deploymentProfile: {
      passed: true,
      violations: [],
      expectedIdentity: identity,
      actualIdentity: identity,
    },
    fullEnvironmentInventoryMatches: false,
    identities: {
      actual: {
        contractInvariant: identity,
        deploymentProfile: identity,
        fullEnvironmentInventory: identity,
      },
      expected: {
        contractInvariant: identity,
        deploymentProfile: identity,
        fullEnvironmentInventory: identity,
      },
    },
    invariantIdentityMatches: true,
    ownerRepresentation: {
      actualRecordCount: 683,
      collapsedByObjectType: { function_acl: 24, table_acl: 56 },
      collapsedExpectedRecordCount: 80,
      expectedRecordCount: 763,
      explanation: 'exact local representation',
      isExact763To683OwnerRepresentation: true,
      projectedExpectedRecordCount: 683,
      projectionExactlyMatchesActual: true,
      recordCountDelta: 80,
    },
    profileDiffs: [],
    ready: true,
    readinessBlockers: [],
    recordDiffs: [],
    rpcDiffs: [],
    schemaVersion: GOLD_IMPORT_COMPENSATION_RECONCILIATION_SCHEMA_VERSION,
  } as unknown as GoldImportCompensationContractReconciliation
}

function auditResult(): AuditResult {
  return {
    markdown: '# ready\n',
    report: { readinessStatus: 'ready', status: 'ready' },
    schemaSecurityDefinitionIdentity: expectedIdentity(),
    schemaSecurityIdentitySha256: digest('schema'),
  }
}

function profile(): DeploymentProfileEvidence {
  return {
    profileId: 'local_supabase_postgres_owner_v1',
    roleInventory: [],
    target: 'local',
  }
}

const CLI_ARGUMENTS = [
  '--pre-migration-backup',
  'pre-backup',
  '--pre-migration-backup-manifest-sha256',
  digest('pre-backup-manifest'),
  '--output',
  'backups/diagnostic',
  '--backup-root',
  'backups',
  '--dry-run',
]

function harness() {
  const events: string[] = []
  const snapshots = [snapshot(), snapshot()]
  const hashes = [stateHashes(), stateHashes()]
  const contractDiagnostics = diagnostics()
  const expected = expectedIdentity()
  const reconciled = reconciliation()
  const legacyAudit = auditResult()
  const reconciledAudit = auditResult()
  const baseArtifacts = seal(
    new Map([
      ['migration-audit.json', canonicalJson(reconciledAudit.report)],
      ['migration-audit.md', reconciledAudit.markdown],
    ]),
  )
  const preMigration = {
    manifestSha256: digest('pre-backup-manifest'),
  } as LoadedPreMigrationBackup
  const writeArtifactSet = jest.fn<
    ReturnType<DiagnoseContractOperations['writeArtifactSet']>,
    Parameters<DiagnoseContractOperations['writeArtifactSet']>
  >(async () => undefined)
  const reconcileContract = jest.fn<
    ReturnType<DiagnoseContractOperations['reconcileContract']>,
    Parameters<DiagnoseContractOperations['reconcileContract']>
  >(() => {
    events.push('reconcile')
    return reconciled
  })
  const operations: DiagnoseContractOperations = {
    assertDatabaseHealthy: async (container) => {
      events.push('healthy')
      expect(container).toBe(DEFAULT_LOCAL_DATABASE_CONTAINER)
    },
    assertMigrationIdentity: async () => {
      events.push('migration-identity')
      return digest('migration')
    },
    assertOutputPath: async () => {
      events.push('output-path')
      return '/repo/backups/diagnostic'
    },
    assertRepositoryState: (state) => {
      events.push('repository-assert')
      expect(state.branch).toBe(POST_MIGRATION_RECONCILIATION_BRANCH)
    },
    auditLegacyState: (input) => {
      events.push('legacy-audit')
      expect(input.contractStateHashesBefore).toEqual(stateHashes())
      expect(input.contractStateHashes).toEqual(stateHashes())
      expect(input.preMigration.manifestSha256).toBe(digest('pre-backup-manifest'))
      return legacyAudit
    },
    buildActualIdentity: () => {
      events.push('actual-identity')
      return expected
    },
    buildAuditArtifactSet: () => {
      events.push('audit-artifacts')
      return baseArtifacts
    },
    buildExpectedRpcs: () => {
      events.push('expected-rpcs')
      return contractDiagnostics.functions
    },
    buildReconciledAudit: ({ reconciliation: supplied }) => {
      events.push('reconciled-audit')
      expect(supplied).toBe(reconciled)
      return reconciledAudit
    },
    collectContractEvidence: async (input) => {
      events.push('contract-diagnostics')
      expect(input?.container).toBe(DEFAULT_LOCAL_DATABASE_CONTAINER)
      return contractDiagnostics
    },
    collectSnapshot: async () => {
      events.push(events.includes('snapshot-before') ? 'snapshot-after' : 'snapshot-before')
      const value = snapshots.shift()
      if (!value) throw new Error('unexpected snapshot call')
      return value
    },
    collectStateHashes: async () => {
      events.push(events.includes('hashes-before') ? 'hashes-after' : 'hashes-before')
      const value = hashes.shift()
      if (!value) throw new Error('unexpected state-hash call')
      return value
    },
    inspectRepositoryState: async () => {
      events.push('repository-inspect')
      return {
        branch: POST_MIGRATION_RECONCILIATION_BRANCH,
        commonDir: '/repo/.git',
        gitDir: '/repo/.git/worktrees/codex-b',
        head: 'a'.repeat(40),
        mergeBaseWithOriginMain: 'b'.repeat(40),
        originMain: 'b'.repeat(40),
        trackedStatus: '',
      }
    },
    loadExpectedIdentity: async () => {
      events.push('expected-identity')
      return expected
    },
    loadPreMigrationBackup: async (_directory, manifestSha256) => {
      events.push('pre-backup')
      expect(manifestSha256).toBe(digest('pre-backup-manifest'))
      return preMigration
    },
    reconcileContract,
    resolveDockerTarget: async () => {
      events.push('docker-target')
      return {
        context: null,
        dockerArguments: ['--host', 'unix:///var/run/docker.sock'],
        endpoint: 'unix:///var/run/docker.sock',
        environment: { NODE_ENV: 'test' },
      }
    },
    runLint: async () => {
      events.push('lint')
      return []
    },
    trustedLocalProfile: () => {
      events.push('profile')
      return profile()
    },
    writeArtifactSet: async (input) => {
      events.push('write')
      await writeArtifactSet(input)
    },
  }
  return {
    events,
    operations,
    reconcileContract,
    snapshots,
    hashes,
    writeArtifactSet,
  }
}

describe('post-migration contract diagnostic orchestration', () => {
  test('brackets every diagnostic, binds the pre-backup, and writes sealed canonical evidence', async () => {
    const testHarness = harness()

    const result = await runDiagnoseGoldImportCompensationContract(CLI_ARGUMENTS, {
      cwd: '/repo',
      now: () => new Date('2026-08-09T12:00:00.000Z'),
      operations: testHarness.operations,
    })

    expect(testHarness.events).toEqual([
      'repository-inspect',
      'repository-assert',
      'migration-identity',
      'output-path',
      'pre-backup',
      'docker-target',
      'healthy',
      'snapshot-before',
      'hashes-before',
      'contract-diagnostics',
      'lint',
      'hashes-after',
      'snapshot-after',
      'legacy-audit',
      'expected-identity',
      'actual-identity',
      'expected-rpcs',
      'profile',
      'reconcile',
      'reconciled-audit',
      'audit-artifacts',
      'write',
    ])
    expect(result).toMatchObject({
      manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      outputDirectory: '/repo/backups/diagnostic',
      readinessStatus: 'ready',
      requestedNameDiscrepancies: [REQUESTED_RECONCILIATION_NAME_DISCREPANCY],
      status: 'ready',
    })

    const reconcileInput = testHarness.reconcileContract.mock.calls[0]?.[0]
    expect(reconcileInput?.actualRpcs.map(({ name }) => name)).toEqual(
      CONTRACT_DIAGNOSTIC_RPC_NAMES,
    )
    expect(reconcileInput?.auditExpectationDefects).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining('No compatibility alias is permitted'),
      }),
    ])
    const writeInput = testHarness.writeArtifactSet.mock.calls[0]?.[0]
    expect([...(writeInput?.artifacts.files ?? new Map()).keys()]).toEqual([
      'contract-diagnostics.json',
      'contract-reconciliation.json',
      'migration-audit.json',
      'migration-audit.md',
      'read-only-state-bracket.json',
    ])
    const writtenDiagnostics = JSON.parse(
      writeInput?.artifacts.files.get('contract-diagnostics.json') ?? '{}',
    ) as Record<string, unknown>
    expect(writtenDiagnostics.requestedNameDiscrepancies).toEqual([
      REQUESTED_RECONCILIATION_NAME_DISCREPANCY,
    ])
    expect(writeInput?.executionReceipt).toMatchObject({
      canonicalManifestSha256: result.manifestSha256,
      compensationExecuted: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      mode: 'read_only_diagnostic',
      preMigrationBackupManifestSha256: digest('pre-backup-manifest'),
      remoteDatabaseAccessed: false,
      schemaVersion: CONTRACT_DIAGNOSTIC_EXECUTION_SCHEMA_VERSION,
    })
  })

  test('fails closed before reconciliation or output when either state bracket drifts', async () => {
    const testHarness = harness()
    testHarness.hashes.splice(1, 1, stateHashes('changed'))

    await expect(
      runDiagnoseGoldImportCompensationContract(CLI_ARGUMENTS, {
        cwd: '/repo',
        operations: testHarness.operations,
      }),
    ).rejects.toThrow(/hashes changed during the read-only diagnostic/iu)
    expect(testHarness.reconcileContract).not.toHaveBeenCalled()
    expect(testHarness.writeArtifactSet).not.toHaveBeenCalled()

    expect(() =>
      buildReadOnlyContractDiagnosticBracket({
        contractStateHashesAfter: stateHashes(),
        contractStateHashesBefore: stateHashes(),
        preMigrationBackupManifestSha256: digest('manifest'),
        snapshotAfter: { ...snapshot(), schema: { changed: true } },
        snapshotBefore: snapshot(),
      }),
    ).toThrow(/snapshot changed/iu)
  })

  test('surfaces the wrong requested RPC as an audit defect without creating an alias', () => {
    const evidence = diagnostics()
    const defects = requestedRpcNameAuditExpectationDefects(expectedIdentity(), evidence)

    expect(defects).toEqual([
      {
        objectIdentity: expect.stringContaining('reconcile_literature_gold_review_operation_v1'),
        reason: expect.stringContaining('reconcile_literature_gold_import_v1'),
      },
    ])
    expect(evidence.functions.map(({ name }) => name)).not.toContain(
      REQUESTED_RECONCILIATION_NAME_DISCREPANCY.requestedName,
    )
    expect(REQUESTED_RECONCILIATION_NAME_DISCREPANCY.aliasCreated).toBe(false)
  })

  test('rejects write mode, missing backup binding, and an unsealed base artifact set', async () => {
    await expect(runDiagnoseGoldImportCompensationContract(['--commit'])).rejects.toThrow(
      /no commit or database-write mode/iu,
    )
    await expect(
      runDiagnoseGoldImportCompensationContract([
        '--pre-migration-backup',
        'pre-backup',
        '--output',
        'backups/diagnostic',
        '--backup-root',
        'backups',
      ]),
    ).rejects.toThrow(/manifest-sha256.*required/iu)

    const stateBracket = buildReadOnlyContractDiagnosticBracket({
      contractStateHashesAfter: stateHashes(),
      contractStateHashesBefore: stateHashes(),
      preMigrationBackupManifestSha256: digest('manifest'),
      snapshotAfter: snapshot(),
      snapshotBefore: snapshot(),
    })
    expect(() =>
      buildSealedContractDiagnosticArtifacts({
        auditArtifacts: {
          files: new Map([['migration-audit.json', '{}']]),
          manifest: 'tampered',
          manifestSha256: digest('tampered'),
        },
        bracket: stateBracket,
        diagnostics: diagnostics(),
        reconciliation: reconciliation(),
      }),
    ).toThrow(/not canonically sealed/iu)
  })
})
