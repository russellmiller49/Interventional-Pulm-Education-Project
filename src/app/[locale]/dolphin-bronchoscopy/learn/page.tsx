import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { DolphinLearnLanding } from '@/features/dolphin-bronchoscopy/components/DolphinLearnLanding'
import { DolphinModuleFrame } from '@/features/dolphin-bronchoscopy/components/DolphinModuleFrame'
import { DolphinStageHost } from '@/features/dolphin-bronchoscopy/components/stage/DolphinStageHost'
import { isDolphinSectionId } from '@/features/dolphin-bronchoscopy/content/pathway'
import { DOLPHIN_LEARN_HREF } from '@/features/dolphin-bronchoscopy/content/routes'
import { isAuthoredDolphinSection } from '@/features/dolphin-bronchoscopy/content/sections'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Learn · Dolphin Bronchoscopy',
  description:
    'Sections from the blowhole to recovery: the dolphin airway, the numbered branches, the plan, the procedure, sampling and complications.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ section?: string | string[] }>
}

export default async function DolphinLearnPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const requested = (await searchParams)?.section
  const section = Array.isArray(requested) ? requested[0] : requested
  setRequestLocale(locale)

  // The stage host carries its own module frame in activity mode.
  if (isDolphinSectionId(section) && isAuthoredDolphinSection(section)) {
    return <DolphinStageHost key={section} sectionId={section} locale={locale} />
  }

  return (
    <DolphinModuleFrame locale={locale} activeHref={DOLPHIN_LEARN_HREF}>
      <DolphinLearnLanding unknownSection={section} />
    </DolphinModuleFrame>
  )
}
