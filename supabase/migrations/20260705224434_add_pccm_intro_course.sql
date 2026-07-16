alter table public.site_entitlements
  drop constraint if exists site_entitlements_entitlement_check;

alter table public.site_entitlements
  add constraint site_entitlements_entitlement_check check (
    entitlement = any (
      array[
        'socal_ebus_course',
        'ip_registry',
        'site_admin',
        'pccm_intro_course'
      ]
    )
  );

create table if not exists public.pccm_intro_course_access_codes (
  code_hash text primary key,
  institution text not null,
  active boolean not null default true,
  notes text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint pccm_intro_access_codes_institution_check check (
    institution = any (array['ucsd', 'loma_linda'])
  ),
  constraint pccm_intro_access_codes_hash_check check (code_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.pccm_intro_course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null,
  status text not null default 'active',
  access_code_hash text references public.pccm_intro_course_access_codes(code_hash) on delete set null,
  enrolled_at timestamp with time zone not null default timezone('utc', now()),
  revoked_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint pccm_intro_enrollments_institution_check check (
    institution = any (array['ucsd', 'loma_linda'])
  ),
  constraint pccm_intro_enrollments_status_check check (
    status = any (array['active', 'revoked'])
  )
);

create unique index if not exists pccm_intro_enrollments_one_active_user_idx
  on public.pccm_intro_course_enrollments (user_id)
  where status = 'active';

create index if not exists pccm_intro_enrollments_institution_idx
  on public.pccm_intro_course_enrollments (institution, enrolled_at desc);

create table if not exists public.pccm_intro_course_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.pccm_intro_course_enrollments(id) on delete cascade,
  attempt_kind text not null,
  question_order text[] not null default '{}'::text[],
  choice_order jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  score integer,
  total integer,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint pccm_intro_attempts_kind_check check (
    attempt_kind = any (
      array[
        'bronchoscopy_pre',
        'bronchoscopy_post',
        'pleural_pre',
        'pleural_post'
      ]
    )
  ),
  constraint pccm_intro_attempts_choice_order_check check (
    jsonb_typeof(choice_order) = 'object'
  ),
  constraint pccm_intro_attempts_answers_check check (
    jsonb_typeof(answers) = 'object'
  ),
  constraint pccm_intro_attempts_score_check check (
    score is null or score >= 0
  ),
  constraint pccm_intro_attempts_total_check check (
    total is null or total >= 0
  )
);

create unique index if not exists pccm_intro_attempts_one_per_kind_idx
  on public.pccm_intro_course_assessment_attempts (user_id, attempt_kind);

create index if not exists pccm_intro_attempts_enrollment_idx
  on public.pccm_intro_course_assessment_attempts (enrollment_id, updated_at desc);

create table if not exists public.pccm_intro_course_video_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  max_percent_complete integer not null default 0,
  watched_seconds integer not null default 0,
  duration_seconds integer,
  last_position_seconds integer,
  completed_at timestamp with time zone,
  last_activity_at timestamp with time zone not null default timezone('utc', now()),
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  primary key (user_id, video_id),
  constraint pccm_intro_video_id_check check (length(trim(video_id)) > 0),
  constraint pccm_intro_video_percent_check check (
    max_percent_complete >= 0 and max_percent_complete <= 100
  ),
  constraint pccm_intro_video_watched_seconds_check check (watched_seconds >= 0),
  constraint pccm_intro_video_duration_seconds_check check (
    duration_seconds is null or duration_seconds >= 0
  ),
  constraint pccm_intro_video_last_position_check check (
    last_position_seconds is null or last_position_seconds >= 0
  )
);

create index if not exists pccm_intro_video_progress_activity_idx
  on public.pccm_intro_course_video_progress (last_activity_at desc);

drop trigger if exists set_pccm_intro_access_codes_updated_at
  on public.pccm_intro_course_access_codes;
create trigger set_pccm_intro_access_codes_updated_at
  before update on public.pccm_intro_course_access_codes
  for each row
  execute function public.set_site_updated_at();

drop trigger if exists set_pccm_intro_enrollments_updated_at
  on public.pccm_intro_course_enrollments;
create trigger set_pccm_intro_enrollments_updated_at
  before update on public.pccm_intro_course_enrollments
  for each row
  execute function public.set_site_updated_at();

