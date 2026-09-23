'use client'

import { useId, useState, type Dispatch } from 'react'

import {
  assistedWedgeCursorTime,
  modeledRespiratoryReference,
  occlusionCapture,
  WEDGE_WINDOW_STRADDLES_CHANGE,
  wedgeCursorReadingAt,
} from '../../engine/measurementProvenance'
import { INSPIRATORY_FRACTION } from '../../engine/simulation'
import type {
  HemodynamicAction,
  HemodynamicSimulationState,
  WedgeCursorReading,
} from '../../engine/types'
import styles from './hemodynamics-stage.module.css'

/**
 * Choosing where on the captured occlusion trace the wedge is read (HD-PRE-REVIEW-02, report L6-02).
 *
 * "Place cursor" used to drop the cursor at end expiration for the learner — so the one decision
 * the step exists to teach was never made — and the live monitor showed no respiratory timing to
 * make it from. Here the learner moves a cursor across the samples this occlusion actually
 * captured, against the simulation's own modeled respiratory phase drawn beneath them, and sets
 * it. The assisted placement is a separate, labelled action; revealing it is not the learner
 * identifying end expiration, and the record says which of the two happened.
 *
 * The respiratory strip is the model's breath timing. It is not a measured ventilator, airway
 * pressure or impedance channel, and it is labelled that way. Nothing here names a tolerance: after
 * a placement the feedback says where the point sits relative to the modeled end expiration and how
 * much the value differs from the value there.
 *
 * The slider, the drawn cursor, the text equivalent and the stored value all read
 * `wedgeCursorReadingAt`, so they resolve to the same sample.
 */
export function WedgeCursorPicker({
  state,
  dispatch,
  enabled,
  controlId,
}: {
  readonly state: HemodynamicSimulationState
  readonly dispatch: Dispatch<HemodynamicAction>
  readonly enabled: boolean
  /** The id the lesson's "show me that control" focuses. */
  readonly controlId: string
}) {
  const labelId = useId()
  const descriptionId = useId()
  const catheter = state.catheter
  const capture = catheter.wedgeCaptureReady ? occlusionCapture(state) : null
  const episode = catheter.wedgeEpisodeCount
  const [draft, setDraft] = useState<{ readonly episode: number; readonly time: number } | null>(
    null,
  )

  if (!capture || capture.cursorMax < capture.cursorMin) {
    // The control exists — disabled — before there is anything to read, so the lesson's "show me
    // that control" has somewhere to go and the step does not change shape when capture is ready.
    return (
      <div className={styles.cursorPicker} data-wedge-cursor-picker="waiting">
        <p className={styles.dockNote} id={descriptionId}>
          {catheter.balloonInflated && catheter.position === 'wedge'
            ? 'The captured occlusion trace appears here once the tracing has settled for about a breath.'
            : 'Nothing to read until the balloon is up.'}
        </p>
        <div className={styles.slider}>
          <input
            id={controlId}
            type="range"
            min={0}
            max={0}
            value={0}
            disabled
            aria-label="Cursor on the captured occlusion trace"
            aria-describedby={descriptionId}
            onChange={() => undefined}
          />
          <output htmlFor={controlId}>—</output>
        </div>
      </div>
    )
  }

  const draftTime =
    draft !== null && draft.episode === episode
      ? Math.min(capture.cursorMax, Math.max(capture.cursorMin, draft.time))
      : capture.cursorMin
  const preview = wedgeCursorReadingAt(state, draftTime, 'manual')
  const placed =
    catheter.wedgeCursor && catheter.wedgeCursor.occlusionEpisode === episode
      ? catheter.wedgeCursor
      : null
  const stored = catheter.storedWedgeMmHg !== null
  const reference = modeledRespiratoryReference(capture)
  const inspirationRises = state.parameters.spontaneousBreathingFraction < 0.5
  const tenths = Math.round((capture.cursorMax - capture.cursorMin) * 10)
  const stepValue = Math.round((draftTime - capture.cursorMin) * 10)
  const relativeAt = (time: number) =>
    reference.reduce((best, point) =>
      Math.abs(point.time - time) < Math.abs(best.time - time) ? point : best,
    ).relative

  const describe = (reading: WedgeCursorReading) =>
    `${(reading.time - capture.start).toFixed(1)} s into the occlusion · trace ${reading.sampleMmHg.toFixed(1)} mmHg · mean of the cardiac cycle centred here ${reading.cycleMeanMmHg.toFixed(1)} mmHg · modeled respiratory reference at ${Math.round(relativeAt(reading.time) * 100)}% of its range${
      reading.acquisition.physiologicalEpisode === null
        ? ' · this cycle straddles a change in the modeled physiology'
        : reading.acquisition.physiologicalEpisode !== state.physiologicalEpisode.index
          ? ' · acquired before the modeled physiology last changed'
          : ''
    }`

  return (
    <div className={styles.cursorPicker} data-wedge-cursor-picker="ready">
      <CaptureFigure
        state={state}
        capture={capture}
        reference={reference}
        draftTime={draftTime}
        placed={placed}
        inspirationRises={inspirationRises}
        describedBy={descriptionId}
      />
      <p id={descriptionId} className={styles.dockNote} data-respiratory-reference-label>
        Lower strip: the simulation’s modeled respiratory phase — its own breath timing, which{' '}
        {inspirationRises ? 'rises' : 'falls'} during inspiration for this patient. It is a model
        reference, not a measured ventilator, airway-pressure or impedance trace.
      </p>
      <div className={styles.dockRow}>
        <label htmlFor={controlId} id={labelId}>
          <span>Move the cursor across the captured trace</span>
          <small>
            Arrow keys move a tenth of a second; Page Up and Page Down move half a second.
          </small>
        </label>
        <div className={styles.slider}>
          <input
            id={controlId}
            type="range"
            min={0}
            max={Math.max(0, tenths)}
            step={1}
            value={Math.min(stepValue, Math.max(0, tenths))}
            disabled={!enabled || stored}
            aria-valuetext={preview ? describe(preview) : undefined}
            onChange={(event) =>
              setDraft({
                episode,
                time: capture.cursorMin + Number(event.target.value) / 10,
              })
            }
          />
          <output htmlFor={controlId} data-cursor-preview>
            {preview ? `${preview.cycleMeanMmHg.toFixed(1)} mmHg` : '—'}
          </output>
        </div>
      </div>
      {preview ? (
        <p className={styles.dockNote} data-cursor-preview-text>
          Cursor: {describe(preview)}.
        </p>
      ) : null}
      <div className={styles.buttonPair}>
        <button
          type="button"
          className={styles.dockButton}
          disabled={!enabled || stored || !preview}
          data-cursor-action="manual"
          onClick={() =>
            dispatch({ type: 'PLACE_WEDGE_CURSOR', placement: 'manual', time: draftTime })
          }
        >
          Set the cursor here
        </button>
        <button
          type="button"
          className={styles.dockButton}
          disabled={!enabled || stored}
          data-cursor-action="assisted"
          onClick={() => dispatch({ type: 'PLACE_WEDGE_CURSOR', placement: 'assisted' })}
        >
          Show the assisted placement
        </button>
      </div>
      {placed ? (
        <PlacedCursorFeedback state={state} placed={placed} captureStart={capture.start} />
      ) : null}
    </div>
  )
}

