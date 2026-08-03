-- IP preference cards: append-only saved-card revisions, a content-versioned `updated_at`,
-- and trigger-only revision writes.
--
-- A saved card is mutable by design — the owner edits it in place and keeps its id, its share
-- link, and its history. That was fine while nothing needed to refer to a *particular* state of
-- it. It stops being fine the moment anything must say "this was built from that card as the
-- physician reviewed it", because a card id alone names a moving target: the card can be edited
-- afterwards, and the reference then points at something nobody reviewed.
--
-- So every state a card has ever been saved in becomes its own immutable, addressable row here.
-- This table is the thing a later rebuild will cite. Nothing in this migration rebuilds,
-- upgrades, migrates, or re-resolves anything.
--
-- Three properties this file is responsible for, none of which the application can provide:
--
--  1. **`updated_at` means "the content changed".** It is the optimistic-concurrency token an
--     edit session holds, so a change that does not alter what the card says must not move it —
--     otherwise toggling a share link would invalidate somebody's open editor.
--  2. **Revisions are written by the trigger and by nothing else.** No Data API role holds
--     `insert` on the revision table, so a signed-in owner cannot append a revision of their own
--     construction through PostgREST.
--  3. **A revision cannot disagree with the card state it claims to record.** The extracted
--     columns are constrained against their own JSON source, and the owner against the card's.
--
-- No PHI, exactly as the cards table: a revision names a procedure, a physician, and equipment.

-- ---------------------------------------------------------------------------------------------
-- 0. One definition of "revision-bearing content"
-- ---------------------------------------------------------------------------------------------
--
-- Two triggers need to agree on what a content change is: the one that moves `updated_at` and the
-- one that appends a revision. Two hand-maintained column lists would drift, and the drift would
-- be silent and bad in both directions — a card whose timestamp moved without a revision, or a
-- revision whose recorded timestamp belongs to a different state.
--
-- So there is one function and both call it. Adding a column to a card is now a decision made in
-- exactly one place.

