import { setRequestLocale } from 'next-intl/server'

import { IcuSimulatorLab } from '@/features/icu-simulation/components'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function IcuSimulationPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return <IcuSimulatorLab mode="practice" locale={locale} />
}
