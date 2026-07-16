import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { RigidBronchoscopyLearnDemos } from '@/features/rigid-bronchoscopy/components/RigidBronchoscopyLearnDemos'
import { RigidBronchoscopyNav } from '@/features/rigid-bronchoscopy/components/RigidBronchoscopyNav'
import {
  getRigidCoreBlocks,
  getRigidGoDeeperBlocks,
} from '@/features/rigid-bronchoscopy/content/learnContent'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'rigidBronchoscopy.learn' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function RigidBronchoscopyLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('rigidBronchoscopy')
  const nav = await getTranslations('navigation')

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.rigidBronchoscopy.title')}
            title={t('learn.headerTitle')}
            description={t('learn.headerDescription')}
            disclaimer={t('about.body')}
          />
          <RigidBronchoscopyNav activeHref="/rigid-bronchoscopy/learn" />

          <LearnSection
            intro={<p>{t('learn.intro')}</p>}
            coreBlocks={getRigidCoreBlocks(locale)}
            goDeeperBlocks={getRigidGoDeeperBlocks(locale)}
          />

          <RigidBronchoscopyLearnDemos />

          <ModuleProgressToggle
            moduleId="rigid-bronchoscopy"
            section="learn"
            label={t('learn.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
