import { createHash } from 'node:crypto'
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

/**
 * The revision migrations. Both have shipped.
 *
 * `20260803052432_add_ip_preference_card_revisions.sql` was applied to the Endoreels project as
 * remote version `20260803113527_add_ip_preference_card_revisions`, and
 * `20260803151005_index_ip_preference_card_revision_foreign_keys.sql` followed as
 * `20260804015322_index_ip_preference_card_revision_foreign_keys`. Both verifiers passed against
 * the live database. From those moments each stopped being a file this branch may edit: an applied
 * migration edited afterwards describes a state no environment ever passed through, and the record
 * of what was actually verified becomes untrue. Both are pinned by content below, so a later edit
 * is a failing test rather than a silent divergence between the repository and the database.
 *
 * The index migration's pin was added when it was applied, which is the point the rule starts to
 * bite. Everything after them goes in a new forward migration — Phase 4B.2's provenance column is
 * the next one, and it is deliberately not pinned because it has *not* been applied and is still
 * open to review.
 */
describe('preference-card revision migrations', () => {
  const APPLIED_REVISION_MIGRATION = '20260803052432_add_ip_preference_card_revisions.sql'
  /** Applied as remote version 20260803113527; see the note above before changing this. */
  const APPLIED_REVISION_MIGRATION_SHA256 =
    'd10aa34dc55374b7f122db8cff6c0fd31393e34d07c15e142648a758d8bdff7a'

  const INDEX_MIGRATION = '20260803151005_index_ip_preference_card_revision_foreign_keys.sql'
  /** Applied as remote version 20260804015322; see the note above before changing this. */
  const INDEX_MIGRATION_SHA256 = '4f171acd9fafeaa1947ec64e343c03853d9171d584368ac2f89043c98440cc3f'
  const INDEX_VERIFIER = '20260803151005_verify_ip_preference_card_revision_foreign_keys.sql'
  const VERIFICATION_DIR = path.resolve(process.cwd(), 'supabase/verification')

  const indexMigration = fs.readFileSync(path.join(MIGRATIONS_DIR, INDEX_MIGRATION), 'utf8')
  const indexVerifier = fs.readFileSync(path.join(VERIFICATION_DIR, INDEX_VERIFIER), 'utf8')

  /**
   * The migration with its `--` comments removed.
   *
   * Structural assertions have to read statements, not prose. This file explains at length why it
   * does *not* use `create index concurrently` and what it deliberately leaves un-altered, so a
   * naive `not.toMatch(/create index concurrently/)` over the raw text fails on the sentence
   * saying the thing is not done — which is the opposite of what it means to check.
   */
  const indexMigrationSql = indexMigration
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')

  it('leaves the already-applied revision migration byte-identical', () => {
    const applied = fs.readFileSync(path.join(MIGRATIONS_DIR, APPLIED_REVISION_MIGRATION))
    expect(createHash('sha256').update(applied).digest('hex')).toBe(
      APPLIED_REVISION_MIGRATION_SHA256,
    )
  })

  it('leaves the already-applied index migration byte-identical', () => {
    const applied = fs.readFileSync(path.join(MIGRATIONS_DIR, INDEX_MIGRATION))
    expect(createHash('sha256').update(applied).digest('hex')).toBe(INDEX_MIGRATION_SHA256)
  })

  it('adds the index work as a new forward migration, ordered after the applied one', () => {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort()
    expect(files).toContain(INDEX_MIGRATION)
    expect(files.indexOf(INDEX_MIGRATION)).toBeGreaterThan(
      files.indexOf(APPLIED_REVISION_MIGRATION),
    )
  })

  it('creates exactly the two foreign-key covering indexes, with the columns in order', () => {
    expect(indexMigrationSql).toContain(
      'create index ip_user_preference_card_revisions_user_id_idx\n  on public.ip_user_preference_card_revisions (user_id);',
    )
    expect(indexMigrationSql).toContain(
      'create index ip_user_preference_card_revisions_card_owner_idx\n  on public.ip_user_preference_card_revisions (card_id, user_id);',
    )
    // Two `create index` statements and no more — an index nobody reviewed must not ride along.
    expect(indexMigrationSql.match(/^create index /gm)).toHaveLength(2)
  })

  it('uses a plain transactional create index, and refuses to adopt a name it did not create', () => {
    // Supabase applies migrations in a transaction, which `concurrently` cannot run inside.
    expect(indexMigrationSql).not.toMatch(/create index concurrently/i)
    // `if not exists` would silently accept a pre-existing index of unknown definition.
    expect(indexMigrationSql).not.toMatch(/create index if not exists/i)
  })

  it('drops and alters nothing', () => {
    for (const forbidden of [/^drop index/im, /^drop /im, /^alter table/im, /^alter index/im]) {
      expect(indexMigrationSql).not.toMatch(forbidden)
    }
    // The indexes published by the applied migration appear in this file only as commentary about
    // what is preserved — named, so a reader knows exactly what is being left alone, and never as
    // the object of a statement.
    for (const preserved of [
      'ip_user_preference_card_revisions_pkey',
      'ip_user_preference_card_revisions_card_number_idx',
      'ip_user_preference_card_revisions_card_created_idx',
    ]) {
      expect(indexMigration).toContain(preserved)
      expect(indexMigrationSql).not.toContain(preserved)
    }
  })

  it('ships a verifier that checks column order rather than index names', () => {
    // The load-bearing part: key columns resolved positionally out of `indkey`, so
    // `(user_id, card_id)` cannot pass as `(card_id, user_id)`.
    expect(indexVerifier).toContain('pg_index')
    expect(indexVerifier).toContain('pg_attribute')
    expect(indexVerifier).toContain('with ordinality')
    expect(indexVerifier).toContain("array['card_id', 'user_id']")
    expect(indexVerifier).toContain("array['user_id']")
    // And the properties a name check would miss entirely.
    for (const property of ['indisunique', 'indpred', 'indisvalid', 'indisready', 'amname']) {
      expect(indexVerifier).toContain(property)
    }
  })

  it('ships a verifier that reads only and proves it', () => {
    expect(indexVerifier.trimEnd().endsWith('rollback;')).toBe(true)
    for (const mutation of [
      /^insert into public\./im,
      /^update public\./im,
      /^delete from public\./im,
    ]) {
      expect(indexVerifier).not.toMatch(mutation)
    }
    // Row counts and content digests are compared before and after.
    expect(indexVerifier).toContain('verify_index_baseline')
  })

  it('asserts the original three indexes and both foreign keys survive', () => {
    for (const preserved of [
      'ip_user_preference_card_revisions_pkey',
      'ip_user_preference_card_revisions_card_number_idx',
      'ip_user_preference_card_revisions_card_created_idx',
      'ip_user_preference_card_revisions_user_id_fkey',
      'ip_user_preference_card_revisions_card_owner_fkey',
    ]) {
      expect(indexVerifier).toContain(preserved)
    }
  })
})

