import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationCourseCheck } from '@/features/mechanical-ventilation/components/MechanicalVentilationCourseCheck'
import { MechanicalVentilationLearnLanding } from '@/features/mechanical-ventilation/components/MechanicalVentilationLearnLanding'
import { MechanicalVentilationModuleFrame } from '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrame'
import { VentilationStageHost } from '@/features/mechanical-ventilation/components/stage/VentilationStageHost'
import { ventilationUnitById } from '@/features/mechanical-ventilation/content/learningCurriculum'

export const metadata: Metadata = {
  title: 'Learn · Mechanical Ventilation',
  description:
    'Fourteen guided sections on a running simulated ventilator: the breath, the controls, then one mechanism at a time with a prediction, a change, and a watched response.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ activity?: string | string[]; entry?: string | string[] }>
}

export default async function MechanicalVentilationLearnPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const query = await searchParams
  const activity = query?.activity
  const activityId = typeof activity === 'string' ? activity : undefined
  const unit = activityId ? ventilationUnitById.get(activityId) : undefined
  setRequestLocale(locale)

  if (unit) return <VentilationStageHost key={unit.id} unitId={unit.id} locale={locale} />
  if (query?.entry === 'placement' || query?.entry === 'review') {
    return (
      <MechanicalVentilationModuleFrame locale={locale} activeHref="/mechanical-ventilation/learn">
        <MechanicalVentilationCourseCheck kind={query.entry} />
      </MechanicalVentilationModuleFrame>
    )
  }

  return <MechanicalVentilationLearnLanding locale={locale} unknownActivity={activityId} />
}
