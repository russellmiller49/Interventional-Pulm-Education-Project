/** @jest-environment node */
import { sha256 } from '../literature-production-ingest/canonical'
import { estimateCohortCost } from './estimate'
import { mintSpendAuthorization } from './openai'
import {
  batchSubmitPlanSha256,
  batchSubmitRequestSlots,
  parseBatchOutputJsonl,
  planBatchShards,
  serializeBatchLine,
  shardPlanSummary,
  submitBatchShard,
} from './batch'

const KEY_ENV = 'OPENAI_API_KEY'

function line(index: number) {
  return {
    customId: index.toString(16).padStart(64, '0'),
    body: { model: 'gpt-5.6-luna', input: [] },
  }
}

function estimatesFor(lines: readonly { customId: string }[], tokens = 100) {
  return new Map(
    lines.map((entry) => [entry.customId, { inputTokens: tokens, outputTokenAllowance: 10 }]),
  )
}

describe('batch JSONL lines', () => {
  it('serializes the fixed Batch line shape', () => {
    const parsed = JSON.parse(serializeBatchLine(line(1))) as Record<string, unknown>
    expect(parsed.custom_id).toBe(line(1).customId)
    expect(parsed.method).toBe('POST')
    expect(parsed.url).toBe('/v1/responses')
    expect(parsed.body).toEqual(line(1).body)
  })
})

/**
 * LUNA-BATCH-001. A request whose own estimate exceeds the per-shard token ceiling can never
 * fit any shard; the original reproduction packed a 101-token request into a one-record shard
 * under a 100-token ceiling instead of refusing it.
 */
describe('individually oversized batch requests (LUNA-BATCH-001)', () => {
  const CEILINGS = { maxRecordsPerShard: 10, maxEstimatedTokensPerShard: 100 }

  function planOne(inputTokens: number, outputTokenAllowance: number) {
    const one = line(1)
    return planBatchShards(
      [one],
      new Map([[one.customId, { inputTokens, outputTokenAllowance }]]),
      CEILINGS,
    )
  }

  it('accepts a first request exactly at the ceiling', () => {
    const plan = planOne(90, 10)
    expect(plan.shards).toHaveLength(1)
    expect(plan.shards[0].recordCount).toBe(1)
  })

  it('refuses a first request one token above the ceiling', () => {
    expect(() => planOne(91, 10)).toThrow(/above the per-shard ceiling/u)
  })

  it('refuses an oversized request after a populated shard instead of rolling it over', () => {
    const small = line(1)
    const oversized = line(2)
    expect(() =>
      planBatchShards(
        [small, oversized],
        new Map([
          [small.customId, { inputTokens: 40, outputTokenAllowance: 10 }],
          [oversized.customId, { inputTokens: 200, outputTokenAllowance: 10 }],
        ]),
        CEILINGS,
      ),
    ).toThrow(/above the per-shard ceiling/u)
  })

  it('refuses invalid token estimates', () => {
    for (const estimate of [
      { inputTokens: -1, outputTokenAllowance: 0 },
      { inputTokens: Number.NaN, outputTokenAllowance: 0 },
      { inputTokens: Number.POSITIVE_INFINITY, outputTokenAllowance: 0 },
      { inputTokens: 1.5, outputTokenAllowance: 0 },
      { inputTokens: Number.MAX_SAFE_INTEGER + 2, outputTokenAllowance: 0 },
      { inputTokens: 0, outputTokenAllowance: -3 },
    ]) {
      expect(() => planOne(estimate.inputTokens, estimate.outputTokenAllowance)).toThrow(
        /invalid token estimate|above the per-shard ceiling/u,
      )
    }
  })

  it('emits no empty shard and keeps ordering and hashes stable for valid plans', () => {
    const lines = Array.from({ length: 5 }, (_, index) => line(index))
    const estimates = estimatesFor(lines, 40)
    const plan = planBatchShards(lines, estimates, {
      maxRecordsPerShard: 2,
      maxEstimatedTokensPerShard: 200,
    })
    expect(plan.shards.map((shard) => shard.recordCount)).toEqual([2, 2, 1])
    expect(plan.shards.every((shard) => shard.recordCount > 0)).toBe(true)
    const again = planBatchShards([...lines].reverse(), estimates, {
      maxRecordsPerShard: 2,
      maxEstimatedTokensPerShard: 200,
    })
    expect(again.shards.map((shard) => shard.contentSha256)).toEqual(
      plan.shards.map((shard) => shard.contentSha256),
    )
    expect(shardPlanSummary(again).planSha256).toBe(shardPlanSummary(plan).planSha256)
  })
})

