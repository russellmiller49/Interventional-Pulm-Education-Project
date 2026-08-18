import {
  STAGE_A_CONFIDENCE_BANDS,
  STAGE_A_REASON_CODES,
  STAGE_A_TRIAGE_DECISIONS,
} from '../../src/features/literature/classifier/stage-a-contract'
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_BATCH_COMPLETION_WINDOW,
  LUNA_BATCH_ENDPOINT,
  LUNA_MAX_OUTPUT_TOKENS,
  LUNA_OPENAI_API_KEY_ENV_NAME,
  LUNA_OPENAI_BASE_URL,
  LUNA_OUTPUT_SCHEMA_NAME,
  type LunaReasoningEffort,
} from './constants'
import type { CohortEstimate } from './estimate'
import { reconcileRequestBodyText, reconcileShardContent } from './reconcile'

/**
 * The only network module in the Luna triage lane.
 *
 * Everything that could open a socket funnels through `executeOpenAiRequest`, and that
 * function demands a spend capability minted here. The capability is a module-private
 * `unique symbol` brand plus a WeakMap keyed on object identity, so a spread copy, structural
 * clone, or deserialized imitation is a different object and fails verification.
 *
 * The capability is not a bearer token and not a set of interchangeable permissions. It binds
 * an immutable envelope to an **ordered network plan**: a frozen list of numbered steps, each
 * naming its action, operation, method, endpoint class, body identity, expected record and
 * token contribution, and a single allowed execution. A step may not run out of order, may not
 * run twice, and no step may be appended after minting. The two genuinely dynamic values in
 * the lane — the file id a shard upload returns and the file ids a Batch status returns — are
 * bound into capability state by validated receipts and may never be supplied by a caller.
 *
 * The confirmation phrase is derived here from the operation id; no caller may choose it. The
 * API key is read from an injected provider, once, inside the final network boundary, strictly
 * after capability, sequence, byte, receipt, endpoint, and cost validation have all passed. A
 * refusal therefore opens zero sockets and performs zero key reads, and the generic redaction
 * path never touches the environment.
 */

export class SpendAuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpendAuthorizationError'
  }
}

/** The spending actions this lane knows how to authorize. Nothing else may open a socket. */
export const LUNA_SPEND_ACTIONS = [
  'run-sync',
  'batch-submit',
  'batch-status',
  'batch-fetch',
] as const

export type LunaSpendAction = (typeof LUNA_SPEND_ACTIONS)[number]

/** Actions that send cohort records to the model. The rest are control-plane calls. */
const RECORD_SPENDING_ACTIONS: ReadonlySet<LunaSpendAction> = new Set(['run-sync', 'batch-submit'])

/** The exact endpoints this lane can ever address. Paths are built here, never by callers. */
export const LUNA_ENDPOINT_CLASSES = [
  'responses.create',
  'files.upload',
  'batches.create',
  'batches.retrieve',
  'files.content',
] as const

export type LunaEndpointClass = (typeof LUNA_ENDPOINT_CLASSES)[number]

type EndpointFamily = 'responses' | 'files' | 'batches'

interface EndpointDefinition {
  readonly method: 'GET' | 'POST'
  readonly family: EndpointFamily
  readonly takesRemoteId: boolean
  readonly path: (remoteId: string | null) => string
}

const ENDPOINTS: Readonly<Record<LunaEndpointClass, EndpointDefinition>> = {
  'responses.create': {
    method: 'POST',
    family: 'responses',
    takesRemoteId: false,
    path: () => '/responses',
  },
  'files.upload': { method: 'POST', family: 'files', takesRemoteId: false, path: () => '/files' },
  'batches.create': {
    method: 'POST',
    family: 'batches',
    takesRemoteId: false,
    path: () => '/batches',
  },
  'batches.retrieve': {
    method: 'GET',
    family: 'batches',
    takesRemoteId: true,
    path: (remoteId) => `/batches/${remoteId ?? ''}`,
  },
  'files.content': {
    method: 'GET',
    family: 'files',
    takesRemoteId: true,
    path: (remoteId) => `/files/${remoteId ?? ''}/content`,
  },
}

/** Where a step's remote identifier is allowed to come from. Never from a caller argument. */
export type RemoteIdSource =
  | 'none'
  /** A local, already-validated identifier fixed at plan time (a receipt-bound Batch id). */
  | 'plan'
  /** The file id the immediately preceding validated upload returned. */
  | 'upload-receipt'
  /** A file id contained in the validated status receipt for this exact Batch. */
  | 'status-receipt'

/** What a step's request body must be, byte-exactly. */
export type PlanBodyIdentity =
  | { readonly kind: 'none' }
  | { readonly kind: 'digest'; readonly sha256: string }
  /** The reviewed Batch-creation template; its only dynamic value is the bound file id. */
  | { readonly kind: 'batch-create-template' }

/** The role a fetched Batch result file plays. Fixed at plan time, never caller-selected. */
export type BatchFileRole = 'output' | 'error'

/** One authorized network step. Ordered, immutable, single-use. */
export interface NetworkPlanStep {
  readonly sequenceIndex: number
  readonly action: LunaSpendAction
  readonly operationId: string
  readonly method: 'GET' | 'POST'
  readonly endpointClass: LunaEndpointClass
  readonly remoteIdSource: RemoteIdSource
  readonly planRemoteId: string | null
  readonly fileRole: BatchFileRole | null
  readonly body: PlanBodyIdentity
  /** The opaque record id a `responses.create` step answers; null elsewhere. */
  readonly recordId: string | null
  readonly expectedRecords: number
  readonly expectedInputTokens: number
  readonly expectedOutputTokens: number
  readonly allowedExecutions: 1
  /** True only for steps whose existence depends on a Batch actually producing that file. */
  readonly optional: boolean
}

