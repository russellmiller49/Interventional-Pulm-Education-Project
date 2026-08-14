import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
  classifyLiteratureCredential,
  describeLiteratureBinding,
  parseLiteratureTargetUrl,
  resolveLiteratureDedicatedBinding,
  type LiteratureDedicatedEnvironment,
  type LiteratureRuntimeMode,
} from './dedicated-project-contract'

const APPROVED_REF = LITERATURE_APPROVED_PRODUCTION_PROJECT_REF
const MAIN_REF = LITERATURE_MAIN_APPLICATION_PROJECT_REF
const APPROVED_URL = `https://${APPROVED_REF}.supabase.co`

/**
 * Placeholder credentials. These are format markers, not credentials: the `sb_secret_` prefix is a
 * documented public Supabase key-class marker, and the bodies are self-describing placeholders
 * rather than anything key-shaped. Legacy JWTs are built at runtime by `legacyJwt` so no
 * credential-shaped literal is ever committed.
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

/** A structurally valid, cryptographically meaningless JWT with the given role claim. */
function legacyJwt(role: string) {
  return [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({ role }),
    'unsigned-placeholder',
  ].join('.')
}

function resolve(
  environment: LiteratureDedicatedEnvironment,
  mode: LiteratureRuntimeMode = 'production',
) {
  return resolveLiteratureDedicatedBinding(environment, mode)
}

function productionEnvironment(
  overrides: Partial<LiteratureDedicatedEnvironment> = {},
): LiteratureDedicatedEnvironment {
  return {
    LITERATURE_SUPABASE_URL: APPROVED_URL,
    LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
    LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    ...overrides,
  }
}

