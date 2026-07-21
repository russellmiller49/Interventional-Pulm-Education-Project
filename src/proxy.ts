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
  isPublicUnlistedPath,
  isPublicTrainingEmbed,
  isPccmIntroCourseAdminDashboardPath,
  isPccmIntroCourseSharedModulePath,
  resolveLoginRedirectPath,
  type SiteEntitlement,
} from '@/lib/site-auth/access'
import {
  defaultLocale,
  getLocaleFromAcceptLanguage,
  isActiveLocale,
  localeCookieName,
} from '@/i18n/locale'
import { localizePath, pathShouldBypassLocaleRedirect, stripLocalePrefix } from '@/i18n/path'
import {
  hasValidLocalDevAuthCookie,
  LOCAL_DEV_AUTH_COOKIE_NAME,
} from '@/lib/site-auth/local-dev-auth'

const pccmIntroCourseAdminEntitlements: SiteEntitlement[] = [
  'pccm_intro_course_admin_ucsd',
  'pccm_intro_course_admin_loma_linda',
]

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  const originalPathname = req.nextUrl.pathname
  const localePath = stripLocalePrefix(originalPathname)
  const locale = localePath.locale
  const pathname = localePath.pathname
  const localizedPathname = locale ? originalPathname : pathname

  if (!locale && !pathShouldBypassLocaleRedirect(originalPathname)) {
    const requestedLocale = req.cookies.get(localeCookieName)?.value
    const nextLocale = isActiveLocale(requestedLocale)
      ? requestedLocale
      : getLocaleFromAcceptLanguage(req.headers.get('accept-language'))
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = localizePath(originalPathname, nextLocale)
    return NextResponse.redirect(redirectUrl)
  }

  if (locale) {
    res.cookies.set(localeCookieName, locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    })
  }

  if (process.env.NODE_ENV === 'production' && isCtAlignmentSandboxPath(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  if (pathname.startsWith('/auth')) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  if (isPublicUnlistedPath(pathname)) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
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
    const redirectUrl = new URL(localizePath('/login', locale ?? defaultLocale), req.url)
    redirectUrl.searchParams.set(
      'next',
      resolveLoginRedirectPath(localizedPathname, req.nextUrl.search),
    )
    return redirectWithCookies(redirectUrl)
  }

  const requiredEntitlement = getRequiredEntitlement(pathname, req.nextUrl.searchParams)
  const hasLegacyEbusAccess =
    canUseLegacyEbusApproval(pathname, req.nextUrl.searchParams) &&
    (await hasApprovedLegacyEbusAccess(user.id))

  if (!user.email_confirmed_at && !hasLegacyEbusAccess) {
    const redirectUrl = new URL(localizePath('/verify-email', locale ?? defaultLocale), req.url)
    return redirectWithCookies(redirectUrl)
  }

  if (requiredEntitlement) {
    let hasAccess =
      (await hasActiveSiteEntitlement(requiredEntitlement, user.id)) || hasLegacyEbusAccess

    if (!hasAccess && requiredEntitlement === 'pccm_intro_course') {
      hasAccess =
        (await hasActiveSiteEntitlement('site_admin', user.id)) ||
        (await hasAnyActiveSiteEntitlement(pccmIntroCourseAdminEntitlements, user.id)) ||
        Boolean(await getActivePccmIntroCourseEnrollment(user.id))
    }

    if (!hasAccess && requiredEntitlement === 'socrates_editor') {
      hasAccess = await hasActiveSiteEntitlement('site_admin', user.id)
    }

    if (
      !hasAccess &&
      requiredEntitlement === 'site_admin' &&
      isPccmIntroCourseAdminDashboardPath(pathname)
    ) {
      hasAccess = await hasAnyActiveSiteEntitlement(pccmIntroCourseAdminEntitlements, user.id)
    }

    if (!hasAccess) {
      const redirectUrl = new URL(localizePath('/dashboard', locale ?? defaultLocale), req.url)
      redirectUrl.searchParams.set('required', requiredEntitlement)
      return redirectWithCookies(redirectUrl)
    }

    return res
  }

  if (
    isPccmIntroCourseSharedModulePath(pathname) &&
    !(await hasActiveSiteEntitlement('site_admin', user.id)) &&
    !(await hasAnyActiveSiteEntitlement(pccmIntroCourseAdminEntitlements, user.id))
  ) {
    const pccmEnrollment = await getActivePccmIntroCourseEnrollment(user.id)

    if (
      pccmEnrollment?.institution === 'loma_linda' &&
      !(await hasSubmittedBothPccmIntroPretests(user.id))
    ) {
      const redirectUrl = new URL(
        localizePath('/pccm-intro-course', locale ?? defaultLocale),
        req.url,
      )
      redirectUrl.searchParams.set('gate', 'pretests')
      return redirectWithCookies(redirectUrl)
    }
  }

  if (!isAuthPath(pathname)) {
    const { data: profile } = await supabase
      .from('site_profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.onboarding_completed_at) {
      const redirectUrl = new URL(localizePath('/signup', locale ?? defaultLocale), req.url)
      redirectUrl.searchParams.set('mode', 'complete')
      redirectUrl.searchParams.set(
        'next',
        resolveLoginRedirectPath(localizedPathname, req.nextUrl.search),
      )
      return redirectWithCookies(redirectUrl)
    }
  }

  return res

  async function hasActiveSiteEntitlement(entitlement: SiteEntitlement, userId: string) {
    const now = new Date().toISOString()
    const { data: siteEntitlement } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('entitlement', entitlement)
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .maybeSingle()

    if (siteEntitlement) {
      return true
    }

    return false
  }

  async function hasAnyActiveSiteEntitlement(entitlements: SiteEntitlement[], userId: string) {
    if (entitlements.length === 0) {
      return false
    }

    const now = new Date().toISOString()
    const { data: siteEntitlement } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('entitlement', entitlements)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .limit(1)
      .maybeSingle()

    return Boolean(siteEntitlement)
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

  async function getActivePccmIntroCourseEnrollment(userId: string) {
    const { data: enrollment } = await supabase
      .from('pccm_intro_course_enrollments')
      .select('institution')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    return enrollment as { institution: string } | null
  }

  async function hasSubmittedBothPccmIntroPretests(userId: string) {
    const { data: attempts } = await supabase
      .from('pccm_intro_course_assessment_attempts')
      .select('attempt_kind,submitted_at')
      .eq('user_id', userId)
      .in('attempt_kind', ['bronchoscopy_pre', 'pleural_pre'])
      .not('submitted_at', 'is', null)

    const submittedKinds = new Set((attempts ?? []).map((attempt) => attempt.attempt_kind))
    return submittedKinds.has('bronchoscopy_pre') && submittedKinds.has('pleural_pre')
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
