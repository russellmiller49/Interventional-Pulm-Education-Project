-- Verification for 20260804013000_add_ip_preference_card_rebuild_provenance.sql
--
-- Run once, against the project, immediately after applying that migration.
--
-- The previous version of this file was not trustworthy and an independent review said so. It
-- inserted both of its synthetic cards as `postgres`, so it never met row-level security or the
-- authenticated insert policy at all; and every negative case was wrapped in `exception when others`,
-- so *any* error counted as the expected one. It could print ALL CHECKS PASSED while the central
-- authenticity boundary was wide open. This version is a role matrix with exact SQLSTATEs.
--
-- WHAT IT ESTABLISHES
--   Authenticity, not merely immutability. `rebuild_provenance` is evidence that a reviewed rebuild
--   happened, so what has to be proved is that nothing except one narrow function can write it:
--   not an authenticated user through PostgREST, not the service role through the table, and not a
--   later update by anybody.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and execute it as one script. Everything runs
--   inside one transaction that ends in `rollback`, and the row counts and content digests taken at
--   the start are re-compared at the end, so "this left the data alone" is checked rather than
--   claimed. A failed assertion raises and aborts; the final ALL CHECKS PASSED notice is the pass
--   condition.
--
-- HOW IT FAILS
--   Every negative case names the exact SQLSTATE it expects — `23001` (`restrict_violation`) for the
--   guards, `42501` for a policy refusal — and re-raises anything else. There is no `when others`
--   in this file, deliberately: a check that accepts any error is not a check.
--
--   Run it against a scratch schema whose authenticated insert policy omits the provenance
--   condition, or whose trigger raises a different code, and Part 3 must fail. A verifier that
--   cannot fail is not evidence.

begin;

create temporary table verify_rebuild_baseline on commit drop as
select
  (select count(*) from public.ip_user_preference_cards) as card_count,
  (select count(*) from public.ip_user_preference_card_revisions) as revision_count,
  (select count(*) from public.ip_user_preference_cards where rebuild_provenance is not null)
    as provenance_count,
  (select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
     from (select md5(c.*::text) as digest from public.ip_user_preference_cards c) as t)
    as card_digest,
  (select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
     from (select md5(r.*::text) as digest from public.ip_user_preference_card_revisions r) as t)
    as revision_digest;

-- =============================================================================================
-- Part 1 — structure: the column, the policies, the guards, the writer, the ACLs.
-- =============================================================================================

do $$
declare
  data_type text;
  is_nullable boolean;
  has_default boolean;
  definition text;
  owner_name text;
  is_definer boolean;
  config text;
  acl text;
begin
  select a.atttypid::regtype::text, not a.attnotnull, a.atthasdef
    into data_type, is_nullable, has_default
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'ip_user_preference_cards'
     and a.attname = 'rebuild_provenance' and a.attnum > 0 and not a.attisdropped;

  if data_type is null then raise exception 'rebuild_provenance is missing'; end if;
  if data_type <> 'jsonb' then raise exception 'rebuild_provenance is %, expected jsonb', data_type; end if;
  if not is_nullable then raise exception 'rebuild_provenance must remain nullable'; end if;
  if has_default then raise exception 'rebuild_provenance must have no default'; end if;

  -- The authenticated insert policy must carry the provenance condition. Without it the whole
  -- boundary is decorative: `authenticated` holds INSERT on this table.
  select pg_get_expr(p.polwithcheck, p.polrelid)
    into definition
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
   where c.relname = 'ip_user_preference_cards' and p.polname = 'ip_user_preference_cards_insert_own';
  if definition is null then raise exception 'the authenticated insert policy is missing'; end if;
  if definition not like '%rebuild_provenance IS NULL%' then
    raise exception 'the authenticated insert policy does not require a null provenance: %', definition;
  end if;

  -- Both guards, on the right table at the right time.
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'ip_user_preference_cards' and not t.tgisinternal
       and t.tgname = 'reject_untrusted_ip_user_preference_card_rebuild_provenance'
       and t.tgtype & 2 = 2 and t.tgtype & 4 = 4
  ) then raise exception 'the before-insert provenance guard is missing'; end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'ip_user_preference_cards' and not t.tgisinternal
       and t.tgname = 'reject_ip_user_preference_card_rebuild_provenance_rewrite'
       and t.tgtype & 2 = 2 and t.tgtype & 16 = 16
  ) then raise exception 'the before-update write-once guard is missing'; end if;

  -- The writer: a dedicated nologin role that owns one security-definer function with an empty
  -- search path and an ACL naming only service_role.
  if not exists (
    select 1 from pg_roles where rolname = 'ip_preference_card_rebuild_writer' and not rolcanlogin
  ) then raise exception 'the dedicated writer role is missing or can log in'; end if;

  select r.rolname, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '<unset>'),
         coalesce(array_to_string(p.proacl::text[], ','), '<none>')
    into owner_name, is_definer, config, acl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.oid = p.proowner
   where n.nspname = 'public' and p.proname = 'ip_create_rebuilt_preference_card';

  if owner_name is null then raise exception 'the trusted writer function is missing'; end if;
  if owner_name <> 'ip_preference_card_rebuild_writer' then
    raise exception 'the writer function is owned by %, expected the dedicated role', owner_name;
  end if;
  if not is_definer then raise exception 'the writer function must be security definer'; end if;
  if config <> 'search_path=' then
    raise exception 'the writer function must pin an empty search_path, found %', config;
  end if;
  if acl like '%authenticated=X%' or acl like '%anon=X%' then
    raise exception 'the writer function is executable by an API role: %', acl;
  end if;
  if acl not like '%service_role=X%' then
    raise exception 'the writer function is not executable by service_role: %', acl;
  end if;

  raise notice 'Part 1 passed: column, policy, guards, writer role, ACLs.';
