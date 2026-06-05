import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import {
  PleuralUltrasoundNav,
  pleuralUltrasoundNavItems,
} from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import { ultrasoundObjectives } from '@/features/pleural-ultrasound/content/learnContent'

export const metadata: Metadata = {
  title: 'Pleural Ultrasound',
  description:
    'Learn to read pleural ultrasound patterns, practice classifying them, and check your reasoning — the ultrasound-first foundation for pleural procedures.',
}

const base = '/pleural-procedures/pleural-ultrasound'

const pathSteps = [
  {
    href: `${base}/learn`,
    step: '1',
    title: 'Learn',
    description:
      'Why ultrasound comes first, the four effusion patterns, safe access, and dynamic signs.',
  },
  {
    href: `${base}/practice`,
    step: '2',
    title: 'Practice',
    description: 'Classify real ultrasound images in a commit-first lab with running feedback.',
  },
  {
    href: `${base}/assessment`,
    step: '3',
    title: 'Assessment',
    description: 'Eight questions that check pattern recognition and procedural reasoning.',
  },
]

export default function PleuralUltrasoundPage() {
  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Pleural ultrasound"
        description="The ultrasound-first foundation for every pleural procedure: read the patterns, practice on real images, then check your reasoning."
      />
      <PleuralUltrasoundNav activeHref={pleuralUltrasoundNavItems[0].href} />

      <section className="container max-w-4xl space-y-6">
        <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By the end of this module you can
          </p>
          <ul className="mt-3 grid gap-2 text-sm leading-7 text-foreground">
            {ultrasoundObjectives.map((objective) => (
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
