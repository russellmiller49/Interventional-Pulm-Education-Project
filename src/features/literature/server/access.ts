import type { Route } from 'next'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import type { User } from '@supabase/supabase-js'

import { defaultLocale, isActiveLocale } from '@/i18n/locale'
import { localizePath } from '@/i18n/path'
import {
  hasValidLocalDevAuthCookie,
  LOCAL_DEV_AUTH_COOKIE_NAME,
} from '@/lib/site-auth/local-dev-auth'
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

const LOCAL_DEV_LITERATURE_ADMIN: User = {
  id: '00000000-0000-4000-8000-000000000001',
  app_metadata: {
    provider: 'local-dev',
    providers: ['local-dev'],
  },
  aud: 'authenticated',
  created_at: '1970-01-01T00:00:00.000Z',
  email: 'local-literature-admin@localhost.invalid',
  email_confirmed_at: '1970-01-01T00:00:00.000Z',
  role: 'authenticated',
  updated_at: '1970-01-01T00:00:00.000Z',
  user_metadata: {},
}

async function resolveLocalDevLiteratureAdmin() {
  try {
    const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
    const host = requestHeaders.get('host')
    if (!host) return null

    const requestUrl = new URL(`http://${host}`)
    const cookieValue = cookieStore.get(LOCAL_DEV_AUTH_COOKIE_NAME)?.value
    return hasValidLocalDevAuthCookie(requestUrl, cookieValue) ? LOCAL_DEV_LITERATURE_ADMIN : null
  } catch {
    return null
  }
}

async function resolveLiteratureSiteAdmin(): Promise<SiteAdminResult> {
  const localDevAdmin = await resolveLocalDevLiteratureAdmin()
  if (localDevAdmin) {
    return { user: localDevAdmin, reason: 'authenticated' }
  }

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
