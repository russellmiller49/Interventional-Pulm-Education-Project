import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_BATCH_COMPLETION_WINDOW,
  LUNA_BATCH_ENDPOINT,
  LUNA_BATCH_MAX_ESTIMATED_TOKENS_PER_SHARD,
  LUNA_BATCH_MAX_RECORDS_PER_SHARD,
} from './constants'
import type { RequestEstimate } from './estimate'
import { executeOpenAiRequest, type OpenAiHttpResult, type SpendAuthorization } from './openai'
import type { RawResponseRecord } from './results'

/**
 * Batch API lifecycle: deterministic JSONL preparation into content-addressed shards, then
 * separately authorized submission, status, retrieval, and strict ingestion. Preparation is
 * pure and offline; only submit/status/fetch touch the network, always through the single
 * spend-gated socket. The full corpus is never assumed to fit one Batch job — sharding is the
 * default, with record and estimated-token ceilings per shard.
 */

export interface BatchRequestLine {
  readonly customId: string
  readonly body: Record<string, unknown>
}

export function serializeBatchLine(line: BatchRequestLine): string {
  // Key order is fixed for byte-stable shards.
  return JSON.stringify({
    custom_id: line.customId,
    method: 'POST',
    url: LUNA_BATCH_ENDPOINT,
    body: line.body,
  })
}

export interface BatchShard {
  readonly index: number
  readonly filename: string
  readonly contentSha256: string
  readonly recordCount: number
  readonly estimatedInputTokens: number
  readonly estimatedOutputTokenAllowance: number
  readonly content: string
}

export interface BatchShardPlan {
  readonly shards: readonly BatchShard[]
  readonly totalRecords: number
  readonly totalEstimatedInputTokens: number
  readonly totalEstimatedOutputTokenAllowance: number
}

export interface ShardCeilings {
  readonly maxRecordsPerShard: number
  readonly maxEstimatedTokensPerShard: number
}

export const DEFAULT_SHARD_CEILINGS: ShardCeilings = {
  maxRecordsPerShard: LUNA_BATCH_MAX_RECORDS_PER_SHARD,
  maxEstimatedTokensPerShard: LUNA_BATCH_MAX_ESTIMATED_TOKENS_PER_SHARD,
}

/**
 * Deterministic sharding: requests ordered by custom id, packed greedily under both ceilings.
 * Same inputs, same ceilings → byte-identical shards with identical hashes.
 */
export function planBatchShards(
  lines: readonly BatchRequestLine[],
  estimates: ReadonlyMap<string, RequestEstimate>,
  ceilings: ShardCeilings = DEFAULT_SHARD_CEILINGS,
): BatchShardPlan {
  if (
    !Number.isInteger(ceilings.maxRecordsPerShard) ||
    ceilings.maxRecordsPerShard <= 0 ||
    !Number.isInteger(ceilings.maxEstimatedTokensPerShard) ||
    ceilings.maxEstimatedTokensPerShard <= 0
  ) {
    throw new Error('Shard ceilings must be positive integers.')
  }
  const ordered = [...lines].sort((left, right) =>
    left.customId < right.customId ? -1 : left.customId > right.customId ? 1 : 0,
  )
  const seen = new Set<string>()
  for (const line of ordered) {
    if (seen.has(line.customId)) {
      throw new Error('Duplicate custom ids in the batch request set; refusing to shard.')
    }
    seen.add(line.customId)
  }
  interface OpenShard {
    lines: string[]
    records: number
    inputTokens: number
    outputTokens: number
  }
  const closed: OpenShard[] = []
  let current: OpenShard = { lines: [], records: 0, inputTokens: 0, outputTokens: 0 }
  for (const line of ordered) {
    const estimate = estimates.get(line.customId)
    if (!estimate) throw new Error('A batch request has no token estimate; refusing to shard.')
    const lineTokens = estimate.inputTokens + estimate.outputTokenAllowance
    const wouldExceed =
      current.records + 1 > ceilings.maxRecordsPerShard ||
      current.inputTokens + current.outputTokens + lineTokens > ceilings.maxEstimatedTokensPerShard
    if (current.records > 0 && wouldExceed) {
      closed.push(current)
      current = { lines: [], records: 0, inputTokens: 0, outputTokens: 0 }
    }
    current.lines.push(serializeBatchLine(line))
    current.records += 1
    current.inputTokens += estimate.inputTokens
    current.outputTokens += estimate.outputTokenAllowance
  }
  if (current.records > 0) closed.push(current)

  const shards = closed.map((shard, index) => {
    const content = shard.lines.join('\n') + '\n'
    const contentSha256 = sha256(content)
    return {
      index,
      filename: `shard-${String(index).padStart(4, '0')}-${contentSha256.slice(0, 12)}.jsonl`,
      contentSha256,
      recordCount: shard.records,
      estimatedInputTokens: shard.inputTokens,
      estimatedOutputTokenAllowance: shard.outputTokens,
      content,
    }
  })
  return {
    shards,
    totalRecords: shards.reduce((sum, shard) => sum + shard.recordCount, 0),
    totalEstimatedInputTokens: shards.reduce((sum, shard) => sum + shard.estimatedInputTokens, 0),
    totalEstimatedOutputTokenAllowance: shards.reduce(
      (sum, shard) => sum + shard.estimatedOutputTokenAllowance,
      0,
    ),
  }
}

