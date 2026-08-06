'use client'

import { useMemo, type CSSProperties } from 'react'

import type { WaveformSample } from '../engine'
import styles from './mechanical-ventilation.module.css'

type WaveformField = 'pawCmH2O' | 'flowLMin' | 'volumeMl'

export interface WaveformReadout {
  readonly label: string
  readonly value: number
  readonly precision?: number
  /**
   * Marks a value the device is printing but that cannot be read as what its name implies — a
   * plateau measured while the patient is pulling is the standing example.
   */
  readonly unreliable?: boolean
  /** Why, in a few words. Shown beside the value and included in the text alternative. */
  readonly caveat?: string
}

/** A labelled pressure level drawn on the trace while the simulation is paused. */
export interface WaveformAnnotation {
  readonly id: string
  /** The full sentence: name, value, and what the level is. Goes to the text equivalents. */
  readonly label: string
  /** Name and value only. This is what fits on the trace beside the line it marks. */
  readonly marker: string
  readonly value: number
}

/**
 * Where each annotation chip sits, as a percentage of the trace's height.
 *
 * The chip is centred on its own dashed line, then pushed apart from its neighbours and clamped
 * inside the trace. `MIN_CHIP_GAP_PERCENT` is one chip's own height against the shortest trace this
 * console ever draws (a 14px chip in a 105px compact figure), so chips that would collide — a
 * plateau one or two cmH₂O under the peak is the standing case — separate instead of stacking.
 *
 * Pure, and exported, because this is the part that has to be right and a browser is not needed to
 * check it.
 */
const MIN_CHIP_GAP_PERCENT = 14
const CHIP_CENTRE_MIN_PERCENT = 8
const CHIP_CENTRE_MAX_PERCENT = 92

export interface WaveformAnnotationPlacement {
  readonly id: string
  readonly marker: string
  /** Where the dashed line is drawn, so the chip can be read against it. */
  readonly linePercent: number
  /** Where the chip's vertical centre goes, after separation and clamping. */
  readonly centrePercent: number
}

export function annotationChipLayout(
  annotations: readonly WaveformAnnotation[],
  minimum: number,
  maximum: number,
): readonly WaveformAnnotationPlacement[] {
  const span = maximum - minimum
  const placed = annotations
    .map((annotation) => {
      const normalized =
        span === 0 ? 0 : Math.max(0, Math.min(1, (annotation.value - minimum) / span))
      // Same mapping the polyline uses, expressed against the 120-unit viewBox.
      const linePercent = ((112 - normalized * 104) / 120) * 100
      return {
        id: annotation.id,
        marker: annotation.marker,
        linePercent,
        centrePercent: linePercent,
      }
    })
    .sort((left, right) => left.linePercent - right.linePercent)

  placed.forEach((placement, index) => {
    const floor =
      index === 0 ? CHIP_CENTRE_MIN_PERCENT : placed[index - 1].centrePercent + MIN_CHIP_GAP_PERCENT
    placement.centrePercent = Math.max(placement.centrePercent, floor)
  })

  // If separating them ran past the bottom, walk back up keeping the same gaps.
  const last = placed[placed.length - 1]
  const overflow = last ? last.centrePercent - CHIP_CENTRE_MAX_PERCENT : 0
  if (overflow > 0) {
    for (let index = placed.length - 1; index >= 0; index -= 1) {
      const ceiling =
        index === placed.length - 1
          ? CHIP_CENTRE_MAX_PERCENT
          : placed[index + 1].centrePercent - MIN_CHIP_GAP_PERCENT
      placed[index].centrePercent = Math.max(
        CHIP_CENTRE_MIN_PERCENT,
        Math.min(placed[index].centrePercent, ceiling),
      )
    }
  }

  return placed
}

interface WaveformStripProps {
  samples: readonly WaveformSample[]
  field: WaveformField
  label: string
  unit: string
  minimum: number
  maximum: number
  showPmus?: boolean
  /** Persistent derived values. Replaces the single instantaneous reading when supplied. */
  readouts?: readonly WaveformReadout[]
  /** Component labels, shown only when paused so they do not chase a moving trace. */
  annotations?: readonly WaveformAnnotation[]
  annotationsVisible?: boolean
  /** Per-trace color where the vendor documents one; otherwise the device palette's default. */
  color?: string
}

