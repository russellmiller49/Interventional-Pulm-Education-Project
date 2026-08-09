import { createHash } from 'node:crypto'
import { z } from 'zod'

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u)
const uuidSchema = z.string().uuid()
const nullableUuidSchema = uuidSchema.nullable()

const rollbackItemStateSchema = z
  .object({
    completed_at: z.string().nullable(),
    current_review_id: nullableUuidSchema,
    review_status: z.enum(['pending', 'in_progress', 'return_later', 'completed']),
    started_at: z.string().nullable(),
  })
  .strict()

const legacyRowSchema = z
  .object({
    action: z.enum(['insert_initial_review', 'insert_revision', 'no_op_identical_review_content']),
    display_order: z.number().int().positive(),
    enrichment_metadata: z.record(z.unknown()),
    expected_current_relevance_confidence: z.string().nullable(),
    expected_current_relevance_label: z.string().nullable(),
    expected_current_review: z.record(z.unknown()).nullable(),
    expected_current_review_core_sha256: sha256Schema.nullable(),
    expected_current_review_id: nullableUuidSchema,
    expected_current_revision: z.number().int().positive().nullable(),
    expected_review_status: z.enum(['pending', 'in_progress', 'return_later', 'completed']),
    item_id: uuidSchema,
    new_event_id: nullableUuidSchema,
    new_review_id: nullableUuidSchema,
    new_revision: z.number().int().positive().nullable(),
    pmid: z.string().regex(/^[0-9]{1,12}$/u),
    rollback_item_state: rollbackItemStateSchema,
    source_relevance_confidence: z.string(),
    source_relevance_label: z.string(),
    supersedes_review_id: nullableUuidSchema,
    target_review: z.record(z.unknown()),
  })
  .strict()

export const legacyGoldImportRowPlanSchema = z
  .object({
    rows: z.array(legacyRowSchema).min(1),
    schema_version: z.literal('1.0.0'),
    summary: z
      .object({
        insert_initial_review: z.number().int().nonnegative(),
        insert_revision: z.number().int().nonnegative(),
        no_op_identical_review_content: z.number().int().nonnegative(),
      })
      .strict(),
    total_development_rows: z.number().int().positive(),
    workflow_id: z.literal('gold-set-v1-enrichment-v3'),
  })
  .strict()

const legacyRollbackRowSchema = z
  .object({
    expected_imported_current_review_core_sha256: sha256Schema,
    imported_event_id: uuidSchema,
    imported_review_id: uuidSchema,
    item_id: uuidSchema,
    optimistic_guard_current_review_id: uuidSchema,
    pmid: z.string().regex(/^[0-9]{1,12}$/u),
    restore_completed_at: z.string().nullable(),
    restore_current_review_id: nullableUuidSchema,
    restore_review_status: z.enum(['pending', 'in_progress', 'return_later', 'completed']),
    restore_started_at: z.string().nullable(),
  })
  .strict()

export const legacyPointerRewindRollbackSchema = z
  .object({
    authorization_required: z.string(),
    data_retention: z.string(),
    destructive_deletes: z.number().int().nonnegative(),
    rows: z.array(legacyRollbackRowSchema),
    schema_version: z.literal('2.0.0'),
    strategy: z.string(),
  })
  .strict()

export const legacyImportValidationSchema = z
  .object({
    import_command_executed: z.literal(false),
    planned_insert_rows: z.number().int().nonnegative(),
    planned_no_op_rows: z.number().int().nonnegative(),
    database_writes_during_package_generation: z.literal(0),
    separate_import_authorization_required: z.literal(true),
    schema_version: z.literal('2.0.0'),
    valid: z.literal(true),
  })
  .passthrough()

type LegacyPlan = z.infer<typeof legacyGoldImportRowPlanSchema>

