/** @jest-environment node */

import { batchChecksumSummary, createCheckpoint, createIdempotentReplayReceipt } from './engine'
import { preparedBatchRequestChecksums, streamPreparedBatches } from './batching'
import { receiptChecksum } from './checkpoint'
import { assertIngestReceipt, verifyCompletedIngestion } from './verify'
import { fixtureEnvelope, fixtureMapper, fixtureSource } from './test-fixtures'
import type { Checkpoint, SourceEnvelope } from './types'
import type {
  ImportBatchLookupRow,
  LiteratureTable,
  QueryParameters,
  ReadRowsOptions,
} from './transport'

const OPERATION_ID = '40000000-0000-4000-8000-000000000001'
const limits = { recordBatchLimit: 10, byteBatchLimit: 100_000, concurrency: 1 }

function sourceFactory(rows: readonly SourceEnvelope[]) {
  return { open: () => fixtureSource(rows) }
}

async function completedFixture() {
  const rows = [fixtureEnvelope('10001')]
  const mapper = fixtureMapper(OPERATION_ID, 'full')
  const batches = []
  for await (const batch of streamPreparedBatches(sourceFactory(rows).open(), mapper, limits)) {
    batches.push(batch)
  }
  const batch = batches[0]
  const projection = {
    recordCount: 1,
    duplicateOccurrences: 0,
    checksum: await (async () => {
      const { scanSourceProjection } = await import('./batching')
      return (await scanSourceProjection(sourceFactory(rows).open(), mapper)).checksum
    })(),
  }
  const checkpoint = createCheckpoint({
    mode: 'full',
    projection,
    limits,
    canaryManifestChecksum: null,
    operationId: OPERATION_ID,
  })
  const checksums = preparedBatchRequestChecksums(batch)
  const acknowledged = (requestChecksum: string | null) => ({
    state: 'acknowledged' as const,
    requestChecksum,
    submittedAt: checkpoint.createdAt,
    acknowledgedAt: checkpoint.createdAt,
    failureCode: null,
  })
  checkpoint.importBatchCreate = acknowledged('a'.repeat(64))
  checkpoint.finalization = acknowledged('b'.repeat(64))
  checkpoint.phase = 'completed'
  checkpoint.beforeArticleCount = 0
  checkpoint.afterArticleCount = 1
  checkpoint.counters = {
    recordsRead: 1,
    uniquePmids: 1,
    duplicateOccurrences: 0,
    inserted: 1,
    updated: 0,
    unchanged: 0,
    errors: 0,
  }
  checkpoint.batches = [
    {
      index: 0,
      startOrdinal: 1,
      endOrdinal: 1,
      recordCount: 1,
      articleBodyBytes: batch.articleBodyBytes,
      journalBodyBytes: batch.journalBodyBytes,
      provenanceBodyBytes: batch.provenanceBodyBytes,
      checksum: batch.checksum,
      effects: { inserted: 1, updated: 0, unchanged: 0 },
      stages: {
        journals: acknowledged(checksums.journals),
        articles: acknowledged(checksums.articles),
        provenance: acknowledged(checksums.provenance),
      },
    },
  ]
  const receipt = createIdempotentReplayReceipt({ checkpoint, articleCount: 1 })
  return { rows, mapper, checkpoint, batch, receipt }
}

class VerificationFakeTransport {
  readonly projectRef = 'itcttmkxdxvwmwcmzmey'
  constructor(
    private readonly checkpoint: Checkpoint,
    private readonly batch: Awaited<ReturnType<typeof completedFixture>>['batch'],
    private readonly searchVector: string | null = "'synthetic':1",
    private readonly reportOverrides: Record<string, unknown> = {},
  ) {}

  async countArticles() {
    return 1
  }

  async countRows(table: LiteratureTable, query?: QueryParameters) {
    void table
    void query
    return 1
  }

  async getImportBatch(id: string): Promise<ImportBatchLookupRow | null> {
    void id
    return {
      id: this.checkpoint.operationId,
      status: 'completed',
      // A completed row carries its completion timestamp and its writer. Without both, this stub
      // modelled a state the engine never produces and the corrected verifier refuses.
      completed_at: this.checkpoint.createdAt,
      created_by: 'literature-production-ingest',
      records_read: 1,
      unique_pmids: 1,
      inserted_count: 1,
      updated_count: 0,
      duplicate_count: 0,
      error_count: 0,
      report: {
        engine_version: this.checkpoint.engineVersion,
        mapping_version: this.checkpoint.mappingVersion,
        operation_id: this.checkpoint.operationId,
        mode: this.checkpoint.mode,
        source_projection_checksum: this.checkpoint.sourceProjectionChecksum,
        canary_manifest_checksum: this.checkpoint.canaryManifestChecksum,
        unchanged_count: this.checkpoint.counters.unchanged,
        before_article_count: this.checkpoint.beforeArticleCount,
        after_article_count: this.checkpoint.afterArticleCount,
        batch_count: this.checkpoint.batches.length,
        batch_checksums_sha256: batchChecksumSummary(this.checkpoint).batchChecksumsSha256,
        ...this.reportOverrides,
      },
    }
  }

