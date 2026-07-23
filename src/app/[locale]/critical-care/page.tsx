import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareHub } from '@/features/critical-care/components/CriticalCareHub'
import { CriticalCareRecoveryFallback } from '@/features/critical-care/components/CriticalCareRecoveryFallback'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { criticalCareFeatureFlags } from '@/features/critical-care/featureFlags'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Critical Care Learning Center',
  description:
    'An unlisted critical-care learning dashboard with exact resume, clinical pathways, and reviewed focused practice labs.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function CriticalCarePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const catalog = buildCriticalCarePublicClientCatalog()

  return (
    <HandoffContent>
      {criticalCareFeatureFlags.criticalCareDashboardV2 ? (
        <CriticalCareHub catalog={catalog} />
      ) : (
        <CriticalCareRecoveryFallback catalog={catalog} />
      )}
    </HandoffContent>
  )
}
