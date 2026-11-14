'use client'

import type { Route } from 'next'
import { AlertOctagon, BookOpen } from 'lucide-react'

import { criticalCareConceptById } from '@/features/critical-care/content/concepts'
import { resolveCriticalCareEvidence } from '@/features/critical-care/content/evidenceRegistry'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { Link } from '@/i18n/navigation'

type ClinicalLearningChoice = ClinicalLearningItem['choices'][number]

/**
 * The outcome first, then the reasoning.
 *
 * This card only ever renders after a commitment, so there is nothing to withhold: where the caller
 * asks for it, the card says whether the learner was right and then why. The explicit label was
 * added on an owner review in September 2026 — the card used to open with "The cues support this
 * read", which never states the outcome — and it matches the wording `AnswerVerdict` uses so a
 * learner meeting both cards meets one vocabulary. It is opt-in for the same reason it is there:
 * one owner asked for it about one module. See `AnswerVerdict` for the rest of the reasoning.
 */
const plausibilityOutcome: Readonly<
  Record<
    ClinicalLearningChoice['plausibility'],
    { readonly outcome: string; readonly label: string }
  >
> = {
  best: { outcome: 'correct', label: 'Correct.' },
  'reasonable-but-incomplete': { outcome: 'partly-correct', label: 'Partly correct.' },
  'incorrect-mechanism': { outcome: 'not-correct', label: 'Not correct.' },
  unsafe: { outcome: 'unsafe', label: 'Not correct, and unsafe.' },
}

/**
 * The sentence after the outcome, and the option to say it differently.
 *
 * These were written for `signal-recognition` items, where a pattern is on the screen and "the cues
 * support this read" names something the learner can point at. On a prose vignette there are no
 * cues, and "read" as a noun is vocabulary a module has to have taught. A learner review of the
 * ECMO module in September 2026 stopped on exactly that sentence, under a three-number bedside
 * story with no console pattern in it.
 *
 * `frames` is how a caller says its own; omitted, every caller keeps the wording it has. ECMO takes
 * `AnswerVerdict`'s titles, which is what this component's doc comment has always said it wants —
 * one vocabulary for a learner who meets both cards in one pathway — and which was true of the
 * outcome labels and never of these.
 */
const plausibilityFrame: Readonly<Record<ClinicalLearningChoice['plausibility'], string>> = {
  best: 'The cues support this read.',
  'reasonable-but-incomplete':
    'That is a defensible read as far as it goes. One more cue changes the working frame.',
  'incorrect-mechanism':
    'That mechanism would produce a different pattern from the one shown here.',
  unsafe: 'Stopping here—the selected action could cause harm in a real patient.',
}

