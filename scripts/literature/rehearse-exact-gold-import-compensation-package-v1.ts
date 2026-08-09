import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
  bindCompensationAuthorization,
  bindCompensationPlan,
  bindImportAuthorization,
  bindRecoveryAuthorization,
  canonicalJson,
  compensationActionSchema,
  parseCompensationReceipt,
  parseImportReceipt,
  parseImportPlan,
  rejectLegacyPointerRewindRollback,
  sha256Canonical,
  type CompensationAction,
  type ImportAction,
  type ImportPlan,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  AMENDED_TWO_ROW_AUTHORIZATION_SHA256,
  EXACT_COMPENSATION_COUNTS,
  EXACT_IMPORT_COUNTS,
  FINAL_V3_ARTIFACT_SHA256,
  MIGRATION_ID,
  MIGRATION_SHA256,
  PACKAGE_GENERATOR_SCHEMA_VERSION,
  PACKAGE_VERSION,
  PRODUCTION_SOURCE_IDENTITIES,
  SIGNED_PROTOCOL_AUTHORIZATION_SHA256,
  deterministicPackageUuid,
  developmentPlanningStateSha256,
  verifyReadyPostMigrationAuditPackage,
  type PackageSourceBytes,
  type PackageSourceIdentityPolicy,
} from './generate-gold-import-compensation-package-v1'
import {
  loadAndVerifyBackup,
  type LoadedPreMigrationBackup,
} from './gold-import-compensation-migration-operations'
import {
  assertLocalDockerEndpoint,
  buildCanonicalScenarioEvidence,
  extractSqlScenarioEvidence,
  sanitizeRehearsalChildEnvironment,
  validateSecurityIntrospection,
  validateSqlScenarioEvidence,
  validateSupabaseLint,
} from './gold-import-compensation-rehearsal-evidence'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  assertExclusiveOutputDirectoryIdentity,
  assertSafeOutputPathArgument,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
  type ExclusiveOutputDirectoryIdentity,
} from './lib/exclusive-output'
import { SECURITY_INTROSPECTION_SQL } from './rehearse-gold-import-compensation-db'

export const EXACT_PACKAGE_REHEARSAL_SCHEMA_VERSION =
  'gold-import-compensation-exact-package-rehearsal/v1' as const
export const DISPOSABLE_ATTESTATION_SCHEMA_VERSION =
  'gold-import-compensation-disposable-attestation/v1' as const
export const EXACT_PACKAGE_EVIDENCE_SCHEMA_VERSION =
  'gold-import-compensation-exact-package-evidence/v1' as const
export const DEVELOPMENT_DATABASE_SEED_SCHEMA_VERSION =
  'gold-import-compensation-development-seed/v1' as const

export const DISPOSABLE_POSTGRES_IMAGE =
  'public.ecr.aws/supabase/postgres:17.6.1.104@sha256:5deba92e50cd17bfacf8603834d317cdf3bfc1c016ec8293991997fa3b55fa3d' as const
const POSTGRES_IMAGE = DISPOSABLE_POSTGRES_IMAGE
const PROTECTED_REAL_LOCAL_DATABASE_PORT = '55322'
const CONTRACT_VERIFICATION =
  '20260808035633_verify_literature_gold_import_compensation_contract.sql'
const MIGRATIONS = [
  '20260727032621_add_literature_explorer.sql',
  '20260727164510_add_literature_gold_set.sql',
  '20260727190000_add_literature_gold_review_categories.sql',
  '20260727193432_add_literature_full_text_categorization_flag.sql',
  '20260728170939_add_interactive_clinical_case_publication_status.sql',
  '20260728171212_add_immune_inflammatory_disease_tag.sql',
  '20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
  '20260730194025_add_literature_gold_test_unlock.sql',
  `${MIGRATION_ID}.sql`,
] as const
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const DOCKER_CONTEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u
const REHEARSAL_RUN_NONCE_LABEL = 'org.interventionalpulm.gold-rehearsal-run-nonce'
const sha256Schema = z.string().regex(SHA256_PATTERN)
const uuidSchema = z.string().regex(UUID_PATTERN)

const REQUIRED_PACKAGE_FILES = [
  'append-only-compensation-plan-template.json',
  'ambiguous-outcome-reconciliation.json',
  'checksum-manifest.sha256',
  'compensation-authorization-template.json',
  'compensation-readiness.json',
  'immutable-atomic-import-plan.json',
  'import-authorization-template.json',
  'import-journal-template.json',
  'import-receipt-template.json',
  'package-descriptor.json',
  'post-migration-audit-manifest.sha256',
  'post-migration-audit.json',
  'post-migration-audit.md',
  'post-migration-development-planning-state.json',
  'post-migration-schema-security-definition-identity.json',
  'proposed-compensation-command.txt',
  'proposed-import-command.txt',
  'row-level-action-plan.json',
  'source-authorization-set.json',
  'state-hash-proof.json',
] as const

const sourceIdentitiesSchema = z
  .object({
    amendedAuthorizationSha256: sha256Schema,
    finalArtifactSha256: sha256Schema,
    migrationSha256: sha256Schema,
    protocolAuthorizationSha256: sha256Schema,
  })
  .strict()

const packageDescriptorSchema = z
  .object({
    audit: z
      .object({
        canonicalManifestSha256: sha256Schema,
        contentSha256: sha256Schema,
        developmentPlanningStateFileSha256: sha256Schema,
        developmentPlanningStateSha256: sha256Schema,
        markdownSha256: sha256Schema,
        preMigrationBackupManifestSha256: sha256Schema,
        preMigrationPhysicalStateSha256: sha256Schema,
        schemaSecurityDefinitionIdentityFileSha256: sha256Schema,
        schemaSecurityIdentitySha256: sha256Schema,
        stateFresh: z.literal(true),
      })
      .strict(),
    compensation: z
      .object({
        counts: z
          .object({
            noops: z.number().int(),
            restored: z.number().int(),
            total: z.number().int(),
            voided: z.number().int(),
          })
          .strict(),
        operationId: uuidSchema,
        planTemplateSha256: sha256Schema,
        readyToExecute: z.literal(false),
      })
      .strict(),
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    databaseAccess: z.literal('none_package_uses_read_only_post_migration_audit'),
    databaseMutation: z.literal(false),
    heldOutIdentitiesAccessed: z.literal(false),
    import: z
      .object({
        counts: z
          .object({
            initial: z.number().int(),
            inserts: z.number().int(),
            noops: z.number().int(),
            revisions: z.number().int(),
            total: z.number().int(),
          })
          .strict(),
        idempotencyKey: sha256Schema,
        operationId: uuidSchema,
        planSha256: sha256Schema,
      })
      .strict(),
    kind: z.literal('gold_import_compensation_package'),
    migration: z.object({ id: z.literal(MIGRATION_ID), sha256: sha256Schema }).strict(),
    packageVersion: z.literal(PACKAGE_VERSION),
    schemaVersion: z.literal(PACKAGE_GENERATOR_SCHEMA_VERSION),
    sources: sourceIdentitiesSchema,
  })
  .strict()

const physicalExpectationSchema = z
  .object({
    hash: z.null(),
    rule: z.literal('database_observed_at_execution'),
    source: z.string().min(1),
  })
  .strict()

const compensationTemplateSchema = z
  .object({
    actions: z.array(compensationActionSchema),
    batchId: uuidSchema,
    binding: z.object({ contentSha256: sha256Schema }).strict(),
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION),
    counts: z
      .object({
        noops: z.number().int(),
        restored: z.number().int(),
        total: z.number().int(),
        voided: z.number().int(),
      })
      .strict(),
    executionContext: z
      .object({
        compensationRpc: z.literal('compensate_literature_gold_import_v1'),
        developmentMembershipHash: z.literal('literature_gold_development_membership_hash_v1'),
        effectiveStateHash: z.literal('literature_gold_effective_state_hash_v1'),
        importRpc: z.literal('apply_literature_gold_import_v1'),
        migrationId: z.literal(MIGRATION_ID),
        physicalStateHash: z.literal('literature_gold_physical_state_hash_v1'),
        reconciliationRpc: z.literal('reconcile_literature_gold_review_operation_v1'),
        remoteWritesAllowed: z.literal(false),
        repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/u),
        targetDatabase: z.literal('local'),
      })
      .strict(),
    expectedEffectiveStateSha256: sha256Schema,
    expectedPhysicalState: physicalExpectationSchema,
    expectedPostEffectiveStateSha256: sha256Schema,
    expectedPostPhysicalState: physicalExpectationSchema.extend({
      mustDifferFromPostImport: z.literal(true),
      mustDifferFromPreImport: z.literal(true),
    }),
    importPlanSha256: sha256Schema,
    importReceiptSha256: z.null(),
    idempotency: z
      .object({
        derivationContextSha256: sha256Schema,
        key: z.null(),
        rule: z.literal('derive_after_import_receipt_and_fresh_physical_state_are_bound'),
      })
      .strict(),
    kind: z.literal('compensation_plan_template'),
    operationId: uuidSchema,
    readiness: z.literal('awaiting_committed_import_receipt_and_separate_authorization'),
    scope: z
      .object({
        datasetSplit: z.literal('development'),
        developmentMembershipSha256: sha256Schema,
        heldOutIdentitiesAccessed: z.literal(false),
      })
      .strict(),
    sourceArtifactSha256: sha256Schema,
    targetImportOperationId: uuidSchema,
  })
  .strict()

export const disposableDatabaseAttestationSchema = z
  .object({
    containerId: z.string().regex(/^[a-f0-9]{12,64}$/u),
    databaseCreatedForThisRun: z.literal(true),
    databaseFingerprintSha256: sha256Schema,
    databaseHostPort: z.string().regex(/^\d{1,5}$/u),
    databaseName: z.string().regex(/^gold_compensation_rehearsal_[a-z0-9_]+$/u),
    databaseUrl: z.string().url(),
    dockerEndpoint: z.string().min(1),
    existingIdempotencyKeys: z.array(sha256Schema),
    existingOperationIds: z.array(uuidSchema),
    migration: z
      .object({
        id: z.literal(MIGRATION_ID),
        ledgerOccurrences: z.literal(1),
        sha256: sha256Schema,
      })
      .strict(),
    outputDirectoryWasAbsent: z.literal(true),
    packageManifestSha256: sha256Schema,
    protectedRealLocalDatabasePort: z.literal(PROTECTED_REAL_LOCAL_DATABASE_PORT),
    schemaVersion: z.literal(DISPOSABLE_ATTESTATION_SCHEMA_VERSION),
    seedEffectiveStateSha256: sha256Schema,
    seedPhysicalStateSha256: sha256Schema,
    targetKind: z.literal('fresh_disposable_database'),
  })
  .strict()
export type DisposableDatabaseAttestation = z.infer<typeof disposableDatabaseAttestationSchema>

const databaseSeedRowSchema = z.record(z.string(), z.unknown())
export const developmentDatabaseSeedSchema = z
  .object({
    batchId: uuidSchema,
    datasetSplit: z.literal('development'),
    heldOutIdentitiesIncluded: z.literal(false),
    schemaVersion: z.literal(DEVELOPMENT_DATABASE_SEED_SCHEMA_VERSION),
    tables: z
      .object({
        literature_articles: z.array(databaseSeedRowSchema),
        literature_gold_set_batches: z.array(databaseSeedRowSchema),
        literature_gold_set_events: z.array(databaseSeedRowSchema),
        literature_gold_set_items: z.array(databaseSeedRowSchema),
        literature_gold_set_review_drafts: z.array(databaseSeedRowSchema),
        literature_gold_set_reviews: z.array(databaseSeedRowSchema),
      })
      .strict(),
  })
  .strict()
export type DevelopmentDatabaseSeed = z.infer<typeof developmentDatabaseSeedSchema>

const exactEvidenceScenarioSchema = z
  .object({
    ambiguousLostAcknowledgementReconciledWithoutRetry: z.literal(true),
    currentPointerAlwaysLatestPhysicalHead: z.literal(true),
    exactReplayIdempotent: z.literal(true),
    heldOutScopeRejected: z.literal(true),
    heldOutIdentityDisclosureCount: z.literal(0),
    oldPointerRewindPackageRejected: z.literal(true),
    ordinaryReviewAfterRestorePassed: z.literal(true),
    ordinaryReviewAfterVoidPassed: z.literal(true),
    secondCompensationRejectedOrVerifiedExisting: z.literal(true),
    staleAuthorizationRejected: z.literal(true),
    staleDatabaseStateRejected: z.literal(true),
    wrongOperationIdRejected: z.literal(true),
  })
  .strict()

const exactEvidenceSecuritySchema = z
  .object({
    appendOnlyTriggersEnabled: z.literal(true),
    lintErrorCount: z.literal(0),
    onlyAllowlistedVolatilityWarnings: z.literal(true),
    ordinaryRolesHaveNoImmutableMutationPrivilege: z.literal(true),
    prohibitedPrivilegesAbsent: z.literal(true),
    publicExecuteAbsent: z.literal(true),
    requiredRlsEnabled: z.literal(true),
    schemaSecurityDefinitionIdentitySha256: sha256Schema,
    securityDefinerSearchPathsSafe: z.literal(true),
    serviceRoleGuardedBoundaryOnly: z.literal(true),
  })
  .strict()

export const exactPackageRehearsalEvidenceSchema = z
  .object({
    compensationCounts: z.object({
      noops: z.number().int(),
      restored: z.number().int(),
      total: z.number().int(),
      voided: z.number().int(),
    }),
    deterministicArtifacts: z.literal(false),
    effectiveState: z
      .object({
        postCompensationSha256: sha256Schema,
        postImportSha256: sha256Schema,
        preImportSha256: sha256Schema,
      })
      .strict(),
    importCounts: z.object({
      initial: z.number().int(),
      inserts: z.number().int(),
      noops: z.number().int(),
      revisions: z.number().int(),
      total: z.number().int(),
    }),
    migration: z.object({ id: z.literal(MIGRATION_ID), sha256: sha256Schema }).strict(),
    packageManifestSha256: sha256Schema,
    physicalState: z
      .object({
        postCompensationSha256: sha256Schema,
        postImportSha256: sha256Schema,
        preImportSha256: sha256Schema,
      })
      .strict(),
    scenarioArtifactsSha256: sha256Schema,
    scenarios: exactEvidenceScenarioSchema,
    schemaVersion: z.literal(EXACT_PACKAGE_EVIDENCE_SCHEMA_VERSION),
    security: exactEvidenceSecuritySchema,
    targetDatabaseFingerprintSha256: sha256Schema,
  })
  .strict()
export type ExactPackageRehearsalEvidence = z.infer<typeof exactPackageRehearsalEvidenceSchema>

export interface VerifiedExactPackage {
  compensationActions: CompensationAction[]
  compensationOperationId: string
  descriptor: z.infer<typeof packageDescriptorSchema>
  files: ReadonlyMap<string, Buffer>
  importPlan: ImportPlan
  manifestSha256: string
}

export interface VerifiedDevelopmentDatabaseBackup {
  manifestSha256: string
  provenance: {
    batchId: string
    developmentMembershipSha256: string
    effectiveStateSha256: string
    physicalStateSha256: string
    planningStateSha256: string
    repositoryCommitSha: string
  } | null
  seed: DevelopmentDatabaseSeed
  seedSql: string
}

export interface ExactPackageDisposableExecutor {
  execute(request: {
    attestation: DisposableDatabaseAttestation
    package: VerifiedExactPackage
  }): Promise<unknown>
}

export interface ExactPackageRehearsalReport {
  contractVersion: typeof GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION
  databaseMutationOutsideDisposableTarget: false
  deterministicArtifacts: true
  evidenceSha256: string
  heldOutIdentitiesAccessed: false
  importCounts: typeof EXACT_IMPORT_COUNTS
  compensationCounts: typeof EXACT_COMPENSATION_COUNTS
  migrationId: typeof MIGRATION_ID
  migrationSha256: string
  packageManifestSha256: string
  physicalEqualityAfterCompensationClaimed: false
  realLocalDatabaseTouched: false
  remoteDatabaseTouched: false
  result: 'passed'
  schemaSecurityDefinitionIdentitySha256: string
  schemaVersion: typeof EXACT_PACKAGE_REHEARSAL_SCHEMA_VERSION
  targetDatabase: {
    image: typeof POSTGRES_IMAGE
    kind: 'fresh_disposable_database'
    network: 'docker_assigned_loopback_only'
  }
}

