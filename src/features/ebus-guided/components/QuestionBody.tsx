'use client'
import { useMemo } from 'react'
import {
  AnswerVerdict,
  type VerdictTiming,
} from '@/features/learning-module/components/AnswerVerdict'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import type { Question } from '../content/types'
import styles from './course.module.css'
import { choiceOrder } from '../content/authoring'
export function QuestionBody({
  question,
  selected,
  committed,
  onSelect,
  timing = 'immediate-after-commit',
  debrief = false,
}: {
  question: Question
  selected: string
  committed: string | undefined
  onSelect: (id: string) => void
  timing?: VerdictTiming
  debrief?: boolean
}) {
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
  return (
    <div>
      <fieldset className={styles.choices} disabled={!!committed}>
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
      {committed && (
        <AnswerVerdict
          item={item}
          choiceId={committed}
          timing={timing}
          inDebrief={debrief}
          outcome="stated"
          frames={{
            best: 'This addresses the clinical question',
            'incorrect-mechanism': 'Reconsider this interpretation',
          }}
          explanationHeading="Reasoning"
        />
      )}
    </div>
  )
}
