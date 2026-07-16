import type { ActiveAlarm, CrrtScheduledEvent, CrrtSimulationState } from './types'
import { evaluateEngineReadiness, type EngineReadiness } from './readiness'

export type { EngineReadiness } from './readiness'

export function selectEngineReadiness(state: CrrtSimulationState): EngineReadiness {
  return evaluateEngineReadiness(state)
}

export function selectPrescriptionSummary(state: CrrtSimulationState) {
  return {
    status: state.prescription.status,
    modality: state.prescription.modality,
    flows: state.prescription.flows,
    prescribedEffluentRateMlHour: state.deliveredTherapy.prescribedEffluentRateMlHour,
    prescribedEffluentDoseMlKgHour: state.deliveredTherapy.prescribedEffluentDoseMlKgHour,
    deliveredDoseMlKgHour: state.deliveredTherapy.deliveredDoseMlKgHour,
    reviewStatus: state.prescription.reviewStatus,
  } as const
}

export function selectFluidBalanceLedger(state: CrrtSimulationState) {
  return {
    machinePfrSettingMlHour: state.prescription.flows.patientFluidRemovalMlHour,
    cumulativeMachinePfrMl: state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl,
    cumulativeWholePatientBalanceMl: state.deliveredTherapy.cumulativeWholePatientBalanceMl,
    unintendedDeviceNetGainMl: state.deliveredTherapy.fluidLedger.unintendedDeviceNetGainMl,
    externalRates: state.scenario.externalFluidRates,
    cumulativeLedger: state.deliveredTherapy.fluidLedger,
  } as const
}

export function selectPressureSummary(state: CrrtSimulationState) {
  const pressure = state.circuit.pressures
  const valuesAvailable =
    pressure.accessPressureMmHg !== null &&
    pressure.filterPressureMmHg !== null &&
    pressure.returnPressureMmHg !== null
  return {
    valuesAvailable,
    pressure,
    activePressureFaults: state.scenario.activeFaults.filter((fault) =>
      [
        'access-obstruction',
        'access-disconnection',
        'return-obstruction',
        'return-disconnection',
        'filter-fouling',
        'effluent-obstruction',
      ].includes(fault),
    ),
    accessibleText: valuesAvailable
      ? `Simulated raw circuit pressures: access ${pressure.accessPressureMmHg} mmHg, filter ${pressure.filterPressureMmHg} mmHg, return ${pressure.returnPressureMmHg} mmHg. Device operating points and alarm limits remain review-pending.`
      : 'Simulated circuit pressures are unavailable until an authored pressure model is loaded.',
  } as const
}

export function selectNextScheduledEvent(state: CrrtSimulationState): CrrtScheduledEvent | null {
  return (
    state.scenario.eventQueue.find(
      (event) =>
        event.scheduledAtSeconds > state.simulationTimeSeconds &&
        !state.scenario.appliedEventIds.includes(event.id),
    ) ?? null
  )
}

export function selectFirstAlarmPendingDeviceMapping(
  state: CrrtSimulationState,
): ActiveAlarm | null {
  return [...state.alarms].sort((left, right) => left.code.localeCompare(right.code))[0] ?? null
}
