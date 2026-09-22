import { lineMeasurementSystem } from './measurementLines'
import type { FastFlushLineType, HemodynamicSimulationState } from './types'

/** Allow the modeled plateau/release and one complete subsequent pulse to reach the monitor. */
export function flushReleaseReady(state: HemodynamicSimulationState) {
  const until = state.measurementSystem.fastFlushActiveUntil
  return until !== null && state.timeSeconds >= until + 60 / state.measurements.heartRateBpm
}

/** Same physical safety predicate for the reducer and the Learn control. */
export function catheterFlushBlocked(state: HemodynamicSimulationState, line: FastFlushLineType) {
  return (
    line === 'pulmonary-artery' &&
    (state.catheter.position === 'wedge' ||
      state.catheter.balloonInflated ||
      state.catheter.floatBalloonInflated ||
      state.catheter.targetPosition !== null)
  )
}

/** Identifies the acquisition conditions, not a clinical measurement or a learner answer. */
export function pressureObservationKey(state: HemodynamicSimulationState, line: FastFlushLineType) {
  // The flushed line's own response, so repairing the arterial tubing is a new observation of the
  // arterial line and not of the others (report L9-05).
  const system = lineMeasurementSystem(state.measurementSystem, line)
  return JSON.stringify([
    line,
    system.dampingRatio,
    system.artifact,
    system.naturalFrequencyHz,
    system.transducerLevelCm,
    system.zeroed,
    ...(line === 'pulmonary-artery'
      ? [
          state.catheter.position,
          state.catheter.balloonInflated,
          state.catheter.floatBalloonInflated,
        ]
      : []),
  ])
}
