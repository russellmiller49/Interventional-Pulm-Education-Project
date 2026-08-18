/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import { estimateCohortCost, type CohortEstimate } from './estimate'
import {
  SpendAuthorizationError,
  assertSpendAuthorized,
  assertSpendEnvelope,
  buildStageAJsonSchema,
  buildStageARequestBody,
  consumeAuthorizedRequest,
  executeOpenAiRequest,
  mintSpendAuthorization,
  redactOpenAiSecrets,
  remainingNetworkBudget,
  requestBodySha256,
  type AuthorizedRequestSlot,
  type SpendAuthorization,
  type SpendAuthorizationRequest,
  type SpendEnvelope,
} from './openai'

const KEY_ENV = 'OPENAI_API_KEY'

/** One synthetic Responses body per index, with its canonical digest. */
function syncBody(index: number): Record<string, unknown> {
  return { model: 'gpt-5.6-luna', input: [{ role: 'user', content: `packet-${index}` }] }
}

function syncSlots(count: number): AuthorizedRequestSlot[] {
  return Array.from({ length: count }, (_unused, index) => ({
    kind: 'exact' as const,
    method: 'POST' as const,
    path: '/responses',
    bodySha256: requestBodySha256(syncBody(index)),
  }))
}

function syncPlanSha256(count: number): string {
  return sha256(
    canonicalJson(Array.from({ length: count }, (_u, index) => requestBodySha256(syncBody(index)))),
  )
}

function estimateFor(records: number): CohortEstimate {
  return estimateCohortCost(
    Array.from({ length: records }, () => ({ inputTokens: 1_000, outputTokenAllowance: 100 })),
    { batch: false },
  )
}

function envelopeFor(records: number, overrides: Partial<SpendEnvelope> = {}): SpendEnvelope {
  const estimate = estimateFor(records)
  return {
    action: 'run-sync',
    operationId: 'op-test',
    cohort: 'smoke-30',
    planSha256: syncPlanSha256(records),
    recordCount: records,
    estimatedInputTokens: estimate.inputTokens,
    estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
    estimatedTotalTokens: estimate.totalTokenAllowance,
    estimatedCostUsd: estimate.estimatedCostUsd,
    maxRecords: 30,
    maxEstimatedCostUsd: 5,
    requests: syncSlots(records),
    maxNetworkRequests: records,
    ...overrides,
  }
}

function authorizationRequest(
  overrides: Partial<SpendAuthorizationRequest> = {},
  records = 1,
): SpendAuthorizationRequest {
  return {
    confirmFlagPresent: true,
    interactivePhrase: 'SPEND op-test',
    requiredPhrase: 'SPEND op-test',
    envelope: envelopeFor(records),
    estimate: estimateFor(records),
    ...overrides,
  }
}

function mint(records = 1, envelope: Partial<SpendEnvelope> = {}): SpendAuthorization {
  return mintSpendAuthorization(
    authorizationRequest({ envelope: envelopeFor(records, envelope) }, records),
  )
}

/** Mint a run-sync capability whose authorized identities are exactly these request bodies. */
function mintForBodies(bodies: readonly Record<string, unknown>[]): SpendAuthorization {
  const estimate = estimateFor(bodies.length)
  const digests = bodies.map((body) => requestBodySha256(body))
  return mintSpendAuthorization({
    confirmFlagPresent: true,
    interactivePhrase: 'SPEND op-test',
    requiredPhrase: 'SPEND op-test',
    envelope: {
      action: 'run-sync',
      operationId: 'op-test',
      cohort: 'smoke-30',
      planSha256: sha256(canonicalJson(digests)),
      recordCount: bodies.length,
      estimatedInputTokens: estimate.inputTokens,
      estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
      estimatedTotalTokens: estimate.totalTokenAllowance,
      estimatedCostUsd: estimate.estimatedCostUsd,
      maxRecords: 30,
      maxEstimatedCostUsd: 5,
      requests: digests.map((bodySha256) => ({
        kind: 'exact' as const,
        method: 'POST' as const,
        path: '/responses',
        bodySha256,
      })),
      maxNetworkRequests: bodies.length,
    },
    estimate,
  })
}

