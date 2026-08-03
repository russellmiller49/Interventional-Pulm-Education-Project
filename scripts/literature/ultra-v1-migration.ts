import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, readFile, readdir, stat } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'

import {
  UltraStorageV2Error,
  canonicalJson,
  initializeUltraStorageV2,
  loadLatestUltraCheckpoint,
  readUltraEventLog,
  readUltraRunDefinition,
  reconstructUltraState,
  ultraStorageV2Layout,
  withUltraCoordinatorWriter,
  type UltraPacketDefinitionV2,
  type UltraRunDefinitionV2,
  type UltraStorageEvent,
  type UltraStorageEventInput,
} from './ultra-storage-v2'

export const ULTRA_V1_MIGRATION_VERSION = '1.0.0' as const
export const UNAVAILABLE_LEGACY = 'unavailable_legacy' as const

const GIT_COMMIT_PATTERN = /^[a-f0-9]{40}$/u

type LegacyPhaseStatus = 'pending' | 'running' | 'completed' | 'failed'
type LegacyChunkStatus = 'pending' | 'running' | 'retry_pending' | 'completed' | 'failed'
type LegacyAttemptStatus = 'running' | 'invalid' | 'completed' | 'failed'

export interface LegacyWorkerAttempt {
  attemptNumber: number
  agentId: string
  model: string
  reasoningLevel: string
  assignedPmids: string[]
  status: LegacyAttemptStatus
  outputPath: string
  startedAt: string
  completedAt: string | null
  outputSha256: string | null
  validationPath: string | null
  validationResult: 'valid' | 'invalid' | 'worker_failed' | null
  validationErrors: string[]
}

export interface LegacyScreeningChunk {
  id: string
  phaseId: string
  index: number
  status: LegacyChunkStatus
  assignedPmids: string[]
  inputPath: string
  packetSha256: string
  validatedOutputPath: string
  validatedOutputSha256: string | null
  attempts: LegacyWorkerAttempt[]
}

export interface LegacyScreeningPhase {
  id: string
  kind: string
  expectedModelFamily: string
  status: LegacyPhaseStatus
  createdAt: string
  completedAt: string | null
  seed: string
  selectedCount: number
  chunkSize: number
  requestedWorkerCount: number
  chunkIds: string[]
  sourcePhaseIds: string[]
  sourceSnapshotSha256: string
  aggregateOutputPath: string
  aggregateOutputSha256: string | null
  selectionAuditPath: string | null
}

export interface LegacyDispatchBlocker {
  recordedAt: string
  chunkId: string
  requestedModel: string
  reasoningLevel: string
  error: string
}

export interface LegacyAllocationChange {
  recordedAt: string
  phaseId: string
  fromModelFamily: string
  toModelFamily: string
  authorizedBy: string
  authorization: string
  rationale: string
}

export interface LegacyScreeningManifest {
  manifestVersion: string
  schemaVersion: string
  runId: string
  rootPath: string
  createdAt: string
  updatedAt: string
  maxRetries: number
  databaseSnapshot: Record<string, unknown>
  phases: Record<string, LegacyScreeningPhase>
  chunks: Record<string, LegacyScreeningChunk>
  dispatchBlockers: LegacyDispatchBlocker[]
  allocationChanges: LegacyAllocationChange[]
}

export interface RawLegacyArtifact {
  relativePath: string
  byteSize: number
  sha256: string
}

export interface LegacyPhaseRegistration {
  phase: LegacyScreeningPhase
  chunks: LegacyScreeningChunk[]
  definitionSha256: string
}

export interface MigratedPacketDefinition extends UltraPacketDefinitionV2 {
  chunkId: string
  phaseId: string
  packetPath: string
  packetSha256: string
  legacyCanonicalPacketSha256: string
  chunkIndex: number
  assignedPmids: string[]
  finalLegacyStatus: LegacyChunkStatus
  legacyAttemptCount: number
  validatedOutputPath: string
  validatedOutputSha256: string | null
}

export interface LegacyUnavailableProvenance {
  repositoryCommit: typeof UNAVAILABLE_LEGACY
  workingTreeClean: typeof UNAVAILABLE_LEGACY
  screeningPolicyVersion: typeof UNAVAILABLE_LEGACY
  screeningPolicyPath: typeof UNAVAILABLE_LEGACY
  screeningPolicySha256: typeof UNAVAILABLE_LEGACY
  workerPromptTemplateVersion: typeof UNAVAILABLE_LEGACY
  workerPromptTemplatePath: typeof UNAVAILABLE_LEGACY
  workerPromptTemplateSha256: typeof UNAVAILABLE_LEGACY
  renderedPromptPath: typeof UNAVAILABLE_LEGACY
  renderedPromptSha256: typeof UNAVAILABLE_LEGACY
  workerBootstrapPromptPath: typeof UNAVAILABLE_LEGACY
  workerBootstrapPromptSha256: typeof UNAVAILABLE_LEGACY
  workerSessionId: typeof UNAVAILABLE_LEGACY
  assignmentId: typeof UNAVAILABLE_LEGACY
  assignmentOrdinal: typeof UNAVAILABLE_LEGACY
}

