/** @jest-environment node */

/**
 * Finalization must be one request, decided once, and ambiguity must never become completion.
 *
 * Two defects meet here, and they compound:
 *
 *   1. the finalization body read `completed_at` from the clock on *every* attempt, while the
 *      checkpoint kept the request checksum from the first — so on resume the engine sent a body
 *      that did not match the write-ahead record of what it had sent;
 *   2. a remote row with `status = 'completed'` and `completed_at = null` was classified
 *      `applied_exact`, so the resume made no finalization request at all and emitted a completed
 *      receipt for an operation nothing had confirmed.
 *
 * Every test drives the real engine and the real reconciler against a fake destination, so the
 * assertions are about behaviour rather than about the shape of a hand-written object.
 */

import { executeIngestion, planIngestion, type DestinationOperator } from './engine'
import { INGEST_WRITER_IDENTITY } from './constants'
import { reconcileCheckpoint, applyReconciliationReceipt } from './reconcile'
import { fixtureEnvelope, fixtureMapper, fixtureSource } from './test-fixtures'
import type { Checkpoint, SourceEnvelope } from './types'

const OPERATION_ID = '10000000-0000-4000-8000-000000000001'
const CREATED_AT = '2026-08-15T00:00:00.000Z'
const LIMITS = { recordBatchLimit: 10, byteBatchLimit: 100_000, concurrency: 1 }

class MemoryLedger {
  constructor(private checkpoint: Checkpoint) {}
  current() {
    return this.checkpoint
  }
  async update(mutator: (checkpoint: Checkpoint) => void) {
    mutator(this.checkpoint)
    return this.checkpoint
  }
}

/** Records every finalization request body it is handed, and can lose the acknowledgement. */
class RecordingDestination implements DestinationOperator {
  readonly articles = new Map<string, unknown>()
  readonly provenance = new Map<string, unknown>()
  readonly importBatches = new Map<string, Record<string, unknown>>()
  readonly finalizationBodies: Record<string, unknown>[] = []
  finalizationFailure: 'none' | 'ambiguous_after_commit' | 'ambiguous_before_commit' = 'none'

  async countArticles() {
    return this.articles.size
  }
  async findCompletedImportBatch() {
    return null
  }
  async observeArticles() {
    return []
  }
  async createImportBatch(row: { id: string }) {
    this.importBatches.set(row.id, { ...row })
  }
  async upsertJournals() {
    return undefined
  }
  async upsertArticles(rows: { pmid: string }[]) {
    for (const row of rows) this.articles.set(row.pmid, row)
  }
  async upsertArticleSources(rows: { pmid: string; batch_id: string }[]) {
    for (const row of rows) this.provenance.set(`${row.batch_id}:${row.pmid}`, row)
  }
  async completeImportBatch(id: string, patch: Record<string, unknown>) {
    this.finalizationBodies.push(patch)
    if (this.finalizationFailure === 'ambiguous_before_commit') {
      this.finalizationFailure = 'none'
      throw Object.assign(new Error('redacted ambiguous acknowledgement'), {
        outcome: 'ambiguous',
        code: 'socket_reset',
      })
    }
    this.importBatches.set(id, { ...(this.importBatches.get(id) ?? {}), ...patch })
    if (this.finalizationFailure === 'ambiguous_after_commit') {
      this.finalizationFailure = 'none'
      throw Object.assign(new Error('redacted ambiguous acknowledgement'), {
        outcome: 'ambiguous',
        code: 'socket_reset',
      })
    }
  }
}

function sourceFactory(rows: readonly SourceEnvelope[]) {
  return { open: () => fixtureSource(rows) }
}

async function setup(rows: readonly SourceEnvelope[]) {
  const mapper = fixtureMapper(OPERATION_ID, 'full')
  const planned = await planIngestion({
    mode: 'full',
    sourceFactory: sourceFactory(rows),
    mapRecord: mapper,
    limits: LIMITS,
    canaryManifestChecksum: null,
    operationId: OPERATION_ID,
    now: CREATED_AT,
  })
  return { mapper, planned, ledger: new MemoryLedger(planned.checkpoint) }
}

