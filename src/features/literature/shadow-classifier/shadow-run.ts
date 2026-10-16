import { z } from 'zod'

import {
  NO_SHADOW_PRODUCTION_EFFECTS,
  assertShadowPolicyHasNoProductionEffects,
  humanOnlyShadowPolicy,
  type ShadowAutonomyPolicy,
} from './autonomy'
import { canonicalShadowJson, immutableShadowValue, sha256ShadowValue } from './canonical'
import {
  assertDevelopmentArticleAuthorized,
  developmentShadowScopeDescriptor,
  type AuthorizedDevelopmentShadowScope,
  type DevelopmentShadowScopeDescriptor,
} from './held-out-guard'
import {
  assertShadowPacketRegistryBinding,
  shadowModelPacketSchema,
  type ShadowModelPacketEnvelope,
} from './model-packet'
import {
  validateShadowComponentResult,
  type AcceptedShadowComponentResult,
  type ShadowComponentValidationReport,
} from './result-validation'
import { verifyShadowComponentRegistry, type ShadowComponentRegistry } from './registry'
import {
  routeShadowComponentResult,
  routeShadowComponentSet,
  type ShadowComparisonGroup,
  type ShadowRoutingEvidenceAssessment,
  type ShadowRoutingDecision,
  type ShadowRoutingObservation,
} from './routing'

export const SHADOW_RUN_SCHEMA_VERSION = 'literature-shadow-run/1.0.0' as const
export const SHADOW_RUN_EVENT_SCHEMA_VERSION = 'literature-shadow-run-event/1.0.0' as const
export const SHADOW_RUN_REPLAY_SCHEMA_VERSION = 'literature-shadow-replay/1.0.0' as const
export const SHADOW_RUN_ROLLBACK_SCHEMA_VERSION = 'literature-shadow-rollback/1.0.0' as const
export const SHADOW_RUN_GENESIS_HASH = '0'.repeat(64)

const timestampSchema = z.string().datetime({ offset: true })
const identifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,159}$/u)
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)

export type ShadowRunEventPayload =
  | { runId: string; definitionSha256: string }
  | {
      assignmentId: string
      packetSha256: string
      rawResultSha256: string
      executionReceiptSha256: string | null
      attemptSha256: string
    }
  | {
      assignmentId: string
      validationStatus: ShadowComponentValidationReport['status']
      validationSha256: string
      resultSha256: string | null
    }
  | { assignmentId: string; routingSha256: string }
  | {
      supersededAttemptSha256: string
      replacementAttemptSha256: string
      priorArtifactSha256: string
    }
  | { priorArtifactSha256: string; reason: string }

export type ShadowRunEventType =
  | 'run_created'
  | 'assignment_created'
  | 'component_result_recorded'
  | 'routing_recorded'
  | 'component_replay_recorded'
  | 'autonomy_rolled_back_to_human_only'

export interface ShadowRunEvent {
  schemaVersion: typeof SHADOW_RUN_EVENT_SCHEMA_VERSION
  sequence: number
  eventType: ShadowRunEventType
  recordedAt: string
  previousEventHash: string
  payload: ShadowRunEventPayload
  payloadSha256: string
  eventHash: string
}

export interface ShadowRunAssignmentInput {
  packetEnvelope: ShadowModelPacketEnvelope
  rawResult: unknown
  executionReceipt?: ShadowExecutionReceipt | null
  routingAssessment: ShadowRoutingEvidenceAssessment
}

export interface ShadowExecutionReceipt {
  adapterId: string
  adapterVersion: string
  modelId: string
  reasoningLevel: string
  agentId: string
  executionId: string
  attestation: 'operator_attested_not_cryptographically_verified'
  modelInputSha256: string
  startedAt: string
  completedAt: string
  workerFileSha256: string
}

export interface ShadowRunAttempt {
  assignmentId: string
  componentId: string
  packetEnvelope: Readonly<ShadowModelPacketEnvelope>
  rawResult: unknown
  rawResultSha256: string
  executionReceipt: Readonly<ShadowExecutionReceipt> | null
  executionReceiptSha256: string | null
  routingAssessment: Readonly<ShadowRoutingEvidenceAssessment>
  validation: Readonly<ShadowComponentValidationReport>
  validationSha256: string
  routing: Readonly<ShadowRoutingDecision>
  routingSha256: string
  attemptSha256: string
}

export interface ShadowRunArtifact {
  schemaVersion: typeof SHADOW_RUN_SCHEMA_VERSION
  runId: string
  state: 'immutable_shadow_evidence'
  developmentOnly: true
  heldOutValidated: false
  productionAuthorized: false
  scope: Readonly<DevelopmentShadowScopeDescriptor>
  registry: Readonly<ShadowComponentRegistry>
  autonomyPolicy: Readonly<ShadowAutonomyPolicy>
  definition: {
    createdAt: string
    repositoryCommit: string
    assignmentIds: readonly string[]
    exactInputArtifactSha256s: readonly string[]
  }
  attempts: readonly Readonly<ShadowRunAttempt>[]
  articleRouting: readonly ShadowRunArticleRouting[]
  articleRoutingSha256: string
  events: readonly Readonly<ShadowRunEvent>[]
  checksumManifest: Readonly<Record<string, string>>
  checksumManifestSha256: string
  productionEffects: typeof NO_SHADOW_PRODUCTION_EFFECTS
  artifactSha256: string
}

