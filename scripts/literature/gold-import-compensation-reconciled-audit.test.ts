/** @jest-environment node */

import {
  CONTRACT_DIAGNOSTICS_NORMALIZATION_RULE,
  CONTRACT_DIAGNOSTICS_SCHEMA_VERSION,
  CONTRACT_DIAGNOSTIC_RPC_NAMES,
  REQUESTED_RECONCILIATION_NAME_DISCREPANCY,
  type ExecutedContractDiagnostics,
  type ParsedContractDiagnostics,
} from './gold-import-compensation-contract-diagnostics'
import {
  TRUSTED_LOCAL_SUPABASE_POSTGRES_OWNER_ROLE_INVENTORY_SHA256,
  buildExpectedContractRpcs,
  loadExpectedSchemaSecurityIdentity,
  trustedLocalDeploymentProfileEvidence,
} from './gold-import-compensation-contract-expectations'
import {
  OWNER_ACL_AUDIT_READY_TERMINAL_STATE,
  projectRpcMetadataForDeploymentProfile,
  projectSchemaSecurityIdentityForDeploymentProfile,
  reconcileGoldImportCompensationContract,
  reconciliationIdentitySha256,
  type RoleSecurityAttributes,
} from './gold-import-compensation-contract-reconciliation'
import {
  AUDIT_SCHEMA_VERSION,
  IMPORT_COMPENSATION_MIGRATION_ID,
  IMPORT_COMPENSATION_MIGRATION_SHA256,
  buildAuditArtifacts,
  canonicalJson,
  sealCanonicalArtifacts,
  type AuditResult,
  type RawDatabaseSnapshot,
} from './gold-import-compensation-migration-operations'
import {
  generateGoldImportCompensationPackage,
  verifyReadyPostMigrationAuditPackage,
  type ReconciledAuditEvidenceBytes,
} from './generate-gold-import-compensation-package-v1'
import {
  buildReadOnlyContractDiagnosticBracket,
  buildSealedContractDiagnosticArtifacts,
} from './diagnose-gold-import-compensation-contract'
import {
  EXACT_SUPERSEDED_LEGACY_FAILURES,
  RECONCILED_POST_MIGRATION_AUDIT_SCHEMA_VERSION,
  buildReconciledPostMigrationAudit,
  validateReadyLocalPostMigrationContractReconciliation,
  type BuildReconciledPostMigrationAuditInput,
} from './gold-import-compensation-reconciled-audit'
import { schemaSecurityDefinitionIdentitySha256 } from './gold-import-compensation-rehearsal-evidence'

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

