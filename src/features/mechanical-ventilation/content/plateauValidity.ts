/**
 * One rule for when a plateau may be read as mechanics — used by every surface that reads one.
 *
 * The engine has published `plateauIsInterpretable` since the hold was rebuilt: it is false at any
 * instant the patient is pulling, because an occlusion then reports alveolar pressure *minus* that
 * effort rather than the elastic pressure of the respiratory system. The console readout and the
 * teaching panel's validity note already said so.
 *
 * What they did not do is stop *crediting* the inference. The same render printed
 * "Pplateau 10 — elastic load only; gap to peak is resistive" beside "not interpretable: patient
 * effort 8 cmH₂O", drew an Elastic band of 3 where the relaxed value was 18, and graded an answer
 * whose rationale was the peak-to-plateau split. Every lesson that teaches the split runs a patient
 * with spontaneous effort — the casebook has no passive volume-controlled patient — so this was the
 * normal state of those lessons rather than an edge case.
 *
 * ## Why this is a window and not the raw flag
 *
 * The engine's flag is instantaneous, and the patient's effort keeps running through an occlusion:
 * the neural breath re-fires under the closed valves, so on MV-13 the flag reads
 * false → true (t+0.3) → false (t+2.6) → true (t+3.3) inside one four-second hold, with the
 * displayed plateau swinging 17.4 → 9.4 → 17.3. Gating each render on the raw flag would make the
 * interpretation appear and disappear about three times per hold.
 *
 * It would also teach the wrong thing. A plateau that moves like that *is* reporting the patient
 * rather than the lung, which is exactly what this module already tells the learner to watch for:
 * "repeat the occlusion over several breaths and watch whether the value settles". So the question
 * asked here is the clinical one — is this patient passive? — answered over a window long enough to
 * contain a whole neural breath, rather than at whichever instant a render happened to land on.
 *
 * ## The rule
 *
 *   A plateau-based mechanics claim — the elastic/resistive split, the peak-to-plateau difference
 *   read as resistance, static compliance attributed to a hold — is made only when the patient has
 *   been quiet across the recent trace. When they have not, the surface withholds the claim and
 *   says why, and names the direction of the error, because effort makes a plateau read *low* and
 *   a stiff lung then looks safe.
 *
 * Withholding is not hiding. The measured numbers stay on screen exactly as a real ventilator would
 * show them; what is withheld is the interpretation laid over them.
 *
 * No thresholds are published here. `EFFORT_DETECTION_FLOOR_CMH2O` is the engine's own floor for
 * "appreciable effort", not a bedside limit, and it is never printed.
 */
import { EFFORT_DETECTION_FLOOR_CMH2O } from '../engine/physics'
import type { VentilationSimulationState, WaveformSample } from '../engine/types'

/**
 * Long enough to contain a whole neural breath on every case in the casebook — the slowest neural
 * rate here is 20/min, a three-second period. Short enough that establishing passivity actually
 * clears the verdict rather than leaving it stuck for the rest of the run.
 */
const PASSIVITY_WINDOW_SECONDS = 4

export interface PlateauReadingValidity {
  /** True when a plateau here reports respiratory-system mechanics and the split means what it says. */
  readonly interpretable: boolean
  /** Largest inspiratory effort anywhere in the recent trace — what decides the verdict. */
  readonly recentEffortCmH2O: number
  /**
   * The engine's instantaneous flag. True during the quiet part of an occlusion even on a patient
   * who is not passive, which is why it is reported rather than obeyed.
   */
  readonly quietAtThisInstant: boolean
  /** What the console displays. */
  readonly displayedPlateauCmH2O: number
  /** What the same lung would show relaxed. Not a device reading — the model's own value. */
  readonly relaxedPlateauCmH2O: number
  /**
   * How far the displayed plateau sits below the relaxed one: the size of the error, always in the
   * reassuring direction.
   */
  readonly understatementCmH2O: number
  /** Learner-facing reason the reading cannot carry a mechanics claim; null when it can. */
  readonly reason: string | null
}

function recentPeakEffortCmH2O(waveforms: readonly WaveformSample[], nowSeconds: number): number {
  let peak = 0
  for (let index = waveforms.length - 1; index >= 0; index -= 1) {
    const sample = waveforms[index]
    if (nowSeconds - sample.time > PASSIVITY_WINDOW_SECONDS) break
    const effort = -sample.pmusCmH2O
    if (effort > peak) peak = effort
  }
  return peak
}

export function plateauReadingValidity(state: VentilationSimulationState): PlateauReadingValidity {
  const { measurements, waveforms } = state
  const recentEffort = recentPeakEffortCmH2O(waveforms, state.simulationTime)
  const interpretable = recentEffort < EFFORT_DETECTION_FLOOR_CMH2O
  const displayed = measurements.plateauPressureCmH2O
  const relaxed = measurements.relaxedPlateauPressureCmH2O
  return {
    interpretable,
    recentEffortCmH2O: recentEffort,
    quietAtThisInstant: measurements.plateauIsInterpretable,
    displayedPlateauCmH2O: displayed,
    relaxedPlateauCmH2O: relaxed,
    understatementCmH2O: Math.max(0, relaxed - displayed),
    reason: interpretable
      ? null
      : 'The patient is breathing against this measurement, so a plateau here is alveolar pressure minus their effort rather than the elastic pressure of the respiratory system. Effort makes a plateau read low, so the split would understate the load rather than overstate it — and the value moves each time the effort returns, which is the tell that it is reporting the patient rather than the lung.',
  }
}

/**
 * The short form, for a readout that has room for a caveat but not a paragraph.
 *
 * Kept beside the long one so the two cannot drift into saying different things.
 */
export function plateauWithheldNote(validity: PlateauReadingValidity): string {
  return `not interpretable: patient effort ${validity.recentEffortCmH2O.toFixed(0)} cmH₂O against this measurement`
}

/** What the elastic/resistive split is called when it cannot be made. */
export const PLATEAU_SPLIT_WITHHELD_LABEL = 'Not separable while the patient is pulling'
