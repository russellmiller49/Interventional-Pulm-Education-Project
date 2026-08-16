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

/** The batch row the engine leaves behind for that receipt. */
export function batchRowForReceipt(receipt: IngestReceipt): BatchReceipt {
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
    inserted_count: receipt.counters.inserted,
    updated_count: receipt.counters.updated,
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
      before_article_count: receipt.beforeArticleCount,
      after_article_count: receipt.afterArticleCount,
    },
    created_by: 'literature-production-ingest',
  }
}
