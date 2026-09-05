'use client'

import { useEffect, useRef, useState } from 'react'
import type { Route } from 'next'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3 } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import {
  ventilationLearningUnits,
  ventilationStages,
  ventilationUnitById,
  ventilationUnitHref,
  type VentilationLearningUnit,
} from '../content/learningCurriculum'
import { unitQuestion, type VentilationQuestion } from '../content/learningQuestions'
import {
  commitVentilationAnswer,
  emptyVentilationUnitProgress,
  hasFocusedGuidance,
  nextVentilationUnit,
  scoreVentilationQuestions,
  unitReadyToComplete,
  ventilationLearningSteps,
  type VentilationAnswer,
  type VentilationLearningStep,
  type VentilationUnitProgress,
} from '../engine/learningProgress'
import { useVentilationLearningProgress } from './useVentilationLearningProgress'
import { VentilationLearningQuestion } from './VentilationLearningQuestion'
import {
  VentilationBreathExplorer,
  VentilationBreathSpine,
  VentilationControlMap,
  VentilationDecisionTable,
  VentilationExpirationExplorer,
  VentilationLearningExperiment,
  VentilationLearningSources,
  VentilationProtectionReference,
} from './VentilationLearningVisuals'
import styles from './ventilation-course.module.css'

const stepNames = {
  prepare: 'Recall',
  learn: 'Learn',
  example: 'Example',
  check: 'Decide',
  transfer: 'Transfer',
  recap: 'Take forward',
} as const

