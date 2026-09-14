'use client'

import { useId } from 'react'

import type { ImagingSort } from '../../content/sorts'
import styles from './imaging-stage.module.css'

/**
 * An attribution sort: statements placed into a small set of origins, checked as a set and
 * explained row by row. Before a check nothing says which origin is keyed unless the learner asks
 * to see the matches (PI-01: the explanation is reachable before an answer); after a check each row
 * says whether the attribution held and why. Showing the matches places and checks nothing.
 */
export function ImagingSortControl({
  sort,
  draft,
  committed,
  revealed = false,
  onChange,
}: {
  readonly sort: ImagingSort
  readonly draft: Readonly<Record<string, string>>
  readonly committed: Readonly<Record<string, string>> | null
  readonly revealed?: boolean
  readonly onChange: (rowId: string, originId: string) => void
}) {
  const base = useId()
  return (
    <div
      className={styles.sort}
      data-imaging-sort={sort.id}
      data-committed={committed !== null}
      data-revealed={revealed && committed === null}
    >
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
        const keyedLabel =
          sort.origins.find((origin) => origin.id === row.origin)?.label ?? row.origin
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
            ) : revealed ? (
              <p className={styles.sortVerdict} data-sort-reveal={row.origin}>
                <strong>{keyedLabel}.</strong> {row.rationale}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
