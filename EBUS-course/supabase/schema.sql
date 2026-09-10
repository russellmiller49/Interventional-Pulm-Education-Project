create extension if not exists pgcrypto;

create table if not exists public.learner_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  degree text,
  institution text,
  institutional_email text,
  fellowship_year text,
  flexible_bronchoscopy_count integer,
  ebus_count integer,
  ebus_confidence text,
  invite_sent_at timestamptz,
  last_sign_in_at timestamptz,
  must_set_password boolean not null default true,
  onboarding_completed_at timestamptz,
  approval_status text not null default 'pending',
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.learner_profiles
  add column if not exists full_name text,
  add column if not exists degree text,
  add column if not exists institution text,
  add column if not exists institutional_email text,
  add column if not exists fellowship_year text,
  add column if not exists flexible_bronchoscopy_count integer,
  add column if not exists ebus_count integer,
  add column if not exists ebus_confidence text,
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text;

alter table public.learner_profiles
  drop constraint if exists learner_profiles_degree_check,
  add constraint learner_profiles_degree_check check (degree is null or degree in ('MD', 'DO'));

alter table public.learner_profiles
  drop constraint if exists learner_profiles_fellowship_year_check,
  add constraint learner_profiles_fellowship_year_check check (fellowship_year is null or fellowship_year in ('first', 'second', 'third'));

alter table public.learner_profiles
  drop constraint if exists learner_profiles_counts_check,
  add constraint learner_profiles_counts_check check (
    (flexible_bronchoscopy_count is null or flexible_bronchoscopy_count >= 0)
    and (ebus_count is null or ebus_count >= 0)
  );

alter table public.learner_profiles
  drop constraint if exists learner_profiles_ebus_confidence_check,
  add constraint learner_profiles_ebus_confidence_check check (ebus_confidence is null or ebus_confidence in ('high', 'moderate', 'low'));

alter table public.learner_profiles
  drop constraint if exists learner_profiles_approval_status_check,
  add constraint learner_profiles_approval_status_check check (approval_status in ('pending', 'approved'));

update public.learner_profiles
set
  approval_status = 'approved',
  approved_at = coalesce(approved_at, onboarding_completed_at, invite_sent_at, created_at),
  approved_by = coalesce(approved_by, 'schema migration')
where approval_status = 'pending'
  and (invite_sent_at is not null or onboarding_completed_at is not null);

create table if not exists public.learner_progress_snapshots (
  learner_id uuid primary key references public.learner_profiles (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.learner_module_progress (
  learner_id uuid not null references public.learner_profiles (id) on delete cascade,
  module_id text not null,
  percent_complete integer not null default 0,
  visited_at timestamptz,
  completed_at timestamptz,
  time_spent_seconds integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (learner_id, module_id)
);

create table if not exists public.learner_module_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles (id) on delete cascade,
  module_id text not null,
  route_path text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists learner_module_sessions_learner_id_idx
on public.learner_module_sessions (learner_id);

create table if not exists public.learner_lecture_progress (
  learner_id uuid not null references public.learner_profiles (id) on delete cascade,
  lecture_id text not null,
  duration_seconds integer not null default 0,
  last_position_seconds integer not null default 0,
  watched_seconds integer not null default 0,
  viewed_percent integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  last_opened_at timestamptz,
  quiz_unlocked_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (learner_id, lecture_id)
);

alter table public.learner_lecture_progress
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists last_position_seconds integer not null default 0,
  add column if not exists viewed_percent integer not null default 0,
  add column if not exists quiz_unlocked_at timestamptz;

create table if not exists public.learner_pretest_attempts (
  learner_id uuid not null references public.learner_profiles (id) on delete cascade,
  attempt_number integer not null,
  score integer not null,
  answered_count integer not null,
  total_questions integer not null,
  percent integer not null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (learner_id, attempt_number)
);

create table if not exists public.learner_course_surveys (
  learner_id uuid not null references public.learner_profiles (id) on delete cascade,
  survey_id text not null,
  survey_version integer not null default 1,
  responses jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (learner_id, survey_id)
);

alter table public.learner_course_surveys
  add column if not exists survey_version integer not null default 1,
  add column if not exists responses jsonb not null default '{}'::jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.learner_course_surveys
  alter column submitted_at set not null,
  drop constraint if exists learner_course_surveys_survey_id_check,
  add constraint learner_course_surveys_survey_id_check check (survey_id in ('pre-course-2026', 'post-course-2026')),
  drop constraint if exists learner_course_surveys_responses_object_check,
  add constraint learner_course_surveys_responses_object_check check (jsonb_typeof(responses) = 'object');

create index if not exists learner_course_surveys_survey_id_idx
on public.learner_course_surveys (survey_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prevent_learner_approval_state_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.course_admin_approval', true), '') = 'true' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if auth.uid() = new.id and (
      new.approval_status <> 'pending'
      or new.approved_at is not null
      or new.approved_by is not null
    ) then
      raise exception 'Learners cannot set approval state.';
    end if;

    return new;
  end if;

  if auth.uid() = old.id and (
    new.approval_status is distinct from old.approval_status
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
  ) then
    raise exception 'Learners cannot update approval state.';
  end if;

  return new;
end;
$$;

create or replace function public.is_approved_learner(learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.learner_profiles
    where id = learner
      and approval_status = 'approved'
  );
$$;

create or replace function public.is_main_site_auth_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users
    where id = target_user_id
      and coalesce(raw_user_meta_data ->> 'app_scope', '') = 'main_site'
  );
$$;

revoke execute on function public.is_main_site_auth_user(uuid)
  from public, anon, authenticated;

create or replace function public.current_auth_user_is_main_site()
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and coalesce(raw_user_meta_data ->> 'app_scope', '') = 'main_site'
  );
