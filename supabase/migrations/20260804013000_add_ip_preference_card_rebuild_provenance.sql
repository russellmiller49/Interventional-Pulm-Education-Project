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
-- Two memberships exist once this file has run, and only one of them is the migration's doing.
--
-- The explicit `grant` below is the migration's. It is what makes `alter function ... owner to`
-- possible, because PostgreSQL requires the caller to be able to `set role` to the new owner and a
-- plain `grant <role> to <role>` carries SET. It is **temporary** and is revoked at the end of this
-- file: left in place it would let a later session as the migration role `set role` to the writer
-- and insert a provenance-bearing row directly, without the RPC's source rechecks.
--
-- The other is PostgreSQL's own and cannot be revoked. On PostgreSQL 16 and later a non-superuser
-- `createrole` role that runs `create role` is automatically granted the new role **by the bootstrap
-- superuser**, with `admin_option`. The managed migration role is exactly that — `createrole`, not
-- `rolsuper` — so `postgres` acquires a membership row the instant the statement below runs, issued
-- by a grantor it cannot act as and therefore cannot revoke or modify. The closing
-- `revoke ... from current_user` removes the migration's own SET-carrying grant and leaves that one
-- standing. This is not a deduction: a rollback rehearsal against the project ran this migration in
-- full and the verifier's then-current "no members at all" assertion failed with `postgres` still
-- listed.
--
-- What survives, exactly: one row with `admin_option = true`, `set_option = false`,
-- `inherit_option = false`. `createrole_self_grant` is unset on this project, which is what keeps
-- SET and INHERIT off it; it does not and cannot remove the ADMIN grant itself. ADMIN alone confers
-- none of the writer's privileges — it cannot read or insert as the writer, it inherits nothing, and
-- `set role ip_preference_card_rebuild_writer` fails with `42501`. The steady state is a role that
-- nobody can become and whose one SET-capable grant has been given back.
--
-- What this is not is a claim that the database defends itself from its own owner. `postgres` holds
-- ADMIN on this role and already owns the table, both guards and the validator: it can grant itself
-- a fresh membership `with set true`, or simply alter the objects. That is said out loud here for
-- the same reason the service-key boundary is said out loud at the top of this file. What the three
-- layers establish is that no *API* role can forge provenance and that no ordinary path — a
-- signed-in user through PostgREST, the service key through the table, a later update by anybody —
-- writes this column. Deliberate action by the administrative owner is outside that claim.

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
-- 5. The version-1 provenance shape, validated in one place
-- ---------------------------------------------------------------------------------------------
--
-- Four readers have to agree about this document: this function, `storedRebuildProvenanceSchema`,
-- the TypeScript writer, and the verification script. They previously agreed about a *subset* — the
-- RPC bound eight source fields and accepted any object containing them, while the application's
-- read schema required rather more. A document the database happily stored therefore failed to
-- parse on read and was turned into `null`, presenting a row that carries rebuild evidence as an
-- ordinary card. `provenance-contract.test.ts` now pins the three descriptions of this shape to
-- each other; this function is the database's half.
--
-- Strict in both directions. A missing key is rejected, so a null column and an absent claim can
-- never compare equal further down. An *unknown* key is rejected too: a document carrying something
-- this code does not model is one no reader can interpret, and ignoring the extra would let a
-- future writer smuggle claims past every reader. A genuinely different shape gets a new `version`
-- rather than a weakened version 1 — and since this migration has never been applied there is no
-- deployed card that predates any field here.

