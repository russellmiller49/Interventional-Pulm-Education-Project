/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { estimateCohortCost } from './estimate'
import { syntheticResponseBody, syntheticStageAOutput } from './fixtures'
import {
  mintSpendAuthorization,
  networkPlanSha256,
  requiredConfirmationPhrase,
  type OpenAiKeyProvider,
  type SpendAuthorization,
} from './openai'
import {
  executeSyncRun,
  ledgerCostUsd,
  prepareRequestSet,
  syncRunPlanSha256,
  syncRunPlan,
  type LedgerRow,
  type PreparedRequest,
} from './runner'

/** Injected in place of the environment: tests never touch the real key variable. */
const keyProvider: OpenAiKeyProvider = {
  readKey: () => 'sk-synthetic-test-key-value-not-real',
}

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
  function authorization(
    requests: readonly PreparedRequest[],
    overrides: { readonly operationId?: string } = {},
  ): SpendAuthorization {
    const estimate = estimateCohortCost(
      requests.map((request) => request.estimate),
      { batch: false },
    )
    const operationId = overrides.operationId ?? 'op-x'
    const steps = syncRunPlan(requests, operationId)
    return mintSpendAuthorization({
      confirmFlagPresent: true,
      interactiveTty: true,
      interactivePhrase: requiredConfirmationPhrase(operationId),
      envelope: {
        action: 'run-sync',
        operationId,
        cohort: 'smoke-30',
        planSha256: networkPlanSha256(steps),
        recordCount: requests.length,
        estimatedInputTokens: estimate.inputTokens,
        estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
        estimatedTotalTokens: estimate.totalTokenAllowance,
        estimatedCostUsd: estimate.estimatedCostUsd,
        maxRecords: 100,
        maxEstimatedCostUsd: 100,
        steps,
        maxNetworkRequests: steps.length,
      },
      estimate,
      plannedBodies: requests.map((request) => request.bodyText),
    })
  }

  it('writes raw responses and ledger rows sequentially', async () => {
    const prepared = prepareRequestSet([packet(ID_A, 'One'), packet(ID_B, 'Two')], PARAMS)
    const raw: Record<string, string> = {}
    const ledger: LedgerRow[] = []
    const summary = await executeSyncRun({
      requests: prepared.requests,
      operationId: 'op-x',
      authorization: authorization(prepared.requests),
      sinks: {
        writeRawResponse: async (customId, bodyText) => {
          raw[customId] = bodyText
        },
        appendLedger: async (row) => {
          ledger.push(row)
        },
        now: () => '2026-08-17T00:00:00.000Z',
      },
      keyProvider,
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
        operationId: 'op-x',
        authorization: authorization(prepared.requests),
        sinks: {
          writeRawResponse: async () => undefined,
          appendLedger: async (row) => {
            ledger.push(row)
          },
          now: () => 'now',
        },
        keyProvider,
        fetchImplementation: (async () => {
          calls += 1
          return {
            ok: false,
            status: 500,
            text: async () => 'exploded sk-test-abcdef1234567890',
          } as unknown as Response
        }) as typeof fetch,
      }),
    ).rejects.toThrow(/no automatic retry/u)
    expect(calls).toBe(1)
    expect(ledger).toHaveLength(1)
    expect(ledger[0].error).toContain('[redacted]')
    expect(ledger[0].error).not.toContain('sk-test-abcdef1234567890')
  })
})

/**
 * LUNA-SPEND-001 at the run boundary. The capability is bound to one operation and one exact
 * prepared request set; drift in either refuses before the first socket.
 */
describe('run-level spend binding (LUNA-SPEND-001)', () => {
  const sinks = {
    writeRawResponse: async () => undefined,
    appendLedger: async () => undefined,
    now: () => 'now',
  }

  function forbiddenFetch() {
    let calls = 0
    const implementation = (async () => {
      calls += 1
      throw new Error('fetch must never be reached')
    }) as typeof fetch
    return { implementation, calls: () => calls }
  }

  it('refuses a capability minted for another operation', async () => {
    const prepared = prepareRequestSet([packet(ID_A, 'One')], PARAMS)
    const socket = forbiddenFetch()
    await expect(
      executeSyncRun({
        requests: prepared.requests,
        operationId: 'op-x',
        authorization: authorizationFor(prepared.requests, 'op-other'),
        sinks,
        keyProvider,
        fetchImplementation: socket.implementation,
      }),
    ).rejects.toThrow(/different operation/u)
    expect(socket.calls()).toBe(0)
  })

  it('refuses a request set that drifted after authorization', async () => {
    const authorized = prepareRequestSet([packet(ID_A, 'One')], PARAMS)
    const drifted = prepareRequestSet(
      [packet(ID_A, 'One edited after the owner confirmed')],
      PARAMS,
    )
    const socket = forbiddenFetch()
    await expect(
      executeSyncRun({
        requests: drifted.requests,
        operationId: 'op-x',
        authorization: authorizationFor(authorized.requests, 'op-x'),
        sinks,
        keyProvider,
        fetchImplementation: socket.implementation,
      }),
    ).rejects.toThrow(/plan digest changed/u)
    expect(socket.calls()).toBe(0)
  })

  it('refuses to mint when the prepared record count exceeds the owner ceiling', () => {
    const prepared = prepareRequestSet([packet(ID_A, 'One'), packet(ID_B, 'Two')], PARAMS)
    const estimate = estimateCohortCost(
      prepared.requests.map((request) => request.estimate),
      { batch: false },
    )
    expect(() =>
      mintSpendAuthorization({
        confirmFlagPresent: true,
        interactiveTty: true,
        interactivePhrase: requiredConfirmationPhrase('op-x'),
        envelope: {
          action: 'run-sync',
          operationId: 'op-x',
          cohort: 'smoke-30',
          planSha256: networkPlanSha256(syncRunPlan(prepared.requests, 'op-x')),
          recordCount: 2,
          estimatedInputTokens: estimate.inputTokens,
          estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
          estimatedTotalTokens: estimate.totalTokenAllowance,
          estimatedCostUsd: estimate.estimatedCostUsd,
          maxRecords: 1,
          maxEstimatedCostUsd: 100,
          steps: syncRunPlan(prepared.requests, 'op-x'),
          maxNetworkRequests: 2,
        },
        estimate,
        plannedBodies: prepared.requests.map((request) => request.bodyText),
      }),
    ).toThrow(/exceeds --max-records/u)
  })
})

function authorizationFor(
  requests: readonly PreparedRequest[],
  operationId: string,
): SpendAuthorization {
  const estimate = estimateCohortCost(
    requests.map((request) => request.estimate),
    { batch: false },
  )
  const steps = syncRunPlan(requests, operationId)
  return mintSpendAuthorization({
    confirmFlagPresent: true,
    interactiveTty: true,
    interactivePhrase: requiredConfirmationPhrase(operationId),
    envelope: {
      action: 'run-sync',
      operationId,
      cohort: 'smoke-30',
      planSha256: networkPlanSha256(steps),
      recordCount: requests.length,
      estimatedInputTokens: estimate.inputTokens,
      estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
      estimatedTotalTokens: estimate.totalTokenAllowance,
      estimatedCostUsd: estimate.estimatedCostUsd,
      maxRecords: 100,
      maxEstimatedCostUsd: 100,
      steps,
      maxNetworkRequests: steps.length,
    },
    estimate,
    plannedBodies: requests.map((request) => request.bodyText),
  })
}
