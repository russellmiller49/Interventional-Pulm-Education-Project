/** @jest-environment node */

/**
 * "This tool is read-only" has to be a property, not a promise.
 *
 * These tests establish it two ways. The first is exhaustive: every HTTP method that is not `GET`
 * or `HEAD` is refused, and the refusal happens before `fetch` is reached — a spy that is never
 * called is the evidence. The second is a source scan, which catches the thing type-checking
 * cannot: a future edit that adds a mutating call somewhere else in the package and never goes
 * near this module.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createAnonymousTransport } from './lib/collect'
import {
  FORBIDDEN_RPCS,
  PERMITTED_READ_ONLY_RPCS,
  createReadOnlyTransport,
  evaluateReadOnlyRequest,
  parseExactCount,
} from './lib/read-only-transport'

const ORIGIN = 'https://itcttmkxdxvwmwcmzmey.supabase.co/'
const ROOT = process.cwd()

function respondWith(status: number, body: string, headers: Record<string, string> = {}) {
  return jest.fn(async () => new Response(body, { status, headers }))
}

describe('only read methods are issued', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'])('refuses %s', (method) => {
    const refusal = evaluateReadOnlyRequest({ method, path: '/rest/v1/literature_articles' })
    expect(refusal?.reason).toBe('method_not_read_only')
  })

  it.each(['GET', 'HEAD'])('permits %s', (method) => {
    expect(evaluateReadOnlyRequest({ method, path: '/rest/v1/literature_articles' })).toBeNull()
  })

  it('refuses before reaching fetch, so no request leaves the process', async () => {
    const spy = respondWith(200, '[]')
    const transport = createReadOnlyTransport({
      origin: ORIGIN,
      credential: null,
      fetchImplementation: spy as unknown as typeof fetch,
    })
    // The type forbids it; the cast is what a future bug would look like.
    const result = await transport.request({
      method: 'DELETE' as 'GET',
      path: '/rest/v1/literature_articles',
    })
    expect(result.outcome).toBe('refused')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('mutating RPCs are unreachable', () => {
  it.each(FORBIDDEN_RPCS)('refuses %s by name', (name) => {
    expect(evaluateReadOnlyRequest({ method: 'GET', path: `/rest/v1/rpc/${name}` })?.reason).toBe(
      'rpc_forbidden',
    )
  })

  it('refuses an RPC that is on neither list', () => {
    expect(
      evaluateReadOnlyRequest({ method: 'GET', path: '/rest/v1/rpc/some_future_rpc' })?.reason,
    ).toBe('rpc_not_permitted')
  })

  it.each(PERMITTED_READ_ONLY_RPCS)('permits the read-only RPC %s', (name) => {
    expect(evaluateReadOnlyRequest({ method: 'GET', path: `/rest/v1/rpc/${name}` })).toBeNull()
  })

  it('never lists a permitted RPC as forbidden', () => {
    // Overlap would make the allowlist meaningless, and the order of the two checks would decide
    // which rule won — which is exactly the sort of thing nobody notices until it matters.
    expect(PERMITTED_READ_ONLY_RPCS.filter((name) => FORBIDDEN_RPCS.includes(name))).toEqual([])
  })
})

describe('requests are shaped correctly', () => {
  it('sends no body and follows no redirect', async () => {
    const spy = respondWith(200, '[]')
    const transport = createReadOnlyTransport({
      origin: ORIGIN,
      credential: 'sb_secret_TESTONLYaaaaaaaaaaaaaaaaaaaa',
      fetchImplementation: spy as unknown as typeof fetch,
    })
    await transport.request({ method: 'GET', path: '/rest/v1/literature_articles' })

    const [, init] = spy.mock.calls[0] as unknown as [URL, RequestInit]
    expect(init.body).toBeUndefined()
    expect(init.method).toBe('GET')
    // Manual redirect handling: a 3xx to another host must not silently carry the credential there.
    expect(init.redirect).toBe('manual')
  })

  it('puts the credential in headers and never in the URL', async () => {
    const credential = 'sb_secret_TESTONLYaaaaaaaaaaaaaaaaaaaa'
    const spy = respondWith(200, '[]')
    const transport = createReadOnlyTransport({
      origin: ORIGIN,
      credential,
      fetchImplementation: spy as unknown as typeof fetch,
    })
    await transport.request({ method: 'GET', path: '/rest/v1/literature_articles' })

    const [url, init] = spy.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).not.toContain('TESTONLY')
    expect((init.headers as Record<string, string>).apikey).toBe(credential)
  })

  it('refuses a path outside the REST namespace', () => {
    expect(evaluateReadOnlyRequest({ method: 'GET', path: '/pg/query' })?.reason).toBe(
      'path_outside_rest_namespace',
    )
  })
})

describe('an uncounted response is not zero', () => {
  it('returns the total when the server counted', () => {
    expect(parseExactCount('*/25')).toBe(25)
    expect(parseExactCount('0-24/25')).toBe(25)
  })

  it.each([
    ['the server did not count', '0-24/*'],
    ['the header is absent', undefined],
    ['the header is malformed', 'nonsense'],
  ])('returns null when %s', (_label, header) => {
    // null, never 0. The caller turns this into a failed observation.
    expect(parseExactCount(header)).toBeNull()
  })

  it('reports zero rows and an uncounted response differently', () => {
    expect(parseExactCount('*/0')).toBe(0)
    expect(parseExactCount('*/*')).toBeNull()
  })
})

