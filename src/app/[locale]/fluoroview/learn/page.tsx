import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { PeripheralImagingLearnLanding } from '@/features/peripheral-imaging/components/PeripheralImagingLearnLanding'
import { PeripheralImagingModuleFrame } from '@/features/peripheral-imaging/components/PeripheralImagingModuleFrame'
import { ImagingStageHost } from '@/features/peripheral-imaging/components/stage/ImagingStageHost'
import { isImagingSectionId } from '@/features/peripheral-imaging/content/pathway'
import { PERIPHERAL_IMAGING_LEARN_HREF } from '@/features/peripheral-imaging/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Learn · Peripheral Bronchoscopy Imaging',
  description:
    'Guided sections on one imaging suite: the six-stop chain from the X-ray tube to the decision, the five things you can change, and each technology as a different way of using the chain.',
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

export default async function FluoroViewLearnPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const requested = (await searchParams)?.section
  const section = Array.isArray(requested) ? requested[0] : requested
  setRequestLocale(locale)

  // The stage host carries its own module frame in activity mode.
  if (isImagingSectionId(section)) {
    return <ImagingStageHost key={section} sectionId={section} locale={locale} />
  }

  return (
    <PeripheralImagingModuleFrame locale={locale} activeHref={PERIPHERAL_IMAGING_LEARN_HREF}>
      <PeripheralImagingLearnLanding unknownSection={section} />
    </PeripheralImagingModuleFrame>
  )
}
