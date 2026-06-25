import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PneumothoraxNav } from '@/features/pneumothorax-pathway/components/PneumothoraxNav'
import {
  getPneumothoraxCoreBlocks,
  getPneumothoraxGoDeeperBlocks,
  pneumothoraxBoardSectionIds,
  pneumothoraxBoardSlug,
} from '@/features/pneumothorax-pathway/content/learnContent'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'pneumothoraxPathway.learn',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PneumothoraxLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pneumothoraxPathway')
  const nav = await getTranslations('navigation')

  const boardSections = getBoardSections(pneumothoraxBoardSlug, pneumothoraxBoardSectionIds)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('learn.headerTitle')}
            description={t('learn.headerDescription')}
          />
          <PneumothoraxNav activeHref="/pleural-procedures/pneumothorax-pathway/learn" />

          <LearnSection
            intro={<p>{t('learn.intro')}</p>}
            coreBlocks={getPneumothoraxCoreBlocks(locale)}
            goDeeperBlocks={getPneumothoraxGoDeeperBlocks(locale)}
            boardSections={boardSections}
            boardSourceLabel={t('learn.boardSourceLabel')}
          />

          <ModuleProgressToggle
            moduleId="pneumothorax-pathway"
            section="learn"
            label={t('learn.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
