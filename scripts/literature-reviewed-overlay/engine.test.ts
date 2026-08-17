/** @jest-environment node */

import { mkdtempSync, rmSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import { readOverlayCheckpoint, type OverlayCheckpoint } from './checkpoint'
import {
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_ARTIFACT_SHA256_ENV_NAME,
  OVERLAY_CURATION_REASON,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_OWNER_AUTHORIZATION_ENV_NAME,
  OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
  OVERLAY_PROJECTION_SHA256_ENV_NAME,
  OVERLAY_SOURCE_IDENTITY,
  OVERLAY_WRITER_IDENTITY,
} from './constants'
import {
  applyReconciliationWithReobservation,
  assertReconciliationReceiptConsistent,
  expectedArticleState,
  expectedEventPayloads,
  runApply,
  runDryRun,
  runValidate,
  runVerify,
  type OverlayEngineDependencies,
} from './engine'
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
 * reports what actually happened rather than what the acknowledgement claimed. The
 * `mutateSilently` switch reproduces the fabricated-acknowledgement counterexample: plausible
 * acknowledgements with zero stored rows.
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
  /** Return plausible acknowledgements without storing anything. */
  mutateSilently = false

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
    return {
      operationId: operation.operationId,
      recordCount: request.p_records.length,
      applied,
      alreadyApplied,
      dispositions,
      operationStatus: status,
    }
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
        reviewedForOperation: this.appliedArticles.size,
        includeCore,
        includeAdjacent,
        exclude,
        physicianConfirmed: confirmed,
        physicianModified: modified,
        qcAccepted: qc,
        eventsForOperation: this.appliedEvents.size,
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

  it('writes an immutable dry-run receipt without destination requests', async () => {
    let constructed = 0
    const result = await runDryRun(
      dependencies(new ScriptedTransport(), {}, () => {
        constructed += 1
      }),
      { stateDirectory: directory, recordBatchLimit: 90 },
    )
    expect(result.plan.batchCount).toBe(7)
    expect(constructed).toBe(0)
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
  })

  it('treats a fresh application inside a completed-operation replay as ambiguous', async () => {
    const transport = new ScriptedTransport()
    transport.seedCompletedOperation()
    // Remove one stored article: the fake will report it as freshly applied, which the
    // replay acknowledgement contract must refuse.
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
})

describe('reconciliation receipts', () => {
  function ambiguousCheckpoint(): OverlayCheckpoint {
    return {
      schemaVersion: 'literature-reviewed-overlay-checkpoint/1.1.0',
      engineVersion: 'literature-reviewed-overlay/1.1.0',
      operationId: fixtureSet.operationId,
      targetProjectRef: 'itcttmkxdxvwmwcmzmey',
      createdAt: REVIEWED_AT,
      updatedAt: REVIEWED_AT,
      artifactSha256: fixtureSet.artifactSha256,
      projectionDigest: fixtureSet.projectionDigest,
      reviewedAt: REVIEWED_AT,
      curationReason: OVERLAY_CURATION_REASON,
      counts: fixtureSet.counts,
      limits: { recordBatchLimit: 630 },
      batches: [
        {
          index: 0,
          startOrdinal: 1,
          endOrdinal: 630,
          recordCount: 630,
          finalBatch: true,
          requestChecksum: sha256('request'),
          stage: {
            state: 'ambiguous',
            submittedAt: REVIEWED_AT,
            acknowledgedAt: null,
            failureCode: 'request_timeout',
          },
          acknowledgementChecksum: null,
          reconciliationChecksum: null,
          effects: null,
        },
      ],
      phase: 'needs_reconciliation',
      counters: { applied: 0, alreadyApplied: 0 },
      postObservationChecksum: null,
    }
  }

  function receiptFor(
    checkpoint: OverlayCheckpoint,
    classification: string,
    observed: Record<string, number>,
    registryConsistent = true,
  ): Record<string, unknown> {
    const body = {
      schemaVersion: 'literature-reviewed-overlay-reconciliation/1.1.0',
      operationId: checkpoint.operationId,
      checkpointChecksum: sha256(canonicalJson(checkpoint)),
      observedAt: '2026-08-17T00:01:00.000Z',
      registryConsistent,
      batches: [{ index: 0, classification, observed }],
    }
    return { ...body, receiptChecksum: sha256(canonicalJson(body)) }
  }

  const exactObserved = {
    recordCount: 630,
    exactRecords: 630,
    absentRecords: 0,
    driftedRecords: 0,
    inconsistentRecords: 0,
    eventsPresent: 630,
  }
  const absentObserved = {
    recordCount: 630,
    exactRecords: 0,
    absentRecords: 630,
    driftedRecords: 0,
    inconsistentRecords: 0,
    eventsPresent: 0,
  }

  it('accepts internally consistent applied_exact and absent_exact nominations', () => {
    const checkpoint = ambiguousCheckpoint()
    expect(() =>
      assertReconciliationReceiptConsistent(
        checkpoint,
        receiptFor(checkpoint, 'applied_exact', exactObserved),
      ),
    ).not.toThrow()
    expect(() =>
      assertReconciliationReceiptConsistent(
        checkpoint,
        receiptFor(checkpoint, 'absent_exact', absentObserved),
      ),
    ).not.toThrow()
  })

  it('refuses a semantically false applied_exact claim', () => {
    const checkpoint = ambiguousCheckpoint()
    const falseReceipt = receiptFor(checkpoint, 'applied_exact', {
      recordCount: 630,
      exactRecords: 0,
      absentRecords: 0,
      driftedRecords: 0,
      inconsistentRecords: 0,
      eventsPresent: 0,
    })
    expect(() => assertReconciliationReceiptConsistent(checkpoint, falseReceipt)).toThrow(
      /internally inconsistent/u,
    )
    const mismatchReceipt = receiptFor(checkpoint, 'applied_exact', {
      ...exactObserved,
      driftedRecords: 999,
    })
    expect(() => assertReconciliationReceiptConsistent(checkpoint, mismatchReceipt)).toThrow(
      /internally inconsistent/u,
    )
  })

  it('stops on drift, mixture, incomplete observation, and registry inconsistency', () => {
    const checkpoint = ambiguousCheckpoint()
    for (const classification of ['partial', 'mixed', 'drifted', 'ambiguous']) {
      expect(() =>
        assertReconciliationReceiptConsistent(
          checkpoint,
          receiptFor(checkpoint, classification, exactObserved),
        ),
      ).toThrow(/conflicts with the overlay expectation/u)
    }
    expect(() =>
      assertReconciliationReceiptConsistent(
        checkpoint,
        receiptFor(checkpoint, 'observation_incomplete', exactObserved),
      ),
    ).toThrow(/observation is incomplete/u)
    expect(() =>
      assertReconciliationReceiptConsistent(
        checkpoint,
        receiptFor(checkpoint, 'applied_exact', exactObserved, false),
      ),
    ).toThrow(/registry inconsistent/u)
  })

  it('refuses a receipt bound to a different checkpoint state or operation', () => {
    const checkpoint = ambiguousCheckpoint()
    const receipt = receiptFor(checkpoint, 'applied_exact', exactObserved)
    checkpoint.counters = { applied: 1, alreadyApplied: 0 }
    expect(() => assertReconciliationReceiptConsistent(checkpoint, receipt)).toThrow(
      /different checkpoint state/u,
    )

    const foreign = ambiguousCheckpoint()
    const foreignReceipt = receiptFor(foreign, 'applied_exact', exactObserved) as {
      operationId: string
    }
    foreignReceipt.operationId = '00000000-0000-8000-8000-000000000000'
    expect(() => assertReconciliationReceiptConsistent(foreign, foreignReceipt)).toThrow(
      /different operation|checksum does not match/u,
    )
  })

  it('re-observes before advancing a stage and refuses a stale receipt', async () => {
    const transport = new ScriptedTransport()
    // Remote state: nothing applied. A receipt claiming applied_exact is internally
    // consistent in shape but stale against the fresh observation.
    const checkpoint = ambiguousCheckpoint()
    const staleReceipt = receiptFor(checkpoint, 'applied_exact', exactObserved)
    await expect(
      applyReconciliationWithReobservation(
        transport,
        fixtureSet,
        checkpoint,
        staleReceipt,
        false,
        () => new Date(REVIEWED_AT),
      ),
    ).rejects.toThrow(/receipt is stale/u)
    expect(checkpoint.batches[0]?.stage.state).toBe('ambiguous')

    // A truthful absent_exact nomination is confirmed by the fresh observation and
    // re-prepares the batch.
    const absentCheckpoint = ambiguousCheckpoint()
    const absentReceipt = receiptFor(absentCheckpoint, 'absent_exact', absentObserved)
    await applyReconciliationWithReobservation(
      transport,
      fixtureSet,
      absentCheckpoint,
      absentReceipt,
      false,
      () => new Date(REVIEWED_AT),
    )
    expect(absentCheckpoint.batches[0]?.stage.state).toBe('prepared')

    // With the remote fully applied, an applied_exact nomination is confirmed and the batch
    // acknowledges through reconciliation evidence with mode-decided effects.
    transport.seedCompletedOperation()
    const appliedCheckpoint = ambiguousCheckpoint()
    const appliedReceipt = receiptFor(appliedCheckpoint, 'applied_exact', exactObserved)
    await applyReconciliationWithReobservation(
      transport,
      fixtureSet,
      appliedCheckpoint,
      appliedReceipt,
      true,
      () => new Date(REVIEWED_AT),
    )
    expect(appliedCheckpoint.batches[0]?.stage.state).toBe('acknowledged')
    expect(appliedCheckpoint.batches[0]?.reconciliationChecksum).toMatch(/^[a-f0-9]{64}$/u)
    expect(appliedCheckpoint.batches[0]?.effects).toEqual({ applied: 0, alreadyApplied: 630 })
    expect(appliedCheckpoint.counters).toEqual({ applied: 0, alreadyApplied: 630 })
  })
})
