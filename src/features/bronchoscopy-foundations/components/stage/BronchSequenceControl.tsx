'use client'

import type { BronchSequence } from '../../content/types'
import { sequenceOrderForRound } from '../../engine/sequenceOrder'
import styles from './bronch-stage.module.css'
import { MATCHED_WORDS, UNMATCHED_WORDS } from './verdictWords'

/**
 * The order a sequence is shown in for a round: a fixed permutation of its step ids, never the
 * worked order or a rotation of it (A7). Round 0 is what the task opens with.
 */
export function initialSequenceOrder(sequence: BronchSequence, round = 0): readonly string[] {
  return sequenceOrderForRound(sequence, round)
}

/**
 * Putting steps in order: moved up and down one at a time, checked as one order and read step by
 * step. A misplaced step says where the worked order puts it, and one the section marks critical is
 * named as a safety error. The learner may
 * open the worked order without arranging anything (`revealed`); that records nothing.
 *
 * The steps can be shuffled again on request (`onShuffle`). It is the same steps and the same
 * worked order in a new starting arrangement — optional practice, not a new situation — and the
 * order never changes unless the learner asks.
 */
export function BronchSequenceControl({
  sequence,
  order,
  committed,
  revealed = false,
  onChange,
  onShuffle,
}: {
  readonly sequence: BronchSequence
  readonly order: readonly string[]
  readonly committed: readonly string[] | null
  readonly revealed?: boolean
  readonly onChange: (order: readonly string[]) => void
  readonly onShuffle?: () => void
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
      {!committed && onShuffle ? (
        <p className={styles.figureCaption} data-sequence-shuffle-note>
          <button type="button" data-sequence-shuffle onClick={onShuffle}>
            Shuffle the steps again
          </button>{' '}
          Optional. The same steps in a new starting order; the worked order does not change and
          nothing is recorded.
        </p>
      ) : null}
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
                    — {held ? MATCHED_WORDS : UNMATCHED_WORDS}
                    {held
                      ? ''
                      : ` In the worked order this is step ${(authoredIndex.get(stepId) ?? 0) + 1}.`}
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
      ) : revealed ? (
        <section className={styles.row} data-sequence-explanation aria-label="The worked order">
          <p className={styles.kicker}>The worked order</p>
          <ol>
            {sequence.steps.map((step) => (
              <li key={step.id}>
                <strong>{step.label}.</strong>
                {critical.has(step.id) ? ' Misplacing this step is a safety error.' : ''}{' '}
                {step.detail}
              </li>
            ))}
          </ol>
          <p className={styles.verdict}>{sequence.rationale}</p>
        </section>
      ) : null}
    </div>
  )
}
