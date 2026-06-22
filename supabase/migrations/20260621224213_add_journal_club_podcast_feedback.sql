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

create index if not exists journal_club_podcast_feedback_episode_created_idx
  on public.journal_club_podcast_feedback (episode_id, created_at desc);

create index if not exists journal_club_podcast_feedback_language_created_idx
  on public.journal_club_podcast_feedback (language, created_at desc);

alter table public.journal_club_podcast_feedback enable row level security;

revoke all on table public.journal_club_podcast_feedback from anon, authenticated;
grant all on table public.journal_club_podcast_feedback to service_role;

notify pgrst, 'reload schema';
