/**
 * Durable write-ahead checkpoint, exclusive lease, and immutable receipts for the overlay.
 *
 * A lean mirror of the ingest operator's checkpoint module with the same guarantees: every
 * persisted artifact is written to a private temporary file, fsynced, and renamed (or hard
 * linked for create-once artifacts) inside a 0o700 directory with 0o600 files; every envelope
 * carries a canonical checksum verified on load; sensitive material — credential shapes,
 * secret-named keys, and PMID-named keys — is refused on write and on read; and the lease is
 * fail-closed: a crash leaves it behind for inspection, and it is never treated as stale or
 * removed automatically.
 */

import { randomUUID } from 'node:crypto'
import type { FileHandle } from 'node:fs/promises'
import { link, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

import { canonicalJson, redact, sha256 } from '../literature-production-ingest/canonical'
import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  OVERLAY_CHECKPOINT_SCHEMA_VERSION,
  OVERLAY_CURATION_REASON,
  OVERLAY_ENGINE_VERSION,
  OVERLAY_EXPECTED_CLASS_COUNTS,
  OVERLAY_EXPECTED_PERSISTED_HEAD_COUNT,
  OVERLAY_EXPECTED_PROVENANCE_COUNTS,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_EXPECTED_RELEVANT_COUNT,
  OVERLAY_LEASE_SCHEMA_VERSION,
  OVERLAY_MAX_RECORD_BATCH_LIMIT,
  OVERLAY_NOTE_CORRECTIONS,
  OVERLAY_RECEIPT_SCHEMA_VERSION,
  OVERLAY_REQUEST_MODES,
  OVERLAY_SOURCE_IDENTITY,
  OVERLAY_WRITER_IDENTITY,
  type OverlayRequestMode,
} from './constants'
import { assertDeterministicUuid } from './identity'
import type { ReviewedSetCounts } from './reviewed-set'

/**
 * The complete stage vocabulary. `not_required` exists so the vocabulary is closed over every
 * stage a checkpoint format could name — a stage that is not a required mutation carries no
 * request checksum, no timestamps, no effects, and no evidence. This operation plans no such
 * stage: every batch of the 630-record overlay is a required mutation, so a checkpoint
 * claiming a `not_required` batch is refused at the operation level, not merely shape-checked.
 */
export type OverlayStageState =
  | 'prepared'
  | 'submitted'
  | 'acknowledged'
  | 'confirmed_failure'
  | 'ambiguous'
  | 'not_required'

export interface OverlayStage {
  state: OverlayStageState
  submittedAt: string | null
  acknowledgedAt: string | null
  failureCode: string | null
}

export interface OverlayCheckpointBatch {
  index: number
  startOrdinal: number
  endOrdinal: number
  recordCount: number
  finalBatch: boolean
  /**
   * The durable causal context this batch's request was prepared in — `fresh` application or
   * exact completed-operation `replay` — fixed before the request is sent and bound into the
   * request body and checksum. Reconciliation classifies whether the exact request was
   * remotely applied, but it never rewrites this recorded mode from the destination's later
   * registry status.
   */
  requestMode: OverlayRequestMode
  requestChecksum: string
  stage: OverlayStage
  /** Canonical checksum of the exact acknowledgement body, when acknowledged by transport. */
  acknowledgementChecksum: string | null
  /**
   * Canonical checksum of the fresh reconciliation observation, when acknowledged through
   * read-only reconciliation instead of a transport acknowledgement. An acknowledged stage
   * carries exactly one of the two checksums — an acknowledgement that can name neither its
   * transport response nor its reconciliation evidence is not an acknowledgement.
   */
  reconciliationChecksum: string | null
  effects: { applied: number; alreadyApplied: number } | null
}

export type OverlayPhase =
  | 'prepared'
  | 'running'
  | 'confirmed_failure'
  | 'needs_reconciliation'
  | 'completed'

export interface OverlayCheckpoint {
  schemaVersion: string
  engineVersion: string
  operationId: string
  targetProjectRef: string
  createdAt: string
  updatedAt: string
  artifactSha256: string
  projectionDigest: string
  reviewedAt: string
  /** The frozen operation curation reason; part of the operation identity. */
  curationReason: string
  counts: ReviewedSetCounts
  limits: { recordBatchLimit: number }
  batches: OverlayCheckpointBatch[]
  phase: OverlayPhase
  counters: { applied: number; alreadyApplied: number }
  /**
   * Canonical checksum of the read-only post-mutation observation that licensed completion.
   * Null in every phase except `completed`, where it is required: a checkpoint may not claim
   * completion on acknowledgements alone.
   */
  postObservationChecksum: string | null
}

export interface OverlayCheckpointEnvelope {
  checkpoint: OverlayCheckpoint
  checkpointChecksum: string
}

export type OverlayReceiptOutcome = 'completed' | 'dry-run' | 'idempotent-replay'

export interface OverlayReceiptBody {
  schemaVersion: string
  engineVersion: string
  operationId: string
  outcome: OverlayReceiptOutcome
  /**
   * The operation's uniform causal mode, copied from the durable per-batch request modes —
   * never inferred from counters or from the destination's later status. `completed` receipts
   * are `fresh`; `idempotent-replay` receipts are `replay`; a dry run plans the fresh
   * application and says so.
   */
  causalMode: OverlayRequestMode
  targetProjectRef: string | null
  targetUrl: string | null
  writerIdentity: string
  sourceIdentity: string
  curationReason: string
  artifactSha256: string
  projectionDigest: string
  reviewedAt: string
  completedAt: string
  counts: ReviewedSetCounts
  counters: { applied: number; alreadyApplied: number }
  batchRequestChecksums: string[]
  /** Checksum of the checkpoint state this receipt was written from. */
  checkpointChecksum: string
  /** Checksum of the read-only post-observation that licensed a remote outcome; null on dry runs. */
  postObservationChecksum: string | null
}

export interface OverlayReceipt extends OverlayReceiptBody {
  receiptChecksum: string
}

const STAGE_STATES = new Set<OverlayStageState>([
  'prepared',
  'submitted',
  'acknowledged',
  'confirmed_failure',
  'ambiguous',
  'not_required',
])
const PHASES = new Set<OverlayPhase>([
  'prepared',
  'running',
  'confirmed_failure',
  'needs_reconciliation',
  'completed',
])

