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
  /**
   * The verifier's statements, without its prose.
   *
   * It explains at length that it contains no `when others`, so a naive search over the raw text
   * finds the sentence saying the thing is not done — the same trap the index migration documents.
   */
  const rebuildVerifierSql = rebuildVerifier
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')

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

  it('adds one nullable jsonb column with strict first-use DDL', () => {
    expect(rebuildMigrationSql).toContain('add column rebuild_provenance jsonb')
    expect(rebuildMigrationSql).toContain('ip_user_preference_cards_rebuild_provenance_check')
    expect(rebuildMigrationSql).toContain("jsonb_typeof(rebuild_provenance) = 'object'")
    // Nullable: almost no card is a rebuild, and a default object on the rest would be a claim.
    expect(rebuildMigrationSql).not.toMatch(/rebuild_provenance jsonb[^;]*not null/i)
    // This migration has never been applied, so tolerance buys nothing and hides drift. The only
    // `drop` it may contain is the live insert policy it deliberately replaces.
    expect(rebuildMigrationSql).not.toMatch(/if not exists/i)
    expect(rebuildMigrationSql).not.toMatch(/create or replace/i)
    expect(rebuildMigrationSql).not.toMatch(/drop\s+(trigger|function|constraint)\s+if exists/i)
    const drops = rebuildMigrationSql.match(/^drop /gm) ?? []
    expect(drops).toHaveLength(1)
    expect(rebuildMigrationSql).toContain(
      'drop policy ip_user_preference_cards_insert_own on public.ip_user_preference_cards',
    )
  })

  it('narrows the authenticated insert policy so provenance cannot be forged', () => {
    // BLOCKER 1: the live policy checked ownership only, and `authenticated` holds INSERT.
    expect(rebuildMigrationSql).toContain('create policy ip_user_preference_cards_insert_own')
    expect(rebuildMigrationSql).toContain(
      'with check (user_id = (select auth.uid()) and rebuild_provenance is null)',
    )
  })

  it('rejects a non-null provenance insert from every role but the dedicated writer', () => {
    // `service_role` has bypassrls, so a policy cannot stop it. A trigger can.
    expect(rebuildMigrationSql).toContain(
      'create function private.ip_reject_untrusted_preference_card_rebuild_provenance()',
    )
    expect(rebuildMigrationSql).toContain("current_user <> 'ip_preference_card_rebuild_writer'")
    expect(rebuildMigrationSql).toContain('before insert on public.ip_user_preference_cards')
  })

  it('creates one narrow trusted writer, executable only by the service role', () => {
    expect(rebuildMigrationSql).toContain('create role ip_preference_card_rebuild_writer nologin')
    expect(rebuildMigrationSql).toContain(
      'create function public.ip_create_rebuilt_preference_card(',
    )
    expect(rebuildMigrationSql).toContain('security definer')
    expect(rebuildMigrationSql).toContain("set search_path = ''")
    expect(rebuildMigrationSql).toContain('owner to ip_preference_card_rebuild_writer')
    expect(rebuildMigrationSql).toMatch(
      /revoke all on function public\.ip_create_rebuilt_preference_card\([^)]*\) from public, anon, authenticated/,
    )
    expect(rebuildMigrationSql).toMatch(
      /grant execute on function public\.ip_create_rebuilt_preference_card\([^)]*\) to service_role/,
    )
    // Always a draft, and the source's sharing state is never carried.
    expect(rebuildMigrationSql).toContain("'draft'")
    expect(rebuildMigrationSql).not.toMatch(/share_token/)
  })

  it('gives the writer role membership back after the ownership transfer', () => {
    // MEDIUM 1: the grant existed for one statement — `alter function ... owner to` requires the
    // caller to be able to `set role` to the new owner — and used to be left behind. A later
    // session as the migration role could then `set role ip_preference_card_rebuild_writer` and
    // satisfy both the writer-only insert guard and the writer's own RLS policy with a direct
    // insert, bypassing every source recheck the RPC performs.
    const grant = rebuildMigrationSql.indexOf(
      'grant ip_preference_card_rebuild_writer to current_user',
    )
    const transfer = rebuildMigrationSql.indexOf('owner to ip_preference_card_rebuild_writer')
    const execute = rebuildMigrationSql.indexOf('grant execute on function')
    const revoke = rebuildMigrationSql.indexOf(
      'revoke ip_preference_card_rebuild_writer from current_user',
    )
    expect(grant).toBeGreaterThan(-1)
    expect(revoke).toBeGreaterThan(-1)
    expect(grant).toBeLessThan(transfer)
    // After the ACL is settled, so the transfer and the grants both still have what they need.
    expect(transfer).toBeLessThan(revoke)
    expect(execute).toBeLessThan(revoke)
    expect(
      rebuildMigrationSql.match(/grant ip_preference_card_rebuild_writer to current_user/g),
    ).toHaveLength(1)
    expect(
      rebuildMigrationSql.match(/revoke ip_preference_card_rebuild_writer from current_user/g),
    ).toHaveLength(1)
  })

  it('grants the writer schema create for exactly the ownership transfer, then revokes it', () => {
    // `alter function ... owner to` needs the *new owner* to hold create on the function's schema,
    // and the managed migration role is `createrole` but not `rolsuper`, so the superuser exception
    // does not apply. Without the temporary grant the statement fails and nothing installs.
    const grant = rebuildMigrationSql.indexOf(
      'grant create on schema public to ip_preference_card_rebuild_writer',
    )
    const transfer = rebuildMigrationSql.indexOf('owner to ip_preference_card_rebuild_writer')
    const revoke = rebuildMigrationSql.indexOf(
      'revoke create on schema public from ip_preference_card_rebuild_writer',
    )
    expect(grant).toBeGreaterThan(-1)
    expect(revoke).toBeGreaterThan(-1)
    expect(grant).toBeLessThan(transfer)
    expect(transfer).toBeLessThan(revoke)
    // Exactly once each: a second grant that outlived the transfer would leave the writer able to
    // create objects in `public`, which is the authority the role exists not to have.
    expect(rebuildMigrationSql.match(/grant create on schema public/g)).toHaveLength(1)
    expect(rebuildMigrationSql.match(/revoke create on schema public/g)).toHaveLength(1)
    // Usage survives the revoke; the function is in `public` and has to be reachable.
    expect(rebuildMigrationSql).toContain(
      'grant usage on schema public to ip_preference_card_rebuild_writer',
    )
  })

  it('binds the stored document to every source fact the revision row knows', () => {
    // Checking only the parallel arguments authenticated the *call* and not the evidence: one real
    // tuple satisfied the join while a fabricated revision number or hash was frozen into a
    // write-once column.
    expect(rebuildMigrationSql).toContain("p_rebuild_provenance->>'sourceCardId'")
    expect(rebuildMigrationSql).toContain("p_rebuild_provenance->>'sourceRevisionId'")
    expect(rebuildMigrationSql).toContain("p_rebuild_provenance->>'sourceSnapshotHash'")
    expect(rebuildMigrationSql).toContain("p_rebuild_provenance->>'sourceReleaseBundleId'")
    for (const [column, field] of [
      ['revision.revision_number::text', 'sourceRevisionNumber'],
      ['revision.snapshot_integrity_hash', 'sourceSnapshotIntegrityHash'],
      ['revision.resolved_content_hash', 'sourceResolvedContentHash'],
    ]) {
      expect(rebuildMigrationSql.replace(/\s+/g, ' ')).toContain(
        `and ${column} is not distinct from p_rebuild_provenance->>'${field}'`,
      )
    }
    // One validator, called rather than restated inline, so the accepted shape has one definition.
    expect(rebuildMigrationSql).toContain(
      'perform private.ip_validate_preference_card_rebuild_provenance_v1(p_rebuild_provenance)',
    )
    expect(rebuildMigrationSql).toContain(
      'create function private.ip_validate_preference_card_rebuild_provenance_v1(',
    )
    // The owner claim the document could not previously make at all.
    expect(rebuildMigrationSql).toContain("p_rebuild_provenance->>'sourceOwnerId'")
  })

  it('keeps the shape validator private and callable by no API role', () => {
    expect(rebuildMigrationSql).toMatch(
      /revoke all on function private\.ip_validate_preference_card_rebuild_provenance_v1\(jsonb\)\s+from anon, authenticated, service_role/,
    )
    expect(rebuildMigrationSql).toContain('security invoker')
    // Total over its input: a document that is not an object is a shape failure, not a crash.
    expect(rebuildMigrationSql).toContain(
      "if document is null or jsonb_typeof(document) <> 'object' then",
    )
  })

  it('requires the print-document hash but does not claim to authenticate it', () => {
    // Derived in TypeScript from the integrity hash and the four printed columns, and not stored on
    // the revision, so there is nothing in the database to bind its *value* to. The key is still
    // required and type-checked — a document may not simply omit a claim version 1 defines — and
    // the distinction is stated rather than left to be inferred from its absence.
    expect(rebuildMigrationSql).toContain("'sourcePrintDocumentHash'")
    // Required and nullable, like the other two revision-derived hashes.
    const validator = rebuildMigrationSql.slice(
      rebuildMigrationSql.indexOf('required_keys text[] := array['),
      rebuildMigrationSql.indexOf('uuid_keys text[] :='),
    )
    expect(validator).toContain("'sourcePrintDocumentHash'")
    // But never bound to a revision column, because no revision column holds it.
    const insert = rebuildMigrationSql.slice(
      rebuildMigrationSql.indexOf('from public.ip_user_preference_card_revisions as revision'),
      rebuildMigrationSql.indexOf('returning id into created_id'),
    )
    expect(insert).not.toContain('sourcePrintDocumentHash')
    expect(rebuildMigration).toContain('One field is deliberately **not** database-authenticated')
  })

  it('re-derives the source inside the same statement that inserts', () => {
    // The validation-to-insert race: no separate select, so there is no window for a concurrent
    // delete between "the source was verified" and "the row was written".
    expect(rebuildMigrationSql).toContain(
      'from public.ip_user_preference_card_revisions as revision',
    )
    expect(rebuildMigrationSql).toContain('and revision.card_id = p_source_card_id')
    expect(rebuildMigrationSql).toContain('and revision.user_id = p_owner_id')
    expect(rebuildMigrationSql).toContain('and revision.snapshot_hash = p_source_snapshot_hash')
  })

  it('makes the column write-once with a before-update trigger', () => {
    expect(rebuildMigrationSql).toContain(
      'create function private.ip_reject_preference_card_rebuild_provenance_rewrite()',
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

  it('ships a verifier that is a role matrix, not a postgres-only smoke test', () => {
    expect(rebuildVerifier.trimEnd().endsWith('rollback;')).toBe(true)
    // The failure that made the first verifier worthless: it inserted as `postgres`, so it never
    // met the insert policy at all, and it caught every negative case with `when others`.
    expect(rebuildVerifierSql).not.toMatch(/when others/i)
    for (const role of ['set local role authenticated', 'set local role service_role']) {
      expect(rebuildVerifier).toContain(role)
    }
    expect(rebuildVerifier).toContain("current_user <> 'authenticated'")
    expect(rebuildVerifier).toContain("current_user <> 'service_role'")
    expect(rebuildVerifier).toContain('request.jwt.claims')
    // Exact codes, never a bare catch. The writer cases distinguish "the source moved" from "the
    // document does not describe it", which is the whole point of binding the document.
    expect(rebuildVerifier).toContain('when restrict_violation then null')
    expect(rebuildVerifier).toContain('when insufficient_privilege then null')
    expect(rebuildVerifier).toContain('when no_data_found or invalid_parameter_value then')
    expect(rebuildVerifier).toContain('get stacked diagnostics state = returned_sqlstate')
    expect(rebuildVerifier).toContain('but must raise %')
  })

  it('expects the insert guard, not the policy, to refuse an authenticated forgery', () => {
    // The second verifier accepted `23001` *or* `42501` there. `BEFORE` row triggers run before
    // the policy's `WITH CHECK`, and the preceding ordinary insert proves the policy is satisfied
    // for an otherwise identical row — so accepting a privilege error would let a broken guard
    // pass on the strength of the layer above it.
    const forgery = rebuildVerifier.slice(
      rebuildVerifier.indexOf('-- (b) The same insert carrying provenance'),
      rebuildVerifier.indexOf('-- (c) Inserting for somebody else'),
    )
    expect(forgery).toContain('when restrict_violation then null')
    expect(forgery).not.toContain('insufficient_privilege')
  })

  it('ships a verifier whose Part 5 fixture can actually reach the positive case', () => {
    // The defect that stopped the second verifier dead: its provenance object omitted
    // `sourceSnapshotHash`, so the first writer call raised `invalid_parameter_value` where the
    // handler expected `no_data_found`, and the transaction aborted before anything was proved.
    // Every field the function binds has to be in the fixture, and the nullable ones as explicit
    // JSON nulls rather than omitted keys.
    const fixtureStart = rebuildVerifier.indexOf('provenance := jsonb_build_object(')
    const fixture = rebuildVerifier.slice(
      fixtureStart,
      rebuildVerifier.indexOf('set local role service_role;', fixtureStart),
    )
    expect(fixtureStart).toBeGreaterThan(-1)
    for (const field of [
      "'version', 'ip-cards-rebuild/1'",
      "'sourceCardId'",
      "'sourceRevisionId'",
      "'sourceSnapshotHash'",
      "'sourceReleaseBundleId'",
      "'sourceRevisionNumber'",
      "'sourceSnapshotIntegrityHash', null::text",
      "'sourceResolvedContentHash', null::text",
      "'sourcePrintDocumentHash', null::text",
      "'sourceOwnerId'",
      "'allowedFinalStateHash'",
      "'decisions'",
      "'createdAt'",
    ]) {
      expect(fixture).toContain(field)
    }
    // And the positive call has to be reachable from the fixture, not from a second object.
    expect(rebuildVerifier).toContain("'verify rebuilt', null::text, 'VERIFY_ONLY'")
    expect(rebuildVerifier).toContain('the writer did not create a card')
    expect(rebuildVerifier).toContain("the rebuilt card''s first revision is not numbered 1")
  })

  it('ships a verifier that proves authenticity, not only immutability', () => {
    // The blocker, as a behavioural check, for every role that could reach the table.
    expect(rebuildVerifier).toContain('an authenticated user forged rebuild_provenance at INSERT')
    expect(rebuildVerifier).toContain('an authenticated user added provenance by UPDATE')
    expect(rebuildVerifier).toContain('an authenticated user executed the trusted writer function')
    expect(rebuildVerifier).toContain(
      'service_role forged rebuild_provenance through a direct table insert',
    )
    expect(rebuildVerifier).toContain('service_role added provenance to an existing card by UPDATE')
    expect(rebuildVerifier).toContain(
      'the table owner forged rebuild_provenance through a direct table insert',
    )
    // The role itself, not only its `nologin` flag.
    expect(rebuildVerifier).toContain('the writer role holds a login or administrative attribute')
    expect(rebuildVerifier).toContain('rolbypassrls')
    expect(rebuildVerifier).toContain('the writer role retained CREATE on schema public')
    expect(rebuildVerifier).toContain('the writer role is a member of another role')
    expect(rebuildVerifier).toContain('the writer role still has members')
    expect(rebuildVerifier).toContain('the migration role can still assume the writer role')
    expect(rebuildVerifier).toContain('a member of the writer role remains at the end of the run')
    expect(rebuildVerifier).toContain('the writer role does not own exactly one function')
    expect(rebuildVerifier).toContain('the writer role holds a write privilege it does not need')
    // The ACL by grantee, so PUBLIC and any extra grantee are rejected rather than two names.
    expect(rebuildVerifier).toContain('aclexplode')
    expect(rebuildVerifier).toContain(
      'the writer function has the default ACL, which grants EXECUTE to PUBLIC',
    )
    expect(rebuildVerifier).toContain('neither its owner nor the service role')
    expect(rebuildVerifier).toContain('an API role can execute the writer function')
    // Every way the payload can lie, each with its own case and its own exact code.
    for (const label of [
      'a stale snapshot hash',
      'a different owner',
      "another card''s id",
      "another card''s revision",
      'a release the revision does not pin',
      'a revision that does not exist',
      'a document naming a different card than the call',
      'a document fabricating the revision number',
      'a document fabricating the snapshot integrity hash',
      'a document fabricating the resolved content hash',
      'a document at an unknown version',
      'a document omitting a nullable hash instead of stating it',
      'a document naming an owner the call did not',
      'a document omitting the owner',
      'a document omitting the allowed-final-state hash',
      'a document omitting the reviewed decisions',
      'a document carrying a key version 1 does not define',
      'a document whose uuid field is not a uuid',
      'a document whose decision entry is malformed',
      'a document stating a non-nullable field as null',
    ]) {
      expect(rebuildVerifier).toContain(label)
    }
    expect(rebuildVerifier).toContain('the refused case "%" still wrote rows')
    expect(rebuildVerifier).toContain('the refused authenticated forgery still wrote rows')
    // The shape of what the trusted path creates, and that it left the source alone.
    expect(rebuildVerifier).toContain('the rebuilt card inherited the source share token')
    expect(rebuildVerifier).toContain('the source card changed during the rebuild')
    // All three write-once directions, plus ordinary work, a content edit, and a duplicate.
    expect(rebuildVerifier).toContain('provenance was overwritten')
    expect(rebuildVerifier).toContain('provenance was cleared')
    expect(rebuildVerifier).toContain('a card that was not rebuilt was given provenance')
    expect(rebuildVerifier).toContain('a rename disturbed provenance')
    expect(rebuildVerifier).toContain('a share toggle disturbed provenance')
    expect(rebuildVerifier).toContain('a status change disturbed provenance')
    // Both roles, not only the table owner: `service_role` is the one a compromised key would use.
    expect(rebuildVerifier).toContain("array['postgres_owner', 'service_role']")
    expect(rebuildVerifier).toContain('provenance was overwritten as %')
    expect(rebuildVerifier).toContain('a content edit disturbed provenance')
    expect(rebuildVerifier).toContain('a duplicate of a rebuilt card inherited its provenance')
    // Structure, cleanup, and an exact baseline comparison rather than a lower bound.
    expect(rebuildVerifier).toContain('ip_preference_card_content_changed')
    expect(rebuildVerifier).toContain('card content digest changed')
    expect(rebuildVerifier).toContain('revision content digest changed')
    expect(rebuildVerifier).toContain(
      "delete from public.ip_user_preference_cards where procedure_code = 'VERIFY_ONLY'",
    )
    expect(rebuildVerifier).toContain('ALL CHECKS PASSED')
  })
})
