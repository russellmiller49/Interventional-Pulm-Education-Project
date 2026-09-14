'use client'
import { useMemo, useState, type ReactNode } from 'react'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import type { Question } from '../content/types'
import styles from './course.module.css'
import { choiceOrder } from '../content/authoring'
import { QuestionExplanation } from './QuestionExplanation'

/**
 * One optional check. The learner may select and check a response, open a hint, open the
 * explanation before or after answering, and try again after any response. None of it is
 * recorded anywhere: the caller holds the in-session response, and the caller decides how the
 * learner moves on (Continue is always the caller's, never contingent on this card).
 *
 * `unavailableReason` is the one genuine precondition: an image-interpretation check whose image
 * is not held cannot be answered truthfully, so checking is withheld while the explanation stays
 * open. A learner who moves on without the image has answered nothing and acquired nothing.
 */
export function QuestionBody({
  question,
  selected,
  committed,
  onSelect,
  onCheck,
  onRetry,
  hint,
  unavailableReason,
  readOnly = false,
  onExplanationChange,
}: {
  question: Question
  selected: string
  committed: string | undefined
  onSelect: (id: string) => void
  onCheck: () => void
  onRetry: () => void
  hint?: ReactNode
  unavailableReason?: string
  readOnly?: boolean
  onExplanationChange?: (open: boolean) => void
}) {
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const item = useMemo<ClinicalLearningItem>(
    () => ({
      id: question.id,
      activityId: 'ebus-guided',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'technical',
      stem: question.prompt,
      choices: question.choices.map((c) => ({
        id: c.id,
        label: c.text,
        rationale: c.rationale,
        plausibility: c.unsafe ? 'unsafe' : c.correct ? 'best' : 'incorrect-mechanism',
      })),
      correctChoiceIds: question.choices.filter((c) => c.correct).map((c) => c.id),
      explanation: question.explanation,
      evidenceIds: ['ebus-guided-sources'],
      reviewStatus: 'draft',
    }),
    [question],
  )
  const chosen = question.choices.find((choice) => choice.id === committed)
  const canCheck =
    !readOnly && !committed && !unavailableReason && question.choices.some((c) => c.id === selected)
  return (
    <div
      className={styles.questionFeedback}
      data-question-id={question.id}
      data-answered={committed ? 'true' : 'false'}
      data-repeated-reasoning={!!committed && chosen?.rationale === question.explanation}
    >
      <fieldset
        className={styles.choices}
        disabled={!!committed || !!unavailableReason || readOnly}
      >
        <legend>{question.prompt}</legend>
        {choiceOrder(question).map((c) => (
          <label key={c.id} data-selected={selected === c.id || undefined}>
            <input
              type="radio"
              name={question.id}
              value={c.id}
              checked={selected === c.id}
              onChange={() => onSelect(c.id)}
            />{' '}
            <span>{c.text}</span>
          </label>
        ))}
      </fieldset>
      {unavailableReason && (
        <p role="status" className={styles.taskStatus} data-question-unavailable>
          {unavailableReason}
        </p>
      )}
      {!readOnly && (
        <div className={styles.checkActions} data-question-actions>
          {!committed && (
            <button type="button" className={styles.button} disabled={!canCheck} onClick={onCheck}>
              Check response
            </button>
          )}
          {committed && !chosen?.correct && (
            <button type="button" className={styles.secondary} onClick={onRetry}>
              Try again
            </button>
          )}
          {hint && (
            <button
              type="button"
              className={styles.secondary}
              aria-expanded={hintOpen}
              onClick={() => setHintOpen((open) => !open)}
            >
              {hintOpen ? 'Hide hint' : 'Hint'}
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            aria-expanded={explanationOpen}
            onClick={() => {
              const open = !explanationOpen
              setExplanationOpen(open)
              onExplanationChange?.(open)
            }}
          >
            {explanationOpen ? 'Hide explanation' : 'Show explanation'}
          </button>
        </div>
      )}
      {hintOpen && hint && (
        <div className={styles.hint} data-question-hint>
          <p>
            <strong>Hint</strong>
          </p>
          {hint}
        </div>
      )}
      {committed && (
        <AnswerVerdict
          item={item}
          choiceId={committed}
          timing="immediate-after-commit"
          outcome="stated"
          frames={{
            best: 'This addresses the clinical question',
            'incorrect-mechanism': 'Reconsider this interpretation',
          }}
          explanationHeading="Reasoning"
        />
      )}
      {explanationOpen && (
        <QuestionExplanation
          item={item}
          note={
            committed
              ? undefined
              : 'Shown without an answer. Reading it is not a response; you can still check a response afterwards.'
          }
        />
      )}
    </div>
  )
}
