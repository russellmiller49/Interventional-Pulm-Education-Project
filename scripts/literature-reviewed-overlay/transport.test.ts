/** @jest-environment node */

import type { DestinationBinding } from '../literature-production-ingest/types'
import {
  OverlayMutationAmbiguousError,
  OverlayMutationConfirmedFailureError,
  OverlayReadError,
  PostgrestOverlayTransport,
} from './transport'

const SECRET = 'sb_secret_test_only_value'
const BINDING: DestinationBinding = {
  url: 'https://itcttmkxdxvwmwcmzmey.supabase.co/',
  projectRef: 'itcttmkxdxvwmwcmzmey',
  secret: SECRET,
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}

describe('PostgrestOverlayTransport construction', () => {
  it('refuses a non-approved destination and the Endoreels project', () => {
    expect(
      () =>
        new PostgrestOverlayTransport({
          binding: { ...BINDING, projectRef: 'tqnhxlwvkkswuckszlee' } as DestinationBinding,
        }),
    ).toThrow(/outside the approved project/u)
    expect(
      () =>
        new PostgrestOverlayTransport({
          binding: {
            ...BINDING,
            url: 'https://tqnhxlwvkkswuckszlee.supabase.co/',
          } as DestinationBinding,
        }),
    ).toThrow(/outside the approved project/u)
  })

  it('refuses a non-secret credential class', () => {
    expect(
      () =>
        new PostgrestOverlayTransport({
          binding: { ...BINDING, secret: 'sb_publishable_nope' } as DestinationBinding,
        }),
    ).toThrow(/non-secret credential class/u)
    expect(
      () =>
        new PostgrestOverlayTransport({
          binding: { ...BINDING, secret: 'eyJa.eyJb.c' } as DestinationBinding,
        }),
    ).toThrow(/non-secret credential class/u)
  })
})

describe('request discipline', () => {
  it('sends the secret only in headers, POSTs bodies, and keeps URLs parameter-free', async () => {
    const seen: Array<{ url: string; method: string; headers: Record<string, string> }> = []
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async (input, init) => {
        seen.push({
          url: String(input),
          method: String(init?.method),
          headers: { ...(init?.headers as Record<string, string>) },
        })
        return jsonResponse({ ok: true })
      },
    })
    await transport.applyBatch('{}')
    await transport.observe('{"operationId":"x","pmids":["36879724"],"eventIds":[]}')
    expect(seen[0]?.url).toBe(
      'https://itcttmkxdxvwmwcmzmey.supabase.co/rest/v1/rpc/apply_literature_reviewed_overlay_batch_v1',
    )
    expect(seen[1]?.url).toBe(
      'https://itcttmkxdxvwmwcmzmey.supabase.co/rest/v1/rpc/observe_literature_reviewed_overlay_v1',
    )
    for (const request of seen) {
      expect(request.method).toBe('POST')
      expect(request.url).not.toContain('?')
      // No identifier from the request body may reach the URL.
      expect(request.url).not.toContain('36879724')
      expect(request.headers.apikey).toBe(SECRET)
      expect(request.url).not.toContain(SECRET)
    }
  })
})

describe('applyBatch error taxonomy', () => {
  it('classifies a 4xx as confirmed without exposing the response body', async () => {
    const leakedBody = { message: `refusal mentioning ${SECRET} and 36879724` }
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => jsonResponse(leakedBody, 400),
    })
    let caught: unknown
    try {
      await transport.applyBatch('{}')
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(OverlayMutationConfirmedFailureError)
    const message = (caught as Error).message
    expect(message).toContain('status 400')
    expect(message).toContain('body digest')
    expect(message).not.toContain(SECRET)
    expect(message).not.toContain('36879724')
    expect(message).not.toContain('refusal mentioning')
  })

  it.each([
    [408, 'request_timeout'],
    [500, 'server_error'],
    [503, 'server_error'],
  ])('classifies HTTP %s as ambiguous %s', async (status, code) => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => jsonResponse({}, status),
    })
    let caught: unknown
    try {
      await transport.applyBatch('{}')
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(OverlayMutationAmbiguousError)
    expect((caught as OverlayMutationAmbiguousError).code).toBe(code)
  })

  it('classifies a transport exception as ambiguous with the secret redacted', async () => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => {
        throw new Error(`socket reset while sending ${SECRET}`)
      },
    })
    let caught: unknown
    try {
      await transport.applyBatch('{}')
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(OverlayMutationAmbiguousError)
    expect((caught as OverlayMutationAmbiguousError).code).toBe('transport_exception')
    expect((caught as Error).message).not.toContain(SECRET)
  })

  it('classifies an unparseable acknowledgement as ambiguous', async () => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => new Response('not json', { status: 200 }),
    })
    let caught: unknown
    try {
      await transport.applyBatch('{}')
    } catch (error) {
      caught = error
    }
    expect((caught as OverlayMutationAmbiguousError).code).toBe('malformed_acknowledgement')
  })
})

describe('observe error taxonomy', () => {
  it('returns the parsed observation object', async () => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () =>
        jsonResponse({ operation: null, totals: {}, articles: [], events: [] }),
    })
    await expect(transport.observe('{}')).resolves.toMatchObject({ operation: null })
  })

  it('rejects non-2xx without exposing the response body', async () => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => jsonResponse({ message: `secret ${SECRET}` }, 404),
    })
    let caught: unknown
    try {
      await transport.observe('{}')
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(OverlayReadError)
    expect((caught as OverlayReadError).code).toBe('read_rejected')
    expect((caught as Error).message).toContain('status 404')
    expect((caught as Error).message).not.toContain(SECRET)
  })

  it('rejects a non-object observation body', async () => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => jsonResponse([1, 2, 3]),
    })
    await expect(transport.observe('{}')).rejects.toThrow(/not a JSON object/u)
  })
})
