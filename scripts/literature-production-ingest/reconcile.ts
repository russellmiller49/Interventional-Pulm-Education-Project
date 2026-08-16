import { canonicalJson, sha256 } from './canonical'
import { checkpointChecksum, receiptChecksum, type CheckpointStore } from './checkpoint'
import { ENGINE_VERSION, RECONCILIATION_SCHEMA_VERSION } from './constants'
import { streamPreparedBatches, type RecordMapper } from './batching'
import { batchChecksumSummary } from './engine'
import type { ImportBatchLookupRow, LiteratureTable, ReadRowsOptions } from './transport'
import type {
  Checkpoint,
  CheckpointBatch,
  CheckpointMutationStage,
  ReconciliationClassification,
  ReconciliationObservation,
  ReconciliationReceipt,
  ReconciliationReceiptBody,
  SourceEnvelope,
} from './types'

export interface ReconciliationSourceFactory {
  open(): AsyncIterable<SourceEnvelope>
}

export interface ReconciliationTransport {
  projectRef: string
  getImportBatch(id: string): Promise<ImportBatchLookupRow | null>
  readRows<T extends object>(table: LiteratureTable, options?: ReadRowsOptions): Promise<T[]>
}

const JOURNAL_COLUMNS = [
  'id',
  'canonical_name',
  'pubmed_abbreviation',
  'nlm_id',
  'issn_print',
  'issn_electronic',
  'aliases',
  'source_tier',
  'active_from',
  'active_to',
  'notes',
  'registry_version',
] as const

const PROVENANCE_COLUMNS = [
  'pmid',
  'batch_id',
  'source_kind',
  'source_id',
  'query_id',
  'source_filename',
] as const

function inFilter(values: readonly string[]): string {
  if (values.length === 0 || values.some((value) => !/^[a-z0-9_-]+$/u.test(value))) {
    throw new Error('Read-only reconciliation filter contains an invalid identifier.')
  }
  return `in.(${values.join(',')})`
}

function sortedRows(rows: readonly object[], identityKeys: readonly string[]) {
  return [...rows].sort((left, right) => {
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    return canonicalJson(identityKeys.map((key) => leftRecord[key])).localeCompare(
      canonicalJson(identityKeys.map((key) => rightRecord[key])),
    )
  })
}

function classifyRows(
  actual: readonly object[],
  expected: readonly object[],
  identityKeys: readonly string[],
): ReconciliationClassification {
  if (actual.length === 0) return 'absent_exact'
  if (
    actual.length === expected.length &&
    canonicalJson(sortedRows(actual, identityKeys)) ===
      canonicalJson(sortedRows(expected, identityKeys))
  ) {
    return 'applied_exact'
  }
  return 'partial_or_conflicting'
}

function unresolved(stage: CheckpointMutationStage): boolean {
  return stage.state === 'submitted' || stage.state === 'ambiguous'
}

function sameInstant(actual: unknown, expected: string): boolean {
  return typeof actual === 'string' && Date.parse(actual) === Date.parse(expected)
}

async function observe(
  subject: string,
  operation: () => Promise<ReconciliationClassification>,
): Promise<ReconciliationObservation> {
  try {
    return { subject, classification: await operation() }
  } catch {
    return { subject, classification: 'observation_incomplete' }
  }
}

function assertBatchContract(
  actual: {
    index: number
    checksum: string
    startOrdinal: number
    endOrdinal: number
    recordCount: number
  },
  expected: CheckpointBatch,
): void {
  if (
    actual.index !== expected.index ||
    actual.checksum !== expected.checksum ||
    actual.startOrdinal !== expected.startOrdinal ||
    actual.endOrdinal !== expected.endOrdinal ||
    actual.recordCount !== expected.recordCount
  ) {
    throw new Error('Reconciliation source stream drifted from the checkpoint.')
  }
}