function respiratoryWords(phase: number): string {
  if (phase <= 0.02 || phase >= 0.98) return 'at the modeled end expiration'
  return phase < INSPIRATORY_FRACTION ? 'in modeled inspiration' : 'in modeled expiration'
}

function PlacedCursorFeedback({
  state,
  placed,
  captureStart,
}: {
  readonly state: HemodynamicSimulationState
  readonly placed: WedgeCursorReading
  readonly captureStart: number
}) {
  const assistedTime = assistedWedgeCursorTime(state)
  const atEndExpiration =
    assistedTime === null ? null : wedgeCursorReadingAt(state, assistedTime, 'assisted')
  const seconds = placed.secondsFromModeledEndExpiration
  const where =
    Math.abs(seconds) < 0.005
      ? 'on the modeled end expiration'
      : `${Math.abs(seconds).toFixed(2)} s ${seconds < 0 ? 'before' : 'after'} the nearest modeled end expiration`
  const difference = atEndExpiration ? placed.cycleMeanMmHg - atEndExpiration.cycleMeanMmHg : null
  // HD-PRE-REVIEW-02 sanity repair (blocker 1): which conditions the cycle under the cursor was
  // acquired in, read from its own sample times — never from the moment Store is pressed.
  const conditions =
    placed.acquisition.physiologicalEpisode === null
      ? 'straddles'
      : placed.acquisition.physiologicalEpisode === state.physiologicalEpisode.index
        ? 'current'
        : 'earlier'
  return (
    <div
      className={styles.dockVerdict}
      role="status"
      aria-live="polite"
      data-cursor-placed={placed.placement}
      data-cursor-in-window={placed.withinModeledEndExpiratoryWindow}
      data-cursor-conditions={conditions}
    >
      {conditions === 'straddles' ? <p>{WEDGE_WINDOW_STRADDLES_CHANGE}</p> : null}
      {conditions === 'earlier' ? (
        <p>
          This cycle was acquired before the modeled physiology last changed. A value stored from it
          is kept as a value from those earlier conditions and is not combined with measurements
          from now.
        </p>
      ) : null}
      {placed.placement === 'assisted' ? (
        <p>
          <strong>Assisted placement.</strong> The simulation put the cursor at its own modeled end
          expiration, {(placed.time - captureStart).toFixed(1)} s into the occlusion: cycle mean{' '}
          {placed.cycleMeanMmHg.toFixed(1)} mmHg. It is recorded as assisted — not as a point you
          identified. You can still move the cursor and set it yourself.
        </p>
      ) : (
        <>
          <p>
            <strong>Your cursor</strong> sits {(placed.time - captureStart).toFixed(1)} s into the
            occlusion, {respiratoryWords(placed.modeledRespiratoryPhase)}, {where}. Cycle mean
            there: {placed.cycleMeanMmHg.toFixed(1)} mmHg.
          </p>
          {atEndExpiration && difference !== null ? (
            <p>
              At the modeled end expiration the same capture reads{' '}
              {atEndExpiration.cycleMeanMmHg.toFixed(1)} mmHg, so your point reads{' '}
              {difference >= 0 ? '+' : '−'}
              {Math.abs(difference).toFixed(1)} mmHg from it.{' '}
              {placed.withinModeledEndExpiratoryWindow
                ? 'It falls inside the simulation’s modeled end-expiratory window, so a value stored from it is recorded as end-expiratory.'
                : 'It falls outside the simulation’s modeled end-expiratory window, so a value stored from it is not recorded as end-expiratory. That window is a setting of this model, not a clinical tolerance.'}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

const FIGURE_WIDTH = 480
const TRACE_TOP = 8
const TRACE_BOTTOM = 104
const RESP_TOP = 116
const RESP_BOTTOM = 146

function CaptureFigure({
  state,
  capture,
  reference,
  draftTime,
  placed,
  inspirationRises,
  describedBy,
}: {
  readonly state: HemodynamicSimulationState
  readonly capture: NonNullable<ReturnType<typeof occlusionCapture>>
  readonly reference: ReturnType<typeof modeledRespiratoryReference>
  readonly draftTime: number
  readonly placed: WedgeCursorReading | null
  readonly inspirationRises: boolean
  readonly describedBy: string
}) {
  const values = capture.samples.map((sample) => sample.pcwpMmHg)
  const low = Math.floor(Math.min(...values) - 1)
  const high = Math.ceil(Math.max(...values) + 1)
  const span = Math.max(1, capture.end - capture.start)
  const x = (time: number) => ((time - capture.start) / span) * FIGURE_WIDTH
  const y = (value: number) =>
    TRACE_BOTTOM - ((value - low) / Math.max(1, high - low)) * (TRACE_BOTTOM - TRACE_TOP)
  const respY = (relative: number) =>
    RESP_BOTTOM - (inspirationRises ? relative : 1 - relative) * (RESP_BOTTOM - RESP_TOP)
  const trace = capture.samples
    .map(
      (sample, index) =>
        `${index === 0 ? 'M' : 'L'} ${x(sample.time).toFixed(1)} ${y(sample.pcwpMmHg).toFixed(1)}`,
    )
    .join(' ')
  const resp = reference
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${x(point.time).toFixed(1)} ${respY(point.relative).toFixed(1)}`,
    )
    .join(' ')
  const half = capture.cycleSeconds / 2
  const label = `Captured occlusion trace, ${(capture.end - capture.start).toFixed(1)} seconds from inflation, drawn from ${low} to ${high} mmHg, with the simulation’s modeled respiratory phase beneath it. The cursor you are moving is ${(draftTime - capture.start).toFixed(1)} seconds in.${
    placed
      ? ` A ${placed.placement === 'manual' ? 'cursor you set' : 'assisted cursor'} is at ${(placed.time - capture.start).toFixed(1)} seconds.`
      : ''
  }`
  return (
    <svg
      className={styles.captureFigure}
      viewBox={`0 0 ${FIGURE_WIDTH} 150`}
      role="img"
      aria-label={label}
      aria-describedby={describedBy}
      data-capture-figure
      data-heart-rate={state.parameters.heartRateBpm}
    >
      <rect
        x={x(draftTime - half)}
        y={TRACE_TOP}
        width={Math.max(1, x(draftTime + half) - x(draftTime - half))}
        height={TRACE_BOTTOM - TRACE_TOP}
        className={styles.captureWindow}
      />
      <path d={trace} className={styles.captureTrace} />
      <path d={resp} className={styles.captureRespiration} />
      <line
        x1={x(draftTime)}
        x2={x(draftTime)}
        y1={TRACE_TOP}
        y2={RESP_BOTTOM}
        className={styles.captureDraftCursor}
      />
      {placed ? (
        <line
          x1={x(placed.time)}
          x2={x(placed.time)}
          y1={TRACE_TOP}
          y2={RESP_BOTTOM}
          className={styles.capturePlacedCursor}
          data-placement={placed.placement}
        />
      ) : null}
    </svg>
  )
}
