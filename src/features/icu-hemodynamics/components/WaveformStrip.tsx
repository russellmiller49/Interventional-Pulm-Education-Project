'use client'

import { useId, useMemo } from 'react'

import type { HemodynamicWaveformSample } from '../engine'
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
  const normalized = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
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
  referenceValue,
  referenceLabel,
  transitionFrom,
  unavailableMessage,
  phaseCursor,
}: WaveformStripProps) {
  const gridId = useId()

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
        const x = ((sample.time - window.first) / window.duration) * VIEW_WIDTH
        const value =
          transitionFrom && sample.time < transitionFrom.untilTime
            ? sample[transitionFrom.field]
            : sample[field]
        const y = valueToY(value, minimum, maximum)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [field, maximum, minimum, transitionFrom, unavailableMessage, visibleSamples, window])

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
    const firstBeat = Math.floor(window.first / cycleSeconds)
    const lastBeat = Math.ceil(window.last / cycleSeconds)

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
          x: ((time - window.first) / window.duration) * VIEW_WIDTH,
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
    return placed
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
      ? ` ${referenceLabel ?? 'Reference'} ${referenceValue.toFixed(0)} ${unit}.`
      : ''
  const transitionSummary = transitionFrom
    ? ` The marker identifies ${transitionFrom.label}, where the displayed channel changes morphology.`
    : ''
  const phaseCursorSummary =
    phaseCursor && phaseCursor.time >= window.first && phaseCursor.time <= window.last
      ? ` ${phaseCursor.label} cursor at ${phaseCursor.time.toFixed(1)} seconds${
          phaseCursor.value === undefined
            ? '.'
            : `, ${phaseCursor.value.toFixed(0)} ${unit} on the trace.`
        }`
      : ''
  const summary = unavailableMessage
    ? `${label} channel unavailable. ${unavailableMessage}`
    : `${label} waveform over ${sweepSeconds} seconds, range ${low.toFixed(1)} to ${high.toFixed(1)} ${unit}.${referenceSummary}${landmarkSummary}${transitionSummary}${phaseCursorSummary}`
  const ticks = showScale ? scaleTicks(minimum, maximum) : []
  const referenceY =
    !unavailableMessage && referenceValue !== undefined && Number.isFinite(referenceValue)
      ? valueToY(referenceValue, minimum, maximum)
      : null
  const transitionX =
    transitionFrom &&
    transitionFrom.untilTime >= window.first &&
    transitionFrom.untilTime <= window.last
      ? ((transitionFrom.untilTime - window.first) / window.duration) * VIEW_WIDTH
      : null
  const phaseCursorX =
    phaseCursor && phaseCursor.time >= window.first && phaseCursor.time <= window.last
      ? ((phaseCursor.time - window.first) / window.duration) * VIEW_WIDTH
      : null
  const phaseCursorY =
    phaseCursor?.value !== undefined && Number.isFinite(phaseCursor.value)
      ? valueToY(phaseCursor.value, minimum, maximum)
      : null

  return (
    <figure className={styles.waveformStrip} style={{ '--trace': color } as React.CSSProperties}>
      <figcaption>
        <strong>{label}</strong>
        <span>{unit}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
      >
        <defs>
          <pattern id={`grid-${gridId}`} width="50" height="26" patternUnits="userSpaceOnUse">
            <path
              d="M 50 0 L 0 0 0 26"
              fill="none"
              stroke="rgba(117,194,184,.12)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill={`url(#grid-${gridId})`} />

        {unavailableMessage ? (
          <text
            className={styles.stripUnavailable}
            x={VIEW_WIDTH / 2}
            y={VIEW_HEIGHT / 2}
            textAnchor="middle"
          >
            {unavailableMessage}
          </text>
        ) : null}

        {referenceY !== null ? (
          <g className={styles.stripReference}>
            <line x1="0" x2={VIEW_WIDTH} y1={referenceY} y2={referenceY} />
            <text x={VIEW_WIDTH - 8} y={Math.max(12, referenceY - 4)} textAnchor="end">
              {referenceLabel ?? 'mean'} {referenceValue?.toFixed(0)}
            </text>
          </g>
        ) : null}

        {ticks.map((tick) => {
          const y = valueToY(tick, minimum, maximum)
          return (
            <g key={tick} className={styles.stripScale}>
              <line x1="0" x2={VIEW_WIDTH} y1={y} y2={y} />
              <text x="6" y={y - 3}>
                {tick}
              </text>
            </g>
          )
        })}

        {phaseCursorX !== null && phaseCursor ? (
          <g className={styles.stripPhaseCursor}>
            <line x1={phaseCursorX} x2={phaseCursorX} y1={TRACE_TOP} y2={TRACE_BOTTOM} />
            <text
              x={phaseCursorX > VIEW_WIDTH * 0.76 ? phaseCursorX - 8 : phaseCursorX + 8}
              y={14}
              textAnchor={phaseCursorX > VIEW_WIDTH * 0.76 ? 'end' : 'start'}
            >
              {phaseCursor.label}
            </text>
          </g>
        ) : null}

        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />

        {phaseCursorX !== null && phaseCursorY !== null ? (
          <g className={styles.stripPhaseCursorPoint}>
            <line
              x1={Math.max(0, phaseCursorX - 15)}
              x2={Math.min(VIEW_WIDTH, phaseCursorX + 15)}
              y1={phaseCursorY}
              y2={phaseCursorY}
            />
            <circle cx={phaseCursorX} cy={phaseCursorY} r="4" />
          </g>
        ) : null}

        {transitionX !== null && transitionFrom ? (
          <g className={styles.stripTransition}>
            <line x1={transitionX} x2={transitionX} y1={TRACE_TOP} y2={TRACE_BOTTOM} />
            <text
              x={transitionX > VIEW_WIDTH * 0.72 ? transitionX - 8 : transitionX + 8}
              y={18}
              textAnchor={transitionX > VIEW_WIDTH * 0.72 ? 'end' : 'start'}
            >
              {transitionFrom.label}
            </text>
          </g>
        ) : null}

        {placedLandmarks.map((landmark) => (
          <g key={landmark.id} className={styles.stripLandmark}>
            <circle cx={landmark.x} cy={landmark.y} r="3" />
            <text
              x={landmark.x}
              y={landmark.placement === 'above' ? landmark.y - 8 : landmark.y + 14}
              textAnchor="middle"
            >
              {landmark.label}
            </text>
          </g>
        ))}
      </svg>
      <span className={styles.srOnly}>Waveform text: {summary}</span>
    </figure>
  )
}
