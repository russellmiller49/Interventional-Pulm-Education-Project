'use client'
import { useMemo, useState } from 'react'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import type { Question } from '../content/types'
import { QuestionExplanation } from './QuestionExplanation'
import styles from './eus-b-guided.module.css'

/**
 * One question. The learner may select and check a response, open the explanation before or after
 * answering, and try again after any response. None of it is stored: the caller holds the
 * in-session response and decides how the learner moves on.
 */
export function QuestionBody({
  question,
  selected,
  committed,
  onSelect,
  onCheck,
  onRetry,
  onExplanationChange,
}: {
  question: Question
  selected: string
  committed: string | undefined
  onSelect: (id: string) => void
  onCheck: () => void
  onRetry: () => void
  onExplanationChange?: (open: boolean) => void
}) {
  const [explanationOpen, setExplanationOpen] = useState(false)
  const item = useMemo<ClinicalLearningItem>(
    () => ({
      id: question.id,
      activityId: 'eus-b-guided',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'technical',
      stem: question.prompt,
      choices: question.choices.map((choice) => ({
        id: choice.id,
        label: choice.text,
        rationale: choice.rationale,
        plausibility: choice.unsafe ? 'unsafe' : choice.correct ? 'best' : 'incorrect-mechanism',
      })),
      correctChoiceIds: question.choices.filter((choice) => choice.correct).map((c) => c.id),
      explanation: question.explanation,
      evidenceIds: ['eus-b-guided-sources'],
      reviewStatus: 'draft',
    }),
    [question],
  )
  const chosen = question.choices.find((choice) => choice.id === committed)
  const canCheck = !committed && question.choices.some((choice) => choice.id === selected)
  return (
    <div
      className={styles.questionFeedback}
      data-question-id={question.id}
      data-answered={committed ? 'true' : 'false'}
    >
      <fieldset className={styles.choices} disabled={!!committed}>
        <legend>{question.prompt}</legend>
        {orderChoices(question.id, question.choices).map((choice) => (
          <label key={choice.id} data-selected={selected === choice.id || undefined}>
            <input
              type="radio"
              name={question.id}
              value={choice.id}
              checked={selected === choice.id}
              onChange={() => onSelect(choice.id)}
            />{' '}
            <span>{choice.text}</span>
          </label>
        ))}
      </fieldset>
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
      {committed && (
        <AnswerVerdict
          item={item}
          choiceId={committed}
          timing="immediate-after-commit"
          outcome="stated"
          theme="dark"
          frames={{
            best: 'This fits the anatomy',
            'incorrect-mechanism': 'Reconsider this',
            unsafe: 'Unsafe: this would put a patient at risk',
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
