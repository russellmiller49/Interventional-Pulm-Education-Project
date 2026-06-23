import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { PleuralFluidAnalysisNav } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisNav'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { pleuralAnalysisLessons } from '@/features/pleural-fluid-analysis/content/lessons'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pleuralFluidAnalysis.references' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

function referencedIds(): string[] {
  const ids = new Set<string>()
  for (const lesson of pleuralAnalysisLessons) {
    for (const statement of lesson.statements) {
      statement.referenceIds.forEach((id) => ids.add(id))
    }
  }
  return [...ids]
}

export default async function PleuralFluidAnalysisReferencesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralFluidAnalysis')
  const nav = await getTranslations('navigation')

  const ids = referencedIds()
  const references = pleuralReferences.filter((reference) => ids.includes(reference.id))

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('references.headerTitle')}
        description={t('references.headerDescription')}
      />
      <PleuralFluidAnalysisNav activeHref="/pleural-procedures/pleural-fluid-analysis/references" />

      <section className="container max-w-4xl">
        <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">{t('references.heading')}</h2>
          <ul className="mt-4 space-y-4 text-sm leading-6">
            {references.map((reference) => (
              <li key={reference.id} className="space-y-1">
                <p className="text-foreground">{reference.citation}</p>
                {reference.url ? (
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-700 underline decoration-sky-500/50 underline-offset-4 dark:text-sky-300"
                  >
                    {reference.url}
                  </a>
                ) : null}
                <p className="text-xs text-muted-foreground">{reference.useNote}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
