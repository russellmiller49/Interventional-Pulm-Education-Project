import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralFluidAnalysisNav } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisNav'
import { PleuralFluidAnalysisModule } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisModule'

export const metadata: Metadata = {
  title: 'Practice Pleural Fluid Analysis',
  description:
    'Enter pleural fluid values and watch Light’s criteria meters and the ranked differential respond in an interactive cockpit.',
}

export default function PleuralFluidAnalysisPracticePage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Practice: the differential cockpit"
        description="Enter the fluid values and clinical context, then watch Light’s criteria, pseudoexudate flags, and the ranked differential update as you go."
      />
      <PleuralFluidAnalysisNav activeHref="/pleural-procedures/pleural-fluid-analysis/practice" />

      <PleuralFluidAnalysisModule />

      <ModuleProgressToggle
        moduleId="pleural-fluid-analysis"
        section="practice"
        label="Mark Practice complete"
      />
    </div>
  )
}
