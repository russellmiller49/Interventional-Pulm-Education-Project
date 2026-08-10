import {
  GOLD_IMPORT_COMPENSATION_MIGRATION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  NOTE_DISPOSITION_AUDIT_SHA256,
  REQUIRED_TRANSITION_RPCS_V1,
  REQUIRED_TRANSITION_RPCS_V2,
  V2_REHEARSAL_EVIDENCE_MARKER,
  assertV2SchemaOnlyUpgradePreserved,
  buildCanonicalV2RehearsalArtifacts,
  deriveV2DynamicActionCounts,
  extractV2VerifierEvidence,
  validateV2OperationScenarios,
  validateV2ProductionCohort,
  validateV2RpcMetadata,
  type V2CohortRowEvidence,
} from './gold-import-compensation-rehearsal-evidence-v2'
import { sha256Canonical } from '../../src/features/literature/gold-set/import-compensation-v2'

const hash = (value: number) => value.toString(16).padStart(64, '0').slice(-64)

function cohortRows(): V2CohortRowEvidence[] {
  return Array.from({ length: 630 }, (_, index) => {
    const excluded = index < 272
    const initial = index < 620
    return {
      action: initial ? 'import_initial' : 'import_revision',
      actionIdentitySha256: hash(index + 1),
      automatedSignalsRevealedAtAfter: null,
      automatedSignalsRevealedAtBefore: null,
      categorizationFromFullText: !excluded && index === 300,
      clinicalPurposeCount: excluded ? 0 : 1,
      diseaseStatus: excluded ? null : 'tagged',
      diseaseTagCount: excluded ? 0 : 1,
      fullTextUsed: index < 50,
      importedReviewPersisted: true,
      isBlinded: false,
      noteDisposition: index < 2 ? 'amended_authorized_rationale' : 'finalized_v3',
      noteSha256: hash(10_000 + index),
      publicationStatus: excluded ? null : 'full-article',
      relevanceLabel: excluded ? 'exclude' : 'include_core',
      requiredNoteSha256: hash(10_000 + index),
      studyDesign: excluded ? null : 'randomized-controlled-trial',
      supplementalMetadataRevealedAtAfter: null,
      supplementalMetadataRevealedAtBefore: null,
      technologyStatus: excluded ? null : 'tagged',
      technologyTagCount: excluded ? 0 : 1,
      topicCount: excluded ? 0 : 1,
      usedSupplementalMetadataAfter: false,
      usedSupplementalMetadataBefore: initial ? null : false,
    }
  })
}

function productionCohort(rows = cohortRows()) {
  return { noteDispositionAuditSha256: NOTE_DISPOSITION_AUDIT_SHA256, rows }
}

function schemaSnapshot() {
  return {
    actionCount: 0,
    actionRowsSha256: hash(20),
    automatedRevealStateSha256: hash(1),
    batchCount: 1,
    batchRowsSha256: hash(21),
    draftCount: 0,
    draftRowsSha256: hash(22),
    effectiveStateSha256V1: hash(2),
    eventCount: 1,
    eventRowsSha256: hash(23),
    itemCount: 630,
    itemRowsSha256: hash(24),
    membershipSha256: hash(3),
    operationCount: 0,
    operationRowsSha256: hash(25),
    physicalStateSha256V1: hash(4),
    planningStateSha256: hash(5),
    pointerStateSha256: hash(6),
    reviewCount: 9,
    reviewRowsSha256: hash(7),
    supplementalRevealStateSha256: hash(8),
  }
}

function bindReceipt<T extends Record<string, unknown> & { response: string }>(content: T) {
  return {
    ...content,
    binding: {
      contentSha256: sha256Canonical(
        Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'response')),
      ),
    },
  }
}

