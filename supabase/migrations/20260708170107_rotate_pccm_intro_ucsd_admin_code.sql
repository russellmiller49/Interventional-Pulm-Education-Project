update public.pccm_intro_course_access_codes
set
  active = false,
  notes = trim(both ' ' from concat(coalesce(notes, ''), ' Rotated after UCSD admin code exposure.')),
  updated_at = timezone('utc', now())
where
  institution = 'ucsd'
  and code_type = 'admin'
  and active = true
  and code_hash <> 'dc15ab73b86c03b9c21c3a4435cc5362190dfa24db94ca97209b0312bb60a59f';

insert into public.pccm_intro_course_access_codes (
  active,
  code_hash,
  code_type,
  institution,
  notes
)
values (
  true,
  'dc15ab73b86c03b9c21c3a4435cc5362190dfa24db94ca97209b0312bb60a59f',
  'admin',
  'ucsd',
  'Rotated UCSD PCCM intro course admin code hash.'
)
on conflict (code_hash) do update
set
  active = excluded.active,
  code_type = excluded.code_type,
  institution = excluded.institution,
  notes = excluded.notes,
  updated_at = timezone('utc', now());
