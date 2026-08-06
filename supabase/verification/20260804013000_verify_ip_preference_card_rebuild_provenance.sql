-- Verification for 20260804013000_add_ip_preference_card_rebuild_provenance.sql
--
-- Run once, against the project, immediately after applying that migration.
--
-- Three earlier versions of this file were not trustworthy and independent reviews said so. The
-- first inserted both of its synthetic cards as `postgres`, so it never met row-level security or
-- the authenticated insert policy at all, and every negative case was wrapped in
-- `exception when others`, so *any* error counted as the expected one. The second fixed both and
-- then could not run: its Part 5 provenance object omitted `sourceSnapshotHash`, so the very first
-- writer call raised `invalid_parameter_value` where the handler expected `no_data_found`, and the
-- transaction aborted before the positive case, the write-once matrix, or ALL CHECKS PASSED.
--
-- The third ran, and could still print ALL CHECKS PASSED while the contract was false. Its
-- "complete" positive fixture carried eight of the twenty version-1 keys — a document the
-- application's own read schema rejects — so it blessed a card that would come back as `null` on
-- every subsequent read. It also *required* the migration executor to remain a member of the writer
-- role, blessing the residue that lets a later session `set role` into the trusted insert context
-- and bypass the RPC entirely.
--
-- This version builds its positive case from the complete version-1 document — the same twenty keys
-- `storedRebuildProvenanceSchema` reads and `provenance-contract.test.ts` pins the three
-- descriptions of — mutates exactly one fact per negative case, takes card *and* revision counts
-- immediately around every refusal, asserts the role context inside every role-specific block, and
-- requires the writer role to have no members at all.
--
-- WHAT IT ESTABLISHES
--   Authenticity, not merely immutability. `rebuild_provenance` is evidence that a reviewed rebuild
--   happened, so what has to be proved is that nothing except one narrow function can write it:
--   not an authenticated user through PostgREST, not the service role through the table, not a
--   direct superuser-adjacent insert, and not a later update by anybody. And that when the one
--   function does write it, the document it stores describes the revision it was checked against
--   rather than an arbitrary object the caller supplied alongside a real tuple.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and execute it as one script. Everything runs
--   inside one transaction that ends in `rollback`, and the row counts and content digests taken at
--   the start are re-compared at the end, so "this left the data alone" is checked rather than
--   claimed. A failed assertion raises and aborts; the final ALL CHECKS PASSED notice is the pass
--   condition.
--
-- HOW IT FAILS
--   Every negative case names the exact SQLSTATE it expects — `23001` (`restrict_violation`) for
--   the guards, `42501` for a policy refusal, `P0002` (`no_data_found`) for a source that does not
--   match, `22023` (`invalid_parameter_value`) for a document that does not describe it — and
--   re-raises anything else. There is no `when others` in this file, deliberately: a check that
--   accepts any error is not a check.
--
--   Run it against a scratch schema whose authenticated insert policy omits the provenance
--   condition, or whose insert guard raises a different code, or whose writer function drops the
--   document binding, and Part 3, Part 4, or Part 6 must fail. A verifier that cannot fail is not
--   evidence.

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
  writer oid;
  acl_row record;
  grantee_count integer;
  member_names text;
  table_name text;
  validator_signature text;
  api_role text;
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

  -- --- The writer role ------------------------------------------------------------------------
  --
  -- `nologin` was the only attribute the previous version established. A role that could bypass
  -- row-level security, create objects in `public`, or hold write privileges on unrelated tables
  -- would still satisfy that check while being a far larger thing than "owns one function".

  select oid into writer from pg_roles where rolname = 'ip_preference_card_rebuild_writer';
  if writer is null then raise exception 'the dedicated writer role is missing'; end if;

  if exists (
    select 1 from pg_roles
     where oid = writer
       and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)
  ) then
    raise exception 'the writer role holds a login or administrative attribute';
  end if;

  -- The temporary `create` needed for `alter function ... owner to` must not have survived it.
  if has_schema_privilege('ip_preference_card_rebuild_writer', 'public', 'CREATE') then
    raise exception 'the writer role retained CREATE on schema public';
  end if;
  if not has_schema_privilege('ip_preference_card_rebuild_writer', 'public', 'USAGE') then
    raise exception 'the writer role cannot use schema public, so it cannot reach its own function';
  end if;

  -- It is a member of nothing, and — the part an earlier version of this file got backwards —
  -- *nothing is a member of it*. The migration needs membership for one statement, because
  -- `alter function ... owner to` requires the caller to be able to `set role` to the new owner, and
  -- it gives that membership back. Left behind, a later session as the migration role could
  -- `set role ip_preference_card_rebuild_writer` and then satisfy both the writer-only insert guard
  -- and the writer's own RLS policy with a direct insert, bypassing every source recheck the RPC
  -- performs. The previous version of this check *required* that residue to be present.
  if exists (select 1 from pg_auth_members where member = writer) then
    raise exception 'the writer role is a member of another role';
  end if;
  select string_agg(r.rolname, ', ' order by r.rolname) into member_names
    from pg_auth_members m join pg_roles r on r.oid = m.member
   where m.roleid = writer;
  if member_names is not null then
    raise exception 'the writer role still has members: %', member_names;
  end if;

  -- And the same fact behaviourally rather than only in the catalog.
  begin
    set local role ip_preference_card_rebuild_writer;
    reset role;
    raise exception 'the migration role can still assume the writer role';
  exception
    when insufficient_privilege then null;
  end;

  -- It owns exactly one function and nothing else at all.
  if (select count(*) from pg_proc where proowner = writer) <> 1 then
    raise exception 'the writer role does not own exactly one function';
  end if;
  if exists (select 1 from pg_class where relowner = writer)
     or exists (select 1 from pg_namespace where nspowner = writer)
     or exists (select 1 from pg_type where typowner = writer)
     or exists (select 1 from pg_default_acl where defaclrole = writer) then
    raise exception 'the writer role owns objects other than its one function';
  end if;

  -- Table privileges: read both, insert into one, and nothing else anywhere.
  if not has_table_privilege('ip_preference_card_rebuild_writer',
       'public.ip_user_preference_cards', 'SELECT, INSERT') then
    raise exception 'the writer role cannot read and insert cards';
  end if;
  if has_table_privilege('ip_preference_card_rebuild_writer',
       'public.ip_user_preference_cards', 'UPDATE')
     or has_table_privilege('ip_preference_card_rebuild_writer',
          'public.ip_user_preference_cards', 'DELETE')
     or has_table_privilege('ip_preference_card_rebuild_writer',
          'public.ip_user_preference_card_revisions', 'INSERT, UPDATE, DELETE') then
    raise exception 'the writer role holds a write privilege it does not need';
  end if;
  -- Direct grants only, by grantee oid rather than through `has_table_privilege`: the latter also
  -- answers yes for anything granted to PUBLIC, which would make this fail for a reason that has
  -- nothing to do with this role.
  for table_name in
    select n.nspname || '.' || c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
     where a.grantee = writer
       and not (n.nspname = 'public'
                and c.relname in ('ip_user_preference_cards',
                                  'ip_user_preference_card_revisions'))
  loop
    raise exception 'the writer role holds a direct grant on %, which is outside its one job',
      table_name;
  end loop;

  -- --- The writer function --------------------------------------------------------------------

  select r.rolname, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '<unset>')
    into owner_name, is_definer, config
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

  -- The ACL, by grantee rather than by substring. `like '%anon=X%'` rejected two names and let a
  -- null ACL — which is PostgreSQL's way of spelling "PUBLIC may execute" — through untouched.
  if (select proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'ip_create_rebuilt_preference_card') is null then
    raise exception 'the writer function has the default ACL, which grants EXECUTE to PUBLIC';
  end if;
  grantee_count := 0;
  for acl_row in
    select coalesce(g.rolname, 'PUBLIC') as grantee, a.privilege_type
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(p.proacl) a
      left join pg_roles g on g.oid = a.grantee
     where n.nspname = 'public' and p.proname = 'ip_create_rebuilt_preference_card'
  loop
    if acl_row.grantee not in ('ip_preference_card_rebuild_writer', 'service_role') then
      raise exception 'the writer function is granted % to %, which is neither its owner nor the service role',
        acl_row.privilege_type, acl_row.grantee;
    end if;
    if acl_row.grantee = 'service_role' then
      if acl_row.privilege_type <> 'EXECUTE' then
        raise exception 'service_role holds % on the writer function, expected EXECUTE only',
          acl_row.privilege_type;
      end if;
      grantee_count := grantee_count + 1;
    end if;
  end loop;
  if grantee_count <> 1 then
    raise exception 'service_role does not hold exactly EXECUTE on the writer function';
  end if;
  if has_function_privilege('anon',
       'public.ip_create_rebuilt_preference_card(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, text, jsonb)',
       'EXECUTE')
     or has_function_privilege('authenticated',
          'public.ip_create_rebuilt_preference_card(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, text, jsonb)',
          'EXECUTE') then
    raise exception 'an API role can execute the writer function';
  end if;

  -- --- The private validator, and who may reach it ----------------------------------------------
  --
  -- The whole writer path depends on these two grants: the RPC is `security definer` owned by the
  -- writer, so inside it `current_user` is the writer, and the deployed revision migration revoked
  -- all access to schema `private` from everyone else. Without them the first statement of the RPC
  -- raises 42501 and every real rebuild write fails at the last step, after the review.
  if not has_schema_privilege('ip_preference_card_rebuild_writer', 'private', 'USAGE') then
    raise exception 'the writer role cannot use schema private, so it cannot call its own validator';
  end if;
  if has_schema_privilege('ip_preference_card_rebuild_writer', 'private', 'CREATE') then
    raise exception 'the writer role can create objects in schema private';
  end if;
  for validator_signature in
    select 'private.ip_validate_preference_card_rebuild_provenance_v1(jsonb)'
    union all select 'private.ip_is_canonical_text(text, integer)'
  loop
    if not has_function_privilege('ip_preference_card_rebuild_writer', validator_signature, 'EXECUTE')
    then
      raise exception 'the writer role cannot execute %', validator_signature;
    end if;
    -- ...and nobody on the API surface can, in either direction.
    for api_role in select unnest(array['anon', 'authenticated', 'service_role']) loop
      if has_function_privilege(api_role, validator_signature, 'EXECUTE') then
        raise exception '% can execute %, which is not on the API surface', api_role,
          validator_signature;
      end if;
    end loop;
  end loop;
  for api_role in select unnest(array['anon', 'authenticated', 'service_role']) loop
    if has_schema_privilege(api_role, 'private', 'USAGE') then
      raise exception '% has USAGE on schema private', api_role;
    end if;
  end loop;

  -- Narrow, not blanket: exactly two private functions are reachable by the writer, so a future
  -- schema-wide grant would be visible here rather than only in the migration text.
  if (select count(*)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
         and has_function_privilege('ip_preference_card_rebuild_writer', p.oid, 'EXECUTE')) <> 2
  then
    raise exception 'the writer role can execute private functions beyond its own validator pair';
  end if;

  raise notice 'Part 1 passed: column, policy, guards, writer role and privileges, function ACL.';
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
  cards_before bigint;
  revisions_before bigint;
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

  -- (a) An ordinary create still works, with provenance omitted entirely. This also proves the
  -- table privilege and the policy are satisfied for this role, which is what makes (b)'s exact
  -- SQLSTATE meaningful rather than lucky.
  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id)
  values
    (owner_id, 'verify ordinary', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb, snapshot,
     repeat('a', 64), 'verify', 'verify')
  returning id into created;
  if created is null then raise exception 'an ordinary authenticated insert did not succeed'; end if;
  if (select rebuild_provenance from public.ip_user_preference_cards where id = created)
     is not null then
    raise exception 'an ordinary create acquired provenance from somewhere';
  end if;

  -- (b) The same insert carrying provenance must be refused by the *guard*, exactly.
  --
  -- Not "23001 or 42501". PostgreSQL runs `BEFORE` row triggers before the policy's `WITH CHECK`,
  -- and (a) has just proved this role satisfies the policy for an otherwise identical row, so this
  -- statement must reach the trigger. Accepting `42501` here would let a broken guard pass on the
  -- strength of a policy refusal — and the policy is only the first of the three layers.
  cards_before := (select count(*) from public.ip_user_preference_cards);
  revisions_before := (select count(*) from public.ip_user_preference_card_revisions);
  begin
    insert into public.ip_user_preference_cards
      (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
       snapshot_hash, engine_version, catalog_import_id, rebuild_provenance)
    values
      (owner_id, 'verify forged', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb, snapshot,
       repeat('b', 64), 'verify', 'verify', forged);
    raise exception 'an authenticated user forged rebuild_provenance at INSERT';
  exception
    when restrict_violation then null;   -- the before-insert guard, and only it
  end;
  if (select count(*) from public.ip_user_preference_cards) <> cards_before
     or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_before then
    raise exception 'the refused authenticated forgery still wrote rows';
  end if;

  -- (c) Inserting for somebody else is still refused, provenance or not.
  cards_before := (select count(*) from public.ip_user_preference_cards);
  revisions_before := (select count(*) from public.ip_user_preference_card_revisions);
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
  if (select count(*) from public.ip_user_preference_cards) <> cards_before
     or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_before then
    raise exception 'the refused other-owner insert still wrote rows';
  end if;

  -- (d) An authenticated update cannot add provenance to its own card either.
  cards_before := (select count(*) from public.ip_user_preference_cards);
  revisions_before := (select count(*) from public.ip_user_preference_card_revisions);
  begin
    update public.ip_user_preference_cards
       set rebuild_provenance = forged where id = created;
    raise exception 'an authenticated user added provenance by UPDATE';
  exception
    when restrict_violation then null;
  end;
  if (select rebuild_provenance from public.ip_user_preference_cards where id = created)
     is not null then
    raise exception 'the refused authenticated update still set provenance';
  end if;
  if (select count(*) from public.ip_user_preference_card_revisions) <> revisions_before then
    raise exception 'the refused authenticated update still appended a revision';
  end if;

  -- (e) And it cannot reach the trusted writer function at all: EXECUTE is not granted to it.
  begin
    perform public.ip_create_rebuilt_preference_card(
      owner_id, created, created, repeat('a', 64), null::text,
      'verify rpc', null::text, 'VERIFY_ONLY', 'verify-only',
      '{}'::jsonb, snapshot, repeat('b', 64), 'verify', 'verify', forged);
    raise exception 'an authenticated user executed the trusted writer function';
  exception
    when insufficient_privilege then null;
  end;

  if (select count(*) from public.ip_user_preference_cards) <> cards_before
     or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_before then
    raise exception 'a refused authenticated statement wrote rows';
  end if;

  reset role;
  raise notice 'Part 3 passed: authenticated cannot forge, update, or call the writer.';
