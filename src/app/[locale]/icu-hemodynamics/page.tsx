import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import IcuHemodynamicsLab from '@/features/icu-hemodynamics/components/IcuHemodynamicsLab'
import { ICU_HEMODYNAMICS_RELEASE_STAGE } from '@/features/icu-hemodynamics/content'

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
  return <IcuHemodynamicsLab locale={locale} />
}
