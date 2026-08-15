import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANONICAL_PRODUCTION_ORIGIN,
  LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
  LITERATURE_PRODUCTION_RUNTIME_ACTIVATION,
  classifyLiteratureCredential,
  describeLiteratureBinding,
  isPermittedLocalRuntimeUrl,
  parseLiteratureTargetUrl,
  resolveLiteratureDedicatedBinding,
  resolveLiteratureRuntimeMode,
  type LiteratureDedicatedEnvironment,
  type LiteratureRuntimeMode,
} from './dedicated-project-contract'

const APPROVED_REF = LITERATURE_APPROVED_PRODUCTION_PROJECT_REF
const MAIN_REF = LITERATURE_MAIN_APPLICATION_PROJECT_REF
// H-3: the single byte sequence strict mode accepts, trailing slash included.
const APPROVED_URL = LITERATURE_CANONICAL_PRODUCTION_URL_EXACT

/**
 * Placeholder credentials. These are format markers, not credentials: the `sb_secret_` prefix is a
 * documented public Supabase key-class marker, and the bodies are self-describing placeholders.
 * Legacy JWTs are built at runtime by `legacyJwt` so no credential-shaped literal is committed.
 */
const SECRET_KEY = 'sb_secret_EXAMPLE_PLACEHOLDER_NOT_A_CREDENTIAL'
const OTHER_SECRET_KEY = 'sb_secret_EXAMPLE_PLACEHOLDER_DIFFERENT_VALUE'
const PUBLISHABLE_KEY = 'sb_publishable_EXAMPLE_PLACEHOLDER_NOT_A_CREDENTIAL'

