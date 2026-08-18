import { readFile } from 'node:fs/promises'

import { canonicalJson } from './canonical'
import { receiptChecksum } from './checkpoint'
import {
  ARTICLE_SELECT_COLUMNS,
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  CANARY_SOURCE_AUTHORITY,
  ENGINE_VERSION,
  INGEST_WRITER_IDENTITY,
  MAPPING_VERSION,
  MAX_BATCH_COUNT,
  RECEIPT_SCHEMA_VERSION,
} from './constants'
import {
  classifyStoredBatchState,
  describeAmbiguousBatch,
  evaluateReceiptBinding,
  type ObservedArticleState,
  type ObservedBatchRow,
  type ObservedProvenanceRow,
} from './receipt-binding'
import { scanSourceProjection, streamPreparedBatches, type RecordMapper } from './batching'
import { batchChecksumSummary } from './engine'
import type {
  ImportBatchLookupRow,
  LiteratureTable,
  QueryParameters,
  ReadRowsOptions,
} from './transport'
import type { Checkpoint, IngestReceipt, PreparedBatch, SourceEnvelope } from './types'

export interface VerificationSourceFactory {
  open(): AsyncIterable<SourceEnvelope>
}

export interface VerificationTransport {
  projectRef: string
  countArticles(): Promise<number>
  countRows(table: LiteratureTable, query?: QueryParameters): Promise<number>
  getImportBatch(id: string): Promise<ImportBatchLookupRow | null>
  readRows<T extends object>(table: LiteratureTable, options?: ReadRowsOptions): Promise<T[]>
}

export interface VerificationReport {
  operationId: string
  mode: 'canary' | 'full'
  verifiedAt: string
  recordsVerified: number
  batchesVerified: number
  articleCount: number
  searchVectorsPopulated: number
}

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024
const READ_CHUNK_SIZE = 100
const DESTINATION_ARTICLE_COLUMNS = [
  ...ARTICLE_SELECT_COLUMNS,
  'relevance_state',
  'visibility_state',
  'manual_override',
  'is_landmark',
  'curation_reason',
  'classifier_version',
  'classifier_payload',
] as const
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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Narrow a PostgREST lookup row into the shape the binding contract compares against.
 *
 * `ImportBatchLookupRow` carries an index signature, so every counter arrives as `unknown`. Reading
 * them as numbers without checking would make a string `"25"` compare unequal to `25` and report
 * counter drift for a healthy row — or, worse, make a missing column read as `undefined` and
 * quietly satisfy a comparison somewhere. A non-numeric counter is a malformed row and says so.
 */