export interface BatchSubmissionReceipt {
  readonly shardFilename: string
  readonly shardSha256: string
  readonly inputFileId: string
  readonly batchId: string
  readonly submittedAt: string
  readonly endpoint: string
  readonly completionWindow: string
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`The OpenAI response is missing ${label}.`)
  }
  return value
}

/** Upload one shard and create its Batch job. Two spend-gated requests, no retry. */
export async function submitBatchShard(options: {
  readonly shard: BatchShard
  readonly authorization: SpendAuthorization
  readonly submittedAt: string
  readonly fetchImplementation?: typeof fetch
}): Promise<BatchSubmissionReceipt> {
  const formData = new FormData()
  formData.append('purpose', 'batch')
  formData.append(
    'file',
    new Blob([options.shard.content], { type: 'application/jsonl' }),
    options.shard.filename,
  )
  const upload = await executeOpenAiRequest({
    method: 'POST',
    path: '/files',
    formData,
    authorization: options.authorization,
    fetchImplementation: options.fetchImplementation,
  })
  const uploaded = JSON.parse(upload.bodyText) as Record<string, unknown>
  const inputFileId = requireString(uploaded.id, 'the uploaded file id')
  const created = await executeOpenAiRequest({
    method: 'POST',
    path: '/batches',
    jsonBody: {
      input_file_id: inputFileId,
      endpoint: LUNA_BATCH_ENDPOINT,
      completion_window: LUNA_BATCH_COMPLETION_WINDOW,
    },
    authorization: options.authorization,
    fetchImplementation: options.fetchImplementation,
  })
  const batch = JSON.parse(created.bodyText) as Record<string, unknown>
  return {
    shardFilename: options.shard.filename,
    shardSha256: options.shard.contentSha256,
    inputFileId,
    batchId: requireString(batch.id, 'the batch id'),
    submittedAt: options.submittedAt,
    endpoint: LUNA_BATCH_ENDPOINT,
    completionWindow: LUNA_BATCH_COMPLETION_WINDOW,
  }
}

export interface BatchStatus {
  readonly batchId: string
  readonly status: string
  readonly outputFileId: string | null
  readonly errorFileId: string | null
  readonly requestCounts: unknown
  readonly raw: OpenAiHttpResult
}

export async function fetchBatchStatus(options: {
  readonly batchId: string
  readonly authorization: SpendAuthorization
  readonly fetchImplementation?: typeof fetch
}): Promise<BatchStatus> {
  const result = await executeOpenAiRequest({
    method: 'GET',
    path: `/batches/${options.batchId}`,
    authorization: options.authorization,
    fetchImplementation: options.fetchImplementation,
  })
  const body = JSON.parse(result.bodyText) as Record<string, unknown>
  return {
    batchId: requireString(body.id, 'the batch id'),
    status: requireString(body.status, 'the batch status'),
    outputFileId: typeof body.output_file_id === 'string' ? body.output_file_id : null,
    errorFileId: typeof body.error_file_id === 'string' ? body.error_file_id : null,
    requestCounts: body.request_counts ?? null,
    raw: result,
  }
}

export async function fetchBatchFileContent(options: {
  readonly fileId: string
  readonly authorization: SpendAuthorization
  readonly fetchImplementation?: typeof fetch
}): Promise<OpenAiHttpResult> {
  return executeOpenAiRequest({
    method: 'GET',
    path: `/files/${options.fileId}/content`,
    authorization: options.authorization,
    fetchImplementation: options.fetchImplementation,
  })
}

/**
 * Convert Batch output/error JSONL into raw response records for strict ingestion. Error
 * lines and non-200 statuses become invalid raw payloads for the named custom id — never
 * silently dropped, never repaired.
 */
export function parseBatchOutputJsonl(jsonl: string): RawResponseRecord[] {
  const records: RawResponseRecord[] = []
  for (const line of jsonl.split('\n')) {
    if (line.trim().length === 0) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      records.push({ customId: null, bodyText: line })
      continue
    }
    const entry = parsed as Record<string, unknown>
    const customId = typeof entry.custom_id === 'string' ? entry.custom_id : null
    if (entry.error) {
      records.push({ customId, bodyText: JSON.stringify({ batch_error: entry.error }) })
      continue
    }
    const response = entry.response as Record<string, unknown> | undefined
    if (!response || typeof response !== 'object') {
      records.push({ customId, bodyText: line })
      continue
    }
    if (response.status_code !== 200) {
      records.push({
        customId,
        bodyText: JSON.stringify({ batch_http_status: response.status_code }),
      })
      continue
    }
    records.push({ customId, bodyText: JSON.stringify(response.body ?? null) })
  }
  return records
}

/** Aggregate manifest for a prepared shard plan; committable (hashes and counts only). */
export function shardPlanSummary(plan: BatchShardPlan): Record<string, unknown> {
  return {
    shardCount: plan.shards.length,
    totalRecords: plan.totalRecords,
    totalEstimatedInputTokens: plan.totalEstimatedInputTokens,
    totalEstimatedOutputTokenAllowance: plan.totalEstimatedOutputTokenAllowance,
    shards: plan.shards.map((shard) => ({
      index: shard.index,
      filename: shard.filename,
      contentSha256: shard.contentSha256,
      recordCount: shard.recordCount,
      estimatedInputTokens: shard.estimatedInputTokens,
      estimatedOutputTokenAllowance: shard.estimatedOutputTokenAllowance,
    })),
    planSha256: sha256(canonicalJson(plan.shards.map((shard) => shard.contentSha256))),
  }
}
