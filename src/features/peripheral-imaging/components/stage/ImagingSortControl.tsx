'use client'

import { useId } from 'react'

import type { ImagingSort } from '../../content/sorts'
import styles from './imaging-stage.module.css'

/**
 * An attribution sort: statements placed into a small set of origins, committed as a set and
 * graded row by row in words. Before the commitment nothing says which origin is keyed; after
 * it, each row says whether the attribution held and why.
 */
export function ImagingSortControl({
  sort,
  draft,
  committed,
  onChange,
}: {
  readonly sort: ImagingSort
  readonly draft: Readonly<Record<string, string>>
  readonly committed: Readonly<Record<string, string>> | null
  readonly onChange: (rowId: string, originId: string) => void
}) {
  const base = useId()
  return (
    <div className={styles.sort} data-imaging-sort={sort.id} data-committed={committed !== null}>
      <dl className={styles.sortOrigins}>
        {sort.origins.map((origin) => (
          <div key={origin.id}>
            <dt>{origin.label}</dt>
            <dd>{origin.definition}</dd>
          </div>
        ))}
      </dl>
      {sort.rows.map((row) => {
        const answer = committed?.[row.id] ?? draft[row.id] ?? ''
        const outcome = committed
          ? committed[row.id] === row.origin
            ? 'held'
            : 'other'
          : undefined
        const selectId = `${base}-${row.id}`
        return (
          <div
            key={row.id}
            className={styles.sortRow}
            data-sort-row={row.id}
            data-outcome={outcome}
          >
            <label htmlFor={selectId}>{row.statement}</label>
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
            {committed ? (
              <p className={styles.sortVerdict} data-sort-verdict={outcome}>
                <strong>{outcome === 'held' ? 'Correct.' : 'Not correct.'}</strong> {row.rationale}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
