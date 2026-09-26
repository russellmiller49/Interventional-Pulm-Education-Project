import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { ImagingIntegratedCaseActivity } from '@/features/peripheral-imaging/components/ImagingIntegratedCaseActivity'
import { PeripheralImagingIntegratedCasesLanding } from '@/features/peripheral-imaging/components/PeripheralImagingIntegratedCasesLanding'
import { PeripheralImagingModuleFrame } from '@/features/peripheral-imaging/components/PeripheralImagingModuleFrame'
import {
  imagingCaseById,
  LEGACY_INTEGRATED_CASE_ADDRESSES,
} from '@/features/peripheral-imaging/content/cases'
import { PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF } from '@/features/peripheral-imaging/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { defaultLocale, isActiveLocale } from '@/i18n/locale'
import { redirect } from '@/i18n/navigation'

/**
 * The address the Assess tab used. The capstone that lived here is retired (PI-01): old links and
 * bookmarks open the integrated cases, and `?case=` opens one of them directly. A case whose slot a
 * revised case now holds (OD4-05) redirects to it, so an old link still lands on that situation.
 */
const handoffMetadata: Metadata = {
  title: 'Integrated cases · Peripheral Bronchoscopy Imaging',
  description:
    'Eight integrated imaging cases in the bronchoscopy suite, open at any time, each with its explanation and a link to the section it draws on.',
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

export default async function PeripheralImagingIntegratedCasesPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params
  const requested = (await searchParams)?.case
  const caseId = Array.isArray(requested) ? requested[0] : requested
  setRequestLocale(locale)

  if (caseId && Object.hasOwn(LEGACY_INTEGRATED_CASE_ADDRESSES, caseId)) {
    redirect({
      href: {
        pathname: PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF,
        query: { case: LEGACY_INTEGRATED_CASE_ADDRESSES[caseId] },
      },
      locale: isActiveLocale(locale) ? locale : defaultLocale,
    })
  }

  if (caseId && imagingCaseById.has(caseId)) {
    return (
      <PeripheralImagingModuleFrame
        locale={locale}
        activeHref={PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF}
      >
        <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
          <ImagingIntegratedCaseActivity key={caseId} caseId={caseId} />
        </div>
      </PeripheralImagingModuleFrame>
    )
  }

  return (
    <PeripheralImagingModuleFrame
      locale={locale}
      activeHref={PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF}
    >
      <PeripheralImagingIntegratedCasesLanding unknownCase={caseId} />
    </PeripheralImagingModuleFrame>
  )
}