export function normalizeExactPackageRehearsalEvidence(evidence: ExactPackageRehearsalEvidence) {
  return {
    compensationCounts: evidence.compensationCounts,
    deterministicArtifacts: true,
    effectiveState: evidence.effectiveState,
    importCounts: evidence.importCounts,
    migration: evidence.migration,
    packageManifestSha256: evidence.packageManifestSha256,
    physicalState: {
      preImportSha256: evidence.physicalState.preImportSha256,
      postImport: {
        equalityToken: 'database-observation-post-import',
        hash: null,
        mustDifferFromPreImport: true,
        rule: 'database_observed_at_execution',
      },
      postCompensation: {
        equalityToken: 'database-observation-post-compensation',
        hash: null,
        mustDifferFromPostImport: true,
        mustDifferFromPreImport: true,
        rule: 'database_observed_at_execution',
      },
    },
    scenarioArtifactsSha256: evidence.scenarioArtifactsSha256,
    scenarios: evidence.scenarios,
    schemaVersion: 'gold-import-compensation-exact-package-canonical-evidence/v1',
    security: evidence.security,
    targetDatabase: {
      image: POSTGRES_IMAGE,
      kind: 'fresh_disposable_database',
      network: 'docker_assigned_loopback_only',
    },
  } as const
}

type ValidatedSupabaseLint = ReturnType<typeof validateSupabaseLint>
type ValidatedSecurityIntrospection = ReturnType<typeof validateSecurityIntrospection>
type ValidatedExactRpcContract = ReturnType<typeof validateExactRpcContractMetadata>

function prettyCanonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`, 'utf8')
}

export function buildDeterministicExactPackageRehearsalArtifacts(input: {
  canonicalContractScenarioBytes: Buffer
  evidence: ExactPackageRehearsalEvidence
  lint: ValidatedSupabaseLint
  report: ExactPackageRehearsalReport
  rpcContract: ValidatedExactRpcContract
  securityIntrospection: ValidatedSecurityIntrospection
}) {
  if (
    sha256Bytes(input.canonicalContractScenarioBytes) !== input.evidence.scenarioArtifactsSha256
  ) {
    throw new Error('Canonical contract scenario artifact is stale relative to exact evidence.')
  }
  const canonicalEvidence = normalizeExactPackageRehearsalEvidence(input.evidence)
  const report: ExactPackageRehearsalReport = {
    ...input.report,
    deterministicArtifacts: true,
    evidenceSha256: sha256Canonical(canonicalEvidence),
    targetDatabase: {
      image: POSTGRES_IMAGE,
      kind: 'fresh_disposable_database',
      network: 'docker_assigned_loopback_only',
    },
  }
  const canonicalArtifacts = new Map<string, Buffer>([
    ['contract-scenarios.normalized.json', input.canonicalContractScenarioBytes],
    ['exact-package-scenario-evidence.json', prettyCanonicalBytes(canonicalEvidence)],
    [
      'import-compensation-state-hash-proof.json',
      prettyCanonicalBytes({
        deterministicArtifacts: true,
        effectiveState: canonicalEvidence.effectiveState,
        physicalEqualityAfterCompensationClaimed: false,
        physicalState: canonicalEvidence.physicalState,
        schemaVersion: 'gold-import-compensation-canonical-state-hash-proof/v1',
      }),
    ],
    [
      'lint-security-report.json',
      prettyCanonicalBytes({
        allChecksPassed: true,
        database: canonicalEvidence.targetDatabase,
        deterministicArtifacts: true,
        lint: input.lint,
        rpcContract: input.rpcContract,
        schemaVersion: 'gold-import-compensation-canonical-lint-security/v1',
        securityIntrospection: input.securityIntrospection,
      }),
    ],
    ['package-rehearsal-report.json', prettyCanonicalBytes(report)],
  ])
  const manifestBytes = Buffer.from(
    `${[...canonicalArtifacts.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256Bytes(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
  return { canonicalArtifacts, manifestBytes, report } as const
}

function sha256Bytes(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function parseJson(bytes: Buffer, label: string): unknown {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

function assertSourceIdentities(
  actual: z.infer<typeof sourceIdentitiesSchema>,
  policy: PackageSourceIdentityPolicy,
): void {
  const expected = {
    amendedAuthorizationSha256: policy.amendedAuthorizationSha256,
    finalArtifactSha256: policy.finalArtifactSha256,
    migrationSha256: policy.migrationSha256,
    protocolAuthorizationSha256: policy.protocolAuthorizationSha256,
  }
  if (!same(actual, expected)) {
    throw new Error('Exact package source artifact or authorization identity is stale.')
  }
}

function manifestEntries(bytes: Buffer): Map<string, string> {
  const text = bytes.toString('utf8')
  if (!text.endsWith('\n')) throw new Error('Package checksum manifest must end in one newline.')
  const entries = new Map<string, string>()
  let previous = ''
  for (const line of text.slice(0, -1).split('\n')) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(line)
    if (!match) throw new Error('Package checksum manifest contains a malformed entry.')
    const [, checksum, name] = match
    if (name <= previous) throw new Error('Package checksum manifest is not strictly sorted.')
    if (entries.has(name)) throw new Error(`Duplicate package manifest entry: ${name}.`)
    entries.set(name, checksum)
    previous = name
  }
  return entries
}

function requiredSeedString(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (typeof value !== 'string' || !value) {
    throw new Error(`Development backup has an invalid required ${field} field.`)
  }
  return value
}

function assertAllowedKeys(
  value: unknown,
  allowedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.includes(key))
  if (unexpected.length > 0) {
    throw new Error(`${label} contains non-allowlisted fields: ${unexpected.join(', ')}.`)
  }
}

function assertSafeBatchPayload(batch: Record<string, unknown>): void {
  assertAllowedKeys(
    batch,
    [
      'created_at',
      'created_by_email',
      'created_by_user_id',
      'frozen_at',
      'id',
      'kind',
      'label_schema_version',
      'name',
      'relevance_definition_version',
      'requested_size',
      'sampling_algorithm_version',
      'sampling_report',
      'sampling_seed',
      'status',
      'taxonomy_version',
      'test_percent',
      'test_unlock_reason',
      'test_unlocked_at',
      'test_unlocked_by_email',
      'test_unlocked_by_user_id',
      'updated_at',
    ],
    'Development backup batch row',
  )
  if (batch.sampling_report !== undefined) {
    assertAllowedKeys(
      batch.sampling_report,
      [
        'broadTopicsRepresented',
        'broadTopicsUnavailable',
        'candidateCount',
        'countsByAbstractAvailability',
        'countsByDeterministicBand',
        'countsByJournal',
        'countsBySourceTier',
        'countsByStratum',
        'countsByYearBand',
        'developmentCount',
        'excludedCandidateCount',
        'exclusionSources',
        'kind',
        'name',
        'originalCandidateCount',
        'reportVersion',
        'requestedSize',
        'samplingAlgorithmVersion',
        'samplingSeed',
        'selectedCount',
        'testCount',
        'warnings',
      ],
      'Development backup aggregate sampling report',
    )
    const exclusionSources = batch.sampling_report.exclusionSources
    if (!Array.isArray(exclusionSources)) {
      throw new Error('Development backup aggregate exclusionSources must be an array.')
    }
    for (const [index, source] of exclusionSources.entries()) {
      assertAllowedKeys(
        source,
        [
          'batchNames',
          'corpusPresentCount',
          'eligibleCount',
          'excludedCount',
          'path',
          'sha256',
          'sourceType',
          'suppliedCount',
        ],
        `Development backup exclusionSources[${index}]`,
      )
    }
  }
}

function assertSafeBatchLevelEvent(event: Record<string, unknown>): void {
  assertAllowedKeys(
    event,
    [
      'actor_email',
      'actor_user_id',
      'after_value',
      'batch_id',
      'before_value',
      'created_at',
      'event_type',
      'id',
      'item_id',
    ],
    'Development backup batch-level event',
  )
  if (event.event_type !== 'batch_created' || event.before_value !== null) {
    throw new Error('Development backup contains an unapproved batch-level event.')
  }
  assertAllowedKeys(
    event.after_value,
    ['kind', 'name', 'requested_size', 'sampling_seed'],
    'Development backup batch_created after_value',
  )
}

function assertSafeItemLevelEvent(event: Record<string, unknown>): void {
  assertAllowedKeys(
    event,
    [
      'actor_email',
      'actor_user_id',
      'after_value',
      'batch_id',
      'before_value',
      'created_at',
      'event_type',
      'id',
      'item_id',
    ],
    'Development backup item-level event',
  )
  if (event.event_type === 'draft_saved') {
    if (event.before_value !== null) {
      throw new Error('Development backup draft_saved before_value must be null.')
    }
    assertAllowedKeys(
      event.after_value,
      ['review_seconds'],
      'Development backup draft_saved after_value',
    )
    return
  }
  if (event.event_type === 'review_completed' || event.event_type === 'review_revised') {
    if (event.event_type === 'review_completed') {
      if (event.before_value !== null) {
        throw new Error('Development backup review_completed before_value must be null.')
      }
    } else {
      assertAllowedKeys(
        event.before_value,
        ['review_id'],
        'Development backup review_revised before_value',
      )
    }
    assertAllowedKeys(
      event.after_value,
      ['is_blinded', 'relevance_label', 'review_id', 'revision'],
      'Development backup completed-review after_value',
    )
    return
  }
  if (
    [
      'automated_signals_revealed',
      'returned_later',
      'review_resumed',
      'supplemental_metadata_revealed',
    ].includes(String(event.event_type))
  ) {
    assertAllowedKeys(
      event.before_value,
      ['review_status'],
      'Development backup item-state before_value',
    )
    assertAllowedKeys(
      event.after_value,
      ['review_status'],
      'Development backup item-state after_value',
    )
    return
  }
  throw new Error(`Development backup item-level event type ${String(event.event_type)} is unsafe.`)
}

function seedJsonLiteral(value: unknown): string {
  const json = canonicalJson(value)
  const tag = `$seed_${sha256Bytes(json).slice(0, 16)}$`
  if (json.includes(tag)) throw new Error('Development backup JSON delimiter collision.')
  return `${tag}${json}${tag}`
}

export function renderDevelopmentDatabaseSeedSql(seed: DevelopmentDatabaseSeed): string {
  const orderedTables = [
    'literature_articles',
    'literature_gold_set_batches',
    'literature_gold_set_items',
    'literature_gold_set_reviews',
    'literature_gold_set_review_drafts',
    'literature_gold_set_events',
  ] as const
  return [
    'begin;',
    "set local session_replication_role = 'replica';",
    ...orderedTables.map(
      (table) =>
        `insert into public.${table} select * from pg_catalog.jsonb_populate_recordset(null::public.${table}, ${seedJsonLiteral(seed.tables[table])}::jsonb);`,
    ),
    "set local session_replication_role = 'origin';",
    'commit;',
    '',
  ].join('\n')
}

function assertDevelopmentSeedScope(seed: DevelopmentDatabaseSeed): void {
  const batches = seed.tables.literature_gold_set_batches
  const items = seed.tables.literature_gold_set_items
  const articles = seed.tables.literature_articles
  const reviews = seed.tables.literature_gold_set_reviews
  const drafts = seed.tables.literature_gold_set_review_drafts
  const events = seed.tables.literature_gold_set_events
  if (
    batches.length !== 1 ||
    requiredSeedString(batches[0], 'id') !== seed.batchId ||
    items.length !== EXACT_IMPORT_COUNTS.total
  ) {
    throw new Error('Development backup must contain one batch and exactly 630 items.')
  }
  assertSafeBatchPayload(batches[0])
  const itemIds = new Set<string>()
  const pmids = new Set<string>()
  for (const item of items) {
    if (
      item.dataset_split !== 'development' ||
      requiredSeedString(item, 'batch_id') !== seed.batchId
    ) {
      throw new Error('Held-out or cross-batch item entered the development backup.')
    }
    itemIds.add(requiredSeedString(item, 'id'))
    pmids.add(requiredSeedString(item, 'pmid'))
  }
  if (
    itemIds.size !== items.length ||
    pmids.size !== items.length ||
    articles.length !== items.length
  ) {
    throw new Error('Development backup item/article identities are incomplete or duplicated.')
  }
  const articlePmids = new Set(articles.map((article) => requiredSeedString(article, 'pmid')))
  if (articlePmids.size !== pmids.size || [...articlePmids].some((pmid) => !pmids.has(pmid))) {
    throw new Error('An article outside exact development membership entered the backup.')
  }
  const reviewIds = new Set<string>()
  const reviewItemById = new Map<string, string>()
  for (const review of reviews) {
    const itemId = requiredSeedString(review, 'item_id')
    const reviewId = requiredSeedString(review, 'id')
    if (!itemIds.has(itemId) || reviewIds.has(reviewId)) {
      throw new Error('Development backup review history is cross-scope or duplicated.')
    }
    reviewIds.add(reviewId)
    reviewItemById.set(reviewId, itemId)
  }
  for (const review of reviews) {
    const supersedes = review.supersedes_review_id
    if (
      supersedes !== null &&
      (typeof supersedes !== 'string' ||
        reviewItemById.get(supersedes) !== requiredSeedString(review, 'item_id'))
    ) {
      throw new Error('Development backup contains a cross-item review chain.')
    }
  }
  for (const item of items) {
    const current = item.current_review_id
    if (
      current !== null &&
      (typeof current !== 'string' ||
        reviewItemById.get(current) !== requiredSeedString(item, 'id'))
    ) {
      throw new Error('Development backup current-review pointer is not in its review history.')
    }
  }
  if (
    drafts.some((draft) => !itemIds.has(requiredSeedString(draft, 'item_id'))) ||
    events.some((event) => {
      if (requiredSeedString(event, 'batch_id') !== seed.batchId) return true
      if (event.item_id === null) {
        assertSafeBatchLevelEvent(event)
        return false
      }
      if (typeof event.item_id !== 'string' || !itemIds.has(event.item_id)) return true
      assertSafeItemLevelEvent(event)
      return false
    })
  ) {
    throw new Error('Held-out identity or cross-batch row entered the development backup.')
  }
}

export function verifyDevelopmentDatabaseBackupFixtureForTest(
  files: ReadonlyMap<string, Buffer>,
  expectedManifestSha256: string,
): VerifiedDevelopmentDatabaseBackup {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Reduced backup fixture verification is restricted to tests.')
  }
  if (!files.has('development-database-seed.json') || !files.has('checksum-manifest.sha256')) {
    throw new Error('Pre-migration backup handoff is missing the seed or checksum manifest.')
  }
  const manifest = files.get('checksum-manifest.sha256') as Buffer
  if (sha256Bytes(manifest) !== expectedManifestSha256) {
    throw new Error('Pre-migration backup manifest is stale relative to the generated package.')
  }
  const entries = manifestEntries(manifest)
  if (entries.size !== files.size - 1) {
    throw new Error('Pre-migration backup handoff contains an unmanifested canonical artifact.')
  }
  for (const [name, checksum] of entries) {
    const bytes = files.get(name)
    if (!bytes || sha256Bytes(bytes) !== checksum) {
      throw new Error(`Pre-migration backup checksum mismatch for ${name}.`)
    }
  }
  const expectedSeedSha256 = entries.get('development-database-seed.json')
  const seedBytes = files.get('development-database-seed.json') as Buffer
  if (!expectedSeedSha256 || sha256Bytes(seedBytes) !== expectedSeedSha256) {
    throw new Error('Pre-migration backup manifest does not exactly bind the development seed.')
  }
  const seed = developmentDatabaseSeedSchema.parse(
    parseJson(seedBytes, 'development-database-seed.json'),
  )
  assertDevelopmentSeedScope(seed)
  return {
    manifestSha256: sha256Bytes(manifest),
    provenance: null,
    seed,
    seedSql: renderDevelopmentDatabaseSeedSql(seed),
  }
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a string.`)
  return value
}

/**
 * Cross-bind the fully verified B/C backup inventory to the exact package.
 * loadAndVerifyBackup has already authenticated every canonical backup file,
 * provenance receipt, schema/ledger baseline, source identity, and seed/state
 * relationship; this boundary proves those identities are the ones the exact
 * package was generated against.
 */
export function verifyLoadedPreMigrationBackupForPackage(input: {
  loaded: LoadedPreMigrationBackup
  package: VerifiedExactPackage
  trustedManifestSha256: string
}): VerifiedDevelopmentDatabaseBackup {
  const { loaded, package: package_, trustedManifestSha256 } = input
  if (
    !SHA256_PATTERN.test(trustedManifestSha256) ||
    loaded.manifestSha256 !== trustedManifestSha256 ||
    trustedManifestSha256 !== package_.descriptor.audit.preMigrationBackupManifestSha256
  ) {
    throw new Error('Reviewed pre-migration backup manifest is not bound to the exact package.')
  }
  const seed = developmentDatabaseSeedSchema.parse(loaded.developmentSeed)
  assertDevelopmentSeedScope(seed)
  const receipt = requiredRecord(loaded.receipt, 'Pre-migration backup receipt')
  const databaseIdentity = requiredRecord(
    receipt.databaseIdentity,
    'Pre-migration backup database identity',
  )
  const receiptHashes = requiredRecord(receipt.hashes, 'Pre-migration backup receipt hashes')
  const batch = requiredRecord(loaded.batchAndTestLock.batch, 'Pre-migration backup batch identity')
  const batchId = requiredString(batch.id, 'Pre-migration backup batch ID')
  const developmentMembershipSha256 = requiredString(
    databaseIdentity.developmentMembershipSha256,
    'Pre-migration backup development membership SHA-256',
  )
  const effectiveStateSha256 = requiredString(
    loaded.stateAudits.effectiveStateSha256,
    'Pre-migration backup effective-state SHA-256',
  )
  const physicalStateSha256 = requiredString(
    loaded.stateAudits.physicalStateSha256,
    'Pre-migration backup physical-state SHA-256',
  )
  const repositoryCommitSha = requiredString(
    receipt.repositoryCommitSha,
    'Pre-migration backup repository commit SHA',
  )
  const planningStateSha256 = developmentPlanningStateSha256(loaded.planningState)
  if (
    seed.batchId !== batchId ||
    batchId !== requiredString(databaseIdentity.batchId, 'Backup database batch ID') ||
    batchId !== package_.importPlan.batchId ||
    developmentMembershipSha256 !== package_.importPlan.scope.developmentMembershipSha256 ||
    effectiveStateSha256 !== package_.importPlan.expectedEffectiveStateSha256 ||
    receiptHashes.effectiveStateSha256 !== effectiveStateSha256 ||
    physicalStateSha256 !== package_.descriptor.audit.preMigrationPhysicalStateSha256 ||
    receiptHashes.physicalStateSha256 !== physicalStateSha256 ||
    repositoryCommitSha !== package_.importPlan.executionContext.repositoryCommitSha ||
    planningStateSha256 !== package_.descriptor.audit.developmentPlanningStateSha256
  ) {
    throw new Error(
      'Pre-migration backup receipt, batch, membership, state, planning, or seed identity is stale relative to the exact package.',
    )
  }
  return {
    manifestSha256: loaded.manifestSha256,
    provenance: {
      batchId,
      developmentMembershipSha256,
      effectiveStateSha256,
      physicalStateSha256,
      planningStateSha256,
      repositoryCommitSha,
    },
    seed,
    seedSql: renderDevelopmentDatabaseSeedSql(seed),
  }
}

export function assertExactPackageSourceBytes(
  package_: VerifiedExactPackage,
  sources: PackageSourceBytes,
): void {
  const actual = {
    amendedAuthorizationSha256: sha256Bytes(sources.amendedAuthorization),
    finalArtifactSha256: sha256Bytes(sources.finalArtifact),
    migrationSha256: sha256Bytes(sources.migration),
    protocolAuthorizationSha256: sha256Bytes(sources.protocolAuthorization),
  }
  if (!same(actual, package_.descriptor.sources)) {
    throw new Error(
      'Rehearsal source artifact or authorization bytes are missing, stale, or replaced.',
    )
  }
}

function assertExactImportCounts(plan: ImportPlan): void {
  if (!same(plan.counts, EXACT_IMPORT_COUNTS)) {
    throw new Error('Disposable rehearsal requires the exact 621/3/6 import package.')
  }
  const computed = {
    initial: plan.actions.filter((action) => action.action === 'import_initial').length,
    inserts: plan.actions.filter((action) => action.action !== 'import_noop').length,
    noops: plan.actions.filter((action) => action.action === 'import_noop').length,
    revisions: plan.actions.filter((action) => action.action === 'import_revision').length,
    total: plan.actions.length,
  }
  if (!same(computed, EXACT_IMPORT_COUNTS)) {
    throw new Error('Import plan counts do not match its exact row actions.')
  }
}

function assertCompensationMapping(
  importActions: readonly ImportAction[],
  compensationActions: readonly CompensationAction[],
): void {
  const counts = {
    noops: compensationActions.filter((action) => action.action === 'compensate_noop').length,
    restored: compensationActions.filter((action) => action.action === 'compensate_restore').length,
    total: compensationActions.length,
    voided: compensationActions.filter((action) => action.action === 'compensate_void').length,
  }
  if (!same(counts, EXACT_COMPENSATION_COUNTS)) {
    throw new Error('Disposable rehearsal requires exactly 621 void + 3 restore + 6 no-action.')
  }
  const compensationBySource = new Map(
    compensationActions.map((action) => [action.sourceActionId, action]),
  )
  if (compensationBySource.size !== importActions.length) {
    throw new Error('Compensation does not map every import action exactly once.')
  }
  for (const source of importActions) {
    const compensation = compensationBySource.get(source.actionId)
    if (
      !compensation ||
      compensation.itemId !== source.itemId ||
      compensation.pmid !== source.pmid
    ) {
      throw new Error('Compensation source action identity or item binding is invalid.')
    }
    const expectedAction =
      source.action === 'import_initial'
        ? 'compensate_void'
        : source.action === 'import_revision'
          ? 'compensate_restore'
          : 'compensate_noop'
    if (compensation.action !== expectedAction) {
      throw new Error(`Wrong compensation class for import action ${source.actionId}.`)
    }
    if (compensation.action === 'compensate_noop') continue
    if (
      compensation.expectedSupersedesReviewId !== source.importedReviewId ||
      compensation.expectedCurrentReviewId !== source.importedReviewId ||
      compensation.expectedHeadReviewIdAfter !== compensation.compensationReviewId ||
      compensation.expectedHeadReviewIdAfter === source.importedReviewId ||
      compensation.expectedHeadReviewIdAfter === compensation.effectiveSourceReviewId
    ) {
      throw new Error('Old pointer-rewind compensation package rejected.')
    }
  }
}

function reconstructExpectedCompensationTemplate(
  importPlan: ImportPlan,
): z.infer<typeof compensationTemplateSchema> {
  const operationId = deterministicPackageUuid(
    PACKAGE_VERSION,
    importPlan.binding.contentSha256,
    'compensation-operation',
  )
  const actions = importPlan.actions.map((source): CompensationAction => {
    const actionId = deterministicPackageUuid(
      PACKAGE_VERSION,
      operationId,
      'compensation-action',
      source.itemId,
    )
    const common = {
      actionId,
      datasetSplit: 'development' as const,
      itemId: source.itemId,
      pmid: source.pmid,
      sequence: source.sequence,
      sourceActionId: source.actionId,
    }
    if (source.action === 'import_noop') {
      return compensationActionSchema.parse({
        ...common,
        action: 'compensate_noop',
        compensationReviewId: null,
        effectiveSourceReviewId: source.expectedEffectiveReviewId,
        expectedCurrentReviewId: source.expectedCurrentReviewId,
        expectedEffectiveReviewId: source.expectedEffectiveReviewId,
        expectedEffectiveReviewIdAfter: source.expectedEffectiveReviewId,
        expectedEventSequence: [],
        expectedHeadReviewIdAfter: source.expectedCurrentReviewId,
        expectedRevision: null,
        expectedSupersedesReviewId: null,
        importedReviewId: null,
      })
    }
    const compensationReviewId = deterministicPackageUuid(
      PACKAGE_VERSION,
      operationId,
      'compensation-review',
      source.itemId,
    )
    if (source.action === 'import_initial') {
      return compensationActionSchema.parse({
        ...common,
        action: 'compensate_void',
        compensationReviewId,
        effectiveSourceReviewId: null,
        expectedCurrentReviewId: source.importedReviewId,
        expectedEffectiveReviewId: source.importedReviewId,
        expectedEffectiveReviewIdAfter: null,
        expectedEventSequence: ['review_voided'],
        expectedHeadReviewIdAfter: compensationReviewId,
        expectedRevision: source.expectedRevision + 1,
        expectedSupersedesReviewId: source.importedReviewId,
        importedReviewId: source.importedReviewId,
      })
    }
    return compensationActionSchema.parse({
      ...common,
      action: 'compensate_restore',
      compensationReviewId,
      effectiveSourceReviewId: source.expectedEffectiveReviewId,
      expectedCurrentReviewId: source.importedReviewId,
      expectedEffectiveReviewId: source.importedReviewId,
      expectedEffectiveReviewIdAfter: source.expectedEffectiveReviewId,
      expectedEventSequence: ['review_compensated'],
      expectedHeadReviewIdAfter: compensationReviewId,
      expectedRevision: source.expectedRevision + 1,
      expectedSupersedesReviewId: source.importedReviewId,
      importedReviewId: source.importedReviewId,
    })
  })
  const content = {
    actions,
    batchId: importPlan.batchId,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    counts: EXACT_COMPENSATION_COUNTS,
    executionContext: importPlan.executionContext,
    expectedEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
    expectedPhysicalState: {
      hash: null,
      rule: 'database_observed_at_execution' as const,
      source: 'committed_import_receipt.afterPhysicalStateSha256' as const,
    },
    expectedPostEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
    expectedPostPhysicalState: {
      hash: null,
      mustDifferFromPostImport: true as const,
      mustDifferFromPreImport: true as const,
      rule: 'database_observed_at_execution' as const,
      source: 'committed_compensation_receipt.afterPhysicalStateSha256' as const,
    },
    importPlanSha256: importPlan.binding.contentSha256,
    importReceiptSha256: null,
    idempotency: {
      derivationContextSha256: sha256Canonical({
        contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
        importPlanSha256: importPlan.binding.contentSha256,
        kind: 'compensation',
        operationId,
        targetImportOperationId: importPlan.operationId,
      }),
      key: null,
      rule: 'derive_after_import_receipt_and_fresh_physical_state_are_bound' as const,
    },
    kind: 'compensation_plan_template' as const,
    operationId,
    readiness: 'awaiting_committed_import_receipt_and_separate_authorization' as const,
    scope: importPlan.scope,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    targetImportOperationId: importPlan.operationId,
  }
  return compensationTemplateSchema.parse({
    ...content,
    binding: { contentSha256: sha256Canonical(content) },
  })
}

function assertJsonArtifactEquals(
  files: ReadonlyMap<string, Buffer>,
  name: string,
  expected: unknown,
): void {
  const bytes = files.get(name)
  if (!bytes || !same(parseJson(bytes, name), expected)) {
    throw new Error(`Exact package semantic binding mismatch for ${name}.`)
  }
}

function assertAllPackageArtifactsSemanticallyBound(input: {
  compensation: z.infer<typeof compensationTemplateSchema>
  descriptor: z.infer<typeof packageDescriptorSchema>
  files: ReadonlyMap<string, Buffer>
  importPlan: ImportPlan
}): void {
  const { compensation, descriptor, files, importPlan } = input
  const auditBytes = files.get('post-migration-audit.json') as Buffer
  const developmentPlanningStateBytes = files.get(
    'post-migration-development-planning-state.json',
  ) as Buffer
  const auditManifestBytes = files.get('post-migration-audit-manifest.sha256') as Buffer
  const auditMarkdownBytes = files.get('post-migration-audit.md') as Buffer
  const schemaSecurityDefinitionIdentityBytes = files.get(
    'post-migration-schema-security-definition-identity.json',
  ) as Buffer
  const verifiedAudit = verifyReadyPostMigrationAuditPackage({
    auditBytes,
    developmentPlanningStateBytes,
    manifestBytes: auditManifestBytes,
    markdownBytes: auditMarkdownBytes,
    schemaSecurityDefinitionIdentityBytes,
    trustedManifestSha256: descriptor.audit.canonicalManifestSha256,
  })
  const audit = verifiedAudit.audit
  if (
    sha256Bytes(auditBytes) !== descriptor.audit.contentSha256 ||
    sha256Bytes(developmentPlanningStateBytes) !==
      descriptor.audit.developmentPlanningStateFileSha256 ||
    sha256Bytes(auditMarkdownBytes) !== descriptor.audit.markdownSha256 ||
    sha256Bytes(schemaSecurityDefinitionIdentityBytes) !==
      descriptor.audit.schemaSecurityDefinitionIdentityFileSha256 ||
    audit.database.developmentPlanningStateSha256 !==
      descriptor.audit.developmentPlanningStateSha256 ||
    audit.database.preMigrationBackupManifestSha256 !==
      descriptor.audit.preMigrationBackupManifestSha256 ||
    audit.comparisons.preexistingPhysicalStateBeforeSha256 !==
      descriptor.audit.preMigrationPhysicalStateSha256 ||
    audit.database.schemaSecurityIdentitySha256 !== descriptor.audit.schemaSecurityIdentitySha256 ||
    audit.database.batchId !== importPlan.batchId ||
    audit.database.repositoryCommitSha !== importPlan.executionContext.repositoryCommitSha ||
    audit.database.currentEffectiveStateSha256 !== importPlan.expectedEffectiveStateSha256 ||
    audit.database.currentPhysicalStateSha256 !== importPlan.expectedPhysicalStateSha256 ||
    audit.database.developmentMembershipSha256 !== importPlan.scope.developmentMembershipSha256
  ) {
    throw new Error('Embedded post-migration audit package is not cross-bound to the import plan.')
  }
  const sourceAuthorizationSet = {
    amendedTwoRowAuthorizationSha256: descriptor.sources.amendedAuthorizationSha256,
    finalArtifactSha256: descriptor.sources.finalArtifactSha256,
    kind: 'gold_import_source_authorization_set',
    signedProtocolAuthorizationSha256: descriptor.sources.protocolAuthorizationSha256,
    sourceDecisionsChanged: false,
    version: 1,
  }
  const sourceAuthorizationBytes = files.get('source-authorization-set.json')
  if (
    !sourceAuthorizationBytes ||
    sha256Bytes(sourceAuthorizationBytes) !== importPlan.sourceAuthorizationSetSha256
  ) {
    throw new Error('Source authorization set bytes are not bound to the immutable import plan.')
  }
  assertJsonArtifactEquals(files, 'source-authorization-set.json', sourceAuthorizationSet)
  const rowBindings = importPlan.actions.map((importAction, index) => {
    const compensationAction = compensation.actions[index]
    if (!compensationAction || compensationAction.sourceActionId !== importAction.actionId) {
      throw new Error('Exact row action sequence is not one-to-one and order preserving.')
    }
    return {
      compensationActionId: compensationAction.actionId,
      compensationOperation: {
        derivationContextSha256: compensation.idempotency.derivationContextSha256,
        idempotencyKey: null,
        operationId: compensation.operationId,
        rule: compensation.idempotency.rule,
      },
      idempotencyScope: 'operation_not_per_action',
      importActionId: importAction.actionId,
      importOperation: {
        idempotencyKey: importPlan.binding.idempotencyKey,
        operationId: importPlan.operationId,
      },
      itemId: importAction.itemId,
      perActionIdempotencyKey: null,
      pmid: importAction.pmid,
      sequence: importAction.sequence,
    }
  })
  assertJsonArtifactEquals(files, 'row-level-action-plan.json', {
    compensationActions: compensation.actions,
    importActions: importPlan.actions,
    rowBindings,
    schemaVersion: 'gold-import-compensation-row-actions/v1',
  })
  assertJsonArtifactEquals(files, 'import-authorization-template.json', {
    authorized: null,
    authorizedAt: null,
    authorizedBy: null,
    authorizationId: null,
    authorizationNote: null,
    binding: null,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    expectedEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
    expectedPostEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
    idempotencyKey: importPlan.binding.idempotencyKey,
    kind: 'import_authorization',
    migrationId: MIGRATION_ID,
    operationId: importPlan.operationId,
    planSha256: importPlan.binding.contentSha256,
    readiness: 'unsigned_separate_import_authorization_required',
    remoteWritesAllowed: false,
    repositoryCommitSha: importPlan.executionContext.repositoryCommitSha,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    targetDatabase: 'local',
  })
  assertJsonArtifactEquals(files, 'compensation-authorization-template.json', {
    authorized: null,
    authorizedAt: null,
    authorizedBy: null,
    authorizationId: null,
    authorizationNote: null,
    binding: null,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    expectedEffectiveStateSha256: compensation.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: null,
    expectedPostEffectiveStateSha256: compensation.expectedPostEffectiveStateSha256,
    idempotencyKey: null,
    idempotencyKeyDerivation: compensation.idempotency,
    importReceiptSha256: null,
    kind: 'compensation_authorization',
    migrationId: MIGRATION_ID,
    operationId: compensation.operationId,
    planSha256: null,
    readiness: 'requires_committed_import_receipt_fresh_state_and_separate_authorization',
    remoteWritesAllowed: false,
    repositoryCommitSha: importPlan.executionContext.repositoryCommitSha,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    targetDatabase: 'local',
    targetImportOperationId: importPlan.operationId,
  })
  assertJsonArtifactEquals(files, 'import-journal-template.json', {
    actionCount: EXACT_IMPORT_COUNTS.total,
    idempotencyKey: importPlan.binding.idempotencyKey,
    operationId: importPlan.operationId,
    outcome: null,
    planSha256: importPlan.binding.contentSha256,
    status: 'not_executed',
  })
  assertJsonArtifactEquals(files, 'import-receipt-template.json', {
    afterEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
    afterPhysicalStateSha256: null,
    beforeEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
    beforePhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
    operationId: importPlan.operationId,
    outcome: null,
    physicalHashRule: 'database_observed_at_execution',
    status: 'not_executed',
  })
  assertJsonArtifactEquals(files, 'state-hash-proof.json', {
    compensation: {
      expectedEffectiveStateSha256: compensation.expectedEffectiveStateSha256,
      expectedPhysicalState: compensation.expectedPhysicalState,
      expectedPostEffectiveStateSha256: compensation.expectedPostEffectiveStateSha256,
      expectedPostPhysicalState: compensation.expectedPostPhysicalState,
    },
    import: {
      expectedEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
      expectedPostEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
      expectedPostPhysicalState: {
        hash: null,
        mustDifferFromPreImport: true,
        rule: 'database_observed_at_execution',
        source: 'committed_import_receipt.afterPhysicalStateSha256',
      },
    },
    invariant:
      'Append-only compensation restores effective state but never claims physical database equality.',
    schemaVersion: 'gold-import-compensation-state-hash-proof/v1',
  })
  assertJsonArtifactEquals(files, 'compensation-readiness.json', {
    actionCounts: EXACT_COMPENSATION_COUNTS,
    appendOnly: true,
    currentPointerAlwaysLatestPhysicalHead: true,
    importExecuted: false,
    noDeleteOrUpdateOfImportedReview: true,
    noPointerNullingWithImportedHistory: true,
    noPointerRewind: true,
    readyToExecute: false,
    reason:
      'A committed import receipt, fresh database-observed physical state, finalized compensation plan, and separate compensation authorization do not yet exist.',
    schemaSecurityIdentitySha256: descriptor.audit.schemaSecurityIdentitySha256,
    sourceMappingComplete: true,
  })
  assertJsonArtifactEquals(files, 'ambiguous-outcome-reconciliation.json', {
    automaticRetryAllowed: false,
    compensation: {
      nextStep:
        'Do not create or retry compensation until the import receipt is reconciled and a fresh compensation plan is separately authorized.',
      operationId: compensation.operationId,
      targetImportOperationId: importPlan.operationId,
    },
    import: {
      nextStep:
        'Use a separately authorized read-only reconcile command for the exact operation ID, plan hash, and idempotency key.',
      operationId: importPlan.operationId,
      planSha256: importPlan.binding.contentSha256,
    },
    kind: 'ambiguous_outcome_reconciliation_instructions',
    recoveryMutationsAllowed: false,
  })
  const importCommand = files.get('proposed-import-command.txt')?.toString('utf8')
  const compensationCommand = files.get('proposed-compensation-command.txt')?.toString('utf8')
  if (
    importCommand !==
      'npm run literature:gold-import-compensation -- execute-import --plan immutable-atomic-import-plan.json --authorization <SEPARATELY_SIGNED_IMPORT_AUTHORIZATION> --artifact <FINAL_V3_ARTIFACT> --source-authorization-set source-authorization-set.json --receipt <EXCLUSIVE_RECEIPT_PATH> --target local\n' ||
    compensationCommand !==
      'npm run literature:gold-import-compensation -- execute-compensation --plan <FINALIZED_COMPENSATION_PLAN> --authorization <SEPARATELY_SIGNED_COMPENSATION_AUTHORIZATION> --artifact <FINAL_V3_ARTIFACT> --receipt <EXCLUSIVE_RECEIPT_PATH> --target local\n'
  ) {
    throw new Error('Proposed commands lost guarded placeholders or their local-only target.')
  }
}

export function verifyExactGeneratedPackage(
  files: ReadonlyMap<string, Buffer>,
  identityPolicy: PackageSourceIdentityPolicy = PRODUCTION_SOURCE_IDENTITIES,
): VerifiedExactPackage {
  for (const required of REQUIRED_PACKAGE_FILES) {
    if (!files.has(required)) throw new Error(`Exact package is missing ${required}.`)
  }
  if (files.size !== REQUIRED_PACKAGE_FILES.length) {
    throw new Error('Exact package contains unmanifested or unexpected artifacts.')
  }
  const manifestBytes = files.get('checksum-manifest.sha256') as Buffer
  const entries = manifestEntries(manifestBytes)
  if (entries.size !== files.size - 1) {
    throw new Error('Package manifest must cover every artifact except itself.')
  }
  for (const [name, checksum] of entries) {
    const bytes = files.get(name)
    if (!bytes || sha256Bytes(bytes) !== checksum) {
      throw new Error(`Package manifest checksum mismatch for ${name}.`)
    }
  }
  const descriptor = packageDescriptorSchema.parse(
    parseJson(files.get('package-descriptor.json') as Buffer, 'package-descriptor.json'),
  )
  assertSourceIdentities(descriptor.sources, identityPolicy)
  if (
    descriptor.migration.sha256 !== identityPolicy.migrationSha256 ||
    !same(descriptor.import.counts, EXACT_IMPORT_COUNTS) ||
    !same(descriptor.compensation.counts, EXACT_COMPENSATION_COUNTS)
  ) {
    throw new Error('Package descriptor is stale or has the wrong exact action counts.')
  }
  const importPlan = parseImportPlan(
    parseJson(
      files.get('immutable-atomic-import-plan.json') as Buffer,
      'immutable-atomic-import-plan.json',
    ),
  )
  assertExactImportCounts(importPlan)
  if (
    importPlan.binding.contentSha256 !== descriptor.import.planSha256 ||
    importPlan.binding.idempotencyKey !== descriptor.import.idempotencyKey ||
    importPlan.operationId !== descriptor.import.operationId ||
    importPlan.sourceArtifactSha256 !== identityPolicy.finalArtifactSha256 ||
    importPlan.executionContext.migrationId !== MIGRATION_ID
  ) {
    throw new Error('Import plan does not match its checksum-bound package descriptor.')
  }
  const compensationInput = parseJson(
    files.get('append-only-compensation-plan-template.json') as Buffer,
    'append-only-compensation-plan-template.json',
  )
  rejectLegacyPointerRewindRollback(compensationInput)
  const compensation = compensationTemplateSchema.parse(compensationInput)
  const reconstructedCompensation = reconstructExpectedCompensationTemplate(importPlan)
  const { binding, ...compensationContent } = compensation
  if (
    !same(compensation, reconstructedCompensation) ||
    binding.contentSha256 !== sha256Canonical(compensationContent) ||
    binding.contentSha256 !== descriptor.compensation.planTemplateSha256 ||
    compensation.operationId !== descriptor.compensation.operationId ||
    compensation.targetImportOperationId !== importPlan.operationId ||
    compensation.importPlanSha256 !== importPlan.binding.contentSha256 ||
    compensation.expectedEffectiveStateSha256 !== importPlan.expectedPostEffectiveStateSha256 ||
    compensation.expectedPostEffectiveStateSha256 !== importPlan.expectedEffectiveStateSha256 ||
    compensation.importReceiptSha256 !== null ||
    compensation.expectedPhysicalState.hash !== null ||
    compensation.expectedPhysicalState.source !==
      'committed_import_receipt.afterPhysicalStateSha256' ||
    compensation.expectedPostPhysicalState.hash !== null ||
    compensation.expectedPostPhysicalState.source !==
      'committed_compensation_receipt.afterPhysicalStateSha256' ||
    compensation.idempotency.derivationContextSha256 !==
      sha256Canonical({
        contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
        importPlanSha256: importPlan.binding.contentSha256,
        kind: 'compensation',
        operationId: compensation.operationId,
        targetImportOperationId: importPlan.operationId,
      })
  ) {
    throw new Error('Compensation template is stale, prematurely executable, or not plan-bound.')
  }
  if (compensation.operationId === importPlan.operationId) {
    throw new Error('Import and compensation operation identities collide.')
  }
  assertCompensationMapping(importPlan.actions, compensation.actions)
  assertAllPackageArtifactsSemanticallyBound({ compensation, descriptor, files, importPlan })
  return {
    compensationActions: compensation.actions,
    compensationOperationId: compensation.operationId,
    descriptor,
    files,
    importPlan,
    manifestSha256: sha256Bytes(manifestBytes),
  }
}

function assertLoopbackDatabaseUrl(
  urlText: string,
  expectedDatabaseName: string,
  expectedHostPort: string,
): void {
  const parsed = new URL(urlText)
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Disposable rehearsal requires a PostgreSQL URL.')
  }
  const host = parsed.hostname.toLowerCase()
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    throw new Error('Remote database refused: exact-package rehearsal is loopback-only.')
  }
  if (parsed.port !== expectedHostPort || parsed.port === PROTECTED_REAL_LOCAL_DATABASE_PORT) {
    throw new Error('Real local Supabase database refused by its reserved database port.')
  }
  if (decodeURIComponent(parsed.pathname.slice(1)) !== expectedDatabaseName) {
    throw new Error('Disposable database URL/name attestation mismatch.')
  }
}

export function assertDisposableRehearsalTarget(
  input: unknown,
  package_: VerifiedExactPackage,
): DisposableDatabaseAttestation {
  const attestation = disposableDatabaseAttestationSchema.parse(input)
  assertLocalDockerEndpoint(attestation.dockerEndpoint)
  assertLoopbackDatabaseUrl(
    attestation.databaseUrl,
    attestation.databaseName,
    attestation.databaseHostPort,
  )
  if (
    attestation.packageManifestSha256 !== package_.manifestSha256 ||
    attestation.migration.sha256 !== package_.descriptor.migration.sha256 ||
    attestation.seedPhysicalStateSha256 !== package_.importPlan.expectedPhysicalStateSha256 ||
    attestation.seedEffectiveStateSha256 !== package_.importPlan.expectedEffectiveStateSha256
  ) {
    throw new Error('Disposable target or exact package has stale migration/state hashes.')
  }
  const operationIds = new Set(attestation.existingOperationIds)
  const idempotencyKeys = new Set(attestation.existingIdempotencyKeys)
  if (
    operationIds.has(package_.importPlan.operationId) ||
    operationIds.has(package_.compensationOperationId) ||
    idempotencyKeys.has(package_.importPlan.binding.idempotencyKey)
  ) {
    throw new Error('Disposable target has an operation or idempotency collision.')
  }
  return attestation
}

export function validateExactPackageRehearsalEvidence(
  input: unknown,
  package_: VerifiedExactPackage,
  attestation: DisposableDatabaseAttestation,
): ExactPackageRehearsalEvidence {
  const evidence = exactPackageRehearsalEvidenceSchema.parse(input)
  if (
    evidence.packageManifestSha256 !== package_.manifestSha256 ||
    evidence.targetDatabaseFingerprintSha256 !== attestation.databaseFingerprintSha256 ||
    evidence.migration.sha256 !== package_.descriptor.migration.sha256 ||
    evidence.security.schemaSecurityDefinitionIdentitySha256 !==
      package_.descriptor.audit.schemaSecurityIdentitySha256 ||
    !same(evidence.importCounts, EXACT_IMPORT_COUNTS) ||
    !same(evidence.compensationCounts, EXACT_COMPENSATION_COUNTS)
  ) {
    throw new Error('Disposable scenario evidence is not bound to the exact generated package.')
  }
  if (
    evidence.effectiveState.preImportSha256 !== package_.importPlan.expectedEffectiveStateSha256 ||
    evidence.effectiveState.postImportSha256 !==
      package_.importPlan.expectedPostEffectiveStateSha256 ||
    evidence.effectiveState.postCompensationSha256 !== evidence.effectiveState.preImportSha256
  ) {
    throw new Error('Compensation did not restore the exact pre-import effective state.')
  }
  if (
    evidence.physicalState.preImportSha256 !== package_.importPlan.expectedPhysicalStateSha256 ||
    evidence.physicalState.postImportSha256 === evidence.physicalState.preImportSha256 ||
    evidence.physicalState.postCompensationSha256 === evidence.physicalState.postImportSha256 ||
    evidence.physicalState.postCompensationSha256 === evidence.physicalState.preImportSha256
  ) {
    throw new Error(
      'Append-only import/compensation physical state must remain distinct and database-observed.',
    )
  }
  return evidence
}

export async function runExactPackageDisposableRehearsal(input: {
  attestation: unknown
  executor: ExactPackageDisposableExecutor
  files: ReadonlyMap<string, Buffer>
  identityPolicy?: PackageSourceIdentityPolicy
}): Promise<ExactPackageRehearsalReport> {
  // All target, package, freshness, collision, and real-local guards run before
  // the executor receives control. Tests assert invalid targets never call it.
  const package_ = verifyExactGeneratedPackage(
    input.files,
    input.identityPolicy ?? PRODUCTION_SOURCE_IDENTITIES,
  )
  const attestation = assertDisposableRehearsalTarget(input.attestation, package_)
  const rawEvidence = await input.executor.execute({ attestation, package: package_ })
  const evidence = validateExactPackageRehearsalEvidence(rawEvidence, package_, attestation)
  const canonicalEvidence = normalizeExactPackageRehearsalEvidence(evidence)
  return {
    compensationCounts: EXACT_COMPENSATION_COUNTS,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    databaseMutationOutsideDisposableTarget: false,
    deterministicArtifacts: true,
    evidenceSha256: sha256Canonical(canonicalEvidence),
    heldOutIdentitiesAccessed: false,
    importCounts: EXACT_IMPORT_COUNTS,
    migrationId: MIGRATION_ID,
    migrationSha256: package_.descriptor.migration.sha256,
    packageManifestSha256: package_.manifestSha256,
    physicalEqualityAfterCompensationClaimed: false,
    realLocalDatabaseTouched: false,
    remoteDatabaseTouched: false,
    result: 'passed',
    schemaSecurityDefinitionIdentitySha256: package_.descriptor.audit.schemaSecurityIdentitySha256,
    schemaVersion: EXACT_PACKAGE_REHEARSAL_SCHEMA_VERSION,
    targetDatabase: {
      image: POSTGRES_IMAGE,
      kind: 'fresh_disposable_database',
      network: 'docker_assigned_loopback_only',
    },
  }
}

export interface CommandResult {
  stderr: string
  stdout: string
}

export interface DisposableCommandOptions {
  env?: Record<string, string>
  stdin?: string
}

export interface DisposableRuntime {
  cancelActiveCommand?(signal: 'SIGINT' | 'SIGTERM'): Promise<void> | void
  command(
    commandName: string,
    arguments_: string[],
    options?: DisposableCommandOptions,
  ): Promise<CommandResult>
  environment?: Readonly<Record<string, string | undefined>>
  now(): string
  onContainerOwnedForTest?(): Promise<void>
  registerSignalHandler?(handler: (signal: 'SIGINT' | 'SIGTERM') => void): () => void
}

export interface DisposableCompletedExecutionForTest {
  canonicalArtifacts: ReadonlyMap<string, Buffer>
  manifestBytes: Buffer
  rawReceipt: Record<string, unknown>
  report: ExactPackageRehearsalReport
}

const COMPLETED_EXECUTION_FOR_TEST = Symbol('completed-disposable-execution-for-test')

type DisposableRuntimeWithTestCompletion = DisposableRuntime & {
  [COMPLETED_EXECUTION_FOR_TEST]?: () => Promise<DisposableCompletedExecutionForTest>
}

export function injectCompletedDisposableExecutionForTest(
  runtime: DisposableRuntime,
  completedExecution: DisposableCompletedExecutionForTest,
): DisposableRuntime {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Completed disposable execution injection is test-only.')
  }
  Object.defineProperty(runtime, COMPLETED_EXECUTION_FOR_TEST, {
    configurable: false,
    enumerable: false,
    value: async () => completedExecution,
    writable: false,
  })
  return runtime
}

export interface DisposableContainerCleanupOutcome {
  absenceVerification: 'not_attempted' | 'verified_absent' | 'container_still_present' | 'failed'
  absenceChecks: Array<{
    identifier: string
    kind: 'container_id' | 'exact_name'
    present: boolean | null
  }>
  attempted: boolean
  containerId: string | null
  containerName: string
  errors: Array<{
    message: string
    stage: 'remove' | 'verify_absent'
  }>
  outcome: 'not_required' | 'removed_and_verified_absent' | 'failed'
  removalCommandSucceeded: boolean | null
}

export interface ExecuteFreshDisposableInput {
  files: ReadonlyMap<string, Buffer>
  identityPolicy?: PackageSourceIdentityPolicy
  outputDirectory: string
  outputIdentity: ExclusiveOutputDirectoryIdentity
  preMigrationBackup: VerifiedDevelopmentDatabaseBackup
  sources: PackageSourceBytes
}

export const EXACT_RPC_METADATA_SQL = String.raw`
select pg_catalog.jsonb_build_object(
  'functions', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name', proc.proname,
    'identityArguments', pg_catalog.pg_get_function_identity_arguments(proc.oid),
    'resultType', pg_catalog.pg_get_function_result(proc.oid),
    'volatility', proc.provolatile,
    'owner', owner.rolname,
    'securityDefiner', proc.prosecdef,
    'searchPath', coalesce((
      select pg_catalog.regexp_replace(setting, '^search_path=', '')
      from unnest(coalesce(proc.proconfig, array[]::text[])) setting
      where setting like 'search_path=%'
      limit 1
    ), '')
  ) order by proc.proname, pg_catalog.pg_get_function_identity_arguments(proc.oid)), '[]'::jsonb)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace
  on namespace.oid = proc.pronamespace and namespace.nspname = 'public'
