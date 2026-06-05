import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { ThoracentesisNav } from '@/features/thoracentesis-planner/components/ThoracentesisNav'
import { ThoracentesisPlanner } from '@/features/thoracentesis-planner/components/ThoracentesisPlanner'

export const metadata: Metadata = {
  title: 'Practice Thoracentesis',
  description:
    'Plan a safe access window, set the bleeding-risk inputs, and predict the manometry drainage curve before revealing the teaching point.',
}

export default function ThoracentesisPracticePage() {
  return (
    <div className="space-y-10 py-16">
      {/* Disclaimer is rendered by the planner's LessonScaffold, so suppress it here. */}
      <ModuleHeader
        title="Practice: plan the tap"
        description="Choose a safe window, set the case's bleeding-risk inputs, then commit to a drainage prediction before checking the manometry verdict."
        showDisclaimer={false}
      />
      <ThoracentesisNav activeHref="/pleural-procedures/thoracentesis-planner/practice" />

      <ThoracentesisPlanner />

      <ModuleProgressToggle
        moduleId="thoracentesis-planner"
        section="practice"
        label="Mark Practice complete"
      />
    </div>
  )
}
