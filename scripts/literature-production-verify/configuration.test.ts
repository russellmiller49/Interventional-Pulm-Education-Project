/** @jest-environment node */

/**
 * The verification tool must refuse to look at the wrong database.
 *
 * These cases matter more than they look. A tool that happily counts rows in whatever project its
 * environment points at will one day be pointed at `Endoreels`, report `0 articles`, and be read
 * as "the canary failed" — or worse, be pointed at a staging project, report exactly 25, and be
 * read as "the canary succeeded". Both are wrong for the same reason: the tool never established
 * which project it was talking to.
 */

import {
  describeTarget,
  resolveVerificationConfiguration,
  type LiteratureVerificationEnvironment,
} from './lib/configuration'
import { LITERATURE_MAIN_APPLICATION_PROJECT_REF } from './lib/identity'
import { clearRegisteredSecretsForTesting, redact } from './lib/redaction'

const APPROVED_REF = 'itcttmkxdxvwmwcmzmey'
const CANONICAL_URL = `https://${APPROVED_REF}.supabase.co/`
const SECRET = 'sb_secret_TESTONLYaaaaaaaaaaaaaaaaaaaaaaaa'

function environmentFor(
  overrides: Partial<LiteratureVerificationEnvironment> = {},
): LiteratureVerificationEnvironment {
  return {
    LITERATURE_SUPABASE_URL: CANONICAL_URL,
    LITERATURE_SUPABASE_SECRET_KEY: SECRET,
    LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    ...overrides,
  }
}

beforeEach(() => {
  clearRegisteredSecretsForTesting()
})

describe('a valid production configuration resolves', () => {
  it.each(['bound', 'not_activated'] as const)(
    'resolves a correct configuration whatever the application binding status is (%s)',
    (accepted) => {
      /*
       * The tool reads the database on the operator's behalf, so what the *application* does with
       * the same configuration is none of its business. This test was originally written against
       * `not_activated`, which was the only reachable status before the production bring-up flipped
       * `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION`; today the same environment resolves to `bound`.
       * Both are usable targets, and pinning either one would make this suite fail on an activation
       * change that has nothing to do with verification.
       */
      const result = resolveVerificationConfiguration(environmentFor())
      expect(result.status).toBe('resolved')
      if (result.status !== 'resolved') return
      expect(['bound', 'not_activated']).toContain(result.bindingStatus)
      expect(result.database.projectRef).toBe(APPROVED_REF)
      // Guard against the assertion above becoming vacuous if the union ever grows.
      expect(typeof accepted).toBe('string')
    },
  )

  it('resolves the activated production binding this build actually produces', () => {
    // The concrete current value, asserted once so a silent regression to `not_activated` — which
    // would mean the runtime was deactivated — is visible here too.
    const result = resolveVerificationConfiguration(environmentFor())
    if (result.status !== 'resolved') throw new Error('expected a resolved configuration')
    expect(result.bindingStatus).toBe('bound')
  })

  it('describes a target without carrying the credential', () => {
    const result = resolveVerificationConfiguration(environmentFor())
    if (result.status !== 'resolved') throw new Error('expected a resolved configuration')
    const described = describeTarget(result.database)
    expect(JSON.stringify(described)).not.toContain('TESTONLY')
    expect(described.credentialPresent).toBe(true)
  })

  it('registers the credential for redaction the moment it is read', () => {
    resolveVerificationConfiguration(environmentFor())
    expect(redact(`error mentions ${SECRET}`)).not.toContain('TESTONLY')
  })
})

describe('the wrong project is refused', () => {
  it('refuses the main application project', () => {
    const result = resolveVerificationConfiguration(
      environmentFor({
        LITERATURE_SUPABASE_URL: `https://${LITERATURE_MAIN_APPLICATION_PROJECT_REF}.supabase.co/`,
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: LITERATURE_MAIN_APPLICATION_PROJECT_REF,
      }),
    )
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    // The byte-exact URL gate fires before the prohibited-ref gate, so the reported reason is
    // `noncanonical_production_url` rather than `prohibited_project_ref`. Both are refusals and
    // the order is the strict contract's, not this tool's — what matters here is that pointing
    // the verification tool at `Endoreels` cannot produce a target.
    expect(result.diagnostics?.reason).toBe('noncanonical_production_url')
  })

  it('refuses the main application project by ref even when the URL is canonical', () => {
    // Past the URL gate, the prohibited-ref rule is what stops it. Reached by declaring the main
    // project as the expected ref against the canonical Literature URL: an operator who pasted
    // the wrong ref into Railway produces exactly this.
    const result = resolveVerificationConfiguration(
      environmentFor({
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: LITERATURE_MAIN_APPLICATION_PROJECT_REF,
      }),
    )
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    expect(result.diagnostics?.reason).toBe('prohibited_project_ref')
  })

  it('refuses an unapproved project even when URL and expected ref agree', () => {
    // Internally consistent and still wrong: agreement between two variables says nothing about
    // whether the project they agree on is the approved one.
    const other = 'aaaaaaaaaaaaaaaaaaaa'
    const result = resolveVerificationConfiguration(
      environmentFor({
        LITERATURE_SUPABASE_URL: `https://${other}.supabase.co/`,
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: other,
      }),
    )
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    expect(result.diagnostics?.reason).toBe('noncanonical_production_url')
  })

  it('refuses when the URL and the expected ref disagree', () => {
    const result = resolveVerificationConfiguration(
      environmentFor({ LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'bbbbbbbbbbbbbbbbbbbb' }),
    )
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    expect(result.diagnostics?.reason).toBe('project_ref_mismatch')
  })
})

