import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BronchoscopyFoundationsLearnLanding } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsLearnLanding'
import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { BronchStageHost } from '@/features/bronchoscopy-foundations/components/stage/BronchStageHost'
import { isBronchSectionId } from '@/features/bronchoscopy-foundations/content/pathway'
import { BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF } from '@/features/bronchoscopy-foundations/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Learn · Bronchoscopy Foundations',
  description:
    'Guided sections on one airway model, in the order a procedure runs: prepare, handle, orient, enter, survey, describe, sample, respond, close.',
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

export default async function BronchoscopyFoundationsLearnPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params
  const requested = (await searchParams)?.section
  const section = Array.isArray(requested) ? requested[0] : requested
  setRequestLocale(locale)

  // The stage host carries its own module frame in activity mode.
  if (isBronchSectionId(section)) {
    return <BronchStageHost key={section} sectionId={section} locale={locale} />
  }

  return (
    <BronchoscopyFoundationsModuleFrame
      locale={locale}
      activeHref={BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF}
    >
      <BronchoscopyFoundationsLearnLanding unknownSection={section} />
    </BronchoscopyFoundationsModuleFrame>
  )
}
