-- IP preference cards: authentic, server-only rebuild provenance.
--
-- Phase 4B.2 creates a new card from one exact immutable revision of another, after a physician has
-- confirmed every changed decision. `rebuild_provenance` is the record of that review, and its value
-- rests on it not being writable by any API role — not by a signed-in user through PostgREST, not by
-- the service role through the table, and not by a later update from anybody.
--
-- What it is *not* is proof against a compromised service-role key. That key can execute the writer
-- function below, and the function takes the owner as a parameter, so whoever holds it can create a
-- provenance-bearing card for a user who never asked for one. That is the accepted trust boundary
-- for this design and is stated here rather than implied away: the key is the boundary, and the
-- function narrows what can be done with it rather than removing it.
--
-- An earlier draft of this migration added the column plus a `before update` write-once trigger and
-- claimed exactly that. It was wrong, and an independent review found it: `authenticated` holds
-- INSERT on this table and the live insert policy checks only `user_id = auth.uid()`, so a signed-in
-- user could POST straight to PostgREST with an arbitrary JSON object in `rebuild_provenance`. The
-- update trigger would then have frozen the forgery, giving user-authored data the exact appearance
-- of immutable reviewed evidence. Immutability is not authenticity. This file establishes both.
--
-- ## The trust boundary, in three layers
--
--  1. **Row-level security.** The `authenticated` insert policy is replaced so an ordinary caller may
--     insert only rows whose `rebuild_provenance` is null. Ordinary card creation is unaffected.
--  2. **A trigger that does not care about RLS.** `before insert` rejects a non-null provenance from
--     any role except the one dedicated writer below, so a direct `service_role` insert — which
--     bypasses RLS entirely — is refused too. Possessing the service key is not evidence that a
--     review happened.
--  3. **One narrow writer.** `public.ip_create_rebuilt_preference_card` is `security definer`, owned
--     by a `nologin` role that exists for nothing else, executable only by `service_role`, and is not
--     a general card-insert endpoint: it always writes a draft, never accepts a share token, and
--     re-derives every source fact from the database before it writes anything.
--
-- The application keeps the split that makes this worth having: every owner-scoped read — source
-- card, source revision, current release, plan reconstruction, review validation — stays on the
-- authenticated cookie client, and privileged authority is used for the final insert and nothing
-- else. See `src/features/preference-cards/server/rebuild-writer.server.ts`.
--
-- ## Strict first-use DDL
--
-- This migration has never been applied. Every statement is written to fail if the object it creates
-- already exists — no `if not exists`, no `or replace`, no `drop ... if exists` on anything this file
-- owns. Unexpected drift is a thing to discover loudly at the point of application, and a failed
-- migration in a transaction rolls back cleanly, so retry tolerance buys nothing here.
--
-- The two statements that *do* drop are the live insert policy, which this file deliberately
-- replaces, and they name it exactly.
--
-- No PHI: this records release ids, definition hashes, decision codes, and row identifiers.

-- ---------------------------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------------------------
--
-- Nullable, no default. Almost no card is a rebuild, and a placeholder on the rest would be a claim
-- about how they came to exist. Existing rows therefore read null and nothing is backfilled.

alter table public.ip_user_preference_cards
  add column rebuild_provenance jsonb;

alter table public.ip_user_preference_cards
  add constraint ip_user_preference_cards_rebuild_provenance_check check (
    rebuild_provenance is null or jsonb_typeof(rebuild_provenance) = 'object'
  );

comment on column public.ip_user_preference_cards.rebuild_provenance is
  'Set once, by public.ip_create_rebuilt_preference_card only, when this card was rebuilt from another card''s immutable revision. Names the source card and revision, both releases, the hashes of the comparisons and of the mapping plan, and one entry per reviewed decision. Null on every card that was not rebuilt, and unwritable by any API role.';

