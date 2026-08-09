import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  FINAL_V3_ARTIFACT_SHA256,
  verifyReadyPostMigrationAuditPackage,
  type VerifiedPostMigrationAuditPackage,
} from './generate-gold-import-compensation-package-v1'
import {
  GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION,
  GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
  GOLD_IMPORT_LIST_NORMALIZATION_RULE_VERSION,
  resolveGoldImportCompensationCompatibility,
  type GoldImportCompensationCompatibilityResolution,
} from './gold-import-compensation-compatibility'
import {
  assertExclusiveOutputDirectoryIdentity,
  assertSafeOutputPathArgument,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  assertReadOnlyReconciliationRepositoryGuard,
  inspectReadOnlyReconciliationRepositoryState,
} from './gold-import-compensation-read-only-guard'
import { type CommandRunner } from './gold-import-compensation-migration-operations'

export const EXISTING_HEAD_COMPATIBILITY_AUDIT_SCHEMA_VERSION =
  'gold-import-existing-head-compatibility-audit/1.0.0' as const
export const BOOLEAN_NORMALIZATION_REPORT_SCHEMA_VERSION =
  'gold-import-boolean-normalization-report/1.0.0' as const
export const LIST_NORMALIZATION_REPORT_SCHEMA_VERSION =
  'gold-import-list-normalization-report/1.0.0' as const
export const COMPATIBILITY_PACKAGE_READINESS_SCHEMA_VERSION =
  'gold-import-compatibility-package-readiness/1.0.0' as const
export const COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION =
  'gold-import-existing-head-compatibility-audit-execution/1.0.0' as const
export const COMPATIBILITY_AUDIT_READY_SUPPLEMENT_REQUIRED =
  'AUDIT READY — PHYSICIAN COMPATIBILITY SUPPLEMENT REQUIRED' as const
export const COMPATIBILITY_AUDIT_READY_SUPPLEMENT_NOT_REQUIRED =
  'AUDIT READY — COMPATIBILITY SUPPLEMENT NOT REQUIRED' as const
export const COMPATIBILITY_AUDIT_STILL_BLOCKED =
  'CONTRACT STILL BLOCKED — UNRESOLVED DIFFERENCE' as const

export const EXPECTED_UNRESOLVED_COMPATIBILITY_PMIDS = Object.freeze([] as string[])

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const RECONCILED_AUDIT_SCHEMA_VERSION =
  'gold-import-compensation-reconciled-migration-audit/1.0.0' as const

export interface GeneratedExistingHeadCompatibilityAudit {
  canonicalFiles: ReadonlyMap<string, Buffer>
  canonicalManifest: Buffer
  canonicalManifestSha256: string
  packageReady: boolean
  resolution: GoldImportCompensationCompatibilityResolution
  sourceAuditManifestSha256: string
  sourceSupplementSha256: string | null
  terminalState:
    | typeof COMPATIBILITY_AUDIT_READY_SUPPLEMENT_REQUIRED
    | typeof COMPATIBILITY_AUDIT_READY_SUPPLEMENT_NOT_REQUIRED
    | typeof COMPATIBILITY_AUDIT_STILL_BLOCKED
  unresolvedPmids: readonly string[]
}

export interface ExistingHeadCompatibilityAuditDependencies {
  assertRepositoryState?: typeof assertReadOnlyReconciliationRepositoryGuard
  cwd?: string
  expectedArtifactSha256ForTest?: string
  inspectRepositoryState?: typeof inspectReadOnlyReconciliationRepositoryState
  now?: () => Date
  runCommand?: CommandRunner
  verifyReadyAuditPackage?: typeof verifyReadyPostMigrationAuditPackage
}

