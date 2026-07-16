create table if not exists public.pccm_intro_course_cohort_settings (
  institution text primary key,
  posttests_released_at timestamp with time zone,
  posttests_released_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint pccm_intro_cohort_settings_institution_check check (
    institution = any (array['ucsd', 'loma_linda'])
  )
);

insert into public.pccm_intro_course_cohort_settings (institution)
values ('ucsd'), ('loma_linda')
on conflict (institution) do nothing;

drop trigger if exists set_pccm_intro_cohort_settings_updated_at
  on public.pccm_intro_course_cohort_settings;
create trigger set_pccm_intro_cohort_settings_updated_at
  before update on public.pccm_intro_course_cohort_settings
  for each row
  execute function public.set_site_updated_at();

alter table public.pccm_intro_course_cohort_settings enable row level security;

revoke all on table public.pccm_intro_course_cohort_settings from anon, authenticated;
grant select on table public.pccm_intro_course_cohort_settings to authenticated;
grant all on table public.pccm_intro_course_cohort_settings to service_role;

drop policy if exists pccm_intro_cohort_settings_select_enrolled
  on public.pccm_intro_course_cohort_settings;
create policy pccm_intro_cohort_settings_select_enrolled
  on public.pccm_intro_course_cohort_settings
  for select
  to authenticated
  using (
    public.current_user_has_site_admin()
    or exists (
      select 1
      from public.pccm_intro_course_enrollments enrollment
      where enrollment.user_id = (select auth.uid())
        and enrollment.status = 'active'
        and enrollment.institution = pccm_intro_course_cohort_settings.institution
    )
  );

create or replace function public.prevent_pccm_posttest_answer_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.attempt_kind = any (array['bronchoscopy_post', 'pleural_post'])
    and not (new.answers @> old.answers)
  then
    raise exception using
      errcode = '23514',
      message = 'Posttest answers cannot be changed after the first response is saved.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_pccm_posttest_answer_changes()
  from public, anon, authenticated;

drop trigger if exists prevent_pccm_posttest_answer_changes
  on public.pccm_intro_course_assessment_attempts;
create trigger prevent_pccm_posttest_answer_changes
  before update of answers on public.pccm_intro_course_assessment_attempts
  for each row
  when (old.answers is distinct from new.answers)
  execute function public.prevent_pccm_posttest_answer_changes();

notify pgrst, 'reload schema';
