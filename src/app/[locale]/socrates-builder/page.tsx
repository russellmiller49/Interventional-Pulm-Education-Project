import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { SocratesBuilder } from '@/features/socrates-builder/components/SocratesBuilder'
import { loadSocratesBuilderBootstrap } from '@/features/socrates-builder/server/data'

export const metadata: Metadata = {
  title: 'SOCRATES Slide Builder',
  description: 'Protected authoring workspace for Invenio deep-zoom slides and annotations.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function SocratesBuilderPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const bootstrap = await loadSocratesBuilderBootstrap()

  return (
    <SocratesBuilder
      access={bootstrap.access}
      initialDocuments={bootstrap.documents}
      sandboxCleanupDocuments={bootstrap.sandboxDocuments}
    />
  )
}
