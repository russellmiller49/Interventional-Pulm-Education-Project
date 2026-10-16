'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from 'react'
import { ArrowRight, LocateFixed } from 'lucide-react'

import { FlowContent } from '@/features/learning-module/stage/FlowContent'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { LessonShell } from '@/features/learning-module/stage/LessonShell'
import {
  NowCard,
  type NowCardAction,
  type NowCardModel,
} from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { Link, useRouter } from '@/i18n/navigation'

import type { BreathStopId } from '../../content/breathSpine'
import { ventilationCasePresentationTitle } from '../../content/casePresentation'
import {
  markedIntervalLook,
  inspectionFigureState,
  nowCardStatusLine,
  remainingIntervalSeconds,
  ventilationExperimentStatus,
  type ExperimentGoalState,
} from '../../content/experimentStatus'
import { isFoundationUnit } from '../../content/foundations'
import { resolveGuidedConsoleTasks } from '../../content/guidedConsoleTask'
import { ventilationLearningUnits } from '../../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../../content/learningExperiments'
import {
  ventilationPartSetupLine,
  ventilationRoundRelationLine,
  ventilationSectionLabel,
  ventilationSectionTimeLine,
} from '../../content/learnerMap'
import { ventilationReferenceMarker } from '../../content/referenceEvidence'
import {
  resolvePresentedStepIndex,
  roundManeuver,
  roundQuestionKind,
  ventilationPresentedStepIndexes,
  ventilationStageLesson,
  type VentilationStageStep,
} from '../../content/stageLessons'
import { ventilationStageSources } from '../../content/stageSources'
import { ventilationStepPerformed } from '../../content/stepCompletion'
import { labGoalMet } from '../../engine/learningLab'
import { observationFor } from '../../engine/learningObservation'
import type { VentilatorDeviceId } from '../../engine/types'
import { BreathMap, breathMapCaption } from '../breath-map/BreathMap'
import { MechanicalVentilationModuleFrame } from '../MechanicalVentilationModuleFrame'
import type { ConsolePendingSetting } from '../MechanicalVentilatorConsole'
import { VentilationReinforcement } from '../VentilationReinforcement'
import { useVentilationSelfPacedProgress } from '../useVentilationSelfPacedProgress'
import { CapturedResult } from './RecordedBreathComparison'
import {
  cancelTaskHeadingReveal,
  consumeTaskHeadingReveal,
  requestTaskHeadingReveal,
  revealTaskHeading,
} from './revealTaskHeading'
import { VentilationConsoleSurface } from './VentilationConsoleSurface'
import { VentilationPeepComparison } from './VentilationPeepComparison'
import { VentilationSourceList } from './VentilationSourceList'
import { VENTILATION_SOURCES_ID, VentilationTeachingColumn } from './VentilationTeachingColumn'
import {
  readDevicePreference,
  saveDevicePreference,
  useVentilationLabSession,
} from './useVentilationLabSession'
import styles from './task-flow.module.css'

const stepRound = (step: VentilationStageStep): 0 | 1 =>
  'round' in step.interaction ? step.interaction.round : 0

const GOAL_STATE_WORD: Record<ExperimentGoalState, string> = {
  done: 'Done',
  'in-progress': 'In progress',
  'to-do': 'To do',
  repeat: 'Repeat',
}
const GOAL_STATE_MARK: Record<ExperimentGoalState, string> = {
  done: '✓',
  'in-progress': '…',
  'to-do': '○',
  repeat: '↻',
}
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const ventilationPathway = criticalCareLearningPathway('mechanical-ventilation')

/*
 * The fixed desktop workspace: the same viewport the shared activity frame and the site's scroll
 * lock use (`globals.css`, `mechanical-ventilation-module.module.css`). Inside it the section is two
 * panes that scroll on their own — the task and its reading on the left, the console on the right —
 * and the page itself does not scroll. Below it the section flows in the document.
 */
