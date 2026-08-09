/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  MIGRATION_ID,
  MIGRATION_SHA256,
  developmentPlanningStateSha256,
  derivePackagePlanningRows,
  generateGoldImportCompensationPackage,
  runPackageGeneratorCli,
  verifyReadyPostMigrationAuditPackage,
  writeGeneratedPackageExclusive,
  type GeneratedPackage,
  type PackageSourceBytes,
  type PackageSourceIdentityPolicy,
} from './generate-gold-import-compensation-package-v1'
import {
  DISPOSABLE_POSTGRES_IMAGE,
  assertDisposableRehearsalTarget,
  assertDisposableContainerCleanupSucceeded,
  assertExactPackageSourceBytes,
  buildDeterministicExactPackageRehearsalArtifacts,
  executeFreshDisposableRuntime,
  exactBatchSnapshotSql,
  EXACT_RPC_METADATA_SQL,
  cleanupDisposableContainer,
  injectCompletedDisposableExecutionForTest,
  renderDevelopmentDatabaseSeedSql,
  runExactPackageRehearsalCli,
  validateExactRpcContractMetadata,
  verifyDevelopmentDatabaseBackupFixtureForTest,
  verifyExactGeneratedPackage,
  verifyLoadedPreMigrationBackupForPackage,
  writeRehearsalReportExclusive,
  type CommandResult,
  type DisposableRuntime,
  type DevelopmentDatabaseSeed,
  type ExactPackageRehearsalEvidence,
  type ExactPackageRehearsalCliDependencies,
  type ExactPackageRehearsalReport,
  type ExecuteFreshDisposableInput,
} from './rehearse-exact-gold-import-compensation-package-v1'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  assertSerializedAggregateOrdering,
  type LoadedPreMigrationBackup,
} from './gold-import-compensation-migration-operations'
import { schemaSecurityDefinitionIdentitySha256 } from './gold-import-compensation-rehearsal-evidence'
import {
  SCHEMA_DEFINITION_MUTATION_PROBES,
  SECURITY_INTROSPECTION_SQL,
} from './rehearse-gold-import-compensation-db'
import {
  createExclusiveOutputDirectory,
  type ExclusiveOutputDirectoryIdentity,
} from './lib/exclusive-output'

// Historical package-shape fixture. Production gates derive these counts from
// the bound row actions and do not require this legacy distribution.
const EXACT_IMPORT_COUNTS = {
  initial: 621,
  inserts: 624,
  noops: 6,
  revisions: 3,
  total: 630,
} as const
const EXACT_COMPENSATION_COUNTS = {
  noops: 6,
  restored: 3,
  total: 630,
  voided: 621,
} as const

jest.setTimeout(30_000)

const FIXED_TIME = '2026-08-08T00:00:00.000Z'
const PINNED_SCHEMA_SECURITY_DEFINITION_IDENTITY = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      'scripts/literature/fixtures/post-migration-schema-security-definition-identity.json',
    ),
    'utf8',
  ),
) as Record<string, unknown>
const CSV_HEADER = [
  'gold_set_item_id',
  'master_row_id',
  'pmid',
  'dataset_split',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency',
  'topic_ids',
  'technology_tags',
  'technology_tag_status',
  'clinical_purposes',
  'disease_tags',
  'disease_tag_status',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'physician_notes',
  'full_text_used',
  'is_blinded',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'enrichment_provenance',
] as const

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalPrettyBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`, 'utf8')
}

function buildVerifiedAuditPackage(audit: unknown, planningState: unknown) {
  const auditRecord = audit as {
    checks: { schemaSecurityDefinitionIdentity: Record<string, unknown> }
    database: { schemaSecurityIdentitySha256: string }
  }
  const auditBytes = canonicalPrettyBytes(audit)
  const developmentPlanningStateBytes = canonicalPrettyBytes(planningState)
  const markdownBytes = Buffer.from('# Fixture post-migration audit\n', 'utf8')
  const schemaSecurityDefinitionIdentityBytes = canonicalPrettyBytes(
    auditRecord.checks.schemaSecurityDefinitionIdentity,
  )
  const manifestBytes = Buffer.from(
    `${[
      ['development-planning-state.json', developmentPlanningStateBytes],
      ['migration-audit.json', auditBytes],
      ['migration-audit.md', markdownBytes],
      ['schema-security-definition-identity.json', schemaSecurityDefinitionIdentityBytes],
    ]
      .map(([name, bytes]) => `${sha256(bytes as Buffer)}  ${name as string}`)
      .join('\n')}\n`,
    'utf8',
  )
  return verifyReadyPostMigrationAuditPackage({
    auditBytes,
    developmentPlanningStateBytes,
    manifestBytes,
    markdownBytes,
    schemaSecurityDefinitionIdentityBytes,
    trustedManifestSha256: sha256(manifestBytes),
  })
}

async function safeTemporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(await realpath(tmpdir()), prefix))
}

async function createTestOutput(prefix: string): Promise<{
  outputDirectory: string
  outputIdentity: ExclusiveOutputDirectoryIdentity
  outputRoot: string
}> {
  const parent = await safeTemporaryDirectory(prefix)
  const outputRoot = join(parent, 'approved-root')
  const outputDirectory = join(outputRoot, 'output')
  await mkdir(outputRoot, { mode: 0o700 })
  const outputIdentity = await createExclusiveOutputDirectory({ outputDirectory, outputRoot })
  return { outputDirectory, outputIdentity, outputRoot }
}

function fixtureUuid(namespace: number, value: number): string {
  return `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${value
    .toString(16)
    .padStart(12, '0')}`
}

function historicalReview(notes: string) {
  return {
    categorizationFromFullText: false,
    clinicalPurposes: [],
    completedAt: FIXED_TIME,
    createdAt: FIXED_TIME,
    diseaseTagStatus: 'not_applicable',
    diseaseTags: [],
    enrichmentProvenance: 'physician_confirmed_ai_enrichment',
    enrichmentSchemaVersion: '3.0.2',
    isBlinded: true,
    labelSchemaVersion: '3.0.0',
    metadataSufficiency: 'adequate_abstract',
    notes,
    publicationStatus: null,
    relevanceLabel: 'exclude',
    reviewerConfidence: 'high',
    reviewerEmail: 'development-reviewer@example.test',
    reviewerUserId: null,
    reviewSeconds: 17,
    startedAt: FIXED_TIME,
    studyDesign: null,
    taxonomyVersion: '2.0.0',
    technologyTagStatus: 'not_applicable',
    technologyTags: [],
    topicIds: [],
    usedSupplementalMetadata: false,
  }
}

function artifactRow(itemId: string, pmid: string, notes: string): string {
  return [
    itemId,
    String(Number(pmid) - 10_000_000),
    pmid,
    'development',
    'exclude',
    'high',
    'adequate_abstract',
    '',
    '',
    'not_applicable',
    '',
    '',
    'not_applicable',
    '',
    '',
    'false',
    notes,
    'false',
    'true',
    '2.0.0',
    '3.0.0',
    '3.0.2',
    'physician_confirmed_ai_enrichment',
  ].join(',')
}

function buildDevelopmentSeed(batchId: string): DevelopmentDatabaseSeed {
  const articles: Array<Record<string, unknown>> = []
  const items: Array<Record<string, unknown>> = []
  for (let sequence = 1; sequence <= EXACT_IMPORT_COUNTS.total; sequence += 1) {
    const pmid = String(10_000_000 + sequence)
    articles.push({ pmid })
    items.push({
      batch_id: batchId,
      current_review_id: null,
      dataset_split: 'development',
      id: fixtureUuid(0x10000000, sequence),
      pmid,
    })
  }
  return {
    batchId,
    datasetSplit: 'development',
    heldOutIdentitiesIncluded: false,
    schemaVersion: 'gold-import-compensation-development-seed/v1',
    tables: {
      literature_articles: articles,
      literature_gold_set_batches: [{ id: batchId }],
      literature_gold_set_events: [],
      literature_gold_set_items: items,
      literature_gold_set_review_drafts: [],
      literature_gold_set_reviews: [],
    },
  }
}

function buildBackup(seed: DevelopmentDatabaseSeed) {
  const seedBytes = Buffer.from(`${JSON.stringify(seed)}\n`, 'utf8')
  const manifest = Buffer.from(`${sha256(seedBytes)}  development-database-seed.json\n`, 'utf8')
  return {
    files: new Map<string, Buffer>([
      ['checksum-manifest.sha256', manifest],
      ['development-database-seed.json', seedBytes],
    ]),
    manifestSha256: sha256(manifest),
    seed,
  }
}

function buildFixture() {
  const batchId = fixtureUuid(0x90000000, 1)
  const backup = buildBackup(buildDevelopmentSeed(batchId))
  const csvRows = [CSV_HEADER.join(',')]
  const planningRows: Array<Record<string, unknown>> = []

  for (let sequence = 1; sequence <= EXACT_IMPORT_COUNTS.total; sequence += 1) {
    const itemId = fixtureUuid(0x10000000, sequence)
    const pmid = String(10_000_000 + sequence)
    const finalizedNotes = `Finalized decision ${sequence}`
    const isInitial = sequence <= EXACT_IMPORT_COUNTS.initial
    const isRevision =
      sequence > EXACT_IMPORT_COUNTS.initial &&
      sequence <= EXACT_IMPORT_COUNTS.initial + EXACT_IMPORT_COUNTS.revisions
    const reviewId = isInitial ? null : fixtureUuid(0x20000000, sequence)
    csvRows.push(artifactRow(itemId, pmid, finalizedNotes))
    planningRows.push({
      currentEffectiveReview: isInitial
        ? null
        : historicalReview(isRevision ? `Legacy decision ${sequence}` : finalizedNotes),
      currentReviewId: reviewId,
      currentRevision: isInitial ? null : 1,
      datasetSplit: 'development',
      displayOrder: sequence - 1,
      effectiveReviewId: reviewId,
      itemId,
      itemState: isInitial
        ? {
            automatedSignalsRevealedAt: null,
            completedAt: null,
            reviewStatus: 'pending',
            startedAt: null,
            supplementalMetadataRevealedAt: null,
          }
        : {
            automatedSignalsRevealedAt: null,
            completedAt: FIXED_TIME,
            reviewStatus: 'completed',
            startedAt: FIXED_TIME,
            supplementalMetadataRevealedAt: null,
          },
      pmid,
      sequence,
    })
  }

  const sources: PackageSourceBytes = {
    amendedAuthorization: Buffer.from('fixture amended authorization\n', 'utf8'),
    finalArtifact: Buffer.from(`${csvRows.join('\n')}\n`, 'utf8'),
    migration: Buffer.from('fixture exact migration\n', 'utf8'),
    protocolAuthorization: Buffer.from('fixture signed protocol authorization\n', 'utf8'),
  }
  const identityPolicy: PackageSourceIdentityPolicy = {
    amendedAuthorizationSha256: sha256(sources.amendedAuthorization),
    finalArtifactSha256: sha256(sources.finalArtifact),
    migrationId: MIGRATION_ID,
    migrationSha256: sha256(sources.migration),
    protocolAuthorizationSha256: sha256(sources.protocolAuthorization),
  }
  const planningState = {
    datasetSplit: 'development' as const,
    rows: planningRows,
    schemaVersion: 'gold-import-compensation-development-planning-state/1.0.0' as const,
  }
  const currentEffectiveStateSha256 = sha256('fixture pre-import effective state')
  const currentPhysicalStateSha256 = sha256('fixture pre-import physical state')
  const schemaSecurityDefinitionIdentity = structuredClone(
    PINNED_SCHEMA_SECURITY_DEFINITION_IDENTITY,
  )
  const schemaSecurityIdentitySha256 = schemaSecurityDefinitionIdentitySha256(
    schemaSecurityDefinitionIdentity,
  )
  const audit = {
    checks: {
      behavioralProbe: 'none_on_real_batch_static_contract_and_snapshot_only',
      compensationExecuted: false,
      databaseMutationCount: 0,
      expectedSchemaSecurityIdentitySha256: schemaSecurityIdentitySha256,
      failures: [],
      importExecuted: false,
      lint: { errorCount: 0 },
      schemaSecurityDefinitionIdentity,
      security: { passed: true },
    },
    comparisons: {
      aggregateTestLockStateUnchanged: true,
      effectiveStatePreserved: true,
      pointerMutationCount: 0,
      postContractPhysicalStateSha256: currentPhysicalStateSha256,
      postEffectiveStateSha256: currentEffectiveStateSha256,
      postSchemaSecurityIdentitySha256: schemaSecurityIdentitySha256,
      preEffectiveStateSha256: currentEffectiveStateSha256,
      preSchemaSecurityIdentitySha256: sha256('fixture pre-migration schema security identity'),
      preexistingPhysicalStateAfterSha256: currentPhysicalStateSha256,
      preexistingPhysicalStateBeforeSha256: currentPhysicalStateSha256,
      priorMigrationLedgerRowsUnchanged: true,
      priorPhysicalStatePreserved: true,
      reviewMutationCount: 0,
      schemaChangedAsExpected: true,
    },
    database: {
      batchId,
      currentEffectiveStateSha256,
      currentPhysicalStateSha256,
      currentPointersAreLatestHeads: true,
      developmentPlanningStateSha256: developmentPlanningStateSha256(planningState),
      developmentMembershipSha256: sha256('fixture development membership'),
      heldOutIdentitiesAccessed: false,
      preMigrationBackupManifestSha256: backup.manifestSha256,
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
      id: MIGRATION_ID,
      ledgerOccurrences: 1,
      sha256: MIGRATION_SHA256,
    },
    readinessStatus: 'ready',
    schemaVersion: 'gold-import-compensation-migration-audit/1.0.0',
    status: 'ready',
  }
  const auditPackage = buildVerifiedAuditPackage(audit, planningState)
  const loadedBackup: LoadedPreMigrationBackup = {
    batchAndTestLock: { batch: { id: batchId }, testAggregate: { locked: true } },
    developmentSeed: backup.seed,
    developmentState: { datasetSplit: 'development', items: [] },
    manifestSha256: backup.manifestSha256,
    migrationLedger: { entries: [] },
    planningState,
    receipt: {
      databaseIdentity: {
        batchId,
        developmentMembershipSha256: audit.database.developmentMembershipSha256,
      },
      hashes: {
        effectiveStateSha256: currentEffectiveStateSha256,
        physicalStateSha256: currentPhysicalStateSha256,
      },
      repositoryCommitSha: audit.database.repositoryCommitSha,
    },
    schemaInventory: {},
    stateAudits: {
      effectiveStateSha256: currentEffectiveStateSha256,
      physicalStateSha256: currentPhysicalStateSha256,
    },
  }
  return { audit, auditPackage, backup, identityPolicy, loadedBackup, planningState, sources }
}

type Fixture = ReturnType<typeof buildFixture>

function jsonPackageFile<T>(generated: GeneratedPackage, name: string): T {
  const bytes = generated.files.get(name)
  if (!bytes) throw new Error(`Missing generated fixture file ${name}.`)
  return JSON.parse(bytes.toString('utf8')) as T
}

function rebindPackageManifest(files: Map<string, Buffer>): void {
  const manifest = Buffer.from(
    `${[...files.entries()]
      .filter(([name]) => name !== 'checksum-manifest.sha256')
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
  files.set('checksum-manifest.sha256', manifest)
}

