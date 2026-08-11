import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
  LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
  buildLiteratureGoldV2SchemaNeutralHistoryEvidence,
  literatureGoldV2SchemaNeutralHistoryRowsSql,
  type LiteratureGoldV2SchemaNeutralHistoryEvidence,
  type LiteratureGoldV2SchemaNeutralHistoryRows,
} from './literature-gold-v2-schema-neutral-history'
import {
  LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY,
  LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
  LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE,
  validateLiteratureGoldV2SchemaOnlyTransition,
  type LiteratureGoldV2SchemaOnlyTransitionInput,
  type LiteratureGoldV2SchemaOnlyTransitionState,
} from './literature-gold-v2-schema-only-transition'
import {
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  expectedObservedAuditIdentityFromArtifact,
} from './gold-import-contract-v2-catalog-expectations'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
} from './protected-gold-import-contract-v2-source-identities'
import {
  PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION,
  assertProtectedV2TransitionEvidenceSqlReadOnly,
  buildProtectedV2SchemaOnlyDatabaseTransitionInput,
  buildProtectedV2TransitionSnapshotSql,
  validateProtectedV2LocalCompleteCatalogAudit,
  validateProtectedV2SchemaOnlyDatabaseTransition,
  type ProtectedV2DatabaseEvidence,
} from './protected-gold-import-contract-v2-transition-evidence'

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sorted(record[key])]),
    )
  }
  return value
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(`${JSON.stringify(sorted(value), null, 2)}\n`)
    .digest('hex')
}

function hash(label: string): string {
  return createHash('sha256').update(label).digest('hex')
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function mutable(row: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return row as Record<string, unknown>
}

function bindHistory(
  unsigned: Omit<LiteratureGoldV2SchemaNeutralHistoryEvidence, 'bindingSha256'>,
): LiteratureGoldV2SchemaNeutralHistoryEvidence {
  return { ...unsigned, bindingSha256: digest(unsigned) }
}

function history(phase: 'before_v2' | 'after_v2'): LiteratureGoldV2SchemaNeutralHistoryEvidence {
  const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
  return bindHistory({
    batchId: authority.batchId,
    componentIdentities: { ...authority.historyComponentIdentities },
    counts: {
      actions: 0,
      batches: 1,
      drafts: 0,
      events: 59,
      items: 630,
      operations: 0,
      reviews: 11,
    },
    datasetSplit: 'development',
    expectedPostV1PhysicalStateSha256: authority.post.physicalStateSha256V1,
    phase,
    physicalStateSha256V1:
      phase === 'before_v2'
        ? authority.pre.physicalStateSha256V1
        : authority.post.physicalStateSha256V1,
    schemaDerivedFields: {
      operationFields: LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
      operationRowCount: 0,
      operationValuesSha256:
        phase === 'before_v2'
          ? authority.pre.schemaDerivedOperationValuesSha256
          : authority.postSchemaDerivedOperationValuesSha256,
      reviewFields: LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
      reviewRowCount: 11,
      reviewValuesSha256:
        phase === 'before_v2'
          ? authority.pre.schemaDerivedReviewValuesSha256
          : authority.postSchemaDerivedReviewValuesSha256,
    },
    schemaNeutralHistorySha256: authority.post.schemaNeutralHistorySha256,
    schemaVersion: 'literature-gold-schema-neutral-physical-history-evidence/1.0.0',
  })
}

function state(phase: 'before_v2' | 'after_v2'): LiteratureGoldV2SchemaOnlyTransitionState {
  const post = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post
  return {
    compensationCount: 0,
    developmentMembershipSha256: post.developmentMembershipSha256,
    effectiveStateSha256V1: post.effectiveStateSha256V1,
    effectiveStateSha256V2: phase === 'before_v2' ? null : post.effectiveStateSha256V2,
    eventStateSha256: post.eventStateSha256,
    history: history(phase),
    importCount: 0,
    physicalStateSha256V2: phase === 'before_v2' ? null : post.physicalStateSha256V2,
    planningStateSha256: post.planningStateSha256,
    pointerStateSha256: post.pointerStateSha256,
    readOnlyBracketMatches: true,
    revealStateSha256: post.revealStateSha256,
    reviewStateSha256: post.reviewStateSha256,
    sourceAuthorizationSha256: hash('unchanged-source-authorization'),
    v1Occurrence: 1,
    v2Occurrence: phase === 'before_v2' ? 0 : 1,
  }
}

function incidentTransition(): LiteratureGoldV2SchemaOnlyTransitionInput {
  const before = state('before_v2')
  return {
    after: state('after_v2'),
    beforeCaptures: [before, clone(before)],
    catalogAudit: {
      ...LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.catalog,
      completeExactMatch: true,
    },
    mutationCounts: { actions: 0, events: 0, pointers: 0, reveals: 0, reviews: 0 },
    reasonCode: LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE,
    sourceIdentities: {
      ...LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.sourceIdentities,
    },
  }
}

function databaseEvidence(phase: 'before_v2' | 'after_v2'): ProtectedV2DatabaseEvidence {
  const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
  const transitionState = state(phase)
  const catalogAudit =
    phase === 'after_v2'
      ? validateProtectedV2LocalCompleteCatalogAudit(
          expectedObservedAuditIdentityFromArtifact(
            committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
              'local_supabase_postgres_owner_v1',
              'local',
            ),
          ),
        )
      : null
  return {
    actionCount: 0,
    batchId: authority.batchId,
    compensationCount: 0,
    completeCatalogAudit: catalogAudit,
    developmentMembershipSha256: transitionState.developmentMembershipSha256,
    developmentPlanningStateSha256: transitionState.planningStateSha256,
    effectiveStateSha256: transitionState.effectiveStateSha256V1,
    effectiveStateSha256V2: transitionState.effectiveStateSha256V2,
    eventStateSha256: transitionState.eventStateSha256,
    history: transitionState.history,
    importCount: 0,
    ledgerEntries: [
      {
        name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
      },
      ...(phase === 'after_v2'
        ? [
            {
              name: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
              version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
            },
          ]
        : []),
    ],
    operationCount: 0,
    physicalStateSha256: transitionState.history.physicalStateSha256V1,
    physicalStateSha256V2: transitionState.physicalStateSha256V2,
    pointerStateSha256: transitionState.pointerStateSha256,
    readOnlyBracketMatches: true,
    revealStateSha256: transitionState.revealStateSha256,
    reviewStateSha256: transitionState.reviewStateSha256,
    schemaVersion: PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION,
    v1Occurrence: 1,
    v2Occurrence: phase === 'before_v2' ? 0 : 1,
  }
}

