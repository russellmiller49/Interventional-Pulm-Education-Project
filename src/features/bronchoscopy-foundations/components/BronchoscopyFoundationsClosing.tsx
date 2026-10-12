'use client'

import { Link } from '@/i18n/navigation'
import { BRONCH_PHASES, BRONCH_SECTION_IDS } from '../content/sectionIds'
import {
  BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF,
  BRONCHOSCOPY_FOUNDATIONS_NAV_BASE,
  BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF,
  BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF,
} from '../content/routes'
import { useBronchoscopyFoundationsRecord } from './useBronchoscopyFoundationsRecord'

/** What each phase leaves the fellow able to do, in the phase order of `BRONCH_PHASES`. */
const PHASE_OUTCOMES: Readonly<Record<string, string>> = {
  prepare:
    'Decide whether to go ahead, check the scope, and plan the anesthesia, sedation and monitoring.',
  handle: 'Drive the scope with three movements, cross the cords and reach the carina.',
  navigate: 'Name every segment, recover a lost view, and survey both lungs in one fixed order.',
  'describe-and-sample':
    'Describe a finding and report it, then wash, lavage, brush and biopsy, and route each specimen.',
  respond:
    'Make the first moves when the patient deteriorates or bleeds, and work through a breathing tube.',
}

const NEXT_STEPS = [
  'Tell your attending which sections you finished, and ask to be watched on the bench before a patient.',
  'Take the first-move cards with you: bleeding, the deteriorating patient, the falling delivered volume.',
  'After each supervised case, ask for one thing to practice next. Write it down.',
  'Come back to a section before the procedure that uses it. Five minutes is enough.',
] as const

/**
 * The closing screen (rewrite plan, rule 5). It replaces the section on training records: one
 * statement of what an online course cannot show, and what the fellow does next at the bedside.
 */
export function BronchoscopyFoundationsClosing() {
  const { record, hydrated } = useBronchoscopyFoundationsRecord()
  const total = BRONCH_SECTION_IDS.length
  return (
    <div
      className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:px-8"
      data-bronch-closing
    >
      <header className="grid gap-4">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Bronchoscopy Foundations
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The sections end here. The training does not.
        </h1>
        <p className="text-sm text-muted-foreground" data-closing-record>
          {hydrated
            ? `On this device: ${record.visitedSectionIds.length} of ${total} sections opened, ${record.reviewedSectionIds.length} marked reviewed.`
            : `${total} sections.`}
        </p>
      </header>

      <section aria-labelledby="closing-covered" className="grid gap-3">
        <h2 id="closing-covered" className="text-xl font-bold">
          What you can now do on paper
        </h2>
        <ul className="grid gap-2 leading-7">
          {BRONCH_PHASES.map((phase) => (
            <li key={phase.id}>
              <strong>{phase.title}.</strong> {PHASE_OUTCOMES[phase.id]}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="closing-limits"
        className="grid gap-3 rounded-2xl border bg-card p-5"
        data-competence-statement
      >
        <h2 id="closing-limits" className="text-xl font-bold">
          What this course cannot show
        </h2>
        <p className="leading-7">
          Finishing the sections shows that you did them. Your answers show how you reason. The
          simulator shows where a camera went. None of them shows your hands on a scope in a
          patient.
        </p>
        <p className="leading-7">
          Someone has to watch you for that. The faculty who watch you judge when you are ready, and
          your institution grants privileges. Feeling ready is not evidence either way.
        </p>
      </section>

      <section aria-labelledby="closing-next" className="grid gap-3">
        <h2 id="closing-next" className="text-xl font-bold">
          What to do next
        </h2>
        <ol className="grid list-decimal gap-2 pl-6 leading-7">
          {NEXT_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <nav
        aria-label="Where to go from here"
        className="flex flex-wrap gap-5 border-t pt-5 text-sm"
      >
        <Link className="min-h-11 py-3 text-primary" href={BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF}>
          Try the integrated cases
        </Link>
        <Link className="min-h-11 py-3 text-primary" href={BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF}>
          Practice short cases
        </Link>
        <Link className="min-h-11 py-3 text-primary" href={BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF}>
          Reference and sources
        </Link>
        <Link className="min-h-11 py-3 text-primary" href={BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}>
          Back to the overview
        </Link>
      </nav>
    </div>
  )
}
