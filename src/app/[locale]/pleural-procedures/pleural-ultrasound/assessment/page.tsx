import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralUltrasoundNav } from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import { getUltrasoundQuizQuestions } from '@/features/pleural-ultrasound/content/quizItems'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'pleuralUltrasound.assessment',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuralUltrasoundAssessmentPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pleuralUltrasound')
  const nav = await getTranslations('navigation')

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('assessment.headerTitle')}
            description={t('assessment.headerDescription')}
          />
          <PleuralUltrasoundNav activeHref="/pleural-procedures/pleural-ultrasound/assessment" />

          <AssessSection
            title={t('assessment.checkTitle')}
            intro={t('assessment.checkIntro')}
            questions={getUltrasoundQuizQuestions(locale)}
          />

          <ModuleProgressToggle
            moduleId="pleural-ultrasound"
            section="assessment"
            label={t('assessment.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
