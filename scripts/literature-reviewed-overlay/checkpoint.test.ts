/** @jest-environment node */

import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  OverlayCheckpointIntegrityError,
  OverlayImmutableArtifactExistsError,
  OverlayLeaseExistsError,
  acquireOverlayLease,
  assertNoSensitiveOverlayMaterial,
  overlayCheckpointChecksum,
  overlayCheckpointMode,
  overlayReceiptChecksum,
  readOverlayCheckpoint,
  readOverlayReceipt,
  validateOverlayCheckpoint,
  validateOverlayReceipt,
  validateOverlayReceiptAgainstCheckpoint,
  writeOverlayCheckpoint,
  writeOverlayReceiptImmutable,
  type OverlayCheckpoint,
  type OverlayReceipt,
  type OverlayReceiptBody,
} from './checkpoint'
import { assertVerifiedReceiptBinding } from './cli'
import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  OVERLAY_CHECKPOINT_SCHEMA_VERSION,
  OVERLAY_CURATION_REASON,
  OVERLAY_ENGINE_VERSION,
  OVERLAY_RECEIPT_SCHEMA_VERSION,
  OVERLAY_SOURCE_IDENTITY,
  OVERLAY_WRITER_IDENTITY,
  type OverlayRequestMode,
} from './constants'
import { collectCohort } from './projection'
import { buildFixtureTruth } from './rehearsal-fixtures'
import { buildReviewedSet } from './reviewed-set'
import { buildOverlayPlan, checkpointBatchesForPlan } from './plan'
import { sha256 } from '../literature-production-ingest/canonical'

const CREATED_AT = '2026-08-17T00:00:00.000Z'
const SUBMITTED_AT = '2026-08-17T00:01:00.000Z'
const ACKNOWLEDGED_AT = '2026-08-17T00:02:00.000Z'
const UPDATED_AT = '2026-08-17T00:03:00.000Z'
const REVIEWED_AT = CREATED_AT

const truth = buildFixtureTruth()
const fixtureSet = buildReviewedSet(collectCohort(truth.cohortPayloads), truth.artifact)

function fixtureCheckpoint(mode: OverlayRequestMode = 'fresh'): OverlayCheckpoint {
  const plan = buildOverlayPlan(fixtureSet, REVIEWED_AT, 90, mode)
  return {
    schemaVersion: OVERLAY_CHECKPOINT_SCHEMA_VERSION,
    engineVersion: OVERLAY_ENGINE_VERSION,
    operationId: fixtureSet.operationId,
    targetProjectRef: APPROVED_PROJECT_REF,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    artifactSha256: fixtureSet.artifactSha256,
    projectionDigest: fixtureSet.projectionDigest,
    reviewedAt: REVIEWED_AT,
    curationReason: OVERLAY_CURATION_REASON,
    counts: fixtureSet.counts,
    limits: { recordBatchLimit: 90 },
    batches: checkpointBatchesForPlan(fixtureSet, plan),
    phase: 'prepared',
    counters: { applied: 0, alreadyApplied: 0 },
    postObservationChecksum: null,
  }
}

/** Per-index sequential stage moments: batch N+1 submits after batch N acknowledges. */
function stageMoment(second: number): string {
  return `2026-08-17T00:00:${String(second).padStart(2, '0')}.000Z`
}

function acknowledgeBatch(checkpoint: OverlayCheckpoint, index: number): void {
  const batch = checkpoint.batches[index]!
  batch.stage = {
    state: 'acknowledged',
    submittedAt: stageMoment(10 + 2 * index),
    acknowledgedAt: stageMoment(11 + 2 * index),
    failureCode: null,
  }
  batch.acknowledgementChecksum = sha256(`acknowledgement-${index}`)
  batch.effects =
    batch.requestMode === 'replay'
      ? { applied: 0, alreadyApplied: batch.recordCount }
      : { applied: batch.recordCount, alreadyApplied: 0 }
}

function syncFixtureCounters(checkpoint: OverlayCheckpoint): void {
  let applied = 0
  let alreadyApplied = 0
  for (const batch of checkpoint.batches) {
    if (batch.stage.state === 'acknowledged' && batch.effects) {
      applied += batch.effects.applied
      alreadyApplied += batch.effects.alreadyApplied
    }
  }
  checkpoint.counters = { applied, alreadyApplied }
}

function completedCheckpoint(mode: OverlayRequestMode = 'fresh'): OverlayCheckpoint {
  const checkpoint = fixtureCheckpoint(mode)
  for (const batch of checkpoint.batches) acknowledgeBatch(checkpoint, batch.index)
  syncFixtureCounters(checkpoint)
  checkpoint.phase = 'completed'
  checkpoint.postObservationChecksum = sha256('post-observation')
  return checkpoint
}

function boundReceiptBody(checkpoint: OverlayCheckpoint): OverlayReceiptBody {
  const causalMode = checkpoint.batches[0]?.requestMode as OverlayRequestMode
  return {
    schemaVersion: OVERLAY_RECEIPT_SCHEMA_VERSION,
    engineVersion: OVERLAY_ENGINE_VERSION,
    operationId: checkpoint.operationId,
    outcome: causalMode === 'replay' ? 'idempotent-replay' : 'completed',
    causalMode,
    targetProjectRef: APPROVED_PROJECT_REF,
    targetUrl: APPROVED_PROJECT_URL,
    writerIdentity: OVERLAY_WRITER_IDENTITY,
    sourceIdentity: OVERLAY_SOURCE_IDENTITY,
    curationReason: OVERLAY_CURATION_REASON,
    artifactSha256: checkpoint.artifactSha256,
    projectionDigest: checkpoint.projectionDigest,
    reviewedAt: checkpoint.reviewedAt,
    completedAt: checkpoint.updatedAt,
    counts: checkpoint.counts,
    counters: { ...checkpoint.counters },
    batchRequestChecksums: checkpoint.batches.map((batch) => batch.requestChecksum),
    checkpointChecksum: overlayCheckpointChecksum(checkpoint),
    postObservationChecksum: checkpoint.postObservationChecksum,
  }
}

