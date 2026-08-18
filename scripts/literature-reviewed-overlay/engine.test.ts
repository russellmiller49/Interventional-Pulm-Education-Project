/** @jest-environment node */

import { mkdtempSync, rmSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  overlayCheckpointChecksum,
  readOverlayCheckpoint,
  readOverlayReceipt,
  writeOverlayCheckpoint,
  type OverlayCheckpoint,
} from './checkpoint'
import {
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_ARTIFACT_SHA256_ENV_NAME,
  OVERLAY_CHECKPOINT_SCHEMA_VERSION,
  OVERLAY_CURATION_REASON,
  OVERLAY_ENGINE_VERSION,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_OWNER_AUTHORIZATION_ENV_NAME,
  OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
  OVERLAY_PROJECTION_SHA256_ENV_NAME,
  OVERLAY_RECONCILIATION_SCHEMA_VERSION,
  OVERLAY_SOURCE_IDENTITY,
  OVERLAY_WRITER_IDENTITY,
  type OverlayRequestMode,
} from './constants'
import {
  applyReconciliationWithReobservation,
  assertReconciliationReceiptConsistent,
  expectedArticleState,
  expectedEventPayloads,
  runApply,
  runDryRun,
  runReconcile,
  runValidate,
  runVerify,
  validateOverlayReconciliationReceipt,
  type OverlayEngineDependencies,
  type OverlayOperationScope,
} from './engine'
import { buildOverlayPlan, checkpointBatchesForPlan } from './plan'
import { collectCohort } from './projection'
import { buildFixtureTruth } from './rehearsal-fixtures'
import { buildReviewedSet, reviewedRecordEventId, type ReviewedSet } from './reviewed-set'
import {
  OverlayMutationAmbiguousError,
  OverlayMutationConfirmedFailureError,
  type OverlayTransport,
} from './transport'

const truth = buildFixtureTruth()
const fixtureSet: ReviewedSet = buildReviewedSet(
  collectCohort(truth.cohortPayloads),
  truth.artifact,
)
const recordsByPmid = new Map(fixtureSet.records.map((record) => [record.pmid, record]))

const REVIEWED_AT = '2026-08-17T00:00:00.000Z'

/**
 * A faithful in-memory destination: it simulates real application, so the observation surface
 * reports what actually happened rather than what the acknowledgement claimed. It enforces the
 * proposal's causal-mode gate and echoes the causal mode, and it can lose exactly one
 * acknowledgement AFTER applying (the lost-acknowledgement counterexample), fabricate
 * acknowledgements without storing anything (`mutateSilently`), or carry operation-scope drift
 * (an extra event or article under the operation) that per-batch reads cannot see.
 */
class ScriptedTransport implements OverlayTransport {
  corpus = new Set(fixtureSet.records.map((record) => record.pmid))
  corpusTotal: number = OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT
  foreignReviewed = 0
  schemaPresent = true
  operationRow: Record<string, unknown> | null = null
  appliedArticles = new Map<string, Record<string, unknown>>()
  appliedEvents = new Map<string, Record<string, unknown>>()
  applyCalls = 0
  observeCalls = 0
  failCall: { index: number; error: Error } | null = null
  mangleAckAtCall: number | null = null
  /** Apply the batch, then lose its acknowledgement — exactly once. */
  loseAckAtCall: number | null = null
  /** Return plausible acknowledgements without storing anything. */
  mutateSilently = false
  /** Operation-scope drift no per-batch read can see. */
  extraEventsForOperation = 0
  extraReviewedForOperation = 0

  seedCompletedOperation(): void {
    this.operationRow = {
      id: fixtureSet.operationId,
      writer_identity: OVERLAY_WRITER_IDENTITY,
      artifact_sha256: fixtureSet.artifactSha256,
      source_identity: OVERLAY_SOURCE_IDENTITY,
      curation_reason: OVERLAY_CURATION_REASON,
      reviewed_at: REVIEWED_AT,
      record_count: fixtureSet.counts.recordCount,
      include_core_count: fixtureSet.counts.classCounts.include_core,
      include_adjacent_count: fixtureSet.counts.classCounts.include_adjacent,
      exclude_count: fixtureSet.counts.classCounts.exclude,
      physician_confirmed_count: fixtureSet.counts.provenanceCounts.physician_confirmed,
      physician_modified_count: fixtureSet.counts.provenanceCounts.physician_modified,
      qc_accepted_count: fixtureSet.counts.provenanceCounts.qc_accepted,
      status: 'completed',
      started_at: REVIEWED_AT,
      completed_at: REVIEWED_AT,
    }
    for (const record of fixtureSet.records) {
      const article = expectedArticleState(fixtureSet, record, REVIEWED_AT)
      this.appliedArticles.set(record.pmid, {
        pmid: record.pmid,
        ...article,
        classifier_version_is_null: true,
        classifier_payload_is_null: true,
      })
      const eventId = reviewedRecordEventId(fixtureSet, record)
      const payloads = expectedEventPayloads(fixtureSet, record)
      this.appliedEvents.set(eventId, {
        id: eventId,
        pmid: record.pmid,
        event_type: 'relevance_changed',
        actor_user_id: null,
        actor_email: OVERLAY_WRITER_IDENTITY,
        reason: OVERLAY_CURATION_REASON,
        before_value: payloads.before,
        after_value: payloads.after,
      })
    }
  }

