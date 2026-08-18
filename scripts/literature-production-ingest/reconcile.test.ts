/** @jest-environment node */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CheckpointStore } from './checkpoint'
import { createCheckpoint } from './engine'
import { preparedBatchRequestChecksums, streamPreparedBatches } from './batching'
import { applyReconciliationReceipt, reconcileCheckpoint } from './reconcile'
import { fixtureEnvelope, fixtureMapper, fixtureSource } from './test-fixtures'
import type { SourceEnvelope } from './types'
import type { ImportBatchLookupRow, LiteratureTable, ReadRowsOptions } from './transport'

const OPERATION_ID = '30000000-0000-4000-8000-000000000001'
const limits = { recordBatchLimit: 10, byteBatchLimit: 100_000, concurrency: 1 }

function sourceFactory(rows: readonly SourceEnvelope[]) {
  return { open: () => fixtureSource(rows) }
}

async function unresolvedCheckpoint() {
  const rows = [fixtureEnvelope('10001')]
  const mapper = fixtureMapper(OPERATION_ID, 'full')
  const projection = {
    recordCount: 1,
    duplicateOccurrences: 0,
    checksum: 'a'.repeat(64),
  }
  const checkpoint = createCheckpoint({
    mode: 'full',
    projection,
    limits,
    canaryManifestChecksum: null,
    operationId: OPERATION_ID,
  })
  const batches = []
  for await (const batch of streamPreparedBatches(sourceFactory(rows).open(), mapper, limits)) {
    batches.push(batch)
  }
  const batch = batches[0]
  const checksums = preparedBatchRequestChecksums(batch)
  checkpoint.importBatchCreate.state = 'acknowledged'
  checkpoint.importBatchCreate.requestChecksum = 'b'.repeat(64)
  checkpoint.importBatchCreate.acknowledgedAt = checkpoint.createdAt
  checkpoint.phase = 'needs_reconciliation'
  checkpoint.batches.push({
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
      journals: {
        state: 'acknowledged',
        requestChecksum: checksums.journals,
        submittedAt: checkpoint.createdAt,
        acknowledgedAt: checkpoint.createdAt,
        failureCode: null,
      },
      articles: {
        state: 'ambiguous',
        requestChecksum: checksums.articles,
        submittedAt: checkpoint.createdAt,
        acknowledgedAt: null,
        failureCode: 'transport_exception',
      },
      provenance: {
        state: 'prepared',
        requestChecksum: checksums.provenance,
        submittedAt: null,
        acknowledgedAt: null,
        failureCode: null,
      },
    },
  })
  return { rows, mapper, checkpoint, batch }
}

class ReadOnlyFakeTransport {
  readonly projectRef = 'itcttmkxdxvwmwcmzmey'
  constructor(
    private readonly articleRows: Record<string, unknown>[],
    private readonly importBatch: ImportBatchLookupRow | null = null,
  ) {}

  async getImportBatch(id: string): Promise<ImportBatchLookupRow | null> {
    void id
    return this.importBatch
  }

  async readRows<T extends object>(
    table: LiteratureTable,
    options?: ReadRowsOptions,
  ): Promise<T[]> {
    void options
    if (table !== 'literature_articles') throw new Error('Unexpected table')
    return this.articleRows as T[]
  }
}

