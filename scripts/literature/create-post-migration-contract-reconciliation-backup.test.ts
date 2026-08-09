/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson as compactCanonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import { canonicalJson, sha256 } from './gold-import-compensation-migration-operations'
import { COMPATIBILITY_PROJECTION_FIELDS } from './gold-import-compensation-compatibility'
import {
  GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
  GOLD_IMPORT_NOTE_DISPOSITION,
  GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SCHEMA_VERSION,
  GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION,
  GOLD_IMPORT_NOTE_DISPOSITION_STATUS,
} from './gold-import-note-disposition'
import {
  GOLD_IMPORT_DIFF_STAT_RECONCILIATION_SCHEMA_VERSION,
  POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE,
  POST_MIGRATION_RECONCILIATION_MERGE_READINESS_REPORT_SCHEMA_VERSION,
  POST_MIGRATION_RECONCILIATION_TEST_BUILD_REPORT_SCHEMA_VERSION,
  buildSemanticDiffPatch,
  canonicalReport,
  preserveAuditDirectory,
  preserveChangedTrackedFiles,
  runCreatePostMigrationContractReconciliationBackup,
  strictMergeReadinessReport,
  strictDiffStatReconciliationReport,
  strictTestBuildReport,
} from './create-post-migration-contract-reconciliation-backup'

const EXECUTION_BLOCKER_CODES = [
  'excluded_status_null_not_representable_by_import_contract_v1',
  'source_review_blinding_provenance_has_no_exact_import_v1_mapping',
  'source_full_text_provenance_has_no_exact_import_v1_mapping',
] as const
const TERMINAL_BLOCKERS = EXECUTION_BLOCKER_CODES

const TEST_BUILD_CHECK_IDS = [
  'completeRepositorySuite',
  'eslint',
  'focusedPostMigrationReconciliationTests',
  'gitDiffCheck',
  'importCompensationTests',
  'literatureTests',
  'migrationDatabaseContractTests',
  'operationalToolTests',
  'prettier',
  'productionBuild',
  'registryScopeCheck',
  'typeScript',
] as const

function compatibilityIdentity(index: number) {
  return {
    datasetSplit: 'development',
    itemId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    masterRowId: String(index + 1),
    pmid: String(10_000_000 + index),
  }
}

function terminalCompatibilityDetails() {
  const allIdentities = Array.from({ length: 630 }, (_, index) => compatibilityIdentity(index))
  return {
    actionCounts: {
      incompatible: 630,
      initial: 0,
      inserts: 0,
      noops: 0,
      revisions: 0,
      total: 630,
      unresolved: 0,
    },
    executionCompatibility: {
      blockedRowCount: 630,
      countsByCode: {
        excluded_status_null_not_representable_by_import_contract_v1: 272,
        source_review_blinding_provenance_has_no_exact_import_v1_mapping: 630,
        source_full_text_provenance_has_no_exact_import_v1_mapping: 50,
      },
      executableRowCount: 0,
      identitiesByCode: {
        excluded_status_null_not_representable_by_import_contract_v1: allIdentities.slice(0, 272),
        source_review_blinding_provenance_has_no_exact_import_v1_mapping: allIdentities,
        source_full_text_provenance_has_no_exact_import_v1_mapping: allIdentities.slice(0, 50),
      },
      totalRowCount: 630,
    },
    unresolved: { count: 0, pmids: [] },
  }
}

async function temporaryDirectory(): Promise<string> {
  const root = await realpath(tmpdir())
  return mkdtemp(join(root, 'post-migration-reconciliation-backup-'))
}

const OWNER_ACL_TERMINAL = 'OWNER/ACL AUDIT READY — NO OWNER/ACL FORWARD MIGRATION REQUIRED'
const FINAL_ARTIFACT_SHA256 = '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59'
const NOTE_REASON =
  'NOTE DISPOSITION ALREADY AUTHORIZED: the exact amended two-row authorization preserves the current physician rationale instead of applying finalized V3 prose.'
const EXISTING_PMIDS = [
  '30416813',
  '32250874',
  '16002921',
  '36879724',
  '18617289',
  '35079742',
  '15133344',
  '28610675',
  '39281191',
] as const
const FORWARD_REQUIREMENT_IDS = [
  'immutable_existing_migration',
  'new_forward_migration_only',
  'preserve_contract_v1',
  'new_fail_closed_version_boundary',
  'ordinary_ui_semantics_unchanged',
  'separate_external_and_local_provenance',
  'no_full_text_supplemental_conflation',
  'conditional_out_of_scope_null_statuses',
  'included_status_invariants',
  'development_only',
  'preserve_existing_state',
  'append_only_compensation',
  'source_artifact_immutable',
  'normalization_ledgers_separate',
  'package_gate',
] as const

const classificationCounts = {
  audit_expectation_defect: 1,
  environment_representation_only: 219,
  explicitly_supported_local_profile: 526,
  identical: 26,
  missing_expected_object: 0,
  security_contract_difference: 0,
  semantic_contract_difference: 0,
  unexpected_object: 0,
}
const schemaClassificationCounts = {
  ...classificationCounts,
  explicitly_supported_local_profile: 523,
  identical: 20,
}
const rpcClassificationCounts = {
  ...classificationCounts,
  audit_expectation_defect: 0,
  environment_representation_only: 0,
  explicitly_supported_local_profile: 3,
  identical: 0,
}
const profileClassificationCounts = {
  ...rpcClassificationCounts,
  explicitly_supported_local_profile: 0,
  identical: 6,
}

