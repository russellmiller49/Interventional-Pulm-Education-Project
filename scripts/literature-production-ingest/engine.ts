import { randomUUID } from 'node:crypto'

import { canonicalJson, jsonBody, sha256 } from './canonical'
import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  CANARY_SOURCE_AUTHORITY,
  CHECKPOINT_SCHEMA_VERSION,
  ENGINE_VERSION,
  INGEST_WRITER_IDENTITY,
  MAPPING_VERSION,
  MAX_BATCH_COUNT,
  RECEIPT_SCHEMA_VERSION,
} from './constants'
import {
  preparedBatchRequestChecksums,
  streamPreparedBatches,
  streamPreparedBatchesWithProjection,
  type RecordMapper,
} from './batching'
import type {
  BatchLimits,
  Checkpoint,
  CheckpointBatch,
  CheckpointMutationStage,
  DestinationArticleRow,
  IngestMode,
  IngestReceipt,
  IngestReceiptBody,
  PreparedBatch,
  SourceEnvelope,
  SourceJournalRow,
  SourceProjection,
} from './types'

export interface ExistingArticleObservation {
  pmid: string
  metadata_hash: string
  relevance_state: string
  visibility_state: string
  manual_override: boolean
  is_landmark: boolean
  curation_reason: string | null
  classifier_version: string | null
  classifier_payload: unknown
}

export interface ImportBatchIdentity {
  sourceFilename: string
  sourceFileSha256: string
  manifestVersion: string
  queryRegistryVersion: string
  sourceKind: 'unmapped'
  sourceId: 'fixed-local-bibliographic-corpus'
  queryId: 'production-canary' | 'production-full'
  recordLimit: number | null
}

export interface ImportBatchRowInput {
  id: string
  source_filename: string
  source_file_sha256: string
  manifest_version: string
  query_registry_version: string
  source_kind: 'unmapped'
  source_id: 'fixed-local-bibliographic-corpus'
  query_id: 'production-canary' | 'production-full'
  status: 'started'
  records_read: 0
  unique_pmids: 0
  inserted_count: 0
  updated_count: 0
  duplicate_count: 0
  error_count: 0
  record_limit: number | null
  started_at: string
  completed_at: null
  report: Record<string, unknown>
  created_by: typeof INGEST_WRITER_IDENTITY
}

export interface CompletedImportBatch {
  id: string
  report?: unknown
}

export interface DestinationOperator {
  countArticles(): Promise<number>
  findCompletedImportBatch(identity: ImportBatchIdentity): Promise<CompletedImportBatch | null>
  observeArticles(pmids: string[]): Promise<ExistingArticleObservation[]>
  createImportBatch(row: ImportBatchRowInput): Promise<unknown>
  upsertJournals(rows: SourceJournalRow[]): Promise<unknown>
  upsertArticles(rows: DestinationArticleRow[]): Promise<unknown>
  upsertArticleSources(rows: PreparedBatch['records'][number]['provenance'][]): Promise<unknown>
  completeImportBatch(id: string, patch: Record<string, unknown>): Promise<unknown>
}

export interface CheckpointLedger {
  current(): Checkpoint
  update(mutator: (checkpoint: Checkpoint) => void): Promise<Checkpoint>
}

export interface SourceFactory {
  open(): AsyncIterable<SourceEnvelope>
}

export interface PlannedIngestion {
  projection: SourceProjection
  operationId: string
  identity: ImportBatchIdentity
  checkpoint: Checkpoint
}

export interface ExecuteIngestionInput {
  mode: IngestMode
  sourceFactory: SourceFactory
  mapRecord: RecordMapper
  projection: SourceProjection
  limits: BatchLimits
  canaryManifestChecksum: string | null
  canaryPmids?: string[]
  dryRun: boolean
  operationId?: string
  destination?: DestinationOperator
  ledger?: CheckpointLedger
  now?: () => string
}

function emptyMutationStage(required = true): CheckpointMutationStage {
  return {
    state: required ? 'prepared' : 'not_required',
    requestChecksum: null,
    submittedAt: null,
    acknowledgedAt: null,
    failureCode: null,
  }
}

