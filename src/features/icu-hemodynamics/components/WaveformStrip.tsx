'use client'

import { useMemo } from 'react'

import type { HemodynamicWaveformSample } from '../engine'
import styles from './icu-hemodynamics.module.css'

type WaveformField = Exclude<keyof HemodynamicWaveformSample, 'time'>

interface WaveformStripProps {
  samples: readonly HemodynamicWaveformSample[]
  field: WaveformField
  label: string
  unit: string
  minimum: number
  maximum: number
  color: string
  sweepSeconds: number
}

function pointsFor(
  samples: readonly HemodynamicWaveformSample[],
  field: WaveformField,
  minimum: number,
  maximum: number,
): string {
  if (samples.length < 2) return ''
  const first = samples[0].time
  const last = samples[samples.length - 1].time
  const duration = Math.max(0.02, last - first)
  return samples
    .map((sample) => {
      const x = ((sample.time - first) / duration) * 1000
      const normalized = Math.max(0, Math.min(1, (sample[field] - minimum) / (maximum - minimum)))
      const y = 96 - normalized * 86
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
  color,
  sweepSeconds,
}: WaveformStripProps) {
  const visibleSamples = useMemo(() => {
    const latest = samples.at(-1)?.time ?? 0
    return samples.filter((sample) => sample.time >= latest - sweepSeconds)
  }, [samples, sweepSeconds])
  const points = useMemo(
    () => pointsFor(visibleSamples, field, minimum, maximum),
    [field, maximum, minimum, visibleSamples],
  )
  const values = visibleSamples.map((sample) => sample[field])
  const low = values.length > 0 ? Math.min(...values) : 0
  const high = values.length > 0 ? Math.max(...values) : 0
  const summary = `${label} waveform over ${sweepSeconds} seconds, range ${low.toFixed(1)} to ${high.toFixed(1)} ${unit}.`

  return (
    <figure className={styles.waveformStrip} style={{ '--trace': color } as React.CSSProperties}>
      <figcaption>
        <strong>{label}</strong>
        <span>{unit}</span>
      </figcaption>
      <svg viewBox="0 0 1000 104" preserveAspectRatio="none" role="img" aria-label={summary}>
        <defs>
          <pattern id={`grid-${field}`} width="50" height="26" patternUnits="userSpaceOnUse">
            <path
              d="M 50 0 L 0 0 0 26"
              fill="none"
              stroke="rgba(117,194,184,.12)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="1000" height="104" fill={`url(#grid-${field})`} />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className={styles.srOnly}>Waveform text: {summary}</span>
    </figure>
  )
}
