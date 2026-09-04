'use client'

import type { ReactNode } from 'react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'

type Plausibility = ClinicalLearningItem['choices'][number]['plausibility']

/**
 * The one verdict a learner sees after committing an answer, wherever they committed it.
 *
 * Three implementations had grown independently: this one (promoted from Mechanical Ventilation,
 * which the revision plan identified as the strongest), the dark `ChoiceReasoningFeedback` used by
 * the workbench modules, and a third copy inside the PAC activity that shadowed the shared name.
 * They disagreed about whether the other answers were shown at all, about whether the result was
 * announced, and about who advances the phase.
 *
 * What is shared here is the behaviour the plan requires: plausibility-keyed feedback, a disclosure
 * covering why the other answers do not fit, an accessible announcement, an explicit Continue
 * control, and — critically — no advancement of its own. Advancing is always the caller's decision,
 * taken when the learner presses Continue.
 *
 * What is NOT shared is pedagogy. `timing` decides how much may be said and when, because Learn,
 * guided Practice, independent Practice and Challenge legitimately differ (revision plan §3):
 *
 *  - `immediate-after-commit` — Learn. The learner has committed; say plainly whether the read holds
 *    and why, and why the alternatives do not, before anything moves.
 *  - `after-action-response`  — guided Practice. The mechanism is withheld at commitment: the
 *    learner acts, watches the modeled response, and only then gets a short branch-specific
 *    coaching verdict. The full causal synthesis waits for the debrief.
 *  - `debrief-only`           — independent Practice and Challenge. No correctness labelling before
 *    the debrief at all. The device and the patient still respond; nothing here grades that.
 *
 * While a verdict is withheld the card says nothing at all — see `withheldTone`. Withholding the
 * sentences while keeping the colour, or the `data-plausibility` attribute, would answer the
 * question by another route.
 *
 * A safety-critical choice is the one exception the plan allows: an `unsafe` selection is announced
 * whatever the timing, because letting a learner carry on believing a harmful action was acceptable
 * is not a pedagogic trade-off worth making.
 *
 * Scope of the migration, audited across every immediate-feedback Learn surface:
 *
 *  - Migrated — the two local duplicates. Mechanical Ventilation Learn's own copy (which this was
 *    promoted from) and the PAC guided-skill copy that shadowed `ChoiceReasoningFeedback`'s name.
 *    Both gained an assertive unsafe announcement, and PAC gained an announcement at all and the
 *    comparison against the answers not taken; PAC's extra framing rides along as
 *    `branchExplanation`. Feedback timing, scoring and completion are untouched in both.
 *  - Not migrated — the consumers of the shared `ChoiceReasoningFeedback`: ECMO foundation, the MCS
 *    workbench, CRRT Learn and MV's own case debrief. That component resolves and renders concept
 *    links and the citation list for the item's evidence, which this one does not; swapping it in
 *    would silently drop the sources those surfaces show. They are a separate component because
 *    they do a genuinely different job, not because nobody has got round to them.
 */
export type VerdictTiming = 'immediate-after-commit' | 'after-action-response' | 'debrief-only'

/**
 * The outcome, said in one or two words before anything else.
 *
 * These labels were deliberately absent until an owner review of the ECMO module in September 2026:
 * the card opened with "That read holds", which describes the reasoning without ever saying whether
 * the learner got it right. The owner's finding was blunt — "when a user gets a question right or
 * wrong it should more explicitly say if it was correct or not" — and it applies to every lab that
 * renders this card, so the label leads here rather than in one module's copy.
 *
 * The original sentence is kept after it. Saying only "Correct" would throw away the part that
 * teaches, which is the description of *what* holds; the outcome tells the learner where they stand
 * and the sentence tells them why.
 */
export type VerdictOutcome = 'correct' | 'partly-correct' | 'not-correct' | 'unsafe'

interface VerdictCopy {
  readonly outcome: VerdictOutcome
  /** The explicit outcome, first thing read. */
  readonly outcomeLabel: string
  readonly title: string
  readonly light: string
  readonly dark: string
}

const verdictCopy: Readonly<Record<Plausibility, VerdictCopy>> = {
  best: {
    outcome: 'correct',
    outcomeLabel: 'Correct.',
    title: 'That read holds',
    light: 'border-emerald-500/60 bg-emerald-50',
    dark: 'border-emerald-400/40 bg-emerald-950/25',
  },
  'reasonable-but-incomplete': {
    outcome: 'partly-correct',
    outcomeLabel: 'Partly correct.',
    title: 'Defensible, but not the whole picture',
    light: 'border-amber-500/60 bg-amber-50',
    dark: 'border-amber-400/40 bg-amber-950/25',
  },
  'incorrect-mechanism': {
    outcome: 'not-correct',
    outcomeLabel: 'Not correct.',
    title: 'That mechanism predicts a different pattern',
    light: 'border-rose-500/60 bg-rose-50',
    dark: 'border-rose-400/40 bg-rose-950/25',
  },
  unsafe: {
    outcome: 'unsafe',
    outcomeLabel: 'Not correct, and unsafe.',
    title: 'Stopping here — this could harm a real patient',
    light: 'border-rose-600/70 bg-rose-100',
    dark: 'border-red-400/50 bg-red-950/30',
  },
}

