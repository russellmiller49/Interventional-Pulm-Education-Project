'use client'

import { useId, useMemo } from 'react'

import type { HemodynamicWaveformSample } from '../engine'
import { fixedWithoutNegativeZero } from '../engine/numberFormat'
import styles from './icu-hemodynamics.module.css'
import strip from './waveform-strip.module.css'

type WaveformField = Exclude<keyof HemodynamicWaveformSample, 'time'>

export interface WaveformLandmark {
  readonly id: string
  readonly label: string
  /** Fraction of the cardiac cycle at which this landmark occurs. */
  readonly phase: number
  readonly placement: 'above' | 'below'
}

export interface WaveformPhaseCursor {
  readonly time: number
  readonly label: string
  /** Optional pressure at the selected phase; when present, a point is placed on the trace. */
  readonly value?: number
}

/**
 * Where the measurement system changed while this strip was being drawn.
 *
 * The samples left of it were drawn under the earlier setting and the samples right of it under
 * the new one, so the step between them is a change in the instrument, not in the patient.
 */
export interface WaveformStripSeam {
  readonly fromTime: number
  readonly untilTime: number
  readonly label: string
}

interface WaveformStripProps {
  samples: readonly HemodynamicWaveformSample[]
  field: WaveformField
  label: string
  unit: string
  minimum: number
  maximum: number
  color: string
  sweepSeconds: number
  /** Wave landmarks to label. Used when the trace is frozen or held for teaching. */
  landmarks?: readonly WaveformLandmark[]
  /** Heart rate, required to place landmarks on the correct beat. */
  heartRateBpm?: number
  /** Draws a calibrated pressure axis. Off for non-pressure channels. */
  showScale?: boolean
  /** Keep axis text readable in the focused activity view. */
  readable?: boolean
  /** Numerical reference drawn across the trace, such as MAP or end-expiratory mean pressure. */
  referenceValue?: number
  referenceLabel?: string
  /** Uses the prior field to the left of a transition marker, then the primary field. */
  transitionFrom?: {
    readonly field: WaveformField
    readonly untilTime: number
    readonly label: string
  }
  /** Renders an explicitly unavailable channel instead of implying a chamber waveform. */
  unavailableMessage?: string
  /** Phase-specific cursor, such as the shared end-expiratory cursor across ART and CVP. */
  phaseCursor?: WaveformPhaseCursor
  /** Measurement-system changes inside the drawn window. */
  seams?: readonly WaveformStripSeam[]
  /** A still copy rather than the live tracing: said in the strip's own description. */
  stillCopy?: boolean
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 104
const TRACE_TOP = 6
const TRACE_BOTTOM = 98

/**
 * A value's height on the plot.
 *
 * Deliberately unbounded. This used to clamp the value into the axis, which drew every sample above
 * the axis maximum *at* the maximum: a pressure that left the scale became a flat line at the top of
 * it, and read as a plateau (report L3-02, in this renderer rather than the reference figure). The
 * coordinate is now the sample's own; the plot clips what falls outside it, and the strip says so.
 */
function valueToY(value: number, minimum: number, maximum: number): number {
  return TRACE_BOTTOM - ((value - minimum) / (maximum - minimum)) * (TRACE_BOTTOM - TRACE_TOP)
}

function percent(value: number, whole: number): string {
  return `${((value / whole) * 100).toFixed(3)}%`
}

/** Three evenly spaced ticks keep the axis readable at strip height. */
function scaleTicks(minimum: number, maximum: number): number[] {
  const middle = Math.round((minimum + maximum) / 2)
  return [maximum, middle, minimum]
}

/** Where a label hangs relative to a height on the plot, so an edge label is never cut off. */
function verticalAnchor(y: number): 'top' | 'middle' | 'bottom' {
  const fraction = y / VIEW_HEIGHT
  return fraction < 0.16 ? 'top' : fraction > 0.84 ? 'bottom' : 'middle'
}

/** Contiguous stretches of the window in which the trace is outside the axis. */
function offScaleRuns(
  points: readonly { readonly x: number; readonly y: number }[],
  edge: 'top' | 'bottom',
): { readonly from: number; readonly until: number }[] {
  const runs: { from: number; until: number }[] = []
  let open: { from: number; until: number } | null = null
  for (const point of points) {
    const outside = edge === 'top' ? point.y < TRACE_TOP : point.y > TRACE_BOTTOM
    if (outside) {
      if (open) open.until = point.x
      else open = { from: point.x, until: point.x }
    } else if (open) {
      runs.push(open)
      open = null
    }
  }
  if (open) runs.push(open)
  return runs
}

export function WaveformStrip({
  samples,
  field,
  label,
  unit,
  minimum,
  maximum,
  color,
  sweepSeconds,
  landmarks,
  heartRateBpm,
  showScale = false,
  readable = false,
  referenceValue,
  referenceLabel,
  transitionFrom,
  unavailableMessage,
  phaseCursor,
  seams,
  stillCopy = false,
}: WaveformStripProps) {
  const patternId = useId()
  const clipId = useId()

  const visibleSamples = useMemo(() => {
    const latest = samples.at(-1)?.time ?? 0
    return samples.filter((sample) => sample.time >= latest - sweepSeconds)
  }, [samples, sweepSeconds])

  const window = useMemo(() => {
    const first = visibleSamples[0]?.time ?? 0
    const last = visibleSamples.at(-1)?.time ?? first
    return { first, last, duration: Math.max(0.02, last - first) }
  }, [visibleSamples])

  const timeToX = (time: number) => ((time - window.first) / window.duration) * VIEW_WIDTH

  const drawn = useMemo(() => {
    if (unavailableMessage || visibleSamples.length < 2) return []
    return visibleSamples.map((sample) => {
      const value =
        transitionFrom && sample.time < transitionFrom.untilTime
          ? sample[transitionFrom.field]
          : sample[field]
      return {
        time: sample.time,
        value,
        x: ((sample.time - window.first) / window.duration) * VIEW_WIDTH,
        y: valueToY(value, minimum, maximum),
      }
    })
  }, [field, maximum, minimum, transitionFrom, unavailableMessage, visibleSamples, window])

  const visibleSeams = useMemo(
    () =>
      (seams ?? []).filter(
        (seam) => seam.untilTime >= window.first && seam.fromTime <= window.last && drawn.length,
      ),
    [drawn.length, seams, window],
  )

  /*
   * The trace, broken at each seam. A change of transducer height or zero, or a repaired line,
   * changes every sample drawn after it and none drawn before it, so the two halves of the strip
   * are different instruments. Joining them drew a vertical step that read as an event in the
   * patient (report L2-06). The line is left open across the change and the older half is dimmed.
   */
  const segments = useMemo(() => {
    if (drawn.length === 0) return []
    const boundaries = visibleSeams
      .map((seam) => ({ from: seam.fromTime, until: seam.untilTime }))
      .sort((left, right) => left.from - right.from)
    const parts: { points: string; earlier: boolean }[] = []
    let current: string[] = []
    let currentEpoch = -1
    const flush = () => {
      if (current.length > 1) {
        parts.push({ points: current.join(' '), earlier: currentEpoch < boundaries.length })
      }
      current = []
    }
    for (const point of drawn) {
      // While a setting was being changed the samples belong to neither side of it.
      if (
        boundaries.some((boundary) => point.time > boundary.from && point.time < boundary.until)
      ) {
        flush()
        continue
      }
      // The epoch is how many changes this sample was drawn after.
      const epoch = boundaries.filter((boundary) => point.time >= boundary.until).length
      if (epoch !== currentEpoch) flush()
      currentEpoch = epoch
      current.push(`${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    }
    flush()
    return parts
  }, [drawn, visibleSeams])

  const above = useMemo(() => offScaleRuns(drawn, 'top'), [drawn])
  const below = useMemo(() => offScaleRuns(drawn, 'bottom'), [drawn])
  const exceedsScale = above.length > 0 || below.length > 0

  // Landmarks repeat on every beat inside the visible window. The engine derives cardiac phase
  // from time modulo the cycle length, so beat boundaries fall on multiples of the cycle.
  const placedLandmarks = useMemo(() => {
    if (!landmarks || landmarks.length === 0 || !heartRateBpm || drawn.length < 2) return []
    const cycleSeconds = 60 / heartRateBpm
    const firstBeat = Math.floor(window.first / cycleSeconds)
    const lastBeat = Math.ceil(window.last / cycleSeconds)
    const beatsInWindow = window.duration / cycleSeconds
    /*
     * Every beat is labelled only when the beats are wide enough to carry the labels. On a full
     * sweep eight beats of five labels each wrote over one another and over the trace; there, one
     * complete beat is labelled and the rest are left clean.
     */
    const labelEvery = beatsInWindow <= 3.2
    const completeBeats: number[] = []
    for (let beat = firstBeat; beat <= lastBeat; beat += 1) {
      if (beat * cycleSeconds >= window.first && (beat + 1) * cycleSeconds <= window.last) {
        completeBeats.push(beat)
      }
    }
    const chosen = labelEvery
      ? Array.from({ length: lastBeat - firstBeat + 1 }, (_, index) => firstBeat + index)
      : completeBeats.slice(-1)
    const placed: {
      id: string
      label: string
      x: number
      y: number
      placement: 'above' | 'below'
      row: number
    }[] = []
    for (const beat of chosen) {
      let aboveCount = 0
      let belowCount = 0
      for (const landmark of landmarks) {
        const time = (beat + landmark.phase) * cycleSeconds
        if (time < window.first || time > window.last) continue
        const nearest = drawn.reduce((best, candidate) =>
          Math.abs(candidate.time - time) < Math.abs(best.time - time) ? candidate : best,
        )
        // A landmark outside the axis is not drawn at the axis: that would claim a value there.
        if (nearest.y < TRACE_TOP || nearest.y > TRACE_BOTTOM) continue
        placed.push({
          id: `${landmark.id}-${beat}`,
          label: landmark.label,
          x: timeToX(time),
          y: nearest.y,
          placement: landmark.placement,
          // Neighbouring labels on the same side take alternate tracks, so `a` and `c` — a sixth
          // of a beat apart — never share a line.
          row: landmark.placement === 'above' ? aboveCount++ % 2 : belowCount++ % 2,
        })
      }
    }
    return placed
    // `timeToX` is a function of `window`, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, heartRateBpm, landmarks, window])

  const values = drawn.map((point) => point.value)
  const low = values.length > 0 ? Math.min(...values) : 0
  const high = values.length > 0 ? Math.max(...values) : 0
  const referenceShown =
    !unavailableMessage && referenceValue !== undefined && Number.isFinite(referenceValue)
  const referenceY = referenceShown ? valueToY(referenceValue, minimum, maximum) : null
  const referenceInRange =
    referenceY !== null && referenceY >= TRACE_TOP - 0.01 && referenceY <= TRACE_BOTTOM + 0.01
  const referenceText = referenceShown
    ? `${referenceLabel ?? 'mean'} ${fixedWithoutNegativeZero(referenceValue)}`
    : ''
  const cursorInWindow =
    phaseCursor !== undefined &&
    phaseCursor.time >= window.first &&
    phaseCursor.time <= window.last &&
    !unavailableMessage
  const phaseCursorX = cursorInWindow && phaseCursor ? timeToX(phaseCursor.time) : null
  const phaseCursorY =
    cursorInWindow && phaseCursor?.value !== undefined && Number.isFinite(phaseCursor.value)
      ? valueToY(phaseCursor.value, minimum, maximum)
      : null
  const cursorPointInRange =
    phaseCursorY !== null && phaseCursorY >= TRACE_TOP && phaseCursorY <= TRACE_BOTTOM
  const transitionX =
    transitionFrom &&
    !unavailableMessage &&
    transitionFrom.untilTime >= window.first &&
    transitionFrom.untilTime <= window.last
      ? timeToX(transitionFrom.untilTime)
      : null

  const axisWords = `${fixedWithoutNegativeZero(minimum)} to ${fixedWithoutNegativeZero(maximum)} ${unit}`
  const rangeNotice = exceedsScale
    ? `Trace exceeds the displayed ${axisWords} axis; out-of-range portions are clipped, not flattened, and their landmarks are not shown. Sampled pressures are unchanged.`
    : ''
  const landmarkSummary =
    placedLandmarks.length > 0
      ? ` Labeled wave components: ${[...new Set((landmarks ?? []).map((item) => item.label))].join(', ')}.`
      : ''
  const referenceSummary = referenceShown
    ? ` ${referenceLabel ?? 'Reference'} ${fixedWithoutNegativeZero(referenceValue)} ${unit}${
        referenceInRange ? '' : ', outside the displayed axis'
      }.`
    : ''
  const transitionSummary =
    transitionFrom && !unavailableMessage
      ? ` The marker identifies ${transitionFrom.label}, where the displayed channel changes morphology.`
      : ''
  const phaseCursorSummary =
    cursorInWindow && phaseCursor
      ? ` ${phaseCursor.label} cursor at ${phaseCursor.time.toFixed(1)} seconds${
          phaseCursor.value === undefined
            ? '.'
            : `, ${fixedWithoutNegativeZero(phaseCursor.value)} ${unit} on the trace.`
        }`
      : ''
  const seamSummary = visibleSeams
    .map(
      (seam) =>
        ` At ${seam.untilTime.toFixed(1)} seconds the ${seam.label}; the tracing before that marker was drawn under the earlier setting, so the step there is not a change in the patient.`,
    )
    .join('')
  const windowWords = stillCopy
    ? `still copy of ${window.duration.toFixed(1)} seconds ending at ${window.last.toFixed(1)} seconds`
    : `waveform over ${sweepSeconds} seconds`
  const summary = unavailableMessage
    ? `${label} channel unavailable. ${unavailableMessage}`
    : `${label} ${windowWords}, range ${fixedWithoutNegativeZero(low, 1)} to ${fixedWithoutNegativeZero(high, 1)} ${unit}${
        showScale ? `, drawn on a ${axisWords} axis` : ''
      }.${referenceSummary}${landmarkSummary}${transitionSummary}${phaseCursorSummary}${seamSummary}${
        rangeNotice ? ` ${rangeNotice}` : ''
      }`
  const ticks = showScale ? scaleTicks(minimum, maximum) : []
  const hasMarkerTrack =
    showScale && !unavailableMessage && (phaseCursor !== undefined || transitionFrom !== undefined)
  const markerLabels = [
    phaseCursorX !== null && phaseCursor
      ? { id: 'cursor', x: phaseCursorX, text: phaseCursor.label, kind: 'cursor' as const }
      : null,
    transitionX !== null && transitionFrom
      ? {
          id: 'transition',
          x: transitionX,
          text: transitionFrom.label,
          kind: 'transition' as const,
        }
      : null,
    ...visibleSeams.map((seam, index) => ({
      id: `seam-${index}`,
      x: Math.max(0, Math.min(VIEW_WIDTH, timeToX(seam.untilTime))),
      text: seam.label,
      kind: 'seam' as const,
    })),
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  return (
    <figure
      className={`${styles.waveformStrip}${stillCopy ? ` ${strip.stillCopy}` : ''}`}
      style={{ '--trace': color } as React.CSSProperties}
      data-waveform-strip={field}
      data-out-of-range={exceedsScale || undefined}
      data-still-copy={stillCopy || undefined}
    >
      <figcaption>
        <strong>{label}</strong>
        <span>{unit}</span>
      </figcaption>
      {/* The frame is the size container: the body's own columns answer to its width. */}
      <div className={strip.frame}>
        <div className={strip.body} data-readable={readable || undefined}>
          {hasMarkerTrack || markerLabels.length > 0 ? (
            <div
              className={strip.markerTrack}
              aria-hidden="true"
              data-strip-marker-track
              style={
                { '--strip-marker-rows': Math.max(1, markerLabels.length) } as React.CSSProperties
              }
            >
              {markerLabels.map((marker, row) => (
                <span
                  key={marker.id}
                  className={strip.markerLabel}
                  data-kind={marker.kind}
                  data-strip-marker={marker.kind}
                  style={
                    {
                      '--strip-x': percent(marker.x, VIEW_WIDTH),
                      '--strip-row': row,
                    } as React.CSSProperties
                  }
                >
                  {marker.text}
                </span>
              ))}
            </div>
          ) : null}
          {/* Rendered for every strip, scaled or not, so stacked plots share their edges. */}
          <div className={strip.axis} aria-hidden="true" data-strip-axis>
            {ticks.map((tick) => {
              const y = valueToY(tick, minimum, maximum)
              return (
                <span
                  key={tick}
                  className={strip.tick}
                  data-anchor={verticalAnchor(y)}
                  style={{ '--strip-y': percent(y, VIEW_HEIGHT) } as React.CSSProperties}
                >
                  {fixedWithoutNegativeZero(tick)}
                </span>
              )
            })}
          </div>
          <div className={strip.plot} data-strip-plot>
            <svg
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={summary}
            >
              <defs>
                <pattern
                  id={`grid-${patternId}`}
                  width="50"
                  height="26"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 50 0 L 0 0 0 26"
                    fill="none"
                    stroke="rgba(117,194,184,.12)"
                    strokeWidth="1"
                  />
                </pattern>
                <clipPath id={clipId}>
                  <rect x="0" y={TRACE_TOP} width={VIEW_WIDTH} height={TRACE_BOTTOM - TRACE_TOP} />
                </clipPath>
              </defs>
              <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill={`url(#grid-${patternId})`} />

              {ticks.map((tick) => {
                const y = valueToY(tick, minimum, maximum)
                return (
                  <line
                    key={tick}
                    className={strip.scaleLine}
                    x1="0"
                    x2={VIEW_WIDTH}
                    y1={y}
                    y2={y}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}

              {referenceY !== null && referenceInRange ? (
                <line
                  className={strip.referenceLine}
                  data-strip-reference-line
                  x1="0"
                  x2={VIEW_WIDTH}
                  y1={referenceY}
                  y2={referenceY}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {visibleSeams.map((seam, index) => {
                const from = Math.max(0, timeToX(seam.fromTime))
                const until = Math.min(VIEW_WIDTH, timeToX(seam.untilTime))
                return (
                  <rect
                    key={index}
                    className={strip.seam}
                    data-strip-seam
                    x={Math.min(from, until - 6)}
                    y="0"
                    width={Math.max(6, until - from)}
                    height={VIEW_HEIGHT}
                  />
                )
              })}

              {phaseCursorX !== null ? (
                <line
                  className={strip.phaseCursorLine}
                  x1={phaseCursorX}
                  x2={phaseCursorX}
                  y1="0"
                  y2={VIEW_HEIGHT}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {transitionX !== null ? (
                <line
                  className={strip.transitionLine}
                  x1={transitionX}
                  x2={transitionX}
                  y1="0"
                  y2={VIEW_HEIGHT}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              <g clipPath={`url(#${clipId})`}>
                {segments.map((segment, index) => (
                  <polyline
                    key={index}
                    data-strip-trace={segment.earlier ? 'earlier' : 'current'}
                    points={segment.points}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeOpacity={segment.earlier ? 0.5 : 1}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>

              {above.map((run, index) => (
                <rect
                  key={`above-${index}`}
                  className={strip.offScale}
                  data-strip-off-scale="above"
                  x={Math.max(0, run.from - 2)}
                  y="0"
                  width={Math.max(6, run.until - run.from + 4)}
                  height={TRACE_TOP}
                />
              ))}
              {below.map((run, index) => (
                <rect
                  key={`below-${index}`}
                  className={strip.offScale}
                  data-strip-off-scale="below"
                  x={Math.max(0, run.from - 2)}
                  y={TRACE_BOTTOM}
                  width={Math.max(6, run.until - run.from + 4)}
                  height={VIEW_HEIGHT - TRACE_BOTTOM}
                />
              ))}
            </svg>

            <div className={strip.overlay} aria-hidden="true">
              {unavailableMessage ? (
                <span className={strip.unavailable}>
                  {readable ? 'No chamber waveform' : unavailableMessage}
                </span>
              ) : null}
              {phaseCursorX !== null && cursorPointInRange && phaseCursorY !== null ? (
                <span
                  className={strip.cursorPoint}
                  data-strip-cursor-point
                  style={
                    {
                      '--strip-x': percent(phaseCursorX, VIEW_WIDTH),
                      '--strip-y': percent(phaseCursorY, VIEW_HEIGHT),
                    } as React.CSSProperties
                  }
                />
              ) : null}
              {placedLandmarks.map((landmark) => (
                <span
                  key={landmark.id}
                  className={strip.landmark}
                  data-placement={landmark.placement}
                  data-row={landmark.row}
                  data-strip-landmark={landmark.label}
                  style={
                    {
                      '--strip-x': percent(landmark.x, VIEW_WIDTH),
                      '--strip-y': percent(landmark.y, VIEW_HEIGHT),
                    } as React.CSSProperties
                  }
                >
                  <i />
                  <b>{landmark.label}</b>
                </span>
              ))}
            </div>
          </div>
          <div className={strip.tags} aria-hidden="true" data-strip-tags>
            {referenceShown ? (
              <>
                <span
                  className={strip.tag}
                  data-strip-tag="reference"
                  data-in-range={referenceInRange}
                  data-anchor={
                    referenceInRange && referenceY !== null
                      ? verticalAnchor(referenceY)
                      : referenceY !== null && referenceY < TRACE_TOP
                        ? 'top'
                        : 'bottom'
                  }
                  style={
                    {
                      '--strip-y': percent(
                        Math.max(TRACE_TOP, Math.min(TRACE_BOTTOM, referenceY ?? TRACE_TOP)),
                        VIEW_HEIGHT,
                      ),
                    } as React.CSSProperties
                  }
                >
                  {referenceText}
                  {referenceInRange ? null : <small> · off this axis</small>}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {rangeNotice ? (
        <p className={strip.rangeNote} data-waveform-range-note>
          {rangeNotice}
        </p>
      ) : null}
      {readable && unavailableMessage ? (
        <p className={styles.stripAvailabilityNote}>{unavailableMessage}</p>
      ) : null}
      <span className={styles.srOnly}>Waveform text: {summary}</span>
    </figure>
  )
}
