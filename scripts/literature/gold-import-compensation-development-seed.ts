import { z } from 'zod'

export const DEVELOPMENT_DATABASE_SEED_SCHEMA_VERSION =
  'gold-import-compensation-development-seed/v1' as const

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const uuidSchema = z.string().regex(UUID_PATTERN)
const databaseSeedRowSchema = z.record(z.string(), z.unknown())

export const developmentDatabaseSeedScopeSchema = z
  .object({
    batchId: uuidSchema,
    datasetSplit: z.literal('development'),
    heldOutIdentitiesIncluded: z.literal(false),
    schemaVersion: z.string().min(1),
    tables: z
      .object({
        literature_articles: z.array(databaseSeedRowSchema),
        literature_gold_set_batches: z.array(databaseSeedRowSchema),
        literature_gold_set_events: z.array(databaseSeedRowSchema),
        literature_gold_set_items: z.array(databaseSeedRowSchema),
        literature_gold_set_review_drafts: z.array(databaseSeedRowSchema),
        literature_gold_set_reviews: z.array(databaseSeedRowSchema),
      })
      .strict(),
  })
  .strict()

export const developmentDatabaseSeedSchema = developmentDatabaseSeedScopeSchema
  .extend({ schemaVersion: z.literal(DEVELOPMENT_DATABASE_SEED_SCHEMA_VERSION) })
  .strict()

export type DevelopmentDatabaseSeed = z.infer<typeof developmentDatabaseSeedSchema>
export type DevelopmentDatabaseSeedScope = z.infer<typeof developmentDatabaseSeedScopeSchema>

function requiredSeedString(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (typeof value !== 'string' || !value) {
    throw new Error(`Development backup has an invalid required ${field} field.`)
  }
  return value
}

function assertAllowedKeys(
  value: unknown,
  allowedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.includes(key))
  if (unexpected.length > 0) {
    throw new Error(`${label} contains non-allowlisted fields: ${unexpected.join(', ')}.`)
  }
}

function assertSafeBatchPayload(batch: Record<string, unknown>): void {
  assertAllowedKeys(
    batch,
    [
      'created_at',
      'created_by_email',
      'created_by_user_id',
      'frozen_at',
      'id',
      'kind',
      'label_schema_version',
      'name',
      'relevance_definition_version',
      'requested_size',
      'sampling_algorithm_version',
      'sampling_report',
      'sampling_seed',
      'status',
      'taxonomy_version',
      'test_percent',
      'test_unlock_reason',
      'test_unlocked_at',
      'test_unlocked_by_email',
      'test_unlocked_by_user_id',
      'updated_at',
    ],
    'Development backup batch row',
  )
  if (batch.sampling_report !== undefined) {
    assertAllowedKeys(
      batch.sampling_report,
      [
        'broadTopicsRepresented',
        'broadTopicsUnavailable',
        'candidateCount',
        'countsByAbstractAvailability',
        'countsByDeterministicBand',
        'countsByJournal',
        'countsBySourceTier',
        'countsByStratum',
        'countsByYearBand',
        'developmentCount',
        'excludedCandidateCount',
        'exclusionSources',
        'kind',
        'name',
        'originalCandidateCount',
        'reportVersion',
        'requestedSize',
        'samplingAlgorithmVersion',
        'samplingSeed',
        'selectedCount',
        'testCount',
        'warnings',
      ],
      'Development backup aggregate sampling report',
    )
    const exclusionSources = batch.sampling_report.exclusionSources
    if (!Array.isArray(exclusionSources)) {
      throw new Error('Development backup aggregate exclusionSources must be an array.')
    }
    for (const [index, source] of exclusionSources.entries()) {
      assertAllowedKeys(
        source,
        [
          'batchNames',
          'corpusPresentCount',
          'eligibleCount',
          'excludedCount',
          'path',
          'sha256',
          'sourceType',
          'suppliedCount',
        ],
        `Development backup exclusionSources[${index}]`,
      )
    }
  }
}