/**
 * The immutable authorization envelope. A capability is minted for exactly one action, one
 * operation, one ordered plan, and one bounded set of totals; it authorizes nothing else.
 */
export interface SpendEnvelope {
  readonly action: LunaSpendAction
  readonly operationId: string
  readonly cohort: string
  /** The ordered-plan digest. Recomputed at mint; any step drift makes it a different plan. */
  readonly planSha256: string
  readonly recordCount: number
  readonly estimatedInputTokens: number
  readonly estimatedOutputTokenAllowance: number
  readonly estimatedTotalTokens: number
  readonly estimatedCostUsd: number
  readonly maxRecords: number
  readonly maxEstimatedCostUsd: number
  readonly steps: readonly NetworkPlanStep[]
  /** Hard ceiling on network requests: exactly one per planned step. */
  readonly maxNetworkRequests: number
}

const SPEND_BRAND: unique symbol = Symbol('literature-luna-spend-authorization')

interface StatusReceipt {
  readonly batchId: string
  readonly outputFileId: string | null
  readonly errorFileId: string | null
}

/** The bounded execution state behind one capability. Never reachable from outside. */
interface SpendLedger {
  readonly envelope: SpendEnvelope
  /** The lowest step index still executable. Never moves backwards. */
  cursor: number
  readonly executed: boolean[]
  consumed: number
  uploadFileId: string | null
  createdBatchId: string | null
  statusReceipt: StatusReceipt | null
}

const authorizedSpends = new WeakMap<object, SpendLedger>()

/** Opaque spend capability. Only `mintSpendAuthorization` can create a verifiable one. */
export type SpendAuthorization = object

export interface SpendAuthorizationRequest {
  /** `--confirm-api-spend` was literally present on the command line. */
  readonly confirmFlagPresent: boolean
  /** True only when both stdin and stdout are TTYs, so a human typed the phrase. */
  readonly interactiveTty: boolean
  /** Exactly what the owner typed. Compared byte-for-byte with the derived phrase. */
  readonly interactivePhrase: string | null
  /** Exactly what is being authorized. Nothing outside it may reach the network. */
  readonly envelope: SpendEnvelope
  readonly estimate: CohortEstimate
  /**
   * The exact prepared bytes behind every body-bearing step, in plan order. Totals and digests
   * are recomputed from these, so a plan that undercounts what it will send never mints.
   */
  readonly plannedBodies: readonly string[]
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const OPERATION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u
const REMOTE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u
const MAX_AUTHORIZED_NETWORK_REQUESTS = 200_000

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function refuse(message: string): never {
  throw new SpendAuthorizationError(`${message} Nothing was sent.`)
}

/** The confirmation phrase is derived here, from the operation id. No caller may supply it. */
export function requiredConfirmationPhrase(operationId: string): string {
  if (typeof operationId !== 'string' || !OPERATION_ID_PATTERN.test(operationId)) {
    refuse('A confirmation phrase can only be derived for a valid operation id.')
  }
  return `SPEND ${operationId}`
}

/**
 * Validate a remote Batch/file identifier exhaustively before it is allowed near a URL.
 *
 * Separators, dot segments, percent-encoded separators or dot segments, query and fragment
 * characters, whitespace, control characters, and empty or overlong values are each refused by
 * name, so a rejection says which rule fired instead of only that a pattern missed.
 */
export function assertSafeRemoteIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    refuse(`The ${label} is missing or not a string.`)
  }
  if (value.length > 128) refuse(`The ${label} is too long.`)
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x20 || code === 0x7f)
      refuse(`The ${label} contains whitespace or a control character.`)
  }
  if (value.includes('/') || value.includes('\\')) refuse(`The ${label} contains a path separator.`)
  if (value.includes('.')) refuse(`The ${label} contains a dot segment character.`)
  if (value.includes('?') || value.includes('#'))
    refuse(`The ${label} contains a query or fragment character.`)
  if (/%[0-9a-fA-F]{2}/u.test(value)) refuse(`The ${label} contains a percent-encoded sequence.`)
  if (value.includes('%')) refuse(`The ${label} contains a percent character.`)
  if (!REMOTE_ID_PATTERN.test(value)) refuse(`The ${label} is not a plain remote identifier.`)
  return value
}

/**
 * Build the endpoint path from validated components and prove that URL normalization did not
 * move it. A path is only ever accepted if the URL the runtime would actually request
 * canonicalizes back to precisely the endpoint family, path, and origin that were authorized.
 */
export function buildEndpointUrl(
  endpointClass: LunaEndpointClass,
  remoteId: string | null,
): { readonly path: string; readonly url: string } {
  const definition = ENDPOINTS[endpointClass]
  if (!definition) refuse('An unknown endpoint class was requested.')
  if (definition.takesRemoteId) {
    if (remoteId === null) refuse('This endpoint requires a remote identifier.')
    assertSafeRemoteIdentifier(remoteId, 'remote identifier')
  } else if (remoteId !== null) {
    refuse('This endpoint does not take a remote identifier.')
  }
  const path = definition.path(remoteId)
  const base = new URL(LUNA_OPENAI_BASE_URL)
  const url = new URL(`${LUNA_OPENAI_BASE_URL}${path}`)
  if (url.origin !== base.origin) refuse('The constructed endpoint left the authorized origin.')
  if (url.search.length > 0 || url.hash.length > 0) {
    refuse('The constructed endpoint carries a query or fragment.')
  }
  const expectedPathname = `${base.pathname.replace(/\/$/u, '')}${path}`
  if (url.pathname !== expectedPathname) {
    refuse('URL normalization changed the endpoint; refusing to send it.')
  }
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0)
  // segments[0] is the API version; segments[1] must still be the authorized family.
  if (segments[1] !== definition.family) {
    refuse('The normalized endpoint belongs to a different endpoint family than authorized.')
  }
  return { path, url: url.toString() }
}

