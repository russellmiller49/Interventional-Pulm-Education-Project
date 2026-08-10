/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
  bindImportAuthorizationV2,
  bindImportPlanV2,
  goldReviewPayloadV2Schema,
  parseImportPlanV2,
  type GoldReviewPayloadV2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  goldReviewPayloadSchema,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  V2_MIGRATION_REQUIRED_BEFORE_SOURCE_OR_CLIENT,
  prepareGoldImportCompensationV2Runtime,
  validateReadyGoldImportCompensationV2Audit,
} from './audit-gold-import-compensation-v2'
import {
  buildContractInvariantIdentity,
  buildDeploymentProfileIdentity,
} from './gold-import-compensation-contract-reconciliation'
import {
  buildExpectedPostImportEffectiveStateProjectionV2,
  validateAndSnapshotDevelopmentPlanningStateV2,
  deriveExpectedPostImportEffectiveStateSha256V2,
  deriveImportActionCountsV2,
  type PackagePlanningRowV2,
} from './generate-gold-import-compensation-package-v2'
import {
  GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
  assertExactIndependentlyDerivedImportPlanV4,
  buildGoldImportSourceAuthorizationSetV4,
  canonicalGoldImportSourceAuthorizationSetV4Bytes,
  parseCanonicalGoldImportSourceAuthorizationSetV4Bytes,
  validateGoldImportSourceAuthorizationSetV4,
} from './gold-import-source-authorization-v4'
import {
  GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
  validateNoteDispositionEvidenceChecksumsV2ForTest,
  type NoteDispositionEvidenceBytesV2,
  type NoteDispositionEvidenceIdentitiesV2,
} from './gold-import-note-disposition-gate-v2'
import {
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  decodeProtectedV2CatalogExpectedInventories,
  expectedObservedAuditIdentityFromArtifact,
  type ProtectedV2ExpectedCatalogProfileId,
  type ProtectedV2ExpectedCatalogTarget,
} from './gold-import-contract-v2-catalog-expectations'
import { buildProtectedV2ExpectedCatalogBinding } from './protected-gold-import-contract-v2-bindings'
import { validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile } from './gold-import-contract-v2-catalog-audit'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const BATCH_ID = '10000000-0000-4000-8000-000000000001'
const ITEM_ID = '20000000-0000-4000-8000-000000000001'
const ACTION_ID = '30000000-0000-4000-8000-000000000001'
const REVIEW_ID = '40000000-0000-4000-8000-000000000001'
const TIME = '2026-08-08T00:00:00.000Z'
const LOCAL_EXPECTED_CATALOG = buildProtectedV2ExpectedCatalogBinding(
  'local_supabase_postgres_owner_v1',
  'local',
)
const LOCAL_COMPLETE_CATALOG_AUDIT =
  validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    expectedObservedAuditIdentityFromArtifact(
      committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
        'local_supabase_postgres_owner_v1',
        'local',
      ),
    ),
    'local_supabase_postgres_owner_v1',
    'local',
  )

function includedReview() {
  return {
    categorizationFromFullText: false,
    clinicalPurposes: ['diagnosis'],
    completedAt: TIME,
    createdAt: TIME,
    diseaseTagStatus: 'not_applicable' as const,
    diseaseTags: [],
    enrichmentProvenance: 'physician_confirmed_ai_enrichment',
    enrichmentSchemaVersion: '3.0.2',
    fullTextUsed: true,
    isBlinded: false,
    labelSchemaVersion: '3.0.0',
    metadataSufficiency: 'adequate_abstract' as const,
    notes: 'Source note.',
    publicationStatus: 'full-article' as const,
    relevanceLabel: 'include_core' as const,
    reviewerConfidence: 'high' as const,
    reviewerEmail: null,
    reviewerUserId: null,
    reviewSeconds: 0,
    startedAt: TIME,
    studyDesign: 'retrospective-cohort' as const,
    taxonomyVersion: '2.0.0',
    technologyTagStatus: 'not_applicable' as const,
    technologyTags: [],
    topicIds: ['basic-bronchoscopy'],
    usedSupplementalMetadata: false,
  }
}