function assertSafeBatchLevelEvent(event: Record<string, unknown>): void {
  assertAllowedKeys(
    event,
    [
      'actor_email',
      'actor_user_id',
      'after_value',
      'batch_id',
      'before_value',
      'created_at',
      'event_type',
      'id',
      'item_id',
      'operation_action_id',
      'operation_event_sequence',
      'operation_id',
    ],
    'Development backup batch-level event',
  )
  if (event.event_type !== 'batch_created' || event.before_value !== null) {
    throw new Error('Development backup contains an unapproved batch-level event.')
  }
  assertNoOperationEventLinkage(event)
  assertAllowedKeys(
    event.after_value,
    ['kind', 'name', 'requested_size', 'sampling_seed'],
    'Development backup batch_created after_value',
  )
}

function assertSafeItemLevelEvent(event: Record<string, unknown>): void {
  assertAllowedKeys(
    event,
    [
      'actor_email',
      'actor_user_id',
      'after_value',
      'batch_id',
      'before_value',
      'created_at',
      'event_type',
      'id',
      'item_id',
      'operation_action_id',
      'operation_event_sequence',
      'operation_id',
    ],
    'Development backup item-level event',
  )
  assertNoOperationEventLinkage(event)
  if (event.event_type === 'draft_saved') {
    if (event.before_value !== null) {
      throw new Error('Development backup draft_saved before_value must be null.')
    }
    assertAllowedKeys(
      event.after_value,
      ['review_seconds'],
      'Development backup draft_saved after_value',
    )
    return
  }
  if (event.event_type === 'review_completed' || event.event_type === 'review_revised') {
    if (event.event_type === 'review_completed') {
      if (event.before_value !== null) {
        throw new Error('Development backup review_completed before_value must be null.')
      }
      assertAllowedKeys(
        event.after_value,
        ['is_blinded', 'relevance_label', 'review_id', 'revision'],
        'Development backup completed-review after_value',
      )
    } else {
      assertAllowedKeys(
        event.before_value,
        ['current_review_core_sha256', 'review_id', 'revision'],
        'Development backup review_revised before_value',
      )
      assertAllowedKeys(
        event.after_value,
        [
          'authorization_sha256',
          'authorization_status',
          'authorizing_identity',
          'authorizing_role',
          'categorization_from_full_text',
          'cohort',
          'decision_provenance',
          'disease_tag_status',
          'enrichment_confidence',
          'enrichment_provenance',
          'evidence',
          'final_artifact_projection_sha256',
          'final_artifact_sha256',
          'is_blinded',
          'master_row_id',
          'physician_enrichment_action',
          'physician_enrichment_notes',
          'physician_enrichment_reviewed',
          'physician_relevance_action',
          'physician_reviewed',
          'physician_revision_rationale_sha256',
          'pmid',
          'raw_result_filename',
          'raw_result_sha256',
          'relevance_label',
          'relevance_review_complete',
          'review_id',
          'reviewer_email',
          'reviewer_user_id',
          'revision',
          'source_physician_relevance_notes',
          'technology_tag_status',
          'workflow_id',
        ],
        'Development backup revised-review after_value',
      )
    }
    return
  }
  if (
    [
      'automated_signals_revealed',
      'returned_later',
      'review_resumed',
      'supplemental_metadata_revealed',
    ].includes(String(event.event_type))
  ) {
    assertAllowedKeys(
      event.before_value,
      ['review_status'],
      'Development backup item-state before_value',
    )
    assertAllowedKeys(
      event.after_value,
      ['review_status'],
      'Development backup item-state after_value',
    )
    return
  }
  throw new Error(`Development backup item-level event type ${String(event.event_type)} is unsafe.`)
}

function assertNoOperationEventLinkage(event: Record<string, unknown>): void {
  const fields = ['operation_action_id', 'operation_event_sequence', 'operation_id'] as const
  if (fields.some((field) => event[field] !== undefined && event[field] !== null)) {
    throw new Error('Development backup preapplication event contains operation linkage.')
  }
}

