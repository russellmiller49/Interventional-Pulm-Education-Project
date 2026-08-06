'use client'

import { Activity, ShieldAlert } from 'lucide-react'

import {
  formatReading,
  type CoachingReading,
  type PostActionCoaching,
} from '../content/postActionCoaching'
import styles from './mechanical-ventilation.module.css'

const directionWords: Readonly<Record<CoachingReading['direction'], string>> = {
  rose: 'rose',
  fell: 'fell',
  held: 'unchanged',
  'small-drift': 'small drift',
}

/** Spelled out beside the short label, so "small drift" is not left to be guessed at. */
const directionNotes: Readonly<Partial<Record<CoachingReading['direction'], string>>> = {
  'small-drift': 'less than one full display unit',
}

/**
 * Reading rows.
 *
 * Before and after are printed at the precision the surface they come from prints, and they are
 * formatted independently — so the two numbers on the row can differ even when the reading moved by
 * less than one whole unit of that precision. That is exactly what `small-drift` is for: the row says
 * "44 → 43 · small drift", never "44 → 43 · unchanged".
 *
 * A reading that was not available before the action shows as revealed rather than as a change of
 * zero — the difference matters, and averaging it into "unchanged" would be a small lie. It is not
 * called a first reading: the model keeps one slot for a pending gas, so after a second order it no
 * longer knows whether an earlier one had resulted.
 */
function ReadingRow({ reading }: { reading: CoachingReading }) {
  const revealed = reading.before === null
  const note = directionNotes[reading.direction]
  return (
    <div data-reading={reading.id} data-direction={revealed ? 'revealed' : reading.direction}>
      <dt>{reading.label}</dt>
      <dd>
        <span className={styles.coachingValues}>
          {revealed ? (
            <em>not available then</em>
          ) : (
            <>
              {formatReading(reading.before as number, reading.precision)}
              <span aria-hidden="true"> → </span>
              <span className="sr-only"> to </span>
            </>
          )}
          <strong>{formatReading(reading.after, reading.precision)}</strong> {reading.unit}
        </span>
        <small>
          {revealed ? 'new reading' : directionWords[reading.direction]}
          {note ? <em> — {note}</em> : null}
        </small>
      </dd>
    </div>
  )
}

/**
 * What the model did after the learner acted, once it has actually done it.
 *
 * Three claims, kept visibly apart: the readings themselves, what those readings support, and what
 * they have not shown. The last one is the reason this block can exist before the debrief without
 * becoming the debrief — a non-response is evidence against a mechanism and is not proof it is
 * absent, and this says so every time rather than letting the learner supply the stronger reading.
 */
export function PostActionCoachingPanel({ coaching }: { coaching: PostActionCoaching }) {
  return (
    <section
      className={styles.coachingPanel}
      data-mv-post-action-coaching={coaching.verdict}
      aria-labelledby="mv-coaching-heading"
      role="status"
    >
      <div className={styles.coachingHeading}>
        <Activity aria-hidden="true" />
        <div>
          <span>After {coaching.actionLabel.toLowerCase()}</span>
          <h4 id="mv-coaching-heading">What the patient did next</h4>
        </div>
        <span className={styles.coachingVerdict} data-verdict={coaching.verdict}>
          {coaching.verdictLabel}
        </span>
      </div>

      <dl className={styles.coachingReadings} aria-label="Readings before and after this action">
        {coaching.observed.map((reading) => (
          <ReadingRow key={reading.id} reading={reading} />
        ))}
      </dl>

      <div className={styles.coachingClaims}>
        <p data-coaching-claim="observed">
          <strong>What you observed</strong>
          {coaching.observedSummary}
        </p>
        <p data-coaching-claim="interpretation">
          <strong>What that supports</strong>
          {coaching.interpretation}
        </p>
        <p data-coaching-claim="not-demonstrated">
          <strong>What it has not shown</strong>
          {coaching.notDemonstrated}
        </p>
        <p data-coaching-claim="reassess">
          <strong>Reassess next</strong>
          {coaching.reassess}
        </p>
        <p
          data-coaching-claim="stabilization"
          data-stabilization-required={coaching.stabilizationRequired}
        >
          <strong>
            {coaching.stabilizationRequired ? <ShieldAlert aria-hidden="true" /> : null}
            Another immediate stabilizing action?
          </strong>
          {coaching.stabilization}
        </p>
      </div>
    </section>
  )
}