-- ---------------------------------------------------------------------------------------------
-- 2. The dedicated writer role
-- ---------------------------------------------------------------------------------------------
--
-- `nologin`, so nobody authenticates as it, and no `bypassrls` — it is given exactly the policies it
-- needs below and nothing more. Its only purpose is to own one function, which is what makes
-- "written by the reviewed rebuild" a checkable fact rather than "written by somebody with a key".
--
-- Granted to the migration role so the function's ownership can be assigned; that is a prerequisite
-- of `alter function ... owner to`, not a widening of the boundary, since the migration role already
-- owns the table.

create role ip_preference_card_rebuild_writer nologin;

grant ip_preference_card_rebuild_writer to current_user;

grant usage on schema public to ip_preference_card_rebuild_writer;
grant select, insert on table public.ip_user_preference_cards to ip_preference_card_rebuild_writer;
grant select on table public.ip_user_preference_card_revisions to ip_preference_card_rebuild_writer;

-- The writer is subject to row-level security like any other non-owner role, so it needs explicit
-- policies. They are the narrowest that let it do its one job: read any owner's source rows in order
-- to re-verify them, and insert only rows that carry provenance.

create policy ip_user_preference_cards_select_rebuild_writer
  on public.ip_user_preference_cards
  for select
  to ip_preference_card_rebuild_writer
  using (true);

create policy ip_user_preference_cards_insert_rebuild_writer
  on public.ip_user_preference_cards
  for insert
  to ip_preference_card_rebuild_writer
  with check (rebuild_provenance is not null);

create policy ip_user_preference_card_revisions_select_rebuild_writer
  on public.ip_user_preference_card_revisions
  for select
  to ip_preference_card_rebuild_writer
  using (true);

-- ---------------------------------------------------------------------------------------------
-- 3. The authenticated insert policy, narrowed
-- ---------------------------------------------------------------------------------------------
--
-- The live policy checked ownership and nothing else. It is replaced, not amended, because a second
-- permissive policy would be OR-ed with the first and change nothing.
--
-- Ordinary card creation is unaffected: `saveUserCard` never names this column, so it inserts null.

drop policy ip_user_preference_cards_insert_own on public.ip_user_preference_cards;

create policy ip_user_preference_cards_insert_own
  on public.ip_user_preference_cards
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and rebuild_provenance is null);

-- ---------------------------------------------------------------------------------------------
-- 4. Insert-time and update-time guards
-- ---------------------------------------------------------------------------------------------
--
-- The insert guard is what makes the boundary hold for roles RLS does not constrain. `service_role`
-- has `bypassrls`, so no policy can stop it inserting a forged object; this trigger can, and does.
--
-- `security invoker` for both: they call nothing and read nothing outside the row they were handed,
-- so they need no privilege at all. `current_user` inside a `security definer` function is its
-- owner, which is exactly how the trusted path identifies itself here — and a role nobody can log in
-- as or `set role` to without being granted membership.

create function private.ip_reject_untrusted_preference_card_rebuild_provenance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.rebuild_provenance is not null
     and current_user <> 'ip_preference_card_rebuild_writer' then
    raise exception
      'rebuild_provenance may only be written by public.ip_create_rebuilt_preference_card'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.ip_reject_untrusted_preference_card_rebuild_provenance() from public;
revoke all on function private.ip_reject_untrusted_preference_card_rebuild_provenance()
  from anon, authenticated, service_role;

create trigger reject_untrusted_ip_user_preference_card_rebuild_provenance
  before insert on public.ip_user_preference_cards
  for each row
  execute function private.ip_reject_untrusted_preference_card_rebuild_provenance();

-- Write-once. Null to a value is refused as well as value to value and value to null: a card that
-- was not created by a rebuild cannot be given a rebuild's provenance later, because that would
-- describe a review that never happened.

create function private.ip_reject_preference_card_rebuild_provenance_rewrite()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.rebuild_provenance is distinct from old.rebuild_provenance then
    raise exception
      'ip_user_preference_cards.rebuild_provenance is write-once and cannot be changed after the card is created'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.ip_reject_preference_card_rebuild_provenance_rewrite() from public;
revoke all on function private.ip_reject_preference_card_rebuild_provenance_rewrite()
  from anon, authenticated, service_role;

create trigger reject_ip_user_preference_card_rebuild_provenance_rewrite
  before update on public.ip_user_preference_cards
  for each row
  execute function private.ip_reject_preference_card_rebuild_provenance_rewrite();

