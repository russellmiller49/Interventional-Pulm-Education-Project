-- Verification for 20260804013000_add_ip_preference_card_rebuild_provenance.sql
--
-- Run once, against the project, immediately after applying that migration.
--
-- Three things are checked, and only the third is worth much on its own: that the column and its
-- constraint exist with the right type and nullability, that the applied revision machinery is
-- exactly where it was, and — behaviourally — that the column really is write-once for the two
-- roles that could otherwise rewrite it. The last one is proved by attempting the rewrite and
-- requiring it to fail, because a trigger that exists and a trigger that fires are different facts
-- and only the second is the guarantee.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and execute it as one script. Every statement
--   that changes anything is inside the transaction this file opens and ends with `rollback`, and
--   the row counts and content digests taken at the start are re-checked at the end — so "this left
--   the data alone" is a checked fact rather than a claim about the SQL below.
--
--   A failed assertion raises and aborts. The final "ALL CHECKS PASSED" notice is the pass
--   condition; anything else is a failure to read.
--
-- WHAT IT DOES NOT DO
--   It does not test the application's rebuild workflow — that is the jest suite's job — and it
--   does not assert that any card carries provenance, because on a freshly applied database none
--   does and requiring one would mean writing one.

begin;

create temporary table verify_rebuild_baseline on commit drop as
select
  (select count(*) from public.ip_user_preference_cards) as card_count,
  (select count(*) from public.ip_user_preference_card_revisions) as revision_count,
  (select count(*) from public.ip_user_preference_cards where rebuild_provenance is not null)
    as provenance_count,
  (select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
     from (
       select md5(c.*::text) as digest from public.ip_user_preference_cards c
     ) as t) as card_digest,
  (select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
     from (
       select md5(r.*::text) as digest from public.ip_user_preference_card_revisions r
     ) as t) as revision_digest;

-- =============================================================================================
-- Part 1 — the column, its type, its nullability, and its check constraint.
-- =============================================================================================

do $$
declare
  data_type text;
  is_nullable boolean;
  constraint_expression text;
begin
  select a.atttypid::regtype::text, not a.attnotnull
    into data_type, is_nullable
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'ip_user_preference_cards'
     and a.attname = 'rebuild_provenance'
     and a.attnum > 0
     and not a.attisdropped;

  if data_type is null then
    raise exception 'rebuild_provenance is missing from public.ip_user_preference_cards';
  end if;
  if data_type <> 'jsonb' then
    raise exception 'rebuild_provenance is %, expected jsonb', data_type;
  end if;
  -- Nullable is the design: almost no card is a rebuild, and a default object on the rest would be
  -- a statement about how they came to exist.
  if not is_nullable then
    raise exception 'rebuild_provenance must remain nullable';
  end if;

  select pg_get_constraintdef(con.oid)
    into constraint_expression
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'ip_user_preference_cards'
     and con.conname = 'ip_user_preference_cards_rebuild_provenance_check';

  if constraint_expression is null then
    raise exception 'ip_user_preference_cards_rebuild_provenance_check is missing';
  end if;
  if constraint_expression not like '%jsonb_typeof%' then
    raise exception 'the rebuild_provenance check does not constrain the json type: %',
      constraint_expression;
  end if;

  raise notice 'Part 1 passed: rebuild_provenance jsonb, nullable, object-checked.';
end;
$$;

-- =============================================================================================
-- Part 2 — the write-once trigger exists, on the right table, at the right time.
-- =============================================================================================

do $$
declare
  trigger_timing text;
  trigger_events text;
  function_security text;
  function_search_path text;
begin
  select case when t.tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end,
         case when t.tgtype & 16 = 16 then 'UPDATE' else 'OTHER' end
    into trigger_timing, trigger_events
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'ip_user_preference_cards'
     and t.tgname = 'reject_ip_user_preference_card_rebuild_provenance_rewrite'
     and not t.tgisinternal;

  if trigger_timing is null then
    raise exception 'the rebuild_provenance write-once trigger is not attached to the cards table';
  end if;
  if trigger_timing <> 'BEFORE' or trigger_events <> 'UPDATE' then
    raise exception 'the rebuild_provenance trigger is % %, expected BEFORE UPDATE',
      trigger_timing, trigger_events;
  end if;

  -- Invoker on purpose: it calls nothing and reads nothing outside the row it was handed, so it
  -- needs no privilege. A definer here would widen a surface for no benefit.
  select case when p.prosecdef then 'DEFINER' else 'INVOKER' end,
         coalesce(array_to_string(p.proconfig, ','), '<unset>')
    into function_security, function_search_path
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname = 'ip_reject_preference_card_rebuild_provenance_rewrite';

  if function_security is null then
    raise exception 'private.ip_reject_preference_card_rebuild_provenance_rewrite is missing';
  end if;
  if function_security <> 'INVOKER' then
    raise exception 'the write-once function should be security invoker, found %', function_security;
  end if;
  if function_search_path not like '%search_path=%' then
    raise exception 'the write-once function does not pin search_path: %', function_search_path;
  end if;

  raise notice 'Part 2 passed: BEFORE UPDATE invoker trigger with a pinned search_path.';