/** Mint a batch-status capability for exactly one batch id. */
function mintStatusCapability(batchId: string): SpendAuthorization {
  const estimate = estimateCohortCost([], { batch: true })
  return mintSpendAuthorization({
    confirmFlagPresent: true,
    interactivePhrase: 'SPEND op-test',
    requiredPhrase: 'SPEND op-test',
    envelope: {
      action: 'batch-status',
      operationId: 'op-test',
      cohort: 'full-corpus',
      planSha256: sha256(canonicalJson({ batchId })),
      recordCount: 0,
      estimatedInputTokens: estimate.inputTokens,
      estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
      estimatedTotalTokens: estimate.totalTokenAllowance,
      estimatedCostUsd: estimate.estimatedCostUsd,
      maxRecords: 1,
      maxEstimatedCostUsd: 0.01,
      requests: [{ kind: 'exact', method: 'GET', path: `/batches/${batchId}`, bodySha256: null }],
      maxNetworkRequests: 1,
    },
    estimate,
  })
}

/** A fetch that fails the test if it is ever reached. Every refusal must open zero sockets. */
function forbiddenFetch(): { implementation: typeof fetch; calls: () => number } {
  let calls = 0
  const implementation = (async () => {
    calls += 1
    throw new Error('fetch must never be reached')
  }) as typeof fetch
  return { implementation, calls: () => calls }
}

const PACKET: UniversalPacket = {
  record_id: 'e'.repeat(64),
  title: 'A synthetic title',
  abstract: null,
  journal: null,
  publication_year: null,
  publication_types: [],
  mesh_terms: [],
  keywords: [],
  language: null,
  evidence_profile: 'metadata_without_abstract',
}

describe('spend authorization capability', () => {
  it('mints only with the flag and the exact phrase', () => {
    expect(() => mintSpendAuthorization(authorizationRequest())).not.toThrow()
    expect(() =>
      mintSpendAuthorization(authorizationRequest({ confirmFlagPresent: false })),
    ).toThrow(SpendAuthorizationError)
    expect(() => mintSpendAuthorization(authorizationRequest({ interactivePhrase: null }))).toThrow(
      /interactively/u,
    )
    expect(() =>
      mintSpendAuthorization(authorizationRequest({ interactivePhrase: 'spend op-test' })),
    ).toThrow(SpendAuthorizationError)
  })

  it('verifies only the genuine capability object; copies and forgeries fail', () => {
    const capability = mint()
    expect(() => assertSpendAuthorized(capability)).not.toThrow()
    expect(() => assertSpendAuthorized({ ...(capability as object) })).toThrow(/forged or copied/u)
    expect(() => assertSpendAuthorized({})).toThrow(SpendAuthorizationError)
    expect(() => assertSpendAuthorized(JSON.parse(JSON.stringify(capability)) as object)).toThrow(
      SpendAuthorizationError,
    )
  })
})

/**
 * LUNA-SPEND-001, part one. Impossible arithmetic cannot mint authority: the original
 * reproductions minted capabilities from negative and NaN costs and record counts.
 */