export function MechanicalVentilationLearningActivity({
  unit,
  locale = 'en',
}: {
  readonly unit: VentilationLearningUnit
  readonly locale?: string
}) {
  const { progress, ready, storageAvailable, update } = useVentilationLearningProgress()
  const record = progress.units[unit.id] ?? emptyVentilationUnitProgress()
  const [fullGuidance, setFullGuidance] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(record.step)
  const focused = hasFocusedGuidance(progress, unit.objective) && !fullGuidance
  const step = record.step
  const index = ventilationLearningUnits.findIndex((entry) => entry.id === unit.id)
  const stage = ventilationStages.find((entry) => entry.id === unit.stage)!
  const recall = unit.recallUnit ? unitQuestion(unit.recallUnit, 'transfer') : null
  const question =
    step === 'prepare'
      ? recall
      : step === 'check'
        ? unitQuestion(unit.id, 'check')
        : step === 'transfer'
          ? unitQuestion(unit.id, 'transfer')
          : null
  const inQuestion = !!question
  const next = nextVentilationUnit(progress)

  function changeRecord(change: (previous: VentilationUnitProgress) => VentilationUnitProgress) {
    update((previous) => ({
      ...previous,
      units: {
        ...previous.units,
        [unit.id]: change(previous.units[unit.id] ?? emptyVentilationUnitProgress()),
      },
    }))
  }
  function go(nextStep: VentilationLearningStep) {
    changeRecord((previous) => ({ ...previous, step: nextStep }))
  }
  function commit(question: VentilationQuestion, answer: VentilationAnswer) {
    changeRecord((previous) => ({
      ...previous,
      answers: commitVentilationAnswer(previous.answers, question, answer),
    }))
  }
  function continueQuestion() {
    if (!question || !record.answers[question.id]) return
    changeRecord((previous) => {
      const answer = previous.answers[question.id]
      if (!answer) return previous
      return {
        ...previous,
        answers: { ...previous.answers, [question.id]: { ...answer, reviewed: true } },
        step:
          step === 'prepare'
            ? focused
              ? 'check'
              : 'learn'
            : step === 'check'
              ? 'transfer'
              : 'recap',
      }
    })
  }
  function completeUnit() {
    changeRecord((previous) =>
      unitReadyToComplete(unit.id, previous)
        ? { ...previous, completedAt: previous.completedAt ?? new Date().toISOString() }
        : previous,
    )
  }

  useEffect(() => {
    if (previousStep.current !== step) {
      heading.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
      previousStep.current = step
    }
  }, [step])
  useEffect(() => {
    if (!ready) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      update((previous) => {
        const unitProgress = previous.units[unit.id] ?? emptyVentilationUnitProgress()
        if (unitProgress.completedAt) return previous
        return {
          ...previous,
          units: {
            ...previous.units,
            [unit.id]: { ...unitProgress, seconds: unitProgress.seconds + 15 },
          },
        }
      })
    }, 15000)
    return () => window.clearInterval(timer)
  }, [ready, unit.id, update])

  if (!ready)
    return (
      <div className={styles.course}>
        <div className={styles.lessonShell}>
          <p role="status">Restoring your place in the lesson…</p>
        </div>
      </div>
    )
  const unitScore = scoreVentilationQuestions(
    [unitQuestion(unit.id, 'check'), unitQuestion(unit.id, 'transfer')],
    record.answers,
  )
  const visual =
    unit.visual === 'breath' ? (
      <VentilationBreathExplorer />
    ) : unit.visual === 'controls' ? (
      <VentilationControlMap />
    ) : unit.visual === 'protection' ? (
      <VentilationProtectionReference />
    ) : unit.visual === 'expiration' ? (
      <VentilationExpirationExplorer />
    ) : null

  return (
    <div className={styles.course}>
      <div className={styles.lessonShell} data-ventilation-learning-unit={unit.id}>
        <div className={styles.topline}>
          <nav className={styles.breadcrumb} aria-label="Lesson breadcrumb">
            <Link href={'/mechanical-ventilation' as Route}>Mechanical ventilation</Link>
            <span aria-hidden="true">/</span>
            <Link href={'/mechanical-ventilation/learn' as Route}>Learning path</Link>
            <span aria-hidden="true">/</span>
            <span>
              Unit {index + 1} of {ventilationLearningUnits.length}
            </span>
          </nav>
          <Link className={styles.textLink} href={'/mechanical-ventilation/learn' as Route}>
            Save & exit
          </Link>
        </div>
        {!storageAvailable && (
          <p className={`${styles.notice} ${styles.warning}`} role="status">
            Progress cannot be saved in this browser. Your current session still works; keep this
            page open to retain your place.
          </p>
        )}
        {locale !== 'en' && (
          <p className={styles.notice}>
            This course currently uses English clinical teaching content. Reviewed translations are
            pending.
          </p>
        )}
        <header className={styles.lessonHeader}>
          <p className={styles.eyebrow}>
            {stage.title} · Unit {index + 1} · {unit.minutes} min
          </p>
          <h1 ref={heading} tabIndex={-1}>
            {inQuestion
              ? step === 'prepare'
                ? 'Bring an earlier idea back.'
                : step === 'check'
                  ? 'Make your next decision.'
                  : 'Try it in a different situation.'
              : unit.title}
          </h1>
          <p>
            {inQuestion
              ? 'Read the observations, choose your answer, and commit before seeing the explanation.'
              : unit.outcome}
          </p>
          {!inQuestion && <VentilationBreathSpine at={unit.spine} />}
        </header>
        <ol className={styles.steps} aria-label="Unit steps">
          {ventilationLearningSteps.map((phase, position) => (
            <li key={phase} aria-current={phase === step ? 'step' : undefined}>
              {position + 1}. {stepNames[phase]}
            </li>
          ))}
        </ol>
        {inQuestion && question ? (
          <section className={`${styles.card} ${styles.questionWidth}`}>
            <VentilationLearningQuestion
              key={`${step}:${question.id}`}
              question={question}
              answer={record.answers[question.id]}
              label={
                step === 'prepare'
                  ? 'Retrieve an earlier idea'
                  : step === 'check'
                    ? 'Decision 1 of 2'
                    : 'Decision 2 of 2'
              }
              onCommit={(answer) => commit(question, answer)}
              onContinue={continueQuestion}
              continueLabel={
                step === 'prepare'
                  ? focused
                    ? 'Continue to your decision'
                    : 'Build on this idea'
                  : step === 'check'
                    ? 'Try the transfer case'
                    : 'See your takeaways'
              }
            />
          </section>
        ) : null}
        {step === 'prepare' && !recall && (
          <section className={`${styles.card} ${styles.reading}`}>
            <p className={styles.eyebrow}>Why this matters</p>
            <h2>A patient needs help breathing. Where do you begin?</h2>
            <p>{unit.why}</p>
            <p className={styles.notice}>{unit.increment}</p>
            <p className={styles.muted}>
              You will explore a normal breath, follow a reasoned example, then make two decisions.
              Your choices are saved before feedback appears.
            </p>
            {focused && (
              <p className={styles.notice}>
                Your placement responses suggest you can begin with the decisions. The full
                explanation remains available.
              </p>
            )}
            <div className={styles.actions}>
              <button
                className={styles.primary}
                type="button"
                onClick={() => go(focused ? 'check' : 'learn')}
              >
                {focused ? 'Begin with a decision' : 'Explore the breath'}
                <ArrowRight size={16} />
              </button>
              {focused && (
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={() => {
                    setFullGuidance(true)
                    go('learn')
                  }}
                >
                  Show the full explanation
                </button>
              )}
            </div>
          </section>
        )}
        {step === 'learn' && (
          <>
            <section className={visual ? styles.lessonGrid : styles.reading}>
              <div className={styles.card}>
                <p className={styles.eyebrow}>One idea to add</p>
                <h2>{unit.shortTitle}</h2>
                <blockquote className={styles.analogy}>{unit.analogy}</blockquote>
                <p>{unit.explanation}</p>
                <ul className={styles.checklist}>
                  {unit.checklist.map((point) => (
                    <li key={point}>
                      <Check size={17} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              {visual}
            </section>
            <div className={styles.reading}>
              <p className={styles.notice}>{unit.boundary}</p>
              <VentilationLearningSources evidenceIds={unit.evidenceIds} />
              <div className={styles.footer}>
                <p className={styles.muted}>Next: follow the reasoning in a worked example.</p>
                <button className={styles.primary} type="button" onClick={() => go('example')}>
                  See a worked example <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
        {step === 'example' && (
          <>
            <section className={`${styles.card} ${styles.reading}`}>
              <p className={styles.eyebrow}>Worked example · reasoning shown · unscored</p>
              <h2>Walk through the decision.</h2>
              <p className={styles.example}>{unit.example.situation}</p>
              <ol className={styles.reasoning}>
                {unit.example.reasoning.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ol>
              <p>
                <strong>{unit.example.conclusion}</strong>
              </p>
              <VentilationDecisionTable unitId={unit.id} />
              <div className={styles.footer}>
                <button className={styles.textLink} type="button" onClick={() => go('learn')}>
                  Review the idea
                </button>
                <button className={styles.primary} type="button" onClick={() => go('check')}>
                  Now make a decision <ArrowRight size={16} />
                </button>
              </div>
            </section>
            <VentilationLearningExperiment unit={unit} />
          </>
        )}
        {step === 'recap' && (
          <section className={`${styles.card} ${styles.reading}`}>
            <p className={styles.eyebrow}>
              {record.completedAt ? 'Unit completed' : 'Take it forward'}
            </p>
            <h2>
              {record.completedAt ? 'Your next step is ready.' : 'What to carry to the bedside'}
            </h2>
            <p className={styles.muted}>
              {unitScore.correct} of {unitScore.total} decisions correct on first commitment.{' '}
              {unitScore.correct < unitScore.total
                ? 'The explanations are part of learning; missed concepts are added to your review.'
                : 'Use the same reasoning when the situation changes.'}
            </p>
            <ul className={styles.checklist}>
              {unit.checklist.map((point) => (
                <li key={point}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <p className={styles.notice}>{unit.boundary}</p>
            <VentilationDecisionTable unitId={unit.id} />
            <VentilationLearningSources evidenceIds={unit.evidenceIds} />
            {!record.completedAt ? (
              <div className={styles.footer}>
                <p className={styles.muted}>
                  Completion means you worked through the decisions and feedback. It does not
                  establish readiness for independent bedside practice.
                </p>
                <button
                  className={styles.primary}
                  type="button"
                  disabled={!unitReadyToComplete(unit.id, record)}
                  onClick={completeUnit}
                >
                  Complete this unit <Check size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className={styles.footer}>
                  <div>
                    <p className={styles.eyebrow}>Up next</p>
                    <p className={styles.muted}>
                      {next
                        ? next.increment
                        : 'Combine the course’s ideas in an independent mixed check.'}
                    </p>
                  </div>
                  <Link
                    className={styles.primary}
                    href={
                      (next
                        ? ventilationUnitHref(next.id)
                        : '/mechanical-ventilation/assess') as Route
                    }
                  >
                    Continue — {next?.shortTitle ?? 'Final check'}
                    <ArrowRight size={16} />
                  </Link>
                </div>
                <div className={styles.actions}>
                  <Link
                    className={styles.textLink}
                    href={`/mechanical-ventilation/practice?focus=${unit.id}` as Route}
                  >
                    Apply this in a matched case
                  </Link>
                  <button type="button" className={styles.textLink} onClick={() => go('learn')}>
                    Revisit the explanation
                  </button>
                </div>
              </>
            )}
          </section>
        )}
        {inQuestion && step !== 'prepare' && focused && (
          <p className={`${styles.muted} ${styles.questionWidth}`} style={{ marginTop: 16 }}>
            Focused guidance from your placement check.{' '}
            <button
              type="button"
              className={styles.textLink}
              onClick={() => {
                setFullGuidance(true)
                go('learn')
              }}
            >
              Review the explanation before continuing
            </button>
          </p>
        )}
        {!inQuestion && step !== 'recap' && (
          <div className={styles.reading}>
            <details className={styles.details}>
              <summary>Where this idea fits</summary>
              <p>{unit.increment}</p>
              <p>{unit.why}</p>
              {unit.prerequisites.length > 0 && (
                <p>
                  Builds on:{' '}
                  {unit.prerequisites.map((id, i) => (
                    <span key={id}>
                      {i > 0 ? ' · ' : ''}
                      <Link href={ventilationUnitHref(id) as Route}>
                        {ventilationUnitById.get(id)?.shortTitle}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </details>
          </div>
        )}
        <div className={styles.footer}>
          <Link href={'/mechanical-ventilation/learn' as Route} className={styles.textLink}>
            <ArrowLeft size={14} style={{ display: 'inline', marginRight: 5 }} />
            Back to learning path
          </Link>
          <span className={styles.muted}>
            <Clock3 size={13} style={{ display: 'inline', marginRight: 5 }} />
            {storageAvailable
              ? 'Your place and first choices save on this browser.'
              : 'Session-only progress.'}
          </span>
        </div>
      </div>
    </div>
  )
}
