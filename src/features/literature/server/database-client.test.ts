import { resolveLiteratureDatabaseConfiguration } from './database-client'

describe('literature database configuration', () => {
  it('uses the dedicated literature database when both override values are configured', () => {
    expect(
      resolveLiteratureDatabaseConfiguration({
        LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
        LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'local-service-key',
        SUPABASE_URL: 'https://remote.example.com',
        SUPABASE_SERVICE_ROLE_KEY: 'remote-service-key',
      }),
    ).toEqual({
      url: 'http://127.0.0.1:55321',
      serviceRoleKey: 'local-service-key',
    })
  })

  it('does not mix a partial literature override with the main database credentials', () => {
    expect(
      resolveLiteratureDatabaseConfiguration({
        LITERATURE_SUPABASE_URL: 'http://127.0.0.1:55321',
        SUPABASE_URL: 'https://remote.example.com',
        SUPABASE_SERVICE_ROLE_KEY: 'remote-service-key',
      }),
    ).toBeNull()
  })

  it('keeps the existing main database as a backwards-compatible fallback', () => {
    expect(
      resolveLiteratureDatabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: 'https://remote.example.com',
        SUPABASE_SERVICE_ROLE_KEY: 'remote-service-key',
      }),
    ).toEqual({
      url: 'https://remote.example.com',
      serviceRoleKey: 'remote-service-key',
    })
  })
})
