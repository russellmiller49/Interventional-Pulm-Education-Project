import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { IcuHemodynamicsAssessLandingV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsAssessLandingV2'
import { HemodynamicCaseActivity } from '@/features/icu-hemodynamics/components/HemodynamicCaseActivity'
import { IcuHemodynamicsModuleFrameV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'

export const metadata: Metadata = {
  title: 'Challenge · ICU Hemodynamics Lab',
  description: 'Work through a harder ICU hemodynamics case with a full teaching debrief.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ start?: string | string[] }>
}

export default async function IcuHemodynamicsAssessPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const start = (await searchParams)?.start
  setRequestLocale(locale)
  if (start === '1') {
    return <HemodynamicCaseActivity caseId="HD-07" mode="challenge" locale={locale} />
  }
  return (
    <IcuHemodynamicsModuleFrameV2 activeHref={`${icuHemodynamicsNavBase}/assess`}>
      <IcuHemodynamicsAssessLandingV2 />
    </IcuHemodynamicsModuleFrameV2>
  )
}