/**
 * The rebuild-provenance migration.
 *
 * A rebuilt card is an ordinary card in every respect — its own id, its own share token, its own
 * revision 1 — so nothing on it would otherwise say it was rebuilt, from what, or which decisions a
 * person actually answered. One nullable jsonb column carries that, and the properties worth
 * policing at source level are what it deliberately does *not* touch: the applied revision
 * machinery, and the definition of revision-bearing content.
 */
describe('preference-card rebuild provenance migration', () => {
  const REBUILD_MIGRATION = '20260804013000_add_ip_preference_card_rebuild_provenance.sql'
  const REBUILD_VERIFIER = '20260804013000_verify_ip_preference_card_rebuild_provenance.sql'
  const VERIFICATION_DIR = path.resolve(process.cwd(), 'supabase/verification')

  const rebuildMigration = fs.readFileSync(path.join(MIGRATIONS_DIR, REBUILD_MIGRATION), 'utf8')
  const rebuildVerifier = fs.readFileSync(path.join(VERIFICATION_DIR, REBUILD_VERIFIER), 'utf8')

  /** Statements only. The file argues at length about what it does not do; prose is not a check. */
  const rebuildMigrationSql = rebuildMigration
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')

  it('sorts after both revision migrations', () => {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort()
    expect(files).toContain(REBUILD_MIGRATION)
    expect(files.indexOf(REBUILD_MIGRATION)).toBeGreaterThan(
      files.indexOf('20260803151005_index_ip_preference_card_revision_foreign_keys.sql'),
    )
  })

  it('adds one nullable jsonb column, constrained to an object', () => {
    expect(rebuildMigrationSql).toContain('add column if not exists rebuild_provenance jsonb')
    expect(rebuildMigrationSql).toContain('ip_user_preference_cards_rebuild_provenance_check')
    expect(rebuildMigrationSql).toContain("jsonb_typeof(rebuild_provenance) = 'object'")
    // Nullable: almost no card is a rebuild, and a default object on the rest would be a claim.
    expect(rebuildMigrationSql).not.toMatch(/rebuild_provenance jsonb[^;]*not null/i)
  })

  it('makes the column write-once with a before-update trigger', () => {
    expect(rebuildMigrationSql).toContain(
      'create or replace function private.ip_reject_preference_card_rebuild_provenance_rewrite()',
    )
    expect(rebuildMigrationSql).toContain('before update on public.ip_user_preference_cards')
    expect(rebuildMigrationSql).toContain(
      'new.rebuild_provenance is distinct from old.rebuild_provenance',
    )
    expect(rebuildMigrationSql).toContain("errcode = 'restrict_violation'")
    // It calls nothing and reads nothing outside its own row, so it needs no privilege at all.
    expect(rebuildMigrationSql).toContain('security invoker')
    expect(rebuildMigrationSql).toContain("set search_path = ''")
  })

  it('leaves the applied revision machinery alone', () => {
    // The one function this migration must not redefine: it decides whether `updated_at` advances
    // and whether a revision is appended, and a column that can never change must not be in it.
    expect(rebuildMigrationSql).not.toContain('ip_preference_card_content_changed')
    expect(rebuildMigrationSql).not.toContain('ip_append_preference_card_revision')
    expect(rebuildMigrationSql).not.toMatch(
      /alter table public\.ip_user_preference_card_revisions/i,
    )
    expect(rebuildMigrationSql).not.toMatch(/^drop table/im)
    expect(rebuildMigrationSql).toContain("notify pgrst, 'reload schema'")
  })

  it('does not introduce common PHI fields', () => {
    expect(rebuildMigration).not.toMatch(
      /\b(patient_name|mrn|date_of_birth|dob|encounter_number|diagnosis)\b/i,
    )
  })

  it('ships a verifier that rolls back and proves the write-once rule behaviourally', () => {
    expect(rebuildVerifier.trimEnd().endsWith('rollback;')).toBe(true)
    // Existence of a trigger and a trigger firing are different facts; only the second is the
    // guarantee, so the verifier attempts the rewrite and requires it to fail.
    expect(rebuildVerifier).toContain('was overwritten and should not have been')
    expect(rebuildVerifier).toContain('was cleared and should not have been')
    expect(rebuildVerifier).toContain('a card that was not rebuilt was given rebuild provenance')
    // And it re-checks that this migration did not quietly become revision-bearing.
    expect(rebuildVerifier).toContain('ip_preference_card_content_changed')
    expect(rebuildVerifier).toContain('ALL CHECKS PASSED')
  })
})
