'use client'

import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import {
  classifyDynamicResponse,
  dynamicResponseDefinitions,
  getDynamicResponseDefinition,
} from '../../content/pressureSystemVisuals'
import { DYNAMIC_RESPONSE_REFERENCE } from '../../engine/waveformArtifacts'
import {
  DYNAMIC_RESPONSE_CLASSIFIED_CHECK,
  DYNAMIC_RESPONSE_CORRECTED_CHECK,
  LEVEL_TOLERANCE_CM,
  standardTechnique,
} from '../../engine/stageRuntime'
import { WEDGE_AUTO_DEFLATION_SECONDS } from '../../engine/simulation'
import { thermodilutionAcceptedAverage } from '../../engine/thermodilution'
import type {
  DynamicResponseKind,
  FastFlushLineType,
  HemodynamicAction,
  HemodynamicSimulationState,
} from '../../engine/types'
import { FastFlushTrace } from '../PressureSystemTeachingVisual'
import { ThermodilutionSeriesReadout, ThermodilutionTrialCard } from '../ThermodilutionTrialReview'
import styles from './hemodynamics-stage.module.css'

/**
 * The controls a lesson step opens beneath the monitor.
 *
 * Each dock is one of the five things the control panel says a learner can change, or one of the
 * three checks it says they can run, and nothing else: no reference prose, no verdict, no
 * troubleshooting table. What a control does is said beside it in one line, in the words the
 * control panel uses. Everything here dispatches to the one engine; nothing here decides whether
 * a step is done — the host reads that from the state.
 */

export interface DockProps {
  readonly state: HemodynamicSimulationState
  readonly dispatch: Dispatch<HemodynamicAction>
  readonly enabled: boolean
}

export function quickControlId(key: string): string {
  return `hemodynamics-control-${key}`
}

/* ------------------------------------------------------------------ *
 * The line: level, zero, scale
 * ------------------------------------------------------------------ */

