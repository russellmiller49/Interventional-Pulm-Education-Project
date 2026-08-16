import { randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, rename, unlink, type FileHandle } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

import {
  APPROVED_PROJECT_REF,
  CHECKPOINT_SCHEMA_VERSION,
  ENGINE_VERSION,
  MAPPING_VERSION,
  MAX_BATCH_COUNT,
  MAX_CONCURRENCY,
} from './constants'
import { assertSha256, canonicalJson, redact, sha256 } from './canonical'
import type { Checkpoint, CheckpointMutationStage } from './types'

interface CheckpointEnvelope {
  checkpoint: Checkpoint
  checkpointChecksum: string
}

export interface CheckpointStoreOptions {
  clock?: () => string
}

const pathQueues = new Map<string, Promise<void>>()

const CHECKPOINT_KEYS = [
  'schemaVersion',
  'engineVersion',
  'mappingVersion',
  'operationId',
  'mode',
  'targetProjectRef',
  'createdAt',
  'updatedAt',
  'sourceProjectionChecksum',
  'sourceRecordCount',
  'canaryManifestChecksum',
  'limits',
  'batchIdentity',
  'importBatchCreate',
  'finalization',
  'phase',
  'beforeArticleCount',
  'afterArticleCount',
  'counters',
  'batches',
] as const

const MUTATION_STAGE_STATES = new Set([
  'not_required',
  'prepared',
  'submitted',
  'acknowledged',
  'confirmed_failure',
  'ambiguous',
])

const CHECKPOINT_PHASES = new Set([
  'prepared',
  'running',
  'confirmed_failure',
  'needs_reconciliation',
  'completed',
])

const CREDENTIAL_VALUE_PATTERN =
  /(?:sb_(?:secret|publishable)_[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|bearer\s+\S+)/iu

export class CheckpointIntegrityError extends Error {
  readonly code = 'checkpoint_integrity_error'

  constructor(message = 'Checkpoint integrity validation failed.') {
    super(message)
    this.name = 'CheckpointIntegrityError'
  }
}

export class CheckpointNotFoundError extends Error {
  readonly code = 'checkpoint_not_found'

  constructor() {
    super('Checkpoint does not exist.')
    this.name = 'CheckpointNotFoundError'
  }
}

export class ImmutableArtifactExistsError extends Error {
  readonly code = 'immutable_artifact_exists'

  constructor() {
    super('The immutable artifact already exists and will not be overwritten.')
    this.name = 'ImmutableArtifactExistsError'
  }
}

export class CheckpointLeaseExistsError extends Error {
  readonly code = 'checkpoint_lease_exists'

  constructor() {
    super(
      'Another operator holds the checkpoint lease. Do not run concurrent mutation or resume processes.',
    )
    this.name = 'CheckpointLeaseExistsError'
  }
}

export interface CheckpointLease {
  path: string
  release(): Promise<void>
}

/**
 * Hold an exclusive, fail-closed process lease next to a checkpoint for the entire mutating CLI
 * lifetime. A crash intentionally leaves the lease behind for explicit operator inspection; it is
 * never treated as stale or removed automatically.
 */
export async function acquireCheckpointLease(checkpointPath: string): Promise<CheckpointLease> {
  const leasePath = `${resolve(checkpointPath)}.operator-lock`
  await mkdir(dirname(leasePath), { recursive: true, mode: 0o700 })
  const contents = `${JSON.stringify({
    schemaVersion: 'literature-production-ingest-lease/1.0.0',
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
    if (isNodeError(error, 'EEXIST')) throw new CheckpointLeaseExistsError()
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
        throw new CheckpointIntegrityError(
          'Checkpoint lease disappeared before the operator released it.',
        )
      }
      if (current !== contents) {
        throw new CheckpointIntegrityError(
          'Checkpoint lease changed ownership and will not be removed.',
        )
      }
      await unlink(leasePath)
      await syncDirectory(dirname(leasePath))
      released = true
    },
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CheckpointIntegrityError(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new CheckpointIntegrityError(`${label} contains unexpected or missing fields.`)
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CheckpointIntegrityError(`${label} must be a non-empty string.`)
  }
}

function assertTimestamp(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label)
  if (!Number.isFinite(Date.parse(value))) {
    throw new CheckpointIntegrityError(`${label} must be an ISO-compatible timestamp.`)
  }
}

function assertNullableTimestamp(value: unknown, label: string) {
  if (value !== null) assertTimestamp(value, label)
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new CheckpointIntegrityError(`${label} must be a non-negative integer.`)
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new CheckpointIntegrityError(`${label} must be a positive integer.`)
  }
}

function assertNullableNonNegativeInteger(value: unknown, label: string) {
  if (value !== null) assertNonNegativeInteger(value, label)
}

function assertNullableSha256(value: unknown, label: string) {
  if (value === null) return
  try {
    assertSha256(value, label)
  } catch {
    throw new CheckpointIntegrityError(`${label} must be null or a lowercase SHA-256 digest.`)
  }
}

function assertNoSensitiveMaterial(value: unknown, label = 'checkpoint') {
  if (typeof value === 'string') {
    if (CREDENTIAL_VALUE_PATTERN.test(value) || redact(value) !== value) {
      throw new CheckpointIntegrityError(`${label} contains credential-shaped material.`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoSensitiveMaterial(child, `${label}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/^(?:pmid|pmids|canaryPmids|firstPmid|lastPmid)$/iu.test(key)) {
      throw new CheckpointIntegrityError('Checkpoints must not persist PMID fields.')
    }
    if (isSensitiveKey(key)) {
      throw new CheckpointIntegrityError('Checkpoints must not persist secrets or request bodies.')
    }
    assertNoSensitiveMaterial(child, `${label}.${key}`)
  }
}