export function ChoiceReasoningFeedback({
  choice,
  explanation,
  evidenceIds,
  conceptIds = [],
  outcome = 'described',
  frames,
  alternatives,
}: {
  readonly choice: ClinicalLearningChoice
  readonly explanation: string
  readonly evidenceIds: readonly string[]
  readonly conceptIds?: readonly string[]
  /** See the prop of the same name on `AnswerVerdict`: `stated` opts in to the outcome label. */
  readonly outcome?: 'described' | 'stated'
  /** Per-caller replacements for the sentence after the outcome. Omitted, the defaults stand. */
  readonly frames?: Partial<Record<ClinicalLearningChoice['plausibility'], string>>
  /**
   * The item's whole choice set, when the card should also say why the other answers do not fit.
   *
   * `AnswerVerdict` has carried that disclosure since it was promoted, and the activity contract
   * describes the verdict as offering it; this card never did, so the three surfaces that render
   * it for the concept links and citations could not keep a step's promise to "read why the other
   * answers do not fit". The ECMO round put a module-local copy beside this card. Passing the
   * choices here is the shared answer: the card folds the choices that do not fit under the same
   * summary `AnswerVerdict` uses. Omitted, the card renders exactly as before.
   *
   * The best-supported choice is never one of those (SHARED-FEEDBACK-02). After any other
   * selection it is named above the fold, under the label `AnswerVerdict` gives it, with its own
   * rationale. The card tells the two apart by `plausibility`, the same field it reads for the
   * outcome label, so a caller passes nothing more.
   */
  readonly alternatives?: readonly ClinicalLearningChoice[]
}) {
  const evidence = resolveCriticalCareEvidence(evidenceIds)
  const concepts = conceptIds.flatMap((conceptId) => {
    const concept = criticalCareConceptById.get(conceptId)
    return concept ? [concept] : []
  })
  const isUnsafe = choice.plausibility === 'unsafe'
  const others = alternatives?.filter((candidate) => candidate.id !== choice.id) ?? []
  /*
   * Everything the learner did not take, in two groups. Until November 2026 they were one list
   * headed "Why the other answers do not fit", which after a selection that was not the best one
   * filed the best-supported answer under that heading (SHARED-FEEDBACK-02). The heading now sits
   * over the choices it is true of, and the best-supported answer is stated on its own, open,
   * where a learner who took another option reads it without unfolding anything. Nothing new is
   * disclosed: this card renders only after the commitment, and the same label and rationale were
   * already one click away.
   */
  const bestSupported = others.filter((candidate) => candidate.plausibility === 'best')
  const doNotFit = others.filter((candidate) => candidate.plausibility !== 'best')
  const bestSupportedHeading =
    choice.plausibility === 'best'
      ? bestSupported.length > 1
        ? 'Other best-supported answers'
        : 'Another best-supported answer'
      : bestSupported.length > 1
        ? 'Best-supported answers'
        : 'Best-supported answer'

  return (
    <article
      className={`rounded-2xl border p-4 ${
        isUnsafe ? 'border-red-400/50 bg-red-950/25' : 'border-sky-400/30 bg-sky-950/15'
      }`}
      role={isUnsafe ? 'alert' : 'status'}
      aria-live="polite"
      data-plausibility={choice.plausibility}
      data-verdict-outcome={
        outcome === 'stated' ? plausibilityOutcome[choice.plausibility].outcome : undefined
      }
    >
      <div className="flex items-start gap-3">
        {isUnsafe ? (
          <AlertOctagon className="mt-0.5 size-5 shrink-0 text-red-300" aria-hidden="true" />
        ) : (
          <BookOpen className="mt-0.5 size-5 shrink-0 text-sky-300" aria-hidden="true" />
        )}
        <div>
          <p className="font-bold text-white">
            {outcome === 'stated' ? (
              <>
                <span data-verdict-outcome-label>
                  {plausibilityOutcome[choice.plausibility].label}
                </span>{' '}
              </>
            ) : null}
            {frames?.[choice.plausibility] ?? plausibilityFrame[choice.plausibility]}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-100">{choice.rationale}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/15 bg-black/10 p-3 text-sm leading-6">
        <strong className="text-white">How to distinguish it</strong>
        <p className="mt-1 text-slate-200">{explanation}</p>
      </div>

      {bestSupported.length > 0 ? (
        <div
          className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-950/20 p-3 text-sm leading-6"
          data-best-supported-answers
        >
          <strong className="text-white" data-keyed-answer-label>
            {bestSupportedHeading}
          </strong>
          <ul className="mt-1 grid gap-2 text-slate-200">
            {bestSupported.map((candidate) => (
              <li
                key={candidate.id}
                data-other-answer={candidate.id}
                data-other-answer-role="keyed"
              >
                <span className="font-semibold text-white">{candidate.label}</span> —{' '}
                {candidate.rationale}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {doNotFit.length > 0 ? (
        <details
          className="mt-3 rounded-xl border border-white/15 bg-black/10 p-3 text-sm leading-6"
          data-other-answers-panel
        >
          <summary className="min-h-9 cursor-pointer font-semibold text-white">
            Why the other answers do not fit
          </summary>
          <ul className="mt-2 grid gap-2 text-slate-200" data-other-answers>
            {doNotFit.map((candidate) => (
              <li
                key={candidate.id}
                data-other-answer={candidate.id}
                data-other-answer-role="alternative"
              >
                <span className="font-semibold text-white">{candidate.label}</span> —{' '}
                {candidate.rationale}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {concepts.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Related concepts">
          {concepts.map((concept) => (
            <Link
              key={concept.id}
              href={`/critical-care/concepts/${concept.id}` as Route}
              className="inline-flex min-h-9 items-center rounded-full border border-sky-300/30 px-3 text-xs font-semibold text-sky-100"
            >
              {concept.title}
            </Link>
          ))}
        </div>
      ) : null}

      {evidence.length > 0 ? (
        <div className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-300">
          <strong className="text-white">Sources</strong>
          <ul className="mt-1 space-y-1">
            {evidence.map((record) => (
              <li key={record.id}>
                {record.sourceUrl ? (
                  <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                    {record.citation}
                  </a>
                ) : (
                  record.citation
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}