/** The reviewed Batch-creation body. Its only dynamic value is the bound uploaded file id. */
export function batchCreateTemplateBody(inputFileId: string): Record<string, unknown> {
  assertSafeRemoteIdentifier(inputFileId, 'uploaded file id')
  return {
    input_file_id: inputFileId,
    endpoint: LUNA_BATCH_ENDPOINT,
    completion_window: LUNA_BATCH_COMPLETION_WINDOW,
  }
}

function normalizeBodyIdentity(value: unknown, index: number): PlanBodyIdentity {
  if (!value || typeof value !== 'object') refuse(`Plan step ${index} has no body identity.`)
  const kind = (value as { kind?: unknown }).kind
  if (kind === 'none') return Object.freeze({ kind: 'none' as const })
  if (kind === 'batch-create-template') {
    return Object.freeze({ kind: 'batch-create-template' as const })
  }
  if (kind === 'digest') {
    const digest = (value as { sha256?: unknown }).sha256
    if (typeof digest !== 'string' || !SHA256_PATTERN.test(digest)) {
      refuse(`Plan step ${index} has a malformed body digest.`)
    }
    return Object.freeze({ kind: 'digest' as const, sha256: digest })
  }
  return refuse(`Plan step ${index} has an unknown body identity.`)
}

/** Copy each step into a frozen value read exactly once, so caller mutation cannot reach it. */
function normalizeStep(
  step: NetworkPlanStep,
  index: number,
  action: LunaSpendAction,
  operationId: string,
): NetworkPlanStep {
  if (!step || typeof step !== 'object') refuse(`Plan step ${index} is not an object.`)
  if (step.sequenceIndex !== index) refuse(`Plan step ${index} declares the wrong sequence index.`)
  if (step.action !== action) refuse(`Plan step ${index} names a different action than the plan.`)
  if (step.operationId !== operationId) {
    refuse(`Plan step ${index} names a different operation than the plan.`)
  }
  const endpointClass = step.endpointClass
  if (!(LUNA_ENDPOINT_CLASSES as readonly string[]).includes(endpointClass)) {
    refuse(`Plan step ${index} names an unknown endpoint class.`)
  }
  const definition = ENDPOINTS[endpointClass]
  if (step.method !== definition.method) {
    refuse(`Plan step ${index} names a method the endpoint does not use.`)
  }
  const remoteIdSource = step.remoteIdSource
  if (!['none', 'plan', 'upload-receipt', 'status-receipt'].includes(remoteIdSource)) {
    refuse(`Plan step ${index} names an unknown remote-identifier source.`)
  }
  if (definition.takesRemoteId && remoteIdSource === 'none') {
    refuse(`Plan step ${index} needs a remote identifier but names no source for it.`)
  }
  if (
    !definition.takesRemoteId &&
    remoteIdSource !== 'none' &&
    remoteIdSource !== 'upload-receipt'
  ) {
    refuse(`Plan step ${index} names a remote identifier the endpoint cannot use.`)
  }
  let planRemoteId: string | null = null
  if (remoteIdSource === 'plan') {
    planRemoteId = assertSafeRemoteIdentifier(step.planRemoteId, `plan step ${index} identifier`)
  } else if (step.planRemoteId !== null) {
    refuse(`Plan step ${index} pins an identifier its source does not allow.`)
  }
  const fileRole = step.fileRole
  if (endpointClass === 'files.content') {
    if (fileRole !== 'output' && fileRole !== 'error') {
      refuse(`Plan step ${index} must name which Batch result file it fetches.`)
    }
  } else if (fileRole !== null) {
    refuse(`Plan step ${index} names a file role it cannot have.`)
  }
  const body = normalizeBodyIdentity(step.body, index)
  if (definition.method === 'GET' && body.kind !== 'none') {
    refuse(`Plan step ${index} attaches a body to a GET.`)
  }
  if (definition.method === 'POST' && body.kind === 'none') {
    refuse(`Plan step ${index} sends a POST with no body identity.`)
  }
  if (endpointClass === 'batches.create' && body.kind !== 'batch-create-template') {
    refuse(`Plan step ${index} must use the reviewed Batch-creation template.`)
  }
  if (endpointClass !== 'batches.create' && body.kind === 'batch-create-template') {
    refuse(`Plan step ${index} may not use the Batch-creation template.`)
  }
  const recordId = step.recordId
  if (endpointClass === 'responses.create') {
    if (typeof recordId !== 'string' || recordId.length === 0) {
      refuse(`Plan step ${index} must name the record it answers.`)
    }
  } else if (recordId !== null) {
    refuse(`Plan step ${index} names a record it does not answer.`)
  }
  if (
    !isNonNegativeSafeInteger(step.expectedRecords) ||
    !isNonNegativeSafeInteger(step.expectedInputTokens) ||
    !isNonNegativeSafeInteger(step.expectedOutputTokens)
  ) {
    refuse(`Plan step ${index} has a malformed record or token contribution.`)
  }
  if (step.allowedExecutions !== 1) {
    refuse(`Plan step ${index} does not declare exactly one allowed execution.`)
  }
  if (typeof step.optional !== 'boolean') {
    refuse(`Plan step ${index} does not declare whether it is optional.`)
  }
  return Object.freeze({
    sequenceIndex: index,
    action,
    operationId,
    method: definition.method,
    endpointClass,
    remoteIdSource,
    planRemoteId,
    fileRole: fileRole ?? null,
    body,
    recordId: recordId ?? null,
    expectedRecords: step.expectedRecords,
    expectedInputTokens: step.expectedInputTokens,
    expectedOutputTokens: step.expectedOutputTokens,
    allowedExecutions: 1,
    optional: step.optional,
  })
}