end;
$$;

-- =============================================================================================
-- Part 4 — neither the service role nor an ordinary owner-level session can forge it.
-- =============================================================================================
--
-- `service_role` has bypassrls, so no policy constrains it. `postgres` is the migration role and
-- owns the table. Neither is the writer role, and the guard is written against `current_user`
-- rather than against a policy, so both must be refused.

do $$
declare
  owner_id uuid;
  snapshot jsonb := jsonb_build_object('resolutionProvenance', jsonb_build_object());
  forged jsonb := jsonb_build_object('version', 'ip-cards-rebuild/1');
  ordinary_id uuid;
  cards_before bigint;
  revisions_before bigint;
begin
  select id into owner_id from auth.users order by created_at limit 1;
  select id into ordinary_id
    from public.ip_user_preference_cards where title = 'verify ordinary' limit 1;
  cards_before := (select count(*) from public.ip_user_preference_cards);
  revisions_before := (select count(*) from public.ip_user_preference_card_revisions);

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
  if (select count(*) from public.ip_user_preference_cards) <> cards_before
     or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_before then
    raise exception 'the refused service_role insert still wrote rows';
  end if;

  -- The service key can reach the table for ordinary work; it still cannot add provenance to a
  -- card that was not rebuilt. Null → value is the direction that matters most here, because the
  -- other two need a card that already carries provenance and Part 6 covers those as well.
  begin
    update public.ip_user_preference_cards
       set rebuild_provenance = forged where id = ordinary_id;
    raise exception 'service_role added provenance to an existing card by UPDATE';
  exception
    when restrict_violation then null;
  end;
  if (select rebuild_provenance from public.ip_user_preference_cards where id = ordinary_id)
     is not null then
    raise exception 'the refused service_role update still set provenance';
  end if;
  if (select count(*) from public.ip_user_preference_card_revisions) <> revisions_before then
    raise exception 'the refused service_role update still appended a revision';
  end if;

  reset role;

  -- And the migration role itself, which owns the table, is not exempt: the guard tests
  -- `current_user`, not a policy, so table ownership buys nothing here.
  --
  -- Asserted rather than assumed. Without this the block below could be running as anything at all
  -- and its refusal would prove nothing about the owner — which is the whole claim it makes.
  if current_user <> session_user then
    raise exception 'Part 4 did not return to the session role, but is %', current_user;
  end if;
  if (select pg_get_userbyid(relowner) from pg_class where oid = 'public.ip_user_preference_cards'::regclass)
     <> current_user then
    raise exception 'Part 4 is running as %, which does not own ip_user_preference_cards',
      current_user;
  end if;

  begin
    insert into public.ip_user_preference_cards
      (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
       snapshot_hash, engine_version, catalog_import_id, rebuild_provenance)
    values
      (owner_id, 'verify postgres forged', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb,
       snapshot, repeat('9', 64), 'verify', 'verify', forged);
    raise exception 'the table owner forged rebuild_provenance through a direct table insert';
  exception
    when restrict_violation then null;
  end;

  if (select count(*) from public.ip_user_preference_cards) <> cards_before
     or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_before then
    raise exception 'a refused privileged statement still wrote rows';
  end if;

  raise notice 'Part 4 passed: neither the service key nor table ownership writes provenance.';
