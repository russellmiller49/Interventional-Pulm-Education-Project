'use client'

import { useId } from 'react'

import { CARDIAC_PHASE, ecgShapeMv } from '../engine/waveformMorphology'
import { applyPressureArtifact } from '../engine/waveformArtifacts'
import { waveformValueAt, type WaveformAtlasEntry } from '../content/waveformAtlas'
import styles from './icu-hemodynamics.module.css'

const VIEW_WIDTH = 660
const VIEW_HEIGHT = 232
const VIEW_HEIGHT_WITH_RESPIRATION = 274
const PLOT_LEFT = 54
const PLOT_RIGHT = 646
const ECG_TOP = 10
const ECG_BOTTOM = 46
const TRACE_TOP = 66
const TRACE_BOTTOM = 192
const RESPIRATION_TOP = 224
const RESPIRATION_BOTTOM = 258
const SAMPLES_PER_BEAT = 260
/** One drawn beat is one second, so artifact transforms that take a time get a deterministic one. */
const BEAT_SECONDS = 1

/**
 * A display fault applied to an otherwise correct trace.
 *
 * Every field describes the *display*, not the patient. The artifact transforms are the ones the
 * live monitor already uses, so a distortion taught in a figure and the same distortion selected at
 * the bedside monitor deform the trace identically — there is no second waveform implementation
 * here.
 */
export interface WaveformFigureFault {
  readonly levelOffsetMmHg?: number
  readonly scaleMaxMmHg?: number
  readonly artifact?: 'overdamped' | 'underdamped' | 'catheter-whip'
  readonly dampingRatio?: number
  readonly naturalFrequencyHz?: number
}

export interface WaveformFigureRespiration {
  /** Peak-to-trough swing added to the drawn trace. Qualitative — see the reference content. */
  readonly swingMmHg: number
  readonly cyclesPerStrip: number
  /** Fraction of the strip where the slow envelope reaches its trough. */
  readonly endExpirationPhase: number
  readonly modeLabel: string
  /** Where the reading marker sits. Defaults to the end-expiratory trough. */
  readonly readAtStripFraction?: number
  readonly readMarkerLabel?: string
}

interface WaveformAtlasFigureProps {
  readonly entry: WaveformAtlasEntry
  /** Number of cardiac cycles drawn across the strip. */
  readonly beats?: number
  readonly showEcg?: boolean
  readonly annotated?: boolean
  readonly compact?: boolean
  /**
   * Axis maximum, overriding the entry's own.
   *
   * The atlas gives each entry the scale that suits it alone. A surface that steps through several
   * entries has to pin one instead, or the learner reads a change of axis as a change of pressure.
   */
  readonly scaleMaxMmHg?: number
  /** Channel heading shown above the figure, when it is not simply the entry's label. */
  readonly channelLabel?: string
  /** Draws P, QRS, and T markers on the ECG lane. */
  readonly ecgLandmarks?: boolean
  /** Draws a respiratory envelope onto the trace, plus a respiration lane and a reading marker. */
  readonly respiration?: WaveformFigureRespiration
  readonly fault?: WaveformFigureFault
  /** Replaces the generated image description, for a caller that authors its own. */
  readonly figureDescription?: string
}

function pressureToY(value: number, scaleMaxMmHg: number): number {
  const clamped = Math.max(0, Math.min(scaleMaxMmHg, value))
  return TRACE_BOTTOM - (clamped / scaleMaxMmHg) * (TRACE_BOTTOM - TRACE_TOP)
}

function phaseToX(phase: number, beat: number, beats: number): number {
  const progress = (beat + phase) / beats
  return PLOT_LEFT + progress * (PLOT_RIGHT - PLOT_LEFT)
}

function stripFractionToX(fraction: number): number {
  return PLOT_LEFT + Math.max(0, Math.min(1, fraction)) * (PLOT_RIGHT - PLOT_LEFT)
}

/** Evenly spaced pressure ticks that stay readable at any scale. */
function pressureTicks(scaleMaxMmHg: number): number[] {
  const step = scaleMaxMmHg <= 20 ? 5 : scaleMaxMmHg <= 45 ? 10 : scaleMaxMmHg <= 90 ? 20 : 40
  const ticks: number[] = []
  for (let value = 0; value <= scaleMaxMmHg; value += step) ticks.push(value)
  return ticks
}

/**
 * The trace's own mean and pulse pressure, sampled from the spec.
 *
 * The artifact transforms need both: damping and resonance act on the pulsatile component around
 * the mean, which is exactly why they leave a mean relatively preserved while ruining a systolic
 * value. Sampling keeps this true for every trace kind without special-casing any of them.
 */
function traceEnvelope(entry: WaveformAtlasEntry): { mean: number; pulsePressureMmHg: number } {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (let step = 0; step < SAMPLES_PER_BEAT; step += 1) {
    const value = waveformValueAt(entry.trace, step / SAMPLES_PER_BEAT)
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }
  return { mean: (minimum + maximum) / 2, pulsePressureMmHg: Math.max(1, maximum - minimum) }
}