function validateMutationStage(value: unknown, label: string) {
  const stage = asRecord(value, label)
  assertExactKeys(
    stage,
    ['state', 'requestChecksum', 'submittedAt', 'acknowledgedAt', 'failureCode'],
    label,
  )
  if (typeof stage.state !== 'string' || !MUTATION_STAGE_STATES.has(stage.state)) {
    throw new CheckpointIntegrityError(`${label}.state is invalid.`)
  }
  assertNullableSha256(stage.requestChecksum, `${label}.requestChecksum`)
  assertNullableTimestamp(stage.submittedAt, `${label}.submittedAt`)
  assertNullableTimestamp(stage.acknowledgedAt, `${label}.acknowledgedAt`)
  if (stage.failureCode !== null) {
    if (
      typeof stage.failureCode !== 'string' ||
      !/^[a-z][a-z0-9_.:-]{0,127}$/u.test(stage.failureCode) ||
      /\d{6,12}/u.test(stage.failureCode)
    ) {
      throw new CheckpointIntegrityError(`${label}.failureCode must be a redacted stable code.`)
    }
  }
}

function validateCheckpoint(value: unknown): asserts value is Checkpoint {
  const checkpoint = asRecord(value, 'checkpoint')
  assertExactKeys(checkpoint, CHECKPOINT_KEYS, 'checkpoint')
  assertNoSensitiveMaterial(checkpoint)

  if (checkpoint.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
    throw new CheckpointIntegrityError('Checkpoint schema version is unsupported.')
  }
  if (
    checkpoint.engineVersion !== ENGINE_VERSION ||
    checkpoint.mappingVersion !== MAPPING_VERSION
  ) {
    throw new CheckpointIntegrityError('Checkpoint engine or mapping version does not match.')
  }
  assertNonEmptyString(checkpoint.operationId, 'checkpoint.operationId')
  if (checkpoint.mode !== 'canary' && checkpoint.mode !== 'full') {
    throw new CheckpointIntegrityError('checkpoint.mode is invalid.')
  }
  if (checkpoint.targetProjectRef !== APPROVED_PROJECT_REF) {
    throw new CheckpointIntegrityError('Checkpoint target project is not approved.')
  }
  assertTimestamp(checkpoint.createdAt, 'checkpoint.createdAt')
  assertTimestamp(checkpoint.updatedAt, 'checkpoint.updatedAt')
  try {
    assertSha256(checkpoint.sourceProjectionChecksum, 'checkpoint.sourceProjectionChecksum')
  } catch {
    throw new CheckpointIntegrityError('checkpoint.sourceProjectionChecksum is invalid.')
  }
  assertNonNegativeInteger(checkpoint.sourceRecordCount, 'checkpoint.sourceRecordCount')
  assertNullableSha256(checkpoint.canaryManifestChecksum, 'checkpoint.canaryManifestChecksum')

  const limits = asRecord(checkpoint.limits, 'checkpoint.limits')
  assertExactKeys(
    limits,
    ['recordBatchLimit', 'byteBatchLimit', 'concurrency'],
    'checkpoint.limits',
  )
  assertPositiveInteger(limits.recordBatchLimit, 'checkpoint.limits.recordBatchLimit')
  assertPositiveInteger(limits.byteBatchLimit, 'checkpoint.limits.byteBatchLimit')
  assertPositiveInteger(limits.concurrency, 'checkpoint.limits.concurrency')
  if ((limits.concurrency as number) > MAX_CONCURRENCY) {
    throw new CheckpointIntegrityError('checkpoint.limits.concurrency exceeds the engine bound.')
  }

  const identity = asRecord(checkpoint.batchIdentity, 'checkpoint.batchIdentity')
  assertExactKeys(
    identity,
    [
      'sourceFilename',
      'sourceFileSha256',
      'manifestVersion',
      'queryRegistryVersion',
      'sourceKind',
      'sourceId',
      'queryId',
      'recordLimit',
    ],
    'checkpoint.batchIdentity',
  )
  for (const field of ['sourceFilename', 'manifestVersion', 'queryRegistryVersion'] as const) {
    assertNonEmptyString(identity[field], `checkpoint.batchIdentity.${field}`)
  }
  try {
    assertSha256(identity.sourceFileSha256, 'checkpoint.batchIdentity.sourceFileSha256')
  } catch {
    throw new CheckpointIntegrityError('checkpoint.batchIdentity.sourceFileSha256 is invalid.')
  }
  if (
    identity.sourceKind !== 'unmapped' ||
    identity.sourceId !== 'fixed-local-bibliographic-corpus' ||
    (identity.queryId !== 'production-canary' && identity.queryId !== 'production-full')
  ) {
    throw new CheckpointIntegrityError('Checkpoint batch identity is outside the production scope.')
  }
  assertNullableNonNegativeInteger(identity.recordLimit, 'checkpoint.batchIdentity.recordLimit')
  if (
    (checkpoint.mode === 'canary' &&
      (checkpoint.canaryManifestChecksum === null ||
        identity.queryId !== 'production-canary' ||
        identity.recordLimit !== checkpoint.sourceRecordCount)) ||
    (checkpoint.mode === 'full' &&
      (checkpoint.canaryManifestChecksum !== null ||
        identity.queryId !== 'production-full' ||
        identity.recordLimit !== null))
  ) {
    throw new CheckpointIntegrityError('Checkpoint mode-specific identity fields do not agree.')
  }

  validateMutationStage(checkpoint.importBatchCreate, 'checkpoint.importBatchCreate')
  validateMutationStage(checkpoint.finalization, 'checkpoint.finalization')
  if (typeof checkpoint.phase !== 'string' || !CHECKPOINT_PHASES.has(checkpoint.phase)) {
    throw new CheckpointIntegrityError('checkpoint.phase is invalid.')
  }
  assertNullableNonNegativeInteger(checkpoint.beforeArticleCount, 'checkpoint.beforeArticleCount')
  assertNullableNonNegativeInteger(checkpoint.afterArticleCount, 'checkpoint.afterArticleCount')

  const counters = asRecord(checkpoint.counters, 'checkpoint.counters')
  assertExactKeys(
    counters,
    ['recordsRead', 'uniquePmids', 'duplicateOccurrences', 'inserted', 'updated', 'unchanged'],
    'checkpoint.counters',
  )
  for (const [key, counter] of Object.entries(counters)) {
    assertNonNegativeInteger(counter, `checkpoint.counters.${key}`)
  }

  if (!Array.isArray(checkpoint.batches)) {
    throw new CheckpointIntegrityError('checkpoint.batches must be an array.')
  }
  if (checkpoint.batches.length > MAX_BATCH_COUNT) {
    throw new CheckpointIntegrityError('checkpoint.batches exceeds the durable batch bound.')
  }
  const indexes = new Set<number>()
  let previousEndOrdinal = 0
  checkpoint.batches.forEach((candidate, position) => {
    const batch = asRecord(candidate, `checkpoint.batches[${position}]`)
    assertExactKeys(
      batch,
      [
        'index',
        'startOrdinal',
        'endOrdinal',
        'recordCount',
        'articleBodyBytes',
        'journalBodyBytes',
        'provenanceBodyBytes',
        'checksum',
        'effects',
        'stages',
      ],
      `checkpoint.batches[${position}]`,
    )
    for (const field of [
      'index',
      'articleBodyBytes',
      'journalBodyBytes',
      'provenanceBodyBytes',
    ] as const) {
      assertNonNegativeInteger(batch[field], `checkpoint.batches[${position}].${field}`)
    }
    assertPositiveInteger(batch.startOrdinal, `checkpoint.batches[${position}].startOrdinal`)
    assertPositiveInteger(batch.endOrdinal, `checkpoint.batches[${position}].endOrdinal`)
    assertPositiveInteger(batch.recordCount, `checkpoint.batches[${position}].recordCount`)
    if (
      batch.index !== position ||
      batch.startOrdinal !== previousEndOrdinal + 1 ||
      batch.endOrdinal !== (batch.startOrdinal as number) + (batch.recordCount as number) - 1
    ) {
      throw new CheckpointIntegrityError('Checkpoint batch sequence or ordinal range is invalid.')
    }
    previousEndOrdinal = batch.endOrdinal as number
    if (indexes.has(batch.index as number)) {
      throw new CheckpointIntegrityError('Checkpoint batch indexes must be unique.')
    }
    indexes.add(batch.index as number)
    try {
      assertSha256(batch.checksum, `checkpoint.batches[${position}].checksum`)
    } catch {
      throw new CheckpointIntegrityError(`checkpoint.batches[${position}].checksum is invalid.`)
    }
    if (batch.effects !== null) {
      const effects = asRecord(batch.effects, `checkpoint.batches[${position}].effects`)
      assertExactKeys(
        effects,
        ['inserted', 'updated', 'unchanged'],
        `checkpoint.batches[${position}].effects`,
      )
      for (const [key, effect] of Object.entries(effects)) {
        assertNonNegativeInteger(effect, `checkpoint.batches[${position}].effects.${key}`)
      }
      if (
        (effects.inserted as number) +
          (effects.updated as number) +
          (effects.unchanged as number) !==
        batch.recordCount
      ) {
        throw new CheckpointIntegrityError('Checkpoint batch effects must equal its record count.')
      }
    }
    const stages = asRecord(batch.stages, `checkpoint.batches[${position}].stages`)
    assertExactKeys(
      stages,
      ['journals', 'articles', 'provenance'],
      `checkpoint.batches[${position}].stages`,
    )
    validateMutationStage(stages.journals, `checkpoint.batches[${position}].stages.journals`)
    validateMutationStage(stages.articles, `checkpoint.batches[${position}].stages.articles`)
    validateMutationStage(stages.provenance, `checkpoint.batches[${position}].stages.provenance`)
  })
}

