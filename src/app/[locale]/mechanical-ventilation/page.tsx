import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationHub } from '@/features/mechanical-ventilation/components/MechanicalVentilationHub'
import { mechanicalVentilationPublicationStatus } from '@/features/mechanical-ventilation/content/deviceProfiles'

export const metadata: Metadata = {
  title: 'Mechanical Ventilation Learn & Practice Simulator',
  description:
    mechanicalVentilationPublicationStatus === 'published'
      ? 'A guided mechanical ventilation pathway on a running simulated ventilator, with clinical cases and selectable HAMILTON-C6, Dräger Evita, Puritan Bennett 980, and CareFusion AVEA training facsimiles.'
      : mechanicalVentilationPublicationStatus === 'tester-preview'
        ? 'Unlisted tester preview of a guided mechanical ventilation pathway on a running simulated ventilator, with clinical cases and four training facsimiles.'
        : 'Draft-gated guided mechanical ventilation pathway on a running simulated ventilator, with clinical cases and four training facsimiles.',
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
  return <MechanicalVentilationHub locale={locale} />
}
