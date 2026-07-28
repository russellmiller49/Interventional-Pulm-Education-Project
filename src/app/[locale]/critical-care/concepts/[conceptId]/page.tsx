import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareConceptDetail } from '@/features/critical-care/components/CriticalCareConceptDetail'
import { criticalCareConceptById } from '@/features/critical-care/content/concepts'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

interface PageProps {
  params: Promise<{ locale: string; conceptId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, conceptId } = await params
  const concept = criticalCareConceptById.get(conceptId)
  if (!concept) return {}
  return localizeHandoffServerValue(locale, {
    title: `${concept.title} · Critical Care Concepts`,
    description: concept.shortExplanation,
    robots: { index: false, follow: false, noarchive: true },
  })
}

export default async function CriticalCareConceptPage({ params }: PageProps) {
  const { locale, conceptId } = await params
  setRequestLocale(locale)
  const concept = criticalCareConceptById.get(conceptId)
  if (!concept) notFound()

  return (
    <HandoffContent>
      <CriticalCareConceptDetail
        concept={concept}
        catalog={buildCriticalCarePublicClientCatalog()}
      />
    </HandoffContent>
  )
}
