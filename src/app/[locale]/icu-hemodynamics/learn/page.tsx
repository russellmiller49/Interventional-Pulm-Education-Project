import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { IcuHemodynamicsLearnLandingV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsLearnLandingV2'
import { IcuHemodynamicsModuleFrameV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2'
import { PacGuidedSkillActivity } from '@/features/icu-hemodynamics/components/PacGuidedSkillActivity'
import { PacSignalValidationActivity } from '@/features/icu-hemodynamics/components/PacSignalValidationActivity'
import { pacGuidedSkillIds, type PacGuidedSkillId } from '@/features/icu-hemodynamics/content'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'

export const metadata: Metadata = {
  title: 'Learn · ICU Hemodynamics Lab',
  description:
    'Guided PAC signal-validation learning using the preserved deterministic hemodynamics engine.',
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

  if (activity === 'pac-signal-validation') {
    return <PacSignalValidationActivity locale={locale} />
  }
  if (typeof activity === 'string' && (pacGuidedSkillIds as readonly string[]).includes(activity)) {
    return <PacGuidedSkillActivity skillId={activity as PacGuidedSkillId} locale={locale} />
  }

  return (
    <IcuHemodynamicsModuleFrameV2 activeHref={`${icuHemodynamicsNavBase}/learn`}>
      <IcuHemodynamicsLearnLandingV2 />
    </IcuHemodynamicsModuleFrameV2>
  )
}
