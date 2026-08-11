import { createHash } from 'node:crypto'

export const LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_VERSION =
  'literature-gold-schema-neutral-physical-history/1.0.0' as const

export const LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_EVIDENCE_VERSION =
  'literature-gold-schema-neutral-physical-history-evidence/1.0.0' as const

export const LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS = [
  'full_text_used',
  'operation_contract_version_code',
  'operation_contract_version',
] as const

export const LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS = ['contract_version'] as const

const V1_OPERATION_CONTRACT_VERSION = 'gold-review-import-compensation/1.0.0' as const
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u

type JsonRow = Readonly<Record<string, unknown>>

export interface LiteratureGoldV2SchemaNeutralHistoryRows {
  actions: readonly JsonRow[]
  batchId: string
  batches: readonly JsonRow[]
  datasetSplit: 'development'
  drafts: readonly JsonRow[]
  events: readonly JsonRow[]
  items: readonly JsonRow[]
  operations: readonly JsonRow[]
  reviews: readonly JsonRow[]
}

export interface LiteratureGoldV2SchemaNeutralHistoryProjection {
  actions: readonly JsonRow[]
  batchId: string
  batches: readonly JsonRow[]
  datasetSplit: 'development'
  drafts: readonly JsonRow[]
  events: readonly JsonRow[]
  items: readonly JsonRow[]
  operations: readonly JsonRow[]
  projectionVersion: typeof LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_VERSION
  reviews: readonly JsonRow[]
}

export interface LiteratureGoldV2SchemaNeutralHistoryComponentIdentities {
  actionRowsSha256: string
  batchRowsSha256: string
  draftRowsSha256: string
  eventRowsSha256: string
  itemRowsSha256: string
  operationRowsSha256: string
  pointerStateSha256: string
  revealStateSha256: string
  reviewRowsSha256: string
}

export interface LiteratureGoldV2SchemaNeutralHistoryCounts {
  actions: number
  batches: number
  drafts: number
  events: number
  items: number
  operations: number
  reviews: number
}

export interface LiteratureGoldV2SchemaDerivedFieldEvidence {
  operationFields: typeof LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS
  operationRowCount: number
  operationValuesSha256: string
  reviewFields: typeof LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS
  reviewRowCount: number
  reviewValuesSha256: string
}

export type LiteratureGoldV2SchemaOnlyTransitionPhase = 'before_v2' | 'after_v2'

