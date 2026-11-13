'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { FlowContent, LessonShell, NowCard, SectionHeader } from '@/features/learning-module/stage'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import type { LearningPathway } from '@/features/learning-module/curriculum/types'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { useRouter } from '@/i18n/navigation'
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
import { baxterCrrtLearnLessonById } from '../content/learnLessons'
import {
  BAXTER_CRRT_LEARN_LESSON_IDS,
  type BaxterCrrtLearnLessonId,
} from '../content/learnerRegistry'
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
import {
  CrrtFoundationToolView,
  CrrtReferenceCircuit,
  type CrrtToolProgress,
} from './CrrtFoundationTools'
import { CrrtAccessSiteProvider } from './CrrtAccessSite'
import { CrrtLessonMenu } from './CrrtLessonMenu'
import {
  CrrtLessonVisual,
  CrrtLessonVisualProvider,
  useCrrtLessonVisualHost,
} from './CrrtLessonVisual'
import { CrrtPressureLocalizationLab } from './CrrtPressureLocalizationLab'
import { CrrtStagedPrescriptionBuilder } from './CrrtStagedPrescriptionBuilder'
import { createSyntheticPressureLocalizationResult } from '../pressureLocalizationLabModel'
import styles from './crrt-foundations.module.css'
import { CRRT_FILTRATION_FRACTION_CEILINGS } from '../content/filtrationFraction'

/**
 * The eight lessons in the shape the shared Lessons menu reads, in the one authored order (F-10).
 * The menu is the same numbered list the other guided modules and ECMO use (owner, 2026-11-04).
 */
const crrtLessonPathway: LearningPathway = {
  moduleId: 'baxter-crrt',
  arcSentence: '',
  sections: BAXTER_CRRT_LEARN_LESSON_IDS.map((id) => {
    const lesson = baxterCrrtLearnLessonById.get(id)!
    return {
      id,
      shortTitle: lesson.title,
      title: lesson.title,
      minutes: 0,
      description: lesson.summary,
      stage: 'foundation',
      activityId: id,
    }
  }),
}

/**
 * Whether the lesson is laid out as two panes right now.
 *
 * The stylesheet decides (a container query in rem on the task body, so it follows the reader's
 * text size) and publishes its answer as `--crrt-panes`; this reads that answer rather than
 * restating the condition, so the script and the stylesheet cannot disagree about where a
 * drawing belongs.
 */
function useCrrtTwoPanes(pane: HTMLElement | null): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!pane || typeof ResizeObserver === 'undefined') return () => {}
      // The pane's column is not rendered while the lesson is one column, so its box appearing
      // or going is the change to watch; the task body covers a resize within either layout.
      const observer = new ResizeObserver(onChange)
      for (const selector of ['[data-flow-visual]', '[data-crrt-activity]']) {
        const element = pane.closest(selector)
        if (element) observer.observe(element)
      }
      return () => observer.disconnect()
    },
    [pane],
  )
  return useSyncExternalStore(
    subscribe,
    () => (pane ? getComputedStyle(pane).getPropertyValue('--crrt-panes').trim() === 'two' : false),
    () => false,
  )
}

