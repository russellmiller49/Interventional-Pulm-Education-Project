'use client'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import styles from './course.module.css'

/**
 * A question's explanation, opened by the learner — with or without an answer.
 *
 * Self-paced contract (EBUS-01): the explanation is always reachable before an answer. The card
 * gives the best-supported option and why, the takeaway, and why each other option falls short,
 * naming an unsafe option as unsafe, because a safety explanation is teaching whether or not anyone
 * chose it. It records nothing — no choice, no verdict, no note that it was opened — and the
 * caller's note says it was shown without an answer, so it is never mistaken for feedback on one.
 */
export function QuestionExplanation({
  item,
  note,
  heading = 'Explanation',
}: {
  readonly item: ClinicalLearningItem
  readonly note?: string
  readonly heading?: string
}) {
  const best = item.choices.filter((choice) => item.correctChoiceIds.includes(choice.id))
  const others = item.choices.filter((choice) => !item.correctChoiceIds.includes(choice.id))
  return (
    <section className={styles.explanation} aria-label={heading} data-explanation-reveal>
      <p>
        <strong>{heading}</strong>
      </p>
      {note ? (
        <p className={styles.muted} data-explanation-note>
          {note}
        </p>
      ) : null}
      {best.map((choice) => (
        <div key={choice.id} data-explanation-best={choice.id}>
          <p>
            <strong>Best-supported option:</strong> {choice.label}
          </p>
          <p>{choice.rationale}</p>
        </div>
      ))}
      <div data-explanation-takeaway>
        <p>
          <strong>The takeaway</strong>
        </p>
        <p>{item.explanation}</p>
      </div>
      {others.length > 0 ? (
        <div>
          <p>
            <strong>The other options</strong>
          </p>
          <ul data-explanation-others>
            {others.map((choice) => (
              <li
                key={choice.id}
                data-explanation-option={choice.id}
                data-unsafe={choice.plausibility === 'unsafe' ? 'true' : undefined}
              >
                <strong>{choice.label}</strong>
                {choice.plausibility === 'unsafe' ? <strong> Unsafe.</strong> : null} —{' '}
                {choice.rationale}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