function trustedLocalRoles(): RoleSecurityAttributes[] {
  return [
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
}

const EMPTY_SNAPSHOT: RawDatabaseSnapshot = {
  database: { readOnlyTransaction: true },
  developmentItems: [],
  developmentSeed: {},
  migrationLedger: [],
  schema: {},
  scope: { datasetSplit: 'development' },
  testAggregate: {},
}

function legacyAudit(actualIdentity: AuditResult['schemaSecurityDefinitionIdentity']): AuditResult {
  if (!actualIdentity) throw new Error('test schema/security identity is missing')
  const unchangedStateSha256 = '1'.repeat(64)
  const schemaSecurityIdentitySha256 = schemaSecurityDefinitionIdentitySha256(actualIdentity)
  return {
    markdown: '# Legacy blocked audit\n',
    report: {
      checks: {
        behavioralProbe: 'none_on_real_batch_static_contract_and_snapshot_only',
        compensationExecuted: false,
        databaseMutationCount: 0,
        expectedSchemaSecurityIdentitySha256: schemaSecurityIdentitySha256,
        failures: [...EXACT_SUPERSEDED_LEGACY_FAILURES],
        importExecuted: false,
        lint: { errorCount: 0 },
        schemaSecurityDefinitionIdentity: actualIdentity,
        security: { passed: false },
      },
      comparisons: {
        aggregateTestLockStateUnchanged: true,
        effectiveStatePreserved: true,
        pointerMutationCount: 0,
        postContractPhysicalStateSha256: unchangedStateSha256,
        postEffectiveStateSha256: unchangedStateSha256,
        postSchemaSecurityIdentitySha256: schemaSecurityIdentitySha256,
        preEffectiveStateSha256: unchangedStateSha256,
        preSchemaSecurityIdentitySha256: '2'.repeat(64),
        preexistingPhysicalStateAfterSha256: unchangedStateSha256,
        preexistingPhysicalStateBeforeSha256: unchangedStateSha256,
        priorMigrationLedgerRowsUnchanged: true,
        priorPhysicalStatePreserved: true,
        reviewMutationCount: 0,
        schemaChangedAsExpected: false,
      },
      database: {
        batchId: '00000000-0000-4000-8000-000000000001',
        currentEffectiveStateSha256: unchangedStateSha256,
        currentPhysicalStateSha256: unchangedStateSha256,
        currentPointersAreLatestHeads: true,
        developmentMembershipSha256: '3'.repeat(64),
        developmentPlanningStateSha256: '4'.repeat(64),
        heldOutIdentitiesAccessed: false,
        preMigrationBackupManifestSha256: '5'.repeat(64),
        readOnlyAudit: true,
        remoteWritesAllowed: false,
        repositoryCommitSha: 'a'.repeat(40),
        revisionChainsLinear: true,
        schemaSecurityIdentitySha256,
        stateFresh: true,
        targetDatabase: 'local',
        testSplitLocked: true,
      },
      migration: {
        applied: true,
        id: IMPORT_COMPENSATION_MIGRATION_ID,
        ledgerOccurrences: 1,
        sha256: IMPORT_COMPENSATION_MIGRATION_SHA256,
      },
      readinessStatus: 'blocked',
      schemaVersion: AUDIT_SCHEMA_VERSION,
      status: 'blocked',
    },
    schemaSecurityDefinitionIdentity: actualIdentity,
    schemaSecurityIdentitySha256,
  }
}

async function readyInput(): Promise<BuildReconciledPostMigrationAuditInput> {
  const expectedIdentity = await loadExpectedSchemaSecurityIdentity(process.cwd())
  const actualIdentity = projectSchemaSecurityIdentityForDeploymentProfile(
    expectedIdentity,
    'local_supabase_postgres_owner_v1',
  )
  const expectedRpcs = buildExpectedContractRpcs(expectedIdentity)
  const actualRpcs = expectedRpcs.map((rpc) =>
    projectRpcMetadataForDeploymentProfile(rpc, 'local_supabase_postgres_owner_v1'),
  )
  const expectedProfile = trustedLocalDeploymentProfileEvidence(trustedLocalRoles())
  const canonicalReconciliationFunction = expectedIdentity.records.find(
    ({ objectName, objectType }) =>
      objectType === 'function' &&
      objectName === REQUESTED_RECONCILIATION_NAME_DISCREPANCY.canonicalName,
  )
  if (!canonicalReconciliationFunction) {
    throw new Error('test fixture is missing the canonical reconciliation function')
  }
  const reconciliation = reconcileGoldImportCompensationContract({
    actualIdentity,
    actualProfile: expectedProfile,
    actualRpcs,
    auditExpectationDefects: [
      {
        objectIdentity: canonicalReconciliationFunction.objectIdentity,
        reason: `Historical audit requested ${REQUESTED_RECONCILIATION_NAME_DISCREPANCY.requestedName}; the canonical RPC is ${REQUESTED_RECONCILIATION_NAME_DISCREPANCY.canonicalName}. No compatibility alias is permitted.`,
      },
    ],
    expectedIdentity,
    expectedProfile,
    expectedRpcs,
  })
  return {
    legacyAudit: legacyAudit(actualIdentity),
    reconciliation,
    requestedNameDiscrepancies: [REQUESTED_RECONCILIATION_NAME_DISCREPANCY],
    snapshot: EMPTY_SNAPSHOT,
  }
}

describe('reconciled gold import-compensation audit', () => {
  let baseInput: BuildReconciledPostMigrationAuditInput

  beforeAll(async () => {
    baseInput = await readyInput()
  })

  function input(): BuildReconciledPostMigrationAuditInput {
    return structuredClone(baseInput)
  }

  it('pins the exact real-local role inventory and rejects any role-attribute drift', () => {
    const profile = trustedLocalDeploymentProfileEvidence(trustedLocalRoles())
    expect(reconciliationIdentitySha256(profile.roleInventory)).toBe(
      TRUSTED_LOCAL_SUPABASE_POSTGRES_OWNER_ROLE_INVENTORY_SHA256,
    )

    const changedRoles = trustedLocalRoles()
    const postgres = changedRoles.find(({ roleName }) => roleName === 'postgres')
    if (!postgres?.attributes) throw new Error('test postgres role is missing')
    postgres.attributes.superuser = true
    expect(() => trustedLocalDeploymentProfileEvidence(changedRoles)).toThrow(
      /differs from the trusted profile/iu,
    )
  })

  it('retains complete profile diffs and exact requested-name discrepancy evidence', () => {
    const prepared = input()
    const result = buildReconciledPostMigrationAudit(prepared)
    const checks = result.report.checks as Record<string, unknown>
    const evidence = checks.contractReconciliation as Record<string, unknown>

    expect(result.report).toMatchObject({
      readinessStatus: 'ready',
      schemaVersion: RECONCILED_POST_MIGRATION_AUDIT_SCHEMA_VERSION,
      status: 'ready',
    })
    expect(evidence.profileDiffs).toEqual(prepared.reconciliation.profileDiffs)
    expect(evidence.classificationPartitions).toEqual(
      prepared.reconciliation.classificationPartitions,
    )
    expect(evidence.schemaSecurityRecordClassificationCounts).toEqual(
      prepared.reconciliation.classificationPartitions.schemaSecurityRecords.classificationCounts,
    )
    expect(evidence.rpcClassificationCounts).toEqual(
      prepared.reconciliation.classificationPartitions.rpcs.classificationCounts,
    )
    expect(evidence.deploymentProfileClassificationCounts).toEqual(
      prepared.reconciliation.classificationPartitions.deploymentProfile.classificationCounts,
    )
    expect(evidence.combinedClassificationCounts).toEqual(
      prepared.reconciliation.classificationPartitions.combined.classificationCounts,
    )
    expect(evidence.ownerAclTerminalState).toBe(OWNER_ACL_AUDIT_READY_TERMINAL_STATE)
    expect(evidence.requestedNameDiscrepancies).toEqual([REQUESTED_RECONCILIATION_NAME_DISCREPANCY])
    expect(evidence).not.toBe(prepared.reconciliation)
    expect(checks.legacyOwnerSpecificFailures).toEqual(EXACT_SUPERSEDED_LEGACY_FAILURES)
    expect(checks.ownerAclTerminalState).toBe(OWNER_ACL_AUDIT_READY_TERMINAL_STATE)
    expect(checks.failures).toEqual([])
    expect(result.markdown).toContain('- Owner/ACL forward migration required: `false`')
    expect(result.markdown).toContain(
      `- Owner/ACL terminal: \`${OWNER_ACL_AUDIT_READY_TERMINAL_STATE}\``,
    )
    expect(result.markdown).toContain(
      '- Scope: this owner/ACL reconciliation is separate from the overall import-contract forward-repair decision and does not declare that overall repair unnecessary.',
    )
    expect(result.markdown).toContain(
      '- Schema/security records (total `763`): `identical=20`, `environment_representation_only=219`, `explicitly_supported_local_profile=523`, `missing_expected_object=0`, `unexpected_object=0`, `semantic_contract_difference=0`, `security_contract_difference=0`, `audit_expectation_defect=1`',
    )
    expect(result.markdown).toContain(
      '- RPCs (total `3`): `identical=0`, `environment_representation_only=0`, `explicitly_supported_local_profile=3`, `missing_expected_object=0`, `unexpected_object=0`, `semantic_contract_difference=0`, `security_contract_difference=0`, `audit_expectation_defect=0`',
    )
    expect(result.markdown).toContain(
      '- Deployment profile (total `6`): `identical=6`, `environment_representation_only=0`, `explicitly_supported_local_profile=0`, `missing_expected_object=0`, `unexpected_object=0`, `semantic_contract_difference=0`, `security_contract_difference=0`, `audit_expectation_defect=0`',
    )
    expect(result.markdown).toContain(
      '- Combined (total `772`): `identical=26`, `environment_representation_only=219`, `explicitly_supported_local_profile=526`, `missing_expected_object=0`, `unexpected_object=0`, `semantic_contract_difference=0`, `security_contract_difference=0`, `audit_expectation_defect=1`',
    )
  })

  it('rebuilds serialized reconciliation evidence instead of trusting declared hashes', () => {
    const prepared = input()
    expect(validateReadyLocalPostMigrationContractReconciliation(prepared.reconciliation)).toEqual(
      prepared.reconciliation,
    )

    const forged = structuredClone(prepared.reconciliation)
    forged.identities.actual.contractInvariant.sha256 = '0'.repeat(64)
    expect(() => validateReadyLocalPostMigrationContractReconciliation(forged)).toThrow(
      /exact ready local|checksum binding|independently rebuilt reconciliation/u,
    )

    const forgedArithmetic = structuredClone(prepared.reconciliation)
    forgedArithmetic.classificationPartitions.combined.total -= 1
    expect(() => validateReadyLocalPostMigrationContractReconciliation(forgedArithmetic)).toThrow(
      /partition 763 schema records|independently rebuilt reconciliation/u,
    )
  })

  it('authenticates the exact seven-file diagnostic bundle and cross-binds its evidence', () => {
    const prepared = input()
    const audit = buildReconciledPostMigrationAudit(prepared)
    const database = audit.report.database as Record<string, string>
    const actualInventory =
      prepared.reconciliation.identities.actual.fullEnvironmentInventory.identity
    const diagnostics: ExecutedContractDiagnostics = {
      canonicalRpcNames: CONTRACT_DIAGNOSTIC_RPC_NAMES,
      functions: structuredClone(
        actualInventory.rpcs,
      ) as unknown as ExecutedContractDiagnostics['functions'],
      normalizationRule: CONTRACT_DIAGNOSTICS_NORMALIZATION_RULE,
      readOnlyTransaction: true,
      requestedNameDiscrepancies: [REQUESTED_RECONCILIATION_NAME_DISCREPANCY],
      roles: structuredClone(
        actualInventory.deploymentProfile.roleInventory,
      ) as unknown as ExecutedContractDiagnostics['roles'],
      schemaVersion: CONTRACT_DIAGNOSTICS_SCHEMA_VERSION,
      target: {
        container: 'supabase_db_ip-literature-local',
        database: 'postgres',
        local: true,
        port: '55322',
        projectId: 'ip-literature-local',
      },
      transactionIsolation: 'repeatable read',
    }
    const stateHashes = {
      developmentMembershipSha256: database.developmentMembershipSha256 as string,
      effectiveStateSha256: database.currentEffectiveStateSha256 as string,
      physicalStateSha256: database.currentPhysicalStateSha256 as string,
      readOnlyTransaction: true as const,
    }
    const bracket = buildReadOnlyContractDiagnosticBracket({
      contractStateHashesAfter: stateHashes,
      contractStateHashesBefore: stateHashes,
      preMigrationBackupManifestSha256: database.preMigrationBackupManifestSha256 as string,
      snapshotAfter: prepared.snapshot,
      snapshotBefore: prepared.snapshot,
    })
    const artifacts = buildSealedContractDiagnosticArtifacts({
      auditArtifacts: buildAuditArtifacts({ audit, snapshot: prepared.snapshot }),
      bracket,
      diagnostics,
      reconciliation: prepared.reconciliation,
    })
    expect([...artifacts.files.keys()]).toHaveLength(7)

    const verify = (sealed: typeof artifacts) => {
      const bytes = (name: string) => {
        const text = sealed.files.get(name)
        if (text === undefined) throw new Error(`missing test artifact ${name}`)
        return Buffer.from(text, 'utf8')
      }
      const reconciledEvidence: ReconciledAuditEvidenceBytes = {
        contractDiagnosticsBytes: bytes('contract-diagnostics.json'),
        contractReconciliationBytes: bytes('contract-reconciliation.json'),
        readOnlyStateBracketBytes: bytes('read-only-state-bracket.json'),
      }
      return verifyReadyPostMigrationAuditPackage({
        auditBytes: bytes('migration-audit.json'),
        developmentPlanningStateBytes: bytes('development-planning-state.json'),
        manifestBytes: Buffer.from(sealed.manifest, 'utf8'),
        markdownBytes: bytes('migration-audit.md'),
        reconciledEvidence,
        schemaSecurityDefinitionIdentityBytes: bytes('schema-security-definition-identity.json'),
        trustedManifestSha256: sealed.manifestSha256,
      })
    }
    const verified = verify(artifacts)
    expect(verified.reconciledEvidence).not.toBeNull()
    const mutableEnvironment = process.env as Record<string, string | undefined>
    const previousNodeEnvironment = mutableEnvironment.NODE_ENV
    mutableEnvironment.NODE_ENV = 'production'
    try {
      expect(() =>
        generateGoldImportCompensationPackage({
          auditPackage: verified,
          sources: {
            amendedAuthorization: Buffer.from('invalid\n'),
            finalArtifact: Buffer.from('invalid\n'),
            migration: Buffer.from('invalid\n'),
            protocolAuthorization: Buffer.from('invalid\n'),
          },
        }),
      ).toThrow(/Finalized V3 development artifact checksum mismatch/u)
    } finally {
      mutableEnvironment.NODE_ENV = previousNodeEnvironment
    }

    const tamperedFiles = new Map(artifacts.files)
    const tamperedDiagnostics = JSON.parse(
      tamperedFiles.get('contract-diagnostics.json') ?? '{}',
    ) as Record<string, unknown>
    tamperedDiagnostics.functions = [...(tamperedDiagnostics.functions as unknown[])].reverse()
    tamperedFiles.set('contract-diagnostics.json', canonicalJson(tamperedDiagnostics))
    expect(() => verify(sealCanonicalArtifacts(tamperedFiles))).toThrow(
      /does not match the migration-audit reconciliation binding/u,
    )
  })

  it.each(['missing', 'duplicate', 'additional'] as const)(
    'supersedes only the exact legacy owner-profile failures (%s case)',
    (mutation) => {
      const prepared = input()
      const checks = prepared.legacyAudit.report.checks as { failures: string[] }
      if (mutation === 'missing') checks.failures.pop()
      if (mutation === 'duplicate') checks.failures.push(checks.failures[0] as string)
      if (mutation === 'additional') checks.failures.push('Some unrelated failure.')

      expect(() => buildReconciledPostMigrationAudit(prepared)).toThrow(
        /not the exact superseded local owner-profile failures/iu,
      )
    },
  )

  it('rejects omitted profile evidence and altered requested-name discrepancy evidence', () => {
    const missingProfileDiffs = input()
    missingProfileDiffs.reconciliation.profileDiffs = []
    expect(() => buildReconciledPostMigrationAudit(missingProfileDiffs)).toThrow(
      /profile evidence is incomplete/iu,
    )

    const alteredName = input()
    alteredName.requestedNameDiscrepancies = [
      {
        ...REQUESTED_RECONCILIATION_NAME_DISCREPANCY,
        aliasCreated: true,
      },
    ] as unknown as ParsedContractDiagnostics['requestedNameDiscrepancies']
    expect(() => buildReconciledPostMigrationAudit(alteredName)).toThrow(
      /not the exact diagnosed defect/iu,
    )
  })
})
