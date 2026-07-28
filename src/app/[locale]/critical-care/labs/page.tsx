import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareLabsLibrary } from '@/features/critical-care/components/CriticalCareLabsLibrary'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Labs · Critical Care Learning Center',
  description: 'Direct access to focused draft and preview critical care laboratories.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}

export default async function CriticalCareLabsPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <HandoffContent>
      <CriticalCareLabsLibrary catalog={buildCriticalCarePublicClientCatalog()} />
    </HandoffContent>
  )
}