describe('deterministic content-addressed sharding', () => {
  it('produces byte-identical shards for identical inputs', () => {
    const lines = [line(3), line(1), line(2)]
    const first = planBatchShards(lines, estimatesFor(lines))
    const second = planBatchShards([...lines].reverse(), estimatesFor(lines))
    expect(second.shards.map((shard) => shard.contentSha256)).toEqual(
      first.shards.map((shard) => shard.contentSha256),
    )
    expect(first.shards[0].filename).toMatch(/^shard-0000-[0-9a-f]{12}\.jsonl$/u)
    expect(first.totalRecords).toBe(3)
  })

  it('honors the record ceiling per shard', () => {
    const lines = Array.from({ length: 7 }, (_, index) => line(index))
    const plan = planBatchShards(lines, estimatesFor(lines), {
      maxRecordsPerShard: 3,
      maxEstimatedTokensPerShard: 1_000_000,
    })
    expect(plan.shards.map((shard) => shard.recordCount)).toEqual([3, 3, 1])
  })

  it('honors the estimated-token ceiling per shard', () => {
    const lines = Array.from({ length: 4 }, (_, index) => line(index))
    const plan = planBatchShards(lines, estimatesFor(lines, 500), {
      maxRecordsPerShard: 100,
      maxEstimatedTokensPerShard: 1_020,
    })
    expect(plan.shards.length).toBeGreaterThan(1)
    for (const shard of plan.shards) {
      expect(shard.estimatedInputTokens + shard.estimatedOutputTokenAllowance).toBeLessThanOrEqual(
        1_020,
      )
    }
  })

  it('refuses duplicates, missing estimates, and bad ceilings', () => {
    const duplicated = [line(1), line(1)]
    expect(() => planBatchShards(duplicated, estimatesFor(duplicated))).toThrow(
      /Duplicate custom ids/u,
    )
    expect(() => planBatchShards([line(1)], new Map())).toThrow(/no token estimate/u)
    expect(() =>
      planBatchShards([line(1)], estimatesFor([line(1)]), {
        maxRecordsPerShard: 0,
        maxEstimatedTokensPerShard: 10,
      }),
    ).toThrow(/positive integers/u)
  })

  it('summarizes the plan with hashes and counts only', () => {
    const lines = [line(1), line(2)]
    const summary = shardPlanSummary(planBatchShards(lines, estimatesFor(lines)))
    expect(summary.shardCount).toBe(1)
    expect(summary.planSha256).toMatch(/^[0-9a-f]{64}$/u)
  })
})

describe('batch output parsing for strict ingestion', () => {
  it('unwraps 200 bodies and turns errors and non-200s into invalid raw payloads', () => {
    const good = JSON.stringify({
      custom_id: 'a'.repeat(64),
      response: { status_code: 200, body: { status: 'completed', output: [] } },
      error: null,
    })
    const errored = JSON.stringify({
      custom_id: 'b'.repeat(64),
      response: null,
      error: { message: 'failed' },
    })
    const badStatus = JSON.stringify({
      custom_id: 'c'.repeat(64),
      response: { status_code: 429, body: null },
      error: null,
    })
    const junk = 'not json at all'
    const records = parseBatchOutputJsonl([good, errored, badStatus, junk, ''].join('\n'))
    expect(records).toHaveLength(4)
    expect(records[0].customId).toBe('a'.repeat(64))
    expect(JSON.parse(records[0].bodyText)).toEqual({ status: 'completed', output: [] })
    expect(records[1].bodyText).toContain('batch_error')
    expect(records[2].bodyText).toContain('batch_http_status')
    expect(records[3].customId).toBeNull()
  })
})