export function buildImportBatchIdentity(
  mode: IngestMode,
  projection: SourceProjection,
  canaryManifestChecksum: string | null = null,
): ImportBatchIdentity {
  return {
    sourceFilename:
      mode === 'canary' ? 'authorized-canary-manifest.json' : 'fixed-local-literature-articles',
    sourceFileSha256: projection.checksum,
    manifestVersion:
      mode === 'canary'
        ? `${ENGINE_VERSION}/${mode}/${canaryManifestChecksum ?? 'missing-manifest'}`
        : `${ENGINE_VERSION}/${mode}`,
    queryRegistryVersion: MAPPING_VERSION,
    sourceKind: 'unmapped',
    sourceId: 'fixed-local-bibliographic-corpus',
    queryId: mode === 'canary' ? 'production-canary' : 'production-full',
    recordLimit: mode === 'canary' ? projection.recordCount : null,
  }
}

export function createCheckpoint(input: {
  mode: IngestMode
  projection: SourceProjection
  limits: BatchLimits
  canaryManifestChecksum: string | null
  operationId?: string
  now?: string
}): Checkpoint {
  const timestamp = input.now ?? new Date().toISOString()
  const operationId = input.operationId ?? randomUUID()
  const identity = buildImportBatchIdentity(
    input.mode,
    input.projection,
    input.canaryManifestChecksum,
  )
  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    mappingVersion: MAPPING_VERSION,
    operationId,
    mode: input.mode,
    targetProjectRef: APPROVED_PROJECT_REF,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceProjectionChecksum: input.projection.checksum,
    sourceRecordCount: input.projection.recordCount,
    canaryManifestChecksum: input.canaryManifestChecksum,
    limits: input.limits,
    batchIdentity: identity,
    importBatchCreate: emptyMutationStage(),
    finalization: emptyMutationStage(),
    finalizationEnvelope: null,
    phase: 'prepared',
    beforeArticleCount: null,
    afterArticleCount: null,
    counters: {
      recordsRead: input.projection.recordCount + input.projection.duplicateOccurrences,
      uniquePmids: input.projection.recordCount,
      duplicateOccurrences: input.projection.duplicateOccurrences,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
    },
    batches: [],
  }
}

export async function planIngestion(input: {
  mode: IngestMode
  sourceFactory: SourceFactory
  mapRecord: RecordMapper
  limits: BatchLimits
  canaryManifestChecksum: string | null
  operationId?: string
  now?: string
}): Promise<PlannedIngestion> {
  const plannedBatches: CheckpointBatch[] = []
  const iterator = streamPreparedBatchesWithProjection(
    input.sourceFactory.open(),
    input.mapRecord,
    input.limits,
  )
  let projection: SourceProjection
  while (true) {
    const result = await iterator.next()
    if (result.done) {
      projection = result.value
      break
    }
    const batch = result.value
    if (batch.index >= MAX_BATCH_COUNT) {
      throw new Error(
        `Source plan exceeds the durable maximum of ${MAX_BATCH_COUNT} batches; increase the record or byte batch limit before any write.`,
      )
    }
    const requestChecksums = preparedBatchRequestChecksums(batch)
    plannedBatches.push({
      index: batch.index,
      startOrdinal: batch.startOrdinal,
      endOrdinal: batch.endOrdinal,
      recordCount: batch.recordCount,
      articleBodyBytes: batch.articleBodyBytes,
      journalBodyBytes: batch.journalBodyBytes,
      provenanceBodyBytes: batch.provenanceBodyBytes,
      checksum: batch.checksum,
      effects: null,
      stages: {
        journals: {
          ...emptyMutationStage(batch.journals.length > 0),
          requestChecksum: requestChecksums.journals,
        },
        articles: { ...emptyMutationStage(), requestChecksum: requestChecksums.articles },
        provenance: { ...emptyMutationStage(), requestChecksum: requestChecksums.provenance },
      },
    })
  }
  const checkpoint = createCheckpoint({
    ...input,
    projection,
  })
  checkpoint.batches = plannedBatches
  return {
    projection,
    operationId: checkpoint.operationId,
    identity: checkpoint.batchIdentity,
    checkpoint,
  }
}