function receiptsAndState(
  compensationEvent: 'review_compensated' | 'review_voided' = 'review_compensated',
  physicalHashOffset = 0,
  partition = { initial: 620, revisions: 10 },
) {
  const preImport = {
    effectiveStateSha256: hash(200),
    physicalStateSha256: hash(201 + physicalHashOffset),
  }
  const postImport = {
    effectiveStateSha256: hash(202),
    physicalStateSha256: hash(203 + physicalHashOffset),
  }
  const postCompensation = {
    effectiveStateSha256: preImport.effectiveStateSha256,
    physicalStateSha256: hash(204 + physicalHashOffset),
  }
  const common = {
    batchId: '00000000-0000-4000-8000-000000000001',
    booleanNormalizationLedgerSha256: hash(205),
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    counts: { applied: 630, noops: 0, planned: 630 },
    error: null,
    migrationId: GOLD_IMPORT_COMPENSATION_MIGRATION_V2,
    noteDispositionAuditSha256: NOTE_DISPOSITION_AUDIT_SHA256,
    orderedSetNormalizationLedgerSha256: hash(206),
    outcome: 'committed' as const,
    sourceAuthorizationSetSha256: hash(207),
  }
  const importContent = {
    ...common,
    actionCounts: {
      initial: partition.initial,
      inserts: partition.initial + partition.revisions,
      noops: 0,
      revisions: partition.revisions,
      total: partition.initial + partition.revisions,
    },
    afterEffectiveStateSha256: postImport.effectiveStateSha256,
    afterPhysicalStateSha256: postImport.physicalStateSha256,
    beforeEffectiveStateSha256: preImport.effectiveStateSha256,
    beforePhysicalStateSha256: preImport.physicalStateSha256,
    eventSequence: [
      'import_started',
      ...Array.from({ length: 630 }, () => 'review_imported' as const),
      'import_completed',
    ],
    idempotencyKey: hash(208),
    kind: 'import_receipt' as const,
    operationId: '00000000-0000-4000-8000-000000000002',
    planSha256: hash(209),
    response: 'applied' as const,
  }
  const compensationContent = {
    ...common,
    actionCounts: {
      noops: 0,
      restored: partition.revisions,
      total: partition.initial + partition.revisions,
      voided: partition.initial,
    },
    afterEffectiveStateSha256: postCompensation.effectiveStateSha256,
    afterPhysicalStateSha256: postCompensation.physicalStateSha256,
    beforeEffectiveStateSha256: postImport.effectiveStateSha256,
    beforePhysicalStateSha256: postImport.physicalStateSha256,
    eventSequence: [
      'import_compensation_started',
      ...Array.from({ length: 630 }, () => compensationEvent),
      'import_compensation_completed',
    ],
    idempotencyKey: hash(210),
    kind: 'compensation_receipt' as const,
    operationId: '00000000-0000-4000-8000-000000000003',
    planSha256: hash(211),
    response: 'applied' as const,
    targetImportOperationId: importContent.operationId,
  }
  return {
    receipts: {
      compensationApplied: bindReceipt(compensationContent),
      compensationReplayed: bindReceipt({
        ...compensationContent,
        response: 'idempotent_replay' as const,
      }),
      importApplied: bindReceipt(importContent),
      importReconciled: bindReceipt({
        ...importContent,
        response: 'idempotent_replay' as const,
      }),
      importReplayed: bindReceipt({
        ...importContent,
        response: 'idempotent_replay' as const,
      }),
    },
    state: {
      postCompensation,
      postCompensationReplay: postCompensation,
      postImport,
      postImportReplay: postImport,
      postLostAcknowledgementReconcile: postImport,
      preImport,
    },
  }
}

function operationScenarios() {
  const atomic = {
    actionMutationCount: 0,
    eventMutationCount: 0,
    failedJournalSealed: true,
    pointerMutationCount: 0,
    revealTimestampMutationCount: 0,
    reviewMutationCount: 0,
  }
  return {
    atomicity: {
      beforeAction1: { ...atomic, failedJournalSealed: false },
      finalAction: atomic,
      midOperation: atomic,
    },
    compensation: {
      actionMappingCount: 630,
      appendOnly: true,
      effectiveStateRestored: true,
      exactPayloadCopy: true,
      physicalHistoryExtended: true,
    },
    idempotency: { mutationCount: 0, sameReceipt: true },
    lostAcknowledgement: { mutationCount: 0, readOnlyReconcile: true, sameReceipt: true },
    receiptsAndState: receiptsAndState(),
  }
}

