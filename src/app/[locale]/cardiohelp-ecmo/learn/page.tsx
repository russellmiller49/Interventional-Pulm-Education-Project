import type { Metadata, Route } from 'next'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { CardiohelpLearnLanding } from '@/features/cardiohelp-ecmo/components/CardiohelpLearnLanding'
import { CardiohelpModuleFrame } from '@/features/cardiohelp-ecmo/components/CardiohelpModuleFrame'
import { CardiohelpWorkbench } from '@/features/cardiohelp-ecmo/components/CardiohelpWorkbench'
import { EcmoFoundationLessonActivity } from '@/features/cardiohelp-ecmo/components/EcmoFoundationLessonActivity'
import { EcmoFoundationSectionView } from '@/features/cardiohelp-ecmo/components/EcmoFoundationSectionView'
import { isEcmoFoundationSectionId } from '@/features/cardiohelp-ecmo/content/foundationLessons'
import {
  ecmoFoundationSupportMode,
  isEcmoInteractiveFoundationSectionId,
} from '@/features/cardiohelp-ecmo/content/foundationLessonRuntime'
import type { SupportMode } from '@/features/cardiohelp-ecmo/engine/types'
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
  searchParams?: Promise<{ lesson?: string | string[]; track?: string | string[] }>
}

function requestedTrack(value: string | string[] | undefined): SupportMode {
  const track = Array.isArray(value) ? value[0] : value
  return track === 'va' ? 'va' : 'vv'
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
  setRequestLocale(locale)

  // Seven foundation sections open the live three-pane workspace: the four shared by both tracks
  // over whichever reference circuit is selected, and the three VV-only ones, which always run on
  // the VV reference. The three VA sections still render as prose until their own package lands,
  // and drill sections open the guided workbench.
  if (isEcmoInteractiveFoundationSectionId(lesson)) {
    const resolved = ecmoFoundationSupportMode(lesson, track)
    if (resolved !== track) {
      // A VV-only section asked for on the VA track. Canonicalize the URL rather than quietly
      // rendering VV teaching under a VA query, and never load the VA reference behind it. The
      // target is the same lesson with the resolved track, and the resolver is idempotent, so the
      // redirect lands on a request that renders rather than redirecting again. The locale prefix
      // is written explicitly because this app routes with `localePrefix: 'always'`.
      const resolvedLocale = isActiveLocale(locale) ? locale : defaultLocale
      redirect(
        `/${resolvedLocale}/cardiohelp-ecmo/learn?lesson=${lesson}&track=${resolved}` as Route,
      )
    }
    return (
      <CardiohelpModuleFrame locale={locale} activeHref={`${cardiohelpEcmoNavBase}/learn`}>
        <EcmoFoundationLessonActivity sectionId={lesson} supportMode={resolved} />
      </CardiohelpModuleFrame>
    )
  }

  if (isEcmoFoundationSectionId(lesson)) {
    return (
      <CardiohelpModuleFrame locale={locale} activeHref={`${cardiohelpEcmoNavBase}/learn`}>
        <EcmoFoundationSectionView sectionId={lesson} supportMode={track} />
      </CardiohelpModuleFrame>
    )
  }

  if (lesson === undefined) {
    return (
      <CardiohelpModuleFrame locale={locale} activeHref={`${cardiohelpEcmoNavBase}/learn`}>
        <CardiohelpLearnLanding supportMode={track} />
      </CardiohelpModuleFrame>
    )
  }

  return <CardiohelpWorkbench section="learn" locale={locale} />
}
