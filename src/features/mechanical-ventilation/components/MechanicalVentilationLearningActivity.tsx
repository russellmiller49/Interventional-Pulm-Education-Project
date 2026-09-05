'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { Route } from 'next'
import {
  Activity,
  ArrowRight,
  Check,
  Circle,
  List,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  X,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import {
  ventilationLearningUnits,
  ventilationObjectives,
  ventilationCourseMinutes,
  ventilationStages,
  ventilationUnitHref,
  type VentilationLearningUnit,
} from '../content/learningCurriculum'
import {
  ventilationExperimentByUnit,
  type LabGoal,
  type LabMetric,
} from '../content/learningExperiments'
import { resolveVentilationSimulationCase } from '../content/learningPatient'
import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import { hasFocusedGuidance } from '../engine/learningProgress'
import {
  createLabSession,
  labCheckpoint,
  labControlValue,
  labGoalAction,
  labGoalMet,
  labMetricLabels,
  labReadyToCompare,
  labSnapshot,
  learningLabReducer,
  type LabAction,
  type LabCheckpoint,
  type LabProgress,
  type LabSession,
  type LabSnapshot,
} from '../engine/learningLab'
import type { VentilationAction, VentilatorControlKey } from '../engine/types'
import { useVentilationLabProgress } from './useVentilationLabProgress'
import { useVentilationLearningProgress } from './useVentilationLearningProgress'
import { MechanicalVentilatorConsole } from './MechanicalVentilatorConsole'
import { MechanicalVentilationTeachingPanel } from './MechanicalVentilationTeachingPanel'
import { BedsidePanel } from './BedsidePanel'
import { WaveformStrip } from './WaveformStrip'
import {
  VentilationLearningSources,
  VentilationProtectionReference,
} from './VentilationLearningVisuals'
import styles from './ventilation-live-learning.module.css'

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* The live session remains usable. */
  }
}

// Narrow teaching controls for these authored experiments. The full device retains its own ranges.
const labControls: Partial<
  Record<
    VentilatorControlKey,
    { label: string; unit: string; min: number; max: number; step: number }
  >
> = {
  vtMl: { label: 'Tidal-volume target', unit: 'mL', min: 200, max: 700, step: 10 },
  peakFlowLMin: { label: 'Peak inspiratory flow', unit: 'L/min', min: 20, max: 90, step: 1 },
  oxygenPercent: { label: 'Oxygen', unit: '%', min: 21, max: 100, step: 1 },
  peepCmH2O: { label: 'PEEP', unit: 'cmH₂O', min: 0, max: 20, step: 1 },
  ratePerMin: { label: 'Mandatory rate', unit: '/min', min: 8, max: 35, step: 1 },
  triggerThreshold: { label: 'Flow-trigger threshold', unit: 'L/min', min: 0.5, max: 8, step: 0.5 },
  etsPercent: { label: 'Flow cycling (ETS)', unit: '%', min: 5, max: 80, step: 1 },
  pRampMs: { label: 'Pressure rise time', unit: 'ms', min: 0, max: 1000, step: 10 },
}
const actionLabels: Record<string, string> = {
  'assess-patient': 'Assess the patient',
  'inspect-circuit': 'Inspect the circuit',
  'drain-condensate': 'Clear observed condensate',
  'communication-board': 'Establish communication',
  'treat-pain': 'Model treatment of pain',
}
function goalLabel(goal: LabGoal): string {
  if (goal.type === 'control') {
    const c = labControls[goal.key]
    return `${c?.label ?? goal.key}: ${goal.value} ${c?.unit ?? ''}`
  }
  if (goal.type === 'mechanics')
    return `${goal.key === 'complianceScale' ? 'Compliance' : 'Resistance'}: ${goal.value}× baseline`
  if (goal.type === 'hold')
    return `${goal.hold === 'inspiratory' ? 'Inspiratory' : 'Expiratory'} hold observed`
  if (goal.type === 'intervention') return actionLabels[goal.id] ?? goal.id
  return 'Pause during outward flow after a full breath'
}
function metricValue(snapshot: LabSnapshot, metric: LabMetric) {
  return `${snapshot.values[metric].toFixed(labMetricLabels[metric].digits)}${metric === 'plateau' && !snapshot.plateauValid ? ' *' : ''}`
}

