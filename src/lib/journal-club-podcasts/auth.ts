import { NextResponse } from 'next/server'

import {
  hasValidLocalDevAuthCookie,
  LOCAL_DEV_AUTH_COOKIE_NAME,
} from '@/lib/site-auth/local-dev-auth'
import { supabaseServer } from '@/lib/supabase/server'

export type JournalClubPodcastApiAuth =
  | {
      ok: true
      userId: string | null
      localDevAuth: boolean
    }
  | {
      ok: false
      response: NextResponse
    }

export async function requireJournalClubPodcastApiAuth(
  request: Request,
): Promise<JournalClubPodcastApiAuth> {
  const requestUrl = new URL(request.url)
  const localDevCookie = readCookie(request.headers.get('cookie'), LOCAL_DEV_AUTH_COOKIE_NAME)

  if (hasValidLocalDevAuthCookie(requestUrl, localDevCookie)) {
    return {
      ok: true,
      userId: null,
      localDevAuth: true,
    }
  }

  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (!error && user) {
      return {
        ok: true,
        userId: user.id,
        localDevAuth: false,
      }
    }
  } catch {
    // Treat Supabase auth setup errors as unauthenticated for this protected API.
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Authentication required.' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    ),
  }
}

function readCookie(header: string | null, name: string) {
  if (!header) {
    return undefined
  }

  for (const segment of header.split(';')) {
    const [rawName, ...rawValueParts] = segment.split('=')
    if (rawName?.trim() !== name) {
      continue
    }

    const rawValue = rawValueParts.join('=').trim()
    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return undefined
}
