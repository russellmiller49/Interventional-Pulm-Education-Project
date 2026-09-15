import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BronchoscopyFoundationsAssessLanding } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsAssessLanding'
import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF } from '@/features/bronchoscopy-foundations/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Integrated cases · Bronchoscopy Foundations',
  description:
    'Eight bronchoscopy cases on one airway model that bring the sections together, with explanations available before and after answering.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BronchoscopyFoundationsAssessPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <BronchoscopyFoundationsModuleFrame
      locale={locale}
      activeHref={BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF}
    >
      <BronchoscopyFoundationsAssessLanding />
    </BronchoscopyFoundationsModuleFrame>
  )
}
