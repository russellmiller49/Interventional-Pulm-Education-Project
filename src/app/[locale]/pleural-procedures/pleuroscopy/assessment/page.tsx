import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuroscopyNav } from '@/features/pleuroscopy/components/PleuroscopyNav'
import { getPleuroscopyQuizQuestions } from '@/features/pleuroscopy/content/quizItems'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pleuroscopy.assessment' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PleuroscopyAssessmentPage({ params }: PageProps) {
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
            title={t('assessment.headerTitle')}
            description={t('assessment.headerDescription')}
          />
          <PleuroscopyNav activeHref="/pleural-procedures/pleuroscopy/assessment" />

          <AssessSection
            title={t('assessment.checkTitle')}
            intro={t('assessment.checkIntro')}
            questions={getPleuroscopyQuizQuestions(locale)}
          />

          <ModuleProgressToggle
            moduleId="pleuroscopy"
            section="assessment"
            label={t('assessment.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
