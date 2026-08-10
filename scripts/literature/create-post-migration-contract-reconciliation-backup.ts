import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { TextDecoder } from 'node:util'

import { canonicalJson as compactCanonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  assertExclusiveOutputPath,
  canonicalJson,
  defaultCommandRunner,
  sealCanonicalArtifacts,
  sha256,
  writeCanonicalPackage,
  type CommandRunner,
} from './gold-import-compensation-migration-operations'
import {
  POST_MIGRATION_RECONCILIATION_BRANCH,
  assertReadOnlyReconciliationRepositoryGuard,
  inspectReadOnlyReconciliationRepositoryState,
} from './gold-import-compensation-read-only-guard'
import {
  CONTRACT_RECONCILIATION_CLASSIFICATIONS,
  OWNER_ACL_AUDIT_READY_TERMINAL_STATE,
} from './gold-import-compensation-contract-reconciliation'
import {
  COMPATIBILITY_PROJECTION_FIELDS,
  GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION,
  GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
  GOLD_IMPORT_LIST_NORMALIZATION_RULE_VERSION,
} from './gold-import-compensation-compatibility'
import {
  GOLD_IMPORT_FIELD_LINEAGE_SCHEMA_VERSION,
  GOLD_IMPORT_FORWARD_REPAIR_SCHEMA_VERSION,
} from './gold-import-contract-field-lineage'
import { verifyReadyPostMigrationAuditPackage } from './generate-gold-import-compensation-package-v1'
import {
  GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
  GOLD_IMPORT_NOTE_DISPOSITION,
  GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SCHEMA_VERSION,
  GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION,
  GOLD_IMPORT_NOTE_DISPOSITION_STATUS,
} from './gold-import-note-disposition'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'

export const POST_MIGRATION_RECONCILIATION_BACKUP_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-backup/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_BACKUP_EXECUTION_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-backup-execution/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_TEST_BUILD_REPORT_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-test-build-report/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_MERGE_READINESS_REPORT_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-merge-readiness-report/1.0.0' as const
export const GOLD_IMPORT_DIFF_STAT_RECONCILIATION_SCHEMA_VERSION =
  'gold-import-pr-diff-stat-reconciliation/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE =
  'FORWARD IMPORT-CONTRACT REPAIR REQUIRED — NOTE DISPOSITION ALREADY AUTHORIZED' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const SAFE_COMPONENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const BACKUP_DIRECTORY_PREFIX = 'post-migration-contract-reconciliation-v1-' as const
const CONTRACT_DIAGNOSTIC_EXECUTION_SCHEMA_VERSION =
  'gold-import-compensation-contract-diagnostic-execution/1.0.0' as const
const COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION =
  'gold-import-existing-head-compatibility-audit-execution/2.0.0' as const
const EXISTING_HEAD_COMPATIBILITY_AUDIT_SCHEMA_VERSION =
  'gold-import-existing-head-compatibility-audit/2.0.0' as const
const COMPATIBILITY_PACKAGE_READINESS_SCHEMA_VERSION =
  'gold-import-compatibility-package-readiness/2.0.0' as const
const LOCAL_DATABASE_CONTAINER = 'supabase_db_ip-literature-local' as const
const EXECUTION_COMPATIBILITY_BLOCKER_CODES = [
  'excluded_status_null_not_representable_by_import_contract_v1',
  'source_review_blinding_provenance_has_no_exact_import_v1_mapping',
  'source_full_text_provenance_has_no_exact_import_v1_mapping',
] as const
const REQUIRED_TERMINAL_BLOCKERS = EXECUTION_COMPATIBILITY_BLOCKER_CODES
const TERMINAL_ACTION_COUNTS = {
  incompatible: 630,
  initial: 0,
  inserts: 0,
  noops: 0,
  revisions: 0,
  total: 630,
  unresolved: 0,
} as const
const TERMINAL_EXECUTION_COUNTS = {
  excluded_status_null_not_representable_by_import_contract_v1: 272,
  source_review_blinding_provenance_has_no_exact_import_v1_mapping: 630,
  source_full_text_provenance_has_no_exact_import_v1_mapping: 50,
} as const
const FINAL_V3_ARTIFACT_SHA256 =
  '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59' as const
const LIST_NORMALIZATION_LEDGER_SHA256 =
  'cabe823a4d63962ae6061e1c2d8af6f2361ae586d5a8b4ee632b68a3d08e898d' as const
const DIAGNOSTIC_CANONICAL_ARTIFACT_NAMES = [
  'contract-diagnostics.json',
  'contract-reconciliation.json',
  'development-planning-state.json',
  'migration-audit.json',
  'migration-audit.md',
  'read-only-state-bracket.json',
  'schema-security-definition-identity.json',
] as const
const COMPATIBILITY_CANONICAL_ARTIFACT_NAMES = [
  'boolean-normalization-report.json',
  'existing-head-compatibility-audit.json',
  'field-lineage.json',
  'field-lineage.md',
  'forward-import-contract-repair-requirements.json',
  'list-normalization-report.json',
  'note-disposition-audit.json',
  'package-readiness.json',
] as const
const NOTE_DISPOSITION_REASON =
  'NOTE DISPOSITION ALREADY AUTHORIZED: the exact amended two-row authorization preserves the current physician rationale instead of applying finalized V3 prose.' as const
const EXISTING_HEAD_PMIDS = [
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
const FORWARD_REPAIR_REQUIREMENT_IDS = [
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
const REQUESTED_RECONCILIATION_NAME_DISCREPANCY = {
  aliasCreated: false,
  canonicalName: 'reconcile_literature_gold_review_operation_v1',
  classification: 'audit_expectation_defect',
  requestedName: 'reconcile_literature_gold_import_v1',
} as const
const REQUIRED_TEST_BUILD_CHECKS = [
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

const HELP = `
Create the checksum-verified additive delivery backup for the post-migration reconciliation PR.

Usage:
  npm run literature:backup-post-migration-contract-reconciliation -- \
    --contract-diagnostic <directory> \
    --contract-diagnostic-manifest-sha256 <sha256> \
    --compatibility-audit <directory> \
    --compatibility-audit-manifest-sha256 <sha256> \
    --diff-stat-reconciliation <canonical-json> \
    --test-build-report <json> --merge-readiness-report <json> \
    --backup-root <existing-backup-root> \
    --output <post-migration-contract-reconciliation-v1-CURRENT_HEAD>

The command is file-only, requires a clean reviewed feature worktree, preserves every source byte,
every changed HEAD blob, and the exact origin/main...HEAD semantic patch, then creates a new private
directory with a sorted checksum manifest. Validation and merge-readiness reports must bind the same HEAD and audit manifests while recording terminal state
${POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE}. It never contacts a database.
`.trim()

export interface PostMigrationReconciliationBackupDependencies {
  cwd?: string
  expectedListNormalizationLedgerSha256ForTest?: string
  now?: () => Date
  runCommand?: CommandRunner
  verifyDiagnosticBundleForTest?: (
    input: Parameters<typeof verifyReadyPostMigrationAuditPackage>[0],
  ) => void
}

interface PreservedFile {
  gitMode?: string
  originalName: string
  sha256: string
  storedName: string
  text: string
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`)
}

function utf8(bytes: Buffer, label: string): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`${label} must be valid UTF-8.`)
  }
  if (!text.endsWith('\n') || text.endsWith('\n\n')) {
    throw new Error(`${label} must have exactly one final newline.`)
  }
  return text
}

function exactRecordKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const record = value as Record<string, unknown>
  const actual = Object.keys(record).sort()
  const wanted = [...expected].sort()
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${label} does not contain the exact allowed fields.`)
  }
  return record
}

async function readRegularFile(path: string, label: string): Promise<Buffer> {
  const absolutePath = resolve(path)
  const [stat, resolvedPath] = await Promise.all([lstat(absolutePath), realpath(absolutePath)])
  if (!stat.isFile() || stat.isSymbolicLink() || resolvedPath !== absolutePath) {
    throw new Error(`${label} must be a regular non-symlink file.`)
  }
  return readFile(absolutePath)
}

function parseCanonicalManifest(text: string): ReadonlyMap<string, string> {
  const entries = new Map<string, string>()
  let previousName = ''
  for (const line of text.trimEnd().split('\n')) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(line)
    if (!match) throw new Error('Source checksum manifest contains a malformed entry.')
    const [, checksum, name] = match
    if (!checksum || !name || entries.has(name) || name <= previousName) {
      throw new Error('Source checksum manifest contains a missing, duplicate, or unsorted entry.')
    }
    entries.set(name, checksum)
    previousName = name
  }
  if (entries.size === 0) throw new Error('Source checksum manifest is empty.')
  return entries
}

interface SourceAuditFile {
  bytes: Buffer
  name: string
  text: string
}

