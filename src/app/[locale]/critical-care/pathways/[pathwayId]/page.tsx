import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCarePathwayDetail } from '@/features/critical-care/components/CriticalCarePathways'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

interface PageProps {
  params: Promise<{ locale: string; pathwayId: string }>
}

export function generateStaticParams() {
  return buildCriticalCarePublicClientCatalog().pathways.map((pathway) => ({
    pathwayId: pathway.id,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, pathwayId } = await params
  const pathway = buildCriticalCarePublicClientCatalog().pathways.find(
    (candidate) => candidate.id === pathwayId,
  )
  return localizeHandoffServerValue(locale, {
    title: pathway
      ? `${pathway.title} · Critical Care Learning Center`
      : 'Critical-care pathway not found',
    description: pathway?.description,
    robots: { index: false, follow: false, noarchive: true },
  })
}

export default async function CriticalCarePathwayPage({ params }: PageProps) {
  const { locale, pathwayId } = await params
  setRequestLocale(locale)
  const catalog = buildCriticalCarePublicClientCatalog()
  const pathway = catalog.pathways.find((candidate) => candidate.id === pathwayId)
  if (!pathway) notFound()

  return (
    <HandoffContent>
      <CriticalCarePathwayDetail catalog={catalog} pathway={pathway} />
    </HandoffContent>
  )
}
