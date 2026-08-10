import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

import {
  bindCompensationPlanV2,
  parseCompensationReceiptV2,
  parseImportPlanV2,
  parseImportReceiptV2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import { validateReadyGoldImportCompensationV2Audit } from './audit-gold-import-compensation-v2'
import {
  buildCompensationTemplateV2,
  verifyGoldImportCompensationPackageV2IntrinsicFiles,
} from './generate-gold-import-compensation-package-v2'
import {
  GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES,
  isGoldImportContractV2Phase10EvidenceName,
  serializeGoldImportContractV2Phase10EvidenceSummary,
  validateGoldImportContractV2Phase10EvidenceSummary,
  type GoldImportContractV2Phase10EvidenceName,
  type GoldImportContractV2Phase10EvidenceSummary,
} from './gold-import-contract-v2-phase10-evidence'
import {
  canonicalJson,
  sha256ContractCanonical,
} from './gold-import-compensation-migration-operations'
import {
  assertDevelopmentSeedScope,
  deriveDevelopmentSeedV2SchemaSnapshot,
  developmentDatabaseSeedScopeSchema,
  type DevelopmentSeedV2SchemaSnapshot,
} from './gold-import-compensation-development-seed'
import { protectedV2ProductionCohortRowsSha256FromImportPlan } from './gold-import-compensation-v2-cohort-identity'
import {
  PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION,
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  expectedObservedAuditIdentityFromArtifact,
  parseProtectedV2CatalogExpectedArtifact,
} from './gold-import-contract-v2-catalog-expectations'
import { validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile } from './gold-import-contract-v2-catalog-audit'
import { validateGoldImportSourceAuthorizationSetV4 } from './gold-import-source-authorization-v4'
import { validateCanonicalV2RehearsalEvidence } from './gold-import-compensation-rehearsal-evidence-v2'
import {
  assertProtectedV2ExpectedCatalogArtifactSealed,
  buildProtectedV2ExpectedCatalogBinding,
  buildProtectedV2RuntimeBundleBinding,
  validateProtectedV2ExpectedCatalogBinding,
  validateProtectedV2RuntimeBundleBinding,
  type ProtectedV2ExpectedCatalogBinding,
  type ProtectedV2RuntimeBundleBinding,
} from './protected-gold-import-contract-v2-bindings'
import {
  buildProtectedV2BackupExecutionReceipt,
  parseProtectedV2BackupExecutionReceipt,
} from './protected-gold-import-contract-v2-evidence'
import {
  PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION,
  validateProtectedV2ModuleResolutionAudit,
} from './protected-gold-import-contract-v2-module-resolution'
import {
  PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION,
  buildProtectedV2OperatorBundle,
  validateProtectedV2OperatorBundle,
  type ProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'
import {
  PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION,
  validateProtectedV2RuntimeInputAudit,
} from './protected-gold-import-contract-v2-runtime-inputs'
import {
  PROTECTED_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION,
  PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS,
} from './protected-gold-import-contract-v2-catalog-drift-identities'

const execFileAsync = promisify(execFile)

export const GOLD_IMPORT_CONTRACT_V2_BACKUP_SCHEMA_VERSION =
  'gold-import-contract-v2-forward-repair-backup/2.0.0' as const
export const GOLD_IMPORT_CONTRACT_V2_BACKUP_RECEIPT_SCHEMA_VERSION =
  'gold-import-contract-v2-forward-repair-backup-execution/2.0.0' as const
export const GOLD_IMPORT_CONTRACT_V2_BRANCH =
  'codex/ip-literature-import-contract-v2-forward-repair-v1' as const
export const GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH =
  'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql' as const
export const GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256 =
  'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528' as const
export const GOLD_IMPORT_CONTRACT_V2_PRE_V1_BACKUP_MANIFEST_SHA256 =
  'f0128fb6ea49b7a8d0c0bf35059d2aebaad3dd8997b83acaa64eef276209dd9d' as const

const COMMIT_PATTERN = /^[a-f0-9]{40}$/u
const EVIDENCE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u
export const GOLD_IMPORT_CONTRACT_V2_CANONICAL_REHEARSAL_SCHEMA_VERSION =
  'gold-import-compensation-disposable-rehearsal-canonical/2.1.0' as const
export const GOLD_IMPORT_CONTRACT_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION =
  PROTECTED_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION
const CATALOG_PROPOSAL_REPORT_SCHEMA_VERSION =
  'literature-gold-protected-v2-catalog-expectation-proposal/1.0.0' as const
const EXACT_PACKAGE_REHEARSAL_REPORT_SCHEMA_VERSION =
  'gold-import-compensation-exact-package-rehearsal/2.0.0' as const
const READY_AUDIT_SCHEMA_VERSION = 'gold-import-compensation-v2-package-audit/1.0.0' as const
const SOURCE_AUTHORIZATION_SCHEMA_VERSION = 'gold-import-source-authorization-set/4.0.0' as const
const PACKAGE_DESCRIPTOR_SCHEMA_VERSION =
  'gold-import-compensation-package-generator/2.0.0' as const
const PREAPPLICATION_REPORT_SCHEMA_VERSION =
  'gold-import-contract-v2-preapplication-report/1.0.0' as const
const GOLD_IMPORT_CONTRACT_VERSION_V2 = 'gold-review-import-compensation/2.0.0' as const
const GOLD_IMPORT_MIGRATION_ID_V2 =
  '20260809231651_add_literature_gold_import_compensation_contract_v2' as const

const REAL_LOCAL_IDENTITIES = Object.freeze({
  developmentMembershipSha256: '73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c',
  developmentPlanningStateSha256:
    '84743faccffca532d3fe6e03bd2d29a44f96790f0004c40ff0c9ed6bba881be5',
  effectiveStateSha256: '8b4f46720b980ec5337edfa448f7d998ddfa6498ec32a8fce5a941589a746a23',
  physicalStateSha256: '3986852c329bb66abf293d499655f2f278ae881801291756c9c1f75cc0351c70',
})

const EXACT_PACKAGE_FILE_NAMES = [
  'ambiguous-outcome-reconciliation-v2.json',
  'append-only-compensation-plan-template-v2.json',
  'boolean-normalization-ledger-v2.json',
  'checksum-manifest-v2.sha256',
  'exact-catalog-binding-v2.json',
  'immutable-atomic-import-plan-v2.json',
  'journal-template-v2.json',
  'note-disposition-proof-v2.json',
  'ordered-set-normalization-ledger-v2.json',
  'package-descriptor-v2.json',
  'proposed-commands-v2.txt',
  'receipt-template-v2.json',
  'source-authorization-set-v4.json',
  'state-hash-proof-v2.json',
  'unsigned-compensation-operation-authorization-template-v2.json',
  'unsigned-import-operation-authorization-template-v2.json',
] as const

export const REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES = [
  'catalog-drift-matrix',
  'catalog-expectations-and-ready-inventories',
  'critic-report',
  'descendant-recovery-evidence',
  'final-pr-body',
  'full-validation-report',
  'merge-readiness-report',
  'module-resolution-evidence',
  'package-rehearsal-evidence',
  'protected-bundle-inventory',
  'real-local-read-only-report',
  'runtime-input-evidence',
  'same-user-recomputation-evidence',
  'sealed-intent-lost-ack-evidence',
  'tests-build-report',
  'trusted-operator-evidence',
] as const

export type RequiredEvidenceName =
  (typeof REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES)[number]

const JSON_REQUIRED_EVIDENCE_NAMES: readonly RequiredEvidenceName[] =
  REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES

interface EvidenceArgument {
  name: string
  source: string
}

interface ParsedArguments {
  evidence: EvidenceArgument[]
  output: string
  outputRoot: string
}

interface CopiedFile {
  bytes: number
  destination: string
  sha256: string
  source: string
}

export interface GoldImportContractV2BackupAuthorization {
  disposableExpectedCatalog: ProtectedV2ExpectedCatalogBinding
  localExpectedCatalog: ProtectedV2ExpectedCatalogBinding
  protectedRuntimeBundle: ProtectedV2RuntimeBundleBinding
}

interface SemanticEvidenceValidation {
  disposableExpectedCatalogBindingSha256: string
  exactCatalogArtifactProfiles: string[]
  jsonDocumentCount: number
  localExpectedCatalogBindingSha256: string
  phase10EvidenceSummarySha256: Record<GoldImportContractV2Phase10EvidenceName, string>
  protectedRuntimeBundleBindingSha256: string
  transientDeliveryAuthorityRejected: true
}

interface BackupRepositoryIdentity {
  branch: string
  head: string
  originMain: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function nestedObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap((entry) => nestedObjects(entry))
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap((entry) => nestedObjects(entry))]
}

function allStringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap((entry) => allStringValues(entry))
  if (!isRecord(value)) return []
  return Object.values(value).flatMap((entry) => allStringValues(entry))
}

function exactJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

function fileByUniqueSuffix(
  files: ReadonlyMap<string, Buffer>,
  suffix: string,
  label: string,
): { bytes: Buffer; name: string } {
  const matches = [...files.entries()].filter(
    ([name]) => name === suffix || name.endsWith(`/${suffix}`),
  )
  if (matches.length !== 1) {
    throw new Error(`${label} requires exactly one ${suffix}; received ${matches.length}.`)
  }
  return { name: matches[0][0], bytes: matches[0][1] }
}

