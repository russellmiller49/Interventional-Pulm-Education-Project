import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertNoSymlinkPathEscape,
  assertPreparedAttemptIntegrity,
  completeAttemptProvenance,
  prepareAttemptProvenance,
  readTrackedRepositoryState,
  type ApprovedAttemptRunDefinition,
  type CompletedAttemptProvenance,
  type PreparedAttemptProvenance,
  type RepositoryAmendment,
  type VersionedCheckedArtifact,
} from '@/features/literature/ultra-screening/attempt-provenance'
import {
  stableJson,
  validateUltraWorkerOutput,
  type UltraValidationReport,
} from '@/features/literature/ultra-screening/core'

import {
  readUltraEventLog,
  readUltraRunDefinition,
  ultraStorageV2Layout,
  withUltraCoordinatorWriter,
  type UltraRunDefinitionV2,
  type UltraStorageEvent,
} from './ultra-storage-v2'
import {
  assertKnownArguments,
  hasFlag,
  numberArgument,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'

export const ULTRA_ATTEMPT_RUNTIME_VERSION = '2.0.0' as const
export const ULTRA_REPOSITORY_AMENDMENT_POLICY =
  'Repository amendments must be approved in the immutable run definition before initialization. Any unanticipated commit, policy, or prompt change requires a new run definition.'

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const GIT_COMMIT_PATTERN = /^[a-f0-9]{40,64}$/u
const SAFE_PATH_COMPONENT_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/u

export interface UltraDispatchAuthorization {
  version: string
  id: string
  authorizedBy: string
  authorizedAt: string
  enabled: boolean
}

export interface OperationalUltraRunDefinition
  extends UltraRunDefinitionV2, ApprovedAttemptRunDefinition {
  dispatchAuthorization: UltraDispatchAuthorization
  maxRetries: number
  repositoryAmendments?: readonly RepositoryAmendment[]
}

export interface StartedAttemptProvenance extends Omit<
  PreparedAttemptProvenance,
  'status' | 'startedAt'
> {
  status: 'running'
  startedAt: string
}

export interface AttemptStartedEventPayload {
  attemptRuntimeVersion: typeof ULTRA_ATTEMPT_RUNTIME_VERSION
  runDefinitionSha256: string
  attemptId: string
  chunkId: string
  phaseId: string
  attemptNumber: number
  status: 'running'
  startedAt: string
  provenance: StartedAttemptProvenance
}

export type UltraAttemptTerminalStatus = 'validated' | 'invalid' | 'worker_failed'

export interface AttemptTerminalEventPayload {
  attemptRuntimeVersion: typeof ULTRA_ATTEMPT_RUNTIME_VERSION
  runDefinitionSha256: string
  attemptId: string
  chunkId: string
  phaseId: string
  attemptNumber: number
  status: UltraAttemptTerminalStatus
  startedAt: string
  completedAt: string
  validationOutcome: {
    result: 'valid' | 'invalid' | 'worker_failed'
    errors: string[]
  }
  provenance: CompletedAttemptProvenance
}

export type RuntimeChunkStatus = 'pending' | 'running' | 'completed' | 'failed'
export type RuntimeAttemptStatus = 'running' | UltraAttemptTerminalStatus

export interface RuntimeAttemptRecord {
  attemptId: string
  chunkId: string
  phaseId: string
  attemptNumber: number
  status: RuntimeAttemptStatus
  started: AttemptStartedEventPayload
  terminal: AttemptTerminalEventPayload | null
}

export interface RuntimeChunkRecord {
  chunkId: string
  phaseId: string
  status: RuntimeChunkStatus
  currentAttemptId: string | null
  priorAttemptCount: number
  attemptIds: string[]
}

export interface UltraAttemptRuntimeProjection {
  chunks: Record<string, RuntimeChunkRecord>
  attempts: Record<string, RuntimeAttemptRecord>
}

export interface PrepareFutureAttemptOptions {
  runRoot: string
  repositoryRoot: string
  ownerId: string
  chunkId: string
  attemptNumber: number
  workerId: string
  workerSessionId: string
  assignmentId: string
  assignmentOrdinal: number
  actualModel: string
  reasoningLevel: string
  outputPath: string
  reusableWorker?: boolean
  renderedPromptPath?: string
  packetPath?: string
  preparedAt?: string
  startedAt?: string
}

export interface RecordFutureAttemptTerminalOptions {
  runRoot: string
  ownerId: string
  chunkId: string
  attemptNumber: number
  status: UltraAttemptTerminalStatus
  validationReportPath: string
  validationErrors?: readonly string[]
  expectedOutputSha256?: string | null
  expectedValidationReportSha256?: string
  completedAt?: string
}

export class UltraAttemptRuntimeError extends Error {
  readonly code: string
  readonly details: Readonly<Record<string, unknown>>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'UltraAttemptRuntimeError'
    this.code = code
    this.details = Object.freeze({ ...details })
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireText(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new UltraAttemptRuntimeError(
      'invalid_operational_run_definition',
      `${label} must be a non-empty string.`,
    )
  }
  return value
}

function requireIsoTimestamp(value: unknown, label: string) {
  const text = requireText(value, label)
  if (!text.includes('T') || !Number.isFinite(Date.parse(text))) {
    throw new UltraAttemptRuntimeError(
      'invalid_operational_run_definition',
      `${label} must be an ISO-8601 timestamp.`,
    )
  }
  return text
}

function requireSha256(value: unknown, label: string) {
  const text = requireText(value, label)
  if (!SHA256_PATTERN.test(text)) {
    throw new UltraAttemptRuntimeError(
      'invalid_operational_run_definition',
      `${label} must be a lowercase SHA-256 digest.`,
    )
  }
  return text
}

function requirePositiveInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new UltraAttemptRuntimeError(
      'invalid_attempt_identity',
      `${label} must be a positive integer.`,
    )
  }
  return Number(value)
}

