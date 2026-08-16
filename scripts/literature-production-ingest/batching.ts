import { createHash } from 'node:crypto'

import { canonicalJson, jsonBody, sha256 } from './canonical'
import type {
  BatchLimits,
  PreparedBatch,
  PreparedRecord,
  SourceEnvelope,
  SourceProjection,
} from './types'

export type RecordMapper = (envelope: SourceEnvelope) => PreparedRecord

interface UniqueRecordState {
  duplicateOccurrences: number
  recordsRead: number
  uniquePmids: number
}

function comparePmids(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function lengthDelimitedUpdate(hash: ReturnType<typeof createHash>, value: string): void {
  const bytes = Buffer.byteLength(value)
  hash.update(String(bytes))
  hash.update(':')
  hash.update(value)
  hash.update(';')
}

async function* uniquePreparedRecords(
  source: AsyncIterable<SourceEnvelope>,
  mapRecord: RecordMapper,
  state: UniqueRecordState,
): AsyncGenerator<PreparedRecord> {
  let previous: PreparedRecord | null = null

  for await (const envelope of source) {
    state.recordsRead += 1
    const current = mapRecord(envelope)
    const pmid = current.article.pmid
    if (previous) {
      const order = comparePmids(previous.article.pmid, pmid)
      if (order > 0) {
        throw new Error('Source PMID order is not deterministic ascending order.')
      }
      if (order === 0) {
        state.duplicateOccurrences += 1
        if (previous.canonicalChecksumInput !== current.canonicalChecksumInput) {
          throw new Error('Conflicting duplicate PMID encountered in the source stream.')
        }
        continue
      }
    }

    state.uniquePmids += 1
    previous = current
    yield current
  }
}

export async function scanSourceProjection(
  source: AsyncIterable<SourceEnvelope>,
  mapRecord: RecordMapper,
): Promise<SourceProjection> {
  const state: UniqueRecordState = { duplicateOccurrences: 0, recordsRead: 0, uniquePmids: 0 }
  const hash = createHash('sha256')
  for await (const record of uniquePreparedRecords(source, mapRecord, state)) {
    lengthDelimitedUpdate(hash, record.canonicalChecksumInput)
  }
  return {
    recordCount: state.uniquePmids,
    duplicateOccurrences: state.duplicateOccurrences,
    checksum: hash.digest('hex'),
  }
}

function requestBytes(records: PreparedRecord[], journals: readonly unknown[]) {
  return {
    articleBodyBytes: jsonBody(records.map((record) => record.article)).bytes,
    journalBodyBytes: journals.length === 0 ? 0 : jsonBody(journals).bytes,
    provenanceBodyBytes: jsonBody(records.map((record) => record.provenance)).bytes,
  }
}

function preparedBatch(
  index: number,
  startOrdinal: number,
  records: PreparedRecord[],
): PreparedBatch {
  const journalMap = new Map<string, NonNullable<PreparedRecord['journal']>>()
  for (const record of records) {
    if (record.journal) journalMap.set(record.journal.id, record.journal)
  }
  const journals = [...journalMap.values()].sort((left, right) => left.id.localeCompare(right.id))
  const bytes = requestBytes(records, journals)
  const checksumInput = records.map((record) => record.canonicalChecksumInput)
  return {
    index,
    startOrdinal,
    endOrdinal: startOrdinal + records.length - 1,
    recordCount: records.length,
    ...bytes,
    checksum: sha256(canonicalJson(checksumInput)),
    records,
    journals,
  }
}

function assertBatchWithinLimits(batch: PreparedBatch, limits: BatchLimits): void {
  const largestBody = Math.max(
    batch.articleBodyBytes,
    batch.journalBodyBytes,
    batch.provenanceBodyBytes,
  )
  if (batch.recordCount > limits.recordBatchLimit || largestBody > limits.byteBatchLimit) {
    throw new Error(
      batch.recordCount === 1
        ? 'A single mapped record exceeds the configured byte batch limit.'
        : 'Prepared batch exceeds its configured record or byte limit.',
    )
  }
}

/**
 * Stream prepared batches and return the exact projection of the same pass when fully consumed.
 * The return value lets planning bind durable batch contracts and the corpus identity in one
 * read-only source transaction without retaining records.
 */
export async function* streamPreparedBatchesWithProjection(
  source: AsyncIterable<SourceEnvelope>,
  mapRecord: RecordMapper,
  limits: BatchLimits,
): AsyncGenerator<PreparedBatch, SourceProjection> {
  if (
    !Number.isSafeInteger(limits.recordBatchLimit) ||
    limits.recordBatchLimit < 1 ||
    !Number.isSafeInteger(limits.byteBatchLimit) ||
    limits.byteBatchLimit < 2 ||
    !Number.isSafeInteger(limits.concurrency) ||
    limits.concurrency < 1
  ) {
    throw new Error('Batch limits must be positive safe integers.')
  }

  const state: UniqueRecordState = { duplicateOccurrences: 0, recordsRead: 0, uniquePmids: 0 }
  const projectionHash = createHash('sha256')
  let records: PreparedRecord[] = []
  let batchIndex = 0
  let startOrdinal = 1

  for await (const record of uniquePreparedRecords(source, mapRecord, state)) {
    lengthDelimitedUpdate(projectionHash, record.canonicalChecksumInput)
    const singleton = preparedBatch(batchIndex, startOrdinal, [record])
    assertBatchWithinLimits(singleton, limits)

    if (records.length === 0) {
      records.push(record)
      continue
    }

    const candidate = preparedBatch(batchIndex, startOrdinal, [...records, record])
    const largestBody = Math.max(
      candidate.articleBodyBytes,
      candidate.journalBodyBytes,
      candidate.provenanceBodyBytes,
    )
    if (candidate.recordCount > limits.recordBatchLimit || largestBody > limits.byteBatchLimit) {
      const batch = preparedBatch(batchIndex, startOrdinal, records)
      assertBatchWithinLimits(batch, limits)
      yield batch
      batchIndex += 1
      startOrdinal += records.length
      records = [record]
    } else {
      records.push(record)
    }
  }

  if (records.length > 0) {
    const batch = preparedBatch(batchIndex, startOrdinal, records)
    assertBatchWithinLimits(batch, limits)
    yield batch
  }

  return {
    recordCount: state.uniquePmids,
    duplicateOccurrences: state.duplicateOccurrences,
    checksum: projectionHash.digest('hex'),
  }
}

export async function* streamPreparedBatches(
  source: AsyncIterable<SourceEnvelope>,
  mapRecord: RecordMapper,
  limits: BatchLimits,
): AsyncGenerator<PreparedBatch> {
  yield* streamPreparedBatchesWithProjection(source, mapRecord, limits)
}

export function preparedBatchRequestChecksums(batch: PreparedBatch) {
  return {
    journals: batch.journals.length === 0 ? null : jsonBody(batch.journals).checksum,
    articles: jsonBody(batch.records.map((record) => record.article)).checksum,
    provenance: jsonBody(batch.records.map((record) => record.provenance)).checksum,
  }
}
