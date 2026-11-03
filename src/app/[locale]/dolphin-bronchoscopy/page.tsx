import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { DolphinHub } from '@/features/dolphin-bronchoscopy/components/DolphinHub'
import { DolphinModuleFrame } from '@/features/dolphin-bronchoscopy/components/DolphinModuleFrame'
import { DOLPHIN_BRONCHOSCOPY_NAV_BASE } from '@/features/dolphin-bronchoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Dolphin Bronchoscopy',
  description:
    'A self-paced module for veterinarians on bottlenose dolphin bronchoscopy: the airway map, the plan, passing the laryngeal spout, the survey and record, sampling and complications.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function DolphinBronchoscopyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <DolphinModuleFrame locale={locale} activeHref={DOLPHIN_BRONCHOSCOPY_NAV_BASE}>
      <DolphinHub />
    </DolphinModuleFrame>
  )
}
