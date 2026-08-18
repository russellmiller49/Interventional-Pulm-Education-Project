import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_BATCH_COMPLETION_WINDOW,
  LUNA_BATCH_ENDPOINT,
  LUNA_BATCH_MAX_ESTIMATED_TOKENS_PER_SHARD,
  LUNA_BATCH_MAX_RECORDS_PER_SHARD,
} from './constants'
import type { RequestEstimate } from './estimate'
import {
  assertNetworkPlanComplete,
  assertSafeRemoteIdentifier,
  assertSpendEnvelope,
  bindCreatedBatchId,
  bindStatusReceipt,
  bindUploadedFileId,
  executeOpenAiRequest,
  networkPlanSha256,
  type BatchFileRole,
  type NetworkPlanStep,
  type OpenAiHttpResult,
  type OpenAiKeyProvider,
  type SpendAuthorization,
} from './openai'
import { reconcileShardContent, type ShardReconciliation } from './reconcile'
import type { RawResponseRecord } from './results'

/**
 * Batch API lifecycle: deterministic JSONL preparation into content-addressed shards, then
 * separately authorized submission, status, retrieval, and strict ingestion. Preparation is
 * pure and offline; only submit/status/fetch touch the network, always through the single
 * spend-gated socket, and always as ordered single-use plan steps.
 *
 * The dynamic values — the file id an upload returns and the file ids a status returns — are
 * bound into capability state from validated responses, so no caller-supplied id can steer a
 * request. Batch A authority can only ever reach Batch A's own files.
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
 * The ordered two-step plan a shard submission is authorized against: upload the exact
 * reviewed bytes, then create exactly one Batch from the file id that upload returned. The
 * creation step carries no caller-supplied body — only the reviewed template — so an arbitrary
 * creation body has nowhere to enter.
 *
 * The counts on both steps come from `reconcileShardContent`, i.e. from the shard bytes, not
 * from shard-plan metadata that travelled beside them.
 */
export function batchSubmitPlan(options: {
  readonly operationId: string
  readonly shardContent: string
  readonly reconciliation: ShardReconciliation
}): NetworkPlanStep[] {
  const { reconciliation } = options
  if (reconciliation.contentSha256 !== sha256(options.shardContent)) {
    throw new Error('The shard reconciliation does not describe these shard bytes.')
  }
  return [
    {
      sequenceIndex: 0,
      action: 'batch-submit',
      operationId: options.operationId,
      method: 'POST',
      endpointClass: 'files.upload',
      remoteIdSource: 'none',
      planRemoteId: null,
      fileRole: null,
      body: { kind: 'digest', sha256: reconciliation.contentSha256 },
      recordId: null,
      expectedRecords: reconciliation.recordCount,
      expectedInputTokens: reconciliation.estimatedInputTokens,
      expectedOutputTokens: reconciliation.estimatedOutputTokenAllowance,
      allowedExecutions: 1,
      optional: false,
    },
    {
      sequenceIndex: 1,
      action: 'batch-submit',
      operationId: options.operationId,
      method: 'POST',
      endpointClass: 'batches.create',
      remoteIdSource: 'upload-receipt',
      planRemoteId: null,
      fileRole: null,
      body: { kind: 'batch-create-template' },
      recordId: null,
      expectedRecords: 0,
      expectedInputTokens: 0,
      expectedOutputTokens: 0,
      allowedExecutions: 1,
      optional: false,
    },
  ]
}

export function batchSubmitPlanSha256(options: {
  readonly operationId: string
  readonly shardContent: string
  readonly reconciliation: ShardReconciliation
}): string {
  return networkPlanSha256(batchSubmitPlan(options))
}

/** The one receipt-bound status request a batch-status spend may perform. */
export function batchStatusPlan(operationId: string, batchId: string): NetworkPlanStep[] {
  assertSafeRemoteIdentifier(batchId, 'Batch id')
  return [
    {
      sequenceIndex: 0,
      action: 'batch-status',
      operationId,
      method: 'GET',
      endpointClass: 'batches.retrieve',
      remoteIdSource: 'plan',
      planRemoteId: batchId,
      fileRole: null,
      body: { kind: 'none' },
      recordId: null,
      expectedRecords: 0,
      expectedInputTokens: 0,
      expectedOutputTokens: 0,
      allowedExecutions: 1,
      optional: false,
    },
  ]
}

