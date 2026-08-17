/**
 * Bounded batch planning and exact request construction.
 *
 * The 630 records are already in PMID order under `C` collation (the reviewed set's one
 * canonical order); the plan tiles them into bounded batches, and every request body is a pure
 * function of the reviewed set, the operation envelope, and the batch descriptor — so a resume
 * can re-derive each body byte-for-byte and prove it against the checkpointed request checksum
 * before any request leaves.
 */

import { jsonBody } from '../literature-production-ingest/canonical'
import type { OverlayCheckpointBatch } from './checkpoint'
import {
  OVERLAY_CURATION_REASON,
  OVERLAY_MAX_RECORD_BATCH_LIMIT,
  OVERLAY_MIN_RECORD_BATCH_LIMIT,
  OVERLAY_SOURCE_IDENTITY,
  OVERLAY_WRITER_IDENTITY,
} from './constants'
import { reviewedRecordEventId, type ReviewedSet } from './reviewed-set'

export interface OverlayBatchDescriptor {
  index: number
  /** 1-based ordinal of the first record in the canonical order. */
  startOrdinal: number
  /** 1-based ordinal of the last record in the canonical order. */
  endOrdinal: number
  recordCount: number
  finalBatch: boolean
}

export interface OverlayPlan {
  operationId: string
  reviewedAt: string
  recordBatchLimit: number
  batches: OverlayBatchDescriptor[]
}

export function assertRecordBatchLimit(value: number): void {
  if (
    !Number.isInteger(value) ||
    value < OVERLAY_MIN_RECORD_BATCH_LIMIT ||
    value > OVERLAY_MAX_RECORD_BATCH_LIMIT
  ) {
    throw new Error(
      `The record batch limit must be an integer between ${OVERLAY_MIN_RECORD_BATCH_LIMIT} ` +
        `and ${OVERLAY_MAX_RECORD_BATCH_LIMIT}.`,
    )
  }
}

export function buildOverlayPlan(
  set: ReviewedSet,
  reviewedAt: string,
  recordBatchLimit: number,
): OverlayPlan {
  assertRecordBatchLimit(recordBatchLimit)
  if (!Number.isFinite(Date.parse(reviewedAt))) {
    throw new Error('The reviewed-at timestamp must be ISO-compatible.')
  }

  const batches: OverlayBatchDescriptor[] = []
  for (let start = 0; start < set.records.length; start += recordBatchLimit) {
    const end = Math.min(start + recordBatchLimit, set.records.length)
    batches.push({
      index: batches.length,
      startOrdinal: start + 1,
      endOrdinal: end,
      recordCount: end - start,
      finalBatch: end === set.records.length,
    })
  }
  if (batches.length === 0) {
    throw new Error('An overlay plan requires at least one batch.')
  }

  return { operationId: set.operationId, reviewedAt, recordBatchLimit, batches }
}

/** The operation envelope shared by every batch request of one operation. */
export function buildOperationEnvelope(
  set: ReviewedSet,
  reviewedAt: string,
  finalBatch: boolean,
): Record<string, unknown> {
  return {
    operationId: set.operationId,
    writerIdentity: OVERLAY_WRITER_IDENTITY,
    artifactSha256: set.artifactSha256,
    sourceIdentity: OVERLAY_SOURCE_IDENTITY,
    reviewedAt,
    recordCount: set.counts.recordCount,
    includeCoreCount: set.counts.classCounts.include_core,
    includeAdjacentCount: set.counts.classCounts.include_adjacent,
    excludeCount: set.counts.classCounts.exclude,
    physicianConfirmedCount: set.counts.provenanceCounts.physician_confirmed,
    physicianModifiedCount: set.counts.provenanceCounts.physician_modified,
    qcAcceptedCount: set.counts.provenanceCounts.qc_accepted,
    curationReason: OVERLAY_CURATION_REASON,
    finalBatch,
  }
}

export interface OverlayBatchRequest {
  body: string
  bytes: number
  checksum: string
  recordCount: number
}

/**
 * Build the exact RPC request body for one batch: `{ p_operation, p_records }` with records in
 * canonical order and deterministic event ids. Deterministic by construction — the same set,
 * timestamp, and descriptor always produce the same bytes.
 */
