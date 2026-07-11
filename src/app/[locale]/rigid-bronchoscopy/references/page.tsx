import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { RigidBronchoscopyNav } from '@/features/rigid-bronchoscopy/components/RigidBronchoscopyNav'
import { assemblySourceIds } from '@/features/rigid-bronchoscopy/content/assemblyParts'
import { ventilationSourceIds } from '@/features/rigid-bronchoscopy/content/assemblyVentilation'
import { airwayReferences } from '@/features/rigid-bronchoscopy/content/references'
import { rigidBronchoscopyLessons } from '@/features/rigid-bronchoscopy/content/lessons'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'rigidBronchoscopy.references' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

function referencedIds(): string[] {
  const ids = new Set<string>([...assemblySourceIds, ...ventilationSourceIds])
  for (const lesson of rigidBronchoscopyLessons) {
    for (const statement of lesson.statements) {
      statement.referenceIds.forEach((id) => ids.add(id))
    }
  }
  return [...ids]
}

export default async function RigidBronchoscopyReferencesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('rigidBronchoscopy')
  const nav = await getTranslations('navigation')

  const ids = referencedIds()
  const references = airwayReferences.filter((reference) => ids.includes(reference.id))

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.rigidBronchoscopy.title')}
            title={t('references.headerTitle')}
            description={t('references.headerDescription')}
            disclaimer={t('about.body')}
          />
          <RigidBronchoscopyNav activeHref="/rigid-bronchoscopy/references" />

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
      }
    </HandoffContent>
  )
}