/** The digest that names one ordered plan. Any step drift produces a different plan. */
export function networkPlanSha256(steps: readonly NetworkPlanStep[]): string {
  return sha256(canonicalJson(steps))
}

/** Per-action shape: the exact ordered sequence each spending action is allowed to perform. */
function assertPlanShape(envelope: SpendEnvelope): void {
  const steps = envelope.steps
  if (envelope.action === 'run-sync') {
    if (steps.length !== envelope.recordCount) {
      refuse('A run-sync plan must name exactly one request per record.')
    }
    const seenRecords = new Set<string>()
    for (const step of steps) {
      if (
        step.endpointClass !== 'responses.create' ||
        step.body.kind !== 'digest' ||
        step.optional ||
        step.expectedRecords !== 1
      ) {
        refuse('A run-sync plan may name only digest-bound, mandatory /responses steps.')
      }
      if (step.recordId === null || seenRecords.has(step.recordId)) {
        refuse('A run-sync plan names the same record twice.')
      }
      seenRecords.add(step.recordId)
    }
    return
  }
  if (envelope.action === 'batch-submit') {
    const [upload, create] = steps
    if (
      steps.length !== 2 ||
      upload?.endpointClass !== 'files.upload' ||
      upload.body.kind !== 'digest' ||
      upload.optional ||
      create?.endpointClass !== 'batches.create' ||
      create.body.kind !== 'batch-create-template' ||
      create.remoteIdSource !== 'upload-receipt' ||
      create.optional
    ) {
      refuse('A batch-submit plan must be exactly one shard upload then one job creation.')
    }
    return
  }
  if (envelope.action === 'batch-status') {
    const [status] = steps
    if (
      steps.length !== 1 ||
      status?.endpointClass !== 'batches.retrieve' ||
      status.remoteIdSource !== 'plan' ||
      status.optional
    ) {
      refuse('A batch-status plan must name exactly one receipt-bound status request.')
    }
    return
  }
  const [status, output, error] = steps
  if (
    steps.length !== 3 ||
    status?.endpointClass !== 'batches.retrieve' ||
    status.remoteIdSource !== 'plan' ||
    status.optional ||
    output?.endpointClass !== 'files.content' ||
    output.remoteIdSource !== 'status-receipt' ||
    output.fileRole !== 'output' ||
    !output.optional ||
    error?.endpointClass !== 'files.content' ||
    error.remoteIdSource !== 'status-receipt' ||
    error.fileRole !== 'error' ||
    !error.optional
  ) {
    refuse('A batch-fetch plan must be one status request then the two result-file fetches.')
  }
}

/**
 * Validate every number against the estimate and the owner ceilings, then return a frozen
 * envelope built from the validated primitives.
 *
 * Control-plane actions send no records, so their record count must be exactly zero; the
 * record-spending actions must carry a positive count. Every non-integer, non-finite,
 * negative, fractional, or unsafe value is refused before a capability exists.
 */
function normalizeEnvelope(envelope: SpendEnvelope, estimate: CohortEstimate): SpendEnvelope {
  if (!envelope || typeof envelope !== 'object') refuse('The spend envelope is missing.')
  const action = envelope.action
  if (!(LUNA_SPEND_ACTIONS as readonly string[]).includes(action)) {
    refuse('The spend envelope names an unknown action.')
  }
  const { operationId, cohort, planSha256 } = envelope
  if (typeof operationId !== 'string' || !OPERATION_ID_PATTERN.test(operationId)) {
    refuse('The spend envelope has no valid operation id.')
  }
  if (typeof cohort !== 'string' || cohort.length === 0 || cohort.length > 64) {
    refuse('The spend envelope has no valid cohort label.')
  }
  if (typeof planSha256 !== 'string' || !SHA256_PATTERN.test(planSha256)) {
    refuse('The spend envelope has no valid plan digest.')
  }

  const {
    recordCount,
    estimatedInputTokens,
    estimatedOutputTokenAllowance,
    estimatedTotalTokens,
    estimatedCostUsd,
    maxRecords,
    maxEstimatedCostUsd,
  } = envelope
  if (!isNonNegativeSafeInteger(recordCount)) {
    refuse('The authorized record count must be a non-negative safe integer.')
  }
  if (RECORD_SPENDING_ACTIONS.has(action) ? recordCount < 1 : recordCount !== 0) {
    refuse(`The authorized record count ${recordCount} is impossible for a ${action} spend.`)
  }
  if (!isNonNegativeSafeInteger(estimate.records) || estimate.records !== recordCount) {
    refuse(
      `The estimate covers ${String(estimate.records)} records but ${recordCount} were authorized.`,
    )
  }
  if (
    !isNonNegativeSafeInteger(estimatedInputTokens) ||
    !isNonNegativeSafeInteger(estimatedOutputTokenAllowance) ||
    !isNonNegativeSafeInteger(estimatedTotalTokens)
  ) {
    refuse('Every token estimate must be a non-negative safe integer.')
  }
  if (estimatedInputTokens + estimatedOutputTokenAllowance !== estimatedTotalTokens) {
    refuse('The token estimate does not reconcile: input + output must equal the total.')
  }
  if (
    estimate.inputTokens !== estimatedInputTokens ||
    estimate.outputTokenAllowance !== estimatedOutputTokenAllowance ||
    estimate.totalTokenAllowance !== estimatedTotalTokens
  ) {
    refuse('The authorized token estimate disagrees with the cohort estimate.')
  }
  if (!isNonNegativeFinite(estimatedCostUsd) || estimatedCostUsd !== estimate.estimatedCostUsd) {
    refuse('The authorized cost must be a finite, non-negative number equal to the estimate.')
  }
  if (!isPositiveSafeInteger(maxRecords)) {
    refuse('--max-records must be a positive safe integer.')
  }
  if (
    typeof maxEstimatedCostUsd !== 'number' ||
    !Number.isFinite(maxEstimatedCostUsd) ||
    maxEstimatedCostUsd <= 0
  ) {
    refuse('--max-estimated-cost-usd must be a finite positive number.')
  }
  if (recordCount > maxRecords) {
    refuse(`The cohort of ${recordCount} records exceeds --max-records ${maxRecords}.`)
  }
  if (estimatedCostUsd > maxEstimatedCostUsd) {
    refuse(
      `The estimated cost $${estimatedCostUsd} exceeds --max-estimated-cost-usd ` +
        `${maxEstimatedCostUsd}.`,
    )
  }

  const rawSteps = envelope.steps
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    refuse('A spend authorization must name at least one network step.')
  }
  if (rawSteps.length > MAX_AUTHORIZED_NETWORK_REQUESTS) {
    refuse('A spend authorization may not name that many network steps.')
  }
  const steps = rawSteps.map((step, index) => normalizeStep(step, index, action, operationId))
  if (envelope.maxNetworkRequests !== steps.length) {
    refuse('The network-request ceiling must equal the number of planned steps.')
  }
  const normalized: SpendEnvelope = Object.freeze({
    action,
    operationId,
    cohort,
    planSha256,
    recordCount,
    estimatedInputTokens,
    estimatedOutputTokenAllowance,
    estimatedTotalTokens,
    estimatedCostUsd,
    maxRecords,
    maxEstimatedCostUsd,
    steps: Object.freeze(steps),
    maxNetworkRequests: steps.length,
  })
  assertPlanShape(normalized)
  if (networkPlanSha256(normalized.steps) !== planSha256) {
    refuse('The plan digest does not bind the ordered steps it claims to name.')
  }
  return normalized
}