function sealedReceipt(body: OverlayReceiptBody): OverlayReceipt {
  return { ...body, receiptChecksum: overlayReceiptChecksum(body) }
}

function completedReceiptBody(): OverlayReceiptBody {
  return boundReceiptBody(completedCheckpoint())
}

describe('overlay checkpoint durability', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'overlay-checkpoint-test-'))
  })
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('round-trips a valid checkpoint with 0600 permissions', async () => {
    const checkpoint = fixtureCheckpoint()
    const path = join(directory, 'checkpoint.json')
    await writeOverlayCheckpoint(path, checkpoint)
    const loaded = await readOverlayCheckpoint(path)
    expect(overlayCheckpointChecksum(loaded)).toBe(overlayCheckpointChecksum(checkpoint))
    const mode = (await stat(path)).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('detects checksum tampering on read', async () => {
    const checkpoint = completedCheckpoint()
    const path = join(directory, 'checkpoint.json')
    await writeOverlayCheckpoint(path, checkpoint)
    const raw = JSON.parse(await readFile(path, 'utf8')) as {
      checkpoint: OverlayCheckpoint
      checkpointChecksum: string
    }
    raw.checkpoint.counters.applied = 999
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path, JSON.stringify(raw), 'utf8')
    await expect(readOverlayCheckpoint(path)).rejects.toThrow(
      /checksum does not match|sum of acknowledged/u,
    )
  })

  it('refuses a prior-schema checkpoint rather than reinterpreting it', () => {
    const outdated = fixtureCheckpoint() as unknown as Record<string, unknown>
    outdated.schemaVersion = 'literature-reviewed-overlay-checkpoint/1.1.0'
    expect(() => validateOverlayCheckpoint(outdated)).toThrow(/schemaVersion is not supported/u)
  })

  it('holds an exclusive lease and refuses a second holder', async () => {
    const path = join(directory, 'checkpoint.json')
    const lease = await acquireOverlayLease(path)
    await expect(acquireOverlayLease(path)).rejects.toThrow(OverlayLeaseExistsError)
    await lease.release()
    const second = await acquireOverlayLease(path)
    await second.release()
  })

  it('never removes a lease whose contents changed', async () => {
    const path = join(directory, 'checkpoint.json')
    const lease = await acquireOverlayLease(path)
    const { writeFile } = await import('node:fs/promises')
    await writeFile(lease.path, 'someone else\n', 'utf8')
    await expect(lease.release()).rejects.toThrow(/changed ownership/u)
  })

  it('writes receipts immutably', async () => {
    const receipt = sealedReceipt(completedReceiptBody())
    const path = join(directory, 'receipt.json')
    await writeOverlayReceiptImmutable(path, receipt)
    await expect(writeOverlayReceiptImmutable(path, receipt)).rejects.toThrow(
      OverlayImmutableArtifactExistsError,
    )
    const loaded = await readOverlayReceipt(path)
    expect(loaded.receiptChecksum).toBe(receipt.receiptChecksum)
  })
})