export interface LiteratureGoldV2SchemaNeutralHistoryEvidence {
  batchId: string
  bindingSha256: string
  componentIdentities: LiteratureGoldV2SchemaNeutralHistoryComponentIdentities
  counts: LiteratureGoldV2SchemaNeutralHistoryCounts
  datasetSplit: 'development'
  expectedPostV1PhysicalStateSha256: string
  phase: LiteratureGoldV2SchemaOnlyTransitionPhase
  physicalStateSha256V1: string
  schemaDerivedFields: LiteratureGoldV2SchemaDerivedFieldEvidence
  schemaNeutralHistorySha256: string
  schemaVersion: typeof LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_EVIDENCE_VERSION
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareNullable(left: unknown, right: unknown): number {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1
  if (right === null || right === undefined) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return compareCodeUnits(String(left), String(right))
}

function requiredString(row: JsonRow, key: string, label: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}.${key} must be a nonempty string.`)
  }
  return value
}

function sortedCanonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error('Canonical history JSON rejects non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(sortedCanonicalValue)
  if (!isRecord(value)) throw new Error(`Canonical history JSON rejects ${typeof value}.`)
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCodeUnits)
      .map((key) => {
        if (value[key] === undefined) {
          throw new Error(`Canonical history JSON rejects undefined at ${key}.`)
        }
        return [key, sortedCanonicalValue(value[key])]
      }),
  )
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function sha256Canonical(value: unknown): string {
  return sha256(`${JSON.stringify(sortedCanonicalValue(value), null, 2)}\n`)
}

function sha256ContractCanonical(value: unknown): string {
  return sha256(JSON.stringify(sortedCanonicalValue(value)))
}

function withoutKeys(row: JsonRow, keys: readonly string[]): JsonRow {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)))
}

function assertScope(rows: LiteratureGoldV2SchemaNeutralHistoryRows): void {
  if (!UUID_PATTERN.test(rows.batchId) || rows.datasetSplit !== 'development') {
    throw new Error('Schema-neutral history requires one valid development batch scope.')
  }
  if (
    rows.batches.length !== 1 ||
    requiredString(rows.batches[0]!, 'id', 'batch') !== rows.batchId
  ) {
    throw new Error('Schema-neutral history requires exactly one matching batch row.')
  }
  const itemIds = new Set<string>()
  for (const [index, item] of rows.items.entries()) {
    const label = `items[${index}]`
    const id = requiredString(item, 'id', label)
    if (
      itemIds.has(id) ||
      requiredString(item, 'batch_id', label) !== rows.batchId ||
      item.dataset_split !== 'development'
    ) {
      throw new Error(`${label} is outside or duplicates the selected development scope.`)
    }
    itemIds.add(id)
  }
  for (const [kind, selectedRows] of [
    ['review', rows.reviews],
    ['draft', rows.drafts],
  ] as const) {
    selectedRows.forEach((row, index) => {
      if (!itemIds.has(requiredString(row, 'item_id', `${kind}s[${index}]`))) {
        throw new Error(`${kind}s[${index}] is outside the selected development items.`)
      }
    })
  }
  rows.events.forEach((event, index) => {
    if (requiredString(event, 'batch_id', `events[${index}]`) !== rows.batchId) {
      throw new Error(`events[${index}] is outside the selected batch.`)
    }
    if (
      event.item_id !== null &&
      !itemIds.has(requiredString(event, 'item_id', `events[${index}]`))
    ) {
      throw new Error(`events[${index}] is outside the selected development items.`)
    }
  })
  const operationIds = new Set<string>()
  rows.operations.forEach((operation, index) => {
    const label = `operations[${index}]`
    const id = requiredString(operation, 'id', label)
    if (
      operationIds.has(id) ||
      requiredString(operation, 'batch_id', label) !== rows.batchId ||
      operation.dataset_split !== 'development'
    ) {
      throw new Error(`${label} is outside or duplicates the selected development scope.`)
    }
    operationIds.add(id)
  })
  rows.actions.forEach((action, index) => {
    if (!operationIds.has(requiredString(action, 'operation_id', `actions[${index}]`))) {
      throw new Error(`actions[${index}] is outside the selected operations.`)
    }
  })
}

function assertSchemaDerivedFields(
  phase: LiteratureGoldV2SchemaOnlyTransitionPhase,
  rows: LiteratureGoldV2SchemaNeutralHistoryRows,
): void {
  const hasOwn = (row: JsonRow, key: string) => Object.prototype.hasOwnProperty.call(row, key)
  rows.reviews.forEach((review, index) => {
    const label = `reviews[${index}]`
    if (phase === 'before_v2') {
      if (LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS.some((key) => hasOwn(review, key))) {
        throw new Error(`${label} contains a V2-only field before V2.`)
      }
      return
    }
    if (LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS.some((key) => !hasOwn(review, key))) {
      throw new Error(`${label} is missing a required V2 schema-derived field.`)
    }
    const expectedVersion =
      review.revision_kind === 'standard' ? null : V1_OPERATION_CONTRACT_VERSION
    if (
      review.full_text_used !== null ||
      review.operation_contract_version_code !== 1 ||
      review.operation_contract_version !== expectedVersion
    ) {
      throw new Error(`${label} has a non-schema-only V2 field value.`)
    }
  })
  rows.operations.forEach((operation, index) => {
    const label = `operations[${index}]`
    if (phase === 'before_v2') {
      if (hasOwn(operation, 'contract_version')) {
        throw new Error(`${label} contains a V2-only field before V2.`)
      }
      return
    }
    if (operation.contract_version !== V1_OPERATION_CONTRACT_VERSION) {
      throw new Error(`${label}.contract_version is not the schema-derived V1 default.`)
    }
  })
}

function sortedRows(rows: LiteratureGoldV2SchemaNeutralHistoryRows) {
  const items = [...rows.items].sort(
    (left, right) =>
      compareNullable(left.display_order, right.display_order) ||
      compareCodeUnits(requiredString(left, 'id', 'item'), requiredString(right, 'id', 'item')),
  )
  const itemById = new Map(items.map((item) => [requiredString(item, 'id', 'item'), item]))
  const itemOrder = (row: JsonRow) => itemById.get(requiredString(row, 'item_id', 'scoped row'))!
  const reviews = [...rows.reviews].sort((left, right) => {
    const leftItem = itemOrder(left)
    const rightItem = itemOrder(right)
    return (
      compareNullable(leftItem.display_order, rightItem.display_order) ||
      compareCodeUnits(
        requiredString(leftItem, 'id', 'review item'),
        requiredString(rightItem, 'id', 'review item'),
      ) ||
      compareNullable(left.revision, right.revision) ||
      compareCodeUnits(requiredString(left, 'id', 'review'), requiredString(right, 'id', 'review'))
    )
  })
  const operations = [...rows.operations].sort(
    (left, right) =>
      compareNullable(left.started_at, right.started_at) ||
      compareCodeUnits(
        requiredString(left, 'id', 'operation'),
        requiredString(right, 'id', 'operation'),
      ),
  )
  const operationById = new Map(
    operations.map((operation) => [requiredString(operation, 'id', 'operation'), operation]),
  )
  return {
    actions: [...rows.actions].sort((left, right) => {
      const leftOperation = operationById.get(requiredString(left, 'operation_id', 'action'))!
      const rightOperation = operationById.get(requiredString(right, 'operation_id', 'action'))!
      return (
        compareNullable(leftOperation.started_at, rightOperation.started_at) ||
        compareCodeUnits(
          requiredString(leftOperation, 'id', 'action operation'),
          requiredString(rightOperation, 'id', 'action operation'),
        ) ||
        compareNullable(left.action_sequence, right.action_sequence)
      )
    }),
    batches: [...rows.batches].sort((left, right) =>
      compareCodeUnits(requiredString(left, 'id', 'batch'), requiredString(right, 'id', 'batch')),
    ),
    drafts: [...rows.drafts].sort((left, right) => {
      const leftItem = itemOrder(left)
      const rightItem = itemOrder(right)
      return (
        compareNullable(leftItem.display_order, rightItem.display_order) ||
        compareCodeUnits(
          requiredString(leftItem, 'id', 'draft item'),
          requiredString(rightItem, 'id', 'draft item'),
        )
      )
    }),
    events: [...rows.events].sort(
      (left, right) =>
        compareNullable(left.created_at, right.created_at) ||
        compareCodeUnits(requiredString(left, 'id', 'event'), requiredString(right, 'id', 'event')),
    ),
    itemById,
    items,
    operations,
    reviews,
  }
}

export function buildLiteratureGoldV2SchemaNeutralHistoryProjection(
  rows: LiteratureGoldV2SchemaNeutralHistoryRows,
): LiteratureGoldV2SchemaNeutralHistoryProjection {
  assertScope(rows)
  const sorted = sortedRows(rows)
  return {
    actions: sorted.actions,
    batchId: rows.batchId,
    batches: sorted.batches,
    datasetSplit: 'development',
    drafts: sorted.drafts,
    events: sorted.events,
    items: sorted.items,
    operations: sorted.operations.map((row) =>
      withoutKeys(row, LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS),
    ),
    projectionVersion: LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_VERSION,
    reviews: sorted.reviews.map((row) =>
      withoutKeys(row, LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS),
    ),
  }
}

function physicalProjection(
  rows: LiteratureGoldV2SchemaNeutralHistoryRows,
  mode: 'observed' | 'expected_post_v2',
) {
  const sorted = sortedRows(rows)
  const itemById = sorted.itemById
  const comparePmid = (left: JsonRow, right: JsonRow) => {
    const leftPmid = requiredString(left, 'pmid', 'item')
    const rightPmid = requiredString(right, 'pmid', 'item')
    if (!/^\d+$/u.test(leftPmid) || !/^\d+$/u.test(rightPmid)) {
      throw new Error('Physical history requires numeric PMID strings.')
    }
    const leftNumber = BigInt(leftPmid)
    const rightNumber = BigInt(rightPmid)
    return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0
  }
  const items = [...rows.items].sort(
    (left, right) =>
      comparePmid(left, right) ||
      compareCodeUnits(requiredString(left, 'id', 'item'), requiredString(right, 'id', 'item')),
  )
  const projectReview = (review: JsonRow) => {
    if (mode === 'observed') return review
    const base = withoutKeys(review, LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS)
    return {
      ...base,
      full_text_used: null,
      operation_contract_version:
        base.revision_kind === 'standard' ? null : V1_OPERATION_CONTRACT_VERSION,
      operation_contract_version_code: 1,
    }
  }
  const reviews = [...rows.reviews]
    .sort((left, right) => {
      const leftItem = itemById.get(requiredString(left, 'item_id', 'review'))!
      const rightItem = itemById.get(requiredString(right, 'item_id', 'review'))!
      return (
        comparePmid(leftItem, rightItem) ||
        compareNullable(left.revision, right.revision) ||
        compareCodeUnits(
          requiredString(left, 'id', 'review'),
          requiredString(right, 'id', 'review'),
        )
      )
    })
    .map(projectReview)
  const operations = sorted.operations.map((operation) => {
    const base = withoutKeys(operation, [
      'pre_physical_state_sha256',
      'post_physical_state_sha256',
      'pre_effective_state_sha256',
      'post_effective_state_sha256',
    ])
    return mode === 'expected_post_v2'
      ? {
          ...withoutKeys(base, ['contract_version']),
          contract_version: V1_OPERATION_CONTRACT_VERSION,
        }
      : base
  })
  return {
    actions: sorted.actions,
    batch: sorted.batches[0]!,
    datasetSplit: 'development',
    drafts: [...rows.drafts].sort((left, right) => {
      const leftItem = itemById.get(requiredString(left, 'item_id', 'draft'))!
      const rightItem = itemById.get(requiredString(right, 'item_id', 'draft'))!
      return (
        comparePmid(leftItem, rightItem) ||
        compareCodeUnits(String(left.item_id), String(right.item_id))
      )
    }),
    events: sorted.events,
    items,
    operations,
    projectionVersion: 'literature-gold-physical-audit-state-v1',
    reviews,
  }
}

function evidenceBinding(
  evidence: Omit<LiteratureGoldV2SchemaNeutralHistoryEvidence, 'bindingSha256'>,
): string {
  return sha256Canonical(evidence)
}

export function buildLiteratureGoldV2SchemaNeutralHistoryEvidence(input: {
  phase: LiteratureGoldV2SchemaOnlyTransitionPhase
  rows: LiteratureGoldV2SchemaNeutralHistoryRows
}): LiteratureGoldV2SchemaNeutralHistoryEvidence {
  assertScope(input.rows)
  assertSchemaDerivedFields(input.phase, input.rows)
  const projection = buildLiteratureGoldV2SchemaNeutralHistoryProjection(input.rows)
  const pointers = projection.items.map((item) => ({
    currentReviewId: item.current_review_id ?? null,
    itemId: item.id,
  }))
  const reveals = projection.items.map((item) => ({
    automatedSignalsRevealedAt: item.automated_signals_revealed_at ?? null,
    itemId: item.id,
    supplementalMetadataRevealedAt: item.supplemental_metadata_revealed_at ?? null,
  }))
  const reviewValues = input.rows.reviews.map((review) => ({
    full_text_used: Object.prototype.hasOwnProperty.call(review, 'full_text_used')
      ? review.full_text_used
      : { absent: true },
    id: review.id,
    operation_contract_version: Object.prototype.hasOwnProperty.call(
      review,
      'operation_contract_version',
    )
      ? review.operation_contract_version
      : { absent: true },
    operation_contract_version_code: Object.prototype.hasOwnProperty.call(
      review,
      'operation_contract_version_code',
    )
      ? review.operation_contract_version_code
      : { absent: true },
  }))
  const operationValues = input.rows.operations.map((operation) => ({
    contract_version: Object.prototype.hasOwnProperty.call(operation, 'contract_version')
      ? operation.contract_version
      : { absent: true },
    id: operation.id,
  }))
  const unsigned: Omit<LiteratureGoldV2SchemaNeutralHistoryEvidence, 'bindingSha256'> = {
    batchId: input.rows.batchId,
    componentIdentities: {
      actionRowsSha256: sha256Canonical(projection.actions),
      batchRowsSha256: sha256Canonical(projection.batches),
      draftRowsSha256: sha256Canonical(projection.drafts),
      eventRowsSha256: sha256Canonical(projection.events),
      itemRowsSha256: sha256Canonical(projection.items),
      operationRowsSha256: sha256Canonical(projection.operations),
      pointerStateSha256: sha256Canonical(pointers),
      revealStateSha256: sha256Canonical(reveals),
      reviewRowsSha256: sha256Canonical(projection.reviews),
    },
    counts: {
      actions: projection.actions.length,
      batches: projection.batches.length,
      drafts: projection.drafts.length,
      events: projection.events.length,
      items: projection.items.length,
      operations: projection.operations.length,
      reviews: projection.reviews.length,
    },
    datasetSplit: 'development',
    expectedPostV1PhysicalStateSha256: sha256ContractCanonical(
      physicalProjection(input.rows, 'expected_post_v2'),
    ),
    phase: input.phase,
    physicalStateSha256V1: sha256ContractCanonical(physicalProjection(input.rows, 'observed')),
    schemaDerivedFields: {
      operationFields: LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
      operationRowCount: input.rows.operations.length,
      operationValuesSha256: sha256Canonical(operationValues),
      reviewFields: LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
      reviewRowCount: input.rows.reviews.length,
      reviewValuesSha256: sha256Canonical(reviewValues),
    },
    schemaNeutralHistorySha256: sha256Canonical(projection),
    schemaVersion: LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_EVIDENCE_VERSION,
  }
  return { ...unsigned, bindingSha256: evidenceBinding(unsigned) }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  if (
    JSON.stringify(Object.keys(value).sort(compareCodeUnits)) !==
    JSON.stringify([...keys].sort(compareCodeUnits))
  ) {
    throw new Error(`${label} has unexpected or missing keys.`)
  }
}

export function validateLiteratureGoldV2SchemaNeutralHistoryEvidence(
  value: unknown,
  expectedPhase: LiteratureGoldV2SchemaOnlyTransitionPhase,
): LiteratureGoldV2SchemaNeutralHistoryEvidence {
  if (!isRecord(value)) throw new Error('Schema-neutral history evidence must be an object.')
  exactKeys(
    value,
    [
      'batchId',
      'bindingSha256',
      'componentIdentities',
      'counts',
      'datasetSplit',
      'expectedPostV1PhysicalStateSha256',
      'phase',
      'physicalStateSha256V1',
      'schemaDerivedFields',
      'schemaNeutralHistorySha256',
      'schemaVersion',
    ],
    'schema-neutral history evidence',
  )
  if (
    value.schemaVersion !== LITERATURE_GOLD_V2_SCHEMA_NEUTRAL_HISTORY_EVIDENCE_VERSION ||
    value.phase !== expectedPhase ||
    value.datasetSplit !== 'development' ||
    typeof value.batchId !== 'string' ||
    !UUID_PATTERN.test(value.batchId)
  ) {
    throw new Error('Schema-neutral history evidence header is invalid.')
  }
  if (
    !isRecord(value.componentIdentities) ||
    !isRecord(value.counts) ||
    !isRecord(value.schemaDerivedFields)
  ) {
    throw new Error('Schema-neutral history evidence bodies must be objects.')
  }
  const componentIdentities = value.componentIdentities
  const counts = value.counts
  const schemaDerivedFields = value.schemaDerivedFields
  const componentKeys = [
    'actionRowsSha256',
    'batchRowsSha256',
    'draftRowsSha256',
    'eventRowsSha256',
    'itemRowsSha256',
    'operationRowsSha256',
    'pointerStateSha256',
    'revealStateSha256',
    'reviewRowsSha256',
  ] as const
  exactKeys(componentIdentities, componentKeys, 'history component identities')
  const countKeys = [
    'actions',
    'batches',
    'drafts',
    'events',
    'items',
    'operations',
    'reviews',
  ] as const
  exactKeys(counts, countKeys, 'history counts')
  exactKeys(
    schemaDerivedFields,
    [
      'operationFields',
      'operationRowCount',
      'operationValuesSha256',
      'reviewFields',
      'reviewRowCount',
      'reviewValuesSha256',
    ],
    'schema-derived field evidence',
  )
  const hashes = [
    value.bindingSha256,
    value.expectedPostV1PhysicalStateSha256,
    value.physicalStateSha256V1,
    value.schemaNeutralHistorySha256,
    ...componentKeys.map((key) => componentIdentities[key]),
    schemaDerivedFields.operationValuesSha256,
    schemaDerivedFields.reviewValuesSha256,
  ]
  if (hashes.some((hash) => typeof hash !== 'string' || !SHA256_PATTERN.test(hash))) {
    throw new Error('Schema-neutral history evidence contains an invalid SHA-256 identity.')
  }
  if (
    countKeys.some((key) => !Number.isSafeInteger(counts[key]) || Number(counts[key]) < 0) ||
    !Number.isSafeInteger(schemaDerivedFields.operationRowCount) ||
    !Number.isSafeInteger(schemaDerivedFields.reviewRowCount) ||
    schemaDerivedFields.operationRowCount !== counts.operations ||
    schemaDerivedFields.reviewRowCount !== counts.reviews ||
    JSON.stringify(schemaDerivedFields.operationFields) !==
      JSON.stringify(LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS) ||
    JSON.stringify(schemaDerivedFields.reviewFields) !==
      JSON.stringify(LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS)
  ) {
    throw new Error('Schema-neutral history counts or exclusion contract is invalid.')
  }
  const { bindingSha256, ...unsigned } = value
  if (bindingSha256 !== evidenceBinding(unsigned as never)) {
    throw new Error('Schema-neutral history evidence binding is invalid.')
  }
  return value as unknown as LiteratureGoldV2SchemaNeutralHistoryEvidence
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

/**
 * One query for pre-V2 captures and post-V2 diagnostics. It never names a V2
 * column, so the same bytes project both schemas; the pure builder performs
 * the only four reviewed exclusions and validates their post-V2 values.
 */
export function literatureGoldV2SchemaNeutralHistoryRowsJsonExpression(batchId: string): string {
  if (!UUID_PATTERN.test(batchId)) throw new Error('Invalid batch ID for history projection.')
  const id = sqlLiteral(batchId)
  return String.raw`pg_catalog.jsonb_build_object(
  'batchId', ${id},
  'datasetSplit', 'development',
  'batches', coalesce((select pg_catalog.jsonb_agg(to_jsonb(batch) order by batch.id)
    from public.literature_gold_set_batches batch where batch.id = ${id}::uuid), '[]'::jsonb),
  'items', coalesce((select pg_catalog.jsonb_agg(to_jsonb(item)
    order by item.display_order asc nulls last, item.id)
    from public.literature_gold_set_items item
    where item.batch_id = ${id}::uuid and item.dataset_split = 'development'), '[]'::jsonb),
  'reviews', coalesce((select pg_catalog.jsonb_agg(to_jsonb(review)
    order by item.display_order asc nulls last, item.id, review.revision asc nulls last, review.id)
    from public.literature_gold_set_reviews review
    join public.literature_gold_set_items item on item.id = review.item_id
    where item.batch_id = ${id}::uuid and item.dataset_split = 'development'), '[]'::jsonb),
  'drafts', coalesce((select pg_catalog.jsonb_agg(to_jsonb(draft)
    order by item.display_order asc nulls last, item.id)
    from public.literature_gold_set_review_drafts draft
    join public.literature_gold_set_items item on item.id = draft.item_id
    where item.batch_id = ${id}::uuid and item.dataset_split = 'development'), '[]'::jsonb),
  'events', coalesce((select pg_catalog.jsonb_agg(to_jsonb(event)
    order by event.created_at asc nulls last, event.id)
    from public.literature_gold_set_events event
    left join public.literature_gold_set_items item on item.id = event.item_id
    where event.batch_id = ${id}::uuid
      and (event.item_id is null or item.dataset_split = 'development')), '[]'::jsonb),
  'operations', coalesce((select pg_catalog.jsonb_agg(to_jsonb(operation)
    order by operation.started_at asc nulls last, operation.id)
    from public.literature_gold_review_operations operation
    where operation.batch_id = ${id}::uuid and operation.dataset_split = 'development'), '[]'::jsonb),
  'actions', coalesce((select pg_catalog.jsonb_agg(to_jsonb(action)
    order by operation.started_at asc nulls last, operation.id, action.action_sequence)
    from public.literature_gold_review_operation_actions action
    join public.literature_gold_review_operations operation on operation.id = action.operation_id
    where operation.batch_id = ${id}::uuid and operation.dataset_split = 'development'), '[]'::jsonb)
)`.trim()
}

export function literatureGoldV2SchemaNeutralHistoryRowsSql(batchId: string): string {
  return `select ${literatureGoldV2SchemaNeutralHistoryRowsJsonExpression(batchId)};`
}
