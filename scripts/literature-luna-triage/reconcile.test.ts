/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { sha256 } from '../literature-production-ingest/canonical'
import { serializeBatchLine } from './batch'
import { estimateRequestTokens } from './estimate'
import { buildStageARequestBody, requestBodyText } from './openai'
import { loadStageAPrompt } from './prompt'
import { ReconciliationError, reconcileRequestBodyText, reconcileShardContent } from './reconcile'

/**
 * Byte-level reconciliation.
 *
 * Everything a spend is measured against is recomputed here from the bytes that will actually
 * be sent. The test that matters most is the negative one: a shard whose accompanying metadata
 * says one record while its bytes hold two must be *unrepresentable* as a one-record spend.
 */

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

function bodyFor(index: number, reasoning: 'low' | 'high' = 'low'): Record<string, unknown> {
  return buildStageARequestBody(packetFor(index), {
    model: 'gpt-5.6-luna',
    reasoning,
    instructions: PROMPT,
  })
}

function shardOf(count: number): string {
  return `${Array.from({ length: count }, (_unused, index) =>
    serializeBatchLine({ customId: packetFor(index).record_id, body: bodyFor(index) }),
  ).join('\n')}\n`
}

describe('request-body reconciliation', () => {
  it('recovers the record, model, effort, and exact token contribution from the bytes', () => {
    const bytes = requestBodyText(bodyFor(1))
    const reconciliation = reconcileRequestBodyText(bytes)
    const expected = estimateRequestTokens(PROMPT, JSON.stringify(packetFor(1)), 'low')
    expect(reconciliation.recordId).toBe(packetFor(1).record_id)
    expect(reconciliation.model).toBe('gpt-5.6-luna')
    expect(reconciliation.reasoningEffort).toBe('low')
    expect(reconciliation.inputTokens).toBe(expected.inputTokens)
    expect(reconciliation.outputTokenAllowance).toBe(expected.outputTokenAllowance)
    expect(reconciliation.bodySha256).toBe(sha256(bytes))
  })

  it('reflects a higher reasoning effort as a higher output allowance', () => {
    const low = reconcileRequestBodyText(requestBodyText(bodyFor(1, 'low')))
    const high = reconcileRequestBodyText(requestBodyText(bodyFor(1, 'high')))
    expect(high.outputTokenAllowance).toBeGreaterThan(low.outputTokenAllowance)
  })

  it('refuses a body it cannot fully account for', () => {
    // A body whose cost cannot be recomputed is a body whose cost nobody can bound.
    for (const mutate of [
      (body: Record<string, unknown>) => ({ ...body, store: true }),
      (body: Record<string, unknown>) => ({ ...body, tools: [{ type: 'web_search' }] }),
      (body: Record<string, unknown>) => ({ ...body, max_output_tokens: 999_999 }),
      (body: Record<string, unknown>) => ({ ...body, reasoning: { effort: 'ultra' } }),
      (body: Record<string, unknown>) => ({ ...body, input: [] }),
      (body: Record<string, unknown>) => {
        const { instructions: _unused, ...rest } = body
        return rest
      },
      (body: Record<string, unknown>) => ({
        ...body,
        text: { format: { type: 'json_schema', name: 'other', strict: false, schema: {} } },
      }),
    ]) {
      expect(() => reconcileRequestBodyText(JSON.stringify(mutate(bodyFor(1))))).toThrow(
        ReconciliationError,
      )
    }
    expect(() => reconcileRequestBodyText('not json')).toThrow(ReconciliationError)
    expect(() => reconcileRequestBodyText('[]')).toThrow(ReconciliationError)
  })
})

describe('shard reconciliation', () => {
  it('counts records, ids, tokens, cost, and hash from the shard bytes alone', () => {
    const shard = shardOf(3)
    const reconciliation = reconcileShardContent(shard)
    expect(reconciliation.recordCount).toBe(3)
    expect(reconciliation.uniqueCustomIdCount).toBe(3)
    expect(reconciliation.contentSha256).toBe(sha256(shard))
    const perRecord = estimateRequestTokens(PROMPT, JSON.stringify(packetFor(0)), 'low')
    expect(reconciliation.estimatedInputTokens).toBe(
      [0, 1, 2].reduce(
        (sum, index) =>
          sum + estimateRequestTokens(PROMPT, JSON.stringify(packetFor(index)), 'low').inputTokens,
        0,
      ),
    )
    expect(reconciliation.estimatedOutputTokenAllowance).toBe(perRecord.outputTokenAllowance * 3)
    expect(reconciliation.estimatedTotalTokens).toBe(
      reconciliation.estimatedInputTokens + reconciliation.estimatedOutputTokenAllowance,
    )
    expect(reconciliation.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('makes a two-record shard indistinguishable from two records, whatever metadata claims', () => {
    // This is the property that makes an undercounted authorization impossible to mint: the
    // count comes from the bytes, so there is no metadata to disagree with it.
    expect(reconcileShardContent(shardOf(2)).recordCount).toBe(2)
    expect(reconcileShardContent(shardOf(1)).recordCount).toBe(1)
    expect(reconcileShardContent(shardOf(2)).estimatedTotalTokens).toBeGreaterThan(
      reconcileShardContent(shardOf(1)).estimatedTotalTokens,
    )
  })

  it('refuses duplicate custom ids, foreign endpoints, and mismatched packets', () => {
    const one = shardOf(1)
    expect(() => reconcileShardContent(`${one}${one}`)).toThrow(/repeats a custom id/u)
    const foreign = `${JSON.stringify({
      custom_id: packetFor(0).record_id,
      method: 'POST',
      url: '/v1/chat/completions',
      body: bodyFor(0),
    })}\n`
    expect(() => reconcileShardContent(foreign)).toThrow(/endpoint outside this lane/u)
    const mismatched = `${JSON.stringify({
      custom_id: packetFor(7).record_id,
      method: 'POST',
      url: '/v1/responses',
      body: bodyFor(0),
    })}\n`
    expect(() => reconcileShardContent(mismatched)).toThrow(/its packet does not match/u)
    expect(() => reconcileShardContent('')).toThrow(/carries no requests/u)
    expect(() => reconcileShardContent('{not json\n')).toThrow(/not valid JSON/u)
  })
})
