'use client'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { BronchSequence } from '../../content/types'
import styles from './bronch-stage.module.css'

/** The order a sequence is first shown in: rotated by its id, never the authored order. */
export function initialSequenceOrder(sequence: BronchSequence): readonly string[] {
  return orderChoices(sequence.id, sequence.steps).map((step) => step.id)
}

/**
 * Putting steps in order: moved up and down one at a time, committed as one order and read step
 * by step. A misplaced step the section marks critical is named as a safety error.
 */
export function BronchSequenceControl({
  sequence,
  order,
  committed,
  onChange,
}: {
  readonly sequence: BronchSequence
  readonly order: readonly string[]
  readonly committed: readonly string[] | null
  readonly onChange: (order: readonly string[]) => void
}) {
  const shown = committed ?? order
  const authoredIndex = new Map(sequence.steps.map((step, index) => [step.id, index] as const))
  const critical = new Set(sequence.criticalStepIds ?? [])
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= shown.length) return
    const next = [...shown]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return (
    <div
      className={styles.act}
      data-bronch-sequence={sequence.id}
      data-committed={committed !== null}
    >
      <p className={styles.verdict}>{sequence.prompt}</p>
      <ol className={styles.orderList} aria-label="The steps to put in order">
        {shown.map((stepId, index) => {
          const step = sequence.steps.find((candidate) => candidate.id === stepId)
          if (!step) return null
          const held = committed ? authoredIndex.get(stepId) === index : undefined
          const outcome = committed ? (held ? 'held' : 'other') : undefined
          return (
            <li
              key={stepId}
              className={styles.row}
              data-sequence-step={stepId}
              data-position={index + 1}
              data-outcome={outcome}
              data-critical-missed={committed && !held && critical.has(stepId) ? 'true' : undefined}
            >
              <span>
                <strong>{index + 1}.</strong> {step.label}
                {committed ? (
                  <span className={styles.verdict} data-sequence-verdict={outcome}>
                    {' '}
                    — {held ? 'Held.' : 'Did not hold.'}
                    {!held && critical.has(stepId)
                      ? ' Misplacing this step is a safety error.'
                      : ''}{' '}
                    {step.detail}
                  </span>
                ) : null}
              </span>
              {!committed ? (
                <span className={styles.orderActions}>
                  <button
                    type="button"
                    aria-label={`Move up: ${step.label}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move down: ${step.label}`}
                    disabled={index === shown.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
      {committed ? (
        <p className={styles.verdict} data-sequence-rationale>
          {sequence.rationale}
        </p>
      ) : null}
    </div>
  )
}
