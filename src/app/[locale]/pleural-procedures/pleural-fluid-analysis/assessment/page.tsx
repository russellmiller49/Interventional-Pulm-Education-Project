import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralFluidAnalysisNav } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisNav'
import { PleuralAnalysisQuiz } from '@/features/pleural-fluid-analysis/components/PleuralAnalysisQuiz'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pleuralFluidAnalysis.assessment' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuralFluidAnalysisAssessmentPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralFluidAnalysis')
  const nav = await getTranslations('navigation')

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('assessment.headerTitle')}
        description={t('assessment.headerDescription')}
      />
      <PleuralFluidAnalysisNav activeHref="/pleural-procedures/pleural-fluid-analysis/assessment" />

      <PleuralAnalysisQuiz />

      <ModuleProgressToggle
        moduleId="pleural-fluid-analysis"
        section="assessment"
        label={t('assessment.progressLabel')}
      />
    </div>
  )
}
