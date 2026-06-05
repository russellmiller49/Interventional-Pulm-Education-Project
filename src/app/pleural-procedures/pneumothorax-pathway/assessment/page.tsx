import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PneumothoraxNav } from '@/features/pneumothorax-pathway/components/PneumothoraxNav'
import { pneumothoraxQuizQuestions } from '@/features/pneumothorax-pathway/content/quizItems'

export const metadata: Metadata = {
  title: 'Pneumothorax Assessment',
  description:
    'Check your reasoning on stability, PSP vs SSP, the ACCP-vs-BTS divergence, persistent air leak, and recurrence prevention.',
}

export default function PneumothoraxAssessmentPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Assessment"
        description="Eight questions that check whether you can put physiology first and choose the right pathway."
      />
      <PneumothoraxNav activeHref="/pleural-procedures/pneumothorax-pathway/assessment" />

      <AssessSection
        title="Pneumothorax check"
        intro="Answer each question, then reveal the explanation. These mirror the Learn objectives."
        questions={pneumothoraxQuizQuestions}
      />

      <ModuleProgressToggle
        moduleId="pneumothorax-pathway"
        section="assessment"
        label="Mark Assessment complete"
      />
    </div>
  )
}
