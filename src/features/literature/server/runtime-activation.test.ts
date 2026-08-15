/** @jest-environment node */

/**
 * The activated production Literature runtime, and the two gates that still hold.
 *
 * The third review's defect was that a fully valid strict configuration resolved to `bound` and
 * became a privileged remote client the curation and gold-set callers could mutate through — with
 * no reviewed change between setting Railway variables and remote writes. The production bring-up
 * package activates the runtime, so `createClient` *is* now reached; the property that replaces
 * "no client exists" is narrower and is what these tests pin:
 *
 *   1. **Target.** Only the byte-exact canonical URL for the single approved ref, with an
 *      `sb_secret_…` credential, produces a client. Every partial, near-miss, legacy-credential,
 *      main-project, and loopback-in-strict-mode shape still produces none, and none of them ever
 *      falls back to the main application project.
 *   2. **Capability.** Being bound is not permission. A client is handed out per operation from a
 *      closed source-controlled allowlist, so the four foundation reads get one and curation,
 *      gold-set reads, and gold-set mutations do not — in exactly the configuration where the
 *      reads succeed.
 *
 * These tests instrument Supabase client construction itself, so the claims under test are not
 * "the control flow looks right" but "`createClient` was called with this target, once" and
 * "`.rpc()`/`.from()` were never reached". They drive the real `process.env`, exactly as the
 * deployed server functions do.
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
import {
  LITERATURE_ACTIVATED_OPERATIONS,
  describeLiteratureDatabaseBinding,
  literatureClientForOperation,
  literatureOperationActivated,
  type LiteratureRuntimeOperation,
} from './database-client'
import {
  curateLiteratureArticle,
  getLiteratureArticle,
  loadLiteratureAdminStats,
  searchLiterature,
} from './queries'
import { listLiteratureGoldSetBatches } from './gold-set'
import { capabilityCarriesCounts } from './runtime-capability'

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
 * Deployed configuration shapes that must still produce no client.
 *
 * Activation removed exactly one member from this list — the exactly-valid production
 * configuration, which now appears in `VALID_PRODUCTION_ENVIRONMENTS` below. Everything else is
 * unchanged, which is the point: activation is not a relaxation of any validation rule.
 */
