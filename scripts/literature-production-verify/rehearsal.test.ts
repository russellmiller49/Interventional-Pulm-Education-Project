/** @jest-environment node */

/**
 * Disposable end-to-end rehearsal: run the real ingestion engine, verify its real output.
 *
 * Everything else in this repository tests one package against fixtures. This runs
 * `executeIngestion` — the actual executor, the actual mapper, the actual checkpoint ledger —
 * against an in-memory destination, then takes the receipt it returns and the rows it wrote and
 * puts them through the verifier's checks. Nothing is invented in between.
 *
 * ## What "disposable" means here, precisely
 *
 * The destination is a `Map` that lives for the duration of one test. No Postgres, no Supabase, no
 * network. The protected local corpus is not read — the source is a generated fixture stream — and
 * no remote database is contacted. That is the whole point: these paths must be exercised before
 * anyone runs them against `IP_Literature`, and exercising them must cost nothing and risk nothing.
 *
 * ## What this does NOT establish
 *
 * An in-memory destination cannot prove PostgREST semantics: not the `on_conflict` upsert
 * behaviour, not the CHECK constraints, not RLS, not the `max-rows` ceiling. Those need a real
 * Postgres. What this proves is the layer above — that the engine's control flow, its receipt, and
 * the verifier's reading of that receipt agree with each other on the four paths that matter.
 */

import {
  executeIngestion,
  planIngestion,
  type DestinationOperator,
  type ExistingArticleObservation,
} from '../literature-production-ingest/engine'
import {
  fixtureEnvelope,
  fixtureMapper,
  fixtureSource,
} from '../literature-production-ingest/test-fixtures'
import type {
  Checkpoint,
  DestinationArticleRow,
  PreparedBatch,
  SourceEnvelope,
  SourceJournalRow,
} from '../literature-production-ingest/types'
import { checkIngestReceiptBinding } from './lib/checks'
import type { BatchReceipt, SourceRow } from './lib/collect'
import {
  isIngestReceipt,
  ingestReceiptChecksumMatches,
  type IngestReceipt,
} from './lib/ingest-receipt'
import { observed } from './lib/observation'

const APPROVED = 'itcttmkxdxvwmwcmzmey'
const MANIFEST = 'd'.repeat(64)
const LIMITS = { recordBatchLimit: 10, byteBatchLimit: 100_000, concurrency: 1 }

/** A destination that exists for one test and forgets everything afterwards. */
class DisposableDestination implements DestinationOperator {
  readonly articles = new Map<string, DestinationArticleRow>()
  readonly journals = new Map<string, SourceJournalRow>()
  readonly provenance = new Map<string, PreparedBatch['records'][number]['provenance']>()
  readonly importBatches = new Map<string, Record<string, unknown>>()

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
    this.importBatches.set(row.id, { ...row })
  }
  async upsertJournals(rows: SourceJournalRow[]) {
    for (const row of rows) this.journals.set(row.id, row)
  }
  async upsertArticles(rows: DestinationArticleRow[]) {
    for (const row of rows) this.articles.set(row.pmid, row)
  }
  async upsertArticleSources(rows: PreparedBatch['records'][number]['provenance'][]) {
    for (const row of rows) this.provenance.set(`${row.batch_id}:${row.pmid}`, row)
  }
  async completeImportBatch(id: string, patch: Record<string, unknown>) {
    this.importBatches.set(id, { ...(this.importBatches.get(id) ?? {}), ...patch })
  }
}

/** The database observations the verifier would collect, derived from what the engine wrote. */
function observationsFrom(destination: DisposableDestination) {
  const batches: BatchReceipt[] = [...destination.importBatches.values()].map(
    (row) => row as unknown as BatchReceipt,
  )
  const sources: SourceRow[] = [...destination.provenance.values()].map((row) => ({
    pmid: row.pmid,
    batch_id: row.batch_id,
    source_kind: row.source_kind,
    source_filename: row.source_filename,
  }))
  return { batches, sources, totalArticles: destination.articles.size }
}

/** The engine's own planner builds the durable checkpoint; nothing here hand-rolls one. */
class MemoryLedger {
  constructor(private checkpoint: Checkpoint) {}
  current() {
    return this.checkpoint
  }
  async update(mutate: (checkpoint: Checkpoint) => void) {
    mutate(this.checkpoint)
    return this.checkpoint
  }
}

