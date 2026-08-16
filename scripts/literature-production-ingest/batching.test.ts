/** @jest-environment node */

import { jsonBody } from './canonical'
import {
  preparedBatchRequestChecksums,
  scanSourceProjection,
  streamPreparedBatches,
} from './batching'
import { fixtureEnvelope, fixtureMapper, fixtureSource } from './test-fixtures'
import type { PreparedBatch, PreparedRecord, SourceEnvelope } from './types'

const BATCH_ID = '10000000-0000-4000-8000-000000000001'

describe('streaming projection and batching', () => {
  it('collapses adjacent identical PMIDs and produces stable checksums', async () => {
    const rows = [fixtureEnvelope('10001'), fixtureEnvelope('10001'), fixtureEnvelope('10002')]
    const mapper = fixtureMapper(BATCH_ID, 'full')
    const first = await scanSourceProjection(fixtureSource(rows), mapper)
    const second = await scanSourceProjection(fixtureSource(rows), mapper)

    expect(first).toEqual(second)
    expect(first.recordCount).toBe(2)
    expect(first.duplicateOccurrences).toBe(1)
  })

  it('rejects conflicting duplicate PMIDs without keeping a corpus-sized set', async () => {
    const rows = [
      fixtureEnvelope('10001'),
      fixtureEnvelope('10001', { title: 'Conflicting duplicate' }),
    ]
    await expect(
      scanSourceProjection(fixtureSource(rows), fixtureMapper(BATCH_ID, 'full')),
    ).rejects.toThrow('Conflicting duplicate PMID')
  })

  it('rejects non-monotonic PMID input', async () => {
    const rows = [fixtureEnvelope('10002'), fixtureEnvelope('10001')]
    await expect(
      scanSourceProjection(fixtureSource(rows), fixtureMapper(BATCH_ID, 'full')),
    ).rejects.toThrow('PMID order')
  })

  it('bounds every actual JSON request body by records and UTF-8 bytes', async () => {
    const mapper = fixtureMapper(BATCH_ID, 'full')
    const first = mapper(fixtureEnvelope('10001'))
    const exactSingletonBytes = Math.max(
      jsonBody([first.article]).bytes,
      jsonBody(first.journal ? [first.journal] : []).bytes,
      jsonBody([first.provenance]).bytes,
    )
    const batches: PreparedBatch[] = []
    for await (const batch of streamPreparedBatches(
      fixtureSource([
        fixtureEnvelope('10001'),
        fixtureEnvelope('10002', { abstract: 'Unicode airway: 気道 🫁'.repeat(20) }),
      ]),
      mapper,
      { recordBatchLimit: 1, byteBatchLimit: exactSingletonBytes + 2_000, concurrency: 1 },
    )) {
      batches.push(batch)
    }

    expect(batches).toHaveLength(2)
    for (const batch of batches) {
      expect(batch.recordCount).toBe(1)
      expect(
        Math.max(batch.articleBodyBytes, batch.journalBodyBytes, batch.provenanceBodyBytes),
      ).toBeLessThanOrEqual(exactSingletonBytes + 2_000)
      expect(preparedBatchRequestChecksums(batch).articles).toMatch(/^[a-f0-9]{64}$/u)
    }
  })

  it('rejects one oversized abstract before yielding any mutating batch', async () => {
    const batches: PreparedBatch[] = []
    await expect(
      (async () => {
        for await (const batch of streamPreparedBatches(
          fixtureSource([fixtureEnvelope('10001', { abstract: 'x'.repeat(10_000) })]),
          fixtureMapper(BATCH_ID, 'full'),
          { recordBatchLimit: 100, byteBatchLimit: 1_000, concurrency: 1 },
        )) {
          batches.push(batch)
        }
      })(),
    ).rejects.toThrow('single mapped record')
    expect(batches).toHaveLength(0)
  })

  it('applies backpressure instead of consuming the full source', async () => {
    let consumed = 0
    async function* manyRows() {
      for (let index = 0; index < 100; index += 1) {
        consumed += 1
        yield fixtureEnvelope(String(10_000 + index))
      }
    }
    const iterator = streamPreparedBatches(manyRows(), fixtureMapper(BATCH_ID, 'full'), {
      recordBatchLimit: 2,
      byteBatchLimit: 100_000,
      concurrency: 1,
    })[Symbol.asyncIterator]()

    const first = await iterator.next()
    expect(first.done).toBe(false)
    expect(consumed).toBeLessThanOrEqual(3)
    await iterator.return?.(undefined)
  })

  it('streams a synthetic 132,350-record full corpus with bounded 250-record batches', async () => {
    const total = 132_350
    let produced = 0
    async function* corpus(): AsyncGenerator<SourceEnvelope> {
      for (let index = 0; index < total; index += 1) {
        produced += 1
        yield {
          article: { pmid: String(800_000_000_000 + index) },
          journal: null,
        } as SourceEnvelope
      }
    }
    const mapper = (envelope: SourceEnvelope): PreparedRecord => {
      const pmid = envelope.article.pmid
      return {
        article: { pmid } as PreparedRecord['article'],
        journal: null,
        provenance: {
          pmid,
          batch_id: BATCH_ID,
          source_kind: 'unmapped',
          source_id: 'fixed-local-bibliographic-corpus',
          query_id: 'production-full',
          source_filename: 'fixed-local-literature-articles',
        },
        canonicalChecksumInput: `synthetic-full-record:${pmid}`,
      }
    }
    let records = 0
    let batches = 0
    let largestBatch = 0
    for await (const batch of streamPreparedBatches(corpus(), mapper, {
      recordBatchLimit: 250,
      byteBatchLimit: 4 * 1024 * 1024,
      concurrency: 2,
    })) {
      records += batch.recordCount
      batches += 1
      largestBatch = Math.max(largestBatch, batch.recordCount)
    }

    expect(produced).toBe(total)
    expect(records).toBe(total)
    expect(batches).toBe(Math.ceil(total / 250))
    expect(largestBatch).toBe(250)
  }, 20_000)
})
