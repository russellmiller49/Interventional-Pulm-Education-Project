import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BronchCaseActivity } from '@/features/bronchoscopy-foundations/components/BronchCaseActivity'
import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { BronchoscopyFoundationsPracticeLanding } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsPracticeLanding'
import { bronchMicroCaseById } from '@/features/bronchoscopy-foundations/content/microCases'
import { BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF } from '@/features/bronchoscopy-foundations/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Practice · Bronchoscopy Foundations',
  description: 'Short bronchoscopy cases, one decision each, paired to the sections by idea.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ case?: string | string[] }>
}

export default async function BronchoscopyFoundationsPracticePage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params
  const requested = (await searchParams)?.case
  const caseId = Array.isArray(requested) ? requested[0] : requested
  setRequestLocale(locale)

  if (caseId && bronchMicroCaseById.has(caseId)) {
    return (
      <BronchoscopyFoundationsModuleFrame
        locale={locale}
        activeHref={BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF}
      >
        <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
          <BronchCaseActivity key={caseId} caseId={caseId} />
        </div>
      </BronchoscopyFoundationsModuleFrame>
    )
  }

  return (
    <BronchoscopyFoundationsModuleFrame
      locale={locale}
      activeHref={BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF}
    >
      <BronchoscopyFoundationsPracticeLanding />
    </BronchoscopyFoundationsModuleFrame>
  )
}