function rebindAfterHistory(input: LiteratureGoldV2SchemaOnlyTransitionInput): void {
  const { bindingSha256: _binding, ...unsigned } = input.after.history
  void _binding
  input.after.history = bindHistory(unsigned)
}

describe('schema-neutral physical history', () => {
  const batchId = '00000000-0000-4000-8000-000000000001'
  const itemId = '00000000-0000-4000-8000-000000000002'
  const reviewId = '00000000-0000-4000-8000-000000000003'
  const eventId = '00000000-0000-4000-8000-000000000004'

  function rows(phase: 'before_v2' | 'after_v2'): LiteratureGoldV2SchemaNeutralHistoryRows {
    const review = {
      completed_at: '2026-01-01T00:00:03+00:00',
      created_at: '2026-01-01T00:00:03+00:00',
      id: reviewId,
      item_id: itemId,
      lifecycle_state: 'effective',
      notes: 'bound clinical note',
      operation_action_id: null,
      relevance_label: 'include_core',
      reviewer_email: 'reviewer@example.test',
      reviewer_user_id: '00000000-0000-4000-8000-000000000005',
      revision: 1,
      revision_kind: 'standard',
      supersedes_review_id: null,
      ...(phase === 'after_v2'
        ? {
            full_text_used: null,
            operation_contract_version: null,
            operation_contract_version_code: 1,
          }
        : {}),
    }
    return {
      actions: [],
      batchId,
      batches: [{ id: batchId, name: 'gold-set-v1' }],
      datasetSplit: 'development',
      drafts: [],
      events: [
        {
          after_value: { reviewId },
          batch_id: batchId,
          before_value: null,
          created_at: '2026-01-01T00:00:04+00:00',
          event_type: 'review_completed',
          id: eventId,
          item_id: itemId,
        },
      ],
      items: [
        {
          automated_signals_revealed_at: null,
          batch_id: batchId,
          current_review_id: reviewId,
          dataset_split: 'development',
          display_order: 1,
          id: itemId,
          pmid: '123',
          supplemental_metadata_revealed_at: null,
        },
      ],
      operations: [],
      reviews: [review],
    }
  }

  test('changes only the schema-sensitive V1 physical hash for the exact V2 additions', () => {
    const before = buildLiteratureGoldV2SchemaNeutralHistoryEvidence({
      phase: 'before_v2',
      rows: rows('before_v2'),
    })
    const after = buildLiteratureGoldV2SchemaNeutralHistoryEvidence({
      phase: 'after_v2',
      rows: rows('after_v2'),
    })
    expect(after.schemaNeutralHistorySha256).toBe(before.schemaNeutralHistorySha256)
    expect(after.componentIdentities).toEqual(before.componentIdentities)
    expect(after.physicalStateSha256V1).toBe(before.expectedPostV1PhysicalStateSha256)
    expect(after.physicalStateSha256V1).not.toBe(before.physicalStateSha256V1)
  })

  test.each([
    [
      'review field',
      (value: LiteratureGoldV2SchemaNeutralHistoryRows) =>
        (mutable(value.reviews[0]!).relevance_label = 'exclude'),
    ],
    [
      'note',
      (value: LiteratureGoldV2SchemaNeutralHistoryRows) =>
        (mutable(value.reviews[0]!).notes = 'changed'),
    ],
    [
      'chain link',
      (value: LiteratureGoldV2SchemaNeutralHistoryRows) =>
        (mutable(value.reviews[0]!).supersedes_review_id = reviewId),
    ],
    [
      'pointer',
      (value: LiteratureGoldV2SchemaNeutralHistoryRows) =>
        (mutable(value.items[0]!).current_review_id = null),
    ],
    [
      'event',
      (value: LiteratureGoldV2SchemaNeutralHistoryRows) =>
        (mutable(value.events[0]!).after_value = { changed: true }),
    ],
    [
      'reveal',
      (value: LiteratureGoldV2SchemaNeutralHistoryRows) =>
        (mutable(value.items[0]!).automated_signals_revealed_at = '2026-01-02T00:00:00+00:00'),
    ],
  ])('binds a %s mutation', (_label, mutate) => {
    const beforeRows = rows('before_v2')
    const changedRows = clone(beforeRows)
    mutate(changedRows)
    const before = buildLiteratureGoldV2SchemaNeutralHistoryEvidence({
      phase: 'before_v2',
      rows: beforeRows,
    })
    const changed = buildLiteratureGoldV2SchemaNeutralHistoryEvidence({
      phase: 'before_v2',
      rows: changedRows,
    })
    expect(changed.schemaNeutralHistorySha256).not.toBe(before.schemaNeutralHistorySha256)
  })

  test('rejects a non-derived value in an excluded V2 field', () => {
    const changed = rows('after_v2')
    mutable(changed.reviews[0]!).full_text_used = false
    expect(() =>
      buildLiteratureGoldV2SchemaNeutralHistoryEvidence({ phase: 'after_v2', rows: changed }),
    ).toThrow('non-schema-only V2 field value')
  })

  test('uses one schema-agnostic collector query with no V2-only column references', () => {
    const sql = literatureGoldV2SchemaNeutralHistoryRowsSql(batchId)
    for (const field of [
      ...LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
      ...LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
    ]) {
      expect(sql).not.toContain(field)
    }
    expect(sql).toContain('literature_gold_set_reviews')
    expect(sql).toContain('literature_gold_review_operation_actions')
  })
})

