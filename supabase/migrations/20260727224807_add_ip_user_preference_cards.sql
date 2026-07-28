-- IP preference cards: lean per-user persistence.
--
-- Replaces the never-applied organization/site/room schema
-- (20260725210000_add_ip_preference_cards.sql, removed in the same commit). Cards here are
-- personal documents: one author, mutable, with the immutable part — what was actually
-- printed — pinned by the stored snapshot and its content hash rather than by an audit chain.
--
-- No PHI. A card names a procedure, a physician, and equipment; never a patient.

alter table public.site_entitlements
  drop constraint if exists site_entitlements_entitlement_check;

alter table public.site_entitlements
  add constraint site_entitlements_entitlement_check check (
    entitlement = any (
      array[
        'socal_ebus_course',
        'ip_registry',
        'site_admin',
        'pccm_intro_course',
        'pccm_intro_course_admin_ucsd',
        'pccm_intro_course_admin_loma_linda',
        'socrates_editor',
        'preference_cards_builder'
      ]
    )
  );

create table if not exists public.ip_user_preference_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  physician_name text,
  procedure_code text not null,
  scenario_id text not null,
  status text not null default 'draft',
  -- Everything needed to reopen the card in the wizard: modifiers, conditional states,
  -- selected item ids, catalog picks, family picks, equipment sets.
  builder_inputs jsonb not null default '{}'::jsonb,
  -- The resolved card exactly as printed. Read back through the same zod schema and
  -- checked against snapshot_hash, so a mutated row fails closed rather than rendering.
  card_snapshot jsonb not null,
  snapshot_hash text not null,
  engine_version text not null,
  catalog_import_id text not null,
  share_enabled boolean not null default false,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint ip_user_preference_cards_title_check check (
    length(trim(title)) between 1 and 160
  ),
  constraint ip_user_preference_cards_physician_name_check check (
    physician_name is null or length(trim(physician_name)) between 1 and 160
  ),
  constraint ip_user_preference_cards_procedure_code_check check (
    procedure_code ~ '^[A-Z0-9_]{1,64}$'
  ),
  constraint ip_user_preference_cards_scenario_id_check check (
    length(trim(scenario_id)) between 1 and 100
  ),
  constraint ip_user_preference_cards_status_check check (
    status = any (array['draft', 'final'])
  ),
  constraint ip_user_preference_cards_snapshot_hash_check check (
    snapshot_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint ip_user_preference_cards_card_snapshot_check check (
    jsonb_typeof(card_snapshot) = 'object'
  ),
  constraint ip_user_preference_cards_builder_inputs_check check (
    jsonb_typeof(builder_inputs) = 'object'
  ),
  constraint ip_user_preference_cards_engine_version_check check (
    length(trim(engine_version)) between 1 and 64
  ),
  constraint ip_user_preference_cards_catalog_import_id_check check (
    length(trim(catalog_import_id)) between 1 and 120
  )
);

create index if not exists ip_user_preference_cards_user_updated_idx
  on public.ip_user_preference_cards (user_id, updated_at desc);

create unique index if not exists ip_user_preference_cards_share_token_idx
  on public.ip_user_preference_cards (share_token);

drop trigger if exists set_ip_user_preference_cards_updated_at
  on public.ip_user_preference_cards;
create trigger set_ip_user_preference_cards_updated_at
  before update on public.ip_user_preference_cards
  for each row
  execute function public.set_site_updated_at();

alter table public.ip_user_preference_cards enable row level security;

drop policy if exists ip_user_preference_cards_select_own on public.ip_user_preference_cards;
create policy ip_user_preference_cards_select_own
  on public.ip_user_preference_cards
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists ip_user_preference_cards_insert_own on public.ip_user_preference_cards;
create policy ip_user_preference_cards_insert_own
  on public.ip_user_preference_cards
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists ip_user_preference_cards_update_own on public.ip_user_preference_cards;
create policy ip_user_preference_cards_update_own
  on public.ip_user_preference_cards
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ip_user_preference_cards_delete_own on public.ip_user_preference_cards;
create policy ip_user_preference_cards_delete_own
  on public.ip_user_preference_cards
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Sharing a card with a colleague. Security definer so the reader does not need a row
-- policy, but it returns only what the owner switched on, and execute is granted to
-- authenticated accounts alone — a leaked link is useless to a signed-out visitor.
create or replace function public.ip_get_shared_preference_card(token uuid)
returns table (
  id uuid,
  title text,
  physician_name text,
  procedure_code text,
  status text,
  card_snapshot jsonb,
  snapshot_hash text,
  updated_at timestamp with time zone
)
language sql
security definer
stable
set search_path = public
as $$
  select
    card.id,
    card.title,
    card.physician_name,
    card.procedure_code,
    card.status,
    card.card_snapshot,
    card.snapshot_hash,
    card.updated_at
  from public.ip_user_preference_cards as card
  where card.share_token = token
    and card.share_enabled;
$$;

revoke all on table public.ip_user_preference_cards from public, anon, authenticated;
grant select, insert, update, delete on table public.ip_user_preference_cards to authenticated;
grant all on table public.ip_user_preference_cards to service_role;

revoke execute on function public.ip_get_shared_preference_card(uuid) from public, anon;
grant execute on function public.ip_get_shared_preference_card(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
