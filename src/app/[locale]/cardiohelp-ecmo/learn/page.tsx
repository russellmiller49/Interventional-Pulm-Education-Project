import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CardiohelpLearnLanding } from '@/features/cardiohelp-ecmo/components/CardiohelpLearnLanding'
import { CardiohelpModuleFrame } from '@/features/cardiohelp-ecmo/components/CardiohelpModuleFrame'
import { CardiohelpWorkbench } from '@/features/cardiohelp-ecmo/components/CardiohelpWorkbench'
import { EcmoFoundationLessonActivity } from '@/features/cardiohelp-ecmo/components/EcmoFoundationLessonActivity'
import { EcmoFoundationSectionView } from '@/features/cardiohelp-ecmo/components/EcmoFoundationSectionView'
import { isEcmoFoundationSectionId } from '@/features/cardiohelp-ecmo/content/foundationLessons'
import { isEcmoSharedFoundationSectionId } from '@/features/cardiohelp-ecmo/content/foundationLessonRuntime'
import type { SupportMode } from '@/features/cardiohelp-ecmo/engine/types'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

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

  // The four track-shared foundation sections now open a live three-pane workspace over a
  // reference circuit. The six track-specific foundation sections still render as prose until
  // their own packages land, and drill sections open the guided workbench.
  if (isEcmoSharedFoundationSectionId(lesson)) {
    return (
      <CardiohelpModuleFrame locale={locale} activeHref={`${cardiohelpEcmoNavBase}/learn`}>
        <EcmoFoundationLessonActivity sectionId={lesson} supportMode={track} />
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