create or replace function public.ip_preference_card_content_changed(
  before_row public.ip_user_preference_cards,
  after_row public.ip_user_preference_cards
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
       before_row.title            is distinct from after_row.title
    or before_row.physician_name   is distinct from after_row.physician_name
    or before_row.procedure_code   is distinct from after_row.procedure_code
    or before_row.scenario_id      is distinct from after_row.scenario_id
    or before_row.status           is distinct from after_row.status
    or before_row.builder_inputs   is distinct from after_row.builder_inputs
    or before_row.card_snapshot    is distinct from after_row.card_snapshot
    or before_row.snapshot_hash    is distinct from after_row.snapshot_hash
    or before_row.engine_version   is distinct from after_row.engine_version
    or before_row.catalog_import_id is distinct from after_row.catalog_import_id;
$$;

revoke execute on function public.ip_preference_card_content_changed(
  public.ip_user_preference_cards, public.ip_user_preference_cards
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 1. `updated_at` becomes a content version, not a row-touch timestamp
-- ---------------------------------------------------------------------------------------------
--
-- The generic `set_site_updated_at` moves the timestamp on *every* update, including one that
-- only flips `share_enabled`. That is wrong here for two compounding reasons: the printed card
-- shows "last saved" and `printDocumentHash` covers it, so sharing a card changed its printed
-- document; and `updated_at` is the token an edit session compares against, so sharing a card
-- would invalidate an editor that had been open the whole time and changed nothing.
--
-- `set_site_updated_at` is shared by a dozen other tables and is left exactly as it is. Only this
-- table's trigger is replaced.

create or replace function public.ip_set_preference_card_content_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.ip_preference_card_content_changed(old, new) then
    new.updated_at = timezone('utc', now());
  else
    -- Access-control-only change: `share_enabled`, and `share_token` if it is ever deliberately
    -- rotated. The card still says exactly what it said, so its content version must not move.
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.ip_set_preference_card_content_updated_at()
  from public, anon, authenticated;

drop trigger if exists set_ip_user_preference_cards_updated_at
  on public.ip_user_preference_cards;

create trigger set_ip_user_preference_cards_content_updated_at
  before update on public.ip_user_preference_cards
  for each row
  execute function public.ip_set_preference_card_content_updated_at();

-- The composite target an owner-checked foreign key needs. `id` is already the primary key, so
-- this adds no new uniqueness — it exists purely so `(card_id, user_id)` can be pointed at it,
-- which is what makes "a revision's owner is the card's owner" a database fact.
alter table public.ip_user_preference_cards
  drop constraint if exists ip_user_preference_cards_id_user_id_key;
alter table public.ip_user_preference_cards
  add constraint ip_user_preference_cards_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------------------------
-- 2. The revision table
-- ---------------------------------------------------------------------------------------------

create table if not exists public.ip_user_preference_card_revisions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Assigned by trigger, never by a client. Unique per card, so a concurrent double-write fails
  -- one statement rather than silently forking the history into two revision 3s. This is a
  -- uniqueness guarantee and nothing more — stale-edit protection is the conditional update in
  -- `saveUserCard`, which is a different mechanism solving a different problem.
  revision_number integer not null,

  title text not null,
  physician_name text,
  status text not null,
  -- The card's full identity, not just its editable metadata. Edit mode cannot currently change
  -- the procedure — the picker is replaced by a read-only panel — but the revision records the
  -- complete row state rather than the subset today's writers happen to vary, so a future writer
  -- that did change it could not produce a revision that failed to say so.
  procedure_code text not null,
  scenario_id text not null,

  builder_inputs jsonb not null,
  card_snapshot jsonb not null,

  -- Storage identity, copied verbatim from the card row.
  snapshot_hash text not null,
  -- Lifted out of the snapshot rather than recomputed: these are the values the snapshot itself
  -- carries, and computing them here would be a second implementation of a load-bearing hash.
  -- Null on a snapshot written before the hashes were split — an unhashed old row is not a
  -- tampered row, and inventing a value for it would be worse than recording that it has none.
  snapshot_integrity_hash text,
  resolved_content_hash text,

  engine_version text not null,
  -- The immutable authored dependency set this state resolved through, and the retained catalog
  -- release its product identity came from. Both null for a card written before releases pinned
  -- them; both are exactly what a rebuild must eventually cite.
  release_bundle_id text,
  catalog_release_id text,

  -- When the card reached this state, which is also the "updated" value the printed page showed
  -- while it held that state. One column and not two, because — now that `updated_at` moves only
  -- on a content change — they are the same fact. The print-document hash is derived from it in
  -- application code, so a stored hash can never disagree with its own inputs.
  created_at timestamp with time zone not null,
  created_by uuid not null,

  -- A revision belongs to the owner of the card it records. Enforced by the database rather than
  -- by the trigger copying the right value: a composite reference is checked on every write,
  -- including any future one nobody has thought of yet. The cascade is also what removes a
  -- card's history when the card is deleted.
  constraint ip_user_preference_card_revisions_card_owner_fkey
    foreign key (card_id, user_id)
    references public.ip_user_preference_cards (id, user_id)
    on delete cascade,

  constraint ip_user_preference_card_revisions_number_check check (revision_number >= 1),
  constraint ip_user_preference_card_revisions_status_check check (
    status = any (array['draft', 'final'])
  ),
  constraint ip_user_preference_card_revisions_procedure_code_check check (
    procedure_code ~ '^[A-Z0-9_]{1,64}$'
  ),
  constraint ip_user_preference_card_revisions_scenario_id_check check (
    length(trim(scenario_id)) between 1 and 100
  ),
  constraint ip_user_preference_card_revisions_snapshot_hash_check check (
    snapshot_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint ip_user_preference_card_revisions_integrity_hash_check check (
    snapshot_integrity_hash is null or snapshot_integrity_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint ip_user_preference_card_revisions_content_hash_check check (
    resolved_content_hash is null or resolved_content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint ip_user_preference_card_revisions_card_snapshot_check check (
    jsonb_typeof(card_snapshot) = 'object'
  ),
  constraint ip_user_preference_card_revisions_builder_inputs_check check (
    jsonb_typeof(builder_inputs) = 'object'
  ),

  -- The extracted columns exist so a reader does not have to dig through JSON. That convenience
  -- is only safe while they cannot disagree with the JSON they were lifted from, so they are
  -- constrained against it rather than trusted to the writer. `is not distinct from` keeps the
  -- legacy shapes valid: a pre-split snapshot carries neither the key nor the column, and null on
  -- both sides is a match.
  constraint ip_user_preference_card_revisions_integrity_hash_matches check (
    snapshot_integrity_hash is not distinct from (card_snapshot ->> 'snapshotIntegrityHash')
  ),
  constraint ip_user_preference_card_revisions_content_hash_matches check (
    resolved_content_hash is not distinct from (card_snapshot ->> 'resolvedContentHash')
  ),
  constraint ip_user_preference_card_revisions_release_pin_matches check (
    release_bundle_id is not distinct from (builder_inputs ->> 'releaseBundleId')
  ),
  constraint ip_user_preference_card_revisions_catalog_release_matches check (
    catalog_release_id is not distinct from
      (card_snapshot -> 'resolutionProvenance' ->> 'catalogReleaseId')
  )
);

create unique index if not exists ip_user_preference_card_revisions_card_number_idx
  on public.ip_user_preference_card_revisions (card_id, revision_number);

create index if not exists ip_user_preference_card_revisions_card_created_idx
  on public.ip_user_preference_card_revisions (card_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- 3. Revision numbering
-- ---------------------------------------------------------------------------------------------
--
-- Dense and monotonic per card. Reading `max() + 1` is racy on its own; the unique index above is
-- what makes it safe. Two concurrent inserts both read 2, both try to write 3, and one of them
-- fails. A failed statement is recoverable. Two rows both calling themselves revision 3 are not.

create or replace function public.ip_assign_preference_card_revision_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(max(revision.revision_number), 0) + 1
    into new.revision_number
    from public.ip_user_preference_card_revisions as revision
   where revision.card_id = new.card_id;
  return new;
end;
$$;

revoke execute on function public.ip_assign_preference_card_revision_number()
  from public, anon, authenticated;

drop trigger if exists assign_ip_user_preference_card_revision_number
  on public.ip_user_preference_card_revisions;
create trigger assign_ip_user_preference_card_revision_number
  before insert on public.ip_user_preference_card_revisions
  for each row
  execute function public.ip_assign_preference_card_revision_number();

-- ---------------------------------------------------------------------------------------------
-- 4. Append-only, enforced
-- ---------------------------------------------------------------------------------------------
--
-- There is no update policy and no update grant below, which is already two barriers; this is the
-- third, and it is the one that still holds if a future migration widens either. There is
-- deliberately no matching delete trigger: a foreign-key cascade is a referential action, not a
-- statement, so a trigger that raised on delete would make deleting a *card* fail.

create or replace function public.ip_reject_preference_card_revision_rewrite()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    'Preference card revisions are append-only. Revision % of card % cannot be rewritten.',
    old.revision_number, old.card_id
    using errcode = 'restrict_violation';
end;
$$;

revoke execute on function public.ip_reject_preference_card_revision_rewrite()
  from public, anon, authenticated;

drop trigger if exists reject_ip_user_preference_card_revision_rewrite
  on public.ip_user_preference_card_revisions;
create trigger reject_ip_user_preference_card_revision_rewrite
  before update on public.ip_user_preference_card_revisions
  for each row
  execute function public.ip_reject_preference_card_revision_rewrite();

-- ---------------------------------------------------------------------------------------------
-- 5. The one writer
-- ---------------------------------------------------------------------------------------------
--
-- Every saved state becomes a revision, written here and reachable no other way.
--
-- **Why the database and not the application.** It is atomic — the card row and its revision are
-- one statement, so there is no window in which a card has been saved and its revision has not.
-- And it cannot be forgotten: `saveUserCard`, `renameUserCard`, and `duplicateUserCard` all reach
-- the cards table by different paths, and a future fourth writer gets revisions without knowing
-- this table exists.
--
-- **Why `security definer`.** No Data API role holds `insert` on the revision table, which is
-- what makes "revisions are trigger-written" true rather than merely conventional — a signed-in
-- owner cannot PostgREST an append of their own construction. The trigger therefore cannot run as
-- the invoker, so it runs as this function's owner (the migration role), which owns the table and
-- is not subject to its policies.
--
-- **What still authorizes the write.** Row-level security on the *cards* table, unchanged. This
-- function only ever runs because an insert or update on a card already passed those policies, so
-- the caller's right to change the card is the caller's right to produce its revision. Nothing
-- here re-decides that, and nothing here can be reached without it:
--
--   * `execute` is revoked from `public`, `anon`, and `authenticated`.
--   * It returns `trigger`, so PostgREST will not expose it as an RPC in any case.
--   * It refuses to run attached to any table but the cards table, so it cannot be borrowed.
--   * Every value it writes comes from `new.*` — the row that fired it. It takes no arguments and
--     reads no caller-supplied input, so there is nothing to inject a different card through.
--
-- `search_path` is empty and every reference is schema-qualified, so a `search_path` a caller
-- controls cannot resolve any name in here to something of their choosing.

create or replace function public.ip_append_preference_card_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- This function writes a row it claims is derived from a preference card. It may only ever run
  -- where that is true by construction.
  if tg_table_schema <> 'public' or tg_table_name <> 'ip_user_preference_cards' then
    raise exception
      'ip_append_preference_card_revision may only be attached to public.ip_user_preference_cards, not %.%',
      tg_table_schema, tg_table_name
      using errcode = 'feature_not_supported';
  end if;

  -- What makes a new revision is a change to the card's *state*, not to the row's access control.
  -- Toggling sharing changes nothing this table records and — since the content timestamp trigger
  -- above leaves `updated_at` alone for it — nothing the printed document shows either.
  if tg_op = 'UPDATE' and not public.ip_preference_card_content_changed(old, new) then
    return null;
  end if;

  insert into public.ip_user_preference_card_revisions (
    card_id,
    user_id,
    revision_number,
    title,
    physician_name,
    status,
    procedure_code,
    scenario_id,
    builder_inputs,
    card_snapshot,
    snapshot_hash,
    snapshot_integrity_hash,
    resolved_content_hash,
    engine_version,
    release_bundle_id,
    catalog_release_id,
    created_at,
    created_by
  )
  values (
    new.id,
    new.user_id,
    -- Overwritten by the assignment trigger. A placeholder rather than a computed value, so there
    -- is exactly one place that decides what the next number is.
    1,
    new.title,
    new.physician_name,
    new.status,
    new.procedure_code,
    new.scenario_id,
    new.builder_inputs,
    new.card_snapshot,
    new.snapshot_hash,
    -- Plain reads of fields the snapshot already carries. Nothing is derived here, and the table's
    -- own constraints re-check each one against the JSON it came from.
    new.card_snapshot ->> 'snapshotIntegrityHash',
    new.card_snapshot ->> 'resolvedContentHash',
    new.engine_version,
    new.builder_inputs ->> 'releaseBundleId',
    new.card_snapshot -> 'resolutionProvenance' ->> 'catalogReleaseId',
    new.updated_at,
    -- The signed-in caller when there is one. `auth.uid()` is null under the service role and in
    -- migrations, where the card's owner is the only defensible answer.
    coalesce(auth.uid(), new.user_id)
  );

  return null;
end;
$$;

revoke execute on function public.ip_append_preference_card_revision()
  from public, anon, authenticated;

drop trigger if exists append_ip_user_preference_card_revision
  on public.ip_user_preference_cards;
create trigger append_ip_user_preference_card_revision
  after insert or update on public.ip_user_preference_cards
  for each row
  execute function public.ip_append_preference_card_revision();

-- ---------------------------------------------------------------------------------------------
-- 6. Backfill
-- ---------------------------------------------------------------------------------------------
--
-- Existing cards get one revision recording the state they are in now.
--
-- This is not their history — nothing captured it, and manufacturing one would be inventing
-- states the physician never saved. It is the honest floor: from here on every state is recorded,
-- and the state each card was in when this ran is revision 1. `created_at` is the card's own
-- `updated_at`, because that is genuinely when the card reached this state.
--
-- It runs as the migration role, which owns the table and is therefore the only writer besides
-- the trigger — exactly the two the grants below permit.

insert into public.ip_user_preference_card_revisions (
  card_id,
  user_id,
  revision_number,
  title,
  physician_name,
  status,
  procedure_code,
  scenario_id,
  builder_inputs,
  card_snapshot,
  snapshot_hash,
  snapshot_integrity_hash,
  resolved_content_hash,
  engine_version,
  release_bundle_id,
  catalog_release_id,
  created_at,
  created_by
)
select
  card.id,
  card.user_id,
  1,
  card.title,
  card.physician_name,
  card.status,
  card.procedure_code,
  card.scenario_id,
  card.builder_inputs,
  card.card_snapshot,
  card.snapshot_hash,
  card.card_snapshot ->> 'snapshotIntegrityHash',
  card.card_snapshot ->> 'resolvedContentHash',
  card.engine_version,
  card.builder_inputs ->> 'releaseBundleId',
  card.card_snapshot -> 'resolutionProvenance' ->> 'catalogReleaseId',
  card.updated_at,
  card.user_id
from public.ip_user_preference_cards as card
where not exists (
  select 1
    from public.ip_user_preference_card_revisions as revision
   where revision.card_id = card.id
);

-- ---------------------------------------------------------------------------------------------
-- 7. Grants and policies
-- ---------------------------------------------------------------------------------------------

alter table public.ip_user_preference_card_revisions enable row level security;

-- Read your own, and that is the entire client surface. There is no insert policy, no update
-- policy, and no delete policy, and row-level security denies what no policy permits — so even a
-- future migration that mistakenly granted a verb would still find no policy to satisfy.
drop policy if exists ip_user_preference_card_revisions_select_own
  on public.ip_user_preference_card_revisions;
create policy ip_user_preference_card_revisions_select_own
  on public.ip_user_preference_card_revisions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists ip_user_preference_card_revisions_insert_own
  on public.ip_user_preference_card_revisions;

revoke all on table public.ip_user_preference_card_revisions from public, anon, authenticated;

-- `select` and nothing else, for every Data API role including the service role.
--
-- The service role is the interesting one: it bypasses row-level security, so an `insert` grant
-- there would be a hole no policy could close, and "revisions are written by the trigger" would
-- hold only for callers not holding that key. It reads them and does not write them. The trigger
-- and the migration owner are the only writers, which is the property the whole design rests on.
grant select on table public.ip_user_preference_card_revisions to authenticated;
grant select on table public.ip_user_preference_card_revisions to service_role;

notify pgrst, 'reload schema';