function parseJsonBytes(bytes: Buffer, label: string): unknown {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error(
      `${label} is malformed JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  if (!exactJson(Object.keys(value).sort(), [...expected].sort())) {
    throw new Error(`${label} has unexpected or missing fields.`)
  }
}

function validateExactRehearsalExecutionReceipt(input: {
  completeCatalogAudit: unknown
  driftProbeCount: number
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  migrationSha256: string
  operatorBundleBinding: ProtectedV2RuntimeBundleBinding
  receipt: unknown
}): void {
  const receipt = isRecord(input.receipt) ? input.receipt : {}
  assertExactKeys(
    receipt,
    [
      'authorizationBindings',
      'bootstrapUpgradeRunIndex',
      'canonicalManifestExcludedVolatileReceipt',
      'catalogDriftProbeCount',
      'fresh',
      'localOwnerCatalogProjectionPassed',
      'packageGenerationCount',
      'schemaVersion',
      'sourceReadCount',
      'upgrade',
    ],
    'Exact package rehearsal execution receipt',
  )
  const bindings = isRecord(receipt.authorizationBindings) ? receipt.authorizationBindings : {}
  assertExactKeys(
    bindings,
    ['completeCatalogAudit', 'expectedCatalog', 'operatorBundleBinding'],
    'Exact package rehearsal execution receipt authorization',
  )
  if (
    receipt.schemaVersion !== 'gold-import-compensation-exact-package-rehearsal-execution/2.0.0' ||
    receipt.bootstrapUpgradeRunIndex !== 1 ||
    receipt.canonicalManifestExcludedVolatileReceipt !== true ||
    receipt.catalogDriftProbeCount !== input.driftProbeCount ||
    receipt.localOwnerCatalogProjectionPassed !== true ||
    receipt.packageGenerationCount !== 4 ||
    receipt.sourceReadCount !== 4 ||
    !exactJson(bindings.completeCatalogAudit, input.completeCatalogAudit) ||
    !exactJson(bindings.expectedCatalog, input.expectedCatalog) ||
    !exactJson(bindings.operatorBundleBinding, input.operatorBundleBinding)
  ) {
    throw new Error('Exact package rehearsal execution receipt identity drifted.')
  }
  const containerIds = new Set<string>()
  const containerNames = new Set<string>()
  const validateRuns = (value: unknown, migrationPath: 'fresh' | 'upgrade') => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error(`Exact package rehearsal receipt requires two ${migrationPath} runs.`)
    }
    for (const [index, entry] of value.entries()) {
      const run = isRecord(entry) ? entry : {}
      assertExactKeys(
        run,
        ['cleanup', 'migrationPath', 'migrationSha256', 'rawReceipt'],
        `${migrationPath} execution receipt run ${index + 1}`,
      )
      const cleanup = isRecord(run.cleanup) ? run.cleanup : {}
      assertExactKeys(
        cleanup,
        [
          'absenceChecks',
          'absenceVerification',
          'attempted',
          'containerId',
          'containerName',
          'errors',
          'outcome',
          'removalCommandSucceeded',
        ],
        `${migrationPath} execution cleanup ${index + 1}`,
      )
      const containerId = String(cleanup.containerId ?? '')
      const containerName = String(cleanup.containerName ?? '')
      const absenceChecks = Array.isArray(cleanup.absenceChecks) ? cleanup.absenceChecks : []
      if (
        run.migrationPath !== migrationPath ||
        run.migrationSha256 !== input.migrationSha256 ||
        cleanup.absenceVerification !== 'verified_absent' ||
        cleanup.attempted !== true ||
        cleanup.outcome !== 'removed_and_verified_absent' ||
        cleanup.removalCommandSucceeded !== true ||
        !Array.isArray(cleanup.errors) ||
        cleanup.errors.length !== 0 ||
        containerId.length === 0 ||
        containerName.length === 0 ||
        absenceChecks.length !== 2 ||
        absenceChecks.some(
          (check) =>
            !isRecord(check) ||
            check.present !== false ||
            !['container_id', 'exact_name'].includes(String(check.kind)),
        ) ||
        !absenceChecks.some(
          (check) =>
            isRecord(check) && check.kind === 'container_id' && check.identifier === containerId,
        ) ||
        !absenceChecks.some(
          (check) =>
            isRecord(check) && check.kind === 'exact_name' && check.identifier === containerName,
        )
      ) {
        throw new Error(`Exact package rehearsal ${migrationPath} cleanup is incomplete.`)
      }
      const raw = isRecord(run.rawReceipt) ? run.rawReceipt : {}
      assertExactKeys(
        raw,
        [
          'authorizationBindings',
          'completedAt',
          'databaseMutationOutsideDisposableTarget',
          'disposableRuntime',
          'heldOutIdentitiesAccessed',
          'migrationLedger',
          'migrationPath',
          'realLocalDatabaseTouched',
          'remoteDatabaseTouched',
          'seedMode',
          'startedAt',
        ],
        `${migrationPath} raw execution receipt ${index + 1}`,
      )
      const rawBindings = isRecord(raw.authorizationBindings) ? raw.authorizationBindings : {}
      const ledger = isRecord(raw.migrationLedger) ? raw.migrationLedger : {}
      const runtime = isRecord(raw.disposableRuntime) ? raw.disposableRuntime : {}
      assertExactKeys(
        rawBindings,
        ['authority', 'completeCatalogAudit', 'expectedCatalog', 'operatorBundleBinding'],
        `${migrationPath} raw execution authorization ${index + 1}`,
      )
      assertExactKeys(ledger, ['v1', 'v2'], `${migrationPath} raw migration ledger ${index + 1}`)
      assertExactKeys(
        runtime,
        [
          'automaticallyAssignedPort',
          'containerId',
          'containerName',
          'dockerContext',
          'dockerEndpoint',
          'host',
          'image',
        ],
        `${migrationPath} disposable runtime ${index + 1}`,
      )
      const expectedSeedMode =
        migrationPath === 'fresh' ? 'migration_equivalent_post_v2_projection' : 'exact_pre_v1'
      if (
        rawBindings.authority !==
          'exact_committed_disposable_catalog_and_protected_runtime_bundle' ||
        !exactJson(rawBindings.completeCatalogAudit, input.completeCatalogAudit) ||
        !exactJson(rawBindings.expectedCatalog, input.expectedCatalog) ||
        !exactJson(rawBindings.operatorBundleBinding, input.operatorBundleBinding) ||
        raw.databaseMutationOutsideDisposableTarget !== false ||
        raw.heldOutIdentitiesAccessed !== false ||
        raw.realLocalDatabaseTouched !== false ||
        raw.remoteDatabaseTouched !== false ||
        raw.migrationPath !== migrationPath ||
        raw.seedMode !== expectedSeedMode ||
        ledger.v1 !== 1 ||
        ledger.v2 !== 1 ||
        !Number.isFinite(Date.parse(String(raw.startedAt ?? ''))) ||
        !Number.isFinite(Date.parse(String(raw.completedAt ?? ''))) ||
        runtime.containerId !== containerId ||
        runtime.containerName !== containerName ||
        runtime.host !== '127.0.0.1' ||
        !Number.isSafeInteger(runtime.automaticallyAssignedPort) ||
        Number(runtime.automaticallyAssignedPort) <= 0 ||
        typeof runtime.dockerContext !== 'string' ||
        runtime.dockerContext.length === 0 ||
        typeof runtime.dockerEndpoint !== 'string' ||
        !/^(?:unix|npipe):\/\//u.test(runtime.dockerEndpoint) ||
        runtime.image !==
          'public.ecr.aws/supabase/postgres:17.6.1.104@sha256:5deba92e50cd17bfacf8603834d317cdf3bfc1c016ec8293991997fa3b55fa3d'
      ) {
        throw new Error(`Exact package rehearsal ${migrationPath} runtime receipt drifted.`)
      }
      containerIds.add(containerId)
      containerNames.add(containerName)
    }
  }
  validateRuns(receipt.fresh, 'fresh')
  validateRuns(receipt.upgrade, 'upgrade')
  if (containerIds.size !== 4 || containerNames.size !== 4) {
    throw new Error('Exact package rehearsal executions did not use four distinct containers.')
  }
}

function validateExactPackageRehearsalReport(input: {
  authorization: GoldImportContractV2BackupAuthorization
  canonicalFiles: ReadonlyMap<string, Buffer>
  completeCatalogAudit: ReturnType<
    typeof validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile
  >
  descriptor: Record<string, unknown>
  importPlan: ReturnType<typeof parseImportPlanV2>
  packageFiles: ReadonlyMap<string, Buffer>
  readyAudit: ReturnType<typeof validateReadyGoldImportCompensationV2Audit>
  report: unknown
  repository: BackupRepositoryIdentity
  sourceAuthorization: ReturnType<typeof validateGoldImportSourceAuthorizationSetV4>
}): void {
  const report = isRecord(input.report) ? input.report : {}
  assertExactKeys(
    report,
    [
      'audit',
      'backup',
      'catalogDriftMatrix',
      'contractVersion',
      'expectedCatalog',
      'migration',
      'package',
      'protectedRuntimeBundle',
      'rehearsals',
      'repository',
      'safety',
      'schemaVersion',
      'status',
    ],
    'Exact package rehearsal report',
  )
  const audit = isRecord(report.audit) ? report.audit : {}
  const backup = isRecord(report.backup) ? report.backup : {}
  const catalog = isRecord(report.catalogDriftMatrix) ? report.catalogDriftMatrix : {}
  const migration = isRecord(report.migration) ? report.migration : {}
  const package_ = isRecord(report.package) ? report.package : {}
  const repository = isRecord(report.repository) ? report.repository : {}
  const rehearsals = isRecord(report.rehearsals) ? report.rehearsals : {}
  const bootstrap = isRecord(rehearsals.bootstrap) ? rehearsals.bootstrap : {}
  const fresh = isRecord(rehearsals.fresh) ? rehearsals.fresh : {}
  const upgrade = isRecord(rehearsals.upgrade) ? rehearsals.upgrade : {}
  const safety = isRecord(report.safety) ? report.safety : {}
  assertExactKeys(
    audit,
    [
      'completeCatalogAuditIdentitySha256',
      'completeCatalogAuditModelIdentitySha256',
      'environmentInvariantIdentitySha256',
      'environmentProfileIdentitySha256',
      'sha256',
      'source',
    ],
    'Exact package rehearsal report audit',
  )
  assertExactKeys(
    catalog,
    ['localOwnerProjectionIdentitySha256', 'probeCount', 'rejectedCount', 'sha256'],
    'Exact package rehearsal report catalog drift matrix',
  )
  assertExactKeys(
    backup,
    ['manifestSha256', 'v1StateAuthenticatedBeforeSourceRead'],
    'Exact package rehearsal report backup',
  )
  assertExactKeys(migration, ['id', 'sha256'], 'Exact package rehearsal report migration')
  assertExactKeys(
    package_,
    [
      'actionCounts',
      'completeCatalogAuditIdentitySha256',
      'directory',
      'expectedCatalogBindingSha256',
      'importPlanSha256',
      'manifestSha256',
      'sourceArtifactSha256',
      'sourceAuthorizationSetSha256',
    ],
    'Exact package rehearsal report package',
  )
  assertExactKeys(
    repository,
    ['branch', 'cleanTrackedAndUntrackedWorktree', 'headSha', 'originMainIsAncestor'],
    'Exact package rehearsal report repository',
  )
  assertExactKeys(
    rehearsals,
    ['bootstrap', 'fresh', 'upgrade'],
    'Exact package rehearsal report rehearsals',
  )
  assertExactKeys(
    bootstrap,
    ['evidenceMatchesRepeatedUpgrade', 'migrationPath', 'packageGeneratedInContext'],
    'Exact package rehearsal report bootstrap',
  )
  assertExactKeys(
    fresh,
    [
      'canonicalEvidenceSha256',
      'completeRuns',
      'deterministic',
      'postV2ProjectedSeedMatchedUpgrade',
    ],
    'Exact package rehearsal report fresh path',
  )
  assertExactKeys(
    upgrade,
    [
      'canonicalEvidenceSha256',
      'completeRuns',
      'deterministic',
      'preV1SeedLoadedAtHistoricalBoundary',
      'schemaOnlyV1StateBracketed',
    ],
    'Exact package rehearsal report upgrade path',
  )
  assertExactKeys(
    safety,
    [
      'allFourContainersRemovedAndVerifiedAbsent',
      'callerDatabaseTargetAccepted',
      'heldOutIdentitiesAccessed',
      'realLocalDatabaseTouched',
      'remoteDatabaseTouched',
      'sourceReadOnlyAfterV2BootstrapProbe',
    ],
    'Exact package rehearsal report safety',
  )

  const readyBytes = input.canonicalFiles.get('disposable-v2-ready-audit.json')!
  const auditBytes = input.canonicalFiles.get('disposable-v2-complete-catalog-audit.json')!
  const bindingBytes = input.canonicalFiles.get('disposable-v2-exact-catalog-binding.json')!
  const driftBytes = input.canonicalFiles.get('disposable-v2-catalog-drift-matrix.json')!
  const runtimeBytes = input.canonicalFiles.get('protected-v2-runtime-bundle-binding.json')!
  if (
    !exactJson(parseJsonBytes(readyBytes, 'Canonical ready audit'), input.readyAudit) ||
    !exactJson(
      parseJsonBytes(auditBytes, 'Canonical complete catalog audit'),
      input.completeCatalogAudit,
    ) ||
    !exactJson(
      parseJsonBytes(bindingBytes, 'Canonical exact catalog binding'),
      input.authorization.disposableExpectedCatalog,
    ) ||
    !exactJson(
      parseJsonBytes(runtimeBytes, 'Canonical protected runtime binding'),
      input.authorization.protectedRuntimeBundle,
    )
  ) {
    throw new Error('Exact package rehearsal canonical A/B/audit sibling files differ.')
  }
  const drift = isRecord(parseJsonBytes(driftBytes, 'Canonical catalog drift matrix'))
    ? (parseJsonBytes(driftBytes, 'Canonical catalog drift matrix') as Record<string, unknown>)
    : {}
  const probes = Array.isArray(drift.probes) ? drift.probes : []
  const localProjection = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    drift.localOwnerProjection,
    'local_supabase_postgres_owner_v1',
    'local',
  )
  const exactDisposable = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    drift.exactReadyDisposable,
    'supabase_admin_owner_v1',
    'disposable',
  )
  if (
    drift.schemaVersion !== GOLD_IMPORT_CONTRACT_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION ||
    drift.probeCount !== probes.length ||
    !exactJson(
      probes.map((probe) => (isRecord(probe) ? probe.id : null)),
      PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS,
    ) ||
    probes.some(
      (probe) => !isRecord(probe) || probe.auditRejected !== true || probe.cleanupVerified !== true,
    ) ||
    !exactJson(exactDisposable, input.completeCatalogAudit)
  ) {
    throw new Error('Exact package rehearsal canonical drift matrix is not authoritative.')
  }
  const packageManifestBytes = fileByUniqueSuffix(
    input.packageFiles,
    'exact-package-v2/checksum-manifest-v2.sha256',
    'Exact package rehearsal report',
  ).bytes
  const sourceAuthorizationBytes = fileByUniqueSuffix(
    input.packageFiles,
    'exact-package-v2/source-authorization-set-v4.json',
    'Exact package rehearsal report',
  ).bytes
  if (
    report.schemaVersion !== EXACT_PACKAGE_REHEARSAL_REPORT_SCHEMA_VERSION ||
    report.status !== 'passed' ||
    report.contractVersion !== GOLD_IMPORT_CONTRACT_VERSION_V2 ||
    !exactJson(report.expectedCatalog, input.authorization.disposableExpectedCatalog) ||
    !exactJson(report.protectedRuntimeBundle, input.authorization.protectedRuntimeBundle) ||
    audit.completeCatalogAuditIdentitySha256 !==
      input.completeCatalogAudit.fullAuditIdentitySha256 ||
    audit.completeCatalogAuditModelIdentitySha256 !==
      input.completeCatalogAudit.auditModelIdentitySha256 ||
    audit.environmentInvariantIdentitySha256 !==
      input.readyAudit.contractAudit.environmentInvariantIdentitySha256 ||
    audit.environmentProfileIdentitySha256 !==
      input.readyAudit.contractAudit.environmentProfileIdentitySha256 ||
    audit.sha256 !== sha256(readyBytes) ||
    audit.source !== 'first_v1_seeded_upgrade_disposable_context' ||
    catalog.localOwnerProjectionIdentitySha256 !== localProjection.fullAuditIdentitySha256 ||
    catalog.probeCount !== probes.length ||
    catalog.rejectedCount !== probes.length ||
    catalog.sha256 !== sha256(driftBytes) ||
    backup.manifestSha256 !== GOLD_IMPORT_CONTRACT_V2_PRE_V1_BACKUP_MANIFEST_SHA256 ||
    backup.v1StateAuthenticatedBeforeSourceRead !== true ||
    migration.id !== GOLD_IMPORT_MIGRATION_ID_V2 ||
    migration.sha256 !== input.authorization.disposableExpectedCatalog.migration.sha256 ||
    !exactJson(package_.actionCounts, input.importPlan.counts) ||
    package_.directory !== 'exact-package-v2' ||
    package_.importPlanSha256 !== input.importPlan.binding.contentSha256 ||
    package_.manifestSha256 !== sha256(packageManifestBytes) ||
    package_.sourceArtifactSha256 !== input.sourceAuthorization.finalArtifactSha256 ||
    package_.sourceAuthorizationSetSha256 !== sha256(sourceAuthorizationBytes) ||
    package_.completeCatalogAuditIdentitySha256 !==
      input.completeCatalogAudit.fullAuditIdentitySha256 ||
    package_.expectedCatalogBindingSha256 !==
      input.authorization.disposableExpectedCatalog.bindingSha256 ||
    input.descriptor.importPlanSha256 !== input.importPlan.binding.contentSha256 ||
    input.descriptor.sourceAuthorizationSetSha256 !== sha256(sourceAuthorizationBytes) ||
    repository.branch !== input.repository.branch ||
    repository.headSha !== input.repository.head ||
    repository.cleanTrackedAndUntrackedWorktree !== true ||
    repository.originMainIsAncestor !== true ||
    bootstrap.evidenceMatchesRepeatedUpgrade !== true ||
    bootstrap.migrationPath !== 'upgrade' ||
    bootstrap.packageGeneratedInContext !== true ||
    fresh.canonicalEvidenceSha256 !==
      sha256(input.canonicalFiles.get('fresh-v2-rehearsal-evidence.json')!) ||
    fresh.completeRuns !== 2 ||
    fresh.deterministic !== true ||
    fresh.postV2ProjectedSeedMatchedUpgrade !== true ||
    upgrade.canonicalEvidenceSha256 !==
      sha256(input.canonicalFiles.get('upgrade-v2-rehearsal-evidence.json')!) ||
    upgrade.completeRuns !== 2 ||
    upgrade.deterministic !== true ||
    upgrade.preV1SeedLoadedAtHistoricalBoundary !== true ||
    upgrade.schemaOnlyV1StateBracketed !== true ||
    safety.allFourContainersRemovedAndVerifiedAbsent !== true ||
    safety.callerDatabaseTargetAccepted !== false ||
    safety.heldOutIdentitiesAccessed !== false ||
    safety.realLocalDatabaseTouched !== false ||
    safety.remoteDatabaseTouched !== false ||
    safety.sourceReadOnlyAfterV2BootstrapProbe !== true
  ) {
    throw new Error('Exact package rehearsal report is incomplete or cross-bound incorrectly.')
  }
}

const REAL_LOCAL_CAPTURE_FILE_NAMES = [
  'checksum-manifest.sha256',
  'development-database-seed.json',
  'execution-receipt.json',
  'pre-application-report.json',
  'pre-application-report.md',
  'protected-migration-ledger.json',
  'state-hashes.json',
] as const

const REAL_LOCAL_CANONICAL_FILE_NAMES = [
  'development-database-seed.json',
  'pre-application-report.json',
  'pre-application-report.md',
  'protected-migration-ledger.json',
  'state-hashes.json',
] as const

interface ValidatedRealLocalCaptureEvidence {
  backupInstanceIds: string[]
  captureManifestSha256s: string[]
  captureReceiptSha256s: string[]
  executionNonces: string[]
  outputDirectories: string[]
  preV2Snapshot: DevelopmentSeedV2SchemaSnapshot
}

function validateRealLocalCaptureEvidence(input: {
  authorization: GoldImportContractV2BackupAuthorization
  files: ReadonlyMap<string, Buffer>
  operatorBundle: ProtectedV2OperatorBundle
  repository: BackupRepositoryIdentity
}): ValidatedRealLocalCaptureEvidence {
  const receiptEntries = [...input.files.keys()].filter(
    (name) => basename(name) === 'execution-receipt.json',
  )
  if (receiptEntries.length !== 2) {
    throw new Error('Real-local evidence requires exactly two capture directories.')
  }
  const prefixes = receiptEntries.map((name) => {
    const prefix = dirname(name)
    return prefix === '.' ? '' : prefix
  })
  if (
    new Set(prefixes).size !== 2 ||
    prefixes.some((prefix, index) =>
      prefixes.some(
        (other, otherIndex) =>
          index !== otherIndex &&
          (prefix === '' || other === prefix || other.startsWith(`${prefix}/`)),
      ),
    )
  ) {
    throw new Error('Real-local capture directories must be distinct non-overlapping roots.')
  }
  const claimedFiles = new Set<string>()
  const instanceIds = new Set<string>()
  const executionNonces = new Set<string>()
  const outputDirectories = new Set<string>()
  const captureManifestSha256s: string[] = []
  const captureReceiptSha256s: string[] = []
  const preV2Snapshots: DevelopmentSeedV2SchemaSnapshot[] = []
  for (const prefix of prefixes) {
    const captureFiles = new Map<string, Buffer>()
    for (const [name, bytes] of input.files) {
      const relativeName =
        prefix === '' ? name : name.startsWith(`${prefix}/`) ? name.slice(prefix.length + 1) : null
      if (relativeName && !relativeName.includes('/')) {
        captureFiles.set(relativeName, bytes)
        claimedFiles.add(name)
      }
    }
    if (!exactJson([...captureFiles.keys()].sort(), [...REAL_LOCAL_CAPTURE_FILE_NAMES].sort())) {
      throw new Error('Real-local capture has an incomplete or unexpected seven-file inventory.')
    }
    const manifestBytes = captureFiles.get('checksum-manifest.sha256')!
    const expectedManifest = Buffer.from(
      REAL_LOCAL_CANONICAL_FILE_NAMES.map(
        (name) => `${sha256(captureFiles.get(name)!)}  ${name}\n`,
      ).join(''),
      'utf8',
    )
    if (!manifestBytes.equals(expectedManifest)) {
      throw new Error('Real-local capture checksum manifest or canonical bytes drifted.')
    }
    const receiptBytes = captureFiles.get('execution-receipt.json')!
    const receipt = parseProtectedV2BackupExecutionReceipt(receiptBytes.toString('utf8'))
    const { backupInstanceId, contentSha256, ...projection } = receipt
    const rebuiltReceipt = buildProtectedV2BackupExecutionReceipt(projection, {
      operatorBundle: input.operatorBundle,
    })
    if (!exactJson(rebuiltReceipt, receipt)) {
      throw new Error('Real-local receipt does not match its full production rebuild.')
    }
    const reportValue = parseJsonBytes(
      captureFiles.get('pre-application-report.json')!,
      'Real-local pre-application report',
    )
    const report = isRecord(reportValue) ? reportValue : {}
    const reportRepository = isRecord(report.repository) ? report.repository : {}
    const reportMigration = isRecord(report.migration) ? report.migration : {}
    const reportV1 = isRecord(reportMigration.v1) ? reportMigration.v1 : {}
    const reportV2 = isRecord(reportMigration.v2) ? reportMigration.v2 : {}
    const reportDatabase = isRecord(report.database) ? report.database : {}
    const current = isRecord(reportDatabase.current) ? reportDatabase.current : {}
    const readOnlyBracket = isRecord(reportDatabase.readOnlyBracket)
      ? reportDatabase.readOnlyBracket
      : {}
    const operations = isRecord(reportDatabase.operations) ? reportDatabase.operations : {}
    const mutations = isRecord(reportDatabase.mutations) ? reportDatabase.mutations : {}
    const safety = isRecord(report.safety) ? report.safety : {}
    const startPlan = isRecord(report.ordinaryLocalStartPlan) ? report.ordinaryLocalStartPlan : {}
    const backup = isRecord(report.backup) ? report.backup : {}
    const backupFileHashes = isRecord(backup.files) ? backup.files : {}
    const readiness = isRecord(report.readiness) ? report.readiness : {}
    const reportExpectedCatalog = validateProtectedV2ExpectedCatalogBinding(
      report.expectedCatalog,
      'local_supabase_postgres_owner_v1',
      'local',
    )
    const reportRuntimeBinding = validateProtectedV2RuntimeBundleBinding(
      report.operatorBundleBinding,
      input.operatorBundle,
    )
    const stateValue = parseJsonBytes(
      captureFiles.get('state-hashes.json')!,
      'Real-local state hashes',
    )
    const state = isRecord(stateValue) ? stateValue : {}
    const ledgerValue = parseJsonBytes(
      captureFiles.get('protected-migration-ledger.json')!,
      'Real-local protected migration ledger',
    )
    const ledger = isRecord(ledgerValue) ? ledgerValue : {}
    const protectedV2 = isRecord(ledger.protectedV2) ? ledger.protectedV2 : {}
    const expectedProtectedV2 = isRecord(protectedV2.expected) ? protectedV2.expected : {}
    const expectedReceiptV2 = Object.fromEntries(
      Object.entries(receipt.migrationLedger.v2).filter(([key]) => key !== 'occurrence'),
    )
    const seedValue = parseJsonBytes(
      captureFiles.get('development-database-seed.json')!,
      'Real-local development database seed',
    )
    const seed = developmentDatabaseSeedScopeSchema.parse(seedValue)
    assertDevelopmentSeedScope(seed)
    preV2Snapshots.push(
      deriveDevelopmentSeedV2SchemaSnapshot({
        effectiveStateSha256V1: REAL_LOCAL_IDENTITIES.effectiveStateSha256,
        membershipSha256: REAL_LOCAL_IDENTITIES.developmentMembershipSha256,
        physicalStateSha256V1: REAL_LOCAL_IDENTITIES.physicalStateSha256,
        planningStateSha256: REAL_LOCAL_IDENTITIES.developmentPlanningStateSha256,
        seed,
        sha256Canonical: sha256ContractCanonical,
      }),
    )
    const seedTables = seed.tables
    const seedBatches = seedTables.literature_gold_set_batches
    const ledgerEntries = Array.isArray(ledger.entries) ? ledger.entries : []
    const v1LedgerEntries = ledgerEntries.filter(
      (entry) =>
        isRecord(entry) &&
        (entry.version === '20260808035633' ||
          entry.name === 'add_literature_gold_import_compensation_contract'),
    )
    const v2LedgerEntries = ledgerEntries.filter(
      (entry) =>
        isRecord(entry) &&
        (entry.version === '20260809231651' ||
          entry.name === 'add_literature_gold_import_compensation_contract_v2'),
    )
    assertExactKeys(
      report,
      [
        'backup',
        'database',
        'expectedCatalog',
        'migration',
        'operatorBundleBinding',
        'ordinaryLocalStartPlan',
        'readiness',
        'repository',
        'safety',
        'schemaVersion',
        'status',
      ],
      'Real-local pre-application report',
    )
    assertExactKeys(reportRepository, ['branch', 'head', 'originMain'], 'Real-local repository')
    assertExactKeys(reportMigration, ['v1', 'v2'], 'Real-local report migration')
    assertExactKeys(
      reportV1,
      ['byteIdentical', 'id', 'occurrence', 'sha256'],
      'Real-local report V1 migration',
    )
    assertExactKeys(
      reportV2,
      ['appliedToRealLocal', 'id', 'occurrence', 'sha256'],
      'Real-local report V2 migration',
    )
    assertExactKeys(
      reportDatabase,
      ['batchId', 'batchName', 'current', 'mutations', 'operations', 'readOnlyBracket'],
      'Real-local report database',
    )
    assertExactKeys(
      current,
      Object.keys(REAL_LOCAL_IDENTITIES),
      'Real-local report current identities',
    )
    assertExactKeys(
      readOnlyBracket,
      ['after', 'before', 'matches'],
      'Real-local report read-only bracket',
    )
    assertExactKeys(
      operations,
      ['actionCount', 'compensationCount', 'importCount', 'operationCount', 'readOnlyTransaction'],
      'Real-local report operation counts',
    )
    assertExactKeys(
      mutations,
      ['pointerMutationCount', 'revealTimestampMutationCount', 'reviewRowMutationCount'],
      'Real-local report mutations',
    )
    assertExactKeys(
      readiness,
      [
        'implementationAndDisposableRehearsalMayBeReady',
        'realLocalMigrationApplicationSeparatelyAuthorized',
        'realLocalPackageExecutionAuthorized',
        'requiredNextStep',
      ],
      'Real-local report readiness',
    )
    assertExactKeys(
      startPlan,
      [
        'firstStartProtectedV2Visible',
        'migrationUpProtectedV2Visible',
        'protectedMigrationApplicationPlanned',
        'protectedMigrationState',
        'protectedV2AuthorizationPresent',
      ],
      'Real-local report start plan',
    )
    assertExactKeys(
      backup,
      ['completeDevelopmentSnapshot', 'files', 'heldOutIdentitiesIncluded'],
      'Real-local report backup',
    )
    assertExactKeys(
      backupFileHashes,
      ['development-database-seed.json', 'protected-migration-ledger.json', 'state-hashes.json'],
      'Real-local report backup hashes',
    )
    assertExactKeys(
      safety,
      [
        'compensationExecuted',
        'finalizedSourceArtifactRead',
        'heldOutIdentitiesAccessed',
        'importExecuted',
        'realLocalDatabaseMutationCount',
        'remoteDatabaseAccessed',
        'repeatableReadReadOnly',
        'writeCapableApplicationClientConstructed',
      ],
      'Real-local report safety',
    )
    assertExactKeys(
      seed,
      ['batchId', 'datasetSplit', 'heldOutIdentitiesIncluded', 'schemaVersion', 'tables'],
      'Real-local development seed',
    )
    assertExactKeys(
      seedTables,
      [
        'literature_articles',
        'literature_gold_set_batches',
        'literature_gold_set_events',
        'literature_gold_set_items',
        'literature_gold_set_review_drafts',
        'literature_gold_set_reviews',
      ],
      'Real-local development seed tables',
    )
    assertExactKeys(
      state,
      [
        'batchId',
        'batchName',
        'datasetSplit',
        'developmentMembershipSha256',
        'developmentPlanningStateSha256',
        'effectiveStateSha256',
        'physicalStateSha256',
        'schemaVersion',
      ],
      'Real-local state hashes',
    )
    assertExactKeys(
      ledger,
      ['entries', 'protectedV2', 'schemaVersion'],
      'Real-local migration ledger',
    )
    assertExactKeys(
      protectedV2,
      ['classification', 'expected', 'occurrence'],
      'Real-local protected V2 ledger projection',
    )
    const expectedMarkdown = `# Gold import contract V2 real-local pre-application report

- Status: \`implementation_ready_real_local_migration_required\`
- V1 migration occurrence: \`1\`
- V2 migration occurrence: \`0\`
- Membership: \`${REAL_LOCAL_IDENTITIES.developmentMembershipSha256}\`
- Effective state: \`${REAL_LOCAL_IDENTITIES.effectiveStateSha256}\`
- Physical state: \`${REAL_LOCAL_IDENTITIES.physicalStateSha256}\`
- Planning state: \`${REAL_LOCAL_IDENTITIES.developmentPlanningStateSha256}\`
- Review-row mutations: \`0\`
- Pointer mutations: \`0\`
- Reveal-timestamp mutations: \`0\`
- Operations: \`0\`
- Actions: \`0\`
- Imports: \`0\`
- Compensations: \`0\`
- Held-out identities accessed: \`false\`
- Remote database accessed: \`false\`
- Ordinary local-start protected state: \`v2_absent_unarmed\`
- Protected V2 visible to first-start initialization: \`false\`
- Protected V2 visible to ordinary migration-up: \`false\`
- Expected catalog profile: \`${input.authorization.localExpectedCatalog.profileId}/${input.authorization.localExpectedCatalog.target}\`
- Expected catalog artifact content SHA-256: \`${input.authorization.localExpectedCatalog.artifact.contentSha256}\`
- Expected catalog artifact file SHA-256: \`${input.authorization.localExpectedCatalog.artifact.fileSha256}\`
- Protected runtime bundle SHA-256: \`${input.authorization.protectedRuntimeBundle.aggregateSha256}\`
- Protected tracked-file inventory SHA-256: \`${input.authorization.protectedRuntimeBundle.trackedFileInventorySha256}\`

The V2 migration remains unapplied to the real local database. Package execution therefore remains
blocked until a separately authorized migration-application session completes and re-audits it.
`
    if (
      report.schemaVersion !== PREAPPLICATION_REPORT_SCHEMA_VERSION ||
      report.status !== 'implementation_ready_real_local_migration_required' ||
      reportRepository.branch !== input.repository.branch ||
      reportRepository.head !== input.repository.head ||
      reportRepository.originMain !== input.repository.originMain ||
      receipt.repositoryCommitSha !== input.repository.head ||
      receipt.canonicalManifestSha256 !== sha256(manifestBytes) ||
      !exactJson(receipt.expectedCatalog, input.authorization.localExpectedCatalog) ||
      !exactJson(receipt.operatorBundleBinding, input.authorization.protectedRuntimeBundle) ||
      !exactJson(reportExpectedCatalog, input.authorization.localExpectedCatalog) ||
      !exactJson(reportRuntimeBinding, input.authorization.protectedRuntimeBundle) ||
      reportV1.byteIdentical !== true ||
      reportV1.id !==
        GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH.split('/')
          .at(-1)
          ?.replace(/\.sql$/u, '') ||
      reportV1.occurrence !== 1 ||
      reportV1.sha256 !== GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256 ||
      reportV2.appliedToRealLocal !== false ||
      reportV2.id !== GOLD_IMPORT_MIGRATION_ID_V2 ||
      reportV2.occurrence !== 0 ||
      reportV2.sha256 !== input.authorization.localExpectedCatalog.migration.sha256 ||
      receipt.migrationLedger.v1.occurrence !== 1 ||
      receipt.migrationLedger.v2.occurrence !== 0 ||
      receipt.migrationLedger.sha256 !==
        sha256(captureFiles.get('protected-migration-ledger.json')!) ||
      receipt.database.datasetSplit !== 'development' ||
      receipt.database.batchId !== reportDatabase.batchId ||
      reportDatabase.batchName !== 'gold-set-v1' ||
      operations.readOnlyTransaction !== true ||
      receipt.database.developmentMembershipSha256 !==
        REAL_LOCAL_IDENTITIES.developmentMembershipSha256 ||
      receipt.database.developmentPlanningStateSha256 !==
        REAL_LOCAL_IDENTITIES.developmentPlanningStateSha256 ||
      receipt.database.effectiveStateSha256 !== REAL_LOCAL_IDENTITIES.effectiveStateSha256 ||
      receipt.database.physicalStateSha256 !== REAL_LOCAL_IDENTITIES.physicalStateSha256 ||
      !exactJson(current, REAL_LOCAL_IDENTITIES) ||
      readOnlyBracket.matches !== true ||
      !exactJson(readOnlyBracket.before, REAL_LOCAL_IDENTITIES) ||
      !exactJson(readOnlyBracket.after, REAL_LOCAL_IDENTITIES) ||
      state.datasetSplit !== 'development' ||
      state.batchId !== receipt.database.batchId ||
      state.batchName !== 'gold-set-v1' ||
      state.schemaVersion !== 'literature-gold-protected-v2-state-backup/1.0.0' ||
      state.developmentMembershipSha256 !== REAL_LOCAL_IDENTITIES.developmentMembershipSha256 ||
      state.developmentPlanningStateSha256 !==
        REAL_LOCAL_IDENTITIES.developmentPlanningStateSha256 ||
      state.effectiveStateSha256 !== REAL_LOCAL_IDENTITIES.effectiveStateSha256 ||
      state.physicalStateSha256 !== REAL_LOCAL_IDENTITIES.physicalStateSha256 ||
      seed.datasetSplit !== 'development' ||
      seed.heldOutIdentitiesIncluded !== false ||
      seed.schemaVersion !==
        'literature-gold-protected-v2-preapplication-development-backup/1.0.0' ||
      seed.batchId !== receipt.database.batchId ||
      seedBatches.length !== 1 ||
      !isRecord(seedBatches[0]) ||
      seedBatches[0].id !== receipt.database.batchId ||
      seedTables.literature_gold_set_events.some(
        (event) =>
          !('operation_action_id' in event) ||
          event.operation_action_id !== null ||
          !('operation_event_sequence' in event) ||
          event.operation_event_sequence !== null ||
          !('operation_id' in event) ||
          event.operation_id !== null,
      ) ||
      ledger.schemaVersion !== 'literature-gold-protected-v2-ledger-backup/1.0.0' ||
      v1LedgerEntries.length !== 1 ||
      !isRecord(v1LedgerEntries[0]) ||
      v1LedgerEntries[0].version !== '20260808035633' ||
      v1LedgerEntries[0].name !== 'add_literature_gold_import_compensation_contract' ||
      v2LedgerEntries.length !== 0 ||
      protectedV2.classification !== 'v2_absent' ||
      protectedV2.occurrence !== 0 ||
      !exactJson(expectedProtectedV2, expectedReceiptV2) ||
      operations.operationCount !== 0 ||
      operations.actionCount !== 0 ||
      operations.importCount !== 0 ||
      operations.compensationCount !== 0 ||
      mutations.reviewRowMutationCount !== 0 ||
      mutations.pointerMutationCount !== 0 ||
      mutations.revealTimestampMutationCount !== 0 ||
      startPlan.protectedMigrationState !== 'v2_absent_unarmed' ||
      startPlan.firstStartProtectedV2Visible !== false ||
      startPlan.migrationUpProtectedV2Visible !== false ||
      startPlan.protectedMigrationApplicationPlanned !== false ||
      startPlan.protectedV2AuthorizationPresent !== false ||
      safety.compensationExecuted !== false ||
      safety.finalizedSourceArtifactRead !== false ||
      safety.heldOutIdentitiesAccessed !== false ||
      safety.importExecuted !== false ||
      safety.realLocalDatabaseMutationCount !== 0 ||
      safety.remoteDatabaseAccessed !== false ||
      safety.repeatableReadReadOnly !== true ||
      safety.writeCapableApplicationClientConstructed !== false ||
      readiness.implementationAndDisposableRehearsalMayBeReady !== true ||
      readiness.realLocalMigrationApplicationSeparatelyAuthorized !== false ||
      readiness.realLocalPackageExecutionAuthorized !== false ||
      readiness.requiredNextStep !== 'separately_authorized_real_local_v2_migration_application' ||
      backup.completeDevelopmentSnapshot !== true ||
      backup.heldOutIdentitiesIncluded !== false ||
      backupFileHashes['development-database-seed.json'] !==
        sha256(captureFiles.get('development-database-seed.json')!) ||
      backupFileHashes['protected-migration-ledger.json'] !==
        sha256(captureFiles.get('protected-migration-ledger.json')!) ||
      backupFileHashes['state-hashes.json'] !== sha256(captureFiles.get('state-hashes.json')!) ||
      captureFiles.get('pre-application-report.md')!.toString('utf8') !== expectedMarkdown
    ) {
      throw new Error('Real-local capture is not the exact current read-only Phase-8 state.')
    }
    instanceIds.add(backupInstanceId)
    executionNonces.add(receipt.executionNonce)
    outputDirectories.add(receipt.outputDirectory)
    captureManifestSha256s.push(sha256(manifestBytes))
    captureReceiptSha256s.push(sha256(receiptBytes))
    void contentSha256
  }
  if (
    claimedFiles.size !== input.files.size ||
    instanceIds.size !== 2 ||
    executionNonces.size !== 2 ||
    outputDirectories.size !== 2 ||
    captureManifestSha256s.length !== 2 ||
    captureReceiptSha256s.length !== 2 ||
    new Set(captureReceiptSha256s).size !== 2
  ) {
    throw new Error('Real-local captures are not exactly paired, distinct, and self-contained.')
  }
  if (preV2Snapshots.length !== 2 || !exactJson(preV2Snapshots[0], preV2Snapshots[1])) {
    throw new Error('Real-local captures do not derive the same exact pre-V2 schema snapshot.')
  }
  return {
    backupInstanceIds: [...instanceIds].sort(),
    captureManifestSha256s: captureManifestSha256s.sort(),
    captureReceiptSha256s: captureReceiptSha256s.sort(),
    executionNonces: [...executionNonces].sort(),
    outputDirectories: [...outputDirectories].sort(),
    preV2Snapshot: preV2Snapshots[0],
  }
}