const CREDENTIAL_VALUE_PATTERN =
  /(?:sb_(?:secret|publishable)_[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|bearer\s+\S+)/iu

/** The canonical `Date.toISOString()` rendering — the only form a completion instant takes. */
const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u

export class OverlayCheckpointIntegrityError extends Error {
  readonly code = 'overlay_checkpoint_integrity_error'

  constructor(message = 'Overlay checkpoint integrity validation failed.') {
    super(message)
    this.name = 'OverlayCheckpointIntegrityError'
  }
}

export class OverlayImmutableArtifactExistsError extends Error {
  readonly code = 'overlay_immutable_artifact_exists'

  constructor() {
    super('The immutable overlay artifact already exists and will not be overwritten.')
    this.name = 'OverlayImmutableArtifactExistsError'
  }
}

export class OverlayLeaseExistsError extends Error {
  readonly code = 'overlay_lease_exists'

  constructor() {
    super(
      'Another operator holds the overlay checkpoint lease. Do not run concurrent mutation ' +
        'or resume processes.',
    )
    this.name = 'OverlayLeaseExistsError'
  }
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replaceAll(/[^a-z0-9]/giu, '').toLowerCase()
  return (
    normalized.includes('apikey') ||
    normalized.includes('authorization') ||
    normalized.includes('credential') ||
    normalized.includes('password') ||
    normalized.includes('requestbody') ||
    normalized.includes('secret')
  )
}

export function assertNoSensitiveOverlayMaterial(value: unknown, label = 'checkpoint'): void {
  if (typeof value === 'string') {
    if (CREDENTIAL_VALUE_PATTERN.test(value) || redact(value) !== value) {
      throw new OverlayCheckpointIntegrityError(`${label} contains credential-shaped material.`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoSensitiveOverlayMaterial(child, `${label}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/pmid/iu.test(key)) {
      throw new OverlayCheckpointIntegrityError(
        'Overlay checkpoints and receipts must not persist PMID fields.',
      )
    }
    if (isSensitiveKey(key)) {
      throw new OverlayCheckpointIntegrityError(
        'Overlay checkpoints and receipts must not persist secrets or request bodies.',
      )
    }
    assertNoSensitiveOverlayMaterial(child, `${label}.${key}`)
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OverlayCheckpointIntegrityError(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new OverlayCheckpointIntegrityError(`${label} contains unexpected or missing fields.`)
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OverlayCheckpointIntegrityError(`${label} must be a non-empty string.`)
  }
}

function assertTimestamp(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label)
  if (!Number.isFinite(Date.parse(value))) {
    throw new OverlayCheckpointIntegrityError(`${label} must be an ISO-compatible timestamp.`)
  }
}

function assertNullableTimestamp(value: unknown, label: string): void {
  if (value !== null) assertTimestamp(value, label)
}

function assertSha256Digest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new OverlayCheckpointIntegrityError(`${label} must be a lowercase SHA-256 digest.`)
  }
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new OverlayCheckpointIntegrityError(`${label} must be a non-negative integer.`)
  }
}

function assertCounts(value: unknown, label: string): asserts value is ReviewedSetCounts {
  const counts = asRecord(value, label)
  assertExactKeys(
    counts,
    [
      'recordCount',
      'classCounts',
      'relevantCount',
      'provenanceCounts',
      'persistedHeadCount',
      'correctionCount',
    ],
    label,
  )
  assertNonNegativeInteger(counts.recordCount, `${label}.recordCount`)
  assertNonNegativeInteger(counts.relevantCount, `${label}.relevantCount`)
  assertNonNegativeInteger(counts.persistedHeadCount, `${label}.persistedHeadCount`)
  assertNonNegativeInteger(counts.correctionCount, `${label}.correctionCount`)
  const classCounts = asRecord(counts.classCounts, `${label}.classCounts`)
  assertExactKeys(
    classCounts,
    ['include_core', 'include_adjacent', 'exclude'],
    `${label}.classCounts`,
  )
  for (const [key, child] of Object.entries(classCounts)) {
    assertNonNegativeInteger(child, `${label}.classCounts.${key}`)
  }
  const provenanceCounts = asRecord(counts.provenanceCounts, `${label}.provenanceCounts`)
  assertExactKeys(
    provenanceCounts,
    ['physician_confirmed', 'physician_modified', 'qc_accepted'],
    `${label}.provenanceCounts`,
  )
  for (const [key, child] of Object.entries(provenanceCounts)) {
    assertNonNegativeInteger(child, `${label}.provenanceCounts.${key}`)
  }
}

function validateStage(value: unknown, label: string): asserts value is OverlayStage {
  const stage = asRecord(value, label)
  assertExactKeys(stage, ['state', 'submittedAt', 'acknowledgedAt', 'failureCode'], label)
  if (typeof stage.state !== 'string' || !STAGE_STATES.has(stage.state as OverlayStageState)) {
    throw new OverlayCheckpointIntegrityError(`${label}.state is invalid.`)
  }
  assertNullableTimestamp(stage.submittedAt, `${label}.submittedAt`)
  assertNullableTimestamp(stage.acknowledgedAt, `${label}.acknowledgedAt`)
  if (stage.failureCode !== null) {
    if (
      typeof stage.failureCode !== 'string' ||
      !/^[a-z][a-z0-9_.:-]{0,127}$/u.test(stage.failureCode) ||
      /\d{6,12}/u.test(stage.failureCode)
    ) {
      throw new OverlayCheckpointIntegrityError(
        `${label}.failureCode must be a redacted stable code.`,
      )
    }
  }
}

/** Epoch milliseconds of an already-validated timestamp string. */
function epochOf(value: string): number {
  return Date.parse(value)
}

/**
 * Temporal coherence for one stage against the checkpoint's own lifecycle window. These are
 * order relations between moments the operator itself recorded, not wall-clock precision
 * claims: a submission cannot precede the checkpoint's creation, an acknowledgement cannot
 * precede its submission, and no stage moment can postdate the checkpoint's last write.
 * Equality is always acceptable — several moments are legitimately recorded within one
 * millisecond.
 */
function validateStageTemporalCoherence(
  stage: OverlayStage,
  bounds: { createdAt: string; updatedAt: string },
  label: string,
): void {
  const createdEpoch = epochOf(bounds.createdAt)
  const updatedEpoch = epochOf(bounds.updatedAt)
  if (stage.submittedAt !== null) {
    const submittedEpoch = epochOf(stage.submittedAt)
    if (submittedEpoch < createdEpoch || submittedEpoch > updatedEpoch) {
      throw new OverlayCheckpointIntegrityError(
        `${label}.submittedAt lies outside the checkpoint lifecycle window.`,
      )
    }
  }
  if (stage.acknowledgedAt !== null) {
    const acknowledgedEpoch = epochOf(stage.acknowledgedAt)
    if (stage.submittedAt !== null && acknowledgedEpoch < epochOf(stage.submittedAt)) {
      throw new OverlayCheckpointIntegrityError(`${label} acknowledges before its own submission.`)
    }
    if (acknowledgedEpoch < createdEpoch || acknowledgedEpoch > updatedEpoch) {
      throw new OverlayCheckpointIntegrityError(
        `${label}.acknowledgedAt lies outside the checkpoint lifecycle window.`,
      )
    }
  }
}

/**
 * The relational stage invariants: what each state must and must not carry, judged against the
 * whole batch rather than the stage record alone. An "acknowledged" stage with no timestamps,
 * no effects, and no evidence checksum is not an acknowledged stage — it is a claim, and a
 * checkpoint made of claims must be refused rather than resumed.
 */
function validateBatchStageInvariants(batch: Record<string, unknown>, label: string): void {
  const stage = batch.stage as OverlayStage
  const acknowledgement = batch.acknowledgementChecksum
  const reconciliation = batch.reconciliationChecksum
  const effects = batch.effects as { applied: number; alreadyApplied: number } | null

  const requireNullEvidence = () => {
    if (acknowledgement !== null || reconciliation !== null || effects !== null) {
      throw new OverlayCheckpointIntegrityError(
        `${label} carries acknowledgement evidence its stage state does not permit.`,
      )
    }
  }

  switch (stage.state) {
    case 'prepared':
      if (stage.submittedAt !== null || stage.acknowledgedAt !== null) {
        throw new OverlayCheckpointIntegrityError(`${label} is prepared but carries timestamps.`)
      }
      if (stage.failureCode !== null) {
        throw new OverlayCheckpointIntegrityError(`${label} is prepared but carries a failure.`)
      }
      requireNullEvidence()
      return
    case 'submitted':
      if (stage.submittedAt === null) {
        throw new OverlayCheckpointIntegrityError(`${label} is submitted without a timestamp.`)
      }
      if (stage.acknowledgedAt !== null || stage.failureCode !== null) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is submitted but carries acknowledgement or failure fields.`,
        )
      }
      requireNullEvidence()
      return
    case 'acknowledged': {
      if (stage.submittedAt === null || stage.acknowledgedAt === null) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is acknowledged without both timestamps.`,
        )
      }
      if (stage.failureCode !== null) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is acknowledged but carries a failure code.`,
        )
      }
      const hasAcknowledgement = acknowledgement !== null
      const hasReconciliation = reconciliation !== null
      if (hasAcknowledgement === hasReconciliation) {
        throw new OverlayCheckpointIntegrityError(
          `${label} must carry exactly one of a transport acknowledgement or a ` +
            'reconciliation evidence checksum.',
        )
      }
      if (effects === null) {
        throw new OverlayCheckpointIntegrityError(`${label} is acknowledged without effects.`)
      }
      if (effects.applied + effects.alreadyApplied !== batch.recordCount) {
        throw new OverlayCheckpointIntegrityError(
          `${label} effects do not account for every record exactly once.`,
        )
      }
      // Effects must agree with the batch's durable causal mode: a fresh request applies
      // every record it carries, a replay applies none. Effects that contradict the recorded
      // mode are a rewritten causal history, not bookkeeping.
      if (batch.requestMode === 'fresh' && effects.alreadyApplied !== 0) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is a fresh-mode batch acknowledging already-applied effects.`,
        )
      }
      if (batch.requestMode === 'replay' && effects.applied !== 0) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is a replay-mode batch acknowledging fresh effects.`,
        )
      }
      return
    }
    case 'confirmed_failure':
      if (stage.submittedAt === null || stage.failureCode === null) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is a confirmed failure without submission identity or classification.`,
        )
      }
      if (stage.acknowledgedAt !== null) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is a confirmed failure but carries an acknowledgement timestamp.`,
        )
      }
      requireNullEvidence()
      return
    case 'ambiguous':
      if (stage.submittedAt === null || stage.failureCode === null) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is ambiguous without submission identity or ambiguity evidence.`,
        )
      }
      if (stage.acknowledgedAt !== null) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is ambiguous but carries an acknowledgement timestamp.`,
        )
      }
      requireNullEvidence()
      return
    case 'not_required':
      // The complete shape of a not-required stage: nothing. No request checksum (checked at
      // the batch level), no timestamps, no failure, no effects, no evidence.
      if (
        stage.submittedAt !== null ||
        stage.acknowledgedAt !== null ||
        stage.failureCode !== null
      ) {
        throw new OverlayCheckpointIntegrityError(
          `${label} is not required but carries timestamps or a failure.`,
        )
      }
      requireNullEvidence()
      return
    default:
      throw new OverlayCheckpointIntegrityError(`${label}.state is invalid.`)
  }
}