end;
$$;

-- =============================================================================================
-- Part 2 — the applied revision machinery is untouched.
-- =============================================================================================

do $$
declare
  content_definition text;
begin
  select pg_get_functiondef(p.oid) into content_definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'ip_preference_card_content_changed';
  if content_definition is null then raise exception 'the content-changed helper is missing'; end if;
  if content_definition like '%rebuild_provenance%' then
    raise exception 'rebuild_provenance became revision-bearing content; it can never change';
  end if;

  if exists (
    select 1 from pg_attribute a join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'ip_user_preference_card_revisions'
       and a.attname = 'rebuild_provenance' and a.attnum > 0 and not a.attisdropped
  ) then raise exception 'the revision table gained rebuild_provenance'; end if;

  -- Both deployed card triggers are still attached; this migration adds to them, never replaces.
  if (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = 'ip_user_preference_cards' and not t.tgisinternal
         and t.tgname in ('append_ip_user_preference_card_revision',
                          'set_ip_user_preference_cards_content_updated_at')) <> 2 then
    raise exception 'the deployed revision triggers are not both present';
  end if;

  raise notice 'Part 2 passed: revision machinery untouched.';
end;
$$;

-- =============================================================================================
-- Part 3 — the authenticated role cannot forge provenance. This is the blocker.
-- =============================================================================================
--
-- Run as `authenticated` with a JWT subject, which is what PostgREST does, so both the table grant
-- and the row-level policy are actually met.

do $$
declare
  owner_id uuid;
  snapshot jsonb := jsonb_build_object('resolutionProvenance', jsonb_build_object());
  forged jsonb := jsonb_build_object('version', 'ip-cards-rebuild/1');
  created uuid;
begin
  select id into owner_id from auth.users order by created_at limit 1;
  if owner_id is null then
    raise exception 'Part 3 needs one auth.users row to act as an owner';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_id::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if current_user <> 'authenticated' then
    raise exception 'Part 3 is not running as authenticated, but as %', current_user;
  end if;
  if auth.uid() <> owner_id then
    raise exception 'auth.uid() is %, expected %', auth.uid(), owner_id;
  end if;

  -- (a) An ordinary create still works, with provenance omitted entirely.
  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id)
  values
    (owner_id, 'verify ordinary', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb, snapshot,
     repeat('a', 64), 'verify', 'verify')
  returning id into created;
  if created is null then raise exception 'an ordinary authenticated insert did not succeed'; end if;

  -- (b) The same insert carrying provenance must be refused, and by the guard rather than by luck.
  begin
    insert into public.ip_user_preference_cards
      (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
       snapshot_hash, engine_version, catalog_import_id, rebuild_provenance)
    values
      (owner_id, 'verify forged', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb, snapshot,
       repeat('b', 64), 'verify', 'verify', forged);
    raise exception 'an authenticated user forged rebuild_provenance at INSERT';
  exception
    when restrict_violation then null;   -- the before-insert guard
    when insufficient_privilege then null; -- or the row-level policy, either is the boundary
  end;

  -- (c) Inserting for somebody else is still refused, provenance or not.
  begin
    insert into public.ip_user_preference_cards
      (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
       snapshot_hash, engine_version, catalog_import_id)
    values
      (gen_random_uuid(), 'verify foreign', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb,
       snapshot, repeat('c', 64), 'verify', 'verify');
    raise exception 'an authenticated user inserted a card owned by somebody else';
  exception
    when insufficient_privilege then null;
  end;

  reset role;
  raise notice 'Part 3 passed: authenticated cannot forge provenance, and ordinary creates work.';
