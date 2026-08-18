/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { sha256 } from '../literature-production-ingest/canonical'
import { estimateCohortCost, estimateRequestTokens, type CohortEstimate } from './estimate'
import { loadStageAPrompt } from './prompt'
import {
  SpendAuthorizationError,
  assertNetworkPlanComplete,
  assertSafeRemoteIdentifier,
  assertSpendAuthorized,
  assertSpendEnvelope,
  batchCreateTemplateBody,
  bindStatusReceipt,
  bindUploadedFileId,
  buildEndpointUrl,
  buildStageAJsonSchema,
  buildStageARequestBody,
  executeOpenAiRequest,
  mintSpendAuthorization,
  networkPlanSha256,
  redactOpenAiSecrets,
  remainingNetworkBudget,
  requestBodySha256,
  requestBodyText,
  requiredConfirmationPhrase,
  type NetworkPlanStep,
  type OpenAiKeyProvider,
  type SpendAuthorization,
  type SpendAuthorizationRequest,
  type SpendEnvelope,
  type StepIntent,
} from './openai'

/**
 * Spend and network authority regressions.
 *
 * The shape of every test here is the same: prove that the refusal happens *before* anything
 * leaves the machine. A counting fetch and a counting key provider are injected into each
 * case, and a refusal must leave both at zero — a check that would still pass if the key were
 * read a line too early is not a check at all. Nothing in this file touches
 * `process.env.OPENAI_API_KEY`.
 */

const OPERATION = 'op-test'
const PROMPT = loadStageAPrompt().text

interface Probe {
  readonly fetchImplementation: typeof fetch
  readonly keyProvider: OpenAiKeyProvider
  readonly sockets: () => number
  readonly keyReads: () => number
  readonly urls: () => readonly string[]
  readonly bodies: () => readonly (string | null)[]
}

function probe(responses: readonly string[] = []): Probe {
  let sockets = 0
  let keyReads = 0
  const urls: string[] = []
  const bodies: (string | null)[] = []
  const fetchImplementation = (async (input: unknown, init: RequestInit) => {
    const index = sockets
    sockets += 1
    urls.push(String(input))
    bodies.push(typeof init?.body === 'string' ? init.body : null)
    const text = responses[index] ?? '{}'
    return { ok: true, status: 200, text: async () => text } as unknown as Response
  }) as unknown as typeof fetch
  return {
    fetchImplementation,
    keyProvider: {
      readKey: () => {
        keyReads += 1
        return 'sk-synthetic-test-key-value-not-real'
      },
    },
    sockets: () => sockets,
    keyReads: () => keyReads,
    urls: () => urls,
    bodies: () => bodies,
  }
}

