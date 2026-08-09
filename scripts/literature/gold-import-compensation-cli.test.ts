/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  bindCompensationAuthorization,
  bindCompensationPlan,
  bindImportAuthorization,
  bindImportPlan,
  bindRecoveryAuthorization,
  goldReviewClinicalProjection,
  sha256Canonical,
  type CompensationReceipt,
  type GoldReviewPayload,
  type ImportReceipt,
} from '../../src/features/literature/gold-set/import-compensation'
import { parseFinalizedGoldImportArtifact } from './gold-import-compensation-compatibility'
import {
  runGoldImportCompensationCli,
  type GoldImportCompensationDatabaseClient,
} from './gold-import-compensation-cli'

const IDS = {
  batch: '00000000-0000-4000-8000-000000000001',
  importOperation: '00000000-0000-4000-8000-000000000002',
  importAction: '00000000-0000-4000-8000-000000000003',
  item: '00000000-0000-4000-8000-000000000004',
  importAuthorization: '00000000-0000-4000-8000-000000000005',
  compensationOperation: '00000000-0000-4000-8000-000000000006',
  compensationAction: '00000000-0000-4000-8000-000000000007',
  compensationAuthorization: '00000000-0000-4000-8000-000000000008',
  recoveryAuthorization: '00000000-0000-4000-8000-000000000009',
} as const

