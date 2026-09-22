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

/**
 * Mark an open occlusion as disturbed the moment its conditions change.
 *
 * `advanceSimulation` re-reads the fingerprint at every occluded step, which catches a change that
 * happens while the model is running. It cannot catch one that happens between steps: with the
 * simulation paused, PEEP 5 → 9 → 5 during a hold produced no timestep at all, so nothing compared
 * anything, and the record finished `acquired-valid` because its opening and closing fingerprints
 * matched again. The maneuver was not a controlled one and no later reversal makes it one.
 *
 * So the latch lives at the mutation instead: any state transition that changes the measurement
 * fingerprint while a hold is open sets it, using the record's own stored `conditions` as the
 * reference. It only ever latches on — reverting the control cannot clear it — and it asks the same
 * `measurementInputs` this module already defines, so there is no second list of which settings
 * count. Playback, screen, disclosure and waveform freeze are outside that fingerprint by design
 * and therefore cannot invalidate a hold.
 */
export function latchOpenHoldConditionChange(
  state: VentilationSimulationState,
): VentilationSimulationState {
  const index = state.holdRecords.findIndex((record) => record.completedAtSeconds === null)
  if (index < 0) return state
  const record = state.holdRecords[index]
  if (record.conditionsChangedDuringHold) return state
  if (measurementConditionsFingerprint(state) === record.conditions) return state
  const holdRecords = [...state.holdRecords]
  holdRecords[index] = {
    ...record,
    conditionsChangedDuringHold: true,
    interpretable: false,
    invalidReason: 'conditions-changed',
  }
  return { ...state, holdRecords }
}