function validateCheckedArtifact(value: unknown, label: string): VersionedCheckedArtifact {
  if (!isObject(value)) {
    throw new UltraAttemptRuntimeError(
      'invalid_operational_run_definition',
      `${label} must be an object.`,
    )
  }
  return {
    version: requireText(value.version, `${label}.version`),
    path: requireText(value.path, `${label}.path`),
    sha256: requireSha256(value.sha256, `${label}.sha256`),
  }
}

function validateRepositoryAmendments(value: unknown) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw new UltraAttemptRuntimeError(
      'invalid_operational_run_definition',
      'repositoryAmendments must be an array.',
    )
  }
  return value.map((item, index): RepositoryAmendment => {
    if (!isObject(item)) {
      throw new UltraAttemptRuntimeError(
        'invalid_operational_run_definition',
        `repositoryAmendments[${index}] must be an object.`,
      )
    }
    const repositoryCommit = requireText(
      item.repositoryCommit,
      `repositoryAmendments[${index}].repositoryCommit`,
    )
    if (!GIT_COMMIT_PATTERN.test(repositoryCommit)) {
      throw new UltraAttemptRuntimeError(
        'invalid_operational_run_definition',
        `repositoryAmendments[${index}].repositoryCommit is invalid.`,
      )
    }
    return {
      amendmentVersion: requireText(
        item.amendmentVersion,
        `repositoryAmendments[${index}].amendmentVersion`,
      ),
      repositoryCommit,
      approvedAt: requireIsoTimestamp(item.approvedAt, `repositoryAmendments[${index}].approvedAt`),
      approvedBy: requireText(item.approvedBy, `repositoryAmendments[${index}].approvedBy`),
      rationale: requireText(item.rationale, `repositoryAmendments[${index}].rationale`),
    }
  })
}

export function validateOperationalUltraRunDefinition(
  definition: UltraRunDefinitionV2,
): OperationalUltraRunDefinition {
  if (!isObject(definition.dispatchAuthorization)) {
    throw new UltraAttemptRuntimeError(
      'dispatch_not_authorized',
      'Future attempt preparation requires an explicit dispatchAuthorization in the immutable run definition.',
    )
  }
  if (definition.dispatchAuthorization.enabled !== true) {
    throw new UltraAttemptRuntimeError(
      'dispatch_not_authorized',
      `Dispatch authorization ${String(definition.dispatchAuthorization.id ?? 'unknown')} is disabled.`,
      { authorizationId: definition.dispatchAuthorization.id ?? null },
    )
  }
  const repositoryCommit = requireText(definition.repositoryCommit, 'repositoryCommit')
  if (!GIT_COMMIT_PATTERN.test(repositoryCommit)) {
    throw new UltraAttemptRuntimeError(
      'invalid_operational_run_definition',
      'repositoryCommit must be a 40-64 character lowercase Git object ID.',
    )
  }
  const screeningPolicy = validateCheckedArtifact(definition.screeningPolicy, 'screeningPolicy')
  const workerPromptTemplate = validateCheckedArtifact(
    definition.workerPromptTemplate,
    'workerPromptTemplate',
  )
  const workerBootstrapPrompt =
    definition.workerBootstrapPrompt === null || definition.workerBootstrapPrompt === undefined
      ? null
      : validateCheckedArtifact(definition.workerBootstrapPrompt, 'workerBootstrapPrompt')
  const workerOutputRoot = requireText(definition.workerOutputRoot, 'workerOutputRoot')
  for (const packet of definition.packetInventory) {
    if (
      !SAFE_PATH_COMPONENT_PATTERN.test(packet.chunkId) ||
      !SAFE_PATH_COMPONENT_PATTERN.test(packet.phaseId)
    ) {
      throw new UltraAttemptRuntimeError(
        'invalid_operational_run_definition',
        `Packet ${packet.chunkId} has a chunk or phase identifier that is unsafe for deterministic artifact paths.`,
      )
    }
  }
  if (definition.screeningPolicyVersion !== screeningPolicy.version) {
    throw new UltraAttemptRuntimeError(
      'policy_version_mismatch',
      `screeningPolicyVersion ${definition.screeningPolicyVersion} does not match checked artifact version ${screeningPolicy.version}.`,
    )
  }
  const authorization: UltraDispatchAuthorization = {
    version: requireText(definition.dispatchAuthorization.version, 'dispatchAuthorization.version'),
    id: requireText(definition.dispatchAuthorization.id, 'dispatchAuthorization.id'),
    authorizedBy: requireText(
      definition.dispatchAuthorization.authorizedBy,
      'dispatchAuthorization.authorizedBy',
    ),
    authorizedAt: requireIsoTimestamp(
      definition.dispatchAuthorization.authorizedAt,
      'dispatchAuthorization.authorizedAt',
    ),
    enabled: true,
  }
  if (!Number.isSafeInteger(definition.maxRetries) || Number(definition.maxRetries) < 0) {
    throw new UltraAttemptRuntimeError(
      'invalid_operational_run_definition',
      'maxRetries must be a non-negative integer in the immutable run definition.',
    )
  }
  return {
    ...definition,
    repositoryCommit,
    screeningPolicy,
    workerPromptTemplate,
    workerBootstrapPrompt,
    workerOutputRoot,
    repositoryAmendments: validateRepositoryAmendments(definition.repositoryAmendments),
    dispatchAuthorization: authorization,
    maxRetries: Number(definition.maxRetries),
  }
}

