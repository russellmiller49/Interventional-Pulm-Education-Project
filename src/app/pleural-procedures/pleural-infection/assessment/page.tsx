import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralInfectionNav } from '@/features/pleural-infection/components/PleuralInfectionNav'
import { infectionQuizQuestions } from '@/features/pleural-infection/content/quizItems'

export const metadata: Metadata = {
  title: 'Pleural Infection Assessment',
  description:
    'Check your reasoning on staging, drainage thresholds, MIST2 therapy, surgery, irrigation, and the RAPID score.',
}

export default function PleuralInfectionAssessmentPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Assessment"
        description="Eight questions that check whether you can stage the effusion and choose the right source-control step."
      />
      <PleuralInfectionNav activeHref="/pleural-procedures/pleural-infection/assessment" />

      <AssessSection
        title="Pleural infection check"
        intro="Answer each question, then reveal the explanation. These mirror the Learn objectives."
        questions={infectionQuizQuestions}
      />

      <ModuleProgressToggle
        moduleId="pleural-infection"
        section="assessment"
        label="Mark Assessment complete"
      />
    </div>
  )
}