function base64Url(value: object) {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function legacyJwt(role: string) {
  return [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({ role }),
    'unsigned-placeholder',
  ].join('.')
}

function resolve(
  environment: LiteratureDedicatedEnvironment,
  mode: LiteratureRuntimeMode = 'production_strict',
) {
  return resolveLiteratureDedicatedBinding(environment, mode)
}

function strictEnvironment(
  overrides: Partial<LiteratureDedicatedEnvironment> = {},
): LiteratureDedicatedEnvironment {
  return {
    LITERATURE_SUPABASE_URL: APPROVED_URL,
    LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
    LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    ...overrides,
  }
}

function localEnvironment(
  overrides: Partial<LiteratureDedicatedEnvironment> = {},
): LiteratureDedicatedEnvironment {
  return {
    LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
    LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
    LITERATURE_SUPABASE_SECRET_KEY: 'local-development-placeholder',
    LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    ...overrides,
  }
}

describe('runtime mode is fail-strict (M-1)', () => {
  it('selects local mode only for the exact string "local"', () => {
    expect(resolveLiteratureRuntimeMode({ LITERATURE_SUPABASE_RUNTIME_MODE: 'local' })).toBe(
      'local',
    )
  })

  it('defaults to the strict contract for anything else', () => {
    for (const value of [
      undefined,
      '',
      'Local',
      'LOCAL',
      ' local',
      'local ',
      'local\n',
      'production',
      'Production',
      'PRODUCTION',
      'production ',
      'development',
      'preview',
      'nonsense',
    ]) {
      expect(resolveLiteratureRuntimeMode({ LITERATURE_SUPABASE_RUNTIME_MODE: value })).toBe(
        'production_strict',
      )
    }
  })

  it('ignores NODE_ENV entirely', () => {
    for (const nodeEnv of ['production', 'development', 'test', undefined]) {
      expect(
        resolveLiteratureRuntimeMode({ NODE_ENV: nodeEnv } as LiteratureDedicatedEnvironment),
      ).toBe('production_strict')
    }
  })

  it('applies the strict contract when the mode variable is absent', () => {
    // A deployed environment that forgets the variable must not silently accept loopback.
    const binding = resolveLiteratureDedicatedBinding({
      LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(binding).toMatchObject({
      status: 'unbound',
      mode: 'production_strict',
      reason: 'noncanonical_production_url',
    })
  })
})

describe('byte-exact production URL (H-3)', () => {
  it('validates the exact approved byte sequence, trailing slash included', () => {
    expect(LITERATURE_CANONICAL_PRODUCTION_URL_EXACT).toBe(
      'https://itcttmkxdxvwmwcmzmey.supabase.co/',
    )
    // Validation still runs to completion for the exactly correct value — it just stops short of
    // activating a client (third review, finding 4). The withheld state proves every strict gate
    // was satisfied: a wrong URL, ref, or credential class produces `unbound` with its own reason.
    const binding = resolve(strictEnvironment())
    expect(binding.status).toBe('not_activated')
    if (binding.status !== 'not_activated') throw new Error('expected a withheld result')
    expect(binding.reason).toBe('dedicated_runtime_not_activated')
    expect(binding.projectRef).toBe(APPROVED_REF)
    expect(binding.credentialClass).toBe('secret')
    expect(binding).not.toHaveProperty('secretKey')
  })

  // Every variant differs from the approved constant by at least one byte, so each fails the
  // pre-parse byte comparison with the same controlled typed reason. No trimming, case folding,
  // dot-segment resolution, percent-decoding, or default-port normalization runs first.
  const byteVariants: [string, string][] = [
    ['the origin without the trailing slash', LITERATURE_CANONICAL_PRODUCTION_ORIGIN],
    ['an uppercase scheme', `HTTPS://${APPROVED_REF}.supabase.co/`],
    ['a mixed-case scheme', `Https://${APPROVED_REF}.supabase.co/`],
    ['a mixed-case host', `https://${APPROVED_REF}.Supabase.co/`],
    ['leading whitespace', ` ${APPROVED_URL}`],
    ['trailing whitespace', `${APPROVED_URL} `],
    ['a leading newline', `\n${APPROVED_URL}`],
    ['an explicit :443 port', `https://${APPROVED_REF}.supabase.co:443/`],
    ['a /./ dot path', `https://${APPROVED_REF}.supabase.co/./`],
    ['a /%2e percent-encoded dot path', `https://${APPROVED_REF}.supabase.co/%2e`],
    ['a /%2E percent-encoded dot path', `https://${APPROVED_REF}.supabase.co/%2E`],
    ['plaintext http', `http://${APPROVED_REF}.supabase.co/`],
    ['userinfo', `https://user:pass@${APPROVED_REF}.supabase.co/`],
    ['a path', `${APPROVED_URL}rest/v1`],
    ['a query string', `${APPROVED_URL}?x=1`],
    ['a fragment', `${APPROVED_URL}#x`],
    ['a trailing-dot host', `https://${APPROVED_REF}.supabase.co./`],
    ['an alternate project host', 'https://abcdefghijklmnopqrst.supabase.co/'],
    ['the main project host', `https://${MAIN_REF}.supabase.co/`],
    ['a custom host', 'https://literature.example.com/'],
    ['loopback', 'https://127.0.0.1/'],
    ['a .localhost host', 'https://app.localhost/'],
    ['an unparseable value', 'not a url'],
  ]

  it.each(byteVariants)('rejects %s before parsing', (_label, url) => {
    expect(resolve(strictEnvironment({ LITERATURE_SUPABASE_URL: url }))).toMatchObject({
      status: 'unbound',
      reason: 'noncanonical_production_url',
    })
  })

  it('never echoes the rejected raw value in the failure message', () => {
    const raw = ` HTTPS://${APPROVED_REF}.supabase.co:443/./`
    const binding = resolve(strictEnvironment({ LITERATURE_SUPABASE_URL: raw }))
    expect(binding.status).toBe('unbound')
    if (binding.status !== 'unbound') throw new Error('expected an unbound result')
    expect(binding.message).not.toContain(raw)
  })

  it('parses the project ref out of a hosted Supabase URL', () => {
    expect(parseLiteratureTargetUrl(APPROVED_URL)?.projectRef).toBe(APPROVED_REF)
    expect(parseLiteratureTargetUrl(`https://${MAIN_REF}.supabase.co`)?.projectRef).toBe(MAIN_REF)
  })
})

describe('local mode', () => {
  it('accepts a loopback target with an opaque local key', () => {
    expect(resolve(localEnvironment(), 'local').status).toBe('bound')
  })

  it('accepts the legacy credential variable', () => {
    const binding = resolve(
      localEnvironment({
        LITERATURE_SUPABASE_SECRET_KEY: undefined,
        LITERATURE_SUPABASE_SERVICE_ROLE_KEY: legacyJwt('service_role'),
      }),
      'local',
    )
    expect(binding.status).toBe('bound')
    if (binding.status !== 'bound') throw new Error('expected a bound result')
    expect(binding.usedLegacyCredentialVariable).toBe(true)
  })

  it('never accepts a remote host, even the approved one', () => {
    expect(
      resolve(localEnvironment({ LITERATURE_SUPABASE_URL: APPROVED_URL }), 'local'),
    ).toMatchObject({ status: 'unbound', reason: 'remote_host_not_permitted_in_local_mode' })
  })

  it('never accepts an arbitrary remote host', () => {
    expect(
      resolve(localEnvironment({ LITERATURE_SUPABASE_URL: 'https://evil.example.com' }), 'local'),
    ).toMatchObject({ status: 'unbound', reason: 'remote_host_not_permitted_in_local_mode' })
  })

  it.each([
    ['the canonical hostname form', 'http://localhost:55321'],
    ['IPv4 loopback', 'http://127.0.0.1:55321'],
    ['bracketed IPv6 loopback', 'http://[::1]:55321'],
    ['uppercase LOCALHOST, canonicalized to localhost by the URL parser', 'http://LOCALHOST:55321'],
  ])('still binds %s', (_label, url) => {
    expect(resolve(localEnvironment({ LITERATURE_SUPABASE_URL: url }), 'local').status).toBe(
      'bound',
    )
  })

  describe('the wildcard bind address is not a destination (fourth review)', () => {
    it.each([
      ['0.0.0.0', 'http://0.0.0.0:55321'],
      ['[::]', 'http://[::]:55321'],
      ['the IPv4 shorthand 0, which the URL parser canonicalizes to 0.0.0.0', 'http://0:55321'],
    ])('refuses %s with the wildcard-specific reason', (_label, url) => {
      expect(resolve(localEnvironment({ LITERATURE_SUPABASE_URL: url }), 'local')).toMatchObject({
        status: 'unbound',
        reason: 'wildcard_address_not_permitted',
      })
    })
  })

  describe('only the canonical local hosts are on the allowlist (fourth review)', () => {
    it.each([
      ['a .localhost subdomain', 'http://db.localhost:55321'],
      ['localhost.localdomain', 'http://localhost.localdomain:55321'],
      ['a 127/8 alias other than 127.0.0.1', 'http://127.0.0.2:55321'],
      ['a 0/8 address other than the wildcard', 'http://0.0.0.1:55321'],
      ['the IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]:55321'],
    ])('refuses %s as not on the allowlist', (_label, url) => {
      expect(resolve(localEnvironment({ LITERATURE_SUPABASE_URL: url }), 'local')).toMatchObject({
        status: 'unbound',
        reason: 'remote_host_not_permitted_in_local_mode',
      })
    })
  })

  it('still refuses a publishable credential', () => {
    expect(
      resolve(localEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: PUBLISHABLE_KEY }), 'local'),
    ).toMatchObject({ status: 'unbound', reason: 'invalid_credential_class' })
  })

  it('still refuses the main application project', () => {
    expect(
      resolve(localEnvironment({ LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: MAIN_REF }), 'local'),
    ).toMatchObject({ status: 'unbound', reason: 'prohibited_project_ref' })
  })
})

describe('wrong project', () => {
  it('rejects the main application project as a Literature target in strict mode', () => {
    expect(
      resolve(
        strictEnvironment({
          LITERATURE_SUPABASE_URL: `https://${MAIN_REF}.supabase.co`,
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: MAIN_REF,
        }),
      ),
    ).toMatchObject({ status: 'unbound' })
  })

  it('rejects a URL whose ref disagrees with the expected ref', () => {
    expect(
      resolve(
        strictEnvironment({
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'abcdefghijklmnopqrst',
        }),
      ),
    ).toMatchObject({ status: 'unbound', reason: 'project_ref_mismatch' })
  })
})

describe('incomplete configuration', () => {
  it('reports not configured when no dedicated variable is set', () => {
    expect(resolve({})).toMatchObject({ status: 'unbound', reason: 'not_configured' })
  })

  it('never falls back to the main application project', () => {
    const binding = resolveLiteratureDedicatedBinding({
      SUPABASE_URL: `https://${MAIN_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY,
      NEXT_PUBLIC_SUPABASE_URL: `https://${MAIN_REF}.supabase.co`,
    } as unknown as LiteratureDedicatedEnvironment)
    expect(binding).toMatchObject({ status: 'unbound', reason: 'not_configured' })
  })

  it('fails closed on a partial dedicated configuration', () => {
    expect(resolve({ LITERATURE_SUPABASE_URL: APPROVED_URL })).toMatchObject({
      status: 'unbound',
      reason: 'partial_configuration',
    })
    expect(resolve({ LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY })).toMatchObject({
      status: 'unbound',
      reason: 'partial_configuration',
    })
  })

  it('requires the expected project ref', () => {
    expect(
      resolve(strictEnvironment({ LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: undefined })),
    ).toMatchObject({ status: 'unbound', reason: 'expected_project_ref_missing' })
  })

  it('rejects a malformed expected project ref', () => {
    expect(
      resolve(strictEnvironment({ LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'too-short' })),
    ).toMatchObject({ status: 'unbound', reason: 'expected_project_ref_malformed' })
  })
})

describe('credential class', () => {
  it('classifies each documented key shape', () => {
    expect(classifyLiteratureCredential(SECRET_KEY)).toBe('secret')
    expect(classifyLiteratureCredential(PUBLISHABLE_KEY)).toBe('publishable')
    expect(classifyLiteratureCredential(legacyJwt('service_role'))).toBe('legacy_service_role')
    expect(classifyLiteratureCredential(legacyJwt('anon'))).toBe('legacy_anon')
    expect(classifyLiteratureCredential(legacyJwt('nonsense'))).toBe('unknown_jwt')
    expect(classifyLiteratureCredential('local-development-placeholder')).toBe('opaque')
  })

  it('rejects publishable and anon keys as the privileged credential', () => {
    for (const credential of [PUBLISHABLE_KEY, legacyJwt('anon')]) {
      expect(
        resolve(strictEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: credential })),
      ).toMatchObject({ status: 'unbound', reason: 'invalid_credential_class' })
    }
  })

  it('requires the current secret-key model in strict mode', () => {
    expect(
      resolve(strictEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: legacyJwt('service_role') })),
    ).toMatchObject({ status: 'unbound', reason: 'production_requires_secret_key_credential' })
  })
})