function diagnosticReconciliation(includeRequestedNameDiscrepancies: boolean) {
  return {
    classificationCounts,
    classificationPartitions: {
      combined: { classificationCounts, total: 772 },
      deploymentProfile: {
        classificationCounts: profileClassificationCounts,
        total: 6,
      },
      rpcs: { classificationCounts: rpcClassificationCounts, total: 3 },
      schemaSecurityRecords: {
        classificationCounts: schemaClassificationCounts,
        total: 763,
      },
    },
    combinedClassificationCounts: classificationCounts,
    completeness: {
      actualRecordCount: 683,
      actualRecordsAccountedFor: 683,
      complete: true,
      expectedRecordCount: 763,
      expectedRecordsAccountedFor: 763,
    },
    deploymentProfile: {},
    deploymentProfileClassificationCounts: profileClassificationCounts,
    fullEnvironmentInventoryMatches: false,
    identities: {},
    invariantIdentityMatches: true,
    ownerAclTerminalState: OWNER_ACL_TERMINAL,
    ownerRepresentation: {
      actualRecordCount: 683,
      collapsedByObjectType: { function_acl: 24, table_acl: 56 },
      collapsedExpectedRecordCount: 80,
      expectedRecordCount: 763,
      explanation: 'fixture exact owner representation',
      isExact763To683OwnerRepresentation: true,
      projectedExpectedRecordCount: 683,
      projectionExactlyMatchesActual: true,
      recordCountDelta: 80,
    },
    profileDiffs: Array.from({ length: 6 }, () => null),
    readinessBlockers: [],
    ready: true,
    recordDiffs: Array.from({ length: 763 }, () => null),
    rpcClassificationCounts,
    rpcDiffs: Array.from({ length: 3 }, () => null),
    schemaSecurityRecordClassificationCounts: schemaClassificationCounts,
    schemaVersion: 'gold-import-compensation-contract-reconciliation/1.0.0',
    ...(includeRequestedNameDiscrepancies
      ? {
          requestedNameDiscrepancies: [
            {
              aliasCreated: false,
              canonicalName: 'reconcile_literature_gold_review_operation_v1',
              classification: 'audit_expectation_defect',
              requestedName: 'reconcile_literature_gold_import_v1',
            },
          ],
        }
      : {}),
  }
}

function diagnosticArtifacts() {
  const reconciliation = diagnosticReconciliation(false)
  const embeddedReconciliation = diagnosticReconciliation(true)
  const database = {
    batchId: '00000000-0000-4000-8000-000000000001',
    contractInvariantIdentitySha256: '1'.repeat(64),
    currentEffectiveStateSha256: '2'.repeat(64),
    currentPhysicalStateSha256: '3'.repeat(64),
    currentPointersAreLatestHeads: true,
    deploymentProfileId: 'local_supabase_postgres_owner_v1',
    developmentMembershipSha256: '4'.repeat(64),
    developmentPlanningStateSha256: '5'.repeat(64),
    environmentProfileIdentitySha256: '6'.repeat(64),
    fullEnvironmentInventoryIdentitySha256: '7'.repeat(64),
    heldOutIdentitiesAccessed: false,
    preMigrationBackupManifestSha256: 'f'.repeat(64),
    readOnlyAudit: true,
    remoteWritesAllowed: false,
    repositoryCommitSha: 'a'.repeat(40),
    revisionChainsLinear: true,
    schemaSecurityIdentitySha256: '8'.repeat(64),
    stateFresh: true,
    targetDatabase: 'local',
    testSplitLocked: true,
  }
  const stateHashes = {
    developmentMembershipSha256: database.developmentMembershipSha256,
    effectiveStateSha256: database.currentEffectiveStateSha256,
    physicalStateSha256: database.currentPhysicalStateSha256,
    readOnlyTransaction: true,
  }
  return new Map<string, string>([
    [
      'contract-diagnostics.json',
      canonicalJson({
        canonicalRpcNames: [
          'apply_literature_gold_import_v1',
          'compensate_literature_gold_import_v1',
          'reconcile_literature_gold_review_operation_v1',
        ],
        functions: [{}, {}, {}],
        normalizationRule: 'postgres-function-definition-conservative-whitespace/v1',
        readOnlyTransaction: true,
        requestedNameDiscrepancies: embeddedReconciliation.requestedNameDiscrepancies,
        roles: [{}, {}, {}, {}, {}],
        schemaVersion: 'gold-import-compensation-contract-diagnostics/1.0.0',
        target: {
          container: 'supabase_db_ip-literature-local',
          database: 'postgres',
          local: true,
          port: '55322',
          projectId: 'ip-literature-local',
        },
        transactionIsolation: 'repeatable read',
      }),
    ],
    ['contract-reconciliation.json', canonicalJson(reconciliation)],
    [
      'development-planning-state.json',
      canonicalJson({
        datasetSplit: 'development',
        rows: Array.from({ length: 630 }, () => null),
        schemaVersion: 'gold-import-compensation-development-planning-state/1.0.0',
      }),
    ],
    [
      'migration-audit.json',
      canonicalJson({
        checks: {
          behavioralProbe: true,
          compensationExecuted: false,
          contractReconciliation: embeddedReconciliation,
          databaseMutationCount: 0,
          expectedSchemaSecurityIdentitySha256: '8'.repeat(64),
          failures: [],
          forwardMigrationRequired: false,
          importExecuted: false,
          legacyOwnerSpecificFailures: [],
          lint: true,
          ownerAclTerminalState: OWNER_ACL_TERMINAL,
          schemaSecurityDefinitionIdentity: {},
          security: true,
        },
        comparisons: {},
        database,
        migration: {
          applied: true,
          id: '20260808035633_add_literature_gold_import_compensation_contract',
          ledgerOccurrences: 1,
          sha256: '9'.repeat(64),
        },
        readinessStatus: 'ready',
        result: 'audit_ready_contract_compatibility_audit_required',
        schemaVersion: 'gold-import-compensation-reconciled-migration-audit/1.0.0',
        status: 'ready',
      }),
    ],
    ['migration-audit.md', '# Reconciled migration audit\n'],
    [
      'read-only-state-bracket.json',
      canonicalJson({
        contractStateHashesAfter: stateHashes,
        contractStateHashesBefore: stateHashes,
        contractStateHashesMatch: true,
        preMigrationBackupManifestSha256: 'f'.repeat(64),
        safety: {
          compensationExecuted: false,
          databaseMutationCount: 0,
          heldOutIdentitiesAccessed: false,
          importExecuted: false,
          readOnlyDiagnostics: true,
          remoteDatabaseAccessed: false,
        },
        schemaVersion: 'gold-import-compensation-contract-diagnostic-orchestration/1.0.0',
        snapshotAfterSha256: 'e'.repeat(64),
        snapshotBeforeSha256: 'e'.repeat(64),
        snapshotsMatch: true,
      }),
    ],
    [
      'schema-security-definition-identity.json',
      canonicalJson({
        records: Array.from({ length: 683 }, () => null),
        schemaVersion: 'gold-import-compensation-schema-security-definition-identity/1.0.0',
      }),
    ],
  ])
}