export interface MigratedUltraRunDefinition extends UltraRunDefinitionV2 {
  migrationVersion: typeof ULTRA_V1_MIGRATION_VERSION
  migrationGitCommit: string
  sourceV1: {
    rootPath: string
    progressManifestPath: string
    progressManifestSha256: string
    manifestVersion: string
    schemaVersion: string
    historySnapshotCount: number
    firstSnapshotSha256: string
    finalSnapshotSha256: string
  }
  dispatchAuthorization: {
    status: 'disabled_requires_versioned_authorization'
    reason: string
  }
  legacyUnavailableProvenance: LegacyUnavailableProvenance
  phaseConfiguration: {
    registrations: Record<string, LegacyPhaseRegistration>
  }
  packetInventory: MigratedPacketDefinition[]
  rawArtifactInventory: RawLegacyArtifact[]
  rawArtifactInventorySha256: string
  legacyInitialProjection: LegacyScreeningManifest
  legacyFinalProjectionSha256: string
}

export interface LegacyMigrationCounts {
  phaseCount: number
  chunkCount: number
  phaseStatusCounts: Record<string, number>
  chunkStatusCounts: Record<string, number>
  attemptCount: number
  attemptStatusCounts: Record<string, number>
  validationResultCounts: Record<string, number>
  invalidAttemptCount: number
  completedOutputCount: number
  dispatchBlockerCount: number
  allocationChangeCount: number
  nextPendingChunk: string | null
}

export interface UltraV1MigrationPlan {
  sourceRoot: string
  destinationRoot: string
  sourceManifestPath: string
  sourceManifestSha256: string
  runDefinition: MigratedUltraRunDefinition
  events: UltraStorageEventInput[]
  finalProjection: LegacyScreeningManifest
  finalProjectionSha256: string
  counts: LegacyMigrationCounts
}

export interface UltraV1MigrationEquivalence {
  equivalent: boolean
  sourceManifestSha256: string
  runDefinitionSha256: string
  eventCount: number
  finalEventSequence: number
  finalEventHash: string
  finalProjectionSha256: string
  rawArtifactCount: number
  rawArtifactInventorySha256: string
  counts: LegacyMigrationCounts
}

export class UltraV1MigrationError extends Error {
  readonly code: string
  readonly details: Readonly<Record<string, unknown>>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'UltraV1MigrationError'
    this.code = code
    this.details = Object.freeze({ ...details })
  }
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

async function sha256File(path: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value
}

function normalizeLegacyManifest(value: unknown, path: string): LegacyScreeningManifest {
  if (!isPlainObject(value)) {
    throw new UltraV1MigrationError('invalid_v1_manifest', `${path} must contain a JSON object.`)
  }
  const requiredStrings = [
    'manifestVersion',
    'schemaVersion',
    'runId',
    'rootPath',
    'createdAt',
    'updatedAt',
  ] as const
  for (const key of requiredStrings) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new UltraV1MigrationError('invalid_v1_manifest', `${path} has an invalid ${key}.`)
    }
  }
  if (!Number.isSafeInteger(value.maxRetries) || !isPlainObject(value.databaseSnapshot)) {
    throw new UltraV1MigrationError(
      'invalid_v1_manifest',
      `${path} has invalid retry or database snapshot metadata.`,
    )
  }
  if (!isPlainObject(value.phases) || !isPlainObject(value.chunks)) {
    throw new UltraV1MigrationError(
      'invalid_v1_manifest',
      `${path} must contain phase and chunk maps.`,
    )
  }
  const dispatchBlockers = value.dispatchBlockers ?? []
  const allocationChanges = value.allocationChanges ?? []
  if (!Array.isArray(dispatchBlockers) || !Array.isArray(allocationChanges)) {
    throw new UltraV1MigrationError(
      'invalid_v1_manifest',
      `${path} has invalid blocker or allocation arrays.`,
    )
  }
  return clone({
    ...(value as unknown as LegacyScreeningManifest),
    dispatchBlockers,
    allocationChanges,
  })
}