describe('legacy credential variable', () => {
  it('is not accepted in strict mode', () => {
    expect(
      resolve({
        LITERATURE_SUPABASE_URL: APPROVED_URL,
        LITERATURE_SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY,
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      }),
    ).toMatchObject({
      status: 'unbound',
      reason: 'legacy_credential_variable_not_permitted_in_production',
    })
  })

  it('fails closed when the two variables hold different values', () => {
    expect(
      resolve(strictEnvironment({ LITERATURE_SUPABASE_SERVICE_ROLE_KEY: OTHER_SECRET_KEY })),
    ).toMatchObject({ status: 'unbound', reason: 'ambiguous_credentials' })
    expect(
      resolve(
        localEnvironment({
          LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
          LITERATURE_SUPABASE_SERVICE_ROLE_KEY: OTHER_SECRET_KEY,
        }),
        'local',
      ),
    ).toMatchObject({ status: 'unbound', reason: 'ambiguous_credentials' })
  })

  it('accepts byte-identical values as one credential', () => {
    // Under the strict contract "accepted" now means "validated through to the activation gate":
    // an ambiguous pair would have stopped earlier with `ambiguous_credentials`.
    const binding = resolve(strictEnvironment({ LITERATURE_SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY }))
    expect(binding).toMatchObject({
      status: 'not_activated',
      reason: 'dedicated_runtime_not_activated',
    })

    // Local mode still binds, and still records which variable supplied the credential.
    const local = resolveLiteratureDedicatedBinding(
      localEnvironment({
        LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
        LITERATURE_SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY,
      }),
      'local',
    )
    expect(local.status).toBe('bound')
    if (local.status !== 'bound') throw new Error('expected a bound result')
    expect(local.usedLegacyCredentialVariable).toBe(false)
  })
})

