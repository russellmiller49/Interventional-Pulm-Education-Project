import type { Route } from 'next'
import { ArrowRight, BookOpenCheck, Clock3, FastForward, ListTree } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { firstPacLearningPathwaySectionId, pacLearningPathwaySections } from '../content'

export function IcuHemodynamicsLearnLandingV2() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-6 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            One continuous guided pathway
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Advance, validate, interpret, measure, and integrate
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
            Begin with the catheter at the introducer and follow it through RA, RV, PA, and wedge
            physiology. Every station uses the same synchronized three-panel workspace. Move in
            order or jump directly to any section; every station remains open.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <ListTree className="size-3.5 text-primary" aria-hidden="true" />
              {pacLearningPathwaySections.length} sections
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <FastForward className="size-3.5 text-primary" aria-hidden="true" />
              Jump ahead at any time
            </span>
          </div>
        </div>
        <Link
          href={`/icu-hemodynamics/learn?activity=${firstPacLearningPathwaySectionId}` as Route}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Start at the introducer <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      <section className="mt-8" aria-labelledby="pac-pathway-sections-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Pathway sections
            </p>
            <h2 id="pac-pathway-sections-heading" className="mt-2 text-2xl font-bold">
              Choose where to begin
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            The final signal-validation station is an integration capstone, not a duplicate
            introductory module.
          </p>
        </div>

        <ol className="mt-5 grid gap-4">
          {pacLearningPathwaySections.map((section, index) => (
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
                    {section.kind === 'capstone' ? 'Integration capstone' : 'Guided station'}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {section.description}
                </p>
              </div>
              <Link
                href={`/icu-hemodynamics/learn?activity=${section.id}` as Route}
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
