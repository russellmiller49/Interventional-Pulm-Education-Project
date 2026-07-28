'use client'

/**
 * Primitives shared by every Mechanical Ventilation teaching panel.
 *
 * The panels occupy the middle pane of the three-pane workspace. Every figure is computed from
 * live simulation state rather than drawn as static art, carries a computed `aria-label`, and is
 * followed by a text equivalent.
 *
 * Deliberately no numeric targets or threshold tables anywhere in these panels: this module's
 * source reconciliation is still pending, so every teaching claim is about the relationship
 * between signals, or defers to the engine's own alarm logic rather than restating a limit.
 */
import type { WaveformSample } from '../../engine'
import styles from '../mechanical-ventilation-teaching.module.css'

export { styles }

export const EMPTY_STATE_NOTE =
  'Waveform data appears once the simulation has produced a breath. Advance the case to populate this figure.'

export function round(value: number, places = 0): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/** "Higher", "lower", or "unchanged" without committing to a threshold for how much counts. */
export function direction(delta: number, deadband: number): 'up' | 'down' | 'flat' {
  if (delta > deadband) return 'up'
  if (delta < -deadband) return 'down'
  return 'flat'
}

export const directionGlyph: Readonly<Record<'up' | 'down' | 'flat', string>> = {
  up: '▲',
  down: '▼',
  flat: '—',
}

export const directionWord: Readonly<Record<'up' | 'down' | 'flat', string>> = {
  up: 'rising',
  down: 'falling',
  flat: 'holding steady',
}

/**
 * The most recent *complete* breath cycle: from one inspiration onset to the next.
 *
 * Slicing by phase from the tail instead truncates whichever phase is in progress, which drew a
 * pressure trace that stepped down and flattened rather than showing a breath. Cutting between
 * successive inspiration onsets also keeps a double-triggered pair together in one window, which
 * is what the dyssynchrony cases need to be legible.
 */
export function latestBreath(samples: readonly WaveformSample[]): readonly WaveformSample[] {
  if (samples.length < 4) return []
  const onsets: number[] = []
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].phase === 'inspiration' && samples[index - 1].phase === 'expiration') {
      onsets.push(index)
    }
  }
  if (onsets.length >= 2) {
    const start = onsets[onsets.length - 2]
    const end = onsets[onsets.length - 1]
    if (end - start >= 4) return samples.slice(start, end)
  }
  // No two onsets in the window yet: fall back to the most recent second or so of samples.
  return samples.slice(-Math.min(samples.length, 80))
}

export function tracePath(
  samples: readonly WaveformSample[],
  field: 'pawCmH2O' | 'flowLMin' | 'volumeMl' | 'pmusCmH2O',
  minimum: number,
  maximum: number,
  width = 300,
  height = 78,
): string {
  if (samples.length === 0) return ''
  const firstTime = samples[0].time
  const duration = Math.max(0.02, samples[samples.length - 1].time - firstTime)
  return samples
    .map((sample, index) => {
      const x = ((sample.time - firstTime) / duration) * width
      const normalized = Math.max(0, Math.min(1, (sample[field] - minimum) / (maximum - minimum)))
      const y = height - normalized * (height - 6) - 3
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

/** Fraction of the way through the sample window, 0 to 1, for placing a marker on a trace. */
export function fractionAt(samples: readonly WaveformSample[], index: number): number {
  if (samples.length < 2) return 0
  const first = samples[0].time
  const duration = Math.max(0.02, samples[samples.length - 1].time - first)
  return Math.max(0, Math.min(1, (samples[index].time - first) / duration))
}

export function TextEquivalent({ children }: { readonly children: string }) {
  return (
    <p className={styles.textEquivalent}>
      <strong>Visual text equivalent:</strong> {children}
    </p>
  )
}

export function ModelBoundary({ children }: { readonly children: string }) {
  return <p className={styles.boundary}>{children}</p>
}

/** The empty state every panel shows before the simulation has produced a readable breath. */
export function AwaitingBreath({ label }: { readonly label: string }) {
  return (
    <div className={styles.stepDetail}>
      <span>{label}</span>
      <p>{EMPTY_STATE_NOTE}</p>
    </div>
  )
}
