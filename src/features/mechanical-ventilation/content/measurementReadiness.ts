/**
 * Whether a volume the console prints was delivered and exhaled, or only predicted.
 *
 * `measurements.exhaledVtMl` falls back to the analytic prediction until the waveform buffer holds a
 * completed inflation (`exhaledVtSource: 'predicted'`). The case opens with a prepared mechanical
 * history, so that is no longer true of any live case at open — MV-05 used to open reading
 * "VTE 1400", the clamp on the prediction — but it can still happen after a very low rate or a
 * mode change leaves no completed breath on screen. A ventilator shows no exhaled volume until it
 * has measured one; neither do we. Minute volume is that volume times the rate, so it follows.
 */
import type { VentilationSimulationState } from '../engine/types'

export const AWAITING_EXHALED_BREATH = 'Awaiting a completed breath on the trace'

export interface ExhaledVolumeReading {
  readonly observed: boolean
  /** Null when no completed breath has been exhaled on the trace yet. */
  readonly exhaledVtMl: number | null
  readonly minuteVentilationLMin: number | null
}

export function exhaledVolumeReading(state: VentilationSimulationState): ExhaledVolumeReading {
  const observed = state.measurements.exhaledVtSource === 'trace'
  return {
    observed,
    exhaledVtMl: observed ? state.measurements.exhaledVtMl : null,
    minuteVentilationLMin: observed ? state.measurements.minuteVentilationLMin : null,
  }
}
