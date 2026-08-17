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
  overlayReceiptChecksum,
  readOverlayCheckpoint,
  readOverlayReceipt,
  validateOverlayCheckpoint,
  validateOverlayReceipt,
  writeOverlayCheckpoint,
  writeOverlayReceiptImmutable,
  type OverlayCheckpoint,
  type OverlayReceipt,
  type OverlayReceiptBody,
} from './checkpoint'
import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  OVERLAY_CURATION_REASON,
  OVERLAY_SOURCE_IDENTITY,
  OVERLAY_WRITER_IDENTITY,
} from './constants'
import { collectCohort } from './projection'
import { buildFixtureTruth } from './rehearsal-fixtures'
import { buildReviewedSet } from './reviewed-set'
import { buildOverlayPlan, checkpointBatchesForPlan } from './plan'
import { sha256 } from '../literature-production-ingest/canonical'

const REVIEWED_AT = '2026-08-17T00:00:00.000Z'

const truth = buildFixtureTruth()
const fixtureSet = buildReviewedSet(collectCohort(truth.cohortPayloads), truth.artifact)

function fixtureCheckpoint(): OverlayCheckpoint {
  const plan = buildOverlayPlan(fixtureSet, REVIEWED_AT, 90)
  return {
    schemaVersion: 'literature-reviewed-overlay-checkpoint/1.1.0',
    engineVersion: 'literature-reviewed-overlay/1.1.0',
    operationId: fixtureSet.operationId,
    targetProjectRef: APPROVED_PROJECT_REF,
    createdAt: REVIEWED_AT,
    updatedAt: REVIEWED_AT,
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

function completedCheckpoint(): OverlayCheckpoint {
  const checkpoint = fixtureCheckpoint()
  for (const batch of checkpoint.batches) {
    batch.stage = {
      state: 'acknowledged',
      submittedAt: REVIEWED_AT,
      acknowledgedAt: REVIEWED_AT,
      failureCode: null,
    }
    batch.acknowledgementChecksum = sha256(`acknowledgement-${batch.index}`)
    batch.effects = { applied: batch.recordCount, alreadyApplied: 0 }
  }
  checkpoint.counters = { applied: fixtureSet.counts.recordCount, alreadyApplied: 0 }
  checkpoint.phase = 'completed'
  checkpoint.postObservationChecksum = sha256('post-observation')
  return checkpoint
}

function completedReceiptBody(): OverlayReceiptBody {
  const checkpoint = completedCheckpoint()
  return {
    schemaVersion: 'literature-reviewed-overlay-receipt/1.1.0',
    engineVersion: 'literature-reviewed-overlay/1.1.0',
    operationId: checkpoint.operationId,
    outcome: 'completed',
    targetProjectRef: APPROVED_PROJECT_REF,
    targetUrl: APPROVED_PROJECT_URL,
    writerIdentity: OVERLAY_WRITER_IDENTITY,
    sourceIdentity: OVERLAY_SOURCE_IDENTITY,
    curationReason: OVERLAY_CURATION_REASON,
    artifactSha256: checkpoint.artifactSha256,
    projectionDigest: checkpoint.projectionDigest,
    reviewedAt: REVIEWED_AT,
    completedAt: REVIEWED_AT,
    counts: checkpoint.counts,
    counters: { applied: fixtureSet.counts.recordCount, alreadyApplied: 0 },
    batchRequestChecksums: checkpoint.batches.map((batch) => batch.requestChecksum),
    checkpointChecksum: overlayCheckpointChecksum(checkpoint),
    postObservationChecksum: sha256('post-observation'),
  }
}

function sealedReceipt(body: OverlayReceiptBody): OverlayReceipt {
  return { ...body, receiptChecksum: overlayReceiptChecksum(body) }
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
  it('accepts a coherent prepared/acknowledged mixture', () => {
    const checkpoint = fixtureCheckpoint()
    const first = checkpoint.batches[0]!
    first.stage = {
      state: 'acknowledged',
      submittedAt: REVIEWED_AT,
      acknowledgedAt: REVIEWED_AT,
      failureCode: null,
    }
    first.acknowledgementChecksum = sha256('acknowledgement')
    first.effects = { applied: 90, alreadyApplied: 0 }
    checkpoint.counters = { applied: 90, alreadyApplied: 0 }
    expect(() => validateOverlayCheckpoint(checkpoint)).not.toThrow()
  })

  it('refuses an acknowledged stage with null effects or missing evidence', () => {
    const missingEffects = fixtureCheckpoint()
    missingEffects.batches[0]!.stage = {
      state: 'acknowledged',
      submittedAt: REVIEWED_AT,
      acknowledgedAt: REVIEWED_AT,
      failureCode: null,
    }
    missingEffects.batches[0]!.acknowledgementChecksum = sha256('acknowledgement')
    expect(() => validateOverlayCheckpoint(missingEffects)).toThrow(/without effects/u)

    const missingEvidence = fixtureCheckpoint()
    missingEvidence.batches[0]!.stage = {
      state: 'acknowledged',
      submittedAt: REVIEWED_AT,
      acknowledgedAt: REVIEWED_AT,
      failureCode: null,
    }
    missingEvidence.batches[0]!.effects = { applied: 90, alreadyApplied: 0 }
    expect(() => validateOverlayCheckpoint(missingEvidence)).toThrow(/exactly one of/u)

    const doubleEvidence = fixtureCheckpoint()
    doubleEvidence.batches[0]!.stage = {
      state: 'acknowledged',
      submittedAt: REVIEWED_AT,
      acknowledgedAt: REVIEWED_AT,
      failureCode: null,
    }
    doubleEvidence.batches[0]!.effects = { applied: 90, alreadyApplied: 0 }
    doubleEvidence.batches[0]!.acknowledgementChecksum = sha256('a')
    doubleEvidence.batches[0]!.reconciliationChecksum = sha256('b')
    expect(() => validateOverlayCheckpoint(doubleEvidence)).toThrow(/exactly one of/u)
  })

  it('refuses acknowledged stages missing timestamps and submitted stages carrying them', () => {
    const missingTimestamps = fixtureCheckpoint()
    missingTimestamps.batches[0]!.stage = {
      state: 'acknowledged',
      submittedAt: null,
      acknowledgedAt: REVIEWED_AT,
      failureCode: null,
    }
    missingTimestamps.batches[0]!.acknowledgementChecksum = sha256('a')
    missingTimestamps.batches[0]!.effects = { applied: 90, alreadyApplied: 0 }
    expect(() => validateOverlayCheckpoint(missingTimestamps)).toThrow(/both timestamps/u)

    const submittedWithEffects = fixtureCheckpoint()
    submittedWithEffects.batches[0]!.stage = {
      state: 'submitted',
      submittedAt: REVIEWED_AT,
      acknowledgedAt: null,
      failureCode: null,
    }
    submittedWithEffects.batches[0]!.effects = { applied: 90, alreadyApplied: 0 }
    expect(() => validateOverlayCheckpoint(submittedWithEffects)).toThrow(
      /evidence its stage state does not permit/u,
    )
  })

  it('refuses effects that do not account for every record exactly once', () => {
    const checkpoint = fixtureCheckpoint()
    checkpoint.batches[0]!.stage = {
      state: 'acknowledged',
      submittedAt: REVIEWED_AT,
      acknowledgedAt: REVIEWED_AT,
      failureCode: null,
    }
    checkpoint.batches[0]!.acknowledgementChecksum = sha256('a')
    checkpoint.batches[0]!.effects = { applied: 89, alreadyApplied: 0 }
    checkpoint.counters = { applied: 89, alreadyApplied: 0 }
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

    expect(() => validateOverlayCheckpoint(completedCheckpoint())).not.toThrow()
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
      submittedAt: REVIEWED_AT,
      acknowledgedAt: null,
      failureCode: 'rejected_36879724',
    }
    expect(() => validateOverlayCheckpoint(digitRun)).toThrow(/redacted stable code/u)
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

  it('requires idempotent replays to apply nothing', () => {
    const replay = completedReceiptBody()
    replay.outcome = 'idempotent-replay'
    replay.counters = { applied: 1, alreadyApplied: fixtureSet.counts.recordCount - 1 }
    expect(() => validateOverlayReceipt(sealedReceipt(replay))).toThrow(
      /applies nothing and re-observes everything/u,
    )
  })

  it('refuses a receipt whose checksum does not match', () => {
    const body = completedReceiptBody()
    const receipt = {
      ...body,
      counters: { applied: 629, alreadyApplied: 1 },
      receiptChecksum: overlayReceiptChecksum(body),
    }
    expect(() => validateOverlayReceipt(receipt)).toThrow(/receiptChecksum does not match/u)
  })
})