function validatePhase10EvidenceGroups(input: {
  authorization: GoldImportContractV2BackupAuthorization
  files: ReadonlyMap<RequiredEvidenceName, ReadonlyMap<string, Buffer>>
  packageCanonicalManifestSha256: string
  realLocal: ValidatedRealLocalCaptureEvidence
  repository: BackupRepositoryIdentity
}): Record<GoldImportContractV2Phase10EvidenceName, string> {
  const configuredNames = REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.filter((name) =>
    isGoldImportContractV2Phase10EvidenceName(name),
  )
  if (!exactJson(configuredNames, GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES)) {
    throw new Error('Phase-10 structured evidence inventory drifted from the backup contract.')
  }
  const context = {
    authorization: {
      disposableExpectedCatalogBindingSha256:
        input.authorization.disposableExpectedCatalog.bindingSha256,
      localExpectedCatalogBindingSha256: input.authorization.localExpectedCatalog.bindingSha256,
      protectedRuntimeBundleBindingSha256: input.authorization.protectedRuntimeBundle.bindingSha256,
    },
    repository: input.repository,
  }
  const summaries = new Map<
    GoldImportContractV2Phase10EvidenceName,
    GoldImportContractV2Phase10EvidenceSummary
  >()
  const summarySha256s = new Map<GoldImportContractV2Phase10EvidenceName, string>()
  for (const kind of GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES) {
    const files = input.files.get(kind) ?? new Map()
    const summaryBytes = files.get('evidence-summary.json')
    if (!summaryBytes) {
      throw new Error(`Phase-10 ${kind} omitted canonical evidence-summary.json.`)
    }
    const summary = validateGoldImportContractV2Phase10EvidenceSummary({
      context,
      files,
      kind,
      sha256Bytes: sha256,
      summary: parseJsonBytes(summaryBytes, `Phase-10 ${kind} summary`),
    })
    if (
      summaryBytes.toString('utf8') !== serializeGoldImportContractV2Phase10EvidenceSummary(summary)
    ) {
      throw new Error(`Phase-10 ${kind} summary bytes are not canonical.`)
    }
    summaries.set(kind, summary)
    summarySha256s.set(kind, sha256(summaryBytes))
  }
  const result = (kind: GoldImportContractV2Phase10EvidenceName) => summaries.get(kind)!.results
  const digest = (kind: GoldImportContractV2Phase10EvidenceName) => summarySha256s.get(kind)!

  const fullValidation = result('full-validation-report')
  const finalPrBody = result('final-pr-body')
  const mergeReadiness = result('merge-readiness-report')
  const sameUser = result('same-user-recomputation-evidence')
  const sealedIntent = result('sealed-intent-lost-ack-evidence')
  const trustedOperator = result('trusted-operator-evidence')
  if (
    fullValidation.testsBuildSummarySha256 !== digest('tests-build-report') ||
    mergeReadiness.criticSummarySha256 !== digest('critic-report') ||
    mergeReadiness.fullValidationSummarySha256 !== digest('full-validation-report') ||
    mergeReadiness.testsBuildSummarySha256 !== digest('tests-build-report') ||
    mergeReadiness.packageCanonicalManifestSha256 !== input.packageCanonicalManifestSha256 ||
    !exactJson(
      mergeReadiness.realLocalCaptureManifestSha256s,
      input.realLocal.captureManifestSha256s,
    ) ||
    !exactJson(sameUser.captureManifestSha256s, input.realLocal.captureManifestSha256s) ||
    !exactJson(sameUser.captureReceiptSha256s, input.realLocal.captureReceiptSha256s) ||
    !exactJson(trustedOperator.captureManifestSha256s, input.realLocal.captureManifestSha256s) ||
    !exactJson(trustedOperator.captureReceiptSha256s, input.realLocal.captureReceiptSha256s) ||
    !exactJson(trustedOperator.backupInstanceIds, input.realLocal.backupInstanceIds) ||
    !exactJson(trustedOperator.executionNonces, input.realLocal.executionNonces) ||
    !exactJson(trustedOperator.outputDirectories, input.realLocal.outputDirectories) ||
    !exactJson(sealedIntent.backupInstanceIds, input.realLocal.backupInstanceIds) ||
    finalPrBody.criticSummarySha256 !== digest('critic-report') ||
    finalPrBody.fullValidationSummarySha256 !== digest('full-validation-report') ||
    finalPrBody.mergeReadinessSummarySha256 !== digest('merge-readiness-report') ||
    finalPrBody.testsBuildSummarySha256 !== digest('tests-build-report') ||
    finalPrBody.packageCanonicalManifestSha256 !== input.packageCanonicalManifestSha256 ||
    !exactJson(
      finalPrBody.realLocalCaptureManifestSha256s,
      input.realLocal.captureManifestSha256s,
    ) ||
    !exactJson(finalPrBody.realLocalCaptureReceiptSha256s, input.realLocal.captureReceiptSha256s)
  ) {
    throw new Error('Phase-10 evidence summaries are not cross-bound to the same final evidence.')
  }

  const prBody = input.files.get('final-pr-body')!.get('final-pr-body.md')!.toString('utf8')
  const requiredPrBodyLines = [
    `- PR state: \`open\``,
    `- Draft: \`true\``,
    `- Merged: \`false\``,
    `- Base: \`main\``,
    `- Final HEAD: \`${input.repository.head}\``,
    `- Branch: \`${input.repository.branch}\``,
    `- Expected post-push remote HEAD: \`${input.repository.head}\``,
    `- Remote HEAD verification deferred until post-backup push: \`true\``,
    `- Local expected-catalog binding SHA-256: \`${input.authorization.localExpectedCatalog.bindingSha256}\``,
    `- Disposable expected-catalog binding SHA-256: \`${input.authorization.disposableExpectedCatalog.bindingSha256}\``,
    `- Protected runtime bundle binding SHA-256: \`${input.authorization.protectedRuntimeBundle.bindingSha256}\``,
    `- Critic summary SHA-256: \`${digest('critic-report')}\``,
    `- Full validation summary SHA-256: \`${digest('full-validation-report')}\``,
    `- Tests/build summary SHA-256: \`${digest('tests-build-report')}\``,
    `- Merge-readiness summary SHA-256: \`${digest('merge-readiness-report')}\``,
    `- Package canonical manifest SHA-256: \`${input.packageCanonicalManifestSha256}\``,
    `- Real-local capture manifest SHA-256s: \`${input.realLocal.captureManifestSha256s.join(',')}\``,
    `- Real-local capture receipt SHA-256s: \`${input.realLocal.captureReceiptSha256s.join(',')}\``,
    `- V2 applied real-locally: \`false\``,
    `- Real import executed: \`false\``,
    `- Real compensation executed: \`false\``,
  ]
  if (requiredPrBodyLines.some((line) => !prBody.includes(line))) {
    throw new Error('Final PR body omitted exact final-state and no-execution claims.')
  }

  return {
    'critic-report': digest('critic-report'),
    'descendant-recovery-evidence': digest('descendant-recovery-evidence'),
    'final-pr-body': digest('final-pr-body'),
    'full-validation-report': digest('full-validation-report'),
    'merge-readiness-report': digest('merge-readiness-report'),
    'same-user-recomputation-evidence': digest('same-user-recomputation-evidence'),
    'sealed-intent-lost-ack-evidence': digest('sealed-intent-lost-ack-evidence'),
    'tests-build-report': digest('tests-build-report'),
    'trusted-operator-evidence': digest('trusted-operator-evidence'),
  }
}