  async applyBatch(requestBody: string): Promise<unknown> {
    const call = this.applyCalls
    this.applyCalls += 1
    if (this.failCall && this.failCall.index === call) throw this.failCall.error
    const request = JSON.parse(requestBody) as {
      p_operation: Record<string, unknown>
      p_records: Array<Record<string, unknown>>
    }
    const operation = request.p_operation
    if (this.mangleAckAtCall === call) {
      return { operationId: operation.operationId, recordCount: -1 }
    }

    // The proposal's transactional causal-mode gate.
    const operationCompleted = this.operationRow?.status === 'completed'
    if (operation.causalMode === 'fresh' && operationCompleted) {
      throw new OverlayMutationConfirmedFailureError(
        'overlay fresh-mode request targets a completed operation',
      )
    }
    if (operation.causalMode === 'replay' && !operationCompleted) {
      throw new OverlayMutationConfirmedFailureError(
        'overlay replay-mode request targets an operation that is not completed',
      )
    }

    let applied = 0
    let alreadyApplied = 0
    const dispositions: string[] = []
    for (const raw of request.p_records) {
      const pmid = String(raw.pmid)
      if (this.appliedArticles.has(pmid)) {
        alreadyApplied += 1
        dispositions.push('already_applied')
        continue
      }
      applied += 1
      dispositions.push('applied')
      if (this.mutateSilently) continue
      const record = recordsByPmid.get(pmid)
      if (!record) continue
      const article = expectedArticleState(fixtureSet, record, String(operation.reviewedAt))
      this.appliedArticles.set(pmid, {
        pmid,
        ...article,
        classifier_version_is_null: true,
        classifier_payload_is_null: true,
      })
      const eventId = String(raw.eventId)
      const payloads = expectedEventPayloads(fixtureSet, record)
      this.appliedEvents.set(eventId, {
        id: eventId,
        pmid,
        event_type: 'relevance_changed',
        actor_user_id: null,
        actor_email: String(operation.writerIdentity),
        reason: String(operation.curationReason),
        before_value: payloads.before,
        after_value: payloads.after,
      })
    }

    if (!this.mutateSilently && this.operationRow === null) {
      this.operationRow = {
        id: operation.operationId,
        writer_identity: operation.writerIdentity,
        artifact_sha256: operation.artifactSha256,
        source_identity: operation.sourceIdentity,
        curation_reason: operation.curationReason,
        reviewed_at: operation.reviewedAt,
        record_count: operation.recordCount,
        include_core_count: operation.includeCoreCount,
        include_adjacent_count: operation.includeAdjacentCount,
        exclude_count: operation.excludeCount,
        physician_confirmed_count: operation.physicianConfirmedCount,
        physician_modified_count: operation.physicianModifiedCount,
        qc_accepted_count: operation.qcAcceptedCount,
        status: 'started',
        started_at: REVIEWED_AT,
        completed_at: null,
      }
    }
    const finalBatch = operation.finalBatch === true
    if (!this.mutateSilently && finalBatch && this.operationRow) {
      this.operationRow.status = 'completed'
      this.operationRow.completed_at = REVIEWED_AT
    }
    const status = this.mutateSilently
      ? finalBatch
        ? 'completed'
        : 'started'
      : finalBatch
        ? 'completed'
        : String(this.operationRow?.status ?? 'started')
    const acknowledgement = {
      operationId: operation.operationId,
      recordCount: request.p_records.length,
      causalMode: operation.causalMode,
      applied,
      alreadyApplied,
      dispositions,
      operationStatus: status,
    }
    if (this.loseAckAtCall === call) {
      throw new OverlayMutationAmbiguousError(
        'request_timeout',
        'The scripted destination deliberately lost this acknowledgement.',
      )
    }
    return acknowledgement
  }

  async observe(requestBody: string): Promise<unknown> {
    this.observeCalls += 1
    if (!this.schemaPresent) throw new Error('function does not exist')
    const request = JSON.parse(requestBody) as {
      operationId: string
      pmids: string[]
      eventIds: string[]
    }
    let includeCore = 0
    let includeAdjacent = 0
    let exclude = 0
    let confirmed = 0
    let modified = 0
    let qc = 0
    for (const article of this.appliedArticles.values()) {
      const relevance = article.reviewed_relevance
      if (relevance === 'include_core') includeCore += 1
      else if (relevance === 'include_adjacent') includeAdjacent += 1
      else exclude += 1
      const provenance = article.reviewed_enrichment_provenance
      if (provenance === 'physician_confirmed') confirmed += 1
      else if (provenance === 'physician_modified') modified += 1
      else qc += 1
    }
    const articles = request.pmids
      .filter((pmid) => this.corpus.has(pmid))
      .map(
        (pmid) =>
          this.appliedArticles.get(pmid) ?? {
            pmid,
            relevance_state: 'unreviewed',
            visibility_state: 'draft',
            manual_override: false,
            is_landmark: false,
            curation_reason: null,
            classifier_version_is_null: true,
            classifier_payload_is_null: true,
            reviewed_relevance: null,
            reviewed_enrichment_provenance: null,
            reviewed_source_identity: null,
            reviewed_at: null,
            reviewed_operation_id: null,
          },
      )
    const events = request.eventIds
      .map((id) => this.appliedEvents.get(id))
      .filter((event): event is Record<string, unknown> => event !== undefined)
    return {
      operation: this.operationRow,
      totals: {
        corpusArticles: this.corpusTotal,
        reviewedForOperation: this.appliedArticles.size + this.extraReviewedForOperation,
        includeCore,
        includeAdjacent,
        exclude,
        physicianConfirmed: confirmed,
        physicianModified: modified,
        qcAccepted: qc,
        eventsForOperation: this.appliedEvents.size + this.extraEventsForOperation,
        foreignReviewed: this.foreignReviewed,
      },
      articles,
      events,
    }
  }
}

function dependencies(
  transport: OverlayTransport,
  environmentOverrides: Record<string, string | undefined> = {},
  onCreateTransport?: () => void,
): OverlayEngineDependencies {
  return {
    environment: {
      [OVERLAY_ARTIFACT_SHA256_ENV_NAME]: OVERLAY_ARTIFACT_SHA256,
      [OVERLAY_PROJECTION_SHA256_ENV_NAME]: fixtureSet.projectionDigest,
      [OVERLAY_OWNER_AUTHORIZATION_ENV_NAME]: OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
      ...environmentOverrides,
    },
    readCohortPayloads: () => Promise.resolve(buildFixtureTruth().cohortPayloads),
    loadArtifact: () => buildFixtureTruth().artifact,
    createTransport: () => {
      onCreateTransport?.()
      return transport
    },
    now: () => new Date(REVIEWED_AT),
  }
}

describe('validate and dry-run', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'overlay-engine-test-'))
  })
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('validates without ever constructing a transport', async () => {
    let constructed = 0
    const result = await runValidate(
      dependencies(new ScriptedTransport(), {}, () => {
        constructed += 1
      }),
    )
    expect(result.status).toBe('validated')
    expect(result.environmentPins.projectionPinMatches).toBe(true)
    expect(constructed).toBe(0)
  })

  it('stops when the owner projection pin disagrees', async () => {
    await expect(
      runValidate(
        dependencies(new ScriptedTransport(), {
          [OVERLAY_PROJECTION_SHA256_ENV_NAME]: sha256('something else'),
        }),
      ),
    ).rejects.toThrow(/projection pin does not match/u)
  })

  it('writes an immutable fresh-mode dry-run receipt without destination requests', async () => {
    let constructed = 0
    const result = await runDryRun(
      dependencies(new ScriptedTransport(), {}, () => {
        constructed += 1
      }),
      { stateDirectory: directory, recordBatchLimit: 90 },
    )
    expect(result.plan.batchCount).toBe(7)
    expect(constructed).toBe(0)
    const receipt = await readOverlayReceipt(result.receiptPath)
    expect(receipt.outcome).toBe('dry-run')
    expect(receipt.causalMode).toBe('fresh')
    await expect(
      runDryRun(dependencies(new ScriptedTransport()), {
        stateDirectory: directory,
        recordBatchLimit: 90,
      }),
    ).rejects.toThrow(/already exists/u)
  })
})

