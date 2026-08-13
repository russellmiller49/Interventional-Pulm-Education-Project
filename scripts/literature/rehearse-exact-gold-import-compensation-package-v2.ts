import { createHash, randomBytes } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { lstat, readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  validateReadyGoldImportCompensationV2Audit,
  type GoldImportCompensationV2ReadyAudit,
} from './audit-gold-import-compensation-v2'
import {
  type V2ExactPackageBootstrapSources,
  createBootstrappedExactPackageDatabaseExecutorV2,
} from './execute-exact-gold-import-compensation-package-v2'
import {
  validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile,
  type ProtectedV2CompleteCatalogAuditIdentity,
} from './gold-import-contract-v2-catalog-audit'
import {
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  expectedObservedAuditIdentityFromArtifact,
} from './gold-import-contract-v2-catalog-expectations'
import {
  buildGoldImportV2PackageGenerationReadiness,
  validateGoldImportV2PackageGenerationReadiness,
  type GeneratedGoldImportCompensationPackageV2,
  type GoldImportV2PackageGenerationReadiness,
} from './generate-gold-import-compensation-package-v2'
import {
  loadAndVerifyBackup,
  type LoadedPreMigrationBackup,
} from './gold-import-compensation-migration-operations'
import { GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 } from './gold-import-note-disposition-gate-v2'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  assertExclusiveOutputDirectoryIdentity,
  assertSafeOutputPathArgument,
  createExclusiveOutputDirectory,
  createStagedExclusiveOutputDirectory,
  discardStagedExclusiveOutputDirectory,
  publishStagedExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
  type StagedExclusiveOutputDirectory,
} from './lib/exclusive-output'
import {
  assertDeterministicV2RehearsalRuns,
  executeV2DisposablePath,
  type ExecuteV2DisposablePathInput,
  type V2DisposablePathResult,
  type V2ExactPackageDatabaseExecutor,
} from './rehearse-gold-import-compensation-db-v2'
import {
  runProtectedV2DisposableCatalogDriftMatrix,
  type ProtectedV2CatalogDriftMatrixEvidence,
} from './rehearse-gold-import-contract-v2-catalog-drift-matrix'
import { developmentDatabaseSeedSchema } from './rehearse-exact-gold-import-compensation-package-v1'
import {
  buildProtectedV2OperatorBundle,
  type ProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'
import {
  assertProtectedV2ExpectedCatalogArtifactSealed,
  buildProtectedV2ExpectedCatalogBinding,
  buildProtectedV2RuntimeBundleBinding,
  validateProtectedV2RuntimeBundleBinding,
  type ProtectedV2ExpectedCatalogBinding,
  type ProtectedV2RuntimeBundleBinding,
} from './protected-gold-import-contract-v2-bindings'
import type { V2CanonicalAuthorizationBindings } from './gold-import-compensation-rehearsal-evidence-v2'
import {
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  assertGoldImportV2CurrentDatabaseMatchesPackageReadiness,
  collectGoldImportV2PreimportFixedLocalState,
  inspectGoldImportV2PrimaryMainRepository,
  loadGoldImportV2FinalizedReceiptEvidence,
  type GoldImportV2RepositoryEvidence,
  type GoldImportV2FixedLocalState,
} from './gold-import-v2-package-readiness'
import {
  GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
  loadGoldImportV2PreimportRuntimeBundle,
  verifyGoldImportV2PreimportCaptureDirectory,
} from './gold-import-v2-preimport-capture'
import {
  buildGoldImportV2DatabasePublicationObservationBinding,
  runGoldImportV2DatabasePublicationProtocol,
} from './gold-import-v2-database-publication'
import { validateGoldImportV2ExactPackageRehearsalReport21 } from './gold-import-v2-lifecycle-compatibility'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTING_MODULE_PATH = realpathSync(fileURLToPath(import.meta.url))
const EXPECTED_PRODUCTION_MODULE_PATH = resolve(
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
)
const MIGRATION_FILENAME = `${GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2}.sql`
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/u
const PACKAGE_OUTPUT_DIRECTORY = 'exact-package-v2'
const PRODUCTION_REHEARSAL_PUBLICATION_BRACKET_FILE =
  'database-publication-bracket-v2.json' as const
export const EXACT_V2_PACKAGE_REHEARSAL_REPORT_SCHEMA_VERSION =
  'gold-import-compensation-exact-package-rehearsal/2.1.0' as const
export const GOLD_IMPORT_PRE_V1_BACKUP_PHYSICAL_STATE_SHA256_V2 =
  'b509e876f48112957eda42e8ec04e92a10bc40c3217b0011d1c0d708d519ce4f' as const
const CANONICAL_OUTPUT_NAMES = [
  'disposable-v2-catalog-drift-matrix.json',
  'disposable-v2-complete-catalog-audit.json',
  'disposable-v2-exact-catalog-binding.json',
  'disposable-v2-ready-audit.json',
  'exact-package-rehearsal-report-v2.json',
  'fresh-v2-rehearsal-evidence.json',
  'protected-v2-runtime-bundle-binding.json',
  'upgrade-v2-rehearsal-evidence.json',
] as const

const CLI_ARGUMENTS = [
  'amended-authorization',
  'amended-authorization-exact-text',
  'artifact',
  'authorization-manifest',
  'authorization-mapping',
  'authorization-mapping-correction',
  'authorization-mapping-correction-manifest',
  'help',
  'migration',
  'note-disposition-audit',
  'output',
  'output-root',
  'planning-state',
  'preimport-capture-one',
  'preimport-capture-two',
  'pre-migration-backup',
  'pre-migration-backup-manifest-sha256',
  'protocol-authorization',
] as const

const HELP = `
Bootstrap, execute, and compensate the exact V2 package in owned disposable databases.

The first upgraded V1-seeded container authenticates V2, collects the ready audit,
derives the post-import hash, and generates the package in context. The command
then regenerates and byte-compares the package while running upgrade twice and
fresh historical+V1+V2 twice. Upgrade loads the authenticated pre-V1 seed at
its historical boundary, applies V1, and brackets only V2. Fresh applies the
complete schema while empty, then loads a validated migration-equivalent V2
projection of the same seed. Their post-V2 schema and clinical identities must
match before package generation or RPC execution. Every run uses the pinned
local Docker image and must prove cleanup. No database URL, host, SQL, remote
target, or held-out input is accepted. Canonical generation additionally
requires the exact primary checkout on attached main, a completely clean
tracked/untracked worktree, and HEAD exactly equal to origin/main. The exported
helpers are pure validators and cannot accept database, filesystem, Docker, or
production-readiness capabilities.

Usage:
  npm run literature:rehearse-exact-gold-import-compensation-package-v2 -- \\
    --pre-migration-backup <checksum-bound-v1-backup-directory> \\
    --pre-migration-backup-manifest-sha256 <reviewed-sha256> \\
    --preimport-capture-one <first-post-v2-capture-directory> \\
    --preimport-capture-two <second-post-v2-capture-directory> \\
    --planning-state <development-planning-state.json> \\
    --artifact <gold-set-v1-enrichment-v3-final-development-630.csv> \\
    --migration <${MIGRATION_FILENAME}> \\
    --protocol-authorization <signed-protocol-authorization> \\
    --amended-authorization <amended-two-row-authorization> \\
    --amended-authorization-exact-text <exact-text> \\
    --authorization-manifest <manifest> \\
    --authorization-mapping <mapping> \\
    --authorization-mapping-correction <mapping-correction> \\
    --authorization-mapping-correction-manifest <correction-manifest> \\
    --note-disposition-audit <accepted-note-audit.json> \\
    --output-root <existing-local-root> --output <new-evidence-directory>
`.trim()

function parseExactV2PackageRehearsalCliArguments(argv: readonly string[]) {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, CLI_ARGUMENTS)
  return arguments_
}

