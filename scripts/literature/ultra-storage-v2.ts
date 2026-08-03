import { createHash, randomUUID } from 'node:crypto'
import {
  chmod,
  link,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  type FileHandle,
} from 'node:fs/promises'
import { hostname } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

export const ULTRA_STORAGE_V2_VERSION = '2.0.0' as const
export const ULTRA_CHECKPOINT_VERSION = '1.0.0' as const
export const ULTRA_EVENT_HEAD_VERSION = '1.0.0' as const
export const ULTRA_WRITER_LOCK_VERSION = '1.0.0' as const
export const GENESIS_EVENT_HASH = '0'.repeat(64)
export const MAX_EVENT_BYTES = 64 * 1024
export const ULTRA_STORAGE_EVENT_TYPES = [
  'migration_recorded',
  'phase_registered',
  'phase_created',
  'phase_started',
  'phase_completed',
  'phase_failed',
  'attempt_started',
  'attempt_validated',
  'attempt_invalid',
  'worker_failed',
  'dispatch_blocked',
  'allocation_changed',
  'chunk_completed',
  'chunk_failed',
  'checkpoint_written',
  'assignment_created',
  'lease_acquired',
  'lease_released',
] as const
export type UltraStorageEventType = (typeof ULTRA_STORAGE_EVENT_TYPES)[number]

const STATE_DIRECTORY_NAME = 'state-v2'
const RUN_DEFINITION_FILENAME = 'run-definition.json'
const EVENT_LOG_FILENAME = 'events.jsonl'
const EVENT_HEAD_FILENAME = 'event-head.json'
const CHECKPOINT_DIRECTORY_NAME = 'checkpoints'
const PROGRESS_SUMMARY_FILENAME = 'progress-summary.json'
const WRITER_LOCK_FILENAME = '.coordinator-writer.lock'
const RECOVERED_LOCK_DIRECTORY_NAME = 'recovered-writer-locks'
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]{1,79}$/u
const ULTRA_STORAGE_EVENT_TYPE_SET = new Set<string>(ULTRA_STORAGE_EVENT_TYPES)
const CHECKPOINT_FILENAME_PATTERN = /^checkpoint-(\d{12})-([a-f0-9]{16})-([a-f0-9]{16})\.json\.gz$/u
const CHECKPOINT_TEMP_FILENAME_PATTERN =
  /^\.checkpoint-\d{12}-[a-f0-9]{16}-[a-f0-9]{16}\.json\.gz\.[a-f0-9-]{36}\.tmp$/u

export interface UltraPacketDefinitionV2 {
  chunkId: string
  phaseId: string
  packetPath: string
  packetSha256: string
  [key: string]: unknown
}

export interface UltraRunDefinitionV2 {
  runId: string
  createdAt: string
  corpusSnapshot: Record<string, unknown>
  phaseConfiguration: unknown
  packetInventory: readonly UltraPacketDefinitionV2[]
  screeningPolicyVersion: string
  [key: string]: unknown
}

interface RunDefinitionEnvelope<Definition extends UltraRunDefinitionV2> {
  storageVersion: typeof ULTRA_STORAGE_V2_VERSION
  definitionSha256: string
  definition: Definition
}

export interface UltraStorageEventInput {
  type: UltraStorageEventType
  recordedAt?: string
  payload: unknown
}

export interface UltraStorageEvent {
  storageVersion: typeof ULTRA_STORAGE_V2_VERSION
  sequence: number
  previousEventHash: string
  eventHash: string
  type: UltraStorageEventType
  recordedAt: string
  payload: unknown
}

interface EventHashContent {
  storageVersion: typeof ULTRA_STORAGE_V2_VERSION
  sequence: number
  previousEventHash: string
  type: UltraStorageEventType
  recordedAt: string
  payload: unknown
}

export interface UltraStorageHead {
  sequence: number
  eventHash: string
  eventLogBytes: number
}

export interface UltraEventHeadAnchor extends UltraStorageHead {
  storageVersion: typeof ULTRA_STORAGE_V2_VERSION
  headVersion: typeof ULTRA_EVENT_HEAD_VERSION
  headSha256: string
}

export interface UltraEventAppendReceipt {
  event: UltraStorageEvent
  bytesWritten: number
}

export type UltraCheckpointCadenceReason = 'event_interval' | 'clean_shutdown'

export interface UltraCheckpointCadenceOptions {
  eventInterval: number
  checkpointOnCleanShutdown?: boolean
  lastCheckpointSequence?: number
}

export interface UltraCheckpointEnvelope<State> {
  storageVersion: typeof ULTRA_STORAGE_V2_VERSION
  checkpointVersion: typeof ULTRA_CHECKPOINT_VERSION
  createdAt: string
  runDefinitionSha256: string
  sequence: number
  eventHash: string
  stateSha256: string
  state: State
}

export interface UltraProgressSummary<Projection> {
  storageVersion: typeof ULTRA_STORAGE_V2_VERSION
  canonical: false
  notice: string
  generatedAt: string
  basedOnEventSequence: number
  basedOnEventHash: string
  projection: Projection
}

export interface CoordinatorWriterLockMetadata {
  storageVersion: typeof ULTRA_STORAGE_V2_VERSION
  lockVersion: typeof ULTRA_WRITER_LOCK_VERSION
  token: string
  ownerId: string
  processId: number
  host: string
  acquiredAt: string
}

export interface UltraStorageV2Layout {
  runRoot: string
  stateDirectory: string
  runDefinitionPath: string
  eventLogPath: string
  eventHeadPath: string
  checkpointDirectory: string
  progressSummaryPath: string
  writerLockPath: string
  recoveredLockDirectory: string
}

export interface ReconstructedUltraState<State> {
  state: State
  events: UltraStorageEvent[]
  head: UltraStorageHead
  checkpointPath: string | null
  checkpointSequence: number
}

export class UltraStorageV2Error extends Error {
  readonly code: string
  readonly details: Readonly<Record<string, unknown>>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'UltraStorageV2Error'
    this.code = code
    this.details = Object.freeze({ ...details })
  }
}

export class UltraEventLogIntegrityError extends UltraStorageV2Error {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, details)
    this.name = 'UltraEventLogIntegrityError'
  }
}

function sha256Text(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizeJson(value: unknown, path = '$'): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new UltraStorageV2Error(
        'non_json_value',
        `Non-finite number at ${path} cannot be stored as canonical JSON.`,
        { path },
      )
    }
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeJson(item, `${path}[${index}]`))
  }
  if (!isPlainObject(value)) {
    throw new UltraStorageV2Error(
      'non_json_value',
      `Value at ${path} is not a plain JSON object.`,
      { path },
    )
  }

  const normalized: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort(compareCodeUnits)) {
    const item = value[key]
    if (item === undefined) {
      throw new UltraStorageV2Error(
        'non_json_value',
        `Undefined value at ${path}.${key} cannot be stored as canonical JSON.`,
        { path: `${path}.${key}` },
      )
    }
    normalized[key] = normalizeJson(item, `${path}.${key}`)
  }
  return normalized
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(normalizeJson(value))
}

