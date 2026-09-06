'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import type { VentilationQuestion } from '../content/learningQuestions'
import type { VentilationAnswer, VentilationConfidence } from '../engine/learningProgress'
import styles from './ventilation-course.module.css'

export function VentilationQuestionFeedback({
  question,
  answer,
}: {
  readonly question: VentilationQuestion
  readonly answer: VentilationAnswer
}) {
  const selected = question.choices.find((choice) => choice.id === answer.choiceId)!
  const correct = selected.id === question.correctId
  const best = question.choices.find((choice) => choice.id === question.correctId)!
  return (
    <div className={styles.feedback} data-correct={correct}>
      <h3>
        {correct
          ? 'Your reasoning fits.'
          : selected.unsafe
            ? 'This choice can put the patient at risk.'
            : 'Reconsider the mechanism.'}
      </h3>
      <p>
        <strong>Your choice: </strong>
        {selected.label}
      </p>
      <p style={{ marginTop: 10 }}>{selected.rationale}</p>
      {!correct && (
        <p style={{ marginTop: 14 }}>
          <strong>Best answer: {best.label}. </strong>
          {best.rationale}
        </p>
      )}
      <details className={styles.details}>
        <summary>Compare the other choices</summary>
        {question.choices
          .filter((choice) => choice.id !== selected.id && (correct || choice.id !== best.id))
          .map((choice) => (
            <p key={choice.id}>
              <strong>{choice.label}. </strong>
              {choice.rationale}
            </p>
          ))}
      </details>
    </div>
  )
}

export function VentilationLearningQuestion({
  question,
  answer,
  label = 'Make a decision',
  onCommit,
  onContinue,
  continueLabel = 'Continue',
  deferFeedback = false,
}: {
  readonly question: VentilationQuestion
  readonly answer?: VentilationAnswer
  readonly label?: string
  readonly onCommit: (answer: VentilationAnswer) => void
  readonly onContinue: () => void
  readonly continueLabel?: string
  readonly deferFeedback?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(answer?.choiceId ?? null)
  const [confidence, setConfidence] = useState<VentilationConfidence>('unsure')
  const feedback = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (answer) feedback.current?.focus()
  }, [answer])
  return (
    <div className={styles.question} data-ventilation-question={question.id}>
      <p className={styles.eyebrow}>{label}</p>
      <span className={styles.badge}>Authored teaching case</span>
      <fieldset disabled={!!answer}>
        <legend>{question.prompt}</legend>
        {question.choices.map((choice) => (
          <label key={choice.id} className={styles.choice}>
            <input
              type="radio"
              name={question.id}
              value={choice.id}
              checked={(answer?.choiceId ?? selected) === choice.id}
              onChange={() => setSelected(choice.id)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </fieldset>
      {!answer ? (
        <>
          <div className={styles.confidence}>
            <span>How certain are you?</span>
            <button
              type="button"
              aria-pressed={confidence === 'unsure'}
              onClick={() => setConfidence('unsure')}
            >
              Still thinking it through
            </button>
            <button
              type="button"
              aria-pressed={confidence === 'sure'}
              onClick={() => setConfidence('sure')}
            >
              I can explain why
            </button>
          </div>
          <button
            type="button"
            className={styles.primary}
            disabled={selected === null}
            onClick={() => {
              if (selected !== null)
                onCommit({
                  choiceId: selected,
                  confidence,
                  reviewed: false,
                  answeredAt: new Date().toISOString(),
                })
            }}
          >
            Commit answer <ArrowRight size={16} aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <div ref={feedback} tabIndex={-1} role="status">
            {deferFeedback ? (
              <p className={styles.notice}>
                Answer recorded. Explanations follow the last question.
              </p>
            ) : (
              <VentilationQuestionFeedback question={question} answer={answer} />
            )}
          </div>
          <button type="button" className={styles.primary} onClick={onContinue}>
            {answer.reviewed && <CheckCircle2 size={16} aria-hidden="true" />}
            {continueLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}
