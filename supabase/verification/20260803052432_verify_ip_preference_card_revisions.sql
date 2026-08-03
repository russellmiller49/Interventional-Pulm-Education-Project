-- Verification for 20260803052432_add_ip_preference_card_revisions.sql
--
-- Run this once, against the project, immediately after applying that migration. It proves the
-- properties the application relies on but cannot check for itself: that revisions really are
-- trigger-only, that `updated_at` really is a strictly advancing content version, and that a
-- signed-in owner can actually write a card — the last of which is not a formality. An earlier
-- draft of the migration had a `security invoker` trigger calling a helper whose `execute` was
-- revoked from `authenticated`, so every authenticated card update failed with
-- `42501 permission denied for function`. Nothing in this script's first draft touched the parent
-- card table as `authenticated`, so nothing in it noticed. Part 3 exists because of that.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and execute it as one script. It is a
--   single transaction that ends in `rollback`, so it is **non-destructive by construction**:
--   the temporary cards it creates, edits, renames, shares, and deletes never exist outside the
--   transaction, and no card belonging to anybody is touched. Read the NOTICE output.
--
--   A failed assertion raises and aborts the script. Every negative test catches exactly the
--   error class it expects, so an unexpected failure propagates and aborts rather than being
--   mistaken for the refusal under test. The final "ALL CHECKS PASSED" notice is the pass
--   condition; anything else is a failure to read.
--
-- WHAT IT DOES NOT DO
--   It does not exercise PostgREST, so "authenticated cannot insert a revision" is verified at the
--   database level — role privileges, RLS policies, and actual attempted writes as `authenticated`
--   — rather than over HTTP. That is the layer the guarantee lives at; the API inherits it.

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

-- Grants: `select` and nothing else, for every Data API role.
--
-- `service_role` is the one that matters most and is easiest to get wrong. Supabase ships
-- `alter default privileges in schema public grant all on tables to service_role`, so a new table
-- in `public` arrives with insert/update/delete already granted to it without any statement in the
-- migration saying so — and `service_role` bypasses RLS, so no policy can close that. A migration
-- that revokes from `public, anon, authenticated` and forgets `service_role` leaves exactly that
-- hole, and this is the check that finds it.
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
  select string_agg(distinct grantee, ', ' order by grantee)
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

-- The internal machinery lives in `private`, which no Data API role may even enter.
do $$
declare
  leaked text;
begin
  if to_regnamespace('private') is null then
    raise exception 'FAIL: schema private does not exist';
  end if;

  select string_agg(role_name, ', ' order by role_name)
    into leaked
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
   where pg_catalog.has_schema_privilege(role_name, 'private', 'USAGE');
  if leaked is not null then
    raise exception 'FAIL: these roles hold USAGE on schema private: %', leaked;
  end if;
  raise notice 'OK  schema private exists and no Data API role has USAGE on it';
end $$;

-- The machinery is in `private` and nothing was left behind in `public`.
do $$
declare
  stragglers text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into stragglers
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'ip_append_preference_card_revision',
       'ip_assign_preference_card_revision_number',
       'ip_preference_card_content_changed',
       'ip_set_preference_card_content_updated_at',
       'ip_reject_preference_card_revision_rewrite'
     );
  if stragglers is not null then
    raise exception 'FAIL: revision machinery still present in the exposed public schema: %',
      stragglers;
  end if;
  raise notice 'OK  no revision machinery left in the exposed public schema';
end $$;

do $$
declare
  missing text;
begin
  select string_agg(expected, ', ' order by expected)
    into missing
    from unnest(array[
      'ip_append_preference_card_revision',
      'ip_assign_preference_card_revision_number',
      'ip_preference_card_content_changed',
      'ip_set_preference_card_content_updated_at',
      'ip_reject_preference_card_revision_rewrite'
    ]) as expected
   where not exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.proname = expected
   );
  if missing is not null then
    raise exception 'FAIL: expected functions missing from schema private: %', missing;
  end if;
  raise notice 'OK  all revision machinery lives in schema private';
