import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuroscopyNav } from '@/features/pleuroscopy/components/PleuroscopyNav'
import { PleuroscopyPractice } from '@/features/pleuroscopy/components/PleuroscopyPractice'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pleuroscopy.practice' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuroscopyPracticePage({ params }: PageProps) {
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
            title={t('practice.headerTitle')}
            description={t('practice.headerDescription')}
          />
          <PleuroscopyNav activeHref="/pleural-procedures/pleuroscopy/practice" />

          <PleuroscopyPractice />

          <ModuleProgressToggle
            moduleId="pleuroscopy"
            section="practice"
            label={t('practice.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
