import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { SocratesBuilder } from '@/features/socrates-builder/components/SocratesBuilder'
import { loadSocratesBuilderBootstrap } from '@/features/socrates-builder/server/data'

export const metadata: Metadata = {
  title: 'SOCRATES earlier saved slides',
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
    <>
      <header className="container space-y-2 py-6">
        <h1 className="text-2xl font-semibold">Earlier saved slides</h1>
        <p>
          These slides use the earlier save workflow. Keep any unfinished edits saved or exported
          here. New shared authoring is in the SOCRATES Library.
        </p>
        <a href={`/${locale}/socrates-library`}>Return to SOCRATES Library</a>
      </header>
      <SocratesBuilder
        access={bootstrap.access}
        initialDocuments={bootstrap.documents}
        sandboxCleanupDocuments={bootstrap.sandboxDocuments}
      />
    </>
  )
}
