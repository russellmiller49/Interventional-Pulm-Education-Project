-- Verification for 20260803151005_index_ip_preference_card_revision_foreign_keys.sql
--
-- Run once, against the project, immediately after applying that migration.
--
-- Every check reads the system catalogs and compares the index's *actual key columns in order*,
-- resolved through `pg_index.indkey` and `pg_attribute`. A name proves nothing: an index called
-- `..._card_owner_idx` over the wrong columns, in the wrong order, partial, unique, or on a
-- different access method would satisfy a name check and cover nothing. The point of the migration
-- is that `(card_id, user_id)` exactly matches a foreign key, so exact is what gets asserted.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and execute it as one script. It reads only
--   — no statement here inserts, updates, or deletes anything — and it is additionally wrapped in
--   a transaction that ends in `rollback`, so the read-only claim does not rest on inspection. Row
--   counts and a content digest are taken at the start and re-checked at the end.
--
--   A failed assertion raises and aborts. The final "ALL CHECKS PASSED" notice is the pass
--   condition; anything else is a failure to read.
--
-- WHAT IT DOES NOT DO
--   It does not measure query plans, and it does not re-run the Supabase performance advisor. The
--   advisor delta returning to its 147/51/96 baseline is the separate, external confirmation that
--   these two findings are gone.

begin;

-- Snapshot first, compared at the end. The script should not be able to change anything; this is
-- how that stops being a promise about the SQL below and becomes a checked fact.
create temporary table verify_index_baseline on commit drop as
select
  (select count(*) from public.ip_user_preference_cards) as card_count,
  (select count(*) from public.ip_user_preference_card_revisions) as revision_count,
  (select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
     from (
       select md5(r.*::text) as digest from public.ip_user_preference_card_revisions r
     ) as t) as revision_digest,
  (select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
     from (
       select md5(c.*::text) as digest from public.ip_user_preference_cards c
     ) as t) as card_digest;

-- =============================================================================================
-- Part 1 — the two new indexes, checked column by column.
-- =============================================================================================

do $$
declare
  target record;
  actual_columns text[];
  key_count integer;
  total_count integer;
  is_unique boolean;
  is_partial boolean;
  has_expressions boolean;
  is_valid boolean;
  is_ready boolean;
  access_method text;
begin
  for target in
    select *
      from (values
        ('ip_user_preference_card_revisions_user_id_idx', array['user_id']),
        ('ip_user_preference_card_revisions_card_owner_idx', array['card_id', 'user_id'])
      ) as t(index_name, expected_columns)
  loop
    -- Existence, on the right table, in the right schema.
    select i.indisunique,
           i.indpred is not null,
           i.indexprs is not null,
           i.indisvalid,
           i.indisready,
           i.indnkeyatts,
           i.indnatts,
           am.amname
      into is_unique, is_partial, has_expressions, is_valid, is_ready,
           key_count, total_count, access_method
      from pg_index i
      join pg_class ic on ic.oid = i.indexrelid
      join pg_namespace ins on ins.oid = ic.relnamespace
      join pg_am am on am.oid = ic.relam
     where ins.nspname = 'public'
       and ic.relname = target.index_name
       and i.indrelid = 'public.ip_user_preference_card_revisions'::regclass;

    if not found then
      raise exception 'FAIL: index %.% does not exist on public.ip_user_preference_card_revisions',
        'public', target.index_name;
    end if;

    if access_method <> 'btree' then
      raise exception 'FAIL: % is a % index, expected btree', target.index_name, access_method;
    end if;
    if not is_valid then
      raise exception 'FAIL: % is not valid (a failed concurrent build leaves an invalid index)',
        target.index_name;
    end if;
    if not is_ready then
      raise exception 'FAIL: % is not ready, so it is not being used for lookups',
        target.index_name;
    end if;
    if is_unique then
      raise exception 'FAIL: % is unique; a covering index for a foreign key must not constrain the referencing side',
        target.index_name;
    end if;
    if is_partial then
      raise exception 'FAIL: % is partial, so it covers only some rows and cannot back a foreign key',
        target.index_name;
    end if;
    if has_expressions then
      raise exception 'FAIL: % contains expression columns rather than plain column references',
        target.index_name;
    end if;
    -- An INCLUDE column is stored but not part of the key, so a key/total mismatch would mean the
    -- columns asserted below are not all doing the work the constraint needs.
    if total_count <> key_count then
      raise exception 'FAIL: % has % key column(s) and % total; INCLUDE columns are not expected',
        target.index_name, key_count, total_count;
    end if;

    -- The key columns, in order. `with ordinality` preserves index position, which is the whole
    -- question for the composite index — `(user_id, card_id)` would cover a different constraint.
    select array_agg(a.attname order by k.ord)
      into actual_columns
      from pg_index i
      join pg_class ic on ic.oid = i.indexrelid
      join pg_namespace ins on ins.oid = ic.relnamespace
      cross join lateral unnest(i.indkey[0:i.indnkeyatts - 1]) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
     where ins.nspname = 'public'
       and ic.relname = target.index_name;

    if actual_columns is distinct from target.expected_columns then
      raise exception 'FAIL: % indexes (%), expected (%)',
        target.index_name,
        array_to_string(coalesce(actual_columns, array[]::text[]), ', '),
        array_to_string(target.expected_columns, ', ');
    end if;

    raise notice 'OK  % is a valid ready non-unique non-partial btree on (%)',
      target.index_name, array_to_string(target.expected_columns, ', ');
  end loop;
