import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCarePathwaysIndex } from '@/features/critical-care/components/CriticalCarePathways'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const metadata: Metadata = {
  title: 'Clinical Pathways · Critical Care Learning Center',
  description: 'Clinical learning pathways connecting focused critical-care labs.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, metadata)
}

export default async function CriticalCarePathwaysPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <HandoffContent>
      <CriticalCarePathwaysIndex catalog={buildCriticalCarePublicClientCatalog()} />
    </HandoffContent>
  )
}
