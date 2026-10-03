'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
} from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { LessonShell } from '@/features/learning-module/stage/LessonShell'
import { ventilationLearningUnits } from '../../content/learningCurriculum'
import {
  roundManeuver,
  ventilationStageLesson,
  type VentilationStageStep,
} from '../../content/stageLessons'
import { createLabSimulation } from '../../engine/learningLab'
import { ventilationReferenceMarker } from '../../content/referenceEvidence'
import { ventilationExperimentByUnit } from '../../content/learningExperiments'
import { ventilationStageSources } from '../../content/stageSources'
import { isFoundationUnit } from '../../content/foundations'
import { observationFor } from '../../engine/learningObservation'
import type { VentilatorDeviceId } from '../../engine/types'
import { MechanicalVentilationModuleFrame } from '../MechanicalVentilationModuleFrame'
import { VentilationReinforcement } from '../VentilationReinforcement'
import { useVentilationSelfPacedProgress } from '../useVentilationSelfPacedProgress'
import { VentilationTaskWorkbench } from './VentilationTaskWorkbench'
import { VENTILATION_SOURCES_ID, VentilationTeachingColumn } from './VentilationTeachingColumn'
import { VentilationSourceList } from './VentilationSourceList'
import { CapturedBreath } from './CapturedBreath'
import { CapturedResult } from './RecordedBreathComparison'
import { VentilationExperimentPanel } from './VentilationExperimentPanel'
import { inspectionFigureState, markedIntervalLook } from '../../content/experimentStatus'
import {
  activatesThisTab,
  cancelTaskHeadingReveal,
  consumeTaskHeadingReveal,
  requestTaskHeadingReveal,
  revealTaskHeading,
} from './revealTaskHeading'
import { VentilationPeepComparison } from './VentilationPeepComparison'
import { breathStop, type BreathStopId } from '../../content/breathSpine'
import {
  readDevicePreference,
  saveDevicePreference,
  useVentilationLabSession,
} from './useVentilationLabSession'
import styles from './task-flow.module.css'

const stepRound = (step: VentilationStageStep): 0 | 1 =>
  'round' in step.interaction ? step.interaction.round : 0

