import type { Metadata } from 'next'

import { FluoroViewApp } from '@/components/fluoroview/FluoroViewApp'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'FluoroView CT-to-Fluoroscopy Simulator',
  description:
    'Explore non-diagnostic CT-to-fluoroscopy correlation, C-arm angles, educational knobology, and transparent airway overlays.',
}

const learningObjectives = [
  'Correlate CT slice position with a simulated fluoroscopic projection.',
  'Practice RAO/LAO and cranial/caudal angle changes using a precomputed DRR atlas.',
  'Explore how kVp, mA, pulse rate, collimation, magnification, ABC/AERC, noise, scatter, and blur affect an educational image.',
  'Overlay airway surfaces, wireframe, labels, and centerlines while preserving non-diagnostic safety framing.',
]

export default function FluoroViewPage() {
  return (
    <div className="space-y-16 py-16">
      <section className="container space-y-6">
        <div className="space-y-2">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Simulation · FluoroView
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">FluoroView</h1>
          <p className="max-w-3xl text-muted-foreground text-base md:text-lg">
            Compare derived CT slices with simulated fluoroscopy, rehearse C-arm orientation, and
            use a transparent 3D airway overlay to teach anatomy and projection behavior. This is an
            educational simulator only, not a clinical imaging or guidance tool.
          </p>
        </div>
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

      <section className="container space-y-8">
        <FluoroViewApp />
      </section>
    </div>
  )
}
