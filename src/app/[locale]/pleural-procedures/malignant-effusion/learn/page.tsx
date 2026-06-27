import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { MalignantEffusionNav } from '@/features/malignant-effusion/components/MalignantEffusionNav'
import {
  getMpeCoreBlocks,
  getMpeGoDeeperBlocks,
  mpeBoardSectionIds,
  mpeBoardSlug,
} from '@/features/malignant-effusion/content/learnContent'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'malignantEffusion.learn',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function MalignantEffusionLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('malignantEffusion')
  const nav = await getTranslations('navigation')

  const boardSections = getBoardSections(mpeBoardSlug, mpeBoardSectionIds)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('learn.headerTitle')}
            description={t('learn.headerDescription')}
          />
          <MalignantEffusionNav activeHref="/pleural-procedures/malignant-effusion/learn" />

          <LearnSection
            intro={<p>{t('learn.intro')}</p>}
            coreBlocks={getMpeCoreBlocks(locale)}
            goDeeperBlocks={getMpeGoDeeperBlocks(locale)}
            boardSections={boardSections}
            boardSourceLabel={t('learn.boardSourceLabel')}
          />

          <ModuleProgressToggle
            moduleId="malignant-effusion"
            section="learn"
            label={t('learn.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
