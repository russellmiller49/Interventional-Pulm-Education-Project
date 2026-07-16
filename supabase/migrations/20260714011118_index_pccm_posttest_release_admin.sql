create index if not exists pccm_intro_cohort_settings_released_by_idx
  on public.pccm_intro_course_cohort_settings (posttests_released_by)
  where posttests_released_by is not null;
