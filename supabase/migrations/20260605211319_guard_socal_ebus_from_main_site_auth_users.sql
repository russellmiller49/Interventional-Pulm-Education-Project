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

create or replace function public.get_admin_learner_overview(admin_passcode text)
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

delete from public.learner_profiles as profile
where public.is_main_site_auth_user(profile.id)
  and profile.approval_status = 'pending'
  and profile.invite_sent_at is null
  and profile.approved_at is null
  and profile.onboarding_completed_at is null
  and not exists (
    select 1
    from public.learner_progress_snapshots as snapshot
    where snapshot.learner_id = profile.id
  )
  and not exists (
    select 1
    from public.learner_module_progress as module_progress
    where module_progress.learner_id = profile.id
  )
  and not exists (
    select 1
    from public.learner_module_sessions as module_session
    where module_session.learner_id = profile.id
  )
  and not exists (
    select 1
    from public.learner_lecture_progress as lecture_progress
    where lecture_progress.learner_id = profile.id
  )
  and not exists (
    select 1
    from public.learner_pretest_attempts as pretest_attempt
    where pretest_attempt.learner_id = profile.id
  )
  and not exists (
    select 1
    from public.learner_course_surveys as course_survey
    where course_survey.learner_id = profile.id
  );
