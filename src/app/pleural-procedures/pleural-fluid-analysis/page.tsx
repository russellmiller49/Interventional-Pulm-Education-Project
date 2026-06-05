import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import {
  PleuralFluidAnalysisNav,
  pleuralFluidAnalysisNavItems,
} from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisNav'
import { fluidObjectives } from '@/features/pleural-fluid-analysis/content/learnContent'

export const metadata: Metadata = {
  title: 'Pleural Fluid Analysis',
  description:
    "Learn Light's criteria and the pseudoexudate trap, practice in a differential cockpit, then match the findings to the disease.",
}

const base = '/pleural-procedures/pleural-fluid-analysis'

const pathSteps = [
  {
    href: `${base}/learn`,
    step: '1',
    title: 'Learn',
    description: "Light's criteria, pseudoexudates, targeted tests, and reading the appearance.",
  },
  {
    href: `${base}/practice`,
    step: '2',
    title: 'Practice',
    description: 'Enter fluid values and watch the ranked differential and Light’s meters respond.',
  },
  {
    href: `${base}/assessment`,
    step: '3',
    title: 'Assessment',
    description: 'Match the full pattern of findings to the most likely diagnosis.',
  },
]

export default function PleuralFluidAnalysisPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Pleural fluid analysis"
        description="Pair the fluid numbers with the clinical story: classify the effusion, reconcile the pseudoexudate, and let the appearance steer the targeted tests."
      />
      <PleuralFluidAnalysisNav activeHref={pleuralFluidAnalysisNavItems[0].href} />

      <section className="container max-w-4xl space-y-6">
        <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By the end of this module you can
          </p>
          <ul className="mt-3 grid gap-2 text-sm leading-7 text-foreground">
            {fluidObjectives.map((objective) => (
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