describe('relational stage invariants', () => {
  it('accepts a coherent running prefix of acknowledged batches', () => {
    const checkpoint = fixtureCheckpoint()
    acknowledgeBatch(checkpoint, 0)
    syncFixtureCounters(checkpoint)
    checkpoint.phase = 'running'
    expect(() => validateOverlayCheckpoint(checkpoint)).not.toThrow()
    expect(overlayCheckpointMode(checkpoint)).toBe('fresh')
  })

  it('refuses an acknowledged stage with null effects or missing evidence', () => {
    const missingEffects = fixtureCheckpoint()
    acknowledgeBatch(missingEffects, 0)
    missingEffects.batches[0]!.effects = null
    missingEffects.phase = 'running'
    expect(() => validateOverlayCheckpoint(missingEffects)).toThrow(/without effects/u)

    const missingEvidence = fixtureCheckpoint()
    acknowledgeBatch(missingEvidence, 0)
    missingEvidence.batches[0]!.acknowledgementChecksum = null
    syncFixtureCounters(missingEvidence)
    missingEvidence.phase = 'running'
    expect(() => validateOverlayCheckpoint(missingEvidence)).toThrow(/exactly one of/u)

    const doubleEvidence = fixtureCheckpoint()
    acknowledgeBatch(doubleEvidence, 0)
    doubleEvidence.batches[0]!.reconciliationChecksum = sha256('b')
    syncFixtureCounters(doubleEvidence)
    doubleEvidence.phase = 'running'
    expect(() => validateOverlayCheckpoint(doubleEvidence)).toThrow(/exactly one of/u)
  })

  it('refuses acknowledged stages missing timestamps and submitted stages carrying them', () => {
    const missingTimestamps = fixtureCheckpoint()
    acknowledgeBatch(missingTimestamps, 0)
    missingTimestamps.batches[0]!.stage.submittedAt = null
    syncFixtureCounters(missingTimestamps)
    missingTimestamps.phase = 'running'
    expect(() => validateOverlayCheckpoint(missingTimestamps)).toThrow(/both timestamps/u)

    const nullAcknowledgedAt = fixtureCheckpoint()
    acknowledgeBatch(nullAcknowledgedAt, 0)
    nullAcknowledgedAt.batches[0]!.stage.acknowledgedAt = null
    syncFixtureCounters(nullAcknowledgedAt)
    nullAcknowledgedAt.phase = 'running'
    expect(() => validateOverlayCheckpoint(nullAcknowledgedAt)).toThrow(/both timestamps/u)

    const submittedWithEffects = fixtureCheckpoint()
    submittedWithEffects.batches[0]!.stage = {
      state: 'submitted',
      submittedAt: SUBMITTED_AT,
      acknowledgedAt: null,
      failureCode: null,
    }
    submittedWithEffects.batches[0]!.effects = { applied: 90, alreadyApplied: 0 }
    submittedWithEffects.phase = 'running'
    expect(() => validateOverlayCheckpoint(submittedWithEffects)).toThrow(
      /evidence its stage state does not permit/u,
    )
  })

  it('refuses effects that do not account for every record exactly once', () => {
    const checkpoint = fixtureCheckpoint()
    acknowledgeBatch(checkpoint, 0)
    checkpoint.batches[0]!.effects = { applied: 89, alreadyApplied: 0 }
    checkpoint.counters = { applied: 89, alreadyApplied: 0 }
    checkpoint.phase = 'running'
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(/every record exactly once/u)
  })

  it('refuses counters that are not the sum of acknowledged effects', () => {
    const checkpoint = fixtureCheckpoint()
    checkpoint.counters = { applied: 630, alreadyApplied: 0 }
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(/sum of acknowledged/u)
  })

  it('refuses completion without full acknowledgement or the post-observation binding', () => {
    const notAllAcknowledged = fixtureCheckpoint()
    notAllAcknowledged.phase = 'completed'
    notAllAcknowledged.postObservationChecksum = sha256('post')
    expect(() => validateOverlayCheckpoint(notAllAcknowledged)).toThrow(
      /completed while a batch is not acknowledged/u,
    )

    const submittedRemains = completedCheckpoint()
    submittedRemains.batches[6]!.stage = {
      state: 'submitted',
      submittedAt: SUBMITTED_AT,
      acknowledgedAt: null,
      failureCode: null,
    }
    submittedRemains.batches[6]!.acknowledgementChecksum = null
    submittedRemains.batches[6]!.effects = null
    syncFixtureCounters(submittedRemains)
    expect(() => validateOverlayCheckpoint(submittedRemains)).toThrow(
      /completed while a batch is not acknowledged|do not cover the record count/u,
    )

    const missingObservation = completedCheckpoint()
    missingObservation.postObservationChecksum = null
    expect(() => validateOverlayCheckpoint(missingObservation)).toThrow(
      /without the read-only post-observation binding/u,
    )

    const prematureObservation = fixtureCheckpoint()
    prematureObservation.postObservationChecksum = sha256('post')
    expect(() => validateOverlayCheckpoint(prematureObservation)).toThrow(
      /present before completion/u,
    )

    const counterMismatch = completedCheckpoint()
    counterMismatch.counters = { applied: 629, alreadyApplied: 1 }
    expect(() => validateOverlayCheckpoint(counterMismatch)).toThrow(
      /sum of acknowledged batch effects/u,
    )

    expect(() => validateOverlayCheckpoint(completedCheckpoint())).not.toThrow()
    expect(() => validateOverlayCheckpoint(completedCheckpoint('replay'))).not.toThrow()
  })

  it('refuses a checkpoint whose frozen reason or pinned counts drift', () => {
    const wrongReason = fixtureCheckpoint() as unknown as Record<string, unknown>
    wrongReason.curationReason = 'a different reason'
    expect(() => validateOverlayCheckpoint(wrongReason)).toThrow(/frozen operation reason/u)

    const zeroedCounts = fixtureCheckpoint()
    zeroedCounts.counts = {
      ...zeroedCounts.counts,
      classCounts: { include_core: 0, include_adjacent: 0, exclude: 0 },
      relevantCount: 0,
      recordCount: 0,
      provenanceCounts: { physician_confirmed: 0, physician_modified: 0, qc_accepted: 0 },
      persistedHeadCount: 0,
      correctionCount: 0,
    }
    expect(() => validateOverlayCheckpoint(zeroedCounts)).toThrow(/exactly 630 is required/u)
  })

  it('refuses batches that do not tile and foreign project refs', () => {
    const badTiling = fixtureCheckpoint()
    badTiling.batches[3]!.startOrdinal += 1
    expect(() => validateOverlayCheckpoint(badTiling)).toThrow(/tile the record set/u)

    const foreignProject = fixtureCheckpoint() as unknown as Record<string, unknown>
    foreignProject.targetProjectRef = 'tqnhxlwvkkswuckszlee'
    expect(() => validateOverlayCheckpoint(foreignProject)).toThrow(/approved project/u)
  })

  it('refuses credential-shaped material, PMID-named keys, and digit-run failure codes', () => {
    expect(() => assertNoSensitiveOverlayMaterial({ note: 'sb_secret_abcdef' })).toThrow(
      OverlayCheckpointIntegrityError,
    )
    expect(() => assertNoSensitiveOverlayMaterial({ firstPmid: '123' })).toThrow(
      /must not persist PMID fields/u,
    )
    const digitRun = fixtureCheckpoint()
    digitRun.batches[0]!.stage = {
      state: 'confirmed_failure',
      submittedAt: SUBMITTED_AT,
      acknowledgedAt: null,
      failureCode: 'rejected_36879724',
    }
    digitRun.phase = 'confirmed_failure'
    expect(() => validateOverlayCheckpoint(digitRun)).toThrow(/redacted stable code/u)
  })
})