function attemptId(chunkId: string, attemptNumber: number) {
  return `${chunkId}.attempt-${attemptNumber}`
}

function normalizeInitialChunkStatus(packet: Record<string, unknown>): RuntimeChunkStatus {
  const candidate = packet.initialStatus ?? packet.finalLegacyStatus
  if (candidate === 'completed') return 'completed'
  if (candidate === 'running') return 'running'
  if (candidate === 'failed') return 'failed'
  return 'pending'
}

function initialAttemptCount(packet: Record<string, unknown>) {
  const candidate = packet.initialAttemptCount ?? packet.legacyAttemptCount ?? 0
  if (!Number.isSafeInteger(candidate) || Number(candidate) < 0) {
    throw new UltraAttemptRuntimeError(
      'invalid_operational_run_definition',
      `Packet ${String(packet.chunkId)} has an invalid initial attempt count.`,
    )
  }
  return Number(candidate)
}

function runtimeStartedPayload(event: UltraStorageEvent): AttemptStartedEventPayload | null {
  if (event.type !== 'attempt_started' || !isObject(event.payload)) return null
  if (event.payload.attemptRuntimeVersion !== ULTRA_ATTEMPT_RUNTIME_VERSION) return null
  if (!isObject(event.payload.provenance)) {
    throw new UltraAttemptRuntimeError(
      'malformed_runtime_event',
      `attempt_started event ${event.sequence} is missing provenance.`,
    )
  }
  const payload = event.payload as unknown as AttemptStartedEventPayload
  if (
    payload.status !== 'running' ||
    payload.provenance.status !== 'running' ||
    payload.attemptId !== attemptId(payload.chunkId, payload.attemptNumber) ||
    payload.startedAt !== payload.provenance.startedAt
  ) {
    throw new UltraAttemptRuntimeError(
      'malformed_runtime_event',
      `attempt_started event ${event.sequence} has inconsistent identity or status.`,
    )
  }
  return payload
}

function runtimeTerminalPayload(event: UltraStorageEvent): AttemptTerminalEventPayload | null {
  if (!['attempt_validated', 'attempt_invalid', 'worker_failed'].includes(event.type)) return null
  if (!isObject(event.payload)) return null
  if (event.payload.attemptRuntimeVersion !== ULTRA_ATTEMPT_RUNTIME_VERSION) return null
  if (!isObject(event.payload.provenance) || !isObject(event.payload.validationOutcome)) {
    throw new UltraAttemptRuntimeError(
      'malformed_runtime_event',
      `Terminal attempt event ${event.sequence} is missing provenance or validation outcome.`,
    )
  }
  const payload = event.payload as unknown as AttemptTerminalEventPayload
  const expectedStatus =
    event.type === 'attempt_validated'
      ? 'validated'
      : event.type === 'attempt_invalid'
        ? 'invalid'
        : 'worker_failed'
  if (
    payload.status !== expectedStatus ||
    payload.validationOutcome.result !==
      (expectedStatus === 'validated' ? 'valid' : expectedStatus) ||
    payload.attemptId !== attemptId(payload.chunkId, payload.attemptNumber)
  ) {
    throw new UltraAttemptRuntimeError(
      'malformed_runtime_event',
      `Terminal attempt event ${event.sequence} has inconsistent identity or status.`,
    )
  }
  return payload
}

function applyLegacyChunkStatus(
  projection: UltraAttemptRuntimeProjection,
  event: UltraStorageEvent,
) {
  if (!isObject(event.payload) || typeof event.payload.chunkId !== 'string') return
  const chunk = projection.chunks[event.payload.chunkId]
  if (!chunk) return
  const status = event.payload.chunkStatusAfter
  if (status === 'completed') chunk.status = 'completed'
  else if (status === 'running') chunk.status = 'running'
  else if (status === 'failed') chunk.status = 'failed'
  else if (status === 'pending' || status === 'retry_pending') chunk.status = 'pending'
}

