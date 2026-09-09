import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { PeripheralImagingModuleFrame } from '@/features/peripheral-imaging/components/PeripheralImagingModuleFrame'
import { ImagingCaseActivity } from '@/features/peripheral-imaging/components/ImagingCaseActivity'
import { PeripheralImagingPracticeLanding } from '@/features/peripheral-imaging/components/PeripheralImagingPracticeLanding'
import { imagingMicroCaseById } from '@/features/peripheral-imaging/content/microCases'
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

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ case?: string | string[] }>
}

export default async function PeripheralImagingPracticePage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const requested = (await searchParams)?.case
  const caseId = Array.isArray(requested) ? requested[0] : requested
  setRequestLocale(locale)

  if (caseId && imagingMicroCaseById.has(caseId)) {
    return (
      <PeripheralImagingModuleFrame locale={locale} activeHref={PERIPHERAL_IMAGING_PRACTICE_HREF}>
        <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
          <ImagingCaseActivity key={caseId} caseId={caseId} />
        </div>
      </PeripheralImagingModuleFrame>
    )
  }

  return (
    <PeripheralImagingModuleFrame locale={locale} activeHref={PERIPHERAL_IMAGING_PRACTICE_HREF}>
      <PeripheralImagingPracticeLanding />
    </PeripheralImagingModuleFrame>
  )
}
