/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  EXACT_COMPENSATION_COUNTS,
  EXACT_IMPORT_COUNTS,
  MIGRATION_ID,
  MIGRATION_SHA256,
  developmentPlanningStateSha256,
  derivePackagePlanningRows,
  generateGoldImportCompensationPackage,
  runPackageGeneratorCli,
  verifyReadyPostMigrationAuditPackage,
  type GeneratedPackage,
  type PackageSourceBytes,
  type PackageSourceIdentityPolicy,
} from './generate-gold-import-compensation-package-v1'
import {
  DISPOSABLE_POSTGRES_IMAGE,
  assertDisposableRehearsalTarget,
  assertExactPackageSourceBytes,
  buildDeterministicExactPackageRehearsalArtifacts,
  executeFreshDisposableRuntime,
  renderDevelopmentDatabaseSeedSql,
  runExactPackageRehearsalCli,
  validateExactRpcContractMetadata,
  verifyDevelopmentDatabaseBackupFixtureForTest,
  verifyExactGeneratedPackage,
  verifyLoadedPreMigrationBackupForPackage,
  type DisposableRuntime,
  type DevelopmentDatabaseSeed,
  type ExactPackageRehearsalEvidence,
  type ExactPackageRehearsalCliDependencies,
  type ExactPackageRehearsalReport,
  type ExecuteFreshDisposableInput,
} from './rehearse-exact-gold-import-compensation-package-v1'
import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import type { LoadedPreMigrationBackup } from './gold-import-compensation-migration-operations'

jest.setTimeout(30_000)

const FIXED_TIME = '2026-08-08T00:00:00.000Z'
const CSV_HEADER = [
  'gold_set_item_id',
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
  const auditBytes = canonicalPrettyBytes(audit)
  const developmentPlanningStateBytes = canonicalPrettyBytes(planningState)
  const markdownBytes = Buffer.from('# Fixture post-migration audit\n', 'utf8')
  const manifestBytes = Buffer.from(
    `${[
      ['development-planning-state.json', developmentPlanningStateBytes],
      ['migration-audit.json', auditBytes],
      ['migration-audit.md', markdownBytes],
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
    trustedManifestSha256: sha256(manifestBytes),
  })
}

async function safeTemporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(await realpath(tmpdir()), prefix))
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
  const schemaSecurityIdentitySha256 = sha256('fixture schema security identity')
  const audit = {
    checks: {
      behavioralProbe: 'none_on_real_batch_static_contract_and_snapshot_only',
      compensationExecuted: false,
      databaseMutationCount: 0,
      failures: [],
      importExecuted: false,
      lint: { errorCount: 0 },
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

  test('treats null legacy enrichment on an apparent no-op as a real state-shape mismatch', () => {
    const legacyState = structuredClone(fixture.planningState)
    const legacyReview = legacyState.rows[624].currentEffectiveReview as Record<string, unknown>
    legacyReview.enrichmentProvenance = null
    legacyReview.enrichmentSchemaVersion = null

    expect(() => derivePackagePlanningRows(legacyState, fixture.sources.finalArtifact)).toThrow(
      /real_state_shape_mismatch/u,
    )
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

  test('accepts only the exact ready auditor schema and reviewed canonical audit manifest', () => {
    expect(fixture.auditPackage.audit.comparisons.priorMigrationLedgerRowsUnchanged).toBe(true)
    expect(fixture.auditPackage.manifestSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(() =>
      verifyReadyPostMigrationAuditPackage({
        auditBytes: fixture.auditPackage.auditBytes,
        developmentPlanningStateBytes: fixture.auditPackage.developmentPlanningStateBytes,
        manifestBytes: fixture.auditPackage.manifestBytes,
        markdownBytes: fixture.auditPackage.markdownBytes,
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

    const replacedAuditEvidence = new Map(generated.files)
    replacedAuditEvidence.set(
      'post-migration-audit.md',
      Buffer.from('# Replaced audit narrative\n', 'utf8'),
    )
    rebindPackageManifest(replacedAuditEvidence)
    expect(() =>
      verifyExactGeneratedPackage(replacedAuditEvidence, fixture.identityPolicy),
    ).toThrow(/audit checksum mismatch/u)

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
    const input: ExecuteFreshDisposableInput = {
      files: generated.files,
      identityPolicy: fixture.identityPolicy,
      outputDirectory: '/unused/rehearsal-output',
      preMigrationBackup,
      sources: fixture.sources,
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
    await expect(executeFreshDisposableRuntime(input, remoteHostRuntime)).rejects.toThrow(
      /local Docker socket/u,
    )
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
    await expect(executeFreshDisposableRuntime(input, remoteContextRuntime)).rejects.toThrow(
      /local Docker socket/u,
    )
    expect(
      remoteContextCalls.some(({ arguments: [operation] }) =>
        ['run', 'exec', 'rm'].includes(operation ?? ''),
      ),
    ).toBe(false)

    const localCalls: Array<{ arguments: string[]; options?: { env?: Record<string, string> } }> =
      []
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
        throw new Error(`unexpected Docker operation ${arguments_[0] ?? '(none)'}`)
      },
      environment: {},
      now: () => FIXED_TIME,
    }
    await expect(executeFreshDisposableRuntime(input, localRuntime)).rejects.toThrow(
      /lost docker run response/u,
    )
    const runCall = localCalls.find(({ arguments: [operation] }) => operation === 'run')
    const cleanupCall = localCalls.find(({ arguments: [operation] }) => operation === 'rm')
    expect(runCall?.arguments).toContain(DISPOSABLE_POSTGRES_IMAGE)
    expect(runCall?.arguments).toContain('--label')
    expect(cleanupCall?.arguments.slice(0, 2)).toEqual(['rm', '--force'])
    expect(cleanupCall?.arguments.at(-1)).toBe(
      runCall?.arguments[runCall.arguments.indexOf('--name') + 1],
    )
    expect(cleanupCall?.options?.env).toEqual({ DOCKER_HOST: 'unix:///var/run/docker.sock' })
    expect(localCalls.some(({ arguments: [operation] }) => operation === 'exec')).toBe(false)
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
