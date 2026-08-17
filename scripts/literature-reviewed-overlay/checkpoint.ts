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
  OVERLAY_CHECKPOINT_SCHEMA_VERSION,
  OVERLAY_ENGINE_VERSION,
  OVERLAY_LEASE_SCHEMA_VERSION,
  OVERLAY_MAX_RECORD_BATCH_LIMIT,
  OVERLAY_RECEIPT_SCHEMA_VERSION,
} from './constants'
import { assertDeterministicUuid } from './identity'
import type { ReviewedSetCounts } from './reviewed-set'

export type OverlayStageState =
  | 'prepared'
  | 'submitted'
  | 'acknowledged'
  | 'confirmed_failure'
  | 'ambiguous'

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
  requestChecksum: string
  stage: OverlayStage
  /** Canonical checksum of the exact acknowledgement body, recorded on acknowledgement. */
  acknowledgementChecksum: string | null
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
  counts: ReviewedSetCounts
  limits: { recordBatchLimit: number }
  batches: OverlayCheckpointBatch[]
  phase: OverlayPhase
  counters: { applied: number; alreadyApplied: number }
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
  targetProjectRef: string | null
  targetUrl: string | null
  writerIdentity: string
  sourceIdentity: string
  artifactSha256: string
  projectionDigest: string
  reviewedAt: string
  completedAt: string
  counts: ReviewedSetCounts
  counters: { applied: number; alreadyApplied: number }
  batchRequestChecksums: string[]
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
      'counts',
      'limits',
      'batches',
      'phase',
      'counters',
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
  assertSha256Digest(checkpoint.artifactSha256, 'checkpoint.artifactSha256')
  assertSha256Digest(checkpoint.projectionDigest, 'checkpoint.projectionDigest')
  assertTimestamp(checkpoint.reviewedAt, 'checkpoint.reviewedAt')
  assertCounts(checkpoint.counts, 'checkpoint.counts')

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
  const counts = checkpoint.counts as ReviewedSetCounts
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
        'requestChecksum',
        'stage',
        'acknowledgementChecksum',
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
    assertSha256Digest(batch.requestChecksum, 'batch.requestChecksum')
    validateStage(batch.stage, `checkpoint.batches[${index}].stage`)
    if (batch.acknowledgementChecksum !== null) {
      assertSha256Digest(batch.acknowledgementChecksum, 'batch.acknowledgementChecksum')
    }
    if (batch.effects !== null) {
      const effects = asRecord(batch.effects, 'batch.effects')
      assertExactKeys(effects, ['applied', 'alreadyApplied'], 'batch.effects')
      assertNonNegativeInteger(effects.applied, 'batch.effects.applied')
      assertNonNegativeInteger(effects.alreadyApplied, 'batch.effects.alreadyApplied')
    }
  })
  if (expectedStart !== counts.recordCount + 1) {
    throw new OverlayCheckpointIntegrityError(
      'checkpoint.batches do not cover exactly the record count.',
    )
  }

  assertNoSensitiveOverlayMaterial(checkpoint)
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
      'targetProjectRef',
      'targetUrl',
      'writerIdentity',
      'sourceIdentity',
      'artifactSha256',
      'projectionDigest',
      'reviewedAt',
      'completedAt',
      'counts',
      'counters',
      'batchRequestChecksums',
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
  if (receipt.targetProjectRef !== null && receipt.targetProjectRef !== APPROVED_PROJECT_REF) {
    throw new OverlayCheckpointIntegrityError(
      'receipt.targetProjectRef does not name the approved project.',
    )
  }
  assertNonEmptyString(receipt.writerIdentity, 'receipt.writerIdentity')
  assertNonEmptyString(receipt.sourceIdentity, 'receipt.sourceIdentity')
  assertSha256Digest(receipt.artifactSha256, 'receipt.artifactSha256')
  assertSha256Digest(receipt.projectionDigest, 'receipt.projectionDigest')
  assertTimestamp(receipt.reviewedAt, 'receipt.reviewedAt')
  assertTimestamp(receipt.completedAt, 'receipt.completedAt')
  assertCounts(receipt.counts, 'receipt.counts')
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
  const { receiptChecksum: _ignored, ...body } = receipt as unknown as OverlayReceipt
  if (receipt.receiptChecksum !== overlayReceiptChecksum(body)) {
    throw new OverlayCheckpointIntegrityError('receipt.receiptChecksum does not match.')
  }
  assertNoSensitiveOverlayMaterial(receipt, 'receipt')
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
