update public.pccm_intro_course_access_codes
set
  active = false,
  notes = trim(both ' ' from concat(coalesce(notes, ''), ' Rotated after UCSD learner code update.')),
  updated_at = timezone('utc', now())
where
  institution = 'ucsd'
  and code_type = 'learner'
  and active = true
  and code_hash <> '1e7da38581e8d003ff9d5d6df730d2ecfdceaa6e0f5eb702bd91e20a90a8e466';

insert into public.pccm_intro_course_access_codes (
  active,
  code_hash,
  code_type,
  institution,
  notes
)
values (
  true,
  '1e7da38581e8d003ff9d5d6df730d2ecfdceaa6e0f5eb702bd91e20a90a8e466',
  'learner',
  'ucsd',
  'Rotated UCSD PCCM intro course learner code hash.'
)
on conflict (code_hash) do update
set
  active = excluded.active,
  code_type = excluded.code_type,
  institution = excluded.institution,
  notes = excluded.notes,
  updated_at = timezone('utc', now());
