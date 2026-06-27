import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralUltrasoundNav } from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import {
  getUltrasoundCoreBlocks,
  getUltrasoundGoDeeperBlocks,
  ultrasoundBoardSectionIds,
  ultrasoundBoardSlug,
} from '@/features/pleural-ultrasound/content/learnContent'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'pleuralUltrasound.learn',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuralUltrasoundLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralUltrasound')
  const nav = await getTranslations('navigation')

  // Server-only: pull the ultrasound-relevant sections from the board chapter.
  const boardSections = getBoardSections(ultrasoundBoardSlug, ultrasoundBoardSectionIds)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('learn.headerTitle')}
            description={t('learn.headerDescription')}
          />
          <PleuralUltrasoundNav activeHref="/pleural-procedures/pleural-ultrasound/learn" />

          <LearnSection
            intro={<p>{t('learn.intro')}</p>}
            coreBlocks={getUltrasoundCoreBlocks(locale)}
            goDeeperBlocks={getUltrasoundGoDeeperBlocks(locale)}
            boardSections={boardSections}
            boardSourceLabel={t('learn.boardSourceLabel')}
          />

          <ModuleProgressToggle
            moduleId="pleural-ultrasound"
            section="learn"
            label={t('learn.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