create function private.ip_validate_preference_card_rebuild_provenance_v1(document jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  -- The exact top-level key set. Checked against the TypeScript schema by a contract test.
  required_keys text[] := array[
    'version',
    'sourceCardId',
    'sourceRevisionId',
    'sourceOwnerId',
    'sourceRevisionNumber',
    'sourceReleaseBundleId',
    'sourceReleaseDefinitionHash',
    'sourceSnapshotHash',
    'sourceSnapshotIntegrityHash',
    'sourceResolvedContentHash',
    'sourcePrintDocumentHash',
    'targetReleaseBundleId',
    'targetReleaseDefinitionHash',
    'targetCatalogReleaseId',
    'operationalReconciliationHash',
    'authoredReleaseDiffHash',
    'mappingPlanHash',
    'allowedFinalStateHash',
    'decisions',
    'createdAt'
  ];
  -- Keys whose value may be JSON null. Every other key must carry a value.
  nullable_keys text[] := array[
    'sourceSnapshotIntegrityHash',
    'sourceResolvedContentHash',
    'sourcePrintDocumentHash'
  ];
  -- The exact key set of one `decisions` entry. Compared against the runtime schema by
  -- `provenance-contract.test.ts`, like the top-level list above.
  decision_keys text[] := array['key', 'kind', 'state', 'reasonCodes', 'acknowledgement'];
  uuid_keys text[] := array['sourceCardId', 'sourceRevisionId', 'sourceOwnerId'];
  hash_keys text[] := array[
    'sourceReleaseDefinitionHash',
    'sourceSnapshotHash',
    'sourceSnapshotIntegrityHash',
    'sourceResolvedContentHash',
    'sourcePrintDocumentHash',
    'targetReleaseDefinitionHash',
    'operationalReconciliationHash',
    'authoredReleaseDiffHash',
    'mappingPlanHash',
    'allowedFinalStateHash'
  ];
  text_keys text[] := array[
    'sourceReleaseBundleId',
    'targetReleaseBundleId',
    'targetCatalogReleaseId'
  ];
  present_keys text[];
  key text;
  value jsonb;
  decision jsonb;
  reason jsonb;
begin
  if document is null or jsonb_typeof(document) <> 'object' then
    raise exception 'a rebuilt card must carry a provenance object'
      using errcode = 'invalid_parameter_value';
  end if;

  select coalesce(array_agg(k order by k), array[]::text[]) into present_keys
    from jsonb_object_keys(document) as k;

  if exists (select 1 from unnest(required_keys) as k where not (k = any (present_keys))) then
    raise exception 'the provenance document is missing a required version-1 key'
      using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from unnest(present_keys) as k where not (k = any (required_keys))) then
    raise exception 'the provenance document carries a key version 1 does not define'
      using errcode = 'invalid_parameter_value';
  end if;

  if document->>'version' is distinct from 'ip-cards-rebuild/1' then
    raise exception 'unsupported rebuild provenance version: %',
      coalesce(document->>'version', '<absent>')
      using errcode = 'invalid_parameter_value';
  end if;

  -- Nullability, per key, before any type check: an explicit JSON null is a claim ("this source
  -- revision genuinely has no integrity hash") and only the three keys above may make it.
  foreach key in array required_keys loop
    value := document -> key;
    if jsonb_typeof(value) = 'null' and not (key = any (nullable_keys)) then
      raise exception 'the provenance document has a null % , which version 1 does not allow', key
        using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  -- The runtime schema's own uuid pattern, restated: version nibble 1-5 and variant 8/9/a/b, or the
  -- nil uuid. A looser pattern here would accept ids the reader then rejects, which is the exact
  -- class of divergence this validator exists to close.
  foreach key in array uuid_keys loop
    if jsonb_typeof(document -> key) <> 'string'
       or (document ->> key) !~ '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$'
    then
      raise exception 'the provenance document has a % that is not a uuid', key
        using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  foreach key in array hash_keys loop
    value := document -> key;
    if jsonb_typeof(value) = 'null' then continue; end if;
    if jsonb_typeof(value) <> 'string' or (document ->> key) !~ '^[a-f0-9]{64}$' then
      raise exception 'the provenance document has a % that is not a sha-256 digest', key
        using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  -- Already canonical, not merely trimmable.
  --
  -- `z.string().trim().min(1)` *accepts* ' x ' and parses it to 'x', so a `btrim`-based check here
  -- would agree to store bytes the reader silently rewrites. Both sides now require the value to
  -- equal its own trim, so what is stored is what is read. See `canonicalText` in
  -- `schemas/card-rebuild.ts`.
  -- Printable ASCII, no leading or trailing space, no control characters — the same expression as
  -- `CANONICAL_TEXT` in `schemas/card-rebuild.ts`, and inlined rather than factored into a helper so
  -- the writer needs `execute` on exactly one private function.
  --
  -- The alphabet is fixed rather than the whitespace rules reconciled, because they cannot be:
  -- `btrim` strips spaces where ECMAScript `trim()` strips a much larger set, and `length(text)`
  -- counts characters where JavaScript counts UTF-16 code units. Inside printable ASCII both pairs
  -- agree, so one bound means one thing on both sides.
  foreach key in array text_keys loop
    if jsonb_typeof(document -> key) <> 'string'
       or (document ->> key) !~ '^[!-~]([ -~]*[!-~])?$'
       or length(document ->> key) > 120 then
      raise exception 'the provenance document has an empty, padded, non-ASCII or overlong %', key
        using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  -- Bounded above as well as below: the runtime schema is `z.number().int().min(1)` on a JavaScript
  -- number, so anything past `Number.MAX_SAFE_INTEGER` is a value it cannot represent faithfully.
  if jsonb_typeof(document -> 'sourceRevisionNumber') <> 'number'
     or (document ->> 'sourceRevisionNumber') !~ '^[0-9]+$'
     or (document ->> 'sourceRevisionNumber')::numeric < 1
     or (document ->> 'sourceRevisionNumber')::numeric > 9007199254740991 then
    raise exception 'the provenance document has a sourceRevisionNumber that is not a safe positive integer'
      using errcode = 'invalid_parameter_value';
  end if;

  -- One spelling of one instant: `YYYY-MM-DDTHH:mm:ss.sssZ`, UTC, millisecond precision.
  --
  -- The shape is checked, then the value is *cast*, then it is re-serialized and compared to what
  -- came in. The cast is what rejects a date the calendar does not have — `2026-02-29` in a
  -- non-leap year raises `datetime_field_overflow` here, where JavaScript's `Date.parse` quietly
  -- rolls it into March. The round trip is what pins the spelling, so one instant has exactly one
  -- representation and the stored bytes are the read bytes. `new Date().toISOString()`, which is
  -- what the writer emits, is already this form.
  --
  -- The year domain is 0001-9999 on both sides, said out loud here rather than left to the cast.
  -- JavaScript's calendar has a year zero and PostgreSQL's does not, so `0000-02-29` round-tripped
  -- through `toISOString()` while `::timestamptz` refused it. SQL being stricter meant nothing
  -- unreadable could be stored, but the two sides then described different sets — and one set is
  -- the property being claimed.
  if jsonb_typeof(document -> 'createdAt') <> 'string'
     or (document ->> 'createdAt')
        !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
     or left(document ->> 'createdAt', 4) = '0000'
  then
    raise exception 'the provenance document has a createdAt that is not canonical UTC millisecond form'
      using errcode = 'invalid_parameter_value';
  end if;
  begin
    if to_char((document ->> 'createdAt')::timestamptz at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> (document ->> 'createdAt') then
      raise exception 'the provenance document has a createdAt that is not a real instant'
        using errcode = 'invalid_parameter_value';
    end if;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise exception 'the provenance document has a createdAt that is not a real instant'
        using errcode = 'invalid_parameter_value';
  end;

  -- The reviewed decisions, which are the evidence a physician answered anything at all.
  if jsonb_typeof(document -> 'decisions') <> 'array'
     or jsonb_array_length(document -> 'decisions') > 1000 then
    raise exception 'the provenance document has a decisions value that is not a bounded array'
      using errcode = 'invalid_parameter_value';
  end if;
  -- `elem`, not `value`, and the same in the nested reason-code loop below.
  --
  -- `value` is a declared PL/pgSQL variable in this function (it carries `document -> key` through
  -- the nullability and hash loops above), so an unqualified `value` in a query that also exposes a
  -- column of that name is ambiguous. PL/pgSQL's default `variable_conflict = error` raises `42702`
  -- rather than guessing, which is the right default and is not being overridden here — the alias is
  -- simply renamed to something no variable claims.
  --
  -- This survived every source review and the whole migration because PL/pgSQL compiles a statement
  -- the first time it executes, not at `create function`. The first rollback rehearsal to get this
  -- far executed the migration completely, passed Parts 1 through 4, and only then raised
  -- `column reference "value" is ambiguous` when Part 5 first validated a document's `decisions`
  -- array. Every valid version-1 document carries that array, so this was on the path of every real
  -- reviewed rebuild, not just the verifier's.
  for decision in select elem from jsonb_array_elements(document -> 'decisions') as t(elem) loop
    if jsonb_typeof(decision) <> 'object' then
      raise exception 'a provenance decision entry is not an object'
        using errcode = 'invalid_parameter_value';
    end if;
    -- The **exact** key set, not a count plus five name lookups.
    --
    -- Counting to five and then reading the five expected names looked equivalent and was not:
    -- swap `acknowledgement` for an invented key and the count still passes, while
    -- `jsonb_typeof(decision -> 'acknowledgement')` on an absent key yields SQL NULL — so
    -- `NULL not in ('string','null')` is NULL, the whole `if` condition is NULL rather than true,
    -- and PL/pgSQL does not raise. A document with a fabricated claim and a missing required one
    -- was therefore stored, and then rejected by the application on every read.
    if exists (
      select 1 from unnest(decision_keys) as k where not (decision ? k)
    ) or exists (
      select 1 from jsonb_object_keys(decision) as k where not (k = any (decision_keys))
    ) then
      raise exception 'a provenance decision entry does not carry exactly the version-1 keys'
        using errcode = 'invalid_parameter_value';
    end if;
    if jsonb_typeof(decision -> 'key') <> 'string'
       or jsonb_typeof(decision -> 'kind') <> 'string'
       or jsonb_typeof(decision -> 'state') <> 'string'
       or jsonb_typeof(decision -> 'reasonCodes') <> 'array'
       or jsonb_typeof(decision -> 'acknowledgement') not in ('string', 'null')
    then
      raise exception 'a provenance decision entry does not match the version-1 shape'
        using errcode = 'invalid_parameter_value';
    end if;
    -- Bounds, matching the runtime schema field for field. An empty `acknowledgement` is the one
    -- worth naming: it is a *claim* that an answer was recorded, spelled as no answer at all.
    if (decision ->> 'key') !~ '^[!-~]([ -~]*[!-~])?$' or length(decision ->> 'key') > 200
       or (decision ->> 'kind') !~ '^[!-~]([ -~]*[!-~])?$' or length(decision ->> 'kind') > 40
       or (decision ->> 'state') !~ '^[!-~]([ -~]*[!-~])?$' or length(decision ->> 'state') > 60
       or (jsonb_typeof(decision -> 'acknowledgement') = 'string'
           and ((decision ->> 'acknowledgement') !~ '^[!-~]([ -~]*[!-~])?$'
                or length(decision ->> 'acknowledgement') > 40))
       or jsonb_array_length(decision -> 'reasonCodes') > 40
    then
      raise exception 'a provenance decision entry has an empty, padded, non-ASCII or overlong field'
        using errcode = 'invalid_parameter_value';
    end if;
    -- The second instance of the same collision, and the reason this fix is two lines rather than
    -- one: the rehearsal aborted at the loop above, so this one had never been reached and would
    -- have raised the identical `42702` on the very next run.
    for reason in
      select elem from jsonb_array_elements(decision -> 'reasonCodes') as t(elem)
    loop
      if jsonb_typeof(reason) <> 'string'
         or (reason #>> '{}') !~ '^[!-~]([ -~]*[!-~])?$'
         or length(reason #>> '{}') > 80 then
        raise exception 'a provenance decision reason code is not a bounded, canonical string'
          using errcode = 'invalid_parameter_value';
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function private.ip_validate_preference_card_rebuild_provenance_v1(jsonb) from public;
revoke all on function private.ip_validate_preference_card_rebuild_provenance_v1(jsonb)
  from anon, authenticated, service_role;

-- ...and granted to exactly one role: the one that owns the function that calls it.
--
-- Without these two grants the whole writer path is dead on arrival. The RPC below is
-- `security definer` and owned by `ip_preference_card_rebuild_writer`, so inside it `current_user`
-- is that role — not `service_role`, and not the migration role. The already-deployed revision
-- migration revoked all access to schema `private` from PUBLIC and the API roles, and this file
-- grants the writer `usage` on `public` only. A role that cannot resolve a schema cannot call a
-- function in it, so the very first statement of the RPC would raise `42501` and *every* real
-- rebuild write would fail — after the review, at the last step, with a privilege error.
--
-- Two grants, no more. The alternative fixes are both worse: moving the validator to `public` would
-- put a shape-checking helper on the API surface, and making it `security definer` would give it an
-- owner and a privilege context it has no use for — it reads one argument and touches nothing.
-- `security invoker` with an explicit grant says exactly who may call it and why.
grant usage on schema private to ip_preference_card_rebuild_writer;

grant execute on function private.ip_validate_preference_card_rebuild_provenance_v1(jsonb)
  to ip_preference_card_rebuild_writer;

-- ---------------------------------------------------------------------------------------------
-- 6. The one trusted writer
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
  -- One validator, and it is the same shape the application reads back. Previously this was a
  -- handful of inline checks over eight source fields, which meant the database accepted documents
  -- `storedRebuildProvenanceSchema` then refused — and a refused read became `null`, presenting a
  -- row that carries rebuild evidence as a card that was never rebuilt.
  perform private.ip_validate_preference_card_rebuild_provenance_v1(p_rebuild_provenance);

  -- The document has to describe the source the parameters are checked against. Without this the
  -- recheck below proves something about the *arguments* and nothing about the evidence that
  -- actually gets stored and read back: a caller could pass one real tuple to satisfy the join and
  -- embed an entirely different, fabricated source in the provenance.
  --
  -- `sourceOwnerId` is here for the same reason the others are. Until it existed the document could
  -- not name an owner at all, so "the owner is bound to the stored evidence" was true of the call
  -- and false of the record it left behind. It is compared to the scalar argument here and to both
  -- source rows' `user_id` in the join below.
  if p_rebuild_provenance->>'sourceCardId' is distinct from p_source_card_id::text
     or p_rebuild_provenance->>'sourceRevisionId' is distinct from p_source_revision_id::text
     or p_rebuild_provenance->>'sourceOwnerId' is distinct from p_owner_id::text
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
    and revision.user_id::text = p_rebuild_provenance->>'sourceOwnerId'
    and source.user_id::text = p_rebuild_provenance->>'sourceOwnerId'
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

-- The membership granted at the top existed for one statement — `alter function ... owner to`
-- requires the caller to be able to `set role` to the new owner — and it is given back here.
--
-- This revoke removes the migration's own grant, which is the one that carried SET. It does not, and
-- cannot, remove the membership PostgreSQL created on its own behalf when the role was created: that
-- grant was issued by the bootstrap superuser, which the migration role cannot act as. The note
-- above `create role` says what is left and why it is not a way in. So the honest statement of the
-- steady state is not "no member of the writer role exists" but "the only membership left is
-- ADMIN-only, and the SET-capable one is gone".
--
-- That distinction is the whole value of this statement. Left behind, the SET-carrying grant would
-- have kept the boundary open at exactly the level the design is about: a later session as the
-- managed migration role could `set role ip_preference_card_rebuild_writer` and then satisfy both
-- the writer-only insert guard and the writer's own RLS policy with a direct `insert`, bypassing
-- every source recheck the RPC performs. With it revoked, `set role` fails with `42501`, no
-- privilege of the writer's is inherited, and the residual ADMIN membership confers nothing by
-- itself — it only means the owner could deliberately grant itself more, which it could do anyway.
--
-- Ownership survives the revoke. Ownership is recorded on the function; membership is only what was
-- needed to *assign* it, and `security definer` execution runs as the owner regardless of who is
-- a member of what.
revoke ip_preference_card_rebuild_writer from current_user;

notify pgrst, 'reload schema';