export async function reconcileCheckpoint(input: {
  checkpoint: Checkpoint
  sourceFactory: ReconciliationSourceFactory
  mapRecord: RecordMapper
  transport: ReconciliationTransport
  now?: () => string
}): Promise<ReconciliationReceipt> {
  if (input.checkpoint.targetProjectRef !== input.transport.projectRef) {
    throw new Error('Reconciliation target does not match the checkpoint.')
  }
  const observations: ReconciliationObservation[] = []

  if (unresolved(input.checkpoint.importBatchCreate)) {
    observations.push(
      await observe('import_batch_create', async () => {
        const row = await input.transport.getImportBatch(input.checkpoint.operationId)
        if (!row) return 'absent_exact'
        const identity = input.checkpoint.batchIdentity
        const expectedReport = {
          engine_version: input.checkpoint.engineVersion,
          mapping_version: input.checkpoint.mappingVersion,
          operation_id: input.checkpoint.operationId,
          mode: input.checkpoint.mode,
          source_projection_checksum: input.checkpoint.sourceProjectionChecksum,
          canary_manifest_checksum: input.checkpoint.canaryManifestChecksum,
        }
        return row.id === input.checkpoint.operationId &&
          row.source_filename === identity.sourceFilename &&
          row.source_file_sha256 === identity.sourceFileSha256 &&
          row.manifest_version === identity.manifestVersion &&
          row.query_registry_version === identity.queryRegistryVersion &&
          row.source_kind === identity.sourceKind &&
          row.source_id === identity.sourceId &&
          row.query_id === identity.queryId &&
          (row.record_limit ?? null) === identity.recordLimit &&
          row.status === 'started' &&
          row.records_read === 0 &&
          row.unique_pmids === 0 &&
          row.inserted_count === 0 &&
          row.updated_count === 0 &&
          row.duplicate_count === 0 &&
          row.error_count === 0 &&
          row.completed_at === null &&
          row.created_by === 'literature-production-ingest' &&
          sameInstant(row.started_at, input.checkpoint.createdAt) &&
          canonicalJson(row.report) === canonicalJson(expectedReport)
          ? 'applied_exact'
          : 'partial_or_conflicting'
      }),
    )
  }

  const lastUnresolvedBatchIndex = input.checkpoint.batches.reduce(
    (last, batch) =>
      Object.values(batch.stages).some(unresolved) ? Math.max(last, batch.index) : last,
    -1,
  )
  let batchCount = 0
  if (lastUnresolvedBatchIndex >= 0) {
    for await (const batch of streamPreparedBatches(
      input.sourceFactory.open(),
      input.mapRecord,
      input.checkpoint.limits,
    )) {
      // Only the durable prefix could have been submitted before the stop. Do not traverse or
      // retain the remainder of a full corpus merely to reconcile that bounded prefix.
      if (batch.index > lastUnresolvedBatchIndex) break
      const saved = input.checkpoint.batches[batch.index]
      assertBatchContract(batch, saved)
      batchCount += 1

      if (unresolved(saved.stages.journals)) {
        observations.push(
          await observe(`batch:${batch.index}:journals`, async () => {
            const expected = batch.journals
            if (expected.length === 0) return 'applied_exact'
            const actual = await input.transport.readRows<Record<string, unknown>>(
              'literature_journals',
              {
                query: {
                  select: JOURNAL_COLUMNS.join(','),
                  id: inFilter(expected.map((journal) => journal.id)),
                  order: 'id.asc',
                },
              },
            )
            return classifyRows(actual, expected, ['id'])
          }),
        )
      }

      if (unresolved(saved.stages.articles)) {
        observations.push(
          await observe(`batch:${batch.index}:articles`, async () => {
            const expected = batch.records.map((record) => ({
              pmid: record.article.pmid,
              metadata_hash: record.article.metadata_hash,
              relevance_state: 'unreviewed',
              visibility_state: 'draft',
              manual_override: false,
              is_landmark: false,
              curation_reason: null,
              classifier_version: null,
              classifier_payload: null,
            }))
            const actual = await input.transport.readRows<Record<string, unknown>>(
              'literature_articles',
              {
                query: {
                  select:
                    'pmid,metadata_hash,relevance_state,visibility_state,manual_override,is_landmark,curation_reason,classifier_version,classifier_payload',
                  pmid: inFilter(expected.map((article) => article.pmid)),
                  order: 'pmid.asc',
                },
              },
            )
            return classifyRows(actual, expected, ['pmid'])
          }),
        )
      }

      if (unresolved(saved.stages.provenance)) {
        observations.push(
          await observe(`batch:${batch.index}:provenance`, async () => {
            const expected = batch.records.map((record) => record.provenance)
            const actual = await input.transport.readRows<Record<string, unknown>>(
              'literature_article_sources',
              {
                query: {
                  select: PROVENANCE_COLUMNS.join(','),
                  batch_id: `eq.${input.checkpoint.operationId}`,
                  pmid: inFilter(expected.map((row) => row.pmid)),
                  order: 'pmid.asc',
                },
              },
            )
            return classifyRows(actual, expected, ['pmid', 'batch_id'])
          }),
        )
      }
    }
  }
  if (batchCount !== lastUnresolvedBatchIndex + 1) {
    throw new Error('Reconciliation source ended before the unresolved batch prefix.')
  }

  if (unresolved(input.checkpoint.finalization)) {
    observations.push(
      await observe('finalization', async () => {
        const row = await input.transport.getImportBatch(input.checkpoint.operationId)
        if (!row) return 'absent_exact'
        if (row.status !== 'completed' || !row.report || typeof row.report !== 'object') {
          return 'partial_or_conflicting'
        }
        const expectedReport = {
          engine_version: input.checkpoint.engineVersion,
          mapping_version: input.checkpoint.mappingVersion,
          operation_id: input.checkpoint.operationId,
          mode: input.checkpoint.mode,
          source_projection_checksum: input.checkpoint.sourceProjectionChecksum,
          canary_manifest_checksum: input.checkpoint.canaryManifestChecksum,
          unchanged_count: input.checkpoint.counters.unchanged,
          before_article_count: input.checkpoint.beforeArticleCount,
          after_article_count: input.checkpoint.afterArticleCount,
          batch_count: batchChecksumSummary(input.checkpoint).batchCount,
          batch_checksums_sha256: batchChecksumSummary(input.checkpoint).batchChecksumsSha256,
        }
        return row.records_read === input.checkpoint.counters.recordsRead &&
          row.unique_pmids === input.checkpoint.counters.uniquePmids &&
          row.inserted_count === input.checkpoint.counters.inserted &&
          row.updated_count === input.checkpoint.counters.updated &&
          row.duplicate_count === input.checkpoint.counters.duplicateOccurrences &&
          row.error_count === 0 &&
          canonicalJson(row.report) === canonicalJson(expectedReport)
          ? 'applied_exact'
          : 'partial_or_conflicting'
      }),
    )
  }

  if (observations.length === 0) {
    throw new Error('Checkpoint has no ambiguous or submitted mutation to reconcile.')
  }
  const body: ReconciliationReceiptBody = {
    schemaVersion: RECONCILIATION_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    operationId: input.checkpoint.operationId,
    mode: input.checkpoint.mode,
    targetProjectRef: input.checkpoint.targetProjectRef,
    checkpointChecksum: checkpointChecksum(input.checkpoint),
    observedAt: (input.now ?? (() => new Date().toISOString()))(),
    observations,
  }
  return { ...body, receiptChecksum: sha256(canonicalJson(body)) }
}