function validateSemanticEvidenceDocuments(input: {
  authorization: GoldImportContractV2BackupAuthorization
  documents: ReadonlyMap<RequiredEvidenceName, readonly unknown[]>
  files: ReadonlyMap<RequiredEvidenceName, ReadonlyMap<string, Buffer>>
  fileNames: ReadonlyMap<RequiredEvidenceName, readonly string[]>
  operatorBundle: ProtectedV2OperatorBundle
  repository: BackupRepositoryIdentity
}): SemanticEvidenceValidation {
  for (const name of JSON_REQUIRED_EVIDENCE_NAMES) {
    if ((input.documents.get(name) ?? []).length === 0) {
      throw new Error(`Backup evidence group ${name} must contain parseable JSON evidence.`)
    }
  }
  const realLocalCaptureEvidence = validateRealLocalCaptureEvidence({
    authorization: input.authorization,
    files: input.files.get('real-local-read-only-report') ?? new Map(),
    operatorBundle: input.operatorBundle,
    repository: input.repository,
  })

  const catalogDocuments = input.documents.get('catalog-expectations-and-ready-inventories')!
  const exactProfiles = new Set<string>()
  for (const candidate of catalogDocuments.flatMap((document) => nestedObjects(document))) {
    if (candidate.artifactSchemaVersion !== PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION) {
      continue
    }
    const artifact = parseProtectedV2CatalogExpectedArtifact(candidate)
    const exact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
      artifact.profileId,
      artifact.target,
    )
    if (!exactJson(artifact, exact)) {
      throw new Error(`Catalog expectation evidence drifted for ${artifact.profileId}.`)
    }
    exactProfiles.add(artifact.profileId)
  }
  if (
    !exactProfiles.has('local_supabase_postgres_owner_v1') ||
    !exactProfiles.has('supabase_admin_owner_v1')
  ) {
    throw new Error('Catalog expectation evidence must preserve both exact ready profiles.')
  }
  const comparisonReports = catalogDocuments
    .flatMap((document) => nestedObjects(document))
    .filter(({ schemaVersion }) => schemaVersion === CATALOG_PROPOSAL_REPORT_SCHEMA_VERSION)
  if (
    comparisonReports.length === 0 ||
    comparisonReports.some((report) => {
      const generator = isRecord(report.generator) ? report.generator : {}
      const profileRunCounts = isRecord(generator.profileRunCounts)
        ? generator.profileRunCounts
        : {}
      const comparisons = isRecord(report.comparisons) ? report.comparisons : {}
      return (
        report.committedExpectationsExact !== true ||
        generator.acceptedCallerDatabaseTarget !== false ||
        generator.acceptedCallerDockerEndpoint !== false ||
        generator.acceptedCallerSql !== false ||
        generator.acceptedHeldOutInput !== false ||
        generator.freshDisposableRunCount !== 4 ||
        generator.overwriteModeAvailable !== false ||
        generator.remoteAccess !== false ||
        profileRunCounts.local_supabase_postgres_owner_v1 !== 2 ||
        profileRunCounts.supabase_admin_owner_v1 !== 2 ||
        !isRecord(comparisons.local_supabase_postgres_owner_v1) ||
        comparisons.local_supabase_postgres_owner_v1.passed !== true ||
        !isRecord(comparisons.supabase_admin_owner_v1) ||
        comparisons.supabase_admin_owner_v1.passed !== true
      )
    })
  ) {
    throw new Error('Catalog generator comparison evidence is incomplete or unsafe.')
  }

  const bundleCandidates = input.documents
    .get('protected-bundle-inventory')!
    .flatMap((document) => nestedObjects(document))
    .filter(({ schemaVersion }) => schemaVersion === PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION)
  if (
    bundleCandidates.length === 0 ||
    bundleCandidates.some(
      (candidate) => !exactJson(validateProtectedV2OperatorBundle(candidate), input.operatorBundle),
    )
  ) {
    throw new Error('Protected bundle evidence does not equal the current sealed bundle.')
  }

  const moduleCandidates = input.documents
    .get('module-resolution-evidence')!
    .flatMap((document) => nestedObjects(document))
    .filter(
      ({ schemaVersion }) => schemaVersion === PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION,
    )
  if (
    moduleCandidates.length === 0 ||
    moduleCandidates.some(
      (candidate) =>
        !exactJson(
          validateProtectedV2ModuleResolutionAudit(candidate),
          input.operatorBundle.moduleResolutionAudit,
        ),
    )
  ) {
    throw new Error('Module-resolution evidence does not equal the current sealed audit.')
  }

  const runtimeCandidates = input.documents
    .get('runtime-input-evidence')!
    .flatMap((document) => nestedObjects(document))
    .filter(
      ({ schemaVersion }) => schemaVersion === PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION,
    )
  if (
    runtimeCandidates.length === 0 ||
    runtimeCandidates.some(
      (candidate) =>
        !exactJson(
          validateProtectedV2RuntimeInputAudit(candidate),
          input.operatorBundle.runtimeInputAudit,
        ),
    )
  ) {
    throw new Error('Runtime-input evidence does not equal the current sealed audit.')
  }

  const driftCandidates = input.documents
    .get('catalog-drift-matrix')!
    .flatMap((document) => nestedObjects(document))
    .filter(
      ({ schemaVersion }) =>
        schemaVersion === GOLD_IMPORT_CONTRACT_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION,
    )
  if (
    driftCandidates.length === 0 ||
    driftCandidates.some((candidate) => {
      const probes = Array.isArray(candidate.probes) ? candidate.probes : []
      const ids = probes.map((probe) => (isRecord(probe) ? probe.id : null))
      const exactDisposable = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
        candidate.exactReadyDisposable,
        'supabase_admin_owner_v1',
        'disposable',
      )
      const exactLocal = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
        candidate.localOwnerProjection,
        'local_supabase_postgres_owner_v1',
        'local',
      )
      return (
        candidate.probeCount !== probes.length ||
        probes.length === 0 ||
        ids.some((id) => typeof id !== 'string' || id.length === 0) ||
        new Set(ids).size !== ids.length ||
        !exactJson(ids, PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS) ||
        probes.some(
          (probe) =>
            !isRecord(probe) || probe.auditRejected !== true || probe.cleanupVerified !== true,
        ) ||
        exactDisposable.fullAuditIdentitySha256 !==
          input.authorization.disposableExpectedCatalog.fullAuditIdentitySha256 ||
        exactLocal.fullAuditIdentitySha256 !==
          input.authorization.localExpectedCatalog.fullAuditIdentitySha256
      )
    })
  ) {
    throw new Error('Catalog drift-matrix evidence is incomplete or non-authoritative.')
  }

  const packageDocuments = input.documents.get('package-rehearsal-evidence')!
  if (
    packageDocuments.some((document) =>
      allStringValues(document).some((value) => /transient_.*not_delivery_evidence/u.test(value)),
    )
  ) {
    throw new Error('Transient catalog probe/proposal output cannot be delivery evidence.')
  }
  const packageObjects = packageDocuments.flatMap((document) => nestedObjects(document))
  const expectedDisposableAudit = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    expectedObservedAuditIdentityFromArtifact(
      committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
        'supabase_admin_owner_v1',
        'disposable',
      ),
    ),
    'supabase_admin_owner_v1',
    'disposable',
  )
  const packageFiles = input.files.get('package-rehearsal-evidence') ?? new Map()
  verifyCopiedExactPackage(packageFiles)
  const canonicalOutputNames = [
    'disposable-v2-catalog-drift-matrix.json',
    'disposable-v2-complete-catalog-audit.json',
    'disposable-v2-exact-catalog-binding.json',
    'disposable-v2-ready-audit.json',
    'exact-package-rehearsal-report-v2.json',
    'fresh-v2-rehearsal-evidence.json',
    'protected-v2-runtime-bundle-binding.json',
    'upgrade-v2-rehearsal-evidence.json',
  ] as const
  const canonicalFiles = new Map(
    canonicalOutputNames.map((name) => [
      name,
      fileByUniqueSuffix(packageFiles, name, 'Package rehearsal evidence').bytes,
    ]),
  )
  const canonicalManifest = fileByUniqueSuffix(
    packageFiles,
    'canonical-manifest-v2.sha256',
    'Package rehearsal evidence',
  ).bytes
  const expectedCanonicalManifest = Buffer.from(
    `${[...canonicalFiles.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
  if (!canonicalManifest.equals(expectedCanonicalManifest)) {
    throw new Error('Package rehearsal canonical manifest or exact output inventory drifted.')
  }
  const bundleFileSha = (path: string) => {
    const matches = input.operatorBundle.files.filter((entry) => entry.path === path)
    if (matches.length !== 1) {
      throw new Error(`Protected bundle omitted exact canonical validator input ${path}.`)
    }
    return matches[0].sha256
  }
  const canonicalContext = {
    completeCatalogAudit: expectedDisposableAudit,
    expectedCatalog: input.authorization.disposableExpectedCatalog,
    migrationSha256: bundleFileSha(`supabase/migrations/${GOLD_IMPORT_MIGRATION_ID_V2}.sql`),
    operatorBundle: input.operatorBundle,
    operatorBundleBinding: input.authorization.protectedRuntimeBundle,
    v1MigrationSha256: bundleFileSha(GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH),
    v1VerifierSha256: bundleFileSha(
      'supabase/verification/20260808035633_verify_literature_gold_import_compensation_contract.sql',
    ),
  }
  const freshCanonical = validateCanonicalV2RehearsalEvidence(
    parseJsonBytes(
      canonicalFiles.get('fresh-v2-rehearsal-evidence.json')!,
      'Fresh canonical rehearsal evidence',
    ),
    canonicalContext,
  )
  const upgradeCanonical = validateCanonicalV2RehearsalEvidence(
    parseJsonBytes(
      canonicalFiles.get('upgrade-v2-rehearsal-evidence.json')!,
      'Upgrade canonical rehearsal evidence',
    ),
    canonicalContext,
  )
  if (freshCanonical.migration.path !== 'fresh' || upgradeCanonical.migration.path !== 'upgrade') {
    throw new Error('Package evidence requires exact canonical fresh and upgrade authority.')
  }
  validateExactRehearsalExecutionReceipt({
    completeCatalogAudit: expectedDisposableAudit,
    driftProbeCount: PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS.length,
    expectedCatalog: input.authorization.disposableExpectedCatalog,
    migrationSha256: canonicalContext.migrationSha256,
    operatorBundleBinding: input.authorization.protectedRuntimeBundle,
    receipt: parseJsonBytes(
      fileByUniqueSuffix(packageFiles, 'execution-receipt-v2.json', 'Package rehearsal evidence')
        .bytes,
      'Exact package rehearsal execution receipt',
    ),
  })

  const exactRehearsalReport = parseJsonBytes(
    canonicalFiles.get('exact-package-rehearsal-report-v2.json')!,
    'Exact package rehearsal report',
  )

  const readyAudits = packageObjects.filter(
    ({ schemaVersion }) => schemaVersion === READY_AUDIT_SCHEMA_VERSION,
  )
  const validatedReadyAudits = readyAudits.map((audit) =>
    validateReadyGoldImportCompensationV2Audit(audit),
  )
  if (
    validatedReadyAudits.length !== 1 ||
    validatedReadyAudits.some(
      (validated) =>
        validated.target !== 'disposable_clone' ||
        validated.repositoryCommitSha !== input.repository.head ||
        !exactJson(validated.expectedCatalog, input.authorization.disposableExpectedCatalog) ||
        !exactJson(validated.completeCatalogAudit, expectedDisposableAudit),
    )
  ) {
    throw new Error('Package evidence lacks an exact disposable ready audit.')
  }

  const sourceAuthorizations = packageObjects.filter(
    ({ schemaVersion }) => schemaVersion === SOURCE_AUTHORIZATION_SCHEMA_VERSION,
  )
  const validatedSourceAuthorizations = sourceAuthorizations.map((authorization) =>
    validateGoldImportSourceAuthorizationSetV4(authorization),
  )
  if (
    validatedSourceAuthorizations.length !== 1 ||
    validatedSourceAuthorizations.some(
      (validated) =>
        validated.auditTarget !== 'disposable_clone' ||
        !exactJson(validated.expectedCatalog, input.authorization.disposableExpectedCatalog) ||
        !exactJson(validated.completeCatalogAudit, expectedDisposableAudit),
    )
  ) {
    throw new Error('Package evidence lacks an exact source authorization.')
  }

  const importPlans = packageObjects.filter(
    (candidate) =>
      candidate.kind === 'import' && candidate.contractVersion === GOLD_IMPORT_CONTRACT_VERSION_V2,
  )
  const packageDescriptors = packageObjects.filter(
    ({ schemaVersion }) => schemaVersion === PACKAGE_DESCRIPTOR_SCHEMA_VERSION,
  )
  const importReceipts = packageObjects.filter(
    (candidate) => candidate.kind === 'import_receipt' && candidate.response === 'applied',
  )
  const compensationReceipts = packageObjects.filter(
    (candidate) => candidate.kind === 'compensation_receipt' && candidate.response === 'applied',
  )
  const validatedImportPlans = importPlans.map((plan) => parseImportPlanV2(plan))
  const validatedImportReceipts = importReceipts.map((receipt) => parseImportReceiptV2(receipt))
  const validatedCompensationReceipts = compensationReceipts.map((receipt) =>
    parseCompensationReceiptV2(receipt),
  )
  if (
    validatedImportPlans.length !== 1 ||
    validatedImportPlans.some(
      (plan) =>
        plan.executionContext.migrationId !== GOLD_IMPORT_MIGRATION_ID_V2 ||
        plan.executionContext.remoteWritesAllowed !== false ||
        plan.executionContext.repositoryCommitSha !== input.repository.head,
    ) ||
    packageDescriptors.length !== 1 ||
    packageDescriptors.some(
      (descriptor) =>
        descriptor.auditTarget !== 'disposable_clone' ||
        descriptor.expectedCatalogBindingSha256 !==
          input.authorization.disposableExpectedCatalog.bindingSha256 ||
        descriptor.expectedCatalogArtifactContentSha256 !==
          input.authorization.disposableExpectedCatalog.artifact.contentSha256 ||
        descriptor.expectedCatalogArtifactFileSha256 !==
          input.authorization.disposableExpectedCatalog.artifact.fileSha256 ||
        descriptor.sourceAuthorizationVersion !== 4,
    ) ||
    validatedImportReceipts.length === 0 ||
    validatedCompensationReceipts.length === 0 ||
    [...validatedImportReceipts, ...validatedCompensationReceipts].some(
      (receipt) =>
        receipt.contractVersion !== GOLD_IMPORT_CONTRACT_VERSION_V2 ||
        receipt.migrationId !== GOLD_IMPORT_MIGRATION_ID_V2 ||
        receipt.outcome !== 'committed' ||
        receipt.error !== null,
    )
  ) {
    throw new Error('Package manifest, plan, descriptor, or execution receipts are incomplete.')
  }
  const exactCohortRowsSha256 = protectedV2ProductionCohortRowsSha256FromImportPlan(
    validatedImportPlans[0],
  )
  const freshVerifier = isRecord(freshCanonical.verifierEvidence)
    ? freshCanonical.verifierEvidence
    : {}
  const upgradeVerifier = isRecord(upgradeCanonical.verifierEvidence)
    ? upgradeCanonical.verifierEvidence
    : {}
  const freshProjection = isRecord(freshVerifier.postV2SeedProjection)
    ? freshVerifier.postV2SeedProjection
    : {}
  const upgradeProjection = isRecord(upgradeVerifier.postV2SeedProjection)
    ? upgradeVerifier.postV2SeedProjection
    : {}
  const upgradeBefore = upgradeCanonical.schemaOnlyUpgrade?.before
  const upgradeAfter = upgradeCanonical.schemaOnlyUpgrade?.after
  if (
    freshCanonical.productionCohort.rowsSha256 !== exactCohortRowsSha256 ||
    upgradeCanonical.productionCohort.rowsSha256 !== exactCohortRowsSha256 ||
    !exactJson(freshCanonical.actionCounts, validatedImportPlans[0].counts) ||
    !exactJson(freshCanonical.actionCounts, upgradeCanonical.actionCounts) ||
    !exactJson(freshCanonical.productionCohort, upgradeCanonical.productionCohort) ||
    !exactJson(freshCanonical.operationScenarios, upgradeCanonical.operationScenarios) ||
    !exactJson(freshProjection.snapshot, upgradeProjection.snapshot) ||
    !exactJson(freshProjection.snapshot, upgradeAfter) ||
    !exactJson(freshVerifier.ownerProfiles, upgradeVerifier.ownerProfiles) ||
    !exactJson(freshVerifier.v1, upgradeVerifier.v1) ||
    !exactJson(freshVerifier.v2, upgradeVerifier.v2) ||
    !upgradeBefore ||
    !exactJson(upgradeBefore, realLocalCaptureEvidence.preV2Snapshot) ||
    realLocalCaptureEvidence.preV2Snapshot.batchCount !== 1 ||
    realLocalCaptureEvidence.preV2Snapshot.itemCount !== validatedImportPlans[0].counts.total ||
    realLocalCaptureEvidence.preV2Snapshot.operationCount !== 0 ||
    realLocalCaptureEvidence.preV2Snapshot.actionCount !== 0
  ) {
    throw new Error('Canonical fresh/upgrade cohort evidence differs from the exact import plan.')
  }
  const canonicalImportReceipt =
    freshCanonical.operationScenarios.receiptsAndState.receipts.importApplied
  const canonicalCompensationReceipt =
    freshCanonical.operationScenarios.receiptsAndState.receipts.compensationApplied
  const exactPlan = validatedImportPlans[0]
  const exactCompensationTemplate = buildCompensationTemplateV2(exactPlan)
  const copiedCompensationTemplate = parseJsonBytes(
    fileByUniqueSuffix(
      packageFiles,
      'exact-package-v2/append-only-compensation-plan-template-v2.json',
      'Exact package',
    ).bytes,
    'Exact package compensation template',
  )
  if (!exactJson(copiedCompensationTemplate, exactCompensationTemplate)) {
    throw new Error('Exact package compensation template is not deterministic from the plan.')
  }
  const exactCompensationPlan = bindCompensationPlanV2({
    actions: exactCompensationTemplate.actions,
    batchId: exactCompensationTemplate.batchId,
    booleanNormalizationLedgerSha256:
      exactCompensationTemplate.evidence.booleanNormalizationLedgerSha256,
    contractVersion: exactCompensationTemplate.contractVersion,
    counts: exactCompensationTemplate.counts,
    executionContext: exactPlan.executionContext,
    expectedEffectiveStateSha256: canonicalImportReceipt.afterEffectiveStateSha256,
    expectedPhysicalStateSha256: canonicalImportReceipt.afterPhysicalStateSha256,
    expectedPostEffectiveStateSha256: exactCompensationTemplate.expectedPostEffectiveStateSha256,
    importPlanSha256: exactCompensationTemplate.importPlanSha256,
    importReceiptSha256: canonicalImportReceipt.binding.contentSha256,
    kind: 'compensation',
    noteDispositionAuditSha256: exactCompensationTemplate.evidence.noteDispositionAuditSha256,
    operationId: exactCompensationTemplate.operationId,
    orderedSetNormalizationLedgerSha256:
      exactCompensationTemplate.evidence.orderedSetNormalizationLedgerSha256,
    scope: exactPlan.scope,
    sourceArtifactSha256: exactPlan.sourceArtifactSha256,
    sourceAuthorizationSetSha256: exactCompensationTemplate.evidence.sourceAuthorizationSetSha256,
    targetImportOperationId: exactCompensationTemplate.targetImportOperationId,
  })
  if (
    canonicalImportReceipt.planSha256 !== exactPlan.binding.contentSha256 ||
    canonicalImportReceipt.operationId !== exactPlan.operationId ||
    canonicalImportReceipt.idempotencyKey !== exactPlan.binding.idempotencyKey ||
    canonicalImportReceipt.batchId !== exactPlan.batchId ||
    canonicalImportReceipt.contractVersion !== exactPlan.contractVersion ||
    canonicalImportReceipt.migrationId !== exactPlan.executionContext.migrationId ||
    !exactJson(canonicalImportReceipt.actionCounts, exactPlan.counts) ||
    canonicalImportReceipt.sourceAuthorizationSetSha256 !==
      exactPlan.sourceAuthorizationSetSha256 ||
    canonicalImportReceipt.noteDispositionAuditSha256 !== exactPlan.noteDispositionAuditSha256 ||
    canonicalImportReceipt.booleanNormalizationLedgerSha256 !==
      exactPlan.booleanNormalizationLedgerSha256 ||
    canonicalImportReceipt.orderedSetNormalizationLedgerSha256 !==
      exactPlan.orderedSetNormalizationLedgerSha256 ||
    canonicalImportReceipt.beforeEffectiveStateSha256 !== exactPlan.expectedEffectiveStateSha256 ||
    canonicalImportReceipt.beforePhysicalStateSha256 !== exactPlan.expectedPhysicalStateSha256 ||
    canonicalImportReceipt.afterEffectiveStateSha256 !==
      exactPlan.expectedPostEffectiveStateSha256 ||
    exactPlan.sourceArtifactSha256 !== validatedSourceAuthorizations[0].finalArtifactSha256 ||
    exactPlan.batchId !== validatedSourceAuthorizations[0].currentDatabase.batchId ||
    exactPlan.scope.datasetSplit !== 'development' ||
    exactPlan.scope.heldOutIdentitiesAccessed !== false ||
    exactPlan.scope.developmentMembershipSha256 !==
      validatedSourceAuthorizations[0].currentDatabase.developmentMembershipSha256 ||
    exactPlan.expectedEffectiveStateSha256 !==
      validatedSourceAuthorizations[0].v2PreImportState.effectiveStateSha256 ||
    exactPlan.expectedPhysicalStateSha256 !==
      validatedSourceAuthorizations[0].v2PreImportState.physicalStateSha256 ||
    !exactJson(exactPlan.counts, validatedSourceAuthorizations[0].actionCounts) ||
    canonicalCompensationReceipt.planSha256 !== exactCompensationPlan.binding.contentSha256 ||
    canonicalCompensationReceipt.operationId !== exactCompensationPlan.operationId ||
    canonicalCompensationReceipt.idempotencyKey !== exactCompensationPlan.binding.idempotencyKey ||
    canonicalCompensationReceipt.targetImportOperationId !== exactPlan.operationId ||
    canonicalCompensationReceipt.batchId !== exactPlan.batchId ||
    canonicalCompensationReceipt.contractVersion !== exactPlan.contractVersion ||
    canonicalCompensationReceipt.migrationId !== exactPlan.executionContext.migrationId ||
    canonicalCompensationReceipt.sourceAuthorizationSetSha256 !==
      exactPlan.sourceAuthorizationSetSha256 ||
    canonicalCompensationReceipt.noteDispositionAuditSha256 !==
      exactPlan.noteDispositionAuditSha256 ||
    canonicalCompensationReceipt.booleanNormalizationLedgerSha256 !==
      exactPlan.booleanNormalizationLedgerSha256 ||
    canonicalCompensationReceipt.orderedSetNormalizationLedgerSha256 !==
      exactPlan.orderedSetNormalizationLedgerSha256 ||
    canonicalCompensationReceipt.beforeEffectiveStateSha256 !==
      exactCompensationPlan.expectedEffectiveStateSha256 ||
    canonicalCompensationReceipt.beforePhysicalStateSha256 !==
      exactCompensationPlan.expectedPhysicalStateSha256 ||
    canonicalCompensationReceipt.afterEffectiveStateSha256 !==
      exactCompensationPlan.expectedPostEffectiveStateSha256 ||
    !exactJson(canonicalCompensationReceipt.actionCounts, exactCompensationPlan.counts)
  ) {
    throw new Error('Canonical rehearsal receipts differ from the exact package plan.')
  }
  validateExactPackageRehearsalReport({
    authorization: input.authorization,
    canonicalFiles,
    completeCatalogAudit: expectedDisposableAudit,
    descriptor: packageDescriptors[0],
    importPlan: validatedImportPlans[0],
    packageFiles,
    readyAudit: validatedReadyAudits[0],
    report: exactRehearsalReport,
    repository: input.repository,
    sourceAuthorization: validatedSourceAuthorizations[0],
  })
  const packageFileNames = input.fileNames.get('package-rehearsal-evidence') ?? []
  for (const requiredSuffix of [
    'canonical-manifest-v2.sha256',
    'execution-receipt-v2.json',
    'exact-package-v2/checksum-manifest-v2.sha256',
    'exact-package-v2/immutable-atomic-import-plan-v2.json',
    'exact-package-v2/package-descriptor-v2.json',
    'exact-package-v2/source-authorization-set-v4.json',
    'exact-package-rehearsal-report-v2.json',
    'fresh-v2-rehearsal-evidence.json',
    'upgrade-v2-rehearsal-evidence.json',
  ]) {
    if (!packageFileNames.some((name) => name.endsWith(requiredSuffix))) {
      throw new Error(`Package/rehearsal evidence omitted required artifact ${requiredSuffix}.`)
    }
  }

  const phase10EvidenceSummarySha256 = validatePhase10EvidenceGroups({
    authorization: input.authorization,
    files: input.files,
    packageCanonicalManifestSha256: sha256(canonicalManifest),
    realLocal: realLocalCaptureEvidence,
    repository: input.repository,
  })

  let localBindingSeen = false
  let disposableBindingSeen = false
  let runtimeBindingSeen = false
  const allDocuments = [...input.documents.values()].flat()
  for (const candidate of allDocuments.flatMap((document) => nestedObjects(document))) {
    if (candidate.schemaVersion === input.authorization.localExpectedCatalog.schemaVersion) {
      if (candidate.profileId === 'local_supabase_postgres_owner_v1') {
        const validated = validateProtectedV2ExpectedCatalogBinding(
          candidate,
          'local_supabase_postgres_owner_v1',
          'local',
        )
        if (!exactJson(validated, input.authorization.localExpectedCatalog)) {
          throw new Error('Local expected-catalog evidence differs from backup authorization.')
        }
        localBindingSeen = true
      } else if (candidate.profileId === 'supabase_admin_owner_v1') {
        const validated = validateProtectedV2ExpectedCatalogBinding(
          candidate,
          'supabase_admin_owner_v1',
          'disposable',
        )
        if (!exactJson(validated, input.authorization.disposableExpectedCatalog)) {
          throw new Error('Disposable expected-catalog evidence differs from authorization.')
        }
        disposableBindingSeen = true
      } else {
        throw new Error('Expected-catalog evidence has an unknown or target-derived profile.')
      }
    }
    if (candidate.schemaVersion === input.authorization.protectedRuntimeBundle.schemaVersion) {
      const validated = validateProtectedV2RuntimeBundleBinding(candidate, input.operatorBundle)
      if (!exactJson(validated, input.authorization.protectedRuntimeBundle)) {
        throw new Error('Runtime-bundle evidence differs from backup authorization.')
      }
      runtimeBindingSeen = true
    }
  }
  if (!localBindingSeen || !disposableBindingSeen || !runtimeBindingSeen) {
    throw new Error(
      'Semantic backup evidence must embed exact local, disposable, and runtime bindings.',
    )
  }

  return {
    disposableExpectedCatalogBindingSha256:
      input.authorization.disposableExpectedCatalog.bindingSha256,
    exactCatalogArtifactProfiles: [...exactProfiles].sort(),
    jsonDocumentCount: allDocuments.length,
    localExpectedCatalogBindingSha256: input.authorization.localExpectedCatalog.bindingSha256,
    phase10EvidenceSummarySha256,
    protectedRuntimeBundleBindingSha256: input.authorization.protectedRuntimeBundle.bindingSha256,
    transientDeliveryAuthorityRejected: true,
  }
}

function usage(): string {
  return `
Create a checksum-verified additive delivery backup for the gold import contract V2 repair.

Usage:
  npm run literature:backup-gold-import-contract-v2-forward-repair -- \\
    --output-root <EXISTING_BACKUP_ROOT> \\
    --output <NEW_GOLD_IMPORT_CONTRACT_V2_BACKUP_DIRECTORY> \\
    --evidence <NAME>=<FILE_OR_DIRECTORY> [--evidence ...]

The command is file-only. It requires the exact clean task branch, copies every
tracked path changed from origin/main, requires the complete named evidence
inventory, rejects symlinks and output collisions, and never contacts a database.

Required evidence names:
  ${REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.join(', ')}
`.trim()
}

function assertCompleteEvidenceInventory(evidence: readonly EvidenceArgument[]): void {
  const actual = evidence.map(({ name }) => name)
  if (new Set(actual).size !== actual.length) throw new Error('Evidence names must be unique.')
  const expected = [...REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES]
  const missing = expected.filter((name) => !actual.includes(name))
  const unexpected = actual.filter(
    (name) =>
      !REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.includes(
        name as (typeof REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES)[number],
      ),
  )
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Backup evidence inventory is incomplete or unexpected; missing=${missing.join(',') || 'none'}; unexpected=${unexpected.join(',') || 'none'}.`,
    )
  }
}

