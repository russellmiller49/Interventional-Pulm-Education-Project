import {
  STAGE_A_CONFIDENCE_BANDS,
  STAGE_A_REASON_CODES,
  STAGE_A_TRIAGE_DECISIONS,
} from '../../src/features/literature/classifier/stage-a-contract'
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_MAX_OUTPUT_TOKENS,
  LUNA_OPENAI_API_KEY_ENV_NAME,
  LUNA_OPENAI_BASE_URL,
  LUNA_OUTPUT_SCHEMA_NAME,
  type LunaReasoningEffort,
} from './constants'
import type { CohortEstimate } from './estimate'

/**
 * The only network module in the Luna triage lane.
 *
 * Everything that could ever open a socket funnels through `executeOpenAiRequest`, and that
 * function demands a spend authorization capability minted here. The capability is a
 * module-private `unique symbol` brand plus a WeakMap keyed on object identity, so a spread
 * copy, structural clone, or deserialized imitation of an authorization is a different object
 * and fails verification. No confirmation, no capability; no capability, no request.
 *
 * The capability is not a reusable bearer token. It binds an immutable envelope — action,
 * operation, plan digest, counts, ceilings — to a bounded execution ledger of exact request
 * identities, each consumable at most once. Anything outside that ledger, and anything past its
 * budget, is refused before the API key is read and before a socket exists.
 *
 * The API key exists only inside `executeOpenAiRequest`, read from `OPENAI_API_KEY` at call
 * time. It is never accepted as an argument, never stored, and every error message leaving
 * this module passes through `redactOpenAiSecrets`.
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

/**
 * One authorized network request, pinned by method, exact path, and canonical body digest.
 * `bodySha256: null` names a request whose body is only knowable from the immediately preceding
 * response (the Batch job creation carrying the uploaded file id); method, path, and use count
 * stay exact.
 */
export interface ExactRequestSlot {
  readonly kind: 'exact'
  readonly method: 'GET' | 'POST'
  readonly path: string
  readonly bodySha256: string | null
}

/**
 * A bounded follow-on request whose path segment is only knowable from a prior response (the
 * Batch output/error file ids). Method and the surrounding path are exact, the variable segment
 * must be one safe id, and the number of uses is bounded.
 */
export interface DerivedRequestSlot {
  readonly kind: 'derived'
  readonly method: 'GET' | 'POST'
  readonly pathPrefix: string
  readonly pathSuffix: string
  readonly maxUses: number
}

export type AuthorizedRequestSlot = ExactRequestSlot | DerivedRequestSlot

/**
 * The immutable authorization envelope. A capability is minted for exactly one action, one
 * operation, one plan digest, and one bounded set of request identities; it authorizes nothing
 * else, and every identity it does authorize is consumed at most once.
 */
export interface SpendEnvelope {
  readonly action: LunaSpendAction
  readonly operationId: string
  readonly cohort: string
  /** Request-manifest digest (sync) or Batch plan/control digest. Binds the plan to the spend. */
  readonly planSha256: string
  readonly recordCount: number
  readonly estimatedInputTokens: number
  readonly estimatedOutputTokenAllowance: number
  readonly estimatedTotalTokens: number
  readonly estimatedCostUsd: number
  readonly maxRecords: number
  readonly maxEstimatedCostUsd: number
  readonly requests: readonly AuthorizedRequestSlot[]
  /** Hard ceiling on network requests: the sum of every slot's use count. */
  readonly maxNetworkRequests: number
}

const SPEND_BRAND: unique symbol = Symbol('literature-luna-spend-authorization')

/** The bounded execution ledger behind one capability. Never reachable from outside. */
interface SpendLedger {
  readonly envelope: SpendEnvelope
  /** Remaining uses per exact request identity. */
  readonly exact: Map<string, number>
  readonly derived: { readonly slot: DerivedRequestSlot; remaining: number }[]
  consumed: number
}

const authorizedSpends = new WeakMap<object, SpendLedger>()

/** Opaque spend capability. Only `mintSpendAuthorization` can create a verifiable one. */
export type SpendAuthorization = object

