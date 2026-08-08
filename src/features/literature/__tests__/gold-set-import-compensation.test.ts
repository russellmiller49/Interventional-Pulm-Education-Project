import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
  LEGACY_POINTER_REWIND_ERROR,
  appendOrdinaryReviewRehearsal,
  assertLinearRevisionChains,
  bindCompensationAuthorization,
  bindCompensationPlan,
  bindImportAuthorization,
  bindImportPlan,
  bindRecoveryAuthorization,
  canonicalJson,
  createImportCompensationRehearsal,
  developmentMembershipHash,
  developmentMembershipProjection,
  effectiveStateHash,
  executeCompensationRehearsal,
  executeImportRehearsal,
  goldReviewClinicalProjection,
  goldReviewPayloadSchema,
  parseCompensationPlan,
  parseImportPlan,
  parseRecoveryAuthorization,
  rehearsalPhysicalStateHash,
  rehearsalPhysicalStateProjection,
  rejectLegacyPointerRewindRollback,
  sha256Canonical,
  validateImportBundle,
  type CompensationAction,
  type GoldReviewPayload,
  type ImportAction,
  type ImportCompensationRehearsal,
  type ImportPlan,
} from '@/features/literature/gold-set/import-compensation'

const BATCH_ID = '30000000-0000-4000-8000-000000000001'
const ARTIFACT_SHA = 'a'.repeat(64)
const AUTH_SET_SHA = 'b'.repeat(64)
const NOW = '2026-08-08T12:00:00.000Z'
const REPOSITORY_SHA = 'd'.repeat(40)
const EXECUTION_CONTEXT = {
  targetDatabase: 'local' as const,
  remoteWritesAllowed: false as const,
  repositoryCommitSha: REPOSITORY_SHA,
  migrationId: '20260808035633_add_literature_gold_import_compensation_contract' as const,
  importRpc: 'apply_literature_gold_import_v1' as const,
  compensationRpc: 'compensate_literature_gold_import_v1' as const,
  reconciliationRpc: 'reconcile_literature_gold_review_operation_v1' as const,
  developmentMembershipHash: 'literature_gold_development_membership_hash_v1' as const,
  physicalStateHash: 'literature_gold_physical_state_hash_v1' as const,
  effectiveStateHash: 'literature_gold_effective_state_hash_v1' as const,
}
const AUTH_EXECUTION = {
  targetDatabase: 'local' as const,
  remoteWritesAllowed: false as const,
  repositoryCommitSha: REPOSITORY_SHA,
  migrationId: '20260808035633_add_literature_gold_import_compensation_contract' as const,
}

