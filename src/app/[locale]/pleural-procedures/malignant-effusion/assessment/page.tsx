import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { MalignantEffusionNav } from '@/features/malignant-effusion/components/MalignantEffusionNav'
import { getMpeQuizQuestions } from '@/features/malignant-effusion/content/quizItems'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'malignantEffusion.assessment',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function MalignantEffusionAssessmentPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('malignantEffusion')
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
          <MalignantEffusionNav activeHref="/pleural-procedures/malignant-effusion/assessment" />

          <AssessSection
            title={t('assessment.checkTitle')}
            intro={t('assessment.checkIntro')}
            questions={getMpeQuizQuestions(locale)}
          />

          <ModuleProgressToggle
            moduleId="malignant-effusion"
            section="assessment"
            label={t('assessment.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