describe('secret safety', () => {
  it('never repeats a credential value in a failure message', () => {
    const failures = [
      resolve(strictEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: PUBLISHABLE_KEY })),
      resolve(strictEnvironment({ LITERATURE_SUPABASE_SERVICE_ROLE_KEY: OTHER_SECRET_KEY })),
      resolve(strictEnvironment({ LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321' })),
      resolve({ LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY }),
    ]
    for (const binding of failures) {
      expect(binding.status).toBe('unbound')
      if (binding.status !== 'unbound') continue
      for (const value of [SECRET_KEY, OTHER_SECRET_KEY, PUBLISHABLE_KEY]) {
        expect(binding.message).not.toContain(value)
      }
    }
  })

  it('produces diagnostics that carry no credential', () => {
    const diagnostics = describeLiteratureBinding(resolve(strictEnvironment()))
    expect(JSON.stringify(diagnostics)).not.toContain(SECRET_KEY)
    expect(diagnostics).toMatchObject({
      status: 'not_activated',
      reason: 'dedicated_runtime_not_activated',
      projectRef: APPROVED_REF,
    })

    const localDiagnostics = describeLiteratureBinding(
      resolveLiteratureDedicatedBinding(localEnvironment(), 'local'),
    )
    expect(JSON.stringify(localDiagnostics)).not.toContain(SECRET_KEY)
    expect(localDiagnostics).toMatchObject({ status: 'bound', projectRef: APPROVED_REF })
  })
})

/**
 * Third review, finding 4. A valid strict configuration used to resolve to `bound`, which
 * `createLiteratureAdmin()` turned into a privileged remote client the existing curation and
 * gold-set callers use for mutating RPCs. Validation and activation are now separate: strict mode
 * validates fully and withholds, and the switch is a source constant rather than a variable.
 */
describe('production runtime activation (third review, finding 4)', () => {
  it('is a source constant set to not_activated, not an environment variable', () => {
    expect(LITERATURE_PRODUCTION_RUNTIME_ACTIVATION).toBe('not_activated')

    const source = readFileSync(
      join(process.cwd(), 'src/features/literature/server/dedicated-project-contract.ts'),
      'utf8',
    )
    // The value is a literal in source, and nothing reads an activation variable from anywhere.
    expect(source).toMatch(
      /export const LITERATURE_PRODUCTION_RUNTIME_ACTIVATION: LiteratureProductionRuntimeActivation =\s*'not_activated'/u,
    )

    // Scan executable code only: the module header legitimately *mentions* process.env to say it
    // never reads one.
    const executable = source
      .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
      .replaceAll(/(^|[^:])\/\/.*$/gmu, '$1')
    expect(executable).not.toMatch(/process\.env/u)
    expect(executable).not.toMatch(/environment\.[A-Za-z_]*ACTIVAT/iu)
    // No environment interface in the contract declares an activation field.
    expect(executable).not.toMatch(/^\s*[A-Z_]*ACTIVAT[A-Z_]*\??:/mu)
  })

  it('never resolves to bound in strict mode, for any configuration shape', () => {
    const environments: LiteratureDedicatedEnvironment[] = [
      {},
      { LITERATURE_SUPABASE_URL: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT },
      { LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY },
      {
        LITERATURE_SUPABASE_URL: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
        LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      },
      strictEnvironment(),
      strictEnvironment({ LITERATURE_SUPABASE_RUNTIME_MODE: 'production' }),
      strictEnvironment({ LITERATURE_SUPABASE_RUNTIME_MODE: 'Local' }),
      strictEnvironment({ LITERATURE_SUPABASE_RUNTIME_MODE: ' local ' }),
      strictEnvironment({ LITERATURE_SUPABASE_URL: LITERATURE_CANONICAL_PRODUCTION_ORIGIN }),
      strictEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: PUBLISHABLE_KEY }),
    ]
    for (const environment of environments) {
      // The mode is derived here rather than forced, so a near-miss mode value is exercised too.
      expect(resolveLiteratureDedicatedBinding(environment).status).not.toBe('bound')
    }
  })

  it('still distinguishes an invalid configuration from a valid withheld one', () => {
    expect(
      resolve(strictEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: PUBLISHABLE_KEY })),
    ).toMatchObject({ status: 'unbound', reason: 'invalid_credential_class' })
    expect(resolve(strictEnvironment())).toMatchObject({ status: 'not_activated' })
  })

  it('allows only the canonical local hosts through the local runtime allowlist', () => {
    for (const permitted of [
      'http://127.0.0.1:55321',
      'http://localhost:55321',
      'https://localhost:55321',
      'http://[::1]:55321',
    ]) {
      expect(isPermittedLocalRuntimeUrl(permitted)).toBe(true)
    }
    for (const refused of [
      LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
      'https://tqnhxlwvkkswuckszlee.supabase.co/',
      'https://example.com',
      'postgres://127.0.0.1:5432/postgres',
      'http://user:pw@127.0.0.1:55321',
      'not-a-url',
      '',
      // Fourth review: wildcard bind addresses and near-local hostnames are not destinations
      // this contract permits a client for.
      'http://0.0.0.0:55321',
      'http://[::]:55321',
      'http://0:55321',
      'http://0.0.0.1:55321',
      'http://127.0.0.2:55321',
      'http://db.localhost:55321',
      'http://localhost.localdomain:55321',
      'http://[::ffff:127.0.0.1]:55321',
    ]) {
      expect(isPermittedLocalRuntimeUrl(refused)).toBe(false)
    }
  })

  it('pins the Node URL.hostname representations the allowlist is written against', () => {
    // The allowlist compares against WHATWG URL hostname serialization: lowercased names,
    // IPv4 shorthand expanded, IPv6 bracketed. These assertions pin that representation so a
    // future runtime change would surface here rather than silently widening the allowlist.
    expect(parseLiteratureTargetUrl('http://LOCALHOST:1')?.hostname).toBe('localhost')
    expect(parseLiteratureTargetUrl('http://127.1:1')?.hostname).toBe('127.0.0.1')
    expect(parseLiteratureTargetUrl('http://[::1]:1')?.hostname).toBe('[::1]')
    expect(parseLiteratureTargetUrl('http://0:1')?.hostname).toBe('0.0.0.0')
    expect(parseLiteratureTargetUrl('http://[::]:1')?.hostname).toBe('[::]')
    expect(parseLiteratureTargetUrl('http://[::ffff:127.0.0.1]:1')?.hostname).toBe(
      '[::ffff:7f00:1]',
    )
  })
})
