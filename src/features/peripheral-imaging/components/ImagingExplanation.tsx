import type { ClinicalLearningItem } from '@/features/learning-module/activity'

/**
 * An item's explanation, opened by the learner — with or without an answer.
 *
 * Self-paced contract (PI-01): the explanation is always reachable before an answer. The card gives
 * the best-supported option and why, the takeaway, and why each other option falls short, naming an
 * unsafe option as unsafe, because a safety explanation is teaching whether or not anyone chose it.
 * It records nothing — no choice, no verdict, no note that it was opened — and the caller's note
 * says it was shown without an answer, so it is never mistaken for feedback on one.
 */
export function ImagingExplanation({
  item,
  id,
  note,
  heading = 'Explanation',
}: {
  readonly item: ClinicalLearningItem
  readonly id?: string
  readonly note?: string
  readonly heading?: string
}) {
  const best = item.choices.filter((choice) => item.correctChoiceIds.includes(choice.id))
  const others = item.choices.filter((choice) => !item.correctChoiceIds.includes(choice.id))
  return (
    <section
      id={id}
      className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm leading-6"
      aria-label={heading}
      data-explanation-reveal
    >
      <p className="font-semibold">{heading}</p>
      {note ? (
        <p className="mt-1 opacity-80" data-explanation-note>
          {note}
        </p>
      ) : null}
      {best.map((choice) => (
        <div key={choice.id} className="mt-2" data-explanation-best={choice.id}>
          <p>
            <span className="font-medium">Best-supported option:</span> {choice.label}
          </p>
          <p className="mt-1">{choice.rationale}</p>
        </div>
      ))}
      <div className="mt-3" data-explanation-takeaway>
        <strong>The takeaway</strong>
        <p className="mt-1">{item.explanation}</p>
      </div>
      {others.length > 0 ? (
        <div className="mt-3">
          <strong>The other options</strong>
          <ul className="mt-2 grid gap-2" data-explanation-others>
            {others.map((choice) => (
              <li
                key={choice.id}
                data-explanation-option={choice.id}
                data-unsafe={choice.plausibility === 'unsafe' ? 'true' : undefined}
              >
                <span className="font-medium">{choice.label}</span>
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
