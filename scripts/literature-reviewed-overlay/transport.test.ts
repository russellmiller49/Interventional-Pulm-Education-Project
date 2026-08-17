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

describe('applyBatch', () => {
  it('sends the secret only in headers to the approved origin', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = []
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async (input, init) => {
        seen.push({
          url: String(input),
          headers: { ...(init?.headers as Record<string, string>) },
        })
        return jsonResponse({ ok: true })
      },
    })
    await transport.applyBatch('{}')
    expect(seen[0]?.url).toBe(
      'https://itcttmkxdxvwmwcmzmey.supabase.co/rest/v1/rpc/apply_literature_reviewed_overlay_batch_v1',
    )
    expect(seen[0]?.headers.apikey).toBe(SECRET)
    expect(seen[0]?.url).not.toContain(SECRET)
  })

  it('classifies a 4xx as a confirmed rejection with the secret redacted', async () => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => jsonResponse({ message: `bad ${SECRET}` }, 400),
    })
    let caught: unknown
    try {
      await transport.applyBatch('{}')
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(OverlayMutationConfirmedFailureError)
    expect((caught as Error).message).not.toContain(SECRET)
    expect((caught as Error).message).toContain('[redacted]')
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

  it('classifies a transport exception as ambiguous, never confirmed', async () => {
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

describe('read-only surface', () => {
  it('refuses a relation outside the allowlist', async () => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => jsonResponse([]),
    })
    await expect(
      transport.readRows('literature_import_batches' as never, { query: 'select=id' }),
    ).rejects.toThrow(/may not read that relation/u)
    await expect(
      transport.countRows('literature_gold_set_items' as never, 'select=id'),
    ).rejects.toThrow(/may not read that relation/u)
  })

  it('parses an exact count and refuses an uncounted response', async () => {
    const counted = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () =>
        new Response(null, { status: 206, headers: { 'content-range': '0-0/630' } }),
    })
    await expect(counted.countRows('literature_articles', 'select=pmid')).resolves.toBe(630)

    const uncounted = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () =>
        new Response(null, { status: 206, headers: { 'content-range': '0-0/*' } }),
    })
    await expect(uncounted.countRows('literature_articles', 'select=pmid')).rejects.toThrow(
      OverlayReadError,
    )
  })

  it('refuses a non-array read body', async () => {
    const transport = new PostgrestOverlayTransport({
      binding: BINDING,
      fetchImplementation: async () => jsonResponse({ not: 'an array' }),
    })
    await expect(
      transport.readRows('literature_articles', { query: 'select=pmid' }),
    ).rejects.toThrow(/not an array/u)
  })
})