function mutationDisposition(error: unknown): {
  outcome: 'ambiguous' | 'confirmed_failure'
  code: string
} {
  if (error && typeof error === 'object') {
    const candidate = error as { outcome?: unknown; code?: unknown }
    if (candidate.outcome === 'confirmed_failure') {
      return {
        outcome: 'confirmed_failure',
        code: typeof candidate.code === 'string' ? candidate.code : 'confirmed_failure',
      }
    }
    if (candidate.outcome === 'ambiguous') {
      return {
        outcome: 'ambiguous',
        code: typeof candidate.code === 'string' ? candidate.code : 'ambiguous_acknowledgement',
      }
    }
  }
  return { outcome: 'ambiguous', code: 'unclassified_mutation_error' }
}

async function executeCheckpointStage(input: {
  ledger: CheckpointLedger
  now: () => string
  getStage: (checkpoint: Checkpoint) => CheckpointMutationStage
  mutate: () => Promise<unknown>
  shouldStop?: () => boolean
  onMutationError?: (error: unknown) => void
}): Promise<boolean> {
  const initial = input.getStage(input.ledger.current())
  if (initial.state === 'acknowledged' || initial.state === 'not_required') return true
  if (input.shouldStop?.()) return false
  if (initial.state === 'submitted' || initial.state === 'ambiguous') {
    throw new Error('Mutation stage requires read-only reconciliation before continuation.')
  }
  if (initial.state === 'confirmed_failure') {
    await input.ledger.update((checkpoint) => {
      const stage = input.getStage(checkpoint)
      stage.state = 'prepared'
      stage.failureCode = null
      stage.submittedAt = null
    })
  }

  await input.ledger.update((checkpoint) => {
    const stage = input.getStage(checkpoint)
    stage.state = 'submitted'
    stage.submittedAt = input.now()
    if (checkpoint.phase === 'prepared' || checkpoint.phase === 'confirmed_failure') {
      checkpoint.phase = 'running'
    }
  })

  // A peer request may have become ambiguous while this batch was recording its intent. Restore
  // this never-sent stage and do not start another remote request after the shared stop signal.
  if (input.shouldStop?.()) {
    await input.ledger.update((checkpoint) => {
      const stage = input.getStage(checkpoint)
      if (stage.state === 'submitted') {
        stage.state = 'prepared'
        stage.submittedAt = null
      }
    })
    return false
  }

  try {
    await input.mutate()
  } catch (error) {
    input.onMutationError?.(error)
    const disposition = mutationDisposition(error)
    await input.ledger.update((checkpoint) => {
      const stage = input.getStage(checkpoint)
      stage.state = disposition.outcome === 'ambiguous' ? 'ambiguous' : 'confirmed_failure'
      stage.failureCode = disposition.code
      if (disposition.outcome === 'ambiguous') checkpoint.phase = 'needs_reconciliation'
      else if (checkpoint.phase !== 'needs_reconciliation') checkpoint.phase = 'confirmed_failure'
    })
    throw error
  }

  await input.ledger.update((checkpoint) => {
    const stage = input.getStage(checkpoint)
    stage.state = 'acknowledged'
    stage.acknowledgedAt = input.now()
    stage.failureCode = null
  })
  return true
}

function assertBatchMatchesCheckpoint(batch: PreparedBatch, saved: CheckpointBatch): void {
  const requestChecksums = preparedBatchRequestChecksums(batch)
  const scalarPairs: Array<[unknown, unknown]> = [
    [batch.index, saved.index],
    [batch.startOrdinal, saved.startOrdinal],
    [batch.endOrdinal, saved.endOrdinal],
    [batch.recordCount, saved.recordCount],
    [batch.articleBodyBytes, saved.articleBodyBytes],
    [batch.journalBodyBytes, saved.journalBodyBytes],
    [batch.provenanceBodyBytes, saved.provenanceBodyBytes],
    [batch.checksum, saved.checksum],
    [requestChecksums.journals, saved.stages.journals.requestChecksum],
    [requestChecksums.articles, saved.stages.articles.requestChecksum],
    [requestChecksums.provenance, saved.stages.provenance.requestChecksum],
  ]
  if (scalarPairs.some(([actual, expected]) => actual !== expected)) {
    throw new Error('Source or batching configuration drifted from the durable checkpoint.')
  }
}