function compatibilityArtifacts(input: {
  contradictoryCompatibility: boolean
  omitReadinessBlocker: boolean
  packageReady: boolean
  terminalState: string
  tamperNoteDisposition: boolean
  upstreamManifestSha256: string
}) {
  const listNormalizations = Array.from({ length: 354 }, (_, index) => ({ index }))
  const listNormalizationLedgerSha256 = sha256(compactCanonicalJson(listNormalizations))
  const noteRows = ['36879724', '39281191'].map((pmid, index) => {
    const currentNote = `authorized current note ${pmid}`
    const finalizedV3Note = `different finalized note ${pmid}`
    return {
      amendedAuthorizationRationaleSha256: sha256(currentNote),
      currentNote,
      currentNoteSha256: sha256(currentNote),
      currentReviewId: `10000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
      currentRevision: 1,
      disposition: GOLD_IMPORT_NOTE_DISPOSITION,
      exactAuthorizedRationalePreserved: true,
      finalizedV3Note,
      finalizedV3NoteSha256: sha256(finalizedV3Note),
      itemId: `20000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
      masterRowId: String(index + 1),
      pmid,
    }
  })
  const noteDispositionAudit = {
    authorizationTemplateRequired: false,
    disposition: GOLD_IMPORT_NOTE_DISPOSITION,
    physicalHistoryEvidence: {
      currentPointersAreLatestHeads: true,
      revisionChainsLinear: true,
    },
    rows: noteRows,
    ruleVersion: GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION,
    schemaVersion: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SCHEMA_VERSION,
    sourceBindings: {
      amendedAuthorizationSha256: GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
      authorizationManifestSha256: GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
      authorizationMappingCorrectionManifestSha256:
        GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
      authorizationMappingCorrectionSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
      authorizationMappingSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
      currentEffectiveStateSha256: '2'.repeat(64),
      currentPhysicalStateSha256: '3'.repeat(64),
      developmentPlanningStateSha256: '5'.repeat(64),
      finalizedV3ArtifactSha256: FINAL_ARTIFACT_SHA256,
    },
    status: GOLD_IMPORT_NOTE_DISPOSITION_STATUS,
  }
  const noteDispositionAuditSha256 = sha256(compactCanonicalJson(noteDispositionAudit))
  const fieldLineage = {
    conclusions: {},
    fields: Array.from({ length: 13 }, (_, index) => ({ index })),
    schemaVersion: 'gold-import-contract-field-lineage/1.0.0',
    scope: {
      fieldCount: 13,
      finalizedWorkflow: 'gold-set-v1-enrichment-v3',
      importContract: 'gold-import-compensation-v1',
    },
  }
  const fieldLineageSha256 = sha256(compactCanonicalJson(fieldLineage))
  const forwardRepairRequirements = {
    importContractForwardMigrationRequired: true,
    noteDisposition: {
      evidenceSha256: noteDispositionAuditSha256,
      status: GOLD_IMPORT_NOTE_DISPOSITION_STATUS,
    },
    ownerAclForwardMigrationRequired: false,
    physicianStatusDecisionRequired: false,
    requirements: FORWARD_REQUIREMENT_IDS.map((id) => ({ id, requirement: `requirement ${id}` })),
    schemaVersion: 'gold-import-contract-v2-forward-repair-requirements/1.0.0',
    sourceArtifactChangeRequired: false,
  }
  const forwardRepairRequirementsSha256 = sha256(compactCanonicalJson(forwardRepairRequirements))
  const sourceBindings = {
    amendedAuthorizationSha256: GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
    authorizationManifestSha256: GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
    authorizationMappingCorrectionManifestSha256:
      GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
    authorizationMappingCorrectionSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
    authorizationMappingSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
    contract: {
      environmentInvariantIdentitySha256: '1'.repeat(64),
      environmentProfileIdentitySha256: '6'.repeat(64),
    },
    currentDatabase: {
      batchId: '00000000-0000-4000-8000-000000000001',
      developmentMembershipSha256: '4'.repeat(64),
      developmentPlanningStateSha256: '5'.repeat(64),
      effectiveStateSha256: '2'.repeat(64),
      physicalStateSha256: '3'.repeat(64),
    },
    existingHeadCohortSha256: 'a'.repeat(64),
    fieldLineageSha256,
    finalV3ArtifactSha256: FINAL_ARTIFACT_SHA256,
    forwardRepairRequirementsSha256,
    listNormalizationLedgerSha256,
    migration: {
      applied: true,
      id: '20260808035633_add_literature_gold_import_compensation_contract',
      ledgerOccurrences: 1,
      sha256: '9'.repeat(64),
    },
    noteDispositionAuditSha256,
    postMigrationAuditManifestSha256: input.upstreamManifestSha256,
  }
  const details = terminalCompatibilityDetails()
  const readinessDetails = terminalCompatibilityDetails()
  if (input.contradictoryCompatibility) {
    details.actionCounts.incompatible = 629
    readinessDetails.actionCounts.incompatible = 629
  }
  const existingHeads = EXISTING_PMIDS.map((pmid, rowIndex) => ({
    currentReviewId: `30000000-0000-4000-8000-${rowIndex.toString(16).padStart(12, '0')}`,
    currentRevision: 1,
    effectiveReviewId: `30000000-0000-4000-8000-${rowIndex.toString(16).padStart(12, '0')}`,
    fields: COMPATIBILITY_PROJECTION_FIELDS.map((field) => {
      const authorizedNote = field === 'notes' && (pmid === '36879724' || pmid === '39281191')
      return {
        classification: authorizedNote
          ? 'existing_physician_note_preserved_by_amended_authorization'
          : 'identical',
        currentValue: authorizedNote ? `authorized current note ${pmid}` : null,
        field,
        reason: authorizedNote ? NOTE_REASON : 'identical fixture field',
        resolvedValue: authorizedNote ? `authorized current note ${pmid}` : null,
        sourceValue: authorizedNote ? `different finalized note ${pmid}` : null,
      }
    }),
    identity: {
      ...compatibilityIdentity(rowIndex),
      pmid,
    },
    physicianReviewCohort: {},
    proposedAction: null,
    reason: 'execution contract blocked',
    resolutionStatus: 'incompatible',
  }))
  const planningDispositions = Array.from({ length: 630 }, (_, index) => ({
    executionBlockerCodes: ['source_review_blinding_provenance_has_no_exact_import_v1_mapping'],
    identity: compatibilityIdentity(index),
    proposedAction: null,
    reason: 'execution contract blocked',
    resolutionStatus: 'incompatible',
    sequence: index + 1,
  }))
  const zeroSafety = {
    compensationExecuted: false,
    databaseMutationCount: 0,
    databaseQueriesExecuted: 0,
    heldOutIdentitiesAccessed: false,
    importExecuted: false,
    remoteDatabaseAccessed: false,
  }
  const report = {
    ...details,
    contractAuditReady: true,
    existingHeadCount: 9,
    existingHeads,
    noteDisposition: {
      auditSha256: noteDispositionAuditSha256,
      disposition: GOLD_IMPORT_NOTE_DISPOSITION,
      status: GOLD_IMPORT_NOTE_DISPOSITION_STATUS,
    },
    ownerAclTerminalState: OWNER_ACL_TERMINAL,
    packageGenerationAllowed: input.packageReady,
    planningDispositions,
    safety: {
      ...zeroSafety,
      sourceArtifactBytesPreserved: true,
      sourceArtifactWritten: false,
    },
    schemaVersion: 'gold-import-existing-head-compatibility-audit/2.0.0',
    sourceBindings,
    status: 'forward_import_contract_repair_required',
    terminalState: input.terminalState,
  }
  const readiness = {
    ...readinessDetails,
    blockers: input.omitReadinessBlocker ? EXECUTION_BLOCKER_CODES.slice(0, 2) : TERMINAL_BLOCKERS,
    fieldLineageSha256,
    forwardRepairRequirementsSha256,
    listNormalizationLedgerSha256,
    noteDisposition: {
      auditSha256: noteDispositionAuditSha256,
      status: input.tamperNoteDisposition
        ? 'authorization_required'
        : GOLD_IMPORT_NOTE_DISPOSITION_STATUS,
    },
    ownerAclTerminalState: OWNER_ACL_TERMINAL,
    packageGenerationAllowed: input.packageReady,
    readiness: 'forward_import_contract_repair_required',
    safety: zeroSafety,
    schemaVersion: 'gold-import-compatibility-package-readiness/2.0.0',
    terminalState: input.terminalState,
  }
  return {
    artifacts: new Map<string, string>([
      [
        'boolean-normalization-report.json',
        canonicalJson({
          artifactRowCount: 630,
          existingHeadLegacyFalseCount: 9,
          existingHeadLegacyFalseNormalizations: Array.from({ length: 9 }, () => null),
          legacyTitleCaseNormalizationCount: 630,
          normalizationCount: 1890,
          normalizationRuleVersion: 'finalized-v3-exact-boolean-lexeme/1.0.0',
          normalizations: Array.from({ length: 1890 }, () => null),
          schemaVersion: 'gold-import-boolean-normalization-report/1.0.0',
          sourceArtifactBytesPreserved: true,
          sourceArtifactSha256: FINAL_ARTIFACT_SHA256,
        }),
      ],
      ['existing-head-compatibility-audit.json', canonicalJson(report)],
      ['field-lineage.json', canonicalJson(fieldLineage)],
      [
        'field-lineage.md',
        `# Gold import contract v1 field-lineage audit\n\nSchema: \`gold-import-contract-field-lineage/1.0.0\`\n\nCanonical JSON SHA-256: \`${fieldLineageSha256}\`\n`,
      ],
      [
        'forward-import-contract-repair-requirements.json',
        canonicalJson(forwardRepairRequirements),
      ],
      [
        'list-normalization-report.json',
        canonicalJson({
          artifactRowCount: 630,
          normalizationCount: 354,
          normalizationCountsByColumn: {
            clinical_purposes: 127,
            disease_tags: 27,
            technology_tags: 45,
            topic_ids: 155,
          },
          normalizationLedgerSha256: listNormalizationLedgerSha256,
          normalizationRuleVersion: 'finalized-v3-ordered-set-list-to-ascending/1.0.0',
          normalizations: listNormalizations,
          schemaVersion: 'gold-import-list-normalization-report/1.0.0',
          sourceArtifactBytesPreserved: true,
          sourceArtifactSha256: FINAL_ARTIFACT_SHA256,
        }),
      ],
      ['note-disposition-audit.json', canonicalJson(noteDispositionAudit)],
      ['package-readiness.json', canonicalJson(readiness)],
    ]),
    listNormalizationLedgerSha256,
  }
}

