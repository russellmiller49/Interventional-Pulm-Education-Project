'use client'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { BronchIdentify } from '../../content/types'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'
import { asSentence, MATCHED_WORDS, UNMATCHED_WORDS } from './verdictWords'

/**
 * Naming views: one image per row with a short list of names, checked as a set and read row by
 * row. The image carries no caption of its own — the name is what the learner supplies — and the
 * rationale afterwards is in landmarks and parentage. After the check each row says what the learner
 * chose and, where it differs, the name, in the questions' own words (fellow walkthrough A43). The learner may open the names and their
 * reasoning without answering (`revealed`); that records nothing.
 */
export function BronchIdentifyControl({
  identify,
  draft,
  committed,
  revealed = false,
  onChange,
}: {
  readonly identify: BronchIdentify
  readonly draft: Readonly<Record<string, string>>
  readonly committed: Readonly<Record<string, string>> | null
  readonly revealed?: boolean
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
        const labelOf = (choiceId: string | undefined) =>
          row.choices.find((choice) => choice.id === choiceId)?.label ?? 'nothing'
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
                <strong>{outcome === 'held' ? MATCHED_WORDS : UNMATCHED_WORDS}</strong>{' '}
                <span data-identify-chosen>
                  You chose: {asSentence(labelOf(committed[row.id]))}
                </span>{' '}
                {outcome === 'held' ? null : (
                  <>
                    <span data-identify-authored>
                      Name: {asSentence(labelOf(row.answerId))}
                    </span>{' '}
                  </>
                )}
                {row.rationale}
              </p>
            ) : revealed ? (
              <p className={styles.verdict} data-identify-explanation>
                <strong data-identify-authored>Name: {asSentence(labelOf(row.answerId))}</strong>{' '}
                {row.rationale}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