export function buildBatchRequest(
  set: ReviewedSet,
  reviewedAt: string,
  descriptor: OverlayBatchDescriptor,
): OverlayBatchRequest {
  if (
    descriptor.startOrdinal < 1 ||
    descriptor.endOrdinal > set.records.length ||
    descriptor.endOrdinal < descriptor.startOrdinal ||
    descriptor.endOrdinal - descriptor.startOrdinal + 1 !== descriptor.recordCount
  ) {
    throw new Error('An overlay batch descriptor does not tile the reviewed set.')
  }
  if (descriptor.finalBatch !== (descriptor.endOrdinal === set.records.length)) {
    throw new Error('An overlay batch descriptor mislabels the final batch.')
  }

  const records = set.records
    .slice(descriptor.startOrdinal - 1, descriptor.endOrdinal)
    .map((record) => ({
      pmid: record.pmid,
      eventId: reviewedRecordEventId(set, record),
      reviewedRelevance: record.reviewedRelevance,
      enrichmentProvenance: record.enrichmentProvenance,
      persistedHeadRevision: record.persistedHeadRevision,
      noteCorrection: record.noteCorrection,
    }))

  const { body, bytes, checksum } = jsonBody({
    p_operation: buildOperationEnvelope(set, reviewedAt, descriptor.finalBatch),
    p_records: records,
  })
  return { body, bytes, checksum, recordCount: records.length }
}

/** The initial checkpoint batch rows for a fresh plan. */
export function checkpointBatchesForPlan(
  set: ReviewedSet,
  plan: OverlayPlan,
): OverlayCheckpointBatch[] {
  return plan.batches.map((descriptor) => ({
    index: descriptor.index,
    startOrdinal: descriptor.startOrdinal,
    endOrdinal: descriptor.endOrdinal,
    recordCount: descriptor.recordCount,
    finalBatch: descriptor.finalBatch,
    requestChecksum: buildBatchRequest(set, plan.reviewedAt, descriptor).checksum,
    stage: { state: 'prepared', submittedAt: null, acknowledgedAt: null, failureCode: null },
    acknowledgementChecksum: null,
    effects: null,
  }))
}

/** The exact acknowledgement a batch request must produce to be `acknowledged`. */
export interface OverlayExpectedAcknowledgement {
  operationId: string
  recordCount: number
}

/**
 * Judge an acknowledgement body against the submitted batch. Exact or ambiguous — a mismatch
 * is never a confirmed failure, because the server may have applied the batch and answered
 * badly.
 */
export function acknowledgementMatches(
  expectation: OverlayExpectedAcknowledgement,
  body: unknown,
): { matches: true; applied: number; alreadyApplied: number } | { matches: false; reason: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { matches: false, reason: 'acknowledgement_not_object' }
  }
  const record = body as Record<string, unknown>
  if (record.operationId !== expectation.operationId) {
    return { matches: false, reason: 'acknowledgement_operation_mismatch' }
  }
  if (record.recordCount !== expectation.recordCount) {
    return { matches: false, reason: 'acknowledgement_record_count_mismatch' }
  }
  const applied = record.applied
  const alreadyApplied = record.alreadyApplied
  if (
    !Number.isInteger(applied) ||
    !Number.isInteger(alreadyApplied) ||
    (applied as number) < 0 ||
    (alreadyApplied as number) < 0 ||
    (applied as number) + (alreadyApplied as number) !== expectation.recordCount
  ) {
    return { matches: false, reason: 'acknowledgement_effect_counts_invalid' }
  }
  const dispositions = record.dispositions
  if (!Array.isArray(dispositions) || dispositions.length !== expectation.recordCount) {
    return { matches: false, reason: 'acknowledgement_dispositions_invalid' }
  }
  let observedApplied = 0
  let observedAlready = 0
  for (const disposition of dispositions) {
    if (disposition === 'applied') observedApplied += 1
    else if (disposition === 'already_applied') observedAlready += 1
    else return { matches: false, reason: 'acknowledgement_disposition_unknown' }
  }
  if (observedApplied !== applied || observedAlready !== alreadyApplied) {
    return { matches: false, reason: 'acknowledgement_disposition_totals_mismatch' }
  }
  if (record.operationStatus !== 'started' && record.operationStatus !== 'completed') {
    return { matches: false, reason: 'acknowledgement_operation_status_invalid' }
  }
  return { matches: true, applied: applied as number, alreadyApplied: alreadyApplied as number }
}
