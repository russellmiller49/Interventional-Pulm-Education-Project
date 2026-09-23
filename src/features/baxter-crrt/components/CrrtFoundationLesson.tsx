'use client'

import { Fragment, useEffect, useId, useReducer, useRef, useState, type Ref } from 'react'
import { LessonShell, NowCard } from '@/features/learning-module/stage'
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
import { CrrtGlossaryButton } from './CrrtGlossary'
import { CrrtSourceDating } from './CrrtSourceDating'
import { CrrtSourceRecord } from './CrrtSourceRecord'
import { crrtSourceDating } from '../content/sourceReviewMetadata'
import { crrtLearnerCitation } from '../sourcePresentation'
import { baxterCrrtLearnLessons, baxterCrrtLearnLessonById } from '../content/learnLessons'
import type { BaxterCrrtLearnLessonId } from '../content/learnerRegistry'
import { baxterCrrtLearnerFacingSourceById } from '../content/learnerSourceMap'
import type { CrrtPrescriptionComparison } from '../foundationModel'
import type { PressureLocalizationPrediction } from '../pressureLocalizationLabModel'
import { CRRT_FOUNDATION_CONSTRUCTION } from '../foundationModel'
import {
  createCrrtLearnAttempt,
  crrtCurrentTaskIdentity,
  crrtLearnAttemptReducer,
} from '../learnController'
import { sameCrrtLearnIdentity, type CrrtLearnEvidence } from '../learnEvidence'
import { recordCrrtVisit } from '../selfPacedProgress'
import { crrtLessonOutlineParts, selectCrrtLessonSequence } from '../learnSequence'
import { CrrtFoundationToolView, type CrrtToolProgress } from './CrrtFoundationTools'
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
  const [guidedResult, setGuidedResult] = useState<{
    identity: ReturnType<typeof crrtCurrentTaskIdentity>
    response: string
  } | null>(null)
  const [freeBuilderOpen, setFreeBuilderOpen] = useState(false)
  const [toolProgress, setToolProgress] = useState<{
    identity: ReturnType<typeof crrtCurrentTaskIdentity>
    progress: CrrtToolProgress
  } | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const restartScopeId = useId()
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
    return () => {
      active.current = false
    }
  }, [lessonId])
  const tasks = crrtLearnTasks[lessonId]!
  const task = tasks[attempt.taskIndex]
  const taskLocation = `${attempt.attemptId}:${task.id}:${attempt.finished}`
  const previousTaskLocation = useRef(taskLocation)
  const instructionRef = useRef<HTMLDivElement>(null)
  const taskMapSelection = useRef(false)
  useEffect(() => {
    if (previousTaskLocation.current === taskLocation && !taskMapSelection.current) return
    previousTaskLocation.current = taskLocation
    // Continue, skip and task-map navigation replace the document beneath the learner.
    // Target the instruction, excluding the persistent (possibly expanded) task map.
    // Initial entry and ordinary workbench operations do not scroll or move focus here.
    if (taskMapSelection.current) {
      taskMapSelection.current = false
      const heading = instructionRef.current?.querySelector('h2')
      if (heading) {
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      }
    }
    instructionRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
    // Also consume explicit re-selection of the current task after its reducer render.
  })
  // Keep the current instruction first, then its circuit/controls, then supporting prose.
  // Reading, assessment and operational tasks retain their authored presentation order.
  const circuitFirst =
    task.kind === 'guided' &&
    ['blood-walk', 'fluid-walk', 'modalities', 'pressure-sites', 'mechanisms'].includes(
      task.tool ?? '',
    )
  const teaching = task.teaching.length ? (
    <div className={styles.teaching}>
      {task.teaching.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  ) : null
  const operationReady = crrtOperationalTaskComplete(attempt.run, task.operation)
  const readyResponse =
    task.operation && task.operation !== 'hardware'
      ? operationReady
        ? `${task.operation}-observations-reviewed`
        : null
      : guidedResponse
  const lesson = baxterCrrtLearnLessonById.get(lessonId)!
  const evidence = attempt.evidence.find((e) => sameCrrtLearnIdentity(e, activeIdentity))
  useEffect(() => {
    recordCrrtVisit({ section: 'learn', id: lessonId, taskId: task.id })
  }, [lessonId, task.id])

  function continueTopic() {
    dispatch({ type: 'continue', identity: activeIdentity })
    setGuidedResult(null)
  }
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
  // One authored order everywhere (F-10): the picker, the numbers, previous/next and the
  // end-of-lesson Continue all read `BAXTER_CRRT_LEARN_LESSON_IDS` through this helper.
  const sequence = selectCrrtLessonSequence(lessonId)
  const previousLesson = sequence.previousLessonId
    ? baxterCrrtLearnLessonById.get(sequence.previousLessonId)
    : undefined
  const next = sequence.nextLessonId
    ? baxterCrrtLearnLessonById.get(sequence.nextLessonId)
    : undefined
  const currentToolProgress =
    toolProgress && sameCrrtLearnIdentity(toolProgress.identity, activeIdentity)
      ? toolProgress.progress
      : null
  const guidedPrimary = task.kind === 'guided' && task.tool !== 'known-pressure'
  const disabledReason = task.operation
    ? 'Complete the requested actions and read their recorded observations.'
    : currentToolProgress && currentToolProgress.remaining.length > 0
      ? `Still to select${currentToolProgress.ordered ? ', in order' : ''}: ${currentToolProgress.remaining.join(', ')}.`
      : currentToolProgress?.comparisonPending
        ? 'Select “Compare return-side resistance” to see the changed readings.'
        : 'Make each requested selection and compare the displayed explanation.'
  function reportToolProgress(progress: CrrtToolProgress) {
    setToolProgress((current) =>
      current &&
      sameCrrtLearnIdentity(current.identity, activeIdentity) &&
      current.progress.completed === progress.completed &&
      current.progress.comparisonPending === progress.comparisonPending
        ? current
        : { identity: activeIdentity, progress },
    )
  }
  function goToTaskControls() {
    const target = actionsRef.current
    if (!target) return
    // Focus moves now, so its destination must be visible now, including keyboard activation.
    // Explicit instant scrolling also avoids inheriting the site's smooth-scroll preference.
    target.scrollIntoView?.({ block: 'center', behavior: 'instant' })
    target.focus({ preventScroll: true })
  }
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
                <Link href={`${baxterCrrtNavBase}/assess`}>Challenge</Link>
              </nav>
              <p className={styles.lessonNumber} data-crrt-lesson-number>
                Lesson {sequence.number} of {sequence.total}
              </p>
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
                    {selectCrrtLessonSequence(item.id).number}. {item.title}
                  </option>
                ))}
              </select>
            </label>
            <nav className={styles.lessonSteps} aria-label="Previous and next lesson">
              {previousLesson ? (
                <button
                  type="button"
                  aria-label={`Previous lesson: ${sequence.number - 1}. ${previousLesson.title}`}
                  onClick={() => onNavigate(previousLesson.id)}
                >
                  ‹ Previous lesson
                </button>
              ) : (
                <span>First lesson</span>
              )}
              {next ? (
                <button
                  type="button"
                  aria-label={`Next lesson: ${sequence.number + 1}. ${next.title}`}
                  onClick={() => onNavigate(next.id)}
                >
                  Next lesson ›
                </button>
              ) : (
                <span>Last lesson</span>
              )}
            </nav>
            <div className={styles.lessonControls}>
              <button type="button" onClick={onRestart} aria-describedby={restartScopeId}>
                Restart lesson
              </button>
              <button type="button" onClick={() => router.push(baxterCrrtNavBase)}>
                Save & exit
              </button>
              <CrrtGlossaryButton />
              <p id={restartScopeId} className={styles.restartScope}>
                Restart lesson goes back to task 1 and clears this visit&apos;s answers and
                simulated runs. Visited topics stay saved on this device.
              </p>
            </div>
          </div>
        }
        contextStrip={
          <p className={styles.context}>
            Education only · synthetic examples · PrisMax AW8035 / 2.xx. Use current manufacturer
            instructions and local protocol for patient care. Topics visited and your location stay
            on this device. Each visit starts a fresh simulation; answers and controls are not
            saved. Historical records remain unchanged.
          </p>
        }
        footer={
          <p className={styles.footer}>
            Education only · exploring a topic does not establish device competence.{' '}
            <Link href={`${baxterCrrtNavBase}/practice`}>Practice</Link> ·{' '}
            <Link href={`${baxterCrrtNavBase}/assess`}>Challenge</Link>
          </p>
        }
      >
        <div className={styles.readingSurface}>
          <details className={styles.map}>
            <summary>
              Lesson tasks · {attempt.taskIndex + 1} of {tasks.length}
            </summary>
            {(crrtLessonOutlineParts[lessonId] ?? [{ title: null, taskIds: null }]).map((part) => (
              <Fragment key={part.title ?? 'all'}>
                {part.title ? <p className={styles.mapPart}>{part.title}</p> : null}
                <ol start={part.taskIds ? tasks.findIndex((t) => t.id === part.taskIds[0]) + 1 : 1}>
                  {tasks.map((item, index) =>
                    part.taskIds && !part.taskIds.includes(item.id) ? null : (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={index === attempt.taskIndex ? 'step' : undefined}
                          onClick={() => {
                            taskMapSelection.current = true
                            dispatch({ type: 'navigate', taskIndex: index })
                          }}
                        >
                          {item.title}
                          {attempt.completedTaskIds.includes(item.id) ? ' · reviewed' : ''}
                        </button>
                      </li>
                    ),
                  )}
                </ol>
              </Fragment>
            ))}
          </details>
          {attempt.finished ? (
            <div className={styles.instruction} id="crrt-current-task" ref={instructionRef}>
              <NowCard
                model={{
                  kicker: 'Continue learning',
                  heading: 'End of this lesson',
                  body: 'Continue, revisit a topic, or repeat an exercise. Only your location and topics visited are saved.',
                  primary: {
                    label: next
                      ? `Continue to lesson ${sequence.number + 1}: ${next.title}`
                      : 'Continue to practice',
                    onActivate: () =>
                      next ? onNavigate(next.id) : router.push(`${baxterCrrtNavBase}/practice`),
                  },
                  // Same operation as the header control, so the same words (F-25).
                  secondary: { label: 'Restart lesson', onActivate: onRestart },
                }}
              />
            </div>
          ) : (
            <div
              key={`${attempt.attemptId}:${task.id}`}
              className={styles.instruction}
              id="crrt-current-task"
              ref={instructionRef}
            >
              <NowCard
                model={{
                  kicker: `Task ${attempt.taskIndex + 1} of ${tasks.length} · ${task.kind === 'question' || task.kind === 'numeric' ? 'Apply · optional try' : task.kind === 'read' ? 'Worked explanation' : 'Guided exercise'}`,
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
                      {task.kind !== 'read' ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            className={styles.jumpButton}
                            onClick={goToTaskControls}
                          >
                            Go to this task&apos;s continue controls
                          </button>
                        </>
                      ) : null}
                    </span>
                  ),
                  // A reading task has one thing to do, so its Continue stays on the card. An
                  // exercise's controls follow the exercise itself (F-13), below.
                  primary:
                    task.kind === 'read'
                      ? { label: 'Continue', onActivate: continueTopic }
                      : undefined,
                }}
              >
                {!circuitFirst ? teaching : null}
                {task.tool && task.tool !== 'known-pressure' && task.tool !== 'builder' ? (
                  <CrrtFoundationToolView
                    tool={task.tool}
                    onReady={ready}
                    onProgress={reportToolProgress}
                  />
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
                    onRetry={() => dispatch({ type: 'retry', identity: activeIdentity })}
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
                    onRetry={() => dispatch({ type: 'retry', identity: activeIdentity })}
                    onSubmit={(response) => {
                      const choice = task.choices!.find((c) => c.id === response)!
                      acceptEvidence({
                        ...activeIdentity,
                        mode: 'independent',
                        response,
                        correct: choice.correct,
                        feedbackDisplayed: false,
                        reviewed: false,
                      })
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
                    onRetry={() => dispatch({ type: 'retry', identity: activeIdentity })}
                    initialSite="return-line"
                    lockedPlacement
                    onPredictionCommitted={(prediction) => {
                      acceptEvidence(pressureEvidence(prediction, false))
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
                    onRetry={() => dispatch({ type: 'retry', identity: activeIdentity })}
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
                {task.kind !== 'read' ? (
                  <CrrtTaskActions
                    ref={actionsRef}
                    primary={
                      guidedPrimary
                        ? {
                            label: 'Review observations and continue',
                            disabled: !readyResponse,
                            disabledReason,
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
                        : undefined
                    }
                    ownControlsNote={
                      guidedPrimary
                        ? null
                        : 'This exercise has its own check and continue buttons above. Using it is optional.'
                    }
                    onSkip={continueTopic}
                  />
                ) : null}
                {/* A circuit exercise's controls follow the drawing directly; its summary prose
                    follows them, so finishing the exercise does not mean scrolling past it. */}
                {circuitFirst ? teaching : null}
              </NowCard>
            </div>
          )}
          <details className={styles.sources}>
            <summary>Explanation, sources and limits</summary>
            <p>
              Draft teaching: no clinician or device specialist has reviewed this lesson yet. Reopen
              any reached task from Lesson tasks to review its explanation without resetting your
              work.
            </p>
            {lesson.sourceRecordIds.map((id) => {
              const source = baxterCrrtLearnerFacingSourceById.get(id)
              if (!source) return null
              const citation = crrtLearnerCitation(source)
              const dated = crrtSourceDating(id) !== undefined
              return (
                <Fragment key={id}>
                  <p>
                    <strong>{citation.title}</strong>
                    {citation.edition ? ` · ${citation.edition}` : ''}
                    {citation.locator ? ` · ${citation.locator}` : ''}
                    {dated ? null : (
                      <>
                        <br />
                        <small>
                          {citation.kind} · {citation.review}
                        </small>
                      </>
                    )}
                  </p>
                  <CrrtSourceDating sourceId={id} />
                  <CrrtSourceRecord citation={citation} />
                </Fragment>
              )
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
                a universal threshold. No clinician has reviewed this teaching yet.
              </p>
            ) : null}
            <p>
              <strong>Not calculated here: filtration fraction.</strong> The PrisMax manual&apos;s
              filtration-fraction display needs a pre-infusion flow, and its printed pre-infusion
              expression is ambiguous (held as source conflict CONFLICT-002, manual p220); its
              printed post-filter ultrafiltration expression carries a sign that conflicts with the
              filtration-fraction numerator beside it (CONFLICT-001, manual p218). The simulation
              uses neither and carries filtration fraction as a fixed model value, so it does not
              respond to the flows. Both conflicts await device review.
            </p>
            <p>
              <strong>Unresolved: makeup flow.</strong> The manual counts makeup in the effluent
              total but not in the patient-fluid-removed total, so where it belongs in the fluid
              ledger is unresolved (MATH-PM-001, FLUID-PM-002). Worked examples hold makeup at zero;
              whenever makeup has run, the simulation withholds cumulative machine removal and
              whole-patient balance rather than guess.
            </p>
            <p>
              Citrate dosing and operating sequences require the current reviewed local protocol and
              exact manufacturer instructions.
            </p>
            {lessonId === 'crrt-prescription-dosing' ? (
              <details onToggle={(event) => setFreeBuilderOpen(event.currentTarget.open)}>
                <summary>Free calculation reference</summary>
                {freeBuilderOpen ? <CrrtStagedPrescriptionBuilder /> : null}
              </details>
            ) : null}
          </details>
        </div>
      </LessonShell>
    </div>
  )
}

/**
 * The exercise's own controls, directly after the exercise (F-13).
 *
 * Before this, "Continue without this exercise" was the first full-width button in every task
 * and the real completion button sat about 1,200 px lower, greyed out with a generic reason.
 * Now the completion button leads, its disabled reason names exactly what is left, and the skip
 * stays beside it — secondary, full-size and keyboard-reachable. Skipping marks nothing as
 * reviewed; nothing here counts, grades or requires an answer.
 */
function CrrtTaskActions({
  ref,
  primary,
  ownControlsNote,
  onSkip,
}: {
  readonly ref: Ref<HTMLDivElement>
  readonly primary?: {
    readonly label: string
    readonly disabled: boolean
    readonly disabledReason: string
    readonly onActivate: () => void
  }
  readonly ownControlsNote: string | null
  readonly onSkip: () => void
}) {
  const reasonId = useId()
  const headingId = useId()
  return (
    <div
      ref={ref}
      className={styles.taskActions}
      role="group"
      aria-labelledby={headingId}
      tabIndex={-1}
      data-crrt-task-actions
    >
      <p id={headingId} className={styles.taskActionsHeading}>
        Continue from this task
      </p>
      {ownControlsNote ? <p className={styles.taskActionsNote}>{ownControlsNote}</p> : null}
      <div className={styles.taskActionRow}>
        {primary ? (
          <button
            type="button"
            className={styles.taskPrimary}
            disabled={primary.disabled}
            aria-describedby={primary.disabled ? reasonId : undefined}
            onClick={primary.onActivate}
          >
            {primary.label}
          </button>
        ) : null}
        <button type="button" className={styles.taskSkip} onClick={onSkip}>
          Continue without this exercise
        </button>
      </div>
      {primary?.disabled ? (
        <p id={reasonId} className={styles.taskReason} data-crrt-disabled-reason>
          {primary.disabledReason}
        </p>
      ) : null}
      <p className={styles.taskActionsNote}>
        Continuing without the exercise marks nothing as reviewed. You can come back to it from
        Lesson tasks.
      </p>
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
  onRetry,
}: {
  task: CrrtFoundationTask
  ready?: boolean
  evidence?: CrrtLearnEvidence
  onSubmit: (response: string) => void
  onFeedbackDisplayed: () => void
  onContinue: () => void
  onRetry: () => void
}) {
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [explanationVisible, setExplanationVisible] = useState(false)
  const choices = task.choices!
  const choice = choices.find((c) => c.id === evidence?.response)
  const accepted = choices.filter((c) => c.correct)
  const severalAccepted = accepted.length > 1
  useEffect(() => {
    if (choice && evidence && !evidence.feedbackDisplayed) onFeedbackDisplayed()
  }, [choice, evidence, onFeedbackDisplayed])
  return (
    <section className={styles.question} aria-label="Application check">
      <h3>Optional application check</h3>
      <p className={styles.questionMode}>
        Optional try: choose an answer and check it, or open the worked explanation first — it shows
        the accepted answer. Nothing here is saved or counted, and you can try again or continue
        without answering.
      </p>
      <fieldset disabled={Boolean(evidence)}>
        <legend>{task.question}</legend>
        {choices.map((option) => (
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
      {!choice ? (
        <button type="button" onClick={() => setExplanationVisible((visible) => !visible)}>
          {explanationVisible ? 'Hide worked explanation' : 'Show worked explanation'}
        </button>
      ) : null}
      {explanationVisible && !choice ? (
        <div className={styles.feedback} data-crrt-worked-explanation>
          <p>Worked explanation · no answer recorded.</p>
          <CrrtOptionComparison choices={choices} />
        </div>
      ) : null}
      {choice ? (
        <div
          role="status"
          className={styles.feedback}
          data-crrt-question-feedback={choice.correct ? 'accepted' : 'not-accepted'}
        >
          <h3>
            {choice.correct
              ? severalAccepted
                ? 'Your choice is one of the accepted answers'
                : 'Your choice matches the accepted answer'
              : 'Your choice is not the accepted answer'}
          </h3>
          <p>
            <strong>You chose:</strong> {choice.label}
          </p>
          <p>{choice.feedback}</p>
          {!choice.correct || severalAccepted ? (
            <div data-crrt-accepted-answers>
              <p>
                <strong>{severalAccepted ? 'Accepted answers' : 'Accepted answer'}</strong>
              </p>
              <ul>
                {accepted.map((option) => (
                  <li key={option.id}>
                    {option.label} — {option.feedback}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <details>
            <summary>How every option compares</summary>
            <CrrtOptionComparison choices={choices} />
          </details>
          <button type="button" onClick={onContinue}>
            Review feedback and continue
          </button>
          <button
            type="button"
            onClick={() => {
              onRetry()
              setChoiceId(null)
              setExplanationVisible(false)
            }}
          >
            Try again
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
      {!ready ? (
        <p>
          This run has no recorded observations for this question yet. Review the explanation,
          continue, or perform the preceding simulation actions.
        </p>
      ) : null}
    </section>
  )
}

/** Every option with its status in words — accepted or not — and its authored rationale. */
function CrrtOptionComparison({ choices }: { choices: CrrtFoundationTask['choices'] }) {
  return (
    <ul className={styles.optionComparison}>
      {(choices ?? []).map((option) => (
        <li key={option.id} data-accepted={option.correct}>
          <strong>{option.correct ? 'Accepted answer:' : 'Not accepted:'}</strong> {option.label}{' '}
          <span>{option.feedback}</span>
        </li>
      ))}
    </ul>
  )
}
