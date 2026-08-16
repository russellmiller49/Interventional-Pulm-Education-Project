import { APPROVED_PROJECT_REF, APPROVED_PROJECT_URL } from './constants'
import { fixtureEnvelope, fixtureMapper } from './test-fixtures'
import {
  MutationAmbiguousError,
  MutationConfirmedFailureError,
  PostgrestTransport,
} from './transport'
import type { DestinationBinding } from './types'

const SECRET = 'sb_secret_EXAMPLE_TRANSPORT_TEST_NOT_A_CREDENTIAL'

function binding(overrides: Partial<DestinationBinding> = {}): DestinationBinding {
  return {
    url: APPROVED_PROJECT_URL,
    projectRef: APPROVED_PROJECT_REF,
    secret: SECRET,
    ...overrides,
  }
}

function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: jest.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  } as unknown as Response
}

type SimpleFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type MockFetch = jest.MockedFunction<SimpleFetch> & typeof fetch

function fetchMock(implementation?: SimpleFetch): MockFetch {
  const fallback: SimpleFetch = async () => {
    throw new Error('Unexpected fetch call.')
  }
  return jest.fn(implementation ?? fallback) as unknown as MockFetch
}

describe('PostgrestTransport binding and read operations', () => {
  it('revalidates the exact dedicated binding before constructing a client', () => {
    expect(
      () => new PostgrestTransport(binding({ url: 'https://tqnhxlwvkkswuckszlee.supabase.co/' })),
    ).toThrow(/Endoreels|approved|IP_Literature/iu)
    expect(
      () => new PostgrestTransport(binding({ secret: 'sb_publishable_EXAMPLE_BROWSER_KEY' })),
    ).toThrow(/server-side secret/iu)
  })

  it('performs exact HEAD counts and generic GET reads without mutation methods', async () => {
    const fetchImpl = fetchMock()
      .mockResolvedValueOnce(mockResponse('', 200, { 'content-range': '0-0/25' }))
      .mockResolvedValueOnce(mockResponse([{ id: 'batch-a', status: 'completed' }]))
    const transport = new PostgrestTransport(binding(), { fetchImpl })

    await expect(transport.countArticles()).resolves.toBe(25)
    await expect(
      transport.readRows('literature_import_batches', {
        query: { select: 'id,status', limit: 1 },
      }),
    ).resolves.toEqual([{ id: 'batch-a', status: 'completed' }])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][1]?.method).toBe('HEAD')
    expect(fetchImpl.mock.calls[1][1]?.method).toBe('GET')
    const headers = new Headers(fetchImpl.mock.calls[1][1]?.headers)
    expect(headers.get('apikey')).toBe(SECRET)
    expect(headers.has('authorization')).toBe(false)
    expect(fetchImpl.mock.calls.flatMap((call) => [call[1]?.method])).not.toContain('DELETE')
  })

  it('requires an exact Content-Range and never retries malformed reads', async () => {
    const fetchImpl = fetchMock(async () => mockResponse('', 200))
    const transport = new PostgrestTransport(binding(), { fetchImpl })
    await expect(transport.countArticles()).rejects.toMatchObject({
      code: 'count_malformed_response',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('bounds read requests with an abort timeout', async () => {
    const fetchImpl = fetchMock(
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        }),
    )
    const transport = new PostgrestTransport(binding(), { fetchImpl, requestTimeoutMs: 5 })
    await expect(
      transport.readRows('literature_articles', { query: { select: 'pmid' } }),
    ).rejects.toMatchObject({ code: 'read_timeout' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not expose read capability outside the four ingestion tables', async () => {
    const fetchImpl = fetchMock(async () => mockResponse([]))
    const transport = new PostgrestTransport(binding(), { fetchImpl })
    await expect(transport.readRows('literature_topics' as never)).rejects.toThrow(
      /foundation Literature tables/iu,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('single-attempt exact mutation acknowledgements', () => {
  it('accepts an exact row set independent of response ordering', async () => {
    const expected = [
      { id: 'journal-a', registry_version: 'v1' },
      { id: 'journal-b', registry_version: 'v1' },
    ]
    const fetchImpl = fetchMock(async () => mockResponse([...expected].reverse(), 201))
    const transport = new PostgrestTransport(binding(), { fetchImpl })

    await expect(
      transport.mutateExact({
        operation: 'fixture_upsert',
        method: 'POST',
        table: 'literature_journals',
        body: expected,
        expectedRows: expected,
        identityColumns: ['id'],
      }),
    ).resolves.toEqual([...expected].reverse())
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'error' })
  })

  it('has no runtime DELETE path even if a caller bypasses TypeScript', async () => {
    const fetchImpl = fetchMock(async () => mockResponse([]))
    const transport = new PostgrestTransport(binding(), { fetchImpl })
    await expect(
      transport.mutateExact({
        operation: 'forbidden_delete',
        method: 'DELETE',
        table: 'literature_articles',
        body: { pmid: '10000001' },
        expectedRows: [{ pmid: '10000001' }],
        identityColumns: ['pmid'],
      } as never),
    ).rejects.toThrow(/only POST and PATCH/iu)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['thrown transport error', async () => Promise.reject(new Error(SECRET)), null],
    ['HTTP 408', async () => mockResponse('timeout', 408), 'request_timeout'],
    ['HTTP 500', async () => mockResponse('server body', 500), 'server_error'],
    ['malformed 200 body', async () => mockResponse('not-json', 200), 'malformed_acknowledgement'],
    [
      'mismatched 200 body',
      async () => mockResponse([{ id: 'different' }], 200),
      'acknowledgement_mismatch',
    ],
  ])('classifies %s as ambiguous without retry', async (_label, implementation, code) => {
    const fetchImpl = fetchMock(implementation)
    const transport = new PostgrestTransport(binding(), { fetchImpl })
    let captured: unknown
    try {
      await transport.mutateExact({
        operation: 'fixture_mutation',
        method: 'POST',
        table: 'literature_journals',
        body: [{ id: 'journal-a' }],
        expectedRows: [{ id: 'journal-a' }],
        identityColumns: ['id'],
      })
    } catch (error) {
      captured = error
    }

    expect(captured).toBeInstanceOf(MutationAmbiguousError)
    expect(captured).toMatchObject({ outcome: 'ambiguous' })
    if (code) expect(captured).toMatchObject({ code })
    expect(String(captured)).not.toContain(SECRET)
    expect(JSON.stringify(captured)).not.toContain(SECRET)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it.each([400, 401, 403, 409, 422, 429])(
    'classifies ordinary HTTP %i as a confirmed failure without reading or retrying the body',
    async (status) => {
      const response = mockResponse(`body containing ${SECRET}`, status)
      const fetchImpl = fetchMock(async () => response)
      const transport = new PostgrestTransport(binding(), { fetchImpl })

      await expect(
        transport.mutateExact({
          operation: 'fixture_mutation',
          method: 'PATCH',
          table: 'literature_import_batches',
          body: { status: 'completed' },
          expectedRows: [{ id: 'batch-a', status: 'completed' }],
          identityColumns: ['id'],
        }),
      ).rejects.toBeInstanceOf(MutationConfirmedFailureError)
      expect(response.text).not.toHaveBeenCalled()
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    },
  )

  it('classifies an AbortController timeout as ambiguous and does not retry', async () => {
    const fetchImpl = fetchMock(
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        }),
    )
    const transport = new PostgrestTransport(binding(), { fetchImpl, requestTimeoutMs: 5 })
    await expect(
      transport.mutateExact({
        operation: 'fixture_mutation',
        method: 'POST',
        table: 'literature_articles',
        body: [{ pmid: '10000001' }],
        expectedRows: [{ pmid: '10000001' }],
        identityColumns: ['pmid'],
      }),
    ).rejects.toMatchObject({ outcome: 'ambiguous', code: 'request_timeout' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('upserts articles through the exact safe-state acknowledgement projection', async () => {
    const article = fixtureMapper('batch-fixture', 'canary')(fixtureEnvelope('10000001')).article
    const acknowledgement = [
      {
        pmid: article.pmid,
        metadata_hash: article.metadata_hash,
        relevance_state: 'unreviewed',
        visibility_state: 'draft',
        manual_override: false,
        is_landmark: false,
        curation_reason: null,
        classifier_version: null,
        classifier_payload: null,
      },
    ]
    const fetchImpl = fetchMock(async () => mockResponse(acknowledgement, 201))
    const transport = new PostgrestTransport(binding(), { fetchImpl })

    await expect(transport.upsertArticles([article])).resolves.toEqual(acknowledgement)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/literature_articles')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual([article])
    expect(init?.method).not.toBe('DELETE')
  })

  it('exactly acknowledges stable import-batch fields without comparing normalized timestamps', async () => {
    const createRow = {
      id: 'batch-a',
      status: 'started',
      started_at: '2026-08-15T12:00:00.000Z',
      completed_at: null,
      report: { operation_id: 'batch-a' },
    }
    const createAcknowledgement = {
      id: createRow.id,
      status: createRow.status,
      report: createRow.report,
    }
    const completionPatch = {
      status: 'completed',
      completed_at: '2026-08-15T12:01:00.000Z',
      report: { operation_id: 'batch-a', batch_checksums: ['a'.repeat(64)] },
    }
    const completionAcknowledgement = {
      id: createRow.id,
      status: completionPatch.status,
      report: completionPatch.report,
    }
    const fetchImpl = fetchMock()
      .mockResolvedValueOnce(mockResponse([createAcknowledgement], 201))
      .mockResolvedValueOnce(mockResponse([completionAcknowledgement], 200))
    const transport = new PostgrestTransport(binding(), { fetchImpl })

    await expect(transport.createImportBatch(createRow)).resolves.toEqual(createAcknowledgement)
    await expect(transport.completeImportBatch(createRow.id, completionPatch)).resolves.toEqual(
      completionAcknowledgement,
    )

    const createUrl = new URL(String(fetchImpl.mock.calls[0][0]))
    const completionUrl = new URL(String(fetchImpl.mock.calls[1][0]))
    expect(createUrl.searchParams.get('select')).toBe('id,report,status')
    expect(completionUrl.searchParams.get('select')).toBe('id,report,status')
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual([createRow])
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual(completionPatch)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