$$;

revoke execute on function public.current_auth_user_is_main_site()
  from public, anon;
grant execute on function public.current_auth_user_is_main_site()
  to authenticated;

create or replace function public.handle_new_learner_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  flexible_count integer;
  ebus_case_count integer;
begin
  if coalesce(metadata ->> 'app_scope', '') = 'main_site' then
    return new;
  end if;

  if metadata ->> 'flexible_bronchoscopy_count' ~ '^[0-9]+$' then
    flexible_count = (metadata ->> 'flexible_bronchoscopy_count')::integer;
  end if;

  if metadata ->> 'ebus_count' ~ '^[0-9]+$' then
    ebus_case_count = (metadata ->> 'ebus_count')::integer;
  end if;

  insert into public.learner_profiles (
    id,
    email,
    full_name,
    degree,
    institution,
    institutional_email,
    fellowship_year,
    flexible_bronchoscopy_count,
    ebus_count,
    ebus_confidence,
    must_set_password,
    onboarding_completed_at
  )
  values (
    new.id,
    new.email,
    metadata ->> 'full_name',
    metadata ->> 'degree',
    metadata ->> 'institution',
    coalesce(metadata ->> 'institutional_email', new.email),
    metadata ->> 'fellowship_year',
    flexible_count,
    ebus_case_count,
    metadata ->> 'ebus_confidence',
    coalesce((metadata ->> 'must_set_password')::boolean, true),
    case
      when metadata ? 'must_set_password'
        and (metadata ->> 'must_set_password')::boolean = false
      then timezone('utc', now())
      else null
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists set_learner_profiles_updated_at on public.learner_profiles;
create trigger set_learner_profiles_updated_at
before update on public.learner_profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_learner_course_surveys_updated_at on public.learner_course_surveys;
create trigger set_learner_course_surveys_updated_at
before update on public.learner_course_surveys
for each row
execute procedure public.set_updated_at();

drop trigger if exists prevent_learner_approval_state_change on public.learner_profiles;
create trigger prevent_learner_approval_state_change
before insert or update on public.learner_profiles
for each row
execute procedure public.prevent_learner_approval_state_change();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_learner_profile();

alter table public.learner_profiles enable row level security;
alter table public.learner_progress_snapshots enable row level security;
alter table public.learner_module_progress enable row level security;
alter table public.learner_module_sessions enable row level security;
alter table public.learner_lecture_progress enable row level security;
alter table public.learner_pretest_attempts enable row level security;
alter table public.learner_course_surveys enable row level security;

drop policy if exists "Learners can view their own profile" on public.learner_profiles;
create policy "Learners can view their own profile"
on public.learner_profiles
for select
using (
  (select auth.uid()) = id
  and (
    not public.current_auth_user_is_main_site()
    or public.is_approved_learner(id)
  )
);

drop policy if exists "Learners can upsert their own profile" on public.learner_profiles;
create policy "Learners can upsert their own profile"
on public.learner_profiles
for insert
with check (
  (select auth.uid()) = id
  and (
    not public.current_auth_user_is_main_site()
    or public.is_approved_learner(id)
  )
);

drop policy if exists "Learners can update their own profile" on public.learner_profiles;
create policy "Learners can update their own profile"
on public.learner_profiles
for update
using (
  (select auth.uid()) = id
  and (
    not public.current_auth_user_is_main_site()
    or public.is_approved_learner(id)
  )
)
with check (
  (select auth.uid()) = id
  and (
    not public.current_auth_user_is_main_site()
    or public.is_approved_learner(id)
  )
);

drop policy if exists "Learners can read their own snapshots" on public.learner_progress_snapshots;
create policy "Learners can read their own snapshots"
on public.learner_progress_snapshots
for select
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can write their own snapshots" on public.learner_progress_snapshots;
create policy "Learners can write their own snapshots"
on public.learner_progress_snapshots
for insert
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can update their own snapshots" on public.learner_progress_snapshots;
create policy "Learners can update their own snapshots"
on public.learner_progress_snapshots
for update
using ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id))
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can read their own module progress" on public.learner_module_progress;
create policy "Learners can read their own module progress"
on public.learner_module_progress
for select
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can write their own module progress" on public.learner_module_progress;
create policy "Learners can write their own module progress"
on public.learner_module_progress
for insert
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can update their own module progress" on public.learner_module_progress;
create policy "Learners can update their own module progress"
on public.learner_module_progress
for update
using ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id))
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can read their own module sessions" on public.learner_module_sessions;
create policy "Learners can read their own module sessions"
on public.learner_module_sessions
for select
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can insert their own module sessions" on public.learner_module_sessions;
create policy "Learners can insert their own module sessions"
on public.learner_module_sessions
for insert
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can read their own lecture progress" on public.learner_lecture_progress;
create policy "Learners can read their own lecture progress"
on public.learner_lecture_progress
for select
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can write their own lecture progress" on public.learner_lecture_progress;
create policy "Learners can write their own lecture progress"
on public.learner_lecture_progress
for insert
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can update their own lecture progress" on public.learner_lecture_progress;
create policy "Learners can update their own lecture progress"
on public.learner_lecture_progress
for update
using ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id))
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can read their own pretest attempts" on public.learner_pretest_attempts;
create policy "Learners can read their own pretest attempts"
on public.learner_pretest_attempts
for select
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can write their own pretest attempts" on public.learner_pretest_attempts;
create policy "Learners can write their own pretest attempts"
on public.learner_pretest_attempts
for insert
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can update their own pretest attempts" on public.learner_pretest_attempts;
create policy "Learners can update their own pretest attempts"
on public.learner_pretest_attempts
for update
using ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id))
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can read their own course surveys" on public.learner_course_surveys;
create policy "Learners can read their own course surveys"
on public.learner_course_surveys
for select
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can write their own course surveys" on public.learner_course_surveys;
create policy "Learners can write their own course surveys"
on public.learner_course_surveys
for insert
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

