-- IP preference cards: covering indexes for the revision table's two foreign keys.
--
-- A forward migration, not an edit. `20260803052432_add_ip_preference_card_revisions.sql` has been
-- applied — remotely as `20260803113527_add_ip_preference_card_revisions` — and its verifier passed
-- against the live database. It is history now, and history is appended to rather than rewritten:
-- editing it to add these indexes would leave the file describing a state no environment ever
-- passed through, and would make the record of what was actually verified untrue.
--
-- ## Why these two, and why now
--
-- The revision table introduced two foreign keys and neither had a leading-column index. Postgres
-- does not create one for a referencing side automatically — only for the referenced side's unique
-- constraint — so the Supabase performance advisor reported both, taking its INFO count from 96 to
-- 98 with WARN unchanged at 51. These are the only two findings the revision work added.
--
-- The cost of leaving them is not query latency at today's row count; it is the referential
-- maintenance path. Every `delete from auth.users` and every `delete from ip_user_preference_cards`
-- must prove no revision still references the row, and without an index that proof is a sequential
-- scan of the whole revision table taken while the referencing rows are locked. A table that only
-- ever grows — one row per saved card state, never updated, never pruned — is exactly the shape
-- where that degrades quietly and is noticed late.
--
-- Ordinary `create index`, not `create index concurrently`: Supabase applies migrations inside a
-- transaction and `concurrently` cannot run in one. The table holds a single backfilled row, so the
-- brief lock is irrelevant. Should this ever need re-running against a large table, build the
-- indexes concurrently outside a migration instead of relaxing the transaction here.
--
-- No `if not exists`, deliberately. These names are new. If one is already taken, the existing
-- object is an index nobody in this history created, and its definition is unknown — failing is the
-- correct outcome, where `if not exists` would silently adopt it and report success.

-- The direct `user_id -> auth.users(id)` reference, and the busiest read path.
--
-- Three things use it. The foreign key's own maintenance, when a user is deleted and every
-- referencing revision has to be found. The `on delete cascade` that then removes them. And
-- `ip_user_preference_card_revisions_select_own`, whose `using (user_id = auth.uid())` filters
-- every owner-scoped read — the policy is applied to every select a client makes against this
-- table, so this is the one index that earns its keep on reads as well as on maintenance.
create index ip_user_preference_card_revisions_user_id_idx
  on public.ip_user_preference_card_revisions (user_id);

-- The composite `(card_id, user_id) -> ip_user_preference_cards (id, user_id)` reference, which
-- enforces that a revision's owner is its card's owner.
--
-- The column order matches the constraint's exactly, which is what makes this a covering index for
-- it rather than merely a useful one.
--
-- It is written out even though two existing indexes already lead with `card_id` — the
-- `(card_id, revision_number)` unique index and the `(card_id, created_at desc)` history index.
-- Neither covers this constraint: a leading-column match lets the planner use an index, but the
-- referential-integrity check is on the full `(card_id, user_id)` pair, and satisfying it through
-- either of those means scanning every revision of the card and then rechecking `user_id` on each.
-- Correct, and not what the constraint asked for. Being explicit costs one small index on a table
-- with a single row and removes the need for anyone to re-derive that reasoning later.
create index ip_user_preference_card_revisions_card_owner_idx
  on public.ip_user_preference_card_revisions (card_id, user_id);

-- Nothing is dropped or altered. Named explicitly so a reader knows exactly what is being left
-- alone, and so the source-level contract test can assert these appear only as commentary and
-- never as the object of a statement:
--
--   * ip_user_preference_card_revisions_pkey               — the primary key
--   * ip_user_preference_card_revisions_card_number_idx    — unique (card_id, revision_number)
--   * ip_user_preference_card_revisions_card_created_idx   — (card_id, created_at desc)
--
-- Both foreign-key constraints stand exactly as published too. This migration only adds.

notify pgrst, 'reload schema';
