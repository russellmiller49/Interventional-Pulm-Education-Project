import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareCasesLibrary } from '@/features/critical-care/components/CriticalCareCasesLibrary'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Cases · Critical Care Learning Center',
  description: 'Direct library of critical care practice cases and simulation assessments.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}

export default async function CriticalCareCasesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <HandoffContent>
      <CriticalCareCasesLibrary catalog={buildCriticalCarePublicClientCatalog()} />
    </HandoffContent>
  )
}