const HELP = `
Audit the exact nine existing development heads against the unchanged finalized V3 artifact.

This command is file-only. It verifies the complete reconciled post-migration audit bundle before
opening the finalized artifact, never contacts a database, and never executes import or compensation.
Formal finalized V3 excluded-status nulls are not physician decisions, so this audit does not accept
or emit a compatibility supplement.

Usage:
  tsx scripts/literature/audit-gold-existing-head-compatibility.ts \\
    --audit <reconciled-audit-directory/migration-audit.json> \\
    --audit-manifest-sha256 <reviewed-canonical-manifest-sha256> \\
    --development-state <reconciled-audit-directory/development-planning-state.json> \\
    --artifact <gold-set-v1-enrichment-v3-final-development-630.csv> \\
    --output-root <approved-local-output-root> --output <new-audit-directory>
`.trim()

function sha256Bytes(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalPretty(value: unknown): Buffer {
  const normalized = JSON.parse(canonicalJson(value)) as unknown
  return Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
}

function canonicalFileMap(records: Readonly<Record<string, unknown>>): Map<string, Buffer> {
  return new Map(
    Object.entries(records)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, value]) => [name, canonicalPretty(value)]),
  )
}

function sealCanonicalFiles(filesInput: ReadonlyMap<string, Buffer>) {
  const files = new Map(
    [...filesInput.entries()].sort(([left], [right]) => left.localeCompare(right, 'en')),
  )
  const manifest = Buffer.from(
    `${[...files.entries()].map(([name, bytes]) => `${sha256Bytes(bytes)}  ${name}`).join('\n')}\n`,
    'utf8',
  )
  return { files, manifest, manifestSha256: sha256Bytes(manifest) }
}

function assertReconciledAudit(
  auditPackage: VerifiedPostMigrationAuditPackage,
): asserts auditPackage is VerifiedPostMigrationAuditPackage & {
  audit: VerifiedPostMigrationAuditPackage['audit'] & {
    database: VerifiedPostMigrationAuditPackage['audit']['database'] & {
      contractInvariantIdentitySha256: string
      environmentProfileIdentitySha256: string
    }
    result: 'audit_ready_contract_compatibility_audit_required'
    schemaVersion: typeof RECONCILED_AUDIT_SCHEMA_VERSION
  }
} {
  if (
    auditPackage.audit.schemaVersion !== RECONCILED_AUDIT_SCHEMA_VERSION ||
    !('result' in auditPackage.audit) ||
    auditPackage.audit.result !== 'audit_ready_contract_compatibility_audit_required' ||
    !('contractInvariantIdentitySha256' in auditPackage.audit.database) ||
    !('environmentProfileIdentitySha256' in auditPackage.audit.database)
  ) {
    throw new Error(
      'Existing-head compatibility audit requires the ready reconciled post-migration audit bundle.',
    )
  }
}

function unresolvedCompatibilityPmids(
  resolution: GoldImportCompensationCompatibilityResolution,
): string[] {
  return resolution.existingHeads
    .filter((row) => row.resolutionStatus === 'pending_physician_decision')
    .map((row) => row.identity.pmid)
}

function assertNoPhysicianCompatibilitySupplement(
  resolution: GoldImportCompensationCompatibilityResolution,
  supplementSupplied: boolean,
  unresolvedPmids: readonly string[],
): void {
  if (supplementSupplied) {
    throw new Error(
      'A physician compatibility supplement is not applicable to the authoritative finalized V3 excluded-row shape.',
    )
  }
  if (
    resolution.supplementRequired ||
    resolution.supplementTemplate !== null ||
    resolution.acceptedSupplementSha256 !== null ||
    unresolvedPmids.length !== 0
  ) {
    throw new Error(
      'Authoritative finalized V3 excluded-status nulls must not become physician supplement decisions.',
    )
  }
}