export function projectUltraAttemptRuntimeState(
  definition: UltraRunDefinitionV2,
  events: readonly UltraStorageEvent[],
): UltraAttemptRuntimeProjection {
  const projection: UltraAttemptRuntimeProjection = { chunks: {}, attempts: {} }
  for (const packet of definition.packetInventory) {
    projection.chunks[packet.chunkId] = {
      chunkId: packet.chunkId,
      phaseId: packet.phaseId,
      status: normalizeInitialChunkStatus(packet),
      currentAttemptId: null,
      priorAttemptCount: initialAttemptCount(packet),
      attemptIds: [],
    }
  }

  for (const event of events) {
    const started = runtimeStartedPayload(event)
    if (started) {
      const chunk = projection.chunks[started.chunkId]
      if (!chunk || chunk.phaseId !== started.phaseId) {
        throw new UltraAttemptRuntimeError(
          'malformed_runtime_event',
          `attempt_started event ${event.sequence} targets an unknown chunk or phase.`,
        )
      }
      if (projection.attempts[started.attemptId]) {
        throw new UltraAttemptRuntimeError(
          'duplicate_runtime_attempt',
          `Attempt ${started.attemptId} appears more than once in the canonical event log.`,
        )
      }
      const expectedAttemptNumber = chunk.priorAttemptCount + chunk.attemptIds.length + 1
      const configuredMaxAttempts =
        Number.isSafeInteger(definition.maxRetries) && Number(definition.maxRetries) >= 0
          ? Number(definition.maxRetries) + 1
          : null
      if (
        started.attemptNumber !== expectedAttemptNumber ||
        (configuredMaxAttempts !== null && started.attemptNumber > configuredMaxAttempts)
      ) {
        throw new UltraAttemptRuntimeError(
          'malformed_runtime_transition',
          `Attempt ${started.attemptId} violates sequential numbering or the configured retry ceiling.`,
          { expectedAttemptNumber, configuredMaxAttempts },
        )
      }
      if (chunk.status !== 'pending') {
        throw new UltraAttemptRuntimeError(
          'malformed_runtime_transition',
          `Attempt ${started.attemptId} started while chunk ${chunk.chunkId} was ${chunk.status}.`,
        )
      }
      projection.attempts[started.attemptId] = {
        attemptId: started.attemptId,
        chunkId: started.chunkId,
        phaseId: started.phaseId,
        attemptNumber: started.attemptNumber,
        status: 'running',
        started,
        terminal: null,
      }
      chunk.status = 'running'
      chunk.currentAttemptId = started.attemptId
      chunk.attemptIds.push(started.attemptId)
      continue
    }

    const terminal = runtimeTerminalPayload(event)
    if (terminal) {
      const attempt = projection.attempts[terminal.attemptId]
      const chunk = projection.chunks[terminal.chunkId]
      if (!attempt || !chunk || attempt.status !== 'running') {
        throw new UltraAttemptRuntimeError(
          'malformed_runtime_transition',
          `Terminal event ${event.sequence} does not match one running attempt.`,
        )
      }
      if (
        attempt.chunkId !== terminal.chunkId ||
        attempt.phaseId !== terminal.phaseId ||
        attempt.attemptNumber !== terminal.attemptNumber ||
        chunk.currentAttemptId !== terminal.attemptId
      ) {
        throw new UltraAttemptRuntimeError(
          'malformed_runtime_transition',
          `Terminal event ${event.sequence} identity differs from its started attempt.`,
        )
      }
      attempt.status = terminal.status
      attempt.terminal = terminal
      chunk.currentAttemptId = null
      chunk.status = terminal.status === 'validated' ? 'completed' : 'pending'
      continue
    }

    if (event.type === 'chunk_completed' && isObject(event.payload)) {
      const chunkId = event.payload.chunkId
      if (typeof chunkId === 'string' && projection.chunks[chunkId]) {
        projection.chunks[chunkId].status = 'completed'
        projection.chunks[chunkId].currentAttemptId = null
      }
    } else if (event.type === 'chunk_failed' && isObject(event.payload)) {
      const chunkId = event.payload.chunkId
      if (typeof chunkId === 'string' && projection.chunks[chunkId]) {
        projection.chunks[chunkId].status = 'failed'
        projection.chunks[chunkId].currentAttemptId = null
      }
    } else {
      applyLegacyChunkStatus(projection, event)
    }
  }
  return projection
}

function assertCanStartAttempt(
  projection: UltraAttemptRuntimeProjection,
  chunkId: string,
  attemptNumber: number,
  maxRetries: number,
) {
  const chunk = projection.chunks[chunkId]
  if (!chunk) {
    throw new UltraAttemptRuntimeError(
      'unknown_chunk',
      `Chunk ${chunkId} is not in the run definition.`,
    )
  }
  const id = attemptId(chunkId, attemptNumber)
  const existing = projection.attempts[id]
  if (existing?.status === 'running') {
    throw new UltraAttemptRuntimeError(
      'attempt_already_running',
      `Attempt ${id} is already running.`,
    )
  }
  if (existing) {
    throw new UltraAttemptRuntimeError(
      'attempt_already_terminal',
      `Attempt ${id} is already terminal with status ${existing.status}.`,
    )
  }
  const expectedAttemptNumber = chunk.priorAttemptCount + chunk.attemptIds.length + 1
  if (attemptNumber !== expectedAttemptNumber) {
    throw new UltraAttemptRuntimeError(
      'attempt_number_out_of_sequence',
      `Chunk ${chunkId} requires attempt ${expectedAttemptNumber}, not attempt ${attemptNumber}.`,
      { chunkId, attemptNumber, expectedAttemptNumber },
    )
  }
  const maxAttempts = maxRetries + 1
  if (attemptNumber > maxAttempts) {
    throw new UltraAttemptRuntimeError(
      'retry_limit_exceeded',
      `Chunk ${chunkId} exhausted its ${maxAttempts} permitted attempts (${maxRetries} retries).`,
      { chunkId, attemptNumber, maxRetries, maxAttempts },
    )
  }
  if (chunk.status === 'completed') {
    throw new UltraAttemptRuntimeError(
      'chunk_completed',
      `Chunk ${chunkId} is already completed and cannot start another attempt.`,
    )
  }
  if (chunk.status !== 'pending') {
    throw new UltraAttemptRuntimeError(
      'chunk_not_pending',
      `Chunk ${chunkId} is ${chunk.status}; only pending chunks can start an attempt.`,
      { chunkId, status: chunk.status, currentAttemptId: chunk.currentAttemptId },
    )
  }
  return chunk
}

