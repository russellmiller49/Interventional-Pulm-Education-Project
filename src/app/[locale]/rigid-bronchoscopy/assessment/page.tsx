import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { RigidBronchoscopyNav } from '@/features/rigid-bronchoscopy/components/RigidBronchoscopyNav'
import { getRigidQuizQuestions } from '@/features/rigid-bronchoscopy/content/quizItems'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'rigidBronchoscopy.assessment' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function RigidBronchoscopyAssessmentPage({ params }: PageProps) {
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
            title={t('assessment.headerTitle')}
            description={t('assessment.headerDescription')}
            disclaimer={t('about.body')}
          />
          <RigidBronchoscopyNav activeHref="/rigid-bronchoscopy/assessment" />

          <AssessSection
            title={t('assessment.checkTitle')}
            intro={t('assessment.checkIntro')}
            questions={getRigidQuizQuestions(locale)}
          />

          <ModuleProgressToggle
            moduleId="rigid-bronchoscopy"
            section="assessment"
            label={t('assessment.progressLabel')}
          />
        </div>
      }
    </HandoffContent>
  )
}