/**
 * Recompute every gated number from the exact bytes that will be sent, and require exact
 * equality with the envelope. A two-record shard cannot mint under a one-record estimate,
 * and an undercounted token or cost total fails here rather than on the invoice.
 */
function assertEnvelopeReconciles(envelope: SpendEnvelope, plannedBodies: readonly string[]): void {
  if (!Array.isArray(plannedBodies)) refuse('The prepared request bytes are missing.')
  const bodySteps = envelope.steps.filter((step) => step.body.kind === 'digest')
  if (plannedBodies.length !== bodySteps.length) {
    refuse(
      `The plan names ${bodySteps.length} body-bearing steps but ${plannedBodies.length} sets ` +
        'of prepared bytes were supplied.',
    )
  }
  let records = 0
  let inputTokens = 0
  let outputTokens = 0
  bodySteps.forEach((step, index) => {
    const bytes = plannedBodies[index]
    if (typeof bytes !== 'string' || bytes.length === 0) {
      refuse(`The prepared bytes for step ${step.sequenceIndex} are missing.`)
    }
    const digest = sha256(bytes)
    if (step.body.kind !== 'digest' || step.body.sha256 !== digest) {
      refuse(`The prepared bytes for step ${step.sequenceIndex} do not match its body digest.`)
    }
    if (step.endpointClass === 'responses.create') {
      const reconciliation = reconcileRequestBodyText(bytes)
      if (reconciliation.recordId !== step.recordId) {
        refuse(`Step ${step.sequenceIndex} answers a different record than it declares.`)
      }
      if (
        step.expectedRecords !== 1 ||
        step.expectedInputTokens !== reconciliation.inputTokens ||
        step.expectedOutputTokens !== reconciliation.outputTokenAllowance
      ) {
        refuse(`Step ${step.sequenceIndex} understates what its request actually costs.`)
      }
      records += 1
      inputTokens += reconciliation.inputTokens
      outputTokens += reconciliation.outputTokenAllowance
      return
    }
    if (step.endpointClass === 'files.upload') {
      const reconciliation = reconcileShardContent(bytes)
      if (reconciliation.uniqueCustomIdCount !== reconciliation.recordCount) {
        refuse(`Step ${step.sequenceIndex} uploads a shard with duplicate custom ids.`)
      }
      if (
        step.expectedRecords !== reconciliation.recordCount ||
        step.expectedInputTokens !== reconciliation.estimatedInputTokens ||
        step.expectedOutputTokens !== reconciliation.estimatedOutputTokenAllowance
      ) {
        refuse(`Step ${step.sequenceIndex} understates what its shard actually contains.`)
      }
      records += reconciliation.recordCount
      inputTokens += reconciliation.estimatedInputTokens
      outputTokens += reconciliation.estimatedOutputTokenAllowance
      return
    }
    refuse(`Step ${step.sequenceIndex} carries bytes its endpoint class does not send.`)
  })
  if (records !== envelope.recordCount) {
    refuse(
      `The prepared bytes carry ${records} records but ${envelope.recordCount} were authorized.`,
    )
  }
  if (
    inputTokens !== envelope.estimatedInputTokens ||
    outputTokens !== envelope.estimatedOutputTokenAllowance ||
    inputTokens + outputTokens !== envelope.estimatedTotalTokens
  ) {
    refuse('The prepared bytes cost more tokens than the authorization allows.')
  }
}

/**
 * Mint a spend authorization. Every gate is re-checked here even when the CLI already checked
 * it, because this is the last stop before a socket can open.
 */
