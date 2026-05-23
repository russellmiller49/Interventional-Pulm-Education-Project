import type { Metadata } from 'next'

import { ChestDrainageHeader } from '@/features/chest-drainage/components/ChestDrainageHeader'
import { ChestDrainageNav } from '@/features/chest-drainage/components/ChestDrainageNav'
import { DrySealDrainageSimulator } from '@/features/chest-drainage/components/DrySealDrainageSimulator'
import { LessonOverview } from '@/features/chest-drainage/components/LessonOverview'

export const metadata: Metadata = {
  title: 'Chest Drainage Systems',
  description:
    'Interactive dry-seal chest drainage simulator with knobology, bubbling, fluid filling, suction changes, troubleshooting, and assessment.',
}

export default function ChestDrainagePage() {
  return (
    <div className="space-y-10 py-16">
      <ChestDrainageHeader
        title="Chest drainage systems"
        description="A pressure-management module for pleural drainage physiology, dry-seal system knobology, chamber interpretation, and patient-first troubleshooting."
      />
      <ChestDrainageNav activeHref="/pleural-procedures/chest-drainage" />
      <DrySealDrainageSimulator />
      <LessonOverview />
    </div>
  )
}