function excludedReview() {
  return {
    ...includedReview(),
    categorizationFromFullText: false,
    clinicalPurposes: [],
    diseaseTagStatus: null,
    diseaseTags: [],
    publicationStatus: null,
    relevanceLabel: 'exclude' as const,
    studyDesign: null,
    technologyTagStatus: null,
    technologyTags: [],
    topicIds: [],
  }
}

function importPlan(
  review: GoldReviewPayloadV2 = goldReviewPayloadV2Schema.parse(includedReview()),
) {
  return bindImportPlanV2({
    actions: [
      {
        action: 'import_initial',
        actionId: ACTION_ID,
        compensationAction: 'compensate_void',
        datasetSplit: 'development',
        expectedCurrentReviewId: null,
        expectedEffectiveReviewId: null,
        expectedEffectiveReviewIdAfter: REVIEW_ID,
        expectedEventSequence: ['review_imported'],
        expectedHeadReviewIdAfter: REVIEW_ID,
        expectedRevision: 1,
        expectedSupersedesReviewId: null,
        importedReviewId: REVIEW_ID,
        itemId: ITEM_ID,
        pmid: '12345',
        preImportItemState: {
          automatedSignalsRevealedAt: null,
          completedAt: null,
          reviewStatus: 'pending',
          startedAt: null,
          supplementalMetadataRevealedAt: null,
        },
        review,
        reviewSha256: createHash('sha256')
          .update(JSON.stringify(Object.fromEntries(Object.entries(review).sort())))
          .digest('hex'),
        sequence: 1,
      },
    ],
    batchId: BATCH_ID,
    booleanNormalizationLedgerSha256: SHA_A,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    counts: { initial: 1, inserts: 1, noops: 0, revisions: 0, total: 1 },
    executionContext: {
      compensationRpc: 'compensate_literature_gold_import_v2',
      developmentMembershipHash: 'literature_gold_development_membership_hash_v1',
      effectiveStateHash: 'literature_gold_effective_state_hash_v2',
      importRpc: 'apply_literature_gold_import_v2',
      migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      physicalStateHash: 'literature_gold_physical_state_hash_v2',
      reconciliationRpc: 'reconcile_literature_gold_review_operation_v2',
      remoteWritesAllowed: false,
      repositoryCommitSha: '1'.repeat(40),
      targetDatabase: 'local',
    },
    expectedEffectiveStateSha256: SHA_A,
    expectedPhysicalStateSha256: SHA_B,
    expectedPostEffectiveStateSha256: 'c'.repeat(64),
    kind: 'import',
    noteDispositionAuditSha256: 'd'.repeat(64),
    operationId: '50000000-0000-4000-8000-000000000001',
    orderedSetNormalizationLedgerSha256: 'e'.repeat(64),
    scope: {
      datasetSplit: 'development',
      developmentMembershipSha256:
        GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256,
      heldOutIdentitiesAccessed: false,
    },
    sourceArtifactSha256: 'f'.repeat(64),
    sourceAuthorizationSetSha256: '1'.repeat(64),
  })
}

describe('V2 authenticated planning-state evidence', () => {
  it('preserves the authenticated source while using its defaulted projection for planning', () => {
    const raw = {
      datasetSplit: 'development' as const,
      rows: [
        {
          currentEffectiveReview: includedReview(),
          currentReviewId: REVIEW_ID,
          currentRevision: 1,
          datasetSplit: 'development' as const,
          displayOrder: 0,
          effectiveReviewId: REVIEW_ID,
          itemId: ITEM_ID,
          itemState: {
            automatedSignalsRevealedAt: null,
            completedAt: TIME,
            reviewStatus: 'completed' as const,
            startedAt: TIME,
            supplementalMetadataRevealedAt: null,
          },
          pmid: '12345',
          sequence: 1,
        },
      ],
      schemaVersion: 'gold-import-compensation-development-planning-state/1.0.0' as const,
    }
    const validated = validateAndSnapshotDevelopmentPlanningStateV2(raw)

    expect(validated.projection.rows[0]?.currentEffectiveReview).toMatchObject({
      operationContractVersion: null,
    })
    expect(validated.authenticatedSource.rows[0]?.currentEffectiveReview).not.toHaveProperty(
      'operationContractVersion',
    )
    expect(sha256Canonical(validated.authenticatedSource)).toBe(sha256Canonical(raw))
    expect(sha256Canonical(validated.projection)).not.toBe(sha256Canonical(raw))
    expect(Object.isFrozen(validated.authenticatedSource)).toBe(true)
    expect(Object.isFrozen(validated.projection)).toBe(true)
  })
})

