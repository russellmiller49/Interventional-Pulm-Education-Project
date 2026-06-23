import type { Metadata } from 'next'

import { TrainerEmbedShell } from '@/components/bronch-navigation/TrainerEmbedShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

export const metadata: Metadata = {
  title: 'Bronch Navigation Trainer',
  description:
    'Practice CT-to-bronchoscope airway navigation with target nodules, branching choices, virtual bronchoscopy, and airway-aligned CT views.',
}

const trainerHighlights = [
  'Drive a virtual bronchoscope from central airway landmarks toward peripheral targets.',
  'Practice branch-by-branch decision making with labeled A/B/C airway choices.',
  'Correlate axial, coronal, sagittal, and airway-aligned CT views with the live scope position.',
  'Use accepted target paths and a 3D airway map to build navigation intuition before lab day.',
]

const embeddedTrainerAppPath = '/bronch-navigation-trainer/app/index.html'

export default function BronchNavigationTrainerPage() {
  return (
    <div className="space-y-12 py-16">
      <section className="container space-y-6">
        <div className="space-y-3">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Simulation · Navigation
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Bronch Navigation Trainer
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
            A browser-based rehearsal space for peripheral bronchoscopy navigation. Follow a target
            from CT planning into the airway, drive to each branch point, and choose the route that
            keeps the scope moving toward the lesion.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={embeddedTrainerAppPath} target="_blank" rel="noreferrer">
              Open Dedicated View
            </a>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/board-prep/advanced-peripheral-bronchoscopy-radial-probe-electromagnetic-navigation-and-robotic-bronchoscopy">
              Pair With Board Review
            </Link>
          </Button>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <h2 className="text-lg font-semibold text-foreground">What&apos;s inside</h2>
          <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            {trainerHighlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" aria-hidden />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container">
        <TrainerEmbedShell />
      </section>
    </div>
  )
}