export function parseGoldImportContractV2BackupArguments(argv: string[]): ParsedArguments {
  let outputRoot: string | undefined
  let output: string | undefined
  const evidence: EvidenceArgument[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') throw new Error(usage())
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}.`)
    if (argument === '--output-root') outputRoot = value
    else if (argument === '--output') output = value
    else if (argument === '--evidence') {
      const equals = value.indexOf('=')
      if (equals < 1 || equals === value.length - 1) {
        throw new Error('--evidence must use NAME=FILE_OR_DIRECTORY.')
      }
      const name = value.slice(0, equals)
      if (!EVIDENCE_NAME_PATTERN.test(name)) throw new Error(`Invalid evidence name: ${name}.`)
      evidence.push({ name, source: value.slice(equals + 1) })
    } else throw new Error(`Unknown argument: ${argument}.`)
    index += 1
  }
  if (!outputRoot || !output || evidence.length === 0) throw new Error(usage())
  assertCompleteEvidenceInventory(evidence)
  return { evidence, output, outputRoot }
}

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function assertOutputPath(outputRootArgument: string, outputArgument: string) {
  const outputRoot = resolve(outputRootArgument)
  const rootStat = await lstat(outputRoot)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('Backup root must be an existing real directory.')
  }
  const resolvedRoot = await realpath(outputRoot)
  const output = resolve(outputArgument)
  if (!isWithin(resolvedRoot, output)) throw new Error('Backup output must be inside its root.')
  if (await pathExists(output)) throw new Error('Backup output collision.')

  let ancestor = dirname(output)
  while (isWithin(resolvedRoot, ancestor)) {
    if (await pathExists(ancestor)) {
      const stat = await lstat(ancestor)
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('Backup output path contains a non-directory or symlink ancestor.')
      }
      const resolvedAncestor = await realpath(ancestor)
      if (resolvedAncestor !== resolvedRoot && !isWithin(resolvedRoot, resolvedAncestor)) {
        throw new Error('Backup output ancestor escapes its approved root.')
      }
    }
    ancestor = dirname(ancestor)
  }
  return { output, outputRoot: resolvedRoot }
}

async function git(cwd: string, arguments_: string[]): Promise<string> {
  const result = await execFileAsync('git', arguments_, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  return result.stdout.trim()
}

async function inspectRepository(cwd: string): Promise<BackupRepositoryIdentity> {
  const [branch, head, originMain, status, mergeBase] = await Promise.all([
    git(cwd, ['branch', '--show-current']),
    git(cwd, ['rev-parse', 'HEAD']),
    git(cwd, ['rev-parse', 'origin/main']),
    git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']),
    git(cwd, ['merge-base', 'origin/main', 'HEAD']),
  ])
  if (branch !== GOLD_IMPORT_CONTRACT_V2_BRANCH) throw new Error('Unexpected backup branch.')
  if (!COMMIT_PATTERN.test(head) || !COMMIT_PATTERN.test(originMain)) {
    throw new Error('Repository commit identity is malformed.')
  }
  if (status !== '') throw new Error('Backup requires a completely clean worktree.')
  if (mergeBase !== originMain) throw new Error('origin/main must be an ancestor of backup HEAD.')
  return { branch, head, originMain }
}

async function collectChangedTrackedPaths(cwd: string): Promise<string[]> {
  const output = await git(cwd, [
    'diff',
    '--name-only',
    '--diff-filter=ACMRT',
    'origin/main...HEAD',
    '--',
  ])
  const paths = output ? output.split('\n') : []
  if (paths.length === 0 || paths.some((path) => path === '' || path.startsWith('../'))) {
    throw new Error('Backup requires a nonempty, valid tracked change set.')
  }
  return [...paths].sort((left, right) => left.localeCompare(right, 'en'))
}

async function ensurePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { mode: 0o700, recursive: true })
  await chmod(path, 0o700)
}

async function copyRegularFile(source: string, destination: string): Promise<CopiedFile> {
  const stat = await lstat(source)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing non-file input: ${source}`)
  const sourceBytes = await readFile(source)
  const sourceSha256 = sha256(sourceBytes)
  await ensurePrivateDirectory(dirname(destination))
  await copyFile(source, destination)
  await chmod(destination, 0o600)
  const bytes = await readFile(destination)
  const sourceAfterCopy = await readFile(source)
  if (
    bytes.byteLength !== stat.size ||
    sourceAfterCopy.byteLength !== sourceBytes.byteLength ||
    sha256(sourceAfterCopy) !== sourceSha256 ||
    sha256(bytes) !== sourceSha256
  ) {
    throw new Error(`Backup copy verification failed: ${source}`)
  }
  return { bytes: bytes.byteLength, destination, sha256: sourceSha256, source }
}

