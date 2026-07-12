import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { AirwayStentLearningLab } from '@/features/airway-stent-mechanics/components/learning-lab/AirwayStentLearningLab'

export const metadata: Metadata = {
  title: 'Airway Stent Clinical Decision Lab: Indication, Architecture, Fit & Complications',
  description:
    'A case-based airway stent module for deciding whether a stent is indicated, defining its mechanical job, comparing architecture and fit, anticipating complications, and planning surveillance and exit. Optional physics scenes explain selected tradeoffs.',
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ lesson?: string | string[]; panel?: string | string[] }>
}

export default async function AirwayStentMechanicsPage({ params, searchParams }: PageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const requestedLessonId = Array.isArray(query.lesson) ? query.lesson[0] : query.lesson
  const requestedPanel = Array.isArray(query.panel) ? query.panel[0] : query.panel

  return (
    <AirwayStentLearningLab requestedLessonId={requestedLessonId} requestedPanel={requestedPanel} />
  )
}