/**
 * The phase-to-stage relational invariants over the whole checkpoint.
 *
 * The engine's write-ahead protocol is strictly sequential — batch k is submitted only after
 * batches 0..k-1 acknowledged, and a halting stage (a confirmed failure or an ambiguity)
 * stops the run before any later batch moves — so every honestly persisted checkpoint shows a
 * prefix of acknowledged batches, at most one in-flight or halted batch, and a prepared tail.
 * Each phase then names which shapes it may describe. A checkpoint whose phase and stages
 * disagree is not a weaker checkpoint; it is a claim about history the protocol cannot have
 * produced, and it is refused rather than reinterpreted.
 */
function validatePhaseStageAgreement(
  phase: OverlayPhase,
  stageStates: readonly OverlayStageState[],
  label: string,
): void {
  // Sequential-progression shape, independent of phase.
  let cursor = 0
  while (cursor < stageStates.length && stageStates[cursor] === 'acknowledged') cursor += 1
  const haltIndex = cursor
  const halting =
    haltIndex < stageStates.length &&
    (stageStates[haltIndex] === 'submitted' ||
      stageStates[haltIndex] === 'confirmed_failure' ||
      stageStates[haltIndex] === 'ambiguous')
  if (halting) cursor += 1
  while (cursor < stageStates.length && stageStates[cursor] === 'prepared') cursor += 1
  if (cursor !== stageStates.length) {
    throw new OverlayCheckpointIntegrityError(
      `${label} stages do not form a sequential progression ` +
        '(acknowledged prefix, at most one in-flight batch, prepared tail).',
    )
  }

  const counted = new Map<OverlayStageState, number>()
  for (const state of stageStates) {
    counted.set(state, (counted.get(state) ?? 0) + 1)
  }
  const of = (state: OverlayStageState): number => counted.get(state) ?? 0

  switch (phase) {
    case 'prepared':
      // A prepared operation has done nothing: no submission, no acknowledgement, no failure,
      // no ambiguity, no evidence — and therefore (enforced separately) zero counters and no
      // post-observation. A completion receipt for it is impossible by construction.
      if (of('prepared') !== stageStates.length) {
        throw new OverlayCheckpointIntegrityError(
          `${label} phase is prepared while a batch has progressed beyond prepared.`,
        )
      }
      return
    case 'running':
      if (of('confirmed_failure') > 0 || of('ambiguous') > 0) {
        throw new OverlayCheckpointIntegrityError(
          `${label} phase is running while a batch is halted in failure or ambiguity.`,
        )
      }
      if (of('submitted') > 1) {
        throw new OverlayCheckpointIntegrityError(
          `${label} phase is running with more than one in-flight batch.`,
        )
      }
      return
    case 'confirmed_failure':
      if (of('confirmed_failure') !== 1 || of('submitted') > 0 || of('ambiguous') > 0) {
        throw new OverlayCheckpointIntegrityError(
          `${label} phase is confirmed_failure without exactly one confirmed-failure stage.`,
        )
      }
      return
    case 'needs_reconciliation':
      if (of('ambiguous') !== 1 || of('submitted') > 0 || of('confirmed_failure') > 0) {
        throw new OverlayCheckpointIntegrityError(
          `${label} phase is needs_reconciliation without exactly one ambiguous stage.`,
        )
      }
      return
    case 'completed':
      if (of('acknowledged') !== stageStates.length) {
        throw new OverlayCheckpointIntegrityError(
          `${label} phase is completed while a batch is not acknowledged.`,
        )
      }
      return
    default:
      throw new OverlayCheckpointIntegrityError(`${label} phase is invalid.`)
  }
}

