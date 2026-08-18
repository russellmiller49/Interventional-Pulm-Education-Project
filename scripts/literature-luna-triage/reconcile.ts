import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_BATCH_ENDPOINT,
  LUNA_MAX_OUTPUT_TOKENS,
  LUNA_OUTPUT_SCHEMA_NAME,
  LUNA_REASONING_EFFORTS,
  type LunaReasoningEffort,
} from './constants'
import { estimateCohortCost, estimateRequestTokens } from './estimate'

/**
 * Byte-level reconciliation of what will actually be sent.
 *
 * Every count that gates a spend — records, input tokens, output tokens, total tokens, cost,
 * content hashes — is recomputed here from the immutable request or shard bytes themselves,
 * never read from plan metadata that travelled alongside them. The recomputation reproduces
 * `estimateRequestTokens` exactly because it recovers the same three inputs (instructions,
 * packet JSON, reasoning effort) out of the serialized body, so an authorization minted from
 * a plan and a reconciliation performed on the wire bytes are directly comparable.
 *
 * A shard that says one record but carries two, a plan that undercounts tokens, and a body
 * edited after the owner confirmed the spend all fail an exact-equality check here — before
 * the capability exists, and again before the socket opens.
 */

export class ReconciliationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReconciliationError'
  }
}

function refuse(message: string): never {
  throw new ReconciliationError(`${message} Nothing was sent.`)
}

export interface RequestReconciliation {
  /** The opaque record id the request answers, recovered from the packet inside the body. */
  readonly recordId: string
  readonly model: string
  readonly reasoningEffort: LunaReasoningEffort
  readonly inputTokens: number
  readonly outputTokenAllowance: number
  readonly totalTokens: number
  readonly bodySha256: string
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) refuse(`A request body has no ${label}.`)
  return value
}

/**
 * Recompute one Responses request's identity and token contribution from its exact bytes.
 *
 * The body shape is checked structurally first: an unrecognized or reshaped request is refused
 * rather than partially reconciled, because a body this function cannot fully account for is a
 * body whose cost nobody can bound.
 */
export function reconcileRequestBodyText(bodyText: string): RequestReconciliation {
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    refuse('A prepared request body is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    refuse('A prepared request body is not a JSON object.')
  }
  const body = parsed as Record<string, unknown>
  const model = requireString(body.model, 'model')
  const instructions = requireString(body.instructions, 'instructions')
  if (body.store !== false) refuse('A prepared request body does not disable server storage.')
  if (!Array.isArray(body.tools) || body.tools.length !== 0) {
    refuse('A prepared request body does not declare an empty tool list.')
  }
  if (body.max_output_tokens !== LUNA_MAX_OUTPUT_TOKENS) {
    refuse('A prepared request body names an unexpected output-token ceiling.')
  }
  const format = (body.text as { format?: Record<string, unknown> } | undefined)?.format
  if (
    !format ||
    format.type !== 'json_schema' ||
    format.name !== LUNA_OUTPUT_SCHEMA_NAME ||
    format.strict !== true
  ) {
    refuse('A prepared request body does not use the strict Stage-A structured output.')
  }
  const effort = (body.reasoning as { effort?: unknown } | undefined)?.effort
  if (
    typeof effort !== 'string' ||
    !(LUNA_REASONING_EFFORTS as readonly string[]).includes(effort)
  ) {
    refuse('A prepared request body names an unknown reasoning effort.')
  }
  const reasoningEffort = effort as LunaReasoningEffort
  const input = body.input
  if (!Array.isArray(input) || input.length !== 1) {
    refuse('A prepared request body must carry exactly one input message.')
  }
  const message = input[0] as Record<string, unknown>
  if (!message || typeof message !== 'object' || message.role !== 'user') {
    refuse('A prepared request body must carry exactly one user message.')
  }
  const content = message.content
  if (!Array.isArray(content) || content.length !== 1) {
    refuse('A prepared request body must carry exactly one content part.')
  }
  const part = content[0] as Record<string, unknown>
  if (!part || typeof part !== 'object' || part.type !== 'input_text') {
    refuse('A prepared request body must carry exactly one input_text part.')
  }
  const packetJson = requireString(part.text, 'packet payload')
  let packet: unknown
  try {
    packet = JSON.parse(packetJson)
  } catch {
    refuse('A prepared request body carries a packet payload that is not JSON.')
  }
  const recordId = requireString(
    (packet as Record<string, unknown> | null)?.record_id,
    'packet record id',
  )
  const estimate = estimateRequestTokens(instructions, packetJson, reasoningEffort)
  return {
    recordId,
    model,
    reasoningEffort,
    inputTokens: estimate.inputTokens,
    outputTokenAllowance: estimate.outputTokenAllowance,
    totalTokens: estimate.inputTokens + estimate.outputTokenAllowance,
    bodySha256: sha256(bodyText),
  }
}

export interface ShardReconciliation {
  readonly recordCount: number
  readonly uniqueCustomIdCount: number
  readonly customIds: readonly string[]
  readonly estimatedInputTokens: number
  readonly estimatedOutputTokenAllowance: number
  readonly estimatedTotalTokens: number
  readonly estimatedCostUsd: number
  readonly contentSha256: string
}

/**
 * Recompute a Batch shard's whole spend footprint from its exact JSONL bytes: how many
 * requests it really holds, whether every custom id is distinct, what it really costs, and
 * what it hashes to. Nothing here consults the shard plan.
 */
export function reconcileShardContent(content: string): ShardReconciliation {
  const lines = content.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length === 0) refuse('A batch shard carries no requests.')
  const customIds: string[] = []
  const seen = new Set<string>()
  const perRequest: { inputTokens: number; outputTokenAllowance: number }[] = []
  lines.forEach((line, index) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      refuse(`Batch shard line ${index} is not valid JSON.`)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      refuse(`Batch shard line ${index} is not a JSON object.`)
    }
    const entry = parsed as Record<string, unknown>
    if (entry.method !== 'POST') refuse(`Batch shard line ${index} names an unsupported method.`)
    if (entry.url !== LUNA_BATCH_ENDPOINT) {
      refuse(`Batch shard line ${index} names an endpoint outside this lane.`)
    }
    const customId = requireString(entry.custom_id, 'custom id')
    if (seen.has(customId)) refuse(`Batch shard line ${index} repeats a custom id.`)
    seen.add(customId)
    if (!entry.body || typeof entry.body !== 'object') {
      refuse(`Batch shard line ${index} has no request body.`)
    }
    const reconciliation = reconcileRequestBodyText(JSON.stringify(entry.body))
    if (reconciliation.recordId !== customId) {
      refuse(`Batch shard line ${index} names a custom id its packet does not match.`)
    }
    customIds.push(customId)
    perRequest.push({
      inputTokens: reconciliation.inputTokens,
      outputTokenAllowance: reconciliation.outputTokenAllowance,
    })
  })
  const cohort = estimateCohortCost(perRequest, { batch: true })
  return {
    recordCount: lines.length,
    uniqueCustomIdCount: seen.size,
    customIds,
    estimatedInputTokens: cohort.inputTokens,
    estimatedOutputTokenAllowance: cohort.outputTokenAllowance,
    estimatedTotalTokens: cohort.totalTokenAllowance,
    estimatedCostUsd: cohort.estimatedCostUsd,
    contentSha256: sha256(content),
  }
}

/** The canonical digest of an ordered reconciliation set; binds bytes to a plan. */
export function reconciliationDigest(values: readonly RequestReconciliation[]): string {
  return sha256(canonicalJson(values.map((value) => value.bodySha256)))
}