describe('phase-to-stage agreement', () => {
  it('refuses a prepared checkpoint with an acknowledged batch', () => {
    const checkpoint = fixtureCheckpoint()
    acknowledgeBatch(checkpoint, 0)
    syncFixtureCounters(checkpoint)
    checkpoint.phase = 'prepared'
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(
      /prepared while a batch has progressed/u,
    )
  })

  it('refuses a prepared checkpoint with nonzero counters', () => {
    const checkpoint = fixtureCheckpoint()
    checkpoint.counters = { applied: 90, alreadyApplied: 0 }
    checkpoint.phase = 'prepared'
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(/sum of acknowledged/u)
  })

  it('refuses a prepared checkpoint with a submitted, failed, or ambiguous batch', () => {
    for (const [state, failureCode] of [
      ['submitted', null],
      ['confirmed_failure', 'postgrest_rejected'],
      ['ambiguous', 'request_timeout'],
    ] as const) {
      const checkpoint = fixtureCheckpoint()
      checkpoint.batches[0]!.stage = {
        state,
        submittedAt: SUBMITTED_AT,
        acknowledgedAt: null,
        failureCode,
      }
      checkpoint.phase = 'prepared'
      expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(
        /prepared while a batch has progressed/u,
      )
    }
  })

  it('refuses a running checkpoint carrying a halted or duplicated in-flight batch', () => {
    const halted = fixtureCheckpoint()
    acknowledgeBatch(halted, 0)
    halted.batches[1]!.stage = {
      state: 'confirmed_failure',
      submittedAt: SUBMITTED_AT,
      acknowledgedAt: null,
      failureCode: 'postgrest_rejected',
    }
    syncFixtureCounters(halted)
    halted.phase = 'running'
    expect(() => validateOverlayCheckpoint(halted)).toThrow(/halted in failure or ambiguity/u)

    const doubleSubmitted = fixtureCheckpoint()
    doubleSubmitted.batches[0]!.stage = {
      state: 'submitted',
      submittedAt: SUBMITTED_AT,
      acknowledgedAt: null,
      failureCode: null,
    }
    doubleSubmitted.batches[1]!.stage = {
      state: 'submitted',
      submittedAt: SUBMITTED_AT,
      acknowledgedAt: null,
      failureCode: null,
    }
    doubleSubmitted.phase = 'running'
    expect(() => validateOverlayCheckpoint(doubleSubmitted)).toThrow(
      /sequential progression|more than one in-flight/u,
    )
  })

  it('refuses stages out of sequential order', () => {
    // An acknowledged batch AFTER a prepared one: the sequential write-ahead protocol cannot
    // produce it in any phase.
    const outOfOrder = fixtureCheckpoint()
    acknowledgeBatch(outOfOrder, 2)
    syncFixtureCounters(outOfOrder)
    outOfOrder.phase = 'running'
    expect(() => validateOverlayCheckpoint(outOfOrder)).toThrow(/sequential progression/u)
  })

  it('requires halt phases to exhibit exactly their halting stage', () => {
    const noFailure = fixtureCheckpoint()
    noFailure.phase = 'confirmed_failure'
    expect(() => validateOverlayCheckpoint(noFailure)).toThrow(
      /confirmed_failure without exactly one confirmed-failure stage/u,
    )

    const noAmbiguity = fixtureCheckpoint()
    noAmbiguity.phase = 'needs_reconciliation'
    expect(() => validateOverlayCheckpoint(noAmbiguity)).toThrow(
      /needs_reconciliation without exactly one ambiguous stage/u,
    )

    const coherentHalt = fixtureCheckpoint()
    acknowledgeBatch(coherentHalt, 0)
    coherentHalt.batches[1]!.stage = {
      state: 'ambiguous',
      submittedAt: SUBMITTED_AT,
      acknowledgedAt: null,
      failureCode: 'request_timeout',
    }
    syncFixtureCounters(coherentHalt)
    coherentHalt.phase = 'needs_reconciliation'
    expect(() => validateOverlayCheckpoint(coherentHalt)).not.toThrow()
  })
})

describe('temporal coherence', () => {
  it('refuses an acknowledgement that precedes its submission', () => {
    const checkpoint = fixtureCheckpoint()
    acknowledgeBatch(checkpoint, 0)
    checkpoint.batches[0]!.stage.submittedAt = ACKNOWLEDGED_AT
    checkpoint.batches[0]!.stage.acknowledgedAt = SUBMITTED_AT // two moments swapped
    syncFixtureCounters(checkpoint)
    checkpoint.phase = 'running'
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(
      /acknowledges before its own submission/u,
    )
  })

  it('refuses an acknowledgement days before its submission through the read path', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'overlay-temporal-test-'))
    try {
      const checkpoint = fixtureCheckpoint()
      acknowledgeBatch(checkpoint, 0)
      syncFixtureCounters(checkpoint)
      checkpoint.phase = 'running'
      await writeOverlayCheckpoint(join(directory, 'checkpoint.json'), checkpoint)
      const raw = JSON.parse(await readFile(join(directory, 'checkpoint.json'), 'utf8')) as Record<
        string,
        unknown
      >
      const tampered = raw.checkpoint as OverlayCheckpoint
      tampered.batches[0]!.stage.acknowledgedAt = '2026-08-15T00:00:00.000Z'
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(directory, 'checkpoint.json'), JSON.stringify(raw), 'utf8')
      await expect(readOverlayCheckpoint(join(directory, 'checkpoint.json'))).rejects.toThrow(
        /acknowledges before its own submission|lifecycle window|checksum does not match/u,
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('refuses stage moments outside the checkpoint lifecycle window', () => {
    const beforeCreation = fixtureCheckpoint()
    acknowledgeBatch(beforeCreation, 0)
    beforeCreation.batches[0]!.stage.submittedAt = '2026-08-16T23:59:59.000Z'
    syncFixtureCounters(beforeCreation)
    beforeCreation.phase = 'running'
    expect(() => validateOverlayCheckpoint(beforeCreation)).toThrow(/lifecycle window/u)

    const afterUpdate = fixtureCheckpoint()
    acknowledgeBatch(afterUpdate, 0)
    afterUpdate.batches[0]!.stage.acknowledgedAt = '2026-08-17T09:00:00.000Z'
    syncFixtureCounters(afterUpdate)
    afterUpdate.phase = 'running'
    expect(() => validateOverlayCheckpoint(afterUpdate)).toThrow(/lifecycle window/u)
  })

  it('refuses a checkpoint updated before it was created', () => {
    const checkpoint = fixtureCheckpoint()
    checkpoint.createdAt = UPDATED_AT
    checkpoint.updatedAt = CREATED_AT
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(
      /updatedAt precedes checkpoint.createdAt/u,
    )
  })

  it('accepts equal moments — several writes within one millisecond are legitimate', () => {
    const checkpoint = fixtureCheckpoint()
    checkpoint.updatedAt = CREATED_AT
    acknowledgeBatch(checkpoint, 0)
    checkpoint.batches[0]!.stage.submittedAt = CREATED_AT
    checkpoint.batches[0]!.stage.acknowledgedAt = CREATED_AT
    syncFixtureCounters(checkpoint)
    checkpoint.phase = 'running'
    expect(() => validateOverlayCheckpoint(checkpoint)).not.toThrow()
  })
})