end $$;

-- =============================================================================================
-- Part 2 — the foreign keys these indexes exist for, unchanged.
-- =============================================================================================

do $$
declare
  target record;
  actual_columns text[];
  confirmed boolean;
begin
  for target in
    select *
      from (values
        ('ip_user_preference_card_revisions_user_id_fkey', array['user_id']),
        ('ip_user_preference_card_revisions_card_owner_fkey', array['card_id', 'user_id'])
      ) as t(constraint_name, expected_columns)
  loop
    select c.convalidated
      into confirmed
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
     where n.nspname = 'public'
       and c.conname = target.constraint_name
       and c.conrelid = 'public.ip_user_preference_card_revisions'::regclass
       and c.contype = 'f';

    if not found then
      raise exception 'FAIL: foreign key % is missing from the revision table', target.constraint_name;
    end if;
    if not confirmed then
      raise exception 'FAIL: foreign key % is not validated', target.constraint_name;
    end if;

    select array_agg(a.attname order by k.ord)
      into actual_columns
      from pg_constraint c
      cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.conname = target.constraint_name
       and c.conrelid = 'public.ip_user_preference_card_revisions'::regclass;

    if actual_columns is distinct from target.expected_columns then
      raise exception 'FAIL: foreign key % references (%), expected (%)',
        target.constraint_name,
        array_to_string(coalesce(actual_columns, array[]::text[]), ', '),
        array_to_string(target.expected_columns, ', ');
    end if;

    raise notice 'OK  foreign key % still constrains exactly (%)',
      target.constraint_name, array_to_string(target.expected_columns, ', ');
  end loop;
end $$;

-- The index and the constraint must agree column for column, or "covering" is a claim rather than
-- a fact. Asserted as a join between the two catalogs rather than by comparing both to a literal.
do $$
declare
  mismatched text;
