import { Clock3 } from 'lucide-react'

import {
  pacLearningPathwaySections,
  pacSectionBoundaryLabels,
  pacSectionReadinessFor,
  recommendedPriorSection,
  type PacLearningPathwaySectionId,
} from '../content'

/**
 * The hemodynamics-local readiness display (H0/H1 requirement 6).
 *
 * The shared `PathwayLanding` and `PathwayNav` render an ordinal, minutes, a stage label, a title
 * and a description, and neither takes a per-section slot for anything else. Rather than change a
 * shared component, this renders the readiness facts beside them from module-owned content.
 *
 * Nothing here gates. "Recommended before this" is a reading-order suggestion next to a link that
 * is always open.
 */

function BoundaryTag({ sectionId }: { readonly sectionId: PacLearningPathwaySectionId }) {
  const { boundary } = pacSectionReadinessFor(sectionId)
  const { label } = pacSectionBoundaryLabels[boundary]
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide',
        boundary === 'simulated-procedure'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
          : 'bg-primary/10 text-primary',
      ].join(' ')}
    >
      {label}
    </span>
  )
}

/** The readiness facts for one section, shown where the learner is about to start it. */
export function PacSectionReadinessCard({
  sectionId,
}: {
  readonly sectionId: PacLearningPathwaySectionId
}) {
  const readiness = pacSectionReadinessFor(sectionId)
  const section = pacLearningPathwaySections.find((candidate) => candidate.id === sectionId)
  const prior = recommendedPriorSection(sectionId)
  const { detail } = pacSectionBoundaryLabels[readiness.boundary]

  return (
    <section
      className="grid gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5"
      aria-label={`Before you start: ${section?.title ?? sectionId}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary">
          Before you start
        </p>
        <BoundaryTag sectionId={sectionId} />
        {section ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Clock3 className="size-3.5" aria-hidden="true" /> about {section.minutes} minutes
          </span>
        ) : null}
      </header>

      <dl className="grid gap-2 text-xs leading-5">
        <div>
          <dt className="font-bold uppercase tracking-wide text-primary">Where this sits</dt>
          <dd>{readiness.level}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide text-primary">
            Recommended before this
          </dt>
          <dd>
            {prior
              ? `${prior.title}. You can still start here — the order is a recommendation, not a lock.`
              : 'Nothing. This is the recommended first section of the module.'}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide text-primary">
            You should already be able to
          </dt>
          <dd>{readiness.beforeStarting}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide text-primary">What you will practice</dt>
          <dd>{readiness.whatYouWillPractice}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide text-primary">Simulated or bedside</dt>
          <dd>{detail}</dd>
        </div>
      </dl>
    </section>
  )
}

/** Every section's readiness facts, for the Learn landing. */
export function PacSectionReadinessList() {
  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby="pac-readiness-heading"
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
        What each section expects
      </p>
      <h2 id="pac-readiness-heading" className="mt-2 text-xl font-bold">
        Where to start, and what each section assumes
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Sections are listed in a recommended reading order. Nothing is locked: every section below
        opens directly, and finishing one records that you worked through it rather than making a
        claim about clinical readiness.
      </p>

      <ol className="mt-5 grid gap-3">
        {pacLearningPathwaySections.map((section, index) => {
          const readiness = pacSectionReadinessFor(section.id as PacLearningPathwaySectionId)
          const prior = recommendedPriorSection(section.id as PacLearningPathwaySectionId)
          return (
            <li
              key={section.id}
              className="grid gap-3 rounded-2xl border bg-muted/20 p-4 md:grid-cols-[auto_1fr]"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold">{section.title}</h3>
                  <BoundaryTag sectionId={section.id as PacLearningPathwaySectionId} />
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Clock3 className="size-3.5" aria-hidden="true" /> about {section.minutes}{' '}
                    minutes
                  </span>
                </div>
                <dl className="grid gap-1.5 text-xs leading-5">
                  <div className="sm:flex sm:gap-2">
                    <dt className="font-bold text-primary sm:min-w-44">Where this sits</dt>
                    <dd className="text-muted-foreground">{readiness.level}</dd>
                  </div>
                  <div className="sm:flex sm:gap-2">
                    <dt className="font-bold text-primary sm:min-w-44">Recommended before this</dt>
                    <dd className="text-muted-foreground">{prior ? prior.title : 'Nothing'}</dd>
                  </div>
                  <div className="sm:flex sm:gap-2">
                    <dt className="font-bold text-primary sm:min-w-44">
                      You should already be able to
                    </dt>
                    <dd className="text-muted-foreground">{readiness.beforeStarting}</dd>
                  </div>
                  <div className="sm:flex sm:gap-2">
                    <dt className="font-bold text-primary sm:min-w-44">What you will practice</dt>
                    <dd className="text-muted-foreground">{readiness.whatYouWillPractice}</dd>
                  </div>
                </dl>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
