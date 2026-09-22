'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { WaveformSample } from '../../engine/types'
import type { BreathStopId } from '../../content/breathSpine'
import {
  anchorBreathVolume,
  breathStopIndex,
  completedBreath,
  waveformAxes,
  waveformFields,
  type WaveformAxes,
} from '../../engine/teachingBreath'
import {
  MARKER_UNAVAILABLE_NOTE,
  markerEvidence,
  markerEvidenceSentence,
  type VentilationReferenceMarker,
} from '../../content/referenceEvidence'
import styles from './ventilation-stage.module.css'

const labels = {
  pawCmH2O: 'Airway pressure (cmH₂O)',
  flowLMin: 'Flow (L/min)',
  volumeMl: 'Volume (mL)',
  pmusCmH2O: 'Effort · model (cmH₂O)',
}
/**
 * Two volume rows, because there are two quantities and the figure used to print one label over
 * whichever it happened to be drawing.
 *
 * The engine's `volumeMl` is lung volume above the trace baseline: it carries trapped gas, so on
 * the obstructive patient in Section 7 the row labelled "Breath-relative volume" started at
 * 486 mL, peaked near 917 and ended at 518, next to an exhaled volume of 426 mL. It was read, as
 * the report said, as a 900-mL breath.
 *
 * When the figure has a *verified* breath start — `completedBreath` found two real inspiration
 * onsets, so sample 0 is the start of this breath — the row is drawn relative to that anchor and
 * says so, and the raw offset is kept in the caption. When it does not (a paused partial breath, a
 * hold slice), the raw signal is drawn under its own name. Nothing is subtracted from the engine:
 * this is a rendering choice at the boundary, and expiration is never forced back to zero.
 */
const volumeLabels = {
  anchored: 'Volume from breath start (mL)',
  raw: 'Raw lung volume (mL)',
}
const stopNames: Record<BreathStopId, string> = {
  trigger: 'Trigger',
  inspiration: 'Inspiration',
  cycling: 'Cycling',
  expiration: 'Expiration',
}

