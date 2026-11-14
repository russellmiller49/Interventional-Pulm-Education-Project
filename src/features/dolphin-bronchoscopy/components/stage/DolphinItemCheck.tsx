'use client'

import { useId, useState } from 'react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import { DolphinFrameImage } from './DolphinFrameImage'
import styles from './dolphin-stage.module.css'

/**
 * One question: the situation, the stem, four choices in a rotated order, Check, and the verdict
 * with its explanation. Self-paced: the explanation can be read before answering, and that never
 * counts as an answer. The checked choice lives in the caller's session only; nothing is stored.
 */
export function DolphinItemCheck({
  item,
  situation,
  frameId,
  committed,
  onCommit,
  label = 'Prediction',
}: {
  readonly item: ClinicalLearningItem
  readonly situation?: string
  readonly frameId?: string
  readonly committed: string | undefined
  readonly onCommit: (choiceId: string) => void
  /** The landmark name the step's "where to look" line uses. */
  readonly label?: string
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [peek, setPeek] = useState(false)
  const name = useId()
  const choices = orderChoices(item.id, item.choices)
  return (
    <section
      className={styles.question}
      aria-label={label}
      data-landmark={label}
      data-item={item.id}
    >
      {situation ? <p className={styles.situation}>{situation}</p> : null}
      {frameId ? <DolphinFrameImage frameId={frameId} revealed={committed !== undefined} /> : null}
      <p className={styles.stem}>{item.stem}</p>
      <fieldset className={styles.choices} disabled={committed !== undefined}>
        <legend className="sr-only">{item.stem}</legend>
        {choices.map((choice) => (
          <label key={choice.id} className={styles.choice}>
            <input
              type="radio"
              name={name}
              value={choice.id}
              checked={(committed ?? pending) === choice.id}
              onChange={() => setPending(choice.id)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </fieldset>
      {committed === undefined ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            data-primary="true"
            disabled={pending === null}
            onClick={() => pending && onCommit(pending)}
            data-check-answer
          >
            Check my answer
          </button>
          <button
            type="button"
            className={styles.button}
            aria-expanded={peek}
            onClick={() => setPeek((open) => !open)}
            data-peek-explanation
          >
            {peek ? 'Hide the explanation' : 'Show the explanation without answering'}
          </button>
        </div>
      ) : null}
      {committed === undefined && peek ? (
        <p className={styles.note} data-explanation-peek>
          {item.explanation}
        </p>
      ) : null}
      {committed !== undefined ? (
        <AnswerVerdict
          item={item}
          choiceId={committed}
          theme="dark"
          outcome="stated"
          explanationHeading="Explanation"
        />
      ) : null}
    </section>
  )
}