end $$;

-- Every function must pin an empty search_path, or a caller-controlled one could resolve names
-- inside a definer function to something of the caller's choosing.
do $$
declare
  bad text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname like 'ip_%'
     and not coalesce(p.proconfig, '{}') @> array['search_path=']::text[];
  if bad is not null then
    raise exception 'FAIL: these private functions do not pin an empty search_path: %', bad;
  end if;
  raise notice 'OK  private functions pin an empty search_path';
end $$;

-- Any trigger function that calls the content helper must be SECURITY DEFINER. As invoker it
-- would run as the signed-in owner, who has neither USAGE on `private` nor EXECUTE on the helper,
-- and every authenticated card write would fail with 42501. This is the static form of the check;
-- Part 3 is the behavioural one.
do $$
declare
  bad text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname in (
       'ip_append_preference_card_revision',
       'ip_assign_preference_card_revision_number',
       'ip_set_preference_card_content_updated_at'
     )
     and not p.prosecdef;
  if bad is not null then
    raise exception
      'FAIL: these trigger functions reach into private but are not SECURITY DEFINER, so an authenticated write will fail with 42501: %',
      bad;
  end if;
  raise notice 'OK  every trigger function that reaches into private is SECURITY DEFINER';
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
   where n.nspname = 'private'
     and p.proname like 'ip_%'
     and a.privilege_type = 'EXECUTE'
     and g.grantee in ('public', 'anon', 'authenticated', 'service_role');
  if callable is not null then
    raise exception 'FAIL: private functions are directly callable by a client role: %', callable;
  end if;
  raise notice 'OK  private functions are not callable by any Data API role';
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
-- Part 2 — behaviour as the migration owner, against a temporary card, all rolled back.
-- =============================================================================================

do $$
declare
  test_user uuid;
  test_card uuid;
  v1 timestamptz;
  v2 timestamptz;
  v3 timestamptz;
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

  -- ---- content edit: strictly advancing timestamp, revision 2 -------------------------------
  --
  -- This whole DO block is one transaction, which is the point. `now()` is transaction start time
  -- and would return an identical value here, so a trigger built on it produces two content
  -- versions that compare equal — and a stale save would then be indistinguishable from a current
  -- one. `clock_timestamp()` plus a strict-advance floor is what makes this assertion pass.
  update public.ip_user_preference_cards
     set status = 'final'
   where id = test_card
   returning updated_at into v2;
  if v2 <= v1 then
    raise exception 'FAIL: content version did not strictly advance within one transaction (% -> %); a transaction-stable now() cannot back an optimistic-concurrency token', v1, v2;
  end if;

  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 2 then raise exception 'FAIL: a content edit produced % revision(s), expected 2', n; end if;
  raise notice 'OK  content edit strictly advances updated_at and creates revision 2';

  -- ---- rename creates revision 3, and advances again -----------------------------------------
  update public.ip_user_preference_cards
     set title = 'VERIFY renamed', physician_name = 'Verify Two'
   where id = test_card
   returning updated_at into v3;
  if v3 <= v2 then
    raise exception 'FAIL: a second content change in the same transaction did not advance (% -> %)', v2, v3;
  end if;
  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 3 then raise exception 'FAIL: a rename produced % revision(s), expected 3', n; end if;
  raise notice 'OK  rename advances again and creates revision 3';

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
  -- Only `check_violation` is caught. A different error here — a typo, a missing column, a
  -- not-null failure — propagates and aborts, rather than being mistaken for the refusal.
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
      'verify-engine', clock_timestamp(), test_user
    );
  exception when check_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'FAIL: a revision whose extracted hash disagrees with its payload was accepted';
  end if;
  raise notice 'OK  consistency constraint rejects an extracted column that disagrees with its payload';

  -- ---- the owner itself cannot rewrite a revision ---------------------------------------------
  -- The table owner is subject to neither the grants nor the policies, so the append-only trigger
  -- is the only barrier that applies to it. `restrict_violation` is what that trigger raises.
  failed := false;
  begin
    update public.ip_user_preference_card_revisions
       set title = 'VERIFY rewritten' where card_id = test_card and revision_number = 1;
  exception when restrict_violation then
    failed := true;
  end;
  if not failed then raise exception 'FAIL: a revision row was rewritten by the table owner'; end if;
  raise notice 'OK  append-only trigger refuses a rewrite even by the table owner';

  -- ---- deleting the card cascades its revisions -----------------------------------------------
  delete from public.ip_user_preference_cards where id = test_card;
  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 0 then raise exception 'FAIL: % revision(s) outlived the deleted card', n; end if;
  raise notice 'OK  deleting a card cascades its revisions';