describe('the package as a whole issues no mutating request', () => {
  const SOURCES = [
    'lib/checks.ts',
    'lib/collect.ts',
    'lib/configuration.ts',
    'lib/identity.ts',
    'lib/observation.ts',
    'lib/read-only-transport.ts',
    'lib/report.ts',
    'lib/scenarios.ts',
    'verify.ts',
  ]

  it.each(SOURCES)('%s names no write method as a request method', async (relativePath) => {
    const body = await readFile(
      resolve(ROOT, 'scripts/literature-production-verify', relativePath),
      'utf8',
    )
    // `method:` assignments only — the words themselves appear in prose and in the refusal lists.
    const writeMethods = [...body.matchAll(/method:\s*'([A-Z]+)'/gu)].map((match) => match[1])
    expect(writeMethods.filter((method) => method !== 'GET' && method !== 'HEAD')).toEqual([])
  })

  it.each(SOURCES)('%s constructs no Supabase client', async (relativePath) => {
    const body = await readFile(
      resolve(ROOT, 'scripts/literature-production-verify', relativePath),
      'utf8',
    )
    // A supabase-js client exposes `.insert`, `.update`, `.delete`, and `.rpc` with POST. This
    // package deliberately talks to PostgREST directly so none of that surface exists.
    expect(body).not.toContain('@supabase/supabase-js')
    expect(body).not.toContain('createClient')
  })

  it('never imports or calls the runtime client factory', async () => {
    // `createLiteratureAdmin` is the application's single client-construction path. Importing or
    // calling it here would put a privileged client one call away from a verification run.
    //
    // Matched as a call site or an import specifier rather than as a bare substring: the name
    // legitimately appears in prose, and a comment explaining why the factory is *not* used is
    // exactly the documentation this rule wants to keep.
    const callOrImport = /createLiteratureAdmin\s*\(|from\s+['"][^'"]*database-client['"]/u
    for (const relativePath of SOURCES) {
      const body = await readFile(
        resolve(ROOT, 'scripts/literature-production-verify', relativePath),
        'utf8',
      )
      expect(`${relativePath}: ${callOrImport.test(body)}`).toBe(`${relativePath}: false`)
    }
  })
})

describe('the anonymous probe transport is built only from an unprivileged key', () => {
  const ORIGIN_URL = 'https://itcttmkxdxvwmwcmzmey.supabase.co/'

  it('refuses to build one with no key at all', () => {
    // A keyless request is rejected by the Supabase API gateway before PostgreSQL sees it, so its
    // 401 says nothing about row-level security. Building a transport anyway would have made the
    // exposure checks pass vacuously.
    const result = createAnonymousTransport(ORIGIN_URL, null)
    expect(result.transport).toBeNull()
    expect(result.refusal).toBe('no_publishable_key')
    expect(result.detail).toMatch(/gateway/u)
  })

  it.each([
    ['a secret key', 'sb_secret_TESTONLYaaaaaaaaaaaaaaaaaaaa'],
    [
      'a legacy service-role JWT',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.TESTONLYsig',
    ],
  ])('refuses %s, which would report an exposure that does not exist', (_label, credential) => {
    // The realistic mistake: the secret pasted into LITERATURE_VERIFY_ANON_KEY. The "anonymous"
    // probe would then read rows as service_role, V82 would report a public exposure, and an
    // operator following the containment procedure would pull production variables over a typo.
    const result = createAnonymousTransport(ORIGIN_URL, credential)
    expect(result.transport).toBeNull()
    expect(result.refusal).toBe('credential_is_privileged')
  })

  it('refuses a credential it cannot show to be unprivileged', () => {
    expect(createAnonymousTransport(ORIGIN_URL, 'some-opaque-local-key').refusal).toBe(
      'credential_class_unknown',
    )
  })

  it('builds one from a publishable key', () => {
    const result = createAnonymousTransport(ORIGIN_URL, 'sb_publishable_TESTONLYbbbbbbbbbbbb')
    expect(result.transport).not.toBeNull()
    expect(result.refusal).toBeNull()
  })
})