export function CapturedBreath({
  samples,
  label,
  guided = false,
  stop,
  fixedIndex,
  marker,
  axes,
  whole = true,
  onInspect,
  effort = false,
  durationSeconds,
}: {
  samples: readonly WaveformSample[]
  label: string
  guided?: boolean
  stop?: BreathStopId
  fixedIndex?: number
  /**
   * The authored identification marker for this item — "interval A". Fixed: it is resolved from
   * the samples once and does not move when the learner moves the exploration cursor.
   */
  marker?: VentilationReferenceMarker
  axes?: WaveformAxes
  whole?: boolean
  onInspect?: (sample: WaveformSample, previous: WaveformSample) => void
  effort?: boolean
  /** Shared physical time range for retained before/after comparisons. */
  durationSeconds?: number
}) {
  const id = useId()
  const figureRef = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(360)
  const [labelsHidden, setLabelsHidden] = useState(false)
  const breath = whole ? completedBreath(samples) : samples
  const hasCompleteBreath = breath.length >= 4
  useEffect(() => {
    if (!figureRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(180, entry.contentRect.width)),
    )
    observer.observe(figureRef.current)
    return () => observer.disconnect()
  }, [hasCompleteBreath])
  const [position, setPosition] = useState<number | null>(null)
  const index = Math.min(
    breath.length - 1,
    fixedIndex ??
      (stop ? breathStopIndex(breath, stop) : (position ?? breathStopIndex(breath, 'inspiration'))),
  )
  if (breath.length < 4)
    return (
      <p role="status">
        A complete breath is not yet available. Run or advance one breath, then capture again.
      </p>
    )
  /*
   * A verified anchor, not an assumed one: `completedBreath` slices between two real inspiration
   * onsets, so only then is sample 0 the start of a breath.
   */
  const anchored = whole
  const anchorMl = anchored ? breath[0].volumeMl : 0
  const plotted = anchored ? anchorBreathVolume(breath) : breath
  const evidence = marker ? markerEvidence(breath, marker) : null
  const bounds = { ...(axes ?? waveformAxes(plotted)), pmusCmH2O: [-25, 5] as const }
  const fields = effort ? [...waveformFields, 'pmusCmH2O' as const] : waveformFields
  const first = breath[0].time
  const duration = breath.at(-1)!.time - first
  const timeRange = Math.max(duration, durationSeconds ?? 0)
  const sample = plotted[index]
  const previous = plotted[Math.max(0, index - 1)]
  const rawSample = breath[index]
  const rawPrevious = breath[Math.max(0, index - 1)]
  const x = (time: number) => 50 + ((time - first) / timeRange) * (width - 70)
  const y = (value: number, field: (typeof fields)[number]) =>
    64 - ((value - bounds[field][0]) / (bounds[field][1] - bounds[field][0])) * 54
  const cycling = breath.findIndex((s) => s.phase === 'expiration')
  const highlighted = stop === 'trigger' || stop === 'cycling' ? stop : sample.phase
  const from = highlighted === 'expiration' ? breath[cycling]?.time : first
  const to = highlighted === 'inspiration' ? breath[cycling]?.time : breath.at(-1)!.time
  const volumeClause = anchored
    ? `volume ${previous.volumeMl.toFixed(0)} to ${sample.volumeMl.toFixed(0)} mL above this breath’s start`
    : `lung volume ${previous.volumeMl.toFixed(0)} to ${sample.volumeMl.toFixed(0)} mL above the trace baseline`
  const cursorText = `Cursor at ${(rawSample.time - first).toFixed(2)} s. Airway pressure ${rawSample.pawCmH2O.toFixed(1)} cmH₂O; flow ${rawSample.flowLMin.toFixed(1)} L/min; ${volumeClause} over the preceding ${(rawSample.time - rawPrevious.time).toFixed(2)} s.${effort ? ` Model effort ${rawSample.pmusCmH2O.toFixed(1)} cmH₂O; machine ${rawSample.phase}.` : ''}`
  const markerText = marker
    ? evidence
      ? markerEvidenceSentence(evidence)
      : `Interval ${marker.markerId}: ${MARKER_UNAVAILABLE_NOTE}`
    : ''
  const text = markerText ? `${markerText} ${cursorText}` : cursorText
  return (
    <figure
      className={styles.capturedBreath}
      ref={figureRef}
      data-captured-breath
      data-guided-stop={guided ? stop : undefined}
      data-marker={marker?.markerId}
      data-marker-resolved={marker ? (evidence ? 'true' : 'false') : undefined}
    >
      <figcaption id={id}>
        <strong>{label}</strong>
        {guided ? ' · Worked demonstration; no independent credit' : ''}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${fields.length * 85 + 23}`} role="img" aria-label={text}>
        {fields.map((field, row) => (
          <g key={field} transform={`translate(0 ${row * 85})`}>
            <text x="0" y="12">
              {field === 'volumeMl' ? volumeLabels[anchored ? 'anchored' : 'raw'] : labels[field]}
            </text>
            <g transform="translate(0 15)">
              {guided &&
              cycling > 0 &&
              (highlighted === 'inspiration' || highlighted === 'expiration') ? (
                <rect
                  x={x(from)}
                  y="7"
                  width={Math.max(0, x(to) - x(from))}
                  height="58"
                  className={styles.phaseBand}
                  data-phase-band={highlighted}
                />
              ) : null}
              {[bounds[field][0], bounds[field][1]].map((v) => (
                <g key={v}>
                  <text x="0" y={y(v, field) + 3}>
                    {v.toFixed(0)}
                  </text>
                  <line
                    x1="50"
                    x2={width - 20}
                    y1={y(v, field)}
                    y2={y(v, field)}
                    className={styles.breathGrid}
                  />
                </g>
              ))}
              {bounds[field][0] < 0 ? (
                <g>
                  <line
                    x1="50"
                    x2={width - 20}
                    y1={y(0, field)}
                    y2={y(0, field)}
                    className={styles.zeroLine}
                  />
                  <text x="33" y={y(0, field) + 3}>
                    0
                  </text>
                </g>
              ) : null}
              <path
                d={plotted
                  .map(
                    (s, i) =>
                      `${i ? 'L' : 'M'}${x(s.time).toFixed(2)} ${y(s[field], field).toFixed(2)}`,
                  )
                  .join(' ')}
                className={styles.breathTrace}
              />
              {guided && cycling > 0 ? (
                <line
                  x1={x(breath[cycling].time)}
                  x2={x(breath[cycling].time)}
                  y1="7"
                  y2="66"
                  className={styles.zeroLine}
                />
              ) : null}
              {/*
               * The authored marker, drawn on every row, with its letter beside it. It is a
               * different element from the cursor below and never follows it.
               */}
              {evidence ? (
                <g data-breath-marker={evidence.marker.markerId}>
                  <line
                    x1={x(evidence.sample.time)}
                    x2={x(evidence.sample.time)}
                    y1="7"
                    y2="66"
                    className={styles.markerLine}
                  />
                  <text
                    x={x(evidence.sample.time) + 3}
                    y="16"
                    className={styles.markerLabel}
                    data-marker-letter={evidence.marker.markerId}
                  >
                    {evidence.marker.markerId}
                  </text>
                </g>
              ) : null}
              <line
                x1={x(rawSample.time)}
                x2={x(rawSample.time)}
                y1="7"
                y2="66"
                className={styles.cursor}
                data-time-cursor={rawSample.time}
              />
            </g>
          </g>
        ))}
        <text x="50" y={fields.length * 85 + 20}>
          0
        </text>
        <text x={width / 2} y={fields.length * 85 + 20} textAnchor="middle">
          Time (s)
        </text>
        <text x={width - 20} y={fields.length * 85 + 20} textAnchor="end">
          {timeRange.toFixed(2)}
        </text>
      </svg>
      <p className={styles.quickNote}>
        Breath duration {duration.toFixed(2)} s ·{' '}
        {durationSeconds
          ? 'Shared comparison time and signal scales'
          : 'One time axis for all signals'}
      </p>
      {anchored ? (
        <p className={styles.quickNote} data-volume-anchor={anchorMl.toFixed(0)}>
          Volume is drawn from this breath’s start. The lung held {anchorMl.toFixed(0)} mL above the
          trace baseline when the breath began and {breath.at(-1)!.volumeMl.toFixed(0)} mL when it
          ended; gas that has not left is still in the raw signal, and the trace is not forced back
          to zero. A rise from the start and the ventilator’s exhaled volume are different
          quantities and need not agree.
        </p>
      ) : (
        <p className={styles.quickNote}>
          This slice has no verified breath start, so the raw lung-volume signal is drawn under its
          own name rather than re-zeroed.
        </p>
      )}
      {effort ? (
        <p className={styles.quickNote}>
          Effort is a teaching model signal, not routine measured ventilator data. Read the onset
          and end of effort separately from machine inspiration.
        </p>
      ) : null}
      {marker ? (
        <p className={styles.quickNote} data-marker-note={marker.markerId}>
          {markerText}
        </p>
      ) : null}
      {fixedIndex === undefined && !stop ? (
        <label className={styles.cursorControl}>
          {marker
            ? `Explore this trace (interval ${marker.markerId} stays where it is)`
            : 'Inspect time in this captured trace'}
          <input
            aria-label={
              marker
                ? `Exploration cursor, separate from interval ${marker.markerId}`
                : 'Captured breath time cursor'
            }
            type="range"
            min="0"
            max={breath.length - 2}
            step="1"
            value={index}
            onChange={(e) => setPosition(Number(e.target.value))}
          />
        </label>
      ) : null}
      {guided && !stop ? (
        <div className={styles.quickButtons}>
          {(['trigger', 'inspiration', 'cycling', 'expiration'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={styles.toolButton}
              onClick={() => setPosition(breathStopIndex(breath, s))}
            >
              {stopNames[s]}
            </button>
          ))}
        </div>
      ) : null}
      <p className={styles.quickNote}>{cursorText}</p>
      {guided ? (
        <>
          {labelsHidden ? null : (
            <p data-phase-label>
              {rawSample.phase === 'inspiration'
                ? 'Inspiration: positive flow adds volume.'
                : 'Expiration: negative flow accompanies falling volume.'}{' '}
              The volume reference is not total lung volume.
            </p>
          )}
          <button
            type="button"
            className={styles.toolButton}
            aria-pressed={labelsHidden}
            onClick={() => setLabelsHidden((hidden) => !hidden)}
          >
            {labelsHidden ? 'Show the phase label again' : 'Hide the phase label on this figure'}
          </button>
        </>
      ) : null}
      {onInspect ? (
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => onInspect(rawSample, rawPrevious)}
        >
          Use this captured interval
        </button>
      ) : null}
    </figure>
  )
}
