import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { PeripheralAblationEmbedShell } from '@/components/peripheral-ablation/PeripheralAblationEmbedShell'
import { Badge } from '@/components/ui/badge'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Peripheral Lung Tumor Ablation Interactive Module',
  description:
    'Interactive physics of peripheral lung tumor ablation in one flowing module: RFA, microwave, and cryoablation energy–tissue mechanisms, an ablation-zone simulator with heat-sink and the 5 mm margin, tool-in-lesion confirmation, modality and route selection, and complications.',
  robots: { index: false, follow: false },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const moduleHighlights = [
  'Explore the energy–tissue physics of RFA (resistive heating), MWA (dielectric heating), cryoablation (freeze–thaw), and non-thermal PEF (pulsed electric field / electroporation).',
  'Grow a modality-specific ablation zone against a 5 mm margin — watch RFA roll-off and vessel heat-sink deform a thermal zone, while a non-thermal PEF zone stays intact.',
  'Confirm tool-in-lesion under cone-beam CT / augmented fluoroscopy before delivering energy.',
  'Select modality and route (percutaneous vs investigational transbronchial) through branching cases — including PEF for peri-vascular lesions and immune synergy — then self-assess.',
]

interface PeripheralAblationPageProps {
  params: Promise<{ locale: string }>
}

export default async function PeripheralAblationPage({ params }: PeripheralAblationPageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-12 py-16">
          <section className="container space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="info"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  Simulation · Image-Guided Tumor Ablation
                </Badge>
                <Badge
                  variant="destructive"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  Admin Preview
                </Badge>
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Peripheral Lung Tumor Ablation Interactive Module
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
                One flowing module on ablation of peripheral lung tumors — from the energy–tissue
                physics of radiofrequency, microwave, cryoablation, and non-thermal pulsed electric
                field (PEF), through an ablation-zone simulator built around the 5&nbsp;mm margin
                and the heat-sink effect, to tool-in-lesion confirmation, modality and route
                selection, complications, and self-assessment. Percutaneous CT-guided thermal
                ablation is established; bronchoscopic/transbronchial routes and PEF for lung are
                labeled investigational in-module.
              </p>
            </div>

            <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold text-foreground">What&apos;s inside</h2>
              <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                {moduleHighlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="container">
            <PeripheralAblationEmbedShell />
          </section>
        </div>
      }
    </HandoffContent>
  )
}
