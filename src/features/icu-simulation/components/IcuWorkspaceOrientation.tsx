import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { Link } from '@/i18n/navigation'

import {
  ICU_WORKSPACE_ORIENTATION_ID,
  icuWorkspaceOrientationLoop,
  icuWorkspaceOrientationSections,
  icuWorkspaceOrientationSummary,
  icuWorkspaceOrientationTitle,
} from '../content'

const pathway = criticalCareLearningPathway('icu-simulation')

/**
 * The module's orientation section. Didactic on purpose: the loop has to be legible before the
 * first scenario, and a scenario cannot teach the loop it already assumes.
 */
export function IcuWorkspaceOrientation() {
  const next = nextPathwaySection(pathway, ICU_WORKSPACE_ORIENTATION_ID)

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
        Section 1 of {pathway.sections.length} · Orientation
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{icuWorkspaceOrientationTitle}</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
        {icuWorkspaceOrientationSummary}
      </p>

      {icuWorkspaceOrientationSections.map((section) => (
        <section
          key={section.id}
          className="mt-10"
          aria-labelledby={`icu-orientation-${section.id}`}
        >
          <h2
            id={`icu-orientation-${section.id}`}
            className="text-2xl font-semibold tracking-tight"
          >
            {section.title}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 max-w-3xl leading-7">
              {paragraph}
            </p>
          ))}
          {section.bullets ? (
            <ul className="mt-4 grid max-w-3xl gap-2 text-sm leading-6 text-muted-foreground">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="rounded-xl border bg-card px-4 py-3">
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}

          {section.id === 'the-loop' ? (
            <ol className="mt-5 grid gap-3">
              {icuWorkspaceOrientationLoop.map((step, index) => (
                <li
                  key={step.id}
                  className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-[auto_1fr] md:items-start"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ))}

      {next ? (
        <Link
          href={`/icu-simulation/practice?case=${next.id}` as Route}
          className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Continue to next section: {next.title}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </main>
  )
}
