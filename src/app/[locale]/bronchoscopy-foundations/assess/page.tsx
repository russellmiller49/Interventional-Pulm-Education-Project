import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BronchoscopyFoundationsAssessLanding } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsAssessLanding'
import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF } from '@/features/bronchoscopy-foundations/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Assess · Bronchoscopy Foundations',
  description:
    'Eight bronchoscopy decisions on one airway model, made once, with the reasoning and the standard read at the end.',
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
