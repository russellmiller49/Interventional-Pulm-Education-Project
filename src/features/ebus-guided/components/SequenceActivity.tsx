'use client'
import { useMemo, useState } from 'react'
import type { Sequence } from '../content/types'
import styles from './course.module.css'
/**
 * Ordering task. Checking gives feedback; "Show the sequence" lays out the authored order with
 * its explanation and tells the caller the answer was shown, which is not the same as completing it.
 */
export function SequenceActivity({
  sequence,
  onComplete,
  onReveal,
}: {
  sequence: Sequence
  onComplete: () => void
  onReveal?: () => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [shown, setShown] = useState(false)
  const order = useMemo(() => [...sequence.steps.slice(1), sequence.steps[0]], [sequence])
  const correct = selected.join('|') === sequence.steps.map((s) => s.id).join('|')
  const settled = shown || (checked && correct)
  return (
    <div className={styles.sequence} data-sequence-shown={shown || undefined}>
      <p>{sequence.prompt}</p>
      <ol aria-label={shown ? 'The authored sequence' : 'Your sequence'}>
        {selected.map((id, i) => (
          <li key={id}>
            {i + 1}. {sequence.steps.find((s) => s.id === id)?.text}
          </li>
        ))}
      </ol>
      {!settled &&
        order
          .filter((s) => !selected.includes(s.id))
          .map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelected((v) => [...v, s.id])
                setChecked(false)
              }}
            >
              {s.text}
            </button>
          ))}
      <div className={styles.checkActions}>
        {!checked && !shown && selected.length === sequence.steps.length && (
          <button
            type="button"
            onClick={() => {
              setChecked(true)
              if (correct) onComplete()
            }}
          >
            Check sequence
          </button>
        )}
        {!settled && (
          <button
            type="button"
            onClick={() => {
              setSelected(sequence.steps.map((s) => s.id))
              setShown(true)
              setChecked(false)
              onReveal?.()
            }}
          >
            Show the sequence
          </button>
        )}
        {selected.length > 0 && !settled && (
          <button
            type="button"
            onClick={() => {
              setSelected([])
              setChecked(false)
            }}
          >
            Clear sequence
          </button>
        )}
      </div>
      {shown && (
        <p role="status">This is the authored sequence, shown on request. {sequence.explanation}</p>
      )}
      {checked && !shown && (
        <p role="status">
          {correct
            ? 'The sequence is complete. ' + sequence.explanation
            : 'Reconsider the order. ' + sequence.explanation}
        </p>
      )}
    </div>
  )
}
