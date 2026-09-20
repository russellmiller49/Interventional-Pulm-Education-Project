'use client'
import { useState } from 'react'
import type { Matching } from '../content/types'
import styles from './course.module.css'
/**
 * Matching task. Checking gives feedback; "Show the matches" fills in the authored pairs with the
 * explanation and tells the caller the answer was shown, which is not the same as completing it.
 *
 * The feedback is per row (EBUS-PRE-REVIEW-01, L1-6). A single "one or more pairs need another
 * look" left a learner who had two of three right with nothing to work from, and the authored
 * mapping already says which row is which. Only the rows the learner filled in are judged, the
 * selections stay editable so the check can be repeated, and there is no count, no score and no
 * requirement to get there before "Show the matches" is available.
 */
export function MatchingActivity({
  activity,
  onComplete,
  onReveal,
}: {
  activity: Matching
  onComplete: () => void
  onReveal?: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [shown, setShown] = useState(false)
  const correct = activity.pairs.every((p) => answers[p.id] === p.id)
  const options = [...activity.pairs.slice(1), activity.pairs[0]]
  const settled = shown || (checked && correct)
  const rowState = (id: string) =>
    !checked || shown ? undefined : answers[id] === id ? 'matched' : 'review'
  return (
    <div className={styles.sequence} data-matching-shown={shown || undefined}>
      {activity.pairs.map((p) => {
        const state = rowState(p.id)
        return (
          <label key={p.id} data-matching-row={p.id} data-matching-state={state}>
            {p.cue}
            <select
              aria-label={p.cue}
              aria-describedby={state ? 'matching-row-' + p.id : undefined}
              value={answers[p.id] ?? ''}
              disabled={settled}
              onChange={(e) => {
                setChecked(false)
                setAnswers((a) => ({ ...a, [p.id]: e.target.value }))
              }}
            >
              <option value="">Choose a match</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.response}
                </option>
              ))}
            </select>
            {state ? (
              <span id={'matching-row-' + p.id} className={styles.rowFeedback}>
                {state === 'matched'
                  ? 'Matches the authored pairing.'
                  : 'Not the authored pairing for this one. Change this match and check again, or show the matches.'}
              </span>
            ) : null}
          </label>
        )
      })}
      <div className={styles.checkActions}>
        <button
          type="button"
          disabled={Object.keys(answers).length < activity.pairs.length || settled}
          onClick={() => {
            setChecked(true)
            if (correct) onComplete()
          }}
        >
          Check matches
        </button>
        {!settled && (
          <button
            type="button"
            onClick={() => {
              setAnswers(Object.fromEntries(activity.pairs.map((p) => [p.id, p.id])))
              setShown(true)
              setChecked(false)
              onReveal?.()
            }}
          >
            Show the matches
          </button>
        )}
      </div>
      {shown && (
        <p role="status">
          These are the authored matches, shown on request. {activity.explanation}
        </p>
      )}
      {checked && !shown && (
        <p role="status">
          {correct
            ? activity.explanation
            : 'Each row above says whether it matches the authored pairing. Revise the ones marked for another look and check again, or show the matches.'}
        </p>
      )}
    </div>
  )
}
