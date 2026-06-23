import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralFluidAnalysisNav } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisNav'
import {
  fluidBoardSectionIds,
  fluidBoardSlug,
  getFluidCoreBlocks,
  getFluidGoDeeperBlocks,
} from '@/features/pleural-fluid-analysis/content/learnContent'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pleuralFluidAnalysis.learn' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuralFluidAnalysisLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralFluidAnalysis')
  const nav = await getTranslations('navigation')

  const boardSections = getBoardSections(fluidBoardSlug, fluidBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('learn.headerTitle')}
        description={t('learn.headerDescription')}
      />
      <PleuralFluidAnalysisNav activeHref="/pleural-procedures/pleural-fluid-analysis/learn" />

      <LearnSection
        intro={<p>{t('learn.intro')}</p>}
        coreBlocks={getFluidCoreBlocks(locale)}
        goDeeperBlocks={getFluidGoDeeperBlocks(locale)}
        boardSections={boardSections}
        boardSourceLabel={t('learn.boardSourceLabel')}
      />

      <ModuleProgressToggle
        moduleId="pleural-fluid-analysis"
        section="learn"
        label={t('learn.progressLabel')}
      />
    </div>
  )
}
