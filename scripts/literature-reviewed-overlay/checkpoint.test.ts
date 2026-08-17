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
  writeOverlayCheckpoint,
  writeOverlayReceiptImmutable,
  type OverlayCheckpoint,
  type OverlayReceipt,
} from './checkpoint'
import { collectCohort } from './projection'
import { buildFixtureTruth } from './rehearsal-fixtures'
import { buildReviewedSet } from './reviewed-set'
import { buildOverlayPlan, checkpointBatchesForPlan } from './plan'

const REVIEWED_AT = '2026-08-17T00:00:00.000Z'

function fixtureCheckpoint(): OverlayCheckpoint {
  const truth = buildFixtureTruth()
  const set = buildReviewedSet(collectCohort(truth.cohortPayloads), truth.artifact)
  const plan = buildOverlayPlan(set, REVIEWED_AT, 90)
  return {
    schemaVersion: 'literature-reviewed-overlay-checkpoint/1.0.0',
    engineVersion: 'literature-reviewed-overlay/1.0.0',
    operationId: set.operationId,
    targetProjectRef: 'itcttmkxdxvwmwcmzmey',
    createdAt: REVIEWED_AT,
    updatedAt: REVIEWED_AT,
    artifactSha256: set.artifactSha256,
    projectionDigest: set.projectionDigest,
    reviewedAt: REVIEWED_AT,
    counts: set.counts,
    limits: { recordBatchLimit: 90 },
    batches: checkpointBatchesForPlan(set, plan),
    phase: 'prepared',
    counters: { applied: 0, alreadyApplied: 0 },
  }
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
    const checkpoint = fixtureCheckpoint()
    const path = join(directory, 'checkpoint.json')
    await writeOverlayCheckpoint(path, checkpoint)
    const raw = JSON.parse(await readFile(path, 'utf8')) as {
      checkpoint: OverlayCheckpoint
      checkpointChecksum: string
    }
    raw.checkpoint.counters.applied = 999
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path, JSON.stringify(raw), 'utf8')
    await expect(readOverlayCheckpoint(path)).rejects.toThrow(/checksum does not match/u)
  })

  it('refuses batches that do not tile the record set', () => {
    const checkpoint = fixtureCheckpoint()
    checkpoint.batches[3]!.startOrdinal += 1
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(/tile the record set/u)
  })

  it('refuses a checkpoint naming a different project', () => {
    const checkpoint = fixtureCheckpoint() as unknown as Record<string, unknown>
    checkpoint.targetProjectRef = 'tqnhxlwvkkswuckszlee'
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(/approved project/u)
  })

  it('refuses credential-shaped material and PMID-named keys anywhere', () => {
    expect(() => assertNoSensitiveOverlayMaterial({ note: 'sb_secret_abcdef' })).toThrow(
      OverlayCheckpointIntegrityError,
    )
    expect(() => assertNoSensitiveOverlayMaterial({ authorizationHeader: 'x' })).toThrow(
      /secrets or request bodies/u,
    )
    expect(() => assertNoSensitiveOverlayMaterial({ firstPmid: '123' })).toThrow(
      /must not persist PMID fields/u,
    )
    expect(() => assertNoSensitiveOverlayMaterial({ nested: [{ requestBody: 'x' }] })).toThrow(
      /secrets or request bodies/u,
    )
  })

  it('refuses a failure code carrying a long digit run', () => {
    const checkpoint = fixtureCheckpoint()
    checkpoint.batches[0]!.stage = {
      state: 'confirmed_failure',
      submittedAt: REVIEWED_AT,
      acknowledgedAt: null,
      failureCode: 'rejected_36879724',
    }
    expect(() => validateOverlayCheckpoint(checkpoint)).toThrow(/redacted stable code/u)
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
    const checkpoint = fixtureCheckpoint()
    const body = {
      schemaVersion: 'literature-reviewed-overlay-receipt/1.0.0',
      engineVersion: 'literature-reviewed-overlay/1.0.0',
      operationId: checkpoint.operationId,
      outcome: 'dry-run' as const,
      targetProjectRef: null,
      targetUrl: null,
      writerIdentity: 'literature-reviewed-overlay',
      sourceIdentity: 'x',
      artifactSha256: checkpoint.artifactSha256,
      projectionDigest: checkpoint.projectionDigest,
      reviewedAt: REVIEWED_AT,
      completedAt: REVIEWED_AT,
      counts: checkpoint.counts,
      counters: { applied: 0, alreadyApplied: 0 },
      batchRequestChecksums: checkpoint.batches.map((batch) => batch.requestChecksum),
    }
    const receipt: OverlayReceipt = { ...body, receiptChecksum: overlayReceiptChecksum(body) }
    const path = join(directory, 'receipt.json')
    await writeOverlayReceiptImmutable(path, receipt)
    await expect(writeOverlayReceiptImmutable(path, receipt)).rejects.toThrow(
      OverlayImmutableArtifactExistsError,
    )
    const loaded = await readOverlayReceipt(path)
    expect(loaded.receiptChecksum).toBe(receipt.receiptChecksum)
  })

  it('refuses a receipt whose checksum does not match', async () => {
    const checkpoint = fixtureCheckpoint()
    const body = {
      schemaVersion: 'literature-reviewed-overlay-receipt/1.0.0',
      engineVersion: 'literature-reviewed-overlay/1.0.0',
      operationId: checkpoint.operationId,
      outcome: 'dry-run' as const,
      targetProjectRef: null,
      targetUrl: null,
      writerIdentity: 'literature-reviewed-overlay',
      sourceIdentity: 'x',
      artifactSha256: checkpoint.artifactSha256,
      projectionDigest: checkpoint.projectionDigest,
      reviewedAt: REVIEWED_AT,
      completedAt: REVIEWED_AT,
      counts: checkpoint.counts,
      counters: { applied: 1, alreadyApplied: 0 },
      batchRequestChecksums: checkpoint.batches.map((batch) => batch.requestChecksum),
    }
    const receipt: OverlayReceipt = {
      ...body,
      counters: { applied: 2, alreadyApplied: 0 },
      receiptChecksum: overlayReceiptChecksum(body),
    }
    const path = join(directory, 'receipt.json')
    await expect(writeOverlayReceiptImmutable(path, receipt)).rejects.toThrow(
      /receiptChecksum does not match/u,
    )
  })
})
