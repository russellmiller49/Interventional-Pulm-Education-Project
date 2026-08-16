/**
 * The ingestion engine's receipt, as this package reads it.
 *
 * ## Why this exists
 *
 * These two packages were built independently, and a contract audit found they had **no code
 * references to each other in either direction**. After a real canary the operator holds
 * `canary-<id>.receipt.json` — the engine's entire durable proof of what it did — and, before this
 * module, there was no flag on the verifier that would accept it. Every claim the receipt makes
 * went unverified by the tool whose whole job is verification, and nothing linked the corpus being
 * read to the operation that wrote it. "Exactly twenty-five unreviewed drafts are present" was
 * satisfied by *any* twenty-five unreviewed drafts, from any run, of any manifest.
 *
 * The receipt closes that gap, and it fixes three checks that were otherwise unpassable or wrong
 * against the new engine:
 *
 *   - **idempotency.** The engine's operation id is deterministic, so a replay reuses the same
 *     batch row and writes nothing at all; the old heuristic looked for a new batch or a moved
 *     `started_at`, which the previous importer produced under `--force` and this one never does.
 *     The receipt states `outcome: 'idempotent-replay'` directly.
 *   - **corpus counts.** The canary batch stays `completed` forever, so summing `records_read`
 *     across every completed batch double-counts it against a full-corpus declaration.
 *     `importBatchId` lets a reconciliation scope itself to one operation.
 *   - **source identity.** `source_file_sha256` holds a digest of the mapped projection, not of any
 *     file. Only the receipt says what that value is supposed to be.
 *
 * ## Trust
 *
 * A receipt is operator-supplied evidence, exactly like the catalog attestation and the corpus
 * expectation. It is not proof of anything on its own — it is a file. What makes it useful is that
 * every claim it carries is cross-checked against the database this package reads independently,
 * so a receipt describing a different operation disagrees visibly rather than being believed. The
 * checksum guard below only establishes that the file was not edited after the engine wrote it.
 */

import { createHash } from 'node:crypto'

/** The one schema version this package understands. Bumping the engine's must be deliberate. */
export const INGEST_RECEIPT_SCHEMA_VERSION = 'literature-production-ingest-receipt/1.0.0'

export interface IngestCounters {
  readonly recordsRead: number
  readonly uniquePmids: number
  readonly duplicateOccurrences: number
  readonly inserted: number
  readonly updated: number
  readonly unchanged: number
}

export interface IngestReceipt {
  readonly schemaVersion: string
  readonly engineVersion: string
  readonly mappingVersion: string
  readonly operationId: string
  readonly mode: 'canary' | 'full'
  readonly outcome: 'completed' | 'dry-run' | 'idempotent-replay'
  readonly targetProjectRef: string | null
  readonly completedAt: string
  readonly sourceProjectionChecksum: string
  readonly sourceRecordCount: number
  readonly canaryManifestChecksum: string | null
  readonly canaryPmids?: readonly string[]
  readonly beforeArticleCount: number | null
  readonly afterArticleCount: number | null
  readonly counters: IngestCounters
  readonly batchChecksums: readonly string[]
  readonly importBatchId: string | null
  readonly receiptChecksum: string
}

/**
 * Canonical JSON, byte-identical to the engine's own.
 *
 * Duplicated rather than imported across the package boundary on purpose: if the engine changes how
 * it canonicalizes, this package must notice by failing the checksum, not silently agree with it.
 */
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isCounters(value: unknown): value is IngestCounters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const counters = value as Record<string, unknown>
  return (
    isNonNegativeInteger(counters.recordsRead) &&
    isNonNegativeInteger(counters.uniquePmids) &&
    isNonNegativeInteger(counters.duplicateOccurrences) &&
    isNonNegativeInteger(counters.inserted) &&
    isNonNegativeInteger(counters.updated) &&
    isNonNegativeInteger(counters.unchanged)
  )
}

/**
 * Structural guard for a receipt file.
 *
 * Deliberately strict about the schema version: a receipt from a future engine is refused rather
 * than partially understood, because a partially understood receipt is exactly the thing that makes
 * a verification claim confidently wrong.
 */
export function isIngestReceipt(value: unknown): value is IngestReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const receipt = value as Record<string, unknown>

  return (
    receipt.schemaVersion === INGEST_RECEIPT_SCHEMA_VERSION &&
    typeof receipt.engineVersion === 'string' &&
    typeof receipt.mappingVersion === 'string' &&
    typeof receipt.operationId === 'string' &&
    receipt.operationId.length > 0 &&
    (receipt.mode === 'canary' || receipt.mode === 'full') &&
    (receipt.outcome === 'completed' ||
      receipt.outcome === 'dry-run' ||
      receipt.outcome === 'idempotent-replay') &&
    (receipt.targetProjectRef === null || typeof receipt.targetProjectRef === 'string') &&
    typeof receipt.completedAt === 'string' &&
    isSha256(receipt.sourceProjectionChecksum) &&
    isNonNegativeInteger(receipt.sourceRecordCount) &&
    (receipt.canaryManifestChecksum === null || isSha256(receipt.canaryManifestChecksum)) &&
    (receipt.canaryPmids === undefined || isStringArray(receipt.canaryPmids)) &&
    (receipt.beforeArticleCount === null || isNonNegativeInteger(receipt.beforeArticleCount)) &&
    (receipt.afterArticleCount === null || isNonNegativeInteger(receipt.afterArticleCount)) &&
    isCounters(receipt.counters) &&
    isStringArray(receipt.batchChecksums) &&
    (receipt.importBatchId === null || typeof receipt.importBatchId === 'string') &&
    isSha256(receipt.receiptChecksum)
  )
}

/**
 * Whether the receipt's own checksum still matches its body.
 *
 * Recomputed the way the engine computes it: sha256 over canonical JSON of the body with
 * `receiptChecksum` removed. This detects an edited receipt — a number changed by hand to make a
 * check pass — and nothing else. It is not a signature and proves no origin.
 */
export function ingestReceiptChecksumMatches(receipt: IngestReceipt): boolean {
  const body: Record<string, unknown> = { ...receipt }
  delete body.receiptChecksum
  return createHash('sha256').update(canonicalJson(body)).digest('hex') === receipt.receiptChecksum
}

/** The batch `report` column the engine writes. Read alongside the receipt, and cross-checked. */
export interface IngestBatchReport {
  readonly engine_version?: unknown
  readonly mapping_version?: unknown
  readonly operation_id?: unknown
  readonly mode?: unknown
  readonly source_projection_checksum?: unknown
  readonly canary_manifest_checksum?: unknown
  readonly batch_checksums_sha256?: unknown
  readonly before_article_count?: unknown
  readonly after_article_count?: unknown
}

export function ingestBatchReport(value: unknown): IngestBatchReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as IngestBatchReport
}

/** sha256 over the canonical form of the receipt's batch checksums, as the engine summarizes them. */
export function batchChecksumSummary(batchChecksums: readonly string[]): string {
  return createHash('sha256')
    .update(canonicalJson([...batchChecksums]))
    .digest('hex')
}
