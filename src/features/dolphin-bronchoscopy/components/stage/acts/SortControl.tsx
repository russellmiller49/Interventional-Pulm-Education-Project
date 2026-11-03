'use client'

import { useState } from 'react'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { DolphinSort } from '../../../content/types'
import styles from '../dolphin-stage.module.css'

/**
 * Sort each statement into a bin, then check. Every row then shows whether it holds and why. The
 * check is the work; a misplaced row is explained, not counted.
 */
export function SortControl({
  sort,
  checked,
  onCheck,
  onRetry,
}: {
  readonly sort: DolphinSort
  readonly checked: Readonly<Record<string, string>> | undefined
  readonly onCheck: (answers: Readonly<Record<string, string>>) => void
  readonly onRetry?: () => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const rows = orderChoices(sort.id, sort.rows)
  const placed = checked ?? draft
  const complete = sort.rows.every((row) => placed[row.id])
  return (
    <section
      className={styles.question}
      aria-label="Each statement and its bins"
      data-sort={sort.id}
    >
      <p className={styles.stem}>{sort.prompt}</p>
      <dl className={styles.note}>
        {sort.origins.map((origin) => (
          <div key={origin.id}>
            <dt>
              <strong>{origin.label}</strong>
            </dt>
            <dd className="m-0">{origin.definition}</dd>
          </div>
        ))}
      </dl>
      <ol className={styles.rows}>
        {rows.map((row) => {
          const answer = placed[row.id]
          const verdict = checked ? (answer === row.origin ? 'holds' : 'misplaced') : undefined
          const origin = sort.origins.find((candidate) => candidate.id === row.origin)
          return (
            <li key={row.id} className={styles.row} data-verdict={verdict} data-row={row.id}>
              <span>{row.statement}</span>
              <select
                aria-label={`Bin for: ${row.statement}`}
                value={answer ?? ''}
                disabled={checked !== undefined}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [row.id]: event.target.value }))
                }
              >
                <option value="" disabled>
                  Choose a bin
                </option>
                {sort.origins.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
              {verdict ? (
                <p className={styles.rowFeedback}>
                  {verdict === 'holds' ? 'Holds. ' : `Belongs in “${origin?.label}”. `}
                  {row.rationale}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
      <div className={styles.actions}>
        {checked ? (
          onRetry ? (
            <button type="button" className={styles.button} onClick={onRetry}>
              Sort again
            </button>
          ) : null
        ) : (
          <button
            type="button"
            className={styles.button}
            data-primary="true"
            disabled={!complete}
            onClick={() => onCheck(draft)}
            data-check-sort
          >
            Check the sort
          </button>
        )}
      </div>
    </section>
  )
}
