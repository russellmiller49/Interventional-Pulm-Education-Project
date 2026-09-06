'use client'

import { useRef, useState } from 'react'
import type { Route } from 'next'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import {
  ventilationObjectives,
  ventilationLearningUnits,
  ventilationUnitById,
  ventilationUnitHref,
} from '../content/learningCurriculum'
import {
  ventilationFinalQuestions,
  ventilationPlacementQuestions,
  type VentilationQuestion,
} from '../content/learningQuestions'
import {
  commitVentilationAnswer,
  hasFocusedGuidance,
  scoreVentilationQuestions,
  type VentilationAnswer,
} from '../engine/learningProgress'
import { useVentilationLearningProgress } from './useVentilationLearningProgress'
import { useVentilationLabProgress } from './useVentilationLabProgress'
import { ventilationLiveReviewQueue } from '../engine/learningReview'
import {
  VentilationLearningQuestion,
  VentilationQuestionFeedback,
} from './VentilationLearningQuestion'
import { VentilationLearningSources } from './VentilationLearningVisuals'
import styles from './ventilation-course.module.css'

export function MechanicalVentilationCourseCheck({
  kind,
}: {
  readonly kind: 'placement' | 'final' | 'review'
}) {
  const { progress, ready, storageAvailable, update } = useVentilationLearningProgress()
  const lab = useVentilationLabProgress()
  const [started, setStarted] = useState(false)
  const [reviewQuestions, setReviewQuestions] = useState<readonly VentilationQuestion[] | null>(
    null,
  )
  const [reviewAnswers, setReviewAnswers] = useState<Readonly<Record<string, VentilationAnswer>>>(
    {},
  )
  const top = useRef<HTMLHeadingElement>(null)
  const missing = ventilationLearningUnits.filter(
    (unit) => !lab.progress.units[unit.id]?.completedAt,
  )
  const questions =
    kind === 'placement'
      ? ventilationPlacementQuestions
      : kind === 'final'
        ? ventilationFinalQuestions
        : (reviewQuestions ?? ventilationLiveReviewQueue(lab.progress, progress))
  const answers =
    kind === 'placement'
      ? progress.placement
      : kind === 'final'
        ? progress.finalAnswers
        : reviewAnswers
  const index = questions.findIndex((question) => !answers[question.id]?.reviewed)
  const complete = questions.length > 0 && index < 0
  const question = index >= 0 ? questions[index] : undefined
  const score = scoreVentilationQuestions(questions, answers)
  const next = missing[0]
  const inProgress = started || (kind !== 'review' && questions.some((item) => answers[item.id]))
  const title =
    kind === 'placement'
      ? 'Find the right amount of guidance.'
      : kind === 'final'
        ? 'Bring the whole course together.'
        : 'Make the ideas stick.'

  function start() {
    if (kind === 'review') {
      setReviewQuestions(questions)
      setReviewAnswers({})
    }
    setStarted(true)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function commit(answer: VentilationAnswer) {
    if (!question) return
    if (kind === 'review')
      setReviewAnswers((previous) => commitVentilationAnswer(previous, question, answer))
    else
      update((previous) =>
        kind === 'placement'
          ? {
              ...previous,
              placement: commitVentilationAnswer(previous.placement, question, answer),
            }
          : {
              ...previous,
              finalAnswers: commitVentilationAnswer(previous.finalAnswers, question, answer),
            },
      )
  }
  function advance() {
    if (!question || !answers[question.id]) return
    const reviewed = { ...answers[question.id], reviewed: true }
    if (kind === 'review') {
      setReviewAnswers((previous) => ({ ...previous, [question.id]: reviewed }))
      update((previous) => ({
        ...previous,
        review: { ...previous.review, [question.id]: reviewed },
      }))
    } else
      update((previous) => {
        if (kind === 'placement')
          return { ...previous, placement: { ...previous.placement, [question.id]: reviewed } }
        const finalAnswers = { ...previous.finalAnswers, [question.id]: reviewed }
        const allReviewed = questions.every((item) => finalAnswers[item.id]?.reviewed)
        const finalScore = scoreVentilationQuestions(questions, finalAnswers)
        return {
          ...previous,
          finalAnswers,
          finalHistory: allReviewed
            ? [
                ...previous.finalHistory,
                {
                  score: finalScore.correct,
                  total: finalScore.total,
                  safe: finalScore.safe,
                  completedAt: new Date().toISOString(),
                },
              ].slice(-20)
            : previous.finalHistory,
        }
      })
    window.scrollTo({ top: 0, behavior: 'instant' })
    top.current?.focus({ preventScroll: true })
  }
  const titleForActive =
    kind === 'placement'
      ? 'Starting-level check'
      : kind === 'final'
        ? 'Independent mixed check'
        : 'Spaced review'

  if (!ready || !lab.ready)
    return (
      <div className={styles.course}>
        <div className={styles.lessonShell}>
          <p role="status">Checking your saved learning…</p>
        </div>
      </div>
    )
  return (
    <div className={styles.course}>
      <div className={styles.lessonShell}>
        <div className={styles.topline}>
          <nav className={styles.breadcrumb} aria-label="Check breadcrumb">
            <Link href={'/mechanical-ventilation' as Route}>Mechanical ventilation</Link>
            <span>/</span>
            <span>{titleForActive}</span>
          </nav>
          <Link className={styles.textLink} href={'/mechanical-ventilation/learn' as Route}>
            Learn
          </Link>
        </div>
        {!storageAvailable && (
          <p className={`${styles.notice} ${styles.warning}`} role="status">
            Progress cannot be stored. Keep this page open to finish this session.
          </p>
        )}
        <header className={`${styles.lessonHeader} ${styles.reading}`}>
          <p className={styles.eyebrow}>{titleForActive}</p>
          <h1 ref={top} tabIndex={-1}>
            {complete
              ? kind === 'placement'
                ? 'Your guidance is ready.'
                : kind === 'review'
                  ? 'Your review is complete.'
                  : score.passed
                    ? 'Knowledge check met.'
                    : 'Use this result to guide your review.'
              : inProgress
                ? `Question ${index + 1} of ${questions.length}`
                : title}
          </h1>
          {inProgress && !complete && (
            <progress
              className={styles.progress}
              aria-label="Check progress"
              max={questions.length}
              value={index}
            />
          )}
        </header>
        {kind === 'final' && missing.length > 0 ? (
          <section className={`${styles.card} ${styles.reading}`}>
            <h2>Work through the fourteen sections first.</h2>
            <p className={styles.muted}>
              Each section asks for a prediction, a change on the running patient and a watched
              response, twice. This check opens once every section has been worked through; the
              starting-level check only adjusts how much guidance the sections give.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} href={ventilationUnitHref(missing[0].id) as Route}>
                Continue — {missing[0].shortTitle}
                <ArrowRight size={16} />
              </Link>
            </div>
            <details className={styles.details} open>
              <summary>Sections still to work through</summary>
              <ul>
                {missing.map((unit) => (
                  <li key={unit.id}>
                    <Link href={ventilationUnitHref(unit.id) as Route}>{unit.title}</Link>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        ) : !inProgress && !complete ? (
          <section className={`${styles.card} ${styles.reading}`}>
            <h2>
              {kind === 'placement'
                ? 'Start where the guidance fits you.'
                : kind === 'review'
                  ? `${questions.length} questions ready to revisit`
                  : 'A limited check of clinical reasoning'}
            </h2>
            <p>
              {kind === 'placement'
                ? `${questions.length} short decisions help adjust the worked guidance for each learning objective. No lesson is marked complete, and you can restore the full explanation at any time.`
                : kind === 'review'
                  ? 'Revisit missed or uncertain concepts, then refresh them over time. Original choices remain in your learning record.'
                  : `${questions.length} new questions mix mechanisms from the course. Commit every answer before seeing feedback. Passing requires at least 80% correct and no unsafe choice.`}
            </p>
            <p className={styles.notice}>
              {kind === 'review'
                ? 'Spacing is scheduled locally: initial uncertainty is available now; successful concepts return after about a week, then a month. These are course design intervals.'
                : kind === 'placement'
                  ? 'This check helps choose guidance. A correct response is one limited observation; your unit decisions still matter.'
                  : 'This assesses “knows how” reasoning in authored cases. Passing does not establish bedside competence or grant a clinical credential.'}
            </p>
            {questions.length > 0 ? (
              <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={start}>
                  Start{' '}
                  {kind === 'placement'
                    ? 'placement check'
                    : kind === 'review'
                      ? 'review'
                      : 'final check'}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <Link
                className={styles.primary}
                href={
                  (next
                    ? ventilationUnitHref(next.id)
                    : '/mechanical-ventilation/practice') as Route
                }
              >
                Continue learning <ArrowRight size={16} />
              </Link>
            )}
          </section>
        ) : !complete && question ? (
          <section className={`${styles.card} ${styles.questionWidth}`}>
            <VentilationLearningQuestion
              key={question.id}
              question={question}
              answer={answers[question.id]}
              label={`Question ${index + 1} of ${questions.length}`}
              onCommit={commit}
              onContinue={advance}
              continueLabel={index === questions.length - 1 ? 'See your feedback' : 'Next question'}
              deferFeedback={kind !== 'review'}
            />
          </section>
        ) : complete ? (
          <div className={styles.reading}>
            <section className={styles.card}>
              <div className={styles.resultLine}>
                <div>
                  <span className={styles.number}>
                    {score.correct}
                    <small> / {score.total}</small>
                  </span>
                  <p className={styles.muted}>Correct on this attempt</p>
                </div>
                {score.passed && kind === 'final' && (
                  <CheckCircle2 className={styles.checkmark} size={32} aria-hidden="true" />
                )}
              </div>
              <p className={styles.notice}>
                {kind === 'placement'
                  ? 'Your answers set the amount of guidance. They do not skip units or prove competence.'
                  : kind === 'review'
                    ? 'This review is additional retrieval practice. It does not replace your original first-attempt answers.'
                    : score.passed
                      ? 'You met this authored knowledge-check standard: at least 80% correct with no unsafe choices. Supervised training and observation in clinical practice remain necessary.'
                      : `The standard is at least 80% correct with no unsafe choice. ${!score.safe ? 'At least one choice could delay or compromise appropriate care; review its rationale before a repeat attempt.' : 'Revisit the linked units and try the check again after further practice.'}`}
              </p>
              {kind === 'placement' && (
                <div className={styles.results}>
                  {ventilationObjectives.map((objective) => (
                    <div className={styles.controlRow} key={objective.id}>
                      <strong>{objective.title}</strong>
                      <p>
                        {hasFocusedGuidance(progress, objective.id)
                          ? 'Begin with decisions; full explanations stay available.'
                          : 'Use the explanation and worked example before the decisions.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.actions}>
                <Link
                  className={styles.primary}
                  href={
                    (kind === 'placement' && next
                      ? ventilationUnitHref(next.id)
                      : kind === 'final' && score.passed
                        ? '/mechanical-ventilation/practice'
                        : '/mechanical-ventilation/learn') as Route
                  }
                >
                  {kind === 'placement' && next
                    ? `Continue — ${next.shortTitle}`
                    : kind === 'final' && score.passed
                      ? 'Apply it in case practice'
                      : 'Return to Learn'}
                  <ArrowRight size={16} />
                </Link>
              </div>
              {kind === 'final' && (
                <details className={styles.details}>
                  <summary>Repeat this check after review</summary>
                  <p>
                    These questions will be familiar on a repeat attempt. The result remains a
                    practice check, and the previous attempt stays in your history.
                  </p>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      update((previous) => ({ ...previous, finalAnswers: {} }))
                      setStarted(false)
                    }}
                  >
                    Prepare a repeat attempt
                  </button>
                </details>
              )}
            </section>
            <section className={styles.results} aria-label="Your answers and targeted feedback">
              {questions.map((item, itemIndex) => (
                <details key={item.id} className={styles.card}>
                  <summary style={{ cursor: 'pointer' }}>
                    <strong>Question {itemIndex + 1}</strong> ·{' '}
                    {answers[item.id]?.choiceId === item.correctId
                      ? 'Correct'
                      : 'Review this decision'}
                    {answers[item.id]?.confidence === 'sure' &&
                    answers[item.id]?.choiceId !== item.correctId
                      ? ' · Confident error'
                      : ''}
                  </summary>
                  <p style={{ marginTop: 16 }}>{item.prompt}</p>
                  <VentilationQuestionFeedback question={item} answer={answers[item.id]} />
                  <Link
                    className={styles.textLink}
                    href={ventilationUnitHref(item.unitId) as Route}
                  >
                    Review: {ventilationUnitById.get(item.unitId)?.title}
                  </Link>
                  <VentilationLearningSources evidenceIds={item.evidenceIds} />
                </details>
              ))}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
