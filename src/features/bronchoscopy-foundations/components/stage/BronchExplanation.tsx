import type { ClinicalLearningItem } from '@/features/learning-module/activity'

import styles from './bronch-stage.module.css'

/**
 * An item's explanation, opened by the learner — before an answer, instead of one, or after.
 *
 * Self-paced contract (BF-01, after PI-01's imaging explanation): the explanation is always
 * reachable without answering. It gives the best-supported option and why, the takeaway, and why
 * each other option falls short, naming an unsafe option as unsafe, because a safety explanation is
 * teaching whether or not anyone chose it. It records nothing — no choice, no verdict, no note that
 * it was opened — and the caller's note says how it was opened, so it is never read as feedback on
 * an answer.
 */
export function BronchExplanation({
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
    <section className={styles.teachingCard} aria-label={heading} data-explanation-reveal>
      <p className={styles.kicker}>{heading}</p>
      {note ? <p data-explanation-note>{note}</p> : null}
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
                {choice.plausibility === 'unsafe' ? ' Unsafe.' : ''} {choice.rationale}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