end;
$$;

-- =============================================================================================
-- Part 4 — the service role cannot forge provenance through the table either.
-- =============================================================================================
--
-- `service_role` has bypassrls, so no policy constrains it. The before-insert guard must.

do $$
declare
  owner_id uuid;
  snapshot jsonb := jsonb_build_object('resolutionProvenance', jsonb_build_object());
  forged jsonb := jsonb_build_object('version', 'ip-cards-rebuild/1');
begin
  select id into owner_id from auth.users order by created_at limit 1;
  set local role service_role;
  if current_user <> 'service_role' then
    raise exception 'Part 4 is not running as service_role, but as %', current_user;
  end if;

  begin
    insert into public.ip_user_preference_cards
      (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
       snapshot_hash, engine_version, catalog_import_id, rebuild_provenance)
    values
      (owner_id, 'verify service forged', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb,
       snapshot, repeat('d', 64), 'verify', 'verify', forged);
    raise exception 'service_role forged rebuild_provenance through a direct table insert';
  exception
    when restrict_violation then null;
  end;

  reset role;
  raise notice 'Part 4 passed: possessing the service key does not write provenance.';
end;
$$;

-- =============================================================================================
-- Part 5 — the trusted writer, and its source recheck.
-- =============================================================================================

do $$
declare
  owner_id uuid;
  source_id uuid;
  source_revision uuid;
  source_hash text := repeat('e', 64);
  created uuid;
  source_before text;
  revisions_before text;
  provenance jsonb;
begin
  select id into owner_id from auth.users order by created_at limit 1;

  -- A source card and the revision the append trigger writes for it.
  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id)
  values
    (owner_id, 'verify source', 'VERIFY_ONLY', 'verify-only', 'draft',
     jsonb_build_object('releaseBundleId', 'release-verify-v1'),
     jsonb_build_object('resolutionProvenance', jsonb_build_object()),
     source_hash, 'verify', 'verify')
  returning id into source_id;

  select id into source_revision
    from public.ip_user_preference_card_revisions
   where card_id = source_id order by revision_number desc limit 1;
  if source_revision is null then raise exception 'the append trigger wrote no source revision'; end if;

  source_before := md5((select c.*::text from public.ip_user_preference_cards c where c.id = source_id));
  revisions_before := md5(coalesce((
    select string_agg(md5(r.*::text), '|' order by r.id)
      from public.ip_user_preference_card_revisions r where r.card_id = source_id), ''));

  provenance := jsonb_build_object(
    'version', 'ip-cards-rebuild/1',
    'sourceCardId', source_id,
    'sourceRevisionId', source_revision);

  set local role service_role;

  -- (a) A payload naming a revision that does not match must write nothing.
  begin
    perform public.ip_create_rebuilt_preference_card(
      owner_id, source_id, source_revision, repeat('0', 64), 'release-verify-v1',
      'verify rebuilt', null, 'VERIFY_ONLY', 'verify-only',
      '{}'::jsonb, jsonb_build_object('resolutionProvenance', jsonb_build_object()),
      repeat('f', 64), 'verify', 'verify', provenance);
    raise exception 'the writer accepted a payload that disagrees with the stored revision';
  exception
    when no_data_found then null;
  end;

  -- (b) A payload naming another owner must write nothing.
  begin
    perform public.ip_create_rebuilt_preference_card(
      gen_random_uuid(), source_id, source_revision, source_hash, 'release-verify-v1',
      'verify rebuilt', null, 'VERIFY_ONLY', 'verify-only',
      '{}'::jsonb, jsonb_build_object('resolutionProvenance', jsonb_build_object()),
      repeat('f', 64), 'verify', 'verify', provenance);
    raise exception 'the writer accepted a payload naming a different owner';
  exception
    when no_data_found then null;
  end;

  -- (c) The correct payload succeeds, exactly once.
  created := public.ip_create_rebuilt_preference_card(
    owner_id, source_id, source_revision, source_hash, 'release-verify-v1',
    'verify rebuilt', null, 'VERIFY_ONLY', 'verify-only',
    '{}'::jsonb, jsonb_build_object('resolutionProvenance', jsonb_build_object()),
    repeat('f', 64), 'verify', 'verify', provenance);
  if created is null then raise exception 'the writer did not create a card'; end if;

  reset role;

  -- The new card is a draft with its own identity and sharing off.
  if (select status from public.ip_user_preference_cards where id = created) <> 'draft' then
    raise exception 'the rebuilt card is not a draft';
  end if;
  if (select share_enabled from public.ip_user_preference_cards where id = created) then
    raise exception 'the rebuilt card has sharing enabled';
  end if;
  if (select share_token from public.ip_user_preference_cards where id = created)
     = (select share_token from public.ip_user_preference_cards where id = source_id) then
    raise exception 'the rebuilt card inherited the source share token';
  end if;
  if (select rebuild_provenance from public.ip_user_preference_cards where id = created)
     is distinct from provenance then
    raise exception 'the rebuilt card does not carry the provenance it was given';
  end if;
  if (select count(*) from public.ip_user_preference_card_revisions where card_id = created) <> 1 then
    raise exception 'the rebuilt card did not get exactly one revision';
  end if;

  -- The source is byte-identical.
  if md5((select c.*::text from public.ip_user_preference_cards c where c.id = source_id))
     is distinct from source_before then
    raise exception 'the source card changed during the rebuild';
  end if;
  if md5(coalesce((select string_agg(md5(r.*::text), '|' order by r.id)
      from public.ip_user_preference_card_revisions r where r.card_id = source_id), ''))
     is distinct from revisions_before then
    raise exception 'the source revisions changed during the rebuild';
  end if;

  raise notice 'Part 5 passed: the trusted writer creates one draft and re-derives its source.';
