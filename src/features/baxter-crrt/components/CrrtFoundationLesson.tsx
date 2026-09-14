'use client'

import { Fragment, useEffect, useReducer, useRef, useState } from 'react'
import { LessonShell, NowCard } from '@/features/learning-module/stage'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { useCriticalCareActivityAnalytics } from '@/features/learning-module/activity'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link, useRouter } from '@/i18n/navigation'
import type { CrrtFoundationTask } from '../content/foundationLessons'
import { crrtLearnTasks } from '../content/learnTasks'
import {
  crrtOperationalTaskComplete,
  crrtOperationalEvidenceInputs,
  type CrrtOperationalAction,
} from '../operationalModel'
import { CrrtOperationalTool, CrrtRecordedBalanceQuestion } from './CrrtOperationalTools'
import { CrrtIntegrationTool } from './CrrtIntegrationTool'
import { CrrtCitrateDifferential } from './CrrtCitrateDifferential'
import { CrrtSourceDating } from './CrrtSourceDating'
import { baxterCrrtLearnLessons, baxterCrrtLearnLessonById } from '../content/learnLessons'
import type { BaxterCrrtLearnLessonId } from '../content/learnerRegistry'
import { baxterCrrtLearnerFacingSourceById } from '../content/learnerSourceMap'
import { recordCriticalCareActivitySelection } from '@/features/critical-care/progress/selection'
import type { CrrtPrescriptionComparison } from '../foundationModel'
import type { PressureLocalizationPrediction } from '../pressureLocalizationLabModel'
import { CRRT_FOUNDATION_CONSTRUCTION } from '../foundationModel'
import {
  createCrrtLearnAttempt,
  crrtCurrentTaskIdentity,
  crrtLearnAttemptReducer,
} from '../learnController'
import { sameCrrtLearnIdentity, type CrrtLearnEvidence } from '../learnEvidence'
import {
  readProgress,
  recordLearnTaskEvidence,
  recordLessonCompletion,
  writeProgress,
} from '../engine/progress'
import { CrrtFoundationToolView } from './CrrtFoundationTools'
import { CrrtPressureLocalizationLab } from './CrrtPressureLocalizationLab'
import { CrrtStagedPrescriptionBuilder } from './CrrtStagedPrescriptionBuilder'
import { createSyntheticPressureLocalizationResult } from '../pressureLocalizationLabModel'
import styles from './crrt-foundations.module.css'