export interface LegacyGoldImportCompensationAnalysis {
  analysisSchemaVersion: '1.0.0'
  contractVersion: 'gold-review-import-compensation/1.0.0'
  sourceChecksumsVerified: true
  source: {
    rowPlanSha256: string
    rollbackPlanSha256: string
    validationSha256: string
  }
  importActions: {
    initial: number
    revision: number
    noop: number
    inserts: number
    total: number
  }
  compensationMapping: {
    void: number
    restore: number
    noop: number
    insertedReviewsCovered: number
    everyRowMapped: true
    mappingSha256: string
  }
  legacyRollback: {
    supportedForExecution: false
    rejectedReason: string
  }
  readiness: {
    importReady: false
    rollbackReady: false
    mutationPlan: null
  }
  safety: {
    databaseAccess: false
    databaseWrites: 0
    heldOutIdentitiesAccessed: false
    remoteDatabaseAccess: false
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalJson(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize)
    if (!candidate || typeof candidate !== 'object') return candidate
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
        .map(([key, nested]) => [key, normalize(nested)]),
    )
  }
  return `${JSON.stringify(normalize(value), null, 2)}\n`
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicates.`)
}

function assertActionShape(row: LegacyPlan['rows'][number]) {
  if (row.action === 'insert_initial_review') {
    if (
      row.expected_current_review_id !== null ||
      row.expected_current_revision !== null ||
      row.supersedes_review_id !== null ||
      row.new_review_id === null ||
      row.new_event_id === null ||
      row.new_revision !== 1
    ) {
      throw new Error('Legacy initial-review action has inconsistent chain guards.')
    }
    return
  }
  if (row.action === 'insert_revision') {
    if (
      row.expected_current_review_id === null ||
      row.expected_current_revision === null ||
      row.supersedes_review_id !== row.expected_current_review_id ||
      row.new_review_id === null ||
      row.new_event_id === null ||
      row.new_revision !== row.expected_current_revision + 1
    ) {
      throw new Error('Legacy revision action has inconsistent chain guards.')
    }
    return
  }
  if (row.new_review_id !== null || row.new_event_id !== null || row.new_revision !== null) {
    throw new Error('Legacy no-op action unexpectedly creates a review or event.')
  }
}

export function analyzeLegacyGoldImportCompensation(options: {
  planJson: string
  rollbackJson: string
  validationJson: string
  rowPlanSha256: string
  rollbackPlanSha256: string
  validationSha256: string
}): LegacyGoldImportCompensationAnalysis {
  const rowPlanSha256 = sha256Schema.parse(options.rowPlanSha256)
  const rollbackPlanSha256 = sha256Schema.parse(options.rollbackPlanSha256)
  const validationSha256 = sha256Schema.parse(options.validationSha256)
  if (
    sha256(options.planJson) !== rowPlanSha256 ||
    sha256(options.rollbackJson) !== rollbackPlanSha256 ||
    sha256(options.validationJson) !== validationSha256
  ) {
    throw new Error('Legacy package source checksum verification failed.')
  }
  const plan = legacyGoldImportRowPlanSchema.parse(JSON.parse(options.planJson) as unknown)
  const rollback = legacyPointerRewindRollbackSchema.parse(
    JSON.parse(options.rollbackJson) as unknown,
  )
  const validation = legacyImportValidationSchema.parse(
    JSON.parse(options.validationJson) as unknown,
  )

  if (plan.total_development_rows !== plan.rows.length) {
    throw new Error('Legacy row plan count does not match its development-row declaration.')
  }
  assertUnique(
    plan.rows.map((row) => row.item_id),
    'Legacy row plan item IDs',
  )
  assertUnique(
    plan.rows.map((row) => row.pmid),
    'Legacy row plan PMIDs',
  )
  plan.rows.forEach(assertActionShape)
  assertUnique(
    plan.rows.flatMap((row) => (row.new_review_id ? [row.new_review_id] : [])),
    'Legacy generated review IDs',
  )
  assertUnique(
    plan.rows.flatMap((row) => (row.new_event_id ? [row.new_event_id] : [])),
    'Legacy generated event IDs',
  )
  for (const row of plan.rows) {
    if (
      row.target_review.relevance_label !== row.source_relevance_label ||
      row.target_review.reviewer_confidence !== row.source_relevance_confidence
    ) {
      throw new Error('Legacy target review changes the finalized relevance decision.')
    }
    if (
      row.rollback_item_state.current_review_id !== row.expected_current_review_id ||
      row.rollback_item_state.review_status !== row.expected_review_status
    ) {
      throw new Error('Legacy rollback item state does not match the planned pre-import state.')
    }
    if (row.expected_current_review_id === null) {
      if (
        row.expected_current_review !== null ||
        row.expected_current_review_core_sha256 !== null ||
        row.expected_current_relevance_label !== null ||
        row.expected_current_relevance_confidence !== null
      ) {
        throw new Error('Legacy initial row has inconsistent expected current-review evidence.')
      }
    } else if (
      row.expected_current_review === null ||
      sha256(canonicalJson(row.expected_current_review)) !==
        row.expected_current_review_core_sha256 ||
      row.expected_current_review.relevance_label !== row.expected_current_relevance_label ||
      row.expected_current_review.reviewer_confidence !== row.expected_current_relevance_confidence
    ) {
      throw new Error('Legacy expected current-review content or checksum is inconsistent.')
    }
    if (
      row.action === 'no_op_identical_review_content' &&
      canonicalJson(row.target_review) !== canonicalJson(row.expected_current_review)
    ) {
      throw new Error('Legacy no-op target differs from the current review content.')
    }
  }

  const initial = plan.rows.filter((row) => row.action === 'insert_initial_review').length
  const revision = plan.rows.filter((row) => row.action === 'insert_revision').length
  const noop = plan.rows.filter((row) => row.action === 'no_op_identical_review_content').length
  if (
    initial !== plan.summary.insert_initial_review ||
    revision !== plan.summary.insert_revision ||
    noop !== plan.summary.no_op_identical_review_content ||
    initial + revision !== validation.planned_insert_rows ||
    noop !== validation.planned_no_op_rows
  ) {
    throw new Error('Legacy package action counts do not reconcile.')
  }

  assertUnique(
    rollback.rows.map((row) => row.item_id),
    'Legacy rollback item IDs',
  )
  assertUnique(
    rollback.rows.map((row) => row.imported_review_id),
    'Legacy rollback review IDs',
  )
  assertUnique(
    rollback.rows.map((row) => row.imported_event_id),
    'Legacy rollback event IDs',
  )
  const rollbackByItem = new Map(rollback.rows.map((row) => [row.item_id, row]))
  const compensationMapping = plan.rows.map((row) => {
    const rollbackRow = rollbackByItem.get(row.item_id)
    if (row.action === 'no_op_identical_review_content') {
      if (rollbackRow) throw new Error('Legacy rollback unexpectedly includes a no-op item.')
      return {
        itemId: row.item_id,
        pmid: row.pmid,
        importAction: row.action,
        importedReviewId: null,
        preImportCurrentReviewId: row.expected_current_review_id,
        compensationAction: 'compensate_noop',
        expectedCompensationRevision: null,
        expectedSupersedesReviewId: null,
        expectedEffectiveReviewIdAfter: row.expected_current_review_id,
        expectedEvents: [] as string[],
        idempotencyKey: sha256(`noop\0${row.item_id}\0${row.pmid}`),
      }
    }
    if (
      !rollbackRow ||
      rollbackRow.pmid !== row.pmid ||
      rollbackRow.imported_review_id !== row.new_review_id ||
      rollbackRow.imported_event_id !== row.new_event_id ||
      rollbackRow.optimistic_guard_current_review_id !== row.new_review_id ||
      rollbackRow.expected_imported_current_review_core_sha256 !==
        sha256(canonicalJson(row.target_review)) ||
      rollbackRow.restore_current_review_id !== row.expected_current_review_id ||
      rollbackRow.restore_review_status !== row.expected_review_status ||
      rollbackRow.restore_started_at !== row.rollback_item_state.started_at ||
      rollbackRow.restore_completed_at !== row.rollback_item_state.completed_at
    ) {
      throw new Error('Legacy rollback rows do not cover every inserted review exactly.')
    }
    const compensationAction =
      row.action === 'insert_initial_review' ? 'compensate_void' : 'compensate_restore'
    return {
      itemId: row.item_id,
      pmid: row.pmid,
      importAction: row.action,
      importedReviewId: row.new_review_id,
      preImportCurrentReviewId: row.expected_current_review_id,
      compensationAction,
      expectedCompensationRevision: (row.new_revision ?? 0) + 1,
      expectedSupersedesReviewId: row.new_review_id,
      expectedEffectiveReviewIdAfter: row.expected_current_review_id,
      expectedEvents: [
        compensationAction === 'compensate_void' ? 'review_voided' : 'review_compensated',
      ],
      idempotencyKey: sha256(`${compensationAction}\0${row.item_id}\0${row.new_review_id}`),
    }
  })

  if (rollback.rows.length !== initial + revision) {
    throw new Error('Legacy rollback row count does not equal the inserted-review count.')
  }

  return {
    analysisSchemaVersion: '1.0.0',
    contractVersion: 'gold-review-import-compensation/1.0.0',
    sourceChecksumsVerified: true,
    source: { rowPlanSha256, rollbackPlanSha256, validationSha256 },
    importActions: {
      initial,
      revision,
      noop,
      inserts: initial + revision,
      total: plan.rows.length,
    },
    compensationMapping: {
      void: initial,
      restore: revision,
      noop,
      insertedReviewsCovered: initial + revision,
      everyRowMapped: true,
      mappingSha256: sha256(JSON.stringify(compensationMapping)),
    },
    legacyRollback: {
      supportedForExecution: false,
      rejectedReason:
        'Pointer restoration retains later immutable reviews while moving current_review_id behind the chain head.',
    },
    readiness: { importReady: false, rollbackReady: false, mutationPlan: null },
    safety: {
      databaseAccess: false,
      databaseWrites: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccess: false,
    },
  }
}