function requireMatchingPacket(
  definition: OperationalUltraRunDefinition,
  repositoryRoot: string,
  chunkId: string,
  requestedPacketPath?: string,
) {
  const packet = definition.packetInventory.find((candidate) => candidate.chunkId === chunkId)
  if (!packet) {
    throw new UltraAttemptRuntimeError(
      'unknown_chunk',
      `Chunk ${chunkId} is not in the run definition.`,
    )
  }
  const definedPath = resolve(repositoryRoot, packet.packetPath)
  if (requestedPacketPath && resolve(requestedPacketPath) !== definedPath) {
    throw new UltraAttemptRuntimeError(
      'packet_path_mismatch',
      `Requested packet path differs from the immutable run definition for ${chunkId}.`,
      { definedPath, requestedPath: resolve(requestedPacketPath) },
    )
  }
  return { packet, packetPath: definedPath }
}

function expectedAttemptOutputPath(
  runRoot: string,
  phaseId: string,
  chunkId: string,
  attemptNumber: number,
) {
  return resolve(runRoot, 'worker-outputs', phaseId, `${chunkId}.attempt-${attemptNumber}.jsonl`)
}

function expectedAttemptValidationPath(
  runRoot: string,
  phaseId: string,
  chunkId: string,
  attemptNumber: number,
) {
  return resolve(runRoot, 'validation', phaseId, `${chunkId}.attempt-${attemptNumber}.json`)
}

function assertExactArtifactPath(actual: string, expected: string, label: string) {
  const absoluteActual = resolve(actual)
  if (absoluteActual !== expected) {
    throw new UltraAttemptRuntimeError(
      'artifact_path_mismatch',
      `${label} must use the deterministic path from the run and attempt identity.`,
      { actual: absoluteActual, expected },
    )
  }
  return expected
}

function preparedFromStarted(provenance: StartedAttemptProvenance): PreparedAttemptProvenance {
  return { ...provenance, status: 'prepared', startedAt: null }
}

