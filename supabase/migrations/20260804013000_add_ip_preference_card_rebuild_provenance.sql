-- IP preference cards: where a rebuilt card records what it was rebuilt from.
--
-- Phase 4B.2 creates a new card from one exact immutable revision of another, on the release its
-- procedure currently points at, after a physician has confirmed every changed decision. The card
-- that comes out is an ordinary card in every respect — its own id, its own share token, its own
-- revision 1 — and that is the problem this column solves: nothing on it would otherwise say it
-- was rebuilt, from what, against which comparison, or which decisions a person actually answered.
--
-- "It was reviewed" has to be a fact a later reader can check, not a claim the interface made once.
--
-- ## Why a column on the card, and not a table
--
-- Provenance is set in the same statement that creates the card. A separate table would need a
-- second statement, and PostgREST has no transaction spanning two of them — so a crash between
-- them would leave a rebuilt card with no record of being one, which is the exact failure the
-- column exists to prevent. One column, one insert, no window.
--
-- ## Why it is not mirrored into the revision table
--
-- `card-revisions-and-reconciliation.md` says a revision is meant to be the complete row state, and
-- a card column the revisions do not record would ordinarily break that. It does not here, and the
-- reason is a guarantee rather than a convention:
--
--   * the value is immutable — the trigger below refuses any update that changes it, so it is the
--     same value at every revision the card will ever have; and
--   * revisions cannot outlive their card — `(card_id, user_id)` cascades — so there is never a
--     revision whose card is gone and whose provenance is therefore unreachable.
--
-- Reading it from the card is reading the value that was true when each revision was written. The
-- alternative was to `create or replace` the applied append trigger to copy an eighteenth column
-- into a nineteenth, which is real risk taken on the one object in this schema that must not be got
-- wrong, in exchange for a copy of a constant.
--
-- ## Why it is not revision-bearing content
--
-- `private.ip_preference_card_content_changed` is deliberately not touched. That function decides
-- two things: whether `updated_at` — the optimistic-concurrency token an open editor holds —
-- advances, and whether a revision is appended. A column that can never change cannot be the reason
-- either happens, and adding it would say it could.
--
-- No PHI, exactly as the two tables it sits beside: this records release ids, definition hashes,
-- and decision codes.

-- ---------------------------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------------------------
--
-- Nullable, because almost every card is not a rebuild and a placeholder object on the rest would
-- be a claim about how they came to exist. `jsonb` rather than a set of columns because the shape
-- is one versioned document written by one writer and read whole; `version` inside it is what a
-- later reader keys off.

alter table public.ip_user_preference_cards
  add column if not exists rebuild_provenance jsonb;

alter table public.ip_user_preference_cards
  drop constraint if exists ip_user_preference_cards_rebuild_provenance_check;
alter table public.ip_user_preference_cards
  add constraint ip_user_preference_cards_rebuild_provenance_check check (
    rebuild_provenance is null or jsonb_typeof(rebuild_provenance) = 'object'
  );

comment on column public.ip_user_preference_cards.rebuild_provenance is
  'Set once, at creation, when this card was rebuilt from another card''s immutable revision. Names the source card and revision, both releases, the hashes of the two comparisons and of the mapping plan, and one entry per reviewed decision. Null on every card that was not rebuilt. Immutable: see ip_reject_preference_card_rebuild_provenance_rewrite.';

-- ---------------------------------------------------------------------------------------------
-- 2. Write-once
-- ---------------------------------------------------------------------------------------------
--
-- The value is evidence, so it must not be editable after the fact — including by the owner, whose
-- row-level security policy otherwise lets them update any column of their own card, and including
-- by whoever holds the service-role key, which bypasses RLS entirely. A trigger is the only place
-- that holds for both.
--
-- `security invoker`, and correctly so: it calls nothing and reads nothing outside the row it was
-- handed, so it needs no privilege at all. The definer functions in this schema are definer only
-- because they reach into `private`, and making this one definer would widen a surface for nothing.
--
-- Null → a value is refused too, not only value → different value. A card that was not created by a
-- rebuild cannot be given a rebuild's provenance later; if it could, the record would describe a
-- review that never happened, which is worse than having no record.

create or replace function private.ip_reject_preference_card_rebuild_provenance_rewrite()
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

drop trigger if exists reject_ip_user_preference_card_rebuild_provenance_rewrite
  on public.ip_user_preference_cards;

create trigger reject_ip_user_preference_card_rebuild_provenance_rewrite
  before update on public.ip_user_preference_cards
  for each row
  execute function private.ip_reject_preference_card_rebuild_provenance_rewrite();

-- ---------------------------------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------------------------------
--
-- None. The column belongs to a table whose grants are already `select, insert, update, delete` to
-- `authenticated` and `all` to `service_role`, both column-wide, and adding a column does not
-- change either. What stops it being rewritten is the trigger above, not a grant — a column-level
-- revoke of `update` would also stop the owner editing the card at all under some clients, because
-- PostgREST sends the columns it was given rather than the columns that changed.

notify pgrst, 'reload schema';
