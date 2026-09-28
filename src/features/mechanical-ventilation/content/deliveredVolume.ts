/**
 * Why an exhaled volume can read a few millilitres above the selected tidal volume — stated from
 * the engine's own delivery rule, and only when that rule can account for the whole difference.
 *
 * The walkthrough (S2-1) saw "exhaled volume 427 mL" beside "VT 420 mL" at baseline in Section 2
 * and stopped to wonder whether it was the point. It is not a display error: the engine integrates
 * volume in fixed `WAVEFORM_STEP_SECONDS` steps and, in conventional volume control, stops flow at
 * the first step whose delivered volume has reached the target (`simulation.ts`, the volume-ac
 * branch). At 40 L/min a step carries about 13 mL, so a 420-mL target is met on the 32nd step at
 * 427 mL; at 60 L/min the target falls exactly on a step and the breath is 420 mL.
 *
 * Nothing is rounded to agree and delivery is not changed. The note is printed only for
 * volume-targeted delivery with a trace-measured exhaled volume that exceeds the selection by no
 * more than one step at the selected peak flow; a larger or opposite difference gets no attributed
 * cause from this file.
 */
import { usesPressureTargetedDelivery, WAVEFORM_STEP_SECONDS } from '../engine/physics'
import type { VentilationSimulationState } from '../engine/types'

/** Volume one engine step carries at the selected peak flow, in mL; null outside volume control. */
export function volumeDeliveryStepMl(state: VentilationSimulationState): number | null {
  const settings = state.ventilator.settings
  if (settings.mode !== 'volume-ac' || usesPressureTargetedDelivery(settings)) return null
  return (settings.peakFlowLMin / 60) * WAVEFORM_STEP_SECONDS * 1000
}

export function deliveredVolumeStepNote(state: VentilationSimulationState): string | null {
  const settings = state.ventilator.settings
  const measurements = state.measurements
  const step = volumeDeliveryStepMl(state)
  if (step === null || settings.mode !== 'volume-ac') return null
  if (measurements.exhaledVtSource !== 'trace') return null
  const over = measurements.exhaledVtMl - settings.vtMl
  // Exhaled volume is published to the nearest millilitre.
  if (over <= 0 || over > step + 0.5) return null
  return `Selected ${settings.vtMl} mL. This simulator delivers flow in ${Math.round(WAVEFORM_STEP_SECONDS * 1000)}-ms steps and stops at the first step that reaches the selected volume, so at ${settings.peakFlowLMin} L/min a breath can exceed it by up to ${Math.round(step)} mL.`
}