end $$;

-- =============================================================================================
-- Part 3 — as the `authenticated` role. The signed-in owner must be able to write a card, and
--          must not be able to touch the revision table directly.
-- =============================================================================================
--
-- This is the part that would have caught the 42501 privilege bug. Every check above passed with
-- that bug present, because none of them wrote to the parent card table as `authenticated`.

do $$
declare
  test_user uuid;
  test_card uuid;
  foreign_card uuid;
  other_user uuid;
  v1 timestamptz;
  v2 timestamptz;
  n integer;
  failed boolean;
begin
  select id into test_user from auth.users order by created_at limit 1;
  if test_user is null then
    raise notice 'SKIP authenticated-role checks: no auth.users row available';
    return;
  end if;
  select id into other_user from auth.users where id <> test_user order by created_at limit 1;

  -- A card owned by somebody else, so "cannot touch a foreign card" is testable. Created as the
  -- owner, before dropping privileges.
  if other_user is not null then
    insert into public.ip_user_preference_cards (
      user_id, title, procedure_code, scenario_id, status,
      builder_inputs, card_snapshot, snapshot_hash, engine_version, catalog_import_id
    )
    values (
      other_user, 'VERIFY foreign card', 'FLEX_BRONCH', 'verify-scenario', 'draft',
      '{}'::jsonb, '{}'::jsonb, repeat('9', 64), 'verify-engine', 'verify-catalog'
    )
    returning id into foreign_card;
  end if;

  -- Claims first, then the role: once dropped to `authenticated` the session should not be
  -- configuring itself, and this order keeps the switch one-way.
  perform set_config('request.jwt.claims', json_build_object('sub', test_user)::text, true);
  set local role authenticated;

  -- ---- the signed-in owner can create a card, and it produces revision 1 ---------------------
  -- If a trigger function that reaches into `private` is not SECURITY DEFINER, this is where the
  -- script stops with `42501 permission denied for function`.
  insert into public.ip_user_preference_cards (
    user_id, title, procedure_code, scenario_id, status,
    builder_inputs, card_snapshot, snapshot_hash, engine_version, catalog_import_id
  )
  values (
    test_user, 'VERIFY authenticated card', 'FLEX_BRONCH', 'verify-scenario', 'draft',
    '{}'::jsonb, '{}'::jsonb, repeat('1', 64), 'verify-engine', 'verify-catalog'
  )
  returning id, updated_at into test_card, v1;

  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 1 then
    raise exception 'FAIL: an authenticated card insert produced % revision(s), expected 1', n;
  end if;
  raise notice 'OK  authenticated owner can create a card, and the trigger appends revision 1';

  -- ---- the signed-in owner can edit it, and it produces revision 2 ---------------------------
  update public.ip_user_preference_cards
     set title = 'VERIFY authenticated edit'
   where id = test_card
   returning updated_at into v2;
  if v2 <= v1 then
    raise exception 'FAIL: an authenticated content edit did not advance the content version';
  end if;

  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 2 then
    raise exception 'FAIL: an authenticated content edit produced % revision(s), expected 2', n;
  end if;
  raise notice 'OK  authenticated owner can edit a card, and the trigger appends revision 2';

  -- ---- share toggle as the owner: no revision, timestamp held --------------------------------
  update public.ip_user_preference_cards set share_enabled = true where id = test_card;
  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 2 then
    raise exception 'FAIL: an authenticated share toggle produced a revision (now %)', n;
  end if;
  perform 1 from public.ip_user_preference_cards where id = test_card and updated_at = v2;
  if not found then
    raise exception 'FAIL: an authenticated share toggle moved the content version';
  end if;
  raise notice 'OK  authenticated share toggle creates no revision and holds the content version';

  -- ---- the conditional update, as the application actually issues it -------------------------
  update public.ip_user_preference_cards
     set title = 'VERIFY authenticated stale'
   where id = test_card and updated_at = v1;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: an authenticated stale conditional update matched % row(s)', n;
  end if;
  raise notice 'OK  authenticated stale conditional update matches nothing';

  -- ---- a foreign card stays invisible and unwritable -----------------------------------------
  if foreign_card is not null then
    update public.ip_user_preference_cards set title = 'VERIFY hijacked' where id = foreign_card;
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FAIL: an authenticated user updated a card belonging to somebody else';
    end if;

    perform 1 from public.ip_user_preference_card_revisions where card_id = foreign_card;
    if found then
      raise exception 'FAIL: an authenticated user can read another user''s revisions';
    end if;
    raise notice 'OK  a foreign card is neither writable nor readable';
  else
    raise notice 'SKIP foreign-card checks: only one auth.users row exists';
  end if;

  -- ---- direct writes to the revision table are refused ----------------------------------------
  -- Only `insufficient_privilege` is caught. Anything else propagates: a constraint failure or a
  -- typo must not be able to masquerade as the refusal under test.
  failed := false;
  begin
    insert into public.ip_user_preference_card_revisions (
      card_id, user_id, revision_number, title, status, procedure_code, scenario_id,
      builder_inputs, card_snapshot, snapshot_hash, engine_version, created_at, created_by
    )
    values (
      test_card, test_user, 42, 'VERIFY forged revision', 'final', 'FLEX_BRONCH',
      'verify-scenario', '{}'::jsonb, '{}'::jsonb, repeat('f', 64), 'forged',
      clock_timestamp(), test_user
    );
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then
    raise exception 'FAIL: an authenticated client inserted a revision directly';
  end if;
  -- A SET LOCAL made *inside* an aborted subtransaction would be undone; this one was made
  -- outside it, so the role stands. Re-asserted anyway, because a silent revert to superuser
  -- would make every remaining negative check pass for the wrong reason.
  set local role authenticated;
  raise notice 'OK  authenticated cannot insert a revision directly';

  failed := false;
  begin
    update public.ip_user_preference_card_revisions
       set title = 'VERIFY forged rewrite' where card_id = test_card;
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'FAIL: an authenticated client updated a revision'; end if;
  set local role authenticated;
  raise notice 'OK  authenticated cannot update a revision';

  failed := false;
  begin
    delete from public.ip_user_preference_card_revisions where card_id = test_card;
  exception when insufficient_privilege then
    failed := true;
  end;
  if not failed then raise exception 'FAIL: an authenticated client deleted a revision'; end if;
  set local role authenticated;
  raise notice 'OK  authenticated cannot delete a revision';

  -- Reading its own is exactly what it may do.
  select count(*) into n
    from public.ip_user_preference_card_revisions where card_id = test_card;
  if n <> 2 then
    raise exception 'FAIL: authenticated sees % of its own revisions, expected 2', n;
  end if;
  raise notice 'OK  authenticated can read its own revisions';

  if current_user <> 'authenticated' then
    raise exception 'FAIL: the role reverted mid-test; the negative checks above are not trustworthy';
  end if;

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
