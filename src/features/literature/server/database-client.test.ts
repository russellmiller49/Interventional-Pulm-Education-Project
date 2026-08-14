import {
  describeLiteratureDatabaseBinding,
  literatureRuntimeMode,
  resolveLiteratureDatabaseConfiguration,
} from './database-client'
import { LITERATURE_APPROVED_PRODUCTION_PROJECT_REF } from './dedicated-project-contract'

const APPROVED_REF = LITERATURE_APPROVED_PRODUCTION_PROJECT_REF
const APPROVED_URL = `https://${APPROVED_REF}.supabase.co`
const SECRET_KEY = 'sb_secret_EXAMPLE_PLACEHOLDER_NOT_A_CREDENTIAL'

describe('literature database configuration', () => {
  it('treats only NODE_ENV=production as production', () => {
    expect(literatureRuntimeMode({ NODE_ENV: 'production' })).toBe('production')
    expect(literatureRuntimeMode({ NODE_ENV: 'development' })).toBe('non_production')
    expect(literatureRuntimeMode({ NODE_ENV: 'test' })).toBe('non_production')
    expect(literatureRuntimeMode({})).toBe('non_production')
  })

  it('resolves the dedicated production configuration', () => {
    expect(
      resolveLiteratureDatabaseConfiguration({
        NODE_ENV: 'production',
        LITERATURE_SUPABASE_URL: APPROVED_URL,
        LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      }),
    ).toEqual({
      url: APPROVED_URL,
      secretKey: SECRET_KEY,
      projectRef: APPROVED_REF,
    })
  })

  it('uses the dedicated local database for the existing local workflow', () => {
    // `npm run literature:local:start` writes LITERATURE_SUPABASE_URL and the legacy
    // LITERATURE_SUPABASE_SERVICE_ROLE_KEY into .env.local. That flow keeps working unchanged
    // outside production; only the expected-ref variable is newly required.
    expect(
      resolveLiteratureDatabaseConfiguration({
        NODE_ENV: 'development',
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
        NODE_ENV: 'development',
        LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
      }),
    ).toBeNull()
  })

  it('no longer falls back to the main application database', () => {
    // This is the architectural correction. Previously an environment carrying only the main
    // project's variables resolved to the main project, so production Literature silently read an
    // Endoreels database that has no Literature schema. It must now be "not configured".
    expect(
      resolveLiteratureDatabaseConfiguration({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: SECRET_KEY,
        SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co',
      } as Record<string, string>),
    ).toBeNull()
  })

  it('ignores NEXT_PUBLIC_* variables entirely when building the privileged client', () => {
    expect(
      resolveLiteratureDatabaseConfiguration({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: APPROVED_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_EXAMPLE_PLACEHOLDER',
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
      } as Record<string, string>),
    ).toBeNull()
  })

  it('exposes typed diagnostics so a later UI can tell unavailable from empty', () => {
    const notConfigured = describeLiteratureDatabaseBinding({ NODE_ENV: 'production' })
    expect(notConfigured).toMatchObject({ status: 'unbound', reason: 'not_configured' })

    const wrongProject = describeLiteratureDatabaseBinding({
      NODE_ENV: 'production',
      LITERATURE_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co',
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'tqnhxlwvkkswuckszlee',
    })
    expect(wrongProject).toMatchObject({ status: 'unbound', reason: 'prohibited_project_ref' })
    expect(notConfigured.reason).not.toBe(wrongProject.reason)
  })

  it('never places a credential in the diagnostics payload', () => {
    const diagnostics = describeLiteratureDatabaseBinding({
      NODE_ENV: 'production',
      LITERATURE_SUPABASE_URL: APPROVED_URL,
      LITERATURE_SUPABASE_SECRET_KEY: SECRET_KEY,
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(JSON.stringify(diagnostics)).not.toContain(SECRET_KEY)
  })
})
