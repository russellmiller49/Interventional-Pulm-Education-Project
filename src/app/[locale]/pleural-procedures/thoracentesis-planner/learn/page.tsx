import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { ThoracentesisNav } from '@/features/thoracentesis-planner/components/ThoracentesisNav'
import {
  getThoracentesisCoreBlocks,
  getThoracentesisGoDeeperBlocks,
  thoracentesisBoardSectionIds,
  thoracentesisBoardSlug,
} from '@/features/thoracentesis-planner/content/learnContent'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'thoracentesisPlanner.learn' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function ThoracentesisLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('thoracentesisPlanner')
  const nav = await getTranslations('navigation')

  const boardSections = getBoardSections(thoracentesisBoardSlug, thoracentesisBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('learn.headerTitle')}
        description={t('learn.headerDescription')}
      />
      <ThoracentesisNav activeHref="/pleural-procedures/thoracentesis-planner/learn" />

      <LearnSection
        intro={<p>{t('learn.intro')}</p>}
        coreBlocks={getThoracentesisCoreBlocks(locale)}
        goDeeperBlocks={getThoracentesisGoDeeperBlocks(locale)}
        boardSections={boardSections}
        boardSourceLabel={t('learn.boardSourceLabel')}
      />

      <ModuleProgressToggle
        moduleId="thoracentesis-planner"
        section="learn"
        label={t('learn.progressLabel')}
      />
    </div>
  )
}