describe('V2 authorization wire contract', () => {
  it('uses the SQL-compatible authorizedAt/authorizedBy field names', () => {
    const plan = importPlan()
    const authorization = bindImportAuthorizationV2({
      authorized: true,
      authorizedAt: TIME,
      authorizedBy: 'disposable-v2-test@example.invalid',
      authorizationId: '60000000-0000-4000-8000-000000000001',
      authorizationNote: 'Disposable V2 wire-contract test only.',
      batchId: plan.batchId,
      booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
      contractVersion: plan.contractVersion,
      expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
      expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
      idempotencyKey: plan.binding.idempotencyKey,
      kind: 'import_authorization',
      migrationId: plan.executionContext.migrationId,
      noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
      operationId: plan.operationId,
      orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
      planSha256: plan.binding.contentSha256,
      remoteWritesAllowed: false,
      repositoryCommitSha: plan.executionContext.repositoryCommitSha,
      sourceArtifactSha256: plan.sourceArtifactSha256,
      sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
      targetDatabase: 'local',
    })
    expect(authorization).toMatchObject({
      authorizedAt: TIME,
      authorizedBy: 'disposable-v2-test@example.invalid',
    })
    expect(authorization).not.toHaveProperty('authorizationAt')
    expect(authorization).not.toHaveProperty('authorizationBy')
    const migration = readFileSync(
      resolve(
        'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
      ),
      'utf8',
    )
    expect(migration).toContain("'authorizedAt', 'authorizationNote'")
    expect(migration).toContain("'authorizationId', 'authorized', 'authorizedBy'")
  })
})