  async readRows<T extends object>(
    table: LiteratureTable,
    options?: ReadRowsOptions,
  ): Promise<T[]> {
    void options
    if (table === 'literature_articles') {
      return this.batch.records.map((record) => ({
        ...record.article,
        search_vector: this.searchVector,
      })) as T[]
    }
    if (table === 'literature_article_sources') {
      return this.batch.records.map((record) => record.provenance) as T[]
    }
    if (table === 'literature_journals') return this.batch.journals as T[]
    throw new Error('Unexpected verification table')
  }
}

describe('completed ingestion verification', () => {
  it('proves exact metadata, fixed states, provenance, counts, and search vectors', async () => {
    const fixture = await completedFixture()
    const report = await verifyCompletedIngestion({
      checkpoint: fixture.checkpoint,
      receipt: fixture.receipt,
      sourceFactory: sourceFactory(fixture.rows),
      mapRecord: fixture.mapper,
      transport: new VerificationFakeTransport(fixture.checkpoint, fixture.batch),
      now: () => '2026-08-15T02:00:00.000Z',
    })
    expect(report).toEqual(
      expect.objectContaining({
        recordsVerified: 1,
        batchesVerified: 1,
        articleCount: 1,
        searchVectorsPopulated: 1,
      }),
    )
  })

  it('fails when the destination trigger left search_vector null', async () => {
    const fixture = await completedFixture()
    await expect(
      verifyCompletedIngestion({
        checkpoint: fixture.checkpoint,
        receipt: fixture.receipt,
        sourceFactory: sourceFactory(fixture.rows),
        mapRecord: fixture.mapper,
        transport: new VerificationFakeTransport(fixture.checkpoint, fixture.batch, null),
      }),
    ).rejects.toThrow('search_vector')
  })

  it('fails when any stable import-batch report field differs', async () => {
    const fixture = await completedFixture()
    await expect(
      verifyCompletedIngestion({
        checkpoint: fixture.checkpoint,
        receipt: fixture.receipt,
        sourceFactory: sourceFactory(fixture.rows),
        mapRecord: fixture.mapper,
        transport: new VerificationFakeTransport(
          fixture.checkpoint,
          fixture.batch,
          "'synthetic':1",
          { mode: 'conflicting-mode' },
        ),
      }),
    ).rejects.toThrow('import-batch report')
  })

  /*
   * Parity with the shared binding contract.
   *
   * The ingestion verifier has always compared the whole stored report by canonical-JSON equality,
   * so it already rejected each of these. The production verification path bound only six identity
   * fields, and each mutation below independently produced `verified` there. Running the same list
   * through both is what makes "the two packages agree" a test rather than a claim.
   */
  it.each([
    ['before_article_count wrong', { before_article_count: 777 }],
    ['after_article_count wrong', { after_article_count: 999 }],
    ['unchanged_count wrong', { unchanged_count: 999 }],
    ['batch_count wrong', { batch_count: 999 }],
    ['batch_checksums_sha256 wrong', { batch_checksums_sha256: 'c'.repeat(64) }],
    ['batch_checksums_sha256 malformed', { batch_checksums_sha256: 'not-a-digest' }],
    ['batch_checksums_sha256 omitted', { batch_checksums_sha256: undefined }],
    ['before_article_count omitted', { before_article_count: undefined }],
    ['after_article_count omitted', { after_article_count: undefined }],
    ['unchanged_count omitted', { unchanged_count: undefined }],
    ['batch_count omitted', { batch_count: undefined }],
  ])('refuses a completed operation whose stored report has %s', async (_label, override) => {
    const fixture = await completedFixture()
    await expect(
      verifyCompletedIngestion({
        checkpoint: fixture.checkpoint,
        receipt: fixture.receipt,
        sourceFactory: sourceFactory(fixture.rows),
        mapRecord: fixture.mapper,
        transport: new VerificationFakeTransport(
          fixture.checkpoint,
          fixture.batch,
          "'synthetic':1",
          override as Record<string, unknown>,
        ),
      }),
    ).rejects.toThrow(/import-batch report|not bound to what was observed/u)
  })

  it('rejects checksum-valid extra identity or membership fields in a receipt', async () => {
    const fixture = await completedFixture()
    const body = {
      ...fixture.receipt,
      cohortMembership: ['synthetic-forbidden-identity'],
    } as Record<string, unknown>
    delete body.receiptChecksum
    const unsafeReceipt = { ...body, receiptChecksum: receiptChecksum(body) }

    expect(() => assertIngestReceipt(unsafeReceipt)).toThrow('unexpected or missing fields')
  })
})
