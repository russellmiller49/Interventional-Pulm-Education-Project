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
 * This card only ever renders after a commitment, so there is nothing to withhold: it says whether
 * the learner was right and then why. The explicit label was added on an owner review in September
 * 2026 — the card used to open with "The cues support this read", which never states the outcome —
 * and it matches the wording `AnswerVerdict` uses so a learner meeting both cards meets one
 * vocabulary. See `VerdictOutcome` there for why the descriptive sentence is kept rather than
 * replaced.
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
}: {
  readonly choice: ClinicalLearningChoice
  readonly explanation: string
  readonly evidenceIds: readonly string[]
  readonly conceptIds?: readonly string[]
}) {
  const evidence = resolveCriticalCareEvidence(evidenceIds)
  const concepts = conceptIds.flatMap((conceptId) => {
    const concept = criticalCareConceptById.get(conceptId)
    return concept ? [concept] : []
  })
  const isUnsafe = choice.plausibility === 'unsafe'

  return (
    <article
      className={`rounded-2xl border p-4 ${
        isUnsafe ? 'border-red-400/50 bg-red-950/25' : 'border-sky-400/30 bg-sky-950/15'
      }`}
      role={isUnsafe ? 'alert' : 'status'}
      aria-live="polite"
      data-plausibility={choice.plausibility}
      data-verdict-outcome={plausibilityOutcome[choice.plausibility].outcome}
    >
      <div className="flex items-start gap-3">
        {isUnsafe ? (
          <AlertOctagon className="mt-0.5 size-5 shrink-0 text-red-300" aria-hidden="true" />
        ) : (
          <BookOpen className="mt-0.5 size-5 shrink-0 text-sky-300" aria-hidden="true" />
        )}
        <div>
          <p className="font-bold text-white">
            <span data-verdict-outcome-label>{plausibilityOutcome[choice.plausibility].label}</span>{' '}
            {plausibilityFrame[choice.plausibility]}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-100">{choice.rationale}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/15 bg-black/10 p-3 text-sm leading-6">
        <strong className="text-white">How to distinguish it</strong>
        <p className="mt-1 text-slate-200">{explanation}</p>
      </div>

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