export function CrrtFoundationLesson({
  lessonId,
  onNavigate,
  onRestart,
  panes = 'auto',
}: {
  lessonId: BaxterCrrtLearnLessonId
  onNavigate: (id: BaxterCrrtLearnLessonId) => void
  onRestart: () => void
  /**
   * `auto` follows the window. `two` and `one` fix the layout, for a test that has no stylesheet
   * to ask.
   */
  panes?: 'auto' | 'one' | 'two'
}) {
  const router = useRouter()
  const [paneElement, setPaneElement] = useState<HTMLDivElement | null>(null)
  const measuredTwoPanes = useCrrtTwoPanes(paneElement)
  const twoPanes = panes === 'auto' ? measuredTwoPanes : panes === 'two'
  const visualHost = useCrrtLessonVisualHost(twoPanes ? paneElement : null)
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
    // Continue, Skip and task-map navigation replace the document beneath the learner, and the
    // button that was pressed goes with it. Focus the new task's heading so the keyboard lands
    // where reading starts, and target the instruction, excluding the persistent (possibly
    // expanded) task map. Initial entry and ordinary workbench operations do neither.
    taskMapSelection.current = false
    const heading = instructionRef.current?.querySelector('h2')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
    // In two panes each pane scrolls on its own and the page does not: both go back to the top,
    // so the new task and its picture are read from their first line. In one column the
    // instruction is brought to the top of whatever scrolls.
    const textPane = instructionRef.current?.closest<HTMLElement>('[data-flow-teaching]')
    const visualPane = paneElement?.closest<HTMLElement>('[data-flow-visual]')
    if (twoPanes && textPane && visualPane) {
      textPane.scrollTop = 0
      visualPane.scrollTop = 0
    } else instructionRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
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
  const taskMap = (
    <details className={styles.map} data-crrt-task-map>
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
  )
  const card = attempt.finished ? (
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
          // Same operation as the menu's control, so the same words (F-25).
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
          // The instruction says what to do and the exercise follows it directly, so there
          // is no separate "Where to look" line or jump button competing with the
          // exercise's own first control (tester report, 2026-11-05).
          body: task.instruction,
          // A reading task has one thing to do, so its Continue stays on the card. An
          // exercise's controls follow the exercise itself (F-13), below.
          primary:
            task.kind === 'read' ? { label: 'Continue', onActivate: continueTopic } : undefined,
          // The text pane scrolls under a long explanation; Continue stays at its foot.
          pinActions: task.kind === 'read',
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
        {/* A console, a run and its record, a lab or the builder is the task's picture as a
                    whole: in two panes it is the right pane, with its own controls beside what
                    they change. */}
        {task.advancedTool ? (
          <CrrtLessonVisual>
            <CrrtCitrateDifferential
              presentation={task.advancedTool === 'citrate-path' ? 'mechanism' : 'comparison'}
              onReviewed={ready}
            />
          </CrrtLessonVisual>
        ) : null}
        {task.operation && (task.operation === 'hardware' || attempt.run) ? (
          <CrrtLessonVisual>
            {attempt.run?.id === 'integration' ? (
              <CrrtIntegrationTool task={task} run={attempt.run} onAction={applyOperation} />
            ) : (
              <CrrtOperationalTool
                task={task}
                run={attempt.run}
                onReady={ready}
                onAction={applyOperation}
              />
            )}
          </CrrtLessonVisual>
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
            onSkip={continueTopic}
          />
        ) : null}
        {task.tool === 'known-pressure' ? (
          <CrrtLessonVisual>
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
          </CrrtLessonVisual>
        ) : null}
        {task.tool === 'builder' ? (
          <CrrtLessonVisual>
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
          </CrrtLessonVisual>
        ) : null}
        {/* A question carries its Skip in its own button row; every other exercise gets
                    one row here, directly after the exercise. Once the exercise offers its own
                    way on (an enabled continue, or feedback with its continue), Skip goes. */}
        {task.kind !== 'read' && task.kind !== 'question' ? (
          <CrrtTaskActions
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
                          attempt.run ? crrtOperationalEvidenceInputs(attempt.run) : undefined,
                        ),
                      ),
                  }
                : undefined
            }
            skippable={guidedPrimary ? !readyResponse : !evidence?.feedbackDisplayed}
            onSkip={continueTopic}
          />
        ) : null}
        {/* A circuit exercise's controls follow the drawing directly; its summary prose
                    follows them, so finishing the exercise does not mean scrolling past it. */}
        {circuitFirst ? teaching : null}
      </NowCard>
    </div>
  )
  const sources = (
    <details className={styles.sources}>
      <summary>Sources</summary>
      <p>
        Reopen any reached task from Lesson tasks to review its explanation without resetting your
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
                    {citation.kind}
                    {citation.review ? ` · ${citation.review}` : ''}
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
          .
        </p>
      ) : null}
      <p>
        <strong>Filtration fraction</strong> is worked out from the flows: fluid across the membrane
        divided by plasma flow plus pre-filter fluid. Moving replacement before the filter lowers
        it; so does a higher blood flow. {CRRT_FILTRATION_FRACTION_CEILINGS}
      </p>
      <p>
        <strong>One thing this simulator does not compute.</strong> When a makeup flow has run,
        cumulative machine removal and whole-patient balance are not shown.
      </p>
      {lessonId === 'crrt-prescription-dosing' ? (
        <details onToggle={(event) => setFreeBuilderOpen(event.currentTarget.open)}>
          <summary>Free calculation reference</summary>
          {freeBuilderOpen ? <CrrtStagedPrescriptionBuilder /> : null}
        </details>
      ) : null}
    </details>
  )
  const lessonNumber = `Lesson ${sequence.number} of ${sequence.total}`
  return (
    <div
      className={styles.foundation}
      data-foundation-lesson={lessonId}
      data-crrt-panes={twoPanes ? 'two' : 'one'}
    >
      <LessonShell
        module="baxter-crrt"
        section="learn"
        stage={attempt.finished ? 'complete' : task.id}
        label={lesson.title}
        header={
          <SectionHeader
            breadcrumb={{ href: baxterCrrtNavBase, label: 'CRRT' }}
            kicker={lessonNumber}
            title={lesson.title}
            sectionsControl={
              <SectionsDrawer
                pathway={crrtLessonPathway}
                activeSectionId={lessonId}
                position={`${sequence.number} of ${sequence.total}`}
                label="CRRT lessons"
                unit="Lesson"
                onSelect={(id) => onNavigate(id as BaxterCrrtLearnLessonId)}
              />
            }
            options={
              <>
                <CrrtGlossaryButton />
                <CrrtLessonMenu
                  number={sequence.number}
                  previous={previousLesson}
                  next={next}
                  onPrevious={() => previousLesson && onNavigate(previousLesson.id)}
                  onNext={() => next && onNavigate(next.id)}
                  onRestart={onRestart}
                  onRestartCourse={() =>
                    sequence.number === 1
                      ? onRestart()
                      : onNavigate(BAXTER_CRRT_LEARN_LESSON_IDS[0])
                  }
                />
              </>
            }
            onSaveAndExit={() => router.push(baxterCrrtNavBase)}
          />
        }
      >
        <div className={styles.activity} data-crrt-activity>
          <CrrtAccessSiteProvider>
            <CrrtLessonVisualProvider value={visualHost.value}>
              <FlowContent
                kind={attempt.finished ? 'complete' : task.kind}
                teaching={
                  <>
                    {card}
                    {taskMap}
                    {sources}
                  </>
                }
                visual={
                  <div className={styles.visualPane} data-crrt-visual-pane>
                    {/* The task's own picture is drawn into this element (`CrrtLessonVisual`). */}
                    <div ref={setPaneElement} className={styles.visualSlot} data-crrt-visual-slot />
                    {/* A task that brings no picture keeps the circuit the lesson is about. */}
                    {visualHost.ownVisuals === 0 ? (
                      <div data-crrt-lesson-visual="reference">
                        <CrrtReferenceCircuit />
                      </div>
                    ) : null}
                  </div>
                }
              />
            </CrrtLessonVisualProvider>
          </CrrtAccessSiteProvider>
        </div>
      </LessonShell>
    </div>
  )
}

