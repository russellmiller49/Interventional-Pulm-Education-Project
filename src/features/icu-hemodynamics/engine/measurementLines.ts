import type { FastFlushLineType, MeasurementSystemState } from './types'

/**
 * The measurement system as one line sees it (HD-PRE-REVIEW-02, report L9-05).
 *
 * Every channel used to read one shared dynamic response, so a damped arterial line damped the
 * pulmonary-artery and central-venous traces too, and repairing it restored all three. The
 * systemic arterial line can now carry its own response (`MeasurementSystemState.arterialLine`).
 * Without one — every state authored before this contract — the arterial channel sees the shared
 * response, exactly as before. Level, zero and noise stay shared across lines in this model.
 */
export function arterialMeasurementSystem(system: MeasurementSystemState): MeasurementSystemState {
  const line = system.arterialLine
  if (!line) return system
  return {
    ...system,
    dampingRatio: line.dampingRatio,
    naturalFrequencyHz: line.naturalFrequencyHz,
    artifact: line.artifact,
  }
}

export function lineMeasurementSystem(
  system: MeasurementSystemState,
  line: FastFlushLineType,
): MeasurementSystemState {
  return line === 'systemic-arterial' ? arterialMeasurementSystem(system) : system
}

/** Whether the arterial line currently has a response of its own rather than the shared one. */
export function arterialLineIsSeparate(system: MeasurementSystemState): boolean {
  return Boolean(system.arterialLine)
}