function classifyEffects(
  batch: PreparedBatch,
  existingRows: ExistingArticleObservation[],
): NonNullable<CheckpointBatch['effects']> {
  const existing = new Map(existingRows.map((row) => [row.pmid, row]))
  let inserted = 0
  let updated = 0
  let unchanged = 0
  for (const record of batch.records) {
    const row = existing.get(record.article.pmid)
    if (!row) {
      inserted += 1
    } else if (
      row.metadata_hash === record.article.metadata_hash &&
      row.relevance_state === 'unreviewed' &&
      row.visibility_state === 'draft' &&
      row.manual_override === false &&
      row.is_landmark === false &&
      row.curation_reason === null &&
      row.classifier_version === null &&
      row.classifier_payload === null
    ) {
      unchanged += 1
    } else {
      updated += 1
    }
  }
  if (existingRows.length !== existing.size || existingRows.some((row) => !row.pmid)) {
    throw new Error('Destination existing-article observation was not unique and complete.')
  }
  return { inserted, updated, unchanged }
}

async function registerBatch(
  ledger: CheckpointLedger,
  destination: DestinationOperator,
  batch: PreparedBatch,
): Promise<void> {
  const saved = ledger.current().batches[batch.index]
  if (!saved) throw new Error('Source produced a batch outside the durable plan.')
  assertBatchMatchesCheckpoint(batch, saved)
  if (saved.effects) return

  const effects = classifyEffects(
    batch,
    await destination.observeArticles(batch.records.map((record) => record.article.pmid)),
  )
  await ledger.update((checkpoint) => {
    const planned = checkpoint.batches[batch.index]
    assertBatchMatchesCheckpoint(batch, planned)
    if (planned.effects && canonicalJson(planned.effects) !== canonicalJson(effects)) {
      throw new Error('Destination effect classification changed during batch registration.')
    }
    planned.effects = effects
  })
}

async function executeBatch(input: {
  batch: PreparedBatch
  destination: DestinationOperator
  ledger: CheckpointLedger
  now: () => string
  stopSignal: { error: unknown | null }
}): Promise<void> {
  const stageFor =
    (
      name: keyof CheckpointBatch['stages'],
    ): ((checkpoint: Checkpoint) => CheckpointMutationStage) =>
    (checkpoint) =>
      checkpoint.batches[input.batch.index].stages[name]

  const execute = (
    name: keyof CheckpointBatch['stages'],
    mutate: () => Promise<unknown>,
  ): Promise<boolean> =>
    executeCheckpointStage({
      ...input,
      getStage: stageFor(name),
      mutate,
      shouldStop: () => input.stopSignal.error !== null,
      onMutationError: (error) => {
        if (input.stopSignal.error === null) input.stopSignal.error = error
      },
    })

  if (!(await execute('journals', () => input.destination.upsertJournals(input.batch.journals)))) {
    return
  }
  if (
    !(await execute('articles', () =>
      input.destination.upsertArticles(input.batch.records.map((record) => record.article)),
    ))
  ) {
    return
  }
  await execute('provenance', () =>
    input.destination.upsertArticleSources(input.batch.records.map((record) => record.provenance)),
  )
}

function aggregateEffects(checkpoint: Checkpoint) {
  return checkpoint.batches.reduce(
    (totals, batch) => {
      if (!batch.effects) return totals
      totals.inserted += batch.effects.inserted
      totals.updated += batch.effects.updated
      totals.unchanged += batch.effects.unchanged
      return totals
    },
    { inserted: 0, updated: 0, unchanged: 0 },
  )
}

export function batchChecksumSummary(checkpoint: Checkpoint): {
  batchCount: number
  batchChecksumsSha256: string
} {
  const checksums = checkpoint.batches.map((batch) => batch.checksum)
  return {
    batchCount: checksums.length,
    batchChecksumsSha256: sha256(canonicalJson(checksums)),
  }
}

function receipt(body: IngestReceiptBody): IngestReceipt {
  return { ...body, receiptChecksum: sha256(canonicalJson(body)) }
}