const ECG_LANDMARKS: readonly {
  readonly id: string
  readonly label: string
  readonly phase: number
}[] = [
  { id: 'p', label: 'P', phase: CARDIAC_PHASE.pWave },
  { id: 'qrs', label: 'QRS', phase: CARDIAC_PHASE.rWave },
  { id: 't', label: 'T', phase: CARDIAC_PHASE.tWavePeak },
]

export function WaveformAtlasFigure({
  entry,
  beats = 3,
  showEcg = true,
  annotated = true,
  compact = false,
  scaleMaxMmHg,
  channelLabel,
  ecgLandmarks = false,
  respiration,
  fault,
  figureDescription,
}: WaveformAtlasFigureProps) {
  const gradientId = useId()
  const scaleMax = fault?.scaleMaxMmHg ?? scaleMaxMmHg ?? entry.scaleMaxMmHg
  const viewHeight = respiration ? VIEW_HEIGHT_WITH_RESPIRATION : VIEW_HEIGHT
  const envelope = traceEnvelope(entry)

  /**
   * Sampling and path building are plain functions rather than memoized ones.
   *
   * The compiler cannot preserve a `useMemo` that returns a closure, and hand-memoizing these
   * around object props that callers build inline would never hit anyway. Leaving them plain lets
   * the compiler memoize the component as a whole.
   */
  function respiratoryOffsetAt(progress: number): number {
    if (!respiration) return 0
    const { swingMmHg, cyclesPerStrip, endExpirationPhase } = respiration
    return (
      (swingMmHg / 2) * -Math.cos(2 * Math.PI * cyclesPerStrip * (progress - endExpirationPhase))
    )
  }

  function sampleAt(progress: number, phase: number): number {
    const base = waveformValueAt(entry.trace, phase) + respiratoryOffsetAt(progress)
    const distorted = fault?.artifact
      ? applyPressureArtifact({
          value: base,
          mean: envelope.mean + respiratoryOffsetAt(progress),
          state: {
            artifact: fault.artifact,
            dampingRatio: fault.dampingRatio ?? 0.65,
            naturalFrequencyHz: fault.naturalFrequencyHz ?? 12,
          },
          timeSeconds: progress * beats * BEAT_SECONDS,
          cardiacPhase: phase,
          pulsePressureMmHg: envelope.pulsePressureMmHg,
        })
      : base
    return distorted + (fault?.levelOffsetMmHg ?? 0)
  }

  const tracePath = (() => {
    const steps = Math.round(SAMPLES_PER_BEAT * beats)
    const commands: string[] = []
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps
      const phase = (progress * beats) % 1
      const x = PLOT_LEFT + progress * (PLOT_RIGHT - PLOT_LEFT)
      const y = pressureToY(sampleAt(progress, phase), scaleMax)
      commands.push(`${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    return commands.join(' ')
  })()

  const ecgPath = (() => {
    if (!showEcg) return ''
    const steps = Math.round(SAMPLES_PER_BEAT * beats)
    const commands: string[] = []
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps
      const phase = (progress * beats) % 1
      const x = PLOT_LEFT + progress * (PLOT_RIGHT - PLOT_LEFT)
      const millivolts = ecgShapeMv(phase)
      const y = ECG_BOTTOM - ((millivolts + 0.3) / 1.75) * (ECG_BOTTOM - ECG_TOP)
      commands.push(`${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    return commands.join(' ')
  })()

  const respirationPath = (() => {
    if (!respiration) return ''
    const commands: string[] = []
    const steps = 220
    const midpoint = (RESPIRATION_TOP + RESPIRATION_BOTTOM) / 2
    const amplitude = (RESPIRATION_BOTTOM - RESPIRATION_TOP) / 2 - 2
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps
      const x = PLOT_LEFT + progress * (PLOT_RIGHT - PLOT_LEFT)
      const offset =
        -Math.cos(
          2 * Math.PI * respiration.cyclesPerStrip * (progress - respiration.endExpirationPhase),
        ) * amplitude
      commands.push(`${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${(midpoint - offset).toFixed(1)}`)
    }
    return commands.join(' ')
  })()

  const ticks = pressureTicks(scaleMax)

  // Annotations are drawn on the middle beat so their leader lines are never clipped.
  const annotationBeat = Math.max(0, Math.floor(beats / 2) - (beats % 2 === 0 ? 1 : 0))
  const placedAnnotations = (() => {
    if (!annotated) return []
    const placed = entry.annotations
      .map((annotation) => {
        const x = phaseToX(annotation.phase, annotationBeat, beats)
        const progress = (x - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT)
        return {
          annotation,
          x,
          y: pressureToY(sampleAt(progress, annotation.phase), scaleMax),
          labelY: 0,
        }
      })
      .sort((left, right) => left.x - right.x)

    // Long labels on neighbouring landmarks would otherwise overlap, so each label that lands
    // too close to the previous one on the same side is pushed a row further out.
    const lastRowByPlacement = new Map<string, { x: number; row: number }>()
    for (const item of placed) {
      const { placement } = item.annotation
      const previous = lastRowByPlacement.get(placement)
      const crowded = previous !== undefined && item.x - previous.x < 150
      const row = crowded ? previous.row + 1 : 0
      lastRowByPlacement.set(placement, { x: item.x, row })
      const base = placement === 'above' ? -16 : 22
      const step = placement === 'above' ? -15 : 15
      item.labelY = Math.max(14, Math.min(VIEW_HEIGHT - 8, item.y + base + row * step))
    }
    return placed
  })()

  const readingFraction = respiration
    ? (respiration.readAtStripFraction ?? respiration.endExpirationPhase)
    : null
  const readingX = readingFraction === null ? null : stripFractionToX(readingFraction)
  const readingLabel =
    respiration?.readMarkerLabel ??
    (readingFraction !== null && readingFraction === respiration?.endExpirationPhase
      ? 'end expiration'
      : 'reading point')

  const description =
    figureDescription ??
    `${channelLabel ? `Channel labelled ${channelLabel}. ` : ''}${entry.label}. ${entry.summary} Drawn against a 0 to ${scaleMax} mmHg axis.${
      respiration
        ? ` One respiratory cycle is drawn beneath the trace under ${respiration.modeLabel}, with a marker at ${readingLabel}.`
        : ''
    } ${entry.annotations
      .map((annotation) => `${annotation.label}: ${annotation.description}`)
      .join(' ')}`

  return (
    <figure className={styles.atlasFigure} data-compact={compact || undefined}>
      <figcaption>
        <div>
          <strong>{channelLabel ?? entry.label}</strong>
          {entry.normalRange ? <span>{entry.normalRange}</span> : null}
        </div>
        {entry.insertionDepth ? <small>{entry.insertionDepth}</small> : null}
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
        role="img"
        aria-label={description}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--atlas-trace)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--atlas-trace)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => {
          const y = pressureToY(tick, scaleMax)
          return (
            <g key={tick}>
              <line className={styles.atlasGridline} x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} />
              <text className={styles.atlasAxisLabel} x={PLOT_LEFT - 10} y={y + 4}>
                {tick}
              </text>
            </g>
          )
        })}
        <text className={styles.atlasAxisUnit} x={PLOT_LEFT - 10} y={TRACE_TOP - 14}>
          mmHg
        </text>

        {showEcg ? (
          <>
            <path className={styles.atlasEcgTrace} d={ecgPath} />
            <text className={styles.atlasLaneLabel} x={PLOT_LEFT - 10} y={ECG_BOTTOM - 8}>
              ECG
            </text>
            {ecgLandmarks
              ? ECG_LANDMARKS.map((landmark) => {
                  const x = phaseToX(landmark.phase, annotationBeat, beats)
                  return (
                    <g key={landmark.id} className={styles.atlasEcgLandmark}>
                      <line x1={x} x2={x} y1={ECG_TOP - 2} y2={TRACE_BOTTOM} />
                      <text x={x} y={ECG_TOP - 4} textAnchor="middle">
                        {landmark.label}
                      </text>
                    </g>
                  )
                })
              : null}
          </>
        ) : null}

        <path
          className={styles.atlasTraceFill}
          d={`${tracePath} L ${PLOT_RIGHT} ${TRACE_BOTTOM} L ${PLOT_LEFT} ${TRACE_BOTTOM} Z`}
          fill={`url(#${gradientId})`}
        />
        <path className={styles.atlasTrace} d={tracePath} />

        {placedAnnotations.map(({ annotation, x, y, labelY }) => (
          <g key={annotation.id} className={styles.atlasAnnotation}>
            <line x1={x} x2={x} y1={y} y2={labelY + (annotation.placement === 'above' ? 6 : -12)} />
            <circle cx={x} cy={y} r="3.4" />
            <text x={x} y={labelY} textAnchor="middle">
              {annotation.label}
            </text>
          </g>
        ))}

        {respiration && readingX !== null ? (
          <>
            <path className={styles.atlasRespirationTrace} d={respirationPath} />
            <text
              className={styles.atlasLaneLabel}
              x={PLOT_LEFT - 10}
              y={(RESPIRATION_TOP + RESPIRATION_BOTTOM) / 2 + 4}
            >
              RESP
            </text>
            <g className={styles.atlasReadMarker}>
              <line x1={readingX} x2={readingX} y1={TRACE_TOP - 4} y2={RESPIRATION_BOTTOM} />
              <text x={readingX} y={RESPIRATION_BOTTOM + 12} textAnchor="middle">
                {readingLabel}
              </text>
            </g>
          </>
        ) : null}
      </svg>

      {annotated && entry.annotations.length > 0 ? (
        <dl className={styles.atlasLegend}>
          {entry.annotations.map((annotation) => (
            <div key={annotation.id}>
              <dt>{annotation.label}</dt>
              <dd>{annotation.description}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </figure>
  )
}
