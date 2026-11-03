import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { DolphinIntegratedCaseActivity } from '@/features/dolphin-bronchoscopy/components/assess/DolphinIntegratedCaseActivity'
import { DolphinIntegratedCasesLanding } from '@/features/dolphin-bronchoscopy/components/assess/DolphinIntegratedCasesLanding'
import { DolphinModuleFrame } from '@/features/dolphin-bronchoscopy/components/DolphinModuleFrame'
import { dolphinIntegratedCaseById } from '@/features/dolphin-bronchoscopy/content/integratedCases'
import { DOLPHIN_ASSESS_HREF } from '@/features/dolphin-bronchoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Integrated cases · Dolphin Bronchoscopy',
  description:
    'Dolphin bronchoscopy cases that combine the sections, frame by frame, each with its debrief at the end.',
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

export default async function DolphinAssessPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const requested = (await searchParams)?.case
  const caseId = Array.isArray(requested) ? requested[0] : requested
  setRequestLocale(locale)

  return (
    <DolphinModuleFrame locale={locale} activeHref={DOLPHIN_ASSESS_HREF}>
      {caseId && dolphinIntegratedCaseById.has(caseId) ? (
        <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
          <DolphinIntegratedCaseActivity key={caseId} caseId={caseId} />
        </div>
      ) : (
        <DolphinIntegratedCasesLanding unknownCase={caseId} />
      )}
    </DolphinModuleFrame>
  )
}
