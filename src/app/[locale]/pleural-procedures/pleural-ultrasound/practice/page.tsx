import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralUltrasoundNav } from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import { PleuralUltrasoundPractice } from '@/features/pleural-ultrasound/components/PleuralUltrasoundPractice'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'pleuralUltrasound.practice',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuralUltrasoundPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralUltrasound')
  const nav = await getTranslations('navigation')

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          {/* Disclaimer is rendered by the lab's LessonScaffold, so suppress it here. */}
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('practice.headerTitle')}
            description={t('practice.headerDescription')}
            showDisclaimer={false}
          />
          <PleuralUltrasoundNav activeHref="/pleural-procedures/pleural-ultrasound/practice" />

          <PleuralUltrasoundPractice />

          <ModuleProgressToggle
            moduleId="pleural-ultrasound"
            section="practice"
            label={t('practice.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
