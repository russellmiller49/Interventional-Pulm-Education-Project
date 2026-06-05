import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { MalignantEffusionNav } from '@/features/malignant-effusion/components/MalignantEffusionNav'
import { mpeQuizQuestions } from '@/features/malignant-effusion/content/quizItems'

export const metadata: Metadata = {
  title: 'Malignant Pleural Effusion Assessment',
  description:
    'Check your reasoning on cytology escalation, lung expandability, IPC vs pleurodesis, combined strategies, and patient goals.',
}

export default function MalignantEffusionAssessmentPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Assessment"
        description="Eight questions that check whether you can turn the diagnostic and expansion picture into a goal-aligned plan."
      />
      <MalignantEffusionNav activeHref="/pleural-procedures/malignant-effusion/assessment" />

      <AssessSection
        title="Malignant pleural effusion check"
        intro="Answer each question, then reveal the explanation. These mirror the Learn objectives."
        questions={mpeQuizQuestions}
      />

      <ModuleProgressToggle
        moduleId="malignant-effusion"
        section="assessment"
        label="Mark Assessment complete"
      />
    </div>
  )
}
