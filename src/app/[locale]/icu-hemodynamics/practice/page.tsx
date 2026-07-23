import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { HemodynamicCaseActivity } from '@/features/icu-hemodynamics/components/HemodynamicCaseActivity'
import { IcuHemodynamicsModuleFrameV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2'
import { IcuHemodynamicsPracticeLandingV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsPracticeLandingV2'
import { hemodynamicCaseById } from '@/features/icu-hemodynamics/content'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'

export const metadata: Metadata = {
  title: 'Practice · ICU Hemodynamics Lab',
  description:
    'Eight preserved ICU hemodynamics cases with PAC skills, waveforms, thermodilution, and reassessment.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ case?: string | string[] }>
}

export default async function IcuHemodynamicsPracticePage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const requestedCase = (await searchParams)?.case
  setRequestLocale(locale)
  if (typeof requestedCase === 'string' && hemodynamicCaseById.has(requestedCase)) {
    return <HemodynamicCaseActivity caseId={requestedCase} mode="practice" locale={locale} />
  }
  return (
    <IcuHemodynamicsModuleFrameV2 activeHref={`${icuHemodynamicsNavBase}/practice`}>
      <IcuHemodynamicsPracticeLandingV2 />
    </IcuHemodynamicsModuleFrameV2>
  )
}
