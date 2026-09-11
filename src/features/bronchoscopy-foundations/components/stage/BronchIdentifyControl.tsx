'use client'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { BronchIdentify } from '../../content/types'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'

/**
 * Naming views: one image per row with a short list of names, committed as a set and read row
 * by row. The image carries no caption of its own — the name is what the learner supplies — and
 * the rationale afterwards is in landmarks and parentage.
 */
export function BronchIdentifyControl({
  identify,
  draft,
  committed,
  onChange,
}: {
  readonly identify: BronchIdentify
  readonly draft: Readonly<Record<string, string>>
  readonly committed: Readonly<Record<string, string>> | null
  readonly onChange: (rowId: string, choiceId: string) => void
}) {
  return (
    <div
      className={styles.act}
      data-bronch-identify={identify.id}
      data-committed={committed !== null}
    >
      <p className={styles.verdict}>{identify.prompt}</p>
      {identify.rows.map((row) => {
        const answer = committed?.[row.id] ?? draft[row.id] ?? null
        const outcome = committed
          ? committed[row.id] === row.answerId
            ? 'held'
            : 'other'
          : undefined
        return (
          <div
            key={row.id}
            className={styles.row}
            data-identify-row={row.id}
            data-outcome={outcome}
          >
            <MediaFigure media={row.media} compact />
            <fieldset className={styles.choices} disabled={committed !== null}>
              <legend>{row.prompt}</legend>
              {orderChoices(row.id, row.choices).map((choice) => (
                <label
                  key={choice.id}
                  className={styles.choice}
                  data-selected={answer === choice.id}
                >
                  <input
                    type="radio"
                    name={`bronch-identify-${identify.id}-${row.id}`}
                    value={choice.id}
                    checked={answer === choice.id}
                    onChange={() => onChange(row.id, choice.id)}
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </fieldset>
            {committed ? (
              <p className={styles.verdict} data-identify-verdict={outcome}>
                <strong>{outcome === 'held' ? 'Held.' : 'Did not hold.'}</strong> {row.rationale}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