function canonicalJsonArtifact(
  files: readonly SourceAuditFile[],
  name: string,
  label: string,
): Record<string, unknown> {
  const source = files.find((file) => file.name === name)
  let parsed: unknown
  try {
    parsed = JSON.parse(source?.text ?? '') as unknown
  } catch {
    throw new Error(`${label} must be valid canonical JSON.`)
  }
  if (!source || canonicalJson(parsed) !== source.text) {
    throw new Error(`${label} must be valid canonical JSON.`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed as Record<string, unknown>
}

function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`)
  }
}

function assertExactClassificationCounts(
  value: unknown,
  expected: Readonly<Record<(typeof CONTRACT_RECONCILIATION_CLASSIFICATIONS)[number], number>>,
  label: string,
): void {
  const counts = exactRecordKeys(value, CONTRACT_RECONCILIATION_CLASSIFICATIONS, label)
  if (
    Object.values(counts).some((count) => !Number.isSafeInteger(count) || (count as number) < 0) ||
    canonicalJson(counts) !== canonicalJson(expected)
  ) {
    throw new Error(`${label} does not contain the exact reconciled classification counts.`)
  }
}

const EXPECTED_RECONCILIATION_CLASSIFICATION_PARTITIONS = {
  combined: {
    classificationCounts: {
      audit_expectation_defect: 1,
      environment_representation_only: 219,
      explicitly_supported_local_profile: 526,
      identical: 26,
      missing_expected_object: 0,
      security_contract_difference: 0,
      semantic_contract_difference: 0,
      unexpected_object: 0,
    },
    total: 772,
  },
  deploymentProfile: {
    classificationCounts: {
      audit_expectation_defect: 0,
      environment_representation_only: 0,
      explicitly_supported_local_profile: 0,
      identical: 6,
      missing_expected_object: 0,
      security_contract_difference: 0,
      semantic_contract_difference: 0,
      unexpected_object: 0,
    },
    total: 6,
  },
  rpcs: {
    classificationCounts: {
      audit_expectation_defect: 0,
      environment_representation_only: 0,
      explicitly_supported_local_profile: 3,
      identical: 0,
      missing_expected_object: 0,
      security_contract_difference: 0,
      semantic_contract_difference: 0,
      unexpected_object: 0,
    },
    total: 3,
  },
  schemaSecurityRecords: {
    classificationCounts: {
      audit_expectation_defect: 1,
      environment_representation_only: 219,
      explicitly_supported_local_profile: 523,
      identical: 20,
      missing_expected_object: 0,
      security_contract_difference: 0,
      semantic_contract_difference: 0,
      unexpected_object: 0,
    },
    total: 763,
  },
} as const

function assertReconciliationClassificationPartitions(value: unknown, label: string): void {
  const partitions = exactRecordKeys(
    value,
    ['combined', 'deploymentProfile', 'rpcs', 'schemaSecurityRecords'],
    label,
  )
  for (const [partitionName, expected] of Object.entries(
    EXPECTED_RECONCILIATION_CLASSIFICATION_PARTITIONS,
  )) {
    const partition = exactRecordKeys(
      partitions[partitionName],
      ['classificationCounts', 'total'],
      `${label}.${partitionName}`,
    )
    if (partition.total !== expected.total) {
      throw new Error(`${label}.${partitionName} has the wrong arithmetic total.`)
    }
    assertExactClassificationCounts(
      partition.classificationCounts,
      expected.classificationCounts,
      `${label}.${partitionName}.classificationCounts`,
    )
  }
}

function assertReadyContractReconciliation(
  value: unknown,
  label: string,
  includeRequestedNameDiscrepancies: boolean,
): Record<string, unknown> {
  const fields = [
    'classificationCounts',
    'classificationPartitions',
    'combinedClassificationCounts',
    'completeness',
    'deploymentProfile',
    'deploymentProfileClassificationCounts',
    'fullEnvironmentInventoryMatches',
    'identities',
    'invariantIdentityMatches',
    'ownerAclTerminalState',
    'ownerRepresentation',
    'profileDiffs',
    'readinessBlockers',
    'ready',
    'recordDiffs',
    'rpcDiffs',
    'rpcClassificationCounts',
    'schemaSecurityRecordClassificationCounts',
    'schemaVersion',
    ...(includeRequestedNameDiscrepancies ? ['requestedNameDiscrepancies'] : []),
  ]
  const reconciliation = exactRecordKeys(value, fields, label)
  const completeness = exactRecordKeys(
    reconciliation.completeness,
    [
      'actualRecordCount',
      'actualRecordsAccountedFor',
      'complete',
      'expectedRecordCount',
      'expectedRecordsAccountedFor',
    ],
    `${label}.completeness`,
  )
  const ownerRepresentation = exactRecordKeys(
    reconciliation.ownerRepresentation,
    [
      'actualRecordCount',
      'collapsedByObjectType',
      'collapsedExpectedRecordCount',
      'expectedRecordCount',
      'explanation',
      'isExact763To683OwnerRepresentation',
      'projectedExpectedRecordCount',
      'projectionExactlyMatchesActual',
      'recordCountDelta',
    ],
    `${label}.ownerRepresentation`,
  )
  if (
    reconciliation.schemaVersion !== 'gold-import-compensation-contract-reconciliation/1.0.0' ||
    reconciliation.ready !== true ||
    reconciliation.ownerAclTerminalState !== OWNER_ACL_AUDIT_READY_TERMINAL_STATE ||
    !Array.isArray(reconciliation.readinessBlockers) ||
    reconciliation.readinessBlockers.length !== 0 ||
    reconciliation.invariantIdentityMatches !== true ||
    reconciliation.fullEnvironmentInventoryMatches !== false ||
    canonicalJson(completeness) !==
      canonicalJson({
        actualRecordCount: 683,
        actualRecordsAccountedFor: 683,
        complete: true,
        expectedRecordCount: 763,
        expectedRecordsAccountedFor: 763,
      }) ||
    ownerRepresentation.actualRecordCount !== 683 ||
    ownerRepresentation.expectedRecordCount !== 763 ||
    ownerRepresentation.projectedExpectedRecordCount !== 683 ||
    ownerRepresentation.recordCountDelta !== 80 ||
    ownerRepresentation.collapsedExpectedRecordCount !== 80 ||
    ownerRepresentation.isExact763To683OwnerRepresentation !== true ||
    ownerRepresentation.projectionExactlyMatchesActual !== true ||
    !Array.isArray(reconciliation.recordDiffs) ||
    reconciliation.recordDiffs.length !== 763 ||
    !Array.isArray(reconciliation.rpcDiffs) ||
    reconciliation.rpcDiffs.length !== 3 ||
    !Array.isArray(reconciliation.profileDiffs) ||
    reconciliation.profileDiffs.length !== 6
  ) {
    throw new Error(`${label} is not the exact ready 763/3/6 local owner/ACL reconciliation.`)
  }
  assertReconciliationClassificationPartitions(
    reconciliation.classificationPartitions,
    `${label}.classificationPartitions`,
  )
  assertExactClassificationCounts(
    reconciliation.classificationCounts,
    EXPECTED_RECONCILIATION_CLASSIFICATION_PARTITIONS.combined.classificationCounts,
    `${label}.classificationCounts`,
  )
  assertExactClassificationCounts(
    reconciliation.schemaSecurityRecordClassificationCounts,
    EXPECTED_RECONCILIATION_CLASSIFICATION_PARTITIONS.schemaSecurityRecords.classificationCounts,
    `${label}.schemaSecurityRecordClassificationCounts`,
  )
  assertExactClassificationCounts(
    reconciliation.rpcClassificationCounts,
    EXPECTED_RECONCILIATION_CLASSIFICATION_PARTITIONS.rpcs.classificationCounts,
    `${label}.rpcClassificationCounts`,
  )
  assertExactClassificationCounts(
    reconciliation.deploymentProfileClassificationCounts,
    EXPECTED_RECONCILIATION_CLASSIFICATION_PARTITIONS.deploymentProfile.classificationCounts,
    `${label}.deploymentProfileClassificationCounts`,
  )
  assertExactClassificationCounts(
    reconciliation.combinedClassificationCounts,
    EXPECTED_RECONCILIATION_CLASSIFICATION_PARTITIONS.combined.classificationCounts,
    `${label}.combinedClassificationCounts`,
  )
  if (
    includeRequestedNameDiscrepancies &&
    canonicalJson(reconciliation.requestedNameDiscrepancies) !==
      canonicalJson([REQUESTED_RECONCILIATION_NAME_DISCREPANCY])
  ) {
    throw new Error(`${label} does not preserve the exact requested-name audit defect.`)
  }
  return reconciliation
}

function assertTerminalUnresolved(value: unknown, label: string): void {
  const unresolved = exactRecordKeys(value, ['count', 'pmids'], `${label} unresolved`)
  if (unresolved.count !== 0 || !Array.isArray(unresolved.pmids) || unresolved.pmids.length !== 0) {
    throw new Error(`${label} contradicts the terminal-4 zero-unresolved contract.`)
  }
}

function assertTerminalActionCounts(value: unknown, label: string): void {
  const counts = exactRecordKeys(
    value,
    ['incompatible', 'initial', 'inserts', 'noops', 'revisions', 'total', 'unresolved'],
    `${label} actionCounts`,
  )
  if (canonicalJson(counts) !== canonicalJson(TERMINAL_ACTION_COUNTS)) {
    throw new Error(`${label} does not contain the exact terminal-4 action counts.`)
  }
}

function assertExecutionIdentityList(
  value: unknown,
  expectedCount: number,
  label: string,
): ReadonlySet<string> {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error(`${label} does not contain the exact expected identity count.`)
  }
  const itemIds = new Set<string>()
  value.forEach((rawIdentity, index) => {
    const identity = exactRecordKeys(
      rawIdentity,
      ['datasetSplit', 'itemId', 'masterRowId', 'pmid'],
      `${label} identity ${index + 1}`,
    )
    if (
      identity.datasetSplit !== 'development' ||
      typeof identity.itemId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        identity.itemId,
      ) ||
      typeof identity.masterRowId !== 'string' ||
      !/^[1-9][0-9]*$/u.test(identity.masterRowId) ||
      typeof identity.pmid !== 'string' ||
      !/^[0-9]{1,12}$/u.test(identity.pmid) ||
      itemIds.has(identity.itemId)
    ) {
      throw new Error(`${label} contains a malformed or duplicate development identity.`)
    }
    itemIds.add(identity.itemId)
  })
  return itemIds
}

function assertTerminalExecutionCompatibility(value: unknown, label: string): void {
  const execution = exactRecordKeys(
    value,
    ['blockedRowCount', 'countsByCode', 'executableRowCount', 'identitiesByCode', 'totalRowCount'],
    `${label} executionCompatibility`,
  )
  const counts = exactRecordKeys(
    execution.countsByCode,
    EXECUTION_COMPATIBILITY_BLOCKER_CODES,
    `${label} executionCompatibility countsByCode`,
  )
  const identities = exactRecordKeys(
    execution.identitiesByCode,
    EXECUTION_COMPATIBILITY_BLOCKER_CODES,
    `${label} executionCompatibility identitiesByCode`,
  )
  if (
    execution.totalRowCount !== 630 ||
    execution.blockedRowCount !== 630 ||
    execution.executableRowCount !== 0 ||
    canonicalJson(counts) !== canonicalJson(TERMINAL_EXECUTION_COUNTS)
  ) {
    throw new Error(`${label} does not contain the exact terminal-4 execution counts.`)
  }
  const blindedIdentities = assertExecutionIdentityList(
    identities.source_review_blinding_provenance_has_no_exact_import_v1_mapping,
    TERMINAL_EXECUTION_COUNTS.source_review_blinding_provenance_has_no_exact_import_v1_mapping,
    `${label} blinding blockers`,
  )
  const excludedIdentities = assertExecutionIdentityList(
    identities.excluded_status_null_not_representable_by_import_contract_v1,
    TERMINAL_EXECUTION_COUNTS.excluded_status_null_not_representable_by_import_contract_v1,
    `${label} excluded-status blockers`,
  )
  const fullTextIdentities = assertExecutionIdentityList(
    identities.source_full_text_provenance_has_no_exact_import_v1_mapping,
    TERMINAL_EXECUTION_COUNTS.source_full_text_provenance_has_no_exact_import_v1_mapping,
    `${label} full-text-provenance blockers`,
  )
  if (
    [...excludedIdentities].some((itemId) => !blindedIdentities.has(itemId)) ||
    [...fullTextIdentities].some((itemId) => !blindedIdentities.has(itemId))
  ) {
    throw new Error(`${label} execution blocker identity sets are internally inconsistent.`)
  }
}

function assertTerminalCompatibilityDetails(record: Record<string, unknown>, label: string): void {
  assertTerminalUnresolved(record.unresolved, label)
  assertTerminalActionCounts(record.actionCounts, label)
  assertTerminalExecutionCompatibility(record.executionCompatibility, label)
}

function assertCompatibilitySafety(
  value: unknown,
  label: string,
  includeSourceArtifactState: boolean,
): void {
  const safety = exactRecordKeys(
    value,
    [
      'compensationExecuted',
      'databaseMutationCount',
      'databaseQueriesExecuted',
      'heldOutIdentitiesAccessed',
      'importExecuted',
      'remoteDatabaseAccessed',
      ...(includeSourceArtifactState
        ? ['sourceArtifactBytesPreserved', 'sourceArtifactWritten']
        : []),
    ],
    label,
  )
  if (
    safety.compensationExecuted !== false ||
    safety.databaseMutationCount !== 0 ||
    safety.databaseQueriesExecuted !== 0 ||
    safety.heldOutIdentitiesAccessed !== false ||
    safety.importExecuted !== false ||
    safety.remoteDatabaseAccessed !== false ||
    (includeSourceArtifactState &&
      (safety.sourceArtifactBytesPreserved !== true || safety.sourceArtifactWritten !== false))
  ) {
    throw new Error(`${label} does not attest the exact file-only zero-mutation safety state.`)
  }
}

function assertNoteDispositionAudit(value: unknown, label: string): string {
  const audit = exactRecordKeys(
    value,
    [
      'authorizationTemplateRequired',
      'disposition',
      'physicalHistoryEvidence',
      'rows',
      'ruleVersion',
      'schemaVersion',
      'sourceBindings',
      'status',
    ],
    label,
  )
  const sourceBindings = exactRecordKeys(
    audit.sourceBindings,
    [
      'amendedAuthorizationSha256',
      'authorizationManifestSha256',
      'authorizationMappingSha256',
      'authorizationMappingCorrectionManifestSha256',
      'authorizationMappingCorrectionSha256',
      'currentEffectiveStateSha256',
      'currentPhysicalStateSha256',
      'developmentPlanningStateSha256',
      'finalizedV3ArtifactSha256',
    ],
    `${label}.sourceBindings`,
  )
  const physicalHistory = exactRecordKeys(
    audit.physicalHistoryEvidence,
    ['currentPointersAreLatestHeads', 'revisionChainsLinear'],
    `${label}.physicalHistoryEvidence`,
  )
  if (
    audit.schemaVersion !== GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SCHEMA_VERSION ||
    audit.ruleVersion !== GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION ||
    audit.status !== GOLD_IMPORT_NOTE_DISPOSITION_STATUS ||
    audit.disposition !== GOLD_IMPORT_NOTE_DISPOSITION ||
    audit.authorizationTemplateRequired !== false ||
    physicalHistory.currentPointersAreLatestHeads !== true ||
    physicalHistory.revisionChainsLinear !== true ||
    sourceBindings.amendedAuthorizationSha256 !== GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256 ||
    sourceBindings.authorizationMappingSha256 !== GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256 ||
    sourceBindings.authorizationManifestSha256 !== GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256 ||
    sourceBindings.authorizationMappingCorrectionSha256 !==
      GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256 ||
    sourceBindings.authorizationMappingCorrectionManifestSha256 !==
      GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256 ||
    sourceBindings.finalizedV3ArtifactSha256 !== FINAL_V3_ARTIFACT_SHA256
  ) {
    throw new Error(`${label} is not the exact already-authorized two-row disposition evidence.`)
  }
  for (const field of [
    'currentEffectiveStateSha256',
    'currentPhysicalStateSha256',
    'developmentPlanningStateSha256',
  ]) {
    assertDigest(sourceBindings[field], `${label}.sourceBindings.${field}`)
  }
  if (!Array.isArray(audit.rows) || audit.rows.length !== 2) {
    throw new Error(`${label} must contain the exact two authorized note rows.`)
  }
  const pmids: string[] = []
  audit.rows.forEach((rawRow, index) => {
    const row = exactRecordKeys(
      rawRow,
      [
        'amendedAuthorizationRationaleSha256',
        'currentNote',
        'currentNoteSha256',
        'currentReviewId',
        'currentRevision',
        'disposition',
        'exactAuthorizedRationalePreserved',
        'finalizedV3Note',
        'finalizedV3NoteSha256',
        'itemId',
        'masterRowId',
        'pmid',
      ],
      `${label}.rows[${index}]`,
    )
    if (
      typeof row.currentNote !== 'string' ||
      typeof row.finalizedV3Note !== 'string' ||
      typeof row.pmid !== 'string' ||
      row.disposition !== GOLD_IMPORT_NOTE_DISPOSITION ||
      row.exactAuthorizedRationalePreserved !== true ||
      row.currentNote === row.finalizedV3Note ||
      row.currentNoteSha256 !== sha256(row.currentNote) ||
      row.finalizedV3NoteSha256 !== sha256(row.finalizedV3Note) ||
      row.amendedAuthorizationRationaleSha256 !== row.currentNoteSha256 ||
      typeof row.currentReviewId !== 'string' ||
      typeof row.currentRevision !== 'number' ||
      !Number.isSafeInteger(row.currentRevision) ||
      row.currentRevision < 1 ||
      typeof row.itemId !== 'string' ||
      typeof row.masterRowId !== 'string'
    ) {
      throw new Error(`${label} contains malformed or non-preserving note evidence.`)
    }
    pmids.push(row.pmid)
  })
  if (canonicalJson(pmids) !== canonicalJson(['36879724', '39281191'])) {
    throw new Error(`${label} does not contain the exact ordered two-PMID note cohort.`)
  }
  return sha256(compactCanonicalJson(audit))
}

function assertFieldLineage(value: unknown, markdown: string, label: string): string {
  const lineage = exactRecordKeys(value, ['conclusions', 'fields', 'schemaVersion', 'scope'], label)
  const scope = exactRecordKeys(
    lineage.scope,
    ['fieldCount', 'finalizedWorkflow', 'importContract'],
    `${label}.scope`,
  )
  if (
    lineage.schemaVersion !== GOLD_IMPORT_FIELD_LINEAGE_SCHEMA_VERSION ||
    scope.fieldCount !== 13 ||
    scope.finalizedWorkflow !== 'gold-set-v1-enrichment-v3' ||
    scope.importContract !== 'gold-import-compensation-v1' ||
    !Array.isArray(lineage.fields) ||
    lineage.fields.length !== 13
  ) {
    throw new Error(`${label} does not contain the exact 13-field lineage boundary.`)
  }
  const digest = sha256(compactCanonicalJson(lineage))
  if (
    !markdown.startsWith('# Gold import contract v1 field-lineage audit\n') ||
    !markdown.includes(`Canonical JSON SHA-256: \`${digest}\``) ||
    !markdown.includes(`Schema: \`${GOLD_IMPORT_FIELD_LINEAGE_SCHEMA_VERSION}\``)
  ) {
    throw new Error(`${label} markdown does not bind its canonical JSON lineage digest.`)
  }
  return digest
}

