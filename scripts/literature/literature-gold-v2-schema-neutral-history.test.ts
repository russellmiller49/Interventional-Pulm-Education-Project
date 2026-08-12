import {
  LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_EVIDENCE_VERSION,
  LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_VERSION,
  buildLiteratureGoldV2SchemaNeutralHistoryEvidence,
  buildLiteratureGoldV2SchemaNeutralHistoryProjection,
  type LiteratureGoldV2SchemaNeutralHistoryRows,
} from './literature-gold-v2-schema-neutral-history'

type ProtectedHistoryRowsCollection = Exclude<
  keyof LiteratureGoldV2SchemaNeutralHistoryRows,
  'batchId' | 'datasetSplit'
>

const BATCH_ID = '00000000-0000-4000-8000-000000000001'
const ITEM_1_ID = '00000000-0000-4000-8000-000000000002'
const ITEM_2_ID = '00000000-0000-4000-8000-000000000003'
const REVIEW_1_ID = '00000000-0000-4000-8000-000000000004'
const REVIEW_2_ID = '00000000-0000-4000-8000-000000000005'
const EVENT_1_ID = '00000000-0000-4000-8000-000000000006'
const EVENT_2_ID = '00000000-0000-4000-8000-000000000007'
const OPERATION_1_ID = '00000000-0000-4000-8000-000000000008'
const OPERATION_2_ID = '00000000-0000-4000-8000-000000000009'
const ACTION_1_ID = '00000000-0000-4000-8000-00000000000a'
const ACTION_2_ID = '00000000-0000-4000-8000-00000000000b'
const V1_OPERATION_CONTRACT_VERSION = 'gold-review-import-compensation/1.0.0'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function historyRows(
  phase: 'before_v2' | 'after_v2' = 'before_v2',
): LiteratureGoldV2SchemaNeutralHistoryRows {
  const reviewSchemaFields =
    phase === 'after_v2'
      ? {
          full_text_used: null,
          operation_contract_version: null,
          operation_contract_version_code: 1,
        }
      : {}
  const operationSchemaFields =
    phase === 'after_v2' ? { contract_version: V1_OPERATION_CONTRACT_VERSION } : {}
  return {
    actions: [
      {
        action_kind: 'append_review',
        action_sequence: 1,
        id: ACTION_1_ID,
        item_id: ITEM_1_ID,
        operation_id: OPERATION_1_ID,
        payload: { relevance: 'include_core' },
      },
      {
        action_kind: 'append_review',
        action_sequence: 1,
        id: ACTION_2_ID,
        item_id: ITEM_2_ID,
        operation_id: OPERATION_2_ID,
        payload: { relevance: 'include_core' },
      },
    ],
    batchId: BATCH_ID,
    batches: [{ id: BATCH_ID, name: 'gold-set-v1' }],
    datasetSplit: 'development',
    drafts: [
      { item_id: ITEM_1_ID, notes: 'same clinical content', reviewer_email: 'one@example.test' },
      { item_id: ITEM_2_ID, notes: 'same clinical content', reviewer_email: 'two@example.test' },
    ],
    events: [
      {
        after_value: { result: 'saved' },
        batch_id: BATCH_ID,
        created_at: '2026-01-01T00:00:05+00:00',
        event_type: 'review_completed',
        id: EVENT_1_ID,
        item_id: ITEM_1_ID,
      },
      {
        after_value: { result: 'saved' },
        batch_id: BATCH_ID,
        created_at: '2026-01-01T00:00:06+00:00',
        event_type: 'review_completed',
        id: EVENT_2_ID,
        item_id: ITEM_2_ID,
      },
    ],
    items: [
      {
        automated_signals_revealed_at: null,
        batch_id: BATCH_ID,
        current_review_id: REVIEW_1_ID,
        dataset_split: 'development',
        display_order: 1,
        id: ITEM_1_ID,
        pmid: '101',
        supplemental_metadata_revealed_at: null,
      },
      {
        automated_signals_revealed_at: null,
        batch_id: BATCH_ID,
        current_review_id: REVIEW_2_ID,
        dataset_split: 'development',
        display_order: 2,
        id: ITEM_2_ID,
        pmid: '102',
        supplemental_metadata_revealed_at: null,
      },
    ],
    operations: [
      {
        ...operationSchemaFields,
        batch_id: BATCH_ID,
        dataset_split: 'development',
        id: OPERATION_1_ID,
        operation_kind: 'import',
        started_at: '2026-01-01T00:00:03+00:00',
      },
      {
        ...operationSchemaFields,
        batch_id: BATCH_ID,
        dataset_split: 'development',
        id: OPERATION_2_ID,
        operation_kind: 'compensation',
        started_at: '2026-01-01T00:00:04+00:00',
      },
    ],
    reviews: [
      {
        ...reviewSchemaFields,
        id: REVIEW_1_ID,
        item_id: ITEM_1_ID,
        notes: 'same clinical content',
        relevance_label: 'include_core',
        revision: 1,
        revision_kind: 'standard',
      },
      {
        ...reviewSchemaFields,
        id: REVIEW_2_ID,
        item_id: ITEM_2_ID,
        notes: 'same clinical content',
        relevance_label: 'include_core',
        revision: 1,
        revision_kind: 'standard',
      },
    ],
  }
}

function appendRow(
  rows: LiteratureGoldV2SchemaNeutralHistoryRows,
  collection: ProtectedHistoryRowsCollection,
  row: Readonly<Record<string, unknown>>,
): void {
  const selectedRows = rows[collection] as Array<Readonly<Record<string, unknown>>>
  selectedRows.push(row)
}

