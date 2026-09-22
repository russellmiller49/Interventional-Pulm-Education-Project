'use client'

import type { ReactNode } from 'react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

type VerdictFrames = Parameters<typeof AnswerVerdict>[0]['frames']

/**
 * An item's explanation, opened by the learner — with or without an answer.
 *
 * Self-paced contract (HD-01): the explanation is always reachable before an answer. The card gives
 * the best-supported option and why, the takeaway, and why each other option falls short, naming an
 * unsafe option as unsafe, because a safety explanation is teaching whether or not anyone chose it.
 * It records nothing — no choice, no verdict — and its note says it was opened without an answer,
 * so it is never mistaken for feedback on one.
 */
export function HemodynamicsExplanation({
  item,
  note = 'Opened without an answer. Nothing is recorded.',
  heading = 'Explanation',
}: {
  readonly item: ClinicalLearningItem
  readonly note?: string
  readonly heading?: string
}) {
  const best = item.choices.filter((choice) => item.correctChoiceIds.includes(choice.id))
  const others = item.choices.filter((choice) => !item.correctChoiceIds.includes(choice.id))
  return (
    <section
      className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm leading-6"
      aria-label={heading}
      data-explanation-reveal={item.id}
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

/**
 * One optional question: choose and check, ask for a hint, open the explanation first, try again.
 *
 * The caller owns the state (what is selected, what was checked, whether the explanation is open)
 * so a look-back renders the same thing. Checking shows the shared verdict card; Try again clears the
 * checked choice so the learner can answer again; none of it is required to move on — Continue lives
 * on the Now card, not here. `choicesElsewhere` replaces the radio list when the choices are pins on
 * the catheter map.
 */
export function HemodynamicsQuestionBlock({
  item,
  name,
  selectedId,
  onSelect,
  checkedId,
  onCheck,
  onTryAgain,
  explanationOpen,
  onToggleExplanation,
  hintOpen,
  onToggleHint,
  hint,
  frames,
  choicesElsewhere,
  legend,
  checkLabel = 'Check answer',
}: {
  readonly item: ClinicalLearningItem
  readonly name: string
  readonly selectedId: string | null
  readonly onSelect: (choiceId: string) => void
  readonly checkedId: string | undefined
  readonly onCheck: () => void
  readonly onTryAgain: () => void
  readonly explanationOpen: boolean
  readonly onToggleExplanation: () => void
  readonly hintOpen: boolean
  readonly onToggleHint: () => void
  readonly hint: string
  readonly frames?: VerdictFrames
  readonly choicesElsewhere?: ReactNode
  readonly legend?: string
  readonly checkLabel?: string
}) {
  if (checkedId) {
    return (
      <div data-question={item.id} data-question-state="checked">
        {/*
          The question stays on screen with its answer.
          Checking an answer replaced the stem and the options with the verdict card, so a learner
          reading "why the other answers compare" was reading about options they could no longer
          see, and the question they were answering was gone (report L1-03). The card already
          repeats each option's label and rationale; what it cannot supply is the stem, so the stem
          is kept above it. Nothing about the answer, the options or the reveal order changes.
        */}
        <p className={stageStyles.taskInstruction} data-question-stem>
          {legend ?? item.stem}
        </p>
        <AnswerVerdict
          item={item}
          choiceId={checkedId}
          outcome="stated"
          timing="immediate-after-commit"
          theme="dark"
          frames={frames}
        />
        <div className={stageStyles.completionActions} data-question-actions>
          <button
            type="button"
            className={shellStyles.nowSecondary}
            data-question-try-again
            onClick={onTryAgain}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
  return (
    <div data-question={item.id} data-question-state={explanationOpen ? 'explained' : 'open'}>
      {choicesElsewhere ?? (
        <fieldset className={stageStyles.choiceList} data-prediction-choices>
          <legend>{legend ?? item.stem}</legend>
          {orderChoices(item.id, item.choices).map((choice) => (
            <label
              key={choice.id}
              className={stageStyles.choice}
              data-selected={selectedId === choice.id}
            >
              <input
                type="radio"
                name={name}
                value={choice.id}
                checked={selectedId === choice.id}
                onChange={() => onSelect(choice.id)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className={stageStyles.completionActions} data-question-actions>
        <button
          type="button"
          className={shellStyles.nowSecondary}
          data-question-check
          disabled={!selectedId}
          onClick={onCheck}
        >
          {checkLabel}
        </button>
        <button
          type="button"
          className={shellStyles.nowSecondary}
          data-question-hint-toggle
          aria-expanded={hintOpen}
          onClick={onToggleHint}
        >
          {hintOpen ? 'Hide hint' : 'Hint'}
        </button>
        <button
          type="button"
          className={shellStyles.nowSecondary}
          data-question-explanation-toggle
          aria-expanded={explanationOpen}
          onClick={onToggleExplanation}
        >
          {explanationOpen ? 'Hide explanation' : 'Show explanation'}
        </button>
      </div>
      {!selectedId ? (
        <p className={stageStyles.taskInstruction} data-question-optional>
          This question is optional. Choose an answer to check it, or open the explanation first.
        </p>
      ) : null}
      {hintOpen ? (
        <p className={stageStyles.taskInstruction} data-question-hint>
          <strong>Hint.</strong> {hint}
        </p>
      ) : null}
      {explanationOpen ? <HemodynamicsExplanation item={item} /> : null}
    </div>
  )
}
