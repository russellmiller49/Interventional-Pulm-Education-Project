import { NextResponse } from 'next/server'

import {
  JOURNAL_CLUB_PODCAST_FEEDBACK_TABLE,
  resolveJournalClubPodcastFeedback,
} from '@/lib/journal-club-podcasts/feedback'
import { requireJournalClubPodcastApiAuth } from '@/lib/journal-club-podcasts/auth'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireJournalClubPodcastApiAuth(request)
  if (!auth.ok) {
    return auth.response
  }

  const rawPayload = await request.json().catch(() => null)
  const feedback = resolveJournalClubPodcastFeedback(rawPayload)

  if (!feedback) {
    return NextResponse.json(
      { error: 'Choose a valid podcast, language, and 1-5 star ratings.' },
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

  const { error } = await supabase.from(JOURNAL_CLUB_PODCAST_FEEDBACK_TABLE).insert({
    audio_dialog_rating: feedback.audioDialogRating,
    content_quality_rating: feedback.contentQualityRating,
    current_time_seconds: feedback.currentTimeSeconds,
    duration_seconds: feedback.durationSeconds,
    episode_id: feedback.episodeId,
    episode_title: feedback.episodeTitle,
    language: feedback.language,
    listened_seconds: feedback.listenedSeconds,
    playback_session_id: feedback.playbackSessionId,
    percent_complete: feedback.percentComplete,
    primary_hub: feedback.primaryHub,
    route_path: '/journal-club-podcasts',
    user_agent: trimHeader(request.headers.get('user-agent')),
  })

  if (error) {
    console.error('Unable to save journal club podcast feedback', error)
    return NextResponse.json(
      { error: 'Unable to save podcast feedback.' },
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
