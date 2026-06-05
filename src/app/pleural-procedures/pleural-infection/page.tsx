import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import {
  PleuralInfectionNav,
  pleuralInfectionNavItems,
} from '@/features/pleural-infection/components/PleuralInfectionNav'
import { infectionObjectives } from '@/features/pleural-infection/content/learnContent'

export const metadata: Metadata = {
  title: 'Pleural Infection',
  description:
    'Learn parapneumonic staging and source control, practice staging a case and choosing the pathway, then check your reasoning.',
}

const base = '/pleural-procedures/pleural-infection'

const pathSteps = [
  {
    href: `${base}/learn`,
    step: '1',
    title: 'Learn',
    description:
      'Staging thresholds, antibiotics + drainage, tPA + DNase, surgery, and reassessment.',
  },
  {
    href: `${base}/practice`,
    step: '2',
    title: 'Practice',
    description: 'Stage a case from the fluid values, then commit before revealing the pathway.',
  },
  {
    href: `${base}/assessment`,
    step: '3',
    title: 'Assessment',
    description: 'Eight questions on staging, MIST2, surgery, irrigation, and the RAPID score.',
  },
]

export default function PleuralInfectionPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Pleural infection"
        description="Place a parapneumonic effusion on the simple → complicated → empyema continuum, then drain, dose, escalate, and reassess as one pathway."
      />
      <PleuralInfectionNav activeHref={pleuralInfectionNavItems[0].href} />

      <section className="container max-w-4xl space-y-6">
        <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By the end of this module you can
          </p>
          <ul className="mt-3 grid gap-2 text-sm leading-7 text-foreground">
            {infectionObjectives.map((objective) => (
              <li key={objective} className="flex gap-2">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {pathSteps.map((stepItem) => (
            <Link
              key={stepItem.href}
              href={stepItem.href as Route}
              className="group rounded-lg border border-border/80 bg-card p-5 shadow-sm transition-colors hover:border-sky-500/60 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-sky-600">
                {stepItem.step}
              </span>
              <h2 className="mt-4 text-lg font-semibold text-foreground">{stepItem.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{stepItem.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
