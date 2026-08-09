import {
  AUDIT_SCHEMA_VERSION,
  IMPORT_COMPENSATION_MIGRATION_ID,
  IMPORT_COMPENSATION_MIGRATION_SHA256,
  buildDevelopmentPlanningState,
  canonicalJson,
  developmentPlanningStateSha256,
  type AuditResult,
  type RawDatabaseSnapshot,
} from './gold-import-compensation-migration-operations'
import {
  GOLD_IMPORT_COMPENSATION_RECONCILIATION_SCHEMA_VERSION,
  reconcileGoldImportCompensationContract,
  reconciliationIdentitySha256,
  type GoldImportCompensationContractReconciliation,
} from './gold-import-compensation-contract-reconciliation'
import { REQUESTED_RECONCILIATION_NAME_DISCREPANCY } from './gold-import-compensation-contract-diagnostics'
import { trustedLocalDeploymentProfileEvidence } from './gold-import-compensation-contract-expectations'
import { schemaSecurityDefinitionIdentitySha256 } from './gold-import-compensation-rehearsal-evidence'

export const RECONCILED_POST_MIGRATION_AUDIT_SCHEMA_VERSION =
  'gold-import-compensation-reconciled-migration-audit/1.0.0' as const

export const EXACT_SUPERSEDED_LEGACY_FAILURES = [
  'apply_literature_gold_import_v1 has unexpected owner postgres; expected supabase_admin.',
  'RPC execution contract mismatch for apply_literature_gold_import_v1.',
  'RPC execution contract mismatch for compensate_literature_gold_import_v1.',
  'RPC execution contract mismatch for reconcile_literature_gold_review_operation_v1.',
] as const

export type RequestedReconciliationNameDiscrepancies = readonly [
  typeof REQUESTED_RECONCILIATION_NAME_DISCREPANCY,
]

export interface ReconciledContractReconciliationEvidence extends GoldImportCompensationContractReconciliation {
  requestedNameDiscrepancies: RequestedReconciliationNameDiscrepancies
}

