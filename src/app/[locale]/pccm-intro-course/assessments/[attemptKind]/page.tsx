import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { buildPccmAssessmentPreviewAttempt } from '@/features/pccm-intro-course/assessment'
import { PccmAssessmentClient } from '@/features/pccm-intro-course/components/PccmAssessmentClient'
import {
  loadActivePccmEnrollment,
  loadPccmCohortSettings,
  loadPccmIntroCourseAdminScope,
  pccmPosttestsUnlocked,
} from '@/features/pccm-intro-course/server'
import {
  formatPccmAssessmentKind,
  getPccmAssessmentPhase,
  isPccmAssessmentKind,
} from '@/features/pccm-intro-course/types'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { supabaseServer } from '@/lib/supabase/server'

interface PccmAssessmentPageProps {
  params: Promise<{
    attemptKind: string
    locale: string
  }>
}

export async function generateMetadata({ params }: PccmAssessmentPageProps): Promise<Metadata> {
  const { attemptKind, locale } = await params
  const title = isPccmAssessmentKind(attemptKind)
    ? `${formatPccmAssessmentKind(attemptKind)} | PCCM Intro Course`
    : 'PCCM Intro Course Assessment'

  return localizeHandoffServerValue(locale, {
    title,
    robots: {
      follow: false,
      index: false,
    },
  })
}

export default async function PccmAssessmentPage({ params }: PccmAssessmentPageProps) {
  const { attemptKind, locale } = await params
  setRequestLocale(locale)

  if (!isPccmAssessmentKind(attemptKind)) {
    notFound()
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/pccm-intro-course')
  }

  const [adminScope, enrollment] = await Promise.all([
    loadPccmIntroCourseAdminScope(supabase, user.id),
    loadActivePccmEnrollment(supabase, user.id),
  ])
  const adminPreview = adminScope.canAccessAll || adminScope.institutions.length > 0

  if (adminPreview) {
    return (
      <PccmAssessmentClient
        adminPreview
        attemptKind={attemptKind}
        initialAttempt={buildPccmAssessmentPreviewAttempt(attemptKind, user.id)}
      />
    )
  }

  if (getPccmAssessmentPhase(attemptKind) === 'post' && enrollment) {
    const cohortSettings = await loadPccmCohortSettings(supabase, enrollment.institution)

    if (!pccmPosttestsUnlocked(enrollment.institution, cohortSettings)) {
      redirect('/pccm-intro-course?gate=posttests')
    }
  }

  return <PccmAssessmentClient attemptKind={attemptKind} />
}
