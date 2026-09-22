import type { WaveformSample } from './types'
import type { BreathStopId } from '../content/breathSpine'

/** Never pass a partial tail off as a completed breath. */
export function completedBreath(samples: readonly WaveformSample[]): readonly WaveformSample[] {
  const starts: number[] = []
  for (let i = 1; i < samples.length; i++)
    if (samples[i].phase === 'inspiration' && samples[i - 1].phase === 'expiration') starts.push(i)
  if (starts.length < 2) return []
  return samples.slice(starts.at(-2)!, starts.at(-1)! + 1)
}
export function breathStopIndex(samples: readonly WaveformSample[], stop: BreathStopId) {
  const cycling = samples.findIndex((s) => s.phase === 'expiration')
  if (cycling < 1) return 0
  if (stop === 'trigger') return 0
  if (stop === 'cycling') return cycling
  return stop === 'inspiration'
    ? Math.max(1, Math.floor(cycling * 0.5))
    : Math.min(samples.length - 2, cycling + Math.floor((samples.length - cycling) * 0.4))
}
/** Context around an independently selected sample, including a manually paused partial breath.
 * Keep the original pair even when the saved context was downsampled. */
export function inspectionWindow(
  context: readonly WaveformSample[],
  inspection: { sample: WaveformSample; previous: WaveformSample },
): readonly WaveformSample[] {
  const byTime = new Map(
    context.filter((s) => s.time <= inspection.sample.time).map((s) => [s.time, s]),
  )
  byTime.set(inspection.previous.time, inspection.previous)
  byTime.set(inspection.sample.time, inspection.sample)
  const samples = [...byTime.values()].sort((a, b) => a.time - b.time)
  let start = 0
  for (let i = 1; i < samples.length - 3; i++)
    if (samples[i].phase === 'inspiration' && samples[i - 1].phase === 'expiration') start = i
  return samples.slice(start)
}
/**
 * The same breath with volume measured from its own start.
 *
 * `volumeMl` on a sample is lung volume above the trace baseline and carries retained gas, so a
 * figure that calls its volume row "breath-relative" has to subtract the breath's own starting
 * volume — and only when the slice is a verified breath, which `completedBreath` is and a paused
 * partial is not. The raw samples are never modified: this returns copies, at the rendering
 * boundary, so the engine keeps the trapped volume the auto-PEEP model depends on.
 */
export function anchorBreathVolume(breath: readonly WaveformSample[]): readonly WaveformSample[] {
  if (breath.length === 0) return breath
  const anchor = breath[0].volumeMl
  return breath.map((sample) => ({ ...sample, volumeMl: sample.volumeMl - anchor }))
}
export const waveformFields = ['pawCmH2O', 'flowLMin', 'volumeMl'] as const
export type WaveformAxes = Record<(typeof waveformFields)[number], readonly [number, number]>
export function waveformAxes(samples: readonly WaveformSample[]): WaveformAxes {
  return {
    pawCmH2O: [
      Math.min(0, ...samples.map((s) => s.pawCmH2O)),
      Math.max(30, ...samples.map((s) => s.pawCmH2O + 2)),
    ],
    flowLMin: [
      Math.min(-60, ...samples.map((s) => s.flowLMin - 5)),
      Math.max(60, ...samples.map((s) => s.flowLMin + 5)),
    ],
    volumeMl: [0, Math.max(600, ...samples.map((s) => s.volumeMl + 30))],
  }
}