async function writeAuditDirectory(input: {
  contradictoryCompatibility?: boolean
  extra?: boolean
  kind?: 'compatibility' | 'diagnostic'
  omitCanonicalArtifact?: string
  omitReadinessBlocker?: boolean
  packageReady?: boolean
  staleReceipt?: boolean
  tamperNoteDisposition?: boolean
  terminalState?: string
  upstreamManifestSha256?: string
}) {
  const directory = await temporaryDirectory()
  const kind = input.kind ?? 'diagnostic'
  const upstreamManifestSha256 = input.upstreamManifestSha256 ?? 'd'.repeat(64)
  const terminalState = input.terminalState ?? POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE
  const packageReady = input.packageReady ?? false
  const compatibility = compatibilityArtifacts({
    contradictoryCompatibility: input.contradictoryCompatibility ?? false,
    omitReadinessBlocker: input.omitReadinessBlocker ?? false,
    packageReady,
    terminalState,
    tamperNoteDisposition: input.tamperNoteDisposition ?? false,
    upstreamManifestSha256,
  })
  const artifacts = kind === 'diagnostic' ? diagnosticArtifacts() : compatibility.artifacts
  if (input.omitCanonicalArtifact) artifacts.delete(input.omitCanonicalArtifact)
  const manifest = [...artifacts]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([name, contents]) => `${sha256(contents)}  ${name}\n`)
    .join('')
  const manifestSha256 = sha256(manifest)
  const zeroSafety = {
    compensationExecuted: false,
    databaseMutationCount: 0,
    databaseQueriesExecuted: 0,
    heldOutIdentitiesAccessed: false,
    importExecuted: false,
    remoteDatabaseAccessed: false,
  }
  const receipt =
    kind === 'diagnostic'
      ? {
          canonicalManifestSha256: input.staleReceipt ? '0'.repeat(64) : manifestSha256,
          compensationExecuted: false,
          databaseContainer: 'supabase_db_ip-literature-local',
          databaseMutationCount: 0,
          executedAt: '2026-08-09T15:00:00.000Z',
          heldOutIdentitiesAccessed: false,
          importExecuted: false,
          mode: 'read_only_diagnostic',
          outputDirectory: directory,
          preMigrationBackupDirectory: '/fixture/pre-backup',
          preMigrationBackupManifestSha256: 'f'.repeat(64),
          remoteDatabaseAccessed: false,
          repositoryCommitSha: 'a'.repeat(40),
          repositoryRoot: '/fixture/repository',
          requestedNameDiscrepancies: [
            {
              aliasCreated: false,
              canonicalName: 'reconcile_literature_gold_review_operation_v1',
              classification: 'audit_expectation_defect',
              requestedName: 'reconcile_literature_gold_import_v1',
            },
          ],
          schemaVersion: 'gold-import-compensation-contract-diagnostic-execution/1.0.0',
        }
      : {
          canonicalArtifactCount: artifacts.size,
          canonicalManifestSha256: input.staleReceipt ? '0'.repeat(64) : manifestSha256,
          executedAt: '2026-08-09T15:00:00.000Z',
          kind: 'existing_head_compatibility_file_only_audit',
          mode: 'file_only_read_only',
          outputDirectory: directory,
          packageReady,
          repositoryCommitSha: 'a'.repeat(40),
          safety: {
            ...zeroSafety,
            sourceArtifactBytesPreserved: true,
            sourceArtifactWritten: false,
          },
          schemaVersion: 'gold-import-existing-head-compatibility-audit-execution/2.0.0',
          sources: {
            amendedAuthorizationPath: '/fixture/amended.json',
            artifactPath: '/fixture/final.csv',
            auditPath: '/fixture/migration-audit.json',
            authorizationManifestPath: '/fixture/authorization-manifest.sha256',
            authorizationMappingCorrectionManifestPath:
              '/fixture/mapping-correction-manifest.sha256',
            authorizationMappingCorrectionPath: '/fixture/mapping-correction.json',
            authorizationMappingPath: '/fixture/mapping.json',
            finalV3ArtifactSha256: FINAL_ARTIFACT_SHA256,
            postMigrationAuditManifestSha256: upstreamManifestSha256,
          },
          terminalState,
        }
  await Promise.all([
    ...[...artifacts].map(([name, contents]) => writeFile(join(directory, name), contents)),
    writeFile(join(directory, 'checksum-manifest.sha256'), manifest),
    writeFile(join(directory, 'execution-receipt.json'), canonicalJson(receipt)),
    ...(input.extra ? [writeFile(join(directory, 'unmanifested.json'), canonicalJson({}))] : []),
  ])
  return {
    directory,
    listNormalizationLedgerSha256: compatibility.listNormalizationLedgerSha256,
    manifestSha256,
  }
}