describe('V2 review and plan contract', () => {
  it('keeps full-text, supplemental-metadata, categorization, and source blinding independent', () => {
    const parsed = goldReviewPayloadV2Schema.parse(includedReview())
    expect(parsed).toMatchObject({
      categorizationFromFullText: false,
      fullTextUsed: true,
      isBlinded: false,
      usedSupplementalMetadata: false,
    })
    const plan = importPlan(parsed)
    expect(parseImportPlanV2(plan).actions[0]).toMatchObject({
      preImportItemState: { automatedSignalsRevealedAt: null },
      review: { isBlinded: false },
    })
  })

  it('admits only the exact source-null formal excluded shape', () => {
    expect(goldReviewPayloadV2Schema.safeParse(excludedReview()).success).toBe(true)
    expect(
      goldReviewPayloadV2Schema.safeParse({
        ...excludedReview(),
        technologyTagStatus: 'not_applicable',
      }).success,
    ).toBe(false)
    expect(
      goldReviewPayloadV2Schema.safeParse({
        ...excludedReview(),
        technologyTags: ['convex-ebus'],
      }).success,
    ).toBe(false)
    expect(
      goldReviewPayloadV2Schema.safeParse({ ...includedReview(), diseaseTagStatus: null }).success,
    ).toBe(false)
  })

  it('requires non-null fullTextUsed without changing V1 validation', () => {
    expect(
      goldReviewPayloadV2Schema.safeParse({ ...includedReview(), fullTextUsed: null }).success,
    ).toBe(false)
    const v1 = { ...includedReview() } as Record<string, unknown>
    delete v1.fullTextUsed
    expect(goldReviewPayloadSchema.safeParse({ ...v1, isBlinded: true }).success).toBe(true)
    expect(goldReviewPayloadSchema.safeParse(excludedReview()).success).toBe(false)
  })

  it('derives arbitrary action counts instead of pinning the observed partition', () => {
    const base = {
      expectedCurrentReviewId: null,
      expectedEffectiveReviewId: null,
      expectedRevision: 1,
      expectedSupersedesReviewId: null,
      itemId: ITEM_ID,
      pmid: '1',
      preImportItemState: {
        automatedSignalsRevealedAt: null,
        completedAt: null,
        reviewStatus: 'pending' as const,
        startedAt: null,
        supplementalMetadataRevealedAt: null,
      },
      sequence: 1,
      targetReview: goldReviewPayloadV2Schema.parse(includedReview()),
    }
    const rows = [
      { ...base, action: 'import_initial' as const },
      {
        ...base,
        action: 'import_revision' as const,
        expectedCurrentReviewId: REVIEW_ID,
        expectedEffectiveReviewId: REVIEW_ID,
        expectedRevision: 2,
        expectedSupersedesReviewId: REVIEW_ID,
        itemId: '20000000-0000-4000-8000-000000000002',
        pmid: '2',
        sequence: 2,
      },
      {
        ...base,
        action: 'import_noop' as const,
        expectedCurrentReviewId: REVIEW_ID,
        expectedEffectiveReviewId: REVIEW_ID,
        expectedRevision: null,
        itemId: '20000000-0000-4000-8000-000000000003',
        pmid: '3',
        sequence: 3,
      },
    ] satisfies PackagePlanningRowV2[]
    expect(deriveImportActionCountsV2(rows)).toEqual({
      initial: 1,
      inserts: 2,
      noops: 1,
      revisions: 1,
      total: 3,
    })
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/literature/generate-gold-import-compensation-package-v2.ts'),
      'utf8',
    )
    expect(source).not.toContain('621')
    expect(source).not.toContain('revisions: 9')
    expect(source).not.toContain('noops: 0')
  })

  it('derives the V2 post-import target from the candidate projection', () => {
    const base = {
      expectedCurrentReviewId: null,
      expectedEffectiveReviewId: null,
      expectedRevision: 1,
      expectedSupersedesReviewId: null,
      preImportItemState: {
        automatedSignalsRevealedAt: null,
        completedAt: null,
        reviewStatus: 'pending' as const,
        startedAt: null,
        supplementalMetadataRevealedAt: null,
      },
      targetReview: goldReviewPayloadV2Schema.parse(includedReview()),
    }
    const rows = [
      {
        ...base,
        action: 'import_initial' as const,
        itemId: '20000000-0000-4000-8000-000000000002',
        pmid: '10',
        sequence: 2,
      },
      {
        ...base,
        action: 'import_initial' as const,
        itemId: ITEM_ID,
        pmid: '2',
        sequence: 1,
      },
    ] satisfies PackagePlanningRowV2[]
    const projection = buildExpectedPostImportEffectiveStateProjectionV2(rows)
    expect(projection).toMatchObject({
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
      datasetSplit: 'development',
      projectionVersion: 'literature-gold-effective-state-v2',
    })
    expect(projection.items.map(({ pmid, reviewStatus }) => ({ pmid, reviewStatus }))).toEqual([
      { pmid: '2', reviewStatus: 'completed' },
      { pmid: '10', reviewStatus: 'completed' },
    ])
    expect(deriveExpectedPostImportEffectiveStateSha256V2(rows)).toBe(sha256Canonical(projection))
  })
})

function migrationProbe(v2Occurrence: number) {
  return {
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    database: { batchId: BATCH_ID, ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 },
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: SHA_A,
      v1Occurrence: 1,
      v2Occurrence,
    },
    safety: {
      heldOutIdentitiesAccessed: false,
      readOnly: true,
      remoteAccess: false,
      remoteWritesAllowed: false,
      repeatableRead: true,
    },
    schemaVersion: 'gold-import-compensation-v2-package-audit/1.0.0',
    target: 'local',
  }
}

function readyAudit() {
  const invariant = { schemaVersion: 'fixture-invariant' }
  const profile = { schemaVersion: 'fixture-profile' }
  const hash = (value: unknown) =>
    createHash('sha256')
      .update(JSON.stringify(Object.fromEntries(Object.entries(value as object).sort())))
      .digest('hex')
  return {
    ...migrationProbe(1),
    contractAudit: {
      appendOnlyProtectionsReady: true,
      environmentInvariantIdentity: invariant,
      environmentInvariantIdentitySha256: hash(invariant),
      environmentProfileIdentity: profile,
      environmentProfileIdentitySha256: hash(profile),
      ownerAclReady: true,
      rpcBoundaryReady: true,
      safeSearchPathsReady: true,
    },
    exactExistingHeadCohort: {
      cohortSha256: GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
      headCount: 9,
    },
    expectedPostImportEffectiveStateSha256: SHA_B,
    repositoryCommitSha: '1'.repeat(40),
    stateMutationEvidence: {
      effectiveStateChanged: false,
      itemRevealTimestampMutationCount: 0,
      pointerMutationCount: 0,
      reviewRowMutationCount: 0,
    },
    testSplitLocked: true,
    v2PreImportState: { effectiveStateSha256: SHA_A, physicalStateSha256: SHA_B },
  }
}

