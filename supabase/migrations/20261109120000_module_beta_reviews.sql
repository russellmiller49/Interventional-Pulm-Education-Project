-- Overall module reviews from beta reviewers: one row per reviewer per module, updated when the
-- reviewer edits it. Detailed, page-level reports stay in module_beta_feedback.
--
-- Same access model as module_beta_feedback: authenticated API handlers verify the account (and
-- site_admin for reads of other people's reviews) before using the service role. Browser roles
-- have no access. Which module IDs are accepted is checked by the API against the beta catalog,
-- so adding a module needs no change here; the check below only bounds the value.
create table public.module_beta_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tester_email text not null,
  module_id text not null check (module_id ~ '^[a-z0-9-]{1,64}$'),
  track text not null check (track in ('learner', 'educator')),
  -- The reviewer's site profile when they saved: role, training level, years in practice.
  profile_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(profile_snapshot) = 'object'),
  answers jsonb not null
    check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 32768),
  form_version smallint not null check (form_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_beta_reviews_user_module_key unique (user_id, module_id)
);
create index module_beta_reviews_module_idx
  on public.module_beta_reviews (module_id, updated_at desc);
alter table public.module_beta_reviews enable row level security;
revoke all on public.module_beta_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.module_beta_reviews to service_role;
notify pgrst, 'reload schema';