function assertForwardRepairRequirements(
  value: unknown,
  expectedNoteDispositionSha256: string,
  label: string,
): string {
  const requirements = exactRecordKeys(
    value,
    [
      'importContractForwardMigrationRequired',
      'noteDisposition',
      'ownerAclForwardMigrationRequired',
      'physicianStatusDecisionRequired',
      'requirements',
      'schemaVersion',
      'sourceArtifactChangeRequired',
    ],
    label,
  )
  const noteDisposition = exactRecordKeys(
    requirements.noteDisposition,
    ['evidenceSha256', 'status'],
    `${label}.noteDisposition`,
  )
  if (
    requirements.schemaVersion !== GOLD_IMPORT_FORWARD_REPAIR_SCHEMA_VERSION ||
    requirements.ownerAclForwardMigrationRequired !== false ||
    requirements.importContractForwardMigrationRequired !== true ||
    requirements.sourceArtifactChangeRequired !== false ||
    requirements.physicianStatusDecisionRequired !== false ||
    noteDisposition.status !== GOLD_IMPORT_NOTE_DISPOSITION_STATUS ||
    noteDisposition.evidenceSha256 !== expectedNoteDispositionSha256 ||
    !Array.isArray(requirements.requirements) ||
    requirements.requirements.length !== FORWARD_REPAIR_REQUIREMENT_IDS.length
  ) {
    throw new Error(`${label} does not contain the exact fail-closed forward-repair boundary.`)
  }
  const ids = requirements.requirements.map((rawRequirement, index) => {
    const requirement = exactRecordKeys(
      rawRequirement,
      ['id', 'requirement'],
      `${label}.requirements[${index}]`,
    )
    if (typeof requirement.requirement !== 'string' || requirement.requirement.length === 0) {
      throw new Error(`${label} contains an empty forward-repair requirement.`)
    }
    return requirement.id
  })
  if (canonicalJson(ids) !== canonicalJson(FORWARD_REPAIR_REQUIREMENT_IDS)) {
    throw new Error(`${label} does not contain the exact ordered forward-repair requirements.`)
  }
  return sha256(compactCanonicalJson(requirements))
}

function assertNormalizationReports(
  booleanReportValue: unknown,
  listReportValue: unknown,
  expectedListNormalizationLedgerSha256: string,
): { listNormalizationLedgerSha256: string } {
  const booleanReport = exactRecordKeys(
    booleanReportValue,
    [
      'artifactRowCount',
      'existingHeadLegacyFalseCount',
      'existingHeadLegacyFalseNormalizations',
      'legacyTitleCaseNormalizationCount',
      'normalizationCount',
      'normalizationRuleVersion',
      'normalizations',
      'schemaVersion',
      'sourceArtifactBytesPreserved',
      'sourceArtifactSha256',
    ],
    'compatibility-audit boolean normalization report',
  )
  const listReport = exactRecordKeys(
    listReportValue,
    [
      'artifactRowCount',
      'normalizationCount',
      'normalizationCountsByColumn',
      'normalizationLedgerSha256',
      'normalizationRuleVersion',
      'normalizations',
      'schemaVersion',
      'sourceArtifactBytesPreserved',
      'sourceArtifactSha256',
    ],
    'compatibility-audit list normalization report',
  )
  const listCounts = exactRecordKeys(
    listReport.normalizationCountsByColumn,
    ['clinical_purposes', 'disease_tags', 'technology_tags', 'topic_ids'],
    'compatibility-audit list normalization counts',
  )
  if (
    booleanReport.schemaVersion !== 'gold-import-boolean-normalization-report/1.0.0' ||
    booleanReport.normalizationRuleVersion !== GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION ||
    booleanReport.sourceArtifactSha256 !== FINAL_V3_ARTIFACT_SHA256 ||
    booleanReport.sourceArtifactBytesPreserved !== true ||
    booleanReport.artifactRowCount !== 630 ||
    booleanReport.normalizationCount !== 1890 ||
    booleanReport.legacyTitleCaseNormalizationCount !== 630 ||
    booleanReport.existingHeadLegacyFalseCount !== 9 ||
    !Array.isArray(booleanReport.normalizations) ||
    booleanReport.normalizations.length !== 1890 ||
    !Array.isArray(booleanReport.existingHeadLegacyFalseNormalizations) ||
    booleanReport.existingHeadLegacyFalseNormalizations.length !== 9 ||
    listReport.schemaVersion !== 'gold-import-list-normalization-report/1.0.0' ||
    listReport.normalizationRuleVersion !== GOLD_IMPORT_LIST_NORMALIZATION_RULE_VERSION ||
    listReport.sourceArtifactSha256 !== FINAL_V3_ARTIFACT_SHA256 ||
    listReport.sourceArtifactBytesPreserved !== true ||
    listReport.artifactRowCount !== 630 ||
    listReport.normalizationCount !== 354 ||
    canonicalJson(listCounts) !==
      canonicalJson({
        clinical_purposes: 127,
        disease_tags: 27,
        technology_tags: 45,
        topic_ids: 155,
      }) ||
    listReport.normalizationLedgerSha256 !== expectedListNormalizationLedgerSha256 ||
    !Array.isArray(listReport.normalizations) ||
    listReport.normalizations.length !== 354 ||
    sha256(compactCanonicalJson(listReport.normalizations)) !==
      expectedListNormalizationLedgerSha256
  ) {
    throw new Error('Compatibility normalization reports do not bind the exact 630-row ledgers.')
  }
  return { listNormalizationLedgerSha256: expectedListNormalizationLedgerSha256 }
}