export function validateExactV2PackageRehearsalCliArguments(argv: readonly string[]): {
  help: boolean
} {
  const arguments_ = parseExactV2PackageRehearsalCliArguments(argv)
  return { help: arguments_.flags.has('help') }
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

async function assertNoSymlinkAncestors(path: string): Promise<void> {
  let cursor = resolve(path)
  while (true) {
    try {
      const stat = await lstat(cursor)
      if (stat.isSymbolicLink()) throw new Error(`Symlink traversal refused at ${cursor}.`)
    } catch (error) {
      if (!isMissing(error)) throw error
    }
    const parent = dirname(cursor)
    if (parent === cursor) return
    cursor = parent
  }
}

async function readRegularNonSymlinkFile(path: string, label: string): Promise<Buffer> {
  const absolute = resolve(path)
  await assertNoSymlinkAncestors(absolute)
  const stat = await lstat(absolute)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`)
  }
  return readFile(absolute)
}

function parseJson(bytes: Buffer, label: string): unknown {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error(
      `${label} is not JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
}

export interface V2RehearsalRepositoryEvidence {
  branch: string
  cleanTrackedAndUntrackedWorktree: true
  headSha: string
  originMainIsAncestor: true
  originMainSha: string
  primaryCheckout: boolean
  repositoryRoot: string
}

function validateV2RehearsalRepositoryEvidence(
  input: V2RehearsalRepositoryEvidence,
): V2RehearsalRepositoryEvidence {
  if (
    !input.branch.trim() ||
    input.branch !== input.branch.trim() ||
    !COMMIT_SHA_PATTERN.test(input.headSha) ||
    !COMMIT_SHA_PATTERN.test(input.originMainSha) ||
    input.cleanTrackedAndUntrackedWorktree !== true ||
    input.originMainIsAncestor !== true ||
    typeof input.primaryCheckout !== 'boolean' ||
    !input.repositoryRoot.trim()
  ) {
    throw new Error('Injected V2 rehearsal repository evidence is incomplete or unsafe.')
  }
  return Object.freeze({ ...input, repositoryRoot: resolve(input.repositoryRoot) })
}

export function validateV2RehearsalCoreRepositoryEvidence(
  input: V2RehearsalRepositoryEvidence,
): V2RehearsalRepositoryEvidence {
  const evidence = validateV2RehearsalRepositoryEvidence(input)
  if (
    evidence.primaryCheckout ||
    evidence.branch === 'main' ||
    evidence.repositoryRoot === GOLD_IMPORT_V2_PRIMARY_CHECKOUT
  ) {
    throw new Error(
      'Exported V2 rehearsal evidence must describe a non-primary disposable context.',
    )
  }
  return evidence
}

async function readProductionV2RehearsalRepositoryEvidence(): Promise<V2RehearsalRepositoryEvidence> {
  const repository = await inspectGoldImportV2PrimaryMainRepository({ cwd: REPOSITORY_ROOT })
  return rehearsalRepositoryEvidence(repository)
}

function rehearsalRepositoryEvidence(
  repository: GoldImportV2RepositoryEvidence,
): V2RehearsalRepositoryEvidence {
  return validateV2RehearsalRepositoryEvidence({
    branch: repository.branch,
    cleanTrackedAndUntrackedWorktree: true,
    headSha: repository.headSha,
    originMainIsAncestor: true,
    originMainSha: repository.originMainSha,
    primaryCheckout: true,
    repositoryRoot: repository.repositoryRoot,
  })
}

async function loadProductionV2RehearsalReadiness(input: {
  captureDirectories: readonly [string, string]
}): Promise<{
  fixedLocalState: GoldImportV2FixedLocalState
  readiness: GoldImportV2PackageGenerationReadiness
  repositoryEvidence: V2RehearsalRepositoryEvidence
}> {
  const repository = await inspectGoldImportV2PrimaryMainRepository({ cwd: REPOSITORY_ROOT })
  const [receipt, runtimeBundle, firstCapture, secondCapture] = await Promise.all([
    loadGoldImportV2FinalizedReceiptEvidence(),
    loadGoldImportV2PreimportRuntimeBundle(GOLD_IMPORT_V2_PRIMARY_CHECKOUT),
    verifyGoldImportV2PreimportCaptureDirectory({
      backupRoot: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
      directory: input.captureDirectories[0],
    }),
    verifyGoldImportV2PreimportCaptureDirectory({
      backupRoot: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
      directory: input.captureDirectories[1],
    }),
  ])
  const readiness = buildGoldImportV2PackageGenerationReadiness({
    captures: [firstCapture, secondCapture],
    currentFinalizedReceipt: receipt,
    currentRepository: repository,
    currentRuntimeBundle: runtimeBundle,
    now: new Date(),
  })
  const databaseEvidence = await collectGoldImportV2PreimportFixedLocalState()
  assertGoldImportV2CurrentDatabaseMatchesPackageReadiness({
    expected: readiness.packageReadiness,
    fixedLocalState: databaseEvidence,
    receipt,
    repository,
  })
  const [finalRepository, finalReceipt, finalRuntimeBundle, finalFirstCapture, finalSecondCapture] =
    await Promise.all([
      inspectGoldImportV2PrimaryMainRepository({ cwd: REPOSITORY_ROOT }),
      loadGoldImportV2FinalizedReceiptEvidence(),
      loadGoldImportV2PreimportRuntimeBundle(GOLD_IMPORT_V2_PRIMARY_CHECKOUT),
      verifyGoldImportV2PreimportCaptureDirectory({
        backupRoot: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
        directory: input.captureDirectories[0],
      }),
      verifyGoldImportV2PreimportCaptureDirectory({
        backupRoot: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
        directory: input.captureDirectories[1],
      }),
    ])
  const finalReadiness = buildGoldImportV2PackageGenerationReadiness({
    captures: [finalFirstCapture, finalSecondCapture],
    currentFinalizedReceipt: finalReceipt,
    currentRepository: finalRepository,
    currentRuntimeBundle: finalRuntimeBundle,
    now: new Date(),
  })
  if (canonicalJson(finalReadiness) !== canonicalJson(readiness)) {
    throw new Error(
      'Post-V2 capture pair, receipt, runtime, or repository changed during fixed-local verification.',
    )
  }
  return {
    fixedLocalState: databaseEvidence,
    readiness: finalReadiness,
    repositoryEvidence: rehearsalRepositoryEvidence(finalRepository),
  }
}

function assertV2RehearsalRepositoryEvidenceUnchangedInternal(
  expected: V2RehearsalRepositoryEvidence,
  currentInput: V2RehearsalRepositoryEvidence,
): void {
  const authenticatedExpected = validateV2RehearsalRepositoryEvidence(expected)
  const current = validateV2RehearsalRepositoryEvidence(currentInput)
  if (canonicalJson(current) !== canonicalJson(authenticatedExpected)) {
    throw new Error('Repository evidence changed during the four-run V2 rehearsal.')
  }
}

export function assertV2RehearsalRepositoryEvidenceUnchanged(
  expected: V2RehearsalRepositoryEvidence,
  current: V2RehearsalRepositoryEvidence,
): void {
  validateV2RehearsalCoreRepositoryEvidence(expected)
  validateV2RehearsalCoreRepositoryEvidence(current)
  assertV2RehearsalRepositoryEvidenceUnchangedInternal(expected, current)
}

export function assertAuthenticatedPreV1BackupIdentityV2(input: {
  batchId: unknown
  developmentMembershipSha256: unknown
  effectiveStateSha256: unknown
  physicalStateSha256: unknown
  planningStateSha256: unknown
  seedBatchId: unknown
}): void {
  if (
    input.effectiveStateSha256 !== GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256 ||
    input.physicalStateSha256 !== GOLD_IMPORT_PRE_V1_BACKUP_PHYSICAL_STATE_SHA256_V2 ||
    input.developmentMembershipSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256 ||
    input.planningStateSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256 ||
    input.batchId !== input.seedBatchId
  ) {
    throw new Error(
      'Checksum-bound backup is not the accepted pre-V1 effective/physical/membership/planning state.',
    )
  }
}

function authenticatedSeedFromBackup(
  backup: LoadedPreMigrationBackup,
  trustedManifestSha256: string,
) {
  if (
    !SHA256_PATTERN.test(trustedManifestSha256) ||
    backup.manifestSha256 !== trustedManifestSha256
  ) {
    throw new Error('Loaded pre-migration backup does not match the reviewed manifest identity.')
  }
  const seed = developmentDatabaseSeedSchema.parse(backup.developmentSeed)
  const stateAudits = record(backup.stateAudits, 'pre-migration backup state audits')
  const receipt = record(backup.receipt, 'pre-migration backup receipt')
  const databaseIdentity = record(
    receipt.databaseIdentity,
    'pre-migration backup database identity',
  )
  assertAuthenticatedPreV1BackupIdentityV2({
    batchId: databaseIdentity.batchId,
    developmentMembershipSha256: databaseIdentity.developmentMembershipSha256,
    effectiveStateSha256: stateAudits.effectiveStateSha256,
    physicalStateSha256: stateAudits.physicalStateSha256,
    planningStateSha256: sha256Canonical(backup.planningState),
    seedBatchId: seed.batchId,
  })
  return seed
}

interface CompleteV2RehearsalResults {
  bootstrapUpgrade: V2DisposablePathResult
  fresh: readonly [V2DisposablePathResult, V2DisposablePathResult]
  upgrade: readonly [V2DisposablePathResult, V2DisposablePathResult]
}

interface CompleteV2RehearsalDependencies {
  executePath(input: ExecuteV2DisposablePathInput): Promise<V2DisposablePathResult>
}

const PRODUCTION_COMPLETE_REHEARSAL_DEPENDENCIES: CompleteV2RehearsalDependencies = {
  executePath: executeV2DisposablePath,
}

/** Bootstrap in upgrade run one, then require a second upgrade and two fresh runs. */
export const EXACT_V2_REHEARSAL_PATH_ORDER = ['upgrade', 'upgrade', 'fresh', 'fresh'] as const

async function executeCompleteV2Rehearsal(input: {
  dependencies?: CompleteV2RehearsalDependencies
  evidenceBindings: V2CanonicalAuthorizationBindings
  exactPackageExecutor: V2ExactPackageDatabaseExecutor
  seed: ReturnType<typeof developmentDatabaseSeedSchema.parse>
}): Promise<CompleteV2RehearsalResults> {
  const dependencies = input.dependencies ?? PRODUCTION_COMPLETE_REHEARSAL_DEPENDENCIES
  const run = (migrationPath: 'fresh' | 'upgrade') =>
    dependencies.executePath({
      evidenceBindings: input.evidenceBindings,
      exactPackageExecutor: input.exactPackageExecutor,
      migrationPath,
      seed: input.seed,
    })
  const bootstrapUpgrade = await run(EXACT_V2_REHEARSAL_PATH_ORDER[0])
  const upgradeSecond = await run(EXACT_V2_REHEARSAL_PATH_ORDER[1])
  const freshFirst = await run(EXACT_V2_REHEARSAL_PATH_ORDER[2])
  const freshSecond = await run(EXACT_V2_REHEARSAL_PATH_ORDER[3])
  assertDeterministicV2RehearsalRuns(bootstrapUpgrade, upgradeSecond)
  assertDeterministicV2RehearsalRuns(freshFirst, freshSecond)
  if (
    new Set([
      bootstrapUpgrade.migrationSha256,
      upgradeSecond.migrationSha256,
      freshFirst.migrationSha256,
      freshSecond.migrationSha256,
    ]).size !== 1
  ) {
    throw new Error('Complete V2 rehearsal paths used different migration bytes.')
  }
  return {
    bootstrapUpgrade,
    fresh: [freshFirst, freshSecond],
    upgrade: [bootstrapUpgrade, upgradeSecond],
  }
}

function canonicalPathEvidence(
  result: V2DisposablePathResult,
  expectedBindings: V2CanonicalAuthorizationBindings,
): Buffer {
  const expectedNames = ['canonical-manifest.sha256', 'v2-rehearsal-evidence.json']
  const actualNames = [...result.canonicalArtifacts.keys()].sort((left, right) =>
    left.localeCompare(right, 'en'),
  )
  if (canonicalJson(actualNames) !== canonicalJson(expectedNames)) {
    throw new Error(`${result.migrationPath} canonical artifact inventory drifted.`)
  }
  const evidence = result.canonicalArtifacts.get('v2-rehearsal-evidence.json')!
  const manifest = result.canonicalArtifacts.get('canonical-manifest.sha256')!
  if (!manifest.equals(Buffer.from(`${sha256(evidence)}  v2-rehearsal-evidence.json\n`))) {
    throw new Error(`${result.migrationPath} canonical artifact manifest is stale.`)
  }
  const parsedEvidence = record(
    parseJson(evidence, `${result.migrationPath} rehearsal evidence`),
    `${result.migrationPath} rehearsal evidence`,
  )
  const authorizationBindings = record(
    parsedEvidence.authorizationBindings,
    `${result.migrationPath} rehearsal authorization bindings`,
  )
  if (
    authorizationBindings.authority !==
      'exact_committed_disposable_catalog_and_protected_runtime_bundle' ||
    canonicalJson(authorizationBindings.completeCatalogAudit) !==
      canonicalJson(expectedBindings.completeCatalogAudit) ||
    canonicalJson(authorizationBindings.expectedCatalog) !==
      canonicalJson(expectedBindings.expectedCatalog) ||
    canonicalJson(authorizationBindings.operatorBundleBinding) !==
      canonicalJson(expectedBindings.operatorBundleBinding)
  ) {
    throw new Error(`${result.migrationPath} canonical evidence lacks its exact A/B bindings.`)
  }
  return evidence
}

function prettyCanonical(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`, 'utf8')
}

function canonicalManifest(files: ReadonlyMap<string, Buffer>): Buffer {
  return Buffer.from(
    `${[...files.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
}

function buildCanonicalOutputs(input: {
  audit: GoldImportCompensationV2ReadyAudit
  backupManifestSha256: string
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity
  driftMatrix: ProtectedV2CatalogDriftMatrixEvidence
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  operatorBundle: ProtectedV2OperatorBundle
  operatorBundleBinding: ProtectedV2RuntimeBundleBinding
  package: GeneratedGoldImportCompensationPackageV2
  productionReadiness?: GoldImportV2PackageGenerationReadiness
  repositoryEvidence: V2RehearsalRepositoryEvidence
  results: CompleteV2RehearsalResults
}) {
  const audit = validateReadyGoldImportCompensationV2Audit(input.audit)
  const repositoryEvidence = validateV2RehearsalRepositoryEvidence(input.repositoryEvidence)
  const operatorBundleBinding = validateProtectedV2RuntimeBundleBinding(
    input.operatorBundleBinding,
    input.operatorBundle,
  )
  const evidenceBindings = {
    completeCatalogAudit: input.completeCatalogAudit,
    expectedCatalog: input.expectedCatalog,
    operatorBundle: input.operatorBundle,
    operatorBundleBinding,
  }
  const freshEvidence = canonicalPathEvidence(input.results.fresh[0], evidenceBindings)
  const upgradeEvidence = canonicalPathEvidence(input.results.upgrade[0], evidenceBindings)
  if (
    canonicalJson(audit.completeCatalogAudit) !== canonicalJson(input.completeCatalogAudit) ||
    canonicalJson(audit.expectedCatalog) !== canonicalJson(input.expectedCatalog) ||
    canonicalJson(input.package.sourceAuthorizationSet.completeCatalogAudit) !==
      canonicalJson(input.completeCatalogAudit) ||
    canonicalJson(input.package.sourceAuthorizationSet.expectedCatalog) !==
      canonicalJson(input.expectedCatalog) ||
    input.package.verifiedBindings.completeCatalogAuditIdentitySha256 !==
      input.completeCatalogAudit.fullAuditIdentitySha256 ||
    input.package.verifiedBindings.expectedCatalogBindingSha256 !==
      input.expectedCatalog.bindingSha256 ||
    input.package.importPlan.executionContext.repositoryCommitSha !== repositoryEvidence.headSha
  ) {
    throw new Error(
      'Ready audit, package, source authorization, repository, and exact catalog bindings differ.',
    )
  }
  const auditBytes = prettyCanonical(audit)
  const completeCatalogAuditBytes = prettyCanonical(input.completeCatalogAudit)
  const driftMatrixBytes = prettyCanonical(input.driftMatrix)
  const report = validateGoldImportV2ExactPackageRehearsalReport21({
    audit: {
      completeCatalogAuditIdentitySha256: input.completeCatalogAudit.fullAuditIdentitySha256,
      completeCatalogAuditModelIdentitySha256: input.completeCatalogAudit.auditModelIdentitySha256,
      environmentInvariantIdentitySha256: record(
        record(input.audit, 'ready audit').contractAudit,
        'ready audit contractAudit',
      ).environmentInvariantIdentitySha256,
      environmentProfileIdentitySha256: record(
        record(input.audit, 'ready audit').contractAudit,
        'ready audit contractAudit',
      ).environmentProfileIdentitySha256,
      sha256: sha256(auditBytes),
      source: 'first_v1_seeded_upgrade_disposable_context',
    },
    expectedCatalog: input.expectedCatalog,
    catalogDriftMatrix: {
      localOwnerProjectionIdentitySha256:
        input.driftMatrix.localOwnerProjection.fullAuditIdentitySha256,
      probeCount: input.driftMatrix.probes.length,
      rejectedCount: input.driftMatrix.probes.filter(({ auditRejected }) => auditRejected).length,
      sha256: sha256(driftMatrixBytes),
    },
    backup: {
      manifestSha256: input.backupManifestSha256,
      v1StateAuthenticatedBeforeSourceRead: true,
    },
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: input.results.bootstrapUpgrade.migrationSha256,
    },
    package: {
      actionCounts: input.package.importPlan.counts,
      directory: PACKAGE_OUTPUT_DIRECTORY,
      importPlanSha256: input.package.importPlan.binding.contentSha256,
      manifestSha256: input.package.manifestSha256,
      sourceArtifactSha256: input.package.verifiedBindings.sourceArtifactSha256,
      sourceAuthorizationSetSha256: input.package.verifiedBindings.sourceAuthorizationSetSha256,
      completeCatalogAuditIdentitySha256:
        input.package.verifiedBindings.completeCatalogAuditIdentitySha256,
      expectedCatalogBindingSha256: input.package.verifiedBindings.expectedCatalogBindingSha256,
    },
    ...(input.productionReadiness
      ? {
          postV2PreImportReadiness: {
            capturePairIdentitySha256: input.productionReadiness.capturePair.pairIdentitySha256,
            compensationAuthorized: false,
            importAuthorized: false,
            packageReadinessIdentitySha256: input.productionReadiness.readinessIdentitySha256,
          },
        }
      : {}),
    protectedRuntimeBundle: operatorBundleBinding,
    repository: {
      branch: repositoryEvidence.branch,
      cleanTrackedAndUntrackedWorktree: repositoryEvidence.cleanTrackedAndUntrackedWorktree,
      headSha: repositoryEvidence.headSha,
      originMainIsAncestor: repositoryEvidence.originMainIsAncestor,
    },
    rehearsals: {
      bootstrap: {
        evidenceMatchesRepeatedUpgrade: true,
        migrationPath: 'upgrade',
        packageGeneratedInContext: true,
      },
      fresh: {
        canonicalEvidenceSha256: sha256(freshEvidence),
        completeRuns: 2,
        deterministic: true,
        postV2ProjectedSeedMatchedUpgrade: true,
      },
      upgrade: {
        canonicalEvidenceSha256: sha256(upgradeEvidence),
        completeRuns: 2,
        deterministic: true,
        preV1SeedLoadedAtHistoricalBoundary: true,
        schemaOnlyV1StateBracketed: true,
      },
    },
    safety: {
      allFourContainersRemovedAndVerifiedAbsent: true,
      callerDatabaseTargetAccepted: false,
      heldOutIdentitiesAccessed: false,
      realLocalDatabaseMutated: false,
      realLocalReadOnlyVerified: input.productionReadiness !== undefined,
      remoteDatabaseTouched: false,
      sourceReadOnlyAfterV2BootstrapProbe: true,
    },
    schemaVersion: EXACT_V2_PACKAGE_REHEARSAL_REPORT_SCHEMA_VERSION,
    status: 'passed',
  })
  const files = new Map<string, Buffer>([
    ['disposable-v2-catalog-drift-matrix.json', driftMatrixBytes],
    ['disposable-v2-complete-catalog-audit.json', completeCatalogAuditBytes],
    ['disposable-v2-exact-catalog-binding.json', prettyCanonical(input.expectedCatalog)],
    ['disposable-v2-ready-audit.json', auditBytes],
    ['exact-package-rehearsal-report-v2.json', prettyCanonical(report)],
    ['fresh-v2-rehearsal-evidence.json', freshEvidence],
    ['protected-v2-runtime-bundle-binding.json', prettyCanonical(operatorBundleBinding)],
    ['upgrade-v2-rehearsal-evidence.json', upgradeEvidence],
  ])
  if (
    canonicalJson([...files.keys()].sort((left, right) => left.localeCompare(right, 'en'))) !==
    canonicalJson([...CANONICAL_OUTPUT_NAMES])
  ) {
    throw new Error('Canonical V2 rehearsal output inventory drifted.')
  }
  return { files, manifest: canonicalManifest(files), report }
}

interface ExactV2PackageRehearsalCoreDependencies {
  assertCurrentProductionReadiness?(): Promise<GoldImportV2FixedLocalState>
  buildOperatorBundle(): Promise<ProtectedV2OperatorBundle>
  completeRehearsal: CompleteV2RehearsalDependencies
  loadPreMigrationBackup(
    directory: string,
    trustedManifestSha256: string,
  ): Promise<LoadedPreMigrationBackup>
  readCurrentRepositoryEvidence(): Promise<V2RehearsalRepositoryEvidence>
  productionReadiness?: GoldImportV2PackageGenerationReadiness
  productionFixedLocalState?: GoldImportV2FixedLocalState
  repositoryEvidence: V2RehearsalRepositoryEvidence
}

export interface ExactV2PackageRehearsalResult {
  freshEvidenceSha256: string
  migrationSha256: string
  outputDirectory: string
  packageDirectory: string
  packageManifestSha256: string
  upgradeEvidenceSha256: string
}

function emptyExactV2PackageRehearsalResult(): ExactV2PackageRehearsalResult {
  return {
    freshEvidenceSha256: '',
    migrationSha256: '',
    outputDirectory: '',
    packageDirectory: '',
    packageManifestSha256: '',
    upgradeEvidenceSha256: '',
  }
}

/**
 * Branch-agnostic orchestration core. Every repository and disposable-execution
 * capability is explicit; production callers must use runExactPackageRehearsalV2Cli.
 */
async function runExactPackageRehearsalV2WithDependencies(
  argv: readonly string[],
  dependencies: ExactV2PackageRehearsalCoreDependencies,
): Promise<ExactV2PackageRehearsalResult> {
  const arguments_ = parseExactV2PackageRehearsalCliArguments(argv)
  if (arguments_.flags.has('help')) {
    console.log(HELP)
    return emptyExactV2PackageRehearsalResult()
  }
  const repositoryEvidence = validateV2RehearsalRepositoryEvidence(dependencies.repositoryEvidence)
  const commitSha = repositoryEvidence.headSha
  const rawOutputRoot = requiredArgument(arguments_, 'output-root')
  const rawOutputDirectory = requiredArgument(arguments_, 'output')
  assertSafeOutputPathArgument(rawOutputRoot, '--output-root')
  assertSafeOutputPathArgument(rawOutputDirectory, '--output')
  const outputRoot = resolve(rawOutputRoot)
  const outputDirectory = resolve(rawOutputDirectory)
  const migrationPath = resolve(requiredArgument(arguments_, 'migration'))
  if (basename(migrationPath) !== MIGRATION_FILENAME) {
    throw new Error(`--migration must name the exact ${MIGRATION_FILENAME} file.`)
  }

  const trustedBackupManifestSha256 = requiredArgument(
    arguments_,
    'pre-migration-backup-manifest-sha256',
  )
  const backup = await dependencies.loadPreMigrationBackup(
    resolve(requiredArgument(arguments_, 'pre-migration-backup')),
    trustedBackupManifestSha256,
  )
  const seed = authenticatedSeedFromBackup(backup, trustedBackupManifestSha256)
  const operatorBundle = await dependencies.buildOperatorBundle()
  const operatorBundleBinding = buildProtectedV2RuntimeBundleBinding(operatorBundle)
  const expectedCatalog = buildProtectedV2ExpectedCatalogBinding(
    'supabase_admin_owner_v1',
    'disposable',
  )
  assertProtectedV2ExpectedCatalogArtifactSealed({
    binding: expectedCatalog,
    bundle: operatorBundle,
    profileId: 'supabase_admin_owner_v1',
    target: 'disposable',
  })
  const expectedCompleteCatalogAudit =
    validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
      expectedObservedAuditIdentityFromArtifact(
        committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
          'supabase_admin_owner_v1',
          'disposable',
        ),
      ),
      'supabase_admin_owner_v1',
      'disposable',
    )
  const sourcePaths = {
    amendedAuthorization: resolve(requiredArgument(arguments_, 'amended-authorization')),
    amendedAuthorizationExactText: resolve(
      requiredArgument(arguments_, 'amended-authorization-exact-text'),
    ),
    artifact: resolve(requiredArgument(arguments_, 'artifact')),
    authorizationManifest: resolve(requiredArgument(arguments_, 'authorization-manifest')),
    authorizationMapping: resolve(requiredArgument(arguments_, 'authorization-mapping')),
    authorizationMappingCorrection: resolve(
      requiredArgument(arguments_, 'authorization-mapping-correction'),
    ),
    authorizationMappingCorrectionManifest: resolve(
      requiredArgument(arguments_, 'authorization-mapping-correction-manifest'),
    ),
    migration: migrationPath,
    noteDispositionAudit: resolve(requiredArgument(arguments_, 'note-disposition-audit')),
    planningState: resolve(requiredArgument(arguments_, 'planning-state')),
    protocolAuthorization: resolve(requiredArgument(arguments_, 'protocol-authorization')),
  }
  let sourceReadCount = 0
  const controller = createBootstrappedExactPackageDatabaseExecutorV2({
    readSources: async (): Promise<V2ExactPackageBootstrapSources> => {
      sourceReadCount += 1
      const [
        amendedAuthorizationBytes,
        amendedAuthorizationExactTextBytes,
        authorizationManifestBytes,
        authorizationMappingBytes,
        authorizationMappingCorrectionBytes,
        authorizationMappingCorrectionManifestBytes,
        finalArtifactBytes,
        migrationBytes,
        noteDispositionAuditBytes,
        planningStateBytes,
        signedProtocolAuthorizationBytes,
      ] = await Promise.all([
        readRegularNonSymlinkFile(sourcePaths.amendedAuthorization, 'Amended authorization'),
        readRegularNonSymlinkFile(
          sourcePaths.amendedAuthorizationExactText,
          'Exact amended authorization text',
        ),
        readRegularNonSymlinkFile(sourcePaths.authorizationManifest, 'Authorization manifest'),
        readRegularNonSymlinkFile(sourcePaths.authorizationMapping, 'Authorization mapping'),
        readRegularNonSymlinkFile(
          sourcePaths.authorizationMappingCorrection,
          'Authorization mapping correction',
        ),
        readRegularNonSymlinkFile(
          sourcePaths.authorizationMappingCorrectionManifest,
          'Authorization mapping correction manifest',
        ),
        readRegularNonSymlinkFile(sourcePaths.artifact, 'Finalized V3 artifact'),
        readRegularNonSymlinkFile(sourcePaths.migration, 'V2 migration'),
        readRegularNonSymlinkFile(sourcePaths.noteDispositionAudit, 'Note disposition audit'),
        readRegularNonSymlinkFile(sourcePaths.planningState, 'Development planning state'),
        readRegularNonSymlinkFile(
          sourcePaths.protocolAuthorization,
          'Signed protocol authorization',
        ),
      ])
      return {
        developmentPlanningState: parseJson(planningStateBytes, 'Development planning state'),
        repositoryCommitSha: commitSha,
        sources: {
          amendedAuthorizationBytes,
          amendedAuthorizationExactTextBytes,
          authorizationManifestBytes,
          authorizationMappingBytes,
          authorizationMappingCorrectionBytes,
          authorizationMappingCorrectionManifestBytes,
          finalArtifactBytes,
          migrationBytes,
          noteDispositionAudit: parseJson(noteDispositionAuditBytes, 'Note disposition audit'),
          signedProtocolAuthorizationBytes,
        },
      }
    },
  })
  const results = await executeCompleteV2Rehearsal({
    dependencies: dependencies.completeRehearsal,
    exactPackageExecutor: controller.executor,
    evidenceBindings: {
      completeCatalogAudit: expectedCompleteCatalogAudit,
      expectedCatalog,
      operatorBundle,
      operatorBundleBinding,
    },
    seed,
  })
  if (controller.generatedPackageCount() !== 4 || sourceReadCount !== 4) {
    throw new Error('Every bootstrap/repetition did not independently regenerate the V2 package.')
  }
  assertV2RehearsalRepositoryEvidenceUnchangedInternal(
    repositoryEvidence,
    await dependencies.readCurrentRepositoryEvidence(),
  )
  const package_ = controller.referencePackage()
  const audit = controller.referenceAudit()
  const completeCatalogAudit = controller.referenceCompleteCatalogAudit()
  if (canonicalJson(completeCatalogAudit) !== canonicalJson(expectedCompleteCatalogAudit)) {
    throw new Error('Observed disposable catalog audit differs from its committed expectation.')
  }
  const driftMatrix = await runProtectedV2DisposableCatalogDriftMatrix({
    migrationReceiptGate: controller.referenceMigrationReceiptGate(),
    package: package_,
    seed,
  })
  if (dependencies.productionReadiness) {
    validateGoldImportV2PackageGenerationReadiness(dependencies.productionReadiness)
    if (!dependencies.assertCurrentProductionReadiness || !dependencies.productionFixedLocalState) {
      throw new Error('Production rehearsal readiness lacks its live publication bracket.')
    }
  } else if (
    dependencies.assertCurrentProductionReadiness ||
    dependencies.productionFixedLocalState
  ) {
    throw new Error('Disposable rehearsal cannot claim a production-readiness recheck.')
  }
  const canonical = buildCanonicalOutputs({
    audit,
    backupManifestSha256: trustedBackupManifestSha256,
    completeCatalogAudit,
    driftMatrix,
    expectedCatalog,
    operatorBundle,
    operatorBundleBinding,
    package: package_,
    productionReadiness: dependencies.productionReadiness,
    repositoryEvidence,
    results,
  })
  const executionPathReceipt = (result: V2DisposablePathResult) => ({
    cleanup: result.cleanup,
    migrationPath: result.migrationPath,
    migrationSha256: result.migrationSha256,
    rawReceipt: result.rawReceipt,
  })
  const rawReceipt = prettyCanonical({
    authorizationBindings: {
      completeCatalogAudit,
      expectedCatalog,
      operatorBundleBinding,
    },
    bootstrapUpgradeRunIndex: 1,
    canonicalManifestExcludedVolatileReceipt: true,
    fresh: results.fresh.map(executionPathReceipt),
    packageGenerationCount: controller.generatedPackageCount(),
    catalogDriftProbeCount: driftMatrix.probes.length,
    localOwnerCatalogProjectionPassed: true,
    schemaVersion: 'gold-import-compensation-exact-package-rehearsal-execution/2.0.0',
    sourceReadCount,
    upgrade: results.upgrade.map(executionPathReceipt),
  })

  // Nothing is published until all four owned containers have been removed and
  // their independent exact-name/ID absence checks have passed. Every slow file
  // is first written beneath a hidden same-parent staging directory.
  const stageOutputs = async (): Promise<StagedExclusiveOutputDirectory> => {
    const staged = await createStagedExclusiveOutputDirectory({
      outputDirectory,
      outputRoot,
      stagingNonce: randomBytes(32).toString('hex'),
    })
    const stagedPackageDirectory = resolve(staged.stagingDirectory, PACKAGE_OUTPUT_DIRECTORY)
    const packageOutput = await createExclusiveOutputDirectory({
      outputDirectory: stagedPackageDirectory,
      outputRoot: staged.stagingDirectory,
    })
    writeExclusiveOutputFiles(
      packageOutput,
      [...package_.files.entries()].map(([name, bytes]) => ({ bytes, name })),
    )
    await assertExclusiveOutputDirectoryIdentity(packageOutput)
    writeExclusiveOutputFiles(staged.identity, [
      ...[...canonical.files.entries()].map(([name, bytes]) => ({ bytes, name })),
      { bytes: rawReceipt, name: 'execution-receipt-v2.json' },
    ])
    await assertExclusiveOutputDirectoryIdentity(staged.identity)
    return staged
  }
  const stagedPayloadSha256 = sha256Canonical({
    canonicalManifestSha256: sha256(canonical.manifest),
    executionReceiptSha256: sha256(rawReceipt),
    packageManifestSha256: package_.manifestSha256,
  })
  if (dependencies.productionReadiness) {
    const productionReadiness = dependencies.productionReadiness
    const productionFixedLocalState = dependencies.productionFixedLocalState!
    await runGoldImportV2DatabasePublicationProtocol<StagedExclusiveOutputDirectory, string>({
      discard: discardStagedExclusiveOutputDirectory,
      finalize: async (staged, bracket) => {
        const bracketBytes = prettyCanonical(bracket)
        const productionManifest = canonicalManifest(
          new Map([
            ...canonical.files,
            [PRODUCTION_REHEARSAL_PUBLICATION_BRACKET_FILE, bracketBytes] as const,
          ]),
        )
        writeExclusiveOutputFiles(staged.identity, [
          { bytes: bracketBytes, name: PRODUCTION_REHEARSAL_PUBLICATION_BRACKET_FILE },
          { bytes: productionManifest, name: 'canonical-manifest-v2.sha256' },
        ])
        await assertExclusiveOutputDirectoryIdentity(staged.identity)
      },
      initial: buildGoldImportV2DatabasePublicationObservationBinding({
        packageReadiness: productionReadiness.packageReadiness,
        targetObservation: productionFixedLocalState.targetObservation,
      }),
      now: () => new Date(),
      observeFinal: async () => {
        const finalFixedLocalState = await dependencies.assertCurrentProductionReadiness!()
        return buildGoldImportV2DatabasePublicationObservationBinding({
          packageReadiness: productionReadiness.packageReadiness,
          targetObservation: finalFixedLocalState.targetObservation,
        })
      },
      publish: async (staged) => {
        await publishStagedExclusiveOutputDirectory(staged)
        return outputDirectory
      },
      stage: async () => ({
        staged: await stageOutputs(),
        stagedAt: new Date().toISOString(),
        stagedPayloadSha256,
      }),
      subject: 'production_rehearsal',
    })
  } else {
    const staged = await stageOutputs()
    try {
      writeExclusiveOutputFiles(staged.identity, [
        { bytes: canonical.manifest, name: 'canonical-manifest-v2.sha256' },
      ])
      await assertExclusiveOutputDirectoryIdentity(staged.identity)
      await publishStagedExclusiveOutputDirectory(staged)
    } catch (error) {
      await discardStagedExclusiveOutputDirectory(staged)
      throw error
    }
  }

  const packageDirectory = resolve(outputDirectory, PACKAGE_OUTPUT_DIRECTORY)

  const freshEvidence = canonical.files.get('fresh-v2-rehearsal-evidence.json')!
  const upgradeEvidence = canonical.files.get('upgrade-v2-rehearsal-evidence.json')!
  return {
    freshEvidenceSha256: sha256(freshEvidence),
    migrationSha256: results.bootstrapUpgrade.migrationSha256,
    outputDirectory,
    packageDirectory,
    packageManifestSha256: package_.manifestSha256,
    upgradeEvidenceSha256: sha256(upgradeEvidence),
  }
}

