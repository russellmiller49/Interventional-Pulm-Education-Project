import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { PleuralUltrasoundNav } from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { publicPleuralUltrasoundAssets } from '@/features/pleural-ultrasound/content/assets'
import { pleuralUltrasoundLessons } from '@/features/pleural-ultrasound/content/lessons'
import { publicPleuralUltrasoundVideoAssets } from '@/features/pleural-ultrasound/content/videoAssets'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'pleuralUltrasound.references',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

function referencedIds(): string[] {
  const ids = new Set<string>()
  for (const lesson of pleuralUltrasoundLessons) {
    for (const statement of lesson.statements) {
      statement.referenceIds.forEach((id) => ids.add(id))
    }
  }
  for (const asset of publicPleuralUltrasoundAssets) {
    asset.referenceIds?.forEach((id) => ids.add(id))
  }
  for (const asset of publicPleuralUltrasoundVideoAssets) {
    asset.referenceIds?.forEach((id) => ids.add(id))
  }
  return [...ids]
}

export default async function PleuralUltrasoundReferencesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralUltrasound')
  const nav = await getTranslations('navigation')

  const ids = referencedIds()
  const references = pleuralReferences.filter((reference) => ids.includes(reference.id))

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('references.headerTitle')}
            description={t('references.headerDescription')}
          />
          <PleuralUltrasoundNav activeHref="/pleural-procedures/pleural-ultrasound/references" />

          <section className="container max-w-4xl space-y-6">
            <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">
                {t('references.clinicalHeading')}
              </h2>
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

            <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">
                {t('references.imageHeading')}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('references.imageNote')}</p>
              <ul className="mt-4 space-y-4 text-sm leading-6">
                {publicPleuralUltrasoundAssets.map((asset) => (
                  <li key={asset.id} className="space-y-1">
                    <p className="text-foreground">{asset.attribution}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.license}
                      {' · '}
                      <a
                        href={asset.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-sky-500/50 underline-offset-4"
                      >
                        {t('references.sourceLink')}
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">
                {t('references.videoHeading')}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('references.videoNote')}</p>
              <ul className="mt-4 space-y-4 text-sm leading-6">
                {publicPleuralUltrasoundVideoAssets.map((asset) => (
                  <li key={asset.id} className="space-y-1">
                    <p className="text-foreground">{asset.attribution}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.license}
                      {' · '}
                      <a
                        href={asset.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-sky-500/50 underline-offset-4"
                      >
                        {t('references.sourceClipLink')}
                      </a>
                      {' · '}
                      <a
                        href={asset.sourceMetadataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-sky-500/50 underline-offset-4"
                      >
                        {t('references.metadataLink')}
                      </a>
                      {asset.convertedToMp4 ? t('references.convertedNote') : ''}
                    </p>
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
