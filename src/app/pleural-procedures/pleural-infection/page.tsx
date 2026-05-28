import type { Metadata } from 'next'

import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { PleuralInfectionWorkflow } from '@/features/pleural-infection/components/PleuralInfectionWorkflow'

export const metadata: Metadata = {
  title: 'Pleural Infection Workflow',
  description:
    'Interactive pleural infection workflow for staging, drainage, tPA/DNase, irrigation alternatives, and escalation.',
}

export default function PleuralInfectionPage() {
  return (
    <div className="space-y-10 py-16">
      <PleuralModuleHeader
        title="Pleural infection workflow"
        description="A source-control trainer for parapneumonic staging, drainage decisions, intrapleural therapy, bleeding-risk overlays, irrigation alternatives, and escalation."
        showDisclaimer={false}
      />
      <PleuralInfectionWorkflow />
    </div>
  )
}
