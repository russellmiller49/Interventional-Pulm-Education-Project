import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import HamiltonC6VentilationLab from '@/features/hamilton-c6-ventilation/components/HamiltonC6VentilationLab'
import { hamiltonC6PublicationStatus } from '@/features/hamilton-c6-ventilation/content/deviceProfile'

export const metadata: Metadata = {
  title: 'HAMILTON-C6 Mechanical Ventilation Learn & Practice Simulator',
  description:
    hamiltonC6PublicationStatus === 'published'
      ? 'Case-based mechanical ventilation practice with a functional HAMILTON-C6 training facsimile, real-time physiology, waveforms, bedside interventions, and reassessment.'
      : 'Draft-gated case-based mechanical ventilation practice with a functional HAMILTON-C6 training facsimile, real-time physiology, waveforms, bedside interventions, and reassessment.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function HamiltonC6VentilationPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HamiltonC6VentilationLab locale={locale} />
}
