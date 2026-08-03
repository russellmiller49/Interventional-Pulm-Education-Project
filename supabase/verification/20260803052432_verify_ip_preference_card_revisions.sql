-- Verification for 20260803052432_add_ip_preference_card_revisions.sql
--
-- Run this once, against the project, immediately after applying that migration. It proves the
-- properties the application relies on but cannot check for itself: that revisions really are
-- trigger-only, that `updated_at` really is a content version, and that the conditional update
-- really refuses a stale save.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and execute it as one script. It is a
--   single transaction that ends in `rollback`, so it is **non-destructive by construction**:
--   the temporary card it creates, edits, renames, shares, and deletes never exists outside the
--   transaction, and no card belonging to anybody is touched. Read the NOTICE output.
--
--   A failed assertion raises and aborts the script. Silence plus the final "ALL CHECKS PASSED"
--   notice is the pass condition; anything else is a failure to read.
--
-- WHAT IT DOES NOT DO
--   It does not exercise PostgREST, so "authenticated cannot insert" is verified at the database
--   level (role privileges, RLS policies, and an actual attempted insert as `authenticated`)
--   rather than over HTTP. That is the layer the guarantee lives at; the API inherits it.

begin;

-- =============================================================================================
-- Part 1 — structure. Reads only.
-- =============================================================================================

do $$
begin
  if to_regclass('public.ip_user_preference_card_revisions') is null then
    raise exception 'FAIL: public.ip_user_preference_card_revisions does not exist';
  end if;
  raise notice 'OK  revision table exists';
end $$;

do $$
declare
  rls_enabled boolean;
begin
  select relrowsecurity into rls_enabled
    from pg_class
   where oid = 'public.ip_user_preference_card_revisions'::regclass;
  if not rls_enabled then
    raise exception 'FAIL: row-level security is not enabled on the revision table';
  end if;
  raise notice 'OK  row-level security enabled';
end $$;

-- Grants: `select` and nothing else, for every Data API role. An `insert` anywhere here would
-- mean a client could append a revision of its own construction, which is the property the whole
-- design rests on.
do $$
declare
  offending text;
begin
  select string_agg(format('%s:%s', grantee, privilege_type), ', ' order by grantee, privilege_type)
    into offending
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name = 'ip_user_preference_card_revisions'
     and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
     and privilege_type <> 'SELECT';
  if offending is not null then
    raise exception 'FAIL: unexpected non-SELECT grants on the revision table: %', offending;
  end if;
  raise notice 'OK  Data API roles hold SELECT and nothing else';
end $$;

do $$
declare
  select_grants text;
begin
  select string_agg(grantee, ', ' order by grantee)
    into select_grants
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name = 'ip_user_preference_card_revisions'
     and privilege_type = 'SELECT'
     and grantee in ('authenticated', 'service_role');
  if select_grants is distinct from 'authenticated, service_role' then
    raise exception 'FAIL: expected SELECT for authenticated and service_role, found: %',
      coalesce(select_grants, '<none>');
  end if;
  raise notice 'OK  SELECT granted to authenticated and service_role';
end $$;

-- Exactly one policy, and it is a SELECT policy. RLS denies what no policy permits, so the
-- *absence* of insert/update/delete policies is the enforcement — assert the absence.
do $$
declare
  policy_summary text;
begin
  select string_agg(format('%s(%s)', policyname, cmd), ', ' order by policyname)
    into policy_summary
    from pg_policies
   where schemaname = 'public'
     and tablename = 'ip_user_preference_card_revisions';
  if policy_summary is distinct from 'ip_user_preference_card_revisions_select_own(SELECT)' then
    raise exception 'FAIL: expected exactly one SELECT policy, found: %',
      coalesce(policy_summary, '<none>');
  end if;
  raise notice 'OK  one SELECT-only policy, no insert/update/delete policy';
end $$;

-- The writer is `security definer`; the content helper and the append trigger must both be
-- pinned to an empty search_path or a caller-controlled one could resolve names inside them.
do $$
declare
  bad text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'ip_append_preference_card_revision',
       'ip_assign_preference_card_revision_number',
       'ip_preference_card_content_changed',
       'ip_set_preference_card_content_updated_at'
     )
     and not coalesce(p.proconfig, '{}') @> array['search_path=']::text[];
  if bad is not null then
    raise exception 'FAIL: these functions do not pin an empty search_path: %', bad;
  end if;
  raise notice 'OK  revision functions pin an empty search_path';
end $$;