describe('apply gates and preconditions', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'overlay-apply-test-'))
  })
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  const baseOptions = () => ({
    stateDirectory: directory,
    recordBatchLimit: 90,
    resume: false,
    confirmProductionWrite: true,
  })

  const checkpointPathFor = () =>
    join(directory, `overlay-${fixtureSet.operationId}.checkpoint.json`)

  it('refuses without the confirmation flag before any transport exists', async () => {
    let constructed = 0
    await expect(
      runApply(
        dependencies(new ScriptedTransport(), {}, () => {
          constructed += 1
        }),
        { ...baseOptions(), confirmProductionWrite: false },
      ),
    ).rejects.toThrow(/--confirm-production-write/u)
    expect(constructed).toBe(0)
  })

  it.each([
    [OVERLAY_ARTIFACT_SHA256_ENV_NAME, 'artifact pin'],
    [OVERLAY_PROJECTION_SHA256_ENV_NAME, 'projection pin'],
    [OVERLAY_OWNER_AUTHORIZATION_ENV_NAME, 'authorization sentence'],
  ])('refuses when %s is absent', async (name, description) => {
    let constructed = 0
    await expect(
      runApply(
        dependencies(new ScriptedTransport(), { [name]: undefined }, () => {
          constructed += 1
        }),
        baseOptions(),
      ),
    ).rejects.toThrow(new RegExp(`${description}.*required`, 'u'))
    expect(constructed).toBe(0)
  })

  it('refuses a near-miss owner authorization sentence', async () => {
    await expect(
      runApply(
        dependencies(new ScriptedTransport(), {
          [OVERLAY_OWNER_AUTHORIZATION_ENV_NAME]:
            OVERLAY_OWNER_AUTHORIZATION_SENTENCE.toLowerCase(),
        }),
        baseOptions(),
      ),
    ).rejects.toThrow(/does not match/u)
  })

  it('fails closed when the overlay schema is absent', async () => {
    const transport = new ScriptedTransport()
    transport.schemaPresent = false
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /reviewed-overlay schema is not present/u,
    )
    expect(transport.observeCalls).toBe(1)
    expect(transport.applyCalls).toBe(0)
  })

  it('refuses a corpus whose total is not exactly the fixed corpus', async () => {
    const transport = new ScriptedTransport()
    transport.corpusTotal = OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT - 1
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /exactly 132350 are expected/u,
    )
  })

  it('refuses when any reviewed PMID is absent from the corpus', async () => {
    const transport = new ScriptedTransport()
    transport.corpus.delete([...transport.corpus][0] as string)
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /absent from the destination corpus/u,
    )
  })

  it('refuses when a foreign operation already reviewed any article', async () => {
    const transport = new ScriptedTransport()
    transport.foreignReviewed = 3
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /reviewed state from a different operation/u,
    )
  })

  it('refuses a registered operation with different identity content', async () => {
    const transport = new ScriptedTransport()
    transport.seedCompletedOperation()
    ;(transport.operationRow as Record<string, unknown>).curation_reason = 'someone else wrote this'
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /different identity content/u,
    )
  })

  it('records an ambiguous stage and stops on a mangled acknowledgement', async () => {
    const transport = new ScriptedTransport()
    transport.mangleAckAtCall = 1
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      OverlayMutationAmbiguousError,
    )
    const checkpoint = await readOverlayCheckpoint(checkpointPathFor())
    expect(checkpoint.phase).toBe('needs_reconciliation')
    expect(checkpoint.batches[0]?.stage.state).toBe('acknowledged')
    expect(checkpoint.batches[0]?.effects).toEqual({ applied: 90, alreadyApplied: 0 })
    expect(checkpoint.batches[1]?.stage.state).toBe('ambiguous')
    expect(checkpoint.batches[1]?.stage.submittedAt).not.toBeNull()
    expect(checkpoint.batches[1]?.stage.failureCode).toBe('acknowledgement_record_count_mismatch')
    expect(checkpoint.batches[2]?.stage.state).toBe('prepared')
  })

  it('records a confirmed failure distinctly and leaves later batches untouched', async () => {
    const transport = new ScriptedTransport()
    transport.failCall = {
      index: 2,
      error: new OverlayMutationConfirmedFailureError('destination rejected'),
    }
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /destination rejected/u,
    )
    const checkpoint = await readOverlayCheckpoint(checkpointPathFor())
    expect(checkpoint.phase).toBe('confirmed_failure')
    expect(checkpoint.batches[2]?.stage.state).toBe('confirmed_failure')
    expect(checkpoint.batches[2]?.stage.failureCode).toBe('postgrest_rejected')
    expect(checkpoint.batches[3]?.stage.state).toBe('prepared')
  })

  it('completes a clean apply only after the read-only post-observation', async () => {
    const transport = new ScriptedTransport()
    const result = await runApply(dependencies(transport), baseOptions())
    expect(result.status).toBe('applied')
    expect(result.counters).toEqual({ applied: 630, alreadyApplied: 0 })
    expect(result.batchCount).toBe(7)
    expect(result.postObservationChecksum).toMatch(/^[a-f0-9]{64}$/u)
    const checkpoint = await readOverlayCheckpoint(result.checkpointPath)
    expect(checkpoint.phase).toBe('completed')
    expect(checkpoint.postObservationChecksum).toBe(result.postObservationChecksum)
    expect(checkpoint.curationReason).toBe(OVERLAY_CURATION_REASON)
    expect(checkpoint.batches.every((batch) => batch.requestMode === 'fresh')).toBe(true)
    const receipt = await readOverlayReceipt(result.receiptPath)
    expect(receipt.outcome).toBe('completed')
    expect(receipt.causalMode).toBe('fresh')
  })

  it('refuses completion when acknowledgements are plausible but nothing was stored', async () => {
    const transport = new ScriptedTransport()
    transport.mutateSilently = true
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /operation row is absent|actual destination totals|not exactly applied/u,
    )
    // Every batch acknowledged, yet the checkpoint must not claim completion and no
    // completion receipt may exist.
    const checkpoint = await readOverlayCheckpoint(checkpointPathFor())
    expect(checkpoint.phase).not.toBe('completed')
    expect(checkpoint.postObservationChecksum).toBeNull()
    const receipt = await stat(
      join(directory, `overlay-${fixtureSet.operationId}.receipt.json`),
    ).catch(() => null)
    expect(receipt).toBeNull()
  })

  it('replays a completed operation idempotently under the replay acknowledgement contract', async () => {
    const transport = new ScriptedTransport()
    transport.seedCompletedOperation()
    const result = await runApply(dependencies(transport), baseOptions())
    expect(result.status).toBe('idempotent-replay')
    expect(result.counters).toEqual({ applied: 0, alreadyApplied: 630 })
    const checkpoint = await readOverlayCheckpoint(result.checkpointPath)
    expect(checkpoint.batches.every((batch) => batch.requestMode === 'replay')).toBe(true)
    const receipt = await readOverlayReceipt(result.receiptPath)
    expect(receipt.outcome).toBe('idempotent-replay')
    expect(receipt.causalMode).toBe('replay')
  })

  it('treats a fabricated fresh application inside a replay as ambiguous', async () => {
    const transport = new ScriptedTransport()
    transport.seedCompletedOperation()
    // Remove one stored article: the adversarial fake will report it as freshly applied,
    // which the replay acknowledgement contract must refuse.
    const victim = fixtureSet.records[0]?.pmid as string
    transport.appliedArticles.delete(victim)
    transport.appliedEvents.delete(reviewedRecordEventId(fixtureSet, fixtureSet.records[0]!))
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      OverlayMutationAmbiguousError,
    )
    const checkpoint = await readOverlayCheckpoint(checkpointPathFor())
    expect(checkpoint.batches[0]?.stage.failureCode).toBe(
      'acknowledgement_replay_applied_fresh_records',
    )
  })
})

