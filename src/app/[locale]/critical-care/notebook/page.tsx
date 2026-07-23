import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareNotebookView } from '@/features/critical-care/components/CriticalCareNotebookView'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Notebook · Critical Care Learning Center',
  description: 'Locally saved critical care reference and accessibility records.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}

export default async function CriticalCareNotebookPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <HandoffContent>
      <CriticalCareNotebookView catalog={buildCriticalCarePublicClientCatalog()} />
    </HandoffContent>
  )
}
