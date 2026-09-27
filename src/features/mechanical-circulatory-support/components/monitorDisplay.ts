import { MCS_ECG_DEFLECTION_PHASES, mcsEcgMillivolts } from '../engine/model'
import type { McsTrendSample, McsWaveformSample } from '../engine/types'

/*
 * Display arithmetic for the monitor's plots. Nothing here changes a sample or a model value: these
 * functions decide where an existing value is drawn, and how the scale that carries it is labelled.
 */

const round3 = (value: number) => Math.round(value * 1000) / 1000

type EcgDisplayPoint = { readonly time: number; readonly value: number }

// Presentation provenance only. The reducer retains immutable sample objects when its history
// window moves. Weak keys let the display remember each sample's observed rate across rerenders
// and monitor remounts without adding metadata or reconstructed values to simulation state.
const observedEcgRates = new WeakMap<McsWaveformSample, number | null>()

/**
 * Preserve every stored point, filling only intervals whose two samples were observed at the
 * same verified rate. Never reinterpret an already observed sample using a later rate: removing
 * its old fill would itself redraw history and reintroduce apparent amplitude alternation.
 * Unknown history stays sample-to-sample. Rounded zeroes alone are not rate provenance across a
 * known rate boundary. The subdivision grid belongs to each sample interval, not the changing
 * window, so resize, scrolling history and disclosure remounts preserve old geometry.
 */
export function ecgDisplayPoints(
  samples: readonly McsWaveformSample[],
  heartRateBpm: number,
  resolution = 720,
): readonly EcgDisplayPoint[] {
  let firstMatching = samples.length
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index]
    if (round3(mcsEcgMillivolts(sample.time, heartRateBpm)) !== sample.ecgMv) break
    firstMatching = index
  }
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    if (!observedEcgRates.has(sample)) {
      observedEcgRates.set(sample, index >= firstMatching ? heartRateBpm : null)
    }
  }
  const points: EcgDisplayPoint[] = []
  const subdivisions = Math.max(2, Math.ceil(resolution / 250))
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    const previous = samples[index - 1]
    const rate = observedEcgRates.get(sample)
    if (previous && rate != null && observedEcgRates.get(previous) === rate) {
      const start = previous.time
      const end = sample.time
      const times = new Set<number>()
      for (let part = 1; part < subdivisions; part += 1) {
        times.add(start + ((end - start) * part) / subdivisions)
      }
      const cycle = 60 / Math.max(25, rate)
      for (let beat = Math.floor(start / cycle); beat <= Math.ceil(end / cycle); beat += 1) {
        for (const phase of MCS_ECG_DEFLECTION_PHASES) {
          const time = (beat + phase) * cycle
          if (time > start && time < end) times.add(time)
        }
      }
      points.push(
        ...[...times]
          .sort((a, b) => a - b)
          .map((time) => ({
            time,
            value: mcsEcgMillivolts(time, rate),
          })),
      )
    }
    points.push({ time: sample.time, value: sample.ecgMv })
  }
  return points
}

/* ------------------------------------------------------------------ *
 * The pressure and flow trend
 * ------------------------------------------------------------------ */

export type McsTrendSeriesId =
  | 'map'
  | 'effective-flow'
  | 'left-pump'
  | 'right-pump'
  | 'durable-pump'

export interface McsTrendSeries {
  readonly id: McsTrendSeriesId
  readonly label: string
  readonly unit: 'mm Hg' | 'L/min'
  readonly read: (sample: McsTrendSample) => number
  /** Undefined for a solid line. */
  readonly dash?: string
  /** What the line looks like, in words, so the legend never relies on colour. */
  readonly lineWords: string
  readonly color: string
}

/** A zero-based axis that expands in whole steps when the displayed window needs more range. */
export interface McsTrendAxis {
  readonly min: number
  readonly max: number
  readonly ticks: readonly number[]
  /** True when the data needed a larger ceiling than the default, so the plot says so. */
  readonly extended: boolean
}

export function fixedTrendAxis(
  values: readonly number[],
  defaultMax: number,
  step: number,
): McsTrendAxis {
  const finite = values.filter(Number.isFinite)
  const highest = finite.length > 0 ? Math.max(...finite) : 0
  const max = Math.max(defaultMax, Math.ceil(highest / step) * step)
  const ticks: number[] = []
  for (let tick = 0; tick <= max + 1e-9; tick += step) ticks.push(tick)
  return { min: 0, max, ticks, extended: max > defaultMax }
}

export interface McsTrendRange {
  readonly minimum: number
  readonly maximum: number
  readonly latest: number
}

export function trendRange(
  samples: readonly McsTrendSample[],
  read: (sample: McsTrendSample) => number,
): McsTrendRange | null {
  const values = samples.map(read).filter(Number.isFinite)
  if (values.length === 0) return null
  return {
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    latest: values[values.length - 1],
  }
}

/** The recorded time range in the retained window; never backdate a short recording. */
export function trendWindow(
  samples: readonly McsTrendSample[],
  windowSeconds: number,
): {
  readonly samples: readonly McsTrendSample[]
  readonly start: number
  readonly end: number
  readonly span: number
} {
  const end = samples.length > 0 ? samples[samples.length - 1].time : 0
  const start = Math.max(samples[0]?.time ?? 0, end - windowSeconds)
  const span = end - start
  return { samples: samples.filter((sample) => sample.time >= start), start, end, span }
}

/** A tick step that gives four to seven labelled times across a span. */
export function trendTimeStep(span: number): number {
  if (span <= 2) return 0.5
  if (span <= 12) return 2
  if (span <= 30) return 5
  if (span <= 60) return 10
  return 20
}
