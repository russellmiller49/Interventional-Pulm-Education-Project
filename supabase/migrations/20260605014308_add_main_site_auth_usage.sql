create table if not exists public.site_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  professional_role text not null,
  resident_specialty text,
  role_other text,
  institution_type text not null,
  institution text not null,
  country text not null,
  training_level text,
  years_in_practice text not null,
  interests text[] not null default '{}'::text[],
  learning_goals text[] not null default '{}'::text[],
  onboarding_completed_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint site_profiles_email_check check (length(trim(email)) > 3),
  constraint site_profiles_first_name_check check (length(trim(first_name)) > 0),
  constraint site_profiles_last_name_check check (length(trim(last_name)) > 0),
  constraint site_profiles_professional_role_check check (
    professional_role = any (array[
      'medical_student',
      'resident',
      'chief_resident',
      'pulmonary_fellow',
      'critical_care_fellow',
      'pccm_fellow',
      'interventional_pulmonology_fellow',
      'thoracic_surgery_fellow',
      'pulmonologist',
      'interventional_pulmonologist',
      'intensivist',
      'thoracic_surgeon',
      'general_surgeon',
      'anesthesiologist',
      'emergency_medicine_physician',
      'advanced_practice_provider',
      'respiratory_therapist',
      'nurse',
      'cytotechnologist',
      'pathologist',
      'medical_educator',
      'industry',
      'other'
    ])
  ),
  constraint site_profiles_resident_specialty_check check (
    (
      professional_role = 'resident'
      and resident_specialty = any (array[
        'internal_medicine',
        'pediatrics',
        'surgery',
        'anesthesia',
        'emergency_medicine',
        'other'
      ])
    )
    or (professional_role <> 'resident' and resident_specialty is null)
  ),
  constraint site_profiles_role_other_check check (
    (professional_role = 'other' and length(trim(coalesce(role_other, ''))) > 0)
    or (professional_role <> 'other')
  ),
  constraint site_profiles_institution_type_check check (
    institution_type = any (array[
      'hospital',
      'medical_school',
      'training_program',
      'company'
    ])
  ),
  constraint site_profiles_institution_check check (length(trim(institution)) > 0),
  constraint site_profiles_country_check check (length(trim(country)) > 0),
  constraint site_profiles_training_level_check check (
    (
      professional_role = 'medical_student'
      and training_level = any (array['ms1', 'ms2', 'ms3', 'ms4'])
    )
    or (
      professional_role = 'resident'
      and training_level = any (array['pgy_1', 'pgy_2', 'pgy_3', 'pgy_4', 'pgy_5', 'pgy_6'])
    )
    or (
      professional_role = any (array[
        'pulmonary_fellow',
        'critical_care_fellow',
        'pccm_fellow',
        'interventional_pulmonology_fellow',
        'thoracic_surgery_fellow'
      ])
      and training_level = any (array[
        'fellow_year_1',
        'fellow_year_2',
        'fellow_year_3',
        'ip_fellow'
      ])
    )
    or (
      professional_role <> all (array[
        'medical_student',
        'resident',
        'pulmonary_fellow',
        'critical_care_fellow',
        'pccm_fellow',
        'interventional_pulmonology_fellow',
        'thoracic_surgery_fellow'
      ])
      and training_level is null
    )
  ),
  constraint site_profiles_years_in_practice_check check (
    years_in_practice = any (array[
      'in_training',
      'lt_5',
      '5_10',
      '10_20',
      '20_plus'
    ])
  )
);

create table if not exists public.site_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement text not null,
  status text not null default 'active',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamp with time zone not null default timezone('utc', now()),
  expires_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  primary key (user_id, entitlement),
  constraint site_entitlements_entitlement_check check (
    entitlement = any (array['socal_ebus_course', 'ip_registry', 'site_admin'])
  ),
  constraint site_entitlements_status_check check (
    status = any (array['active', 'pending', 'revoked'])
  )
);

create table if not exists public.site_module_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  route_path text not null,
  started_at timestamp with time zone not null default timezone('utc', now()),
  last_heartbeat_at timestamp with time zone not null default timezone('utc', now()),
  ended_at timestamp with time zone,
  duration_seconds integer not null default 0,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint site_module_sessions_module_id_check check (length(trim(module_id)) > 0),
  constraint site_module_sessions_route_path_check check (route_path like '/%'),
  constraint site_module_sessions_duration_check check (duration_seconds >= 0)
);

create index if not exists site_module_sessions_user_started_idx
  on public.site_module_sessions (user_id, started_at desc);

create index if not exists site_module_sessions_module_started_idx
  on public.site_module_sessions (module_id, started_at desc);

