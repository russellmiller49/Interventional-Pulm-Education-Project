/** @jest-environment node */

/**
 * Third review, finding 4 — the production Literature runtime is disabled in this PR.
 *
 * The defect: a fully valid strict configuration resolved to `bound`, and `createLiteratureAdmin()`
 * turned that into a privileged remote client which the existing curation and gold-set callers use
 * for mutating RPCs. Setting the documented Railway variables would have activated remote mutation
 * before the separately reviewed capability-gating / cutover package exists.
 *
 * These tests instrument Supabase client construction itself, so the claim under test is not "the
 * control flow looks right" but "`createClient` is never called and `.rpc()` is never reached".
 * They drive the real `process.env`, exactly as the deployed server functions do.
 */

const createClientMock = jest.fn(() => supabaseClientStub)

/** A client stub that fails loudly if anything ever reaches it. */
const rpcMock = jest.fn(() => {
  throw new Error('a Literature RPC was invoked against a client that must never exist')
})
const fromMock = jest.fn(() => {
  throw new Error('a Literature table read was attempted against a client that must never exist')
})
const supabaseClientStub = { rpc: rpcMock, from: fromMock }

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...parameters: unknown[]) =>
    (createClientMock as unknown as (...args: unknown[]) => unknown)(...parameters),
}))

import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANONICAL_PRODUCTION_ORIGIN,
  LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
} from './dedicated-project-contract'
import { createLiteratureAdmin, describeLiteratureDatabaseBinding } from './database-client'
import {
  curateLiteratureArticle,
  getLiteratureArticle,
  loadLiteratureAdminStats,
  searchLiterature,
} from './queries'
import { listLiteratureGoldSetBatches } from './gold-set'

const APPROVED_REF = LITERATURE_APPROVED_PRODUCTION_PROJECT_REF
const APPROVED_URL = LITERATURE_CANONICAL_PRODUCTION_URL_EXACT
const SECRET_KEY = 'sb_secret_EXAMPLE_PLACEHOLDER_NOT_A_CREDENTIAL'
const LEGACY_JWT_PLACEHOLDER = 'header-placeholder.payload-placeholder.signature-placeholder'

const LITERATURE_VARIABLES = [
  'LITERATURE_SUPABASE_URL',
  'LITERATURE_SUPABASE_SECRET_KEY',
  'LITERATURE_SUPABASE_EXPECTED_PROJECT_REF',
  'LITERATURE_SUPABASE_SERVICE_ROLE_KEY',
  'LITERATURE_SUPABASE_RUNTIME_MODE',
] as const

const originalEnvironment = { ...process.env }

function applyEnvironment(values: Record<string, string>) {
  for (const name of LITERATURE_VARIABLES) delete process.env[name]
  for (const [name, value] of Object.entries(values)) process.env[name] = value
}

afterEach(() => {
  for (const name of LITERATURE_VARIABLES) delete process.env[name]
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value !== undefined) process.env[name] = value
  }
})

/**
 * Every deployed configuration shape the review asked about: nothing set, partial, exactly valid,
 * and invalid. None of them may construct a client.
 */
const DEPLOYED_ENVIRONMENTS: [string, Record<string, string>][] = [
  ['no variables', {}],
  ['only the URL', { LITERATURE_SUPABASE_URL: APPROVED_URL }],
  ['only the credential', { LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY }],
  [
    'URL and credential but no expected ref',
    { LITERATURE_SUPABASE_URL: APPROVED_URL, LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY },
  ],
  [
    'exactly the documented production variables',
    {
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    },
  ],
  [
    'the documented variables plus an unset runtime mode',
    {
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      LITERATURE_SUPABASE_RUNTIME_MODE: '',
    },
  ],
  [
    'the documented variables with a near-miss runtime mode',
    {
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      LITERATURE_SUPABASE_RUNTIME_MODE: 'Local',
    },
  ],
  [
    'the origin without the trailing slash',
    {
      LITERATURE_SUPABASE_URL: LITERATURE_CANONICAL_PRODUCTION_ORIGIN,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    },
  ],
  [
    'a legacy credential variable',
    {
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: LEGACY_JWT_PLACEHOLDER,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    },
  ],
  [
    'the main application project',
    {
      LITERATURE_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co/',
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'tqnhxlwvkkswuckszlee',
    },
  ],
  [
    'a remote host claiming local mode',
    {
      LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    },
  ],
]

