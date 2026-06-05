import type { Metadata } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PneumothoraxNav } from '@/features/pneumothorax-pathway/components/PneumothoraxNav'
import { PneumothoraxPathway } from '@/features/pneumothorax-pathway/components/PneumothoraxPathway'

export const metadata: Metadata = {
  title: 'Practice Pneumothorax',
  description:
    'Build a pneumothorax case, commit to a disposition, then see how ACCP 2001 and BTS 2023 evaluate it side by side.',
}

export default function PneumothoraxPracticePage() {
  return (
    <div className="space-y-10 py-16">
      {/* Disclaimer is rendered by the pathway's LessonScaffold, so suppress it here. */}
      <ModuleHeader
        title="Practice: both frameworks side by side"
        description="Set the case, commit to a disposition, then reveal how ACCP 2001 and BTS 2023 evaluate it — and where they agree or diverge."
        showDisclaimer={false}
      />
      <PneumothoraxNav activeHref="/pleural-procedures/pneumothorax-pathway/practice" />

      <PneumothoraxPathway />

      <ModuleProgressToggle
        moduleId="pneumothorax-pathway"
        section="practice"
        label="Mark Practice complete"
      />
    </div>
  )
}
