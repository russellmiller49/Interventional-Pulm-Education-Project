import { setRequestLocale } from 'next-intl/server'

import {
  IcuLearnLanding,
  IcuSimulatorLab,
  IcuWorkspaceOrientation,
} from '@/features/icu-simulation/components'
import { ICU_WORKSPACE_ORIENTATION_ID } from '@/features/icu-simulation/content'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ activity?: string | string[] }>
}

export default async function IcuSimulationLearnPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const query = await searchParams
  const activity = Array.isArray(query?.activity) ? query?.activity[0] : query?.activity
  setRequestLocale(locale)

  // Section one is the authored orientation; without a section the route shows the pathway
  // landing rather than dropping the learner into the coached simulator.
  if (activity === ICU_WORKSPACE_ORIENTATION_ID) return <IcuWorkspaceOrientation />
  if (activity === undefined) return <IcuLearnLanding />

  return <IcuSimulatorLab mode="learn" locale={locale} />
}
