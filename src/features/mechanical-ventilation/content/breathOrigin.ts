/**
 * What a captured-breath figure counts time and volume from, named as what it is.
 *
 * The figures used to call their origin "breath start": "Volume from breath start (mL)", "Time from
 * breath start (s)", "volume … above this breath's start". The independent review of PR #290 (R3)
 * measured what the origin actually is. `completedBreath` slices a record from one inspiratory
 * onset to the next, and an onset is the first sample whose phase is inspiration. Samples are
 * recorded after each integration step, so that sample is not the instant inspiration began: it
 * already holds one step of inspiratory flow. On the Section 2 baseline (40 L/min, 20-ms steps) the
 * sample before it reads about 0.7 mL and the first inspiratory sample about 14.0 mL, so a figure
 * that subtracts the first sample removes about 13.3 mL, and breaths that received 413 or 427 mL
 * are drawn rising about 400 or 413 mL.
 *
 * Nothing about the acquisition changes here. The engine's lung volume is not altered, no zero-time
 * sample is synthesised or interpolated, no timestamp moves, and the drawn rise is not stretched to
 * equal the delivered volume. The figures keep the origin they have and say what it is — the first
 * recorded inspiratory sample — with the size of the step that sample already holds, read from the
 * record. One set of words for the row label, the time axis, the captions, the overlay, the zoom
 * note and the text equivalent, so they cannot describe the origin differently.
 */
import type { WaveformSample } from '../engine/types'

/** The origin, as a noun phrase for sentences. */
export const BREATH_ORIGIN = 'first recorded inspiratory sample'

export const BREATH_ROW_LABELS = {
  pawCmH2O: 'Airway pressure (cmH₂O)',
  flowLMin: 'Flow (L/min)',
  volumeMl: 'Volume from first inspiratory sample (mL)',
  pmusCmH2O: 'Effort · model (cmH₂O)',
} as const

/** A slice with no verified onset (a hold record, a paused partial breath) is drawn un-anchored. */
export const RAW_VOLUME_ROW_LABEL = 'Raw lung volume (mL)'

export const BREATH_TIME_AXIS_LABEL = 'Time from first recorded inspiratory sample (s)'
export const TRACE_TIME_AXIS_LABEL = 'Time from the first sample of this trace (s)'

export interface BreathOriginFacts {
  /** Raw lung volume at the first inspiratory sample: what the drawn volume is measured from. */
  readonly originMl: number
  /** Raw lung volume at the sample just before it; null when the record does not hold that sample. */
  readonly precedingMl: number | null
  /** What the first inspiratory sample already holds: one integration step. Null with `precedingMl`. */
  readonly firstStepMl: number | null
}

/**
 * The origin's own numbers, read from the record the breath was sliced from. `breath` must be the
 * slice `completedBreath(record)` returned, so its first sample is found in the record by identity;
 * nothing is recomputed, and a breath that is not part of the record reports no preceding sample.
 */
export function breathOriginFacts(
  record: readonly WaveformSample[],
  breath: readonly WaveformSample[],
): BreathOriginFacts | null {
  if (breath.length === 0) return null
  const onset = record.indexOf(breath[0])
  const preceding = onset > 0 ? record[onset - 1] : null
  return {
    originMl: breath[0].volumeMl,
    precedingMl: preceding ? preceding.volumeMl : null,
    firstStepMl: preceding ? breath[0].volumeMl - preceding.volumeMl : null,
  }
}