begin
  select string_agg(format('%s vs %s', pair.constraint_name, pair.index_name), ', ')
    into mismatched
    from (
      select
        c.conname as constraint_name,
        ic.relname as index_name,
        (select array_agg(a.attname order by k.ord)
           from unnest(c.conkey) with ordinality as k(attnum, ord)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as fk_columns,
        (select array_agg(a.attname order by k.ord)
           from unnest(i.indkey[0:i.indnkeyatts - 1]) with ordinality as k(attnum, ord)
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) as idx_columns
        from pg_constraint c
        join pg_class ic
          on ic.relname = case c.conname
               when 'ip_user_preference_card_revisions_user_id_fkey'
                 then 'ip_user_preference_card_revisions_user_id_idx'
               when 'ip_user_preference_card_revisions_card_owner_fkey'
                 then 'ip_user_preference_card_revisions_card_owner_idx'
             end
        join pg_index i on i.indexrelid = ic.oid
       where c.conrelid = 'public.ip_user_preference_card_revisions'::regclass
         and c.contype = 'f'
    ) as pair
   where pair.fk_columns is distinct from pair.idx_columns;

  if mismatched is not null then
    raise exception 'FAIL: index does not cover its foreign key column for column: %', mismatched;
  end if;
  raise notice 'OK  each new index covers its foreign key column for column';
end $$;

-- =============================================================================================
-- Part 3 — the three original indexes survive.
-- =============================================================================================

do $$
declare
  missing text;
begin
  select string_agg(expected, ', ' order by expected)
    into missing
    from unnest(array[
      'ip_user_preference_card_revisions_pkey',
      'ip_user_preference_card_revisions_card_number_idx',
      'ip_user_preference_card_revisions_card_created_idx'
    ]) as expected
   where not exists (
     select 1
       from pg_index i
       join pg_class ic on ic.oid = i.indexrelid
      where ic.relname = expected
        and i.indrelid = 'public.ip_user_preference_card_revisions'::regclass
        and i.indisvalid
   );
  if missing is not null then
    raise exception 'FAIL: original index(es) dropped or invalidated: %', missing;
  end if;
  raise notice 'OK  the primary key, the (card_id, revision_number) unique index, and the (card_id, created_at desc) history index all survive';
end $$;

-- The unique index has to still *be* unique — an index that survived by name while losing its
-- uniqueness would take the revision-numbering guarantee with it.
do $$
declare
  still_unique boolean;
begin
  select i.indisunique into still_unique
    from pg_index i
    join pg_class ic on ic.oid = i.indexrelid
   where ic.relname = 'ip_user_preference_card_revisions_card_number_idx'
     and i.indrelid = 'public.ip_user_preference_card_revisions'::regclass;
  if not coalesce(still_unique, false) then
    raise exception 'FAIL: the (card_id, revision_number) index is no longer unique';
  end if;
  raise notice 'OK  (card_id, revision_number) is still unique';
end $$;

-- Exactly five indexes: three original, two new. A sixth would mean something arrived that this
-- history does not account for.
do $$
declare
  found_indexes text;
  expected_indexes text := 'ip_user_preference_card_revisions_card_created_idx, '
    || 'ip_user_preference_card_revisions_card_number_idx, '
    || 'ip_user_preference_card_revisions_card_owner_idx, '
    || 'ip_user_preference_card_revisions_pkey, '
    || 'ip_user_preference_card_revisions_user_id_idx';
begin
  select string_agg(ic.relname, ', ' order by ic.relname)
    into found_indexes
    from pg_index i
    join pg_class ic on ic.oid = i.indexrelid
   where i.indrelid = 'public.ip_user_preference_card_revisions'::regclass;

  if found_indexes is distinct from expected_indexes then
    raise exception 'FAIL: index set is %, expected %', found_indexes, expected_indexes;
  end if;
  raise notice 'OK  exactly the three original indexes plus the two new ones';
end $$;

-- =============================================================================================
-- Part 4 — nothing was read into existence, and nothing was changed.
-- =============================================================================================

do $$
declare
  before_row record;
  card_count bigint;
  revision_count bigint;
  revision_digest text;
  card_digest text;
begin
  select * into before_row from verify_index_baseline;

  select count(*) into card_count from public.ip_user_preference_cards;
  select count(*) into revision_count from public.ip_user_preference_card_revisions;
  select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
    into revision_digest
    from (select md5(r.*::text) as digest from public.ip_user_preference_card_revisions r) as t;
  select coalesce(md5(string_agg(t.digest, '|' order by t.digest)), '<none>')
    into card_digest
    from (select md5(c.*::text) as digest from public.ip_user_preference_cards c) as t;

  if card_count <> before_row.card_count or revision_count <> before_row.revision_count then
    raise exception 'FAIL: row counts moved during verification (cards % -> %, revisions % -> %)',
      before_row.card_count, card_count, before_row.revision_count, revision_count;
  end if;
  if card_digest <> before_row.card_digest or revision_digest <> before_row.revision_digest then
    raise exception 'FAIL: card or revision content changed during verification';
  end if;

  raise notice 'OK  % card row(s) and % revision row(s), byte-identical before and after',
    card_count, revision_count;
end $$;

do $$
begin
  raise notice '--------------------------------------------------';
  raise notice 'ALL CHECKS PASSED';
  raise notice 'Rolling back: this script only ever read.';
  raise notice 'Re-run the Supabase performance advisor to confirm';
  raise notice 'the INFO count returns to its 96-finding baseline.';
  raise notice '--------------------------------------------------';
end $$;

rollback;
