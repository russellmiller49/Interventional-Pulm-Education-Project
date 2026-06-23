import type { Metadata } from 'next'

import { AirwayAnatomyModuleDynamic } from '@/components/airway-anatomy/AirwayAnatomyModuleDynamic'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Airway Anatomy Synchronized Bronchoscopy',
  description:
    'Drive a virtual bronchoscope through a centerline airway graph while synchronized 3D and CT views show the same scope-tip position.',
}

const learningObjectives = [
  'Link endoluminal bronchoscopy orientation to the surrounding 3D airway tree.',
  'Correlate the live scope tip with axial, coronal, and sagittal CT slice positions.',
  'Use branch-point decisions to connect segmental anatomy labels with centerline navigation.',
]

export default function AirwayAnatomyPage() {
  return (
    <div className="space-y-10 py-16">
      <section className="container space-y-6">
        <div className="space-y-3">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Simulation · Anatomy
          </Badge>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
            Airway Anatomy Synchronized Bronchoscopy
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
            A synchronized airway anatomy workspace using the same scope-tip state for virtual
            bronchoscopy, the transparent 3D airway tree, and CT slice correlation.
          </p>
        </div>

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

      <section className="container">
        <AirwayAnatomyModuleDynamic />
      </section>
    </div>
  )
}
