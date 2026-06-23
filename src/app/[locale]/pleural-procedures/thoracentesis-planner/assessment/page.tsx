import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { ThoracentesisNav } from '@/features/thoracentesis-planner/components/ThoracentesisNav'
import { getThoracentesisQuizQuestions } from '@/features/thoracentesis-planner/content/quizItems'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'thoracentesisPlanner.assessment' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function ThoracentesisAssessmentPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('thoracentesisPlanner')
  const nav = await getTranslations('navigation')

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('assessment.headerTitle')}
        description={t('assessment.headerDescription')}
      />
      <ThoracentesisNav activeHref="/pleural-procedures/thoracentesis-planner/assessment" />

      <AssessSection
        title={t('assessment.checkTitle')}
        intro={t('assessment.checkIntro')}
        questions={getThoracentesisQuizQuestions(locale)}
      />

      <ModuleProgressToggle
        moduleId="thoracentesis-planner"
        section="assessment"
        label={t('assessment.progressLabel')}
      />
    </div>
  )
}
