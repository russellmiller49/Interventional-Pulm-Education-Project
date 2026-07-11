import type { Metadata } from 'next'

import { Callout } from '@/components/ui/callout'
import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { PleuralUltrasoundSimulator } from '@/features/pleural-ultrasound-simulator/components/PleuralUltrasoundSimulator'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Thoracic Ultrasound Simulator (Experimental)',
  description:
    'Experimental thoracic ultrasound simulator with patient-derived anatomy, synthetic pleural B-mode, and procedural cardiac cine. Not part of the core learning path.',
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
            title="Thoracic ultrasound simulator"
            description="Move a virtual probe over patient-derived thoracic anatomy, explore pleural and cardiac windows, generate synthetic B-mode views, and rehearse pleural fluid pattern recognition and access-window planning."
            showDisclaimer={false}
          />
          <section className="container">
            <Callout variant="warning" title="Experimental — not part of the core path">
              This is a single-case research prototype that generates synthetic B-mode and
              procedural cardiac motion from a 3D model. It is not a validated diagnostic or
              competency tool. For the core pleural curriculum, use the Pleural Ultrasound module
              (Learn → Practice → Assess).
            </Callout>
          </section>
          <PleuralUltrasoundSimulator />
        </div>
      }
    </HandoffContent>
  )
}
