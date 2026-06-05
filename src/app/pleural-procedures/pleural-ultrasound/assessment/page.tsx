import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralUltrasoundNav } from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import { ultrasoundQuizQuestions } from '@/features/pleural-ultrasound/content/quizItems'

export const metadata: Metadata = {
  title: 'Pleural Ultrasound Assessment',
  description:
    'Check your pleural ultrasound reasoning: pattern recognition, safe access, dynamic signs, and when not to tap.',
}

export default function PleuralUltrasoundAssessmentPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Assessment"
        description="Eight questions that check whether you can turn the ultrasound picture into a safe procedural plan."
      />
      <PleuralUltrasoundNav activeHref="/pleural-procedures/pleural-ultrasound/assessment" />

      <AssessSection
        title="Pleural ultrasound check"
        intro="Answer each question, then reveal the explanation. These mirror the Learn objectives."
        questions={ultrasoundQuizQuestions}
      />

      <ModuleProgressToggle
        moduleId="pleural-ultrasound"
        section="assessment"
        label="Mark Assessment complete"
      />
    </div>
  )
}
