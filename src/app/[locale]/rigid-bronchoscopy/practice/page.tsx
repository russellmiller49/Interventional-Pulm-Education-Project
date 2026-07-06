import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { RigidBronchoscopyNav } from '@/features/rigid-bronchoscopy/components/RigidBronchoscopyNav'
import { RigidBronchoscopyPractice } from '@/features/rigid-bronchoscopy/components/RigidBronchoscopyPractice'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'rigidBronchoscopy.practice' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function RigidBronchoscopyPracticePage({ params }: PageProps) {
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
            title={t('practice.headerTitle')}
            description={t('practice.headerDescription')}
          />
          <RigidBronchoscopyNav activeHref="/rigid-bronchoscopy/practice" />

          <RigidBronchoscopyPractice />

          <ModuleProgressToggle
            moduleId="rigid-bronchoscopy"
            section="practice"
            label={t('practice.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