describe('adjacent-batch chronology', () => {
  it('refuses a successor batch submitted before its predecessor acknowledged', () => {
    // The reviewed counterexample: batch 0 submitted 00:01:00 / acknowledged 00:02:00, while
    // batch 1 claims submission 00:01:30 and acknowledgement 00:01:45 — an interleaving the
    // strictly sequential engine cannot produce.
    const checkpoint = fixtureCheckpoint()
    acknowledgeBatch(checkpoint, 0)
    checkpoint.batches[0]!.stage.submittedAt = '2026-08-17T00:01:00.000Z'
    checkpoint.batches[0]!.stage.acknowledgedAt = '2026-08-17T00:02:00.000Z'
    acknowledgeBatch(checkpoint, 1)
    checkpoint.batches[1]!.stage.submittedAt = '2026-08-17T00:01:30.000Z'
    checkpoint.batches[1]!.stage.acknowledgedAt = '2026-08-17T00:01:45.000Z'
    syncFixtureCounters(checkpoint)
    checkpoint.phase = 'running'
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(
      /submitted before its predecessor acknowledged/u,
    )
  })

  it('accepts a successor submitted at or after the predecessor acknowledgement', () => {
    const checkpoint = fixtureCheckpoint()
    acknowledgeBatch(checkpoint, 0)
    checkpoint.batches[0]!.stage.submittedAt = '2026-08-17T00:01:00.000Z'
    checkpoint.batches[0]!.stage.acknowledgedAt = '2026-08-17T00:02:00.000Z'
    checkpoint.batches[1]!.stage = {
      state: 'submitted',
      submittedAt: '2026-08-17T00:02:00.000Z', // equality is valid
      acknowledgedAt: null,
      failureCode: null,
    }
    syncFixtureCounters(checkpoint)
    checkpoint.phase = 'running'
    expect(() => validateOverlayCheckpoint(checkpoint)).not.toThrow()
  })

  it('leaves the halted-successor and prepared-tail shapes valid', () => {
    // An ambiguous successor submitted after the predecessor acknowledged remains a valid
    // needs_reconciliation checkpoint, exactly as before.
    const checkpoint = fixtureCheckpoint()
    acknowledgeBatch(checkpoint, 0)
    checkpoint.batches[1]!.stage = {
      state: 'ambiguous',
      submittedAt: SUBMITTED_AT,
      acknowledgedAt: null,
      failureCode: 'request_timeout',
    }
    syncFixtureCounters(checkpoint)
    checkpoint.phase = 'needs_reconciliation'
    expect(() => validateOverlayCheckpoint(checkpoint)).not.toThrow()
  })
})

describe('durable causal mode', () => {
  it('refuses an unknown or missing request mode', () => {
    const unknown = fixtureCheckpoint() as unknown as {
      batches: Array<Record<string, unknown>>
    }
    unknown.batches[0]!.requestMode = 'replayed'
    expect(() => validateOverlayCheckpoint(unknown)).toThrow(/requestMode is invalid/u)

    const missing = fixtureCheckpoint() as unknown as {
      batches: Array<Record<string, unknown>>
    }
    delete missing.batches[0]!.requestMode
    expect(() => validateOverlayCheckpoint(missing)).toThrow(/unexpected or missing fields/u)
  })

  it('refuses mixed fresh and replay modes within one operation', () => {
    const checkpoint = fixtureCheckpoint()
    checkpoint.batches[3]!.requestMode = 'replay'
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(/mix fresh and replay/u)
  })

  it('refuses effects that contradict the recorded causal mode', () => {
    const freshWithReplayEffects = fixtureCheckpoint()
    acknowledgeBatch(freshWithReplayEffects, 0)
    freshWithReplayEffects.batches[0]!.effects = { applied: 0, alreadyApplied: 90 }
    freshWithReplayEffects.counters = { applied: 0, alreadyApplied: 90 }
    freshWithReplayEffects.phase = 'running'
    expect(() => validateOverlayCheckpoint(freshWithReplayEffects)).toThrow(
      /fresh-mode batch acknowledging already-applied effects/u,
    )

    const replayWithFreshEffects = fixtureCheckpoint('replay')
    acknowledgeBatch(replayWithFreshEffects, 0)
    replayWithFreshEffects.batches[0]!.effects = { applied: 90, alreadyApplied: 0 }
    replayWithFreshEffects.counters = { applied: 90, alreadyApplied: 0 }
    replayWithFreshEffects.phase = 'running'
    expect(() => validateOverlayCheckpoint(replayWithFreshEffects)).toThrow(
      /replay-mode batch acknowledging fresh effects/u,
    )
  })
})

