import { createHash } from 'node:crypto'

import { analyzeLegacyGoldImportCompensation } from '@/features/literature/gold-set/legacy-import-analysis'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const REVIEW_CORE = { relevance_label: 'include_core', reviewer_confidence: 'high' }
const CORE_SHA = digest(`${JSON.stringify(REVIEW_CORE, null, 2)}\n`)

function row(
  index: number,
  action: 'insert_initial_review' | 'insert_revision' | 'no_op_identical_review_content',
) {
  const itemId = `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  const priorId =
    action === 'insert_initial_review'
      ? null
      : `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  const reviewId =
    action === 'no_op_identical_review_content'
      ? null
      : `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  return {
    action,
    display_order: index,
    enrichment_metadata: {},
    expected_current_relevance_confidence: priorId ? 'high' : null,
    expected_current_relevance_label: priorId ? 'include_core' : null,
    expected_current_review: priorId ? REVIEW_CORE : null,
    expected_current_review_core_sha256: priorId ? CORE_SHA : null,
    expected_current_review_id: priorId,
    expected_current_revision: priorId ? 1 : null,
    expected_review_status: priorId ? 'completed' : 'pending',
    item_id: itemId,
    new_event_id:
      reviewId === null ? null : `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    new_review_id: reviewId,
    new_revision: reviewId === null ? null : priorId ? 2 : 1,
    pmid: String(1000 + index),
    rollback_item_state: {
      completed_at: priorId ? '2026-08-01T00:00:00.000Z' : null,
      current_review_id: priorId,
      review_status: priorId ? 'completed' : 'pending',
      started_at: priorId ? '2026-08-01T00:00:00.000Z' : null,
    },
    source_relevance_confidence: 'high',
    source_relevance_label: 'include_core',
    supersedes_review_id: action === 'insert_revision' ? priorId : null,
    target_review: REVIEW_CORE,
  }
}

function fixture() {
  const rows = [
    row(1, 'insert_initial_review'),
    row(2, 'insert_revision'),
    row(3, 'no_op_identical_review_content'),
  ]
  const rollbackRows = rows.slice(0, 2).map((entry) => ({
    expected_imported_current_review_core_sha256: CORE_SHA,
    imported_event_id: entry.new_event_id,
    imported_review_id: entry.new_review_id,
    item_id: entry.item_id,
    optimistic_guard_current_review_id: entry.new_review_id,
    pmid: entry.pmid,
    restore_completed_at: entry.rollback_item_state.completed_at,
    restore_current_review_id: entry.rollback_item_state.current_review_id,
    restore_review_status: entry.rollback_item_state.review_status,
    restore_started_at: entry.rollback_item_state.started_at,
  }))
  return {
    plan: {
      rows,
      schema_version: '1.0.0',
      summary: {
        insert_initial_review: 1,
        insert_revision: 1,
        no_op_identical_review_content: 1,
      },
      total_development_rows: 3,
      workflow_id: 'gold-set-v1-enrichment-v3',
    },
    rollback: {
      authorization_required: 'separate explicit rollback authorization',
      data_retention: 'retain immutable rows and restore pointers',
      destructive_deletes: 0,
      rows: rollbackRows,
      schema_version: '2.0.0',
      strategy: 'optimistic pointer restoration',
    },
    validation: {
      database_writes_during_package_generation: 0,
      import_command_executed: false,
      planned_insert_rows: 2,
      planned_no_op_rows: 1,
      schema_version: '2.0.0',
      separate_import_authorization_required: true,
      valid: true,
    },
  }
}

function analysisInput(source = fixture()) {
  const planJson = JSON.stringify(source.plan)
  const rollbackJson = JSON.stringify(source.rollback)
  const validationJson = JSON.stringify(source.validation)
  return {
    planJson,
    rollbackJson,
    validationJson,
    rowPlanSha256: digest(planJson),
    rollbackPlanSha256: digest(rollbackJson),
    validationSha256: digest(validationJson),
  }
}

describe('pending V2 gold import compensation analysis', () => {
  it('maps every legacy action forward without producing an executable mutation plan', () => {
    const report = analyzeLegacyGoldImportCompensation(analysisInput())

    expect(report.importActions).toEqual({ initial: 1, revision: 1, noop: 1, inserts: 2, total: 3 })
    expect(report.compensationMapping).toMatchObject({
      void: 1,
      restore: 1,
      noop: 1,
      insertedReviewsCovered: 2,
      everyRowMapped: true,
    })
    expect(report.compensationMapping.mappingSha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(report.legacyRollback.supportedForExecution).toBe(false)
    expect(report.readiness).toEqual({
      importReady: false,
      rollbackReady: false,
      mutationPlan: null,
    })
    expect(report.safety).toEqual({
      databaseAccess: false,
      databaseWrites: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccess: false,
    })
  })

  it('rejects a revision that skips the current head', () => {
    const source = fixture()
    source.plan.rows[1]!.supersedes_review_id = source.plan.rows[0]!.item_id

    expect(() => analyzeLegacyGoldImportCompensation(analysisInput(source))).toThrow(
      'Legacy revision action has inconsistent chain guards',
    )
  })
})
