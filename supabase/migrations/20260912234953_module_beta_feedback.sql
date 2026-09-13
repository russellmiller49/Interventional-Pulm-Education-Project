-- Main-site feedback only. Authenticated API handlers verify users/admins before using
-- the server service role. Neither tester reports nor screenshots are publicly readable.
create table public.module_beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tester_email text not null,
  module_id text not null check (module_id in ('therapeutic-bronchoscopy', 'synchronized-anatomy', 'branch-tracing', 'live-anatomy', 'peripheral-imaging', 'bronchoscopy-foundations', 'devices', 'cardiohelp-ecmo', 'baxter-crrt', 'icu-hemodynamics', 'mechanical-ventilation', 'mechanical-circulatory-support')),
  page_path text not null check (length(page_path) between 1 and 2000 and page_path like '/%'),
  comment text not null check (length(trim(comment)) between 1 and 10000),
  selected_text text not null default '' check (length(selected_text) <= 3000),
  screenshot_path text,
  status text not null default 'new' check (status in ('new', 'in-review', 'resolved')),
  reviewer_notes text not null default '' check (length(reviewer_notes) <= 10000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index module_beta_feedback_created_idx on public.module_beta_feedback (created_at desc, id);
create index module_beta_feedback_module_status_idx on public.module_beta_feedback (module_id, status, created_at desc);
create index module_beta_feedback_user_created_idx on public.module_beta_feedback (user_id, created_at desc);
create index module_beta_feedback_reviewer_idx on public.module_beta_feedback (reviewed_by);
alter table public.module_beta_feedback enable row level security;
revoke all on public.module_beta_feedback from public, anon, authenticated;
grant select, insert, update, delete on public.module_beta_feedback to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('module-beta-feedback', 'module-beta-feedback', false, 3145728, array['image/png']);
-- Guard this bucket even if an unrelated older bucket has a broad permissive policy.
-- The server service role bypasses RLS; browser roles never access these screenshots.
create policy module_beta_feedback_server_only on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'module-beta-feedback')
  with check (bucket_id <> 'module-beta-feedback');
notify pgrst, 'reload schema';
