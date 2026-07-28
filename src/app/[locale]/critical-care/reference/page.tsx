import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareReferenceLibrary } from '@/features/critical-care/components/CriticalCareReferenceLibrary'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Reference · Critical Care Learning Center',
  description:
    'Searchable critical care waveform, formula, alarm, troubleshooting, safety, device, and model-limit records.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ item?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}

export default async function CriticalCareReferencePage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const selectedItem = (await searchParams)?.item
  setRequestLocale(locale)
  return (
    <HandoffContent>
      <CriticalCareReferenceLibrary
        catalog={buildCriticalCarePublicClientCatalog()}
        selectedItemId={typeof selectedItem === 'string' ? selectedItem : undefined}
      />
    </HandoffContent>
  )
}