function observedBatchRow(row: ImportBatchLookupRow): ObservedBatchRow {
  const numeric = (key: string): number => {
    const value = row[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Destination import-batch column ${key} is absent or not numeric.`)
    }
    return value
  }
  return {
    id: row.id,
    status: row.status,
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    created_by: typeof row.created_by === 'string' ? row.created_by : null,
    source_file_sha256: row.source_file_sha256,
    records_read: numeric('records_read'),
    unique_pmids: numeric('unique_pmids'),
    inserted_count: numeric('inserted_count'),
    updated_count: numeric('updated_count'),
    duplicate_count: numeric('duplicate_count'),
    error_count: numeric('error_count'),
    report: row.report,
  }
}

export function assertIngestReceipt(value: unknown): asserts value is IngestReceipt {
  if (!isObject(value)) throw new Error('Ingestion receipt must be a JSON object.')
  const baseKeys = [
    'schemaVersion',
    'engineVersion',
    'mappingVersion',
    'operationId',
    'mode',
    'outcome',
    'targetProjectRef',
    'targetUrl',
    'writerIdentity',
    'sourceAuthority',
    'completedAt',
    'sourceProjectionChecksum',
    'sourceRecordCount',
    'canaryManifestChecksum',
    'beforeArticleCount',
    'afterArticleCount',
    'counters',
    'batchChecksums',
    'importBatchId',
    'receiptChecksum',
  ]
  const expectedKeys = value.mode === 'canary' ? [...baseKeys, 'canaryPmids'] : baseKeys
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson(expectedKeys.sort())) {
    throw new Error('Ingestion receipt contains unexpected or missing fields.')
  }
  const nonNegativeInteger = (candidate: unknown) =>
    Number.isSafeInteger(candidate) && (candidate as number) >= 0
  const nullableNonNegativeInteger = (candidate: unknown) =>
    candidate === null || nonNegativeInteger(candidate)
  const counters = isObject(value.counters) ? value.counters : null
  if (
    value.schemaVersion !== RECEIPT_SCHEMA_VERSION ||
    value.engineVersion !== ENGINE_VERSION ||
    value.mappingVersion !== MAPPING_VERSION ||
    (value.mode !== 'canary' && value.mode !== 'full') ||
    !['completed', 'dry-run', 'idempotent-replay'].includes(String(value.outcome)) ||
    typeof value.operationId !== 'string' ||
    value.operationId.length === 0 ||
    typeof value.completedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.completedAt)) ||
    typeof value.sourceProjectionChecksum !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.sourceProjectionChecksum) ||
    !nonNegativeInteger(value.sourceRecordCount) ||
    !nullableNonNegativeInteger(value.beforeArticleCount) ||
    !nullableNonNegativeInteger(value.afterArticleCount) ||
    !Array.isArray(value.batchChecksums) ||
    value.batchChecksums.length > MAX_BATCH_COUNT ||
    value.batchChecksums.some(
      (checksum) => typeof checksum !== 'string' || !/^[a-f0-9]{64}$/u.test(checksum),
    ) ||
    !counters ||
    canonicalJson(Object.keys(counters).sort()) !==
      canonicalJson(
        [
          'recordsRead',
          'uniquePmids',
          'duplicateOccurrences',
          'inserted',
          'updated',
          'unchanged',
          'errors',
        ].sort(),
      ) ||
    Object.values(counters).some((counter) => !nonNegativeInteger(counter)) ||
    typeof value.receiptChecksum !== 'string' ||
    value.receiptChecksum !== receiptChecksum(value)
  ) {
    throw new Error('Ingestion receipt is unsupported or failed its checksum.')
  }
  if (value.mode === 'canary') {
    if (
      typeof value.canaryManifestChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(value.canaryManifestChecksum) ||
      !Array.isArray(value.canaryPmids) ||
      value.canaryPmids.length !== 25 ||
      new Set(value.canaryPmids).size !== 25 ||
      value.canaryPmids.some((pmid) => typeof pmid !== 'string' || !/^[1-9]\d{0,11}$/u.test(pmid))
    ) {
      throw new Error('Canary receipt is not bound to an exact authorized manifest.')
    }
  } else if (value.canaryManifestChecksum !== null || 'canaryPmids' in value) {
    throw new Error('Full receipt must not contain canary identity fields.')
  }
  if (
    value.outcome === 'dry-run'
      ? value.targetProjectRef !== null ||
        value.targetUrl !== null ||
        value.importBatchId !== null ||
        value.beforeArticleCount !== null ||
        value.afterArticleCount !== null
      : value.targetProjectRef !== APPROVED_PROJECT_REF ||
        value.targetUrl !== APPROVED_PROJECT_URL ||
        value.importBatchId !== value.operationId ||
        value.beforeArticleCount === null ||
        value.afterArticleCount === null
  ) {
    throw new Error('Ingestion receipt outcome fields are inconsistent.')
  }
  /*
   * The reviewed identity, pinned rather than merely present.
   *
   * `writerIdentity` and `sourceAuthority` are what make the receipt say *who* wrote and *what
   * cohort* authorized the write. Accepting any nonempty string here would make both fields
   * decoration; they are compared to the same constants the binding contract compares the stored
   * row against, so the receipt and the database cannot disagree about them silently.
   */
  if (value.writerIdentity !== INGEST_WRITER_IDENTITY) {
    throw new Error('Ingestion receipt does not name the reviewed ingestion writer.')
  }
  if (value.sourceAuthority !== (value.mode === 'canary' ? CANARY_SOURCE_AUTHORITY : null)) {
    throw new Error('Ingestion receipt does not name the authorized source cohort for its mode.')
  }
}

export async function readIngestReceipt(path: string): Promise<IngestReceipt> {
  const content = await readFile(path, 'utf8')
  if (Buffer.byteLength(content) > MAX_RECEIPT_BYTES) {
    throw new Error('Ingestion receipt exceeds the maximum allowed size.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(content) as unknown
  } catch {
    throw new Error('Ingestion receipt is not valid JSON.')
  }
  assertIngestReceipt(parsed)
  return parsed
}

function inFilter(values: readonly string[]): string {
  if (values.length === 0 || values.some((value) => !/^[a-z0-9_-]+$/u.test(value))) {
    throw new Error('Verification filter contains an invalid identifier.')
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

function assertExactRows(
  actual: readonly object[],
  expected: readonly object[],
  identityKeys: readonly string[],
  label: string,
): void {
  if (
    actual.length !== expected.length ||
    canonicalJson(sortedRows(actual, identityKeys)) !==
      canonicalJson(sortedRows(expected, identityKeys))
  ) {
    throw new Error(`${label} does not exactly match the source projection.`)
  }
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function assertCheckpointAndReceipt(checkpoint: Checkpoint, receipt: IngestReceipt): void {
  assertIngestReceipt(receipt)
  if (
    checkpoint.phase !== 'completed' ||
    receipt.outcome === 'dry-run' ||
    checkpoint.operationId !== receipt.operationId ||
    checkpoint.mode !== receipt.mode ||
    checkpoint.targetProjectRef !== APPROVED_PROJECT_REF ||
    receipt.targetProjectRef !== APPROVED_PROJECT_REF ||
    checkpoint.sourceProjectionChecksum !== receipt.sourceProjectionChecksum ||
    checkpoint.sourceRecordCount !== receipt.sourceRecordCount ||
    checkpoint.canaryManifestChecksum !== receipt.canaryManifestChecksum ||
    canonicalJson(checkpoint.batches.map((batch) => batch.checksum)) !==
      canonicalJson(receipt.batchChecksums)
  ) {
    throw new Error('Receipt and checkpoint do not describe the same completed operation.')
  }
  if (
    checkpoint.batches.some((batch) =>
      Object.values(batch.stages).some(
        (stage) => stage.state !== 'acknowledged' && stage.state !== 'not_required',
      ),
    ) ||
    checkpoint.importBatchCreate.state !== 'acknowledged' ||
    checkpoint.finalization.state !== 'acknowledged'
  ) {
    throw new Error('Completed checkpoint still contains an unresolved mutation stage.')
  }
}

async function verifyPreparedBatch(
  transport: VerificationTransport,
  checkpoint: Checkpoint,
  batch: PreparedBatch,
): Promise<number> {
  let searchVectorsPopulated = 0
  for (const recordChunk of chunks(batch.records, READ_CHUNK_SIZE)) {
    const pmids = recordChunk.map((record) => record.article.pmid)
    const articleRows = await transport.readRows<Record<string, unknown>>('literature_articles', {
      query: {
        select: `${DESTINATION_ARTICLE_COLUMNS.join(',')},search_vector`,
        pmid: inFilter(pmids),
        order: 'pmid.asc',
      },
    })
    const projectedArticles = articleRows.map((row) => {
      if (row.search_vector === null || row.search_vector === undefined) {
        throw new Error('Destination search trigger did not populate search_vector.')
      }
      searchVectorsPopulated += 1
      const { search_vector: _searchVector, ...article } = row
      void _searchVector
      return article
    })
    assertExactRows(
      projectedArticles,
      recordChunk.map((record) => record.article),
      ['pmid'],
      'Destination article rows',
    )

    const provenanceRows = await transport.readRows<Record<string, unknown>>(
      'literature_article_sources',
      {
        query: {
          select: PROVENANCE_COLUMNS.join(','),
          batch_id: `eq.${checkpoint.operationId}`,
          pmid: inFilter(pmids),
          order: 'pmid.asc',
        },
      },
    )
    assertExactRows(
      provenanceRows,
      recordChunk.map((record) => record.provenance),
      ['pmid', 'batch_id'],
      'Destination operation provenance rows',
    )
  }

  if (batch.journals.length > 0) {
    const journalRows = await transport.readRows<Record<string, unknown>>('literature_journals', {
      query: {
        select: JOURNAL_COLUMNS.join(','),
        id: inFilter(batch.journals.map((journal) => journal.id)),
        order: 'id.asc',
      },
    })
    assertExactRows(journalRows, batch.journals, ['id'], 'Destination journal rows')
  }
  return searchVectorsPopulated
}

export async function verifyCompletedIngestion(input: {
  checkpoint: Checkpoint
  receipt: IngestReceipt
  sourceFactory: VerificationSourceFactory
  mapRecord: RecordMapper
  transport: VerificationTransport
  canaryPmids?: readonly string[]
  now?: () => string
}): Promise<VerificationReport> {
  assertCheckpointAndReceipt(input.checkpoint, input.receipt)
  if (input.checkpoint.targetProjectRef !== input.transport.projectRef) {
    throw new Error('Verification target does not match the completed operation.')
  }
  if (input.checkpoint.mode === 'canary') {
    if (
      !input.canaryPmids ||
      input.canaryPmids.length !== 25 ||
      canonicalJson(input.receipt.canaryPmids) !== canonicalJson(input.canaryPmids)
    ) {
      throw new Error('Canary verification is not bound to the authorized manifest.')
    }
  } else if (input.receipt.canaryPmids !== undefined) {
    throw new Error('Full-mode receipt must not disclose canary identities.')
  }

  const projection = await scanSourceProjection(input.sourceFactory.open(), input.mapRecord)
  if (
    projection.checksum !== input.checkpoint.sourceProjectionChecksum ||
    projection.recordCount !== input.checkpoint.sourceRecordCount ||
    projection.duplicateOccurrences !== input.checkpoint.counters.duplicateOccurrences
  ) {
    throw new Error('Verification source projection drifted from the completed operation.')
  }

  let batchesVerified = 0
  let recordsVerified = 0
  let searchVectorsPopulated = 0
  for await (const batch of streamPreparedBatches(
    input.sourceFactory.open(),
    input.mapRecord,
    input.checkpoint.limits,
  )) {
    const saved = input.checkpoint.batches[batch.index]
    if (
      !saved ||
      saved.checksum !== batch.checksum ||
      saved.startOrdinal !== batch.startOrdinal ||
      saved.endOrdinal !== batch.endOrdinal
    ) {
      throw new Error('Verification batch does not match the durable checkpoint.')
    }
    searchVectorsPopulated += await verifyPreparedBatch(input.transport, input.checkpoint, batch)
    batchesVerified += 1
    recordsVerified += batch.recordCount
  }
  if (
    batchesVerified !== input.checkpoint.batches.length ||
    recordsVerified !== input.checkpoint.sourceRecordCount
  ) {
    throw new Error('Verification did not traverse the complete imported source.')
  }

  const provenanceCount = await input.transport.countRows('literature_article_sources', {
    batch_id: `eq.${input.checkpoint.operationId}`,
  })
  if (provenanceCount !== input.checkpoint.sourceRecordCount) {
    throw new Error('Operation provenance count is not exact.')
  }
  const articleCount = await input.transport.countArticles()
  if (input.receipt.afterArticleCount === null || articleCount < input.receipt.afterArticleCount) {
    throw new Error('Destination article count is below the operation receipt watermark.')
  }

  const importBatch = await input.transport.getImportBatch(input.checkpoint.operationId)
  if (!importBatch || !isObject(importBatch.report)) {
    throw new Error('Destination import-batch record is absent or incomplete.')
  }
  /*
   * Completion is a state that carries its timestamp.
   *
   * `status !== 'completed'` was the whole test, so a row marked completed with a null
   * `completed_at` verified cleanly — the same inconsistent state that reconciliation used to
   * classify `applied_exact`. Both paths now resolve it through one classifier.
   */
  const storedState = classifyStoredBatchState(importBatch)
  if (storedState.kind !== 'completed') {
    throw new Error(
      'Destination import-batch record is not in a resolvable completed state. ' +
        (storedState.kind === 'ambiguous' ? describeAmbiguousBatch(storedState.reason) : ''),
    )
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
  if (
    importBatch.records_read !== input.checkpoint.counters.recordsRead ||
    importBatch.unique_pmids !== input.checkpoint.counters.uniquePmids ||
    importBatch.inserted_count !== input.checkpoint.counters.inserted ||
    importBatch.updated_count !== input.checkpoint.counters.updated ||
    importBatch.duplicate_count !== input.checkpoint.counters.duplicateOccurrences ||
    importBatch.error_count !== 0 ||
    canonicalJson(importBatch.report) !== canonicalJson(expectedReport)
  ) {
    throw new Error('Destination import-batch report does not match the checkpoint.')
  }

  if (
    input.receipt.beforeArticleCount === null ||
    input.receipt.afterArticleCount === null ||
    input.receipt.afterArticleCount - input.receipt.beforeArticleCount !==
      input.receipt.counters.inserted
  ) {
    throw new Error('Receipt before/after article counts are not exact.')
  }
  if (
    input.checkpoint.mode === 'canary' &&
    input.receipt.outcome === 'completed' &&
    input.receipt.beforeArticleCount === 0 &&
    input.receipt.afterArticleCount !== 25
  ) {
    throw new Error('Empty-target canary did not produce the exact +25 article count.')
  }
  if (
    input.receipt.outcome === 'idempotent-replay' &&
    (input.receipt.beforeArticleCount !== input.receipt.afterArticleCount ||
      input.receipt.counters.inserted !== 0)
  ) {
    throw new Error('Idempotent replay changed the destination article count.')
  }

  /*
   * The shared binding, enforced in full rather than as a subset.
   *
   * Everything above verifies the *source* reconciles with the destination. This verifies the
   * *receipt* is bound to what was independently observed: the exact project and canonical URL,
   * the reviewed writer, the stored operation identity, batch-scoped provenance, duplicate claims,
   * and the live draft/unreviewed state of every claimed article. It is the identical function the
   * verification package's V55–V59 call, so the two packages cannot enforce different contracts.
   */
  const claimedPmids = input.receipt.canaryPmids ?? []
  const boundProvenance: ObservedProvenanceRow[] = []
  const boundArticles: ObservedArticleState[] = []
  if (claimedPmids.length > 0) {
    for (const pmidChunk of chunks(claimedPmids, READ_CHUNK_SIZE)) {
      boundProvenance.push(
        ...(await input.transport.readRows<ObservedProvenanceRow>('literature_article_sources', {
          query: { select: 'pmid,batch_id', pmid: inFilter(pmidChunk), order: 'pmid.asc' },
        })),
      )
      boundArticles.push(
        ...(await input.transport.readRows<ObservedArticleState>('literature_articles', {
          query: {
            select: 'pmid,relevance_state,visibility_state',
            pmid: inFilter(pmidChunk),
            order: 'pmid.asc',
          },
        })),
      )
    }
  }
  const binding = evaluateReceiptBinding(input.receipt, {
    observedProjectRef: input.transport.projectRef,
    observedUrl: APPROVED_PROJECT_URL,
    batch: observedBatchRow(importBatch),
    batchesObserved: true,
    provenance: boundProvenance,
    articleStates: boundArticles,
    totalArticles: articleCount,
  })
  if (binding.findings.length > 0) {
    throw new Error(
      `The ingestion receipt is not bound to what was observed: ${binding.findings
        .map((entry) => `[${entry.code}] ${entry.subject}: ${entry.detail}`)
        .join(' ')}`,
    )
  }

  return {
    operationId: input.checkpoint.operationId,
    mode: input.checkpoint.mode,
    verifiedAt: (input.now ?? (() => new Date().toISOString()))(),
    recordsVerified,
    batchesVerified,
    articleCount,
    searchVectorsPopulated,
  }
}
