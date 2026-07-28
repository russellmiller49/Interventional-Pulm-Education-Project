import fs from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations')
// Named for the version Supabase assigned when it was applied, so `supabase db push` does
// not see it as pending and try to run it a second time.
const MIGRATION_FILE = '20260727224807_add_ip_user_preference_cards.sql'
const DEPENDENCY_MIGRATIONS = ['20260605041809_add_main_site_auth_usage.sql']

const migration = fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), 'utf8')

describe('preference-card migration contract', () => {
  it('carries the builder entitlement forward', () => {
    // The one piece of the abandoned organization migration worth keeping.
    expect(migration).toContain("'preference_cards_builder'")
    expect(migration).toContain('site_entitlements_entitlement_check')
    for (const existing of [
      "'socal_ebus_course'",
      "'ip_registry'",
      "'site_admin'",
      "'pccm_intro_course'",
      "'pccm_intro_course_admin_ucsd'",
      "'pccm_intro_course_admin_loma_linda'",
      "'socrates_editor'",
    ]) {
      // Re-creating the constraint drops it first, so every prior value must be restated or
      // existing rows would start failing it.
      expect(migration).toContain(existing)
    }
  })

  it('creates the per-user card table with owner-only row-level security', () => {
    expect(migration).toContain('create table if not exists public.ip_user_preference_cards')
    expect(migration).toContain(
      'alter table public.ip_user_preference_cards enable row level security',
    )
    for (const policy of [
      'ip_user_preference_cards_select_own',
      'ip_user_preference_cards_insert_own',
      'ip_user_preference_cards_update_own',
      'ip_user_preference_cards_delete_own',
    ]) {
      expect(migration).toContain(policy)
    }
    // Every policy scopes to the caller; update needs both using and with check.
    const ownershipChecks = migration.match(/user_id = \(select auth\.uid\(\)\)/g) ?? []
    expect(ownershipChecks.length).toBeGreaterThanOrEqual(5)
  })

  it('pins the stored snapshot to a content hash', () => {
    expect(migration).toContain('ip_user_preference_cards_snapshot_hash_check')
    expect(migration).toContain("snapshot_hash ~ '^[a-f0-9]{64}$'")
  })

  it('shares only through the security-definer RPC, and never anonymously', () => {
    expect(migration).toContain('create or replace function public.ip_get_shared_preference_card')
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = public')
    // Sharing must be revocable: the RPC filters on the owner's current switch.
    expect(migration).toContain('and card.share_enabled')
    expect(migration).toContain(
      'revoke execute on function public.ip_get_shared_preference_card(uuid) from public, anon',
    )
    expect(migration).toContain(
      'grant execute on function public.ip_get_shared_preference_card(uuid) to authenticated, service_role',
    )
  })

  it('revokes blanket table access before granting it', () => {
    expect(migration).toContain(
      'revoke all on table public.ip_user_preference_cards from public, anon, authenticated',
    )
    expect(migration).toContain(
      'grant select, insert, update, delete on table public.ip_user_preference_cards to authenticated',
    )
    expect(migration).toContain("notify pgrst, 'reload schema'")
  })

  it('does not introduce common PHI fields', () => {
    expect(migration).not.toMatch(
      /\b(patient_name|mrn|date_of_birth|dob|encounter_number|diagnosis)\b/i,
    )
  })

  it('has dropped the never-applied organization schema', () => {
    // 1,606 lines of organization/site/room tables that were never pushed anywhere. Leaving
    // the file behind would invite someone to apply it alongside the per-user model.
    const files = fs.readdirSync(MIGRATIONS_DIR)
    expect(files).not.toContain('20260725210000_add_ip_preference_cards.sql')
    expect(files.filter((file) => file.includes('preference_cards'))).toEqual([MIGRATION_FILE])
  })

  it('sorts after every migration it depends on', () => {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort()
    const migrationIndex = files.indexOf(MIGRATION_FILE)
    expect(migrationIndex).toBeGreaterThanOrEqual(0)
    for (const dependency of DEPENDENCY_MIGRATIONS) {
      expect(files.indexOf(dependency)).toBeGreaterThanOrEqual(0)
      expect(files.indexOf(dependency)).toBeLessThan(migrationIndex)
    }
  })
})