describe('shared V2 schema-only transition validator', () => {
  test('accepts the exact rehearsed and current-incident transition deterministically', () => {
    const first = validateLiteratureGoldV2SchemaOnlyTransition(incidentTransition())
    const second = validateLiteratureGoldV2SchemaOnlyTransition(incidentTransition())
    expect(second).toEqual(first)
    expect(first).toMatchObject({
      accepted: true,
      physicalTransitionChanged: true,
      reasonCode: LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE,
      transitionPolicyIdentitySha256:
        LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
    })
    expect(first.pre.physicalStateSha256V1).toBe(
      LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.pre.physicalStateSha256V1,
    )
    expect(first.post).toMatchObject({
      effectiveStateSha256V2:
        LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.effectiveStateSha256V2,
      physicalStateSha256V1:
        LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.physicalStateSha256V1,
      physicalStateSha256V2:
        LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.physicalStateSha256V2,
      schemaNeutralHistorySha256:
        LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.post.schemaNeutralHistorySha256,
    })
  })

  test('rejects an arbitrary post physical hash', () => {
    const input = incidentTransition()
    input.after.history.physicalStateSha256V1 = hash('arbitrary physical')
    rebindAfterHistory(input)
    expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow(
      'post V1 physical identity drifted',
    )
  })

  test.each([
    ['review field', 'reviewRowsSha256'],
    ['note', 'reviewRowsSha256'],
    ['chain link', 'reviewRowsSha256'],
    ['pointer', 'pointerStateSha256'],
    ['event', 'eventRowsSha256'],
    ['reveal', 'revealStateSha256'],
  ] as const)('rejects one %s mutation', (label, component) => {
    const input = incidentTransition()
    input.after.history.componentIdentities[component] = hash(`changed ${label}`)
    rebindAfterHistory(input)
    expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow(
      `${component} history identity drifted`,
    )
  })

  test.each(['operations', 'actions'] as const)('rejects one %s mutation', (kind) => {
    const input = incidentTransition()
    input.after.history.counts[kind] = 1
    input.after.history.schemaDerivedFields[
      `${kind === 'operations' ? 'operation' : 'review'}RowCount`
    ] = kind === 'operations' ? 1 : input.after.history.schemaDerivedFields.reviewRowCount
    rebindAfterHistory(input)
    expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow()
  })

  test('rejects catalog drift', () => {
    const input = incidentTransition()
    input.catalogAudit.fullAuditIdentitySha256 = hash('catalog drift')
    expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow(
      'full catalog audit identity drifted',
    )
  })

  test.each(['v1MigrationSha256', 'v2MigrationSha256', 'v2VerifierSha256'] as const)(
    'rejects %s drift',
    (key) => {
      const input = incidentTransition()
      input.sourceIdentities[key] = hash(`changed ${key}`)
      expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow('identity drifted')
    },
  )

  test.each([
    'developmentMembershipSha256',
    'effectiveStateSha256V1',
    'planningStateSha256',
  ] as const)('rejects %s drift', (key) => {
    const input = incidentTransition()
    input.after[key] = hash(`changed ${key}`)
    expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow(`${key} drifted`)
  })

  test('requires schema-neutral history equality', () => {
    const input = incidentTransition()
    input.after.history.schemaNeutralHistorySha256 = hash('changed neutral history')
    rebindAfterHistory(input)
    expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow(
      'schema-neutral full-history identity drifted',
    )
  })

  test.each(['reviews', 'pointers', 'events', 'reveals', 'actions'] as const)(
    'requires zero %s mutation count',
    (key) => {
      const input = incidentTransition()
      input.mutationCounts[key] = 1
      expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow(
        `${key} mutation count must be zero`,
      )
    },
  )

  test('requires unchanged source authorization and exact pre-capture agreement', () => {
    const input = incidentTransition()
    input.after.sourceAuthorizationSha256 = hash('changed authorization')
    expect(() => validateLiteratureGoldV2SchemaOnlyTransition(input)).toThrow(
      'sourceAuthorizationSha256 drifted',
    )
    const capturesDrifted = incidentTransition()
    capturesDrifted.beforeCaptures[1].planningStateSha256 = hash('capture drift')
    expect(() => validateLiteratureGoldV2SchemaOnlyTransition(capturesDrifted)).toThrow(
      'two exact pre-application captures do not agree',
    )
  })
})

