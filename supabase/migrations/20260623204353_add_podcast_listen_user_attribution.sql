alter table public.journal_club_podcast_listens
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists journal_club_podcast_listens_user_started_idx
  on public.journal_club_podcast_listens (user_id, started_at desc)
  where user_id is not null;

create index if not exists journal_club_podcast_listens_user_episode_idx
  on public.journal_club_podcast_listens (user_id, episode_id, last_event_at desc)
  where user_id is not null;

notify pgrst, 'reload schema';
