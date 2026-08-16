/**
 * Receipts and batch rows for tests, produced by the ingestion engine itself.
 *
 * The first version of this module hand-authored the receipt and computed its own checksum. That
 * rebuilt, one layer up, the exact defect the cross-package audit found: a fixture that agrees with
 * what its author believed the engine emits rather than with what it emits. It was wrong within
 * minutes — the batch row's `source_kind` is `unmapped`, not the `all_pubmed_discovery` it assumed.
 *
 * Everything here now delegates to the engine's own `createCompletedReceiptFromCheckpoint` and
 * `createIdempotentReplayReceipt`, so a change to the receipt format fails these tests instead of
 * silently diverging from them.
 */

import {
  createCompletedReceiptFromCheckpoint,
  createIdempotentReplayReceipt,
} from '../../literature-production-ingest/engine'
import { batchChecksumSequenceSummary } from '../../literature-production-ingest/receipt-binding'
import type { Checkpoint } from '../../literature-production-ingest/types'
import type { BatchReceipt } from './collect'
import type { IngestReceipt } from './ingest-receipt'

const OPERATION_ID = '11111111-2222-3333-4444-555555555555'
const PROJECTION = 'a'.repeat(64)
const MANIFEST = 'b'.repeat(64)
const CREATED_AT = '2026-08-15T00:00:00.000Z'
const TARGET = 'itcttmkxdxvwmwcmzmey'

function stage(state: Checkpoint['finalization']['state']): Checkpoint['finalization'] {
  return {
    state,
    requestChecksum: 'd'.repeat(64),
    submittedAt: CREATED_AT,
    acknowledgedAt: state === 'acknowledged' ? CREATED_AT : null,
    failureCode: null,
  }
}

export interface ReceiptFixtureOptions {
  mode?: 'canary' | 'full'
  outcome?: 'completed' | 'idempotent-replay'
  operationId?: string
  pmids?: readonly string[]
  recordCount?: number
  afterArticleCount?: number
}

function checkpointFor(options: ReceiptFixtureOptions): Checkpoint {
  const mode = options.mode ?? 'canary'
  const recordCount = options.recordCount ?? options.pmids?.length ?? 25
  return {
    schemaVersion: 'literature-production-ingest-checkpoint/1.0.0',
    engineVersion: 'literature-production-ingest/1.0.0',
    mappingVersion: 'literature-production-mapping/1.0.0',
    operationId: options.operationId ?? OPERATION_ID,
    mode,
    targetProjectRef: TARGET,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    sourceProjectionChecksum: PROJECTION,
    sourceRecordCount: recordCount,
    canaryManifestChecksum: mode === 'canary' ? MANIFEST : null,
    limits: { recordBatchLimit: 500, byteBatchLimit: 1_000_000, concurrency: 1 },
    batchIdentity: {
      sourceFilename: `literature-production-ingest/${mode}`,
      sourceFileSha256: PROJECTION,
      manifestVersion: 'literature-production-ingest/1.0.0',
      queryRegistryVersion: 'literature-production-ingest/1.0.0',
      sourceKind: 'unmapped',
      sourceId: 'fixed-local-bibliographic-corpus',
      queryId: mode === 'canary' ? 'production-canary' : 'production-full',
      recordLimit: null,
    },
    importBatchCreate: stage('acknowledged'),
    finalization: stage('acknowledged'),
    // The engine refuses to build a completed receipt without the durable finalization envelope,
    // so a fixture that omits it is not a shape the engine would ever produce.
    finalizationEnvelope: {
      completedAt: CREATED_AT,
      body: JSON.stringify({ completed_at: CREATED_AT, status: 'completed' }),
      checksum: 'd'.repeat(64),
    },
    phase: 'completed',
    beforeArticleCount: 0,
    afterArticleCount: options.afterArticleCount ?? recordCount,
    counters: {
      recordsRead: recordCount,
      uniquePmids: recordCount,
      duplicateOccurrences: 0,
      inserted: recordCount,
      updated: 0,
      unchanged: 0,
      errors: 0,
    },
    batches: [
      {
        index: 0,
        startOrdinal: 0,
        endOrdinal: recordCount,
        recordCount,
        articleBodyBytes: 1_024,
        journalBodyBytes: 256,
        provenanceBodyBytes: 512,
        checksum: 'e'.repeat(64),
        effects: { inserted: recordCount, updated: 0, unchanged: 0 },
        stages: {
          journals: stage('acknowledged'),
          articles: stage('acknowledged'),
          provenance: stage('acknowledged'),
        },
      },
    ],
  }
}