describe('spend envelope numeric validation (LUNA-SPEND-001)', () => {
  const cases: readonly [string, Partial<SpendEnvelope>, RegExp][] = [
    ['a negative cost', { estimatedCostUsd: -1_000 }, /finite, non-negative/u],
    ['a NaN cost', { estimatedCostUsd: Number.NaN }, /finite, non-negative/u],
    ['an infinite cost', { estimatedCostUsd: Number.POSITIVE_INFINITY }, /finite, non-negative/u],
    ['a negative record count', { recordCount: -50 }, /non-negative safe integer/u],
    ['a NaN record count', { recordCount: Number.NaN }, /non-negative safe integer/u],
    ['an infinite record count', { recordCount: Number.POSITIVE_INFINITY }, /safe integer/u],
    ['a fractional record count', { recordCount: 1.5 }, /safe integer/u],
    ['an unsafe record count', { recordCount: Number.MAX_SAFE_INTEGER + 2 }, /safe integer/u],
    ['a zero record count for a record spend', { recordCount: 0 }, /impossible for a run-sync/u],
    ['an estimate record-count mismatch', { recordCount: 3 }, /records but 3 were authorized/u],
    ['negative token arithmetic', { estimatedInputTokens: -1 }, /non-negative safe integer/u],
    ['a NaN token estimate', { estimatedTotalTokens: Number.NaN }, /non-negative safe integer/u],
    ['token arithmetic that does not reconcile', { estimatedTotalTokens: 1 }, /reconcile/u],
    ['a fractional record ceiling', { maxRecords: 2.5 }, /positive safe integer/u],
    ['a zero record ceiling', { maxRecords: 0 }, /positive safe integer/u],
    ['a NaN cost ceiling', { maxEstimatedCostUsd: Number.NaN }, /finite positive/u],
    [
      'an infinite cost ceiling',
      { maxEstimatedCostUsd: Number.POSITIVE_INFINITY },
      /finite positive/u,
    ],
    ['a zero cost ceiling', { maxEstimatedCostUsd: 0 }, /finite positive/u],
    ['records above the ceiling', { maxRecords: 1 }, /exceeds --max-records/u],
    ['a cost above the ceiling', { maxEstimatedCostUsd: 0.0000001 }, /exceeds --max-estimated/u],
    ['an unknown action', { action: 'run-async' as never }, /unknown action/u],
    ['a malformed operation id', { operationId: 'Op Test' }, /valid operation id/u],
    ['a malformed plan digest', { planSha256: 'not-a-digest' }, /valid plan digest/u],
    ['no authorized requests', { requests: [] }, /at least one network request/u],
  ]

  it.each(cases)('refuses %s', (_label, override, pattern) => {
    const records = 2
    expect(() =>
      mintSpendAuthorization(
        authorizationRequest({ envelope: envelopeFor(records, override) }, records),
      ),
    ).toThrow(pattern)
  })

  it('refuses a token estimate that disagrees with the priced cohort estimate', () => {
    expect(() =>
      mintSpendAuthorization(
        authorizationRequest({
          envelope: envelopeFor(1, { estimatedInputTokens: 7, estimatedTotalTokens: 107 }),
        }),
      ),
    ).toThrow(/disagrees with the cohort estimate/u)
  })

  it('refuses a request slot that is not one digest-bound /responses call per record', () => {
    expect(() =>
      mintSpendAuthorization(
        authorizationRequest({
          envelope: envelopeFor(1, {
            requests: [{ kind: 'exact', method: 'POST', path: '/responses', bodySha256: null }],
          }),
        }),
      ),
    ).toThrow(/digest-bound \/responses/u)
    expect(() =>
      mintSpendAuthorization(
        authorizationRequest({ envelope: envelopeFor(1, { requests: syncSlots(2) }) }),
      ),
    ).toThrow(/exactly one request per record/u)
    expect(() =>
      mintSpendAuthorization(
        authorizationRequest({
          envelope: envelopeFor(1, {
            requests: [
              { kind: 'exact', method: 'POST', path: 'responses', bodySha256: 'a'.repeat(64) },
            ],
          }),
        }),
      ),
    ).toThrow(/malformed path/u)
  })

  it('requires control-plane actions to authorize exactly zero records', () => {
    const estimate = estimateCohortCost([], { batch: true })
    const control = (recordCount: number) =>
      mintSpendAuthorization({
        confirmFlagPresent: true,
        interactivePhrase: 'SPEND op-test',
        requiredPhrase: 'SPEND op-test',
        envelope: {
          action: 'batch-status',
          operationId: 'op-test',
          cohort: 'full-corpus',
          planSha256: sha256(canonicalJson({ batchId: 'batch-1' })),
          recordCount,
          estimatedInputTokens: estimate.inputTokens,
          estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
          estimatedTotalTokens: estimate.totalTokenAllowance,
          estimatedCostUsd: estimate.estimatedCostUsd,
          maxRecords: 1,
          maxEstimatedCostUsd: 0.01,
          requests: [{ kind: 'exact', method: 'GET', path: '/batches/batch-1', bodySha256: null }],
          maxNetworkRequests: 1,
        },
        estimate,
      })
    expect(() => control(0)).not.toThrow()
    expect(() => control(1)).toThrow(/impossible for a batch-status/u)
  })
})

