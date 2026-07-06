import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuroscopyNav } from '@/features/pleuroscopy/components/PleuroscopyNav'
import {
  getPleuroscopyCoreBlocks,
  getPleuroscopyGoDeeperBlocks,
} from '@/features/pleuroscopy/content/learnContent'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pleuroscopy.learn' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuroscopyLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuroscopy')
  const nav = await getTranslations('navigation')

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('learn.headerTitle')}
            description={t('learn.headerDescription')}
          />
          <PleuroscopyNav activeHref="/pleural-procedures/pleuroscopy/learn" />

          <LearnSection
            intro={<p>{t('learn.intro')}</p>}
            coreBlocks={getPleuroscopyCoreBlocks(locale)}
            goDeeperBlocks={getPleuroscopyGoDeeperBlocks(locale)}
          />

          <ModuleProgressToggle
            moduleId="pleuroscopy"
            section="learn"
            label={t('learn.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
