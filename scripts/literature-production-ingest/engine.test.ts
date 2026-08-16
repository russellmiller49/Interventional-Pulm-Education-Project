/** @jest-environment node */

import {
  executeIngestion,
  planIngestion,
  type DestinationOperator,
  type ExistingArticleObservation,
} from './engine'
import { fixtureEnvelope, fixtureMapper, fixtureSource } from './test-fixtures'
import type {
  Checkpoint,
  DestinationArticleRow,
  PreparedBatch,
  SourceEnvelope,
  SourceJournalRow,
} from './types'

class MemoryLedger {
  constructor(private checkpoint: Checkpoint) {}

  current() {
    return this.checkpoint
  }

  async update(mutator: (checkpoint: Checkpoint) => void) {
    mutator(this.checkpoint)
    this.checkpoint.updatedAt = new Date().toISOString()
    return this.checkpoint
  }
}

class FakeDestination implements DestinationOperator {
  readonly articles = new Map<string, DestinationArticleRow>()
  readonly journals = new Map<string, SourceJournalRow>()
  readonly provenance = new Map<string, PreparedBatch['records'][number]['provenance']>()
  readonly importBatches = new Map<string, Record<string, unknown>>()
  articleCalls = 0
  mutationOrder: string[] = []
  articleFailure: 'none' | 'ambiguous_after_apply' | 'confirmed_before_apply' = 'none'

  async countArticles() {
    return this.articles.size
  }

  async findCompletedImportBatch() {
    return null
  }

  async observeArticles(pmids: string[]): Promise<ExistingArticleObservation[]> {
    return pmids.flatMap((pmid) => {
      const row = this.articles.get(pmid)
      return row
        ? [
            {
              pmid,
              metadata_hash: row.metadata_hash,
              relevance_state: row.relevance_state,
              visibility_state: row.visibility_state,
              manual_override: row.manual_override,
              is_landmark: row.is_landmark,
              curation_reason: row.curation_reason,
              classifier_version: row.classifier_version,
              classifier_payload: row.classifier_payload,
            },
          ]
        : []
    })
  }

  async createImportBatch(row: { id: string }) {
    this.mutationOrder.push('import-batch')
    this.importBatches.set(row.id, { ...row })
  }

  async upsertJournals(rows: SourceJournalRow[]) {
    this.mutationOrder.push('journals')
    for (const row of rows) this.journals.set(row.id, row)
  }

  async upsertArticles(rows: DestinationArticleRow[]) {
    this.mutationOrder.push('articles')
    this.articleCalls += 1
    if (this.articleFailure === 'confirmed_before_apply') {
      this.articleFailure = 'none'
      throw Object.assign(new Error('redacted confirmed failure'), {
        outcome: 'confirmed_failure',
        code: 'http_400',
      })
    }
    for (const row of rows) this.articles.set(row.pmid, row)
    if (this.articleFailure === 'ambiguous_after_apply') {
      this.articleFailure = 'none'
      throw Object.assign(new Error('redacted ambiguous acknowledgement'), {
        outcome: 'ambiguous',
        code: 'socket_reset',
      })
    }
  }

  async upsertArticleSources(rows: PreparedBatch['records'][number]['provenance'][]) {
    this.mutationOrder.push('provenance')
    for (const row of rows) this.provenance.set(`${row.batch_id}:${row.pmid}`, row)
  }

  async completeImportBatch(id: string, patch: Record<string, unknown>) {
    this.mutationOrder.push('complete')
    this.importBatches.set(id, { ...(this.importBatches.get(id) ?? {}), ...patch })
  }
}

function sourceFactory(rows: readonly SourceEnvelope[]) {
  return { open: () => fixtureSource(rows) }
}

const limits = { recordBatchLimit: 10, byteBatchLimit: 100_000, concurrency: 1 }

