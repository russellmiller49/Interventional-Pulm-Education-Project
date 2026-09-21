/**
 * Whether there is a trigger event to time at all.
 *
 * `deriveMeasurements` initialises `triggerDelayMs` to 80 and only overwrites it for three
 * phenotypes, so the Timing view printed "Measured trigger delay is 80 ms" on the passive,
 * time-triggered model in Section 7 — in the same paragraph as "Patient effort is not appreciable
 * this breath". 80 ms is an analytic default for a class of patients, not a delay measured on this
 * breath, and a breath the timer started has no trigger delay to report.
 *
 * Absent, unknown and zero are three different answers and this returns three different statuses:
 *
 *   - `unavailable` — the buffer does not yet hold a breath boundary to measure from.
 *   - `not-applicable` — the last breath began with no appreciable effort behind it, so there is
 *     no effort-to-delivery interval. Not "0 ms", and not a claim about the next breath.
 *   - `reported` — an effort preceded the last inspiration, so the model's delay describes
 *     something.
 *
 * The eligibility test uses evidence the engine already publishes: the modeled effort trace
 * (`pmusCmH2O`) across the expiration that preceded the onset, against the engine's own
 * `EFFORT_DETECTION_FLOOR_CMH2O`. No new clinical cutoff is introduced, and the floor is not
 * printed.
 */
import { EFFORT_DETECTION_FLOOR_CMH2O } from './physics'
import type { VentilationSimulationState, WaveformSample } from './types'

export type TriggerDelayStatus = 'reported' | 'not-applicable' | 'unavailable'

export interface TriggerDelayEvidence {
  readonly status: TriggerDelayStatus
  /** Null unless a trigger event was found; never 0 as a stand-in for "none". */
  readonly delayMs: number | null
  /** Largest modeled inspiratory effort in the interval the breath was started from. */
  readonly precedingEffortCmH2O: number
  /** What to print where the number would have been. */
  readonly display: string
  readonly detail: string
}

/** The expiration that led into the most recent inspiration, plus that onset sample. */
function triggeringInterval(
  waveforms: readonly WaveformSample[],
): readonly WaveformSample[] | null {
  let onset = -1
  for (let index = waveforms.length - 1; index > 0; index -= 1) {
    if (waveforms[index].phase === 'inspiration' && waveforms[index - 1].phase === 'expiration') {
      onset = index
      break
    }
  }
  if (onset < 1) return null
  let start = onset - 1
  while (start > 0 && waveforms[start - 1].phase === 'expiration') start -= 1
  return waveforms.slice(start, onset + 1)
}

export function triggerDelayEvidence(state: VentilationSimulationState): TriggerDelayEvidence {
  const interval = triggeringInterval(state.waveforms)
  if (!interval)
    return {
      status: 'unavailable',
      delayMs: null,
      precedingEffortCmH2O: 0,
      display: '—',
      detail:
        'No complete breath boundary is on the trace yet, so there is nothing to measure a trigger delay from. Run or advance one breath.',
    }
  const effort = interval.reduce((peak, sample) => Math.max(peak, -sample.pmusCmH2O), 0)
  if (effort < EFFORT_DETECTION_FLOOR_CMH2O)
    return {
      status: 'not-applicable',
      delayMs: null,
      precedingEffortCmH2O: effort,
      display: '—',
      detail:
        'The modeled effort signal shows no appreciable effort before this breath, so the timer started it and there is no effort-to-delivery interval to report. That is not the same as a delay of zero, and it says nothing about the next breath.',
    }
  return {
    status: 'reported',
    delayMs: state.measurements.triggerDelayMs,
    precedingEffortCmH2O: effort,
    display: `${state.measurements.triggerDelayMs.toFixed(0)} ms`,
    detail:
      'An effort preceded this inspiration, so the interval between the effort and the delivered breath is the delay the model reports for this phenotype.',
  }
}