/**
 * Value-level binding of a counts object to the one reviewed truth this operator exists for.
 * Structural validity is not enough: a zeroed or drifted counts object inside a checkpoint or
 * receipt would launder a wrong operation as a plausible artifact.
 */
export function assertPinnedCounts(value: ReviewedSetCounts, label: string): void {
  const expectations: Array<[string, number, number]> = [
    ['recordCount', value.recordCount, OVERLAY_EXPECTED_RECORD_COUNT],
    [
      'classCounts.include_core',
      value.classCounts.include_core,
      OVERLAY_EXPECTED_CLASS_COUNTS.include_core,
    ],
    [
      'classCounts.include_adjacent',
      value.classCounts.include_adjacent,
      OVERLAY_EXPECTED_CLASS_COUNTS.include_adjacent,
    ],
    ['classCounts.exclude', value.classCounts.exclude, OVERLAY_EXPECTED_CLASS_COUNTS.exclude],
    ['relevantCount', value.relevantCount, OVERLAY_EXPECTED_RELEVANT_COUNT],
    [
      'provenanceCounts.physician_confirmed',
      value.provenanceCounts.physician_confirmed,
      OVERLAY_EXPECTED_PROVENANCE_COUNTS.physician_confirmed,
    ],
    [
      'provenanceCounts.physician_modified',
      value.provenanceCounts.physician_modified,
      OVERLAY_EXPECTED_PROVENANCE_COUNTS.physician_modified,
    ],
    [
      'provenanceCounts.qc_accepted',
      value.provenanceCounts.qc_accepted,
      OVERLAY_EXPECTED_PROVENANCE_COUNTS.qc_accepted,
    ],
    ['persistedHeadCount', value.persistedHeadCount, OVERLAY_EXPECTED_PERSISTED_HEAD_COUNT],
    ['correctionCount', value.correctionCount, OVERLAY_NOTE_CORRECTIONS.length],
  ]
  for (const [field, observed, expected] of expectations) {
    if (observed !== expected) {
      throw new OverlayCheckpointIntegrityError(
        `${label}.${field} is ${observed}; exactly ${expected} is required.`,
      )
    }
  }
}

