import type { Metadata } from 'next'

import { MalignantEffusionPathway } from '@/features/malignant-effusion/components/MalignantEffusionPathway'
import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'

export const metadata: Metadata = {
  title: 'Malignant Pleural Effusion Pathway',
  description:
    'Interactive malignant pleural effusion pathway for diagnostic escalation, expandability, IPC, pleurodesis, and patient goals.',
}

export default function MalignantEffusionPage() {
  return (
    <div className="space-y-10 py-16">
      <PleuralModuleHeader
        title="Malignant pleural effusion pathway"
        description="A decision trainer for cytology escalation, lung re-expansion, IPC and pleurodesis tradeoffs, rapid pleurodesis strategies, and patient-centered endpoints."
      />
      <MalignantEffusionPathway />
    </div>
  )
}