async function copyEvidenceTree(
  source: string,
  destination: string,
  files: CopiedFile[],
): Promise<void> {
  const stat = await lstat(source)
  if (stat.isSymbolicLink()) throw new Error(`Evidence symlinks are forbidden: ${source}`)
  if (stat.isFile()) {
    files.push(await copyRegularFile(source, destination))
    return
  }
  if (!stat.isDirectory()) throw new Error(`Unsupported evidence input: ${source}`)
  await ensurePrivateDirectory(destination)
  const entries = await readdir(source, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Evidence symlinks are forbidden: ${entry.name}`)
    await copyEvidenceTree(join(source, entry.name), join(destination, entry.name), files)
  }
}

interface ReadEvidenceTree {
  documents: unknown[]
  files: Map<string, Buffer>
  fileNames: string[]
}

async function readEvidenceTree(source: string, root = source): Promise<ReadEvidenceTree> {
  const stat = await lstat(source)
  if (stat.isSymbolicLink()) throw new Error(`Evidence symlinks are forbidden: ${source}`)
  if (stat.isFile()) {
    const fileName = source === root ? basename(source) : relative(root, source)
    const bytes = await readFile(source)
    if (!source.endsWith('.json')) {
      return { documents: [], files: new Map([[fileName, bytes]]), fileNames: [fileName] }
    }
    try {
      return {
        documents: [JSON.parse(bytes.toString('utf8')) as unknown],
        files: new Map([[fileName, bytes]]),
        fileNames: [fileName],
      }
    } catch (error) {
      throw new Error(
        `Evidence JSON is malformed at ${source}: ${error instanceof Error ? error.message : String(error)}.`,
      )
    }
  }
  if (!stat.isDirectory()) throw new Error(`Unsupported evidence input: ${source}`)
  const entries = await readdir(source, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))
  const result: ReadEvidenceTree = { documents: [], files: new Map(), fileNames: [] }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Evidence symlinks are forbidden: ${entry.name}`)
    const child = await readEvidenceTree(join(source, entry.name), root)
    result.documents.push(...child.documents)
    for (const [name, bytes] of child.files) result.files.set(name, bytes)
    result.fileNames.push(...child.fileNames)
  }
  return result
}

