/**
 * The effort row of a captured breath, in words — the text equivalent the comparison was missing.
 *
 * The retained comparison draws a fourth row, "Effort · model (cmH₂O)", where the step's instruction
 * reads it (Section 7's second application, among others), and its description summarised pressure,
 * flow and volume only (PR #290 review, R6). A reader who cannot see the row had no account of it.
 *
 * Everything here is read off the retained samples of the breath that is drawn:
 *
 *   - when the modeled effort is at or above the engine's own `EFFORT_DETECTION_FLOOR_CMH2O`, as
 *     times from the breath's first recorded inspiratory sample — the same origin the figure uses;
 *   - its largest value and when;
 *   - where the machine's inspiration is on the same samples (its first inspiratory sample to its
 *     first expiratory sample — the same sampled inspiration the description above it reports), and
 *     the difference between the two ends, as arithmetic on sample times.
 *
 * What it does not say: that an effort started the breath, or that any interval is a trigger delay.
 * In this engine the effort is a modeled signal on its own grid, the simulator does not time an
 * effort-to-delivery interval, and Batch 02 removed the "measured" trigger label for that reason
 * (`engine/triggerEvidence.ts`). It is called a modeled signal, never a measured patient effort.
 * When the record is quiet, or the samples do not hold a comparison, the text says only that.
 */
import { EFFORT_DETECTION_FLOOR_CMH2O } from '../engine/physics'
import { completedBreath } from '../engine/teachingBreath'
import type { WaveformSample } from '../engine/types'

export interface ModeledEffortInterval {
  /** Seconds from the breath's first recorded inspiratory sample; negative when before it. */
  readonly fromSeconds: number
  readonly toSeconds: number
  readonly peakCmH2O: number
  readonly peakAtSeconds: number
  /** The interval was already under way at the first sample of the record. */
  readonly openAtRecordStart: boolean
  /** The interval was still under way at the next breath's first inspiratory sample. */
  readonly openAtBreathEnd: boolean
}

export interface ModeledEffortFacts {
  /** Intervals at or above the floor that overlap the drawn breath, in time order. */
  readonly intervals: readonly ModeledEffortInterval[]
  /** Machine inspiration as sampled: seconds from the first inspiratory to the first expiratory sample. */
  readonly firstExpiratorySeconds: number | null
  readonly durationSeconds: number
}

const effortOf = (sample: WaveformSample) => Math.max(0, -sample.pmusCmH2O)
const appreciable = (sample: WaveformSample) => effortOf(sample) >= EFFORT_DETECTION_FLOOR_CMH2O

export function modeledEffortFacts(record: readonly WaveformSample[]): ModeledEffortFacts | null {
  const breath = completedBreath(record)
  if (breath.length < 4) return null
  const first = record.indexOf(breath[0])
  const last = first + breath.length - 1
  const origin = breath[0].time
  const cycling = breath.findIndex((sample) => sample.phase === 'expiration')
  const intervals: ModeledEffortInterval[] = []
  let index = first
  while (index <= last) {
    if (!appreciable(record[index])) {
      index += 1
      continue
    }
    // An interval under way at the breath's first sample is followed back to where it began.
    let start = index
    if (index === first) while (start > 0 && appreciable(record[start - 1])) start -= 1
    let end = index
    while (end < last && appreciable(record[end + 1])) end += 1
    let peak = start
    for (let i = start; i <= end; i += 1) if (effortOf(record[i]) > effortOf(record[peak])) peak = i
    intervals.push({
      fromSeconds: record[start].time - origin,
      toSeconds: record[end].time - origin,
      peakCmH2O: effortOf(record[peak]),
      peakAtSeconds: record[peak].time - origin,
      openAtRecordStart: start === 0,
      openAtBreathEnd: end === last,
    })
    index = end + 1
  }
  return {
    intervals,
    firstExpiratorySeconds: cycling > 0 ? breath[cycling].time - origin : null,
    durationSeconds: breath.at(-1)!.time - origin,
  }
}

function relative(seconds: number): string {
  if (Math.abs(seconds) < 0.005) return 'at the first recorded inspiratory sample'
  return seconds < 0
    ? `${Math.abs(seconds).toFixed(2)} s before the first recorded inspiratory sample`
    : `${seconds.toFixed(2)} s after the first recorded inspiratory sample`
}

/** One or two sentences for one breath of the comparison. */
export function describeModeledEffort(name: string, record: readonly WaveformSample[]): string {
  const facts = modeledEffortFacts(record)
  if (!facts)
    return `${name}: no complete breath in the record, so its effort row is not described.`
  const floor = EFFORT_DETECTION_FLOOR_CMH2O
  if (facts.intervals.length === 0)
    return `${name} breath: the modeled effort stays below ${floor} cmH₂O for the whole drawn breath.`
  const cycling = facts.firstExpiratorySeconds
  const machine =
    cycling === null
      ? ''
      : ` Machine inspiration, on the same axis, runs from 0.00 s to its first expiratory sample at ${cycling.toFixed(2)} s.`
  const sentences = facts.intervals.map((interval, position) => {
    const begins = interval.openAtRecordStart
      ? 'already under way where the record begins'
      : `first at or above ${floor} cmH₂O ${relative(interval.fromSeconds)}`
    const ends = interval.openAtBreathEnd
      ? `still at or above it when the next breath’s first inspiratory sample is recorded at ${facts.durationSeconds.toFixed(2)} s`
      : `last at or above it at ${interval.toSeconds.toFixed(2)} s`
    const peak = `largest ${interval.peakCmH2O.toFixed(1)} cmH₂O at ${interval.peakAtSeconds.toFixed(2)} s`
    let relation = ''
    if (
      position === 0 &&
      cycling !== null &&
      !interval.openAtBreathEnd &&
      interval.fromSeconds < cycling
    ) {
      const gap = interval.toSeconds - cycling
      relation =
        Math.abs(gap) < 0.005
          ? '; that is the machine’s first expiratory sample'
          : gap > 0
            ? `; that is ${gap.toFixed(2)} s after the machine’s first expiratory sample`
            : `; that is ${Math.abs(gap).toFixed(2)} s before the machine’s first expiratory sample`
    }
    return `${position === 0 ? `${name} breath: modeled effort is` : 'A further modeled effort is'} ${begins}, ${ends} (${peak})${relation}.`
  })
  return `${sentences.join(' ')}${machine}`
}
