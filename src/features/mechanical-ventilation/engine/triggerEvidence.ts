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
 * In this engine `effortAt` is a neural oscillator on its own grid; the machine does not start a
 * breath *because* of an effort. So there are three honest answers and the helper returns
 * whichever the trace supports:
 *
 * - **`model-estimate`** — an appreciable modeled effort belongs to this breath: one that is still
 *   building into the onset (appreciable at the sample immediately before it and no smaller at the
 *   onset) or one that begins with the inspiration. Either way the number is
 *   `measurements.triggerDelayMs`, the delay the model *assigns* this phenotype, and it is labelled
 *   as that.
 * - **`not-applicable`** — this breath has no appreciable modeled effort associated with it at
 *   all. Not a delay of zero, and no claim about the next breath.
 * - **`unavailable`** — the buffer holds no breath boundary yet.
 *
 * ## Why there is no `measured` any more
 *
 * Batch 01 kept a fourth answer, `measured`, for an effort still building into the onset, and
 * printed `triggerDelayMs` beside it. But that number is never computed from the trace: it is
 * `80 + 400·missed` (weak trigger) or `100 + 450·missed` (COPD), whatever the waveform shows. The
 * independent review of PR #271 timed the events the label fell on: on MV-05's corrected arm the
 * breath at 55.92 s printed "267 ms" (measured) where the effort had crossed the engine's own
 * detection floor 140 ms before the onset; others on the same arm were 40 to 360 ms against a
 * printed 264–267. The events are also coincidences of two independent grids, not breaths the
 * effort caused (handoff §8, owner decision D5). Nothing in the runtime produces an interval
 * between a trigger event and a delivery, so no live breath can honestly be called measured, and
 * the status no longer exists. Timing one would need the trigger-event model D5 describes; it would
 * not be recovered by picking an event pair off the trace here.
 *
 * ## Why there is no look-back window any more
 *
 * The first repair replaced the whole-expiration scan with a window the length of the model's own
 * `triggerDelayMs`. That is still a window, and on MV-05 at 8 s it was long enough to reach the
 * *tail* of the previous breath's effort: the inspiration begins at 7.52 s, the modeled effort has
 * already decayed to zero by 7.28 s, and the 415 ms look-back caught the samples between 7.105 s
 * and 7.28 s on the way down. The helper then emitted the phenotype's 415 ms and called it
 * measured. A decaying tail is not the event that started the next breath.
 *
 * So there is no window to tune. The two samples either side of the onset are the whole test: the
 * effort has to be appreciable at the sample before the breath arrives and still at least as large
 * at the onset, which is what "an effort was under way and the machine answered it" looks like on
 * a trace. An effort on its way down fails it by construction.
 *
 * Everything is compared against the engine's own `EFFORT_DETECTION_FLOOR_CMH2O`. No new clinical
 * cutoff is introduced, no interval is scanned for a historical effort to borrow, and the
 * phenotype's assigned number is never labelled measured.
 */
import { EFFORT_DETECTION_FLOOR_CMH2O } from './physics'
import type { VentilationSimulationState, WaveformSample } from './types'

export type TriggerDelayStatus = 'model-estimate' | 'not-applicable' | 'unavailable'

export interface TriggerDelayEvidence {
  readonly status: TriggerDelayStatus
  /** Null unless an effort is associated with this breath; never 0 as a stand-in for "none". */
  readonly delayMs: number | null
  /** Largest modeled inspiratory effort belonging to this inspiration. */
  readonly breathEffortCmH2O: number
  /** Modeled effort at the single sample immediately before the onset. No window, no peak. */
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
   * The two samples either side of the boundary. An effort that triggered this breath is under way
   * when the breath arrives and has not already peaked and fallen away: appreciable at the sample
   * before, and no smaller at the onset.
   */
  const beforeOnset = waveforms[onset - 1]
  const precedingEffortCmH2O = Math.max(0, -beforeOnset.pmusCmH2O)
  const onsetEffortCmH2O = Math.max(0, -onsetSample.pmusCmH2O)
  const stillBuilding = onsetEffortCmH2O >= precedingEffortCmH2O

  /* The effort belonging to this inspiration: from the onset to the end of the buffer or of it. */
  const breath: WaveformSample[] = []
  for (let index = onset; index < waveforms.length; index += 1) {
    if (waveforms[index].phase !== 'inspiration') break
    breath.push(waveforms[index])
  }
  const breathEffortCmH2O = peakEffort(breath)

  if (precedingEffortCmH2O >= EFFORT_DETECTION_FLOOR_CMH2O && stillBuilding)
    return {
      status: 'model-estimate',
      delayMs: state.measurements.triggerDelayMs,
      breathEffortCmH2O,
      precedingEffortCmH2O,
      onsetSeconds: onsetSample.time,
      display: `${state.measurements.triggerDelayMs.toFixed(0)} ms · model estimate`,
      detail:
        'A modeled effort was already under way when this breath began, but the simulator does not time the interval between an effort and the breath it meets. The value is what the model assigns this phenotype, not a delay measured on this trace.',
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
