/** @jest-environment node */
import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { estimateCohortCost } from './estimate'
import {
  SpendAuthorizationError,
  assertSpendAuthorized,
  buildStageAJsonSchema,
  buildStageARequestBody,
  executeOpenAiRequest,
  mintSpendAuthorization,
  redactOpenAiSecrets,
  type SpendAuthorizationRequest,
} from './openai'

const KEY_ENV = 'OPENAI_API_KEY'

function authorizationRequest(
  overrides: Partial<SpendAuthorizationRequest> = {},
): SpendAuthorizationRequest {
  return {
    confirmFlagPresent: true,
    interactivePhrase: 'SPEND op-test',
    requiredPhrase: 'SPEND op-test',
    operationId: 'op-test',
    cohort: 'smoke-30',
    recordCount: 30,
    maxRecords: 30,
    maxEstimatedCostUsd: 5,
    estimate: estimateCohortCost([{ inputTokens: 1_000, outputTokenAllowance: 100 }], {
      batch: false,
    }),
    ...overrides,
  }
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
  it('mints only with the flag, the exact phrase, and satisfied ceilings', () => {
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
    expect(() => mintSpendAuthorization(authorizationRequest({ recordCount: 31 }))).toThrow(
      /max-records/u,
    )
    expect(() =>
      mintSpendAuthorization(authorizationRequest({ maxEstimatedCostUsd: 0.0000001 })),
    ).toThrow(/max-estimated-cost-usd/u)
  })

  it('verifies only the genuine capability object; copies and forgeries fail', () => {
    const capability = mintSpendAuthorization(authorizationRequest())
    expect(() => assertSpendAuthorized(capability)).not.toThrow()
    expect(() => assertSpendAuthorized({ ...(capability as object) })).toThrow(/forged or copied/u)
    expect(() => assertSpendAuthorized({})).toThrow(SpendAuthorizationError)
    expect(() => assertSpendAuthorized(JSON.parse(JSON.stringify(capability)) as object)).toThrow(
      SpendAuthorizationError,
    )
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
    await expect(
      executeOpenAiRequest({
        method: 'GET',
        path: '/batches/x',
        authorization: {},
        fetchImplementation: () => {
          throw new Error('fetch must never be reached')
        },
      }),
    ).rejects.toThrow(/forged or copied/u)
  })

  it('refuses when OPENAI_API_KEY is unset', async () => {
    delete process.env[KEY_ENV]
    const capability = mintSpendAuthorization(authorizationRequest())
    await expect(
      executeOpenAiRequest({
        method: 'GET',
        path: '/batches/x',
        authorization: capability,
        fetchImplementation: () => {
          throw new Error('fetch must never be reached')
        },
      }),
    ).rejects.toThrow(/OPENAI_API_KEY/u)
  })

  it('sends the key only as a header, never retries, and redacts error bodies', async () => {
    process.env[KEY_ENV] = 'sk-live-abcdef1234567890'
    const capability = mintSpendAuthorization(authorizationRequest())
    let calls = 0
    let seenAuthorization: string | null = null
    await expect(
      executeOpenAiRequest({
        method: 'POST',
        path: '/responses',
        jsonBody: { model: 'gpt-5.6-luna' },
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
        jsonBody: {},
        authorization: capability,
        fetchImplementation: (async () =>
          new Response('again sk-live-abcdef1234567890', { status: 400 })) as typeof fetch,
      })
    } catch (error) {
      expect(String(error)).not.toContain('sk-live-abcdef1234567890')
    }
  })

  it('returns the raw body text and its hash on success', async () => {
    process.env[KEY_ENV] = 'sk-live-abcdef1234567890'
    const capability = mintSpendAuthorization(authorizationRequest())
    const result = await executeOpenAiRequest({
      method: 'GET',
      path: '/batches/b1',
      authorization: capability,
      fetchImplementation: (async () =>
        new Response('{"id":"b1","status":"completed"}', { status: 200 })) as typeof fetch,
    })
    expect(result.status).toBe(200)
    expect(result.bodyText).toContain('"b1"')
    expect(result.bodySha256).toMatch(/^[0-9a-f]{64}$/u)
  })
})
