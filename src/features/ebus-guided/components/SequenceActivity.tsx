'use client'
import { useMemo, useState } from 'react'
import type { Sequence } from '../content/types'
import styles from './course.module.css'
export function SequenceActivity({
  sequence,
  onComplete,
}: {
  sequence: Sequence
  onComplete: () => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const order = useMemo(() => [...sequence.steps.slice(1), sequence.steps[0]], [sequence])
  const correct = selected.join('|') === sequence.steps.map((s) => s.id).join('|')
  return (
    <div className={styles.sequence}>
      <p>{sequence.prompt}</p>
      <ol aria-label="Your sequence">
        {selected.map((id, i) => (
          <li key={id}>
            {i + 1}. {sequence.steps.find((s) => s.id === id)?.text}
          </li>
        ))}
      </ol>
      {order
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
      {!checked && selected.length === sequence.steps.length && (
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
      {checked && (
        <p role="status">
          {correct
            ? 'The sequence is complete. ' + sequence.explanation
            : 'Reconsider the order. ' + sequence.explanation}
        </p>
      )}
      {selected.length > 0 && !correct && (
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
  )
}
