import {
  STAGE_A_CONFIDENCE_BANDS,
  STAGE_A_REASON_CODES,
  STAGE_A_TRIAGE_DECISIONS,
} from '../../src/features/literature/classifier/stage-a-contract'
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_MAX_OUTPUT_TOKENS,
  LUNA_OUTPUT_SCHEMA_NAME,
  type LunaReasoningEffort,
} from './constants'

/**
 * Offline Responses-request construction.
 *
 * This module is pure: it turns a packet and a set of parameters into the exact bytes a
 * request *would* carry, and takes their digest. It holds no credential, no endpoint host, no
 * transport, and no capability — nothing here can open a socket, and nothing imported by it
 * can either.
 *
 * The remote adapter that would send these bytes is deliberately not part of this PR. It is a
 * separately reviewed, separately spend-authorized surface; until it exists, the deterministic
 * body and its digest are the whole of what the lane produces.
 */

/** The strict structured-output JSON schema a Stage-A request would carry. */
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
 * search, no file search, nothing stored server-side. Same packet and parameters in, same
 * bytes out, on every machine.
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

/** The exact bytes a prepared request would send. Digest and prepared bytes are one string. */
export function requestBodyText(body: Record<string, unknown>): string {
  return canonicalJson(body)
}

export function requestBodySha256(body: Record<string, unknown>): string {
  return sha256(requestBodyText(body))
}

const SHARD_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u

/**
 * Shard filenames are local names written into the operation tree, so they stay plain: no
 * separators, no traversal, no leading dot.
 */
export function assertSafeShardFilename(value: unknown): string {
  if (typeof value !== 'string' || !SHARD_FILENAME_PATTERN.test(value) || value.includes('..')) {
    throw new Error('The shard filename is not a plain local filename.')
  }
  return value
}