async function assertPathMissing(path: string, label: string) {
  try {
    await access(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  throw new UltraAttemptRuntimeError('existing_output', `${label} already exists: ${path}`)
}

async function readOperationalContext(runRoot: string) {
  const loaded = await readUltraRunDefinition(runRoot)
  return {
    ...loaded,
    definition: validateOperationalUltraRunDefinition(loaded.definition),
  }
}

export async function prepareFutureUltraAttempt(options: PrepareFutureAttemptOptions) {
  const attemptNumber = requirePositiveInteger(options.attemptNumber, 'attemptNumber')
  const runRoot = resolve(options.runRoot)
  const initialContext = await readOperationalContext(runRoot)
  const initialEvents = await readUltraEventLog(runRoot)
  assertCanStartAttempt(
    projectUltraAttemptRuntimeState(initialContext.definition, initialEvents),
    options.chunkId,
    attemptNumber,
    initialContext.definition.maxRetries,
  )
  const { packet, packetPath } = requireMatchingPacket(
    initialContext.definition,
    options.repositoryRoot,
    options.chunkId,
    options.packetPath,
  )
  const phaseId = packet.phaseId
  const outputPath = assertExactArtifactPath(
    options.outputPath,
    expectedAttemptOutputPath(runRoot, phaseId, options.chunkId, attemptNumber),
    'Output path',
  )

  const preparedAt = options.preparedAt ?? options.startedAt ?? new Date().toISOString()
  const startedAt = options.startedAt ?? preparedAt
  if (!startedAt.includes('T') || !Number.isFinite(Date.parse(startedAt))) {
    throw new UltraAttemptRuntimeError(
      'invalid_attempt_timestamp',
      'startedAt must be an ISO-8601 timestamp.',
    )
  }
  const prepared = await prepareAttemptProvenance({
    repositoryRoot: options.repositoryRoot,
    stateRoot: ultraStorageV2Layout(runRoot).stateDirectory,
    runDefinition: initialContext.definition,
    chunkId: options.chunkId,
    attemptNumber,
    workerId: options.workerId,
    workerSessionId: options.workerSessionId,
    assignmentId: options.assignmentId,
    assignmentOrdinal: options.assignmentOrdinal,
    actualModel: options.actualModel,
    reasoningLevel: options.reasoningLevel,
    packetPath,
    packetSha256: packet.packetSha256,
    outputPath,
    reusableWorker: options.reusableWorker,
    renderedPromptPath: options.renderedPromptPath,
    timestamp: preparedAt,
  })
  if (Date.parse(startedAt) < Date.parse(prepared.provenance.preparedAt)) {
    throw new UltraAttemptRuntimeError(
      'invalid_attempt_timestamp',
      'startedAt must not precede the immutable prompt preparation timestamp.',
    )
  }
  await assertPreparedAttemptIntegrity(prepared.provenance)
  const startedProvenance: StartedAttemptProvenance = {
    ...prepared.provenance,
    status: 'running',
    startedAt,
  }

  const receipt = await withUltraCoordinatorWriter({
    runRoot,
    ownerId: options.ownerId,
    action: async (writer) => {
      const currentContext = await readOperationalContext(runRoot)
      if (currentContext.definitionSha256 !== initialContext.definitionSha256) {
        throw new UltraAttemptRuntimeError(
          'run_definition_changed',
          'Immutable run definition changed during attempt preparation.',
        )
      }
      const events = await readUltraEventLog(runRoot)
      const chunk = assertCanStartAttempt(
        projectUltraAttemptRuntimeState(currentContext.definition, events),
        options.chunkId,
        attemptNumber,
        currentContext.definition.maxRetries,
      )
      await assertPreparedAttemptIntegrity(prepared.provenance)
      await assertPathMissing(prepared.provenance.outputPath, 'Future attempt output')
      const currentRepositoryState = await readTrackedRepositoryState(options.repositoryRoot)
      if (
        !currentRepositoryState.workingTreeClean ||
        currentRepositoryState.repositoryCommit !== startedProvenance.repositoryCommit
      ) {
        throw new UltraAttemptRuntimeError(
          'repository_changed_before_start',
          'Repository state changed after prompt preparation and before attempt recording.',
          { currentRepositoryState },
        )
      }
      const payload: AttemptStartedEventPayload = {
        attemptRuntimeVersion: ULTRA_ATTEMPT_RUNTIME_VERSION,
        runDefinitionSha256: currentContext.definitionSha256,
        attemptId: attemptId(options.chunkId, attemptNumber),
        chunkId: options.chunkId,
        phaseId: chunk.phaseId,
        attemptNumber,
        status: 'running',
        startedAt,
        provenance: startedProvenance,
      }
      return writer.append({ type: 'attempt_started', recordedAt: startedAt, payload })
    },
  })
  return {
    receipt,
    payload: receipt.event.payload as AttemptStartedEventPayload,
    renderedPrompt: prepared.renderedPrompt,
  }
}

function requireTerminalAttempt(
  projection: UltraAttemptRuntimeProjection,
  chunkId: string,
  attemptNumber: number,
) {
  const id = attemptId(chunkId, attemptNumber)
  const attempt = projection.attempts[id]
  if (!attempt) {
    throw new UltraAttemptRuntimeError(
      'attempt_not_running',
      `Attempt ${id} has not been started by the future-attempt runtime.`,
    )
  }
  if (attempt.status !== 'running') {
    throw new UltraAttemptRuntimeError(
      'attempt_already_terminal',
      `Attempt ${id} is already terminal with status ${attempt.status}.`,
    )
  }
  const chunk = projection.chunks[chunkId]
  if (!chunk || chunk.status !== 'running' || chunk.currentAttemptId !== id) {
    throw new UltraAttemptRuntimeError(
      'chunk_not_running_attempt',
      `Chunk ${chunkId} is not running attempt ${id}.`,
    )
  }
  return attempt
}

function validateTerminalErrors(status: UltraAttemptTerminalStatus, errors: readonly string[]) {
  if (errors.some((error) => !error.trim())) {
    throw new UltraAttemptRuntimeError(
      'invalid_validation_errors',
      'Validation errors must be non-empty strings.',
    )
  }
  if (status === 'validated' && errors.length > 0) {
    throw new UltraAttemptRuntimeError(
      'invalid_validation_errors',
      'A validated attempt cannot record validation errors.',
    )
  }
  if (status !== 'validated' && errors.length === 0) {
    throw new UltraAttemptRuntimeError(
      'invalid_validation_errors',
      `${status} requires at least one validation or worker error.`,
    )
  }
}

function assertExpectedHash(
  actual: string | null,
  expected: string | null | undefined,
  label: string,
) {
  if (expected === undefined) return
  if (expected !== null && !SHA256_PATTERN.test(expected)) {
    throw new UltraAttemptRuntimeError('invalid_expected_hash', `${label} is not a SHA-256 digest.`)
  }
  if (actual !== expected) {
    throw new UltraAttemptRuntimeError(
      'terminal_hash_mismatch',
      `${label} mismatch: expected ${expected ?? 'missing'}, received ${actual ?? 'missing'}.`,
      { expected, actual },
    )
  }
}

async function parseJsonFile(path: string, label: string): Promise<unknown> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    throw new UltraAttemptRuntimeError(
      'terminal_artifact_unreadable',
      `${label} could not be read: ${path}`,
      { cause: error instanceof Error ? error.message : String(error) },
    )
  }
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new UltraAttemptRuntimeError(
      'malformed_validation_report',
      `${label} is not valid JSON: ${path}`,
      { cause: error instanceof Error ? error.message : String(error) },
    )
  }
}