describe('the not_required stage', () => {
  function notRequiredBatch(checkpoint: OverlayCheckpoint): Record<string, unknown> {
    const batch = checkpoint.batches[0] as unknown as Record<string, unknown>
    batch.stage = {
      state: 'not_required',
      submittedAt: null,
      acknowledgedAt: null,
      failureCode: null,
    }
    batch.requestChecksum = null
    return batch
  }

  it('is refused at the operation level: every overlay batch is a required mutation', () => {
    const checkpoint = fixtureCheckpoint()
    notRequiredBatch(checkpoint)
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(
      /every overlay batch is a required mutation stage/u,
    )
  })

  it('may carry no request checksum, timestamps, effects, or evidence', () => {
    const withChecksum = fixtureCheckpoint()
    const batch = notRequiredBatch(withChecksum)
    batch.requestChecksum = sha256('request')
    expect(() => validateOverlayCheckpoint(withChecksum)).toThrow(
      /requestChecksum is present on a not-required stage/u,
    )

    const withTimestamp = fixtureCheckpoint()
    const stamped = notRequiredBatch(withTimestamp)
    ;(stamped.stage as Record<string, unknown>).submittedAt = SUBMITTED_AT
    expect(() => validateOverlayCheckpoint(withTimestamp)).toThrow(
      /not required but carries timestamps/u,
    )

    const withEffects = fixtureCheckpoint()
    const effectful = notRequiredBatch(withEffects)
    effectful.effects = { applied: 90, alreadyApplied: 0 }
    expect(() => validateOverlayCheckpoint(withEffects)).toThrow(
      /evidence its stage state does not permit/u,
    )
  })

  it('never satisfies a required mutation stage in a completed checkpoint', () => {
    const checkpoint = completedCheckpoint()
    const batch = checkpoint.batches[6] as unknown as Record<string, unknown>
    batch.stage = {
      state: 'not_required',
      submittedAt: null,
      acknowledgedAt: null,
      failureCode: null,
    }
    batch.requestChecksum = null
    batch.acknowledgementChecksum = null
    batch.effects = null
    syncFixtureCounters(checkpoint)
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(
      /every overlay batch is a required mutation stage/u,
    )
  })
})

describe('receipt authority', () => {
  it('accepts an exact completed receipt', () => {
    expect(() => validateOverlayReceipt(sealedReceipt(completedReceiptBody()))).not.toThrow()
  })

  it('refuses wrong destination, writer, source, or reason regardless of other fields', () => {
    const wrongUrl = completedReceiptBody()
    ;(wrongUrl as unknown as Record<string, unknown>).targetUrl = 'https://example.com/'
    expect(() => validateOverlayReceipt(sealedReceipt(wrongUrl))).toThrow(/canonical approved URL/u)

    const wrongWriter = completedReceiptBody()
    ;(wrongWriter as unknown as Record<string, unknown>).writerIdentity = 'someone-else'
    expect(() => validateOverlayReceipt(sealedReceipt(wrongWriter))).toThrow(
      /reviewed writer identity/u,
    )

    const wrongSource = completedReceiptBody()
    ;(wrongSource as unknown as Record<string, unknown>).sourceIdentity = 'another-source'
    expect(() => validateOverlayReceipt(sealedReceipt(wrongSource))).toThrow(
      /reviewed source identity/u,
    )

    const wrongReason = completedReceiptBody()
    ;(wrongReason as unknown as Record<string, unknown>).curationReason = 'a different reason'
    expect(() => validateOverlayReceipt(sealedReceipt(wrongReason))).toThrow(
      /frozen operation reason/u,
    )
  })

  it('binds the causal mode to the outcome', () => {
    const completedAsReplay = completedReceiptBody()
    ;(completedAsReplay as unknown as Record<string, unknown>).causalMode = 'replay'
    expect(() => validateOverlayReceipt(sealedReceipt(completedAsReplay))).toThrow(
      /causalMode contradicts the receipt outcome/u,
    )

    const unknownMode = completedReceiptBody()
    ;(unknownMode as unknown as Record<string, unknown>).causalMode = 'inferred'
    expect(() => validateOverlayReceipt(sealedReceipt(unknownMode))).toThrow(
      /causalMode is invalid/u,
    )

    const replayAsFresh = boundReceiptBody(completedCheckpoint('replay'))
    ;(replayAsFresh as unknown as Record<string, unknown>).causalMode = 'fresh'
    expect(() => validateOverlayReceipt(sealedReceipt(replayAsFresh))).toThrow(
      /causalMode contradicts the receipt outcome/u,
    )
  })

  it('refuses zeroed counters and zeroed counts on remote outcomes', () => {
    const zeroCounters = completedReceiptBody()
    zeroCounters.counters = { applied: 0, alreadyApplied: 0 }
    expect(() => validateOverlayReceipt(sealedReceipt(zeroCounters))).toThrow(
      /cover the record count exactly/u,
    )

    const zeroCounts = completedReceiptBody()
    zeroCounts.counts = {
      ...zeroCounts.counts,
      recordCount: 0,
      classCounts: { include_core: 0, include_adjacent: 0, exclude: 0 },
      relevantCount: 0,
      provenanceCounts: { physician_confirmed: 0, physician_modified: 0, qc_accepted: 0 },
      persistedHeadCount: 0,
      correctionCount: 0,
    }
    expect(() => validateOverlayReceipt(sealedReceipt(zeroCounts))).toThrow(
      /exactly 630 is required/u,
    )
  })

  it('requires the post-observation binding on remote outcomes and forbids it on dry runs', () => {
    const missingObservation = completedReceiptBody()
    ;(missingObservation as unknown as Record<string, unknown>).postObservationChecksum = null
    expect(() => validateOverlayReceipt(sealedReceipt(missingObservation))).toThrow(
      /requires the post-observation binding/u,
    )

    const dryRunWithTarget = completedReceiptBody()
    dryRunWithTarget.outcome = 'dry-run'
    expect(() => validateOverlayReceipt(sealedReceipt(dryRunWithTarget))).toThrow(
      /dry run names no destination/u,
    )
  })

  it('requires idempotent replays to apply nothing and fresh completions to apply all', () => {
    const replay = boundReceiptBody(completedCheckpoint('replay'))
    replay.counters = { applied: 1, alreadyApplied: fixtureSet.counts.recordCount - 1 }
    expect(() => validateOverlayReceipt(sealedReceipt(replay))).toThrow(
      /applies nothing and re-observes everything/u,
    )

    const partialFresh = completedReceiptBody()
    partialFresh.counters = { applied: 500, alreadyApplied: 130 }
    expect(() => validateOverlayReceipt(sealedReceipt(partialFresh))).toThrow(
      /applies every record exactly once/u,
    )
  })

  it('refuses a receipt whose checksum does not match', () => {
    const body = completedReceiptBody()
    const receipt = {
      ...body,
      completedAt: '2026-08-18T00:00:00.000Z',
      receiptChecksum: overlayReceiptChecksum(body),
    }
    expect(() => validateOverlayReceipt(receipt)).toThrow(/receiptChecksum does not match/u)
  })
})

