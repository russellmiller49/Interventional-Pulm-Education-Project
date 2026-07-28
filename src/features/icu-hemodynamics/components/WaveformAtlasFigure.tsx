'use client'

import { useId, useMemo } from 'react'

import { ecgShapeMv } from '../engine/waveformMorphology'
import { waveformValueAt, type WaveformAtlasEntry } from '../content/waveformAtlas'
import styles from './icu-hemodynamics.module.css'

const VIEW_WIDTH = 660
const VIEW_HEIGHT = 232
const PLOT_LEFT = 54
const PLOT_RIGHT = 646
const ECG_TOP = 10
const ECG_BOTTOM = 46
const TRACE_TOP = 66
const TRACE_BOTTOM = 192
const SAMPLES_PER_BEAT = 260

interface WaveformAtlasFigureProps {
  readonly entry: WaveformAtlasEntry
  /** Number of cardiac cycles drawn across the strip. */
  readonly beats?: number
  readonly showEcg?: boolean
  readonly annotated?: boolean
  readonly compact?: boolean
}

function pressureToY(value: number, scaleMaxMmHg: number): number {
  const clamped = Math.max(0, Math.min(scaleMaxMmHg, value))
  return TRACE_BOTTOM - (clamped / scaleMaxMmHg) * (TRACE_BOTTOM - TRACE_TOP)
}

function phaseToX(phase: number, beat: number, beats: number): number {
  const progress = (beat + phase) / beats
  return PLOT_LEFT + progress * (PLOT_RIGHT - PLOT_LEFT)
}

/** Evenly spaced pressure ticks that stay readable at any scale. */
function pressureTicks(scaleMaxMmHg: number): number[] {
  const step = scaleMaxMmHg <= 20 ? 5 : scaleMaxMmHg <= 45 ? 10 : 20
  const ticks: number[] = []
  for (let value = 0; value <= scaleMaxMmHg; value += step) ticks.push(value)
  return ticks
}

export function WaveformAtlasFigure({
  entry,
  beats = 3,
  showEcg = true,
  annotated = true,
  compact = false,
}: WaveformAtlasFigureProps) {
  const gradientId = useId()

  const tracePath = useMemo(() => {
    const steps = Math.round(SAMPLES_PER_BEAT * beats)
    const commands: string[] = []
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps
      const phase = (progress * beats) % 1
      const x = PLOT_LEFT + progress * (PLOT_RIGHT - PLOT_LEFT)
      const y = pressureToY(waveformValueAt(entry.trace, phase), entry.scaleMaxMmHg)
      commands.push(`${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    return commands.join(' ')
  }, [beats, entry.scaleMaxMmHg, entry.trace])

  const ecgPath = useMemo(() => {
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
  }, [beats, showEcg])

  const ticks = pressureTicks(entry.scaleMaxMmHg)

  // Annotations are drawn on the middle beat so their leader lines are never clipped.
  const annotationBeat = Math.max(0, Math.floor(beats / 2) - (beats % 2 === 0 ? 1 : 0))
  const placedAnnotations = useMemo(() => {
    if (!annotated) return []
    const placed = entry.annotations
      .map((annotation) => {
        const value = waveformValueAt(entry.trace, annotation.phase)
        return {
          annotation,
          x: phaseToX(annotation.phase, annotationBeat, beats),
          y: pressureToY(value, entry.scaleMaxMmHg),
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
  }, [annotated, annotationBeat, beats, entry.annotations, entry.scaleMaxMmHg, entry.trace])

  const description = `${entry.label}. ${entry.summary} ${entry.annotations
    .map((annotation) => `${annotation.label}: ${annotation.description}`)
    .join(' ')}`

  return (
    <figure className={styles.atlasFigure} data-compact={compact || undefined}>
      <figcaption>
        <div>
          <strong>{entry.label}</strong>
          {entry.normalRange ? <span>{entry.normalRange}</span> : null}
        </div>
        {entry.insertionDepth ? <small>{entry.insertionDepth}</small> : null}
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
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
          const y = pressureToY(tick, entry.scaleMaxMmHg)
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