export function validateOverlayCheckpoint(value: unknown): asserts value is OverlayCheckpoint {
  const checkpoint = asRecord(value, 'checkpoint')
  assertExactKeys(
    checkpoint,
    [
      'schemaVersion',
      'engineVersion',
      'operationId',
      'targetProjectRef',
      'createdAt',
      'updatedAt',
      'artifactSha256',
      'projectionDigest',
      'reviewedAt',
      'curationReason',
      'counts',
      'limits',
      'batches',
      'phase',
      'counters',
      'postObservationChecksum',
    ],
    'checkpoint',
  )
  if (checkpoint.schemaVersion !== OVERLAY_CHECKPOINT_SCHEMA_VERSION) {
    throw new OverlayCheckpointIntegrityError('checkpoint.schemaVersion is not supported.')
  }
  if (checkpoint.engineVersion !== OVERLAY_ENGINE_VERSION) {
    throw new OverlayCheckpointIntegrityError('checkpoint.engineVersion is not supported.')
  }
  assertDeterministicUuid(checkpoint.operationId, 'checkpoint.operationId')
  if (checkpoint.targetProjectRef !== APPROVED_PROJECT_REF) {
    throw new OverlayCheckpointIntegrityError(
      'checkpoint.targetProjectRef does not name the approved project.',
    )
  }
  assertTimestamp(checkpoint.createdAt, 'checkpoint.createdAt')
  assertTimestamp(checkpoint.updatedAt, 'checkpoint.updatedAt')
  if (epochOf(checkpoint.updatedAt) < epochOf(checkpoint.createdAt)) {
    throw new OverlayCheckpointIntegrityError('checkpoint.updatedAt precedes checkpoint.createdAt.')
  }
  assertSha256Digest(checkpoint.artifactSha256, 'checkpoint.artifactSha256')
  assertSha256Digest(checkpoint.projectionDigest, 'checkpoint.projectionDigest')
  assertTimestamp(checkpoint.reviewedAt, 'checkpoint.reviewedAt')
  if (checkpoint.curationReason !== OVERLAY_CURATION_REASON) {
    throw new OverlayCheckpointIntegrityError(
      'checkpoint.curationReason is not the frozen operation reason.',
    )
  }
  assertCounts(checkpoint.counts, 'checkpoint.counts')
  assertPinnedCounts(checkpoint.counts as ReviewedSetCounts, 'checkpoint.counts')

  const limits = asRecord(checkpoint.limits, 'checkpoint.limits')
  assertExactKeys(limits, ['recordBatchLimit'], 'checkpoint.limits')
  if (
    !Number.isInteger(limits.recordBatchLimit) ||
    (limits.recordBatchLimit as number) < 1 ||
    (limits.recordBatchLimit as number) > OVERLAY_MAX_RECORD_BATCH_LIMIT
  ) {
    throw new OverlayCheckpointIntegrityError('checkpoint.limits.recordBatchLimit is invalid.')
  }

  if (typeof checkpoint.phase !== 'string' || !PHASES.has(checkpoint.phase as OverlayPhase)) {
    throw new OverlayCheckpointIntegrityError('checkpoint.phase is invalid.')
  }

  const counters = asRecord(checkpoint.counters, 'checkpoint.counters')
  assertExactKeys(counters, ['applied', 'alreadyApplied'], 'checkpoint.counters')
  assertNonNegativeInteger(counters.applied, 'checkpoint.counters.applied')
  assertNonNegativeInteger(counters.alreadyApplied, 'checkpoint.counters.alreadyApplied')

  if (!Array.isArray(checkpoint.batches) || checkpoint.batches.length === 0) {
    throw new OverlayCheckpointIntegrityError('checkpoint.batches must be a non-empty array.')
  }
  let expectedStart = 1
  let acknowledgedApplied = 0
  let acknowledgedAlready = 0
  const stageStates: OverlayStageState[] = []
  let uniformMode: string | null = null
  const counts = checkpoint.counts as ReviewedSetCounts
  const temporalBounds = {
    createdAt: checkpoint.createdAt as string,
    updatedAt: checkpoint.updatedAt as string,
  }
  checkpoint.batches.forEach((value, index) => {
    const batch = asRecord(value, `checkpoint.batches[${index}]`)
    assertExactKeys(
      batch,
      [
        'index',
        'startOrdinal',
        'endOrdinal',
        'recordCount',
        'finalBatch',
        'requestMode',
        'requestChecksum',
        'stage',
        'acknowledgementChecksum',
        'reconciliationChecksum',
        'effects',
      ],
      `checkpoint.batches[${index}]`,
    )
    if (batch.index !== index) {
      throw new OverlayCheckpointIntegrityError('checkpoint.batches are out of order.')
    }
    assertNonNegativeInteger(batch.startOrdinal, 'batch.startOrdinal')
    assertNonNegativeInteger(batch.endOrdinal, 'batch.endOrdinal')
    assertNonNegativeInteger(batch.recordCount, 'batch.recordCount')
    if (
      batch.startOrdinal !== expectedStart ||
      (batch.endOrdinal as number) < (batch.startOrdinal as number) ||
      (batch.endOrdinal as number) - (batch.startOrdinal as number) + 1 !== batch.recordCount
    ) {
      throw new OverlayCheckpointIntegrityError('checkpoint.batches do not tile the record set.')
    }
    expectedStart = (batch.endOrdinal as number) + 1
    if (typeof batch.finalBatch !== 'boolean') {
      throw new OverlayCheckpointIntegrityError('batch.finalBatch must be a boolean.')
    }
    if (batch.finalBatch !== (index === (checkpoint.batches as unknown[]).length - 1)) {
      throw new OverlayCheckpointIntegrityError(
        'batch.finalBatch must mark exactly the last batch.',
      )
    }
    if (
      typeof batch.requestMode !== 'string' ||
      !OVERLAY_REQUEST_MODES.includes(batch.requestMode as OverlayRequestMode)
    ) {
      throw new OverlayCheckpointIntegrityError('batch.requestMode is invalid.')
    }
    // One operation is planned in exactly one causal context. A checkpoint mixing fresh and
    // replay batches claims two different pasts at once and is refused.
    if (uniformMode === null) uniformMode = batch.requestMode
    else if (uniformMode !== batch.requestMode) {
      throw new OverlayCheckpointIntegrityError(
        'checkpoint.batches mix fresh and replay causal modes within one operation.',
      )
    }
    validateStage(batch.stage, `checkpoint.batches[${index}].stage`)
    const stage = batch.stage as OverlayStage
    if (stage.state === 'not_required') {
      if (batch.requestChecksum !== null) {
        throw new OverlayCheckpointIntegrityError(
          'batch.requestChecksum is present on a not-required stage.',
        )
      }
    } else {
      assertSha256Digest(batch.requestChecksum, 'batch.requestChecksum')
    }
    if (batch.acknowledgementChecksum !== null) {
      assertSha256Digest(batch.acknowledgementChecksum, 'batch.acknowledgementChecksum')
    }
    if (batch.reconciliationChecksum !== null) {
      assertSha256Digest(batch.reconciliationChecksum, 'batch.reconciliationChecksum')
    }
    if (batch.effects !== null) {
      const effects = asRecord(batch.effects, 'batch.effects')
      assertExactKeys(effects, ['applied', 'alreadyApplied'], 'batch.effects')
      assertNonNegativeInteger(effects.applied, 'batch.effects.applied')
      assertNonNegativeInteger(effects.alreadyApplied, 'batch.effects.alreadyApplied')
    }
    validateBatchStageInvariants(batch, `checkpoint.batches[${index}]`)
    validateStageTemporalCoherence(stage, temporalBounds, `checkpoint.batches[${index}]`)
    stageStates.push(stage.state)
    if (stage.state === 'acknowledged') {
      const effects = batch.effects as { applied: number; alreadyApplied: number }
      acknowledgedApplied += effects.applied
      acknowledgedAlready += effects.alreadyApplied
    }
  })
  if (expectedStart !== counts.recordCount + 1) {
    throw new OverlayCheckpointIntegrityError(
      'checkpoint.batches do not cover exactly the record count.',
    )
  }

  // Every batch of this operation is a required mutation stage: the plan tiles all 630
  // records into mutating batches and defines no optional stage. The vocabulary keeps
  // `not_required` closed and shape-checked, and this operation-level rule refuses it.
  if (stageStates.includes('not_required')) {
    throw new OverlayCheckpointIntegrityError(
      'checkpoint.batches claim a not-required stage; every overlay batch is a required ' +
        'mutation stage.',
    )
  }

  validatePhaseStageAgreement(checkpoint.phase as OverlayPhase, stageStates, 'checkpoint')

  // Adjacent-batch chronology: the engine is strictly sequential, so batch N+1 can only be
  // submitted after batch N acknowledged. Under the sequential stage-prefix model, every
  // progressed batch after index 0 sits behind an acknowledged predecessor, and its
  // submission moment cannot precede that predecessor's acknowledgement. Equality is valid —
  // an acknowledgement and the next submission may share a millisecond.
  for (let index = 1; index < checkpoint.batches.length; index += 1) {
    const current = checkpoint.batches[index] as unknown as OverlayCheckpointBatch
    const previous = checkpoint.batches[index - 1] as unknown as OverlayCheckpointBatch
    if (
      current.stage.submittedAt !== null &&
      previous.stage.state === 'acknowledged' &&
      previous.stage.acknowledgedAt !== null &&
      epochOf(current.stage.submittedAt) < epochOf(previous.stage.acknowledgedAt)
    ) {
      throw new OverlayCheckpointIntegrityError(
        `checkpoint.batches[${index}] was submitted before its predecessor acknowledged.`,
      )
    }
  }

  // Counters are derived, never asserted: they must equal the sum of acknowledged effects.
  if (counters.applied !== acknowledgedApplied || counters.alreadyApplied !== acknowledgedAlready) {
    throw new OverlayCheckpointIntegrityError(
      'checkpoint.counters do not equal the sum of acknowledged batch effects.',
    )
  }

  if (checkpoint.postObservationChecksum !== null) {
    assertSha256Digest(checkpoint.postObservationChecksum, 'checkpoint.postObservationChecksum')
  }
  if (checkpoint.phase === 'completed') {
    if (counters.applied + counters.alreadyApplied !== counts.recordCount) {
      throw new OverlayCheckpointIntegrityError(
        'checkpoint.phase is completed while counters do not cover the record count.',
      )
    }
    if (checkpoint.postObservationChecksum === null) {
      throw new OverlayCheckpointIntegrityError(
        'checkpoint.phase is completed without the read-only post-observation binding.',
      )
    }
  } else if (checkpoint.postObservationChecksum !== null) {
    throw new OverlayCheckpointIntegrityError(
      'checkpoint.postObservationChecksum is present before completion.',
    )
  }

  assertNoSensitiveOverlayMaterial(checkpoint)
}

