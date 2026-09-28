/**
 * Why an exhaled volume can read a few millilitres either side of the selected tidal volume — stated
 * from the engine's own delivery rule, and only when that rule accounts for the whole difference.
 *
 * The walkthrough (S2-1) saw "exhaled volume 427 mL" beside "VT 420 mL" at baseline in Section 2
 * and stopped to wonder whether it was the point. It is not a display error, and it is not a fixed
 * overshoot either. The engine integrates volume in fixed `WAVEFORM_STEP_SECONDS` steps, and a
 * conventional volume-control breath flows for its inspiratory flow time measured on the breath's
 * own clock. At 40 L/min that time is 0.63 s — 31.5 steps — and because the breath's onset falls at
 * a different point between samples from one breath to the next, successive breaths receive 31 or
 * 32 whole steps: 413 or 427 mL (a one-minute replay at the Section 2 baseline gives eight of each).
 * At 60 L/min (0.42 s, 21 steps) and 30 L/min (0.84 s, 42 steps) every breath is exactly 420 mL.
 *
 * Nothing is rounded to agree and delivery is not changed. The note is printed only for square-flow,
 * volume-targeted delivery whose flow time is not a whole number of steps, with a trace-measured
 * exhaled volume within one step of the selection; any other difference gets no attributed cause
 * from this file.
 */
import {
  deriveVolumeFlowTimeSeconds,
  usesPressureTargetedDelivery,
  WAVEFORM_STEP_SECONDS,
} from '../engine/physics'
import type { VentilationSimulationState } from '../engine/types'

export interface VolumeDeliverySteps {
  /** Volume one step carries at the selected peak flow, in mL. */
  readonly stepMl: number
  /** The flow time in steps; fractional when the breath cannot be a whole number of steps. */
  readonly steps: number
  readonly fewerStepsMl: number
  readonly moreStepsMl: number
}

export function volumeDeliverySteps(state: VentilationSimulationState): VolumeDeliverySteps | null {
  const settings = state.ventilator.settings
  if (settings.mode !== 'volume-ac' || usesPressureTargetedDelivery(settings)) return null
  if (settings.flowPattern !== 'square') return null
  const stepMl = (settings.peakFlowLMin / 60) * WAVEFORM_STEP_SECONDS * 1000
  const steps = deriveVolumeFlowTimeSeconds(settings) / WAVEFORM_STEP_SECONDS
  return {
    stepMl,
    steps,
    fewerStepsMl: Math.floor(steps) * stepMl,
    moreStepsMl: Math.ceil(steps) * stepMl,
  }
}

export function deliveredVolumeStepNote(state: VentilationSimulationState): string | null {
  const settings = state.ventilator.settings
  const measurements = state.measurements
  const delivery = volumeDeliverySteps(state)
  if (delivery === null || settings.mode !== 'volume-ac') return null
  // A whole number of steps delivers the selection itself; any difference then has another cause.
  if (Math.abs(delivery.steps - Math.round(delivery.steps)) < 0.01) return null
  if (measurements.exhaledVtSource !== 'trace') return null
  // Exhaled volume is published to the nearest millilitre.
  if (Math.abs(measurements.exhaledVtMl - settings.vtMl) > delivery.stepMl + 0.5) return null
  return `Selected ${settings.vtMl} mL. This simulator delivers flow in ${Math.round(WAVEFORM_STEP_SECONDS * 1000)}-ms steps; at ${settings.peakFlowLMin} L/min this inspiration is ${delivery.steps.toFixed(1)} steps long, so successive breaths receive ${Math.floor(delivery.steps)} or ${Math.ceil(delivery.steps)} steps — about ${Math.round(delivery.fewerStepsMl)} or ${Math.round(delivery.moreStepsMl)} mL.`
}