join pg_catalog.pg_roles owner on owner.oid = proc.proowner
where proc.proname in (
  'apply_literature_gold_import_v1',
  'compensate_literature_gold_import_v1',
  'reconcile_literature_gold_review_operation_v1'
);
`

const EXPECTED_RPC_CONTRACTS = {
  apply_literature_gold_import_v1: {
    identityArguments:
      'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
    volatility: 'v',
  },
  compensate_literature_gold_import_v1: {
    identityArguments:
      'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
    volatility: 'v',
  },
  reconcile_literature_gold_review_operation_v1: {
    identityArguments:
      'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
    volatility: 's',
  },
} as const

export function validateExactRpcContractMetadata(value: unknown) {
  const parsed = z
    .object({
      functions: z.array(
        z
          .object({
            identityArguments: z.string(),
            name: z.string(),
            owner: z.string(),
            resultType: z.string(),
            searchPath: z.string(),
            securityDefiner: z.boolean(),
            volatility: z.string(),
          })
          .strict(),
      ),
    })
    .strict()
    .parse(value)
  const expectedNames = Object.keys(EXPECTED_RPC_CONTRACTS).sort()
  const actualNames = parsed.functions.map(({ name }) => name).sort()
  if (!same(actualNames, expectedNames)) {
    throw new Error('Exact transition RPC overload set changed unexpectedly.')
  }
  for (const [name, expected] of Object.entries(EXPECTED_RPC_CONTRACTS)) {
    const matches = parsed.functions.filter((entry) => entry.name === name)
    const actual = matches[0]
    if (
      matches.length !== 1 ||
      actual?.identityArguments !== expected.identityArguments ||
      actual.resultType !== 'jsonb' ||
      actual.volatility !== expected.volatility ||
      actual.owner !== 'supabase_admin' ||
      actual.securityDefiner !== true ||
      actual.searchPath !== 'pg_catalog, public, extensions'
    ) {
      throw new Error(`Exact transition RPC execution contract mismatch for ${name}.`)
    }
  }
  return {
    functions: [...parsed.functions].sort((left, right) =>
      left.name.localeCompare(right.name, 'en'),
    ),
    overloadCount: parsed.functions.length,
    passed: true,
  } as const
}

function buildExactEvidenceSecuritySummary(
  introspection: ValidatedSecurityIntrospection,
  lint: ValidatedSupabaseLint,
) {
  const immutablePrivileges = [introspection.reviewPrivileges, introspection.eventPrivileges]
  const ordinaryMutationKeys = [
    'publicInsert',
    'publicUpdate',
    'publicDelete',
    'anonInsert',
    'anonUpdate',
    'anonDelete',
    'authenticatedInsert',
    'authenticatedUpdate',
    'authenticatedDelete',
  ] as const
  const prohibitedPrivilegeKeys = [
    'publicTruncate',
    'publicReferences',
    'publicTrigger',
    'anonTruncate',
    'anonReferences',
    'anonTrigger',
    'authenticatedTruncate',
    'authenticatedReferences',
    'authenticatedTrigger',
    'serviceRoleTruncate',
    'serviceRoleReferences',
    'serviceRoleTrigger',
  ] as const
  return exactEvidenceSecuritySchema.parse({
    appendOnlyTriggersEnabled:
      introspection.triggers.length === 22 &&
      introspection.triggers.every(({ enabled }) => enabled === true),
    lintErrorCount: lint.errors.length,
    onlyAllowlistedVolatilityWarnings: lint.passed,
    ordinaryRolesHaveNoImmutableMutationPrivilege: immutablePrivileges.every((privileges) =>
      ordinaryMutationKeys.every((key) => privileges[key] === false),
    ),
    prohibitedPrivilegesAbsent:
      immutablePrivileges.every((privileges) =>
        prohibitedPrivilegeKeys.every((key) => privileges[key] === false),
      ) &&
      introspection.journalPrivileges.every(
        (entry) =>
          entry.insert === false &&
          entry.update === false &&
          entry.delete === false &&
          entry.truncate === false &&
          entry.references === false &&
          entry.trigger === false,
      ),
    publicExecuteAbsent: introspection.functions.every(
      (entry) =>
        entry.publicExecute === false &&
        entry.anonExecute === false &&
        entry.authenticatedExecute === false,
    ),
    requiredRlsEnabled:
      introspection.rls.length === 7 &&
      introspection.rls.every(({ rlsEnabled }) => rlsEnabled === true),
    schemaSecurityDefinitionIdentitySha256: introspection.schemaSecurityIdentitySha256,
    securityDefinerSearchPathsSafe: introspection.functions.every(
      (entry) =>
        entry.securityDefiner === true &&
        entry.owner === 'supabase_admin' &&
        entry.searchPath === 'pg_catalog, public, extensions',
    ),
    serviceRoleGuardedBoundaryOnly:
      introspection.functions.every(({ serviceRoleExecute }) => serviceRoleExecute === true) &&
      introspection.journalPrivileges.every(
        ({ role, select }) => select === (role === 'service_role'),
      ),
  })
}

const ACTIVE_PRODUCTION_CHILDREN = new Set<ReturnType<typeof spawn>>()
const PRODUCTION_CHILD_TERM_GRACE_MS = 1_000
const PRODUCTION_CHILD_KILL_GRACE_MS = 1_000

function productionChildExited(child: ReturnType<typeof spawn>): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

function waitForProductionChildExit(
  child: ReturnType<typeof spawn>,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (productionChildExited(child)) return Promise.resolve(true)
  return new Promise((resolvePromise) => {
    let settled = false
    const finish = (exited: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      child.off('close', onExit)
      child.off('error', onExit)
      resolvePromise(exited)
    }
    const onExit = () => finish(true)
    const timeout = setTimeout(() => finish(productionChildExited(child)), timeoutMilliseconds)
    child.once('close', onExit)
    child.once('error', onExit)
  })
}

async function terminateProductionChildBounded(child: ReturnType<typeof spawn>): Promise<void> {
  if (productionChildExited(child)) return
  const signalErrors: unknown[] = []
  try {
    if (!child.kill('SIGTERM') && !productionChildExited(child)) {
      signalErrors.push(new Error('Active child process refused SIGTERM delivery.'))
    }
  } catch (error) {
    signalErrors.push(error)
  }
  if (await waitForProductionChildExit(child, PRODUCTION_CHILD_TERM_GRACE_MS)) return
  try {
    if (!child.kill('SIGKILL') && !productionChildExited(child)) {
      signalErrors.push(new Error('Active child process refused SIGKILL delivery.'))
    }
  } catch (error) {
    signalErrors.push(error)
  }
  if (await waitForProductionChildExit(child, PRODUCTION_CHILD_KILL_GRACE_MS)) return
  child.stdin?.destroy()
  child.stdout?.destroy()
  child.stderr?.destroy()
  child.unref()
  ACTIVE_PRODUCTION_CHILDREN.delete(child)
  throw new AggregateError(
    [
      ...signalErrors,
      new Error(
        `Active child process ${child.pid ?? '(unknown pid)'} did not exit after bounded SIGTERM/SIGKILL escalation.`,
      ),
    ],
    'Active child process resisted bounded termination and was detached from the runner.',
  )
}

function productionCommand(
  commandName: string,
  arguments_: string[],
  options: DisposableCommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(commandName, arguments_, {
      cwd: REPOSITORY_ROOT,
      env: sanitizeRehearsalChildEnvironment(process.env, options.env ?? {}),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    ACTIVE_PRODUCTION_CHILDREN.add(child)
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      ACTIVE_PRODUCTION_CHILDREN.delete(child)
      rejectPromise(error)
    })
    child.on('close', (code) => {
      ACTIVE_PRODUCTION_CHILDREN.delete(child)
      if (code === 0) {
        resolvePromise({ stderr, stdout })
        return
      }
      const safeArguments = arguments_.map((argument, index) => {
        if (argument.startsWith('PGPASSWORD=') || argument.startsWith('POSTGRES_PASSWORD=')) {
          return `${argument.slice(0, argument.indexOf('='))}=[redacted]`
        }
        if (arguments_[index - 1] === '--db-url') return '[redacted-disposable-url]'
        return argument
      })
      rejectPromise(
        new Error(
          `${commandName} ${safeArguments.join(' ')} exited with ${code ?? 'unknown'}:\n${stderr || stdout}`,
        ),
      )
    })
    child.stdin.end(options.stdin)
  })
}

const PRODUCTION_RUNTIME: DisposableRuntime = {
  cancelActiveCommand: async () => {
    const results = await Promise.allSettled(
      [...ACTIVE_PRODUCTION_CHILDREN].map(terminateProductionChildBounded),
    )
    const failures = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : [],
    )
    if (failures.length > 0) {
      throw new AggregateError(failures, 'One or more active child commands resisted termination.')
    }
  },
  command: productionCommand,
  environment: process.env,
  now: () => new Date().toISOString(),
  registerSignalHandler: (handler) => {
    const onSigint = () => handler('SIGINT')
    const onSigterm = () => handler('SIGTERM')
    process.on('SIGINT', onSigint)
    process.on('SIGTERM', onSigterm)
    return () => {
      process.off('SIGINT', onSigint)
      process.off('SIGTERM', onSigterm)
    }
  },
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function cleanupOutcomeError(outcome: DisposableContainerCleanupOutcome): Error | null {
  if (outcome.outcome !== 'failed') return null
  return new Error(
    `Disposable-container cleanup failed: ${outcome.errors
      .map(({ stage, message }) => `${stage}: ${message}`)
      .join('; ')}.`,
  )
}

export function assertDisposableContainerCleanupSucceeded(
  outcome: DisposableContainerCleanupOutcome,
): void {
  const error = cleanupOutcomeError(outcome)
  if (error) throw error
}

function combinedExecutionError(primaryError: unknown, cleanupError: Error | null): Error | null {
  const errors = [primaryError, cleanupError].filter(
    (error) => error !== null && error !== undefined,
  )
  if (errors.length === 0) return null
  if (errors.length === 1) {
    const [error] = errors
    return error instanceof Error ? error : new Error(String(error))
  }
  return new AggregateError(
    errors,
    `Exact-package rehearsal failed; primary error: ${errorMessage(primaryError)}; cleanup error: ${cleanupError?.message ?? '(none)'}`,
  )
}

export async function cleanupDisposableContainer(input: {
  armed: boolean
  containerId: string
  containerName: string
  dockerCommand(arguments_: string[]): Promise<CommandResult>
}): Promise<DisposableContainerCleanupOutcome> {
  const outcome: DisposableContainerCleanupOutcome = {
    absenceVerification: 'not_attempted',
    absenceChecks: [],
    attempted: input.armed,
    containerId: input.containerId || null,
    containerName: input.containerName,
    errors: [],
    outcome: input.armed ? 'failed' : 'not_required',
    removalCommandSucceeded: null,
  }
  if (!input.armed) return outcome

  try {
    await input.dockerCommand(['rm', '--force', input.containerName])
    outcome.removalCommandSucceeded = true
  } catch (error) {
    outcome.removalCommandSucceeded = false
    outcome.errors.push({ message: errorMessage(error), stage: 'remove' })
  }

  const absenceTargets = [
    {
      filter: `name=^/${input.containerName}$`,
      identifier: input.containerName,
      kind: 'exact_name' as const,
    },
    ...(input.containerId
      ? [
          {
            filter: `id=${input.containerId}`,
            identifier: input.containerId,
            kind: 'container_id' as const,
          },
        ]
      : []),
  ]
  for (const target of absenceTargets) {
    try {
      const remaining = (
        await input.dockerCommand([
          'container',
          'ls',
          '--all',
          '--quiet',
          '--no-trunc',
          '--filter',
          target.filter,
        ])
      ).stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
      const present = remaining.length > 0
      outcome.absenceChecks.push({
        identifier: target.identifier,
        kind: target.kind,
        present,
      })
      if (present) {
        outcome.errors.push({
          message: `${target.kind} ${target.identifier} remains present after removal: ${remaining.join(', ')}`,
          stage: 'verify_absent',
        })
      }
    } catch (error) {
      outcome.absenceChecks.push({
        identifier: target.identifier,
        kind: target.kind,
        present: null,
      })
      outcome.errors.push({
        message: `${target.kind} ${target.identifier}: ${errorMessage(error)}`,
        stage: 'verify_absent',
      })
    }
  }

  outcome.absenceVerification = outcome.absenceChecks.some(({ present }) => present === null)
    ? 'failed'
    : outcome.absenceChecks.some(({ present }) => present === true)
      ? 'container_still_present'
      : 'verified_absent'

  if (
    outcome.removalCommandSucceeded === true &&
    outcome.absenceVerification === 'verified_absent' &&
    outcome.errors.length === 0
  ) {
    outcome.outcome = 'removed_and_verified_absent'
  }
  return outcome
}

function sqlLiteral(value: string): string {
  if (value.includes('$codex_exact$')) throw new Error('Unsafe SQL value delimiter collision.')
  return `$codex_exact$${value}$codex_exact$`
}

function fixedUuid(label: string): string {
  const bytes = Buffer.from(sha256Bytes(label).slice(0, 32), 'hex')
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function recoveryRpcSql(
  operationId: string,
  authorization: ReturnType<typeof bindRecoveryAuthorization>,
): string {
  return `set role service_role; select ${recoveryRpcCall(operationId, authorization)};`
}

function recoveryRpcCall(
  operationId: string,
  authorization: ReturnType<typeof bindRecoveryAuthorization>,
): string {
  return `public.reconcile_literature_gold_review_operation_v1(
    ${sqlLiteral(operationId)}::uuid,
    ${sqlLiteral(authorization.binding.contentSha256)}::text,
    ${sqlLiteral(canonicalJson(authorization))}::jsonb
  )`
}

function expectedSqlstateBlock(call: string, expectedSqlstate: string): string {
  if (!/^[A-Z0-9]{5}$/u.test(expectedSqlstate)) throw new Error('Invalid expected SQLSTATE.')
  return `set role service_role;
