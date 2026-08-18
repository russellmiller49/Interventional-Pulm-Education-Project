/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { sha256 } from '../literature-production-ingest/canonical'
import { estimateCohortCost, estimateRequestTokens } from './estimate'
import {
  buildStageARequestBody,
  mintSpendAuthorization,
  networkPlanSha256,
  requiredConfirmationPhrase,
  type OpenAiKeyProvider,
} from './openai'
import { loadStageAPrompt } from './prompt'
import { reconcileShardContent } from './reconcile'
import {
  assertPositiveSafeIntegerCeiling,
  batchSubmitPlan,
  parseBatchOutputJsonl,
  planBatchShards,
  serializeBatchLine,
  shardPlanSummary,
  submitBatchShard,
} from './batch'

const PROMPT = loadStageAPrompt().text

function packetFor(index: number): UniversalPacket {
  return {
    record_id: index.toString(16).padStart(64, '0'),
    title: `Synthetic article ${index}`,
    abstract: 'Synthetic abstract text.',
    journal: 'Synthetic Journal of Testing',
    publication_year: 2020,
    publication_types: ['Journal Article'],
    mesh_terms: [],
    keywords: [],
    language: 'eng',
    evidence_profile: 'metadata_with_abstract',
  }
}

function line(index: number) {
  return {
    customId: index.toString(16).padStart(64, '0'),
    body: buildStageARequestBody(packetFor(index), {
      model: 'gpt-5.6-luna',
      reasoning: 'low',
      instructions: PROMPT,
    }),
  }
}

/** A counting key provider: a refusal must leave it at zero. */
function countingKeyProvider(): OpenAiKeyProvider & { reads: () => number } {
  let reads = 0
  return {
    readKey: () => {
      reads += 1
      return 'sk-synthetic-test-key-value-not-real'
    },
    reads: () => reads,
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
    ).toThrow(/greater than zero/u)
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

/**
 * Shard ceilings must be positive **safe** integers. `Number.isInteger` is true past 2^53,
 * where the additions that enforce the ceiling stop being exact — a bound that cannot be
 * compared reliably is not a bound.
 */
describe('shard ceiling validation', () => {
  it.each([
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 2],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a fraction', 1.5],
    ['zero', 0],
    ['a negative', -1],
  ])('rejects %s as a ceiling', (_label, value) => {
    expect(() => assertPositiveSafeIntegerCeiling(value, 'The ceiling')).toThrow()
    expect(() =>
      planBatchShards([line(1)], estimatesFor([line(1)]), {
        maxRecordsPerShard: value,
        maxEstimatedTokensPerShard: 1_000,
      }),
    ).toThrow()
    expect(() =>
      planBatchShards([line(1)], estimatesFor([line(1)]), {
        maxRecordsPerShard: 10,
        maxEstimatedTokensPerShard: value,
      }),
    ).toThrow()
  })

  it('accepts an exact safe-integer ceiling', () => {
    expect(assertPositiveSafeIntegerCeiling(Number.MAX_SAFE_INTEGER, 'The ceiling')).toBe(
      Number.MAX_SAFE_INTEGER,
    )
    const plan = planBatchShards([line(1)], estimatesFor([line(1)]), {
      maxRecordsPerShard: Number.MAX_SAFE_INTEGER,
      maxEstimatedTokensPerShard: Number.MAX_SAFE_INTEGER,
    })
    expect(plan.shards).toHaveLength(1)
  })
})