function run(
  rows: readonly SourceEnvelope[],
  context: Awaited<ReturnType<typeof setup>>,
  destination: RecordingDestination,
  now?: () => string,
) {
  return executeIngestion({
    mode: 'full',
    sourceFactory: sourceFactory(rows),
    mapRecord: context.mapper,
    projection: context.planned.projection,
    limits: LIMITS,
    canaryManifestChecksum: null,
    dryRun: false,
    destination,
    ledger: context.ledger,
    ...(now ? { now } : {}),
  })
}

/* --------------------------------------------------------------------------------------------- *
 * The stable envelope
 * --------------------------------------------------------------------------------------------- */

describe('the finalization request is generated once and reused verbatim', () => {
  it('persists the exact body and its checksum before sending it', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    await run(rows, context, destination)

    const envelope = context.ledger.current().finalizationEnvelope
    expect(envelope).not.toBeNull()
    // The persisted body reconstructs the sent request byte for byte.
    expect(JSON.parse(envelope!.body)).toEqual(destination.finalizationBodies[0])
    expect(envelope!.completedAt).toBe(destination.finalizationBodies[0].completed_at)
    expect(context.ledger.current().finalization.requestChecksum).toBe(envelope!.checksum)
  })

  it('reuses the stored timestamp on resume instead of reading the clock again', async () => {
    /*
     * The confirmed defect, reproduced directly: the acknowledgement is lost *after* the server
     * committed, the operator reconciles, and the resume must send the identical body. Before this
     * change the resume called `now()` again, producing a different `completed_at` and therefore a
     * different checksum from the one already written ahead.
     */
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_after_commit'

    let clock = 0
    const movingClock = () => `2026-08-15T00:0${clock++}:00.000Z`
    await expect(run(rows, context, destination, movingClock)).rejects.toThrow()

    const envelope = context.ledger.current().finalizationEnvelope
    expect(envelope).not.toBeNull()
    const firstCompletedAt = envelope!.completedAt

    // Reconcile read-only, then resume. The clock has moved on; the body must not.
    const reconciled = await reconcileFinalization(context, destination)
    expect(reconciled).toBe('applied_exact')

    await run(rows, context, destination, movingClock)
    expect(destination.finalizationBodies).toHaveLength(1)
    expect(context.ledger.current().finalizationEnvelope?.completedAt).toBe(firstCompletedAt)
  })

  it('stops as checkpoint drift when the rebuilt body no longer matches the stored one', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_before_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    // Something edited the durable counters between the intent and the retry. The body the engine
    // would now build is not the body it recorded, so it refuses rather than sending a second,
    // different finalization.
    await context.ledger.update((draft) => {
      draft.counters.recordsRead += 1
      draft.finalization.state = 'prepared'
      draft.phase = 'running'
    })
    await expect(run(rows, context, destination)).rejects.toThrow(
      /no longer matches the body recorded in the write-ahead checkpoint/u,
    )
    expect(destination.finalizationBodies).toHaveLength(1)
  })

  it('stops when the stage checksum disagrees with its persisted envelope', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_before_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    await context.ledger.update((draft) => {
      draft.finalization.requestChecksum = 'f'.repeat(64)
      draft.finalization.state = 'prepared'
      draft.phase = 'running'
    })
    await expect(run(rows, context, destination)).rejects.toThrow(/checkpoint drift/u)
  })
})

/* --------------------------------------------------------------------------------------------- *
 * Reconciliation of the finalization
 * --------------------------------------------------------------------------------------------- */

/** Reconcile the checkpoint read-only against the destination, and return the finalization verdict. */
async function reconcileFinalization(
  context: Awaited<ReturnType<typeof setup>>,
  destination: RecordingDestination,
  rowOverrides: Record<string, unknown> = {},
): Promise<string> {
  const transport = {
    projectRef: context.ledger.current().targetProjectRef,
    async getImportBatch(id: string) {
      const row = destination.importBatches.get(id)
      if (!row) return null
      return {
        created_by: INGEST_WRITER_IDENTITY,
        started_at: CREATED_AT,
        ...row,
        ...rowOverrides,
      } as never
    },
    async readRows<T extends object>(): Promise<T[]> {
      return []
    },
  }
  const receipt = await reconcileCheckpoint({
    checkpoint: context.ledger.current(),
    sourceFactory: { open: () => fixtureSource([]) },
    mapRecord: context.mapper,
    transport,
    now: () => CREATED_AT,
  })
  const finalization = receipt.observations.find(
    (observation) => observation.subject === 'finalization',
  )
  if (finalization?.classification === 'applied_exact') {
    await applyReconciliationReceipt(
      {
        current: () => context.ledger.current(),
        update: (mutator: (draft: Checkpoint) => void) => context.ledger.update(mutator),
      } as never,
      receipt,
    )
  }
  return finalization?.classification ?? 'none'
}