/** The one causal mode a validated checkpoint's batches uniformly carry. */
export function overlayCheckpointMode(checkpoint: OverlayCheckpoint): OverlayRequestMode {
  const mode = checkpoint.batches[0]?.requestMode
  if (mode !== 'fresh' && mode !== 'replay') {
    throw new OverlayCheckpointIntegrityError('checkpoint.batches carry no causal mode.')
  }
  return mode
}

function isNodeError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)
}

async function closeQuietly(handle: FileHandle | null): Promise<void> {
  if (!handle) return
  await handle.close().catch(() => undefined)
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function writeTemporaryFile(targetPath: string, contents: string): Promise<string> {
  const directory = dirname(targetPath)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const temporaryPath = `${directory}/.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`
  let handle: FileHandle | null = null
  try {
    handle = await open(temporaryPath, 'wx', 0o600)
    await handle.writeFile(contents, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    return temporaryPath
  } catch (error) {
    await closeQuietly(handle)
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

async function replaceDurably(targetPath: string, contents: string): Promise<void> {
  const temporaryPath = await writeTemporaryFile(targetPath, contents)
  try {
    await rename(temporaryPath, targetPath)
    await syncDirectory(dirname(targetPath))
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

async function createImmutableDurably(targetPath: string, contents: string): Promise<void> {
  const temporaryPath = await writeTemporaryFile(targetPath, contents)
  try {
    await link(temporaryPath, targetPath)
    await unlink(temporaryPath)
    await syncDirectory(dirname(targetPath))
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    if (isNodeError(error, 'EEXIST')) throw new OverlayImmutableArtifactExistsError()
    throw error
  }
}

export function overlayCheckpointChecksum(checkpoint: OverlayCheckpoint): string {
  return sha256(canonicalJson(checkpoint))
}

function checkpointContents(checkpoint: OverlayCheckpoint): string {
  const envelope: OverlayCheckpointEnvelope = {
    checkpoint,
    checkpointChecksum: overlayCheckpointChecksum(checkpoint),
  }
  return `${JSON.stringify(envelope, null, 2)}\n`
}

export async function writeOverlayCheckpoint(
  path: string,
  checkpoint: OverlayCheckpoint,
): Promise<void> {
  validateOverlayCheckpoint(checkpoint)
  await replaceDurably(resolve(path), checkpointContents(checkpoint))
}

export async function readOverlayCheckpoint(path: string): Promise<OverlayCheckpoint> {
  let raw: string
  try {
    raw = await readFile(resolve(path), 'utf8')
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) {
      throw new OverlayCheckpointIntegrityError('Overlay checkpoint does not exist.')
    }
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new OverlayCheckpointIntegrityError('Overlay checkpoint is not valid JSON.')
  }
  const envelope = asRecord(parsed, 'checkpoint envelope')
  assertExactKeys(envelope, ['checkpoint', 'checkpointChecksum'], 'checkpoint envelope')
  validateOverlayCheckpoint(envelope.checkpoint)
  const checkpoint = envelope.checkpoint as OverlayCheckpoint
  if (envelope.checkpointChecksum !== overlayCheckpointChecksum(checkpoint)) {
    throw new OverlayCheckpointIntegrityError('Overlay checkpoint checksum does not match.')
  }
  return checkpoint
}

export function overlayReceiptChecksum(body: OverlayReceiptBody): string {
  return sha256(canonicalJson(body))
}

export function validateOverlayReceipt(value: unknown): asserts value is OverlayReceipt {
  const receipt = asRecord(value, 'receipt')
  assertExactKeys(
    receipt,
    [
      'schemaVersion',
      'engineVersion',
      'operationId',
      'outcome',
      'causalMode',
      'targetProjectRef',
      'targetUrl',
      'writerIdentity',
      'sourceIdentity',
      'curationReason',
      'artifactSha256',
      'projectionDigest',
      'reviewedAt',
      'completedAt',
      'counts',
      'counters',
      'batchRequestChecksums',
      'checkpointChecksum',
      'postObservationChecksum',
      'receiptChecksum',
    ],
    'receipt',
  )
  if (receipt.schemaVersion !== OVERLAY_RECEIPT_SCHEMA_VERSION) {
    throw new OverlayCheckpointIntegrityError('receipt.schemaVersion is not supported.')
  }
  if (receipt.engineVersion !== OVERLAY_ENGINE_VERSION) {
    throw new OverlayCheckpointIntegrityError('receipt.engineVersion is not supported.')
  }
  assertDeterministicUuid(receipt.operationId, 'receipt.operationId')
  if (
    receipt.outcome !== 'completed' &&
    receipt.outcome !== 'dry-run' &&
    receipt.outcome !== 'idempotent-replay'
  ) {
    throw new OverlayCheckpointIntegrityError('receipt.outcome is invalid.')
  }
  if (
    typeof receipt.causalMode !== 'string' ||
    !OVERLAY_REQUEST_MODES.includes(receipt.causalMode as OverlayRequestMode)
  ) {
    throw new OverlayCheckpointIntegrityError('receipt.causalMode is invalid.')
  }
  // The outcome IS the causal mode's completion vocabulary: a completed outcome describes a
  // fresh operation, an idempotent replay describes a replay, and a dry run plans the fresh
  // application. Any other pairing narrates a causal history that never happened.
  const requiredMode = receipt.outcome === 'idempotent-replay' ? 'replay' : 'fresh'
  if (receipt.causalMode !== requiredMode) {
    throw new OverlayCheckpointIntegrityError('receipt.causalMode contradicts the receipt outcome.')
  }

  // Authority fields are compared by identity, never by shape. A receipt naming any other
  // writer, source, reason, or destination is not a weaker receipt — it is not a receipt.
  if (receipt.writerIdentity !== OVERLAY_WRITER_IDENTITY) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.writerIdentity is not the reviewed writer identity.',
    )
  }
  if (receipt.sourceIdentity !== OVERLAY_SOURCE_IDENTITY) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.sourceIdentity is not the reviewed source identity.',
    )
  }
  if (receipt.curationReason !== OVERLAY_CURATION_REASON) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.curationReason is not the frozen operation reason.',
    )
  }
  assertSha256Digest(receipt.artifactSha256, 'receipt.artifactSha256')
  assertSha256Digest(receipt.projectionDigest, 'receipt.projectionDigest')
  assertTimestamp(receipt.reviewedAt, 'receipt.reviewedAt')
  assertTimestamp(receipt.completedAt, 'receipt.completedAt')
  assertCounts(receipt.counts, 'receipt.counts')
  assertPinnedCounts(receipt.counts as ReviewedSetCounts, 'receipt.counts')
  const counters = asRecord(receipt.counters, 'receipt.counters')
  assertExactKeys(counters, ['applied', 'alreadyApplied'], 'receipt.counters')
  assertNonNegativeInteger(counters.applied, 'receipt.counters.applied')
  assertNonNegativeInteger(counters.alreadyApplied, 'receipt.counters.alreadyApplied')
  if (!Array.isArray(receipt.batchRequestChecksums) || receipt.batchRequestChecksums.length === 0) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.batchRequestChecksums must be a non-empty array.',
    )
  }
  for (const checksum of receipt.batchRequestChecksums) {
    assertSha256Digest(checksum, 'receipt.batchRequestChecksums[]')
  }
  assertSha256Digest(receipt.checkpointChecksum, 'receipt.checkpointChecksum')

  const counts = receipt.counts as ReviewedSetCounts
  if (receipt.outcome === 'dry-run') {
    if (receipt.targetProjectRef !== null || receipt.targetUrl !== null) {
      throw new OverlayCheckpointIntegrityError('receipt: a dry run names no destination.')
    }
    if (counters.applied !== 0 || counters.alreadyApplied !== 0) {
      throw new OverlayCheckpointIntegrityError('receipt: a dry run has no effects.')
    }
    if (receipt.postObservationChecksum !== null) {
      throw new OverlayCheckpointIntegrityError('receipt: a dry run has no post-observation.')
    }
  } else {
    if (receipt.targetProjectRef !== APPROVED_PROJECT_REF) {
      throw new OverlayCheckpointIntegrityError(
        'receipt.targetProjectRef does not name the approved project exactly.',
      )
    }
    if (receipt.targetUrl !== APPROVED_PROJECT_URL) {
      throw new OverlayCheckpointIntegrityError(
        'receipt.targetUrl is not the canonical approved URL.',
      )
    }
    if (counters.applied + counters.alreadyApplied !== counts.recordCount) {
      throw new OverlayCheckpointIntegrityError(
        'receipt.counters do not cover the record count exactly.',
      )
    }
    if (
      receipt.outcome === 'idempotent-replay' &&
      (counters.applied !== 0 || counters.alreadyApplied !== counts.recordCount)
    ) {
      throw new OverlayCheckpointIntegrityError(
        'receipt: an idempotent replay applies nothing and re-observes everything.',
      )
    }
    if (
      receipt.outcome === 'completed' &&
      (counters.applied !== counts.recordCount || counters.alreadyApplied !== 0)
    ) {
      throw new OverlayCheckpointIntegrityError(
        'receipt: a completed fresh operation applies every record exactly once.',
      )
    }
    if (typeof receipt.postObservationChecksum !== 'string') {
      throw new OverlayCheckpointIntegrityError(
        'receipt: a remote outcome requires the post-observation binding.',
      )
    }
    assertSha256Digest(receipt.postObservationChecksum, 'receipt.postObservationChecksum')
  }

  const body = { ...(receipt as unknown as OverlayReceipt) } as Partial<OverlayReceipt>
  delete body.receiptChecksum
  if (receipt.receiptChecksum !== overlayReceiptChecksum(body as OverlayReceiptBody)) {
    throw new OverlayCheckpointIntegrityError('receipt.receiptChecksum does not match.')
  }
  assertNoSensitiveOverlayMaterial(receipt, 'receipt')
}