const LOCAL_ENV = {
  LITERATURE_SUPABASE_URL: 'http://127.0.0.1:54321',
  LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
}
const FIXED_TIME = '2026-08-08T12:00:00.000Z'
const EXECUTION_CONTEXT = {
  targetDatabase: 'local' as const,
  remoteWritesAllowed: false as const,
  repositoryCommitSha: 'a'.repeat(40),
  migrationId: '20260808035633_add_literature_gold_import_compensation_contract' as const,
  importRpc: 'apply_literature_gold_import_v1' as const,
  compensationRpc: 'compensate_literature_gold_import_v1' as const,
  reconciliationRpc: 'reconcile_literature_gold_review_operation_v1' as const,
  developmentMembershipHash: 'literature_gold_development_membership_hash_v1' as const,
  physicalStateHash: 'literature_gold_physical_state_hash_v1' as const,
  effectiveStateHash: 'literature_gold_effective_state_hash_v1' as const,
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function bindReceipt<T extends { response: string }>(content: T) {
  const identity = Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'response'))
  return { ...content, binding: { contentSha256: sha256Canonical(identity) } }
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'gold-import-compensation-cli-'))
  const noopReview: GoldReviewPayload = {
    relevanceLabel: 'include_core',
    metadataSufficiency: 'adequate_abstract',
    reviewerConfidence: 'high',
    topicIds: ['basic-bronchoscopy'],
    technologyTags: ['convex-ebus'],
    technologyTagStatus: 'tagged',
    clinicalPurposes: ['diagnosis'],
    diseaseTags: ['lung-cancer'],
    diseaseTagStatus: 'tagged',
    studyDesign: 'diagnostic-accuracy',
    publicationStatus: 'full-article',
    categorizationFromFullText: false,
    notes: 'Exact finalized physician decision.',
    usedSupplementalMetadata: false,
    reviewSeconds: 91,
    taxonomyVersion: '2.0.0',
    labelSchemaVersion: '3.0.0',
    enrichmentSchemaVersion: '3.0.2',
    enrichmentProvenance: 'physician_confirmed_ai_enrichment',
    reviewerUserId: null,
    reviewerEmail: 'physician@example.test',
    isBlinded: true,
    startedAt: FIXED_TIME,
    completedAt: FIXED_TIME,
    createdAt: FIXED_TIME,
  }
  const artifactBytes = Buffer.from(
    [
      [
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
      ].join(','),
      [
        IDS.item,
        '1',
        '12345678',
        'development',
        noopReview.relevanceLabel,
        noopReview.reviewerConfidence,
        noopReview.metadataSufficiency,
        noopReview.topicIds.join('|'),
        noopReview.technologyTags.join('|'),
        noopReview.technologyTagStatus,
        noopReview.clinicalPurposes.join('|'),
        noopReview.diseaseTags.join('|'),
        noopReview.diseaseTagStatus,
        noopReview.studyDesign,
        noopReview.publicationStatus,
        String(noopReview.categorizationFromFullText),
        noopReview.notes,
        String(noopReview.usedSupplementalMetadata),
        String(noopReview.isBlinded),
        noopReview.taxonomyVersion,
        noopReview.labelSchemaVersion,
        noopReview.enrichmentSchemaVersion,
        noopReview.enrichmentProvenance,
      ].join(','),
    ].join('\r\n') + '\r\n',
    'utf8',
  )
  const sourceArtifactSha256 = sha256(artifactBytes)
  const sourceAuthorizationSetBytes = Buffer.from(
    `${JSON.stringify({
      amendedTwoRowAuthorizationSha256: sha256('amended authorization'),
      finalArtifactSha256: sourceArtifactSha256,
      kind: 'gold_import_source_authorization_set',
      signedProtocolAuthorizationSha256: sha256('protocol authorization'),
      sourceDecisionsChanged: false,
      version: 1,
    })}\n`,
    'utf8',
  )
  const physical = sha256('physical-before')
  const effective = sha256('effective-before-and-after')
  const importPlan = bindImportPlan({
    contractVersion: 'gold-review-import-compensation/1.0.0',
    kind: 'import',
    operationId: IDS.importOperation,
    batchId: IDS.batch,
    sourceArtifactSha256,
    sourceAuthorizationSetSha256: sha256(sourceAuthorizationSetBytes),
    expectedPhysicalStateSha256: physical,
    expectedEffectiveStateSha256: effective,
    expectedPostEffectiveStateSha256: effective,
    executionContext: EXECUTION_CONTEXT,
    scope: {
      datasetSplit: 'development',
      heldOutIdentitiesAccessed: false,
      developmentMembershipSha256: sha256('development-membership'),
    },
    counts: { total: 1, initial: 0, revisions: 0, noops: 1, inserts: 0 },
    actions: [
      {
        actionId: IDS.importAction,
        sequence: 1,
        itemId: IDS.item,
        pmid: '12345678',
        datasetSplit: 'development',
        expectedCurrentReviewId: null,
        expectedEffectiveReviewId: null,
        preImportItemState: {
          reviewStatus: 'pending',
          startedAt: null,
          completedAt: null,
          supplementalMetadataRevealedAt: null,
          automatedSignalsRevealedAt: null,
        },
        action: 'import_noop',
        expectedRevision: null,
        expectedSupersedesReviewId: null,
        importedReviewId: null,
        expectedHeadReviewIdAfter: null,
        expectedEffectiveReviewIdAfter: null,
        candidateReview: goldReviewClinicalProjection(noopReview),
        candidateReviewSha256: sha256Canonical(goldReviewClinicalProjection(noopReview)),
        compensationAction: 'compensate_noop',
        expectedEventSequence: [],
      },
    ],
  })
  const importAuthorization = bindImportAuthorization({
    contractVersion: 'gold-review-import-compensation/1.0.0',
    kind: 'import_authorization',
    authorizationId: IDS.importAuthorization,
    authorized: true,
    authorizedBy: 'import-authorizer@example.test',
    authorizedAt: FIXED_TIME,
    authorizationNote: 'Exact checksum-bound import authorization.',
    targetDatabase: EXECUTION_CONTEXT.targetDatabase,
    remoteWritesAllowed: EXECUTION_CONTEXT.remoteWritesAllowed,
    repositoryCommitSha: EXECUTION_CONTEXT.repositoryCommitSha,
    migrationId: EXECUTION_CONTEXT.migrationId,
    operationId: importPlan.operationId,
    batchId: importPlan.batchId,
    planSha256: importPlan.binding.contentSha256,
    idempotencyKey: importPlan.binding.idempotencyKey,
    sourceArtifactSha256,
    expectedPhysicalStateSha256: physical,
    expectedEffectiveStateSha256: effective,
    expectedPostEffectiveStateSha256: effective,
  })
  const importReceipt = bindReceipt({
    contractVersion: 'gold-review-import-compensation/1.0.0' as const,
    kind: 'import_receipt' as const,
    operationId: importPlan.operationId,
    batchId: importPlan.batchId,
    planSha256: importPlan.binding.contentSha256,
    idempotencyKey: importPlan.binding.idempotencyKey,
    outcome: 'committed' as const,
    response: 'applied' as const,
    beforePhysicalStateSha256: physical,
    afterPhysicalStateSha256: sha256('physical-after-import'),
    beforeEffectiveStateSha256: effective,
    afterEffectiveStateSha256: effective,
    counts: { planned: 0, applied: 0, noops: 1 },
    eventSequence: ['import_started', 'import_completed'] as const,
    error: null,
  }) satisfies ImportReceipt

  const compensationPlan = bindCompensationPlan({
    contractVersion: 'gold-review-import-compensation/1.0.0',
    kind: 'compensation',
    operationId: IDS.compensationOperation,
    targetImportOperationId: IDS.importOperation,
    batchId: IDS.batch,
    importPlanSha256: importPlan.binding.contentSha256,
    importReceiptSha256: importReceipt.binding.contentSha256,
    sourceArtifactSha256,
    expectedPhysicalStateSha256: importReceipt.afterPhysicalStateSha256,
    expectedEffectiveStateSha256: effective,
    expectedPostEffectiveStateSha256: effective,
    executionContext: EXECUTION_CONTEXT,
    scope: importPlan.scope,
    counts: { total: 1, restored: 0, voided: 0, noops: 1 },
    actions: [
      {
        actionId: IDS.compensationAction,
        sourceActionId: IDS.importAction,
        sequence: 1,
        itemId: IDS.item,
        pmid: '12345678',
        datasetSplit: 'development',
        importedReviewId: null,
        expectedCurrentReviewId: null,
        expectedEffectiveReviewId: null,
        action: 'compensate_noop',
        expectedRevision: null,
        expectedSupersedesReviewId: null,
        compensationReviewId: null,
        effectiveSourceReviewId: null,
        expectedHeadReviewIdAfter: null,
        expectedEffectiveReviewIdAfter: null,
        expectedEventSequence: [],
      },
    ],
  })
  const compensationAuthorization = bindCompensationAuthorization({
    contractVersion: 'gold-review-import-compensation/1.0.0',
    kind: 'compensation_authorization',
    authorizationId: IDS.compensationAuthorization,
    authorized: true,
    authorizedBy: 'compensation-authorizer@example.test',
    authorizedAt: FIXED_TIME,
    authorizationNote: 'Exact checksum-bound compensation authorization.',
    targetDatabase: EXECUTION_CONTEXT.targetDatabase,
    remoteWritesAllowed: EXECUTION_CONTEXT.remoteWritesAllowed,
    repositoryCommitSha: EXECUTION_CONTEXT.repositoryCommitSha,
    migrationId: EXECUTION_CONTEXT.migrationId,
    operationId: compensationPlan.operationId,
    targetImportOperationId: compensationPlan.targetImportOperationId,
    batchId: compensationPlan.batchId,
    planSha256: compensationPlan.binding.contentSha256,
    idempotencyKey: compensationPlan.binding.idempotencyKey,
    importReceiptSha256: compensationPlan.importReceiptSha256,
    sourceArtifactSha256,
    expectedPhysicalStateSha256: compensationPlan.expectedPhysicalStateSha256,
    expectedEffectiveStateSha256: effective,
    expectedPostEffectiveStateSha256: effective,
  })
  const compensationReceipt = bindReceipt({
    contractVersion: 'gold-review-import-compensation/1.0.0' as const,
    kind: 'compensation_receipt' as const,
    operationId: compensationPlan.operationId,
    targetImportOperationId: compensationPlan.targetImportOperationId,
    batchId: compensationPlan.batchId,
    planSha256: compensationPlan.binding.contentSha256,
    idempotencyKey: compensationPlan.binding.idempotencyKey,
    outcome: 'committed' as const,
    response: 'applied' as const,
    beforePhysicalStateSha256: compensationPlan.expectedPhysicalStateSha256,
    afterPhysicalStateSha256: sha256('physical-after-compensation'),
    beforeEffectiveStateSha256: effective,
    afterEffectiveStateSha256: effective,
    counts: { planned: 0, applied: 0, noops: 1 },
    eventSequence: ['import_compensation_started', 'import_compensation_completed'] as const,
    error: null,
  }) satisfies CompensationReceipt

  const recoveryAuthorization = bindRecoveryAuthorization({
    contractVersion: 'gold-review-import-compensation/1.0.0',
    kind: 'recovery_authorization',
    authorizationId: IDS.recoveryAuthorization,
    authorized: true,
    authorizedBy: 'recovery-authorizer@example.test',
    authorizedAt: FIXED_TIME,
    authorizationNote: 'Read-only ambiguous import reconciliation.',
    targetDatabase: EXECUTION_CONTEXT.targetDatabase,
    remoteWritesAllowed: EXECUTION_CONTEXT.remoteWritesAllowed,
    repositoryCommitSha: EXECUTION_CONTEXT.repositoryCommitSha,
    migrationId: EXECUTION_CONTEXT.migrationId,
    recoveryAction: 'resolve_ambiguous_import',
    batchId: IDS.batch,
    targetOperationId: importPlan.operationId,
    targetPlanSha256: importPlan.binding.contentSha256,
    targetIdempotencyKey: importPlan.binding.idempotencyKey,
    observedPhysicalStateSha256: importReceipt.afterPhysicalStateSha256,
    observedEffectiveStateSha256: importReceipt.afterEffectiveStateSha256,
    permitsMutation: false,
  })

  const paths = {
    artifact: join(root, 'artifact.csv'),
    importPlan: join(root, 'import-plan.json'),
    importAuthorization: join(root, 'import-authorization.json'),
    compensationPlan: join(root, 'compensation-plan.json'),
    compensationAuthorization: join(root, 'compensation-authorization.json'),
    recoveryAuthorization: join(root, 'recovery-authorization.json'),
    sourceAuthorizationSet: join(root, 'source-authorization-set.json'),
  }
  await Promise.all([
    writeFile(paths.artifact, artifactBytes),
    writeFile(paths.importPlan, JSON.stringify(importPlan)),
    writeFile(paths.importAuthorization, JSON.stringify(importAuthorization)),
    writeFile(paths.compensationPlan, JSON.stringify(compensationPlan)),
    writeFile(paths.compensationAuthorization, JSON.stringify(compensationAuthorization)),
    writeFile(paths.recoveryAuthorization, JSON.stringify(recoveryAuthorization)),
    writeFile(paths.sourceAuthorizationSet, sourceAuthorizationSetBytes),
  ])
  return {
    root,
    paths,
    importPlan,
    importAuthorization,
    importReceipt,
    compensationPlan,
    compensationAuthorization,
    compensationReceipt,
    recoveryAuthorization,
    sourceAuthorizationSetBytes,
  }
}