describe('batch submission through the gated socket', () => {
  const previous = process.env[KEY_ENV]
  afterEach(() => {
    if (previous === undefined) delete process.env[KEY_ENV]
    else process.env[KEY_ENV] = previous
  })

  it('uploads the shard then creates the batch, returning a receipt', async () => {
    process.env[KEY_ENV] = 'sk-test-abcdef1234567890'
    const lines = [line(1), line(2)]
    const plan = planBatchShards(lines, estimatesFor(lines))
    const estimate = estimateCohortCost([{ inputTokens: 10, outputTokenAllowance: 1 }], {
      batch: true,
    })
    const authorization = mintSpendAuthorization({
      confirmFlagPresent: true,
      interactivePhrase: 'SPEND op-b',
      requiredPhrase: 'SPEND op-b',
      envelope: {
        action: 'batch-submit',
        operationId: 'op-b',
        cohort: 'pilot-1000',
        planSha256: batchSubmitPlanSha256(plan.shards[0]),
        recordCount: 1,
        estimatedInputTokens: estimate.inputTokens,
        estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
        estimatedTotalTokens: estimate.totalTokenAllowance,
        estimatedCostUsd: estimate.estimatedCostUsd,
        maxRecords: 10,
        maxEstimatedCostUsd: 10,
        requests: batchSubmitRequestSlots(plan.shards[0].contentSha256),
        maxNetworkRequests: 2,
      },
      estimate,
    })
    const calls: string[] = []
    const receipt = await submitBatchShard({
      shard: plan.shards[0],
      operationId: 'op-b',
      authorization,
      submittedAt: '2026-08-17T00:00:00.000Z',
      fetchImplementation: (async (url: unknown, init?: RequestInit) => {
        calls.push(`${String(init?.method)} ${String(url)}`)
        if (String(url).endsWith('/files')) {
          expect(init?.body).toBeInstanceOf(FormData)
          return new Response(JSON.stringify({ id: 'file-123' }), { status: 200 })
        }
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        expect(body.input_file_id).toBe('file-123')
        expect(body.endpoint).toBe('/v1/responses')
        return new Response(JSON.stringify({ id: 'batch-456', status: 'validating' }), {
          status: 200,
        })
      }) as typeof fetch,
    })
    expect(calls).toHaveLength(2)
    expect(receipt.inputFileId).toBe('file-123')
    expect(receipt.batchId).toBe('batch-456')
    expect(receipt.shardSha256).toBe(plan.shards[0].contentSha256)
  })

  /**
   * LUNA-SPEND-001 at the Batch boundary: the capability binds the exact shard bytes, so shard
   * drift after the owner confirmed the spend refuses before any socket opens.
   */
  it('refuses shard bytes that changed after authorization, opening zero sockets', async () => {
    process.env[KEY_ENV] = 'sk-test-abcdef1234567890'
    const lines = [line(1), line(2)]
    const plan = planBatchShards(lines, estimatesFor(lines))
    const estimate = estimateCohortCost([{ inputTokens: 10, outputTokenAllowance: 1 }], {
      batch: true,
    })
    const authorization = mintSpendAuthorization({
      confirmFlagPresent: true,
      interactivePhrase: 'SPEND op-b',
      requiredPhrase: 'SPEND op-b',
      envelope: {
        action: 'batch-submit',
        operationId: 'op-b',
        cohort: 'pilot-1000',
        planSha256: batchSubmitPlanSha256(plan.shards[0]),
        recordCount: 1,
        estimatedInputTokens: estimate.inputTokens,
        estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
        estimatedTotalTokens: estimate.totalTokenAllowance,
        estimatedCostUsd: estimate.estimatedCostUsd,
        maxRecords: 10,
        maxEstimatedCostUsd: 10,
        requests: batchSubmitRequestSlots(plan.shards[0].contentSha256),
        maxNetworkRequests: 2,
      },
      estimate,
    })
    let calls = 0
    const forbidden = (async () => {
      calls += 1
      throw new Error('fetch must never be reached')
    }) as typeof fetch
    // Bytes changed while the shard metadata still claims the authorized digest: the upload
    // digest is recomputed from the real bytes, so consumption refuses.
    const tamperedBytes = `${plan.shards[0].content}tampered\n`
    await expect(
      submitBatchShard({
        shard: { ...plan.shards[0], content: tamperedBytes },
        operationId: 'op-b',
        authorization,
        submittedAt: '2026-08-17T00:00:00.000Z',
        fetchImplementation: forbidden,
      }),
    ).rejects.toThrow(/not part of what the owner authorized/u)
    // Bytes and metadata both re-derived: the plan digest itself no longer matches.
    await expect(
      submitBatchShard({
        shard: {
          ...plan.shards[0],
          content: tamperedBytes,
          contentSha256: sha256(tamperedBytes),
        },
        operationId: 'op-b',
        authorization,
        submittedAt: '2026-08-17T00:00:00.000Z',
        fetchImplementation: forbidden,
      }),
    ).rejects.toThrow(/plan digest changed/u)
    // Same bytes, wrong operation: refused before the socket too.
    await expect(
      submitBatchShard({
        shard: plan.shards[0],
        operationId: 'op-other',
        authorization,
        submittedAt: '2026-08-17T00:00:00.000Z',
        fetchImplementation: forbidden,
      }),
    ).rejects.toThrow(/different operation/u)
    expect(calls).toBe(0)
  })
})