export function mintSpendAuthorization(request: SpendAuthorizationRequest): SpendAuthorization {
  if (!request.confirmFlagPresent) {
    refuse('API spend requires the explicit --confirm-api-spend flag.')
  }
  if (request.interactiveTty !== true) {
    refuse('API spend requires an interactive terminal for the owner confirmation.')
  }
  if (!request.envelope || typeof request.envelope !== 'object') {
    refuse('The spend envelope is missing.')
  }
  // Derived here, from the operation id, and compared byte-for-byte. No caller supplies it.
  const requiredPhrase = requiredConfirmationPhrase(request.envelope.operationId)
  if (
    typeof request.interactivePhrase !== 'string' ||
    request.interactivePhrase !== requiredPhrase
  ) {
    refuse('API spend requires the owner to type the exact derived confirmation phrase.')
  }
  const envelope = normalizeEnvelope(request.envelope, request.estimate)
  assertEnvelopeReconciles(envelope, request.plannedBodies)
  const capability: SpendAuthorization = Object.create(null) as object
  Object.defineProperty(capability, SPEND_BRAND, { value: SPEND_BRAND })
  authorizedSpends.set(capability, {
    envelope,
    cursor: 0,
    executed: envelope.steps.map(() => false),
    consumed: 0,
    uploadFileId: null,
    createdBatchId: null,
    statusReceipt: null,
  })
  return Object.freeze(capability)
}

function ledgerOf(capability: SpendAuthorization): SpendLedger {
  const ledger = authorizedSpends.get(capability)
  const branded = (capability as Record<PropertyKey, unknown>)[SPEND_BRAND]
  if (!ledger || branded !== SPEND_BRAND) {
    refuse('A structurally forged or copied spend authorization was refused.')
  }
  return ledger
}

/** Verify the capability itself and return what it authorizes. */
export function assertSpendAuthorized(capability: SpendAuthorization): SpendEnvelope {
  return ledgerOf(capability).envelope
}

/**
 * Verify that this capability was minted for exactly this action, operation, and plan. An
 * authorization for one plan, step set, operation, or action never authorizes another, so
 * packet, request, shard, or plan byte drift after minting fails here — before any socket.
 */
export function assertSpendEnvelope(
  capability: SpendAuthorization,
  expected: {
    readonly action: LunaSpendAction
    readonly operationId: string
    readonly planSha256: string
  },
): SpendEnvelope {
  const envelope = assertSpendAuthorized(capability)
  if (envelope.action !== expected.action) {
    refuse(`This capability authorizes ${envelope.action}, not ${expected.action}.`)
  }
  if (envelope.operationId !== expected.operationId) {
    refuse('This capability was minted for a different operation.')
  }
  if (envelope.planSha256 !== expected.planSha256) {
    refuse('The plan digest changed after authorization; the authorized plan no longer exists.')
  }
  return envelope
}

/** How many authorized network steps this capability has left. */
export function remainingNetworkBudget(capability: SpendAuthorization): number {
  const ledger = ledgerOf(capability)
  return ledger.envelope.maxNetworkRequests - ledger.consumed
}

/** Require that every mandatory step ran. A plan with a missing request is an incomplete run. */
export function assertNetworkPlanComplete(capability: SpendAuthorization): void {
  const ledger = ledgerOf(capability)
  ledger.envelope.steps.forEach((step, index) => {
    if (!step.optional && !ledger.executed[index]) {
      refuse(`Plan step ${index} was authorized but never executed; the run is incomplete.`)
    }
  })
}

/**
 * Bind the file id one validated upload returned. Only the immediately preceding upload step
 * may supply it, and it may be bound once.
 */
export function bindUploadedFileId(capability: SpendAuthorization, fileId: unknown): string {
  const ledger = ledgerOf(capability)
  if (ledger.envelope.action !== 'batch-submit') {
    refuse('Only a batch-submit capability can bind an uploaded file id.')
  }
  if (ledger.uploadFileId !== null) refuse('An uploaded file id is already bound.')
  if (!ledger.executed[0]) refuse('No validated upload has happened yet.')
  const validated = assertSafeRemoteIdentifier(fileId, 'uploaded file id')
  ledger.uploadFileId = validated
  return validated
}

/** Bind the Batch id one validated creation returned. */
export function bindCreatedBatchId(capability: SpendAuthorization, batchId: unknown): string {
  const ledger = ledgerOf(capability)
  if (ledger.envelope.action !== 'batch-submit') {
    refuse('Only a batch-submit capability can bind a created Batch id.')
  }
  if (ledger.createdBatchId !== null) refuse('A created Batch id is already bound.')
  const validated = assertSafeRemoteIdentifier(batchId, 'created Batch id')
  ledger.createdBatchId = validated
  return validated
}

/**
 * Bind the exact result-file ids a validated status response reported for this Batch. The
 * status must name the Batch this capability was planned against, so Batch A authority can
 * never come to hold Batch B's file ids.
 */
export function bindStatusReceipt(
  capability: SpendAuthorization,
  receipt: {
    readonly batchId: unknown
    readonly outputFileId: unknown
    readonly errorFileId: unknown
  },
): StatusReceipt {
  const ledger = ledgerOf(capability)
  if (ledger.envelope.action !== 'batch-status' && ledger.envelope.action !== 'batch-fetch') {
    refuse('Only a control-plane capability can bind a status receipt.')
  }
  const planned = ledger.envelope.steps[0]?.planRemoteId
  const batchId = assertSafeRemoteIdentifier(receipt.batchId, 'status Batch id')
  if (batchId !== planned) {
    refuse('The status response names a different Batch than the one that was requested.')
  }
  const outputFileId =
    receipt.outputFileId === null || receipt.outputFileId === undefined
      ? null
      : assertSafeRemoteIdentifier(receipt.outputFileId, 'output file id')
  const errorFileId =
    receipt.errorFileId === null || receipt.errorFileId === undefined
      ? null
      : assertSafeRemoteIdentifier(receipt.errorFileId, 'error file id')
  const bound: StatusReceipt = Object.freeze({ batchId, outputFileId, errorFileId })
  ledger.statusReceipt = bound
  return bound
}