describe('fresh/replay causality across lost acknowledgements', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'overlay-causality-test-'))
  })
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  const options = () => ({
    stateDirectory: directory,
    recordBatchLimit: 250, // batches of 250 / 250 / 130 — the review's reproduction shape
    resume: false,
    confirmProductionWrite: true,
  })
  const checkpointPathFor = () =>
    join(directory, `overlay-${fixtureSet.operationId}.checkpoint.json`)

  async function resumeWithReceipt(
    transport: ScriptedTransport,
    receipt: unknown,
  ): Promise<Awaited<ReturnType<typeof runApply>>> {
    return runApply(dependencies(transport), {
      ...options(),
      resume: true,
      checkpointPath: checkpointPathFor(),
      reconciliationPath: 'in-memory',
      readReconciliation: () => Promise.resolve(JSON.parse(JSON.stringify(receipt)) as unknown),
      confirmProductionWrite: true,
    })
  }

  it('keeps a lost FINAL fresh acknowledgement causally fresh: 630 applied, 0 already', async () => {
    const transport = new ScriptedTransport()
    transport.loseAckAtCall = 2 // the final 130-record batch applies, completing the
    // operation remotely, and only its acknowledgement is lost
    await expect(runApply(dependencies(transport), options())).rejects.toThrow(
      /deliberately lost this acknowledgement/u,
    )
    expect(transport.operationRow?.status).toBe('completed')
    expect(transport.appliedEvents.size).toBe(630)

    const reconciled = await runReconcile(dependencies(transport), {
      checkpointPath: checkpointPathFor(),
    })
    expect(reconciled.unresolvedBatchCount).toBe(1)
    const evidence = reconciled.receipt.batches[0]!
    // The batch's durable causal mode survives the registry's completed status.
    expect(evidence).toMatchObject({
      index: 2,
      requestMode: 'fresh',
      expectedRecordCount: 130,
      classification: 'applied_exact',
    })
    expect(reconciled.receipt.operationScope).toMatchObject({
      reviewedForOperation: 630,
      eventsForOperation: 630,
    })

    const applyCallsBeforeResume = transport.applyCalls
    const result = await resumeWithReceipt(transport, reconciled.receipt)
    expect(result.status).toBe('applied')
    expect(result.counters).toEqual({ applied: 630, alreadyApplied: 0 })
    // No second mutation: the reconciled batch was never resubmitted.
    expect(transport.applyCalls).toBe(applyCallsBeforeResume)
    expect(transport.appliedEvents.size).toBe(630)
    const checkpoint = await readOverlayCheckpoint(checkpointPathFor())
    expect(checkpoint.batches[2]?.effects).toEqual({ applied: 130, alreadyApplied: 0 })
    expect(checkpoint.batches[2]?.reconciliationChecksum).toMatch(/^[a-f0-9]{64}$/u)
    const receipt = await readOverlayReceipt(result.receiptPath)
    expect(receipt.outcome).toBe('completed')
    expect(receipt.causalMode).toBe('fresh')
    expect(receipt.counters).toEqual({ applied: 630, alreadyApplied: 0 })
  })

  it('keeps a lost NON-final fresh acknowledgement fresh and resumes the tail', async () => {
    const transport = new ScriptedTransport()
    transport.loseAckAtCall = 1
    await expect(runApply(dependencies(transport), options())).rejects.toThrow(
      /deliberately lost this acknowledgement/u,
    )
    expect(transport.operationRow?.status).toBe('started')
    expect(transport.appliedEvents.size).toBe(500)

    const reconciled = await runReconcile(dependencies(transport), {
      checkpointPath: checkpointPathFor(),
    })
    expect(reconciled.receipt.batches[0]).toMatchObject({
      index: 1,
      requestMode: 'fresh',
      classification: 'applied_exact',
    })

    const result = await resumeWithReceipt(transport, reconciled.receipt)
    expect(result.counters).toEqual({ applied: 630, alreadyApplied: 0 })
    expect(transport.appliedEvents.size).toBe(630)
    expect(transport.operationRow?.status).toBe('completed')
  })

  it('keeps a genuine replay causally replay across a lost acknowledgement', async () => {
    const transport = new ScriptedTransport()
    transport.seedCompletedOperation()
    transport.loseAckAtCall = 0
    await expect(runApply(dependencies(transport), options())).rejects.toThrow(
      /deliberately lost this acknowledgement/u,
    )
    expect(transport.appliedEvents.size).toBe(630) // nothing was mutated

    const reconciled = await runReconcile(dependencies(transport), {
      checkpointPath: checkpointPathFor(),
    })
    expect(reconciled.receipt.batches[0]).toMatchObject({
      index: 0,
      requestMode: 'replay',
      classification: 'applied_exact',
    })

    const result = await resumeWithReceipt(transport, reconciled.receipt)
    expect(result.status).toBe('idempotent-replay')
    // Replay counters remain replay counters; no fresh effect is fabricated.
    expect(result.counters).toEqual({ applied: 0, alreadyApplied: 630 })
    expect(transport.appliedEvents.size).toBe(630)
    const receipt = await readOverlayReceipt(result.receiptPath)
    expect(receipt.outcome).toBe('idempotent-replay')
    expect(receipt.causalMode).toBe('replay')
  })

  it('refuses a stale receipt claiming the opposite causal mode', async () => {
    const transport = new ScriptedTransport()
    transport.loseAckAtCall = 2
    await expect(runApply(dependencies(transport), options())).rejects.toThrow(
      OverlayMutationAmbiguousError,
    )
    const reconciled = await runReconcile(dependencies(transport), {
      checkpointPath: checkpointPathFor(),
    })
    const forged = JSON.parse(JSON.stringify(reconciled.receipt)) as {
      batches: Array<{ requestMode: string }>
      receiptChecksum?: string
    }
    forged.batches[0]!.requestMode = 'replay'
    delete forged.receiptChecksum
    const resealed = { ...forged, receiptChecksum: sha256(canonicalJson(forged)) }
    await expect(resumeWithReceipt(transport, resealed)).rejects.toThrow(
      /contradicts the request causal mode the checkpoint durably recorded/u,
    )
    // And the effects were never folded: the checkpoint still awaits reconciliation.
    const checkpoint = await readOverlayCheckpoint(checkpointPathFor())
    expect(checkpoint.batches[2]?.stage.state).toBe('ambiguous')
    expect(checkpoint.counters).toEqual({ applied: 500, alreadyApplied: 0 })
  })

  it('halts when the remote completed outside this operation history after send', async () => {
    // The operator submits batch 0 and loses the acknowledgement; meanwhile the whole
    // operation appears completed remotely (a history this checkpoint cannot account for:
    // only batch 0 was ever submitted). The reconciliation must refuse to call anything
    // exact — the per-record reads look applied, but the operation scope is unaccountable.
    const transport = new ScriptedTransport()
    transport.loseAckAtCall = 0
    await expect(runApply(dependencies(transport), options())).rejects.toThrow(
      OverlayMutationAmbiguousError,
    )
    // Simulate the external completion of everything else.
    transport.seedCompletedOperation()

    const reconciled = await runReconcile(dependencies(transport), {
      checkpointPath: checkpointPathFor(),
    })
    const evidence = reconciled.receipt.batches[0]!
    expect(evidence.requestMode).toBe('fresh') // the recorded mode is never rewritten
    expect(evidence.classification).toBe('drifted') // never applied_exact
    await expect(resumeWithReceipt(transport, reconciled.receipt)).rejects.toThrow(
      /conflicts with the overlay expectation/u,
    )
  })
})

