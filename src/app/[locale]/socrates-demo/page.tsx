import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { SocratesDemoWorkspace } from '@/features/socrates-demo/components/SocratesDemoWorkspace'
import {
  loadPublishedSocratesDocument,
  loadSocratesSandboxDocuments,
} from '@/features/socrates-builder/server/data'

export const metadata: Metadata = {
  title: 'SOCRATES Deep-Slide Demo and Sandbox Builder',
  description:
    'Unlisted functional demonstration and disposable builder for live deep-zoom pathology imagery with illustrative annotations.',
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
  const [publishedDocument, sandboxDocuments] = await Promise.all([
    loadPublishedSocratesDocument(query?.slide),
    loadSocratesSandboxDocuments(),
  ])

  return (
    <SocratesDemoWorkspace
      publishedDocument={publishedDocument}
      sandboxDocuments={sandboxDocuments}
    />
  )
}