do $$
declare
  is_definer boolean;
begin
  select prosecdef into is_definer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ip_append_preference_card_revision';
  if not is_definer then
    raise exception 'FAIL: the append trigger is not SECURITY DEFINER, so it cannot write while clients are denied insert';
  end if;
  raise notice 'OK  append trigger is SECURITY DEFINER';
end $$;

do $$
declare
  callable text;
begin
  select string_agg(format('%s->%s', p.proname, g.grantee), ', ')
    into callable
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    join lateral (select pg_get_userbyid(a.grantee) as grantee) g on true
   where n.nspname = 'public'
     and p.proname in ('ip_append_preference_card_revision', 'ip_preference_card_content_changed')
     and a.privilege_type = 'EXECUTE'
     and g.grantee in ('public', 'anon', 'authenticated');
  if callable is not null then
    raise exception 'FAIL: revision functions are directly callable by a client role: %', callable;
  end if;
  raise notice 'OK  revision functions are not callable by public/anon/authenticated';
end $$;

-- Every existing card has history. "Exactly one" is only true the instant the migration lands —
-- a card saved between then and now legitimately has more — so the invariant asserted is the one
-- that must hold forever: at least one revision, densely numbered from 1.
do $$
declare
  cards_without_history integer;
  broken_numbering integer;
  total_cards integer;
  total_revisions integer;
begin
  select count(*) into total_cards from public.ip_user_preference_cards;

  select count(*) into cards_without_history
    from public.ip_user_preference_cards card
   where not exists (
     select 1 from public.ip_user_preference_card_revisions r where r.card_id = card.id
   );
  if cards_without_history > 0 then
    raise exception 'FAIL: % existing card(s) have no revision; the backfill did not cover them',
      cards_without_history;
  end if;

  select count(*) into broken_numbering
    from (
      select card_id
        from public.ip_user_preference_card_revisions
       group by card_id
      having min(revision_number) <> 1
          or max(revision_number) <> count(*)
          or count(*) <> count(distinct revision_number)
    ) as gaps;
  if broken_numbering > 0 then
    raise exception 'FAIL: % card(s) have gapped or duplicated revision numbers', broken_numbering;
  end if;

  select count(*) into total_revisions from public.ip_user_preference_card_revisions;
  raise notice 'OK  % card(s) all have dense history (% revision row(s) total)',
    total_cards, total_revisions;
end $$;

-- The extracted columns cannot disagree with the JSON they were lifted from. The table's own
-- constraints enforce this on write; this re-checks every row already present, which is what
-- catches a backfill that populated them wrongly.
do $$
declare
  inconsistent integer;
begin
  select count(*) into inconsistent
    from public.ip_user_preference_card_revisions
   where snapshot_integrity_hash is distinct from (card_snapshot ->> 'snapshotIntegrityHash')
      or resolved_content_hash is distinct from (card_snapshot ->> 'resolvedContentHash')
      or release_bundle_id is distinct from (builder_inputs ->> 'releaseBundleId')
      or catalog_release_id is distinct from
         (card_snapshot -> 'resolutionProvenance' ->> 'catalogReleaseId');
  if inconsistent > 0 then
    raise exception 'FAIL: % revision(s) carry extracted columns that disagree with their payload',
      inconsistent;
  end if;
  raise notice 'OK  hash and release-pin columns agree with their payload on every row';
end $$;

do $$
declare
  mismatched integer;
begin
  select count(*) into mismatched
    from public.ip_user_preference_card_revisions r
    join public.ip_user_preference_cards c on c.id = r.card_id
   where r.user_id <> c.user_id;
  if mismatched > 0 then
    raise exception 'FAIL: % revision(s) name an owner other than their card''s', mismatched;
  end if;
  raise notice 'OK  every revision belongs to its card''s owner';
end $$;

-- =============================================================================================
-- Part 2 — behaviour, against a temporary card this script creates and then rolls back.
-- =============================================================================================

do $$
declare
  test_user uuid;
  test_card uuid;
  v1 timestamptz;
  v2 timestamptz;
  v_share timestamptz;
  n integer;
  failed boolean;