function exactReadyAudit(
  profileId: ProtectedV2ExpectedCatalogProfileId,
  target: ProtectedV2ExpectedCatalogTarget,
) {
  const artifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(profileId, target)
  const inventories = decodeProtectedV2CatalogExpectedInventories(artifact)
  const fullEnvironmentInventory = inventories.fullEnvironmentInventory as {
    deploymentProfile: Parameters<typeof buildDeploymentProfileIdentity>[2]
    rpcs: Parameters<typeof buildContractInvariantIdentity>[1]
    schemaSecurityDefinitionIdentity: Parameters<typeof buildContractInvariantIdentity>[0]
  }
  const environmentInvariantIdentity = buildContractInvariantIdentity(
    fullEnvironmentInventory.schemaSecurityDefinitionIdentity,
    fullEnvironmentInventory.rpcs,
  )
  const environmentProfileIdentity = buildDeploymentProfileIdentity(
    fullEnvironmentInventory.schemaSecurityDefinitionIdentity,
    fullEnvironmentInventory.rpcs,
    fullEnvironmentInventory.deploymentProfile,
  )
  const completeCatalogAudit = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    expectedObservedAuditIdentityFromArtifact(artifact),
    profileId,
    target,
  )
  return {
    completeCatalogAudit,
    contractAudit: {
      appendOnlyProtectionsReady: true,
      deploymentProfileEvidence: fullEnvironmentInventory.deploymentProfile,
      environmentInvariantIdentity,
      environmentInvariantIdentitySha256: sha256Canonical(environmentInvariantIdentity),
      environmentProfileIdentity,
      environmentProfileIdentitySha256: sha256Canonical(environmentProfileIdentity),
      ownerAclReady: true,
      rpcMetadata: fullEnvironmentInventory.rpcs,
      rpcBoundaryReady: true,
      safeSearchPathsReady: true,
      schemaSecurityDefinitionIdentity: fullEnvironmentInventory.schemaSecurityDefinitionIdentity,
    },
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    database: { batchId: BATCH_ID, ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 },
    exactExistingHeadCohort: {
      cohortSha256: GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
      headCount: 9,
    },
    expectedCatalog: buildProtectedV2ExpectedCatalogBinding(profileId, target),
    expectedPostImportEffectiveStateSha256: SHA_B,
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: artifact.migration.sha256,
      v1Occurrence: 1,
      v2Occurrence: 1,
    },
    repositoryCommitSha: '1'.repeat(40),
    safety: {
      heldOutIdentitiesAccessed: false,
      readOnly: true,
      remoteAccess: false,
      remoteWritesAllowed: false,
      repeatableRead: true,
    },
    schemaVersion: 'gold-import-compensation-v2-package-audit/1.0.0' as const,
    stateIntegrity: {
      currentPointersAreLatestHeads: true,
      revisionChainsLinear: true,
    },
    stateMutationEvidence: {
      effectiveStateChanged: false,
      itemRevealTimestampMutationCount: 0,
      pointerMutationCount: 0,
      reviewRowMutationCount: 0,
    },
    target: target === 'local' ? ('local' as const) : ('disposable_clone' as const),
    testSplitLocked: true,
    v2PreImportState: { effectiveStateSha256: SHA_A, physicalStateSha256: SHA_B },
  }
}

