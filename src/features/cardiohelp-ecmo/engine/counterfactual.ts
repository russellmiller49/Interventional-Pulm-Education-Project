import { ecmoSimulationReducer, observeSimulation } from './reducer'
import { createInitialSimulationState } from './simulation'
import type { EcmoObservation, SimulationMode } from './types'

/**
 * What the same case does over the same modeled seconds when nobody acts (ECMO-FELLOW-02).
 *
 * A debrief that shows "SpO₂ +7 after the repositioning" cannot tell the learner whether the
 * repositioning did it. The September 2026 walkthrough re-ran seven cases with and without acting
 * and found that on several of them the same values moved on the same schedule either way; a learner
 * reading a before/after pair credits the action with everything the case did on its own.
 *
 * This replays the case from load with the clock alone — no plan, no intervention, no control — and
 * reads the same signals at the requested times. It is deterministic: the engine has no randomness
 * and no wall clock, so the replay is the exact counterfactual of the run it is shown beside, up to
 * the first action. It is computed on demand for display and never stored, scored or persisted.
 */
export function replayWithoutAction(
  scenarioId: string,
  times: readonly number[],
  mode: SimulationMode = 'guided',
): ReadonlyMap<number, EcmoObservation> {
  const wanted = [...new Set(times.filter((time) => Number.isInteger(time) && time >= 0))].sort(
    (a, b) => a - b,
  )
  const readings = new Map<number, EcmoObservation>()
  if (wanted.length === 0) return readings
  let state = createInitialSimulationState(scenarioId, mode)
  for (const time of wanted) {
    while (state.simulationTime < time) state = ecmoSimulationReducer(state, { type: 'STEP' })
    readings.set(time, observeSimulation(state))
  }
  return readings
}