drop policy if exists "Learners can update their own course surveys" on public.learner_course_surveys;
create policy "Learners can update their own course surveys"
on public.learner_course_surveys
for update
using ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id))
with check ((select auth.uid()) = learner_id and public.is_approved_learner(learner_id));

create or replace function public.validate_course_admin_passcode(admin_passcode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(admin_passcode, '') <> 'EBUS_2026' then
    raise exception 'Invalid admin password.' using errcode = '28000';
  end if;
end;
$$;

drop function if exists public.get_admin_learner_overview(text);

create function public.get_admin_learner_overview(admin_passcode text)
returns table (
  learner_id uuid,
  email text,
  full_name text,
  degree text,
  institution text,
  institutional_email text,
  fellowship_year text,
  flexible_bronchoscopy_count integer,
  ebus_count integer,
  ebus_confidence text,
  approval_status text,
  approved_at timestamptz,
  approved_by text,
  invite_sent_at timestamptz,
  last_sign_in_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  snapshot_updated_at timestamptz,
  pretest_percent integer,
  pretest_submitted_at timestamptz,
  pretest_answers jsonb,
  pre_course_survey_results jsonb,
  post_course_survey_results jsonb,
  assessment_results jsonb,
  total_time_spent_seconds integer,
  module_progress jsonb,
  lecture_summary jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validate_course_admin_passcode(admin_passcode);

  return query
  select
    profile.id as learner_id,
    profile.email,
    profile.full_name,
    profile.degree,
    profile.institution,
    profile.institutional_email,
    profile.fellowship_year,
    profile.flexible_bronchoscopy_count,
    profile.ebus_count,
    profile.ebus_confidence,
    profile.approval_status,
    profile.approved_at,
    profile.approved_by,
    profile.invite_sent_at,
    profile.last_sign_in_at,
    profile.onboarding_completed_at,
    profile.created_at,
    profile.updated_at,
    snapshot.updated_at as snapshot_updated_at,
    pretest_row.percent as pretest_percent,
    pretest_row.submitted_at as pretest_submitted_at,
    coalesce(pretest_row.answers, '{}'::jsonb) as pretest_answers,
    coalesce(pre_course_survey_row.survey_result, '{}'::jsonb) as pre_course_survey_results,
    coalesce(post_course_survey_row.survey_result, '{}'::jsonb) as post_course_survey_results,
    coalesce(snapshot.payload->'courseAssessmentResults', '{}'::jsonb) as assessment_results,
    coalesce(module_rows.total_time_spent_seconds, 0)::integer as total_time_spent_seconds,
    coalesce(module_rows.module_progress, '[]'::jsonb) as module_progress,
    coalesce(
      lecture_rows.lecture_summary,
      '{"completedCount": 0, "quizReadyCount": 0, "totalWatchedSeconds": 0, "averageViewedPercent": 0, "lastOpenedAt": null}'::jsonb
    ) as lecture_summary
  from public.learner_profiles as profile
  left join public.learner_progress_snapshots as snapshot
    on snapshot.learner_id = profile.id
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'moduleId', module_progress.module_id,
          'percentComplete', module_progress.percent_complete,
          'visitedAt', module_progress.visited_at,
          'completedAt', module_progress.completed_at,
          'timeSpentSeconds', module_progress.time_spent_seconds
        )
        order by module_progress.module_id
      ) as module_progress,
      coalesce(sum(module_progress.time_spent_seconds), 0)::integer as total_time_spent_seconds
    from public.learner_module_progress as module_progress
    where module_progress.learner_id = profile.id
  ) as module_rows on true
  left join lateral (
    select
      jsonb_build_object(
        'completedCount', count(*) filter (where lecture_progress.completed),
        'quizReadyCount', count(*) filter (where lecture_progress.quiz_unlocked_at is not null),
        'totalWatchedSeconds', coalesce(sum(lecture_progress.watched_seconds), 0),
        'averageViewedPercent', coalesce(round(avg(lecture_progress.viewed_percent))::integer, 0),
        'lastOpenedAt', max(lecture_progress.last_opened_at)
      ) as lecture_summary
    from public.learner_lecture_progress as lecture_progress
    where lecture_progress.learner_id = profile.id
  ) as lecture_rows on true
  left join lateral (
    select
      pretest_attempt.percent,
      pretest_attempt.submitted_at,
      pretest_attempt.answers
    from public.learner_pretest_attempts as pretest_attempt
    where pretest_attempt.learner_id = profile.id
    order by pretest_attempt.submitted_at desc
    limit 1
  ) as pretest_row on true
  left join lateral (
    select jsonb_build_object(
      'surveyId', course_survey.survey_id,
      'version', course_survey.survey_version,
      'responses', course_survey.responses,
      'submittedAt', course_survey.submitted_at,
      'updatedAt', course_survey.updated_at
    ) as survey_result
    from public.learner_course_surveys as course_survey
    where course_survey.learner_id = profile.id
      and course_survey.survey_id = 'pre-course-2026'
    limit 1
  ) as pre_course_survey_row on true
  left join lateral (
    select jsonb_build_object(
      'surveyId', course_survey.survey_id,
      'version', course_survey.survey_version,
      'responses', course_survey.responses,
      'submittedAt', course_survey.submitted_at,
      'updatedAt', course_survey.updated_at
    ) as survey_result
    from public.learner_course_surveys as course_survey
    where course_survey.learner_id = profile.id
      and course_survey.survey_id = 'post-course-2026'
    limit 1
  ) as post_course_survey_row on true
  where not (
    public.is_main_site_auth_user(profile.id)
    and profile.approval_status = 'pending'
    and profile.invite_sent_at is null
    and profile.approved_at is null
    and profile.onboarding_completed_at is null
  )
  order by
    case profile.approval_status when 'pending' then 0 else 1 end,
    profile.created_at desc;
end;
$$;

create or replace function public.approve_learner(admin_passcode text, target_learner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validate_course_admin_passcode(admin_passcode);
  perform set_config('app.course_admin_approval', 'true', true);

  update public.learner_profiles
  set
    approval_status = 'approved',
    approved_at = timezone('utc', now()),
    approved_by = 'course leadership'
  where id = target_learner_id;

  if not found then
    raise exception 'Learner profile not found.';
  end if;
end;
$$;

grant execute on function public.get_admin_learner_overview(text) to anon, authenticated;
grant execute on function public.approve_learner(text, uuid) to anon, authenticated;