do $expected_rejection$
begin
  begin
    perform ${call};
    raise exception 'expected ${expectedSqlstate} rejection was not raised';
  exception when sqlstate '${expectedSqlstate}' then
    null;
  end;
end;
$expected_rejection$;`
}

export function exactBatchSnapshotSql(batchId: string): string {
  const escapedBatchId = sqlLiteral(batchId)
  return `select pg_catalog.jsonb_build_object(
    'batch', (select to_jsonb(batch) from public.literature_gold_set_batches batch
      where batch.id = ${escapedBatchId}::uuid),
    'items', coalesce((select jsonb_agg(to_jsonb(item)
        order by item.display_order nulls last, item.id)
      from public.literature_gold_set_items item
      where item.batch_id = ${escapedBatchId}::uuid), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(review)
        order by item.display_order nulls last, item.id,
          review.revision nulls last, review.id)
      from public.literature_gold_set_reviews review
      join public.literature_gold_set_items item on item.id = review.item_id
      where item.batch_id = ${escapedBatchId}::uuid), '[]'::jsonb),
    'drafts', coalesce((select jsonb_agg(to_jsonb(draft) order by draft.item_id)
      from public.literature_gold_set_review_drafts draft
      join public.literature_gold_set_items item on item.id = draft.item_id
      where item.batch_id = ${escapedBatchId}::uuid), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(event) order by event.created_at, event.id)
      from public.literature_gold_set_events event
      where event.batch_id = ${escapedBatchId}::uuid), '[]'::jsonb),
    'operations', coalesce((select jsonb_agg(to_jsonb(operation) order by operation.started_at,
        operation.id)
      from public.literature_gold_review_operations operation
      where operation.batch_id = ${escapedBatchId}::uuid), '[]'::jsonb),
    'operationActions', coalesce((select jsonb_agg(to_jsonb(action)
        order by action.operation_id, action.action_sequence, action.id)
      from public.literature_gold_review_operation_actions action
      join public.literature_gold_review_operations operation
        on operation.id = action.operation_id
      where operation.batch_id = ${escapedBatchId}::uuid), '[]'::jsonb)
  );`
}

function importRpcCall(
  plan: ImportPlan,
  authorization: ReturnType<typeof bindImportAuthorization>,
): string {
  return `public.apply_literature_gold_import_v1(${[
    `${sqlLiteral(plan.operationId)}::uuid`,
    `${sqlLiteral(plan.binding.idempotencyKey)}::text`,
    `${sqlLiteral(plan.batchId)}::uuid`,
    `${sqlLiteral(plan.sourceArtifactSha256)}::text`,
    `${sqlLiteral(plan.binding.contentSha256)}::text`,
    `${sqlLiteral(canonicalJson(plan))}::jsonb`,
    `${sqlLiteral(authorization.binding.contentSha256)}::text`,
    `${sqlLiteral(canonicalJson(authorization))}::jsonb`,
    'null::uuid',
    `${sqlLiteral('disposable-rehearsal@example.invalid')}::text`,
  ].join(',')})`
}

function importRpcSql(plan: ImportPlan, authorization: ReturnType<typeof bindImportAuthorization>) {
  return `set role service_role; select ${importRpcCall(plan, authorization)};`
}

function compensationRpcSql(
  plan: ReturnType<typeof bindCompensationPlan>,
  authorization: ReturnType<typeof bindCompensationAuthorization>,
) {
  return `set role service_role; select ${compensationRpcCall(plan, authorization)};`
}

function compensationRpcCall(
  plan: ReturnType<typeof bindCompensationPlan>,
  authorization: ReturnType<typeof bindCompensationAuthorization>,
): string {
  return `public.compensate_literature_gold_import_v1(${[
    `${sqlLiteral(plan.operationId)}::uuid`,
    `${sqlLiteral(plan.targetImportOperationId)}::uuid`,
    `${sqlLiteral(plan.binding.idempotencyKey)}::text`,
    `${sqlLiteral(plan.batchId)}::uuid`,
    `${sqlLiteral(plan.sourceArtifactSha256)}::text`,
    `${sqlLiteral(plan.binding.contentSha256)}::text`,
    `${sqlLiteral(canonicalJson(plan))}::jsonb`,
    `${sqlLiteral(authorization.binding.contentSha256)}::text`,
    `${sqlLiteral(canonicalJson(authorization))}::jsonb`,
    'null::uuid',
    `${sqlLiteral('disposable-rehearsal@example.invalid')}::text`,
  ].join(',')})`
}

export async function executeFreshDisposableRuntime(
  input: ExecuteFreshDisposableInput,
  runtime: DisposableRuntime,
): Promise<ExactPackageRehearsalReport> {
  if (resolve(input.outputDirectory) !== input.outputIdentity.outputDirectory) {
    throw new Error('Disposable rehearsal output identity does not match its output directory.')
  }
  await assertExclusiveOutputDirectoryIdentity(input.outputIdentity)
  const package_ = verifyExactGeneratedPackage(
    input.files,
    input.identityPolicy ?? PRODUCTION_SOURCE_IDENTITIES,
  )
  assertExactPackageSourceBytes(package_, input.sources)
  const seed = developmentDatabaseSeedSchema.parse(input.preMigrationBackup.seed)
  assertDevelopmentSeedScope(seed)
  const seedSql = renderDevelopmentDatabaseSeedSql(seed)
  const backupProvenance = input.preMigrationBackup.provenance
  if (
    backupProvenance === null ||
    input.preMigrationBackup.manifestSha256 !==
      package_.descriptor.audit.preMigrationBackupManifestSha256 ||
    input.preMigrationBackup.seedSql !== seedSql ||
    seed.batchId !== package_.importPlan.batchId ||
    backupProvenance.batchId !== package_.importPlan.batchId ||
    backupProvenance.developmentMembershipSha256 !==
      package_.importPlan.scope.developmentMembershipSha256 ||
    backupProvenance.effectiveStateSha256 !== package_.importPlan.expectedEffectiveStateSha256 ||
    backupProvenance.physicalStateSha256 !==
      package_.descriptor.audit.preMigrationPhysicalStateSha256 ||
    backupProvenance.planningStateSha256 !==
      package_.descriptor.audit.developmentPlanningStateSha256 ||
    backupProvenance.repositoryCommitSha !==
      package_.importPlan.executionContext.repositoryCommitSha
  ) {
    throw new Error('Pre-migration development backup is stale or not bound to the exact package.')
  }

  const startedAt = runtime.now()
  const container = `ip-gold-exact-${process.pid}-${randomBytes(5).toString('hex')}`
  const database = `gold_compensation_rehearsal_${process.pid}_${randomBytes(3).toString('hex')}`
  const databaseUser = 'supabase_admin'
  const password = randomBytes(24).toString('hex')
  const runNonce = randomBytes(16).toString('hex')
  let dockerEndpoint = ''
  let hostPort = ''
  let runtimeContainerId = ''
  let containerCreationAttempted = false
  let cleanupPromise: Promise<DisposableContainerCleanupOutcome> | undefined
  let receivedSignal: 'SIGINT' | 'SIGTERM' | null = null
  let signalCancellationError: unknown = null
  let signalWorkflowPromise: Promise<DisposableContainerCleanupOutcome> | undefined
  let notifySignal: (signal: 'SIGINT' | 'SIGTERM') => void = () => undefined
  const signalNotification = new Promise<'SIGINT' | 'SIGTERM'>((resolvePromise) => {
    notifySignal = resolvePromise
  })
  let primaryError: unknown = null
  let completedExecution: DisposableCompletedExecutionForTest | undefined

  const interruptionError = (cause?: unknown): Error => {
    const signalError = new Error(
      `Disposable exact-package rehearsal interrupted by ${receivedSignal ?? 'a process signal'}.`,
    )
    const errors = [signalError, signalCancellationError, cause].filter(
      (error) => error !== null && error !== undefined,
    )
    return errors.length === 1
      ? signalError
      : new AggregateError(
          errors,
          `Disposable exact-package rehearsal interrupted by ${receivedSignal}; active command termination or execution also failed: ${cause ? errorMessage(cause) : '(none)'}.`,
        )
  }
  const assertNotInterrupted = () => {
    if (receivedSignal) throw interruptionError()
  }
  const runCommand = async (
    commandName: string,
    arguments_: string[],
    options?: DisposableCommandOptions,
  ) => {
    assertNotInterrupted()
    const result = await Promise.race([
      runtime.command(commandName, arguments_, options),
      signalNotification.then((signal) => {
        throw new Error(`Active command wait interrupted by ${signal}.`)
      }),
    ])
    assertNotInterrupted()
    return result
  }
  const dockerArguments = (arguments_: string[]) =>
    runCommand('docker', arguments_, {
      env: dockerEndpoint ? { DOCKER_HOST: dockerEndpoint } : {},
    })
  const cleanupDockerArguments = (arguments_: string[]) =>
    runtime.command('docker', arguments_, {
      env: dockerEndpoint ? { DOCKER_HOST: dockerEndpoint } : {},
    })
  const cleanupOnce = () => {
    cleanupPromise ??= cleanupDisposableContainer({
      armed: containerCreationAttempted,
      containerId: runtimeContainerId,
      containerName: container,
      dockerCommand: cleanupDockerArguments,
    })
    return cleanupPromise
  }
  const beginSignalWorkflow = () => {
    signalWorkflowPromise ??= (async () => {
      try {
        await runtime.cancelActiveCommand?.(receivedSignal ?? 'SIGTERM')
      } catch (error) {
        signalCancellationError = error
      }
      return cleanupOnce()
    })()
    // The main control path awaits this same memoized promise. Attaching a
    // handler immediately also prevents a transient unhandled rejection if a
    // cleanup implementation unexpectedly rejects before the command race wins.
    void signalWorkflowPromise.catch(() => undefined)
    return signalWorkflowPromise
  }
  let unregisterSignalHandler =
    runtime.registerSignalHandler?.((signal) => {
      if (receivedSignal) return
      receivedSignal = signal
      beginSignalWorkflow()
      notifySignal(signal)
    }) ?? (() => undefined)
  const psql = async (sql: string, json = false) => {
    const arguments_ = [
      'exec',
      '--env',
      `PGPASSWORD=${password}`,
      '-i',
      container,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--host',
      '127.0.0.1',
      '--username',
      databaseUser,
      '--dbname',
      database,
    ]
    if (json) arguments_.push('--tuples-only', '--no-align', '--quiet')
    return runCommand('docker', arguments_, {
      env: { DOCKER_HOST: dockerEndpoint },
      stdin: sql,
    })
  }
  const queryJson = async (sql: string): Promise<unknown> => {
    const result = await psql(sql, true)
    const text = result.stdout.trim()
    try {
      return JSON.parse(text) as unknown
    } catch (error) {
      throw new Error(
        `Disposable database query did not return JSON: ${error instanceof Error ? error.message : String(error)}.`,
      )
    }
  }

  executionAttempt: try {
    const runtimeEnvironment = runtime.environment ?? {}
    const dockerHostOverride = runtimeEnvironment.DOCKER_HOST?.trim() ?? ''
    const dockerContextOverride = runtimeEnvironment.DOCKER_CONTEXT?.trim() ?? ''
    if (dockerHostOverride && dockerContextOverride) {
      throw new Error('Ambiguous Docker host/context overrides are forbidden.')
    }
    if (dockerHostOverride) {
      assertLocalDockerEndpoint(dockerHostOverride)
      dockerEndpoint = dockerHostOverride
    } else {
      const context =
        dockerContextOverride ||
        (await runCommand('docker', ['context', 'show'], { env: {} })).stdout.trim()
      if (!DOCKER_CONTEXT_PATTERN.test(context)) {
        throw new Error('Docker context guard rejected an invalid context name.')
      }
      const inspectedEndpoint = (
        await runCommand(
          'docker',
          ['context', 'inspect', context, '--format', '{{json .Endpoints.docker.Host}}'],
          { env: {} },
        )
      ).stdout.trim()
      try {
        const parsedEndpoint = JSON.parse(inspectedEndpoint) as unknown
        if (typeof parsedEndpoint !== 'string') {
          throw new Error('resolved endpoint is not a string')
        }
        dockerEndpoint = parsedEndpoint
      } catch (error) {
        throw new Error(
          `Docker context endpoint could not be resolved safely: ${error instanceof Error ? error.message : String(error)}.`,
        )
      }
    }
    assertLocalDockerEndpoint(dockerEndpoint)
    containerCreationAttempted = true
    runtimeContainerId = (
      await dockerArguments([
        'run',
        '--detach',
        '--rm',
        '--name',
        container,
        '--label',
        `${REHEARSAL_RUN_NONCE_LABEL}=${runNonce}`,
        '--publish',
        '127.0.0.1::5432',
        '--env',
        `POSTGRES_PASSWORD=${password}`,
        '--env',
        `POSTGRES_DB=${database}`,
        POSTGRES_IMAGE,
      ])
    ).stdout.trim()
    if (!/^[a-f0-9]{12,64}$/u.test(runtimeContainerId)) {
      throw new Error('Docker did not return the runtime-owned disposable container identity.')
    }
    const ownership = z
      .object({
        Config: z.object({ Labels: z.record(z.string(), z.string()).nullable() }).passthrough(),
        Id: z.string().regex(/^[a-f0-9]{64}$/u),
        Name: z.string(),
        NetworkSettings: z
          .object({
            Ports: z.record(
              z.string(),
              z.array(z.object({ HostIp: z.string(), HostPort: z.string() }).strict()).nullable(),
            ),
          })
          .passthrough(),
      })
      .passthrough()
      .parse(
        JSON.parse(
          (await dockerArguments(['inspect', '--format', '{{json .}}', container])).stdout.trim(),
        ) as unknown,
      )
    const portBinding = ownership.NetworkSettings.Ports['5432/tcp']?.[0]
    hostPort = portBinding?.HostPort ?? ''
    if (
      ownership.Id !== runtimeContainerId ||
      ownership.Name !== `/${container}` ||
      ownership.Config.Labels?.[REHEARSAL_RUN_NONCE_LABEL] !== runNonce ||
      portBinding?.HostIp !== '127.0.0.1' ||
      !/^\d{1,5}$/u.test(hostPort) ||
      hostPort === PROTECTED_REAL_LOCAL_DATABASE_PORT
    ) {
      throw new Error(
        'Docker container identity, run nonce, or assigned loopback port is not owned by this rehearsal.',
      )
    }
    await runtime.onContainerOwnedForTest?.()
    const injectedCompletedExecution = await (runtime as DisposableRuntimeWithTestCompletion)[
      COMPLETED_EXECUTION_FOR_TEST
    ]?.()
    if (injectedCompletedExecution) {
      completedExecution = injectedCompletedExecution
      break executionAttempt
    }

    let ready = false
    let lastReadyError = ''
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        const result = await psql('select 1;', true)
        if (result.stdout.trim() === '1') {
          ready = true
          break
        }
      } catch (error) {
        if (receivedSignal) throw interruptionError(error)
        lastReadyError = error instanceof Error ? error.message : String(error)
      }
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 250))
    }
    if (!ready) throw new Error(`Disposable PostgreSQL did not become ready. ${lastReadyError}`)
    await psql(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key
);
alter table supabase_migrations.schema_migrations add column if not exists name text;
alter table supabase_migrations.schema_migrations add column if not exists statements text[];`)
    const migrationWithLedger = (filename: string, sql: string) => {
      const match = /^(\d{14})_(.+)\.sql$/u.exec(filename)
      if (!match) throw new Error(`Invalid migration filename: ${filename}.`)
      return `begin;\n${sql}\ninsert into supabase_migrations.schema_migrations(version, name, statements)
values (${sqlLiteral(match[1])}, ${sqlLiteral(match[2])}, array[]::text[]);\ncommit;`
    }
    for (const migration of MIGRATIONS.slice(0, -1)) {
      const bytes = await readFile(resolve(REPOSITORY_ROOT, 'supabase/migrations', migration))
      await psql(migrationWithLedger(migration, bytes.toString('utf8')))
    }

    // Restore the checksum-bound pre-migration development-only backup into
    // the base schema, then apply the exact merged contract migration once.
    await psql(seedSql)
    const contractMigrationBytes = await readFile(
      resolve(REPOSITORY_ROOT, 'supabase/migrations', `${MIGRATION_ID}.sql`),
    )
    if (sha256Bytes(contractMigrationBytes) !== package_.descriptor.migration.sha256) {
      throw new Error('Merged migration bytes are stale relative to the exact package.')
    }
    await psql(migrationWithLedger(`${MIGRATION_ID}.sql`, contractMigrationBytes.toString('utf8')))
    const migrationLedger = z.object({ occurrences: z.literal(1) }).parse(
      await queryJson(`select pg_catalog.jsonb_build_object(
          'occurrences', count(*)::integer
        ) from supabase_migrations.schema_migrations
        where version = '20260808035633'
          and coalesce(name, '') in ('', 'add_literature_gold_import_compensation_contract');`),
    )

    const verificationBytes = await readFile(
      resolve(REPOSITORY_ROOT, 'supabase/verification', CONTRACT_VERIFICATION),
    )
    const verificationResult = await psql(verificationBytes.toString('utf8'))
    const contractScenarios = validateSqlScenarioEvidence(
      extractSqlScenarioEvidence(`${verificationResult.stdout}\n${verificationResult.stderr}`),
    )
    const canonicalContractScenarios = buildCanonicalScenarioEvidence(
      contractScenarios,
      package_.descriptor.migration.sha256,
      sha256Bytes(verificationBytes),
    )
    const normalizedContractScenarioBytes = Buffer.from(
      `${JSON.stringify(JSON.parse(canonicalJson(canonicalContractScenarios)), null, 2)}\n`,
      'utf8',
    )
    const scenarioPassed = (scenarioId: string): boolean =>
      contractScenarios.scenarios.some(
        (scenario) => scenario.scenarioId === scenarioId && scenario.status === 'passed',
      )

    const escapedBatchId = sqlLiteral(package_.importPlan.batchId)
    const seededState = z
      .object({
        developmentCount: z.number().int(),
        effective: sha256Schema,
        membership: sha256Schema,
        physical: sha256Schema,
        testCount: z.number().int(),
        testUnlocked: z.boolean(),
      })
      .parse(
        await queryJson(`select pg_catalog.jsonb_build_object(
          'developmentCount', count(*) filter (where item.dataset_split = 'development'),
          'testCount', count(*) filter (where item.dataset_split = 'test'),
          'testUnlocked', batch.test_unlocked_at is not null,
          'membership', public.literature_gold_development_membership_hash_v1(batch.id),
          'physical', public.literature_gold_physical_state_hash_v1(batch.id, 'development'),
          'effective', public.literature_gold_effective_state_hash_v1(batch.id, 'development')
        )
        from public.literature_gold_set_batches batch
        join public.literature_gold_set_items item on item.batch_id = batch.id
        where batch.id = ${escapedBatchId}::uuid
        group by batch.id;`),
      )
    if (
      seededState.developmentCount !== EXACT_IMPORT_COUNTS.total ||
      seededState.testCount !== 0 ||
      seededState.testUnlocked ||
      seededState.membership !== package_.importPlan.scope.developmentMembershipSha256 ||
      seededState.physical !== package_.importPlan.expectedPhysicalStateSha256 ||
      seededState.effective !== package_.importPlan.expectedEffectiveStateSha256
    ) {
      throw new Error('Disposable seed does not reproduce the exact locked development pre-state.')
    }

    const collisions = z
      .object({ idempotency: z.number().int(), operations: z.number().int() })
      .parse(
        await queryJson(`select pg_catalog.jsonb_build_object(
          'operations', count(*) filter (where operation.id in (
            ${sqlLiteral(package_.importPlan.operationId)}::uuid,
            ${sqlLiteral(package_.compensationOperationId)}::uuid
          )),
          'idempotency', count(*) filter (
            where operation.idempotency_key = ${sqlLiteral(package_.importPlan.binding.idempotencyKey)}
          )
        ) from public.literature_gold_review_operations operation;`),
      )
    if (collisions.operations !== 0 || collisions.idempotency !== 0) {
      throw new Error('Fresh disposable database contains an operation/idempotency collision.')
    }

    const importAuthorization = bindImportAuthorization({
      authorizationId: fixedUuid(
        `${package_.importPlan.operationId}:rehearsal-import-authorization`,
      ),
      authorizationNote: 'Disposable exact-package rehearsal authorization; never valid elsewhere.',
      authorized: true,
      authorizedAt: '2030-01-01T00:00:00.000Z',
      authorizedBy: 'disposable-rehearsal@example.invalid',
      batchId: package_.importPlan.batchId,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      expectedEffectiveStateSha256: package_.importPlan.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: package_.importPlan.expectedPhysicalStateSha256,
      expectedPostEffectiveStateSha256: package_.importPlan.expectedPostEffectiveStateSha256,
      idempotencyKey: package_.importPlan.binding.idempotencyKey,
      kind: 'import_authorization',
      migrationId: MIGRATION_ID,
      operationId: package_.importPlan.operationId,
      planSha256: package_.importPlan.binding.contentSha256,
      remoteWritesAllowed: false,
      repositoryCommitSha: package_.importPlan.executionContext.repositoryCommitSha,
      sourceArtifactSha256: package_.importPlan.sourceArtifactSha256,
      targetDatabase: 'local',
    })
    const exactStaleStateBefore = await queryJson(
      exactBatchSnapshotSql(package_.importPlan.batchId),
    )
    const exactStaleDatabaseStateRejected = await psql(
      `begin;
set local session_replication_role = 'replica';
update public.literature_gold_set_batches
set sampling_report = sampling_report || '{"exactStaleStateProbe":true}'::jsonb
where id = ${escapedBatchId}::uuid;
set local session_replication_role = 'origin';
${expectedSqlstateBlock(importRpcCall(package_.importPlan, importAuthorization), 'P7607')}
rollback;`,
    ).then(() => true)
    const exactStaleStateAfter = await queryJson(exactBatchSnapshotSql(package_.importPlan.batchId))
    if (!same(exactStaleStateBefore, exactStaleStateAfter)) {
      throw new Error('Rollback-only exact stale-state rejection changed disposable state.')
    }
    // Execute once and intentionally discard the response. The next command is
    // read-only reconciliation, never an automatic retry of the mutation RPC.
    await psql(importRpcSql(package_.importPlan, importAuthorization), true)
    const observedImport = z
      .object({
        actionCount: z.number().int(),
        effective: sha256Schema,
        physical: sha256Schema,
        status: z.literal('completed'),
      })
      .parse(
        await queryJson(`select pg_catalog.jsonb_build_object(
          'status', operation.status,
          'actionCount', (select count(*)::integer
            from public.literature_gold_review_operation_actions action
            where action.operation_id = operation.id),
          'physical', public.literature_gold_physical_state_hash_v1(
            ${escapedBatchId}::uuid, 'development'
          ),
          'effective', public.literature_gold_effective_state_hash_v1(
            ${escapedBatchId}::uuid, 'development'
          )
        ) from public.literature_gold_review_operations operation
        where operation.id = ${sqlLiteral(package_.importPlan.operationId)}::uuid;`),
      )
    if (observedImport.actionCount !== EXACT_IMPORT_COUNTS.total) {
      throw new Error('Lost-ack observation did not find the exact completed import journal.')
    }
    const recoveryAuthorization = bindRecoveryAuthorization({
      authorizationId: fixedUuid(`${package_.importPlan.operationId}:recovery-authorization`),
      authorizationNote: 'Read-only exact-package lost-acknowledgement reconciliation.',
      authorized: true,
      authorizedAt: '2030-01-01T00:00:00.500Z',
      authorizedBy: 'disposable-rehearsal@example.invalid',
      batchId: package_.importPlan.batchId,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      kind: 'recovery_authorization',
      migrationId: MIGRATION_ID,
      observedEffectiveStateSha256: observedImport.effective,
      observedPhysicalStateSha256: observedImport.physical,
      permitsMutation: false,
      recoveryAction: 'resolve_ambiguous_import',
      remoteWritesAllowed: false,
      repositoryCommitSha: package_.importPlan.executionContext.repositoryCommitSha,
      targetDatabase: 'local',
      targetIdempotencyKey: package_.importPlan.binding.idempotencyKey,
      targetOperationId: package_.importPlan.operationId,
      targetPlanSha256: package_.importPlan.binding.contentSha256,
    })
    const stateBeforeLostAckReconciliation = await queryJson(
      exactBatchSnapshotSql(package_.importPlan.batchId),
    )
    const reconciledImport = parseImportReceipt(
      await queryJson(recoveryRpcSql(package_.importPlan.operationId, recoveryAuthorization)),
    )
    const stateAfterLostAckReconciliation = await queryJson(
      exactBatchSnapshotSql(package_.importPlan.batchId),
    )
    if (
      reconciledImport.outcome !== 'committed' ||
      reconciledImport.response !== 'idempotent_replay' ||
      reconciledImport.counts.applied !== EXACT_IMPORT_COUNTS.inserts ||
      reconciledImport.counts.noops !== EXACT_IMPORT_COUNTS.noops ||
      reconciledImport.afterPhysicalStateSha256 !== observedImport.physical ||
      reconciledImport.afterEffectiveStateSha256 !== observedImport.effective ||
      !same(stateBeforeLostAckReconciliation, stateAfterLostAckReconciliation)
    ) {
      throw new Error('Read-only lost-acknowledgement reconciliation failed.')
    }
    const stateBeforeExactReplay = stateAfterLostAckReconciliation
    const replayedImport = parseImportReceipt(
      await queryJson(importRpcSql(package_.importPlan, importAuthorization)),
    )
    const stateAfterExactReplay = await queryJson(
      exactBatchSnapshotSql(package_.importPlan.batchId),
    )
    if (
      replayedImport.response !== 'idempotent_replay' ||
      replayedImport.binding.contentSha256 !== reconciledImport.binding.contentSha256 ||
      !same(stateBeforeExactReplay, stateAfterExactReplay)
    ) {
      throw new Error('Separate exact replay idempotency proof failed.')
    }

    const rejectionStateBefore = await queryJson(`select pg_catalog.jsonb_build_object(
      'physical', public.literature_gold_physical_state_hash_v1(
        ${escapedBatchId}::uuid, 'development'),
      'operationCount', (select count(*)::integer
        from public.literature_gold_review_operations)
    );`)
    const importAuthorizationContent = Object.fromEntries(
      Object.entries(importAuthorization).filter(([key]) => key !== 'binding'),
    ) as Parameters<typeof bindImportAuthorization>[0]
    const staleAuthorization = bindImportAuthorization({
      ...importAuthorizationContent,
      authorizationId: fixedUuid(`${package_.importPlan.operationId}:stale-authorization`),
      operationId: fixedUuid(`${package_.importPlan.operationId}:wrong-operation`),
    })
    const exactStaleAuthorizationRejected = await psql(
      expectedSqlstateBlock(importRpcCall(package_.importPlan, staleAuthorization), 'P7602'),
    ).then(() => true)
    const exactWrongOperationIdRejected = await psql(
      expectedSqlstateBlock(
        recoveryRpcCall(
          fixedUuid(`${package_.importPlan.operationId}:wrong-reconcile-operation`),
          recoveryAuthorization,
        ),
        'P7641',
      ),
    ).then(() => true)
    const rejectionStateAfter = await queryJson(`select pg_catalog.jsonb_build_object(
      'physical', public.literature_gold_physical_state_hash_v1(
        ${escapedBatchId}::uuid, 'development'),
      'operationCount', (select count(*)::integer
        from public.literature_gold_review_operations)
    );`)
    if (!same(rejectionStateBefore, rejectionStateAfter)) {
      throw new Error('Exact stale/wrong-operation rejection mutated disposable state.')
    }

    const compensationPlan = bindCompensationPlan({
      actions: package_.compensationActions,
      batchId: package_.importPlan.batchId,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      counts: EXACT_COMPENSATION_COUNTS,
      executionContext: package_.importPlan.executionContext,
      expectedEffectiveStateSha256: reconciledImport.afterEffectiveStateSha256,
      expectedPhysicalStateSha256: reconciledImport.afterPhysicalStateSha256,
      expectedPostEffectiveStateSha256: package_.importPlan.expectedEffectiveStateSha256,
      importPlanSha256: package_.importPlan.binding.contentSha256,
      importReceiptSha256: reconciledImport.binding.contentSha256,
      kind: 'compensation',
      operationId: package_.compensationOperationId,
      scope: package_.importPlan.scope,
      sourceArtifactSha256: package_.importPlan.sourceArtifactSha256,
      targetImportOperationId: package_.importPlan.operationId,
    })
    const compensationAuthorization = bindCompensationAuthorization({
      authorizationId: fixedUuid(
        `${package_.compensationOperationId}:rehearsal-compensation-authorization`,
      ),
      authorizationNote:
        'Disposable exact-package compensation rehearsal authorization; never valid elsewhere.',
      authorized: true,
      authorizedAt: '2030-01-01T00:00:01.000Z',
      authorizedBy: 'disposable-rehearsal@example.invalid',
      batchId: compensationPlan.batchId,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      expectedEffectiveStateSha256: compensationPlan.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: compensationPlan.expectedPhysicalStateSha256,
      expectedPostEffectiveStateSha256: compensationPlan.expectedPostEffectiveStateSha256,
      idempotencyKey: compensationPlan.binding.idempotencyKey,
      importReceiptSha256: compensationPlan.importReceiptSha256,
      kind: 'compensation_authorization',
      migrationId: MIGRATION_ID,
      operationId: compensationPlan.operationId,
      planSha256: compensationPlan.binding.contentSha256,
      remoteWritesAllowed: false,
      repositoryCommitSha: compensationPlan.executionContext.repositoryCommitSha,
      sourceArtifactSha256: compensationPlan.sourceArtifactSha256,
      targetDatabase: 'local',
      targetImportOperationId: compensationPlan.targetImportOperationId,
    })
    const compensationReceipt = parseCompensationReceipt(
      await queryJson(compensationRpcSql(compensationPlan, compensationAuthorization)),
    )
    if (
      compensationReceipt.outcome !== 'committed' ||
      compensationReceipt.counts.applied !==
        EXACT_COMPENSATION_COUNTS.restored + EXACT_COMPENSATION_COUNTS.voided ||
      compensationReceipt.counts.noops !== EXACT_COMPENSATION_COUNTS.noops
    ) {
      throw new Error('Exact append-only compensation count verification failed.')
    }

    const secondCompensationOperationId = fixedUuid(
      `${package_.compensationOperationId}:second-compensation`,
    )
    const secondCompensationPlan = bindCompensationPlan({
      actions: package_.compensationActions,
      batchId: package_.importPlan.batchId,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      counts: EXACT_COMPENSATION_COUNTS,
      executionContext: package_.importPlan.executionContext,
      expectedEffectiveStateSha256: compensationReceipt.afterEffectiveStateSha256,
      expectedPhysicalStateSha256: compensationReceipt.afterPhysicalStateSha256,
      expectedPostEffectiveStateSha256: compensationReceipt.afterEffectiveStateSha256,
      importPlanSha256: package_.importPlan.binding.contentSha256,
      importReceiptSha256: reconciledImport.binding.contentSha256,
      kind: 'compensation',
      operationId: secondCompensationOperationId,
      scope: package_.importPlan.scope,
      sourceArtifactSha256: package_.importPlan.sourceArtifactSha256,
      targetImportOperationId: package_.importPlan.operationId,
    })
    const secondCompensationAuthorization = bindCompensationAuthorization({
      authorizationId: fixedUuid(`${secondCompensationOperationId}:authorization`),
      authorizationNote: 'Negative exact-package second compensation rehearsal.',
      authorized: true,
      authorizedAt: '2030-01-01T00:00:02.000Z',
      authorizedBy: 'disposable-rehearsal@example.invalid',
      batchId: secondCompensationPlan.batchId,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      expectedEffectiveStateSha256: secondCompensationPlan.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: secondCompensationPlan.expectedPhysicalStateSha256,
      expectedPostEffectiveStateSha256: secondCompensationPlan.expectedPostEffectiveStateSha256,
      idempotencyKey: secondCompensationPlan.binding.idempotencyKey,
      importReceiptSha256: secondCompensationPlan.importReceiptSha256,
      kind: 'compensation_authorization',
      migrationId: MIGRATION_ID,
      operationId: secondCompensationPlan.operationId,
      planSha256: secondCompensationPlan.binding.contentSha256,
      remoteWritesAllowed: false,
      repositoryCommitSha: secondCompensationPlan.executionContext.repositoryCommitSha,
      sourceArtifactSha256: secondCompensationPlan.sourceArtifactSha256,
      targetDatabase: 'local',
      targetImportOperationId: secondCompensationPlan.targetImportOperationId,
    })
    const secondCompensationStateBefore = await queryJson(`select pg_catalog.jsonb_build_object(
      'physical', public.literature_gold_physical_state_hash_v1(
        ${escapedBatchId}::uuid, 'development'),
      'operationCount', (select count(*)::integer
        from public.literature_gold_review_operations)
    );`)
    const exactSecondCompensationRejected = await psql(
      expectedSqlstateBlock(
        compensationRpcCall(secondCompensationPlan, secondCompensationAuthorization),
        'P7625',
      ),
    ).then(() => true)
    const secondCompensationStateAfter = await queryJson(`select pg_catalog.jsonb_build_object(
      'physical', public.literature_gold_physical_state_hash_v1(
        ${escapedBatchId}::uuid, 'development'),
      'operationCount', (select count(*)::integer
        from public.literature_gold_review_operations)
    );`)
    if (!same(secondCompensationStateBefore, secondCompensationStateAfter)) {
      throw new Error('Rejected exact second compensation mutated disposable state.')
    }

    const postCompensation = z
      .object({
        effective: sha256Schema,
        physical: sha256Schema,
        pointerMismatches: z.number().int(),
      })
      .parse(
        await queryJson(`with latest as (
          select distinct on (review.item_id) review.item_id, review.id
          from public.literature_gold_set_reviews review
          join public.literature_gold_set_items item on item.id = review.item_id
          where item.batch_id = ${escapedBatchId}::uuid and item.dataset_split = 'development'
          order by review.item_id, review.revision desc, review.id
        ) select pg_catalog.jsonb_build_object(
          'effective', public.literature_gold_effective_state_hash_v1(
            ${escapedBatchId}::uuid, 'development'
          ),
          'physical', public.literature_gold_physical_state_hash_v1(
            ${escapedBatchId}::uuid, 'development'
          ),
          'pointerMismatches', count(*) filter (where item.current_review_id is distinct from latest.id)
        ) from public.literature_gold_set_items item
        left join latest on latest.item_id = item.id
        where item.batch_id = ${escapedBatchId}::uuid and item.dataset_split = 'development';`),
      )
    if (
      postCompensation.effective !== package_.importPlan.expectedEffectiveStateSha256 ||
      postCompensation.physical !== compensationReceipt.afterPhysicalStateSha256 ||
      postCompensation.pointerMismatches !== 0
    ) {
      throw new Error(
        'Post-compensation effective restoration or latest-head pointer proof failed.',
      )
    }

    const securityIntrospection = validateSecurityIntrospection(
      await queryJson(SECURITY_INTROSPECTION_SQL),
      {
        expectedSchemaSecurityIdentitySha256:
          package_.descriptor.audit.schemaSecurityIdentitySha256,
      },
    )
    const rpcContract = validateExactRpcContractMetadata(await queryJson(EXACT_RPC_METADATA_SQL))
    const databaseUrl = `postgresql://${databaseUser}:${password}@127.0.0.1:${hostPort}/${database}`
    const lintResult = await runCommand(
      'npx',
      [
        '--no-install',
        'supabase',
        'db',
        'lint',
        '--db-url',
        databaseUrl,
        '--schema',
        'public',
        '--level',
        'warning',
        '--fail-on',
        'none',
        '--output',
        'json',
      ],
      { env: { PGSSLMODE: 'disable' } },
    )
    const lint = validateSupabaseLint(JSON.parse(lintResult.stdout) as unknown)
    if (lint.errors.length !== 0) throw new Error('Supabase lint returned errors.')
    const security = buildExactEvidenceSecuritySummary(securityIntrospection, lint)

    const systemIdentifier = z
      .object({ systemIdentifier: z.string().min(1) })
      .parse(
        await queryJson(
          `select pg_catalog.jsonb_build_object('systemIdentifier', system_identifier::text) from pg_catalog.pg_control_system();`,
        ),
      )
    const databaseFingerprintSha256 = sha256Bytes(
      `${POSTGRES_IMAGE}\0${systemIdentifier.systemIdentifier}`,
    )
    const evidence = exactPackageRehearsalEvidenceSchema.parse({
      compensationCounts: EXACT_COMPENSATION_COUNTS,
      deterministicArtifacts: false,
      effectiveState: {
        postCompensationSha256: postCompensation.effective,
        postImportSha256: replayedImport.afterEffectiveStateSha256,
        preImportSha256: replayedImport.beforeEffectiveStateSha256,
      },
      importCounts: EXACT_IMPORT_COUNTS,
      migration: package_.descriptor.migration,
      packageManifestSha256: package_.manifestSha256,
      physicalState: {
        postCompensationSha256: compensationReceipt.afterPhysicalStateSha256,
        postImportSha256: replayedImport.afterPhysicalStateSha256,
        preImportSha256: replayedImport.beforePhysicalStateSha256,
      },
      scenarioArtifactsSha256: sha256Bytes(normalizedContractScenarioBytes),
      scenarios: {
        ambiguousLostAcknowledgementReconciledWithoutRetry:
          scenarioPassed('S05_ambiguous_outcome') &&
          scenarioPassed('S06_read_only_reconciliation') &&
          reconciledImport.binding.contentSha256 === replayedImport.binding.contentSha256,
        currentPointerAlwaysLatestPhysicalHead:
          scenarioPassed('S19_pointer_rewind_and_history_mutation_rejected') &&
          postCompensation.pointerMismatches === 0,
        exactReplayIdempotent:
          scenarioPassed('S03_exact_mixed_package') &&
          replayedImport.response === 'idempotent_replay',
        heldOutIdentityDisclosureCount: 0,
        heldOutScopeRejected: scenarioPassed('S18_held_out_item_rejected'),
        oldPointerRewindPackageRejected:
          scenarioPassed('S19_pointer_rewind_and_history_mutation_rejected') &&
          scenarioPassed('S20_legacy_pointer_rewind_plan_rejected'),
        ordinaryReviewAfterRestorePassed: scenarioPassed('S11_standard_review_after_restore'),
        ordinaryReviewAfterVoidPassed: scenarioPassed('S12_standard_review_after_void'),
        secondCompensationRejectedOrVerifiedExisting:
          scenarioPassed('S17_second_compensation_rejected') && exactSecondCompensationRejected,
        staleAuthorizationRejected:
          scenarioPassed('S14_stale_authorization_rejected') &&
          exactStaleAuthorizationRejected &&
          same(rejectionStateBefore, rejectionStateAfter),
        staleDatabaseStateRejected:
          scenarioPassed('S13_stale_before_state_rejected') &&
          exactStaleDatabaseStateRejected &&
          same(exactStaleStateBefore, exactStaleStateAfter),
        wrongOperationIdRejected:
          scenarioPassed('S15_wrong_import_operation_id_rejected') &&
          scenarioPassed('S16_wrong_compensation_operation_id_rejected') &&
          exactWrongOperationIdRejected &&
          same(rejectionStateBefore, rejectionStateAfter),
      },
      schemaVersion: EXACT_PACKAGE_EVIDENCE_SCHEMA_VERSION,
      security,
      targetDatabaseFingerprintSha256: databaseFingerprintSha256,
    })
    const attestation: DisposableDatabaseAttestation = {
      containerId: runtimeContainerId,
      databaseCreatedForThisRun: true,
      databaseFingerprintSha256,
      databaseHostPort: hostPort,
      databaseName: database,
      databaseUrl,
      dockerEndpoint,
      existingIdempotencyKeys: [],
      existingOperationIds: [],
      migration: {
        id: MIGRATION_ID,
        ledgerOccurrences: migrationLedger.occurrences,
        sha256: package_.descriptor.migration.sha256,
      },
      outputDirectoryWasAbsent: true,
      packageManifestSha256: package_.manifestSha256,
      protectedRealLocalDatabasePort: PROTECTED_REAL_LOCAL_DATABASE_PORT,
      schemaVersion: DISPOSABLE_ATTESTATION_SCHEMA_VERSION,
      seedEffectiveStateSha256: package_.importPlan.expectedEffectiveStateSha256,
      seedPhysicalStateSha256: package_.importPlan.expectedPhysicalStateSha256,
      targetKind: 'fresh_disposable_database',
    }
    const report = await runExactPackageDisposableRehearsal({
      attestation,
      executor: { execute: async () => evidence },
      files: input.files,
    })
    const deterministicArtifacts = buildDeterministicExactPackageRehearsalArtifacts({
      canonicalContractScenarioBytes: normalizedContractScenarioBytes,
      evidence,
      lint,
      report,
      rpcContract,
      securityIntrospection,
    })
    completedExecution = {
      canonicalArtifacts: deterministicArtifacts.canonicalArtifacts,
      manifestBytes: deterministicArtifacts.manifestBytes,
      rawReceipt: {
        compensationReceipt,
        disposableRuntime: {
          automaticallyAssignedPort: hostPort,
          containerId: runtimeContainerId,
          containerName: container,
          dockerEndpoint,
          host: '127.0.0.1',
          image: POSTGRES_IMAGE,
          runNonceSha256: sha256Bytes(runNonce),
        },
        exactReplayImportReceipt: replayedImport,
        migrationLedger,
        outputDirectory: input.outputDirectory,
        packageManifestSha256: package_.manifestSha256,
        preMigrationBackupManifestSha256: input.preMigrationBackup.manifestSha256,
        rawContractScenarioEvidence: contractScenarios,
        rawDatabaseFingerprintSha256: databaseFingerprintSha256,
        rawExactPackageEvidence: evidence,
        rawLint: {
          diagnostics: lintResult.stderr.trim(),
          result: lint,
        },
        rawRpcContract: rpcContract,
        rawSecurityIntrospection: securityIntrospection,
        reconciledImportReceipt: reconciledImport,
        recoveryAuthorization,
      },
      report,
    }
  } catch (error) {
    primaryError = error
  }

  const cleanup = await (signalWorkflowPromise ?? cleanupOnce())
  if (receivedSignal) primaryError = interruptionError(primaryError)
  try {
    unregisterSignalHandler()
  } catch (error) {
    primaryError =
      primaryError === null
        ? error
        : new AggregateError(
            [primaryError, error],
            `Exact-package rehearsal could not unregister its graceful-signal handlers: ${errorMessage(error)}.`,
          )
  } finally {
    unregisterSignalHandler = () => undefined
  }
  const cleanupError = cleanupOutcomeError(cleanup)
  if (primaryError === null && completedExecution === undefined) {
    primaryError = new Error('Disposable rehearsal ended without a result or a primary error.')
  }
  const executionError = combinedExecutionError(primaryError, cleanupError)
  const completedAt = runtime.now()
  const receiptBase = {
    cleanup,
    completedAt,
    disposableRuntime: completedExecution?.rawReceipt.disposableRuntime ?? {
      containerId: runtimeContainerId || null,
      containerName: container,
      dockerEndpoint: dockerEndpoint || null,
      image: POSTGRES_IMAGE,
      runNonceSha256: sha256Bytes(runNonce),
    },
    outputDirectory: input.outputDirectory,
    packageManifestSha256: package_.manifestSha256,
    preMigrationBackupManifestSha256: input.preMigrationBackup.manifestSha256,
    signal: {
      activeCommandCancellationError:
        signalCancellationError === null ? null : errorMessage(signalCancellationError),
      received: receivedSignal,
    },
    schemaVersion: 'gold-import-compensation-exact-package-execution-receipt/v1',
    startedAt,
  }

  if (executionError) {
    const failureReceipt = {
      ...receiptBase,
      canonicalArtifacts: {
        approved: false,
        invalidatedByCleanupFailure: cleanupError !== null,
        published: false,
      },
      cleanupError: cleanupError?.message ?? null,
      executionApproval: 'not_approved',
      passed: false,
      primaryError: primaryError === null ? null : errorMessage(primaryError),
      result: 'failed',
    }
    let receiptWriteError: unknown = null
    try {
      writeExclusiveOutputFiles(input.outputIdentity, [
        {
          bytes: Buffer.from(`${JSON.stringify(failureReceipt, null, 2)}\n`, 'utf8'),
          name: 'execution-receipt.json',
        },
      ])
      await assertExclusiveOutputDirectoryIdentity(input.outputIdentity)
    } catch (error) {
      receiptWriteError = error
    }
    if (receiptWriteError !== null) {
      throw new AggregateError(
        [executionError, receiptWriteError],
        `Exact-package rehearsal failed and its failure receipt could not be written; execution error: ${executionError.message}; receipt error: ${errorMessage(receiptWriteError)}`,
      )
    }
    throw executionError
  }

  const approvedExecution = completedExecution as NonNullable<typeof completedExecution>
  const approvedReceiptBytes = Buffer.from(
    `${JSON.stringify(
      {
        ...receiptBase,
        ...approvedExecution.rawReceipt,
        canonicalArtifacts: {
          approved: true,
          invalidatedByCleanupFailure: false,
          published: true,
        },
        cleanup,
        cleanupError: null,
        completedAt,
        executionApproval: 'approved',
        passed: true,
        primaryError: null,
        result: 'passed',
        startedAt,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  writeExclusiveOutputFiles(input.outputIdentity, [
    ...[...approvedExecution.canonicalArtifacts].map(([name, bytes]) => ({ bytes, name })),
    { bytes: approvedExecution.manifestBytes, name: 'canonical-manifest.sha256' },
    { bytes: approvedReceiptBytes, name: 'execution-receipt.json' },
  ])
  await assertExclusiveOutputDirectoryIdentity(input.outputIdentity)
  return approvedExecution.report
}

export async function executeExactPackageAgainstFreshDisposableDatabase(
  input: ExecuteFreshDisposableInput,
): Promise<ExactPackageRehearsalReport> {
  return executeFreshDisposableRuntime(input, PRODUCTION_RUNTIME)
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

export async function readExactPackageDirectory(
  packageDirectory: string,
): Promise<Map<string, Buffer>> {
  await assertNoSymlinkAncestors(packageDirectory)
  const entries = await readdir(packageDirectory, { withFileTypes: true })
  const files = new Map<string, Buffer>()
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Exact package contains a non-regular entry: ${entry.name}.`)
    }
    files.set(entry.name, await readFile(resolve(packageDirectory, entry.name)))
  }
  return files
}

