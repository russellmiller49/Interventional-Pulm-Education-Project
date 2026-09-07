import type { Metadata, Route } from 'next'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import {
  criticalCareActivityPhases,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity/types'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import { McsLearnLanding } from '@/features/mechanical-circulatory-support/components/McsLearnLanding'
import { McsModuleFrame } from '@/features/mechanical-circulatory-support/components/McsModuleFrame'
import { McsStageHost } from '@/features/mechanical-circulatory-support/components/stage/McsStageHost'
import { mcsStageLessonIds } from '@/features/mechanical-circulatory-support/content/stageLessons'
import type { McsDeviceKind } from '@/features/mechanical-circulatory-support/engine'
import { mcsLessons } from '@/features/mechanical-circulatory-support/content/lessons'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { defaultLocale, isActiveLocale } from '@/i18n/locale'

const pageMetadata: Metadata = {
  title: 'Learn · Mechanical Circulatory Support ICU Lab',
  description:
    'An ordered nine-section MCS pathway: two shared foundations, three device pairs, and a cross-device selection capstone.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    device?: string | string[]
    lesson?: string | string[]
    phase?: string | string[]
  }>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function requestedDevice(value: string | string[] | undefined): McsDeviceKind | undefined {
  const device = firstValue(value)
  return device === 'iabp' || device === 'impella' || device === 'lvad' ? device : undefined
}

/**
 * The phase a section opens at. Carried by the URL and nowhere else; nothing about it is written
 * to stored progress. Absent, stale or malformed values open the section at its first step.
 */
function requestedPhase(value: string | string[] | undefined): CriticalCareActivityPhase {
  const phase = firstValue(value)
  return (criticalCareActivityPhases as readonly string[]).includes(phase ?? '')
    ? (phase as CriticalCareActivityPhase)
    : 'recognize'
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}

export default async function MechanicalCirculatorySupportLearnPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params
  const query = searchParams ? await searchParams : undefined
  const lesson = firstValue(query?.lesson)
  const device = requestedDevice(query?.device)
  setRequestLocale(locale)

  // A device track with no section named opens at the track's first section: the one door.
  if (!lesson && device) {
    const first = mcsLessons.find((candidate) => candidate.device === device)
    const resolvedLocale = isActiveLocale(locale) ? locale : defaultLocale
    if (first) {
      redirect(
        `/${resolvedLocale}${mechanicalCirculatorySupportNavBase}/learn?lesson=${first.id}` as Route,
      )
    }
  }

  if (lesson && mcsStageLessonIds.includes(lesson)) {
    // The stage renders its own module frame in activity mode, so nothing wraps it here.
    return (
      <McsStageHost
        sectionId={lesson}
        initialPhase={requestedPhase(query?.phase)}
        locale={locale}
      />
    )
  }

  return (
    <McsModuleFrame locale={locale} activeHref={`${mechanicalCirculatorySupportNavBase}/learn`}>
      <McsLearnLanding />
    </McsModuleFrame>
  )
}
