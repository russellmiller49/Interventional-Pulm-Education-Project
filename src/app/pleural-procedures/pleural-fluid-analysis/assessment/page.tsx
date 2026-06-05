import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralFluidAnalysisNav } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisNav'
import { PleuralAnalysisQuiz } from '@/features/pleural-fluid-analysis/components/PleuralAnalysisQuiz'

export const metadata: Metadata = {
  title: 'Pleural Fluid Analysis Assessment',
  description:
    'Match a full pattern of pleural fluid findings to the most likely diagnosis, including the classic traps and rare effusions.',
}

export default function PleuralFluidAnalysisAssessmentPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Assessment"
        description="Match the full pattern of findings to the diagnosis — the rare items are mixed in on purpose to test when a clue changes the branch."
      />
      <PleuralFluidAnalysisNav activeHref="/pleural-procedures/pleural-fluid-analysis/assessment" />

      <PleuralAnalysisQuiz />

      <ModuleProgressToggle
        moduleId="pleural-fluid-analysis"
        section="assessment"
        label="Mark Assessment complete"
      />
    </div>
  )
}