export function MechanicalVentilationLearningActivity({
  unit,
  locale = 'en',
}: {
  readonly unit: VentilationLearningUnit
  readonly locale?: string
}) {
  const lab = useVentilationLabProgress()
  const learning = useVentilationLearningProgress()
  if (!lab.ready || !learning.ready)
    return (
      <div className={styles.lab}>
        <p className={styles.banner} role="status">
          Preparing your live patient…
        </p>
      </div>
    )
  return (
    <LiveLearningUnit
      key={unit.id}
      unit={unit}
      locale={locale}
      saved={lab.progress.units[unit.id]}
      progress={lab.progress}
      save={lab.save}
      storageAvailable={lab.storageAvailable}
      initialGuided={!hasFocusedGuidance(learning.progress, unit.objective)}
    />
  )
}

function LiveLearningUnit({
  unit,
  locale,
  saved,
  progress,
  save,
  storageAvailable,
  initialGuided,
}: {
  unit: VentilationLearningUnit
  locale: string
  saved?: LabCheckpoint
  progress: LabProgress
  save: (record: LabCheckpoint) => void
  storageAvailable: boolean
  initialGuided: boolean
}) {
  const [session, dispatch] = useReducer(learningLabReducer, saved, (record) =>
    createLabSession(
      unit.id,
      ventilatorDeviceProfiles.find(
        (device) => device.id === readPreference('ventilation-learning-device'),
      )?.id ?? 'hamilton-c6',
      record,
    ),
  )
  const [guided, setGuided] = useState(() => {
    const preference = readPreference('ventilation-learning-guidance')
    return preference === 'guided' ? true : preference === 'independent' ? false : initialGuided
  })
  const [choice, setChoice] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<'sure' | 'unsure'>('unsure')
  const [demonstrating, setDemonstrating] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const sessionRef = useRef(session)
  const phaseHeading = useRef<HTMLHeadingElement>(null)
  const coach = useRef<HTMLElement>(null)
  const previousPhase = useRef(`${session.round}:${session.phase}`)
  const [resumed] = useState(!!saved)
  const experiment = ventilationExperimentByUnit.get(unit.id)!
  const round = experiment.rounds[session.round]
  const evidence = session.evidence[session.round]
  const state = session.simulation
  const current = labSnapshot(state)
  const index = ventilationLearningUnits.findIndex((u) => u.id === unit.id)
  const stage = ventilationStages.find((s) => s.id === unit.stage)!
  const completed = ventilationLearningUnits.filter((u) => progress.units[u.id]?.completedAt).length
  const next =
    ventilationLearningUnits.slice(index + 1).find((u) => !progress.units[u.id]?.completedAt) ??
    ventilationLearningUnits.find((u) => u.id !== unit.id && !progress.units[u.id]?.completedAt)
  const canCompare = labReadyToCompare(session)
  const pendingResponseSeconds = Math.max(
    0,
    ...state.interventions
      .filter((record) =>
        round.goals.some(
          (goal) => goal.type === 'intervention' && goal.id === record.interventionId,
        ),
      )
      .map((record) => record.effectiveAt - state.simulationTime),
  )
  const waited =
    session.readySince === null ? 0 : Math.max(0, state.simulationTime - session.readySince)
  const engine = useCallback(
    (action: VentilationAction) => dispatch({ type: 'ENGINE', action }),
    [],
  )
  const therapyEnabled = session.phase !== 'predict'

  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => engine({ type: 'SET_PAUSED', paused: true }), 0)
    return () => window.clearTimeout(timer)
  }, [engine, session.round, session.phase])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') engine({ type: 'TICK', seconds: 0.1 })
    }, 100)
    const hide = () => {
      if (document.visibilityState !== 'visible') engine({ type: 'SET_PAUSED', paused: true })
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [engine])
  // Keep the event timeline and both observations. Reload reconstructs the same patient, paused.
  const saveBucket = Math.floor(state.simulationTime / 5)
  useEffect(() => {
    save(labCheckpoint(sessionRef.current))
  }, [
    save,
    saveBucket,
    session.round,
    session.phase,
    session.events.length,
    session.device,
    evidence.reflection,
  ])
  useEffect(() => {
    const persist = () => save(labCheckpoint(sessionRef.current))
    window.addEventListener('pagehide', persist)
    return () => {
      window.removeEventListener('pagehide', persist)
      persist()
    }
  }, [save])
  useEffect(() => {
    const phase = `${session.round}:${session.phase}`
    if (previousPhase.current !== phase) {
      phaseHeading.current?.focus({ preventScroll: true })
      if (coach.current) coach.current.scrollTop = 0
      previousPhase.current = phase
    }
  }, [session.round, session.phase])
  useEffect(() => {
    if (
      demonstrating &&
      session.phase === 'explore' &&
      round.goals.some((g) => g.type === 'pause-expiration') &&
      state.simulationTime >= 4
    ) {
      const sample = state.waveforms.at(-1)
      if (sample?.phase === 'expiration' && sample.flowLMin < -0.1 && !state.paused)
        engine({ type: 'SET_PAUSED', paused: true })
    }
  }, [
    demonstrating,
    session.phase,
    round.goals,
    state.simulationTime,
    state.waveforms,
    state.paused,
    engine,
  ])

  function beginPrediction() {
    setDemonstrating(false)
    setChoice(null)
    setConfidence('unsure')
    dispatch({ type: 'PREDICT' })
  }
  function chooseGuidance(guided: boolean) {
    setGuided(guided)
    savePreference('ventilation-learning-guidance', guided ? 'guided' : 'independent')
  }
  function demonstrate() {
    setDemonstrating(true)
    engine({ type: 'SET_PAUSED', paused: false })
    for (const goal of round.goals) {
      const action = labGoalAction(goal)
      if (action) engine(action)
    }
  }
  function continueRound() {
    setDemonstrating(false)
    setChoice(null)
    dispatch({ type: 'CONTINUE', now: new Date().toISOString() })
  }

  return (
    <div
      className={styles.lab}
      data-ventilation-learning-unit={unit.id}
      data-lab-phase={session.phase}
    >
      <header className={styles.header}>
        <div className={styles.brand}>
          <Activity size={26} aria-hidden="true" />
          <div>
            <p className={styles.eyebrow}>Mechanical ventilation · Live learning</p>
            <h1>{unit.title}</h1>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Ventilation learning navigation">
          <button onClick={() => setMapOpen(true)}>
            <List size={15} aria-hidden="true" />
            Learning map{' '}
            <span>
              {completed}/{ventilationLearningUnits.length}
            </span>
          </button>
          <Link href={'/mechanical-ventilation/practice' as Route}>Clinical cases</Link>
        </nav>
      </header>
      {!storageAvailable && (
        <p className={styles.banner} role="status">
          Saving is unavailable in this browser. Keep this page open to retain your experiment.
        </p>
      )}
      {session.events.length >= 512 && (
        <p className={styles.banner} role="status">
          This exploration record is full. Use Reset patient to continue with a fresh comparison.
        </p>
      )}
      {state.simulationTime >= 900 && (
        <p className={styles.banner} role="status">
          This patient has run for 15 simulated minutes. Reset patient for another comparison.
        </p>
      )}
      {locale !== 'en' && (
        <p className={styles.banner}>Clinical teaching content is currently in English.</p>
      )}
      <div className={styles.mobileMission}>
        <strong>
          {session.round === 0 ? 'Explore' : 'Transfer'} · {round.title}
        </strong>
        <span>{session.phase === 'experiment' ? round.task : round.introduction}</span>
        <a href="#lab-coaching">Open experiment controls ↓</a>
      </div>
      <div className={styles.workspace}>
        <div className={styles.machine} id="lab-monitor">
          <div className={styles.toolbar}>
            <div className={styles.transport}>
              <span className={styles.live} data-paused={state.paused}>
                <span className={styles.dot} />
                {state.paused ? 'PAUSED' : 'LIVE PATIENT'}
              </span>
              <button
                onClick={() => engine({ type: 'SET_PAUSED', paused: !state.paused })}
                aria-label={state.paused ? 'Run simulation' : 'Pause simulation'}
              >
                {state.paused ? (
                  <Play size={14} aria-hidden="true" />
                ) : (
                  <Pause size={14} aria-hidden="true" />
                )}
                {state.paused ? 'Run' : 'Pause'}
              </button>
              <button onClick={() => engine({ type: 'STEP_BREATH' })}>
                <SkipForward size={14} aria-hidden="true" />
                Advance one breath
              </button>
              <select
                aria-label="Simulation speed"
                value={state.speed}
                onChange={(event) =>
                  engine({ type: 'SET_SPEED', speed: Number(event.target.value) as 1 | 5 })
                }
              >
                <option value={1}>1× time</option>
                <option value={5}>5× time</option>
              </select>
              <span className={styles.clock}>
                {Math.floor(state.simulationTime / 60)}:
                {String(Math.floor(state.simulationTime % 60)).padStart(2, '0')} simulated
              </span>
            </div>
            <button
              className={styles.reset}
              onClick={() => {
                setDemonstrating(false)
                dispatch({ type: 'RESET' })
              }}
            >
              <RotateCcw size={13} aria-hidden="true" />
              Reset patient
            </button>
          </div>
          <div
            className={styles.console}
            data-mv-density="laptop"
            data-live-learning="true"
            data-testid="live-learning-console"
          >
            <MechanicalVentilatorConsole
              state={state}
              dispatch={engine}
              controlsEnabled={therapyEnabled}
            />
          </div>
          <dl className={styles.meters} aria-label="Live observations">
            {round.watch.map((metric) => (
              <div key={metric} className={styles.meter} data-metric={metric}>
                <dt>{labMetricLabels[metric].label}</dt>
                <dd>
                  {metricValue(current, metric)}
                  <small>{labMetricLabels[metric].unit}</small>
                </dd>
              </div>
            ))}
          </dl>
          {round.watch.includes('plateau') && (
            <p className={styles.note}>
              Plateau is a modeled readout. Perform a hold and inspect effort before interpreting
              mechanics.
              {!current.plateauValid &&
                ' * Recent effort prevents a passive pressure interpretation.'}
            </p>
          )}
          <details className={styles.patient}>
            <summary className={styles.patientSummary}>
              Patient and circuit findings ·{' '}
              {round.caseId === 'MV-LAB'
                ? 'Passive teaching patient'
                : `Original case ${round.caseId}`}
            </summary>
            <BedsidePanel
              state={state}
              definition={resolveVentilationSimulationCase(round.caseId)}
              compact
            />
          </details>
        </div>

        <aside
          ref={coach}
          className={styles.coach}
          id="lab-coaching"
          aria-label="Experiment coaching"
        >
          <a className={styles.mobileReturn} href="#lab-monitor">
            ↑ Back to the live monitor
          </a>
          <div className={styles.coachHeader}>
            <p className={styles.eyebrow}>
              {stage.title} · Unit {index + 1} of {ventilationLearningUnits.length}
            </p>
            <h2 ref={phaseHeading} tabIndex={-1}>
              {round.title}
            </h2>
            <div className={styles.rounds} aria-label="Experiments">
              <span aria-current={session.round === 0 ? 'step' : undefined}>
                1 · Explore the relationship
              </span>
              <span aria-current={session.round === 1 ? 'step' : undefined}>2 · Test it again</span>
            </div>
          </div>
          <LiveControls session={session} engine={engine} enabled={therapyEnabled} />
          <ol className={styles.steps} aria-label="Experiment steps">
            {(['explore', 'predict', 'experiment', 'compare'] as const).map((p, i) => (
              <li key={p} aria-current={session.phase === p ? 'step' : undefined}>
                {i + 1}.{' '}
                {p === 'experiment'
                  ? 'Change'
                  : p === 'compare'
                    ? 'Explain'
                    : p[0].toUpperCase() + p.slice(1)}
              </li>
            ))}
          </ol>
          <div className={styles.coachBody}>
            {session.phase === 'explore' && (
              <>
                <p>{round.introduction}</p>
                {resumed && state.paused && (
                  <p className={styles.note}>
                    Your patient is restored and paused. Press Run when ready.
                  </p>
                )}
                <div className={styles.support} aria-label="Amount of guidance">
                  <button aria-pressed={guided} onClick={() => chooseGuidance(true)}>
                    Guide me
                  </button>
                  <button aria-pressed={!guided} onClick={() => chooseGuidance(false)}>
                    I have experience
                  </button>
                </div>
                {guided && (
                  <div className={styles.look}>
                    <strong>Watch one breath</strong>
                    {round.look}
                  </div>
                )}
                <p className={styles.note}>
                  The controls are live. Explore freely, then start from a fresh baseline for the
                  experiment.
                </p>
                {guided && (
                  <button className={`${styles.secondary} ${styles.full}`} onClick={demonstrate}>
                    Demonstrate this change on the ventilator
                  </button>
                )}
                {demonstrating && (
                  <div className={styles.look}>
                    <strong>Live demonstration</strong>
                    {round.task}
                    <p>{round.explanation}</p>
                  </div>
                )}
                <div className={styles.actions}>
                  <button className={`${styles.primary} ${styles.full}`} onClick={beginPrediction}>
                    Try the experiment <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
            {session.phase === 'predict' && (
              <>
                <fieldset className={styles.choices}>
                  <legend>{round.prompt}</legend>
                  {round.choices.map((answer, i) => (
                    <label key={answer} className={styles.choice}>
                      <input
                        type="radio"
                        name="live-prediction"
                        checked={choice === i}
                        onChange={() => setChoice(i)}
                      />
                      {answer}
                    </label>
                  ))}
                </fieldset>
                <div className={styles.support} aria-label="Prediction confidence">
                  <button
                    aria-pressed={confidence === 'unsure'}
                    onClick={() => setConfidence('unsure')}
                  >
                    Still working it out
                  </button>
                  <button
                    aria-pressed={confidence === 'sure'}
                    onClick={() => setConfidence('sure')}
                  >
                    Confident
                  </button>
                </div>
                <p className={styles.note}>
                  The baseline keeps running. Commit your prediction to unlock the controls.
                </p>
                <button
                  className={`${styles.primary} ${styles.full}`}
                  disabled={choice === null}
                  onClick={() =>
                    choice !== null && dispatch({ type: 'COMMIT', choice, confidence })
                  }
                >
                  Commit prediction & take the controls <ArrowRight size={15} aria-hidden="true" />
                </button>
              </>
            )}
            {session.phase === 'experiment' && (
              <>
                <h3>Make the change. Watch the patient.</h3>
                <p>{round.task}</p>
                {guided && (
                  <div className={styles.look}>
                    <strong>Keep your eye on</strong>
                    {round.look}
                  </div>
                )}
                <ul className={styles.goalList} aria-label="Observed experiment actions">
                  {round.goals.map((goal, i) => (
                    <li key={i} data-done={labGoalMet(goal, session)}>
                      {labGoalMet(goal, session) ? (
                        <Check size={16} aria-label="Observed" />
                      ) : (
                        <Circle size={16} aria-label="Pending" />
                      )}
                      {goalLabel(goal)}
                    </li>
                  ))}
                </ul>
                <div className={styles.actions}>
                  {round.goals
                    .filter((g) => g.type === 'hold' || g.type === 'intervention')
                    .map((goal, i) => (
                      <button
                        key={i}
                        className={styles.secondary}
                        onClick={() => {
                          const command = labGoalAction(goal)
                          if (command) {
                            engine({ type: 'SET_PAUSED', paused: false })
                            engine(command)
                          }
                        }}
                      >
                        {goal.type === 'hold'
                          ? `Perform ${goal.hold} hold`
                          : goal.type === 'intervention'
                            ? actionLabels[goal.id]
                            : ''}
                      </button>
                    ))}
                </div>
                <div className={styles.wait} role="status">
                  {canCompare
                    ? 'Your response is ready to compare.'
                    : session.readySince === null
                      ? pendingResponseSeconds > 0
                        ? `Intervention selected. Modeled response begins in ${Math.ceil(pendingResponseSeconds)} simulated seconds.${state.paused ? ' Press Run to continue.' : ''}`
                        : 'Use the live controls above. The observation period starts after the actions occur.'
                      : `Observe ${Math.min(round.seconds, Math.floor(waited))} of ${round.seconds} simulated seconds.${state.paused ? ' Press Run to continue observing.' : ''}`}
                  {round.seconds > 0 && (
                    <progress
                      value={Math.min(waited, round.seconds)}
                      max={round.seconds}
                      aria-label="Patient response observation"
                    />
                  )}
                </div>
                <div className={styles.actions}>
                  <button
                    className={`${styles.primary} ${styles.full}`}
                    disabled={!canCompare}
                    onClick={() => dispatch({ type: 'COMPARE' })}
                  >
                    Compare the response <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
            {session.phase === 'compare' && evidence.baseline && evidence.response && (
              <>
                <div
                  className={styles.feedback}
                  data-correct={evidence.prediction === round.correct}
                >
                  <strong>
                    {evidence.prediction === round.correct
                      ? 'Your prediction fits the intended relationship.'
                      : 'Update your prediction with what you observed.'}
                  </strong>
                  <p>You predicted: {round.choices[evidence.prediction!]}</p>
                  <p>{round.rationales[evidence.prediction!]}</p>
                </div>
                <Comparison
                  before={evidence.baseline}
                  after={evidence.response}
                  metrics={round.watch}
                />
                <p>{round.explanation}</p>
                <label className={styles.reflection}>
                  What changed, and what does it tell you?
                  <textarea
                    value={evidence.reflection ?? ''}
                    onChange={(event) => dispatch({ type: 'REFLECT', text: event.target.value })}
                    maxLength={1200}
                    placeholder="Connect a change you made with a response you saw."
                  />
                </label>
                <p className={styles.note}>
                  Save a brief observation (at least 12 characters). This is your reasoning record;
                  it is not automatically graded.
                </p>
                <div className={styles.actions}>
                  <button
                    className={`${styles.primary} ${styles.full}`}
                    disabled={(evidence.reflection?.trim().length ?? 0) < 12}
                    onClick={continueRound}
                  >
                    {session.round === 0
                      ? 'Test the relationship in the next setup'
                      : 'Finish these experiments'}{' '}
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
            {session.phase === 'complete' && (
              <>
                <h3>Two experiments. One relationship to carry forward.</h3>
                <p>{unit.outcome}</p>
                {session.evidence.map((record, i) => (
                  <div key={i} className={styles.look}>
                    <strong>{experiment.rounds[i].title}</strong>
                    {record.reflection}
                  </div>
                ))}
                <p className={styles.note}>
                  Your predictions, observed responses, and explanations are saved on this device.
                  This records learning activity, not clinical competence.
                </p>
                <Link
                  className={`${styles.primary} ${styles.full}`}
                  href={
                    (next
                      ? ventilationUnitHref(next.id)
                      : '/mechanical-ventilation/assess') as Route
                  }
                >
                  {next ? `Next · ${next.shortTitle}` : 'Continue to the final knowledge check'}{' '}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <div className={styles.actions}>
                  <Link className={styles.link} href={'/mechanical-ventilation/practice' as Route}>
                    Try an original clinical case
                  </Link>
                </div>
              </>
            )}
          </div>
          {session.phase !== 'predict' && (
            <>
              <details className={styles.detail}>
                <summary>Explain the physiology on this ventilator</summary>
                <div className={styles.teaching}>
                  <MechanicalVentilationTeachingPanel
                    lessonId={experiment.panelId}
                    state={state}
                    dispatch={engine}
                  />
                  {unit.id === 'lung-protection' && <VentilationProtectionReference />}
                </div>
              </details>
              {evidence.baseline && (
                <details className={styles.detail}>
                  <summary>Compare saved tracings</summary>
                  <SavedTraces before={evidence.baseline} after={evidence.response} />
                </details>
              )}
              <div className={styles.detail}>
                <VentilationLearningSources evidenceIds={unit.evidenceIds} />
              </div>
            </>
          )}
        </aside>
      </div>
      <footer className={styles.footer}>
        <span>
          Authored adult teaching models · Responses depend on this simulator’s assumptions
        </span>
        <span>Educational use · No certification of bedside competence</span>
      </footer>
      <LearningMap
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        unit={unit}
        progress={progress}
        session={session}
        dispatch={dispatch}
      />
    </div>
  )
}

function LiveControls({
  session,
  engine,
  enabled,
}: {
  session: LabSession
  engine: Dispatch<VentilationAction>
  enabled: boolean
}) {
  const goals = ventilationExperimentByUnit.get(session.unitId)!.rounds[session.round].goals
  const controlGoals = goals.filter(
    (g): g is Extract<LabGoal, { type: 'control' }> => g.type === 'control',
  )
  return (
    <section className={styles.controls} aria-label="Live experiment controls">
      <div className={styles.controlsHeading}>
        <h2>Change the system</h2>
        <span>
          {enabled ? 'Watch the next breaths respond' : 'Commit your prediction to adjust'}
        </span>
      </div>
      <div className={styles.sliders}>
        {controlGoals.map((goal) => {
          const c = labControls[goal.key]
          if (!c) return null
          const value = labControlValue(session.simulation, goal.key)
          return (
            <div className={styles.slider} key={goal.key}>
              <label htmlFor={`lab-${goal.key}`}>
                {c.label}
                <output>
                  {value} {c.unit}
                </output>
              </label>
              <input
                id={`lab-${goal.key}`}
                type="range"
                min={c.min}
                max={c.max}
                step={c.step}
                value={value}
                disabled={!enabled}
                onChange={(event) =>
                  engine({
                    type: 'SET_CONTROL',
                    control: goal.key,
                    value: Number(event.target.value),
                  })
                }
              />
              <small>
                <span>
                  {c.min} {c.unit}
                </span>
                <span>
                  {c.max} {c.unit}
                </span>
              </small>
            </div>
          )
        })}
        {(session.unitId !== 'high-peak-pressure-integration' ||
          ['compare', 'complete'].includes(session.phase)) &&
          (['complianceScale', 'resistanceScale'] as const).map((key) => (
            <div key={key} className={styles.slider}>
              <label htmlFor={`lab-${key}`}>
                {key === 'complianceScale' ? 'Patient compliance' : 'Patient resistance'}
                <output>{session.simulation.teachingMechanics[key].toFixed(2)}×</output>
              </label>
              <input
                id={`lab-${key}`}
                type="range"
                min={0.25}
                max={4}
                step={0.05}
                value={session.simulation.teachingMechanics[key]}
                disabled={!enabled}
                onChange={(event) =>
                  engine({
                    type: 'SET_TEACHING_MECHANICS',
                    overrides: { [key]: Number(event.target.value) },
                  })
                }
              />
              <small>
                <span>{key === 'complianceScale' ? 'Stiffer' : 'Less resistance'}</span>
                <span>{key === 'complianceScale' ? 'More compliant' : 'More resistance'}</span>
              </small>
            </div>
          ))}
      </div>
      <p className={styles.note}>
        These teaching sliders change the same simulation as the device. Patient sliders scale
        baseline mechanics; they are not ventilator settings. Reset patient to repeat the
        comparison.
      </p>
    </section>
  )
}

function Comparison({
  before,
  after,
  metrics,
}: {
  before: LabSnapshot
  after: LabSnapshot
  metrics: readonly LabMetric[]
}) {
  return (
    <>
      <table className={styles.compare}>
        <caption>Recorded response from your experiment</caption>
        <thead>
          <tr>
            <th scope="col">Observation</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric}>
              <th scope="row">
                {labMetricLabels[metric].label}
                <br />
                {labMetricLabels[metric].unit}
              </th>
              <td>{metricValue(before, metric)}</td>
              <td>{metricValue(after, metric)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {metrics.includes('plateau') && (!before.plateauValid || !after.plateauValid) && (
        <p className={styles.note}>
          * Recent patient effort prevents a passive mechanics interpretation. The displayed
          pressure is retained for comparison.
        </p>
      )}
    </>
  )
}
function SavedTraces({ before, after }: { before: LabSnapshot; after?: LabSnapshot }) {
  const [field, setField] = useState<'pawCmH2O' | 'flowLMin' | 'volumeMl'>('pawCmH2O')
  const selected =
    field === 'pawCmH2O'
      ? { label: 'Pressure', unit: 'cmH₂O', minimum: -5, maximum: 60 }
      : field === 'flowLMin'
        ? { label: 'Flow', unit: 'L/min', minimum: -100, maximum: 100 }
        : { label: 'Volume', unit: 'mL', minimum: 0, maximum: 1000 }
  return (
    <div className={styles.reference}>
      <select
        aria-label="Saved waveform channel"
        value={field}
        onChange={(e) => setField(e.target.value as typeof field)}
      >
        <option value="pawCmH2O">Pressure</option>
        <option value="flowLMin">Flow</option>
        <option value="volumeMl">Volume</option>
      </select>
      <h3>Before your change</h3>
      <WaveformStrip samples={before.waveforms} field={field} {...selected} />
      {after && (
        <>
          <h3>After your change</h3>
          <WaveformStrip samples={after.waveforms} field={field} {...selected} />
        </>
      )}
      <p className={styles.note}>Saved engine tracings, displayed on the same scale.</p>
    </div>
  )
}

function LearningMap({
  open,
  onClose,
  unit,
  progress,
  session,
  dispatch,
}: {
  open: boolean
  onClose: () => void
  unit: VentilationLearningUnit
  progress: LabProgress
  session: LabSession
  dispatch: Dispatch<LabAction>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  return (
    <dialog
      ref={dialog}
      className={styles.drawer}
      aria-labelledby="learning-map-title"
      onClose={onClose}
    >
      <div className={styles.drawerHeader}>
        <div>
          <p className={styles.eyebrow}>A course built around the ventilator</p>
          <h2 id="learning-map-title">Learning map</h2>
        </div>
        <button className={styles.secondary} onClick={onClose} aria-label="Close learning map">
          <X size={18} />
        </button>
      </div>
      <p>
        Start with a running supported breath. Change one variable, observe the response, then test
        the idea in a different setup.
      </p>
      <p className={styles.note}>
        For residents, fellows, and ICU clinicians. Assumes basic respiratory anatomy and blood
        gases. About {ventilationCourseMinutes} minutes, in short experiments.
      </p>
      <details className={styles.detail}>
        <summary>What this course develops</summary>
        <ul>
          {ventilationObjectives.map((objective) => (
            <li key={objective.id}>{objective.description}</li>
          ))}
        </ul>
      </details>
      <p>
        <Link
          className={styles.link}
          href={'/mechanical-ventilation/learn?entry=placement' as Route}
        >
          Have experience? Check your starting level
        </Link>
      </p>
      <label className={styles.deviceChoice}>
        Training device
        <select
          value={session.device}
          onChange={(e) => {
            savePreference('ventilation-learning-device', e.target.value)
            dispatch({ type: 'DEVICE', device: e.target.value as LabSession['device'] })
          }}
        >
          {ventilatorDeviceProfiles.map((d) => (
            <option key={d.id} value={d.id}>
              {d.displayName}
            </option>
          ))}
        </select>
        <small>Changing device restarts the current unit’s experiments.</small>
      </label>
      {ventilationStages.map((stage) => (
        <section key={stage.id}>
          <h3>{stage.title}</h3>
          {ventilationLearningUnits
            .filter((u) => u.stage === stage.id)
            .map((u) => (
              <Link
                key={u.id}
                href={ventilationUnitHref(u.id) as Route}
                className={styles.unitLink}
                aria-current={u.id === unit.id ? 'page' : undefined}
                onClick={onClose}
              >
                <span>
                  {u.shortTitle}
                  <small>{u.outcome}</small>
                </span>
                {progress.units[u.id]?.completedAt ? (
                  <Check size={17} aria-label="Experiments complete" />
                ) : (
                  <span>{u.minutes} min</span>
                )}
              </Link>
            ))}
        </section>
      ))}
      <Link
        className={`${styles.secondary} ${styles.full}`}
        href={'/mechanical-ventilation/assess' as Route}
      >
        Final knowledge check
      </Link>
      <p>
        <Link className={styles.link} href={'/mechanical-ventilation/learn?entry=review' as Route}>
          Review earlier concepts
        </Link>
      </p>
      <p className={styles.note}>
        Progress is saved in this browser. Completing both live experiments in every unit unlocks
        the final knowledge check.
      </p>
    </dialog>
  )
}
