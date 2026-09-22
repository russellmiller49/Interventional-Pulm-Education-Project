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
  CURRENT_RESPONSE_RECHECKED,
  LEVEL_TOLERANCE_CM,
  standardTechnique,
} from '../../engine/stageRuntime'
import { lineMeasurementSystem } from '../../engine/measurementLines'
import { storedWedgeProvenance, thermodilutionSeriesView } from '../../engine/measurementProvenance'
import { WEDGE_AUTO_DEFLATION_SECONDS } from '../../engine/simulation'
import {
  catheterFlushBlocked,
  pressureObservationKey,
  flushReleaseReady,
} from '../../engine/pressureObservation'
import {
  thermodilutionSeriesConditionWords,
  thermodilutionSeriesGroups,
} from '../../engine/thermodilution'
import type {
  DynamicResponseKind,
  FastFlushLineType,
  HemodynamicAction,
  HemodynamicSimulationState,
} from '../../engine/types'
import { positionWords } from '../catheter-map/CatheterMap'
import { FastFlushTrace } from '../PressureSystemTeachingVisual'
import { ThermodilutionSeriesReadout, ThermodilutionTrialCard } from '../ThermodilutionTrialReview'
import styles from './hemodynamics-stage.module.css'
import { useHemodynamicsTaskDraft } from './HemodynamicsTaskDrafts'
import { WedgeCursorPicker } from './WedgeCursorPicker'

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