function parseJsonObject(raw: string, label: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (error) {
    throw new UltraStorageV2Error('malformed_json', `${label} is not valid JSON.`, {
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  if (!isPlainObject(parsed)) {
    throw new UltraStorageV2Error('invalid_json_shape', `${label} must be a JSON object.`)
  }
  return parsed
}

function requireNonemptyString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new UltraStorageV2Error('invalid_schema', `${label} must be a non-empty string.`)
  }
  return value
}

function requireSha256(value: unknown, label: string) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new UltraStorageV2Error('invalid_schema', `${label} must be a lowercase SHA-256 hash.`)
  }
  return value
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
) {
  const actual = Object.keys(value).sort(compareCodeUnits)
  const expected = [...expectedKeys].sort(compareCodeUnits)
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new UltraStorageV2Error('invalid_schema', `${label} has unexpected or missing fields.`, {
      actual,
      expected,
    })
  }
}

function validateRunDefinition(value: unknown): asserts value is UltraRunDefinitionV2 {
  if (!isPlainObject(value)) {
    throw new UltraStorageV2Error('invalid_run_definition', 'Run definition must be an object.')
  }
  requireNonemptyString(value.runId, 'runDefinition.runId')
  requireNonemptyString(value.createdAt, 'runDefinition.createdAt')
  requireNonemptyString(value.screeningPolicyVersion, 'runDefinition.screeningPolicyVersion')
  if (!isPlainObject(value.corpusSnapshot)) {
    throw new UltraStorageV2Error(
      'invalid_run_definition',
      'runDefinition.corpusSnapshot must be an object.',
    )
  }
  normalizeJson(value.phaseConfiguration, '$.phaseConfiguration')
  if (!Array.isArray(value.packetInventory)) {
    throw new UltraStorageV2Error(
      'invalid_run_definition',
      'runDefinition.packetInventory must be an array.',
    )
  }

  const chunkIds = new Set<string>()
  for (const [index, packet] of value.packetInventory.entries()) {
    if (!isPlainObject(packet)) {
      throw new UltraStorageV2Error(
        'invalid_run_definition',
        `runDefinition.packetInventory[${index}] must be an object.`,
      )
    }
    const chunkId = requireNonemptyString(packet.chunkId, `packetInventory[${index}].chunkId`)
    requireNonemptyString(packet.phaseId, `packetInventory[${index}].phaseId`)
    requireNonemptyString(packet.packetPath, `packetInventory[${index}].packetPath`)
    requireSha256(packet.packetSha256, `packetInventory[${index}].packetSha256`)
    if (chunkIds.has(chunkId)) {
      throw new UltraStorageV2Error(
        'duplicate_packet',
        `Run definition contains duplicate chunk ID ${chunkId}.`,
        { chunkId },
      )
    }
    chunkIds.add(chunkId)
  }
  normalizeJson(value, '$')
}

function eventHashContent(event: Omit<UltraStorageEvent, 'eventHash'>): EventHashContent {
  return {
    storageVersion: event.storageVersion,
    sequence: event.sequence,
    previousEventHash: event.previousEventHash,
    type: event.type,
    recordedAt: event.recordedAt,
    payload: event.payload,
  }
}

function hashEventContent(content: EventHashContent) {
  return sha256Text(canonicalJson(content))
}

function checkpointFilename(sequence: number, eventHash: string, stateSha256: string) {
  return `checkpoint-${String(sequence).padStart(12, '0')}-${eventHash.slice(0, 16)}-${stateSha256.slice(0, 16)}.json.gz`
}

function layoutFromStateDirectory(runRoot: string, stateDirectory: string): UltraStorageV2Layout {
  return {
    runRoot,
    stateDirectory,
    runDefinitionPath: join(stateDirectory, RUN_DEFINITION_FILENAME),
    eventLogPath: join(stateDirectory, EVENT_LOG_FILENAME),
    eventHeadPath: join(stateDirectory, EVENT_HEAD_FILENAME),
    checkpointDirectory: join(stateDirectory, CHECKPOINT_DIRECTORY_NAME),
    progressSummaryPath: join(stateDirectory, PROGRESS_SUMMARY_FILENAME),
    writerLockPath: join(stateDirectory, WRITER_LOCK_FILENAME),
    recoveredLockDirectory: join(stateDirectory, RECOVERED_LOCK_DIRECTORY_NAME),
  }
}

export function ultraStorageV2Layout(runRoot: string): UltraStorageV2Layout {
  const absoluteRunRoot = resolve(runRoot)
  return layoutFromStateDirectory(absoluteRunRoot, join(absoluteRunRoot, STATE_DIRECTORY_NAME))
}