describe('exact receipt-to-checkpoint binding', () => {
  function boundPair(): { checkpoint: OverlayCheckpoint; receipt: OverlayReceipt } {
    const checkpoint = completedCheckpoint()
    return { checkpoint, receipt: sealedReceipt(boundReceiptBody(checkpoint)) }
  }

  /** Both acceptance boundaries: the binding validator and the CLI verify path. */
  function expectRefusedEverywhere(
    receipt: unknown,
    checkpoint: OverlayCheckpoint,
    pattern: RegExp,
  ): void {
    expect(() => validateOverlayReceiptAgainstCheckpoint(receipt, checkpoint)).toThrow(pattern)
    expect(() =>
      assertVerifiedReceiptBinding(
        receipt,
        checkpoint,
        (checkpoint.postObservationChecksum as string) ?? sha256('verify'),
      ),
    ).toThrow(pattern)
  }

  it('accepts the receipt the completed checkpoint itself describes, at both boundaries', () => {
    const { checkpoint, receipt } = boundPair()
    expect(() => validateOverlayReceiptAgainstCheckpoint(receipt, checkpoint)).not.toThrow()
    expect(() =>
      assertVerifiedReceiptBinding(
        receipt,
        checkpoint,
        checkpoint.postObservationChecksum as string,
      ),
    ).not.toThrow()

    const replayCheckpoint = completedCheckpoint('replay')
    const replayReceipt = sealedReceipt(boundReceiptBody(replayCheckpoint))
    expect(() =>
      validateOverlayReceiptAgainstCheckpoint(replayReceipt, replayCheckpoint),
    ).not.toThrow()
  })

  it('refuses a self-checksummed receipt with an unrelated checkpoint checksum', () => {
    const { checkpoint, receipt } = boundPair()
    const body = { ...receipt } as unknown as OverlayReceiptBody & { receiptChecksum?: string }
    delete body.receiptChecksum
    body.checkpointChecksum = sha256('an-unrelated-checkpoint')
    expectRefusedEverywhere(
      sealedReceipt(body),
      checkpoint,
      /not the checksum of this completed checkpoint/u,
    )
  })

  it('refuses wrong, reordered, omitted, and added batch checksums', () => {
    const { checkpoint, receipt } = boundPair()
    const strip = () => {
      const body = { ...receipt } as unknown as OverlayReceiptBody & { receiptChecksum?: string }
      delete body.receiptChecksum
      return body
    }

    const wrong = strip()
    wrong.batchRequestChecksums = wrong.batchRequestChecksums.map((checksum, index) =>
      index === 3 ? sha256('bogus') : checksum,
    )
    expectRefusedEverywhere(sealedReceipt(wrong), checkpoint, /request sequence exactly/u)

    const reordered = strip()
    reordered.batchRequestChecksums = [...reordered.batchRequestChecksums].reverse()
    expectRefusedEverywhere(sealedReceipt(reordered), checkpoint, /request sequence exactly/u)

    const omitted = strip()
    omitted.batchRequestChecksums = omitted.batchRequestChecksums.slice(0, -1)
    expectRefusedEverywhere(
      sealedReceipt(omitted),
      checkpoint,
      /do not cover the checkpoint batches/u,
    )

    const added = strip()
    added.batchRequestChecksums = [...added.batchRequestChecksums, sha256('extra')]
    expectRefusedEverywhere(
      sealedReceipt(added),
      checkpoint,
      /do not cover the checkpoint batches/u,
    )
  })

  it('refuses zeroed and swapped counters', () => {
    const { checkpoint, receipt } = boundPair()
    const strip = () => {
      const body = { ...receipt } as unknown as OverlayReceiptBody & { receiptChecksum?: string }
      delete body.receiptChecksum
      return body
    }

    const zeroed = strip()
    zeroed.counters = { applied: 0, alreadyApplied: 0 }
    expectRefusedEverywhere(sealedReceipt(zeroed), checkpoint, /./u)

    const swapped = strip()
    swapped.counters = { applied: 0, alreadyApplied: 630 }
    expectRefusedEverywhere(sealedReceipt(swapped), checkpoint, /./u)
  })

  it('refuses a wrong outcome and a wrong causal mode against the checkpoint', () => {
    const { checkpoint, receipt } = boundPair()
    const body = { ...receipt } as unknown as OverlayReceiptBody & { receiptChecksum?: string }
    delete body.receiptChecksum
    // Claim the replay vocabulary over a fresh checkpoint, with internally consistent
    // replay counters — only the checkpoint binding can refuse this shape.
    body.outcome = 'idempotent-replay'
    body.causalMode = 'replay'
    body.counters = { applied: 0, alreadyApplied: 630 }
    expectRefusedEverywhere(sealedReceipt(body), checkpoint, /./u)
  })

  it('refuses a completed receipt from a non-completed checkpoint', () => {
    const { receipt } = boundPair()
    const runningCheckpoint = fixtureCheckpoint()
    acknowledgeBatch(runningCheckpoint, 0)
    syncFixtureCounters(runningCheckpoint)
    runningCheckpoint.phase = 'running'
    expectRefusedEverywhere(receipt, runningCheckpoint, /./u)
  })

  it('refuses a wrong post-observation checksum and a wrong completion timestamp', () => {
    const { checkpoint, receipt } = boundPair()
    const strip = () => {
      const body = { ...receipt } as unknown as OverlayReceiptBody & { receiptChecksum?: string }
      delete body.receiptChecksum
      return body
    }

    const wrongObservation = strip()
    wrongObservation.postObservationChecksum = sha256('someone-elses-observation')
    expectRefusedEverywhere(
      sealedReceipt(wrongObservation),
      checkpoint,
      /not the checkpoint completion binding/u,
    )

    // The completion instant is canonical and exact: earlier, later, and alternate textual
    // renderings of the very same instant are all refused.
    const early = strip()
    early.completedAt = '2026-08-16T23:00:00.000Z'
    expectRefusedEverywhere(
      sealedReceipt(early),
      checkpoint,
      /not exactly the canonical checkpoint completion instant/u,
    )

    const later = strip()
    later.completedAt = '2026-08-17T09:00:00.000Z'
    expectRefusedEverywhere(
      sealedReceipt(later),
      checkpoint,
      /not exactly the canonical checkpoint completion instant/u,
    )

    const alternateRendering = strip()
    // The same instant as checkpoint.updatedAt (2026-08-17T00:03:00.000Z), rendered without
    // milliseconds — parseable, equal in epoch, and still not the canonical string.
    alternateRendering.completedAt = '2026-08-17T00:03:00Z'
    expectRefusedEverywhere(
      sealedReceipt(alternateRendering),
      checkpoint,
      /not exactly the canonical checkpoint completion instant/u,
    )
  })

  it('refuses missing and extra receipt fields', () => {
    const { checkpoint, receipt } = boundPair()
    const missing = { ...receipt } as unknown as Record<string, unknown>
    delete missing.counters
    expectRefusedEverywhere(missing, checkpoint, /unexpected or missing fields/u)

    const extra = { ...receipt, note: 'trust me' } as unknown as Record<string, unknown>
    expectRefusedEverywhere(extra, checkpoint, /unexpected or missing fields/u)
  })

  it('never accepts a dry-run receipt as completed-operation authority', () => {
    const { checkpoint } = boundPair()
    const dryRun: OverlayReceiptBody = {
      ...boundReceiptBody(checkpoint),
      outcome: 'dry-run',
      causalMode: 'fresh',
      targetProjectRef: null,
      targetUrl: null,
      counters: { applied: 0, alreadyApplied: 0 },
      postObservationChecksum: null,
    }
    const sealed = sealedReceipt(dryRun)
    // Internally valid as a dry-run receipt…
    expect(() => validateOverlayReceipt(sealed)).not.toThrow()
    // …but never a completion authority at either boundary.
    expectRefusedEverywhere(sealed, checkpoint, /never completed-operation authority/u)
  })

  it('refuses a receipt that binds to the checkpoint but not to the fresh verification', () => {
    const { checkpoint, receipt } = boundPair()
    expect(() =>
      assertVerifiedReceiptBinding(receipt, checkpoint, sha256('a-different-fresh-observation')),
    ).toThrow(/does not bind to the freshly verified remote state/u)
  })

  it('the fabricated field-subset receipt from the review is refused everywhere', () => {
    // The original reproduction: aligned operation id, digests, reason, reviewedAt, and
    // post-observation checksum — with an unrelated checkpoint checksum, bogus batch
    // checksums, and swapped counters. The old CLI predicate accepted it.
    const { checkpoint, receipt } = boundPair()
    const body = { ...receipt } as unknown as OverlayReceiptBody & { receiptChecksum?: string }
    delete body.receiptChecksum
    body.checkpointChecksum = sha256('an-unrelated-checkpoint')
    body.batchRequestChecksums = checkpoint.batches.map((batch) => sha256(`bogus-${batch.index}`))
    body.outcome = 'idempotent-replay'
    body.causalMode = 'replay'
    body.counters = { applied: 0, alreadyApplied: 630 }
    const fabricated = sealedReceipt(body)
    expectRefusedEverywhere(fabricated, checkpoint, /./u)
    expect(() =>
      assertVerifiedReceiptBinding(
        fabricated,
        checkpoint,
        checkpoint.postObservationChecksum as string,
      ),
    ).toThrow(OverlayCheckpointIntegrityError)
  })
})