export function createIdempotentReplayReceipt(input: {
  checkpoint: Checkpoint
  articleCount: number
  canaryPmids?: string[]
  now?: string
}): IngestReceipt {
  if (input.checkpoint.phase !== 'completed') {
    throw new Error('Idempotent replay requires the completed operation checkpoint.')
  }
  /*
   * A replay receipt must name its records too.
   *
   * `createCompletedReceiptFromCheckpoint` has always refused a canary without exactly 25 PMIDs;
   * this builder did not, so it could emit a canary receipt carrying none. The verifier then
   * reported the strongest binding it has — "the twenty-five the owner authorized" — as no verdict,
   * and explained the absence as expected for a full-corpus run.
   */
  if (
    (input.checkpoint.mode === 'canary' && input.canaryPmids?.length !== 25) ||
    (input.checkpoint.mode === 'full' && input.canaryPmids !== undefined)
  ) {
    throw new Error('Idempotent replay receipt does not match the operation mode.')
  }
  return receipt({
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    mappingVersion: MAPPING_VERSION,
    operationId: input.checkpoint.operationId,
    mode: input.checkpoint.mode,
    outcome: 'idempotent-replay',
    targetProjectRef: input.checkpoint.targetProjectRef,
    targetUrl: APPROVED_PROJECT_URL,
    writerIdentity: INGEST_WRITER_IDENTITY,
    sourceAuthority: input.checkpoint.mode === 'canary' ? CANARY_SOURCE_AUTHORITY : null,
    completedAt: input.now ?? new Date().toISOString(),
    sourceProjectionChecksum: input.checkpoint.sourceProjectionChecksum,
    sourceRecordCount: input.checkpoint.sourceRecordCount,
    canaryManifestChecksum: input.checkpoint.canaryManifestChecksum,
    ...(input.checkpoint.mode === 'canary' ? { canaryPmids: input.canaryPmids } : {}),
    beforeArticleCount: input.articleCount,
    afterArticleCount: input.articleCount,
    counters: {
      recordsRead: input.checkpoint.counters.recordsRead,
      uniquePmids: input.checkpoint.sourceRecordCount,
      duplicateOccurrences: input.checkpoint.counters.duplicateOccurrences,
      inserted: 0,
      updated: 0,
      unchanged: input.checkpoint.sourceRecordCount,
      errors: 0,
    },
    batchChecksums: input.checkpoint.batches.map((batch) => batch.checksum),
    importBatchId: input.checkpoint.operationId,
  })
}

export function createCompletedReceiptFromCheckpoint(input: {
  checkpoint: Checkpoint
  canaryPmids?: string[]
  now?: string
}): IngestReceipt {
  if (
    input.checkpoint.phase !== 'completed' ||
    input.checkpoint.beforeArticleCount === null ||
    input.checkpoint.afterArticleCount === null
  ) {
    throw new Error('Completed receipt recovery requires an exact completed checkpoint.')
  }
  /*
   * A completed receipt is a statement that the finalization was acknowledged. Requiring the
   * envelope and the acknowledgement here — not only the phase — closes the path where an
   * ambiguous or reconciled-but-unfinalized checkpoint produced a receipt saying the operation
   * completed. The phase alone was too weak: it is a field, and this is the artifact operators
   * treat as proof.
   */
  if (
    input.checkpoint.finalization.state !== 'acknowledged' ||
    input.checkpoint.finalizationEnvelope === null
  ) {
    throw new Error(
      'Completed receipt recovery requires an acknowledged finalization and its durable request ' +
        'envelope. Reconcile the operation read-only before treating it as completed.',
    )
  }
  if (
    (input.checkpoint.mode === 'canary' && input.canaryPmids?.length !== 25) ||
    (input.checkpoint.mode === 'full' && input.canaryPmids !== undefined)
  ) {
    throw new Error('Completed receipt recovery does not match the operation mode.')
  }
  return receipt({
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    mappingVersion: MAPPING_VERSION,
    operationId: input.checkpoint.operationId,
    mode: input.checkpoint.mode,
    outcome: 'completed',
    targetProjectRef: input.checkpoint.targetProjectRef,
    targetUrl: APPROVED_PROJECT_URL,
    writerIdentity: INGEST_WRITER_IDENTITY,
    sourceAuthority: input.checkpoint.mode === 'canary' ? CANARY_SOURCE_AUTHORITY : null,
    completedAt: input.now ?? new Date().toISOString(),
    sourceProjectionChecksum: input.checkpoint.sourceProjectionChecksum,
    sourceRecordCount: input.checkpoint.sourceRecordCount,
    canaryManifestChecksum: input.checkpoint.canaryManifestChecksum,
    ...(input.checkpoint.mode === 'canary' ? { canaryPmids: input.canaryPmids } : {}),
    beforeArticleCount: input.checkpoint.beforeArticleCount,
    afterArticleCount: input.checkpoint.afterArticleCount,
    counters: input.checkpoint.counters,
    batchChecksums: input.checkpoint.batches.map((batch) => batch.checksum),
    importBatchId: input.checkpoint.operationId,
  })
}