/**
 * LUNA-SPEND-001, part two. The capability binds one action, one operation, one plan, and one
 * bounded request set, and every authorized identity is consumed at most once. The original
 * reproduction reused a single one-record capability for unbounded requests.
 */
describe('exact authorization binding and consumption (LUNA-SPEND-001)', () => {
  const previous = process.env[KEY_ENV]
  beforeEach(() => {
    process.env[KEY_ENV] = 'sk-test-abcdef1234567890'
  })
  afterEach(() => {
    if (previous === undefined) delete process.env[KEY_ENV]
    else process.env[KEY_ENV] = previous
  })

  it('refuses a wrong action, operation, or plan digest', () => {
    const capability = mint(1)
    expect(() =>
      assertSpendEnvelope(capability, {
        action: 'batch-submit',
        operationId: 'op-test',
        planSha256: syncPlanSha256(1),
      }),
    ).toThrow(/authorizes run-sync, not batch-submit/u)
    expect(() =>
      assertSpendEnvelope(capability, {
        action: 'run-sync',
        operationId: 'op-other',
        planSha256: syncPlanSha256(1),
      }),
    ).toThrow(/different operation/u)
    expect(() =>
      assertSpendEnvelope(capability, {
        action: 'run-sync',
        operationId: 'op-test',
        planSha256: syncPlanSha256(2),
      }),
    ).toThrow(/plan digest changed/u)
    expect(
      assertSpendEnvelope(capability, {
        action: 'run-sync',
        operationId: 'op-test',
        planSha256: syncPlanSha256(1),
      }).recordCount,
    ).toBe(1)
  })

  it('refuses changed request bytes before any socket opens', async () => {
    const capability = mint(1)
    const socket = forbiddenFetch()
    await expect(
      executeOpenAiRequest({
        method: 'POST',
        path: '/responses',
        jsonBody: { ...syncBody(0), input: 'tampered' },
        authorization: capability,
        fetchImplementation: socket.implementation,
      }),
    ).rejects.toThrow(/not part of what the owner authorized/u)
    expect(socket.calls()).toBe(0)
    expect(remainingNetworkBudget(capability)).toBe(1)
  })

  it('refuses a foreign path or method before any socket opens', async () => {
    const capability = mint(1)
    const socket = forbiddenFetch()
    for (const options of [
      { method: 'POST' as const, path: '/batches', jsonBody: syncBody(0) },
      { method: 'GET' as const, path: '/responses' },
      { method: 'GET' as const, path: '/files/file-1/content' },
    ]) {
      await expect(
        executeOpenAiRequest({
          ...options,
          authorization: capability,
          fetchImplementation: socket.implementation,
        }),
      ).rejects.toThrow(SpendAuthorizationError)
    }
    expect(socket.calls()).toBe(0)
  })

  it('refuses copied, spread, and recreated capabilities before any socket opens', async () => {
    const capability = mint(1)
    const socket = forbiddenFetch()
    const impostors: SpendAuthorization[] = [
      { ...(capability as object) },
      Object.assign(Object.create(null) as object, capability),
      Object.create(capability as object) as object,
      JSON.parse(JSON.stringify(capability)) as object,
      Object.freeze({}),
    ]
    for (const impostor of impostors) {
      await expect(
        executeOpenAiRequest({
          method: 'POST',
          path: '/responses',
          jsonBody: syncBody(0),
          authorization: impostor,
          fetchImplementation: socket.implementation,
        }),
      ).rejects.toThrow(/forged or copied/u)
    }
    expect(socket.calls()).toBe(0)
  })

  it('consumes each authorized request exactly once and then refuses', async () => {
    const capability = mint(1)
    let calls = 0
    const ok = (async () => {
      calls += 1
      return new Response('{"ok":true}', { status: 200 })
    }) as typeof fetch
    await executeOpenAiRequest({
      method: 'POST',
      path: '/responses',
      jsonBody: syncBody(0),
      authorization: capability,
      fetchImplementation: ok,
    })
    expect(calls).toBe(1)
    expect(remainingNetworkBudget(capability)).toBe(0)
    const socket = forbiddenFetch()
    await expect(
      executeOpenAiRequest({
        method: 'POST',
        path: '/responses',
        jsonBody: syncBody(0),
        authorization: capability,
        fetchImplementation: socket.implementation,
      }),
    ).rejects.toThrow(/budget is exhausted/u)
    expect(socket.calls()).toBe(0)
  })

  it('spends an exact bounded multi-request sequence and stops at the budget', async () => {
    const capability = mint(3)
    let calls = 0
    const ok = (async () => {
      calls += 1
      return new Response('{"ok":true}', { status: 200 })
    }) as typeof fetch
    for (let index = 0; index < 3; index += 1) {
      await executeOpenAiRequest({
        method: 'POST',
        path: '/responses',
        jsonBody: syncBody(index),
        authorization: capability,
        fetchImplementation: ok,
      })
    }
    expect(calls).toBe(3)
    expect(remainingNetworkBudget(capability)).toBe(0)
    const socket = forbiddenFetch()
    await expect(
      executeOpenAiRequest({
        method: 'POST',
        path: '/responses',
        jsonBody: syncBody(1),
        authorization: capability,
        fetchImplementation: socket.implementation,
      }),
    ).rejects.toThrow(/budget is exhausted/u)
    expect(socket.calls()).toBe(0)
  })

  it('bounds derived file fetches and refuses an unsafe derived segment', () => {
    const estimate = estimateCohortCost([], { batch: true })
    const capability = mintSpendAuthorization({
      confirmFlagPresent: true,
      interactivePhrase: 'SPEND op-test',
      requiredPhrase: 'SPEND op-test',
      envelope: {
        action: 'batch-fetch',
        operationId: 'op-test',
        cohort: 'full-corpus',
        planSha256: sha256(canonicalJson({ batchId: 'batch-1' })),
        recordCount: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokenAllowance: 0,
        estimatedTotalTokens: 0,
        estimatedCostUsd: 0,
        maxRecords: 1,
        maxEstimatedCostUsd: 0.01,
        requests: [
          { kind: 'exact', method: 'GET', path: '/batches/batch-1', bodySha256: null },
          {
            kind: 'derived',
            method: 'GET',
            pathPrefix: '/files/',
            pathSuffix: '/content',
            maxUses: 2,
          },
        ],
        maxNetworkRequests: 3,
      },
      estimate,
    })
    expect(remainingNetworkBudget(capability)).toBe(3)
    expect(() =>
      consumeAuthorizedRequest(capability, {
        method: 'GET',
        path: '/files/../batches/batch-1/content',
        bodySha256: null,
      }),
    ).toThrow(/not part of what the owner authorized/u)
    consumeAuthorizedRequest(capability, {
      method: 'GET',
      path: '/files/file-out/content',
      bodySha256: null,
    })
    consumeAuthorizedRequest(capability, {
      method: 'GET',
      path: '/files/file-err/content',
      bodySha256: null,
    })
    expect(() =>
      consumeAuthorizedRequest(capability, {
        method: 'GET',
        path: '/files/file-third/content',
        bodySha256: null,
      }),
    ).toThrow(/not part of what the owner authorized/u)
  })
})

