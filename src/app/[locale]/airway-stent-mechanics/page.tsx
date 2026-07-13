import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { StentMechanicsExplorer } from '@/features/airway-stent-mechanics/components/explorer/StentMechanicsExplorer'
import { resolveExplorerStationRequest } from '@/features/airway-stent-mechanics/explorer/routing'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Airway Stent Mechanics & Failure Explorer',
  description:
    'A freely navigable, case-grounded 3D explorer for airway-stent lumen, motion, fit, migration, obstruction, granulation, tumor ingrowth, fracture, Y-stent behavior, deployment, and rescue concepts.',
}

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    lesson?: string | string[]
    panel?: string | string[]
    station?: string | string[]
  }>
}

export default async function AirwayStentMechanicsPage({ params, searchParams }: PageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const requestedLessonId = Array.isArray(query.lesson) ? query.lesson[0] : query.lesson
  const requestedPanel = Array.isArray(query.panel) ? query.panel[0] : query.panel
  const requestedStationId = Array.isArray(query.station) ? query.station[0] : query.station
  const initialStationId = resolveExplorerStationRequest({
    lesson: requestedLessonId,
    panel: requestedPanel,
    station: requestedStationId,
  })

  return <StentMechanicsExplorer initialStationId={initialStationId} />
}
