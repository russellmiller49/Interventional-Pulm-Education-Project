'use client'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { DolphinIdentify } from '../../../content/types'
import { DolphinFrameImage } from '../DolphinFrameImage'
import styles from '../dolphin-stage.module.css'

/**
 * Name each view. The still carries only its neutral description until the row is answered; then
 * the answer, the rationale in landmarks and order, and the named description.
 */
export function FrameIdentify({
  identify,
  picks,
  onPick,
}: {
  readonly identify: DolphinIdentify
  readonly picks: Readonly<Record<string, string>> | undefined
  readonly onPick: (rowId: string, choiceId: string) => void
}) {
  return (
    <section
      className={styles.question}
      aria-label="Each view and its choices"
      data-identify={identify.id}
    >
      <p className={styles.stem}>{identify.prompt}</p>
      <ol className={styles.rows}>
        {identify.rows.map((row) => {
          const picked = picks?.[row.id]
          const answer = row.choices.find((choice) => choice.id === row.answerId)
          return (
            <li
              key={row.id}
              className={styles.row}
              data-verdict={
                picked === undefined ? undefined : picked === row.answerId ? 'holds' : 'misplaced'
              }
              data-identify-row={row.id}
            >
              <DolphinFrameImage frameId={row.frameId} revealed={picked !== undefined} />
              <span>{row.prompt}</span>
              <div className={styles.actions} role="group" aria-label={row.prompt}>
                {orderChoices(row.id, row.choices).map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={styles.button}
                    aria-pressed={picked === choice.id}
                    disabled={picked !== undefined}
                    onClick={() => onPick(row.id, choice.id)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              {picked !== undefined ? (
                <p className={styles.rowFeedback}>
                  {picked === row.answerId ? 'Holds. ' : `This is ${answer?.label}. `}
                  {row.rationale}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
