import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { PeripheralImagingModuleFrame } from '@/features/peripheral-imaging/components/PeripheralImagingModuleFrame'
import { PeripheralImagingPracticeLanding } from '@/features/peripheral-imaging/components/PeripheralImagingPracticeLanding'
import { PERIPHERAL_IMAGING_PRACTICE_HREF } from '@/features/peripheral-imaging/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Practice · Peripheral Bronchoscopy Imaging',
  description: 'Short imaging cases, one decision each, paired to the sections by mechanism.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function PeripheralImagingPracticePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <PeripheralImagingModuleFrame locale={locale} activeHref={PERIPHERAL_IMAGING_PRACTICE_HREF}>
      <PeripheralImagingPracticeLanding />
    </PeripheralImagingModuleFrame>
  )
}
