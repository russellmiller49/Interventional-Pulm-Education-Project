import type { Route } from 'next'
import type { ReactNode } from 'react'
import { ArrowRight, BookOpenCheck, Clock3, FastForward, ListTree } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { firstPathwaySectionId, stageLabel, type LearningPathway } from './types'

interface PathwayLandingProps {
  readonly pathway: LearningPathway
  /** Builds the deep link for a section. Keep `?activity=<sectionId>` so back/forward still work. */
  readonly sectionHref: (sectionId: string) => string
  readonly eyebrow?: string
  readonly intro: string
  readonly startLabel?: string
  /** Optional notice rendered under the hero — review status, source boundaries, and the like. */
  readonly notice?: ReactNode
  readonly sectionsHeading?: string
  readonly sectionsNote?: string
}

/**
 * The Learn landing: the module's arc sentence as the H1 over a single-column ordinal list.
 *
 * Single column is deliberate. A two-column grid reads as an unordered menu of lessons and
 * destroys the reading-order signal that makes the module legible as a course.
 */
export function PathwayLanding({
  pathway,
  sectionHref,
  eyebrow = 'One continuous guided pathway',
  intro,
  startLabel = 'Start at the beginning',
  notice,
  sectionsHeading = 'Choose where to begin',
  sectionsNote,
}: PathwayLandingProps) {
  const firstSectionId = firstPathwaySectionId(pathway)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-6 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{pathway.arcSentence}</h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">{intro}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <ListTree className="size-3.5 text-primary" aria-hidden="true" />
              {pathway.sections.length} sections
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <FastForward className="size-3.5 text-primary" aria-hidden="true" />
              Jump ahead at any time
            </span>
          </div>
        </div>
        <Link
          href={sectionHref(firstSectionId) as Route}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          {startLabel} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      {notice ? <div className="mt-6">{notice}</div> : null}

      <section className="mt-8" aria-labelledby="pathway-sections-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Pathway sections
            </p>
            <h2 id="pathway-sections-heading" className="mt-2 text-2xl font-bold">
              {sectionsHeading}
            </h2>
          </div>
          {sectionsNote ? (
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">{sectionsNote}</p>
          ) : null}
        </div>

        <ol className="mt-5 grid gap-4">
          {pathway.sections.map((section, index) => (
            <li
              key={section.id}
              className="grid gap-5 rounded-2xl border bg-card p-5 shadow-sm md:grid-cols-[auto_1fr_auto] md:items-center"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" aria-hidden="true" /> {section.minutes} minutes
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpenCheck className="size-3.5" aria-hidden="true" />{' '}
                    {stageLabel(section.stage)}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {section.description}
                </p>
              </div>
              <Link
                href={sectionHref(section.id) as Route}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                Open section <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
