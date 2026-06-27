import { NextResponse } from 'next/server'

import {
  JOURNAL_CLUB_PODCAST_BUCKET,
  resolveJournalClubAudioPath,
  resolveJournalClubAudioTtl,
} from '@/lib/journal-club-podcasts/audio'
import { requireJournalClubPodcastApiAuth } from '@/lib/journal-club-podcasts/auth'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const auth = await requireJournalClubPodcastApiAuth(request)
  if (!auth.ok) {
    return auth.response
  }

  const { searchParams } = new URL(request.url)
  const resolution = resolveJournalClubAudioPath(
    searchParams.get('episodeId'),
    searchParams.get('language'),
  )

  if (!resolution) {
    return NextResponse.json(
      { error: 'Unknown podcast episode or language.' },
      {
        status: 404,
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

  const expiresIn = resolveJournalClubAudioTtl()
  const { data, error } = await supabase.storage
    .from(JOURNAL_CLUB_PODCAST_BUCKET)
    .createSignedUrl(resolution.objectPath, expiresIn, {
      download: false,
    })

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? 'Unable to create a signed podcast audio URL.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  return NextResponse.json(
    {
      url: data.signedUrl,
      expiresIn,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
