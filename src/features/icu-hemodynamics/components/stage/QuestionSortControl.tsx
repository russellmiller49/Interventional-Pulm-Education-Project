'use client'

import { useId } from 'react'

import type { QuestionSort } from '../../content/questionSort'
import styles from './hemodynamics-stage.module.css'

/**
 * The question sort: seven bedside questions, each attributed to one of three origins.
 *
 * Optional (HD-01). A learner can place any rows and check them, or open the worked sort without
 * placing anything. After a check, each placed row says in words whether the attribution held and
 * why, and each unplaced row gives its origin and reasoning; the worked sort gives every row's origin
 * and reasoning with no outcome, because nothing was answered.
 */
export function QuestionSortControl({
  sort,
  draft,
  committed,
  shown = false,
  onChange,
}: {
  readonly sort: QuestionSort
  readonly draft: Readonly<Record<string, string>>
  readonly committed: Readonly<Record<string, string>> | null
  readonly shown?: boolean
  readonly onChange: (rowId: string, originId: string) => void
}) {
  const base = useId()
  const originLabel = (originId: string) =>
    sort.origins.find((origin) => origin.id === originId)?.label ?? originId
  return (
    <div
      className={styles.sort}
      data-question-sort
      data-committed={committed !== null}
      data-shown={shown}
    >
      <p className={styles.sortPrompt}>{sort.prompt}</p>
      <dl className={styles.sortOrigins}>
        {sort.origins.map((origin) => (
          <div key={origin.id}>
            <dt>{origin.label}</dt>
            <dd>{origin.definition}</dd>
          </div>
        ))}
      </dl>
      {sort.rows.map((row) => {
        const placed = committed?.[row.id]
        const answer = placed ?? draft[row.id] ?? ''
        const outcome = committed
          ? placed === undefined
            ? 'not-placed'
            : placed === row.origin
              ? 'correct'
              : 'not-correct'
          : undefined
        const selectId = `${base}-${row.id}`
        return (
          <div
            key={row.id}
            className={styles.sortRow}
            data-sort-row={row.id}
            data-outcome={outcome}
          >
            <label htmlFor={selectId}>{row.question}</label>
            <select
              id={selectId}
              className={styles.sortSelect}
              value={answer}
              disabled={committed !== null}
              onChange={(event) => onChange(row.id, event.target.value)}
            >
              <option value="" disabled>
                Choose…
              </option>
              {sort.origins.map((origin) => (
                <option key={origin.id} value={origin.id}>
                  {origin.label}
                </option>
              ))}
            </select>
            {outcome ? (
              <p className={styles.sortVerdict} data-sort-verdict={outcome}>
                <strong>
                  {outcome === 'correct'
                    ? 'Correct.'
                    : outcome === 'not-correct'
                      ? 'Not correct.'
                      : `Not placed. This one is: ${originLabel(row.origin)}.`}
                </strong>{' '}
                {row.rationale}
              </p>
            ) : shown ? (
              <p className={styles.sortVerdict} data-sort-shown>
                <strong>{originLabel(row.origin)}.</strong> {row.rationale}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