drop trigger if exists set_pccm_intro_attempts_updated_at
  on public.pccm_intro_course_assessment_attempts;
create trigger set_pccm_intro_attempts_updated_at
  before update on public.pccm_intro_course_assessment_attempts
  for each row
  execute function public.set_site_updated_at();

drop trigger if exists set_pccm_intro_video_progress_updated_at
  on public.pccm_intro_course_video_progress;
create trigger set_pccm_intro_video_progress_updated_at
  before update on public.pccm_intro_course_video_progress
  for each row
  execute function public.set_site_updated_at();

insert into public.pccm_intro_course_access_codes (
  code_hash,
  institution,
  notes
)
values
  (
    '06312354c8cfe54d4bd7a41219a753bb595bea243fbc3f0d647e1080ab8f3924',
    'loma_linda',
    'Initial Loma Linda PCCM intro course code hash.'
  ),
  (
    '9ac3ca2192f3a76c549ffceabdf8e9a90c3efcea34d3a7ecd9c1bc801e5aee87',
    'ucsd',
    'Initial UCSD PCCM intro course code hash.'
  )
on conflict (code_hash) do update
set
  active = true,
  institution = excluded.institution,
  notes = excluded.notes,
  updated_at = timezone('utc', now());

alter table public.pccm_intro_course_access_codes enable row level security;
alter table public.pccm_intro_course_enrollments enable row level security;
alter table public.pccm_intro_course_assessment_attempts enable row level security;
alter table public.pccm_intro_course_video_progress enable row level security;

revoke all on table public.pccm_intro_course_access_codes from anon, authenticated;
revoke all on table public.pccm_intro_course_enrollments from anon, authenticated;
revoke all on table public.pccm_intro_course_assessment_attempts from anon, authenticated;
revoke all on table public.pccm_intro_course_video_progress from anon, authenticated;

grant select on table public.pccm_intro_course_access_codes to authenticated;
grant select on table public.pccm_intro_course_enrollments to authenticated;
grant select on table public.pccm_intro_course_assessment_attempts to authenticated;
grant select on table public.pccm_intro_course_video_progress to authenticated;

grant all on table public.pccm_intro_course_access_codes to service_role;
grant all on table public.pccm_intro_course_enrollments to service_role;
grant all on table public.pccm_intro_course_assessment_attempts to service_role;
grant all on table public.pccm_intro_course_video_progress to service_role;

drop policy if exists pccm_intro_access_codes_select_site_admin
  on public.pccm_intro_course_access_codes;
create policy pccm_intro_access_codes_select_site_admin
  on public.pccm_intro_course_access_codes
  for select
  to authenticated
  using (public.current_user_has_site_admin());

drop policy if exists pccm_intro_enrollments_select_own
  on public.pccm_intro_course_enrollments;
create policy pccm_intro_enrollments_select_own
  on public.pccm_intro_course_enrollments
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists pccm_intro_enrollments_select_site_admin
  on public.pccm_intro_course_enrollments;
create policy pccm_intro_enrollments_select_site_admin
  on public.pccm_intro_course_enrollments
  for select
  to authenticated
  using (public.current_user_has_site_admin());

drop policy if exists pccm_intro_attempts_select_own
  on public.pccm_intro_course_assessment_attempts;
create policy pccm_intro_attempts_select_own
  on public.pccm_intro_course_assessment_attempts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists pccm_intro_attempts_select_site_admin
  on public.pccm_intro_course_assessment_attempts;
create policy pccm_intro_attempts_select_site_admin
  on public.pccm_intro_course_assessment_attempts
  for select
  to authenticated
  using (public.current_user_has_site_admin());

drop policy if exists pccm_intro_video_progress_select_own
  on public.pccm_intro_course_video_progress;
create policy pccm_intro_video_progress_select_own
  on public.pccm_intro_course_video_progress
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists pccm_intro_video_progress_select_site_admin
  on public.pccm_intro_course_video_progress;
create policy pccm_intro_video_progress_select_site_admin
  on public.pccm_intro_course_video_progress
  for select
  to authenticated
  using (public.current_user_has_site_admin());

notify pgrst, 'reload schema';