describe('migration-first and source-authorization-before-client ordering', () => {
  it.each([
    ['local_supabase_postgres_owner_v1', 'local'],
    ['supabase_admin_owner_v1', 'disposable'],
  ] as const)('validates the complete exact %s ready audit', (profileId, target) => {
    const audit = exactReadyAudit(profileId, target)
    expect(validateReadyGoldImportCompensationV2Audit(audit)).toMatchObject({
      completeCatalogAudit: audit.completeCatalogAudit,
      expectedCatalog: audit.expectedCatalog,
      target: target === 'local' ? 'local' : 'disposable_clone',
    })
  })

  it('rejects cross-profile expected-state use at the production ready-audit gate', () => {
    const local = exactReadyAudit('local_supabase_postgres_owner_v1', 'local')
    const disposable = exactReadyAudit('supabase_admin_owner_v1', 'disposable')
    expect(() =>
      validateReadyGoldImportCompensationV2Audit({
        ...local,
        completeCatalogAudit: disposable.completeCatalogAudit,
        expectedCatalog: disposable.expectedCatalog,
      }),
    ).toThrow('does not match exact local_supabase_postgres_owner_v1/local contract')
    expect(() =>
      validateReadyGoldImportCompensationV2Audit({
        ...disposable,
        completeCatalogAudit: local.completeCatalogAudit,
        expectedCatalog: local.expectedCatalog,
      }),
    ).toThrow('does not match exact supabase_admin_owner_v1/disposable contract')
  })

  it('does not read sources or create a client when V2 is absent', async () => {
    const calls = { client: 0, source: 0, validation: 0 }
    await expect(
      prepareGoldImportCompensationV2Runtime({
        createDatabaseClient: () => {
          calls.client += 1
          return {}
        },
        readMigrationProbe: () => migrationProbe(0),
        readSourceArtifacts: () => {
          calls.source += 1
          return {}
        },
        validateSourceAuthorization: () => {
          calls.validation += 1
          return {}
        },
      }),
    ).rejects.toThrow(V2_MIGRATION_REQUIRED_BEFORE_SOURCE_OR_CLIENT)
    expect(calls).toEqual({ client: 0, source: 0, validation: 0 })
  })

  it('does not construct a client when source authorization revalidation fails', async () => {
    const calls = { client: 0, source: 0, validation: 0 }
    await expect(
      prepareGoldImportCompensationV2Runtime({
        createDatabaseClient: () => {
          calls.client += 1
          return {}
        },
        readMigrationProbe: readyAudit,
        readSourceArtifacts: () => {
          calls.source += 1
          return {}
        },
        validateSourceAuthorization: () => {
          calls.validation += 1
          throw new Error('source authorization drift')
        },
        validateReadyAuditForTest: () => readyAudit() as never,
      }),
    ).rejects.toThrow('source authorization drift')
    expect(calls).toEqual({ client: 0, source: 1, validation: 1 })
  })
})

