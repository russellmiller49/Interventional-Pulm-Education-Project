import { NextResponse } from 'next/server'

import {
  JOURNAL_CLUB_PODCAST_LISTENS_TABLE,
  resolveJournalClubPodcastPlayback,
} from '@/lib/journal-club-podcasts/usage'
import { requireJournalClubPodcastApiAuth } from '@/lib/journal-club-podcasts/auth'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireJournalClubPodcastApiAuth(request)
  if (!auth.ok) {
    return auth.response
  }

  const rawPayload = await request.json().catch(() => null)
  const playback = resolveJournalClubPodcastPlayback(rawPayload)

  if (!playback) {
    return NextResponse.json(
      { error: 'Choose a valid podcast, language, playback session, and progress values.' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  const supabase = createSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase service role credentials are not configured.' },
      {
        status: 501,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  const { data: current, error: readError } = await supabase
    .from(JOURNAL_CLUB_PODCAST_LISTENS_TABLE)
    .select(
      'completed_at, duration_seconds, listened_seconds, max_percent_complete, max_position_seconds, play_count, progress_event_count, started_at,user_id',
    )
    .eq('playback_session_id', playback.playbackSessionId)
    .maybeSingle()

  if (readError) {
    return NextResponse.json(
      { error: readError.message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  const now = new Date().toISOString()
  const nextPercentComplete = Math.max(current?.max_percent_complete ?? 0, playback.percentComplete)
  const completedAt =
    current?.completed_at ??
    (playback.eventType === 'play_completed' || nextPercentComplete >= 95 ? now : null)

  const { error: writeError } = await supabase.from(JOURNAL_CLUB_PODCAST_LISTENS_TABLE).upsert(
    {
      completed_at: completedAt,
      duration_seconds: playback.durationSeconds ?? current?.duration_seconds ?? null,
      episode_id: playback.episodeId,
      episode_title: playback.episodeTitle,
      language: playback.language,
      last_event_at: now,
      last_event_type: playback.eventType,
      listened_seconds: Math.max(current?.listened_seconds ?? 0, playback.listenedSeconds),
      max_percent_complete: nextPercentComplete,
      max_position_seconds: Math.max(
        current?.max_position_seconds ?? 0,
        playback.currentTimeSeconds,
      ),
      playback_rate: playback.playbackRate,
      playback_session_id: playback.playbackSessionId,
      play_count: (current?.play_count ?? 0) + (playback.eventType === 'play_started' ? 1 : 0),
      primary_hub: playback.primaryHub,
      progress_event_count: (current?.progress_event_count ?? 0) + 1,
      route_path: '/journal-club-podcasts',
      started_at: current?.started_at ?? now,
      user_id: auth.userId ?? current?.user_id ?? null,
      user_agent: trimHeader(request.headers.get('user-agent')),
    },
    { onConflict: 'playback_session_id' },
  )

  if (writeError) {
    console.error('Unable to save journal club podcast playback', writeError)
    return NextResponse.json(
      { error: 'Unable to save podcast playback.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  return NextResponse.json(
    { status: 'ok' },
    {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}

function trimHeader(value: string | null) {
  if (!value) {
    return null
  }

  return value.slice(0, 500)
}