const WORKSPACE_QUERY = '(min-width: 1024px) and (min-height: 700px)'
function subscribeToWorkspace(onChange: () => void) {
  const media = window.matchMedia?.(WORKSPACE_QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}
function useWorkspaceLayout(): boolean {
  return useSyncExternalStore(
    subscribeToWorkspace,
    () => window.matchMedia?.(WORKSPACE_QUERY).matches ?? false,
    () => false,
  )
}

/** One section of the Learn pathway, on the shared flowing stage (the ECMO format). */
export function VentilationStageHost({
  unitId,
  locale = 'en',
}: {
  readonly unitId: string
  readonly locale?: string
}) {
  const progress = useVentilationSelfPacedProgress()
  if (!progress.ready) return <p role="status">Opening the section…</p>
  return (
    <VentilationStageSession
      key={unitId}
      unitId={unitId}
      locale={locale}
      initialStep={progress.progress.location?.id === unitId ? progress.progress.location.step : 0}
      visit={progress.visit}
      storageAvailable={progress.storageAvailable}
    />
  )
}

function VentilationStageSession({
  unitId,
  locale,
  initialStep,
  visit,
  storageAvailable,
}: {
  unitId: string
  locale: string
  initialStep: number
  visit: ReturnType<typeof useVentilationSelfPacedProgress>['visit']
  storageAvailable: boolean
}) {
  const router = useRouter()
  const lesson = useMemo(() => ventilationStageLesson(unitId), [unitId])
  /*
   * `index` is the step's position in the lesson, which is what the saved reading location holds.
   * The learner is shown the presented steps only (N6). A saved position past the end of a lesson
   * that has since been reorganised reopens the section at its first task, and says so.
   */
  const presented = useMemo(() => ventilationPresentedStepIndexes(lesson), [lesson])
  // Read once, at mount: the first visit rewrites the stored position to the task now shown.
  const [reorganised] = useState(() => initialStep >= lesson.steps.length)
  const [index, setIndex] = useState(() => resolvePresentedStepIndex(lesson, initialStep))
  const position = Math.max(0, presented.indexOf(index))
  const previousIndex = position > 0 ? presented[position - 1] : null
  const nextIndex = position < presented.length - 1 ? presented[position + 1] : null
  const [device] = useState<VentilatorDeviceId>(readDevicePreference)
  const workspace = useWorkspaceLayout()
  const { session, engine, lab } = useVentilationLabSession({
    unitId,
    device,
    round: stepRound(lesson.steps[index]),
  })
  const step = lesson.steps[index]
  const interaction = step.interaction
  const presentation = step.presentation
  const experiment = ventilationExperimentByUnit.get(unitId)!
  const round = experiment.rounds[session.round]
  const evidence = session.evidence[session.round]
  const sources = ventilationStageSources(unitId, session.device)
  const nextUnit = ventilationLearningUnits[lesson.index + 1]
  const peepLesson = unitId === 'oxygenation-response'
  const [restartCount, setRestartCount] = useState(0)
  const [walkStop, setWalkStop] = useState<BreathStopId>('trigger')
  const [entry, setEntry] = useState<{ stepId: string; at: number }>({ stepId: step.id, at: 0 })
  const [pending, setPending] = useState<ConsolePendingSetting | null>(null)
  const [help, setHelp] = useState<{ stepId: string; controlId: string; count: number } | null>(
    null,
  )
  const [helpOpen, setHelpOpen] = useState(false)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  /*
   * Set only by the explicit navigation handlers below — Continue, Back, the task list and
   * Restart — and consumed by the next committed step. A tick, Run/Pause, a capture, a control
   * change or a disclosure never sets it, so none of them moves focus or the page (N4). "Show me
   * where" is the one other explicit focus mover, and it moves focus to the control it names.
   */
  const revealRequested = useRef(false)
  useEffect(() => {
    visit({ section: 'learn', id: unitId, step: index })
  }, [index, unitId, visit])
  useLayoutEffect(() => {
    if (!revealRequested.current) return
    revealRequested.current = false
    if (!headingRef.current) return
    revealTaskHeading(headingRef.current)
    // In the desktop workspace the console pane scrolls on its own; a new task starts at its top.
    const visualPane = headingRef.current
      .closest('[data-flow-content]')
      ?.querySelector<HTMLElement>(':scope > [data-flow-visual]')
    if (visualPane) visualPane.scrollTop = 0
  }, [index, restartCount])
  useLayoutEffect(() => {
    if (consumeTaskHeadingReveal(unitId) && headingRef.current)
      revealTaskHeading(headingRef.current, 'if-needed')
  }, [unitId])

  /*
   * Explicit same-tab navigation to another section. The request names its destination, and the
   * navigation runs as a transition so this component can tell when it settles: arriving unmounts
   * this section, so if the transition ends and this section is still here, the navigation did not
   * happen and its request is withdrawn rather than left for a later arrival.
   */
  const [sectionPending, startSectionNavigation] = useTransition()
  const requestedSection = useRef<string | null>(null)
  const navigateToSection = useCallback(
    (sectionId: string) => {
      requestedSection.current = sectionId
      requestTaskHeadingReveal(sectionId)
      startSectionNavigation(() => {
        router.push({ pathname: '/mechanical-ventilation/learn', query: { activity: sectionId } })
      })
    },
    [router],
  )
  useEffect(() => {
    if (sectionPending || requestedSection.current === null) return
    cancelTaskHeadingReveal(requestedSection.current)
    requestedSection.current = null
  }, [sectionPending])

  function goToStep(next: number) {
    const target = Math.max(0, Math.min(next, lesson.steps.length - 1))
    const targetStep = lesson.steps[target]
    const targetRound = stepRound(targetStep)
    lab({ type: 'OPEN_ROUND', round: targetRound })
    if (targetStep.interaction.kind === 'simulator-task') lab({ type: 'START_EXPERIMENT' })
    if (targetStep.interaction.kind === 'advance-breath')
      engine({ type: 'SET_PAUSED', paused: true })
    // A question about a marked interval is asked on that breath, held still on the console.
    if (
      targetStep.interaction.kind === 'prediction' &&
      ventilationReferenceMarker(unitId, targetRound)
    )
      engine({ type: 'SET_PAUSED', paused: true })
    setEntry({
      stepId: targetStep.id,
      at: targetRound === session.round ? session.simulation.simulationTime : 0,
    })
    setIndex(target)
    setHelp(null)
  }
  /** Explicit step navigation: change the step, then bring its card into view and focus it. */
  function navigateToStep(next: number) {
    const target = Math.max(0, Math.min(next, lesson.steps.length - 1))
    if (target === index) return
    revealRequested.current = true
    goToStep(target)
  }
  function restart() {
    revealRequested.current = true
    setRestartCount((count) => count + 1)
    lab({ type: 'RESTART' })
    engine({ type: 'SET_PAUSED', paused: true })
    setIndex(presented[0])
    setEntry({ stepId: lesson.steps[presented[0]].id, at: 0 })
    setHelp(null)
  }

  /* --------------------------------------------------------------------------------------------
   * The step's state, from the lab
   * ------------------------------------------------------------------------------------------ */

  const simulatorTask = interaction.kind === 'simulator-task' || interaction.kind === 'observe'
  const status = ventilationExperimentStatus(session)
  const captured = Boolean(evidence.response)
  const goalsMet =
    session.phase === 'experiment' && round.goals.every((goal) => labGoalMet(goal, session))
  const performed = ventilationStepPerformed(step, session, {
    enteredAtSeconds: entry.stepId === step.id ? entry.at : 0,
  })
  const guidedTasks = useMemo(
    () =>
      simulatorTask && !captured
        ? resolveGuidedConsoleTasks(round.goals, session, pending)
        : interaction.kind === 'advance-breath' && !performed
          ? null
          : [],
    [simulatorTask, captured, round.goals, session, pending, interaction.kind, performed],
  )
  const nextGuided = guidedTasks?.find((task) => !task.satisfied) ?? null
  const readingTask = roundManeuver(round) === 'pause'
  const whereControlId =
    interaction.kind === 'advance-breath' && !performed
      ? 'mv-clock-one-breath'
      : (nextGuided?.controlId ?? null)
  const guidedControlId = help?.stepId === step.id ? whereControlId : null
  const helpCount = help?.stepId === step.id ? help.count : 0
  useEffect(() => {
    if (helpCount === 0 || !help) return
    const timer = window.setTimeout(() => {
      const control = document.getElementById(help.controlId)
      if (!control) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      control.focus({ preventScroll: true })
      control.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
    }, 0)
    return () => window.clearTimeout(timer)
    // Only an explicit request moves focus; the control it names is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpCount])
  function showWhere() {
    if (!whereControlId) return
    setHelp((current) => ({
      stepId: step.id,
      controlId: whereControlId,
      count: current?.stepId === step.id ? current.count + 1 : 1,
    }))
  }

  /*
   * Section 1 opens with the console running beside why a ventilator exists: the first thing a
   * learner sees is breaths being delivered. Run and Pause are transient, so this records nothing.
   */
  const orientationRuns = unitId === 'breathing-with-support' && step.ordinal === 1
  useEffect(() => {
    if (orientationRuns) engine({ type: 'SET_PAUSED', paused: false })
  }, [orientationRuns, restartCount, engine])

  /*
   * A simulator task is always worked on its part's experiment: arriving on one — by Continue, the
   * task list, a resumed reading location or after a reset before any prediction — opens it from
   * its baseline. Nothing else starts an experiment.
   */
  useEffect(() => {
    if (simulatorTask && session.phase === 'explore') lab({ type: 'START_EXPERIMENT' })
  }, [simulatorTask, session.phase, lab])

  /*
   * A live run that reaches the capture gate captures, by default. It never captures a comparison
   * that no longer isolates one change: that one waits for the learner's own click, or a reset.
   * It is an effect of the session changing, so it fires only as model time actually advances.
   */
  const confounds = session.confounds ?? []
  const autoCaptureHeld = simulatorTask && status.canCapture && !captured && confounds.length > 0
  useEffect(() => {
    if (simulatorTask && status.canCapture && !captured && confounds.length === 0)
      lab({ type: 'COMPARE' })
  }, [simulatorTask, status.canCapture, captured, confounds.length, lab])

  /* --------------------------------------------------------------------------------------------
   * What the card says
   * ------------------------------------------------------------------------------------------ */

  const marker = ventilationReferenceMarker(unitId, session.round)
  const inspectionFigure = simulatorTask ? inspectionFigureState(session) : null
  const lookLine =
    marker && inspectionFigure
      ? markedIntervalLook(marker.markerId, inspectionFigure)
      : (step.guide?.look ?? round.look)
  const question =
    interaction.kind === 'prediction' || interaction.kind === 'locate' ? interaction.item : null
  const questionKind = roundQuestionKind(round)
  const questionPurpose =
    interaction.kind === 'locate'
      ? 'Locate the timing relationship on the breath.'
      : marker
        ? `Read interval ${marker.markerId} on the frozen breath on the console, then check your reading against its samples.`
        : roundManeuver(round) === 'pause'
          ? 'Read the frozen traces at one instant, then compare your reading with the captured samples.'
          : questionKind === 'identify'
            ? 'Identify the reading or control that answers this, then check it on a real run.'
            : questionKind === 'reflect'
              ? 'Think through what would guide the next step. There is no reading to predict here; the experiment afterwards shows what the action changes.'
              : questionKind === 'interpret'
                ? roundManeuver(round) === 'hold'
                  ? 'Interpret the measurement this maneuver produces, then compare it with the measurement status.'
                  : 'Interpret what these readings would mean together, then compare with a real run.'
                : 'Predict the response to one change, then compare it with a real run.'
  const relationLine = ventilationRoundRelationLine(round)
  const firstOfPart =
    !peepLesson &&
    presented.find((candidate) => stepRound(lesson.steps[candidate]) === stepRound(step)) === index
  const startsOtherPart =
    nextIndex !== null && stepRound(lesson.steps[nextIndex]) !== stepRound(step)
  const observation = captured ? observationFor(session) : null
  const lastStep = nextIndex === null

  const body = simulatorTask
    ? round.task
    : question
      ? peepLesson
        ? step.instruction
        : round.introduction
      : step.instruction

  const continueToNext: NowCardAction | undefined =
    nextIndex !== null
      ? { label: 'Continue', onActivate: () => navigateToStep(nextIndex) }
      : nextUnit
        ? {
            label: `Continue to ${ventilationSectionLabel(nextUnit.id)}`,
            icon: <ArrowRight aria-hidden="true" />,
            onActivate: () => navigateToSection(nextUnit.id),
          }
        : {
            label: 'Continue to Applications',
            icon: <ArrowRight aria-hidden="true" />,
            onActivate: () => router.push('/mechanical-ventilation/assess'),
          }
  const showMeWhere: NowCardAction | undefined = whereControlId
    ? {
        label: 'Show me where',
        icon: <LocateFixed aria-hidden="true" />,
        onActivate: showWhere,
      }
    : undefined

  const remaining = remainingIntervalSeconds(status)
  const runAndCapture: NowCardAction = {
    label: remaining > 0 ? `Run ${Math.ceil(remaining)} s and capture` : 'Capture result',
    onActivate: () => lab(remaining > 0 ? { type: 'RUN_AND_CAPTURE' } : { type: 'COMPARE' }),
  }

  /*
   * One line of state, said once. While a goal is still to be done the guided instruction above it
   * is the next move, so the status line is left out; it speaks for the clock, the interval and the
   * capture once everything requested is in place.
   */
  const statusLine = simulatorTask
    ? nextGuided
      ? undefined
      : nowCardStatusLine(
          status,
          pending
            ? { label: pending.label, displayValue: pending.displayValue, unit: pending.unit }
            : null,
        )
    : interaction.kind === 'advance-breath' && performed
      ? 'A new breath has gone by on the console.'
      : undefined

  const nowModel: NowCardModel = {
    kicker: `Task ${position + 1} of ${presented.length}${peepLesson ? '' : ` · Part ${session.round + 1} of 2`}`,
    heading: step.title,
    body,
    pinActions: true,
    back:
      previousIndex !== null
        ? { label: 'Back', onActivate: () => navigateToStep(previousIndex) }
        : undefined,
    why: step.rationale,
    status: statusLine,
    ...(simulatorTask
      ? captured
        ? { primary: continueToNext }
        : goalsMet || autoCaptureHeld
          ? { primary: runAndCapture, secondary: showMeWhere }
          : { secondary: showMeWhere }
      : interaction.kind === 'advance-breath'
        ? performed
          ? { primary: continueToNext }
          : { secondary: showMeWhere }
        : { primary: continueToNext }),
  }

  // A single goal is the card's own heading; the checklist earns its place from two goals up.
  const goalList =
    simulatorTask && status.goals.length > 1 ? (
      <ol className={styles.goalList} aria-label="What this task needs" data-step-goals>
        {status.goals.map((goal, goalIndex) => (
          <li key={goalIndex} data-goal-state={goal.state}>
            <span aria-hidden="true" className={styles.goalMark}>
              {GOAL_STATE_MARK[goal.state]}
            </span>
            <span>
              <span className={styles.srOnly}>{GOAL_STATE_WORD[goal.state]}: </span>
              {capitalize(goal.label)}
              {goal.note ? <small> — {goal.note}</small> : null}
            </span>
          </li>
        ))}
      </ol>
    ) : null

  const partNotes = (
    <>
      {firstOfPart ? (
        <p className={styles.note} data-part-setup>
          {ventilationPartSetupLine(unitId, session.round)}
        </p>
      ) : null}
      {firstOfPart && relationLine ? (
        <p className={styles.note} data-part-relation={round.relation?.kind}>
          {relationLine}
        </p>
      ) : null}
    </>
  )

  const explanation =
    interaction.kind === 'explain' || interaction.kind === 'interpret' ? (
      <section className={styles.cardSection} data-experiment-explanation>
        <h3>{round.title}</h3>
        <p>{round.explanation}</p>
        {evidence.baseline && evidence.response ? (
          <>
            <CapturedResult round={round} evidence={evidence} effort={presentation.effort} />
            {observation && isFoundationUnit(unitId) ? (
              <VentilationReinforcement
                key={step.id + '-observation'}
                id={step.id + '-observation'}
                purpose="Read the captured response on its own, separately from the prediction."
                prompt={observation.prompt}
                choices={observation.choices}
                explanation={observation.feedback}
                hint="Read the baseline and the response, including whether the measurement is valid."
              />
            ) : null}
          </>
        ) : (
          <p data-no-observation>
            This part has not been run yet. The explanation says what to expect.
          </p>
        )}
      </section>
    ) : null

  const completion = lastStep ? (
    <section
      className={stageStyles.completion}
      role="status"
      aria-live="polite"
      data-stage-completion
      data-section-completion
    >
      <h3>Section finished</h3>
      {lesson.spec.practicePairing ? (
        <p data-practice-pairing={lesson.spec.practicePairing.kind}>
          {lesson.spec.practicePairing.kind === 'mechanism-match'
            ? 'A case on this mechanism: '
            : 'A case in this part of the pathway: '}
          <Link
            href={{
              pathname: '/mechanical-ventilation/practice',
              query: { case: lesson.spec.practicePairing.caseId },
            }}
          >
            {ventilationCasePresentationTitle(lesson.spec.practicePairing.caseId)}
          </Link>
          .
        </p>
      ) : null}
    </section>
  ) : null

  const cardChildren: ReactNode = (
    <div
      className={styles.cardBody}
      data-experiment-stage={simulatorTask ? status.stage : undefined}
      data-running={simulatorTask ? status.running : undefined}
    >
      {partNotes}
      {question ? (
        <>
          <p className={styles.note} data-step-look>
            {lookLine}
          </p>
          <VentilationReinforcement
            key={step.id}
            id={question.id}
            purpose={questionPurpose}
            prompt={question.stem}
            choices={question.choices}
            explanation={question.explanation}
            hint={interaction.kind === 'locate' ? round.look : round.hint}
            bestChoiceId={question.correctChoiceIds[0]}
            caseFit={false}
            onChoose={(choice) => {
              if (interaction.kind === 'prediction')
                lab({ type: 'COMMIT', choice: ['a', 'b', 'c'].indexOf(choice) })
              else lab({ type: 'LOCATE', choiceId: choice })
            }}
          />
        </>
      ) : null}
      {interaction.kind === 'sort' ? (
        <section className={styles.cardSection}>
          <h3>Selected settings and reported measurements</h3>
          <p>Compare what you set with what the patient and the ventilator report.</p>
          <table>
            <thead>
              <tr>
                <th>Screen value</th>
                <th>Origin</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {interaction.sort.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.origin}</td>
                  <td>{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {goalList}
      {/*
        The next move on the console, when it adds to the task: which screen, which tile, which
        confirm key. A pause-or-inspect task already says its whole move in the task itself; there
        the line appears only above the console.
      */}
      {simulatorTask && !captured && nextGuided && !readingTask ? (
        <p className={styles.guidedInstruction} data-guided-instruction>
          {nextGuided.instruction}
        </p>
      ) : null}
      {simulatorTask && status.backgroundPaused && !captured && status.stage !== 'ready' ? (
        <p className={styles.boundary} data-background-pause>
          The clock stopped because this page went to the background. That was not your pause, so
          nothing was recorded for it. Press Run on the clock bar to carry on.
        </p>
      ) : null}
      {autoCaptureHeld ? (
        <p className={styles.boundary} data-auto-capture-held>
          Automatic capture is held: this comparison no longer isolates one change. Capture it
          yourself if you still want it, or reset the patient for a clean repeat.
        </p>
      ) : null}
      {simulatorTask && captured && evidence.baseline && evidence.response ? (
        <section className={styles.cardSection} data-captured-result-near-task>
          <CapturedResult round={round} evidence={evidence} effort={presentation.effort} />
        </section>
      ) : null}
      {explanation}
      {startsOtherPart ? (
        <p className={styles.note} data-part-change-notice>
          Continue opens Part {stepRound(lesson.steps[nextIndex!]) + 1} on a fresh, paused patient.
          This part’s run and captured breaths are not kept.
        </p>
      ) : null}
      {completion}
      {simulatorTask ? (
        <p className={styles.srOnly} role="status" aria-live="polite" data-experiment-announcement>
          {status.announcement}
        </p>
      ) : null}
    </div>
  )

  /* --------------------------------------------------------------------------------------------
   * The page
   * ------------------------------------------------------------------------------------------ */

  const breathWalk = presentation.layout === 'breath-walk'
  const peepVisual = peepLesson && !simulatorTask
  /*
   * The breath map leads the text column: the full map on a breath-walk step, the one-line strip
   * on any other console step. The strip used to sit between the clock bar and the console, where
   * it cost the console pane the row its tab bar needed; it orients the reading, so it goes with it.
   */
  const breathMap = breathWalk ? (
    <BreathMap
      emphasis={interaction.kind === 'walk' ? [walkStop] : step.stops}
      caption={interaction.kind === 'walk' ? breathMapCaption([walkStop]) : undefined}
      walk={interaction.kind === 'walk' ? { selected: walkStop, onSelect: setWalkStop } : undefined}
    />
  ) : peepVisual ? null : (
    <BreathMap variant="strip" emphasis={step.stops} />
  )

  const teaching = (
    <VentilationTeachingColumn
      lesson={lesson}
      step={step}
      state={session.simulation}
      stops={interaction.kind === 'walk' ? [walkStop] : step.stops}
      roundIndex={session.round}
      showCapturedReference={!marker}
      landmarkChooser={interaction.kind === 'walk'}
      guideLook={simulatorTask ? lookLine : undefined}
      breathMap={breathMap}
    />
  )

  const visual = peepVisual ? (
    <VentilationPeepComparison
      key={restartCount}
      explanationOpen={interaction.kind === 'explain'}
    />
  ) : (
    <VentilationConsoleSurface
      session={session}
      step={step}
      round={round}
      engine={engine}
      lab={lab}
      guidedControlId={guidedControlId}
      onPendingChange={setPending}
      density={workspace ? 'laptop' : undefined}
      cue={
        simulatorTask && !captured && nextGuided
          ? nextGuided.instruction
          : interaction.kind === 'advance-breath' && !performed
            ? 'Press One breath on the clock bar.'
            : null
      }
      onSelectDevice={(selected) => {
        saveDevicePreference(selected)
        lab({ type: 'DEVICE', device: selected })
        engine({ type: 'SET_PAUSED', paused: true })
        setIndex(presented[0])
        setEntry({ stepId: lesson.steps[presented[0]].id, at: 0 })
      }}
      onResetPatient={() => {
        lab({ type: 'RESET' })
        lab({ type: 'START_EXPERIMENT' })
        engine({ type: 'SET_PAUSED', paused: true })
      }}
    />
  )

  const header = (
    <SectionHeader
      breadcrumb={{ href: mechanicalVentilationNavBase, label: 'Mechanical Ventilation' }}
      kicker={`Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min`}
      title={lesson.title}
      sectionsControl={
        <SectionsDrawer
          pathway={ventilationPathway}
          activeSectionId={unitId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          label="Mechanical ventilation pathway"
          onSelect={(sectionId) => {
            if (sectionId !== unitId) navigateToSection(sectionId)
          }}
        />
      }
      helpRef={helpButtonRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={restart}
      restartLabel="Restart section"
      saveAndExitHref="/mechanical-ventilation/learn"
      resumedNote={
        reorganised
          ? 'This section was reorganised; it reopens at its first task.'
          : !storageAvailable
            ? 'This browser cannot save your place. Every section still works.'
            : undefined
      }
    />
  )

  const helpDialog = (
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusTo={helpButtonRef}>
      <p className={shellStyles.kicker}>{nowModel.kicker}</p>
      <p>
        <strong>{step.title}</strong>
      </p>
      <p>{body}</p>
      {nextGuided ? <p data-help-guided>{nextGuided.instruction}</p> : null}
      {statusLine ? <p>{statusLine}</p> : null}
      {step.rationale ? <p>{step.rationale}</p> : null}
      <p>
        Look at: {step.lookIn.landmark}
        {step.lookIn.alsoLandmark ? `, and ${step.lookIn.alsoLandmark}` : ''}.
      </p>
      <p>
        Every task in this section is open: choose any of them from Tasks in this section, and move
        on without answering whenever you like.
      </p>
      {whereControlId ? (
        <button
          type="button"
          className={shellStyles.nowSecondary}
          onClick={() => {
            setHelpOpen(false)
            showWhere()
          }}
        >
          <LocateFixed aria-hidden="true" /> Show me where
        </button>
      ) : null}
    </HelpDialog>
  )

  const sourcesBlock = (
    <section
      className={styles.block}
      id={VENTILATION_SOURCES_ID}
      aria-labelledby={`${VENTILATION_SOURCES_ID}-heading`}
    >
      <h2 id={`${VENTILATION_SOURCES_ID}-heading`}>Sources</h2>
      <VentilationSourceList records={sources.records} claimsVisible />
    </section>
  )

  /*
   * The text column: the task, its reading, the section's purpose and task list, and — in the
   * desktop workspace, where the page does not scroll — the sources. It is always on the left of
   * the visual, and on top of it when the two stack. Below the workspace the sources stay at the
   * end of the page, after the console, so a phone does not read the whole list before the work.
   */
  const textColumn = (
    <>
      <div
        ref={headingRef}
        tabIndex={-1}
        data-now-focus
        data-step-heading
        data-current-step={step.id}
        className={styles.nowFocus}
      >
        <NowCard model={nowModel}>{cardChildren}</NowCard>
      </div>
      {teaching}
      {position === 0 ? (
        <details className={stageStyles.objectives} data-stage-objectives>
          <summary>What this section is for</summary>
          <p>{lesson.spec.objective}</p>
          <p>
            <strong>One new idea:</strong> {lesson.spec.newConcept}
          </p>
          <p className={styles.note} data-section-time>
            {ventilationSectionTimeLine(unitId)}
          </p>
        </details>
      ) : null}
      <details className={styles.taskMap} data-task-map>
        <summary>Tasks in this section</summary>
        <ol data-step-list>
          {presented.map((stepIndex, order) => {
            const row = lesson.steps[stepIndex]
            const rowState =
              stepIndex === index
                ? 'current'
                : ventilationStepPerformed(row, session, { enteredAtSeconds: 0 }) &&
                    order < position
                  ? 'done'
                  : 'open'
            return (
              <li key={row.id} data-step-state={rowState} data-step-id={row.id}>
                <button
                  type="button"
                  aria-current={stepIndex === index ? 'step' : undefined}
                  disabled={stepIndex === index}
                  onClick={() => navigateToStep(stepIndex)}
                >
                  {order + 1}. {row.title}
                  {rowState === 'done' ? ' · done' : ''}
                </button>
              </li>
            )
          })}
        </ol>
      </details>
      {workspace ? sourcesBlock : null}
    </>
  )

  return (
    <MechanicalVentilationModuleFrame
      locale={locale}
      activeHref="/mechanical-ventilation/learn"
      activityMode
      taskFlow
    >
      <div
        className={styles.flow}
        data-stage-frame
        data-layout={presentation.layout}
        data-workspace={workspace || undefined}
      >
        <LessonShell
          section="learn"
          stage={step.id}
          module="mechanical-ventilation"
          label="Self-paced mechanical ventilation section"
          header={header}
          footer={workspace ? undefined : sourcesBlock}
        >
          <div className={styles.content}>
            <FlowContent kind={presentation.layout} teaching={textColumn} visual={visual} />
          </div>
        </LessonShell>
        {helpDialog}
      </div>
    </MechanicalVentilationModuleFrame>
  )
}