describe('verify', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'overlay-verify-test-'))
  })
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  async function completedWorld(): Promise<{
    transport: ScriptedTransport
    checkpointPath: string
    postObservationChecksum: string
  }> {
    const transport = new ScriptedTransport()
    const result = await runApply(dependencies(transport), {
      stateDirectory: directory,
      recordBatchLimit: 90,
      resume: false,
      confirmProductionWrite: true,
    })
    return {
      transport,
      checkpointPath: result.checkpointPath,
      postObservationChecksum: result.postObservationChecksum,
    }
  }

  it('verifies a completed operation against the completion binding', async () => {
    const world = await completedWorld()
    const verified = await runVerify(dependencies(world.transport), {
      checkpointPath: world.checkpointPath,
    })
    expect(verified.status).toBe('verified')
    expect(verified.causalMode).toBe('fresh')
    expect(verified.postObservationChecksum).toBe(world.postObservationChecksum)
    expect(verified.remote.totals).toMatchObject({
      reviewedForOperation: 630,
      includeCore: 283,
      includeAdjacent: 75,
      exclude: 272,
      physicianConfirmed: 192,
      physicianModified: 133,
      qcAccepted: 305,
      eventsForOperation: 630,
      foreignReviewed: 0,
    })
    expect(verified.remote.registry).toMatchObject({
      curationReason: OVERLAY_CURATION_REASON,
      status: 'completed',
    })
  })

  it('fails when registry totals were altered after completion', async () => {
    const world = await completedWorld()
    ;(world.transport.operationRow as Record<string, unknown>).physician_confirmed_count = 193
    ;(world.transport.operationRow as Record<string, unknown>).physician_modified_count = 132
    await expect(
      runVerify(dependencies(world.transport), { checkpointPath: world.checkpointPath }),
    ).rejects.toThrow(/different identity content/u)
  })

  it('fails when the registry completed_at was altered after completion', async () => {
    const world = await completedWorld()
    ;(world.transport.operationRow as Record<string, unknown>).completed_at =
      '2026-08-18T00:00:00.000Z'
    await expect(
      runVerify(dependencies(world.transport), { checkpointPath: world.checkpointPath }),
    ).rejects.toThrow(/does not match the completion binding/u)
  })

  it('fails when an article drifted after completion', async () => {
    const world = await completedWorld()
    const victim = fixtureSet.records[3]?.pmid as string
    const article = world.transport.appliedArticles.get(victim) as Record<string, unknown>
    article.curation_reason = 'tampered'
    await expect(
      runVerify(dependencies(world.transport), { checkpointPath: world.checkpointPath }),
    ).rejects.toThrow(/not exactly applied/u)
  })

  it('fails when an extra event exists under the operation after completion', async () => {
    const world = await completedWorld()
    world.transport.extraEventsForOperation = 1
    await expect(
      runVerify(dependencies(world.transport), { checkpointPath: world.checkpointPath }),
    ).rejects.toThrow(/event count does not match/u)
  })
})

