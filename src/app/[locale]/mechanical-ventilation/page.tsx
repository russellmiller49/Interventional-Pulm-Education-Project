import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import MechanicalVentilationLab from '@/features/mechanical-ventilation/components/MechanicalVentilationLab'
import { mechanicalVentilationPublicationStatus } from '@/features/mechanical-ventilation/content/deviceProfiles'

export const metadata: Metadata = {
  title: 'Mechanical Ventilation Learn & Practice Simulator',
  description:
    mechanicalVentilationPublicationStatus === 'published'
      ? 'Case-based mechanical ventilation practice with selectable HAMILTON-C6, Dräger Evita, Puritan Bennett 980, and CareFusion AVEA training facsimiles.'
      : 'Draft-gated case-based mechanical ventilation practice with selectable HAMILTON-C6, Dräger Evita, Puritan Bennett 980, and CareFusion AVEA training facsimiles.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function MechanicalVentilationPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <MechanicalVentilationLab locale={locale} />
}
