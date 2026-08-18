/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { estimateCohortCost } from './estimate'
import { syntheticResponseBody, syntheticStageAOutput } from './fixtures'
import { mintSpendAuthorization } from './openai'
import { executeSyncRun, ledgerCostUsd, prepareRequestSet, type LedgerRow } from './runner'

const KEY_ENV = 'OPENAI_API_KEY'

function packet(recordId: string, title: string): UniversalPacket {
  return {
    record_id: recordId,
    title,
    abstract: null,
    journal: null,
    publication_year: null,
    publication_types: [],
    mesh_terms: [],
    keywords: [],
    language: null,
    evidence_profile: 'metadata_without_abstract',
  }
}

const PARAMS = {
  model: 'gpt-5.6-luna',
  reasoningEffort: 'low',
  instructions: 'INSTRUCTIONS',
  promptSha256: 'a'.repeat(64),
} as const

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)

describe('deterministic request preparation', () => {
  it('orders by record id and yields a stable manifest hash', () => {
    const packets = [packet(ID_B, 'Second'), packet(ID_A, 'First')]
    const first = prepareRequestSet(packets, PARAMS)
    const second = prepareRequestSet([...packets].reverse(), PARAMS)
    expect(first.requests.map((request) => request.customId)).toEqual([ID_A, ID_B])
    expect(second.manifest.requestSetSha256).toBe(first.manifest.requestSetSha256)
    expect(first.manifest.requestCount).toBe(2)
    expect(first.manifest.promptSha256).toBe(PARAMS.promptSha256)
  })

  it('changes the manifest hash when the prompt, model, or packet changes', () => {
    const base = prepareRequestSet([packet(ID_A, 'Title')], PARAMS)
    const prompt = prepareRequestSet([packet(ID_A, 'Title')], {
      ...PARAMS,
      instructions: 'OTHER',
    })
    const model = prepareRequestSet([packet(ID_A, 'Title')], { ...PARAMS, model: 'gpt-x' })
    const content = prepareRequestSet([packet(ID_A, 'Other title')], PARAMS)
    expect(prompt.manifest.requestSetSha256).not.toBe(base.manifest.requestSetSha256)
    expect(model.manifest.requestSetSha256).not.toBe(base.manifest.requestSetSha256)
    expect(content.manifest.requestSetSha256).not.toBe(base.manifest.requestSetSha256)
  })

  it('refuses duplicate record ids', () => {
    expect(() => prepareRequestSet([packet(ID_A, 'One'), packet(ID_A, 'Two')], PARAMS)).toThrow(
      /Duplicate record ids/u,
    )
  })
})

describe('ledger costs', () => {
  it('prices from usage tokens and returns null without usage', () => {
    expect(ledgerCostUsd(1_000_000, 100_000)).toBeCloseTo(1.25 + 1, 6)
    expect(ledgerCostUsd(null, 5)).toBeNull()
  })
})

describe('synchronous execution', () => {
  const previous = process.env[KEY_ENV]
  beforeEach(() => {
    process.env[KEY_ENV] = 'sk-test-abcdef1234567890'
  })
  afterEach(() => {
    if (previous === undefined) delete process.env[KEY_ENV]
    else process.env[KEY_ENV] = previous
  })

  function authorization(recordCount: number) {
    return mintSpendAuthorization({
      confirmFlagPresent: true,
      interactivePhrase: 'SPEND op-x',
      requiredPhrase: 'SPEND op-x',
      operationId: 'op-x',
      cohort: 'smoke-30',
      recordCount,
      maxRecords: 100,
      maxEstimatedCostUsd: 100,
      estimate: estimateCohortCost([{ inputTokens: 100, outputTokenAllowance: 10 }], {
        batch: false,
      }),
    })
  }

  it('writes raw responses and ledger rows sequentially', async () => {
    const prepared = prepareRequestSet([packet(ID_A, 'One'), packet(ID_B, 'Two')], PARAMS)
    const raw: Record<string, string> = {}
    const ledger: LedgerRow[] = []
    const summary = await executeSyncRun({
      requests: prepared.requests,
      authorization: authorization(2),
      sinks: {
        writeRawResponse: async (customId, bodyText) => {
          raw[customId] = bodyText
        },
        appendLedger: async (row) => {
          ledger.push(row)
        },
        now: () => '2026-08-17T00:00:00.000Z',
      },
      fetchImplementation: (async (url: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { input: unknown[] }
        expect(String(url)).toContain('/responses')
        expect(Array.isArray(body.input)).toBe(true)
        return new Response(
          syntheticResponseBody(
            syntheticStageAOutput(ID_A, 'obvious_irrelevant', 'high', [
              'clearly_nonpulmonary_domain',
            ]),
          ),
          { status: 200 },
        )
      }) as typeof fetch,
    })
    expect(summary).toEqual({ attempted: 2, succeeded: 2, failed: 0 })
    expect(Object.keys(raw).sort()).toEqual([ID_A, ID_B])
    expect(ledger).toHaveLength(2)
    expect(ledger[0].inputTokens).toBe(500)
    expect(ledger[0].estimatedCostUsd).not.toBeNull()
    expect(JSON.stringify(ledger)).not.toContain('sk-test')
  })

  it('stops on the first failure without retrying and records a redacted ledger row', async () => {
    const prepared = prepareRequestSet([packet(ID_A, 'One'), packet(ID_B, 'Two')], PARAMS)
    const ledger: LedgerRow[] = []
    let calls = 0
    await expect(
      executeSyncRun({
        requests: prepared.requests,
        authorization: authorization(2),
        sinks: {
          writeRawResponse: async () => undefined,
          appendLedger: async (row) => {
            ledger.push(row)
          },
          now: () => 'now',
        },
        fetchImplementation: (async () => {
          calls += 1
          return new Response('exploded sk-test-abcdef1234567890', { status: 500 })
        }) as typeof fetch,
      }),
    ).rejects.toThrow(/no automatic retry/u)
    expect(calls).toBe(1)
    expect(ledger).toHaveLength(1)
    expect(ledger[0].error).toContain('[redacted]')
    expect(ledger[0].error).not.toContain('sk-test-abcdef1234567890')
  })
})