function hash(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

describe('exact two-note evidence byte gates', () => {
  const evidence: NoteDispositionEvidenceBytesV2 = {
    amendedAuthorizationBytes: Buffer.from('amended-json'),
    amendedAuthorizationExactTextBytes: Buffer.from('exact-text'),
    authorizationManifestBytes: Buffer.from('manifest'),
    authorizationMappingBytes: Buffer.from('mapping'),
    authorizationMappingCorrectionBytes: Buffer.from('mapping-correction'),
    authorizationMappingCorrectionManifestBytes: Buffer.from('correction-manifest'),
  }
  const expected: NoteDispositionEvidenceIdentitiesV2 = {
    amendedAuthorizationSha256: hash(evidence.amendedAuthorizationBytes),
    amendedAuthorizationExactTextSha256: hash(evidence.amendedAuthorizationExactTextBytes),
    authorizationManifestSha256: hash(evidence.authorizationManifestBytes),
    authorizationMappingSha256: hash(evidence.authorizationMappingBytes),
    authorizationMappingCorrectionSha256: hash(evidence.authorizationMappingCorrectionBytes),
    authorizationMappingCorrectionManifestSha256: hash(
      evidence.authorizationMappingCorrectionManifestBytes,
    ),
  }

  it('requires each exact authorization, mapping, and manifest identity', () => {
    expect(() =>
      validateNoteDispositionEvidenceChecksumsV2ForTest(evidence, expected),
    ).not.toThrow()
    for (const key of Object.keys(evidence) as Array<keyof NoteDispositionEvidenceBytesV2>) {
      expect(() =>
        validateNoteDispositionEvidenceChecksumsV2ForTest(
          { ...evidence, [key]: Buffer.concat([Buffer.from(evidence[key]), Buffer.from('x')]) },
          expected,
        ),
      ).toThrow('checksum drifted')
    }
  })
})

describe('source authorization V4', () => {
  function authorizationSet() {
    return buildGoldImportSourceAuthorizationSetV4({
      actionCounts: { initial: 1, inserts: 1, noops: 0, revisions: 0, total: 1 },
      auditTarget: 'local',
      batchId: BATCH_ID,
      booleanNormalizationLedger: [
        {
          canonicalLexeme: 'true',
          classification: 'deterministic_lexical_normalization',
          column: 'full_text_used',
          normalizationRuleVersion: 'finalized-v3-exact-boolean-lexeme/1.0.0',
          originalLexeme: 'True',
          semanticValue: true,
          sourceArtifactSha256: '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59',
          sourceForm: 'legacy_title_case',
          sourceIdentity: {
            datasetSplit: 'development',
            itemId: ITEM_ID,
            masterRowId: '1',
            pmid: '1',
          },
        },
      ],
      completeCatalogAudit: LOCAL_COMPLETE_CATALOG_AUDIT,
      environmentInvariantIdentitySha256: LOCAL_EXPECTED_CATALOG.environmentInvariantIdentitySha256,
      environmentProfileIdentitySha256:
        LOCAL_EXPECTED_CATALOG.expectedDeploymentProfileIdentitySha256,
      existingHeadCohortSha256: GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
      expectedCatalog: LOCAL_EXPECTED_CATALOG,
      migrationSha256: 'c'.repeat(64),
      orderedSetNormalizationLedger: [],
      v2PreImportEffectiveStateSha256: 'd'.repeat(64),
      v2PreImportPhysicalStateSha256: 'e'.repeat(64),
    })
  }

  it('is strict, supplement-free, canonical, and pinned to the exact nine-head cohort', () => {
    const authorization = authorizationSet()
    expect(authorization.version).toBe(4)
    expect('supplement' in authorization).toBe(false)
    expect('optionalTagStatusResolutions' in authorization).toBe(false)
    expect(() =>
      validateGoldImportSourceAuthorizationSetV4({
        ...authorization,
        optionalTagStatusResolutions: [],
      }),
    ).toThrow()
    const bytes = canonicalGoldImportSourceAuthorizationSetV4Bytes(authorization)
    expect(parseCanonicalGoldImportSourceAuthorizationSetV4Bytes(bytes)).toEqual(authorization)
    expect(() =>
      parseCanonicalGoldImportSourceAuthorizationSetV4Bytes(
        Buffer.concat([bytes, Buffer.from('\n')]),
      ),
    ).toThrow('strict canonical')
    expect(() =>
      buildGoldImportSourceAuthorizationSetV4({
        actionCounts: authorization.actionCounts,
        auditTarget: 'local',
        batchId: BATCH_ID,
        booleanNormalizationLedger: authorization.booleanNormalizationLedger,
        completeCatalogAudit: LOCAL_COMPLETE_CATALOG_AUDIT,
        environmentInvariantIdentitySha256:
          LOCAL_EXPECTED_CATALOG.environmentInvariantIdentitySha256,
        environmentProfileIdentitySha256:
          LOCAL_EXPECTED_CATALOG.expectedDeploymentProfileIdentitySha256,
        existingHeadCohortSha256: SHA_A,
        expectedCatalog: LOCAL_EXPECTED_CATALOG,
        migrationSha256: 'c'.repeat(64),
        orderedSetNormalizationLedger: [],
        v2PreImportEffectiveStateSha256: 'd'.repeat(64),
        v2PreImportPhysicalStateSha256: 'e'.repeat(64),
      }),
    ).toThrow('nine-head cohort')
  })

  it('rejects a fully rebound plan whose source decision differs from the regenerated plan', () => {
    const expected = importPlan()
    const changedReview = goldReviewPayloadV2Schema.parse({
      ...includedReview(),
      notes: 'Different but otherwise V2-valid source decision.',
    })
    const rebound = importPlan(changedReview)
    expect(rebound.binding.contentSha256).not.toBe(expected.binding.contentSha256)
    expect(() =>
      assertExactIndependentlyDerivedImportPlanV4({
        independentlyDerivedPlan: expected,
        plan: rebound,
      }),
    ).toThrow('independently derived source/planning candidate')
    expect(
      assertExactIndependentlyDerivedImportPlanV4({
        independentlyDerivedPlan: expected,
        plan: expected,
      }),
    ).toEqual(expected)
  })
})
