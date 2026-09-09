import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { LunaReasoningEffort } from './constants'
import { estimateRequestTokens, type RequestEstimate } from './estimate'
import { buildStageARequestBody, requestBodySha256, requestBodyText } from './request'

/**
 * Deterministic request-set preparation.
 *
 * Packets in, prepared bytes and a manifest digest out — nothing else. The executor that once
 * lived here (the sequential spend-gated sender) is not part of this PR: this lane prepares
 * requests and stops. Sending them is a separate, separately reviewed adapter.
 */

export interface PreparedRequest {
  readonly customId: string
  readonly body: Record<string, unknown>
  /** The exact bytes a send would carry. The digest below is taken over precisely these. */
  readonly bodyText: string
  readonly bodySha256: string
  readonly estimate: RequestEstimate
}

export interface RequestManifest {
  readonly model: string
  readonly reasoningEffort: LunaReasoningEffort
  readonly promptSha256: string
  readonly requestCount: number
  readonly totalEstimatedInputTokens: number
  readonly totalEstimatedOutputTokenAllowance: number
  readonly requestSetSha256: string
  /**
   * The ordered custom-id sequence, digested separately from the bodies. A reader validating a
   * stored set has to prove both *which* requests it holds and *in what order*; a body-digest
   * set alone cannot distinguish a renamed row from a reordered one.
   */
  readonly customIdSequenceSha256: string
}

export interface PreparedRequestSet {
  readonly requests: readonly PreparedRequest[]
  readonly manifest: RequestManifest
}

export interface RequestParameters {
  readonly model: string
  readonly reasoningEffort: LunaReasoningEffort
  readonly instructions: string
  readonly promptSha256: string
}

/** Deterministic: packets sorted by record id; same inputs → identical manifest hash. */
export function prepareRequestSet(
  packets: readonly UniversalPacket[],
  parameters: RequestParameters,
): PreparedRequestSet {
  const ordered = [...packets].sort((left, right) =>
    left.record_id < right.record_id ? -1 : left.record_id > right.record_id ? 1 : 0,
  )
  const seen = new Set<string>()
  const requests = ordered.map((packet) => {
    if (seen.has(packet.record_id)) {
      throw new Error('Duplicate record ids among packets; refusing to prepare requests.')
    }
    seen.add(packet.record_id)
    const body = buildStageARequestBody(packet, {
      model: parameters.model,
      reasoning: parameters.reasoningEffort,
      instructions: parameters.instructions,
    })
    return {
      customId: packet.record_id,
      body,
      bodyText: requestBodyText(body),
      bodySha256: requestBodySha256(body),
      estimate: estimateRequestTokens(
        parameters.instructions,
        canonicalJson(packet),
        parameters.reasoningEffort,
      ),
    }
  })
  const manifest: RequestManifest = {
    model: parameters.model,
    reasoningEffort: parameters.reasoningEffort,
    promptSha256: parameters.promptSha256,
    requestCount: requests.length,
    totalEstimatedInputTokens: requests.reduce(
      (sum, request) => sum + request.estimate.inputTokens,
      0,
    ),
    totalEstimatedOutputTokenAllowance: requests.reduce(
      (sum, request) => sum + request.estimate.outputTokenAllowance,
      0,
    ),
    requestSetSha256: sha256(canonicalJson(requests.map((request) => request.bodySha256))),
    customIdSequenceSha256: sha256(canonicalJson(requests.map((request) => request.customId))),
  }
  return { requests, manifest }
}
