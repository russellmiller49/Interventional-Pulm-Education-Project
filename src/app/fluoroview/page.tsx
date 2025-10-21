import type { Metadata } from 'next'

import { FluoroViewApp } from '@/components/fluoroview/FluoroViewApp'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'FluoroView',
  description:
    'Interact with a labeled tracheobronchial tree, practice fluoroscopic orientations, and drill segmental anatomy in a browser-based simulator.',
}

const learningObjectives = [
  'Correlate tracheobronchial segment anatomy with fluoroscopic projections across RAO/LAO and cranial/caudal sweeps.',
  'Recognize lobar and segmental silhouettes in simulated C-arm rotations to speed up airway navigation.',
  'Build a mental model for depth by toggling DTS emphasis and wireframe overlays on the airway tree.',
  'Use lobar filters to quiz yourself or trainees on regional anatomy during live teaching sessions.',
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
            Spin a detailed airway model under simulated fluoroscopy, label-check each segment, and
            rehearse the C-arm sequences you use in rigid bronchoscopy, robotic navigation, and
            peripheral interventions. Built to mirror real cath-lab geometry in the browser.
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
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