/** Production-only wrapper: exact primary checkout, clean main, HEAD === origin/main. */
async function runExactPackageRehearsalV2Cli(
  argv: readonly string[],
): Promise<ExactV2PackageRehearsalResult> {
  if (
    REPOSITORY_ROOT !== GOLD_IMPORT_V2_PRIMARY_CHECKOUT ||
    EXECUTING_MODULE_PATH !== EXPECTED_PRODUCTION_MODULE_PATH ||
    realpathSync(process.cwd()) !== REPOSITORY_ROOT ||
    !process.argv[1] ||
    realpathSync(resolve(process.argv[1])) !== EXECUTING_MODULE_PATH
  ) {
    throw new Error(
      'V2 rehearsal must execute directly from its exact primary-checkout entrypoint.',
    )
  }
  const arguments_ = parseExactV2PackageRehearsalCliArguments(argv)
  if (arguments_.flags.has('help')) {
    console.log(HELP)
    return emptyExactV2PackageRehearsalResult()
  }
  const captureDirectories = [
    requiredArgument(arguments_, 'preimport-capture-one'),
    requiredArgument(arguments_, 'preimport-capture-two'),
  ] as const
  const initial = await loadProductionV2RehearsalReadiness({ captureDirectories })
  return runExactPackageRehearsalV2WithDependencies(argv, {
    assertCurrentProductionReadiness: async () => {
      const current = await loadProductionV2RehearsalReadiness({ captureDirectories })
      if (
        canonicalJson(current.readiness) !== canonicalJson(initial.readiness) ||
        canonicalJson(current.repositoryEvidence) !== canonicalJson(initial.repositoryEvidence)
      ) {
        throw new Error(
          'Post-V2 capture pair, fixed-local state, receipt, runtime, or repository changed during rehearsal.',
        )
      }
      return current.fixedLocalState
    },
    buildOperatorBundle: () => buildProtectedV2OperatorBundle({ cwd: REPOSITORY_ROOT }),
    completeRehearsal: PRODUCTION_COMPLETE_REHEARSAL_DEPENDENCIES,
    loadPreMigrationBackup: loadAndVerifyBackup,
    productionReadiness: initial.readiness,
    productionFixedLocalState: initial.fixedLocalState,
    readCurrentRepositoryEvidence: readProductionV2RehearsalRepositoryEvidence,
    repositoryEvidence: initial.repositoryEvidence,
  })
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runExactPackageRehearsalV2Cli(process.argv.slice(2))
    .then((result) => {
      if (result.outputDirectory) console.log(`${JSON.stringify(result, null, 2)}\n`)
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
