import { MCS_ECG_DEFLECTION_PHASES, mcsEcgMillivolts } from '../engine/model'
import type { McsTrendSample, McsWaveformSample } from '../engine/types'

/*
 * Display arithmetic for the monitor's plots. Nothing here changes a sample or a model value: these
 * functions decide where an existing value is drawn, and how the scale that carries it is labelled.
 */

const round3 = (value: number) => Math.round(value * 1000) / 1000

/**
 * The ECG strip's points: the stored samples, and between them the model's own ECG expression.
 *
 * The monitor keeps 50 samples a second, and the modeled QRS is narrower than two of them, so a
 * line drawn sample-to-sample showed a different spike height on every beat (F04). Every stored
 * sample is kept as a point, and the gaps are filled from `mcsEcgMillivolts` — the expression that
 * generated those samples — at display resolution and at each deflection's exact peak. The filled
 * curve is used only over the tail of the window where it reproduces every stored sample to the
 * sample's own rounding; before any heart-rate change inside the window the stored samples are
 * drawn as they are, rather than redrawn at a rate they were not generated at.
 */
export function ecgDisplayPoints(
  samples: readonly McsWaveformSample[],
  heartRateBpm: number,
  resolution = 720,
): readonly { readonly time: number; readonly value: number }[] {
  if (samples.length < 2)
    return samples.map((sample) => ({ time: sample.time, value: sample.ecgMv }))
  let firstMatching = samples.length
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index]
    if (round3(mcsEcgMillivolts(sample.time, heartRateBpm)) !== sample.ecgMv) break
    firstMatching = index
  }
  const stored = samples.slice(0, firstMatching).map((sample) => ({
    time: sample.time,
    value: sample.ecgMv,
  }))
  const tail = samples.slice(firstMatching)
  if (tail.length < 2) return samples.map((sample) => ({ time: sample.time, value: sample.ecgMv }))
  const start = tail[0].time
  const end = tail[tail.length - 1].time
  const times = new Set<number>(tail.map((sample) => sample.time))
  const step = (end - start) / resolution
  for (let index = 1; index < resolution; index += 1) times.add(start + index * step)
  const cycle = 60 / Math.max(25, heartRateBpm)
  for (let beat = Math.floor(start / cycle); beat <= Math.ceil(end / cycle); beat += 1) {
    for (const phase of MCS_ECG_DEFLECTION_PHASES) {
      const time = (beat + phase) * cycle
      if (time > start && time < end) times.add(time)
    }
  }
  const storedByTime = new Map(tail.map((sample) => [sample.time, sample.ecgMv]))
  const filled = [...times]
    .sort((a, b) => a - b)
    .map((time) => ({
      time,
      value: storedByTime.get(time) ?? mcsEcgMillivolts(time, heartRateBpm),
    }))
  return [...stored, ...filled]
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

/** A fixed axis: it starts at zero and only ever grows, in whole steps, to hold the data. */
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

/**
 * The samples inside the last `windowSeconds` of simulated time, and the time axis they are drawn
 * on. The axis spans what has been retained — at least ten seconds, at most the window — so a
 * trend that has only just started is not squeezed into the last sliver of an empty plot; its
 * tick labels say what span is shown.
 */
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
  const retained = samples.length > 0 ? end - samples[0].time : 0
  const span = Math.min(windowSeconds, Math.max(10, retained))
  const start = end - span
  return { samples: samples.filter((sample) => sample.time >= start), start, end, span }
}

/** A tick step that gives four to seven labelled times across a span. */
export function trendTimeStep(span: number): number {
  if (span <= 12) return 2
  if (span <= 30) return 5
  if (span <= 60) return 10
  return 20
}
