'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { labGoalMet, labReadyToCompare, labMetricLabels } from '../../engine/learningLab'
import { observationFor } from '../../engine/learningObservation'
import type { VentilatorDeviceId } from '../../engine/types'
import { MechanicalVentilationModuleFrame } from '../MechanicalVentilationModuleFrame'
import { VentilationReinforcement } from '../VentilationReinforcement'
import { useVentilationSelfPacedProgress } from '../useVentilationSelfPacedProgress'
import { VentilationTaskWorkbench } from './VentilationTaskWorkbench'
import { VentilationTeachingColumn } from './VentilationTeachingColumn'
import { VentilationPrerequisite } from './VentilationPrerequisite'
import { VentilationSourceList } from './VentilationSourceList'
import { CapturedBreath } from './CapturedBreath'
import { RecordedBreathComparison } from './RecordedBreathComparison'
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
  const ready = labReadyToCompare(session)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [restartCount, setRestartCount] = useState(0)
  const peepLesson = unitId === 'oxygenation-response'
  const [walkStop, setWalkStop] = useState<BreathStopId>('trigger')
  useEffect(() => {
    visit({ section: 'learn', id: unitId, step: index })
  }, [index, unitId, visit])

  function goToStep(next: number) {
    const target = Math.max(0, Math.min(next, lesson.steps.length - 1))
    lab({ type: 'OPEN_ROUND', round: stepRound(lesson.steps[target]) })
    if (lesson.steps[target].interaction.kind === 'simulator-task')
      lab({ type: 'START_EXPERIMENT' })
    setIndex(target)
    setExplanationOpen(false)
  }
  function restart() {
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
                    onChange={(event) =>
                      router.push({
                        pathname: '/mechanical-ventilation/learn',
                        query: { activity: event.target.value },
                      })
                    }
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
                    onChange={(event) => goToStep(Number(event.target.value))}
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
            <section className={styles.block}>
              <VentilationSourceList records={sources.records} claimsVisible />
            </section>
          }
        >
          <div className={styles.content}>
            <section className={styles.block} data-current-step={step.id}>
              <p>
                Step {index + 1} of {lesson.steps.length} · Application {session.round + 1}
              </p>
              <h2>{step.title}</h2>
              <p>
                {simulationStep
                  ? round.task
                  : question
                    ? 'Consider this optional question, or open its explanation and continue.'
                    : peepLesson
                      ? step.instruction
                      : round.introduction}
              </p>
              <p>{step.guide?.look ?? round.look}</p>
              {marker && markerReference ? (
                <CapturedBreath
                  key={`marker:${session.round}:${session.device}:${restartCount}`}
                  label={`Captured reference · interval ${marker.markerId}`}
                  samples={markerReference.waveforms}
                  guided
                  marker={marker}
                />
              ) : null}
              <nav className={styles.tools} aria-label="Step navigation">
                <button type="button" disabled={index === 0} onClick={() => goToStep(index - 1)}>
                  Back
                </button>
                {index < lesson.steps.length - 1 ? (
                  <button type="button" onClick={() => goToStep(index + 1)}>
                    Continue
                  </button>
                ) : nextUnit ? (
                  <Link
                    href={{
                      pathname: '/mechanical-ventilation/learn',
                      query: { activity: nextUnit.id },
                    }}
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
            {peepLesson ? (
              <VentilationPeepComparison key={restartCount} explanationOpen={showExplanation} />
            ) : null}
            {interaction.kind === 'read' || interaction.kind === 'walk' ? (
              <VentilationPrerequisite lesson={lesson} device={session.device} />
            ) : null}
            {interaction.kind === 'walk' ? (
              <section className={styles.block}>
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
                <VentilationTeachingColumn
                  lesson={lesson}
                  step={step}
                  state={session.simulation}
                  stops={[walkStop]}
                  roundIndex={session.round}
                />
              </section>
            ) : null}
            <details className={styles.block} open={showExplanation || undefined}>
              <summary>Teaching and worked references</summary>
              <VentilationTeachingColumn
                lesson={lesson}
                step={step}
                state={session.simulation}
                stops={step.stops}
                roundIndex={session.round}
                showCapturedReference={!markerStep}
              />
            </details>
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
            {peepLesson ? (
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
              onSelectDevice={(selected) => {
                saveDevicePreference(selected)
                lab({ type: 'DEVICE', device: selected })
                engine({ type: 'SET_PAUSED', paused: true })
                setIndex(0)
              }}
              onResetPatient={() => {
                lab({ type: 'RESET' })
                lab({ type: 'START_EXPERIMENT' })
                engine({ type: 'SET_PAUSED', paused: true })
              }}
            />
            {simulationStep ? (
              <section className={styles.block} data-experiment-status>
                <h3>Actual experiment</h3>
                <p>
                  {round.task} Observe for {round.seconds} simulated seconds after the requested
                  action.
                </p>
                {session.phase !== 'experiment' && session.phase !== 'compare' ? (
                  <button type="button" onClick={() => lab({ type: 'START_EXPERIMENT' })}>
                    Start experiment from baseline
                  </button>
                ) : null}
                <p>
                  {round.goals.every((goal) => labGoalMet(goal, session))
                    ? 'The requested action is present. Check the measurement status and response interval.'
                    : 'The requested action has not yet been recorded.'}
                </p>
                <button type="button" disabled={!ready} onClick={() => lab({ type: 'COMPARE' })}>
                  {evidence.response ? 'Observed response captured' : 'Capture observed response'}
                </button>
                {!ready && !evidence.response ? (
                  <p>
                    The capture needs the actual action and observation interval. You can continue
                    reading at any time.
                  </p>
                ) : null}
                {evidence.response ? (
                  <p>
                    The response is captured below. Reset the patient to repeat this experiment.
                  </p>
                ) : null}
                {round.goals.some(
                  (goal) => goal.type === 'pause-expiration' || goal.type === 'inspect-inspiration',
                ) && evidence.baseline ? (
                  <CapturedBreath
                    label="Baseline reference · select an interval to inspect"
                    samples={evidence.baseline.waveforms}
                    onInspect={(sample) => lab({ type: 'INSPECT', sampleTime: sample.time })}
                  />
                ) : null}
              </section>
            ) : null}
            {showExplanation || interaction.kind === 'interpret' ? (
              <section className={styles.block} data-experiment-explanation>
                <h3>{round.title}</h3>
                <p>{round.explanation}</p>
                {evidence.baseline && evidence.response ? (
                  <>
                    <RecordedBreathComparison evidence={evidence} />
                    <table>
                      <caption>Captured baseline and observed response</caption>
                      <thead>
                        <tr>
                          <th>Reading</th>
                          <th>Before</th>
                          <th>After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {round.watch.map((metric) => (
                          <tr key={metric}>
                            <th>
                              {labMetricLabels[metric].label} ({labMetricLabels[metric].unit})
                            </th>
                            <td>
                              {evidence.baseline!.values[metric].toFixed(
                                labMetricLabels[metric].digits,
                              )}
                            </td>
                            <td>
                              {evidence.response!.values[metric].toFixed(
                                labMetricLabels[metric].digits,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      Plateau: {evidence.response.plateauSource};{' '}
                      {evidence.response.plateauValid
                        ? 'interpretable within this model'
                        : 'not interpretable'}
                      . {evidence.response.issues?.join(' ')}
                    </p>
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
                <button type="button" onClick={() => goToStep(index + 1)}>
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