create table if not exists public.site_module_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  first_started_at timestamp with time zone not null default timezone('utc', now()),
  last_visited_at timestamp with time zone not null default timezone('utc', now()),
  completed_at timestamp with time zone,
  percent_complete integer not null default 0,
  total_time_seconds integer not null default 0,
  completed_sections text[] not null default '{}'::text[],
  updated_at timestamp with time zone not null default timezone('utc', now()),
  primary key (user_id, module_id),
  constraint site_module_progress_module_id_check check (length(trim(module_id)) > 0),
  constraint site_module_progress_percent_check check (
    percent_complete >= 0 and percent_complete <= 100
  ),
  constraint site_module_progress_total_time_check check (total_time_seconds >= 0)
);

create index if not exists site_module_progress_module_updated_idx
  on public.site_module_progress (module_id, updated_at desc);

create table if not exists public.site_module_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.site_module_sessions(id) on delete set null,
  module_id text not null,
  route_path text not null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc', now()),
  constraint site_module_events_module_id_check check (length(trim(module_id)) > 0),
  constraint site_module_events_route_path_check check (route_path like '/%'),
  constraint site_module_events_event_type_check check (
    event_type = any (array[
      'module_opened',
      'session_heartbeat',
      'session_ended',
      'section_completed',
      'quiz_submitted',
      'module_completed'
    ])
  ),
  constraint site_module_events_payload_check check (jsonb_typeof(event_payload) = 'object')
);

create index if not exists site_module_events_user_created_idx
  on public.site_module_events (user_id, created_at desc);

create index if not exists site_module_events_module_created_idx
  on public.site_module_events (module_id, created_at desc);

create or replace function public.set_site_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke execute on function public.set_site_updated_at()
  from public, anon, authenticated;

drop trigger if exists set_site_profiles_updated_at on public.site_profiles;
create trigger set_site_profiles_updated_at
  before update on public.site_profiles
  for each row
  execute function public.set_site_updated_at();

drop trigger if exists set_site_entitlements_updated_at on public.site_entitlements;
create trigger set_site_entitlements_updated_at
  before update on public.site_entitlements
  for each row
  execute function public.set_site_updated_at();

drop trigger if exists set_site_module_sessions_updated_at on public.site_module_sessions;
create trigger set_site_module_sessions_updated_at
  before update on public.site_module_sessions
  for each row
  execute function public.set_site_updated_at();

drop trigger if exists set_site_module_progress_updated_at on public.site_module_progress;
create trigger set_site_module_progress_updated_at
  before update on public.site_module_progress
  for each row
  execute function public.set_site_updated_at();

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
  profile_ready boolean;
begin
  if profile_scope <> 'main_site' then
    return new;
  end if;

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
    and nullif(trim(coalesce(metadata ->> 'years_in_practice', '')), '') is not null;

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
    onboarding_completed_at = excluded.onboarding_completed_at,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

revoke execute on function public.handle_new_site_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created_site_profile on auth.users;
create trigger on_auth_user_created_site_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_site_user();

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

create or replace function public.current_user_has_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_entitlements
    where user_id = auth.uid()
      and entitlement = 'site_admin'
      and status = 'active'
      and (expires_at is null or expires_at > timezone('utc', now()))
  );
$$;

revoke execute on function public.current_user_has_site_admin()
  from public, anon, authenticated;
grant execute on function public.current_user_has_site_admin()
  to authenticated;

create or replace function public.enqueue_socal_ebus_signup_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recipient text;
  queued_event_id uuid;
begin
  if public.is_main_site_auth_user(new.id) then
    return new;
  end if;

  if new.approval_status <> 'pending' or new.invite_sent_at is not null then
    return new;
  end if;

  recipient := lower(nullif(trim(coalesce(new.email, new.institutional_email, '')), ''));

  if recipient is null then
    return new;
  end if;

  with inserted as (
    insert into public.socal_ebus_email_events (
      learner_id,
      event_type,
      recipient_email,
      recipient_name,
      payload
    )
    values (
      new.id,
      'signup_received',
      recipient,
      nullif(trim(coalesce(new.full_name, '')), ''),
      jsonb_build_object(
        'courseName', 'SoCal EBUS Course',
        'courseUrl', 'https://interventionalpulm.org/socal-ebus-course',
        'signupReceivedAt', timezone('utc', now())
      )
    )
    on conflict (learner_id, event_type) do nothing
    returning id
  )
  select id into queued_event_id
  from inserted;

  if queued_event_id is not null then
    perform public.dispatch_socal_ebus_email_event(queued_event_id);
  end if;

  return new;
end;
$$;

revoke execute on function public.enqueue_socal_ebus_signup_email()
  from public, anon, authenticated;

create or replace function public.enqueue_socal_ebus_approval_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recipient text;
  queued_event_id uuid;
