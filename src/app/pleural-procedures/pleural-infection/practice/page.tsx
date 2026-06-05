import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralInfectionNav } from '@/features/pleural-infection/components/PleuralInfectionNav'
import { PleuralInfectionWorkflow } from '@/features/pleural-infection/components/PleuralInfectionWorkflow'

export const metadata: Metadata = {
  title: 'Practice Pleural Infection',
  description:
    'Stage a parapneumonic effusion from the fluid values and commit to a source-control pathway before revealing the plan.',
}

export default function PleuralInfectionPracticePage() {
  return (
    <div className="space-y-10 py-16">
      {/* Disclaimer is rendered by the workflow's LessonScaffold, so suppress it here. */}
      <ModuleHeader
        title="Practice: stage and act"
        description="Read the fluid and imaging values, commit to a stage, then reveal the drainage, antibiotic, intrapleural-therapy, and escalation plan."
        showDisclaimer={false}
      />
      <PleuralInfectionNav activeHref="/pleural-procedures/pleural-infection/practice" />

      <PleuralInfectionWorkflow />

      <ModuleProgressToggle
        moduleId="pleural-infection"
        section="practice"
        label="Mark Practice complete"
      />
    </div>
  )
}