function packet(index: number): UniversalPacket {
  return {
    record_id: sha256(`packet-${index}`),
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

function syncBody(index: number): Record<string, unknown> {
  return buildStageARequestBody(packet(index), {
    model: 'gpt-5.6-luna',
    reasoning: 'low',
    instructions: PROMPT,
  })
}

function syncBodyText(index: number): string {
  return requestBodyText(syncBody(index))
}

function syncSteps(count: number, operationId = OPERATION): NetworkPlanStep[] {
  return Array.from({ length: count }, (_unused, index) => {
    const estimate = estimateRequestTokens(PROMPT, JSON.stringify(packet(index)), 'low')
    return {
      sequenceIndex: index,
      action: 'run-sync' as const,
      operationId,
      method: 'POST' as const,
      endpointClass: 'responses.create' as const,
      remoteIdSource: 'none' as const,
      planRemoteId: null,
      fileRole: null,
      body: { kind: 'digest' as const, sha256: requestBodySha256(syncBody(index)) },
      recordId: packet(index).record_id,
      expectedRecords: 1,
      expectedInputTokens: estimate.inputTokens,
      expectedOutputTokens: estimate.outputTokenAllowance,
      allowedExecutions: 1 as const,
      optional: false,
    }
  })
}

function syncEstimate(records: number): CohortEstimate {
  return estimateCohortCost(
    Array.from({ length: records }, (_unused, index) =>
      estimateRequestTokens(PROMPT, JSON.stringify(packet(index)), 'low'),
    ),
    { batch: false },
  )
}

function syncEnvelope(records: number, overrides: Partial<SpendEnvelope> = {}): SpendEnvelope {
  const estimate = syncEstimate(records)
  const steps = syncSteps(records)
  return {
    action: 'run-sync',
    operationId: OPERATION,
    cohort: 'smoke-30',
    planSha256: networkPlanSha256(steps),
    recordCount: records,
    estimatedInputTokens: estimate.inputTokens,
    estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
    estimatedTotalTokens: estimate.totalTokenAllowance,
    estimatedCostUsd: estimate.estimatedCostUsd,
    maxRecords: 30,
    maxEstimatedCostUsd: 5,
    steps,
    maxNetworkRequests: steps.length,
    ...overrides,
  }
}

function syncRequest(
  records: number,
  overrides: Partial<SpendAuthorizationRequest> = {},
): SpendAuthorizationRequest {
  return {
    confirmFlagPresent: true,
    interactiveTty: true,
    interactivePhrase: requiredConfirmationPhrase(OPERATION),
    envelope: syncEnvelope(records),
    estimate: syncEstimate(records),
    plannedBodies: Array.from({ length: records }, (_unused, index) => syncBodyText(index)),
    ...overrides,
  }
}

function mintSync(records: number, overrides: Partial<SpendAuthorizationRequest> = {}) {
  return mintSpendAuthorization(syncRequest(records, overrides))
}

function syncIntent(index: number): StepIntent {
  return {
    kind: 'responses.create',
    action: 'run-sync',
    operationId: OPERATION,
    recordId: packet(index).record_id,
    bodyText: syncBodyText(index),
  }
}

describe('confirmation phrase', () => {
  it('derives the required phrase internally from the operation id', () => {
    expect(requiredConfirmationPhrase(OPERATION)).toBe(`SPEND ${OPERATION}`)
  })

  it('accepts the correct internally derived phrase', () => {
    expect(assertSpendAuthorized(mintSync(1)).recordCount).toBe(1)
  })

  it('refuses an arbitrary caller-selected phrase', () => {
    // The old defect: a caller supplied both the phrase and the answer, so any pair matched.
    expect(() => mintSync(1, { interactivePhrase: 'yes' })).toThrow(SpendAuthorizationError)
    expect(() => mintSync(1, { interactivePhrase: 'SPEND' })).toThrow(SpendAuthorizationError)
    expect(() => mintSync(1, { interactivePhrase: `spend ${OPERATION}` })).toThrow(
      SpendAuthorizationError,
    )
    expect(() => mintSync(1, { interactivePhrase: `SPEND ${OPERATION} ` })).toThrow(
      SpendAuthorizationError,
    )
  })

  it('refuses a non-interactive confirmation', () => {
    expect(() => mintSync(1, { interactiveTty: false })).toThrow(SpendAuthorizationError)
    expect(() => mintSync(1, { interactivePhrase: null })).toThrow(SpendAuthorizationError)
    expect(() => mintSync(1, { confirmFlagPresent: false })).toThrow(SpendAuthorizationError)
  })
})

describe('ordered network plan', () => {
  it('executes one exact valid synchronous sequence in order', async () => {
    const capability = mintSync(3)
    const network = probe()
    for (let index = 0; index < 3; index += 1) {
      await executeOpenAiRequest({
        intent: syncIntent(index),
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      })
    }
    expect(network.sockets()).toBe(3)
    expect(network.urls()).toEqual([
      'https://api.openai.com/v1/responses',
      'https://api.openai.com/v1/responses',
      'https://api.openai.com/v1/responses',
    ])
    // Wire bytes are exactly the digested bytes; the digest is not taken over a different form.
    expect(network.bodies()[0]).toBe(syncBodyText(0))
    expect(remainingNetworkBudget(capability)).toBe(0)
    expect(() => assertNetworkPlanComplete(capability)).not.toThrow()
  })

  it('refuses a swapped request order and opens zero sockets', async () => {
    const capability = mintSync(2)
    const network = probe()
    await executeOpenAiRequest({
      intent: syncIntent(1),
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    const before = network.sockets()
    await expect(
      executeOpenAiRequest({
        intent: syncIntent(0),
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.sockets()).toBe(before)
  })

  it('refuses a duplicate execution of the same step', async () => {
    const capability = mintSync(1)
    const network = probe()
    await executeOpenAiRequest({
      intent: syncIntent(0),
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    await expect(
      executeOpenAiRequest({
        intent: syncIntent(0),
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.sockets()).toBe(1)
  })

  it('refuses an extra request beyond the plan', async () => {
    const capability = mintSync(1)
    const network = probe()
    await executeOpenAiRequest({
      intent: syncIntent(0),
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    await expect(
      executeOpenAiRequest({
        intent: syncIntent(1),
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.sockets()).toBe(1)
    expect(network.keyReads()).toBe(1)
  })

  it('reports a missing request as an incomplete plan', async () => {
    const capability = mintSync(2)
    const network = probe()
    await executeOpenAiRequest({
      intent: syncIntent(0),
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    expect(() => assertNetworkPlanComplete(capability)).toThrow(SpendAuthorizationError)
  })

  it('refuses a wrong action, a wrong operation, and a wrong plan', async () => {
    const capability = mintSync(1)
    const network = probe()
    expect(() =>
      assertSpendEnvelope(capability, {
        action: 'batch-submit',
        operationId: OPERATION,
        planSha256: networkPlanSha256(syncSteps(1)),
      }),
    ).toThrow(SpendAuthorizationError)
    expect(() =>
      assertSpendEnvelope(capability, {
        action: 'run-sync',
        operationId: 'op-other',
        planSha256: networkPlanSha256(syncSteps(1)),
      }),
    ).toThrow(SpendAuthorizationError)
    expect(() =>
      assertSpendEnvelope(capability, {
        action: 'run-sync',
        operationId: OPERATION,
        planSha256: sha256('another plan'),
      }),
    ).toThrow(SpendAuthorizationError)
    await expect(
      executeOpenAiRequest({
        intent: { ...syncIntent(0), operationId: 'op-other' } as StepIntent,
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.sockets()).toBe(0)
    expect(network.keyReads()).toBe(0)
  })

  it('refuses a plan digest that does not bind its own steps', () => {
    expect(() =>
      mintSync(1, { envelope: syncEnvelope(1, { planSha256: sha256('unrelated') }) }),
    ).toThrow(SpendAuthorizationError)
  })

  it('refuses request bytes changed after authorization', async () => {
    const capability = mintSync(1)
    const network = probe()
    await expect(
      executeOpenAiRequest({
        intent: { ...syncIntent(0), bodyText: `${syncBodyText(0)} ` } as StepIntent,
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.sockets()).toBe(0)
    expect(network.keyReads()).toBe(0)
  })
})

describe('spend and shard reconciliation', () => {
  const shardLine = (index: number) =>
    JSON.stringify({
      custom_id: packet(index).record_id,
      method: 'POST',
      url: '/v1/responses',
      body: syncBody(index),
    })
  const shardOf = (count: number) =>
    `${Array.from({ length: count }, (_u, index) => shardLine(index)).join('\n')}\n`

  function batchSubmitSteps(shard: string, records: number, operationId = OPERATION) {
    const estimate = estimateCohortCost(
      Array.from({ length: records }, (_u, index) =>
        estimateRequestTokens(PROMPT, JSON.stringify(packet(index)), 'low'),
      ),
      { batch: true },
    )
    return [
      {
        sequenceIndex: 0,
        action: 'batch-submit' as const,
        operationId,
        method: 'POST' as const,
        endpointClass: 'files.upload' as const,
        remoteIdSource: 'none' as const,
        planRemoteId: null,
        fileRole: null,
        body: { kind: 'digest' as const, sha256: sha256(shard) },
        recordId: null,
        expectedRecords: records,
        expectedInputTokens: estimate.inputTokens,
        expectedOutputTokens: estimate.outputTokenAllowance,
        allowedExecutions: 1 as const,
        optional: false,
      },
      {
        sequenceIndex: 1,
        action: 'batch-submit' as const,
        operationId,
        method: 'POST' as const,
        endpointClass: 'batches.create' as const,
        remoteIdSource: 'upload-receipt' as const,
        planRemoteId: null,
        fileRole: null,
        body: { kind: 'batch-create-template' as const },
        recordId: null,
        expectedRecords: 0,
        expectedInputTokens: 0,
        expectedOutputTokens: 0,
        allowedExecutions: 1 as const,
        optional: false,
      },
    ]
  }

  function mintBatchSubmit(shard: string, records: number, envelopeRecords = records) {
    const steps = batchSubmitSteps(shard, records)
    const estimate = estimateCohortCost(
      Array.from({ length: envelopeRecords }, (_u, index) =>
        estimateRequestTokens(PROMPT, JSON.stringify(packet(index)), 'low'),
      ),
      { batch: true },
    )
    return mintSpendAuthorization({
      confirmFlagPresent: true,
      interactiveTty: true,
      interactivePhrase: requiredConfirmationPhrase(OPERATION),
      envelope: {
        action: 'batch-submit',
        operationId: OPERATION,
        cohort: 'smoke-30',
        planSha256: networkPlanSha256(steps),
        recordCount: envelopeRecords,
        estimatedInputTokens: estimate.inputTokens,
        estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
        estimatedTotalTokens: estimate.totalTokenAllowance,
        estimatedCostUsd: estimate.estimatedCostUsd,
        maxRecords: 100,
        maxEstimatedCostUsd: 50,
        steps,
        maxNetworkRequests: 2,
      },
      estimate,
      plannedBodies: [shard],
    })
  }

  it('mints an exact upload then Batch-create sequence and binds the returned file id', async () => {
    const shard = shardOf(2)
    const capability = mintBatchSubmit(shard, 2)
    const network = probe([
      JSON.stringify({ id: 'file_abc123' }),
      JSON.stringify({ id: 'batch_xyz789', input_file_id: 'file_abc123' }),
    ])
    await executeOpenAiRequest({
      intent: {
        kind: 'files.upload',
        action: 'batch-submit',
        operationId: OPERATION,
        shardContent: shard,
        filename: 'shard-0000-abcdef123456.jsonl',
      },
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    bindUploadedFileId(capability, 'file_abc123')
    await executeOpenAiRequest({
      intent: { kind: 'batches.create', action: 'batch-submit', operationId: OPERATION },
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    expect(network.sockets()).toBe(2)
    expect(network.urls()[1]).toBe('https://api.openai.com/v1/batches')
    // The creation body is the reviewed template plus the bound id, and nothing else.
    expect(JSON.parse(String(network.bodies()[1]))).toEqual({
      completion_window: '24h',
      endpoint: '/v1/responses',
      input_file_id: 'file_abc123',
    })
    expect(() => assertNetworkPlanComplete(capability)).not.toThrow()
  })

  it('refuses a two-record shard minted under a one-record estimate', () => {
    // The exact case the review named: actual shard content exceeding the minted authority.
    expect(() => mintBatchSubmit(shardOf(2), 1)).toThrow(SpendAuthorizationError)
  })

  it('refuses an undercounted record, token, or cost total', () => {
    const shard = shardOf(2)
    const steps = batchSubmitSteps(shard, 2)
    const estimate = estimateCohortCost(
      Array.from({ length: 2 }, (_u, index) =>
        estimateRequestTokens(PROMPT, JSON.stringify(packet(index)), 'low'),
      ),
      { batch: true },
    )
    const base = {
      confirmFlagPresent: true,
      interactiveTty: true,
      interactivePhrase: requiredConfirmationPhrase(OPERATION),
      estimate,
      plannedBodies: [shard],
    }
    const envelope = {
      action: 'batch-submit' as const,
      operationId: OPERATION,
      cohort: 'smoke-30',
      planSha256: networkPlanSha256(steps),
      recordCount: 2,
      estimatedInputTokens: estimate.inputTokens,
      estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
      estimatedTotalTokens: estimate.totalTokenAllowance,
      estimatedCostUsd: estimate.estimatedCostUsd,
      maxRecords: 100,
      maxEstimatedCostUsd: 50,
      steps,
      maxNetworkRequests: 2,
    }
    // Undercounted records.
    expect(() =>
      mintSpendAuthorization({ ...base, envelope: { ...envelope, recordCount: 1 } }),
    ).toThrow(SpendAuthorizationError)
    // Undercounted tokens: the step claims less than the shard bytes cost.
    const cheapSteps = [{ ...steps[0], expectedInputTokens: 1, expectedOutputTokens: 1 }, steps[1]]
    expect(() =>
      mintSpendAuthorization({
        ...base,
        envelope: {
          ...envelope,
          steps: cheapSteps,
          planSha256: networkPlanSha256(cheapSteps),
          estimatedInputTokens: 1,
          estimatedOutputTokenAllowance: 1,
          estimatedTotalTokens: 2,
        },
        estimate: { ...estimate, inputTokens: 1, outputTokenAllowance: 1, totalTokenAllowance: 2 },
      }),
    ).toThrow(SpendAuthorizationError)
    // Undercounted cost: the envelope's cost no longer equals the estimate it claims.
    expect(() =>
      mintSpendAuthorization({ ...base, envelope: { ...envelope, estimatedCostUsd: 0 } }),
    ).toThrow(SpendAuthorizationError)
  })

  it('refuses shard bytes changed after authorization, before any socket', async () => {
    const shard = shardOf(2)
    const capability = mintBatchSubmit(shard, 2)
    const network = probe()
    await expect(
      executeOpenAiRequest({
        intent: {
          kind: 'files.upload',
          action: 'batch-submit',
          operationId: OPERATION,
          shardContent: `${shard}${shardLine(9)}\n`,
          filename: 'shard-0000-abcdef123456.jsonl',
        },
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.sockets()).toBe(0)
    expect(network.keyReads()).toBe(0)
  })

  it('refuses an arbitrary Batch-creation body and a wrong uploaded file id', async () => {
    const shard = shardOf(1)
    const capability = mintBatchSubmit(shard, 1)
    const network = probe([JSON.stringify({ id: 'file_real' })])
    await executeOpenAiRequest({
      intent: {
        kind: 'files.upload',
        action: 'batch-submit',
        operationId: OPERATION,
        shardContent: shard,
        filename: 'shard-0000-abcdef123456.jsonl',
      },
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    // No file id has been bound yet: the creation step has nothing to name and refuses.
    await expect(
      executeOpenAiRequest({
        intent: { kind: 'batches.create', action: 'batch-submit', operationId: OPERATION },
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.sockets()).toBe(1)
    // An unsafe file id can never be bound at all.
    expect(() => bindUploadedFileId(capability, '../../escape')).toThrow(SpendAuthorizationError)
    expect(() => bindUploadedFileId(capability, 'file_real/../other')).toThrow(
      SpendAuthorizationError,
    )
    bindUploadedFileId(capability, 'file_real')
    // Bound once, and only once.
    expect(() => bindUploadedFileId(capability, 'file_other')).toThrow(SpendAuthorizationError)
    await executeOpenAiRequest({
      intent: { kind: 'batches.create', action: 'batch-submit', operationId: OPERATION },
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    // The body carries the bound id, never a caller's.
    expect(String(network.bodies()[1])).toContain('file_real')
  })

  it('builds the Batch-creation template only from a safe file id', () => {
    expect(batchCreateTemplateBody('file_ok')).toEqual({
      input_file_id: 'file_ok',
      endpoint: '/v1/responses',
      completion_window: '24h',
    })
    expect(() => batchCreateTemplateBody('../file')).toThrow(SpendAuthorizationError)
  })
})

describe('status and result-file authority', () => {
  function controlSteps(action: 'batch-status' | 'batch-fetch', batchId: string) {
    const status = {
      sequenceIndex: 0,
      action,
      operationId: OPERATION,
      method: 'GET' as const,
      endpointClass: 'batches.retrieve' as const,
      remoteIdSource: 'plan' as const,
      planRemoteId: batchId,
      fileRole: null,
      body: { kind: 'none' as const },
      recordId: null,
      expectedRecords: 0,
      expectedInputTokens: 0,
      expectedOutputTokens: 0,
      allowedExecutions: 1 as const,
      optional: false,
    }
    if (action === 'batch-status') return [status]
    return [
      status,
      {
        ...status,
        sequenceIndex: 1,
        endpointClass: 'files.content' as const,
        remoteIdSource: 'status-receipt' as const,
        planRemoteId: null,
        fileRole: 'output' as const,
        optional: true,
      },
      {
        ...status,
        sequenceIndex: 2,
        endpointClass: 'files.content' as const,
        remoteIdSource: 'status-receipt' as const,
        planRemoteId: null,
        fileRole: 'error' as const,
        optional: true,
      },
    ]
  }

  function mintControl(action: 'batch-status' | 'batch-fetch', batchId: string) {
    const steps = controlSteps(action, batchId)
    const estimate = estimateCohortCost([], { batch: true })
    return mintSpendAuthorization({
      confirmFlagPresent: true,
      interactiveTty: true,
      interactivePhrase: requiredConfirmationPhrase(OPERATION),
      envelope: {
        action,
        operationId: OPERATION,
        cohort: 'smoke-30',
        planSha256: networkPlanSha256(steps),
        recordCount: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokenAllowance: 0,
        estimatedTotalTokens: 0,
        estimatedCostUsd: 0,
        maxRecords: 1,
        maxEstimatedCostUsd: 1,
        steps,
        maxNetworkRequests: steps.length,
      },
      estimate,
      plannedBodies: [],
    })
  }

  it('runs one exact validated status then result-fetch sequence', async () => {
    const capability = mintControl('batch-fetch', 'batch_A')
    const network = probe([
      JSON.stringify({ id: 'batch_A', status: 'completed', output_file_id: 'file_out' }),
      'line\n',
    ])
    await executeOpenAiRequest({
      intent: { kind: 'batches.retrieve', action: 'batch-fetch', operationId: OPERATION },
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    bindStatusReceipt(capability, {
      batchId: 'batch_A',
      outputFileId: 'file_out',
      errorFileId: null,
    })
    await executeOpenAiRequest({
      intent: {
        kind: 'files.content',
        action: 'batch-fetch',
        operationId: OPERATION,
        fileRole: 'output',
      },
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    expect(network.urls()).toEqual([
      'https://api.openai.com/v1/batches/batch_A',
      'https://api.openai.com/v1/files/file_out/content',
    ])
    // A Batch that produced no error file simply never runs that optional step.
    expect(() => assertNetworkPlanComplete(capability)).not.toThrow()
  })

  it('refuses a status body naming a different Batch', () => {
    const capability = mintControl('batch-status', 'batch_A')
    expect(() =>
      bindStatusReceipt(capability, {
        batchId: 'batch_B',
        outputFileId: 'file_o',
        errorFileId: null,
      }),
    ).toThrow(SpendAuthorizationError)
  })

  it('refuses fetching Batch B files with Batch A authority', async () => {
    const capability = mintControl('batch-fetch', 'batch_A')
    const network = probe([
      JSON.stringify({ id: 'batch_A', status: 'completed', output_file_id: 'file_A_out' }),
    ])
    await executeOpenAiRequest({
      intent: { kind: 'batches.retrieve', action: 'batch-fetch', operationId: OPERATION },
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    bindStatusReceipt(capability, {
      batchId: 'batch_A',
      outputFileId: 'file_A_out',
      errorFileId: null,
    })
    const before = network.sockets()
    // There is no intent shape that can name a foreign file id: the caller supplies a role,
    // and the role resolves only through Batch A's own bound receipt.
    await executeOpenAiRequest({
      intent: {
        kind: 'files.content',
        action: 'batch-fetch',
        operationId: OPERATION,
        fileRole: 'output',
      },
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    expect(network.urls()[before]).toBe('https://api.openai.com/v1/files/file_A_out/content')
    // The error-role step has no file in this receipt, so it refuses rather than inventing one.
    await expect(
      executeOpenAiRequest({
        intent: {
          kind: 'files.content',
          action: 'batch-fetch',
          operationId: OPERATION,
          fileRole: 'error',
        },
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
  })

  it('refuses a file fetch before any status receipt is bound', async () => {
    const capability = mintControl('batch-fetch', 'batch_A')
    const network = probe()
    await expect(
      executeOpenAiRequest({
        intent: {
          kind: 'files.content',
          action: 'batch-fetch',
          operationId: OPERATION,
          fileRole: 'output',
        },
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.sockets()).toBe(0)
    expect(network.keyReads()).toBe(0)
  })
})

describe('remote identifier and endpoint safety', () => {
  it.each([
    ['a slash', 'batch/one'],
    ['a backslash', 'batch\\one'],
    ['a dot segment', '..'],
    ['a leading dot segment', '../escape'],
    ['a dot character', 'batch.one'],
    ['a percent-encoded separator', 'batch%2Fone'],
    ['a percent-encoded dot segment', '%2e%2e'],
    ['a bare percent', 'batch%one'],
    ['a query character', 'batch?x=1'],
    ['a fragment character', 'batch#frag'],
    ['whitespace', 'batch one'],
    ['a control character', 'batchone'],
    ['an empty value', ''],
  ])('rejects %s in a remote identifier', (_label, value) => {
    expect(() => assertSafeRemoteIdentifier(value, 'Batch id')).toThrow(SpendAuthorizationError)
  })

  it('accepts a plain remote identifier and builds the exact endpoint', () => {
    expect(assertSafeRemoteIdentifier('batch_abc-123', 'Batch id')).toBe('batch_abc-123')
    expect(buildEndpointUrl('batches.retrieve', 'batch_abc-123')).toEqual({
      path: '/batches/batch_abc-123',
      url: 'https://api.openai.com/v1/batches/batch_abc-123',
    })
    expect(buildEndpointUrl('files.content', 'file_x').url).toBe(
      'https://api.openai.com/v1/files/file_x/content',
    )
  })

  it('refuses an identifier that would normalize into another endpoint family', () => {
    // The old defect: `/batches/../files/file_x/content` normalized to a /files fetch.
    expect(() => buildEndpointUrl('batches.retrieve', '../files/file_x/content')).toThrow(
      SpendAuthorizationError,
    )
    expect(() => buildEndpointUrl('batches.retrieve', '..')).toThrow(SpendAuthorizationError)
    expect(() => buildEndpointUrl('responses.create', 'anything')).toThrow(SpendAuthorizationError)
    expect(() => buildEndpointUrl('batches.retrieve', null)).toThrow(SpendAuthorizationError)
  })
})

describe('key-read boundary and redaction', () => {
  it('reads the key exactly once, only inside a successful send', async () => {
    const capability = mintSync(1)
    const network = probe()
    await executeOpenAiRequest({
      intent: syncIntent(0),
      authorization: capability,
      keyProvider: network.keyProvider,
      fetchImplementation: network.fetchImplementation,
    })
    expect(network.keyReads()).toBe(1)
  })

  it('reads the key provider zero times on every refusal', async () => {
    const network = probe()
    // Refusal at mint.
    expect(() => mintSync(1, { interactivePhrase: 'nope' })).toThrow(SpendAuthorizationError)
    // Refusal at step resolution.
    const capability = mintSync(1)
    await expect(
      executeOpenAiRequest({
        intent: { ...syncIntent(0), bodyText: 'tampered' } as StepIntent,
        authorization: capability,
        keyProvider: network.keyProvider,
        fetchImplementation: network.fetchImplementation,
      }),
    ).rejects.toThrow(SpendAuthorizationError)
    expect(network.keyReads()).toBe(0)
    expect(network.sockets()).toBe(0)
  })

  it('redacts credential shapes without consulting the environment', () => {
    // Generic shape redaction only; no environment read anywhere on this path.
    expect(redactOpenAiSecrets('token sk-abcdefghijklmnop failed')).toContain('[redacted]')
    expect(redactOpenAiSecrets('Authorization: Bearer abcdefghijklmnop')).toContain(
      'Bearer [redacted]',
    )
    // An explicitly supplied secret is also removed, without reading it from anywhere.
    expect(redactOpenAiSecrets('leaked hunter2hunter2', 'hunter2hunter2')).toBe('leaked [redacted]')
    expect(redactOpenAiSecrets(new Error('plain message'))).toBe('plain message')
  })
})

describe('capability integrity', () => {
  it('refuses a structurally copied capability', () => {
    const capability = mintSync(1)
    const copied = { ...(capability as Record<string, unknown>) } as SpendAuthorization
    expect(() => assertSpendAuthorized(copied)).toThrow(SpendAuthorizationError)
    expect(() => assertSpendAuthorized({} as SpendAuthorization)).toThrow(SpendAuthorizationError)
  })

  it('refuses a plan whose steps disagree with its declared action or operation', () => {
    const steps = syncSteps(1, 'op-other')
    expect(() =>
      mintSync(1, {
        envelope: syncEnvelope(1, { steps, planSha256: networkPlanSha256(steps) }),
      }),
    ).toThrow(SpendAuthorizationError)
  })

  it('keeps the structured-output schema strict and closed', () => {
    const schema = buildStageAJsonSchema()
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual([
      'record_id',
      'triage_decision',
      'confidence_band',
      'reason_codes',
    ])
  })
})
