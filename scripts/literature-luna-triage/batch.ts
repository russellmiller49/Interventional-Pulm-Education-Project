import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_BATCH_ENDPOINT,
  LUNA_BATCH_MAX_ESTIMATED_TOKENS_PER_SHARD,
  LUNA_BATCH_MAX_RECORDS_PER_SHARD,
} from './constants'
import type { RequestEstimate } from './estimate'
import type { RawResponseRecord } from './results'

/**
 * Offline Batch preparation and result-file parsing.
 *
 * Preparation is pure: request lines are ordered by custom id, packed greedily under both
 * ceilings, and emitted as content-addressed shards whose filenames carry their own digest.
 * The same inputs and ceilings produce byte-identical shards with identical hashes on any
 * machine, so a shard plan can be reviewed before anything is ever sent.
 *
 * Parsing is equally offline: a Batch output or error JSONL file that arrives on disk by some
 * other route is turned into accounted raw records for strict ingestion.
 *
 * What is deliberately absent is the middle: uploading a shard, creating a Batch, polling its
 * status, and retrieving its result files. That transport is a separately reviewed adapter and
 * is not part of this PR, so nothing here can reach a remote service.
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

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/**
 * Ceilings and counters must be positive **safe** integers. `Number.isInteger` is true for
 * values beyond 2^53 where addition silently stops being exact, so a ceiling like that is not
 * a bound at all — it is arithmetic that cannot be trusted to compare.
 */
export function assertPositiveSafeIntegerCeiling(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`)
  }
  if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number.`)
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer.`)
  if (value <= 0) throw new Error(`${label} must be greater than zero.`)
  return value
}

/**
 * Deterministic sharding: requests ordered by custom id, packed greedily under both ceilings.
 * Same inputs, same ceilings → byte-identical shards with identical hashes. An individual
 * request that cannot fit a shard is refused outright rather than packed into one.
 */
export function planBatchShards(
  lines: readonly BatchRequestLine[],
  estimates: ReadonlyMap<string, RequestEstimate>,
  ceilings: ShardCeilings = DEFAULT_SHARD_CEILINGS,
): BatchShardPlan {
  const maxRecordsPerShard = assertPositiveSafeIntegerCeiling(
    ceilings?.maxRecordsPerShard,
    'The per-shard record ceiling',
  )
  const maxEstimatedTokensPerShard = assertPositiveSafeIntegerCeiling(
    ceilings?.maxEstimatedTokensPerShard,
    'The per-shard token ceiling',
  )
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
    if (
      !isNonNegativeSafeInteger(estimate.inputTokens) ||
      !isNonNegativeSafeInteger(estimate.outputTokenAllowance)
    ) {
      throw new Error(
        'A batch request has an invalid token estimate (non-finite, negative, fractional, or ' +
          'unsafe); refusing to shard.',
      )
    }
    const lineTokens = estimate.inputTokens + estimate.outputTokenAllowance
    // Checked before any rollover decision: an individually oversized request can never fit a
    // shard, so moving it into a fresh one would only mint an oversized shard. Equality fits.
    if (lineTokens > maxEstimatedTokensPerShard) {
      throw new Error(
        `A single batch request estimates ${lineTokens} tokens, above the per-shard ceiling ` +
          `${maxEstimatedTokensPerShard}. Refusing to shard.`,
      )
    }
    const wouldExceed =
      current.records + 1 > maxRecordsPerShard ||
      current.inputTokens + current.outputTokens + lineTokens > maxEstimatedTokensPerShard
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

/**
 * Convert Batch output/error JSONL into raw response records for strict ingestion.
 *
 * Every non-empty line produces exactly one controlled outcome, and one unusable line never
 * stops the rest of the file from being accounted: `null`, an array, a scalar, an object with
 * missing keys, and malformed JSON each become an invalid record carrying its stable source
 * ordinal and an error classification, which ingestion then quarantines. Error lines and
 * non-200 statuses are likewise preserved, never silently dropped and never repaired.
 */
export function parseBatchOutputJsonl(jsonl: string): RawResponseRecord[] {
  const records: RawResponseRecord[] = []
  const lines = jsonl.split('\n')
  let ordinal = -1
  for (const line of lines) {
    if (line.trim().length === 0) continue
    ordinal += 1
    const invalid = (parseError: string): void => {
      records.push({ customId: null, bodyText: line, sourceOrdinal: ordinal, parseError })
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      invalid('batch_line_not_json')
      continue
    }
    if (parsed === null) {
      invalid('batch_line_null')
      continue
    }
    if (Array.isArray(parsed)) {
      invalid('batch_line_array')
      continue
    }
    if (typeof parsed !== 'object') {
      invalid('batch_line_scalar')
      continue
    }
    const entry = parsed as Record<string, unknown>
    const customId = typeof entry.custom_id === 'string' ? entry.custom_id : null
    if (customId === null) {
      invalid('batch_line_missing_custom_id')
      continue
    }
    if (entry.error) {
      records.push({
        customId,
        bodyText: JSON.stringify({ batch_error: entry.error }),
        sourceOrdinal: ordinal,
        parseError: null,
      })
      continue
    }
    const response = entry.response
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      records.push({
        customId,
        bodyText: line,
        sourceOrdinal: ordinal,
        parseError: 'batch_line_missing_response',
      })
      continue
    }
    const statusCode = (response as Record<string, unknown>).status_code
    if (statusCode !== 200) {
      records.push({
        customId,
        bodyText: JSON.stringify({ batch_http_status: statusCode ?? null }),
        sourceOrdinal: ordinal,
        parseError: null,
      })
      continue
    }
    records.push({
      customId,
      bodyText: JSON.stringify((response as Record<string, unknown>).body ?? null),
      sourceOrdinal: ordinal,
      parseError: null,
    })
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
