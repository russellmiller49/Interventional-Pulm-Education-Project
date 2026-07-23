import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationLearnLandingV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationLearnLandingV2'
import { MechanicalVentilationLessonActivity } from '@/features/mechanical-ventilation/components/MechanicalVentilationLessonActivity'
import { MechanicalVentilationModuleFrameV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrameV2'
import { mechanicalVentilationLessonById } from '@/features/mechanical-ventilation/content'

export const metadata: Metadata = {
  title: 'Learn · Mechanical Ventilation',
  description:
    'Focused guided lessons in ventilator mechanics, modes, waveforms, timing, dyssynchrony, gas exchange, and safety.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ activity?: string | string[] }>
}

export default async function MechanicalVentilationLearnPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const activity = (await searchParams)?.activity
  const activityId = typeof activity === 'string' ? activity : undefined
  const lesson = activityId ? mechanicalVentilationLessonById.get(activityId) : undefined
  setRequestLocale(locale)

  if (lesson) return <MechanicalVentilationLessonActivity lesson={lesson} locale={locale} />

  return (
    <MechanicalVentilationModuleFrameV2 activeHref="/mechanical-ventilation/learn">
      {activityId ? (
        <div
          className="mx-auto mt-8 w-[min(72rem,calc(100%-2rem))] rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
          role="status"
        >
          <strong>Unknown lesson.</strong> The requested activity is not in this reviewed content
          version. Choose one of the focused lessons below.
        </div>
      ) : null}
      <MechanicalVentilationLearnLandingV2 />
    </MechanicalVentilationModuleFrameV2>
  )
}
