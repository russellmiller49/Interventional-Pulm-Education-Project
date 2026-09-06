'use client'

import type { ClinicalLearningItem } from '@/features/learning-module/activity/clinicalLearningItem'

import styles from '../stage/EcmoLessonStage.module.css'

/**
 * The rationales for the answers the learner did not take, folded, after the commitment.
 *
 * Five foundation sections instruct "commit a prediction, then read why the other answers do not
 * fit", and until a learner review in September 2026 there was nothing on the card that did. The
 * drill half of the same pathway has always had this disclosure; the foundations render this one so
 * both halves keep the promise, and so the shared card four other modules use is left alone.
 *
 * Post-commitment only, by construction: it is rendered beside the verdict, which the host renders
 * only once a choice is committed. The summary is the instruction's own words.
 */
export function EcmoOtherAnswers({
  item,
  committedChoiceId,
}: {
  readonly item: ClinicalLearningItem
  readonly committedChoiceId: string
}) {
  const others = item.choices.filter((choice) => choice.id !== committedChoiceId)
  if (others.length === 0) return null
  return (
    <details className={styles.otherAnswers} data-other-answers-panel>
      <summary>Why the other answers do not fit</summary>
      <ul data-other-answers>
        {others.map((choice) => (
          <li key={choice.id} data-other-answer={choice.id}>
            <span>{choice.label}</span> — {choice.rationale}
          </li>
        ))}
      </ul>
    </details>
  )
}
