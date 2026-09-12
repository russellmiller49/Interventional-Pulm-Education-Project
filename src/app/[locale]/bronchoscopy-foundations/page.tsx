import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BronchoscopyFoundationsHub } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsHub'
import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { BRONCHOSCOPY_FOUNDATIONS_NAV_BASE } from '@/features/bronchoscopy-foundations/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Bronchoscopy Foundations',
  description:
    'A guided course in flexible bronchoscopy on one airway model: the shared airway, the scope and its five controls, orientation and view loss, the right and left airways, a systematic survey, sampling, deterioration and an honest report.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BronchoscopyFoundationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <BronchoscopyFoundationsModuleFrame
      locale={locale}
      activeHref={BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}
    >
      <BronchoscopyFoundationsHub />
    </BronchoscopyFoundationsModuleFrame>
  )
}