function linePoints(
  samples: readonly WaveformSample[],
  field: WaveformField | 'pmusCmH2O',
  minimum: number,
  maximum: number,
): string {
  if (samples.length === 0) return ''
  const firstTime = samples[0].time
  const lastTime = samples[samples.length - 1].time
  const duration = Math.max(0.02, lastTime - firstTime)
  return samples
    .map((sample) => {
      const x = ((sample.time - firstTime) / duration) * 1000
      const normalized = Math.max(0, Math.min(1, (sample[field] - minimum) / (maximum - minimum)))
      const y = 112 - normalized * 104
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function WaveformStrip({
  samples,
  field,
  label,
  unit,
  minimum,
  maximum,
  showPmus = false,
  readouts,
  annotations,
  annotationsVisible = false,
  color,
}: WaveformStripProps) {
  const values = useMemo(() => samples.map((sample) => sample[field]), [field, samples])
  const points = useMemo(
    () => linePoints(samples, field, minimum, maximum),
    [field, maximum, minimum, samples],
  )
  const pmusPoints = useMemo(
    () => (showPmus ? linePoints(samples, 'pmusCmH2O', -25, 5) : ''),
    [samples, showPmus],
  )
  const current = values.at(-1) ?? 0
  const observedMin = values.length ? Math.min(...values) : 0
  const observedMax = values.length ? Math.max(...values) : 0
  const placements = useMemo(
    () => (annotations ? annotationChipLayout(annotations, minimum, maximum) : []),
    [annotations, maximum, minimum],
  )

  return (
    <figure
      className={styles.waveformFigure}
      style={color ? ({ '--wave': color } as CSSProperties) : undefined}
    >
      <div className={styles.waveformLabel} aria-hidden="true">
        <strong>{label}</strong>
        {readouts && readouts.length > 0 ? (
          <dl className={styles.waveformReadouts}>
            {readouts.map((readout) => (
              <div key={readout.label} data-unreliable={readout.unreliable ? 'true' : undefined}>
                <dt>{readout.label}</dt>
                <dd>
                  {readout.value.toFixed(readout.precision ?? 0)}
                  {readout.unreliable ? <em aria-hidden="true">?</em> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <span>
            {current.toFixed(field === 'volumeMl' ? 0 : 1)} {unit}
          </span>
        )}
      </div>
      <svg
        className={styles.waveformSvg}
        viewBox="0 0 1000 120"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} waveform. Current ${current.toFixed(1)} ${unit}; observed range ${observedMin.toFixed(1)} to ${observedMax.toFixed(1)} ${unit}.`}
      >
        <title>{`${label} waveform over the most recent 12 simulated seconds`}</title>
        <desc>{`Current ${current.toFixed(1)} ${unit}. Minimum ${observedMin.toFixed(1)} and maximum ${observedMax.toFixed(1)} ${unit} in the visible buffer.`}</desc>
        <g className={styles.waveformGrid} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((tick) => (
            <line key={`vertical-${tick}`} x1={tick * 200} y1="0" x2={tick * 200} y2="120" />
          ))}
          {[0, 1, 2, 3].map((tick) => (
            <line key={`horizontal-${tick}`} x1="0" y1={tick * 40} x2="1000" y2={tick * 40} />
          ))}
        </g>
        <polyline
          className={styles.waveformPrimary}
          points={points}
          vectorEffect="non-scaling-stroke"
        />
        {showPmus ? (
          <polyline
            className={styles.waveformPmus}
            points={pmusPoints}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {/*
         * Only the reference lines are drawn in the SVG. The labels used to be `<text>` here, and
         * this viewBox is `preserveAspectRatio="none"`: a 9px nominal glyph came out 11.9px tall
         * but 1.3–3.5px wide depending on the pane, so the annotations were unreadable smears that
         * got worse as the workspace narrowed. They are HTML now, below.
         */}
        {annotationsVisible
          ? placements.map((placement) => (
              <line
                key={placement.id}
                className={styles.waveformAnnotation}
                x1="0"
                y1={(placement.linePercent / 100) * 120}
                x2="1000"
                y2={(placement.linePercent / 100) * 120}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}
      </svg>
      {annotationsVisible && placements.length > 0 ? (
        <div className={styles.waveformAnnotationLayer} aria-hidden="true">
          {placements.map((placement) => (
            <span
              key={placement.id}
              className={styles.waveformAnnotationChip}
              data-mv-annotation-chip
              style={{ top: `${placement.centrePercent}%` }}
            >
              {placement.marker}
            </span>
          ))}
        </div>
      ) : null}
      <figcaption className={styles.srOnly}>
        {label}: current {current.toFixed(1)} {unit}; minimum {observedMin.toFixed(1)}; maximum{' '}
        {observedMax.toFixed(1)}.{' '}
        {readouts && readouts.length > 0
          ? `Derived values: ${readouts
              .map(
                (readout) =>
                  `${readout.label} ${readout.value.toFixed(readout.precision ?? 0)} ${unit}${
                    readout.caveat ? ` — ${readout.caveat}` : ''
                  }`,
              )
              .join('; ')}. `
          : ''}
        {annotationsVisible && annotations && annotations.length > 0
          ? `Labelled components: ${annotations.map((a) => a.label).join('; ')}. `
          : ''}
        {showPmus ? 'Educator Pmus overlay is shown as a dashed trace.' : ''}
      </figcaption>
    </figure>
  )
}

export function WaveformLoops({ samples }: { samples: readonly WaveformSample[] }) {
  const recent = samples.slice(-250)
  const pressureVolume = recent
    .map((sample) => {
      const x = 24 + Math.max(0, Math.min(70, sample.volumeMl / 12))
      const y = 108 - Math.max(0, Math.min(95, sample.pawCmH2O * 2.1))
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const flowVolume = recent
    .map((sample) => {
      const x = 24 + Math.max(0, Math.min(70, sample.volumeMl / 12))
      const y = 60 - Math.max(-48, Math.min(48, sample.flowLMin * 0.8))
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <div className={styles.loopGrid}>
      <figure>
        <span>Pressure / volume</span>
        <svg viewBox="0 0 120 120" role="img" aria-label="Pressure-volume loop">
          <title>Pressure-volume loop</title>
          <path className={styles.loopAxes} d="M20 8V108H112" />
          <polyline className={styles.loopPrimary} points={pressureVolume} />
        </svg>
      </figure>
      <figure>
        <span>Flow / volume</span>
        <svg viewBox="0 0 120 120" role="img" aria-label="Flow-volume loop">
          <title>Flow-volume loop</title>
          <path className={styles.loopAxes} d="M20 8V108M20 60H112" />
          <polyline className={styles.loopSecondary} points={flowVolume} />
        </svg>
      </figure>
    </div>
  )
}