function remanifestWithAlternateSchemaSecurityIdentity(
  generated: GeneratedPackage,
): Map<string, Buffer> {
  const files = new Map(generated.files)
  const identity = JSON.parse(
    (files.get('post-migration-schema-security-definition-identity.json') as Buffer).toString(
      'utf8',
    ),
  ) as { records: Array<Record<string, unknown>> }
  const firstRecord = identity.records[0]
  if (!firstRecord) throw new Error('Pinned schema/security fixture unexpectedly has no records.')
  const weakenedDefinition = `${String(firstRecord.normalizedDefinition)};fixture-weakened=true`
  firstRecord.normalizedDefinition = weakenedDefinition
  firstRecord.definitionSha256 = sha256(weakenedDefinition)
  const identitySha256 = schemaSecurityDefinitionIdentitySha256(identity)
  const identityBytes = canonicalPrettyBytes(identity)
  files.set('post-migration-schema-security-definition-identity.json', identityBytes)

  const audit = JSON.parse((files.get('post-migration-audit.json') as Buffer).toString('utf8')) as {
    checks: Record<string, unknown>
    comparisons: Record<string, unknown>
    database: Record<string, unknown>
  }
  audit.checks.schemaSecurityDefinitionIdentity = identity
  audit.checks.expectedSchemaSecurityIdentitySha256 = identitySha256
  audit.comparisons.postSchemaSecurityIdentitySha256 = identitySha256
  audit.database.schemaSecurityIdentitySha256 = identitySha256
  const auditBytes = canonicalPrettyBytes(audit)
  files.set('post-migration-audit.json', auditBytes)

  const auditManifestBytes = Buffer.from(
    `${[
      [
        'development-planning-state.json',
        files.get('post-migration-development-planning-state.json') as Buffer,
      ],
      ['migration-audit.json', auditBytes],
      ['migration-audit.md', files.get('post-migration-audit.md') as Buffer],
      ['schema-security-definition-identity.json', identityBytes],
    ]
      .map(([name, bytes]) => `${sha256(bytes as Buffer)}  ${name as string}`)
      .join('\n')}\n`,
    'utf8',
  )
  files.set('post-migration-audit-manifest.sha256', auditManifestBytes)

  const descriptor = JSON.parse(
    (files.get('package-descriptor.json') as Buffer).toString('utf8'),
  ) as { audit: Record<string, unknown> }
  descriptor.audit.canonicalManifestSha256 = sha256(auditManifestBytes)
  descriptor.audit.contentSha256 = sha256(auditBytes)
  descriptor.audit.schemaSecurityDefinitionIdentityFileSha256 = sha256(identityBytes)
  descriptor.audit.schemaSecurityIdentitySha256 = identitySha256
  files.set('package-descriptor.json', canonicalPrettyBytes(descriptor))
  rebindPackageManifest(files)
  return files
}

function passingReport(generated: GeneratedPackage, fixture: Fixture): ExactPackageRehearsalReport {
  return {
    compensationCounts: EXACT_COMPENSATION_COUNTS,
    contractVersion: 'gold-review-import-compensation/1.0.0',
    databaseMutationOutsideDisposableTarget: false,
    deterministicArtifacts: true,
    evidenceSha256: sha256('fixture rehearsal evidence'),
    heldOutIdentitiesAccessed: false,
    importCounts: EXACT_IMPORT_COUNTS,
    migrationId: MIGRATION_ID,
    migrationSha256: fixture.identityPolicy.migrationSha256,
    packageManifestSha256: generated.manifestSha256,
    physicalEqualityAfterCompensationClaimed: false,
    realLocalDatabaseTouched: false,
    remoteDatabaseTouched: false,
    result: 'passed',
    schemaSecurityDefinitionIdentitySha256: fixture.audit.database.schemaSecurityIdentitySha256,
    schemaVersion: 'gold-import-compensation-exact-package-rehearsal/v1',
    targetDatabase: {
      image: DISPOSABLE_POSTGRES_IMAGE,
      kind: 'fresh_disposable_database',
      network: 'docker_assigned_loopback_only',
    },
  }
}

async function writeCliFixture(root: string, generated: GeneratedPackage, fixture: Fixture) {
  const packageDirectory = join(root, 'package')
  const backupDirectory = join(root, 'pre-migration-backup')
  await Promise.all([mkdir(packageDirectory), mkdir(backupDirectory)])
  await Promise.all([
    ...[...generated.files].map(([name, bytes]) => writeFile(join(packageDirectory, name), bytes)),
    ...[...fixture.backup.files].map(([name, bytes]) =>
      writeFile(join(backupDirectory, name), bytes),
    ),
  ])
  const sourcePaths = {
    amendedAuthorization: join(root, 'amended-authorization.json'),
    artifact: join(root, 'artifact.csv'),
    migration: join(root, 'migration.sql'),
    protocolAuthorization: join(root, 'protocol-authorization.json'),
  }
  await Promise.all([
    writeFile(sourcePaths.amendedAuthorization, fixture.sources.amendedAuthorization),
    writeFile(sourcePaths.artifact, fixture.sources.finalArtifact),
    writeFile(sourcePaths.migration, fixture.sources.migration),
    writeFile(sourcePaths.protocolAuthorization, fixture.sources.protocolAuthorization),
  ])
  return {
    backupDirectory,
    backupManifestSha256: fixture.backup.manifestSha256,
    packageDirectory,
    sourcePaths,
  }
}

function cliArguments(
  paths: Awaited<ReturnType<typeof writeCliFixture>>,
  outputRoot: string,
  outputDirectory: string,
): string[] {
  return [
    '--package',
    paths.packageDirectory,
    '--pre-migration-backup',
    paths.backupDirectory,
    '--pre-migration-backup-manifest-sha256',
    paths.backupManifestSha256,
    '--artifact',
    paths.sourcePaths.artifact,
    '--protocol-authorization',
    paths.sourcePaths.protocolAuthorization,
    '--amended-authorization',
    paths.sourcePaths.amendedAuthorization,
    '--migration',
    paths.sourcePaths.migration,
    '--output-root',
    outputRoot,
    '--output',
    outputDirectory,
  ]
}

