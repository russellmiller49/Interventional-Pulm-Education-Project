import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { PccmAssessmentClient } from '@/features/pccm-intro-course/components/PccmAssessmentClient'
import { formatPccmAssessmentKind, isPccmAssessmentKind } from '@/features/pccm-intro-course/types'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

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

  return <PccmAssessmentClient attemptKind={attemptKind} />
}