function compatibilityReadinessReport(input: {
  listNormalizationLedgerSha256: string
  resolution: GoldImportCompensationCompatibilityResolution
  supplementSupplied: boolean
  unresolvedPmids: readonly string[]
}) {
  const blockers = Object.entries(input.resolution.executionCompatibility.countsByCode)
    .filter(([, count]) => count > 0)
    .map(([code]) => code)
  if (input.resolution.actionCounts.unresolved > 0) {
    blockers.push('unresolved_physician_compatibility_decisions')
  }
  if (
    input.resolution.existingHeads.some((row) =>
      row.fields.some((field) => field.classification === 'incompatible'),
    )
  ) {
    blockers.push('incompatible_existing_head_fields')
  }
  if (!input.resolution.readyForPackage && blockers.length === 0) {
    blockers.push('compatibility_resolution_not_ready')
  }
  const terminalState =
    blockers.length === 0
      ? COMPATIBILITY_AUDIT_READY_SUPPLEMENT_NOT_REQUIRED
      : COMPATIBILITY_AUDIT_STILL_BLOCKED
  return {
    schemaVersion: COMPATIBILITY_PACKAGE_READINESS_SCHEMA_VERSION,
    readiness: blockers.length === 0 ? ('ready' as const) : ('blocked' as const),
    packageGenerationAllowed: blockers.length === 0,
    terminalState,
    blockers,
    actionCounts: input.resolution.actionCounts,
    executionCompatibility: input.resolution.executionCompatibility,
    listNormalizationLedgerSha256: input.listNormalizationLedgerSha256,
    supplement: {
      required: input.resolution.supplementRequired,
      supplied: input.supplementSupplied,
      acceptedContentSha256: input.resolution.acceptedSupplementSha256,
      templateContentSha256: input.resolution.supplementTemplate?.binding.contentSha256 ?? null,
    },
    unresolved: {
      count: input.unresolvedPmids.length,
      pmids: input.unresolvedPmids,
    },
    safety: {
      databaseMutationCount: 0,
      databaseQueriesExecuted: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  }
}

/** Build deterministic, sealed reports from already verified local files; performs no I/O. */
export function buildExistingHeadCompatibilityAudit(input: {
  artifactBytes: Buffer
  auditPackage: VerifiedPostMigrationAuditPackage
  compatibilitySupplementBytes?: Buffer
  expectedArtifactSha256: string
}): GeneratedExistingHeadCompatibilityAudit {
  assertReconciledAudit(input.auditPackage)
  if (!SHA256_PATTERN.test(input.expectedArtifactSha256)) {
    throw new Error('Expected finalized artifact SHA-256 is malformed.')
  }
  const originalArtifactSha256 = sha256Bytes(input.artifactBytes)
  if (originalArtifactSha256 !== input.expectedArtifactSha256) {
    throw new Error('Finalized V3 artifact does not match its approved raw SHA-256.')
  }
  if (input.compatibilitySupplementBytes !== undefined) {
    throw new Error(
      'A physician compatibility supplement is not applicable to the authoritative finalized V3 excluded-row shape and cannot change readiness.',
    )
  }
  const audit = input.auditPackage.audit
  if (audit.migration.id !== GOLD_IMPORT_COMPENSATION_MIGRATION_ID) {
    throw new Error('Reconciled audit is bound to an unexpected migration identity.')
  }
  const resolution = resolveGoldImportCompensationCompatibility({
    bindingContext: {
      contract: {
        environmentInvariantIdentitySha256: audit.database.contractInvariantIdentitySha256,
        environmentProfileIdentitySha256: audit.database.environmentProfileIdentitySha256,
      },
      currentDatabase: {
        batchId: audit.database.batchId,
        developmentMembershipSha256: audit.database.developmentMembershipSha256,
        developmentPlanningStateSha256: audit.database.developmentPlanningStateSha256 as string,
        effectiveStateSha256: audit.database.currentEffectiveStateSha256,
        physicalStateSha256: audit.database.currentPhysicalStateSha256,
      },
      finalV3ArtifactSha256: originalArtifactSha256,
      migration: {
        id: GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
        sha256: audit.migration.sha256,
      },
    },
    developmentPlanningState: input.auditPackage.developmentPlanningState,
    finalizedArtifact: input.artifactBytes,
  })
  if (sha256Bytes(input.artifactBytes) !== originalArtifactSha256) {
    throw new Error('Compatibility resolution modified the finalized source artifact bytes.')
  }
  const supplementSupplied = input.compatibilitySupplementBytes !== undefined
  const unresolvedPmids = unresolvedCompatibilityPmids(resolution)
  assertNoPhysicianCompatibilitySupplement(resolution, supplementSupplied, unresolvedPmids)
  const existingHeadBooleanNormalizations = resolution.artifact.booleanNormalizations.filter(
    (entry) =>
      entry.column === 'is_blinded' &&
      resolution.existingHeads.some((row) => row.identity.itemId === entry.sourceIdentity.itemId),
  )
  if (
    existingHeadBooleanNormalizations.length !== 9 ||
    existingHeadBooleanNormalizations.some(
      (entry) =>
        entry.originalLexeme !== 'False' ||
        entry.semanticValue !== false ||
        entry.canonicalLexeme !== 'false',
    )
  ) {
    throw new Error('The exact nine legacy False values did not normalize deterministically.')
  }
  const listNormalizationLedgerSha256 = sha256Bytes(
    canonicalJson(resolution.artifact.listNormalizations),
  )
  const readiness = compatibilityReadinessReport({
    listNormalizationLedgerSha256,
    resolution,
    supplementSupplied,
    unresolvedPmids,
  })
  if (readiness.packageGenerationAllowed !== resolution.readyForPackage) {
    throw new Error('Compatibility readiness report disagrees with the pure resolver.')
  }
  const sourceBindings = {
    postMigrationAuditManifestSha256: input.auditPackage.manifestSha256,
    finalV3ArtifactSha256: originalArtifactSha256,
    existingHeadCohortSha256: resolution.existingHeadCohortSha256,
    listNormalizationLedgerSha256,
    migration: audit.migration,
    currentDatabase: {
      batchId: audit.database.batchId,
      developmentMembershipSha256: audit.database.developmentMembershipSha256,
      developmentPlanningStateSha256: audit.database.developmentPlanningStateSha256,
      effectiveStateSha256: audit.database.currentEffectiveStateSha256,
      physicalStateSha256: audit.database.currentPhysicalStateSha256,
    },
    contract: {
      environmentInvariantIdentitySha256: audit.database.contractInvariantIdentitySha256,
      environmentProfileIdentitySha256: audit.database.environmentProfileIdentitySha256,
    },
  }
  const existingHeadAudit = {
    schemaVersion: EXISTING_HEAD_COMPATIBILITY_AUDIT_SCHEMA_VERSION,
    status: readiness.readiness,
    contractAuditReady: true,
    terminalState: readiness.terminalState,
    packageGenerationAllowed: readiness.packageGenerationAllowed,
    sourceBindings,
    actionCounts: resolution.actionCounts,
    executionCompatibility: resolution.executionCompatibility,
    existingHeadCount: resolution.existingHeads.length,
    existingHeads: resolution.existingHeads,
    planningDispositions: resolution.planningRows.map(
      ({
        executionBlockerCodes,
        identity,
        proposedAction,
        reason,
        resolutionStatus,
        sequence,
      }) => ({
        executionBlockerCodes,
        identity,
        proposedAction,
        reason,
        resolutionStatus,
        sequence,
      }),
    ),
    unresolved: {
      count: unresolvedPmids.length,
      pmids: unresolvedPmids,
    },
    supplement: {
      required: resolution.supplementRequired,
      supplied: supplementSupplied,
      acceptedContentSha256: resolution.acceptedSupplementSha256,
      templateContentSha256: resolution.supplementTemplate?.binding.contentSha256 ?? null,
    },
    safety: {
      sourceArtifactBytesPreserved: true,
      sourceArtifactWritten: false,
      databaseMutationCount: 0,
      databaseQueriesExecuted: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  }
  const booleanNormalizationReport = {
    schemaVersion: BOOLEAN_NORMALIZATION_REPORT_SCHEMA_VERSION,
    normalizationRuleVersion: GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION,
    sourceArtifactSha256: originalArtifactSha256,
    sourceArtifactBytesPreserved: true,
    artifactRowCount: resolution.artifact.rows.length,
    normalizationCount: resolution.artifact.booleanNormalizations.length,
    legacyTitleCaseNormalizationCount: resolution.artifact.booleanNormalizations.filter(
      (entry) => entry.sourceForm === 'legacy_title_case',
    ).length,
    existingHeadLegacyFalseCount: existingHeadBooleanNormalizations.length,
    existingHeadLegacyFalseNormalizations: existingHeadBooleanNormalizations,
    normalizations: resolution.artifact.booleanNormalizations,
  }
  const listNormalizationReport = {
    schemaVersion: LIST_NORMALIZATION_REPORT_SCHEMA_VERSION,
    normalizationRuleVersion: GOLD_IMPORT_LIST_NORMALIZATION_RULE_VERSION,
    sourceArtifactSha256: originalArtifactSha256,
    sourceArtifactBytesPreserved: true,
    artifactRowCount: resolution.artifact.rows.length,
    normalizationCount: resolution.artifact.listNormalizations.length,
    normalizationCountsByColumn: Object.fromEntries(
      ['topic_ids', 'technology_tags', 'clinical_purposes', 'disease_tags'].map((column) => [
        column,
        resolution.artifact.listNormalizations.filter((entry) => entry.column === column).length,
      ]),
    ),
    normalizationLedgerSha256: listNormalizationLedgerSha256,
    normalizations: resolution.artifact.listNormalizations,
  }
  const canonicalRecords: Record<string, unknown> = {
    'boolean-normalization-report.json': booleanNormalizationReport,
    'existing-head-compatibility-audit.json': existingHeadAudit,
    'list-normalization-report.json': listNormalizationReport,
    'package-readiness.json': readiness,
  }
  const sealed = sealCanonicalFiles(canonicalFileMap(canonicalRecords))
  return {
    canonicalFiles: sealed.files,
    canonicalManifest: sealed.manifest,
    canonicalManifestSha256: sealed.manifestSha256,
    packageReady: readiness.packageGenerationAllowed,
    resolution,
    sourceAuditManifestSha256: input.auditPackage.manifestSha256,
    sourceSupplementSha256: null,
    terminalState: readiness.terminalState,
    unresolvedPmids,
  }
}

export async function writeExistingHeadCompatibilityAuditExclusive(input: {
  artifactPath: string
  auditPath: string
  executedAt: string
  generated: GeneratedExistingHeadCompatibilityAudit
  outputDirectory: string
  outputRoot: string
  repositoryCommitSha: string
}): Promise<void> {
  const identity = await createExclusiveOutputDirectory({
    outputDirectory: input.outputDirectory,
    outputRoot: input.outputRoot,
  })
  const receipt = {
    schemaVersion: COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION,
    kind: 'existing_head_compatibility_file_only_audit',
    executedAt: input.executedAt,
    mode: 'file_only_read_only',
    outputDirectory: input.outputDirectory,
    repositoryCommitSha: input.repositoryCommitSha,
    canonicalArtifactCount: input.generated.canonicalFiles.size,
    canonicalManifestSha256: input.generated.canonicalManifestSha256,
    packageReady: input.generated.packageReady,
    terminalState: input.generated.terminalState,
    sources: {
      auditPath: input.auditPath,
      artifactPath: input.artifactPath,
      postMigrationAuditManifestSha256: input.generated.sourceAuditManifestSha256,
      finalV3ArtifactSha256: input.generated.resolution.artifact.artifactSha256,
      compatibilitySupplementFileSha256: input.generated.sourceSupplementSha256,
      compatibilitySupplementContentSha256: input.generated.resolution.acceptedSupplementSha256,
    },
    safety: {
      sourceArtifactBytesPreserved: true,
      sourceArtifactWritten: false,
      databaseMutationCount: 0,
      databaseQueriesExecuted: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  }
  writeExclusiveOutputFiles(identity, [
    ...[...input.generated.canonicalFiles].map(([name, bytes]) => ({ name, bytes })),
    { name: 'checksum-manifest.sha256', bytes: input.generated.canonicalManifest },
    { name: 'execution-receipt.json', bytes: canonicalPretty(receipt) },
  ])
  await assertExclusiveOutputDirectoryIdentity(identity)
}

async function readRegularNonSymlinkFile(path: string, label: string): Promise<Buffer> {
  const absolutePath = resolve(path)
  const [stat, resolvedPath] = await Promise.all([lstat(absolutePath), realpath(absolutePath)])
  if (!stat.isFile() || stat.isSymbolicLink() || resolvedPath !== absolutePath) {
    throw new Error(`${label} must be a regular non-symlink file with real ancestors.`)
  }
  return readFile(absolutePath)
}

async function readAuditBundle(input: { auditPath: string; developmentStatePath: string }) {
  const auditPath = resolve(input.auditPath)
  if (basename(auditPath) !== 'migration-audit.json') {
    throw new Error('--audit must name the canonical migration-audit.json artifact.')
  }
  const auditDirectory = dirname(auditPath)
  if (
    resolve(input.developmentStatePath) !==
    resolve(auditDirectory, 'development-planning-state.json')
  ) {
    throw new Error(
      '--development-state must be the canonical planning artifact beside migration-audit.json.',
    )
  }
  const [
    auditBytes,
    developmentPlanningStateBytes,
    manifestBytes,
    markdownBytes,
    identityBytes,
    contractDiagnosticsBytes,
    contractReconciliationBytes,
    readOnlyStateBracketBytes,
  ] = await Promise.all([
    readRegularNonSymlinkFile(auditPath, 'migration-audit.json'),
    readRegularNonSymlinkFile(
      resolve(auditDirectory, 'development-planning-state.json'),
      'development-planning-state.json',
    ),
    readRegularNonSymlinkFile(
      resolve(auditDirectory, 'checksum-manifest.sha256'),
      'checksum-manifest.sha256',
    ),
    readRegularNonSymlinkFile(resolve(auditDirectory, 'migration-audit.md'), 'migration-audit.md'),
    readRegularNonSymlinkFile(
      resolve(auditDirectory, 'schema-security-definition-identity.json'),
      'schema-security-definition-identity.json',
    ),
    readRegularNonSymlinkFile(
      resolve(auditDirectory, 'contract-diagnostics.json'),
      'contract-diagnostics.json',
    ),
    readRegularNonSymlinkFile(
      resolve(auditDirectory, 'contract-reconciliation.json'),
      'contract-reconciliation.json',
    ),
    readRegularNonSymlinkFile(
      resolve(auditDirectory, 'read-only-state-bracket.json'),
      'read-only-state-bracket.json',
    ),
  ])
  return {
    auditBytes,
    developmentPlanningStateBytes,
    manifestBytes,
    markdownBytes,
    reconciledEvidence: {
      contractDiagnosticsBytes,
      contractReconciliationBytes,
      readOnlyStateBracketBytes,
    },
    schemaSecurityDefinitionIdentityBytes: identityBytes,
  }
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

export async function runAuditGoldExistingHeadCompatibility(
  argv: readonly string[],
  dependencies: ExistingHeadCompatibilityAuditDependencies = {},
): Promise<
  | { help: string }
  | {
      manifestSha256: string
      outputDirectory: string
      packageReady: boolean
      terminalState: GeneratedExistingHeadCompatibilityAudit['terminalState']
      unresolvedPmids: readonly string[]
    }
> {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, [
    'artifact',
    'audit',
    'audit-manifest-sha256',
    'commit',
    'compatibility-supplement',
    'development-state',
    'help',
    'output',
    'output-root',
  ])
  if (arguments_.flags.has('help')) return { help: HELP }
  if (arguments_.flags.has('commit') || arguments_.values.has('commit')) {
    throw new Error('This compatibility audit has no commit or database-write mode.')
  }
  const rawOutputRoot = requiredArgument(arguments_, 'output-root')
  const rawOutputDirectory = requiredArgument(arguments_, 'output')
  assertSafeOutputPathArgument(rawOutputRoot, '--output-root')
  assertSafeOutputPathArgument(rawOutputDirectory, '--output')
  if (
    (dependencies.inspectRepositoryState || dependencies.assertRepositoryState) &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error('Repository-guard overrides are restricted to tests.')
  }
  const cwd = resolve(dependencies.cwd ?? process.cwd())
  const inspectRepository =
    dependencies.inspectRepositoryState ?? inspectReadOnlyReconciliationRepositoryState
  const assertRepository =
    dependencies.assertRepositoryState ?? assertReadOnlyReconciliationRepositoryGuard
  const repository = await inspectRepository(cwd, dependencies.runCommand)
  assertRepository(repository)
  const auditPath = resolve(requiredArgument(arguments_, 'audit'))
  const developmentStatePath = resolve(requiredArgument(arguments_, 'development-state'))
  const trustedManifestSha256 = requiredArgument(arguments_, 'audit-manifest-sha256')
  const auditBundle = await readAuditBundle({ auditPath, developmentStatePath })
  if (dependencies.verifyReadyAuditPackage && process.env.NODE_ENV !== 'test') {
    throw new Error('Ready-audit verifier override is restricted to tests.')
  }
  const verifyAudit = dependencies.verifyReadyAuditPackage ?? verifyReadyPostMigrationAuditPackage
  const auditPackage = verifyAudit({
    ...auditBundle,
    trustedManifestSha256,
  })
  assertReconciledAudit(auditPackage)
  if (auditPackage.audit.database.repositoryCommitSha !== repository.head) {
    throw new Error(
      'Reconciled audit repository commit does not match the guarded compatibility-audit HEAD.',
    )
  }
  // The finalized source is intentionally not opened until the reconciled bundle is authenticated.
  const artifactPath = resolve(requiredArgument(arguments_, 'artifact'))
  const artifactBytes = await readRegularNonSymlinkFile(artifactPath, 'Finalized V3 artifact')
  const supplementPath = stringArgument(arguments_, 'compatibility-supplement')
  const compatibilitySupplementBytes = supplementPath
    ? await readRegularNonSymlinkFile(resolve(supplementPath), 'Completed compatibility supplement')
    : undefined
  if (dependencies.expectedArtifactSha256ForTest && process.env.NODE_ENV !== 'test') {
    throw new Error('Finalized artifact identity override is restricted to tests.')
  }
  const generated = buildExistingHeadCompatibilityAudit({
    artifactBytes,
    auditPackage,
    compatibilitySupplementBytes,
    expectedArtifactSha256: dependencies.expectedArtifactSha256ForTest ?? FINAL_V3_ARTIFACT_SHA256,
  })
  const outputRoot = resolve(rawOutputRoot)
  const outputDirectory = resolve(rawOutputDirectory)
  await writeExistingHeadCompatibilityAuditExclusive({
    artifactPath,
    auditPath,
    executedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    generated,
    outputDirectory,
    outputRoot,
    repositoryCommitSha: repository.head,
  })
  return {
    manifestSha256: generated.canonicalManifestSha256,
    outputDirectory,
    packageReady: generated.packageReady,
    terminalState: generated.terminalState,
    unresolvedPmids: generated.unresolvedPmids,
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runAuditGoldExistingHeadCompatibility(process.argv.slice(2))
    .then((result) => {
      if ('help' in result) {
        console.log(result.help)
        return
      }
      console.log(`${JSON.stringify(result, null, 2)}\n`)
      console.log('Database queries: 0; mutations: 0; held-out identities: 0; remote access: 0')
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
