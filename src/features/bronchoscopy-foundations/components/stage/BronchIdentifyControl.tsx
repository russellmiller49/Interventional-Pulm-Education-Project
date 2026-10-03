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
 *
 * Every view has its own text alternative, which says where the outline sits without the name the
 * row asks for, and its own Enlarge button (A18, A20). The set's text reference lists the parts it
 * names, alphabetically so its order says nothing about which view is which, with where each part
 * is and what it does; it is open to everyone before any answer, like the explanation.
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
      <PartReference identify={identify} />
      {identify.rows.map((row, index) => {
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
            <MediaFigure
              media={row.media}
              compact
              alt={row.mediaDescription}
              enlargeLabel={`Enlarge view ${index + 1} of ${identify.rows.length}`}
              dialogTitle={`View ${index + 1} of ${identify.rows.length}, enlarged`}
            />
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
                    <strong data-identify-authored>
                      Name: {asSentence(labelOf(row.answerId))}
                    </strong>{' '}
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

/** The parts the set names, with where each is and what it does: a text route through the set. */
function PartReference({ identify }: { readonly identify: BronchIdentify }) {
  const parts = identify.rows
    .flatMap((row) => {
      const name = row.choices.find((choice) => choice.id === row.answerId)?.label
      return name && row.partNote ? [{ name, note: row.partNote }] : []
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  if (parts.length === 0) return null
  return (
    <details className={styles.partReference} data-part-reference>
      <summary>The parts this set names: a text reference</summary>
      <dl>
        {parts.map((part) => (
          <div key={part.name}>
            <dt>{part.name}</dt>
            <dd>{part.note}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