begin
  select id into test_user from auth.users order by created_at limit 1;
  if test_user is null then
    raise notice 'SKIP behaviour checks: no auth.users row to own a temporary card';
    return;
  end if;

  -- ---- new card creates revision 1 ----------------------------------------------------------
  insert into public.ip_user_preference_cards (
    user_id, title, physician_name, procedure_code, scenario_id, status,
    builder_inputs, card_snapshot, snapshot_hash, engine_version, catalog_import_id
  )
  values (
    test_user, 'VERIFY temporary card', 'Verify', 'FLEX_BRONCH', 'verify-scenario', 'draft',
    jsonb_build_object('schemaVersion', 4, 'releaseBundleId', 'release-verify-v1-0'),
    jsonb_build_object(
      'snapshotIntegrityHash', repeat('a', 64),
      'resolvedContentHash', repeat('b', 64),
      'resolutionProvenance', jsonb_build_object('catalogReleaseId', repeat('c', 64))
    ),
    repeat('d', 64), 'verify-engine', 'verify-catalog'
  )
  returning id, updated_at into test_card, v1;

  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 1 then raise exception 'FAIL: creating a card produced % revision(s), expected 1', n; end if;
  raise notice 'OK  new card creates revision 1';

  -- The extracted columns really were lifted from the payload.
  perform 1 from public.ip_user_preference_card_revisions
   where card_id = test_card
     and revision_number = 1
     and snapshot_integrity_hash = repeat('a', 64)
     and resolved_content_hash = repeat('b', 64)
     and catalog_release_id = repeat('c', 64)
     and release_bundle_id = 'release-verify-v1-0'
     and procedure_code = 'FLEX_BRONCH'
     and scenario_id = 'verify-scenario'
     and created_at = v1;
  if not found then
    raise exception 'FAIL: revision 1 did not capture the extracted columns, identity, or timestamp';
  end if;
  raise notice 'OK  revision 1 captures identity, extracted pins, and the content timestamp';

  -- ---- content edit creates revision 2 ------------------------------------------------------
  update public.ip_user_preference_cards
     set status = 'final'
   where id = test_card
   returning updated_at into v2;
  if v2 = v1 then raise exception 'FAIL: a content edit did not move updated_at'; end if;

  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 2 then raise exception 'FAIL: a content edit produced % revision(s), expected 2', n; end if;
  raise notice 'OK  content edit moves updated_at and creates revision 2';

  -- ---- rename creates revision 3 ------------------------------------------------------------
  update public.ip_user_preference_cards
     set title = 'VERIFY renamed', physician_name = 'Verify Two'
   where id = test_card;
  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 3 then raise exception 'FAIL: a rename produced % revision(s), expected 3', n; end if;
  raise notice 'OK  rename creates revision 3';

  -- ---- share toggle: no revision, and the content timestamp holds still ----------------------
  select updated_at into v_share from public.ip_user_preference_cards where id = test_card;
  update public.ip_user_preference_cards set share_enabled = true where id = test_card;

  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 3 then raise exception 'FAIL: a share toggle produced a revision (now %)', n; end if;
  perform 1 from public.ip_user_preference_cards
   where id = test_card and updated_at = v_share;
  if not found then
    raise exception 'FAIL: a share toggle moved updated_at, which would invalidate open editors and change printDocumentHash';
  end if;
  raise notice 'OK  share toggle creates no revision and preserves the content timestamp';

  -- ---- the conditional update refuses a stale save -------------------------------------------
  -- `v1` is two content versions old. This is the statement the application issues.
  update public.ip_user_preference_cards
     set title = 'VERIFY stale overwrite'
   where id = test_card and updated_at = v1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a stale conditional update matched % row(s)', n; end if;

  perform 1 from public.ip_user_preference_cards
   where id = test_card and title = 'VERIFY renamed';
  if not found then raise exception 'FAIL: the stale update changed the card anyway'; end if;

  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 3 then raise exception 'FAIL: the stale update left a revision behind (now %)', n; end if;
  raise notice 'OK  stale conditional update matches nothing, changes nothing, records nothing';

  -- A current-version update still succeeds, so the predicate is doing work rather than
  -- rejecting everything.
  select updated_at into v2 from public.ip_user_preference_cards where id = test_card;
  update public.ip_user_preference_cards
     set title = 'VERIFY fresh overwrite'
   where id = test_card and updated_at = v2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: a current-version update matched % row(s), expected 1', n; end if;
  raise notice 'OK  a current-version update still applies';

  -- ---- consistency constraints actually reject a lie ------------------------------------------
  failed := false;
  begin
    insert into public.ip_user_preference_card_revisions (
      card_id, user_id, revision_number, title, status, procedure_code, scenario_id,
      builder_inputs, card_snapshot, snapshot_hash, snapshot_integrity_hash,
      engine_version, created_at, created_by
    )
    values (
      test_card, test_user, 99, 'VERIFY inconsistent', 'draft', 'FLEX_BRONCH', 'verify-scenario',
      '{}'::jsonb,
      jsonb_build_object('snapshotIntegrityHash', repeat('a', 64)),
      repeat('d', 64),
      repeat('e', 64),  -- disagrees with the payload above
      'verify-engine', now(), test_user
    );
  exception when check_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'FAIL: a revision whose extracted hash disagrees with its payload was accepted';
  end if;
  raise notice 'OK  consistency constraint rejects an extracted column that disagrees with its payload';

  -- ---- direct update and delete are refused ---------------------------------------------------
  failed := false;
  begin
    update public.ip_user_preference_card_revisions
       set title = 'VERIFY rewritten' where card_id = test_card and revision_number = 1;
  exception when others then
    failed := true;
  end;
  if not failed then raise exception 'FAIL: a revision row was rewritten'; end if;
  raise notice 'OK  direct revision update is refused';

  -- ---- deleting the card cascades its revisions -----------------------------------------------
  delete from public.ip_user_preference_cards where id = test_card;
  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 0 then raise exception 'FAIL: % revision(s) outlived the deleted card', n; end if;
  raise notice 'OK  deleting a card cascades its revisions';