function gitBlobOid(bytes: Buffer): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
}

function repositoryRunner(input: {
  cwd: string
  trackedBytes: Buffer
  branch?: string
  changeHeadAfterFirstInspection?: boolean
}) {
  const head = 'a'.repeat(40)
  const changedHead = 'c'.repeat(40)
  const originMain = 'b'.repeat(40)
  const semanticDiff =
    'diff --git a/tracked.txt b/tracked.txt\n' +
    `index ${'1'.repeat(40)}..${gitBlobOid(input.trackedBytes)} 100644\n` +
    '--- a/tracked.txt\n' +
    '+++ b/tracked.txt\n' +
    '@@ -1 +1 @@\n' +
    '-old tracked bytes\n' +
    '+tracked commit bytes\n'
  let headReads = 0
  return async (_command: string, arguments_: string[]) => {
    const command = arguments_.join(' ')
    if (command === 'rev-parse --absolute-git-dir') {
      return { stderr: '', stdout: `${input.cwd}/common.git/worktrees/codex-b\n` }
    }
    if (command === 'rev-parse --path-format=absolute --git-common-dir') {
      return { stderr: '', stdout: `${input.cwd}/common.git\n` }
    }
    if (command === 'branch --show-current') {
      return {
        stderr: '',
        stdout: `${input.branch ?? 'codex/ip-literature-post-migration-contract-reconciliation-v1'}\n`,
      }
    }
    if (command === 'status --porcelain=v1 --untracked-files=no') {
      return { stderr: '', stdout: '' }
    }
    if (command === 'rev-parse HEAD') {
      headReads += 1
      return {
        stderr: '',
        stdout: `${input.changeHeadAfterFirstInspection && headReads > 1 ? changedHead : head}\n`,
      }
    }
    if (command === 'rev-parse origin/main' || command === 'merge-base origin/main HEAD') {
      return { stderr: '', stdout: `${originMain}\n` }
    }
    if (arguments_[0] === 'diff' && arguments_.includes('--diff-filter=AM')) {
      return { stderr: '', stdout: 'tracked.txt\n' }
    }
    if (arguments_[0] === 'diff' && arguments_.includes('--diff-filter=DR')) {
      return { stderr: '', stdout: '' }
    }
    if (
      command ===
      `diff --no-ext-diff --no-color --full-index --binary --src-prefix=a/ --dst-prefix=b/ ${originMain}...${head} --`
    ) {
      return { stderr: '', stdout: semanticDiff }
    }
    if (arguments_[0] === 'ls-tree') {
      return {
        stderr: '',
        stdout: `100644 blob ${gitBlobOid(input.trackedBytes)}\ttracked.txt\n`,
      }
    }
    throw new Error(`Unexpected test command: ${command}`)
  }
}

function reportBindings(input: {
  compatibilityAuditManifestSha256: string
  contractDiagnosticManifestSha256: string
  repositoryCommitSha?: string
}) {
  return {
    compatibilityAuditManifestSha256: input.compatibilityAuditManifestSha256,
    contractDiagnosticManifestSha256: input.contractDiagnosticManifestSha256,
    repositoryCommitSha: input.repositoryCommitSha ?? 'a'.repeat(40),
  }
}

function zeroMutationSafety() {
  return {
    compensationExecuted: false,
    databaseMutationCount: 0,
    heldOutIdentitiesAccessed: false,
    importExecuted: false,
    remoteDatabaseAccessed: false,
  }
}

function testBuildReport(bindings: ReturnType<typeof reportBindings>) {
  return {
    bindings,
    checks: TEST_BUILD_CHECK_IDS.map((id) => ({
      command: `validation-command-for-${id}`,
      exitCode: 0,
      id,
      result: 'passed',
    })),
    safety: zeroMutationSafety(),
    schemaVersion: POST_MIGRATION_RECONCILIATION_TEST_BUILD_REPORT_SCHEMA_VERSION,
    status: 'passed',
    terminalState: POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE,
  }
}

function mergeReadinessReport(bindings: ReturnType<typeof reportBindings>) {
  return {
    bindings,
    blockers: TERMINAL_BLOCKERS,
    codeReview: {
      mergeAuthorized: false,
      originMainIsAncestor: true,
      pullRequestDraft: true,
      readiness: 'ready_for_draft_review',
      trackedWorktreeClean: true,
    },
    importExecution: {
      compensationExecuted: false,
      importExecuted: false,
      packageGenerated: false,
      packageGenerationAllowed: false,
      readiness: 'blocked_forward_import_contract_repair_required',
    },
    safety: zeroMutationSafety(),
    schemaVersion: POST_MIGRATION_RECONCILIATION_MERGE_READINESS_REPORT_SCHEMA_VERSION,
    terminalState: POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE,
  }
}

