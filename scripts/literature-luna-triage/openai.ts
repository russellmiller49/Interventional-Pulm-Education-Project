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

const SPEND_BRAND: unique symbol = Symbol('literature-luna-spend-authorization')

interface SpendAuthorizationRecord {
  readonly operationId: string
  readonly cohort: string
  readonly recordCount: number
  readonly maxRecords: number
  readonly maxEstimatedCostUsd: number
  readonly estimatedCostUsd: number
}

const authorizedSpends = new WeakMap<object, SpendAuthorizationRecord>()

/** Opaque spend capability. Only `mintSpendAuthorization` can create a verifiable one. */
export type SpendAuthorization = object

export interface SpendAuthorizationRequest {
  /** `--confirm-api-spend` was literally present on the command line. */
  readonly confirmFlagPresent: boolean
  /** The exact phrase the owner typed interactively. */
  readonly interactivePhrase: string | null
  /** The phrase that was required, printed to the owner before the prompt. */
  readonly requiredPhrase: string
  readonly operationId: string
  readonly cohort: string
  readonly recordCount: number
  readonly maxRecords: number
  readonly maxEstimatedCostUsd: number
  readonly estimate: CohortEstimate
}

/**
 * Mint a spend authorization. Every gate is re-checked here even when the CLI already checked
 * it, because this is the last stop before a socket can open.
 */
export function mintSpendAuthorization(request: SpendAuthorizationRequest): SpendAuthorization {
  if (!request.confirmFlagPresent) {
    throw new SpendAuthorizationError(
      'API spend requires the explicit --confirm-api-spend flag. Nothing was sent.',
    )
  }
  if (request.interactivePhrase === null || request.interactivePhrase !== request.requiredPhrase) {
    throw new SpendAuthorizationError(
      'API spend requires the owner to type the exact confirmation phrase interactively. ' +
        'Nothing was sent.',
    )
  }
  if (
    !Number.isInteger(request.maxRecords) ||
    request.maxRecords <= 0 ||
    request.recordCount > request.maxRecords
  ) {
    throw new SpendAuthorizationError(
      `The cohort of ${request.recordCount} records exceeds --max-records ` +
        `${request.maxRecords}. Nothing was sent.`,
    )
  }
  if (
    !Number.isFinite(request.maxEstimatedCostUsd) ||
    request.maxEstimatedCostUsd <= 0 ||
    request.estimate.estimatedCostUsd > request.maxEstimatedCostUsd
  ) {
    throw new SpendAuthorizationError(
      `The estimated cost $${request.estimate.estimatedCostUsd} exceeds ` +
        `--max-estimated-cost-usd ${request.maxEstimatedCostUsd}. Nothing was sent.`,
    )
  }
  const capability: SpendAuthorization = Object.create(null) as object
  Object.defineProperty(capability, SPEND_BRAND, { value: SPEND_BRAND })
  authorizedSpends.set(capability, {
    operationId: request.operationId,
    cohort: request.cohort,
    recordCount: request.recordCount,
    maxRecords: request.maxRecords,
    maxEstimatedCostUsd: request.maxEstimatedCostUsd,
    estimatedCostUsd: request.estimate.estimatedCostUsd,
  })
  return Object.freeze(capability)
}

export function assertSpendAuthorized(capability: SpendAuthorization): SpendAuthorizationRecord {
  const record = authorizedSpends.get(capability)
  const branded = (capability as Record<PropertyKey, unknown>)[SPEND_BRAND]
  if (!record || branded !== SPEND_BRAND) {
    throw new SpendAuthorizationError(
      'A structurally forged or copied spend authorization was refused. Nothing was sent.',
    )
  }
  return record
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
  readonly authorization: SpendAuthorization
  /** Test injection only; the default is the platform fetch. */
  readonly fetchImplementation?: typeof fetch
}

/**
 * The single socket in the lane. Requires a verified spend authorization, reads the API key
 * from the environment at call time, sends exactly one request, and never retries.
 */
export async function executeOpenAiRequest(
  options: OpenAiRequestOptions,
): Promise<OpenAiHttpResult> {
  assertSpendAuthorized(options.authorization)
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