function isNodeError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)
}

async function closeQuietly(handle: FileHandle | null) {
  if (!handle) return
  await handle.close().catch(() => undefined)
}

async function syncDirectory(directory: string) {
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

async function replaceDurably(targetPath: string, contents: string) {
  const temporaryPath = await writeTemporaryFile(targetPath, contents)
  try {
    await rename(temporaryPath, targetPath)
    await syncDirectory(dirname(targetPath))
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

async function createImmutableDurably(targetPath: string, contents: string) {
  const temporaryPath = await writeTemporaryFile(targetPath, contents)
  try {
    await link(temporaryPath, targetPath)
    await unlink(temporaryPath)
    await syncDirectory(dirname(targetPath))
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    if (isNodeError(error, 'EEXIST')) throw new ImmutableArtifactExistsError()
    throw error
  }
}

function serializeForPath<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = pathQueues.get(filePath) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(operation)
  const tail = run.then(
    () => undefined,
    () => undefined,
  )
  pathQueues.set(filePath, tail)
  return run.finally(() => {
    if (pathQueues.get(filePath) === tail) pathQueues.delete(filePath)
  })
}

export function checkpointChecksum(checkpoint: Checkpoint): string {
  return sha256(canonicalJson(checkpoint))
}

function checkpointEnvelope(checkpoint: Checkpoint): CheckpointEnvelope {
  return {
    checkpoint,
    checkpointChecksum: checkpointChecksum(checkpoint),
  }
}

function checkpointContents(checkpoint: Checkpoint): string {
  return `${JSON.stringify(checkpointEnvelope(checkpoint), null, 2)}\n`
}

function assertImmutableIdentity(before: Checkpoint, after: Checkpoint) {
  const immutableBefore = {
    schemaVersion: before.schemaVersion,
    engineVersion: before.engineVersion,
    mappingVersion: before.mappingVersion,
    operationId: before.operationId,
    mode: before.mode,
    targetProjectRef: before.targetProjectRef,
    createdAt: before.createdAt,
    sourceProjectionChecksum: before.sourceProjectionChecksum,
    sourceRecordCount: before.sourceRecordCount,
    canaryManifestChecksum: before.canaryManifestChecksum,
    limits: before.limits,
    batchIdentity: before.batchIdentity,
  }
  const immutableAfter = {
    schemaVersion: after.schemaVersion,
    engineVersion: after.engineVersion,
    mappingVersion: after.mappingVersion,
    operationId: after.operationId,
    mode: after.mode,
    targetProjectRef: after.targetProjectRef,
    createdAt: after.createdAt,
    sourceProjectionChecksum: after.sourceProjectionChecksum,
    sourceRecordCount: after.sourceRecordCount,
    canaryManifestChecksum: after.canaryManifestChecksum,
    limits: after.limits,
    batchIdentity: after.batchIdentity,
  }
  if (canonicalJson(immutableBefore) !== canonicalJson(immutableAfter)) {
    throw new CheckpointIntegrityError('Checkpoint immutable identity fields cannot change.')
  }
}

export class CheckpointStore {
  readonly path: string
  private readonly clock: () => string
  private cached: Checkpoint | null = null

  constructor(filePath: string, options: CheckpointStoreOptions = {}) {
    this.path = resolve(filePath)
    this.clock = options.clock ?? (() => new Date().toISOString())
  }

  current(): Checkpoint {
    if (!this.cached) throw new CheckpointNotFoundError()
    return clone(this.cached)
  }

  async create(checkpoint: Checkpoint): Promise<Checkpoint> {
    return serializeForPath(this.path, async () => {
      validateCheckpoint(checkpoint)
      const stored = clone(checkpoint)
      await createImmutableDurably(this.path, checkpointContents(stored))
      this.cached = stored
      return clone(stored)
    })
  }

  async load(): Promise<Checkpoint> {
    return serializeForPath(this.path, async () => this.loadUnlocked())
  }

  async loadIfExists(): Promise<Checkpoint | null> {
    try {
      return await this.load()
    } catch (error) {
      if (error instanceof CheckpointNotFoundError) return null
      throw error
    }
  }

  async update(
    updater: (current: Checkpoint) => Checkpoint | void | Promise<Checkpoint | void>,
  ): Promise<Checkpoint> {
    return serializeForPath(this.path, async () => {
      const current = await this.loadUnlocked()
      const draft = clone(current)
      const result = await updater(draft)
      const proposed = result ?? draft
      const next = clone({ ...proposed, updatedAt: this.clock() })
      validateCheckpoint(next)
      assertImmutableIdentity(current, next)
      await replaceDurably(this.path, checkpointContents(next))
      this.cached = next
      return clone(next)
    })
  }

  private async loadUnlocked(): Promise<Checkpoint> {
    let raw: string
    try {
      raw = await readFile(this.path, 'utf8')
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) throw new CheckpointNotFoundError()
      throw error
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      throw new CheckpointIntegrityError('Checkpoint is not valid JSON.')
    }
    const envelope = asRecord(parsed, 'checkpoint envelope')
    assertExactKeys(envelope, ['checkpoint', 'checkpointChecksum'], 'checkpoint envelope')
    try {
      assertSha256(envelope.checkpointChecksum, 'checkpoint envelope checksum')
    } catch {
      throw new CheckpointIntegrityError('Checkpoint envelope checksum is invalid.')
    }
    validateCheckpoint(envelope.checkpoint)
    if (checkpointChecksum(envelope.checkpoint) !== envelope.checkpointChecksum) {
      throw new CheckpointIntegrityError('Checkpoint checksum does not match its contents.')
    }
    const checkpoint = clone(envelope.checkpoint)
    this.cached = checkpoint
    return clone(checkpoint)
  }
}

export function receiptChecksum(receipt: object): string {
  const body = { ...(receipt as Record<string, unknown>) }
  delete body.receiptChecksum
  return sha256(canonicalJson(body))
}

function assertReceiptSafe(receipt: object) {
  const record = asRecord(receipt, 'receipt')
  assertNoSensitiveMaterialInReceipt(record)
  try {
    assertSha256(record.receiptChecksum, 'receipt.receiptChecksum')
  } catch {
    throw new CheckpointIntegrityError('Receipt checksum is invalid.')
  }
  if (receiptChecksum(record) !== record.receiptChecksum) {
    throw new CheckpointIntegrityError('Receipt checksum does not match its contents.')
  }
}

function assertNoSensitiveMaterialInReceipt(value: unknown, label = 'receipt') {
  if (typeof value === 'string') {
    if (CREDENTIAL_VALUE_PATTERN.test(value) || redact(value) !== value) {
      throw new CheckpointIntegrityError(`${label} contains credential-shaped material.`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoSensitiveMaterialInReceipt(child, `${label}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      throw new CheckpointIntegrityError('Receipts must not persist secrets or request bodies.')
    }
    assertNoSensitiveMaterialInReceipt(child, `${label}.${key}`)
  }
}

export async function writeReceiptImmutable(filePath: string, receipt: object): Promise<string> {
  const resolvedPath = resolve(filePath)
  assertReceiptSafe(receipt)
  await serializeForPath(resolvedPath, () =>
    createImmutableDurably(resolvedPath, `${JSON.stringify(receipt, null, 2)}\n`),
  )
  return resolvedPath
}

export function redactedMutationStage(
  state: CheckpointMutationStage['state'],
  requestChecksum: string | null,
  values: Partial<Omit<CheckpointMutationStage, 'state' | 'requestChecksum'>> = {},
): CheckpointMutationStage {
  return {
    state,
    requestChecksum,
    submittedAt: values.submittedAt ?? null,
    acknowledgedAt: values.acknowledgedAt ?? null,
    failureCode: values.failureCode ?? null,
  }
}
