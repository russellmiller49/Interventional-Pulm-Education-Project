import type { Route } from 'next'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { defaultLocale, isActiveLocale } from '@/i18n/locale'
import { localizePath } from '@/i18n/path'
import { supabaseServer } from '@/lib/supabase/server'

interface SiteAdminResult {
  user: User | null
  reason:
    | 'authenticated'
    | 'email_unverified'
    | 'not_authenticated'
    | 'not_authorized'
    | 'unavailable'
}

async function resolveLiteratureSiteAdmin(): Promise<SiteAdminResult> {
  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return { user: null, reason: 'not_authenticated' }
    }
    if (!user.email_confirmed_at) {
      return { user: null, reason: 'email_unverified' }
    }

    const now = new Date().toISOString()
    const { data: entitlement, error: entitlementError } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('user_id', user.id)
      .eq('entitlement', 'site_admin')
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .maybeSingle()

    if (entitlementError) {
      return { user: null, reason: 'unavailable' }
    }
    if (!entitlement) {
      return { user: null, reason: 'not_authorized' }
    }

    return { user, reason: 'authenticated' }
  } catch {
    return { user: null, reason: 'unavailable' }
  }
}

export async function requireLiteratureSiteAdminPage(locale: string, nextPath: string) {
  const result = await resolveLiteratureSiteAdmin()
  if (result.user) {
    return result.user
  }

  const activeLocale = isActiveLocale(locale) ? locale : defaultLocale
  if (result.reason === 'not_authenticated' || result.reason === 'unavailable') {
    const loginPath = localizePath('/login', activeLocale)
    redirect(
      `${loginPath}?next=${encodeURIComponent(localizePath(nextPath, activeLocale))}` as Route,
    )
  }
  if (result.reason === 'email_unverified') {
    redirect(localizePath('/verify-email', activeLocale) as Route)
  }

  redirect(`${localizePath('/dashboard', activeLocale)}?required=site_admin` as Route)
}

export async function requireLiteratureSiteAdminApi() {
  const result = await resolveLiteratureSiteAdmin()
  if (result.user) {
    return { ok: true as const, user: result.user }
  }

  const status =
    result.reason === 'unavailable' ? 503 : result.reason === 'not_authenticated' ? 401 : 403
  const code =
    result.reason === 'unavailable' ? 'LITERATURE_AUTH_UNAVAILABLE' : 'LITERATURE_ACCESS_DENIED'
  const message =
    result.reason === 'email_unverified'
      ? 'Verified email required.'
      : status === 503
        ? 'Literature authorization is temporarily unavailable.'
        : status === 401
          ? 'Authentication required.'
          : 'Site admin access required.'

  return {
    ok: false as const,
    response: NextResponse.json(
      { error: { code, message } },
      { status, headers: { 'Cache-Control': 'no-store' } },
    ),
  }
}
