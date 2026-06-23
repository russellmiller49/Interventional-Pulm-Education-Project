import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralInfectionNav } from '@/features/pleural-infection/components/PleuralInfectionNav'
import {
  getInfectionCoreBlocks,
  getInfectionGoDeeperBlocks,
  infectionBoardSectionIds,
  infectionBoardSlug,
} from '@/features/pleural-infection/content/learnContent'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pleuralInfection.learn' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuralInfectionLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralInfection')
  const nav = await getTranslations('navigation')

  const boardSections = getBoardSections(infectionBoardSlug, infectionBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('learn.headerTitle')}
        description={t('learn.headerDescription')}
      />
      <PleuralInfectionNav activeHref="/pleural-procedures/pleural-infection/learn" />

      <LearnSection
        intro={<p>{t('learn.intro')}</p>}
        coreBlocks={getInfectionCoreBlocks(locale)}
        goDeeperBlocks={getInfectionGoDeeperBlocks(locale)}
        boardSections={boardSections}
        boardSourceLabel={t('learn.boardSourceLabel')}
      />

      <ModuleProgressToggle
        moduleId="pleural-infection"
        section="learn"
        label={t('learn.progressLabel')}
      />
    </div>
  )
}
