'use client'

import { useId } from 'react'

import type { BronchSort } from '../../content/types'
import styles from './bronch-stage.module.css'

/**
 * An attribution sort: statements placed into a small set of origins, committed as a set and
 * read row by row in words. Before the commitment nothing says which origin is keyed; after it,
 * each row says whether the placement held and why.
 */
export function BronchSortControl({
  sort,
  draft,
  committed,
  onChange,
}: {
  readonly sort: BronchSort
  readonly draft: Readonly<Record<string, string>>
  readonly committed: Readonly<Record<string, string>> | null
  readonly onChange: (rowId: string, originId: string) => void
}) {
  const base = useId()
  return (
    <div className={styles.act} data-bronch-sort={sort.id} data-committed={committed !== null}>
      <p className={styles.verdict}>{sort.prompt}</p>
      <dl className={styles.origins}>
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
          <div key={row.id} className={styles.row} data-sort-row={row.id} data-outcome={outcome}>
            <label htmlFor={selectId}>{row.statement}</label>
            <select
              id={selectId}
              className={styles.select}
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
              <p className={styles.verdict} data-sort-verdict={outcome}>
                <strong>{outcome === 'held' ? 'Held.' : 'Did not hold.'}</strong> {row.rationale}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