export interface BuildReconciledPostMigrationAuditInput {
  legacyAudit: AuditResult
  reconciliation: GoldImportCompensationContractReconciliation
  requestedNameDiscrepancies: RequestedReconciliationNameDiscrepancies
  snapshot: RawDatabaseSnapshot
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be a string array.`)
  }
  return value as string[]
}

function assertLegacyStateSafety(report: Record<string, unknown>): void {
  const migration = record(report.migration, 'legacy audit migration')
  const database = record(report.database, 'legacy audit database')
  const comparisons = record(report.comparisons, 'legacy audit comparisons')
  const checks = record(report.checks, 'legacy audit checks')
  if (
    report.schemaVersion !== AUDIT_SCHEMA_VERSION ||
    report.status !== 'blocked' ||
    report.readinessStatus !== 'blocked'
  ) {
    throw new Error('Reconciliation requires the canonical owner-blocked migration audit.')
  }
  if (
    migration.id !== IMPORT_COMPENSATION_MIGRATION_ID ||
    migration.sha256 !== IMPORT_COMPENSATION_MIGRATION_SHA256 ||
    migration.applied !== true ||
    migration.ledgerOccurrences !== 1
  ) {
    throw new Error('Legacy audit does not bind the exact once-applied migration.')
  }
  if (
    database.targetDatabase !== 'local' ||
    database.readOnlyAudit !== true ||
    database.remoteWritesAllowed !== false ||
    database.heldOutIdentitiesAccessed !== false ||
    database.stateFresh !== true ||
    database.testSplitLocked !== true ||
    database.revisionChainsLinear !== true ||
    database.currentPointersAreLatestHeads !== true
  ) {
    throw new Error('Legacy audit local/read-only/state-safety gates did not all pass.')
  }
  if (
    comparisons.effectiveStatePreserved !== true ||
    comparisons.priorPhysicalStatePreserved !== true ||
    comparisons.priorMigrationLedgerRowsUnchanged !== true ||
    comparisons.aggregateTestLockStateUnchanged !== true ||
    comparisons.reviewMutationCount !== 0 ||
    comparisons.pointerMutationCount !== 0 ||
    comparisons.preEffectiveStateSha256 !== comparisons.postEffectiveStateSha256 ||
    comparisons.preexistingPhysicalStateBeforeSha256 !==
      comparisons.preexistingPhysicalStateAfterSha256
  ) {
    throw new Error('Legacy audit detected database-state or review-history drift.')
  }
  if (
    checks.databaseMutationCount !== 0 ||
    checks.importExecuted !== false ||
    checks.compensationExecuted !== false
  ) {
    throw new Error('Legacy audit does not prove a zero-mutation diagnostic run.')
  }
  const failures = stringArray(checks.failures, 'legacy audit failures')
  if (canonicalJson(failures) !== canonicalJson(EXACT_SUPERSEDED_LEGACY_FAILURES)) {
    throw new Error(
      'Legacy audit failures are not the exact superseded local owner-profile failures.',
    )
  }
}

function assertIdentityBindings(reconciliation: GoldImportCompensationContractReconciliation) {
  for (const side of ['expected', 'actual'] as const) {
    const identities = reconciliation.identities[side]
    for (const identityName of [
      'contractInvariant',
      'deploymentProfile',
      'fullEnvironmentInventory',
    ] as const) {
      const binding = identities[identityName]
      if (reconciliationIdentitySha256(binding.identity) !== binding.sha256) {
        throw new Error(
          `Contract reconciliation ${side}.${identityName} checksum binding is inconsistent.`,
        )
      }
    }
  }
  for (const [side, binding] of [
    ['expected', reconciliation.deploymentProfile.expectedIdentity],
    ['actual', reconciliation.deploymentProfile.actualIdentity],
  ] as const) {
    if (reconciliationIdentitySha256(binding.identity) !== binding.sha256) {
      throw new Error(`Deployment-profile ${side} checksum binding is inconsistent.`)
    }
  }
  if (
    canonicalJson(reconciliation.deploymentProfile.expectedIdentity) !==
      canonicalJson(reconciliation.identities.expected.deploymentProfile) ||
    canonicalJson(reconciliation.deploymentProfile.actualIdentity) !==
      canonicalJson(reconciliation.identities.actual.deploymentProfile)
  ) {
    throw new Error('Deployment-profile validation and reconciliation identities diverge.')
  }
}

function assertPinnedLocalRoleInventories(
  reconciliation: GoldImportCompensationContractReconciliation,
): void {
  for (const side of ['expected', 'actual'] as const) {
    const identities = reconciliation.identities[side]
    const profileIdentity = identities.deploymentProfile.identity
    const inventoryProfile = identities.fullEnvironmentInventory.identity.deploymentProfile
    if (
      profileIdentity.profileId !== 'local_supabase_postgres_owner_v1' ||
      profileIdentity.target !== 'local' ||
      inventoryProfile.profileId !== 'local_supabase_postgres_owner_v1' ||
      inventoryProfile.target !== 'local'
    ) {
      throw new Error(`${side} reconciliation identities do not use the exact local profile.`)
    }
    const profileEvidence = trustedLocalDeploymentProfileEvidence(profileIdentity.roleInventory)
    const inventoryEvidence = trustedLocalDeploymentProfileEvidence(inventoryProfile.roleInventory)
    if (canonicalJson(profileEvidence) !== canonicalJson(inventoryEvidence)) {
      throw new Error(`${side} reconciliation identities bind different local role inventories.`)
    }
  }
}

function assertRequestedNameDiscrepancies(
  discrepancies: RequestedReconciliationNameDiscrepancies,
): void {
  if (canonicalJson(discrepancies) !== canonicalJson([REQUESTED_RECONCILIATION_NAME_DISCREPANCY])) {
    throw new Error('Requested-name discrepancy evidence is not the exact diagnosed defect.')
  }
}

function assertReadyReconciliation(
  reconciliation: GoldImportCompensationContractReconciliation,
): void {
  if (
    reconciliation.schemaVersion !== GOLD_IMPORT_COMPENSATION_RECONCILIATION_SCHEMA_VERSION ||
    !reconciliation.ready ||
    reconciliation.readinessBlockers.length !== 0 ||
    !reconciliation.invariantIdentityMatches ||
    !reconciliation.deploymentProfile.passed ||
    !reconciliation.completeness.complete ||
    !reconciliation.ownerRepresentation.isExact763To683OwnerRepresentation ||
    reconciliation.completeness.expectedRecordCount !== 763 ||
    reconciliation.completeness.actualRecordCount !== 683 ||
    reconciliation.completeness.expectedRecordsAccountedFor !== 763 ||
    reconciliation.completeness.actualRecordsAccountedFor !== 683 ||
    reconciliation.recordDiffs.length !== 763 ||
    reconciliation.rpcDiffs.length !== 3 ||
    reconciliation.ownerRepresentation.expectedRecordCount !== 763 ||
    reconciliation.ownerRepresentation.actualRecordCount !== 683 ||
    reconciliation.ownerRepresentation.recordCountDelta !== 80 ||
    reconciliation.ownerRepresentation.projectedExpectedRecordCount !== 683 ||
    reconciliation.ownerRepresentation.collapsedExpectedRecordCount !== 80 ||
    !reconciliation.ownerRepresentation.projectionExactlyMatchesActual ||
    reconciliation.identities.expected.contractInvariant.sha256 !==
      reconciliation.identities.actual.contractInvariant.sha256 ||
    reconciliation.deploymentProfile.expectedIdentity.sha256 !==
      reconciliation.deploymentProfile.actualIdentity.sha256 ||
    reconciliation.identities.actual.deploymentProfile.identity.profileId !==
      'local_supabase_postgres_owner_v1' ||
    reconciliation.identities.actual.deploymentProfile.identity.target !== 'local'
  ) {
    throw new Error('Contract reconciliation is not the exact ready local postgres-owner profile.')
  }
  if (
    reconciliation.profileDiffs.length === 0 ||
    reconciliation.profileDiffs.some(
      (difference) =>
        difference.classification !== 'identical' ||
        difference.changedPaths.length !== 0 ||
        canonicalJson(difference.expected) !== canonicalJson(difference.actual),
    )
  ) {
    throw new Error('Contract reconciliation profile evidence is incomplete or non-identical.')
  }
  assertIdentityBindings(reconciliation)
  assertPinnedLocalRoleInventories(reconciliation)
}

/**
 * Rebuild and validate a serialized reconciliation at a package/audit trust
 * boundary. This deliberately does not trust self-declared identity hashes,
 * classifications, counts, role inventories, or diff records.
 */
export function validateReadyLocalPostMigrationContractReconciliation(
  value: unknown,
): GoldImportCompensationContractReconciliation {
  const candidateRecord = record(value, 'contract reconciliation')
  if (candidateRecord.schemaVersion !== GOLD_IMPORT_COMPENSATION_RECONCILIATION_SCHEMA_VERSION) {
    throw new Error('Contract reconciliation has an unsupported schema version.')
  }
  const candidate = structuredClone(
    candidateRecord,
  ) as unknown as GoldImportCompensationContractReconciliation
  assertReadyReconciliation(candidate)
  const expectedInventory = candidate.identities.expected.fullEnvironmentInventory.identity
  const actualInventory = candidate.identities.actual.fullEnvironmentInventory.identity
  const canonicalFunctionRecords =
    expectedInventory.schemaSecurityDefinitionIdentity.records.filter(
      ({ objectName, objectType }) =>
        objectType === 'function' &&
        objectName === REQUESTED_RECONCILIATION_NAME_DISCREPANCY.canonicalName,
    )
  if (canonicalFunctionRecords.length !== 1) {
    throw new Error('Contract reconciliation does not contain one canonical reconciliation RPC.')
  }
  const rebuilt = reconcileGoldImportCompensationContract({
    actualIdentity: actualInventory.schemaSecurityDefinitionIdentity,
    actualProfile: actualInventory.deploymentProfile,
    actualRpcs: actualInventory.rpcs,
    auditExpectationDefects: [
      {
        objectIdentity: canonicalFunctionRecords[0]?.objectIdentity ?? '',
        reason: `Historical audit requested ${REQUESTED_RECONCILIATION_NAME_DISCREPANCY.requestedName}; the canonical RPC is ${REQUESTED_RECONCILIATION_NAME_DISCREPANCY.canonicalName}. No compatibility alias is permitted.`,
      },
    ],
    expectedIdentity: expectedInventory.schemaSecurityDefinitionIdentity,
    expectedProfile: expectedInventory.deploymentProfile,
    expectedRpcs: expectedInventory.rpcs,
  })
  if (canonicalJson(rebuilt) !== canonicalJson(candidate)) {
    throw new Error(
      'Serialized contract reconciliation does not equal the independently rebuilt reconciliation.',
    )
  }
  return rebuilt
}

export function buildReconciledPostMigrationAudit(
  input: BuildReconciledPostMigrationAuditInput,
): AuditResult {
  assertLegacyStateSafety(input.legacyAudit.report)
  validateReadyLocalPostMigrationContractReconciliation(input.reconciliation)
  assertRequestedNameDiscrepancies(input.requestedNameDiscrepancies)
  if (!input.legacyAudit.schemaSecurityDefinitionIdentity) {
    throw new Error('Legacy audit is missing its actual schema/security definition inventory.')
  }
  const actualSchemaIdentitySha256 = schemaSecurityDefinitionIdentitySha256(
    input.legacyAudit.schemaSecurityDefinitionIdentity,
  )
  if (actualSchemaIdentitySha256 !== input.legacyAudit.schemaSecurityIdentitySha256) {
    throw new Error('Legacy schema/security inventory checksum binding is inconsistent.')
  }
  const reconciledActualSchemaIdentitySha256 = schemaSecurityDefinitionIdentitySha256(
    input.reconciliation.identities.actual.fullEnvironmentInventory.identity
      .schemaSecurityDefinitionIdentity,
  )
  if (reconciledActualSchemaIdentitySha256 !== actualSchemaIdentitySha256) {
    throw new Error('Legacy audit and contract reconciliation bind different actual schemas.')
  }
  const planningStateSha256 = developmentPlanningStateSha256(input.snapshot)
  const legacyReport = structuredClone(input.legacyAudit.report)
  const database = record(legacyReport.database, 'legacy audit database')
  const comparisons = record(legacyReport.comparisons, 'legacy audit comparisons')
  const checks = record(legacyReport.checks, 'legacy audit checks')
  const legacyOwnerSpecificFailures = stringArray(checks.failures, 'legacy audit failures')
  const actualIdentities = input.reconciliation.identities.actual
  const expectedIdentities = input.reconciliation.identities.expected
  const contractReconciliation: ReconciledContractReconciliationEvidence = {
    ...structuredClone(input.reconciliation),
    requestedNameDiscrepancies: structuredClone(input.requestedNameDiscrepancies),
  }

  database.developmentPlanningStateSha256 = planningStateSha256
  database.contractInvariantIdentitySha256 = actualIdentities.contractInvariant.sha256
  database.environmentProfileIdentitySha256 = actualIdentities.deploymentProfile.sha256
  database.fullEnvironmentInventoryIdentitySha256 = actualIdentities.fullEnvironmentInventory.sha256
  database.deploymentProfileId = 'local_supabase_postgres_owner_v1'
  comparisons.schemaChangedAsExpected = true
  checks.failures = []
  checks.legacyOwnerSpecificFailures = legacyOwnerSpecificFailures
  checks.expectedSchemaSecurityIdentitySha256 = actualSchemaIdentitySha256
  checks.security = {
    contractInvariantExact:
      actualIdentities.contractInvariant.sha256 === expectedIdentities.contractInvariant.sha256,
    deploymentProfileExact: input.reconciliation.deploymentProfile.passed,
    fullEnvironmentInventoryUsedForReadiness: false,
    profileId: 'local_supabase_postgres_owner_v1',
    validation: 'environment_invariant_plus_explicit_deployment_profile',
  }
  checks.contractReconciliation = contractReconciliation
  checks.forwardMigrationRequired = false

  const report = {
    ...legacyReport,
    schemaVersion: RECONCILED_POST_MIGRATION_AUDIT_SCHEMA_VERSION,
    status: 'ready',
    readinessStatus: 'ready',
    result: 'audit_ready_contract_compatibility_audit_required',
    database,
    comparisons,
    checks,
  }
  const markdown = `# Reconciled gold import-compensation migration audit

- Status: \`ready\`
- Forward repair migration required: \`false\`
- Deployment profile: \`local_supabase_postgres_owner_v1\`
- Environment-invariant identity: \`${actualIdentities.contractInvariant.sha256}\`
- Deployment-profile identity: \`${actualIdentities.deploymentProfile.sha256}\`
- Full environment inventory identity: \`${actualIdentities.fullEnvironmentInventory.sha256}\`
- Expected/actual semantic records: \`${input.reconciliation.ownerRepresentation.expectedRecordCount}/${input.reconciliation.ownerRepresentation.actualRecordCount}\`
- Collapsed owner ACL records: \`${input.reconciliation.ownerRepresentation.collapsedExpectedRecordCount}\`
- Database mutation count: \`0\`
- Held-out identities accessed: \`false\`
- Import executed: \`false\`
- Compensation executed: \`false\`
`
  // Build once here so callers cannot accidentally publish a different planning projection.
  canonicalJson(buildDevelopmentPlanningState(input.snapshot))
  return {
    report,
    markdown,
    schemaSecurityDefinitionIdentity: input.legacyAudit.schemaSecurityDefinitionIdentity,
    schemaSecurityIdentitySha256: actualSchemaIdentitySha256,
  }
}