function assertExistingHeadRows(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== EXISTING_HEAD_PMIDS.length) {
    throw new Error(`${label} must contain the exact nine existing development heads.`)
  }
  const pmids: string[] = []
  const authorizedNotePmids: string[] = []
  value.forEach((rawRow, rowIndex) => {
    const row = exactRecordKeys(
      rawRow,
      [
        'currentReviewId',
        'currentRevision',
        'effectiveReviewId',
        'fields',
        'identity',
        'physicianReviewCohort',
        'proposedAction',
        'reason',
        'resolutionStatus',
      ],
      `${label}[${rowIndex}]`,
    )
    const identity = exactRecordKeys(
      row.identity,
      ['datasetSplit', 'itemId', 'masterRowId', 'pmid'],
      `${label}[${rowIndex}].identity`,
    )
    if (
      identity.datasetSplit !== 'development' ||
      typeof identity.pmid !== 'string' ||
      row.resolutionStatus !== 'incompatible' ||
      row.proposedAction !== null ||
      !Array.isArray(row.fields) ||
      row.fields.length !== COMPATIBILITY_PROJECTION_FIELDS.length
    ) {
      throw new Error(`${label} contains a malformed terminal-4 existing-head row.`)
    }
    const seenFields: unknown[] = []
    row.fields.forEach((rawField, fieldIndex) => {
      const field = exactRecordKeys(
        rawField,
        ['classification', 'currentValue', 'field', 'reason', 'resolvedValue', 'sourceValue'],
        `${label}[${rowIndex}].fields[${fieldIndex}]`,
      )
      seenFields.push(field.field)
      if (field.classification === 'incompatible') {
        throw new Error(`${label} retains an incompatible existing-head field classification.`)
      }
      if (
        field.field === 'notes' &&
        field.classification === 'existing_physician_note_preserved_by_amended_authorization'
      ) {
        if (
          field.reason !== NOTE_DISPOSITION_REASON ||
          field.resolvedValue !== field.currentValue ||
          field.sourceValue === field.currentValue
        ) {
          throw new Error(`${label} does not preserve the exact authorized physician note.`)
        }
        authorizedNotePmids.push(identity.pmid as string)
      }
    })
    if (canonicalJson(seenFields) !== canonicalJson(COMPATIBILITY_PROJECTION_FIELDS)) {
      throw new Error(`${label} does not classify the exact ordered 20-field projection.`)
    }
    pmids.push(identity.pmid as string)
  })
  if (
    canonicalJson(pmids) !== canonicalJson(EXISTING_HEAD_PMIDS) ||
    canonicalJson(authorizedNotePmids) !== canonicalJson(['36879724', '39281191'])
  ) {
    throw new Error(`${label} does not preserve the exact nine-head/two-note cohort.`)
  }
}

function assertPlanningDispositions(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 630) {
    throw new Error(`${label} must contain exactly 630 terminal-4 planning dispositions.`)
  }
  const itemIds = new Set<string>()
  value.forEach((rawRow, index) => {
    const row = exactRecordKeys(
      rawRow,
      [
        'executionBlockerCodes',
        'identity',
        'proposedAction',
        'reason',
        'resolutionStatus',
        'sequence',
      ],
      `${label}[${index}]`,
    )
    const identity = exactRecordKeys(
      row.identity,
      ['datasetSplit', 'itemId', 'masterRowId', 'pmid'],
      `${label}[${index}].identity`,
    )
    if (
      row.sequence !== index + 1 ||
      row.resolutionStatus !== 'incompatible' ||
      row.proposedAction !== null ||
      !Array.isArray(row.executionBlockerCodes) ||
      row.executionBlockerCodes.length === 0 ||
      row.executionBlockerCodes.some(
        (code) =>
          typeof code !== 'string' ||
          !EXECUTION_COMPATIBILITY_BLOCKER_CODES.includes(
            code as (typeof EXECUTION_COMPATIBILITY_BLOCKER_CODES)[number],
          ),
      ) ||
      identity.datasetSplit !== 'development' ||
      typeof identity.itemId !== 'string' ||
      itemIds.has(identity.itemId)
    ) {
      throw new Error(`${label} contains a malformed or executable planning disposition.`)
    }
    itemIds.add(identity.itemId)
  })
}

function assertCompatibilitySourceBindings(
  value: unknown,
  input: {
    expectedFieldLineageSha256: string
    expectedForwardRepairRequirementsSha256: string
    expectedListNormalizationLedgerSha256: string
    expectedNoteDispositionAuditSha256: string
    expectedPostMigrationAuditManifestSha256: string
  },
  label: string,
): Record<string, unknown> {
  const bindings = exactRecordKeys(
    value,
    [
      'amendedAuthorizationSha256',
      'authorizationManifestSha256',
      'authorizationMappingSha256',
      'authorizationMappingCorrectionManifestSha256',
      'authorizationMappingCorrectionSha256',
      'contract',
      'currentDatabase',
      'existingHeadCohortSha256',
      'fieldLineageSha256',
      'finalV3ArtifactSha256',
      'forwardRepairRequirementsSha256',
      'listNormalizationLedgerSha256',
      'migration',
      'noteDispositionAuditSha256',
      'postMigrationAuditManifestSha256',
    ],
    label,
  )
  const contract = exactRecordKeys(
    bindings.contract,
    ['environmentInvariantIdentitySha256', 'environmentProfileIdentitySha256'],
    `${label}.contract`,
  )
  const currentDatabase = exactRecordKeys(
    bindings.currentDatabase,
    [
      'batchId',
      'developmentMembershipSha256',
      'developmentPlanningStateSha256',
      'effectiveStateSha256',
      'physicalStateSha256',
    ],
    `${label}.currentDatabase`,
  )
  const migration = exactRecordKeys(
    bindings.migration,
    ['applied', 'id', 'ledgerOccurrences', 'sha256'],
    `${label}.migration`,
  )
  if (
    bindings.postMigrationAuditManifestSha256 !== input.expectedPostMigrationAuditManifestSha256 ||
    bindings.finalV3ArtifactSha256 !== FINAL_V3_ARTIFACT_SHA256 ||
    bindings.listNormalizationLedgerSha256 !== input.expectedListNormalizationLedgerSha256 ||
    bindings.fieldLineageSha256 !== input.expectedFieldLineageSha256 ||
    bindings.forwardRepairRequirementsSha256 !== input.expectedForwardRepairRequirementsSha256 ||
    bindings.noteDispositionAuditSha256 !== input.expectedNoteDispositionAuditSha256 ||
    bindings.amendedAuthorizationSha256 !== GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256 ||
    bindings.authorizationMappingSha256 !== GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256 ||
    bindings.authorizationManifestSha256 !== GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256 ||
    bindings.authorizationMappingCorrectionSha256 !==
      GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256 ||
    bindings.authorizationMappingCorrectionManifestSha256 !==
      GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256 ||
    migration.id !== GOLD_IMPORT_COMPENSATION_MIGRATION_ID ||
    migration.applied !== true ||
    migration.ledgerOccurrences !== 1
  ) {
    throw new Error(`${label} does not bind the exact diagnostic/source evidence graph.`)
  }
  ;[
    bindings.existingHeadCohortSha256,
    migration.sha256,
    contract.environmentInvariantIdentitySha256,
    contract.environmentProfileIdentitySha256,
    currentDatabase.developmentMembershipSha256,
    currentDatabase.developmentPlanningStateSha256,
    currentDatabase.effectiveStateSha256,
    currentDatabase.physicalStateSha256,
  ].forEach((digest, index) => assertDigest(digest, `${label} digest ${index + 1}`))
  if (
    typeof currentDatabase.batchId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      currentDatabase.batchId,
    )
  ) {
    throw new Error(`${label}.currentDatabase.batchId is malformed.`)
  }
  return bindings
}

