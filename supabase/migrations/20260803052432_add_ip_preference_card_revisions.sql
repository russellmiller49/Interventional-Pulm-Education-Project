-- IP preference cards: append-only saved-card revisions.
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
-- No PHI, exactly as the cards table: a revision names a procedure, a physician, and equipment.

create table if not exists public.ip_user_preference_card_revisions (
  id uuid primary key default gen_random_uuid(),
  -- Cascade is deliberate and is the *only* delete path. Revisions are append-only relative to
  -- the card's own lifetime: nothing may rewrite or remove an individual revision, and an owner
  -- deleting their own card takes its history with it. A revision that outlived the card it
  -- describes would be a record of a document the owner asked to be rid of.
  card_id uuid not null references public.ip_user_preference_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Assigned by trigger, never by a client. Unique per card, so a concurrent double-write fails
  -- one statement rather than silently forking the history into two revision 3s.
  revision_number integer not null,

  title text not null,
  physician_name text,
  status text not null,

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

  -- When the card reached this state. Also the "updated" value the printed page showed at the
  -- time, which is why there is one column and not two: the print-document hash is derived from
  -- it in application code, so a stored hash can never disagree with its own inputs.
  created_at timestamp with time zone not null,
  created_by uuid not null,

  constraint ip_user_preference_card_revisions_number_check check (revision_number >= 1),
  constraint ip_user_preference_card_revisions_status_check check (
    status = any (array['draft', 'final'])
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
  )
);

create unique index if not exists ip_user_preference_card_revisions_card_number_idx
  on public.ip_user_preference_card_revisions (card_id, revision_number);

create index if not exists ip_user_preference_card_revisions_card_created_idx
  on public.ip_user_preference_card_revisions (card_id, created_at desc);

-- Revision numbers are dense and monotonic per card, assigned server-side.
--
-- Reading max() and adding one is racy on its own; the unique index above is what makes it
-- safe. Two concurrent saves both read 2, both try to write 3, and one of them fails the
-- insert. A failed save is recoverable. Two rows both calling themselves revision 3 are not.
create or replace function public.ip_assign_preference_card_revision_number()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  select coalesce(max(revision.revision_number), 0) + 1
    into new.revision_number
    from public.ip_user_preference_card_revisions as revision
   where revision.card_id = new.card_id;
  return new;
end;
$$;

drop trigger if exists assign_ip_user_preference_card_revision_number
  on public.ip_user_preference_card_revisions;
create trigger assign_ip_user_preference_card_revision_number
  before insert on public.ip_user_preference_card_revisions
  for each row
  execute function public.ip_assign_preference_card_revision_number();

-- Append-only, enforced rather than asserted.
--
-- There is no update policy and no update grant below, which is already two barriers; this is
-- the third, and it is the one that still holds if a future migration widens either. There is
-- deliberately no matching delete trigger: a foreign-key cascade is a referential action, not a
-- statement, so a trigger that raised on delete would make deleting a *card* fail.
create or replace function public.ip_reject_preference_card_revision_rewrite()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception
    'Preference card revisions are append-only. Revision % of card % cannot be rewritten.',
    old.revision_number, old.card_id
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists reject_ip_user_preference_card_revision_rewrite
  on public.ip_user_preference_card_revisions;
create trigger reject_ip_user_preference_card_revision_rewrite
  before update on public.ip_user_preference_card_revisions
  for each row
  execute function public.ip_reject_preference_card_revision_rewrite();

-- Every saved state becomes a revision, written by the database rather than by the caller.
--
-- Two properties follow from putting it here and nowhere else. It is atomic: a card row and its
-- revision are one statement, so there is no window in which a card has been saved and its
-- revision has not. And it cannot be forgotten: `saveUserCard`, `renameUserCard`, and
-- `duplicateUserCard` all write to the cards table by different paths, and a future fourth
-- writer gets the behaviour without knowing this table exists.
--
-- It runs as the invoking user, so row-level security remains the single authority on who may
-- write what — a security-definer trigger here would quietly become a second one.
create or replace function public.ip_append_preference_card_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- What makes a new revision is a change to the card's *state*, not to the row's access
  -- control. Toggling sharing bumps `updated_at` and changes nothing this table records; a
  -- revision written for it would be an identical row claiming something happened.
  if tg_op = 'UPDATE'
     and new.title is not distinct from old.title
     and new.physician_name is not distinct from old.physician_name
     and new.status is not distinct from old.status
     and new.builder_inputs is not distinct from old.builder_inputs
     and new.card_snapshot is not distinct from old.card_snapshot
     and new.snapshot_hash is not distinct from old.snapshot_hash
     and new.engine_version is not distinct from old.engine_version
     and new.catalog_import_id is not distinct from old.catalog_import_id
  then
    return null;
  end if;

  insert into public.ip_user_preference_card_revisions (
    card_id,
    user_id,
    revision_number,
    title,
    physician_name,
    status,
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
    -- Overwritten by the assignment trigger. A placeholder rather than a computed value, so
    -- there is exactly one place that decides what the next number is.
    1,
    new.title,
    new.physician_name,
    new.status,
    new.builder_inputs,
    new.card_snapshot,
    new.snapshot_hash,
    -- Plain reads of fields the snapshot already carries. Nothing is derived here.
    new.card_snapshot ->> 'snapshotIntegrityHash',
    new.card_snapshot ->> 'resolvedContentHash',
    new.engine_version,
    new.builder_inputs ->> 'releaseBundleId',
    new.card_snapshot -> 'resolutionProvenance' ->> 'catalogReleaseId',
    new.updated_at,
    coalesce(auth.uid(), new.user_id)
  );

  return null;
end;
$$;

drop trigger if exists append_ip_user_preference_card_revision
  on public.ip_user_preference_cards;
create trigger append_ip_user_preference_card_revision
  after insert or update on public.ip_user_preference_cards
  for each row
  execute function public.ip_append_preference_card_revision();

-- Existing cards get one revision recording the state they are in now.
--
-- This is not their history — nothing captured it, and manufacturing one would be inventing
-- states the physician never saved. It is the honest floor: from here on every state is
-- recorded, and the state each card was in when this ran is revision 1. `created_at` is the
-- card's own `updated_at`, because that is genuinely when the card reached this state.
insert into public.ip_user_preference_card_revisions (
  card_id,
  user_id,
  revision_number,
  title,
  physician_name,
  status,
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

alter table public.ip_user_preference_card_revisions enable row level security;

-- Owner-only, and read/append only. The absent update and delete policies are the enforcement,
-- not an oversight: row-level security denies what no policy permits.
drop policy if exists ip_user_preference_card_revisions_select_own
  on public.ip_user_preference_card_revisions;
create policy ip_user_preference_card_revisions_select_own
  on public.ip_user_preference_card_revisions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists ip_user_preference_card_revisions_insert_own
  on public.ip_user_preference_card_revisions;
create policy ip_user_preference_card_revisions_insert_own
  on public.ip_user_preference_card_revisions
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

revoke all on table public.ip_user_preference_card_revisions from public, anon, authenticated;
grant select, insert on table public.ip_user_preference_card_revisions to authenticated;
-- Service role is granted the same two verbs and no more. An append-only table that one role
-- may rewrite is not append-only; it is append-only for everyone who is not holding that key.
grant select, insert on table public.ip_user_preference_card_revisions to service_role;

notify pgrst, 'reload schema';