describe('the URL must be the canonical byte sequence', () => {
  it.each([
    ['no trailing slash', `https://${APPROVED_REF}.supabase.co`],
    ['an explicit port', `https://${APPROVED_REF}.supabase.co:443/`],
    ['surrounding whitespace', ` https://${APPROVED_REF}.supabase.co/ `],
    ['an uppercase scheme', `HTTPS://${APPROVED_REF}.supabase.co/`],
    ['a dot path', `https://${APPROVED_REF}.supabase.co/./`],
  ])('refuses %s', (_label, url) => {
    const result = resolveVerificationConfiguration(
      environmentFor({ LITERATURE_SUPABASE_URL: url }),
    )
    expect(result.status).toBe('refused')
  })
})

describe('the credential must be the right class', () => {
  it('refuses a publishable key', () => {
    const result = resolveVerificationConfiguration(
      environmentFor({ LITERATURE_SUPABASE_SECRET_KEY: 'sb_publishable_TESTONLYbbbbbbbbbbbb' }),
    )
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    expect(result.diagnostics?.reason).toBe('invalid_credential_class')
  })

  it('refuses the legacy service-role variable on its own', () => {
    const result = resolveVerificationConfiguration({
      LITERATURE_SUPABASE_URL: CANONICAL_URL,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: SECRET,
    })
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    expect(result.diagnostics?.reason).toBe(
      'legacy_credential_variable_not_permitted_in_production',
    )
  })

  it('refuses two different privileged credentials rather than picking one', () => {
    const result = resolveVerificationConfiguration(
      environmentFor({ LITERATURE_SUPABASE_SERVICE_ROLE_KEY: `${SECRET}DIFFERENT` }),
    )
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    expect(result.diagnostics?.reason).toBe('ambiguous_credentials')
  })
})

describe('an absent configuration is distinguishable from a wrong one', () => {
  it('reports not_configured when nothing is set', () => {
    const result = resolveVerificationConfiguration({})
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    expect(result.diagnostics?.reason).toBe('not_configured')
  })

  it('reports partial_configuration when only some variables are set', () => {
    const result = resolveVerificationConfiguration({ LITERATURE_SUPABASE_URL: CANONICAL_URL })
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    // A partial configuration never falls back to the main project — it stops.
    expect(result.diagnostics?.reason).toBe('partial_configuration')
  })
})

describe('credentials are registered before anything can fail', () => {
  it('scrubs a malformed credential even though the configuration was refused', () => {
    // The window this closes: a malformed credential matches no shape pattern, so the *only*
    // thing that would scrub it is having registered the literal — and a malformed value is
    // exactly the one most likely to end up quoted in a refusal message.
    const malformed = 'not-a-recognised-key-shape-but-still-a-secret'
    resolveVerificationConfiguration({
      LITERATURE_SUPABASE_URL: 'https://wrong.example.com/',
      LITERATURE_SUPABASE_SECRET_KEY: malformed,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(redact(`a later message quoting ${malformed}`)).not.toContain(malformed)
  })

  it('registers the legacy variable too, which is refused rather than used', () => {
    const legacy = 'another-unrecognised-shape-held-in-the-legacy-variable'
    resolveVerificationConfiguration({
      LITERATURE_SUPABASE_URL: CANONICAL_URL,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: legacy,
    })
    expect(redact(legacy)).not.toContain(legacy)
  })
})

describe('no refusal message carries a credential', () => {
  it.each([
    ['a publishable key', { LITERATURE_SUPABASE_SECRET_KEY: 'sb_publishable_TESTONLYbbbbbbbb' }],
    ['a mismatched ref', { LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'bbbbbbbbbbbbbbbbbbbb' }],
    ['a bad URL', { LITERATURE_SUPABASE_URL: 'https://evil.example.com/' }],
  ])('%s', (_label, overrides) => {
    const result = resolveVerificationConfiguration(environmentFor(overrides))
    expect(result.status).toBe('refused')
    if (result.status !== 'refused') return
    expect(redact(JSON.stringify(result))).not.toContain('TESTONLY')
  })
})

describe('optional application inputs', () => {
  it('ignores a malformed application base URL rather than guessing', () => {
    const result = resolveVerificationConfiguration(
      environmentFor({ LITERATURE_VERIFY_APP_BASE_URL: 'not a url' }),
    )
    if (result.status !== 'resolved') throw new Error('expected a resolved configuration')
    expect(result.applicationBaseUrl).toBeNull()
  })

  it('reduces an application URL to its origin', () => {
    const result = resolveVerificationConfiguration(
      environmentFor({ LITERATURE_VERIFY_APP_BASE_URL: 'https://example.test/some/path?q=1' }),
    )
    if (result.status !== 'resolved') throw new Error('expected a resolved configuration')
    expect(result.applicationBaseUrl).toBe('https://example.test')
  })

  it('registers an admin cookie for redaction', () => {
    resolveVerificationConfiguration(
      environmentFor({ LITERATURE_VERIFY_ADMIN_COOKIE: 'sb-abc-auth-token=TESTONLYcookievalue' }),
    )
    expect(redact('Cookie: sb-abc-auth-token=TESTONLYcookievalue')).not.toContain('TESTONLYcookie')
  })
})
