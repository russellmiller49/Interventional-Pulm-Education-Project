/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { sha256 } from '../literature-production-ingest/canonical'
import { estimateCohortCost, estimateRequestTokens } from './estimate'
import { loadStageAPrompt } from './prompt'
import { reconcileShardContent } from './reconcile'
import { buildStageARequestBody } from './request'
import {
  assertPositiveSafeIntegerCeiling,
  parseBatchOutputJsonl,
  planBatchShards,
  serializeBatchLine,
  shardPlanSummary,
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

/**
 * The offline reconciliation contract: the cohort estimate a shard plan reports must be
 * recoverable from the shard bytes themselves. Plan metadata never gets to be the authority
 * for what a prepared shard would cost.
 */
describe('prepared shard bytes reconcile to their estimate', () => {
  function realisticPlan(count: number) {
    const lines = Array.from({ length: count }, (_unused, index) => line(index + 1))
    const estimates = new Map(
      lines.map((entry, index) => [
        entry.customId,
        estimateRequestTokens(PROMPT, JSON.stringify(packetFor(index + 1)), 'low'),
      ]),
    )
    return { lines, estimates, plan: planBatchShards(lines, estimates) }
  }

  it('recovers each shard record count, token totals, and content digest from its bytes', () => {
    const { plan } = realisticPlan(4)
    for (const shard of plan.shards) {
      const reconciliation = reconcileShardContent(shard.content)
      expect(reconciliation.recordCount).toBe(shard.recordCount)
      expect(reconciliation.uniqueCustomIdCount).toBe(shard.recordCount)
      expect(reconciliation.estimatedInputTokens).toBe(shard.estimatedInputTokens)
      expect(reconciliation.estimatedOutputTokenAllowance).toBe(shard.estimatedOutputTokenAllowance)
      expect(reconciliation.contentSha256).toBe(shard.contentSha256)
      expect(reconciliation.contentSha256).toBe(sha256(shard.content))
    }
  })

  it('matches the batch cohort estimate to the totals recovered from every shard', () => {
    const { estimates, plan } = realisticPlan(6)
    const estimate = estimateCohortCost([...estimates.values()], { batch: true })
    const fromBytes = plan.shards
      .map((shard) => reconcileShardContent(shard.content))
      .reduce(
        (sum, row) => ({
          records: sum.records + row.recordCount,
          inputTokens: sum.inputTokens + row.estimatedInputTokens,
          outputTokenAllowance: sum.outputTokenAllowance + row.estimatedOutputTokenAllowance,
        }),
        { records: 0, inputTokens: 0, outputTokenAllowance: 0 },
      )
    expect(fromBytes.records).toBe(estimate.records)
    expect(fromBytes.inputTokens).toBe(estimate.inputTokens)
    expect(fromBytes.outputTokenAllowance).toBe(estimate.outputTokenAllowance)
    expect(estimate.batchDiscountApplied).toBe(true)
  })

  it('keeps the shard filename bound to the digest of the bytes it names', () => {
    const { plan } = realisticPlan(3)
    for (const shard of plan.shards) {
      expect(shard.filename).toContain(shard.contentSha256.slice(0, 12))
      expect(shard.filename.endsWith('.jsonl')).toBe(true)
    }
  })
})
