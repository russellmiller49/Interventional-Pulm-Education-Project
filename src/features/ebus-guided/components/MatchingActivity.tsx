'use client'
import { useState } from 'react'
import type { Matching } from '../content/types'
import styles from './course.module.css'
export function MatchingActivity({
  activity,
  onComplete,
}: {
  activity: Matching
  onComplete: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const correct = activity.pairs.every((p) => answers[p.id] === p.id)
  const options = [...activity.pairs.slice(1), activity.pairs[0]]
  return (
    <div className={styles.sequence}>
      {activity.pairs.map((p) => (
        <label key={p.id}>
          {p.cue}
          <select
            aria-label={p.cue}
            value={answers[p.id] ?? ''}
            disabled={checked && correct}
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
      <button
        type="button"
        disabled={Object.keys(answers).length < activity.pairs.length || (checked && correct)}
        onClick={() => {
          setChecked(true)
          if (correct) onComplete()
        }}
      >
        Check matches
      </button>
      {checked && (
        <p role="status">
          {correct
            ? activity.explanation
            : 'One or more pairs need another look. Review the teaching, then revise your matches.'}
        </p>
      )}
    </div>
  )
}