async function resolveUniqueEvidenceSources(
  evidence: readonly EvidenceArgument[],
): Promise<Map<RequiredEvidenceName, string>> {
  const result = new Map<RequiredEvidenceName, string>()
  const resolvedSources: string[] = []
  for (const item of evidence) {
    const name = item.name as RequiredEvidenceName
    const argumentPath = resolve(item.source)
    await readEvidenceTree(argumentPath)
    const source = await realpath(argumentPath)
    if (
      resolvedSources.some(
        (existing) =>
          existing === source || isWithin(existing, source) || isWithin(source, existing),
      )
    ) {
      throw new Error('Evidence sources must be unique and non-overlapping.')
    }
    resolvedSources.push(source)
    result.set(name, source)
  }
  return result
}

async function buildBackupAuthorization(cwd: string): Promise<{
  authorization: GoldImportContractV2BackupAuthorization
  operatorBundle: ProtectedV2OperatorBundle
}> {
  const operatorBundle = await buildProtectedV2OperatorBundle({ cwd })
  const localExpectedCatalog = buildProtectedV2ExpectedCatalogBinding(
    'local_supabase_postgres_owner_v1',
    'local',
  )
  const disposableExpectedCatalog = buildProtectedV2ExpectedCatalogBinding(
    'supabase_admin_owner_v1',
    'disposable',
  )
  assertProtectedV2ExpectedCatalogArtifactSealed({
    binding: localExpectedCatalog,
    bundle: operatorBundle,
    profileId: 'local_supabase_postgres_owner_v1',
    target: 'local',
  })
  assertProtectedV2ExpectedCatalogArtifactSealed({
    binding: disposableExpectedCatalog,
    bundle: operatorBundle,
    profileId: 'supabase_admin_owner_v1',
    target: 'disposable',
  })
  const protectedRuntimeBundle = buildProtectedV2RuntimeBundleBinding(operatorBundle)
  return {
    authorization: {
      disposableExpectedCatalog,
      localExpectedCatalog,
      protectedRuntimeBundle,
    },
    operatorBundle,
  }
}

