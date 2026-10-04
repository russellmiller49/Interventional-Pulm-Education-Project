import type { Metadata } from 'next'

import { AirwayAnatomyModuleDynamic } from '@/components/airway-anatomy/AirwayAnatomyModuleDynamic'
import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
import { Badge } from '@/components/ui/badge'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Airway Anatomy Synchronized Bronchoscopy',
  robots: { index: false, follow: false, noarchive: true },
  description:
    'Drive a virtual bronchoscope through a centerline airway graph while synchronized 3D and CT views show the same scope-tip position.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const learningObjectives = [
  'Link endoluminal bronchoscopy orientation to the surrounding 3D airway tree.',
  'Correlate the live scope tip with axial, coronal, and sagittal CT slice positions.',
  'Use branch-point decisions to connect segmental anatomy labels with centerline navigation.',
]

export default function AirwayAnatomyPage() {
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
                  Simulation · Anatomy
                </Badge>
                <h1 className={simulatorPage.title}>Airway Anatomy Synchronized Bronchoscopy</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  Learning objectives
                </a>
              </div>
            </div>
            <AirwayAnatomyModuleDynamic />
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
              A synchronized airway anatomy workspace using the same scope-tip state for virtual
              bronchoscopy, the transparent 3D airway tree, and CT slice correlation.
            </p>

            <div className="rounded-lg border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold text-foreground">Learning objectives</h2>
              <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
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
