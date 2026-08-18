import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import { LUNA_ASSUMED_PRICING, type LunaReasoningEffort } from './constants'
import { estimateRequestTokens, type RequestEstimate } from './estimate'
import {
  assertNetworkPlanComplete,
  assertSpendEnvelope,
  buildStageARequestBody,
  executeOpenAiRequest,
  networkPlanSha256,
  redactOpenAiSecrets,
  requestBodySha256,
  requestBodyText,
  type NetworkPlanStep,
  type OpenAiKeyProvider,
  type SpendAuthorization,
} from './openai'

/**
 * Synchronous run lifecycle: deterministic request preparation and the sequential smoke/dev/
 * locked executor. One request per record, no retry, no repair — a failed request stops the
 * run, whatever already landed stays on disk, and ingestion later accounts every record that
 * did not answer as missing rather than pretending it did.
 */

export interface PreparedRequest {
  readonly customId: string
  readonly body: Record<string, unknown>
  /** The exact bytes that will be sent. The digest below is taken over precisely these. */
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
}

export interface PreparedRequestSet {
  readonly requests: readonly PreparedRequest[]
  readonly manifest: RequestManifest
}

/**
 * The ordered network plan a synchronous run is authorized against: one numbered, single-use
 * `/responses` step per prepared request, in prepared order, each bound to its exact body
 * digest, its record id, and its own token contribution. Any packet, prompt, model, body, or
 * ordering drift changes the plan digest, and the capability minted for the old plan then
 * refuses before the first socket.
 */
export function syncRunPlan(
  requests: readonly PreparedRequest[],
  operationId: string,
): NetworkPlanStep[] {
  return requests.map((request, index) => ({
    sequenceIndex: index,
    action: 'run-sync' as const,
    operationId,
    method: 'POST' as const,
    endpointClass: 'responses.create' as const,
    remoteIdSource: 'none' as const,
    planRemoteId: null,
    fileRole: null,
    body: { kind: 'digest' as const, sha256: request.bodySha256 },
    recordId: request.customId,
    expectedRecords: 1,
    expectedInputTokens: request.estimate.inputTokens,
    expectedOutputTokens: request.estimate.outputTokenAllowance,
    allowedExecutions: 1 as const,
    optional: false,
  }))
}

export function syncRunPlanSha256(
  requests: readonly PreparedRequest[],
  operationId: string,
): string {
  return networkPlanSha256(syncRunPlan(requests, operationId))
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
  }
  return { requests, manifest }
}

export interface LedgerRow {
  readonly customId: string
  readonly requestSha256: string
  readonly responseSha256: string | null
  readonly httpStatus: number | null
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly totalTokens: number | null
  readonly estimatedCostUsd: number | null
  readonly error: string | null
  readonly at: string
}

function usageFromResponse(bodyText: string): {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
} {
  try {
    const parsed = JSON.parse(bodyText) as { usage?: Record<string, unknown> }
    const usage = parsed.usage ?? {}
    const num = (value: unknown) => (typeof value === 'number' ? value : null)
    return {
      inputTokens: num(usage.input_tokens),
      outputTokens: num(usage.output_tokens),
      totalTokens: num(usage.total_tokens),
    }
  } catch {
    return { inputTokens: null, outputTokens: null, totalTokens: null }
  }
}

export function ledgerCostUsd(
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (inputTokens === null || outputTokens === null) return null
  return Number(
    (
      (inputTokens / 1_000_000) * LUNA_ASSUMED_PRICING.inputUsdPerMillionTokens +
      (outputTokens / 1_000_000) * LUNA_ASSUMED_PRICING.outputUsdPerMillionTokens
    ).toFixed(6),
  )
}

export interface SyncRunSinks {
  /** Persist one raw response body, create-once, keyed by custom id. */
  readonly writeRawResponse: (customId: string, bodyText: string) => Promise<void>
  /** Append one ledger row. Rows never contain packet content or credentials. */
  readonly appendLedger: (row: LedgerRow) => Promise<void>
  readonly now: () => string
}

export interface SyncRunSummary {
  readonly attempted: number
  readonly succeeded: number
  readonly failed: number
}

/**
 * Execute requests sequentially through the single spend-gated socket. The first failure
 * stops the run — no retry — after writing a redacted ledger row for the failure.
 */
export async function executeSyncRun(options: {
  readonly requests: readonly PreparedRequest[]
  readonly operationId: string
  readonly authorization: SpendAuthorization
  readonly sinks: SyncRunSinks
  readonly keyProvider?: OpenAiKeyProvider
  readonly fetchImplementation?: typeof fetch
}): Promise<SyncRunSummary> {
  const envelope = assertSpendEnvelope(options.authorization, {
    action: 'run-sync',
    operationId: options.operationId,
    planSha256: syncRunPlanSha256(options.requests, options.operationId),
  })
  if (envelope.recordCount !== options.requests.length) {
    throw new Error(
      `The authorization covers ${envelope.recordCount} records but ${options.requests.length} ` +
        'requests were prepared. Nothing was sent.',
    )
  }
  let attempted = 0
  let succeeded = 0
  for (const request of options.requests) {
    attempted += 1
    try {
      const result = await executeOpenAiRequest({
        intent: {
          kind: 'responses.create',
          action: 'run-sync',
          operationId: options.operationId,
          recordId: request.customId,
          bodyText: request.bodyText,
        },
        authorization: options.authorization,
        keyProvider: options.keyProvider,
        fetchImplementation: options.fetchImplementation,
      })
      await options.sinks.writeRawResponse(request.customId, result.bodyText)
      const usage = usageFromResponse(result.bodyText)
      await options.sinks.appendLedger({
        customId: request.customId,
        requestSha256: request.bodySha256,
        responseSha256: result.bodySha256,
        httpStatus: result.status,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: ledgerCostUsd(usage.inputTokens, usage.outputTokens),
        error: null,
        at: options.sinks.now(),
      })
      succeeded += 1
    } catch (error) {
      await options.sinks.appendLedger({
        customId: request.customId,
        requestSha256: request.bodySha256,
        responseSha256: null,
        httpStatus: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        error: redactOpenAiSecrets(error),
        at: options.sinks.now(),
      })
      throw new Error(
        `The synchronous run stopped after ${attempted} of ${options.requests.length} ` +
          `requests (no automatic retry): ${redactOpenAiSecrets(error)}`,
      )
    }
  }
  // Every authorized step must have run: a plan with a request left unsent is an incomplete
  // run, not a quietly shorter one.
  assertNetworkPlanComplete(options.authorization)
  return { attempted, succeeded, failed: attempted - succeeded }
}
