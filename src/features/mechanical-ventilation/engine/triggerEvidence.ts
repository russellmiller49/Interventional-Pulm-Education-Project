/**
 * Whether there is a trigger event to time at all, and whether it belongs to *this* breath.
 *
 * `deriveMeasurements` initialises `triggerDelayMs` to 80 and only overwrites it for three
 * phenotypes, so the Timing view printed "Measured trigger delay is 80 ms" on the passive,
 * time-triggered model in Section 7 — in the same paragraph as "Patient effort is not appreciable
 * this breath". 80 ms is an analytic value for a class of patients, not an interval measured on
 * this breath.
 *
 * The first repair fixed the absent-effort half and left a worse one behind: it scanned the whole
 * expiration preceding the latest inspiration and called any appreciable effort in it the trigger
 * event. On MV-01 at 20 s the latest inspiration begins at 17.52 s with no effort at the sample
 * before it, and the last appreciable effort ended at 15.80 s — a breath and a half earlier,
 * belonging to the previous cycle. The helper reported 80 ms anyway.
 *
 * ## What association means here
 *
 * In this engine `effortAt` is a neural oscillator entrained to the machine period; the machine
 * does not start a breath *because* of an effort. On the cases that carry effort at all, the
 * effort rises from zero at the same sample the inspiration begins. So there are three honest
 * answers and the helper returns whichever the trace supports:
 *
 * - **`measured`** — appreciable effort in the samples immediately before the onset, inside the
 *   interval the model itself claims as the delay. Then, and only then, an effort genuinely
 *   preceded delivery and the number is an interval between two events on this trace.
 * - **`model-estimate`** — this inspiration has an appreciable effort of its own, but nothing
 *   precedes it, so the delay is the phenotype's modeled value rather than something measured
 *   here. The number stays useful and stops being called a measurement.
 * - **`not-applicable`** — this breath has no appreciable modeled effort associated with it at
 *   all. Not a delay of zero, and no claim about the next breath.
 * - **`unavailable`** — the buffer holds no breath boundary yet.
 *
 * Everything is measured against the engine's own `EFFORT_DETECTION_FLOOR_CMH2O` and the model's
 * own `triggerDelayMs`. No new clinical cutoff is introduced, and no prior expiratory interval is
 * scanned for a historical effort to borrow.
 */
import { EFFORT_DETECTION_FLOOR_CMH2O } from './physics'
import type { VentilationSimulationState, WaveformSample } from './types'

export type TriggerDelayStatus = 'measured' | 'model-estimate' | 'not-applicable' | 'unavailable'

export interface TriggerDelayEvidence {
  readonly status: TriggerDelayStatus
  /** Null unless an effort is associated with this breath; never 0 as a stand-in for "none". */
  readonly delayMs: number | null
  /** Largest modeled inspiratory effort belonging to this inspiration. */
  readonly breathEffortCmH2O: number
  /** Largest modeled effort in the interval immediately preceding the onset. */
  readonly precedingEffortCmH2O: number
  /** The simulated second this inspiration began, when one is on the trace. */
  readonly onsetSeconds: number | null
  /** What to print where the number would have been. */
  readonly display: string
  readonly detail: string
}

function latestOnsetIndex(waveforms: readonly WaveformSample[]): number {
  for (let index = waveforms.length - 1; index > 0; index -= 1) {
    if (waveforms[index].phase === 'inspiration' && waveforms[index - 1].phase === 'expiration') {
      return index
    }
  }
  return -1
}

function peakEffort(samples: readonly WaveformSample[]): number {
  return samples.reduce((peak, sample) => Math.max(peak, -sample.pmusCmH2O), 0)
}

export function triggerDelayEvidence(state: VentilationSimulationState): TriggerDelayEvidence {
  const waveforms = state.waveforms
  const onset = latestOnsetIndex(waveforms)
  if (onset < 1)
    return {
      status: 'unavailable',
      delayMs: null,
      breathEffortCmH2O: 0,
      precedingEffortCmH2O: 0,
      onsetSeconds: null,
      display: '—',
      detail:
        'No complete breath boundary is on the trace yet, so there is nothing to associate a trigger delay with. Run or advance one breath.',
    }

  const onsetSample = waveforms[onset]
  /*
   * The window the model's own delay would have to span, bounded to the samples actually before
   * the onset. Nothing outside it can be the event this breath was triggered by.
   */
  const delaySeconds = Math.max(0, state.measurements.triggerDelayMs) / 1000
  const windowStart = onsetSample.time - delaySeconds
  const preceding = waveforms
    .slice(0, onset)
    .filter((sample) => sample.time >= windowStart && sample.phase === 'expiration')
  const precedingEffortCmH2O = peakEffort(preceding)

  /* The effort belonging to this inspiration: from the onset to the end of the buffer or of it. */
  const breath: WaveformSample[] = []
  for (let index = onset; index < waveforms.length; index += 1) {
    if (waveforms[index].phase !== 'inspiration') break
    breath.push(waveforms[index])
  }
  const breathEffortCmH2O = peakEffort(breath)

  if (precedingEffortCmH2O >= EFFORT_DETECTION_FLOOR_CMH2O)
    return {
      status: 'measured',
      delayMs: state.measurements.triggerDelayMs,
      breathEffortCmH2O,
      precedingEffortCmH2O,
      onsetSeconds: onsetSample.time,
      display: `${state.measurements.triggerDelayMs.toFixed(0)} ms`,
      detail:
        'An effort was already under way when this breath was delivered, so the interval between that effort and the delivery is what the delay describes.',
    }

  if (breathEffortCmH2O >= EFFORT_DETECTION_FLOOR_CMH2O)
    return {
      status: 'model-estimate',
      delayMs: state.measurements.triggerDelayMs,
      breathEffortCmH2O,
      precedingEffortCmH2O,
      onsetSeconds: onsetSample.time,
      display: `${state.measurements.triggerDelayMs.toFixed(0)} ms · model estimate`,
      detail:
        'This breath has an effort of its own, but the modeled effort does not begin before the breath arrives, so nothing on this trace times the interval. The value is what the model assigns this phenotype, not a delay measured here.',
    }

  return {
    status: 'not-applicable',
    delayMs: null,
    breathEffortCmH2O,
    precedingEffortCmH2O,
    onsetSeconds: onsetSample.time,
    display: '—',
    detail:
      'No appreciable modeled effort belongs to this breath, so the timer started it and there is no effort-to-delivery interval to report. That is not the same as a delay of zero, and it says nothing about the next breath.',
  }
}