/** What a caller is asking to send. It never carries a path, and never carries a key. */
export type StepIntent =
  | {
      readonly kind: 'responses.create'
      readonly action: 'run-sync'
      readonly operationId: string
      readonly recordId: string
      readonly bodyText: string
    }
  | {
      readonly kind: 'files.upload'
      readonly action: 'batch-submit'
      readonly operationId: string
      readonly shardContent: string
      readonly filename: string
    }
  | {
      readonly kind: 'batches.create'
      readonly action: 'batch-submit'
      readonly operationId: string
    }
  | {
      readonly kind: 'batches.retrieve'
      readonly action: 'batch-status' | 'batch-fetch'
      readonly operationId: string
    }
  | {
      readonly kind: 'files.content'
      readonly action: 'batch-fetch'
      readonly operationId: string
      readonly fileRole: BatchFileRole
    }

interface AuthorizedRequest {
  readonly step: NetworkPlanStep
  readonly method: 'GET' | 'POST'
  readonly path: string
  readonly url: string
  readonly bodyText: string | null
  readonly formData: FormData | null
  readonly bodySha256: string | null
}

/**
 * Resolve the next authorized step for this intent, consume it, and return the exact request
 * to send. Order, identity, bytes, receipts, endpoint normalization, and cost are all proven
 * here — before the key provider is touched and before a socket exists.
 */
function authorizeNextStep(capability: SpendAuthorization, intent: StepIntent): AuthorizedRequest {
  const ledger = ledgerOf(capability)
  const envelope = ledger.envelope
  if (envelope.action !== intent.action) {
    refuse(`This capability authorizes ${envelope.action}, not ${intent.action}.`)
  }
  if (envelope.operationId !== intent.operationId) {
    refuse('This capability was minted for a different operation.')
  }
  if (ledger.consumed >= envelope.maxNetworkRequests) {
    refuse('The authorized network-request budget is exhausted.')
  }

  // Find the step this intent names, at or after the cursor. Never before it: a step already
  // passed is either already executed or deliberately skipped, and neither may run now.
  let index = -1
  for (let candidate = ledger.cursor; candidate < envelope.steps.length; candidate += 1) {
    const step = envelope.steps[candidate]
    if (step.endpointClass !== intent.kind) continue
    if (intent.kind === 'responses.create' && step.recordId !== intent.recordId) continue
    if (intent.kind === 'files.content' && step.fileRole !== intent.fileRole) continue
    index = candidate
    break
  }
  if (index < 0) {
    refuse('This request is not the next thing the owner authorized, or it already ran.')
  }
  const step = envelope.steps[index]
  if (ledger.executed[index]) refuse('An authorized step may run only once.')

  let remoteId: string | null = null
  if (step.remoteIdSource === 'plan') {
    remoteId = step.planRemoteId
  } else if (step.remoteIdSource === 'status-receipt') {
    const receipt = ledger.statusReceipt
    if (!receipt) refuse('No validated status receipt binds this Batch; refusing to fetch a file.')
    const fileId = step.fileRole === 'output' ? receipt.outputFileId : receipt.errorFileId
    if (!fileId) refuse('The validated status receipt names no such result file.')
    remoteId = fileId
  }

  let bodyText: string | null = null
  let formData: FormData | null = null
  let bodySha256: string | null = null
  if (step.body.kind === 'digest') {
    const bytes =
      intent.kind === 'responses.create'
        ? intent.bodyText
        : intent.kind === 'files.upload'
          ? intent.shardContent
          : null
    if (typeof bytes !== 'string' || bytes.length === 0) {
      refuse('The request bytes for this step are missing.')
    }
    // Recomputed here, immediately before the socket, from the bytes actually in hand.
    bodySha256 = sha256(bytes)
    if (bodySha256 !== step.body.sha256) {
      refuse('The request bytes changed after authorization; the authorized request is gone.')
    }
    if (intent.kind === 'responses.create') {
      const reconciliation = reconcileRequestBodyText(bytes)
      if (
        reconciliation.recordId !== step.recordId ||
        reconciliation.inputTokens !== step.expectedInputTokens ||
        reconciliation.outputTokenAllowance !== step.expectedOutputTokens
      ) {
        refuse('The request no longer matches the record and cost it was authorized for.')
      }
      bodyText = bytes
    } else if (intent.kind === 'files.upload') {
      const reconciliation = reconcileShardContent(bytes)
      if (
        reconciliation.recordCount !== step.expectedRecords ||
        reconciliation.uniqueCustomIdCount !== step.expectedRecords ||
        reconciliation.estimatedInputTokens !== step.expectedInputTokens ||
        reconciliation.estimatedOutputTokenAllowance !== step.expectedOutputTokens ||
        reconciliation.contentSha256 !== step.body.sha256
      ) {
        refuse('The shard no longer matches the records and cost it was authorized for.')
      }
      formData = new FormData()
      formData.append('purpose', 'batch')
      formData.append(
        'file',
        new Blob([bytes], { type: 'application/jsonl' }),
        assertSafeShardFilename(intent.filename),
      )
    }
  } else if (step.body.kind === 'batch-create-template') {
    const fileId = ledger.uploadFileId
    if (!fileId) {
      refuse('No validated upload has bound a file id; the Batch creation has nothing to name.')
    }
    // The body is built here from the frozen template and the bound file id only.
    bodyText = canonicalJson(batchCreateTemplateBody(fileId))
    bodySha256 = sha256(bodyText)
  }

  const endpoint = buildEndpointUrl(step.endpointClass, remoteId)
  ledger.executed[index] = true
  ledger.cursor = index + 1
  ledger.consumed += 1
  return {
    step,
    method: step.method,
    path: endpoint.path,
    url: endpoint.url,
    bodyText,
    formData,
    bodySha256,
  }
}

