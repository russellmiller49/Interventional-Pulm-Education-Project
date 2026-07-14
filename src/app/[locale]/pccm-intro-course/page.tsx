import type { Metadata } from 'next'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { PccmIntroCourseDashboard } from '@/features/pccm-intro-course/components/PccmIntroCourseDashboard'
import {
  loadActivePccmEnrollment,
  loadPccmIntroCourseAdminScope,
  loadPccmAssessmentAttempts,
  loadPccmCohortSettings,
  loadPccmVideoProgress,
  pccmCourseContentUnlocked,
  pccmPosttestsUnlocked,
} from '@/features/pccm-intro-course/server'
import {
  formatPccmInstitution,
  type PccmEnrollment,
  type PccmInstitution,
} from '@/features/pccm-intro-course/types'
import { Link } from '@/i18n/navigation'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { supabaseServer } from '@/lib/supabase/server'

const handoffMetadata: Metadata = {
  title: 'PCCM Intro Course | Interventional Pulmonology Education',
  robots: {
    follow: false,
    index: false,
  },
}

interface PccmIntroCoursePageProps {
  params: Promise<{
    locale: string
  }>
  searchParams?: Promise<{
    gate?: string
  }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function PccmIntroCoursePage({
  params,
  searchParams,
}: PccmIntroCoursePageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/pccm-intro-course' as Route)
  }

  const [adminScope, enrollment] = await Promise.all([
    loadPccmIntroCourseAdminScope(supabase, user.id),
    loadActivePccmEnrollment(supabase, user.id),
  ])
  const adminMode = adminScope.canAccessAll || adminScope.institutions.length > 0

  if (!enrollment && !adminMode) {
    return (
      <main className="container flex min-h-[60vh] flex-col justify-center gap-4 py-10">
        <h1 className="text-3xl font-semibold">PCCM intro course enrollment needed</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your account has PCCM intro course access but no active institution enrollment was found.
          Redeem your UCSD or Loma Linda course code from the dashboard.
        </p>
        <Button asChild className="w-fit" variant="outline">
          <Link href={'/dashboard' as Route}>Go to dashboard</Link>
        </Button>
      </main>
    )
  }

  const [attempts, cohortSettings, videoProgress, query] = await Promise.all([
    loadPccmAssessmentAttempts(supabase, user.id),
    enrollment ? loadPccmCohortSettings(supabase, enrollment.institution) : null,
    loadPccmVideoProgress(supabase, user.id),
    searchParams,
  ])
  const dashboardEnrollment =
    enrollment ?? buildAdminPreviewEnrollment(user.id, adminScope.institutions[0] ?? 'ucsd')
  const videoScope = resolveAdminVideoScope(adminScope.institutions, adminScope.canAccessAll)
  const videosUnlocked =
    adminMode || pccmCourseContentUnlocked(dashboardEnrollment.institution, attempts)
  const posttestsUnlocked =
    adminMode || pccmPosttestsUnlocked(dashboardEnrollment.institution, cohortSettings)
  const gateMessage = adminMode
    ? undefined
    : query?.gate === 'posttests'
      ? 'Loma Linda posttests remain locked until the course administrator releases them after course completion.'
      : query?.gate === 'pretests'
        ? 'Loma Linda participants must submit both Bronchoscopy and Pleural pretests before opening shared modules or videos.'
        : !videosUnlocked && dashboardEnrollment.institution === 'loma_linda'
          ? 'Submit both pretests to unlock videos and shared module links.'
          : undefined

  return (
    <PccmIntroCourseDashboard
      adminMode={adminMode}
      attempts={attempts}
      enrollment={dashboardEnrollment}
      gateMessage={gateMessage}
      posttestsUnlocked={posttestsUnlocked}
      previewLabel={
        adminMode
          ? formatAdminPreviewLabel(adminScope.institutions, adminScope.canAccessAll)
          : undefined
      }
      videoProgress={videoProgress}
      videoScope={adminMode ? videoScope : undefined}
      videosUnlocked={videosUnlocked}
    />
  )
}

function buildAdminPreviewEnrollment(userId: string, institution: PccmInstitution): PccmEnrollment {
  return {
    enrolled_at: new Date(0).toISOString(),
    id: 'admin-preview',
    institution,
    status: 'active',
    user_id: userId,
  }
}

function resolveAdminVideoScope(institutions: PccmInstitution[], canAccessAll: boolean) {
  if (canAccessAll || institutions.length > 1) {
    return 'all' as const
  }

  return institutions[0] ?? 'ucsd'
}

function formatAdminPreviewLabel(institutions: PccmInstitution[], canAccessAll: boolean) {
  if (canAccessAll || institutions.length > 1) {
    return 'All cohorts'
  }

  return formatPccmInstitution(institutions[0] ?? 'ucsd')
}
