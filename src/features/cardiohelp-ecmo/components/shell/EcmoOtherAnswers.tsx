'use client'

import type { ClinicalLearningItem } from '@/features/learning-module/activity/clinicalLearningItem'

import styles from '../stage/EcmoLessonStage.module.css'

/**
 * ECMO's verdict framing, shared by every card in the module that renders one.
 *
 * The default sentences were written for items with a console pattern on screen — "the cues support
 * this read" — and this module asks a good many of its questions as prose vignettes with no cues in
 * them. These are `AnswerVerdict`'s own titles, which the drill half of the same pathway already
 * shows, so a learner who meets both cards meets one vocabulary.
 *
 * With one exception (VA6-2, ECMO-FELLOW-04). The shared unsafe title opens "Stopping here", and in
 * this module nothing stops: the lesson continues, the answer can be retried, and every step stays
 * open. The unsafe frame therefore describes the selected action and claims no stop. It is said
 * here, through the override both shared cards already offer, so the shared wording other modules
 * render is left to its owner (`SHARED_FEEDBACK_HANDOFF.md`).
 */
export const ECMO_UNSAFE_VERDICT_FRAME = 'This action could harm a real patient'

export const ECMO_VERDICT_FRAMES = {
  best: 'That read holds.',
  'reasonable-but-incomplete': 'Defensible, but not the whole picture.',
  'incorrect-mechanism': 'That mechanism predicts a different pattern.',
  unsafe: `${ECMO_UNSAFE_VERDICT_FRAME}.`,
} as const

/** The drill card keeps the shared titles it already shows, and takes only the truthful unsafe one. */
export const ECMO_DRILL_VERDICT_FRAMES = { unsafe: ECMO_UNSAFE_VERDICT_FRAME } as const

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
