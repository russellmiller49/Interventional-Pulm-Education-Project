import type { Metadata } from 'next'

import { AssessmentPanel } from '@/features/chest-drainage/components/AssessmentPanel'
import { ChestDrainageHeader } from '@/features/chest-drainage/components/ChestDrainageHeader'
import { ChestDrainageNav } from '@/features/chest-drainage/components/ChestDrainageNav'

export const metadata: Metadata = {
  title: 'Chest Drainage Assessment',
  description: 'Quiz and scenario checks for chest drainage knobology and troubleshooting.',
}

export default function ChestDrainageAssessmentPage() {
  return (
    <div className="space-y-10 py-16">
      <ChestDrainageHeader
        title="Chest drainage assessment"
        description="Short checks for dry suction setup, air leak interpretation, no-tidaling reasoning, and re-expansion risk."
      />
      <ChestDrainageNav activeHref="/pleural-procedures/chest-drainage/assessment" />
      <AssessmentPanel />
    </div>
  )
}
