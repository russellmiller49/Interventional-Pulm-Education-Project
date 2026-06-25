import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralInfectionNav } from '@/features/pleural-infection/components/PleuralInfectionNav'
import { PleuralInfectionWorkflow } from '@/features/pleural-infection/components/PleuralInfectionWorkflow'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'pleuralInfection.practice',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuralInfectionPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralInfection')
  const nav = await getTranslations('navigation')

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          {/* Disclaimer is rendered by the workflow's LessonScaffold, so suppress it here. */}
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('practice.headerTitle')}
            description={t('practice.headerDescription')}
            showDisclaimer={false}
          />
          <PleuralInfectionNav activeHref="/pleural-procedures/pleural-infection/practice" />

          <PleuralInfectionWorkflow />

          <ModuleProgressToggle
            moduleId="pleural-infection"
            section="practice"
            label={t('practice.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
