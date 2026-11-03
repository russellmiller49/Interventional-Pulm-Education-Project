import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { DolphinModuleFrame } from '@/features/dolphin-bronchoscopy/components/DolphinModuleFrame'
import { DolphinReference } from '@/features/dolphin-bronchoscopy/components/reference/DolphinReference'
import { DOLPHIN_REFERENCE_HREF } from '@/features/dolphin-bronchoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Reference · Dolphin Bronchoscopy',
  description:
    'The dolphin branch map, the bronchoscopy record, the five decisions, first moves for complications, every number with its source, and the sources.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function DolphinReferencePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <DolphinModuleFrame locale={locale} activeHref={DOLPHIN_REFERENCE_HREF}>
      <DolphinReference />
    </DolphinModuleFrame>
  )
}
