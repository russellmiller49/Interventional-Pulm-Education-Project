import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { formatPccmInstitution, type PccmInstitution } from '@/features/pccm-intro-course/types'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

interface PccmIntroCourseCohortAdminPageProps {
  params: Promise<{
    cohort: string
    locale: string
  }>
}

const cohortParams = {
  'loma-linda': 'loma_linda',
  loma_linda: 'loma_linda',
  ucsd: 'ucsd',
} as const satisfies Record<string, PccmInstitution>

export async function generateMetadata({
  params,
}: PccmIntroCourseCohortAdminPageProps): Promise<Metadata> {
  const { cohort, locale } = await params
  const institution = getInstitutionFromCohortParam(cohort)
  const title = institution
    ? `${formatPccmInstitution(institution)} PCCM Course Admin | Interventional Pulmonology Education`
    : 'PCCM Course Admin | Interventional Pulmonology Education'

  return localizeHandoffServerValue(locale, {
    title,
    robots: {
      follow: false,
      index: false,
    },
  })
}

export default async function PccmIntroCourseCohortAdminPage({
  params,
}: PccmIntroCourseCohortAdminPageProps) {
  const { cohort, locale } = await params
  const institution = getInstitutionFromCohortParam(cohort)

  if (!institution) {
    notFound()
  }

  redirect(`/${locale}/admin/pccm-intro-course?cohort=${institution}`)
}

function getInstitutionFromCohortParam(value: string) {
  return cohortParams[value as keyof typeof cohortParams] ?? null
}
