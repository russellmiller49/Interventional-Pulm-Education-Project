import type { Metadata } from 'next'

import { DolphinAirwayModuleDynamic } from '@/components/airway-anatomy/AirwayAnatomyModuleDynamic'
import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
import { Badge } from '@/components/ui/badge'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Dolphin Airway Synchronized Bronchoscopy',
  robots: { index: false, follow: false, noarchive: true },
  description:
    'Drive a virtual bronchoscope from the bony nasal passages of a dolphin through the nasopharynx and laryngeal spout into the bronchial tree, with synchronized 3D and CT views.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const learningObjectives = [
  'Follow the dolphin airway from the nares down the nasopharynx, and enter the glottis at the tip of the laryngeal spout (goosebeak) rather than the fornix beside it.',
  'Identify the right tracheal bronchus (RTB) cranial to the carina and follow the right and left main bronchi (RMB, LMB) through their numbered branches.',
  'Correlate the scope tip with axial, coronal, and sagittal CT through the skull, neck, and thorax.',
]

export default function DolphinAirwayPage() {
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
                  Simulation · Comparative anatomy
                </Badge>
                <h1 className={simulatorPage.title}>Dolphin Airway Synchronized Bronchoscopy</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  Learning objectives
                </a>
              </div>
            </div>
            <DolphinAirwayModuleDynamic />
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
              In the dolphin the larynx is separated from the oral cavity: the arytenoid and
              epiglottic cartilages form a long tube, the laryngeal spout or goosebeak, that rises
              into the nasopharynx and is held there by the palatopharyngeal sphincter. The scope
              starts in the left naris below the nasal plugs and descends the nasopharynx to the
              spout, with the nasopharyngeal fornix on either side. It enters the glottis at the
              spout tip, passes the larynx into the trachea, and continues to the right tracheal
              bronchus and the main bronchi. The view is oriented as for an animal in sternal
              recumbency: dorsal at the top of the screen and the animal&rsquo;s right on the screen
              left. Airway names follow the bottlenose dolphin bronchoscopy guide of the U.S. Navy
              Marine Mammal Program and the National Marine Mammal Foundation. The bronchoscopic
              view, the 3D airway, and the CT all follow the same scope tip.
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