function rpcMetadata(owner: 'postgres' | 'supabase_admin') {
  const applyArguments =
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text'
  const compensationArguments =
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text'
  return {
    functions: [...REQUIRED_TRANSITION_RPCS_V1, ...REQUIRED_TRANSITION_RPCS_V2].map((name) => ({
      anonExecute: false,
      authenticatedExecute: false,
      identityArguments: name.startsWith('apply_')
        ? applyArguments
        : name.startsWith('compensate_')
          ? compensationArguments
          : 'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
      name,
      owner,
      publicExecute: false,
      resultType: 'jsonb',
      searchPath: 'pg_catalog, public, extensions',
      securityDefiner: true,
      serviceRoleExecute: true,
      volatility: name.startsWith('reconcile_') ? 's' : 'v',
    })),
  }
}

describe('V2 gold import-compensation rehearsal evidence', () => {
  test('pins the explicit forward-only V2 boundary and migration identity', () => {
    expect(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2).toBe(
      'gold-review-import-compensation/2.0.0',
    )
    expect(GOLD_IMPORT_COMPENSATION_MIGRATION_V2).toBe(
      '20260809231651_add_literature_gold_import_compensation_contract_v2',
    )
    expect(GOLD_IMPORT_COMPENSATION_MIGRATION_V2).not.toContain('20260809231312')
  })

  test('proves an upgrade changes no V1 state, rows, pointers, or reveal timestamps', () => {
    const expectedAfter = { ...schemaSnapshot(), physicalStateSha256V1: hash(98) }
    expect(
      assertV2SchemaOnlyUpgradePreserved({ after: expectedAfter, before: schemaSnapshot() }),
    ).toMatchObject({
      after: expectedAfter,
      before: schemaSnapshot(),
      v1PhysicalStateHashChanged: true,
    })
    expect(() =>
      assertV2SchemaOnlyUpgradePreserved({
        after: schemaSnapshot(),
        before: schemaSnapshot(),
      }),
    ).toThrow('required schema-derived')
    expect(() =>
      assertV2SchemaOnlyUpgradePreserved({
        after: {
          ...schemaSnapshot(),
          physicalStateSha256V1: hash(98),
          pointerStateSha256: hash(99),
        },
        before: schemaSnapshot(),
      }),
    ).toThrow('pointerStateSha256')
  })

  test.each(['supabase_admin', 'postgres'] as const)(
    'requires exact V1/V2 RPC signatures, search paths, and ACLs for %s',
    (owner) => {
      expect(validateV2RpcMetadata(rpcMetadata(owner), owner)).toHaveLength(6)
      const unsafe = rpcMetadata(owner)
      unsafe.functions[3] = { ...unsafe.functions[3], authenticatedExecute: true }
      expect(() => validateV2RpcMetadata(unsafe, owner)).toThrow('Unsafe or changed')
    },
  )

  test('derives the action partition and verifies every production V2 semantic cohort', () => {
    const validated = validateV2ProductionCohort(productionCohort())
    expect(validated.actionCounts).toEqual({
      initial: 620,
      inserts: 630,
      noops: 0,
      revisions: 10,
      total: 630,
    })
    expect(validated).toMatchObject({
      amendedNoteCount: 2,
      falseFullTextCount: 580,
      falseIsBlindedCount: 630,
      nullDiseaseStatusCount: 272,
      nullTechnologyStatusCount: 272,
      trueFullTextCount: 50,
    })
    expect(
      deriveV2DynamicActionCounts([
        { action: 'import_initial' },
        { action: 'import_noop' },
        { action: 'import_revision' },
      ]),
    ).toEqual({ initial: 1, inserts: 2, noops: 1, revisions: 1, total: 3 })
  })

  test('rejects null full-text persistence, fabricated statuses, reveals, and notes', () => {
    const nullFullText = cohortRows() as unknown as Array<Record<string, unknown>>
    nullFullText[50] = { ...nullFullText[50], fullTextUsed: null }
    expect(() => validateV2ProductionCohort(productionCohort(nullFullText as never))).toThrow(
      'fullTextUsed',
    )

    const fabricatedStatus = cohortRows()
    fabricatedStatus[0] = { ...fabricatedStatus[0], technologyStatus: 'not_applicable' }
    expect(() => validateV2ProductionCohort(productionCohort(fabricatedStatus))).toThrow(
      'source-null tag status cohort',
    )

    const reveal = cohortRows()
    reveal[2] = { ...reveal[2], automatedSignalsRevealedAtAfter: '2030-01-01T00:00:00Z' }
    expect(() => validateV2ProductionCohort(productionCohort(reveal))).toThrow('reveal timestamp')

    const note = cohortRows()
    note[3] = { ...note[3], noteSha256: hash(999_999) }
    expect(() => validateV2ProductionCohort(productionCohort(note))).toThrow(
      'authorized target note',
    )
  })

  test('keeps full-text, categorization, and supplemental-metadata facts independent', () => {
    const rows = cohortRows()
    rows[300] = {
      ...rows[300],
      categorizationFromFullText: true,
      fullTextUsed: false,
    }
    expect(validateV2ProductionCohort(productionCohort(rows)).rows[300]).toMatchObject({
      categorizationFromFullText: true,
      fullTextUsed: false,
      usedSupplementalMetadataAfter: false,
    })

    rows[300] = {
      ...rows[300],
      usedSupplementalMetadataAfter: true,
      usedSupplementalMetadataBefore: false,
    }
    expect(() => validateV2ProductionCohort(productionCohort(rows))).toThrow(
      'independent supplemental-metadata provenance',
    )
  })

  test('requires all atomicity, replay, lost-ack, and append-only compensation proofs', () => {
    expect(validateV2OperationScenarios(operationScenarios())).toMatchObject({
      compensation: { actionMappingCount: 630, effectiveStateRestored: true },
      idempotency: { mutationCount: 0, sameReceipt: true },
    })
    const partial = operationScenarios()
    partial.atomicity.finalAction = {
      ...partial.atomicity.finalAction,
      reviewMutationCount: 1,
    }
    expect(() => validateV2OperationScenarios(partial)).toThrow('partial action mutation')
  })

  test('extracts exactly one verifier marker and canonicalizes unordered cohort evidence', () => {
    expect(
      extractV2VerifierEvidence(`NOTICE: ${V2_REHEARSAL_EVIDENCE_MARKER}{"passed":true}\n`),
    ).toEqual({ passed: true })
    expect(() =>
      extractV2VerifierEvidence(
        `${V2_REHEARSAL_EVIDENCE_MARKER}{}\n${V2_REHEARSAL_EVIDENCE_MARKER}{}`,
      ),
    ).toThrow('exactly one')

    const input = {
      migrationPath: 'fresh' as const,
      migrationSha256: hash(999),
      operationScenarios: operationScenarios(),
      productionCohort: productionCohort(),
      schemaOnlyUpgrade: null,
      verifierEvidence: { passed: true },
    }
    const first = buildCanonicalV2RehearsalArtifacts(input)
    const second = buildCanonicalV2RehearsalArtifacts({
      ...input,
      productionCohort: productionCohort([...cohortRows()].reverse()),
    })
    expect(first.get('v2-rehearsal-evidence.json')).toEqual(
      second.get('v2-rehearsal-evidence.json'),
    )
    expect(first.get('canonical-manifest.sha256')).toEqual(second.get('canonical-manifest.sha256'))

    const eventDriftScenarios = operationScenarios()
    eventDriftScenarios.receiptsAndState = receiptsAndState('review_voided')
    const eventDrift = buildCanonicalV2RehearsalArtifacts({
      ...input,
      operationScenarios: eventDriftScenarios,
    })
    const physicalHashDriftScenarios = operationScenarios()
    physicalHashDriftScenarios.receiptsAndState = receiptsAndState('review_compensated', 20)
    const physicalHashDrift = buildCanonicalV2RehearsalArtifacts({
      ...input,
      operationScenarios: physicalHashDriftScenarios,
    })
    expect(eventDrift.get('v2-rehearsal-evidence.json')).not.toEqual(
      first.get('v2-rehearsal-evidence.json'),
    )
    expect(physicalHashDrift.get('v2-rehearsal-evidence.json')).not.toEqual(
      first.get('v2-rehearsal-evidence.json'),
    )

    const reboundPartitionScenarios = operationScenarios()
    reboundPartitionScenarios.receiptsAndState = receiptsAndState('review_compensated', 0, {
      initial: 619,
      revisions: 11,
    })
    expect(validateV2OperationScenarios(reboundPartitionScenarios)).toBeDefined()
    expect(() =>
      buildCanonicalV2RehearsalArtifacts({
        ...input,
        operationScenarios: reboundPartitionScenarios,
      }),
    ).toThrow('dynamically derived cohort partition')
  })
})