async function validateTerminalReport(options: {
  status: UltraAttemptTerminalStatus
  prepared: PreparedAttemptProvenance
  validationReportPath: string
  validationErrors: readonly string[]
}) {
  const suppliedReport = await parseJsonFile(options.validationReportPath, 'Validation report')
  if (options.status === 'worker_failed') {
    if (
      !isObject(suppliedReport) ||
      suppliedReport.valid !== false ||
      typeof suppliedReport.workerError !== 'string' ||
      suppliedReport.workerError.trim().length === 0 ||
      !options.validationErrors.includes(suppliedReport.workerError)
    ) {
      throw new UltraAttemptRuntimeError(
        'validation_report_mismatch',
        'A worker_failed report must contain valid=false and a non-empty workerError matching a recorded worker error.',
      )
    }
    return
  }

  let packet: unknown
  try {
    packet = JSON.parse(await readFile(options.prepared.packetPath, 'utf8')) as unknown
  } catch (error) {
    throw new UltraAttemptRuntimeError(
      'malformed_attempt_packet',
      `Attempt packet cannot be parsed during terminal validation: ${options.prepared.packetPath}`,
      { cause: error instanceof Error ? error.message : String(error) },
    )
  }
  if (!Array.isArray(packet)) {
    throw new UltraAttemptRuntimeError(
      'malformed_attempt_packet',
      'Attempt packet must be a JSON array during terminal validation.',
    )
  }

  let rawOutput: string
  try {
    rawOutput = await readFile(options.prepared.outputPath, 'utf8')
  } catch (error) {
    throw new UltraAttemptRuntimeError(
      'terminal_artifact_unreadable',
      `Worker output could not be read: ${options.prepared.outputPath}`,
      { cause: error instanceof Error ? error.message : String(error) },
    )
  }
  const recomputed: UltraValidationReport = validateUltraWorkerOutput(rawOutput, packet)
  if (stableJson(suppliedReport) !== stableJson(recomputed)) {
    throw new UltraAttemptRuntimeError(
      'validation_report_mismatch',
      'Validation report does not exactly match coordinator recomputation from the immutable packet and worker output.',
    )
  }
  const expectedValid = options.status === 'validated'
  if (recomputed.valid !== expectedValid) {
    throw new UltraAttemptRuntimeError(
      'validation_status_mismatch',
      `Attempt status ${options.status} disagrees with recomputed validation result ${recomputed.valid ? 'valid' : 'invalid'}.`,
    )
  }
  const recomputedErrors = recomputed.errors.map((error) => error.message)
  if (stableJson(options.validationErrors) !== stableJson(recomputedErrors)) {
    throw new UltraAttemptRuntimeError(
      'validation_errors_mismatch',
      'Recorded validation errors do not exactly match the recomputed validation report.',
      { supplied: options.validationErrors, recomputed: recomputedErrors },
    )
  }
}

export async function recordFutureUltraAttemptTerminal(
  options: RecordFutureAttemptTerminalOptions,
) {
  const attemptNumber = requirePositiveInteger(options.attemptNumber, 'attemptNumber')
  const runRoot = resolve(options.runRoot)
  const completedAt = options.completedAt ?? new Date().toISOString()
  const validationErrors = [...(options.validationErrors ?? [])]
  validateTerminalErrors(options.status, validationErrors)

  return withUltraCoordinatorWriter({
    runRoot,
    ownerId: options.ownerId,
    action: async (writer) => {
      const context = await readOperationalContext(runRoot)
      const events = await readUltraEventLog(runRoot)
      const attempt = requireTerminalAttempt(
        projectUltraAttemptRuntimeState(context.definition, events),
        options.chunkId,
        attemptNumber,
      )
      if (attempt.started.runDefinitionSha256 !== context.definitionSha256) {
        throw new UltraAttemptRuntimeError(
          'run_definition_changed',
          'Attempt start references a different immutable run definition.',
        )
      }
      const prepared = preparedFromStarted(attempt.started.provenance)
      await assertPreparedAttemptIntegrity(prepared, { verifyRepositoryState: false })
      const validationReportPath = assertExactArtifactPath(
        options.validationReportPath,
        expectedAttemptValidationPath(
          runRoot,
          attempt.phaseId,
          attempt.chunkId,
          attempt.attemptNumber,
        ),
        'Validation report path',
      )
      await assertNoSymlinkPathEscape(
        resolve(runRoot, 'worker-outputs'),
        prepared.outputPath,
        'Worker output path',
      )
      await assertNoSymlinkPathEscape(
        resolve(runRoot, 'validation'),
        validationReportPath,
        'Validation report path',
      )
      await validateTerminalReport({
        status: options.status,
        prepared,
        validationReportPath,
        validationErrors,
      })
      const provenanceStatus: CompletedAttemptProvenance['status'] =
        options.status === 'validated'
          ? 'completed'
          : options.status === 'invalid'
            ? 'invalid'
            : 'failed'
      const completed = await completeAttemptProvenance({
        prepared,
        status: provenanceStatus,
        startedAt: attempt.started.startedAt,
        completedAt,
        validationReportPath,
        outputMayBeMissing: options.status === 'worker_failed',
      })
      assertExpectedHash(completed.outputSha256, options.expectedOutputSha256, 'Output SHA-256')
      assertExpectedHash(
        completed.validationReportSha256,
        options.expectedValidationReportSha256,
        'Validation report SHA-256',
      )
      const payload: AttemptTerminalEventPayload = {
        attemptRuntimeVersion: ULTRA_ATTEMPT_RUNTIME_VERSION,
        runDefinitionSha256: context.definitionSha256,
        attemptId: attempt.attemptId,
        chunkId: attempt.chunkId,
        phaseId: attempt.phaseId,
        attemptNumber: attempt.attemptNumber,
        status: options.status,
        startedAt: attempt.started.startedAt,
        completedAt,
        validationOutcome: {
          result:
            options.status === 'validated'
              ? 'valid'
              : options.status === 'invalid'
                ? 'invalid'
                : 'worker_failed',
          errors: validationErrors,
        },
        provenance: completed,
      }
      const type =
        options.status === 'validated'
          ? 'attempt_validated'
          : options.status === 'invalid'
            ? 'attempt_invalid'
            : 'worker_failed'
      const receipt = await writer.append({ type, recordedAt: completedAt, payload })
      return { receipt, payload }
    },
  })
}

