import type { Metadata } from 'next'

import { IntroPleuralCourse } from '@/features/intro-pleural-course/components/IntroPleuralCourse'
import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Intro Pleural Disease Course',
  description:
    'Adaptive intro course for pleural disease with a pretest, section scores, and module prescription.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function IntroPleuralCoursePage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <PleuralModuleHeader
            title="Intro pleural disease course"
            description="A pretest-driven course wrapper that routes learners toward the pleural ultrasound, fluid analysis, thoracentesis, chest drainage, infection, pneumothorax, and malignant effusion modules."
            showDisclaimer={false}
          />
          <IntroPleuralCourse />
        </div>
      }
    </HandoffContent>
  )
}