async function v3CompatibilityFixture() {
  const value = await fixture()
  const artifactBytes = await readFile(value.paths.artifact)
  const parsedArtifact = parseFinalizedGoldImportArtifact(artifactBytes, {
    expectedArtifactSha256: value.importPlan.sourceArtifactSha256,
  })
  const sourceAuthorizationSet = {
    amendedTwoRowAuthorizationSha256: sha256('v3-amended-authorization'),
    compatibility: {
      actionCounts: {
        ...value.importPlan.counts,
        incompatible: 0,
        unresolved: 0,
      },
      bindings: {
        contract: {
          environmentInvariantIdentitySha256: sha256('v3-invariant'),
          environmentProfileIdentitySha256: sha256('v3-profile'),
        },
        currentDatabase: {
          batchId: value.importPlan.batchId,
          developmentMembershipSha256: value.importPlan.scope.developmentMembershipSha256,
          developmentPlanningStateSha256: sha256('v3-planning-state'),
          effectiveStateSha256: value.importPlan.expectedEffectiveStateSha256,
          physicalStateSha256: value.importPlan.expectedPhysicalStateSha256,
        },
        existingHeadCohortSha256: sha256('v3-existing-head-cohort'),
        finalV3ArtifactSha256: value.importPlan.sourceArtifactSha256,
        migration: {
          id: EXECUTION_CONTEXT.migrationId,
          sha256: sha256('v3-migration'),
        },
      },
      booleanNormalizationLedger: parsedArtifact.booleanNormalizations,
      booleanNormalizationLedgerSha256: sha256Canonical(parsedArtifact.booleanNormalizations),
      listNormalizationLedger: parsedArtifact.listNormalizations,
      listNormalizationLedgerSha256: sha256Canonical(parsedArtifact.listNormalizations),
      noteDisposition: {
        action: 'preserve_current_authorized_physician_rationale',
        pmids: ['36879724', '39281191'],
        ruleVersion: 'gold-import-existing-note-disposition/amended-two-row-preserve-current-v1',
        sourceArtifactNotesApplied: false,
        status: 'already_authorized',
      },
      resolutionSchemaVersion: 'gold-import-compensation-compatibility/1.0.0',
      scope: {
        datasetSplit: 'development',
        heldOutIdentitiesAccessed: false,
        remoteWritesAllowed: false,
        targetDatabase: 'local',
      },
    },
    finalArtifactSha256: value.importPlan.sourceArtifactSha256,
    kind: 'gold_import_source_authorization_set',
    signedProtocolAuthorizationSha256: sha256('v3-protocol-authorization'),
    sourceDecisionsChanged: false,
    version: 3,
  }
  const writeBundle = async (
    nextSourceAuthorizationSet: unknown,
    nextArtifactBytes: Buffer = artifactBytes,
  ) => {
    const sourceAuthorizationSetBytes = Buffer.from(
      `${JSON.stringify(nextSourceAuthorizationSet)}\n`,
      'utf8',
    )
    const { binding: planBinding, ...planContent } = value.importPlan
    void planBinding
    const importPlan = bindImportPlan({
      ...planContent,
      sourceArtifactSha256: sha256(nextArtifactBytes),
      sourceAuthorizationSetSha256: sha256(sourceAuthorizationSetBytes),
    })
    const { binding: authorizationBinding, ...authorizationContent } = value.importAuthorization
    void authorizationBinding
    const importAuthorization = bindImportAuthorization({
      ...authorizationContent,
      batchId: importPlan.batchId,
      expectedEffectiveStateSha256: importPlan.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: importPlan.expectedPhysicalStateSha256,
      expectedPostEffectiveStateSha256: importPlan.expectedPostEffectiveStateSha256,
      idempotencyKey: importPlan.binding.idempotencyKey,
      operationId: importPlan.operationId,
      planSha256: importPlan.binding.contentSha256,
      sourceArtifactSha256: importPlan.sourceArtifactSha256,
    })
    await Promise.all([
      writeFile(value.paths.artifact, nextArtifactBytes),
      writeFile(value.paths.importAuthorization, JSON.stringify(importAuthorization)),
      writeFile(value.paths.importPlan, JSON.stringify(importPlan)),
      writeFile(value.paths.sourceAuthorizationSet, sourceAuthorizationSetBytes),
    ])
    return { importAuthorization, importPlan, sourceAuthorizationSetBytes }
  }
  const bundle = await writeBundle(sourceAuthorizationSet)
  return { ...value, ...bundle, artifactBytes, sourceAuthorizationSet, writeBundle }
}