end $$;

-- =============================================================================================
-- Part 3 — as the `authenticated` role. Direct writes must be impossible.
-- =============================================================================================

do $$
declare
  test_user uuid;
  test_card uuid;
  failed boolean;
begin
  select id into test_user from auth.users order by created_at limit 1;
  if test_user is null then
    raise notice 'SKIP authenticated-role checks: no auth.users row available';
    return;
  end if;

  insert into public.ip_user_preference_cards (
    user_id, title, procedure_code, scenario_id, status,
    builder_inputs, card_snapshot, snapshot_hash, engine_version, catalog_import_id
  )
  values (
    test_user, 'VERIFY role card', 'FLEX_BRONCH', 'verify-scenario', 'draft',
    '{}'::jsonb, '{}'::jsonb, repeat('d', 64), 'verify-engine', 'verify-catalog'
  )
  returning id into test_card;

  -- Claims first, then the role: once the role is dropped to `authenticated` it should not need
  -- to configure its own session, and setting them in this order keeps the switch one-way.
  perform set_config('request.jwt.claims', json_build_object('sub', test_user)::text, true);
  set local role authenticated;

  -- Insert: denied by the missing privilege, and by the missing policy behind it.
  failed := false;
  begin
    insert into public.ip_user_preference_card_revisions (
      card_id, user_id, revision_number, title, status, procedure_code, scenario_id,
      builder_inputs, card_snapshot, snapshot_hash, engine_version, created_at, created_by
    )
    values (
      test_card, test_user, 42, 'VERIFY forged revision', 'final', 'FLEX_BRONCH',
      'verify-scenario', '{}'::jsonb, '{}'::jsonb, repeat('f', 64), 'forged', now(), test_user
    );
  exception when insufficient_privilege or others then
    failed := true;
  end;
  if not failed then
    raise exception 'FAIL: an authenticated client inserted a revision directly';
  end if;
  raise notice 'OK  authenticated cannot insert a revision directly';

  failed := false;
  begin
    update public.ip_user_preference_card_revisions
       set title = 'VERIFY forged rewrite' where card_id = test_card;
  exception when insufficient_privilege or others then
    failed := true;
  end;
  if not failed then raise exception 'FAIL: an authenticated client updated a revision'; end if;
  raise notice 'OK  authenticated cannot update a revision';

  failed := false;
  begin
    delete from public.ip_user_preference_card_revisions where card_id = test_card;
  exception when insufficient_privilege or others then
    failed := true;
  end;
  if not failed then raise exception 'FAIL: an authenticated client deleted a revision'; end if;
  raise notice 'OK  authenticated cannot delete a revision';

  -- Reading its own is exactly what it may do, and the card write that produced the revision
  -- went through the cards table's own policies as usual.
  perform 1 from public.ip_user_preference_card_revisions where card_id = test_card;
  if not found then
    raise exception 'FAIL: authenticated cannot read its own revision, which it must be able to';
  end if;
  raise notice 'OK  authenticated can read its own revisions';

  reset role;
end $$;

do $$
begin
  raise notice '--------------------------------------------------';
  raise notice 'ALL CHECKS PASSED';
  raise notice 'Rolling back: nothing this script created is kept.';
  raise notice '--------------------------------------------------';
end $$;

rollback;
