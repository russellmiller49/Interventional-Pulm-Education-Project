'use client'

import { useEffect, useReducer, useState } from 'react'
import { Link } from '@/i18n/navigation'
import type { CriticalCareActivityMode } from '@/features/learning-module/activity'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import { branchResolution } from '../content/caseFindings'
import { casePresentationModelNote, caseResponseModelNote } from '../content/caseModelNotes'
import { plateauReadingValidity } from '../content/plateauValidity'
import {
  capturePostActionBaseline,
  ventilationPostActionCoaching,
  type PostActionBaseline,
  type PostActionCoaching,
} from '../content/postActionCoaching'
import {
  createInitialSimulationState,
  ventilationSimulationReducer,
  type VentilationAction,
  type VentilationSimulationState,
  type VentilatorDeviceId,
} from '../engine'
import { MechanicalVentilatorConsole } from './MechanicalVentilatorConsole'
import { MechanicalVentilationModuleFrame } from './MechanicalVentilationModuleFrame'
import { BedsidePanel } from './BedsidePanel'
import { SourcesPanel } from './SourcesPanel'
import { PostActionCoachingPanel } from './PostActionCoachingPanel'
import { VentilationReinforcement } from './VentilationReinforcement'
import { useVentilationSelfPacedProgress } from './useVentilationSelfPacedProgress'
import styles from './case-flow.module.css'
import task from './stage/task-flow.module.css'

export type VentilationCaseSection = 'practice' | 'assess'
export interface MechanicalVentilationCaseActivityV2Props {
  readonly locale?: string
  readonly caseId: string
  readonly deviceId: VentilatorDeviceId
  readonly mode: CriticalCareActivityMode
  readonly section: VentilationCaseSection
  readonly seedToken?: string
}
interface CaseSession {
  state: VentilationSimulationState
  baseline: PostActionBaseline | null
  coaching: PostActionCoaching | null
}
function initialCase(caseId: string, deviceId: VentilatorDeviceId): CaseSession {
  return {
    state: createInitialSimulationState(caseId, 'practice', 1, deviceId),
    baseline: null,
    coaching: null,
  }
}
function caseReducer(session: CaseSession, action: VentilationAction): CaseSession {
  const state = ventilationSimulationReducer(session.state, action)
  if (action.type === 'LOAD_CASE') return { state, baseline: null, coaching: null }
  const definition = mechanicalVentilationCaseById.get(state.caseId)!
  const record = state.interventions.at(-1)
  const changedRecord = record && record.id !== session.state.interventions.at(-1)?.id
  const baseline = changedRecord
    ? capturePostActionBaseline(state, definition, record)
    : session.baseline
  const coaching = changedRecord
    ? null
    : (session.coaching ??
      (baseline ? ventilationPostActionCoaching(state, definition, baseline) : null))
  return { state, baseline, coaching }
}

/** Old Practice/Challenge URLs share one ungraded case, without legacy reads or graded writes. */
export default function MechanicalVentilationCaseActivityV2(
  props: MechanicalVentilationCaseActivityV2Props,
) {
  if (props.caseId === 'MV-03') return <HeldDoubleTriggeringCase {...props} />
  return <LiveCase key={props.caseId + ':' + props.deviceId} {...props} />
}

