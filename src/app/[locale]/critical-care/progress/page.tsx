import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareProgressView } from '@/features/critical-care/components/CriticalCareProgressView'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Progress · Critical Care Learning Center',
  description: 'Merged activity, module, and pathway progress across critical care learning labs.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}

export default async function CriticalCareProgressPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <HandoffContent>
      <CriticalCareProgressView catalog={buildCriticalCarePublicClientCatalog()} />
    </HandoffContent>
  )
}