export interface ShadowRunArticleRouting {
  pmid: string
  requiredComponentIds: readonly string[]
  comparisonGroups: readonly ShadowComparisonGroup[]
  route: Readonly<ShadowRoutingDecision>
  routingSha256: string
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  const actual = Object.keys(value as Record<string, unknown>).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has unexpected or missing fields.`)
  }
}

function eventPayload(eventType: ShadowRunEventType, payload: unknown): ShadowRunEventPayload {
  const assignmentId = identifierSchema
  const schemas = {
    run_created: z.object({ runId: identifierSchema, definitionSha256: sha256Schema }).strict(),
    assignment_created: z
      .object({
        assignmentId,
        packetSha256: sha256Schema,
        rawResultSha256: sha256Schema,
        executionReceiptSha256: sha256Schema.nullable(),
        attemptSha256: sha256Schema,
      })
      .strict(),
    component_result_recorded: z
      .object({
        assignmentId,
        validationStatus: z.enum([
          'accepted_prediction',
          'accepted_abstention',
          'accepted_refusal',
          'rejected_invalid',
          'rejected_missing',
        ]),
        validationSha256: sha256Schema,
        resultSha256: sha256Schema.nullable(),
      })
      .strict(),
    routing_recorded: z.object({ assignmentId, routingSha256: sha256Schema }).strict(),
    component_replay_recorded: z
      .object({
        supersededAttemptSha256: sha256Schema,
        replacementAttemptSha256: sha256Schema,
        priorArtifactSha256: sha256Schema,
      })
      .strict(),
    autonomy_rolled_back_to_human_only: z
      .object({
        priorArtifactSha256: sha256Schema,
        reason: z.string().trim().min(1).max(1_000),
      })
      .strict(),
  } satisfies Record<ShadowRunEventType, z.ZodType>
  return schemas[eventType].parse(payload) as ShadowRunEventPayload
}

function eventHashContent(event: Omit<ShadowRunEvent, 'eventHash'>) {
  return {
    schemaVersion: event.schemaVersion,
    sequence: event.sequence,
    eventType: event.eventType,
    recordedAt: event.recordedAt,
    previousEventHash: event.previousEventHash,
    payload: event.payload,
    payloadSha256: event.payloadSha256,
  }
}

export function appendShadowRunEvent(input: {
  priorEvents: readonly ShadowRunEvent[]
  eventType: ShadowRunEventType
  recordedAt: string
  payload: unknown
}): Readonly<ShadowRunEvent[]> {
  verifyShadowRunEventHistory(input.priorEvents)
  const previous = input.priorEvents.at(-1)
  const recordedAt = timestampSchema.parse(input.recordedAt)
  if (previous && Date.parse(recordedAt) < Date.parse(previous.recordedAt)) {
    throw new Error('Shadow run event timestamps must be nondecreasing coordinator-recorded time.')
  }
  const payload = eventPayload(input.eventType, input.payload)
  const eventWithoutHash = {
    schemaVersion: SHADOW_RUN_EVENT_SCHEMA_VERSION,
    sequence: (previous?.sequence ?? 0) + 1,
    eventType: input.eventType,
    recordedAt,
    previousEventHash: previous?.eventHash ?? SHADOW_RUN_GENESIS_HASH,
    payload,
    payloadSha256: sha256ShadowValue(payload),
  }
  const event: ShadowRunEvent = {
    ...eventWithoutHash,
    eventHash: sha256ShadowValue(eventHashContent(eventWithoutHash)),
  }
  return immutableShadowValue([...input.priorEvents, event])
}

export function verifyShadowRunEventHistory(events: readonly ShadowRunEvent[]): void {
  let previousEventHash = SHADOW_RUN_GENESIS_HASH
  let previousRecordedAt: string | null = null
  for (const [index, event] of events.entries()) {
    exactKeys(
      event,
      [
        'schemaVersion',
        'sequence',
        'eventType',
        'recordedAt',
        'previousEventHash',
        'payload',
        'payloadSha256',
        'eventHash',
      ],
      `events[${index}]`,
    )
    const payload = eventPayload(event.eventType, event.payload)
    if (
      event.schemaVersion !== SHADOW_RUN_EVENT_SCHEMA_VERSION ||
      event.sequence !== index + 1 ||
      event.previousEventHash !== previousEventHash ||
      !timestampSchema.safeParse(event.recordedAt).success ||
      (previousRecordedAt !== null &&
        Date.parse(event.recordedAt) < Date.parse(previousRecordedAt)) ||
      event.payloadSha256 !== sha256ShadowValue(payload) ||
      event.eventHash !== sha256ShadowValue(eventHashContent(event))
    ) {
      throw new Error(
        `Shadow run event history is not an exact append-only hash chain at sequence ${index + 1}.`,
      )
    }
    previousEventHash = event.eventHash
    previousRecordedAt = event.recordedAt
  }
}

function buildAttempt(
  assignment: ShadowRunAssignmentInput,
  registry: ShadowComponentRegistry,
  scope: AuthorizedDevelopmentShadowScope,
): Readonly<ShadowRunAttempt> {
  const packet = assertShadowPacketRegistryBinding(assignment.packetEnvelope, registry)
  assertDevelopmentArticleAuthorized(scope, packet.modelInput.article.pmid)
  // Normalize key order before validation so a persisted invalid payload recomputes the same
  // ordered issue list after canonical JSON round-tripping.
  const rawResult = immutableShadowValue(
    assignment.rawResult === undefined ? null : assignment.rawResult,
  )
  const executionReceipt = assignment.executionReceipt
    ? z
        .object({
          adapterId: identifierSchema,
          adapterVersion: z.string().min(1).max(100),
          modelId: identifierSchema,
          reasoningLevel: z.string().trim().min(1).max(100),
          agentId: z.string().trim().min(1).max(200),
          executionId: z.string().trim().min(1).max(200),
          attestation: z.literal('operator_attested_not_cryptographically_verified'),
          modelInputSha256: sha256Schema,
          startedAt: timestampSchema,
          completedAt: timestampSchema,
          workerFileSha256: sha256Schema,
        })
        .strict()
        .parse(assignment.executionReceipt)
    : null
  if (executionReceipt) {
    const model = packet.componentProvenance.model
    if (
      executionReceipt.adapterId !== model.adapterId ||
      executionReceipt.adapterVersion !== model.adapterVersion ||
      executionReceipt.modelId !== model.modelId ||
      executionReceipt.reasoningLevel !== model.reasoningLevel ||
      executionReceipt.modelInputSha256 !== packet.modelInputSha256 ||
      Date.parse(executionReceipt.startedAt) < Date.parse(packet.createdAt) ||
      Date.parse(executionReceipt.completedAt) < Date.parse(executionReceipt.startedAt)
    ) {
      throw new Error('Execution receipt is not bound to exact packet provenance and chronology.')
    }
  }
  // Canonicalization above rejects executable/class instances and undefined children before
  // evidence is validated or stored.
  const validation = validateShadowComponentResult({
    rawResult,
    packetEnvelope: assignment.packetEnvelope,
    registry,
  })
  if (
    validation.assignmentId !== packet.assignmentId ||
    validation.packetSha256 !== assignment.packetEnvelope.packetSha256 ||
    validation.componentId !== packet.componentProvenance.componentId
  ) {
    throw new Error('Validation does not cover its exact assigned packet.')
  }
  const observation: ShadowRoutingObservation = {
    packetEnvelope: assignment.packetEnvelope,
    validation,
    assessment: assignment.routingAssessment,
  }
  const routing = routeShadowComponentResult(observation)
  const attemptWithoutHash = {
    assignmentId: packet.assignmentId,
    componentId: packet.componentProvenance.componentId,
    packetEnvelope: assignment.packetEnvelope,
    rawResult,
    rawResultSha256: sha256ShadowValue(rawResult),
    executionReceipt,
    executionReceiptSha256: executionReceipt === null ? null : sha256ShadowValue(executionReceipt),
    routingAssessment: observation.assessment,
    validation,
    validationSha256: sha256ShadowValue(validation),
    routing,
    routingSha256: sha256ShadowValue(routing),
  }
  return immutableShadowValue({
    ...attemptWithoutHash,
    attemptSha256: sha256ShadowValue(attemptWithoutHash),
  })
}

function manifestFor(input: {
  definition: ShadowRunArtifact['definition']
  scope: DevelopmentShadowScopeDescriptor
  registry: ShadowComponentRegistry
  attempts: readonly ShadowRunAttempt[]
  articleRouting: readonly ShadowRunArticleRouting[]
  events: readonly ShadowRunEvent[]
}) {
  return Object.fromEntries(
    [
      ['definition.json', sha256ShadowValue(input.definition)],
      ['scope.json', sha256ShadowValue(input.scope)],
      ['registry.json', sha256ShadowValue(input.registry)],
      ...input.attempts.map(
        (attempt) => [`attempts/${attempt.assignmentId}.json`, attempt.attemptSha256] as const,
      ),
      ['article-routing.json', sha256ShadowValue(input.articleRouting)],
      ['events.json', sha256ShadowValue(input.events)],
    ].sort(([left], [right]) => left.localeCompare(right)),
  )
}

function generatedRunEvents(input: {
  runId: string
  definition: ShadowRunArtifact['definition']
  attempts: readonly ShadowRunAttempt[]
}): readonly ShadowRunEvent[] {
  let events: readonly ShadowRunEvent[] = appendShadowRunEvent({
    priorEvents: [],
    eventType: 'run_created',
    recordedAt: input.definition.createdAt,
    payload: { runId: input.runId, definitionSha256: sha256ShadowValue(input.definition) },
  })
  for (const [index, attempt] of input.attempts.entries()) {
    const recordedAt = new Date(Date.parse(input.definition.createdAt) + index + 1).toISOString()
    events = appendShadowRunEvent({
      priorEvents: events,
      eventType: 'assignment_created',
      recordedAt,
      payload: {
        assignmentId: attempt.assignmentId,
        packetSha256: attempt.packetEnvelope.packetSha256,
        rawResultSha256: attempt.rawResultSha256,
        executionReceiptSha256: attempt.executionReceiptSha256,
        attemptSha256: attempt.attemptSha256,
      },
    })
    events = appendShadowRunEvent({
      priorEvents: events,
      eventType: 'component_result_recorded',
      recordedAt,
      payload: {
        assignmentId: attempt.assignmentId,
        validationStatus: attempt.validation.status,
        validationSha256: attempt.validationSha256,
        resultSha256: attempt.validation.valid ? attempt.validation.result.resultSha256 : null,
      },
    })
    events = appendShadowRunEvent({
      priorEvents: events,
      eventType: 'routing_recorded',
      recordedAt,
      payload: { assignmentId: attempt.assignmentId, routingSha256: attempt.routingSha256 },
    })
  }
  return events
}

function buildArticleRouting(input: {
  attempts: readonly ShadowRunAttempt[]
  requiredComponentIds: readonly string[]
  comparisonGroupsByPmid: Readonly<Record<string, readonly ShadowComparisonGroup[]>>
}): readonly ShadowRunArticleRouting[] {
  const required = z.array(identifierSchema).min(1).parse(input.requiredComponentIds)
  if (new Set(required).size !== required.length) {
    throw new Error('Required run-level component IDs must be unique.')
  }
  const grouped = new Map<string, ShadowRunAttempt[]>()
  for (const attempt of input.attempts) {
    const pmid = attempt.packetEnvelope.packet.modelInput.article.pmid
    grouped.set(pmid, [...(grouped.get(pmid) ?? []), attempt])
  }
  const result: ShadowRunArticleRouting[] = []
  for (const [pmid, attempts] of grouped) {
    for (const componentId of required) {
      if (attempts.filter((attempt) => attempt.componentId === componentId).length !== 1) {
        throw new Error(`Article ${pmid} requires exactly one ${componentId} attempt.`)
      }
    }
    if (attempts.some((attempt) => !required.includes(attempt.componentId))) {
      throw new Error(`Article ${pmid} contains an unexpected component attempt.`)
    }
    const comparisonGroups = [...(input.comparisonGroupsByPmid[pmid] ?? [])]
    const observations = attempts.map((attempt) => ({
      packetEnvelope: attempt.packetEnvelope,
      validation: attempt.validation,
      assessment: attempt.routingAssessment,
    }))
    const route = routeShadowComponentSet({
      observations,
      requiredComponentIds: required,
      comparisonGroups,
    })
    const withoutHash = { pmid, requiredComponentIds: required, comparisonGroups, route }
    result.push({ ...withoutHash, routingSha256: sha256ShadowValue(withoutHash) })
  }
  result.sort(
    (left, right) => left.pmid.length - right.pmid.length || left.pmid.localeCompare(right.pmid),
  )
  return immutableShadowValue(result)
}

function exactPacketInputHashes(attempts: readonly ShadowRunAttempt[]): string[] {
  return attempts.map((attempt) => attempt.packetEnvelope.packetSha256).sort()
}

function assertExactPacketInputHashes(
  claimed: readonly string[],
  attempts: readonly ShadowRunAttempt[],
): string[] {
  const parsed = claimed.map((hash) => sha256Schema.parse(hash)).sort()
  if (new Set(parsed).size !== parsed.length) {
    throw new Error('Exact input artifact hashes must be unique.')
  }
  const expected = exactPacketInputHashes(attempts)
  if (canonicalShadowJson(parsed) !== canonicalShadowJson(expected)) {
    throw new Error(
      'Exact input artifact hashes must equal the one-to-one set of assigned packet checksums.',
    )
  }
  return parsed
}

function assertRunExecutionReceiptInvariants(input: {
  attempts: readonly ShadowRunAttempt[]
  scope: DevelopmentShadowScopeDescriptor
  runCreatedAt: string
}): void {
  if (
    input.scope.authorityClass === 'real_development_membership' &&
    input.attempts.some((attempt) => attempt.validation.valid && attempt.executionReceipt === null)
  ) {
    throw new Error(
      'Every valid real-development result requires an exact worker execution receipt.',
    )
  }
  const receipts = input.attempts.flatMap((attempt) =>
    attempt.executionReceipt === null ? [] : [attempt.executionReceipt],
  )
  const executionIds = receipts.map((receipt) => receipt.executionId)
  if (new Set(executionIds).size !== executionIds.length) {
    throw new Error('Shadow run contains duplicate execution receipt IDs.')
  }
  if (
    receipts.some((receipt) => Date.parse(receipt.completedAt) > Date.parse(input.runCreatedAt))
  ) {
    throw new Error('Run recording time cannot precede a completed model attempt.')
  }
}

export function createShadowRunArtifact(input: {
  runId: string
  repositoryCommit: string
  createdAt: string
  scope: AuthorizedDevelopmentShadowScope
  registry: ShadowComponentRegistry
  autonomyPolicy: ShadowAutonomyPolicy
  assignments: readonly ShadowRunAssignmentInput[]
  exactInputArtifactSha256s: readonly string[]
  requiredComponentIds?: readonly string[]
  comparisonGroupsByPmid?: Readonly<Record<string, readonly ShadowComparisonGroup[]>>
}): Readonly<ShadowRunArtifact> {
  const runId = identifierSchema.parse(input.runId)
  verifyShadowComponentRegistry(input.registry)
  assertShadowPolicyHasNoProductionEffects(input.autonomyPolicy)
  const scope = developmentShadowScopeDescriptor(input.scope)
  const attempts = input.assignments.map((assignment) =>
    buildAttempt(assignment, input.registry, input.scope),
  )
  const createdAt = timestampSchema.parse(input.createdAt)
  assertRunExecutionReceiptInvariants({ attempts, scope, runCreatedAt: createdAt })
  const assignmentIds = attempts.map((attempt) => attempt.assignmentId)
  if (new Set(assignmentIds).size !== assignmentIds.length) {
    throw new Error('Shadow run contains duplicate assignment identities.')
  }
  if (attempts.length !== input.assignments.length) {
    throw new Error('Every assigned shadow packet must have exactly one persisted attempt.')
  }
  const definition = {
    createdAt,
    repositoryCommit: z
      .string()
      .regex(/^[a-f0-9]{40,64}$/u)
      .parse(input.repositoryCommit),
    assignmentIds,
    exactInputArtifactSha256s: assertExactPacketInputHashes(
      input.exactInputArtifactSha256s,
      attempts,
    ),
  }
  const articleRouting = buildArticleRouting({
    attempts,
    requiredComponentIds: input.requiredComponentIds ?? [
      ...new Set(attempts.map((attempt) => attempt.componentId)),
    ],
    comparisonGroupsByPmid: input.comparisonGroupsByPmid ?? {},
  })
  const events = generatedRunEvents({ runId, definition, attempts })
  const checksumManifest = manifestFor({
    definition,
    scope,
    registry: input.registry,
    attempts,
    articleRouting,
    events,
  })
  const artifactWithoutHash: Omit<ShadowRunArtifact, 'artifactSha256'> = {
    schemaVersion: SHADOW_RUN_SCHEMA_VERSION,
    runId,
    state: 'immutable_shadow_evidence',
    developmentOnly: true,
    heldOutValidated: false,
    productionAuthorized: false,
    scope,
    registry: input.registry,
    autonomyPolicy: input.autonomyPolicy,
    definition,
    attempts,
    articleRouting,
    articleRoutingSha256: sha256ShadowValue(articleRouting),
    events,
    checksumManifest,
    checksumManifestSha256: sha256ShadowValue(checksumManifest),
    productionEffects: NO_SHADOW_PRODUCTION_EFFECTS,
  }
  return immutableShadowValue({
    ...artifactWithoutHash,
    artifactSha256: sha256ShadowValue(artifactWithoutHash),
  })
}

export function verifyShadowRunArtifact(
  artifact: ShadowRunArtifact,
  scope: AuthorizedDevelopmentShadowScope,
): void {
  exactKeys(
    artifact,
    [
      'schemaVersion',
      'runId',
      'state',
      'developmentOnly',
      'heldOutValidated',
      'productionAuthorized',
      'scope',
      'registry',
      'autonomyPolicy',
      'definition',
      'attempts',
      'articleRouting',
      'articleRoutingSha256',
      'events',
      'checksumManifest',
      'checksumManifestSha256',
      'productionEffects',
      'artifactSha256',
    ],
    'shadow run artifact',
  )
  if (
    artifact.schemaVersion !== SHADOW_RUN_SCHEMA_VERSION ||
    artifact.state !== 'immutable_shadow_evidence' ||
    artifact.developmentOnly !== true ||
    artifact.heldOutValidated !== false ||
    artifact.productionAuthorized !== false
  ) {
    throw new Error('Shadow run artifact crossed its development-only evidence boundary.')
  }
  exactKeys(
    artifact.productionEffects,
    Object.keys(NO_SHADOW_PRODUCTION_EFFECTS),
    'shadow run productionEffects',
  )
  if (
    Object.keys(NO_SHADOW_PRODUCTION_EFFECTS).some(
      (key) =>
        artifact.productionEffects[key as keyof typeof NO_SHADOW_PRODUCTION_EFFECTS] !== false,
    )
  ) {
    throw new Error('Shadow run artifact claims a production effect.')
  }
  assertShadowPolicyHasNoProductionEffects(artifact.autonomyPolicy)
  if (
    canonicalShadowJson(developmentShadowScopeDescriptor(scope)) !==
    canonicalShadowJson(artifact.scope)
  ) {
    throw new Error('Shadow run scope descriptor does not match the reauthenticated capability.')
  }
  verifyShadowComponentRegistry(artifact.registry)
  shadowModelPacketSchema
    .array()
    .parse(artifact.attempts.map((attempt) => attempt.packetEnvelope.packet))
  const assignmentIds = artifact.attempts.map((attempt) => attempt.assignmentId)
  exactKeys(
    artifact.definition,
    ['createdAt', 'repositoryCommit', 'assignmentIds', 'exactInputArtifactSha256s'],
    'shadow run definition',
  )
  const runCreatedAt = timestampSchema.parse(artifact.definition.createdAt)
  z.string()
    .regex(/^[a-f0-9]{40,64}$/u)
    .parse(artifact.definition.repositoryCommit)
  if (
    new Set(assignmentIds).size !== assignmentIds.length ||
    canonicalShadowJson(assignmentIds) !== canonicalShadowJson(artifact.definition.assignmentIds)
  ) {
    throw new Error('Shadow run definition does not have exact one-to-one assignment coverage.')
  }
  assertExactPacketInputHashes(artifact.definition.exactInputArtifactSha256s, artifact.attempts)
  for (const attempt of artifact.attempts) {
    const rebuilt = buildAttempt(
      {
        packetEnvelope: attempt.packetEnvelope,
        rawResult: attempt.rawResult,
        executionReceipt: attempt.executionReceipt,
        routingAssessment: attempt.routingAssessment,
      },
      artifact.registry,
      scope,
    )
    if (canonicalShadowJson(rebuilt) !== canonicalShadowJson(attempt)) {
      throw new Error(`Shadow run attempt ${attempt.assignmentId} does not recompute exactly.`)
    }
  }
  assertRunExecutionReceiptInvariants({
    attempts: artifact.attempts,
    scope: artifact.scope,
    runCreatedAt,
  })
  if (artifact.articleRoutingSha256 !== sha256ShadowValue(artifact.articleRouting)) {
    throw new Error('Per-article combined routing checksum mismatch.')
  }
  const requiredComponentIds = artifact.articleRouting[0]?.requiredComponentIds ?? []
  const comparisonGroupsByPmid = Object.fromEntries(
    artifact.articleRouting.map((routing) => [routing.pmid, routing.comparisonGroups]),
  )
  const rebuiltArticleRouting = buildArticleRouting({
    attempts: artifact.attempts,
    requiredComponentIds,
    comparisonGroupsByPmid,
  })
  if (canonicalShadowJson(rebuiltArticleRouting) !== canonicalShadowJson(artifact.articleRouting)) {
    throw new Error('Per-article combined routing does not recompute exactly.')
  }
  const expectedEvents = generatedRunEvents({
    runId: artifact.runId,
    definition: artifact.definition,
    attempts: artifact.attempts,
  })
  if (canonicalShadowJson(expectedEvents) !== canonicalShadowJson(artifact.events)) {
    throw new Error('Shadow run events do not exactly inventory definition and attempts.')
  }
  verifyShadowRunEventHistory(artifact.events)
  const expectedManifest = manifestFor({
    definition: artifact.definition,
    scope: artifact.scope,
    registry: artifact.registry,
    attempts: artifact.attempts,
    articleRouting: artifact.articleRouting,
    events: artifact.events,
  })
  if (
    canonicalShadowJson(expectedManifest) !== canonicalShadowJson(artifact.checksumManifest) ||
    artifact.checksumManifestSha256 !== sha256ShadowValue(artifact.checksumManifest)
  ) {
    throw new Error('Shadow run checksum manifest is not exact.')
  }
  const { artifactSha256, ...withoutHash } = artifact
  if (artifactSha256 !== sha256ShadowValue(withoutHash)) {
    throw new Error('Shadow run artifact checksum mismatch.')
  }
}

export interface ShadowRunReplayArtifact {
  schemaVersion: typeof SHADOW_RUN_REPLAY_SCHEMA_VERSION
  priorArtifact: Readonly<ShadowRunArtifact>
  priorArtifactSha256: string
  replacementAttempt: Readonly<ShadowRunAttempt>
  events: readonly ShadowRunEvent[]
  artifactSha256: string
}

function assertValidReplayReplacement(
  superseded: ShadowRunAttempt,
  replacement: ShadowRunAttempt,
): void {
  if (
    replacement.packetEnvelope.packet.modelInput.article.pmid !==
      superseded.packetEnvelope.packet.modelInput.article.pmid ||
    replacement.packetEnvelope.packet.articleInputSha256 !==
      superseded.packetEnvelope.packet.articleInputSha256
  ) {
    throw new Error('Replay replacement must classify the exact same article bytes.')
  }
  const oldPacket = superseded.packetEnvelope.packet
  const newPacket = replacement.packetEnvelope.packet
  if (
    oldPacket.componentProvenance.componentId !== newPacket.componentProvenance.componentId ||
    (oldPacket.componentProvenance.componentVersion ===
      newPacket.componentProvenance.componentVersion &&
      oldPacket.componentProvenance.prompt.promptSha256 ===
        newPacket.componentProvenance.prompt.promptSha256 &&
      oldPacket.componentProvenance.model.modelId === newPacket.componentProvenance.model.modelId)
  ) {
    throw new Error(
      'Replay replacement must preserve the component and carry genuinely new version, prompt, or model provenance.',
    )
  }
}

export function replayShadowComponentEvidence(input: {
  artifact: ShadowRunArtifact
  scope: AuthorizedDevelopmentShadowScope
  replacementRegistry: ShadowComponentRegistry
  supersededAttemptSha256: string
  replacement: ShadowRunAssignmentInput
  recordedAt: string
}): Readonly<ShadowRunReplayArtifact> {
  verifyShadowRunArtifact(input.artifact, input.scope)
  // The scope is reauthenticated even though it is never serialized into a model packet.
  const scope = developmentShadowScopeDescriptor(input.scope)
  const superseded = input.artifact.attempts.find(
    (attempt) => attempt.attemptSha256 === input.supersededAttemptSha256,
  )
  if (!superseded) throw new Error('Replay target is not in the immutable historical artifact.')
  verifyShadowComponentRegistry(input.replacementRegistry)
  const replacement = buildAttempt(input.replacement, input.replacementRegistry, input.scope)
  assertValidReplayReplacement(superseded, replacement)
  assertRunExecutionReceiptInvariants({
    attempts: [...input.artifact.attempts, replacement],
    scope,
    runCreatedAt: input.recordedAt,
  })
  const events = appendShadowRunEvent({
    priorEvents: input.artifact.events,
    eventType: 'component_replay_recorded',
    recordedAt: input.recordedAt,
    payload: {
      supersededAttemptSha256: superseded.attemptSha256,
      replacementAttemptSha256: replacement.attemptSha256,
      priorArtifactSha256: input.artifact.artifactSha256,
    },
  })
  const withoutHash = {
    schemaVersion: SHADOW_RUN_REPLAY_SCHEMA_VERSION,
    priorArtifact: input.artifact,
    priorArtifactSha256: input.artifact.artifactSha256,
    replacementAttempt: replacement,
    events,
  }
  return immutableShadowValue({ ...withoutHash, artifactSha256: sha256ShadowValue(withoutHash) })
}

export function verifyShadowRunReplayArtifact(input: {
  replay: ShadowRunReplayArtifact
  scope: AuthorizedDevelopmentShadowScope
  replacementRegistry: ShadowComponentRegistry
}): void {
  const replay = input.replay
  exactKeys(
    replay,
    [
      'schemaVersion',
      'priorArtifact',
      'priorArtifactSha256',
      'replacementAttempt',
      'events',
      'artifactSha256',
    ],
    'shadow replay artifact',
  )
  if (replay.schemaVersion !== SHADOW_RUN_REPLAY_SCHEMA_VERSION) {
    throw new Error('Shadow replay schema version is invalid.')
  }
  verifyShadowRunArtifact(replay.priorArtifact, input.scope)
  if (replay.priorArtifactSha256 !== replay.priorArtifact.artifactSha256) {
    throw new Error('Shadow replay prior artifact identity is invalid.')
  }
  verifyShadowComponentRegistry(input.replacementRegistry)
  const rebuilt = buildAttempt(
    {
      packetEnvelope: replay.replacementAttempt.packetEnvelope,
      rawResult: replay.replacementAttempt.rawResult,
      executionReceipt: replay.replacementAttempt.executionReceipt,
      routingAssessment: replay.replacementAttempt.routingAssessment,
    },
    input.replacementRegistry,
    input.scope,
  )
  if (canonicalShadowJson(rebuilt) !== canonicalShadowJson(replay.replacementAttempt)) {
    throw new Error('Shadow replay replacement attempt does not recompute exactly.')
  }
  assertRunExecutionReceiptInvariants({
    attempts: [...replay.priorArtifact.attempts, replay.replacementAttempt],
    scope: developmentShadowScopeDescriptor(input.scope),
    runCreatedAt: replay.events.at(-1)?.recordedAt ?? '',
  })
  const event = replay.events.at(-1)
  const superseded = replay.priorArtifact.attempts.find(
    (attempt) =>
      attempt.attemptSha256 ===
      (event?.payload as { supersededAttemptSha256?: string }).supersededAttemptSha256,
  )
  if (superseded) assertValidReplayReplacement(superseded, replay.replacementAttempt)
  if (
    !superseded ||
    superseded.componentId !== replay.replacementAttempt.componentId ||
    event?.eventType !== 'component_replay_recorded' ||
    canonicalShadowJson(replay.events.slice(0, -1)) !==
      canonicalShadowJson(replay.priorArtifact.events) ||
    (event.payload as { replacementAttemptSha256?: string }).replacementAttemptSha256 !==
      replay.replacementAttempt.attemptSha256 ||
    (event.payload as { priorArtifactSha256?: string }).priorArtifactSha256 !==
      replay.priorArtifactSha256
  ) {
    throw new Error('Shadow replay event tail is not bound to its exact component replacement.')
  }
  verifyShadowRunEventHistory(replay.events)
  const { artifactSha256, ...withoutHash } = replay
  if (artifactSha256 !== sha256ShadowValue(withoutHash)) {
    throw new Error('Shadow replay artifact checksum mismatch.')
  }
}

export interface ShadowRunRollbackArtifact {
  schemaVersion: typeof SHADOW_RUN_ROLLBACK_SCHEMA_VERSION
  priorArtifact: Readonly<ShadowRunArtifact>
  priorArtifactSha256: string
  policy: Readonly<ShadowAutonomyPolicy>
  events: readonly ShadowRunEvent[]
  artifactSha256: string
}

export function rollBackShadowRunToHumanOnly(input: {
  artifact: ShadowRunArtifact
  scope: AuthorizedDevelopmentShadowScope
  recordedAt: string
  reason: string
}): Readonly<ShadowRunRollbackArtifact> {
  verifyShadowRunArtifact(input.artifact, input.scope)
  const reason = z.string().trim().min(1).max(1_000).parse(input.reason)
  const events = appendShadowRunEvent({
    priorEvents: input.artifact.events,
    eventType: 'autonomy_rolled_back_to_human_only',
    recordedAt: input.recordedAt,
    payload: { priorArtifactSha256: input.artifact.artifactSha256, reason },
  })
  const withoutHash = {
    schemaVersion: SHADOW_RUN_ROLLBACK_SCHEMA_VERSION,
    priorArtifact: input.artifact,
    priorArtifactSha256: input.artifact.artifactSha256,
    policy: humanOnlyShadowPolicy(),
    events,
  }
  return immutableShadowValue({ ...withoutHash, artifactSha256: sha256ShadowValue(withoutHash) })
}

export function verifyShadowRunRollbackArtifact(input: {
  rollback: ShadowRunRollbackArtifact
  scope: AuthorizedDevelopmentShadowScope
}): void {
  const rollback = input.rollback
  exactKeys(
    rollback,
    ['schemaVersion', 'priorArtifact', 'priorArtifactSha256', 'policy', 'events', 'artifactSha256'],
    'shadow rollback artifact',
  )
  if (rollback.schemaVersion !== SHADOW_RUN_ROLLBACK_SCHEMA_VERSION) {
    throw new Error('Shadow rollback schema version is invalid.')
  }
  verifyShadowRunArtifact(rollback.priorArtifact, input.scope)
  if (rollback.priorArtifactSha256 !== rollback.priorArtifact.artifactSha256) {
    throw new Error('Shadow rollback prior artifact identity is invalid.')
  }
  const expectedHumanOnly = humanOnlyShadowPolicy()
  if (canonicalShadowJson(expectedHumanOnly) !== canonicalShadowJson(rollback.policy)) {
    throw new Error('Shadow rollback policy is not exact human-only policy.')
  }
  const event = rollback.events.at(-1)
  if (
    event?.eventType !== 'autonomy_rolled_back_to_human_only' ||
    canonicalShadowJson(rollback.events.slice(0, -1)) !==
      canonicalShadowJson(rollback.priorArtifact.events) ||
    (event.payload as { priorArtifactSha256?: string }).priorArtifactSha256 !==
      rollback.priorArtifactSha256
  ) {
    throw new Error('Shadow rollback event tail is not bound to the prior artifact.')
  }
  verifyShadowRunEventHistory(rollback.events)
  const { artifactSha256, ...withoutHash } = rollback
  if (artifactSha256 !== sha256ShadowValue(withoutHash)) {
    throw new Error('Shadow rollback artifact checksum mismatch.')
  }
}

export function acceptedShadowResults(
  artifact: ShadowRunArtifact,
  scope: AuthorizedDevelopmentShadowScope,
): readonly Readonly<AcceptedShadowComponentResult>[] {
  verifyShadowRunArtifact(artifact, scope)
  return artifact.attempts.flatMap((attempt) =>
    attempt.validation.valid ? [attempt.validation.result] : [],
  )
}
