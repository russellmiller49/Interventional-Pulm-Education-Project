import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralFluidAnalysisNav } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisNav'
import { PleuralFluidAnalysisModule } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisModule'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pleuralFluidAnalysis.practice' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuralFluidAnalysisPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralFluidAnalysis')
  const nav = await getTranslations('navigation')

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('practice.headerTitle')}
        description={t('practice.headerDescription')}
      />
      <PleuralFluidAnalysisNav activeHref="/pleural-procedures/pleural-fluid-analysis/practice" />

      <PleuralFluidAnalysisModule />

      <ModuleProgressToggle
        moduleId="pleural-fluid-analysis"
        section="practice"
        label={t('practice.progressLabel')}
      />
    </div>
  )
}