export async function preserveAuditDirectory(input: {
  directory: string
  expectedListNormalizationLedgerSha256ForTest?: string
  expectedManifestSha256: string
  expectedPostMigrationAuditManifestSha256?: string
  expectedRepositoryCommitSha: string
  prefix: 'compatibility-audit' | 'contract-diagnostic'
  verifyDiagnosticBundleForTest?: (
    input: Parameters<typeof verifyReadyPostMigrationAuditPackage>[0],
  ) => void
}): Promise<PreservedFile[]> {
  if (
    (input.expectedListNormalizationLedgerSha256ForTest || input.verifyDiagnosticBundleForTest) &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error('Backup evidence verifier overrides are restricted to tests.')
  }
  const expectedListNormalizationLedgerSha256 =
    input.expectedListNormalizationLedgerSha256ForTest ?? LIST_NORMALIZATION_LEDGER_SHA256
  assertSha256(expectedListNormalizationLedgerSha256, 'list normalization ledger SHA-256')
  assertSha256(input.expectedManifestSha256, `${input.prefix} manifest SHA-256`)
  if (!/^[a-f0-9]{40}$/u.test(input.expectedRepositoryCommitSha)) {
    throw new Error(`${input.prefix} expected repository commit must be a 40-character SHA.`)
  }
  const directory = resolve(input.directory)
  const [stat, resolvedDirectory] = await Promise.all([lstat(directory), realpath(directory)])
  if (!stat.isDirectory() || stat.isSymbolicLink() || resolvedDirectory !== directory) {
    throw new Error(`${input.prefix} source must be a real non-symlink directory.`)
  }
  const names = (await readdir(directory)).sort((left, right) => left.localeCompare(right, 'en'))
  if (names.some((name) => !SAFE_COMPONENT_PATTERN.test(name))) {
    throw new Error(`${input.prefix} contains an unsafe filename.`)
  }
  const sourceFiles = await Promise.all(
    names.map(async (name) => {
      const bytes = await readRegularFile(resolve(directory, name), `${input.prefix}/${name}`)
      return { bytes, name, text: utf8(bytes, `${input.prefix}/${name}`) }
    }),
  )
  const manifestFile = sourceFiles.find(({ name }) => name === 'checksum-manifest.sha256')
  if (!manifestFile || sha256(manifestFile.bytes) !== input.expectedManifestSha256) {
    throw new Error(`${input.prefix} does not match its reviewed canonical manifest SHA-256.`)
  }
  const manifestEntries = parseCanonicalManifest(manifestFile.text)
  const requiredCanonicalNames =
    input.prefix === 'contract-diagnostic'
      ? DIAGNOSTIC_CANONICAL_ARTIFACT_NAMES
      : COMPATIBILITY_CANONICAL_ARTIFACT_NAMES
  if (canonicalJson([...manifestEntries.keys()]) !== canonicalJson(requiredCanonicalNames)) {
    throw new Error(`${input.prefix} manifest does not contain the exact canonical artifact set.`)
  }
  for (const [name, checksum] of manifestEntries) {
    const source = sourceFiles.find((file) => file.name === name)
    if (!source || sha256(source.bytes) !== checksum) {
      throw new Error(`${input.prefix} checksum mismatch for ${name}.`)
    }
  }
  const expectedNames = new Set([
    ...manifestEntries.keys(),
    'checksum-manifest.sha256',
    'execution-receipt.json',
  ])
  if (
    expectedNames.size !== sourceFiles.length ||
    sourceFiles.some(({ name }) => !expectedNames.has(name))
  ) {
    throw new Error(
      `${input.prefix} contains an unmanifested, missing, or unexpected source artifact.`,
    )
  }
  const receiptFile = sourceFiles.find(({ name }) => name === 'execution-receipt.json')
  let receipt: unknown
  try {
    receipt = JSON.parse(receiptFile?.text ?? '') as unknown
  } catch {
    throw new Error(`${input.prefix} execution receipt must be valid JSON.`)
  }
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    (receipt as Record<string, unknown>).canonicalManifestSha256 !== input.expectedManifestSha256 ||
    (receipt as Record<string, unknown>).repositoryCommitSha !==
      input.expectedRepositoryCommitSha ||
    canonicalJson(receipt) !== receiptFile?.text
  ) {
    throw new Error(
      `${input.prefix} execution receipt is not canonical or does not bind the reviewed manifest and repository commit.`,
    )
  }
  const receiptRecord = receipt as Record<string, unknown>
  if (input.prefix === 'contract-diagnostic') {
    exactRecordKeys(
      receiptRecord,
      [
        'canonicalManifestSha256',
        'compensationExecuted',
        'databaseContainer',
        'databaseMutationCount',
        'executedAt',
        'heldOutIdentitiesAccessed',
        'importExecuted',
        'mode',
        'outputDirectory',
        'preMigrationBackupDirectory',
        'preMigrationBackupManifestSha256',
        'remoteDatabaseAccessed',
        'repositoryCommitSha',
        'repositoryRoot',
        'requestedNameDiscrepancies',
        'schemaVersion',
      ],
      'contract-diagnostic execution receipt',
    )
    const diagnosticSource = (name: string): Buffer => {
      const file = sourceFiles.find((candidate) => candidate.name === name)
      if (!file) throw new Error(`contract-diagnostic is missing ${name}.`)
      return file.bytes
    }
    const diagnosticBundle = {
      auditBytes: diagnosticSource('migration-audit.json'),
      developmentPlanningStateBytes: diagnosticSource('development-planning-state.json'),
      manifestBytes: manifestFile.bytes,
      markdownBytes: diagnosticSource('migration-audit.md'),
      reconciledEvidence: {
        contractDiagnosticsBytes: diagnosticSource('contract-diagnostics.json'),
        contractReconciliationBytes: diagnosticSource('contract-reconciliation.json'),
        readOnlyStateBracketBytes: diagnosticSource('read-only-state-bracket.json'),
      },
      schemaSecurityDefinitionIdentityBytes: diagnosticSource(
        'schema-security-definition-identity.json',
      ),
      trustedManifestSha256: input.expectedManifestSha256,
    }
    if (input.verifyDiagnosticBundleForTest) {
      input.verifyDiagnosticBundleForTest(diagnosticBundle)
    } else {
      verifyReadyPostMigrationAuditPackage(diagnosticBundle)
    }
    const diagnosticsRecord = exactRecordKeys(
      canonicalJsonArtifact(
        sourceFiles,
        'contract-diagnostics.json',
        'contract-diagnostic contract diagnostics',
      ),
      [
        'canonicalRpcNames',
        'functions',
        'normalizationRule',
        'readOnlyTransaction',
        'requestedNameDiscrepancies',
        'roles',
        'schemaVersion',
        'target',
        'transactionIsolation',
      ],
      'contract-diagnostic contract diagnostics',
    )
    const diagnosticTarget = exactRecordKeys(
      diagnosticsRecord.target,
      ['container', 'database', 'local', 'port', 'projectId'],
      'contract-diagnostic target',
    )
    const reconciliationRecord = assertReadyContractReconciliation(
      canonicalJsonArtifact(
        sourceFiles,
        'contract-reconciliation.json',
        'contract-diagnostic reconciliation',
      ),
      'contract-diagnostic reconciliation',
      false,
    )
    const planningRecord = exactRecordKeys(
      canonicalJsonArtifact(
        sourceFiles,
        'development-planning-state.json',
        'contract-diagnostic development planning state',
      ),
      ['datasetSplit', 'rows', 'schemaVersion'],
      'contract-diagnostic development planning state',
    )
    const auditRecord = exactRecordKeys(
      canonicalJsonArtifact(sourceFiles, 'migration-audit.json', 'contract-diagnostic audit'),
      [
        'checks',
        'comparisons',
        'database',
        'migration',
        'readinessStatus',
        'result',
        'schemaVersion',
        'status',
      ],
      'contract-diagnostic audit',
    )
    const auditChecks = exactRecordKeys(
      auditRecord.checks,
      [
        'behavioralProbe',
        'compensationExecuted',
        'contractReconciliation',
        'databaseMutationCount',
        'expectedSchemaSecurityIdentitySha256',
        'failures',
        'forwardMigrationRequired',
        'importExecuted',
        'legacyOwnerSpecificFailures',
        'lint',
        'ownerAclTerminalState',
        'schemaSecurityDefinitionIdentity',
        'security',
      ],
      'contract-diagnostic audit checks',
    )
    const embeddedReconciliation = assertReadyContractReconciliation(
      auditChecks.contractReconciliation,
      'contract-diagnostic embedded reconciliation',
      true,
    )
    const auditDatabase = exactRecordKeys(
      auditRecord.database,
      [
        'batchId',
        'contractInvariantIdentitySha256',
        'currentEffectiveStateSha256',
        'currentPhysicalStateSha256',
        'currentPointersAreLatestHeads',
        'deploymentProfileId',
        'developmentMembershipSha256',
        'developmentPlanningStateSha256',
        'environmentProfileIdentitySha256',
        'fullEnvironmentInventoryIdentitySha256',
        'heldOutIdentitiesAccessed',
        'preMigrationBackupManifestSha256',
        'readOnlyAudit',
        'remoteWritesAllowed',
        'repositoryCommitSha',
        'revisionChainsLinear',
        'schemaSecurityIdentitySha256',
        'stateFresh',
        'targetDatabase',
        'testSplitLocked',
      ],
      'contract-diagnostic audit database',
    )
    const auditMigration = exactRecordKeys(
      auditRecord.migration,
      ['applied', 'id', 'ledgerOccurrences', 'sha256'],
      'contract-diagnostic audit migration',
    )
    const bracketRecord = exactRecordKeys(
      canonicalJsonArtifact(
        sourceFiles,
        'read-only-state-bracket.json',
        'contract-diagnostic state bracket',
      ),
      [
        'contractStateHashesAfter',
        'contractStateHashesBefore',
        'contractStateHashesMatch',
        'preMigrationBackupManifestSha256',
        'safety',
        'schemaVersion',
        'snapshotAfterSha256',
        'snapshotBeforeSha256',
        'snapshotsMatch',
      ],
      'contract-diagnostic state bracket',
    )
    const bracketSafety = exactRecordKeys(
      bracketRecord.safety,
      [
        'compensationExecuted',
        'databaseMutationCount',
        'heldOutIdentitiesAccessed',
        'importExecuted',
        'readOnlyDiagnostics',
        'remoteDatabaseAccessed',
      ],
      'contract-diagnostic state bracket safety',
    )
    const contractStateHashesBefore = exactRecordKeys(
      bracketRecord.contractStateHashesBefore,
      [
        'developmentMembershipSha256',
        'effectiveStateSha256',
        'physicalStateSha256',
        'readOnlyTransaction',
      ],
      'contract-diagnostic state hashes before',
    )
    const contractStateHashesAfter = exactRecordKeys(
      bracketRecord.contractStateHashesAfter,
      [
        'developmentMembershipSha256',
        'effectiveStateSha256',
        'physicalStateSha256',
        'readOnlyTransaction',
      ],
      'contract-diagnostic state hashes after',
    )
    const identityRecord = exactRecordKeys(
      canonicalJsonArtifact(
        sourceFiles,
        'schema-security-definition-identity.json',
        'contract-diagnostic schema/security identity',
      ),
      ['records', 'schemaVersion'],
      'contract-diagnostic schema/security identity',
    )
    const standaloneEmbeddedFieldsMatch = Object.entries(reconciliationRecord).every(
      ([field, value]) => canonicalJson(embeddedReconciliation[field]) === canonicalJson(value),
    )
    if (
      diagnosticsRecord.schemaVersion !== 'gold-import-compensation-contract-diagnostics/1.0.0' ||
      canonicalJson(diagnosticsRecord.canonicalRpcNames) !==
        canonicalJson([
          'apply_literature_gold_import_v1',
          'compensate_literature_gold_import_v1',
          'reconcile_literature_gold_review_operation_v1',
        ]) ||
      !Array.isArray(diagnosticsRecord.functions) ||
      diagnosticsRecord.functions.length !== 3 ||
      !Array.isArray(diagnosticsRecord.roles) ||
      diagnosticsRecord.roles.length !== 5 ||
      diagnosticsRecord.normalizationRule !==
        'postgres-function-definition-conservative-whitespace/v1' ||
      diagnosticsRecord.readOnlyTransaction !== true ||
      diagnosticsRecord.transactionIsolation !== 'repeatable read' ||
      canonicalJson(diagnosticsRecord.requestedNameDiscrepancies) !==
        canonicalJson([REQUESTED_RECONCILIATION_NAME_DISCREPANCY]) ||
      diagnosticTarget.container !== LOCAL_DATABASE_CONTAINER ||
      diagnosticTarget.database !== 'postgres' ||
      diagnosticTarget.local !== true ||
      diagnosticTarget.port !== '55322' ||
      diagnosticTarget.projectId !== 'ip-literature-local' ||
      planningRecord.schemaVersion !==
        'gold-import-compensation-development-planning-state/1.0.0' ||
      planningRecord.datasetSplit !== 'development' ||
      !Array.isArray(planningRecord.rows) ||
      planningRecord.rows.length !== 630 ||
      identityRecord.schemaVersion !==
        'gold-import-compensation-schema-security-definition-identity/1.0.0' ||
      !Array.isArray(identityRecord.records) ||
      identityRecord.records.length !== 683 ||
      auditRecord.schemaVersion !== 'gold-import-compensation-reconciled-migration-audit/1.0.0' ||
      auditRecord.status !== 'ready' ||
      auditRecord.readinessStatus !== 'ready' ||
      auditRecord.result !== 'audit_ready_contract_compatibility_audit_required' ||
      auditDatabase.repositoryCommitSha !== input.expectedRepositoryCommitSha ||
      auditDatabase.currentPointersAreLatestHeads !== true ||
      auditDatabase.revisionChainsLinear !== true ||
      auditDatabase.deploymentProfileId !== 'local_supabase_postgres_owner_v1' ||
      auditDatabase.heldOutIdentitiesAccessed !== false ||
      auditDatabase.readOnlyAudit !== true ||
      auditDatabase.remoteWritesAllowed !== false ||
      auditDatabase.stateFresh !== true ||
      auditDatabase.targetDatabase !== 'local' ||
      auditDatabase.testSplitLocked !== true ||
      auditMigration.id !== GOLD_IMPORT_COMPENSATION_MIGRATION_ID ||
      auditMigration.applied !== true ||
      auditMigration.ledgerOccurrences !== 1 ||
      auditChecks.ownerAclTerminalState !== OWNER_ACL_AUDIT_READY_TERMINAL_STATE ||
      auditChecks.forwardMigrationRequired !== false ||
      auditChecks.databaseMutationCount !== 0 ||
      auditChecks.importExecuted !== false ||
      auditChecks.compensationExecuted !== false ||
      !Array.isArray(auditChecks.failures) ||
      auditChecks.failures.length !== 0 ||
      !standaloneEmbeddedFieldsMatch ||
      bracketRecord.schemaVersion !==
        'gold-import-compensation-contract-diagnostic-orchestration/1.0.0' ||
      bracketRecord.preMigrationBackupManifestSha256 !==
        receiptRecord.preMigrationBackupManifestSha256 ||
      bracketRecord.snapshotsMatch !== true ||
      bracketRecord.contractStateHashesMatch !== true ||
      bracketRecord.snapshotBeforeSha256 !== bracketRecord.snapshotAfterSha256 ||
      canonicalJson(bracketRecord.contractStateHashesBefore) !==
        canonicalJson(bracketRecord.contractStateHashesAfter) ||
      contractStateHashesBefore.readOnlyTransaction !== true ||
      contractStateHashesAfter.readOnlyTransaction !== true ||
      contractStateHashesBefore.developmentMembershipSha256 !==
        auditDatabase.developmentMembershipSha256 ||
      contractStateHashesBefore.effectiveStateSha256 !==
        auditDatabase.currentEffectiveStateSha256 ||
      contractStateHashesBefore.physicalStateSha256 !== auditDatabase.currentPhysicalStateSha256 ||
      bracketRecord.preMigrationBackupManifestSha256 !==
        auditDatabase.preMigrationBackupManifestSha256 ||
      bracketSafety.databaseMutationCount !== 0 ||
      bracketSafety.readOnlyDiagnostics !== true ||
      bracketSafety.heldOutIdentitiesAccessed !== false ||
      bracketSafety.importExecuted !== false ||
      bracketSafety.compensationExecuted !== false ||
      bracketSafety.remoteDatabaseAccessed !== false ||
      receiptRecord.schemaVersion !== CONTRACT_DIAGNOSTIC_EXECUTION_SCHEMA_VERSION ||
      receiptRecord.databaseContainer !== LOCAL_DATABASE_CONTAINER ||
      canonicalJson(receiptRecord.requestedNameDiscrepancies) !==
        canonicalJson([REQUESTED_RECONCILIATION_NAME_DISCREPANCY]) ||
      receiptRecord.mode !== 'read_only_diagnostic' ||
      receiptRecord.databaseMutationCount !== 0 ||
      receiptRecord.heldOutIdentitiesAccessed !== false ||
      receiptRecord.importExecuted !== false ||
      receiptRecord.compensationExecuted !== false ||
      receiptRecord.remoteDatabaseAccessed !== false
    ) {
      throw new Error(
        'contract-diagnostic canonical audit/receipt does not bind the exact commit and zero-mutation safety contract.',
      )
    }
  } else {
    exactRecordKeys(
      receiptRecord,
      [
        'canonicalArtifactCount',
        'canonicalManifestSha256',
        'executedAt',
        'kind',
        'mode',
        'outputDirectory',
        'packageReady',
        'repositoryCommitSha',
        'safety',
        'schemaVersion',
        'sources',
        'terminalState',
      ],
      'compatibility-audit execution receipt',
    )
    const upstreamManifest = input.expectedPostMigrationAuditManifestSha256
    if (!upstreamManifest) {
      throw new Error('compatibility-audit requires its source diagnostic manifest binding.')
    }
    assertSha256(upstreamManifest, 'compatibility-audit source diagnostic manifest SHA-256')
    const compatibilityRecord = exactRecordKeys(
      canonicalJsonArtifact(
        sourceFiles,
        'existing-head-compatibility-audit.json',
        'compatibility-audit report',
      ),
      [
        'actionCounts',
        'contractAuditReady',
        'executionCompatibility',
        'existingHeadCount',
        'existingHeads',
        'noteDisposition',
        'ownerAclTerminalState',
        'packageGenerationAllowed',
        'planningDispositions',
        'safety',
        'schemaVersion',
        'sourceBindings',
        'status',
        'terminalState',
        'unresolved',
      ],
      'compatibility-audit report',
    )
    const readinessRecord = exactRecordKeys(
      canonicalJsonArtifact(sourceFiles, 'package-readiness.json', 'compatibility-audit readiness'),
      [
        'actionCounts',
        'blockers',
        'executionCompatibility',
        'fieldLineageSha256',
        'forwardRepairRequirementsSha256',
        'listNormalizationLedgerSha256',
        'noteDisposition',
        'ownerAclTerminalState',
        'packageGenerationAllowed',
        'readiness',
        'safety',
        'schemaVersion',
        'terminalState',
        'unresolved',
      ],
      'compatibility-audit readiness',
    )
    const noteDispositionAudit = canonicalJsonArtifact(
      sourceFiles,
      'note-disposition-audit.json',
      'compatibility-audit note disposition',
    )
    const noteDispositionAuditSha256 = assertNoteDispositionAudit(
      noteDispositionAudit,
      'compatibility-audit note disposition',
    )
    const fieldLineage = canonicalJsonArtifact(
      sourceFiles,
      'field-lineage.json',
      'compatibility-audit field lineage',
    )
    const fieldLineageMarkdown = sourceFiles.find(({ name }) => name === 'field-lineage.md')?.text
    if (!fieldLineageMarkdown) {
      throw new Error('compatibility-audit field-lineage.md is missing.')
    }
    const fieldLineageSha256 = assertFieldLineage(
      fieldLineage,
      fieldLineageMarkdown,
      'compatibility-audit field lineage',
    )
    const forwardRepairRequirements = canonicalJsonArtifact(
      sourceFiles,
      'forward-import-contract-repair-requirements.json',
      'compatibility-audit forward repair requirements',
    )
    const forwardRepairRequirementsSha256 = assertForwardRepairRequirements(
      forwardRepairRequirements,
      noteDispositionAuditSha256,
      'compatibility-audit forward repair requirements',
    )
    const booleanReport = canonicalJsonArtifact(
      sourceFiles,
      'boolean-normalization-report.json',
      'compatibility-audit boolean normalization report',
    )
    const listReport = canonicalJsonArtifact(
      sourceFiles,
      'list-normalization-report.json',
      'compatibility-audit list normalization report',
    )
    assertNormalizationReports(booleanReport, listReport, expectedListNormalizationLedgerSha256)
    assertTerminalCompatibilityDetails(compatibilityRecord, 'compatibility-audit report')
    assertTerminalCompatibilityDetails(readinessRecord, 'compatibility-audit readiness')
    for (const field of ['actionCounts', 'executionCompatibility', 'unresolved']) {
      if (canonicalJson(compatibilityRecord[field]) !== canonicalJson(readinessRecord[field])) {
        throw new Error(`compatibility-audit report/readiness ${field} values disagree.`)
      }
    }
    if (canonicalJson(readinessRecord.blockers) !== canonicalJson(REQUIRED_TERMINAL_BLOCKERS)) {
      throw new Error(
        'compatibility-audit readiness does not contain the exact three terminal-4 blockers.',
      )
    }
    const sourceBindings = assertCompatibilitySourceBindings(
      compatibilityRecord.sourceBindings,
      {
        expectedFieldLineageSha256: fieldLineageSha256,
        expectedForwardRepairRequirementsSha256: forwardRepairRequirementsSha256,
        expectedListNormalizationLedgerSha256,
        expectedNoteDispositionAuditSha256: noteDispositionAuditSha256,
        expectedPostMigrationAuditManifestSha256: upstreamManifest,
      },
      'compatibility-audit source bindings',
    )
    const reportNoteDisposition = exactRecordKeys(
      compatibilityRecord.noteDisposition,
      ['auditSha256', 'disposition', 'status'],
      'compatibility-audit report note disposition',
    )
    const readinessNoteDisposition = exactRecordKeys(
      readinessRecord.noteDisposition,
      ['auditSha256', 'status'],
      'compatibility-audit readiness note disposition',
    )
    assertExistingHeadRows(compatibilityRecord.existingHeads, 'compatibility-audit existing heads')
    assertPlanningDispositions(
      compatibilityRecord.planningDispositions,
      'compatibility-audit planning dispositions',
    )
    assertCompatibilitySafety(compatibilityRecord.safety, 'compatibility-audit report safety', true)
    assertCompatibilitySafety(readinessRecord.safety, 'compatibility-audit readiness safety', false)
    const receiptSources = exactRecordKeys(
      receiptRecord.sources,
      [
        'amendedAuthorizationPath',
        'artifactPath',
        'auditPath',
        'authorizationManifestPath',
        'authorizationMappingPath',
        'authorizationMappingCorrectionManifestPath',
        'authorizationMappingCorrectionPath',
        'finalV3ArtifactSha256',
        'postMigrationAuditManifestSha256',
      ],
      'compatibility-audit receipt sources',
    )
    assertCompatibilitySafety(receiptRecord.safety, 'compatibility-audit receipt safety', true)
    if (
      compatibilityRecord.schemaVersion !== EXISTING_HEAD_COMPATIBILITY_AUDIT_SCHEMA_VERSION ||
      compatibilityRecord.contractAuditReady !== true ||
      compatibilityRecord.status !== 'forward_import_contract_repair_required' ||
      compatibilityRecord.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE ||
      compatibilityRecord.ownerAclTerminalState !== OWNER_ACL_AUDIT_READY_TERMINAL_STATE ||
      compatibilityRecord.packageGenerationAllowed !== false ||
      compatibilityRecord.existingHeadCount !== 9 ||
      readinessRecord.schemaVersion !== COMPATIBILITY_PACKAGE_READINESS_SCHEMA_VERSION ||
      readinessRecord.readiness !== 'forward_import_contract_repair_required' ||
      readinessRecord.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE ||
      readinessRecord.ownerAclTerminalState !== OWNER_ACL_AUDIT_READY_TERMINAL_STATE ||
      readinessRecord.packageGenerationAllowed !== false ||
      readinessRecord.fieldLineageSha256 !== fieldLineageSha256 ||
      readinessRecord.forwardRepairRequirementsSha256 !== forwardRepairRequirementsSha256 ||
      readinessRecord.listNormalizationLedgerSha256 !== expectedListNormalizationLedgerSha256 ||
      reportNoteDisposition.status !== GOLD_IMPORT_NOTE_DISPOSITION_STATUS ||
      reportNoteDisposition.disposition !== GOLD_IMPORT_NOTE_DISPOSITION ||
      reportNoteDisposition.auditSha256 !== noteDispositionAuditSha256 ||
      readinessNoteDisposition.status !== GOLD_IMPORT_NOTE_DISPOSITION_STATUS ||
      readinessNoteDisposition.auditSha256 !== noteDispositionAuditSha256 ||
      sourceBindings.noteDispositionAuditSha256 !== noteDispositionAuditSha256 ||
      receiptRecord.schemaVersion !== COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION ||
      receiptRecord.kind !== 'existing_head_compatibility_file_only_audit' ||
      receiptRecord.mode !== 'file_only_read_only' ||
      receiptRecord.canonicalArtifactCount !== manifestEntries.size ||
      receiptRecord.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE ||
      receiptRecord.packageReady !== false ||
      receiptSources.postMigrationAuditManifestSha256 !== upstreamManifest ||
      receiptSources.finalV3ArtifactSha256 !== FINAL_V3_ARTIFACT_SHA256 ||
      [
        'amendedAuthorizationPath',
        'artifactPath',
        'auditPath',
        'authorizationManifestPath',
        'authorizationMappingPath',
        'authorizationMappingCorrectionManifestPath',
        'authorizationMappingCorrectionPath',
      ].some(
        (field) => typeof receiptSources[field] !== 'string' || receiptSources[field].length === 0,
      )
    ) {
      throw new Error(
        'compatibility-audit does not bind the exact diagnostic/source evidence graph, terminal state, or zero-mutation safety contract.',
      )
    }
  }
  return sourceFiles.map(({ bytes, name, text }) => ({
    originalName: name,
    sha256: sha256(bytes),
    storedName: `${input.prefix}--${name}`,
    text,
  }))
}

