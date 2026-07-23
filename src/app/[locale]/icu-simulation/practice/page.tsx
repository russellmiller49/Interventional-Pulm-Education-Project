import { setRequestLocale } from 'next-intl/server'

import { IcuCapstoneEntry } from '@/features/icu-simulation/components'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ case?: string | string[] }>
}

export default async function IcuSimulationPracticePage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const query = await searchParams
  const requestedScenarioId = Array.isArray(query?.case) ? query?.case[0] : query?.case
  setRequestLocale(locale)

  return (
    <IcuCapstoneEntry mode="practice" locale={locale} requestedScenarioId={requestedScenarioId} />
  )
}