async function readLegacyManifest(path: string) {
  const raw = await readFile(path, 'utf8')
  const digest = sha256(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (error) {
    throw new UltraV1MigrationError('invalid_v1_manifest', `${path} is not valid JSON.`, {
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  return { manifest: normalizeLegacyManifest(parsed, path), digest }
}

async function listFiles(rootPath: string) {
  const files: string[] = []
  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) files.push(path)
      else {
        throw new UltraV1MigrationError(
          'unsupported_v1_artifact',
          `Legacy runtime contains a non-file artifact: ${path}`,
        )
      }
    }
  }
  await visit(rootPath)
  return files
}

export async function inventoryLegacyArtifacts(rootPath: string) {
  const absoluteRoot = resolve(rootPath)
  const files = await listFiles(absoluteRoot)
  const inventory: RawLegacyArtifact[] = []
  for (const path of files) {
    const metadata = await stat(path)
    inventory.push({
      relativePath: relative(absoluteRoot, path),
      byteSize: metadata.size,
      sha256: await sha256File(path),
    })
  }
  inventory.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  return {
    inventory,
    inventorySha256: sha256(canonicalJson(inventory)),
  }
}

function unavailableLegacyProvenance(): LegacyUnavailableProvenance {
  return {
    repositoryCommit: UNAVAILABLE_LEGACY,
    workingTreeClean: UNAVAILABLE_LEGACY,
    screeningPolicyVersion: UNAVAILABLE_LEGACY,
    screeningPolicyPath: UNAVAILABLE_LEGACY,
    screeningPolicySha256: UNAVAILABLE_LEGACY,
    workerPromptTemplateVersion: UNAVAILABLE_LEGACY,
    workerPromptTemplatePath: UNAVAILABLE_LEGACY,
    workerPromptTemplateSha256: UNAVAILABLE_LEGACY,
    renderedPromptPath: UNAVAILABLE_LEGACY,
    renderedPromptSha256: UNAVAILABLE_LEGACY,
    workerBootstrapPromptPath: UNAVAILABLE_LEGACY,
    workerBootstrapPromptSha256: UNAVAILABLE_LEGACY,
    workerSessionId: UNAVAILABLE_LEGACY,
    assignmentId: UNAVAILABLE_LEGACY,
    assignmentOrdinal: UNAVAILABLE_LEGACY,
  }
}

function artifactByAbsolutePath(rootPath: string, inventory: readonly RawLegacyArtifact[]) {
  return new Map(inventory.map((item) => [resolve(rootPath, item.relativePath), item] as const))
}

function transitionEnvelope(
  ordinal: number,
  beforeManifestSha256: string,
  afterManifestSha256: string,
  after: LegacyScreeningManifest,
) {
  return {
    migrationVersion: ULTRA_V1_MIGRATION_VERSION,
    legacyTransition: { ordinal, beforeManifestSha256, afterManifestSha256 },
    manifestUpdatedAtAfter: after.updatedAt,
  }
}

function attemptProvenance(
  rootPath: string,
  chunk: LegacyScreeningChunk,
  attempt: LegacyWorkerAttempt,
  artifacts: ReadonlyMap<string, RawLegacyArtifact>,
) {
  return {
    ...unavailableLegacyProvenance(),
    legacyAgentId: attempt.agentId,
    actualModel: attempt.model,
    reasoningLevel: attempt.reasoningLevel,
    packetPath: chunk.inputPath,
    legacyCanonicalPacketSha256: chunk.packetSha256,
    packetSha256: artifacts.get(resolve(chunk.inputPath))?.sha256 ?? UNAVAILABLE_LEGACY,
    outputPath: attempt.outputPath,
    outputSha256: attempt.outputSha256,
    validationPath: attempt.validationPath,
    validationSha256: attempt.validationPath
      ? (artifacts.get(resolve(attempt.validationPath))?.sha256 ?? UNAVAILABLE_LEGACY)
      : null,
    sourceRoot: rootPath,
  }
}

function registrationFromSnapshot(
  manifest: LegacyScreeningManifest,
  phaseId: string,
): LegacyPhaseRegistration {
  const phase = manifest.phases[phaseId]
  if (!phase) {
    throw new UltraV1MigrationError(
      'invalid_v1_transition',
      `Registered phase ${phaseId} is missing from its snapshot.`,
    )
  }
  const chunks = phase.chunkIds.map((chunkId) => {
    const chunk = manifest.chunks[chunkId]
    if (!chunk) {
      throw new UltraV1MigrationError(
        'invalid_v1_transition',
        `Registered phase ${phaseId} is missing chunk ${chunkId}.`,
      )
    }
    return clone(chunk)
  })
  const definition = { phase: clone(phase), chunks }
  return { ...definition, definitionSha256: sha256(canonicalJson(definition)) }
}

function eventInput(event: UltraStorageEvent): UltraStorageEventInput {
  return { type: event.type, recordedAt: event.recordedAt, payload: event.payload }
}

function applyLegacyMigrationEvent(
  source: LegacyScreeningManifest,
  input: UltraStorageEventInput,
  registrations: Readonly<Record<string, LegacyPhaseRegistration>>,
) {
  const state = clone(source)
  if (!isPlainObject(input.payload)) {
    throw new UltraV1MigrationError('invalid_migration_event', `${input.type} payload is invalid.`)
  }
  const payload = input.payload
  const updatedAt = String(payload.manifestUpdatedAtAfter)
  switch (input.type) {
    case 'phase_registered': {
      const phaseId = String(payload.phaseId)
      const registration = registrations[phaseId]
      if (!registration || registration.definitionSha256 !== payload.phaseDefinitionSha256) {
        throw new UltraV1MigrationError(
          'phase_definition_mismatch',
          `No matching immutable registration exists for ${phaseId}.`,
        )
      }
      state.phases[phaseId] = clone(registration.phase)
      for (const chunk of registration.chunks) state.chunks[chunk.id] = clone(chunk)
      break
    }
    case 'allocation_changed': {
      const change = clone(payload.change as unknown as LegacyAllocationChange)
      state.allocationChanges.push(change)
      state.phases[change.phaseId].expectedModelFamily = String(payload.expectedModelFamilyAfter)
      break
    }
    case 'dispatch_blocked':
      state.dispatchBlockers.push(clone(payload.blocker as unknown as LegacyDispatchBlocker))
      break
    case 'attempt_started': {
      const chunkId = String(payload.chunkId)
      const phaseId = String(payload.phaseId)
      state.chunks[chunkId].attempts.push(clone(payload.attempt as unknown as LegacyWorkerAttempt))
      state.chunks[chunkId].status = payload.chunkStatusAfter as LegacyChunkStatus
      state.phases[phaseId].status = payload.phaseStatusAfter as LegacyPhaseStatus
      state.phases[phaseId].completedAt = (payload.phaseCompletedAtAfter as string | null) ?? null
      break
    }
    case 'attempt_validated':
    case 'attempt_invalid':
    case 'worker_failed': {
      const chunkId = String(payload.chunkId)
      const phaseId = String(payload.phaseId)
      const attempt = clone(payload.attempt as unknown as LegacyWorkerAttempt)
      state.chunks[chunkId].attempts[attempt.attemptNumber - 1] = attempt
      state.chunks[chunkId].status = payload.chunkStatusAfter as LegacyChunkStatus
      state.chunks[chunkId].validatedOutputSha256 =
        (payload.validatedOutputSha256After as string | null) ?? null
      state.phases[phaseId].status = payload.phaseStatusAfter as LegacyPhaseStatus
      state.phases[phaseId].completedAt = (payload.phaseCompletedAtAfter as string | null) ?? null
      state.phases[phaseId].aggregateOutputSha256 =
        (payload.aggregateOutputSha256After as string | null) ?? null
      break
    }
    default:
      throw new UltraV1MigrationError(
        'unsupported_migration_event',
        `Unsupported legacy migration event ${input.type}.`,
      )
  }
  state.updatedAt = updatedAt
  return state
}

function assertTransitionReplays(
  before: LegacyScreeningManifest,
  after: LegacyScreeningManifest,
  event: UltraStorageEventInput,
  registrations: Readonly<Record<string, LegacyPhaseRegistration>>,
) {
  const replayed = applyLegacyMigrationEvent(before, event, registrations)
  if (canonicalJson(replayed) !== canonicalJson(after)) {
    throw new UltraV1MigrationError(
      'unreconstructable_v1_transition',
      `Legacy transition ${String((event.payload as Record<string, unknown>).manifestUpdatedAtAfter)} cannot be represented without data loss.`,
      { eventType: event.type },
    )
  }
}

function reconstructTransition(options: {
  ordinal: number
  before: LegacyScreeningManifest
  after: LegacyScreeningManifest
  beforeSha256: string
  afterSha256: string
  sourceRoot: string
  artifacts: ReadonlyMap<string, RawLegacyArtifact>
  registrations: Record<string, LegacyPhaseRegistration>
}): UltraStorageEventInput {
  const { before, after } = options
  const addedPhaseIds = Object.keys(after.phases).filter((phaseId) => !before.phases[phaseId])
  const addedChunkIds = Object.keys(after.chunks).filter((chunkId) => !before.chunks[chunkId])
  const blockerDelta = after.dispatchBlockers.length - before.dispatchBlockers.length
  const allocationDelta = after.allocationChanges.length - before.allocationChanges.length
  const started: Array<{ chunk: LegacyScreeningChunk; attempt: LegacyWorkerAttempt }> = []
  const finished: Array<{ chunk: LegacyScreeningChunk; attempt: LegacyWorkerAttempt }> = []

  for (const chunk of Object.values(after.chunks)) {
    const priorChunk = before.chunks[chunk.id]
    if (!priorChunk) continue
    if (chunk.attempts.length === priorChunk.attempts.length + 1) {
      started.push({ chunk, attempt: chunk.attempts.at(-1) as LegacyWorkerAttempt })
    } else if (chunk.attempts.length !== priorChunk.attempts.length) {
      throw new UltraV1MigrationError(
        'invalid_v1_transition',
        `Chunk ${chunk.id} changed by more than one attempt in a single manifest save.`,
      )
    }
    for (let index = 0; index < priorChunk.attempts.length; index += 1) {
      if (canonicalJson(chunk.attempts[index]) !== canonicalJson(priorChunk.attempts[index])) {
        finished.push({ chunk, attempt: chunk.attempts[index] })
      }
    }
  }

  const categories = [
    addedPhaseIds.length > 0,
    blockerDelta !== 0,
    allocationDelta !== 0,
    started.length > 0,
    finished.length > 0,
  ].filter(Boolean).length
  if (
    categories !== 1 ||
    addedPhaseIds.length > 1 ||
    blockerDelta < 0 ||
    blockerDelta > 1 ||
    allocationDelta < 0 ||
    allocationDelta > 1 ||
    started.length > 1 ||
    finished.length > 1
  ) {
    throw new UltraV1MigrationError(
      'ambiguous_v1_transition',
      `Legacy snapshots ${before.updatedAt} and ${after.updatedAt} contain an ambiguous transition.`,
      {
        addedPhaseIds,
        addedChunkCount: addedChunkIds.length,
        blockerDelta,
        allocationDelta,
        startedCount: started.length,
        finishedCount: finished.length,
      },
    )
  }

  const base = transitionEnvelope(options.ordinal, options.beforeSha256, options.afterSha256, after)
  let event: UltraStorageEventInput
  if (addedPhaseIds.length === 1) {
    const phaseId = addedPhaseIds[0]
    const registration = registrationFromSnapshot(after, phaseId)
    options.registrations[phaseId] = registration
    event = {
      type: 'phase_registered',
      recordedAt: after.updatedAt,
      payload: {
        ...base,
        phaseId,
        phaseDefinitionSha256: registration.definitionSha256,
        chunkCount: registration.chunks.length,
      },
    }
  } else if (allocationDelta === 1) {
    const change = after.allocationChanges.at(-1) as LegacyAllocationChange
    event = {
      type: 'allocation_changed',
      recordedAt: after.updatedAt,
      payload: {
        ...base,
        change,
        expectedModelFamilyAfter: after.phases[change.phaseId].expectedModelFamily,
      },
    }
  } else if (blockerDelta === 1) {
    event = {
      type: 'dispatch_blocked',
      recordedAt: after.updatedAt,
      payload: { ...base, blocker: after.dispatchBlockers.at(-1) as LegacyDispatchBlocker },
    }
  } else if (started.length === 1) {
    const { chunk, attempt } = started[0]
    const phase = after.phases[chunk.phaseId]
    event = {
      type: 'attempt_started',
      recordedAt: after.updatedAt,
      payload: {
        ...base,
        chunkId: chunk.id,
        phaseId: chunk.phaseId,
        attempt,
        provenance: attemptProvenance(options.sourceRoot, chunk, attempt, options.artifacts),
        chunkStatusAfter: chunk.status,
        phaseStatusAfter: phase.status,
        phaseCompletedAtAfter: phase.completedAt,
      },
    }
  } else {
    const { chunk, attempt } = finished[0]
    const phase = after.phases[chunk.phaseId]
    const type =
      attempt.validationResult === 'valid'
        ? 'attempt_validated'
        : attempt.validationResult === 'invalid'
          ? 'attempt_invalid'
          : 'worker_failed'
    event = {
      type,
      recordedAt: after.updatedAt,
      payload: {
        ...base,
        chunkId: chunk.id,
        phaseId: chunk.phaseId,
        attempt,
        provenance: attemptProvenance(options.sourceRoot, chunk, attempt, options.artifacts),
        chunkStatusAfter: chunk.status,
        validatedOutputSha256After: chunk.validatedOutputSha256,
        phaseStatusAfter: phase.status,
        phaseCompletedAtAfter: phase.completedAt,
        aggregateOutputSha256After: phase.aggregateOutputSha256,
      },
    }
  }
  assertTransitionReplays(before, after, event, options.registrations)
  return event
}

function countValues(values: readonly (string | null)[]) {
  const counts: Record<string, number> = {}
  for (const value of values) {
    const key = value ?? 'null'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

export function legacyMigrationCounts(manifest: LegacyScreeningManifest): LegacyMigrationCounts {
  const phases = Object.values(manifest.phases)
  const chunks = Object.values(manifest.chunks)
  const attempts = chunks.flatMap((chunk) => chunk.attempts)
  const phaseOrder = new Map(Object.keys(manifest.phases).map((phaseId, index) => [phaseId, index]))
  const nextPending = chunks
    .filter((chunk) => chunk.status === 'pending')
    .sort(
      (left, right) =>
        (phaseOrder.get(left.phaseId) ?? Number.MAX_SAFE_INTEGER) -
          (phaseOrder.get(right.phaseId) ?? Number.MAX_SAFE_INTEGER) || left.index - right.index,
    )[0]
  return {
    phaseCount: phases.length,
    chunkCount: chunks.length,
    phaseStatusCounts: countValues(phases.map((phase) => phase.status)),
    chunkStatusCounts: countValues(chunks.map((chunk) => chunk.status)),
    attemptCount: attempts.length,
    attemptStatusCounts: countValues(attempts.map((attempt) => attempt.status)),
    validationResultCounts: countValues(attempts.map((attempt) => attempt.validationResult)),
    invalidAttemptCount: attempts.filter((attempt) => attempt.status === 'invalid').length,
    completedOutputCount: chunks.filter(
      (chunk) => chunk.status === 'completed' && chunk.validatedOutputSha256 !== null,
    ).length,
    dispatchBlockerCount: manifest.dispatchBlockers.length,
    allocationChangeCount: manifest.allocationChanges.length,
    nextPendingChunk: nextPending?.id ?? null,
  }
}

function historyFilenameMatches(path: string, digest: string) {
  const match = basename(path).match(/-([a-f0-9]{12})\.json$/u)
  return match?.[1] === digest.slice(0, 12)
}

export function defaultUltraV1MigrationDestination(v1Root: string) {
  return `${resolve(v1Root)}-v2`
}

function assertDistinctSiblingDestination(sourceRoot: string, destinationRoot: string) {
  if (destinationRoot === sourceRoot || dirname(destinationRoot) !== dirname(sourceRoot)) {
    throw new UltraV1MigrationError(
      'invalid_migration_destination',
      'The v2 destination must be a distinct sibling of the v1 run root.',
      { sourceRoot, destinationRoot },
    )
  }
}

export async function buildUltraV1MigrationPlan(options: {
  v1Root: string
  migrationGitCommit: string
  expectedSourceManifestSha256?: string
  destinationRoot?: string
}) {
  const sourceRoot = resolve(options.v1Root)
  const destinationRoot = resolve(
    options.destinationRoot ?? defaultUltraV1MigrationDestination(sourceRoot),
  )
  assertDistinctSiblingDestination(sourceRoot, destinationRoot)
  if (!GIT_COMMIT_PATTERN.test(options.migrationGitCommit)) {
    throw new UltraV1MigrationError(
      'invalid_migration_git_commit',
      'migrationGitCommit must be a full lowercase 40-character Git commit.',
    )
  }
  const sourceManifestPath = resolve(sourceRoot, 'progress-manifest.json')
  let initialSourceManifestSha256: string
  try {
    initialSourceManifestSha256 = await sha256File(sourceManifestPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new UltraV1MigrationError(
        'source_manifest_missing',
        `Source progress manifest is missing at ${sourceManifestPath}.`,
      )
    }
    throw error
  }
  if (
    options.expectedSourceManifestSha256 &&
    options.expectedSourceManifestSha256 !== initialSourceManifestSha256
  ) {
    throw new UltraV1MigrationError(
      'source_manifest_checksum_mismatch',
      'Source progress manifest checksum does not match the required checksum.',
      {
        expected: options.expectedSourceManifestSha256,
        actual: initialSourceManifestSha256,
      },
    )
  }
  const { inventory, inventorySha256 } = await inventoryLegacyArtifacts(sourceRoot)
  const artifacts = artifactByAbsolutePath(sourceRoot, inventory)
  const sourceManifestArtifact = artifacts.get(sourceManifestPath)
  if (!sourceManifestArtifact) {
    throw new UltraV1MigrationError(
      'source_manifest_missing',
      `Source progress manifest is missing at ${sourceManifestPath}.`,
    )
  }
  if (sourceManifestArtifact.sha256 !== initialSourceManifestSha256) {
    throw new UltraV1MigrationError(
      'artifact_changed_during_migration',
      'Source progress manifest changed while the migration inventory was being created.',
      {
        expected: initialSourceManifestSha256,
        actual: sourceManifestArtifact.sha256,
      },
    )
  }

  const historyDirectory = resolve(sourceRoot, 'manifest-history')
  const historyEntries = (await readdir(historyDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => resolve(historyDirectory, entry.name))
    .sort((left, right) => left.localeCompare(right))
  if (historyEntries.length === 0) {
    throw new UltraV1MigrationError(
      'source_history_missing',
      `No legacy manifest snapshots exist under ${historyDirectory}.`,
    )
  }

  const registrations: Record<string, LegacyPhaseRegistration> = {}
  const events: UltraStorageEventInput[] = []
  let previous: LegacyScreeningManifest | null = null
  let previousSha256 = ''
  let initialProjection: LegacyScreeningManifest | null = null
  let firstSnapshotSha256 = ''
  let priorUpdatedAt = Number.NEGATIVE_INFINITY

  for (const path of [...historyEntries, sourceManifestPath]) {
    const artifact = artifacts.get(path)
    if (!artifact) {
      throw new UltraV1MigrationError(
        'artifact_inventory_mismatch',
        `Manifest snapshot ${path} is absent from the raw artifact inventory.`,
      )
    }
    const { manifest, digest } = await readLegacyManifest(path)
    if (digest !== artifact.sha256) {
      throw new UltraV1MigrationError(
        'artifact_changed_during_migration',
        `Manifest snapshot changed while the migration plan was being built: ${path}`,
      )
    }
    if (path !== sourceManifestPath && !historyFilenameMatches(path, digest)) {
      throw new UltraV1MigrationError(
        'history_filename_checksum_mismatch',
        `Manifest history filename does not match its contents: ${path}`,
      )
    }
    const updatedAt = Date.parse(manifest.updatedAt)
    if (!Number.isFinite(updatedAt) || updatedAt <= priorUpdatedAt) {
      throw new UltraV1MigrationError(
        'history_order_mismatch',
        `Legacy manifest snapshots are not strictly ordered at ${path}.`,
      )
    }
    priorUpdatedAt = updatedAt
    if (!previous) {
      initialProjection = clone(manifest)
      firstSnapshotSha256 = digest
      for (const phaseId of Object.keys(manifest.phases)) {
        registrations[phaseId] = registrationFromSnapshot(manifest, phaseId)
      }
    } else {
      events.push(
        reconstructTransition({
          ordinal: events.length + 1,
          before: previous,
          after: manifest,
          beforeSha256: previousSha256,
          afterSha256: digest,
          sourceRoot,
          artifacts,
          registrations,
        }),
      )
    }
    previous = manifest
    previousSha256 = digest
  }
  if (!initialProjection || !previous) {
    throw new UltraV1MigrationError('source_history_missing', 'Legacy manifest history is empty.')
  }
  const finalProjection = previous
  const finalProjectionSha256 = sha256(canonicalJson(finalProjection))

  const packetInventory: MigratedPacketDefinition[] = Object.values(finalProjection.chunks)
    .sort((left, right) => left.phaseId.localeCompare(right.phaseId) || left.index - right.index)
    .map((chunk) => {
      const packetArtifact = artifacts.get(resolve(chunk.inputPath))
      if (!packetArtifact) {
        throw new UltraV1MigrationError(
          'packet_artifact_missing',
          `Packet ${chunk.inputPath} is missing from the raw artifact inventory.`,
        )
      }
      return {
        chunkId: chunk.id,
        phaseId: chunk.phaseId,
        packetPath: chunk.inputPath,
        packetSha256: packetArtifact.sha256,
        legacyCanonicalPacketSha256: chunk.packetSha256,
        chunkIndex: chunk.index,
        assignedPmids: [...chunk.assignedPmids],
        finalLegacyStatus: chunk.status,
        legacyAttemptCount: chunk.attempts.length,
        validatedOutputPath: chunk.validatedOutputPath,
        validatedOutputSha256: chunk.validatedOutputSha256,
      }
    })

  const runDefinition: MigratedUltraRunDefinition = {
    runId: finalProjection.runId,
    createdAt: finalProjection.createdAt,
    corpusSnapshot: clone(finalProjection.databaseSnapshot),
    screeningPolicyVersion: UNAVAILABLE_LEGACY,
    migrationVersion: ULTRA_V1_MIGRATION_VERSION,
    migrationGitCommit: options.migrationGitCommit,
    sourceV1: {
      rootPath: sourceRoot,
      progressManifestPath: sourceManifestPath,
      progressManifestSha256: sourceManifestArtifact.sha256,
      manifestVersion: finalProjection.manifestVersion,
      schemaVersion: finalProjection.schemaVersion,
      historySnapshotCount: historyEntries.length,
      firstSnapshotSha256,
      finalSnapshotSha256: sourceManifestArtifact.sha256,
    },
    dispatchAuthorization: {
      status: 'disabled_requires_versioned_authorization',
      reason:
        'Migration preserves legacy evidence only. No future v1 dispatch is approved until a separate versioned policy, prompt, and run-definition amendment is explicitly authorized.',
    },
    legacyUnavailableProvenance: unavailableLegacyProvenance(),
    phaseConfiguration: { registrations },
    packetInventory,
    rawArtifactInventory: inventory,
    rawArtifactInventorySha256: inventorySha256,
    legacyInitialProjection: initialProjection,
    legacyFinalProjectionSha256: finalProjectionSha256,
  }
  const replayed = replayUltraV1Migration(runDefinition, events)
  if (canonicalJson(replayed) !== canonicalJson(finalProjection)) {
    throw new UltraV1MigrationError(
      'migration_replay_mismatch',
      'The complete migration event stream does not reproduce the source manifest.',
    )
  }
  return {
    sourceRoot,
    destinationRoot,
    sourceManifestPath,
    sourceManifestSha256: sourceManifestArtifact.sha256,
    runDefinition,
    events,
    finalProjection,
    finalProjectionSha256,
    counts: legacyMigrationCounts(finalProjection),
  } satisfies UltraV1MigrationPlan
}

export function replayUltraV1Migration(
  definition: MigratedUltraRunDefinition,
  events: readonly UltraStorageEventInput[],
) {
  return events.reduce(
    (state, event) =>
      applyLegacyMigrationEvent(state, event, definition.phaseConfiguration.registrations),
    clone(definition.legacyInitialProjection),
  )
}

async function sourceManifestStillMatches(plan: UltraV1MigrationPlan) {
  const actual = await sha256File(plan.sourceManifestPath)
  if (actual !== plan.sourceManifestSha256) {
    throw new UltraV1MigrationError(
      'source_manifest_checksum_mismatch',
      'Source progress manifest changed after the migration plan was created.',
      { expected: plan.sourceManifestSha256, actual },
    )
  }
}

async function allLegacyArtifactsStillMatch(plan: UltraV1MigrationPlan) {
  await sourceManifestStillMatches(plan)
  const currentInventory = await inventoryLegacyArtifacts(plan.sourceRoot)
  if (
    currentInventory.inventorySha256 !== plan.runDefinition.rawArtifactInventorySha256 ||
    canonicalJson(currentInventory.inventory) !==
      canonicalJson(plan.runDefinition.rawArtifactInventory)
  ) {
    throw new UltraV1MigrationError(
      'legacy_artifact_checksum_mismatch',
      'One or more legacy runtime artifacts changed after migration planning.',
      {
        expectedInventorySha256: plan.runDefinition.rawArtifactInventorySha256,
        actualInventorySha256: currentInventory.inventorySha256,
      },
    )
  }
  return currentInventory
}

function eventMatches(input: UltraStorageEventInput, event: UltraStorageEvent) {
  return (
    input.type === event.type &&
    input.recordedAt === event.recordedAt &&
    canonicalJson(input.payload) === canonicalJson(event.payload)
  )
}

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function commitUltraV1Migration(
  plan: UltraV1MigrationPlan,
  options: { ownerId?: string } = {},
) {
  assertDistinctSiblingDestination(resolve(plan.sourceRoot), resolve(plan.destinationRoot))
  const ownerId = options.ownerId ?? 'ultra-v1-migration'
  const layout = ultraStorageV2Layout(plan.destinationRoot)
  let initializedStorage = false
  if (!(await pathExists(layout.runDefinitionPath))) {
    // This is deliberately the final source-side operation before initialization can create the
    // sibling container. A dry-run plan never authorizes writes after any legacy artifact changes.
    await allLegacyArtifactsStillMatch(plan)
    try {
      await initializeUltraStorageV2({
        runRoot: plan.destinationRoot,
        runDefinition: plan.runDefinition,
      })
      initializedStorage = true
    } catch (error) {
      if (!(error instanceof UltraStorageV2Error) || error.code !== 'storage_already_exists') {
        throw error
      }
    }
  }
  const existingDefinition = await readUltraRunDefinition<MigratedUltraRunDefinition>(
    plan.destinationRoot,
  )
  if (canonicalJson(existingDefinition.definition) !== canonicalJson(plan.runDefinition)) {
    throw new UltraV1MigrationError(
      'existing_migration_definition_mismatch',
      `Existing v2 state at ${plan.destinationRoot} belongs to a different migration.`,
    )
  }
  const existingEvents = await readUltraEventLog(plan.destinationRoot)
  if (
    existingEvents.length > plan.events.length ||
    existingEvents.some((event, index) => !eventMatches(plan.events[index], event))
  ) {
    throw new UltraV1MigrationError(
      'existing_migration_event_mismatch',
      `Existing v2 event log at ${plan.destinationRoot} is not a valid migration prefix.`,
    )
  }
  const checkpoint = await loadLatestUltraCheckpoint<LegacyScreeningManifest>(plan.destinationRoot)
  const summaryExists = await pathExists(layout.progressSummaryPath)
  const completeCheckpoint =
    checkpoint?.checkpoint.sequence === plan.events.length &&
    checkpoint.checkpoint.stateSha256 === plan.finalProjectionSha256
  const missingEvents = plan.events.slice(existingEvents.length)
  let appendedEventCount = 0
  let checkpointWritten = false
  let progressSummaryWritten = false
  if (missingEvents.length > 0 || !completeCheckpoint || !summaryExists) {
    // Initialization and event publication are separate durable operations. Recheck the complete
    // legacy inventory again immediately before appending/resuming any canonical v2 state.
    await allLegacyArtifactsStillMatch(plan)
    await withUltraCoordinatorWriter({
      runRoot: plan.destinationRoot,
      ownerId,
      action: async (writer) => {
        if (missingEvents.length > 0) {
          const receipts = await writer.appendMany(missingEvents)
          appendedEventCount = receipts.length
        }
        if (!completeCheckpoint) {
          await writer.writeCheckpoint(plan.finalProjection, plan.finalProjection.updatedAt)
          checkpointWritten = true
        }
        await writer.writeProgressSummary(
          {
            migrationVersion: ULTRA_V1_MIGRATION_VERSION,
            sourceManifestSha256: plan.sourceManifestSha256,
            equivalent: true,
            counts: plan.counts,
          },
          plan.finalProjection.updatedAt,
        )
        progressSummaryWritten = true
      },
    })
  }
  const equivalence = await auditUltraV1MigrationEquivalence(plan)
  const writesPerformed =
    initializedStorage || appendedEventCount > 0 || checkpointWritten || progressSummaryWritten
  return {
    result: initializedStorage
      ? ('created' as const)
      : writesPerformed
        ? ('resumed' as const)
        : ('verified_existing' as const),
    writesPerformed,
    initializedStorage,
    appendedEventCount,
    checkpointWritten,
    progressSummaryWritten,
    destinationRoot: plan.destinationRoot,
    equivalence,
  }
}

export async function auditUltraV1MigrationEquivalence(
  plan: UltraV1MigrationPlan,
): Promise<UltraV1MigrationEquivalence> {
  assertDistinctSiblingDestination(resolve(plan.sourceRoot), resolve(plan.destinationRoot))
  const currentInventory = await allLegacyArtifactsStillMatch(plan)
  const storedDefinition = await readUltraRunDefinition<MigratedUltraRunDefinition>(
    plan.destinationRoot,
  )
  if (canonicalJson(storedDefinition.definition) !== canonicalJson(plan.runDefinition)) {
    throw new UltraV1MigrationError(
      'migration_definition_mismatch',
      'Stored v2 run definition differs from the reviewed migration plan.',
    )
  }
  const storedEvents = await readUltraEventLog(plan.destinationRoot)
  if (
    storedEvents.length !== plan.events.length ||
    storedEvents.some((event, index) => !eventMatches(plan.events[index], event))
  ) {
    throw new UltraV1MigrationError(
      'migration_event_mismatch',
      'Stored v2 events differ from the deterministic legacy transition reconstruction.',
    )
  }
  const reconstructed = await reconstructUltraState<LegacyScreeningManifest>({
    runRoot: plan.destinationRoot,
    initialState: plan.runDefinition.legacyInitialProjection,
    reducer: (state, event) =>
      applyLegacyMigrationEvent(
        state,
        eventInput(event),
        plan.runDefinition.phaseConfiguration.registrations,
      ),
  })
  const reconstructedSha256 = sha256(canonicalJson(reconstructed.state))
  if (
    reconstructedSha256 !== plan.finalProjectionSha256 ||
    canonicalJson(reconstructed.state) !== canonicalJson(plan.finalProjection)
  ) {
    throw new UltraV1MigrationError(
      'migration_semantic_mismatch',
      'Replayed v2 state does not exactly match the final v1 manifest.',
    )
  }
  const counts = legacyMigrationCounts(reconstructed.state)
  if (canonicalJson(counts) !== canonicalJson(plan.counts)) {
    throw new UltraV1MigrationError(
      'migration_count_mismatch',
      'Replayed phase, chunk, attempt, or next-pending counts differ from v1.',
    )
  }
  return {
    equivalent: true,
    sourceManifestSha256: plan.sourceManifestSha256,
    runDefinitionSha256: storedDefinition.definitionSha256,
    eventCount: storedEvents.length,
    finalEventSequence: reconstructed.head.sequence,
    finalEventHash: reconstructed.head.eventHash,
    finalProjectionSha256: reconstructedSha256,
    rawArtifactCount: currentInventory.inventory.length,
    rawArtifactInventorySha256: currentInventory.inventorySha256,
    counts,
  }
}
