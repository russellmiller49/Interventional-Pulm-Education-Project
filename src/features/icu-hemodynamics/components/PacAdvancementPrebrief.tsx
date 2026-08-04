'use client'

import { AlertTriangle, OctagonX, ShieldCheck } from 'lucide-react'

import {
  pacPrebriefBalloonDiscipline,
  pacPrebriefBeforeYouStart,
  pacPrebriefExpectedTransitions,
  pacPrebriefNotCoveredHere,
  pacPrebriefNotCoveredNotice,
  pacPrebriefScope,
  pacPrebriefStopConditions,
} from '../content'

/**
 * The safety prebrief that stands between the learner and the advancement controls (H0/H1 §5).
 *
 * Placement is the point. The manipulation controls for this section live in the predict and act
 * phases; this renders in recognize, and the control that opens those phases is disabled until the
 * learner acknowledges it. That is a sequencing device, not a lock on the section — the pathway rail
 * and the URL still open every station directly.
 *
 * The lesson must not leave the impression that reading idealized waveforms is enough to advance a
 * catheter safely, so the scope statement is the first thing rendered and the "not covered here"
 * block is not hidden behind a disclosure.
 */
export function PacAdvancementPrebrief({
  acknowledged,
  onAcknowledge,
}: {
  readonly acknowledged: boolean
  readonly onAcknowledge: () => void
}) {
  return (
    <section className="grid gap-3 text-sm" aria-labelledby="pac-prebrief-heading">
      <header className="grid gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
        <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> Before you move the catheter
        </p>
        <h3 id="pac-prebrief-heading" className="text-base font-bold">
          What this section is, and what it is not
        </h3>
        <dl className="grid gap-1.5 text-xs leading-5">
          <div>
            <dt className="font-bold">It teaches</dt>
            <dd>{pacPrebriefScope.teaches}</dd>
          </div>
          <div>
            <dt className="font-bold">It does not teach</dt>
            <dd>{pacPrebriefScope.doesNotTeach}</dd>
          </div>
          <div>
            <dt className="font-bold">At the bedside</dt>
            <dd>{pacPrebriefScope.supervision}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="pac-prebrief-before-heading" className="grid gap-1.5">
        <h4
          id="pac-prebrief-before-heading"
          className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary"
        >
          Have these in hand first
        </h4>
        <ul className="grid list-disc gap-1 pl-4 text-xs leading-5 text-muted-foreground">
          {pacPrebriefBeforeYouStart.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pac-prebrief-expected-heading" className="grid gap-1.5">
        <h4
          id="pac-prebrief-expected-heading"
          className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary"
        >
          What should happen
        </h4>
        <ul className="grid list-disc gap-1 pl-4 text-xs leading-5 text-muted-foreground">
          {pacPrebriefExpectedTransitions.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="pac-prebrief-stop-heading"
        className="grid gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3"
      >
        <h4
          id="pac-prebrief-stop-heading"
          className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-destructive"
        >
          <OctagonX className="size-3.5" aria-hidden="true" /> Reasons to stop
        </h4>
        <dl className="grid gap-2 text-xs leading-5">
          {pacPrebriefStopConditions.map((condition) => (
            <div key={condition.id}>
              <dt className="font-bold">{condition.trigger}</dt>
              <dd className="text-muted-foreground">{condition.response}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="pac-prebrief-balloon-heading" className="grid gap-1.5">
        <h4
          id="pac-prebrief-balloon-heading"
          className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary"
        >
          Balloon discipline
        </h4>
        <ul className="grid list-disc gap-1 pl-4 text-xs leading-5 text-muted-foreground">
          {pacPrebriefBalloonDiscipline.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="pac-prebrief-gaps-heading"
        className="grid gap-1.5 rounded-xl border border-border bg-muted/30 p-3"
      >
        <h4
          id="pac-prebrief-gaps-heading"
          className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted-foreground"
        >
          <AlertTriangle className="size-3.5" aria-hidden="true" /> Not covered here
        </h4>
        <ul className="grid list-disc gap-1 pl-4 text-xs leading-5 text-muted-foreground">
          {pacPrebriefNotCoveredHere.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
        <p className="text-xs leading-5 text-muted-foreground">{pacPrebriefNotCoveredNotice}</p>
      </section>

      {acknowledged ? (
        <p className="rounded-lg bg-muted p-2.5 text-xs leading-5 text-muted-foreground">
          Prebrief acknowledged. The simulated advancement controls are open below.
        </p>
      ) : (
        <button
          type="button"
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={onAcknowledge}
        >
          I have read the prebrief — open the simulated advancement
        </button>
      )}
    </section>
  )
}
