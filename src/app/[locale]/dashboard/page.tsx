import type { Route } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { PccmCodeRedeemForm } from '@/features/pccm-intro-course/components/PccmCodeRedeemForm'
import {
  loadActivePccmEnrollment,
  loadPccmIntroCourseAdminScope,
} from '@/features/pccm-intro-course/server'
import {
  formatPccmInstitution,
  pccmInstitutions,
  type PccmInstitution,
} from '@/features/pccm-intro-course/types'
import { supabaseServer } from '@/lib/supabase/server'
import { HandoffContent } from '@/i18n/handoff'

interface DashboardPageProps {
  params: Promise<{
    locale: string
  }>
  searchParams?: Promise<{
    required?: string
  }>
}

const requiredAccessLabelKeys: Record<
  string,
  'ipRegistry' | 'pccmIntroCourse' | 'socalEbusCourse'
> = {
  ip_registry: 'ipRegistry',
  pccm_intro_course: 'pccmIntroCourse',
  socal_ebus_course: 'socalEbusCourse',
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('dashboard')
  const query = await searchParams
  const requiredAccess = query?.required
    ? t(`requiredAccess.${requiredAccessLabelKeys[query.required] ?? 'fallback'}`)
    : null
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [pccmAdminScope, pccmEnrollment] = user
    ? await Promise.all([
        loadPccmIntroCourseAdminScope(supabase, user.id),
        loadActivePccmEnrollment(supabase, user.id),
      ])
    : [null, null]
  const pccmAdminLinks = getPccmAdminDashboardLinks(pccmAdminScope)
  const hasPersistentPccmCourseAccess =
    Boolean(pccmEnrollment) ||
    Boolean(pccmAdminScope?.canAccessAll || pccmAdminScope?.institutions.length)

  return (
    <HandoffContent>
      {
        <div className="container mx-auto flex min-h-[60vh] flex-col justify-center gap-6 pb-16 pt-24">
          <div className="max-w-2xl space-y-4">
            <h1 className="text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
            <p className="text-muted-foreground">
              {user
                ? t('signedInAs', {
                    email: user.email ?? t('authenticatedUser'),
                  })
                : t('sessionNotDetected')}
            </p>
            {requiredAccess ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
                {t('permissionRequired', { access: requiredAccess })}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link
                href={'/resources' as Route}
                className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t('exploreResources')}
              </Link>
              <Link
                href={'/coming-soon' as Route}
                className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t('seeComingSoon')}
              </Link>
            </div>
          </div>
          {pccmAdminLinks.length > 0 ? (
            <section className="max-w-2xl rounded-lg border bg-card p-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">PCCM course admin dashboards</h2>
                  <p className="text-sm text-muted-foreground">
                    Review learner progress, pretests, posttests, videos, and shared module activity
                    for your assigned cohort.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pccmAdminLinks.map((link) => (
                    <Link
                      className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      href={link.href as Route}
                      key={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          {pccmEnrollment ? (
            <section className="max-w-2xl rounded-lg border bg-card p-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">PCCM intro course access saved</h2>
                  <p className="text-sm text-muted-foreground">
                    Your {formatPccmInstitution(pccmEnrollment.institution)} course access is linked
                    to this account for future sessions.
                  </p>
                </div>
                <Link
                  className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href={'/pccm-intro-course' as Route}
                >
                  Continue course
                </Link>
              </div>
            </section>
          ) : null}
          {user && !hasPersistentPccmCourseAccess ? <PccmCodeRedeemForm /> : null}
        </div>
      }
    </HandoffContent>
  )
}

function getPccmAdminDashboardLinks(
  scope: Awaited<ReturnType<typeof loadPccmIntroCourseAdminScope>> | null,
) {
  if (!scope || (!scope.canAccessAll && scope.institutions.length === 0)) {
    return []
  }

  const institutions = scope.canAccessAll ? [...pccmInstitutions] : scope.institutions
  const links = institutions.map((institution) => ({
    href: getPccmCohortDashboardHref(institution),
    label: `${formatPccmInstitution(institution)} admin dashboard`,
  }))

  return scope.canAccessAll
    ? [{ href: '/admin/pccm-intro-course', label: 'All PCCM cohorts' }, ...links]
    : links
}

function getPccmCohortDashboardHref(institution: PccmInstitution) {
  return `/admin/pccm-intro-course/${institution === 'loma_linda' ? 'loma-linda' : 'ucsd'}`
}