function evidence(rows: LiteratureGoldV2SchemaNeutralHistoryRows) {
  return buildLiteratureGoldV2SchemaNeutralHistoryEvidence({ phase: 'before_v2', rows })
}

describe('schema-neutral protected-history uniqueness', () => {
  test.each([
    [
      'batch id',
      'batches',
      (row: Record<string, unknown>) => {
        row.name = 'changed-batch-content'
      },
      'id',
    ],
    [
      'item id',
      'items',
      (row: Record<string, unknown>) => {
        row.pmid = '999'
      },
      'id',
    ],
    [
      'review id',
      'reviews',
      (row: Record<string, unknown>) => {
        row.notes = 'changed review content'
      },
      'id',
    ],
    [
      'draft item id',
      'drafts',
      (row: Record<string, unknown>) => {
        row.notes = 'changed draft content'
      },
      'item_id',
    ],
    [
      'event id',
      'events',
      (row: Record<string, unknown>) => {
        row.after_value = { result: 'changed' }
      },
      'id',
    ],
    [
      'operation id',
      'operations',
      (row: Record<string, unknown>) => {
        row.operation_kind = 'compensation'
      },
      'id',
    ],
    [
      'action id',
      'actions',
      (row: Record<string, unknown>) => {
        row.operation_id = OPERATION_2_ID
        row.action_sequence = 2
      },
      'id',
    ],
  ] as const)('rejects duplicate %s with different content', (_label, collection, change, key) => {
    const rows = historyRows()
    const duplicate = clone(rows[collection][0]!) as Record<string, unknown>
    change(duplicate)
    appendRow(rows, collection, duplicate)
    expect(() => evidence(rows)).toThrow(
      `Schema-neutral history ${collection} primary identity ${key} is duplicated.`,
    )
  })

  test.each(['actions', 'drafts', 'events', 'items', 'operations', 'reviews'] as const)(
    'rejects an exact cloned %s canonical projection',
    (collection) => {
      const rows = historyRows()
      appendRow(rows, collection, clone(rows[collection][0]!))
      expect(() => evidence(rows)).toThrow(
        `Schema-neutral history ${collection} canonical projected row is duplicated.`,
      )
    },
  )

  test('rejects a cloned row even when its object keys are reordered', () => {
    const rows = historyRows()
    const reordered = Object.fromEntries(Object.entries(rows.events[0]!).reverse())
    appendRow(rows, 'events', reordered)
    expect(() => evidence(rows)).toThrow(
      'Schema-neutral history events canonical projected row is duplicated.',
    )
  })

  test('compares reviews and operations after only their permitted schema-derived exclusions', () => {
    const rows = historyRows('after_v2')
    appendRow(rows, 'reviews', { ...rows.reviews[0], full_text_used: false })
    expect(() =>
      buildLiteratureGoldV2SchemaNeutralHistoryEvidence({ phase: 'after_v2', rows }),
    ).toThrow('Schema-neutral history reviews canonical projected row is duplicated.')

    const operationRows = historyRows('after_v2')
    appendRow(operationRows, 'operations', {
      ...operationRows.operations[0],
      contract_version: 'changed-only-excluded-field',
    })
    expect(() =>
      buildLiteratureGoldV2SchemaNeutralHistoryEvidence({
        phase: 'after_v2',
        rows: operationRows,
      }),
    ).toThrow('Schema-neutral history operations canonical projected row is duplicated.')
  })

  test('permits distinct identities with similar clinical content and shared event payloads', () => {
    const built = evidence(historyRows())
    expect(built.counts).toMatchObject({ drafts: 2, events: 2, reviews: 2 })
  })

  test('enforces the action id primary key across different operations', () => {
    const rows = historyRows()
    appendRow(rows, 'actions', {
      ...rows.actions[0],
      action_sequence: 2,
      operation_id: OPERATION_2_ID,
    })
    expect(() => evidence(rows)).toThrow(
      'Schema-neutral history actions primary identity id is duplicated.',
    )
  })

  test('protects both exported builders and returns no evidence for rejected input', () => {
    const projectionRows = historyRows()
    appendRow(projectionRows, 'reviews', clone(projectionRows.reviews[0]!))
    expect(() => buildLiteratureGoldV2SchemaNeutralHistoryProjection(projectionRows)).toThrow(
      'Schema-neutral history reviews canonical projected row is duplicated.',
    )

    let builtEvidence:
      | ReturnType<typeof buildLiteratureGoldV2SchemaNeutralHistoryEvidence>
      | undefined
    expect(() => {
      builtEvidence = evidence(projectionRows)
    }).toThrow('Schema-neutral history reviews canonical projected row is duplicated.')
    expect(builtEvidence).toBeUndefined()
  })

  test('preserves valid projection and evidence versions and schema-neutral identity', () => {
    const before = evidence(historyRows('before_v2'))
    const after = buildLiteratureGoldV2SchemaNeutralHistoryEvidence({
      phase: 'after_v2',
      rows: historyRows('after_v2'),
    })
    expect(LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_VERSION).toBe(
      'literature-gold-schema-neutral-physical-history/1.0.0',
    )
    expect(LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_EVIDENCE_VERSION).toBe(
      'literature-gold-schema-neutral-physical-history-evidence/1.0.0',
    )
    expect(after.schemaNeutralHistorySha256).toBe(before.schemaNeutralHistorySha256)
    expect(after.componentIdentities).toEqual(before.componentIdentities)
  })
})
