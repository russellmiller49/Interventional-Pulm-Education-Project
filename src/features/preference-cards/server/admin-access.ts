import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  hasValidLocalDevAuthCookie,
  LOCAL_DEV_AUTH_COOKIE_NAME,
} from '@/lib/site-auth/local-dev-auth'
import { supabaseServer } from '@/lib/supabase/server'

type PreferenceCardsAdminFailure =
  | 'email_unverified'
  | 'not_authenticated'
  | 'not_authorized'
  | 'unavailable'

async function hasLocalDevelopmentAdminAccess(): Promise<boolean> {
  try {
    const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
    const host = requestHeaders.get('host')
    if (!host) return false
    const requestUrl = new URL(`http://${host}`)
    return hasValidLocalDevAuthCookie(
      requestUrl,
      cookieStore.get(LOCAL_DEV_AUTH_COOKIE_NAME)?.value,
    )
  } catch {
    return false
  }
}

async function resolvePreferenceCardsSiteAdmin(): Promise<
  { ok: true } | { ok: false; reason: PreferenceCardsAdminFailure }
> {
  if (await hasLocalDevelopmentAdminAccess()) return { ok: true }

  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return { ok: false, reason: 'not_authenticated' }
    if (!user.email_confirmed_at) return { ok: false, reason: 'email_unverified' }

    const now = new Date().toISOString()
    const { data: entitlement, error: entitlementError } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('user_id', user.id)
      .eq('entitlement', 'site_admin')
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .maybeSingle()
    if (entitlementError) return { ok: false, reason: 'unavailable' }
    if (!entitlement) return { ok: false, reason: 'not_authorized' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

export async function requirePreferenceCardsSiteAdminApi() {
  const result = await resolvePreferenceCardsSiteAdmin()
  if (result.ok) return { ok: true as const }

  const status =
    result.reason === 'unavailable' ? 503 : result.reason === 'not_authenticated' ? 401 : 403
  const message =
    result.reason === 'email_unverified'
      ? 'Verified email required.'
      : status === 503
        ? 'Preference-card authorization is temporarily unavailable.'
        : status === 401
          ? 'Authentication required.'
          : 'Site admin access required.'

  return {
    ok: false as const,
    response: NextResponse.json(
      { error: { code: 'PREFERENCE_CARDS_ACCESS_DENIED', message } },
      {
        status,
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    ),
  }
}
