'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { DolphinSequence } from '../../../content/types'
import styles from '../dolphin-stage.module.css'

/** Positions a learner's order gets right, and the critical steps it misplaces. */
export function sequenceFeedback(sequence: DolphinSequence, order: readonly string[]) {
  const holds = order.map((id, index) => sequence.steps[index]?.id === id)
  const misplacedCritical = (sequence.criticalStepIds ?? []).filter(
    (id) => order.indexOf(id) !== sequence.steps.findIndex((step) => step.id === id),
  )
  return { holds, misplacedCritical, all: holds.every(Boolean) }
}

/**
 * Put the steps in order with the move buttons, then check. Each step then shows where it belongs
 * and why; a misplaced critical step is named as a safety point.
 */
export function SequenceControl({
  sequence,
  checked,
  onCheck,
  onRetry,
}: {
  readonly sequence: DolphinSequence
  readonly checked: readonly string[] | undefined
  readonly onCheck: (order: readonly string[]) => void
  readonly onRetry?: () => void
}) {
  const initial = useMemo(() => {
    const rotated = orderChoices(sequence.id, sequence.steps).map((step) => step.id)
    // A rotation can land on the authored order; reverse it then, so there is something to do.
    return rotated.join('|') === sequence.steps.map((s) => s.id).join('|')
      ? [...rotated].reverse()
      : rotated
  }, [sequence])
  const [draft, setDraft] = useState<readonly string[]>(initial)
  const order = checked ?? draft
  const byId = new Map(sequence.steps.map((step) => [step.id, step] as const))
  const feedback = checked ? sequenceFeedback(sequence, checked) : null
  const move = (index: number, delta: number) =>
    setDraft((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  return (
    <section className={styles.question} aria-label="The list to order" data-sequence={sequence.id}>
      <p className={styles.stem}>{sequence.prompt}</p>
      <ol className={styles.rows}>
        {order.map((id, index) => {
          const step = byId.get(id)
          if (!step) return null
          const holds = feedback?.holds[index]
          const position = sequence.steps.findIndex((candidate) => candidate.id === id) + 1
          return (
            <li
              key={id}
              className={styles.row}
              data-verdict={feedback ? (holds ? 'holds' : 'misplaced') : undefined}
              data-step={id}
            >
              <span>
                <strong>{index + 1}.</strong> {step.label}
              </span>
              {feedback ? (
                <p className={styles.rowFeedback}>
                  {holds ? 'In place. ' : `Belongs at position ${position}. `}
                  {step.detail}
                  {feedback.misplacedCritical.includes(id) ? ' This one is a safety step.' : ''}
                </p>
              ) : (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.button}
                    aria-label={`Move up: ${step.label}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    aria-label={`Move down: ${step.label}`}
                    disabled={index === order.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" size={16} />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {feedback ? <p className={styles.note}>{sequence.rationale}</p> : null}
      <div className={styles.actions}>
        {checked ? (
          onRetry ? (
            <button type="button" className={styles.button} onClick={onRetry}>
              Order again
            </button>
          ) : null
        ) : (
          <button
            type="button"
            className={styles.button}
            data-primary="true"
            onClick={() => onCheck(draft)}
            data-check-sequence
          >
            Check the order
          </button>
        )}
      </div>
    </section>
  )
}
