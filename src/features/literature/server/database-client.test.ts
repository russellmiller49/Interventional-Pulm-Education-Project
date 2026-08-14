import {
  describeLiteratureDatabaseBinding,
  literatureRuntimeMode,
  resolveLiteratureDatabaseConfiguration,
} from './database-client'
import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANONICAL_PRODUCTION_ORIGIN,
} from './dedicated-project-contract'

const APPROVED_REF = LITERATURE_APPROVED_PRODUCTION_PROJECT_REF
const APPROVED_URL = LITERATURE_CANONICAL_PRODUCTION_ORIGIN
const SECRET_KEY = 'sb_secret_EXAMPLE_PLACEHOLDER_NOT_A_CREDENTIAL'

describe('literature database configuration', () => {
  it('derives the mode from LITERATURE_SUPABASE_RUNTIME_MODE, never NODE_ENV', () => {
    expect(literatureRuntimeMode({ LITERATURE_SUPABASE_RUNTIME_MODE: 'local' })).toBe('local')
    expect(literatureRuntimeMode({})).toBe('production_strict')
    expect(literatureRuntimeMode({ NODE_ENV: 'development' } as Record<string, string>)).toBe(
      'production_strict',
    )
  })

  it('resolves the dedicated strict configuration', () => {
    expect(
      resolveLiteratureDatabaseConfiguration({
        LITERATURE_SUPABASE_URL: APPROVED_URL,
        LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      }),
    ).toEqual({ url: APPROVED_URL, secretKey: SECRET_KEY, projectRef: APPROVED_REF })
  })

  it('uses the dedicated local database for the existing local workflow', () => {
    // `npm run literature:local:start` writes LITERATURE_SUPABASE_URL and the legacy
    // LITERATURE_SUPABASE_SERVICE_ROLE_KEY into .env.local. That flow keeps working once the
    // explicit local mode is selected.
    expect(
      resolveLiteratureDatabaseConfiguration({
        LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
        LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
        LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'local-service-key',
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      }),
    ).toEqual({
      url: 'http://127.0.0.1:55321',
      secretKey: 'local-service-key',
      projectRef: APPROVED_REF,
    })
  })

  it('does not mix a partial literature override with anything else', () => {
    expect(
      resolveLiteratureDatabaseConfiguration({
        LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
        LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
      }),
    ).toBeNull()
  })

  it('no longer falls back to the main application database', () => {
    // The architectural correction. Previously an environment carrying only the main project's
    // variables resolved to the main project, so production Literature silently read an Endoreels
    // database that has no Literature schema.
    expect(
      resolveLiteratureDatabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY,
        SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co',
      } as Record<string, string>),
    ).toBeNull()
  })

  it('ignores NEXT_PUBLIC_* variables entirely when building the privileged client', () => {
    expect(
      resolveLiteratureDatabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: APPROVED_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_EXAMPLE_PLACEHOLDER',
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      } as Record<string, string>),
    ).toBeNull()
  })

  it('exposes typed diagnostics so a later UI can tell unavailable from empty', () => {
    const notConfigured = describeLiteratureDatabaseBinding({})
    expect(notConfigured).toMatchObject({ status: 'unbound', reason: 'not_configured' })

    const wrongScheme = describeLiteratureDatabaseBinding({
      LITERATURE_SUPABASE_URL: `http://${APPROVED_REF}.supabase.co`,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(wrongScheme).toMatchObject({ status: 'unbound', reason: 'insecure_url_scheme' })
    expect(notConfigured.reason).not.toBe(wrongScheme.reason)
  })

  it('never places a credential in the diagnostics payload', () => {
    const diagnostics = describeLiteratureDatabaseBinding({
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(JSON.stringify(diagnostics)).not.toContain(SECRET_KEY)
  })
})