async function durableExclusiveWrite(path: string, contents: string | Uint8Array, mode = 0o600) {
  const handle = await open(path, 'wx', mode)
  try {
    await handle.writeFile(contents)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncDirectory(directory: string) {
  let handle: FileHandle | null = null
  try {
    handle = await open(directory, 'r')
    await handle.sync()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (!['EBADF', 'EINVAL', 'ENOTSUP'].includes(code ?? '')) throw error
  } finally {
    if (handle) await handle.close()
  }
}

async function atomicReplace(path: string, contents: string | Uint8Array, mode = 0o600) {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    await durableExclusiveWrite(temporaryPath, contents, mode)
    await rename(temporaryPath, path)
    await syncDirectory(dirname(path))
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

async function immutablePublish(path: string, contents: string | Uint8Array, mode = 0o444) {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    await durableExclusiveWrite(temporaryPath, contents, mode)
    await link(temporaryPath, path)
    await syncDirectory(dirname(path))
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

function eventHeadHashContent(head: UltraStorageHead) {
  return {
    storageVersion: ULTRA_STORAGE_V2_VERSION,
    headVersion: ULTRA_EVENT_HEAD_VERSION,
    sequence: head.sequence,
    eventHash: head.eventHash,
    eventLogBytes: head.eventLogBytes,
  }
}

function buildEventHeadAnchor(head: UltraStorageHead): UltraEventHeadAnchor {
  const content = eventHeadHashContent(head)
  return { ...content, headSha256: sha256Text(canonicalJson(content)) }
}

function parseEventHeadAnchor(raw: string, path: string): UltraEventHeadAnchor {
  let parsed: Record<string, unknown>
  try {
    parsed = parseJsonObject(raw, `Event head ${path}`)
    assertExactKeys(
      parsed,
      ['storageVersion', 'headVersion', 'sequence', 'eventHash', 'eventLogBytes', 'headSha256'],
      `Event head ${path}`,
    )
    if (
      parsed.storageVersion !== ULTRA_STORAGE_V2_VERSION ||
      parsed.headVersion !== ULTRA_EVENT_HEAD_VERSION
    ) {
      throw new UltraStorageV2Error(
        'event_head_version_mismatch',
        `Event head ${path} has an unsupported version.`,
      )
    }
    if (!Number.isSafeInteger(parsed.sequence) || Number(parsed.sequence) < 0) {
      throw new UltraStorageV2Error(
        'invalid_event_head',
        `Event head ${path} has an invalid sequence.`,
      )
    }
    if (!Number.isSafeInteger(parsed.eventLogBytes) || Number(parsed.eventLogBytes) < 0) {
      throw new UltraStorageV2Error(
        'invalid_event_head',
        `Event head ${path} has an invalid byte length.`,
      )
    }
    requireSha256(parsed.eventHash, 'eventHead.eventHash')
    requireSha256(parsed.headSha256, 'eventHead.headSha256')
  } catch (error) {
    if (error instanceof UltraEventLogIntegrityError) throw error
    throw new UltraEventLogIntegrityError(
      'invalid_event_head',
      `Canonical event head at ${path} is malformed; no repair was attempted.`,
      { cause: error instanceof Error ? error.message : String(error) },
    )
  }
  const anchor = parsed as unknown as UltraEventHeadAnchor
  const actualSha256 = sha256Text(canonicalJson(eventHeadHashContent(anchor)))
  if (anchor.headSha256 !== actualSha256) {
    throw new UltraEventLogIntegrityError(
      'event_head_hash_mismatch',
      `Canonical event head at ${path} failed checksum validation.`,
      { expectedSha256: anchor.headSha256, actualSha256 },
    )
  }
  return anchor
}

async function writeEventHead(layout: UltraStorageV2Layout, head: UltraStorageHead) {
  const anchor = buildEventHeadAnchor(head)
  await atomicReplace(layout.eventHeadPath, `${canonicalJson(anchor)}\n`, 0o600)
  return anchor
}

export async function readUltraEventHead(runRoot: string) {
  const layout = ultraStorageV2Layout(runRoot)
  try {
    return parseEventHeadAnchor(await readFile(layout.eventHeadPath, 'utf8'), layout.eventHeadPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new UltraEventLogIntegrityError(
        'event_head_missing',
        `Canonical event head is missing at ${layout.eventHeadPath}; no reconstruction was attempted.`,
      )
    }
    throw error
  }
}

export async function initializeUltraStorageV2<Definition extends UltraRunDefinitionV2>(options: {
  runRoot: string
  runDefinition: Definition
}) {
  validateRunDefinition(options.runDefinition)
  const finalLayout = ultraStorageV2Layout(options.runRoot)
  await mkdir(finalLayout.runRoot, { recursive: true })

  const temporaryStateDirectory = join(
    finalLayout.runRoot,
    `.${STATE_DIRECTORY_NAME}.initialize-${randomUUID()}`,
  )
  const temporaryLayout = layoutFromStateDirectory(finalLayout.runRoot, temporaryStateDirectory)
  const definitionSha256 = sha256Text(canonicalJson(options.runDefinition))
  const envelope: RunDefinitionEnvelope<Definition> = {
    storageVersion: ULTRA_STORAGE_V2_VERSION,
    definitionSha256,
    definition: options.runDefinition,
  }

  try {
    await mkdir(temporaryLayout.stateDirectory)
    await mkdir(temporaryLayout.checkpointDirectory)
    await mkdir(temporaryLayout.recoveredLockDirectory)
    await durableExclusiveWrite(
      temporaryLayout.runDefinitionPath,
      `${canonicalJson(envelope)}\n`,
      0o444,
    )
    await durableExclusiveWrite(temporaryLayout.eventLogPath, '', 0o600)
    const initialHead = buildEventHeadAnchor({
      sequence: 0,
      eventHash: GENESIS_EVENT_HASH,
      eventLogBytes: 0,
    })
    await durableExclusiveWrite(
      temporaryLayout.eventHeadPath,
      `${canonicalJson(initialHead)}\n`,
      0o600,
    )
    try {
      await rename(temporaryLayout.stateDirectory, finalLayout.stateDirectory)
      await syncDirectory(finalLayout.runRoot)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EEXIST' || code === 'ENOTEMPTY') {
        throw new UltraStorageV2Error(
          'storage_already_exists',
          `State storage already exists at ${finalLayout.stateDirectory}; initialization will not overwrite it.`,
          { stateDirectory: finalLayout.stateDirectory },
        )
      }
      throw error
    }
  } finally {
    await rm(temporaryStateDirectory, { recursive: true, force: true })
  }

  return { layout: finalLayout, definitionSha256 }
}

export async function readUltraRunDefinition<
  Definition extends UltraRunDefinitionV2 = UltraRunDefinitionV2,
>(runRoot: string) {
  const layout = ultraStorageV2Layout(runRoot)
  let parsed: Record<string, unknown>
  try {
    parsed = parseJsonObject(await readFile(layout.runDefinitionPath, 'utf8'), 'Run definition')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new UltraStorageV2Error(
        'run_definition_missing',
        `Run definition is missing at ${layout.runDefinitionPath}.`,
      )
    }
    throw error
  }
  assertExactKeys(
    parsed,
    ['storageVersion', 'definitionSha256', 'definition'],
    'Run definition envelope',
  )
  if (parsed.storageVersion !== ULTRA_STORAGE_V2_VERSION) {
    throw new UltraStorageV2Error(
      'storage_version_mismatch',
      `Expected storage version ${ULTRA_STORAGE_V2_VERSION}.`,
      { actual: parsed.storageVersion },
    )
  }
  const expectedSha256 = requireSha256(parsed.definitionSha256, 'definitionSha256')
  validateRunDefinition(parsed.definition)
  const actualSha256 = sha256Text(canonicalJson(parsed.definition))
  if (actualSha256 !== expectedSha256) {
    throw new UltraStorageV2Error(
      'run_definition_hash_mismatch',
      'Immutable run definition checksum does not match its contents.',
      { expectedSha256, actualSha256 },
    )
  }
  return {
    definition: parsed.definition as Definition,
    definitionSha256: actualSha256,
    path: layout.runDefinitionPath,
  }
}

function parseEventRecord(raw: string, lineNumber: number): UltraStorageEvent {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (error) {
    throw new UltraEventLogIntegrityError(
      'malformed_event',
      `Event log line ${lineNumber} is not valid JSON.`,
      { lineNumber, cause: error instanceof Error ? error.message : String(error) },
    )
  }
  if (!isPlainObject(parsed)) {
    throw new UltraEventLogIntegrityError(
      'invalid_event_schema',
      `Event log line ${lineNumber} must be a JSON object.`,
      { lineNumber },
    )
  }
  try {
    assertExactKeys(
      parsed,
      [
        'storageVersion',
        'sequence',
        'previousEventHash',
        'eventHash',
        'type',
        'recordedAt',
        'payload',
      ],
      `Event log line ${lineNumber}`,
    )
    if (parsed.storageVersion !== ULTRA_STORAGE_V2_VERSION) {
      throw new UltraStorageV2Error(
        'storage_version_mismatch',
        `Event log line ${lineNumber} has an unsupported storage version.`,
      )
    }
    if (!Number.isSafeInteger(parsed.sequence) || Number(parsed.sequence) < 1) {
      throw new UltraStorageV2Error(
        'invalid_schema',
        `Event log line ${lineNumber} has an invalid sequence.`,
      )
    }
    const type = requireNonemptyString(parsed.type, `event[${lineNumber}].type`)
    if (!EVENT_TYPE_PATTERN.test(type) || !ULTRA_STORAGE_EVENT_TYPE_SET.has(type)) {
      throw new UltraStorageV2Error(
        'invalid_schema',
        `Event log line ${lineNumber} has an unsupported event type.`,
      )
    }
    requireNonemptyString(parsed.recordedAt, `event[${lineNumber}].recordedAt`)
    requireSha256(parsed.previousEventHash, `event[${lineNumber}].previousEventHash`)
    requireSha256(parsed.eventHash, `event[${lineNumber}].eventHash`)
    normalizeJson(parsed.payload, `event[${lineNumber}].payload`)
  } catch (error) {
    if (error instanceof UltraEventLogIntegrityError) throw error
    if (error instanceof UltraStorageV2Error) {
      throw new UltraEventLogIntegrityError('invalid_event_schema', error.message, {
        lineNumber,
        underlyingCode: error.code,
      })
    }
    throw error
  }
  return parsed as unknown as UltraStorageEvent
}

export async function readUltraEventLog(runRoot: string): Promise<UltraStorageEvent[]> {
  const layout = ultraStorageV2Layout(runRoot)
  let raw: string
  try {
    raw = await readFile(layout.eventLogPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new UltraEventLogIntegrityError(
        'event_log_missing',
        `Event log is missing at ${layout.eventLogPath}.`,
      )
    }
    throw error
  }
  if (raw.length > 0 && !raw.endsWith('\n')) {
    throw new UltraEventLogIntegrityError(
      'truncated_final_event',
      'Event log does not end at a complete newline-delimited event; no repair was attempted.',
    )
  }

  const lines = raw.length === 0 ? [] : raw.slice(0, -1).split('\n')
  const events: UltraStorageEvent[] = []
  let expectedPreviousHash = GENESIS_EVENT_HASH

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1
    if (Buffer.byteLength(`${line}\n`, 'utf8') > MAX_EVENT_BYTES) {
      throw new UltraEventLogIntegrityError(
        'event_too_large',
        `Event log line ${lineNumber} exceeds the ${MAX_EVENT_BYTES}-byte event limit.`,
        { lineNumber },
      )
    }
    if (line.length === 0) {
      throw new UltraEventLogIntegrityError(
        'malformed_middle_event',
        `Event log line ${lineNumber} is blank.`,
        { lineNumber },
      )
    }

    let event: UltraStorageEvent
    try {
      event = parseEventRecord(line, lineNumber)
    } catch (error) {
      if (error instanceof UltraEventLogIntegrityError && index === lines.length - 1) {
        throw new UltraEventLogIntegrityError(
          'truncated_final_event',
          `Final event at line ${lineNumber} is incomplete or malformed; no repair was attempted.`,
          { lineNumber, underlyingCode: error.code },
        )
      }
      if (error instanceof UltraEventLogIntegrityError) {
        throw new UltraEventLogIntegrityError(
          'malformed_middle_event',
          `Event log line ${lineNumber} is malformed before the end of the log.`,
          { lineNumber, underlyingCode: error.code },
        )
      }
      throw error
    }

    const expectedSequence = lineNumber
    if (event.sequence < expectedSequence) {
      throw new UltraEventLogIntegrityError(
        'duplicate_sequence',
        `Event sequence ${event.sequence} at line ${lineNumber} duplicates or goes behind the expected sequence ${expectedSequence}.`,
        { lineNumber, actualSequence: event.sequence, expectedSequence },
      )
    }
    if (event.sequence > expectedSequence) {
      throw new UltraEventLogIntegrityError(
        'missing_sequence',
        `Event sequence ${event.sequence} at line ${lineNumber} skips expected sequence ${expectedSequence}.`,
        { lineNumber, actualSequence: event.sequence, expectedSequence },
      )
    }
    if (event.previousEventHash !== expectedPreviousHash) {
      throw new UltraEventLogIntegrityError(
        'previous_hash_mismatch',
        `Event sequence ${event.sequence} does not reference the preceding event hash.`,
        {
          sequence: event.sequence,
          expectedPreviousHash,
          actualPreviousHash: event.previousEventHash,
        },
      )
    }
    const actualEventHash = hashEventContent(eventHashContent(event))
    if (event.eventHash !== actualEventHash) {
      throw new UltraEventLogIntegrityError(
        'event_hash_mismatch',
        `Event sequence ${event.sequence} checksum does not match its contents.`,
        { sequence: event.sequence, expectedEventHash: event.eventHash, actualEventHash },
      )
    }

    events.push(event)
    expectedPreviousHash = event.eventHash
  }
  const actualHead = headFromEvents(events, Buffer.byteLength(raw, 'utf8'))
  const anchoredHead = await readUltraEventHead(runRoot)
  if (
    actualHead.sequence !== anchoredHead.sequence ||
    actualHead.eventHash !== anchoredHead.eventHash ||
    actualHead.eventLogBytes !== anchoredHead.eventLogBytes
  ) {
    throw new UltraEventLogIntegrityError(
      'event_head_mismatch',
      'Canonical event log does not match its durable head anchor; no repair was attempted.',
      { actualHead, anchoredHead },
    )
  }
  return events
}

function headFromEvents(
  events: readonly UltraStorageEvent[],
  eventLogBytes: number,
): UltraStorageHead {
  const last = events.at(-1)
  return last
    ? { sequence: last.sequence, eventHash: last.eventHash, eventLogBytes }
    : { sequence: 0, eventHash: GENESIS_EVENT_HASH, eventLogBytes }
}

function parseWriterLock(raw: string): CoordinatorWriterLockMetadata {
  const parsed = parseJsonObject(raw, 'Coordinator writer lock')
  assertExactKeys(
    parsed,
    ['storageVersion', 'lockVersion', 'token', 'ownerId', 'processId', 'host', 'acquiredAt'],
    'Coordinator writer lock',
  )
  if (
    parsed.storageVersion !== ULTRA_STORAGE_V2_VERSION ||
    parsed.lockVersion !== ULTRA_WRITER_LOCK_VERSION
  ) {
    throw new UltraStorageV2Error(
      'writer_lock_version_mismatch',
      'Coordinator writer lock has an unsupported version.',
    )
  }
  requireNonemptyString(parsed.token, 'writerLock.token')
  requireNonemptyString(parsed.ownerId, 'writerLock.ownerId')
  requireNonemptyString(parsed.host, 'writerLock.host')
  requireNonemptyString(parsed.acquiredAt, 'writerLock.acquiredAt')
  if (!Number.isSafeInteger(parsed.processId) || Number(parsed.processId) < 1) {
    throw new UltraStorageV2Error(
      'invalid_writer_lock',
      'Coordinator writer lock has an invalid process ID.',
    )
  }
  return parsed as unknown as CoordinatorWriterLockMetadata
}

export async function inspectCoordinatorWriterLock(runRoot: string) {
  const layout = ultraStorageV2Layout(runRoot)
  try {
    return parseWriterLock(await readFile(layout.writerLockPath, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

interface FileIdentity {
  device: number
  inode: number
}

function fileIdentity(value: { dev: number; ino: number }): FileIdentity {
  return { device: value.dev, inode: value.ino }
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity) {
  return left.device === right.device && left.inode === right.inode
}

async function restoreCapturedLock(capturedPath: string, lockPath: string) {
  try {
    await stat(lockPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await rename(capturedPath, lockPath)
      await syncDirectory(dirname(lockPath))
      return
    }
    throw error
  }
}

class CoordinatorWriterLock {
  readonly metadata: CoordinatorWriterLockMetadata
  private readonly handle: FileHandle
  private readonly path: string
  private released = false

  constructor(path: string, metadata: CoordinatorWriterLockMetadata, handle: FileHandle) {
    this.path = path
    this.metadata = metadata
    this.handle = handle
  }

  async release() {
    if (this.released) {
      throw new UltraStorageV2Error(
        'writer_lock_already_released',
        'Coordinator writer lock has already been released.',
      )
    }
    const ownedIdentity = fileIdentity(await this.handle.stat())
    let current: CoordinatorWriterLockMetadata
    let currentIdentity: FileIdentity
    try {
      current = parseWriterLock(await readFile(this.path, 'utf8'))
      currentIdentity = fileIdentity(await stat(this.path))
    } catch (error) {
      await this.handle.close()
      this.released = true
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new UltraStorageV2Error(
          'writer_lock_lost',
          'Coordinator writer lock disappeared before its owner released it.',
          { token: this.metadata.token },
        )
      }
      throw error
    }
    if (
      current.token !== this.metadata.token ||
      !sameFileIdentity(ownedIdentity, currentIdentity)
    ) {
      await this.handle.close()
      this.released = true
      throw new UltraStorageV2Error(
        'writer_lock_replaced',
        'Coordinator writer lock pathname no longer identifies the inode acquired by this writer; the replacement was not removed.',
        {
          expectedToken: this.metadata.token,
          actualToken: current.token,
          ownedIdentity,
          currentIdentity,
        },
      )
    }

    const capturedPath = join(
      dirname(this.path),
      `.${basename(this.path)}.release-${this.metadata.token}.tmp`,
    )
    await rename(this.path, capturedPath)
    const capturedIdentity = fileIdentity(await stat(capturedPath))
    const captured = parseWriterLock(await readFile(capturedPath, 'utf8'))
    if (
      captured.token !== this.metadata.token ||
      !sameFileIdentity(ownedIdentity, capturedIdentity)
    ) {
      await restoreCapturedLock(capturedPath, this.path)
      await this.handle.close()
      this.released = true
      throw new UltraStorageV2Error(
        'writer_lock_replaced',
        'Coordinator writer lock was replaced during release; the captured replacement was restored and not removed.',
        { expectedToken: this.metadata.token, actualToken: captured.token },
      )
    }
    await unlink(capturedPath)
    await syncDirectory(dirname(this.path))
    await this.handle.close()
    this.released = true
  }
}

async function acquireCoordinatorWriterLock(options: {
  runRoot: string
  ownerId: string
  acquiredAt?: string
  processId?: number
  host?: string
}) {
  const layout = ultraStorageV2Layout(options.runRoot)
  await readUltraRunDefinition(options.runRoot)
  const metadata: CoordinatorWriterLockMetadata = {
    storageVersion: ULTRA_STORAGE_V2_VERSION,
    lockVersion: ULTRA_WRITER_LOCK_VERSION,
    token: randomUUID(),
    ownerId: requireNonemptyString(options.ownerId, 'ownerId'),
    processId: options.processId ?? process.pid,
    host: options.host ?? hostname(),
    acquiredAt: options.acquiredAt ?? new Date().toISOString(),
  }
  let handle: FileHandle | null = null
  try {
    handle = await open(layout.writerLockPath, 'wx', 0o600)
    await handle.writeFile(`${canonicalJson(metadata)}\n`)
    await handle.sync()
    await syncDirectory(dirname(layout.writerLockPath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      if (handle) await handle.close()
      throw error
    }
    let existing: CoordinatorWriterLockMetadata | null = null
    try {
      existing = await inspectCoordinatorWriterLock(options.runRoot)
    } catch {
      // The existing lock remains authoritative even when its metadata cannot be read.
    }
    throw new UltraStorageV2Error(
      'writer_lock_held',
      'Another coordinator writer lock is present. Inspect it and use explicit stale-lock recovery if appropriate.',
      { existing },
    )
  }
  if (!handle) {
    throw new UltraStorageV2Error('writer_lock_failed', 'Coordinator writer lock was not opened.')
  }
  return new CoordinatorWriterLock(layout.writerLockPath, metadata, handle)
}

function processIsAlive(processId: number) {
  try {
    process.kill(processId, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false
    if (code === 'EPERM') return true
    throw error
  }
}

export async function recoverStaleCoordinatorWriterLock(options: {
  runRoot: string
  expectedToken: string
  recoveredBy: string
  reason: string
  staleAfterMs: number
  recoveredAt?: string
  allowLiveOwnerRecovery?: boolean
}) {
  if (!Number.isSafeInteger(options.staleAfterMs) || options.staleAfterMs < 0) {
    throw new UltraStorageV2Error(
      'invalid_stale_threshold',
      'staleAfterMs must be a non-negative integer.',
    )
  }
  const recoveredAt = options.recoveredAt ?? new Date().toISOString()
  const recoveredAtMs = Date.parse(recoveredAt)
  if (!Number.isFinite(recoveredAtMs)) {
    throw new UltraStorageV2Error('invalid_recovery_time', 'recoveredAt must be an ISO timestamp.')
  }
  const recoveredBy = requireNonemptyString(options.recoveredBy, 'recoveredBy')
  const reason = requireNonemptyString(options.reason, 'reason')
  const layout = ultraStorageV2Layout(options.runRoot)
  const lock = await inspectCoordinatorWriterLock(options.runRoot)
  if (!lock) {
    throw new UltraStorageV2Error('writer_lock_missing', 'No coordinator writer lock exists.')
  }
  const authorizedIdentity = fileIdentity(await stat(layout.writerLockPath))
  if (lock.token !== options.expectedToken) {
    throw new UltraStorageV2Error(
      'writer_lock_token_mismatch',
      'Stale-lock recovery token does not match the current lock.',
      { expectedToken: options.expectedToken, actualToken: lock.token },
    )
  }
  const acquiredAtMs = Date.parse(lock.acquiredAt)
  if (!Number.isFinite(acquiredAtMs)) {
    throw new UltraStorageV2Error(
      'invalid_writer_lock',
      'Coordinator writer lock acquiredAt is invalid; automatic interpretation is refused.',
    )
  }
  const ageMs = recoveredAtMs - acquiredAtMs
  if (ageMs < options.staleAfterMs) {
    throw new UltraStorageV2Error(
      'writer_lock_not_stale',
      `Coordinator writer lock is ${ageMs}ms old, below the ${options.staleAfterMs}ms recovery threshold.`,
      { ageMs, staleAfterMs: options.staleAfterMs },
    )
  }
  if (
    lock.host === hostname() &&
    processIsAlive(lock.processId) &&
    options.allowLiveOwnerRecovery !== true
  ) {
    throw new UltraStorageV2Error(
      'writer_lock_owner_alive',
      `Process ${lock.processId} still appears alive; stale-lock recovery was refused.`,
      { processId: lock.processId },
    )
  }

  const safeTimestamp = recoveredAt.replaceAll(':', '-').replaceAll('.', '-')
  const archiveBase = `${safeTimestamp}-${lock.token}`
  const archivedLockPath = join(layout.recoveredLockDirectory, `${archiveBase}.lock.json`)
  const recoveryRecordPath = join(layout.recoveredLockDirectory, `${archiveBase}.recovery.json`)
  const recoveryRecord = {
    storageVersion: ULTRA_STORAGE_V2_VERSION,
    recoveryVersion: ULTRA_WRITER_LOCK_VERSION,
    recoveredAt,
    recoveredBy,
    reason,
    staleAfterMs: options.staleAfterMs,
    ageMs,
    lock,
  }

  await immutablePublish(recoveryRecordPath, `${canonicalJson(recoveryRecord)}\n`)
  const currentIdentity = fileIdentity(await stat(layout.writerLockPath))
  const currentLock = parseWriterLock(await readFile(layout.writerLockPath, 'utf8'))
  if (currentLock.token !== lock.token || !sameFileIdentity(authorizedIdentity, currentIdentity)) {
    throw new UltraStorageV2Error(
      'writer_lock_recovery_race',
      'Coordinator writer lock was replaced before atomic recovery capture; the replacement was not archived.',
      {
        expectedToken: lock.token,
        actualToken: currentLock.token,
        authorizedIdentity,
        currentIdentity,
        recoveryRecordPath,
      },
    )
  }
  try {
    await rename(layout.writerLockPath, archivedLockPath)
    await syncDirectory(layout.recoveredLockDirectory)
  } catch (error) {
    throw new UltraStorageV2Error(
      'writer_lock_recovery_race',
      'Coordinator writer lock changed or disappeared during explicit recovery.',
      { cause: error instanceof Error ? error.message : String(error), recoveryRecordPath },
    )
  }
  const archivedIdentity = fileIdentity(await stat(archivedLockPath))
  const archived = parseWriterLock(await readFile(archivedLockPath, 'utf8'))
  if (archived.token !== lock.token || !sameFileIdentity(authorizedIdentity, archivedIdentity)) {
    await restoreCapturedLock(archivedLockPath, layout.writerLockPath)
    throw new UltraStorageV2Error(
      'writer_lock_recovery_race',
      'Captured writer lock differs from the inode authorized for recovery; it was restored and not archived.',
      {
        expectedToken: lock.token,
        actualToken: archived.token,
        authorizedIdentity,
        archivedIdentity,
      },
    )
  }
  await chmod(archivedLockPath, 0o444)
  return { archivedLockPath, recoveryRecordPath, lock }
}

async function writeAll(handle: FileHandle, value: string) {
  const buffer = Buffer.from(value, 'utf8')
  let offset = 0
  while (offset < buffer.length) {
    const result = await handle.write(buffer, offset, buffer.length - offset, null)
    if (result.bytesWritten <= 0) {
      throw new UltraStorageV2Error(
        'event_append_failed',
        'Event log append made no forward progress.',
      )
    }
    offset += result.bytesWritten
  }
}

export interface UltraCoordinatorEventWriter {
  readonly lock: CoordinatorWriterLockMetadata
  readonly head: UltraStorageHead
  append(input: UltraStorageEventInput): Promise<UltraEventAppendReceipt>
  appendMany(inputs: readonly UltraStorageEventInput[]): Promise<UltraEventAppendReceipt[]>
  writeCheckpoint<State>(
    state: State,
    createdAt?: string,
  ): Promise<{
    path: string
    compressedSha256: string
    checkpoint: UltraCheckpointEnvelope<State>
  }>
  writeProgressSummary<Projection>(
    projection: Projection,
    generatedAt?: string,
  ): Promise<UltraProgressSummary<Projection>>
}

/**
 * Decides when a caller-owned deterministic state projection should be
 * checkpointed. The controller deliberately does not own a reducer or state:
 * callers retain responsibility for supplying the projection that corresponds
 * to the writer head, and reconstruction verifies that projection by replay.
 */
export class UltraCheckpointCadenceController {
  readonly eventInterval: number
  readonly checkpointOnCleanShutdown: boolean
  private lastCheckpointSequence: number

  constructor(options: UltraCheckpointCadenceOptions) {
    if (!Number.isSafeInteger(options.eventInterval) || options.eventInterval <= 0) {
      throw new UltraStorageV2Error(
        'invalid_checkpoint_cadence',
        'Checkpoint event interval must be a positive safe integer.',
        { eventInterval: options.eventInterval },
      )
    }
    const lastCheckpointSequence = options.lastCheckpointSequence ?? 0
    if (!Number.isSafeInteger(lastCheckpointSequence) || lastCheckpointSequence < 0) {
      throw new UltraStorageV2Error(
        'invalid_checkpoint_cadence',
        'Last checkpoint sequence must be a nonnegative safe integer.',
        { lastCheckpointSequence },
      )
    }
    this.eventInterval = options.eventInterval
    this.checkpointOnCleanShutdown = options.checkpointOnCleanShutdown ?? false
    this.lastCheckpointSequence = lastCheckpointSequence
  }

  get checkpointSequence() {
    return this.lastCheckpointSequence
  }

  reasonDue(
    head: UltraStorageHead,
    options: { cleanShutdown?: boolean } = {},
  ): UltraCheckpointCadenceReason | null {
    if (head.sequence < this.lastCheckpointSequence) {
      throw new UltraStorageV2Error(
        'checkpoint_cadence_regression',
        'Event head precedes the cadence controller checkpoint sequence.',
        { headSequence: head.sequence, checkpointSequence: this.lastCheckpointSequence },
      )
    }
    if (head.sequence === this.lastCheckpointSequence) return null
    if (head.sequence - this.lastCheckpointSequence >= this.eventInterval) {
      return 'event_interval'
    }
    if (options.cleanShutdown && this.checkpointOnCleanShutdown) return 'clean_shutdown'
    return null
  }

  markCheckpoint(sequence: number) {
    if (!Number.isSafeInteger(sequence) || sequence <= this.lastCheckpointSequence) {
      throw new UltraStorageV2Error(
        'invalid_checkpoint_cadence_transition',
        'A cadence checkpoint must advance beyond the prior checkpoint sequence.',
        { sequence, checkpointSequence: this.lastCheckpointSequence },
      )
    }
    this.lastCheckpointSequence = sequence
  }
}

export async function writeUltraCheckpointIfDue<State>(options: {
  writer: UltraCoordinatorEventWriter
  cadence: UltraCheckpointCadenceController
  state: State
  cleanShutdown?: boolean
  createdAt?: string
}) {
  const reason = options.cadence.reasonDue(options.writer.head, {
    cleanShutdown: options.cleanShutdown,
  })
  if (!reason) return null
  const result = await options.writer.writeCheckpoint(options.state, options.createdAt)
  options.cadence.markCheckpoint(result.checkpoint.sequence)
  return { reason, ...result }
}

class CoordinatorEventWriter implements UltraCoordinatorEventWriter {
  readonly lock: CoordinatorWriterLockMetadata
  private currentHead: UltraStorageHead
  private readonly handle: FileHandle
  private readonly layout: UltraStorageV2Layout
  private failed = false
  private operationTail: Promise<void> = Promise.resolve()

  constructor(options: {
    lock: CoordinatorWriterLockMetadata
    head: UltraStorageHead
    handle: FileHandle
    layout: UltraStorageV2Layout
  }) {
    this.lock = options.lock
    this.currentHead = options.head
    this.handle = options.handle
    this.layout = options.layout
  }

  get head() {
    return { ...this.currentHead }
  }

  private assertUsable() {
    if (this.failed) {
      throw new UltraStorageV2Error(
        'writer_failed',
        'Coordinator writer previously failed; reopen it after validating the event log.',
      )
    }
  }

  private enqueue<Result>(operation: () => Promise<Result>) {
    const scheduled = this.operationTail.then(operation)
    this.operationTail = scheduled.then(
      () => undefined,
      () => undefined,
    )
    return scheduled
  }

  async append(input: UltraStorageEventInput) {
    return this.enqueue(async () => {
      const [receipt] = await this.appendManyUnlocked([input])
      return receipt
    })
  }

  async appendMany(inputs: readonly UltraStorageEventInput[]) {
    return this.enqueue(() => this.appendManyUnlocked(inputs))
  }

  private async appendManyUnlocked(inputs: readonly UltraStorageEventInput[]) {
    this.assertUsable()
    if (inputs.length === 0) return []

    let nextHead = this.currentHead
    const receipts: UltraEventAppendReceipt[] = []
    const lines: string[] = []
    for (const input of inputs) {
      const type = requireNonemptyString(input.type, 'event.type')
      if (!EVENT_TYPE_PATTERN.test(type) || !ULTRA_STORAGE_EVENT_TYPE_SET.has(type)) {
        throw new UltraStorageV2Error(
          'invalid_event_type',
          `Event type ${type} is not in the storage-v2 event registry.`,
        )
      }
      const recordedAt = input.recordedAt ?? new Date().toISOString()
      requireNonemptyString(recordedAt, 'event.recordedAt')
      normalizeJson(input.payload, '$.payload')
      const content: EventHashContent = {
        storageVersion: ULTRA_STORAGE_V2_VERSION,
        sequence: nextHead.sequence + 1,
        previousEventHash: nextHead.eventHash,
        type: type as UltraStorageEventType,
        recordedAt,
        payload: input.payload,
      }
      const event: UltraStorageEvent = { ...content, eventHash: hashEventContent(content) }
      const line = `${canonicalJson(event)}\n`
      const bytesWritten = Buffer.byteLength(line, 'utf8')
      if (bytesWritten > MAX_EVENT_BYTES) {
        throw new UltraStorageV2Error(
          'event_too_large',
          `Serialized event is ${bytesWritten} bytes, above the ${MAX_EVENT_BYTES}-byte limit.`,
          { bytesWritten, maxEventBytes: MAX_EVENT_BYTES, type },
        )
      }
      receipts.push({ event, bytesWritten })
      lines.push(line)
      nextHead = {
        sequence: event.sequence,
        eventHash: event.eventHash,
        eventLogBytes: nextHead.eventLogBytes + bytesWritten,
      }
    }

    try {
      await writeAll(this.handle, lines.join(''))
      await this.handle.sync()
      await writeEventHead(this.layout, nextHead)
    } catch (error) {
      this.failed = true
      throw error
    }
    this.currentHead = nextHead
    return receipts
  }

  async writeCheckpoint<State>(state: State, createdAt = new Date().toISOString()) {
    return this.enqueue(() => this.writeCheckpointUnlocked(state, createdAt))
  }

  private async writeCheckpointUnlocked<State>(state: State, createdAt: string) {
    this.assertUsable()
    normalizeJson(state, '$.state')
    const runDefinition = await readUltraRunDefinition(this.layout.runRoot)
    const stateSha256 = sha256Text(canonicalJson(state))
    const checkpoint: UltraCheckpointEnvelope<State> = {
      storageVersion: ULTRA_STORAGE_V2_VERSION,
      checkpointVersion: ULTRA_CHECKPOINT_VERSION,
      createdAt,
      runDefinitionSha256: runDefinition.definitionSha256,
      sequence: this.currentHead.sequence,
      eventHash: this.currentHead.eventHash,
      stateSha256,
      state,
    }
    const uncompressed = `${canonicalJson(checkpoint)}\n`
    const compressed = gzipSync(Buffer.from(uncompressed, 'utf8'), { level: 9 })
    const path = join(
      this.layout.checkpointDirectory,
      checkpointFilename(checkpoint.sequence, checkpoint.eventHash, checkpoint.stateSha256),
    )
    try {
      await immutablePublish(path, compressed)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new UltraStorageV2Error(
          'checkpoint_already_exists',
          `Checkpoint already exists at ${path}; it will not be overwritten.`,
          { path },
        )
      }
      throw error
    }
    return { path, compressedSha256: sha256Text(compressed), checkpoint }
  }

  async writeProgressSummary<Projection>(
    projection: Projection,
    generatedAt = new Date().toISOString(),
  ) {
    return this.enqueue(() => this.writeProgressSummaryUnlocked(projection, generatedAt))
  }

  private async writeProgressSummaryUnlocked<Projection>(
    projection: Projection,
    generatedAt: string,
  ) {
    this.assertUsable()
    normalizeJson(projection, '$.projection')
    const summary: UltraProgressSummary<Projection> = {
      storageVersion: ULTRA_STORAGE_V2_VERSION,
      canonical: false,
      notice:
        'Generated human-readable projection only. Reconstruct canonical state from the run definition, checkpoint, and event log.',
      generatedAt,
      basedOnEventSequence: this.currentHead.sequence,
      basedOnEventHash: this.currentHead.eventHash,
      projection,
    }
    await atomicReplace(this.layout.progressSummaryPath, `${canonicalJson(summary)}\n`, 0o644)
    return summary
  }
}

export async function withUltraCoordinatorWriter<Result>(options: {
  runRoot: string
  ownerId: string
  action: (writer: UltraCoordinatorEventWriter) => Promise<Result>
}) {
  const lock = await acquireCoordinatorWriterLock({
    runRoot: options.runRoot,
    ownerId: options.ownerId,
  })
  const layout = ultraStorageV2Layout(options.runRoot)
  let handle: FileHandle | null = null
  try {
    await readUltraEventLog(options.runRoot)
    handle = await open(layout.eventLogPath, 'a')
    const writer = new CoordinatorEventWriter({
      lock: lock.metadata,
      head: await readUltraEventHead(options.runRoot),
      handle,
      layout,
    })
    return await options.action(writer)
  } finally {
    try {
      if (handle) await handle.close()
    } finally {
      await lock.release()
    }
  }
}

export async function appendUltraStorageEvent(options: {
  runRoot: string
  ownerId: string
  event: UltraStorageEventInput
}) {
  return withUltraCoordinatorWriter({
    runRoot: options.runRoot,
    ownerId: options.ownerId,
    action: (writer) => writer.append(options.event),
  })
}

function parseCheckpointEnvelope<State>(raw: string, path: string): UltraCheckpointEnvelope<State> {
  const parsed = parseJsonObject(raw, `Checkpoint ${path}`)
  assertExactKeys(
    parsed,
    [
      'storageVersion',
      'checkpointVersion',
      'createdAt',
      'runDefinitionSha256',
      'sequence',
      'eventHash',
      'stateSha256',
      'state',
    ],
    `Checkpoint ${path}`,
  )
  if (
    parsed.storageVersion !== ULTRA_STORAGE_V2_VERSION ||
    parsed.checkpointVersion !== ULTRA_CHECKPOINT_VERSION
  ) {
    throw new UltraStorageV2Error(
      'checkpoint_version_mismatch',
      `Checkpoint ${path} has an unsupported version.`,
    )
  }
  requireNonemptyString(parsed.createdAt, 'checkpoint.createdAt')
  requireSha256(parsed.runDefinitionSha256, 'checkpoint.runDefinitionSha256')
  requireSha256(parsed.eventHash, 'checkpoint.eventHash')
  const stateSha256 = requireSha256(parsed.stateSha256, 'checkpoint.stateSha256')
  if (!Number.isSafeInteger(parsed.sequence) || Number(parsed.sequence) < 0) {
    throw new UltraStorageV2Error(
      'invalid_checkpoint',
      `Checkpoint ${path} has an invalid sequence.`,
    )
  }
  normalizeJson(parsed.state, '$.state')
  const actualStateSha256 = sha256Text(canonicalJson(parsed.state))
  if (actualStateSha256 !== stateSha256) {
    throw new UltraStorageV2Error(
      'checkpoint_state_hash_mismatch',
      `Checkpoint ${path} state checksum does not match its contents.`,
      { expectedSha256: stateSha256, actualSha256: actualStateSha256 },
    )
  }
  return parsed as unknown as UltraCheckpointEnvelope<State>
}

export async function loadLatestUltraCheckpoint<State>(runRoot: string) {
  const layout = ultraStorageV2Layout(runRoot)
  const entries = await readdir(layout.checkpointDirectory, { withFileTypes: true })
  const candidates: Array<{
    name: string
    sequence: number
    eventPrefix: string
    statePrefix: string
  }> = []
  for (const entry of entries) {
    if (entry.isFile() && CHECKPOINT_TEMP_FILENAME_PATTERN.test(entry.name)) continue
    if (!entry.isFile()) {
      throw new UltraStorageV2Error(
        'unexpected_checkpoint_artifact',
        `Unexpected non-file checkpoint artifact ${entry.name}.`,
      )
    }
    const match = CHECKPOINT_FILENAME_PATTERN.exec(entry.name)
    if (!match) {
      throw new UltraStorageV2Error(
        'unexpected_checkpoint_artifact',
        `Unexpected file ${entry.name} in the checkpoint directory; no cleanup was attempted.`,
      )
    }
    candidates.push({
      name: entry.name,
      sequence: Number(match[1]),
      eventPrefix: match[2],
      statePrefix: match[3],
    })
  }
  if (candidates.length === 0) return null
  candidates.sort(
    (left, right) => right.sequence - left.sequence || right.name.localeCompare(left.name),
  )
  const newestSequence = candidates[0].sequence
  if (candidates.filter((candidate) => candidate.sequence === newestSequence).length > 1) {
    throw new UltraStorageV2Error(
      'ambiguous_checkpoint',
      `Multiple checkpoints exist at sequence ${newestSequence}; none was selected.`,
      { sequence: newestSequence },
    )
  }
  const candidate = candidates[0]
  const path = join(layout.checkpointDirectory, candidate.name)
  let raw: string
  try {
    raw = gunzipSync(await readFile(path)).toString('utf8')
  } catch (error) {
    throw new UltraStorageV2Error('corrupt_checkpoint', `Checkpoint ${path} cannot be decoded.`, {
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  const checkpoint = parseCheckpointEnvelope<State>(raw, path)
  if (
    checkpoint.sequence !== candidate.sequence ||
    !checkpoint.eventHash.startsWith(candidate.eventPrefix) ||
    !checkpoint.stateSha256.startsWith(candidate.statePrefix)
  ) {
    throw new UltraStorageV2Error(
      'checkpoint_filename_mismatch',
      `Checkpoint ${path} metadata does not match its immutable filename.`,
    )
  }
  const runDefinition = await readUltraRunDefinition(runRoot)
  if (checkpoint.runDefinitionSha256 !== runDefinition.definitionSha256) {
    throw new UltraStorageV2Error(
      'checkpoint_run_definition_mismatch',
      `Checkpoint ${path} belongs to a different run definition.`,
      {
        checkpointSha256: checkpoint.runDefinitionSha256,
        runDefinitionSha256: runDefinition.definitionSha256,
      },
    )
  }
  return { path, checkpoint }
}

export async function reconstructUltraState<State>(options: {
  runRoot: string
  initialState: State
  reducer: (state: State, event: UltraStorageEvent) => State
}): Promise<ReconstructedUltraState<State>> {
  const events = await readUltraEventLog(options.runRoot)
  const latestCheckpoint = await loadLatestUltraCheckpoint<State>(options.runRoot)
  let state = options.initialState
  let checkpointPath: string | null = null
  let checkpointSequence = 0

  if (latestCheckpoint) {
    const { checkpoint } = latestCheckpoint
    const anchorHash =
      checkpoint.sequence === 0 ? GENESIS_EVENT_HASH : events[checkpoint.sequence - 1]?.eventHash
    if (!anchorHash || anchorHash !== checkpoint.eventHash) {
      throw new UltraStorageV2Error(
        'checkpoint_event_anchor_mismatch',
        `Checkpoint at sequence ${checkpoint.sequence} does not match the canonical event log.`,
        { checkpointEventHash: checkpoint.eventHash, eventLogHash: anchorHash ?? null },
      )
    }
    let replayedCheckpointState = options.initialState
    for (const event of events.slice(0, checkpoint.sequence)) {
      replayedCheckpointState = options.reducer(replayedCheckpointState, event)
    }
    const replayedStateSha256 = sha256Text(canonicalJson(replayedCheckpointState))
    if (replayedStateSha256 !== checkpoint.stateSha256) {
      throw new UltraStorageV2Error(
        'checkpoint_state_replay_mismatch',
        `Checkpoint at sequence ${checkpoint.sequence} does not equal deterministic replay from the run's initial state.`,
        {
          checkpointStateSha256: checkpoint.stateSha256,
          replayedStateSha256,
          checkpointPath: latestCheckpoint.path,
        },
      )
    }
    state = checkpoint.state
    checkpointPath = latestCheckpoint.path
    checkpointSequence = checkpoint.sequence
  }

  for (const event of events.slice(checkpointSequence)) {
    state = options.reducer(state, event)
  }
  return {
    state,
    events,
    head: await readUltraEventHead(options.runRoot),
    checkpointPath,
    checkpointSequence,
  }
}

export async function writeUltraCheckpoint<State>(options: {
  runRoot: string
  ownerId: string
  state: State
  createdAt?: string
}) {
  return withUltraCoordinatorWriter({
    runRoot: options.runRoot,
    ownerId: options.ownerId,
    action: (writer) => writer.writeCheckpoint(options.state, options.createdAt),
  })
}

export async function writeUltraProgressSummary<Projection>(options: {
  runRoot: string
  ownerId: string
  projection: Projection
  generatedAt?: string
}) {
  return withUltraCoordinatorWriter({
    runRoot: options.runRoot,
    ownerId: options.ownerId,
    action: (writer) => writer.writeProgressSummary(options.projection, options.generatedAt),
  })
}

export async function ultraStorageFootprint(runRoot: string) {
  const layout = ultraStorageV2Layout(runRoot)
  const files: Array<{ path: string; bytes: number }> = []

  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) files.push({ path, bytes: (await stat(path)).size })
    }
  }

  await visit(layout.stateDirectory)
  files.sort((left, right) => left.path.localeCompare(right.path))
  return files
}
