import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { AirwayStentLearningLab } from '@/features/airway-stent-mechanics/components/learning-lab/AirwayStentLearningLab'

export const metadata: Metadata = {
  title: 'Airway Stent Learning Lab: Architecture, Mechanics & Clinical Tradeoffs',
  description:
    'An airway stent learning lab where learners begin with a guided Force Lab and later return for case-based practice connecting topology, qualitative mechanics, tissue interaction, evidence literacy, and clinical tradeoffs.',
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ lesson?: string | string[] }>
}

export default async function AirwayStentMechanicsPage({ params, searchParams }: PageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const requestedLessonId = Array.isArray(query.lesson) ? query.lesson[0] : query.lesson

  return <AirwayStentLearningLab requestedLessonId={requestedLessonId} />
}
