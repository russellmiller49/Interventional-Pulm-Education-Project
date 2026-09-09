import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { PeripheralImagingHub } from '@/features/peripheral-imaging/components/PeripheralImagingHub'
import { PeripheralImagingModuleFrame } from '@/features/peripheral-imaging/components/PeripheralImagingModuleFrame'
import { PERIPHERAL_IMAGING_NAV_BASE } from '@/features/peripheral-imaging/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Peripheral Bronchoscopy Imaging',
  description:
    'A guided course on one imaging suite: 2D fluoroscopy, digital tomosynthesis, fixed and mobile cone-beam CT, radial EBUS, tool confirmation and radiation protection in peripheral bronchoscopy.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function PeripheralImagingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <PeripheralImagingModuleFrame locale={locale} activeHref={PERIPHERAL_IMAGING_NAV_BASE}>
      <PeripheralImagingHub />
    </PeripheralImagingModuleFrame>
  )
}
