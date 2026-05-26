import type { Metadata } from 'next'

import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { ThoracentesisPlanner } from '@/features/thoracentesis-planner/components/ThoracentesisPlanner'

export const metadata: Metadata = {
  title: 'Thoracentesis Planner',
  description:
    'Interactive thoracentesis safety planner with triangle of safety, bleeding-risk framing, vessel anatomy, and manometry teaching.',
}

export default function ThoracentesisPlannerPage() {
  return (
    <div className="space-y-10 py-16">
      <PleuralModuleHeader
        title="Thoracentesis planner"
        description="A procedural-safety trainer for access-window anatomy, bleeding-risk framing, intercostal-vessel risk, and symptom-limited large-volume drainage."
      />
      <ThoracentesisPlanner />
    </div>
  )
}
