import { calculateCrrtMachineFluidLedger } from './circuitFluidLedger'
import {
  advanceFluidLedger,
  calculateWholePatientNetBalanceMl,
  emptyExternalFluidRates,
  emptyFluidLedgerTotals,
} from './engine/fluidModel'
import {
  calculateCrrtPredictedConsequences,
  crrtConstructionFlowRates,
  CRRT_STARTING_CONSTRUCTION,
  type CrrtPrescriptionConstruction,
} from './stagedPrescriptionModel'

export const CRRT_FOUNDATION_EXAMPLE_ID = 'synthetic-80kg-24h'
export const CRRT_FOUNDATION_CONSTRUCTION: CrrtPrescriptionConstruction = Object.freeze({
  ...CRRT_STARTING_CONSTRUCTION,
  modalityViewId: 'cvvhd',
  simulatedWeightKg: 80,
  bloodFlowMlPerMinute: 120,
  preBloodPumpMlPerHour: 0,
  dialysateMlPerHour: 1900,
  preReplacementMlPerHour: 0,
  postReplacementMlPerHour: 0,
  patientFluidRemovalMlPerHour: 100,
  treatmentWindowHours: 24,
  downtimeHours: 3,
})

/** Projection only: external inputs/outputs continue during entered CRRT downtime. */
export function projectFoundationFluidBalance(
  construction: CrrtPrescriptionConstruction,
  externalInputMlHour = 150,
  externalOutputMlHour = 50,
) {
  if (![externalInputMlHour, externalOutputMlHour].every((n) => Number.isFinite(n) && n >= 0))
    throw new RangeError('External rates must be nonnegative and finite')
  const consequences = calculateCrrtPredictedConsequences(construction)
  const machine = calculateCrrtMachineFluidLedger(crrtConstructionFlowRates(construction))
  if (machine.machinePatientFluidRemovalMlHour === null) return null
  const rates = {
    ...emptyExternalFluidRates,
    otherInputMlHour: externalInputMlHour,
    urineOutputMlHour: externalOutputMlHour,
  }
  const running = advanceFluidLedger(
    emptyFluidLedgerTotals,
    rates,
    machine.machinePatientFluidRemovalMlHour,
    0,
    consequences.intensity.deliveredHours * 3600,
  )
  const totals = advanceFluidLedger(running, rates, 0, 0, construction.downtimeHours * 3600)
  return { machine, totals, netBalanceMl: calculateWholePatientNetBalanceMl(totals) }
}

export interface CrrtPrescriptionComparison {
  readonly baseline: CrrtPrescriptionConstruction
  readonly changed: CrrtPrescriptionConstruction
  readonly response: 'lower' | 'same' | 'removal'
  readonly correct: boolean
}

/** Only a controlled, valid downtime comparison can supply this particular exercise's evidence. */
export function validDowntimeComparison(
  baseline: CrrtPrescriptionConstruction,
  changed: CrrtPrescriptionConstruction | null,
): boolean {
  if (
    !changed ||
    changed.downtimeHours <= baseline.downtimeHours ||
    changed.downtimeHours > changed.treatmentWindowHours
  )
    return false
  if (
    (Object.keys(baseline) as (keyof CrrtPrescriptionConstruction)[]).some(
      (key) => key !== 'downtimeHours' && baseline[key] !== changed[key],
    )
  )
    return false
  try {
    const before = calculateCrrtPredictedConsequences(baseline)
    const after = calculateCrrtPredictedConsequences(changed)
    return (
      before.resolution === 'resolved' &&
      after.resolution === 'resolved' &&
      after.circuitView.consistencyNotes.length === 0 &&
      Number.isFinite(after.intensity.deliveredDoseMlPerKgHour) &&
      after.intensity.deliveredDoseMlPerKgHour < before.intensity.deliveredDoseMlPerKgHour
    )
  } catch {
    return false
  }
}