function id(group: number, index: number) {
  return `${String(group).padStart(8, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function payload(
  seed: string,
  relevanceLabel: GoldReviewPayload['relevanceLabel'] = 'include_core',
) {
  const included = relevanceLabel === 'include_core' || relevanceLabel === 'include_adjacent'
  return {
    relevanceLabel,
    metadataSufficiency: 'adequate_abstract' as const,
    reviewerConfidence: 'high' as const,
    topicIds: included ? ['basic-bronchoscopy'] : [],
    technologyTags: included ? ['convex-ebus'] : [],
    technologyTagStatus: included ? ('tagged' as const) : ('not_applicable' as const),
    clinicalPurposes: included ? ['diagnosis'] : [],
    diseaseTags: included ? ['lung-cancer'] : [],
    diseaseTagStatus: included ? ('tagged' as const) : ('not_applicable' as const),
    studyDesign: included ? 'diagnostic-accuracy' : null,
    publicationStatus: included ? 'full-article' : null,
    categorizationFromFullText: false,
    notes: seed,
    usedSupplementalMetadata: false,
    reviewSeconds: 1,
    taxonomyVersion: '2.0.0',
    labelSchemaVersion: '2.0.0',
    enrichmentSchemaVersion: '2.0.0',
    enrichmentProvenance: 'physician_confirmed_ai_enrichment',
    reviewerUserId: null,
    reviewerEmail: 'reviewer@example.invalid',
    isBlinded: true,
    startedAt: NOW,
    completedAt: NOW,
    createdAt: NOW,
  } satisfies GoldReviewPayload
}

function seedState(count: number) {
  return createImportCompensationRehearsal(
    BATCH_ID,
    Array.from({ length: count }, (_, index) => ({
      itemId: id(10, index + 1),
      pmid: String(10_000 + index),
      datasetSplit: 'development' as const,
    })),
  )
}

function itemSnapshot(state: ImportCompensationRehearsal, itemId: string) {
  const item = state.items[itemId]
  return {
    reviewStatus: item.reviewStatus,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    supplementalMetadataRevealedAt: item.supplementalMetadataRevealedAt,
    automatedSignalsRevealedAt: item.automatedSignalsRevealedAt,
  }
}

function expectedImportPostHash(state: ImportCompensationRehearsal, actions: ImportAction[]) {
  const projected = JSON.parse(JSON.stringify(state)) as ImportCompensationRehearsal
  for (const action of actions) {
    if (action.action === 'import_noop') continue
    const item = projected.items[action.itemId]
    item.reviews.push({
      id: action.importedReviewId,
      itemId: action.itemId,
      revision: action.expectedRevision,
      supersedesReviewId: action.expectedSupersedesReviewId,
      payload: action.review,
      revisionKind: 'import',
      lifecycleState: 'effective',
      operationActionId: action.actionId,
      compensatesReviewId: null,
      effectiveSourceReviewId: null,
      preImportItemState: action.preImportItemState,
    })
    item.currentReviewId = action.importedReviewId
    item.reviewStatus = 'completed'
    item.startedAt ??= action.review.startedAt
    item.completedAt = action.review.completedAt
  }
  return effectiveStateHash(projected)
}

function buildImport(
  state: ImportCompensationRehearsal,
  candidates: Map<string, GoldReviewPayload>,
  operationIndex = 1,
  faultAfterAction?: number,
) {
  const actions: ImportAction[] = Object.values(state.items)
    .filter((item) => item.datasetSplit === 'development')
    .map((item, index) => {
      const current = item.currentReviewId
        ? (item.reviews.find((review) => review.id === item.currentReviewId) ?? null)
        : null
      const effective = current?.lifecycleState === 'effective' ? current : null
      const effectiveId = effective ? (effective.effectiveSourceReviewId ?? effective.id) : null
      const candidate = candidates.get(item.itemId) ?? effective?.payload ?? null
      const common = {
        actionId: id(40 + operationIndex, index + 1),
        sequence: index + 1,
        itemId: item.itemId,
        pmid: item.pmid,
        datasetSplit: 'development' as const,
        expectedCurrentReviewId: current?.id ?? null,
        expectedEffectiveReviewId: effectiveId,
        preImportItemState: itemSnapshot(state, item.itemId),
      }
      if (
        candidate &&
        effective &&
        sha256Canonical(candidate) === sha256Canonical(effective.payload)
      ) {
        const candidateReview = goldReviewClinicalProjection(candidate)
        return {
          ...common,
          action: 'import_noop' as const,
          expectedRevision: null,
          expectedSupersedesReviewId: null,
          importedReviewId: null,
          expectedHeadReviewIdAfter: current?.id ?? null,
          expectedEffectiveReviewIdAfter: effectiveId,
          candidateReview,
          candidateReviewSha256: sha256Canonical(candidateReview),
          compensationAction: 'compensate_noop' as const,
          expectedEventSequence: [] as [],
        }
      }
      if (!candidate) throw new Error(`Missing candidate for ${item.itemId}.`)
      const importedReviewId = id(50 + operationIndex, index + 1)
      if (!current) {
        return {
          ...common,
          action: 'import_initial' as const,
          expectedCurrentReviewId: null,
          expectedEffectiveReviewId: null,
          expectedRevision: 1 as const,
          expectedSupersedesReviewId: null,
          importedReviewId,
          expectedHeadReviewIdAfter: importedReviewId,
          expectedEffectiveReviewIdAfter: importedReviewId,
          review: candidate,
          reviewSha256: sha256Canonical(candidate),
          compensationAction: 'compensate_void' as const,
          expectedEventSequence: ['review_imported'] as ['review_imported'],
        }
      }
      return {
        ...common,
        action: 'import_revision' as const,
        expectedCurrentReviewId: current.id,
        expectedRevision: current.revision + 1,
        expectedSupersedesReviewId: current.id,
        importedReviewId,
        expectedHeadReviewIdAfter: importedReviewId,
        expectedEffectiveReviewIdAfter: importedReviewId,
        review: candidate,
        reviewSha256: sha256Canonical(candidate),
        compensationAction: effective
          ? ('compensate_restore' as const)
          : ('compensate_void' as const),
        expectedEventSequence: ['review_imported'] as ['review_imported'],
      }
    })
  const initial = actions.filter((action) => action.action === 'import_initial').length
  const revisions = actions.filter((action) => action.action === 'import_revision').length
  const noops = actions.filter((action) => action.action === 'import_noop').length
  const plan = bindImportPlan({
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    kind: 'import',
    operationId: id(60, operationIndex),
    batchId: BATCH_ID,
    sourceArtifactSha256: ARTIFACT_SHA,
    sourceAuthorizationSetSha256: AUTH_SET_SHA,
    expectedPhysicalStateSha256: rehearsalPhysicalStateHash(state),
    expectedEffectiveStateSha256: effectiveStateHash(state),
    expectedPostEffectiveStateSha256: expectedImportPostHash(state, actions),
    executionContext: EXECUTION_CONTEXT,
    scope: {
      datasetSplit: 'development',
      heldOutIdentitiesAccessed: false,
      developmentMembershipSha256: developmentMembershipHash(state),
    },
    counts: { total: actions.length, initial, revisions, noops, inserts: initial + revisions },
    actions,
    ...(faultAfterAction ? { faultAfterAction } : {}),
  })
  const authorization = bindImportAuthorization({
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    kind: 'import_authorization',
    authorizationId: id(70, operationIndex),
    authorized: true,
    authorizedBy: 'physician@example.invalid',
    authorizedAt: NOW,
    authorizationNote: 'Checksum-bound import authorization.',
    ...AUTH_EXECUTION,
    operationId: plan.operationId,
    batchId: plan.batchId,
    planSha256: plan.binding.contentSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
    expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
    expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
  })
  return { plan, authorization }
}

function buildCompensation(
  state: ImportCompensationRehearsal,
  importPlan: ImportPlan,
  operationIndex = 1,
  faultAfterAction?: number,
) {
  const importOperation = state.operations[importPlan.operationId]
  if (importOperation.receipt?.kind !== 'import_receipt') throw new Error('Import receipt missing.')
  const actions: CompensationAction[] = importPlan.actions.map((source, index) => {
    const common = {
      actionId: id(80 + operationIndex, index + 1),
      sourceActionId: source.actionId,
      sequence: index + 1,
      itemId: source.itemId,
      pmid: source.pmid,
      datasetSplit: 'development' as const,
    }
    if (source.action === 'import_noop') {
      return {
        ...common,
        action: 'compensate_noop' as const,
        importedReviewId: null,
        expectedCurrentReviewId: source.expectedCurrentReviewId,
        expectedEffectiveReviewId: source.expectedEffectiveReviewId,
        expectedRevision: null,
        expectedSupersedesReviewId: null,
        compensationReviewId: null,
        effectiveSourceReviewId: source.expectedEffectiveReviewId,
        expectedHeadReviewIdAfter: source.expectedCurrentReviewId,
        expectedEffectiveReviewIdAfter: source.expectedEffectiveReviewId,
        expectedEventSequence: [] as [],
      }
    }
    const compensationReviewId = id(90 + operationIndex, index + 1)
    const base = {
      ...common,
      importedReviewId: source.importedReviewId,
      expectedCurrentReviewId: source.importedReviewId,
      expectedEffectiveReviewId: source.importedReviewId,
      expectedRevision: source.expectedRevision + 1,
      expectedSupersedesReviewId: source.importedReviewId,
      compensationReviewId,
      expectedHeadReviewIdAfter: compensationReviewId,
    }
    return source.expectedEffectiveReviewId
      ? {
          ...base,
          action: 'compensate_restore' as const,
          effectiveSourceReviewId: source.expectedEffectiveReviewId,
          expectedEffectiveReviewIdAfter: source.expectedEffectiveReviewId,
          expectedEventSequence: ['review_compensated'] as ['review_compensated'],
        }
      : {
          ...base,
          action: 'compensate_void' as const,
          effectiveSourceReviewId: null,
          expectedEffectiveReviewIdAfter: null,
          expectedEventSequence: ['review_voided'] as ['review_voided'],
        }
  })
  const restored = actions.filter((action) => action.action === 'compensate_restore').length
  const voided = actions.filter((action) => action.action === 'compensate_void').length
  const noops = actions.filter((action) => action.action === 'compensate_noop').length
  const plan = bindCompensationPlan({
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    kind: 'compensation',
    operationId: id(100, operationIndex),
    targetImportOperationId: importPlan.operationId,
    batchId: BATCH_ID,
    importPlanSha256: importPlan.binding.contentSha256,
    importReceiptSha256: importOperation.receipt.binding.contentSha256,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    expectedPhysicalStateSha256: rehearsalPhysicalStateHash(state),
    expectedEffectiveStateSha256: effectiveStateHash(state),
    expectedPostEffectiveStateSha256: importOperation.receipt.beforeEffectiveStateSha256,
    executionContext: EXECUTION_CONTEXT,
    scope: importPlan.scope,
    counts: { total: actions.length, restored, voided, noops },
    actions,
    ...(faultAfterAction ? { faultAfterAction } : {}),
  })
  const authorization = bindCompensationAuthorization({
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    kind: 'compensation_authorization',
    authorizationId: id(110, operationIndex),
    authorized: true,
    authorizedBy: 'physician@example.invalid',
    authorizedAt: NOW,
    authorizationNote: 'Independent checksum-bound compensation authorization.',
    ...AUTH_EXECUTION,
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
  return { plan, authorization }
}

describe('gold review import/compensation contract', () => {
  it('uses deterministic recursive canonical JSON and checksum/idempotency bindings', () => {
    expect(canonicalJson({ z: 1, a: { d: 2, b: [3, { y: true, x: null }] } })).toBe(
      '{"a":{"b":[3,{"x":null,"y":true}],"d":2},"z":1}',
    )
    const state = seedState(1)
    const first = buildImport(state, new Map([[id(10, 1), payload('candidate')]])).plan
    expect(parseImportPlan(first)).toEqual(first)
    expect(first.binding.idempotencyKey).toMatch(/^[a-f0-9]{64}$/u)
    expect(() => parseImportPlan({ ...first, counts: { ...first.counts, inserts: 0 } })).toThrow(
      /checksum|counts/iu,
    )
    expect(effectiveStateHash(state)).toBe(
      '871cf871dbabb2818ba37104abddad33c2edb63aad023a8fb470b72b84bf5e85',
    )
  })

  it('normalizes clinical arrays, accepts offset timestamps, and rejects noncanonical UUID text', () => {
    const normalized = goldReviewClinicalProjection({
      ...payload('normalization'),
      topicIds: ['pleural-interventions', 'basic-bronchoscopy'],
      technologyTags: ['robotic-bronchoscopy', 'convex-ebus'],
      clinicalPurposes: ['treatment', 'diagnosis'],
      diseaseTags: ['lung-cancer', 'infection'],
      startedAt: '2026-08-08T12:00:00+00:00',
      completedAt: '2026-08-08T12:00:01+00:00',
      createdAt: '2026-08-08T12:00:01+00:00',
    })
    expect(normalized).toMatchObject({
      topicIds: ['basic-bronchoscopy', 'pleural-interventions'],
      technologyTags: ['convex-ebus', 'robotic-bronchoscopy'],
      clinicalPurposes: ['diagnosis', 'treatment'],
      diseaseTags: ['infection', 'lung-cancer'],
    })
    expect(
      sha256Canonical(
        goldReviewClinicalProjection({
          ...payload('immutable prior A', 'exclude'),
          reviewSeconds: 0,
          enrichmentProvenance: 'synthetic-golden',
        }),
      ),
    ).toBe('5b3c2c627e2320659a15ecf0ac8b5002a9f772efea3e1f62e382016dad0fb931')
    expect(
      goldReviewPayloadSchema.parse({
        ...payload('offset'),
        startedAt: '2026-08-08T12:00:00+00:00',
        completedAt: '2026-08-08T12:00:01+00:00',
        createdAt: '2026-08-08T12:00:01+00:00',
      }).completedAt,
    ).toBe('2026-08-08T12:00:01+00:00')

    const state = seedState(1)
    const { plan } = buildImport(state, new Map([[id(10, 1), payload('uuid')]]))
    expect(() =>
      parseImportPlan({ ...plan, operationId: 'AAAAAAAA-0000-4000-8000-000000000001' }),
    ).toThrow('UUIDs must use canonical lowercase text')
  })

  it('models the real 621 initial, 3 revision, and 6 no-op action mix', () => {
    let state = seedState(630)
    for (let index = 621; index < 630; index += 1) {
      state = appendOrdinaryReviewRehearsal(state, {
        itemId: id(10, index + 1),
        reviewId: id(20, index + 1),
        payload: payload(`prior-${index}`),
      })
    }
    const candidates = new Map<string, GoldReviewPayload>()
    for (let index = 0; index < 621; index += 1)
      candidates.set(id(10, index + 1), payload(`initial-${index}`))
    for (let index = 621; index < 624; index += 1)
      candidates.set(id(10, index + 1), payload(`revised-${index}`))
    const { plan, authorization } = buildImport(state, candidates)
    expect(plan.counts).toEqual({ total: 630, initial: 621, revisions: 3, noops: 6, inserts: 624 })
    const result = executeImportRehearsal(state, plan, authorization)
    expect(result.receipt?.counts).toEqual({ planned: 624, applied: 624, noops: 6 })
    expect(assertLinearRevisionChains(result.state)).toBe(true)
  })

  it('rolls back every review mutation on an injected failure while retaining failure audit', () => {
    const state = seedState(3)
    const beforeEffective = effectiveStateHash(state)
    const beforeHistory = canonicalJson(Object.values(state.items).map((item) => item.reviews))
    const candidates = new Map(
      Object.keys(state.items).map((itemId, index) => [itemId, payload(`row-${index}`)]),
    )
    const { plan, authorization } = buildImport(state, candidates, 1, 2)
    const result = executeImportRehearsal(state, plan, authorization)
    expect(result.receipt?.outcome).toBe('failed')
    expect(effectiveStateHash(result.state)).toBe(beforeEffective)
    expect(canonicalJson(Object.values(result.state.items).map((item) => item.reviews))).toBe(
      beforeHistory,
    )
    expect(result.receipt?.eventSequence).toEqual(['import_started', 'import_failed'])
    expect(rehearsalPhysicalStateHash(result.state)).not.toBe(rehearsalPhysicalStateHash(state))
    const replay = executeImportRehearsal(result.state, plan, authorization)
    expect(replay.response).toBe('idempotent_replay')
    expect(replay.receipt?.outcome).toBe('failed')
  })

  it('resolves an ambiguous committed response by exact idempotent replay without duplicates', () => {
    const state = seedState(1)
    const { plan, authorization } = buildImport(state, new Map([[id(10, 1), payload('candidate')]]))
    const ambiguous = executeImportRehearsal(state, plan, authorization, {
      ambiguousResponseAfterCommit: true,
    })
    expect(ambiguous.receipt).toBeNull()
    const replay = executeImportRehearsal(ambiguous.state, plan, authorization)
    expect(replay.response).toBe('idempotent_replay')
    expect(replay.receipt?.outcome).toBe('committed')
    expect(replay.state.items[id(10, 1)].reviews).toHaveLength(1)
  })

  it('appends restore and withdrawal heads while restoring the pre-import effective hash', () => {
    let state = seedState(2)
    state = appendOrdinaryReviewRehearsal(state, {
      itemId: id(10, 2),
      reviewId: id(20, 2),
      payload: payload('prior'),
    })
    const beforeEffective = effectiveStateHash(state)
    const beforePhysical = rehearsalPhysicalStateHash(state)
    const immutablePrior = canonicalJson(state.items[id(10, 2)].reviews[0])
    const imported = buildImport(
      state,
      new Map([
        [id(10, 1), payload('initial')],
        [id(10, 2), payload('revision')],
      ]),
    )
    const committed = executeImportRehearsal(state, imported.plan, imported.authorization).state
    const compensation = buildCompensation(committed, imported.plan)
    const result = executeCompensationRehearsal(
      committed,
      compensation.plan,
      compensation.authorization,
    )
    expect(effectiveStateHash(result.state)).toBe(beforeEffective)
    expect(rehearsalPhysicalStateHash(result.state)).not.toBe(beforePhysical)
    expect(result.state.items[id(10, 1)]).toMatchObject({
      reviewStatus: 'pending',
      currentReviewId: id(91, 1),
    })
    expect(result.state.items[id(10, 1)].reviews.at(-1)).toMatchObject({
      lifecycleState: 'withdrawn',
      supersedesReviewId: id(51, 1),
    })
    expect(result.state.items[id(10, 2)].reviews.at(-1)).toMatchObject({
      lifecycleState: 'effective',
      supersedesReviewId: id(51, 2),
      effectiveSourceReviewId: id(20, 2),
    })
    expect(canonicalJson(result.state.items[id(10, 2)].reviews[0])).toBe(immutablePrior)
    expect(result.receipt?.eventSequence).toEqual([
      'import_compensation_started',
      'review_voided',
      'review_compensated',
      'import_compensation_completed',
    ])
    expect(assertLinearRevisionChains(result.state)).toBe(true)
  })

  it('keeps latest-parent/max+1 semantics for ordinary review after initial withdrawal', () => {
    const state = seedState(1)
    const imported = buildImport(state, new Map([[id(10, 1), payload('initial')]]))
    const committed = executeImportRehearsal(state, imported.plan, imported.authorization).state
    const compensation = buildCompensation(committed, imported.plan)
    const compensated = executeCompensationRehearsal(
      committed,
      compensation.plan,
      compensation.authorization,
    ).state
    const reviewed = appendOrdinaryReviewRehearsal(compensated, {
      itemId: id(10, 1),
      reviewId: id(120, 1),
      payload: payload('ordinary'),
    })
    expect(reviewed.items[id(10, 1)].reviews.at(-1)).toMatchObject({
      revision: 3,
      supersedesReviewId: id(91, 1),
    })
    expect(reviewed.items[id(10, 1)].currentReviewId).toBe(id(120, 1))
  })

  it('uses the restored source identity while a second import appends from the compensation head', () => {
    let state = seedState(1)
    state = appendOrdinaryReviewRehearsal(state, {
      itemId: id(10, 1),
      reviewId: id(20, 1),
      payload: payload('prior'),
    })
    const imported = buildImport(state, new Map([[id(10, 1), payload('first-import')]]), 1)
    const committed = executeImportRehearsal(state, imported.plan, imported.authorization).state
    const compensation = buildCompensation(committed, imported.plan)
    const compensated = executeCompensationRehearsal(
      committed,
      compensation.plan,
      compensation.authorization,
    ).state
    const second = buildImport(compensated, new Map([[id(10, 1), payload('second-import')]]), 2)
    expect(second.plan.actions[0]).toMatchObject({
      action: 'import_revision',
      expectedCurrentReviewId: id(91, 1),
      expectedEffectiveReviewId: id(20, 1),
      expectedSupersedesReviewId: id(91, 1),
      expectedRevision: 4,
    })
    const result = executeImportRehearsal(compensated, second.plan, second.authorization)
    expect(result.receipt?.outcome).toBe('committed')
    expect(assertLinearRevisionChains(result.state)).toBe(true)
  })

  it('keeps failed compensation atomic, replays its receipt, and requires a fresh operation to retry', () => {
    const state = seedState(2)
    const imported = buildImport(
      state,
      new Map([
        [id(10, 1), payload('a')],
        [id(10, 2), payload('b')],
      ]),
    )
    const committed = executeImportRehearsal(state, imported.plan, imported.authorization).state
    const failedPlan = buildCompensation(committed, imported.plan, 1, 1)
    const failed = executeCompensationRehearsal(
      committed,
      failedPlan.plan,
      failedPlan.authorization,
    )
    expect(failed.receipt?.outcome).toBe('failed')
    expect(effectiveStateHash(failed.state)).toBe(effectiveStateHash(committed))
    const replay = executeCompensationRehearsal(
      failed.state,
      failedPlan.plan,
      failedPlan.authorization,
    )
    expect(replay.response).toBe('idempotent_replay')
    expect(replay.receipt?.outcome).toBe('failed')
    const fresh = buildCompensation(failed.state, imported.plan, 2)
    expect(
      executeCompensationRehearsal(failed.state, fresh.plan, fresh.authorization).receipt?.outcome,
    ).toBe('committed')
  })

  it('rejects a second compensation, stale state/auth, and legacy pointer-rewind plans', () => {
    const state = seedState(1)
    const imported = buildImport(state, new Map([[id(10, 1), payload('a')]]))
    const committed = executeImportRehearsal(state, imported.plan, imported.authorization).state
    const compensation = buildCompensation(committed, imported.plan)
    const compensated = executeCompensationRehearsal(
      committed,
      compensation.plan,
      compensation.authorization,
    ).state
    const second = buildCompensation(compensated, imported.plan, 2)
    expect(() =>
      executeCompensationRehearsal(compensated, second.plan, second.authorization),
    ).toThrow(/already compensated/iu)
    const changed = appendOrdinaryReviewRehearsal(state, {
      itemId: id(10, 1),
      reviewId: id(130, 1),
      payload: payload('drift'),
    })
    expect(() => executeImportRehearsal(changed, imported.plan, imported.authorization)).toThrow(
      /stale physical/iu,
    )
    expect(() =>
      rejectLegacyPointerRewindRollback({ action: 'restore_current_review_id' }),
    ).toThrow(LEGACY_POINTER_REWIND_ERROR)
    expect(() =>
      parseCompensationPlan({ rollbackPlan: { targetCurrentReviewId: id(20, 1) } }),
    ).toThrow(LEGACY_POINTER_REWIND_ERROR)
  })

  it('keeps recovery authorization non-mutating and readiness false before migration', () => {
    const state = seedState(1)
    const { plan, authorization } = buildImport(state, new Map([[id(10, 1), payload('a')]]))
    const recovery = bindRecoveryAuthorization({
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      kind: 'recovery_authorization',
      authorizationId: id(140, 1),
      authorized: true,
      authorizedBy: 'physician@example.invalid',
      authorizedAt: NOW,
      authorizationNote: 'Reconcile an ambiguous response without mutation.',
      ...AUTH_EXECUTION,
      recoveryAction: 'resolve_ambiguous_import',
      batchId: BATCH_ID,
      targetOperationId: plan.operationId,
      targetPlanSha256: plan.binding.contentSha256,
      targetIdempotencyKey: plan.binding.idempotencyKey,
      observedPhysicalStateSha256: rehearsalPhysicalStateHash(state),
      observedEffectiveStateSha256: effectiveStateHash(state),
      permitsMutation: false,
    })
    expect(parseRecoveryAuthorization(recovery).permitsMutation).toBe(false)
    expect(
      validateImportBundle({
        plan,
        authorization,
        sourceArtifactSha256: ARTIFACT_SHA,
        currentPhysicalStateSha256: rehearsalPhysicalStateHash(state),
        currentEffectiveStateSha256: effectiveStateHash(state),
        migrationApplied: false,
        testSplitLocked: true,
        revisionChainsLinear: true,
        currentPointersAreLatestHeads: true,
      }).ready,
    ).toBe(false)

    const corruptChain = validateImportBundle({
      plan,
      authorization,
      sourceArtifactSha256: ARTIFACT_SHA,
      currentPhysicalStateSha256: rehearsalPhysicalStateHash(state),
      currentEffectiveStateSha256: effectiveStateHash(state),
      migrationApplied: true,
      testSplitLocked: true,
      revisionChainsLinear: false,
      currentPointersAreLatestHeads: true,
    })
    expect(corruptChain.ready).toBe(false)
    expect(corruptChain.failures).toContain('revisionChainsLinear')
  })

  it('rejects held-out scope at schema validation without requiring identity access', () => {
    const state = seedState(1)
    const { plan } = buildImport(state, new Map([[id(10, 1), payload('a')]]))
    let identityReads = 0
    const invalid = {
      ...plan,
      scope: new Proxy(
        { ...plan.scope, datasetSplit: 'test' },
        {
          get(target, key, receiver) {
            if (key === 'heldOutIdentities') identityReads += 1
            return Reflect.get(target, key, receiver)
          },
        },
      ),
    }
    expect(() => parseImportPlan(invalid)).toThrow()
    expect(identityReads).toBe(0)
  })

  it('excludes test identities from rehearsal projections and rejects operation-ID collisions', () => {
    const state = createImportCompensationRehearsal(BATCH_ID, [
      { itemId: id(10, 1), pmid: '10001', datasetSplit: 'development' },
      { itemId: id(10, 2), pmid: '999999', datasetSplit: 'test' },
    ])
    expect(canonicalJson(rehearsalPhysicalStateProjection(state))).not.toContain('999999')
    expect(canonicalJson(developmentMembershipProjection(state))).not.toContain(id(10, 2))

    const first = buildImport(state, new Map([[id(10, 1), payload('first')]]), 1, 1)
    const failed = executeImportRehearsal(state, first.plan, first.authorization).state
    const collision = buildImport(failed, new Map([[id(10, 1), payload('different')]]), 1)
    expect(() => executeImportRehearsal(failed, collision.plan, collision.authorization)).toThrow(
      /operation or idempotency identity/iu,
    )
  })
})
