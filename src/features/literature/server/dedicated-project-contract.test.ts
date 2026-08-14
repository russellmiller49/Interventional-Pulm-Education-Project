import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANONICAL_PRODUCTION_ORIGIN,
  LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
  classifyLiteratureCredential,
  describeLiteratureBinding,
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
  it('binds only the exact approved byte sequence, trailing slash included', () => {
    expect(LITERATURE_CANONICAL_PRODUCTION_URL_EXACT).toBe(
      'https://itcttmkxdxvwmwcmzmey.supabase.co/',
    )
    const binding = resolve(strictEnvironment())
    expect(binding.status).toBe('bound')
    if (binding.status !== 'bound') throw new Error('expected a bound result')
    expect(binding.url).toBe(LITERATURE_CANONICAL_PRODUCTION_URL_EXACT)
    expect(binding.projectRef).toBe(APPROVED_REF)
    expect(binding.credentialClass).toBe('secret')
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
    const binding = resolve(strictEnvironment({ LITERATURE_SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY }))
    expect(binding.status).toBe('bound')
    if (binding.status !== 'bound') throw new Error('expected a bound result')
    expect(binding.usedLegacyCredentialVariable).toBe(false)
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
    expect(diagnostics).toMatchObject({ status: 'bound', projectRef: APPROVED_REF })
  })
})