function diffStatReconciliationReport() {
  return {
    authoritativeFinal: {
      additions: 1,
      basis: 'git_three_dot_and_github_pr_agree',
      changedFiles: 1,
      deletions: 1,
    },
    commands: {
      gitDiffNumstat: 'git diff --numstat origin/main...HEAD',
      gitDiffStat: 'git diff --stat origin/main...HEAD',
      githubPullRequest:
        'gh pr view 89 --json number,state,isDraft,mergedAt,mergeable,baseRefName,headRefName,headRefOid,changedFiles,additions,deletions',
    },
    explanation: {
      generatedUntrackedOrTemporaryFilesExplainDifference: false,
      reason: 'Authoritative Git and GitHub statistics agree.',
    },
    generatedAt: '2026-08-09T15:00:00.000Z',
    gitDiffNumstat: [{ additions: 1, deletions: 1, path: 'tracked.txt' }],
    gitDiffStat: ' tracked.txt | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\n',
    priorApproximateReport: {
      additions: 3_707,
      changedFiles: 29,
      deletions: 229,
      exactSourceLocated: false,
      explainsAuthoritativeDifference: false,
    },
    pullRequest: {
      baseRefName: 'main',
      headRefName: 'codex/ip-literature-post-migration-contract-reconciliation-v1',
      headRefOid: 'a'.repeat(40),
      isDraft: true,
      mergeable: 'MERGEABLE',
      mergedAt: null,
      number: 89,
      state: 'OPEN',
    },
    repository: {
      branch: 'codex/ip-literature-post-migration-contract-reconciliation-v1',
      head: 'a'.repeat(40),
      originMain: 'b'.repeat(40),
      originMainIsAncestor: true,
      trackedUntrackedAndTemporaryStatusClean: true,
    },
    schemaVersion: GOLD_IMPORT_DIFF_STAT_RECONCILIATION_SCHEMA_VERSION,
    startingHeadObservation: {
      additions: 14_413,
      basis: 'Git and GitHub preflight agreed.',
      changedFiles: 30,
      deletions: 277,
      head: 'aab05aa2c3ef9aab88730e78b42e0b8725a80af6',
    },
  }
}

async function backupFixture() {
  const cwd = await temporaryDirectory()
  const backupRoot = join(cwd, 'backups')
  await mkdir(backupRoot)
  const trackedBytes = Buffer.from('tracked commit bytes\n', 'utf8')
  await writeFile(join(cwd, 'tracked.txt'), trackedBytes)
  const diagnostic = await writeAuditDirectory({})
  const compatibility = await writeAuditDirectory({
    kind: 'compatibility',
    upstreamManifestSha256: diagnostic.manifestSha256,
  })
  const testBuildReportPath = join(cwd, 'test-build.json')
  const mergeReadinessReportPath = join(cwd, 'merge-readiness.json')
  const diffStatReconciliationPath = join(cwd, 'diff-stat-reconciliation.json')
  const bindings = reportBindings({
    compatibilityAuditManifestSha256: compatibility.manifestSha256,
    contractDiagnosticManifestSha256: diagnostic.manifestSha256,
  })
  await Promise.all([
    writeFile(testBuildReportPath, canonicalJson(testBuildReport(bindings))),
    writeFile(mergeReadinessReportPath, canonicalJson(mergeReadinessReport(bindings))),
    writeFile(diffStatReconciliationPath, canonicalJson(diffStatReconciliationReport())),
  ])
  const output = join(backupRoot, `post-migration-contract-reconciliation-v1-${'a'.repeat(40)}`)
  const argv = [
    '--contract-diagnostic',
    diagnostic.directory,
    '--contract-diagnostic-manifest-sha256',
    diagnostic.manifestSha256,
    '--compatibility-audit',
    compatibility.directory,
    '--compatibility-audit-manifest-sha256',
    compatibility.manifestSha256,
    '--test-build-report',
    testBuildReportPath,
    '--merge-readiness-report',
    mergeReadinessReportPath,
    '--diff-stat-reconciliation',
    diffStatReconciliationPath,
    '--backup-root',
    backupRoot,
    '--output',
    output,
  ]
  return {
    argv,
    backupRoot,
    compatibility,
    cwd,
    diagnostic,
    diffStatReconciliationPath,
    mergeReadinessReportPath,
    output,
    testBuildReportPath,
    trackedBytes,
  }
}