/**
 * The exact completed-receipt-to-checkpoint binding.
 *
 * A completed remote receipt is only ever the checkpoint's own completion restated: every
 * meaningful field must equal the completed checkpoint's value, the ordered batch checksum
 * sequence must be identical, the checkpoint checksum must be the checksum of THIS checkpoint,
 * and the post-observation binding must be the one the checkpoint completed under. A receipt
 * that is internally valid and self-checksummed but names a different checkpoint state is not
 * a weaker receipt — it is not this operation's receipt, and no CLI or engine boundary may
 * accept it through any smaller field subset.
 *
 * Dry-run receipts are never completed-operation authority and are refused here outright.
 */
export function validateOverlayReceiptAgainstCheckpoint(
  receiptValue: unknown,
  checkpointValue: unknown,
): asserts receiptValue is OverlayReceipt {
  validateOverlayReceipt(receiptValue)
  validateOverlayCheckpoint(checkpointValue)
  const receipt = receiptValue as OverlayReceipt
  const checkpoint = checkpointValue as OverlayCheckpoint

  if (receipt.outcome === 'dry-run') {
    throw new OverlayCheckpointIntegrityError(
      'receipt: a dry-run receipt is never completed-operation authority.',
    )
  }
  if (checkpoint.phase !== 'completed') {
    throw new OverlayCheckpointIntegrityError('receipt binding requires a completed checkpoint.')
  }
  if (receipt.operationId !== checkpoint.operationId) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.operationId does not name the checkpoint operation.',
    )
  }
  if (receipt.targetProjectRef !== checkpoint.targetProjectRef) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.targetProjectRef does not match the checkpoint destination.',
    )
  }
  if (receipt.artifactSha256 !== checkpoint.artifactSha256) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.artifactSha256 does not match the checkpoint.',
    )
  }
  if (receipt.projectionDigest !== checkpoint.projectionDigest) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.projectionDigest does not match the checkpoint.',
    )
  }
  if (receipt.curationReason !== checkpoint.curationReason) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.curationReason does not match the checkpoint.',
    )
  }
  if (receipt.reviewedAt !== checkpoint.reviewedAt) {
    throw new OverlayCheckpointIntegrityError('receipt.reviewedAt does not match the checkpoint.')
  }
  if (canonicalJson(receipt.counts) !== canonicalJson(checkpoint.counts)) {
    throw new OverlayCheckpointIntegrityError('receipt.counts do not match the checkpoint.')
  }
  if (
    receipt.counters.applied !== checkpoint.counters.applied ||
    receipt.counters.alreadyApplied !== checkpoint.counters.alreadyApplied
  ) {
    throw new OverlayCheckpointIntegrityError('receipt.counters do not match the checkpoint.')
  }
  if (receipt.causalMode !== overlayCheckpointMode(checkpoint)) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.causalMode does not match the checkpoint batches.',
    )
  }
  if (receipt.batchRequestChecksums.length !== checkpoint.batches.length) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.batchRequestChecksums do not cover the checkpoint batches.',
    )
  }
  checkpoint.batches.forEach((batch, index) => {
    if (receipt.batchRequestChecksums[index] !== batch.requestChecksum) {
      throw new OverlayCheckpointIntegrityError(
        'receipt.batchRequestChecksums do not equal the checkpoint request sequence exactly.',
      )
    }
  })
  if (receipt.checkpointChecksum !== overlayCheckpointChecksum(checkpoint)) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.checkpointChecksum is not the checksum of this completed checkpoint.',
    )
  }
  if (
    checkpoint.postObservationChecksum === null ||
    receipt.postObservationChecksum !== checkpoint.postObservationChecksum
  ) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.postObservationChecksum is not the checkpoint completion binding.',
    )
  }
  // The completion instant is canonical: the completed checkpoint's updatedAt IS the moment
  // the operation completed, and the receipt must carry exactly that value — byte-for-byte in
  // canonical Date.toISOString() form, so an earlier moment, a later moment, or an alternate
  // textual rendering of the same instant are all refused.
  if (
    !CANONICAL_TIMESTAMP_PATTERN.test(checkpoint.updatedAt) ||
    !CANONICAL_TIMESTAMP_PATTERN.test(receipt.completedAt) ||
    receipt.completedAt !== checkpoint.updatedAt
  ) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.completedAt is not exactly the canonical checkpoint completion instant.',
    )
  }
}

