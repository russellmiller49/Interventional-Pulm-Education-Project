import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import {
  canUseLegacyEbusApproval,
  getRequiredEntitlement,
  isAdminEbusPreviewEmbed,
  isAuthPath,
  isCtAlignmentSandboxPath,
  isPublicPath,
  isPublicTrainingEmbed,
  resolveLoginRedirectPath,
  type SiteEntitlement,
} from '@/lib/site-auth/access'
import {
  hasValidLocalDevAuthCookie,
  LOCAL_DEV_AUTH_COOKIE_NAME,
} from '@/lib/site-auth/local-dev-auth'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  if (process.env.NODE_ENV === 'production' && isCtAlignmentSandboxPath(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  if (pathname.startsWith('/auth')) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  if (
    pathname.startsWith('/api/') ||
    (!isAdminEbusPreviewEmbed(pathname, req.nextUrl.searchParams) && isPublicPath(pathname)) ||
    isPublicTrainingEmbed(pathname, req.nextUrl.searchParams)
  ) {
    return res
  }

  if (hasValidLocalDevAuthCookie(req.nextUrl, req.cookies.get(LOCAL_DEV_AUTH_COOKIE_NAME)?.value)) {
    return res
  }

  type CookieOptions = Parameters<typeof res.cookies.set>[2]

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options?: CookieOptions) {
          res.cookies.set(name, value, options)
        },
        remove(name: string, options?: CookieOptions) {
          res.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    },
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url)
    const modifiedCookies = res.cookies.getAll()
    for (const cookie of modifiedCookies) {
      redirectResponse.cookies.set(cookie)
    }
    return redirectResponse
  }

  if (userError || !user) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('next', resolveLoginRedirectPath(pathname, req.nextUrl.search))
    return redirectWithCookies(redirectUrl)
  }

  const requiredEntitlement = getRequiredEntitlement(pathname, req.nextUrl.searchParams)
  const hasLegacyEbusAccess =
    canUseLegacyEbusApproval(pathname, req.nextUrl.searchParams) &&
    (await hasApprovedLegacyEbusAccess(user.id))

  if (!user.email_confirmed_at && !hasLegacyEbusAccess) {
    const redirectUrl = new URL('/verify-email', req.url)
    return redirectWithCookies(redirectUrl)
  }

  if (requiredEntitlement) {
    const hasAccess =
      (await hasActiveSiteEntitlement(requiredEntitlement, user.id)) || hasLegacyEbusAccess

    if (!hasAccess) {
      const redirectUrl = new URL('/dashboard', req.url)
      redirectUrl.searchParams.set('required', requiredEntitlement)
      return redirectWithCookies(redirectUrl)
    }

    return res
  }

  if (!isAuthPath(pathname)) {
    const { data: profile } = await supabase
      .from('site_profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.onboarding_completed_at) {
      const redirectUrl = new URL('/signup', req.url)
      redirectUrl.searchParams.set('mode', 'complete')
      redirectUrl.searchParams.set('next', resolveLoginRedirectPath(pathname, req.nextUrl.search))
      return redirectWithCookies(redirectUrl)
    }
  }

  return res

  async function hasActiveSiteEntitlement(entitlement: SiteEntitlement, userId: string) {
    const { data: siteEntitlement } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('entitlement', entitlement)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (siteEntitlement) {
      return true
    }

    return false
  }

  async function hasApprovedLegacyEbusAccess(userId: string) {
    const { data: learnerProfile } = await supabase
      .from('learner_profiles')
      .select('approval_status')
      .eq('id', userId)
      .eq('approval_status', 'approved')
      .maybeSingle()

    return Boolean(learnerProfile)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