describe('read-only reconciliation', () => {
  let directory = ''

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
    directory = ''
  })

  it('classifies an applied ambiguous article upsert and permits explicit resume', async () => {
    const { rows, mapper, checkpoint, batch } = await unresolvedCheckpoint()
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
    const receipt = await reconcileCheckpoint({
      checkpoint,
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      transport: new ReadOnlyFakeTransport(expected),
      now: () => '2026-08-15T01:00:00.000Z',
    })
    expect(receipt.observations).toEqual([
      { subject: 'batch:0:articles', classification: 'applied_exact' },
    ])
    expect(JSON.stringify(receipt)).not.toMatch(/10001/u)

    directory = await mkdtemp(join(tmpdir(), 'literature-reconcile-'))
    const store = new CheckpointStore(join(directory, 'checkpoint.json'))
    await store.create(checkpoint)
    const updated = await applyReconciliationReceipt(store, receipt)
    expect(updated.batches[0].stages.articles.state).toBe('acknowledged')
    expect(updated.phase).toBe('running')
  })

  it('classifies a definitively absent mutation as safe to resend', async () => {
    const { rows, mapper, checkpoint } = await unresolvedCheckpoint()
    const receipt = await reconcileCheckpoint({
      checkpoint,
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      transport: new ReadOnlyFakeTransport([]),
    })
    expect(receipt.observations[0].classification).toBe('absent_exact')
  })

  it('blocks partial or conflicting observations without changing the checkpoint', async () => {
    const { rows, mapper, checkpoint } = await unresolvedCheckpoint()
    const receipt = await reconcileCheckpoint({
      checkpoint,
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      transport: new ReadOnlyFakeTransport([
        {
          pmid: '10001',
          metadata_hash: 'f'.repeat(64),
          relevance_state: 'included',
          visibility_state: 'published',
          manual_override: true,
        },
      ]),
    })
    expect(receipt.observations[0].classification).toBe('partial_or_conflicting')

    directory = await mkdtemp(join(tmpdir(), 'literature-reconcile-'))
    const store = new CheckpointStore(join(directory, 'checkpoint.json'))
    await store.create(checkpoint)
    await expect(applyReconciliationReceipt(store, receipt)).rejects.toThrow(
      'safe exact continuation',
    )
    expect(store.current().batches[0].stages.articles.state).toBe('ambiguous')
  })

  it('treats a curation-only difference as conflicting', async () => {
    const { rows, mapper, checkpoint, batch } = await unresolvedCheckpoint()
    const expected = batch.records.map((record) => ({
      pmid: record.article.pmid,
      metadata_hash: record.article.metadata_hash,
      relevance_state: 'unreviewed',
      visibility_state: 'draft',
      manual_override: false,
      is_landmark: false,
      curation_reason: 'not cleared',
      classifier_version: null,
      classifier_payload: null,
    }))
    const receipt = await reconcileCheckpoint({
      checkpoint,
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      transport: new ReadOnlyFakeTransport(expected),
    })

    expect(receipt.observations[0].classification).toBe('partial_or_conflicting')
  })

  it('requires every stable import-batch create field for an applied acknowledgement', async () => {
    const { mapper, checkpoint } = await unresolvedCheckpoint()
    checkpoint.batches = []
    checkpoint.importBatchCreate = {
      state: 'ambiguous',
      requestChecksum: 'b'.repeat(64),
      submittedAt: checkpoint.createdAt,
      acknowledgedAt: null,
      failureCode: 'transport_exception',
    }
    const identity = checkpoint.batchIdentity
    const importBatch: ImportBatchLookupRow = {
      id: checkpoint.operationId,
      source_filename: identity.sourceFilename,
      source_file_sha256: identity.sourceFileSha256,
      manifest_version: identity.manifestVersion,
      query_registry_version: identity.queryRegistryVersion,
      source_kind: identity.sourceKind,
      source_id: identity.sourceId,
      query_id: identity.queryId,
      record_limit: identity.recordLimit,
      status: 'started',
      records_read: 0,
      unique_pmids: 0,
      inserted_count: 0,
      updated_count: 0,
      duplicate_count: 0,
      error_count: 0,
      started_at: checkpoint.createdAt,
      completed_at: null,
      created_by: 'literature-production-ingest',
      report: {
        engine_version: checkpoint.engineVersion,
        mapping_version: checkpoint.mappingVersion,
        operation_id: checkpoint.operationId,
        mode: checkpoint.mode,
        source_projection_checksum: checkpoint.sourceProjectionChecksum,
        canary_manifest_checksum: checkpoint.canaryManifestChecksum,
      },
    }
    const applied = await reconcileCheckpoint({
      checkpoint,
      sourceFactory: sourceFactory([]),
      mapRecord: mapper,
      transport: new ReadOnlyFakeTransport([], importBatch),
    })
    expect(applied.observations).toEqual([
      { subject: 'import_batch_create', classification: 'applied_exact' },
    ])

    const conflicting = await reconcileCheckpoint({
      checkpoint,
      sourceFactory: sourceFactory([]),
      mapRecord: mapper,
      transport: new ReadOnlyFakeTransport([], { ...importBatch, created_by: 'other' }),
    })
    expect(conflicting.observations[0].classification).toBe('partial_or_conflicting')
  })
})