export interface SpendAuthorizationRequest {
  /** `--confirm-api-spend` was literally present on the command line. */
  readonly confirmFlagPresent: boolean
  /** The exact phrase the owner typed interactively. */
  readonly interactivePhrase: string | null
  /** The phrase that was required, printed to the owner before the prompt. */
  readonly requiredPhrase: string
  /** Exactly what is being authorized. Nothing outside it may reach the network. */
  readonly envelope: SpendEnvelope
  readonly estimate: CohortEstimate
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const PATH_PATTERN = /^\/[A-Za-z0-9._~/-]{0,256}$/u
const DERIVED_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u
const OPERATION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u
const MAX_AUTHORIZED_NETWORK_REQUESTS = 200_000
const MAX_DERIVED_USES = 8

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

/** Identity key for one network request. Body drift changes the key, so drift never matches. */
function requestIdentity(method: string, path: string, bodySha256: string | null): string {
  return `${method} ${path} ${bodySha256 ?? '-'}`
}

/**
 * Copy every slot into a fresh, frozen value read exactly once, so a caller that mutates its
 * own object after minting cannot reach the ledger.
 */
function normalizeSlot(slot: AuthorizedRequestSlot, index: number): AuthorizedRequestSlot {
  if (!slot || typeof slot !== 'object') refuse(`Authorized request ${index} is not an object.`)
  const method = (slot as { method?: unknown }).method
  if (method !== 'GET' && method !== 'POST') {
    refuse(`Authorized request ${index} names an unsupported method.`)
  }
  const kind = (slot as { kind?: unknown }).kind
  if (kind === 'exact') {
    const path = (slot as ExactRequestSlot).path
    const bodySha256 = (slot as ExactRequestSlot).bodySha256
    if (typeof path !== 'string' || !PATH_PATTERN.test(path)) {
      refuse(`Authorized request ${index} has a malformed path.`)
    }
    if (
      bodySha256 !== null &&
      (typeof bodySha256 !== 'string' || !SHA256_PATTERN.test(bodySha256))
    ) {
      refuse(`Authorized request ${index} has a malformed body digest.`)
    }
    return Object.freeze({ kind: 'exact', method, path, bodySha256 })
  }
  if (kind === 'derived') {
    const pathPrefix = (slot as DerivedRequestSlot).pathPrefix
    const pathSuffix = (slot as DerivedRequestSlot).pathSuffix
    const maxUses = (slot as DerivedRequestSlot).maxUses
    if (typeof pathPrefix !== 'string' || !PATH_PATTERN.test(pathPrefix)) {
      refuse(`Authorized request ${index} has a malformed derived path prefix.`)
    }
    if (typeof pathSuffix !== 'string' || !/^[A-Za-z0-9._~/-]{0,64}$/u.test(pathSuffix)) {
      refuse(`Authorized request ${index} has a malformed derived path suffix.`)
    }
    if (!isPositiveSafeInteger(maxUses) || maxUses > MAX_DERIVED_USES) {
      refuse(`Authorized request ${index} has an out-of-range use count.`)
    }
    return Object.freeze({ kind: 'derived', method, pathPrefix, pathSuffix, maxUses })
  }
  return refuse(`Authorized request ${index} has an unknown kind.`)
}

/** Per-action shape: the exact request sequence each spending action is allowed to perform. */
function assertActionShape(envelope: SpendEnvelope): void {
  const slots = envelope.requests
  if (envelope.action === 'run-sync') {
    if (slots.length !== envelope.recordCount) {
      refuse('A run-sync authorization must name exactly one request per record.')
    }
    for (const slot of slots) {
      if (
        slot.kind !== 'exact' ||
        slot.method !== 'POST' ||
        slot.path !== '/responses' ||
        slot.bodySha256 === null
      ) {
        refuse('A run-sync authorization may name only digest-bound /responses requests.')
      }
    }
    return
  }
  if (envelope.action === 'batch-submit') {
    const [upload, create] = slots
    if (
      slots.length !== 2 ||
      upload.kind !== 'exact' ||
      upload.method !== 'POST' ||
      upload.path !== '/files' ||
      upload.bodySha256 === null ||
      create.kind !== 'exact' ||
      create.method !== 'POST' ||
      create.path !== '/batches' ||
      create.bodySha256 !== null
    ) {
      refuse('A batch-submit authorization must be exactly one shard upload and one job create.')
    }
    return
  }
  if (envelope.action === 'batch-status') {
    const [status] = slots
    if (
      slots.length !== 1 ||
      status.kind !== 'exact' ||
      status.method !== 'GET' ||
      !status.path.startsWith('/batches/') ||
      status.bodySha256 !== null
    ) {
      refuse('A batch-status authorization must name exactly one batch status request.')
    }
    return
  }
  const [status, content] = slots
  if (
    slots.length !== 2 ||
    status.kind !== 'exact' ||
    status.method !== 'GET' ||
    !status.path.startsWith('/batches/') ||
    status.bodySha256 !== null ||
    content.kind !== 'derived' ||
    content.method !== 'GET' ||
    content.pathPrefix !== '/files/' ||
    content.pathSuffix !== '/content'
  ) {
    refuse('A batch-fetch authorization must name one status request and bounded file fetches.')
  }
}

/**
 * Validate every number in the envelope against the estimate and the owner ceilings, then
 * return a frozen copy built from the validated primitives.
 *
 * Control-plane actions (`batch-status`, `batch-fetch`) send no records, so their record count
 * must be exactly zero; the record-spending actions must carry a positive count. Both are
 * stricter than "non-negative", and every non-integer, non-finite, negative, fractional, or
 * unsafe value is refused before a capability exists.
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

  const rawRequests = envelope.requests
  if (!Array.isArray(rawRequests) || rawRequests.length === 0) {
    refuse('A spend authorization must name at least one network request.')
  }
  const requests = rawRequests.map((slot, index) => normalizeSlot(slot, index))
  const maxNetworkRequests = requests.reduce(
    (sum, slot) => sum + (slot.kind === 'derived' ? slot.maxUses : 1),
    0,
  )
  if (maxNetworkRequests > MAX_AUTHORIZED_NETWORK_REQUESTS) {
    refuse('A spend authorization may not name that many network requests.')
  }
  const identities = new Set<string>()
  for (const slot of requests) {
    if (slot.kind !== 'exact') continue
    const identity = requestIdentity(slot.method, slot.path, slot.bodySha256)
    if (identities.has(identity)) {
      refuse('A spend authorization names the same exact request twice.')
    }
    identities.add(identity)
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
    requests: Object.freeze(requests),
    maxNetworkRequests,
  })
  assertActionShape(normalized)
  return normalized
}

/**
 * Mint a spend authorization. Every gate is re-checked here even when the CLI already checked
 * it, because this is the last stop before a socket can open.
 */
export function mintSpendAuthorization(request: SpendAuthorizationRequest): SpendAuthorization {
  if (!request.confirmFlagPresent) {
    refuse('API spend requires the explicit --confirm-api-spend flag.')
  }
  if (request.interactivePhrase === null || request.interactivePhrase !== request.requiredPhrase) {
    refuse('API spend requires the owner to type the exact confirmation phrase interactively.')
  }
  const envelope = normalizeEnvelope(request.envelope, request.estimate)
  const exact = new Map<string, number>()
  const derived: { slot: DerivedRequestSlot; remaining: number }[] = []
  for (const slot of envelope.requests) {
    if (slot.kind === 'exact') {
      exact.set(requestIdentity(slot.method, slot.path, slot.bodySha256), 1)
    } else {
      derived.push({ slot, remaining: slot.maxUses })
    }
  }
  const capability: SpendAuthorization = Object.create(null) as object
  Object.defineProperty(capability, SPEND_BRAND, { value: SPEND_BRAND })
  authorizedSpends.set(capability, { envelope, exact, derived, consumed: 0 })
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
 * authorization for one plan, request set, operation, or action never authorizes another, so
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

/** How many authorized network requests this capability has left. */
export function remainingNetworkBudget(capability: SpendAuthorization): number {
  const ledger = ledgerOf(capability)
  return ledger.envelope.maxNetworkRequests - ledger.consumed
}

/**
 * Consume one authorized network request identity, atomically and at most once. A copied,
 * recreated, already-consumed, over-consumed, wrong-action, wrong-operation, or wrong-request
 * capability fails here, and this runs before the API key is read and before any socket opens.
 */
export function consumeAuthorizedRequest(
  capability: SpendAuthorization,
  request: {
    readonly method: 'GET' | 'POST'
    readonly path: string
    readonly bodySha256: string | null
  },
): void {
  const ledger = ledgerOf(capability)
  if (ledger.consumed >= ledger.envelope.maxNetworkRequests) {
    refuse('The authorized network-request budget is exhausted.')
  }
  const identity = requestIdentity(request.method, request.path, request.bodySha256)
  const remainingExact = ledger.exact.get(identity)
  if (remainingExact !== undefined && remainingExact > 0) {
    ledger.exact.set(identity, remainingExact - 1)
    ledger.consumed += 1
    return
  }
  if (request.bodySha256 !== null) {
    // A body-derived slot names method and path exactly and leaves the body unbound.
    const unbound = requestIdentity(request.method, request.path, null)
    const remainingUnbound = ledger.exact.get(unbound)
    if (remainingUnbound !== undefined && remainingUnbound > 0) {
      ledger.exact.set(unbound, remainingUnbound - 1)
      ledger.consumed += 1
      return
    }
  }
  for (const entry of ledger.derived) {
    if (entry.remaining <= 0) continue
    if (entry.slot.method !== request.method) continue
    if (!request.path.startsWith(entry.slot.pathPrefix)) continue
    if (!request.path.endsWith(entry.slot.pathSuffix)) continue
    const middle = request.path.slice(
      entry.slot.pathPrefix.length,
      request.path.length - entry.slot.pathSuffix.length,
    )
    if (!DERIVED_SEGMENT_PATTERN.test(middle)) continue
    entry.remaining -= 1
    ledger.consumed += 1
    return
  }
  refuse('This request is not part of what the owner authorized.')
}

/** Redact anything that could be an API credential from text bound for logs or errors. */
export function redactOpenAiSecrets(value: unknown): string {
  let output = value instanceof Error ? value.message : String(value)
  const key = process.env[LUNA_OPENAI_API_KEY_ENV_NAME]
  if (key) output = output.replaceAll(key, '[redacted]')
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

export function requestBodySha256(body: Record<string, unknown>): string {
  return sha256(canonicalJson(body))
}

export interface OpenAiHttpResult {
  readonly status: number
  readonly bodyText: string
  readonly bodySha256: string
}

export interface OpenAiRequestOptions {
  readonly method: 'GET' | 'POST'
  readonly path: string
  readonly jsonBody?: Record<string, unknown>
  readonly formData?: FormData
  /**
   * The canonical digest of a non-JSON body, declared by the caller from the exact bytes it is
   * about to upload. JSON bodies are hashed here instead, so a caller cannot misdeclare them.
   */
  readonly bodyDigest?: string
  readonly authorization: SpendAuthorization
  /** Test injection only; the default is the platform fetch. */
  readonly fetchImplementation?: typeof fetch
}

/**
 * The single socket in the lane. Consumes one authorized request identity, reads the API key
 * from the environment at call time, sends exactly one request, and never retries.
 */
export async function executeOpenAiRequest(
  options: OpenAiRequestOptions,
): Promise<OpenAiHttpResult> {
  const bodySha256 =
    options.jsonBody !== undefined
      ? requestBodySha256(options.jsonBody)
      : (options.bodyDigest ?? null)
  // Consumed before anything else: a refusal here means no key was read and no socket opened.
  consumeAuthorizedRequest(options.authorization, {
    method: options.method,
    path: options.path,
    bodySha256,
  })
  const key = process.env[LUNA_OPENAI_API_KEY_ENV_NAME]
  if (!key) {
    throw new SpendAuthorizationError(
      `The ${LUNA_OPENAI_API_KEY_ENV_NAME} environment variable is not set. Nothing was sent.`,
    )
  }
  const fetchImplementation = options.fetchImplementation ?? fetch
  const headers: Record<string, string> = { authorization: `Bearer ${key}` }
  let body: BodyInit | undefined
  if (options.jsonBody !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(options.jsonBody)
  } else if (options.formData !== undefined) {
    body = options.formData
  }
  let response: Response
  try {
    response = await fetchImplementation(`${LUNA_OPENAI_BASE_URL}${options.path}`, {
      method: options.method,
      headers,
      body,
    })
  } catch (error) {
    throw new Error(`The OpenAI request failed to send: ${redactOpenAiSecrets(error)}`)
  }
  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(
      `The OpenAI request returned HTTP ${response.status}: ` +
        redactOpenAiSecrets(bodyText.slice(0, 2_000)),
    )
  }
  return { status: response.status, bodyText, bodySha256: sha256(bodyText) }
}
