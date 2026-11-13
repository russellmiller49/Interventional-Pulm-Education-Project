'use client'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import styles from './eus-b-guided.module.css'

/**
 * A question's explanation, opened by the learner with or without an answer.
 *
 * It gives the best-supported option and why, the takeaway where it adds anything, and why each
 * other option falls short. It records nothing, and the caller's note says when it was shown
 * without an answer, so it is never mistaken for feedback on one.
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
  // Most items give the keyed option's own reasoning as the takeaway; repeating it teaches nothing.
  const takeawayRepeatsBest = best.some((choice) => choice.rationale === item.explanation)
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
      {takeawayRepeatsBest ? null : (
        <div data-explanation-takeaway>
          <p>
            <strong>The takeaway</strong>
          </p>
          <p>{item.explanation}</p>
        </div>
      )}
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
                {choice.plausibility === 'unsafe' ? <strong> Unsafe.</strong> : null}:{' '}
                {choice.rationale}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
