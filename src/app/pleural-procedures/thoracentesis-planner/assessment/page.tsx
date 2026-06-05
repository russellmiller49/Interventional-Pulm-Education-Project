import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { ThoracentesisNav } from '@/features/thoracentesis-planner/components/ThoracentesisNav'
import { thoracentesisQuizQuestions } from '@/features/thoracentesis-planner/content/quizItems'

export const metadata: Metadata = {
  title: 'Thoracentesis Assessment',
  description:
    'Check your reasoning on safe access, intercostal vessel risk, bleeding risk, manometry, and stopping rules.',
}

export default function ThoracentesisAssessmentPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Assessment"
        description="Eight questions that check whether you can turn the anatomy and the pressure curve into a safe plan."
      />
      <ThoracentesisNav activeHref="/pleural-procedures/thoracentesis-planner/assessment" />

      <AssessSection
        title="Thoracentesis check"
        intro="Answer each question, then reveal the explanation. These mirror the Learn objectives."
        questions={thoracentesisQuizQuestions}
      />

      <ModuleProgressToggle
        moduleId="thoracentesis-planner"
        section="assessment"
        label="Mark Assessment complete"
      />
    </div>
  )
}