describe('dedicated Literature project contract', () => {
  describe('approved production target', () => {
    it('binds when the URL, secret key, and expected ref all agree on the approved project', () => {
      const binding = resolve(productionEnvironment())
      expect(binding.status).toBe('bound')
      if (binding.status !== 'bound') throw new Error('expected a bound result')
      expect(binding.projectRef).toBe(APPROVED_REF)
      expect(binding.credentialClass).toBe('secret')
      expect(binding.usedLegacyCredentialVariable).toBe(false)
    })

    it('parses the project ref out of the hosted Supabase URL', () => {
      expect(parseLiteratureTargetUrl(APPROVED_URL)?.projectRef).toBe(APPROVED_REF)
      expect(parseLiteratureTargetUrl(`https://${MAIN_REF}.supabase.co`)?.projectRef).toBe(MAIN_REF)
    })
  })

  describe('wrong project', () => {
    it('rejects the main application project as a Literature target', () => {
      const binding = resolve(
        productionEnvironment({
          LITERATURE_SUPABASE_URL: `https://${MAIN_REF}.supabase.co`,
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: MAIN_REF,
        }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'prohibited_project_ref' })
    })

    it('rejects the main application project even outside production', () => {
      const binding = resolve(
        productionEnvironment({
          LITERATURE_SUPABASE_URL: `https://${MAIN_REF}.supabase.co`,
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: MAIN_REF,
        }),
        'non_production',
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'prohibited_project_ref' })
    })

    it('rejects an arbitrary project ref in production', () => {
      const other = 'abcdefghijklmnopqrst'
      const binding = resolve(
        productionEnvironment({
          LITERATURE_SUPABASE_URL: `https://${other}.supabase.co`,
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: other,
        }),
      )
      expect(binding).toMatchObject({
        status: 'unbound',
        reason: 'unapproved_production_project_ref',
      })
    })

    it('rejects a URL whose ref disagrees with the expected ref', () => {
      const binding = resolve(
        productionEnvironment({
          LITERATURE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
        }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'project_ref_mismatch' })
    })

    it('rejects a production URL with no derivable project ref', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_URL: 'https://literature.example.com' }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'unresolvable_project_ref' })
    })
  })

  describe('incomplete configuration', () => {
    it('reports not configured when no dedicated variable is set', () => {
      expect(resolve({})).toMatchObject({ status: 'unbound', reason: 'not_configured' })
    })

    it('never falls back to the main application project in production', () => {
      // The main-project variables are deliberately absent from the dedicated environment type.
      // Supplying them alongside an empty dedicated configuration must still be "not configured".
      const binding = resolveLiteratureDedicatedBinding(
        {
          SUPABASE_URL: `https://${MAIN_REF}.supabase.co`,
          SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY,
          NEXT_PUBLIC_SUPABASE_URL: `https://${MAIN_REF}.supabase.co`,
        } as unknown as LiteratureDedicatedEnvironment,
        'production',
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'not_configured' })
    })

    it('fails closed on a partial dedicated configuration rather than guessing', () => {
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
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: undefined }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'expected_project_ref_missing' })
    })

    it('rejects a malformed expected project ref', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'too-short' }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'expected_project_ref_malformed' })
    })

    it('rejects a URL that is not absolute http(s)', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_URL: 'postgres://example' }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'invalid_url' })
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

    it('rejects a publishable key as the privileged credential', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: PUBLISHABLE_KEY }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'invalid_credential_class' })
    })

    it('rejects an anon key as the privileged credential', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: legacyJwt('anon') }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'invalid_credential_class' })
    })

    it('rejects a publishable key outside production too', () => {
      const binding = resolve(
        {
          LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
          LITERATURE_SUPABASE_SECRET_KEY: PUBLISHABLE_KEY,
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
        },
        'non_production',
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'invalid_credential_class' })
    })

    it('requires the current secret-key model in production', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: legacyJwt('service_role') }),
      )
      expect(binding).toMatchObject({
        status: 'unbound',
        reason: 'production_requires_secret_key_credential',
      })
    })
  })

  describe('legacy credential variable', () => {
    it('is not accepted in production even when everything else is correct', () => {
      const binding = resolve({
        LITERATURE_SUPABASE_URL: APPROVED_URL,
        LITERATURE_SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY,
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      })
      expect(binding).toMatchObject({
        status: 'unbound',
        reason: 'legacy_credential_variable_not_permitted_in_production',
      })
    })

    it('remains supported outside production so the local workflow keeps working', () => {
      const binding = resolve(
        {
          LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
          LITERATURE_SUPABASE_SERVICE_ROLE_KEY: legacyJwt('service_role'),
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
        },
        'non_production',
      )
      expect(binding.status).toBe('bound')
      if (binding.status !== 'bound') throw new Error('expected a bound result')
      expect(binding.usedLegacyCredentialVariable).toBe(true)
      expect(binding.credentialClass).toBe('legacy_service_role')
    })

    it('accepts an opaque local key outside production', () => {
      const binding = resolve(
        {
          LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
          LITERATURE_SUPABASE_SECRET_KEY: 'local-development-placeholder',
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
        },
        'non_production',
      )
      expect(binding.status).toBe('bound')
    })

    it('fails closed when the new and legacy variables hold different values', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_SERVICE_ROLE_KEY: OTHER_SECRET_KEY }),
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'ambiguous_credentials' })
    })

    it('fails closed on differing values outside production as well', () => {
      const binding = resolve(
        {
          LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
          LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
          LITERATURE_SUPABASE_SERVICE_ROLE_KEY: OTHER_SECRET_KEY,
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
        },
        'non_production',
      )
      expect(binding).toMatchObject({ status: 'unbound', reason: 'ambiguous_credentials' })
    })

    it('accepts byte-identical values as one credential rather than an ambiguity', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY }),
      )
      expect(binding.status).toBe('bound')
      if (binding.status !== 'bound') throw new Error('expected a bound result')
      expect(binding.usedLegacyCredentialVariable).toBe(false)
    })
  })

  describe('loopback', () => {
    it('rejects a loopback URL as a production target', () => {
      for (const url of [
        'http://127.0.0.1:55321',
        'http://localhost:55321',
        'https://app.localhost',
      ]) {
        expect(resolve(productionEnvironment({ LITERATURE_SUPABASE_URL: url }))).toMatchObject({
          status: 'unbound',
          reason: 'loopback_not_permitted_in_production',
        })
      }
    })

    it('permits a loopback URL outside production', () => {
      const binding = resolve(
        {
          LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
          LITERATURE_SUPABASE_SECRET_KEY: 'local-development-placeholder',
          LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
        },
        'non_production',
      )
      expect(binding.status).toBe('bound')
    })

    it('refuses the protected real-local database port as a production target', () => {
      const binding = resolve(
        productionEnvironment({ LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55322' }),
      )
      expect(binding).toMatchObject({
        status: 'unbound',
        reason: 'loopback_not_permitted_in_production',
      })
    })
  })

  describe('secret safety', () => {
    it('never repeats a credential value in a failure message', () => {
      const failures = [
        resolve(productionEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: PUBLISHABLE_KEY })),
        resolve(productionEnvironment({ LITERATURE_SUPABASE_SERVICE_ROLE_KEY: OTHER_SECRET_KEY })),
        resolve(productionEnvironment({ LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321' })),
        resolve({ LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY }),
      ]
      for (const binding of failures) {
        expect(binding.status).toBe('unbound')
        if (binding.status !== 'unbound') continue
        expect(binding.message).not.toContain(SECRET_KEY)
        expect(binding.message).not.toContain(OTHER_SECRET_KEY)
        expect(binding.message).not.toContain(PUBLISHABLE_KEY)
      }
    })

    it('produces diagnostics that carry no credential', () => {
      const diagnostics = describeLiteratureBinding(resolve(productionEnvironment()))
      expect(JSON.stringify(diagnostics)).not.toContain(SECRET_KEY)
      expect(diagnostics).toMatchObject({ status: 'bound', projectRef: APPROVED_REF })
    })

    it('reports a distinct reason for each failure mode so the UI can tell them apart', () => {
      const reasons = new Set(
        [
          resolve({}),
          resolve({ LITERATURE_SUPABASE_URL: APPROVED_URL }),
          resolve(productionEnvironment({ LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: undefined })),
          resolve(productionEnvironment({ LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321' })),
          resolve(productionEnvironment({ LITERATURE_SUPABASE_SECRET_KEY: PUBLISHABLE_KEY })),
          resolve(
            productionEnvironment({
              LITERATURE_SUPABASE_URL: `https://${MAIN_REF}.supabase.co`,
              LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: MAIN_REF,
            }),
          ),
        ].map((binding) => (binding.status === 'unbound' ? binding.reason : 'bound')),
      )
      expect(reasons.size).toBe(6)
    })
  })
})