end;
$$;

-- =============================================================================================
-- Part 5 — the trusted writer, its source recheck, and its document binding.
-- =============================================================================================
--
-- One complete, internally consistent provenance object is built first. Every negative case below
-- takes that object and changes exactly the one fact it is testing, so a refusal proves something
-- about that fact rather than about a fixture that was never valid to begin with.

do $$
declare
  owner_id uuid;
  source_id uuid;
  other_id uuid;
  source_revision uuid;
  other_revision uuid;
  source_hash text := repeat('e', 64);
  other_hash text := repeat('7', 64);
  release_id text := 'release-verify-v1';
  snapshot jsonb := jsonb_build_object('resolutionProvenance', jsonb_build_object());
  created uuid;
  source_before text;
  revisions_before text;
  provenance jsonb;
  decisions_fixture jsonb;
  case_row record;
  cards_at bigint;
  revisions_at bigint;
  state text;
  stored_keys text[];
  wrong_owner uuid := '00000000-0000-4000-b000-0000000000ff';
  hashed_id uuid;
  hashed_revision uuid;
  hashed_created uuid;
  hashed_provenance jsonb;
  v1_keys text[] := array[
    'version', 'sourceCardId', 'sourceRevisionId', 'sourceOwnerId', 'sourceRevisionNumber',
    'sourceReleaseBundleId', 'sourceReleaseDefinitionHash', 'sourceSnapshotHash',
    'sourceSnapshotIntegrityHash', 'sourceResolvedContentHash', 'sourcePrintDocumentHash',
    'targetReleaseBundleId', 'targetReleaseDefinitionHash', 'targetCatalogReleaseId',
    'operationalReconciliationHash', 'authoredReleaseDiffHash', 'mappingPlanHash',
    'allowedFinalStateHash', 'decisions', 'createdAt'
  ];
  omitted_key text;
  decision_keys text[] := array['key', 'kind', 'state', 'reasonCodes', 'acknowledgement'];