function stageBySubject(checkpoint: Checkpoint, subject: string): CheckpointMutationStage {
  if (subject === 'import_batch_create') return checkpoint.importBatchCreate
  if (subject === 'finalization') return checkpoint.finalization
  const match = subject.match(/^batch:(\d+):(journals|articles|provenance)$/u)
  if (!match) throw new Error('Reconciliation receipt contains an unknown subject.')
  const batch = checkpoint.batches[Number.parseInt(match[1], 10)]
  if (!batch) throw new Error('Reconciliation receipt names an unknown batch.')
  return batch.stages[match[2] as keyof CheckpointBatch['stages']]
}

export async function applyReconciliationReceipt(
  store: CheckpointStore,
  receipt: ReconciliationReceipt,
): Promise<Checkpoint> {
  const checkpoint = store.current()
  if (
    receipt.schemaVersion !== RECONCILIATION_SCHEMA_VERSION ||
    receipt.engineVersion !== ENGINE_VERSION ||
    receipt.operationId !== checkpoint.operationId ||
    receipt.mode !== checkpoint.mode ||
    receipt.targetProjectRef !== checkpoint.targetProjectRef ||
    receipt.checkpointChecksum !== checkpointChecksum(checkpoint) ||
    receipt.receiptChecksum !== receiptChecksum(receipt)
  ) {
    throw new Error('Reconciliation receipt is stale, corrupt, or bound to another operation.')
  }
  if (!Array.isArray(receipt.observations) || receipt.observations.length === 0) {
    throw new Error('Reconciliation receipt contains no observations.')
  }
  if (
    receipt.observations.some(
      (observation) =>
        observation.classification === 'partial_or_conflicting' ||
        observation.classification === 'observation_incomplete',
    )
  ) {
    throw new Error('Reconciliation did not establish a safe exact continuation state.')
  }

  return store.update((draft) => {
    for (const observation of receipt.observations) {
      const stage = stageBySubject(draft, observation.subject)
      if (!unresolved(stage)) {
        throw new Error('Reconciliation receipt subject is no longer unresolved.')
      }
      if (observation.classification === 'applied_exact') {
        stage.state = 'acknowledged'
        stage.acknowledgedAt = receipt.observedAt
        stage.failureCode = null
      } else if (observation.classification === 'absent_exact') {
        stage.state = 'prepared'
        stage.submittedAt = null
        stage.acknowledgedAt = null
        stage.failureCode = null
      } else {
        throw new Error('Unsupported reconciliation classification.')
      }
    }
    draft.phase = 'running'
  })
}