export async function writeRehearsalReportExclusive(input: {
  beforeAnchoredWriteForTest?: (outputDirectory: string) => Promise<void> | void
  outputDirectory: string
  outputRoot: string
  report: ExactPackageRehearsalReport
}): Promise<void> {
  const output = await createExclusiveOutputDirectory(input)
  await input.beforeAnchoredWriteForTest?.(output.outputDirectory)
  const reportBytes = Buffer.from(
    `${JSON.stringify(JSON.parse(canonicalJson(input.report)), null, 2)}\n`,
    'utf8',
  )
  const manifestBytes = Buffer.from(
    `${sha256Bytes(reportBytes)}  exact-package-rehearsal-report.json\n`,
    'utf8',
  )
  writeExclusiveOutputFiles(output, [
    { bytes: reportBytes, name: 'exact-package-rehearsal-report.json' },
    { bytes: manifestBytes, name: 'canonical-manifest.sha256' },
  ])
  await assertExclusiveOutputDirectoryIdentity(output)
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

const HELP = `
Execute the exact generated package in a fresh fixed-image disposable database.

This command owns a PostgreSQL 17 Docker container on a Docker-assigned
loopback port. It applies and records the eight historical migrations, restores
the checksum-bound development backup, applies and records the exact contract
migration, runs contract scenarios and the exact import/reconcile/replay/
compensation sequence, runs lint/security checks, writes evidence, and destroys
the container. Canonical success evidence is published only after cleanup and an
independent exact-name and, when known, container-ID absence check both succeed;
cleanup failure exits nonzero. Graceful SIGINT/SIGTERM terminates the active
child, performs the same exactly-once cleanup, writes a non-approved receipt,
and exits nonzero. SIGKILL and host/runtime death require manual residue checks.
Caller-authored SQL, database URLs, attestations, and evidence are not accepted.

Usage:
  npm run literature:rehearse-exact-gold-import-compensation-package -- \\
    --package <generated-package-directory> \\
    --pre-migration-backup <checksum-bound-backup-directory> \\
    --pre-migration-backup-manifest-sha256 <reviewed-manifest-sha256> \\
    --artifact <gold-set-v1-enrichment-v3-final-development-630.csv> \\
    --protocol-authorization <signed-protocol-authorization> \\
    --amended-authorization <amended-two-row-authorization> \\
    --migration <20260808035633_add_literature_gold_import_compensation_contract.sql> \\
    --output-root <approved-local-output-root> --output <new-evidence-directory>
`.trim()

export interface ExactPackageRehearsalCliDependencies {
  executeFreshDisposableDatabase(
    input: ExecuteFreshDisposableInput,
  ): Promise<ExactPackageRehearsalReport>
  identityPolicy?: PackageSourceIdentityPolicy
  loadPreMigrationBackup(
    directory: string,
    trustedManifestSha256: string,
  ): Promise<LoadedPreMigrationBackup>
}

const PRODUCTION_CLI_DEPENDENCIES: ExactPackageRehearsalCliDependencies = {
  executeFreshDisposableDatabase: executeExactPackageAgainstFreshDisposableDatabase,
  loadPreMigrationBackup: loadAndVerifyBackup,
}

async function createEmptyRehearsalOutputDirectory(input: {
  outputDirectory: string
  outputRoot: string
}): Promise<ExclusiveOutputDirectoryIdentity> {
  return createExclusiveOutputDirectory(input)
}

export async function runExactPackageRehearsalCli(
  argv: readonly string[],
  dependencies: ExactPackageRehearsalCliDependencies = PRODUCTION_CLI_DEPENDENCIES,
): Promise<{
  outputDirectory: string
  packageManifestSha256: string
}> {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, [
    'amended-authorization',
    'artifact',
    'help',
    'migration',
    'output',
    'output-root',
    'package',
    'pre-migration-backup',
    'pre-migration-backup-manifest-sha256',
    'protocol-authorization',
  ])
  if (arguments_.flags.has('help')) {
    console.log(HELP)
    return { outputDirectory: '', packageManifestSha256: '' }
  }
  const rawOutputRoot = requiredArgument(arguments_, 'output-root')
  const rawOutputDirectory = requiredArgument(arguments_, 'output')
  assertSafeOutputPathArgument(rawOutputRoot, '--output-root')
  assertSafeOutputPathArgument(rawOutputDirectory, '--output')
  const outputRoot = resolve(rawOutputRoot)
  const outputDirectory = resolve(rawOutputDirectory)
  const packageDirectory = resolve(requiredArgument(arguments_, 'package'))
  const files = await readExactPackageDirectory(packageDirectory)
  const package_ = verifyExactGeneratedPackage(
    files,
    dependencies.identityPolicy ?? PRODUCTION_SOURCE_IDENTITIES,
  )
  const trustedBackupManifestSha256 = requiredArgument(
    arguments_,
    'pre-migration-backup-manifest-sha256',
  )
  if (trustedBackupManifestSha256 !== package_.descriptor.audit.preMigrationBackupManifestSha256) {
    throw new Error('Reviewed pre-migration backup manifest SHA is stale for the exact package.')
  }
  const sources: PackageSourceBytes = {
    amendedAuthorization: await readFile(
      resolve(requiredArgument(arguments_, 'amended-authorization')),
    ),
    finalArtifact: await readFile(resolve(requiredArgument(arguments_, 'artifact'))),
    migration: await readFile(resolve(requiredArgument(arguments_, 'migration'))),
    protocolAuthorization: await readFile(
      resolve(requiredArgument(arguments_, 'protocol-authorization')),
    ),
  }
  assertExactPackageSourceBytes(package_, sources)
  const loadedPreMigrationBackup = await dependencies.loadPreMigrationBackup(
    resolve(requiredArgument(arguments_, 'pre-migration-backup')),
    trustedBackupManifestSha256,
  )
  const preMigrationBackup = verifyLoadedPreMigrationBackupForPackage({
    loaded: loadedPreMigrationBackup,
    package: package_,
    trustedManifestSha256: trustedBackupManifestSha256,
  })
  const outputIdentity = await createEmptyRehearsalOutputDirectory({ outputDirectory, outputRoot })
  const report = await dependencies.executeFreshDisposableDatabase({
    files,
    outputDirectory,
    outputIdentity,
    preMigrationBackup,
    sources,
    identityPolicy: dependencies.identityPolicy,
  })
  return { outputDirectory, packageManifestSha256: report.packageManifestSha256 }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runExactPackageRehearsalCli(process.argv.slice(2))
    .then((result) => {
      if (result.outputDirectory) console.log(`${JSON.stringify(result, null, 2)}\n`)
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}

// Compile-time sentinels keep the operational receipts tied to the published
// source identities even when tests inject a fixture-only identity policy.
void FINAL_V3_ARTIFACT_SHA256
void SIGNED_PROTOCOL_AUTHORIZATION_SHA256
void AMENDED_TWO_ROW_AUTHORIZATION_SHA256
void MIGRATION_SHA256