const HELP = `
Prepare or terminally record an audited future Ultra attempt. This command never dispatches a worker.
Repository, policy, or prompt changes not preapproved in the immutable definition require a new run definition.

Usage:
  tsx scripts/literature/ultra-attempt-runtime.ts prepare --run-root <path> --repository-root <path> --owner-id <id> --chunk <id> --attempt-number <n> --worker-id <id> --worker-session-id <id> --assignment-id <id> --assignment-ordinal <n> --model <model> --reasoning <level> --output <path> [--reusable-worker]
  tsx scripts/literature/ultra-attempt-runtime.ts terminal-record --run-root <path> --owner-id <id> --chunk <id> --attempt-number <n> --status <validated|invalid|worker_failed> --validation-report <path> [--validation-error <text>]
`.trim()

function requiredArgument(arguments_: ParsedCliArguments, key: string) {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

async function prepareCommand(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, [
    'run-root',
    'repository-root',
    'owner-id',
    'chunk',
    'attempt-number',
    'worker-id',
    'worker-session-id',
    'assignment-id',
    'assignment-ordinal',
    'model',
    'reasoning',
    'output',
    'packet',
    'rendered-prompt',
    'reusable-worker',
    'prepared-at',
    'started-at',
  ])
  const result = await prepareFutureUltraAttempt({
    runRoot: requiredArgument(arguments_, 'run-root'),
    repositoryRoot: requiredArgument(arguments_, 'repository-root'),
    ownerId: requiredArgument(arguments_, 'owner-id'),
    chunkId: requiredArgument(arguments_, 'chunk'),
    attemptNumber: numberArgument(arguments_, 'attempt-number') ?? 0,
    workerId: requiredArgument(arguments_, 'worker-id'),
    workerSessionId: requiredArgument(arguments_, 'worker-session-id'),
    assignmentId: requiredArgument(arguments_, 'assignment-id'),
    assignmentOrdinal: numberArgument(arguments_, 'assignment-ordinal') ?? 0,
    actualModel: requiredArgument(arguments_, 'model'),
    reasoningLevel: requiredArgument(arguments_, 'reasoning'),
    outputPath: requiredArgument(arguments_, 'output'),
    packetPath: stringArgument(arguments_, 'packet'),
    renderedPromptPath: stringArgument(arguments_, 'rendered-prompt'),
    reusableWorker: hasFlag(arguments_, 'reusable-worker'),
    preparedAt: stringArgument(arguments_, 'prepared-at'),
    startedAt: stringArgument(arguments_, 'started-at'),
  })
  console.log(JSON.stringify(result.payload, null, 2))
}

async function terminalCommand(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, [
    'run-root',
    'owner-id',
    'chunk',
    'attempt-number',
    'status',
    'validation-report',
    'validation-error',
    'expected-output-sha256',
    'expected-validation-sha256',
    'completed-at',
  ])
  const status = requiredArgument(arguments_, 'status')
  if (!['validated', 'invalid', 'worker_failed'].includes(status)) {
    throw new Error('--status must be validated, invalid, or worker_failed.')
  }
  const result = await recordFutureUltraAttemptTerminal({
    runRoot: requiredArgument(arguments_, 'run-root'),
    ownerId: requiredArgument(arguments_, 'owner-id'),
    chunkId: requiredArgument(arguments_, 'chunk'),
    attemptNumber: numberArgument(arguments_, 'attempt-number') ?? 0,
    status: status as UltraAttemptTerminalStatus,
    validationReportPath: requiredArgument(arguments_, 'validation-report'),
    validationErrors: arguments_.values.get('validation-error') ?? [],
    expectedOutputSha256: stringArgument(arguments_, 'expected-output-sha256'),
    expectedValidationReportSha256: stringArgument(arguments_, 'expected-validation-sha256'),
    completedAt: stringArgument(arguments_, 'completed-at'),
  })
  console.log(JSON.stringify(result.payload, null, 2))
}

export async function runUltraAttemptRuntimeCli(argv: readonly string[]) {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === 'help') {
    console.log(HELP)
    return
  }
  const arguments_ = parseCliArguments(rest)
  if (command === 'prepare') await prepareCommand(arguments_)
  else if (command === 'terminal-record') await terminalCommand(arguments_)
  else throw new Error(`Unknown command ${command}.\n\n${HELP}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runUltraAttemptRuntimeCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
