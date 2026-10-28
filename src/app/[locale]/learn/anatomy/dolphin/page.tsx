import type { Metadata, Route } from 'next'
import Link from 'next/link'

import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
import { Badge } from '@/components/ui/badge'
import { DolphinAnatomyExplorerDynamic } from '@/features/dolphin-anatomy/components/DolphinAnatomyExplorerDynamic'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Dolphin Anatomy in 3D',
  robots: { index: false, follow: false, noarchive: true },
  description:
    'A 3D model of a bottlenose dolphin built from CT: skeleton, airway and lungs, heart and aorta, brain, sinuses and body wall, with notes comparing each structure with human anatomy.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const learningObjectives = [
  'Trace the airway from the bony nasal passages through the nasopharynx, the laryngeal spout, the trachea and its tracheal bronchus to the lungs, and compare each part with the human airway.',
  'Locate the lungs, heart, aorta and abdomen in the prone animal, and explain why the lungs lie dorsally and reach so far caudally.',
  'Identify the cetacean skeleton seen here: the telescoped skull, the free tympanoperiotic bones, the fused cervical vertebrae, the lumbar transverse processes and a flipper built from the bones of the forelimb.',
]

const sources = [
  'Cozzi B, Huggenberger S, Oelschläger H. Anatomy of Dolphins: Insights into Body Structure and Function. London: Academic Press; 2017.',
  'Rommel SA, Lowenstine LJ. Gross and microscopic anatomy. In: Dierauf LA, Gulland FMD, eds. CRC Handbook of Marine Mammal Medicine. 2nd ed. Boca Raton: CRC Press; 2001.',
  'Reidenberg JS, Laitman JT. Position of the larynx in Odontoceti (toothed whales). Anat Rec. 1987;218:98-106.',
  'Piscitelli MA, McLellan WA, Rommel SA, Blum JE, Barco SG, Pabst DA. Lung size and thoracic morphology in shallow- and deep-diving cetaceans. J Morphol. 2010;271:654-673.',
]

export default function DolphinAnatomyPage() {
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
                  3D anatomy · Comparative anatomy
                </Badge>
                <h1 className={simulatorPage.title}>Dolphin Anatomy in 3D</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  Learning objectives
                </a>
              </div>
            </div>
            <DolphinAnatomyExplorerDynamic />
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
              The model comes from the CT of a 19-year-old male bottlenose dolphin of 213 kg,
              scanned prone and head first from the bony nares to just behind the dorsal fin, so the
              rostrum, the melon and the flukes are outside it. Each structure is this
              animal&rsquo;s own shape and volume, not a species average. The dolphin breathes
              through a single blowhole, and its larynx rises into the nasopharynx as the laryngeal
              spout, so air never crosses the mouth. To drive a bronchoscope through this airway,
              open the{' '}
              <Link
                href={'/learn/anatomy/dolphin-airway' as Route}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Dolphin Airway Synchronized Bronchoscopy
              </Link>
              .
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

            <div className="max-w-3xl space-y-2">
              <h2 className="text-base font-semibold text-foreground">Sources</h2>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
