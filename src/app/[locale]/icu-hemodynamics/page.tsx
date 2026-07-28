import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { IcuHemodynamicsModuleFrameV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2'
import { IcuHemodynamicsOverviewV2 } from '@/features/icu-hemodynamics/components/IcuHemodynamicsOverviewV2'
import { ICU_HEMODYNAMICS_RELEASE_STAGE } from '@/features/icu-hemodynamics/content'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'

export const metadata: Metadata = {
  title: 'ICU Hemodynamics Lab — PAC Skills and Shock Cases',
  description:
    ICU_HEMODYNAMICS_RELEASE_STAGE === 'unlisted-preview'
      ? 'Unlisted educational preview of a vendor-neutral ICU hemodynamics simulator with PAC skills, waveforms, thermodilution, derived values, and management cases.'
      : 'Vendor-neutral ICU hemodynamics simulator with PAC skills, waveforms, thermodilution, derived values, and management cases.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function IcuHemodynamicsPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <IcuHemodynamicsModuleFrameV2 activeHref={icuHemodynamicsNavBase}>
      <IcuHemodynamicsOverviewV2 />
    </IcuHemodynamicsModuleFrameV2>
  )
}