/**
 * How the card looks while it is still withholding the verdict.
 *
 * Deliberately carries no red-amber-green signal, because a card that says "the reasoning is held
 * until the debrief" while sitting on an emerald background has not withheld anything. The same
 * reasoning removes `data-plausibility` from the unrevealed DOM: an attribute is readable by a
 * stylesheet and by anyone who opens the inspector, and neither is a route the timing policy should
 * leave open.
 */
const withheldTone: Readonly<Record<'light' | 'dark', string>> = {
  light: 'border-slate-300 bg-slate-50',
  dark: 'border-white/15 bg-white/5',
}

/** Whether a verdict may be shown at all yet, given the mode and what the learner has done. */
export function shouldRevealVerdict({
  timing,
  plausibility,
  actionObserved = false,
  inDebrief = false,
}: {
  readonly timing: VerdictTiming
  readonly plausibility: Plausibility
  /** Guided Practice only: has the learner acted and seen the modeled response yet? */
  readonly actionObserved?: boolean
  readonly inDebrief?: boolean
}): boolean {
  // The safety exception, deliberately ahead of every timing rule.
  if (plausibility === 'unsafe') return true
  if (inDebrief) return true
  if (timing === 'immediate-after-commit') return true
  if (timing === 'after-action-response') return actionObserved
  return false
}

export function AnswerVerdict({
  item,
  choiceId,
  timing = 'immediate-after-commit',
  actionObserved = false,
  inDebrief = false,
  theme = 'dark',
  branchExplanation,
  onContinue,
  continueLabel = 'Continue',
}: {
  readonly item: ClinicalLearningItem
  readonly choiceId: string
  readonly timing?: VerdictTiming
  readonly actionObserved?: boolean
  readonly inDebrief?: boolean
  readonly theme?: 'light' | 'dark'
  /**
   * What this particular branch produced, when the caller knows it — the response the learner just
   * watched, or why their action did or did not work. Shown instead of nothing in guided Practice,
   * where the general explanation is still being withheld.
   */
  readonly branchExplanation?: ReactNode
  /**
   * Advancing is the caller's job, and only on this control. A verdict that advanced by itself
   * would replace the question before the learner had read the answer — the defect this component
   * exists to prevent.
   */
  readonly onContinue?: () => void
  readonly continueLabel?: string
}) {
  const chosen = item.choices.find((choice) => choice.id === choiceId)
  if (!chosen) return null

  const revealed = shouldRevealVerdict({
    timing,
    plausibility: chosen.plausibility,
    actionObserved,
    inDebrief,
  })
  const copy = verdictCopy[chosen.plausibility]
  const isUnsafe = chosen.plausibility === 'unsafe'
  const tone = revealed ? (theme === 'light' ? copy.light : copy.dark) : withheldTone[theme]
  const others = item.choices.filter((choice) => choice.id !== choiceId)
  // The full comparison is a Learn/debrief affordance. Guided Practice gets the branch note only,
  // so the mechanism is not handed over before the learner has worked it.
  const showFullReasoning = revealed && (timing === 'immediate-after-commit' || inDebrief)

  return (
    <article
      className={`rounded-xl border p-3 text-sm leading-6 ${tone}`}
      role={isUnsafe ? 'alert' : 'status'}
      aria-live={isUnsafe ? 'assertive' : 'polite'}
      data-answer-verdict
      // Only once it is being told. See `withheldTone`. The outcome is gated the same way, for the
      // same reason: an attribute is readable by a stylesheet and by anyone who opens the inspector.
      data-plausibility={revealed ? chosen.plausibility : undefined}
      data-verdict-outcome={revealed ? copy.outcome : undefined}
      data-timing={timing}
      data-revealed={revealed}
    >
      <p className="font-semibold">
        {revealed ? (
          <>
            <span data-verdict-outcome-label>{copy.outcomeLabel}</span> {copy.title}
          </>
        ) : (
          'Answer recorded'
        )}
      </p>
      <p className="mt-1">
        <span className="font-medium">You chose:</span> {chosen.label}
      </p>

      {revealed ? <p className="mt-2">{chosen.rationale}</p> : null}

      {revealed && branchExplanation ? (
        <div className="mt-2" data-branch-explanation>
          {branchExplanation}
        </div>
      ) : null}

      {!revealed ? (
        <p className="mt-2 opacity-80">
          {timing === 'after-action-response'
            ? 'Act on the simulator and watch what happens before reading any judgement of the choice.'
            : 'The reasoning is held until the debrief so the run is yours to work through.'}
        </p>
      ) : null}

      {showFullReasoning ? (
        <>
          <div className="mt-3" data-how-to-distinguish>
            <strong>How to distinguish it</strong>
            <p className="mt-1">{item.explanation}</p>
          </div>
          {others.length > 0 ? (
            <details className="mt-3 rounded-lg border border-black/10 bg-white/10 p-2">
              <summary className="min-h-9 cursor-pointer font-medium">
                Why the other answers do not fit
              </summary>
              <ul className="mt-2 grid gap-2" data-other-answers>
                {others.map((choice) => (
                  <li key={choice.id}>
                    <span className="font-medium">{choice.label}</span> — {choice.rationale}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}

      {onContinue ? (
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold"
          onClick={onContinue}
          data-verdict-continue
        >
          {continueLabel}
        </button>
      ) : null}
    </article>
  )
}