describe('secret redaction', () => {
  const previous = process.env[KEY_ENV]
  afterEach(() => {
    if (previous === undefined) delete process.env[KEY_ENV]
    else process.env[KEY_ENV] = previous
  })

  it('scrubs the live key value and sk-/Bearer shapes', () => {
    process.env[KEY_ENV] = 'sk-test-abcdef1234567890'
    expect(redactOpenAiSecrets('failed with sk-test-abcdef1234567890')).not.toContain(
      'sk-test-abcdef1234567890',
    )
    expect(redactOpenAiSecrets('Authorization: Bearer sk-other-9876543210abcdef')).not.toMatch(
      /sk-other/u,
    )
    expect(redactOpenAiSecrets(new Error('sk-abcdefgh12345678 exploded'))).toContain('[redacted]')
  })
})

describe('request building', () => {
  it('builds a strict json_schema Responses request with no tools and no storage', () => {
    const body = buildStageARequestBody(PACKET, {
      model: 'gpt-5.6-luna',
      reasoning: 'low',
      instructions: 'INSTRUCTIONS',
    })
    expect(body.model).toBe('gpt-5.6-luna')
    expect(body.store).toBe(false)
    expect(body.tools).toEqual([])
    const text = body.text as { format: { type: string; strict: boolean; schema: unknown } }
    expect(text.format.type).toBe('json_schema')
    expect(text.format.strict).toBe(true)
    const schema = buildStageAJsonSchema()
    expect(schema.additionalProperties).toBe(false)
    expect((schema.required as string[]).sort()).toEqual([
      'confidence_band',
      'reason_codes',
      'record_id',
      'triage_decision',
    ])
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('pmid')
    expect(serialized).not.toContain('physician')
  })
})

