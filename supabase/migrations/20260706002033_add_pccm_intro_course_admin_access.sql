alter table public.site_entitlements
  drop constraint if exists site_entitlements_entitlement_check;

alter table public.site_entitlements
  add constraint site_entitlements_entitlement_check check (
    entitlement = any (
      array[
        'socal_ebus_course',
        'ip_registry',
        'site_admin',
        'pccm_intro_course',
        'pccm_intro_course_admin_ucsd',
        'pccm_intro_course_admin_loma_linda'
      ]
    )
  );

alter table public.pccm_intro_course_access_codes
  add column if not exists code_type text not null default 'learner';

alter table public.pccm_intro_course_access_codes
  drop constraint if exists pccm_intro_access_codes_code_type_check;

alter table public.pccm_intro_course_access_codes
  add constraint pccm_intro_access_codes_code_type_check check (
    code_type = any (array['learner', 'admin'])
  );

insert into public.pccm_intro_course_access_codes (
  active,
  code_hash,
  code_type,
  institution,
  notes
)
values
  (
    true,
    'e6a5ae3e494303b0ec676a71ed5e4f435d7166fa2c525a87d9911ceb50857ee1',
    'admin',
    'ucsd',
    'Initial UCSD PCCM intro course admin code hash.'
  ),
  (
    true,
    '393cb73d9a32929a416678cb88382fa13d76af1b2d45cfdad8b057a9906a3d4e',
    'admin',
    'loma_linda',
    'Initial Loma Linda PCCM intro course admin code hash.'
  )
on conflict (code_hash) do update
set
  active = excluded.active,
  code_type = excluded.code_type,
  institution = excluded.institution,
  notes = excluded.notes,
  updated_at = timezone('utc', now());

notify pgrst, 'reload schema';
