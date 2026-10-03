'use client'

import { useId, useMemo } from 'react'

import type { HemodynamicWaveformSample } from '../engine'
import { useScreenSpacePlot } from './useScreenSpacePlot'
import { displayNumber } from './displayNumber'
import styles from './icu-hemodynamics.module.css'

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

interface WaveformStripProps {
  samples: readonly HemodynamicWaveformSample[]
  field: WaveformField
  label: string
  unit: string
  minimum: number
  maximum: number
  color: string
  sweepSeconds: number
  /** Wave landmarks to label on each beat. Used when the trace is frozen for teaching. */
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
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 104
const TRACE_TOP = 10
const TRACE_BOTTOM = 96

function valueToY(value: number, minimum: number, maximum: number): number {
  const normalized = (value - minimum) / (maximum - minimum)
  return TRACE_BOTTOM - normalized * (TRACE_BOTTOM - TRACE_TOP)
}

/** Three evenly spaced ticks keep the axis readable at strip height. */
function scaleTicks(minimum: number, maximum: number): number[] {
  const middle = Math.round((minimum + maximum) / 2)
  return [maximum, middle, minimum]
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
}: WaveformStripProps) {
  const gridId = useId()
  const { ref: plotRef, width: viewWidth } = useScreenSpacePlot(readable ? 440 : VIEW_WIDTH)
  const plotLeft = showScale ? 64 : 0
  const plotWidth = viewWidth - plotLeft
  const clipId = `${gridId}-clip`

  const visibleSamples = useMemo(() => {
    const latest = samples.at(-1)?.time ?? 0
    return samples.filter((sample) => sample.time >= latest - sweepSeconds)
  }, [samples, sweepSeconds])

  const window = useMemo(() => {
    const first = visibleSamples[0]?.time ?? 0
    const last = visibleSamples.at(-1)?.time ?? first
    return { first, last, duration: Math.max(0.02, last - first) }
  }, [visibleSamples])

  const points = useMemo(() => {
    if (unavailableMessage || visibleSamples.length < 2) return ''
    return visibleSamples
      .map((sample) => {
        const x = plotLeft + ((sample.time - window.first) / window.duration) * plotWidth
        const value =
          transitionFrom && sample.time < transitionFrom.untilTime
            ? sample[transitionFrom.field]
            : sample[field]
        const y = valueToY(value, minimum, maximum)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [
    field,
    maximum,
    minimum,
    transitionFrom,
    unavailableMessage,
    visibleSamples,
    window,
    plotLeft,
    plotWidth,
  ])

  // Landmarks repeat on every beat inside the visible window. The engine derives cardiac phase
  // from time modulo the cycle length, so beat boundaries fall on multiples of the cycle.
  const placedLandmarks = useMemo(() => {
    if (
      unavailableMessage ||
      !landmarks ||
      landmarks.length === 0 ||
      !heartRateBpm ||
      visibleSamples.length < 2
    ) {
      return []
    }
    const cycleSeconds = 60 / heartRateBpm
    const placed: { id: string; label: string; x: number; y: number; placement: string }[] = []
    const firstBeat =
      window.duration <= cycleSeconds * 1.1
        ? Math.floor(window.first / cycleSeconds)
        : Math.ceil(window.first / cycleSeconds)
    const lastBeat =
      window.duration <= cycleSeconds * 1.1 ? Math.ceil(window.last / cycleSeconds) : firstBeat

    for (let beat = firstBeat; beat <= lastBeat; beat += 1) {
      for (const landmark of landmarks) {
        const time = (beat + landmark.phase) * cycleSeconds
        if (time < window.first || time > window.last) continue
        const nearest = visibleSamples.reduce((best, candidate) =>
          Math.abs(candidate.time - time) < Math.abs(best.time - time) ? candidate : best,
        )
        placed.push({
          id: `${landmark.id}-${beat}`,
          label: landmark.label,
          x: plotLeft + ((nearest.time - window.first) / window.duration) * plotWidth,
          y: valueToY(
            transitionFrom && nearest.time < transitionFrom.untilTime
              ? nearest[transitionFrom.field]
              : nearest[field],
            minimum,
            maximum,
          ),
          placement: landmark.placement,
        })
      }
    }
    return placed.filter((point) => point.y >= TRACE_TOP && point.y <= TRACE_BOTTOM)
  }, [
    field,
    heartRateBpm,
    landmarks,
    maximum,
    minimum,
    transitionFrom,
    unavailableMessage,
    visibleSamples,
    window,
    plotLeft,
    plotWidth,
  ])

  const values = unavailableMessage
    ? []
    : visibleSamples.map((sample) =>
        transitionFrom && sample.time < transitionFrom.untilTime
          ? sample[transitionFrom.field]
          : sample[field],
      )
  const low = values.length > 0 ? Math.min(...values) : 0
  const high = values.length > 0 ? Math.max(...values) : 0
  const landmarkSummary =
    placedLandmarks.length > 0
      ? ` Labeled wave components: ${[...new Set((landmarks ?? []).map((item) => item.label))].join(', ')}.`
      : ''
  const referenceSummary =
    referenceValue !== undefined && Number.isFinite(referenceValue)
      ? ` ${referenceLabel ?? 'Reference'} ${displayNumber(referenceValue)} ${unit}.`
      : ''
  const transitionSummary = transitionFrom
    ? ` The marker identifies ${transitionFrom.label}, where the displayed channel changes morphology.`
    : ''
  const phaseCursorSummary =
    phaseCursor && phaseCursor.time >= window.first && phaseCursor.time <= window.last
      ? ` ${phaseCursor.label} cursor at ${phaseCursor.time.toFixed(1)} seconds${
          phaseCursor.value === undefined
            ? '.'
            : `, ${displayNumber(phaseCursor.value)} ${unit} on the trace.`
        }`
      : ''
  const summary = unavailableMessage
    ? `${label} channel unavailable. ${unavailableMessage}`
    : `${label} waveform over ${sweepSeconds} seconds, range ${displayNumber(low, 1)} to ${displayNumber(high, 1)} ${unit}.${referenceSummary}${landmarkSummary}${transitionSummary}${phaseCursorSummary}`
  const ticks = showScale ? scaleTicks(minimum, maximum) : []
  const referenceY =
    !unavailableMessage && referenceValue !== undefined && Number.isFinite(referenceValue)
      ? valueToY(referenceValue, minimum, maximum)
      : null
  const transitionX =
    transitionFrom &&
    transitionFrom.untilTime >= window.first &&
    transitionFrom.untilTime <= window.last
      ? plotLeft + ((transitionFrom.untilTime - window.first) / window.duration) * plotWidth
      : null
  const phaseCursorX =
    phaseCursor && phaseCursor.time >= window.first && phaseCursor.time <= window.last
      ? plotLeft + ((phaseCursor.time - window.first) / window.duration) * plotWidth
      : null
  const phaseCursorY =
    phaseCursor?.value !== undefined && Number.isFinite(phaseCursor.value)
      ? valueToY(phaseCursor.value, minimum, maximum)
      : null

  return (
    <figure className={styles.waveformStrip} style={{ '--trace': color } as React.CSSProperties}>
      <figcaption>
        <strong>{label}</strong>
        <span>
          {unit}
          {showScale ? ` · axis ${minimum}–${maximum}` : ''}
        </span>
      </figcaption>
      <svg
        ref={plotRef}
        viewBox={`0 0 ${viewWidth} ${placedLandmarks.length ? VIEW_HEIGHT + 30 : VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={plotLeft} y={TRACE_TOP} width={plotWidth} height={TRACE_BOTTOM - TRACE_TOP} />
          </clipPath>
          <pattern id={`grid-${gridId}`} width="50" height="26" patternUnits="userSpaceOnUse">
            <path
              d="M 50 0 L 0 0 0 26"
              fill="none"
              stroke="rgba(117,194,184,.12)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={viewWidth} height={VIEW_HEIGHT} fill={`url(#grid-${gridId})`} />

        {unavailableMessage ? (
          <text
            className={styles.stripUnavailable}
            x={viewWidth / 2}
            y={VIEW_HEIGHT / 2}
            textAnchor="middle"
          >
            {readable ? 'No chamber waveform' : unavailableMessage}
          </text>
        ) : null}

        {referenceY !== null && referenceY >= TRACE_TOP && referenceY <= TRACE_BOTTOM ? (
          <g className={styles.stripReference}>
            <line x1={plotLeft} x2={viewWidth} y1={referenceY} y2={referenceY} />
          </g>
        ) : null}

        {ticks.map((tick) => {
          const y = valueToY(tick, minimum, maximum)
          return (
            <g key={tick} className={styles.stripScale}>
              <line x1={plotLeft} x2={viewWidth} y1={y} y2={y} />
              <text x="6" y={y - 3}>
                {tick}
              </text>
            </g>
          )
        })}

        {phaseCursorX !== null && phaseCursor ? (
          <g className={styles.stripPhaseCursor}>
            <line x1={phaseCursorX} x2={phaseCursorX} y1={TRACE_TOP} y2={TRACE_BOTTOM} />
          </g>
        ) : null}

        <polyline
          clipPath={`url(#${clipId})`}
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />

        {phaseCursorX !== null &&
        phaseCursorY !== null &&
        phaseCursorY >= TRACE_TOP &&
        phaseCursorY <= TRACE_BOTTOM ? (
          <g className={styles.stripPhaseCursorPoint}>
            <line
              x1={Math.max(0, phaseCursorX - 15)}
              x2={Math.min(viewWidth, phaseCursorX + 15)}
              y1={phaseCursorY}
              y2={phaseCursorY}
            />
            <circle cx={phaseCursorX} cy={phaseCursorY} r="4" />
          </g>
        ) : null}

        {transitionX !== null && transitionFrom ? (
          <g className={styles.stripTransition}>
            <line x1={transitionX} x2={transitionX} y1={TRACE_TOP} y2={TRACE_BOTTOM} />
          </g>
        ) : null}

        {placedLandmarks.map((landmark) => (
          <g key={landmark.id} className={styles.stripLandmark}>
            <circle cx={landmark.x} cy={landmark.y} r="3" />
            <line x1={landmark.x} x2={landmark.x} y1={landmark.y} y2={TRACE_BOTTOM + 12} />
            <text x={landmark.x} y={TRACE_BOTTOM + 25} textAnchor="middle">
              {placedLandmarks.indexOf(landmark) + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.stripReadouts}>
        {placedLandmarks.map((landmark, index) => (
          <span key={landmark.id}>
            {index + 1}. {landmark.label}
          </span>
        ))}
        {transitionX !== null && transitionFrom ? (
          <span>
            {transitionFrom.label} · {transitionFrom.untilTime.toFixed(2)} s
          </span>
        ) : null}
        {referenceY !== null ? (
          <span>
            {referenceLabel ?? 'Reference'}{' '}
            {referenceValue === undefined ? '—' : displayNumber(referenceValue)} {unit}
          </span>
        ) : null}
        {phaseCursorX !== null && phaseCursor ? (
          <span>
            {phaseCursor.label} · sample {phaseCursor.time.toFixed(2)} s
          </span>
        ) : null}
        {showScale && (low < minimum || high > maximum) ? (
          <span data-strip-range-note>
            Trace exceeds this axis; geometry is clipped. Samples are unchanged.
          </span>
        ) : null}
      </div>
      {readable && unavailableMessage ? (
        <p className={styles.stripAvailabilityNote}>{unavailableMessage}</p>
      ) : null}
      <span className={styles.srOnly}>Waveform text: {summary}</span>
    </figure>
  )
}
