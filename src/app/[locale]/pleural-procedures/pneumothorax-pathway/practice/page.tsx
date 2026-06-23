import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PneumothoraxNav } from '@/features/pneumothorax-pathway/components/PneumothoraxNav'
import { PneumothoraxPathway } from '@/features/pneumothorax-pathway/components/PneumothoraxPathway'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pneumothoraxPathway.practice' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PneumothoraxPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pneumothoraxPathway')
  const nav = await getTranslations('navigation')

  return (
    <div className="space-y-10 py-16">
      {/* Disclaimer is rendered by the pathway's LessonScaffold, so suppress it here. */}
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('practice.headerTitle')}
        description={t('practice.headerDescription')}
        showDisclaimer={false}
      />
      <PneumothoraxNav activeHref="/pleural-procedures/pneumothorax-pathway/practice" />

      <PneumothoraxPathway />

      <ModuleProgressToggle
        moduleId="pneumothorax-pathway"
        section="practice"
        label={t('practice.progressLabel')}
      />
    </div>
  )
}
