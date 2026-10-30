-- Minimal stand-ins for what the course-email migrations expect on Supabase (local test only; never applied anywhere else).
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists net;
create table net.calls (id bigserial primary key, url text, body jsonb, at timestamptz default clock_timestamp());
-- pg_net stand-in: records each would-be HTTP call instead of making it
create function net.http_post(url text, body jsonb, headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into net.calls(url, body) values (url, body) returning id $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = timezone('utc', now()); return new; end $$;
create table public.learner_profiles (
  id uuid primary key default gen_random_uuid(), email text, institutional_email text, full_name text,
  approval_status text not null default 'pending', invite_sent_at timestamptz, approved_at timestamptz, approved_by text,
  updated_at timestamptz);