function assertExecutionBinding(
  input: ExecuteIngestionInput,
): asserts input is ExecuteIngestionInput & {
  destination: DestinationOperator
  ledger: CheckpointLedger
} {
  if (!input.destination || !input.ledger) {
    throw new Error('Mutating execution requires a destination and durable checkpoint ledger.')
  }
}

async function dryRun(input: ExecuteIngestionInput, now: () => string): Promise<IngestReceipt> {
  const batchChecksums: string[] = []
  let batches = 0
  const iterator = streamPreparedBatchesWithProjection(
    input.sourceFactory.open(),
    input.mapRecord,
    input.limits,
  )
  let replayProjection: SourceProjection
  while (true) {
    const result = await iterator.next()
    if (result.done) {
      replayProjection = result.value
      break
    }
    const batch = result.value
    if (batch.index !== batches) throw new Error('Dry-run batch order was not contiguous.')
    batches += 1
    batchChecksums.push(batch.checksum)
  }
  if (canonicalJson(replayProjection) !== canonicalJson(input.projection)) {
    throw new Error('Dry-run source changed after its read-only plan; no receipt was produced.')
  }
  return receipt({
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    mappingVersion: MAPPING_VERSION,
    operationId: input.operationId ?? randomUUID(),
    mode: input.mode,
    outcome: 'dry-run',
    targetProjectRef: null,
    // A dry run resolves no destination at all, so it names none. The binding contract refuses to
    // bind a dry-run receipt to any row rather than reading these nulls as agreement.
    targetUrl: null,
    writerIdentity: INGEST_WRITER_IDENTITY,
    sourceAuthority: input.mode === 'canary' ? CANARY_SOURCE_AUTHORITY : null,
    completedAt: now(),
    sourceProjectionChecksum: input.projection.checksum,
    sourceRecordCount: input.projection.recordCount,
    canaryManifestChecksum: input.canaryManifestChecksum,
    ...(input.mode === 'canary' ? { canaryPmids: input.canaryPmids } : {}),
    beforeArticleCount: null,
    afterArticleCount: null,
    counters: {
      recordsRead: input.projection.recordCount + input.projection.duplicateOccurrences,
      uniquePmids: input.projection.recordCount,
      duplicateOccurrences: input.projection.duplicateOccurrences,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
    },
    batchChecksums,
    importBatchId: null,
  })
}

