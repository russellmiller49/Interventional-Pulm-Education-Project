import type { Metadata } from 'next'

import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { PneumothoraxPathway } from '@/features/pneumothorax-pathway/components/PneumothoraxPathway'

export const metadata: Metadata = {
  title: 'Pneumothorax Pathway',
  description:
    'Interactive pneumothorax pathway for stability, PSP/SSP decisions, persistent air leak escalation, and recurrence prevention.',
}

export default function PneumothoraxPathwayPage() {
  return (
    <div className="space-y-10 py-16">
      <PleuralModuleHeader
        title="Pneumothorax pathway"
        description="A current, physiology-first pneumothorax trainer that avoids size-only reasoning and makes persistent-air-leak escalation explicit."
      />
      <PneumothoraxPathway />
    </div>
  )
}
