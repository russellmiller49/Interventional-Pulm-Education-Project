create index if not exists pccm_intro_enrollments_access_code_hash_idx
  on public.pccm_intro_course_enrollments (access_code_hash);