describe('gold import/compensation package operations v1', () => {
  let fixture: Fixture
  let generated: GeneratedPackage

  beforeAll(() => {
    fixture = buildFixture()
    generated = generateGoldImportCompensationPackage({
      auditPackage: fixture.auditPackage,
      identityPolicy: fixture.identityPolicy,
      sources: fixture.sources,
    })
  })

  test('derives the exact raw-state action mix and deterministic append-only package', () => {
    const planningRows = derivePackagePlanningRows(
      fixture.planningState,
      fixture.sources.finalArtifact,
    )
    expect({
      initial: planningRows.filter((row) => row.action === 'import_initial').length,
      inserts: planningRows.filter((row) => row.action !== 'import_noop').length,
      noops: planningRows.filter((row) => row.action === 'import_noop').length,
      revisions: planningRows.filter((row) => row.action === 'import_revision').length,
      total: planningRows.length,
    }).toEqual(EXACT_IMPORT_COUNTS)
    expect(generated.importPlan.counts).toEqual(EXACT_IMPORT_COUNTS)
    expect(
      generated.importPlan.actions.filter((action) => action.action !== 'import_noop'),
    ).toHaveLength(624)

    const verified = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    expect({
      noops: verified.compensationActions.filter((action) => action.action === 'compensate_noop')
        .length,
      restored: verified.compensationActions.filter(
        (action) => action.action === 'compensate_restore',
      ).length,
      total: verified.compensationActions.length,
      voided: verified.compensationActions.filter((action) => action.action === 'compensate_void')
        .length,
    }).toEqual(EXACT_COMPENSATION_COUNTS)
    for (const action of verified.compensationActions) {
      if (action.action === 'compensate_noop') continue
      expect(action.expectedHeadReviewIdAfter).toBe(action.compensationReviewId)
      expect(action.expectedHeadReviewIdAfter).not.toBe(action.expectedSupersedesReviewId)
      expect(action.expectedHeadReviewIdAfter).not.toBe(action.effectiveSourceReviewId)
    }
    expect(
      generated.files.get('post-migration-audit.json')?.equals(fixture.auditPackage.auditBytes),
    ).toBe(true)
    expect(
      generated.files
        .get('post-migration-audit-manifest.sha256')
        ?.equals(fixture.auditPackage.manifestBytes),
    ).toBe(true)
    const rowActions = jsonPackageFile<{
      rowBindings: Array<{
        compensationOperation: { derivationContextSha256: string; idempotencyKey: null }
        idempotencyScope: string
        importOperation: { idempotencyKey: string; operationId: string }
        perActionIdempotencyKey: null
      }>
    }>(generated, 'row-level-action-plan.json')
    expect(rowActions.rowBindings).toHaveLength(EXACT_IMPORT_COUNTS.total)
    expect(
      new Set(rowActions.rowBindings.map(({ importOperation }) => importOperation.idempotencyKey)),
    ).toEqual(new Set([generated.importPlan.binding.idempotencyKey]))
    expect(
      new Set(
        rowActions.rowBindings.map(
          ({ compensationOperation }) => compensationOperation.derivationContextSha256,
        ),
      ).size,
    ).toBe(1)
    expect(
      rowActions.rowBindings.every(
        ({ compensationOperation, idempotencyScope, importOperation, perActionIdempotencyKey }) =>
          idempotencyScope === 'operation_not_per_action' &&
          importOperation.operationId === generated.importPlan.operationId &&
          compensationOperation.idempotencyKey === null &&
          perActionIdempotencyKey === null,
      ),
    ).toBe(true)

    const stateProof = jsonPackageFile<{
      compensation: {
        expectedPhysicalState: { hash: null; rule: string }
        expectedPostPhysicalState: { hash: null; rule: string }
      }
      import: { expectedPostPhysicalState: { hash: null; rule: string } }
    }>(generated, 'state-hash-proof.json')
    expect(stateProof.import.expectedPostPhysicalState).toMatchObject({
      hash: null,
      rule: 'database_observed_at_execution',
    })
    expect(stateProof.compensation.expectedPhysicalState).toMatchObject({
      hash: null,
      rule: 'database_observed_at_execution',
    })
    expect(stateProof.compensation.expectedPostPhysicalState).toMatchObject({
      hash: null,
      rule: 'database_observed_at_execution',
    })

    const second = generateGoldImportCompensationPackage({
      auditPackage: fixture.auditPackage,
      identityPolicy: fixture.identityPolicy,
      sources: fixture.sources,
    })
    expect(second.manifestSha256).toBe(generated.manifestSha256)
    expect([...second.files.keys()]).toEqual([...generated.files.keys()])
    for (const [name, bytes] of generated.files) {
      expect(second.files.get(name)?.equals(bytes)).toBe(true)
    }
  })

  test('derives an additive revision when nullable legacy enrichment differs', () => {
    const legacyState = structuredClone(fixture.planningState)
    const legacyReview = legacyState.rows[624].currentEffectiveReview as Record<string, unknown>
    legacyReview.enrichmentProvenance = null
    legacyReview.enrichmentSchemaVersion = null

    const planningRows = derivePackagePlanningRows(legacyState, fixture.sources.finalArtifact)
    expect(planningRows[624]).toMatchObject({
      action: 'import_revision',
      expectedCurrentReviewId: legacyState.rows[624].currentReviewId,
      expectedSupersedesReviewId: legacyState.rows[624].currentReviewId,
    })
  })

  test('gates an actual audit-shaped not_yet_migrated report before reading sources', async () => {
    const root = await safeTemporaryDirectory('package-not-yet-migrated-')
    const audit = structuredClone(fixture.audit) as unknown as Record<string, unknown>
    audit.status = 'not_yet_migrated'
    audit.readinessStatus = 'not_yet_migrated'
    const migration = audit.migration as Record<string, unknown>
    migration.applied = false
    migration.ledgerOccurrences = 0
    const database = audit.database as Record<string, unknown>
    database.preMigrationBackupManifestSha256 = null
    database.developmentPlanningStateSha256 = null
    const checks = audit.checks as Record<string, unknown>
    checks.lint = null
    checks.security = null
    const auditPath = join(root, 'migration-audit.json')
    await writeFile(auditPath, `${JSON.stringify(audit)}\n`, 'utf8')

    await expect(runPackageGeneratorCli(['--audit', auditPath])).rejects.toThrow(
      'Package generation blocked: not_yet_migrated; source artifacts were not inspected.',
    )
  })

  test('gates a legacy ready audit before opening production source paths', async () => {
    const root = await safeTemporaryDirectory('package-legacy-ready-audit-')
    const auditPath = join(root, 'migration-audit.json')
    await writeFile(auditPath, canonicalPrettyBytes(fixture.audit))

    await expect(runPackageGeneratorCli(['--audit', auditPath])).rejects.toThrow(
      'production sources require the reconciled post-migration audit; source artifacts were not inspected',
    )
  })

  test('anchors directory creation before mkdir and rejects raw traversal before CLI reads', async () => {
    const parent = await safeTemporaryDirectory('exclusive-output-parent-race-')
    const outputRoot = join(parent, 'approved-root')
    const outputParent = join(outputRoot, 'nested')
    const outputDirectory = join(outputParent, 'output')
    const outside = join(parent, 'outside')
    const displacedParent = join(outside, 'displaced-parent')
    await mkdir(outputRoot, { mode: 0o700 })
    await mkdir(outputParent, { mode: 0o700 })
    await mkdir(outside, { mode: 0o700 })
    const workingDirectory = process.cwd()

    await expect(
      createExclusiveOutputDirectory({
        beforeAnchoredCreateForTest: async () => {
          await rename(outputParent, displacedParent)
          await symlink(outside, outputParent, 'dir')
        },
        outputDirectory,
        outputRoot,
      }),
    ).rejects.toThrow(/parent identity changed/iu)
    expect(process.cwd()).toBe(workingDirectory)
    await expect(readFile(join(outside, 'output'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(displacedParent, 'output'))).rejects.toMatchObject({
      code: 'ENOENT',
    })

    const rawTraversal = `${outputRoot}/nested/../escaped`
    await expect(
      createExclusiveOutputDirectory({ outputDirectory: rawTraversal, outputRoot }),
    ).rejects.toThrow(/normalized|traversal/iu)
    const executeFreshDisposableDatabase = jest.fn(async () => passingReport(generated, fixture))
    await expect(
      runExactPackageRehearsalCli(['--output-root', outputRoot, '--output', rawTraversal], {
        executeFreshDisposableDatabase,
        identityPolicy: fixture.identityPolicy,
        loadPreMigrationBackup: jest.fn(async () => fixture.loadedBackup),
      }),
    ).rejects.toThrow(/normalized|traversal/iu)
    expect(executeFreshDisposableDatabase).not.toHaveBeenCalled()
    await expect(
      runPackageGeneratorCli([
        '--audit',
        join(parent, 'must-not-be-read.json'),
        '--output-root',
        outputRoot,
        '--output',
        rawTraversal,
      ]),
    ).rejects.toThrow(/normalized|traversal/iu)
  })

  test('publishes package and report files with exact private modes and unique inode identities', async () => {
    const packageParent = await safeTemporaryDirectory('exclusive-package-modes-')
    const packageRoot = join(packageParent, 'approved-root')
    const packageDirectory = join(packageRoot, 'package')
    await mkdir(packageRoot, { mode: 0o700 })
    await writeGeneratedPackageExclusive({
      outputDirectory: packageDirectory,
      outputRoot: packageRoot,
      package: generated,
    })
    const packageDirectoryStat = await lstat(packageDirectory, { bigint: true })
    expect(packageDirectoryStat.mode & 0o777n).toBe(0o700n)
    const packageFileIdentities = new Set<string>()
    for (const name of generated.files.keys()) {
      const stat = await lstat(join(packageDirectory, name), { bigint: true })
      expect(stat.mode & 0o777n).toBe(0o600n)
      expect(stat.nlink).toBe(1n)
      packageFileIdentities.add(`${stat.dev}:${stat.ino}`)
    }
    expect(packageFileIdentities.size).toBe(generated.files.size)

    const reportParent = await safeTemporaryDirectory('exclusive-report-modes-')
    const reportRoot = join(reportParent, 'approved-root')
    const reportDirectory = join(reportRoot, 'report')
    await mkdir(reportRoot, { mode: 0o700 })
    await writeRehearsalReportExclusive({
      outputDirectory: reportDirectory,
      outputRoot: reportRoot,
      report: passingReport(generated, fixture),
    })
    expect((await lstat(reportDirectory, { bigint: true })).mode & 0o777n).toBe(0o700n)
    const reportFileIdentities = new Set<string>()
    for (const name of ['exact-package-rehearsal-report.json', 'canonical-manifest.sha256']) {
      const stat = await lstat(join(reportDirectory, name), { bigint: true })
      expect(stat.mode & 0o777n).toBe(0o600n)
      expect(stat.nlink).toBe(1n)
      reportFileIdentities.add(`${stat.dev}:${stat.ino}`)
    }
    expect(reportFileIdentities.size).toBe(2)
  })

  test('refuses same-inode output relocation through an outside symlink before writing bytes', async () => {
    const exerciseRace = async (
      prefix: string,
      expectedFilenames: readonly string[],
      publish: (input: {
        beforeAnchoredWriteForTest: (createdOutput: string) => Promise<void>
        outputDirectory: string
        outputRoot: string
      }) => Promise<void>,
    ) => {
      const parent = await safeTemporaryDirectory(prefix)
      const outputRoot = join(parent, 'approved-root')
      const outside = join(parent, 'outside')
      const outputDirectory = join(outputRoot, 'output')
      const displaced = join(outside, 'displaced-output')
      await mkdir(outputRoot, { mode: 0o700 })
      await mkdir(outside, { mode: 0o700 })
      const workingDirectory = process.cwd()
      await expect(
        publish({
          beforeAnchoredWriteForTest: async (createdOutput) => {
            await rename(createdOutput, displaced)
            await symlink(displaced, createdOutput, 'dir')
          },
          outputDirectory,
          outputRoot,
        }),
      ).rejects.toThrow(/identity changed/iu)
      expect(process.cwd()).toBe(workingDirectory)
      for (const name of expectedFilenames) {
        await expect(readFile(join(displaced, name))).rejects.toMatchObject({ code: 'ENOENT' })
      }
    }

    await exerciseRace(
      'exclusive-package-write-race-',
      [...generated.files.keys()],
      async (input) => writeGeneratedPackageExclusive({ ...input, package: generated }),
    )
    await exerciseRace(
      'exclusive-report-write-race-',
      ['exact-package-rehearsal-report.json', 'canonical-manifest.sha256'],
      async (input) =>
        writeRehearsalReportExclusive({
          ...input,
          report: passingReport(generated, fixture),
        }),
    )
  })

  test('accepts only the exact ready auditor schema and reviewed canonical audit manifest', () => {
    expect(fixture.auditPackage.audit.comparisons.priorMigrationLedgerRowsUnchanged).toBe(true)
    expect(fixture.auditPackage.manifestSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(() =>
      verifyReadyPostMigrationAuditPackage({
        auditBytes: fixture.auditPackage.auditBytes,
        developmentPlanningStateBytes: fixture.auditPackage.developmentPlanningStateBytes,
        manifestBytes: fixture.auditPackage.manifestBytes,
        markdownBytes: fixture.auditPackage.markdownBytes,
        schemaSecurityDefinitionIdentityBytes:
          fixture.auditPackage.schemaSecurityDefinitionIdentityBytes,
        trustedManifestSha256: sha256('unreviewed replacement manifest'),
      }),
    ).toThrow(/reviewed SHA-256/u)

    const contradictoryAudit = structuredClone(fixture.audit)
    contradictoryAudit.comparisons.priorMigrationLedgerRowsUnchanged = false
    expect(() => buildVerifiedAuditPackage(contradictoryAudit, fixture.planningState)).toThrow(
      /comparisons did not pass/u,
    )
  })

  test('normalizes volatile database observations into byte-identical canonical artifacts', () => {
    const contractScenarioBytes = Buffer.from('{"allScenariosPassed":true}\n', 'utf8')
    const scenarioArtifactsSha256 = sha256(contractScenarioBytes)
    const verified = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    const evidence = (suffix: string): ExactPackageRehearsalEvidence => ({
      compensationCounts: EXACT_COMPENSATION_COUNTS,
      deterministicArtifacts: false,
      effectiveState: {
        postCompensationSha256: verified.importPlan.expectedEffectiveStateSha256,
        postImportSha256: verified.importPlan.expectedPostEffectiveStateSha256,
        preImportSha256: verified.importPlan.expectedEffectiveStateSha256,
      },
      importCounts: EXACT_IMPORT_COUNTS,
      migration: verified.descriptor.migration,
      packageManifestSha256: verified.manifestSha256,
      physicalState: {
        postCompensationSha256: sha256(`post-compensation-${suffix}`),
        postImportSha256: sha256(`post-import-${suffix}`),
        preImportSha256: verified.importPlan.expectedPhysicalStateSha256,
      },
      scenarioArtifactsSha256,
      scenarios: {
        ambiguousLostAcknowledgementReconciledWithoutRetry: true,
        currentPointerAlwaysLatestPhysicalHead: true,
        exactReplayIdempotent: true,
        heldOutIdentityDisclosureCount: 0,
        heldOutScopeRejected: true,
        oldPointerRewindPackageRejected: true,
        ordinaryReviewAfterRestorePassed: true,
        ordinaryReviewAfterVoidPassed: true,
        secondCompensationRejectedOrVerifiedExisting: true,
        staleAuthorizationRejected: true,
        staleDatabaseStateRejected: true,
        wrongOperationIdRejected: true,
      },
      schemaVersion: 'gold-import-compensation-exact-package-evidence/v1',
      security: {
        appendOnlyTriggersEnabled: true,
        lintErrorCount: 0,
        onlyAllowlistedVolatilityWarnings: true,
        ordinaryRolesHaveNoImmutableMutationPrivilege: true,
        prohibitedPrivilegesAbsent: true,
        publicExecuteAbsent: true,
        requiredRlsEnabled: true,
        schemaSecurityDefinitionIdentitySha256: fixture.audit.database.schemaSecurityIdentitySha256,
        securityDefinerSearchPathsSafe: true,
        serviceRoleGuardedBoundaryOnly: true,
      },
      targetDatabaseFingerprintSha256: sha256(`database-fingerprint-${suffix}`),
    })
    type ArtifactInput = Parameters<typeof buildDeterministicExactPackageRehearsalArtifacts>[0]
    const stableInputs = {
      canonicalContractScenarioBytes: contractScenarioBytes,
      lint: { errors: [], passed: true } as ArtifactInput['lint'],
      rpcContract: { passed: true } as ArtifactInput['rpcContract'],
      securityIntrospection: { passed: true } as ArtifactInput['securityIntrospection'],
    }
    const first = buildDeterministicExactPackageRehearsalArtifacts({
      ...stableInputs,
      evidence: evidence('first'),
      report: passingReport(generated, fixture),
    })
    const second = buildDeterministicExactPackageRehearsalArtifacts({
      ...stableInputs,
      evidence: evidence('second'),
      report: passingReport(generated, fixture),
    })

    expect(first.manifestBytes.equals(second.manifestBytes)).toBe(true)
    expect([...first.canonicalArtifacts.keys()]).toEqual([...second.canonicalArtifacts.keys()])
    for (const [name, bytes] of first.canonicalArtifacts) {
      expect(second.canonicalArtifacts.get(name)?.equals(bytes)).toBe(true)
      expect(bytes.toString('utf8')).not.toContain('database-fingerprint-')
    }
  })

  test('keeps every owned serialized SQL aggregate explicitly and stably ordered', async () => {
    const sourceFiles = [
      'scripts/literature/generate-gold-import-compensation-package-v1.ts',
      'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
      'scripts/literature/rehearse-gold-import-compensation-db.ts',
    ]
    const aggregateStart =
      /\b(?:json_agg|jsonb_agg|array_agg|string_agg|json_object_agg|jsonb_object_agg)\s*\(/giu
    for (const sourceFile of sourceFiles) {
      const source = await readFile(join(process.cwd(), sourceFile), 'utf8')
      const starts = [...source.matchAll(aggregateStart)]
      for (const start of starts) {
        const open = (start.index ?? 0) + start[0].lastIndexOf('(')
        let depth = 0
        let close = -1
        for (let index = open; index < source.length; index += 1) {
          if (source[index] === '(') depth += 1
          if (source[index] === ')') depth -= 1
          if (depth === 0) {
            close = index
            break
          }
        }
        expect({ aggregate: start[0], close, sourceFile }).toEqual(
          expect.objectContaining({ close: expect.any(Number) }),
        )
        const aggregate = source.slice(open + 1, close)
        expect({ aggregate: start[0], sourceFile, sql: aggregate }).toEqual(
          expect.objectContaining({ sql: expect.stringMatching(/\border\s+by\b/iu) }),
        )
      }
    }

    const exactSource = await readFile(
      join(
        process.cwd(),
        'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
      ),
      'utf8',
    )
    expect(exactSource).toMatch(
      /select distinct on \(review\.item_id\)[\s\S]*?order by review\.item_id, review\.revision desc, review\.id/iu,
    )
    expect(exactSource).toMatch(/PRODUCTION_CHILD_TERM_GRACE_MS = 1_000/iu)
    expect(exactSource).toMatch(/PRODUCTION_CHILD_KILL_GRACE_MS = 1_000/iu)
    expect(exactSource).toMatch(
      /child\.kill\('SIGTERM'\)[\s\S]*?waitForProductionChildExit[\s\S]*?child\.kill\('SIGKILL'\)/iu,
    )
    expect(exactSource).toMatch(
      /Promise\.race\(\[[\s\S]*?runtime\.command[\s\S]*?signalNotification\.then/iu,
    )
    expect(SECURITY_INTROSPECTION_SQL).toMatch(/'catalog', pg_catalog\.jsonb_build_object/iu)
    expect(() => assertSerializedAggregateOrdering(EXACT_RPC_METADATA_SQL)).not.toThrow()
    const exactSnapshotSql = exactBatchSnapshotSql(fixtureUuid(0x10000000, 1))
    expect(() => assertSerializedAggregateOrdering(exactSnapshotSql)).not.toThrow()
    expect(exactSnapshotSql).toMatch(
      /order by item\.display_order nulls last, item\.id,[\s\S]*?review\.revision nulls last, review\.id/iu,
    )
    expect(exactSnapshotSql).toMatch(/order by operation\.started_at,\s*operation\.id/iu)
    expect(SECURITY_INTROSPECTION_SQL).toMatch(
      /constraints as \([\s\S]*?from pg_catalog\.pg_constraint as con[\s\S]*?con\.contype <> 't'/iu,
    )
    for (const field of [
      'tables',
      'columns',
      'functions',
      'constraints',
      'indexes',
      'triggers',
      'policies',
      'rls',
      'tablePrivileges',
      'schemaCreatePrivileges',
      'columnPrivileges',
      'tableAclEntries',
      'columnAclEntries',
      'functionAclEntries',
      'schemaAclEntries',
      'supportedEventTypes',
    ]) {
      expect(SECURITY_INTROSPECTION_SQL).toContain(`'${field}'`)
    }
    expect(SCHEMA_DEFINITION_MUTATION_PROBES.map(({ name }) => name)).toEqual([
      'weakened_same_name_trigger_predicate',
      'changed_same_name_foreign_key_action',
      'broadened_same_name_journal_policy',
      'wrong_same_name_unique_index_definition',
      'forced_rls_state_changed',
      'column_grant_broadened',
    ])
    for (const probe of SCHEMA_DEFINITION_MUTATION_PROBES.slice(0, 4)) {
      expect(probe.sql).toMatch(/(?:drop|alter)[\s\S]*(?:create|add constraint)/iu)
    }
    expect(SCHEMA_DEFINITION_MUTATION_PROBES[4].sql).toMatch(
      /alter table[\s\S]*force row level security/iu,
    )
    expect(SCHEMA_DEFINITION_MUTATION_PROBES[5].sql).toMatch(
      /grant update \(operation_action_id\)[\s\S]*to anon/iu,
    )
  })

  test('requires one exact owner/signature/result/volatility contract for every transition RPC', () => {
    const shared = {
      owner: 'supabase_admin',
      resultType: 'jsonb',
      searchPath: 'pg_catalog, public, extensions',
      securityDefiner: true,
    }
    const observed = {
      functions: [
        {
          ...shared,
          identityArguments:
            'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
          name: 'apply_literature_gold_import_v1',
          volatility: 'v',
        },
        {
          ...shared,
          identityArguments:
            'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
          name: 'compensate_literature_gold_import_v1',
          volatility: 'v',
        },
        {
          ...shared,
          identityArguments:
            'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
          name: 'reconcile_literature_gold_review_operation_v1',
          volatility: 's',
        },
      ],
    }
    expect(validateExactRpcContractMetadata(observed)).toMatchObject({
      overloadCount: 3,
      passed: true,
    })
    const duplicate = structuredClone(observed)
    duplicate.functions.push(structuredClone(duplicate.functions[0]))
    expect(() => validateExactRpcContractMetadata(duplicate)).toThrow(/overload set/u)
    const wrongVolatility = structuredClone(observed)
    wrongVolatility.functions[2].volatility = 'v'
    expect(() => validateExactRpcContractMetadata(wrongVolatility)).toThrow(
      /execution contract mismatch/u,
    )
  })

  test('rejects stale source bytes, backup binding, and package bytes', () => {
    const verified = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    expect(() =>
      assertExactPackageSourceBytes(verified, {
        ...fixture.sources,
        finalArtifact: Buffer.concat([fixture.sources.finalArtifact, Buffer.from('stale', 'utf8')]),
      }),
    ).toThrow(/stale|missing|replaced/u)

    expect(() =>
      verifyDevelopmentDatabaseBackupFixtureForTest(
        fixture.backup.files,
        sha256('wrong backup manifest'),
      ),
    ).toThrow(/stale/u)

    const stalePackage = new Map(generated.files)
    stalePackage.set(
      'immutable-atomic-import-plan.json',
      Buffer.concat([
        stalePackage.get('immutable-atomic-import-plan.json') as Buffer,
        Buffer.from(' ', 'utf8'),
      ]),
    )
    expect(() => verifyExactGeneratedPackage(stalePackage, fixture.identityPolicy)).toThrow(
      /checksum mismatch/u,
    )

    const semanticallyTamperedPackage = new Map(generated.files)
    const rowActions = JSON.parse(
      (semanticallyTamperedPackage.get('row-level-action-plan.json') as Buffer).toString('utf8'),
    ) as Record<string, unknown>
    rowActions.importActions = []
    semanticallyTamperedPackage.set(
      'row-level-action-plan.json',
      Buffer.from(`${JSON.stringify(rowActions)}\n`, 'utf8'),
    )
    rebindPackageManifest(semanticallyTamperedPackage)
    expect(() =>
      verifyExactGeneratedPackage(semanticallyTamperedPackage, fixture.identityPolicy),
    ).toThrow(/semantic binding mismatch/u)

    const readinessIdentityTamper = new Map(generated.files)
    const readiness = JSON.parse(
      (readinessIdentityTamper.get('compensation-readiness.json') as Buffer).toString('utf8'),
    ) as Record<string, unknown>
    readiness.schemaSecurityIdentitySha256 = sha256('substituted readiness schema identity')
    readinessIdentityTamper.set('compensation-readiness.json', canonicalPrettyBytes(readiness))
    rebindPackageManifest(readinessIdentityTamper)
    expect(() =>
      verifyExactGeneratedPackage(readinessIdentityTamper, fixture.identityPolicy),
    ).toThrow(/semantic binding mismatch.*compensation-readiness/iu)

    const replacedAuditEvidence = new Map(generated.files)
    replacedAuditEvidence.set(
      'post-migration-audit.md',
      Buffer.from('# Replaced audit narrative\n', 'utf8'),
    )
    rebindPackageManifest(replacedAuditEvidence)
    expect(() =>
      verifyExactGeneratedPackage(replacedAuditEvidence, fixture.identityPolicy),
    ).toThrow(/audit checksum mismatch/u)

    const remanifestedSchemaIdentityTamper =
      remanifestWithAlternateSchemaSecurityIdentity(generated)
    expect(() =>
      verifyExactGeneratedPackage(remanifestedSchemaIdentityTamper, fixture.identityPolicy),
    ).toThrow(/schema\/security definition identity|ready audit binding/iu)

    const reconstructedCompensationTamper = new Map(generated.files)
    const compensationTemplate = JSON.parse(
      (
        reconstructedCompensationTamper.get('append-only-compensation-plan-template.json') as Buffer
      ).toString('utf8'),
    ) as Record<string, unknown>
    const compensationActions = compensationTemplate.actions as Array<Record<string, unknown>>
    compensationActions[0].actionId = fixtureUuid(0x70000000, 1)
    const compensationContent = { ...compensationTemplate }
    delete compensationContent.binding
    compensationTemplate.binding = { contentSha256: sha256(canonicalJson(compensationContent)) }
    reconstructedCompensationTamper.set(
      'append-only-compensation-plan-template.json',
      canonicalPrettyBytes(compensationTemplate),
    )
    const descriptor = JSON.parse(
      (reconstructedCompensationTamper.get('package-descriptor.json') as Buffer).toString('utf8'),
    ) as Record<string, unknown>
    ;(descriptor.compensation as Record<string, unknown>).planTemplateSha256 = (
      compensationTemplate.binding as Record<string, unknown>
    ).contentSha256
    reconstructedCompensationTamper.set('package-descriptor.json', canonicalPrettyBytes(descriptor))
    rebindPackageManifest(reconstructedCompensationTamper)
    expect(() =>
      verifyExactGeneratedPackage(reconstructedCompensationTamper, fixture.identityPolicy),
    ).toThrow(/Compensation template is stale/u)
  })

  test('renders checksum-bound development seed data as deterministic internal inserts only', () => {
    const verified = verifyDevelopmentDatabaseBackupFixtureForTest(
      fixture.backup.files,
      fixture.backup.manifestSha256,
    )
    const sql = verified.seedSql
    expect(sql).toBe(renderDevelopmentDatabaseSeedSql(fixture.backup.seed))
    expect(sql.match(/insert into public\./gu)).toHaveLength(6)
    expect(sql).toContain('pg_catalog.jsonb_populate_recordset')
    expect(sql).toContain('"dataset_split":"development"')
    expect(sql).not.toContain('"dataset_split":"test"')
    expect(sql).not.toMatch(/\b(?:alter|copy|delete|drop|truncate|update)\b/iu)

    const unsafeSeed = structuredClone(fixture.backup.seed)
    unsafeSeed.tables.literature_gold_set_batches[0].held_out_item_ids = ['forbidden']
    const unsafeBackup = buildBackup(unsafeSeed)
    expect(() =>
      verifyDevelopmentDatabaseBackupFixtureForTest(
        unsafeBackup.files,
        unsafeBackup.manifestSha256,
      ),
    ).toThrow(/non-allowlisted/u)
  })

  test('cross-binds the trusted full backup provenance to the exact package', () => {
    const package_ = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    const verified = verifyLoadedPreMigrationBackupForPackage({
      loaded: fixture.loadedBackup,
      package: package_,
      trustedManifestSha256: fixture.backup.manifestSha256,
    })
    expect(verified.provenance).toMatchObject({
      batchId: generated.importPlan.batchId,
      developmentMembershipSha256: generated.importPlan.scope.developmentMembershipSha256,
      repositoryCommitSha: generated.importPlan.executionContext.repositoryCommitSha,
    })

    const stale = structuredClone(fixture.loadedBackup)
    ;(stale.receipt.databaseIdentity as Record<string, unknown>).developmentMembershipSha256 =
      sha256('different development membership')
    expect(() =>
      verifyLoadedPreMigrationBackupForPackage({
        loaded: stale,
        package: package_,
        trustedManifestSha256: fixture.backup.manifestSha256,
      }),
    ).toThrow(/membership|stale/u)
  })

  test('command-level rehearsal invokes the injected executor exactly once for valid inputs', async () => {
    const root = await safeTemporaryDirectory('exact-package-cli-valid-')
    const paths = await writeCliFixture(root, generated, fixture)
    const outputDirectory = join(root, 'evidence')
    const executeFreshDisposableDatabase = jest.fn(
      async (input: ExecuteFreshDisposableInput): Promise<ExactPackageRehearsalReport> => {
        expect(input.preMigrationBackup.manifestSha256).toBe(fixture.backup.manifestSha256)
        expect(input.preMigrationBackup.seedSql).toContain(
          'insert into public.literature_gold_set_items',
        )
        return passingReport(generated, fixture)
      },
    )
    const loadPreMigrationBackup = jest.fn(async () => fixture.loadedBackup)
    const dependencies: ExactPackageRehearsalCliDependencies = {
      executeFreshDisposableDatabase,
      identityPolicy: fixture.identityPolicy,
      loadPreMigrationBackup,
    }

    await expect(
      runExactPackageRehearsalCli(cliArguments(paths, root, outputDirectory), dependencies),
    ).resolves.toEqual({
      outputDirectory,
      packageManifestSha256: generated.manifestSha256,
    })
    expect(executeFreshDisposableDatabase).toHaveBeenCalledTimes(1)
    expect(loadPreMigrationBackup).toHaveBeenCalledWith(
      paths.backupDirectory,
      fixture.backup.manifestSha256,
    )
  })

  test('NODE_ENV=test cannot make the operational CLI self-pin a remanifested schema identity', async () => {
    const root = await safeTemporaryDirectory('exact-package-cli-schema-self-pin-')
    const files = remanifestWithAlternateSchemaSecurityIdentity(generated)
    const paths = await writeCliFixture(root, { ...generated, files }, fixture)
    const executeFreshDisposableDatabase = jest.fn(async () => passingReport(generated, fixture))
    const loadPreMigrationBackup = jest.fn(async () => fixture.loadedBackup)
    const mutableEnvironment = process.env as Record<string, string | undefined>
    const previousNodeEnvironment = mutableEnvironment.NODE_ENV
    mutableEnvironment.NODE_ENV = 'test'
    try {
      await expect(
        runExactPackageRehearsalCli(cliArguments(paths, root, join(root, 'evidence')), {
          executeFreshDisposableDatabase,
          identityPolicy: fixture.identityPolicy,
          loadPreMigrationBackup,
        }),
      ).rejects.toThrow(/schema\/security definition identity.*not bound/iu)
    } finally {
      if (previousNodeEnvironment === undefined) delete mutableEnvironment.NODE_ENV
      else mutableEnvironment.NODE_ENV = previousNodeEnvironment
    }
    expect(loadPreMigrationBackup).not.toHaveBeenCalled()
    expect(executeFreshDisposableDatabase).not.toHaveBeenCalled()
  })

  test('command-level rehearsal never executes for a caller-supplied database URL', async () => {
    const executeFreshDisposableDatabase = jest.fn(async () => passingReport(generated, fixture))
    await expect(
      runExactPackageRehearsalCli(['--database-url', 'postgres://remote.example/db'], {
        executeFreshDisposableDatabase,
        identityPolicy: fixture.identityPolicy,
        loadPreMigrationBackup: jest.fn(async () => fixture.loadedBackup),
      }),
    ).rejects.toThrow(/Unknown option.*--database-url/u)
    expect(executeFreshDisposableDatabase).not.toHaveBeenCalled()
  })

  test('command-level rehearsal refuses an unreviewed backup manifest before loading or execution', async () => {
    const root = await safeTemporaryDirectory('exact-package-cli-unreviewed-backup-')
    const paths = await writeCliFixture(root, generated, fixture)
    const arguments_ = cliArguments(paths, root, join(root, 'evidence'))
    arguments_[arguments_.indexOf('--pre-migration-backup-manifest-sha256') + 1] = sha256(
      'unreviewed backup replacement',
    )
    const executeFreshDisposableDatabase = jest.fn(async () => passingReport(generated, fixture))
    const loadPreMigrationBackup = jest.fn(async () => fixture.loadedBackup)
    await expect(
      runExactPackageRehearsalCli(arguments_, {
        executeFreshDisposableDatabase,
        identityPolicy: fixture.identityPolicy,
        loadPreMigrationBackup,
      }),
    ).rejects.toThrow(/Reviewed pre-migration backup manifest SHA is stale/u)
    expect(loadPreMigrationBackup).not.toHaveBeenCalled()
    expect(executeFreshDisposableDatabase).not.toHaveBeenCalled()
  })

  test('disposable target attestation rejects the actual protected local database port', () => {
    const verified = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    expect(() =>
      assertDisposableRehearsalTarget(
        {
          containerId: 'a'.repeat(64),
          databaseCreatedForThisRun: true,
          databaseFingerprintSha256: sha256('fresh disposable database'),
          databaseHostPort: '55322',
          databaseName: 'gold_compensation_rehearsal_test',
          databaseUrl:
            'postgresql://supabase_admin:redacted@127.0.0.1:55322/gold_compensation_rehearsal_test',
          dockerEndpoint: 'unix:///var/run/docker.sock',
          existingIdempotencyKeys: [],
          existingOperationIds: [],
          migration: {
            id: MIGRATION_ID,
            ledgerOccurrences: 1,
            sha256: fixture.identityPolicy.migrationSha256,
          },
          outputDirectoryWasAbsent: true,
          packageManifestSha256: generated.manifestSha256,
          protectedRealLocalDatabasePort: '55322',
          schemaVersion: 'gold-import-compensation-disposable-attestation/v1',
          seedEffectiveStateSha256: verified.importPlan.expectedEffectiveStateSha256,
          seedPhysicalStateSha256: verified.importPlan.expectedPhysicalStateSha256,
          targetKind: 'fresh_disposable_database',
        },
        verified,
      ),
    ).toThrow(/Real local Supabase database refused/u)
  })

  test('runtime refuses remote Docker targets before run/exec and cleans up a failed local run', async () => {
    const package_ = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    const preMigrationBackup = verifyLoadedPreMigrationBackupForPackage({
      loaded: fixture.loadedBackup,
      package: package_,
      trustedManifestSha256: fixture.backup.manifestSha256,
    })
    const input = async (prefix: string): Promise<ExecuteFreshDisposableInput> => {
      const output = await createTestOutput(prefix)
      return {
        files: generated.files,
        identityPolicy: fixture.identityPolicy,
        outputDirectory: output.outputDirectory,
        outputIdentity: output.outputIdentity,
        preMigrationBackup,
        sources: fixture.sources,
      }
    }

    const hostOverrideCalls: string[][] = []
    const remoteHostRuntime: DisposableRuntime = {
      command: async (_command, arguments_) => {
        hostOverrideCalls.push(arguments_)
        throw new Error('command must not run')
      },
      environment: { DOCKER_HOST: 'tcp://remote.example:2376' },
      now: () => FIXED_TIME,
    }
    await expect(
      executeFreshDisposableRuntime(await input('exact-remote-host-'), remoteHostRuntime),
    ).rejects.toThrow(/local Docker socket/u)
    expect(hostOverrideCalls).toEqual([])

    const remoteContextCalls: Array<{ arguments: string[]; options?: unknown }> = []
    const remoteContextRuntime: DisposableRuntime = {
      command: async (_command, arguments_, options) => {
        remoteContextCalls.push({ arguments: arguments_, options })
        if (arguments_[0] === 'context' && arguments_[1] === 'show') {
          return { stderr: '', stdout: 'remote-context\n' }
        }
        if (arguments_[0] === 'context' && arguments_[1] === 'inspect') {
          return { stderr: '', stdout: '"tcp://remote.example:2376"\n' }
        }
        throw new Error('remote context must be refused before container operations')
      },
      environment: {},
      now: () => FIXED_TIME,
    }
    await expect(
      executeFreshDisposableRuntime(await input('exact-remote-context-'), remoteContextRuntime),
    ).rejects.toThrow(/local Docker socket/u)
    expect(
      remoteContextCalls.some(({ arguments: [operation] }) =>
        ['run', 'exec', 'rm'].includes(operation ?? ''),
      ),
    ).toBe(false)

    const localCalls: Array<{ arguments: string[]; options?: { env?: Record<string, string> } }> =
      []
    const localOutput = await createTestOutput('exact-lost-run-response-')
    const localOutputDirectory = localOutput.outputDirectory
    const localRuntime: DisposableRuntime = {
      command: async (_command, arguments_, options) => {
        localCalls.push({ arguments: arguments_, options })
        if (arguments_[0] === 'context' && arguments_[1] === 'show') {
          return { stderr: '', stdout: 'default\n' }
        }
        if (arguments_[0] === 'context' && arguments_[1] === 'inspect') {
          return { stderr: '', stdout: '"unix:///var/run/docker.sock"\n' }
        }
        if (arguments_[0] === 'run') throw new Error('lost docker run response')
        if (arguments_[0] === 'rm') return { stderr: '', stdout: '' }
        if (arguments_[0] === 'container') return { stderr: '', stdout: '' }
        throw new Error(`unexpected Docker operation ${arguments_[0] ?? '(none)'}`)
      },
      environment: {},
      now: () => FIXED_TIME,
    }
    await expect(
      executeFreshDisposableRuntime(
        {
          ...(await input('exact-unused-lost-run-')),
          outputDirectory: localOutputDirectory,
          outputIdentity: localOutput.outputIdentity,
        },
        localRuntime,
      ),
    ).rejects.toThrow(/lost docker run response/u)
    const runCall = localCalls.find(({ arguments: [operation] }) => operation === 'run')
    const cleanupCalls = localCalls.filter(({ arguments: [operation] }) => operation === 'rm')
    const cleanupCall = cleanupCalls[0]
    const absenceCalls = localCalls.filter(
      ({ arguments: [operation] }) => operation === 'container',
    )
    expect(runCall?.arguments).toContain(DISPOSABLE_POSTGRES_IMAGE)
    expect(runCall?.arguments).toContain('--label')
    expect(cleanupCall?.arguments.slice(0, 2)).toEqual(['rm', '--force'])
    expect(cleanupCall?.arguments.at(-1)).toBe(
      runCall?.arguments[runCall.arguments.indexOf('--name') + 1],
    )
    expect(cleanupCall?.options?.env).toEqual({ DOCKER_HOST: 'unix:///var/run/docker.sock' })
    expect(cleanupCalls).toHaveLength(1)
    expect(absenceCalls).toHaveLength(1)
    expect(localCalls.some(({ arguments: [operation] }) => operation === 'exec')).toBe(false)
    const receipt = JSON.parse(
      await readFile(join(localOutputDirectory, 'execution-receipt.json'), 'utf8'),
    ) as Record<string, unknown>
    expect(receipt).toMatchObject({
      canonicalArtifacts: {
        approved: false,
        invalidatedByCleanupFailure: false,
        published: false,
      },
      cleanup: {
        absenceChecks: [
          {
            identifier: expect.stringMatching(/^ip-gold-exact-/u),
            kind: 'exact_name',
            present: false,
          },
        ],
        absenceVerification: 'verified_absent',
        attempted: true,
        outcome: 'removed_and_verified_absent',
        removalCommandSucceeded: true,
      },
      executionApproval: 'not_approved',
      passed: false,
      primaryError: 'lost docker run response',
      result: 'failed',
    })
    await expect(
      readFile(join(localOutputDirectory, 'canonical-manifest.sha256')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('cleanup requires a successful rm and an independent absent-container result', async () => {
    const containerName = 'ip-gold-exact-cleanup-test'
    const successfulCalls: string[][] = []
    const successful = await cleanupDisposableContainer({
      armed: true,
      containerId: 'a'.repeat(64),
      containerName,
      dockerCommand: async (arguments_) => {
        successfulCalls.push(arguments_)
        return { stderr: '', stdout: '' }
      },
    })
    expect(successful).toMatchObject({
      absenceVerification: 'verified_absent',
      attempted: true,
      outcome: 'removed_and_verified_absent',
      removalCommandSucceeded: true,
    })
    expect(() => assertDisposableContainerCleanupSucceeded(successful)).not.toThrow()
    expect(successfulCalls.filter(([operation]) => operation === 'rm')).toHaveLength(1)
    expect(successfulCalls.filter(([operation]) => operation === 'container')).toHaveLength(2)
    expect(successful.absenceChecks).toEqual([
      { identifier: containerName, kind: 'exact_name', present: false },
      { identifier: 'a'.repeat(64), kind: 'container_id', present: false },
    ])

    const removalFailed = await cleanupDisposableContainer({
      armed: true,
      containerId: 'b'.repeat(64),
      containerName,
      dockerCommand: async (arguments_) => {
        if (arguments_[0] === 'rm') throw new Error('docker rm nonzero')
        return { stderr: '', stdout: '' }
      },
    })
    expect(removalFailed).toMatchObject({
      absenceVerification: 'verified_absent',
      outcome: 'failed',
      removalCommandSucceeded: false,
    })
    expect(() => assertDisposableContainerCleanupSucceeded(removalFailed)).toThrow(
      /remove: docker rm nonzero/u,
    )

    const stillPresent = await cleanupDisposableContainer({
      armed: true,
      containerId: 'c'.repeat(64),
      containerName,
      dockerCommand: async (arguments_) => ({
        stderr: '',
        stdout: arguments_[0] === 'container' ? `${'c'.repeat(64)}\n` : '',
      }),
    })
    expect(stillPresent).toMatchObject({
      absenceVerification: 'container_still_present',
      outcome: 'failed',
      removalCommandSucceeded: true,
    })
    expect(() => assertDisposableContainerCleanupSucceeded(stillPresent)).toThrow(
      /(?:exact_name|container_id).*remains present/u,
    )

    const absenceCheckFailed = await cleanupDisposableContainer({
      armed: true,
      containerId: 'e'.repeat(64),
      containerName,
      dockerCommand: async (arguments_) => {
        if (arguments_[0] === 'container') throw new Error('post-rm existence check failed')
        return { stderr: '', stdout: '' }
      },
    })
    expect(absenceCheckFailed).toMatchObject({
      absenceVerification: 'failed',
      outcome: 'failed',
      removalCommandSucceeded: true,
    })
    expect(() => assertDisposableContainerCleanupSucceeded(absenceCheckFailed)).toThrow(
      /verify_absent: exact_name .*post-rm existence check failed/u,
    )
  })

  test('preserves a primary verifier error together with cleanup failure and refuses approval', async () => {
    const package_ = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    const preMigrationBackup = verifyLoadedPreMigrationBackupForPackage({
      loaded: fixture.loadedBackup,
      package: package_,
      trustedManifestSha256: fixture.backup.manifestSha256,
    })
    const { outputDirectory, outputIdentity } = await createTestOutput(
      'exact-primary-cleanup-failure-',
    )
    const calls: string[][] = []
    const containerId = 'd'.repeat(64)
    let containerName = ''
    let runLabel = ''
    const runtime: DisposableRuntime = {
      command: async (_command, arguments_) => {
        calls.push(arguments_)
        if (arguments_[0] === 'context' && arguments_[1] === 'show') {
          return { stderr: '', stdout: 'default\n' }
        }
        if (arguments_[0] === 'context' && arguments_[1] === 'inspect') {
          return { stderr: '', stdout: '"unix:///var/run/docker.sock"\n' }
        }
        if (arguments_[0] === 'run') {
          containerName = arguments_[arguments_.indexOf('--name') + 1] ?? ''
          runLabel = arguments_[arguments_.indexOf('--label') + 1] ?? ''
          return { stderr: '', stdout: `${containerId}\n` }
        }
        if (arguments_[0] === 'inspect') {
          const separator = runLabel.indexOf('=')
          return {
            stderr: '',
            stdout: `${JSON.stringify({
              Config: { Labels: { [runLabel.slice(0, separator)]: runLabel.slice(separator + 1) } },
              Id: containerId,
              Name: `/${containerName}`,
              NetworkSettings: {
                Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55444' }] },
              },
            })}\n`,
          }
        }
        if (arguments_[0] === 'rm') throw new Error('cleanup rm failed')
        if (arguments_[0] === 'container') return { stderr: '', stdout: `${containerId}\n` }
        throw new Error(`unexpected operation ${arguments_[0] ?? '(none)'}`)
      },
      environment: {},
      now: () => FIXED_TIME,
      onContainerOwnedForTest: async () => {
        throw new Error('primary verifier failure')
      },
    }
    const execution = executeFreshDisposableRuntime(
      {
        files: generated.files,
        identityPolicy: fixture.identityPolicy,
        outputDirectory,
        outputIdentity,
        preMigrationBackup,
        sources: fixture.sources,
      },
      runtime,
    )
    await expect(execution).rejects.toThrow(/primary verifier failure.*cleanup.*failed/iu)
    expect(calls.filter(([operation]) => operation === 'rm')).toHaveLength(1)
    expect(calls.filter(([operation]) => operation === 'container')).toHaveLength(2)
    const receipt = JSON.parse(
      await readFile(join(outputDirectory, 'execution-receipt.json'), 'utf8'),
    ) as Record<string, unknown>
    expect(receipt).toMatchObject({
      canonicalArtifacts: {
        approved: false,
        invalidatedByCleanupFailure: true,
        published: false,
      },
      cleanup: {
        absenceChecks: [
          { identifier: containerName, kind: 'exact_name', present: true },
          { identifier: containerId, kind: 'container_id', present: true },
        ],
        absenceVerification: 'container_still_present',
        attempted: true,
        outcome: 'failed',
        removalCommandSucceeded: false,
      },
      cleanupError: expect.stringContaining('cleanup rm failed'),
      executionApproval: 'not_approved',
      passed: false,
      primaryError: 'primary verifier failure',
      result: 'failed',
    })
    await expect(
      readFile(join(outputDirectory, 'canonical-manifest.sha256')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('cleanup-only failure invalidates a would-be successful full-runtime result', async () => {
    const package_ = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    const preMigrationBackup = verifyLoadedPreMigrationBackupForPackage({
      loaded: fixture.loadedBackup,
      package: package_,
      trustedManifestSha256: fixture.backup.manifestSha256,
    })
    const { outputDirectory, outputIdentity } = await createTestOutput(
      'exact-cleanup-only-failure-',
    )
    const calls: string[][] = []
    const containerId = 'f'.repeat(64)
    let containerName = ''
    let runLabel = ''
    const runtime = injectCompletedDisposableExecutionForTest(
      {
        command: async (_command, arguments_) => {
          calls.push(arguments_)
          if (arguments_[0] === 'context' && arguments_[1] === 'show') {
            return { stderr: '', stdout: 'default\n' }
          }
          if (arguments_[0] === 'context' && arguments_[1] === 'inspect') {
            return { stderr: '', stdout: '"unix:///var/run/docker.sock"\n' }
          }
          if (arguments_[0] === 'run') {
            containerName = arguments_[arguments_.indexOf('--name') + 1] ?? ''
            runLabel = arguments_[arguments_.indexOf('--label') + 1] ?? ''
            return { stderr: '', stdout: `${containerId}\n` }
          }
          if (arguments_[0] === 'inspect') {
            const separator = runLabel.indexOf('=')
            return {
              stderr: '',
              stdout: `${JSON.stringify({
                Config: {
                  Labels: { [runLabel.slice(0, separator)]: runLabel.slice(separator + 1) },
                },
                Id: containerId,
                Name: `/${containerName}`,
                NetworkSettings: {
                  Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55446' }] },
                },
              })}\n`,
            }
          }
          if (arguments_[0] === 'rm') throw new Error('cleanup-only rm failure')
          if (arguments_[0] === 'container') return { stderr: '', stdout: '' }
          throw new Error(`unexpected operation ${arguments_[0] ?? '(none)'}`)
        },
        environment: {},
        now: () => FIXED_TIME,
      },
      {
        canonicalArtifacts: new Map([
          ['would-be-success.json', Buffer.from('{"passed":true}\n', 'utf8')],
        ]),
        manifestBytes: Buffer.from(`${sha256('would-be-success')}  would-be-success.json\n`),
        rawReceipt: {},
        report: passingReport(generated, fixture),
      },
    )

    await expect(
      executeFreshDisposableRuntime(
        {
          files: generated.files,
          identityPolicy: fixture.identityPolicy,
          outputDirectory,
          outputIdentity,
          preMigrationBackup,
          sources: fixture.sources,
        },
        runtime,
      ),
    ).rejects.toThrow(/cleanup-only rm failure/u)

    expect(calls.filter(([operation]) => operation === 'exec')).toHaveLength(0)
    expect(calls.filter(([operation]) => operation === 'rm')).toHaveLength(1)
    expect(calls.filter(([operation]) => operation === 'container')).toHaveLength(2)
    const receipt = JSON.parse(
      await readFile(join(outputDirectory, 'execution-receipt.json'), 'utf8'),
    ) as Record<string, unknown>
    expect(receipt).toMatchObject({
      canonicalArtifacts: {
        approved: false,
        invalidatedByCleanupFailure: true,
        published: false,
      },
      cleanup: {
        absenceVerification: 'verified_absent',
        attempted: true,
        errors: [{ message: 'cleanup-only rm failure', stage: 'remove' }],
        outcome: 'failed',
        removalCommandSucceeded: false,
      },
      cleanupError: expect.stringContaining('cleanup-only rm failure'),
      executionApproval: 'not_approved',
      passed: false,
      primaryError: null,
      result: 'failed',
    })
    await expect(
      readFile(join(outputDirectory, 'canonical-manifest.sha256')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(outputDirectory, 'would-be-success.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  test('a signal during a never-settling cleanup command cancels it and reuses cleanup exactly once', async () => {
    const package_ = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    const preMigrationBackup = verifyLoadedPreMigrationBackupForPackage({
      loaded: fixture.loadedBackup,
      package: package_,
      trustedManifestSha256: fixture.backup.manifestSha256,
    })
    const { outputDirectory, outputIdentity } = await createTestOutput(
      'exact-signal-during-cleanup-',
    )
    const calls: string[][] = []
    const containerId = '9'.repeat(64)
    let containerName = ''
    let runLabel = ''
    let rejectCleanupCommand: (error: Error) => void = () => {
      throw new Error('cleanup command rejection was not installed')
    }
    let signalHandler: (signal: 'SIGINT' | 'SIGTERM') => void = () => {
      throw new Error('signal handler was not installed')
    }
    const cancelActiveCommand = jest.fn(async () => {
      rejectCleanupCommand(new Error('never-settling cleanup command cancelled'))
    })
    const unregisterSignalHandler = jest.fn()
    const runtime = injectCompletedDisposableExecutionForTest(
      {
        cancelActiveCommand,
        command: async (_command, arguments_) => {
          calls.push(arguments_)
          if (arguments_[0] === 'context' && arguments_[1] === 'show') {
            return { stderr: '', stdout: 'default\n' }
          }
          if (arguments_[0] === 'context' && arguments_[1] === 'inspect') {
            return { stderr: '', stdout: '"unix:///var/run/docker.sock"\n' }
          }
          if (arguments_[0] === 'run') {
            containerName = arguments_[arguments_.indexOf('--name') + 1] ?? ''
            runLabel = arguments_[arguments_.indexOf('--label') + 1] ?? ''
            return { stderr: '', stdout: `${containerId}\n` }
          }
          if (arguments_[0] === 'inspect') {
            const separator = runLabel.indexOf('=')
            return {
              stderr: '',
              stdout: `${JSON.stringify({
                Config: {
                  Labels: { [runLabel.slice(0, separator)]: runLabel.slice(separator + 1) },
                },
                Id: containerId,
                Name: `/${containerName}`,
                NetworkSettings: {
                  Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55447' }] },
                },
              })}\n`,
            }
          }
          if (arguments_[0] === 'rm') {
            return new Promise<CommandResult>((_resolve, reject) => {
              rejectCleanupCommand = reject
              queueMicrotask(() => {
                signalHandler('SIGINT')
                signalHandler('SIGINT')
              })
            })
          }
          if (arguments_[0] === 'container') return { stderr: '', stdout: '' }
          throw new Error(`unexpected operation ${arguments_[0] ?? '(none)'}`)
        },
        environment: {},
        now: () => FIXED_TIME,
        registerSignalHandler: (handler) => {
          signalHandler = handler
          return unregisterSignalHandler
        },
      },
      {
        canonicalArtifacts: new Map([
          ['would-be-signal-success.json', Buffer.from('{"passed":true}\n', 'utf8')],
        ]),
        manifestBytes: Buffer.from(
          `${sha256('would-be-signal-success')}  would-be-signal-success.json\n`,
        ),
        rawReceipt: {},
        report: passingReport(generated, fixture),
      },
    )

    const execution = executeFreshDisposableRuntime(
      {
        files: generated.files,
        identityPolicy: fixture.identityPolicy,
        outputDirectory,
        outputIdentity,
        preMigrationBackup,
        sources: fixture.sources,
      },
      runtime,
    )
    const boundedExecution = Promise.race([
      execution,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('signal failed to escape cleanup command')), 1_000),
      ),
    ])
    await expect(boundedExecution).rejects.toThrow(/interrupted by SIGINT.*cleanup/iu)

    expect(cancelActiveCommand).toHaveBeenCalledTimes(1)
    expect(cancelActiveCommand).toHaveBeenCalledWith('SIGINT')
    expect(calls.filter(([operation]) => operation === 'rm')).toHaveLength(1)
    expect(calls.filter(([operation]) => operation === 'container')).toHaveLength(2)
    expect(unregisterSignalHandler).toHaveBeenCalledTimes(1)
    const receipt = JSON.parse(
      await readFile(join(outputDirectory, 'execution-receipt.json'), 'utf8'),
    ) as Record<string, unknown>
    expect(receipt).toMatchObject({
      canonicalArtifacts: {
        approved: false,
        invalidatedByCleanupFailure: true,
        published: false,
      },
      cleanup: {
        attempted: true,
        errors: [{ message: 'never-settling cleanup command cancelled', stage: 'remove' }],
        outcome: 'failed',
        removalCommandSucceeded: false,
      },
      executionApproval: 'not_approved',
      passed: false,
      signal: { activeCommandCancellationError: null, received: 'SIGINT' },
    })
    await expect(
      readFile(join(outputDirectory, 'canonical-manifest.sha256')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test.each(['SIGINT', 'SIGTERM'] as const)(
    'gracefully handles %s with active-command cancellation and exactly-once cleanup',
    async (signal) => {
      const package_ = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
      const preMigrationBackup = verifyLoadedPreMigrationBackupForPackage({
        loaded: fixture.loadedBackup,
        package: package_,
        trustedManifestSha256: fixture.backup.manifestSha256,
      })
      const { outputDirectory, outputIdentity } = await createTestOutput(
        `exact-${signal.toLowerCase()}-cleanup-`,
      )
      const calls: string[][] = []
      const containerId = signal === 'SIGINT' ? '1'.repeat(64) : '2'.repeat(64)
      let containerName = ''
      let runLabel = ''
      let signalHandler: (received: 'SIGINT' | 'SIGTERM') => void = () => {
        throw new Error('signal handler was not registered')
      }
      const cancelActiveCommand = jest.fn()
      const unregisterSignalHandler = jest.fn()
      const runtime: DisposableRuntime = {
        cancelActiveCommand,
        command: async (_command, arguments_) => {
          calls.push(arguments_)
          if (arguments_[0] === 'context' && arguments_[1] === 'show') {
            return { stderr: '', stdout: 'default\n' }
          }
          if (arguments_[0] === 'context' && arguments_[1] === 'inspect') {
            return { stderr: '', stdout: '"unix:///var/run/docker.sock"\n' }
          }
          if (arguments_[0] === 'run') {
            containerName = arguments_[arguments_.indexOf('--name') + 1] ?? ''
            runLabel = arguments_[arguments_.indexOf('--label') + 1] ?? ''
            return { stderr: '', stdout: `${containerId}\n` }
          }
          if (arguments_[0] === 'inspect') {
            const separator = runLabel.indexOf('=')
            return {
              stderr: '',
              stdout: `${JSON.stringify({
                Config: {
                  Labels: { [runLabel.slice(0, separator)]: runLabel.slice(separator + 1) },
                },
                Id: containerId,
                Name: `/${containerName}`,
                NetworkSettings: {
                  Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55445' }] },
                },
              })}\n`,
            }
          }
          if (arguments_[0] === 'rm' || arguments_[0] === 'container') {
            return { stderr: '', stdout: '' }
          }
          throw new Error(`signal path reached unexpected operation ${arguments_[0] ?? '(none)'}`)
        },
        environment: {},
        now: () => FIXED_TIME,
        onContainerOwnedForTest: async () => {
          signalHandler(signal)
          signalHandler(signal)
        },
        registerSignalHandler: (handler) => {
          signalHandler = handler
          return unregisterSignalHandler
        },
      }

      await expect(
        executeFreshDisposableRuntime(
          {
            files: generated.files,
            identityPolicy: fixture.identityPolicy,
            outputDirectory,
            outputIdentity,
            preMigrationBackup,
            sources: fixture.sources,
          },
          runtime,
        ),
      ).rejects.toThrow(new RegExp(`interrupted by ${signal}`, 'iu'))
      expect(cancelActiveCommand).toHaveBeenCalledTimes(1)
      expect(cancelActiveCommand).toHaveBeenCalledWith(signal)
      expect(unregisterSignalHandler).toHaveBeenCalledTimes(1)
      expect(calls.filter(([operation]) => operation === 'rm')).toHaveLength(1)
      expect(calls.filter(([operation]) => operation === 'container')).toHaveLength(2)
      expect(calls.some(([operation]) => operation === 'exec')).toBe(false)
      const receipt = JSON.parse(
        await readFile(join(outputDirectory, 'execution-receipt.json'), 'utf8'),
      ) as Record<string, unknown>
      expect(receipt).toMatchObject({
        canonicalArtifacts: { approved: false, published: false },
        cleanup: {
          absenceVerification: 'verified_absent',
          attempted: true,
          outcome: 'removed_and_verified_absent',
          removalCommandSucceeded: true,
        },
        executionApproval: 'not_approved',
        passed: false,
        primaryError: expect.stringContaining(`interrupted by ${signal}`),
        result: 'failed',
        signal: { activeCommandCancellationError: null, received: signal },
      })
      await expect(
        readFile(join(outputDirectory, 'canonical-manifest.sha256')),
      ).rejects.toMatchObject({ code: 'ENOENT' })
    },
  )

  test('a signal escapes a never-settling in-flight command and runs cleanup exactly once', async () => {
    const package_ = verifyExactGeneratedPackage(generated.files, fixture.identityPolicy)
    const preMigrationBackup = verifyLoadedPreMigrationBackupForPackage({
      loaded: fixture.loadedBackup,
      package: package_,
      trustedManifestSha256: fixture.backup.manifestSha256,
    })
    const { outputDirectory, outputIdentity } = await createTestOutput(
      'exact-never-settling-signal-',
    )
    const calls: string[][] = []
    const containerId = '3'.repeat(64)
    let containerName = ''
    let runLabel = ''
    let signalHandler: (signal: 'SIGINT' | 'SIGTERM') => void = () => {
      throw new Error('signal handler was not registered')
    }
    const cancelActiveCommand = jest.fn(async () => {
      throw new Error('bounded active-command cancellation failed')
    })
    const unregisterSignalHandler = jest.fn()
    const runtime: DisposableRuntime = {
      cancelActiveCommand,
      command: (_command, arguments_) => {
        calls.push(arguments_)
        if (arguments_[0] === 'context' && arguments_[1] === 'show') {
          return Promise.resolve({ stderr: '', stdout: 'default\n' })
        }
        if (arguments_[0] === 'context' && arguments_[1] === 'inspect') {
          return Promise.resolve({ stderr: '', stdout: '"unix:///var/run/docker.sock"\n' })
        }
        if (arguments_[0] === 'run') {
          containerName = arguments_[arguments_.indexOf('--name') + 1] ?? ''
          runLabel = arguments_[arguments_.indexOf('--label') + 1] ?? ''
          return Promise.resolve({ stderr: '', stdout: `${containerId}\n` })
        }
        if (arguments_[0] === 'inspect') {
          const separator = runLabel.indexOf('=')
          return Promise.resolve({
            stderr: '',
            stdout: `${JSON.stringify({
              Config: {
                Labels: { [runLabel.slice(0, separator)]: runLabel.slice(separator + 1) },
              },
              Id: containerId,
              Name: `/${containerName}`,
              NetworkSettings: {
                Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55446' }] },
              },
            })}\n`,
          })
        }
        if (arguments_[0] === 'exec') {
          signalHandler('SIGTERM')
          signalHandler('SIGTERM')
          return new Promise<CommandResult>(() => undefined)
        }
        if (arguments_[0] === 'rm' || arguments_[0] === 'container') {
          return Promise.resolve({ stderr: '', stdout: '' })
        }
        return Promise.reject(
          new Error(`never-settling signal path reached ${arguments_[0] ?? '(none)'}`),
        )
      },
      environment: {},
      now: () => FIXED_TIME,
      registerSignalHandler: (handler) => {
        signalHandler = handler
        return unregisterSignalHandler
      },
    }

    const execution = executeFreshDisposableRuntime(
      {
        files: generated.files,
        identityPolicy: fixture.identityPolicy,
        outputDirectory,
        outputIdentity,
        preMigrationBackup,
        sources: fixture.sources,
      },
      runtime,
    )
    let timeout: ReturnType<typeof setTimeout> | undefined
    const boundedExecution = Promise.race([
      execution,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('signal failed to escape the never-settling command')),
          1_000,
        )
      }),
    ])
    try {
      await expect(boundedExecution).rejects.toThrow(/interrupted by SIGTERM/iu)
    } finally {
      clearTimeout(timeout)
    }
    expect(cancelActiveCommand).toHaveBeenCalledTimes(1)
    expect(cancelActiveCommand).toHaveBeenCalledWith('SIGTERM')
    expect(unregisterSignalHandler).toHaveBeenCalledTimes(1)
    expect(calls.filter(([operation]) => operation === 'exec')).toHaveLength(1)
    expect(calls.filter(([operation]) => operation === 'rm')).toHaveLength(1)
    expect(calls.filter(([operation]) => operation === 'container')).toHaveLength(2)
    const receipt = JSON.parse(
      await readFile(join(outputDirectory, 'execution-receipt.json'), 'utf8'),
    ) as Record<string, unknown>
    expect(receipt).toMatchObject({
      canonicalArtifacts: { approved: false, published: false },
      cleanup: {
        absenceVerification: 'verified_absent',
        attempted: true,
        outcome: 'removed_and_verified_absent',
      },
      executionApproval: 'not_approved',
      passed: false,
      primaryError: expect.stringContaining('interrupted by SIGTERM'),
      result: 'failed',
      signal: {
        activeCommandCancellationError: 'bounded active-command cancellation failed',
        received: 'SIGTERM',
      },
    })
    await expect(
      readFile(join(outputDirectory, 'canonical-manifest.sha256')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('command-level rehearsal never executes when the output directory already exists', async () => {
    const root = await safeTemporaryDirectory('exact-package-cli-collision-')
    const paths = await writeCliFixture(root, generated, fixture)
    const outputDirectory = join(root, 'existing-evidence')
    await mkdir(outputDirectory)
    const executeFreshDisposableDatabase = jest.fn(async () => passingReport(generated, fixture))
    await expect(
      runExactPackageRehearsalCli(cliArguments(paths, root, outputDirectory), {
        executeFreshDisposableDatabase,
        identityPolicy: fixture.identityPolicy,
        loadPreMigrationBackup: jest.fn(async () => fixture.loadedBackup),
      }),
    ).rejects.toThrow(/EEXIST|exist/u)
    expect(executeFreshDisposableDatabase).not.toHaveBeenCalled()
  })

  test('command-level rehearsal never executes with a stale source input', async () => {
    const root = await safeTemporaryDirectory('exact-package-cli-stale-')
    const paths = await writeCliFixture(root, generated, fixture)
    await writeFile(paths.sourcePaths.artifact, Buffer.from('stale artifact\n', 'utf8'))
    const executeFreshDisposableDatabase = jest.fn(async () => passingReport(generated, fixture))
    await expect(
      runExactPackageRehearsalCli(cliArguments(paths, root, join(root, 'evidence')), {
        executeFreshDisposableDatabase,
        identityPolicy: fixture.identityPolicy,
        loadPreMigrationBackup: jest.fn(async () => fixture.loadedBackup),
      }),
    ).rejects.toThrow(/missing, stale, or replaced/u)
    expect(executeFreshDisposableDatabase).not.toHaveBeenCalled()
  })
})
