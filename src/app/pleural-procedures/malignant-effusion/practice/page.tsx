import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { MalignantEffusionNav } from '@/features/malignant-effusion/components/MalignantEffusionNav'
import { MalignantEffusionPathway } from '@/features/malignant-effusion/components/MalignantEffusionPathway'

export const metadata: Metadata = {
  title: 'Practice Malignant Pleural Effusion',
  description:
    'Set the diagnostic escalation and lung-expansion picture, then commit to a management arm before revealing the pathway.',
}

export default function MalignantEffusionPracticePage() {
  return (
    <div className="space-y-10 py-16">
      {/* Disclaimer is rendered by the pathway's LessonScaffold, so suppress it here. */}
      <ModuleHeader
        title="Practice: choose the pathway"
        description="Set the cytology and lung-expansion picture, commit to a management arm, then reveal how the pathway compares."
        showDisclaimer={false}
      />
      <MalignantEffusionNav activeHref="/pleural-procedures/malignant-effusion/practice" />

      <MalignantEffusionPathway />

      <ModuleProgressToggle
        moduleId="malignant-effusion"
        section="practice"
        label="Mark Practice complete"
      />
    </div>
  )
}