export function LineDock({ state, dispatch, enabled }: DockProps) {
  const level = state.measurementSystem.transducerLevelCm
  const levelled = Math.abs(level) <= LEVEL_TOLERANCE_CM
  return (
    <fieldset className={styles.dock} disabled={!enabled} data-dock="line">
      <legend>The line</legend>
      <div className={styles.dockRow}>
        <label htmlFor={quickControlId('level')}>
          <span>Where the transducer sits</span>
          <small>
            {levelled
              ? 'At the reference height.'
              : level > 0
                ? 'Above the reference: every pressure reads low.'
                : 'Below the reference: every pressure reads high.'}
          </small>
        </label>
        <div className={styles.slider}>
          <input
            id={quickControlId('level')}
            type="range"
            min={-20}
            max={20}
            step={1}
            value={level}
            aria-valuetext={`${level > 0 ? '+' : ''}${level} cm from the reference`}
            onChange={(event) =>
              dispatch({ type: 'SET_TRANSDUCER_LEVEL', levelCm: Number(event.target.value) })
            }
          />
          <output htmlFor={quickControlId('level')} data-level-readout>
            {level > 0 ? '+' : ''}
            {level} cm
          </output>
        </div>
      </div>
      <div className={styles.dockRow}>
        <div>
          <span>What it calls zero</span>
          <small>
            {state.measurementSystem.zeroed
              ? 'Zeroed to air. Level is a separate step.'
              : 'Not yet zeroed: the reference has not been set.'}
          </small>
        </div>
        <button
          id={quickControlId('zero')}
          type="button"
          className={styles.dockButton}
          onClick={() => dispatch({ type: 'ZERO_TRANSDUCER' })}
          disabled={state.measurementSystem.zeroed}
        >
          {state.measurementSystem.zeroed ? 'Zeroed' : 'Open to air and zero'}
        </button>
      </div>
      <div className={styles.dockRow}>
        <label htmlFor={quickControlId('scale')}>
          <span>The display scale</span>
          <small>Changes how large the arterial tracing is drawn, and nothing underneath it.</small>
        </label>
        <select
          id={quickControlId('scale')}
          value={state.pressureScaleMmHg}
          onChange={(event) =>
            dispatch({
              type: 'SET_PRESSURE_SCALE',
              maximum: Number(event.target.value) as 40 | 80 | 160 | 240,
            })
          }
        >
          {[40, 80, 160, 240].map((scale) => (
            <option key={scale} value={scale}>
              0–{scale} mmHg
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  )
}

/* ------------------------------------------------------------------ *
 * The flush check: run, read, say, repair
 * ------------------------------------------------------------------ */

export function FlushDock({
  state,
  dispatch,
  enabled,
  lineType,
}: DockProps & { readonly lineType: FastFlushLineType }) {
  const [hasRun, setHasRun] = useState(false)
  const [observed, setObserved] = useState<DynamicResponseKind | null>(null)
  const [classification, setClassification] = useState<DynamicResponseKind | null>(null)
  const [revealed, setRevealed] = useState(false)
  const groupId = useId()
  const current = classifyDynamicResponse(state.measurementSystem)
  const response = observed ?? current
  const definition = getDynamicResponseDefinition(response)
  const classified = state.signalValidationChecks.includes(DYNAMIC_RESPONSE_CLASSIFIED_CHECK)
  const corrected =
    state.signalValidationChecks.includes(DYNAMIC_RESPONSE_CORRECTED_CHECK) ||
    (state.measurementSystem.artifact === 'none' &&
      state.measurementSystem.dampingRatio >= DYNAMIC_RESPONSE_REFERENCE.underdampedBelow &&
      state.measurementSystem.dampingRatio <= DYNAMIC_RESPONSE_REFERENCE.overdampedAbove)
  const paUnsafe =
    lineType === 'pulmonary-artery' &&
    (state.catheter.position === 'wedge' || state.catheter.balloonInflated)
  const outcome = revealed ? (classification === response ? 'correct' : 'not-correct') : null

  function run() {
    if (paUnsafe) return
    dispatch({ type: 'FAST_FLUSH', lineType })
    setObserved(classifyDynamicResponse(state.measurementSystem))
    setHasRun(true)
    setClassification(null)
    setRevealed(false)
  }

  function check() {
    if (!classification) return
    setRevealed(true)
    if (classification === response) {
      dispatch({ type: 'VALIDATE_SIGNAL', check: DYNAMIC_RESPONSE_CLASSIFIED_CHECK })
    }
  }

  function repair() {
    dispatch({ type: 'SET_DAMPING', dampingRatio: 0.65 })
    dispatch({ type: 'SET_ARTIFACT', artifact: 'none' })
    dispatch({ type: 'VALIDATE_SIGNAL', check: DYNAMIC_RESPONSE_CORRECTED_CHECK })
    setHasRun(false)
    setObserved(null)
    setClassification(null)
    setRevealed(false)
  }

  return (
    <fieldset className={styles.dock} disabled={!enabled} data-dock="flush">
      <legend>The flush check</legend>
      {lineType === 'pulmonary-artery' ? (
        <p className={styles.dockNote} role={paUnsafe ? 'alert' : undefined}>
          A flush on the pulmonary-artery line needs a confirmed artery tracing and a balloon that
          is down. Never flush a wedged catheter.
          {paUnsafe ? ' The catheter is not in that state now.' : ''}
        </p>
      ) : null}
      <div className={styles.dockRow}>
        <div>
          <span>Run a fast flush</span>
          <small>A check, not a setting: how the tracing settles is the answer.</small>
        </div>
        <button
          id={quickControlId('flush')}
          type="button"
          className={styles.dockButton}
          disabled={paUnsafe}
          onClick={run}
        >
          Flush the {lineType === 'pulmonary-artery' ? 'pulmonary-artery' : 'arterial'} line
        </button>
      </div>
      {hasRun ? (
        <>
          <FastFlushTrace response={response} lineType={lineType} revealLabel={revealed} />
          <fieldset className={styles.choiceGroup} data-flush-classification>
            <legend id={groupId}>How did it settle?</legend>
            {dynamicResponseDefinitions.map((candidate) => (
              <label key={candidate.id} data-selected={classification === candidate.id}>
                <input
                  type="radio"
                  name={`flush-${groupId}`}
                  value={candidate.id}
                  checked={classification === candidate.id}
                  disabled={classified && revealed}
                  onChange={() => {
                    setClassification(candidate.id)
                    setRevealed(false)
                  }}
                />
                <span>
                  <strong>{candidate.shortLabel}</strong>
                  <small>{candidate.observation}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {!revealed || outcome === 'not-correct' ? (
            <button
              type="button"
              className={styles.dockButton}
              disabled={!classification}
              onClick={check}
            >
              Say what it is
            </button>
          ) : null}
          {revealed ? (
            <p
              className={styles.dockVerdict}
              data-flush-outcome={outcome}
              role="status"
              aria-live="polite"
            >
              <strong>{outcome === 'correct' ? 'Correct.' : 'Not correct.'}</strong> This is{' '}
              {definition.label.toLowerCase()}. {definition.interpretation}
            </p>
          ) : null}
          {classified && response !== 'acceptable' ? (
            <div className={styles.dockRow}>
              <div>
                <span>Repair the line</span>
                <small>
                  Trace it from the patient to the transducer: air, kinks, connections, the bag.
                </small>
              </div>
              <button
                id={quickControlId('repair')}
                type="button"
                className={styles.dockButton}
                disabled={corrected}
                onClick={repair}
              >
                {corrected ? 'Repaired' : 'Repair the fluid path'}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className={styles.dockNote}>The release tracing appears here after the flush.</p>
      )}
    </fieldset>
  )
}

/* ------------------------------------------------------------------ *
 * The tip: advance and withdraw
 * ------------------------------------------------------------------ */

export function TipDock({ state, dispatch, enabled }: DockProps) {
  const moving = state.catheter.targetPosition !== null
  const atWedge = state.catheter.position === 'wedge'
  const atEnd = state.catheter.position === 'pa' || atWedge
  const atStart = state.catheter.position === 'introducer'
  return (
    <fieldset className={styles.dock} disabled={!enabled} data-dock="tip">
      <legend>The tip</legend>
      <div className={styles.dockRow}>
        <div>
          <span>Where the catheter tip is</span>
          <small>
            {moving
              ? 'Moving. The monitor keeps the last confirmed tracing until the tip arrives.'
              : atWedge
                ? 'In a wedge. Withdrawing brings the tip back to the artery.'
                : 'One stop at a time; the tracing settles after each move.'}
          </small>
        </div>
        <div className={styles.buttonPair}>
          <button
            id={quickControlId('withdraw')}
            type="button"
            className={styles.dockButton}
            disabled={moving || atStart}
            onClick={() => dispatch({ type: 'RETRACT_CATHETER' })}
          >
            Withdraw
          </button>
          <button
            id={quickControlId('advance')}
            type="button"
            className={styles.dockButton}
            disabled={moving || atEnd}
            onClick={() => dispatch({ type: 'ADVANCE_CATHETER' })}
          >
            Advance
          </button>
        </div>
      </div>
      {state.catheter.floatBalloonInflated ? (
        <p className={styles.dockNote}>
          The flow-directed balloon is up while the tip floats forward, as the manufacturer&apos;s
          instructions describe. It is not the wedge.
        </p>
      ) : null}
    </fieldset>
  )
}

/* ------------------------------------------------------------------ *
 * The wedge: occlude, cursor, store, deflate
 * ------------------------------------------------------------------ */

export function WedgeDock({ state, dispatch, enabled }: DockProps) {
  const catheter = state.catheter
  const occluding = catheter.position === 'wedge' && catheter.balloonInflated
  const elapsed =
    occluding && catheter.wedgeStartedAt !== null
      ? Math.max(0, state.timeSeconds - catheter.wedgeStartedAt)
      : 0
  const canInflate =
    catheter.position === 'pa' && catheter.targetPosition === null && !catheter.balloonInflated
  return (
    <fieldset className={styles.dock} disabled={!enabled} data-dock="wedge">
      <legend>The balloon</legend>
      <div className={styles.dockRow}>
        <div>
          <span>Whether the balloon is up</span>
          <small>
            {occluding
              ? `Up for ${elapsed.toFixed(0)} s. The simulation releases it on its own after ${WEDGE_AUTO_DEFLATION_SECONDS} s — a rail of this model, not a clinical limit.`
              : catheter.position === 'pa'
                ? 'Down. Inflate only from a confirmed artery tracing.'
                : 'Down. The tip must be in the pulmonary artery first.'}
          </small>
        </div>
        <div className={styles.buttonPair}>
          <button
            id={quickControlId('inflate')}
            type="button"
            className={styles.dockButton}
            disabled={!canInflate}
            onClick={() => dispatch({ type: 'START_WEDGE' })}
          >
            Inflate
          </button>
          <button
            id={quickControlId('deflate')}
            type="button"
            className={styles.dockButton}
            disabled={!occluding}
            onClick={() => dispatch({ type: 'DEFLATE_WEDGE' })}
          >
            Deflate
          </button>
        </div>
      </div>
      <div className={styles.dockRow}>
        <div>
          <span>Read at end expiration</span>
          <small>
            {catheter.storedWedgeMmHg !== null
              ? `Stored: ${catheter.storedWedgeMmHg} mmHg${catheter.storedAtEndExpiration ? ', at end expiration' : ''}.`
              : catheter.wedgeCursorTime !== null
                ? 'Cursor placed. Store the value.'
                : catheter.wedgeCaptureReady
                  ? 'The tracing has settled: place the cursor at the trough of the swing.'
                  : occluding
                    ? 'Let the tracing settle for about a breath.'
                    : 'Nothing to read until the balloon is up.'}
          </small>
        </div>
        <div className={styles.buttonPair}>
          <button
            id={quickControlId('cursor')}
            type="button"
            className={styles.dockButton}
            disabled={!occluding || !catheter.wedgeCaptureReady}
            onClick={() => dispatch({ type: 'PLACE_WEDGE_CURSOR' })}
          >
            Place cursor
          </button>
          <button
            id={quickControlId('store')}
            type="button"
            className={styles.dockButton}
            disabled={
              !occluding || catheter.wedgeCursorTime === null || catheter.storedWedgeMmHg !== null
            }
            onClick={() => dispatch({ type: 'STORE_WEDGE' })}
          >
            Store
          </button>
        </div>
      </div>
      {catheter.forcedSafetyRecovery ? (
        <p className={styles.dockNote} role="alert">
          The simulation released the balloon itself. That release does not count as your deflation,
          and the reading it saved is not one you took.
        </p>
      ) : null}
    </fieldset>
  )
}

/* ------------------------------------------------------------------ *
 * Thermodilution: inject, read the curve, decide
 * ------------------------------------------------------------------ */

export function ThermodilutionDock({ state, dispatch, enabled }: DockProps) {
  const start = useRef<number | null>(null)
  const [holding, setHolding] = useState(false)
  const average = thermodilutionAcceptedAverage(state.thermodilutionTrials)
  const canInject =
    state.catheter.position === 'pa' &&
    state.catheter.targetPosition === null &&
    !state.catheter.balloonInflated

  function inject(durationSeconds: number) {
    dispatch({
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        ...standardTechnique(),
        injectionDurationSeconds: Math.max(0.2, Math.min(8, durationSeconds)),
      },
    })
  }

  function begin() {
    if (!canInject) return
    start.current = performance.now()
    setHolding(true)
  }

  function finish() {
    if (start.current === null) return
    const elapsed = (performance.now() - start.current) / 1000
    start.current = null
    setHolding(false)
    inject(elapsed)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault()
      begin()
    }
  }

  function onKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.code === 'Space') {
      event.preventDefault()
      finish()
    }
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse' || event.button === 0) begin()
  }

  return (
    <fieldset className={styles.dock} disabled={!enabled} data-dock="thermodilution">
      <legend>The injection</legend>
      <div className={styles.dockRow}>
        <div>
          <span>Inject the standard bolus</span>
          <small>
            {canInject
              ? 'Hold to inject; the length of the hold is the length of the injection. A smooth few seconds at end expiration is the standard technique.'
              : 'Injection needs the tip in the pulmonary artery with the balloon down.'}
          </small>
        </div>
        <button
          id={quickControlId('inject')}
          type="button"
          className={styles.dockButton}
          data-holding={holding}
          disabled={!canInject}
          onPointerDown={onPointerDown}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={finish}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
        >
          {holding ? 'Injecting…' : 'Hold to inject'}
        </button>
      </div>
      <div className={styles.trialGrid} data-trial-count={state.thermodilutionTrials.length}>
        {state.thermodilutionTrials.map((trial) => (
          <ThermodilutionTrialCard
            key={trial.id}
            trial={trial}
            onReview={() => dispatch({ type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id })}
            onAccept={() =>
              dispatch({ type: 'SET_THERMODILUTION_ACCEPTED', trialId: trial.id, accepted: true })
            }
            onExclude={(reasonId) =>
              dispatch({
                type: 'SET_THERMODILUTION_ACCEPTED',
                trialId: trial.id,
                accepted: false,
                exclusionReasonId: reasonId,
              })
            }
          />
        ))}
      </div>
      <ThermodilutionSeriesReadout trials={state.thermodilutionTrials} />
      {average !== null ? (
        <p className={styles.dockNote} data-series-average>
          The monitor now shows the series average as the cardiac output.
        </p>
      ) : null}
    </fieldset>
  )
}

/* ------------------------------------------------------------------ *
 * Freeze: label the waves
 * ------------------------------------------------------------------ */

export function FreezeDock({ state, dispatch, enabled }: DockProps) {
  return (
    <fieldset className={styles.dock} disabled={!enabled} data-dock="freeze">
      <legend>The tracing</legend>
      <div className={styles.dockRow}>
        <div>
          <span>Freeze to label the waves</span>
          <small>
            {state.frozen
              ? 'Frozen. The waves are labelled on the strip against the ECG above them.'
              : 'A moving tracing cannot carry labels; freezing it does not change the signal.'}
          </small>
        </div>
        <button
          id={quickControlId('freeze')}
          type="button"
          className={styles.dockButton}
          aria-pressed={state.frozen}
          onClick={() => dispatch({ type: 'TOGGLE_FREEZE' })}
        >
          {state.frozen ? 'Unfreeze' : 'Freeze'}
        </button>
      </div>
    </fieldset>
  )
}
