/**
 * The conditions a measurement was taken under, as one comparable value.
 *
 * Lifted out of `learningMeasurements.ts` unchanged so the engine can stamp a performed occlusion
 * with the same fingerprint the Learn lab already used to decide whether a captured hold is still
 * current. One definition, so a hold recorded by the engine and a hold captured by the lab cannot
 * disagree about what "the settings have changed since" means.
 */
import type { VentilationSimulationState } from './types'

/** Exclude playback, UI state and breath-by-breath volume: those do not change a measurement's conditions. */
export function measurementInputs(
  state: VentilationSimulationState,
): Record<string, string | number> {
  const settings = Object.fromEntries(
    Object.entries(state.ventilator.settings).map(([key, value]) => [
      key,
      typeof value === 'number' || typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  )
  return {
    ...settings,
    ...state.teachingMechanics,
    interventions: state.interventions
      .filter((i) => i.effectiveAt <= state.simulationTime && !i.interventionId.includes('hold'))
      .map((i) => i.interventionId)
      .join(','),
  }
}

/** The same conditions as one string, for records that only need to compare them. */
export function measurementConditionsFingerprint(state: VentilationSimulationState): string {
  return JSON.stringify(measurementInputs(state))
}
