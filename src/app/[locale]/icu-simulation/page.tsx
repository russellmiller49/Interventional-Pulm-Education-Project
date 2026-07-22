import { setRequestLocale } from 'next-intl/server'

import { IcuSimulatorHub } from '@/features/icu-simulation/components'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function IcuSimulationPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return <IcuSimulatorHub locale={locale} />
}