begin
  select id into owner_id from auth.users order by created_at limit 1;

  -- A source card and the revision the append trigger writes for it.
  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id)
  values
    (owner_id, 'verify source', 'VERIFY_ONLY', 'verify-only', 'draft',
     jsonb_build_object('releaseBundleId', release_id), snapshot,
     source_hash, 'verify', 'verify')
  returning id into source_id;

  -- A second real card, so "wrong card" and "wrong revision" name existing rows rather than
  -- invented uuids. A join that fails for a nonexistent id proves much less than one that fails
  -- for a real id belonging to a different card.
  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id)
  values
    (owner_id, 'verify source two', 'VERIFY_ONLY', 'verify-only', 'draft',
     jsonb_build_object('releaseBundleId', release_id), snapshot,
     other_hash, 'verify', 'verify')
  returning id into other_id;

  select id into source_revision
    from public.ip_user_preference_card_revisions
   where card_id = source_id order by revision_number desc limit 1;
  select id into other_revision
    from public.ip_user_preference_card_revisions
   where card_id = other_id order by revision_number desc limit 1;
  if source_revision is null or other_revision is null then
    raise exception 'the append trigger wrote no source revision';
  end if;
  if (select revision_number from public.ip_user_preference_card_revisions where id = source_revision)
     <> 1 then
    raise exception 'the source revision is not revision 1';
  end if;

  source_before := md5((select c.*::text from public.ip_user_preference_cards c where c.id = source_id));
  revisions_before := md5(coalesce((
    select string_agg(md5(r.*::text), '|' order by r.id)
      from public.ip_user_preference_card_revisions r where r.card_id = source_id), ''));

  -- The complete version-1 document — all twenty keys, agreeing with the revision row.
  --
  -- The previous version of this file built eight of them and called it complete. That object is
  -- one the application's own read schema rejects, so the card it blessed would have come back as
  -- `null` on every subsequent read: a row carrying rebuild evidence presented as a card that was
  -- never rebuilt. `provenance-contract.test.ts` compares the key set built below to
  -- `storedRebuildProvenanceSchema` and to the migration's `required_keys`, so the three cannot
  -- drift apart again without a test failing.
  --
  -- The nullable hashes are stated as explicit JSON nulls rather than omitted: an absent key would
  -- compare null-to-null against a null column and read as agreement about a claim never made, and
  -- version 1 requires the claim to be made either way.
  decisions_fixture := jsonb_build_array(
    jsonb_build_object(
      'key', 'requirement:VERIFY_ONLY',
      'kind', 'requirement',
      'state', 'carried_requires_review',
      'reasonCodes', jsonb_build_array('requirement_definition_changed'),
      'acknowledgement', 'confirmed'));

  provenance := jsonb_build_object(
    'version', 'ip-cards-rebuild/1',
    'sourceCardId', source_id,
    'sourceRevisionId', source_revision,
    'sourceOwnerId', owner_id,
    'sourceRevisionNumber', 1,
    'sourceReleaseBundleId', release_id,
    'sourceReleaseDefinitionHash', repeat('1', 64),
    'sourceSnapshotHash', source_hash,
    'sourceSnapshotIntegrityHash', null::text,
    'sourceResolvedContentHash', null::text,
    'sourcePrintDocumentHash', null::text,
    'targetReleaseBundleId', 'release-verify-v2',
    'targetReleaseDefinitionHash', repeat('2', 64),
    'targetCatalogReleaseId', 'catalog-verify-v2',
    'operationalReconciliationHash', repeat('3', 64),
    'authoredReleaseDiffHash', repeat('4', 64),
    'mappingPlanHash', repeat('5', 64),
    'allowedFinalStateHash', repeat('6', 64),
    'decisions', decisions_fixture,
    'createdAt', '2026-02-01T00:00:00.000Z');

  set local role service_role;
  if current_user <> 'service_role' then
    raise exception 'Part 5 is not running as service_role, but as %', current_user;
  end if;

  for case_row in
    select * from (values
      -- label, owner, card, revision, snapshot hash, release, document, expected SQLSTATE
      ('a stale snapshot hash',
       owner_id, source_id, source_revision, repeat('0', 64), release_id,
       provenance || jsonb_build_object('sourceSnapshotHash', repeat('0', 64)), 'P0002'),
      -- Both the scalar owner *and* the document owner, moved together to the same wrong uuid.
      -- Moving only the scalar made the RPC's document-versus-arguments check fire first with
      -- `22023`, so this case expected `P0002` and could never have observed it: the source-row
      -- owner mismatch it is named for was never reached.
      ('a different owner, claimed consistently',
       wrong_owner, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceOwnerId', wrong_owner), 'P0002'),
      ('another card''s id',
       owner_id, other_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceCardId', other_id), 'P0002'),
      ('another card''s revision',
       owner_id, source_id, other_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceRevisionId', other_revision), 'P0002'),
      ('a release the revision does not pin',
       owner_id, source_id, source_revision, source_hash, 'release-verify-v2',
       provenance || jsonb_build_object('sourceReleaseBundleId', 'release-verify-v2'), 'P0002'),
      ('a revision that does not exist',
       owner_id, source_id, '00000000-0000-4000-8000-0000000000ff'::uuid, source_hash, release_id,
       provenance || jsonb_build_object('sourceRevisionId',
                                        '00000000-0000-4000-8000-0000000000ff'), 'P0002'),
      -- The document, not the arguments. One real tuple satisfies the join; the evidence lies.
      ('a document naming a different card than the call',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceCardId', other_id), '22023'),
      ('a document naming a different revision than the call',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceRevisionId', other_revision), '22023'),
      ('a document naming a different snapshot hash than the call',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceSnapshotHash', repeat('1', 64)), '22023'),
      ('a document naming a different release than the call',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceReleaseBundleId', 'release-verify-v9'), '22023'),
      -- Facts the revision row knows and the arguments do not carry.
      ('a document fabricating the revision number',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceRevisionNumber', 7), 'P0002'),
      ('a document fabricating the snapshot integrity hash',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceSnapshotIntegrityHash', repeat('2', 64)), 'P0002'),
      ('a document fabricating the resolved content hash',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceResolvedContentHash', repeat('3', 64)), 'P0002'),
      -- Shape.
      ('a document at an unknown version',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('version', 'ip-cards-rebuild/2'), '22023'),
      ('a document with no version',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance - 'version', '22023'),
      ('a document with the revision number as a string',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceRevisionNumber', '1'), '22023'),
      ('a document omitting a nullable hash instead of stating it',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance - 'sourceSnapshotIntegrityHash', '22023'),
      ('a document that is not an object',
       owner_id, source_id, source_revision, source_hash, release_id,
       '[]'::jsonb, '22023'),
      -- The owner claim, which version 1 added because the document could not previously name one.
      ('a document naming an owner the call did not',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceOwnerId', gen_random_uuid()), '22023'),
      -- Shape. Per-key omission is a loop below rather than a handful of class representatives;
      -- what is left here is everything that is not simply "this key is missing".
      ('a document carrying a key version 1 does not define',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('invented', true), '22023'),
      ('a document whose uuid field is not a uuid',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('sourceOwnerId', 'not-a-uuid'), '22023'),
      ('a document whose hash field is not a digest',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('allowedFinalStateHash', 'nope'), '22023'),
      ('a document whose text field is empty',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('targetCatalogReleaseId', ''), '22023'),
      ('a document whose timestamp is not ISO-8601',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('createdAt', 'yesterday'), '22023'),
      ('a document whose decisions are not an array',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('decisions', jsonb_build_object()), '22023'),
      ('a document whose decision entry is malformed',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('decisions',
         jsonb_build_array(jsonb_build_object('key', 'x'))), '22023'),
      ('a document whose decision reason code is not a string',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('decisions', jsonb_build_array(jsonb_build_object(
         'key', 'x', 'kind', 'requirement', 'state', 'carried_unchanged',
         'reasonCodes', jsonb_build_array(7), 'acknowledgement', null::text))), '22023'),
      ('a document stating a non-nullable field as null',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('mappingPlanHash', null::text), '22023'),
      -- The five-key nested swap. The old validator counted to five and then read the five expected
      -- names, so replacing `acknowledgement` with an invented key kept the count *and* made
      -- `jsonb_typeof(decision -> 'acknowledgement')` SQL NULL — leaving the whole condition NULL
      -- rather than true. A fabricated claim with a required one missing was stored.
      ('a decision entry that swaps a required key for an invented one',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('decisions', jsonb_build_array(jsonb_build_object(
         'key', 'x', 'kind', 'requirement', 'state', 'carried_unchanged',
         'reasonCodes', jsonb_build_array(), 'invented', true))), '22023'),
      ('a decision entry with an empty acknowledgement',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('decisions', jsonb_build_array(jsonb_build_object(
         'key', 'x', 'kind', 'requirement', 'state', 'carried_unchanged',
         'reasonCodes', jsonb_build_array(), 'acknowledgement', ''))), '22023'),
      ('a decision entry with a blank key',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('decisions', jsonb_build_array(jsonb_build_object(
         'key', '   ', 'kind', 'requirement', 'state', 'carried_unchanged',
         'reasonCodes', jsonb_build_array(), 'acknowledgement', null::text))), '22023'),
      ('a decision entry with a blank reason code',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('decisions', jsonb_build_array(jsonb_build_object(
         'key', 'x', 'kind', 'requirement', 'state', 'carried_unchanged',
         'reasonCodes', jsonb_build_array('  '), 'acknowledgement', null::text))), '22023'),
      -- Text that is shaped like text and is not usable as an identifier.
      ('a document whose text field is only whitespace',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('targetCatalogReleaseId', '   '), '22023'),
      ('a document whose text field is overlong',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('targetCatalogReleaseId', repeat('x', 200)), '22023'),
      -- A timestamp that matches a prefix pattern and is not an instant.
      ('a document whose createdAt is shaped like a date but is not one',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('createdAt', '2026-99-99T00:00:00.000Z'), '22023'),
      ('a document whose createdAt carries no offset',
       owner_id, source_id, source_revision, source_hash, release_id,
       provenance || jsonb_build_object('createdAt', '2026-02-01T00:00:00.000'), '22023')
    ) as t(label, p_owner, p_card, p_revision, p_hash, p_release, p_document, expected)
  loop
    cards_at := (select count(*) from public.ip_user_preference_cards);
    revisions_at := (select count(*) from public.ip_user_preference_card_revisions);
    begin
      perform public.ip_create_rebuilt_preference_card(
        case_row.p_owner, case_row.p_card, case_row.p_revision, case_row.p_hash, case_row.p_release,
        'verify rejected', null::text, 'VERIFY_ONLY', 'verify-only',
        '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify', case_row.p_document);
      raise exception 'the writer accepted %', case_row.label;
    exception
      when no_data_found or invalid_parameter_value then
        get stacked diagnostics state = returned_sqlstate;
        if state <> case_row.expected then
          raise exception 'case "%" raised % but must raise %',
            case_row.label, state, case_row.expected;
        end if;
    end;
    if (select count(*) from public.ip_user_preference_cards) <> cards_at
       or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_at then
      raise exception 'the refused case "%" still wrote rows', case_row.label;
    end if;
  end loop;

  -- Every required key, omitted one at a time.
  --
  -- A loop rather than twenty hand-written rows, because the point is *coverage of the list* and a
  -- hand-written set is exactly the thing that ends up covering seven of twenty. `v1_keys` is
  -- compared to the migration's `required_keys` and to the runtime schema by
  -- `provenance-contract.test.ts`, so this loop cannot silently test a shorter list than the
  -- validator enforces.
  foreach omitted_key in array v1_keys loop
    cards_at := (select count(*) from public.ip_user_preference_cards);
    revisions_at := (select count(*) from public.ip_user_preference_card_revisions);
    begin
      perform public.ip_create_rebuilt_preference_card(
        owner_id, source_id, source_revision, source_hash, release_id,
        'verify rejected', null::text, 'VERIFY_ONLY', 'verify-only',
        '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify', provenance - omitted_key);
      raise exception 'the writer accepted a document with no %', omitted_key;
    exception
      when invalid_parameter_value then null;
    end;
    if (select count(*) from public.ip_user_preference_cards) <> cards_at
       or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_at then
      raise exception 'the refused omission of % still wrote rows', omitted_key;
    end if;
  end loop;

  -- And every required key given a value of the wrong JSON type, one at a time. `true` is the wrong
  -- type for every field version 1 defines — string, number and array alike — so one substitution
  -- covers the whole list without a per-key table that could drift from it.
  foreach omitted_key in array v1_keys loop
    cards_at := (select count(*) from public.ip_user_preference_cards);
    revisions_at := (select count(*) from public.ip_user_preference_card_revisions);
    begin
      perform public.ip_create_rebuilt_preference_card(
        owner_id, source_id, source_revision, source_hash, release_id,
        'verify rejected', null::text, 'VERIFY_ONLY', 'verify-only',
        '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify',
        provenance || jsonb_build_object(omitted_key, true));
      raise exception 'the writer accepted a boolean %', omitted_key;
    exception
      when invalid_parameter_value then null;
    end;
    if (select count(*) from public.ip_user_preference_cards) <> cards_at
       or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_at then
      raise exception 'the refused wrong-typed % still wrote rows', omitted_key;
    end if;
  end loop;

  -- Every nested decision key, omitted one at a time. The five-key count check used to make this
  -- dimension untestable: removing a key and adding another kept the count, and `jsonb_typeof` on
  -- the absent one turned the whole predicate into SQL NULL.
  foreach omitted_key in array decision_keys loop
    cards_at := (select count(*) from public.ip_user_preference_cards);
    revisions_at := (select count(*) from public.ip_user_preference_card_revisions);
    begin
      perform public.ip_create_rebuilt_preference_card(
        owner_id, source_id, source_revision, source_hash, release_id,
        'verify rejected', null::text, 'VERIFY_ONLY', 'verify-only',
        '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify',
        provenance || jsonb_build_object('decisions',
          jsonb_build_array(decisions_fixture -> 0 - omitted_key)));
      raise exception 'the writer accepted a decision with no %', omitted_key;
    exception
      when invalid_parameter_value then null;
    end;
    if (select count(*) from public.ip_user_preference_cards) <> cards_at
       or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_at then
      raise exception 'the refused decision omission of % still wrote rows', omitted_key;
    end if;
  end loop;

  -- Collections past their bound. Both limits are in the runtime schema too, so a document either
  -- side accepted alone would be one the other refuses.
  for case_row in
    select * from (values
      ('a decision carrying more than forty reason codes',
       provenance || jsonb_build_object('decisions', jsonb_build_array(
         (decisions_fixture -> 0) || jsonb_build_object('reasonCodes',
           (select jsonb_agg('reason_' || g) from generate_series(1, 41) as g))))),
      ('a document carrying more than a thousand decisions',
       provenance || jsonb_build_object('decisions',
         (select jsonb_agg((decisions_fixture -> 0) || jsonb_build_object('key', 'requirement:R' || g))
            from generate_series(1, 1001) as g))),
      ('a decision whose reason code is not a string',
       provenance || jsonb_build_object('decisions', jsonb_build_array(
         (decisions_fixture -> 0) || jsonb_build_object('reasonCodes', jsonb_build_array(7)))))
    ) as t(label, p_document)
  loop
    cards_at := (select count(*) from public.ip_user_preference_cards);
    revisions_at := (select count(*) from public.ip_user_preference_card_revisions);
    begin
      perform public.ip_create_rebuilt_preference_card(
        owner_id, source_id, source_revision, source_hash, release_id,
        'verify rejected', null::text, 'VERIFY_ONLY', 'verify-only',
        '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify', case_row.p_document);
      raise exception 'the writer accepted %', case_row.label;
    exception
      when invalid_parameter_value then null;
    end;
    if (select count(*) from public.ip_user_preference_cards) <> cards_at
       or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_at then
      raise exception 'the refused case "%" still wrote rows', case_row.label;
    end if;
  end loop;

  -- Nothing above created anything: every refusal was checked in place, and no rejected title exists.
  if exists (select 1 from public.ip_user_preference_cards where title = 'verify rejected') then
    raise exception 'a refused writer call created a card after all';
  end if;

  -- The correct payload succeeds, exactly once. That it succeeds *at all* is the proof that
  -- `current_user` inside this `security definer` function is the writer role: the same row
  -- refused in Part 4 as `service_role` and as the table owner passes here, and the only thing
  -- that differs is which role the insert guard sees.
  created := public.ip_create_rebuilt_preference_card(
    owner_id, source_id, source_revision, source_hash, release_id,
    'verify rebuilt', null::text, 'VERIFY_ONLY', 'verify-only',
    '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify', provenance);
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
  -- The stored row is readable as the *application's* document, not merely as some object. The
  -- key set is the part SQL can check; `provenance-contract.test.ts` ties that key set to
  -- `storedRebuildProvenanceSchema`, which is what closes the loop.
  select coalesce(array_agg(k order by k), array[]::text[]) into stored_keys
    from jsonb_object_keys(
      (select rebuild_provenance from public.ip_user_preference_cards where id = created)) as k;
  -- The exact set, both directions. A count plus four named keys would pass for a row that had
  -- twenty keys, four of them right.
  if exists (select 1 from unnest(v1_keys) as k where not (k = any (stored_keys)))
     or exists (select 1 from unnest(stored_keys) as k where not (k = any (v1_keys))) then
    raise exception 'the stored provenance key set is not the version-1 key set: %',
      array_to_string(stored_keys, ', ');
  end if;
  -- Round trip: the row reads back byte-identical to the document that was reviewed. What SQL can
  -- establish is the shape and the bytes; `provenance-contract.test.ts` parses this same fixture
  -- through `storedRebuildProvenanceSchema`, which is the half SQL cannot do.
  if (select rebuild_provenance from public.ip_user_preference_cards where id = created)
     is distinct from provenance then
    raise exception 'the stored provenance is not byte-identical to the reviewed document';
  end if;
  if (select count(*) from public.ip_user_preference_card_revisions where card_id = created) <> 1 then
    raise exception 'the rebuilt card did not get exactly one revision';
  end if;
  if (select revision_number from public.ip_user_preference_card_revisions where card_id = created)
     <> 1 then
    raise exception 'the rebuilt card''s first revision is not numbered 1';
  end if;

  -- --- The nullable keys, in both directions, against a source that has the hashes --------------
  --
  -- The fixture above states all three nullables as JSON null, which is correct for `verify source`:
  -- its snapshot carries neither hash, so the revision columns are null and the RPC's binding
  -- requires the document to say so. That proves "explicit null is accepted" and nothing about the
  -- other direction, so a second source is seeded here whose snapshot *does* carry both hashes.
  --
  -- Two facts fall out of it. A document naming the real values is accepted; a document naming null
  -- for a revision that has a value is refused — which is the binding working, not a shape error,
  -- so it is `P0002` rather than `22023`.
  --
  -- Seeded as the session role, which is where Part 5 left us: provenance is null, so the insert
  -- guard has nothing to object to.
  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id)
  values
    (owner_id, 'verify source hashed', 'VERIFY_ONLY', 'verify-only', 'draft',
     jsonb_build_object('releaseBundleId', release_id),
     jsonb_build_object('resolutionProvenance', jsonb_build_object(),
                        'snapshotIntegrityHash', repeat('7', 64),
                        'resolvedContentHash', repeat('8', 64)),
     repeat('9', 64), 'verify', 'verify')
  returning id into hashed_id;

  select id into hashed_revision
    from public.ip_user_preference_card_revisions
   where card_id = hashed_id order by revision_number desc limit 1;
  if (select snapshot_integrity_hash from public.ip_user_preference_card_revisions
       where id = hashed_revision) is distinct from repeat('7', 64) then
    raise exception 'the hashed source revision did not pick up its integrity hash';
  end if;

  hashed_provenance := provenance
    || jsonb_build_object(
         'sourceCardId', hashed_id,
         'sourceRevisionId', hashed_revision,
         'sourceSnapshotHash', repeat('9', 64),
         'sourceSnapshotIntegrityHash', repeat('7', 64),
         'sourceResolvedContentHash', repeat('8', 64));

  set local role service_role;

  -- Null where the revision has a value: refused by the binding, not by the shape.
  foreach omitted_key in array array['sourceSnapshotIntegrityHash', 'sourceResolvedContentHash'] loop
    cards_at := (select count(*) from public.ip_user_preference_cards);
    revisions_at := (select count(*) from public.ip_user_preference_card_revisions);
    begin
      perform public.ip_create_rebuilt_preference_card(
        owner_id, hashed_id, hashed_revision, repeat('9', 64), release_id,
        'verify rejected', null::text, 'VERIFY_ONLY', 'verify-only',
        '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify',
        hashed_provenance || jsonb_build_object(omitted_key, null::text));
      raise exception 'the writer accepted a null % for a revision that has one', omitted_key;
    exception
      when no_data_found then null;
    end;
    if (select count(*) from public.ip_user_preference_cards) <> cards_at
       or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_at then
      raise exception 'the refused null % still wrote rows', omitted_key;
    end if;
  end loop;

  -- And the real values are accepted, which is the half a null-only fixture cannot show.
  hashed_created := public.ip_create_rebuilt_preference_card(
    owner_id, hashed_id, hashed_revision, repeat('9', 64), release_id,
    'verify rebuilt hashed', null::text, 'VERIFY_ONLY', 'verify-only',
    '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify', hashed_provenance);
  if hashed_created is null then
    raise exception 'the writer refused a document naming the revision''s real hashes';
  end if;

  -- `sourcePrintDocumentHash` is the one nullable the database cannot bind, because no column holds
  -- it. Both a real digest and an explicit null are therefore accepted, and that is the honest
  -- statement of what this field is: required, typed, and an application claim.
  hashed_created := public.ip_create_rebuilt_preference_card(
    owner_id, hashed_id, hashed_revision, repeat('9', 64), release_id,
    'verify rebuilt hashed print', null::text, 'VERIFY_ONLY', 'verify-only',
    '{}'::jsonb, snapshot, repeat('f', 64), 'verify', 'verify',
    hashed_provenance || jsonb_build_object('sourcePrintDocumentHash', repeat('6', 64)));
  if hashed_created is null then
    raise exception 'the writer refused a document carrying a print-document hash';
  end if;

  reset role;

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

  raise notice 'Part 5 passed: every refusal exact and zero-write, then one complete draft.';
end;
$$;

-- =============================================================================================
-- Part 6 — write-once, in all three directions, with the exact code.
-- =============================================================================================

do $$
declare
  rebuilt_id uuid;
  ordinary_id uuid;
  duplicate_id uuid;
  provenance jsonb;
  original_provenance jsonb;
  revisions_before bigint;
  cards_at bigint;
  revisions_at bigint;
  owner_id uuid;
  acting_role text;
begin
  select id, rebuild_provenance, user_id into rebuilt_id, original_provenance, owner_id
    from public.ip_user_preference_cards
   where rebuild_provenance is not null and title = 'verify rebuilt' limit 1;
  select id into ordinary_id
    from public.ip_user_preference_cards where title = 'verify ordinary' limit 1;
  if rebuilt_id is null or ordinary_id is null then
    raise exception 'Part 6 could not find the cards Parts 3 and 5 created';
  end if;

  -- All three directions, twice: once as the table-owning migration role, and once as
  -- `service_role`, whose `bypassrls` makes it the role a compromised key would actually use. The
  -- previous version ran the matrix only after `reset role`, so it proved the guard for the owner
  -- and said nothing about the role the boundary is written against.
  foreach acting_role in array array['table_owner', 'service_role'] loop
    if acting_role = 'service_role' then
      set local role service_role;
      if current_user <> 'service_role' then
        raise exception 'Part 6 is not running as service_role, but as %', current_user;
      end if;
    else
      -- The owner half asserted the same way as the service half. Naming a role in a loop variable
      -- is not the same as being in it, and a matrix that ran twice as the same role would look
      -- exactly like this one.
      if current_user <> session_user then
        raise exception 'Part 6 owner pass is running as %, not the session role', current_user;
      end if;
      if (select pg_get_userbyid(relowner)
            from pg_class where oid = 'public.ip_user_preference_cards'::regclass) <> current_user
      then
        raise exception 'Part 6 owner pass is running as %, which does not own the table',
          current_user;
      end if;
    end if;

    cards_at := (select count(*) from public.ip_user_preference_cards);
    revisions_at := (select count(*) from public.ip_user_preference_card_revisions);

    begin
      update public.ip_user_preference_cards
         set rebuild_provenance = jsonb_build_object('version', 'forged') where id = rebuilt_id;
      raise exception 'provenance was overwritten as %', acting_role;
    exception when restrict_violation then null; end;

    begin
      update public.ip_user_preference_cards
         set rebuild_provenance = null where id = rebuilt_id;
      raise exception 'provenance was cleared as %', acting_role;
    exception when restrict_violation then null; end;

    begin
      update public.ip_user_preference_cards
         set rebuild_provenance = jsonb_build_object('version', 'ip-cards-rebuild/1')
       where id = ordinary_id;
      raise exception 'a card that was not rebuilt was given provenance as %', acting_role;
    exception when restrict_violation then null; end;

    if (select rebuild_provenance from public.ip_user_preference_cards where id = rebuilt_id)
       is distinct from original_provenance then
      raise exception 'a refused write-once update as % still changed provenance', acting_role;
    end if;
    if (select rebuild_provenance from public.ip_user_preference_cards where id = ordinary_id)
       is not null then
      raise exception 'a refused write-once update as % still gave an ordinary card provenance',
        acting_role;
    end if;
    -- Counts as well as values: an update that was refused must not have appended a revision or
    -- created anything either, and only counting rows says so.
    if (select count(*) from public.ip_user_preference_cards) <> cards_at
       or (select count(*) from public.ip_user_preference_card_revisions) <> revisions_at then
      raise exception 'the refused write-once updates as % still wrote rows', acting_role;
    end if;

    reset role;
  end loop;

  -- Ordinary metadata operations still work, and each leaves provenance exactly where it was.
  -- Checked one at a time rather than in a batch, so a guard that reacted to one of them would be
  -- named rather than hidden behind the other two.
  update public.ip_user_preference_cards set title = 'verify rebuilt, renamed' where id = rebuilt_id;
  if (select rebuild_provenance from public.ip_user_preference_cards where id = rebuilt_id)
     is distinct from original_provenance then
    raise exception 'a rename disturbed provenance';
  end if;

  update public.ip_user_preference_cards set share_enabled = true where id = rebuilt_id;
  if (select rebuild_provenance from public.ip_user_preference_cards where id = rebuilt_id)
     is distinct from original_provenance then
    raise exception 'a share toggle disturbed provenance';
  end if;

  update public.ip_user_preference_cards set status = 'final' where id = rebuilt_id;
  select rebuild_provenance into provenance
    from public.ip_user_preference_cards where id = rebuilt_id;
  if provenance is distinct from original_provenance then
    raise exception 'a status change disturbed provenance';
  end if;

  -- A genuine content edit: the card says something different, so a revision is appended and
  -- `updated_at` moves. Provenance describes how the card came to exist and must survive that
  -- unchanged — this is the case a write-once trigger could plausibly have broken.
  revisions_before := (select count(*) from public.ip_user_preference_card_revisions
                        where card_id = rebuilt_id);
  update public.ip_user_preference_cards
     set card_snapshot = jsonb_build_object('resolutionProvenance', jsonb_build_object(),
                                            'edited', true),
         snapshot_hash = repeat('5', 64)
   where id = rebuilt_id;
  if (select count(*) from public.ip_user_preference_card_revisions where card_id = rebuilt_id)
     <> revisions_before + 1 then
    raise exception 'a content edit on a rebuilt card did not append a revision';
  end if;
  if (select rebuild_provenance from public.ip_user_preference_cards where id = rebuilt_id)
     is distinct from original_provenance then
    raise exception 'a content edit disturbed provenance';
  end if;

  -- Duplicating a rebuilt card copies its content through the ordinary insert path, which never
  -- names this column — so the copy is not itself a rebuild and must say so by carrying null.
  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id)
  select user_id, 'verify duplicate', procedure_code, scenario_id, 'draft', builder_inputs,
         card_snapshot, repeat('6', 64), engine_version, catalog_import_id
    from public.ip_user_preference_cards where id = rebuilt_id
  returning id into duplicate_id;
  if (select rebuild_provenance from public.ip_user_preference_cards where id = duplicate_id)
     is not null then
    raise exception 'a duplicate of a rebuilt card inherited its provenance';
  end if;

  raise notice 'Part 6 passed: write-once in all three directions; edits and duplicates behave.';
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

  if exists (
    select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid
     where r.rolname = 'ip_preference_card_rebuild_writer'
  ) then
    raise exception 'a member of the writer role remains at the end of the run';
  end if;

  -- And nothing this script did widened the boundary it spent seven parts describing. Re-checked at
  -- the end rather than only at the start: `set local role`, a policy, or a grant issued midway
  -- would otherwise be invisible to a run that only ever looked once.
  begin
    set local role ip_preference_card_rebuild_writer;
    reset role;
    raise exception 'the migration role can assume the writer role at the end of the run';
  exception
    when insufficient_privilege then null;
  end;
  if has_schema_privilege('ip_preference_card_rebuild_writer', 'public', 'CREATE')
     or has_schema_privilege('ip_preference_card_rebuild_writer', 'private', 'CREATE') then
    raise exception 'the writer role holds CREATE on a schema at the end of the run';
  end if;
  if not (has_schema_privilege('ip_preference_card_rebuild_writer', 'public', 'USAGE')
          and has_schema_privilege('ip_preference_card_rebuild_writer', 'private', 'USAGE')) then
    raise exception 'the writer role lost a USAGE grant it needs';
  end if;
  if (select count(*)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
         and has_function_privilege('ip_preference_card_rebuild_writer', p.oid, 'EXECUTE')) <> 2
  then
    raise exception 'the writer role can execute a different set of private functions than it began with';
  end if;
  if (select count(*) from pg_proc where proowner =
        (select oid from pg_roles where rolname = 'ip_preference_card_rebuild_writer')) <> 1 then
    raise exception 'the writer role does not still own exactly one function';
  end if;

  raise notice 'Part 7 passed: synthetic rows removed and every digest matches the baseline.';
  raise notice 'ALL CHECKS PASSED';
end;
$$;

rollback;
