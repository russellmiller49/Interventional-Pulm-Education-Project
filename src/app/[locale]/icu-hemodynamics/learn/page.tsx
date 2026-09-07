import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { IcuHemodynamicsLearnLandingV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsLearnLandingV2'
import { IcuHemodynamicsModuleFrameV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2'
import { PacLearningPathwayActivity } from '@/features/icu-hemodynamics/components/PacLearningPathwayActivity'
import { isHemodynamicsSectionId } from '@/features/icu-hemodynamics/content/sectionSpecs'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'

export const metadata: Metadata = {
  title: 'Learn · ICU Hemodynamics Lab',
  description:
    'Nine guided sections on a running bedside monitor: the line, the four places the tip can sit, the wedge, flow, and the numbers made of numbers.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ activity?: string | string[] }>
}

export default async function IcuHemodynamicsLearnPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const activity = (await searchParams)?.activity
  setRequestLocale(locale)

  if (isHemodynamicsSectionId(activity)) {
    return <PacLearningPathwayActivity initialSectionId={activity} locale={locale} />
  }

  return (
    <IcuHemodynamicsModuleFrameV2 activeHref={`${icuHemodynamicsNavBase}/learn`}>
      <IcuHemodynamicsLearnLandingV2 />
    </IcuHemodynamicsModuleFrameV2>
  )
}