function dependencies(rpc: jest.Mock) {
  const createClient = jest.fn(() => ({ rpc }) satisfies GoldImportCompensationDatabaseClient)
  return {
    dependencies: {
      createClient,
      env: LOCAL_ENV,
      log: jest.fn(),
      now: () => FIXED_TIME,
      primaryCheckout: async () => true,
      repositoryCommitSha: async () => EXECUTION_CONTEXT.repositoryCommitSha,
    },
    createClient,
  }
}

describe('gold import-compensation CLI', () => {
  it('routes mutation-capable package invocations through the primary-checkout guard', async () => {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts['literature:gold-import-compensation']).toBe(
      'node scripts/require-primary-checkout.mjs -- tsx scripts/literature/gold-import-compensation-cli.ts',
    )
    expect(packageJson.scripts['literature:gold-import-compensation:validate-import']).toBe(
      'tsx scripts/literature/gold-import-compensation-cli.ts validate-import',
    )
    expect(packageJson.scripts['literature:gold-import-compensation:validate-compensation']).toBe(
      'tsx scripts/literature/gold-import-compensation-cli.ts validate-compensation',
    )
  })

  it('blocks a direct mutating invocation outside the primary checkout before any RPC', async () => {
    const value = await fixture()
    const rpc = jest.fn()
    const supplied = dependencies(rpc)

    await expect(
      runGoldImportCompensationCli(
        [
          'execute-import',
          '--plan',
          value.paths.importPlan,
          '--authorization',
          value.paths.importAuthorization,
          '--artifact',
          value.paths.artifact,
          '--source-authorization-set',
          value.paths.sourceAuthorizationSet,
          '--receipt',
          join(value.root, 'blocked-receipt.json'),
          '--actor-email',
          'actor@example.invalid',
        ],
        value.root,
        { ...supplied.dependencies, primaryCheckout: async () => false },
      ),
    ).rejects.toThrow('must run from the primary checkout')
    expect(supplied.createClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('validates import and compensation bundles without constructing a database client', async () => {
    const value = await fixture()
    const createClient = jest.fn(() => {
      throw new Error('validation must remain file-only')
    })
    const log = jest.fn()
    const repositoryCommitSha = jest.fn(async () => EXECUTION_CONTEXT.repositoryCommitSha)

    const imported = await runGoldImportCompensationCli(
      [
        'validate-import',
        '--plan',
        value.paths.importPlan,
        '--authorization',
        value.paths.importAuthorization,
        '--artifact',
        value.paths.artifact,
        '--source-authorization-set',
        value.paths.sourceAuthorizationSet,
      ],
      value.root,
      { createClient, log, repositoryCommitSha },
    )
    const compensated = await runGoldImportCompensationCli(
      [
        'validate-compensation',
        '--plan',
        value.paths.compensationPlan,
        '--authorization',
        value.paths.compensationAuthorization,
        '--artifact',
        value.paths.artifact,
      ],
      value.root,
      { createClient, log, repositoryCommitSha },
    )

    expect(imported).toMatchObject({
      command: 'validate-import',
      repositoryCommitMatches: true,
      repositoryCommitSha: EXECUTION_CONTEXT.repositoryCommitSha,
      sourceAuthorizationSetSha256: value.importPlan.sourceAuthorizationSetSha256,
      valid: true,
    })
    expect(compensated).toMatchObject({ command: 'validate-compensation', valid: true })
    expect(createClient).not.toHaveBeenCalled()

    await expect(
      runGoldImportCompensationCli(
        [
          'validate-import',
          '--plan',
          value.paths.importPlan,
          '--authorization',
          value.paths.importAuthorization,
          '--artifact',
          value.paths.artifact,
          '--source-authorization-set',
          value.paths.sourceAuthorizationSet,
        ],
        value.root,
        {
          createClient,
          log,
          repositoryCommitSha: async () => 'b'.repeat(40),
        },
      ),
    ).rejects.toThrow('Repository commit attestation mismatch')
    expect(createClient).not.toHaveBeenCalled()

    await writeFile(value.paths.sourceAuthorizationSet, 'changed authorization set')
    await expect(
      runGoldImportCompensationCli(
        [
          'validate-import',
          '--plan',
          value.paths.importPlan,
          '--authorization',
          value.paths.importAuthorization,
          '--artifact',
          value.paths.artifact,
          '--source-authorization-set',
          value.paths.sourceAuthorizationSet,
        ],
        value.root,
        { createClient, log, repositoryCommitSha },
      ),
    ).rejects.toThrow('Source authorization set checksum mismatch')
    expect(createClient).not.toHaveBeenCalled()

    await writeFile(value.paths.sourceAuthorizationSet, value.sourceAuthorizationSetBytes)
    await writeFile(value.paths.artifact, 'changed artifact')
    await expect(
      runGoldImportCompensationCli(
        [
          'validate-import',
          '--plan',
          value.paths.importPlan,
          '--authorization',
          value.paths.importAuthorization,
          '--artifact',
          value.paths.artifact,
          '--source-authorization-set',
          value.paths.sourceAuthorizationSet,
        ],
        value.root,
        { createClient, log, repositoryCommitSha },
      ),
    ).rejects.toThrow('Source artifact checksum mismatch')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('binds V3 ledgers, state, provenance, and retired V2 status paths before client creation', async () => {
    const value = await v3CompatibilityFixture()
    const createClient = jest.fn(() => {
      throw new Error('V3 file validation must finish before client construction')
    })
    const validateArguments = [
      'validate-import',
      '--plan',
      value.paths.importPlan,
      '--authorization',
      value.paths.importAuthorization,
      '--artifact',
      value.paths.artifact,
      '--source-authorization-set',
      value.paths.sourceAuthorizationSet,
    ]
    const executeArguments = [
      'execute-import',
      ...validateArguments.slice(1),
      '--receipt',
      join(value.root, 'must-not-be-created.json'),
      '--actor-email',
      'executor@example.test',
      '--target',
      'local',
    ]
    const runtimeDependencies = {
      createClient,
      env: LOCAL_ENV,
      log: jest.fn(),
      primaryCheckout: async () => true,
      repositoryCommitSha: async () => EXECUTION_CONTEXT.repositoryCommitSha,
    }

    await expect(
      runGoldImportCompensationCli(validateArguments, value.root, runtimeDependencies),
    ).resolves.toMatchObject({ command: 'validate-import', valid: true })
    expect(createClient).not.toHaveBeenCalled()

    const retiredV2 = { ...jsonClone(value.sourceAuthorizationSet), version: 2 }
    await value.writeBundle(retiredV2)
    await expect(
      runGoldImportCompensationCli(executeArguments, value.root, runtimeDependencies),
    ).rejects.toThrow('V2 physician status supplements are retired')
    expect(createClient).not.toHaveBeenCalled()

    const countMismatch = jsonClone(value.sourceAuthorizationSet)
    countMismatch.compatibility.actionCounts.initial = 1
    countMismatch.compatibility.actionCounts.inserts = 1
    countMismatch.compatibility.actionCounts.noops = 0
    countMismatch.compatibility.actionCounts.revisions = 0
    await value.writeBundle(countMismatch)
    await expect(
      runGoldImportCompensationCli(executeArguments, value.root, runtimeDependencies),
    ).rejects.toThrow('action counts do not match the import plan')
    expect(createClient).not.toHaveBeenCalled()

    const ledgerMismatch = jsonClone(value.sourceAuthorizationSet)
    const firstLedgerEntry = ledgerMismatch.compatibility.booleanNormalizationLedger[0]
    if (!firstLedgerEntry || firstLedgerEntry.originalLexeme !== 'false') {
      throw new Error('Expected canonical false as the first V3 fixture normalization.')
    }
    firstLedgerEntry.originalLexeme = 'False'
    firstLedgerEntry.sourceForm = 'legacy_title_case'
    ledgerMismatch.compatibility.booleanNormalizationLedgerSha256 = sha256Canonical(
      ledgerMismatch.compatibility.booleanNormalizationLedger,
    )
    await value.writeBundle(ledgerMismatch)
    await expect(
      runGoldImportCompensationCli(executeArguments, value.root, runtimeDependencies),
    ).rejects.toThrow('does not exactly match the finalized artifact')
    expect(createClient).not.toHaveBeenCalled()

    const listLedgerMismatch = jsonClone(value.sourceAuthorizationSet)
    const sourceRow = parseFinalizedGoldImportArtifact(value.artifactBytes).rows[0]
    if (!sourceRow) throw new Error('Expected a V3 source row.')
    listLedgerMismatch.compatibility.listNormalizationLedger = [
      {
        canonicalValues: ['basic-bronchoscopy', 'peripheral-navigation'],
        classification: 'deterministic_lexical_normalization',
        column: 'topic_ids',
        normalizationRuleVersion: 'finalized-v3-ordered-set-list-to-ascending/1.0.0',
        originalLexeme: 'peripheral-navigation|basic-bronchoscopy',
        originalValues: ['peripheral-navigation', 'basic-bronchoscopy'],
        sourceArtifactSha256: listLedgerMismatch.finalArtifactSha256,
        sourceIdentity: sourceRow.identity,
      },
    ]
    listLedgerMismatch.compatibility.listNormalizationLedgerSha256 = sha256Canonical(
      listLedgerMismatch.compatibility.listNormalizationLedger,
    )
    await value.writeBundle(listLedgerMismatch)
    await expect(
      runGoldImportCompensationCli(executeArguments, value.root, runtimeDependencies),
    ).rejects.toThrow('list normalization ledger does not exactly match the finalized artifact')
    expect(createClient).not.toHaveBeenCalled()

    const staleState = jsonClone(value.sourceAuthorizationSet)
    staleState.compatibility.bindings.currentDatabase.effectiveStateSha256 = sha256(
      'stale-v3-effective-state',
    )
    await value.writeBundle(staleState)
    await expect(
      runGoldImportCompensationCli(executeArguments, value.root, runtimeDependencies),
    ).rejects.toThrow('stale relative to the import plan current-state bindings')
    expect(createClient).not.toHaveBeenCalled()

    const tamperedArtifact = Buffer.from(
      value.artifactBytes
        .toString('utf8')
        .replace(
          'Exact finalized physician decision.,false,true,',
          'Exact finalized physician decision.,true,true,',
        ),
      'utf8',
    )
    expect(tamperedArtifact).not.toEqual(value.artifactBytes)
    const parsedTamperedArtifact = parseFinalizedGoldImportArtifact(tamperedArtifact)
    const fullTextMappingDefect = jsonClone(value.sourceAuthorizationSet)
    fullTextMappingDefect.finalArtifactSha256 = parsedTamperedArtifact.artifactSha256
    fullTextMappingDefect.compatibility.bindings.finalV3ArtifactSha256 =
      parsedTamperedArtifact.artifactSha256
    fullTextMappingDefect.compatibility.booleanNormalizationLedger =
      parsedTamperedArtifact.booleanNormalizations
    fullTextMappingDefect.compatibility.booleanNormalizationLedgerSha256 = sha256Canonical(
      parsedTamperedArtifact.booleanNormalizations,
    )
    await value.writeBundle(fullTextMappingDefect, tamperedArtifact)
    await expect(
      runGoldImportCompensationCli(executeArguments, value.root, runtimeDependencies),
    ).rejects.toThrow('full_text_used')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects checksum-consistent clinical artifact drift before constructing a database client', async () => {
    const value = await fixture()
    const original = await readFile(value.paths.artifact, 'utf8')
    const tampered = original.replace(
      'Exact finalized physician decision.',
      'Checksum-consistent but unauthorized decision drift.',
    )
    const sourceAuthorization = JSON.parse(
      await readFile(value.paths.sourceAuthorizationSet, 'utf8'),
    ) as Record<string, unknown>
    sourceAuthorization.finalArtifactSha256 = sha256(tampered)
    const sourceAuthorizationBytes = `${JSON.stringify(sourceAuthorization)}\n`
    const { binding: previousPlanBinding, ...planContent } = value.importPlan
    const plan = bindImportPlan({
      ...planContent,
      sourceArtifactSha256: sha256(tampered),
      sourceAuthorizationSetSha256: sha256(sourceAuthorizationBytes),
    })
    expect(plan.binding.contentSha256).not.toBe(previousPlanBinding.contentSha256)
    const { binding: previousAuthorizationBinding, ...authorizationContent } =
      value.importAuthorization
    const authorization = bindImportAuthorization({
      ...authorizationContent,
      operationId: plan.operationId,
      batchId: plan.batchId,
      planSha256: plan.binding.contentSha256,
      idempotencyKey: plan.binding.idempotencyKey,
      sourceArtifactSha256: plan.sourceArtifactSha256,
      expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
      expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
      expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    })
    expect(authorization.binding.contentSha256).not.toBe(previousAuthorizationBinding.contentSha256)
    await Promise.all([
      writeFile(value.paths.artifact, tampered),
      writeFile(value.paths.importPlan, JSON.stringify(plan)),
      writeFile(value.paths.importAuthorization, JSON.stringify(authorization)),
      writeFile(value.paths.sourceAuthorizationSet, sourceAuthorizationBytes),
    ])
    const createClient = jest.fn()

    await expect(
      runGoldImportCompensationCli(
        [
          'validate-import',
          '--plan',
          value.paths.importPlan,
          '--authorization',
          value.paths.importAuthorization,
          '--artifact',
          value.paths.artifact,
          '--source-authorization-set',
          value.paths.sourceAuthorizationSet,
        ],
        value.root,
        {
          createClient,
          log: jest.fn(),
          repositoryCommitSha: async () => EXECUTION_CONTEXT.repositoryCommitSha,
        },
      ),
    ).rejects.toThrow('does not match the checksum-bound import plan action')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('makes one exact import RPC call and exclusively journals its strict receipt', async () => {
    const value = await fixture()
    const rpc = jest.fn().mockResolvedValue({ data: value.importReceipt, error: null })
    const { dependencies: supplied, createClient } = dependencies(rpc)
    const receiptPath = join(value.root, 'import-execution-envelope.json')
    const arguments_ = [
      'execute-import',
      '--plan',
      value.paths.importPlan,
      '--authorization',
      value.paths.importAuthorization,
      '--artifact',
      value.paths.artifact,
      '--source-authorization-set',
      value.paths.sourceAuthorizationSet,
      '--receipt',
      receiptPath,
      '--actor-email',
      'executor@example.test',
    ]

    await writeFile(value.paths.sourceAuthorizationSet, 'mismatched source authorization set')
    await expect(runGoldImportCompensationCli(arguments_, value.root, supplied)).rejects.toThrow(
      'Source authorization set checksum mismatch',
    )
    expect(createClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    await writeFile(value.paths.sourceAuthorizationSet, value.sourceAuthorizationSetBytes)

    await expect(
      runGoldImportCompensationCli(arguments_, value.root, {
        ...supplied,
        repositoryCommitSha: async () => 'b'.repeat(40),
      }),
    ).rejects.toThrow('Repository commit attestation mismatch')
    expect(rpc).not.toHaveBeenCalled()

    const result = await runGoldImportCompensationCli(arguments_, value.root, supplied)

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('apply_literature_gold_import_v1', {
      p_operation_id: value.importPlan.operationId,
      p_idempotency_key: value.importPlan.binding.idempotencyKey,
      p_batch_id: value.importPlan.batchId,
      p_artifact_sha256: value.importPlan.sourceArtifactSha256,
      p_plan_sha256: value.importPlan.binding.contentSha256,
      p_plan: value.importPlan,
      p_authorization_sha256: value.importAuthorization.binding.contentSha256,
      p_authorization: value.importAuthorization,
      p_actor_user_id: null,
      p_actor_email: 'executor@example.test',
    })
    expect(result).toMatchObject({ state: 'rpc_response_received', result: value.importReceipt })
    const persisted = JSON.parse(await readFile(receiptPath, 'utf8')) as Record<string, unknown>
    const { binding, ...content } = persisted
    expect((binding as { contentSha256: string }).contentSha256).toBe(sha256Canonical(content))

    await expect(runGoldImportCompensationCli(arguments_, value.root, supplied)).rejects.toThrow(
      'Refusing to overwrite existing receipt path',
    )
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('passes the target import only to the compensation RPC signature', async () => {
    const value = await fixture()
    const rpc = jest.fn().mockResolvedValue({ data: value.compensationReceipt, error: null })
    const { dependencies: supplied } = dependencies(rpc)

    await runGoldImportCompensationCli(
      [
        'execute-compensation',
        '--plan',
        value.paths.compensationPlan,
        '--authorization',
        value.paths.compensationAuthorization,
        '--artifact',
        value.paths.artifact,
        '--receipt',
        join(value.root, 'compensation-execution-envelope.json'),
        '--actor-user-id',
        IDS.compensationAuthorization,
      ],
      value.root,
      supplied,
    )

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith(
      'compensate_literature_gold_import_v1',
      expect.objectContaining({
        p_operation_id: value.compensationPlan.operationId,
        p_target_import_operation_id: value.compensationPlan.targetImportOperationId,
        p_plan_sha256: value.compensationPlan.binding.contentSha256,
        p_authorization_sha256: value.compensationAuthorization.binding.contentSha256,
      }),
    )
  })

  it('treats a terminal receipt with the wrong per-action event as ambiguous', async () => {
    const value = await fixture()
    const importedReviewId = '00000000-0000-4000-8000-000000000011'
    const compensationReviewId = '00000000-0000-4000-8000-000000000012'
    const effectiveSourceReviewId = '00000000-0000-4000-8000-000000000013'
    const plan = bindCompensationPlan({
      contractVersion: 'gold-review-import-compensation/1.0.0',
      kind: 'compensation',
      operationId: '00000000-0000-4000-8000-000000000010',
      targetImportOperationId: value.importPlan.operationId,
      batchId: value.importPlan.batchId,
      importPlanSha256: value.importPlan.binding.contentSha256,
      importReceiptSha256: value.importReceipt.binding.contentSha256,
      sourceArtifactSha256: value.importPlan.sourceArtifactSha256,
      expectedPhysicalStateSha256: value.importReceipt.afterPhysicalStateSha256,
      expectedEffectiveStateSha256: value.importReceipt.afterEffectiveStateSha256,
      expectedPostEffectiveStateSha256: value.importReceipt.beforeEffectiveStateSha256,
      executionContext: EXECUTION_CONTEXT,
      scope: value.importPlan.scope,
      counts: { total: 1, restored: 1, voided: 0, noops: 0 },
      actions: [
        {
          actionId: '00000000-0000-4000-8000-000000000014',
          sourceActionId: value.importPlan.actions[0]!.actionId,
          sequence: 1,
          itemId: IDS.item,
          pmid: '12345678',
          datasetSplit: 'development',
          importedReviewId,
          expectedCurrentReviewId: importedReviewId,
          expectedEffectiveReviewId: importedReviewId,
          action: 'compensate_restore',
          expectedRevision: 2,
          expectedSupersedesReviewId: importedReviewId,
          compensationReviewId,
          effectiveSourceReviewId,
          expectedHeadReviewIdAfter: compensationReviewId,
          expectedEffectiveReviewIdAfter: effectiveSourceReviewId,
          expectedEventSequence: ['review_compensated'],
        },
      ],
    })
    const authorization = bindCompensationAuthorization({
      contractVersion: 'gold-review-import-compensation/1.0.0',
      kind: 'compensation_authorization',
      authorizationId: '00000000-0000-4000-8000-000000000015',
      authorized: true,
      authorizedBy: 'compensation-authorizer@example.test',
      authorizedAt: FIXED_TIME,
      authorizationNote: 'Exact restore event authorization.',
      targetDatabase: 'local',
      remoteWritesAllowed: false,
      repositoryCommitSha: EXECUTION_CONTEXT.repositoryCommitSha,
      migrationId: EXECUTION_CONTEXT.migrationId,
      operationId: plan.operationId,
      targetImportOperationId: plan.targetImportOperationId,
      batchId: plan.batchId,
      planSha256: plan.binding.contentSha256,
      idempotencyKey: plan.binding.idempotencyKey,
      importReceiptSha256: plan.importReceiptSha256,
      sourceArtifactSha256: plan.sourceArtifactSha256,
      expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
      expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
      expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    })
    const malformedReceipt = bindReceipt({
      contractVersion: 'gold-review-import-compensation/1.0.0' as const,
      kind: 'compensation_receipt' as const,
      operationId: plan.operationId,
      targetImportOperationId: plan.targetImportOperationId,
      batchId: plan.batchId,
      planSha256: plan.binding.contentSha256,
      idempotencyKey: plan.binding.idempotencyKey,
      outcome: 'committed' as const,
      response: 'applied' as const,
      beforePhysicalStateSha256: plan.expectedPhysicalStateSha256,
      afterPhysicalStateSha256: sha256('physical-after-wrong-event'),
      beforeEffectiveStateSha256: plan.expectedEffectiveStateSha256,
      afterEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
      counts: { planned: 1, applied: 1, noops: 0 },
      eventSequence: [
        'import_compensation_started',
        'review_voided',
        'import_compensation_completed',
      ] as const,
      error: null,
    })
    const planPath = join(value.root, 'restore-plan.json')
    const authorizationPath = join(value.root, 'restore-authorization.json')
    const receiptPath = join(value.root, 'wrong-event-envelope.json')
    await Promise.all([
      writeFile(planPath, JSON.stringify(plan)),
      writeFile(authorizationPath, JSON.stringify(authorization)),
    ])
    const rpc = jest.fn().mockResolvedValue({ data: malformedReceipt, error: null })
    const { dependencies: supplied } = dependencies(rpc)

    await expect(
      runGoldImportCompensationCli(
        [
          'execute-compensation',
          '--plan',
          planPath,
          '--authorization',
          authorizationPath,
          '--artifact',
          value.paths.artifact,
          '--receipt',
          receiptPath,
          '--actor-email',
          'executor@example.test',
        ],
        value.root,
        supplied,
      ),
    ).rejects.toThrow('RPC result is ambiguous')
    expect(JSON.parse(await readFile(receiptPath, 'utf8'))).toMatchObject({
      state: 'rpc_outcome_ambiguous',
    })
  })

  it('records ambiguity after one thrown RPC and refuses remote targets', async () => {
    const value = await fixture()
    const rpc = jest.fn().mockRejectedValue(new Error('connection reset after send'))
    const { dependencies: supplied } = dependencies(rpc)
    const receiptPath = join(value.root, 'ambiguous-envelope.json')
    const base = [
      'execute-import',
      '--plan',
      value.paths.importPlan,
      '--authorization',
      value.paths.importAuthorization,
      '--artifact',
      value.paths.artifact,
      '--source-authorization-set',
      value.paths.sourceAuthorizationSet,
      '--receipt',
      receiptPath,
      '--actor-email',
      'executor@example.test',
    ]

    await expect(runGoldImportCompensationCli(base, value.root, supplied)).rejects.toThrow(
      'do not retry automatically',
    )
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(JSON.parse(await readFile(receiptPath, 'utf8'))).toMatchObject({
      operationId: value.importPlan.operationId,
      state: 'rpc_outcome_ambiguous',
    })

    await expect(
      runGoldImportCompensationCli(
        [...base.slice(0, -2), '--target', 'remote', '--actor-email', 'executor@example.test'],
        value.root,
        supplied,
      ),
    ).rejects.toThrow('Remote targets are unsupported')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['08006', 'rpc_outcome_ambiguous', 'reconcile'],
    ['40003', 'rpc_outcome_ambiguous', 'reconcile'],
    ['P7604', 'rpc_rejected', 'database rejected'],
  ] as const)(
    'classifies SQLSTATE %s without assuming commit failure',
    async (code, state, message) => {
      const value = await fixture()
      const rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code, message: `simulated ${code}` },
      })
      const { dependencies: supplied } = dependencies(rpc)
      const receiptPath = join(value.root, `${code}-envelope.json`)

      await expect(
        runGoldImportCompensationCli(
          [
            'execute-import',
            '--plan',
            value.paths.importPlan,
            '--authorization',
            value.paths.importAuthorization,
            '--artifact',
            value.paths.artifact,
            '--source-authorization-set',
            value.paths.sourceAuthorizationSet,
            '--receipt',
            receiptPath,
            '--actor-email',
            'executor@example.test',
          ],
          value.root,
          supplied,
        ),
      ).rejects.toThrow(message)
      expect(rpc).toHaveBeenCalledTimes(1)
      expect(JSON.parse(await readFile(receiptPath, 'utf8'))).toMatchObject({ state })
    },
  )

  it('reconciles with one non-mutating recovery RPC call', async () => {
    const value = await fixture()
    const rpc = jest.fn().mockResolvedValue({ data: value.importReceipt, error: null })
    const { dependencies: supplied } = dependencies(rpc)

    await expect(
      runGoldImportCompensationCli(
        [
          'reconcile',
          '--operation-id',
          value.importPlan.operationId,
          '--recovery-authorization',
          value.paths.recoveryAuthorization,
        ],
        value.root,
        { ...supplied, repositoryCommitSha: async () => 'b'.repeat(40) },
      ),
    ).rejects.toThrow('Repository commit attestation mismatch')
    expect(rpc).not.toHaveBeenCalled()

    const result = await runGoldImportCompensationCli(
      [
        'reconcile',
        '--operation-id',
        value.importPlan.operationId,
        '--recovery-authorization',
        value.paths.recoveryAuthorization,
      ],
      value.root,
      supplied,
    )

    expect(result).toMatchObject({
      command: 'reconcile',
      responseKind: 'terminal_receipt',
      authorization: { permitsMutation: false },
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('reconcile_literature_gold_review_operation_v1', {
      p_operation_id: value.importPlan.operationId,
      p_recovery_authorization_sha256: value.recoveryAuthorization.binding.contentSha256,
      p_recovery_authorization: value.recoveryAuthorization,
    })
  })
})