/** A receipt built by the engine's own builder. */
export function ingestReceiptFixture(options: ReceiptFixtureOptions = {}): IngestReceipt {
  const source = checkpointFor(options)
  /*
   * A canary receipt must carry its PMIDs.
   *
   * The engine refuses to build one without them — `Completed receipt recovery does not match the
   * operation mode.` — which the hand-authored fixture never exercised because it constructed the
   * object directly. Defaulting them here keeps every canary fixture in this package a shape the
   * engine would actually produce.
   */
  const mode = options.mode ?? 'canary'
  const recordCount = options.recordCount ?? options.pmids?.length ?? 25
  const pmids =
    mode === 'canary'
      ? [
          ...(options.pmids ??
            Array.from({ length: recordCount }, (_, i) => String(40_000_000 + i))),
        ]
      : undefined
  const built =
    (options.outcome ?? 'completed') === 'idempotent-replay'
      ? createIdempotentReplayReceipt({
          checkpoint: source,
          articleCount: options.afterArticleCount ?? source.sourceRecordCount,
          ...(pmids ? { canaryPmids: pmids } : {}),
          now: CREATED_AT,
        })
      : createCompletedReceiptFromCheckpoint({
          checkpoint: source,
          ...(pmids ? { canaryPmids: pmids } : {}),
          now: CREATED_AT,
        } as Parameters<typeof createCompletedReceiptFromCheckpoint>[0])
  return built as unknown as IngestReceipt
}

/**
 * The provenance rows the engine writes for a receipt's claims, under that receipt's batch.
 *
 * `batchId` is overridable so a test can express the case the binding exists to catch: the same
 * PMIDs, present and correct, whose provenance belongs to a different operation.
 */
export function provenanceForReceipt(
  receipt: IngestReceipt,
  batchId?: string,
): { pmid: string; batch_id: string; source_kind: string; source_filename: string }[] {
  return [...(receipt.canaryPmids ?? [])].map((pmid) => ({
    pmid,
    batch_id: batchId ?? receipt.importBatchId ?? receipt.operationId,
    source_kind: 'unmapped',
    source_filename: `literature-production-ingest/${receipt.mode}`,
  }))
}

/** The live article state an import leaves behind: the foundation defaults, and nothing curated. */
export function articleStatesForReceipt(
  receipt: IngestReceipt,
  overrides: Readonly<Record<string, { relevance_state?: string; visibility_state?: string }>> = {},
): { pmid: string; relevance_state: string; visibility_state: string }[] {
  return [...(receipt.canaryPmids ?? [])].map((pmid) => ({
    pmid,
    relevance_state: overrides[pmid]?.relevance_state ?? 'unreviewed',
    visibility_state: overrides[pmid]?.visibility_state ?? 'draft',
  }))
}

/**
 * The batch row the engine leaves behind, describing the **original completed operation**.
 *
 * Two things this fixture got wrong, both of which hid the stored-report gap:
 *
 *   1. it read its effect counters off the receipt, so for a *replay* receipt it produced a row
 *      claiming `inserted_count: 0`. The real row is never rewritten by a replay — it still records
 *      the original operation's 25 inserts. A fixture that agrees with the replay receipt instead
 *      of with the database is a fixture that cannot catch a receipt disagreeing with the database.
 *   2. its `report` carried eight fields. The engine persists eleven, and the three it omitted —
 *      `unchanged_count`, `batch_count`, `batch_checksums_sha256` — were exactly the ones nothing
 *      compared.
 *
 * The report below is transcribed from the engine's `buildFinalPatch` rather than reconstructed by
 * the contract that validates it, so a change to the engine's shape fails these tests instead of
 * agreeing with itself.
 */
export function batchRowForReceipt(receipt: IngestReceipt): BatchReceipt {
  // A replay writes nothing, so the durable row still holds the original operation's effects: the
  // canary fixture inserted every record it read.
  const original =
    receipt.outcome === 'idempotent-replay'
      ? { inserted: receipt.counters.uniquePmids, updated: 0, unchanged: 0 }
      : {
          inserted: receipt.counters.inserted,
          updated: receipt.counters.updated,
          unchanged: receipt.counters.unchanged,
        }
  const afterArticleCount = receipt.afterArticleCount ?? original.inserted

  return {
    id: receipt.importBatchId ?? receipt.operationId,
    status: 'completed',
    source_filename: `literature-production-ingest/${receipt.mode}`,
    source_file_sha256: receipt.sourceProjectionChecksum,
    // The engine's own value. A hand-written fixture had `all_pubmed_discovery` here, which is a
    // valid CHECK value and simply not the one this engine writes.
    source_kind: 'unmapped',
    records_read: receipt.counters.recordsRead,
    unique_pmids: receipt.counters.uniquePmids,
    inserted_count: original.inserted,
    updated_count: original.updated,
    duplicate_count: receipt.counters.duplicateOccurrences,
    error_count: 0,
    started_at: CREATED_AT,
    completed_at: receipt.completedAt,
    report: {
      engine_version: receipt.engineVersion,
      mapping_version: receipt.mappingVersion,
      operation_id: receipt.operationId,
      mode: receipt.mode,
      source_projection_checksum: receipt.sourceProjectionChecksum,
      canary_manifest_checksum: receipt.canaryManifestChecksum,
      unchanged_count: original.unchanged,
      before_article_count: afterArticleCount - original.inserted,
      after_article_count: afterArticleCount,
      batch_count: receipt.batchChecksums.length,
      batch_checksums_sha256: batchChecksumSequenceSummary(receipt.batchChecksums),
    },
    created_by: 'literature-production-ingest',
  }
}
