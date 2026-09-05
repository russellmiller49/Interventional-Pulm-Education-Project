import type { Metadata, Route } from 'next'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { CardiohelpLearnLanding } from '@/features/cardiohelp-ecmo/components/CardiohelpLearnLanding'
import { CardiohelpModuleFrame } from '@/features/cardiohelp-ecmo/components/CardiohelpModuleFrame'
import { CardiohelpWorkbench } from '@/features/cardiohelp-ecmo/components/CardiohelpWorkbench'
import { EcmoFoundationLessonActivity } from '@/features/cardiohelp-ecmo/components/EcmoFoundationLessonActivity'
import {
  ecmoFoundationSupportMode,
  isEcmoInteractiveFoundationSectionId,
} from '@/features/cardiohelp-ecmo/content/foundationLessonRuntime'
import type { SupportMode } from '@/features/cardiohelp-ecmo/engine/types'
import {
  criticalCareActivityPhases,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity/types'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { defaultLocale, isActiveLocale } from '@/i18n/locale'

const handoffMetadata: Metadata = {
  title: 'Learn · ECMO Management · CARDIOHELP console lab',
  description:
    'An ordered ECMO pathway per support mode: shared physiology and circuit foundations, the track normal state, console orientation, the failure patterns, and an integration capstone.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    lesson?: string | string[]
    track?: string | string[]
    phase?: string | string[]
  }>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function requestedTrack(value: string | string[] | undefined): SupportMode {
  return firstValue(value) === 'va' ? 'va' : 'vv'
}

/**
 * The phase a foundation lesson opens at.
 *
 * Carried by the URL and nowhere else. Nothing about the phase is written to stored progress: no
 * storage key, DTO, adapter, or payload version is involved, and `ProgressV2` is untouched. That
 * keeps the resume pointer schema exactly as it was while still letting a reload, a bookmark, or a
 * link land on the phase the learner was reading.
 *
 * Absent, stale, or malformed values open the lesson at its first phase, which is what every
 * lesson did before this parameter existed.
 */
const defaultLessonPhase: CriticalCareActivityPhase = 'recognize'

function requestedPhase(value: string | string[] | undefined): CriticalCareActivityPhase {
  const phase = firstValue(value)
  return (criticalCareActivityPhases as readonly string[]).includes(phase ?? '')
    ? (phase as CriticalCareActivityPhase)
    : defaultLessonPhase
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function CardiohelpEcmoLearnPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const query = await searchParams
  const lesson = Array.isArray(query?.lesson) ? query?.lesson[0] : query?.lesson
  const track = requestedTrack(query?.track)
  const phase = requestedPhase(query?.phase)
  setRequestLocale(locale)

  // Ten foundation sections open the live three-pane workspace: the four shared by both tracks over
  // whichever reference circuit is selected, the three VV-only ones, which always run on the VV
  // reference, and the three VA-only ones, which always run on the VA reference. Drill sections
  // open the guided workbench.
  if (isEcmoInteractiveFoundationSectionId(lesson)) {
    const resolved = ecmoFoundationSupportMode(lesson, track)
    // A phase parameter is only canonicalized when one was actually supplied. Adding it to every
    // plain lesson URL would redirect links that were already correct.
    const suppliedPhase = firstValue(query?.phase)
    const phaseIsCanonical = suppliedPhase === undefined || suppliedPhase === phase
    if (resolved !== track || !phaseIsCanonical) {
      // A VV-only section asked for on the VA track, or a stale phase value. Canonicalize the URL
      // rather than quietly rendering VV teaching under a VA query, and never load the VA
      // reference behind it. Both resolvers are idempotent, so the redirect lands on a request
      // that renders rather than redirecting again, and one redirect fixes both parameters. The
      // locale prefix is written explicitly because this app routes with `localePrefix: 'always'`.
      const resolvedLocale = isActiveLocale(locale) ? locale : defaultLocale
      const phaseQuery = suppliedPhase === undefined ? '' : `&phase=${phase}`
      redirect(
        `/${resolvedLocale}/cardiohelp-ecmo/learn?lesson=${lesson}&track=${resolved}${phaseQuery}` as Route,
      )
    }
    // The stage renders its own module frame in activity mode, so nothing wraps it here.
    return (
      <EcmoFoundationLessonActivity
        sectionId={lesson}
        supportMode={resolved}
        initialPhase={phase}
        locale={locale}
      />
    )
  }

  // There is deliberately no second foundation branch here. Every authored foundation section is
  // also an interactive one — `ecmoInteractiveFoundationSectionIds` is the concatenation of the
  // shared, VV-only and VA-only lists, and `ecmoFoundationSections` is a frozen literal of the same
  // ten ids — so the block above always returns for a foundation id. A static read-only view used
  // to sit here for the three VA sections; it became unreachable when those moved to the live
  // workspace, and `routes.test.tsx` now pins the id-set identity that keeps it that way.

  if (lesson === undefined) {
    return (
      <CardiohelpModuleFrame locale={locale} activeHref={`${cardiohelpEcmoNavBase}/learn`}>
        <CardiohelpLearnLanding supportMode={track} />
      </CardiohelpModuleFrame>
    )
  }

  return <CardiohelpWorkbench section="learn" locale={locale} />
}
