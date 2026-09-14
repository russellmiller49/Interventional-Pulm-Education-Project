'use client'
import { useState } from 'react'
import type { Matching } from '../content/types'
import styles from './course.module.css'
/**
 * Matching task. Checking gives feedback; "Show the matches" fills in the authored pairs with the
 * explanation and tells the caller the answer was shown, which is not the same as completing it.
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
  return (
    <div className={styles.sequence} data-matching-shown={shown || undefined}>
      {activity.pairs.map((p) => (
        <label key={p.id}>
          {p.cue}
          <select
            aria-label={p.cue}
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
        </label>
      ))}
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
            : 'One or more pairs need another look. Review the teaching, revise your matches, or show the matches.'}
        </p>
      )}
    </div>
  )
}
