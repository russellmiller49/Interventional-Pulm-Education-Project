-- SoCal EBUS course emails: a permanent activation cutoff (owner requirement, 2026-10-29).
--
-- Delivery stays OFF until the single activation row exists. After that, an event may be delivered only if it was created at or
-- after the activation moment and is still 'pending'. Every event created before it (among them the 116 that failed in May–June
-- 2026, and anything created while delivery was off) is permanently ineligible; the rows are kept for audit, never retried or
-- backfilled. A failed event is never retried automatically either.
--
-- The check sits in the two places that can deliver:
--   * dispatch_socal_ebus_email_event: the pg_net call the enqueue triggers make (no call for an ineligible event);
--   * claim_socal_ebus_email_event: the Edge Function's only way to claim an event (a direct POST with an old id and token
--     claims nothing).
-- The activation row cannot be changed or removed, and an event's created_at cannot be changed, so neither can be used to make
-- an old event look new. Activation is a separate, owner-authorised insert:
--   insert into public.socal_ebus_email_delivery_activation (activated_by, note) values ('<owner>', '<why>');

create table if not exists public.socal_ebus_email_delivery_activation (
  singleton boolean primary key default true check (singleton),
  activated_at timestamp with time zone not null default timezone('utc', now()),
  activated_by text not null check (length(trim(activated_by)) > 0),
  note text
);

alter table public.socal_ebus_email_delivery_activation enable row level security;
revoke all on table public.socal_ebus_email_delivery_activation from public, anon, authenticated;

create or replace function public.refuse_socal_ebus_activation_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The SoCal EBUS email activation cutoff is permanent; it cannot be changed or removed';
end;
$$;

revoke execute on function public.refuse_socal_ebus_activation_change() from public, anon, authenticated;

drop trigger if exists refuse_socal_ebus_activation_change on public.socal_ebus_email_delivery_activation;
create trigger refuse_socal_ebus_activation_change
  before update or delete on public.socal_ebus_email_delivery_activation
  for each row
  execute function public.refuse_socal_ebus_activation_change();

drop trigger if exists refuse_socal_ebus_activation_truncate on public.socal_ebus_email_delivery_activation;
create trigger refuse_socal_ebus_activation_truncate
  before truncate on public.socal_ebus_email_delivery_activation
  for each statement
  execute function public.refuse_socal_ebus_activation_change();

-- An event's creation time decides its eligibility, so it is fixed.
create or replace function public.freeze_socal_ebus_email_event_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'socal_ebus_email_events.id and created_at cannot be changed';
  end if;
  return new;
end;
$$;

revoke execute on function public.freeze_socal_ebus_email_event_identity() from public, anon, authenticated;

drop trigger if exists freeze_socal_ebus_email_event_identity on public.socal_ebus_email_events;
create trigger freeze_socal_ebus_email_event_identity
  before update on public.socal_ebus_email_events
  for each row
  execute function public.freeze_socal_ebus_email_event_identity();

create or replace function public.socal_ebus_email_event_deliverable(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.socal_ebus_email_events e
    join public.socal_ebus_email_delivery_activation a on e.created_at >= a.activated_at
    where e.id = target_event_id
      and e.status = 'pending'
  );
$$;

revoke execute on function public.socal_ebus_email_event_deliverable(uuid) from public, anon, authenticated;

create or replace function public.dispatch_socal_ebus_email_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_token text;
begin
  if not public.socal_ebus_email_event_deliverable(target_event_id) then
    return;  -- delivery off, an event from before the cutoff, or no longer pending: never sent
  end if;

  select webhook_token
  into target_token
  from public.socal_ebus_email_events
  where id = target_event_id;

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

-- The Edge Function's only claim: atomic, token-checked, and only for a deliverable event.
create or replace function public.claim_socal_ebus_email_event(target_event_id uuid, presented_token text)
returns setof public.socal_ebus_email_events
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.socal_ebus_email_events e
     set status = 'processing',
         attempt_count = e.attempt_count + 1,
         last_attempt_at = timezone('utc', now()),
         error_message = null
   where e.id = target_event_id
     and e.webhook_token = presented_token
     and e.status = 'pending'
     and exists (
       select 1
       from public.socal_ebus_email_delivery_activation a
       where e.created_at >= a.activated_at
     )
  returning e.*;
end;
$$;

revoke execute on function public.claim_socal_ebus_email_event(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_socal_ebus_email_event(uuid, text) to service_role;