const SHARD_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u

/** Upload filenames are local, but they still ride to a remote service; keep them plain. */
export function assertSafeShardFilename(value: unknown): string {
  if (typeof value !== 'string' || !SHARD_FILENAME_PATTERN.test(value) || value.includes('..')) {
    refuse('The shard filename is not a plain local filename.')
  }
  return value
}

/**
 * Redact anything that looks like an API credential from text bound for logs or errors.
 *
 * This never reads the environment. Inside the socket boundary the already-read secret is
 * passed explicitly; everywhere else the generic credential shapes are all that is needed,
 * so a refusal path can log freely without ever touching the key provider.
 */
export function redactOpenAiSecrets(value: unknown, secret?: string): string {
  let output = value instanceof Error ? value.message : String(value)
  if (typeof secret === 'string' && secret.length > 0)
    output = output.replaceAll(secret, '[redacted]')
  output = output.replace(/sk-[A-Za-z0-9_-]{8,}/gu, '[redacted]')
  output = output.replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gu, 'Bearer [redacted]')
  return output
}

/** The strict structured-output JSON schema sent with every Stage-A request. */
export function buildStageAJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      record_id: {
        type: 'string',
        description: 'The opaque record_id copied verbatim from the packet.',
      },
      triage_decision: { type: 'string', enum: [...STAGE_A_TRIAGE_DECISIONS] },
      confidence_band: { type: 'string', enum: [...STAGE_A_CONFIDENCE_BANDS] },
      reason_codes: {
        type: 'array',
        items: { type: 'string', enum: [...STAGE_A_REASON_CODES] },
      },
    },
    required: ['record_id', 'triage_decision', 'confidence_band', 'reason_codes'],
    additionalProperties: false,
  }
}

export interface StageARequestParameters {
  readonly model: string
  readonly reasoning: LunaReasoningEffort
  readonly instructions: string
}

/**
 * One deterministic Responses API request body. Strict structured outputs, no tools, no web
 * search, no file search, nothing stored server-side.
 */
export function buildStageARequestBody(
  packet: UniversalPacket,
  parameters: StageARequestParameters,
): Record<string, unknown> {
  return {
    model: parameters.model,
    instructions: parameters.instructions,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: canonicalJson(packet) }],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: LUNA_OUTPUT_SCHEMA_NAME,
        strict: true,
        schema: buildStageAJsonSchema(),
      },
    },
    reasoning: { effort: parameters.reasoning },
    max_output_tokens: LUNA_MAX_OUTPUT_TOKENS,
    store: false,
    tools: [],
  }
}

/** The exact bytes a prepared request sends. Digest and wire bytes are the same string. */
export function requestBodyText(body: Record<string, unknown>): string {
  return canonicalJson(body)
}

export function requestBodySha256(body: Record<string, unknown>): string {
  return sha256(requestBodyText(body))
}

/** The API key is read through this, once, inside the socket boundary. */
export interface OpenAiKeyProvider {
  readonly readKey: () => string | undefined
}

export function environmentKeyProvider(): OpenAiKeyProvider {
  return { readKey: () => process.env[LUNA_OPENAI_API_KEY_ENV_NAME] }
}

export interface OpenAiHttpResult {
  readonly status: number
  readonly bodyText: string
  readonly bodySha256: string
}

export interface OpenAiRequestOptions {
  readonly intent: StepIntent
  readonly authorization: SpendAuthorization
  /** Test injection only; the default reads the process environment. */
  readonly keyProvider?: OpenAiKeyProvider
  /** Test injection only; the default is the platform fetch. */
  readonly fetchImplementation?: typeof fetch
}

/**
 * The single socket in the lane. Resolves and consumes exactly one ordered plan step, then —
 * and only then — reads the API key, sends exactly one request, and never retries.
 */
export async function executeOpenAiRequest(
  options: OpenAiRequestOptions,
): Promise<OpenAiHttpResult> {
  // Everything non-network happens first: a refusal here read no key and opened no socket.
  const authorized = authorizeNextStep(options.authorization, options.intent)
  const keyProvider = options.keyProvider ?? environmentKeyProvider()
  const key = keyProvider.readKey()
  if (!key) {
    throw new SpendAuthorizationError(
      `The ${LUNA_OPENAI_API_KEY_ENV_NAME} environment variable is not set. Nothing was sent.`,
    )
  }
  const fetchImplementation = options.fetchImplementation ?? fetch
  const headers: Record<string, string> = { authorization: `Bearer ${key}` }
  let body: BodyInit | undefined
  if (authorized.bodyText !== null) {
    headers['content-type'] = 'application/json'
    body = authorized.bodyText
  } else if (authorized.formData !== null) {
    body = authorized.formData
  }
  let response: Response
  try {
    response = await fetchImplementation(authorized.url, {
      method: authorized.method,
      headers,
      body,
    })
  } catch (error) {
    throw new Error(`The OpenAI request failed to send: ${redactOpenAiSecrets(error, key)}`)
  }
  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(
      `The OpenAI request returned HTTP ${response.status}: ` +
        redactOpenAiSecrets(bodyText.slice(0, 2_000), key),
    )
  }
  return { status: response.status, bodyText, bodySha256: sha256(bodyText) }
}
