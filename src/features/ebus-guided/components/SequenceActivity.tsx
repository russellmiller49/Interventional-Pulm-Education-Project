'use client'
import { useMemo, useState } from 'react'
import type { Sequence } from '../content/types'
import styles from './course.module.css'
/**
 * Ordering task. Checking gives feedback; "Show the sequence" lays out the authored order with
 * its explanation and tells the caller the answer was shown, which is not the same as completing it.
 *
 * Three repairs from EBUS-PRE-REVIEW-01. The list numbered itself twice — a hard-coded "1." in
 * front of the list marker the stylesheet already draws (L2-3); the marker is now the only
 * numbering. The steps are buttons that look like cards, and nothing said to select them in
 * order or that the keyboard works the same way, so a learner's first instinct was to drag
 * (L2-4); the instruction now says what the interaction is and the running order is labelled.
 * Feedback on a wrong order names the first position that differs from the authored order,
 * which is read from the existing key: which sequences are accepted is unchanged.
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
  /*
   * "Try it yourself" (EBUS-PRE-REVIEW-04, L17-3). Some steps print a worked label — the N
   * category of each target — that answers the ordering. The learner may choose to hide it; it is
   * never hidden by default, nothing records the choice, the check reads the same step ids, and
   * Show the sequence, its explanation and the full step text on the result stay as they were.
   */
  const [bare, setBare] = useState(false)
  const offerBare = !!sequence.tryItYourself && sequence.steps.some((step) => step.bare)
  const order = useMemo(() => [...sequence.steps.slice(1), sequence.steps[0]], [sequence])
  const authored = sequence.steps.map((s) => s.id)
  const correct = selected.join('|') === authored.join('|')
  const settled = shown || (checked && correct)
  const remaining = sequence.steps.length - selected.length
  const firstDifference = selected.findIndex((id, i) => id !== authored[i]) + 1
  const textFor = (id: string) => {
    const step = sequence.steps.find((s) => s.id === id)
    return bare && !settled ? (step?.bare ?? step?.text) : step?.text
  }
  return (
    <div className={styles.sequence} data-sequence-shown={shown || undefined}>
      <p>{sequence.prompt}</p>
      {offerBare && !settled && (
        <div className={styles.tryItYourself} data-try-it-yourself>
          <button
            type="button"
            className={styles.secondary}
            aria-pressed={bare}
            onClick={() => setBare((value) => !value)}
          >
            {bare ? sequence.tryItYourself!.show : sequence.tryItYourself!.hide}
          </button>
          <p className={styles.muted}>{sequence.tryItYourself!.note}</p>
        </div>
      )}
      {!settled && (
        <p className={styles.muted} data-sequence-instruction>
          Select the steps in the order you would do them: choose the first step, then the next,
          until all {sequence.steps.length} are in the list. Each step is a button — click it, or
          move to it with Tab and press Enter or Space. Clear the sequence to start again.
        </p>
      )}
      <ol aria-label={shown ? 'The authored sequence' : 'Your sequence so far'} data-sequence-order>
        {selected.map((id) => (
          <li key={id}>{textFor(id)}</li>
        ))}
      </ol>
      {!settled && selected.length === 0 && <p className={styles.muted}>No steps selected yet.</p>}
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
              {textFor(s.id)}
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
      {!settled && remaining > 0 && selected.length > 0 && (
        <p className={styles.muted} data-sequence-remaining>
          {remaining === 1
            ? 'One step left to place; the check opens once the order is complete.'
            : remaining + ' steps left to place; the check opens once the order is complete.'}
        </p>
      )}
      {shown && (
        <p role="status">This is the authored sequence, shown on request. {sequence.explanation}</p>
      )}
      {checked && !shown && (
        <p role="status">
          {correct
            ? 'The sequence is complete. ' + sequence.explanation
            : 'Reconsider the order. Your step ' +
              firstDifference +
              ' is the first that differs from the authored order; the steps before it are in place. ' +
              sequence.explanation}
        </p>
      )}
    </div>
  )
}
