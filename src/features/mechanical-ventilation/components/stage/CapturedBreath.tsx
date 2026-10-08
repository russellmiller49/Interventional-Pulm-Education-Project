'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { WaveformSample } from '../../engine/types'
import type { BreathStopId } from '../../content/breathSpine'
import {
  anchorBreathVolume,
  breathStopIndex,
  completedBreath,
  sampleSpacingSeconds,
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
import {
  BREATH_ORIGIN,
  BREATH_ROW_LABELS,
  BREATH_TIME_AXIS_LABEL,
  RAW_VOLUME_ROW_LABEL,
  TRACE_TIME_AXIS_LABEL,
  breathOriginFacts,
} from '../../content/breathOrigin'
import { BREATH_LABEL_LINE_PX, breathRowLayout } from './breathFigureLayout'
import styles from './ventilation-stage.module.css'

/*
 * Two volume rows, because there are two quantities and the figure used to print one label over
 * whichever it happened to be drawing.
 *
 * The engine's `volumeMl` is lung volume above the trace baseline: it carries trapped gas, so on
 * the obstructive patient in Section 7 the row labelled "Breath-relative volume" started at
 * 486 mL, peaked near 917 and ended at 518, next to an exhaled volume of 426 mL. It was read, as
 * the report said, as a 900-mL breath.
 *
 * When the figure has a *verified* onset — `completedBreath` found two real inspiration onsets, so
 * sample 0 is this breath's first recorded inspiratory sample — the row is drawn relative to that
 * sample and says so, and the raw offset is kept in the caption. When it does not (a paused partial
 * breath, a hold slice), the raw signal is drawn under its own name. Nothing is subtracted from the
 * engine: this is a rendering choice at the boundary, and expiration is never forced back to zero.
 * The words for the origin are `content/breathOrigin.ts`'s, shared with the overlay.
 */
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
  timeWindow,
  retained = false,
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
  /**
   * A display crop of the time axis, in seconds from this breath's first sample. The samples are
   * not retimed or resampled: the same physical seconds map onto a wider plot, and samples outside
   * the window are simply not drawn. The figure says what it is showing and of how long a breath.
   */
  timeWindow?: { readonly from: number; readonly to: number }
  /**
   * True for a record that was captured earlier and cannot be taken again by running the patient
   * (the retained baseline and result). If it holds no complete breath, the figure says so instead
   * of asking for a new capture — and says only that. It used to add that the breaths were too far
   * apart for the record's length, which was not the reason in the one place it appeared: Section
   * 8's 12-second window held two whole 6-second cycles and could verify one onset.
   */
  retained?: boolean
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
    return retained ? (
      <p role="status" data-no-complete-breath>
        {label}: this retained record does not hold one complete breath — an inspiratory onset to
        the next — in its{' '}
        {samples.length > 1 ? (samples.at(-1)!.time - samples[0].time).toFixed(0) : '0'} seconds, so
        no breath is drawn for it. A breath is drawn only between two inspiratory onsets the record
        can verify, and this record does not hold two. Its readings are still in the table.
      </p>
    ) : (
      <p role="status">
        A complete breath is not yet available. Run or advance one breath, then capture again.
      </p>
    )
  /*
   * A verified anchor, not an assumed one: `completedBreath` slices between two real inspiration
   * onsets, so only then is sample 0 a breath's first recorded inspiratory sample.
   */
  const anchored = whole
  const anchorMl = anchored ? breath[0].volumeMl : 0
  const origin = anchored ? breathOriginFacts(samples, breath) : null
  const plotted = anchored ? anchorBreathVolume(breath) : breath
  const evidence = marker ? markerEvidence(breath, marker) : null
  const bounds = { ...(axes ?? waveformAxes(plotted)), pmusCmH2O: [-25, 5] as const }
  const fields = effort ? [...waveformFields, 'pmusCmH2O' as const] : waveformFields
  const layout = breathRowLayout(
    fields.map((field) =>
      field === 'volumeMl' && !anchored ? RAW_VOLUME_ROW_LABEL : BREATH_ROW_LABELS[field],
    ),
    width,
  )
  const first = breath[0].time
  const duration = breath.at(-1)!.time - first
  const timeRange = Math.max(duration, durationSeconds ?? 0)
  const spacing = sampleSpacingSeconds(breath)
  const windowFrom = timeWindow ? Math.max(0, timeWindow.from) : 0
  const windowTo = timeWindow ? Math.min(timeRange, timeWindow.to) : timeRange
  const zoomed = windowFrom > 0 || windowTo < timeRange
  /* One sample beyond each edge, so a line leaves the plot where it really goes rather than stopping short. */
  const drawn = zoomed
    ? plotted.filter((s, i) => {
        const t = s.time - first
        const next = plotted[i + 1]
        const prev = plotted[i - 1]
        return (
          (t >= windowFrom && t <= windowTo) ||
          (next !== undefined && next.time - first > windowFrom && t < windowFrom) ||
          (prev !== undefined && prev.time - first < windowTo && t > windowTo)
        )
      })
    : plotted
  const sample = plotted[index]
  const previous = plotted[Math.max(0, index - 1)]
  const rawSample = breath[index]
  const rawPrevious = breath[Math.max(0, index - 1)]
  const x = (time: number) =>
    50 + ((time - first - windowFrom) / Math.max(1e-6, windowTo - windowFrom)) * (width - 70)
  const inWindow = (time: number) =>
    time - first >= windowFrom - 1e-9 && time - first <= windowTo + 1e-9
  const clipId = `${id.replace(/:/g, '')}-clip`
  const y = (value: number, field: (typeof fields)[number]) =>
    64 - ((value - bounds[field][0]) / (bounds[field][1] - bounds[field][0])) * 54
  const cycling = breath.findIndex((s) => s.phase === 'expiration')
  const highlighted = stop === 'trigger' || stop === 'cycling' ? stop : sample.phase
  const from = highlighted === 'expiration' ? breath[cycling]?.time : first
  const to = highlighted === 'inspiration' ? breath[cycling]?.time : breath.at(-1)!.time
  const volumeClause = anchored
    ? `volume ${previous.volumeMl.toFixed(0)} to ${sample.volumeMl.toFixed(0)} mL above this breath’s first inspiratory sample`
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
        {guided ? ' · Worked demonstration' : ''}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${layout.rowsHeight + 23}`} role="img" aria-label={text}>
        {zoomed ? (
          <defs>
            <clipPath id={clipId}>
              <rect x="50" y="0" width={Math.max(0, width - 70)} height={layout.rowsHeight} />
            </clipPath>
          </defs>
        ) : null}
        {fields.map((field, row) => (
          <g key={field} transform={`translate(0 ${row * layout.pitch})`}>
            <text x="0" y="12" data-row-label={field}>
              {layout.labels[row].map((line, i, lines) => (
                <tspan key={line} x="0" dy={i === 0 ? 0 : BREATH_LABEL_LINE_PX}>
                  {i < lines.length - 1 ? `${line} ` : line}
                </tspan>
              ))}
            </text>
            <g transform={`translate(0 ${layout.plotTop})`}>
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
                  clipPath={zoomed ? `url(#${clipId})` : undefined}
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
                d={drawn
                  .map(
                    (s, i) =>
                      `${i ? 'L' : 'M'}${x(s.time).toFixed(2)} ${y(s[field], field).toFixed(2)}`,
                  )
                  .join(' ')}
                className={styles.breathTrace}
                clipPath={zoomed ? `url(#${clipId})` : undefined}
              />
              {guided && cycling > 0 && inWindow(breath[cycling].time) ? (
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
              {evidence && inWindow(evidence.sample.time) ? (
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
              {inWindow(rawSample.time) ? (
                <line
                  x1={x(rawSample.time)}
                  x2={x(rawSample.time)}
                  y1="7"
                  y2="66"
                  className={styles.cursor}
                  data-time-cursor={rawSample.time}
                />
              ) : null}
            </g>
          </g>
        ))}
        {/*
         * Only the two ends of the time axis are drawn here. Its title is the line under the
         * figure: as SVG text centred between them it ran into the first tick on a phone-width
         * figure, and it cannot wrap. The axis and its scale are unchanged.
         */}
        <text x="50" y={layout.rowsHeight + 20} data-time-tick="start">
          {windowFrom.toFixed(zoomed ? 2 : 0)}
        </text>
        <text x={width - 20} y={layout.rowsHeight + 20} textAnchor="end" data-time-tick="end">
          {windowTo.toFixed(2)}
        </text>
      </svg>
      <p className={styles.axisCaption} data-time-axis>
        {whole ? BREATH_TIME_AXIS_LABEL : TRACE_TIME_AXIS_LABEL}
        {zoomed ? ' · zoomed' : ''}
      </p>
      <p
        className={styles.quickNote}
        data-breath-duration={duration.toFixed(2)}
        data-sample-spacing={spacing.toFixed(3)}
      >
        {whole ? 'Breath duration' : 'Trace length'} {duration.toFixed(2)} s
        {whole ? ', from its first inspiratory sample to the next breath’s' : ''}
        {spacing > 0
          ? ` · samples every ${Math.round(spacing * 1000)} ms, so a time is resolved to one sample`
          : ''}{' '}
        ·{' '}
        {durationSeconds
          ? 'Shared comparison time and signal scales'
          : 'One time axis for all signals'}
      </p>
      {zoomed ? (
        <p className={styles.quickNote} data-zoom-window>
          Showing {windowFrom.toFixed(2)}–{windowTo.toFixed(2)} s of this {duration.toFixed(2)}-s
          breath{whole ? `, counted from its ${BREATH_ORIGIN}` : ''}. The same seconds are spread
          wider; nothing is retimed or resampled.
        </p>
      ) : null}
      {anchored ? (
        <p
          className={styles.quickNote}
          data-volume-anchor={anchorMl.toFixed(0)}
          data-first-step-ml={origin?.firstStepMl?.toFixed(1)}
        >
          Volume and time are counted from this breath’s {BREATH_ORIGIN}: a convention of the
          sampled trace, not the instant inspiration began.{' '}
          {origin && origin.precedingMl !== null && origin.firstStepMl !== null && spacing > 0
            ? `A sample is recorded after each ${Math.round(spacing * 1000)}-ms step, so that sample already holds one step of flow: raw lung volume was ${origin.precedingMl.toFixed(1)} mL above the trace baseline in the sample before it and ${origin.originMl.toFixed(1)} mL in it. ${
                Math.abs(origin.firstStepMl) < 0.5
                  ? 'Here that step is under 1 mL, so the drawn rise is within 1 mL of the volume this breath received.'
                  : `The drawn rise is therefore about ${Math.abs(origin.firstStepMl).toFixed(0)} mL ${origin.firstStepMl >= 0 ? 'less' : 'more'} than the volume this breath received.`
              } `
            : ''}
          Raw lung volume was {breath.at(-1)!.volumeMl.toFixed(0)} mL when the breath ended; gas
          that has not left is still in the raw signal, and the trace is not forced back to zero.
          The drawn rise and the ventilator’s exhaled volume are different quantities and need not
          agree.
        </p>
      ) : (
        <p className={styles.quickNote}>
          This slice does not begin at a verified inspiratory onset, so the raw lung-volume signal
          is drawn under its own name rather than re-zeroed.
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