export function batchStatusPlanSha256(operationId: string, batchId: string): string {
  return networkPlanSha256(batchStatusPlan(operationId, batchId))
}

/**
 * One receipt-bound status request, then the two result-file fetches. The file steps take
 * their identifier only from the status receipt bound during this same capability's status
 * call, so there is no way to reach a file belonging to another Batch.
 */
export function batchFetchPlan(operationId: string, batchId: string): NetworkPlanStep[] {
  assertSafeRemoteIdentifier(batchId, 'Batch id')
  const fileStep = (index: number, role: BatchFileRole): NetworkPlanStep => ({
    sequenceIndex: index,
    action: 'batch-fetch',
    operationId,
    method: 'GET',
    endpointClass: 'files.content',
    remoteIdSource: 'status-receipt',
    planRemoteId: null,
    fileRole: role,
    body: { kind: 'none' },
    recordId: null,
    expectedRecords: 0,
    expectedInputTokens: 0,
    expectedOutputTokens: 0,
    allowedExecutions: 1,
    // A Batch need not produce both files; a step that has no file to fetch simply never runs.
    optional: true,
  })
  return [
    {
      sequenceIndex: 0,
      action: 'batch-fetch',
      operationId,
      method: 'GET',
      endpointClass: 'batches.retrieve',
      remoteIdSource: 'plan',
      planRemoteId: batchId,
      fileRole: null,
      body: { kind: 'none' },
      recordId: null,
      expectedRecords: 0,
      expectedInputTokens: 0,
      expectedOutputTokens: 0,
      allowedExecutions: 1,
      optional: false,
    },
    fileStep(1, 'output'),
    fileStep(2, 'error'),
  ]
}

export function batchFetchPlanSha256(operationId: string, batchId: string): string {
  return networkPlanSha256(batchFetchPlan(operationId, batchId))
}

export interface BatchSubmissionReceipt {
  readonly shardFilename: string
  readonly shardSha256: string
  readonly recordCount: number
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

function parseJsonObject(bodyText: string, label: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    throw new Error(`The OpenAI ${label} response is not valid JSON.`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`The OpenAI ${label} response is not a JSON object.`)
  }
  return parsed as Record<string, unknown>
}

/**
 * Upload one shard and create its Batch job: a bounded state machine, not two free requests.
 * Upload the reviewed bytes, consume that step, validate the response and bind its exact file
 * id inside the capability, create exactly one Batch from the reviewed template plus that
 * bound id, consume that step, then validate and bind the returned Batch id.
 */
