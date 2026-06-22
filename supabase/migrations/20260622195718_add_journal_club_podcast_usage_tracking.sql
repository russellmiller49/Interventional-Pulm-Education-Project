create table if not exists public.journal_club_podcast_feedback (
  id uuid primary key default gen_random_uuid(),
  episode_id text not null,
  episode_title text not null,
  primary_hub text not null,
  language text not null,
  content_quality_rating smallint not null,
  audio_dialog_rating smallint not null,
  route_path text not null default '/journal-club-podcasts',
  user_agent text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  constraint journal_club_podcast_feedback_episode_id_check check (length(trim(episode_id)) > 0),
  constraint journal_club_podcast_feedback_episode_title_check check (
    length(trim(episode_title)) > 0
  ),
  constraint journal_club_podcast_feedback_primary_hub_check check (length(trim(primary_hub)) > 0),
  constraint journal_club_podcast_feedback_language_check check (
    language = any (array['english', 'spanish', 'mandarin', 'arabic', 'korean'])
  ),
  constraint journal_club_podcast_feedback_content_rating_check check (
    content_quality_rating between 1 and 5
  ),
  constraint journal_club_podcast_feedback_audio_rating_check check (
    audio_dialog_rating between 1 and 5
  ),
  constraint journal_club_podcast_feedback_route_path_check check (route_path like '/%')
);

alter table public.journal_club_podcast_feedback
  add column if not exists playback_session_id uuid,
  add column if not exists current_time_seconds integer,
  add column if not exists duration_seconds integer,
  add column if not exists listened_seconds integer,
  add column if not exists percent_complete smallint;

do $$
begin
  alter table public.journal_club_podcast_feedback
    add constraint journal_club_podcast_feedback_current_time_check
    check (current_time_seconds is null or current_time_seconds between 0 and 86400);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.journal_club_podcast_feedback
    add constraint journal_club_podcast_feedback_duration_check
    check (duration_seconds is null or duration_seconds between 0 and 86400);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.journal_club_podcast_feedback
    add constraint journal_club_podcast_feedback_listened_check
    check (listened_seconds is null or listened_seconds between 0 and 86400);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.journal_club_podcast_feedback
    add constraint journal_club_podcast_feedback_percent_check
    check (percent_complete is null or percent_complete between 0 and 100);
exception
  when duplicate_object then null;
end $$;

create index if not exists journal_club_podcast_feedback_episode_created_idx
  on public.journal_club_podcast_feedback (episode_id, created_at desc);

create index if not exists journal_club_podcast_feedback_language_created_idx
  on public.journal_club_podcast_feedback (language, created_at desc);

create index if not exists journal_club_podcast_feedback_playback_session_idx
  on public.journal_club_podcast_feedback (playback_session_id)
  where playback_session_id is not null;

create table if not exists public.journal_club_podcast_listens (
  id uuid primary key default gen_random_uuid(),
  playback_session_id uuid not null unique,
  episode_id text not null,
  episode_title text not null,
  primary_hub text not null,
  language text not null,
  route_path text not null default '/journal-club-podcasts',
  started_at timestamp with time zone not null default timezone('utc', now()),
  last_event_at timestamp with time zone not null default timezone('utc', now()),
  completed_at timestamp with time zone,
  last_event_type text not null,
  play_count integer not null default 0,
  progress_event_count integer not null default 0,
  listened_seconds integer not null default 0,
  max_position_seconds integer not null default 0,
  duration_seconds integer,
  max_percent_complete smallint not null default 0,
  playback_rate numeric(4, 2) not null default 1.0,
  user_agent text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint journal_club_podcast_listens_episode_id_check check (length(trim(episode_id)) > 0),
  constraint journal_club_podcast_listens_episode_title_check check (
    length(trim(episode_title)) > 0
  ),
  constraint journal_club_podcast_listens_primary_hub_check check (length(trim(primary_hub)) > 0),
  constraint journal_club_podcast_listens_language_check check (
    language = any (array['english', 'spanish', 'mandarin', 'arabic', 'korean'])
  ),
  constraint journal_club_podcast_listens_route_path_check check (route_path like '/%'),
  constraint journal_club_podcast_listens_event_type_check check (
    last_event_type = any (
      array['play_started', 'play_progress', 'play_paused', 'play_completed', 'play_seeked']
    )
  ),
  constraint journal_club_podcast_listens_counts_check check (
    play_count >= 0 and progress_event_count >= 0
  ),
  constraint journal_club_podcast_listens_seconds_check check (
    listened_seconds between 0 and 86400
    and max_position_seconds between 0 and 86400
    and (duration_seconds is null or duration_seconds between 0 and 86400)
  ),
  constraint journal_club_podcast_listens_percent_check check (max_percent_complete between 0 and 100),
  constraint journal_club_podcast_listens_playback_rate_check check (
    playback_rate between 0.25 and 4.0
  )
);

create index if not exists journal_club_podcast_listens_episode_started_idx
  on public.journal_club_podcast_listens (episode_id, started_at desc);

create index if not exists journal_club_podcast_listens_language_started_idx
  on public.journal_club_podcast_listens (language, started_at desc);

create index if not exists journal_club_podcast_listens_last_event_idx
  on public.journal_club_podcast_listens (last_event_at desc);

drop trigger if exists set_journal_club_podcast_listens_updated_at
  on public.journal_club_podcast_listens;

create trigger set_journal_club_podcast_listens_updated_at
  before update on public.journal_club_podcast_listens
  for each row
  execute function public.set_site_updated_at();

alter table public.journal_club_podcast_feedback enable row level security;
alter table public.journal_club_podcast_listens enable row level security;

revoke all on table public.journal_club_podcast_feedback from anon, authenticated;
revoke all on table public.journal_club_podcast_listens from anon, authenticated;

grant all on table public.journal_club_podcast_feedback to service_role;
grant all on table public.journal_club_podcast_listens to service_role;

notify pgrst, 'reload schema';
