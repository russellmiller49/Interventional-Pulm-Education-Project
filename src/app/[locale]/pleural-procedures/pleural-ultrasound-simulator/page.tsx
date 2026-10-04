import type { Metadata } from 'next'

import { simulatorPage } from '@/components/layout/simulator-page'
import { Badge } from '@/components/ui/badge'
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
        <div className={simulatorPage.root}>
          <div className="space-y-3">
            <section className={simulatorPage.stage}>
              <div className={simulatorPage.header}>
                <div className={simulatorPage.identity}>
                  <Badge
                    variant="info"
                    className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                  >
                    Experimental prototype
                  </Badge>
                  <h1 className={simulatorPage.title}>Thoracic ultrasound simulator</h1>
                </div>
              </div>
            </section>
            <PleuralUltrasoundSimulator />
          </div>

          <section className={simulatorPage.about}>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              Move a virtual probe over patient-derived thoracic anatomy, explore pleural and
              cardiac windows, generate synthetic B-mode views, and rehearse pleural fluid pattern
              recognition and access-window planning.
            </p>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