async function setup(
  rows: readonly SourceEnvelope[],
  mode: 'canary' | 'full' = 'full',
  batchLimits = limits,
) {
  const operationId =
    mode === 'full'
      ? '10000000-0000-4000-8000-000000000001'
      : '20000000-0000-4000-8000-000000000001'
  const mapper = fixtureMapper(operationId, mode)
  const planned = await planIngestion({
    mode,
    sourceFactory: sourceFactory(rows),
    mapRecord: mapper,
    limits: batchLimits,
    canaryManifestChecksum: mode === 'canary' ? 'd'.repeat(64) : null,
    operationId,
    now: '2026-08-15T00:00:00.000Z',
  })
  return { mapper, planned, ledger: new MemoryLedger(planned.checkpoint) }
}

describe('shared ingestion execution state machine', () => {
  it('uses journal-before-article ordering and forces safe article states', async () => {
    const rows = [fixtureEnvelope('10001'), fixtureEnvelope('10002')]
    const { mapper, planned, ledger } = await setup(rows)
    const destination = new FakeDestination()
    const result = await executeIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      projection: planned.projection,
      limits,
      canaryManifestChecksum: null,
      dryRun: false,
      destination,
      ledger,
    })

    expect(destination.mutationOrder).toEqual([
      'import-batch',
      'journals',
      'articles',
      'provenance',
      'complete',
    ])
    expect([...destination.articles.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relevance_state: 'unreviewed',
          visibility_state: 'draft',
          manual_override: false,
        }),
      ]),
    )
    expect(result.beforeArticleCount).toBe(0)
    expect(result.afterArticleCount).toBe(2)
    expect(result.counters.inserted).toBe(2)
    expect(result).not.toHaveProperty('canaryPmids')
  })

  it('runs an exact 25-record canary through the same executor', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => fixtureEnvelope(String(20_000 + index)))
    const { mapper, planned, ledger } = await setup(rows, 'canary')
    const destination = new FakeDestination()
    const result = await executeIngestion({
      mode: 'canary',
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      projection: planned.projection,
      limits,
      canaryManifestChecksum: 'd'.repeat(64),
      canaryPmids: rows.map((row) => row.article.pmid),
      dryRun: false,
      destination,
      ledger,
    })

    expect(result.sourceRecordCount).toBe(25)
    expect(result.afterArticleCount).toBe(25)
    expect(result.canaryPmids).toEqual(rows.map((row) => row.article.pmid))
    expect(destination.articles).toHaveProperty('size', 25)
  })

  it('upserts by PMID so a second execution creates no duplicate article rows', async () => {
    const rows = [fixtureEnvelope('10001'), fixtureEnvelope('10002')]
    const destination = new FakeDestination()
    const first = await setup(rows)
    await executeIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: first.mapper,
      projection: first.planned.projection,
      limits,
      canaryManifestChecksum: null,
      dryRun: false,
      destination,
      ledger: first.ledger,
    })

    const secondOperationId = '10000000-0000-4000-8000-000000000002'
    const secondMapper = fixtureMapper(secondOperationId, 'full')
    const secondPlan = await planIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: secondMapper,
      limits,
      canaryManifestChecksum: null,
      operationId: secondOperationId,
    })
    const replay = await executeIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: secondMapper,
      projection: secondPlan.projection,
      limits,
      canaryManifestChecksum: null,
      dryRun: false,
      destination,
      ledger: new MemoryLedger(secondPlan.checkpoint),
    })

    expect(destination.articles).toHaveProperty('size', 2)
    expect(replay.beforeArticleCount).toBe(2)
    expect(replay.afterArticleCount).toBe(2)
    expect(replay.counters.unchanged).toBe(2)
  })

  it('stops after one ambiguous acknowledgement and resumes only after reconciliation', async () => {
    const rows = [fixtureEnvelope('10001')]
    const { mapper, planned, ledger } = await setup(rows)
    const destination = new FakeDestination()
    destination.articleFailure = 'ambiguous_after_apply'

    await expect(
      executeIngestion({
        mode: 'full',
        sourceFactory: sourceFactory(rows),
        mapRecord: mapper,
        projection: planned.projection,
        limits,
        canaryManifestChecksum: null,
        dryRun: false,
        destination,
        ledger,
      }),
    ).rejects.toThrow('ambiguous')
    expect(destination.articleCalls).toBe(1)
    expect(destination.provenance).toHaveProperty('size', 0)
    expect(ledger.current().phase).toBe('needs_reconciliation')

    await ledger.update((checkpoint) => {
      checkpoint.batches[0].stages.articles.state = 'acknowledged'
      checkpoint.phase = 'running'
    })
    await executeIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      projection: planned.projection,
      limits,
      canaryManifestChecksum: null,
      dryRun: false,
      destination,
      ledger,
    })

    expect(destination.articleCalls).toBe(1)
    expect(destination.provenance).toHaveProperty('size', 1)
  })

  it('does not retry a confirmed failure inside the same execution', async () => {
    const rows = [fixtureEnvelope('10001')]
    const { mapper, planned, ledger } = await setup(rows)
    const destination = new FakeDestination()
    destination.articleFailure = 'confirmed_before_apply'

    await expect(
      executeIngestion({
        mode: 'full',
        sourceFactory: sourceFactory(rows),
        mapRecord: mapper,
        projection: planned.projection,
        limits,
        canaryManifestChecksum: null,
        dryRun: false,
        destination,
        ledger,
      }),
    ).rejects.toThrow('confirmed')
    expect(destination.articleCalls).toBe(1)
    expect(ledger.current().batches[0].stages.articles.state).toBe('confirmed_failure')

    const recovered = await executeIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      projection: planned.projection,
      limits,
      canaryManifestChecksum: null,
      dryRun: false,
      destination,
      ledger,
    })
    expect(recovered.outcome).toBe('completed')
    expect(destination.articleCalls).toBe(2)
    expect(ledger.current().phase).toBe('completed')
  })

  it('dry-run traverses batching without any destination or checkpoint mutation', async () => {
    const rows = [fixtureEnvelope('10001'), fixtureEnvelope('10002')]
    const { mapper, planned } = await setup(rows)
    const result = await executeIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      projection: planned.projection,
      limits,
      canaryManifestChecksum: null,
      dryRun: true,
    })

    expect(result.outcome).toBe('dry-run')
    expect(result.batchChecksums).toHaveLength(1)
    expect(result.targetProjectRef).toBeNull()
  })

  it('honors bounded concurrency without racing ordered batch registration', async () => {
    const rows = Array.from({ length: 4 }, (_, index) => fixtureEnvelope(String(30_000 + index)))
    const concurrentLimits = { ...limits, recordBatchLimit: 1, concurrency: 2 }
    const { mapper, planned, ledger } = await setup(rows, 'full', concurrentLimits)
    const destination = new FakeDestination()
    const upsertArticles = destination.upsertArticles.bind(destination)
    let active = 0
    let maximumActive = 0
    destination.upsertArticles = async (articles) => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10))
      try {
        await upsertArticles(articles)
      } finally {
        active -= 1
      }
    }

    await executeIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      projection: planned.projection,
      limits: concurrentLimits,
      canaryManifestChecksum: null,
      dryRun: false,
      destination,
      ledger,
    })

    expect(maximumActive).toBe(2)
    expect(destination.articles).toHaveProperty('size', 4)
    expect(ledger.current().batches).toHaveLength(4)
  })

  it('starts no later peer stages after an ambiguous concurrent acknowledgement', async () => {
    const rows = [fixtureEnvelope('31001'), fixtureEnvelope('31002')]
    const concurrentLimits = { ...limits, recordBatchLimit: 1, concurrency: 2 }
    const { mapper, planned, ledger } = await setup(rows, 'full', concurrentLimits)
    const destination = new FakeDestination()
    const upsertJournals = destination.upsertJournals.bind(destination)
    const upsertArticles = destination.upsertArticles.bind(destination)
    let journalCalls = 0
    let signalSecondJournal: () => void = () => undefined
    let releaseSecondJournal: () => void = () => undefined
    const secondJournalStarted = new Promise<void>((resolvePromise) => {
      signalSecondJournal = resolvePromise
    })
    const secondJournalMayFinish = new Promise<void>((resolvePromise) => {
      releaseSecondJournal = resolvePromise
    })
    destination.upsertJournals = async (journals) => {
      journalCalls += 1
      if (journalCalls === 2) {
        signalSecondJournal()
        await secondJournalMayFinish
      }
      await upsertJournals(journals)
    }
    destination.articleFailure = 'ambiguous_after_apply'
    destination.upsertArticles = async (articles) => {
      await secondJournalStarted
      try {
        await upsertArticles(articles)
      } finally {
        releaseSecondJournal()
      }
    }

    await expect(
      executeIngestion({
        mode: 'full',
        sourceFactory: sourceFactory(rows),
        mapRecord: mapper,
        projection: planned.projection,
        limits: concurrentLimits,
        canaryManifestChecksum: null,
        dryRun: false,
        destination,
        ledger,
      }),
    ).rejects.toThrow('ambiguous')

    expect(journalCalls).toBe(2)
    expect(destination.articleCalls).toBe(1)
    expect(destination.provenance).toHaveProperty('size', 0)
    expect(ledger.current().phase).toBe('needs_reconciliation')
  })

  it('binds every mutating batch to the read-only source plan', async () => {
    const plannedRows = [fixtureEnvelope('32001'), fixtureEnvelope('32002')]
    const changedRows = [
      plannedRows[0],
      fixtureEnvelope('32002', { title: 'Source changed after planning' }),
    ]
    const singleRecordLimits = { ...limits, recordBatchLimit: 1 }
    const { mapper, planned, ledger } = await setup(plannedRows, 'full', singleRecordLimits)
    const destination = new FakeDestination()

    await expect(
      executeIngestion({
        mode: 'full',
        sourceFactory: sourceFactory(changedRows),
        mapRecord: mapper,
        projection: planned.projection,
        limits: singleRecordLimits,
        canaryManifestChecksum: null,
        dryRun: false,
        destination,
        ledger,
      }),
    ).rejects.toThrow('durable checkpoint')
    expect(destination.articles.has('32002')).toBe(false)
    expect(destination.mutationOrder).not.toContain('complete')
  })

  it('refuses finalization when the exact before/after count delta is inconsistent', async () => {
    const rows = [fixtureEnvelope('33001')]
    const { mapper, planned, ledger } = await setup(rows)
    const destination = new FakeDestination()
    let countCalls = 0
    destination.countArticles = async () => {
      countCalls += 1
      return countCalls === 1 ? 0 : destination.articles.size + 1
    }

    await expect(
      executeIngestion({
        mode: 'full',
        sourceFactory: sourceFactory(rows),
        mapRecord: mapper,
        projection: planned.projection,
        limits,
        canaryManifestChecksum: null,
        dryRun: false,
        destination,
        ledger,
      }),
    ).rejects.toThrow('before/after')
    expect(destination.mutationOrder).not.toContain('complete')
    expect(ledger.current().phase).toBe('confirmed_failure')
  })

  it('counts a forced curation reset as an update rather than unchanged', async () => {
    const rows = [fixtureEnvelope('34001')]
    const { mapper, planned, ledger } = await setup(rows)
    const destination = new FakeDestination()
    const mapped = mapper(rows[0]).article
    destination.articles.set(mapped.pmid, mapped)
    const observeArticles = destination.observeArticles.bind(destination)
    destination.observeArticles = async (pmids) =>
      (await observeArticles(pmids)).map((row) => ({
        ...row,
        is_landmark: true,
        curation_reason: 'synthetic prior curation',
      }))

    const receipt = await executeIngestion({
      mode: 'full',
      sourceFactory: sourceFactory(rows),
      mapRecord: mapper,
      projection: planned.projection,
      limits,
      canaryManifestChecksum: null,
      dryRun: false,
      destination,
      ledger,
    })

    expect(receipt.counters.updated).toBe(1)
    expect(receipt.counters.unchanged).toBe(0)
  })
})