export async function canonicalReport(
  path: string,
  label: string,
): Promise<{
  parsed: unknown
  sha256: string
  text: string
}> {
  const bytes = await readRegularFile(path, label)
  let parsed: unknown
  try {
    parsed = JSON.parse(utf8(bytes, label)) as unknown
  } catch (error) {
    throw new Error(
      `${label} must be JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const canonical = canonicalJson(parsed)
  if (canonical !== bytes.toString('utf8')) {
    throw new Error(`${label} must already use the canonical JSON byte representation.`)
  }
  return { parsed, sha256: sha256(bytes), text: canonical }
}

export async function strictDiffStatReconciliationReport(
  path: string,
  expected: { branch: string; head: string; originMain: string },
): Promise<{ sha256: string; text: string }> {
  const report = await canonicalReport(path, 'diff-stat reconciliation report')
  const record = exactRecordKeys(
    report.parsed,
    [
      'authoritativeFinal',
      'commands',
      'explanation',
      'generatedAt',
      'gitDiffNumstat',
      'gitDiffStat',
      'priorApproximateReport',
      'pullRequest',
      'repository',
      'schemaVersion',
      'startingHeadObservation',
    ],
    'diff-stat reconciliation report',
  )
  const repository = exactRecordKeys(
    record.repository,
    [
      'branch',
      'head',
      'originMain',
      'originMainIsAncestor',
      'trackedUntrackedAndTemporaryStatusClean',
    ],
    'diff-stat reconciliation repository',
  )
  const pullRequest = exactRecordKeys(
    record.pullRequest,
    [
      'baseRefName',
      'headRefName',
      'headRefOid',
      'isDraft',
      'mergeable',
      'mergedAt',
      'number',
      'state',
    ],
    'diff-stat reconciliation pull request',
  )
  const commands = exactRecordKeys(
    record.commands,
    ['gitDiffNumstat', 'gitDiffStat', 'githubPullRequest'],
    'diff-stat reconciliation commands',
  )
  const starting = exactRecordKeys(
    record.startingHeadObservation,
    ['additions', 'basis', 'changedFiles', 'deletions', 'head'],
    'diff-stat reconciliation starting observation',
  )
  const prior = exactRecordKeys(
    record.priorApproximateReport,
    [
      'additions',
      'changedFiles',
      'deletions',
      'exactSourceLocated',
      'explainsAuthoritativeDifference',
    ],
    'diff-stat reconciliation prior report',
  )
  const explanation = exactRecordKeys(
    record.explanation,
    ['generatedUntrackedOrTemporaryFilesExplainDifference', 'reason'],
    'diff-stat reconciliation explanation',
  )
  const authoritative = exactRecordKeys(
    record.authoritativeFinal,
    ['additions', 'basis', 'changedFiles', 'deletions'],
    'diff-stat reconciliation authoritative result',
  )
  if (
    record.schemaVersion !== GOLD_IMPORT_DIFF_STAT_RECONCILIATION_SCHEMA_VERSION ||
    typeof record.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.generatedAt)) ||
    repository.branch !== expected.branch ||
    repository.head !== expected.head ||
    repository.originMain !== expected.originMain ||
    repository.originMainIsAncestor !== true ||
    repository.trackedUntrackedAndTemporaryStatusClean !== true ||
    pullRequest.number !== 89 ||
    pullRequest.state !== 'OPEN' ||
    pullRequest.isDraft !== true ||
    pullRequest.mergedAt !== null ||
    pullRequest.mergeable !== 'MERGEABLE' ||
    pullRequest.baseRefName !== 'main' ||
    pullRequest.headRefName !== expected.branch ||
    pullRequest.headRefOid !== expected.head ||
    commands.gitDiffStat !== 'git diff --stat origin/main...HEAD' ||
    commands.gitDiffNumstat !== 'git diff --numstat origin/main...HEAD' ||
    commands.githubPullRequest !==
      'gh pr view 89 --json number,state,isDraft,mergedAt,mergeable,baseRefName,headRefName,headRefOid,changedFiles,additions,deletions' ||
    starting.head !== 'aab05aa2c3ef9aab88730e78b42e0b8725a80af6' ||
    starting.changedFiles !== 30 ||
    starting.additions !== 14_413 ||
    starting.deletions !== 277 ||
    typeof starting.basis !== 'string' ||
    starting.basis.length === 0 ||
    prior.changedFiles !== 29 ||
    prior.additions !== 3_707 ||
    prior.deletions !== 229 ||
    prior.exactSourceLocated !== false ||
    prior.explainsAuthoritativeDifference !== false ||
    explanation.generatedUntrackedOrTemporaryFilesExplainDifference !== false ||
    typeof explanation.reason !== 'string' ||
    explanation.reason.length === 0 ||
    authoritative.basis !== 'git_three_dot_and_github_pr_agree' ||
    !Number.isSafeInteger(authoritative.changedFiles) ||
    !Number.isSafeInteger(authoritative.additions) ||
    !Number.isSafeInteger(authoritative.deletions) ||
    (authoritative.changedFiles as number) < 1 ||
    (authoritative.additions as number) < 0 ||
    (authoritative.deletions as number) < 0 ||
    typeof record.gitDiffStat !== 'string' ||
    !Array.isArray(record.gitDiffNumstat)
  ) {
    throw new Error(
      'Diff-stat reconciliation does not bind the exact clean HEAD, draft PR #89, and authoritative basis.',
    )
  }
  const paths = new Set<string>()
  let additions = 0
  let deletions = 0
  record.gitDiffNumstat.forEach((rawRow, index) => {
    const row = exactRecordKeys(
      rawRow,
      ['additions', 'deletions', 'path'],
      `diff-stat reconciliation numstat row ${index + 1}`,
    )
    if (
      !Number.isSafeInteger(row.additions) ||
      !Number.isSafeInteger(row.deletions) ||
      (row.additions as number) < 0 ||
      (row.deletions as number) < 0 ||
      typeof row.path !== 'string' ||
      row.path.length === 0 ||
      row.path.startsWith('/') ||
      row.path.split('/').some((component) => component === '..') ||
      paths.has(row.path)
    ) {
      throw new Error('Diff-stat reconciliation contains malformed or duplicate numstat rows.')
    }
    additions += row.additions as number
    deletions += row.deletions as number
    paths.add(row.path)
  })
  const statSummary = new RegExp(
    `(?:^|\\n)\\s*${String(authoritative.changedFiles)} files? changed, ${String(authoritative.additions)} insertions?\\(\\+\\), ${String(authoritative.deletions)} deletions?\\(-\\)\\n$`,
    'u',
  )
  if (
    paths.size !== authoritative.changedFiles ||
    additions !== authoritative.additions ||
    deletions !== authoritative.deletions ||
    !statSummary.test(record.gitDiffStat)
  ) {
    throw new Error('Diff-stat reconciliation authoritative and per-file arithmetic disagree.')
  }
  return { sha256: report.sha256, text: report.text }
}

interface FinalReportBindings {
  compatibilityAuditManifestSha256: string
  contractDiagnosticManifestSha256: string
  repositoryCommitSha: string
}

function assertZeroMutationSafety(value: unknown, label: string): void {
  const safety = exactRecordKeys(
    value,
    [
      'compensationExecuted',
      'databaseMutationCount',
      'heldOutIdentitiesAccessed',
      'importExecuted',
      'remoteDatabaseAccessed',
    ],
    label,
  )
  if (
    safety.compensationExecuted !== false ||
    safety.databaseMutationCount !== 0 ||
    safety.heldOutIdentitiesAccessed !== false ||
    safety.importExecuted !== false ||
    safety.remoteDatabaseAccessed !== false
  ) {
    throw new Error(`${label} does not attest the exact zero-mutation safety state.`)
  }
}

function assertFinalReportBindings(
  value: unknown,
  expected: FinalReportBindings,
  label: string,
): void {
  const bindings = exactRecordKeys(
    value,
    ['compatibilityAuditManifestSha256', 'contractDiagnosticManifestSha256', 'repositoryCommitSha'],
    `${label} bindings`,
  )
  if (
    bindings.repositoryCommitSha !== expected.repositoryCommitSha ||
    bindings.contractDiagnosticManifestSha256 !== expected.contractDiagnosticManifestSha256 ||
    bindings.compatibilityAuditManifestSha256 !== expected.compatibilityAuditManifestSha256
  ) {
    throw new Error(`${label} does not bind the exact HEAD and reviewed audit manifests.`)
  }
}

export async function strictTestBuildReport(
  path: string,
  expected: FinalReportBindings,
): Promise<{ sha256: string; text: string }> {
  const report = await canonicalReport(path, 'test/build report')
  const record = exactRecordKeys(
    report.parsed,
    ['bindings', 'checks', 'safety', 'schemaVersion', 'status', 'terminalState'],
    'test/build report',
  )
  if (
    record.schemaVersion !== POST_MIGRATION_RECONCILIATION_TEST_BUILD_REPORT_SCHEMA_VERSION ||
    record.status !== 'passed' ||
    record.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE
  ) {
    throw new Error('Test/build report does not attest a passing terminal-4 validation run.')
  }
  assertFinalReportBindings(record.bindings, expected, 'Test/build report')
  if (!Array.isArray(record.checks) || record.checks.length !== REQUIRED_TEST_BUILD_CHECKS.length) {
    throw new Error('Test/build report must contain the exact ordered validation check set.')
  }
  record.checks.forEach((rawCheck, index) => {
    const check = exactRecordKeys(
      rawCheck,
      ['command', 'exitCode', 'id', 'result'],
      `test/build report check ${index + 1}`,
    )
    if (
      check.id !== REQUIRED_TEST_BUILD_CHECKS[index] ||
      typeof check.command !== 'string' ||
      check.command.trim() !== check.command ||
      check.command.length === 0 ||
      check.command.includes('\n') ||
      check.exitCode !== 0 ||
      check.result !== 'passed'
    ) {
      throw new Error(
        `Test/build report check ${index + 1} must preserve its exact command and passing result.`,
      )
    }
  })
  assertZeroMutationSafety(record.safety, 'test/build report safety')
  return { sha256: report.sha256, text: report.text }
}

export async function strictMergeReadinessReport(
  path: string,
  expected: FinalReportBindings,
): Promise<{ sha256: string; text: string }> {
  const report = await canonicalReport(path, 'merge-readiness report')
  const record = exactRecordKeys(
    report.parsed,
    [
      'bindings',
      'blockers',
      'codeReview',
      'importExecution',
      'safety',
      'schemaVersion',
      'terminalState',
    ],
    'merge-readiness report',
  )
  const codeReview = exactRecordKeys(
    record.codeReview,
    [
      'mergeAuthorized',
      'originMainIsAncestor',
      'pullRequestDraft',
      'readiness',
      'trackedWorktreeClean',
    ],
    'merge-readiness report codeReview',
  )
  const importExecution = exactRecordKeys(
    record.importExecution,
    [
      'compensationExecuted',
      'importExecuted',
      'packageGenerated',
      'packageGenerationAllowed',
      'readiness',
    ],
    'merge-readiness report importExecution',
  )
  if (
    record.schemaVersion !== POST_MIGRATION_RECONCILIATION_MERGE_READINESS_REPORT_SCHEMA_VERSION ||
    record.terminalState !== POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE ||
    codeReview.readiness !== 'ready_for_draft_review' ||
    codeReview.pullRequestDraft !== true ||
    codeReview.trackedWorktreeClean !== true ||
    codeReview.originMainIsAncestor !== true ||
    codeReview.mergeAuthorized !== false ||
    importExecution.readiness !== 'blocked_forward_import_contract_repair_required' ||
    importExecution.packageGenerationAllowed !== false ||
    importExecution.packageGenerated !== false ||
    importExecution.importExecuted !== false ||
    importExecution.compensationExecuted !== false
  ) {
    throw new Error(
      'Merge-readiness report must separate ready draft code review from blocked import execution.',
    )
  }
  if (canonicalJson(record.blockers) !== canonicalJson(REQUIRED_TERMINAL_BLOCKERS)) {
    throw new Error('Merge-readiness report does not contain the exact terminal-4 blockers.')
  }
  assertFinalReportBindings(record.bindings, expected, 'Merge-readiness report')
  assertZeroMutationSafety(record.safety, 'merge-readiness report safety')
  return { sha256: report.sha256, text: report.text }
}

export async function preserveChangedTrackedFiles(input: {
  cwd: string
  head: string
  originMain: string
  runCommand: CommandRunner
}): Promise<PreservedFile[]> {
  const changed = await input.runCommand(
    'git',
    ['diff', '--name-only', '--diff-filter=AM', `${input.originMain}...${input.head}`, '--'],
    { cwd: input.cwd },
  )
  const removed = await input.runCommand(
    'git',
    ['diff', '--name-only', '--diff-filter=DR', `${input.originMain}...${input.head}`, '--'],
    { cwd: input.cwd },
  )
  if (removed.stdout.trim()) {
    throw new Error('Backup requires explicit handling for deleted or renamed tracked files.')
  }
  const paths = changed.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'))
  if (paths.length === 0 || new Set(paths).size !== paths.length) {
    throw new Error('No unique changed tracked files were found for the reconciliation commit.')
  }
  const preserved = await Promise.all(
    paths.map(async (path) => {
      if (path.startsWith('/') || path.split('/').some((component) => component === '..')) {
        throw new Error(`Changed tracked path is unsafe: ${path}.`)
      }
      const bytes = await readRegularFile(resolve(input.cwd, path), `changed tracked file ${path}`)
      const modeResult = await input.runCommand('git', ['ls-tree', input.head, '--', path], {
        cwd: input.cwd,
      })
      const gitObject = /^(100644|100755) blob ([a-f0-9]{40})\t/u.exec(modeResult.stdout)
      const mode = gitObject?.[1]
      const blobOid = gitObject?.[2]
      if (!mode || !blobOid) {
        throw new Error(`Changed tracked file has an unsupported Git object: ${path}.`)
      }
      const workingTreeBlobOid = createHash('sha1')
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest('hex')
      if (workingTreeBlobOid !== blobOid) {
        throw new Error(`Changed tracked file does not match exact commit ${input.head}: ${path}.`)
      }
      const storedName = `tracked--${sha256(path).slice(0, 16)}--${basename(path)}`
      if (!SAFE_COMPONENT_PATTERN.test(storedName)) {
        throw new Error(`Changed tracked backup name is unsafe: ${storedName}.`)
      }
      return {
        gitMode: mode,
        originalName: path,
        sha256: sha256(bytes),
        storedName,
        text: utf8(bytes, `changed tracked file ${path}`),
      }
    }),
  )
  if (new Set(preserved.map(({ storedName }) => storedName)).size !== preserved.length) {
    throw new Error('Changed tracked backup filenames collided.')
  }
  return preserved
}

/** Capture the exact reviewed three-dot change as a deterministic, apply-ready Git patch. */
export async function buildSemanticDiffPatch(input: {
  cwd: string
  head: string
  originMain: string
  runCommand: CommandRunner
}): Promise<{ sha256: string; text: string }> {
  const result = await input.runCommand(
    'git',
    [
      'diff',
      '--no-ext-diff',
      '--no-color',
      '--full-index',
      '--binary',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      `${input.originMain}...${input.head}`,
      '--',
    ],
    { cwd: input.cwd },
  )
  const text = utf8(Buffer.from(result.stdout, 'utf8'), 'semantic diff patch')
  if (!text.startsWith('diff --git a/')) {
    throw new Error('Semantic diff patch does not contain the exact reviewed Git diff.')
  }
  return { sha256: sha256(text), text }
}

export async function runCreatePostMigrationContractReconciliationBackup(
  argv: readonly string[],
  dependencies: PostMigrationReconciliationBackupDependencies = {},
) {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, [
    'backup-root',
    'commit',
    'compatibility-audit',
    'compatibility-audit-manifest-sha256',
    'contract-diagnostic',
    'contract-diagnostic-manifest-sha256',
    'diff-stat-reconciliation',
    'help',
    'merge-readiness-report',
    'output',
    'test-build-report',
  ])
  if (hasFlag(arguments_, 'help')) return { help: HELP }
  if (hasFlag(arguments_, 'commit') || arguments_.values.has('commit')) {
    throw new Error('The additive backup command has no commit or database-write mode.')
  }

  const cwd = resolve(dependencies.cwd ?? process.cwd())
  if (
    (dependencies.expectedListNormalizationLedgerSha256ForTest ||
      dependencies.verifyDiagnosticBundleForTest) &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error('Backup evidence verifier overrides are restricted to tests.')
  }
  const runCommand = dependencies.runCommand ?? defaultCommandRunner
  const repository = await inspectReadOnlyReconciliationRepositoryState(cwd, runCommand)
  assertReadOnlyReconciliationRepositoryGuard(repository)
  if (repository.branch !== POST_MIGRATION_RECONCILIATION_BRANCH) {
    throw new Error('Backup branch does not match the reconciliation branch.')
  }
  const contractDiagnosticManifestSha256 = requiredArgument(
    arguments_,
    'contract-diagnostic-manifest-sha256',
  )
  const compatibilityAuditManifestSha256 = requiredArgument(
    arguments_,
    'compatibility-audit-manifest-sha256',
  )
  assertSha256(contractDiagnosticManifestSha256, 'contract-diagnostic manifest SHA-256')
  assertSha256(compatibilityAuditManifestSha256, 'compatibility-audit manifest SHA-256')
  const finalReportBindings: FinalReportBindings = {
    compatibilityAuditManifestSha256,
    contractDiagnosticManifestSha256,
    repositoryCommitSha: repository.head,
  }
  const rawBackupRoot = requiredArgument(arguments_, 'backup-root')
  const rawOutput = requiredArgument(arguments_, 'output')
  const outputDirectory = await assertExclusiveOutputPath({
    backupRoot: rawBackupRoot,
    cwd,
    output: rawOutput,
  })
  if (basename(outputDirectory) !== `${BACKUP_DIRECTORY_PREFIX}${repository.head}`) {
    throw new Error('Backup output directory must end with the exact current 40-character HEAD.')
  }

  const [
    diagnosticFiles,
    compatibilityFiles,
    trackedFiles,
    semanticDiff,
    validation,
    mergeReadiness,
    diffStatReconciliation,
  ] = await Promise.all([
    preserveAuditDirectory({
      directory: requiredArgument(arguments_, 'contract-diagnostic'),
      expectedManifestSha256: contractDiagnosticManifestSha256,
      expectedRepositoryCommitSha: repository.head,
      prefix: 'contract-diagnostic',
      verifyDiagnosticBundleForTest: dependencies.verifyDiagnosticBundleForTest,
    }),
    preserveAuditDirectory({
      directory: requiredArgument(arguments_, 'compatibility-audit'),
      expectedListNormalizationLedgerSha256ForTest:
        dependencies.expectedListNormalizationLedgerSha256ForTest,
      expectedManifestSha256: compatibilityAuditManifestSha256,
      expectedPostMigrationAuditManifestSha256: contractDiagnosticManifestSha256,
      expectedRepositoryCommitSha: repository.head,
      prefix: 'compatibility-audit',
    }),
    preserveChangedTrackedFiles({
      cwd,
      head: repository.head,
      originMain: repository.originMain,
      runCommand,
    }),
    buildSemanticDiffPatch({
      cwd,
      head: repository.head,
      originMain: repository.originMain,
      runCommand,
    }),
    strictTestBuildReport(requiredArgument(arguments_, 'test-build-report'), finalReportBindings),
    strictMergeReadinessReport(
      requiredArgument(arguments_, 'merge-readiness-report'),
      finalReportBindings,
    ),
    strictDiffStatReconciliationReport(requiredArgument(arguments_, 'diff-stat-reconciliation'), {
      branch: repository.branch,
      head: repository.head,
      originMain: repository.originMain,
    }),
  ])
  const repositoryAfterRead = await inspectReadOnlyReconciliationRepositoryState(cwd, runCommand)
  assertReadOnlyReconciliationRepositoryGuard(repositoryAfterRead)
  if (
    repositoryAfterRead.head !== repository.head ||
    repositoryAfterRead.originMain !== repository.originMain
  ) {
    throw new Error('Repository identity changed while the additive backup inputs were read.')
  }
  const allPreserved = [...trackedFiles, ...diagnosticFiles, ...compatibilityFiles]
  if (new Set(allPreserved.map(({ storedName }) => storedName)).size !== allPreserved.length) {
    throw new Error('Backup artifact names collided.')
  }
  const index = {
    schemaVersion: POST_MIGRATION_RECONCILIATION_BACKUP_SCHEMA_VERSION,
    repository: {
      branch: repository.branch,
      commitSha: repository.head,
      originMainSha: repository.originMain,
    },
    sources: {
      changedTrackedFiles: trackedFiles.map(({ gitMode, originalName, sha256, storedName }) => ({
        gitMode,
        originalName,
        sha256,
        storedName,
      })),
      compatibilityAudit: compatibilityFiles.map(({ originalName, sha256, storedName }) => ({
        originalName,
        sha256,
        storedName,
      })),
      contractDiagnostic: diagnosticFiles.map(({ originalName, sha256, storedName }) => ({
        originalName,
        sha256,
        storedName,
      })),
      mergeReadinessSourceSha256: mergeReadiness.sha256,
      testBuildSourceSha256: validation.sha256,
      diffStatReconciliationSourceSha256: diffStatReconciliation.sha256,
      semanticDiff: {
        baseSha: repository.originMain,
        headSha: repository.head,
        sha256: semanticDiff.sha256,
      },
      contractDiagnosticManifestSha256,
      compatibilityAuditManifestSha256,
    },
    terminalState: POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE,
    safety: {
      additiveBackup: true,
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  }
  const files = new Map<string, string>(
    allPreserved.map(({ storedName, text }) => [storedName, text]),
  )
  files.set('backup-index.json', canonicalJson(index))
  files.set('diff-stat-reconciliation.json', diffStatReconciliation.text)
  files.set('merge-readiness-report.json', mergeReadiness.text)
  files.set('semantic-diff.patch', semanticDiff.text)
  files.set('test-build-report.json', validation.text)
  const artifacts = sealCanonicalArtifacts(files)
  await writeCanonicalPackage({
    artifacts,
    outputDirectory,
    outputRoot: resolve(cwd, rawBackupRoot),
    executionReceipt: {
      schemaVersion: POST_MIGRATION_RECONCILIATION_BACKUP_EXECUTION_SCHEMA_VERSION,
      executedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      repositoryRoot: cwd,
      repositoryCommitSha: repository.head,
      outputDirectory,
      canonicalManifestSha256: artifacts.manifestSha256,
      preservedFileCount: files.size,
      mode: 'file_only_additive_backup',
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  })
  return {
    outputDirectory,
    manifestSha256: artifacts.manifestSha256,
    repositoryCommitSha: repository.head,
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runCreatePostMigrationContractReconciliationBackup(process.argv.slice(2))
    .then((result) => {
      if ('help' in result) {
        console.log(result.help)
        return
      }
      console.log(`${JSON.stringify(result, null, 2)}\n`)
      console.log('Database access: 0; mutations: 0; held-out identities: 0; remote access: 0')
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