const REFUSED_ENVIRONMENTS: [string, Record<string, string>][] = [
  ['no variables', {}],
  ['only the URL', { LITERATURE_SUPABASE_URL: APPROVED_URL }],
  ['only the credential', { LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY }],
  [
    'URL and credential but no expected ref',
    { LITERATURE_SUPABASE_URL: APPROVED_URL, LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY },
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

/**
 * The configurations that now activate the read path.
 *
 * All three are the same three documented variables; the last two additionally prove that the
 * runtime mode is a closed opt-in — an empty value and the near-miss `Local` both resolve to the
 * strict hosted contract rather than relaxing anything.
 */
const VALID_PRODUCTION_ENVIRONMENTS: [string, Record<string, string>][] = [
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
]

const PRODUCTION_ENVIRONMENT = VALID_PRODUCTION_ENVIRONMENTS[0][1]

/** Read the client for an operation without asserting anything about it. */
function clientFor(operation: LiteratureRuntimeOperation) {
  return literatureClientForOperation(operation)
}

describe('only the exact dedicated target produces a client', () => {
  it.each(REFUSED_ENVIRONMENTS)('constructs no client for %s', (_label, environment) => {
    applyEnvironment(environment)
    expect(clientFor('article_search').client).toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it.each(REFUSED_ENVIRONMENTS)(
    'reports %s as not configured rather than as an empty corpus',
    (_label, environment) => {
      applyEnvironment(environment)
      const acquired = clientFor('admin_stats')
      expect(acquired.client).toBeNull()
      expect(acquired.capability?.state).toBe('not_configured')
      // The distinction the administration page depends on: this state carries no counts, so
      // nothing downstream may render it as a zero.
      expect(capabilityCarriesCounts(acquired.capability!.state)).toBe(false)
    },
  )

  it.each(VALID_PRODUCTION_ENVIRONMENTS)(
    'constructs exactly one dedicated client for %s',
    (_label, environment) => {
      applyEnvironment(environment)
      const acquired = clientFor('article_search')
      if (!acquired.client) throw new Error(`expected a client for ${_label}`)
      expect(acquired.client).toBe(supabaseClientStub)
      expect(acquired.projectRef).toBe(APPROVED_REF)
      expect(createClientMock).toHaveBeenCalledTimes(1)
      expect(createClientMock).toHaveBeenCalledWith(APPROVED_URL, SECRET_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    },
  )

  it('binds the exactly valid production configuration without exposing the credential', () => {
    applyEnvironment(PRODUCTION_ENVIRONMENT)
    const diagnostics = describeLiteratureDatabaseBinding()
    expect(diagnostics).toMatchObject({
      status: 'bound',
      mode: 'production_strict',
      credentialClass: 'secret',
      projectRef: APPROVED_REF,
    })
    expect(JSON.stringify(diagnostics)).not.toContain(SECRET_KEY)
  })

  it('never targets the main application project, even when both refs agree on it', () => {
    applyEnvironment({
      LITERATURE_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co/',
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'tqnhxlwvkkswuckszlee',
    })
    // Strict mode compares the raw URL against the single canonical byte sequence before it looks
    // at refs at all, so the main project is refused as non-canonical rather than reaching the
    // prohibited-ref rule. Both gates independently exclude it; this is simply the first one.
    expect(describeLiteratureDatabaseBinding()).toMatchObject({
      status: 'unbound',
      reason: 'noncanonical_production_url',
    })
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('refuses the main application project by ref even where the URL gate does not apply', () => {
    applyEnvironment({
      LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
      LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'local-development-placeholder',
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'tqnhxlwvkkswuckszlee',
    })
    expect(describeLiteratureDatabaseBinding()).toMatchObject({
      status: 'unbound',
      reason: 'prohibited_project_ref',
    })
    expect(clientFor('article_search').client).toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('does not read the main project variables as a fallback', () => {
    applyEnvironment({})
    process.env.SUPABASE_URL = 'https://tqnhxlwvkkswuckszlee.supabase.co/'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tqnhxlwvkkswuckszlee.supabase.co/'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_MAIN_PROJECT_PLACEHOLDER'
    try {
      expect(clientFor('article_search').client).toBeNull()
      expect(describeLiteratureDatabaseBinding().reason).toBe('not_configured')
      expect(createClientMock).not.toHaveBeenCalled()
    } finally {
      delete process.env.SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  })
})

/**
 * Activation is not capability.
 *
 * These run in the configuration where the read path genuinely works, so a withheld operation
 * failing here cannot be explained away by a missing variable. The dedicated project carries the
 * foundation migration only, and this build carries no Literature write path at all.
 */
describe('the activation contract withholds writes and the gold-set workflow', () => {
  beforeEach(() => {
    applyEnvironment(PRODUCTION_ENVIRONMENT)
  })

  it.each([...LITERATURE_ACTIVATED_OPERATIONS])('carries %s', (operation) => {
    expect(literatureOperationActivated(operation)).toBe(true)
    expect(clientFor(operation).client).toBe(supabaseClientStub)
  })

  it.each([
    ['article_curation', 'write_capability_withheld'],
    ['gold_set_read', 'gold_workflow_unavailable'],
    ['gold_set_mutation', 'gold_workflow_unavailable'],
  ] as const)('withholds %s as %s', (operation, state) => {
    expect(literatureOperationActivated(operation)).toBe(false)
    const acquired = clientFor(operation)
    expect(acquired.client).toBeNull()
    expect(acquired.capability?.state).toBe(state)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('reaches no RPC from the curation or gold-set server functions', async () => {
    const results = [
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
      expect(typeof result.error).toBe('string')
    }
    // The curation refusal fires before the payload is validated, so an invalid update object
    // cannot be what produced it.
    expect(results[0].capability.state).toBe('write_capability_withheld')
    expect(results[1].capability.state).toBe('gold_workflow_unavailable')
    expect(createClientMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('reaches the search and stats RPCs, and only those', async () => {
    // Distinct from the stub above: these two are expected to reach the client, so the mock
    // answers instead of throwing.
    const answering = {
      rpc: jest.fn(async () => ({ data: [], error: null })),
      from: jest.fn(() => {
        throw new Error('unexpected table read')
      }),
    }
    createClientMock.mockReturnValueOnce(answering as never)
    const search = await searchLiterature({
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
    } as unknown as Parameters<typeof searchLiterature>[0])

    expect(answering.rpc).toHaveBeenCalledWith('search_literature_v1', expect.any(Object))
    // Zero rows from a working RPC is a measurement, and the capability says so.
    expect(search.error).toBeNull()
    expect(search.data?.total).toBe(0)
    expect(search.capability.state).toBe('foundation_ready_empty')
    expect(capabilityCarriesCounts(search.capability.state)).toBe(true)
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
    expect(clientFor('article_search').client).toBe(supabaseClientStub)
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
    expect(clientFor('article_search').client).toBeNull()
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
      expect(typeof result.error).toBe('string')
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
    expect(clientFor('article_search').client).toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })
})
