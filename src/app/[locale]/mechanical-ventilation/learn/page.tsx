import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationLearnLandingV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationLearnLandingV2'
import { MechanicalVentilationLearningActivity } from '@/features/mechanical-ventilation/components/MechanicalVentilationLearningActivity'
import { MechanicalVentilationCourseCheck } from '@/features/mechanical-ventilation/components/MechanicalVentilationCourseCheck'
import { MechanicalVentilationModuleFrameV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrameV2'
import { ventilationUnitById } from '@/features/mechanical-ventilation/content/learningCurriculum'

export const metadata: Metadata = {
  title: 'Learn · Mechanical Ventilation',
  description:
    'Focused guided lessons in ventilator mechanics, modes, waveforms, timing, dyssynchrony, gas exchange, and safety.',
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

  if (unit)
    return <MechanicalVentilationLearningActivity key={unit.id} unit={unit} locale={locale} />
  if (query?.entry === 'placement' || query?.entry === 'review') {
    return <MechanicalVentilationCourseCheck kind={query.entry} />
  }

  return (
    <MechanicalVentilationModuleFrameV2 activeHref="/mechanical-ventilation/learn">
      {activityId ? (
        <div
          className="mx-auto mt-8 w-[min(72rem,calc(100%-2rem))] rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
          role="status"
        >
          <strong>Unknown lesson.</strong> Choose a unit from the learning path below.
        </div>
      ) : null}
      <MechanicalVentilationLearnLandingV2 />
    </MechanicalVentilationModuleFrameV2>
  )
}
