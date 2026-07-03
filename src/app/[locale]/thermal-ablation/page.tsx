import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { ThermalAblationEmbedShell } from '@/components/thermal-ablation/ThermalAblationEmbedShell'
import { Badge } from '@/components/ui/badge'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Thermal Ablation Interactive Module',
  description:
    'Interactive physics of hot endobronchial ablation in one flowing module: laser wavelengths and power density, a simulated ERBE VIO 3 console with electrosurgery modes and argon plasma coagulation, and airway-fire safety.',
  robots: { index: false, follow: false },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const moduleHighlights = [
  'Fire lasers into a tissue lab with live power-density effects, char feedback, and tissue-type / blood physics.',
  'Compare Nd:YAG, Nd:YAP, Ho:YAG, KTP, diode, and CO₂ wavelengths on water and hemoglobin absorption curves.',
  'Operate a simulated ERBE VIO 3 console: CUT/COAG modes, argon plasma coagulation, waveform scope, and NESSY safety.',
  'Contrast every modality, then rehearse airway-fire prevention and case-based decision-making.',
]

interface ThermalAblationPageProps {
  params: Promise<{ locale: string }>
}

export default async function ThermalAblationPage({ params }: ThermalAblationPageProps) {
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
                  Simulation · Therapeutic Bronchoscopy
                </Badge>
                <Badge
                  variant="destructive"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  Admin Preview
                </Badge>
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Thermal Ablation Interactive Module
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
                One flowing module on hot endobronchial ablation — from laser physics and a
                power-density tissue lab, through a simulated ERBE VIO 3 console with electrosurgery
                modes and argon plasma coagulation, to modality comparison, airway-fire safety, and
                case-based self-assessment.
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
            <ThermalAblationEmbedShell />
          </section>
        </div>
      }
    </HandoffContent>
  )
}
