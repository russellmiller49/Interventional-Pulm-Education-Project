import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { ThoracentesisNav } from '@/features/thoracentesis-planner/components/ThoracentesisNav'
import { ThoracentesisPlanner } from '@/features/thoracentesis-planner/components/ThoracentesisPlanner'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'thoracentesisPlanner.practice',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function ThoracentesisPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('thoracentesisPlanner')
  const nav = await getTranslations('navigation')

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          {/* Disclaimer is rendered by the planner's LessonScaffold, so suppress it here. */}
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('practice.headerTitle')}
            description={t('practice.headerDescription')}
            showDisclaimer={false}
          />
          <ThoracentesisNav activeHref="/pleural-procedures/thoracentesis-planner/practice" />

          <ThoracentesisPlanner />

          <ModuleProgressToggle
            moduleId="thoracentesis-planner"
            section="practice"
            label={t('practice.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
