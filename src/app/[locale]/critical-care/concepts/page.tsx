import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareConceptIndex } from '@/features/critical-care/components/CriticalCareConceptIndex'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Critical Care Concept Index',
  description:
    'Plain-language critical-care concepts connected to relevant device, physiology, and scenario activities.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function CriticalCareConceptsPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      <CriticalCareConceptIndex catalog={buildCriticalCarePublicClientCatalog()} />
    </HandoffContent>
  )
}
