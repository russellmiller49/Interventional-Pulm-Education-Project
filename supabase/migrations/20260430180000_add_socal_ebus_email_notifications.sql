create extension if not exists pg_net;

create table if not exists public.socal_ebus_email_events (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  event_type text not null,
  recipient_email text not null,
  recipient_name text,
  payload jsonb not null default '{}'::jsonb,
  webhook_token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_attempt_at timestamp with time zone,
  sent_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint socal_ebus_email_events_event_type_check
    check (event_type in ('signup_received', 'account_approved')),
  constraint socal_ebus_email_events_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  constraint socal_ebus_email_events_recipient_email_check
    check (length(trim(recipient_email)) > 0),
  constraint socal_ebus_email_events_once_per_learner_event
    unique (learner_id, event_type)
);

create index if not exists socal_ebus_email_events_status_created_at_idx
  on public.socal_ebus_email_events (status, created_at);

alter table public.socal_ebus_email_events enable row level security;
revoke all on table public.socal_ebus_email_events from anon, authenticated;

drop trigger if exists set_socal_ebus_email_events_updated_at
  on public.socal_ebus_email_events;

create trigger set_socal_ebus_email_events_updated_at
  before update on public.socal_ebus_email_events
  for each row
  execute function public.set_updated_at();

create or replace function public.dispatch_socal_ebus_email_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_token text;
begin
  select webhook_token
  into target_token
  from public.socal_ebus_email_events
  where id = target_event_id
    and status in ('pending', 'failed');

  if target_token is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://tqnhxlwvkkswuckszlee.supabase.co/functions/v1/socal-ebus-email-notifications',
    body := jsonb_build_object(
      'eventId', target_event_id,
      'token', target_token
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
end;
$$;

revoke execute on function public.dispatch_socal_ebus_email_event(uuid)
  from public, anon, authenticated;

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

drop trigger if exists enqueue_socal_ebus_signup_email
  on public.learner_profiles;

create trigger enqueue_socal_ebus_signup_email
  after insert on public.learner_profiles
  for each row
  execute function public.enqueue_socal_ebus_signup_email();

drop trigger if exists enqueue_socal_ebus_approval_email
  on public.learner_profiles;

create trigger enqueue_socal_ebus_approval_email
  after update of approval_status on public.learner_profiles
  for each row
  when (
    old.approval_status is distinct from new.approval_status
    and new.approval_status = 'approved'
  )
  execute function public.enqueue_socal_ebus_approval_email();