/**
 * The one way past an exercise without doing it (tester report, 2026-11-05).
 *
 * It replaces a pair — "Go to this task's continue controls" under the instruction and "Continue
 * without this exercise" in a box after the exercise — that read as two competing first steps.
 * Skip sits in the exercise's own action row, moves to the next task, and marks nothing as
 * reviewed; the task stays open from Lesson tasks.
 */
function SkipButton({ onSkip }: { readonly onSkip: () => void }) {
  return (
    <button
      type="button"
      className={styles.taskSkip}
      aria-label="Skip this task"
      onClick={onSkip}
      data-crrt-skip
    >
      Skip
    </button>
  )
}

/**
 * The exercise's own controls, directly after the exercise (F-13).
 *
 * The completion button leads and its disabled reason names exactly what is left. Skip stands
 * beside it until the completion button is available, then leaves, so the row never offers two
 * ways forward at once. An exercise with its own check and continue (a lab, the builder, a
 * calculation) gets only the Skip here, and only until its own continue appears.
 */
function CrrtTaskActions({
  primary,
  skippable,
  onSkip,
}: {
  readonly primary?: {
    readonly label: string
    readonly disabled: boolean
    readonly disabledReason: string
    readonly onActivate: () => void
  }
  readonly skippable: boolean
  readonly onSkip: () => void
}) {
  const reasonId = useId()
  if (!primary && !skippable) return null
  return (
    <div
      className={styles.taskActions}
      role="group"
      aria-label="Task actions"
      data-crrt-task-actions
    >
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
        {skippable ? <SkipButton onSkip={onSkip} /> : null}
      </div>
      {primary?.disabled ? (
        <p id={reasonId} className={styles.taskReason} data-crrt-disabled-reason>
          {primary.disabledReason}
        </p>
      ) : null}
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
  onSkip,
}: {
  task: CrrtFoundationTask
  ready?: boolean
  evidence?: CrrtLearnEvidence
  onSubmit: (response: string) => void
  onFeedbackDisplayed: () => void
  onContinue: () => void
  onRetry: () => void
  onSkip: () => void
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
        the accepted answer. Nothing here is saved or counted, and you can try again or skip.
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
        <>
          <button
            type="button"
            disabled={!choiceId || !ready}
            onClick={() => choiceId && ready && onSubmit(choiceId)}
          >
            Check reasoning
          </button>
          <SkipButton onSkip={onSkip} />
        </>
      )}
      {!ready ? (
        <p>
          This run has no recorded observations for this question yet. Review the explanation, skip,
          or perform the preceding simulation actions.
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
