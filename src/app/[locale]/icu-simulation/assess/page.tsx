import { setRequestLocale } from 'next-intl/server'

import { IcuSimulatorLab } from '@/features/icu-simulation/components'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function IcuSimulationAssessPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return <IcuSimulatorLab mode="assess" locale={locale} />
}
