import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { PeripheralImagingAssessLanding } from '@/features/peripheral-imaging/components/PeripheralImagingAssessLanding'
import { PeripheralImagingModuleFrame } from '@/features/peripheral-imaging/components/PeripheralImagingModuleFrame'
import { PERIPHERAL_IMAGING_ASSESS_HREF } from '@/features/peripheral-imaging/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Assess · Peripheral Bronchoscopy Imaging',
  description:
    'Eight decisions in the bronch suite, made once, with every verdict opened together at the end.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function PeripheralImagingAssessPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <PeripheralImagingModuleFrame locale={locale} activeHref={PERIPHERAL_IMAGING_ASSESS_HREF}>
      <PeripheralImagingAssessLanding />
    </PeripheralImagingModuleFrame>
  )
}