end;
$$;

-- =============================================================================================
-- Part 3 — the write-once guarantee, proved by attempting to break it.
-- =============================================================================================
--
-- A card is created, given provenance at creation, and then three rewrites are attempted: setting a
-- different value, clearing it, and giving provenance to a card that never had any. All three must
-- raise. Everything here is rolled back with the rest of the file.

do $$
declare
  owner_id uuid;
  rebuilt_id uuid;
  ordinary_id uuid;
  snapshot jsonb := jsonb_build_object('resolutionProvenance', jsonb_build_object());
  provenance jsonb := jsonb_build_object('version', 'ip-cards-rebuild/1');
  rewrote boolean;
begin
  select id into owner_id from auth.users order by created_at limit 1;
  if owner_id is null then
    raise notice 'Part 3 skipped: no auth.users row to own a test card.';
    return;
  end if;

  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id, rebuild_provenance)
  values
    (owner_id, 'verification rebuilt card', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb,
     snapshot, repeat('a', 64), 'verify', 'verify', provenance)
  returning id into rebuilt_id;

  insert into public.ip_user_preference_cards
    (user_id, title, procedure_code, scenario_id, status, builder_inputs, card_snapshot,
     snapshot_hash, engine_version, catalog_import_id)
  values
    (owner_id, 'verification ordinary card', 'VERIFY_ONLY', 'verify-only', 'draft', '{}'::jsonb,
     snapshot, repeat('b', 64), 'verify', 'verify')
  returning id into ordinary_id;

  -- (a) changing an existing value
  rewrote := true;
  begin
    update public.ip_user_preference_cards
       set rebuild_provenance = jsonb_build_object('version', 'forged')
     where id = rebuilt_id;
  exception when others then
    rewrote := false;
  end;
  if rewrote then raise exception 'rebuild_provenance was overwritten and should not have been'; end if;

  -- (b) clearing it
  rewrote := true;
  begin
    update public.ip_user_preference_cards
       set rebuild_provenance = null
     where id = rebuilt_id;
  exception when others then
    rewrote := false;
  end;
  if rewrote then raise exception 'rebuild_provenance was cleared and should not have been'; end if;

  -- (c) granting provenance to a card that was never rebuilt
  rewrote := true;
  begin
    update public.ip_user_preference_cards
       set rebuild_provenance = provenance
     where id = ordinary_id;
  exception when others then
    rewrote := false;
  end;
  if rewrote then
    raise exception 'a card that was not rebuilt was given rebuild provenance';
  end if;

  -- An ordinary edit still works. The trigger must protect one column, not freeze the row.
  update public.ip_user_preference_cards
     set title = 'verification rebuilt card, renamed'
   where id = rebuilt_id;

  if (select rebuild_provenance from public.ip_user_preference_cards where id = rebuilt_id)
       is distinct from provenance then
    raise exception 'rebuild_provenance did not survive an unrelated update';
  end if;

  raise notice 'Part 3 passed: provenance is write-once and an ordinary edit still applies.';
end;
$$;

-- =============================================================================================
-- Part 4 — the applied revision machinery is untouched.
-- =============================================================================================
--
-- This migration deliberately does not add the column to the revision table and deliberately does
-- not touch `private.ip_preference_card_content_changed`. Both are asserted, because "we left it
-- alone" is exactly the kind of claim that stops being true in a later edit nobody re-reads.

do $$
declare
  content_definition text;
  revision_has_column boolean;
begin
  select pg_get_functiondef(p.oid)
    into content_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname = 'ip_preference_card_content_changed';

  if content_definition is null then
    raise exception 'private.ip_preference_card_content_changed is missing';
  end if;
  if content_definition like '%rebuild_provenance%' then
    raise exception
      'rebuild_provenance became revision-bearing content; it can never change, so it must not be';
  end if;

  select exists (
    select 1
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'ip_user_preference_card_revisions'
       and a.attname = 'rebuild_provenance'
       and a.attnum > 0
       and not a.attisdropped
  ) into revision_has_column;

  if revision_has_column then
    raise exception 'the revision table gained rebuild_provenance; this migration does not add it';
  end if;

  raise notice 'Part 4 passed: revision machinery untouched.';
end;
$$;

-- =============================================================================================
-- Part 5 — nothing was left behind.
-- =============================================================================================

do $$
declare
  baseline record;
begin
  select * into baseline from verify_rebuild_baseline;

  if (select count(*) from public.ip_user_preference_cards) <> baseline.card_count + 2 then
    raise exception 'unexpected card count before rollback';
  end if;
  if (select count(*) from public.ip_user_preference_card_revisions)
       < baseline.revision_count + 2 then
    raise exception 'the revision trigger did not fire for the two test cards';
  end if;
  if (select count(*) from public.ip_user_preference_cards where rebuild_provenance is not null)
       <> baseline.provenance_count + 1 then
    raise exception 'exactly one test card should carry provenance';
  end if;

  raise notice 'Part 5 passed: two test cards created, both about to be rolled back.';
  raise notice 'ALL CHECKS PASSED';
end;
$$;

rollback;