describe('batch submission through the gated socket', () => {
  function shardOf(count: number) {
    const lines = Array.from({ length: count }, (_unused, index) => line(index + 1))
    const estimates = new Map(
      lines.map((entry, index) => [
        entry.customId,
        estimateRequestTokens(PROMPT, JSON.stringify(packetFor(index + 1)), 'low'),
      ]),
    )
    return planBatchShards(lines, estimates).shards[0]
  }

  function mintFor(
    shardContent: string,
    overrides: { records?: number; tokens?: { input: number; output: number } } = {},
  ) {
    const reconciliation = reconcileShardContent(shardContent)
    const records = overrides.records ?? reconciliation.recordCount
    const steps = batchSubmitPlan({ operationId: 'op-b', shardContent, reconciliation })
    const declared = overrides.tokens ?? {
      input: reconciliation.estimatedInputTokens,
      output: reconciliation.estimatedOutputTokenAllowance,
    }
    const estimate = {
      ...estimateCohortCost([], { batch: true }),
      records,
      inputTokens: declared.input,
      outputTokenAllowance: declared.output,
      totalTokenAllowance: declared.input + declared.output,
      estimatedCostUsd: reconciliation.estimatedCostUsd,
    }
    return mintSpendAuthorization({
      confirmFlagPresent: true,
      interactiveTty: true,
      interactivePhrase: requiredConfirmationPhrase('op-b'),
      envelope: {
        action: 'batch-submit',
        operationId: 'op-b',
        cohort: 'pilot-1000',
        planSha256: networkPlanSha256(steps),
        recordCount: records,
        estimatedInputTokens: declared.input,
        estimatedOutputTokenAllowance: declared.output,
        estimatedTotalTokens: declared.input + declared.output,
        estimatedCostUsd: reconciliation.estimatedCostUsd,
        maxRecords: 100,
        maxEstimatedCostUsd: 100,
        steps,
        maxNetworkRequests: 2,
      },
      estimate,
      plannedBodies: [shardContent],
    })
  }

  it('uploads the shard then creates the batch, returning a receipt', async () => {
    const shard = shardOf(2)
    const authorization = mintFor(shard.content)
    const keyProvider = countingKeyProvider()
    const calls: string[] = []
    const receipt = await submitBatchShard({
      shard,
      operationId: 'op-b',
      authorization,
      submittedAt: '2026-08-17T00:00:00.000Z',
      keyProvider,
      fetchImplementation: (async (url: unknown, init?: RequestInit) => {
        calls.push(`${String(init?.method)} ${String(url)}`)
        if (String(url).endsWith('/files')) {
          expect(init?.body).toBeInstanceOf(FormData)
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ id: 'file-123' }),
          } as unknown as Response
        }
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        expect(body.input_file_id).toBe('file-123')
        expect(body.endpoint).toBe('/v1/responses')
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ id: 'batch-456', status: 'validating', input_file_id: 'file-123' }),
        } as unknown as Response
      }) as typeof fetch,
    })
    expect(calls).toEqual([
      'POST https://api.openai.com/v1/files',
      'POST https://api.openai.com/v1/batches',
    ])
    expect(receipt.inputFileId).toBe('file-123')
    expect(receipt.batchId).toBe('batch-456')
    expect(receipt.recordCount).toBe(2)
    expect(receipt.shardSha256).toBe(shard.contentSha256)
    expect(keyProvider.reads()).toBe(2)
  })

  it('refuses a shard whose metadata undercounts its records, tokens, or cost', () => {
    const shard = shardOf(2)
    // Undercounted records: two real requests minted as one.
    expect(() => mintFor(shard.content, { records: 1 })).toThrow()
    // Undercounted tokens: the plan claims less than the bytes actually cost.
    expect(() => mintFor(shard.content, { tokens: { input: 1, output: 1 } })).toThrow()
  })

  it('refuses a shard that carries a duplicate custom id', () => {
    const shard = shardOf(1)
    const duplicated = `${shard.content}${shard.content}`
    expect(() => reconcileShardContent(duplicated)).toThrow(/repeats a custom id/u)
  })

  it('refuses shard bytes that changed after authorization, opening zero sockets', async () => {
    const shard = shardOf(2)
    const authorization = mintFor(shard.content)
    const keyProvider = countingKeyProvider()
    let calls = 0
    const forbidden = (async () => {
      calls += 1
      throw new Error('fetch must never be reached')
    }) as typeof fetch
    const tamperedBytes = `${shard.content}${line(9).customId}\n`
    await expect(
      submitBatchShard({
        shard: { ...shard, content: tamperedBytes },
        operationId: 'op-b',
        authorization,
        submittedAt: '2026-08-17T00:00:00.000Z',
        keyProvider,
        fetchImplementation: forbidden,
      }),
    ).rejects.toThrow()
    // Same bytes, wrong operation: refused before the socket too.
    await expect(
      submitBatchShard({
        shard,
        operationId: 'op-other',
        authorization,
        submittedAt: '2026-08-17T00:00:00.000Z',
        keyProvider,
        fetchImplementation: forbidden,
      }),
    ).rejects.toThrow(/different operation/u)
    expect(calls).toBe(0)
    expect(keyProvider.reads()).toBe(0)
  })
})

/**
 * Every non-empty line must reach a controlled terminal outcome. One unusable line never stops
 * the rest of the file from being accounted, and no line is ever silently dropped.
 */
describe('controlled Batch output parsing', () => {
  const validLine = JSON.stringify({
    custom_id: 'a'.repeat(64),
    response: { status_code: 200, body: { status: 'completed', output: [] } },
    error: null,
  })

  it.each([
    ['a null line', 'null', 'batch_line_null'],
    ['an array line', '[]', 'batch_line_array'],
    ['a string line', '"a string"', 'batch_line_scalar'],
    ['a number line', '42', 'batch_line_scalar'],
    ['a malformed line', '{not json', 'batch_line_not_json'],
    ['an object with missing keys', '{"unexpected":1}', 'batch_line_missing_custom_id'],
  ])('quarantines %s with a stable ordinal instead of throwing', (_label, raw, expected) => {
    const records = parseBatchOutputJsonl(`${raw}\n`)
    expect(records).toHaveLength(1)
    expect(records[0].parseError).toBe(expected)
    expect(records[0].sourceOrdinal).toBe(0)
    expect(records[0].customId).toBeNull()
    expect(records[0].bodyText).toBe(raw)
  })

  it('still processes a valid line that follows an invalid one', () => {
    const records = parseBatchOutputJsonl(['null', '{not json', validLine].join('\n'))
    expect(records).toHaveLength(3)
    expect(records.map((record) => record.sourceOrdinal)).toEqual([0, 1, 2])
    expect(records[2].customId).toBe('a'.repeat(64))
    expect(records[2].parseError).toBeNull()
    expect(JSON.parse(records[2].bodyText)).toEqual({ status: 'completed', output: [] })
  })

  it('unwraps 200 bodies and turns errors and non-200s into accounted payloads', () => {
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
    const records = parseBatchOutputJsonl([validLine, errored, badStatus, ''].join('\n'))
    expect(records).toHaveLength(3)
    expect(records[1].bodyText).toContain('batch_error')
    expect(records[2].bodyText).toContain('batch_http_status')
  })
})