function HeldDoubleTriggeringCase({
  locale = 'en',
  caseId,
  deviceId,
  section,
}: MechanicalVentilationCaseActivityV2Props) {
  const { visit } = useVentilationSelfPacedProgress()
  useEffect(() => {
    visit({ section, id: caseId, step: 0 })
  }, [visit, section, caseId])
  const definition = mechanicalVentilationCaseById.get(caseId)!
  return (
    <MechanicalVentilationModuleFrame
      locale={locale}
      activeHref={'/mechanical-ventilation/' + section}
      taskFlow
    >
      <article className={`${task.flow} ${task.content}`} data-mv03-model-hold>
        <h1>{definition.title}</h1>
        <p>
          <strong>Worked explanation · live case under modeling review</strong>
        </p>
        <p>
          The live intrinsic PEEP display alternates between the short gap within a breath pair and
          the longer gap between pairs. A lower displayed value after waiting does not demonstrate
          that air trapping improved. This live example is unavailable while ventilation faculty/RT
          review the measurement and initialization contract.
        </p>
        <h2>The authored mechanism</h2>
        <p>{definition.debrief}</p>
        <h2>What to examine in a tracing</h2>
        <ul>
          {definition.learningObjectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
        <p>
          This is a casebook explanation. No simulated intervention or observation has been
          recorded.
        </p>
        <Link href="/mechanical-ventilation/practice">Continue to other cases</Link>
        <Link
          href={{
            pathname: '/mechanical-ventilation/learn',
            query: { activity: 'triggering-and-cycling' },
          }}
        >
          Review triggering and cycling
        </Link>
        <SourcesPanel deviceId={deviceId} />
      </article>
    </MechanicalVentilationModuleFrame>
  )
}

function LiveCase({
  locale = 'en',
  caseId,
  deviceId,
  section,
}: MechanicalVentilationCaseActivityV2Props) {
  const [session, dispatch] = useReducer(caseReducer, undefined, () =>
    initialCase(caseId, deviceId),
  )
  const state = session.state
  const definition = mechanicalVentilationCaseById.get(caseId)!
  const [explanation, setExplanation] = useState(false)
  const [hint, setHint] = useState(false)
  const [repeat, setRepeat] = useState(0)
  const [variation, setVariation] = useState(1)
  const { visit, storageAvailable } = useVentilationSelfPacedProgress()
  const validity = plateauReadingValidity(state)
  const resolution = branchResolution(caseId, state.branch)
  useEffect(() => {
    visit({ section, id: caseId, step: explanation ? 1 : 0 })
  }, [visit, section, caseId, explanation])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'TICK', seconds: 0.1 })
    }, 100)
    const hide = () => {
      if (document.visibilityState !== 'visible') dispatch({ type: 'SET_PAUSED', paused: true })
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [])
  function restart(anotherVariation = false) {
    dispatch({
      type: 'LOAD_CASE',
      caseId,
      deviceId,
      experience: 'practice',
      attempt: variation + (anotherVariation ? 1 : 0),
    })
    setExplanation(false)
    setHint(false)
    setRepeat((current) => current + 1)
    if (anotherVariation) setVariation((current) => current + 1)
  }
  return (
    <MechanicalVentilationModuleFrame
      locale={locale}
      activeHref={'/mechanical-ventilation/' + section}
      taskFlow
    >
      <div className={`${styles.flow} ${task.flow}`} data-case-flow="self-paced">
        <div className={styles.document}>
          <header className={task.block}>
            <h1>{definition.title}</h1>
            <p>{definition.patientDescription}</p>
            {casePresentationModelNote(state) ? (
              <p className={task.note} data-case-model-note>
                {casePresentationModelNote(state)}
              </p>
            ) : null}
            <p>
              Inspect, experiment, and reassess. Optional questions and explanations are available
              throughout.
            </p>
            <nav className={task.tools} aria-label="Case navigation">
              <button type="button" onClick={() => setExplanation((open) => !open)}>
                {explanation ? 'Return to the case' : 'Show explanation'}
              </button>
              <button type="button" onClick={() => setHint((open) => !open)}>
                Hint
              </button>
              <button type="button" onClick={() => restart()}>
                Restart patient
              </button>
              <button type="button" onClick={() => restart(true)}>
                Try another variation
              </button>
              <Link href="/mechanical-ventilation/practice">Continue to another case</Link>
            </nav>
            {hint ? <p>{definition.hintLadder.join(' ')}</p> : null}
            <p className={task.note}>
              Visited topics and location are saved locally. Reload starts a fresh paused patient;
              responses and runs stay in this session.
            </p>
            {!storageAvailable ? (
              <p role="status">This browser cannot save your place. The case remains available.</p>
            ) : null}
          </header>
          {explanation ? (
            <section className={task.block} data-case-explanation>
              <h2>Case explanation</h2>
              <p>{definition.debrief}</p>
              {resolution ? <p>{resolution.cause}</p> : null}
              <p>
                <strong>Authored safety priority: </strong>
                {
                  definition.priorityOptions.find(
                    (option) => option.id === definition.correctPriorityId,
                  )?.label
                }
              </p>
              <p>
                <strong>Authored expected response: </strong>
                {
                  definition.responseOptions.find(
                    (option) => option.id === definition.correctResponseId,
                  )?.label
                }
              </p>
              {caseResponseModelNote(caseId) ? (
                <p data-case-model-boundary>{caseResponseModelNote(caseId)}</p>
              ) : null}
              <h3>Actions to consider in this authored example</h3>
              <ul>
                {definition.expectedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
              <h3>Safety considerations</h3>
              <ul>
                {definition.unsafeActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
              <p>
                Reading this explanation does not record an action or establish a physiological
                response.
              </p>
            </section>
          ) : null}
          <SimulationLaunchGate
            activityTitle={definition.title}
            minimumViewport="tablet"
            bandwidthClass="standard"
            estimatedSizeLabel="Interactive ventilator console"
            theme="dark"
            lightweightAlternativeHref="/mechanical-ventilation/learn"
          >
            <div className={styles.workspace}>
              <section className={styles.ventilator} aria-label="Working simulation">
                <div className={task.tools} aria-label="Playback and inspection">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_PAUSED', paused: !state.paused })}
                  >
                    {state.paused ? 'Run physiology' : 'Pause'}
                  </button>
                  <button type="button" onClick={() => dispatch({ type: 'STEP_BREATH' })}>
                    One breath
                  </button>
                  <select
                    aria-label="Simulation speed"
                    value={state.speed}
                    onChange={(event) =>
                      dispatch({
                        type: 'SET_SPEED',
                        speed: Number(event.target.value) as 1 | 5 | 30,
                      })
                    }
                  >
                    <option value={1}>1×</option>
                    <option value={5}>5×</option>
                    <option value={30}>30×</option>
                  </select>
                  <span data-simulation-time={state.simulationTime}>
                    {state.simulationTime.toFixed(1)} simulated seconds
                  </span>
                </div>
                <MechanicalVentilatorConsole state={state} dispatch={dispatch} controlsEnabled />
                <p className={task.note}>
                  {validity.interpretable
                    ? 'The trace estimate is within this model’s interpretability conditions.'
                    : validity.reason}{' '}
                  A pressure estimate is separate from a performed hold.
                </p>
                <BedsidePanel state={state} definition={definition} compact requireAssessment />
              </section>
              <section className={styles.task} aria-label="Case actions">
                <h2>Actions and observation</h2>
                <p>
                  Each action runs through the existing patient and device model. Reassess the
                  actual response and its timing.
                </p>
                {definition.interventions.map((intervention) => {
                  const performed = state.interventions.some(
                    (record) => record.interventionId === intervention.id,
                  )
                  const missing =
                    intervention.prerequisites?.filter(
                      (id) => !state.interventions.some((record) => record.interventionId === id),
                    ) ?? []
                  return (
                    <div key={intervention.id} className={task.block}>
                      <button
                        type="button"
                        disabled={(performed && !intervention.repeatable) || missing.length > 0}
                        onClick={() =>
                          dispatch({
                            type: 'PERFORM_INTERVENTION',
                            interventionId: intervention.id,
                          })
                        }
                      >
                        {intervention.label}
                      </button>
                      {missing.length ? (
                        <p>
                          Requires the actual preceding action:{' '}
                          {missing
                            .map(
                              (id) =>
                                definition.interventions.find((item) => item.id === id)?.label ??
                                id,
                            )
                            .join(', ')}
                          .
                        </p>
                      ) : null}
                      {performed ? <span> · action recorded</span> : null}
                    </div>
                  )
                })}
                {state.lastResponse ? <p role="status">{state.lastResponse}</p> : null}
                {state.criticalErrors.length ? (
                  <section className={task.boundary} role="alert" aria-label="Safety interruption">
                    <h3>Safety interruption</h3>
                    <p>
                      These simulated findings call for immediate stabilization and reassessment.
                    </p>
                    <ul>
                      {state.criticalErrors.map((finding) => (
                        <li key={finding}>{finding}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {state.alarms.length ? (
                  <section aria-label="Active safety signals">
                    <h3>Active safety signals</h3>
                    <ul>
                      {state.alarms.map((alarm) => (
                        <li key={alarm.id}>{alarm.message}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {session.coaching ? (
                  <PostActionCoachingPanel coaching={session.coaching} />
                ) : session.baseline ? (
                  <p>Observe the action’s response interval before comparing its readings.</p>
                ) : null}
              </section>
            </div>
          </SimulationLaunchGate>
          <VentilationReinforcement
            key={caseId + ':' + repeat}
            id={caseId + '-mechanism'}
            purpose="Connect the observed pattern with the case’s proposed mechanism."
            prompt="Which mechanism could explain this pattern?"
            choices={definition.mechanismOptions}
            hint={
              definition.hintLadder[0] ??
              'Inspect pressure, flow, volume, and patient effort together.'
            }
            explanation={definition.debrief}
          />
          <SourcesPanel deviceId={deviceId} />
          <Link href="/mechanical-ventilation/practice">Continue to another case</Link>
        </div>
      </div>
    </MechanicalVentilationModuleFrame>
  )
}
