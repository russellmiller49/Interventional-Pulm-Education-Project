import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { BronchoscopyFoundationsReference } from '@/features/bronchoscopy-foundations/components/reference/BronchoscopyFoundationsReference'
import { BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF } from '@/features/bronchoscopy-foundations/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Reference · Bronchoscopy Foundations',
  description:
    'The airway names, the airway spine, the five controls, the view-reading table, the local policies this course leaves to your institution, and the sources.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BronchoscopyFoundationsReferencePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <BronchoscopyFoundationsModuleFrame
      locale={locale}
      activeHref={BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF}
    >
      <BronchoscopyFoundationsReference />
    </BronchoscopyFoundationsModuleFrame>
  )
}
