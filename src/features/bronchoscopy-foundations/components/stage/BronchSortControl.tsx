'use client'

import { useId } from 'react'

import type { BronchSort } from '../../content/types'
import styles from './bronch-stage.module.css'
import { asSentence, MATCHED_WORDS, UNMATCHED_WORDS } from './verdictWords'

/**
 * An attribution sort: statements placed into a small set of origins, checked as a set and read
 * row by row in words. After a check each row says whether the placement matches the course's, what
 * the learner chose, where the course places the statement when that differs, and why (fellow
 * walkthrough A16) — no count or total, only the row. The learner may also open the worked matches
 * without placing anything (`revealed`); that shows each row's origin and reasoning and records
 * nothing.
 */
export function BronchSortControl({
  sort,
  draft,
  committed,
  revealed = false,
  onChange,
}: {
  readonly sort: BronchSort
  readonly draft: Readonly<Record<string, string>>
  readonly committed: Readonly<Record<string, string>> | null
  readonly revealed?: boolean
  readonly onChange: (rowId: string, originId: string) => void
}) {
  const base = useId()
  const labelOf = (originId: string | undefined) =>
    sort.origins.find((origin) => origin.id === originId)?.label ?? 'nothing yet'
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
                <strong>{outcome === 'held' ? MATCHED_WORDS : UNMATCHED_WORDS}</strong>{' '}
                <span data-sort-chosen>You chose: {asSentence(labelOf(committed[row.id]))}</span>{' '}
                {outcome === 'held' ? null : (
                  <>
                    <strong data-sort-authored>
                      Belongs with: {asSentence(labelOf(row.origin))}
                    </strong>{' '}
                  </>
                )}
                {row.rationale}
              </p>
            ) : revealed ? (
              <p className={styles.verdict} data-sort-explanation>
                <strong data-sort-authored>Belongs with: {asSentence(labelOf(row.origin))}</strong>{' '}
                {row.rationale}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