export function assertDevelopmentSeedScope(seed: DevelopmentDatabaseSeedScope): void {
  const batches = seed.tables.literature_gold_set_batches
  const items = seed.tables.literature_gold_set_items
  const articles = seed.tables.literature_articles
  const reviews = seed.tables.literature_gold_set_reviews
  const drafts = seed.tables.literature_gold_set_review_drafts
  const events = seed.tables.literature_gold_set_events
  if (
    batches.length !== 1 ||
    requiredSeedString(batches[0], 'id') !== seed.batchId ||
    items.length === 0
  ) {
    throw new Error('Development backup must contain one batch and a nonempty item set.')
  }
  assertSafeBatchPayload(batches[0])
  const itemIds = new Set<string>()
  const pmids = new Set<string>()
  for (const item of items) {
    if (
      item.dataset_split !== 'development' ||
      requiredSeedString(item, 'batch_id') !== seed.batchId
    ) {
      throw new Error('Held-out or cross-batch item entered the development backup.')
    }
    itemIds.add(requiredSeedString(item, 'id'))
    pmids.add(requiredSeedString(item, 'pmid'))
  }
  if (
    itemIds.size !== items.length ||
    pmids.size !== items.length ||
    articles.length !== items.length
  ) {
    throw new Error('Development backup item/article identities are incomplete or duplicated.')
  }
  const articlePmids = new Set(articles.map((article) => requiredSeedString(article, 'pmid')))
  if (articlePmids.size !== pmids.size || [...articlePmids].some((pmid) => !pmids.has(pmid))) {
    throw new Error('An article outside exact development membership entered the backup.')
  }
  const reviewIds = new Set<string>()
  const reviewItemById = new Map<string, string>()
  for (const review of reviews) {
    const itemId = requiredSeedString(review, 'item_id')
    const reviewId = requiredSeedString(review, 'id')
    if (!itemIds.has(itemId) || reviewIds.has(reviewId)) {
      throw new Error('Development backup review history is cross-scope or duplicated.')
    }
    reviewIds.add(reviewId)
    reviewItemById.set(reviewId, itemId)
  }
  for (const review of reviews) {
    const supersedes = review.supersedes_review_id
    if (
      supersedes !== null &&
      (typeof supersedes !== 'string' ||
        reviewItemById.get(supersedes) !== requiredSeedString(review, 'item_id'))
    ) {
      throw new Error('Development backup contains a cross-item review chain.')
    }
  }
  for (const item of items) {
    const current = item.current_review_id
    if (
      current !== null &&
      (typeof current !== 'string' ||
        reviewItemById.get(current) !== requiredSeedString(item, 'id'))
    ) {
      throw new Error('Development backup current-review pointer is not in its review history.')
    }
  }
  if (
    drafts.some((draft) => !itemIds.has(requiredSeedString(draft, 'item_id'))) ||
    events.some((event) => {
      if (requiredSeedString(event, 'batch_id') !== seed.batchId) return true
      if (event.item_id === null) {
        assertSafeBatchLevelEvent(event)
        return false
      }
      if (typeof event.item_id !== 'string' || !itemIds.has(event.item_id)) return true
      assertSafeItemLevelEvent(event)
      return false
    })
  ) {
    throw new Error('Held-out identity or cross-batch row entered the development backup.')
  }
}

export interface DevelopmentSeedV2SchemaSnapshot {
  actionCount: 0
  actionRowsSha256: string
  automatedRevealStateSha256: string
  batchCount: number
  batchRowsSha256: string
  draftCount: number
  draftRowsSha256: string
  effectiveStateSha256V1: string
  eventCount: number
  eventRowsSha256: string
  itemCount: number
  itemRowsSha256: string
  membershipSha256: string
  operationCount: 0
  operationRowsSha256: string
  physicalStateSha256V1: string
  planningStateSha256: string
  pointerStateSha256: string
  reviewCount: number
  reviewRowsSha256: string
  supplementalRevealStateSha256: string
}

function compareText(left: unknown, right: unknown, label: string): number {
  if (typeof left !== 'string' || typeof right !== 'string') {
    throw new Error(`Development backup ${label} sort identity is invalid.`)
  }
  return left < right ? -1 : left > right ? 1 : 0
}

