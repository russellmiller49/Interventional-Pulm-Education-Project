import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PneumothoraxNav } from '@/features/pneumothorax-pathway/components/PneumothoraxNav'
import { getPneumothoraxQuizQuestions } from '@/features/pneumothorax-pathway/content/quizItems'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pneumothoraxPathway.assessment' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PneumothoraxAssessmentPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pneumothoraxPathway')
  const nav = await getTranslations('navigation')

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('assessment.headerTitle')}
        description={t('assessment.headerDescription')}
      />
      <PneumothoraxNav activeHref="/pleural-procedures/pneumothorax-pathway/assessment" />

      <AssessSection
        title={t('assessment.checkTitle')}
        intro={t('assessment.checkIntro')}
        questions={getPneumothoraxQuizQuestions(locale)}
      />

      <ModuleProgressToggle
        moduleId="pneumothorax-pathway"
        section="assessment"
        label={t('assessment.progressLabel')}
      />
    </div>
  )
}