export async function submitBatchShard(options: {
  readonly shard: BatchShard
  readonly operationId: string
  readonly authorization: SpendAuthorization
  readonly submittedAt: string
  readonly keyProvider?: OpenAiKeyProvider
  readonly fetchImplementation?: typeof fetch
}): Promise<BatchSubmissionReceipt> {
  // Recomputed from the bytes about to be uploaded, never from the shard plan's own claims.
  const reconciliation = reconcileShardContent(options.shard.content)
  if (reconciliation.contentSha256 !== options.shard.contentSha256) {
    throw new Error('The shard bytes no longer hash to the prepared shard digest.')
  }
  if (reconciliation.recordCount !== options.shard.recordCount) {
    throw new Error(
      `The shard carries ${reconciliation.recordCount} records but is planned as ` +
        `${options.shard.recordCount}. Refusing to submit.`,
    )
  }
  assertSpendEnvelope(options.authorization, {
    action: 'batch-submit',
    operationId: options.operationId,
    planSha256: batchSubmitPlanSha256({
      operationId: options.operationId,
      shardContent: options.shard.content,
      reconciliation,
    }),
  })

  const upload = await executeOpenAiRequest({
    intent: {
      kind: 'files.upload',
      action: 'batch-submit',
      operationId: options.operationId,
      shardContent: options.shard.content,
      filename: options.shard.filename,
    },
    authorization: options.authorization,
    keyProvider: options.keyProvider,
    fetchImplementation: options.fetchImplementation,
  })
  const uploaded = parseJsonObject(upload.bodyText, 'file upload')
  // Validated and bound inside the capability; the creation body can name nothing else.
  const inputFileId = bindUploadedFileId(
    options.authorization,
    requireString(uploaded.id, 'the uploaded file id'),
  )

  const created = await executeOpenAiRequest({
    intent: { kind: 'batches.create', action: 'batch-submit', operationId: options.operationId },
    authorization: options.authorization,
    keyProvider: options.keyProvider,
    fetchImplementation: options.fetchImplementation,
  })
  const batch = parseJsonObject(created.bodyText, 'batch creation')
  const batchId = bindCreatedBatchId(options.authorization, requireString(batch.id, 'the batch id'))
  if (typeof batch.input_file_id === 'string' && batch.input_file_id !== inputFileId) {
    throw new Error('The created Batch names a different input file than the one uploaded.')
  }
  assertNetworkPlanComplete(options.authorization)
  return {
    shardFilename: options.shard.filename,
    shardSha256: options.shard.contentSha256,
    recordCount: reconciliation.recordCount,
    inputFileId,
    batchId,
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

/**
 * Read one Batch's status. The requested id comes from the plan (which the CLI derives from a
 * validated local submission receipt), and the response's own `id` must equal it — a status
 * body describing some other Batch is a contradiction, not a result.
 */
export async function fetchBatchStatus(options: {
  readonly batchId: string
  readonly operationId: string
  /** `batch-fetch` reads status first, so both control-plane actions may make this call. */
  readonly action: 'batch-status' | 'batch-fetch'
  readonly authorization: SpendAuthorization
  readonly keyProvider?: OpenAiKeyProvider
  readonly fetchImplementation?: typeof fetch
}): Promise<BatchStatus> {
  assertSpendEnvelope(options.authorization, {
    action: options.action,
    operationId: options.operationId,
    planSha256:
      options.action === 'batch-status'
        ? batchStatusPlanSha256(options.operationId, options.batchId)
        : batchFetchPlanSha256(options.operationId, options.batchId),
  })
  const result = await executeOpenAiRequest({
    intent: {
      kind: 'batches.retrieve',
      action: options.action,
      operationId: options.operationId,
    },
    authorization: options.authorization,
    keyProvider: options.keyProvider,
    fetchImplementation: options.fetchImplementation,
  })
  const body = parseJsonObject(result.bodyText, 'batch status')
  const reportedId = requireString(body.id, 'the batch id')
  if (reportedId !== options.batchId) {
    throw new Error(
      'The batch status response describes a different Batch than the one requested; ' +
        'refusing to use it.',
    )
  }
  // Binding validates the id against the plan and records the exact result-file ids, which are
  // then the only file ids this capability can ever fetch.
  const receipt = bindStatusReceipt(options.authorization, {
    batchId: reportedId,
    outputFileId: typeof body.output_file_id === 'string' ? body.output_file_id : null,
    errorFileId: typeof body.error_file_id === 'string' ? body.error_file_id : null,
  })
  return {
    batchId: receipt.batchId,
    status: requireString(body.status, 'the batch status'),
    outputFileId: receipt.outputFileId,
    errorFileId: receipt.errorFileId,
    requestCounts: body.request_counts ?? null,
    raw: result,
  }
}

/**
 * Fetch one Batch result file. The caller names only which role it wants; the file id itself
 * comes from the status receipt bound above, so Batch A authority cannot reach Batch B files.
 */
export async function fetchBatchFileContent(options: {
  readonly fileRole: BatchFileRole
  readonly batchId: string
  readonly operationId: string
  readonly authorization: SpendAuthorization
  readonly keyProvider?: OpenAiKeyProvider
  readonly fetchImplementation?: typeof fetch
}): Promise<OpenAiHttpResult> {
  assertSpendEnvelope(options.authorization, {
    action: 'batch-fetch',
    operationId: options.operationId,
    planSha256: batchFetchPlanSha256(options.operationId, options.batchId),
  })
  return executeOpenAiRequest({
    intent: {
      kind: 'files.content',
      action: 'batch-fetch',
      operationId: options.operationId,
      fileRole: options.fileRole,
    },
    authorization: options.authorization,
    keyProvider: options.keyProvider,
    fetchImplementation: options.fetchImplementation,
  })
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