export function LineDock({
  state,
  dispatch,
  enabled,
  only,
}: DockProps & { readonly only?: 'level' | 'zero' | 'scale' }) {
  const level = state.measurementSystem.transducerLevelCm
  const levelled = Math.abs(level) <= LEVEL_TOLERANCE_CM
  return (
    <fieldset className={styles.dock} disabled={!enabled} data-dock="line">
      <legend>The line</legend>
      {!only || only === 'level' ? (
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
      ) : null}
      {!only || only === 'zero' ? (
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
      ) : null}
      {only === 'zero' ? (
        <p className={styles.dockNote}>
          Simplified workflow: this button represents opening the transducer to atmosphere,
          accepting zero, and reconnecting the pressure channel. Stopcock handling is not modeled.
          Zeroing does not move the transducer.
        </p>
      ) : null}
      {!only || only === 'scale' ? (
        <div className={styles.dockRow}>
          <label htmlFor={quickControlId('scale')}>
            <span>The display scale</span>
            <small>
              Changes how large the arterial tracing is drawn, and nothing underneath it.
            </small>
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
      ) : null}
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
  requireFreshObservation = false,
}: DockProps & {
  readonly lineType: FastFlushLineType
  readonly requireFreshObservation?: boolean
}) {
  const [hasRun, setHasRun] = useHemodynamicsTaskDraft('flush:hasRun', false)
  const [observed, setObserved] = useHemodynamicsTaskDraft<DynamicResponseKind | null>(
    'flush:observed',
    null,
  )
  const [classification, setClassification] = useHemodynamicsTaskDraft<DynamicResponseKind | null>(
    'flush:classification',
    null,
  )
  const [revealed, setRevealed] = useHemodynamicsTaskDraft('flush:revealed', false)
  const [observedKey, setObservedKey] = useHemodynamicsTaskDraft<string | null>(
    'flush:observedKey',
    null,
  )
  const groupId = useId()
  // The flushed line's own response (report L9-05): the arterial line reads its own tubing.
  const lineSystem = lineMeasurementSystem(state.measurementSystem, lineType)
  const arterial = lineType === 'systemic-arterial'
  const current = classifyDynamicResponse(lineSystem)
  const response = observed ?? current
  const definition = getDynamicResponseDefinition(response)
  const classified = state.signalValidationChecks.includes(DYNAMIC_RESPONSE_CLASSIFIED_CHECK)
  const corrected =
    state.signalValidationChecks.includes(DYNAMIC_RESPONSE_CORRECTED_CHECK) ||
    (lineSystem.artifact === 'none' &&
      lineSystem.dampingRatio >= DYNAMIC_RESPONSE_REFERENCE.underdampedBelow &&
      lineSystem.dampingRatio <= DYNAMIC_RESPONSE_REFERENCE.overdampedAbove)
  const paUnsafe = catheterFlushBlocked(state, lineType)
  const stale = hasRun && observedKey !== pressureObservationKey(state, lineType)
  const acquiring = requireFreshObservation && hasRun && !stale && !flushReleaseReady(state)
  const outcome = revealed ? (classification === response ? 'correct' : 'not-correct') : null

  function run() {
    if (paUnsafe || !enabled) return
    dispatch({ type: 'FAST_FLUSH', lineType })
    setObserved(classifyDynamicResponse(lineSystem))
    setHasRun(true)
    setClassification(null)
    setRevealed(false)
    setObservedKey(pressureObservationKey(state, lineType))
  }

  function check() {
    if (!classification || !enabled || acquiring || (requireFreshObservation && stale)) return
    setRevealed(true)
    if (classification === response) {
      dispatch({ type: 'VALIDATE_SIGNAL', check: DYNAMIC_RESPONSE_CLASSIFIED_CHECK })
      if (requireFreshObservation && response === 'acceptable') {
        dispatch({
          type: 'VALIDATE_SIGNAL',
          check: `${CURRENT_RESPONSE_RECHECKED}:${pressureObservationKey(state, lineType)}`,
        })
      }
    }
  }

  /**
   * The reading stays on screen after the repair; flushing again shows the settled line. The
   * arterial repair acts on the arterial line only; the shared response the other lines use is
   * untouched (report L9-05).
   */
  function repair() {
    if (!enabled) return
    const line = arterial ? ('systemic-arterial' as const) : undefined
    dispatch({ type: 'SET_DAMPING', dampingRatio: 0.65, line })
    dispatch({ type: 'SET_ARTIFACT', artifact: 'none', line })
    dispatch({ type: 'VALIDATE_SIGNAL', check: DYNAMIC_RESPONSE_CORRECTED_CHECK })
  }

  return (
    <fieldset className={styles.dock} disabled={!enabled} data-dock="flush">
      <legend>The flush check</legend>
      {lineType === 'pulmonary-artery' ? (
        /*
         * What this control flushes, and what actually stops it.
         *
         * The rule printed here used to require "a confirmed artery tracing", which this
         * simulation does not enforce and which reads as a broken rule when the step legitimately
         * flushes the line with the tip still in the right atrium (report L5-06, Figure 28). The
         * channel is the catheter's distal lumen wherever the tip is, so it is named that way, the
         * tip's current place is printed beside it, and the sentence now states the restriction the
         * reducer and this control both apply.
         */
        <p className={styles.dockNote} role={paUnsafe ? 'alert' : undefined}>
          This is the catheter&apos;s distal lumen — one channel, wherever the tip is; right now,{' '}
          {positionWords(state.catheter.position)}. Never flush a wedged catheter: this simulation
          blocks a flush on this lumen while the tip is in an occluding position, while either
          balloon is up, and while the tip is moving.
          {paUnsafe ? ' That is why the control is unavailable now.' : ''}
        </p>
      ) : (
        <p className={styles.dockNote} data-arterial-line-scope>
          This is the systemic arterial line: its own tubing and flush device. Flushing it reads
          only its response, and repairing it changes only the arterial tracing — the
          pulmonary-artery and central-venous lines keep their own. In this model the lines still
          share one transducer height and zero.
        </p>
      )}
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
          Flush the {lineType === 'pulmonary-artery' ? 'distal PAC' : 'arterial'} line
        </button>
      </div>
      {hasRun ? (
        <>
          {acquiring ? (
            <p className={styles.dockNote} role="status" data-flush-acquiring>
              Observe the plateau, release and first complete pulse after the flush. Classification
              becomes available when this modeled acquisition finishes.
            </p>
          ) : null}
          {stale ? (
            <p className={styles.dockNote} role="status" data-flush-stale>
              Before correction — the captured response below belongs to the earlier line
              configuration. Flush again to observe the current line.
            </p>
          ) : (
            <p className={styles.dockNote}>
              Current acquisition ·{' '}
              {lineType === 'pulmonary-artery'
                ? `PAC distal lumen, tip in ${positionWords(state.catheter.position)}`
                : 'systemic arterial line'}{' '}
              · qualitative release rendering.
            </p>
          )}
          <FastFlushTrace response={response} lineType={lineType} revealLabel={revealed} />
          <fieldset
            className={styles.choiceGroup}
            data-flush-classification
            disabled={acquiring || (requireFreshObservation && stale)}
          >
            <legend id={groupId}>How did it settle?</legend>
            {dynamicResponseDefinitions.map((candidate) => (
              <label key={candidate.id} data-selected={classification === candidate.id}>
                <input
                  type="radio"
                  name={`flush-${groupId}`}
                  value={candidate.id}
                  checked={classification === candidate.id}
                  disabled={revealed && classification === response}
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
              disabled={!classification || acquiring || (requireFreshObservation && stale)}
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
          {classified && revealed && classification === response && response !== 'acceptable' ? (
            <div className={styles.dockRow}>
              <div>
                <span>Simulated line correction</span>
                <small>
                  This sets the modeled dynamic response {arterial ? 'of the arterial line ' : ''}to
                  an acceptable preset. Finding and correcting a real air bubble, kink, clot, or
                  connection problem is not modeled.
                </small>
              </div>
              <button
                id={quickControlId('repair')}
                type="button"
                className={styles.dockButton}
                disabled={corrected}
                onClick={repair}
              >
                {corrected ? 'Simulated correction applied' : 'Apply the simulated line correction'}
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
      {/*
        Who raised the balloon. This simulation inflates the flow-directed balloon when the tip
        leaves the atrium and lets it down when the artery appears; the learner never chooses
        either. Saying so is the honest reading of the report's L5-03 — the two decisions the
        intro stresses are not practised here — and it keeps the assistance from reading as work
        the learner performed. Whether those decisions should become controls is a review
        question, not one this repair answers.
      */}
      <p className={styles.dockNote} data-float-balloon-provenance>
        {state.catheter.floatBalloonInflated
          ? 'The flow-directed balloon is up while the tip floats forward, as the manufacturer’s instructions describe. This simulation raised it for you when the tip left the atrium and lets it down when the artery appears — guided model assistance, not an action you performed, and not the wedge.'
          : 'The flow-directed balloon is down. In this simulation it is raised and lowered for you as the tip floats; inflating and deflating it are not controls here, and nothing about it is recorded as your work.'}
      </p>
    </fieldset>
  )
}

/* ------------------------------------------------------------------ *
 * The wedge: occlude, cursor, store, deflate
 * ------------------------------------------------------------------ */

/** What was stored, from which cursor, and whether it still describes this patient. */
function storedWords(stored: NonNullable<ReturnType<typeof storedWedgeProvenance>>): string {
  const value = `${stored.valueMmHg.toFixed(1)} mmHg`
  if (!stored.record) return `Stored: ${value}. How it was read was not recorded.`
  const cursor = stored.record.cursor
  const from =
    cursor.placement === 'manual' ? 'from the cursor you set' : 'from the assisted cursor'
  const phase = cursor.withinModeledEndExpiratoryWindow
    ? 'at the modeled end expiration'
    : 'away from the modeled end expiration, so not recorded as end-expiratory'
  const conditions =
    stored.current === false
      ? ' It was stored under earlier conditions; the patient’s modeled physiology has changed since.'
      : ''
  return `Stored: ${value}, the mean of one cardiac cycle ${from}, ${phase}.${conditions}`
}

export function WedgeDock({ state, dispatch, enabled }: DockProps) {
  const catheter = state.catheter
  const stored = storedWedgeProvenance(state)
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
                ? 'Down. A deflated balloon does not by itself establish that the occlusion has ended: the artery tracing coming back does. Inflate only from a confirmed artery tracing.'
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
          <small data-stored-wedge-provenance>
            {stored
              ? storedWords(stored)
              : catheter.wedgeCursorTime !== null
                ? 'Cursor set. Store the value, or move the cursor first.'
                : catheter.wedgeCaptureReady
                  ? 'The tracing has settled. Find end expiration on the captured trace below and set the cursor there — or show the assisted placement.'
                  : occluding
                    ? 'Let the tracing settle for about a breath.'
                    : 'Nothing to read until the balloon is up.'}
          </small>
        </div>
        <div className={styles.buttonPair}>
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
      {occluding ? (
        <WedgeCursorPicker
          state={state}
          dispatch={dispatch}
          enabled={enabled}
          controlId={quickControlId('cursor')}
        />
      ) : null}
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
  const view = thermodilutionSeriesView(state)
  const average = view.current.averageLMin
  const groups = thermodilutionSeriesGroups(state.thermodilutionTrials)
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
      {groups.map((group) => (
        <div key={group.identity.key} data-series-group={group.identity.key}>
          {groups.length > 1 ? (
            <p className={styles.dockNote}>
              Series: {thermodilutionSeriesConditionWords(group.identity)}
              {group.identity.key === view.current.identity.key ? ' — the current series' : ''}
            </p>
          ) : null}
          <div className={styles.trialGrid} data-trial-count={group.trials.length}>
            {group.trials.map((trial) => (
              <ThermodilutionTrialCard
                key={trial.id}
                trial={trial}
                onReview={() =>
                  dispatch({ type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id })
                }
                onAccept={() =>
                  dispatch({
                    type: 'SET_THERMODILUTION_ACCEPTED',
                    trialId: trial.id,
                    accepted: true,
                  })
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
        </div>
      ))}
      {groups.length === 0 ? <div className={styles.trialGrid} data-trial-count={0} /> : null}
      <ThermodilutionSeriesReadout trials={state.thermodilutionTrials} view={view} />
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