-- ---------------------------------------------------------------------------------------------
-- 5. The one trusted writer
-- ---------------------------------------------------------------------------------------------
--
-- Not a generic card-insert RPC. It writes one draft, from one named source revision, and re-derives
-- from the database every source fact it can rather than trusting the payload for it.
--
-- The card content itself — resolved snapshot, builder inputs, decision list — is computed by the
-- TypeScript planner and resolver and cannot be recomputed in SQL, so it is trusted as given.
--
-- Every source fact the database *knows* is bound to the document that gets stored, not merely to the
-- call's own arguments: card id, revision id, owner, snapshot hash, release bundle, revision number,
-- snapshot integrity hash and resolved content hash all have to agree with the revision row. A
-- payload describing a revision that has changed or vanished writes nothing, and one whose document
-- disagrees with its own arguments writes nothing either.
--
-- One field is deliberately **not** database-authenticated and is documented as such rather than
-- implied to be: `sourcePrintDocumentHash` is derived in TypeScript from the integrity hash and the
-- four printed columns, and is not stored on the revision. Its *inputs* are bound above; the digest
-- itself is an application claim. Re-deriving it here would mean a second canonical-JSON SHA-256
-- implementation inside PL/pgSQL, which is exactly the kind of second answer this module avoids.
--
-- The recheck and the insert are one statement, which removes the application-level gap between
-- "the source was verified" and "the row was written". It does not take a row lock, so under READ
-- COMMITTED a delete committing between this statement's snapshot and its commit can still leave a
-- card citing a revision that has cascaded away.
--
-- That residue is deliberate rather than overlooked, because it lands in a state the design already
-- allows: deleting a source *after* a completed rebuild is permitted and leaves exactly the same
-- hash-addressed tombstone. Closing it with `for key share` would also require giving the writer role
-- an UPDATE policy purely so it may lock, which widens the role for a window whose only outcome is a
-- state the product accepts. See reviewed-rebuild.md.
--
-- Id, share token, share state and timestamps are all left to column defaults, so the new card gets
-- its own identity with sharing off and cannot inherit the source's. Status is always 'draft'.