function compareNumber(left: unknown, right: unknown, label: string): number {
  if (
    typeof left !== 'number' ||
    !Number.isFinite(left) ||
    typeof right !== 'number' ||
    !Number.isFinite(right)
  ) {
    throw new Error(`Development backup ${label} sort identity is invalid.`)
  }
  return left - right
}

function withoutV2ReviewColumns(row: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...row }
  delete clone.full_text_used
  delete clone.operation_contract_version
  delete clone.operation_contract_version_code
  return clone
}

export function deriveDevelopmentSeedV2SchemaSnapshot(input: {
  effectiveStateSha256V1: string
  membershipSha256: string
  physicalStateSha256V1: string
  planningStateSha256: string
  seed: DevelopmentDatabaseSeedScope
  sha256Canonical: (value: unknown) => string
}): DevelopmentSeedV2SchemaSnapshot {
  assertDevelopmentSeedScope(input.seed)
  const batches = [...input.seed.tables.literature_gold_set_batches].sort((left, right) =>
    compareText(left.id, right.id, 'batch'),
  )
  const items = [...input.seed.tables.literature_gold_set_items].sort(
    (left, right) =>
      compareNumber(left.display_order, right.display_order, 'item display-order') ||
      compareText(left.id, right.id, 'item'),
  )
  const itemIds = new Set(items.map((item) => requiredSeedString(item, 'id')))
  const reviews = input.seed.tables.literature_gold_set_reviews
    .filter((review) => itemIds.has(requiredSeedString(review, 'item_id')))
    .sort(
      (left, right) =>
        compareText(left.item_id, right.item_id, 'review item') ||
        compareNumber(left.revision, right.revision, 'review revision') ||
        compareText(left.id, right.id, 'review'),
    )
    .map(withoutV2ReviewColumns)
  const drafts = input.seed.tables.literature_gold_set_review_drafts
    .filter((draft) => itemIds.has(requiredSeedString(draft, 'item_id')))
    .sort((left, right) => compareText(left.item_id, right.item_id, 'draft item'))
  const events = input.seed.tables.literature_gold_set_events
    .filter((event) => requiredSeedString(event, 'batch_id') === input.seed.batchId)
    .sort(
      (left, right) =>
        compareText(left.created_at, right.created_at, 'event creation') ||
        compareText(left.id, right.id, 'event'),
    )
  const pointers = items.map((item) => ({
    currentReviewId: item.current_review_id,
    itemId: item.id,
  }))
  const automatedReveals = items.map((item) => ({
    automatedSignalsRevealedAt: item.automated_signals_revealed_at,
    itemId: item.id,
  }))
  const supplementalReveals = items.map((item) => ({
    itemId: item.id,
    supplementalMetadataRevealedAt: item.supplemental_metadata_revealed_at,
  }))
  const emptyRows: readonly unknown[] = []
  return {
    actionCount: 0,
    actionRowsSha256: input.sha256Canonical(emptyRows),
    automatedRevealStateSha256: input.sha256Canonical(automatedReveals),
    batchCount: batches.length,
    batchRowsSha256: input.sha256Canonical(batches),
    draftCount: drafts.length,
    draftRowsSha256: input.sha256Canonical(drafts),
    effectiveStateSha256V1: input.effectiveStateSha256V1,
    eventCount: events.length,
    eventRowsSha256: input.sha256Canonical(events),
    itemCount: items.length,
    itemRowsSha256: input.sha256Canonical(items),
    membershipSha256: input.membershipSha256,
    operationCount: 0,
    operationRowsSha256: input.sha256Canonical(emptyRows),
    physicalStateSha256V1: input.physicalStateSha256V1,
    planningStateSha256: input.planningStateSha256,
    pointerStateSha256: input.sha256Canonical(pointers),
    reviewCount: reviews.length,
    reviewRowsSha256: input.sha256Canonical(reviews),
    supplementalRevealStateSha256: input.sha256Canonical(supplementalReveals),
  }
}
