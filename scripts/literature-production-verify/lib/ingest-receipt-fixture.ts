/**
 * Build receipts the way the ingestion engine builds them.
 *
 * Test support, and deliberately not a hand-written literal: the checksum is computed with the same
 * canonicalization the engine uses, so a fixture that drifts from the engine's format fails the
 * shape guard rather than quietly testing a shape nothing produces. That is the exact failure mode
 * the cross-package audit found — two packages agreeing with their own fixtures and with nothing
 * else.
 */

import { createHash } from 'node:crypto'

import type { BatchReceipt } from './collect'
import { INGEST_RECEIPT_SCHEMA_VERSION, type IngestReceipt } from './ingest-receipt'

function canonicalJson(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort)
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([, child]) => child !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, sort(child)]),
      )
    }
    return input
  }
  return JSON.stringify(sort(value))
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export interface ReceiptFixtureOptions {
  mode?: 'canary' | 'full'
  outcome?: 'completed' | 'dry-run' | 'idempotent-replay'
  operationId?: string
  importBatchId?: string | null
  pmids?: readonly string[]
  recordsRead?: number
  inserted?: number
  updated?: number
  duplicateOccurrences?: number
  unchanged?: number
  beforeArticleCount?: number | null
  afterArticleCount?: number | null
  sourceProjectionChecksum?: string
  canaryManifestChecksum?: string | null
  batchChecksums?: readonly string[]
}

const OPERATION_ID = '11111111-2222-3333-4444-555555555555'
const PROJECTION = 'a'.repeat(64)
const MANIFEST = 'b'.repeat(64)

/** A receipt whose `receiptChecksum` is genuinely correct for its body. */
export function ingestReceiptFixture(options: ReceiptFixtureOptions = {}): IngestReceipt {
  const pmids = options.pmids
  const uniquePmids = pmids?.length ?? options.recordsRead ?? 25
  const body = {
    schemaVersion: INGEST_RECEIPT_SCHEMA_VERSION,
    engineVersion: 'literature-production-ingest/1.0.0',
    mappingVersion: 'literature-production-mapping/1.0.0',
    operationId: options.operationId ?? OPERATION_ID,
    mode: options.mode ?? 'canary',
    outcome: options.outcome ?? 'completed',
    targetProjectRef: 'itcttmkxdxvwmwcmzmey',
    completedAt: '2026-08-15T00:00:00.000Z',
    sourceProjectionChecksum: options.sourceProjectionChecksum ?? PROJECTION,
    sourceRecordCount: options.recordsRead ?? uniquePmids,
    canaryManifestChecksum:
      options.canaryManifestChecksum === undefined
        ? (options.mode ?? 'canary') === 'canary'
          ? MANIFEST
          : null
        : options.canaryManifestChecksum,
    ...(pmids ? { canaryPmids: [...pmids] } : {}),
    beforeArticleCount: options.beforeArticleCount ?? 0,
    afterArticleCount: options.afterArticleCount ?? uniquePmids,
    counters: {
      recordsRead: options.recordsRead ?? uniquePmids,
      uniquePmids,
      duplicateOccurrences: options.duplicateOccurrences ?? 0,
      inserted: options.inserted ?? uniquePmids,
      updated: options.updated ?? 0,
      unchanged: options.unchanged ?? 0,
    },
    batchChecksums: [...(options.batchChecksums ?? ['c'.repeat(64)])],
    importBatchId:
      options.importBatchId === undefined
        ? (options.operationId ?? OPERATION_ID)
        : options.importBatchId,
  }
  return { ...body, receiptChecksum: sha256(canonicalJson(body)) } as IngestReceipt
}

/** The batch row the engine writes for that receipt, including the `report` identity it stamps. */
export function batchRowForReceipt(receipt: IngestReceipt): BatchReceipt {
  return {
    id: receipt.importBatchId ?? receipt.operationId,
    status: 'completed',
    source_filename: `literature-production-ingest/${receipt.mode}`,
    source_file_sha256: receipt.sourceProjectionChecksum,
    source_kind: 'all_pubmed_discovery',
    records_read: receipt.counters.recordsRead,
    unique_pmids: receipt.counters.uniquePmids,
    inserted_count: receipt.counters.inserted,
    updated_count: receipt.counters.updated,
    duplicate_count: receipt.counters.duplicateOccurrences,
    error_count: 0,
    started_at: '2026-08-15T00:00:00.000Z',
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
      batch_checksums_sha256: sha256(canonicalJson([...receipt.batchChecksums])),
    },
    created_by: 'literature-production-ingest',
  }
}
