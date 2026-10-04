import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { FluoroViewAppDynamic } from '@/components/fluoroview/FluoroViewAppDynamic'
import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
import { Badge } from '@/components/ui/badge'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'FluoroView CT-to-Fluoroscopy Simulator',
  description:
    'Explore non-diagnostic CT-to-fluoroscopy correlation, C-arm angles, educational knobology, and transparent airway overlays.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const learningObjectives = [
  'Correlate CT slice position with a simulated fluoroscopic projection.',
  'Practice RAO/LAO and cranial/caudal angle changes using a precomputed DRR atlas.',
  'Explore how kVp, mA, pulse rate, collimation, magnification, ABC/AERC, noise, scatter, and blur affect an educational image.',
  'Overlay airway surfaces, wireframe, labels, and centerlines while preserving non-diagnostic safety framing.',
]

interface FluoroViewPageProps {
  params: Promise<{ locale: string }>
}

export default async function FluoroViewPage({ params }: FluoroViewPageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {
        <div className={simulatorPage.root}>
          <section className={simulatorPage.stage}>
            <div className={simulatorPage.header}>
              <div className={simulatorPage.identity}>
                <Badge
                  variant="info"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  Simulation · FluoroView
                </Badge>
                <h1 className={simulatorPage.title}>FluoroView</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  Learning objectives
                </a>
              </div>
            </div>
            <FluoroViewAppDynamic />
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
              Compare derived CT slices with simulated fluoroscopy, rehearse C-arm orientation, and
              use a transparent 3D airway overlay to teach anatomy and projection behavior. This is
              an educational simulator only, not a clinical imaging or guidance tool.
            </p>
            <div className="rounded-lg border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold text-foreground">Learning objectives</h2>
              <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                {learningObjectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" aria-hidden />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
