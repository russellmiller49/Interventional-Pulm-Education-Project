import type { Metadata } from 'next'

import { Callout } from '@/components/ui/callout'
import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { PleuralUltrasoundSimulator } from '@/features/pleural-ultrasound-simulator/components/PleuralUltrasoundSimulator'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Pleural Ultrasound Simulator (Experimental)',
  description:
    'Experimental single-case pleural ultrasound prototype: a virtual probe over a patient-specific model with synthetic B-mode generation. Not part of the core learning path.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function PleuralUltrasoundSimulatorPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <PleuralModuleHeader
            eyebrow="Experimental prototype"
            title="Pleural ultrasound simulator"
            description="Move a virtual probe over a patient-specific pleural effusion model, generate synthetic B-mode views, classify the fluid pattern, and rehearse a safe thoracentesis access window."
            showDisclaimer={false}
          />
          <section className="container">
            <Callout variant="warning" title="Experimental — not part of the core path">
              This is a single-case research prototype that generates synthetic B-mode images from a
              3D model. It is not a validated teaching tool. For the core ultrasound curriculum, use
              the Pleural Ultrasound module (Learn → Practice → Assess).
            </Callout>
          </section>
          <PleuralUltrasoundSimulator />
        </div>
      }
    </HandoffContent>
  )
}
