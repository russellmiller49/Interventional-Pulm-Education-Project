import type { Metadata } from 'next'

import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { PleuralUltrasoundSimulator } from '@/features/pleural-ultrasound-simulator/components/PleuralUltrasoundSimulator'

export const metadata: Metadata = {
  title: 'Pleural Ultrasound Simulator',
  description:
    'Patient-specific pleural ultrasound simulator with a virtual probe, synthetic B-mode image generation, access-window safety scoring, and effusion pattern classification.',
}

export default function PleuralUltrasoundSimulatorPage() {
  return (
    <div className="space-y-10 py-16">
      <PleuralModuleHeader
        title="Pleural ultrasound simulator"
        description="Move a virtual probe over a patient-specific pleural effusion model, generate synthetic B-mode views, classify the fluid pattern, and rehearse a safe thoracentesis access window."
        showDisclaimer={false}
      />
      <PleuralUltrasoundSimulator />
    </div>
  )
}
