'use client'

import type { AuthoredChoice, AuthoredQuestion } from '../../content/types'
import type { AnswerState, LessonAction, QuestionKey } from '../../engine/stageSession'
import styles from './lesson.module.css'
import { LESSON_WORDS, PLAUSIBILITY_WORDS } from './lessonWords'

function verdictOf(choice: AuthoredChoice): string {
  return PLAUSIBILITY_WORDS[choice.plausibility]
}

/**
 * An optional question (learning contract): the explanation can be read before answering, any
 * answer can be changed and checked again, and the question can be left. Nothing chosen is kept.
 * Once an answer is checked, why each of the others does or does not fit can be read too.
 */
export function QuestionView({
  question,
  answer,
  which,
  dispatch,
}: {
  readonly question: AuthoredQuestion
  readonly answer: AnswerState
  readonly which: QuestionKey
  readonly dispatch: (action: LessonAction) => void
}) {
  const chosen = question.choices.find((choice) => choice.id === answer.chosen) ?? null
  const others = question.choices.filter((choice) => choice.id !== answer.chosen)
  return (
    <div className={styles.questionBlock} data-question={question.id}>
      <p className={styles.note}>{LESSON_WORDS.questionNote}</p>
      <fieldset className={styles.question}>
        <legend className={styles.stem}>{question.stem}</legend>
        {question.choices.map((choice) => (
          <label key={choice.id} className={styles.choice}>
            <input
              type="radio"
              name={`choices-${question.id}`}
              value={choice.id}
              checked={answer.chosen === choice.id}
              onChange={() => dispatch({ type: 'choose', question: which, choice: choice.id })}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </fieldset>
      <div className={styles.questionActions}>
        <button
          type="button"
          className={styles.courseButton}
          onClick={() => dispatch({ type: 'check', question: which })}
          aria-disabled={chosen === null || undefined}
          aria-describedby={chosen === null ? `choose-first-${question.id}` : undefined}
          data-check
        >
          {LESSON_WORDS.check}
        </button>
        {answer.explanationOpen || answer.checked ? null : (
          <button
            type="button"
            className={styles.courseButton}
            onClick={() => dispatch({ type: 'explain', question: which })}
            data-explain
          >
            {LESSON_WORDS.explain}
          </button>
        )}
        {chosen === null ? (
          <span id={`choose-first-${question.id}`} className={styles.note}>
            {LESSON_WORDS.chooseFirst}
          </span>
        ) : null}
      </div>
      <div role="status" aria-live="polite">
        {answer.checked && chosen ? (
          <div className={styles.feedback} data-plausibility={chosen.plausibility}>
            <p>
              <strong>{verdictOf(chosen)}</strong> {chosen.feedback}
            </p>
          </div>
        ) : null}
      </div>
      {answer.checked || answer.explanationOpen ? (
        <section className={styles.explanation} aria-label={LESSON_WORDS.explanationHeading}>
          <h3 className={styles.subHeading}>{LESSON_WORDS.explanationHeading}</h3>
          <p>{question.explanation}</p>
          {answer.checked ? (
            <ul className={styles.others}>
              {others.map((choice) => (
                <li key={choice.id}>
                  <strong>{choice.label}.</strong> {verdictOf(choice)} {choice.feedback}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