/** Reading location is independent of the actual patient and measurement evidence. */
export function VentilationStageHost({
  unitId,
  locale = 'en',
}: {
  readonly unitId: string
  readonly locale?: string
  readonly renderer?: 'task' | 'legacy'
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
  const [index, setIndex] = useState(Math.min(initialStep, lesson.steps.length - 1))
  const [device] = useState<VentilatorDeviceId>(readDevicePreference)
  const { session, engine, lab } = useVentilationLabSession({
    unitId,
    device,
    round: stepRound(lesson.steps[index]),
  })
  const step = lesson.steps[index]
  const interaction = step.interaction
  const experiment = ventilationExperimentByUnit.get(unitId)!
  const round = experiment.rounds[session.round]
  const evidence = session.evidence[session.round]
  const sources = ventilationStageSources(unitId, session.device)
  const nextUnit = ventilationLearningUnits[lesson.index + 1]
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [restartCount, setRestartCount] = useState(0)
  const [resetCount, setResetCount] = useState(0)
  const peepLesson = unitId === 'oxygenation-response'
  const [walkStop, setWalkStop] = useState<BreathStopId>('trigger')
  const stepCountId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  /*
   * Set only by the explicit navigation handlers below — Continue, Back, the step chooser and
   * Restart — and consumed by the next committed step. A tick, Run/Pause, a capture, a control
   * change or a disclosure never sets it, so none of them moves focus or the page (N4).
   */
  const revealRequested = useRef(false)
  useEffect(() => {
    visit({ section: 'learn', id: unitId, step: index })
  }, [index, unitId, visit])
  useLayoutEffect(() => {
    if (!revealRequested.current) return
    revealRequested.current = false
    if (headingRef.current) revealTaskHeading(headingRef.current)
  }, [index, restartCount])
  // A section chosen from the section chooser or the last step's link lands on its first heading
  // — this section, and only when the request names it.
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
  function navigateToSection(sectionId: string) {
    requestedSection.current = sectionId
    requestTaskHeadingReveal(sectionId)
    startSectionNavigation(() => {
      router.push({ pathname: '/mechanical-ventilation/learn', query: { activity: sectionId } })
    })
  }
  useEffect(() => {
    if (sectionPending || requestedSection.current === null) return
    cancelTaskHeadingReveal(requestedSection.current)
    requestedSection.current = null
  }, [sectionPending])
  /*
   * The last step's link. A plain click navigates this tab through the same path as the chooser.
   * A modified click, another button or a new-context activation is left to the browser, which
   * opens the destination elsewhere: this tab makes no request and its focus does not move.
   */
  function continueToSection(event: MouseEvent<HTMLAnchorElement>, sectionId: string) {
    if (event.defaultPrevented || !activatesThisTab(event)) return
    event.preventDefault()
    navigateToSection(sectionId)
  }

  function goToStep(next: number) {
    const target = Math.max(0, Math.min(next, lesson.steps.length - 1))
    lab({ type: 'OPEN_ROUND', round: stepRound(lesson.steps[target]) })
    if (lesson.steps[target].interaction.kind === 'simulator-task')
      lab({ type: 'START_EXPERIMENT' })
    setIndex(target)
    setExplanationOpen(false)
  }
  /** Explicit step navigation: change the step, then bring its heading into view and focus it. */
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
    setIndex(0)
    setExplanationOpen(false)
  }
  const question =
    interaction.kind === 'prediction' || interaction.kind === 'locate' ? interaction.item : null
  const showExplanation = explanationOpen || interaction.kind === 'explain'
  const observation = evidence.response ? observationFor(session) : null
  const simulationStep = ['simulator-task', 'observe', 'interpret'].includes(interaction.kind)
  /* The steps whose work is the experiment: the lesson follows the task, control and evidence. */
  const workingStep = interaction.kind === 'simulator-task' || interaction.kind === 'observe'
  /*
   * The authored marker for this application, and the reference breath it is pinned on.
   *
   * Both used to be somewhere else: the reference lived inside the collapsed "Teaching and worked
   * references" disclosure while step 1 said "Use the marked interval A on the captured complete
   * breath", and it was always built from round 0, so step 10's "a new complete breath ... on a
   * longer respiratory cycle" re-showed the first one. It is built from `session.round` here and
   * rendered beside the instruction that refers to it; the teaching column stops drawing its own
   * copy on those steps so there is one figure and one marker, not two.
   */
  const marker = ventilationReferenceMarker(unitId, session.round)
  const markerStep = marker !== null && ['read', 'prediction', 'explain'].includes(interaction.kind)
  const markerReference = useMemo(
    () => (markerStep ? createLabSimulation(unitId, session.round, session.device) : null),
    [markerStep, unitId, session.round, session.device],
  )
  /*
   * What to look at, for this step. On a step that performs a round with a marked interval, the
   * sentence follows the figure that is actually on screen — the experiment panel's captured
   * breath with the marker on it, nothing yet, or the retained comparison — instead of repeating
   * the line written beside the question's worked reference.
   */
  const inspectionFigure = simulationStep ? inspectionFigureState(session) : null
  const lookLine =
    marker && inspectionFigure
      ? markedIntervalLook(marker.markerId, inspectionFigure)
      : (step.guide?.look ?? round.look)
  /*
   * The lead-in over an optional question, per item kind. "Predict the observable response to one
   * change, then compare it with a real run" sat over "Which phase is shown at cursor A?", which
   * involves no change and no run.
   */
  const questionPurpose =
    interaction.kind === 'locate'
      ? 'Locate the timing relationship on the breath.'
      : marker
        ? `Identify what the marked interval ${marker.markerId} shows on the captured breath above, then check your reading against its samples.`
        : roundManeuver(round) === 'hold'
          ? 'Interpret the measurement this maneuver produces, then compare it with the acquisition status.'
          : roundManeuver(round) === 'pause'
            ? 'Read the frozen traces at one instant, then compare your reading with the captured samples.'
            : 'Predict the observable response to one change, then compare it with a real run.'

  return (
    <MechanicalVentilationModuleFrame
      locale={locale}
      activeHref="/mechanical-ventilation/learn"
      activityMode
      taskFlow
    >
      <div className={styles.flow} data-stage-frame>
        <LessonShell
          section="learn"
          stage={step.id}
          module="mechanical-ventilation"
          label="Self-paced mechanical ventilation section"
          header={
            <header className={`${styles.block} ${styles.sectionHeader}`}>
              <p>
                Section {lesson.index + 1} of {lesson.total}
              </p>
              <h1>{lesson.title}</h1>
              <p>
                Read, try a prediction, or experiment at your own pace. Every step is available.
              </p>
              <nav className={styles.tools} aria-label="Lesson navigation">
                <label>
                  Section{' '}
                  <select
                    aria-label="Choose section"
                    value={unitId}
                    onChange={(event) => navigateToSection(event.target.value)}
                  >
                    {ventilationLearningUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Step{' '}
                  <select
                    aria-label="Choose step"
                    value={index}
                    onChange={(event) => navigateToStep(Number(event.target.value))}
                  >
                    {lesson.steps.map((item, i) => (
                      <option key={item.id} value={i}>
                        {i + 1}. {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={restart}>
                  Restart section
                </button>
                <Link href="/mechanical-ventilation/learn">All sections</Link>
              </nav>
              <p className={styles.note}>
                Your place and visited topics are saved on this device. Reloading or switching
                applications starts a fresh paused patient; answers and runs are not saved.
              </p>
              {!storageAvailable ? (
                <p role="status">
                  This browser cannot save your place. You can still use every section.
                </p>
              ) : null}
            </header>
          }
          footer={
            <section
              className={styles.block}
              id={VENTILATION_SOURCES_ID}
              aria-labelledby={`${VENTILATION_SOURCES_ID}-heading`}
            >
              <h2 id={`${VENTILATION_SOURCES_ID}-heading`}>Sources</h2>
              <VentilationSourceList records={sources.records} claimsVisible />
            </section>
          }
        >
          <div className={styles.content}>
            <section className={styles.block} data-current-step={step.id}>
              <p id={stepCountId}>
                Step {index + 1} of {lesson.steps.length} · Application {session.round + 1}
              </p>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className={styles.stepHeading}
                aria-describedby={stepCountId}
                data-step-heading
              >
                {step.title}
              </h2>
              <p>
                {simulationStep
                  ? round.task
                  : question
                    ? 'Consider this optional question, or open its explanation and continue.'
                    : peepLesson
                      ? step.instruction
                      : round.introduction}
              </p>
              <p data-step-look>{lookLine}</p>
              {marker && markerReference ? (
                <CapturedBreath
                  key={`marker:${session.round}:${session.device}:${restartCount}`}
                  label={`Captured reference · interval ${marker.markerId}`}
                  samples={markerReference.waveforms}
                  guided
                  marker={marker}
                />
              ) : null}
              {simulationStep ? (
                <VentilationExperimentPanel
                  key={`${unitId}:${session.round}:${session.device}:${restartCount}:${resetCount}`}
                  session={session}
                  lab={lab}
                  engine={engine}
                />
              ) : null}
              <nav className={styles.tools} aria-label="Step navigation">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => navigateToStep(index - 1)}
                >
                  Back
                </button>
                {index < lesson.steps.length - 1 ? (
                  <button type="button" onClick={() => navigateToStep(index + 1)}>
                    Continue
                  </button>
                ) : nextUnit ? (
                  <Link
                    href={{
                      pathname: '/mechanical-ventilation/learn',
                      query: { activity: nextUnit.id },
                    }}
                    onClick={(event) => continueToSection(event, nextUnit.id)}
                  >
                    Continue to {nextUnit.title}
                  </Link>
                ) : (
                  <Link href="/mechanical-ventilation/assess">Continue to worked applications</Link>
                )}
                <button type="button" onClick={() => setExplanationOpen(true)}>
                  Show explanation
                </button>
              </nav>
            </section>
            {workingStep && evidence.baseline && evidence.response && !showExplanation ? (
              <section className={styles.block} data-captured-result-near-task>
                <CapturedResult
                  round={round}
                  evidence={evidence}
                  effort={step.presentation.effort}
                />
              </section>
            ) : null}
            {peepLesson && !workingStep ? (
              <VentilationPeepComparison key={restartCount} explanationOpen={showExplanation} />
            ) : null}
            {interaction.kind === 'walk' ? (
              <nav className={styles.tools} aria-label="Breath landmarks">
                {interaction.stops.map((stop) => (
                  <button
                    key={stop}
                    type="button"
                    aria-pressed={walkStop === stop}
                    onClick={() => setWalkStop(stop)}
                  >
                    {breathStop(stop).title}
                  </button>
                ))}
              </nav>
            ) : null}
            {workingStep ? null : (
              <VentilationTeachingColumn
                lesson={lesson}
                step={step}
                state={session.simulation}
                stops={interaction.kind === 'walk' ? [walkStop] : step.stops}
                roundIndex={session.round}
                showCapturedReference={!markerStep}
                landmarkChooser={interaction.kind === 'walk'}
              />
            )}
            {question ? (
              <VentilationReinforcement
                key={step.id}
                id={question.id}
                purpose={questionPurpose}
                prompt={question.stem}
                choices={question.choices}
                explanation={question.explanation}
                hint={round.look}
                onChoose={(choice) => {
                  if (interaction.kind === 'prediction')
                    lab({ type: 'COMMIT', choice: ['a', 'b', 'c'].indexOf(choice) })
                  else lab({ type: 'LOCATE', choiceId: choice })
                }}
              />
            ) : null}
            {interaction.kind === 'sort' ? (
              <section className={styles.block}>
                <h3>Selected settings and reported measurements</h3>
                <p>Compare what you set with what the patient and ventilator report.</p>
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
            {peepLesson && !workingStep ? (
              <section className={styles.block}>
                <h2>Your separate simulated patient</h2>
                <p>
                  The controls below act on your patient. The worked comparison above does not
                  change this patient or create a captured response.
                </p>
              </section>
            ) : null}
            <VentilationTaskWorkbench
              key={unitId + ':' + session.round + ':' + session.device}
              session={session}
              presentation={step.presentation}
              engine={engine}
              goals={round.goals}
              watch={round.watch}
              controlsEnabled
              deviceLocked={false}
              transport={!simulationStep}
              onSelectDevice={(selected) => {
                saveDevicePreference(selected)
                lab({ type: 'DEVICE', device: selected })
                engine({ type: 'SET_PAUSED', paused: true })
                setIndex(0)
              }}
              onResetPatient={() => {
                setResetCount((count) => count + 1)
                lab({ type: 'RESET' })
                lab({ type: 'START_EXPERIMENT' })
                engine({ type: 'SET_PAUSED', paused: true })
              }}
            />
            {workingStep && peepLesson ? (
              <VentilationPeepComparison key={restartCount} explanationOpen={showExplanation} />
            ) : null}
            {workingStep ? (
              <VentilationTeachingColumn
                lesson={lesson}
                step={step}
                state={session.simulation}
                stops={step.stops}
                roundIndex={session.round}
                showCapturedReference={!markerStep}
                guideLook={lookLine}
              />
            ) : null}
            {showExplanation || interaction.kind === 'interpret' ? (
              <section className={styles.block} data-experiment-explanation>
                <h3>{round.title}</h3>
                <p>{round.explanation}</p>
                {evidence.baseline && evidence.response ? (
                  <>
                    <CapturedResult
                      round={round}
                      evidence={evidence}
                      effort={step.presentation.effort}
                    />
                    {observation && isFoundationUnit(unitId) ? (
                      <VentilationReinforcement
                        key={step.id + '-observation'}
                        id={step.id + '-observation'}
                        purpose="Interpret the captured response separately from the predicted mechanism."
                        prompt={observation.prompt}
                        choices={observation.choices}
                        explanation={observation.feedback}
                        hint="Read the baseline and response, including measurement validity."
                      />
                    ) : null}
                  </>
                ) : (
                  <p data-no-observation>
                    No response has been captured in this application. This explanation describes
                    the authored concept, not a result you produced.
                  </p>
                )}
              </section>
            ) : null}
            <nav className={styles.tools} aria-label="Continue reading">
              {index < lesson.steps.length - 1 ? (
                <button type="button" onClick={() => navigateToStep(index + 1)}>
                  Continue
                </button>
              ) : (
                <Link href="/mechanical-ventilation/practice">Explore the cases</Link>
              )}
            </nav>
          </div>
        </LessonShell>
      </div>
    </MechanicalVentilationModuleFrame>
  )
}