export async function executeIngestion(input: ExecuteIngestionInput): Promise<IngestReceipt> {
  const now = input.now ?? (() => new Date().toISOString())
  if (input.dryRun) return dryRun(input, now)
  assertExecutionBinding(input)

  const checkpoint = input.ledger.current()
  if (
    checkpoint.mode !== input.mode ||
    checkpoint.sourceProjectionChecksum !== input.projection.checksum ||
    checkpoint.sourceRecordCount !== input.projection.recordCount ||
    canonicalJson(checkpoint.limits) !== canonicalJson(input.limits) ||
    checkpoint.targetProjectRef !== APPROVED_PROJECT_REF ||
    checkpoint.canaryManifestChecksum !== input.canaryManifestChecksum
  ) {
    throw new Error('Execution inputs do not match the durable checkpoint contract.')
  }
  const unresolvedStages = [
    checkpoint.importBatchCreate,
    checkpoint.finalization,
    ...checkpoint.batches.flatMap((batch) => Object.values(batch.stages)),
  ].some((stage) => stage.state === 'submitted' || stage.state === 'ambiguous')
  if (checkpoint.phase === 'needs_reconciliation' || unresolvedStages) {
    throw new Error('Read-only reconciliation is required before any continuation writes.')
  }

  if (checkpoint.beforeArticleCount === null) {
    const before = await input.destination.countArticles()
    await input.ledger.update((draft) => {
      draft.beforeArticleCount = before
    })
  }

  const batchRow: ImportBatchRowInput = {
    id: checkpoint.operationId,
    source_filename: checkpoint.batchIdentity.sourceFilename,
    source_file_sha256: checkpoint.batchIdentity.sourceFileSha256,
    manifest_version: checkpoint.batchIdentity.manifestVersion,
    query_registry_version: checkpoint.batchIdentity.queryRegistryVersion,
    source_kind: checkpoint.batchIdentity.sourceKind,
    source_id: checkpoint.batchIdentity.sourceId,
    query_id: checkpoint.batchIdentity.queryId,
    status: 'started',
    records_read: 0,
    unique_pmids: 0,
    inserted_count: 0,
    updated_count: 0,
    duplicate_count: 0,
    error_count: 0,
    record_limit: checkpoint.batchIdentity.recordLimit,
    started_at: checkpoint.createdAt,
    completed_at: null,
    report: {
      engine_version: ENGINE_VERSION,
      mapping_version: MAPPING_VERSION,
      operation_id: checkpoint.operationId,
      mode: input.mode,
      source_projection_checksum: input.projection.checksum,
      canary_manifest_checksum: input.canaryManifestChecksum,
    },
    created_by: INGEST_WRITER_IDENTITY,
  }
  const batchRowRequest = jsonBody([batchRow])
  if (batchRowRequest.bytes > input.limits.byteBatchLimit) {
    throw new Error('Import-batch creation exceeds the configured byte request limit.')
  }
  if (!checkpoint.importBatchCreate.requestChecksum) {
    await input.ledger.update((draft) => {
      draft.importBatchCreate.requestChecksum = batchRowRequest.checksum
    })
  }
  await executeCheckpointStage({
    ledger: input.ledger,
    now,
    getStage: (draft) => draft.importBatchCreate,
    mutate: () => input.destination.createImportBatch(batchRow),
  })

  const inFlight = new Set<Promise<void>>()
  const stopSignal: { error: unknown | null } = { error: null }
  let observedBatchCount = 0
  try {
    for await (const batch of streamPreparedBatches(
      input.sourceFactory.open(),
      input.mapRecord,
      input.limits,
    )) {
      if (stopSignal.error) break
      // Registration is deliberately ordered even when mutation execution is concurrent. This
      // makes the write-ahead batch ledger contiguous before any request for that batch can start.
      await registerBatch(input.ledger, input.destination, batch)
      observedBatchCount += 1
      if (stopSignal.error) break
      const work = executeBatch({
        batch,
        destination: input.destination,
        ledger: input.ledger,
        now,
        stopSignal,
      })
        .catch((error: unknown) => {
          if (!stopSignal.error) stopSignal.error = error
        })
        .finally(() => inFlight.delete(work))
      inFlight.add(work)
      if (inFlight.size >= input.limits.concurrency) await Promise.race(inFlight)
    }
  } catch (error) {
    if (!stopSignal.error) stopSignal.error = error
  }
  await Promise.all(inFlight)
  if (stopSignal.error) throw stopSignal.error
  if (observedBatchCount !== input.ledger.current().batches.length) {
    throw new Error('Resumed source stream does not match the saved batch sequence.')
  }

  const after = await input.destination.countArticles()
  const effects = aggregateEffects(input.ledger.current())
  const before = input.ledger.current().beforeArticleCount
  const exactCountDelta = before !== null && after - before === effects.inserted
  await input.ledger.update((draft) => {
    draft.afterArticleCount = after
    draft.counters = { ...draft.counters, ...effects }
    if (!exactCountDelta) draft.phase = 'confirmed_failure'
  })
  if (!exactCountDelta) {
    throw new Error(
      'Destination before/after article counts do not match the exact inserted-row effect; finalization is refused.',
    )
  }

  const finalCheckpoint = input.ledger.current()
  /*
   * The finalization envelope.
   *
   * Every value below is derived from the durable checkpoint except one — `completed_at` — and that
   * one used to be read from the clock on every attempt. A resume therefore built a *different*
   * body than the one whose checksum it had already written ahead, and the write-ahead record
   * proved nothing about what had been sent.
   *
   * So the timestamp is generated exactly once, persisted with the complete request body and its
   * checksum before the request leaves, and reused verbatim on every resume. A resume rebuilds the
   * body from the checkpoint, compares it byte for byte against what was stored, and stops on any
   * difference rather than sending a second, different finalization.
   */
  const buildFinalPatch = (completedAt: string) => {
    const checksumSummary = batchChecksumSummary(finalCheckpoint)
    return {
      status: 'completed',
      records_read: finalCheckpoint.counters.recordsRead,
      unique_pmids: finalCheckpoint.counters.uniquePmids,
      inserted_count: finalCheckpoint.counters.inserted,
      updated_count: finalCheckpoint.counters.updated,
      duplicate_count: finalCheckpoint.counters.duplicateOccurrences,
      error_count: finalCheckpoint.counters.errors,
      completed_at: completedAt,
      report: {
        engine_version: ENGINE_VERSION,
        mapping_version: MAPPING_VERSION,
        operation_id: finalCheckpoint.operationId,
        mode: finalCheckpoint.mode,
        source_projection_checksum: finalCheckpoint.sourceProjectionChecksum,
        canary_manifest_checksum: finalCheckpoint.canaryManifestChecksum,
        unchanged_count: finalCheckpoint.counters.unchanged,
        before_article_count: finalCheckpoint.beforeArticleCount,
        after_article_count: finalCheckpoint.afterArticleCount,
        batch_count: checksumSummary.batchCount,
        batch_checksums_sha256: checksumSummary.batchChecksumsSha256,
      },
    }
  }

  const storedEnvelope = finalCheckpoint.finalizationEnvelope
  const completedAt = storedEnvelope?.completedAt ?? now()
  const finalPatch = buildFinalPatch(completedAt)
  const finalizationRequest = jsonBody(finalPatch)

  if (storedEnvelope) {
    // Drift, not a repair opportunity. If the counters, the report, or the timestamp moved since
    // the intent was recorded, the operation is no longer the one that was written ahead.
    if (
      storedEnvelope.body !== canonicalJson(finalPatch) ||
      storedEnvelope.checksum !== finalizationRequest.checksum
    ) {
      throw new Error(
        'The finalization request no longer matches the body recorded in the write-ahead ' +
          'checkpoint. Reconcile this operation read-only; do not send a second finalization.',
      )
    }
    if (
      finalCheckpoint.finalization.requestChecksum &&
      finalCheckpoint.finalization.requestChecksum !== storedEnvelope.checksum
    ) {
      throw new Error(
        'The finalization stage checksum disagrees with its persisted request envelope. This is ' +
          'checkpoint drift and must be reconciled read-only.',
      )
    }
  }
  if (finalizationRequest.bytes > input.limits.byteBatchLimit) {
    throw new Error('Import-batch finalization exceeds the configured byte request limit.')
  }
  if (!storedEnvelope) {
    const envelope = {
      completedAt,
      body: canonicalJson(finalPatch),
      checksum: finalizationRequest.checksum,
    }
    await input.ledger.update((draft) => {
      draft.finalizationEnvelope = envelope
      draft.finalization.requestChecksum = envelope.checksum
    })
  }
  await executeCheckpointStage({
    ledger: input.ledger,
    now,
    getStage: (draft) => draft.finalization,
    mutate: () => input.destination.completeImportBatch(finalCheckpoint.operationId, finalPatch),
  })
  await input.ledger.update((draft) => {
    draft.phase = 'completed'
  })

  return createCompletedReceiptFromCheckpoint({
    checkpoint: input.ledger.current(),
    canaryPmids: input.canaryPmids,
    now: now(),
  })
}
