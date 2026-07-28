import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationModuleFrameV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrameV2'
import { MechanicalVentilationOverviewV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationOverviewV2'
import { mechanicalVentilationPublicationStatus } from '@/features/mechanical-ventilation/content/deviceProfiles'

export const metadata: Metadata = {
  title: 'Mechanical Ventilation Learn & Practice Simulator',
  description:
    mechanicalVentilationPublicationStatus === 'published'
      ? 'Case-based mechanical ventilation practice with selectable HAMILTON-C6, Dräger Evita, Puritan Bennett 980, and CareFusion AVEA training facsimiles.'
      : mechanicalVentilationPublicationStatus === 'tester-preview'
        ? 'Unlisted tester preview for case-based mechanical ventilation practice with selectable HAMILTON-C6, Dräger Evita, Puritan Bennett 980, and CareFusion AVEA training facsimiles.'
        : 'Draft-gated case-based mechanical ventilation practice with selectable HAMILTON-C6, Dräger Evita, Puritan Bennett 980, and CareFusion AVEA training facsimiles.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function MechanicalVentilationPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <MechanicalVentilationModuleFrameV2 activeHref="/mechanical-ventilation">
      <MechanicalVentilationOverviewV2 />
    </MechanicalVentilationModuleFrameV2>
  )
}
