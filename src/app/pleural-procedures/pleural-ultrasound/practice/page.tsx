import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralUltrasoundNav } from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import { PleuralUltrasoundPractice } from '@/features/pleural-ultrasound/components/PleuralUltrasoundPractice'

export const metadata: Metadata = {
  title: 'Practice Pleural Ultrasound',
  description:
    'Commit-first pleural ultrasound pattern classification lab with running feedback on real images.',
}

export default function PleuralUltrasoundPracticePage() {
  return (
    <div className="space-y-10 py-16">
      {/* Disclaimer is rendered by the lab's LessonScaffold, so suppress it here. */}
      <ModuleHeader
        title="Practice: classify the pattern"
        description="Read each image and commit to a pattern before checking yourself. Your running score builds across the case set."
        showDisclaimer={false}
      />
      <PleuralUltrasoundNav activeHref="/pleural-procedures/pleural-ultrasound/practice" />

      <PleuralUltrasoundPractice />

      <ModuleProgressToggle
        moduleId="pleural-ultrasound"
        section="practice"
        label="Mark Practice complete"
      />
    </div>
  )
}