begin
  if public.is_main_site_auth_user(new.id) then
    return new;
  end if;

  if new.approval_status <> 'approved'
    or old.approval_status is not distinct from 'approved'
  then
    return new;
  end if;

  recipient := lower(nullif(trim(coalesce(new.email, new.institutional_email, '')), ''));

  if recipient is null then
    return new;
  end if;

  with inserted as (
    insert into public.socal_ebus_email_events (
      learner_id,
      event_type,
      recipient_email,
      recipient_name,
      payload
    )
    values (
      new.id,
      'account_approved',
      recipient,
      nullif(trim(coalesce(new.full_name, '')), ''),
      jsonb_build_object(
        'courseName', 'SoCal EBUS Course',
        'courseUrl', 'https://interventionalpulm.org/socal-ebus-course',
        'approvedAt', new.approved_at,
        'approvedBy', new.approved_by
      )
    )
    on conflict (learner_id, event_type) do nothing
    returning id
  )
  select id into queued_event_id
  from inserted;

  if queued_event_id is not null then
    perform public.dispatch_socal_ebus_email_event(queued_event_id);
  end if;

  return new;
end;
$$;

revoke execute on function public.enqueue_socal_ebus_approval_email()
  from public, anon, authenticated;

alter table public.site_profiles enable row level security;
alter table public.site_entitlements enable row level security;
alter table public.site_module_sessions enable row level security;
alter table public.site_module_progress enable row level security;
alter table public.site_module_events enable row level security;

revoke all on table public.site_profiles from anon, authenticated;
revoke all on table public.site_entitlements from anon, authenticated;
revoke all on table public.site_module_sessions from anon, authenticated;
revoke all on table public.site_module_progress from anon, authenticated;
revoke all on table public.site_module_events from anon, authenticated;

grant select, insert, update on table public.site_profiles to authenticated;
grant select on table public.site_entitlements to authenticated;
grant select, insert, update on table public.site_module_sessions to authenticated;
grant select, insert, update on table public.site_module_progress to authenticated;
grant select, insert on table public.site_module_events to authenticated;
grant all on table public.site_profiles to service_role;
grant all on table public.site_entitlements to service_role;
grant all on table public.site_module_sessions to service_role;
grant all on table public.site_module_progress to service_role;
grant all on table public.site_module_events to service_role;

drop policy if exists site_profiles_select_own on public.site_profiles;
create policy site_profiles_select_own
  on public.site_profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists site_profiles_select_site_admin on public.site_profiles;
create policy site_profiles_select_site_admin
  on public.site_profiles
  for select
  to authenticated
  using (public.current_user_has_site_admin());

drop policy if exists site_profiles_insert_own on public.site_profiles;
create policy site_profiles_insert_own
  on public.site_profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists site_profiles_update_own on public.site_profiles;
create policy site_profiles_update_own
  on public.site_profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists site_entitlements_select_own on public.site_entitlements;
create policy site_entitlements_select_own
  on public.site_entitlements
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'active'
    and (expires_at is null or expires_at > timezone('utc', now()))
  );

drop policy if exists site_entitlements_select_site_admin on public.site_entitlements;
create policy site_entitlements_select_site_admin
  on public.site_entitlements
  for select
  to authenticated
  using (public.current_user_has_site_admin());

drop policy if exists site_module_sessions_select_own on public.site_module_sessions;
create policy site_module_sessions_select_own
  on public.site_module_sessions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists site_module_sessions_select_site_admin on public.site_module_sessions;
create policy site_module_sessions_select_site_admin
  on public.site_module_sessions
  for select
  to authenticated
  using (public.current_user_has_site_admin());

drop policy if exists site_module_sessions_insert_own on public.site_module_sessions;
create policy site_module_sessions_insert_own
  on public.site_module_sessions
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists site_module_sessions_update_own on public.site_module_sessions;
create policy site_module_sessions_update_own
  on public.site_module_sessions
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists site_module_progress_select_own on public.site_module_progress;
create policy site_module_progress_select_own
  on public.site_module_progress
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists site_module_progress_select_site_admin on public.site_module_progress;
create policy site_module_progress_select_site_admin
  on public.site_module_progress
  for select
  to authenticated
  using (public.current_user_has_site_admin());

drop policy if exists site_module_progress_insert_own on public.site_module_progress;
create policy site_module_progress_insert_own
  on public.site_module_progress
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists site_module_progress_update_own on public.site_module_progress;
create policy site_module_progress_update_own
  on public.site_module_progress
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists site_module_events_select_own on public.site_module_events;
create policy site_module_events_select_own
  on public.site_module_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists site_module_events_select_site_admin on public.site_module_events;
create policy site_module_events_select_site_admin
  on public.site_module_events
  for select
  to authenticated
  using (public.current_user_has_site_admin());

drop policy if exists site_module_events_insert_own on public.site_module_events;
create policy site_module_events_insert_own
  on public.site_module_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));