describe('post-migration contract reconciliation backup CLI', () => {
  test('documents a file-only additive backup with no database access', async () => {
    const result = await runCreatePostMigrationContractReconciliationBackup(['--help'])
    expect(result).toEqual(
      expect.objectContaining({
        help: expect.stringContaining('file-only'),
      }),
    )
    if (!('help' in result)) throw new Error('Expected help result.')
    expect(result.help).toContain('never contacts a database')
    expect(result.help).toContain('post-migration-contract-reconciliation-v1-CURRENT_HEAD')
  })

  test('has no commit or database-write mode', async () => {
    await expect(runCreatePostMigrationContractReconciliationBackup(['--commit'])).rejects.toThrow(
      'has no commit or database-write mode',
    )
  })

  test('accepts only an exact source inventory whose canonical receipt binds the manifest', async () => {
    const valid = await writeAuditDirectory({})
    await expect(
      preserveAuditDirectory({
        directory: valid.directory,
        expectedManifestSha256: valid.manifestSha256,
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'contract-diagnostic',
        verifyDiagnosticBundleForTest: () => undefined,
      }),
    ).resolves.toHaveLength(9)

    const validCompatibility = await writeAuditDirectory({ kind: 'compatibility' })
    await expect(
      preserveAuditDirectory({
        directory: validCompatibility.directory,
        expectedListNormalizationLedgerSha256ForTest:
          validCompatibility.listNormalizationLedgerSha256,
        expectedManifestSha256: validCompatibility.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).resolves.toHaveLength(10)

    const extra = await writeAuditDirectory({ extra: true })
    await expect(
      preserveAuditDirectory({
        directory: extra.directory,
        expectedManifestSha256: extra.manifestSha256,
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'contract-diagnostic',
      }),
    ).rejects.toThrow(/unmanifested, missing, or unexpected/u)

    const missingDiagnostic = await writeAuditDirectory({
      omitCanonicalArtifact: 'schema-security-definition-identity.json',
    })
    await expect(
      preserveAuditDirectory({
        directory: missingDiagnostic.directory,
        expectedManifestSha256: missingDiagnostic.manifestSha256,
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'contract-diagnostic',
      }),
    ).rejects.toThrow(/exact canonical artifact set/u)

    const stale = await writeAuditDirectory({ kind: 'compatibility', staleReceipt: true })
    await expect(
      preserveAuditDirectory({
        directory: stale.directory,
        expectedListNormalizationLedgerSha256ForTest: stale.listNormalizationLedgerSha256,
        expectedManifestSha256: stale.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/does not bind the reviewed manifest/u)

    const mismatchedUpstream = await writeAuditDirectory({
      kind: 'compatibility',
      upstreamManifestSha256: 'e'.repeat(64),
    })
    await expect(
      preserveAuditDirectory({
        directory: mismatchedUpstream.directory,
        expectedListNormalizationLedgerSha256ForTest:
          mismatchedUpstream.listNormalizationLedgerSha256,
        expectedManifestSha256: mismatchedUpstream.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/exact diagnostic\/source evidence graph/u)

    const wrongTerminal = await writeAuditDirectory({
      kind: 'compatibility',
      terminalState: 'AUDIT READY — PHYSICIAN COMPATIBILITY SUPPLEMENT REQUIRED',
    })
    await expect(
      preserveAuditDirectory({
        directory: wrongTerminal.directory,
        expectedListNormalizationLedgerSha256ForTest: wrongTerminal.listNormalizationLedgerSha256,
        expectedManifestSha256: wrongTerminal.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/zero-mutation safety contract/u)

    const contradictory = await writeAuditDirectory({
      contradictoryCompatibility: true,
      kind: 'compatibility',
    })
    await expect(
      preserveAuditDirectory({
        directory: contradictory.directory,
        expectedListNormalizationLedgerSha256ForTest: contradictory.listNormalizationLedgerSha256,
        expectedManifestSha256: contradictory.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/exact terminal-4 action counts/u)

    const missingReadinessBlocker = await writeAuditDirectory({
      kind: 'compatibility',
      omitReadinessBlocker: true,
    })
    await expect(
      preserveAuditDirectory({
        directory: missingReadinessBlocker.directory,
        expectedListNormalizationLedgerSha256ForTest:
          missingReadinessBlocker.listNormalizationLedgerSha256,
        expectedManifestSha256: missingReadinessBlocker.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/exact three terminal-4 blockers/u)

    const missingCanonical = await writeAuditDirectory({
      kind: 'compatibility',
      omitCanonicalArtifact: 'note-disposition-audit.json',
    })
    await expect(
      preserveAuditDirectory({
        directory: missingCanonical.directory,
        expectedListNormalizationLedgerSha256ForTest:
          missingCanonical.listNormalizationLedgerSha256,
        expectedManifestSha256: missingCanonical.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/exact canonical artifact set/u)

    const tamperedNote = await writeAuditDirectory({
      kind: 'compatibility',
      tamperNoteDisposition: true,
    })
    await expect(
      preserveAuditDirectory({
        directory: tamperedNote.directory,
        expectedListNormalizationLedgerSha256ForTest: tamperedNote.listNormalizationLedgerSha256,
        expectedManifestSha256: tamperedNote.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/exact diagnostic\/source evidence graph|note disposition/u)
  })

  test('strictly binds passing validation and split code/import readiness reports', async () => {
    const directory = await temporaryDirectory()
    const bindings = reportBindings({
      compatibilityAuditManifestSha256: 'c'.repeat(64),
      contractDiagnosticManifestSha256: 'd'.repeat(64),
    })
    const testBuildPath = join(directory, 'test-build.json')
    const mergeReadinessPath = join(directory, 'merge-readiness.json')
    const diffStatPath = join(directory, 'diff-stat.json')
    await Promise.all([
      writeFile(testBuildPath, canonicalJson(testBuildReport(bindings))),
      writeFile(mergeReadinessPath, canonicalJson(mergeReadinessReport(bindings))),
      writeFile(diffStatPath, canonicalJson(diffStatReconciliationReport())),
    ])
    await expect(strictTestBuildReport(testBuildPath, bindings)).resolves.toMatchObject({
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    })
    await expect(strictMergeReadinessReport(mergeReadinessPath, bindings)).resolves.toMatchObject({
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    })
    await expect(
      strictDiffStatReconciliationReport(diffStatPath, {
        branch: 'codex/ip-literature-post-migration-contract-reconciliation-v1',
        head: 'a'.repeat(40),
        originMain: 'b'.repeat(40),
      }),
    ).resolves.toMatchObject({ sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) })

    const failedTestBuild = testBuildReport(bindings)
    failedTestBuild.checks[0] = { ...failedTestBuild.checks[0], exitCode: 1, result: 'failed' }
    await writeFile(testBuildPath, canonicalJson(failedTestBuild))
    await expect(strictTestBuildReport(testBuildPath, bindings)).rejects.toThrow(
      /exact command and passing result/u,
    )

    const unsafeMergeReadiness = mergeReadinessReport(bindings)
    unsafeMergeReadiness.importExecution.packageGenerationAllowed = true
    await writeFile(mergeReadinessPath, canonicalJson(unsafeMergeReadiness))
    await expect(strictMergeReadinessReport(mergeReadinessPath, bindings)).rejects.toThrow(
      /ready draft code review from blocked import execution/u,
    )

    const missingMergeBlocker = {
      ...mergeReadinessReport(bindings),
      blockers: EXECUTION_BLOCKER_CODES.slice(0, 2),
    }
    await writeFile(mergeReadinessPath, canonicalJson(missingMergeBlocker))
    await expect(strictMergeReadinessReport(mergeReadinessPath, bindings)).rejects.toThrow(
      /exact terminal-4 blockers/u,
    )

    const dirtyDiffStat = diffStatReconciliationReport()
    dirtyDiffStat.repository.trackedUntrackedAndTemporaryStatusClean = false
    await writeFile(diffStatPath, canonicalJson(dirtyDiffStat))
    await expect(
      strictDiffStatReconciliationReport(diffStatPath, {
        branch: 'codex/ip-literature-post-migration-contract-reconciliation-v1',
        head: 'a'.repeat(40),
        originMain: 'b'.repeat(40),
      }),
    ).rejects.toThrow(/exact clean HEAD/u)
  })

  test('rejects final reports rebound to another HEAD or reviewed manifest', async () => {
    const directory = await temporaryDirectory()
    const expected = reportBindings({
      compatibilityAuditManifestSha256: 'c'.repeat(64),
      contractDiagnosticManifestSha256: 'd'.repeat(64),
    })
    const rebound = reportBindings({
      compatibilityAuditManifestSha256: 'e'.repeat(64),
      contractDiagnosticManifestSha256: 'd'.repeat(64),
      repositoryCommitSha: 'b'.repeat(40),
    })
    const testBuildPath = join(directory, 'test-build.json')
    const mergeReadinessPath = join(directory, 'merge-readiness.json')
    await Promise.all([
      writeFile(testBuildPath, canonicalJson(testBuildReport(rebound))),
      writeFile(mergeReadinessPath, canonicalJson(mergeReadinessReport(rebound))),
    ])
    await expect(strictTestBuildReport(testBuildPath, expected)).rejects.toThrow(
      /exact HEAD and reviewed audit manifests/u,
    )
    await expect(strictMergeReadinessReport(mergeReadinessPath, expected)).rejects.toThrow(
      /exact HEAD and reviewed audit manifests/u,
    )
  })

  test('rejects report reserialization and working-tree bytes that do not equal HEAD', async () => {
    const directory = await temporaryDirectory()
    const reportPath = join(directory, 'report.json')
    await writeFile(reportPath, '{"b":2,"a":1}\n')
    await expect(canonicalReport(reportPath, 'report')).rejects.toThrow(
      /canonical JSON byte representation/u,
    )

    const trackedPath = join(directory, 'tracked.txt')
    const committed = Buffer.from('committed\n', 'utf8')
    await writeFile(trackedPath, 'changed\n')
    const committedBlobOid = createHash('sha1')
      .update(`blob ${committed.length}\0`)
      .update(committed)
      .digest('hex')
    await expect(
      preserveChangedTrackedFiles({
        cwd: directory,
        head: 'a'.repeat(40),
        originMain: 'b'.repeat(40),
        runCommand: async (_command, arguments_) => {
          if (arguments_[0] === 'diff' && arguments_.includes('--diff-filter=AM')) {
            return { stderr: '', stdout: 'tracked.txt\n' }
          }
          if (arguments_[0] === 'diff' && arguments_.includes('--diff-filter=DR')) {
            return { stderr: '', stdout: '' }
          }
          if (arguments_[0] === 'ls-tree') {
            return {
              stderr: '',
              stdout: `100644 blob ${committedBlobOid}\ttracked.txt\n`,
            }
          }
          throw new Error(`Unexpected test command: ${arguments_.join(' ')}`)
        },
      }),
    ).rejects.toThrow(/does not match exact commit/u)
  })

  test('captures the exact base-to-head semantic patch and rejects a non-patch response', async () => {
    const expected =
      'diff --git a/tracked.txt b/tracked.txt\n--- a/tracked.txt\n+++ b/tracked.txt\n'
    const observed: string[][] = []
    await expect(
      buildSemanticDiffPatch({
        cwd: '/reviewed/worktree',
        head: 'a'.repeat(40),
        originMain: 'b'.repeat(40),
        runCommand: async (_command, arguments_) => {
          observed.push(arguments_)
          return { stderr: '', stdout: expected }
        },
      }),
    ).resolves.toEqual({ sha256: sha256(expected), text: expected })
    expect(observed).toEqual([
      [
        'diff',
        '--no-ext-diff',
        '--no-color',
        '--full-index',
        '--binary',
        '--src-prefix=a/',
        '--dst-prefix=b/',
        `${'b'.repeat(40)}...${'a'.repeat(40)}`,
        '--',
      ],
    ])
    await expect(
      buildSemanticDiffPatch({
        cwd: '/reviewed/worktree',
        head: 'a'.repeat(40),
        originMain: 'b'.repeat(40),
        runCommand: async () => ({ stderr: '', stdout: 'not a patch\n' }),
      }),
    ).rejects.toThrow(/exact reviewed Git diff/u)
  })

  test('creates a private exact-HEAD additive backup and rejects repository drift', async () => {
    const fixture = await backupFixture()
    const result = await runCreatePostMigrationContractReconciliationBackup(fixture.argv, {
      cwd: fixture.cwd,
      expectedListNormalizationLedgerSha256ForTest:
        fixture.compatibility.listNormalizationLedgerSha256,
      now: () => new Date('2026-08-09T15:00:00.000Z'),
      runCommand: repositoryRunner(fixture),
      verifyDiagnosticBundleForTest: () => undefined,
    })
    if ('help' in result) throw new Error('unexpected help result')
    expect(result).toMatchObject({
      outputDirectory: fixture.output,
      repositoryCommitSha: 'a'.repeat(40),
    })
    expect(result.manifestSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect((await stat(fixture.output)).mode & 0o777).toBe(0o700)
    expect((await stat(join(fixture.output, 'backup-index.json'))).mode & 0o777).toBe(0o600)
    expect(await readdir(fixture.output)).toEqual(
      expect.arrayContaining([
        'backup-index.json',
        'checksum-manifest.sha256',
        'diff-stat-reconciliation.json',
        'execution-receipt.json',
        'merge-readiness-report.json',
        'semantic-diff.patch',
        'test-build-report.json',
      ]),
    )
    expect(await readFile(join(fixture.output, 'checksum-manifest.sha256'), 'utf8')).toContain(
      'backup-index.json',
    )
    const backupIndex = JSON.parse(
      await readFile(join(fixture.output, 'backup-index.json'), 'utf8'),
    ) as {
      sources: { semanticDiff: { baseSha: string; headSha: string; sha256: string } }
    }
    const semanticDiff = await readFile(join(fixture.output, 'semantic-diff.patch'), 'utf8')
    expect(backupIndex.sources.semanticDiff).toEqual({
      baseSha: 'b'.repeat(40),
      headSha: 'a'.repeat(40),
      sha256: sha256(semanticDiff),
    })

    const drift = await backupFixture()
    await expect(
      runCreatePostMigrationContractReconciliationBackup(drift.argv, {
        cwd: drift.cwd,
        expectedListNormalizationLedgerSha256ForTest:
          drift.compatibility.listNormalizationLedgerSha256,
        runCommand: repositoryRunner({ ...drift, changeHeadAfterFirstInspection: true }),
        verifyDiagnosticBundleForTest: () => undefined,
      }),
    ).rejects.toThrow(/repository identity changed/iu)
  })

  test('enforces the exact feature branch and output basename before reading sources', async () => {
    const wrongBranch = await backupFixture()
    await expect(
      runCreatePostMigrationContractReconciliationBackup(wrongBranch.argv, {
        cwd: wrongBranch.cwd,
        runCommand: repositoryRunner({ ...wrongBranch, branch: 'main' }),
      }),
    ).rejects.toThrow(/requires branch/u)

    const wrongOutput = await backupFixture()
    const outputIndex = wrongOutput.argv.indexOf('--output') + 1
    wrongOutput.argv[outputIndex] = join(wrongOutput.backupRoot, 'wrong-name')
    await expect(
      runCreatePostMigrationContractReconciliationBackup(wrongOutput.argv, {
        cwd: wrongOutput.cwd,
        runCommand: repositoryRunner(wrongOutput),
      }),
    ).rejects.toThrow(/exact current 40-character HEAD/u)
  })
})
