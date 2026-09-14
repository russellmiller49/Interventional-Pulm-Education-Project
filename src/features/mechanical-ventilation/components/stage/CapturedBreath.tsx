'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { WaveformSample } from '../../engine/types'
import type { BreathStopId } from '../../content/breathSpine'
import {
  breathStopIndex,
  completedBreath,
  waveformAxes,
  waveformFields,
  type WaveformAxes,
} from '../../engine/teachingBreath'
import styles from './ventilation-stage.module.css'

const labels = {
  pawCmH2O: 'Airway pressure (cmH₂O)',
  flowLMin: 'Flow (L/min)',
  volumeMl: 'Breath-relative volume (mL)',
  pmusCmH2O: 'Effort · model (cmH₂O)',
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
  const bounds = { ...(axes ?? waveformAxes(breath)), pmusCmH2O: [-25, 5] as const }
  const fields = effort ? [...waveformFields, 'pmusCmH2O' as const] : waveformFields
  const first = breath[0].time
  const duration = breath.at(-1)!.time - first
  const timeRange = Math.max(duration, durationSeconds ?? 0)
  const sample = breath[index]
  const previous = breath[Math.max(0, index - 1)]
  const x = (time: number) => 50 + ((time - first) / timeRange) * (width - 70)
  const y = (value: number, field: (typeof fields)[number]) =>
    64 - ((value - bounds[field][0]) / (bounds[field][1] - bounds[field][0])) * 54
  const cycling = breath.findIndex((s) => s.phase === 'expiration')
  const highlighted = stop === 'trigger' || stop === 'cycling' ? stop : sample.phase
  const from = highlighted === 'expiration' ? breath[cycling]?.time : first
  const to = highlighted === 'inspiration' ? breath[cycling]?.time : breath.at(-1)!.time
  const text = `Cursor at ${(sample.time - first).toFixed(2)} s. Airway pressure ${sample.pawCmH2O.toFixed(1)} cmH₂O; flow ${sample.flowLMin.toFixed(1)} L/min; volume ${previous.volumeMl.toFixed(0)} to ${sample.volumeMl.toFixed(0)} mL over the preceding ${(sample.time - previous.time).toFixed(2)} s.${effort ? ` Model effort ${sample.pmusCmH2O.toFixed(1)} cmH₂O; machine ${sample.phase}.` : ''}`
  return (
    <figure
      className={styles.capturedBreath}
      ref={figureRef}
      data-captured-breath
      data-guided-stop={guided ? stop : undefined}
    >
      <figcaption id={id}>
        <strong>{label}</strong>
        {guided ? ' · Worked demonstration; no independent credit' : ''}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${fields.length * 85 + 23}`} role="img" aria-label={text}>
        {fields.map((field, row) => (
          <g key={field} transform={`translate(0 ${row * 85})`}>
            <text x="0" y="12">
              {labels[field]}
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
                d={breath
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
              <line
                x1={x(sample.time)}
                x2={x(sample.time)}
                y1="7"
                y2="66"
                className={styles.cursor}
                data-time-cursor={sample.time}
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
      {effort ? (
        <p className={styles.quickNote}>
          Effort is a teaching model signal, not routine measured ventilator data. Read the onset
          and end of effort separately from machine inspiration.
        </p>
      ) : null}
      {fixedIndex === undefined && !stop ? (
        <label className={styles.cursorControl}>
          Inspect time in this captured trace
          <input
            aria-label="Captured breath time cursor"
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
      <p className={styles.quickNote}>{text}</p>
      {guided ? (
        <p>
          {sample.phase === 'inspiration'
            ? 'Inspiration: positive flow adds volume.'
            : 'Expiration: negative flow accompanies falling volume.'}{' '}
          The volume reference is not total lung volume.
        </p>
      ) : null}
      {onInspect ? (
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => onInspect(sample, previous)}
        >
          Use this captured interval
        </button>
      ) : null}
    </figure>
  )
}