export async function writeOverlayReceiptImmutable(
  path: string,
  receipt: OverlayReceipt,
): Promise<void> {
  validateOverlayReceipt(receipt)
  await createImmutableDurably(resolve(path), `${JSON.stringify(receipt, null, 2)}\n`)
}

export async function readOverlayReceipt(path: string): Promise<OverlayReceipt> {
  let raw: string
  try {
    raw = await readFile(resolve(path), 'utf8')
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) {
      throw new OverlayCheckpointIntegrityError('Overlay receipt does not exist.')
    }
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new OverlayCheckpointIntegrityError('Overlay receipt is not valid JSON.')
  }
  validateOverlayReceipt(parsed)
  return parsed as OverlayReceipt
}

export interface OverlayLease {
  path: string
  release(): Promise<void>
}

/**
 * Hold an exclusive, fail-closed process lease next to a checkpoint for the entire mutating
 * CLI lifetime. A crash intentionally leaves the lease behind for explicit operator
 * inspection; it is never treated as stale or removed automatically.
 */
export async function acquireOverlayLease(checkpointPath: string): Promise<OverlayLease> {
  const leasePath = `${resolve(checkpointPath)}.operator-lock`
  await mkdir(dirname(leasePath), { recursive: true, mode: 0o700 })
  const contents = `${JSON.stringify({
    schemaVersion: OVERLAY_LEASE_SCHEMA_VERSION,
    nonce: randomUUID(),
    pid: process.pid,
    createdAt: new Date().toISOString(),
  })}\n`
  let handle: FileHandle | null = null
  let created = false
  try {
    handle = await open(leasePath, 'wx', 0o600)
    created = true
    await handle.writeFile(contents, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    await syncDirectory(dirname(leasePath))
  } catch (error) {
    await closeQuietly(handle)
    if (created) await unlink(leasePath).catch(() => undefined)
    if (isNodeError(error, 'EEXIST')) throw new OverlayLeaseExistsError()
    throw error
  }

  let released = false
  return {
    path: leasePath,
    async release() {
      if (released) return
      let current: string
      try {
        current = await readFile(leasePath, 'utf8')
      } catch {
        throw new OverlayCheckpointIntegrityError(
          'Overlay lease disappeared before the operator released it.',
        )
      }
      if (current !== contents) {
        throw new OverlayCheckpointIntegrityError(
          'Overlay lease changed ownership and will not be removed.',
        )
      }
      await unlink(leasePath)
      await syncDirectory(dirname(leasePath))
      released = true
    },
  }
}