describe('strict reconciliation receipts', () => {
  const CREATED_AT = REVIEWED_AT

  function lostFinalAckCheckpoint(mode: OverlayRequestMode = 'fresh'): OverlayCheckpoint {
    const plan = buildOverlayPlan(fixtureSet, REVIEWED_AT, 250, mode)
    const checkpoint: OverlayCheckpoint = {
      schemaVersion: OVERLAY_CHECKPOINT_SCHEMA_VERSION,
      engineVersion: OVERLAY_ENGINE_VERSION,
      operationId: fixtureSet.operationId,
      targetProjectRef: 'itcttmkxdxvwmwcmzmey',
      createdAt: CREATED_AT,
      // Equal to every fixed-clock stage moment: the observation-chronology rule accepts
      // equality, and receipts produced under the frozen test clock stay valid.
      updatedAt: CREATED_AT,
      artifactSha256: fixtureSet.artifactSha256,
      projectionDigest: fixtureSet.projectionDigest,
      reviewedAt: REVIEWED_AT,
      curationReason: OVERLAY_CURATION_REASON,
      counts: fixtureSet.counts,
      limits: { recordBatchLimit: 250 },
      batches: checkpointBatchesForPlan(fixtureSet, plan),
      phase: 'needs_reconciliation',
      counters: { applied: 0, alreadyApplied: 0 },
      postObservationChecksum: null,
    }
    for (const index of [0, 1]) {
      const batch = checkpoint.batches[index]!
      batch.stage = {
        state: 'acknowledged',
        submittedAt: CREATED_AT,
        acknowledgedAt: CREATED_AT,
        failureCode: null,
      }
      batch.acknowledgementChecksum = sha256(`acknowledgement-${index}`)
      batch.effects =
        mode === 'replay'
          ? { applied: 0, alreadyApplied: batch.recordCount }
          : { applied: batch.recordCount, alreadyApplied: 0 }
    }
    checkpoint.batches[2]!.stage = {
      state: 'ambiguous',
      submittedAt: CREATED_AT,
      acknowledgedAt: null,
      failureCode: 'request_timeout',
    }
    checkpoint.counters =
      mode === 'replay' ? { applied: 0, alreadyApplied: 500 } : { applied: 500, alreadyApplied: 0 }
    return checkpoint
  }

  function emptyRemoteCheckpoint(): OverlayCheckpoint {
    const checkpoint = lostFinalAckCheckpoint()
    for (const index of [0, 1]) {
      const batch = checkpoint.batches[index]!
      batch.stage = {
        state: 'prepared',
        submittedAt: null,
        acknowledgedAt: null,
        failureCode: null,
      }
      batch.acknowledgementChecksum = null
      batch.effects = null
    }
    // Only the first batch was ever submitted; it timed out before anything landed.
    checkpoint.batches[0]!.stage = {
      state: 'ambiguous',
      submittedAt: CREATED_AT,
      acknowledgedAt: null,
      failureCode: 'request_timeout',
    }
    checkpoint.batches[2]!.stage = {
      state: 'prepared',
      submittedAt: null,
      acknowledgedAt: null,
      failureCode: null,
    }
    checkpoint.counters = { applied: 0, alreadyApplied: 0 }
    return checkpoint
  }

  const OBSERVED = (recordCount: number, kind: 'exact' | 'absent') => ({
    recordCount,
    exactRecords: kind === 'exact' ? recordCount : 0,
    absentRecords: kind === 'absent' ? recordCount : 0,
    driftedRecords: 0,
    inconsistentRecords: 0,
    eventsPresent: kind === 'exact' ? recordCount : 0,
  })

  function receiptFor(
    checkpoint: OverlayCheckpoint,
    entries: Array<{
      index: number
      classification: string
      observed: Record<string, number>
      requestMode?: string
      requestChecksum?: string
      expectedRecordCount?: number
    }>,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const scope: OverlayOperationScope = (overrides.operationScope as OverlayOperationScope) ?? {
      corpusArticles: OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
      reviewedForOperation: 630,
      eventsForOperation: 630,
      foreignReviewed: 0,
    }
    const body = {
      schemaVersion: OVERLAY_RECONCILIATION_SCHEMA_VERSION,
      operationId: checkpoint.operationId,
      checkpointChecksum: overlayCheckpointChecksum(checkpoint),
      observedAt: '2026-08-17T00:06:00.000Z',
      registryConsistent: true,
      ...overrides,
      operationScope: overrides.operationScope === undefined ? scope : overrides.operationScope,
      batches: entries.map((entry) => {
        const batch = checkpoint.batches[entry.index]!
        const observation = {
          index: entry.index,
          classification: entry.classification,
          observed: entry.observed,
        }
        return {
          index: entry.index,
          requestChecksum: entry.requestChecksum ?? batch.requestChecksum,
          requestMode: entry.requestMode ?? batch.requestMode,
          expectedRecordCount: entry.expectedRecordCount ?? batch.recordCount,
          classification: entry.classification,
          observed: entry.observed,
          observationChecksum: sha256(canonicalJson(observation)),
        }
      }),
    }
    return { ...body, receiptChecksum: sha256(canonicalJson(body)) }
  }

  it('accepts the truthful lost-final-acknowledgement nomination', () => {
    const checkpoint = lostFinalAckCheckpoint()
    const receipt = receiptFor(checkpoint, [
      { index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') },
    ])
    expect(() => assertReconciliationReceiptConsistent(checkpoint, receipt)).not.toThrow()
  })

  it('accepts the truthful exact-absence nomination against an empty remote', () => {
    const checkpoint = emptyRemoteCheckpoint()
    const receipt = receiptFor(
      checkpoint,
      [{ index: 0, classification: 'absent_exact', observed: OBSERVED(250, 'absent') }],
      {
        operationScope: {
          corpusArticles: OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
          reviewedForOperation: 0,
          eventsForOperation: 0,
          foreignReviewed: 0,
        },
      },
    )
    expect(() => assertReconciliationReceiptConsistent(checkpoint, receipt)).not.toThrow()
  })

  it.each([
    [
      'a string batch index',
      (receipt: Record<string, unknown>) => {
        ;(receipt.batches as Array<Record<string, unknown>>)[0]!.index = '2'
      },
      /non-negative safe integer/u,
    ],
    [
      'a fractional batch index',
      (receipt: Record<string, unknown>) => {
        ;(receipt.batches as Array<Record<string, unknown>>)[0]!.index = 2.5
      },
      /non-negative safe integer/u,
    ],
    [
      'an invalid observedAt timestamp',
      (receipt: Record<string, unknown>) => {
        receipt.observedAt = 'not-a-timestamp'
      },
      /ISO-compatible timestamp/u,
    ],
    [
      'a missing field',
      (receipt: Record<string, unknown>) => {
        delete receipt.observedAt
      },
      /missing or unexpected fields/u,
    ],
    [
      'an extra field',
      (receipt: Record<string, unknown>) => {
        receipt.note = 'trust me'
      },
      /missing or unexpected fields/u,
    ],
    [
      'a string record count',
      (receipt: Record<string, unknown>) => {
        const observed = (receipt.batches as Array<Record<string, unknown>>)[0]!.observed as Record<
          string,
          unknown
        >
        observed.recordCount = '130'
      },
      /non-negative safe integer/u,
    ],
    [
      'a negative count',
      (receipt: Record<string, unknown>) => {
        const observed = (receipt.batches as Array<Record<string, unknown>>)[0]!.observed as Record<
          string,
          unknown
        >
        observed.driftedRecords = -1
      },
      /non-negative safe integer/u,
    ],
    [
      'an unknown classification',
      (receipt: Record<string, unknown>) => {
        ;(receipt.batches as Array<Record<string, unknown>>)[0]!.classification = 'looks_fine'
      },
      /unknown classification/u,
    ],
    [
      'an unknown causal mode',
      (receipt: Record<string, unknown>) => {
        ;(receipt.batches as Array<Record<string, unknown>>)[0]!.requestMode = 'replayed'
      },
      /unknown request causal mode/u,
    ],
    [
      'zero observed records under a nonzero exact claim',
      (receipt: Record<string, unknown>) => {
        const observed = (receipt.batches as Array<Record<string, unknown>>)[0]!.observed as Record<
          string,
          unknown
        >
        observed.recordCount = 0
      },
      /does not equal the expected record count|account for every record/u,
    ],
    [
      'impossible count arithmetic',
      (receipt: Record<string, unknown>) => {
        const observed = (receipt.batches as Array<Record<string, unknown>>)[0]!.observed as Record<
          string,
          unknown
        >
        observed.absentRecords = 40
      },
      /account for every record exactly once/u,
    ],
    [
      'more events than records',
      (receipt: Record<string, unknown>) => {
        const observed = (receipt.batches as Array<Record<string, unknown>>)[0]!.observed as Record<
          string,
          unknown
        >
        observed.eventsPresent = 131
      },
      /event count is impossible|internally inconsistent/u,
    ],
    [
      'a malformed observation checksum',
      (receipt: Record<string, unknown>) => {
        ;(receipt.batches as Array<Record<string, unknown>>)[0]!.observationChecksum = 'zzz'
      },
      /SHA-256 digest/u,
    ],
  ])('refuses %s at the schema boundary', (_label, mutate, pattern) => {
    const checkpoint = lostFinalAckCheckpoint()
    const receipt = receiptFor(checkpoint, [
      { index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') },
    ])
    mutate(receipt)
    const body: Record<string, unknown> = { ...receipt }
    delete body.receiptChecksum
    const resealed = { ...body, receiptChecksum: sha256(canonicalJson(body)) }
    expect(() => validateOverlayReconciliationReceipt(resealed)).toThrow(pattern)
    expect(() => assertReconciliationReceiptConsistent(lostFinalAckCheckpoint(), resealed)).toThrow(
      pattern,
    )
  })

  it('refuses a semantically false applied_exact claim', () => {
    const checkpoint = lostFinalAckCheckpoint()
    const falseReceipt = receiptFor(checkpoint, [
      {
        index: 2,
        classification: 'applied_exact',
        observed: {
          recordCount: 130,
          exactRecords: 0,
          absentRecords: 0,
          driftedRecords: 0,
          inconsistentRecords: 0,
          eventsPresent: 0,
        },
      },
    ])
    expect(() => assertReconciliationReceiptConsistent(checkpoint, falseReceipt)).toThrow(
      /account for every record exactly once|internally inconsistent/u,
    )
  })

  it('refuses receipts that misname the checkpointed request identity', () => {
    const checkpoint = lostFinalAckCheckpoint()
    const wrongChecksum = receiptFor(checkpoint, [
      {
        index: 2,
        classification: 'applied_exact',
        observed: OBSERVED(130, 'exact'),
        requestChecksum: sha256('someone-elses-request'),
      },
    ])
    expect(() => assertReconciliationReceiptConsistent(checkpoint, wrongChecksum)).toThrow(
      /does not name the checkpointed request identity/u,
    )

    const wrongMode = receiptFor(checkpoint, [
      {
        index: 2,
        classification: 'applied_exact',
        observed: OBSERVED(130, 'exact'),
        requestMode: 'replay',
      },
    ])
    expect(() => assertReconciliationReceiptConsistent(checkpoint, wrongMode)).toThrow(
      /contradicts the request causal mode/u,
    )

    const wrongCount = receiptFor(checkpoint, [
      {
        index: 2,
        classification: 'applied_exact',
        observed: OBSERVED(129, 'exact'),
        expectedRecordCount: 129,
      },
    ])
    expect(() => assertReconciliationReceiptConsistent(checkpoint, wrongCount)).toThrow(
      /does not name the checkpointed record count/u,
    )

    const notUnresolved = receiptFor(checkpoint, [
      { index: 0, classification: 'applied_exact', observed: OBSERVED(250, 'exact') },
    ])
    expect(() => assertReconciliationReceiptConsistent(checkpoint, notUnresolved)).toThrow(
      /not unresolved/u,
    )
  })

  it('refuses an observation claimed from before the checkpoint state existed', () => {
    // The reviewed counterexample: a checkpoint persisted in 2026, evidenced by a receipt
    // whose observation claims the year 2000.
    const checkpoint = lostFinalAckCheckpoint()
    const backdated = receiptFor(
      checkpoint,
      [{ index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') }],
      { observedAt: '2000-01-01T00:00:00.000Z' },
    )
    expect(() => assertReconciliationReceiptConsistent(checkpoint, backdated)).toThrow(
      /observation from before the checkpoint state it evidences was persisted/u,
    )
    // Equality remains valid: an observation at the checkpoint's own last-write moment.
    const simultaneous = receiptFor(
      checkpoint,
      [{ index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') }],
      { observedAt: checkpoint.updatedAt },
    )
    expect(() => assertReconciliationReceiptConsistent(checkpoint, simultaneous)).not.toThrow()
  })

  it('refuses an operation scope that cannot account for every article and event', () => {
    const checkpoint = lostFinalAckCheckpoint()
    // 631 events for an expected 630: the extra event is unaccountable, whatever the
    // per-record reads say.
    const extraEvent = receiptFor(
      checkpoint,
      [{ index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') }],
      {
        operationScope: {
          corpusArticles: OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
          reviewedForOperation: 630,
          eventsForOperation: 631,
          foreignReviewed: 0,
        },
      },
    )
    expect(() => assertReconciliationReceiptConsistent(checkpoint, extraEvent)).toThrow(
      /does not account for every article and event exactly/u,
    )

    const extraArticle = receiptFor(
      checkpoint,
      [{ index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') }],
      {
        operationScope: {
          corpusArticles: OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
          reviewedForOperation: 631,
          eventsForOperation: 631,
          foreignReviewed: 0,
        },
      },
    )
    expect(() => assertReconciliationReceiptConsistent(checkpoint, extraArticle)).toThrow(
      /does not account for every article and event exactly/u,
    )

    const missingScope = receiptFor(
      checkpoint,
      [{ index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') }],
      { operationScope: null },
    )
    expect(() => assertReconciliationReceiptConsistent(checkpoint, missingScope)).toThrow(
      /omits the operation scope|carries no operation-scope observation/u,
    )
  })

  it('refuses exact absence claimed for a replay-mode batch', () => {
    const checkpoint = lostFinalAckCheckpoint('replay')
    const receipt = receiptFor(
      checkpoint,
      [{ index: 2, classification: 'absent_exact', observed: OBSERVED(130, 'absent') }],
      {
        operationScope: {
          corpusArticles: OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
          reviewedForOperation: 630,
          eventsForOperation: 630,
          foreignReviewed: 0,
        },
      },
    )
    expect(() => assertReconciliationReceiptConsistent(checkpoint, receipt)).toThrow(
      /completed operation's records cannot be exactly absent/u,
    )
  })

  it('stops on drift, mixture, incomplete observation, and registry inconsistency', () => {
    const checkpoint = lostFinalAckCheckpoint()
    const cases: Array<[string, Record<string, number>]> = [
      [
        'partial',
        {
          recordCount: 130,
          exactRecords: 100,
          absentRecords: 30,
          driftedRecords: 0,
          inconsistentRecords: 0,
          eventsPresent: 100,
        },
      ],
      [
        'mixed',
        {
          recordCount: 130,
          exactRecords: 100,
          absentRecords: 0,
          driftedRecords: 30,
          inconsistentRecords: 0,
          eventsPresent: 100,
        },
      ],
      [
        'drifted',
        {
          recordCount: 130,
          exactRecords: 0,
          absentRecords: 0,
          driftedRecords: 130,
          inconsistentRecords: 0,
          eventsPresent: 0,
        },
      ],
      [
        'ambiguous',
        {
          recordCount: 130,
          exactRecords: 129,
          absentRecords: 0,
          driftedRecords: 0,
          inconsistentRecords: 1,
          eventsPresent: 129,
        },
      ],
    ]
    for (const [classification, observed] of cases) {
      expect(() =>
        assertReconciliationReceiptConsistent(
          checkpoint,
          receiptFor(checkpoint, [{ index: 2, classification, observed }]),
        ),
      ).toThrow(/conflicts with the overlay expectation/u)
    }
    expect(() =>
      assertReconciliationReceiptConsistent(
        checkpoint,
        receiptFor(checkpoint, [
          { index: 2, classification: 'observation_incomplete', observed: OBSERVED(130, 'absent') },
        ]),
      ),
    ).toThrow(/observation is incomplete/u)
    expect(() =>
      assertReconciliationReceiptConsistent(
        checkpoint,
        receiptFor(
          checkpoint,
          [{ index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') }],
          { registryConsistent: false, operationScope: null },
        ),
      ),
    ).toThrow(/registry inconsistent/u)
  })

  it('refuses a receipt bound to a different checkpoint state or operation', () => {
    const checkpoint = lostFinalAckCheckpoint()
    const receipt = receiptFor(checkpoint, [
      { index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') },
    ])
    checkpoint.counters = { applied: 250, alreadyApplied: 0 }
    checkpoint.batches[1]!.stage = {
      state: 'prepared',
      submittedAt: null,
      acknowledgedAt: null,
      failureCode: null,
    }
    checkpoint.batches[1]!.acknowledgementChecksum = null
    checkpoint.batches[1]!.effects = null
    expect(() => assertReconciliationReceiptConsistent(checkpoint, receipt)).toThrow(
      /different checkpoint state/u,
    )

    const foreign = lostFinalAckCheckpoint()
    const foreignReceipt = receiptFor(foreign, [
      { index: 2, classification: 'applied_exact', observed: OBSERVED(130, 'exact') },
    ]) as { operationId: string }
    foreignReceipt.operationId = '00000000-0000-8000-8000-000000000000'
    expect(() => assertReconciliationReceiptConsistent(foreign, foreignReceipt)).toThrow(
      /different operation|checksum does not match/u,
    )
  })

  it('re-observes before advancing and refuses stale or fabricated nominations', async () => {
    // Remote state: nothing applied. A self-checksummed receipt claiming applied_exact is
    // schema-valid and internally consistent, but the fresh observation refuses it.
    const transport = new ScriptedTransport()
    const staleCheckpoint = emptyRemoteCheckpoint()
    const fabricated = receiptFor(
      staleCheckpoint,
      [{ index: 0, classification: 'applied_exact', observed: OBSERVED(250, 'exact') }],
      {
        operationScope: {
          corpusArticles: OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
          reviewedForOperation: 250,
          eventsForOperation: 250,
          foreignReviewed: 0,
        },
      },
    )
    await expect(
      applyReconciliationWithReobservation(
        transport,
        fixtureSet,
        staleCheckpoint,
        fabricated,
        () => new Date(REVIEWED_AT),
      ),
    ).rejects.toThrow(/stale/u)
    expect(staleCheckpoint.batches[0]?.stage.state).toBe('ambiguous')

    // A truthful absent_exact nomination is confirmed by the fresh observation and
    // re-prepares the batch.
    const absentCheckpoint = emptyRemoteCheckpoint()
    const absentReceipt = receiptFor(
      absentCheckpoint,
      [{ index: 0, classification: 'absent_exact', observed: OBSERVED(250, 'absent') }],
      {
        operationScope: {
          corpusArticles: OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
          reviewedForOperation: 0,
          eventsForOperation: 0,
          foreignReviewed: 0,
        },
      },
    )
    await applyReconciliationWithReobservation(
      transport,
      fixtureSet,
      absentCheckpoint,
      absentReceipt,
      () => new Date(REVIEWED_AT),
    )
    expect(absentCheckpoint.batches[0]?.stage.state).toBe('prepared')
    expect(absentCheckpoint.counters).toEqual({ applied: 0, alreadyApplied: 0 })
  })

  it('classifies an operation with 631 events as drifted, never applied_exact', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'overlay-631-test-'))
    try {
      const transport = new ScriptedTransport()
      transport.seedCompletedOperation()
      transport.extraEventsForOperation = 1 // eventsForOperation = 631
      const checkpoint = lostFinalAckCheckpoint()
      const checkpointPath = join(directory, 'checkpoint.json')
      await writeOverlayCheckpoint(checkpointPath, checkpoint)

      const reconciled = await runReconcile(dependencies(transport), { checkpointPath })
      expect(reconciled.receipt.operationScope).toMatchObject({
        reviewedForOperation: 630,
        eventsForOperation: 631,
      })
      expect(reconciled.receipt.batches[0]?.classification).toBe('drifted')
      await expect(
        applyReconciliationWithReobservation(
          transport,
          fixtureSet,
          checkpoint,
          reconciled.receipt,
          () => new Date(REVIEWED_AT),
        ),
      ).rejects.toThrow(/conflicts with the overlay expectation/u)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('classifies an extra reviewed article under the operation as drifted', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'overlay-extra-article-test-'))
    try {
      const transport = new ScriptedTransport()
      transport.seedCompletedOperation()
      transport.extraReviewedForOperation = 1 // a 631st article under the operation id
      transport.extraEventsForOperation = 1 // with its fabricated event
      const checkpoint = lostFinalAckCheckpoint()
      const checkpointPath = join(directory, 'checkpoint.json')
      await writeOverlayCheckpoint(checkpointPath, checkpoint)

      const reconciled = await runReconcile(dependencies(transport), { checkpointPath })
      expect(reconciled.receipt.batches[0]?.classification).toBe('drifted')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('classifies a missing event as ambiguous, never applied_exact', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'overlay-missing-event-test-'))
    try {
      const transport = new ScriptedTransport()
      transport.seedCompletedOperation()
      const finalRecord = fixtureSet.records[629]!
      transport.appliedEvents.delete(reviewedRecordEventId(fixtureSet, finalRecord))
      const checkpoint = lostFinalAckCheckpoint()
      const checkpointPath = join(directory, 'checkpoint.json')
      await writeOverlayCheckpoint(checkpointPath, checkpoint)

      const reconciled = await runReconcile(dependencies(transport), { checkpointPath })
      expect(reconciled.receipt.batches[0]?.classification).toBe('ambiguous')
      expect(reconciled.receipt.batches[0]?.observed.inconsistentRecords).toBeGreaterThan(0)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('a receipt is evidence only: remote movement after reconcile refuses the fold', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'overlay-stale-fold-test-'))
    try {
      const transport = new ScriptedTransport()
      transport.seedCompletedOperation()
      const checkpoint = lostFinalAckCheckpoint()
      const checkpointPath = join(directory, 'checkpoint.json')
      await writeOverlayCheckpoint(checkpointPath, checkpoint)

      const reconciled = await runReconcile(dependencies(transport), { checkpointPath })
      expect(reconciled.receipt.batches[0]?.classification).toBe('applied_exact')

      // The destination moves between reconcile and resume.
      const victim = fixtureSet.records[629]!
      transport.appliedArticles.delete(victim.pmid)
      transport.appliedEvents.delete(reviewedRecordEventId(fixtureSet, victim))

      await expect(
        applyReconciliationWithReobservation(
          transport,
          fixtureSet,
          checkpoint,
          reconciled.receipt,
          () => new Date(REVIEWED_AT),
        ),
      ).rejects.toThrow(/stale/u)
      expect(checkpoint.batches[2]?.stage.state).toBe('ambiguous')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
