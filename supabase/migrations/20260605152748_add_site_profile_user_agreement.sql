alter table public.site_profiles
  add column if not exists agreement_accepted_at timestamp with time zone,
  add column if not exists agreement_version text,
  add column if not exists performance_research_consent boolean not null default false;

create or replace function public.handle_new_site_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_scope text := coalesce(metadata ->> 'app_scope', '');
  profile_interests text[] := '{}'::text[];
  profile_learning_goals text[] := '{}'::text[];
  profile_agreement_accepted_at timestamp with time zone;
  profile_agreement_version text := nullif(trim(coalesce(metadata ->> 'agreement_version', '')), '');
  profile_performance_research_consent boolean :=
    lower(coalesce(metadata ->> 'performance_research_consent', 'false'))
      = any (array['true', '1', 'yes', 'on']);
  profile_ready boolean;
begin
  if profile_scope <> 'main_site' then
    return new;
  end if;

  begin
    profile_agreement_accepted_at :=
      nullif(trim(coalesce(metadata ->> 'agreement_accepted_at', '')), '')::timestamptz;
  exception
    when others then
      profile_agreement_accepted_at := null;
  end;

  if jsonb_typeof(metadata -> 'interests') = 'array' then
    select coalesce(array_agg(value), '{}'::text[])
    into profile_interests
    from jsonb_array_elements_text(metadata -> 'interests') as value;
  end if;

  if jsonb_typeof(metadata -> 'learning_goals') = 'array' then
    select coalesce(array_agg(value), '{}'::text[])
    into profile_learning_goals
    from jsonb_array_elements_text(metadata -> 'learning_goals') as value;
  end if;

  profile_ready :=
    nullif(trim(coalesce(metadata ->> 'first_name', '')), '') is not null
    and nullif(trim(coalesce(metadata ->> 'last_name', '')), '') is not null
    and nullif(trim(coalesce(metadata ->> 'professional_role', '')), '') is not null
    and nullif(trim(coalesce(metadata ->> 'institution_type', '')), '') is not null
    and nullif(trim(coalesce(metadata ->> 'institution', '')), '') is not null
    and nullif(trim(coalesce(metadata ->> 'country', '')), '') is not null
    and nullif(trim(coalesce(metadata ->> 'years_in_practice', '')), '') is not null
    and profile_agreement_accepted_at is not null
    and profile_agreement_version is not null
    and profile_performance_research_consent;

  if not profile_ready then
    return new;
  end if;

  insert into public.site_profiles (
    id,
    email,
    first_name,
    last_name,
    professional_role,
    resident_specialty,
    role_other,
    institution_type,
    institution,
    country,
    training_level,
    years_in_practice,
    interests,
    learning_goals,
    agreement_accepted_at,
    agreement_version,
    performance_research_consent,
    onboarding_completed_at
  )
  values (
    new.id,
    lower(coalesce(new.email, metadata ->> 'email', '')),
    nullif(trim(coalesce(metadata ->> 'first_name', '')), ''),
    nullif(trim(coalesce(metadata ->> 'last_name', '')), ''),
    nullif(trim(coalesce(metadata ->> 'professional_role', '')), ''),
    nullif(trim(coalesce(metadata ->> 'resident_specialty', '')), ''),
    nullif(trim(coalesce(metadata ->> 'role_other', '')), ''),
    nullif(trim(coalesce(metadata ->> 'institution_type', '')), ''),
    nullif(trim(coalesce(metadata ->> 'institution', '')), ''),
    nullif(trim(coalesce(metadata ->> 'country', '')), ''),
    nullif(trim(coalesce(metadata ->> 'training_level', '')), ''),
    nullif(trim(coalesce(metadata ->> 'years_in_practice', '')), ''),
    profile_interests,
    profile_learning_goals,
    profile_agreement_accepted_at,
    profile_agreement_version,
    profile_performance_research_consent,
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    professional_role = excluded.professional_role,
    resident_specialty = excluded.resident_specialty,
    role_other = excluded.role_other,
    institution_type = excluded.institution_type,
    institution = excluded.institution,
    country = excluded.country,
    training_level = excluded.training_level,
    years_in_practice = excluded.years_in_practice,
    interests = excluded.interests,
    learning_goals = excluded.learning_goals,
    agreement_accepted_at = excluded.agreement_accepted_at,
    agreement_version = excluded.agreement_version,
    performance_research_consent = excluded.performance_research_consent,
    onboarding_completed_at = excluded.onboarding_completed_at,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

revoke execute on function public.handle_new_site_user()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