describe('an inconsistent remote state is never a completion', () => {
  it('classifies completed-with-null-completed_at as ambiguous, not applied_exact', async () => {
    /*
     * The exact confirmed defect. Every counter matches, the status says completed, and the row
     * carries no completion timestamp — which used to satisfy `applied_exact` because
     * `completed_at` was simply not read.
     */
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_after_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    const verdict = await reconcileFinalization(context, destination, { completed_at: null })
    expect(verdict).toBe('ambiguous_inconsistent')
  })

  it('classifies completed-with-malformed-completed_at as ambiguous', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_after_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    const verdict = await reconcileFinalization(context, destination, { completed_at: 'soon' })
    expect(verdict).toBe('ambiguous_inconsistent')
  })

  it('refuses to advance the checkpoint on an ambiguous observation', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_after_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    const transport = {
      projectRef: context.ledger.current().targetProjectRef,
      async getImportBatch(id: string) {
        const row = destination.importBatches.get(id)
        return row
          ? ({
              created_by: INGEST_WRITER_IDENTITY,
              started_at: CREATED_AT,
              ...row,
              completed_at: null,
            } as never)
          : null
      },
      async readRows<T extends object>(): Promise<T[]> {
        return []
      },
    }
    const receipt = await reconcileCheckpoint({
      checkpoint: context.ledger.current(),
      sourceFactory: { open: () => fixtureSource([]) },
      mapRecord: context.mapper,
      transport,
      now: () => CREATED_AT,
    })
    await expect(
      applyReconciliationReceipt(
        {
          current: () => context.ledger.current(),
          update: (mutator: (draft: Checkpoint) => void) => context.ledger.update(mutator),
        } as never,
        receipt,
      ),
    ).rejects.toThrow(/ambiguous or self-contradictory remote state/u)

    // The stage stays unresolved, so the next mutating run refuses too.
    expect(context.ledger.current().finalization.state).toBe('ambiguous')
    await expect(run(rows, context, destination)).rejects.toThrow(
      /Read-only reconciliation is required/u,
    )
    expect(destination.finalizationBodies).toHaveLength(1)
  })

  it('refuses a completed batch written by an unreviewed identity', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_after_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    const verdict = await reconcileFinalization(context, destination, { created_by: 'psql' })
    expect(verdict).toBe('partial_or_conflicting')
  })

  it('refuses a completed batch whose report drifted from the persisted request', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_after_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    const verdict = await reconcileFinalization(context, destination, {
      report: { operation_id: 'somebody-else' },
    })
    expect(verdict).toBe('partial_or_conflicting')
  })

  it('treats a lost acknowledgement before commit as an unapplied finalization', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_before_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    // The row exists (created earlier) but was never finalized, so the safe continuation is to
    // resume and send the request — the identical one that was written ahead.
    const verdict = await reconcileFinalization(context, destination)
    expect(verdict).toBe('absent_exact')
  })

  it('produces no completed receipt from an ambiguous state', async () => {
    const rows = [fixtureEnvelope('10001')]
    const context = await setup(rows)
    const destination = new RecordingDestination()
    destination.finalizationFailure = 'ambiguous_after_commit'
    await expect(run(rows, context, destination)).rejects.toThrow()

    expect(context.ledger.current().phase).toBe('needs_reconciliation')
    expect(context.ledger.current().finalization.state).toBe('ambiguous')
    // No second mutation is attempted until read-only reconciliation resolves the state.
    await expect(run(rows, context, destination)).rejects.toThrow(
      /Read-only reconciliation is required/u,
    )
  })
})