create function public.ip_create_rebuilt_preference_card(
  p_owner_id uuid,
  p_source_card_id uuid,
  p_source_revision_id uuid,
  p_source_snapshot_hash text,
  p_source_release_bundle_id text,
  p_title text,
  p_physician_name text,
  p_procedure_code text,
  p_scenario_id text,
  p_builder_inputs jsonb,
  p_card_snapshot jsonb,
  p_snapshot_hash text,
  p_engine_version text,
  p_catalog_import_id text,
  p_rebuild_provenance jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
begin
  if p_rebuild_provenance is null or jsonb_typeof(p_rebuild_provenance) <> 'object' then
    raise exception 'a rebuilt card must carry a provenance object'
      using errcode = 'invalid_parameter_value';
  end if;

  -- One known shape, named exactly. A document at some other version would be read back by code
  -- that expects this one, so accepting it would store evidence nothing can interpret.
  if p_rebuild_provenance->>'version' is distinct from 'ip-cards-rebuild/1' then
    raise exception 'unsupported rebuild provenance version: %',
      coalesce(p_rebuild_provenance->>'version', '<absent>')
      using errcode = 'invalid_parameter_value';
  end if;

  -- Every source field this function binds has to be present and a string. Without this a missing
  -- key compares null-to-null through `is not distinct from` further down and passes as agreement.
  if jsonb_typeof(p_rebuild_provenance->'sourceCardId') <> 'string'
     or jsonb_typeof(p_rebuild_provenance->'sourceRevisionId') <> 'string'
     or jsonb_typeof(p_rebuild_provenance->'sourceSnapshotHash') <> 'string'
     or jsonb_typeof(p_rebuild_provenance->'sourceReleaseBundleId') <> 'string'
     or jsonb_typeof(p_rebuild_provenance->'sourceRevisionNumber') <> 'number'
     -- Nullable on the revision, so JSON null is legal and an *absent* key is not: absent would
     -- compare null-to-null against a null column and be read as agreement about a fact the
     -- document never made.
     or coalesce(jsonb_typeof(p_rebuild_provenance->'sourceSnapshotIntegrityHash'), '<absent>')
        not in ('string', 'null')
     or coalesce(jsonb_typeof(p_rebuild_provenance->'sourceResolvedContentHash'), '<absent>')
        not in ('string', 'null')
  then
    raise exception 'the provenance document is missing a source field or has it at the wrong type'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The document has to describe the source the parameters are checked against. Without this the
  -- recheck below proves something about the *arguments* and nothing about the evidence that
  -- actually gets stored and read back: a caller could pass one real tuple to satisfy the join and
  -- embed an entirely different, fabricated source in the provenance.
  if p_rebuild_provenance->>'sourceCardId' is distinct from p_source_card_id::text
     or p_rebuild_provenance->>'sourceRevisionId' is distinct from p_source_revision_id::text
     or p_rebuild_provenance->>'sourceSnapshotHash' is distinct from p_source_snapshot_hash
     or p_rebuild_provenance->>'sourceReleaseBundleId' is distinct from p_source_release_bundle_id
  then
    raise exception 'the provenance document does not describe the source it was checked against'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.ip_user_preference_cards (
    user_id, title, physician_name, procedure_code, scenario_id, status,
    builder_inputs, card_snapshot, snapshot_hash, engine_version, catalog_import_id,
    rebuild_provenance
  )
  select
    p_owner_id, p_title, p_physician_name, p_procedure_code, p_scenario_id, 'draft',
    p_builder_inputs, p_card_snapshot, p_snapshot_hash, p_engine_version, p_catalog_import_id,
    p_rebuild_provenance
  from public.ip_user_preference_card_revisions as revision
  join public.ip_user_preference_cards as source
    on source.id = revision.card_id
   and source.user_id = revision.user_id
  where revision.id = p_source_revision_id
    and revision.card_id = p_source_card_id
    and revision.user_id = p_owner_id
    and revision.snapshot_hash = p_source_snapshot_hash
    and revision.release_bundle_id is not distinct from p_source_release_bundle_id
    -- Every remaining source fact the revision row *knows*, bound to what the stored document
    -- claims. Checking only the parallel arguments authenticated the call and not the evidence: a
    -- caller could pass one real tuple to satisfy the join and still freeze a fabricated revision
    -- number, release, integrity hash or content hash into a write-once column.
    and revision.revision_number::text
        is not distinct from p_rebuild_provenance->>'sourceRevisionNumber'
    and revision.snapshot_integrity_hash
        is not distinct from p_rebuild_provenance->>'sourceSnapshotIntegrityHash'
    and revision.resolved_content_hash
        is not distinct from p_rebuild_provenance->>'sourceResolvedContentHash'
  returning id into created_id;

  if created_id is null then
    raise exception
      'the source card or revision named by this rebuild no longer matches the database'
      using errcode = 'no_data_found';
  end if;

  return created_id;
end;
$$;

-- `alter function ... owner to` requires two things of the caller: membership of the new owner role,
-- which the grant above supplies, and that the **new owner** holds `create` on the function's schema.
-- The superuser exception does not apply here — the managed migration role is `createrole` but not
-- `rolsuper` — and `public`'s ACL grants the API roles `usage` only, so without this the statement
-- fails and the whole transaction rolls back with nothing installed.
--
-- Granted for exactly one statement and revoked immediately. The writer must not keep authority to
-- create objects in `public`; it exists to own one function, not to be a schema owner.
grant create on schema public to ip_preference_card_rebuild_writer;

alter function public.ip_create_rebuilt_preference_card(
  uuid, uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, text, jsonb
) owner to ip_preference_card_rebuild_writer;

revoke create on schema public from ip_preference_card_rebuild_writer;

revoke all on function public.ip_create_rebuilt_preference_card(
  uuid, uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.ip_create_rebuilt_preference_card(
  uuid, uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, text, jsonb
) to service_role;

notify pgrst, 'reload schema';