describe('the single socket', () => {
  const previous = process.env[KEY_ENV]
  afterEach(() => {
    if (previous === undefined) delete process.env[KEY_ENV]
    else process.env[KEY_ENV] = previous
  })

  it('refuses without a verified capability, before any socket work', async () => {
    const socket = forbiddenFetch()
    await expect(
      executeOpenAiRequest({
        method: 'GET',
        path: '/batches/x',
        authorization: {},
        fetchImplementation: socket.implementation,
      }),
    ).rejects.toThrow(/forged or copied/u)
    expect(socket.calls()).toBe(0)
  })

  it('refuses when OPENAI_API_KEY is unset, after consuming nothing that reaches a socket', async () => {
    delete process.env[KEY_ENV]
    const socket = forbiddenFetch()
    await expect(
      executeOpenAiRequest({
        method: 'GET',
        path: '/batches/x',
        authorization: mintStatusCapability('x'),
        fetchImplementation: socket.implementation,
      }),
    ).rejects.toThrow(/OPENAI_API_KEY/u)
    expect(socket.calls()).toBe(0)
  })

  it('sends the key only as a header, never retries, and redacts error bodies', async () => {
    process.env[KEY_ENV] = 'sk-live-abcdef1234567890'
    const first = { model: 'gpt-5.6-luna' }
    const second = { model: 'gpt-5.6-luna', input: [] as unknown[] }
    const capability = mintForBodies([first, second])
    let calls = 0
    let seenAuthorization: string | null = null
    await expect(
      executeOpenAiRequest({
        method: 'POST',
        path: '/responses',
        jsonBody: first,
        authorization: capability,
        fetchImplementation: (async (_url: unknown, init?: RequestInit) => {
          calls += 1
          seenAuthorization = (init?.headers as Record<string, string>).authorization
          return new Response('boom sk-live-abcdef1234567890', { status: 500 })
        }) as typeof fetch,
      }),
    ).rejects.toThrow(/HTTP 500/u)
    expect(calls).toBe(1)
    expect(seenAuthorization).toBe('Bearer sk-live-abcdef1234567890')
    try {
      await executeOpenAiRequest({
        method: 'POST',
        path: '/responses',
        jsonBody: second,
        authorization: capability,
        fetchImplementation: (async () =>
          new Response('again sk-live-abcdef1234567890', { status: 400 })) as typeof fetch,
      })
    } catch (error) {
      expect(String(error)).not.toContain('sk-live-abcdef1234567890')
    }
    // A failed request still consumes its authorized identity: no retry, no second attempt.
    expect(remainingNetworkBudget(capability)).toBe(0)
  })

  it('returns the raw body text and its hash on success', async () => {
    process.env[KEY_ENV] = 'sk-live-abcdef1234567890'
    const result = await executeOpenAiRequest({
      method: 'GET',
      path: '/batches/b1',
      authorization: mintStatusCapability('b1'),
      fetchImplementation: (async () =>
        new Response('{"id":"b1","status":"completed"}', { status: 200 })) as typeof fetch,
    })
    expect(result.status).toBe(200)
    expect(result.bodyText).toContain('"b1"')
    expect(result.bodySha256).toMatch(/^[0-9a-f]{64}$/u)
  })
})