export function CrrtFoundationLesson({
  lessonId,
  onNavigate,
  onRestart,
}: {
  lessonId: BaxterCrrtLearnLessonId
  onNavigate: (id: BaxterCrrtLearnLessonId) => void
  onRestart: () => void
}) {
  const router = useRouter()
  const [attempt, dispatch] = useReducer(crrtLearnAttemptReducer, undefined, () =>
    createCrrtLearnAttempt(
      lessonId,
      `learn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    ),
  )
  const [priorCompletion, setPriorCompletion] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [reviewIndex, setReviewIndex] = useState<number | null>(null)
  const [guidedResult, setGuidedResult] = useState<{
    identity: ReturnType<typeof crrtCurrentTaskIdentity>
    response: string
  } | null>(null)
  const [freeBuilderOpen, setFreeBuilderOpen] = useState(false)
  const activeIdentity = crrtCurrentTaskIdentity(attempt)
  const guidedResponse =
    guidedResult && sameCrrtLearnIdentity(guidedResult.identity, activeIdentity)
      ? guidedResult.response
      : null
  const active = useRef(true)
  const identityRef = useRef(activeIdentity)
  useEffect(() => {
    identityRef.current = activeIdentity
  })
  useEffect(() => {
    active.current = true
    const timer = window.setTimeout(() => {
      setPriorCompletion(readProgress().completedLessonIds.includes(lessonId))
      setHydrated(true)
      recordCriticalCareActivitySelection(window.localStorage, {
        activityId: `crrt:learn:${lessonId}`,
        mode: 'guided',
        query: { lesson: lessonId },
        payloadVersion: 'crrt-selection-v1',
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      active.current = false
    }
  }, [lessonId])
  const tasks = crrtLearnTasks[lessonId]!
  const task = tasks[attempt.taskIndex]
  const operationReady = crrtOperationalTaskComplete(attempt.run, task.operation)
  const readyResponse =
    task.operation && task.operation !== 'hardware'
      ? operationReady
        ? `${task.operation}-observations-reviewed`
        : null
      : guidedResponse
  const lesson = baxterCrrtLearnLessonById.get(lessonId)!
  const evidence = attempt.evidence.find((e) => sameCrrtLearnIdentity(e, activeIdentity))
  const analytics = useCriticalCareActivityAnalytics({
    moduleId: 'baxter-crrt',
    activityId: `crrt:learn:${lessonId}`,
    mode: 'guided',
    phase: attempt.finished
      ? 'transfer'
      : evidence?.feedbackDisplayed
        ? 'explain'
        : task.kind === 'question'
          ? 'predict'
          : 'recognize',
    enabled: hydrated,
  })

  function acceptEvidence(incoming: CrrtLearnEvidence) {
    if (!active.current || !sameCrrtLearnIdentity(identityRef.current, incoming)) return false
    if (!operationReady) return false
    if (attempt.run)
      incoming = {
        ...incoming,
        inputs: { ...crrtOperationalEvidenceInputs(attempt.run), ...incoming.inputs },
      }
    if (crrtLearnAttemptReducer(attempt, { type: 'evidence', evidence: incoming }) === attempt)
      return false
    if (
      evidence &&
      evidence.feedbackDisplayed === incoming.feedbackDisplayed &&
      evidence.reviewed === incoming.reviewed
    )
      return true
    dispatch({ type: 'evidence', evidence: incoming })
    writeProgress(recordLearnTaskEvidence(readProgress(), incoming))
    return true
  }
  function applyOperation(action: CrrtOperationalAction) {
    if (active.current && sameCrrtLearnIdentity(identityRef.current, activeIdentity))
      dispatch({ type: 'operation', identity: activeIdentity, action })
  }
  function finish(incoming?: CrrtLearnEvidence) {
    if (!active.current || !sameCrrtLearnIdentity(identityRef.current, activeIdentity)) return
    if (task.kind !== 'read' && (!incoming || !incoming.reviewed || !incoming.feedbackDisplayed))
      return
    const action = { type: 'complete' as const, identity: activeIdentity, evidence: incoming }
    if (crrtLearnAttemptReducer(attempt, action) === attempt) return
    if (incoming && !acceptEvidence(incoming)) return
    dispatch(action)
    setGuidedResult(null)
    if (attempt.taskIndex === tasks.length - 1) {
      writeProgress(recordLessonCompletion(readProgress(), lessonId))
      analytics.recordGoalMet()
      analytics.recordActivityCompleted()
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document
      .getElementById('crrt-current-task')
      ?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }
  const ready = (response: string) =>
    setGuidedResult((current) =>
      current?.response === response && sameCrrtLearnIdentity(current.identity, activeIdentity)
        ? current
        : { identity: activeIdentity, response },
    )
  function guidedEvidence(
    response: string,
    correct: boolean | null = null,
    inputs?: Readonly<Record<string, number>>,
  ): CrrtLearnEvidence {
    return {
      ...activeIdentity,
      mode: 'guided',
      response,
      correct,
      feedbackDisplayed: true,
      reviewed: true,
      ...(inputs ? { inputs } : {}),
    }
  }
  function comparisonEvidence(
    comparison: CrrtPrescriptionComparison,
    displayed: boolean,
    reviewed = false,
  ): CrrtLearnEvidence {
    return {
      ...guidedEvidence(comparison.response, comparison.correct, {
        weightKg: comparison.changed.simulatedWeightKg,
        dialysateMlHour: comparison.changed.dialysateMlPerHour,
        removalMlHour: comparison.changed.patientFluidRemovalMlPerHour,
        windowHours: comparison.changed.treatmentWindowHours,
        baselineDowntimeHours: comparison.baseline.downtimeHours,
        downtimeHours: comparison.changed.downtimeHours,
      }),
      feedbackDisplayed: displayed,
      reviewed,
    }
  }
  function pressureEvidence(
    prediction: PressureLocalizationPrediction,
    displayed: boolean,
    reviewed = false,
  ): CrrtLearnEvidence {
    const expected = createSyntheticPressureLocalizationResult('obstruction', 'return-line')
    return {
      ...guidedEvidence(
        expected.signals.map((s) => `${s.id}:${prediction[s.id]}`).join(','),
        expected.signals.every((s) => prediction[s.id] === s.direction),
      ),
      feedbackDisplayed: displayed,
      reviewed,
    }
  }
  const pathway = criticalCareLearningPathway('baxter-crrt')
  const next =
    pathway.sections[pathway.sections.findIndex((section) => section.id === lessonId) + 1]
  const displayedTask = reviewIndex === null ? task : tasks[reviewIndex]
  return (
    <div className={styles.foundation} data-foundation-lesson={lessonId}>
      <LessonShell
        module="baxter-crrt"
        section="learn"
        stage={attempt.finished ? 'complete' : task.id}
        label={lesson.title}
        header={
          <div className={styles.header}>
            <div>
              <nav aria-label="CRRT learning navigation">
                <Link href={baxterCrrtNavBase}>Overview</Link> ·{' '}
                <Link href={`${baxterCrrtNavBase}/learn`}>Learn</Link> ·{' '}
                <Link href={`${baxterCrrtNavBase}/practice`}>Practice</Link> ·{' '}
                <Link href={`${baxterCrrtNavBase}/assess`}>Assess</Link>
              </nav>
              <h1>{lesson.title}</h1>
            </div>
            <label>
              Lesson
              <select
                aria-label="CRRT lesson"
                value={lessonId}
                onChange={(e) => onNavigate(e.target.value as BaxterCrrtLearnLessonId)}
              >
                {baxterCrrtLearnLessons.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={onRestart}>
              Restart lesson
            </button>
            <button type="button" onClick={() => router.push(baxterCrrtNavBase)}>
              Save & exit
            </button>
          </div>
        }
        contextStrip={
          <p className={styles.context}>
            Education only · synthetic examples · PrisMax AW8035 / 2.xx. Use current manufacturer
            instructions and local protocol for patient care.{' '}
            {priorCompletion ? 'Prior completion retained. ' : ''}This visit starts a new exercise;
            saved responses remain in history, but in-progress controls are not restored.
          </p>
        }
        footer={
          <p className={styles.footer}>
            Education only · completion records worked-through exercises, not independent device
            competence. <Link href={`${baxterCrrtNavBase}/practice`}>Practice</Link> ·{' '}
            <Link href={`${baxterCrrtNavBase}/assess`}>Assess</Link>
          </p>
        }
      >
        <div className={styles.readingSurface} id="crrt-current-task" tabIndex={-1}>
          <details className={styles.map}>
            <summary>
              Lesson tasks · {attempt.completedTaskIds.length} of {tasks.length} worked through
            </summary>
            <ol>
              {tasks.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={index > attempt.taskIndex && !attempt.finished}
                    aria-current={
                      index === attempt.taskIndex && reviewIndex === null ? 'step' : undefined
                    }
                    onClick={() => setReviewIndex(index)}
                  >
                    {item.title}
                    {attempt.completedTaskIds.includes(item.id) ? ' · reviewed' : ''}
                  </button>
                </li>
              ))}
            </ol>
          </details>
          {reviewIndex !== null ? (
            <section className={styles.review}>
              <h2>Review · {displayedTask.title}</h2>
              {displayedTask.teaching.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {attempt.evidence
                .filter((e) => e.taskId === displayedTask.id)
                .map((e) => (
                  <p key={e.taskId}>
                    First response:{' '}
                    {displayedTask.choices?.find((c) => c.id === e.response)?.label ?? e.response}.{' '}
                    {displayedTask.choices?.find((c) => c.id === e.response)?.feedback} Feedback{' '}
                    {e.reviewed ? 'reviewed' : 'not yet reviewed'}.
                  </p>
                ))}
              <p>Reviewing does not rerun the exercise or change its recorded response.</p>
              <button type="button" onClick={() => setReviewIndex(null)}>
                Return to current task
              </button>
            </section>
          ) : attempt.finished ? (
            <NowCard
              model={{
                kicker: 'Lesson reviewed',
                heading: 'Current lesson work recorded',
                body: 'Your responses and reviewed feedback have been saved separately from prior completion history.',
                primary: {
                  label: next ? `Continue to ${next.title}` : 'Continue to practice',
                  onActivate: () =>
                    next
                      ? onNavigate(next.id as BaxterCrrtLearnLessonId)
                      : router.push(`${baxterCrrtNavBase}/practice`),
                },
                secondary: { label: 'Repeat with a new attempt', onActivate: onRestart },
              }}
            />
          ) : (
            <div key={`${attempt.attemptId}:${task.id}`}>
              <NowCard
                model={{
                  kicker: `Task ${attempt.taskIndex + 1} of ${tasks.length} · ${task.kind === 'question' || task.kind === 'numeric' ? 'Apply' : task.kind === 'read' ? 'Worked explanation' : 'Guided exercise'}`,
                  heading: task.title,
                  body: task.instruction,
                  where: (
                    <span>
                      Where to look:{' '}
                      {task.advancedTool
                        ? task.advancedTool === 'citrate-path'
                          ? 'Citrate path and sampling points'
                          : 'Four citrate patterns'
                        : task.operation === 'hardware'
                          ? 'Machine functions and fluid destinations'
                          : task.operation
                            ? 'Current run and recorded observations'
                            : task.tool === 'builder'
                              ? 'Staged Prescription Builder'
                              : task.tool === 'known-pressure'
                                ? 'Pressure Localization Lab'
                                : task.kind === 'question'
                                  ? 'Application check'
                                  : task.tool
                                    ? 'Canonical CRRT circuit'
                                    : task.title}
                      , below.
                    </span>
                  ),
                  primary:
                    task.kind === 'read'
                      ? { label: 'Continue', onActivate: () => finish() }
                      : task.kind === 'guided' && task.tool !== 'known-pressure'
                        ? {
                            label: 'Review observations and continue',
                            disabled: !readyResponse,
                            disabledReason: task.operation
                              ? 'Complete the requested actions and read their recorded observations.'
                              : 'Make each requested selection and compare the displayed explanation.',
                            onActivate: () =>
                              readyResponse &&
                              finish(
                                guidedEvidence(
                                  readyResponse,
                                  null,
                                  attempt.run
                                    ? crrtOperationalEvidenceInputs(attempt.run)
                                    : undefined,
                                ),
                              ),
                          }
                        : undefined,
                }}
              >
                {task.teaching.length ? (
                  <div className={styles.teaching}>
                    {task.teaching.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                ) : null}
                {task.tool && task.tool !== 'known-pressure' && task.tool !== 'builder' ? (
                  <CrrtFoundationToolView tool={task.tool} onReady={ready} />
                ) : null}
                {task.advancedTool ? (
                  <CrrtCitrateDifferential
                    presentation={task.advancedTool === 'citrate-path' ? 'mechanism' : 'comparison'}
                    onReviewed={ready}
                  />
                ) : null}
                {task.operation ? (
                  attempt.run?.id === 'integration' ? (
                    <CrrtIntegrationTool task={task} run={attempt.run} onAction={applyOperation} />
                  ) : (
                    <CrrtOperationalTool
                      task={task}
                      run={attempt.run}
                      onReady={ready}
                      onAction={applyOperation}
                    />
                  )
                ) : null}
                {task.kind === 'numeric' && attempt.run ? (
                  <CrrtRecordedBalanceQuestion
                    run={attempt.run}
                    evidence={evidence}
                    onSubmit={(response, correct, inputs) =>
                      acceptEvidence({
                        ...activeIdentity,
                        mode: 'independent',
                        response,
                        correct,
                        inputs,
                        feedbackDisplayed: false,
                        reviewed: false,
                      })
                    }
                    onFeedbackDisplayed={() =>
                      evidence && acceptEvidence({ ...evidence, feedbackDisplayed: true })
                    }
                    onContinue={() =>
                      evidence && finish({ ...evidence, feedbackDisplayed: true, reviewed: true })
                    }
                  />
                ) : null}
                {task.kind === 'question' ? (
                  <QuestionTask
                    task={task}
                    ready={operationReady}
                    evidence={evidence}
                    onSubmit={(response) => {
                      const choice = task.choices!.find((c) => c.id === response)!
                      if (
                        acceptEvidence({
                          ...activeIdentity,
                          mode: 'independent',
                          response,
                          correct: choice.correct,
                          feedbackDisplayed: false,
                          reviewed: false,
                        })
                      )
                        analytics.recordPredictionSubmitted()
                    }}
                    onFeedbackDisplayed={() =>
                      evidence && acceptEvidence({ ...evidence, feedbackDisplayed: true })
                    }
                    onContinue={() =>
                      evidence && finish({ ...evidence, feedbackDisplayed: true, reviewed: true })
                    }
                  />
                ) : null}
                {task.tool === 'known-pressure' ? (
                  <CrrtPressureLocalizationLab
                    initialSite="return-line"
                    lockedPlacement
                    onPredictionCommitted={(prediction) => {
                      acceptEvidence(pressureEvidence(prediction, false))
                      analytics.recordPredictionSubmitted()
                    }}
                    onFeedbackDisplayed={(prediction) =>
                      acceptEvidence(pressureEvidence(prediction, true))
                    }
                    onCompletionEvidence={(prediction) =>
                      finish(pressureEvidence(prediction, true, true))
                    }
                  />
                ) : null}
                {task.tool === 'builder' ? (
                  <CrrtStagedPrescriptionBuilder
                    guided
                    initialConstruction={CRRT_FOUNDATION_CONSTRUCTION}
                    onComparisonSubmitted={(comparison) =>
                      acceptEvidence(comparisonEvidence(comparison, false))
                    }
                    onComparisonFeedbackDisplayed={(comparison) =>
                      acceptEvidence(comparisonEvidence(comparison, true))
                    }
                    onCompletionEvidence={(comparison) =>
                      finish(comparisonEvidence(comparison, true, true))
                    }
                  />
                ) : null}
              </NowCard>
            </div>
          )}
          <details className={styles.sources}>
            <summary>Explanation, sources and limits</summary>
            <p>
              Clinical/device review remains pending. Reopen any reached task from Lesson tasks to
              review its explanation without resetting your work.
            </p>
            {lesson.sourceRecordIds.map((id) => {
              const source = baxterCrrtLearnerFacingSourceById.get(id)
              return source ? (
                <Fragment key={id}>
                  <p>
                    <strong>{source.sourceTitle}</strong> · {source.documentVersion} ·{' '}
                    {source.pageOrSection}
                  </p>
                  <CrrtSourceDating sourceId={id} />
                </Fragment>
              ) : null
            })}
            {lessonId === 'crrt-fluid-liberation' ? (
              <p>
                Clinical reassessment reference:{' '}
                <a
                  href="https://kdigo.org/wp-content/uploads/2019/01/KDIGO-2012-AKI-Guideline-English.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  KDIGO 2012 AKI guideline, chapter 5.2
                </a>
                . This supplies conceptual stopping/reassessment guidance, not a device procedure or
                a universal threshold. Clinical review of this teaching remains pending.
              </p>
            ) : null}
            <p>
              Printed filtration-fraction and blood-flow expressions remain withheld under
              CONFLICT-001 and CONFLICT-002. Nonzero makeup retains the unresolved attribution gate.
              Citrate dosing and operating sequences require the current reviewed local protocol and
              exact manufacturer instructions.
            </p>
            {lessonId === 'crrt-prescription-dosing' ? (
              <details onToggle={(event) => setFreeBuilderOpen(event.currentTarget.open)}>
                <summary>Separate free calculation reference · no lesson credit</summary>
                {freeBuilderOpen ? <CrrtStagedPrescriptionBuilder /> : null}
              </details>
            ) : null}
          </details>
        </div>
      </LessonShell>
    </div>
  )
}

function QuestionTask({
  task,
  evidence,
  ready = true,
  onSubmit,
  onFeedbackDisplayed,
  onContinue,
}: {
  task: CrrtFoundationTask
  ready?: boolean
  evidence?: CrrtLearnEvidence
  onSubmit: (response: string) => void
  onFeedbackDisplayed: () => void
  onContinue: () => void
}) {
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const choice = task.choices!.find((c) => c.id === evidence?.response)
  useEffect(() => {
    if (choice && evidence && !evidence.feedbackDisplayed) onFeedbackDisplayed()
  }, [choice, evidence, onFeedbackDisplayed])
  return (
    <section className={styles.question} aria-label="Application check">
      <h3>Application check</h3>
      <fieldset disabled={Boolean(evidence)}>
        <legend>{task.question}</legend>
        {task.choices!.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name={task.id}
              checked={(evidence?.response ?? choiceId) === option.id}
              onChange={() => setChoiceId(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      {choice ? (
        <div role="status" className={styles.feedback}>
          <h3>{choice.correct ? 'Supported interpretation' : 'Review the reasoning'}</h3>
          <p>{choice.feedback}</p>
          <p>
            Your first response is retained. Continue to the next example after reviewing this
            explanation.
          </p>
          <button type="button" onClick={onContinue}>
            Review feedback and continue
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!choiceId || !ready}
          onClick={() => choiceId && ready && onSubmit(choiceId)}
        >
          Check reasoning
        </button>
      )}
    </section>
  )
}