describe('capability-free protected V2 transition evidence adapter', () => {
  test.each(['before_v2', 'after_v2'] as const)(
    'uses one repeatable-read read-only %s snapshot and always rolls back',
    (phase) => {
      const sql = buildProtectedV2TransitionSnapshotSql(phase)
      expect(() => assertProtectedV2TransitionEvidenceSqlReadOnly(sql)).not.toThrow()
      expect(sql).toMatch(/^begin transaction isolation level repeatable read read only;/u)
      expect(sql).toMatch(/rollback;$/u)
      expect(sql).not.toMatch(
        /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|call|do|copy|commit)\b/iu,
      )
      expect(sql.includes('literature_gold_effective_state_hash_v2')).toBe(phase === 'after_v2')
    },
  )

  test('has no application, staging, catalog-executor, rehearsal, or migration-capable imports', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'scripts/literature/protected-gold-import-contract-v2-transition-evidence.ts',
      ),
      'utf8',
    )
    expect(source).not.toMatch(
      /from ['"][^'"]*(apply-protected|local-supabase|gold-import-contract-v2-catalog-audit|rehearse|migration-operations)[^'"]*['"]/u,
    )
  })

  test('builds recovery-ready input and invokes the same strict transition validator', () => {
    const before = databaseEvidence('before_v2')
    const transitionInput = buildProtectedV2SchemaOnlyDatabaseTransitionInput({
      after: databaseEvidence('after_v2'),
      beforeCaptures: [before, clone(before)],
      expectedCatalogBindingSha256:
        LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.catalog.expectedCatalogBindingSha256,
      sourceAuthorizationSha256: hash('unchanged-source-authorization'),
    })
    expect(validateProtectedV2SchemaOnlyDatabaseTransition(transitionInput)).toMatchObject({
      accepted: true,
      physicalTransitionChanged: true,
      transitionPolicyIdentitySha256:
        LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
    })
  })
})
