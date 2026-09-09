import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { SocratesDemoWorkspace } from '@/features/socrates-demo/components/SocratesDemoWorkspace'
import { SocratesDemo } from '@/features/socrates-demo/components/SocratesDemo'

export const metadata: Metadata = {
  title: 'SOCRATES + Invenio Web Overlay Demo',
  description:
    'Invenio tissue and color images with zoom-based teaching overlays, browser draft saving, and JSON sharing.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ slide?: string }>
}

export default async function SocratesDemoPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const query = await searchParams
  // Preserve explicit published-slide links. The company demo itself never reads
  // or writes database content and cannot be replaced by an older saved draft.
  if (query?.slide) {
    const { loadPublishedSocratesDocument } =
      await import('@/features/socrates-builder/server/data')
    const published = await loadPublishedSocratesDocument(query.slide)
    if (published)
      return <SocratesDemo slide={published.slide} annotations={published.annotations} />
  }
  return <SocratesDemoWorkspace />
}