function verifyCopiedExactPackage(evidenceFiles: ReadonlyMap<string, Buffer>): void {
  const manifestSuffix = 'exact-package-v2/checksum-manifest-v2.sha256'
  const manifests = [...evidenceFiles.keys()].filter((name) => name.endsWith(manifestSuffix))
  if (manifests.length !== 1) {
    throw new Error('Backup requires exactly one copied canonical exact-package V2 manifest.')
  }
  const prefix = manifests[0]!.slice(0, -manifestSuffix.length)
  const files = new Map<string, Buffer>()
  for (const [name, bytes] of evidenceFiles) {
    const packagePrefix = `${prefix}exact-package-v2/`
    if (name.startsWith(packagePrefix)) files.set(name.slice(packagePrefix.length), bytes)
  }
  const names = [...files.keys()].sort()
  if (!exactJson(names, [...EXACT_PACKAGE_FILE_NAMES].sort())) {
    throw new Error('Copied exact-package V2 file inventory is incomplete or unexpected.')
  }
  for (const [name, bytes] of files) {
    if (!name.endsWith('.json')) continue
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown
    if (!bytes.equals(Buffer.from(canonicalJson(parsed), 'utf8'))) {
      throw new Error(`Copied exact-package JSON is noncanonical: ${name}.`)
    }
  }
  const plan = parseImportPlanV2(
    JSON.parse(files.get('immutable-atomic-import-plan-v2.json')!.toString('utf8')) as unknown,
  )
  const sourceAuthorizationBytes = files.get('source-authorization-set-v4.json')!
  const sourceAuthorization = validateGoldImportSourceAuthorizationSetV4(
    JSON.parse(sourceAuthorizationBytes.toString('utf8')) as unknown,
  )
  const packageDescriptor = JSON.parse(
    files.get('package-descriptor-v2.json')!.toString('utf8'),
  ) as unknown
  if (!isRecord(packageDescriptor)) {
    throw new Error('Copied exact-package descriptor is not a JSON object.')
  }
  const exactCatalogBinding = JSON.parse(
    files.get('exact-catalog-binding-v2.json')!.toString('utf8'),
  ) as unknown
  if (!isRecord(exactCatalogBinding)) {
    throw new Error('Copied exact-catalog binding is not a JSON object.')
  }
  const expectedCatalog = validateProtectedV2ExpectedCatalogBinding(
    exactCatalogBinding.expectedCatalog,
    'supabase_admin_owner_v1',
    'disposable',
  )
  const completeCatalogAudit = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    exactCatalogBinding.completeCatalogAudit,
    'supabase_admin_owner_v1',
    'disposable',
  )
  const expectedArtifactHashes = Object.fromEntries(
    [...files]
      .filter(
        ([name]) => name !== 'checksum-manifest-v2.sha256' && name !== 'package-descriptor-v2.json',
      )
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => [name, sha256(bytes)]),
  )
  const manifest = files.get('checksum-manifest-v2.sha256')!
  const expectedManifest = [...files]
    .filter(([name]) => name !== 'checksum-manifest-v2.sha256')
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`)
    .join('')
  const descriptorMigration = isRecord(packageDescriptor.migration)
    ? packageDescriptor.migration
    : {}
  if (
    manifest.toString('utf8') !== expectedManifest ||
    exactCatalogBinding.schemaVersion !==
      'gold-import-compensation-v2-exact-catalog-binding/1.0.0' ||
    exactCatalogBinding.auditTarget !== 'disposable_clone' ||
    exactCatalogBinding.authorization !== 'exact_committed_expected_state' ||
    packageDescriptor.schemaVersion !== PACKAGE_DESCRIPTOR_SCHEMA_VERSION ||
    packageDescriptor.kind !== 'gold_import_compensation_package' ||
    packageDescriptor.auditTarget !== 'disposable_clone' ||
    packageDescriptor.databaseAccess !== 'none_file_only_authenticated_audit' ||
    packageDescriptor.heldOutIdentitiesAccessed !== false ||
    packageDescriptor.remoteAccess !== false ||
    !exactJson(packageDescriptor.artifacts, expectedArtifactHashes) ||
    !exactJson(packageDescriptor.actionCounts, plan.counts) ||
    packageDescriptor.importOperationId !== plan.operationId ||
    packageDescriptor.importPlanSha256 !== plan.binding.contentSha256 ||
    packageDescriptor.sourceAuthorizationSetSha256 !== sha256(sourceAuthorizationBytes) ||
    packageDescriptor.expectedCatalogBindingSha256 !== expectedCatalog.bindingSha256 ||
    packageDescriptor.expectedCatalogArtifactContentSha256 !==
      expectedCatalog.artifact.contentSha256 ||
    packageDescriptor.expectedCatalogArtifactFileSha256 !== expectedCatalog.artifact.fileSha256 ||
    packageDescriptor.completeCatalogAuditIdentitySha256 !==
      completeCatalogAudit.fullAuditIdentitySha256 ||
    descriptorMigration.sha256 !== sourceAuthorization.migration.sha256 ||
    plan.sourceAuthorizationSetSha256 !== sha256(sourceAuthorizationBytes) ||
    plan.noteDispositionAuditSha256 !== sourceAuthorization.noteDispositionAuditSha256 ||
    plan.booleanNormalizationLedgerSha256 !==
      sourceAuthorization.booleanNormalizationLedgerSha256 ||
    plan.orderedSetNormalizationLedgerSha256 !==
      sourceAuthorization.orderedSetNormalizationLedgerSha256 ||
    !exactJson(sourceAuthorization.expectedCatalog, expectedCatalog) ||
    !exactJson(sourceAuthorization.completeCatalogAudit, completeCatalogAudit)
  ) {
    throw new Error('Copied exact-package manifest or cross-artifact bindings are invalid.')
  }
  verifyGoldImportCompensationPackageV2IntrinsicFiles(files)
}

export function validateGoldImportContractV2BackupSemanticEvidenceForTest(input: {
  authorization: GoldImportContractV2BackupAuthorization
  documents: ReadonlyMap<RequiredEvidenceName, readonly unknown[]>
  files: ReadonlyMap<RequiredEvidenceName, ReadonlyMap<string, Buffer>>
  fileNames: ReadonlyMap<RequiredEvidenceName, readonly string[]>
  operatorBundle: ProtectedV2OperatorBundle
  repository: BackupRepositoryIdentity
}): SemanticEvidenceValidation {
  return validateSemanticEvidenceDocuments(input)
}

async function writePrivate(path: string, value: string): Promise<void> {
  await ensurePrivateDirectory(dirname(path))
  await writeFile(path, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  await chmod(path, 0o600)
}

async function listFiles(root: string, directory = root): Promise<string[]> {
  const result: string[] = []
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error('Created backup contains a symlink.')
    if (entry.isDirectory()) result.push(...(await listFiles(root, path)))
    else if (entry.isFile()) result.push(relative(root, path))
    else throw new Error('Created backup contains an unsupported filesystem entry.')
  }
  return result
}

export async function createGoldImportContractV2ForwardRepairBackup(input: {
  cwd: string
  evidence: EvidenceArgument[]
  now?: () => Date
  output: string
  outputRoot: string
}) {
  assertCompleteEvidenceInventory(input.evidence)
  const repository = await inspectRepository(input.cwd)
  const expectedName = `gold-import-contract-v2-forward-repair-v1-${repository.head}`
  if (basename(resolve(input.output)) !== expectedName) {
    throw new Error(`Backup output basename must be ${expectedName}.`)
  }
  const paths = await assertOutputPath(input.outputRoot, input.output)
  const v1Bytes = await readFile(join(input.cwd, GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH))
  if (sha256(v1Bytes) !== GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256) {
    throw new Error('Historical V1 migration byte identity changed.')
  }
  const changedPaths = await collectChangedTrackedPaths(input.cwd)
  const { authorization, operatorBundle } = await buildBackupAuthorization(input.cwd)
  const evidenceSources = await resolveUniqueEvidenceSources(input.evidence)
  if (
    [...evidenceSources.values()].some(
      (source) => source === paths.output || isWithin(source, paths.output),
    )
  ) {
    throw new Error('An evidence source cannot contain the backup output path.')
  }
  const evidenceDocuments = new Map<RequiredEvidenceName, readonly unknown[]>()
  const evidenceFilesByName = new Map<RequiredEvidenceName, ReadonlyMap<string, Buffer>>()
  const evidenceFileNames = new Map<RequiredEvidenceName, readonly string[]>()
  for (const name of REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES) {
    const evidence = await readEvidenceTree(evidenceSources.get(name)!)
    evidenceDocuments.set(name, evidence.documents)
    evidenceFilesByName.set(name, evidence.files)
    evidenceFileNames.set(name, evidence.fileNames)
  }
  validateSemanticEvidenceDocuments({
    authorization,
    documents: evidenceDocuments,
    files: evidenceFilesByName,
    fileNames: evidenceFileNames,
    operatorBundle,
    repository,
  })

  await ensurePrivateDirectory(paths.output)
  const trackedFiles: CopiedFile[] = []
  for (const path of changedPaths) {
    trackedFiles.push(
      await copyRegularFile(join(input.cwd, path), join(paths.output, 'tracked', path)),
    )
  }
  const evidenceFiles: CopiedFile[] = []
  for (const evidence of [...input.evidence].sort((left, right) =>
    left.name.localeCompare(right.name, 'en'),
  )) {
    const source = evidenceSources.get(evidence.name as RequiredEvidenceName)!
    const beforeFileCount = evidenceFiles.length
    await copyEvidenceTree(source, join(paths.output, 'evidence', evidence.name), evidenceFiles)
    if (evidenceFiles.length === beforeFileCount) {
      throw new Error(`Required evidence input is empty: ${evidence.name}.`)
    }
  }
  const copiedEvidenceDocuments = new Map<RequiredEvidenceName, readonly unknown[]>()
  const copiedEvidenceFilesByName = new Map<RequiredEvidenceName, ReadonlyMap<string, Buffer>>()
  const copiedEvidenceFileNames = new Map<RequiredEvidenceName, readonly string[]>()
  for (const name of REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES) {
    const evidence = await readEvidenceTree(join(paths.output, 'evidence', name))
    copiedEvidenceDocuments.set(name, evidence.documents)
    copiedEvidenceFilesByName.set(name, evidence.files)
    copiedEvidenceFileNames.set(name, evidence.fileNames)
    if (name === 'package-rehearsal-evidence') verifyCopiedExactPackage(evidence.files)
  }
  const semanticEvidence = validateSemanticEvidenceDocuments({
    authorization,
    documents: copiedEvidenceDocuments,
    files: copiedEvidenceFilesByName,
    fileNames: copiedEvidenceFileNames,
    operatorBundle,
    repository,
  })
  const finalRepository = await inspectRepository(input.cwd)
  if (!exactJson(finalRepository, repository)) {
    throw new Error('Repository identity changed while the backup was being captured.')
  }
  const finalOperatorBundle = await buildProtectedV2OperatorBundle({ cwd: input.cwd })
  if (!exactJson(finalOperatorBundle, operatorBundle)) {
    throw new Error('Protected runtime bundle changed while the backup was being captured.')
  }
  validateProtectedV2RuntimeBundleBinding(authorization.protectedRuntimeBundle, finalOperatorBundle)

  const portable = (file: CopiedFile) => ({
    bytes: file.bytes,
    destination: relative(paths.output, file.destination),
    sha256: file.sha256,
    source: file.source,
  })
  const manifest = {
    schemaVersion: GOLD_IMPORT_CONTRACT_V2_BACKUP_SCHEMA_VERSION,
    repository,
    authorization,
    semanticEvidence,
    historicalV1Migration: {
      path: GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH,
      sha256: GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256,
      byteIdentical: true,
    },
    requiredEvidenceNames: REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES,
    trackedFiles: trackedFiles.map(portable),
    evidenceFiles: evidenceFiles.map(portable),
    safety: {
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccessed: false,
      sourceArtifactsModified: false,
      signedAuthorizationsModified: false,
    },
  }
  const manifestPath = join(paths.output, 'backup-manifest.json')
  await writePrivate(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const canonicalFiles = (await listFiles(paths.output)).filter(
    (path) => path !== 'checksum-manifest.sha256' && path !== 'backup-receipt.json',
  )
  const checksumLines: string[] = []
  for (const path of canonicalFiles) {
    checksumLines.push(`${sha256(await readFile(join(paths.output, path)))}  ${path}`)
  }
  const checksumManifest = `${checksumLines.join('\n')}\n`
  const checksumManifestPath = join(paths.output, 'checksum-manifest.sha256')
  await writePrivate(checksumManifestPath, checksumManifest)

  for (const line of checksumLines) {
    const match = /^([a-f0-9]{64})  (.+)$/u.exec(line)
    if (!match || sha256(await readFile(join(paths.output, match[2]!))) !== match[1]) {
      throw new Error('Backup checksum verification failed.')
    }
  }
  const receiptRepository = await inspectRepository(input.cwd)
  const receiptOperatorBundle = await buildProtectedV2OperatorBundle({ cwd: input.cwd })
  if (
    !exactJson(receiptRepository, repository) ||
    !exactJson(receiptOperatorBundle, operatorBundle)
  ) {
    throw new Error('Repository or protected bundle changed before backup receipt sealing.')
  }
  validateProtectedV2RuntimeBundleBinding(
    authorization.protectedRuntimeBundle,
    receiptOperatorBundle,
  )
  const receiptAuthorization = {
    disposableExpectedCatalog: {
      artifactContentSha256: authorization.disposableExpectedCatalog.artifact.contentSha256,
      artifactFileSha256: authorization.disposableExpectedCatalog.artifact.fileSha256,
      bindingSha256: authorization.disposableExpectedCatalog.bindingSha256,
      fullAuditIdentitySha256: authorization.disposableExpectedCatalog.fullAuditIdentitySha256,
      fullEnvironmentInventoryIdentitySha256:
        authorization.disposableExpectedCatalog.fullEnvironmentInventoryIdentitySha256,
    },
    localExpectedCatalog: {
      artifactContentSha256: authorization.localExpectedCatalog.artifact.contentSha256,
      artifactFileSha256: authorization.localExpectedCatalog.artifact.fileSha256,
      bindingSha256: authorization.localExpectedCatalog.bindingSha256,
      fullAuditIdentitySha256: authorization.localExpectedCatalog.fullAuditIdentitySha256,
      fullEnvironmentInventoryIdentitySha256:
        authorization.localExpectedCatalog.fullEnvironmentInventoryIdentitySha256,
    },
    protectedRuntimeBundle: {
      aggregateSha256: authorization.protectedRuntimeBundle.aggregateSha256,
      bindingSha256: authorization.protectedRuntimeBundle.bindingSha256,
      moduleResolutionAuditSha256: authorization.protectedRuntimeBundle.moduleResolutionAuditSha256,
      runtimeInputAuditSha256: authorization.protectedRuntimeBundle.runtimeInputAuditSha256,
      runtimeInputDeclarationSha256:
        authorization.protectedRuntimeBundle.runtimeInputDeclarationSha256,
      trackedFileCount: authorization.protectedRuntimeBundle.trackedFileCount,
      trackedFileInventorySha256: authorization.protectedRuntimeBundle.trackedFileInventorySha256,
    },
  }
  const receiptContent = {
    schemaVersion: GOLD_IMPORT_CONTRACT_V2_BACKUP_RECEIPT_SCHEMA_VERSION,
    executedAt: (input.now ?? (() => new Date()))().toISOString(),
    outputDirectory: paths.output,
    repositoryCommitSha: repository.head,
    authorization: receiptAuthorization,
    canonicalFileCount: canonicalFiles.length,
    copiedEvidenceFileCount: evidenceFiles.length,
    copiedTrackedFileCount: trackedFiles.length,
    backupManifestSha256: sha256(await readFile(manifestPath)),
    checksumManifestSha256: sha256(await readFile(checksumManifestPath)),
    verificationPassed: true,
    databaseAccessed: false,
    databaseMutationCount: 0,
    heldOutIdentitiesAccessed: false,
    remoteDatabaseAccessed: false,
  }
  const receipt = {
    ...receiptContent,
    contentSha256: sha256(canonicalJson(receiptContent)),
  }
  await writePrivate(
    join(paths.output, 'backup-receipt.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
  )
  return { manifest, receipt }
}

async function main(): Promise<void> {
  const arguments_ = parseGoldImportContractV2BackupArguments(process.argv.slice(2))
  const result = await createGoldImportContractV2ForwardRepairBackup({
    cwd: process.cwd(),
    ...arguments_,
  })
  process.stdout.write(
    `${JSON.stringify(
      {
        outputDirectory: result.receipt.outputDirectory,
        backupManifestSha256: result.receipt.backupManifestSha256,
        checksumManifestSha256: result.receipt.checksumManifestSha256,
        verificationPassed: true,
      },
      null,
      2,
    )}\n`,
  )
}

if (process.argv[1]?.endsWith('create-gold-import-contract-v2-forward-repair-backup.ts')) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
