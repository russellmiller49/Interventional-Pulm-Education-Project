'use client'

import { useEffect, useId, useState, type Dispatch } from 'react'
import {
  inspectionFigureState,
  ventilationExperimentStatus,
  type ExperimentGoalState,
  type ExperimentStage,
} from '../../content/experimentStatus'
import { ventilationReferenceMarker } from '../../content/referenceEvidence'
import type { LabAction, LabSession } from '../../engine/learningLab'
import type { VentilationAction } from '../../engine/types'
import { CapturedBreath } from './CapturedBreath'
import styles from './task-flow.module.css'

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
const STAGE_CHIP: Record<ExperimentStage, string> = {
  'not-started': 'Not started',
  'awaiting-action': 'Waiting for your change',
  'awaiting-measurement': 'Waiting for the measurement',
  'awaiting-effect': 'Waiting for the effect',
  'awaiting-interval': 'Response interval',
  ready: 'Ready to capture',
  captured: 'Captured',
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The experiment, operated where it is described.
 *
 * Run and Pause, one breath, the clock speed, what is still needed, the response interval and the
 * capture sit together under the instruction, so the learner never has to find Run somewhere else
 * (walkthrough N7). A setting edit never starts the run: Run experiment is the only thing that does.
 *
 * Automatic capture is off until the learner turns it on for this experiment. It then fires only
 * when `labReadyToCompare` — the same gate the Capture button uses — is true, which already requires
 * the right round and patient, every requested change or hold in place under the current
 * conditions, and the round's interval elapsed in model time. It never fires on a comparison that no
 * longer isolates one change; that one is left for the learner to capture or reset. It is an effect
 * of the session changing, so it runs only when model time actually advances (Run, one breath) and
 * does nothing while the page is hidden and paused. The panel is remounted on reset, device change
 * and a new application, which also turns the option off again.
 *
 * It trusts the gate rather than the page: a background suspension pauses the model with its origin
 * on the action, the lab records no inspection for it, so the gate stays closed and there is
 * nothing here to suppress — while the page is hidden or after it comes back.
 */
export function VentilationExperimentPanel({
  session,
  lab,
  engine,
}: {
  readonly session: LabSession
  readonly lab: Dispatch<LabAction>
  readonly engine: Dispatch<VentilationAction>
}) {
  const headingId = useId()
  const status = ventilationExperimentStatus(session)
  const evidence = session.evidence[session.round]
  const state = session.simulation
  const confounds = session.confounds ?? []
  const [autoCapture, setAutoCapture] = useState(false)
  /*
   * An interval that stops because the requested change was undone is a transition worth saying
   * out loud; it is derived from the previous stage during render (React's "store information from
   * previous renders" pattern), not from a listener.
   */
  const [previousStage, setPreviousStage] = useState<ExperimentStage>(status.stage)
  const [interrupted, setInterrupted] = useState(false)
  if (previousStage !== status.stage) {
    setPreviousStage(status.stage)
    setInterrupted(
      (previousStage === 'awaiting-interval' || previousStage === 'ready') &&
        status.stage === 'awaiting-action',
    )
  }

  const autoCaptureHeld = autoCapture && status.canCapture && confounds.length > 0
  useEffect(() => {
    if (autoCapture && status.canCapture && !evidence.response && confounds.length === 0)
      lab({ type: 'COMPARE' })
  }, [autoCapture, status.canCapture, evidence.response, confounds.length, lab])

  const inspectable = inspectionFigureState(session) === 'open'
  /*
   * The authored marker for this application, from the one evidence contract (Batch 01). The
   * captured baseline is the same reference breath the question was asked about, so the instruction
   * that says "interval A, marked on the captured breath" is read beside a figure that carries it.
   * It is resolved from this breath's own samples by `markerEvidence`, as everywhere else; nothing
   * is positioned here.
   */
  const marker = ventilationReferenceMarker(session.unitId, session.round)
  const announcement = interrupted
    ? 'Response interval stopped: the requested change is no longer in place.'
    : status.announcement

  return (
    <section
      className={styles.experimentPanel}
      data-experiment-panel
      data-experiment-stage={status.stage}
      data-running={status.running}
      aria-labelledby={headingId}
    >
      <div className={styles.experimentHeader}>
        <h3 id={headingId}>Experiment</h3>
        <span className={styles.stageChip} data-stage={status.stage}>
          {status.running && status.stage !== 'captured' ? 'Running · ' : ''}
          {STAGE_CHIP[status.stage]}
        </span>
      </div>
      <p data-experiment-headline>{status.headline}</p>
      {status.goals.length ? (
        <ol className={styles.goalList} aria-label="What this experiment needs">
          {status.goals.map((goal, index) => (
            <li key={index} data-goal-state={goal.state}>
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
      ) : null}
      {status.backgroundPaused && status.stage !== 'captured' && status.stage !== 'ready' ? (
        <p className={styles.boundary} data-background-pause>
          The model clock stopped because this page went to the background. That was not your pause,
          so nothing was recorded for it: no inspection and no captured result. Run the experiment
          to carry on from here.
        </p>
      ) : null}
      {interrupted ? (
        <p className={styles.boundary} data-interval-interrupted>
          The requested change is no longer in place, so the response interval stopped. Make it
          again to restart the interval.
        </p>
      ) : null}
      {status.intervalSeconds > 0 &&
      status.stage !== 'captured' &&
      status.stage !== 'not-started' ? (
        <div className={styles.interval} data-response-interval>
          <span id={`${headingId}-interval`}>
            Response interval · {(status.elapsedSeconds ?? 0).toFixed(1)} of{' '}
            {status.intervalSeconds} s of model time
          </span>
          <progress
            aria-labelledby={`${headingId}-interval`}
            max={status.intervalSeconds}
            value={status.elapsedSeconds ?? 0}
          />
        </div>
      ) : null}
      <div className={styles.tools} data-experiment-controls>
        {status.stage === 'not-started' ? (
          <button type="button" onClick={() => lab({ type: 'START_EXPERIMENT' })}>
            Start the experiment from its baseline
          </button>
        ) : null}
        <button
          type="button"
          data-run-experiment
          data-paused={state.paused}
          onClick={() => engine({ type: 'SET_PAUSED', paused: !state.paused, origin: 'learner' })}
        >
          {!state.paused
            ? 'Pause'
            : status.stage === 'captured'
              ? 'Run the patient'
              : 'Run experiment'}
        </button>
        <button type="button" onClick={() => engine({ type: 'STEP_BREATH' })}>
          Advance one breath
        </button>
        <select
          aria-label="Simulation speed"
          value={state.speed}
          onChange={(e) => engine({ type: 'SET_SPEED', speed: Number(e.target.value) as 1 | 5 })}
        >
          <option value={1}>1× time</option>
          <option value={5}>5× time</option>
        </select>
        <span className={styles.note} aria-live="off" data-model-time>
          Model time {state.simulationTime.toFixed(1)} s
        </span>
      </div>
      <div className={styles.tools} data-capture-controls>
        <button
          type="button"
          data-capture-result
          disabled={!status.canCapture}
          onClick={() => lab({ type: 'COMPARE' })}
        >
          {evidence.response ? 'Result captured' : 'Capture result'}
        </button>
        {status.stage !== 'captured' ? (
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoCapture}
              onChange={(e) => setAutoCapture(e.target.checked)}
            />
            Capture automatically when the result is ready
          </label>
        ) : null}
      </div>
      {inspectable ? (
        <CapturedBreath
          label={
            marker
              ? `Captured baseline breath · interval ${marker.markerId} marked · select an interval to inspect`
              : 'Baseline reference · select an interval to inspect'
          }
          samples={evidence.baseline!.waveforms}
          marker={marker ?? undefined}
          onInspect={(sample) => lab({ type: 'INSPECT', sampleTime: sample.time })}
        />
      ) : null}
      {autoCaptureHeld ? (
        <p className={styles.boundary} data-auto-capture-held>
          Automatic capture is held: this comparison no longer isolates one change. Capture it
          yourself if you still want it, or reset the patient for a clean repeat.
        </p>
      ) : null}
      {status.intervalSeconds > 0 && status.stage !== 'captured' ? (
        <p className={styles.note}>
          The comparison needs {status.intervalSeconds} s of model time after everything requested
          is in place. Model time moves only while the experiment runs or when you advance one
          breath; 5× time only makes model time pass faster.
        </p>
      ) : null}
      <p className={styles.srOnly} role="status" aria-live="polite" data-experiment-announcement>
        {announcement}
      </p>
    </section>
  )
}
