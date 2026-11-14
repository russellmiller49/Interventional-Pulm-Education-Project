import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BronchImageBank } from '@/features/bronchoscopy-foundations/components/BronchImageBank'
import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { IMAGE_BANK_SETS } from '@/features/bronchoscopy-foundations/content/imageBank'
import { BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF } from '@/features/bronchoscopy-foundations/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Image bank · Bronchoscopy Foundations',
  description:
    'Stills from both lungs, upright and rotated. Read where the scope is, then click the opening.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ set?: string | string[] }>
}

export default async function BronchoscopyFoundationsImageBankPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params
  const requested = (await searchParams)?.set
  const named = Number(Array.isArray(requested) ? requested[0] : requested)
  // An unknown or missing set opens the first one.
  const set = Number.isInteger(named) && named >= 1 && named <= IMAGE_BANK_SETS.length ? named : 1
  setRequestLocale(locale)

  return (
    <BronchoscopyFoundationsModuleFrame
      locale={locale}
      activeHref={BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF}
    >
      <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <BronchImageBank key={set} set={set} />
      </div>
    </BronchoscopyFoundationsModuleFrame>
  )
}