end;
$$;

-- =============================================================================================
-- Part 6 — write-once, in all three directions, with the exact code.
-- =============================================================================================

do $$
declare
  rebuilt_id uuid;
  ordinary_id uuid;
  provenance jsonb;
  original_provenance jsonb;
begin
  select id, rebuild_provenance into rebuilt_id, original_provenance
    from public.ip_user_preference_cards
   where rebuild_provenance is not null and title = 'verify rebuilt' limit 1;
  select id into ordinary_id
    from public.ip_user_preference_cards where title = 'verify ordinary' limit 1;
  if rebuilt_id is null or ordinary_id is null then
    raise exception 'Part 6 could not find the cards Parts 3 and 5 created';
  end if;

  begin
    update public.ip_user_preference_cards
       set rebuild_provenance = jsonb_build_object('version', 'forged') where id = rebuilt_id;
    raise exception 'provenance was overwritten';
  exception when restrict_violation then null; end;

  begin
    update public.ip_user_preference_cards
       set rebuild_provenance = null where id = rebuilt_id;
    raise exception 'provenance was cleared';
  exception when restrict_violation then null; end;

  begin
    update public.ip_user_preference_cards
       set rebuild_provenance = jsonb_build_object('version', 'ip-cards-rebuild/1')
     where id = ordinary_id;
    raise exception 'a card that was not rebuilt was given provenance';
  exception when restrict_violation then null; end;

  -- Ordinary operations still work, and leave provenance where it was.
  update public.ip_user_preference_cards set title = 'verify rebuilt, renamed' where id = rebuilt_id;
  update public.ip_user_preference_cards set share_enabled = true where id = rebuilt_id;
  update public.ip_user_preference_cards set status = 'final' where id = rebuilt_id;
  select rebuild_provenance into provenance
    from public.ip_user_preference_cards where id = rebuilt_id;
  if provenance is distinct from original_provenance then
    raise exception 'an ordinary update disturbed provenance';
  end if;

  raise notice 'Part 6 passed: write-once in all three directions; ordinary updates unaffected.';
end;
$$;

-- =============================================================================================
-- Part 7 — the synthetic rows are removed, and the baseline is exactly restored.
-- =============================================================================================

do $$
declare
  baseline record;
begin
  delete from public.ip_user_preference_cards where procedure_code = 'VERIFY_ONLY';

  select * into baseline from verify_rebuild_baseline;
  if (select count(*) from public.ip_user_preference_cards) <> baseline.card_count then
    raise exception 'card count did not return to baseline';
  end if;
  if (select count(*) from public.ip_user_preference_card_revisions) <> baseline.revision_count then
    raise exception 'revision count did not return to baseline (the cascade should have removed them)';
  end if;
  if (select count(*) from public.ip_user_preference_cards where rebuild_provenance is not null)
     <> baseline.provenance_count then
    raise exception 'provenance count did not return to baseline';
  end if;
  if (select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
        from (select md5(c.*::text) as digest from public.ip_user_preference_cards c) as t)
     is distinct from baseline.card_digest then
    raise exception 'card content digest changed';
  end if;
  if (select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
        from (select md5(r.*::text) as digest from public.ip_user_preference_card_revisions r) as t)
     is distinct from baseline.revision_digest then
    raise exception 'revision content digest changed';
  end if;

  raise notice 'Part 7 passed: synthetic rows removed and every digest matches the baseline.';
  raise notice 'ALL CHECKS PASSED';
end;
$$;

rollback;