describe('no production Literature client is constructed in this PR', () => {
  it.each(DEPLOYED_ENVIRONMENTS)('constructs no client for %s', (_label, environment) => {
    applyEnvironment(environment)
    expect(createLiteratureAdmin()).toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('reports the exactly valid production configuration as validated but not activated', () => {
    applyEnvironment({
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    const diagnostics = describeLiteratureDatabaseBinding()
    expect(diagnostics).toMatchObject({
      status: 'not_activated',
      mode: 'production_strict',
      reason: 'dedicated_runtime_not_activated',
      projectRef: APPROVED_REF,
    })
    expect(JSON.stringify(diagnostics)).not.toContain(SECRET_KEY)
  })

  it('leaves every existing read and mutating server function without a client or an RPC', async () => {
    applyEnvironment({
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })

    const results = [
      // Read paths: list/search, detail, and the admin stats RPC.
      await searchLiterature({
        q: '',
        journalIds: [],
        topicIds: [],
        yearFrom: null,
        yearTo: null,
        publicationTypes: [],
        landmarkOnly: false,
        sort: 'relevance',
        page: 1,
        pageSize: 20,
        adminPreview: false,
      } as unknown as Parameters<typeof searchLiterature>[0]),
      await getLiteratureArticle('12345678'),
      await loadLiteratureAdminStats(),
      // The mutating curation RPC, and a gold-set path.
      await curateLiteratureArticle(
        '12345678',
        {} as unknown as Parameters<typeof curateLiteratureArticle>[1],
        { id: 'placeholder-user', email: null } as unknown as Parameters<
          typeof curateLiteratureArticle
        >[2],
      ),
      await listLiteratureGoldSetBatches(),
    ]

    for (const result of results) {
      expect(result.data).toBeNull()
      expect(result.error).toBe('The literature database is not configured.')
    }
    expect(createClientMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('local development still gets exactly its loopback client', () => {
  it.each([
    ['IPv4 loopback', 'http://127.0.0.1:55321'],
    ['localhost', 'http://localhost:55321'],
    ['IPv6 loopback', 'http://[::1]:55321'],
  ])('constructs the local client for %s', (_label, url) => {
    applyEnvironment({
      LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
      LITERATURE_SUPABASE_URL: url,
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'local-development-placeholder',
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(createLiteratureAdmin()).toBe(supabaseClientStub)
    expect(createClientMock).toHaveBeenCalledTimes(1)
    expect(createClientMock).toHaveBeenCalledWith(url, 'local-development-placeholder', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  })
})

/**
 * Fifth review, finding 3 — an alias spelling of the loopback address never gets a client.
 *
 * Each of these is a raw authority the WHATWG URL parser rewrites to `127.0.0.1`, so before the
 * raw-authority gate they satisfied the normalized allowlist and reached `createClient`. The
 * claim under test is the same one the fourth review asked for: not "the control flow looks
 * right" but "`createClient` is never called and `.rpc()`/`.from()` are never reached".
 */
describe('alias spellings of the loopback address never get a client (fifth review)', () => {
  it.each([
    ['the two-part shorthand 127.1', 'http://127.1:55321'],
    ['the three-part shorthand 127.0.1', 'http://127.0.1:55321'],
    ['zero-padded 127.000.000.001', 'http://127.000.000.001:55321'],
    ['octal 0177.0.0.1', 'http://0177.0.0.1:55321'],
    ['hexadecimal 0x7f.1', 'http://0x7f.1:55321'],
    ['the bare integer 2130706433', 'http://2130706433:55321'],
  ])('local mode with %s stays unbound and constructs nothing', (_label, url) => {
    applyEnvironment({
      LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
      LITERATURE_SUPABASE_URL: url,
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'local-development-placeholder',
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(describeLiteratureDatabaseBinding()).toMatchObject({
      status: 'unbound',
      reason: 'noncanonical_local_url_authority',
    })
    expect(createLiteratureAdmin()).toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('leaves every existing read and mutating server function without a client or an RPC', async () => {
    applyEnvironment({
      LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
      LITERATURE_SUPABASE_URL: 'http://2130706433:55321',
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'local-development-placeholder',
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })

    const results = [
      await searchLiterature({
        q: '',
        journalIds: [],
        topicIds: [],
        yearFrom: null,
        yearTo: null,
        publicationTypes: [],
        landmarkOnly: false,
        sort: 'relevance',
        page: 1,
        pageSize: 20,
        adminPreview: false,
      } as unknown as Parameters<typeof searchLiterature>[0]),
      await getLiteratureArticle('12345678'),
      await loadLiteratureAdminStats(),
      await curateLiteratureArticle(
        '12345678',
        {} as unknown as Parameters<typeof curateLiteratureArticle>[1],
        { id: 'placeholder-user', email: null } as unknown as Parameters<
          typeof curateLiteratureArticle
        >[2],
      ),
      await listLiteratureGoldSetBatches(),
    ]

    for (const result of results) {
      expect(result.data).toBeNull()
      expect(result.error).toBe('The literature database is not configured.')
    }
    expect(createClientMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('a wildcard bind address never gets a client (fourth review)', () => {
  it.each([
    ['0.0.0.0', 'http://0.0.0.0:55321', 'wildcard_address_not_permitted'],
    ['[::]', 'http://[::]:55321', 'wildcard_address_not_permitted'],
    [
      'a .localhost subdomain',
      'http://db.localhost:55321',
      'remote_host_not_permitted_in_local_mode',
    ],
    ['a 127/8 alias', 'http://127.0.0.2:55321', 'remote_host_not_permitted_in_local_mode'],
  ])('local mode with %s stays unbound and constructs nothing', (_label, url, reason) => {
    applyEnvironment({
      LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
      LITERATURE_SUPABASE_URL: url,
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'local-development-placeholder',
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(describeLiteratureDatabaseBinding()).toMatchObject({ status: 'unbound', reason })
    expect(createLiteratureAdmin()).toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })
})