const OPERATION_ID = '20000000-0000-4000-8000-000000000001'

async function runCanary(recordCount: number) {
  const rows: SourceEnvelope[] = Array.from({ length: recordCount }, (_, index) =>
    fixtureEnvelope(String(20_000 + index)),
  )
  const mapper = fixtureMapper(OPERATION_ID, 'canary')
  // The real planner: it computes the projection checksum, the batch plan, and the checkpoint the
  // executor then refuses to deviate from.
  const planned = await planIngestion({
    mode: 'canary',
    sourceFactory: { open: () => fixtureSource(rows) },
    mapRecord: mapper,
    limits: LIMITS,
    canaryManifestChecksum: MANIFEST,
    operationId: OPERATION_ID,
    now: '2026-08-15T00:00:00.000Z',
  })
  const destination = new DisposableDestination()
  const ledger = new MemoryLedger(planned.checkpoint)
  const receipt = await executeIngestion({
    mode: 'canary',
    sourceFactory: { open: () => fixtureSource(rows) },
    mapRecord: mapper,
    projection: planned.projection,
    limits: LIMITS,
    canaryManifestChecksum: MANIFEST,
    canaryPmids: rows.map((row) => row.article.pmid),
    dryRun: false,
    destination,
    ledger,
  } as unknown as Parameters<typeof executeIngestion>[0])
  return {
    receipt: receipt as unknown as IngestReceipt,
    destination,
    planned,
    mapper,
    rows,
    pmids: rows.map((row) => row.article.pmid),
  }
}

describe('disposable 25-record canary, executed and then verified', () => {
  it('writes twenty-five records and produces a receipt the verifier accepts', async () => {
    const { receipt, destination, pmids } = await runCanary(25)

    // The engine really ran: rows landed, and the receipt is its own output.
    expect(destination.articles.size).toBe(25)
    expect(isIngestReceipt(receipt)).toBe(true)
    expect(ingestReceiptChecksumMatches(receipt)).toBe(true)
    expect(receipt.canaryPmids).toEqual(pmids)

    // Every record is draft/unreviewed, set explicitly rather than left to a column default.
    for (const row of destination.articles.values()) {
      expect(row.visibility_state).toBe('draft')
      expect(row.relevance_state).toBe('unreviewed')
    }
  })

  it('binds the corpus it wrote to the receipt it returned', async () => {
    const { receipt, destination } = await runCanary(25)
    const { batches, sources, totalArticles } = observationsFrom(destination)

    const results = checkIngestReceiptBinding(
      observed(receipt),
      observed(batches),
      observed(totalArticles),
      observed(sources),
    )
    const byId = Object.fromEntries(results.map((result) => [result.id, result.outcome]))

    // The load-bearing one: the verifier can bind the engine's own output without any adaptation.
    expect(byId['V55-receipt-binds-operation']).toBe('pass')
    expect(byId['V58-receipt-matches-corpus']).toBe('pass')
    expect(byId['V59-receipt-pmids-present']).toBe('pass')
  })

  it('writes provenance for every record, under the batch the receipt names', async () => {
    const { receipt, destination } = await runCanary(25)
    const { sources } = observationsFrom(destination)
    expect(sources).toHaveLength(25)
    for (const row of sources) {
      expect(row.batch_id).toBe(receipt.importBatchId)
    }
  })
})

describe('the rehearsal reaches the real engine, not a stand-in', () => {
  it('fails the contract when the checkpoint disagrees with the execution inputs', async () => {
    // Proves these tests reach the engine's own guards: a projection checksum that does not match
    // the durable checkpoint is refused before anything is written.
    const { planned, mapper, rows } = await runCanary(25)
    const destination = new DisposableDestination()
    await expect(
      executeIngestion({
        mode: 'canary',
        sourceFactory: { open: () => fixtureSource(rows) },
        mapRecord: mapper,
        projection: { ...planned.projection, checksum: 'b'.repeat(64) },
        limits: LIMITS,
        canaryManifestChecksum: MANIFEST,
        canaryPmids: rows.map((row) => row.article.pmid),
        dryRun: false,
        destination,
        ledger: new MemoryLedger(planned.checkpoint),
      } as unknown as Parameters<typeof executeIngestion>[0]),
    ).rejects.toThrow(/durable checkpoint contract/u)
    expect(destination.articles.size).toBe(0)
  })
})
